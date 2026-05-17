import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormDialog } from "@/components/primitives/FormDialog";
import { FormField } from "@/components/primitives/FormField";
import { TextInput, NumberInput } from "@/components/primitives/FormControls";
import { godownSchema, type GodownInput } from "@/lib/schemas";
import { add, update, type GodownRow } from "@/lib/mockStore";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; initial?: GodownRow | null; }

export function GodownForm({ open, onOpenChange, initial }: Props) {
  const isEdit = !!initial;
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<GodownInput>({ resolver: zodResolver(godownSchema) });

  useEffect(() => {
    if (!open) return;
    reset(initial ?? { code: "", name: "", address: "", items: 0, value: 0 });
  }, [open, initial, reset]);

  const onSubmit = handleSubmit(async (values) => {
    await new Promise((r) => setTimeout(r, 150));
    if (isEdit) { update("godowns", initial!.code, values as Partial<GodownRow>); toast.success("Godown updated"); }
    else { add("godowns", values as GodownRow); toast.success("Godown created"); }
    onOpenChange(false);
  });

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} size="md"
      title={isEdit ? `Edit ${initial?.name}` : "New Godown"} onSubmit={onSubmit}
      submitting={isSubmitting} submitLabel={isEdit ? "Update" : "Create"}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Code" required error={errors.code?.message}>
          <TextInput {...register("code")} disabled={isEdit} />
        </FormField>
        <FormField label="Godown name" required error={errors.name?.message}>
          <TextInput {...register("name")} />
        </FormField>
        <FormField label="Address" required error={errors.address?.message} className="md:col-span-2">
          <TextInput {...register("address")} />
        </FormField>
        <FormField label="SKUs" error={errors.items?.message}>
          <NumberInput {...register("items")} />
        </FormField>
        <FormField label="Stock value" error={errors.value?.message}>
          <NumberInput step="0.01" {...register("value")} />
        </FormField>
      </div>
    </FormDialog>
  );
}
