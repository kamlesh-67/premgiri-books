---
phase: "19"
plan: "02"
subsystem: "setup-wizard-frontend"
tags: [setup, wizard, client-component, nextjs, auth, redirect]
dependency_graph:
  requires:
    - "19-01: POST /api/v1/setup route"
    - "lib/auth.ts auth() — NextAuth session"
    - "lib/authDb.ts authDb — un-tenanted PrismaClient"
  provides:
    - "app/page.tsx — async root page: zero-company → /setup, no-session → /login, authenticated → /dashboard"
    - "app/(auth)/setup/page.tsx — Server Component guard: company exists → /login"
    - "app/(auth)/setup/SetupWizard.tsx — two-step wizard client component"
  affects:
    - "First-run user flow: / → /setup → POST /api/v1/setup → /dashboard"
tech_stack:
  added: []
  patterns:
    - "async Server Component with authDb.company.count() before session check"
    - "useForm x2 (companyForm + adminForm) with zodResolver"
    - "useEffect watching GSTIN field to auto-derive stateCode"
    - "Conditional step rendering ('company' | 'admin') with shared split-screen layout"
key_files:
  created:
    - "app/(auth)/setup/page.tsx"
    - "app/(auth)/setup/SetupWizard.tsx"
  modified:
    - "app/page.tsx"
decisions:
  - "Used auth() from lib/auth (NextAuth) instead of readSession() from lib/session — lib/session.ts does not exist; auth() is the established session pattern in the project (used in app/(app)/layout.tsx)"
  - "pnpm build fails on pre-existing TypeScript error in app/api/v1/search/route.ts ('mode' not in StringFilter); out of scope per deviation Rule 3 scope boundary — all three new/modified files pass tsc --noEmit with zero errors"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-31"
  tasks_completed: 3
  files_changed: 3
---

# Phase 19 Plan 02: Setup Wizard Frontend Summary

Multi-step first-run wizard frontend: async root page routing, server-side setup guard, and two-step client wizard — wiring the browser flow from zero-company state to /dashboard via the setup API.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update root page — zero-company redirect | a99f49b | app/page.tsx |
| 2 | Create setup page guard | 64d60e3 | app/(auth)/setup/page.tsx |
| 3 | Create SetupWizard client component | b22693b | app/(auth)/setup/SetupWizard.tsx |

## What Was Built

### app/page.tsx

Replaced the 4-line sync redirect with an async Server Component:
1. `authDb.company.count()` — zero companies → `/setup`
2. `auth()` session check — no session → `/login`
3. Authenticated → `/dashboard`

Satisfies SETUP-01: first-timers always land at /setup before seeing /login.

### app/(auth)/setup/page.tsx

Thin async Server Component guard:
- `authDb.company.count()` — count > 0 → `redirect('/login')` (no wizard flash)
- count === 0 → renders `<SetupWizard />`

Satisfies T-19-05 and T-19-06: post-setup bookmarks to /setup are immediately redirected server-side.

### app/(auth)/setup/SetupWizard.tsx

`'use client'` named export with full two-step flow:

**Step 1 — Company fields:**
- companyName (required), gstin (optional + GSTIN regex), pan (optional + PAN regex), address (optional), stateCode (2-char), fyStart (Select 1-12 with month names)
- GSTIN → stateCode auto-derive: `useEffect` watches `companyForm.watch('gstin')`, calls `setValue('stateCode', gstin.substring(0, 2))` when length >= 2
- Submit advances to Step 2 (no API call yet)

**Step 2 — Admin account:**
- adminPassword (min 8), confirmPassword with `.refine` equality check
- Fixed email hint: "Email: admin@premgiribooks.com (fixed)"
- Back button to return to Step 1
- Submit: `fetch('POST /api/v1/setup', { ...companyData, adminPassword })` → `router.push('/dashboard')` on success, `toast.error` on non-ok

Layout mirrors login page: split-screen `flex h-screen`, purple-600 left panel, white right panel with `w-full max-w-sm px-8` inner container.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] readSession() does not exist — used auth() instead**
- **Found during:** Task 1
- **Issue:** Plan's `<interfaces>` references `readSession()` from `@/lib/session` (described as a Phase 18 utility). `lib/session.ts` does not exist in the codebase. The project uses `auth()` from `@/lib/auth` (NextAuth) for server-side session reads — confirmed in `app/(app)/layout.tsx`.
- **Fix:** Import `auth` from `@/lib/auth` and call `await auth()` in place of `readSession()`. The contract is identical: returns null when unauthenticated, returns session object when authenticated.
- **Files modified:** `app/page.tsx`
- **Commit:** a99f49b

## Known Stubs

None. All three files are fully wired:
- Root page reads from DB and redirects — no stub
- Setup page guard reads from DB and redirects — no stub
- SetupWizard posts to `/api/v1/setup` (provided by Plan 01) — no stub

## Threat Flags

None. No new trust boundaries beyond those specified in the plan's threat model. Server Component guards enforce T-19-05 and T-19-06.

## Self-Check: PASSED

- [x] `app/page.tsx` contains `authDb.company.count()`, `redirect('/setup')`, `auth()`, `redirect('/login')`, `redirect('/dashboard')` — verified
- [x] `app/(auth)/setup/page.tsx` contains `authDb.company.count()`, `redirect('/login')`, `SetupWizard` — verified
- [x] `app/(auth)/setup/SetupWizard.tsx` — begins with `'use client'`, named export, 2x `useForm`, `useEffect` + `gstin.substring(0, 2)`, `fetch('/api/v1/setup'`, `router.push('/dashboard')`, `router.refresh()`, `toast.error`, `type="password"` x2, `.refine` — verified
- [x] tsc --noEmit on setup files: 0 errors — verified
- [x] All 3 tasks committed: a99f49b, 64d60e3, b22693b — verified
