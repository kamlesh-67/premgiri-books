'use client'
import { useSession } from 'next-auth/react'
import { useUiStore } from '@/lib/stores/uiStore'
import { navGroups } from './navConfig'
import type { NavItem as NavItemType } from './navConfig'
import { NavItem } from './NavItem'
import { NavGroup } from './NavGroup'

/**
 * Check if the session grants a specific resource+action permission.
 * Reads permissions directly from session to avoid calling usePermission()
 * inside a loop (Rules of Hooks violation).
 */
function sessionHasPermission(
  permissions: Record<string, string[]> | undefined,
  resource: string,
  action: string
): boolean {
  return permissions?.[resource]?.includes(action) ?? false
}

/**
 * Derives a display role label from the user's permissions.
 * Since JWT only carries roleId, we infer the label from permissions.
 */
function getRoleLabel(permissions: Record<string, string[]> | undefined): string {
  if (!permissions) return 'User'
  if (permissions.settings?.includes('admin')) return 'Admin'
  if (permissions.vouchers?.includes('write')) return 'Accountant'
  if (permissions.vouchers?.includes('read')) return 'Viewer'
  return 'User'
}

export function Sidebar() {
  const { data: session } = useSession()
  const uiMode = useUiStore((s) => s.uiMode)

  const permissions = session?.user?.permissions as Record<string, string[]> | undefined
  const userName = session?.user?.name ?? 'User'
  const roleLabel = getRoleLabel(permissions)
  const userInitial = userName.charAt(0).toUpperCase()

  return (
    <aside className="fixed top-14 bottom-0 left-0 w-[240px] bg-white border-r border-gray-200 overflow-y-auto z-40">
      <nav className="p-3 space-y-4">
        {navGroups.map((group, groupIndex) => {
          // Filter items by uiMode and permission
          const visibleItems = group.items.filter((item: NavItemType) => {
            // Check uiMode visibility
            if (!item.visibleIn.includes(uiMode)) return false

            // Check permission gate (UX-only — server enforces 403)
            if (item.requirePermission) {
              const { resource, action } = item.requirePermission
              if (!sessionHasPermission(permissions, resource, action)) return false
            }

            return true
          })

          // Skip entire group if no items are visible
          if (visibleItems.length === 0) return null

          const label = uiMode === 'simple'
            ? (item: NavItemType) => item.simpleLabel ?? item.advancedLabel
            : (item: NavItemType) => item.advancedLabel

          if (group.label) {
            return (
              <NavGroup key={groupIndex} label={group.label}>
                {visibleItems.map((item: NavItemType) => (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    label={label(item)}
                    icon={item.icon}
                    shortcut={item.shortcut}
                  />
                ))}
              </NavGroup>
            )
          }

          // No label (Dashboard group)
          return (
            <div key={groupIndex}>
              {visibleItems.map((item: NavItemType) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={label(item)}
                  icon={item.icon}
                  shortcut={item.shortcut}
                />
              ))}
            </div>
          )
        })}
      </nav>

      {/* Bottom user info */}
      <div className="border-t border-gray-200 p-3 mt-auto">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="h-7 w-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-semibold text-xs">
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
            <p className="text-xs text-gray-500">{roleLabel}</p>
          </div>
          <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-medium">
            FY 2024-25
          </span>
        </div>
      </div>
    </aside>
  )
}
