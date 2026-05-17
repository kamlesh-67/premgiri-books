import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AppLayout } from "@/components/layout/AppLayout";
import { ComingSoon } from "@/components/primitives/ComingSoon";
import { navGroups } from "@/components/layout/navConfig";

import Login from "./screens/auth/Login";
import Dashboard from "./screens/app/Dashboard";
import NotFound from "./screens/NotFound";

// Transactions
import SalesInvoiceList from "./screens/app/transactions/SalesInvoiceList";
import SalesInvoiceNew from "./screens/app/transactions/SalesInvoiceNew";
import SalesInvoiceDetail from "./screens/app/transactions/SalesInvoiceDetail";
import PurchaseInvoiceList from "./screens/app/transactions/PurchaseInvoiceList";
import PurchaseInvoiceNew from "./screens/app/transactions/PurchaseInvoiceNew";
import Receipt from "./screens/app/transactions/Receipt";
import Payment from "./screens/app/transactions/Payment";
import Journal from "./screens/app/transactions/Journal";
import Contra from "./screens/app/transactions/Contra";
import VoucherList from "./screens/app/transactions/VoucherList";
import VoucherDetail from "./screens/app/transactions/VoucherDetail";
// GST
import Gstr1 from "./screens/app/gst/Gstr1";
import Gstr3b from "./screens/app/gst/Gstr3b";
import ItcRecon from "./screens/app/gst/ItcRecon";
import EInvoice from "./screens/app/gst/EInvoice";
import EWayBill from "./screens/app/gst/EWayBill";
// Masters
import Ledgers from "./screens/app/masters/Ledgers";
import StockItems from "./screens/app/masters/StockItems";
import Parties from "./screens/app/masters/Parties";
import Employees from "./screens/app/masters/Employees";
import Uom from "./screens/app/masters/Uom";
import Godowns from "./screens/app/masters/Godowns";
import Categories from "./screens/app/masters/Categories";
// Inventory
import StockSummary from "./screens/app/inventory/StockSummary";
import StockLedger from "./screens/app/inventory/StockLedger";
import StockAgeing from "./screens/app/inventory/StockAgeing";
// Payroll
import PayrollEmployees from "./screens/app/payroll/PayrollEmployees";
import SalaryStructures from "./screens/app/payroll/SalaryStructures";
import Attendance from "./screens/app/payroll/Attendance";
import PayRun from "./screens/app/payroll/PayRun";
// Banking
import Reconciliation from "./screens/app/banking/Reconciliation";
import Cheques from "./screens/app/banking/Cheques";
// Reports
import BalanceSheet from "./screens/app/reports/BalanceSheet";
import ProfitLoss from "./screens/app/reports/ProfitLoss";
import TrialBalance from "./screens/app/reports/TrialBalance";
import DayBook from "./screens/app/reports/DayBook";
import Outstanding from "./screens/app/reports/Outstanding";
// Admin
import Company from "./screens/app/admin/Company";
import Users from "./screens/app/admin/Users";
import Roles from "./screens/app/admin/Roles";
import NumberSeries from "./screens/app/admin/NumberSeries";
import Settings from "./screens/app/admin/Settings";
import AuditLog from "./screens/app/admin/AuditLog";

const queryClient = new QueryClient();

