/**
 * GET /api/v1/auth/user-companies
 * Returns all companies accessible to the logged-in user's email.
 * Used by /company-select page to populate company cards.
 *
 * NOTE: Uses authDb (unextended) because we query User by email across ALL companies.
 * The main prisma client would throw TenantScopeError without a companyId filter.
 */
import { auth } from '@/lib/auth'
import { authDb } from '@/lib/authDb'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await authDb.user.findMany({
    where: { email: session.user.email, isActive: true },
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
