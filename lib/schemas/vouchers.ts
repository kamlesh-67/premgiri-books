import { z } from 'zod'
import { Decimal } from 'decimal.js'

// ─── Shared Sub-schemas ───────────────────────────────────────────────────────

// Voucher date: YYYY-MM-DD string (validated before DB write)
const voucherDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Please enter a valid date (YYYY-MM-DD)')

// Decimal string refine helpers
const positiveDecimalString = (msg: string) =>
  z.string().refine(
    (v) => {
      try {
        return new Decimal(v).gt(0)
      } catch {
        return false
      }
    },
    msg
  )

const nonNegativeDecimalString = (msg: string) =>
  z.string().refine(
    (v) => {
      try {
        return new Decimal(v).gte(0)
      } catch {
        return false
      }
    },
    msg
  )

// Helper: string field with a required_error so missing fields show our message, not Zod's default
const requiredString = (msg: string) =>
  z.string({ required_error: msg, invalid_type_error: msg })

// Line item for invoices with stock items (Sales, Purchase, Credit Note, Debit Note)
// NOTE: companyId is NOT here — it is always injected from session.user.companyId
const lineItemSchema = z.object({
  itemId: requiredString('Please select a product').cuid('Please select a product'),
  godownId: z.union([z.string().cuid(), z.literal('')]).optional().transform(v => v === '' ? undefined : v),
  qty: positiveDecimalString('Quantity must be more than 0'),
  // CR-002: Unit of measurement per line (LTR, KG, TIN, PCS, etc.)
  unit: z.string().max(15).optional().default(''),
  rate: nonNegativeDecimalString('Price cannot be negative'),
  // CR-003: Discount type per line — NONE / PERCENT / FLAT_INR
  discountType: z.enum(['NONE', 'PERCENT', 'FLAT_INR']).default('PERCENT'),
  discountPct: z.string().optional().default('0'),
  discountAmt: z.string().optional().default('0'), // used when discountType === 'FLAT_INR'
  hsnCode: z.string().max(12).optional(),
  // VOUCH-02: ITC eligibility is tracked per line item for purchase invoices
  itcEligible: z.boolean().default(true),
  // Advanced Mode only — override GST rate per line (D-18)
  gstRateOverride: z.number().optional(),
  // CR-010: Pack size and volume
  packSize: z.string().optional().default(''),
  packUnit: z.string().max(10).optional().default(''),
  // CR-011: DPL / list price reference (display only, no calc effect)
  listPrice: z.string().optional().default(''),
  // CR-012: Batch number and material / supplier code
  batchNo: z.string().max(50).optional(),
  materialCode: z.string().max(50).optional(),
})

// Manual entry for Journal/Contra (ledger + amount + DR/CR direction)
const manualEntrySchema = z.object({
  ledgerId: requiredString('Please select a ledger account').cuid('Please select a ledger account'),
  amount: positiveDecimalString('Amount must be greater than 0'),
  drCr: z.enum(['DR', 'CR'], {
    errorMap: () => ({ message: 'Please specify Debit or Credit' }),
  }),
  narration: z.string().max(500).optional(),
})

// Settlement entry for Receipt/Payment bill-wise settlement (D-08, D-09, D-10)
// billRefId points to a BillRef record — server always verifies { id, companyId } ownership
const settlementSchema = z.object({
  billRefId: requiredString('Invalid bill reference').cuid('Invalid bill reference'),
  amount: positiveDecimalString('Settlement amount must be greater than 0'),
})

// Payment modes for Receipt/Payment vouchers
const paymentModeSchema = z.enum(['CASH', 'BANK', 'CHEQUE', 'UPI', 'NEFT', 'RTGS']).default('BANK')

// ─── Sales Invoice Schema (VOUCH-01) ─────────────────────────────────────────
// DR: Party Ledger (AR) | CR: Sales Income + GST Payable
// companyId: NEVER in schema — always from session.user.companyId (T-02-06)
export const salesInvoiceSchema = z.object({
  voucherType: z.literal('SALES'),
  partyLedgerId: requiredString('Please select a customer').cuid('Please select a customer'),
  date: voucherDateSchema,
  narration: z.string().max(500).optional(),
  items: z.array(lineItemSchema).min(1, 'Add at least one item'),
  // costCentreId: optional — visible in Advanced Mode only (ROADMAP SC #2)
  costCentreId: z.string().cuid().optional(),
  // status: client may submit DRAFT or POSTED only; CANCELLED is a separate cancel action (T-02-08)
  status: z.enum(['DRAFT', 'POSTED']).default('POSTED'),
})

