import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { Toolbar } from "@/components/primitives/Toolbar";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { RowActions } from "@/components/primitives/RowActions";
import { ConfirmDelete } from "@/components/primitives/ConfirmDelete";
import { formatINR } from "@/lib/format";
import { useCollection, remove, type InvoiceRowFull } from "@/lib/mockStore";

export default function PurchaseInvoiceList() {
  const navigate = useNavigate();
  const rows = useCollection("purchaseInvoices");
  const [query, setQuery] = useState("");
  const [toDelete, setToDelete] = useState<InvoiceRowFull | null>(null);

  const filtered = rows.filter((r) =>
    !query ? true : (r.number + " " + r.party).toLowerCase().includes(query.toLowerCase()),
  );

  const columns: Column<InvoiceRowFull>[] = [
    { key: "number", header: "Bill #", cell: (r) => <span className="font-medium">{r.number}</span> },
    { key: "date", header: "Date", cell: (r) => r.date },
    { key: "party", header: "Supplier", cell: (r) => r.party },
    { key: "taxable", header: "Taxable", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.taxable)}</span> },
    { key: "gst", header: "ITC", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.gst)}</span> },
    { key: "total", header: "Total", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatINR(r.total)}</span> },
    { key: "balance", header: "Payable", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.balance)}</span> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <RowActions
        onEdit={() => navigate(`/purchase-invoice/${r.id}/edit`)}
        onDelete={() => setToDelete(r)}
      />
    ) },
  ];

  return (
    <div>
      <PageHeader
        title="Purchase Invoices"
        subtitle="All inward GST bills with eligible ITC."
        actions={
          <>
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>
            <Button size="sm" onClick={() => navigate("/purchase-invoice/new")}><Plus className="mr-2 h-4 w-4" />New Bill</Button>
          </>
        }
      />
      <SectionCard>
        <Toolbar searchPlaceholder="Search by bill #, supplier…" onSearchChange={setQuery}>
          <select className="h-9 rounded-md border border-border bg-surface px-3 text-sm">
            <option>All suppliers</option>
          </select>
        </Toolbar>
        <DataTable columns={columns} rows={filtered} rowKey={(r) => r.id} empty="No bills yet — click New Bill." />
      </SectionCard>
      <ConfirmDelete open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.number}?`}
        onConfirm={() => { if (toDelete) { remove("purchaseInvoices", toDelete.id); toast.success(`${toDelete.number} deleted`); } setToDelete(null); }} />
    </div>
  );
}
