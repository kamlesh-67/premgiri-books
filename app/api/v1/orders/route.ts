import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createOrderSchema } from '@/lib/schemas/orders'
import { OrderService, ValidationError } from '@/lib/services/OrderService'
import type { OrderType, OrderStatus } from '@prisma/client'

/**
 * GET /api/v1/orders
 *
 * Returns paginated list of orders for the authenticated company.
 * Security:
 *  - companyId always from session.user.companyId (T-04-06-02)
 *  - type/status filters are additive ON TOP of companyId scope
 *
 * Query params:
 *  - type:   OrderType filter (PURCHASE_ORDER | SALES_ORDER)
 *  - status: OrderStatus filter (DRAFT | APPROVED | PARTIALLY_FULFILLED | CLOSED | CANCELLED)
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // T-04-06-02: companyId always from session — never from query params or body
  const companyId = session.user.companyId
  const { searchParams } = new URL(request.url)

  const typeParam = searchParams.get('type') as OrderType | null
  const statusParam = searchParams.get('status') as OrderStatus | null

  // Build where clause — companyId is mandatory and first
  const where: Record<string, unknown> = { companyId }
  if (typeParam) where.orderType = typeParam
  if (statusParam) where.status = statusParam

  const orders = await prisma.order.findMany({
    where,
    include: {
      _count: { select: { orderItems: true } },
      partyLedger: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
    take: 100,
  })

  // Serialize Decimal fields to strings (not JSON-serializable natively)
  const serialized = orders.map((o) => ({
    ...o,
    totalAmount: o.totalAmount.toString(),
  }))

  return NextResponse.json({ orders: serialized, total: serialized.length })
}

/**
 * POST /api/v1/orders
 *
 * Creates a new Purchase Order or Sales Order.
 * Security:
 *  - auth() first — 401 before body parsing (T-04-06-01)
 *  - companyId sourced only from session (T-04-06-02)
 *  - orderNo generated server-side (T-04-06-04)
 *  - Zod parse before any DB write (T-04-06-02)
 *  - Audit log inside $transaction (T-04-06-05)
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = createOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  try {
    const order = await OrderService.createOrder(parsed.data, session)
    return NextResponse.json(
      {
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
        totalAmount: order.totalAmount.toString(),
      },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    throw err
  }
}
