import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormDialog } from "@/components/primitives/FormDialog";
import { FormField } from "@/components/primitives/FormField";
import { TextInput, NumberInput, SelectInput } from "@/components/primitives/FormControls";
import { stockItemSchema, type StockItemInput } from "@/lib/schemas";
import { add, update, type StockItemRow, useCollection } from "@/lib/mockStore";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; initial?: StockItemRow | null; }

export function StockItemForm({ open, onOpenChange, initial }: Props) {
  const isEdit = !!initial;
  const cats = useCollection("categories");
  const uoms = useCollection("uoms");
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } =
    useForm<StockItemInput>({ resolver: zodResolver(stockItemSchema) });

  useEffect(() => {
    if (!open) return;
    reset(initial ?? {
      code: "", name: "", category: cats[0]?.name ?? "Interior", uom: uoms[0]?.name ?? "Litre",
      hsn: "3209", gst: 18, stock: 0, rate: 0, value: 0,
    });
  }, [open, initial, reset, cats, uoms]);

  const stock = Number(watch("stock") || 0);
  const rate = Number(watch("rate") || 0);
  const value = stock * rate;

  const onSubmit = handleSubmit(async (values) => {
    await new Promise((r) => setTimeout(r, 200));
    const row = { ...values, value: Number(values.stock) * Number(values.rate) } as StockItemRow;
    if (isEdit) { update("stockItems", initial!.code, row); toast.success(`${values.name} updated`); }
    else { add("stockItems", row); toast.success(`${values.name} created`); }
    onOpenChange(false);
  });

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={isEdit ? `Edit ${initial?.name}` : "New Stock Item"}
      description="Sellable / purchasable goods master." onSubmit={onSubmit} submitting={isSubmitting}
      submitLabel={isEdit ? "Update" : "Create"}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Item code" required error={errors.code?.message}>
          <TextInput {...register("code")} disabled={isEdit} placeholder="BPG-ITEM-…" />
        </FormField>
        <FormField label="HSN" required error={errors.hsn?.message}>
          <TextInput {...register("hsn")} placeholder="3209" />
        </FormField>
        <FormField label="Item name" required error={errors.name?.message} className="md:col-span-2">
          <TextInput {...register("name")} />
        </FormField>
        <FormField label="Category" required error={errors.category?.message}>
          <SelectInput {...register("category")}>
            {cats.map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}
          </SelectInput>
        </FormField>
        <FormField label="UoM" required error={errors.uom?.message}>
          <SelectInput {...register("uom")}>
            {uoms.map((u) => <option key={u.code} value={u.name}>{u.name}</option>)}
          </SelectInput>
        </FormField>
        <FormField label="GST %" required error={errors.gst?.message}>
          <SelectInput {...register("gst")}>
            {[0, 5, 12, 18, 28].map((g) => <option key={g} value={g}>{g}%</option>)}
          </SelectInput>
        </FormField>
        <FormField label="Opening stock" error={errors.stock?.message}>
          <NumberInput step="0.01" {...register("stock")} />
        </FormField>
        <FormField label="Rate" error={errors.rate?.message}>
          <NumberInput step="0.01" {...register("rate")} />
        </FormField>
        <FormField label="Value (auto)" hint="qty × rate">
          <NumberInput value={value} readOnly tabIndex={-1} className="bg-muted/40" />
        </FormField>
      </div>
    </FormDialog>
  );
}
