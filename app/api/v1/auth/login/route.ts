/**
 * POST /api/v1/auth/login
 *
 * Authenticates user with email + password.
 * On success, issues a signed JWT in an httpOnly auth-token cookie.
 *
 * Security:
 *  - Same error message for user-not-found and wrong-password (ASVS V2.1.1 — prevents user enumeration)
 *  - isActive check: deactivated users cannot obtain new tokens
 *  - httpOnly + sameSite:lax cookie prevents XSS and CSRF
 */
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { authDb } from '@/lib/authDb'
import { signJWT } from '@/lib/jwt'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { email, password } = parsed.data

  const user = await authDb.user.findFirst({
    where: { email, isActive: true },
    select: {
      id: true,
      companyId: true,
      roleId: true,
      uiMode: true,
      passwordHash: true,
    },
  })

  // Return same error for not-found and wrong-password (T-18-01 — ASVS V2.1.1)
  if (!user) {
    return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 })
  }

  // Fetch role name and permissions (AUTH-04: role name must be in JWT)
  const roleRecord = user.roleId
    ? await authDb.role.findUnique({
        where: { id: user.roleId },
        select: { name: true, permissions: true },
      })
    : null

  const token = await signJWT({
    userId: user.id,
    companyId: user.companyId,
    roleId: user.roleId ?? null,
    role: roleRecord?.name ?? '',
    uiMode: (user.uiMode as 'simple' | 'advanced') ?? 'simple',
    permissions: (roleRecord?.permissions as Record<string, string[]>) ?? {},
  })

  const response = NextResponse.json({ ok: true })
  response.cookies.set('auth-token', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
  return response
}
