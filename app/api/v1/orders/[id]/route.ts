import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { patchOrderSchema } from '@/lib/schemas/orders'
import { OrderService, ValidationError, ForbiddenError } from '@/lib/services/OrderService'

/**
 * GET /api/v1/orders/[id]
 *
 * Returns full order detail including all OrderItems with item and godown names.
 * Security:
 *  - IDOR protection: where clause always includes both id AND companyId (T-04-06-06)
 */
export async function GET(
  (request: NextRequest),
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId
  const { id } = await params

  const order = await prisma.order.findFirst({
    where: { id, companyId },
    include: {
      orderItems: {
        include: {
          item: { select: { id: true, name: true } },
          godown: { select: { id: true, name: true } },
        },
      },
    },
  })

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json({
    ...order,
    totalAmount: order.totalAmount.toString(),
    orderItems: order.orderItems.map((oi) => ({
      ...oi,
      qty: oi.qty.toString(),
      rate: oi.rate.toString(),
      amount: oi.amount.toString(),
      receivedQty: oi.receivedQty.toString(),
      dispatchedQty: oi.dispatchedQty.toString(),
    })),
  })
}

/**
 * PATCH /api/v1/orders/[id]
 *
 * Approve, cancel, or close an order.
 * Security:
 *  - Zod parse of action field before any DB write (T-04-06-02)
 *  - approveOrder throws ForbiddenError (→ 403) for non-Admin/Owner (T-04-06-03)
 *  - Cross-tenant guard inside each OrderService method (T-04-06-06)
 *  - Audit log inside $transaction for every status change (T-04-06-05)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = patchOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const { id } = await params

  try {
    let updated
    switch (parsed.data.action) {
      case 'approve':
        updated = await OrderService.approveOrder(id, session)
        break
      case 'cancel':
        updated = await OrderService.cancelOrder(id, session)
        break
      case 'close':
        updated = await OrderService.closeOrder(id, session)
        break
    }
    return NextResponse.json({ id: updated.id, status: updated.status })
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    throw err
  }
}
