import {
  LayoutDashboard,
  FileText, ShoppingCart, ArrowDownToLine, ArrowUpFromLine, BookOpen, ArrowLeftRight,
  ClipboardList, FileCheck2, RefreshCw, Receipt, Truck,
  Wallet, Package, Users, UserCircle, Ruler, Warehouse, Tags,
  BarChart3, BookOpenCheck, Hourglass,
  UserSquare2, Briefcase, CalendarCheck, Banknote,
  Landmark, FileCheck,
  Scale, TrendingUp, BookMarked, CalendarDays, Clock,
  Building2, ShieldCheck, Hash, Settings, ScrollText,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  shortcut?: string;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Transactions",
    items: [
      { title: "Sales Invoice", url: "/sales-invoice", icon: FileText, shortcut: "F8" },
      { title: "Purchase Invoice", url: "/purchase-invoice", icon: ShoppingCart, shortcut: "F9" },
      { title: "Receipt", url: "/receipt", icon: ArrowDownToLine, shortcut: "F6" },
      { title: "Payment", url: "/payment", icon: ArrowUpFromLine, shortcut: "F5" },
      { title: "Journal Entry", url: "/journal", icon: BookOpen, shortcut: "F7" },
      { title: "Contra Entry", url: "/contra", icon: ArrowLeftRight },
    ],
  },
  {
    label: "GST",
    items: [
      { title: "GSTR-1", url: "/gst/gstr-1", icon: ClipboardList },
      { title: "GSTR-3B", url: "/gst/gstr-3b", icon: FileCheck2 },
      { title: "ITC Reconciliation", url: "/gst/itc", icon: RefreshCw },
      { title: "e-Invoice", url: "/gst/e-invoice", icon: Receipt },
      { title: "e-Way Bill", url: "/gst/e-way-bill", icon: Truck },
    ],
  },
  {
    label: "Masters",
    items: [
      { title: "Ledgers / Accounts", url: "/masters/ledgers", icon: Wallet },
      { title: "Stock Items", url: "/masters/stock-items", icon: Package },
      { title: "Parties", url: "/masters/parties", icon: Users },
      { title: "Employees", url: "/masters/employees", icon: UserCircle },
      { title: "Units of Measure", url: "/masters/uom", icon: Ruler },
      { title: "Godowns", url: "/masters/godowns", icon: Warehouse },
      { title: "Categories", url: "/masters/categories", icon: Tags },
    ],
  },
  {
    label: "Inventory",
    items: [
      { title: "Stock Summary", url: "/inventory/summary", icon: BarChart3 },
      { title: "Stock Ledger", url: "/inventory/ledger", icon: BookOpenCheck },
      { title: "Stock Ageing", url: "/inventory/ageing", icon: Hourglass },
    ],
  },
  {
    label: "Payroll",
    items: [
      { title: "Employees", url: "/payroll/employees", icon: UserSquare2 },
      { title: "Salary Structures", url: "/payroll/salary", icon: Briefcase },
      { title: "Attendance", url: "/payroll/attendance", icon: CalendarCheck },
      { title: "Pay Run", url: "/payroll/payrun", icon: Banknote },
    ],
  },
  {
    label: "Banking",
    items: [
      { title: "Bank Reconciliation", url: "/banking/reconciliation", icon: Landmark },
      { title: "Cheque Register", url: "/banking/cheques", icon: FileCheck },
    ],
  },
  {
    label: "Reports",
    items: [
      { title: "Balance Sheet", url: "/reports/balance-sheet", icon: Scale },
      { title: "Profit & Loss", url: "/reports/profit-loss", icon: TrendingUp },
      { title: "Trial Balance", url: "/reports/trial-balance", icon: BookMarked },
      { title: "Day Book", url: "/reports/day-book", icon: CalendarDays },
      { title: "Outstanding", url: "/reports/outstanding", icon: Clock },
    ],
  },
  {
    label: "Admin",
    items: [
      { title: "Company Profile", url: "/admin/company", icon: Building2 },
      { title: "User Management", url: "/admin/users", icon: Users },
      { title: "Roles & Permissions", url: "/admin/roles", icon: ShieldCheck },
      { title: "Number Series", url: "/admin/number-series", icon: Hash },
      { title: "System Settings", url: "/admin/settings", icon: Settings },
      { title: "Audit Log", url: "/admin/audit-log", icon: ScrollText },
    ],
  },
];
