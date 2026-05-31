/**
 * POST /api/v1/auth/select-company
 * Called by /company-select page after user clicks a company card.
 *
 * Flow:
 *  1. Verify current JWT session (getSessionFromRequest) — 401 if absent
 *  2. Validate companyId from request body (Zod)
 *  3. Verify user actually belongs to the requested company (T-18-06 — elevation of privilege prevention)
 *  4. Fetch the role for this company context
 *  5. Issue a NEW auth-token JWT with updated companyId, roleId, and role name
 *
 * Security (T-18-06): companyId from the client body is verified against DB before re-issuing JWT.
 * A user cannot elevate privileges by supplying an arbitrary companyId.
 */
import { getSessionFromRequest } from '@/lib/session'
import { signJWT } from '@/lib/jwt'
import { authDb } from '@/lib/authDb'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  companyId: z.string().min(1),
})

const SEVEN_DAYS_SECONDS = 60 * 60 * 24 * 7

export async function POST(request: NextRequest) {
  // 1. Verify current session
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Validate request body
  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 })
  }

  const { companyId } = parsed.data

  // 3. Verify user actually has access to this company (T-18-06 — elevation of privilege prevention)
  const userInCompany = await authDb.user.findFirst({
    where: {
      id: session.userId,
      companyId,
      isActive: true,
    },
    select: { id: true, roleId: true, uiMode: true },
  })

  if (!userInCompany) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // 4. Fetch role record for this company context
  let roleName = ''
  let rolePermissions: Record<string, string[]> = {}
  if (userInCompany.roleId) {
    const roleRecord = await authDb.role.findUnique({
      where: { id: userInCompany.roleId },
      select: { name: true, permissions: true },
    })
    if (roleRecord) {
      roleName = roleRecord.name
      rolePermissions = (roleRecord.permissions as Record<string, string[]>) ?? {}
    }
  }

  // 5. Re-issue JWT with updated companyId, roleId, and role name
  const token = await signJWT({
    userId: session.userId,
    companyId,
    roleId: userInCompany.roleId ?? null,
    role: roleName,
    uiMode: (userInCompany.uiMode as 'simple' | 'advanced') ?? 'simple',
    permissions: rolePermissions,
  })

  const response = NextResponse.json({ ok: true, companyId })

  // Set the new auth-token cookie (same options as login route)
  response.cookies.set('auth-token', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SEVEN_DAYS_SECONDS,
  })

  // Also update ui-mode cookie so middleware uses correct value without JWT re-read
  response.cookies.set('ui-mode', (userInCompany.uiMode as string) ?? 'simple', {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  })

  return response
}
