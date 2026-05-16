import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormDialog } from "@/components/primitives/FormDialog";
import { FormField } from "@/components/primitives/FormField";
import { TextInput, NumberInput, SelectInput, TextAreaInput } from "@/components/primitives/FormControls";
import { contraSchema, type ContraInput } from "@/lib/schemas";
import {
  add, update, useCollection, nextContraNumber, newId,
  type JournalRowFull,
} from "@/lib/mockStore";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: JournalRowFull | null;
}

export function ContraForm({ open, onOpenChange, initial }: Props) {
  const isEdit = !!initial;
  const ledgers = useCollection("ledgers");
  const cashBank = ledgers.filter((l) => l.group === "Bank Accounts" || l.name.toLowerCase().includes("cash"));

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } =
    useForm<ContraInput>({ resolver: zodResolver(contraSchema) });

  useEffect(() => {
    if (!open) return;
    reset(initial
      ? { date: initial.date, fromAccount: initial.fromAccount ?? cashBank[0]?.name ?? "", toAccount: initial.toAccount ?? cashBank[1]?.name ?? "", amount: initial.amount, narration: initial.narration }
      : { date: new Date().toISOString().slice(0, 10), fromAccount: cashBank[0]?.name ?? "", toAccount: cashBank[1]?.name ?? "", amount: 0, narration: "" });
  }, [open, initial, reset, cashBank]);

  const from = watch("fromAccount");
  const to = watch("toAccount");

  const onSubmit = handleSubmit(async (values) => {
    if (values.fromAccount === values.toAccount) {
      toast.error("From and To accounts must differ");
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
    const narration = values.narration || `${values.fromAccount} → ${values.toAccount}`;
    if (isEdit) {
      update("contras", initial!.id, { date: values.date, narration, amount: Number(values.amount), fromAccount: values.fromAccount, toAccount: values.toAccount });
      toast.success(`${initial!.number} updated`);
    } else {
      const number = nextContraNumber();
      const row: JournalRowFull = {
        id: newId(), number, date: values.date, narration,
        amount: Number(values.amount), status: "POSTED",
        fromAccount: values.fromAccount, toAccount: values.toAccount,
      };
      add("contras", row);
      toast.success(`${number} posted`);
    }
    onOpenChange(false);
  });

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} size="md"
      title={isEdit ? `Edit ${initial?.number}` : "New Contra Entry"}
      description="Cash ↔ Bank or Bank ↔ Bank movement."
      onSubmit={onSubmit} submitting={isSubmitting} submitLabel={isEdit ? "Update" : "Post"}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Date" required error={errors.date?.message}>
          <TextInput type="date" {...register("date")} />
        </FormField>
        <FormField label="Amount (₹)" required error={errors.amount?.message}>
          <NumberInput step="0.01" {...register("amount")} />
        </FormField>
        <FormField label="From account" required error={errors.fromAccount?.message}>
          <SelectInput {...register("fromAccount")}>
            {cashBank.map((l) => <option key={l.code} value={l.name}>{l.name}</option>)}
          </SelectInput>
        </FormField>
        <FormField label="To account" required error={errors.toAccount?.message}
          hint={from && to && from === to ? "Must differ" : undefined}>
          <SelectInput {...register("toAccount")}>
            {cashBank.map((l) => <option key={l.code} value={l.name}>{l.name}</option>)}
          </SelectInput>
        </FormField>
        <FormField label="Narration" error={errors.narration?.message} className="md:col-span-2">
          <TextAreaInput rows={2} {...register("narration")} placeholder="Optional notes" />
        </FormField>
      </div>
    </FormDialog>
  );
}
