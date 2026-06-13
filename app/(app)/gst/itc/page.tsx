"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle,
  BookOpen,
  AlertCircle,
  TrendingUp,
  Upload,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { KpiCard } from "@/components/primitives/KpiCard";
import { formatINR } from "@/lib/format";
import { useUiStore } from "@/lib/stores/uiStore";
import { Decimal } from "decimal.js";

// ─── Types matching /api/v1/gst/itc response ─────────────────────────────────

type MatchStatus = "MATCHED" | "BOOKS_ONLY" | "PORTAL_ONLY" | "EXCESS";

interface ItcRow {
  matchStatus: MatchStatus;
  supplierGstin: string;
  partyName: string;
  invoiceNo: string;
  invoiceDate: string;
  books: { taxableValue: string; cgst: string; sgst: string } | null;
  portal: { taxableValue: string; cgst: string; sgst: string } | null;
}

interface ItcSummary {
  matched: number;
  booksOnly: number;
  portalOnly: number;
  excess: number;
}

interface ItcResponse {
  summary: ItcSummary;
  rows: ItcRow[];
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
  return `${String(month).padStart(2, "0")}/${year}`;
}

function getPeriodLabel(period: string): string {
  const [mm, yyyy] = period.split("/");
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
    const val = `${mm}/${yyyy}`;
    options.push({ value: val, label: getPeriodLabel(val) });
  }
  return options;
}

// Row-level color coding per UI-SPEC 6.3
const ROW_BG: Record<MatchStatus, string> = {
  MATCHED: "bg-green-50",
  BOOKS_ONLY: "bg-amber-50",
  PORTAL_ONLY: "bg-red-50",
  EXCESS: "bg-orange-50",
};

const CHIP_CLASS: Record<MatchStatus, string> = {
  MATCHED: "bg-green-100 text-green-700",
  BOOKS_ONLY: "bg-amber-100 text-amber-700",
  PORTAL_ONLY: "bg-red-100 text-red-700",
  EXCESS: "bg-orange-100 text-orange-700",
};

