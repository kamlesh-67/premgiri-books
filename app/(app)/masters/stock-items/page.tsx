import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Decimal } from 'decimal.js'
import { StockItemsClient } from './StockItemsClient'

export default async function StockItemsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const companyId = session.user.companyId
  const uiMode = session.user.uiMode

  const [itemsRaw, inwardRows, outwardRows] = await Promise.all([
    prisma.stockItem.findMany({
      where: { companyId, isActive: true },
      include: { uom: { select: { name: true, symbol: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.voucherItem.groupBy({
      by: ['itemId'],
      where: { voucher: { companyId, voucherType: 'PURCHASE', status: 'POSTED' } },
      _sum: { qty: true },
    }),
    prisma.voucherItem.groupBy({
      by: ['itemId'],
      where: { voucher: { companyId, voucherType: 'SALES', status: 'POSTED' } },
      _sum: { qty: true },
    }),
  ])

  const inwardMap = new Map(inwardRows.map((r) => [r.itemId, r._sum.qty?.toString() ?? '0']))
  const outwardMap = new Map(outwardRows.map((r) => [r.itemId, r._sum.qty?.toString() ?? '0']))

  const initialItems = itemsRaw.map((i) => {
    const opening = new Decimal(i.openingQty.toString())
    const inward = new Decimal(inwardMap.get(i.id) ?? '0')
    const outward = new Decimal(outwardMap.get(i.id) ?? '0')
    const currentQty = Decimal.max(opening.plus(inward).minus(outward), new Decimal(0))

    return {
      id: i.id,
      name: i.name,
      hsnCode: i.hsnCode,
      gstRate: i.gstRate.toString(),
      uomId: i.uomId,
      uomSymbol: i.uom?.symbol ?? '',
      uomName: i.uom?.name ?? '',
      openingRate: i.openingRate.toString(),
      openingQty: i.openingQty.toString(),
      currentQty: currentQty.toString(),
      reorderQty: i.reorderQty?.toString() ?? '0',
      isActive: i.isActive,
    }
  })

  // Fetch UoMs for the form dropdown
  const uoms = await prisma.unitOfMeasure.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, symbol: true },
  })

  return <StockItemsClient initialItems={initialItems} uiMode={uiMode} uoms={uoms} />
}
