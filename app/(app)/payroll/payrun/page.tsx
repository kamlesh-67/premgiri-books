"use client"

import { useState } from "react"
import { Eye, Download } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/primitives/PageHeader"
import { SectionCard } from "@/components/primitives/SectionCard"
import { DataTable, type Column } from "@/components/primitives/DataTable"
import { StatusBadge } from "@/components/primitives/StatusBadge"
import { FormDialog } from "@/components/primitives/FormDialog"
import { formatINR } from "@/lib/format"
import { Decimal } from "decimal.js"

type PayRun = {
  id: string; month: string; status: string
  totalGross: string | null; totalNet: string | null
  createdAt: string
  _count: { paySlips: number }
}

type PaySlipSummary = {
  id: string; employeeId: string
  grossEarnings: string; totalDeductions: string; netPay: string
  pdfKey: string | null
  employee: { id: string; name: string; employeeCode: string; designation: string | null }
}

type PayRunDetail = PayRun & { paySlips: PaySlipSummary[] }

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export default function PayRunPage() {
  const qc = useQueryClient()
  const [newRunOpen, setNewRunOpen] = useState(false)
  const [newRunMonth, setNewRunMonth] = useState(currentMonth())
  const [detailRun, setDetailRun] = useState<PayRun | null>(null)

  const { data: runs = [], isLoading } = useQuery<PayRun[]>({
    queryKey: ["pay-runs"],
    queryFn: async () => {
      const r = await fetch("/api/v1/pay-runs")
      if (!r.ok) throw new Error("Failed to load pay runs")
      return r.json()
    },
    refetchInterval: (query) => {
      const data = query.state.data ?? []
      const hasActive = data.some((r) => r.status === "PENDING" || r.status === "PROCESSING")
      return hasActive ? 3000 : false
    },
  })

  const { data: detail } = useQuery<PayRunDetail>({
    queryKey: ["pay-run-detail", detailRun?.id],
    queryFn: async () => {
      const r = await fetch(`/api/v1/pay-runs/${detailRun!.id}`)
      if (!r.ok) throw new Error("Failed to load run detail")
      return r.json()
    },
    enabled: !!detailRun,
    refetchInterval: detailRun?.status === "PROCESSING" || detailRun?.status === "PENDING" ? 3000 : false,
  })

  const processMutation = useMutation({
    mutationFn: async (runId: string) => {
      const r = await fetch(`/api/v1/pay-runs/${runId}/process`, { method: "POST" })
      if (!r.ok) throw new Error(await r.text())
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pay-runs"] })
      qc.invalidateQueries({ queryKey: ["pay-run-detail", detailRun?.id] })
      toast.success("Pay run completed")
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Pay run failed"),
  })

  const createMutation = useMutation({
    mutationFn: async (month: string) => {
      const r = await fetch("/api/v1/pay-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      })
      if (!r.ok) throw new Error(await r.text())
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pay-runs"] })
      toast.success("Pay run started — processing in background…")
      setNewRunOpen(false)
    },
    onError: (e) => toast.error(e.message),
  })

  async function downloadSlip(runId: string, employeeId: string) {
    try {
      const r = await fetch(`/api/v1/pay-runs/${runId}/slips/${employeeId}`)
      if (!r.ok) throw new Error(await r.text())
      const { url } = await r.json()
      window.open(url, "_blank")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to get download URL")
    }
  }

  const cols: Column<PayRun>[] = [
    { key: "month", header: "Period", cell: (r) => <span className="font-medium tabular-nums">{r.month}</span> },
    { key: "employees", header: "Employees", align: "right", cell: (r) => r._count.paySlips },
    { key: "gross", header: "Gross", align: "right", cell: (r) => <span className="tabular-nums">{r.totalGross ? formatINR(new Decimal(String(r.totalGross || '0')).toNumber()) : "—"}</span> },
    { key: "net", header: "Net Pay", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{r.totalNet ? formatINR(new Decimal(String(r.totalNet || '0')).toNumber()) : "—"}</span> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions", header: "", align: "right",
      cell: (r) => (
        <Button size="icon" variant="ghost" onClick={() => setDetailRun(r)}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  const slipCols: Column<PaySlipSummary>[] = [
    { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs">{r.employee.employeeCode}</span> },
    { key: "name", header: "Employee", cell: (r) => <span className="font-medium">{r.employee.name}</span> },
    { key: "gross", header: "Gross", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(new Decimal(String(r.grossEarnings || '0')).toNumber())}</span> },
    { key: "deductions", header: "Deductions", align: "right", cell: (r) => <span className="tabular-nums">{formatINR(new Decimal(String(r.totalDeductions || '0')).toNumber())}</span> },
    { key: "net", header: "Net Pay", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatINR(new Decimal(String(r.netPay || '0')).toNumber())}</span> },
    {
      key: "pdf", header: "Pay Slip", align: "right",
      cell: (r) => r.pdfKey
        ? (
          <Button size="sm" variant="outline" onClick={() => downloadSlip(detailRun!.id, r.employeeId)}>
            <Download className="mr-1 h-3.5 w-3.5" />PDF
          </Button>
        )
        : <span className="text-xs text-muted-foreground">—</span>
    },
  ]

  return (
    <div>
      <PageHeader
        title="Pay Run"
        subtitle="Monthly payroll processing. Runs are processed in the background."
        actions={
          <Button size="sm" onClick={() => setNewRunOpen(true)}>
            <span className="mr-2">+</span>New Pay Run
          </Button>
        }
      />

      <SectionCard>
        <DataTable
          columns={cols}
          rows={runs}
          rowKey={(r) => r.id}
          empty={isLoading ? "Loading…" : "No pay runs yet. Start your first pay run above."}
        />
      </SectionCard>

      {/* New Pay Run dialog */}
      <FormDialog
        open={newRunOpen}
        onOpenChange={setNewRunOpen}
        title="New Pay Run"
        description="Select the payroll month. The run will process in the background using attendance data for that month."
        onSubmit={() => createMutation.mutate(newRunMonth)}
        submitLabel="Start Pay Run"
        submitting={createMutation.isPending}
      >
        <div>
          <label className="text-sm font-medium">Payroll Month</label>
          <Input
            type="month"
            value={newRunMonth}
            onChange={(e) => setNewRunMonth(e.target.value)}
            className="mt-1 w-48"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Re-running an existing month will overwrite previous pay slips.
          </p>
        </div>
      </FormDialog>

      {/* Pay Run detail modal */}
      {detailRun && (
        <FormDialog
          open={!!detailRun}
          onOpenChange={(o) => !o && setDetailRun(null)}
          title={`Pay Run — ${detailRun.month}`}
          onSubmit={() => setDetailRun(null)}
          submitLabel="Close"
          size="xl"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <span>Status: <StatusBadge status={detailRun.status} /></span>
              {detail?.totalGross && <span>Gross: <strong>{formatINR(new Decimal(String(detail.totalGross || '0')).toNumber())}</strong></span>}
              {detail?.totalNet && <span>Net: <strong>{formatINR(new Decimal(String(detail.totalNet || '0')).toNumber())}</strong></span>}
            </div>

            {(detailRun.status === "PENDING" || detailRun.status === "FAILED") && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Inngest not running locally.{" "}
                <button
                  className="font-semibold underline"
                  onClick={() => processMutation.mutate(detailRun.id)}
                  disabled={processMutation.isPending}
                >
                  {processMutation.isPending ? "Processing…" : "Run payroll now (dev mode)"}
                </button>
              </div>
            )}

            {detail?.paySlips && detail.paySlips.length > 0 ? (
              <DataTable
                columns={slipCols}
                rows={detail.paySlips}
                rowKey={(r) => r.id}
              />
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {detailRun.status === "PROCESSING" || detailRun.status === "PENDING"
                  ? "Processing… refreshing automatically."
                  : "No pay slips generated."}
              </p>
            )}
          </div>
        </FormDialog>
      )}
    </div>
  )
}
