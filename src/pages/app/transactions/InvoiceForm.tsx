import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Save, FileCheck2, ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { formatINR } from "@/lib/format";
import {
  add, update, findById, useCollection,
  nextSalesInvoiceNumber, nextPurchaseInvoiceNumber, newId,
  type InvoiceRowFull, type InvoiceLine,
} from "@/lib/mockStore";
import { invoiceSchema } from "@/lib/schemas";

interface InvoiceFormProps {
  mode: "sales" | "purchase";
}

export default function InvoiceForm({ mode }: InvoiceFormProps) {
  const navigate = useNavigate();
  const params = useParams();
  const isSales = mode === "sales";
  const collectionKey = isSales ? "salesInvoices" : "purchaseInvoices";
  const parties = useCollection("parties");
  const stockItems = useCollection("stockItems");

  const editId = params.id;
  const existing = editId ? (findById(collectionKey, editId) as InvoiceRowFull | undefined) : undefined;
  const isEdit = !!existing;

  const partyOptions = parties
    .filter((p) => (isSales ? p.type === "Customer" : p.type === "Supplier"))
    .map((p) => p.name);

  const [number] = useState(existing?.number ?? (isSales ? nextSalesInvoiceNumber() : nextPurchaseInvoiceNumber()));
  const [date, setDate] = useState(existing?.date ?? new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? "");
  const [party, setParty] = useState(existing?.party ?? partyOptions[0] ?? "");
  const [placeOfSupply, setPlaceOfSupply] = useState(existing?.placeOfSupply ?? "Maharashtra (27)");
  const [reference, setReference] = useState(existing?.reference ?? "");
  const [paymentTerms, setPaymentTerms] = useState(existing?.paymentTerms ?? "Net 30");
  const [paymentMode, setPaymentMode] = useState(existing?.mode ?? "Credit");
  const [narration, setNarration] = useState(existing?.narration ?? "");
  const [lines, setLines] = useState<InvoiceLine[]>(
    existing?.lines ?? [
      { id: 1, item: stockItems[0]?.name ?? "Asian Apex Ultima White 20L", hsn: stockItems[0]?.hsn ?? "3209", qty: 4, rate: stockItems[0]?.rate ?? 4250, gstPct: stockItems[0]?.gst ?? 18 },
      { id: 2, item: stockItems[1]?.name ?? "Primer Wall 10L", hsn: stockItems[1]?.hsn ?? "3208", qty: 6, rate: stockItems[1]?.rate ?? 980, gstPct: stockItems[1]?.gst ?? 18 },
    ],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Default party when list loads after first render
  useEffect(() => { if (!party && partyOptions[0]) setParty(partyOptions[0]); }, [party, partyOptions]);

  const totals = useMemo(() => {
    const sub = lines.reduce((a, l) => a + l.qty * l.rate, 0);
    const gst = lines.reduce((a, l) => a + (l.qty * l.rate * l.gstPct) / 100, 0);
    const cgst = gst / 2;
    const sgst = gst / 2;
    const round = Math.round((sub + gst) * 100) / 100;
    return { sub, gst, cgst, sgst, total: round };
  }, [lines]);

  const updateLine = (id: number, patch: Partial<InvoiceLine>) =>
    setLines((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addLine = () =>
    setLines((rows) => [...rows, { id: Date.now(), item: "", hsn: "", qty: 1, rate: 0, gstPct: 18 }]);

  const removeLine = (id: number) => setLines((rows) => rows.filter((r) => r.id !== id));

  const handleSave = async (status: "POSTED" | "DRAFT") => {
    const payload = {
      number, date, party, placeOfSupply, reference, dueDate, paymentTerms, mode: paymentMode, narration, lines,
    };
    const parsed = invoiceSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      toast.error(fieldErrors[Object.keys(fieldErrors)[0]] ?? "Please fix the errors below");
      return;
    }
    setErrors({});
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 300));

    const row: InvoiceRowFull = {
      id: existing?.id ?? newId(),
      number, date, party,
      taxable: totals.sub,
      gst: totals.gst,
      total: totals.total,
      balance: totals.total,
      status,
      placeOfSupply, reference, dueDate, paymentTerms, mode: paymentMode, narration,
      lines,
    };
    if (isEdit) {
      update(collectionKey, row.id, row);
      toast.success(`${number} updated`);
    } else {
      add(collectionKey, row);
      toast.success(`${number} ${status === "POSTED" ? "posted" : "saved as draft"}`);
    }
    setSubmitting(false);
    navigate(isSales ? "/sales-invoice" : "/purchase-invoice");
  };

  return (
    <div>
      <PageHeader
        title={isEdit ? `Edit ${isSales ? "Sales Invoice" : "Purchase Bill"}` : isSales ? "New Sales Invoice" : "New Purchase Bill"}
        subtitle={`${number}${isEdit ? "" : " (auto)"}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" />Cancel</Button>
            <Button variant="outline" size="sm" disabled={submitting} onClick={() => handleSave("DRAFT")}>
              <Save className="mr-2 h-4 w-4" />Save Draft
            </Button>
            <Button size="sm" disabled={submitting} onClick={() => handleSave("POSTED")}>
              <FileCheck2 className="mr-2 h-4 w-4" />{submitting ? "Saving…" : "Save & Post"}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Invoice details">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={isSales ? "Customer" : "Supplier"} required error={errors.party}>
                <select className="input" value={party} onChange={(e) => setParty(e.target.value)}>
                  {partyOptions.length === 0 && <option value="">— add a {isSales ? "customer" : "supplier"} first —</option>}
                  {partyOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Date" required error={errors.date}>
                <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Invoice number" required error={errors.number}>
                <input className="input" value={number} readOnly tabIndex={-1} />
              </Field>
              <Field label="Place of supply">
                <select className="input" value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)}>
                  <option>Maharashtra (27)</option>
                  <option>Karnataka (29)</option>
                  <option>Gujarat (24)</option>
                  <option>Tamil Nadu (33)</option>
                </select>
              </Field>
              <Field label="Reference">
                <input className="input" placeholder="PO #, DC #, etc." value={reference} onChange={(e) => setReference(e.target.value)} />
              </Field>
              <Field label="Due date">
                <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Line items"
            actions={<Button variant="outline" size="sm" onClick={addLine}><Plus className="mr-2 h-4 w-4" />Add line</Button>}
          >
            {errors.lines && <p className="mb-2 text-xs text-destructive">{errors.lines}</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-2 py-2 text-left">Item</th>
                    <th className="px-2 py-2 text-left w-24">HSN</th>
                    <th className="px-2 py-2 text-right w-20">Qty</th>
                    <th className="px-2 py-2 text-right w-28">Rate</th>
                    <th className="px-2 py-2 text-right w-20">GST%</th>
                    <th className="px-2 py-2 text-right w-32">Amount</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} className="border-b border-border">
                      <td className="px-2 py-2">
                        <input
                          className="input"
                          list={`stock-items-${l.id}`}
                          value={l.item}
                          onChange={(e) => {
                            const match = stockItems.find((s) => s.name === e.target.value);
                            if (match) updateLine(l.id, { item: match.name, hsn: match.hsn, rate: match.rate, gstPct: match.gst });
                            else updateLine(l.id, { item: e.target.value });
                          }}
                        />
                        <datalist id={`stock-items-${l.id}`}>
                          {stockItems.map((s) => <option key={s.code} value={s.name} />)}
                        </datalist>
                      </td>
                      <td className="px-2 py-2"><input className="input" value={l.hsn} onChange={(e) => updateLine(l.id, { hsn: e.target.value })} /></td>
                      <td className="px-2 py-2"><input type="number" className="input text-right tabular-nums" value={l.qty} onChange={(e) => updateLine(l.id, { qty: Number(e.target.value) })} /></td>
                      <td className="px-2 py-2"><input type="number" className="input text-right tabular-nums" value={l.rate} onChange={(e) => updateLine(l.id, { rate: Number(e.target.value) })} /></td>
                      <td className="px-2 py-2"><input type="number" className="input text-right tabular-nums" value={l.gstPct} onChange={(e) => updateLine(l.id, { gstPct: Number(e.target.value) })} /></td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatINR(l.qty * l.rate)}</td>
                      <td className="px-2 py-2 text-right">
                        <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive" onClick={() => removeLine(l.id)} aria-label="Remove">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Narration">
            <textarea className="input min-h-[80px]" placeholder="Optional narration / notes printed on invoice…" value={narration} onChange={(e) => setNarration(e.target.value)} />
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Bill summary">
            <SummaryRow label="Subtotal" value={formatINR(totals.sub)} />
            <SummaryRow label="CGST" value={formatINR(totals.cgst)} />
            <SummaryRow label="SGST" value={formatINR(totals.sgst)} />
            <div className="my-3 border-t border-border" />
            <SummaryRow label="Grand Total" value={formatINR(totals.total)} bold />
            <div className="my-3 border-t border-border" />
            <SummaryRow label="Amount paid" value={formatINR(0)} muted />
            <SummaryRow label="Balance due" value={formatINR(totals.total)} bold accent />
          </SectionCard>

          <SectionCard title="Payment & terms">
            <Field label="Payment terms">
              <select className="input" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}>
                <option>Net 30</option><option>Net 15</option><option>Due on receipt</option>
              </select>
            </Field>
            <Field label="Mode">
              <select className="input" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                <option>Credit</option><option>Cash</option><option>UPI</option><option>Bank Transfer</option>
              </select>
            </Field>
          </SectionCard>
        </div>
      </div>

      <style>{`.input{width:100%;height:36px;border:1px solid hsl(var(--border));background:hsl(var(--surface));border-radius:6px;padding:0 10px;font-size:13px;color:hsl(var(--foreground));outline:none}
      .input:focus{border-color:hsl(var(--primary));box-shadow:0 0 0 3px hsl(var(--primary)/0.18)}`}</style>
    </div>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

function SummaryRow({ label, value, bold, accent, muted }: { label: string; value: string; bold?: boolean; accent?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className={muted ? "text-muted-foreground" : "text-foreground"}>{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold" : ""} ${accent ? "text-primary" : ""}`}>{value}</span>
    </div>
  );
}
