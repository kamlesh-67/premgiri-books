import { Pencil } from "lucide-react";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { numberSeries } from "@/lib/mockData";

const cols: Column<typeof numberSeries[number]>[] = [
  { key: "type", header: "Voucher type", cell: (r) => <span className="font-medium">{r.type}</span> },
  { key: "prefix", header: "Prefix", cell: (r) => <span className="font-mono text-xs">{r.prefix}</span> },
  { key: "padding", header: "Padding", align: "right", cell: (r) => r.padding },
  { key: "next", header: "Next #", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{r.next}</span> },
  { key: "sample", header: "Sample", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.sample}</span> },
  { key: "actions", header: "", align: "right", cell: () => <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><Pencil className="h-4 w-4" /></button> },
];

export default function NumberSeries() {
  return (
    <div>
      <PageHeader title="Number Series" subtitle="Per voucher-type sequencing rules." />
      <SectionCard><DataTable columns={cols} rows={numberSeries} rowKey={(r) => r.type} /></SectionCard>
    </div>
  );
}
