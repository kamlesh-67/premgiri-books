---
phase: 20-user-management
plan: "01"
subsystem: auth-permissions
tags: [permissions, jwt, setup, appsidebar]
dependency_graph:
  requires: []
  provides: [OWNER_PERMISSIONS-in-jwt, permissions-in-auth-me, permissions-prop-in-layout]
  affects: [app/api/v1/setup/route.ts, app/api/v1/auth/me/route.ts, app/(app)/layout.tsx]
tech_stack:
  added: []
  patterns: [compile-time-permissions-constant, jwt-permissions-passthrough]
key_files:
  created: []
  modified:
    - app/api/v1/setup/route.ts
    - app/api/v1/auth/me/route.ts
    - app/(app)/layout.tsx
decisions:
  - OWNER_PERMISSIONS as compile-time const — prevents accidental mutation, no user input involved (T-20-01)
  - ts-expect-error on layout permissions prop — AppSidebar interface extended in Plan 03, not Plan 01
metrics:
  duration_minutes: 10
  completed_date: "2026-05-31"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 3
---

# Phase 20 Plan 01: Fix Permissions Infrastructure Summary

**One-liner:** Owner role and JWT now carry full OWNER_PERMISSIONS constant; auth/me returns permissions; AppSidebar receives permissions from server layout.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix Owner role permissions in setup route | 68161d2 | app/api/v1/setup/route.ts |
| 2 | Fix /api/v1/auth/me to return permissions field | b9579bd | app/api/v1/auth/me/route.ts |
| 3 | Pass permissions from layout to AppSidebar | 3a5e76b | app/(app)/layout.tsx |

---

## What Was Built

**Task 1 — setup route:** Added `OWNER_PERMISSIONS` compile-time constant covering 9 resources (vouchers, reports, masters, inventory, payroll, banking, gst, settings, users). Both the `tx.role.create` call and the `signJWT` call now use this constant instead of `{}`. The Owner role in the DB and the JWT cookie issued after setup now carry a full, non-empty permissions object.

**Task 2 — auth/me route:** The GET response now returns `{ roleName, permissions }` instead of just `{ roleName }`. `session.permissions` is taken directly from the verified JWT payload — no additional DB query. This unblocks `usePermission()` hooks that call this endpoint.

**Task 3 — app layout:** Replaced hardcoded `userRole="Accountant"` with `userRole={session.role ?? ''}`. Added `permissions={session.permissions}` to the `AppSidebar` JSX call with a `@ts-expect-error` comment (the prop is added to the interface in Plan 03 Task 1).

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None. The permissions flow is complete end-to-end for the setup path. AppSidebar does not yet filter nav items by permissions (that is Plan 03's job, which this plan explicitly defers).

---

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. Changes are scoped to the setup route (existing public endpoint with replay guard), the auth/me response shape, and the layout component. All within the plan's `<threat_model>`.

---

## Self-Check

- [x] app/api/v1/setup/route.ts — modified, committed 68161d2
- [x] app/api/v1/auth/me/route.ts — modified, committed b9579bd
- [x] app/(app)/layout.tsx — modified, committed 3a5e76b
- [x] grep -c "OWNER_PERMISSIONS" app/api/v1/setup/route.ts = 3
- [x] grep -c "permissions: {}" app/api/v1/setup/route.ts = 0
- [x] grep -c "permissions: session.permissions" app/api/v1/auth/me/route.ts = 1
- [x] grep -c "permissions={session.permissions}" "app/(app)/layout.tsx" = 1
- [x] grep -c "userRole={session.role" "app/(app)/layout.tsx" = 1

## Self-Check: PASSED
