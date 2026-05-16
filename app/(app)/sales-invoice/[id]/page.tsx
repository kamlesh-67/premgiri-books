"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Download } from "lucide-react";

import { useUiStore } from "@/lib/stores/uiStore";
import { formatINR } from "@/lib/utils/format";
import { Decimal } from "decimal.js";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { GSTSummaryPanel } from "@/components/voucher/GSTSummaryPanel";
import { AccountingEntriesPanel, type AccountingEntryRow } from "@/components/voucher/AccountingEntriesPanel";
import { EInvoicePanel } from "@/components/voucher/EInvoicePanel";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VoucherItem {
  id: string;
  itemId: string;
  item: { id: string; name: string };
  qty: string;
  rate: string;
  amount: string;
  discountPct?: string | null;
  cgstRate?: string | null;
  cgstAmt?: string | null;
  sgstRate?: string | null;
  sgstAmt?: string | null;
  igstRate?: string | null;
  igstAmt?: string | null;
  hsnCode?: string | null;
}

interface VoucherEntry {
  id: string;
  ledgerId: string;
  ledger: { id: string; name: string };
  drCr: "DR" | "CR";
  amount: string;
  narration?: string | null;
}

interface Voucher {
  id: string;
  voucherNo: string;
  voucherType: string;
  date: string;
  narration?: string | null;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  totalAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  roundOff: string;
  irn?: string | null;
  irnGeneratedAt?: string | null;
  eWayBillNo?: string | null;
  eWayBillValidUntil?: string | null;
  partyLedger?: { id: string; name: string; gstin?: string | null } | null;
  voucherItems: VoucherItem[];
  voucherEntries: VoucherEntry[];
}

// ---------------------------------------------------------------------------
// Helper — format date as DD-MMM-YYYY
// ---------------------------------------------------------------------------

