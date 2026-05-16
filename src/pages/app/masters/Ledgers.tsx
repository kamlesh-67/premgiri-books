import { useState } from "react";
import { Plus, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { Toolbar } from "@/components/primitives/Toolbar";
import { RowActions } from "@/components/primitives/RowActions";
import { ConfirmDelete } from "@/components/primitives/ConfirmDelete";
import { formatINR } from "@/lib/format";
import { useCollection, remove, type LedgerRow } from "@/lib/mockStore";
import { LedgerForm } from "./forms/LedgerForm";

export default function Ledgers() {
  const rows = useCollection("ledgers");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<LedgerRow | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<LedgerRow | null>(null);

  const filtered = rows.filter((r) =>
    !query ? true : (r.name + " " + r.code + " " + r.group).toLowerCase().includes(query.toLowerCase()),
  );

  const cols: Column<LedgerRow>[] = [
    { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: "name", header: "Account", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "group", header: "Group", cell: (r) => <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{r.group}</span> },
    { key: "opening", header: "Opening", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.opening)}</span> },
    { key: "debit", header: "Debit", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.debit)}</span> },
    { key: "credit", header: "Credit", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.credit)}</span> },
    { key: "closing", header: "Closing", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatINR(r.closing)}</span> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <RowActions onEdit={() => { setEditing(r); setOpen(true); }} onDelete={() => setToDelete(r)} />
    ) },
  ];

  return (
    <div>
      <PageHeader title="Ledgers / Chart of Accounts" subtitle="All accounts grouped by class for the current FY."
        actions={<>
          <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />New Ledger</Button>
        </>} />
      <SectionCard>
        <Toolbar searchPlaceholder="Search ledger name, code…" onSearchChange={setQuery}>
          <select className="h-9 rounded-md border border-border bg-surface px-3 text-sm"><option>All groups</option></select>
        </Toolbar>
        <DataTable columns={cols} rows={filtered} rowKey={(r) => r.code} empty="No ledgers — click New Ledger." />
      </SectionCard>
      <LedgerForm open={open} onOpenChange={setOpen} initial={editing} />
      <ConfirmDelete open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.name}?`}
        onConfirm={() => { if (toDelete) { remove("ledgers", toDelete.code); toast.success(`${toDelete.name} deleted`); } setToDelete(null); }} />
    </div>
  );
}
