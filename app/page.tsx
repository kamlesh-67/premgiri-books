import { redirect } from 'next/navigation'
import { readSession } from '@/lib/session'
import { authDb } from '@/lib/authDb'

export default async function RootPage() {
  const count = await authDb.company.count()
  if (count === 0) redirect('/setup')

  const session = await readSession()
  if (!session) redirect('/login')

  redirect('/dashboard')
}
