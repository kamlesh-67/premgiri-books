---
phase: 20-user-management
plan: "03"
subsystem: frontend-permissions
tags: [permissions, sidebar, server-component, dialog, user-management]
dependency_graph:
  requires: [20-01, 20-02]
  provides: [frontend-403-guard, sidebar-permission-filter, reset-password-dialog]
  affects: [components/layout/AppSidebar.tsx, app/(app)/settings/users/]
tech_stack:
  added: []
  patterns: [server-component-guard, permission-filter, client-dialog-pattern]
key_files:
  created:
    - app/(app)/settings/users/UsersPageClient.tsx
    - components/settings/ResetPasswordDialog.tsx
  modified:
    - components/layout/AppSidebar.tsx
    - app/(app)/settings/users/page.tsx
decisions:
  - "Access denied rendered as JSX (not redirect) for authenticated users lacking users.read"
  - "isPermitted() scoped inside AppSidebar function body to close over permissions prop"
  - "ResetPasswordDialog uses canAdmin guard in UsersPageClient for the Reset Password button"
metrics:
  duration_minutes: 20
  completed_date: "2026-05-31"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 4
---

# Phase 20 Plan 03: Frontend Permission Guards and Reset Password Dialog Summary

**One-liner:** Server-side 403 guard on /settings/users, sidebar isPermitted() filter hiding Users nav item from Accountant role, and ResetPasswordDialog for Owner-initiated password resets.

## What Was Built

### Task 1 — AppSidebar permissions prop and isPermitted filter (commit: 43ddf13)

Extended `AppSidebar` to accept an optional `permissions?: unknown` prop and added an `isPermitted()` helper that calls `hasPermission()` from `PermissionService`. The nav filter now uses `isVisible(item) && isPermitted(item)` so nav items with `requirePermission` set are hidden when the session lacks that permission. This resolves the `@ts-expect-error` workaround added in Plan 01 Task 3.

### Task 2 — Users page Server Component wrapper with 403 guard (commit: a018999)

Converted `app/(app)/settings/users/page.tsx` to a Server Component that:
1. Calls `readSession()` — redirects to `/login` if no session
2. Calls `hasPermission(session.permissions, 'users', 'read')` — renders Access Denied JSX (not a redirect) for authenticated users without permission
3. Renders `<UsersPageClient />` for authorized users

The original page.tsx content was preserved as `UsersPageClient.tsx` with `'use client'` at top and the export renamed to `UsersPageClient`.

### Task 3 — ResetPasswordDialog and UsersPageClient wiring (commit: ec2840b)

Created `components/settings/ResetPasswordDialog.tsx` with:
- Client-side validation: password >= 8 chars, passwords match
- Calls `POST /api/v1/users/${userId}/reset-password`
- Shows API error inline in the dialog
- useEffect resets all state when dialog opens

Wired into `UsersPageClient.tsx`:
- Imports `ResetPasswordDialog`
- Adds `resetTarget` state (`{ id, name } | null`)
- Adds `KeyRound` icon button per user row (visible only when `canAdmin` is true)
- Renders `<ResetPasswordDialog>` at the bottom alongside `<UserDialog>`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all functionality is fully wired to existing backend endpoints from Plans 01 and 02.

## Threat Flags

No new threat surface introduced beyond what the plan's threat model covers. All mitigations from T-20-07 and T-20-09 are implemented.

## Self-Check

Files exist:
- components/layout/AppSidebar.tsx — FOUND
- app/(app)/settings/users/page.tsx — FOUND
- app/(app)/settings/users/UsersPageClient.tsx — FOUND
- components/settings/ResetPasswordDialog.tsx — FOUND

Commits exist:
- 43ddf13 — feat(20-03): add permissions prop to AppSidebar with isPermitted filter
- a018999 — feat(20-03): convert Users page to Server Component with 403 guard
- ec2840b — feat(20-03): add ResetPasswordDialog and wire into UsersPageClient

## Self-Check: PASSED
