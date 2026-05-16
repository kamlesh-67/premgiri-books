import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { KpiCard } from "@/components/primitives/KpiCard";
import { formatINR } from "@/lib/format";
import { outstanding } from "@/lib/mockData";
import { Clock, AlertTriangle, IndianRupee } from "lucide-react";

const cols: Column<typeof outstanding[number]>[] = [
  { key: "party", header: "Party", cell: (r) => <span className="font-medium">{r.party}</span> },
  { key: "invoice", header: "Invoice", cell: (r) => r.invoice },
  { key: "date", header: "Date", cell: (r) => r.date },
  { key: "days", header: "Age (days)", align: "right", cell: (r) => <span className={r.days > 60 ? "font-semibold text-destructive" : r.days > 30 ? "font-semibold text-warning" : ""}>{r.days}</span> },
  { key: "bucket", header: "Bucket", cell: (r) => <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{r.bucket}</span> },
  { key: "amount", header: "Amount", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatINR(r.amount)}</span> },
];

export default function Outstanding() {
  const total = outstanding.reduce((a, r) => a + r.amount, 0);
  const overdue = outstanding.filter((r) => r.days > 30).reduce((a, r) => a + r.amount, 0);
  return (
    <div>
      <PageHeader title="Outstanding Receivables" subtitle="Customer dues by ageing bucket."
        actions={<Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>} />
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard title="Total outstanding" value={formatINR(total)} icon={IndianRupee} iconTone="primary" />
        <KpiCard title="Overdue (>30d)" value={formatINR(overdue)} icon={AlertTriangle} iconTone="warning" />
        <KpiCard title="Open invoices" value={String(outstanding.length)} icon={Clock} iconTone="info" />
      </div>
      <SectionCard><DataTable columns={cols} rows={outstanding} rowKey={(r) => r.invoice} /></SectionCard>
    </div>
  );
}
