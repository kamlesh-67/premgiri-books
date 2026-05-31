import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * GET /api/v1/auth/me
 *
 * Returns the current authenticated user's role name.
 * Used by PO/SO detail pages (04-09) to determine whether to render
 * the Approve button — role gate is D-03.
 *
 * Security:
 *  - 401 if no session
 *  - roleName fetched from DB using session.roleId + companyId (not trusted from session payload)
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = session.roleId
    ? await prisma.role.findFirst({
        where: { id: session.roleId, companyId: session.companyId },
        select: { name: true },
      })
    : null

  return NextResponse.json({ roleName: role?.name ?? '' })
}
