/**
 * lib/redis.ts — NO-OP STUB
 *
 * Redis removed in Phase 21 (CLOUD-02).
 * User session validity is enforced by JWT expiry and DB isActive check at login.
 * blockUser() and isUserBlocked() are retained as no-ops so call sites compile.
 */

export async function blockUser(_userId: string, _ttlSeconds = 60): Promise<void> {
  // No-op: Redis removed. Deactivated users are blocked via DB isActive check at login.
}

export async function isUserBlocked(_userId: string): Promise<boolean> {
  // No-op: always returns false. JWT expiry + DB isActive handles session invalidation.
  // IMPORTANT: Route-level protection relies on user.isActive being checked in the
  // session/JWT callback (lib/auth.ts) — NOT on this function. Any route that previously
  // relied on isUserBlocked() as its primary guard must verify it also checks isActive
  // from the database on every request, not just at login time.
  return false
}
