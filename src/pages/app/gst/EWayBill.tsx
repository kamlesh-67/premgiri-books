import { Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { ewayBills } from "@/lib/mockData";

const cols: Column<typeof ewayBills[number]>[] = [
  { key: "ewb", header: "EWB #", cell: (r) => <span className="font-mono text-xs font-medium">{r.ewb}</span> },
  { key: "invoice", header: "Invoice", cell: (r) => r.invoice },
  { key: "date", header: "Date", cell: (r) => r.date },
  { key: "from", header: "From → To", cell: (r) => <span>{r.from} <span className="text-muted-foreground">→</span> {r.to}</span> },
  { key: "distance", header: "Distance", align: "right", cell: (r) => `${r.distance} km` },
  { key: "valid", header: "Valid till", cell: (r) => r.valid },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} variant={r.status === "ACTIVE" ? "posted" : "cancelled"} /> },
];

export default function EWayBill() {
  return (
    <div>
      <PageHeader
        title="e-Way Bills"
        subtitle="Goods movement >₹50,000 require e-Way Bill from EWB portal."
        actions={<><Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button><Button size="sm"><Plus className="mr-2 h-4 w-4" />New EWB</Button></>}
      />
      <SectionCard><DataTable columns={cols} rows={ewayBills} rowKey={(r) => r.ewb} /></SectionCard>
    </div>
  );
}
