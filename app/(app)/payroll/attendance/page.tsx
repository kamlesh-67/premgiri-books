"use client"

import { useState } from "react"
import { Lock } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/primitives/PageHeader"
import { SectionCard } from "@/components/primitives/SectionCard"
import { DataTable, type Column } from "@/components/primitives/DataTable"
import { Decimal } from "decimal.js"

type AttendanceRow = {
  id: string | null
  employeeId: string
  month: string
  presentDays: string
  absentDays: string
  halfDays: number
  leaveDays: number
  lockedAt: string | null
  employee: { id: string; name: string; employeeCode: string }
}

// Current month default
function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export default function AttendancePage() {
  const qc = useQueryClient()
  const [month, setMonth] = useState(currentMonth())

  const { data: rows = [], isLoading } = useQuery<AttendanceRow[]>({
    queryKey: ["attendance", month],
    queryFn: async () => {
      const r = await fetch(`/api/v1/attendance?month=${month}`)
      if (!r.ok) throw new Error("Failed to load attendance")
      return r.json()
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      employeeId: string; month: string
      presentDays: number; absentDays: number; halfDays: number; leaveDays: number
    }) => {
      const r = await fetch("/api/v1/attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (r.status === 409) throw new Error("Attendance is locked — pay run completed for this month")
      if (!r.ok) throw new Error(await r.text())
      return r.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance", month] }),
    onError: (e) => toast.error(e.message),
  })

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/v1/attendance/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      })
      if (!r.ok) throw new Error(await r.text())
      return r.json()
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["attendance", month] })
      toast.success(`Marked ${data.updated} employees as present (26 days)`)
    },
    onError: (e) => toast.error(e.message),
  })

  function EditableCell({ row, field }: { row: AttendanceRow; field: "presentDays" | "halfDays" | "leaveDays" }) {
    const [val, setVal] = useState(String(row[field]))
    const locked = !!row.lockedAt

    function commit() {
      const n = new Decimal(String(val || '0')).toNumber()
      if (isNaN(n)) return
      const present = field === "presentDays" ? n : new Decimal(String(row.presentDays || '0')).toNumber()
      const half = field === "halfDays" ? n : row.halfDays
      const leave = field === "leaveDays" ? n : row.leaveDays
      const absent = Math.max(0, 26 - present - half * 0.5 - leave)
      updateMutation.mutate({
        employeeId: row.employeeId,
        month,
        presentDays: present,
        absentDays: absent,
        halfDays: half,
        leaveDays: leave,
      })
    }

    if (locked) return <span className="tabular-nums text-muted-foreground">{row[field]}</span>

    return (
      <Input
        className="h-7 w-16 text-center text-sm tabular-nums"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
    )
  }

  const cols: Column<AttendanceRow>[] = [
    { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs">{r.employee?.employeeCode}</span> },
    { key: "name", header: "Employee", cell: (r) => <span className="font-medium">{r.employee?.name}</span> },
    { key: "present", header: "Present", align: "right", cell: (r) => <EditableCell row={r} field="presentDays" /> },
    { key: "half", header: "Half-day", align: "right", cell: (r) => <EditableCell row={r} field="halfDays" /> },
    { key: "leave", header: "Leave", align: "right", cell: (r) => <EditableCell row={r} field="leaveDays" /> },
    { key: "absent", header: "Absent", align: "right", cell: (r) => <span className="tabular-nums">{new Decimal(String(r.absentDays || '0')).toNumber().toFixed(1)}</span> },
    {
      key: "status", header: "Status",
      cell: (r) => r.lockedAt
        ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" />Locked</span>
        : <span className="text-xs text-green-600">Editable</span>
    },
  ]

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Monthly attendance summary. Edit cells directly. Locked after pay run."
        actions={
          <div className="flex items-center gap-3">
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-36"
            />
            <Button
              size="sm"
              onClick={() => bulkMutation.mutate()}
              disabled={bulkMutation.isPending}
              variant="outline"
            >
              Mark All Present
            </Button>
          </div>
        }
      />

      <SectionCard>
        <DataTable
          columns={cols}
          rows={rows}
          rowKey={(r) => r.employeeId}
          empty={isLoading ? "Loading…" : `No employees found for ${month}.`}
        />
      </SectionCard>
    </div>
  )
}
