import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { RowActions } from "@/components/primitives/RowActions";
import { ConfirmDelete } from "@/components/primitives/ConfirmDelete";
import { formatINR } from "@/lib/format";
import { useCollection, remove, type GodownRow } from "@/lib/mockStore";
import { GodownForm } from "./forms/GodownForm";

export default function Godowns() {
  const rows = useCollection("godowns");
  const [editing, setEditing] = useState<GodownRow | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<GodownRow | null>(null);

  const cols: Column<GodownRow>[] = [
    { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: "name", header: "Godown", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "address", header: "Address", cell: (r) => r.address },
    { key: "items", header: "SKUs", align: "right", cell: (r) => r.items },
    { key: "value", header: "Stock value", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatINR(r.value)}</span> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <RowActions onEdit={() => { setEditing(r); setOpen(true); }} onDelete={() => setToDelete(r)} />
    ) },
  ];

  return (
    <div>
      <PageHeader title="Godowns / Warehouses" subtitle="Multi-location stock tracking."
        actions={<Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />New Godown</Button>} />
      <SectionCard><DataTable columns={cols} rows={rows} rowKey={(r) => r.code} empty="No godowns yet." /></SectionCard>
      <GodownForm open={open} onOpenChange={setOpen} initial={editing} />
      <ConfirmDelete open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.name}?`}
        onConfirm={() => { if (toDelete) { remove("godowns", toDelete.code); toast.success(`${toDelete.name} removed`); } setToDelete(null); }} />
    </div>
  );
}
