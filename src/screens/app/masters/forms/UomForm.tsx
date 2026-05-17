import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormDialog } from "@/components/primitives/FormDialog";
import { FormField } from "@/components/primitives/FormField";
import { TextInput, NumberInput } from "@/components/primitives/FormControls";
import { uomSchema, type UomInput } from "@/lib/schemas";
import { add, update, type UomRow } from "@/lib/mockStore";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; initial?: UomRow | null; }

export function UomForm({ open, onOpenChange, initial }: Props) {
  const isEdit = !!initial;
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<UomInput>({ resolver: zodResolver(uomSchema) });

  useEffect(() => {
    if (!open) return;
    reset(initial ?? { code: "", name: "", baseUom: "—", factor: 1 });
  }, [open, initial, reset]);

  const onSubmit = handleSubmit(async (values) => {
    await new Promise((r) => setTimeout(r, 150));
    if (isEdit) { update("uoms", initial!.code, values as Partial<UomRow>); toast.success("UoM updated"); }
    else { add("uoms", values as UomRow); toast.success("UoM created"); }
    onOpenChange(false);
  });

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} size="md"
      title={isEdit ? `Edit ${initial?.name}` : "New Unit of Measure"} onSubmit={onSubmit}
      submitting={isSubmitting} submitLabel={isEdit ? "Update" : "Create"}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Code" required error={errors.code?.message}>
          <TextInput {...register("code")} disabled={isEdit} placeholder="L, KG, PCS…" />
        </FormField>
        <FormField label="Name" required error={errors.name?.message}>
          <TextInput {...register("name")} />
        </FormField>
        <FormField label="Base UoM" error={errors.baseUom?.message}>
          <TextInput {...register("baseUom")} placeholder="— or parent unit" />
        </FormField>
        <FormField label="Conversion factor" required error={errors.factor?.message}>
          <NumberInput step="0.001" {...register("factor")} />
        </FormField>
      </div>
    </FormDialog>
  );
}
