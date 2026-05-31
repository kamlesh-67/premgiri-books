'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useUiStore } from '@/lib/stores/uiStore'
import { useSidebarStore } from '@/lib/stores/sidebarStore'
import { navGroups } from '@/components/layout/navConfig'
import type { NavItem } from '@/components/layout/navConfig'
import { cn } from '@/lib/utils'
import { hasPermission } from '@/lib/services/PermissionService'

interface AppSidebarProps {
  companyName: string
  userName: string
  userRole: string
  financialYear: string
  permissions?: unknown
}

export function AppSidebar({
  companyName,
  userName,
  userRole,
  financialYear,
  permissions,
}: AppSidebarProps) {
  const pathname = usePathname()
  const { uiMode } = useUiStore()
  const { isOpen, close } = useSidebarStore()

  // Close sidebar on route change (mobile navigation)
  useEffect(() => {
    close()
  }, [pathname, close])

  function getLabel(item: NavItem): string {
    if (uiMode === 'simple') {
      return item.simpleLabel ?? item.advancedLabel
    }
    return item.advancedLabel
  }

  function isVisible(item: NavItem): boolean {
    return item.visibleIn.includes(uiMode)
  }

  function isPermitted(item: NavItem): boolean {
    if (!item.requirePermission) return true
    return hasPermission(
      permissions,
      item.requirePermission.resource,
      item.requirePermission.action
    )
  }

  function isActive(href: string): boolean {
    if (!pathname) return false
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-14 bottom-0 w-[240px] bg-white border-r border-gray-200 z-40 overflow-y-auto flex flex-col',
          'transition-transform duration-300 ease-in-out',
          // Mobile: slide in/out; Desktop: always visible
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Company header */}
        <div className="px-3 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900 truncate">{companyName}</p>
          <span className="inline-flex mt-1 items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs text-purple-600 font-medium">
            FY {financialYear}
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-4">
          {navGroups.map((group, groupIdx) => {
            const visibleItems = group.items.filter((item) => isVisible(item) && isPermitted(item))
            if (visibleItems.length === 0) return null

            return (
              <div key={groupIdx}>
                {group.label && (
                  <p className="px-3 mb-1 text-xs font-medium text-gray-400 uppercase tracking-widest">
                    {group.label}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 h-9 rounded-md text-sm transition-colors',
                          isActive(item.href)
                            ? 'bg-purple-50 text-purple-600 font-medium border-l-2 border-purple-600'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{getLabel(item)}</span>
                        {item.shortcut && (
                          <span className="ml-auto text-xs text-gray-400 font-mono">
                            {item.shortcut}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 py-3 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700 truncate">{userName}</p>
          <p className="text-xs text-gray-400 truncate">{userRole}</p>
        </div>
      </aside>
    </>
  )
}
