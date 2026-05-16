"use client";

/**
 * BillSettlementTable
 *
 * Displays open invoices for a party and lets the user select which bills to
 * settle (full or partial amount). Used inside Receipt and Payment voucher
 * forms to allocate incoming/outgoing funds against outstanding bills.
 *
 * Note: Arithmetic uses parseFloat + toFixed(2) rather than decimal.js because
 * decimal.js is not listed in package.json. This is display-only math — the
 * authoritative settlement amounts are re-validated server-side by VoucherEngine.
 * Tracked as deviation: [Rule 3 - Blocking] decimal.js not installed.
 */

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/primitives/SectionCard";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettlementRow {
  id: string;
  voucherNo: string;
  billDate: string;
  totalAmount: string;
  outstandingAmount: string;
  ageDays: number;
}

export interface SettlementSelection {
  billRefId: string;
  amount: string; // partial or full outstanding amount (string decimal)
}

export interface BillSettlementTableProps {
  partyLedgerId: string | null;
  receiptAmount: string; // total receipt/payment amount as decimal string
  voucherType: "RECEIPT" | "PAYMENT";
  onChange: (selections: SettlementSelection[]) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round to 2dp using toFixed to avoid floating-point display artifacts. */
function addDecimalStrings(...values: string[]): string {
  const sum = values.reduce((acc, v) => acc + parseFloat(v || "0"), 0);
  return parseFloat(sum.toFixed(2)).toString();
}

function subtractDecimalStrings(a: string, b: string): string {
  const result = parseFloat(a || "0") - parseFloat(b || "0");
  return parseFloat(result.toFixed(2)).toString();
}

/** Format age with colour coding: default gray, > 30 days amber, > 60 days red */
function ageDaysClass(days: number): string {
  if (days > 60) return "text-red-600";
  if (days > 30) return "text-amber-600";
  return "text-gray-500";
}

/** Format a decimal string for display using formatINR (which accepts number). */
function formatDecimalStr(value: string): string {
  return formatINR(parseFloat(value || "0"));
}

// ---------------------------------------------------------------------------
// BillSettlementTable
// ---------------------------------------------------------------------------

export function BillSettlementTable({
  partyLedgerId,
  receiptAmount,
  voucherType,
  onChange,
}: BillSettlementTableProps) {
  const [selections, setSelections] = useState<SettlementSelection[]>([]);

  // ── Fetch open bills via TanStack Query ──────────────────────────────────
  const { data: billRefs, isLoading } = useQuery<SettlementRow[]>({
    queryKey: ["bill-refs", partyLedgerId, voucherType],
    queryFn: async () => {
      if (!partyLedgerId) return [];
      const type = voucherType === "RECEIPT" ? "receivable" : "payable";
      const res = await fetch(
        `/api/v1/bill-refs?ledgerId=${partyLedgerId}&type=${type}`
      );
      if (!res.ok) throw new Error("Failed to load open invoices");
      return res.json() as Promise<SettlementRow[]>;
    },
    enabled: !!partyLedgerId,
  });

  // Notify parent whenever selections change
  useEffect(() => {
    onChange(selections);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections]);

  // ── Checkbox toggle ──────────────────────────────────────────────────────
  const handleCheck = (row: SettlementRow, checked: boolean) => {
    setSelections((prev) => {
      if (checked) {
        // Default amount = full outstanding
        return [...prev, { billRefId: row.id, amount: row.outstandingAmount }];
      }
      return prev.filter((s) => s.billRefId !== row.id);
    });
  };

  // ── Partial amount input ─────────────────────────────────────────────────
  const handleAmountChange = (billRefId: string, value: string) => {
    setSelections((prev) =>
      prev.map((s) =>
        s.billRefId === billRefId ? { ...s, amount: value } : s
      )
    );
  };

  // ── Real-time totals ─────────────────────────────────────────────────────
  const totalSettled = addDecimalStrings(
    ...selections.map((s) => s.amount || "0")
  );
  const remaining = subtractDecimalStrings(receiptAmount || "0", totalSettled);
  const isOverAllocated = parseFloat(remaining) < 0;

  // ── Null partyLedgerId guard ─────────────────────────────────────────────
  if (!partyLedgerId) {
    return (
      <SectionCard title="Settle against open invoices">
        <p className="text-sm text-gray-400 p-4">
          Select a customer to see open invoices.
        </p>
      </SectionCard>
    );
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SectionCard title="Settle against open invoices">
        <div className="space-y-3 p-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 flex-1 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
          ))}
        </div>
      </SectionCard>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!billRefs || billRefs.length === 0) {
    return (
      <SectionCard title="Settle against open invoices">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm font-medium text-gray-700">No open invoices</p>
          <p className="mt-1 text-xs text-gray-400">
            No outstanding invoices found for this{" "}
            {voucherType === "RECEIPT" ? "customer" : "supplier"}.
          </p>
        </div>
      </SectionCard>
    );
  }

  // ── Main table ───────────────────────────────────────────────────────────
  return (
    <SectionCard title="Settle against open invoices">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 w-10" />
              <th className="px-4 py-3 text-left">Invoice #</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-right tabular-nums">Outstanding</th>
              <th className="px-4 py-3 text-right">Age</th>
              <th className="px-4 py-3 text-right tabular-nums">Settle Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {billRefs.map((row) => {
              const sel = selections.find((s) => s.billRefId === row.id);
              const isChecked = !!sel;
              const maxAmount = parseFloat(row.outstandingAmount || "0");

              return (
                <tr
                  key={row.id}
                  className={cn(
                    "transition-colors",
                    isChecked ? "bg-purple-50" : "hover:bg-gray-50"
                  )}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) =>
                        handleCheck(row, checked === true)
                      }
                      aria-label={`Select ${row.voucherNo}`}
                    />
                  </td>

                  {/* Invoice # */}
                  <td className="px-4 py-3 font-semibold text-purple-600 tabular-nums">
                    {row.voucherNo}
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 text-gray-700">
                    {new Date(row.billDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>

                  {/* Outstanding amount */}
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {formatDecimalStr(row.outstandingAmount)}
                  </td>

                  {/* Age */}
                  <td
                    className={cn(
                      "px-4 py-3 text-right text-xs tabular-nums",
                      ageDaysClass(row.ageDays)
                    )}
                  >
                    {row.ageDays} days
                  </td>

                  {/* Settle amount input */}
                  <td className="px-4 py-3 text-right">
                    {isChecked ? (
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={maxAmount}
                        value={sel.amount}
                        onChange={(e) =>
                          handleAmountChange(row.id, e.target.value)
                        }
                        className="w-32 text-right tabular-nums h-8 text-sm"
                        aria-label={`Settlement amount for ${row.voucherNo}`}
                      />
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Footer totals ─────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 mt-2 pt-3 px-4 flex items-center justify-end gap-6">
        <span className="text-sm text-gray-500">
          Settled:{" "}
          <span className="font-semibold text-gray-900 tabular-nums">
            {formatDecimalStr(totalSettled)}
          </span>
        </span>
        <span className="text-sm text-gray-500">
          Remaining:{" "}
          <span
            className={cn(
              "font-semibold tabular-nums",
              isOverAllocated ? "text-red-600" : "text-green-700"
            )}
          >
            {formatDecimalStr(remaining)}
          </span>
          {isOverAllocated && (
            <span className="ml-1 text-xs text-red-500">(over-allocated)</span>
          )}
        </span>
      </div>
    </SectionCard>
  );
}
