'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { IndianRupee, AlertTriangle, Clock } from 'lucide-react'
import { PageHeader } from '@/components/primitives/PageHeader'
import { SectionCard } from '@/components/primitives/SectionCard'
import { DataTable, type Column } from '@/components/primitives/DataTable'
import { KpiCard } from '@/components/primitives/KpiCard'
import { formatINR, formatDate } from '@/lib/utils/format'
import Decimal from 'decimal.js'

interface OutstandingRow {
  billRefId: string
  ledgerId: string
  partyName: string
  voucherNo: string
  billDate: string
  dueDate: string
  daysOverdue: number
  bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+'
  outstandingAmount: string
}

function ageCell(row: OutstandingRow, targetBucket: string) {
  if (row.bucket !== targetBucket) return <span className="text-gray-300">—</span>
  const cls =
    row.daysOverdue > 90
      ? 'text-red-600 font-semibold tabular-nums'
      : row.daysOverdue > 60
      ? 'text-amber-600 font-semibold tabular-nums'
      : 'tabular-nums'
  return <span className={cls}>{formatINR(row.outstandingAmount)}</span>
}

const columns: Column<OutstandingRow>[] = [
  {
    key: 'partyName',
    header: 'Party',
    cell: (r) => <span className="font-medium text-gray-800">{r.partyName}</span>,
  },
  {
    key: 'voucherNo',
    header: 'Invoice No',
    cell: (r) => <span className="font-mono text-sm text-gray-600">{r.voucherNo}</span>,
  },
  {
    key: 'dueDate',
    header: 'Due Date',
    cell: (r) => <span className="text-gray-600">{formatDate(r.dueDate)}</span>,
  },
  {
    key: 'daysOverdue',
    header: 'Days Overdue',
    align: 'right',
    cell: (r) => (
      <span
        className={
          r.daysOverdue > 90
            ? 'font-semibold text-red-600 tabular-nums'
            : r.daysOverdue > 60
            ? 'font-semibold text-amber-600 tabular-nums'
            : r.daysOverdue > 0
            ? 'tabular-nums text-gray-700'
            : 'tabular-nums text-green-600'
        }
      >
        {r.daysOverdue > 0 ? r.daysOverdue : 'Current'}
      </span>
    ),
  },
  {
    key: 'bucket_current',
    header: '0–30',
    align: 'right',
    cell: (r) => ageCell(r, '1-30'),
  },
  {
    key: 'bucket_31_60',
    header: '31–60',
    align: 'right',
    cell: (r) => ageCell(r, '31-60'),
  },
  {
    key: 'bucket_61_90',
    header: '61–90',
    align: 'right',
    cell: (r) => ageCell(r, '61-90'),
  },
  {
    key: 'bucket_90plus',
    header: '90+',
    align: 'right',
    cell: (r) => ageCell(r, '90+'),
  },
  {
    key: 'outstandingAmount',
    header: 'Total',
    align: 'right',
    cell: (r) => (
      <span className="font-semibold tabular-nums">{formatINR(r.outstandingAmount)}</span>
    ),
  },
]

export default function OutstandingPage() {
  const [activeTab, setActiveTab] = useState<'receivable' | 'payable'>('receivable')

  const receivablesQuery = useQuery<{ rows: OutstandingRow[] }>({
    queryKey: ['outstanding', 'receivable'],
    queryFn: () =>
      fetch('/api/v1/reports/outstanding?type=receivable').then((r) => r.json()),
  })

  const payablesQuery = useQuery<{ rows: OutstandingRow[] }>({
    queryKey: ['outstanding', 'payable'],
    queryFn: () =>
      fetch('/api/v1/reports/outstanding?type=payable').then((r) => r.json()),
  })

  const activeQuery = activeTab === 'receivable' ? receivablesQuery : payablesQuery
  const rows = activeQuery.data?.rows ?? []

  // KPI computations using Decimal to avoid float errors
  const total = rows.reduce(
    (sum, r) => sum.plus(new Decimal(r.outstandingAmount)),
    new Decimal(0)
  )
  const overdue30 = rows
    .filter((r) => r.daysOverdue > 30)
    .reduce((sum, r) => sum.plus(new Decimal(r.outstandingAmount)), new Decimal(0))
  const critical90 = rows
    .filter((r) => r.bucket === '90+')
    .reduce((sum, r) => sum.plus(new Decimal(r.outstandingAmount)), new Decimal(0))

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title={activeTab === 'receivable' ? 'Outstanding Receivables' : 'Outstanding Payables'}
        subtitle={
          activeTab === 'receivable'
            ? 'Who owes me money — and how late are they?'
            : 'What I owe — and when it\'s due'
        }
      />

      {/* Receivable / Payable tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['receivable', 'payable'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-purple-600 text-purple-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'receivable' ? 'Receivables' : 'Payables'}
          </button>
        ))}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          title={activeTab === 'receivable' ? 'Total Receivable' : 'Total Payable'}
          value={formatINR(total)}
          icon={IndianRupee}
          iconTone="primary"
        />
        <KpiCard
          title="Overdue >30 days"
          value={formatINR(overdue30)}
          icon={AlertTriangle}
          iconTone="warning"
        />
        <KpiCard
          title="Critical >90 days"
          value={formatINR(critical90)}
          icon={Clock}
          iconTone="destructive"
        />
      </div>

      <SectionCard>
        {activeQuery.isLoading && (
          <p className="p-8 text-center text-sm text-gray-500">Loading outstanding bills...</p>
        )}
        {activeQuery.isError && (
          <p className="p-8 text-center text-sm text-red-600">Failed to load outstanding data.</p>
        )}
        {!activeQuery.isLoading && !activeQuery.isError && (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.billRefId}
            empty={
              <p className="py-8 text-center text-sm text-gray-400">
                No outstanding {activeTab === 'receivable' ? 'receivables' : 'payables'} found.
              </p>
            }
          />
        )}
      </SectionCard>
    </div>
  )
}
