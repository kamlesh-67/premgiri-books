import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { attendance } from "@/lib/mockData";
const cols: Column<typeof attendance[number]>[] = [
  { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
  { key: "name", header: "Employee", cell: (r) => <span className="font-medium">{r.name}</span> },
  { key: "present", header: "Present", align: "right", cell: (r) => <span className="font-semibold text-success">{r.present}</span> },
  { key: "absent", header: "Absent", align: "right", cell: (r) => <span className={r.absent ? "text-destructive" : ""}>{r.absent}</span> },
  { key: "leave", header: "Leave", align: "right", cell: (r) => r.leave },
  { key: "ot", header: "OT (hrs)", align: "right", cell: (r) => r.ot },
];
export default function Attendance() {
  return (
    <div>
      <PageHeader title="Attendance — April 2025" subtitle="Attendance summary feeds into the monthly pay run."
        actions={<><Button variant="outline" size="sm"><Upload className="mr-2 h-4 w-4" />Import CSV</Button><Button size="sm"><Plus className="mr-2 h-4 w-4" />Mark Today</Button></>} />
      <SectionCard><DataTable columns={cols} rows={attendance} rowKey={(r) => r.code} /></SectionCard>
    </div>
  );
}
