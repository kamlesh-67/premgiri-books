#!/usr/bin/env python3
"""Write remaining skill files for plan 00-06."""

import os

BASE = r"D:\My\BPG\design-inspirations-main\.claude\skills"

report_engine = r"""# Report Engine Skill — PremGiri Books

> Load this file before building Trial Balance, Balance Sheet, P&L, Day Book, Outstanding, or any financial report.

## Amount Display Rule

ALL report amounts use `formatINR()`. Never format inline:

```ts
import { formatINR } from '@/lib/utils/format'

// formatINR uses Indian lakh system — MANDATORY format
// formatINR(new Decimal('123456'))  → "₹1,23,456.00"
// formatINR(new Decimal('1234567')) → "₹12,34,567.00"
// formatINR(0)                      → "₹0.00"

// In components — always use AmountDisplay, not raw formatINR
import { AmountDisplay } from '@/components/shared/AmountDisplay'
// <AmountDisplay amount={ledger.closingBalance} />
```

## Trial Balance (REP-01)

Structure: Opening Balance ± Period Activity = Closing Balance

```ts
export async function getTrialBalance(companyId: string, fy: string) {
  const { startDate, endDate } = getFYRange(fy)

  const ledgers = await prisma.ledger.findMany({
    where: { companyId, isActive: true },
    include: {
      group: { select: { nature: true } },
      voucherEntries: {
        where: {
          voucher: {
            companyId,
            date: { gte: startDate, lte: endDate },
            status: 'POSTED',
          }
        },
        select: { amount: true, drCr: true },
      }
    }
  })

  return ledgers.map(ledger => {
    const periodDR = ledger.voucherEntries
      .filter(e => e.drCr === 'DR')
      .reduce((sum, e) => sum.plus(new Decimal(e.amount)), new Decimal(0))
    const periodCR = ledger.voucherEntries
      .filter(e => e.drCr === 'CR')
      .reduce((sum, e) => sum.plus(new Decimal(e.amount)), new Decimal(0))

    const openingDR = ledger.drCr === 'DR' ? new Decimal(ledger.openingBalance) : new Decimal(0)
    const openingCR = ledger.drCr === 'CR' ? new Decimal(ledger.openingBalance) : new Decimal(0)

    const closingDR = openingDR.plus(periodDR).minus(periodCR)
    const closingCR = openingCR.plus(periodCR).minus(periodDR)

    return {
      ledgerId: ledger.id,
      name: ledger.name,
      openingDR,
      openingCR,
      periodDR,
      periodCR,
      closingDR: closingDR.gt(0) ? closingDR : new Decimal(0),
      closingCR: closingCR.gt(0) ? closingCR : new Decimal(0),
    }
  })
}

// Validation: SUM(all closing DR) === SUM(all closing CR)
function validateTrialBalance(rows: TrialBalanceRow[]): boolean {
  const totalDR = rows.reduce((sum, r) => sum.plus(r.closingDR), new Decimal(0))
  const totalCR = rows.reduce((sum, r) => sum.plus(r.closingCR), new Decimal(0))
  return totalDR.equals(totalCR)
}
```

## Balance Sheet (Schedule III format)

Vertical format — Indian Companies Act Schedule III:

Equity & Liabilities: Share Capital, Reserves, Long-term Borrowings, Current Liabilities
Assets: Fixed Assets, Long-term Investments, Current Assets

Balancing check — MANDATORY:
```ts
const totalEquityLiabilities = shareCapital.plus(reserves).plus(borrowings).plus(currentLiabilities)
const totalAssets = fixedAssets.plus(investments).plus(currentAssets)
if (!totalEquityLiabilities.equals(totalAssets)) {
  // Log discrepancy — never silently ignore
  console.error('Balance Sheet out of balance:', { totalEquityLiabilities, totalAssets })
}
```

## Profit & Loss Account

- Income ledgers (nature=INCOME): credit balance = income earned
- Expense ledgers (nature=EXPENSE): debit balance = expense incurred
- affectsGP=true on accountGroup: included in Gross Profit calculation
- Gross Profit = Net Sales - Cost of Goods Sold
- Net Profit = Gross Profit + Other Income - Other Expenses

```ts
export async function getProfitLoss(companyId: string, fy: string) {
  const incomeGroups = await prisma.accountGroup.findMany({
    where: { companyId, nature: 'INCOME' },
    include: { ledgers: { include: { voucherEntries: { where: postedInPeriod } } } },
  })
  const expenseGroups = await prisma.accountGroup.findMany({
    where: { companyId, nature: 'EXPENSE' },
    include: { ledgers: { include: { voucherEntries: { where: postedInPeriod } } } },
  })

  const netSales = sumLedgerCredits(incomeGroups.filter(g => g.affectsGP))
  const cogs = sumLedgerDebits(expenseGroups.filter(g => g.affectsGP))
  const grossProfit = netSales.minus(cogs)
  const otherIncome = sumLedgerCredits(incomeGroups.filter(g => !g.affectsGP))
  const otherExpenses = sumLedgerDebits(expenseGroups.filter(g => !g.affectsGP))
  const netProfit = grossProfit.plus(otherIncome).minus(otherExpenses)

  return { netSales, cogs, grossProfit, otherIncome, otherExpenses, netProfit }
}
```

## Outstanding Receivables/Payables (REP-05) — billRef is the source of truth

```ts
// CORRECT: query from billRef
const receivables = await prisma.billRef.findMany({
  where: {
    companyId,
    drCr: 'DR',
    settled: false,
    outstandingAmount: { gt: 0 },
  },
  include: {
    ledger: { select: { name: true, creditDays: true } },
    voucher: { select: { voucherNo: true, date: true } },
  },
  orderBy: { billDate: 'asc' },
})

// Payables (money we owe)
const payables = await prisma.billRef.findMany({
  where: { companyId, drCr: 'CR', settled: false, outstandingAmount: { gt: 0 } },
  include: { ledger: true, voucher: true },
})

// WRONG: never compute outstanding from vouchers directly
// const outstanding = await prisma.voucherEntry.groupBy({ ... }) — BANNED for outstanding
```

## Ageing Buckets

```ts
function getAgeingBucket(billDate: Date, creditDays = 30): string {
  const dueDate = new Date(billDate)
  dueDate.setDate(dueDate.getDate() + creditDays)
  const today = new Date()
  const days = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'current'
  if (days <= 30) return '1-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '90+'
}

const ageingSummary = receivables.reduce((acc, bill) => {
  const bucket = getAgeingBucket(bill.billDate, bill.ledger.creditDays ?? 30)
  acc[bucket] = (acc[bucket] ?? new Decimal(0)).plus(new Decimal(bill.outstandingAmount))
  return acc
}, {} as Record<string, Decimal>)
```

## Day Book (REP-04)

Chronological list of ALL posted vouchers for a date range:

```ts
const dayBook = await prisma.voucher.findMany({
  where: {
    companyId,
    status: 'POSTED',
    date: { gte: fromDate, lte: toDate },
  },
  include: {
    party: { select: { name: true } },
    voucherEntries: { include: { ledger: { select: { name: true } } } },
  },
  orderBy: [{ date: 'asc' }, { voucherNo: 'asc' }],
})
```

## FIFO Costing (INV-01, INV-03)

Process purchase batches in chronological order. Each sale consumes from oldest batch first.
Store batch info in voucherItems.batchNo for traceability.

```ts
function consumeFromFIFO(batches: StockBatch[], qtyToConsume: Decimal): {
  costOfGoodsSold: Decimal
  updatedBatches: StockBatch[]
} {
  let remaining = qtyToConsume
  let cogs = new Decimal(0)
  const updated = batches
    .sort((a, b) => a.purchaseDate.getTime() - b.purchaseDate.getTime())
    .map(batch => {
      if (remaining.lte(0) || batch.remainingQty.lte(0)) return batch
      const consumed = Decimal.min(batch.remainingQty, remaining)
      cogs = cogs.plus(consumed.times(batch.rate))
      remaining = remaining.minus(consumed)
      return { ...batch, remainingQty: batch.remainingQty.minus(consumed) }
    })
  return { costOfGoodsSold: cogs, updatedBatches: updated }
}
```

## Excel Export (REP-02, REP-03)

Use ExcelJS for Balance Sheet and P&L export:
```ts
import ExcelJS from 'exceljs'
// pnpm add exceljs (Phase 5 installs this)

export async function exportToExcel(data: ReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Report')
  // All displayed amounts: formatINR(amount)
  return workbook.xlsx.writeBuffer() as Promise<Buffer>
}
```

## Financial Year Utilities

```ts
// lib/utils/fy.ts
export function getFYRange(fy: string): { startDate: Date; endDate: Date } {
  const [startYearStr] = fy.split('-')  // "2024" from "2024-25"
  const startYear = parseInt(startYearStr)
  return {
    startDate: new Date(startYear, 3, 1),      // April 1
    endDate: new Date(startYear + 1, 2, 31),   // March 31
  }
}

export function getCurrentFY(): string {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  if (month >= 4) return `${year}-${String(year + 1).slice(-2)}`
  return `${year - 1}-${String(year).slice(-2)}`
}
```

## Report Caching Strategy

```ts
// Server components: React cache()
import { cache } from 'react'
export const getTrialBalance = cache(async (companyId: string, fy: string) => {
  return computeTrialBalance(companyId, fy)
})

// API routes: unstable_cache with revalidation tags
import { unstable_cache } from 'next/cache'
export const getCachedReport = unstable_cache(
  async (companyId: string, fy: string) => computeTrialBalance(companyId, fy),
  ['trial-balance'],
  { revalidate: 300, tags: ['reports'] }
)
// After voucher mutations: revalidatePath('/reports/trial-balance')
```
"""

