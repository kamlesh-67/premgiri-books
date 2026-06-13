"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Decimal } from "decimal.js";
import { Loader2, Plus } from "lucide-react";

import { salesInvoiceSchema, type SalesInvoiceInput } from "@/lib/schemas/vouchers";
import { calculateGST } from "@/lib/services/GSTCalculator";
import { useUiStore } from "@/lib/stores/uiStore";
import { LineItemsTable, type StockItemOption, type GodownOption } from "@/components/voucher/LineItemsTable";
import { GSTSummaryPanel } from "@/components/voucher/GSTSummaryPanel";
import { AccountingEntriesPanel, type AccountingEntryRow } from "@/components/voucher/AccountingEntriesPanel";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export interface InvoiceFormProps {
  voucherType: "SALES" | "PURCHASE" | "CREDIT_NOTE" | "DEBIT_NOTE";
  onSuccess: (id: string) => void;
  defaultValues?: Partial<SalesInvoiceInput>;
  linkedVoucherId?: string;
}

// ---------------------------------------------------------------------------
// Quick Customer Create Dialog
// ---------------------------------------------------------------------------

interface QuickCustomerDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (party: PartyOption) => void;
}

function QuickCustomerDialog({ open, onClose, onCreated }: QuickCustomerDialogProps) {
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
        body: JSON.stringify({ partyType: "customer", name: name.trim(), gstin: gstin.trim() || undefined, phone: phone.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.issues?.[0]?.message ?? err?.error ?? "Failed to create customer");
        return;
      }
      const ledger = await res.json();
      toast.success(`Customer "${ledger.name}" created`);
      onCreated({ id: ledger.id, name: ledger.name, partyType: "Customer" });
      setName(""); setGstin(""); setPhone("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setName(""); setGstin(""); setPhone(""); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Customer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Name <span className="text-red-500">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" />
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
          <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Create Customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Accounting entries helper
// ---------------------------------------------------------------------------

function buildAccountingEntries(
  partyName: string,
  taxableTotal: Decimal,
  cgstTotal: Decimal,
  sgstTotal: Decimal,
  igstTotal: Decimal,
  grandTotal: Decimal
): AccountingEntryRow[] {
  const entries: AccountingEntryRow[] = [];
  if (grandTotal.gt(0)) entries.push({ ledgerId: "party", ledgerName: partyName || "Customer", drCr: "DR", amount: grandTotal.toFixed(2) });
  if (taxableTotal.gt(0)) entries.push({ ledgerId: "sales", ledgerName: "Sales Income", drCr: "CR", amount: taxableTotal.toFixed(2) });
  if (cgstTotal.gt(0)) entries.push({ ledgerId: "cgst", ledgerName: "CGST Payable", drCr: "CR", amount: cgstTotal.toFixed(2) });
  if (sgstTotal.gt(0)) entries.push({ ledgerId: "sgst", ledgerName: "SGST Payable", drCr: "CR", amount: sgstTotal.toFixed(2) });
  if (igstTotal.gt(0)) entries.push({ ledgerId: "igst", ledgerName: "IGST Payable", drCr: "CR", amount: igstTotal.toFixed(2) });
  return entries;
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

async function postVoucherAPI(data: SalesInvoiceInput): Promise<{ id: string; voucherNo: string }> {
  const res = await fetch("/api/v1/vouchers", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Failed to save invoice");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// InvoiceForm
// ---------------------------------------------------------------------------

export default function InvoiceForm({ voucherType: _voucherType, onSuccess, defaultValues, linkedVoucherId: _linkedVoucherId }: InvoiceFormProps) {
  const queryClient = useQueryClient();
  const { uiMode } = useUiStore();

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [defaultGodownId, setDefaultGodownId] = useState("");

  const form = useForm<SalesInvoiceInput>({
    resolver: zodResolver(salesInvoiceSchema),
    defaultValues: {
      voucherType: "SALES",
      status: "POSTED",
      date: new Date().toISOString().split("T")[0],
      narration: "",
      items: [{ itemId: "", qty: "1", rate: "0", discountPct: "0", itcEligible: true }],
      ...defaultValues,
    },
  });

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = form;

  const { data: sessionData } = useQuery<CompanySession>({
    queryKey: ["session"],
    queryFn: () => fetch("/api/auth/session").then((r) => r.json()),
  });
  const companyStateCode = sessionData?.user?.stateCode ?? "";

  const { data: parties = [], refetch: refetchParties } = useQuery<PartyOption[]>({
    queryKey: ["parties"],
    queryFn: () => fetch("/api/v1/masters/ledgers?type=party").then((r) => {
      if (!r.ok) throw new Error("Failed to load parties");
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

  const { data: costCentres = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["cost-centres"],
    queryFn: async () => {
      const res = await fetch("/api/v1/masters/cost-centres");
      if (!res.ok) throw new Error("Failed to load cost centres");
      return res.json();
    },
    enabled: uiMode === "advanced",
  });

  const watchedPartyId = watch("partyLedgerId");
  const watchedItems = useWatch({ control, name: "items" });

  // Find the walk-in ledger from the parties list
  const walkInLedger = parties.find((p) => p.name === "Walk-in Customer");
  const selectedParty = isWalkIn
    ? walkInLedger
    : parties.find((p) => p.id === watchedPartyId);
  const partyStateCode = selectedParty?.stateCode ?? "";

  const totals = useMemo(() => {
    let taxable = new Decimal(0);
    let cgst = new Decimal(0);
    let sgst = new Decimal(0);
    let igst = new Decimal(0);
    for (const item of watchedItems ?? []) {
      const qty = new Decimal(String(item?.qty || "0"));
      const rate = new Decimal(String(item?.rate || "0"));
      const discPct = new Decimal(String(item?.discountPct || "0"));
      const taxableValue = qty.times(rate).times(new Decimal(1).minus(discPct.dividedBy(100)));
      taxable = taxable.plus(taxableValue);
      const gstRate = new Decimal(String((item as Record<string, unknown>)?.gstRateOverride ?? (item as Record<string, unknown>)?._gstRate ?? 0));
      const result = calculateGST({ taxableValue, gstRate, companyStateCode, partyStateCode });
      cgst = cgst.plus(result.cgst);
      sgst = sgst.plus(result.sgst);
      igst = igst.plus(result.igst);
    }
    const grandRaw = taxable.plus(cgst).plus(sgst).plus(igst);
    const grandRounded = grandRaw.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    return {
      taxable, cgst, sgst, igst,
      roundOff: grandRounded.minus(grandRaw),
      grand: grandRounded,
      taxType: cgst.gt(0) ? ("INTRA_STATE" as const) : igst.gt(0) ? ("INTER_STATE" as const) : ("EXEMPT" as const),
    };
  }, [watchedItems, companyStateCode, partyStateCode]);

  const accountingEntries = useMemo(() => buildAccountingEntries(
    selectedParty?.name ?? "", totals.taxable, totals.cgst, totals.sgst, totals.igst, totals.grand
  ), [selectedParty, totals]);

  const drTotal = accountingEntries.filter((e) => e.drCr === "DR").reduce((s, e) => s.plus(e.amount), new Decimal(0));
  const crTotal = accountingEntries.filter((e) => e.drCr === "CR").reduce((s, e) => s.plus(e.amount), new Decimal(0));
  const isBalanced = drTotal.equals(crTotal) && accountingEntries.length > 0;

  const draftMutation = useMutation({
    mutationFn: (data: SalesInvoiceInput) => postVoucherAPI({ ...data, status: "DRAFT" }),
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ["vouchers"] }); toast.success(`Draft ${data.voucherNo} saved`); onSuccess(data.id); },
    onError: (err: Error) => toast.error(err.message),
  });

  const postMutation = useMutation({
    mutationFn: (data: SalesInvoiceInput) => postVoucherAPI({ ...data, status: "POSTED" }),
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ["vouchers"] }); toast.success(`Invoice ${data.voucherNo} posted`); onSuccess(data.id); },
    onError: (err: Error) => toast.error(err.message),
  });

  const isSaving = draftMutation.isPending || postMutation.isPending;

  async function resolveAndSubmit(status: "DRAFT" | "POSTED") {
    // For walk-in: inject the walk-in ledger ID before validation
    if (isWalkIn) {
      if (!walkInLedger) {
        toast.error("Walk-in Customer ledger not found. Please refresh and try again.");
        return;
      }
      setValue("partyLedgerId", walkInLedger.id);
      const currentNarration = watch("narration") ?? "";
      const namePrefix = walkInName.trim() ? `Walk-in: ${walkInName.trim()}. ` : "Walk-in sale. ";
      if (!currentNarration.startsWith("Walk-in:")) {
        setValue("narration", namePrefix + currentNarration);
      }
    }
    handleSubmit((data) => {
      if (status === "DRAFT") draftMutation.mutate(data);
      else postMutation.mutate(data);
    })();
  }

  function handleCustomerCreated(party: PartyOption) {
    queryClient.invalidateQueries({ queryKey: ["parties"] });
    refetchParties().then(() => {
      setValue("partyLedgerId", party.id);
    });
    setShowNewCustomer(false);
  }

  const customers = parties.filter((p) => p.partyType === "Customer");

  return (
    <div className="space-y-6">
      {/* ── Invoice Details ── */}
      <SectionCard title="Invoice Details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Party picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="partyLedgerId" className="text-sm font-medium text-gray-700">
                Customer <span className="text-red-500">*</span>
              </Label>
              <button
                type="button"
                onClick={() => setIsWalkIn((v) => !v)}
                className={`text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${
                  isWalkIn
                    ? "bg-amber-100 text-amber-700"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {isWalkIn ? "Walk-in ✓" : "Walk-in?"}
              </button>
            </div>

            {isWalkIn ? (
              <Input
                placeholder="Customer name (optional)"
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
                className="text-sm"
              />
            ) : (
              <>
                <select
                  id="partyLedgerId"
                  {...register("partyLedgerId")}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                >
                  <option value="">Select customer...</option>
                  {customers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewCustomer(true)}
                  className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium mt-1"
                >
                  <Plus className="h-3 w-3" />
                  New customer
                </button>
              </>
            )}

            {isWalkIn && (
              <p className="text-xs text-amber-600">
                Sale recorded under Walk-in Customer ledger. Name saved in narration.
              </p>
            )}
            {!isWalkIn && errors.partyLedgerId && (
              <p className="text-xs text-red-500">{errors.partyLedgerId.message}</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date" className="text-sm font-medium text-gray-700">
              Date <span className="text-red-500">*</span>
            </Label>
            <Input id="date" type="date" {...register("date")} className="text-sm" />
            {errors.date && <p className="text-xs text-red-500">{errors.date.message}</p>}
          </div>

          {/* Voucher # */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Voucher #</Label>
            <Input type="text" value="" placeholder="Auto-assigned" readOnly disabled className="text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
          </div>

          {/* Default Godown */}
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

        {/* Narration */}
        <div className="mt-4">
          <Label htmlFor="narration" className="text-sm font-medium text-gray-700">Narration</Label>
          <Input id="narration" type="text" placeholder="Optional note" {...register("narration")} className="text-sm mt-1.5" />
        </div>

        {/* Cost Centre — advanced only */}
        {uiMode === "advanced" && (
          <div className="mt-4 max-w-xs space-y-2">
            <Label htmlFor="costCentreId" className="text-sm font-medium text-gray-700">Cost Centre</Label>
            <Select
              value={watch("costCentreId") ?? "__none__"}
              onValueChange={(val) => setValue("costCentreId", val === "__none__" ? undefined : val)}
            >
              <SelectTrigger id="costCentreId" className="w-full text-sm">
                <SelectValue placeholder="Select cost centre (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {costCentres.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </SectionCard>

      {/* ── Line Items ── */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Line Items</h2>
        <LineItemsTable
          control={control as any} // eslint-disable-line @typescript-eslint/no-explicit-any
          setValue={setValue as any} // eslint-disable-line @typescript-eslint/no-explicit-any
          voucherType="SALES"
          companyStateCode={companyStateCode}
          partyStateCode={partyStateCode}
          stockItems={stockItems}
          godowns={godowns}
          defaultGodownId={defaultGodownId}
        />
      </div>

      {/* ── GST Summary ── */}
      <GSTSummaryPanel
        taxableTotal={totals.taxable.toFixed(2)}
        cgstTotal={totals.cgst.toFixed(2)}
        sgstTotal={totals.sgst.toFixed(2)}
        igstTotal={totals.igst.toFixed(2)}
        roundOff={totals.roundOff.toFixed(2)}
        grandTotal={totals.grand.toFixed(2)}
        taxType={totals.taxType}
        uiMode={uiMode}
      />

      {/* ── Accounting Entries ── */}
      <AccountingEntriesPanel entries={accountingEntries} isBalanced={isBalanced} />

      {/* ── Action buttons ── */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => resolveAndSubmit("DRAFT")} disabled={isSaving}>
          {draftMutation.isPending ? "Saving..." : "Save Draft"}
        </Button>
        <Button
          type="button"
          className="bg-purple-600 hover:bg-purple-700 text-white"
          onClick={() => resolveAndSubmit("POSTED")}
          disabled={isSaving}
        >
          {postMutation.isPending ? "Posting..." : "Post Invoice"}
        </Button>
      </div>

      {/* Dialogs */}
      <QuickCustomerDialog
        open={showNewCustomer}
        onClose={() => setShowNewCustomer(false)}
        onCreated={handleCustomerCreated}
      />
    </div>
  );
}
