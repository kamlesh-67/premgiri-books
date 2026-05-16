import { z } from 'zod'

// ─── Item schema shared across order creation ────────────────────────────────

export const orderItemSchema = z.object({
  itemId: z.string().cuid(),
  godownId: z.string().cuid().optional(),
  qty: z
    .string()
    .regex(/^\d+(\.\d{1,3})?$/, 'qty must be a decimal string with up to 3 decimal places'),
  rate: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, 'rate must be a decimal string with up to 4 decimal places'),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'amount must be a decimal string with up to 2 decimal places'),
})

// ─── POST /api/v1/orders ─────────────────────────────────────────────────────
// NOTE: companyId is intentionally excluded — it is always sourced from session.user.companyId (T-04-06-02)

export const createOrderSchema = z.object({
  orderType: z.enum(['PURCHASE_ORDER', 'SALES_ORDER']),
  date: z.string().date(),
  partyLedgerId: z.string().cuid().optional(),
  narration: z.string().max(500).optional(),
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
})

// ─── PATCH /api/v1/orders/[id] ───────────────────────────────────────────────

export const patchOrderSchema = z.object({
  action: z.enum(['approve', 'cancel', 'close']),
  narration: z.string().max(500).optional(),
})

// ─── POST /api/v1/orders/[id]/convert ────────────────────────────────────────

export const convertOrderSchema = z.object({
  // Purchase/stock ledger (PO) or Sales ledger (SO) — the trade ledger to debit/credit
  tradeLedgerId: z.string().cuid(),
  items: z
    .array(
      z.object({
        orderItemId: z.string().cuid(),
        qty: z
          .string()
          .regex(/^\d+(\.\d{1,3})?$/, 'qty must be a decimal string with up to 3 decimal places'),
      }),
    )
    .min(1, 'At least one item required for conversion'),
})

// ─── Inferred types ──────────────────────────────────────────────────────────

export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type PatchOrderInput = z.infer<typeof patchOrderSchema>
export type ConvertOrderInput = z.infer<typeof convertOrderSchema>
