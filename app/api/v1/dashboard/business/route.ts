import { getSessionFromRequest } from '@/lib/session'
import { NextResponse, NextRequest } from 'next/server'
import { getCachedBusinessKPIs } from '@/lib/services/DashboardService'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await getCachedBusinessKPIs(session.companyId)
  return NextResponse.json(data)
}
