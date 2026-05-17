import { useNavigate, useParams } from "react-router-dom";
import { Download, Printer, Pencil, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { formatINR } from "@/lib/format";
import { useCollection } from "@/lib/mockStore";

export default function SalesInvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const list = useCollection("salesInvoices");
  const inv = list.find((r) => r.id === id) ?? list[0];
  if (!inv) {
    return <div className="p-6 text-sm text-muted-foreground">Invoice not found.</div>;
  }
  const lines = inv.lines ?? [];
  const sub = inv.taxable;
  const cgst = inv.gst / 2;
  const sgst = inv.gst / 2;
  return (
    <div>
      <PageHeader
        title={`Invoice ${inv.number}`}
        subtitle={`Sales Invoice — ${inv.party}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            <Button variant="outline" size="sm"><Printer className="mr-2 h-4 w-4" />Print</Button>
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />PDF</Button>
            <Button size="sm" onClick={() => navigate(`/sales-invoice/${inv.id}/edit`)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">Tax Invoice</h3>
                <p className="text-sm text-muted-foreground">Original for Recipient</p>
              </div>
              <StatusBadge status={inv.status} />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">From</p>
                <p className="mt-1 font-semibold">Baba Premgiri Paints Pvt. Ltd.</p>
                <p className="text-muted-foreground">Plot 18, MIDC Bhiwandi</p>
                <p className="text-muted-foreground">GSTIN: 27AABCB1234M1Z3</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Bill to</p>
                <p className="mt-1 font-semibold">{inv.party}</p>
                <p className="text-muted-foreground">{inv.placeOfSupply ?? "—"}</p>
                <p className="text-muted-foreground">Date: {inv.date}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Line items">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-left">HSN</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  <th className="px-3 py-2 text-right">GST%</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No line items recorded.</td></tr>
                ) : lines.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-3 py-2.5">{l.item}</td>
                    <td className="px-3 py-2.5">{l.hsn}</td>
                    <td className="px-3 py-2.5 text-right">{l.qty}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatINR(l.rate)}</td>
                    <td className="px-3 py-2.5 text-right">{l.gstPct}%</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatINR(l.qty * l.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Summary">
            <Row label="Subtotal" value={formatINR(sub)} />
            <Row label="CGST" value={formatINR(cgst)} />
            <Row label="SGST" value={formatINR(sgst)} />
            <div className="my-2 border-t border-border" />
            <Row label="Grand Total" value={formatINR(inv.total)} bold />
            <Row label="Amount paid" value={formatINR(inv.total - inv.balance)} muted />
            <Row label="Balance due" value={formatINR(inv.balance)} bold accent />
          </SectionCard>
          <SectionCard title="Activity">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-success" /><div><p className="font-medium">Invoice posted</p><p className="text-xs text-muted-foreground">Today, 10:14 AM • Rajesh K.</p></div></li>
              <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-info" /><div><p className="font-medium">e-Invoice generated</p><p className="text-xs text-muted-foreground">Today, 10:15 AM</p></div></li>
              <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-info" /><div><p className="font-medium">e-Way Bill issued</p><p className="text-xs text-muted-foreground">Today, 10:18 AM</p></div></li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, accent, muted }: { label: string; value: string; bold?: boolean; accent?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold" : ""} ${accent ? "text-primary" : ""}`}>{value}</span>
    </div>
  );
}
