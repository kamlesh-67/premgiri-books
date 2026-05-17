import { useState } from "react";
import { Download, Plus, FileText, IndianRupee, Clock, AlertTriangle } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { Toolbar } from "@/components/primitives/Toolbar";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { KpiCard } from "@/components/primitives/KpiCard";
import { RowActions } from "@/components/primitives/RowActions";
import { ConfirmDelete } from "@/components/primitives/ConfirmDelete";
import { formatINR } from "@/lib/format";
import { useCollection, remove, type InvoiceRowFull } from "@/lib/mockStore";

export default function SalesInvoiceList() {
  const navigate = useNavigate();
  const rows = useCollection("salesInvoices");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [toDelete, setToDelete] = useState<InvoiceRowFull | null>(null);

  const filtered = rows.filter((r) => {
    if (status !== "All" && r.status !== status) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return r.number.toLowerCase().includes(q) || r.party.toLowerCase().includes(q);
  });

  const totals = filtered.reduce(
    (a, r) => ({ taxable: a.taxable + r.taxable, gst: a.gst + r.gst, total: a.total + r.total, balance: a.balance + r.balance }),
    { taxable: 0, gst: 0, total: 0, balance: 0 },
  );
  const overdue = rows.filter((r) => r.status === "OVERDUE").length;
  const overdueAmount = rows.filter((r) => r.status === "OVERDUE").reduce((a, r) => a + r.balance, 0);

  const columns: Column<InvoiceRowFull>[] = [
    { key: "number", header: "Invoice #", cell: (r) => (
      <Link to={`/sales-invoice/${r.id}`} className="font-medium text-primary hover:underline">{r.number}</Link>
    ) },
    { key: "date", header: "Date", cell: (r) => r.date },
    { key: "party", header: "Party", cell: (r) => r.party },
    { key: "taxable", header: "Taxable", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.taxable)}</span> },
    { key: "gst", header: "GST", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.gst)}</span> },
    { key: "total", header: "Total", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatINR(r.total)}</span> },
    { key: "balance", header: "Balance", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.balance)}</span> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <RowActions
        onView={() => navigate(`/sales-invoice/${r.id}`)}
        onEdit={() => navigate(`/sales-invoice/${r.id}/edit`)}
        onDelete={() => setToDelete(r)}
      />
    ) },
  ];

  return (
    <div>
      <PageHeader
        title="Sales Invoices"
        subtitle="All outward GST invoices for the current financial year."
        actions={
          <>
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>
            <Button size="sm" onClick={() => navigate("/sales-invoice/new")}><Plus className="mr-2 h-4 w-4" />New Invoice</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Invoices (MTD)" value={String(rows.length)} icon={FileText} iconTone="primary" />
        <KpiCard title="Total Billed" value={formatINR(totals.total)} icon={IndianRupee} iconTone="success" />
        <KpiCard title="Outstanding" value={formatINR(totals.balance)} icon={Clock} iconTone="warning" />
        <KpiCard title="Overdue" value={`${overdue} invoice${overdue === 1 ? "" : "s"}`} delta={formatINR(overdueAmount)} deltaTone="warning" icon={AlertTriangle} iconTone="destructive" />
      </div>

      <SectionCard>
        <Toolbar searchPlaceholder="Search by invoice #, party…" onSearchChange={setQuery}>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-3 text-sm">
            <option value="All">All status</option><option value="POSTED">Posted</option><option value="DRAFT">Draft</option><option value="CANCELLED">Cancelled</option><option value="OVERDUE">Overdue</option>
          </select>
        </Toolbar>
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          empty="No invoices yet — click New Invoice to create one."
          footer={
            <tr>
              <td colSpan={3} className="px-4 py-3 text-right text-muted-foreground">Total</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatINR(totals.taxable)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatINR(totals.gst)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatINR(totals.total)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatINR(totals.balance)}</td>
              <td colSpan={2} />
            </tr>
          }
        />
      </SectionCard>
      <ConfirmDelete open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.number}?`}
        description="The invoice will be removed and cannot be restored."
        onConfirm={() => { if (toDelete) { remove("salesInvoices", toDelete.id); toast.success(`${toDelete.number} deleted`); } setToDelete(null); }} />
    </div>
  );
}
