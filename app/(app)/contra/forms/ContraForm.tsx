"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { contraSchema, type ContraInput } from "@/lib/schemas/vouchers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialog } from "@/components/primitives/FormDialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LedgerOption {
  id: string;
  name: string;
}

interface ContraFormProps {
  onSuccess?: (id: string) => void;
  /** When provided, renders inside a FormDialog (list-page usage) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initial?: any | null;
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

async function postContraAPI(
  data: ContraInput
): Promise<{ id: string; voucherNo: string }> {
  const res = await fetch("/api/v1/vouchers", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to save contra entry");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Inner form fields (shared between dialog and inline modes)
// ---------------------------------------------------------------------------

function ContraFields({
  form,
  bankLedgers,
  watchedFrom,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: ReturnType<typeof useForm<ContraInput>>;
  bankLedgers: LedgerOption[];
  watchedFrom: string | undefined;
}) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Records a transfer between cash and bank accounts (e.g., cash
        deposited to bank).
      </p>

      {/* Date */}
      <div className="space-y-2">
        <Label htmlFor="contra-date" className="text-sm font-medium text-gray-700">
          Date <span className="text-red-500">*</span>
        </Label>
        <Input
          id="contra-date"
          type="date"
          {...register("date")}
          className="text-sm"
        />
        {errors.date && (
          <p className="text-xs text-red-500">{errors.date.message}</p>
        )}
      </div>

      {/* Transfer From */}
      <div className="space-y-2">
        <Label
          htmlFor="contra-from"
          className="text-sm font-medium text-gray-700"
        >
          Transfer From Account <span className="text-red-500">*</span>
        </Label>
        <select
          id="contra-from"
          {...register("fromLedgerId")}
          className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
        >
          <option value="">Select source account…</option>
          {bankLedgers.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        {errors.fromLedgerId && (
          <p className="text-xs text-red-500">{errors.fromLedgerId.message}</p>
        )}
      </div>

      {/* Transfer To */}
      <div className="space-y-2">
        <Label
          htmlFor="contra-to"
          className="text-sm font-medium text-gray-700"
        >
          Transfer To Account <span className="text-red-500">*</span>
        </Label>
        <select
          id="contra-to"
          {...register("toLedgerId")}
          className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
        >
          <option value="">Select destination account…</option>
          {bankLedgers
            .filter((l) => l.id !== watchedFrom)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
        </select>
        {errors.toLedgerId && (
          <p className="text-xs text-red-500">{errors.toLedgerId.message}</p>
        )}
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <Label
          htmlFor="contra-amount"
          className="text-sm font-medium text-gray-700"
        >
          Amount (₹) <span className="text-red-500">*</span>
        </Label>
        <Input
          id="contra-amount"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          {...register("amount")}
          className="text-sm"
        />
        {errors.amount && (
          <p className="text-xs text-red-500">{errors.amount.message}</p>
        )}
      </div>

      {/* Narration */}
      <div className="space-y-2">
        <Label
          htmlFor="contra-narration"
          className="text-sm font-medium text-gray-700"
        >
          Narration
        </Label>
        <Input
          id="contra-narration"
          type="text"
          placeholder="e.g., Cash deposited to SBI Current Account…"
          {...register("narration")}
          className="text-sm"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContraForm (exported)
// ---------------------------------------------------------------------------

export function ContraForm({
  onSuccess,
  open,
  onOpenChange,
  initial: _initial,
}: ContraFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const form = useForm<ContraInput>({
    resolver: zodResolver(contraSchema),
    defaultValues: {
      voucherType: "CONTRA",
      date: new Date().toISOString().split("T")[0],
      amount: "",
      fromLedgerId: "",
      toLedgerId: "",
      narration: "",
    },
  });

  const {
    handleSubmit,
    watch,
    setError,
    reset,
  } = form;

  const watchedFrom = watch("fromLedgerId");

  // ── Fetch bank/cash ledgers (all ASSET ledgers; user picks cash/bank) ─────
  const { data: bankLedgers = [] } = useQuery<LedgerOption[]>({
    queryKey: ["ledgers", "bank-cash"],
    queryFn: () =>
      fetch("/api/v1/masters/ledgers?nature=ASSET&subtype=bank-cash").then(
        (r) => {
          if (!r.ok) throw new Error("Failed to load bank/cash accounts");
          return r.json();
        }
      ),
  });

  // ── Mutation ──────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: postContraAPI,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(`Contra entry ${data.voucherNo} posted`);
      reset();
      if (onSuccess) {
        onSuccess(data.id);
      } else if (onOpenChange) {
        onOpenChange(false);
      } else {
        router.push("/contra");
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onSubmit = handleSubmit((data) => {
    if (data.fromLedgerId === data.toLedgerId) {
      setError("toLedgerId", {
        message: "Transfer from and to accounts must be different",
      });
      return;
    }
    mutation.mutate(data);
  });

  // ── Dialog mode (used by list page) ──────────────────────────────────────
  if (open !== undefined && onOpenChange !== undefined) {
    return (
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title="New Contra Entry"
        description="Transfer funds between cash and bank accounts"
        onSubmit={onSubmit}
        submitLabel={mutation.isPending ? "Posting…" : "Post Contra Entry"}
        submitting={mutation.isPending}
        size="md"
      >
        <ContraFields
          form={form}
          bankLedgers={bankLedgers}
          watchedFrom={watchedFrom}
        />
      </FormDialog>
    );
  }

  // ── Inline mode (used by /contra/new full-page route) ────────────────────
  return (
    <div className="space-y-4">
      <ContraFields
        form={form}
        bankLedgers={bankLedgers}
        watchedFrom={watchedFrom}
      />
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/contra")}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="bg-purple-600 hover:bg-purple-700 text-white"
          onClick={onSubmit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Posting…" : "Post Contra Entry"}
        </Button>
      </div>
    </div>
  );
}
