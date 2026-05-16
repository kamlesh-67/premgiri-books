'use client'

import { Fragment, useState } from 'react'
import { ShieldOff, ChevronDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/primitives/PageHeader'
import { SectionCard } from '@/components/primitives/SectionCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { DateRangePicker } from '@/components/shared/DateRangePicker'
import { usePermission } from '@/hooks/usePermission'

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditLogRow = {
  id: string
  entity: string
  entityId: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CANCEL' | 'POST'
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
  createdAt: string
  user: { id: string; name: string; email: string }
}

type AuditLogsResponse = {
  data: AuditLogRow[]
  nextCursor: string | null
}

interface UserListItem {
  id: string
  name: string
  email: string
}

// ─── Helper functions ─────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date(iso))
    .replace(',', ' ·')
}

function humanEntity(entity: string): string {
  return (
    ({
      User: 'User',
      Role: 'Role',
      Company: 'Company',
      Employee: 'Employee',
      Voucher: 'Transaction',
      Ledger: 'Ledger',
      StockItem: 'Stock Item',
      PayRun: 'Pay Run',
    } as Record<string, string>)[entity] ?? entity
  )
}

function actionBadgeClass(action: string): string {
  return (
    ({
      CREATE: 'bg-green-100 text-green-700',
      UPDATE: 'bg-blue-100 text-blue-700',
      CANCEL: 'bg-red-100 text-red-700',
      DELETE: 'bg-red-100 text-red-700',
      POST: 'bg-purple-100 text-purple-700',
    } as Record<string, string>)[action] ?? 'bg-gray-100 text-gray-600'
  )
}

// ─── DiffView ─────────────────────────────────────────────────────────────────

interface DiffViewProps {
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
}

