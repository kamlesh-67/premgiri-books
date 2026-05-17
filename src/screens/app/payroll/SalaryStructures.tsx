import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { formatINR } from "@/lib/format";
import { salaryStructures } from "@/lib/mockData";
const cols: Column<typeof salaryStructures[number]>[] = [
  { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
  { key: "name", header: "Structure", cell: (r) => <span className="font-medium">{r.name}</span> },
  { key: "basic", header: "Basic", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.basic)}</span> },
  { key: "hra", header: "HRA", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.hra)}</span> },
  { key: "special", header: "Special", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.special)}</span> },
  { key: "gross", header: "Gross", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatINR(r.gross)}</span> },
  { key: "pf", header: "PF", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.pf)}</span> },
  { key: "esic", header: "ESIC", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.esic)}</span> },
  { key: "net", header: "Net", align: "right", cell: (r) => <span className="font-semibold tabular-nums text-primary">{formatINR(r.net)}</span> },
];
export default function SalaryStructures() {
  return (
    <div>
      <PageHeader title="Salary Structures" subtitle="Templates assigned to employees during pay run." actions={<Button size="sm"><Plus className="mr-2 h-4 w-4" />New Structure</Button>} />
      <SectionCard><DataTable columns={cols} rows={salaryStructures} rowKey={(r) => r.code} /></SectionCard>
    </div>
  );
}