function formatDisplayDate(dateStr: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// Voucher Detail Page
// ---------------------------------------------------------------------------

export default function SalesInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { uiMode } = useUiStore();

  // ── Fetch voucher ────────────────────────────────────────────────────────
  const { data: voucher, isLoading, isError } = useQuery<Voucher>({
    queryKey: ["voucher", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/vouchers/${id}`);
      if (!res.ok) throw new Error("Voucher not found");
      return res.json();
    },
  });

  // ── Cancel mutation ──────────────────────────────────────────────────────
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/vouchers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "cancel" }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to cancel voucher");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voucher", id] });
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success("Voucher cancelled");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCancel = () => cancelMutation.mutate();

  // ── Determine GST tax type ───────────────────────────────────────────────
  const gstTaxType = (() => {
    if (!voucher) return "EXEMPT" as const;
    const cgst = parseFloat(voucher.cgstAmount || "0");
    const igst = parseFloat(voucher.igstAmount || "0");
    if (cgst > 0) return "INTRA_STATE" as const;
    if (igst > 0) return "INTER_STATE" as const;
    return "EXEMPT" as const;
  })();

  // ── Loading / error states ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded w-1/3" />
          <div className="h-40 bg-gray-100 rounded" />
          <div className="h-40 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (isError || !voucher) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 font-medium">Invoice not found</p>
          <p className="text-sm text-red-500 mt-1">
            This invoice may not exist or you may not have access to it.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push("/sales-invoice")}
          >
            Back to Invoices
          </Button>
        </div>
      </div>
    );
  }

  const isPosted = voucher.status === "POSTED";
  const isSales = voucher.voucherType === "SALES";

  // ── PDF Download ──────────────────────────────────────────────────────────
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownloadPDF = async () => {
    setIsDownloading(true)
    try {
      const res = await fetch(`/api/v1/vouchers/${id}/pdf`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Could not generate PDF')
      }
      const { url } = await res.json()
      window.open(url, '_blank')
      toast.success('Invoice PDF ready.')
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : 'Could not generate PDF. Please try again or contact support if the issue persists.'
      toast.error(message)
    } finally {
      setIsDownloading(false)
    }
  }

  // ── Map voucherEntries to AccountingEntryRow ─────────────────────────────
  const accountingEntries: AccountingEntryRow[] = voucher.voucherEntries.map((e) => ({
    ledgerId: e.ledgerId,
    ledgerName: e.ledger.name,
    drCr: e.drCr,
    amount: e.amount,
  }));

  // WR-05: use Decimal for financial balance check — avoids float imprecision
  const drTotal = accountingEntries
    .filter((e) => e.drCr === "DR")
    .reduce((s, e) => s.plus(new Decimal(e.amount)), new Decimal(0));
  const crTotal = accountingEntries
    .filter((e) => e.drCr === "CR")
    .reduce((s, e) => s.plus(new Decimal(e.amount)), new Decimal(0));
  const isBalanced = drTotal.equals(crTotal) && accountingEntries.length > 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── Page Header ── */}
      <PageHeader
        title={voucher.voucherNo}
        subtitle={`Sales Invoice · ${formatDisplayDate(voucher.date)}`}
        action={
          <div className="flex items-center gap-2">
            {/* Issue Credit Note — only for POSTED SALES invoices */}
            {isPosted && isSales && (
              <Button
                variant="ghost"
                className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                onClick={() => router.push(`/credit-note/new?originalId=${id}`)}
              >
                Issue Credit Note
              </Button>
            )}

            {/* Download PDF — only for POSTED SALES invoices (per D-04) */}
            {isPosted && isSales && (
              <Button
                size="sm"
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                aria-label="Download invoice PDF"
                className={isDownloading ? 'opacity-70 cursor-not-allowed' : ''}
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </>
                )}
              </Button>
            )}
          </div>
        }
      />

      {/* ── Invoice Details ── */}
      <SectionCard title="Invoice Details">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Party</p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {voucher.partyLedger?.name ?? "—"}
            </p>
            {voucher.partyLedger?.gstin && (
              <p className="text-xs text-gray-400 mt-0.5">GSTIN: {voucher.partyLedger.gstin}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date</p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {formatDisplayDate(voucher.date)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Voucher #</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{voucher.voucherNo}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</p>
            <div className="mt-1">
              <StatusBadge status={voucher.status} />
            </div>
          </div>
          {voucher.narration && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Narration</p>
              <p className="mt-1 text-sm text-gray-700">{voucher.narration}</p>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Line Items ── */}
      {voucher.voucherItems.length > 0 && (
        <SectionCard title="Line Items" noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    HSN
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Rate (₹)
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    GST
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Amount (₹)
                  </th>
                </tr>
              </thead>
              <tbody>
                {voucher.voucherItems.map((item) => {
                  const cgstAmt = parseFloat(item.cgstAmt ?? "0");
                  const sgstAmt = parseFloat(item.sgstAmt ?? "0");
                  const igstAmt = parseFloat(item.igstAmt ?? "0");
                  const totalGst = cgstAmt + sgstAmt + igstAmt;
                  return (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900 font-medium">{item.item.name}</td>
                      <td className="px-4 py-3 text-gray-500">{item.hsnCode || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">{item.qty}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {formatINR(item.rate)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {totalGst > 0 ? formatINR(totalGst.toFixed(2)) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-900 font-medium">
                        {formatINR(item.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* ── GST Summary ── */}
      <SectionCard title="GST Summary">
        <GSTSummaryPanel
          taxableTotal={(() => {
            const total = parseFloat(voucher.totalAmount || "0");
            const gst =
              parseFloat(voucher.cgstAmount || "0") +
              parseFloat(voucher.sgstAmount || "0") +
              parseFloat(voucher.igstAmount || "0");
            return (total - gst).toFixed(2);
          })()}
          cgstTotal={voucher.cgstAmount}
          sgstTotal={voucher.sgstAmount}
          igstTotal={voucher.igstAmount}
          roundOff={voucher.roundOff}
          grandTotal={voucher.totalAmount}
          taxType={gstTaxType}
          uiMode={uiMode}
        />
      </SectionCard>

      {/* ── Accounting Entries ── */}
      {accountingEntries.length > 0 && (
        <SectionCard title="Accounting Entries">
          <AccountingEntriesPanel entries={accountingEntries} isBalanced={isBalanced} />
        </SectionCard>
      )}

      {/* ── e-Invoice & e-Way Bill panel — SALES vouchers only ── */}
      {isSales && (
        <SectionCard title="e-Invoice & e-Way Bill">
          <EInvoicePanel
            voucherId={voucher.id}
            voucher={{
              status: voucher.status,
              irn: voucher.irn ?? null,
              irnGeneratedAt: voucher.irnGeneratedAt ?? null,
              eWayBillNo: voucher.eWayBillNo ?? null,
              eWayBillValidUntil: voucher.eWayBillValidUntil ?? null,
            }}
          />
        </SectionCard>
      )}

      {/* ── Cancel Voucher button (D-12) — POSTED only ── */}
      {isPosted && (
        <div className="border-t border-gray-100 pt-4 mt-6">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? "Cancelling..." : "Cancel Voucher"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogTitle>Cancel this voucher?</AlertDialogTitle>
              <AlertDialogDescription>
                This will reverse all ledger entries. This cannot be undone.
              </AlertDialogDescription>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Voucher</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancel}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Yes, Cancel Voucher
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
