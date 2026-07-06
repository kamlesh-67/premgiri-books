/**
 * GET  /api/v1/roles  — list roles for the current company (requires settings.read)
 * POST /api/v1/roles  — create a new role (requires settings.admin)
 */
import { getSessionFromRequest } from '@/lib/session'
import { prisma, type TransactionClient } from '@/lib/prisma'
import { requirePermission } from '@/lib/utils/requirePermission'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(50),
  permissions: z.record(z.array(z.string())),
})

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const forbidden = requirePermission(session, 'settings', 'read')
  if (forbidden) return forbidden

  const companyId = session.companyId

  const roles = await prisma.role.findMany({
    where: { companyId },
    include: { _count: { select: { users: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const result = roles.map((r) => ({
    id: r.id,
    name: r.name,
    permissions: r.permissions,
    userCount: r._count.users,
    createdAt: r.createdAt,
  }))

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const forbidden = requirePermission(session, 'settings', 'admin')
  if (forbidden) return forbidden

  const companyId = session.companyId
  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { name, permissions } = parsed.data

  // Check for duplicate role name within this company
  const existing = await prisma.role.findUnique({
    where: { companyId_name: { companyId, name } },
  })
  if (existing) {
    return NextResponse.json(
      { error: `A role named "${name}" already exists.` },
      { status: 409 }
    )
  }

  const role = await prisma.$transaction(async (tx: TransactionClient) => {
    const record = await tx.role.create({
      data: { companyId, name, permissions },
    })
    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.userId,
        entity: 'Role',
        entityId: record.id,
        action: 'CREATE',
        newValue: { name, permissions } as object,
        ipAddress: request.headers.get('x-forwarded-for') ?? null,
      },
    })
    return record
  })

  return NextResponse.json(role, { status: 201 })
}