ux_layman = r"""# UX Layman Skill — PremGiri Books

> Load this file before any UI that must support Simple Mode, or any user-facing text.

## The Two Audiences

| Feature | Simple Mode (Business Owner) | Advanced Mode (Accountant) |
|---------|------------------------------|---------------------------|
| Who | Business owner, zero accounting knowledge | CA, accountant, bookkeeper |
| Labels | Plain English | Accounting jargon OK |
| Voucher entry | 3-step wizard (Who → What → Confirm) | Full form with all fields |
| Key principle | Never show: debit, credit, ledger, narration, contra, sundry | All terms OK |

## Label Mapping Table (Simple Mode → Advanced Mode)

| Simple Mode | Advanced Mode |
|-------------|--------------|
| "Sell to Customer" | "Sales Invoice" |
| "Buy from Supplier" | "Purchase Invoice" |
| "Money Received" | "Receipt Voucher" |
| "Money Paid" | "Payment Voucher" |
| "Customers & Suppliers" | "Ledgers" |
| "Products" | "Stock Items" |
| "Tax Returns" | "GST" |
| "My Money" | "Banking" |
| "Order from Supplier" | "Purchase Order" |
| "Order from Customer" | "Sales Order" |
| "Who owes me money" | "Outstanding Receivables" |
| "Who I owe money to" | "Outstanding Payables" |
| "Customer Returned Goods" | "Credit Note" |
| "Return to Supplier" | "Debit Note" |
| "Generate transport document" | "Generate e-Way Bill" |
| "Match my bank statement" | "Bank Reconciliation" |
| "What stock do I have?" | "Stock Summary" |
| "How long has my stock been sitting?" | "Stock Ageing" |
| "Tax Credit" | "ITC (Input Tax Credit)" |
| "Business Health" | "Dashboard / Reports" |
| "Save" | "Post Voucher" |
| "Products I sell" | "Stock Items" |
| "Transactions" | "Vouchers" |
| "Payment I owe" | "Accounts Payable" |
| "Money owed to me" | "Accounts Receivable" |

## Detecting UI Mode in Components

```tsx
// From Zustand store (Phase 1 creates this)
import { useUIStore } from '@/lib/stores/ui.store'

function VoucherForm() {
  const { uiMode } = useUIStore()
  return uiMode === 'simple' ? <SimpleWizard /> : <AdvancedForm />
}

// Conditional label rendering
function NavLabel({ simple, advanced }: { simple: string; advanced: string }) {
  const { uiMode } = useUIStore()
  return <span>{uiMode === 'simple' ? simple : advanced}</span>
}

// Usage:
// <NavLabel simple="Sell to Customer" advanced="Sales Invoice" />
```

## Plain-Language Validation Errors (UX-04 — mandatory)

```
CORRECT: Plain English (always shown to user)
"This GSTIN doesn't look right — it should be 15 characters like 29ABCDE1234F1Z5"
"Your entries don't balance — check your amounts"
"This HSN code should be 4 or 6 digits"
"Please select a customer before adding products"
"The invoice date can't be in the future"
"You need to add at least one product to create an invoice"
"The quantity must be greater than zero"
"This stock item doesn't have a GST rate set — please update it in Products"
"This customer's credit limit is ₹1,00,000 — this invoice would exceed it"

WRONG: Technical messages (NEVER shown to user)
"Regex validation failed: /^[0-9]{2}[A-Z]{5}..."
"ValidationError: SUM(DR) ≠ SUM(CR)"
"Invalid input: expected string, received number"
"500 Internal Server Error"
"FOREIGN KEY constraint failed"
"Unique constraint violation on field 'voucherNo'"
```

## Smart Defaults (UX-06)

When creating a sale in Simple Mode, auto-select/auto-fill:
- Sales Income ledger → auto-selected as credit account
- GST rate → auto-filled from selected product's HSN
- CGST/SGST vs IGST → auto-determined from party state code (never ask user)
- Voucher date → today (always)
- Financial year → auto-detected from date
- Voucher number → auto-generated (never shown for input in Simple Mode)
- Currency → INR (always; no choice shown)

```ts
// Auto-detect supply type from party's state code
function getSupplyType(company: Company, party: Ledger): 'INTRA_STATE' | 'INTER_STATE' {
  return company.stateCode === party.stateCode ? 'INTRA_STATE' : 'INTER_STATE'
}
// Simple Mode: NEVER show CGST/SGST/IGST split — just show "Tax: ₹X,XXX"
// Advanced Mode: show full breakdown
```

## Empty State Pattern (UX-05)

Every list page must have a meaningful empty state:
```tsx
import { EmptyState } from '@/components/shared/EmptyState'
import { FileText } from 'lucide-react'

// Simple Mode empty state
<EmptyState
  icon={FileText}
  title="No invoices yet"
  description="Invoices you create for customers will appear here. Each invoice records what you sold and the amount owed."
  action={{ label: "Create Your First Invoice", onClick: () => router.push('/vouchers/sales/new') }}
/>

// Advanced Mode empty state (more technical)
<EmptyState
  icon={FileText}
  title="No sales vouchers"
  description="Posted sales invoices for the selected period will appear here."
  action={{ label: "New Sales Invoice", onClick: () => router.push('/vouchers/sales/new') }}
/>
```

## 3-Step Wizard Structure (UX-02) — Simple Mode only

Step 1 — "Who" (party selection):
- Simple: "Who are you selling to?" with customer dropdown
- "Add new customer" inline option — no redirect
- No accounting jargon anywhere

Step 2 — "What" (line items):
- Simple: "What did you sell?" with product picker
- Quantity, price fields — GST auto-calculated and shown as "Tax"
- Never show CGST/SGST/IGST separately in Simple Mode
- Show: Item name, Qty, Price, Tax (total), Amount

Step 3 — "Review & Save":
- Show: To (customer name), Date, Items summary, Tax total, Grand Total
- "Save Invoice" button → posts the voucher and sends to customer
- Never show individual debit/credit entries
- Never show voucher number (show it AFTER saving as confirmation)

## Sidebar Labels by Mode

```tsx
// Simple Mode sidebar
const SIMPLE_NAV = [
  { label: 'Dashboard', href: '/dashboard' },
  {
    group: 'Transactions',
    items: [
      { label: 'Sell to Customer', href: '/vouchers/sales/new' },
      { label: 'Buy from Supplier', href: '/vouchers/purchase/new' },
      { label: 'Money Received', href: '/vouchers/receipt/new' },
      { label: 'Money Paid', href: '/vouchers/payment/new' },
    ]
  },
  { group: 'Tax Returns', items: [{ label: 'File GST', href: '/gst/gstr1' }] },
  { group: 'Customers & Suppliers', items: [{ label: 'Contacts', href: '/masters/parties' }] },
]

// Advanced Mode sidebar (standard accounting labels — see Sidebar.tsx)
```

## ITC Eligibility in Simple Mode

Simple Mode label: "Can I claim tax credit on this? Yes / No"
Tooltip: "If you say Yes, the tax on this item will reduce your future GST payment"

Advanced Mode: "ITC Eligible" checkbox per line item

## Business Language Alert Pattern

Use `BusinessLanguageAlert` when switching from Simple to Advanced:
```tsx
<BusinessLanguageAlert
  message="You're now in Advanced Mode. You'll see accounting terms like debit, credit, and narration."
  onDismiss={() => setUIMode('advanced')}
/>
```
