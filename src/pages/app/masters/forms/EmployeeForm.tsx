import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormDialog } from "@/components/primitives/FormDialog";
import { FormField } from "@/components/primitives/FormField";
import { TextInput, NumberInput, SelectInput } from "@/components/primitives/FormControls";
import { employeeSchema, type EmployeeInput } from "@/lib/schemas";
import { add, update, nextCode, getCollection, type EmployeeRow } from "@/lib/mockStore";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; initial?: EmployeeRow | null; }

const DEPTS = ["Finance", "Sales", "Operations", "HR", "IT", "Marketing"];

export function EmployeeForm({ open, onOpenChange, initial }: Props) {
  const isEdit = !!initial;
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<EmployeeInput>({ resolver: zodResolver(employeeSchema) });

  useEffect(() => {
    if (!open) return;
    if (initial) reset(initial as EmployeeInput);
    else {
      const code = nextCode("EMP-", getCollection("employees"));
      reset({ code, name: "", designation: "", department: "Finance", doj: new Date().toISOString().slice(0, 10), ctc: 0, status: "ACTIVE" });
    }
  }, [open, initial, reset]);

  const onSubmit = handleSubmit(async (values) => {
    await new Promise((r) => setTimeout(r, 200));
    if (isEdit) { update("employees", initial!.code, values as Partial<EmployeeRow>); toast.success(`${values.name} updated`); }
    else { add("employees", values as EmployeeRow); toast.success(`${values.name} added`); }
    onOpenChange(false);
  });

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={isEdit ? `Edit ${initial?.name}` : "New Employee"}
      description="Master record used by Payroll." onSubmit={onSubmit} submitting={isSubmitting}
      submitLabel={isEdit ? "Update" : "Create"}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Employee code" required error={errors.code?.message}>
          <TextInput {...register("code")} disabled={isEdit} />
        </FormField>
        <FormField label="Status" error={errors.status?.message}>
          <SelectInput {...register("status")}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </SelectInput>
        </FormField>
        <FormField label="Full name" required error={errors.name?.message} className="md:col-span-2">
          <TextInput {...register("name")} />
        </FormField>
        <FormField label="Designation" required error={errors.designation?.message}>
          <TextInput {...register("designation")} />
        </FormField>
        <FormField label="Department" required error={errors.department?.message}>
          <SelectInput {...register("department")}>
            {DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </SelectInput>
        </FormField>
        <FormField label="Date of joining" required error={errors.doj?.message}>
          <TextInput type="date" {...register("doj")} />
        </FormField>
        <FormField label="CTC (₹/year)" required error={errors.ctc?.message}>
          <NumberInput step="1000" {...register("ctc")} />
        </FormField>
      </div>
    </FormDialog>
  );
}
