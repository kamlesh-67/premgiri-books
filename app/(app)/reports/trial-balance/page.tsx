import Link from 'next/link'
import { CheckCircle2, XCircle } from 'lucide-react'
import { redirect } from 'next/navigation'
import Decimal from 'decimal.js'
import { PageHeader } from '@/components/primitives/PageHeader'
import { SectionCard } from '@/components/primitives/SectionCard'
import { DataTable, type Column } from '@/components/primitives/DataTable'
import { getFY, getFYStart, getFYEnd } from '@/lib/utils/fy'
import { formatINR } from '@/lib/utils/format'
import { getTrialBalance, validateTrialBalance, type TrialBalanceRow } from '@/lib/services/ReportEngine'
import { auth } from '@/lib/auth'

// RSC page — reads fy from searchParams
export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string }>
}) {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  const companyId = session.user.companyId

  const { fy: fyParam } = await searchParams
  const fy = fyParam ?? getFY()
  const fyStart = getFYStart(fy)
  const fyEnd = getFYEnd(fy)

  const rows = await getTrialBalance(companyId, fy)
  const balanced = validateTrialBalance(rows)

  // FY selector options: current FY and 3 prior years
  const currentFY = getFY()
  const currentYear = parseInt(currentFY.split('-')[0])
  const fyOptions = [0, 1, 2, 3].map((i) => {
    const y = currentYear - i
    return `${y}-${String(y + 1).slice(-2)}`
  })

  // Total row aggregates
  const totalClosingDR = rows.reduce((sum, r) => sum.plus(r.closingDR), new Decimal(0))
  const totalClosingCR = rows.reduce((sum, r) => sum.plus(r.closingCR), new Decimal(0))

  const columns: Column<TrialBalanceRow>[] = [
    {
      key: 'name',
      header: 'Account',
      cell: (r) => (
        <Link
          href={`/masters/ledgers/${r.ledgerId}`}
          className="font-medium text-purple-600 hover:underline"
        >
          {r.name}
        </Link>
      ),
    },
    {
      key: 'groupName',
      header: 'Group',
      cell: (r) => <span className="text-gray-500">{r.groupName}</span>,
    },
    {
      key: 'openingDR',
      header: 'Opening DR',
      align: 'right',
      cell: (r) =>
        r.openingDR.gt(0) ? (
          <span className="tabular-nums">{formatINR(r.openingDR)}</span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: 'openingCR',
      header: 'Opening CR',
      align: 'right',
      cell: (r) =>
        r.openingCR.gt(0) ? (
          <span className="tabular-nums">{formatINR(r.openingCR)}</span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: 'periodDR',
      header: 'Period DR',
      align: 'right',
      cell: (r) =>
        r.periodDR.gt(0) ? (
          <span className="tabular-nums">{formatINR(r.periodDR)}</span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: 'periodCR',
      header: 'Period CR',
      align: 'right',
      cell: (r) =>
        r.periodCR.gt(0) ? (
          <span className="tabular-nums">{formatINR(r.periodCR)}</span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: 'closingDR',
      header: 'Closing DR',
      align: 'right',
      cell: (r) =>
        r.closingDR.gt(0) ? (
          <span className="tabular-nums font-medium">{formatINR(r.closingDR)}</span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: 'closingCR',
      header: 'Closing CR',
      align: 'right',
      cell: (r) =>
        r.closingCR.gt(0) ? (
          <span className="tabular-nums font-medium">{formatINR(r.closingCR)}</span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
  ]

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Trial Balance"
        subtitle={`${fy} · ${fyStart.toLocaleDateString('en-IN')} to ${fyEnd.toLocaleDateString('en-IN')}`}
        actions={
          <div className="flex items-center gap-3">
            {/* FY picker — plain HTML form, works without JS */}
            <form method="GET" className="flex items-center gap-2">
              <select
                name="fy"
                defaultValue={fy}
                className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {fyOptions.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
              >
                Go
              </button>
            </form>
            {/* DR=CR balancing indicator */}
            {balanced ? (
              <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Balanced
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                <XCircle className="h-3.5 w-3.5" /> Out of Balance
              </span>
            )}
          </div>
        }
      />
      <SectionCard>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.ledgerId}
          footer={
            <tr className="bg-gray-50 font-semibold">
              <td colSpan={6} className="px-4 py-3 text-right text-sm text-gray-700">
                Total
              </td>
              <td className="px-4 py-3 text-right text-sm tabular-nums">
                {formatINR(totalClosingDR)}
              </td>
              <td className="px-4 py-3 text-right text-sm tabular-nums">
                {formatINR(totalClosingCR)}
              </td>
            </tr>
          }
        />
      </SectionCard>
    </div>
  )
}
