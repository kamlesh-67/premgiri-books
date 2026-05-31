# Phase 19: First-Run Company Setup Wizard — Research

**Researched:** 2026-05-31
**Domain:** Next.js 15 App Router · Prisma SQLite · JWT auth · multi-step wizard form
**Confidence:** HIGH

---

## Summary

Phase 19 adds a first-run setup wizard that fires when the SQLite database has zero company rows. The wizard collects company fields and an admin password, writes one Company + one Role + one User inside a single Prisma `$transaction`, issues a JWT cookie (exactly like the login route already does), and redirects to Dashboard. After the first run, `/setup` permanently redirects to `/login`.

The Phase 18 auth infrastructure is fully ready for reuse: `signJWT`, the `auth-token` httpOnly cookie pattern, and `authDb` (the un-tenanted PrismaClient) are exactly what the setup needs. The `lib/prisma.ts` tenant-guard extension would throw a `TenantScopeError` on `User.create` without a companyId in scope, so all setup DB writes must use `authDb`.

The most important architectural decision is **how middleware detects "zero companies"**. Next.js Edge Middleware cannot use Prisma (Edge runtime has no Node.js APIs). The correct pattern is to handle the redirect in the root `app/page.tsx` Server Component — which runs in the Node.js runtime and can call `authDb.company.count()` directly. A `/api/v1/setup/status` route also provides a stable contract for the wizard page guard and future Playwright tests.

**Primary recommendation:** Root page (Server Component) handles the SETUP-01 redirect via direct DB count. Setup page is a thin Server Component wrapper (redirects to /login if setup done) that renders a Client Component wizard. API route uses `authDb.$transaction` and reuses `signJWT` identically to the login route. No new packages required.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Detect zero-companies on app open | Frontend Server (SSR) | — | Root `app/page.tsx` Server Component calls `authDb.company.count()` directly — no Edge, no HTTP self-fetch needed |
| Block `/setup` once setup complete | Frontend Server (SSR) | API / Backend | Page-level Server Component check prevents flash; API guard prevents replay |
| Wizard form state across two steps | Browser / Client | — | Local `useState` — no server round-trip between steps |
| Company + Role + User creation | API / Backend | — | Single `authDb.$transaction` in POST `/api/v1/setup` |
| Account group seeding | API / Backend | — | Called inside same transaction; `ACCOUNT_GROUPS` constant already exported from `prisma/seed.ts` |
| Auto-login after setup | API / Backend | — | `signJWT()` + `Set-Cookie: auth-token` in same response as creation — identical to login route |
| Setup status probe | API / Backend | — | `GET /api/v1/setup/status` returns `{ setupRequired: boolean }` — consumed by wizard guard and tests |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SETUP-01 | Zero companies → redirect to `/setup` before login screen | Root `app/page.tsx` Server Component: `authDb.company.count() === 0` → `redirect('/setup')` |
| SETUP-02 | Wizard collects company name, GSTIN, PAN, address, state code, FY start | All fields map directly to existing `Company` model — no schema change needed |
| SETUP-03 | Admin account: `admin@premgiribooks.com` + user-set password, bcrypt-hashed | `bcrypt.hash(password, 12)` + `authDb.user.create()` inside `$transaction`; Owner role created in same transaction |
| SETUP-04 | Auto-login after setup, redirect to Dashboard | `signJWT({userId, companyId, roleId, role:'Owner', ...})` + `Set-Cookie: auth-token` in POST `/api/v1/setup` response; client calls `router.push('/dashboard')` |
| SETUP-05 | `/setup` inaccessible once company exists → redirect to `/login` | Setup `page.tsx` Server Component: `authDb.company.count() > 0` → `redirect('/login')`; POST `/api/v1/setup` returns 409 if company exists |
</phase_requirements>

---

## Standard Stack

