import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormDialog } from "@/components/primitives/FormDialog";
import { FormField } from "@/components/primitives/FormField";
import { TextInput, SelectInput } from "@/components/primitives/FormControls";
import { userSchema, type UserInput } from "@/lib/schemas";
import { add, update, getCollection, useCollection, type UserRow } from "@/lib/mockStore";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: UserRow | null;
}

function nextUserId(list: { id: string }[]): string {
  const max = list.reduce((m, r) => {
    const match = r.id.match(/(\d+)\s*$/);
    return match ? Math.max(m, parseInt(match[1], 10)) : m;
  }, 0);
  return `U-${String(max + 1).padStart(3, "0")}`;
}

export function UserForm({ open, onOpenChange, initial }: Props) {
  const isEdit = !!initial;
  const roles = useCollection("roles");
  const {
    register, handleSubmit, reset, formState: { errors, isSubmitting },
  } = useForm<UserInput>({ resolver: zodResolver(userSchema) });

  useEffect(() => {
    if (!open) return;
    if (initial) reset(initial as UserInput);
    else {
      const id = nextUserId(getCollection("users"));
      reset({
        id,
        name: "",
        email: "",
        role: roles[0]?.name ?? "Accountant",
        status: "PENDING",
        lastLogin: "—",
      });
    }
  }, [open, initial, reset, roles]);

  const onSubmit = handleSubmit(async (values) => {
    await new Promise((r) => setTimeout(r, 200));
    const existingRole = initial?.role;
    if (isEdit) {
      update("users", initial!.id, values);
      toast.success(`User ${values.name} updated`);
    } else {
      add("users", values as UserRow);
      toast.success(`User ${values.name} invited`);
    }
    // Sync role user-counts
    const all = getCollection("users");
    const counts = new Map<string, number>();
    all.forEach((u) => counts.set(u.role, (counts.get(u.role) ?? 0) + 1));
    getCollection("roles").forEach((r) => {
      const next = counts.get(r.name) ?? 0;
      if (next !== r.users) update("roles", r.name, { users: next });
    });
    if (existingRole && existingRole !== values.role) {
      const prev = counts.get(existingRole) ?? 0;
      update("roles", existingRole, { users: prev });
    }
    onOpenChange(false);
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `Edit ${initial?.name}` : "Invite user"}
      description="Assign a role to control which modules the user can access."
      onSubmit={onSubmit}
      submitting={isSubmitting}
      submitLabel={isEdit ? "Update" : "Send invite"}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="User ID" required error={errors.id?.message}>
          <TextInput {...register("id")} disabled={isEdit} className="font-mono" />
        </FormField>
        <FormField label="Status" required error={errors.status?.message}>
          <SelectInput {...register("status")}>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="INACTIVE">Inactive</option>
          </SelectInput>
        </FormField>
        <FormField label="Full name" required error={errors.name?.message} className="md:col-span-2">
          <TextInput {...register("name")} placeholder="e.g. Rajesh Kumar" />
        </FormField>
        <FormField label="Email" required error={errors.email?.message}>
          <TextInput {...register("email")} type="email" placeholder="user@premgiri.com" />
        </FormField>
        <FormField label="Role" required error={errors.role?.message}>
          <SelectInput {...register("role")}>
            {roles.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
          </SelectInput>
        </FormField>
      </div>
    </FormDialog>
  );
}