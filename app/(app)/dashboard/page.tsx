import { readSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getCachedBusinessKPIs } from '@/lib/services/DashboardService'
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage() {
  const session = await readSession()
  if (!session) redirect('/login')

  // Fetch initial business KPI data server-side for fast TTFB
  const initialData = await getCachedBusinessKPIs(session.companyId)

  return <DashboardClient initialData={initialData} />
}
