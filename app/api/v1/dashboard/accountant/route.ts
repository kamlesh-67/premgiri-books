import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getCachedAccountantKPIs } from '@/lib/services/DashboardService'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await getCachedAccountantKPIs(session.user.companyId)
  return NextResponse.json(data)
}
