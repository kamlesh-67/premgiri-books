const fs = require('fs');
const path = require('path');

const BASE = 'D:/My/BPG/design-inspirations-main/.claude/skills';

const uxLayman = `# UX Layman Skill — PremGiri Books

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
| "Transactions" | "Vouchers" |
| "Payment I owe" | "Accounts Payable" |
| "Money owed to me" | "Accounts Receivable" |

## Detecting UI Mode in Components

\`\`\`tsx
// From Zustand store (Phase 1 creates this)
import { useUIStore } from '@/lib/stores/ui.store'

function VoucherForm() {
  const { uiMode } = useUIStore()
  return uiMode === 'simple' ? <SimpleWizard /> : <AdvancedForm />
}

// Conditional label rendering helper
function NavLabel({ simple, advanced }: { simple: string; advanced: string }) {
  const { uiMode } = useUIStore()
  return <span>{uiMode === 'simple' ? simple : advanced}</span>
}

// Usage:
// <NavLabel simple="Sell to Customer" advanced="Sales Invoice" />
\`\`\`

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
"This stock item doesn't have a GST rate — please update it in Products first"
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

\`\`\`ts
// Auto-detect supply type from party's state code
function getSupplyType(company: Company, party: Ledger): 'INTRA_STATE' | 'INTER_STATE' {
  return company.stateCode === party.stateCode ? 'INTRA_STATE' : 'INTER_STATE'
}
// Simple Mode: NEVER show CGST/SGST/IGST split — just show "Tax: ₹X,XXX"
// Advanced Mode: show full breakdown per line item
\`\`\`

## Empty State Pattern (UX-05)

Every list page must have a meaningful empty state:
\`\`\`tsx
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
\`\`\`

## 3-Step Wizard Structure (UX-02) — Simple Mode only

Step 1 — "Who" (party selection):
- Simple: "Who are you selling to?" with customer dropdown
- "Add new customer" inline option — no redirect to separate page
- No accounting jargon anywhere on this step

Step 2 — "What" (line items):
- Simple: "What did you sell?" with product picker
- Quantity, price fields — GST auto-calculated and shown as "Tax"
- Never show CGST/SGST/IGST separately in Simple Mode
- Show columns: Item name, Qty, Price, Tax (total), Amount

Step 3 — "Review & Save":
- Show: To (customer name), Date, Items summary, Tax total, Grand Total
- "Save Invoice" button → posts the voucher
- Never show individual debit/credit entries
- Never show voucher number (show it AFTER saving as confirmation)

## Sidebar Labels by Mode

\`\`\`tsx
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
  {
    group: 'Tax Returns',
    items: [
      { label: 'File Monthly Tax (GSTR-1)', href: '/gst/gstr1' },
      { label: 'Pay GST (GSTR-3B)', href: '/gst/gstr3b' },
    ]
  },
  {
    group: 'Customers & Suppliers',
    items: [
      { label: 'Contacts', href: '/masters/parties' },
      { label: 'Products', href: '/masters/stock-items' },
    ]
  },
  {
    group: 'My Money',
    items: [
      { label: 'Match Bank Statement', href: '/banking/reconciliation' },
    ]
  },
]

// Advanced Mode: full accounting labels (see CLAUDE.md Sidebar Nav Structure)
\`\`\`

## ITC Eligibility in Simple Mode

Simple Mode label: "Can I claim tax credit on this? Yes / No"
Tooltip on hover: "If you say Yes, the tax on this item will reduce your future GST payment"
Advanced Mode: standard "ITC Eligible" checkbox per line item

## Business Language Alert Pattern

Use BusinessLanguageAlert when switching from Simple to Advanced:
\`\`\`tsx
<BusinessLanguageAlert
  message="You're now in Advanced Mode. You'll see accounting terms like debit, credit, and narration."
  onDismiss={() => setUIMode('advanced')}
/>
\`\`\`

## Keyboard Shortcuts (Advanced Mode only)

| Key | Action |
|-----|--------|
| F8 | New Sales Invoice |
| F9 | New Purchase Invoice |
| F6 | New Receipt Voucher |
| F5 | New Payment Voucher |
| F7 | New Journal Entry |
| Ctrl+S | Save current form |
| Esc | Cancel / go back |
| Ctrl+P | Print / download PDF |

Never show keyboard shortcuts in Simple Mode — they confuse non-technical users.

## Mode Toggle (always visible in Topbar)

\`\`\`tsx
// components/shared/SimpleModeToggle.tsx — Phase 1 implements full logic
<SimpleModeToggle />
// Shows: [Simple] [Advanced] toggle pills
// Position: Topbar, right side, before notification bell
// Persist: stored in Zustand (localStorage) + user JWT via updateSession()
\`\`\`
`;

fs.writeFileSync(path.join(BASE, 'ux-layman.md'), uxLayman, 'utf8');
console.log('ux-layman.md written:', fs.statSync(path.join(BASE, 'ux-layman.md')).size, 'bytes');
