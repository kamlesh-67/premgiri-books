import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { AppShellClient } from '@/components/layout/AppShellClient'
import { AutoBreadcrumb } from '@/components/layout/AutoBreadcrumb'
import { UiModeProvider } from '@/components/layout/UiModeProvider'
import type { UiMode } from '@/lib/stores/uiStore'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect('/login')

  // Read uiMode from header injected by middleware (avoids double auth() call)
  const headersList = await headers()
  const uiMode = (headersList.get('x-ui-mode') ?? 'simple') as UiMode

  // Derive user initials for avatar
  const name = session.user.name ?? session.user.email ?? 'User'
  const initials = name
    .split(' ')
    .map((n) => n[0])
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
        userRole="Accountant"
        financialYear="2024-25"
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
