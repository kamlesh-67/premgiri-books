"use client"

import { useState, use } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { z } from "zod"
import Link from "next/link"
import { ChevronDown, ChevronUp, ArrowLeft } from "lucide-react"
import { Decimal } from "decimal.js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/shared/PageHeader"
import { SectionCard } from "@/components/shared/SectionCard"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { formatINR } from "@/lib/utils/format"
import { convertOrderSchema } from "@/lib/schemas/orders"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConvertFormValues = z.infer<typeof convertOrderSchema>

interface OrderItem {
  id: string
  itemId: string
  godownId: string | null
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
  orderType: string
  status: string
  date: string
  narration?: string | null
  totalAmount: string
  createdBy?: string | null
  orderItems: OrderItem[]
}

interface LedgerOption {
  id: string
  name: string
}

interface ConvertResult {
  voucherId: string
  voucherNo: string
  orderStatus: string
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const [showReceivePanel, setShowReceivePanel] = useState(false)

  // ── Fetch order detail ───────────────────────────────────────────────────
  const {
    data: order,
    isLoading,
    isError,
  } = useQuery<OrderDetail>({
    queryKey: ["purchase-order", id],
    queryFn: async () => {
      const r = await fetch(`/api/v1/orders/${id}`)
      if (!r.ok) throw new Error("Failed to load order")
      return r.json() as Promise<OrderDetail>
    },
  })

  // ── D-03: Fetch current user role — Approve button absent for non-Admin/Owner ──
  const { data: roleData } = useQuery<{ roleName: string }>({
    queryKey: ["my-role"],
    queryFn: async () => {
      const r = await fetch("/api/v1/auth/me")
      if (!r.ok) return { roleName: "" }
      return r.json() as Promise<{ roleName: string }>
    },
    enabled: !!session,
  })

  // D-03: Approve button is ABSENT (not rendered) for non-Admin/Owner
  const canApprove = ["Admin", "Owner"].includes(roleData?.roleName ?? "")

  // ── Fetch liability ledgers for trade ledger selector in Receive Goods ───
  const { data: liabilityLedgers = [] } = useQuery<LedgerOption[]>({
    queryKey: ["ledgers-liability"],
    queryFn: async () => {
      const r = await fetch("/api/v1/masters/ledgers?nature=LIABILITY")
      if (!r.ok) throw new Error("Failed to fetch ledgers")
      return r.json() as Promise<LedgerOption[]>
    },
    enabled: showReceivePanel,
  })

