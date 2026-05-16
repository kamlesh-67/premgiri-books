import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormDialog } from "@/components/primitives/FormDialog";
import { FormField } from "@/components/primitives/FormField";
import { TextInput, NumberInput, SelectInput } from "@/components/primitives/FormControls";
import { categorySchema, type CategoryInput } from "@/lib/schemas";
import { add, update, type CategoryRow } from "@/lib/mockStore";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; initial?: CategoryRow | null; }

export function CategoryForm({ open, onOpenChange, initial }: Props) {
  const isEdit = !!initial;
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<CategoryInput>({ resolver: zodResolver(categorySchema) });

  useEffect(() => {
    if (!open) return;
    reset(initial ?? { code: "", name: "", parent: "Paints", items: 0 });
  }, [open, initial, reset]);

  const onSubmit = handleSubmit(async (values) => {
    await new Promise((r) => setTimeout(r, 150));
    if (isEdit) { update("categories", initial!.code, values as Partial<CategoryRow>); toast.success("Category updated"); }
    else { add("categories", values as CategoryRow); toast.success("Category created"); }
    onOpenChange(false);
  });

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} size="md"
      title={isEdit ? `Edit ${initial?.name}` : "New Category"} onSubmit={onSubmit}
      submitting={isSubmitting} submitLabel={isEdit ? "Update" : "Create"}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Code" required error={errors.code?.message}>
          <TextInput {...register("code")} disabled={isEdit} />
        </FormField>
        <FormField label="Parent group" required error={errors.parent?.message}>
          <SelectInput {...register("parent")}>
            {["Paints", "Allied", "Tools", "Others"].map((g) => <option key={g} value={g}>{g}</option>)}
          </SelectInput>
        </FormField>
        <FormField label="Category name" required error={errors.name?.message} className="md:col-span-2">
          <TextInput {...register("name")} />
        </FormField>
        <FormField label="Item count" error={errors.items?.message}>
          <NumberInput {...register("items")} />
        </FormField>
      </div>
    </FormDialog>
  );
}
