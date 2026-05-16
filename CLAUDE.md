# PremGiri Books — Claude Code Master Context
> Read this file completely at the start of every session before writing any code.
> Update the "Current Session" section at the end of every session.

---

## Project Identity

| Key | Value |
|---|---|
| **Name** | PremGiri Books |
| **Type** | GST Accounting & Business Management SaaS — TallyPrime clone for Indian businesses |
| **Stack** | Next.js 15 (App Router) · TypeScript strict · PostgreSQL · Prisma ORM · NextAuth.js v5 |
| **UI** | Tailwind CSS + shadcn/ui ONLY — no other component libraries |
| **State** | TanStack Query v5 (server state) · Zustand (UI state) |
| **Validation** | Zod on all API inputs and forms |
| **Testing** | Vitest (unit) · Playwright (e2e) · CodeRabbit (AI PR review on every PR) |
| **Deploy** | Vercel · Neon PostgreSQL · Upstash Redis |
| **Package Manager** | pnpm |
| **Node** | v20 LTS |

---

## ⚠️ Non-Negotiable Business Rules — Never Break These

1. **MONEY** — Every financial field in Prisma: `Decimal @db.Decimal(15, 2)`. Never `Float`. Never `number`.
2. **MULTI-TENANT** — Every single Prisma query MUST have `where: { companyId: session.user.companyId }`. No exceptions.
3. **DOUBLE ENTRY** — Every voucher: `SUM(all DR) === SUM(all CR)`. Throw `ValidationError` if not balanced. Never save an unbalanced voucher.
4. **GST MATH** — Intra-state: CGST + SGST (half each). Inter-state: IGST (full). Never mix them.
5. **INDIAN FY** — April 1 – March 31. Voucher numbers reset per financial year.
6. **SOFT DELETE** — Vouchers → `status: 'CANCELLED'`. Masters → `isActive: false`. Never hard-delete any financial record.
7. **AUDIT LOG** — Every create / update / cancel → write to `audit_logs` inside the same Prisma `$transaction`.
8. **INDIAN FORMAT** — All currency displayed as `₹1,23,456.00` (Indian lakh system, not millions).
9. **AUTH** — Every API route: call `getServerSession(authOptions)` → return `401` if session is null.
10. **ZOD** — Every API request body: parse with a Zod schema before touching the database.

---

## Design System
> Load `.claude/skills/ui-design.md` before any UI task. This is mandatory.