  // ── Approve mutation ─────────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? "Failed to approve order")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-order", id] })
      toast.success("Order approved")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // ── Cancel mutation ──────────────────────────────────────────────────────
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? "Failed to cancel order")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-order", id] })
      toast.success("Order cancelled")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // ── Close mutation ───────────────────────────────────────────────────────
  const closeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close" }),
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? "Failed to close order")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-order", id] })
      toast.success("Order closed")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // ── Receive Goods form (react-hook-form + zod) ───────────────────────────
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ConvertFormValues>({
    resolver: zodResolver(convertOrderSchema),
    defaultValues: {
      tradeLedgerId: "",
      items:
        order?.orderItems?.map((oi) => ({
          orderItemId: oi.id,
          qty: new Decimal(oi.qty).minus(new Decimal(oi.receivedQty)).toFixed(3),
        })) ?? [],
    },
  })

  const { fields } = useFieldArray({ control, name: "items" })

  // ── Convert (receive goods) mutation ─────────────────────────────────────
  const convertMutation = useMutation({
    mutationFn: async (data: ConvertFormValues) => {
      const res = await fetch(`/api/v1/orders/${id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? "Failed to create purchase invoice")
      }
      return res.json() as Promise<ConvertResult>
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-order", id] })
      toast.success(`Purchase Invoice ${data.voucherNo} created`)
      router.push(`/vouchers/purchase/${data.voucherId}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const onSubmitReceive = handleSubmit((data) => convertMutation.mutate(data))

  // ── Derived state ────────────────────────────────────────────────────────
  const canReceive =
    order !== undefined &&
    ["APPROVED", "PARTIALLY_FULFILLED"].includes(order.status)

  const canCancelOrClose =
    order !== undefined &&
    !["CANCELLED", "CLOSED"].includes(order.status)

  // ── Loading / error states ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 text-sm text-gray-400">Loading order...</div>
    )
  }

  if (isError || !order) {
    return (
      <div className="p-6 text-sm text-red-600">
        Order not found or could not be loaded.
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Back navigation */}
      <Link
        href="/purchase-order"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-purple-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Purchase Orders
      </Link>

      {/* Page header */}
      <PageHeader
        title={order.orderNo}
        subtitle="Purchase Order details"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {/* D-03: Approve button — ABSENT from DOM for non-Admin/Owner users */}
            {canApprove && order.status === "DRAFT" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="text-green-700 border-green-200 hover:bg-green-50"
              >
                Approve
              </Button>
            )}

            {canCancelOrClose && (
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

            <StatusBadge status={order.status} />
          </div>
        }
      />

      {/* Order details card */}
      <SectionCard title="Order Details">
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Date
            </dt>
            <dd className="mt-1 text-gray-700">{order.date}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Status
            </dt>
            <dd className="mt-1">
              <StatusBadge status={order.status} />
            </dd>
          </div>
          {order.narration && (
            <div className="col-span-2">
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Narration
              </dt>
              <dd className="mt-1 text-gray-700">{order.narration}</dd>
            </div>
          )}
        </dl>
      </SectionCard>

      {/* Line items table */}
      <SectionCard title="Line Items" noPadding>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <th className="px-4 py-3 text-left">Item</th>
              <th className="px-4 py-3 text-right">Ordered Qty</th>
              <th className="px-4 py-3 text-right">Received</th>
              <th className="px-4 py-3 text-right">Pending</th>
              <th className="px-4 py-3 text-right">Unit Rate</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {order.orderItems.map((oi) => {
              const pending = new Decimal(oi.qty).minus(
                new Decimal(oi.receivedQty),
              )
              return (
                <tr key={oi.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">
                    {oi.item?.name ?? oi.itemId}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                    {oi.qty}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-700">
                    {oi.receivedQty}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-600">
                    {pending.toFixed(3)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                    {oi.rate}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">
                    {formatINR(oi.amount)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200">
              <td
                colSpan={5}
                className="px-4 py-3 text-right text-sm font-semibold text-gray-700"
              >
                Total
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-base font-bold text-gray-900">
                {formatINR(order.totalAmount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </SectionCard>

      {/* D-05: Receive Goods panel — only rendered for APPROVED or PARTIALLY_FULFILLED */}
      {canReceive && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          {/* Toggle header */}
          <button
            type="button"
            onClick={() => setShowReceivePanel((p) => !p)}
            className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 rounded-lg"
          >
            <span>Receive Goods</span>
            {showReceivePanel ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>

          {showReceivePanel && (
            <div className="border-t border-gray-100 p-6">
              <form onSubmit={onSubmitReceive} className="space-y-4">
                {/* Trade ledger (Accounts Payable / Purchase ledger) selector */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Purchase / Payable Ledger
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <select
                    {...register("tradeLedgerId")}
                    className="w-full max-w-sm rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select payable ledger...</option>
                    {liabilityLedgers.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  {errors.tradeLedgerId && (
                    <p className="text-xs text-red-600">
                      {errors.tradeLedgerId.message}
                    </p>
                  )}
                </div>

                {/* Per-item receive quantities */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
                      <th className="px-4 py-2 text-left">Item</th>
                      <th className="px-4 py-2 text-right">Ordered</th>
                      <th className="px-4 py-2 text-right">Received</th>
                      <th className="px-4 py-2 text-right">Pending</th>
                      <th className="px-4 py-2 text-right w-36">
                        Receiving Now
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {fields.map((field, index) => {
                      const oi = order.orderItems[index]
                      if (!oi) return null

                      const pendingQty = new Decimal(oi.qty).minus(
                        new Decimal(oi.receivedQty),
                      )

                      return (
                        <tr key={field.id}>
                          <td className="px-4 py-2 text-gray-700">
                            {oi.item?.name ?? oi.itemId}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-gray-500">
                            {oi.qty}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-green-700">
                            {oi.receivedQty}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-amber-600">
                            {pendingQty.toFixed(3)}
                          </td>
                          <td className="px-4 py-2">
                            {/* Hidden orderItemId — sent to API */}
                            <input
                              type="hidden"
                              {...register(`items.${index}.orderItemId`)}
                            />
                            <Input
                              type="number"
                              step="0.001"
                              min="0"
                              max={pendingQty.toNumber()}
                              className="text-right"
                              {...register(`items.${index}.qty`)}
                            />
                            {/* Inline over-delivery error (D-05) */}
                            {errors.items?.[index]?.qty && (
                              <p className="text-xs text-red-600 mt-1">
                                Cannot receive more than {pendingQty.toFixed(3)}{" "}
                                pending
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
                    onClick={() => setShowReceivePanel(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={convertMutation.isPending}
                  >
                    {convertMutation.isPending
                      ? "Creating Invoice..."
                      : "Create Purchase Invoice"}
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