// ─── Purchase Invoice Schema ──────────────────────────────────────────────────
// DR: Purchase Account + GST Input | CR: Party Ledger (AP)
// itcEligible per line item (VOUCH-02) — determines ITC claim in GSTR-3B
export const purchaseInvoiceSchema = z.object({
  voucherType: z.literal('PURCHASE'),
  partyLedgerId: requiredString('Please select a supplier').cuid('Please select a supplier'),
  date: voucherDateSchema,

  // CR-001: Invoice type (Tax Invoice is default for most suppliers)
  invoiceType: z.enum(['TAX_INVOICE', 'CREDIT_MEMO', 'DEBIT_NOTE', 'BILL_OF_SUPPLY', 'RCM_INVOICE']).default('TAX_INVOICE'),

  // CR-017: Place of supply — 2-digit GST state code; defaults to party state
  placeOfSupply: z.string().max(3).optional(),
  // CR-013: Tax mode override — AUTO uses state codes; IGST_OVERRIDE / CGST_SGST_OVERRIDE force the direction
  taxMode: z.enum(['AUTO', 'IGST_OVERRIDE', 'CGST_SGST_OVERRIDE']).default('AUTO'),

  supplierInvoiceNo: z.string().max(50).optional(),
  supplierInvoiceDate: z.string().optional(),
  narration: z.string().max(500).optional(),

  // CR-009: Payment terms and due date
  paymentTerms: z.enum(['IMMEDIATE', 'NET_7', 'NET_15', 'NET_30', 'NET_45', 'NET_60']).optional(),
  dueDate: z.string().optional(),

  // CR-004: Header-level cascading discounts (up to 5 rows)
  headerDiscounts: z.array(z.object({
    label: z.string().max(50).default('Discount'),
    type: z.enum(['PERCENT', 'FLAT_INR']).default('PERCENT'),
    value: z.string().default('0'),
  })).max(5).default([]),

  // CR-014: Freight charges (separate from goods; GST at freightGstRate)
  freightAmount: z.string().optional().default('0'),
  freightGstRate: z.number().default(18),

  // CR-015: TCS (Tax Collected at Source) — rate applied on (taxable + GST + freight)
  tcsRate: z.string().optional().default('0'),

  // CR-016: Round off — AUTO rounds to nearest rupee; MANUAL lets user enter exact value
  roundOffMode: z.enum(['AUTO', 'MANUAL']).default('AUTO'),
  roundOffManual: z.string().optional().default('0'),

  // CR-006: Transport / dispatch details
  transporterName: z.string().max(100).optional(),
  lrNo: z.string().max(50).optional(),
  vehicleNo: z.string().max(20).optional(),
  destination: z.string().max(100).optional(),
  dispatchWeight: z.string().optional(),

  // CR-007: e-Invoice fields (IRN + ACK already partial in DB; ackNo/ackDate are new)
  ackNo: z.string().max(20).optional(),
  ackDate: z.string().optional(),

  // CR-008: Order reference fields
  buyerPoNo: z.string().max(50).optional(),
  buyerPoDate: z.string().optional(),
  supplierSoNo: z.string().max(50).optional(),
  dispatchDocNo: z.string().max(50).optional(),
  deliveryNoteNo: z.string().max(50).optional(),

  // CR-018: Supplier running balance (reference display only)
  previousBalance: z.string().optional(),
  currentBalance: z.string().optional(),

  // CR-020: Package / dispatch summary
  packageCartons: z.number().optional(),
  packageDrums: z.number().optional(),
  packageBags: z.number().optional(),
  packageTins: z.number().optional(),
  packageWeight: z.string().optional(),
  packageVolume: z.string().optional(),

  // lineItemSchema includes itcEligible: z.boolean().default(true) per item
  items: z.array(lineItemSchema).min(1, 'Add at least one item'),
  status: z.enum(['DRAFT', 'POSTED']).default('POSTED'),
})

// ─── Receipt Schema ───────────────────────────────────────────────────────────
// DR: Bank/Cash | CR: Party Ledger (clears AR)
// settlements: bill-wise application of receipt amount (D-08, D-09, D-10)
// billRefId ownership verified server-side with { id, companyId } check (T-02-09)
export const receiptSchema = z.object({
  voucherType: z.literal('RECEIPT'),
  partyLedgerId: requiredString('Please select a customer').cuid('Please select a customer'),
  bankLedgerId: requiredString('Please select a bank or cash account').cuid('Please select a bank or cash account'),
  date: voucherDateSchema,
  amount: positiveDecimalString('Amount must be greater than 0'),
  narration: z.string().max(500).optional(),
  paymentMode: paymentModeSchema,
  reference: z.string().max(100).optional(),
  settlements: z.array(settlementSchema).default([]),
})

