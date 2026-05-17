'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, PowerOff, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/PageHeader'
import { FilterTabs } from '@/components/shared/FilterTabs'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { LedgerForm } from '@/components/masters/LedgerForm'
import type { LedgerInput } from '@/lib/schemas/masters'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Ledger {
  id: string
  name: string
  groupId: string
  groupPath: string
  openingBalance: string
  drCr: 'DR' | 'CR'
  gstRegType: string | null
  gstin: string | null
  pan: string | null
  creditLimit: string | null
  creditDays: number | null
  bankName: string | null
  bankAccount: string | null
  ifsc: string | null
  isActive: boolean
}

type NatureFilter = 'ALL' | 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE'

const NATURE_TABS = [
  { label: 'All', value: 'ALL' as NatureFilter },
  { label: 'Assets', value: 'ASSET' as NatureFilter },
  { label: 'Liabilities', value: 'LIABILITY' as NatureFilter },
  { label: 'Income', value: 'INCOME' as NatureFilter },
  { label: 'Expense', value: 'EXPENSE' as NatureFilter },
]

// ─── LedgersClient ───────────────────────────────────────────────────────────

export default function LedgersClient() {
  const queryClient = useQueryClient()
  const [activeNature, setActiveNature] = useState<NatureFilter>('ALL')
  const [showForm, setShowForm] = useState(false)
  const [editLedger, setEditLedger] = useState<Ledger | null>(null)
  const [deactivateLedger, setDeactivateLedger] = useState<Ledger | null>(null)

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: ledgers = [], isLoading } = useQuery<Ledger[]>({
    queryKey: ['ledgers', activeNature],
    queryFn: () => {
      const url =
        activeNature !== 'ALL'
          ? `/api/v1/masters/ledgers?nature=${activeNature}`
          : '/api/v1/masters/ledgers'
      return fetch(url).then((r) => r.json())
    },
    staleTime: 30 * 1000,
  })

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: LedgerInput) =>
      fetch('/api/v1/masters/ledgers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json()
          throw new Error(body.error ?? 'Failed to create ledger')
        }
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledgers'] })
      toast.success('Ledger created successfully.', { duration: 3000 })
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to create ledger.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<LedgerInput> }) =>
      fetch(`/api/v1/masters/ledgers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json()
          throw new Error(body.error ?? 'Failed to update ledger')
        }
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledgers'] })
      toast.success('Ledger updated successfully.', { duration: 3000 })
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update ledger.')
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/v1/masters/ledgers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json()
          throw new Error(body.error ?? 'Failed to deactivate ledger')
        }
        return r.json()
      }),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['ledgers'] })
      const name = ledgers.find((l) => l.id === id)?.name ?? ''
      toast.success(`${name} has been deactivated.`, { duration: 3000 })
      setDeactivateLedger(null)
    },
    onError: () => {
      toast.error('Failed to deactivate ledger. Please try again.')
      setDeactivateLedger(null)
    },
  })

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function handleSave(data: LedgerInput) {
    if (editLedger) {
      await updateMutation.mutateAsync({ id: editLedger.id, data })
    } else {
      await createMutation.mutateAsync(data)
    }
    setEditLedger(null)
    setShowForm(false)
  }

  function handleEditClick(ledger: Ledger) {
    setEditLedger(ledger)
    setShowForm(true)
  }

  function handleNewClick() {
    setEditLedger(null)
    setShowForm(true)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
        <PageHeader
          title="Ledgers"
          subtitle="Manage all account ledgers across the chart of accounts"
          action={
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={handleNewClick}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Ledger
            </Button>
          }
        />

        {/* FilterTabs: All / Assets / Liabilities / Income / Expense */}
        <FilterTabs
          tabs={NATURE_TABS}
          value={activeNature}
          onChange={setActiveNature}
        />

        {/* Table or empty state */}
        {isLoading ? null : ledgers.length === 0 ? (
          /* D-24: Friendly empty state */
          <EmptyState
            icon={BookOpen}
            title="No ledgers yet."
            description="Create ledgers to record account balances and track money movement."
            action={{ label: 'New Ledger', onClick: handleNewClick }}
          />
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Ledgers list">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Account Group
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-36">
                      Opening Balance
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-40">
                      GSTIN
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-20">
                      Status
                    </th>
                    <th className="px-4 py-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ledgers.map((ledger) => (
                    <tr key={ledger.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {ledger.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {ledger.groupPath || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <AmountDisplay amount={ledger.openingBalance} size="sm" />
                        <span className="ml-1 text-xs text-gray-400">{ledger.drCr}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                        {ledger.gstin ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={ledger.isActive ? 'ACTIVE' : 'INACTIVE'} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label={`Edit ${ledger.name}`}
                                onClick={() => handleEditClick(ledger)}
                              >
                                <Pencil className="h-3.5 w-3.5 text-gray-500" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          {ledger.isActive && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label={`Deactivate ${ledger.name}`}
                                  onClick={() => setDeactivateLedger(ledger)}
                                >
                                  <PowerOff className="h-3.5 w-3.5 text-gray-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Deactivate</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LedgerForm dialog — opened by New Ledger or Edit row action */}
        <LedgerForm
          open={showForm}
          onOpenChange={(open) => {
            setShowForm(open)
            if (!open) setEditLedger(null)
          }}
          ledger={editLedger}
          onSave={handleSave}
        />

        {/* Deactivate Confirmation Dialog — UI-SPEC 9.7 */}
        <AlertDialog
          open={!!deactivateLedger}
          onOpenChange={(open) => { if (!open) setDeactivateLedger(null) }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate {deactivateLedger?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will hide {deactivateLedger?.name} from account dropdowns. Existing
                voucher entries will not be affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  if (deactivateLedger) deactivateMutation.mutate(deactivateLedger.id)
                }}
              >
                Deactivate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}
