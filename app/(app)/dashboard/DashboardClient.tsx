'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  IndianRupee, TrendingDown, TrendingUp, PackageX, Calendar,
  Landmark, CreditCard, Receipt, Users, Package, ArrowUpRight,
} from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Button } from '@/components/ui/button'
import { KPICard } from '@/components/shared/KPICard'
import { PageHeader } from '@/components/shared/PageHeader'
import { SectionCard } from '@/components/shared/SectionCard'
import { SmartInsightsWidget } from '@/components/shared/SmartInsightsWidget'
import { formatINR } from '@/lib/utils/format'
import type { BusinessKPIs, AccountantKPIs } from '@/lib/services/DashboardService'

interface DashboardClientProps {
  initialData: BusinessKPIs
}

export function DashboardClient({ initialData }: DashboardClientProps) {
  // D-06: dashboardView is LOCAL state — not persisted, not in Zustand
  const [view, setView] = useState<'business' | 'accountant'>('business')

  // Business KPIs — initialData prevents loading flash on first render
  const { data: businessData = initialData } = useQuery<BusinessKPIs>({
    queryKey: ['dashboard', 'business'],
    queryFn: () => fetch('/api/v1/dashboard/business').then((r) => r.json()),
    initialData,
    staleTime: 5 * 60 * 1000, // 5 minutes — matches Redis TTL
  })

  // Accountant KPIs — fetched on demand when tab is switched
  const { data: accountantData } = useQuery<AccountantKPIs>({
    queryKey: ['dashboard', 'accountant'],
    queryFn: () => fetch('/api/v1/dashboard/accountant').then((r) => r.json()),
    enabled: view === 'accountant',
    staleTime: 5 * 60 * 1000,
  })

  const showGettingStarted = (businessData?.voucherCount ?? 0) === 0

  // Determine FY label
  const now = new Date()
  const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  const fyLabel = `${fyYear}-${String(fyYear + 1).slice(2)}`

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page header with view toggle in action slot — D-06 */}
      <PageHeader
        title="Dashboard"
        subtitle={`Financial overview for FY ${fyLabel}`}
        action={
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && setView(v as 'business' | 'accountant')}
            aria-label="Switch dashboard view"
          >
            <ToggleGroupItem value="business" aria-label="Owner view">
              Owner
            </ToggleGroupItem>
            <ToggleGroupItem value="accountant" aria-label="Accountant view">
              Accountant
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />

      {/* KPI Cards — D-07: 5 cards for business, D-08: 4 cards for accountant */}
      {view === 'business' ? (
        <div className="grid grid-cols-5 gap-4">
          <KPICard
            title="Money Owed to You"
            value={formatINR(businessData.receivables)}
            icon={IndianRupee}
            iconBg="bg-green-100"
            iconColor="text-green-600"
          />
          <KPICard
            title="Money You Owe"
            value={formatINR(businessData.payables)}
            icon={TrendingDown}
            iconBg="bg-red-100"
            iconColor="text-red-600"
          />
          <KPICard
            title="Sales This Month"
            value={formatINR(businessData.salesThisMonth)}
            icon={TrendingUp}
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
          />
          <KPICard
            title="Low Stock Alerts"
            value={`${businessData.lowStockCount} items`}
            icon={PackageX}
            iconBg="bg-amber-100"
            iconColor="text-amber-600"
          />
          <KPICard
            title="GST Due In"
            value={
              businessData.gstDueInDays === 0
                ? 'Overdue!'
                : `${businessData.gstDueInDays} days`
            }
            icon={Calendar}
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
          />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          <KPICard
            title="Total Assets"
            value={formatINR(accountantData?.totalAssets ?? '0')}
            icon={Landmark}
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
          />
          <KPICard
            title="Total Liabilities"
            value={formatINR(accountantData?.totalLiabilities ?? '0')}
            icon={CreditCard}
            iconBg="bg-red-100"
            iconColor="text-red-600"
          />
          <KPICard
            title="Revenue MTD"
            value={formatINR(accountantData?.revenueMTD ?? '0')}
            icon={TrendingUp}
            iconBg="bg-green-100"
            iconColor="text-green-600"
          />
          <KPICard
            title="GST Payable"
            value={formatINR(accountantData?.gstPayable ?? '0')}
            icon={Receipt}
            iconBg="bg-amber-100"
            iconColor="text-amber-600"
          />
        </div>
      )}

      {/* SmartInsightsWidget — Accountant View: below 4-card KPI grid (no charts in Accountant View spec) */}
      {view === 'accountant' && <SmartInsightsWidget />}

      {/* D-09: 2 charts below KPIs — both views show same charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Chart 1: Sales vs Purchases area chart */}
        <SectionCard title="Sales vs Purchases — Last 6 Months">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={businessData.salesChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  tickFormatter={(v: number) => `₹${(v / 100000).toFixed(0)}L`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #F3F4F6',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [formatINR(value.toString()), '']}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  name="Sales"
                  stroke="#7C3AED"
                  fill="#EDE9FE"
                  fillOpacity={0.4}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="purchases"
                  name="Purchases"
                  stroke="#6B7280"
                  fill="#F3F4F6"
                  fillOpacity={0.4}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Chart 2: Top 5 products bar chart */}
        <SectionCard title="Top 5 Products This Month">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={businessData.topProductsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  tickFormatter={(v: string) =>
                    v.length > 10 ? v.slice(0, 10) + '…' : v
                  }
                />
                <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #F3F4F6',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [
                    name === 'revenue' ? formatINR(value.toString()) : value,
                    name === 'revenue' ? 'Revenue' : 'Qty sold',
                  ]}
                />
                <Bar dataKey="qty" name="qty" fill="#7C3AED" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* SmartInsightsWidget — Business View: below 2-chart grid, above Getting Started */}
      {view === 'business' && <SmartInsightsWidget />}

      {/* D-10: Getting Started section — shown only when no POSTED vouchers */}
      {showGettingStarted && (
        <SectionCard title="Getting Started">
          <div className="grid grid-cols-3 gap-4 py-2">
            {/* Card 1: Add Customer */}
            <div className="bg-white rounded-lg border border-dashed border-gray-200 p-5 flex flex-col items-center text-center gap-3">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-sm font-semibold text-gray-800">
                Add Your First Customer
              </p>
              <p className="text-xs text-gray-500 max-w-[160px]">
                Set up customers to track who owes you money
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { window.location.href = '/masters/parties' }}
              >
                Add Customer
              </Button>
            </div>

            {/* Card 2: Add Product */}
            <div className="bg-white rounded-lg border border-dashed border-gray-200 p-5 flex flex-col items-center text-center gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Package className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-sm font-semibold text-gray-800">
                Add Your First Product
              </p>
              <p className="text-xs text-gray-500 max-w-[160px]">
                Add products or services you sell
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { window.location.href = '/masters/stock-items' }}
              >
                Add Product
              </Button>
            </div>

            {/* Card 3: Record First Sale */}
            <div className="bg-white rounded-lg border border-dashed border-gray-200 p-5 flex flex-col items-center text-center gap-3">
              <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                <ArrowUpRight className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-sm font-semibold text-gray-800">
                Record Your First Sale
              </p>
              <p className="text-xs text-gray-500 max-w-[160px]">
                Create your first sales invoice
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { window.location.href = '/sales-invoice/new' }}
              >
                New Invoice
              </Button>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
