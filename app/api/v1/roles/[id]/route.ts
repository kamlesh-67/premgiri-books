/**
 * GET    /api/v1/roles/[id]  — fetch role detail with user count (requires settings.read)
 * PATCH  /api/v1/roles/[id]  — update role name or permissions (requires settings.admin)
 * DELETE /api/v1/roles/[id]  — delete role; blocks if last Admin role (requires settings.admin)
 *
 * Last-Admin guard (T-09-02-04): returns 400 if deleting this role would leave
 * the company with zero roles that have settings.admin permission.
 */
import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/utils/requirePermission'
import { hasPermission } from '@/lib/services/PermissionService'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

const patchSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  permissions: z.record(z.array(z.string())).optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET((request: NextRequest), { params }: Params) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const forbidden = requirePermission(session, 'settings', 'read')
  if (forbidden) return forbidden

  const companyId = session.companyId
  const { id: roleId } = await params

  const role = await prisma.role.findUnique({
    where: { id: roleId, companyId },
    include: { _count: { select: { users: true } } },
  })
  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    id: role.id,
    name: role.name,
    permissions: role.permissions,
    userCount: role._count.users,
    createdAt: role.createdAt,
  })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const forbidden = requirePermission(session, 'settings', 'admin')
  if (forbidden) return forbidden

  const companyId = session.companyId
  const { id: roleId } = await params

  const existing = await prisma.role.findUnique({
    where: { id: roleId, companyId },
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

  const oldValue = { name: existing.name, permissions: existing.permissions }

  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.role.update({
      where: { id: roleId },
      data: parsed.data,
    })
    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.userId,
        entity: 'Role',
        entityId: roleId,
        action: 'UPDATE',
        oldValue,
        newValue: parsed.data,
        ipAddress: request.headers.get('x-forwarded-for') ?? null,
      },
    })
    return record
  })

  return NextResponse.json(updated)
}

export async function DELETE((request: NextRequest), { params }: Params) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const forbidden = requirePermission(session, 'settings', 'admin')
  if (forbidden) return forbidden

  const companyId = session.companyId
  const { id: roleId } = await params

  const existing = await prisma.role.findUnique({
    where: { id: roleId, companyId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Last-Admin guard (T-09-02-04): prevent locking all admins out of the company
  // A role is considered an "Admin role" if it has settings.admin permission
  const allCompanyRoles = await prisma.role.findMany({
    where: { companyId },
    select: { id: true, permissions: true },
  })

  const adminRoles = allCompanyRoles.filter((r) =>
    hasPermission(r.permissions, 'settings', 'admin')
  )

  const isLastAdminRole =
    adminRoles.length === 1 && adminRoles[0].id === roleId

  if (isLastAdminRole) {
    return NextResponse.json(
      { error: 'You cannot delete the last Admin role.' },
      { status: 400 }
    )
  }

  // Count active users currently assigned to this role for the response
  const userCount = await prisma.user.count({
    where: { roleId, companyId, isActive: true },
  })

  await prisma.$transaction(async (tx) => {
    // Null out roleId on all users assigned this role before deleting it
    // (Role → User relation is optional; this mirrors the plan's updateMany step)
    await tx.user.updateMany({
      where: { roleId, companyId },
      data: { roleId: null },
    })
    await tx.role.delete({ where: { id: roleId } })
    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.userId,
        entity: 'Role',
        entityId: roleId,
        action: 'DELETE',
        oldValue: { name: existing.name, permissions: existing.permissions } as object,
        ipAddress: null,
      },
    })
  })

  return NextResponse.json({ success: true, usersAffected: userCount })
}
