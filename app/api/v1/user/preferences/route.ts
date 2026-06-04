/**
 * POST /api/v1/user/preferences
 * Persists uiMode to the user's database record.
 * Called by SimpleModeToggle after optimistic Zustand update.
 *
 * Security: user id from session (JWT), never from request body (T-02-02).
 * companyId from session.companyId for multi-tenant where clause.
 */
import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextResponse, NextRequest } from 'next/server'
import { userPreferencesSchema } from '@/lib/schemas/masters'

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session?.userId) {
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

  // companyId from session (per non-negotiable rule — NEVER from body)
  await prisma.user.update({
    where: {
      id: session.userId,
      companyId: session.companyId,
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
