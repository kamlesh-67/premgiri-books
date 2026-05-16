# PremGiri Books — Complete AI Design Prompt
### For: Baba Premgiri Paints | GST Accounting & Business Management SaaS

---

## GLOBAL DESIGN IDENTITY

**Business Name:** Baba Premgiri Paints
**App Name:** PremGiri Books
**Tagline:** "Professional Books, Simplified."
**Type:** TallyPrime-style GST accounting SaaS — web-based, desktop-first

### Visual Style
- **Aesthetic:** Clean enterprise SaaS. Think Linear.app meets a professional Indian accounting tool. No gradients, no playful illustrations, no heavy shadows. Everything is precise, trustworthy, data-dense.
- **Primary Color:** `#7C3AED` (purple-600) — used for active nav items, primary buttons, icon accents, links
- **Primary Light:** `#EDE9FE` (purple-50) — used for active nav background, hover states
- **Background:** `#F9FAFB` (gray-50) — page canvas
- **Cards/Panels:** `#FFFFFF` white with `border: 1px solid #E5E7EB` and `box-shadow: 0 1px 3px rgba(0,0,0,0.06)`
- **Text Heading:** `#111827` (gray-900)
- **Text Body:** `#374151` (gray-700)
- **Text Muted:** `#6B7280` (gray-500)
- **Font:** Inter — weights 400, 500, 600, 700
- **Border Radius:** 8px for cards, 6px for inputs/buttons, 999px for badges

### Layout Shell (Applied to ALL pages)
```
┌──────────────────────────────────────────────────────────────────┐
│  TOPBAR (fixed, height 56px, white, bottom border #E5E7EB)       │
│  Left: [🅿 logo 32px] [PremGiri Books bold]                      │
│  Center-left: Breadcrumb — Home / Section / Page                 │
│  Center: Search bar (⌘K) — 420px wide, gray-50 bg, search icon  │
│  Right: [🔔 bell with red dot] [A avatar purple circle]          │
├──────────────┬───────────────────────────────────────────────────┤
│ SIDEBAR      │ CONTENT AREA                                      │
│ 240px fixed  │ margin-left: 240px, padding-top: 56px             │
│ white bg     │ background: gray-50                               │
│ right border │ padding: 24px                                     │
│              │ max-width: 1280px, margin: auto                   │
│ (see nav     │                                                   │
│  below)      │ <PageHeader />                                    │
│              │ <KPI Cards Row />  ← if applicable                │
│              │ <Main Content />                                   │
└──────────────┴───────────────────────────────────────────────────┘
```

### Sidebar Design
```
Width: 240px, fixed left, full height, white background
Right border: 1px solid #E5E7EB
Top padding: 16px

Logo area (56px height, matches topbar):
  [purple square 32px with P icon]  PremGiri Books (font-bold)

Navigation structure:
  Group label: 10px uppercase, letter-spacing 0.08em, gray-400, px-12px, pt-16px pb-4px
  Nav item: flex row, gap-10px, px-12px, py-8px, rounded-6px, text-14px font-medium
    - Active: background #EDE9FE, text #7C3AED, icon #7C3AED
    - Hover: background #F9FAFB, text gray-700
    - Inactive: text gray-600, icon gray-400
    - Keyboard hint (F8 etc): ml-auto, text-10px, gray-400

Bottom section (pinned to bottom):
  Horizontal divider
  User row: [Avatar 28px purple] [Name · Role small] [→ logout icon]
  FY Badge: "FY 2024-25" — small pill, gray-100 bg, gray-600 text
```

### KPI / Stat Card (Reused on all dashboards)
```
Card: white, rounded-8px, border, shadow-sm, padding 20px
Layout: 
  Top row: [title text-sm gray-500] [icon in 36px colored circle, top-right]
  Middle: [value text-2xl font-bold gray-900 tabular-nums]
  Bottom: [delta — green arrow up or red arrow down, text-xs]
Icon circle colors:
  Revenue/Money: bg-purple-100, icon text-purple-600 (IndianRupee icon)
  Documents/Invoice: bg-blue-100, icon text-blue-600 (FileText icon)
  Warning/Stock: bg-amber-100, icon text-amber-600 (AlertTriangle icon)
  Orders/Cart: bg-green-100, icon text-green-600 (ShoppingCart icon)
  Danger/Overdue: bg-red-100, icon text-red-600 (AlertCircle icon)
```

### Status Badge (Reused everywhere)
```
Style: rounded-full, px-10px, py-2px, text-11px font-medium, uppercase or capitalize
POSTED / Paid / Filed / Active / Received:    bg-green-100, text-green-700
DRAFT / Not Filed / Pending:                  bg-gray-100,  text-gray-600
CANCELLED / Overdue / Error / Out-of-Stock:   bg-red-100,   text-red-700
Approved / Processing / Uploaded / Info:      bg-blue-100,  text-blue-700
Due-Soon / Low Stock / Warning / Maintenance: bg-amber-100, text-amber-700
```

### Data Table Pattern (Reused on all list pages)
```
Container: white card, rounded-8px, border, overflow-hidden
Table header (thead): background gray-50, border-bottom
  th: text-11px, uppercase, letter-spacing 0.06em, gray-500, px-16px py-12px, text-left
Table body (tbody):
  tr: border-bottom gray-100, hover background gray-50/50
  td: text-14px gray-700, px-16px py-14px
  tr:last-child: no border-bottom
Actions column (always last): icon buttons — Eye, Download, Pencil, Trash2
  Icon button: 28px × 28px, rounded-4px, gray-400 icon
  Hover: Eye/Download → gray-700, Edit → purple-600 bg-purple-50, Delete → red-600 bg-red-50
```

### Primary Action Button
```
bg-purple-600, hover bg-purple-700, text-white, text-14px font-medium
px-16px py-8px, rounded-6px, flex items-center gap-8px
Icon: Plus 16px white, positioned left of text
```

### Form Field Standard
```
Label: text-14px font-medium gray-700, margin-bottom 6px
Input: full-width, border-gray-200, rounded-6px, px-12px py-8px, text-14px gray-900
  Focus: border-purple-400, ring 2px purple-100, outline none
  Error: border-red-400, ring 2px red-100
  Disabled: bg-gray-50, text-gray-400, cursor not-allowed
  Placeholder: gray-400
Error message: text-12px text-red-600, mt-4px, flex gap-4px with AlertCircle icon
Required indicator: red asterisk (*) after label, text-red-500
Helper text: text-12px gray-500, mt-4px
```

### ID / Number Formats (Configurable in Settings → Number Series)
```
Sales Invoice:      BPG-INV-2025-0001   (prefix: BPG-INV, year: 2025, seq: 4 digits)
Purchase Invoice:   BPG-PUR-2025-0001
Receipt Voucher:    BPG-RCT-2025-0001
Payment Voucher:    BPG-PAY-2025-0001
Journal Entry:      BPG-JRN-2025-0001
Contra Entry:       BPG-CON-2025-0001
Credit Note:        BPG-CN-2025-0001
Debit Note:         BPG-DN-2025-0001
Sales Order:        BPG-SO-2025-0001
Purchase Order:     BPG-PO-2025-0001
Delivery Note:      BPG-DN-2025-0001
Customer ID:        BPG-CUST-0001
Vendor ID:          BPG-VEND-0001
Employee ID:        BPG-EMP-0001
Stock Item Code:    BPG-ITEM-0001
Godown Code:        BPG-GDN-01
All formats editable in: Settings → Number Series page
```

---

## NAVIGATION MENU — COMPLETE STRUCTURE

