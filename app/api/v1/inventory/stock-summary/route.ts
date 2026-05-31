import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getFY, getFYStart } from '@/lib/utils/fy'
import { Decimal } from 'decimal.js'

/**
 * GET /api/v1/inventory/stock-summary
 *
 * Returns FIFO-costed stock summary per item, with per-godown sub-rows.
 *
 * Security:
 *  - Auth check first — 401 before any DB access (T-04-03-01)
 *  - companyId always from session.companyId, never from request (T-04-03-02, T-04-03-03)
 *  - $queryRaw uses Prisma parameterised template literal — safe from injection (T-04-03-02)
 *  - groupId filter does not affect companyId scoping (T-04-03-04)
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId

  try {
    const { searchParams } = new URL(request.url)

    // Default from = current FY start, to = today
    const currentFY = getFY()
    const fyStartDate = getFYStart(currentFY)
    const fyStartStr = fyStartDate.toISOString().split('T')[0]
    const todayStr = new Date().toISOString().split('T')[0]

    const fromParam = searchParams.get('from') ?? fyStartStr
    const toParam = searchParams.get('to') ?? todayStr
    const groupId = searchParams.get('groupId') ?? ''

    const fromDate = new Date(fromParam)
    const toDate = new Date(toParam)
    // Set toDate to end of day so inclusive
    toDate.setHours(23, 59, 59, 999)

    // Step A: FIFO value aggregation per item + godown from active stock batches
    // $queryRaw required: Prisma groupBy cannot compute SUM(remainingQty * costRate)
    const fifoRows = await prisma.$queryRaw<Array<{
      item_id: string
      godown_id: string | null
      closing_qty: string
      fifo_value: string
    }>>`
      SELECT
        item_id,
        godown_id,
        SUM(remaining_qty)::text AS closing_qty,
        SUM(remaining_qty * cost_rate)::text AS fifo_value
      FROM stock_batches
      WHERE company_id = ${companyId}
        AND is_active = true
        AND remaining_qty > 0
      GROUP BY item_id, godown_id
    `

    // Step B: Inward (PURCHASE POSTED) quantities in period per item + godown
    const inwardRows = await prisma.voucherItem.groupBy({
      by: ['itemId', 'godownId'],
      where: {
        voucher: {
          companyId,
          voucherType: 'PURCHASE',
          status: 'POSTED',
          date: { gte: fromDate, lte: toDate },
        },
      },
      _sum: { qty: true },
    })

    // Step C: Outward (SALES POSTED) quantities in period per item + godown
    const outwardRows = await prisma.voucherItem.groupBy({
      by: ['itemId', 'godownId'],
      where: {
        voucher: {
          companyId,
          voucherType: 'SALES',
          status: 'POSTED',
          date: { gte: fromDate, lte: toDate },
        },
      },
      _sum: { qty: true },
    })

    // Step D: Stock item metadata + godown names
    const stockItems = await prisma.stockItem.findMany({
      where: {
        companyId,
        isActive: true,
        ...(groupId ? { groupId } : {}),
      },
      include: {
        group: { select: { name: true } },
      },
    })

    const godowns = await prisma.godown.findMany({
      where: { companyId },
      select: { id: true, name: true },
    })

    // Step E: Assemble response
    const godownMap = new Map(godowns.map(g => [g.id, g.name]))

    // Map FIFO rows keyed by "itemId::godownId"
    const fifoMap = new Map<string, { closing_qty: string; fifo_value: string }>()
    for (const row of fifoRows) {
      const key = `${row.item_id}::${row.godown_id ?? 'null'}`
      fifoMap.set(key, { closing_qty: row.closing_qty, fifo_value: row.fifo_value })
    }

    // Maps for inward/outward keyed by "itemId::godownId"
    const inwardMap = new Map<string, Decimal>()
    for (const row of inwardRows) {
      const key = `${row.itemId}::${row.godownId ?? 'null'}`
      inwardMap.set(key, new Decimal(row._sum.qty?.toString() ?? '0'))
    }

    const outwardMap = new Map<string, Decimal>()
    for (const row of outwardRows) {
      const key = `${row.itemId}::${row.godownId ?? 'null'}`
      outwardMap.set(key, new Decimal(row._sum.qty?.toString() ?? '0'))
    }

    let totalFifoValue = new Decimal(0)

    const items = stockItems.map(item => {
      // Collect all godownIds that appear in fifoRows for this item
      const itemFifoRows = fifoRows.filter(r => r.item_id === item.id)
      const itemGodownIds = [...new Set(itemFifoRows.map(r => r.godown_id))]

      // Also include godownIds from inward/outward that have no fifo row yet
      const inwardGodownIds = inwardRows
        .filter(r => r.itemId === item.id)
        .map(r => r.godownId)
      const outwardGodownIds = outwardRows
        .filter(r => r.itemId === item.id)
        .map(r => r.godownId)

      const allGodownIds = [...new Set([
        ...itemGodownIds,
        ...inwardGodownIds,
        ...outwardGodownIds,
      ])]

      // Build per-godown sub-rows
      const godownSubRows = allGodownIds.map(godownId => {
        const fifoKey = `${item.id}::${godownId ?? 'null'}`
        const fifoEntry = fifoMap.get(fifoKey)
        const closingQty = new Decimal(fifoEntry?.closing_qty ?? '0')
        const fifoValue = new Decimal(fifoEntry?.fifo_value ?? '0')
        const inQty = inwardMap.get(fifoKey) ?? new Decimal(0)
        const outQty = outwardMap.get(fifoKey) ?? new Decimal(0)

        return {
          godownId: godownId ?? '',
          godownName: godownId ? (godownMap.get(godownId) ?? 'Unknown') : 'No Godown',
          inwardQty: inQty.toString(),
          outwardQty: outQty.toString(),
          closingQty: closingQty.toString(),
          fifoValue: fifoValue.toString(),
        }
      })

      // Aggregate item-level totals from godown sub-rows
      let itemClosingQty = new Decimal(0)
      let itemFifoValue = new Decimal(0)
      let itemInwardQty = new Decimal(0)
      let itemOutwardQty = new Decimal(0)

      for (const g of godownSubRows) {
        itemClosingQty = itemClosingQty.plus(g.closingQty)
        itemFifoValue = itemFifoValue.plus(g.fifoValue)
        itemInwardQty = itemInwardQty.plus(g.inwardQty)
        itemOutwardQty = itemOutwardQty.plus(g.outwardQty)
      }

      // Also handle fifo rows with no matching godown in allGodownIds (safety)
      // (covered by itemFifoRows filter above)

      totalFifoValue = totalFifoValue.plus(itemFifoValue)

      const openingQty = new Decimal(item.openingQty.toString())
      const closingQty = Decimal.max(openingQty.plus(itemInwardQty).minus(itemOutwardQty), new Decimal(0))

      return {
        itemId: item.id,
        name: item.name,
        category: item.group?.name ?? '',
        openingQty: openingQty.toString(),
        inwardQty: itemInwardQty.toString(),
        outwardQty: itemOutwardQty.toString(),
        closingQty: closingQty.toString(),
        fifoValue: itemFifoValue.toString(),
        godowns: godownSubRows,
      }
    })

    return NextResponse.json({
      items,
      totalFifoValue: totalFifoValue.toString(),
    })
  } catch (err) {
    console.error('[stock-summary] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
