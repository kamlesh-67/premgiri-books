import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextResponse, NextRequest } from 'next/server'
import { stockItemSchema } from '@/lib/schemas/masters'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const item = await prisma.stockItem.findFirst({
    where: { id, companyId: session.companyId },
    include: { uom: { select: { name: true, symbol: true } } },
  })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    ...item,
    gstRate: item.gstRate.toString(),
    openingRate: item.openingRate.toString(),
    openingQty: item.openingQty.toString(),
    reorderQty: item.reorderQty?.toString() ?? '0',
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId
  const { id } = await params
  const body = await request.json()

  // Verify ownership before any mutation (companyId guard prevents cross-tenant access)
  const existing = await prisma.stockItem.findFirst({ where: { id, companyId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (body.isActive === false) {
    // Soft deactivate (non-negotiable rule 6: never hard-delete financial records)
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.stockItem.update({
        where: { id, companyId },
        data: { isActive: false },
      })
      await tx.auditLog.create({
        data: {
          companyId,
          userId: session.userId,
          entity: 'StockItem',
          entityId: id,
          action: 'UPDATE',
          oldValue: { isActive: true } as object,
          newValue: { isActive: false } as object,
        },
      })
      return item
    })
    return NextResponse.json({
      ...result,
      gstRate: result.gstRate.toString(),
      openingRate: result.openingRate.toString(),
      openingQty: result.openingQty.toString(),
      reorderQty: result.reorderQty?.toString() ?? '0',
    })
  }

  // Full or partial edit
  const parsed = stockItemSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.stockItem.update({
      where: { id, companyId },
      data: {
        ...parsed.data,
        // Recalculate gstApplicable if gstRate changed
        ...(parsed.data.gstRate !== undefined && {
          gstApplicable: parsed.data.gstRate > 0,
        }),
      },
    })
    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.userId,
        entity: 'StockItem',
        entityId: id,
        action: 'UPDATE',
        oldValue: { name: existing.name } as object,
        newValue: parsed.data as object,
      },
    })
    return item
  })

  return NextResponse.json({
    ...result,
    gstRate: result.gstRate.toString(),
    openingRate: result.openingRate.toString(),
    openingQty: result.openingQty.toString(),
    reorderQty: result.reorderQty?.toString() ?? '0',
  })
}
