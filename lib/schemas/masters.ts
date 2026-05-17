import { z } from 'zod'

// ─── Shared Regexes ──────────────────────────────────────────────────────────
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
const HSN_REGEX = /^(\d{2}|\d{4}|\d{6}|\d{8}|\d{12})$/
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/

// ─── Reusable field schemas ──────────────────────────────────────────────────
const gstinSchema = z
  .string()
  .regex(
    GSTIN_REGEX,
    "This GSTIN doesn't look right — it should be 15 characters like 29ABCDE1234F1Z5"
  )
  .optional()
  .or(z.literal(''))

const panSchema = z
  .string()
  .regex(
    PAN_REGEX,
    "This PAN doesn't look right — it should be 10 characters like ABCDE1234F"
  )
  .optional()
  .or(z.literal(''))

// ─── Full Ledger Schema (Advanced Mode) ─────────────────────────────────────
export const ledgerSchema = z.object({
  name: z.string().trim().min(2, 'This field is required').max(100),
  groupId: z.string().cuid('This field is required'),
  gstin: gstinSchema,
  pan: panSchema,
  openingBalance: z.string().default('0'),
  drCr: z.enum(['DR', 'CR']).default('DR'),
  // Align with Prisma GstRegType enum: REGULAR | COMPOSITION | UNREGISTERED | CONSUMER
  gstRegType: z
    .enum(['REGULAR', 'UNREGISTERED', 'COMPOSITION', 'CONSUMER'])
    .default('UNREGISTERED'),
  creditLimit: z.string().optional().default('0'),
  creditDays: z.coerce
    .number()
    .min(0, 'Payment days must be 0 or more')
    .optional()
    .default(0),
  bankName: z.string().max(100).optional().default(''),
  bankAccount: z.string().max(50).optional().default(''),
  ifsc: z
    .string()
    .regex(IFSC_REGEX, 'IFSC code should be 11 characters like HDFC0001234')
    .optional()
    .or(z.literal('')),
})
export type LedgerInput = z.infer<typeof ledgerSchema>

// ─── Customer Schema (Simple Mode, per D-11) ────────────────────────────────
export const customerSchema = z.object({
  name: z.string().trim().min(2, 'This field is required').max(100),
  gstin: gstinSchema,
  phone: z.string().max(20).optional().default(''),
  email: z
    .string()
    .email('Please enter a valid email address')
    .optional()
    .or(z.literal('')),
  openingBalance: z.string().default('0'),
  creditDays: z.coerce
    .number()
    .min(0, 'Payment days must be 0 or more')
    .default(30),
  billingAddress: z.string().max(500).optional().default(''),
  shippingAddress: z.string().max(500).optional().default(''),
})
export type CustomerInput = z.infer<typeof customerSchema>

// ─── Supplier Schema (Simple Mode, per D-13) ────────────────────────────────
export const supplierSchema = z.object({
  name: z.string().trim().min(2, 'This field is required').max(100),
  gstin: gstinSchema,
  phone: z.string().max(20).optional().default(''),
  email: z
    .string()
    .email('Please enter a valid email address')
    .optional()
    .or(z.literal('')),
  openingBalance: z.string().default('0'),
  bankName: z.string().max(100).optional().default(''),
  bankAccount: z.string().max(50).optional().default(''),
  ifsc: z
    .string()
    .regex(IFSC_REGEX, 'IFSC code should be 11 characters like HDFC0001234')
    .optional()
    .or(z.literal('')),
  billingAddress: z.string().max(500).optional().default(''),
  shippingAddress: z.string().max(500).optional().default(''),
})
export type SupplierInput = z.infer<typeof supplierSchema>

// ─── Stock Item Schema (per D-15) ────────────────────────────────────────────
const VALID_GST_RATES = [0, 5, 12, 18, 28] as const
export const stockItemSchema = z.object({
  name: z.string().trim().min(2, 'This field is required').max(100),
  gstRate: z.coerce
    .number()
    .refine(
      (v) => (VALID_GST_RATES as readonly number[]).includes(v),
      'Select a valid GST rate (0, 5, 12, 18, or 28%)'
    ),
  hsnCode: z
    .string()
    .regex(HSN_REGEX, 'HSN code must be 2, 4, 6, 8, or 12 digits')
    .optional()
    .or(z.literal('')),
  uomId: z.string().cuid('This field is required'),
  openingRate: z.string().default('0'),
  openingQty: z.string().default('0'),
  reorderQty: z.string().default('0'),
})
export type StockItemInput = z.infer<typeof stockItemSchema>

// ─── Unit of Measure Schema ──────────────────────────────────────────────────
export const uomSchema = z.object({
  name: z.string().trim().min(1, 'This field is required').max(50),
  symbol: z.string().trim().min(1, 'This field is required').max(10),
})
export type UomInput = z.infer<typeof uomSchema>

// ─── Godown Schema ───────────────────────────────────────────────────────────
export const godownSchema = z.object({
  name: z.string().trim().min(2, 'This field is required').max(100),
  address: z.string().max(500).optional().default(''),
  isMain: z.boolean().default(false),
})
export type GodownInput = z.infer<typeof godownSchema>

// ─── User Preferences Schema ─────────────────────────────────────────────────
export const userPreferencesSchema = z.object({
  uiMode: z.enum(['simple', 'advanced']),
})
export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>
