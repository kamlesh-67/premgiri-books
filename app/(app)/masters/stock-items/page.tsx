import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { StockItemsClient } from './StockItemsClient'

export default async function StockItemsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const companyId = session.user.companyId
  const uiMode = session.user.uiMode

  // Fetch initial stock items server-side for fast TTFB
  const itemsRaw = await prisma.stockItem.findMany({
    where: { companyId, isActive: true },
    include: { uom: { select: { name: true, symbol: true } } },
    orderBy: { name: 'asc' },
  })

  const initialItems = itemsRaw.map((i) => ({
    id: i.id,
    name: i.name,
    hsnCode: i.hsnCode,
    gstRate: i.gstRate.toString(),
    uomId: i.uomId,
    uomSymbol: i.uom?.symbol ?? '',
    uomName: i.uom?.name ?? '',
    openingRate: i.openingRate.toString(),
    openingQty: i.openingQty.toString(),
    reorderQty: i.reorderQty?.toString() ?? '0',
    isActive: i.isActive,
  }))

  // Fetch UoMs for the form dropdown
  const uoms = await prisma.unitOfMeasure.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, symbol: true },
  })

  return <StockItemsClient initialItems={initialItems} uiMode={uiMode} uoms={uoms} />
}
