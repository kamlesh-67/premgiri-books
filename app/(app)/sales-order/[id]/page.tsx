"use client"

import { useState, use, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { z } from "zod"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Decimal } from "decimal.js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/shared/PageHeader"
import { SectionCard } from "@/components/shared/SectionCard"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { formatINR } from "@/lib/utils/format"
import { convertOrderSchema } from "@/lib/schemas/orders"
import { useUiStore } from "@/lib/stores/uiStore"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConvertFormValues = z.infer<typeof convertOrderSchema>

// D-04: Simple Mode status labels for SO
const SIMPLE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Pending',
  APPROVED: 'Confirmed',
  PARTIALLY_FULFILLED: 'Partially Billed',
  CLOSED: 'Fully Billed',
  CANCELLED: 'Cancelled',
}

interface OrderItem {
  id: string
  itemId: string
  qty: string
  rate: string
  amount: string
  receivedQty: string
  dispatchedQty: string
  item: { id: string; name: string }
  godown: { id: string; name: string } | null
}

interface OrderDetail {
  id: string
  orderNo: string
  status: string
  date: string
  narration?: string
  totalAmount: string
  createdBy: string
  partyLedger?: { id: string; name: string } | null
  orderItems: OrderItem[]
}

interface LedgerOption {
  id: string
  name: string
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { uiMode } = useUiStore()
  const [showDispatchPanel, setShowDispatchPanel] = useState(false)

  const { data: order, isLoading } = useQuery<OrderDetail>({
    queryKey: ['sales-order', id],
    queryFn: async () => {
      const r = await fetch(`/api/v1/orders/${id}`)
      if (!r.ok) throw new Error('Failed to load order')
      return r.json() as Promise<OrderDetail>
    },
  })

