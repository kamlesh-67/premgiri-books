import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { RowActions } from "@/components/primitives/RowActions";
import { ConfirmDelete } from "@/components/primitives/ConfirmDelete";
import { useCollection, remove, type UomRow } from "@/lib/mockStore";
import { UomForm } from "./forms/UomForm";

export default function Uom() {
  const rows = useCollection("uoms");
  const [editing, setEditing] = useState<UomRow | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<UomRow | null>(null);

  const cols: Column<UomRow>[] = [
    { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: "name", header: "Name", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "baseUom", header: "Base UoM", cell: (r) => r.baseUom },
    { key: "factor", header: "Conversion factor", align: "right", cell: (r) => <span className="tabular-nums">{r.factor}</span> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <RowActions onEdit={() => { setEditing(r); setOpen(true); }} onDelete={() => setToDelete(r)} />
    ) },
  ];

  return (
    <div>
      <PageHeader title="Units of Measure" subtitle="Define and convert between units used by stock items."
        actions={<Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />New UoM</Button>} />
      <SectionCard><DataTable columns={cols} rows={rows} rowKey={(r) => r.code} empty="No UoMs defined." /></SectionCard>
      <UomForm open={open} onOpenChange={setOpen} initial={editing} />
      <ConfirmDelete open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.name}?`}
        onConfirm={() => { if (toDelete) { remove("uoms", toDelete.code); toast.success(`${toDelete.name} removed`); } setToDelete(null); }} />
    </div>
  );
}
