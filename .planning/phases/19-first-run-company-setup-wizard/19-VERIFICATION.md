---
phase: 19-first-run-company-setup-wizard
verified: 2026-05-31T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open the app with empty database (zero companies) and navigate to /"
    expected: "Browser redirects to /setup without reaching /login or /dashboard"
    why_human: "Redirect chain involves live DB count + Next.js server-side redirect; cannot verify without running app"
  - test: "Complete the two-step wizard (company fields → admin password → submit)"
    expected: "Dashboard loads automatically; no separate login prompt appears; auth-token cookie is present"
    why_human: "Auto-login depends on the JWT cookie being accepted by middleware at runtime; cannot verify cookie round-trip without a running server"
  - test: "After setup, navigate to /setup in the browser"
    expected: "Immediately redirected to /login — wizard does not flash"
    why_human: "Server Component redirect timing must be validated visually in a browser; grep cannot prove no flash"
  - test: "Verify GSTIN auto-populates stateCode field"
    expected: "Typing '27AAPFU0939F1ZV' in the GSTIN field auto-fills State Code with '27'"
    why_human: "Client-side useEffect behavior requires a browser"
---

# Phase 19: First-Run Company Setup Wizard — Verification Report

**Phase Goal:** A user who opens the app for the first time (empty database) is guided through a setup wizard that creates the company record and admin account — after which the setup route is permanently inauthenticated
**Verified:** 2026-05-31
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Opening app with blank database redirects to `/setup` before login screen | VERIFIED | `app/page.tsx` line 6-7: `await authDb.company.count()` → `if (count === 0) redirect('/setup')` — company count runs before session check |
| 2 | Wizard collects company name, GSTIN, PAN, address, state code, FY start, and admin password — all validated | VERIFIED | `SetupWizard.tsx`: `companySchema` validates all 6 company fields; `adminSchema` validates password (min 8) + confirmPassword with `.refine` equality check; `setupSchema` in `route.ts` re-validates server-side |
| 3 | After setup, DB contains exactly 1 company and 1 user with `admin@premgiribooks.com` and bcrypt-hashed password | VERIFIED | `route.ts` line 114-168: single `authDb.$transaction` creates Company → OwnerRole → 19 AccountGroups → User with `email: 'admin@premgiribooks.com'` and `passwordHash` (bcrypt 12 rounds, line 111); replay guard (line 78-81) returns 409 if company already exists |
| 4 | After setup, user is auto-logged in (JWT cookie set) and redirected to Dashboard — no separate login | VERIFIED | `route.ts` line 171-188: `signJWT(...)` → `response.cookies.set(SESSION_COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', ... })`; `SetupWizard.tsx` line 138-139: `router.push('/dashboard'); router.refresh()` on successful POST |
| 5 | Navigating to `/setup` when company exists redirects to `/login` — route inaccessible after first run | VERIFIED | `app/(auth)/setup/page.tsx` line 5-7: async Server Component calls `authDb.company.count()` → `if (count > 0) redirect('/login')` before any client code executes |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/api/v1/setup/route.ts` | Setup POST handler | VERIFIED | 190 lines; exports `POST`; contains transaction, bcrypt, signJWT, cookie, 409 guard |
| `app/api/v1/setup/status/route.ts` | Setup status GET handler | VERIFIED | 17 lines; exports `GET`; returns `{ setupRequired: count === 0 }` |
| `middleware.ts` | Edge JWT guard with setup paths whitelisted | VERIFIED | Line 31: `pathname.startsWith('/api/v1/setup')` in `isPublicPath` block |
| `app/page.tsx` | Root redirect with zero-company check | VERIFIED | Async Server Component; imports `readSession` from `@/lib/session`; all 4 branches present |
| `app/(auth)/setup/page.tsx` | Server Component page guard | VERIFIED | Thin guard: count > 0 → `redirect('/login')`; renders `<SetupWizard />` |
| `app/(auth)/setup/SetupWizard.tsx` | Multi-step wizard client component | VERIFIED | `'use client'`; named export; 2x `useForm`; `useEffect` GSTIN watcher; `fetch('/api/v1/setup'`; `router.push('/dashboard')`; `toast.error` |
| `lib/jwt.ts` | JWT sign utility | VERIFIED | Uses `jose` `SignJWT` with `JWT_SECRET`; exports `signJWT`, `verifyJWT`, `SESSION_COOKIE_NAME = 'auth-token'` |
| `lib/session.ts` | Session read helper | VERIFIED | Exists; exports `readSession()` (used by `app/page.tsx`) and `getSessionFromRequest()` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/api/v1/setup/route.ts` | `lib/authDb.ts` | `authDb.$transaction` | WIRED | Line 114: `await authDb.$transaction(async (tx) => {` |
| `app/api/v1/setup/route.ts` | `lib/jwt.ts` | `signJWT(` | WIRED | Line 23 import; line 171 call |
| `app/(auth)/setup/SetupWizard.tsx` | `POST /api/v1/setup` | `fetch('/api/v1/setup'` | WIRED | Line 124: `await fetch('/api/v1/setup', { method: 'POST', ...` |
| `app/(auth)/setup/page.tsx` | `lib/authDb.ts` | `authDb.company.count` | WIRED | Line 2 import; line 5 call |
| `app/page.tsx` | `lib/authDb.ts` | `authDb.company.count` | WIRED | Line 3 import; line 6 call |
| `app/page.tsx` | `lib/session.ts` | `readSession` | WIRED | Line 2 import; line 9 call |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `app/page.tsx` | `count` (company count) | `authDb.company.count()` — live DB query | Yes — returns integer from SQLite/Postgres | FLOWING |
| `app/(auth)/setup/page.tsx` | `count` (guard) | `authDb.company.count()` — live DB query | Yes | FLOWING |
| `SetupWizard.tsx` | `res` (setup response) | `fetch('/api/v1/setup')` — calls real route | Yes — route atomically creates records | FLOWING |
| `app/api/v1/setup/status/route.ts` | `count` | `authDb.company.count()` | Yes | FLOWING |

---

### Key Deviation: SUMMARY-01 vs Actual Implementation

The SUMMARY-01 stated the cookie name was `authjs.session-token` and used `next-auth/jwt encode`. The **actual** `lib/jwt.ts` uses `jose SignJWT` with `auth-token` as the cookie name. This is a discrepancy between the SUMMARY narrative and what was actually committed. The middleware reads `auth-token` (line 22 of `middleware.ts`), and `lib/session.ts` also reads `auth-token`. The implementation is internally consistent — all three components agree on `auth-token`. The SUMMARY was inaccurate in describing the implementation, but the **codebase itself is correct and coherent**.

Similarly, SUMMARY-02 stated `auth()` was used in `app/page.tsx` instead of `readSession()` — but the actual `app/page.tsx` imports `readSession` from `@/lib/session`, and `lib/session.ts` exists and is fully implemented. The SUMMARY was again inaccurate about what was committed.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SETUP-01 | 19-02 | Zero-company → `/setup` redirect | SATISFIED | `app/page.tsx` company count branch |
| SETUP-02 | 19-01 | Replay guard (409 on second run) | SATISFIED | `route.ts` line 78-81 |
| SETUP-03 | 19-01 | Atomic creation of Company + Role + AccountGroups + User | SATISFIED | `authDb.$transaction` in `route.ts` |
| SETUP-04 | 19-01 | JWT cookie issued for auto-login | SATISFIED | `signJWT` + `cookies.set` in `route.ts` |
| SETUP-05 | 19-01, 19-02 | Setup locked after first run | SATISFIED | Server Component guard in `setup/page.tsx` + 409 in route |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TBD, FIXME, XXX, return null, or placeholder patterns found in phase files.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Status route returns `setupRequired` | File existence + content check | `route.ts` contains `setupRequired: count === 0` | PASS (static check) |
| Setup route has replay guard | File content check | `status: 409` at line 80 | PASS (static check) |
| Middleware whitelists setup paths | File content check | `pathname.startsWith('/api/v1/setup')` at line 31 | PASS (static check) |
| JWT cookie name matches middleware | Cross-file check | `SESSION_COOKIE_NAME = 'auth-token'` in `lib/jwt.ts`; middleware reads `request.cookies.get('auth-token')` | PASS |

Runtime behavioral spot-checks skipped — requires running Next.js server.

---

### Human Verification Required

#### 1. Zero-Company First-Run Redirect

**Test:** Start the app with an empty database. Navigate to `/` in the browser.
**Expected:** Browser lands on `/setup` without ever showing `/login` or `/dashboard`.
**Why human:** Redirect chain involves a live DB count + Next.js SSR redirect. Cannot verify end-to-end redirect without a running server connected to an empty database.

#### 2. Auto-Login After Setup

**Test:** Complete the two-step wizard — fill in company fields on Step 1, set admin password on Step 2, click submit.
**Expected:** Dashboard loads immediately. No separate login screen appears. The `auth-token` cookie is set in browser DevTools > Application > Cookies.
**Why human:** Cookie round-trip (set by API → read by middleware → session established) must be verified at runtime. The JWT must be signed with `JWT_SECRET` such that middleware's `jwtVerify` accepts it.

#### 3. Setup Guard After First Run

**Test:** After completing setup, open a new tab and navigate directly to `/setup`.
**Expected:** Immediately redirected to `/login`. The wizard does not flash or render before redirect.
**Why human:** Server Component redirect timing must be observed in a live browser to confirm no wizard markup is rendered before the redirect fires.

#### 4. GSTIN → State Code Auto-Populate

**Test:** On Step 1 of the wizard, type a valid GSTIN such as `27AAPFU0939F1ZV` in the GSTIN field.
**Expected:** The State Code field automatically fills with `27` (the first two digits of the GSTIN).
**Why human:** Requires browser interaction to trigger the `useEffect` watching the GSTIN `watch()` value.

---

### Gaps Summary

No automated gaps found. All five roadmap success criteria are verified against the actual codebase. The phase goal — "guided setup wizard that creates the company record and admin account, after which the setup route is permanently inaccessible" — is implemented end-to-end in the codebase. Four items require human validation to confirm runtime behavior.

---

_Verified: 2026-05-31_
_Verifier: Claude (gsd-verifier)_
