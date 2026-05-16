# PostHog Dashboards — Phase 11 (AI-04)

PostHog dashboards cannot be provisioned programmatically on the free tier. Create these 4 dashboards manually in the PostHog UI. All event names match `lib/analytics.ts` ANALYTICS_EVENTS exactly.

## Prerequisites

1. `NEXT_PUBLIC_POSTHOG_KEY` is set in production env
2. `pnpm validate-posthog` exits 0 (proves all events reach PostHog)
3. App has been live for at least 1 day to populate baseline data

## Dashboard 1: DAU/WAU by Company

**Goal:** Daily/Weekly Active Users segmented by company.

Insight 1 — DAU trend (last 30 days):
- Type: Trends → Total volume
- Event: `app_loaded`
- Series breakdown: by `$groups.company` (company group property — auto-populated via `identifyUser` in `lib/analytics.ts`)
- Time range: Last 30 days, daily granularity

Insight 2 — WAU trend (last 90 days):
- Same as above with weekly granularity

## Dashboard 2: Simple vs Advanced Mode Adoption

**Goal:** Percentage of users in each UI mode.

Insight 1 — Mode toggle frequency:
- Type: Trends → Total volume
- Event: `mode_toggled`
- Breakdown: by `properties.toMode` (values: `'simple'`, `'advanced'`)

Insight 2 — Current mode distribution:
- Type: Lifecycle
- Use `$user_property: uiMode` (set via `identifyUser` traits in `lib/analytics.ts`)

## Dashboard 3: Top 5 Features by Usage

**Goal:** Most-used features in the app.

Insight 1 — Voucher creation rate:
- Type: Trends → Total volume
- Event: `voucher_created`
- Breakdown: by `properties.voucherType` (SALES, PURCHASE, RECEIPT, PAYMENT, JOURNAL, CONTRA)

Insight 2 — Report views:
- Event: `report_viewed`
- Breakdown: by `properties.reportName`

Insight 3 — Search usage:
- Event: `search_performed`

Insight 4 — Invoice downloads:
- Event: `invoice_downloaded`

Insight 5 — Insight engagement:
- Events: `insight_viewed` AND `insight_refreshed` (stacked)

## Dashboard 4: Voucher Creation Funnel

**Goal:** Completion rate of voucher creation flow.

Insight 1 — Funnel: Sales Invoice path:
- Step 1: `app_loaded`
- Step 2: `voucher_created` with `properties.voucherType = 'SALES'`
- Conversion window: 24h

Insight 2 — Cancellation rate:
- Event 1: `voucher_created`
- Event 2: `voucher_cancelled`
- Compute: `voucher_cancelled / voucher_created` over 30 days

## Verifying Dashboards

1. Run `pnpm validate-posthog` — must exit 0
2. Visit PostHog Live Events → search for `distinct_id` printed by the script — verify all 10 events appear within 60 seconds
3. Each dashboard should show non-zero data within 24 hours of normal app usage

## Event Reference

| Event | When Fired | Key Properties |
|-------|-----------|----------------|
| `app_loaded` | App initialisation | n/a |
| `voucher_created` | Successful voucher save | `voucherType`, `voucherId` |
| `voucher_cancelled` | Voucher cancellation | `voucherId` |
| `report_viewed` | Report page mount | `reportName` |
| `gst_filed` | GSTR-3B mark-as-filed | `returnPeriod` |
| `invoice_downloaded` | PDF download click | `voucherId` |
| `mode_toggled` | Simple/Advanced toggle | `fromMode`, `toMode` |
| `search_performed` | ⌘K query | `query` (truncated to 50 chars) |
| `insight_viewed` | SmartInsightsWidget mount | `count` |
| `insight_refreshed` | Widget Refresh click | `source` |
