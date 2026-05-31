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
  return false
}
