import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ChevronDown,
  Clock,
  FileText,
  IndianRupee,
  Package,
  Plus,
  ShoppingCart,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { KpiCard } from "@/components/primitives/KpiCard";
import { PageHeader } from "@/components/primitives/PageHeader";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { formatINR, formatINRCompact } from "@/lib/format";
import { lowStockItems, recentVouchers, salesTrend30d, topCustomers } from "@/lib/mockData";

const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

const quickActions = [
  { label: "New Sales Invoice", to: "/sales-invoice/new", icon: FileText, tone: "bg-primary-soft text-primary" },
  { label: "New Receipt", to: "/receipt", icon: IndianRupee, tone: "bg-success-soft text-success" },
  { label: "New Purchase", to: "/purchase-invoice/new", icon: ShoppingCart, tone: "bg-info-soft text-info" },
  { label: "View Reports", to: "/reports/balance-sheet", icon: BookOpen, tone: "bg-warning-soft text-warning" },
];

export default function Dashboard() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Baba Premgiri Paints — FY 2024-25"
        actions={
          <>
            <span className="hidden text-sm text-muted-foreground sm:inline">Today: {today}</span>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" />
              Quick Entry
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Today's Sales"
          value={formatINRCompact(48250)}
          delta="+12.4% vs yesterday"
          deltaTone="up"
          icon={IndianRupee}
          iconTone="primary"
        />
        <KpiCard
          title="Outstanding Receivable"
          value={formatINRCompact(342000)}
          delta="12 parties pending"
          deltaTone="warning"
          icon={Clock}
          iconTone="warning"
        />
        <KpiCard
          title="GST Payable This Month"
          value={formatINRCompact(18450)}
          delta="Due: 20th May"
          deltaTone="neutral"
          icon={FileText}
          iconTone="info"
        />
        <KpiCard
          title="Low Stock Alerts"
          value="7 items"
          delta="3 critical"
          deltaTone="down"
          icon={AlertTriangle}
          iconTone="destructive"
        />
      </div>

      {/* Row 2: chart + top customers */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-border bg-surface p-5 shadow-card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground">Sales — Last 30 days</h3>
              <p className="text-xs text-muted-foreground">Daily sales totals across all branches</p>
            </div>
            <span className="text-xs font-medium text-success">▲ +8.2% vs previous period</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesTrend30d} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} interval={4} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--surface))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [formatINR(v), "Sales"]}
                />
                <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#salesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">Top customers</h3>
            <Link to="/reports/outstanding" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <ul className="space-y-3">
            {topCustomers.map((c) => (
              <li key={c.name} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                    {c.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">{c.invoices} open invoices</p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {formatINRCompact(c.outstanding)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Row 3: recent vouchers + reminder */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-border bg-surface shadow-card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">Recent vouchers</h3>
              <p className="text-xs text-muted-foreground">Last 10 entries across all books</p>
            </div>
            <Link to="/vouchers" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Number</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Party</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentVouchers.map((v) => (
                  <tr key={v.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{v.number}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{v.type}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{v.party}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-foreground">
                      {formatINR(v.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={v.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-lg border border-warning/30 bg-warning-soft p-5 shadow-card">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/20 text-warning">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-warning">GSTR-1 due soon</h4>
                <p className="mt-1 text-xs text-warning/80">
                  File GSTR-1 for April 2025 by <span className="font-medium">11 May 2025</span>. 142 invoices ready to upload.
                </p>
                <Link
                  to="/gst/gstr-1"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-warning hover:underline"
                >
                  Review & file <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Low stock</h4>
              <Link to="/inventory/summary" className="text-xs font-medium text-primary hover:underline">
                Manage
              </Link>
            </div>
            <ul className="space-y-3">
              {lowStockItems.map((it) => (
                <li key={it.code} className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-destructive-soft text-destructive">
                    <Package className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{it.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {it.stock} in stock · reorder at {it.reorder}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      {/* Row 4: quick actions */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {quickActions.map((a) => (
          <Link
            key={a.label}
            to={a.to}
            className="group flex items-center gap-3 rounded-lg border border-border bg-surface p-4 shadow-card transition-colors hover:border-primary/40 hover:bg-primary-soft/40"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-md ${a.tone}`}>
              <a.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{a.label}</p>
              <p className="text-[11px] text-muted-foreground">Quick action</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        ))}
      </div>
    </div>
  );
}