// ─── Payment Schema ───────────────────────────────────────────────────────────
// DR: Party Ledger (clears AP) | CR: Bank/Cash
// With optional TDS deduction (D-05): DR Party | CR Bank (net) + CR TDS Payable
export const paymentSchema = z.object({
  voucherType: z.literal('PAYMENT'),
  partyLedgerId: requiredString('Please select a supplier').cuid('Please select a supplier'),
  bankLedgerId: requiredString('Please select a bank or cash account').cuid('Please select a bank or cash account'),
  date: voucherDateSchema,
  amount: positiveDecimalString('Amount must be greater than 0'),
  narration: z.string().max(500).optional(),
  paymentMode: paymentModeSchema,
  reference: z.string().max(100).optional(),
  settlements: z.array(settlementSchema).default([]),
  // TDS deduction fields (Phase 3, D-05) — optional; undefined means no TDS on this payment
  tdsSection: z.enum(['194C', '194J']).optional(),
  tdsRate: z.string().optional(),    // e.g. '2' or '10' — decimal string
  tdsAmount: z.string().optional(),  // computed: grossAmount × tdsRate / 100
})

// ─── Journal Schema ───────────────────────────────────────────────────────────
// Free-form double-entry: any ledger to any ledger
// entries minimum 2 lines enforces double-entry by structure
export const journalSchema = z.object({
  voucherType: z.literal('JOURNAL'),
  date: voucherDateSchema,
  narration: z.string().max(500).optional(),
  entries: z
    .array(manualEntrySchema)
    .min(2, 'A journal entry needs at least two lines'),
})

// ─── Contra Schema ────────────────────────────────────────────────────────────
// Bank-to-bank or bank-to-cash transfer
// DR: Destination (toLedgerId) | CR: Source (fromLedgerId)
export const contraSchema = z.object({
  voucherType: z.literal('CONTRA'),
  date: voucherDateSchema,
  narration: z.string().max(500).optional(),
  fromLedgerId: requiredString('Please select the source account').cuid('Please select the source account'),
  toLedgerId: requiredString('Please select the destination account').cuid('Please select the destination account'),
  amount: positiveDecimalString('Amount must be greater than 0'),
})

// ─── Credit Note Schema ───────────────────────────────────────────────────────
// Sales return: DR Sales Income + GST Payable | CR Party Ledger (reduces AR)
// linkedVoucherId: optional link to original Sales Invoice (orphaned notes allowed but discouraged)
export const creditNoteSchema = z.object({
  voucherType: z.literal('CREDIT_NOTE'),
  partyLedgerId: requiredString('Please select a customer').cuid('Please select a customer'),
  date: voucherDateSchema,
  narration: z.string().max(500).optional(),
  items: z.array(lineItemSchema).min(1, 'Add at least one item'),
  linkedVoucherId: z.string().cuid('Original invoice reference is required').optional(),
  status: z.enum(['DRAFT', 'POSTED']).default('POSTED'),
})

// ─── Debit Note Schema ────────────────────────────────────────────────────────
// Purchase return: DR Party Ledger (reduces AP) | CR Purchase Account + GST Input
// linkedVoucherId: optional link to original Purchase Invoice
export const debitNoteSchema = z.object({
  voucherType: z.literal('DEBIT_NOTE'),
  partyLedgerId: requiredString('Please select a supplier').cuid('Please select a supplier'),
  date: voucherDateSchema,
  narration: z.string().max(500).optional(),
  items: z.array(lineItemSchema).min(1, 'Add at least one item'),
  linkedVoucherId: z.string().cuid('Original purchase bill reference is required').optional(),
  status: z.enum(['DRAFT', 'POSTED']).default('POSTED'),
})

// ─── Discriminated Union ──────────────────────────────────────────────────────
// Used at the POST /api/v1/vouchers endpoint for request body validation.
// Discriminated by voucherType — Zod selects the correct schema automatically.
// SECURITY: companyId is absent from ALL schemas by design (T-02-06).
//           The API route always injects companyId from session.user.companyId.
export const createVoucherSchema = z.discriminatedUnion('voucherType', [
  salesInvoiceSchema,
  purchaseInvoiceSchema,
  receiptSchema,
  paymentSchema,
  journalSchema,
  contraSchema,
  creditNoteSchema,
  debitNoteSchema,
])

// ─── TypeScript Inferred Types ────────────────────────────────────────────────
export type SalesInvoiceInput = z.infer<typeof salesInvoiceSchema>
export type PurchaseInvoiceInput = z.infer<typeof purchaseInvoiceSchema>
export type ReceiptInput = z.infer<typeof receiptSchema>
export type PaymentInput = z.infer<typeof paymentSchema>
export type JournalInput = z.infer<typeof journalSchema>
export type ContraInput = z.infer<typeof contraSchema>
export type CreditNoteInput = z.infer<typeof creditNoteSchema>
export type DebitNoteInput = z.infer<typeof debitNoteSchema>
export type CreateVoucherInput = z.infer<typeof createVoucherSchema>
