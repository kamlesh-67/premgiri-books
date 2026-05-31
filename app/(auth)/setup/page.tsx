import { redirect } from 'next/navigation'
import { authDb } from '@/lib/authDb'
import { SetupWizard } from './SetupWizard'

export default async function SetupPage() {
  const count = await authDb.company.count()
  if (count > 0) redirect('/login')

  return <SetupWizard />
}
