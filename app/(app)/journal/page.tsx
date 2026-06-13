"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { Toolbar } from "@/components/primitives/Toolbar";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { RowActions } from "@/components/primitives/RowActions";
import { formatINR, formatDate } from "@/lib/format";
import { Decimal } from "decimal.js";
import { JournalForm } from "./forms/JournalForm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VoucherRow {
  id: string;
  voucherNo: string;
  date: string;
  status: string;
  totalAmount: string;
  narration?: string | null;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchJournalVouchers(status: string, q: string): Promise<VoucherRow[]> {
  const params = new URLSearchParams({ type: "JOURNAL" });
  if (status !== "All") params.set("status", status.toUpperCase());
  if (q) params.set("q", q);
  const res = await fetch(`/api/v1/vouchers?${params}`);
  if (!res.ok) throw new Error("Failed to load journal entries");
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
    throw new Error((err as { error?: string }).error ?? "Failed to cancel journal entry");
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Journal() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [formOpen, setFormOpen] = useState(false);

  const { data: vouchers = [], isLoading } = useQuery<VoucherRow[]>({
    queryKey: ["vouchers", "JOURNAL", status, query],
    queryFn: () => fetchJournalVouchers(status, query),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelVoucher,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vouchers", "JOURNAL"] });
      toast.success("Journal entry cancelled");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const columns: Column<VoucherRow>[] = [
    {
      key: "voucherNo",
      header: "Voucher #",
      width: "150px",
      cell: (r) => (
        <Link
          href={`/journal/${r.id}`}
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
      key: "narration",
      header: "Narration",
      cell: (r) => (
        <span className="text-gray-700 text-sm">
          {r.narration
            ? r.narration.length > 60
              ? r.narration.slice(0, 60) + "…"
              : r.narration
            : "—"}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total DR",
      align: "right",
      cell: (r) => (
        <span className="font-semibold tabular-nums">
          {formatINR(new Decimal(String(r.totalAmount || '0')).toNumber())}
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
          onView={() => router.push(`/journal/${r.id}`)}
          onDelete={
            r.status !== "CANCELLED"
              ? () => {
                  if (confirm(`Cancel journal entry ${r.voucherNo}?`)) {
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
        title="Journal Entries"
        subtitle="Manual debit/credit adjustments to the books."
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button
              size="sm"
              onClick={() => { setFormOpen(true); }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Journal
            </Button>
          </>
        }
      />

      <SectionCard>
        <Toolbar
          searchPlaceholder="Search by voucher #, narration…"
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
              ? "Loading journal entries…"
              : status !== "All"
              ? `No ${status.toLowerCase()} journal entries found.`
              : "No journal entries yet — click New Journal to create one."
          }
        />
      </SectionCard>

      <JournalForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["vouchers", "JOURNAL"] });
          setFormOpen(false);
        }}
      />
    </div>
  );
}
