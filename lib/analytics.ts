'use client'
import posthog from 'posthog-js'

export const ANALYTICS_EVENTS = {
  APP_LOADED: 'app_loaded',
  VOUCHER_CREATED: 'voucher_created',
  VOUCHER_CANCELLED: 'voucher_cancelled',
  REPORT_VIEWED: 'report_viewed',
  GST_FILED: 'gst_filed',
  INVOICE_DOWNLOADED: 'invoice_downloaded',
  MODE_TOGGLED: 'mode_toggled',
  SEARCH_PERFORMED: 'search_performed',
  INSIGHT_VIEWED: 'insight_viewed',
  INSIGHT_REFRESHED: 'insight_refreshed',
} as const

export type AnalyticsEvent = typeof ANALYTICS_EVENTS[keyof typeof ANALYTICS_EVENTS]

type EventProperties = Record<string, string | number | boolean | null | undefined>

export function captureEvent(event: AnalyticsEvent, properties?: EventProperties): void {
  try { posthog.capture(event, properties) } catch { /* never crash on analytics */ }
}

export function identifyUser(userId: string, traits: { companyId: string; uiMode: string; role?: string }): void {
  try {
    posthog.identify(userId, traits)
    posthog.group('company', traits.companyId)
  } catch { /* silently fail */ }
}

export function resetAnalytics(): void {
  try { posthog.reset() } catch { /* silently fail */ }
}
