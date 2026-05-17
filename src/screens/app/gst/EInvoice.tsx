import { Download, RefreshCw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { formatINR } from "@/lib/format";
import { eInvoices } from "@/lib/mockData";

const cols: Column<typeof eInvoices[number]>[] = [
  { key: "invoice", header: "Invoice #", cell: (r) => <span className="font-medium">{r.invoice}</span> },
  { key: "date", header: "Date", cell: (r) => r.date },
  { key: "party", header: "Party", cell: (r) => r.party },
  { key: "irn", header: "IRN", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.irn}</span> },
  { key: "ack", header: "Ack #", cell: (r) => <span className="font-mono text-xs">{r.ackNo}</span> },
  { key: "total", header: "Total", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatINR(r.total)}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "actions", header: "", align: "right", cell: () => <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><Eye className="h-4 w-4" /></button> },
];

export default function EInvoice() {
  return (
    <div>
      <PageHeader
        title="e-Invoice"
        subtitle="IRN registration with NIC IRP for B2B invoices."
        actions={<><Button variant="outline" size="sm"><RefreshCw className="mr-2 h-4 w-4" />Sync IRP</Button><Button size="sm"><Download className="mr-2 h-4 w-4" />Bulk JSON</Button></>}
      />
      <SectionCard><DataTable columns={cols} rows={eInvoices} rowKey={(r) => r.invoice} /></SectionCard>
    </div>
  );
}