const CHIP_LABEL: Record<MatchStatus, string> = {
  MATCHED: "Matched",
  BOOKS_ONLY: "Books only",
  PORTAL_ONLY: "GSTR-2A only",
  EXCESS: "Excess in books",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ItcReconciliationPage() {
  const [period, setPeriod] = useState(getDefaultPeriod());
  const [matchFilter, setMatchFilter] = useState<string>("all");
  const [gstinSearch, setGstinSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);

  // Upload dialog state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPeriod, setUploadPeriod] = useState(period);
  const [isDragging, setIsDragging] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    updated: number;
    errors: number;
  } | null>(null);

  const queryClient = useQueryClient();
  const { uiMode } = useUiStore();

  // ITC data query
  const { data, isLoading } = useQuery<ItcResponse>({
    queryKey: ["itc", period, matchFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (matchFilter !== "all") params.set("filter", matchFilter);
      const res = await fetch(`/api/v1/gst/itc?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load ITC data");
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error("No file selected");
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("period", uploadPeriod);
      const res = await fetch("/api/v1/gst/gstr2a/import", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? "Upload failed");
      }
      return res.json();
    },
    onSuccess: (result: { imported: number; updated: number; errors: number }) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["itc", period] });
      toast.success(
        `${result.imported} rows imported. ${result.updated} rows updated. Check the reconciliation table.`
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Client-side GSTIN filter
  const rows = (data?.rows ?? []).filter(
    (r) =>
      gstinSearch === "" ||
      r.supplierGstin.includes(gstinSearch.toUpperCase())
  );

  // Mode-aware labels
  const pageTitle = uiMode === "simple" ? "ITC Check" : "ITC Reconciliation";
  const pageSubtitle =
    uiMode === "simple"
      ? "Make sure your purchase tax credits match the government portal"
      : "Match purchase ITC in books with GSTR-2A downloaded from GSTN.";

  // Handle dialog close / reset
  const handleDialogClose = (open: boolean) => {
    setUploadOpen(open);
    if (!open) {
      setUploadFile(null);
      setImportResult(null);
      setIsDragging(false);
    }
  };

  // No GSTR-2A uploaded check
  const noDataUploaded =
    !isLoading &&
    data &&
    data.summary.matched === 0 &&
    data.summary.booksOnly === 0 &&
    data.summary.portalOnly === 0 &&
    data.summary.excess === 0;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        actions={
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload GSTR-2A
          </Button>
        }
      />

      {/* 4-card KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          title="Matched"
          value={String(data?.summary.matched ?? 0)}
          icon={CheckCircle}
          iconTone="success"
        />
        <KpiCard
          title="Books Only"
          value={String(data?.summary.booksOnly ?? 0)}
          icon={BookOpen}
          iconTone="warning"
        />
        <KpiCard
          title="Missing in Books"
          value={String(data?.summary.portalOnly ?? 0)}
          icon={AlertCircle}
          iconTone="destructive"
        />
        <KpiCard
          title="Excess in Books"
          value={String(data?.summary.excess ?? 0)}
          icon={TrendingUp}
          iconTone="warning"
        />
      </div>

      {/* Reconciliation table */}
      <SectionCard title="Reconciliation Results">
        {/* Filter toolbar */}
        <div className="px-4 pt-4 pb-3 flex flex-wrap items-center gap-3 border-b border-gray-100">
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

          <Select value={matchFilter} onValueChange={setMatchFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by match" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="matched">Matched</SelectItem>
              <SelectItem value="books_only">Books Only</SelectItem>
              <SelectItem value="portal_only">GSTR-2A Only</SelectItem>
              <SelectItem value="excess">Excess in Books</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Search supplier GSTIN..."
            value={gstinSearch}
            onChange={(e) => setGstinSearch(e.target.value)}
            className="w-64 text-sm"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="ITC reconciliation results">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-[120px]">
                  Match
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Supplier
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-[140px]">
                  Invoice #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-[100px]">
                  Date
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[130px]">
                  Taxable (Books)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[110px]">
                  CGST (Books)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[110px]">
                  SGST (Books)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[130px]">
                  Taxable (2A)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[110px]">
                  CGST (2A)
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!isLoading && noDataUploaded && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center"
                  >
                    <p className="text-sm font-medium text-gray-900">
                      Upload GSTR-2A to reconcile.
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Download your GSTR-2A JSON from the GST portal and upload it here to see reconciliation results.
                    </p>
                    <Button
                      size="sm"
                      className="mt-4"
                      onClick={() => setUploadOpen(true)}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload GSTR-2A
                    </Button>
                  </td>
                </tr>
              )}

              {!isLoading &&
                !noDataUploaded &&
                rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-sm text-gray-500"
                    >
                      No records match the current filters.
                    </td>
                  </tr>
                )}

              {!isLoading &&
                rows.map((row, idx) => {
                  const bg = ROW_BG[row.matchStatus];
                  const chipClass = CHIP_CLASS[row.matchStatus];
                  const chipLabel = CHIP_LABEL[row.matchStatus];
                  const isExcess = row.matchStatus === "EXCESS";

                  return (
                    <tr
                      key={`${row.supplierGstin}-${row.invoiceNo}-${idx}`}
                      className={`border-b border-gray-50 ${bg}`}
                    >
                      <td className="px-4 py-3">
                        <span
                          aria-label={`Match status: ${chipLabel}`}
                          className={`${chipClass} px-2.5 py-0.5 rounded-full text-xs font-semibold`}
                        >
                          {chipLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-sm truncate max-w-[200px]">
                          {row.partyName || "—"}
                        </p>
                        <p className="font-mono text-xs text-gray-500 mt-0.5">
                          {row.supplierGstin}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {row.invoiceNo}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {row.invoiceDate}
                      </td>
                      {/* Taxable (Books) */}
                      <td
                        className={`px-4 py-3 text-right tabular-nums text-sm ${
                          isExcess
                            ? "text-amber-700 font-semibold"
                            : "text-gray-700 font-semibold"
                        }`}
                      >
                        {row.books ? (
                          formatINR(new Decimal(String(row.books.taxableValue || '0')).toNumber())
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      {/* CGST (Books) */}
                      <td
                        className={`px-4 py-3 text-right tabular-nums text-sm ${
                          isExcess ? "text-amber-700 font-semibold" : "text-gray-700"
                        }`}
                      >
                        {row.books ? (
                          formatINR(new Decimal(String(row.books.cgst || '0')).toNumber())
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      {/* SGST (Books) */}
                      <td
                        className={`px-4 py-3 text-right tabular-nums text-sm ${
                          isExcess ? "text-amber-700 font-semibold" : "text-gray-700"
                        }`}
                      >
                        {row.books ? (
                          formatINR(new Decimal(String(row.books.sgst || '0')).toNumber())
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      {/* Taxable (2A) */}
                      <td className="px-4 py-3 text-right tabular-nums text-sm text-gray-700">
                        {row.portal ? (
                          formatINR(new Decimal(String(row.portal.taxableValue || '0')).toNumber())
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      {/* CGST (2A) */}
                      <td className="px-4 py-3 text-right tabular-nums text-sm text-gray-700">
                        {row.portal ? (
                          formatINR(new Decimal(String(row.portal.cgst || '0')).toNumber())
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* GSTR-2A Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload GSTR-2A</DialogTitle>
            <DialogDescription>
              Download your GSTR-2A JSON from the GST portal and upload it here.
              We will reconcile your purchase entries automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Period selector for upload */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Return Period
              </label>
              <Select value={uploadPeriod} onValueChange={setUploadPeriod}>
                <SelectTrigger className="w-full">
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
            </div>

            {/* Dropzone */}
            {!importResult && (
              <>
                <div
                  role="button"
                  aria-label="Upload GSTR-2A JSON file"
                  tabIndex={0}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? "border-purple-400 bg-purple-50 text-purple-700"
                      : "border-gray-300 text-gray-500 hover:border-purple-400 hover:bg-purple-50"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const f = e.dataTransfer.files[0];
                    if (
                      f &&
                      (f.type === "application/json" ||
                        f.name.endsWith(".json"))
                    ) {
                      if (f.size > 10 * 1024 * 1024) {
                        toast.error("File too large — max 10 MB");
                        return;
                      }
                      setUploadFile(f);
                    } else if (f) {
                      toast.error("Only .json files are accepted");
                    }
                  }}
                  onClick={() =>
                    document.getElementById("gstr2a-file-input")?.click()
                  }
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    document.getElementById("gstr2a-file-input")?.click()
                  }
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm font-medium">
                    Drag and drop your GSTR-2A JSON here
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    or click to browse files
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    .json files only · max 10 MB
                  </p>
                </div>
                <input
                  id="gstr2a-file-input"
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (f.size > 10 * 1024 * 1024) {
                        toast.error("File too large — max 10 MB");
                        return;
                      }
                      setUploadFile(f);
                    }
                  }}
                />

                {/* Selected file info */}
                {uploadFile && (
                  <div className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-green-600 font-semibold">
                        JSON
                      </span>
                      <span className="text-sm text-gray-700 truncate">
                        {uploadFile.name}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">
                        ({(uploadFile.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:text-red-700 ml-2 shrink-0"
                      onClick={() => setUploadFile(null)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Upload progress (shown while uploading) */}
            {uploadMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                <span>Importing GSTR-2A data...</span>
              </div>
            )}

            {/* Import result */}
            {importResult && (
              <div className="rounded-md border border-gray-200 divide-y divide-gray-100">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-600">Rows imported</span>
                  <span className="text-sm font-semibold text-green-700">
                    {importResult.imported}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-600">Rows updated</span>
                  <span className="text-sm font-semibold text-amber-700">
                    {importResult.updated}
                  </span>
                </div>
                {importResult.errors > 0 && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-gray-600">Errors skipped</span>
                    <span className="text-sm font-semibold text-red-700">
                      {importResult.errors}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            {importResult ? (
              <Button onClick={() => handleDialogClose(false)}>Done</Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleDialogClose(false)}
                  disabled={uploadMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => uploadMutation.mutate()}
                  disabled={!uploadFile || uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    "Import"
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
