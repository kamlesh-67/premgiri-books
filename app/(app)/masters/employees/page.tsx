"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/primitives/PageHeader"
import { SectionCard } from "@/components/primitives/SectionCard"
import { DataTable, type Column } from "@/components/primitives/DataTable"
import { StatusBadge } from "@/components/primitives/StatusBadge"
import { RowActions } from "@/components/primitives/RowActions"
import { ConfirmDelete } from "@/components/primitives/ConfirmDelete"
import { EmployeeForm } from "./forms/EmployeeForm"

type Employee = {
  id: string
  employeeCode: string
  name: string
  designation: string | null
  department: string | null
  joinDate: string
  salaryLedgerId: string | null
  pfApplicable: boolean
  esiApplicable: boolean
  isActive: boolean
}

export default function EmployeesPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [toDelete, setToDelete] = useState<Employee | null>(null)

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["master-employees"],
    queryFn: async () => {
      const r = await fetch("/api/v1/employees")
      if (!r.ok) throw new Error("Failed to load")
      return r.json()
    },
  })

  const saveMutation = useMutation({
    mutationFn: async ({ data, id }: { data: Record<string, unknown>; id?: string }) => {
      const url = id ? `/api/v1/employees/${id}` : "/api/v1/employees"
      const r = await fetch(url, {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!r.ok) throw new Error(await r.text())
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["master-employees"] })
      toast.success(editing ? "Employee updated" : "Employee created")
      setOpen(false)
      setEditing(null)
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/v1/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      })
      if (!r.ok) throw new Error(await r.text())
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["master-employees"] })
      toast.success("Employee deactivated")
      setToDelete(null)
    },
    onError: (e) => toast.error(e.message),
  })

  const cols: Column<Employee>[] = [
    { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs">{r.employeeCode}</span> },
    { key: "name", header: "Name", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "designation", header: "Designation", cell: (r) => r.designation ?? "—" },
    { key: "department", header: "Department", cell: (r) => r.department ?? "—" },
    { key: "joinDate", header: "Date of Joining", cell: (r) => new Date(r.joinDate).toLocaleDateString("en-IN") },
    { key: "pf", header: "PF", cell: (r) => <StatusBadge status={r.pfApplicable ? "ACTIVE" : "INACTIVE"} /> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.isActive ? "ACTIVE" : "INACTIVE"} /> },
    {
      key: "actions", header: "", align: "right",
      cell: (r) => (
        <RowActions
          onEdit={() => { setEditing(r); setOpen(true) }}
          onDelete={() => setToDelete(r)}
        />
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Master records used by Payroll."
        actions={
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />New Employee
          </Button>
        }
      />
      <SectionCard>
        <DataTable
          columns={cols}
          rows={employees}
          rowKey={(r) => r.id}
          empty={isLoading ? "Loading…" : "No employees yet. Create one to get started."}
        />
      </SectionCard>

      <EmployeeForm
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null) }}
        initial={editing}
        onSave={(data, id) => saveMutation.mutateAsync({ data: data as Record<string, unknown>, id })}
        saving={saveMutation.isPending}
      />

      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Deactivate "${toDelete?.name}"?`}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
      />
    </div>
  )
}
