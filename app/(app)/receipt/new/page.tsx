"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Decimal } from "decimal.js";

import { useUiStore } from "@/lib/stores/uiStore";
import { receiptSchema, type ReceiptInput } from "@/lib/schemas/vouchers";
import {
  BillSettlementTable,
  type SettlementSelection,
} from "@/components/voucher/BillSettlementTable";
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
}

interface BankLedgerOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

async function postReceiptAPI(
  data: ReceiptInput
): Promise<{ id: string; voucherNo: string }> {
  const res = await fetch("/api/v1/vouchers", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Failed to record receipt");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Receipt /new page
// ---------------------------------------------------------------------------

export default function ReceiptNewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { uiMode } = useUiStore();
  const isSimple = uiMode === "simple";

  // ── D-08: Read bank reconciliation URL params (from Create Voucher shortcut) ──
  const CUID_RE = /^c[a-z0-9]{24,}$/i;
  const rawBankTxId = searchParams?.get("bankTxId") ?? null;
  const rawStatementId = searchParams?.get("statementId") ?? null;
  const bankTxId = rawBankTxId && CUID_RE.test(rawBankTxId) ? rawBankTxId : null;
  const statementId = rawStatementId && CUID_RE.test(rawStatementId) ? rawStatementId : null;
  const prefilledAmount = searchParams?.get("amount") ?? null;
  const prefilledDate = searchParams?.get("date") ?? null;
  const rawNarration = searchParams?.get("narration") ?? null;
  const prefilledNarration = rawNarration ?? undefined;  // CR-06: searchParams.get() already decoded; no decodeURIComponent needed

  // ── Form ──────────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ReceiptInput>({
    resolver: zodResolver(receiptSchema),
    defaultValues: {
      voucherType: "RECEIPT",
      date: prefilledDate ?? new Date().toISOString().split("T")[0],
      paymentMode: "BANK",
      settlements: [],
      ...(prefilledAmount ? { amount: prefilledAmount } : {}),
      ...(prefilledNarration ? { narration: prefilledNarration } : {}),
    },
  });

  // Ensure pre-filled values are set after initial render (for controlled fields)
  useEffect(() => {
    if (prefilledAmount) setValue("amount", prefilledAmount);
    if (prefilledDate) setValue("date", prefilledDate);
    if (prefilledNarration) setValue("narration", prefilledNarration);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const watchedPartyId = watch("partyLedgerId");
  const watchedAmount = watch("amount");

  // ── Fetch parties (Sundry Debtors / customers) ────────────────────────────
  const { data: parties = [] } = useQuery<PartyOption[]>({
    queryKey: ["parties", "debtors"],
    queryFn: () =>
      fetch("/api/v1/masters/ledgers?type=party&group=sundry-debtors").then(
        (r) => {
          if (!r.ok) throw new Error("Failed to load customers");
          return r.json();
        }
      ),
  });

  // ── Fetch bank/cash ledgers ───────────────────────────────────────────────
  const { data: bankLedgers = [] } = useQuery<BankLedgerOption[]>({
    queryKey: ["ledgers", "bank-cash"],
    queryFn: () =>
      fetch("/api/v1/masters/ledgers?nature=ASSET&subtype=bank-cash").then(
        (r) => {
          if (!r.ok) throw new Error("Failed to load bank accounts");
          return r.json();
        }
      ),
  });

  // ── Mutation ──────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: postReceiptAPI,
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(`Receipt ${data.voucherNo} recorded successfully`);

      // D-08: If opened from bank reconciliation "Create Voucher", re-run matching
      // so the newly created voucher is automatically matched to the bank transaction.
      if (bankTxId && statementId) {
        try {
          const r = await fetch(`/api/v1/bank-statements/${statementId}/match`, {
            method: "POST",
          });
          if (!r.ok) {
            console.warn("[ReceiptNewPage] Re-match after save failed:", await r.text());
          }
        } catch (err) {
          console.warn("[ReceiptNewPage] Re-match after save error:", err);
        }
      }

      router.push("/receipt");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onSubmit = handleSubmit((data) => mutation.mutate(data));

  // ── Settlement table handler ───────────────────────────────────────────────
  const handleSettlementChange = (selections: SettlementSelection[]) => {
    setValue("settlements", selections);
  };

  // ── Remaining amount for advance warning ─────────────────────────────────
  const currentSettlements = watch("settlements") ?? [];
  // WR-06: use Decimal for settlement math to avoid floating-point display errors
  const totalSettled = currentSettlements.reduce(
    (sum, s) => sum.plus(new Decimal(s.amount || "0")),
    new Decimal(0)
  );
  const remainingAmount = new Decimal(watchedAmount || "0").minus(totalSettled);
  const hasExcess = remainingAmount.gt(0) && totalSettled.gt(0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title={isSimple ? "Record Payment Received" : "New Receipt"}
        subtitle={
          isSimple
            ? "Record money received from a customer"
            : "Record a receipt from a customer"
        }
        action={
          <Button variant="outline" onClick={() => router.push("/receipt")}>
            Cancel
          </Button>
        }
      />

      {/* ── Form fields ─────────────────────────────────────────────────── */}
      <SectionCard title={isSimple ? "Payment Details" : "Receipt Details"}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Customer picker */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="partyLedgerId" className="text-sm font-medium text-gray-700">
              {isSimple ? "Customer" : "Customer"}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <select
              id="partyLedgerId"
              {...register("partyLedgerId")}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
            >
              <option value="">Select a customer...</option>
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

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-sm font-medium text-gray-700">
              {isSimple ? "How much did you receive?" : "Amount (₹)"}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              {...register("amount")}
              className="text-sm"
            />
            {errors.amount && (
              <p className="text-xs text-red-500">{errors.amount.message}</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date" className="text-sm font-medium text-gray-700">
              Date <span className="text-red-500">*</span>
            </Label>
            <Input
              id="date"
              type="date"
              {...register("date")}
              className="text-sm"
            />
            {errors.date && (
              <p className="text-xs text-red-500">{errors.date.message}</p>
            )}
          </div>

          {/* Bank/Cash Account */}
          <div className="space-y-2">
            <Label htmlFor="bankLedgerId" className="text-sm font-medium text-gray-700">
              {isSimple ? "Which account?" : "Bank / Cash Account"}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <select
              id="bankLedgerId"
              {...register("bankLedgerId")}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
            >
              <option value="">Select account...</option>
              {bankLedgers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            {errors.bankLedgerId && (
              <p className="text-xs text-red-500">
                {errors.bankLedgerId.message}
              </p>
            )}
          </div>

          {/* Payment Mode */}
          <div className="space-y-2">
            <Label htmlFor="paymentMode" className="text-sm font-medium text-gray-700">
              Payment Mode
            </Label>
            <select
              id="paymentMode"
              {...register("paymentMode")}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
            >
              <option value="CASH">Cash</option>
              <option value="BANK">Bank Transfer</option>
              <option value="CHEQUE">Cheque</option>
              <option value="UPI">UPI</option>
              <option value="NEFT">NEFT</option>
              <option value="RTGS">RTGS</option>
            </select>
          </div>

          {/* Reference / UTR */}
          <div className="space-y-2">
            <Label htmlFor="reference" className="text-sm font-medium text-gray-700">
              Reference / UTR
            </Label>
            <Input
              id="reference"
              type="text"
              placeholder="Cheque #, UTR, UPI ID..."
              {...register("reference")}
              className="text-sm"
            />
          </div>

          {/* Narration — Advanced Mode only */}
          {!isSimple && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="narration" className="text-sm font-medium text-gray-700">
                Narration
              </Label>
              <Input
                id="narration"
                type="text"
                placeholder="Optional note..."
                {...register("narration")}
                className="text-sm"
              />
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Bill settlement table ─────────────────────────────────────── */}
      <BillSettlementTable
        partyLedgerId={watchedPartyId ?? null}
        receiptAmount={watchedAmount || "0"}
        voucherType="RECEIPT"
        onChange={handleSettlementChange}
      />

      {/* ── Excess receipt / advance warning ─────────────────────────── */}
      {hasExcess && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          <span className="font-semibold">Advance receipt:</span>{" "}
          ₹{remainingAmount.toFixed(2)} will be recorded as an advance credit for
          this customer and can be adjusted against future invoices.
        </div>
      )}

      {/* ── Action buttons ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/receipt")}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="bg-purple-600 hover:bg-purple-700 text-white"
          onClick={onSubmit}
          disabled={mutation.isPending}
        >
          {mutation.isPending
            ? "Saving..."
            : isSimple
            ? "Record Receipt"
            : "Post Receipt"}
        </Button>
      </div>
    </div>
  );
}
