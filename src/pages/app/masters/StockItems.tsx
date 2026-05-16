import { useState } from "react";
import { Plus, Download, Package, IndianRupee, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { Toolbar } from "@/components/primitives/Toolbar";
import { KpiCard } from "@/components/primitives/KpiCard";
import { RowActions } from "@/components/primitives/RowActions";
import { ConfirmDelete } from "@/components/primitives/ConfirmDelete";
import { formatINR } from "@/lib/format";
import { useCollection, remove, type StockItemRow } from "@/lib/mockStore";
import { StockItemForm } from "./forms/StockItemForm";

export default function StockItems() {
  const rows = useCollection("stockItems");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<StockItemRow | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<StockItemRow | null>(null);

  const filtered = rows.filter((r) =>
    !query ? true : (r.name + " " + r.code + " " + r.hsn).toLowerCase().includes(query.toLowerCase()),
  );
  const totalValue = rows.reduce((a, r) => a + r.value, 0);
  const lowStock = rows.filter((r) => r.stock < 10).length;

  const cols: Column<StockItemRow>[] = [
    { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: "name", header: "Item", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "category", header: "Category", cell: (r) => <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{r.category}</span> },
    { key: "uom", header: "UoM", cell: (r) => r.uom },
    { key: "hsn", header: "HSN", cell: (r) => r.hsn },
    { key: "gst", header: "GST%", cell: (r) => `${r.gst}%` },
    { key: "stock", header: "Stock", align: "right", cell: (r) => <span className="tabular-nums">{r.stock}</span> },
    { key: "rate", header: "Rate", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.rate)}</span> },
    { key: "value", header: "Value", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatINR(r.value)}</span> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <RowActions onEdit={() => { setEditing(r); setOpen(true); }} onDelete={() => setToDelete(r)} />
    ) },
  ];

  return (
    <div>
      <PageHeader title="Stock Items" subtitle="Master data for all sellable / purchasable goods."
        actions={<>
          <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />New Item</Button>
        </>} />
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard title="Total items" value={String(rows.length)} icon={Package} iconTone="primary" />
        <KpiCard title="Inventory value" value={formatINR(totalValue)} icon={IndianRupee} iconTone="success" />
        <KpiCard title="Low stock" value={String(lowStock)} icon={AlertTriangle} iconTone="warning" />
      </div>
      <SectionCard>
        <Toolbar searchPlaceholder="Search items, HSN…" onSearchChange={setQuery}>
          <select className="h-9 rounded-md border border-border bg-surface px-3 text-sm"><option>All categories</option></select>
        </Toolbar>
        <DataTable columns={cols} rows={filtered} rowKey={(r) => r.code} empty="No items — click New Item." />
      </SectionCard>
      <StockItemForm open={open} onOpenChange={setOpen} initial={editing} />
      <ConfirmDelete open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.name}?`}
        onConfirm={() => { if (toDelete) { remove("stockItems", toDelete.code); toast.success(`${toDelete.name} deleted`); } setToDelete(null); }} />
    </div>
  );
}