### Core — All Already Installed, No New Packages Needed

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-hook-form` | already in project | Multi-step wizard form state | Already used in login page (`app/(auth)/login/page.tsx`) |
| `@hookform/resolvers` | already in project | Zod schema integration | Already used in login page |
| `zod` | already in project | Setup input validation | CLAUDE.md mandates Zod on all API inputs |
| `bcryptjs` | already in project | Hash admin password | Already installed in Phase 18; same usage pattern |
| `jose` | already in project | JWT signing via `lib/jwt.ts` | Already installed in Phase 18 |
| `sonner` | already in project | Toast error notifications | Already used in login page |
| `shadcn/ui` | already in project | Form, Input, Button components | CLAUDE.md: Tailwind + shadcn/ui ONLY |

[VERIFIED: codebase — all of the above are already imported and used in `app/(auth)/login/page.tsx` and `app/api/v1/auth/login/route.ts`]

**No new packages required for Phase 19.**

### Package Legitimacy Audit

No new packages are introduced in Phase 19. All dependencies are already present and were vetted in earlier phases. This section is not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
FIRST LAUNCH (blank DB)
  Browser GET /
    → app/page.tsx (Server Component)
        authDb.company.count() === 0
        → redirect('/setup')

  Browser GET /setup
    → app/(auth)/setup/page.tsx (Server Component)
        authDb.company.count() === 0  [guard — allow]
        → render <SetupWizard />

  SetupWizard (Client Component)
    Step 1: Company fields (local useState)
    Step 2: Admin password
    Submit → POST /api/v1/setup
                ├─ count > 0? → 409 Conflict
                ├─ Zod parse body
                ├─ authDb.$transaction([
                │     company.create(companyFields)
                │     role.create({ name:'Owner', companyId })
                │     accountGroup.createMany(ACCOUNT_GROUPS, companyId)
                │     user.create({ email:'admin@premgiribooks.com', passwordHash, roleId, companyId })
                │  ])
                ├─ signJWT({ userId, companyId, roleId, role:'Owner', ... })
                └─ Set-Cookie: auth-token → { ok: true }
    router.push('/dashboard')

SUBSEQUENT LAUNCHES (company exists)
  Browser GET /
    → app/page.tsx → count > 0, readSession() → has session → redirect('/dashboard')
                                               → no session  → redirect('/login')

  Browser GET /setup
    → app/(auth)/setup/page.tsx
        authDb.company.count() > 0
        → redirect('/login')

  POST /api/v1/setup (replay attempt)
    → 409 Conflict { error: 'Setup already complete' }
```

### Recommended Project Structure

```
app/
├── page.tsx                          ← Root redirect (Server Component) — modified
├── (auth)/
│   ├── login/
│   │   └── page.tsx                  ← Existing (no changes)
│   └── setup/
│       ├── page.tsx                  ← Server Component wrapper (guard + render wizard)
│       └── SetupWizard.tsx           ← 'use client' multi-step wizard
app/api/v1/
└── setup/
    ├── route.ts                      ← POST: create company+role+user+groups, issue JWT
    └── status/
        └── route.ts                  ← GET: { setupRequired: boolean }
```

### Pattern 1: Root Page Redirect (SETUP-01)

The root `app/page.tsx` is a Server Component running in the Node.js runtime. It can call `authDb.company.count()` directly — no HTTP self-fetch needed. This is simpler and faster than a fetch round-trip.

```typescript
// app/page.tsx
import { redirect } from 'next/navigation'
import { readSession } from '@/lib/session'
import { authDb } from '@/lib/authDb'

export default async function RootPage() {
  const count = await authDb.company.count()
  if (count === 0) redirect('/setup')

  const session = await readSession()
  if (!session) redirect('/login')
  redirect('/dashboard')
}
```

[ASSUMED: `authDb.company.count()` works in a Next.js 15 Server Component with SQLite — consistent with how login route uses `authDb.user.findFirst()`; no reason to expect different behavior for `count()`]

### Pattern 2: Setup Page Guard (SETUP-05 prevention)

The setup page is a thin Server Component that checks the company count before rendering the wizard. This prevents the client-side wizard from flashing before a redirect.

```typescript
// app/(auth)/setup/page.tsx
import { redirect } from 'next/navigation'
import { authDb } from '@/lib/authDb'
import { SetupWizard } from './SetupWizard'

export default async function SetupPage() {
  const count = await authDb.company.count()
  if (count > 0) redirect('/login')
  return <SetupWizard />
}
```

### Pattern 3: Multi-Step Wizard (Client Component)

Two logical steps with local `useState`. No URL-based step routing — avoids bookmarkable half-setup states.

