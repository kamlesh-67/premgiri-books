---
phase: 18-local-authentication
plan: "02"
subsystem: auth
tags: [jwt, session, api-migration, multi-tenant]
dependency_graph:
  requires: [18-01]
  provides: [getSessionFromRequest-in-all-routes, select-company-jwt-reissue]
  affects: [app/api/v1/**/*.ts, lib/services/VoucherEngine.ts]
tech_stack:
  added: []
  patterns: [flat JWTPayload session, cookie-based JWT re-issue on company switch]
key_files:
  created:
    - tests/auth/protected-route.test.ts
  modified:
    - app/api/v1/auth/me/route.ts
    - app/api/v1/auth/select-company/route.ts
    - app/api/v1/auth/user-companies/route.ts
    - app/api/v1/cheques/route.test.ts
    - lib/services/VoucherEngine.ts (VoucherSession interface — flat shape)
    - vitest.config.ts (jose ESM inline + moduleDirectories for worktree)
    - "72 non-auth app/api/v1/**/*.ts routes (see commits)"
decisions:
  - "user-companies route now uses session.userId (DB user ID) instead of session.user.email — email not available in JWTPayload"
  - "VoucherSession interface updated to accept flat JWTPayload (userId/companyId) with optional user.X for backward compat during transition"
  - "select-company re-issues full JWT instead of 200-for-client-update() — eliminates NextAuth update() call"
  - "cheques/route.test.ts updated to mock getSessionFromRequest instead of auth() — test still covers 401 + 200 + 400 business rules"
  - "vitest.config.ts updated with server.deps.inline: ['jose'] to fix ESM resolution in Vite + pnpm shamefully-hoist environment"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-31"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 78
---

# Phase 18 Plan 02: API Route Migration to JWT Session Summary

**One-liner:** Replaced all 76 `auth()` call sites in app/api/v1/ with `getSessionFromRequest(request)`, updated the three special auth routes (me, select-company, user-companies), and re-wired select-company to re-issue a full JWT cookie instead of delegating to NextAuth's `update()`.

---

## Tasks Completed

| Task | Description | Commit | Tests |
|------|-------------|--------|-------|
| 1 | Integration tests (getSessionFromRequest null guards + 401 verification) | 85a609a | 4/4 |
| 2 | Mass search-replace of 72 non-auth API routes | 07752a7 | tsc 0 migration errors |
| 3 | Update me, select-company, user-companies routes | 3238aa2 | tsc 0 auth route errors |

---

## What Was Built

### tests/auth/protected-route.test.ts
- 4 test cases: no cookie returns null, malformed JWT returns null, wrong-secret JWT returns null, GET /api/v1/vouchers returns 401 with no cookie
- Mocks: `@prisma/client`, `@/lib/prisma`, `next/headers`, `@/lib/auth` (prevents next-auth transitive import)
- Uses `new NextRequest(url, { headers })` for proper `.cookies` property on test requests

### Mass migration (72 files)
- Replacement 1: `import { auth } from '@/lib/auth'` → `import { getSessionFromRequest } from '@/lib/session'`
- Replacement 2: `const session = await auth()` → `const session = await getSessionFromRequest(request)`
- Replacement 3: All `session.user.X` → flat `session.X` (companyId, userId, roleId, permissions, uiMode)
- VoucherEngine.ts: `VoucherSession` interface updated to flat shape with optional `.user` for backward compat

### app/api/v1/auth/me/route.ts
- Added `request: NextRequest` parameter to GET handler (required by getSessionFromRequest)
- `session.user.roleId` → `session.roleId`, `session.user.companyId` → `session.companyId`

### app/api/v1/auth/user-companies/route.ts
- Replaced email-based lookup with `session.userId` (JWTPayload has no email field)
- `authDb.user.findMany({ where: { id: session.userId, isActive: true } })`

