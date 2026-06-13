"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { subDays } from "date-fns"
import { Decimal } from "decimal.js"
import { Loader2 } from "lucide-react"
// Button reserved for future actions
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/primitives/PageHeader"
import { SectionCard } from "@/components/primitives/SectionCard"
import { formatINR, formatDate } from "@/lib/format"
import { useUiStore } from "@/lib/stores/uiStore"
import { cn } from "@/lib/utils"

type ChequeRow = {
  id: string
  voucherNo: string
  date: string
  voucherType: string
  totalAmount: string
  partyLedger: { name: string } | null
  chequeNo: string
  chequeDated: string | null
  bankName: string | null
  chequeStatus: string
  clearanceDate: string | null
}

type StatusFilter = "" | "ISSUED" | "CLEARED" | "BOUNCED" | "CANCELLED"

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "" },
  { label: "Issued", value: "ISSUED" },
  { label: "Cleared", value: "CLEARED" },
  { label: "Bounced", value: "BOUNCED" },
  { label: "Cancelled", value: "CANCELLED" },
]

/** @unused — reserved for future StatusBadge integration */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function chequeStatusVariant(status: string) {
  switch (status) {
    case "ISSUED":
      return "due-soon" as const
    case "CLEARED":
      return "posted" as const
    case "BOUNCED":
      return "cancelled" as const
    case "CANCELLED":
      return "draft" as const
    default:
      return "draft" as const
  }
}

interface ChequeStatusCellProps {
  row: ChequeRow
  onMutate: (payload: { voucherId: string; chequeStatus: string; clearanceDate: string | null }) => void
  isPending: boolean
}

function ChequeStatusCell({ row, onMutate, isPending }: ChequeStatusCellProps) {
  const [status, setStatus] = useState(row.chequeStatus)
  const [clearanceDate, setClearanceDate] = useState(row.clearanceDate ?? "")

  function handleStatusChange(v: string) {
    setStatus(v)
    if (v !== "CLEARED") {
      onMutate({ voucherId: row.id, chequeStatus: v, clearanceDate: null })
    }
  }

  function handleDateBlur() {
    if (clearanceDate) {
      onMutate({ voucherId: row.id, chequeStatus: "CLEARED", clearanceDate })
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={status} onValueChange={handleStatusChange} disabled={isPending}>
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ISSUED">ISSUED</SelectItem>
          <SelectItem value="CLEARED">CLEARED</SelectItem>
          <SelectItem value="BOUNCED">BOUNCED</SelectItem>
          <SelectItem value="CANCELLED">CANCELLED</SelectItem>
        </SelectContent>
      </Select>
      {status === "CLEARED" && (
        <Input
          type="date"
          value={clearanceDate}
          onChange={(e) => setClearanceDate(e.target.value)}
          onBlur={handleDateBlur}
          className="h-8 w-36 text-xs"
          placeholder="Clearance date"
          disabled={isPending}
        />
      )}
      {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  )
}

export default function ChequesPage() {
  const qc = useQueryClient()
  const { uiMode } = useUiStore()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("")

  const { data: cheques = [], isLoading } = useQuery<ChequeRow[]>({
    queryKey: ["cheques", statusFilter],
    queryFn: async () => {
      const url = statusFilter
        ? `/api/v1/cheques?status=${statusFilter}`
        : `/api/v1/cheques`
      const r = await fetch(url)
      if (!r.ok) throw new Error(await r.text())
      const json = await r.json()
      // API may return { data: [...], pagination: {...} } or plain array
      return Array.isArray(json) ? json : (json.data ?? [])
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      voucherId: string
      chequeStatus: string
      clearanceDate: string | null
    }) => {
      const r = await fetch(`/api/v1/cheques/${payload.voucherId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chequeStatus: payload.chequeStatus,
          clearanceDate: payload.clearanceDate,
        }),
      })
      if (!r.ok) throw new Error(await r.text())
      return r.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cheques"] }),
    onError: (e: Error) => toast.error(e.message),
  })

  const overdueCount = cheques.filter((row) => {
    if (row.chequeStatus !== "ISSUED" || !row.chequeDated) return false
    return new Date(row.chequeDated) < subDays(new Date(), 90)
  }).length

  const pageTitle = uiMode === "simple" ? "Cheque Book" : "Cheque Register"

  return (
    <div>
      <PageHeader
        title={pageTitle}
        subtitle="Track issued and received cheques."
      />

      {/* Status filter tabs */}
      <div className="mb-4 flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              statusFilter === tab.value
                ? "bg-purple-50 text-purple-600"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overdue banner */}
      {overdueCount > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-medium">{overdueCount} cheque{overdueCount > 1 ? "s" : ""} overdue</span>
          {" — issued over 90 days ago and still not cleared."}
        </div>
      )}

      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Cheque Register">
            <thead className="bg-muted/60">
              <tr>
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Cheque #
                </th>
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Voucher / Date
                </th>
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Party
                </th>
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Bank
                </th>
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Type
                </th>
                <th className="whitespace-nowrap px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Amount
                </th>
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Cheque Date
                </th>
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Clearance Date
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : cheques.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {statusFilter
                      ? `No ${statusFilter.toLowerCase()} cheques found.`
                      : "No cheques found."}
                  </td>
                </tr>
              ) : (
                cheques.map((row) => {
                  const isOverdue =
                    row.chequeStatus === "ISSUED" &&
                    !!row.chequeDated &&
                    new Date(row.chequeDated) < subDays(new Date(), 90)

                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-t border-border transition-colors hover:bg-muted/40",
                        isOverdue && "bg-amber-50 hover:bg-amber-100"
                      )}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-medium">{row.chequeNo}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <div className="font-medium">{row.voucherNo}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.date ? formatDate(row.date) : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {row.partyLedger?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {row.bankName ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-xs font-medium",
                            row.voucherType === "PAYMENT"
                              ? "bg-red-50 text-red-700"
                              : "bg-green-50 text-green-700"
                          )}
                        >
                          {row.voucherType === "PAYMENT" ? "Outgoing" : "Incoming"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="tabular-nums font-semibold text-gray-700">
                          {formatINR(new Decimal(row.totalAmount).toNumber())}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {row.chequeDated ? formatDate(row.chequeDated) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <ChequeStatusCell
                          row={row}
                          onMutate={(payload) => updateMutation.mutate(payload)}
                          isPending={updateMutation.isPending}
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {row.clearanceDate ? formatDate(row.clearanceDate) : "—"}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
