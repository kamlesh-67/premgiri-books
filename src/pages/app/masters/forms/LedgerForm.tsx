import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormDialog } from "@/components/primitives/FormDialog";
import { FormField } from "@/components/primitives/FormField";
import { TextInput, NumberInput, SelectInput } from "@/components/primitives/FormControls";
import { ledgerSchema, type LedgerInput } from "@/lib/schemas";
import { add, update, type LedgerRow } from "@/lib/mockStore";

const GROUPS = [
  "Current Assets", "Bank Accounts", "Fixed Assets", "Investments",
  "Current Liabilities", "Loans", "Capital Account",
  "Direct Income", "Indirect Income", "Direct Expense", "Indirect Expense",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: LedgerRow | null;
}

export function LedgerForm({ open, onOpenChange, initial }: Props) {
  const isEdit = !!initial;
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<LedgerInput>({ resolver: zodResolver(ledgerSchema) });

  useEffect(() => {
    if (!open) return;
    reset(initial ?? { code: "", name: "", group: "Current Assets", opening: 0, debit: 0, credit: 0, closing: 0 });
  }, [open, initial, reset]);

  const onSubmit = handleSubmit(async (values) => {
    await new Promise((r) => setTimeout(r, 200));
    const closing = Number(values.opening) + Number(values.debit) - Number(values.credit);
    const row = { ...values, closing } as LedgerRow;
    if (isEdit) { update("ledgers", initial!.code, row); toast.success(`Ledger ${values.name} updated`); }
    else { add("ledgers", row); toast.success(`Ledger ${values.name} created`); }
    onOpenChange(false);
  });

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={isEdit ? `Edit ${initial?.name}` : "New Ledger"}
      description="Account in your chart of accounts." onSubmit={onSubmit} submitting={isSubmitting}
      submitLabel={isEdit ? "Update" : "Create"}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Code" required error={errors.code?.message}>
          <TextInput {...register("code")} disabled={isEdit} />
        </FormField>
        <FormField label="Group" required error={errors.group?.message}>
          <SelectInput {...register("group")}>
            {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </SelectInput>
        </FormField>
        <FormField label="Account name" required error={errors.name?.message} className="md:col-span-2">
          <TextInput {...register("name")} placeholder="e.g. Bank Charges" />
        </FormField>
        <FormField label="Opening balance" error={errors.opening?.message}>
          <NumberInput step="0.01" {...register("opening")} />
        </FormField>
        <FormField label="Debit" error={errors.debit?.message}>
          <NumberInput step="0.01" {...register("debit")} />
        </FormField>
        <FormField label="Credit" error={errors.credit?.message}>
          <NumberInput step="0.01" {...register("credit")} />
        </FormField>
      </div>
    </FormDialog>
  );
}
