"use client";

import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import Decimal from "decimal.js";

import { journalSchema, type JournalInput } from "@/lib/schemas/vouchers";
import { formatINR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LedgerOption {
  id: string;
  name: string;
}

interface JournalFormProps {
  onSuccess?: (id: string) => void;
  /** Kept for backward compatibility with list-page dialog usage */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initial?: any | null;
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

async function postJournalAPI(
  data: JournalInput
): Promise<{ id: string; voucherNo: string }> {
  const res = await fetch("/api/v1/vouchers", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to save journal entry");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// JournalForm
// ---------------------------------------------------------------------------

export function JournalForm({
  onSuccess,
  open: _open,
  onOpenChange: _onOpenChange,
  initial: _initial,
}: JournalFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<JournalInput>({
    resolver: zodResolver(journalSchema),
    defaultValues: {
      voucherType: "JOURNAL",
      date: new Date().toISOString().split("T")[0],
      narration: "",
      entries: [
        { ledgerId: "", amount: "0", drCr: "DR", narration: "" },
        { ledgerId: "", amount: "0", drCr: "CR", narration: "" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "entries",
  });

  // Watch all entries for the balance indicator
  const watchedEntries = useWatch({ control, name: "entries" });

  // ── Fetch all ledgers ─────────────────────────────────────────────────────
  const { data: ledgers = [] } = useQuery<LedgerOption[]>({
    queryKey: ["ledgers", "all"],
    queryFn: () =>
      fetch("/api/v1/masters/ledgers").then((r) => {
        if (!r.ok) throw new Error("Failed to load ledger accounts");
        return r.json();
      }),
  });

  // ── Mutation ──────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: postJournalAPI,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(`Journal entry ${data.voucherNo} posted`);
      if (onSuccess) {
        onSuccess(data.id);
      } else {
        router.push("/journal");
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Balance calculation ───────────────────────────────────────────────────
  let totalDR = new Decimal(0);
  let totalCR = new Decimal(0);

  for (const entry of watchedEntries ?? []) {
    try {
      const amt = new Decimal(entry.amount || "0");
      if (entry.drCr === "DR") totalDR = totalDR.plus(amt);
      else totalCR = totalCR.plus(amt);
    } catch {
      // ignore parse errors while user is typing
    }
  }

  const difference = totalDR.minus(totalCR).abs();
  const isBalanced =
    totalDR.gt(0) && totalCR.gt(0) && difference.eq(0);

  // ── Submit handler ────────────────────────────────────────────────────────
  const onSubmit = handleSubmit((data) => {
    if (!isBalanced) {
      toast.error(
        "Journal entry is not balanced — total debits must equal total credits"
      );
      return;
    }
    mutation.mutate(data);
  });

  // ── Toggle DR/CR for a row ────────────────────────────────────────────────
  function toggleDrCr(index: number) {
    const current = watchedEntries?.[index]?.drCr ?? "DR";
    setValue(`entries.${index}.drCr`, current === "DR" ? "CR" : "DR");
  }

  return (
    <div className="space-y-6">
      {/* ── Header fields ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label
            htmlFor="date"
            className="text-sm font-medium text-gray-700"
          >
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

        <div className="space-y-2">
          <Label
            htmlFor="narration"
            className="text-sm font-medium text-gray-700"
          >
            Narration / Description
          </Label>
          <Input
            id="narration"
            type="text"
            placeholder="Purpose of this journal entry…"
            {...register("narration")}
            className="text-sm"
          />
          {errors.narration && (
            <p className="text-xs text-red-500">{errors.narration.message}</p>
          )}
        </div>
      </div>

      {/* ── Entry table ─────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-8">
                #
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                Account
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wide w-24">
                DR / CR
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-32">
                Debit (₹)
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-32">
                Credit (₹)
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-40">
                Note
              </th>
              <th className="px-3 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fields.map((field, index) => {
              const drCr = watchedEntries?.[index]?.drCr ?? "DR";
              const isDR = drCr === "DR";
              const entryAmt = watchedEntries?.[index]?.amount ?? "0";

              return (
                <tr key={field.id} className="hover:bg-gray-50">
                  {/* Row number */}
                  <td className="px-3 py-2 text-xs text-gray-400">
                    {index + 1}
                  </td>

                  {/* Account picker */}
                  <td className="px-3 py-2">
                    <select
                      {...register(`entries.${index}.ledgerId`)}
                      className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 min-w-[180px]"
                    >
                      <option value="">Select account…</option>
                      {ledgers.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                    {errors.entries?.[index]?.ledgerId && (
                      <p className="text-xs text-red-500 mt-0.5">
                        {errors.entries[index]?.ledgerId?.message}
                      </p>
                    )}
                  </td>

                  {/* DR/CR toggle */}
                  <td className="px-3 py-2 text-center">
                    <input
                      type="hidden"
                      {...register(`entries.${index}.drCr`)}
                    />
                    <button
                      type="button"
                      onClick={() => toggleDrCr(index)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                        isDR
                          ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                          : "bg-green-100 text-green-700 hover:bg-green-200"
                      }`}
                    >
                      {isDR ? "DR" : "CR"}
                    </button>
                  </td>

                  {/* Debit amount (shown when DR) */}
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      disabled={!isDR}
                      value={isDR ? entryAmt : ""}
                      readOnly={!isDR}
                      onChange={(e) => {
                        if (isDR) {
                          setValue(`entries.${index}.amount`, e.target.value);
                        }
                      }}
                      className="text-sm text-right w-full disabled:bg-gray-50 disabled:cursor-not-allowed"
                    />
                  </td>

                  {/* Credit amount (shown when CR) */}
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      disabled={isDR}
                      value={!isDR ? entryAmt : ""}
                      readOnly={isDR}
                      onChange={(e) => {
                        if (!isDR) {
                          setValue(`entries.${index}.amount`, e.target.value);
                        }
                      }}
                      className="text-sm text-right w-full disabled:bg-gray-50 disabled:cursor-not-allowed"
                    />
                  </td>

                  {/* Per-entry note */}
                  <td className="px-3 py-2">
                    <Input
                      type="text"
                      placeholder="Optional…"
                      {...register(`entries.${index}.narration`)}
                      className="text-sm w-full"
                    />
                  </td>

                  {/* Remove row */}
                  <td className="px-3 py-2">
                    {fields.length > 2 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        aria-label="Remove row"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Add row button ───────────────────────────────────────────────── */}
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
          onClick={() =>
            append({ ledgerId: "", amount: "0", drCr: "DR", narration: "" })
          }
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Row
        </Button>
      </div>

      {/* ── Balance indicator ────────────────────────────────────────────── */}
      <div className="flex justify-between items-center border-t border-gray-100 pt-3 mt-2">
        <div className="flex gap-6 text-sm text-gray-600">
          <span>
            Total DR:{" "}
            <strong className="text-gray-900 tabular-nums">
              {formatINR(totalDR.toNumber())}
            </strong>
          </span>
          <span>
            Total CR:{" "}
            <strong className="text-gray-900 tabular-nums">
              {formatINR(totalCR.toNumber())}
            </strong>
          </span>
        </div>
        {isBalanced ? (
          <span className="text-xs text-green-600 bg-green-50 rounded px-2 py-1">
            Balanced
          </span>
        ) : (
          <span className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
            Difference: {formatINR(difference.toNumber())}
          </span>
        )}
      </div>

      {errors.entries?.root?.message && (
        <p className="text-xs text-red-500">{errors.entries.root.message}</p>
      )}

      {/* ── Action buttons ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (_onOpenChange) _onOpenChange(false);
            else router.push("/journal");
          }}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="bg-purple-600 hover:bg-purple-700 text-white"
          onClick={onSubmit}
          disabled={mutation.isPending || !isBalanced}
        >
          {mutation.isPending ? "Posting…" : "Post Journal Entry"}
        </Button>
      </div>
    </div>
  );
}