The visual design of PremGiri Books uses a **clean enterprise SaaS style** derived from the reference UI provided. White backgrounds, a purple (#7C3AED) primary color, subtle borders, stat cards with colored icons, and data-dense tables.

### Color Palette — Use These Exactly

```
Primary (purple-600):   #7C3AED  — buttons, active nav item, icon highlights, links
Primary bg (purple-50): #EDE9FE  — active nav background, hover highlights
Primary dark (purple-700): #6D28D9  — button hover state

Page background:   bg-gray-50    (#F9FAFB)
Card background:   bg-white      (#FFFFFF)
Border:            border-gray-200 (#E5E7EB)
Table dividers:    divide-gray-100 (#F3F4F6)

Text heading:      text-gray-900  (#111827)  — page titles, KPI numbers
Text body:         text-gray-700  (#374151)  — table rows, form text
Text secondary:    text-gray-500  (#6B7280)  — subtitles, muted labels
Text muted:        text-gray-400  (#9CA3AF)  — placeholders, chart axis

STATUS COLORS (badges only):
  Posted / Paid / Filed / Active:  bg-green-100  text-green-700
  Draft / Not Filed / Inactive:    bg-gray-100   text-gray-600
  Cancelled / Overdue / Error:     bg-red-100    text-red-700
  Uploaded / Processing / Info:    bg-blue-100   text-blue-700
  Pending / Due Soon / Warning:    bg-amber-100  text-amber-700
```

### Typography

```
Font:              Inter — via next/font/google
Page Title:        text-2xl font-semibold tracking-tight text-gray-900
Page Subtitle:     text-sm text-gray-500 mt-1
Section Header:    text-base font-semibold text-gray-800
Table Header:      text-xs font-medium text-gray-500 uppercase tracking-wide
Body / Table Row:  text-sm text-gray-700
Muted:             text-xs text-gray-400
KPI Number:        text-2xl font-bold text-gray-900 tabular-nums
Amount (large):    text-3xl font-bold text-gray-900 tabular-nums
```

### Spacing & Structure

```
Page padding:       p-6
Content gap:        space-y-6
Max content width:  max-w-7xl mx-auto
Card padding:       p-5 (KPI cards) · p-6 (forms and section cards)
Table cell:         px-4 py-3
Form field gap:     space-y-4
Inline gap:         gap-2 · gap-3
Border radius:      rounded-lg (cards) · rounded-md (inputs/buttons) · rounded-full (badges)
Card shadow:        shadow-sm
Card border:        border border-gray-100
```

---

## Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  TOPBAR — fixed · h-14 · bg-white · border-b · z-50            │
│  [🅿 PremGiri Books] [Breadcrumb] [Search ⌘K] [🔔 red dot] [A] │
├───────────────┬─────────────────────────────────────────────────┤
│  SIDEBAR      │  MAIN CONTENT                                   │
│  w-[240px]    │  ml-[240px] pt-14 min-h-screen bg-gray-50       │
│  fixed        │                                                 │
│  top-14 → btm│  <div className="p-6 space-y-6 max-w-7xl mx-auto">
│  bg-white     │    <PageHeader />                               │
│  border-r     │    <KPICards />  {if applicable}               │
│               │    <SectionCard> table / form / chart </SectionCard>
│               │  </div>                                         │
└───────────────┴─────────────────────────────────────────────────┘
```

### Sidebar Navigation Groups

```
[no label]     Dashboard

TRANSACTIONS
  Sales Invoice             F8
  Purchase Invoice          F9
  Receipt                   F6
  Payment                   F5
  Journal Entry             F7
  Contra Entry

GST
  GSTR-1
  GSTR-3B
  ITC Reconciliation
  e-Invoice
  e-Way Bill

MASTERS
  Ledgers
  Stock Items
  Parties
  Employees
  Units of Measure
  Godowns

INVENTORY
  Stock Summary
  Stock Ledger
  Stock Ageing

PAYROLL
  Employees
  Salary Structures
  Attendance
  Pay Run

BANKING
  Reconciliation
  Cheque Register

REPORTS
  Balance Sheet
  Profit & Loss
  Trial Balance
  Day Book
  Outstanding

SETTINGS
  Company
  Users
  Roles & Permissions
─────────────────────────
[A] Arjun Mehta · Accountant
FY 2024-25 [badge]
```

---

## Shared Components — Build Once, Use Everywhere

### KPICard
```tsx
// Location: components/shared/KPICard.tsx
// Use on: Dashboard, GSTR-1, Ledgers, Stock Summary, etc.
<KPICard
  title="Total Receivable"
  value="₹12,34,567"
  delta="+12% from last month"
  deltaType="positive"           // "positive" | "negative" | "neutral"
  icon={IndianRupee}             // Lucide icon
  iconBg="bg-purple-100"
  iconColor="text-purple-600"
/>
// Design: white card · shadow-sm · rounded-lg · p-5
// Icon in colored circle top-right · value text-2xl font-bold · delta text-xs
```

### PageHeader
```tsx
// Location: components/shared/PageHeader.tsx
// Use on: every single page
<PageHeader
  title="Sales Invoice"
  subtitle="Create and manage sales transactions"
  action={<Button size="sm"><Plus className="h-4 w-4 mr-2"/>New Invoice</Button>}
/>
// Design: flex justify-between items-start
```

### StatusBadge
```tsx
// Location: components/shared/StatusBadge.tsx
// Voucher statuses:
<StatusBadge status="POSTED" />    → bg-green-100  text-green-700
<StatusBadge status="DRAFT" />     → bg-gray-100   text-gray-600
<StatusBadge status="CANCELLED" /> → bg-red-100    text-red-700
// GST statuses:
<StatusBadge status="FILED" />     → bg-green-100  text-green-700
<StatusBadge status="PENDING" />   → bg-amber-100  text-amber-700
<StatusBadge status="UPLOADED" />  → bg-blue-100   text-blue-700
// Design: rounded-full px-2.5 py-0.5 text-xs font-medium
```

### SectionCard
```tsx
// Location: components/shared/SectionCard.tsx
// Wraps any content block (table, chart, form section)
<SectionCard title="Recent Vouchers" action={<Button>Export</Button>}>
  {/* content */}
</SectionCard>
// Design: bg-white rounded-lg shadow-sm border border-gray-100
```

---

## File Structure

```
premgiri-books/
├── CLAUDE.md
├── .claude/
│   └── skills/
│       ├── ui-design.md
│       ├── gst-engine.md
│       ├── voucher-engine.md
│       ├── nextjs-conventions.md
│       ├── prisma-patterns.md
│       └── report-engine.md
├── .coderabbit.yaml
├── docker-compose.yml
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── app/
│   ├── layout.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── company-select/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx + loading.tsx
│   │   ├── vouchers/sales/new/page.tsx + [id]/page.tsx
│   │   ├── vouchers/purchase/new/page.tsx
│   │   ├── vouchers/receipt/new/page.tsx
│   │   ├── vouchers/payment/new/page.tsx
│   │   ├── vouchers/journal/new/page.tsx
│   │   ├── vouchers/contra/new/page.tsx
│   │   ├── gst/gstr1/page.tsx
│   │   ├── gst/gstr3b/page.tsx
│   │   ├── gst/itc-reconciliation/page.tsx
│   │   ├── gst/einvoice/page.tsx
│   │   ├── gst/ewaybill/page.tsx
│   │   ├── masters/ledgers/page.tsx + new/ + [id]/
│   │   ├── masters/stock-items/page.tsx
│   │   ├── masters/parties/page.tsx
│   │   ├── masters/employees/page.tsx
│   │   ├── masters/godowns/page.tsx
│   │   ├── inventory/stock-summary/page.tsx
│   │   ├── inventory/stock-ledger/[itemId]/page.tsx
│   │   ├── inventory/ageing/page.tsx
│   │   ├── payroll/salary-structures/page.tsx
│   │   ├── payroll/attendance/page.tsx
│   │   ├── payroll/pay-run/page.tsx
│   │   ├── banking/reconciliation/page.tsx
│   │   ├── banking/cheque-register/page.tsx
│   │   ├── reports/balance-sheet/page.tsx
│   │   ├── reports/profit-loss/page.tsx
│   │   ├── reports/trial-balance/page.tsx
│   │   ├── reports/daybook/page.tsx
│   │   ├── reports/outstanding/page.tsx
│   │   ├── settings/company/page.tsx
│   │   ├── settings/users/page.tsx
│   │   └── settings/roles/page.tsx
│   └── api/v1/
│       ├── auth/[...nextauth]/route.ts
│       ├── masters/ledgers/route.ts + [id]/route.ts
│       ├── masters/stock-items/route.ts + [id]/route.ts
│       ├── vouchers/route.ts + [id]/route.ts + [id]/pdf/route.ts
│       ├── gst/gstr1/route.ts
│       ├── gst/gstr3b/route.ts
│       ├── reports/balance-sheet/route.ts
│       ├── reports/profit-loss/route.ts
│       ├── reports/trial-balance/route.ts
│       ├── reports/daybook/route.ts
│       ├── reports/outstanding/route.ts
│       └── health/route.ts
├── components/
│   ├── ui/                    ← shadcn/ui — never modify
│   ├── layout/Sidebar.tsx · Topbar.tsx · NavItem.tsx · NavGroup.tsx
│   ├── shared/
│   │   ├── KPICard.tsx
│   │   ├── PageHeader.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── AmountDisplay.tsx
│   │   ├── DateRangePicker.tsx
│   │   ├── SearchInput.tsx
│   │   ├── FilterTabs.tsx
│   │   ├── EmptyState.tsx
│   │   └── SectionCard.tsx
│   ├── voucher/VoucherForm.tsx · LineItemsTable.tsx · GSTSummary.tsx · AccountingEntries.tsx
│   ├── reports/ReportFilters.tsx · BalanceSheetTree.tsx · AmountCell.tsx
│   └── masters/LedgerForm.tsx · StockItemForm.tsx
├── lib/
│   ├── prisma.ts
│   ├── auth.ts
│   ├── redis.ts
│   ├── services/GSTCalculator.ts · VoucherEngine.ts · ReportEngine.ts · PayrollEngine.ts · EInvoiceService.ts · EWayBillService.ts
│   ├── actions/ledger.actions.ts · voucher.actions.ts
│   ├── utils/format.ts · fy.ts · audit.ts
│   └── validations/ledger.schema.ts · voucher.schema.ts
└── types/index.ts
```

---

## Database Tables (16 Core)

```
1.  companies        — id, name, gstin VARCHAR(15), pan, stateCode, address, fyStart, logoUrl
2.  users            — id, companyId, name, email, passwordHash, roleId, isActive
3.  roles            — id, companyId, name, permissions JSONB
4.  accountGroups    — id, companyId, name, parentId (self-ref), nature (ASSET/LIABILITY/INCOME/EXPENSE), affectsGP
5.  ledgers          — id, companyId, name, groupId, gstin, pan, openingBalance Decimal(15,2), drCr (DR/CR), gstRegType, creditLimit, creditDays, bankName, bankAccount, ifsc, isActive
6.  stockGroups      — id, companyId, name, parentId (self-ref)
7.  stockItems       — id, companyId, name, groupId, uomId, hsnCode VARCHAR(8), gstRate Decimal(5,2), gstApplicable, openingQty Decimal(12,3), openingRate Decimal(12,4), reorderQty, isActive
8.  unitsOfMeasure   — id, companyId, name, symbol
9.  godowns          — id, companyId, name, address, isMain
10. voucherSequences — id, companyId, voucherType, financialYear, lastSequence INT
11. vouchers         — id, companyId, voucherType (SALES/PURCHASE/RECEIPT/PAYMENT/JOURNAL/CONTRA/CREDIT_NOTE/DEBIT_NOTE), voucherNo, date, narration, partyLedgerId, totalAmount Decimal(15,2), cgstAmount, sgstAmount, igstAmount, roundOff Decimal(5,2), status (DRAFT/POSTED/CANCELLED), irn, eWayBillNo, createdBy
12. voucherEntries   — id, voucherId, ledgerId, amount Decimal(15,2), drCr (DR/CR), narration, billRef
13. voucherItems     — id, voucherId, itemId, godownId, qty Decimal(12,3), rate Decimal(12,4), amount Decimal(15,2), discountPct, discountAmt, cgstRate, cgstAmt, sgstRate, sgstAmt, igstRate, igstAmt, hsnCode, batchNo
14. gstTransactions  — id, companyId, voucherId, gstinSupplier, gstinRecipient, supplyType, returnPeriod VARCHAR(7), taxableValue, cgst, sgst, igst, placeOfSupply VARCHAR(2), reverseCharge, gstr1Status (PENDING/UPLOADED/FILED), gstr3bStatus
15. gstReturns       — id, companyId, returnType, returnPeriod, status (NOT_FILED/EXPORTED/UPLOADED/FILED), arn, jsonData JSONB
16. auditLogs        — id, companyId, userId, entity, entityId, action (CREATE/UPDATE/DELETE/CANCEL/POST), oldValue JSONB, newValue JSONB, ipAddress, createdAt
```

---

## Skills Map

| Task | Skill File |
|---|---|
| Any UI page or component | `.claude/skills/ui-design.md` |
| GST calc, GSTR-1, GSTR-3B, ITC reconciliation | `.claude/skills/gst-engine.md` |
| Voucher create / post / cancel | `.claude/skills/voucher-engine.md` |
| Next.js App Router, API routes, Server Actions | `.claude/skills/nextjs-conventions.md` |
| Prisma schema, DB queries, migrations | `.claude/skills/prisma-patterns.md` |
| Balance Sheet, P&L, Trial Balance, reports | `.claude/skills/report-engine.md` |

---

## Local Environment

```
Database:    postgresql://postgres:postgres123@localhost:5432/premgiri_books
Redis:       redis://localhost:6379
Dev server:  http://localhost:3000
pgAdmin:     http://localhost:5050
```

---

## Build Phases

| Phase | Scope |
|---|---|
| **0** | Project init · design system · shared components · all skill files |
| **1** | Auth (NextAuth) · Sidebar/Topbar layout · Dashboard · Ledger master · Stock items master |
| **2** | VoucherEngine service · GSTCalculator service · Sales Invoice form · Purchase / Receipt / Payment / Journal |
| **3** | Invoice PDF (jsPDF) · GSTR-1 · ITC Reconciliation · GSTR-3B |
| **4** | Stock Summary · Stock Ledger (FIFO) · Stock Ageing |
| **5** | Balance Sheet · P&L · Trial Balance · Day Book · Outstanding |
| **6** | Payroll Engine · Pay Run · Pay Slip PDF |
| **7** | Bank Reconciliation · CSV bank statement import |
| **8** | e-Invoice (IRP) · e-Way Bill · GSTR-3B filing |
| **9** | RBAC · User management · Company settings |
| **10** | Global search (⌘K) · Keyboard shortcuts · Vercel deploy |

---

## Current Session
<!-- UPDATE AFTER EVERY SESSION -->
```
Phase:           0 — Project not started yet
Last completed:  Nothing
Next task:       Initialize Next.js 15 project with pnpm
Current FY:      2024-25
```
