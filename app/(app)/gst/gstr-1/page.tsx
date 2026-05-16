"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Loader2, FileText, IndianRupee, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { KpiCard } from "@/components/primitives/KpiCard";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { formatINR } from "@/lib/format";

// ─── Types matching GSTService output ─────────────────────────────────────────

interface B2bInvoice {
  invoiceNo: string;
  invoiceDate: string;
  taxableValue: string;
  cgst: string;
  sgst: string;
  igst: string;
  totalGst: string;
  placeOfSupply: string;
  reverseCharge: boolean;
  gstr1Status: string;
}

interface B2bRow {
  gstin: string;
  partyName: string;
  invoices: B2bInvoice[];
  totalTaxable: string;
  totalCgst: string;
  totalSgst: string;
  totalIgst: string;
}

interface B2csRow {
  placeOfSupply: string;
  taxableValue: string;
  igst: string;
  cgst: string;
  sgst: string;
}

interface CdnrNote {
  noteNo: string;
  noteDate: string;
  noteType: "C" | "D";
  taxableValue: string;
  cgst: string;
  sgst: string;
  igst: string;
}

interface CdnrRow {
  gstin: string;
  partyName: string;
  notes: CdnrNote[];
}

interface HsnRow {
  hsnCode: string;
  description: string;
  uom: string;
  qty: string;
  taxableValue: string;
  cgst: string;
  sgst: string;
  igst: string;
}

interface NilRatedRow {
  placeOfSupply: string;
  taxableValue: string;
}

