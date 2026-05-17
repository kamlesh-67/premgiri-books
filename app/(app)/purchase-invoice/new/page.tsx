"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Decimal } from "decimal.js";

import { useUiStore } from "@/lib/stores/uiStore";
import { purchaseInvoiceSchema, type PurchaseInvoiceInput } from "@/lib/schemas/vouchers";
import { calculateGST, type GSTTaxType } from "@/lib/services/GSTCalculator";
import { LineItemsTable, type StockItemOption, type GodownOption } from "@/components/voucher/LineItemsTable";
import { GSTSummaryPanel } from "@/components/voucher/GSTSummaryPanel";
import { AccountingEntriesPanel, type AccountingEntryRow } from "@/components/voucher/AccountingEntriesPanel";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  user?: {
    companyId?: string;
    stateCode?: string;
    name?: string;
  };
}

interface UomOption {
  id: string;
  name: string;
  symbol: string;
}

// ---------------------------------------------------------------------------
// Helper — build accounting entries
// ---------------------------------------------------------------------------

function buildPurchaseEntries(
  partyName: string,
  taxableTotal: Decimal,
  cgstTotal: Decimal,
  sgstTotal: Decimal,
  igstTotal: Decimal,
): AccountingEntryRow[] {
  // Round each component first, then derive CR from those rounded values.
  // This guarantees sum(DR) === CR regardless of sub-paisa fractions.
  const taxR = taxableTotal.toDecimalPlaces(2);
  const cgstR = cgstTotal.toDecimalPlaces(2);
  const sgstR = sgstTotal.toDecimalPlaces(2);
  const igstR = igstTotal.toDecimalPlaces(2);
  const grandTotal = taxR.plus(cgstR).plus(sgstR).plus(igstR);
  const entries: AccountingEntryRow[] = [];
  if (taxR.gt(0)) entries.push({ ledgerId: "purchase", ledgerName: "Purchase Account", drCr: "DR", amount: taxR.toFixed(2) });
  if (cgstR.gt(0)) entries.push({ ledgerId: "cgst-input", ledgerName: "CGST Input Tax", drCr: "DR", amount: cgstR.toFixed(2) });
  if (sgstR.gt(0)) entries.push({ ledgerId: "sgst-input", ledgerName: "SGST Input Tax", drCr: "DR", amount: sgstR.toFixed(2) });
  if (igstR.gt(0)) entries.push({ ledgerId: "igst-input", ledgerName: "IGST Input Tax", drCr: "DR", amount: igstR.toFixed(2) });
  if (grandTotal.gt(0)) entries.push({ ledgerId: "party", ledgerName: partyName || "Supplier", drCr: "CR", amount: grandTotal.toFixed(2) });
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
      try {
        err = JSON.parse(text);
      } catch {
        message = `Server error (${res.status}): ${text.substring(0, 200)}`;
        throw new Error(message);
      }

      if (err.error) {
        message = String(err.error);
      }
      if (err.issues && Array.isArray(err.issues)) {
        const firstIssue = (err.issues[0] as Record<string, unknown>)?.message;
        if (firstIssue) {
          message = `Validation error: ${firstIssue}`;
        }
      }

      throw new Error(message);
    }

    const text = await res.text();
    const json = JSON.parse(text);
    return json as Promise<{ id: string; voucherNo: string }>;
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error(message);
  }
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function PurchaseInvoiceNewPage() {
  const router = useRouter();
  const { uiMode } = useUiStore();
  const isSimple = uiMode === "simple";
  const queryClient = useQueryClient();

  // Default godown for new rows
  const [defaultGodownId, setDefaultGodownId] = useState("");

  // ── Form ────────────────────────────────────────────────────────────────
  const form = useForm<PurchaseInvoiceInput>({
    resolver: zodResolver(purchaseInvoiceSchema),
    defaultValues: {
      voucherType: "PURCHASE",
      status: "POSTED",
      date: new Date().toISOString().split("T")[0],
      narration: "",
      items: [{ itemId: "", qty: "1", rate: "0", discountPct: "0", itcEligible: true }],
    },
  });

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = form;

  // ── Session ──────────────────────────────────────────────────────────────
  const { data: sessionData } = useQuery<CompanySession>({
    queryKey: ["session"],
    queryFn: () => fetch("/api/auth/session").then((r) => r.json()),
  });
  const companyStateCode = sessionData?.user?.stateCode ?? "";

  // ── Fetch parties (suppliers) ────────────────────────────────────────────
  const { data: parties = [] } = useQuery<PartyOption[]>({
    queryKey: ["parties"],
    queryFn: () => fetch("/api/v1/masters/ledgers?type=party").then((r) => {
      if (!r.ok) throw new Error("Failed to load suppliers");
      return r.json();
    }),
  });

  // ── Fetch stock items ────────────────────────────────────────────────────
  const { data: stockItems = [] } = useQuery<StockItemOption[]>({
    queryKey: ["stock-items"],
    queryFn: () => fetch("/api/v1/masters/stock-items").then((r) => {
      if (!r.ok) throw new Error("Failed to load products");
      return r.json();
    }),
  });

  // ── Fetch godowns ────────────────────────────────────────────────────────
  const { data: godowns = [] } = useQuery<GodownOption[]>({
    queryKey: ["godowns"],
    queryFn: () => fetch("/api/v1/masters/godowns").then((r) => {
      if (!r.ok) return [];
      return r.json();
    }),
  });

  // ── Fetch UoMs (for quick item creation) ────────────────────────────────
  const { data: uoms = [] } = useQuery<UomOption[]>({
    queryKey: ["uoms"],
    queryFn: () => fetch("/api/v1/masters/uom").then((r) => r.json()),
  });

  // ── Watched values ───────────────────────────────────────────────────────
  const watchedPartyId = watch("partyLedgerId");
  const watchedItems = useWatch({ control, name: "items" });
  const selectedParty = parties.find((p) => p.id === watchedPartyId);
  const partyStateCode = selectedParty?.stateCode ?? "";

  // ── GST totals ───────────────────────────────────────────────────────────
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
      taxType: (cgst.gt(0) ? "INTRA_STATE" : igst.gt(0) ? "INTER_STATE" : "EXEMPT") as GSTTaxType,
    };
  }, [watchedItems, companyStateCode, partyStateCode]);

  // ── Accounting entries ───────────────────────────────────────────────────
  const accountingEntries = useMemo(() => buildPurchaseEntries(
    selectedParty?.name ?? "", totals.taxable, totals.cgst, totals.sgst, totals.igst
  ), [selectedParty, totals]);

  const drTotal = accountingEntries.filter((e) => e.drCr === "DR").reduce((s, e) => s.plus(e.amount), new Decimal(0));
  const crTotal = accountingEntries.filter((e) => e.drCr === "CR").reduce((s, e) => s.plus(e.amount), new Decimal(0));
  const isBalanced = drTotal.equals(crTotal) && accountingEntries.length > 0;

  // ── Mutations ─────────────────────────────────────────────────────────────
  const draftMutation = useMutation({
    mutationFn: (data: PurchaseInvoiceInput) => postVoucherAPI({ ...data, status: "DRAFT" }),
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ["vouchers"] }); toast.success(`Draft ${data.voucherNo} saved`); router.push(`/purchase-invoice/${data.id}`); },
    onError: (err: Error) => toast.error(err.message),
  });

  const postMutation = useMutation({
    mutationFn: (data: PurchaseInvoiceInput) => postVoucherAPI({ ...data, status: "POSTED" }),
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ["vouchers"] }); toast.success(`Purchase bill ${data.voucherNo} posted`); router.push(`/purchase-invoice/${data.id}`); },
    onError: (err: Error) => toast.error(err.message),
  });

  const isSaving = draftMutation.isPending || postMutation.isPending;

  // Surfaces hidden Zod validation errors as toasts so the user knows what's wrong
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onFormError(errors: Record<string, any>) {
    const findFirst = (obj: Record<string, unknown>): string | null => {
      for (const key of Object.keys(obj)) {
        const val = obj[key] as Record<string, unknown>;
        if (val?.message) return val.message as string;
        if (typeof val === 'object' && val !== null) {
          const nested = findFirst(val as Record<string, unknown>);
          if (nested) return nested;
        }
      }
      return null;
    };
    const msg = findFirst(errors);
    toast.error(msg ?? 'Please fill all required fields before submitting.');
  }

  // ── New item name handler — stores typed name in form, no dialog ─────────
  function handleRequestCreate(name: string, rowIndex: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (setValue as any)(`items.${rowIndex}._newItemName`, name);
    setValue(`items.${rowIndex}.itemId`, "");
  }

  // ── Auto-create pending items before voucher submission ───────────────────
  async function createPendingItems(): Promise<boolean> {
    const defaultUomId = uoms[0]?.id;
    if (!defaultUomId) {
      toast.error("No unit of measure found. Add a UoM in Masters first.");
      return false;
    }
    const rawItems = form.getValues("items") as Array<Record<string, unknown>>;
    for (let i = 0; i < rawItems.length; i++) {
      const newName = (rawItems[i]._newItemName as string | undefined)?.trim();
      if (!newName || rawItems[i].itemId) continue;
      try {
        const res = await fetch("/api/v1/masters/stock-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newName,
            gstRate: Number(rawItems[i]._gstRate ?? 0),
            uomId: defaultUomId,
            hsnCode: String(rawItems[i].hsnCode ?? ""),
            openingRate: String(rawItems[i].rate ?? "0"),
            openingQty: "0",
            reorderQty: "0",
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(`Failed to create "${newName}": ${err?.error ?? "Unknown error"}`);
          return false;
        }
        const created = await res.json();
        setValue(`items.${i}.itemId`, created.id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (setValue as any)(`items.${i}._newItemName`, "");
        queryClient.setQueryData<StockItemOption[]>(["stock-items"], (old = []) => [
          ...old,
          { id: created.id, name: created.name, gstRate: parseFloat(created.gstRate), openingRate: created.openingRate, hsnCode: created.hsnCode ?? "" },
        ]);
        queryClient.invalidateQueries({ queryKey: ["stock-items"] });
        toast.success(`Item "${created.name}" created`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Failed to create "${newName}"`);
        return false;
      }
    }
    return true;
  }

  async function onSaveDraft() {
    const ok = await createPendingItems();
    if (!ok) return;
    handleSubmit((data) => draftMutation.mutate(data), onFormError)();
  }

  async function onPost() {
    const ok = await createPendingItems();
    if (!ok) return;
    handleSubmit((data) => postMutation.mutate(data), onFormError)();
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title={isSimple ? "Buy from Supplier" : "Purchase Invoice"}
        subtitle={isSimple ? "Record a bill from a supplier" : "Record an inward GST purchase"}
        action={
          <Button variant="outline" onClick={() => router.push("/purchase-invoice")}>
            Cancel
          </Button>
        }
      />

      {/* ── Invoice Details ── */}
      <SectionCard title={isSimple ? "Supplier Details" : "Invoice Details"}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {/* Party picker */}
          <div className="space-y-2">
            <Label htmlFor="partyLedgerId" className="text-sm font-medium text-gray-700">
              {isSimple ? "Supplier" : "Party"} <span className="text-red-500">*</span>
            </Label>
            <select
              id="partyLedgerId"
              {...register("partyLedgerId")}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
            >
              <option value="">Select supplier...</option>
              {parties
                .filter((p) => p.partyType === "Supplier")
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>
            {errors.partyLedgerId && (
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

          {/* Supplier Invoice No */}
          <div className="space-y-2">
            <Label htmlFor="supplierInvoiceNo" className="text-sm font-medium text-gray-700">
              Supplier Invoice No
            </Label>
            <Input
              id="supplierInvoiceNo"
              type="text"
              placeholder="e.g. INV-2025-001"
              {...register("supplierInvoiceNo")}
              className="text-sm"
            />
            {errors.supplierInvoiceNo && (
              <p className="text-xs text-red-500">{errors.supplierInvoiceNo.message}</p>
            )}
          </div>

          {/* Supplier Invoice Date */}
          <div className="space-y-2">
            <Label htmlFor="supplierInvoiceDate" className="text-sm font-medium text-gray-700">
              Supplier Invoice Date
            </Label>
            <Input
              id="supplierInvoiceDate"
              type="date"
              {...register("supplierInvoiceDate")}
              className="text-sm"
            />
            {errors.supplierInvoiceDate && (
              <p className="text-xs text-red-500">{errors.supplierInvoiceDate.message}</p>
            )}
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

        {/* Narration — advanced mode, second row */}
        {!isSimple && (
          <div className="mt-4">
            <Label htmlFor="narration" className="text-sm font-medium text-gray-700">Narration</Label>
            <Input id="narration" type="text" placeholder="Optional note" {...register("narration")} className="text-sm mt-1.5" />
          </div>
        )}
      </SectionCard>

      {/* Hidden fields for form submission */}
      <input type="hidden" {...register("voucherType")} />

      {/* ── Line Items ── */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          {isSimple ? "Items Purchased" : "Line Items"}
        </h2>
        <LineItemsTable
          control={control as any} // eslint-disable-line @typescript-eslint/no-explicit-any
          setValue={setValue as any} // eslint-disable-line @typescript-eslint/no-explicit-any
          voucherType="PURCHASE"
          companyStateCode={companyStateCode}
          partyStateCode={partyStateCode}
          stockItems={stockItems}
          godowns={godowns}
          defaultGodownId={defaultGodownId}
          onRequestCreate={handleRequestCreate}
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

      {/* ── Accounting Entries — advanced only ── */}
      {!isSimple && (
        <AccountingEntriesPanel entries={accountingEntries} isBalanced={isBalanced} />
      )}

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

    </div>
  );
}
