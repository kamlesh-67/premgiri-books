/**
 * POST /api/v1/users/[id]/reset-password
 *
 * Allows an Owner to reset another user's password directly without any email flow.
 * Requirements: USER-03, USER-04
 *
 * Security:
 * - Auth: 401 if no valid session
 * - Permission: 403 if caller lacks users.admin
 * - IDOR: companyId from session — 404 for cross-company targets (leaks nothing)
 * - Self-reset guard: 400 if caller tries to reset their own password
 * - Audit log: newValue is { passwordReset: true } — hash NEVER logged
 */
import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/utils/requirePermission'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const schema = z.object({
  password: z.string().min(8),
})

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  // 1. Authenticate
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Permission check
  const forbidden = requirePermission(session, 'users', 'admin')
  if (forbidden) return forbidden

  // 3. Extract ids
  const { id: userId } = await params
  const companyId = session.companyId

  // 4. IDOR guard: companyId MUST come from session, never from request
  const existing = await prisma.user.findUnique({
    where: { id: userId, companyId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 5. Self-reset guard
  if (userId === session.userId) {
    return NextResponse.json(
      { error: 'Use account settings to change your own password.' },
      { status: 400 }
    )
  }

  // 6. Validate request body
  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  // 7. Hash the new password — 12 rounds (matches setup route cost factor)
  const passwordHash = await bcrypt.hash(parsed.data.password, 12)

  // 8. Atomic update + audit log — password hash NEVER included in audit log
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash },
    })
    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.userId,
        entity: 'User',
        entityId: userId,
        action: 'UPDATE',
        oldValue: {},
        newValue: { passwordReset: true },
        ipAddress: request.headers.get('x-forwarded-for') ?? null,
      },
    })
  })

  // 9. Return minimal confirmation — NEVER include any user data or hash
  return NextResponse.json({ ok: true })
}
