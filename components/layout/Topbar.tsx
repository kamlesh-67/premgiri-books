'use client'
import { Bell, LogOut, Menu } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { SimpleModeToggle } from '@/components/shared/SimpleModeToggle'
import { TopbarSearchTrigger } from '@/components/layout/TopbarSearchTrigger'
import { useSidebarStore } from '@/lib/stores/sidebarStore'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface TopbarProps {
  userName: string
  userInitials: string
}

type CompanyData = {
  name: string
  logoUrl: string | null
}

export function Topbar({ userName, userInitials }: TopbarProps) {
  const { data: company } = useQuery<CompanyData>({
    queryKey: ['company'],
    queryFn: () => fetch('/api/v1/company').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const { toggle } = useSidebarStore()
  const router = useRouter()

  async function handleSignOut() {
    await fetch('/api/v1/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-50 flex items-center px-3 sm:px-4 gap-2 sm:gap-3">
      {/* Hamburger — mobile only */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 md:hidden shrink-0"
        aria-label="Toggle sidebar"
        onClick={toggle}
      >
        <Menu className="h-5 w-5 text-gray-600" />
      </Button>

      {/* Logo */}
      <div className="flex items-center gap-2">
        {company?.logoUrl ? (
          <Image
            src={company.logoUrl}
            alt="Company logo"
            width={32}
            height={32}
            className="rounded object-contain"
          />
        ) : (
          <div className="h-8 w-8 rounded bg-purple-100 text-purple-700 text-xs font-semibold flex items-center justify-center">
            {company?.name?.slice(0, 2).toUpperCase() ?? 'PG'}
          </div>
        )}
        <span className="text-purple-600 font-bold text-lg select-none hidden sm:block">
          {company?.name ?? 'PremGiri Books'}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right section */}
      <div className="flex items-center gap-1 sm:gap-2">
        <SimpleModeToggle />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <TopbarSearchTrigger />
            </TooltipTrigger>
            <TooltipContent>Search (⌘K)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 relative hidden sm:flex"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4 text-gray-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Notifications</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label="Sign out"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 text-gray-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sign out</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* User avatar */}
        <div
          className="h-8 w-8 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold flex items-center justify-center select-none cursor-default"
          title={userName}
          aria-label={`User: ${userName}`}
        >
          {userInitials}
        </div>
      </div>
    </header>
  )
}
