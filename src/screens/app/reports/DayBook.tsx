import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { formatINR } from "@/lib/format";
import { dayBook } from "@/lib/mockData";
const cols: Column<typeof dayBook[number]>[] = [
  { key: "time", header: "Time", cell: (r) => r.time },
  { key: "voucher", header: "Voucher", cell: (r) => <span className="font-medium">{r.voucher}</span> },
  { key: "type", header: "Type", cell: (r) => <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{r.type}</span> },
  { key: "party", header: "Account / Narration", cell: (r) => r.party },
  { key: "debit", header: "Debit", align: "right", cell: (r) => r.debit ? <span className="tabular-nums">{formatINR(r.debit)}</span> : "—" },
  { key: "credit", header: "Credit", align: "right", cell: (r) => r.credit ? <span className="tabular-nums">{formatINR(r.credit)}</span> : "—" },
];
export default function DayBook() {
  return (
    <div>
      <PageHeader title="Day Book" subtitle="All vouchers posted on 30 April 2025"
        actions={<Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>} />
      <SectionCard><DataTable columns={cols} rows={dayBook} rowKey={(r) => r.voucher} /></SectionCard>
    </div>
  );
}