```typescript
// app/(auth)/setup/SetupWizard.tsx
'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'

type WizardStep = 'company' | 'admin'

// Step 1 data retained in parent state until Step 2 submits both together
interface CompanyFormData { companyName: string; gstin?: string; pan?: string; address?: string; stateCode: string; fyStart: number }
interface AdminFormData { adminPassword: string; confirmPassword: string }

export function SetupWizard() {
  const [step, setStep] = useState<WizardStep>('company')
  const [companyData, setCompanyData] = useState<CompanyFormData | null>(null)
  const router = useRouter()

  function handleCompanyNext(data: CompanyFormData) {
    setCompanyData(data)
    setStep('admin')
  }

  async function handleAdminSubmit(data: AdminFormData) {
    const res = await fetch('/api/v1/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...companyData, adminPassword: data.adminPassword }),
    })
    if (!res.ok) { /* toast error */ return }
    router.push('/dashboard')
    router.refresh()
  }

  return step === 'company'
    ? <CompanyForm onNext={handleCompanyNext} />
    : <AdminForm onSubmit={handleAdminSubmit} onBack={() => setStep('company')} />
}
```

### Pattern 4: Setup API Route (SETUP-02, SETUP-03, SETUP-04)

Uses `authDb` — not the tenant-extended `prisma` — for the same reason the login route does. Signs a JWT at the end exactly like the login route.

```typescript
// app/api/v1/setup/route.ts
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { authDb } from '@/lib/authDb'
import { signJWT } from '@/lib/jwt'
import { ACCOUNT_GROUPS } from '@/prisma/seed'

const setupSchema = z.object({
  companyName: z.string().min(1).max(200),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).optional().or(z.literal('')),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  stateCode: z.string().length(2),
  fyStart: z.number().int().min(1).max(12).default(4),
  adminPassword: z.string().min(8),
})

export async function POST(request: Request) {
  // Guard: reject replay
  const existing = await authDb.company.count()
  if (existing > 0) {
    return NextResponse.json({ error: 'Setup already complete' }, { status: 409 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = setupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { adminPassword, companyName, gstin, pan, address, stateCode, fyStart } = parsed.data
  const passwordHash = await bcrypt.hash(adminPassword, 12)

  const result = await authDb.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name: companyName, gstin: gstin || null, pan: pan || null, address, stateCode, fyStart }
    })
    const ownerRole = await tx.role.create({
      data: { companyId: company.id, name: 'Owner', permissions: {} }
    })
    await tx.accountGroup.createMany({
      data: ACCOUNT_GROUPS.map(g => ({
        companyId: company.id,
        name: g.name,
        nature: g.nature as 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE',
        affectsGP: g.affectsGP,
        isSystem: true,
      }))
    })
    const user = await tx.user.create({
      data: {
        companyId: company.id,
        name: 'Administrator',
        email: 'admin@premgiribooks.com',
        passwordHash,
        roleId: ownerRole.id,
        isActive: true,
      }
    })
    return { company, ownerRole, user }
  })

  const token = await signJWT({
    userId: result.user.id,
    companyId: result.company.id,
    roleId: result.ownerRole.id,
    role: 'Owner',
    uiMode: 'simple',
    permissions: {},
  })

  const response = NextResponse.json({ ok: true })
  response.cookies.set('auth-token', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  return response
}
```

### Pattern 5: Setup Status Route

Consumed by the wizard page guard (if needed client-side) and Playwright tests.

```typescript
// app/api/v1/setup/status/route.ts
import { NextResponse } from 'next/server'
import { authDb } from '@/lib/authDb'

export async function GET() {
  const count = await authDb.company.count()
  return NextResponse.json({ setupRequired: count === 0 })
}
```

### Pattern 6: Middleware Update (SETUP-01 API routes)

The current `middleware.ts` already lists `/setup` as a public path. The new `/api/v1/setup` API routes need to be added to `isPublicPath`:

```typescript
// middleware.ts — isPublicPath addition
const isPublicPath =
  pathname.startsWith('/login') ||
  pathname.startsWith('/api/v1/auth/login') ||
  pathname.startsWith('/api/v1/auth/logout') ||
  pathname.startsWith('/dev') ||
  pathname.startsWith('/setup') ||
  pathname.startsWith('/api/v1/setup')   // ← ADD THIS
```

