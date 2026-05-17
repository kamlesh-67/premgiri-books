'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ChevronRight, ArrowLeft, Home } from 'lucide-react'
import Link from 'next/link'

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  'sales-invoice': 'Sales Invoice',
  'purchase-invoice': 'Purchase Invoice',
  receipt: 'Receipt',
  payment: 'Payment',
  journal: 'Journal Entry',
  contra: 'Contra Entry',
  'credit-note': 'Credit Note',
  'debit-note': 'Debit Note',
  'sales-order': 'Sales Order',
  'purchase-order': 'Purchase Order',
  vouchers: 'Vouchers',
  gst: 'GST',
  'gstr-1': 'GSTR-1',
  'gstr-3b': 'GSTR-3B',
  gstr1: 'GSTR-1',
  gstr3b: 'GSTR-3B',
  itc: 'ITC Reconciliation',
  'itc-reconciliation': 'ITC Reconciliation',
  'e-invoice': 'e-Invoice',
  einvoice: 'e-Invoice',
  'e-way-bill': 'e-Way Bill',
  ewaybill: 'e-Way Bill',
  inventory: 'Inventory',
  summary: 'Stock Summary',
  'stock-summary': 'Stock Summary',
  ledger: 'Stock Ledger',
  'stock-ledger': 'Stock Ledger',
  ageing: 'Stock Ageing',
  payroll: 'Payroll',
  employees: 'Employees',
  salary: 'Salary Structures',
  attendance: 'Attendance',
  payrun: 'Pay Run',
  banking: 'Banking',
  reconciliation: 'Reconciliation',
  cheques: 'Cheque Register',
  'cheque-register': 'Cheque Register',
  reports: 'Reports',
  'balance-sheet': 'Balance Sheet',
  'profit-loss': 'Profit & Loss',
  'trial-balance': 'Trial Balance',
  daybook: 'Day Book',
  'day-book': 'Day Book',
  outstanding: 'Outstanding',
  tds: 'TDS',
  masters: 'Masters',
  parties: 'Parties',
  'stock-items': 'Stock Items',
  'units-of-measure': 'Units of Measure',
  godowns: 'Godowns',
  ledgers: 'Ledgers',
  'account-groups': 'Account Groups',
  categories: 'Categories',
  settings: 'Settings',
  company: 'Company',
  users: 'Users',
  roles: 'Roles',
  'audit-trail': 'Audit Trail',
  admin: 'Admin',
  'audit-log': 'Audit Log',
  'number-series': 'Number Series',
  new: 'New',
  ai: 'AI',
}

function segmentToLabel(segment: string): string {
  if (ROUTE_LABELS[segment]) return ROUTE_LABELS[segment]
  if (/^[0-9a-f-]{20,}$/i.test(segment) || /^c[a-z0-9]{24,}$/i.test(segment)) return 'Details'
  return segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function AutoBreadcrumb() {
  const pathname = usePathname()
  const router = useRouter()

  if (!pathname || pathname === '/dashboard') return null

  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return null

  const crumbs: { label: string; href: string; isHome?: boolean }[] = [
    { label: 'Home', href: '/dashboard', isHome: true },
  ]

  let cumulativePath = ''
  for (const segment of segments) {
    cumulativePath += `/${segment}`
    crumbs.push({ label: segmentToLabel(segment), href: cumulativePath })
  }

  const canGoBack = crumbs.length > 2

  return (
    <div className="flex items-center gap-2 px-3 sm:px-6 py-2 border-b border-gray-100 bg-white sticky top-14 z-20">
      {canGoBack && (
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center h-7 w-7 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}

      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex items-center gap-1 text-sm flex-wrap">
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1
            return (
              <li key={crumb.href} className="flex items-center gap-1">
                {index > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                )}
                {isLast ? (
                  <span className="text-gray-700 font-medium truncate max-w-[160px] sm:max-w-[240px]">
                    {crumb.isHome ? (
                      <Home className="h-3.5 w-3.5 inline" />
                    ) : (
                      crumb.label
                    )}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="text-gray-400 hover:text-purple-600 transition-colors truncate max-w-[100px] sm:max-w-[160px]"
                  >
                    {crumb.isHome ? (
                      <Home className="h-3.5 w-3.5 inline" />
                    ) : (
                      crumb.label
                    )}
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
    </div>
  )
}
