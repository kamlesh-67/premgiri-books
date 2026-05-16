'use client'
import { useSession } from 'next-auth/react'

/**
 * Client-side permission hook.
 * Returns true if the current session user has the given resource + action.
 * Returns false if the session is not loaded, user is not authenticated, or
 * the permission is not present.
 *
 * Note: This is for UX gating only. Server routes must use requirePermission()
 * for actual security enforcement.
 */
export function usePermission(resource: string, action: string): boolean {
  const { data: session } = useSession()
  const permissions = session?.user?.permissions as Record<string, string[]> | undefined
  return permissions?.[resource]?.includes(action) ?? false
}