[VERIFIED: codebase — `middleware.ts` line 28 shows current public paths; `/api/v1/setup` is not yet listed]

### Pattern 7: UI Layout

Mirror the login page split-screen exactly (purple left panel + white right panel). The wizard sits inside the right panel. Use a simple "Step 1 of 2" text indicator above the form — not a progress bar component, to keep it minimal.

The left panel content should differ from login: instead of "Sign in to your account", use "Welcome to PremGiri Books" + "Let's set up your company" subtitle.

### Anti-Patterns to Avoid

- **Calling Prisma in `middleware.ts`:** Edge runtime has no Node.js API access. The current middleware correctly avoids DB calls. Do not add `authDb` or `prisma` imports to `middleware.ts`.
- **Using the tenant-extended `prisma` for setup writes:** `lib/prisma.ts` will throw `TenantScopeError` on `User.create` and `Role.create` operations that lack `companyId` in `where`. Use `authDb` for the entire setup transaction.
- **URL-based step routing (`/setup/step-1`, `/setup/step-2`):** Creates bookmarkable half-setup states. Use local React state for step tracking.
- **Separate login step after setup:** SETUP-04 explicitly requires auto-login. Issuing the JWT in the setup API response and having the client redirect directly to Dashboard satisfies this without a separate login page visit.
- **Using `prisma/seed.ts` main() function to seed account groups:** The seed script's `main()` runs as a standalone script. Instead, import the exported `ACCOUNT_GROUPS` array and call `tx.accountGroup.createMany()` inside the setup transaction.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom hash function | `bcrypt.hash(password, 12)` — bcryptjs already installed | Same pattern as login route; bcrypt handles salt automatically |
| JWT issuance | Custom token format | `signJWT()` from `lib/jwt.ts` | Built in Phase 18; identical payload shape; already handles secret validation |
| Form validation (client) | Manual `if` checks | `react-hook-form` + `zodResolver` | Already used in login page; gives inline error messages for free |
| Input validation (server) | Manual type narrowing | Zod schema `setupSchema.safeParse(body)` | CLAUDE.md mandates Zod on all API inputs |
| DB transaction | Manual try/catch/rollback | `authDb.$transaction(async tx => {...})` | Prisma handles SQLite serialized transactions; automatic rollback on error |
| Account group data | Inline definition in setup route | Import `ACCOUNT_GROUPS` from `prisma/seed.ts` | Already defined and exported there; seed.ts comment says Phase 19 will use it |

**Key insight:** Phase 18 built exactly the right primitives. Phase 19 is pure composition — `authDb` + `signJWT` + `bcrypt.hash` + `react-hook-form/zod` — no new infrastructure needed.

---

## Common Pitfalls

### Pitfall 1: Using `prisma` (tenant-extended client) for Setup Writes

**What goes wrong:** `TenantScopeError` is thrown at runtime when `user.create` or `role.create` is called, because `lib/prisma.ts` guards these models and requires `companyId` in `where` — but during creation there is no `where` clause.

**Why it happens:** `lib/prisma.ts` includes `User` and `Role` in `TENANT_SCOPED_MODELS`. The guard fires on `findMany`, `findFirst`, `update`, `delete` operations — but the pattern for create calls varies. More importantly, the setup transaction runs before any session exists, so even if the guard were bypassed, there is no `companyId` in the request context.

**How to avoid:** Use `authDb` (from `lib/authDb.ts`) for the entire `$transaction`. The authDb comment says "DO NOT use authDb for any other purpose" — but setup is the same category of exception as login: a pre-session DB operation.

**Warning signs:** `[TenantScopeError] User.create called without companyId` in the server logs during setup submission.

### Pitfall 2: Forgetting to Add `/api/v1/setup` to Middleware Public Paths

**What goes wrong:** POST `/api/v1/setup` returns `{ error: 'Unauthorized' }` with status 401, even though the user is on the setup page with no auth cookie yet.

**Why it happens:** `middleware.ts` blocks all `/api/` paths for unauthenticated requests unless the path is in `isPublicPath`. The current list includes `/setup` (page) but not `/api/v1/setup` (API routes).