```
[no section label]
  📊 Dashboard

TRANSACTIONS
  🧾 Sales Invoice          (shortcut: F8)
  🛒 Purchase Invoice       (shortcut: F9)
  💰 Receipt                (shortcut: F6)
  💸 Payment                (shortcut: F5)
  📝 Journal Entry          (shortcut: F7)
  🔄 Contra Entry

GST
  📋 GSTR-1
  📋 GSTR-3B
  🔍 ITC Reconciliation
  🧾 e-Invoice
  🚛 e-Way Bill

MASTERS  [Admin only]
  📒 Ledgers / Accounts
  📦 Stock Items
  👥 Parties (Customers & Vendors)
  👤 Employees
  📐 Units of Measure
  🏭 Godowns / Warehouses
  🎨 Product Categories

INVENTORY
  📊 Stock Summary
  📖 Stock Ledger
  ⏳ Stock Ageing

PAYROLL
  👥 Employees
  💼 Salary Structures
  📅 Attendance
  💰 Pay Run

BANKING
  🏦 Bank Reconciliation
  📄 Cheque Register

REPORTS
  ⚖️ Balance Sheet
  📈 Profit & Loss
  📊 Trial Balance
  📅 Day Book
  ⏰ Outstanding

ADMIN  [Super Admin / Owner only]
  🏢 Company Profile
  👥 User Management
  🛡️ Roles & Permissions
  🔢 Number Series
  ⚙️ System Settings
  📋 Audit Log

```

---

## PAGE 1 — LOGIN PAGE

### Layout
Full-screen centered, white background with very subtle gray-50 pattern (dot grid or light lines), logo centered top.

### Elements

**Logo Block (center-top)**
- Large purple circle 56px with white "P" letter bold
- "PremGiri Books" text-2xl font-bold gray-900 below
- "Baba Premgiri Paints" text-sm gray-500

**Login Card**
- Width: 420px, white, rounded-12px, shadow-md, border, padding 40px
- Title: "Welcome back" text-2xl font-semibold gray-900
- Subtitle: "Sign in to continue to PremGiri Books" text-sm gray-500, margin-bottom 28px

**Form Fields:**

Field 1 — Email
```
label:       "Email address"
type:        email
name:        email
placeholder: "accountant@babapremgiri.com"
validation:  required, valid email format
error msg:   "Please enter a valid email address"
```

Field 2 — Password
```
label:       "Password"
type:        password (with show/hide toggle button inside right)
name:        password
placeholder: "Enter your password"
validation:  required, min 8 characters
error msg:   "Password must be at least 8 characters"
```

**Row below password:**
- Left: Checkbox + "Remember me for 30 days" (text-sm gray-600)
- Right: "Forgot password?" link (text-sm purple-600, hover underline)

**Submit Button:** "Sign In" — full width, purple-600, height 40px, font-semibold

**Error Alert (below button):**
- Shows on wrong credentials: red border, bg-red-50, AlertCircle icon, "Invalid email or password"

**Bottom text:**
- "Don't have an account? Contact your administrator" (text-sm gray-500 center)

---

## PAGE 2 — DASHBOARD

**URL:** `/dashboard`

### Page Header
- Title: "Dashboard" text-2xl font-semibold
- Subtitle: "Baba Premgiri Paints — FY 2024-25" text-sm gray-500
- Right: Date display "Today: 30 April 2025" + "Quick Entry ▾" dropdown button (gray outlined)

### Row 1 — KPI Cards (4 columns)

Card 1: Today's Sales
```
title: "Today's Sales"
value: "₹48,250"
delta: "+12.4% vs yesterday" (green)
icon:  IndianRupee, bg-purple-100, text-purple-600
```

Card 2: Outstanding Receivable
```
title: "Outstanding Receivable"
value: "₹3,42,000"
delta: "12 parties pending" (amber)
icon:  Clock, bg-amber-100, text-amber-600
```

Card 3: GST Payable (Nov)
```
title: "GST Payable This Month"
value: "₹18,450"
delta: "Due: 20th Dec" (neutral gray)
icon:  FileText, bg-blue-100, text-blue-600
```

Card 4: Stock Value
```
title: "Total Stock Value"
value: "₹18,45,000"
delta: "190 items" (neutral)
icon:  Package, bg-green-100, text-green-600
```

### Row 2 — Charts (2/3 + 1/3 split)

**Left — Monthly Sales vs Purchase (Bar Chart)**
- Title: "Sales vs Purchase" with gray-500 subtitle "Last 6 months"
- Bar chart: two bars per month — Sales (purple-500), Purchase (gray-300)
- X-axis: Oct, Nov, Dec, Jan, Feb, Mar
- Y-axis: ₹0 to ₹6,00,000 in lakh format
- Tooltip on hover: show exact ₹ values
- Legend below: ● Sales  ● Purchase

**Right — GST Liability Donut**
- Title: "GST Liability — Nov 2024"
- Donut chart: CGST (purple), SGST (blue-400), IGST (green-400)
- Center text: "₹18,450 Total"
- Legend below with ₹ amounts per type

### Row 3 — Two Tables (1/2 + 1/2)

**Left — Recent Vouchers**
- Title: "Recent Vouchers" + "View all →" link purple-600 right
- Table:
  ```
  columns: Type | Number | Party | Amount | Status
  rows (5): 
    Sales Invoice | BPG-INV-2025-0124 | Sharma Paints | ₹24,500 | POSTED (green)
    Purchase      | BPG-PUR-2025-0089 | Asian Paints  | ₹56,000 | POSTED (green)
    Receipt       | BPG-RCT-2025-0045 | City Car Care | ₹12,000 | POSTED (green)
    Payment       | BPG-PAY-2025-0033 | BASF Coatings | ₹38,200 | POSTED (green)
    Sales Invoice | BPG-INV-2025-0123 | Raju Traders  | ₹8,750  | DRAFT  (gray)
  ```
- Row click → opens voucher detail

**Right — Outstanding Alerts**
- Title: "Overdue Receivables" + "View all →"
- List cards (not table):
  ```
  Each item: Party name (bold) | Amount red | Overdue days badge | "Send Reminder" ghost button
  Row 1: Sharma Paints | ₹45,000 | 45 days overdue (red badge)
  Row 2: City Car Care | ₹18,750 | 32 days overdue (amber badge)
  Row 3: Raju Traders  | ₹12,000 | 61 days overdue (red badge)
  ```

### Row 4 — Quick Actions Bar
```
Buttons row (icon + text, outlined gray, hover purple border+text):
[+ Sales Invoice]  [+ Purchase]  [+ Receipt]  [+ Payment]  [GSTR-1]  [Day Book]
```

---

## PAGE 3 — SALES INVOICE (New / Edit)

**URL:** `/vouchers/sales/new`
**Workflow:**
```
User clicks "+ Sales Invoice" 
→ Form opens (all fields empty, auto-generated number shown)
→ User selects Party (customer) from dropdown
→ System auto-fills: Place of Supply, GSTIN, Credit Terms
→ User adds line items (item, qty, rate → GST auto-calculated)
→ Accounting entries auto-generated in collapsible panel
→ User reviews GST Summary on right panel
→ Click "Save as Draft" OR "Post Invoice" (posts to ledger)
→ If Posted: show success toast with [View PDF] [Print] [Share] actions
→ Redirect to voucher detail page
```

### Page Header
- Title: "Sales Invoice" (or "Edit: BPG-INV-2025-0124")
- Subtitle: "Create a new sales transaction"
- Right: [Save Draft] (gray outlined) [Post Invoice] (purple filled)

### Layout: Two-column (65% form left, 35% summary panel right, sticky)

**LEFT FORM SECTION:**

**Header Section — Gray-50 bg, rounded-8px, p-16px, mb-16px**

Row 1 (3 columns):
```
Field 1 — Party (Customer)
  label:       "Bill To *"
  type:        combobox/searchable dropdown
  name:        partyId
  placeholder: "Search customer name or code..."
  options:     all ledgers of type Sundry Debtors
  on-select:   auto-fill GSTIN, address, credit terms below
  validation:  required
  Below field (auto-filled, read-only, gray text):
    GSTIN: 27ABCDE1234F1Z5
    Credit: 30 days · Limit ₹1,00,000

Field 2 — Invoice Date
  label:       "Invoice Date *"
  type:        date picker (calendar popover)
  name:        invoiceDate
  default:     today's date
  format:      DD/MM/YYYY
  validation:  required, not future date

Field 3 — Place of Supply
  label:       "Place of Supply *"
  type:        select dropdown
  name:        placeOfSupply
  options:     All 37 Indian states/UTs with 2-digit code
  default:     auto-filled from party GSTIN state code
  validation:  required
```

