/**
 * GET    /api/v1/users/[id]  — fetch a single user (requires users.read)
 * PATCH  /api/v1/users/[id]  — update user fields (requires users.admin)
 * DELETE /api/v1/users/[id]  — soft-deactivate a user (requires users.admin)
 *
 * IDOR protection: every query includes companyId from session — returns 404
 * for users belonging to another company rather than 403, leaking nothing.
 */
import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/utils/requirePermission'
import { blockUser } from '@/lib/redis'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

const patchSchema = z.object({
  name: z.string().optional(),
  roleId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET((request: NextRequest), { params }: Params) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const forbidden = requirePermission(session, 'users', 'read')
  if (forbidden) return forbidden

  const companyId = session.companyId
  const { id: userId } = await params

  const user = await prisma.user.findUnique({
    where: { id: userId, companyId },
    include: { role: { select: { id: true, name: true } } },
  })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { passwordHash: _hash, ...rest } = user
  return NextResponse.json({
    ...rest,
    roleName: user.role?.name ?? null,
  })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const forbidden = requirePermission(session, 'users', 'admin')
  if (forbidden) return forbidden

  const companyId = session.companyId
  const { id: userId } = await params

  // IDOR protection: include companyId in lookup
  const existing = await prisma.user.findUnique({
    where: { id: userId, companyId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  // Capture old state for audit log
  const oldValue = {
    name: existing.name,
    roleId: existing.roleId,
    isActive: existing.isActive,
  }

  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.user.update({
      where: { id: userId },
      data: parsed.data,
    })
    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.userId,
        entity: 'User',
        entityId: userId,
        action: 'UPDATE',
        oldValue,
        newValue: parsed.data,
        ipAddress: request.headers.get('x-forwarded-for') ?? null,
      },
    })
    return record
  })

  // ADM-03: block user in Redis after Prisma transaction succeeds
  // Redis is not transactional with Prisma — must run outside the transaction
  if (parsed.data.isActive === false) {
    await blockUser(userId, 60)
  }

  const { passwordHash: _hash, ...rest } = updated
  return NextResponse.json(rest)
}

export async function DELETE((request: NextRequest), { params }: Params) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const forbidden = requirePermission(session, 'users', 'admin')
  if (forbidden) return forbidden

  const companyId = session.companyId
  const { id: userId } = await params

  // Prevent self-deactivation (T-09-02-06)
  if (userId === session.userId) {
    return NextResponse.json(
      { error: 'You cannot deactivate your own account.' },
      { status: 400 }
    )
  }

  // IDOR protection: include companyId in lookup
  const existing = await prisma.user.findUnique({
    where: { id: userId, companyId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { isActive: false },
    })
    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.userId,
        entity: 'User',
        entityId: userId,
        action: 'DELETE',
        oldValue: { isActive: existing.isActive },
        newValue: { isActive: false },
        ipAddress: null,
      },
    })
  })

  // ADM-03: block user in Redis after Prisma transaction succeeds
  await blockUser(userId, 60)

  return NextResponse.json({ success: true })
}
