"use client";

import { use, useMemo, useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Decimal } from "decimal.js";
import {
  ChevronDown,
  Loader2,
  AlertCircle,
} from "lucide-react";

import { useUiStore } from "@/lib/stores/uiStore";
import { purchaseInvoiceSchema, type PurchaseInvoiceInput } from "@/lib/schemas/vouchers";
import { calculateGST, type GSTTaxType } from "@/lib/services/GSTCalculator";
import { LineItemsTable, type StockItemOption, type GodownOption } from "@/components/voucher/LineItemsTable";
import { PurchaseSummaryPanel } from "@/components/voucher/PurchaseSummaryPanel";
import type { AccountingEntryRow } from "@/components/voucher/AccountingEntriesPanel";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PartyOption {
  id: string;
  name: string;
  stateCode?: string;
  gstin?: string;
  partyType?: string;
}

interface CompanySession {
  user?: { companyId?: string; stateCode?: string; name?: string };
}

interface UomOption {
  id: string;
  name: string;
  symbol: string;
}

// ---------------------------------------------------------------------------
// Inline helper: collapsible advanced section
// ---------------------------------------------------------------------------

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  badge?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CollapsibleSection({ title, icon: Icon, children, badge }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100">
      <button
        type="button"
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors rounded-lg"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-gray-400" />}
          <span className="text-sm font-semibold text-gray-700">{title}</span>
          {badge && (
            <span className="ml-1 text-xs bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 font-medium">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-gray-400 transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="px-6 pb-6 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Supplier Create Dialog
// ---------------------------------------------------------------------------

interface QuickSupplierDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (party: PartyOption) => void;
}

function QuickSupplierDialog({ open, onClose, onCreated }: QuickSupplierDialogProps) {
  const [name, setName] = useState("");
  const [gstin, setGstin] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/masters/ledgers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyType: "Supplier",
          name: name.trim(),
          gstin: gstin.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.issues?.[0]?.message ?? err?.error ?? "Failed to create supplier");
        return;
      }
      const ledger = await res.json();
      toast.success(`Supplier "${ledger.name}" created`);
      onCreated({ id: ledger.id, name: ledger.name, partyType: "Supplier" });
      setName(""); setGstin(""); setPhone("");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setName(""); setGstin(""); setPhone(""); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Supplier</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Name <span className="text-red-500">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Supplier name" />
          </div>
          <div className="space-y-1.5">
            <Label>GSTIN <span className="text-gray-400 text-xs font-normal">(optional)</span></Label>
            <Input value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="29ABCDE1234F1Z5" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone <span className="text-gray-400 text-xs font-normal">(optional)</span></Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Create Supplier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Accounting entry helper
// ---------------------------------------------------------------------------

