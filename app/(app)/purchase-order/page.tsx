"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, ShoppingCart, IndianRupee, Clock } from "lucide-react"
import { Decimal } from "decimal.js"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/PageHeader"
import { SectionCard } from "@/components/shared/SectionCard"
import { KPICard } from "@/components/shared/KPICard"
import { FilterTabs } from "@/components/shared/FilterTabs"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { formatINR } from "@/lib/utils/format"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Order {
  id: string
  orderNo: string
  date: string
  status: string
  totalAmount: string
  partyLedger?: { id: string; name: string } | null
  _count: { orderItems: number }
}

interface OrdersResponse {
  orders: Order[]
  total: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PARTIALLY_FULFILLED', label: 'Partial' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PurchaseOrdersPage() {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery<OrdersResponse>({
    queryKey: ['purchase-orders', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ type: 'PURCHASE_ORDER' })
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/v1/orders?${params}`)
      if (!res.ok) throw new Error('Failed to load purchase orders')
      return res.json() as Promise<OrdersResponse>
    },
  })

  const orders = data?.orders ?? []

  // KPI computations
  const openOrders = orders.filter(o => ['DRAFT', 'APPROVED'].includes(o.status))
  const openValue = openOrders.reduce(
    (sum, o) => sum.plus(new Decimal(o.totalAmount || '0')),
    new Decimal(0),
  )
  const pendingValue = orders
    .filter(o => o.status === 'PARTIALLY_FULFILLED')
    .reduce((sum, o) => sum.plus(new Decimal(o.totalAmount || '0')), new Decimal(0))

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Purchase Orders"
        subtitle="Manage purchase commitments with suppliers"
        action={
          <Button size="sm" onClick={() => router.push('/purchase-order/new')}>
            <Plus className="h-4 w-4 mr-2" />New Purchase Order
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          title="Open Orders"
          value={String(openOrders.length)}
          icon={ShoppingCart}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
        />
        <KPICard
          title="Open Order Value"
          value={formatINR(openValue.toString())}
          icon={IndianRupee}
          iconBg="bg-green-100"
          iconColor="text-green-600"
        />
        <KPICard
          title="Pending (Partial) Value"
          value={formatINR(pendingValue.toString())}
          icon={Clock}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
        />
      </div>

      {/* Orders Table */}
      <SectionCard title="Purchase Orders" noPadding>
        <div className="px-6 pt-4 pb-2">
          <FilterTabs
            tabs={STATUS_TABS}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-gray-400">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3 text-left">Order No</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Supplier</th>
                <th className="px-4 py-3 text-right">Items</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-purple-600">
                    <Link href={`/purchase-order/${order.id}`}>{order.orderNo}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{order.date}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {order.partyLedger?.name ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                    {order._count.orderItems}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">
                    {formatINR(order.totalAmount || '0')}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/purchase-order/${order.id}`}
                      className="text-xs text-purple-600 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                    No purchase orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  )
}