Row 2 (3 columns + auto-chips):
```
Field 4 — Invoice No (auto-generated)
  label:       "Invoice Number"
  type:        text (readonly, shown as purple chip)
  value:       BPG-INV-2025-0125 (auto)
  style:       gray-50 bg, purple text, border-purple-200, rounded-6px

Field 5 — Reference / PO No
  label:       "Ref / PO Number"
  type:        text
  name:        refNo
  placeholder: "Customer PO number (optional)"
  validation:  max 50 chars

Field 6 — GST Type (auto-computed chip)
  label:       "GST Type"
  type:        display chip (non-editable)
  shows:       "Intra-state · CGST + SGST" OR "Inter-state · IGST"
  color:       blue-100 bg, blue-700 text
```

**Line Items Table — Full width**

Table header row: gray-50 background
```
# | Item | Qty | Unit | Rate ₹ | Disc % | Taxable ₹ | HSN | GST% | CGST ₹ | SGST ₹ | IGST ₹ | Total ₹ | ×
```

Each line item row (editable cells):
```
# — row number, gray-400, auto-increment

Item (combobox):
  placeholder: "Search stock item..."
  type: searchable dropdown
  on-select: auto-fill Unit, HSN code, GST rate
  required: yes

Qty (number input):
  type: number
  min: 0.001, step: 0.001 (3 decimal places)
  placeholder: "0.000"
  on-change: recalculate taxable value

Unit (auto-filled, editable):
  type: select
  options: from stock item's default unit
  editable: yes (can override)

Rate ₹ (number input):
  type: number, decimal(12,4)
  placeholder: "0.0000"
  on-change: recalculate

Disc % (number input):
  type: number, 0-100
  placeholder: "0.00"

Taxable ₹ (computed, read-only):
  formula: (Qty × Rate) × (1 - Disc/100)
  color: gray-700, tabular-nums

HSN (auto-filled, editable):
  type: text, 8 chars max
  auto-filled from stock item

GST % (auto-filled, editable):
  type: select: 0, 5, 12, 18, 28
  auto-filled from stock item

CGST / SGST / IGST (computed, read-only):
  formula: Taxable × (GST/2)/100 for intra-state
           or Taxable × GST/100 for inter-state (IGST)

Total ₹ (computed, read-only):
  formula: Taxable + CGST + SGST + IGST

× (delete button):
  red trash icon, removes row
```

**Below table:**
- "+ Add Item" button (text button, purple-600, Plus icon)
- "Add Text Row" button (for descriptions/notes between items)

**Narration Field**
```
label:       "Narration / Notes"
type:        textarea
name:        narration
placeholder: "E.g. Goods sold as per quotation No. BPG-Q-2025-001"
rows:        3
validation:  max 500 chars
```

**Accounting Entries (Collapsible panel, open by default)**
```
Header: "Accounting Entries" + toggle arrow
Background: gray-50, border, rounded-8px, p-12px

Auto-generated entries (read-only by default):
  DR  Sundry Debtors — [Party Name]     ₹28,410
  CR  Sales Account                      ₹24,500
  CR  Output CGST — 9%                   ₹2,205
  CR  Output SGST — 9%                   ₹2,205
  CR  Round Off                          ₹0.50  (if any)

"Edit Entries" button: small, gray outlined — makes entries editable
Warning if entries don't balance: red alert "Entries are unbalanced by ₹X"
```

**RIGHT PANEL — GST Summary (Sticky, 35% width)**

```
Card: white, shadow-sm, border, rounded-8px, p-20px, sticky top-80px

Title: "Invoice Summary" text-base font-semibold

Line items count: "3 items"
─────────────────────────
Subtotal:         ₹24,500.00
Discount:         ₹   500.00
Taxable Value:    ₹24,000.00
─────────────────────────
CGST (9%):        ₹ 2,160.00
SGST (9%):        ₹ 2,160.00
IGST (0%):        ₹     0.00
Round Off:        ₹     0.50
─────────────────────────
GRAND TOTAL:      ₹28,320.50   ← text-2xl font-bold purple-700

Amount in words:
"Rupees Twenty Eight Thousand Three Hundred Twenty and Fifty Paise Only"
text-12px gray-500, italic

─────────────────────────
GST Breakup:
  HSN 3208 · 18% · Taxable ₹12,000 · Tax ₹2,160
  HSN 3210 · 18% · Taxable ₹12,000 · Tax ₹2,160

─────────────────────────
Party Balance:
  Outstanding: ₹45,000  (red if overdue)
  Credit Limit: ₹1,00,000
  Available: ₹55,000

─────────────────────────
[Save as Draft]    full-width gray outlined button
[Post Invoice]     full-width purple filled button
[Cancel]           text link center, red-600
```

---

## PAGE 4 — PURCHASE INVOICE (New)

**URL:** `/vouchers/purchase/new`
**Workflow:**
```
User clicks "+ Purchase Invoice" (or F9)
→ Form opens
→ User selects Vendor from dropdown (Sundry Creditors group)
→ System auto-fills: Vendor GSTIN, state code
→ GST type computed (intra/inter)
→ User fills: Vendor's invoice number + date (their invoice, not ours)
→ Adds line items (same as sales but items go to PURCHASE account, not SALES)
→ ITC (Input Tax Credit) auto-booked: DR Input CGST, DR Input SGST / Input IGST
→ Accounting entries: DR Purchase A/c, DR Input GST → CR Sundry Creditor
→ [Save Draft] or [Post]
→ On Post: stock inward entry created automatically
```

**Differences from Sales Invoice:**
```
Party field label:    "Vendor / Supplier *"
Party type:           Sundry Creditors ledger group
Extra fields:
  - Vendor Invoice No: type=text, name=vendorInvoiceNo, placeholder="Supplier's original invoice no", required
  - Vendor Invoice Date: type=date, name=vendorInvoiceDate, required, must not be future
  - Godown (where stock goes): type=select, options=all godowns, default=Main Godown

Accounting entries auto-generated:
  DR  Purchase Account                  ₹24,000
  DR  Input CGST (9%)                  ₹ 2,160
  DR  Input SGST (9%)                  ₹ 2,160
  CR  Sundry Creditors — [Vendor Name] ₹28,320

ITC Badge shown: "ITC Eligible: ₹4,320" in green-100 panel below summary
```

---

## PAGE 5 — RECEIPT VOUCHER

**URL:** `/vouchers/receipt/new`
**Workflow:**
```
Customer owes money → User clicks "+ Receipt"
→ Select Party (who paid)
→ System shows: Outstanding bills for this party
→ User selects which bill(s) are being settled
→ Select Cash/Bank account (where money received)
→ Enter amount received
→ If part-payment: show amount still outstanding
→ Accounting entry auto: DR Cash/Bank → CR Sundry Debtors
→ [Post] → updates ledger balance, marks bill as partly/fully settled
```

**Form Fields:**
```
Field 1 — Receipt From (Party)
  label:       "Received From *"
  type:        combobox (search Sundry Debtors)
  name:        partyId
  validation:  required
  on-select:   shows outstanding bill list below

Field 2 — Receipt Date
  label:       "Receipt Date *"
  type:        date, default today
  name:        receiptDate
  validation:  required

Field 3 — Account Credited To (Cash/Bank)
  label:       "Into Account *"
  type:        select (filter: Cash-in-Hand or Bank Accounts group)
  name:        accountId
  placeholder: "Select cash or bank account"
  validation:  required

Field 4 — Amount Received
  label:       "Amount Received *"
  type:        number, decimal 2 places
  name:        amount
  placeholder: "0.00"
  prefix:      ₹ symbol inside field left
  validation:  required, min 0.01

Field 5 — Payment Mode
  label:       "Payment Mode"
  type:        select
  options:     Cash | NEFT | RTGS | IMPS | Cheque | UPI | Card
  name:        paymentMode

Field 6 — Reference No (UTR / Cheque No)
  label:       "Reference Number"
  type:        text
  name:        referenceNo
  placeholder: "UTR / Cheque number / UPI reference"
  shows-when:  payment mode is not Cash

Field 7 — Narration
  label:       "Narration"
  type:        textarea, 2 rows
  placeholder: "E.g. Received payment against invoice BPG-INV-2025-0120"
```