  // Fetch income ledgers for trade ledger (sales accounts)
  const { data: incomeLedgers = [] } = useQuery<LedgerOption[]>({
    queryKey: ['ledgers-income'],
    queryFn: async () => {
      const res = await fetch('/api/v1/masters/ledgers?nature=INCOME')
      if (!res.ok) throw new Error('Failed to fetch income ledgers')
      return res.json() as Promise<LedgerOption[]>
    },
    enabled: showDispatchPanel,
  })

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? 'Failed to cancel order')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-order', id] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      toast.success('Order cancelled')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Close mutation
  const closeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close' }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? 'Failed to close order')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-order', id] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      toast.success('Order closed')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Dispatch form — uses convertOrderSchema which requires tradeLedgerId + items
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ConvertFormValues>({
    resolver: zodResolver(convertOrderSchema),
    defaultValues: { tradeLedgerId: '', items: [] },
  })

  const { fields } = useFieldArray({ control, name: 'items' })

  useEffect(() => {
    if (order) {
      reset({
        tradeLedgerId: '',
        items: order.orderItems.map(oi => ({
          orderItemId: oi.id,
          qty: new Decimal(oi.qty).minus(new Decimal(oi.dispatchedQty || '0')).toFixed(3),
        })),
      })
    }
  }, [order, reset])

  // D-04: convert button label
  const convertButtonLabel = uiMode === 'simple' ? 'Convert to Bill' : 'Convert to Invoice'

  const convertMutation = useMutation({
    mutationFn: async (data: ConvertFormValues) => {
      const res = await fetch(`/api/v1/orders/${id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? 'Failed to create sales invoice')
      }
      return res.json() as Promise<{ voucherId: string; voucherNo: string; orderStatus: string }>
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sales-order', id] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      toast.success(
        uiMode === 'simple'
          ? `Bill ${data.voucherNo} created`
          : `Sales Invoice ${data.voucherNo} created`
      )
      router.push(`/vouchers/sales/${data.voucherId}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const onSubmitDispatch = handleSubmit(data => convertMutation.mutate(data))

  if (isLoading) return <div className="p-6 text-sm text-gray-400">Loading order...</div>
  if (!order) return <div className="p-6 text-sm text-red-600">Order not found</div>

  // SO dispatch panel: available for DRAFT, APPROVED, PARTIALLY_FULFILLED (D-03: no approve gating for SO)
  const canDispatch = ['DRAFT', 'APPROVED', 'PARTIALLY_FULFILLED'].includes(order.status)
  const isFinal = ['CANCELLED', 'CLOSED'].includes(order.status)

  const displayStatus = uiMode === 'simple'
    ? (SIMPLE_STATUS_LABELS[order.status] ?? order.status)
    : order.status

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title={
          uiMode === 'simple'
            ? `Customer Order ${order.orderNo}`
            : `Sales Order ${order.orderNo}`
        }
        subtitle={
          uiMode === 'simple'
            ? 'Customer order details and dispatch'
            : 'Sales Order details and dispatch'
        }
        action={
          <div className="flex items-center gap-2">
            {!isFinal && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  Cancel Order
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => closeMutation.mutate()}
                  disabled={closeMutation.isPending}
                >
                  Close Order
                </Button>
              </>
            )}
            {uiMode === 'simple' ? (
              <span className="text-sm text-gray-600 px-2 py-1 bg-gray-100 rounded-md">
                {displayStatus}
              </span>
            ) : (
              <StatusBadge status={order.status} />
            )}
          </div>
        }
      />

      {/* Order Summary */}
      <SectionCard title="Order Details">
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Customer</dt>
            <dd className="mt-1 text-gray-700">{order.partyLedger?.name ?? <span className="text-gray-400">—</span>}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date</dt>
            <dd className="mt-1 text-gray-700">{order.date}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</dt>
            <dd className="mt-1">{displayStatus}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Amount</dt>
            <dd className="mt-1 text-gray-900 font-semibold tabular-nums">{formatINR(order.totalAmount)}</dd>
          </div>
          {order.narration && (
            <div className="col-span-2 md:col-span-4">
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Narration</dt>
              <dd className="mt-1 text-gray-700">{order.narration}</dd>
            </div>
          )}
        </dl>
      </SectionCard>

      {/* Line Items table: Ordered | Dispatched | Pending */}
      <SectionCard title="Line Items" noPadding>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <th className="px-4 py-3 text-left">Item</th>
              <th className="px-4 py-3 text-right">Ordered</th>
              <th className="px-4 py-3 text-right">Dispatched</th>
              <th className="px-4 py-3 text-right">Pending</th>
              <th className="px-4 py-3 text-right">Unit Rate</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {order.orderItems.map(oi => {
              const pending = new Decimal(oi.qty).minus(new Decimal(oi.dispatchedQty || '0'))
              return (
                <tr key={oi.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{oi.item?.name ?? oi.itemId}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">{oi.qty}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-700">{oi.dispatchedQty || '0'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-600">{pending.toFixed(3)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-500">{oi.rate}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{formatINR(oi.amount)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 font-semibold">
              <td colSpan={5} className="px-4 py-3 text-right text-gray-700">Total</td>
              <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                {formatINR(order.totalAmount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </SectionCard>

      {/* Dispatch Goods panel — for DRAFT, APPROVED, PARTIALLY_FULFILLED (D-05 SO flow) */}
      {canDispatch && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <button
            type="button"
            onClick={() => setShowDispatchPanel(p => !p)}
            className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 rounded-lg"
          >
            <span>Dispatch Goods</span>
            {showDispatchPanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showDispatchPanel && (
            <div className="border-t border-gray-100 p-6">
              <form onSubmit={onSubmitDispatch} className="space-y-4">
                {/* Trade ledger selection (Sales account) */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Sales Account
                  </label>
                  <select
                    {...register('tradeLedgerId')}
                    className="w-full md:w-72 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select sales account...</option>
                    {incomeLedgers.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                  {errors.tradeLedgerId && (
                    <p className="text-xs text-red-600">{errors.tradeLedgerId.message}</p>
                  )}
                </div>

                {/* Dispatch quantities table */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
                      <th className="px-4 py-2 text-left">Item</th>
                      <th className="px-4 py-2 text-right">Ordered</th>
                      <th className="px-4 py-2 text-right">Dispatched</th>
                      <th className="px-4 py-2 text-right">Pending</th>
                      <th className="px-4 py-2 text-right w-40">Dispatching Now</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {fields.map((field, index) => {
                      const oi = order.orderItems[index]
                      if (!oi) return null
                      const pendingQty = new Decimal(oi.qty).minus(new Decimal(oi.dispatchedQty || '0'))
                      return (
                        <tr key={field.id}>
                          <td className="px-4 py-2 text-gray-700">{oi.item?.name ?? oi.itemId}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-gray-500">{oi.qty}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-green-700">{oi.dispatchedQty || '0'}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-amber-600">{pendingQty.toFixed(3)}</td>
                          <td className="px-4 py-2">
                            <input type="hidden" {...register(`items.${index}.orderItemId`)} />
                            <Input
                              type="number"
                              step="0.001"
                              min="0"
                              max={pendingQty.toNumber()}
                              className="text-right"
                              {...register(`items.${index}.qty`)}
                            />
                            {errors.items?.[index]?.qty && (
                              <p className="text-xs text-red-600 mt-1">
                                {`Cannot dispatch more than pending quantity (${pendingQty.toFixed(3)} units)`}
                              </p>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Form actions */}
                <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowDispatchPanel(false)}
                  >
                    Cancel
                  </Button>
                  {/* D-04: Convert to Bill (simple) / Convert to Invoice (advanced) */}
                  <Button type="submit" disabled={convertMutation.isPending}>
                    {convertMutation.isPending ? 'Creating...' : convertButtonLabel}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
