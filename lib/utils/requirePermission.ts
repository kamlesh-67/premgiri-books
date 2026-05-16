import type { Session } from 'next-auth'
import { NextResponse } from 'next/server'
import { hasPermission } from '@/lib/services/PermissionService'

/**
 * Server-side 403 helper for API routes.
 * Returns a 403 NextResponse if the session user lacks the required permission,
 * otherwise returns null (caller may proceed).
 *
 * Usage:
 *   const forbidden = requirePermission(session, 'vouchers', 'write')
 *   if (forbidden) return forbidden
 */
export function requirePermission(
  session: Session,
  resource: string,
  action: string
): NextResponse | null {
  const perms = session.user.permissions as Record<string, string[]> | undefined
  if (!hasPermission(perms, resource, action)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}