**Bill Settlement Table (below main fields):**
```
Shows when party selected — list of outstanding bills:

Columns: Invoice No | Date | Original Amt | Outstanding | Settle Amount (editable) | Full ✓

Row 1: BPG-INV-2025-0120 | 01/03/2025 | ₹45,000 | ₹45,000 | [input: 45000] | [checkbox]
Row 2: BPG-INV-2025-0115 | 15/02/2025 | ₹18,750 | ₹18,750 | [input: 3000]  | [ ]

Total Being Settled: ₹48,000
Difference (on account): ₹0 or ₹X if not matching receipt amount

Footer: 
  Total Received:        ₹48,000
  Settled Against Bills: ₹48,000
  On Account:            ₹0
```

---

## PAGE 6 — PAYMENT VOUCHER

**URL:** `/vouchers/payment/new`
**Workflow:**
```
Same as Receipt but reversed:
→ Select Vendor (Sundry Creditor)
→ Shows outstanding purchase bills for vendor
→ Select which bills being paid
→ Select Bank/Cash account (payment source)
→ Entry: DR Sundry Creditors → CR Bank/Cash
→ Post → marks bills as settled
```
Fields same as Receipt with labels changed (Pay To, From Account, etc.)

---

## PAGE 7 — JOURNAL ENTRY

**URL:** `/vouchers/journal/new`
**Workflow:**
```
For adjustments, provisions, depreciation etc:
→ Open form
→ Add entry rows (ledger + DR or CR + amount)
→ System validates: total DR must = total CR
→ Shows balance indicator at bottom
→ Post
```

**Form:**
```
Journal Date: date picker, required
Journal No: auto BPG-JRN-2025-0001 (read-only chip)
Narration: textarea, required for journal entries

Entries Table:
  # | Ledger Account | Dr/Cr | Amount ₹ | Narration | ×

  Each row:
    Ledger: combobox (search all ledgers), required
    Dr/Cr: toggle button (DR = blue, CR = amber), required
    Amount: number input, decimal 2 places, required
    Row narration: text, optional

  "+ Add Entry" button below

Balance indicator (sticky bottom of table):
  Total DR: ₹XX,XXX  |  Total CR: ₹XX,XXX
  Status: ✅ Balanced  OR  ❌ Unbalanced by ₹XXX (red)
  Cannot post if unbalanced.
```

---

## PAGE 8 — CONTRA ENTRY

**URL:** `/vouchers/contra/new`
**Workflow:**
```
For cash-to-bank or bank-to-cash transfers:
→ Select: From Account (Cash or Bank)
→ Select: To Account (Bank or Cash — must be different type)
→ Enter amount
→ Entry: DR To Account → CR From Account
→ Post
```

Fields: From Account (select, Cash/Bank only), To Account (select, different from From), Amount, Date, Reference No, Narration.

---

## PAGE 9 — VOUCHER LIST (All Vouchers / Ledger View)

**URL:** `/vouchers` and filtered versions

### Page Header
- Title: "Sales Invoices" (or whatever type)
- Subtitle: "FY 2024-25 — April 2024 to March 2025"
- Right: [+ New Invoice] purple button

### KPI Cards (4):
```
Total Invoices: count + "This month: X"
Posted: count + total ₹ value
Draft: count + "Pending action"
Cancelled: count
```

### Filter & Search Bar
```
Row 1: [Search input full-width — placeholder "Search by party name, invoice number..."]
Row 2: [Filter tabs: All | Posted | Draft | Cancelled] [Date range picker] [Party filter dropdown] [Export ↓]
```

### Table
```
Columns: 
  Invoice No (sortable, click → detail page)
  Party Name
  Date (sortable)
  Due Date
  Amount ₹ (right-aligned, tabular-nums)
  GST ₹ (right-aligned)
  Status (badge)
  Actions (Eye · Download PDF · More ▾)

Pagination: 25 per page, prev/next, page selector
Footer: "Showing 1-25 of 124 invoices | Total ₹12,45,670"
```

---

## PAGE 10 — VOUCHER DETAIL PAGE

**URL:** `/vouchers/sales/BPG-INV-2025-0124`

### Header
- Back arrow + breadcrumb
- Voucher number large: "BPG-INV-2025-0124"
- Status badge POSTED (green)
- Right actions: [Edit] (only if DRAFT) [Download PDF] [Print] [Share ▾] [Cancel Voucher] (red)

### Content (2 columns: 70% + 30%)

**Left — Voucher Details:**
```
Party info box:
  Billed To:        Sharma Paints & Hardware
  GSTIN:            27XYZAB1234C1Z5
  Address:          42, MG Road, Pune - 411001

Invoice info grid:
  Invoice No:       BPG-INV-2025-0124
  Invoice Date:     15 March 2025
  Due Date:         14 April 2025
  GST Type:         Intra-state (CGST + SGST)
  Place of Supply:  Maharashtra (27)
  Narration:        Goods sold as per PO-224

Line items table (read-only version):
  # | Item | HSN | Qty | Unit | Rate | Disc | Taxable | CGST | SGST | Total
  
Accounting entries expandable section

Status timeline:
  ○ Created: 15 Mar 2025, 10:30 AM by Arjun Mehta
  ○ Posted:  15 Mar 2025, 10:45 AM by Arjun Mehta
```

**Right — Summary Card (same structure as invoice form summary panel)**

---

## PAGE 11 — GSTR-1

**URL:** `/gst/gstr1`
**Workflow:**
```
Auto-compiled from posted Sales Invoices
→ Select period (month + year)
→ System categorizes invoices: B2B / B2C Large / B2C Small / Exports / Nil
→ Review each tab
→ [Download JSON] to upload on GST portal manually
→ [Mark as Filed] → enter ARN number + filing date
```

### Page Header
- Title: "GSTR-1"
- Subtitle: "Outward Supplies Return"
- Right: Period selector (Month + Year dropdowns) | [Download JSON] [Export Excel] [Mark as Filed]

### Status Bar
```
Period: November 2024
GSTIN: 27ABCDE1234F1Z5
Status Badge: "Not Filed" (amber) → "Exported" (blue) → "Filed" (green)
Filing Due: 11 December 2024 (red if overdue)
```

### KPI Cards (4):
```
B2B Invoices:     24 invoices · ₹4,25,000 taxable
B2C Large (>2.5L): 2 invoices · ₹6,80,000 taxable
B2C Small:        ₹45,000 aggregate
Total Tax Liability: ₹72,450 (CGST+SGST+IGST)
```

### Tabbed Data Section
```
Tab 1 — B2B Invoices
  Columns: GSTIN | Party Name | Invoice No | Date | Taxable ₹ | CGST | SGST | IGST | Total

Tab 2 — B2C Large (>₹2.5L)
  Columns: Invoice No | Date | State | Taxable | IGST | Total

Tab 3 — B2C Small (Aggregate)
  Columns: State | GST Rate | Taxable | CGST | SGST | Total

Tab 4 — Nil / Exempt
  Columns: Type | Description | Amount

Tab 5 — Exports
  Columns: Invoice No | Date | Currency | Invoice Value | IGST Paid

Tab 6 — HSN Summary
  Columns: HSN Code | Description | UQC | Qty | Value | CGST | SGST | IGST
```

### Mark as Filed Dialog
```
Triggered by [Mark as Filed] button
  Dialog title: "Record GSTR-1 Filing"
  Field 1 — ARN Number: text, required, format: AA012345678901X (15 chars)
  Field 2 — Filing Date: date picker, required
  Field 3 — Filing Mode: select — DSC | EVC | OTP | Nil (no tax)
  [Cancel] [Save Filing]
```

---

## PAGE 12 — ITC RECONCILIATION

**URL:** `/gst/itc-reconciliation`
**Workflow:**
```
→ Download GSTR-2B JSON from GST portal (manual, user uploads file here)
→ System matches our purchase entries vs GSTR-2B
→ Shows Matched / Mismatch / Missing in Portal / Missing in Books
→ User reviews and accepts/rejects differences
→ Accepted ITC goes to GSTR-3B
```

### Top Controls
```
Period selector + GSTIN selector
[Upload GSTR-2B JSON] button (opens file picker, accepts .json)
[Run Reconciliation] purple button
```

