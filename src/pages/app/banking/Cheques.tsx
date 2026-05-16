import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { formatINR } from "@/lib/format";
import { cheques } from "@/lib/mockData";
const cols: Column<typeof cheques[number]>[] = [
  { key: "number", header: "Cheque #", cell: (r) => <span className="font-mono text-xs font-medium">{r.number}</span> },
  { key: "date", header: "Date", cell: (r) => r.date },
  { key: "party", header: "Party", cell: (r) => r.party },
  { key: "type", header: "Type", cell: (r) => <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{r.type}</span> },
  { key: "amount", header: "Amount", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatINR(r.amount)}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} variant={r.status === "CLEARED" ? "posted" : r.status === "PENDING" ? "draft" : "cancelled"} /> },
];
export default function Cheques() {
  return (
    <div>
      <PageHeader title="Cheque Register" subtitle="Issued and received cheques tracking." actions={<Button size="sm"><Plus className="mr-2 h-4 w-4" />New Cheque</Button>} />
      <SectionCard><DataTable columns={cols} rows={cheques} rowKey={(r) => r.number} /></SectionCard>
    </div>
  );
}
