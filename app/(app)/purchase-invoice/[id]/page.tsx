"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { formatINR } from "@/lib/utils/format";
import { Decimal } from "decimal.js";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { GSTSummaryPanel } from "@/components/voucher/GSTSummaryPanel";
import { AccountingEntriesPanel, type AccountingEntryRow } from "@/components/voucher/AccountingEntriesPanel";
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
  supplierInvoiceNo?: string | null;
  supplierInvoiceDate?: string | null;
  partyLedger?: { id: string; name: string; gstin?: string | null } | null;
  voucherItems: VoucherItem[];
  voucherEntries: VoucherEntry[];
}

function formatDisplayDate(dateStr: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

export default function PurchaseInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: voucher, isLoading, isError } = useQuery<Voucher>({
    queryKey: ["voucher", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/vouchers/${id}`);
      if (!res.ok) throw new Error("Voucher not found");
      return res.json();
    },
  });

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

  const gstTaxType = (() => {
    if (!voucher) return "EXEMPT" as const;
    const cgst = new Decimal(String(voucher.cgstAmount || '0')).toNumber();
    const igst = new Decimal(String(voucher.igstAmount || '0')).toNumber();
    if (cgst > 0) return "INTRA_STATE" as const;
    if (igst > 0) return "INTER_STATE" as const;
    return "EXEMPT" as const;
  })();

  if (isLoading) {
    return (
      <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
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
      <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 font-medium">Invoice not found</p>
          <p className="text-sm text-red-500 mt-1">
            This invoice may not exist or you may not have access to it.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push("/purchase-invoice")}
          >
            Back to Purchase Invoices
          </Button>
        </div>
      </div>
    );
  }

  const isPosted = voucher.status === "POSTED";
  const isCancelled = voucher.status === "CANCELLED";
  const diffDays = (Date.now() - new Date(voucher.date).getTime()) / (1000 * 60 * 60 * 24);
  const canEdit = !isCancelled && (!isPosted || diffDays <= 15);

  const accountingEntries: AccountingEntryRow[] = voucher.voucherEntries.map((e) => ({
    ledgerId: e.ledgerId,
    ledgerName: e.ledger.name,
    drCr: e.drCr,
    amount: e.amount,
  }));

  const drTotal = accountingEntries
    .filter((e) => e.drCr === "DR")
    .reduce((s, e) => s.plus(new Decimal(e.amount)), new Decimal(0));
  const crTotal = accountingEntries
    .filter((e) => e.drCr === "CR")
    .reduce((s, e) => s.plus(new Decimal(e.amount)), new Decimal(0));
  const isBalanced = drTotal.equals(crTotal) && accountingEntries.length > 0;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title={voucher.voucherNo}
        subtitle={`Purchase Invoice · ${formatDisplayDate(voucher.date)}`}
        action={
          canEdit && (
            <Button
              onClick={() => router.push(`/purchase-invoice/${voucher.id}/edit`)}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Edit Invoice
            </Button>
          )
        }
      />

      <SectionCard title="Invoice Details">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Supplier</p>
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
          {voucher.supplierInvoiceNo && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Supplier Invoice No</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{voucher.supplierInvoiceNo}</p>
            </div>
          )}
          {voucher.supplierInvoiceDate && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Supplier Invoice Date</p>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {formatDisplayDate(voucher.supplierInvoiceDate)}
              </p>
            </div>
          )}
          {voucher.narration && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Narration</p>
              <p className="mt-1 text-sm text-gray-700">{voucher.narration}</p>
            </div>
          )}
        </div>
      </SectionCard>

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
                    Amount (₹)
                  </th>
                </tr>
              </thead>
              <tbody>
                {voucher.voucherItems.map((item) => {
                  return (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900 font-medium">{item.item.name}</td>
                      <td className="px-4 py-3 text-gray-500">{item.hsnCode || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">{item.qty}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {formatINR(item.rate)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-900 font-medium">
                        {formatINR(item.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50">
                  <td className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide" colSpan={2}>
                    Total Qty
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-sm font-semibold text-gray-900">
                    {voucher.voucherItems
                      .reduce((sum, item) => sum.plus(new Decimal(String(item.qty || "0"))), new Decimal(0))
                      .toString()}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionCard>
      )}

      <SectionCard title="GST Summary">
        <GSTSummaryPanel
          taxableTotal={(() => {
            const total = new Decimal(voucher.totalAmount || "0");
            const cgst = new Decimal(voucher.cgstAmount || "0");
            const sgst = new Decimal(voucher.sgstAmount || "0");
            const igst = new Decimal(voucher.igstAmount || "0");
            const roundOff = new Decimal(voucher.roundOff || "0");
            // Taxable = Grand Total - GST - RoundOff (approximately)
            // But better: taxable = Grand Total - RoundOff - (CGST+SGST+IGST)
            return total.minus(roundOff).minus(cgst).minus(sgst).minus(igst).toFixed(2);
          })()}
          cgstTotal={voucher.cgstAmount}
          sgstTotal={voucher.sgstAmount}
          igstTotal={voucher.igstAmount}
          roundOff={voucher.roundOff}
          grandTotal={voucher.totalAmount}
          taxType={gstTaxType}
          uiMode="advanced"
          cgstRate={voucher.voucherItems.find((i) => i.cgstRate)?.cgstRate}
          sgstRate={voucher.voucherItems.find((i) => i.sgstRate)?.sgstRate}
          igstRate={voucher.voucherItems.find((i) => i.igstRate)?.igstRate}
        />
      </SectionCard>

      {accountingEntries.length > 0 && (
        <SectionCard title="Accounting Entries">
          <AccountingEntriesPanel entries={accountingEntries} isBalanced={isBalanced} />
        </SectionCard>
      )}

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
                  onClick={() => cancelMutation.mutate()}
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
