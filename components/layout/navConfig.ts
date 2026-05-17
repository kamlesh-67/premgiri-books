import {
  LayoutDashboard,
  Users,
  Package,
  BookOpen,
  Ruler,
  Warehouse,
  FolderTree,
  ArrowUpRight,
  ShoppingCart,
  ArrowDownLeft,
  Receipt,
  ClipboardList,
  RefreshCw,
  FileText,
  BarChart3,
  Building,
  UserCog,
  Shield,
  Link2,
  FileCheck,
  Truck,
  AlertCircle,
  Calculator,
  ListOrdered,
  CalendarDays,
  FileDigit,
  TrendingUp,
  Scale,
  History,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ─── Nav Item Interface ───────────────────────────────────────────────────────
export interface NavItem {
  href: string
  simpleLabel: string | null    // null = hidden in Simple Mode
  advancedLabel: string         // always shown in Advanced Mode
  icon: LucideIcon
  shortcut?: string
  visibleIn: ('simple' | 'advanced')[]
  requirePermission?: { resource: string; action: string }
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

// ─── Nav Configuration ────────────────────────────────────────────────────────
export const navGroups: NavGroup[] = [
  {
    // No label — just Dashboard
    items: [
      {
        href: '/dashboard',
        simpleLabel: 'Dashboard',
        advancedLabel: 'Dashboard',
        icon: LayoutDashboard,
        visibleIn: ['simple', 'advanced'],
      },
    ],
  },
  {
    label: 'MASTERS',
    items: [
      {
        href: '/masters/parties',
        simpleLabel: 'Customers & Suppliers',
        advancedLabel: 'Parties',
        icon: Users,
        visibleIn: ['simple', 'advanced'],
      },
      {
        href: '/masters/stock-items',
        simpleLabel: 'Products',
        advancedLabel: 'Stock Items',
        icon: Package,
        visibleIn: ['simple', 'advanced'],
      },
      {
        href: '/masters/units-of-measure',
        simpleLabel: 'Units of Measure',
        advancedLabel: 'Units of Measure',
        icon: Ruler,
        visibleIn: ['simple', 'advanced'],
      },
      {
        href: '/masters/godowns',
        simpleLabel: 'Godowns',
        advancedLabel: 'Godowns',
        icon: Warehouse,
        visibleIn: ['simple', 'advanced'],
      },
      {
        href: '/masters/ledgers',
        simpleLabel: null,          // D-21: hidden in Simple Mode
        advancedLabel: 'Ledgers',
        icon: BookOpen,
        visibleIn: ['advanced'],    // D-21
      },
      {
        href: '/masters/account-groups',
        simpleLabel: null,
        advancedLabel: 'Account Groups',
        icon: FolderTree,
        visibleIn: ['advanced'],
      },
      {
        href: '/masters/employees',
        simpleLabel: 'Employees',
        advancedLabel: 'Employees',
        icon: Users,
        visibleIn: ['simple', 'advanced'],
      },
    ],
  },
  {
    label: 'TRANSACTIONS',
    items: [
      {
        href: '/sales-invoice',
        simpleLabel: 'Sell to Customer',
        advancedLabel: 'Sales Invoice',
        icon: ArrowUpRight,
        shortcut: 'F8',
        visibleIn: ['simple', 'advanced'],
      },
      {
        href: '/purchase-invoice',
        simpleLabel: 'Buy from Supplier',
        advancedLabel: 'Purchase Invoice',
        icon: ShoppingCart,
        shortcut: 'F9',
        visibleIn: ['simple', 'advanced'],
      },
      {
        href: '/receipt',
        simpleLabel: 'Money Received',
        advancedLabel: 'Receipt',
        icon: ArrowDownLeft,
        shortcut: 'F6',
        visibleIn: ['simple', 'advanced'],
      },
      {
        href: '/payment',
        simpleLabel: 'Money Paid',
        advancedLabel: 'Payment',
        icon: Receipt,
        shortcut: 'F5',
        visibleIn: ['simple', 'advanced'],
      },
      {
        href: '/journal',
        simpleLabel: null,          // hidden in Simple Mode
        advancedLabel: 'Journal Entry',
        icon: ClipboardList,
        shortcut: 'F7',
        visibleIn: ['advanced'],
      },
      {
        href: '/contra',
        simpleLabel: null,
        advancedLabel: 'Contra Entry',
        icon: RefreshCw,
        visibleIn: ['advanced'],
      },
    ],
  },
  {
    label: 'GST',
    items: [
      {
        href: '/gst/gstr1',
        simpleLabel: 'Tax Returns',
        advancedLabel: 'GSTR-1',
        icon: Receipt,
        visibleIn: ['simple', 'advanced'],
      },
      {
        href: '/gst/gstr3b',
        simpleLabel: null,
        advancedLabel: 'GSTR-3B',
        icon: FileCheck,
        visibleIn: ['advanced'],
      },
      {
        href: '/gst/itc-reconciliation',
        simpleLabel: null,
        advancedLabel: 'ITC Reconciliation',
        icon: Link2,
        visibleIn: ['advanced'],
      },
      {
        href: '/gst/einvoice',
        simpleLabel: null,
        advancedLabel: 'e-Invoice',
        icon: FileText,
        visibleIn: ['advanced'],
      },
      {
        href: '/gst/ewaybill',
        simpleLabel: null,
        advancedLabel: 'e-Way Bill',
        icon: Truck,
        visibleIn: ['advanced'],
      },
    ],
  },
  {
    label: 'INVENTORY',
    items: [
      {
        href: '/inventory/stock-summary',
        simpleLabel: 'Stock Summary',
        advancedLabel: 'Stock Summary',
        icon: BarChart3,
        visibleIn: ['simple', 'advanced'],
      },
      {
        href: '/inventory/stock-ledger',
        simpleLabel: null,
        advancedLabel: 'Stock Ledger',
        icon: ClipboardList,
        visibleIn: ['advanced'],
      },
      {
        href: '/inventory/ageing',
        simpleLabel: null,
        advancedLabel: 'Stock Ageing',
        icon: AlertCircle,
        visibleIn: ['advanced'],
      },
    ],
  },
  {
    label: 'PAYROLL',
    items: [
      {
        href: '/payroll/employees',
        simpleLabel: null,
        advancedLabel: 'Employees',
        icon: Users,
        visibleIn: ['advanced'],
      },
      {
        href: '/payroll/salary',
        simpleLabel: null,
        advancedLabel: 'Salary Structures',
        icon: ListOrdered,
        visibleIn: ['advanced'],
      },
      {
        href: '/payroll/attendance',
        simpleLabel: null,
        advancedLabel: 'Attendance',
        icon: CalendarDays,
        visibleIn: ['advanced'],
      },
      {
        href: '/payroll/payrun',
        simpleLabel: null,
        advancedLabel: 'Pay Run',
        icon: Calculator,
        visibleIn: ['advanced'],
      },
    ],
  },
  {
    label: 'BANKING',
    items: [
      {
        href: '/banking/reconciliation',
        simpleLabel: 'My Money',
        advancedLabel: 'Reconciliation',
        icon: RefreshCw,
        visibleIn: ['simple', 'advanced'],
      },
      {
        href: '/banking/cheque-register',
        simpleLabel: null,
        advancedLabel: 'Cheque Register',
        icon: FileText,
        visibleIn: ['advanced'],
      },
    ],
  },
  {
    label: 'REPORTS',
    items: [
      {
        href: '/reports/balance-sheet',
        simpleLabel: null,
        advancedLabel: 'Balance Sheet',
        icon: Scale,
        visibleIn: ['advanced'],
      },
      {
        href: '/reports/profit-loss',
        simpleLabel: null,
        advancedLabel: 'Profit & Loss',
        icon: TrendingUp,
        visibleIn: ['advanced'],
      },
      {
        href: '/reports/trial-balance',
        simpleLabel: null,
        advancedLabel: 'Trial Balance',
        icon: BarChart3,
        visibleIn: ['advanced'],
      },
      {
        href: '/reports/daybook',
        simpleLabel: null,
        advancedLabel: 'Day Book',
        icon: BookOpen,
        visibleIn: ['advanced'],
      },
      {
        href: '/reports/outstanding',
        simpleLabel: null,
        advancedLabel: 'Outstanding',
        icon: AlertCircle,
        visibleIn: ['advanced'],
      },
      {
        href: '/reports/tds',
        simpleLabel: null,
        advancedLabel: 'TDS Register',
        icon: FileDigit,
        visibleIn: ['advanced'],
      },
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      {
        href: '/settings/company',
        simpleLabel: 'Company',
        advancedLabel: 'Company',
        icon: Building,
        visibleIn: ['simple', 'advanced'],
        requirePermission: { resource: 'settings', action: 'read' },
      },
      {
        href: '/settings/users',
        simpleLabel: 'Team Members',
        advancedLabel: 'Users',
        icon: UserCog,
        visibleIn: ['advanced'],
        requirePermission: { resource: 'users', action: 'read' },
      },
      {
        href: '/settings/roles',
        simpleLabel: null,
        advancedLabel: 'Roles & Permissions',
        icon: Shield,
        visibleIn: ['advanced'],
        requirePermission: { resource: 'settings', action: 'admin' },
      },
      {
        href: '/settings/audit-trail',
        simpleLabel: null,
        advancedLabel: 'Audit Trail',
        icon: History,
        visibleIn: ['advanced'],
        requirePermission: { resource: 'settings', action: 'admin' },
      },
    ],
  },
]
