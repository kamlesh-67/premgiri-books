import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { formatINR } from "@/lib/format";
import { balanceSheet } from "@/lib/mockData";

function side(groups: { group: string; items: { name: string; value: number }[] }[]) {
  return groups.map((g) => {
    const total = g.items.reduce((a, i) => a + i.value, 0);
    return { ...g, total };
  });
}

export default function BalanceSheet() {
  const liab = side(balanceSheet.liabilities);
  const ass = side(balanceSheet.assets);
  const liabTotal = liab.reduce((a, g) => a + g.total, 0);
  const assTotal = ass.reduce((a, g) => a + g.total, 0);

  return (
    <div>
      <PageHeader title="Balance Sheet" subtitle="As at 30 April 2025 • FY 2024-25"
        actions={<><Button variant="outline" size="sm"><Printer className="mr-2 h-4 w-4" />Print</Button><Button size="sm"><Download className="mr-2 h-4 w-4" />PDF</Button></>} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Liabilities">
          {liab.map((g) => (
            <div key={g.group} className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.group}</p>
              {g.items.map((i) => (
                <div key={i.name} className="flex justify-between py-1.5 text-sm">
                  <span>{i.name}</span><span className="tabular-nums">{formatINR(i.value)}</span>
                </div>
              ))}
              <div className="mt-1 flex justify-between border-t border-border pt-2 text-sm font-semibold">
                <span>{g.group} total</span><span className="tabular-nums">{formatINR(g.total)}</span>
              </div>
            </div>
          ))}
          <div className="mt-4 flex justify-between rounded-md bg-primary-soft px-3 py-2 text-sm font-bold text-primary">
            <span>TOTAL LIABILITIES</span><span className="tabular-nums">{formatINR(liabTotal)}</span>
          </div>
        </SectionCard>
        <SectionCard title="Assets">
          {ass.map((g) => (
            <div key={g.group} className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.group}</p>
              {g.items.map((i) => (
                <div key={i.name} className="flex justify-between py-1.5 text-sm">
                  <span>{i.name}</span><span className="tabular-nums">{formatINR(i.value)}</span>
                </div>
              ))}
              <div className="mt-1 flex justify-between border-t border-border pt-2 text-sm font-semibold">
                <span>{g.group} total</span><span className="tabular-nums">{formatINR(g.total)}</span>
              </div>
            </div>
          ))}
          <div className="mt-4 flex justify-between rounded-md bg-primary-soft px-3 py-2 text-sm font-bold text-primary">
            <span>TOTAL ASSETS</span><span className="tabular-nums">{formatINR(assTotal)}</span>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
