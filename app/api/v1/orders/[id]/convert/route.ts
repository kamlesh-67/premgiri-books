/**
 * POST /api/v1/orders/[id]/convert
 *
 * Converts an approved Purchase Order (PO) or Sales Order (SO) to a voucher
 * (partial or full receive/dispatch).
 *
 * PO → PURCHASE Invoice (creates StockBatch via VoucherEngine FIFO flow)
 * SO → SALES Invoice   (consumes StockBatch via VoucherEngine FIFO flow)
 *
 * Security:
 *  - auth() first — 401 if no session (T-04-07-01)
 *  - Zod parse before any DB access (T-04-07-03)
 *  - companyId always from session inside OrderService (T-04-07-02)
 *  - Over-delivery → 422 ValidationError (T-04-07-03)
 *  - Wrong-status order → 422 ValidationError (T-04-07-05)
 *  - Order not found or wrong company → 422 (no information leakage — T-04-07-02)
 *  - All operations atomic in single $transaction (D-05)
 *
 * Returns: { voucherId, voucherNo, orderStatus }
 */

import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { convertOrderSchema } from '@/lib/schemas/orders'
import { OrderService, ValidationError } from '@/lib/services/OrderService'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // T-04-07-01: Authenticate before any business logic
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // T-04-07-03: Parse and validate request body with Zod before touching the database
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = convertOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const { id } = await params

  try {
    const result = await OrderService.convertOrder(
      id,
      parsed.data,
      session,
    )
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof ValidationError) {
      // 422: over-delivery, wrong order status, item not found, or order not found
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    throw err
  }
}
