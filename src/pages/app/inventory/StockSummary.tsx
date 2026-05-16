import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { formatINR } from "@/lib/format";
import { stockSummary } from "@/lib/mockData";

const cols: Column<typeof stockSummary[number]>[] = [
  { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
  { key: "name", header: "Item", cell: (r) => <span className="font-medium">{r.name}</span> },
  { key: "category", header: "Category", cell: (r) => <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{r.category}</span> },
  { key: "inward", header: "Inward", align: "right", cell: (r) => r.inward },
  { key: "outward", header: "Outward", align: "right", cell: (r) => r.outward },
  { key: "closing", header: "Closing", align: "right", cell: (r) => <span className="font-semibold">{r.closing}</span> },
  { key: "value", header: "Value", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.value)}</span> },
];

export default function StockSummary() {
  const totalValue = stockSummary.reduce((a, r) => a + r.value, 0);
  return (
    <div>
      <PageHeader title="Stock Summary" subtitle="Movement and closing balance for the period."
        actions={<Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>} />
      <SectionCard>
        <DataTable
          columns={cols} rows={stockSummary} rowKey={(r) => r.code}
          footer={
            <tr><td colSpan={6} className="px-4 py-3 text-right text-muted-foreground">Total stock value</td><td className="px-4 py-3 text-right tabular-nums">{formatINR(totalValue)}</td></tr>
          }
        />
      </SectionCard>
    </div>
  );
}
