import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { formatINR } from "@/lib/format";
import { bankRecon } from "@/lib/mockData";
const cols: Column<typeof bankRecon[number]>[] = [
  { key: "date", header: "Date", cell: (r) => r.date },
  { key: "description", header: "Description", cell: (r) => <span className="font-medium">{r.description}</span> },
  { key: "reference", header: "Reference", cell: (r) => <span className="font-mono text-xs">{r.reference}</span> },
  { key: "debit", header: "Debit", align: "right", cell: (r) => r.debit ? <span className="tabular-nums">{formatINR(r.debit)}</span> : "—" },
  { key: "credit", header: "Credit", align: "right", cell: (r) => r.credit ? <span className="tabular-nums text-success">{formatINR(r.credit)}</span> : "—" },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} variant={r.status === "MATCHED" ? "posted" : "draft"} /> },
];
export default function Reconciliation() {
  return (
    <div>
      <PageHeader title="Bank Reconciliation" subtitle="HDFC Bank — 4421 • Statement 01 Apr to 30 Apr"
        actions={<><Button variant="outline" size="sm"><RefreshCw className="mr-2 h-4 w-4" />Re-match</Button><Button size="sm"><Download className="mr-2 h-4 w-4" />Export</Button></>} />
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <SectionCard title="Bank balance"><p className="text-2xl font-bold tabular-nums">{formatINR(1015000)}</p></SectionCard>
        <SectionCard title="Books balance"><p className="text-2xl font-bold tabular-nums">{formatINR(947200)}</p></SectionCard>
        <SectionCard title="Difference"><p className="text-2xl font-bold tabular-nums text-warning">{formatINR(67800)}</p><p className="mt-1 text-xs text-muted-foreground">1 unreconciled item</p></SectionCard>
      </div>
      <SectionCard title="Statement"><DataTable columns={cols} rows={bankRecon} rowKey={(r) => r.reference} /></SectionCard>
    </div>
  );
}