**How to avoid:** Add `pathname.startsWith('/api/v1/setup')` to the `isPublicPath` check in `middleware.ts`.

**Warning signs:** Network tab in devtools shows 401 on the setup POST.

### Pitfall 3: GSTIN / State Code Derivation

**What goes wrong:** User enters a GSTIN but leaves state code blank, or enters a mismatched state code — downstream GST calculation (CGST+SGST vs IGST) uses the wrong state.

**Why it happens:** Two separate fields representing overlapping information.

**How to avoid:** In the client component, auto-derive `stateCode` from the first 2 digits of GSTIN when GSTIN is provided. Show the state code field as editable but pre-filled:

```typescript
// In CompanyForm, watch gstin field:
const gstin = form.watch('gstin')
useEffect(() => {
  if (gstin && gstin.length >= 2) {
    form.setValue('stateCode', gstin.substring(0, 2))
  }
}, [gstin])
```

**Warning signs:** First Sales Invoice incorrectly uses IGST instead of CGST+SGST (or vice versa).

### Pitfall 4: `ACCOUNT_GROUPS` Import Type Mismatch

**What goes wrong:** TypeScript error on `accountGroup.createMany` because `nature` in the `ACCOUNT_GROUPS` array is typed as `string` but Prisma expects the `AccountNature` enum.

**Why it happens:** `prisma/seed.ts` defines `ACCOUNT_GROUPS` with `nature: 'LIABILITY'` as a plain string literal, not typed against the Prisma enum.

**How to avoid:** Cast explicitly in the `createMany` call:

```typescript
data: ACCOUNT_GROUPS.map(g => ({
  companyId: company.id,
  name: g.name,
  nature: g.nature as 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE',
  affectsGP: g.affectsGP,
  isSystem: true,
}))
```

**Warning signs:** TypeScript compile error `Type 'string' is not assignable to type 'AccountNature'` on the createMany call.

### Pitfall 5: `router.refresh()` Timing After Auto-Login

**What goes wrong:** Dashboard page loads but still shows the unauthenticated state briefly, or middleware redirects back to login before the cookie is visible.

**Why it happens:** The `auth-token` cookie is set by the server response. `router.push('/dashboard')` fires before the browser has processed the Set-Cookie header on the fetch response.

**How to avoid:** The `fetch` API processes Set-Cookie on the response — the cookie is available before `router.push` is called because `await fetch(...)` resolves only after the full response (including headers) is received. The same pattern works in the login page. `router.refresh()` after `router.push` ensures the Server Component re-reads the new cookie.

**Warning signs:** Only occurs if using streaming or other patterns that differ from the simple `await fetch().then(router.push)` chain used in the login page.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `authDb.company.count()` works in a Next.js 15 Server Component running against SQLite | Architecture Patterns — Pattern 1 | Root redirect fails; would need to use `GET /api/v1/setup/status` fetch instead |
| A2 | `router.push('/dashboard')` after `await fetch('/api/v1/setup')` correctly carries the Set-Cookie auth-token | Pitfall 5 | User lands on Dashboard but gets redirected back to /login; fix is to add `router.refresh()` |

---

## Open Questions

1. **Should account groups be seeded inside the setup transaction?**
   - What we know: `prisma/seed.ts` already exports `ACCOUNT_GROUPS`; the seed script's `main()` comment says "Company-level seed runs post first-run wizard (Phase 19)"
   - What's unclear: Whether the planner wants account groups seeded atomically in the setup transaction, or in a follow-up step after setup
   - Recommendation: Seed them atomically inside the `$transaction` — if the transaction rolls back, the account groups are also rolled back, keeping the DB clean. This is the correct approach.

2. **What permissions object should the Owner role have at Phase 19?**
   - What we know: `roles.permissions` is `Json`; Phase 20 will formalize the permissions schema for Owner vs Accountant
   - What's unclear: Whether Phase 19 should seed a partial permissions object or an empty `{}`
   - Recommendation: Use `{}` (empty object) for Phase 19. Phase 20 will populate it when User Management is built. The JWT `role: 'Owner'` string is what matters for Phase 19's Dashboard access.

