"use client";
/**
 * MoneyMoveForm — quick-entry dialog for Receipt and Payment vouchers.
 *
 * Used as a compact FormDialog from the list pages (Receipt/Payment list).
 * Provides quick-entry without bill settlement — for full settlement, users
 * should use the dedicated /receipt/new or /payment/new pages.
 *
 * Props interface is preserved for backward compatibility with MoneyMoveList:
 *   open, onOpenChange, kind, initial
 *
 * Uses real POST /api/v1/vouchers — no mock data sources.
 */

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FormDialog } from "@/components/primitives/FormDialog";
import { FormField } from "@/components/primitives/FormField";
import { TextInput, NumberInput, SelectInput } from "@/components/primitives/FormControls";
import { receiptSchema, paymentSchema } from "@/lib/schemas/vouchers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Kind = "receipts" | "payments";

/** Minimal shape for initial prop — used for edit context from list pages. */
interface InitialRow {
  date?: string;
  amount?: number;
  reference?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: Kind;
  initial?: InitialRow | null;
}

interface PartyOption {
  id: string;
  name: string;
}

interface BankLedgerOption {
  id: string;
  name: string;
}

/**
 * Shared form shape — both receipt and payment schemas share these fields.
 * We use ReceiptInput as the canonical form shape; voucherType is overridden
 * at submit time based on `kind` prop.
 */
type QuickEntryInput = z.infer<typeof receiptSchema>;

// ---------------------------------------------------------------------------
// API helper — POST to real /api/v1/vouchers endpoint
// ---------------------------------------------------------------------------

async function postVoucher(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
): Promise<{ id: string; voucherNo: string }> {
  const res = await fetch("/api/v1/vouchers", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error ?? "Failed to save voucher"
    );
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// MoneyMoveForm
// ---------------------------------------------------------------------------

export function MoneyMoveForm({ open, onOpenChange, kind, initial }: Props) {
  const isReceipt = kind === "receipts";
  const voucherType: "RECEIPT" | "PAYMENT" = isReceipt ? "RECEIPT" : "PAYMENT";
  // Use the appropriate Zod schema for server-side field validation;
  // at runtime the form shape is identical for both receipt and payment.
  const schema = isReceipt ? receiptSchema : paymentSchema;
  const queryClient = useQueryClient();

  // ── Form ──────────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<QuickEntryInput>({ resolver: zodResolver(schema) as any });

  // ── Reset when dialog opens ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    reset({
      voucherType: "RECEIPT", // overridden to correct type at submit
      date: initial?.date ?? new Date().toISOString().split("T")[0],
      amount: initial?.amount ? String(initial.amount) : "",
      reference: initial?.reference ?? "",
      paymentMode: "BANK",
      partyLedgerId: "",
      bankLedgerId: "",
      settlements: [],
    });
  }, [open, initial, reset]);

  // ── Fetch parties ─────────────────────────────────────────────────────────
  const groupParam = isReceipt ? "sundry-debtors" : "sundry-creditors";
  const { data: parties = [] } = useQuery<PartyOption[]>({
    queryKey: ["parties", groupParam],
    queryFn: () =>
      fetch(`/api/v1/masters/ledgers?type=party&group=${groupParam}`).then(
        (r) => {
          if (!r.ok) throw new Error("Failed to load parties");
          return r.json();
        }
      ),
    enabled: open,
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
    enabled: open,
  });

  // ── Mutation ──────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (values: QuickEntryInput) =>
      postVoucher({ ...values, voucherType: voucherType }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(
        `${isReceipt ? "Receipt" : "Payment"} ${data.voucherNo} recorded`
      );
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onSubmit = handleSubmit((values) => mutation.mutate(values));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={isReceipt ? "New Receipt" : "New Payment"}
      description={
        isReceipt
          ? "Record money received from a customer."
          : "Record money paid to a supplier."
      }
      onSubmit={onSubmit}
      submitting={isSubmitting || mutation.isPending}
      submitLabel="Post"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Date */}
        <FormField label="Date" required error={errors.date?.message}>
          <TextInput type="date" {...register("date")} />
        </FormField>

        {/* Payment Mode */}
        <FormField label="Mode" required error={errors.paymentMode?.message}>
          <SelectInput {...register("paymentMode")}>
            <option value="CASH">Cash</option>
            <option value="BANK">Bank Transfer</option>
            <option value="CHEQUE">Cheque</option>
            <option value="UPI">UPI</option>
            <option value="NEFT">NEFT</option>
            <option value="RTGS">RTGS</option>
          </SelectInput>
        </FormField>

        {/* Party picker */}
        <FormField
          label={isReceipt ? "Customer" : "Supplier"}
          required
          error={errors.partyLedgerId?.message}
          className="md:col-span-2"
        >
          <SelectInput {...register("partyLedgerId")}>
            <option value="">
              — select a {isReceipt ? "customer" : "supplier"} —
            </option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectInput>
        </FormField>

        {/* Bank/Cash account */}
        <FormField
          label="Bank / Cash Account"
          required
          error={errors.bankLedgerId?.message}
          className="md:col-span-2"
        >
          <SelectInput {...register("bankLedgerId")}>
            <option value="">— select account —</option>
            {bankLedgers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </SelectInput>
        </FormField>

        {/* Amount */}
        <FormField label="Amount (₹)" required error={errors.amount?.message}>
          <NumberInput step="0.01" min="0.01" {...register("amount")} />
        </FormField>

        {/* Reference */}
        <FormField label="Reference" error={errors.reference?.message}>
          <TextInput {...register("reference")} placeholder="UTR / Cheque #" />
        </FormField>
      </div>
    </FormDialog>
  );
}
