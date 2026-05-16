"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery } from "@tanstack/react-query"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormDialog } from "@/components/primitives/FormDialog"

const schema = z.object({
  name: z.string().min(1, "Required"),
  employeeCode: z.string().min(1, "Required"),
  designation: z.string().optional(),
  department: z.string().optional(),
  joinDate: z.string().min(1, "Required"),
  salaryLedgerId: z.string().optional(),
  pfApplicable: z.boolean(),
  esiApplicable: z.boolean(),
})

type FormValues = z.infer<typeof schema>

type Ledger = { id: string; name: string }

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial?: { id: string; name: string; employeeCode: string; designation?: string | null; department?: string | null; joinDate: string; salaryLedgerId?: string | null; pfApplicable: boolean; esiApplicable: boolean } | null
  onSave: (data: FormValues, id?: string) => Promise<void>
  saving: boolean
}

export function EmployeeForm({ open, onOpenChange, initial, onSave, saving }: Props) {
  const { data: ledgers = [] } = useQuery<Ledger[]>({
    queryKey: ["ledgers-simple"],
    queryFn: async () => {
      const r = await fetch("/api/v1/masters/ledgers")
      if (!r.ok) return []
      return r.json()
    },
    enabled: open,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", employeeCode: "", designation: "", department: "", joinDate: "", salaryLedgerId: "", pfApplicable: true, esiApplicable: false },
  })

  useEffect(() => {
    if (open) {
      form.reset(initial
        ? {
            name: initial.name,
            employeeCode: initial.employeeCode,
            designation: initial.designation ?? "",
            department: initial.department ?? "",
            joinDate: initial.joinDate?.slice(0, 10) ?? "",
            salaryLedgerId: initial.salaryLedgerId ?? "",
            pfApplicable: initial.pfApplicable,
            esiApplicable: initial.esiApplicable,
          }
        : { name: "", employeeCode: "", designation: "", department: "", joinDate: "", salaryLedgerId: "", pfApplicable: true, esiApplicable: false }
      )
    }
  }, [open, initial, form])

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? "Edit Employee" : "New Employee"}
      onSubmit={form.handleSubmit((d) => onSave(d, initial?.id))}
      submitting={saving}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm font-medium">Name *</Label>
            <Input {...form.register("name")} placeholder="Full name" className="mt-1" />
            {form.formState.errors.name && <p className="mt-1 text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div>
            <Label className="text-sm font-medium">Employee Code *</Label>
            <Input {...form.register("employeeCode")} placeholder="e.g. EMP001" className="mt-1" />
            {form.formState.errors.employeeCode && <p className="mt-1 text-xs text-destructive">{form.formState.errors.employeeCode.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm font-medium">Designation</Label>
            <Input {...form.register("designation")} placeholder="e.g. Accountant" className="mt-1" />
          </div>
          <div>
            <Label className="text-sm font-medium">Department</Label>
            <Input {...form.register("department")} placeholder="e.g. Finance" className="mt-1" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm font-medium">Date of Joining *</Label>
            <Input type="date" {...form.register("joinDate")} className="mt-1" />
            {form.formState.errors.joinDate && <p className="mt-1 text-xs text-destructive">{form.formState.errors.joinDate.message}</p>}
          </div>
          <div>
            <Label className="text-sm font-medium">Salary Ledger</Label>
            <Select
              value={form.watch("salaryLedgerId") ?? ""}
              onValueChange={(v) => form.setValue("salaryLedgerId", v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select ledger" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {ledgers.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <Switch
              id="pf"
              checked={form.watch("pfApplicable")}
              onCheckedChange={(v) => form.setValue("pfApplicable", v)}
            />
            <Label htmlFor="pf" className="text-sm">PF Applicable</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="esi"
              checked={form.watch("esiApplicable")}
              onCheckedChange={(v) => form.setValue("esiApplicable", v)}
            />
            <Label htmlFor="esi" className="text-sm">ESI Applicable</Label>
          </div>
        </div>
      </div>
    </FormDialog>
  )
}