### Summary Cards (color-coded, 4 across)
```
Matched:            Green card — X invoices · ₹XX,XXX ITC
Amount Mismatch:    Amber card — X invoices · ₹XX,XXX
Missing in Portal:  Red card   — X invoices · ₹XX,XXX (supplier not filed)
Missing in Books:   Blue card  — X invoices · ₹XX,XXX (we didn't record)
```

### Main Table with Filter Tabs
```
Filter tabs: All | Matched | Mismatch | Missing in Portal | Missing in Books | Accepted

Columns:
  Supplier GSTIN | Supplier Name | Their Invoice No | Date | Our IGST | Portal IGST | Diff ₹ | Status | Actions

Row Actions:
  Accept: marks as accepted (gray "Accepted" badge)
  Edit Voucher: opens purchase voucher for correction
  Flag: tags supplier for follow-up (flag icon, amber)
```

---

## PAGE 13 — LEDGERS MASTER (Accounts)

**URL:** `/masters/ledgers`
**Workflow:**
```
This is the Chart of Accounts — TallyPrime's Ledger Master
→ View all ledger accounts organized by account group
→ Create new ledger: Name, Group, Opening Balance, GSTIN (for parties)
→ Edit / Deactivate existing ledgers
→ View ledger statement (all transactions for that ledger)
→ Cannot delete: only deactivate (isActive = false)
```

### Page Header
- Title: "Ledgers / Chart of Accounts"
- Subtitle: "Manage your accounting heads"
- Right: [+ New Ledger] purple button

### KPI Cards (3):
```
Total Ledgers: count (active)
Sundry Debtors: count + total balance ₹
Sundry Creditors: count + total balance ₹
```

### Filter & Search
```
[Search by ledger name or group...]
Filter tabs: All | Assets | Liabilities | Income | Expenses
Filter dropdown: Account Group | Active Status
[Export]
```

### Table
```
Columns:
  Ledger Name (bold, clickable → detail)
  Account Group (gray-500)
  Opening Balance (₹, Dr/Cr indicator)
  Current Balance (₹, Dr/Cr indicator) — computed
  GSTIN (if party ledger)
  Status: Active/Inactive badge
  Actions: View Statement | Edit | Toggle Active

Grouped display option: shows ledgers nested under their account groups
```

### New Ledger Form (slide-over or separate page)

```
Section A — Basic Information

Field 1 — Ledger Name
  label:       "Ledger Name *"
  type:        text
  name:        name
  placeholder: "E.g. Sharma Paints & Hardware"
  validation:  required, min 3 chars, unique per company
  hint:        "This is the account name that appears in all reports"

Field 2 — Account Group
  label:       "Under (Account Group) *"
  type:        hierarchical select (tree dropdown)
  name:        groupId
  placeholder: "Select account group..."
  validation:  required
  options (pre-seeded groups):
    ASSETS:
      Fixed Assets → Plant & Machinery, Furniture, Vehicles
      Current Assets → Cash-in-Hand, Bank Accounts, Sundry Debtors, Stock-in-Hand, Loans & Advances (Asset)
    LIABILITIES:
      Capital Account
      Reserves & Surplus
      Secured Loans, Unsecured Loans
      Current Liabilities → Sundry Creditors, Duties & Taxes, Provisions
    INCOME:
      Sales Accounts, Direct Income, Indirect Income
    EXPENSES:
      Purchase Accounts, Direct Expenses, Indirect Expenses

Field 3 — Opening Balance
  label:       "Opening Balance"
  type:        number, decimal 2 places
  name:        openingBalance
  placeholder: "0.00"
  prefix:      ₹
  default:     0

Field 4 — Dr / Cr Nature
  label:       "Balance Nature *"
  type:        radio button pair
  name:        drCr
  options:     [Dr (Debit)] [Cr (Credit)]
  default:     auto-suggested based on account group nature

─────────────────────────────────────────────
Section B — GST Details (visible only if group is Sundry Debtors or Sundry Creditors)

Field 5 — GSTIN
  label:       "GSTIN"
  type:        text, uppercase forced
  name:        gstin
  placeholder: "27ABCDE1234F1Z5"
  validation:  if filled: must be 15 chars, valid format regex
  right button: [Fetch from Portal] (stub, shows loading)

Field 6 — PAN
  label:       "PAN Number"
  type:        text, uppercase, 10 chars
  name:        pan
  placeholder: "ABCDE1234F"
  validation:  if filled: PAN format regex

Field 7 — Registration Type
  label:       "GST Registration Type"
  type:        select
  name:        gstRegType
  options:     Regular | Composition | Unregistered | Consumer | SEZ

─────────────────────────────────────────────
Section C — Credit Terms (visible only for Sundry Debtors / Creditors)

Field 8 — Credit Limit
  label:       "Credit Limit"
  type:        number, decimal 2
  name:        creditLimit
  placeholder: "0.00"
  prefix:      ₹
  hint:        "Set to 0 for unlimited credit"

Field 9 — Credit Days
  label:       "Credit Period (Days)"
  type:        number
  name:        creditDays
  placeholder: "30"
  hint:        "Number of days after invoice date for payment"

─────────────────────────────────────────────
Section D — Bank Details (visible only if group = Bank Accounts)

Field 10 — Bank Name
  type: text, placeholder: "HDFC Bank"

Field 11 — Account Number
  type: text, placeholder: "12345678901234"

Field 12 — IFSC Code
  type: text, uppercase, placeholder: "HDFC0001234"
  validation: 11 chars, format regex

Field 13 — Branch
  type: text, placeholder: "Jaipur Main Branch"

─────────────────────────────────────────────
Form Footer:
  [Cancel] text link  [Save & New] gray outlined  [Save Ledger] purple filled
  On save: toast "Ledger 'Sharma Paints' created successfully"
```

---

## PAGE 14 — STOCK ITEMS MASTER

**URL:** `/masters/stock-items`
**Workflow:**
```
→ View all stock items (paint products, raw materials, etc.)
→ Create new item: Name, HSN, GST Rate, Unit, Opening Stock
→ Edit / deactivate items
→ Click item → see stock ledger (all movements)
→ Items used in Sales / Purchase vouchers line items
```

### KPI Cards (4):
```
Total Active Items | Low Stock Items | Out of Stock | Total Stock Value
```

### Table
```
Columns: Code | Name | Category/Group | HSN | GST% | Unit | Opening Qty | Current Stock | Status
```

### New Stock Item Form

```
Section A — Item Details

Field 1 — Item Name
  label:       "Item Name *"
  type:        text
  name:        name
  placeholder: "E.g. Asian Paints Apex Ultima 20L White"
  validation:  required, min 3 chars, unique per company

Field 2 — Item Code (auto or manual)
  label:       "Item Code"
  type:        text
  name:        itemCode
  placeholder: "BPG-ITEM-0001 (auto-generated)"
  hint:        "Leave blank for auto-generation"

Field 3 — Stock Group / Category
  label:       "Item Group *"
  type:        hierarchical select
  name:        groupId
  options:     Paints → Exterior | Interior | Primer | Enamel
               Thinners → Thinner 200 | Turpentine
               Accessories → Brushes | Rollers | Tools
               Raw Materials
  validation:  required

Field 4 — Unit of Measure
  label:       "Primary Unit *"
  type:        select
  name:        uomId
  options:     Litres | KGs | Nos | Boxes | Packets | Sets | Dozens | Metres | Pieces | Pairs
  validation:  required

Field 5 — HSN Code
  label:       "HSN Code *"
  type:        text, 4-8 digits
  name:        hsnCode
  placeholder: "32081090"
  validation:  required, 4-8 numeric chars
  hint below:  "Standard GST rate for HSN 32081090: 18%" (auto-lookup hint)

Field 6 — GST Rate
  label:       "GST Rate *"
  type:        segmented control (pill buttons)
  name:        gstRate
  options:     [0%] [5%] [12%] [18%] [28%]
  default:     auto-suggested from HSN
  validation:  required

Field 7 — GST Applicability
  label:       "GST Applicability"
  type:        radio
  name:        gstApplicable
  options:     ● Applicable (default) ○ Nil Rated ○ Exempt ○ Non-GST

─────────────────────────────────────────────
Section B — Opening Stock (as on company start date)

Field 8 — Opening Quantity
  label:       "Opening Quantity"
  type:        number, decimal 3 places
  name:        openingQty
  placeholder: "0.000"
  suffix:      unit label (e.g. "Litres")

Field 9 — Opening Rate (per unit)
  label:       "Opening Rate (per unit)"
  type:        number, decimal 4 places
  name:        openingRate
  placeholder: "0.0000"
  prefix:      ₹

Field 10 — Opening Value (computed, read-only)
  label:       "Opening Stock Value"
  value:       auto = openingQty × openingRate
  color:       purple-700, font-semibold

─────────────────────────────────────────────
Section C — Reorder Settings (collapsible, closed by default)

Field 11 — Reorder Level
  label:       "Reorder Level"
  type:        number, decimal 3
  placeholder: "Minimum stock to trigger alert"

Field 12 — Minimum Order Qty
  type:        number, decimal 3

Field 13 — Maximum Stock
  type:        number, decimal 3

Field 14 — Batch/Lot Tracking
  label:       "Enable Batch Tracking"
  type:        toggle switch
  hint:        "Enable for items with expiry dates or batch numbers"

─────────────────────────────────────────────
Section D — Additional Info

Field 15 — Description
  type:        textarea, 3 rows
  placeholder: "Detailed description of the item..."

Field 16 — Barcode
  type:        text
  placeholder: "EAN/UPC barcode number (optional)"

Field 17 — Image Upload
  type:        file upload dropzone, accepts JPG/PNG/WEBP, max 2MB
  design:      small square dropzone with camera icon
```

