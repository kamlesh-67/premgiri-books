import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { formatINR } from "@/lib/format";
import { stockAgeing } from "@/lib/mockData";

const cols: Column<typeof stockAgeing[number]>[] = [
  { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
  { key: "name", header: "Item", cell: (r) => <span className="font-medium">{r.name}</span> },
  { key: "b0_30", header: "0-30 days", align: "right", cell: (r) => r.b0_30 },
  { key: "b31_60", header: "31-60 days", align: "right", cell: (r) => r.b31_60 },
  { key: "b61_90", header: "61-90 days", align: "right", cell: (r) => r.b61_90 },
  { key: "b90", header: ">90 days", align: "right", cell: (r) => <span className={r.b90 > 0 ? "font-semibold text-warning" : ""}>{r.b90}</span> },
  { key: "value", header: "Value", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.value)}</span> },
];

export default function StockAgeing() {
  return (
    <div>
      <PageHeader title="Stock Ageing" subtitle="How long inventory has been on the shelf."
        actions={<Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>} />
      <SectionCard><DataTable columns={cols} rows={stockAgeing} rowKey={(r) => r.code} /></SectionCard>
    </div>
  );
}
