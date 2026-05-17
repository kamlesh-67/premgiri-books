"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Decimal } from "decimal.js";

import { useUiStore } from "@/lib/stores/uiStore";
import { formatINR } from "@/lib/utils/format";
import { paymentSchema, type PaymentInput } from "@/lib/schemas/vouchers";
import {
  BillSettlementTable,
  type SettlementSelection,
} from "@/components/voucher/BillSettlementTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
  tdsApplicable?: boolean;  // from tdsApplicable column added in Phase 3
}

interface BankLedgerOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

async function postPaymentAPI(
  data: PaymentInput
): Promise<{ id: string; voucherNo: string }> {
  const res = await fetch("/api/v1/vouchers", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Failed to record payment");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Payment /new page
// ---------------------------------------------------------------------------

export default function PaymentNewPage() {
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
  } = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      voucherType: "PAYMENT",
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

  // ── TDS state ──────────────────────────────────────────────────────────────
  const [tdsEnabled, setTdsEnabled] = useState(false)
  const [tdsSection, setTdsSectionLocal] = useState<'194C' | '194J'>('194C')
  const [tdsRate, setTdsRateLocal] = useState('2')

  const TDS_DEFAULT_RATES: Record<string, string> = { '194C': '2', '194J': '10' }

  // Compute TDS amounts on every render using decimal.js (no floating-point)
  const grossDecimal = (() => { try { return new Decimal(watchedAmount || '0') } catch { return new Decimal(0) } })()
  const rateDecimal  = (() => { try { return new Decimal(tdsRate || '0') } catch { return new Decimal(0) } })()
  const tdsAmountDecimal = grossDecimal.times(rateDecimal).dividedBy(100)
  const netPaymentDecimal = grossDecimal.minus(tdsAmountDecimal)

  // ── Fetch parties (Sundry Creditors / suppliers) ──────────────────────────
  const { data: parties = [] } = useQuery<PartyOption[]>({
    queryKey: ["parties", "creditors"],
    queryFn: () =>
      fetch("/api/v1/masters/ledgers?type=party&group=sundry-creditors").then(
        (r) => {
          if (!r.ok) throw new Error("Failed to load suppliers");
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

  // ── TDS derived state (after parties query) ───────────────────────────────
  // When section changes, auto-fill rate
  const handleTdsSectionChange = (val: '194C' | '194J') => {
    setTdsSectionLocal(val)
    setTdsRateLocal(TDS_DEFAULT_RATES[val])
    setValue('tdsSection', val)
    setValue('tdsRate', TDS_DEFAULT_RATES[val])
  }

  // Determine if selected party has tdsApplicable = true
  const selectedParty = parties.find(p => p.id === watchedPartyId)
  const showTdsPanel = !isSimple && selectedParty?.tdsApplicable === true

  // ── Mutation ──────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: postPaymentAPI,
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(`Payment ${data.voucherNo} recorded successfully`);

      // D-08: If opened from bank reconciliation "Create Voucher", re-run matching
      // so the newly created voucher is automatically matched to the bank transaction.
      if (bankTxId && statementId) {
        try {
          const r = await fetch(`/api/v1/bank-statements/${statementId}/match`, {
            method: "POST",
          });
          if (!r.ok) {
            console.warn("[PaymentNewPage] Re-match after save failed:", await r.text());
          }
        } catch (err) {
          console.warn("[PaymentNewPage] Re-match after save error:", err);
        }
      }

      router.push("/payment");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onSubmit = handleSubmit((data) => {
    // Ensure latest computed tdsAmount is in submission data
    if (tdsEnabled && showTdsPanel) {
      data.tdsSection = tdsSection
      data.tdsRate = tdsRate
      data.tdsAmount = tdsAmountDecimal.toFixed(2)
    } else {
      data.tdsSection = undefined
      data.tdsRate = undefined
      data.tdsAmount = undefined
    }
    mutation.mutate(data)
  });

  // ── Settlement table handler ──────────────────────────────────────────────
  const handleSettlementChange = (selections: SettlementSelection[]) => {
    setValue("settlements", selections);
  };

  // ── Remaining amount for advance warning ──────────────────────────────────
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
        title={isSimple ? "Record Payment Made" : "New Payment"}
        subtitle={
          isSimple
            ? "Record money paid to a supplier"
            : "Record a payment to a supplier"
        }
        action={
          <Button variant="outline" onClick={() => router.push("/payment")}>
            Cancel
          </Button>
        }
      />

      {/* ── Form fields ─────────────────────────────────────────────────── */}
      <SectionCard title={isSimple ? "Payment Details" : "Payment Details"}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Supplier picker */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="partyLedgerId" className="text-sm font-medium text-gray-700">
              Supplier <span className="text-red-500">*</span>
            </Label>
            <select
              id="partyLedgerId"
              {...register("partyLedgerId")}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
            >
              <option value="">Select a supplier...</option>
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
              {isSimple ? "How much did you pay?" : "Amount (₹)"}{" "}
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

      {/* ── TDS Deduction Panel (Advanced Mode + tdsApplicable party only, per D-05) ── */}
      {showTdsPanel && (
        <div className="rounded-md bg-purple-50 border border-purple-100 p-4 space-y-3">
          {/* Toggle row */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-semibold text-gray-900">Deduct TDS</label>
              <p className="text-xs text-gray-500 mt-1">Tax deducted at source on this payment</p>
            </div>
            <Switch
              checked={tdsEnabled}
              onCheckedChange={(checked) => {
                setTdsEnabled(checked)
                if (!checked) {
                  setValue('tdsSection', undefined)
                  setValue('tdsRate', undefined)
                  setValue('tdsAmount', undefined)
                } else {
                  setValue('tdsSection', tdsSection)
                  setValue('tdsRate', tdsRate)
                  setValue('tdsAmount', tdsAmountDecimal.toFixed(2))
                }
              }}
              aria-label="Deduct TDS"
            />
          </div>

          {tdsEnabled && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm font-semibold text-gray-700">Section</Label>
                  <Select
                    value={tdsSection}
                    onValueChange={(val: string) => handleTdsSectionChange(val as '194C' | '194J')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="194C">194C — Contractor</SelectItem>
                      <SelectItem value="194J">194J — Professional Services</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-semibold text-gray-700">Rate (%)</Label>
                  <Input
                    type="number"
                    value={tdsRate}
                    onChange={e => {
                      const v = e.target.value
                      setTdsRateLocal(v)
                      setValue('tdsRate', v)
                      const r = (() => { try { return new Decimal(v || '0') } catch { return new Decimal(0) } })()
                      setValue('tdsAmount', grossDecimal.times(r).dividedBy(100).toFixed(2))
                    }}
                    className="tabular-nums text-sm"
                    placeholder="e.g. 2"
                    min="0"
                    step="0.01"
                  />
                  <p className="text-xs text-gray-400">Auto-filled · editable</p>
                </div>
              </div>

              <Separator className="bg-purple-100" />

              {/* Breakdown */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Gross amount</span>
                <span className="text-gray-900 font-semibold tabular-nums">{formatINR(grossDecimal.toFixed(2))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">TDS deduction</span>
                <span className="text-red-700 font-semibold tabular-nums">− {formatINR(tdsAmountDecimal.toFixed(2))}</span>
              </div>
              <div className="flex justify-between text-base border-t border-purple-100 pt-2 mt-1">
                <span className="text-gray-800 font-semibold">Net payment</span>
                <span className="text-gray-900 font-semibold tabular-nums">{formatINR(netPaymentDecimal.toFixed(2))}</span>
              </div>

              {/* Three-leg accounting preview (Advanced Mode — always visible when TDS enabled) */}
              <div className="mt-2 rounded-md bg-white border border-purple-100 p-3 text-xs space-y-1">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Accounting entries</p>
                <div className="flex justify-between">
                  <span className="text-gray-700">Dr {selectedParty?.name ?? 'Party'}</span>
                  <span className="font-semibold tabular-nums text-gray-900">{formatINR(grossDecimal.toFixed(2))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Cr Bank / Cash</span>
                  <span className="tabular-nums text-gray-700">{formatINR(netPaymentDecimal.toFixed(2))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Cr TDS Payable</span>
                  <span className="tabular-nums text-red-700">{formatINR(tdsAmountDecimal.toFixed(2))}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Bill settlement table ─────────────────────────────────────── */}
      <BillSettlementTable
        partyLedgerId={watchedPartyId ?? null}
        receiptAmount={watchedAmount || "0"}
        voucherType="PAYMENT"
        onChange={handleSettlementChange}
      />

      {/* ── Excess payment / advance warning ─────────────────────────── */}
      {hasExcess && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          <span className="font-semibold">Advance payment:</span>{" "}
          ₹{remainingAmount.toFixed(2)} will be recorded as an advance debit for
          this supplier and can be adjusted against future bills.
        </div>
      )}

      {/* ── Action buttons ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/payment")}
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
            ? "Record Payment"
            : "Post Payment"}
        </Button>
      </div>
    </div>
  );
}
