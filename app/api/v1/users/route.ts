/**
 * GET  /api/v1/users  — list users for the current company
 * POST /api/v1/users  — create a new user (requires users.admin permission)
 *
 * Supports ?role=roleId and ?status=active|inactive query params.
 */
import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/utils/requirePermission'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  roleId: z.string().optional(),
  password: z.string().min(8),
})

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const forbidden = requirePermission(session, 'users', 'read')
  if (forbidden) return forbidden

  const companyId = session.companyId
  const { searchParams } = new URL(request.url)
  const roleFilter = searchParams.get('role')
  const statusFilter = searchParams.get('status')

  const where: Record<string, unknown> = { companyId }
  if (roleFilter) where.roleId = roleFilter
  if (statusFilter === 'active') where.isActive = true
  if (statusFilter === 'inactive') where.isActive = false

  const users = await prisma.user.findMany({
    where,
    include: { role: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const result = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    roleId: u.roleId,
    roleName: u.role?.name ?? null,
    isActive: u.isActive,
    uiMode: u.uiMode,
    lastLogin: u.lastLogin,
    createdAt: u.createdAt,
  }))

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const forbidden = requirePermission(session, 'users', 'admin')
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

  const { name, email, roleId, password } = parsed.data

  // Check for duplicate email within this company (IDOR-safe: companyId from session)
  const existing = await prisma.user.findUnique({
    where: { companyId_email: { companyId, email } },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'This email is already registered — try a different one.' },
      { status: 409 }
    )
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const user = await prisma.$transaction(async (tx) => {
    const record = await tx.user.create({
      data: {
        companyId,
        name,
        email,
        passwordHash,
        roleId: roleId ?? null,
      },
    })
    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.userId,
        entity: 'User',
        entityId: record.id,
        action: 'CREATE',
        newValue: { name, email, roleId: roleId ?? null } as object,
        ipAddress: request.headers.get('x-forwarded-for') ?? null,
      },
    })
    return record
  })

  // Omit passwordHash from response
  const { passwordHash: _hash, ...userWithoutHash } = user
  return NextResponse.json(userWithoutHash, { status: 201 })
}
