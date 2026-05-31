import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { uomSchema } from '@/lib/schemas/masters'
import type { NextRequest } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId
  const { id } = await params

  // Verify ownership (T-01-08-02 — prevents IDOR)
  const existing = await prisma.unitOfMeasure.findFirst({
    where: { id, companyId },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Unit of Measure not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = uomSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const { name, symbol } = parsed.data

  // Check symbol uniqueness (if changed)
  if (symbol !== existing.symbol) {
    const conflict = await prisma.unitOfMeasure.findFirst({
      where: { companyId, symbol, id: { not: id } },
    })
    if (conflict) {
      return NextResponse.json(
        { error: `A unit with symbol "${symbol}" already exists for this company.` },
        { status: 409 }
      )
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.unitOfMeasure.update({
      where: { id, companyId },
      data: { name, symbol },
    })

    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.userId,
        entity: 'UnitOfMeasure',
        entityId: id,
        action: 'UPDATE',
        oldValue: { name: existing.name, symbol: existing.symbol } as object,
        newValue: { name, symbol } as object,
      },
    })

    return updated
  })

  return NextResponse.json(result)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId
  const { id } = await params

  // Verify ownership (T-01-08-02 — prevents IDOR)
  const existing = await prisma.unitOfMeasure.findFirst({
    where: { id, companyId },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Unit of Measure not found' }, { status: 404 })
  }

  // Check if UoM is in use by any stock items (key_links guard)
  const inUse = await prisma.stockItem.count({
    where: { uomId: id, companyId },
  })
  if (inUse > 0) {
    return NextResponse.json(
      { error: `This unit is used by ${inUse} product(s). Remove them first.` },
      { status: 409 }
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.unitOfMeasure.delete({ where: { id, companyId } })

    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.userId,
        entity: 'UnitOfMeasure',
        entityId: id,
        action: 'DELETE',
        oldValue: { name: existing.name, symbol: existing.symbol } as object,
        newValue: undefined,
      },
    })
  })

  return NextResponse.json({ success: true })
}
