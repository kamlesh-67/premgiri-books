"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/primitives/PageHeader"
import { SectionCard } from "@/components/primitives/SectionCard"
import { DataTable, type Column } from "@/components/primitives/DataTable"
import { StatusBadge } from "@/components/primitives/StatusBadge"
import { FormDialog } from "@/components/primitives/FormDialog"

type Employee = {
  id: string; name: string; employeeCode: string
  designation: string | null; department: string | null; isActive: boolean
  salaryStructureId: string | null
  salaryStructure?: { id: string; name: string } | null
}

type SalaryStructure = { id: string; name: string; isActive: boolean }

export default function PayrollEmployeesPage() {
  const qc = useQueryClient()
  const [assignTarget, setAssignTarget] = useState<Employee | null>(null)
  const [selectedStructureId, setSelectedStructureId] = useState<string>("")
  const [effectiveFrom, setEffectiveFrom] = useState<string>("")

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["payroll-employees"],
    queryFn: async () => {
      const r = await fetch("/api/v1/employees?include=salaryStructure")
      if (!r.ok) throw new Error("Failed to load employees")
      return r.json()
    },
  })

  const { data: structures = [] } = useQuery<SalaryStructure[]>({
    queryKey: ["salary-structures"],
    queryFn: async () => {
      const r = await fetch("/api/v1/salary-structures")
      if (!r.ok) throw new Error("Failed to load structures")
      return r.json()
    },
  })

  const assignMutation = useMutation({
    mutationFn: async ({ employeeId, structureId, effectiveDate }: { employeeId: string; structureId: string; effectiveDate: string }) => {
      const r = await fetch(`/api/v1/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salaryStructureId: (structureId && structureId !== '__none__') ? structureId : null,
          structureEffectiveFrom: effectiveDate ? new Date(effectiveDate).toISOString() : null,
        }),
      })
      if (!r.ok) throw new Error(await r.text())
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-employees"] })
      toast.success("Salary structure assigned")
      setAssignTarget(null)
      setSelectedStructureId("")
      setEffectiveFrom("")
    },
    onError: (e) => toast.error(e.message),
  })

  const cols: Column<Employee>[] = [
    { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs">{r.employeeCode}</span> },
    { key: "name", header: "Name", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "designation", header: "Designation", cell: (r) => r.designation ?? "—" },
    { key: "department", header: "Department", cell: (r) => r.department ?? "—" },
    {
      key: "structure", header: "Salary Structure",
      cell: (r) => r.salaryStructure
        ? <span className="text-purple-700 font-medium">{r.salaryStructure.name}</span>
        : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">—</span>
    },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.isActive ? "ACTIVE" : "INACTIVE"} /> },
    {
      key: "actions", header: "", align: "right",
      cell: (r) => (
        <Button size="sm" variant="outline" onClick={() => {
          setAssignTarget(r)
          setSelectedStructureId(r.salaryStructureId ?? "__none__")
          setEffectiveFrom("")
        }}>
          Assign Structure
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Payroll Employees"
        subtitle="Assign salary structures to employees before running payroll."
      />

      <SectionCard>
        <DataTable
          columns={cols}
          rows={employees}
          rowKey={(r) => r.id}
          empty={isLoading ? "Loading…" : "No employees found."}
        />
      </SectionCard>

      <FormDialog
        open={!!assignTarget}
        onOpenChange={(o) => !o && setAssignTarget(null)}
        title={`Assign Salary Structure — ${assignTarget?.name ?? ""}`}
        onSubmit={() => {
          if (!assignTarget) return
          assignMutation.mutate({
            employeeId: assignTarget.id,
            structureId: selectedStructureId,
            effectiveDate: effectiveFrom,
          })
        }}
        submitLabel="Assign"
        submitting={assignMutation.isPending}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Salary Structure</label>
            <Select value={selectedStructureId} onValueChange={setSelectedStructureId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a structure…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None (remove assignment)</SelectItem>
                {structures.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Effective From</label>
            <Input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
      </FormDialog>
    </div>
  )
}
