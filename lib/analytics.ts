/**
 * lib/analytics.ts — NO-OP STUB
 *
 * PostHog analytics removed in Phase 21 (CLOUD-05).
 * All tracking functions are retained as no-ops so call sites compile.
 */

export function trackEvent(_event: string, _properties?: Record<string, unknown>): void {
  // No-op: PostHog removed.
}

/** Alias for trackEvent — retained for call-site compatibility. */
export function captureEvent(_event: string, _properties?: Record<string, unknown>): void {
  // No-op: PostHog removed.
}

export function identifyUser(_userId: string, _traits?: Record<string, unknown>): void {
  // No-op: PostHog removed.
}

export function resetUser(): void {
  // No-op: PostHog removed.
}

/** Alias for resetUser — retained for call-site compatibility. */
export function resetAnalytics(): void {
  // No-op: PostHog removed.
}
