"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import type { DateRange } from "react-day-picker"
import { PageHeader } from "@/components/shared/PageHeader"
import { SectionCard } from "@/components/shared/SectionCard"
import { DateRangePicker } from "@/components/shared/DateRangePicker"
import { formatINR } from "@/lib/utils/format"

// Helper: current Indian FY start as YYYY-MM-DD
function getFYStartStr(): string {
  const today = new Date()
  const month = today.getMonth() + 1 // 1-indexed
  const year = today.getFullYear()
  const fyStartYear = month >= 4 ? year : year - 1
  return `${fyStartYear}-04-01`
}

type Movement = {
  date: string
  voucherId: string
  voucherNo: string
  voucherType: string
  inwardQty: string | null
  outwardQty: string | null
  rate: string
  balanceQty: string
  balanceValue: string
}

function voucherTypeLabel(type: string): string {
  const map: Record<string, string> = {
    PURCHASE: "Purchase",
    SALES: "Sales",
    CREDIT_NOTE: "Credit Note",
    DEBIT_NOTE: "Debit Note",
    RECEIPT: "Receipt",
    PAYMENT: "Payment",
    JOURNAL: "Journal",
    CONTRA: "Contra",
  }
  return map[type] ?? type
}

function voucherDetailHref(type: string, id: string): string {
  const pathMap: Record<string, string> = {
    SALES: "sales",
    PURCHASE: "purchase",
    RECEIPT: "receipt",
    PAYMENT: "payment",
    JOURNAL: "journal",
    CONTRA: "contra",
    CREDIT_NOTE: "credit-note",
    DEBIT_NOTE: "debit-note",
  }
  const path = pathMap[type] ?? "sales"
  return `/vouchers/${path}/${id}`
}

export default function StockLedgerPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Item selection — pre-fill from URL ?itemId=
  const [itemId, setItemId] = useState<string>(searchParams?.get("itemId") ?? "")

  // Date range — default to current FY start → today
  const todayStr = new Date().toISOString().split("T")[0]
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(getFYStartStr()),
    to: new Date(todayStr),
  })

  // Derived string params for API calls
  const fromStr = dateRange?.from?.toISOString().split("T")[0] ?? getFYStartStr()
  const toStr = dateRange?.to?.toISOString().split("T")[0] ?? todayStr

  // Sync URL params when filters change (shallow navigation)
  useEffect(() => {
    const params = new URLSearchParams()
    if (itemId) params.set("itemId", itemId)
    if (fromStr) params.set("from", fromStr)
    if (toStr) params.set("to", toStr)
    router.replace(`/inventory/ledger?${params.toString()}`)
  }, [itemId, fromStr, toStr, router])

  // Fetch stock items for the combobox
  const { data: stockItems = [] } = useQuery({
    queryKey: ["stock-items-list"],
    queryFn: async () => {
      const r = await fetch("/api/v1/masters/stock-items")
      if (!r.ok) throw new Error("Failed to fetch stock items")
      return r.json() as Promise<Array<{ id: string; name: string }>>
    },
  })

  // Fetch ledger movements when an item is selected
  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ["stock-ledger", itemId, fromStr, toStr],
    queryFn: async () => {
      const params = new URLSearchParams({ itemId, from: fromStr, to: toStr })
      const r = await fetch(`/api/v1/inventory/stock-ledger?${params}`)
      if (!r.ok) throw new Error("Failed to fetch stock ledger")
      return r.json() as Promise<{
        item: { id: string; name: string; uom: string }
        movements: Movement[]
      }>
    },
    enabled: !!itemId,
  })

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Stock Ledger"
        subtitle="Item-level inflow and outflow history with running balance"
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Item
          </label>
          <select
            value={itemId}
            onChange={e => setItemId(e.target.value)}
            className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 min-w-[220px] focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Select item...</option>
            {stockItems.map(i => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Date Range
          </label>
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder="Select date range"
          />
        </div>
      </div>

      {!itemId ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-sm text-gray-400">
          Select an item above to view its stock ledger
        </div>
      ) : (
        <SectionCard
          title={ledgerData?.item?.name ?? "Stock Ledger"}
          noPadding
        >
          {isLoading ? (
            <div className="py-8 text-center text-sm text-gray-400">Loading...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Voucher No</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Inward</th>
                  <th className="px-4 py-3 text-right">Outward</th>
                  <th className="px-4 py-3 text-right">Rate</th>
                  <th className="px-4 py-3 text-right">Balance Qty</th>
                  <th className="px-4 py-3 text-right">Balance Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(ledgerData?.movements ?? []).map((m: Movement) => (
                  <tr key={m.voucherId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{m.date}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={voucherDetailHref(m.voucherType, m.voucherId)}
                        className="text-purple-600 hover:underline text-sm"
                      >
                        {m.voucherNo}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {voucherTypeLabel(m.voucherType)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-700">
                      {m.inwardQty ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600">
                      {m.outwardQty ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                      {m.rate}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {m.balanceQty}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {formatINR(m.balanceValue)}
                    </td>
                  </tr>
                ))}
                {(ledgerData?.movements?.length ?? 0) === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-sm text-gray-400"
                    >
                      No movements found for this item in the selected period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </SectionCard>
      )}
    </div>
  )
}
