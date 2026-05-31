import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Decimal from 'decimal.js'

/**
 * GET /api/v1/inventory/stock-ageing?asOf=YYYY-MM-DD
 *
 * Returns stock ageing buckets for unconsumed StockBatch rows grouped by item.
 * Buckets: 0–30, 31–60, 61–90, >90 days (b90plus) held as of `asOf` date.
 *
 * Security:
 *  - auth() first — 401 before any processing (T-04-05-01)
 *  - companyId ALWAYS from session.companyId (T-04-05-02)
 *  - isActive=true and remainingQty > 0 filter prevents phantom rows (T-04-05-03)
 *  - asOf only affects bucket computation server-side; no write operations (T-04-05-04)
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId // NEVER from query params or body

  const { searchParams } = new URL(request.url)
  // asOf defaults to today (Indian context: server date)
  const asOf = searchParams.get('asOf') ?? new Date().toISOString().split('T')[0]
  const asOfDate = new Date(asOf)

  // Fetch all unconsumed StockBatch rows for this company
  const batches = await prisma.stockBatch.findMany({
    where: { companyId, isActive: true, remainingQty: { gt: 0 } },
    include: { item: { select: { id: true, name: true } } },
    orderBy: { purchaseDate: 'asc' },
  })

  // Group batches by itemId, bucketing by days held
  const itemMap = new Map<string, {
    itemId: string
    name: string
    b0_30_qty: Decimal
    b0_30_value: Decimal
    b31_60_qty: Decimal
    b31_60_value: Decimal
    b61_90_qty: Decimal
    b61_90_value: Decimal
    b90plus_qty: Decimal
    b90plus_value: Decimal
  }>()

  for (const batch of batches) {
    const daysHeld = Math.floor(
      (asOfDate.getTime() - batch.purchaseDate.getTime()) / (1000 * 60 * 60 * 24)
    )
    const qty = new Decimal(batch.remainingQty.toString())
    const value = qty.times(new Decimal(batch.costRate.toString()))

    const existing = itemMap.get(batch.itemId) ?? {
      itemId: batch.itemId,
      name: batch.item.name,
      b0_30_qty: new Decimal(0),   b0_30_value: new Decimal(0),
      b31_60_qty: new Decimal(0),  b31_60_value: new Decimal(0),
      b61_90_qty: new Decimal(0),  b61_90_value: new Decimal(0),
      b90plus_qty: new Decimal(0), b90plus_value: new Decimal(0),
    }

    if (daysHeld <= 30) {
      existing.b0_30_qty = existing.b0_30_qty.plus(qty)
      existing.b0_30_value = existing.b0_30_value.plus(value)
    } else if (daysHeld <= 60) {
      existing.b31_60_qty = existing.b31_60_qty.plus(qty)
      existing.b31_60_value = existing.b31_60_value.plus(value)
    } else if (daysHeld <= 90) {
      existing.b61_90_qty = existing.b61_90_qty.plus(qty)
      existing.b61_90_value = existing.b61_90_value.plus(value)
    } else {
      // b90plus — batches held more than 90 days (highlighted amber per D-09)
      existing.b90plus_qty = existing.b90plus_qty.plus(qty)
      existing.b90plus_value = existing.b90plus_value.plus(value)
    }

    itemMap.set(batch.itemId, existing)
  }

  // Assemble response rows — all Decimal fields serialized to strings
  const rows = Array.from(itemMap.values()).map(r => ({
    itemId: r.itemId,
    name: r.name,
    b0_30_qty: r.b0_30_qty.toString(),
    b0_30_value: r.b0_30_value.toString(),
    b31_60_qty: r.b31_60_qty.toString(),
    b31_60_value: r.b31_60_value.toString(),
    b61_90_qty: r.b61_90_qty.toString(),
    b61_90_value: r.b61_90_value.toString(),
    b90plus_qty: r.b90plus_qty.toString(),
    b90plus_value: r.b90plus_value.toString(),
    totalValue: r.b0_30_value
      .plus(r.b31_60_value)
      .plus(r.b61_90_value)
      .plus(r.b90plus_value)
      .toString(),
  }))

  return NextResponse.json({ asOf, rows })
}
