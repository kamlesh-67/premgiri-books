import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getCachedBusinessKPIs } from '@/lib/services/DashboardService'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await getCachedBusinessKPIs(session.user.companyId)
  return NextResponse.json(data)
}
