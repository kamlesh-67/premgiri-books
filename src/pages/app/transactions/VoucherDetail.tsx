import { ArrowLeft, Printer, Pencil } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { formatINR } from "@/lib/format";
import { recentVouchers } from "@/lib/mockData";

export default function VoucherDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const v = recentVouchers.find((r) => r.id === id) ?? recentVouchers[0];

  return (
    <div>
      <PageHeader
        title={`Voucher ${v.number}`}
        subtitle={`${v.type} • ${v.party}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            <Button variant="outline" size="sm"><Printer className="mr-2 h-4 w-4" />Print</Button>
            <Button size="sm"><Pencil className="mr-2 h-4 w-4" />Edit</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Details">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-xs text-muted-foreground">Voucher #</dt><dd className="mt-0.5 font-medium">{v.number}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Date</dt><dd className="mt-0.5 font-medium">{v.date}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Type</dt><dd className="mt-0.5 font-medium">{v.type}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Party</dt><dd className="mt-0.5 font-medium">{v.party}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-0.5"><StatusBadge status={v.status} /></dd></div>
              <div><dt className="text-xs text-muted-foreground">Amount</dt><dd className="mt-0.5 text-lg font-bold tabular-nums">{formatINR(v.amount)}</dd></div>
            </dl>
          </SectionCard>

          <SectionCard title="Journal lines">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left">Account</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border"><td className="px-3 py-2.5">{v.party}</td><td className="px-3 py-2.5 text-right tabular-nums">{formatINR(v.amount)}</td><td className="px-3 py-2.5 text-right">—</td></tr>
                <tr className="border-t border-border"><td className="px-3 py-2.5">Sales — Paints</td><td className="px-3 py-2.5 text-right">—</td><td className="px-3 py-2.5 text-right tabular-nums">{formatINR(v.amount * 0.847)}</td></tr>
                <tr className="border-t border-border"><td className="px-3 py-2.5">CGST Output</td><td className="px-3 py-2.5 text-right">—</td><td className="px-3 py-2.5 text-right tabular-nums">{formatINR(v.amount * 0.0765)}</td></tr>
                <tr className="border-t border-border"><td className="px-3 py-2.5">SGST Output</td><td className="px-3 py-2.5 text-right">—</td><td className="px-3 py-2.5 text-right tabular-nums">{formatINR(v.amount * 0.0765)}</td></tr>
              </tbody>
            </table>
          </SectionCard>
        </div>
        <SectionCard title="Activity">
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-success" /><div><p className="font-medium">Posted</p><p className="text-xs text-muted-foreground">{v.date} • Rajesh K.</p></div></li>
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-info" /><div><p className="font-medium">Created</p><p className="text-xs text-muted-foreground">{v.date} • Rajesh K.</p></div></li>
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
