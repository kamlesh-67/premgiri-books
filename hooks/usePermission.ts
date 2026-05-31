'use client'
import { useQuery } from '@tanstack/react-query'

interface MeResponse {
  roleName: string
  permissions?: Record<string, string[]>
}

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
  const { data } = useQuery<MeResponse | null>({
    queryKey: ['auth-me'],
    queryFn: async () => {
      const r = await fetch('/api/v1/auth/me')
      if (!r.ok) return null
      return r.json() as Promise<MeResponse>
    },
    staleTime: 5 * 60 * 1000,
  })
  const permissions = data?.permissions
  return permissions?.[resource]?.includes(action) ?? false
}
