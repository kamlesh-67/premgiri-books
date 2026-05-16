/**
 * POST /api/v1/auth/select-company
 * Called by /company-select page after user clicks a company card.
 * Verifies the user actually has access to the chosen company,
 * then returns 200 so the client can call update({ companyId }) on the session.
 *
 * NOTE: The actual JWT companyId update is done client-side via
 * useSession().update({ companyId }) which triggers the jwt callback
 * with trigger='update' in lib/auth.ts.
 */
import { auth } from '@/lib/auth'
import { authDb } from '@/lib/authDb'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  companyId: z.string().min(1),
})

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 })
  }

  // Verify user actually has access to this company (security check — T-02-01)
  const userInCompany = await authDb.user.findFirst({
    where: {
      email: session.user.email,
      companyId: parsed.data.companyId,
      isActive: true,
    },
    select: { id: true, uiMode: true },
  })

  if (!userInCompany) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Client will call useSession().update({ companyId }) to update the JWT
  const response = NextResponse.json({ ok: true, companyId: parsed.data.companyId })
  // Seed the ui-mode cookie from the DB so middleware always has the correct value
  // (JWT may be stale between logins if user toggled mode in a prior session)
  response.cookies.set('ui-mode', (userInCompany.uiMode as string) ?? 'simple', {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  })
  return response
}