3. **Should the setup wizard collect a company logo URL?**
   - What we know: `Company.logoUrl` is an optional field in the schema
   - What's unclear: The requirements (SETUP-02) don't mention logo upload
   - Recommendation: Skip logo for Phase 19. The field can remain null; Settings page (Phase 20/21) can add logo upload later.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js runtime | Yes | v24.15.0 | — |
| Prisma SQLite | `authDb.$transaction` | Yes | already configured (Phase 17/18) | — |
| bcryptjs | Password hashing | Yes | already installed (Phase 18) | — |
| jose | JWT signing | Yes | already installed (Phase 18) | — |

No missing dependencies.

---

## Validation Architecture

> `workflow.nyquist_validation` not explicitly set to false — including this section.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| SETUP-01 | Zero companies → redirect to /setup | Integration / E2E | Playwright: navigate to `/` with empty DB | Requires seeded empty DB fixture |
| SETUP-02 | Form validation: GSTIN regex, PAN regex, stateCode length | Unit | `vitest tests/setup/validation.test.ts` | Test Zod schema directly |
| SETUP-03 | DB has 1 company, 1 role, 1 user after setup | Integration | `vitest tests/setup/api.test.ts` | Uses `authDb` directly against test DB |
| SETUP-04 | Response sets auth-token cookie, client reaches /dashboard | Integration | `vitest tests/setup/api.test.ts` | Check Set-Cookie header in response |
| SETUP-05 | /setup redirects to /login when company exists | Integration / E2E | Playwright: navigate to `/setup` with seeded company | |

> Note: Testing is deferred per REQUIREMENTS.md — "Vitest/Playwright test suite — deferred until Electron migration stabilises". The test map is provided for completeness but Wave 0 gaps are not blocking.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | bcrypt(12) password hash; same pattern as login route |
| V3 Session Management | Yes | httpOnly JWT cookie; 7-day expiry; identical to login |
| V4 Access Control | Yes | Setup route is public; POST /api/v1/setup checks company count before any write |
| V5 Input Validation | Yes | Zod `setupSchema` parses all fields before any DB operation |
| V6 Cryptography | No | bcrypt and jose handle all crypto; nothing custom |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Setup replay (POST /api/v1/setup after company exists) | Tampering | `authDb.company.count() > 0` → 409 at the start of the POST handler |
| Weak admin password | Elevation of Privilege | Zod: `z.string().min(8)` — enforced at API level; client-side label warns user |
| GSTIN enumeration (attacker learns valid GSTIN format) | Information Disclosure | Not a meaningful threat for a local desktop app with a single admin user |
| Accessing setup page after setup | Elevation of Privilege | Server Component page guard: `count > 0 → redirect('/login')` before wizard renders |

---

## Sources

### Primary (HIGH confidence)
- Codebase: `lib/jwt.ts`, `lib/session.ts`, `lib/authDb.ts`, `lib/prisma.ts` — verified exact API signatures and patterns
- Codebase: `app/api/v1/auth/login/route.ts` — verified JWT issuance and Set-Cookie pattern to replicate
- Codebase: `app/(auth)/login/page.tsx` — verified UI pattern (split-screen, react-hook-form + zod) to mirror
- Codebase: `middleware.ts` — verified current public paths list; confirmed `/api/v1/setup` is absent
- Codebase: `prisma/schema.prisma` — verified Company, User, Role, AccountGroup model fields; confirmed all SETUP-02 fields exist
- Codebase: `prisma/seed.ts` — verified `ACCOUNT_GROUPS` is exported and ready to import in setup route

### Secondary (MEDIUM confidence)
- Next.js App Router docs pattern: Server Components calling Prisma directly (no HTTP self-fetch needed)
- Prisma interactive transactions (`$transaction(async tx => {...})`) — standard pattern for atomic multi-model writes

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already in the codebase, no new dependencies
- Architecture: HIGH — patterns directly derived from Phase 18 login route; Server Component + client wizard is standard Next.js 15 App Router
- Pitfalls: HIGH — TenantScopeError and middleware public path issues confirmed by reading actual source code
- Validation: MEDIUM — test patterns documented but test suite is deferred per project requirements

**Research date:** 2026-05-31
**Valid until:** 2026-08-31 (stable stack; no fast-moving dependencies)
