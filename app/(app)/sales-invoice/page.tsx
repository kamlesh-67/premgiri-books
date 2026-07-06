"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, FileText, IndianRupee, Clock, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { Toolbar } from "@/components/primitives/Toolbar";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { KpiCard } from "@/components/primitives/KpiCard";
import { RowActions } from "@/components/primitives/RowActions";
import { formatINR, formatDate } from "@/lib/format";
import { Decimal } from "decimal.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BillRef {
  outstandingAmount: string;
}

interface VoucherRow {
  id: string;
  voucherNo: string;
  date: string;
  status: string;
  totalAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  partyLedger?: { id: string; name: string } | null;
  billRefs: BillRef[];
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchSalesVouchers(status: string, q: string): Promise<VoucherRow[]> {
  const params = new URLSearchParams({ type: "SALES" });
  if (status !== "All") params.set("status", status.toUpperCase());
  if (q) params.set("q", q);
  const res = await fetch(`/api/v1/vouchers?${params}`);
  if (!res.ok) throw new Error("Failed to load sales invoices");
  return res.json();
}

async function cancelVoucher(id: string): Promise<void> {
  const res = await fetch(`/api/v1/vouchers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "cancel" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to cancel invoice");
  }
}

// ---------------------------------------------------------------------------
// KPI helpers
// ---------------------------------------------------------------------------

function computeKpis(vouchers: VoucherRow[]) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let totalBilled = 0;
  let outstanding = 0;
  let mtdCount = 0;
  const overdueCount = 0;

  for (const v of vouchers) {
    const vDate = new Date(v.date);
    const total = new Decimal(String(v.totalAmount || '0')).toNumber();

    if (v.status === "POSTED") {
      totalBilled += total;
      if (vDate.getMonth() === currentMonth && vDate.getFullYear() === currentYear) {
        mtdCount++;
      }
    }

    // Outstanding from unsettled bill refs
    for (const br of v.billRefs) {
      const amt = new Decimal(String(br.outstandingAmount || '0')).toNumber();
      if (amt > 0) outstanding += amt;
    }
  }

  return { mtdCount, totalBilled, outstanding, overdueCount };
}

// ---------------------------------------------------------------------------
// Row utilities
// ---------------------------------------------------------------------------

function getRowOutstanding(v: VoucherRow): number {
  return v.billRefs.reduce((sum, br) => sum + new Decimal(String(br.outstandingAmount || '0')).toNumber(), 0);
}

function getTaxable(v: VoucherRow): number {
  const total = new Decimal(String(v.totalAmount || '0')).toNumber();
  const cgst = new Decimal(String(v.cgstAmount || '0')).toNumber();
  const sgst = new Decimal(String(v.sgstAmount || '0')).toNumber();
  const igst = new Decimal(String(v.igstAmount || '0')).toNumber();
  return total - cgst - sgst - igst;
}

function getGst(v: VoucherRow): number {
  return (
    new Decimal(String(v.cgstAmount || '0')).toNumber() +
    new Decimal(String(v.sgstAmount || '0')).toNumber() +
    new Decimal(String(v.igstAmount || '0')).toNumber()
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SalesInvoiceList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");

  const { data: vouchers = [], isLoading } = useQuery<VoucherRow[]>({
    queryKey: ["vouchers", "SALES", status, query],
    queryFn: () => fetchSalesVouchers(status, query),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelVoucher,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vouchers", "SALES"] });
      toast.success("Invoice cancelled");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const kpis = computeKpis(vouchers);

  // Footer totals
  const totals = vouchers.reduce(
    (acc, v) => ({
      taxable: acc.taxable + getTaxable(v),
      gst: acc.gst + getGst(v),
      total: acc.total + new Decimal(String(v.totalAmount || '0')).toNumber(),
    }),
    { taxable: 0, gst: 0, total: 0 }
  );

  const columns: Column<VoucherRow>[] = [
    {
      key: "voucherNo",
      header: "Invoice #",
      width: "160px",
      cell: (r) => (
        <Link
          href={`/sales-invoice/${r.id}`}
          className="font-semibold text-primary hover:underline tabular-nums"
        >
          {r.voucherNo}
        </Link>
      ),
    },
    {
      key: "date",
      header: "Date",
      width: "100px",
      cell: (r) => <span className="text-gray-700">{formatDate(r.date)}</span>,
    },
    {
      key: "party",
      header: "Customer",
      className: "whitespace-normal",
      cell: (r) => <span className="text-gray-700">{r.partyLedger?.name ?? "—"}</span>,
    },
    {
      key: "taxable",
      header: "Taxable",
      align: "right",
      cell: (r) => <span className="tabular-nums">{formatINR(getTaxable(r))}</span>,
    },
    {
      key: "gst",
      header: "GST",
      align: "right",
      cell: (r) => <span className="tabular-nums">{formatINR(getGst(r))}</span>,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (r) => (
        <span className="font-semibold tabular-nums">
          {formatINR(new Decimal(String(r.totalAmount || '0')).toNumber())}
        </span>
      ),
    },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "right",
      cell: (r) => {
        const amt = getRowOutstanding(r);
        return (
          <span
            className={`tabular-nums ${amt > 0 ? "text-amber-700 font-medium" : "text-muted-foreground"}`}
          >
            {formatINR(amt)}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      width: "100px",
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "90px",
      cell: (r) => (
        <RowActions
          onView={() => router.push(`/sales-invoice/${r.id}`)}
          onDelete={
            r.status !== "CANCELLED"
              ? () => {
                  if (confirm(`Cancel invoice ${r.voucherNo}?`)) {
                    cancelMutation.mutate(r.id);
                  }
                }
              : undefined
          }
        />
      ),
    },
  ];

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Sales Invoices"
        subtitle="All outward GST invoices for the current financial year."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => {
              const url = new URL("/api/v1/sales-invoice/export", window.location.origin);
              if (status !== "All") url.searchParams.set("status", status);
              if (query) url.searchParams.set("q", query);
              window.open(url.toString(), "_blank");
            }}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button size="sm" onClick={() => router.push("/sales-invoice/new")}>
              <Plus className="mr-2 h-4 w-4" />
              New Invoice
            </Button>
          </>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Invoices (MTD)"
          value={String(kpis.mtdCount)}
          icon={FileText}
          iconTone="primary"
        />
        <KpiCard
          title="Total Billed"
          value={formatINR(kpis.totalBilled)}
          icon={IndianRupee}
          iconTone="success"
        />
        <KpiCard
          title="Outstanding"
          value={formatINR(kpis.outstanding)}
          icon={Clock}
          iconTone="warning"
        />
        <KpiCard
          title="Overdue"
          value={`${kpis.overdueCount} invoice${kpis.overdueCount === 1 ? "" : "s"}`}
          icon={AlertTriangle}
          iconTone="destructive"
        />
      </div>

      <SectionCard>
        <Toolbar
          searchPlaceholder="Search by invoice #, party…"
          onSearchChange={setQuery}
        >
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-md border border-border bg-surface px-3 text-sm"
          >
            <option value="All">All status</option>
            <option value="POSTED">Posted</option>
            <option value="DRAFT">Draft</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </Toolbar>

        <DataTable
          columns={columns}
          rows={isLoading ? [] : vouchers}
          rowKey={(r) => r.id}
          empty={
            isLoading
              ? "Loading invoices…"
              : status !== "All"
              ? `No ${status.toLowerCase()} invoices found.`
              : "No invoices yet — click New Invoice to create one."
          }
          footer={
            vouchers.length > 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right text-muted-foreground text-xs uppercase font-semibold">
                  Totals
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatINR(totals.taxable)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatINR(totals.gst)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatINR(totals.total)}</td>
                <td colSpan={3} />
              </tr>
            ) : undefined
          }
        />
      </SectionCard>
    </div>
  );
}
