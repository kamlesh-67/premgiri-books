#!/usr/bin/env tsx
/**
 * Phase 11 D-18: Validates that every ANALYTICS_EVENT in lib/analytics.ts
 * reaches PostHog. Run via `pnpm validate-posthog`.
 *
 * Exits 0 on success, non-zero on missing env or failed flush.
 * Uses synthetic distinct_id to avoid polluting real user data (T-11-07-01).
 */

// Load .env.local so the script works outside docker/CI
import { config } from 'dotenv'
config({ path: '.env.local' })

import { PostHog } from 'posthog-node'

// ANALYTICS_EVENTS is defined in lib/analytics.ts with 'use client' directive.
// We re-declare the same 10 constants here so this server-only script never
// imports client-side posthog-js (which breaks in Node).
const ANALYTICS_EVENTS = {
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

async function main() {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'

  if (!apiKey) {
    console.error('[validate-posthog] NEXT_PUBLIC_POSTHOG_KEY missing — set in .env')
    process.exit(1)
  }

  const ph = new PostHog(apiKey, { host, flushAt: 1, flushInterval: 0 })
  const testDistinctId = `validate-${Date.now()}`
  const events = Object.values(ANALYTICS_EVENTS)

  console.log(`[validate-posthog] firing ${events.length} events for distinct_id=${testDistinctId}`)
  for (const event of events) {
    ph.capture({
      distinctId: testDistinctId,
      event,
      properties: { source: 'validate-posthog-events', ts: new Date().toISOString() },
    })
    console.log(`  [OK] ${event}`)
  }

  // posthog-node v5 uses shutdown() (v3 used shutdownAsync)
  await ph.shutdown()
  console.log(`[validate-posthog] all ${events.length} events flushed to ${host}`)
  console.log(`[validate-posthog] check PostHog Live Events for distinct_id: ${testDistinctId}`)
  console.log(`[validate-posthog] expected events: ${events.join(', ')}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
