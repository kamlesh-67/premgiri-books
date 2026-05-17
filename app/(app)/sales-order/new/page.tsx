"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import { z } from "zod"
import { Decimal } from "decimal.js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/shared/PageHeader"
import { SectionCard } from "@/components/shared/SectionCard"
import { createOrderSchema } from "@/lib/schemas/orders"
import { useUiStore } from "@/lib/stores/uiStore"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FormValues = z.infer<typeof createOrderSchema>

interface LedgerOption {
  id: string
  name: string
}

interface StockItemOption {
  id: string
  name: string
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewSalesOrderPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { uiMode } = useUiStore()

  // D-04: Simple/Advanced mode labels
  const pageTitle = uiMode === 'simple' ? 'New Customer Order' : 'New Sales Order'
  const pageSubtitle = uiMode === 'simple'
    ? 'Record a new order from a customer'
    : 'Create a sales commitment with a customer'

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      orderType: 'SALES_ORDER',
      date: new Date().toISOString().split('T')[0],
      items: [{ itemId: '', qty: '1', rate: '0', amount: '0.00' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  // Watch all items to recompute amounts reactively
  const watchedItems = watch('items')

  // Recompute each item's amount whenever qty or rate changes
  useEffect(() => {
    if (!watchedItems) return
    watchedItems.forEach((item, index) => {
      try {
        const qty = new Decimal(item.qty || '0')
        const rate = new Decimal(item.rate || '0')
        const computed = qty.times(rate).toFixed(2)
        if (item.amount !== computed) {
          setValue(`items.${index}.amount`, computed, { shouldValidate: false })
        }
      } catch {
        // invalid decimal — leave as-is
      }
    })
  }, [watchedItems, setValue])

  // Running total (reads from watched items)
  const totalAmount = (watchedItems ?? []).reduce((sum, item) => {
    try {
      return sum.plus(new Decimal(item.amount || '0'))
    } catch {
      return sum
    }
  }, new Decimal(0))

  // Fetch customers (ASSET nature ledgers — Sundry Debtors / receivables)
  const { data: customers = [] } = useQuery<LedgerOption[]>({
    queryKey: ['ledgers-asset'],
    queryFn: async () => {
      const res = await fetch('/api/v1/masters/ledgers?nature=ASSET')
      if (!res.ok) throw new Error('Failed to fetch customers')
      return res.json() as Promise<LedgerOption[]>
    },
  })

  // Fetch stock items for line item dropdown
  const { data: stockItems = [] } = useQuery<StockItemOption[]>({
    queryKey: ['stock-items-list'],
    queryFn: async () => {
      const res = await fetch('/api/v1/masters/stock-items')
      if (!res.ok) throw new Error('Failed to fetch stock items')
      return res.json() as Promise<StockItemOption[]>
    },
  })

  // Submit mutation
  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Failed to create sales order')
      }
      return res.json() as Promise<{ id: string; orderNo: string }>
    },
    onSuccess: (newOrder) => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      toast.success(
        uiMode === 'simple'
          ? `Customer order ${newOrder.orderNo} created`
          : `Sales order ${newOrder.orderNo} created`
      )
      router.push(`/sales-order/${newOrder.id}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const onSubmit = handleSubmit(data => mutation.mutate(data))

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
      />

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Order Details */}
        <SectionCard title="Order Details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Customer
              </label>
              <select
                {...register('partyLedgerId')}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select customer...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.partyLedgerId && (
                <p className="text-xs text-red-600">{errors.partyLedgerId.message}</p>
              )}
            </div>

            {/* Order Date */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Order Date
              </label>
              <Input type="date" {...register('date')} />
              {errors.date && (
                <p className="text-xs text-red-600">{errors.date.message}</p>
              )}
            </div>

            {/* Narration */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Narration
              </label>
              <Input placeholder="Optional notes..." {...register('narration')} />
              {errors.narration && (
                <p className="text-xs text-red-600">{errors.narration.message}</p>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Line Items */}
        <SectionCard title="Line Items" noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-3 text-left">Item</th>
                  <th className="px-4 py-3 text-right w-28">Qty</th>
                  <th className="px-4 py-3 text-right w-32">Rate (₹)</th>
                  <th className="px-4 py-3 text-right w-32">Amount (₹)</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fields.map((field, index) => (
                  <tr key={field.id}>
                    {/* Item selector */}
                    <td className="px-4 py-2">
                      <select
                        {...register(`items.${index}.itemId`)}
                        className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">Select item...</option>
                        {stockItems.map(item => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                      {errors.items?.[index]?.itemId && (
                        <p className="text-xs text-red-600">
                          {errors.items?.[index]?.itemId?.message}
                        </p>
                      )}
                    </td>

                    {/* Qty */}
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        className="text-right"
                        {...register(`items.${index}.qty`)}
                      />
                      {errors.items?.[index]?.qty && (
                        <p className="text-xs text-red-600">
                          {errors.items?.[index]?.qty?.message}
                        </p>
                      )}
                    </td>

                    {/* Rate */}
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        step="0.0001"
                        min="0"
                        className="text-right"
                        {...register(`items.${index}.rate`)}
                      />
                      {errors.items?.[index]?.rate && (
                        <p className="text-xs text-red-600">
                          {errors.items?.[index]?.rate?.message}
                        </p>
                      )}
                    </td>

                    {/* Amount (read-only, auto-computed) */}
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        readOnly
                        tabIndex={-1}
                        className="text-right bg-gray-50"
                        {...register(`items.${index}.amount`)}
                      />
                    </td>

                    {/* Remove row */}
                    <td className="px-4 py-2 text-center">
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                {/* Add row button */}
                <tr>
                  <td colSpan={5} className="px-4 py-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => append({ itemId: '', qty: '1', rate: '0', amount: '0.00' })}
                      className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      Add Item
                    </button>
                  </td>
                </tr>

                {/* Total row */}
                <tr className="border-t-2 border-gray-200">
                  <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-base font-bold text-gray-900">
                    ₹{totalAmount.toFixed(2)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>

            {/* Array-level error (e.g. "At least one item required") */}
            {errors.items?.root?.message && (
              <p className="px-4 py-2 text-xs text-red-600">{errors.items.root.message}</p>
            )}
          </div>
        </SectionCard>

        {/* Form Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating...' : pageTitle}
          </Button>
        </div>
      </form>
    </div>
  )
}
