import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { godownSchema } from '@/lib/schemas/masters'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId

  // Returns all godowns including inactive (T-01-08-04: always filtered by companyId)
  const godowns = await prisma.godown.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      address: true,
      isMain: true,
      isActive: true,
    },
  })

  return NextResponse.json(godowns)
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

  const parsed = godownSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const { name, address, isMain } = parsed.data

  const result = await prisma.$transaction(async (tx) => {
    // T-01-08-03: If setting isMain, un-set all other main godowns atomically
    if (isMain) {
      await tx.godown.updateMany({
        where: { companyId, isMain: true },
        data: { isMain: false },
      })
    }

    const godown = await tx.godown.create({
      data: {
        companyId,
        name,
        address: address || null,
        isMain,
        isActive: true,
      },
    })

    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.userId,
        entity: 'Godown',
        entityId: godown.id,
        action: 'CREATE',
        oldValue: undefined,
        newValue: { name, address, isMain } as object,
      },
    })

    return godown
  })

  return NextResponse.json(result, { status: 201 })
}
