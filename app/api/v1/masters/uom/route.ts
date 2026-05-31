import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { uomSchema } from '@/lib/schemas/masters'
import type { NextRequest } from 'next/server'

export async function GET() {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId

  const uoms = await prisma.unitOfMeasure.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      symbol: true,
      _count: { select: { stockItems: true } },
    },
  })

  return NextResponse.json(
    uoms.map((u) => ({
      id: u.id,
      name: u.name,
      symbol: u.symbol,
      inUse: u._count.stockItems > 0,
    }))
  )
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId

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

  // Check for duplicate symbol within company
  const existing = await prisma.unitOfMeasure.findFirst({
    where: { companyId, symbol },
  })
  if (existing) {
    return NextResponse.json(
      { error: `A unit with symbol "${symbol}" already exists for this company.` },
      { status: 409 }
    )
  }

  const result = await prisma.$transaction(async (tx) => {
    const uom = await tx.unitOfMeasure.create({
      data: { companyId, name, symbol },
    })

    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.userId,
        entity: 'UnitOfMeasure',
        entityId: uom.id,
        action: 'CREATE',
        oldValue: undefined,
        newValue: { name, symbol } as object,
      },
    })

    return uom
  })

  return NextResponse.json(result, { status: 201 })
}
