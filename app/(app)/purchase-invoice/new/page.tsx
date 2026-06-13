"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Decimal } from "decimal.js";
import {
  ChevronDown,
  Loader2,
  UserPlus,
  Truck,
  Package,
  FileText,
  Receipt,
} from "lucide-react";

import { useUiStore } from "@/lib/stores/uiStore";
import { purchaseInvoiceSchema, type PurchaseInvoiceInput } from "@/lib/schemas/vouchers";
import { calculateGST, type GSTTaxType } from "@/lib/services/GSTCalculator";
import { LineItemsTable, type StockItemOption, type GodownOption } from "@/components/voucher/LineItemsTable";
import { PurchaseSummaryPanel } from "@/components/voucher/PurchaseSummaryPanel";
import { AccountingEntriesPanel, type AccountingEntryRow } from "@/components/voucher/AccountingEntriesPanel";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
// Quick Supplier Create Dialog — CR-019
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
// Build accounting entries (all purchase legs)
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

async function postVoucherAPI(data: PurchaseInvoiceInput): Promise<{ id: string; voucherNo: string }> {
  const res = await fetch("/api/v1/vouchers", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });

  let message = "Failed to save purchase invoice";
  try {
    if (!res.ok) {
      const text = await res.text();
      let err: Record<string, unknown> = {};
      try { err = JSON.parse(text); } catch { message = `Server error (${res.status}): ${text.substring(0, 200)}`; throw new Error(message); }
      if (err.error) message = String(err.error);
      if (err.issues && Array.isArray(err.issues)) {
        const first = (err.issues[0] as Record<string, unknown>)?.message;
        if (first) message = `Validation: ${first}`;
      }
      throw new Error(message);
    }
    return JSON.parse(await res.text()) as { id: string; voucherNo: string };
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error(message);
  }
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

  // Set default UOM when uoms load
  useState(() => {
    if (uoms.length > 0 && !uomId) setUomId(uoms[0].id);
  });

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

