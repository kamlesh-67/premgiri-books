"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, IndianRupee, Receipt, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { KpiCard } from "@/components/primitives/KpiCard";
import { formatINR } from "@/lib/format";
import { useUiStore } from "@/lib/stores/uiStore";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TdsRow {
  id: string;
  voucherNo: string;
  date: string;
  partyName: string;
  partyPan: string | null;
  tdsSection: string;
  tdsRate: string;
  grossAmount: string;
  tdsAmount: string;
  netPaid: string;
}

interface TdsTotals {
  gross: string;
  tds: string;
  net: string;
}

interface TdsResponse {
  rows: TdsRow[];
  totals: TdsTotals;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  // Returns MMYYYY for TDS route (not MM/YYYY)
  return `${String(month).padStart(2, "0")}${year}`;
}

function getPeriodLabel(mmyyyy: string): string {
  const mm = mmyyyy.slice(0, 2);
  const yyyy = mmyyyy.slice(2);
  const date = new Date(parseInt(yyyy), parseInt(mm) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function generatePeriodOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    const val = `${mm}${yyyy}`;
    options.push({ value: val, label: getPeriodLabel(val) });
  }
  return options;
}

function formatDisplayDate(iso: string): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

const SECTION_LABELS: Record<string, string> = {
  "194C": "194C — Contractor",
  "194J": "194J — Professional Services",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TdsRegisterPage() {
  const [period, setPeriod] = useState<string>(getDefaultPeriod());
  const [section, setSection] = useState<string>("all");
  const { uiMode } = useUiStore();

  const { data, isLoading } = useQuery<TdsResponse>({
    queryKey: ["tds-register", period, section],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (section !== "all") params.set("section", section);
      const res = await fetch(`/api/v1/reports/tds?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load TDS register");
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const rows = data?.rows ?? [];
  const totals = data?.totals;

  // Group rows by tdsSection for section-grouped display
  const grouped = rows.reduce<Record<string, TdsRow[]>>((acc, r) => {
    if (!acc[r.tdsSection]) acc[r.tdsSection] = [];
    acc[r.tdsSection].push(r);
    return acc;
  }, {});

  const handleExportCsv = () => {
    const sec = section === "all" ? "" : section;
    const params = new URLSearchParams({ format: "csv", period });
    if (sec) params.set("section", sec);
    window.open(`/api/v1/reports/tds?${params.toString()}`, "_blank");
    toast.success("TDS Register exported. Use this file for TRACES upload.");
  };

  // Mode-aware labels
  const pageTitle = uiMode === "simple" ? "TDS Deductions" : "TDS Register";
  const pageSubtitle =
    uiMode === "simple"
      ? "Tax deducted at source on contractor and professional payments"
      : "Tax Deducted at Source — deductions grouped by section for TRACES filing";

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={section} onValueChange={setSection}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Sections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                <SelectItem value="194C">194C — Contractor</SelectItem>
                <SelectItem value="194J">194J — Professional</SelectItem>
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {generatePeriodOptions().map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={isLoading || rows.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        }
      />

      {/* KPI row: 3 cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          title="Total Gross Paid"
          value={totals ? formatINR(parseFloat(totals.gross)) : "₹0.00"}
          icon={IndianRupee}
          iconTone="primary"
        />
        <KpiCard
          title="Total TDS Deducted"
          value={totals ? formatINR(parseFloat(totals.tds)) : "₹0.00"}
          icon={Receipt}
          iconTone="destructive"
        />
        <KpiCard
          title="Net Paid"
          value={totals ? formatINR(parseFloat(totals.net)) : "₹0.00"}
          icon={Wallet}
          iconTone="success"
        />
      </div>

      {/* TDS Register table */}
      <SectionCard title="TDS Deductions">
        <div className="overflow-x-auto">
          <table
            className="w-full text-sm"
            aria-label="TDS Register"
          >
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-[100px]">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-[140px]">
                  Voucher #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Deductee
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-[120px]">
                  PAN
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-[80px]">
                  Section
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[70px]">
                  Rate %
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[130px]">
                  Gross Amt
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[120px]">
                  TDS Amt
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[120px]">
                  Net Paid
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-gray-900">
                      No TDS deductions for this period.
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      TDS deductions will appear here when you record payments
                      with TDS to contractors or professionals.
                    </p>
                  </td>
                </tr>
              )}

              {!isLoading &&
                rows.length > 0 &&
                (() => {
                  // When viewing "all" sections, group and show section headers + subtotals
                  if (section === "all") {
                    return Object.entries(grouped).map(
                      ([sectionKey, sectionRows]) => {
                        // Subtotals for this section
                        const subGross = sectionRows.reduce(
                          (s, r) => s + parseFloat(r.grossAmount),
                          0
                        );
                        const subTds = sectionRows.reduce(
                          (s, r) => s + parseFloat(r.tdsAmount),
                          0
                        );
                        const subNet = sectionRows.reduce(
                          (s, r) => s + parseFloat(r.netPaid),
                          0
                        );

                        return [
                          // Section header row
                          <tr key={`hdr-${sectionKey}`} className="bg-gray-100">
                            <td
                              colSpan={9}
                              className="px-4 py-2 text-sm font-semibold text-gray-700"
                            >
                              {SECTION_LABELS[sectionKey] ?? sectionKey}
                            </td>
                          </tr>,
                          // Data rows
                          ...sectionRows.map((row) => (
                            <TdsDataRow key={row.id} row={row} />
                          )),
                          // Subtotal row
                          <tr
                            key={`sub-${sectionKey}`}
                            className="bg-gray-50 border-t border-gray-200"
                          >
                            <td
                              colSpan={6}
                              className="px-4 py-2 text-sm font-semibold text-gray-700"
                            >
                              Subtotal {sectionKey}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-sm font-semibold text-gray-700">
                              {formatINR(subGross)}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-sm font-semibold text-red-700">
                              {formatINR(subTds)}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-sm font-semibold text-gray-700">
                              {formatINR(subNet)}
                            </td>
                          </tr>,
                        ];
                      }
                    );
                  }

                  // Single section filter — just render rows
                  return rows.map((row) => (
                    <TdsDataRow key={row.id} row={row} />
                  ));
                })()}

              {/* TOTAL footer row */}
              {!isLoading && rows.length > 0 && totals && (
                <tr className="bg-gray-50 border-t-2 border-gray-300">
                  <td
                    colSpan={6}
                    className="px-4 py-2 text-sm font-semibold text-gray-900"
                  >
                    TOTAL
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-sm font-bold text-gray-900">
                    {formatINR(parseFloat(totals.gross))}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-sm font-bold text-red-700">
                    {formatINR(parseFloat(totals.tds))}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-sm font-bold text-gray-900">
                    {formatINR(parseFloat(totals.net))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Sub-component: single TDS data row ──────────────────────────────────────

function TdsDataRow({ row }: { row: TdsRow }) {
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50">
      <td className="px-4 py-3 text-sm text-gray-600">
        {formatDisplayDate(row.date)}
      </td>
      <td className="px-4 py-3">
        <a
          href={`/vouchers/payment/${row.id}`}
          className="text-purple-600 hover:underline font-semibold tabular-nums text-sm"
        >
          {row.voucherNo}
        </a>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">{row.partyName}</td>
      <td className="px-4 py-3">
        {row.partyPan ? (
          <span className="font-mono text-sm text-gray-700">{row.partyPan}</span>
        ) : (
          <span className="text-gray-400 text-sm">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">{row.tdsSection}</td>
      <td className="px-4 py-3 text-right tabular-nums text-sm text-gray-700">
        {row.tdsRate}%
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-sm font-semibold text-gray-900">
        {formatINR(parseFloat(row.grossAmount))}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-sm font-semibold text-red-700">
        {formatINR(parseFloat(row.tdsAmount))}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-sm font-semibold text-gray-900">
        {formatINR(parseFloat(row.netPaid))}
      </td>
    </tr>
  );
}
