import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { Toolbar } from "@/components/primitives/Toolbar";
import { auditLog } from "@/lib/mockData";

const tone: Record<string, string> = {
  CREATE: "bg-success-soft text-success",
  POST: "bg-info-soft text-info",
  UPDATE: "bg-warning-soft text-warning",
  DELETE: "bg-destructive-soft text-destructive",
};

const cols: Column<typeof auditLog[number]>[] = [
  { key: "time", header: "Timestamp", cell: (r) => <span className="font-mono text-xs">{r.time}</span> },
  { key: "user", header: "User", cell: (r) => r.user },
  { key: "action", header: "Action", cell: (r) => <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase ${tone[r.action] ?? "bg-muted text-muted-foreground"}`}>{r.action}</span> },
  { key: "entity", header: "Entity", cell: (r) => r.entity },
  { key: "target", header: "Target", cell: (r) => <span className="font-mono text-xs">{r.target}</span> },
  { key: "ip", header: "IP", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.ip}</span> },
];

export default function AuditLog() {
  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Immutable trail of every change made in the system."
        actions={<Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>} />
      <SectionCard>
        <Toolbar searchPlaceholder="Search user, entity, action…" />
        <DataTable columns={cols} rows={auditLog} rowKey={(r) => r.time + r.target} />
      </SectionCard>
    </div>
  );
}