---

## PAGE 15 — PARTIES MASTER (Customers & Vendors)

**URL:** `/masters/parties`

### Filter Tabs: All | Customers (Debtors) | Vendors (Creditors)

### Table
```
Columns: Code | Name | Type | Phone | GSTIN | City | Outstanding Balance | Last Transaction | Status
```

### New Party Form

```
Field 1 — Party Name: text, required
Field 2 — Party Type: radio — Customer (Debtor) | Vendor (Creditor) | Both
Field 3 — Code: auto BPG-CUST-0001 or BPG-VEND-0001
Field 4 — Phone: tel, 10 digits
Field 5 — Email: email
Field 6 — GSTIN: text, 15 chars with validation
Field 7 — PAN: text, 10 chars
Field 8 — Registration Type: select (Regular/Composition/Unregistered/Consumer)
Field 9 — Address Line 1: text
Field 10 — Address Line 2: text
Field 11 — City: text
Field 12 — State: select, all Indian states
Field 13 — PIN Code: text, 6 digits
Field 14 — Credit Limit: number, ₹ prefix
Field 15 — Credit Days: number
Field 16 — Bank Name, Account No, IFSC: text fields (for payment)
Field 17 — Notes: textarea
```

---

## PAGE 16 — STOCK SUMMARY

**URL:** `/inventory/stock-summary`
**Workflow:**
```
→ Shows current stock position of all items as on selected date
→ Hierarchical: Group → Items → Qty + Value
→ Click any item → goes to Stock Ledger for that item
→ Export to Excel
```

### Controls
```
As-on Date: date picker (default today)
Godown filter: All Godowns | [specific godown]
Group filter: All Groups | [specific group]
[Export Excel] button
[Show Zero Stock] toggle
```

### Table (expandable hierarchy)
```
Group header row (gray-100 bg, bold):
  Paints — Exterior                               Closing: 450 Litres · ₹2,24,550

  Item rows (indented):
    BPG-ITEM-0001 | Asian Paints Apex 20L | ○ | 120 Litres | ₹850/L | ₹1,02,000 | ✅ OK
    BPG-ITEM-0002 | Berger Bison Interior | ⚠️| 8 Litres   | ₹720/L | ₹5,760    | ⚠️ Low

Item row columns:
  Code | Name | Batch | Inward Qty | Outward Qty | Closing Qty | Avg Rate | Value | Status
  Status: OK (green) | Low (amber) | Critical (red) | Out of Stock (red badge)

Totals row (bottom):
  Grand Total Stock Value: ₹18,45,230
```

---

## PAGE 17 — BALANCE SHEET

**URL:** `/reports/balance-sheet`
**Workflow:**
```
Auto-computed from all posted vouchers + ledger balances
→ Select as-on date
→ System runs recursive calculation on account tree
→ Shows Indian-format two-column balance sheet
→ Expand any group to see individual ledgers
→ Click any ledger → opens its statement
→ If totals don't match: shows red warning
→ Export PDF / Excel
```

### Page Header
- Title: "Balance Sheet"
- Subtitle: "As on 31 March 2025"
- Right: [As on Date picker] [Compare: None/Prev Year ▾] [Export PDF] [Export Excel]

### Balance Sheet Layout (Two Column)

```
┌─────────────────────────────────┬───────────────────────────────┐
│  EQUITY & LIABILITIES           │  ASSETS                       │
├─────────────────────────────────┼───────────────────────────────┤
│  Capital Account         ▼      │  Fixed Assets            ▼    │
│    Opening Capital  ₹2,00,000   │    Plant & Machinery ₹45,000  │
│    + Net Profit     ₹1,23,456   │    Furniture & Fix.  ₹22,000  │
│    - Drawings       ₹ 25,000    │    Vehicles          ₹1,50,000│
│  ─────────────────  ₹2,98,456   │  ─────────────────  ₹2,17,000 │
│                                 │                               │
│  Reserves & Surplus    ▼  ₹0    │  Current Assets          ▼    │
│                                 │    Cash in Hand     ₹  4,250  │
│  Secured Loans         ▼  ₹0    │    HDFC Bank Acc.   ₹ 85,320  │
│                                 │    Sundry Debtors   ₹3,42,000 │
│  Current Liabilities   ▼        │    Stock in Hand    ₹18,45,000│
│    Sundry Creditors ₹2,45,000   │    Loans & Advances ₹  12,000 │
│    Duties & Taxes   ₹  18,450   │  ─────────────────  ₹22,88,570│
│    Provisions       ₹      0    │                               │
│  ─────────────────  ₹2,63,450   │                               │
│                                 │                               │
├─────────────────────────────────┼───────────────────────────────┤
│  TOTAL              ₹5,61,906   │  TOTAL              ₹25,05,570│
│                                 │                               │
│  ⚠️ Out of balance by ₹X        │  (show only if mismatch)      │
└─────────────────────────────────┴───────────────────────────────┘

Each group row has ▼ expand toggle → reveals individual ledger amounts
Click any ledger name → opens ledger statement in new tab or slide-over
```

---

## PAGE 18 — PROFIT & LOSS

**URL:** `/reports/profit-loss`
**Workflow:**
```
→ Select date range (default: current FY start to today)
→ System computes Income vs Expenses from posted vouchers
→ Shows Gross Profit (from trading) + Net Profit (after all expenses)
→ Expandable groups
→ Monthly toggle: shows month-by-month columns
```

### Layout
```
Controls: [From Date] to [To Date] + [Monthly Breakdown toggle] + [Export PDF] [Export Excel]

Two column layout:

LEFT — INCOME                    RIGHT — EXPENSES
─────────────────                ─────────────────
Sales Accounts         ▼         Opening Stock      ₹8,00,000
  Sales of Paints ₹12,40,000     + Purchases      ▼
  Sales of Tools  ₹  45,000        Purchase A/c  ₹8,50,000
  Less: Returns   ₹  12,000      - Closing Stock   ₹18,45,000
= Net Sales       ₹12,73,000     = Cost of Goods   ₹(1,95,000)
                                   [negative = good]
Direct Income    ▼   ₹  8,000
                                 Direct Expenses   ▼ ₹  45,000
────── Gross Profit: ₹8,36,000 ──────────────────────────────
                                 Indirect Expenses ▼
Indirect Income  ▼   ₹  5,000     Rent          ₹  24,000
                                  Electricity   ₹   6,500
                                  Staff Salary  ₹  85,000
                                  Depreciation  ₹  22,000
                                  Misc. Exp     ₹   4,500
                                  Total         ₹1,42,000

──────────────────────────────────────────────────────────────
NET PROFIT: ₹6,99,000                        (or NET LOSS if negative)
──────────────────────────────────────────────────────────────
```

