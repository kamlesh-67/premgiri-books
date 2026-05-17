import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { formatINR } from "@/lib/format";
import { profitLoss } from "@/lib/mockData";

export default function ProfitLoss() {
  const incomeTotal = profitLoss.income.reduce((a, r) => a + r.value, 0);
  const expenseTotal = profitLoss.expenses.reduce((a, r) => a + r.value, 0);
  const netProfit = incomeTotal - expenseTotal;
  return (
    <div>
      <PageHeader title="Profit & Loss" subtitle="01 April 2024 to 30 April 2025"
        actions={<Button size="sm"><Download className="mr-2 h-4 w-4" />PDF</Button>} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Expenses">
          {profitLoss.expenses.map((r) => (
            <div key={r.name} className="flex justify-between py-1.5 text-sm">
              <span>{r.name}</span><span className="tabular-nums">{formatINR(r.value)}</span>
            </div>
          ))}
          <div className="mt-3 flex justify-between border-t border-border pt-2 text-sm font-semibold">
            <span>Total expenses</span><span className="tabular-nums">{formatINR(expenseTotal)}</span>
          </div>
          <div className="mt-3 flex justify-between rounded-md bg-success-soft px-3 py-2 text-sm font-bold text-success">
            <span>Net Profit</span><span className="tabular-nums">{formatINR(netProfit)}</span>
          </div>
        </SectionCard>
        <SectionCard title="Income">
          {profitLoss.income.map((r) => (
            <div key={r.name} className="flex justify-between py-1.5 text-sm">
              <span>{r.name}</span><span className="tabular-nums">{formatINR(r.value)}</span>
            </div>
          ))}
          <div className="mt-3 flex justify-between border-t border-border pt-2 text-sm font-semibold">
            <span>Total income</span><span className="tabular-nums">{formatINR(incomeTotal)}</span>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
