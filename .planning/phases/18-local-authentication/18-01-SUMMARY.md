---
phase: 18-local-authentication
plan: "01"
subsystem: auth
tags: [jwt, bcrypt, middleware, sqlite, authentication]
dependency_graph:
  requires: []
  provides: [signJWT, verifyJWT, JWTPayload, getSessionFromRequest, readSession, POST /api/v1/auth/login, POST /api/v1/auth/logout]
  affects: [middleware.ts, lib/authDb.ts]
tech_stack:
  added: [jose@6.2.3]
  patterns: [httpOnly cookie JWT, edge middleware with jose, lazy secret loading]
key_files:
  created:
    - lib/jwt.ts
    - lib/session.ts
    - lib/jwt.test.ts
    - app/api/v1/auth/login/route.ts
    - app/api/v1/auth/logout/route.ts
    - tests/auth/login.test.ts
  modified:
    - lib/authDb.ts
    - middleware.ts
    - .env (gitignored — JWT_SECRET added)
decisions:
  - "Lazy getSecret() instead of module-level const — allows Vitest to set process.env.JWT_SECRET before tests run"
  - "verifyJWT returns null for expired/tampered tokens rather than throwing — callers get consistent null-check pattern"
  - "Same error message for user-not-found and wrong-password — ASVS V2.1.1 user enumeration prevention (T-18-01)"
  - "authDb.ts: removed PrismaPg/Pool adapters; plain PrismaClient for SQLite built-in provider (Pitfall 2)"
  - ".env is gitignored; JWT_SECRET documented in plan but not committed — generated 64-char hex"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-31"
  tasks_completed: 3
  tasks_total: 3
  files_created: 6
  files_modified: 2
---

# Phase 18 Plan 01: JWT Infrastructure Layer Summary

**One-liner:** JWT sign/verify with jose (HS256 7-day), httpOnly cookie login/logout routes, and pure-jose middleware replacing NextAuth entirely.

---

## Tasks Completed

| Task | Description | Commit | Tests |
|------|-------------|--------|-------|
| 1 | lib/jwt.ts + lib/session.ts + unit tests | 0d270ab | 7/7 |
| 2 | login/logout routes + authDb.ts rewrite + integration tests | f2ee374 | 8/8 |
| 3 | middleware.ts rewrite (pure jose, no next-auth) | 9fd6228 | verified |

---

## What Was Built

### lib/jwt.ts
- `JWTPayload` interface: `userId`, `companyId`, `roleId`, `role` (AUTH-04), `uiMode`, `permissions`
- `signJWT(payload)`: HS256, 7-day expiry using `jose` SignJWT
- `verifyJWT(token)`: returns `JWTPayload | null` — never throws
- `getSecret()` lazy function reads `process.env.JWT_SECRET` at call time (enables test isolation)

### lib/session.ts
- `getSessionFromRequest(request: NextRequest)`: reads `auth-token` cookie from API route requests
- `readSession()`: reads `auth-token` via `next/headers` for Server Components

### app/api/v1/auth/login/route.ts
- Zod validation of `{ email, password }`
- `authDb.user.findFirst({ isActive: true })` — inactive users get same 401 as wrong password
- `bcrypt.compare` timing-safe password verification
- Fetches role name (`role.name`) and permissions for JWT payload (AUTH-04)
- Sets `auth-token` httpOnly, sameSite:lax, maxAge 7 days

### app/api/v1/auth/logout/route.ts
- Sets `auth-token = ""` with `maxAge: 0` to expire the cookie

### lib/authDb.ts (rewritten)
- Removed: `PrismaPg`, `Pool`, `@prisma/adapter-pg` imports
- Replaced with: plain `new PrismaClient()` — SQLite built-in provider needs no driver adapter

### middleware.ts (rewritten)
- `jwtVerify` from `jose` — edge-runtime compatible
- Public paths: `/login`, `/api/v1/auth/login`, `/api/v1/auth/logout`, `/dev`, `/setup`
- Invalid/expired token: same 401/redirect logic as no-token
- Injects `x-company-id`, `x-user-id`, `x-ui-mode` headers on valid token
- Zero imports from `next-auth` or `@/lib/auth`

---

## Test Results

```
lib/jwt.test.ts          7/7 tests passing
tests/auth/login.test.ts 8/8 tests passing
```

Test cases cover:
- Roundtrip sign + verify preserves all payload fields including `role`
- Tampered signature returns null
- Invalid/empty token returns null
- null roleId preserved through roundtrip
- Valid login → 200 + httpOnly Set-Cookie
- Wrong password → 401, no cookie
- Inactive user → 401, no cookie (filtered by `isActive: true` in findFirst)
- Non-existent email → 401, no cookie
- Missing/invalid fields → 400, no cookie

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Module-level JWT secret computation failed in test environment**
- **Found during:** Task 1 — first test run
- **Issue:** `lib/jwt.ts` originally computed `const secret = new TextEncoder().encode(process.env.JWT_SECRET!)` at module load time. Vitest sets `process.env.JWT_SECRET` in `beforeEach`, after module load — so the secret was always empty/zero-length, causing "Zero-length key is not supported" from jose.
- **Fix:** Replaced module-level `secret` constant with a `getSecret()` function that reads `process.env.JWT_SECRET` lazily at call time. This also adds startup validation (throws if secret is absent or < 32 chars).
- **Files modified:** `lib/jwt.ts`
- **Impact:** None on production behavior; secret is still read from env at request time. Adds startup safety check.

**2. [Rule 2 - Security] Comment in middleware.ts contained string "next-auth"**
- **Found during:** Task 3 verification
- **Issue:** A JSDoc comment said "no next-auth imports" — the verification grep matched the comment text.
- **Fix:** Rephrased comment to "using jose directly" — no functional change.
- **Files modified:** `middleware.ts`

### Out of Scope (Pre-existing)

- `app/api/v1/search/route.ts` has TypeScript errors (`mode` not valid in Prisma SQLite StringFilter) — pre-existing from Phase 17 SQLite migration, not caused by this plan. Logged to defer.

---

## Known Stubs

None. All functionality is wired and tested.

---

## Threat Surface Scan

No new network endpoints beyond what was planned. All new surfaces were covered by the plan's threat model:
- `POST /api/v1/auth/login`: T-18-01 (user enumeration), T-18-02 (JWT signing), T-18-03 (httpOnly cookie)
- `POST /api/v1/auth/logout`: cookie-clearing only, no auth required
- `middleware.ts`: T-18-02 (JWT verification), T-18-04 (companyId in payload)

---

## Self-Check: PASSED

Files verified:
- lib/jwt.ts ✓
- lib/session.ts ✓
- lib/jwt.test.ts ✓
- app/api/v1/auth/login/route.ts ✓
- app/api/v1/auth/logout/route.ts ✓
- tests/auth/login.test.ts ✓
- lib/authDb.ts ✓
- middleware.ts ✓

Commits verified:
- 0d270ab (Task 1) ✓
- f2ee374 (Task 2) ✓
- 9fd6228 (Task 3) ✓
