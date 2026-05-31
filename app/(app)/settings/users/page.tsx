import { redirect } from 'next/navigation'
import { readSession } from '@/lib/session'
import { hasPermission } from '@/lib/services/PermissionService'
import UsersPageClient from './UsersPageClient'

export default async function UsersPage() {
  const session = await readSession()

  if (session === null) {
    redirect('/login')
  }

  if (!hasPermission(session.permissions, 'users', 'read')) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
        <p className="mt-2 text-sm text-gray-500">
          You need Owner permissions to access user management.
        </p>
      </div>
    )
  }

  return <UsersPageClient />
}
