import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormDialog } from "@/components/primitives/FormDialog";
import { FormField } from "@/components/primitives/FormField";
import { TextInput } from "@/components/primitives/FormControls";
import { Checkbox } from "@/components/ui/checkbox";
import { roleSchema, type RoleInput } from "@/lib/schemas";
import { add, update, getCollection, type RoleRow } from "@/lib/mockStore";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: RoleRow | null;
}

export const ROLE_SCOPES = [
  "All Modules", "Admin", "Audit Log",
  "Transactions", "Sales Invoice", "Purchase Invoice", "Receipts", "Payments",
  "GST", "Reports", "Customers", "Suppliers",
  "Stock Items", "Godowns", "Stock Ledger",
  "Payroll", "Banking",
];

export function RoleForm({ open, onOpenChange, initial }: Props) {
  const isEdit = !!initial;
  const {
    register, handleSubmit, reset, control,
    formState: { errors, isSubmitting },
  } = useForm<RoleInput>({ resolver: zodResolver(roleSchema) });

  useEffect(() => {
    if (!open) return;
    if (initial) reset(initial as RoleInput);
    else reset({ name: "", scopes: [], users: 0 });
  }, [open, initial, reset]);

  const onSubmit = handleSubmit(async (values) => {
    await new Promise((r) => setTimeout(r, 200));
    if (isEdit) {
      const oldName = initial!.name;
      update("roles", oldName, values);
      // If role renamed, propagate to users referencing it
      if (oldName !== values.name) {
        getCollection("users").filter((u) => u.role === oldName).forEach((u) => {
          update("users", u.id, { role: values.name });
        });
      }
      toast.success(`Role ${values.name} updated`);
    } else {
      if (getCollection("roles").some((r) => r.name.toLowerCase() === values.name.toLowerCase())) {
        toast.error("A role with that name already exists");
        return;
      }
      add("roles", values as RoleRow);
      toast.success(`Role ${values.name} created`);
    }
    onOpenChange(false);
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `Edit ${initial?.name}` : "New role"}
      description="Choose which modules this role can access."
      onSubmit={onSubmit}
      submitting={isSubmitting}
      submitLabel={isEdit ? "Update" : "Create"}
    >
      <FormField label="Role name" required error={errors.name?.message}>
        <TextInput {...register("name")} placeholder="e.g. Auditor" />
      </FormField>
      <FormField label="Module access" required error={errors.scopes?.message as string | undefined}>
        <Controller
          control={control}
          name="scopes"
          render={({ field }) => {
            const value = (field.value ?? []) as string[];
            const toggle = (s: string, on: boolean) => {
              field.onChange(on ? [...value, s] : value.filter((v) => v !== s));
            };
            return (
              <div className="grid grid-cols-2 gap-2 rounded-md border border-border p-3 md:grid-cols-3">
                {ROLE_SCOPES.map((s) => {
                  const checked = value.includes(s);
                  return (
                    <label key={s} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox checked={checked} onCheckedChange={(v) => toggle(s, !!v)} />
                      <span>{s}</span>
                    </label>
                  );
                })}
              </div>
            );
          }}
        />
      </FormField>
    </FormDialog>
  );
}