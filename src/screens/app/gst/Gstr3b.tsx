import { Download, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { formatINR } from "@/lib/format";
import { gstr3bSummary } from "@/lib/mockData";

export default function Gstr3b() {
  return (
    <div>
      <PageHeader
        title="GSTR-3B — Monthly Summary"
        subtitle="Period: April 2025 • Due: 20 May 2025"
        actions={<><Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Download JSON</Button><Button size="sm"><FileCheck2 className="mr-2 h-4 w-4" />File Return</Button></>}
      />
      <SectionCard title="3.1 — Tax on outward and reverse charge inward supplies">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left">Nature of supply</th>
              <th className="px-3 py-2 text-right">Taxable</th>
              <th className="px-3 py-2 text-right">IGST</th>
              <th className="px-3 py-2 text-right">CGST</th>
              <th className="px-3 py-2 text-right">SGST</th>
            </tr>
          </thead>
          <tbody>
            {gstr3bSummary.map((r) => (
              <tr key={r.label} className="border-t border-border">
                <td className="px-3 py-2.5">{r.label}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatINR(r.taxable)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatINR(r.igst)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatINR(r.cgst)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatINR(r.sgst)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        <SectionCard title="Output Tax"><p className="text-2xl font-bold tabular-nums">{formatINR(208450)}</p><p className="mt-1 text-xs text-muted-foreground">Total liability</p></SectionCard>
        <SectionCard title="ITC Available"><p className="text-2xl font-bold tabular-nums">{formatINR(64217)}</p><p className="mt-1 text-xs text-muted-foreground">Net of reversals</p></SectionCard>
        <SectionCard title="Net Payable"><p className="text-2xl font-bold tabular-nums text-primary">{formatINR(144233)}</p><p className="mt-1 text-xs text-muted-foreground">After ITC offset</p></SectionCard>
      </div>
    </div>
  );
}