interface Gstr1Data {
  b2b: B2bRow[];
  b2cs: B2csRow[];
  cdnr: CdnrRow[];
  hsn: HsnRow[];
  nilRated: NilRatedRow[];
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

// ─── Skeleton rows helper ──────────────────────────────────────────────────────

function SkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Gstr1Page() {
  const [period, setPeriod] = useState<string>(getDefaultPeriod());
  const [activeTab, setActiveTab] = useState<
    "b2b" | "b2cs" | "cdnr" | "hsn" | "nil"
  >("b2b");
  const queryClient = useQueryClient();

  // Data query
  const { data, isLoading } = useQuery<Gstr1Data>({
    queryKey: ["gstr1", period],
    queryFn: async () => {
      const r = await fetch(`/api/v1/gst/gstr1?period=${period}`);
      if (!r.ok) throw new Error("Failed to load GSTR-1 data");
      return r.json();
    },
    enabled: !!period,
    staleTime: 5 * 60 * 1000,
  });

  // Export JSON mutation
  const { mutate: exportJson, isPending: isExporting } = useMutation({
    mutationFn: async () => {
      const r = await fetch(
        `/api/v1/gst/gstr1/export?period=${period}`
      );
      if (!r.ok) throw new Error("Export failed");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gstr1_${period.replace("/", "")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () =>
      toast.success(
        "GSTR-1 JSON downloaded. Upload to the GST portal to file."
      ),
    onError: () =>
      toast.error(
        "Could not generate GSTR-1 JSON. Check that all invoices are posted and try again."
      ),
  });

  // Mark as Uploaded mutation
  const { mutate: markUploaded, isPending: isMarkingUploaded } = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/v1/gst/gstr1/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, status: "UPLOADED" }),
      });
      if (!r.ok) throw new Error("Failed to update status");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gstr1", period] });
      toast.success(
        `GSTR-1 marked as uploaded for ${getPeriodLabel(period)}.`
      );
    },
    onError: () =>
      toast.error("Could not update status. Please try again."),
  });

  // KPI computations
  const b2bCount = data?.b2b.length ?? 0;

  const totalTaxable = [
    ...(data?.b2b ?? []).map((r) => parseFloat(r.totalTaxable)),
    ...(data?.b2cs ?? []).map((r) => parseFloat(r.taxableValue)),
  ].reduce((a, v) => a + v, 0);

  const totalGst = [
    ...(data?.b2b ?? []).flatMap((r) => [
      parseFloat(r.totalCgst),
      parseFloat(r.totalSgst),
      parseFloat(r.totalIgst),
    ]),
    ...(data?.b2cs ?? []).flatMap((r) => [
      parseFloat(r.cgst),
      parseFloat(r.sgst),
      parseFloat(r.igst),
    ]),
  ].reduce((a, v) => a + v, 0);

  const periodOptions = generatePeriodOptions();

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="GSTR-1"
        subtitle="Monthly outward supply summary for filing"
        actions={
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
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </>
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => markUploaded()}
              disabled={isMarkingUploaded}
            >
              Mark as Uploaded
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          title="B2B Invoices"
          value={isLoading ? "—" : String(b2bCount)}
          icon={FileText}
          iconTone="primary"
        />
        <KpiCard
          title="Total Taxable Value"
          value={isLoading ? "—" : formatINR(totalTaxable)}
          icon={IndianRupee}
          iconTone="success"
        />
        <KpiCard
          title="Total GST"
          value={isLoading ? "—" : formatINR(totalGst)}
          icon={Receipt}
          iconTone="info"
        />
      </div>

      {/* Tabs */}
      <SectionCard title="">
        <Tabs
          value={activeTab}
          onValueChange={(v) =>
            setActiveTab(v as "b2b" | "b2cs" | "cdnr" | "hsn" | "nil")
          }
          className="w-full"
        >
          <TabsList className="border-b border-gray-200 px-6 bg-transparent rounded-none h-auto w-full justify-start">
            <TabsTrigger value="b2b">B2B Invoices</TabsTrigger>
            <TabsTrigger value="b2cs">B2C Small</TabsTrigger>
            <TabsTrigger value="cdnr">Credit Notes (CDNR)</TabsTrigger>
            <TabsTrigger value="hsn">HSN Summary</TabsTrigger>
            <TabsTrigger value="nil">NIL-Rated</TabsTrigger>
          </TabsList>

          {/* B2B Tab */}
          <TabsContent value="b2b">
            <div className="overflow-x-auto" aria-busy={isLoading}>
              <table
                className="w-full text-sm"
                aria-label="GSTR-1 B2B invoices"
              >
                <thead>
                  <tr className="border-b border-gray-100">
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      Buyer GSTIN
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      Buyer
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      Invoices
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      Taxable Value
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      CGST
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      SGST
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      IGST
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      Total GST
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && <SkeletonRows cols={9} />}
                  {!isLoading && (data?.b2b ?? []).length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-12 text-center text-sm text-gray-500"
                      >
                        <p className="font-medium text-gray-700">
                          No B2B invoices this period.
                        </p>
                        <p className="mt-1 text-gray-500">
                          All your invoices this period were to unregistered
                          buyers. Check the B2CS tab.
                        </p>
                      </td>
                    </tr>
                  )}
                  {!isLoading &&
                    (data?.b2b ?? []).map((row) => (
                      <tr
                        key={row.gstin}
                        className="border-b border-gray-50 hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">
                          {row.gstin}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {row.partyName}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {row.invoices.length}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {formatINR(parseFloat(row.totalTaxable))}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {parseFloat(row.totalCgst) > 0
                            ? formatINR(parseFloat(row.totalCgst))
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {parseFloat(row.totalSgst) > 0
                            ? formatINR(parseFloat(row.totalSgst))
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {parseFloat(row.totalIgst) > 0
                            ? formatINR(parseFloat(row.totalIgst))
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">
                          {formatINR(
                            parseFloat(row.totalCgst) +
                              parseFloat(row.totalSgst) +
                              parseFloat(row.totalIgst)
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {row.invoices[0] && (
                            <StatusBadge
                              status={row.invoices[0].gstr1Status}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* B2CS Tab */}
          <TabsContent value="b2cs">
            <div className="overflow-x-auto" aria-busy={isLoading}>
              <table
                className="w-full text-sm"
                aria-label="GSTR-1 B2C small supplies"
              >
                <thead>
                  <tr className="border-b border-gray-100">
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      State
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      Taxable Value
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      IGST
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      CGST
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      SGST
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && <SkeletonRows cols={5} />}
                  {!isLoading && (data?.b2cs ?? []).length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-12 text-center text-sm text-gray-500"
                      >
                        <p className="font-medium text-gray-700">
                          No B2C small supplies this period.
                        </p>
                        <p className="mt-1 text-gray-500">
                          Supplies to unregistered buyers will appear here.
                        </p>
                      </td>
                    </tr>
                  )}
                  {!isLoading &&
                    (data?.b2cs ?? []).map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-50 hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 text-gray-700">
                          {row.placeOfSupply}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {formatINR(parseFloat(row.taxableValue))}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {parseFloat(row.igst) > 0
                            ? formatINR(parseFloat(row.igst))
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {parseFloat(row.cgst) > 0
                            ? formatINR(parseFloat(row.cgst))
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {parseFloat(row.sgst) > 0
                            ? formatINR(parseFloat(row.sgst))
                            : <span className="text-gray-400">—</span>}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* CDNR Tab */}
          <TabsContent value="cdnr">
            <div className="overflow-x-auto" aria-busy={isLoading}>
              <table
                className="w-full text-sm"
                aria-label="GSTR-1 credit and debit notes"
              >
                <thead>
                  <tr className="border-b border-gray-100">
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      Buyer GSTIN
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      Party
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      Note #
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      Date
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      Type
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      Taxable
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      CGST
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      SGST
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      IGST
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && <SkeletonRows cols={9} />}
                  {!isLoading && (data?.cdnr ?? []).length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-12 text-center text-sm text-gray-500"
                      >
                        <p className="font-medium text-gray-700">
                          No credit notes this period.
                        </p>
                        <p className="mt-1 text-gray-500">
                          Credit notes to registered buyers will appear here.
                        </p>
                      </td>
                    </tr>
                  )}
                  {!isLoading &&
                    (data?.cdnr ?? []).flatMap((row) =>
                      row.notes.map((note, ni) => (
                        <tr
                          key={`${row.gstin}-${ni}`}
                          className="border-b border-gray-50 hover:bg-gray-50"
                        >
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">
                            {row.gstin}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {row.partyName}
                          </td>
                          <td className="px-4 py-3 text-gray-700 tabular-nums">
                            {note.noteNo}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {note.noteDate}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                note.noteType === "C"
                                  ? "text-green-700 font-medium"
                                  : "text-red-700 font-medium"
                              }
                            >
                              {note.noteType === "C" ? "Credit" : "Debit"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                            {formatINR(parseFloat(note.taxableValue))}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                            {parseFloat(note.cgst) > 0
                              ? formatINR(parseFloat(note.cgst))
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                            {parseFloat(note.sgst) > 0
                              ? formatINR(parseFloat(note.sgst))
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                            {parseFloat(note.igst) > 0
                              ? formatINR(parseFloat(note.igst))
                              : <span className="text-gray-400">—</span>}
                          </td>
                        </tr>
                      ))
                    )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* HSN Summary Tab */}
          <TabsContent value="hsn">
            <div className="overflow-x-auto" aria-busy={isLoading}>
              <table
                className="w-full text-sm"
                aria-label="GSTR-1 HSN summary"
              >
                <thead>
                  <tr className="border-b border-gray-100">
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      HSN Code
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      Description
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      UoM
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      Qty
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      Taxable
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      CGST
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      SGST
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      IGST
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && <SkeletonRows cols={8} />}
                  {!isLoading && (data?.hsn ?? []).length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-12 text-center text-sm text-gray-500"
                      >
                        <p className="font-medium text-gray-700">
                          No HSN data for this period.
                        </p>
                        <p className="mt-1 text-gray-500">
                          Post sales invoices with HSN codes to see the HSN
                          summary.
                        </p>
                      </td>
                    </tr>
                  )}
                  {!isLoading &&
                    (data?.hsn ?? []).map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-50 hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">
                          {row.hsnCode}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {row.description}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {row.uom}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {parseFloat(row.qty).toFixed(3)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {formatINR(parseFloat(row.taxableValue))}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {parseFloat(row.cgst) > 0
                            ? formatINR(parseFloat(row.cgst))
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {parseFloat(row.sgst) > 0
                            ? formatINR(parseFloat(row.sgst))
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {parseFloat(row.igst) > 0
                            ? formatINR(parseFloat(row.igst))
                            : <span className="text-gray-400">—</span>}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* NIL-Rated Tab */}
          <TabsContent value="nil">
            <div className="overflow-x-auto" aria-busy={isLoading}>
              <table
                className="w-full text-sm"
                aria-label="GSTR-1 NIL-rated supplies"
              >
                <thead>
                  <tr className="border-b border-gray-100">
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      Place of Supply
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      Taxable Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <tr key={i}>
                          <td colSpan={2} className="px-4 py-3">
                            <Skeleton className="h-4 w-full" />
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                  {!isLoading && (data?.nilRated ?? []).length === 0 && (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-4 py-12 text-center text-sm text-gray-500"
                      >
                        No NIL-rated or exempt supplies for this period.
                      </td>
                    </tr>
                  )}
                  {!isLoading &&
                    (data?.nilRated ?? []).map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-50 hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 text-gray-700">
                          {row.placeOfSupply}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">
                          {formatINR(parseFloat(row.taxableValue))}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </SectionCard>
    </div>
  );
}