export default function PurchaseInvoiceNewPage() {
  const router = useRouter();
  const { uiMode } = useUiStore();
  const isSimple = uiMode === "simple";
  const queryClient = useQueryClient();

  const [defaultGodownId, setDefaultGodownId] = useState("");
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [pendingItemIndex, setPendingItemIndex] = useState<number | null>(null);
  const [pendingItemName, setPendingItemName] = useState("");

  // ── Form ────────────────────────────────────────────────────────────────
  const form = useForm<PurchaseInvoiceInput>({
    resolver: zodResolver(purchaseInvoiceSchema),
    defaultValues: {
      voucherType: "PURCHASE",
      status: "POSTED",
      date: new Date().toISOString().split("T")[0],
      narration: "",
      invoiceType: "TAX_INVOICE",
      taxMode: "AUTO",
      roundOffMode: "AUTO",
      roundOffManual: "0",
      freightAmount: "0",
      freightGstRate: 18,
      tcsRate: "0",
      headerDiscounts: [],
      items: [{
        itemId: "", qty: "1", rate: "0",
        discountType: "PERCENT", discountPct: "0", discountAmt: "0",
        unit: "", itcEligible: true,
      }],
    },
  });

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = form;

  // ── Session ──────────────────────────────────────────────────────────────
  const { data: sessionData } = useQuery<CompanySession>({
    queryKey: ["session"],
    queryFn: () => fetch("/api/auth/session").then((r) => r.json()),
  });
  const companyStateCode = sessionData?.user?.stateCode ?? "";

  // ── Data fetches ─────────────────────────────────────────────────────────
  const { data: parties = [], refetch: refetchParties } = useQuery<PartyOption[]>({
    queryKey: ["parties"],
    queryFn: () => fetch("/api/v1/masters/ledgers?type=party").then((r) => {
      if (!r.ok) throw new Error("Failed to load suppliers");
      return r.json();
    }),
  });

  const { data: stockItems = [] } = useQuery<StockItemOption[]>({
    queryKey: ["stock-items"],
    queryFn: () => fetch("/api/v1/masters/stock-items").then((r) => {
      if (!r.ok) throw new Error("Failed to load products");
      return r.json();
    }),
  });

  const { data: godowns = [] } = useQuery<GodownOption[]>({
    queryKey: ["godowns"],
    queryFn: () => fetch("/api/v1/masters/godowns").then((r) => {
      if (!r.ok) return [];
      return r.json();
    }),
  });

  const { data: uoms = [] } = useQuery<UomOption[]>({
    queryKey: ["uoms"],
    queryFn: () => fetch("/api/v1/masters/uom").then((r) => r.json()),
  });

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

  // ── Full totals (line items + all adjustments) ────────────────────────────
  const totals = useMemo(() => {
    // 1. Line item subtotals
    let taxable = new Decimal(0);
    let cgst = new Decimal(0);
    let sgst = new Decimal(0);
    let igst = new Decimal(0);

    for (const item of watchedItems ?? []) {
      const qty = new Decimal(String(item?.qty || "0"));
      const rate = new Decimal(String(item?.rate || "0"));
      const discType = (item as Record<string, unknown>)?.discountType as string | undefined ?? "PERCENT";
      let taxableValue: Decimal;
      if (discType === "NONE") {
        taxableValue = qty.times(rate);
      } else if (discType === "FLAT_INR") {
        const flatDisc = new Decimal(String((item as Record<string, unknown>)?.discountAmt || "0"));
        const gross = qty.times(rate).minus(flatDisc);
        taxableValue = gross.gt(0) ? gross : new Decimal(0);
      } else {
        const discPct = new Decimal(String(item?.discountPct || "0"));
        taxableValue = qty.times(rate).times(new Decimal(1).minus(discPct.dividedBy(100)));
      }
      taxable = taxable.plus(taxableValue);
      const gstRate = new Decimal(String(
        (item as Record<string, unknown>)?.gstRateOverride ?? (item as Record<string, unknown>)?._gstRate ?? 0
      ));
      const gstResult = calculateGST({ taxableValue, gstRate, companyStateCode, partyStateCode });
      cgst = cgst.plus(gstResult.cgst);
      sgst = sgst.plus(gstResult.sgst);
      igst = igst.plus(gstResult.igst);
    }

    // --- FIX: Round ledger-level totals to 2 decimal places to ensure accounting balance ---
    cgst = cgst.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    sgst = sgst.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    igst = igst.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // 2. Header discounts (CR-004) — reduce goods cost, GST base unchanged
    let headerDiscountTotal = new Decimal(0);
    let runningTaxable = taxable;
    for (const hd of (watchedHeaderDiscounts as Array<Record<string, unknown>>) ?? []) {
      const val = new Decimal(String(hd?.value || "0"));
      if (hd?.type === "PERCENT") {
        const discAmt = runningTaxable.times(val.dividedBy(100));
        headerDiscountTotal = headerDiscountTotal.plus(discAmt);
        runningTaxable = runningTaxable.minus(discAmt);
      } else {
        headerDiscountTotal = headerDiscountTotal.plus(val);
        runningTaxable = runningTaxable.minus(val);
      }
    }
    if (runningTaxable.lt(0)) runningTaxable = new Decimal(0);
    runningTaxable = runningTaxable.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // 3. Freight (CR-014)
    const freightAmt = new Decimal(String(watchedFreightAmount || "0")).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const freightGstRate = new Decimal(String(watchedFreightGstRate ?? 18));
    const freightGstResultRaw = freightAmt.gt(0)
      ? calculateGST({ taxableValue: freightAmt, gstRate: freightGstRate, companyStateCode, partyStateCode })
      : { cgst: new Decimal(0), sgst: new Decimal(0), igst: new Decimal(0) };
    
    // Round freight GST buckets
    const freightCgst = freightGstResultRaw.cgst.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const freightSgst = freightGstResultRaw.sgst.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const freightIgst = freightGstResultRaw.igst.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const freightGstAmt = freightCgst.plus(freightSgst).plus(freightIgst);

    // 4. Sub-total before TCS
    const subBeforeTcs = runningTaxable
      .plus(cgst).plus(sgst).plus(igst)
      .plus(freightAmt).plus(freightGstAmt);

    // 5. TCS (CR-015)
    const tcsRate = new Decimal(String(watchedTcsRate || "0"));
    const tcsAmt = subBeforeTcs.times(tcsRate.dividedBy(100)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // 6. Pre-round-off total
    const preRoundOff = subBeforeTcs.plus(tcsAmt);

    // 7. Round-off (CR-016)
    let roundOff: Decimal;
    if (watchedRoundOffMode === "MANUAL") {
      roundOff = new Decimal(String(watchedRoundOffManual || "0"));
    } else {
      const grandRounded = preRoundOff.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
      roundOff = grandRounded.minus(preRoundOff);
    }
    const grand = preRoundOff.plus(roundOff);

    const taxType = (
      cgst.gt(0) || freightCgst.gt(0)
        ? "INTRA_STATE"
        : igst.gt(0) || freightIgst.gt(0)
        ? "INTER_STATE"
        : "EXEMPT"
    ) as GSTTaxType;

    return {
      taxable,
      headerDiscountTotal,
      taxableAfterDiscounts: runningTaxable,
      cgst, sgst, igst,
      freightAmt,
      freightGstAmt,
      freightCgst, freightSgst, freightIgst, // Pass rounded freight components
      tcsAmt,
      roundOff,
      grand,
      taxType,
    };
  }, [watchedItems, watchedHeaderDiscounts, watchedFreightAmount, watchedFreightGstRate,
      watchedTcsRate, watchedRoundOffMode, watchedRoundOffManual, companyStateCode, partyStateCode]);

  // ── Accounting entries ─────────────────────────────────────────────────────
  const accountingEntries = useMemo(() => buildPurchaseEntries(
    selectedParty?.name ?? "",
    totals.taxableAfterDiscounts,
    totals.cgst,
    totals.sgst,
    totals.igst,
    totals.freightAmt,
    totals.freightGstAmt,
    totals.tcsAmt,
    totals.roundOff,
    totals.grand,
  ), [selectedParty, totals]);

  const drTotal = accountingEntries.filter((e) => e.drCr === "DR").reduce((s, e) => s.plus(e.amount), new Decimal(0));
  const crTotal = accountingEntries.filter((e) => e.drCr === "CR").reduce((s, e) => s.plus(e.amount), new Decimal(0));
  const isBalanced = drTotal.equals(crTotal) && accountingEntries.length > 0;

  // ── Mutations ────────────────────────────────────────────────────────────
  const draftMutation = useMutation({
    mutationFn: (data: PurchaseInvoiceInput) => postVoucherAPI({ ...data, status: "DRAFT" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(`Draft ${data.voucherNo} saved`);
      router.push(`/purchase-invoice/${data.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const postMutation = useMutation({
    mutationFn: (data: PurchaseInvoiceInput) => postVoucherAPI({ ...data, status: "POSTED" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(`Purchase bill ${data.voucherNo} posted`);
      router.push(`/purchase-invoice/${data.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isSaving = draftMutation.isPending || postMutation.isPending;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onFormError(errs: Record<string, any>) {
    const findFirst = (obj: Record<string, unknown>): string | null => {
      for (const key of Object.keys(obj)) {
        const val = obj[key] as Record<string, unknown>;
        if (val?.message) return val.message as string;
        if (typeof val === "object" && val !== null) {
          const nested = findFirst(val as Record<string, unknown>);
          if (nested) return nested;
        }
      }
      return null;
    };
    toast.error(findFirst(errs) ?? "Please fill all required fields before submitting.");
  }

  function handleRequestCreate(name: string, rowIndex: number) {
    setPendingItemName(name);
    setPendingItemIndex(rowIndex);
    setShowItemDialog(true);
  }

  function handleItemCreated(item: StockItemOption) {
    if (pendingItemIndex !== null) {
      setValue(`items.${pendingItemIndex}.itemId`, item.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (setValue as any)(`items.${pendingItemIndex}._gstRate`, item.gstRate);
      setValue(`items.${pendingItemIndex}.rate`, item.openingRate);
      setValue(`items.${pendingItemIndex}.hsnCode`, item.hsnCode ?? "");
      
      let uomSymbol = "";
      if (typeof item.uom === "string") uomSymbol = item.uom;
      else if (item.uom && typeof item.uom === "object" && "symbol" in item.uom) {
        uomSymbol = (item.uom as { symbol: string }).symbol;
      }
      setValue(`items.${pendingItemIndex}.unit`, uomSymbol);
    }
    queryClient.setQueryData<StockItemOption[]>(["stock-items"], (old = []) => [
      ...old,
      item,
    ]);
    queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    setPendingItemIndex(null);
    setPendingItemName("");
  }

  async function onSaveDraft() {
    handleSubmit((data) => draftMutation.mutate(data), onFormError)();
  }

  async function onPost() {
    handleSubmit((data) => postMutation.mutate(data), onFormError)();
  }

  // ── Supplier quick-create callback ────────────────────────────────────────
  function handleSupplierCreated(party: PartyOption) {
    refetchParties();
    setValue("partyLedgerId", party.id);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const suppliers = parties.filter((p) => p.partyType === "Supplier");

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 max-w-7xl mx-auto">

      <input type="hidden" {...register("voucherType")} />

      {/* ── Page header ── */}
      <PageHeader
        title={isSimple ? "Buy from Supplier" : "Purchase Invoice"}
        subtitle={isSimple ? "Record a bill from a supplier" : "Record an inward GST purchase"}
        action={
          <Button variant="outline" onClick={() => router.push("/purchase-invoice")}>
            Cancel
          </Button>
        }
      />

      {/* ── Section 1: Invoice Details ── */}
      <SectionCard title={isSimple ? "Supplier Details" : "Invoice Details"}>
        {/* Row 1: core fields */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">

          {/* Supplier / party picker + quick-create — xl:col-span-2 gives the flex row enough width */}
          <div className="space-y-2 xl:col-span-2">
            <Label className="text-sm font-medium text-gray-700">
              {isSimple ? "Supplier" : "Party"} <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-1.5">
              <select
                {...register("partyLedgerId")}
                className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
              >
                <option value="">Select supplier...</option>
                {suppliers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="px-2 shrink-0 text-gray-500 hover:text-purple-600 border-gray-200"
                onClick={() => setShowSupplierDialog(true)}
                title="New supplier"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
            {errors.partyLedgerId && (
              <p className="text-xs text-red-500">{errors.partyLedgerId.message}</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Date <span className="text-red-500">*</span>
            </Label>
            <Input id="date" type="date" {...register("date")} className="text-sm" />
            {errors.date && <p className="text-xs text-red-500">{errors.date.message}</p>}
          </div>

          {/* Supplier Invoice No */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Supplier Invoice No</Label>
            <Input type="text" placeholder="e.g. INV-2025-001" {...register("supplierInvoiceNo")} className="text-sm" />
          </div>

          {/* Supplier Invoice Date */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Supplier Invoice Date</Label>
            <Input type="date" {...register("supplierInvoiceDate")} className="text-sm" />
          </div>

          {/* Voucher # (auto) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Voucher #</Label>
            <Input type="text" value="" placeholder="Auto-assigned" readOnly disabled
              className="text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
          </div>

          {/* Godown */}
          {godowns.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Godown</Label>
              <select
                value={defaultGodownId}
                onChange={(e) => setDefaultGodownId(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
              >
                <option value="">All / Default</option>
                {godowns.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Row 2: Advanced fields — CR-001/009/013/017 */}
        {!isSimple && (
          <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">

            {/* CR-001: Invoice type */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Invoice Type</Label>
              <select
                {...register("invoiceType")}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
              >
                <option value="TAX_INVOICE">Tax Invoice</option>
                <option value="BILL_OF_SUPPLY">Bill of Supply</option>
                <option value="RCM_INVOICE">RCM Invoice</option>
                <option value="CREDIT_MEMO">Credit Memo</option>
                <option value="DEBIT_NOTE">Debit Note</option>
              </select>
            </div>

            {/* CR-017: Place of supply */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Place of Supply</Label>
              <Input
                type="text"
                maxLength={3}
                placeholder={partyStateCode || "e.g. 29"}
                {...register("placeOfSupply")}
                className="text-sm"
              />
            </div>

            {/* CR-013: Tax mode */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Tax Mode</Label>
              <select
                {...register("taxMode")}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
              >
                <option value="AUTO">Auto (by state)</option>
                <option value="CGST_SGST_OVERRIDE">Force CGST+SGST</option>
                <option value="IGST_OVERRIDE">Force IGST</option>
              </select>
            </div>

            {/* CR-009: Payment terms */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Payment Terms</Label>
              <select
                {...register("paymentTerms")}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
              >
                <option value="">— None —</option>
                <option value="IMMEDIATE">Immediate</option>
                <option value="NET_7">Net 7</option>
                <option value="NET_15">Net 15</option>
                <option value="NET_30">Net 30</option>
                <option value="NET_45">Net 45</option>
                <option value="NET_60">Net 60</option>
              </select>
            </div>

            {/* CR-009: Due date */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Due Date</Label>
              <Input type="date" {...register("dueDate")} className="text-sm" />
            </div>
          </div>
        )}

        {/* Narration — advanced only */}
        {!isSimple && (
          <div className="mt-4">
            <Label className="text-sm font-medium text-gray-700">Narration</Label>
            <Input type="text" placeholder="Optional note" {...register("narration")} className="text-sm mt-1.5" />
          </div>
        )}
      </SectionCard>

      {/* ── Section 2: Line Items ── */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          {isSimple ? "Items Purchased" : "Line Items"}
        </h2>
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
          onRequestCreate={handleRequestCreate}
        />
      </div>

      {/* ── Section 3: Purchase Summary (replaces GSTSummaryPanel) ── */}
      <PurchaseSummaryPanel
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        control={control as any}
        taxableRaw={totals.taxable.toFixed(2)}
        headerDiscountTotal={totals.headerDiscountTotal.toFixed(2)}
        taxableAfterDiscounts={totals.taxableAfterDiscounts.toFixed(2)}
        cgstTotal={totals.cgst.toString()}
        sgstTotal={totals.sgst.toString()}
        igstTotal={totals.igst.toString()}
        freightGstAmt={totals.freightGstAmt.toString()}
        tcsAmt={totals.tcsAmt.toString()}
        roundOff={totals.roundOff.toFixed(2)}
        grandTotal={totals.grand.toFixed(2)}
        taxType={totals.taxType}
        uiMode={uiMode}
        roundOffMode={watchedRoundOffMode}
      />

      {/* ── Section 4: Accounting Entries — advanced only ── */}
      {!isSimple && (
        <AccountingEntriesPanel entries={accountingEntries} isBalanced={isBalanced} />
      )}

      {/* ── Sections 5–8: Advanced collapsible sections ── */}
      {!isSimple && (
        <>
          {/* CR-006: Transport / Dispatch Details */}
          <CollapsibleSection title="Transport Details" icon={Truck}>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Transporter Name</Label>
                <Input type="text" placeholder="e.g. Blue Dart" {...register("transporterName")} className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">LR / RR No.</Label>
                <Input type="text" placeholder="LR number" {...register("lrNo")} className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Vehicle No.</Label>
                <Input type="text" placeholder="e.g. MH12AB1234" {...register("vehicleNo")} className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Destination</Label>
                <Input type="text" placeholder="Delivery location" {...register("destination")} className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Dispatch Weight (kg)</Label>
                <Input type="number" min="0" step="any" placeholder="0.00" {...register("dispatchWeight")} className="text-sm" />
              </div>
            </div>
          </CollapsibleSection>

          {/* CR-008: Order References */}
          <CollapsibleSection title="Order References" icon={FileText}>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Buyer PO No.</Label>
                <Input type="text" placeholder="PO number" {...register("buyerPoNo")} className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Buyer PO Date</Label>
                <Input type="date" {...register("buyerPoDate")} className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Supplier SO No.</Label>
                <Input type="text" placeholder="Sales order no" {...register("supplierSoNo")} className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Dispatch Doc No.</Label>
                <Input type="text" placeholder="Dispatch doc" {...register("dispatchDocNo")} className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Delivery Note No.</Label>
                <Input type="text" placeholder="Delivery note" {...register("deliveryNoteNo")} className="text-sm" />
              </div>
            </div>
          </CollapsibleSection>

          {/* CR-007: e-Invoice ACK */}
          <CollapsibleSection title="e-Invoice / IRN" icon={Receipt}>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">ACK No.</Label>
                <Input type="text" maxLength={20} placeholder="IRP acknowledgement no" {...register("ackNo")} className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">ACK Date</Label>
                <Input type="date" {...register("ackDate")} className="text-sm" />
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-400">
              IRN and QR code are auto-populated after e-Invoice generation.
            </p>
          </CollapsibleSection>

          {/* CR-020: Package / Dispatch Summary */}
          <CollapsibleSection title="Package / Dispatch" icon={Package}>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Cartons</Label>
                <Input type="number" min="0" step="1" placeholder="0" {...register("packageCartons", { valueAsNumber: true })} className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Drums</Label>
                <Input type="number" min="0" step="1" placeholder="0" {...register("packageDrums", { valueAsNumber: true })} className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Bags</Label>
                <Input type="number" min="0" step="1" placeholder="0" {...register("packageBags", { valueAsNumber: true })} className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Tins</Label>
                <Input type="number" min="0" step="1" placeholder="0" {...register("packageTins", { valueAsNumber: true })} className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Total Weight (kg)</Label>
                <Input type="text" placeholder="0.000" {...register("packageWeight")} className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Volume (m³)</Label>
                <Input type="text" placeholder="0.000" {...register("packageVolume")} className="text-sm" />
              </div>
            </div>
          </CollapsibleSection>
        </>
      )}

      {/* Simple mode ITC note */}
      {isSimple && (
        <p className="text-xs text-gray-400">
          Tax credit on eligible purchases will be automatically tracked for your GST returns.
        </p>
      )}

      {/* ── Action buttons ── */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onSaveDraft} disabled={isSaving}>
          {draftMutation.isPending ? "Saving..." : "Save Draft"}
        </Button>
        <Button
          type="button"
          className="bg-purple-600 hover:bg-purple-700 text-white"
          onClick={onPost}
          disabled={isSaving}
        >
          {postMutation.isPending ? "Posting..." : isSimple ? "Record Purchase" : "Post Invoice"}
        </Button>
      </div>

      {/* ── Quick Supplier Create dialog ── */}
      <QuickSupplierDialog
        open={showSupplierDialog}
        onClose={() => setShowSupplierDialog(false)}
        onCreated={handleSupplierCreated}
      />

      {/* ── Quick Stock Item Create dialog ── */}
      <QuickStockItemDialog
        open={showItemDialog}
        onClose={() => setShowItemDialog(false)}
        onCreated={handleItemCreated}
        initialName={pendingItemName}
        uoms={uoms}
      />

    </div>
  );
}
