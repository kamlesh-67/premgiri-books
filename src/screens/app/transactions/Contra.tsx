import { useState } from "react";
import { Plus, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { RowActions } from "@/components/primitives/RowActions";
import { ConfirmDelete } from "@/components/primitives/ConfirmDelete";
import { formatINR } from "@/lib/format";
import { useCollection, remove, type JournalRowFull } from "@/lib/mockStore";
import { ContraForm } from "./forms/ContraForm";

export default function Contra() {
  const rows = useCollection("contras");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JournalRowFull | null>(null);
  const [toDelete, setToDelete] = useState<JournalRowFull | null>(null);

  const columns: Column<JournalRowFull>[] = [
    { key: "number", header: "Voucher #", cell: (r) => <span className="font-medium">{r.number}</span> },
    { key: "date", header: "Date", cell: (r) => r.date },
    { key: "narration", header: "Movement", cell: (r) => r.narration },
    { key: "amount", header: "Amount", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatINR(r.amount)}</span> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <RowActions onEdit={() => { setEditing(r); setOpen(true); }} onDelete={() => setToDelete(r)} />
    ) },
  ];

  return (
    <div>
      <PageHeader
        title="Contra Entries"
        subtitle="Cash ↔ Bank and Bank ↔ Bank movements."
        actions={<>
          <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />New Contra
          </Button>
        </>}
      />
      <SectionCard>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} empty="No contras yet." />
      </SectionCard>
      <ContraForm open={open} onOpenChange={setOpen} initial={editing} />
      <ConfirmDelete open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.number}?`}
        onConfirm={() => { if (toDelete) { remove("contras", toDelete.id); toast.success(`${toDelete.number} deleted`); } setToDelete(null); }} />
    </div>
  );
}
