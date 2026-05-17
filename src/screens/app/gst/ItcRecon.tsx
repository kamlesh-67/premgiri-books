import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { KpiCard } from "@/components/primitives/KpiCard";
import { formatINR } from "@/lib/format";
import { itcRecon } from "@/lib/mockData";
import { CheckCircle2, AlertTriangle, FileX2 } from "lucide-react";

const cols: Column<typeof itcRecon[number]>[] = [
  { key: "gstin", header: "GSTIN", cell: (r) => <span className="font-mono text-xs">{r.gstin}</span> },
  { key: "supplier", header: "Supplier", cell: (r) => r.supplier },
  { key: "books", header: "Books", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.books)}</span> },
  { key: "gstr2b", header: "GSTR-2B", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.gstr2b)}</span> },
  { key: "diff", header: "Difference", align: "right", cell: (r) => <span className={`tabular-nums font-semibold ${r.diff !== 0 ? "text-destructive" : "text-success"}`}>{formatINR(r.diff)}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} variant={r.status === "MATCHED" ? "posted" : r.status === "MISMATCH" ? "due-soon" : "cancelled"} /> },
];

export default function ItcRecon() {
  const matched = itcRecon.filter((r) => r.status === "MATCHED").length;
  const mismatch = itcRecon.filter((r) => r.status !== "MATCHED").length;
  return (
    <div>
      <PageHeader
        title="ITC Reconciliation"
        subtitle="Match purchase ITC in books with GSTR-2B downloaded from GSTN."
        actions={<><Button variant="outline" size="sm"><RefreshCw className="mr-2 h-4 w-4" />Re-match</Button><Button size="sm"><Download className="mr-2 h-4 w-4" />Export</Button></>}
      />
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard title="Matched" value={String(matched)} icon={CheckCircle2} iconTone="success" />
        <KpiCard title="Mismatch / Missing" value={String(mismatch)} icon={AlertTriangle} iconTone="warning" />
        <KpiCard title="Net mismatch" value={formatINR(2635)} icon={FileX2} iconTone="destructive" />
      </div>
      <SectionCard title="Reconciliation results"><DataTable columns={cols} rows={itcRecon} rowKey={(r) => r.gstin} /></SectionCard>
    </div>
  );
}