### app/api/v1/auth/select-company/route.ts
- Full rewrite: verifies company access via `authDb.user.findFirst({ where: { id: session.userId, companyId, isActive: true } })`
- Fetches role name + permissions from DB for the new company context
- Calls `signJWT` with updated companyId, roleId, role, uiMode, permissions
- Sets `auth-token` httpOnly cookie (7-day maxAge) AND ui-mode cookie
- T-18-06 mitigation: DB verification before JWT re-issue prevents privilege escalation

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] VoucherEngine.ts expected old session.user.X shape**
- **Found during:** Task 2 — TypeScript analysis
- **Issue:** `VoucherEngine.ts` had `VoucherSession.user.companyId` / `session.user.id` pattern; routes now pass flat `JWTPayload` with `session.companyId` / `session.userId`
- **Fix:** Updated `VoucherSession` interface to flat shape (`companyId`, `userId`) with optional `user?` compat shim. Updated 3 internal usages of `session.user.X` to `session.companyId ?? session.user?.companyId`
- **Files modified:** `lib/services/VoucherEngine.ts`

**2. [Rule 1 - Bug] user-companies route used session.user.email (not in JWTPayload)**
- **Found during:** Task 3
- **Issue:** Original route queried by `email: session.user.email`; JWTPayload has no `email` field
- **Fix:** Changed query to use `id: session.userId` instead of email — queries same user across all companies
- **Files modified:** `app/api/v1/auth/user-companies/route.ts`

**3. [Rule 2 - Infrastructure] pnpm shamefully-hoist required for vitest to find packages**
- **Found during:** Task 1 — test execution
- **Issue:** pnpm virtual store (hardlinks) appeared empty in Git Bash; Vite could not resolve `jose` or other packages
- **Fix:** Ran `pnpm install --shamefully-hoist` in main repo to flatten node_modules; updated vitest.config.ts with `server.deps.inline: ['jose']`
- **Files modified:** `vitest.config.ts`

**4. [Rule 1 - Bug] cheques/route.test.ts mocked @/lib/auth but route now uses getSessionFromRequest**
- **Found during:** Task 2 — after mass replacement
- **Issue:** The existing test file would fail because the route no longer imports `auth`
- **Fix:** Updated `cheques/route.test.ts` to mock `@/lib/session` and update SESSION shape to flat JWTPayload
- **Files modified:** `app/api/v1/cheques/route.test.ts`

---

## Known Stubs

None. All functionality is fully wired.

---

## Threat Surface Scan

No new network endpoints. All new surfaces were covered by the plan's threat model:
- T-18-06 (select-company): DB verification before JWT re-issue implemented
- T-18-07 (85 API routes): getSessionFromRequest returns null for invalid tokens; 401 before any DB access
- T-18-08 (field rename): Zero session.user.X accesses remain; TypeScript confirms correctness

---

## Self-Check: PASSED

Files verified:
- tests/auth/protected-route.test.ts (exists, 4 tests pass)
- app/api/v1/auth/me/route.ts (no @/lib/auth import, uses session.roleId)
- app/api/v1/auth/select-company/route.ts (signJWT present, auth-token cookie set)
- app/api/v1/auth/user-companies/route.ts (no @/lib/auth import)
- lib/services/VoucherEngine.ts (VoucherSession flat shape)

Commits verified:
- 85a609a (Task 1 — tests) present in git log
- 07752a7 (Task 2 — mass migrate) present in git log
- 3238aa2 (Task 3 — auth routes) present in git log

Acceptance criteria:
- grep -r "from '@/lib/auth'" app/api/v1/ → empty (except cheques/route.test which uses session mock)
- grep -r "from 'next-auth'" app/api/v1/ → empty
- grep -r "session.user." app/api/v1/ → empty (no non-comment occurrences)
- grep -rl "getSessionFromRequest" app/api/v1/ | wc -l → 76
- pnpm tsc --noEmit: 0 migration-specific errors (156 pre-existing errors from Phase 17 SQLite migration remain)
- tests/auth/protected-route.test.ts: 4/4 pass
