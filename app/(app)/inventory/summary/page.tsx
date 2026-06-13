"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronRight, ChevronDown, IndianRupee } from "lucide-react"
import Link from "next/link"
import type { DateRange } from "react-day-picker"
import { PageHeader } from "@/components/shared/PageHeader"
import { SectionCard } from "@/components/shared/SectionCard"
import { KPICard } from "@/components/shared/KPICard"
import { DateRangePicker } from "@/components/shared/DateRangePicker"
import { formatINR } from "@/lib/utils/format"
import { getFY, getFYStart } from "@/lib/utils/fy"

type GodownRow = {
  godownId: string
  godownName: string
  inwardQty: string
  outwardQty: string
  closingQty: string
  fifoValue: string
}

type StockSummaryItem = {
  itemId: string
  name: string
  category: string
  openingQty: string
  inwardQty: string
  outwardQty: string
  closingQty: string
  fifoValue: string
  godowns: GodownRow[]
}

function getDefaultDateRange(): DateRange {
  const fyStart = getFYStart(getFY())
  return {
    from: fyStart,
    to: new Date(),
  }
}

export default function StockSummaryPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(getDefaultDateRange)
  const [groupId, setGroupId] = useState<string>("")
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const from = dateRange?.from
    ? dateRange.from.toISOString().split("T")[0]
    : getFYStart(getFY()).toISOString().split("T")[0]
  const to = dateRange?.to
    ? dateRange.to.toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0]

  const { data, isLoading } = useQuery({
    queryKey: ["stock-summary", from, to, groupId],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to })
      if (groupId) params.set("groupId", groupId)
      const r = await fetch(`/api/v1/inventory/stock-summary?${params}`)
      if (!r.ok) throw new Error("Failed to fetch stock summary")
      return r.json() as Promise<{ items: StockSummaryItem[]; totalFifoValue: string }>
    },
  })

  const toggleItem = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) { next.delete(itemId) } else { next.add(itemId) }
      return next
    })
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Stock Summary"
        subtitle="Current stock position with FIFO costing"
      />

      {/* KPI Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Stock Value"
          value={data ? formatINR(data.totalFifoValue) : "—"}
          icon={IndianRupee}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
        />
        <select
          value={groupId}
          onChange={e => setGroupId(e.target.value)}
          className="h-9 rounded-md border border-gray-200 px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">All Groups</option>
        </select>
      </div>

      {/* Stock Items Table */}
      <SectionCard title="Stock Items">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-gray-400">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Opening</th>
                <th className="px-4 py-3 text-right">Inward</th>
                <th className="px-4 py-3 text-right">Outward</th>
                <th className="px-4 py-3 text-right">Closing Qty</th>
                <th className="px-4 py-3 text-right">FIFO Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data?.items ?? []).map(item => (
                <>
                  <tr
                    key={item.itemId}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleItem(item.itemId)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-700">
                        <button
                          className="text-gray-400 flex-shrink-0"
                          onClick={e => { e.stopPropagation(); toggleItem(item.itemId) }}
                          aria-label={expandedItems.has(item.itemId) ? "Collapse" : "Expand"}
                        >
                          {expandedItems.has(item.itemId)
                            ? <ChevronDown className="h-4 w-4" />
                            : <ChevronRight className="h-4 w-4" />
                          }
                        </button>
                        {/* Item name links to Stock Ledger per D-08 */}
                        <Link
                          href={`/inventory/ledger?itemId=${item.itemId}`}
                          onClick={e => e.stopPropagation()}
                          className="text-purple-600 hover:underline"
                        >
                          {item.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.category}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.openingQty}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.inwardQty}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.outwardQty}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{item.closingQty}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {formatINR(item.fifoValue)}
                    </td>
                  </tr>
                  {expandedItems.has(item.itemId) &&
                    item.godowns.map(g => (
                      <tr key={`${item.itemId}-${g.godownId}`} className="bg-gray-50">
                        <td className="px-4 py-3 pl-12 text-gray-500 text-xs">{g.godownName}</td>
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3 text-right tabular-nums text-xs text-gray-500">
                          {g.inwardQty}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-xs text-gray-500">
                          {g.outwardQty}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-xs text-gray-500">
                          {g.closingQty}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-xs text-gray-500">
                          {formatINR(g.fifoValue)}
                        </td>
                      </tr>
                    ))
                  }
                </>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 font-semibold">
                <td className="px-4 py-3 text-gray-900" colSpan={6}>
                  Total Stock Value
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                  {data ? formatINR(data.totalFifoValue) : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </SectionCard>
    </div>
  )
}
