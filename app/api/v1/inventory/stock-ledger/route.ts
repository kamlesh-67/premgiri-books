import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getFY, getFYStart } from '@/lib/utils/fy'
import { Decimal } from 'decimal.js'

/**
 * GET /api/v1/inventory/stock-ledger
 *
 * Returns chronological VoucherItem movements with running balance for a stock item.
 *
 * Query params:
 *   itemId  (required) — StockItem id
 *   from    (optional) — ISO date string, defaults to current FY start
 *   to      (optional) — ISO date string, defaults to today
 *
 * Security:
 *   - Auth check FIRST — 401 before any DB access (T-04-04-01)
 *   - companyId from session.companyId — never from query params (T-04-04-03)
 *   - stockItem.findFirst with companyId guard prevents cross-tenant enumeration (T-04-04-02)
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId

  const searchParams = request.nextUrl.searchParams
  const itemId = searchParams.get('itemId')

  if (!itemId) {
    return NextResponse.json({ error: 'itemId is required' }, { status: 400 })
  }

  // Determine date range — default to current FY start and today
  const today = new Date()
  const currentFY = getFY(today)
  const fyStartDate = getFYStart(currentFY)

  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  const fromDate = fromParam ? new Date(fromParam) : fyStartDate
  const toDate = toParam ? new Date(toParam) : today

  // Validate item belongs to this company (T-04-04-02)
  const stockItem = await prisma.stockItem.findFirst({
    where: { id: itemId, companyId },
    include: { uom: { select: { symbol: true } } },
  })

  if (!stockItem) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  // Fetch all posted VoucherItem rows for this item in the date range
  const voucherItems = await prisma.voucherItem.findMany({
    where: {
      itemId,
      voucher: {
        companyId,
        status: 'POSTED',
        date: { gte: fromDate, lte: toDate },
      },
    },
    include: {
      voucher: {
        select: {
          id: true,
          voucherNo: true,
          voucherType: true,
          date: true,
          createdAt: true,
        },
      },
    },
    orderBy: [
      { voucher: { date: 'asc' } },
      { voucher: { createdAt: 'asc' } },
    ],
  })

  // Compute running balance in application code (cumulative qty and value)
  let balanceQty = new Decimal(0)
  let balanceValue = new Decimal(0)

  const movements = voucherItems.map(vi => {
    const isInward = ['PURCHASE', 'DEBIT_NOTE'].includes(vi.voucher.voucherType)
    const qty = new Decimal(vi.qty.toString())
    const rate = new Decimal(vi.rate.toString())

    if (isInward) {
      balanceQty = balanceQty.plus(qty)
      balanceValue = balanceValue.plus(qty.times(rate))
    } else {
      // For outflows, use weighted average cost (avg of remaining stock value)
      // Exact FIFO cost per outflow would require joining StockConsumption rows
      const avgCost = balanceQty.gt(0) ? balanceValue.div(balanceQty) : new Decimal(0)
      balanceQty = balanceQty.minus(qty)
      balanceValue = balanceQty.gt(0)
        ? balanceQty.times(avgCost)
        : new Decimal(0)
    }

    return {
      date: vi.voucher.date.toISOString().split('T')[0],
      voucherId: vi.voucher.id,
      voucherNo: vi.voucher.voucherNo,
      voucherType: vi.voucher.voucherType,
      inwardQty: isInward ? qty.toString() : null,
      outwardQty: !isInward ? qty.toString() : null,
      rate: rate.toString(),
      balanceQty: balanceQty.toString(),
      balanceValue: balanceValue.toString(),
    }
  })

  return NextResponse.json({
    item: {
      id: stockItem.id,
      name: stockItem.name,
      uom: stockItem.uom?.symbol ?? '',
    },
    movements,
  })
}
