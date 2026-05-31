import { readSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { Download } from 'lucide-react'
import { PageHeader } from '@/components/primitives/PageHeader'
import { SectionCard } from '@/components/primitives/SectionCard'
import { getFY, getFYStart, getFYEnd } from '@/lib/utils/fy'
import { formatINR } from '@/lib/utils/format'
import { getProfitLoss } from '@/lib/services/ReportEngine'
import type { ProfitLossGroup } from '@/lib/services/ReportEngine'

function PLGroupRows({
  groups,
  showCompare,
}: {
  groups: ProfitLossGroup[]
  showCompare: boolean
}) {
  return (
    <>
      {groups.map((g) => (
        <div key={g.groupName}>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {g.groupName}
          </p>
          {g.ledgers.map((l) => (
            <div
              key={l.name}
              className="flex justify-between py-0.5 text-sm text-gray-600"
            >
              <span className="pl-4">{l.name}</span>
              <span className="tabular-nums">{formatINR(l.amount)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-gray-100 pt-1 text-sm font-medium text-gray-800">
            <span>{g.groupName} Total</span>
            <span className="tabular-nums">{formatINR(g.subtotal)}</span>
          </div>
        </div>
      ))}
    </>
  )
}

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string; compareFy?: string }>
}) {
  const session = await readSession()
  if (!session?.user?.companyId) redirect('/login')
  const companyId = session.companyId

  const { fy: fyParam, compareFy: compareFyParam } = await searchParams
  const fy = fyParam ?? getFY()
  const compareFy = compareFyParam || undefined

  const result = await getProfitLoss(companyId, fy, compareFy)

  const currentFY = getFY()
  const currentYear = parseInt(currentFY.split('-')[0])
  const fyOptions = [0, 1, 2, 3].map((i) => {
    const y = currentYear - i
    return `${y}-${String(y + 1).slice(-2)}`
  })

  const grossProfitPositive = result.grossProfit.gte(0)
  const netProfitPositive = result.netProfit.gte(0)

  const fyStart = getFYStart(fy)
  const fyEnd = getFYEnd(fy)

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Profit & Loss"
        subtitle={`${fyStart.toLocaleDateString('en-IN')} to ${fyEnd.toLocaleDateString('en-IN')}`}
        actions={
          <div className="flex items-center gap-3">
            <form method="GET" className="flex items-center gap-2">
              <select
                name="fy"
                defaultValue={fy}
                className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700"
              >
                {fyOptions.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-400">vs</span>
              <select
                name="compareFy"
                defaultValue={compareFy ?? ''}
                className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700"
              >
                <option value="">No comparison</option>
                {fyOptions.slice(1).map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Apply
              </button>
            </form>
            <a
              href={`/api/v1/reports/profit-loss/export?fy=${fy}`}
              className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" /> Download Excel
            </a>
          </div>
        }
      />

      <SectionCard title={`Profit & Loss — ${fy}`}>
        {/* Trading Income */}
        <p className="text-base font-semibold text-gray-800">Trading Income</p>
        <PLGroupRows groups={result.tradingIncome} showCompare={result.hasCompareFyData} />

        {/* Trading Expenses */}
        <p className="mt-6 text-base font-semibold text-gray-800">Trading Expenses</p>
        <PLGroupRows groups={result.tradingExpenses} showCompare={result.hasCompareFyData} />

        {/* Gross Profit subtotal */}
        <div
          className={`mt-4 flex justify-between rounded-md px-4 py-2 text-sm font-bold ${
            grossProfitPositive ? 'bg-success-soft text-success' : 'bg-red-50 text-red-700'
          }`}
        >
          <span>{grossProfitPositive ? 'Gross Profit' : 'Gross Loss'}</span>
          <div className="flex items-center gap-6">
            <span className="tabular-nums">{formatINR(result.grossProfit.abs())}</span>
            {result.hasCompareFyData && result.compareGrossProfit && (
              <span className="tabular-nums text-gray-400">
                {formatINR(result.compareGrossProfit.abs())} ({result.compareFy})
              </span>
            )}
          </div>
        </div>

        {/* Other Income */}
        {result.otherIncome.length > 0 && (
          <>
            <p className="mt-6 text-base font-semibold text-gray-800">Other Income</p>
            <PLGroupRows groups={result.otherIncome} showCompare={result.hasCompareFyData} />
          </>
        )}

        {/* Other Expenses */}
        {result.otherExpenses.length > 0 && (
          <>
            <p className="mt-6 text-base font-semibold text-gray-800">Other Expenses</p>
            <PLGroupRows groups={result.otherExpenses} showCompare={result.hasCompareFyData} />
          </>
        )}

        {/* Net Profit / Loss */}
        <div
          className={`mt-4 flex justify-between rounded-md px-4 py-2 text-sm font-bold ${
            netProfitPositive ? 'bg-success-soft text-success' : 'bg-red-50 text-red-700'
          }`}
        >
          <span>{netProfitPositive ? 'Net Profit' : 'Net Loss'}</span>
          <div className="flex items-center gap-6">
            <span className="tabular-nums">{formatINR(result.netProfit.abs())}</span>
            {result.hasCompareFyData && result.compareNetProfit && (
              <span className="tabular-nums text-gray-400">
                {formatINR(result.compareNetProfit.abs())} ({result.compareFy})
              </span>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
