import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { stockItemSchema } from '@/lib/schemas/masters'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.user.companyId
  const items = await prisma.stockItem.findMany({
    where: { companyId, isActive: true },
    include: { uom: { select: { name: true, symbol: true } } },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(
    items.map((i) => ({
      ...i,
      gstRate: i.gstRate.toString(),
      openingRate: i.openingRate.toString(),
      openingQty: i.openingQty.toString(),
      reorderQty: i.reorderQty?.toString() ?? '0',
    }))
  )
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.user.companyId
  const body = await request.json()
  const parsed = stockItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  // StockItem requires a stockGroup — get or create a default "General" group
  const defaultGroup = await prisma.stockGroup.upsert({
    where: { companyId_name: { companyId, name: 'General' } },
    update: {},
    create: { companyId, name: 'General' },
  })

  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.stockItem.create({
      data: {
        name: parsed.data.name,
        companyId,
        groupId: defaultGroup.id,
        uomId: parsed.data.uomId,
        hsnCode: parsed.data.hsnCode || '',
        gstRate: parsed.data.gstRate,
        gstApplicable: parsed.data.gstRate > 0,
        openingQty: parsed.data.openingQty,
        openingRate: parsed.data.openingRate,
        reorderQty: parsed.data.reorderQty,
        isActive: true,
      },
    })
    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.user.id,
        entity: 'StockItem',
        entityId: item.id,
        action: 'CREATE',
        oldValue: undefined,
        newValue: parsed.data as object,
      },
    })
    return item
  })

  return NextResponse.json(
    {
      ...result,
      gstRate: result.gstRate.toString(),
      openingRate: result.openingRate.toString(),
      openingQty: result.openingQty.toString(),
      reorderQty: result.reorderQty?.toString() ?? '0',
    },
    { status: 201 }
  )
}
