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
import { useCollection, remove, type PartyRow } from "@/lib/mockStore";
import { PartyForm } from "./forms/PartyForm";

export default function Parties() {
  const rows = useCollection("parties");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");
  const [editing, setEditing] = useState<PartyRow | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<PartyRow | null>(null);

  const filtered = rows.filter((r) => {
    if (type !== "All" && r.type !== type) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.gstin.toLowerCase().includes(q) || r.phone.includes(q);
  });

  const cols: Column<PartyRow>[] = [
    { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: "name", header: "Party", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "type", header: "Type", cell: (r) => <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{r.type}</span> },
    { key: "gstin", header: "GSTIN", cell: (r) => <span className="font-mono text-xs">{r.gstin}</span> },
    { key: "state", header: "State", cell: (r) => r.state },
    { key: "phone", header: "Phone", cell: (r) => r.phone },
    { key: "outstanding", header: "Outstanding", align: "right", cell: (r) => <span className={`font-semibold tabular-nums ${r.outstanding > 0 ? "text-warning" : r.outstanding < 0 ? "text-destructive" : ""}`}>{formatINR(r.outstanding)}</span> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <RowActions
        onEdit={() => { setEditing(r); setOpen(true); }}
        onDelete={() => setToDelete(r)}
      />
    ) },
  ];

  return (
    <div>
      <PageHeader title="Parties — Customers & Suppliers" subtitle="All counterparties with GST and ledger details."
        actions={<>
          <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />New Party</Button>
        </>} />
      <SectionCard>
        <Toolbar searchPlaceholder="Search party, GSTIN, phone…" onSearchChange={setQuery}>
          <select value={type} onChange={(e) => setType(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-3 text-sm">
            <option value="All">All types</option><option>Customer</option><option>Supplier</option>
          </select>
        </Toolbar>
        <DataTable columns={cols} rows={filtered} rowKey={(r) => r.code} empty="No parties yet — click New Party." />
      </SectionCard>

      <PartyForm open={open} onOpenChange={setOpen} initial={editing} />
      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.name}?`}
        description="The party will be removed from the master list."
        onConfirm={() => {
          if (toDelete) { remove("parties", toDelete.code); toast.success(`${toDelete.name} deleted`); }
          setToDelete(null);
        }}
      />
    </div>
  );
}
