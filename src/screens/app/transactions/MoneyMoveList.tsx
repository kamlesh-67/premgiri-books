import { useState } from "react";
import { Plus, Download } from "lucide-react";
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
import { useCollection, remove, type CollectionMap } from "@/lib/mockStore";
import { MoneyMoveForm } from "./forms/MoneyMoveForm";

type Kind = "receipts" | "payments";
type Row = CollectionMap[Kind];

interface Props {
  title: string;
  subtitle: string;
  partyLabel: string;
  kind: Kind;
}

export function MoneyMoveList({ title, subtitle, partyLabel, kind }: Props) {
  const rows = useCollection(kind);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [toDelete, setToDelete] = useState<Row | null>(null);

  const filtered = rows.filter((r) =>
    !query ? true : (r.number + " " + r.party + " " + (r.reference ?? "")).toLowerCase().includes(query.toLowerCase()),
  );

  const columns: Column<Row>[] = [
    { key: "number", header: "Voucher #", cell: (r) => <span className="font-medium">{r.number}</span> },
    { key: "date", header: "Date", cell: (r) => r.date },
    { key: "party", header: partyLabel, cell: (r) => r.party },
    { key: "mode", header: "Mode", cell: (r) => <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{r.mode}</span> },
    { key: "reference", header: "Reference", cell: (r) => r.reference ?? "—" },
    { key: "amount", header: "Amount", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatINR(r.amount)}</span> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <RowActions onEdit={() => { setEditing(r); setOpen(true); }} onDelete={() => setToDelete(r)} />
    ) },
  ];

  const total = filtered.reduce((a, r) => a + r.amount, 0);

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>
            <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />New Entry
            </Button>
          </>
        }
      />
      <SectionCard>
        <Toolbar searchPlaceholder="Search voucher #, party, reference…" onSearchChange={setQuery}>
          <select className="h-9 rounded-md border border-border bg-surface px-3 text-sm"><option>All modes</option><option>Cash</option><option>Bank</option><option>UPI</option><option>Cheque</option></select>
        </Toolbar>
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          empty="No entries yet — click New Entry."
          footer={
            <tr>
              <td colSpan={5} className="px-4 py-3 text-right text-muted-foreground">Total</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatINR(total)}</td>
              <td colSpan={2} />
            </tr>
          }
        />
      </SectionCard>
      <MoneyMoveForm open={open} onOpenChange={setOpen} kind={kind} initial={editing} />
      <ConfirmDelete open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.number}?`}
        onConfirm={() => { if (toDelete) { remove(kind, toDelete.id); toast.success(`${toDelete.number} deleted`); } setToDelete(null); }} />
    </div>
  );
}
