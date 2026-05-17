'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, PowerOff, Package } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/PageHeader'
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
import { ProductForm } from './forms/ProductForm'
import type { UiMode } from '@/lib/stores/uiStore'

interface StockItem {
  id: string
  name: string
  hsnCode: string | null
  gstRate: string
  uomId: string
  uomSymbol: string
  uomName: string
  openingRate: string
  openingQty: string
  currentQty: string
  reorderQty: string
  isActive: boolean
}

interface Uom {
  id: string
  name: string
  symbol: string
}

interface StockItemsClientProps {
  initialItems: StockItem[]
  uiMode: UiMode
  uoms: Uom[]
}

export function StockItemsClient({ initialItems, uiMode, uoms }: StockItemsClientProps) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<StockItem | null>(null)
  const [deactivateItem, setDeactivateItem] = useState<StockItem | null>(null)

  const { data: items = initialItems } = useQuery<StockItem[]>({
    queryKey: ['stock-items'],
    queryFn: () =>
      fetch('/api/v1/masters/stock-items').then((r) => r.json()),
    initialData: initialItems,
    staleTime: 30 * 1000,
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/v1/masters/stock-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      }).then((r) => r.json()),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      const name = items.find((i) => i.id === id)?.name ?? ''
      toast.success(`${name} has been deactivated.`, { duration: 3000 })
      setDeactivateItem(null)
    },
    onError: () => {
      toast.error('Failed to deactivate. Please try again.')
      setDeactivateItem(null)
    },
  })

  function handleFormSuccess() {
    queryClient.invalidateQueries({ queryKey: ['stock-items'] })
    setShowForm(false)
    setEditItem(null)
  }

  const entityLabel = uiMode === 'simple' ? 'Product' : 'Stock Item'
  const pageTitle = uiMode === 'simple' ? 'Products' : 'Stock Items'
  const pageSubtitle = uiMode === 'simple'
    ? 'Manage your products and services'
    : 'Manage all sellable and purchasable stock items'

  return (
    <TooltipProvider>
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
        <PageHeader
          title={pageTitle}
          subtitle={pageSubtitle}
          action={
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => { setEditItem(null); setShowForm(true) }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add {entityLabel}
            </Button>
          }
        />

        {/* Table or empty state */}
        {items.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No products yet."
            description="Add your first product to track inventory and create invoices."
            action={{
              label: 'Add Product',
              onClick: () => { setEditItem(null); setShowForm(true) },
            }}
          />
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Stock items list">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-20">
                      HSN
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-20">
                      GST Rate
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-20">
                      Unit
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-28">
                      Current Stock
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-28">
                      Price
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-20">
                      Status
                    </th>
                    <th className="px-4 py-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {item.hsnCode || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {item.gstRate}%
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {item.uomSymbol}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700 tabular-nums">
                        {item.currentQty} {item.uomSymbol}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <AmountDisplay amount={item.openingRate} size="sm" />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.isActive ? 'ACTIVE' : 'INACTIVE'} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label={`Edit ${item.name}`}
                                onClick={() => { setEditItem(item); setShowForm(true) }}
                              >
                                <Pencil className="h-3.5 w-3.5 text-gray-500" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          {item.isActive && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label={`Deactivate ${item.name}`}
                                  onClick={() => setDeactivateItem(item)}
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

        {/* Product Form Dialog */}
        {showForm && (
          <ProductForm
            item={editItem}
            uoms={uoms}
            onClose={() => { setShowForm(false); setEditItem(null) }}
            onSuccess={handleFormSuccess}
          />
        )}

        {/* Deactivate Confirmation Dialog — UI-SPEC 9.7 */}
        <AlertDialog
          open={!!deactivateItem}
          onOpenChange={(open) => { if (!open) setDeactivateItem(null) }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate {deactivateItem?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will hide {deactivateItem?.name} from product lists. Existing invoice
                lines will not be affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  if (deactivateItem) deactivateMutation.mutate(deactivateItem.id)
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
