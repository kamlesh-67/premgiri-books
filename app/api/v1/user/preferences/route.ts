/**
 * POST /api/v1/user/preferences
 * Persists uiMode to the user's database record.
 * Called by SimpleModeToggle after optimistic Zustand update.
 *
 * Security: user id from session (JWT), never from request body (T-02-02).
 * companyId from session.user.companyId for multi-tenant where clause.
 *
 * NOTE: session.user is extended in lib/auth.ts (Plan 01-01) to include
 * companyId, roleId, uiMode. Using type assertion here to satisfy the compiler
 * in this parallel worktree; merged result will have the full session type.
 */
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { userPreferencesSchema } from '@/lib/schemas/masters'

// Extended session user type — matches lib/auth.ts session callback from Plan 01-01
interface ExtendedUser {
  id: string
  email: string
  name?: string | null
  companyId: string
  roleId: string | null
  uiMode: 'simple' | 'advanced'
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = userPreferencesSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid preferences', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  // Cast to extended user type — lib/auth.ts (01-01) adds companyId to JWT
  const user = session.user as unknown as ExtendedUser

  // companyId from session (per non-negotiable rule — NEVER from body)
  await prisma.user.update({
    where: {
      id: user.id,
      companyId: user.companyId,
    },
    data: { uiMode: parsed.data.uiMode },
  })

  const response = NextResponse.json({ ok: true })
  // Set a persistent cookie so middleware can read uiMode without waiting for JWT refresh
  response.cookies.set('ui-mode', parsed.data.uiMode, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })
  return response
}
