import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { authDb } from '@/lib/authDb'

export default async function RootPage() {
  const count = await authDb.company.count()
  if (count === 0) redirect('/setup')

  const session = await auth()
  if (!session) redirect('/login')

  redirect('/dashboard')
}
