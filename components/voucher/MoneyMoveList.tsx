"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Download, TrendingDown, TrendingUp, Hash } from "lucide-react";
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
import { MoneyMoveForm } from "@/components/voucher/MoneyMoveForm";
import { formatINR, formatDate } from "@/lib/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Kind = "receipts" | "payments";

interface VoucherRow {
  id: string;
  voucherNo: string;
  date: string;
  status: string;
  totalAmount: string;
  partyLedger?: { id: string; name: string } | null;
  narration?: string | null;
  // payment mode comes from voucherEntries narration or a dedicated field
  paymentMode?: string | null;
}

interface MoneyMoveListProps {
  kind: Kind;
  /** Legacy props kept for backward compatibility — not used for data fetch */
  title?: string;
  subtitle?: string;
  partyLabel?: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

function kindToType(kind: Kind): "RECEIPT" | "PAYMENT" {
  return kind === "receipts" ? "RECEIPT" : "PAYMENT";
}

async function fetchVouchers(kind: Kind, status: string, q: string): Promise<VoucherRow[]> {
  const voucherType = kindToType(kind);
  const params = new URLSearchParams({ type: voucherType });
  if (status !== "All") params.set("status", status.toUpperCase());
  if (q) params.set("q", q);
  const res = await fetch(`/api/v1/vouchers?${params}`);
  if (!res.ok) throw new Error(`Failed to load ${kind}`);
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
    throw new Error((err as { error?: string }).error ?? "Failed to cancel voucher");
  }
}

// ---------------------------------------------------------------------------
// KPI helpers
// ---------------------------------------------------------------------------

function computeKpis(vouchers: VoucherRow[], kind: Kind) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  let mtdTotal = 0;
  let mtdCount = 0;

  for (const v of vouchers) {
    const vDate = new Date(v.date);
    const amt = parseFloat(v.totalAmount) || 0;
    if (v.status === "POSTED") {
      if (vDate.getMonth() === currentMonth && vDate.getFullYear() === currentYear) {
        mtdTotal += amt;
        mtdCount++;
      }
    }
  }

  return { mtdTotal, mtdCount };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MoneyMoveList({
  kind,
  title: titleProp,
  subtitle: subtitleProp,
  partyLabel: partyLabelProp,
}: MoneyMoveListProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [formOpen, setFormOpen] = useState(false);

  const isReceipt = kind === "receipts";
  const voucherType = kindToType(kind);

  // Derived labels
  const title = titleProp ?? (isReceipt ? "Receipts" : "Payments");
  const subtitle =
    subtitleProp ??
    (isReceipt ? "Money received from customers." : "Money paid to suppliers and others.");
  const partyLabel = partyLabelProp ?? (isReceipt ? "Customer" : "Supplier");
  const detailBase = isReceipt ? "/receipt" : "/payment";
  const newHref = `${detailBase}/new`;

  const { data: vouchers = [], isLoading } = useQuery<VoucherRow[]>({
    queryKey: ["vouchers", voucherType, status, query],
    queryFn: () => fetchVouchers(kind, status, query),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelVoucher,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vouchers", voucherType] });
      toast.success("Voucher cancelled");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const kpis = computeKpis(vouchers, kind);

  // Footer total
  const grandTotal = vouchers.reduce(
    (sum, v) => sum + (parseFloat(v.totalAmount) || 0),
    0
  );

  const columns: Column<VoucherRow>[] = [
    {
      key: "voucherNo",
      header: "Voucher #",
      width: "140px",
      cell: (r) => (
        <Link
          href={`${detailBase}/${r.id}`}
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
      header: partyLabel,
      cell: (r) => <span className="text-gray-700">{r.partyLedger?.name ?? "—"}</span>,
    },
    {
      key: "mode",
      header: "Mode",
      width: "90px",
      cell: (r) => (
        <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {r.paymentMode ?? "—"}
        </span>
      ),
    },
    {
      key: "narration",
      header: "Narration",
      cell: (r) => (
        <span className="text-gray-500 text-xs truncate max-w-[200px] block">
          {r.narration ?? "—"}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (r) => (
        <span className="font-semibold tabular-nums">
          {formatINR(parseFloat(r.totalAmount) || 0)}
        </span>
      ),
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
          onView={() => router.push(`${detailBase}/${r.id}`)}
          onDelete={
            r.status !== "CANCELLED"
              ? () => {
                  if (confirm(`Cancel voucher ${r.voucherNo}?`)) {
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
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button size="sm" onClick={() => router.push(newHref)}>
              <Plus className="mr-2 h-4 w-4" />
              {isReceipt ? "Record Receipt" : "Record Payment"}
            </Button>
          </>
        }
      />

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <KpiCard
          title={isReceipt ? "Received (MTD)" : "Paid (MTD)"}
          value={formatINR(kpis.mtdTotal)}
          icon={isReceipt ? TrendingUp : TrendingDown}
          iconTone={isReceipt ? "success" : "destructive"}
        />
        <KpiCard
          title={isReceipt ? "Receipt Count" : "Payment Count"}
          value={String(kpis.mtdCount)}
          icon={Hash}
          iconTone="primary"
        />
      </div>

      <SectionCard>
        <Toolbar
          searchPlaceholder="Search by voucher #, party…"
          onSearchChange={setQuery}
        >
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-md border border-border bg-surface px-3 text-sm"
          >
            <option value="All">All status</option>
            <option value="POSTED">Posted</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </Toolbar>

        <DataTable
          columns={columns}
          rows={isLoading ? [] : vouchers}
          rowKey={(r) => r.id}
          empty={
            isLoading
              ? `Loading ${kind}…`
              : status !== "All"
              ? `No ${status.toLowerCase()} ${kind} found.`
              : `No ${kind} yet — click ${isReceipt ? "Record Receipt" : "Record Payment"} to get started.`
          }
          footer={
            vouchers.length > 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-right text-muted-foreground text-xs uppercase font-semibold">
                  Total
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">
                  {formatINR(grandTotal)}
                </td>
                <td colSpan={2} />
              </tr>
            ) : undefined
          }
        />
      </SectionCard>

      {/* Quick-entry dialog (kept for convenience from list page) */}
      <MoneyMoveForm open={formOpen} onOpenChange={setFormOpen} kind={kind} />
    </div>
  );
}
