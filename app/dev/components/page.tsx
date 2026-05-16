// app/dev/components/page.tsx
// NODE_ENV guard: returns 404 in production
// Shows all 12 shared components with all variants for visual QA
import { notFound } from 'next/navigation'
import { IndianRupee, ShoppingCart, Package, AlertCircle, FileText } from 'lucide-react'
import { KPICard } from '@/components/shared/KPICard'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { SectionCard } from '@/components/shared/SectionCard'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import { EmptyState } from '@/components/shared/EmptyState'
import { GuidedWizard } from '@/components/shared/GuidedWizard'
import { SimpleModeToggle } from '@/components/shared/SimpleModeToggle'
import { BusinessLanguageAlert } from '@/components/shared/BusinessLanguageAlert'
import { Button } from '@/components/ui/button'
import { DevComponentsInteractive } from './DevComponentsInteractive'

export default function DevComponentsPage() {
  // NODE_ENV guard -- returns 404 in production (per D-05)
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return (
    <div className="p-8 space-y-10 max-w-5xl mx-auto">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-semibold text-gray-900">Component Showcase</h1>
        <p className="text-sm text-gray-500 mt-1">
          Phase 0 design system — all shared components. This page returns 404 in production.
        </p>
      </div>

      {/* PageHeader */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-700 border-b pb-2">PageHeader</h2>
        <PageHeader
          title="Sales Invoice"
          subtitle="Create and manage sales transactions"
          action={<Button size="sm" className="bg-purple-600 hover:bg-purple-700">New Invoice</Button>}
        />
      </section>

      {/* KPICard -- all icon color variants */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-700 border-b pb-2">KPICard (all variants)</h2>
        <div className="grid grid-cols-4 gap-4">
          <KPICard
            title="Total Receivable"
            value="Rs.12,34,567"
            delta="+12% from last month"
            deltaType="positive"
            icon={IndianRupee}
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
          />
          <KPICard
            title="Total Payable"
            value="Rs.4,56,789"
            delta="-3% from last month"
            deltaType="negative"
            icon={ShoppingCart}
            iconBg="bg-red-100"
            iconColor="text-red-600"
          />
          <KPICard
            title="Stock Value"
            value="Rs.8,90,123"
            deltaType="neutral"
            icon={Package}
            iconBg="bg-amber-100"
            iconColor="text-amber-600"
          />
          <KPICard
            title="GST Due"
            value="Rs.67,890"
            delta="Due in 5 days"
            deltaType="negative"
            icon={AlertCircle}
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
          />
        </div>
      </section>

      {/* StatusBadge -- all statuses */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-700 border-b pb-2">StatusBadge (all variants)</h2>
        <div className="flex flex-wrap gap-2">
          {['POSTED', 'PAID', 'FILED', 'ACTIVE', 'DRAFT', 'NOT_FILED', 'INACTIVE',
            'CANCELLED', 'OVERDUE', 'UPLOADED', 'PROCESSING', 'PENDING',
            'APPROVED', 'PARTIALLY_FULFILLED', 'CLOSED'].map(status => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
      </section>

      {/* AmountDisplay */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-700 border-b pb-2">AmountDisplay (all sizes)</h2>
        <div className="flex gap-6 items-end">
          <AmountDisplay amount={1234} size="sm" />
          <AmountDisplay amount={123456} size="md" />
          <AmountDisplay amount={1234567} size="lg" />
          <AmountDisplay amount={12345678} size="xl" />
        </div>
        <div className="flex gap-4">
          <AmountDisplay amount={50000} colorBySign />
          <AmountDisplay amount={-25000} colorBySign />
        </div>
      </section>

      {/* SectionCard */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-700 border-b pb-2">SectionCard</h2>
        <SectionCard title="Recent Transactions" action={<Button variant="outline" size="sm">Export</Button>}>
          <p className="text-sm text-gray-500">Table content would go here</p>
        </SectionCard>
        <SectionCard>
          <p className="text-sm text-gray-500">SectionCard without title (just a white card wrapper)</p>
        </SectionCard>
      </section>

      {/* EmptyState */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-700 border-b pb-2">EmptyState</h2>
        <div className="border border-gray-100 rounded-lg">
          <EmptyState
            icon={FileText}
            title="No invoices yet"
            description="Invoices you create for customers will appear here. Each invoice records what you sold and the amount owed."
            action={{ label: 'Create Your First Invoice', onClick: () => {} }}
          />
        </div>
      </section>

      {/* BusinessLanguageAlert */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-700 border-b pb-2">BusinessLanguageAlert (all variants)</h2>
        <BusinessLanguageAlert
          message="This GSTIN doesn't look right -- it should be 15 characters like 29ABCDE1234F1Z5"
          variant="warning"
        />
        <BusinessLanguageAlert
          message="Invoice saved successfully. Your customer will receive a copy."
          variant="success"
        />
        <BusinessLanguageAlert
          message="GST is automatically calculated from your product's tax rate. You can review it below."
          variant="info"
        />
      </section>

      {/* GuidedWizard stub */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-700 border-b pb-2">GuidedWizard (Phase 1 stub)</h2>
        <GuidedWizard
          steps={[
            { id: '1', label: 'Who', component: <div>Step 1</div> },
            { id: '2', label: 'What', component: <div>Step 2</div> },
            { id: '3', label: 'Confirm', component: <div>Step 3</div> },
          ]}
          onComplete={async () => {}}
          title="Create Sale"
        />
      </section>

      {/* SimpleModeToggle */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-700 border-b pb-2">SimpleModeToggle</h2>
        <SimpleModeToggle />
      </section>

      {/* Interactive components (client-side) */}
      <DevComponentsInteractive />
    </div>
  )
}
