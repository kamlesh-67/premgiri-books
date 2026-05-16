import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AppLayout } from "@/components/layout/AppLayout";
import { ComingSoon } from "@/components/primitives/ComingSoon";
import { navGroups } from "@/components/layout/navConfig";

import Login from "./pages/auth/Login";
import Dashboard from "./pages/app/Dashboard";
import NotFound from "./pages/NotFound";

// Transactions
import SalesInvoiceList from "./pages/app/transactions/SalesInvoiceList";
import SalesInvoiceNew from "./pages/app/transactions/SalesInvoiceNew";
import SalesInvoiceDetail from "./pages/app/transactions/SalesInvoiceDetail";
import PurchaseInvoiceList from "./pages/app/transactions/PurchaseInvoiceList";
import PurchaseInvoiceNew from "./pages/app/transactions/PurchaseInvoiceNew";
import Receipt from "./pages/app/transactions/Receipt";
import Payment from "./pages/app/transactions/Payment";
import Journal from "./pages/app/transactions/Journal";
import Contra from "./pages/app/transactions/Contra";
import VoucherList from "./pages/app/transactions/VoucherList";
import VoucherDetail from "./pages/app/transactions/VoucherDetail";
// GST
import Gstr1 from "./pages/app/gst/Gstr1";
import Gstr3b from "./pages/app/gst/Gstr3b";
import ItcRecon from "./pages/app/gst/ItcRecon";
import EInvoice from "./pages/app/gst/EInvoice";
import EWayBill from "./pages/app/gst/EWayBill";
// Masters
import Ledgers from "./pages/app/masters/Ledgers";
import StockItems from "./pages/app/masters/StockItems";
import Parties from "./pages/app/masters/Parties";
import Employees from "./pages/app/masters/Employees";
import Uom from "./pages/app/masters/Uom";
import Godowns from "./pages/app/masters/Godowns";
import Categories from "./pages/app/masters/Categories";
// Inventory
import StockSummary from "./pages/app/inventory/StockSummary";
import StockLedger from "./pages/app/inventory/StockLedger";
import StockAgeing from "./pages/app/inventory/StockAgeing";
// Payroll
import PayrollEmployees from "./pages/app/payroll/PayrollEmployees";
import SalaryStructures from "./pages/app/payroll/SalaryStructures";
import Attendance from "./pages/app/payroll/Attendance";
import PayRun from "./pages/app/payroll/PayRun";
// Banking
import Reconciliation from "./pages/app/banking/Reconciliation";
import Cheques from "./pages/app/banking/Cheques";
// Reports
import BalanceSheet from "./pages/app/reports/BalanceSheet";
import ProfitLoss from "./pages/app/reports/ProfitLoss";
import TrialBalance from "./pages/app/reports/TrialBalance";
import DayBook from "./pages/app/reports/DayBook";
import Outstanding from "./pages/app/reports/Outstanding";
// Admin
import Company from "./pages/app/admin/Company";
import Users from "./pages/app/admin/Users";
import Roles from "./pages/app/admin/Roles";
import NumberSeries from "./pages/app/admin/NumberSeries";
import Settings from "./pages/app/admin/Settings";
import AuditLog from "./pages/app/admin/AuditLog";

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
