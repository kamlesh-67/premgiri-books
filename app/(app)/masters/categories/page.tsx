"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { RowActions } from "@/components/primitives/RowActions";
import { ConfirmDelete } from "@/components/primitives/ConfirmDelete";
import { useCollection, remove, type CategoryRow } from "@/lib/mockStore";
import { CategoryForm } from "./forms/CategoryForm";

export default function Categories() {
  const rows = useCollection("categories");
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<CategoryRow | null>(null);

  const cols: Column<CategoryRow>[] = [
    { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: "name", header: "Category", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "parent", header: "Parent group", cell: (r) => r.parent },
    { key: "items", header: "Items", align: "right", cell: (r) => r.items },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <RowActions onEdit={() => { setEditing(r); setOpen(true); }} onDelete={() => setToDelete(r)} />
    ) },
  ];

  return (
    <div>
      <PageHeader title="Categories" subtitle="Group stock items for reporting and pricing."
        actions={<Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />New Category</Button>} />
      <SectionCard><DataTable columns={cols} rows={rows} rowKey={(r) => r.code} empty="No categories yet." /></SectionCard>
      <CategoryForm open={open} onOpenChange={setOpen} initial={editing} />
      <ConfirmDelete open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.name}?`}
        onConfirm={() => { if (toDelete) { remove("categories", toDelete.code); toast.success(`${toDelete.name} removed`); } setToDelete(null); }} />
    </div>
  );
}
