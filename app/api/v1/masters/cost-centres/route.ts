import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const costCentreSchema = z.object({
  name: z.string().min(1).max(100),
})

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const costCentres = await prisma.costCentre.findMany({
      where: { companyId: session.companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(costCentres)
  } catch (err) {
    console.error('[cost-centres GET]', err)
    return NextResponse.json({ error: 'Failed to load cost centres' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const companyId = session.companyId
  const body = await request.json()
  const parsed = costCentreSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const costCentre = await tx.costCentre.create({
        data: {
          companyId,
          name: parsed.data.name,
          isActive: true,
        },
      })

      await tx.auditLog.create({
        data: {
          companyId,
          userId: session.userId,
          entity: 'CostCentre',
          entityId: costCentre.id,
          action: 'CREATE',
          oldValue: undefined,
          newValue: { name: costCentre.name } as object,
        },
      })

      return costCentre
    })

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error('[cost-centres POST]', err)
    return NextResponse.json({ error: 'Failed to create cost centre' }, { status: 500 })
  }
}
