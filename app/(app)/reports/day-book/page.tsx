'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { PageHeader } from '@/components/primitives/PageHeader'
import { SectionCard } from '@/components/primitives/SectionCard'
import { DataTable, type Column } from '@/components/primitives/DataTable'
import { formatINR, formatDate } from '@/lib/utils/format'

interface DayBookRow {
  id: string
  date: string
  voucherNo: string
  voucherType: string
  narration: string | null
  partyName: string | null
  totalAmount: string
}

const TABS = ['ALL', 'SALES', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'JOURNAL', 'CONTRA']

const TYPE_LABELS: Record<string, string> = {
  SALES: 'Sales',
  PURCHASE: 'Purchase',
  RECEIPT: 'Receipt',
  PAYMENT: 'Payment',
  JOURNAL: 'Journal',
  CONTRA: 'Contra',
  CREDIT_NOTE: 'Credit Note',
  DEBIT_NOTE: 'Debit Note',
}

function toISO(d: Date) {
  return d.toISOString().split('T')[0]
}

export default function DayBookPage() {
  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)

  const [from, setFrom] = useState(toISO(thirtyDaysAgo))
  const [to, setTo] = useState(toISO(today))
  const [activeType, setActiveType] = useState('ALL')

  const url = `/api/v1/reports/day-book?from=${from}&to=${to}${activeType !== 'ALL' ? '&type=' + activeType : ''}`

  const { data, isLoading, error } = useQuery<{ rows: DayBookRow[] }>({
    queryKey: ['day-book', from, to, activeType],
    queryFn: () =>
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(r.statusText)
        return r.json()
      }),
  })

  const rows = data?.rows ?? []

  const totalAmount = rows.reduce((sum, r) => sum + parseFloat(r.totalAmount), 0)

  const columns: Column<DayBookRow>[] = [
    {
      key: 'date',
      header: 'Date',
      cell: (r) => <span className="text-gray-600">{formatDate(r.date)}</span>,
    },
    {
      key: 'voucherNo',
      header: 'Voucher No',
      cell: (r) => (
        <Link
          href={`/vouchers/${r.id}`}
          className="font-medium text-purple-600 hover:underline"
        >
          {r.voucherNo}
        </Link>
      ),
    },
    {
      key: 'voucherType',
      header: 'Type',
      cell: (r) => (
        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {TYPE_LABELS[r.voucherType] ?? r.voucherType}
        </span>
      ),
    },
    {
      key: 'party',
      header: 'Party / Narration',
      cell: (r) => (
        <span className="text-gray-700">{r.partyName ?? r.narration ?? '—'}</span>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      align: 'right',
      cell: (r) => (
        <span className="tabular-nums font-medium">{formatINR(r.totalAmount)}</span>
      ),
    },
  ]

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Day Book"
        subtitle="All posted vouchers for the selected date range"
        actions={
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700"
            />
          </div>
        }
      />

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveType(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeType === tab
                ? 'border-b-2 border-purple-600 text-purple-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'ALL' ? 'All' : TYPE_LABELS[tab]}
          </button>
        ))}
      </div>

      <SectionCard>
        {isLoading && (
          <p className="p-8 text-center text-sm text-gray-500">Loading...</p>
        )}
        {error && (
          <p className="p-8 text-center text-sm text-red-600">
            {error instanceof Error ? error.message : 'Failed to load day book'}
          </p>
        )}
        {!isLoading && !error && (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            empty={
              <p className="py-8 text-center text-sm text-gray-400">
                No vouchers posted in this date range.
              </p>
            }
            footer={
              rows.length > 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm text-gray-600">
                    {rows.length} voucher{rows.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">
                    {formatINR(totalAmount)}
                  </td>
                </tr>
              ) : undefined
            }
          />
        )}
      </SectionCard>
    </div>
  )
}
