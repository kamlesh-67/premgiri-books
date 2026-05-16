import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormDialog } from "@/components/primitives/FormDialog";
import { FormField } from "@/components/primitives/FormField";
import { TextInput, NumberInput, SelectInput } from "@/components/primitives/FormControls";
import { partySchema, type PartyInput } from "@/lib/schemas";
import { add, update, nextCode, getCollection, type PartyRow } from "@/lib/mockStore";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: PartyRow | null;
}

const STATES = ["Maharashtra", "Karnataka", "Gujarat", "Tamil Nadu", "Delhi", "Telangana", "West Bengal", "Uttar Pradesh"];

export function PartyForm({ open, onOpenChange, initial }: Props) {
  const isEdit = !!initial;
  const {
    register, handleSubmit, reset, formState: { errors, isSubmitting },
  } = useForm<PartyInput>({ resolver: zodResolver(partySchema) });

  useEffect(() => {
    if (!open) return;
    if (initial) reset(initial as PartyInput);
    else {
      const code = nextCode("C-", getCollection("parties").filter((p) => p.type === "Customer"));
      reset({ code, name: "", type: "Customer", gstin: "", state: "Maharashtra", phone: "", outstanding: 0 });
    }
  }, [open, initial, reset]);

  const onSubmit = handleSubmit(async (values) => {
    await new Promise((r) => setTimeout(r, 250));
    if (isEdit) {
      update("parties", initial!.code, values);
      toast.success(`Party ${values.name} updated`);
    } else {
      add("parties", values as PartyRow);
      toast.success(`Party ${values.name} created`);
    }
    onOpenChange(false);
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `Edit ${initial?.name}` : "New Party"}
      description="Customer or supplier with GST and ledger details."
      onSubmit={onSubmit}
      submitting={isSubmitting}
      submitLabel={isEdit ? "Update" : "Create"}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Code" required error={errors.code?.message}>
          <TextInput {...register("code")} disabled={isEdit} />
        </FormField>
        <FormField label="Type" required error={errors.type?.message}>
          <SelectInput {...register("type")}>
            <option value="Customer">Customer</option>
            <option value="Supplier">Supplier</option>
          </SelectInput>
        </FormField>
        <FormField label="Name" required error={errors.name?.message} className="md:col-span-2">
          <TextInput {...register("name")} placeholder="Party name" />
        </FormField>
        <FormField label="GSTIN" required error={errors.gstin?.message}>
          <TextInput {...register("gstin")} placeholder="27AAACS1234F1Z5" maxLength={15} className="font-mono uppercase" />
        </FormField>
        <FormField label="State" required error={errors.state?.message}>
          <SelectInput {...register("state")}>
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </SelectInput>
        </FormField>
        <FormField label="Phone" error={errors.phone?.message}>
          <TextInput {...register("phone")} placeholder="+91 …" />
        </FormField>
        <FormField label="Opening outstanding" error={errors.outstanding?.message}>
          <NumberInput {...register("outstanding")} />
        </FormField>
      </div>
    </FormDialog>
  );
}