---

## PAGE 19 — DAY BOOK

**URL:** `/reports/daybook`
**Workflow:**
```
Shows all vouchers posted on a specific date — real-time transaction diary
→ Select date (default today)
→ Shows all posted vouchers chronologically
→ Filter by voucher type
→ Click voucher → open detail
→ Daily totals at bottom
```

### Table
```
Columns: Time | Voucher Type | Number | Party/Description | Dr Amount | Cr Amount
Footer: Total Dr ₹XX,XXX | Total Cr ₹XX,XXX (must be equal)
```

---

## PAGE 20 — OUTSTANDING REPORT

**URL:** `/reports/outstanding`

Two tabs: **Receivables** (from customers) | **Payables** (to vendors)

### Ageing Buckets Table
```
Columns: Party Name | Total O/S | 0-30 days | 31-60 days | 61-90 days | 90+ days | Oldest Bill Date

Row expand → Bill-wise details:
  Invoice No | Date | Amount | Due Date | Days Overdue | Payment Status

Footer: Total row for each column
```

---

## ADMIN SECTION — PAGE 21: NUMBER SERIES SETTINGS

**URL:** `/admin/number-series`
**Purpose:** Configure the ID/number format for all vouchers and masters

### Page Header
- Title: "Number Series Configuration"
- Subtitle: "Customize how voucher numbers and codes are generated"
- Warning: "Changes affect new entries only. Existing numbers are not changed."

### Table of all series
```
Columns: Type | Current Prefix | Separator | Year Format | Digits | Last Number | Reset Yearly | Preview | Actions

Rows:
  Sales Invoice   | BPG-INV | - | YYYY  | 4 | 0124 | Yes | BPG-INV-2025-0125 | [Edit]
  Purchase Invoice| BPG-PUR | - | YYYY  | 4 | 0089 | Yes | BPG-PUR-2025-0090 | [Edit]
  Receipt         | BPG-RCT | - | YYYY  | 4 | 0045 | Yes | BPG-RCT-2025-0046 | [Edit]
  Payment         | BPG-PAY | - | YYYY  | 4 | 0033 | Yes | BPG-PAY-2025-0034 | [Edit]
  Journal Entry   | BPG-JRN | - | YYYY  | 4 | 0012 | Yes | BPG-JRN-2025-0013 | [Edit]
  Contra Entry    | BPG-CON | - | YYYY  | 4 | 0005 | Yes | BPG-CON-2025-0006 | [Edit]
  Credit Note     | BPG-CN  | - | YYYY  | 4 | 0008 | Yes | BPG-CN-2025-0009  | [Edit]
  Debit Note      | BPG-DN  | - | YYYY  | 4 | 0003 | Yes | BPG-DN-2025-0004  | [Edit]
  Customer Code   | BPG-CUST| - | none  | 4 | 0024 | No  | BPG-CUST-0025     | [Edit]
  Vendor Code     | BPG-VEND| - | none  | 4 | 0018 | No  | BPG-VEND-0019     | [Edit]
  Employee ID     | BPG-EMP | - | none  | 4 | 0012 | No  | BPG-EMP-0013      | [Edit]
  Stock Item Code | BPG-ITEM| - | none  | 4 | 0089 | No  | BPG-ITEM-0090     | [Edit]
```

### Edit Number Series Dialog
```
Field 1 — Prefix: text input, "BPG-INV"
Field 2 — Separator: text, single char, "-"
Field 3 — Include Year: toggle. If ON → Year Format: [YYYY] or [YY] select
Field 4 — Number Digits: number 3-8, "4" (pads with zeros)
Field 5 — Start From: number, "1"
Field 6 — Reset Every Year: toggle (Yes = restarts from Start From each April 1)
Preview (live): shows "BPG-INV-2025-0001" updating as fields change
[Save Changes] [Cancel]
```

---

## ADMIN SECTION — PAGE 22: USER MANAGEMENT

**URL:** `/admin/users`

### KPI Cards (3): Total Users | Active | Pending Invite

### Table
```
Columns: User | Email | Role | Last Active | Status | Actions (Edit Role · Deactivate)
```

### Invite User Dialog
```
Field 1 — Full Name: text, required
Field 2 — Email: email, required (sends invite link)
Field 3 — Role: select dropdown
  options: Owner | Admin | Accountant | Sales Manager | Viewer
Field 4 — Godown Access: multi-select (which godowns this user can access)
[Send Invite]
```

---

## ADMIN SECTION — PAGE 23: ROLES & PERMISSIONS

**URL:** `/admin/roles`

### Role Cards Row (horizontal)
```
[Accountant] [Sales Manager] [Technician] [Viewer]
Active role: purple border + filled shield icon
Click to switch which role's permissions shown below
```

### Permissions Grid
```
Rows: Dashboard | Sales Invoice | Purchase Invoice | Receipt | Payment | Journal | GST | Masters | Inventory | Payroll | Banking | Reports | Settings | Admin

Columns: View | Create | Edit | Delete | Cancel | Export | Post/Approve

Each cell: Toggle switch (purple ON, gray OFF)
Some combinations auto-lock: e.g. can't have Create without View

Footer: [Reset to Default] [Save Changes]
```

---

## ADMIN SECTION — PAGE 24: COMPANY PROFILE

**URL:** `/admin/company`

Tabs: General | GST Config | Invoice Template | Email & Notifications

**General Tab:**
```
Field 1 — Company Name: text, required
Field 2 — Legal Name (for GST): text
Field 3 — Business Type: select (Proprietorship/Partnership/LLP/Private Ltd/Public Ltd)
Field 4 — PAN: text, 10 chars
Field 5 — Address: textarea
Field 6 — State: select
Field 7 — PIN Code: text, 6 digits
Field 8 — Phone: tel
Field 9 — Email: email
Field 10 — Logo Upload: image dropzone, recommended 200×200px PNG
Field 11 — Financial Year Start: select month (default: April)
Field 12 — Books Start Date: date picker (when company started using PremGiri Books)
```

**GST Config Tab:**
```
Field 1 — Primary GSTIN: text, 15 chars, required
Field 2 — Additional GSTINs: repeater field (add multiple if multi-state)
Field 3 — e-Invoice Enabled: toggle (show if turnover > 5cr)
Field 4 — e-Invoice Threshold (₹): number
Field 5 — e-Way Bill Threshold (₹): number (default 50,000)
Field 6 — Composition Scheme: toggle
```

**Invoice Template Tab:**
```
Field 1 — Invoice Title Text: text, "TAX INVOICE" (can change to "INVOICE", "BILL OF SUPPLY")
Field 2 — Show Company Logo: toggle
Field 3 — Show Signature Line: toggle
Field 4 — Bank Details on Invoice: toggle (shows bank A/c details)
Field 5 — Terms & Conditions: textarea (printed at bottom of invoice)
Field 6 — Footer Text: text (e.g. "Thank you for your business!")
Field 7 — Paper Size: select — A4 | Letter | A5
Field 8 — Color Theme: color picker (accent color for invoice header — defaults to purple)
Preview panel on right: live preview of invoice template
```

---

## ADMIN SECTION — PAGE 25: AUDIT LOG

**URL:** `/admin/audit-log`

### Table (read-only, no actions)
```
Columns: Timestamp | User | Action | Entity | Record ID | Description | IP Address | [View Details]

Rows example:
  30 Apr 2025 10:45 AM | Arjun Mehta | CREATE | Sales Invoice | BPG-INV-2025-0124 | Posted ₹28,320 to Sharma Paints | 192.168.1.5
  30 Apr 2025 10:30 AM | Arjun Mehta | CREATE | Sales Invoice | BPG-INV-2025-0124 | Draft created | 192.168.1.5
  29 Apr 2025 03:15 PM | Priya Singh | UPDATE | Ledger        | BPG-CUST-0012     | Credit limit changed ₹50,000→₹1,00,000 | 192.168.1.8
  29 Apr 2025 11:00 AM | Arjun Mehta | CANCEL | Sales Invoice | BPG-INV-2025-0118 | Cancelled: Customer returned goods | 192.168.1.5

Filter: Date Range | User | Action Type | Entity Type
Export: [Export CSV]
```

---

## COMPLETE WORKFLOW REFERENCE

