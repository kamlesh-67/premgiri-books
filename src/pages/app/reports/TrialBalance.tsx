import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { formatINR } from "@/lib/format";
import { ledgers } from "@/lib/mockData";

const rows = ledgers.map((l) => ({
  code: l.code, name: l.name,
  debit: l.closing > 0 ? l.closing : 0,
  credit: l.closing < 0 ? -l.closing : 0,
}));

const cols: Column<typeof rows[number]>[] = [
  { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
  { key: "name", header: "Account", cell: (r) => <span className="font-medium">{r.name}</span> },
  { key: "debit", header: "Debit", align: "right", cell: (r) => r.debit ? <span className="tabular-nums">{formatINR(r.debit)}</span> : "—" },
  { key: "credit", header: "Credit", align: "right", cell: (r) => r.credit ? <span className="tabular-nums">{formatINR(r.credit)}</span> : "—" },
];

export default function TrialBalance() {
  const tDebit = rows.reduce((a, r) => a + r.debit, 0);
  const tCredit = rows.reduce((a, r) => a + r.credit, 0);
  return (
    <div>
      <PageHeader title="Trial Balance" subtitle="Closing balances of all ledgers as on 30 April 2025"
        actions={<Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>} />
      <SectionCard>
        <DataTable
          columns={cols} rows={rows} rowKey={(r) => r.code}
          footer={
            <tr>
              <td colSpan={2} className="px-4 py-3 text-right text-muted-foreground">Total</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatINR(tDebit)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatINR(tCredit)}</td>
            </tr>
          }
        />
      </SectionCard>
    </div>
  );
}
