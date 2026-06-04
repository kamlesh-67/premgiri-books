export const dynamic = 'force-dynamic'

import { headers } from 'next/headers'
import { readSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { AppShellClient } from '@/components/layout/AppShellClient'
import { AutoBreadcrumb } from '@/components/layout/AutoBreadcrumb'
import { UiModeProvider } from '@/components/layout/UiModeProvider'
import { authDb } from '@/lib/authDb'
import type { UiMode } from '@/lib/stores/uiStore'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await readSession()
  if (!session) redirect('/login')

  // Read uiMode from header injected by middleware (avoids double JWT verification)
  const headersList = await headers()
  const uiMode = (headersList.get('x-ui-mode') ?? 'simple') as UiMode

  // Fetch user name from DB using userId from JWT payload
  const user = await authDb.user.findUnique({
    where: { id: session.userId, companyId: session.companyId },
    select: { name: true },
  })
  const name = user?.name ?? 'User'
  const initials = name
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <>
      {/* Hydrate Zustand uiMode from server session — prevents flicker */}
      <UiModeProvider initialMode={uiMode} />

      <Topbar userName={name} userInitials={initials} />

      <AppSidebar
        companyName="PremGiri Demo Co"
        userName={name}
        userRole={session.role ?? ''}
        financialYear="2024-25"
        permissions={session.permissions}
      />

      <AppShellClient />

      {/* ml-0 on mobile (sidebar is a drawer); ml-[240px] on md+ (sidebar is fixed) */}
      <main className="ml-0 md:ml-[240px] pt-14 min-h-screen bg-gray-50">
        <AutoBreadcrumb />
        {children}
      </main>
    </>
  )
}
