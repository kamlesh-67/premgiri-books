"use client";

import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Decimal } from "decimal.js";
import { Info } from "lucide-react";

import { useUiStore } from "@/lib/stores/uiStore";
import { creditNoteSchema, type CreditNoteInput } from "@/lib/schemas/vouchers";
import { calculateGST, type GSTTaxType } from "@/lib/services/GSTCalculator";
import { LineItemsTable, type StockItemOption, type GodownOption } from "@/components/voucher/LineItemsTable";
import { GSTSummaryPanel } from "@/components/voucher/GSTSummaryPanel";
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

interface OriginalVoucher {
  id: string;
  voucherNo: string;
  partyLedgerId: string;
  date: string;
  voucherItems: Array<{
    itemId: string;
    qty: string;
    rate: string;
    discountPct?: string;
    hsnCode?: string;
    itcEligible?: boolean;
  }>;
}

// ---------------------------------------------------------------------------
// API call helper
// ---------------------------------------------------------------------------

async function postCreditNoteAPI(
  data: CreditNoteInput
): Promise<{ id: string; voucherNo: string }> {
  const res = await fetch("/api/v1/vouchers", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Failed to save credit note");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function CreditNoteNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const originalId = searchParams?.get("originalId") ?? null;
  const { uiMode } = useUiStore();
  const isSimple = uiMode === "simple";
  const queryClient = useQueryClient();

  // ── Form ────────────────────────────────────────────────────────────────
  const form = useForm<CreditNoteInput>({
    resolver: zodResolver(creditNoteSchema),
    defaultValues: {
      voucherType: "CREDIT_NOTE",
      status: "POSTED",
      date: new Date().toISOString().split("T")[0],
      narration: "",
      items: [{ itemId: "", qty: "1", rate: "0", discountPct: "0", itcEligible: true }],
      linkedVoucherId: originalId ?? undefined,
    },
  });

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors } } = form;

  // ── Fetch original voucher if ?originalId= present ──────────────────────
  const { data: originalVoucher } = useQuery<OriginalVoucher>({
    queryKey: ["voucher", originalId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/vouchers/${originalId}`);
      if (!res.ok) throw new Error("Original invoice not found");
      return res.json();
    },
    enabled: !!originalId,
  });

  // ── Pre-fill form when original voucher loads (D-15) ─────────────────────
  useEffect(() => {
    if (originalVoucher) {
      reset({
        voucherType: "CREDIT_NOTE",
        partyLedgerId: originalVoucher.partyLedgerId,
        date: new Date().toISOString().split("T")[0],
        narration: `Return against ${originalVoucher.voucherNo}`,
        items: originalVoucher.voucherItems.map((item) => ({
          itemId: item.itemId,
          qty: String(item.qty),
          rate: String(item.rate),
          discountPct: String(item.discountPct ?? "0"),
          hsnCode: item.hsnCode ?? "",
          itcEligible: item.itcEligible ?? true,
        })),
        linkedVoucherId: originalVoucher.id,
        status: "POSTED",
      });
    }
  }, [originalVoucher, reset]);

  // ── Session / company data ───────────────────────────────────────────────
  const { data: sessionData } = useQuery<CompanySession>({
    queryKey: ["session"],
    queryFn: () => fetch("/api/auth/session").then((r) => r.json()),
  });
  const companyStateCode = sessionData?.user?.stateCode ?? "";

  // ── Fetch parties (customers) ────────────────────────────────────────────
  const { data: parties = [] } = useQuery<PartyOption[]>({
    queryKey: ["parties"],
    queryFn: () =>
      fetch("/api/v1/masters/ledgers?type=party").then((r) => {
        if (!r.ok) throw new Error("Failed to load customers");
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

  // ── Mutation ─────────────────────────────────────────────────────────────
  const postMutation = useMutation({
    mutationFn: (data: CreditNoteInput) => postCreditNoteAPI(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(`Credit note ${data.voucherNo} issued successfully`);
      // Navigate back to original invoice to see updated outstanding (D-16)
      if (originalId) {
        router.push(`/sales-invoice/${originalId}`);
      } else {
        router.push(`/sales-invoice/${data.id}`);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isSaving = postMutation.isPending;

  // ── Submit handler ───────────────────────────────────────────────────────
  const onPost = handleSubmit((data) => postMutation.mutate(data));

  // ── Dynamic page subtitle ────────────────────────────────────────────────
  const pageSubtitle = isSimple
    ? "Record a return from a customer"
    : originalVoucher
    ? `Against ${originalVoucher.voucherNo}`
    : "Standalone credit note";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title={isSimple ? "Customer Returned Goods" : "Credit Note"}
        subtitle={pageSubtitle}
        action={
          <Button variant="outline" onClick={() => router.back()}>
            Back
          </Button>
        }
      />

      {/* ── Linked invoice info banner (D-15) ── */}
      {originalVoucher && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700">
            This credit note is linked to invoice{" "}
            <span className="font-semibold">{originalVoucher.voucherNo}</span>.
            Amounts will be applied against the outstanding balance.
          </p>
        </div>
      )}

      {/* ── Party + Date ── */}
      <SectionCard title={isSimple ? "Customer Details" : "Credit Note Details"}>
        <div className="grid grid-cols-3 gap-4">
          {/* Party picker */}
          <div className="space-y-2">
            <Label
              htmlFor="partyLedgerId"
              className="text-sm font-medium text-gray-700"
            >
              {isSimple ? "Customer" : "Party"}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <select
              id="partyLedgerId"
              {...register("partyLedgerId")}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
            >
              <option value="">Select customer...</option>
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

        {/* Hidden field — linkedVoucherId (D-16: reduces original billRef outstanding on server) */}
        <input type="hidden" {...register("linkedVoucherId")} />
      </SectionCard>

      {/* ── Line Items Table (pre-filled from original invoice) ── */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          {isSimple ? "Returned Items" : "Line Items"}
        </h2>
        <LineItemsTable
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          control={control as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setValue={setValue as any}
          voucherType="CREDIT_NOTE"
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

      {/* ── Action button ── */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          className="bg-purple-600 hover:bg-purple-700 text-white"
          onClick={onPost}
          disabled={isSaving}
        >
          {isSaving
            ? "Processing..."
            : isSimple
            ? "Confirm Return"
            : "Issue Credit Note"}
        </Button>
      </div>
    </div>
  );
}
