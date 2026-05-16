import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCachedBusinessKPIs } from '@/lib/services/DashboardService'
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  // Fetch initial business KPI data server-side for fast TTFB
  const initialData = await getCachedBusinessKPIs(session.user.companyId)

  return <DashboardClient initialData={initialData} />
}