### Workflow 1: Record a Paint Sale to Customer

```
Step 1 — SALES INVOICE
  Sidebar → Transactions → Sales Invoice (or press F8)
  → Form opens: BPG-INV-2025-XXXX auto-assigned
  → Select Party: "Sharma Paints & Hardware" (type to search)
    System shows: GSTIN, Credit Limit ₹1,00,000, Outstanding ₹45,000
  → Invoice Date: auto today, change if needed
  → Place of Supply: auto from party GSTIN (Maharashtra)
  → GST Type: auto-computed "Intra-state — CGST+SGST"
  → Add line items:
      Item: "Asian Paints Apex Ultima 20L" → auto fills HSN 32081090, GST 18%, Unit Litres
      Qty: 5, Rate: ₹850
      Taxable: ₹4,250 auto
      CGST 9%: ₹382.50, SGST 9%: ₹382.50 auto
  → Narration: "Goods sold as per customer order"
  → Summary panel shows: Taxable ₹4,250 | GST ₹765 | Total ₹5,015
  → Accounting entries auto-shown:
      DR Sharma Paints & Hardware (Sundry Debtors) ₹5,015
      CR Sales Accounts                             ₹4,250
      CR Output CGST                                ₹382.50
      CR Output SGST                                ₹382.50
  → Click [Post Invoice]
  → ✅ Success toast: "BPG-INV-2025-0125 posted successfully" + [Download PDF] [Print] buttons
  → Stock automatically reduced: Asian Paints Apex Ultima: 120L → 115L
  → GST transaction created for GSTR-1

Step 2 — COLLECT PAYMENT (when customer pays)
  Sidebar → Transactions → Receipt (or press F6)
  → Received From: "Sharma Paints & Hardware"
  → System shows outstanding bills:
      BPG-INV-2025-0125 | ₹5,015 | today
      BPG-INV-2025-0120 | ₹45,000 | 15 Mar (overdue 45 days)
  → Into Account: "HDFC Bank Current A/c"
  → Amount: ₹50,015
  → Settle against bills: ✓ BPG-INV-2025-0125 (₹5,015) + ✓ BPG-INV-2025-0120 (₹45,000)
  → Payment Mode: NEFT, Reference: UTR123456789
  → [Post Receipt]
  → ✅ Both invoices marked settled, party outstanding = ₹0

Step 3 — GSTR-1 (month end)
  Sidebar → GST → GSTR-1
  → Select Period: March 2025
  → System auto-classifies: BPG-INV-2025-0125 → B2B (customer has GSTIN)
  → Review B2B tab: Sharma Paints | GSTIN 27XYZAB... | ₹4,250 taxable | ₹765 GST
  → [Download JSON]
  → Upload to GST portal manually
  → [Mark as Filed] → enter ARN → Save
```

### Workflow 2: Purchase Goods from Vendor

```
Step 1 — PURCHASE INVOICE
  F9 → Purchase Invoice form
  → Vendor: "Asian Paints Ltd" (auto-fills GSTIN, state)
  → Their Invoice No: "APL/2025/456" (required — vendor's own invoice number)
  → Their Invoice Date: 28 March 2025
  → Line items: paint stock items, qty, rate
  → System auto-books ITC:
      DR Purchase Accounts                ₹50,000
      DR Input CGST (9%)                  ₹4,500
      DR Input SGST (9%)                  ₹4,500
      CR Asian Paints Ltd (Sundry Cred.)  ₹59,000
  → [Post] → Stock increases in selected godown

Step 2 — PAY VENDOR
  F5 → Payment Voucher
  → Pay To: "Asian Paints Ltd"
  → Outstanding bills shown: APL/2025/456 — ₹59,000
  → From Account: HDFC Bank
  → Settle against bill
  → [Post] → Creditor balance reduces to ₹0

Step 3 — ITC RECONCILIATION (monthly)
  GST → ITC Reconciliation
  → Upload GSTR-2B JSON (downloaded from GST portal)
  → System matches our purchase entry vs portal
  → BPG-PUR-2025-0090 matched with GSTR-2B entry ✅
  → ITC ₹9,000 confirmed eligible
```

### Workflow 3: End of Month GST Filing

```
1. Verify all vouchers are Posted (not Draft)
   Reports → Day Book → check no pending drafts

2. Run GSTR-1
   GST → GSTR-1 → Select period (e.g. March 2025)
   Review all tabs: B2B / B2C / HSN Summary
   Download JSON → Upload to portal → Mark as Filed (enter ARN)

3. Run ITC Reconciliation  
   GST → ITC Reconciliation → Upload GSTR-2B → Run
   Accept all matched entries

4. Run GSTR-3B
   GST → GSTR-3B → Period: March 2025
   System shows: Output Tax (from GSTR-1) − ITC (from purchases) = Net Payable
   Review and edit if needed
   Download JSON → Pay online → Mark as Filed

5. Post Journal for GST payment
   Journal Entry:
     DR Output CGST   ₹X
     DR Output SGST   ₹X  
     CR HDFC Bank     ₹X
   (reduces GST liability to zero after payment)
```

### Workflow 4: Adding New Stock (Opening Stock Entry)

```
For new items: Masters → Stock Items → New Item → Fill opening stock qty + rate
For subsequent additions: Purchase Invoice from vendor

Checking stock:
  Inventory → Stock Summary → see all items current stock
  Click any item → Stock Ledger → see all movements (IN from purchase, OUT from sales)
  Stock Ageing → see how old your stock is (FIFO dates)
```

### Workflow 5: Month-End Closing / Reports

```
1. Day Book: check all today's / month's transactions
2. Trial Balance: verify DR = CR (everything balanced)
3. Balance Sheet: assets = liabilities + capital
4. P&L: see profit this month vs last month
5. Outstanding → Receivables: chase overdue customers
6. Outstanding → Payables: ensure vendors paid on time
7. Bank Reconciliation: match books with bank statement
```

### Workflow 6: New Customer Onboarding

```
Masters → Parties → New Party
→ Type: Customer
→ Fill: Name, Phone, Email, GSTIN (if registered)
→ Set Credit Limit + Credit Days
→ Save → Party gets code BPG-CUST-0025
→ Now available in all Sales Invoice party dropdowns
```

### Workflow 7: Payroll Run

```
1. Setup: Masters → Employees → create employee records
2. Assign: Payroll → Salary Structures → assign structure to employee
3. Mark attendance: Payroll → Attendance → mark present/leave for month
4. Run Payroll: Payroll → Pay Run → select month → [Process Payroll]
   System calculates: Basic + HRA + DA - PF - ESI - PT - TDS = Net Pay
5. Review employee-wise salary sheet
6. Post: creates Journal voucher for salary expense
7. Download: Pay slips PDF for each employee
8. Payment: create Payment vouchers to each employee's bank account
```

---

## DESIGN NOTES FOR AI TOOL

When generating this design, please ensure:

1. **Consistency** — every page uses the exact same sidebar, topbar, typography scale, and color palette described above. There is NO variation between pages.

2. **Data Density** — this is accounting software. Tables should show more rows, smaller text is acceptable (minimum 13px), and compact padding is preferred over generous whitespace in tables.

3. **Purple is the ONLY accent color** — `#7C3AED`. Do not introduce other accent colors (no teal, no orange, no indigo). Use gray scale for everything else, then just purple for the primary action.

4. **Status badges are the only colorful elements** on list pages — green, amber, red, blue as described. Everything else is gray.

5. **Forms are structured in sections** — each section has a section title, gray-50 background, border, rounded-8px padding. Within sections, use a 2 or 3 column grid for fields.

6. **Indian number format** everywhere — ₹1,23,456.00 not ₹123,456.00. Use tabular-nums font variant for all amount columns.

7. **The sidebar is always visible** (no mobile hamburger needed — this is desktop accounting software). Width 240px, fixed.

8. **Every table has**: search input + filter controls above, column headers sortable, row hover state, status badges, action icons, and pagination footer.

9. **Every list page has a "+ New [Thing]" purple button** in the page header top-right.

10. **KPI cards** appear on dashboard and major section landing pages. They follow the exact same template — white card, value large bold, delta small text with arrow, colored icon circle top-right.
