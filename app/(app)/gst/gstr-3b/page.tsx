"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { formatINR } from "@/lib/utils/format";
import { useUiStore } from "@/lib/stores/uiStore";
import { Decimal } from "decimal.js";

// ─── Types matching GSTService Gstr3bSummary ──────────────────────────────────

interface OverrideRecord {
  autoValue: string;
  userValue: string;
  overriddenAt: string;
  overriddenBy: string;
}

interface Gstr3bData {
  outwardTaxable: { taxable: string; cgst: string; sgst: string; igst: string };
  zeroNilRated: { taxable: string };
  rcmInward: { taxable: string; cgst: string; sgst: string; igst: string };
  itcAvailable: { cgst: string; sgst: string; igst: string };
  netPayable: { cgst: string; sgst: string; igst: string };
  overrides: Record<string, OverrideRecord> | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDefaultPeriod(): string {
  const now = new Date();
  const day = now.getDate();
  const month =
    day < 10
      ? now.getMonth() === 0
        ? 12
        : now.getMonth()
      : now.getMonth() + 1;
  const year =
    day < 10 && now.getMonth() === 0
      ? now.getFullYear() - 1
      : now.getFullYear();
  return `${String(month).padStart(2, "0")}/${year}`;
}

function getPeriodLabel(period: string): string {
  const [mm, yyyy] = period.split("/");
  const date = new Date(parseInt(yyyy), parseInt(mm) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function generatePeriodOptions(): { value: string; label: string }[] {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    options.push({
      value: `${mm}/${yyyy}`,
      label: getPeriodLabel(`${mm}/${yyyy}`),
    });
  }
  return options;
}

function formatAmount(val: string | undefined): string {
  if (!val) return "₹0.00";
  const n = new Decimal(String(val || '0')).toNumber();
  return Number.isFinite(n) ? formatINR(n) : "₹0.00";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Gstr3bPage() {
  const [period, setPeriod] = useState<string>(getDefaultPeriod());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const queryClient = useQueryClient();
  const { uiMode } = useUiStore();

  const isFiled = false; // derived from data.status once available

  // Data query
  const { data, isLoading } = useQuery<Gstr3bData>({
    queryKey: ["gstr3b", period],
    queryFn: async () => {
      const r = await fetch(`/api/v1/gst/gstr3b?period=${period}`);
      if (!r.ok) throw new Error("Failed to load GSTR-3B data");
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Override mutation
  const { mutate: saveOverride } = useMutation({
    mutationFn: async ({
      cellKey,
      autoValue,
      userValue,
    }: {
      cellKey: string;
      autoValue: string;
      userValue: string;
    }) => {
      const r = await fetch("/api/v1/gst/gstr3b/override", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, cellKey, autoValue, userValue }),
      });
      if (!r.ok) throw new Error("Override failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gstr3b", period] });
      setEditingCell(null);
    },
    onError: () =>
      toast.error("Could not save override. Please try again."),
  });

  // Mark as Filed mutation
  const { mutate: markFiled, isPending: isFiling } = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/v1/gst/gstr3b/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      if (!r.ok) throw new Error("Filing failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gstr3b", period] });
      setConfirmOpen(false);
      toast.success(
        `GSTR-3B filed for ${getPeriodLabel(period)}. All transactions for this period are now locked.`
      );
    },
    onError: () =>
      toast.error("Could not mark as filed. Please try again."),
  });

  // Export JSON — server-side GSTN-compatible JSON via POST /api/v1/gst/gstr3b/export
  const { mutate: exportJson, isPending: isExporting } = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/v1/gst/gstr3b/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      if (!r.ok) {
        const err = await r.json() as { error?: string };
        throw new Error(err.error ?? "Export failed");
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GSTR3B-${period.replace("/", "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gstr3b", period] });
      toast.success("GSTR-3B JSON downloaded. Upload to the GST portal to file.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Simple / Advanced mode labels
  const pageTitle = uiMode === "simple" ? "Tax Summary" : "GSTR-3B";
  const pageSubtitle =
    uiMode === "simple"
      ? "How much GST you owe this period"
      : "Auto-populated tax return summary for filing";

  const rowLabels = {
    outward:
      uiMode === "simple"
        ? "GST collected on sales"
        : "3.1(a) Outward taxable supplies",
    zeroNil:
      uiMode === "simple"
        ? "Zero / NIL rated supplies"
        : "3.1(b) Zero-rated / NIL supplies",
    rcm:
      uiMode === "simple"
        ? "GST on reverse charge purchases"
        : "3.1(d) Inward RCM supplies",
    itc:
      uiMode === "simple"
        ? "GST credit on purchases"
        : "4(A)(5) ITC available (eligible)",
    netPayable:
      uiMode === "simple"
        ? "GST to pay the government"
        : "6.1 Net tax payable",
  };

  // Cell render helper — handles edit mode and amber override highlight
  const renderCell = (cellKey: string, autoVal: string) => {
    const override = data?.overrides?.[cellKey];
    const displayVal = override ? override.userValue : autoVal;
    const isOverridden = !!override;

    if (editingCell === cellKey) {
      return (
        <Input
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() =>
            saveOverride({ cellKey, autoValue: autoVal, userValue: editValue })
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              saveOverride({
                cellKey,
                autoValue: autoVal,
                userValue: editValue,
              });
            }
            if (e.key === "Escape") {
              setEditingCell(null);
            }
          }}
          className="h-8 px-2 py-1 text-sm w-28 tabular-nums"
          autoFocus
        />
      );
    }

    return (
      <button
        className="text-left w-full"
        onClick={() => {
          setEditingCell(cellKey);
          setEditValue(displayVal);
        }}
        title="Auto-calculated from your posted vouchers. Click to override."
      >
        <span
          className={
            isOverridden
              ? "text-sm font-semibold text-amber-700 tabular-nums"
              : "text-sm font-semibold text-gray-900 tabular-nums"
          }
        >
          {formatAmount(displayVal)}
        </span>
        {isOverridden && override && (
          <p className="text-xs text-gray-400 mt-1">
            Manually set — auto-value was {formatAmount(override.autoValue)}
          </p>
        )}
      </button>
    );
  };

  // Skeleton cell
  const skeletonCell = (
    <td className="px-4 py-3 text-right">
      <Skeleton className="h-4 w-24 ml-auto" />
    </td>
  );

  const hasNoData =
    !isLoading &&
    data &&
    new Decimal(String(data.outwardTaxable.taxable || '0')).toNumber() === 0 &&
    new Decimal(String(data.rcmInward.taxable || '0')).toNumber() === 0 &&
    new Decimal(String(data.itcAvailable.cgst || '0')).toNumber() === 0 &&
    new Decimal(String(data.itcAvailable.sgst || '0')).toNumber() === 0 &&
    new Decimal(String(data.itcAvailable.igst || '0')).toNumber() === 0;

  const periodOptions = generatePeriodOptions();

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        action={
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportJson()}
              disabled={!data || isLoading || isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              Export JSON
            </Button>
            {!isFiled ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={isLoading || !data}
              >
                Mark as Filed
              </Button>
            ) : (
              <Button
                size="sm"
                disabled
                className="bg-gray-100 text-gray-500 cursor-not-allowed"
              >
                Filed
              </Button>
            )}
          </div>
        }
      />

      {/* GSTR-3B Summary Card */}
      <div className="max-w-3xl">
        <SectionCard title="Return Summary">
          {hasNoData ? (
            <div className="px-6 py-12 text-center">
              <p className="font-medium text-gray-700 text-sm">
                No data for this period.
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Post sales and purchase invoices first. GSTR-3B
                auto-populates from your posted vouchers.
              </p>
            </div>
          ) : (
            <div aria-busy={isLoading}>
              {/* Section 3.1 — Outward Supplies */}
              <div className="px-6 pt-4 pb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {uiMode === "simple"
                    ? "Sales GST"
                    : "3.1 — Outward Taxable Supplies"}
                </p>
              </div>
              <table className="w-full text-sm" aria-label="GSTR-3B outward supplies">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th
                      scope="col"
                      className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      Nature of Supply
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      Taxable Value
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      CGST
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      SGST
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      IGST
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* 3.1(a) Outward taxable */}
                  <tr className="border-b border-gray-50">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700">
                      {rowLabels.outward}
                    </td>
                    {isLoading ? (
                      <>
                        {skeletonCell}
                        {skeletonCell}
                        {skeletonCell}
                        {skeletonCell}
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-right">
                          {renderCell(
                            "outward.taxable",
                            data?.outwardTaxable.taxable ?? "0"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {renderCell(
                            "outward.cgst",
                            data?.outwardTaxable.cgst ?? "0"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {renderCell(
                            "outward.sgst",
                            data?.outwardTaxable.sgst ?? "0"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {renderCell(
                            "outward.igst",
                            data?.outwardTaxable.igst ?? "0"
                          )}
                        </td>
                      </>
                    )}
                  </tr>

                  {/* 3.1(b) Zero/NIL rated */}
                  <tr className="border-b border-gray-50">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700">
                      {rowLabels.zeroNil}
                    </td>
                    {isLoading ? (
                      <>
                        {skeletonCell}
                        <td className="px-4 py-3 text-right text-gray-400">
                          —
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400">
                          —
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400">
                          —
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-right">
                          {renderCell(
                            "zero.taxable",
                            data?.zeroNilRated.taxable ?? "0"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400">
                          —
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400">
                          —
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400">
                          —
                        </td>
                      </>
                    )}
                  </tr>

                  {/* 3.1(d) RCM inward */}
                  <tr className="border-b border-gray-50">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700">
                      {rowLabels.rcm}
                    </td>
                    {isLoading ? (
                      <>
                        {skeletonCell}
                        {skeletonCell}
                        {skeletonCell}
                        {skeletonCell}
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-right">
                          {renderCell(
                            "rcm.taxable",
                            data?.rcmInward.taxable ?? "0"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {renderCell(
                            "rcm.cgst",
                            data?.rcmInward.cgst ?? "0"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {renderCell(
                            "rcm.sgst",
                            data?.rcmInward.sgst ?? "0"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {renderCell(
                            "rcm.igst",
                            data?.rcmInward.igst ?? "0"
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                </tbody>
              </table>

              <Separator className="my-2" />

              {/* Section 4(A)(5) — ITC Available */}
              <div className="px-6 pt-2 pb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {uiMode === "simple" ? "Purchase GST Credit" : "4(A) — ITC Available"}
                </p>
              </div>
              <table className="w-full text-sm" aria-label="GSTR-3B ITC available">
                <tbody>
                  <tr className="border-b border-gray-50">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700">
                      {rowLabels.itc}
                    </td>
                    {isLoading ? (
                      <>
                        <td className="px-4 py-3 text-right text-gray-400">
                          —
                        </td>
                        {skeletonCell}
                        {skeletonCell}
                        {skeletonCell}
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-right text-gray-400">
                          —
                        </td>
                        <td className="px-4 py-3 text-right">
                          {renderCell(
                            "itc.cgst",
                            data?.itcAvailable.cgst ?? "0"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {renderCell(
                            "itc.sgst",
                            data?.itcAvailable.sgst ?? "0"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {renderCell(
                            "itc.igst",
                            data?.itcAvailable.igst ?? "0"
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                </tbody>
              </table>

              <Separator className="my-2" />

              {/* Section 6.1 — Net Tax Payable */}
              <div className="px-6 pt-2 pb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {uiMode === "simple" ? "GST to Pay" : "6.1 — Net Tax Payable"}
                </p>
              </div>
              <table className="w-full text-sm" aria-label="GSTR-3B net tax payable">
                <tbody>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 w-1/2">
                      {rowLabels.netPayable}
                    </td>
                    {isLoading ? (
                      <>
                        <td className="px-4 py-3 text-right text-gray-400">
                          —
                        </td>
                        {skeletonCell}
                        {skeletonCell}
                        {skeletonCell}
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-right text-gray-400">
                          —
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-sm font-semibold text-gray-900">
                          {formatAmount(data?.netPayable.cgst)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-sm font-semibold text-gray-900">
                          {formatAmount(data?.netPayable.sgst)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-sm font-semibold text-gray-900">
                          {formatAmount(data?.netPayable.igst)}
                        </td>
                      </>
                    )}
                  </tr>
                </tbody>
              </table>
              <div className="px-6 pb-4" />
            </div>
          )}
        </SectionCard>
      </div>

      {/* Mark as Filed AlertDialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              File GSTR-3B for {getPeriodLabel(period)}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Once marked as filed, this period&apos;s return status cannot be
              changed. Confirm only after you have submitted the return on the
              GST portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => markFiled()}
              disabled={isFiling}
            >
              {isFiling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Filing...
                </>
              ) : (
                "Yes, Mark as Filed"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
