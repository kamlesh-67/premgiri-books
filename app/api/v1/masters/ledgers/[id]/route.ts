import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { ledgerSchema } from '@/lib/schemas/masters'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const ledger = await prisma.ledger.findFirst({
    where: { id, companyId: session.user.companyId },
    include: { group: { select: { name: true, nature: true } } },
  })
  if (!ledger) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    ...ledger,
    openingBalance: ledger.openingBalance.toString(),
    creditLimit: ledger.creditLimit?.toString() ?? null,
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.user.companyId
  const { id } = await params
  const body = await request.json()

  // Verify ownership before any mutation (T-06-02: cross-tenant access prevention)
  const existing = await prisma.ledger.findFirst({ where: { id, companyId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (body.isActive === false) {
    // Soft deactivate (non-negotiable rule 6: never hard-delete financial records)
    const result = await prisma.$transaction(async (tx) => {
      const ledger = await tx.ledger.update({
        where: { id, companyId },
        data: { isActive: false },
      })
      await tx.auditLog.create({
        data: {
          companyId,
          userId: session.user.id,
          entity: 'Ledger',
          entityId: id,
          action: 'UPDATE',
          oldValue: { isActive: true } as object,
          newValue: { isActive: false } as object,
        },
      })
      return ledger
    })
    return NextResponse.json({
      ...result,
      openingBalance: result.openingBalance.toString(),
      creditLimit: result.creditLimit?.toString() ?? null,
    })
  }

  // Full or partial edit
  const parsed = ledgerSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const result = await prisma.$transaction(async (tx) => {
    const ledger = await tx.ledger.update({
      where: { id },
      data: parsed.data,
    })
    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.user.id,
        entity: 'Ledger',
        entityId: id,
        action: 'UPDATE',
        oldValue: { name: existing.name } as object,
        newValue: parsed.data as object,
      },
    })
    return ledger
  })

  return NextResponse.json({
    ...result,
    openingBalance: result.openingBalance.toString(),
    creditLimit: result.creditLimit?.toString() ?? null,
  })
}
