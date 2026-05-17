import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormDialog } from "@/components/primitives/FormDialog";
import { FormField } from "@/components/primitives/FormField";
import { TextInput, NumberInput, SelectInput } from "@/components/primitives/FormControls";
import { moneyMoveSchema, type MoneyMoveInput } from "@/lib/schemas";
import {
  add, update, useCollection,
  nextReceiptNumber, nextPaymentNumber, newId,
  type CollectionMap,
} from "@/lib/mockStore";

type Kind = "receipts" | "payments";
type Row = CollectionMap[Kind];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: Kind;
  initial?: Row | null;
}

export function MoneyMoveForm({ open, onOpenChange, kind, initial }: Props) {
  const isEdit = !!initial;
  const isReceipt = kind === "receipts";
  const parties = useCollection("parties").filter((p) => (isReceipt ? p.type === "Customer" : p.type === "Supplier"));

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<MoneyMoveInput>({ resolver: zodResolver(moneyMoveSchema) });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      reset({ date: initial.date, party: initial.party, mode: initial.mode, amount: initial.amount, reference: initial.reference ?? "" });
    } else {
      reset({
        date: new Date().toISOString().slice(0, 10),
        party: parties[0]?.name ?? "",
        mode: "NEFT",
        amount: 0,
        reference: "",
      });
    }
  }, [open, initial, reset, parties]);

  const onSubmit = handleSubmit(async (values) => {
    await new Promise((r) => setTimeout(r, 250));
    if (isEdit) {
      update(kind, initial!.id, { ...values, reference: values.reference || undefined });
      toast.success(`${initial!.number} updated`);
    } else {
      const number = isReceipt ? nextReceiptNumber() : nextPaymentNumber();
      const row: Row = {
        id: newId(), number, date: values.date, party: values.party, mode: values.mode,
        amount: Number(values.amount), status: "POSTED",
        reference: values.reference || undefined,
      };
      add(kind, row);
      toast.success(`${number} posted`);
    }
    onOpenChange(false);
  });

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} size="md"
      title={isEdit ? `Edit ${initial?.number}` : isReceipt ? "New Receipt" : "New Payment"}
      description={isReceipt ? "Record money received from a customer." : "Record money paid to a supplier."}
      onSubmit={onSubmit} submitting={isSubmitting} submitLabel={isEdit ? "Update" : "Post"}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Date" required error={errors.date?.message}>
          <TextInput type="date" {...register("date")} />
        </FormField>
        <FormField label="Mode" required error={errors.mode?.message}>
          <SelectInput {...register("mode")}>
            <option>Cash</option><option>Bank</option><option>UPI</option><option>Cheque</option><option>NEFT</option>
          </SelectInput>
        </FormField>
        <FormField label={isReceipt ? "Customer" : "Supplier"} required error={errors.party?.message} className="md:col-span-2">
          <SelectInput {...register("party")}>
            {parties.length === 0 && <option value="">— add a {isReceipt ? "customer" : "supplier"} first —</option>}
            {parties.map((p) => <option key={p.code} value={p.name}>{p.name}</option>)}
          </SelectInput>
        </FormField>
        <FormField label="Amount (₹)" required error={errors.amount?.message}>
          <NumberInput step="0.01" {...register("amount")} />
        </FormField>
        <FormField label="Reference" error={errors.reference?.message}>
          <TextInput {...register("reference")} placeholder="UTR / Cheque #" />
        </FormField>
      </div>
    </FormDialog>
  );
}
