"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, X } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/primitives/PageHeader"
import { SectionCard } from "@/components/primitives/SectionCard"
import { DataTable, type Column } from "@/components/primitives/DataTable"
import { StatusBadge } from "@/components/primitives/StatusBadge"
import { FormDialog } from "@/components/primitives/FormDialog"
import { ConfirmDelete } from "@/components/primitives/ConfirmDelete"
import { formatINR } from "@/lib/format"
import { Decimal } from "decimal.js"

const componentSchema = z.object({
  name: z.string().min(1, "Required"),
  type: z.enum(["earning", "deduction"]),
  amount: z.string().optional(),
  formula: z.string().optional(),
  order: z.number().int(),
})

const structureSchema = z.object({
  name: z.string().min(1, "Structure name required"),
  components: z.array(componentSchema).min(1, "Add at least one component"),
})

type StructureForm = z.infer<typeof structureSchema>

type SalaryStructure = {
  id: string
  name: string
  isActive: boolean
  components: Array<{ name: string; type: string; amount?: string; formula?: string; order: number }>
  _count: { employees: number }
}

export default function SalaryStructuresPage() {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SalaryStructure | null>(null)
  const [toDelete, setToDelete] = useState<SalaryStructure | null>(null)

  const { data: structures = [], isLoading } = useQuery<SalaryStructure[]>({
    queryKey: ["salary-structures"],
    queryFn: async () => {
      const r = await fetch("/api/v1/salary-structures")
      if (!r.ok) throw new Error("Failed to load salary structures")
      return r.json()
    },
  })

  const form = useForm<StructureForm>({
    resolver: zodResolver(structureSchema),
    defaultValues: { name: "", components: [{ name: "Basic", type: "earning", amount: "20000", order: 1 }] },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "components" })

  const saveMutation = useMutation({
    mutationFn: async (data: StructureForm) => {
      const url = editing ? `/api/v1/salary-structures/${editing.id}` : "/api/v1/salary-structures"
      const r = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!r.ok) throw new Error(await r.text())
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salary-structures"] })
      toast.success(editing ? "Structure updated" : "Structure created")
      setDialogOpen(false)
      setEditing(null)
      form.reset()
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/v1/salary-structures/${id}`, { method: "DELETE" })
      if (!r.ok) throw new Error(await r.text())
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salary-structures"] })
      toast.success("Structure deactivated")
      setToDelete(null)
    },
    onError: (e) => toast.error(e.message),
  })

  function openEdit(s: SalaryStructure) {
    setEditing(s)
    form.reset({
      name: s.name,
      components: s.components.map((c, i) => ({
        name: c.name,
        type: (c.type === "earning" || c.type === "deduction" ? c.type : "earning") as "earning" | "deduction",
        amount: c.amount ?? "",
        formula: c.formula ?? "",
        order: c.order ?? i + 1,
      })),
    })
    setDialogOpen(true)
  }

  function openNew() {
    setEditing(null)
    form.reset({ name: "", components: [{ name: "Basic", type: "earning", amount: "20000", order: 1 }] })
    setDialogOpen(true)
  }

  // Compute gross from earnings components
  function computeGross(components: SalaryStructure["components"]): string {
    const total = components
      .filter((c) => c.type === "earning" && c.amount)
      .reduce((sum, c) => sum.plus(c.amount ?? "0"), new Decimal(0)).toNumber()
    return total > 0 ? formatINR(total) : "—"
  }

  const cols: Column<SalaryStructure>[] = [
    { key: "name", header: "Structure Name", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "components", header: "Components", cell: (r) => <span className="text-muted-foreground">{r.components.length} components</span> },
    { key: "gross", header: "Approx Gross", align: "right", cell: (r) => <span className="tabular-nums">{computeGross(r.components)}</span> },
    { key: "employees", header: "Employees", align: "right", cell: (r) => r._count.employees },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.isActive ? "ACTIVE" : "INACTIVE"} /> },
    {
      key: "actions", header: "", align: "right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" onClick={() => setToDelete(r)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Salary Structures"
        subtitle="Templates assigned to employees during pay run."
        actions={<Button size="sm" onClick={openNew}><Plus className="mr-2 h-4 w-4" />New Structure</Button>}
      />

      <SectionCard>
        <DataTable
          columns={cols}
          rows={structures}
          rowKey={(r) => r.id}
          empty={isLoading ? "Loading…" : "No salary structures yet. Create one to get started."}
        />
      </SectionCard>

      <FormDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); form.reset() } }}
        title={editing ? "Edit Salary Structure" : "New Salary Structure"}
        onSubmit={form.handleSubmit((d) => saveMutation.mutate(d))}
        submitting={saveMutation.isPending}
        size="xl"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Structure Name</label>
            <Input {...form.register("name")} placeholder="e.g. Standard Monthly" className="mt-1" />
            {form.formState.errors.name && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">Components</label>
              <Button
                type="button" size="sm" variant="outline"
                onClick={() => append({ name: "", type: "earning", amount: "", order: fields.length + 1 })}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />Add Row
              </Button>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_120px_1fr_1fr_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
                <span>Name</span><span>Type</span><span>Amount (₹)</span><span>Formula</span><span />
              </div>
              {fields.map((field, i) => (
                <div key={field.id} className="grid grid-cols-[1fr_120px_1fr_1fr_32px] gap-2 items-center">
                  <Input {...form.register(`components.${i}.name`)} placeholder="Component name" />
                  <Select
                    value={form.watch(`components.${i}.type`)}
                    onValueChange={(v) => form.setValue(`components.${i}.type`, v as "earning" | "deduction")}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="earning">Earning</SelectItem>
                      <SelectItem value="deduction">Deduction</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input {...form.register(`components.${i}.amount`)} placeholder="e.g. 20000" />
                  <Input {...form.register(`components.${i}.formula`)} placeholder="e.g. 40% of Basic" />
                  <Button
                    type="button" size="icon" variant="ghost"
                    onClick={() => remove(i)}
                    disabled={fields.length === 1}
                    className="text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </FormDialog>

      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Deactivate "${toDelete?.name}"?`}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
      />
    </div>
  )
}
