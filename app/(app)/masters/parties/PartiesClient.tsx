'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, UserX, Users } from 'lucide-react'
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
import { CustomerForm } from './forms/CustomerForm'
import { SupplierForm } from './forms/SupplierForm'
import type { UiMode } from '@/lib/stores/uiStore'

interface Party {
  id: string
  name: string
  gstin: string | null
  partyType: 'Customer' | 'Supplier'
  phone: string | null
  openingBalance: string
  drCr: string
  isActive: boolean
}

interface PartiesClientProps {
  initialData: Party[]
  uiMode: UiMode
}

type ActiveTab = 'all' | 'customers' | 'suppliers'

const TABS = [
  { label: 'All', value: 'all' as ActiveTab },
  { label: 'Customers', value: 'customers' as ActiveTab },
  { label: 'Suppliers', value: 'suppliers' as ActiveTab },
]

const EMPTY_STATE_CONFIG: Record<ActiveTab, { title: string; description: string; buttonLabel: string }> = {
  all: {
    title: 'No parties yet.',
    description: 'Add your first customer or supplier to get started.',
    buttonLabel: 'Add Customer',
  },
  customers: {
    title: 'No customers yet.',
    description: 'Add your first customer to start creating sales invoices.',
    buttonLabel: 'Add Customer',
  },
  suppliers: {
    title: 'No suppliers yet.',
    description: 'Add your first supplier to start recording purchases.',
    buttonLabel: 'Add Supplier',
  },
}

export function PartiesClient({ initialData, uiMode }: PartiesClientProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<ActiveTab>('all')
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [editParty, setEditParty] = useState<Party | null>(null)
  const [deactivateParty, setDeactivateParty] = useState<Party | null>(null)

  const { data: parties = initialData } = useQuery<Party[]>({
    queryKey: ['parties'],
    queryFn: () =>
      fetch('/api/v1/masters/ledgers?type=party').then((r) => r.json()),
    initialData,
    staleTime: 30 * 1000,
  })

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/v1/masters/ledgers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      })
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Failed to deactivate.')
      }
      return r.json()
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['parties'] })
      const name = parties.find((p) => p.id === id)?.name ?? ''
      toast.success(`${name} has been deactivated.`, { duration: 3000 })
      setDeactivateParty(null)
    },
    onError: () => {
      toast.error('Failed to deactivate. Please try again.')
      setDeactivateParty(null)
    },
  })

  const filteredParties = parties.filter((p) => {
    if (activeTab === 'customers') return p.partyType === 'Customer'
    if (activeTab === 'suppliers') return p.partyType === 'Supplier'
    return true
  })

  const emptyState = EMPTY_STATE_CONFIG[activeTab]

  function handleAddClick() {
    setEditParty(null)
    if (activeTab === 'suppliers') {
      setShowSupplierForm(true)
    } else {
      setShowCustomerForm(true)
    }
  }

  function handleEditClick(party: Party) {
    setEditParty(party)
    if (party.partyType === 'Supplier') {
      setShowSupplierForm(true)
    } else {
      setShowCustomerForm(true)
    }
  }

  function handleFormSuccess() {
    queryClient.invalidateQueries({ queryKey: ['parties'] })
    setShowCustomerForm(false)
    setShowSupplierForm(false)
    setEditParty(null)
  }

  return (
    <TooltipProvider>
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
        {/* D-19/D-20: mode-aware title */}
        <PageHeader
          title={uiMode === 'simple' ? 'Customers & Suppliers' : 'Parties'}
          subtitle={
            uiMode === 'simple'
              ? 'Manage your customers and suppliers'
              : 'Manage party ledgers — customers and suppliers'
          }
          action={
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={handleAddClick}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add {uiMode === 'simple' ? 'Customer' : 'Party'}
            </Button>
          }
        />

        {/* Filter tabs */}
        <FilterTabs
          tabs={TABS}
          value={activeTab}
          onChange={setActiveTab}
        />

        {/* Table or empty state */}
        {filteredParties.length === 0 ? (
          <EmptyState
            icon={Users}
            title={emptyState.title}
            description={emptyState.description}
            action={{ label: emptyState.buttonLabel, onClick: handleAddClick }}
          />
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Parties list">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-40">
                      GSTIN
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-28">
                      Type
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-32">
                      Phone
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-36">
                      Opening Balance
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-20">
                      Status
                    </th>
                    <th className="px-4 py-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredParties.map((party) => (
                    <tr key={party.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {party.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                        {party.gstin ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {/* Customer = blue (UPLOADED), Supplier = gray (DRAFT) per UI-SPEC 4 */}
                        <StatusBadge
                          status={party.partyType === 'Customer' ? 'UPLOADED' : 'DRAFT'}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {party.phone ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <AmountDisplay amount={party.openingBalance} size="sm" />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={party.isActive ? 'ACTIVE' : 'INACTIVE'} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label={`Edit ${party.name}`}
                                onClick={() => handleEditClick(party)}
                              >
                                <Pencil className="h-3.5 w-3.5 text-gray-500" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          {party.isActive && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label={`Deactivate ${party.name}`}
                                  onClick={() => setDeactivateParty(party)}
                                >
                                  <UserX className="h-3.5 w-3.5 text-gray-500" />
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

        {/* Customer Form Dialog */}
        {showCustomerForm && (
          <CustomerForm
            party={editParty?.partyType === 'Customer' ? editParty : null}
            onClose={() => {
              setShowCustomerForm(false)
              setEditParty(null)
            }}
            onSuccess={handleFormSuccess}
          />
        )}

        {/* Supplier Form Dialog */}
        {showSupplierForm && (
          <SupplierForm
            party={editParty?.partyType === 'Supplier' ? editParty : null}
            onClose={() => {
              setShowSupplierForm(false)
              setEditParty(null)
            }}
            onSuccess={handleFormSuccess}
          />
        )}

        {/* Deactivate Confirmation Dialog — UI-SPEC 9.7 */}
        <AlertDialog
          open={!!deactivateParty}
          onOpenChange={(open) => { if (!open) setDeactivateParty(null) }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate {deactivateParty?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will hide {deactivateParty?.name} from dropdowns. Existing
                transactions will not be affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  if (deactivateParty) deactivateMutation.mutate(deactivateParty.id)
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
