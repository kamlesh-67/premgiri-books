import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FormDialog } from "@/components/primitives/FormDialog";
import { FormField } from "@/components/primitives/FormField";
import { TextInput, NumberInput } from "@/components/primitives/FormControls";
import { Button } from "@/components/ui/button";
import { journalSchema } from "@/lib/schemas";
import {
  add, update, useCollection, nextJournalNumber, newId,
  type JournalRowFull,
} from "@/lib/mockStore";
import { formatINR } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: JournalRowFull | null;
}

interface Line { id: number; account: string; debit: number; credit: number }

export function JournalForm({ open, onOpenChange, initial }: Props) {
  const isEdit = !!initial;
  const ledgers = useCollection("ledgers");
  const [date, setDate] = useState("");
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (initial) {
      setDate(initial.date);
      setNarration(initial.narration);
      setLines(initial.lines ?? [
        { id: 1, account: ledgers[0]?.name ?? "", debit: initial.amount, credit: 0 },
        { id: 2, account: ledgers[1]?.name ?? "", debit: 0, credit: initial.amount },
      ]);
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setNarration("");
      setLines([
        { id: 1, account: ledgers[0]?.name ?? "", debit: 0, credit: 0 },
        { id: 2, account: ledgers[1]?.name ?? "", debit: 0, credit: 0 },
      ]);
    }
  }, [open, initial, ledgers]);

  const totalDebit = lines.reduce((a, l) => a + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((a, l) => a + Number(l.credit || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const updateLine = (id: number, patch: Partial<Line>) =>
    setLines((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addLine = () => setLines((rows) => [...rows, { id: Date.now(), account: ledgers[0]?.name ?? "", debit: 0, credit: 0 }]);
  const removeLine = (id: number) => setLines((rows) => rows.filter((r) => r.id !== id));

  const onSubmit = async () => {
    const parsed = journalSchema.safeParse({ date, narration, lines });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) fe[i.path.join(".")] = i.message;
      setErrors(fe);
      toast.error(Object.values(fe)[0] ?? "Fix errors");
      return;
    }
    setErrors({});
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 250));
    const amount = totalDebit;
    if (isEdit) {
      update("journals", initial!.id, { date, narration, amount, lines });
      toast.success(`${initial!.number} updated`);
    } else {
      const number = nextJournalNumber();
      const row: JournalRowFull = { id: newId(), number, date, narration, amount, status: "POSTED", lines };
      add("journals", row);
      toast.success(`${number} posted`);
    }
    setSubmitting(false);
    onOpenChange(false);
  };

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} size="xl"
      title={isEdit ? `Edit ${initial?.number}` : "New Journal Entry"}
      description="Manual debit / credit adjustment. Debits must equal credits."
      onSubmit={onSubmit} submitting={submitting} submitLabel={isEdit ? "Update" : "Post"}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <FormField label="Date" required error={errors.date}>
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
        <FormField label="Narration" required error={errors.narration} className="md:col-span-2">
          <TextInput value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Reason for adjustment" />
        </FormField>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium">Lines</span>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="mr-1 h-3 w-3" />Add line
          </Button>
        </div>
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Account</th>
                <th className="px-3 py-2 text-right w-32">Debit</th>
                <th className="px-3 py-2 text-right w-32">Credit</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-2 py-1.5">
                    <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={l.account} onChange={(e) => updateLine(l.id, { account: e.target.value })}>
                      {ledgers.map((g) => <option key={g.code} value={g.name}>{g.name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5"><NumberInput step="0.01" value={l.debit} onChange={(e) => updateLine(l.id, { debit: Number(e.target.value), credit: 0 })} /></td>
                  <td className="px-2 py-1.5"><NumberInput step="0.01" value={l.credit} onChange={(e) => updateLine(l.id, { credit: Number(e.target.value), debit: 0 })} /></td>
                  <td className="px-2 text-right">
                    <button type="button" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive" onClick={() => removeLine(l.id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/40 text-sm font-semibold">
              <tr>
                <td className="px-3 py-2 text-right text-muted-foreground">Totals</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatINR(totalDebit)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatINR(totalCredit)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className={`mt-2 text-xs ${balanced ? "text-success" : "text-destructive"}`}>
          {balanced ? "✓ Balanced" : `Out of balance by ${formatINR(Math.abs(totalDebit - totalCredit))}`}
        </p>
        {errors.lines && <p className="mt-1 text-xs text-destructive">{errors.lines}</p>}
      </div>
    </FormDialog>
  );
}
