import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

/**
 * GET /api/v1/auth/me
 *
 * Returns the current authenticated user's role name.
 * Used by PO/SO detail pages (04-09) to determine whether to render
 * the Approve button — role gate is D-03.
 *
 * Security:
 *  - 401 if no session
 *  - roleName fetched from DB using session.user.roleId + companyId (not trusted from session payload)
 */
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = session.user.roleId
    ? await prisma.role.findFirst({
        where: { id: session.user.roleId, companyId: session.user.companyId },
        select: { name: true },
      })
    : null

  return NextResponse.json({ roleName: role?.name ?? '' })
}
