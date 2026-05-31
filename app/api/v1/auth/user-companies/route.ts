/**
 * GET /api/v1/auth/user-companies
 * Returns all companies accessible to the logged-in user.
 * Used by /company-select page to populate company cards.
 *
 * NOTE: Uses authDb (unextended) because we query User by userId across ALL companies.
 * The main prisma client would throw TenantScopeError without a companyId filter.
 */
import { getSessionFromRequest } from '@/lib/session'
import { authDb } from '@/lib/authDb'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await authDb.user.findMany({
    where: { id: session.userId, isActive: true },
    include: {
      company: {
        select: { id: true, name: true, gstin: true, fyStart: true },
      },
    },
  })

  // authDb is an unextended PrismaClient so the include type is fully typed
  type UserWithCompany = (typeof users)[number]

  const companies = users.map((u: UserWithCompany) => ({
    id: u.company.id,
    name: u.company.name,
    gstin: u.company.gstin,
    fyStart: u.company.fyStart,
  }))

  return NextResponse.json({ companies })
}