function buildPurchaseEntries(
  partyName: string,
  taxableAfterDiscounts: Decimal,
  cgstTotal: Decimal,
  sgstTotal: Decimal,
  igstTotal: Decimal,
  freightAmt: Decimal,
  freightGstAmt: Decimal,
  tcsAmt: Decimal,
  roundOff: Decimal,
  grandTotal: Decimal,
): AccountingEntryRow[] {
  const entries: AccountingEntryRow[] = [];
  if (taxableAfterDiscounts.gt(0))
    entries.push({ ledgerId: "purchase", ledgerName: "Purchase Account", drCr: "DR", amount: taxableAfterDiscounts.toFixed(2) });
  if (cgstTotal.gt(0))
    entries.push({ ledgerId: "cgst-input", ledgerName: "CGST Input Tax", drCr: "DR", amount: cgstTotal.toFixed(2) });
  if (sgstTotal.gt(0))
    entries.push({ ledgerId: "sgst-input", ledgerName: "SGST Input Tax", drCr: "DR", amount: sgstTotal.toFixed(2) });
  if (igstTotal.gt(0))
    entries.push({ ledgerId: "igst-input", ledgerName: "IGST Input Tax", drCr: "DR", amount: igstTotal.toFixed(2) });
  if (freightAmt.gt(0))
    entries.push({ ledgerId: "freight", ledgerName: "Freight & Forwarding", drCr: "DR", amount: freightAmt.toFixed(2) });
  if (freightGstAmt.gt(0))
    entries.push({ ledgerId: "freight-gst", ledgerName: "Freight GST Input", drCr: "DR", amount: freightGstAmt.toFixed(2) });
  if (tcsAmt.gt(0))
    entries.push({ ledgerId: "tcs-receivable", ledgerName: "TCS Receivable", drCr: "DR", amount: tcsAmt.toFixed(2) });
  if (roundOff.gt(0))
    entries.push({ ledgerId: "roundoff", ledgerName: "Round Off", drCr: "DR", amount: roundOff.toFixed(2) });
  if (roundOff.lt(0))
    entries.push({ ledgerId: "roundoff", ledgerName: "Round Off", drCr: "CR", amount: roundOff.abs().toFixed(2) });
  if (grandTotal.gt(0))
    entries.push({ ledgerId: "party", ledgerName: partyName || "Supplier", drCr: "CR", amount: grandTotal.toFixed(2) });
  return entries;
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

async function updateVoucherAPI(id: string, data: PurchaseInvoiceInput): Promise<{ id: string; voucherNo: string }> {
  const res = await fetch(`/api/v1/vouchers/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to update purchase invoice");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Quick Stock Item Create Dialog
// ---------------------------------------------------------------------------

interface QuickStockItemDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (item: StockItemOption) => void;
  initialName?: string;
  uoms: UomOption[];
}

function QuickStockItemDialog({ open, onClose, onCreated, initialName, uoms }: QuickStockItemDialogProps) {
  const [name, setName] = useState(initialName || "");
  const [gstRate, setGstRate] = useState("18");
  const [uomId, setUomId] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim() || !uomId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/masters/stock-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          gstRate: new Decimal(String(gstRate || '0')).toNumber(),
          uomId,
          hsnCode: hsnCode.trim() || undefined,
          openingRate: "0",
          openingQty: "0",
          reorderQty: "0",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error ?? "Failed to create item");
        return;
      }
      const item = await res.json();
      toast.success(`Item "${item.name}" created`);
      onCreated({
        id: item.id,
        name: item.name,
        gstRate: new Decimal(String(item.gstRate || '0')).toNumber(),
        openingRate: item.openingRate,
        currentQty: item.currentQty,
        hsnCode: item.hsnCode ?? "",
        uom: uoms.find(u => u.id === uomId)?.symbol
      });
      setName(""); setGstRate("18"); setHsnCode("");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Stock Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Name <span className="text-red-500">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>GST Rate (%)</Label>
              <select
                value={gstRate}
                onChange={(e) => setGstRate(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
              >
                {["0", "0.1", "0.25", "1", "1.5", "3", "5", "6", "7.5", "12", "18", "28"].map(r => (
                  <option key={r} value={r}>{r}%</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>UOM <span className="text-red-500">*</span></Label>
              <select
                value={uomId}
                onChange={(e) => setUomId(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
              >
                <option value="">Select...</option>
                {uoms.map(u => (
                  <option key={u.id} value={u.id}>{u.symbol} ({u.name})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>HSN Code</Label>
            <Input value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} placeholder="8-digit HSN" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={handleSave}
            disabled={saving || !name.trim() || !uomId}
          >
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Create Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function PurchaseInvoiceEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { uiMode } = useUiStore();
  const _isSimple = uiMode === "simple";
  const queryClient = useQueryClient();

  const [defaultGodownId, _setDefaultGodownId] = useState("");
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [pendingItemIndex, setPendingItemIndex] = useState<number | null>(null);
  const [pendingItemName, setPendingItemName] = useState("");

  // ── Data fetches ─────────────────────────────────────────────────────────
  const { data: voucher, isLoading: isVoucherLoading } = useQuery({
    queryKey: ["voucher", id],
    queryFn: () => fetch(`/api/v1/vouchers/${id}`).then((r) => r.json()),
  });

  const { data: sessionData } = useQuery<CompanySession>({
    queryKey: ["session"],
    queryFn: () => fetch("/api/auth/session").then((r) => r.json()),
  });
  const companyStateCode = sessionData?.user?.stateCode ?? "";

  const { data: parties = [], refetch: refetchParties } = useQuery<PartyOption[]>({
    queryKey: ["parties"],
    queryFn: () => fetch("/api/v1/masters/ledgers?type=party").then((r) => r.json()),
  });

  const { data: stockItems = [] } = useQuery<StockItemOption[]>({
    queryKey: ["stock-items"],
    queryFn: () => fetch("/api/v1/masters/stock-items").then((r) => r.json()),
  });

  const { data: godowns = [] } = useQuery<GodownOption[]>({
    queryKey: ["godowns"],
    queryFn: () => fetch("/api/v1/masters/godowns").then((r) => r.json()),
  });

  const { data: uoms = [] } = useQuery<UomOption[]>({
    queryKey: ["uoms"],
    queryFn: () => fetch("/api/v1/masters/uom").then((r) => r.json()),
  });

  // ── Form ────────────────────────────────────────────────────────────────
  const form = useForm<PurchaseInvoiceInput>({
    resolver: zodResolver(purchaseInvoiceSchema),
    defaultValues: {
      voucherType: "PURCHASE",
      status: "POSTED",
      date: new Date().toISOString().split("T")[0],
      items: [{ itemId: "", qty: "1", rate: "0" }],
    },
  });

  const { register, handleSubmit, control, watch, setValue, reset } = form;

  // Initialize form when voucher data arrives
  useEffect(() => {
    if (voucher) {
      reset({
        voucherType: "PURCHASE",
        status: voucher.status,
        date: voucher.date.split("T")[0],
        partyLedgerId: voucher.partyLedgerId,
        narration: voucher.narration ?? "",
        supplierInvoiceNo: voucher.supplierInvoiceNo ?? "",
        supplierInvoiceDate: voucher.supplierInvoiceDate ? voucher.supplierInvoiceDate.split("T")[0] : "",
        placeOfSupply: voucher.placeOfSupply ?? "",
        invoiceType: voucher.invoiceType ?? "TAX_INVOICE",
        taxMode: voucher.taxMode ?? "AUTO",
        paymentTerms: voucher.paymentTerms ?? "",
        dueDate: voucher.dueDate ? voucher.dueDate.split("T")[0] : "",
        freightAmount: voucher.freightAmount ?? "0",
        freightGstRate: voucher.freightGstRate ?? 18,
        tcsRate: voucher.tcsRate ?? "0",
        roundOffMode: voucher.roundOffMode ?? "AUTO",
        roundOffManual: voucher.roundOffManual ?? "0",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: (voucher.voucherItems ?? []).map((item: any) => ({
          itemId: item.itemId,
          qty: item.qty,
          rate: item.rate,
          unit: item.unit ?? "",
          discountType: item.discountType ?? "PERCENT",
          discountPct: item.discountPct ?? "0",
          discountAmt: item.discountAmt ?? "0",
          godownId: item.godownId ?? "",
          hsnCode: item.hsnCode ?? "",
          itcEligible: item.itcEligible ?? true,
          _gstRate: new Decimal(String(item.cgstRate ?? "0")).plus(item.sgstRate ?? "0").plus(item.igstRate ?? "0").toNumber(),
        })),
        headerDiscounts: voucher.headerDiscounts ?? [],
        transporterName: voucher.transporterName ?? "",
        lrNo: voucher.lrNo ?? "",
        vehicleNo: voucher.vehicleNo ?? "",
        destination: voucher.destination ?? "",
        dispatchWeight: voucher.dispatchWeight ?? "",
        buyerPoNo: voucher.buyerPoNo ?? "",
        buyerPoDate: voucher.buyerPoDate ? voucher.buyerPoDate.split("T")[0] : "",
        supplierSoNo: voucher.supplierSoNo ?? "",
        dispatchDocNo: voucher.dispatchDocNo ?? "",
        deliveryNoteNo: voucher.deliveryNoteNo ?? "",
        ackNo: voucher.ackNo ?? "",
        ackDate: voucher.ackDate ? voucher.ackDate.split("T")[0] : "",
        packageCartons: voucher.packageCartons ?? 0,
        packageDrums: voucher.packageDrums ?? 0,
        packageBags: voucher.packageBags ?? 0,
        packageTins: voucher.packageTins ?? 0,
        packageWeight: voucher.packageWeight ?? "",
        packageVolume: voucher.packageVolume ?? "",
      });
    }
  }, [voucher, reset]);

  // ── 15-day Lock Logic ──
  const isPosted = voucher?.status === "POSTED";
  const voucherDate = voucher ? new Date(voucher.date) : null;
  const diffDays = voucherDate ? (Date.now() - voucherDate.getTime()) / (1000 * 60 * 60 * 24) : 0;
  const isLocked = isPosted && diffDays > 15;

  // ── Watched form values ───────────────────────────────────────────────────
  const watchedPartyId = watch("partyLedgerId");
  const watchedItems = useWatch({ control, name: "items" });
  const watchedHeaderDiscounts = useWatch({ control, name: "headerDiscounts" });
  const watchedFreightAmount = useWatch({ control, name: "freightAmount" }) ?? "0";
  const watchedFreightGstRate = useWatch({ control, name: "freightGstRate" }) ?? 18;
  const watchedTcsRate = useWatch({ control, name: "tcsRate" }) ?? "0";
  const watchedRoundOffMode = (useWatch({ control, name: "roundOffMode" }) ?? "AUTO") as "AUTO" | "MANUAL";
  const watchedRoundOffManual = useWatch({ control, name: "roundOffManual" }) ?? "0";

  const selectedParty = parties.find((p) => p.id === watchedPartyId);
  const partyStateCode = selectedParty?.stateCode ?? "";

  // ── Totals ──
  const totals = useMemo(() => {
    let taxable = new Decimal(0);
    let cgst = new Decimal(0);
    let sgst = new Decimal(0);
    let igst = new Decimal(0);

    for (const item of watchedItems ?? []) {
      const qty = new Decimal(String(item?.qty || "0"));
      const rate = new Decimal(String(item?.rate || "0"));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const discType = (item as any)?.discountType ?? "PERCENT";
      let taxableValue: Decimal;
      if (discType === "NONE") {
        taxableValue = qty.times(rate);
      } else if (discType === "FLAT_INR") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const flatDisc = new Decimal(String((item as any)?.discountAmt || "0"));
        const gross = qty.times(rate).minus(flatDisc);
        taxableValue = gross.gt(0) ? gross : new Decimal(0);
      } else {
        const discPct = new Decimal(String(item?.discountPct || "0"));
        taxableValue = qty.times(rate).times(new Decimal(1).minus(discPct.dividedBy(100)));
      }
      taxable = taxable.plus(taxableValue);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gstRate = new Decimal(String((item as any)?.gstRateOverride ?? (item as any)?._gstRate ?? 0));
      const gstResult = calculateGST({ taxableValue, gstRate, companyStateCode, partyStateCode });
      cgst = cgst.plus(gstResult.cgst);
      sgst = sgst.plus(gstResult.sgst);
      igst = igst.plus(gstResult.igst);
    }
    cgst = cgst.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    sgst = sgst.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    igst = igst.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    let runningTaxable = taxable;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const hd of (watchedHeaderDiscounts as any[]) ?? []) {
      const val = new Decimal(String(hd?.value || "0"));
      if (hd?.type === "PERCENT") {
        runningTaxable = runningTaxable.minus(runningTaxable.times(val.dividedBy(100)));
      } else {
        runningTaxable = runningTaxable.minus(val);
      }
    }
    runningTaxable = runningTaxable.gt(0) ? runningTaxable.toDecimalPlaces(2, Decimal.ROUND_HALF_UP) : new Decimal(0);

    const freightAmt = new Decimal(String(watchedFreightAmount || "0")).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const freightGstRate = new Decimal(String(watchedFreightGstRate ?? 18));
    const fgst = freightAmt.gt(0) ? calculateGST({ taxableValue: freightAmt, gstRate: freightGstRate, companyStateCode, partyStateCode }) : { cgst: new Decimal(0), sgst: new Decimal(0), igst: new Decimal(0) };
    const freightGstAmt = fgst.cgst.plus(fgst.sgst).plus(fgst.igst).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const subTotal = runningTaxable.plus(cgst).plus(sgst).plus(igst).plus(freightAmt).plus(freightGstAmt);
    const tcsAmt = subTotal.times(new Decimal(String(watchedTcsRate || "0")).dividedBy(100)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const preRound = subTotal.plus(tcsAmt);
    const roundOff = watchedRoundOffMode === "MANUAL" ? new Decimal(String(watchedRoundOffManual || "0")) : preRound.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).minus(preRound);
    const grand = preRound.plus(roundOff);

    const headerDiscountTotal = taxable.minus(runningTaxable);

    return {
      taxableRaw: taxable,
      headerDiscountTotal,
      taxableAfterDiscounts: runningTaxable,
      cgst,
      sgst,
      igst,
      freightAmt,
      freightGstAmt,
      tcsAmt,
      roundOff,
      grand,
      taxType: (cgst.gt(0) ? "INTRA_STATE" : igst.gt(0) ? "INTER_STATE" : "EXEMPT") as GSTTaxType
    };
  }, [watchedItems, watchedHeaderDiscounts, watchedFreightAmount, watchedFreightGstRate, watchedTcsRate, watchedRoundOffMode, watchedRoundOffManual, companyStateCode, partyStateCode]);

  const _accountingEntries = useMemo(() => buildPurchaseEntries(selectedParty?.name ?? "", totals.taxableAfterDiscounts, totals.cgst, totals.sgst, totals.igst, totals.freightAmt, totals.freightGstAmt, totals.tcsAmt, totals.roundOff, totals.grand), [selectedParty, totals]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: (data: PurchaseInvoiceInput) => updateVoucherAPI(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["voucher", id] });
      toast.success(`Purchase bill ${data.voucherNo} updated`);
      router.push(`/purchase-invoice/${data.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onPost = (data: PurchaseInvoiceInput) => updateMutation.mutate(data);

  if (isVoucherLoading) return <div className="p-10 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-600" /></div>;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 max-w-7xl mx-auto">
      <PageHeader
        title={`Edit ${voucher?.voucherNo}`}
        subtitle="Correct mistakes in your purchase invoice"
        action={<Button variant="outline" onClick={() => router.push(`/purchase-invoice/${id}`)}>Cancel</Button>}
      />

      {isLocked && (
        <Alert variant="destructive" className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Voucher Locked</AlertTitle>
          <AlertDescription>
            This purchase invoice is older than 15 days and cannot be edited. Please contact an administrator for assistance.
          </AlertDescription>
        </Alert>
      )}

      <div className={cn(isLocked && "opacity-60 pointer-events-none")}>
        <form onSubmit={handleSubmit(onPost)} className="space-y-6">
          <SectionCard title="Invoice Details">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="space-y-2">
                <Label>Party <span className="text-red-500">*</span></Label>
                <select {...register("partyLedgerId")} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white">
                  <option value="">Select supplier...</option>
                  {parties.filter(p => p.partyType === "Supplier").map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Date <span className="text-red-500">*</span></Label>
                <Input type="date" {...register("date")} />
              </div>
              <div className="space-y-2">
                <Label>Supplier Invoice No</Label>
                <Input {...register("supplierInvoiceNo")} />
              </div>
            </div>
          </SectionCard>

          <LineItemsTable
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            control={control as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setValue={setValue as any}
            voucherType="PURCHASE"
            companyStateCode={companyStateCode}
            partyStateCode={partyStateCode}
            stockItems={stockItems}
            godowns={godowns}
            uoms={uoms}
            defaultGodownId={defaultGodownId}
            onRequestCreate={(name, index) => { setPendingItemName(name); setPendingItemIndex(index); setShowItemDialog(true); }}
          />

          <PurchaseSummaryPanel
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            control={control as any}
            taxableRaw={totals.taxableRaw.toFixed(2)}
            headerDiscountTotal={totals.headerDiscountTotal.toFixed(2)}
            taxableAfterDiscounts={totals.taxableAfterDiscounts.toFixed(2)}
            cgstTotal={totals.cgst.toString()}
            sgstTotal={totals.sgst.toString()}
            igstTotal={totals.igst.toString()}
            freightGstAmt={totals.freightGstAmt.toFixed(2)}
            tcsAmt={totals.tcsAmt.toFixed(2)}
            roundOff={totals.roundOff.toFixed(2)}
            grandTotal={totals.grand.toFixed(2)}
            taxType={totals.taxType}
            uiMode={uiMode}
            roundOffMode={watchedRoundOffMode}
          />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => router.push(`/purchase-invoice/${id}`)}>Cancel</Button>
            <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white" disabled={updateMutation.isPending || isLocked}>
              {updateMutation.isPending ? "Updating..." : "Update Invoice"}
            </Button>
          </div>
        </form>
      </div>

      <QuickSupplierDialog open={showSupplierDialog} onClose={() => setShowSupplierDialog(false)} onCreated={(p) => { refetchParties(); setValue("partyLedgerId", p.id); }} />
      <QuickStockItemDialog open={showItemDialog} onClose={() => setShowItemDialog(false)} uoms={uoms} onCreated={(item) => {
        if (pendingItemIndex !== null) {
          setValue(`items.${pendingItemIndex}.itemId`, item.id);
          setValue(`items.${pendingItemIndex}.rate`, item.openingRate);
          setValue(`items.${pendingItemIndex}.unit`, typeof item.uom === 'string' ? item.uom : (item.uom as { symbol: string })?.symbol);
        }
        queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      }} initialName={pendingItemName} />
    </div>
  );
}
