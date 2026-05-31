---
phase: "19"
plan: "01"
subsystem: "setup-wizard-backend"
tags: [setup, auth, jwt, prisma, middleware]
dependency_graph:
  requires: []
  provides:
    - "GET /api/v1/setup/status — setup probe"
    - "POST /api/v1/setup — atomic company creation + auto-login"
    - "middleware: /api/v1/setup and /setup whitelisted as public"
    - "lib/jwt.ts signJWT — NextAuth-compatible programmatic session"
  affects:
    - "middleware.ts — public path list extended"
    - "Phase 19-02 frontend wizard depends on these routes"
tech_stack:
  added:
    - "lib/jwt.ts — uses next-auth/jwt encode (transitive dep, no new package)"
  patterns:
    - "authDb.$transaction for pre-session DB writes"
    - "bcrypt hash 12 rounds for admin password"
    - "next-auth/jwt encode with salt=cookieName for programmatic session"
    - "Zod safeParse + flatten() error response"
key_files:
  created:
    - "app/api/v1/setup/route.ts"
    - "app/api/v1/setup/status/route.ts"
    - "lib/jwt.ts"
  modified:
    - "middleware.ts"
decisions:
  - "Used next-auth/jwt encode (not jose directly) to produce NextAuth-compatible session token so existing middleware auth() recognises it without change"
  - "ACCOUNT_GROUPS defined inline in setup route (no export in prisma/seed.ts despite plan assumption); sequential for-of loop used instead of createMany.map() to handle parent-child ID relationships"
  - "Cookie name is authjs.session-token (prod: __Secure-authjs.session-token) matching @auth/core defaultCookies"
  - "salt parameter for encode equals cookie name — required by @auth/core JWT encryption key derivation"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-31"
  tasks_completed: 3
  files_changed: 4
---

# Phase 19 Plan 01: Setup Wizard Backend Summary

Setup wizard backend foundation: two API routes and middleware update enabling unauthenticated first-run company creation with immediate JWT auto-login via NextAuth-compatible session token.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add /api/v1/setup to middleware public paths | b29c91f | middleware.ts |
| 2 | Create GET /api/v1/setup/status route | 5bcc2f7 | app/api/v1/setup/status/route.ts |
| 3 | Create POST /api/v1/setup route + lib/jwt.ts | 1662b9b | app/api/v1/setup/route.ts, lib/jwt.ts |

## What Was Built

### middleware.ts
Added `/setup` and `/api/v1/setup` to `isPublicPath` so the setup wizard page and API routes are accessible before any session cookie exists.

### GET /api/v1/setup/status
Simple probe: calls `authDb.company.count()` and returns `{ setupRequired: boolean }`. Used by Plan 02's wizard page guard and Playwright tests.

### POST /api/v1/setup
Atomic first-run endpoint:
1. Replay guard: returns 409 if any company exists
2. Zod validates all inputs (GSTIN regex, PAN regex, password min 8)
3. bcrypt hash (12 rounds) of admin password
4. Single `authDb.$transaction` creates: Company -> Owner Role -> 19 AccountGroups (with parent-child hierarchy) -> admin User
5. `signJWT` issues a NextAuth-compatible session token
6. Sets `authjs.session-token` httpOnly cookie for immediate auto-login

### lib/jwt.ts
New utility for programmatic session creation. Uses `next-auth/jwt`'s `encode` function with:
- `secret`: `process.env.AUTH_SECRET`
- `salt`: cookie name (required by @auth/core's HKDF key derivation)
- `maxAge`: 7 days
Exports `signJWT(payload: JWTPayload)` and `SESSION_COOKIE_NAME`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Created lib/jwt.ts**
- **Found during:** Task 3
- **Issue:** Plan references `signJWT` from `lib/jwt.ts` and says "Phase 18 auth infrastructure is fully ready for reuse" but `lib/jwt.ts` does not exist in the codebase. The project uses NextAuth CredentialsProvider exclusively with no custom JWT utility.
- **Fix:** Created `lib/jwt.ts` using `next-auth/jwt`'s `encode` function. Used `salt = SESSION_COOKIE_NAME` (required by @auth/core for HKDF key derivation matching the cookie name). The produced token is recognized by the existing `auth()` call in `middleware.ts`.
- **Files modified:** `lib/jwt.ts` (created)
- **Commit:** 1662b9b

**2. [Rule 1 - Bug] ACCOUNT_GROUPS not exported from prisma/seed.ts**
- **Found during:** Task 3
- **Issue:** Plan's `<interfaces>` says `export const ACCOUNT_GROUPS` exists in `prisma/seed.ts` but seed.ts defines groups as a local `const groups` inside `seedCompanyMasterData()`, not exported. Also has 19 groups (not 14), includes parent-child relationships, and uses hardcoded `ag-*` IDs.
- **Fix:** Defined `ACCOUNT_GROUPS` as a module-level constant in `app/api/v1/setup/route.ts`. Used sequential `for...of` loop (not `createMany` with `.map()`) to handle parent-child ID mapping. All 19 groups created with `isSystem: true` and correct parent references.
- **Files modified:** `app/api/v1/setup/route.ts`
- **Commit:** 1662b9b

**3. [Rule 1 - Bug] Cookie name is authjs.session-token not auth-token**
- **Found during:** Task 3
- **Issue:** Plan says `response.cookies.set('auth-token', token, ...)` but the project's middleware uses NextAuth's `auth()` which reads `authjs.session-token`. Setting an `auth-token` cookie would not be recognized by middleware.
- **Fix:** Cookie is set as `authjs.session-token` via `SESSION_COOKIE_NAME` constant from `lib/jwt.ts`. This ensures middleware.auth() decodes the session correctly.
- **Files modified:** `lib/jwt.ts`, `app/api/v1/setup/route.ts`
- **Commit:** 1662b9b

## Known Stubs

None. All routes are fully implemented.

## Threat Flags

None. No new trust boundaries beyond what was specified in the plan's threat model.

## Self-Check: PASSED

- [x] `middleware.ts` contains `pathname.startsWith('/api/v1/setup')` - verified
- [x] `app/api/v1/setup/status/route.ts` exists and contains `setupRequired`, `authDb.company.count` - verified
- [x] `app/api/v1/setup/route.ts` exists and contains: `authDb.$transaction`, `ACCOUNT_GROUPS`, `bcrypt.hash`, `signJWT`, cookie set, `status: 409` - verified
- [x] `lib/jwt.ts` created with `signJWT` and `SESSION_COOKIE_NAME` - verified
- [x] No new TypeScript errors introduced - verified
- [x] All 3 tasks committed individually - b29c91f, 5bcc2f7, 1662b9b
