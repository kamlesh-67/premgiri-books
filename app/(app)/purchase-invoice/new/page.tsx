"use client";

import { useMemo } from "react";
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
}

interface CompanySession {
  user?: {
    companyId?: string;
    stateCode?: string;
    name?: string;
  };
}

// ---------------------------------------------------------------------------
// Helper — build accounting entries preview from Purchase totals
// For Purchase: DR Purchase Account + GST Input | CR Party Ledger (AP)
// ---------------------------------------------------------------------------

function buildPurchaseEntries(
  partyName: string,
  taxableTotal: Decimal,
  cgstTotal: Decimal,
  sgstTotal: Decimal,
  igstTotal: Decimal,
  grandTotal: Decimal
): AccountingEntryRow[] {
  const entries: AccountingEntryRow[] = [];

  // DR: Purchase Account — taxable value
  if (taxableTotal.gt(0)) {
    entries.push({
      ledgerId: "purchase",
      ledgerName: "Purchase Account",
      drCr: "DR",
      amount: taxableTotal.toFixed(2),
    });
  }

  // DR: CGST Input Tax (ITC)
  if (cgstTotal.gt(0)) {
    entries.push({
      ledgerId: "cgst-input",
      ledgerName: "CGST Input Tax",
      drCr: "DR",
      amount: cgstTotal.toFixed(2),
    });
  }

  // DR: SGST Input Tax (ITC)
  if (sgstTotal.gt(0)) {
    entries.push({
      ledgerId: "sgst-input",
      ledgerName: "SGST Input Tax",
      drCr: "DR",
      amount: sgstTotal.toFixed(2),
    });
  }

  // DR: IGST Input Tax (ITC)
  if (igstTotal.gt(0)) {
    entries.push({
      ledgerId: "igst-input",
      ledgerName: "IGST Input Tax",
      drCr: "DR",
      amount: igstTotal.toFixed(2),
    });
  }

  // CR: Party Ledger (Sundry Creditor / AP) — full grand total
  if (grandTotal.gt(0)) {
    entries.push({
      ledgerId: "party",
      ledgerName: partyName || "Supplier",
      drCr: "CR",
      amount: grandTotal.toFixed(2),
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// API call helper
// ---------------------------------------------------------------------------

async function postVoucherAPI(
  data: PurchaseInvoiceInput
): Promise<{ id: string; voucherNo: string }> {
  const res = await fetch("/api/v1/vouchers", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Failed to save purchase invoice");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Page component — full-page form (not wizard, per D-04)
// ---------------------------------------------------------------------------

export default function PurchaseInvoiceNewPage() {
  const router = useRouter();
  const { uiMode } = useUiStore();
  const isSimple = uiMode === "simple";
  const queryClient = useQueryClient();

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

  // ── Session / company data ───────────────────────────────────────────────
  const { data: sessionData } = useQuery<CompanySession>({
    queryKey: ["session"],
    queryFn: () => fetch("/api/auth/session").then((r) => r.json()),
  });
  const companyStateCode = sessionData?.user?.stateCode ?? "";

  // ── Fetch parties (suppliers) ────────────────────────────────────────────
  const { data: parties = [] } = useQuery<PartyOption[]>({
    queryKey: ["parties"],
    queryFn: () =>
      fetch("/api/v1/masters/ledgers?type=party").then((r) => {
        if (!r.ok) throw new Error("Failed to load suppliers");
        return r.json();
      }),
  });

  // ── Fetch stock items ────────────────────────────────────────────────────
  const { data: stockItems = [] } = useQuery<StockItemOption[]>({
    queryKey: ["stock-items"],
    queryFn: () =>
      fetch("/api/v1/masters/stock-items").then((r) => {
        if (!r.ok) throw new Error("Failed to load products");
        return r.json();
      }),
  });

  // ── Fetch godowns ────────────────────────────────────────────────────────
  const { data: godowns = [] } = useQuery<GodownOption[]>({
    queryKey: ["godowns"],
    queryFn: () =>
      fetch("/api/v1/masters/godowns").then((r) => {
        if (!r.ok) return [];
        return r.json();
      }),
  });

  // ── Watched values ───────────────────────────────────────────────────────
  const watchedPartyId = watch("partyLedgerId");
  const watchedItems = useWatch({ control, name: "items" });
  const selectedParty = parties.find((p) => p.id === watchedPartyId);
  const partyStateCode = selectedParty?.stateCode ?? "";

  // ── Compute GST totals ───────────────────────────────────────────────────
  const totals = useMemo(() => {
    let taxable = new Decimal(0);
    let cgst = new Decimal(0);
    let sgst = new Decimal(0);
    let igst = new Decimal(0);

    for (const item of watchedItems ?? []) {
      const qty = new Decimal(String(item?.qty || "0"));
      const rate = new Decimal(String(item?.rate || "0"));
      const discPct = new Decimal(String(item?.discountPct || "0"));
      const taxableValue = qty
        .times(rate)
        .times(new Decimal(1).minus(discPct.dividedBy(100)));
      taxable = taxable.plus(taxableValue);

      const gstRate = new Decimal(
        String(
          (item as Record<string, unknown>)?.gstRateOverride ??
            (item as Record<string, unknown>)?._gstRate ??
            0
        )
      );
      const result = calculateGST({
        taxableValue,
        gstRate,
        companyStateCode,
        partyStateCode,
      });
      cgst = cgst.plus(result.cgst);
      sgst = sgst.plus(result.sgst);
      igst = igst.plus(result.igst);
    }

    const grandRaw = taxable.plus(cgst).plus(sgst).plus(igst);
    const grandRounded = grandRaw.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    return {
      taxable,
      cgst,
      sgst,
      igst,
      roundOff: grandRounded.minus(grandRaw),
      grand: grandRounded,
      taxType: (cgst.gt(0)
        ? "INTRA_STATE"
        : igst.gt(0)
        ? "INTER_STATE"
        : "EXEMPT") as GSTTaxType,
    };
  }, [watchedItems, companyStateCode, partyStateCode]);

  // ── Accounting entries preview (D-06, Advanced Mode only) ─────────────────
  const accountingEntries = useMemo(() => {
    return buildPurchaseEntries(
      selectedParty?.name ?? "",
      totals.taxable,
      totals.cgst,
      totals.sgst,
      totals.igst,
      totals.grand
    );
  }, [selectedParty, totals]);

  const drTotal = accountingEntries
    .filter((e) => e.drCr === "DR")
    .reduce((s, e) => s.plus(e.amount), new Decimal(0));
  const crTotal = accountingEntries
    .filter((e) => e.drCr === "CR")
    .reduce((s, e) => s.plus(e.amount), new Decimal(0));
  const isBalanced = drTotal.equals(crTotal) && accountingEntries.length > 0;

  // ── Mutations ─────────────────────────────────────────────────────────────
  const draftMutation = useMutation({
    mutationFn: (data: PurchaseInvoiceInput) =>
      postVoucherAPI({ ...data, status: "DRAFT" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(`Draft ${data.voucherNo} saved`);
      router.push(`/purchase-invoice/${data.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const postMutation = useMutation({
    mutationFn: (data: PurchaseInvoiceInput) =>
      postVoucherAPI({ ...data, status: "POSTED" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(`Purchase bill ${data.voucherNo} posted successfully`);
      router.push(`/purchase-invoice/${data.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isSaving = draftMutation.isPending || postMutation.isPending;

  // ── Submit handlers ──────────────────────────────────────────────────────
  const onSaveDraft = handleSubmit((data) => draftMutation.mutate(data));
  const onPost = handleSubmit((data) => postMutation.mutate(data));

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title={isSimple ? "Buy from Supplier" : "Purchase Invoice"}
        subtitle={
          isSimple
            ? "Record a bill from a supplier"
            : "Record an inward GST purchase"
        }
        action={
          <Button
            variant="outline"
            onClick={() => router.push("/purchase-invoice")}
          >
            Cancel
          </Button>
        }
      />

      {/* ── Header row: Party, Date, Voucher #, Narration ── */}
      <SectionCard title={isSimple ? "Supplier Details" : "Invoice Details"}>
        <div className="grid grid-cols-4 gap-4">
          {/* Party picker */}
          <div className="space-y-2">
            <Label
              htmlFor="partyLedgerId"
              className="text-sm font-medium text-gray-700"
            >
              {isSimple ? "Supplier" : "Party"}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <select
              id="partyLedgerId"
              {...register("partyLedgerId")}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
            >
              <option value="">Select supplier...</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errors.partyLedgerId && (
              <p className="text-xs text-red-500">
                {errors.partyLedgerId.message}
              </p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date" className="text-sm font-medium text-gray-700">
              Date <span className="text-red-500">*</span>
            </Label>
            <Input id="date" type="date" {...register("date")} className="text-sm" />
            {errors.date && (
              <p className="text-xs text-red-500">{errors.date.message}</p>
            )}
          </div>

          {/* Voucher # — auto-assigned, read-only */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Voucher #</Label>
            <Input
              type="text"
              value=""
              placeholder="Auto-assigned"
              readOnly
              disabled
              className="text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
            />
          </div>

          {/* Narration — hidden in Simple Mode */}
          {!isSimple && (
            <div className="space-y-2">
              <Label
                htmlFor="narration"
                className="text-sm font-medium text-gray-700"
              >
                Narration
              </Label>
              <Input
                id="narration"
                type="text"
                placeholder="Optional note"
                {...register("narration")}
                className="text-sm"
              />
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Line Items Table (ITC checkbox visible in Advanced Mode via LineItemsTable) ── */}
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

      {/* ── Accounting Entries — Advanced Mode only, collapsed by default (D-06) ── */}
      {!isSimple && (
        <AccountingEntriesPanel entries={accountingEntries} isBalanced={isBalanced} />
      )}

      {/* ── ITC note in Simple Mode ── */}
      {isSimple && (
        <p className="text-xs text-gray-400">
          Tax credit on eligible purchases will be automatically tracked for your GST returns.
        </p>
      )}

      {/* ── Action buttons (D-07) ── */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onSaveDraft}
          disabled={isSaving}
        >
          {draftMutation.isPending ? "Saving..." : "Save Draft"}
        </Button>
        <Button
          type="button"
          className="bg-purple-600 hover:bg-purple-700 text-white"
          onClick={onPost}
          disabled={isSaving}
        >
          {postMutation.isPending
            ? "Posting..."
            : isSimple
            ? "Record Purchase"
            : "Post Invoice"}
        </Button>
      </div>
    </div>
  );
}
