import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { RowActions } from "@/components/primitives/RowActions";
import { ConfirmDelete } from "@/components/primitives/ConfirmDelete";
import { formatINR } from "@/lib/format";
import { useCollection, remove, type EmployeeRow } from "@/lib/mockStore";
import { EmployeeForm } from "./forms/EmployeeForm";

export default function Employees() {
  const rows = useCollection("employees");
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<EmployeeRow | null>(null);

  const cols: Column<EmployeeRow>[] = [
    { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: "name", header: "Name", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "designation", header: "Designation", cell: (r) => r.designation },
    { key: "department", header: "Department", cell: (r) => r.department },
    { key: "doj", header: "Date of joining", cell: (r) => r.doj },
    { key: "ctc", header: "CTC", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.ctc)}</span> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <RowActions onEdit={() => { setEditing(r); setOpen(true); }} onDelete={() => setToDelete(r)} />
    ) },
  ];

  return (
    <div>
      <PageHeader title="Employees" subtitle="Master records used by Payroll."
        actions={<Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />New Employee</Button>} />
      <SectionCard><DataTable columns={cols} rows={rows} rowKey={(r) => r.code} empty="No employees yet." /></SectionCard>
      <EmployeeForm open={open} onOpenChange={setOpen} initial={editing} />
      <ConfirmDelete open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.name}?`}
        onConfirm={() => { if (toDelete) { remove("employees", toDelete.code); toast.success(`${toDelete.name} removed`); } setToDelete(null); }} />
    </div>
  );
}
