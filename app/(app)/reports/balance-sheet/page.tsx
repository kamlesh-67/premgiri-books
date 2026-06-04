import { readSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { Download, CheckCircle2, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/primitives/PageHeader'
import { SectionCard } from '@/components/primitives/SectionCard'
import { getFY, getFYEnd } from '@/lib/utils/fy'
import { formatINR } from '@/lib/utils/format'
import { getBalanceSheet } from '@/lib/services/ReportEngine'
import type { AccountGroupNode } from '@/lib/services/ReportEngine'

// Recursive renderer for an AccountGroupNode tree
function GroupNode({ node, depth = 0 }: { node: AccountGroupNode; depth?: number }) {
  return (
    <div className={depth > 0 ? 'ml-4' : ''}>
      <div
        className={`flex justify-between py-1 ${
          depth === 0
            ? 'mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500'
            : 'text-sm font-medium text-gray-800'
        }`}
      >
        <span>{node.name}</span>
        {depth > 0 && (
          <span className="tabular-nums">{formatINR(node.subtotal)}</span>
        )}
      </div>
      {node.ledgers.map((l) => (
        <div
          key={l.id}
          className="flex justify-between py-0.5 pl-4 text-sm text-gray-600"
        >
          <span>{l.name}</span>
          <span className="tabular-nums">{formatINR(l.balance)}</span>
        </div>
      ))}
      {node.children.map((child) => (
        <GroupNode key={child.id} node={child} depth={depth + 1} />
      ))}
      {depth === 0 && (
        <div className="mt-1 flex justify-between border-t border-gray-200 pt-1.5 text-sm font-semibold text-gray-800">
          <span>{node.name} Total</span>
          <span className="tabular-nums">{formatINR(node.subtotal)}</span>
        </div>
      )}
    </div>
  )
}

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string }>
}) {
  const session = await readSession()
  if (!session?.companyId) redirect('/login')
  const companyId = session.companyId

  const { fy: fyParam } = await searchParams
  const fy = fyParam ?? getFY()
  const asAt = getFYEnd(fy)

  const result = await getBalanceSheet(companyId, fy)

  const currentFY = getFY()
  const currentYear = parseInt(currentFY.split('-')[0])
  const fyOptions = [0, 1, 2, 3].map((i) => {
    const y = currentYear - i
    return `${y}-${String(y + 1).slice(-2)}`
  })

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Schedule III — Balance Sheet */}
      <PageHeader
        title="Balance Sheet"
        subtitle={`Schedule III · As at ${asAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`}
        actions={
          <div className="flex items-center gap-3">
            <form method="GET">
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
            </form>
            {result.balanced ? (
              <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Assets = Liabilities + Equity
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                <XCircle className="h-3.5 w-3.5" /> Out of Balance
              </span>
            )}
            <a
              href={`/api/v1/reports/balance-sheet/export?fy=${fy}`}
              className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" /> Download Excel
            </a>
          </div>
        }
      />

      {/* Schedule III — single column vertical layout: Equity & Liabilities first */}
      <SectionCard title="Equity and Liabilities">
        {result.liabilityGroups.map((g) => (
          <GroupNode key={g.id} node={g} />
        ))}
        <div className="mt-4 flex justify-between rounded-md bg-primary-soft px-4 py-2 text-sm font-bold text-primary">
          <span>TOTAL EQUITY AND LIABILITIES</span>
          <span className="tabular-nums">{formatINR(result.totalEquityLiabilities)}</span>
        </div>
      </SectionCard>

      <SectionCard title="Assets">
        {result.assetGroups.map((g) => (
          <GroupNode key={g.id} node={g} />
        ))}
        <div className="mt-4 flex justify-between rounded-md bg-primary-soft px-4 py-2 text-sm font-bold text-primary">
          <span>TOTAL ASSETS</span>
          <span className="tabular-nums">{formatINR(result.totalAssets)}</span>
        </div>
      </SectionCard>
    </div>
  )
}
