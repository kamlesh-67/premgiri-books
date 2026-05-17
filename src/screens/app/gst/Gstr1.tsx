import { Download, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { KpiCard } from "@/components/primitives/KpiCard";
import { formatINR } from "@/lib/format";
import { gstr1B2B } from "@/lib/mockData";
import { FileText, IndianRupee, Users, Calendar } from "lucide-react";

const cols: Column<typeof gstr1B2B[number]>[] = [
  { key: "gstin", header: "GSTIN", cell: (r) => <span className="font-mono text-xs">{r.gstin}</span> },
  { key: "party", header: "Party", cell: (r) => r.party },
  { key: "invoice", header: "Invoice #", cell: (r) => r.invoice },
  { key: "date", header: "Date", cell: (r) => r.date },
  { key: "taxable", header: "Taxable", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.taxable)}</span> },
  { key: "igst", header: "IGST", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.igst)}</span> },
  { key: "cgst", header: "CGST", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.cgst)}</span> },
  { key: "sgst", header: "SGST", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(r.sgst)}</span> },
  { key: "total", header: "Total", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatINR(r.total)}</span> },
];

export default function Gstr1() {
  const t = gstr1B2B.reduce((a, r) => ({ taxable: a.taxable + r.taxable, igst: a.igst + r.igst, cgst: a.cgst + r.cgst, sgst: a.sgst + r.sgst, total: a.total + r.total }), { taxable: 0, igst: 0, cgst: 0, sgst: 0, total: 0 });
  return (
    <div>
      <PageHeader
        title="GSTR-1 — Outward Supplies"
        subtitle="Period: April 2025 • Due: 11 May 2025"
        actions={<><Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Download JSON</Button><Button size="sm"><FileCheck2 className="mr-2 h-4 w-4" />File Return</Button></>}
      />
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="B2B Invoices" value={String(gstr1B2B.length)} icon={FileText} iconTone="primary" />
        <KpiCard title="Taxable Value" value={formatINR(t.taxable)} icon={IndianRupee} iconTone="success" />
        <KpiCard title="Tax Liability" value={formatINR(t.igst + t.cgst + t.sgst)} icon={IndianRupee} iconTone="warning" />
        <KpiCard title="Days to file" value="11" delta="Due 11 May" deltaTone="warning" icon={Calendar} iconTone="info" />
      </div>
      <SectionCard title="B2B Invoices (Table 4A)">
        <DataTable
          columns={cols}
          rows={gstr1B2B}
          rowKey={(r) => r.invoice}
          footer={
            <tr>
              <td colSpan={4} className="px-4 py-3 text-right text-muted-foreground">Total</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatINR(t.taxable)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatINR(t.igst)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatINR(t.cgst)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatINR(t.sgst)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatINR(t.total)}</td>
            </tr>
          }
        />
      </SectionCard>
    </div>
  );
}
