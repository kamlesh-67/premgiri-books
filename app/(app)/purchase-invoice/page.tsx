"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Receipt, IndianRupee, Clock, ShieldCheck } from "lucide-react";
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

async function fetchPurchaseVouchers(status: string, q: string): Promise<VoucherRow[]> {
  const params = new URLSearchParams({ type: "PURCHASE" });
  if (status !== "All") params.set("status", status.toUpperCase());
  if (q) params.set("q", q);
  const res = await fetch(`/api/v1/vouchers?${params}`);
  if (!res.ok) throw new Error("Failed to load purchase invoices");
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
    throw new Error((err as { error?: string }).error ?? "Failed to cancel bill");
  }
}

// ---------------------------------------------------------------------------
// KPI helpers
// ---------------------------------------------------------------------------

function computeKpis(vouchers: VoucherRow[]) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let totalPurchased = 0;
  let payable = 0;
  let itcAvailable = 0;
  let mtdCount = 0;

  for (const v of vouchers) {
    const vDate = new Date(v.date);
    const total = parseFloat(v.totalAmount) || 0;
    const cgst = parseFloat(v.cgstAmount) || 0;
    const sgst = parseFloat(v.sgstAmount) || 0;
    const igst = parseFloat(v.igstAmount) || 0;

    if (v.status === "POSTED") {
      totalPurchased += total;
      itcAvailable += cgst + sgst + igst;
      if (vDate.getMonth() === currentMonth && vDate.getFullYear() === currentYear) {
        mtdCount++;
      }
    }

    for (const br of v.billRefs) {
      const amt = parseFloat(br.outstandingAmount) || 0;
      if (amt > 0) payable += amt;
    }
  }

  return { mtdCount, totalPurchased, payable, itcAvailable };
}

// ---------------------------------------------------------------------------
// Row utilities
// ---------------------------------------------------------------------------

function getRowPayable(v: VoucherRow): number {
  return v.billRefs.reduce((sum, br) => sum + (parseFloat(br.outstandingAmount) || 0), 0);
}

function getTaxable(v: VoucherRow): number {
  const total = parseFloat(v.totalAmount) || 0;
  const cgst = parseFloat(v.cgstAmount) || 0;
  const sgst = parseFloat(v.sgstAmount) || 0;
  const igst = parseFloat(v.igstAmount) || 0;
  return total - cgst - sgst - igst;
}

function getItc(v: VoucherRow): number {
  return (
    (parseFloat(v.cgstAmount) || 0) +
    (parseFloat(v.sgstAmount) || 0) +
    (parseFloat(v.igstAmount) || 0)
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PurchaseInvoiceList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");

  const { data: vouchers = [], isLoading } = useQuery<VoucherRow[]>({
    queryKey: ["vouchers", "PURCHASE", status, query],
    queryFn: () => fetchPurchaseVouchers(status, query),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelVoucher,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vouchers", "PURCHASE"] });
      toast.success("Bill cancelled");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const kpis = computeKpis(vouchers);

  // Footer totals
  const totals = vouchers.reduce(
    (acc, v) => ({
      taxable: acc.taxable + getTaxable(v),
      itc: acc.itc + getItc(v),
      total: acc.total + (parseFloat(v.totalAmount) || 0),
    }),
    { taxable: 0, itc: 0, total: 0 }
  );

  const columns: Column<VoucherRow>[] = [
    {
      key: "voucherNo",
      header: "Bill #",
      width: "140px",
      cell: (r) => (
        <Link
          href={`/purchase-invoice/${r.id}`}
          className="font-semibold text-primary hover:underline tabular-nums"
        >
          {r.voucherNo}
        </Link>
      ),
    },
    {
      key: "date",
      header: "Date",
      width: "110px",
      cell: (r) => <span className="text-gray-700">{formatDate(r.date)}</span>,
    },
    {
      key: "party",
      header: "Supplier",
      cell: (r) => <span className="text-gray-700">{r.partyLedger?.name ?? "—"}</span>,
    },
    {
      key: "taxable",
      header: "Taxable",
      align: "right",
      cell: (r) => <span className="tabular-nums">{formatINR(getTaxable(r))}</span>,
    },
    {
      key: "itc",
      header: "ITC",
      align: "right",
      cell: (r) => <span className="tabular-nums">{formatINR(getItc(r))}</span>,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (r) => (
        <span className="font-semibold tabular-nums">
          {formatINR(parseFloat(r.totalAmount) || 0)}
        </span>
      ),
    },
    {
      key: "payable",
      header: "Payable",
      align: "right",
      cell: (r) => {
        const amt = getRowPayable(r);
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
          onView={() => router.push(`/purchase-invoice/${r.id}`)}
          onDelete={
            r.status !== "CANCELLED"
              ? () => {
                  if (confirm(`Cancel bill ${r.voucherNo}?`)) {
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
    <div>
      <PageHeader
        title="Purchase Invoices"
        subtitle="All inward GST bills with eligible ITC."
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button size="sm" onClick={() => router.push("/purchase-invoice/new")}>
              <Plus className="mr-2 h-4 w-4" />
              New Bill
            </Button>
          </>
        }
      />

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Bills (MTD)"
          value={String(kpis.mtdCount)}
          icon={Receipt}
          iconTone="primary"
        />
        <KpiCard
          title="Total Purchased"
          value={formatINR(kpis.totalPurchased)}
          icon={IndianRupee}
          iconTone="destructive"
        />
        <KpiCard
          title="Payable"
          value={formatINR(kpis.payable)}
          icon={Clock}
          iconTone="warning"
        />
        <KpiCard
          title="ITC Available"
          value={formatINR(kpis.itcAvailable)}
          icon={ShieldCheck}
          iconTone="success"
        />
      </div>

      <SectionCard>
        <Toolbar
          searchPlaceholder="Search by bill #, supplier…"
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
              ? "Loading bills…"
              : status !== "All"
              ? `No ${status.toLowerCase()} bills found.`
              : "No bills yet — click New Bill to create one."
          }
          footer={
            vouchers.length > 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right text-muted-foreground text-xs uppercase font-semibold">
                  Totals
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatINR(totals.taxable)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatINR(totals.itc)}</td>
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