// Auto-generate placeholder routes for every nav item not implemented in full yet.
const implementedPaths = new Set<string>([
  "/dashboard",
  "/sales-invoice", "/purchase-invoice", "/receipt", "/payment", "/journal", "/contra",
  "/gst/gstr-1", "/gst/gstr-3b", "/gst/itc", "/gst/e-invoice", "/gst/e-way-bill",
  "/masters/ledgers", "/masters/stock-items", "/masters/parties",
  "/masters/employees", "/masters/uom", "/masters/godowns", "/masters/categories",
  "/inventory/summary", "/inventory/ledger", "/inventory/ageing",
  "/payroll/employees", "/payroll/salary", "/payroll/attendance", "/payroll/payrun",
  "/banking/reconciliation", "/banking/cheques",
  "/reports/balance-sheet", "/reports/profit-loss", "/reports/trial-balance",
  "/reports/day-book", "/reports/outstanding",
  "/admin/company", "/admin/users", "/admin/roles", "/admin/number-series",
  "/admin/settings", "/admin/audit-log",
]);
const placeholderRoutes = navGroups.flatMap((g) =>
  g.items
    .filter((item) => !implementedPaths.has(item.url))
    .map((item) => (
      <Route
        key={item.url}
        path={item.url}
        element={<ComingSoon title={item.title} subtitle={g.label ? `${g.label} module` : undefined} />}
      />
    ))
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />

          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            {placeholderRoutes}
            {/* Transactions */}
            <Route path="/sales-invoice" element={<SalesInvoiceList />} />
            <Route path="/sales-invoice/new" element={<SalesInvoiceNew />} />
            <Route path="/sales-invoice/:id/edit" element={<SalesInvoiceNew />} />
            <Route path="/sales-invoice/:id" element={<SalesInvoiceDetail />} />
            <Route path="/purchase-invoice" element={<PurchaseInvoiceList />} />
            <Route path="/purchase-invoice/new" element={<PurchaseInvoiceNew />} />
            <Route path="/purchase-invoice/:id/edit" element={<PurchaseInvoiceNew />} />
            <Route path="/receipt" element={<Receipt />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/contra" element={<Contra />} />
            <Route path="/vouchers" element={<VoucherList />} />
            <Route path="/vouchers/:id" element={<VoucherDetail />} />
            {/* GST */}
            <Route path="/gst/gstr-1" element={<Gstr1 />} />
            <Route path="/gst/gstr-3b" element={<Gstr3b />} />
            <Route path="/gst/itc" element={<ItcRecon />} />
            <Route path="/gst/e-invoice" element={<EInvoice />} />
            <Route path="/gst/e-way-bill" element={<EWayBill />} />
            {/* Masters */}
            <Route path="/masters/ledgers" element={<Ledgers />} />
            <Route path="/masters/stock-items" element={<StockItems />} />
            <Route path="/masters/parties" element={<Parties />} />
            <Route path="/masters/employees" element={<Employees />} />
            <Route path="/masters/uom" element={<Uom />} />
            <Route path="/masters/godowns" element={<Godowns />} />
            <Route path="/masters/categories" element={<Categories />} />
            {/* Inventory */}
            <Route path="/inventory/summary" element={<StockSummary />} />
            <Route path="/inventory/ledger" element={<StockLedger />} />
            <Route path="/inventory/ageing" element={<StockAgeing />} />
            {/* Payroll */}
            <Route path="/payroll/employees" element={<PayrollEmployees />} />
            <Route path="/payroll/salary" element={<SalaryStructures />} />
            <Route path="/payroll/attendance" element={<Attendance />} />
            <Route path="/payroll/payrun" element={<PayRun />} />
            {/* Banking */}
            <Route path="/banking/reconciliation" element={<Reconciliation />} />
            <Route path="/banking/cheques" element={<Cheques />} />
            {/* Reports */}
            <Route path="/reports/balance-sheet" element={<BalanceSheet />} />
            <Route path="/reports/profit-loss" element={<ProfitLoss />} />
            <Route path="/reports/trial-balance" element={<TrialBalance />} />
            <Route path="/reports/day-book" element={<DayBook />} />
            <Route path="/reports/outstanding" element={<Outstanding />} />
            {/* Admin */}
            <Route path="/admin/company" element={<Company />} />
            <Route path="/admin/users" element={<Users />} />
            <Route path="/admin/roles" element={<Roles />} />
            <Route path="/admin/number-series" element={<NumberSeries />} />
            <Route path="/admin/settings" element={<Settings />} />
            <Route path="/admin/audit-log" element={<AuditLog />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
