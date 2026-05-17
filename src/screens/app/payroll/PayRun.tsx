import { Plus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { formatINR } from "@/lib/format";
import { payRuns } from "@/lib/mockData";
const cols: Column<typeof payRuns[number]>[] = [
  { key: "id", header: "Run ID", cell: (r) => <span className="font-mono text-xs">{r.id}</span> },
  { key: "period", header: "Period", cell: (r) => <span className="font-medium">{r.period}</span> },
  { key: "employees", header: "Employees", align: "right", cell: (r) => r.employees },
  { key: "gross", header: "Gross", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.gross)}</span> },
  { key: "deductions", header: "Deductions", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.deductions)}</span> },
  { key: "net", header: "Net Pay", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatINR(r.net)}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "actions", header: "", align: "right", cell: () => <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><Eye className="h-4 w-4" /></button> },
];
export default function PayRun() {
  return (
    <div>
      <PageHeader title="Pay Run" subtitle="Monthly payroll processing and payout register." actions={<Button size="sm"><Plus className="mr-2 h-4 w-4" />New Pay Run</Button>} />
      <SectionCard><DataTable columns={cols} rows={payRuns} rowKey={(r) => r.id} /></SectionCard>
    </div>
  );
}