function DiffView({ oldValue, newValue }: DiffViewProps) {
  const [showAll, setShowAll] = useState(false)

  const allKeys = Array.from(
    new Set([
      ...Object.keys(oldValue ?? {}),
      ...Object.keys(newValue ?? {}),
    ])
  )

  const changedFields = allKeys.filter(
    (k) =>
      JSON.stringify((oldValue ?? {})[k]) !== JSON.stringify((newValue ?? {})[k])
  )

  const visibleFields = showAll ? changedFields : changedFields.slice(0, 3)

  if (changedFields.length === 0) {
    return <p className="text-xs text-gray-400 italic">No field-level diff available.</p>
  }

  return (
    <div>
      <table className="text-xs w-full max-w-lg">
        <thead>
          <tr>
            <th className="text-left text-gray-500 uppercase tracking-wide pr-4 pb-1">Field</th>
            <th className="text-left text-gray-500 uppercase tracking-wide pr-4 pb-1">Old</th>
            <th className="text-left text-gray-500 uppercase tracking-wide pb-1">New</th>
          </tr>
        </thead>
        <tbody>
          {visibleFields.map((field) => {
            const oldVal = (oldValue ?? {})[field]
            const newVal = (newValue ?? {})[field]
            return (
              <tr key={field} className="bg-amber-50">
                <td className="pr-4 py-1 text-gray-600">{field}</td>
                <td className="pr-4 py-1 text-gray-500 line-through">
                  {oldVal == null ? (
                    <em className="text-gray-400">(empty)</em>
                  ) : (
                    String(oldVal)
                  )}
                </td>
                <td className="py-1 text-amber-700 font-semibold">
                  {newVal == null ? (
                    <em className="text-gray-400">(empty)</em>
                  ) : (
                    String(newVal)
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {changedFields.length > 3 && !showAll && (
        <button
          className="mt-2 text-sm text-purple-600 hover:underline"
          onClick={() => setShowAll(true)}
        >
          Show all {changedFields.length} changes
        </button>
      )}
      {showAll && changedFields.length > 3 && (
        <button
          className="mt-2 text-sm text-purple-600 hover:underline"
          onClick={() => setShowAll(false)}
        >
          Show less
        </button>
      )}
    </div>
  )
}

// ─── Entity type options ──────────────────────────────────────────────────────

const ENTITY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'Voucher', label: 'Transaction' },
  { value: 'Ledger', label: 'Ledger' },
  { value: 'User', label: 'User' },
  { value: 'Role', label: 'Role' },
  { value: 'Company', label: 'Company' },
  { value: 'Employee', label: 'Employee' },
  { value: 'StockItem', label: 'Stock Item' },
  { value: 'PayRun', label: 'Pay Run' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditTrailPage() {
  const isAdmin = usePermission('settings', 'admin')

  const [userFilter, setUserFilter] = useState('')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [entityFilter, setEntityFilter] = useState('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [prevCursors, setPrevCursors] = useState<(string | null)[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── Permission gate ──────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <ShieldOff className="h-12 w-12 text-gray-300 mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            You don&apos;t have permission to view this page.
          </h2>
          <p className="text-sm text-gray-500">Contact your Admin.</p>
        </div>
      </div>
    )
  }

  // ── Data fetching ────────────────────────────────────────────────────────────
  const params = new URLSearchParams()
  if (userFilter) params.set('userId', userFilter)
  if (dateRange?.from) params.set('dateFrom', dateRange.from.toISOString())
  if (dateRange?.to) params.set('dateTo', dateRange.to.toISOString())
  if (entityFilter) params.set('entity', entityFilter)
  if (cursor) params.set('cursor', cursor)

  const { data, isLoading } = useQuery<AuditLogsResponse>({
    queryKey: ['audit-logs', userFilter, dateRange, entityFilter, cursor],
    queryFn: () =>
      fetch(`/api/v1/audit-logs?${params.toString()}`).then((r) => {
        if (!r.ok) throw new Error('Failed to load audit logs')
        return r.json() as Promise<AuditLogsResponse>
      }),
    enabled: isAdmin,
  })

  const { data: usersData } = useQuery<UserListItem[]>({
    queryKey: ['users-list'],
    queryFn: () =>
      fetch('/api/v1/users').then((r) => {
        if (!r.ok) throw new Error('Failed to load users')
        return r.json() as Promise<UserListItem[]>
      }),
    enabled: isAdmin,
  })

  // ── Filter helpers ───────────────────────────────────────────────────────────
  const hasActiveFilters = !!(userFilter || dateRange?.from || dateRange?.to || entityFilter)

  function clearAll() {
    setUserFilter('')
    setDateRange(undefined)
    setEntityFilter('')
    setCursor(null)
    setPrevCursors([])
  }

  function resetPage() {
    setCursor(null)
    setPrevCursors([])
  }

  // ── Pagination ───────────────────────────────────────────────────────────────
  function handleNext() {
    if (!data?.nextCursor) return
    setPrevCursors((prev) => [...prev, cursor])
    setCursor(data.nextCursor)
    setExpandedId(null)
  }

  function handlePrev() {
    if (prevCursors.length === 0) return
    const previous = [...prevCursors]
    const popped = previous.pop() ?? null
    setPrevCursors(previous)
    setCursor(popped)
    setExpandedId(null)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const rows = data?.data ?? []
  const isEmpty = !isLoading && rows.length === 0

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Audit Trail"
        subtitle="All changes made to your company data"
      />

      {/* Filter bar */}
      <div className="flex gap-3 flex-wrap items-center">
        {/* User filter */}
        <Select
          value={userFilter}
          onValueChange={(v) => {
            setUserFilter(v)
            resetPage()
          }}
        >
          <SelectTrigger className="h-9 min-w-[160px]">
            <SelectValue placeholder="All Users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Users</SelectItem>
            {(usersData ?? []).map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range */}
        <DateRangePicker
          value={dateRange}
          onChange={(r) => {
            setDateRange(r)
            resetPage()
          }}
          placeholder="Date range"
        />

        {/* Entity type filter */}
        <Select
          value={entityFilter}
          onValueChange={(v) => {
            setEntityFilter(v)
            resetPage()
          }}
        >
          <SelectTrigger className="h-9 min-w-[150px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="text-sm text-purple-600 hover:underline"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table card */}
      <SectionCard>
        {isEmpty ? (
          <EmptyState
            title="No activity yet"
            description="Changes to your company data will appear here."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-xs font-normal text-gray-500 uppercase tracking-wide px-4 py-3 text-left">
                      Timestamp
                    </th>
                    <th className="text-xs font-normal text-gray-500 uppercase tracking-wide px-4 py-3 text-left">
                      User
                    </th>
                    <th className="text-xs font-normal text-gray-500 uppercase tracking-wide px-4 py-3 text-left">
                      Action
                    </th>
                    <th className="text-xs font-normal text-gray-500 uppercase tracking-wide px-4 py-3 text-left">
                      Entity
                    </th>
                    <th className="text-xs font-normal text-gray-500 uppercase tracking-wide px-4 py-3 text-left">
                      Reference
                    </th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="h-4 bg-gray-100 rounded animate-pulse" />
                          </td>
                        </tr>
                      ))
                    : rows.map((row) => (
                        <Fragment key={row.id}>
                          <tr
                            className="border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                            onClick={() =>
                              setExpandedId(expandedId === row.id ? null : row.id)
                            }
                          >
                            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                              {formatTimestamp(row.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-800">
                              {row.user.name}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${actionBadgeClass(row.action)}`}
                              >
                                {row.action}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {humanEntity(row.entity)}
                            </td>
                            <td className="px-4 py-3 text-sm text-purple-600">
                              {row.entityId}
                            </td>
                            <td className="px-4 py-3">
                              <ChevronDown
                                className={`h-4 w-4 text-gray-400 transition-transform duration-150 ${
                                  expandedId === row.id ? 'rotate-180' : ''
                                }`}
                              />
                            </td>
                          </tr>

                          {expandedId === row.id && (
                            <tr>
                              <td
                                colSpan={6}
                                className="pl-12 pr-4 py-3 bg-gray-50"
                              >
                                <DiffView
                                  oldValue={row.oldValue}
                                  newValue={row.newValue}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="flex justify-between items-center mt-4 px-4">
              <Button
                variant="outline"
                disabled={prevCursors.length === 0}
                onClick={handlePrev}
              >
                ← Previous
              </Button>
              <span className="text-sm text-gray-500">
                Showing {rows.length} results
              </span>
              <Button
                variant="outline"
                disabled={!data?.nextCursor}
                onClick={handleNext}
              >
                Next →
              </Button>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  )
}
