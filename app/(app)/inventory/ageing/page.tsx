"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { SectionCard } from "@/components/shared/SectionCard"
import { KPICard } from "@/components/shared/KPICard"
import { formatINR } from "@/lib/utils/format"
import { AlertTriangle } from "lucide-react"
import Decimal from "decimal.js"

type AgeingRow = {
  itemId: string
  name: string
  b0_30_qty: string
  b0_30_value: string
  b31_60_qty: string
  b31_60_value: string
  b61_90_qty: string
  b61_90_value: string
  b90plus_qty: string
  b90plus_value: string
  totalValue: string
}

export default function StockAgeingPage() {
  const [asOf, setAsOf] = useState<string>(
    new Date().toISOString().split("T")[0]
  )

  const { data, isLoading } = useQuery({
    queryKey: ["stock-ageing", asOf],
    queryFn: async () => {
      const r = await fetch(`/api/v1/inventory/stock-ageing?asOf=${asOf}`)
      if (!r.ok) throw new Error("Failed to fetch stock ageing")
      return r.json() as Promise<{ asOf: string; rows: AgeingRow[] }>
    },
  })

  // Total value of stock held more than 90 days — shown in KPI card
  const totalAgedValue = (data?.rows ?? [])
    .reduce(
      (sum, r) => sum.plus(new Decimal(r.b90plus_value)),
      new Decimal(0)
    )
    .toString()

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Stock Ageing"
        subtitle="Unconsumed stock batches by days held — FIFO basis"
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Aged Stock (>90 days)"
          value={formatINR(totalAgedValue)}
          icon={AlertTriangle}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
        />
      </div>

      {/* asOf date picker */}
      <div className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-4">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          As of Date
        </label>
        <input
          type="date"
          value={asOf}
          onChange={e => setAsOf(e.target.value)}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700"
        />
      </div>

      <SectionCard title="Stock Ageing Report">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-gray-400">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-right">0&ndash;30 Days</th>
                <th className="px-4 py-3 text-right">31&ndash;60 Days</th>
                <th className="px-4 py-3 text-right">61&ndash;90 Days</th>
                {/* >90 days column — amber per D-09 and CLAUDE.md */}
                <th className="px-4 py-3 text-right bg-amber-50 text-amber-700">
                  &gt;90 Days
                </th>
                <th className="px-4 py-3 text-right">Total Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data?.rows ?? []).map(row => (
                <tr key={row.itemId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700 font-medium">
                    {row.name}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                    <div>{row.b0_30_qty} units</div>
                    <div className="text-xs text-gray-400">
                      {formatINR(row.b0_30_value)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                    <div>{row.b31_60_qty} units</div>
                    <div className="text-xs text-gray-400">
                      {formatINR(row.b31_60_value)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                    <div>{row.b61_90_qty} units</div>
                    <div className="text-xs text-gray-400">
                      {formatINR(row.b61_90_value)}
                    </div>
                  </td>
                  {/* >90 days cells — amber highlight per D-09 and CLAUDE.md */}
                  <td className="px-4 py-3 text-right tabular-nums bg-amber-100 text-amber-700">
                    <div className="font-medium">{row.b90plus_qty} units</div>
                    <div className="text-xs">{formatINR(row.b90plus_value)}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">
                    {formatINR(row.totalValue)}
                  </td>
                </tr>
              ))}
              {(data?.rows?.length ?? 0) === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    No unconsumed stock batches found as of {asOf}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  )
}
