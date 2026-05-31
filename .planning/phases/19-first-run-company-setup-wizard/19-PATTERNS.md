# Phase 19: First-Run Company Setup Wizard — Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 6 new/modified files
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/page.tsx` | route (Server Component guard) | request-response | `app/page.tsx` (current) | exact — same file, modify |
| `app/(auth)/setup/page.tsx` | route (Server Component guard) | request-response | `app/(auth)/login/page.tsx` | role-match — auth-group page |
| `app/(auth)/setup/SetupWizard.tsx` | component (Client Component) | request-response | `app/(auth)/login/page.tsx` | exact — same pattern: `use client`, react-hook-form, zod, fetch, router.push |
| `app/api/v1/setup/route.ts` | controller (API route handler) | CRUD | `app/api/v1/auth/login/route.ts` | exact — same: authDb, signJWT, Set-Cookie, Zod parse |
| `app/api/v1/setup/status/route.ts` | controller (API route handler) | request-response | `app/api/v1/auth/login/route.ts` | role-match — same module, simpler GET-only shape |
| `middleware.ts` | middleware | request-response | `middleware.ts` (current) | exact — same file, add one line |

---

## Pattern Assignments

### `app/page.tsx` (route, request-response) — MODIFY

**Analog:** `app/page.tsx` (current, lines 1–4)

**Current state** (lines 1–4):
```typescript
import { redirect } from 'next/navigation'
export default function RootPage() {
  redirect('/dashboard')
}
```

**Target pattern** — add `authDb` company count check before the session check. Copy the `readSession` + redirect flow from the research pattern (RESEARCH.md Pattern 1):
```typescript
// app/page.tsx — full replacement
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

**Key conventions from existing file:**
- No explicit `async` on current page (will change to `async` — same pattern as login route)
- `redirect()` from `'next/navigation'` — already imported

---

### `app/(auth)/setup/page.tsx` (route, request-response) — NEW

**Analog:** `app/(auth)/login/page.tsx`

**Imports pattern** — Server Component variant (no `'use client'`):
```typescript
import { redirect } from 'next/navigation'
import { authDb } from '@/lib/authDb'
import { SetupWizard } from './SetupWizard'
```

**Core guard pattern** (mirrors login page's auth-group placement — thin wrapper, no logic inside):
```typescript
export default async function SetupPage() {
  const count = await authDb.company.count()
  if (count > 0) redirect('/login')
  return <SetupWizard />
}
```

**No metadata export needed** — login page has none either.

---

### `app/(auth)/setup/SetupWizard.tsx` (component, request-response) — NEW

**Analog:** `app/(auth)/login/page.tsx` (lines 1–174)

**Imports pattern** (lines 1–18 of login page — copy exactly, add `useEffect`):
```typescript
'use client'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
```

**Split-screen layout pattern** (lines 62–95 of login page — copy structure, change text):
```tsx
<div className="flex h-screen">
  {/* LEFT PANEL */}
  <div className="hidden md:flex w-1/2 bg-purple-600 flex-col justify-between p-10">
    <div>
      <span className="text-white text-2xl font-bold">PremGiri Books</span>
    </div>
    <div>
      {/* Change login tagline to setup tagline */}
      <p className="text-white text-xl font-semibold mt-8 max-w-xs leading-snug">
        Welcome to PremGiri Books
      </p>
      <p className="text-sm text-purple-200 mt-2">Let's set up your company</p>
    </div>
    <p className="text-xs text-purple-300">© 2025 PremGiri Books</p>
  </div>

  {/* RIGHT PANEL */}
  <div className="w-full md:w-1/2 bg-white flex items-center justify-center">
    <div className="w-full max-w-sm px-8">
      {/* step indicator above form */}
    </div>
  </div>
</div>
```

**Form field pattern** (lines 103–165 of login page — exact copy, change field names):
```tsx
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
    <FormField
      control={form.control}
      name="companyName"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-sm font-medium text-gray-700">
            Company Name
          </FormLabel>
          <FormControl>
            <Input
              placeholder="Sharma Trading Co."
              className="border-gray-200"
              {...field}
            />
          </FormControl>
          <FormMessage className="text-xs text-red-600" />
        </FormItem>
      )}
    />
    {/* ... more fields following same pattern */}
  </form>
</Form>
```

**Submit + router.push pattern** (lines 35–57 of login page — copy exactly, change endpoint):
```typescript
async function handleAdminSubmit(data: AdminFormData) {
  setIsLoading(true)
  try {
    const res = await fetch('/api/v1/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...companyData, adminPassword: data.adminPassword }),
    })
    if (!res.ok) {
      toast.error('Setup failed. Please try again.', { duration: 4000 })
      return
    }
    router.push('/dashboard')
    router.refresh()
  } finally {
    setIsLoading(false)
  }
}
```

**Loading button pattern** (lines 150–163 of login page — copy exactly):
```tsx
<Button
  type="submit"
  disabled={isLoading}
  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
>
  {isLoading ? (
    <>
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      Setting up...
    </>
  ) : (
    'Complete Setup'
  )}
</Button>
```

**Step state pattern** (no analog in codebase — use research pattern directly):
```typescript
type WizardStep = 'company' | 'admin'
const [step, setStep] = useState<WizardStep>('company')
const [companyData, setCompanyData] = useState<CompanyFormData | null>(null)
```

**GSTIN → stateCode auto-derive** (no analog — use research pattern):
```typescript
const gstin = form.watch('gstin')
useEffect(() => {
  if (gstin && gstin.length >= 2) {
    form.setValue('stateCode', gstin.substring(0, 2))
  }
}, [gstin])
```

---

### `app/api/v1/setup/route.ts` (controller, CRUD) — NEW

**Analog:** `app/api/v1/auth/login/route.ts` (lines 1–84) — strongest analog in codebase

**Imports pattern** (lines 12–16 of login route — copy exactly, add bcrypt and seed import):
```typescript
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { authDb } from '@/lib/authDb'
import { signJWT } from '@/lib/jwt'
import { ACCOUNT_GROUPS } from '@/prisma/seed'
```

**Zod schema pattern** (lines 18–21 of login route — same structure, more fields):
```typescript
const setupSchema = z.object({
  companyName: z.string().min(1).max(200),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).optional().or(z.literal('')),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  stateCode: z.string().length(2),
  fyStart: z.number().int().min(1).max(12).default(4),
  adminPassword: z.string().min(8),
})
```

**JSON parse + safeParse error handling** (lines 23–33 of login route — copy exactly):
```typescript
export async function POST(request: Request) {
  // Setup-specific guard (no analog in login — add before the parse):
  const existing = await authDb.company.count()
  if (existing > 0) {
    return NextResponse.json({ error: 'Setup already complete' }, { status: 409 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = setupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }
```

**signJWT + Set-Cookie pattern** (lines 67–83 of login route — copy exactly, adjust payload):
```typescript
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
```

**$transaction pattern** (no analog in login route — use authDb pattern from research; login uses `authDb.user.findFirst` as the single-model call example):
```typescript
  const result = await authDb.$transaction(async (tx) => {
    const company = await tx.company.create({ data: { ... } })
    const ownerRole = await tx.role.create({ data: { companyId: company.id, name: 'Owner', permissions: {} } })
    await tx.accountGroup.createMany({
      data: ACCOUNT_GROUPS.map(g => ({
        companyId: company.id,
        name: g.name,
        nature: g.nature as 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE',
        affectsGP: g.affectsGP,
        isSystem: true,
      }))
    })
    const user = await tx.user.create({ data: { companyId: company.id, name: 'Administrator', email: 'admin@premgiribooks.com', passwordHash, roleId: ownerRole.id, isActive: true } })
    return { company, ownerRole, user }
  })
```

---

### `app/api/v1/setup/status/route.ts` (controller, request-response) — NEW

**Analog:** `app/api/v1/auth/login/route.ts` — same module, simpler shape

**Full file pattern** (GET-only, no auth required):
```typescript
import { NextResponse } from 'next/server'
import { authDb } from '@/lib/authDb'

export async function GET() {
  const count = await authDb.company.count()
  return NextResponse.json({ setupRequired: count === 0 })
}
```

No Zod, no cookie — follows the same `authDb` + `NextResponse.json` convention, just minimal.

---

### `middleware.ts` (middleware, request-response) — MODIFY

**Analog:** `middleware.ts` (current, lines 25–30)

**Current `isPublicPath` block** (lines 25–30):
```typescript
const isPublicPath =
  pathname.startsWith('/login') ||
  pathname.startsWith('/api/v1/auth/login') ||
  pathname.startsWith('/api/v1/auth/logout') ||
  pathname.startsWith('/dev') ||
  pathname.startsWith('/setup')
```

**Target — add one line at the end of the `||` chain** (line 31, new):
```typescript
const isPublicPath =
  pathname.startsWith('/login') ||
  pathname.startsWith('/api/v1/auth/login') ||
  pathname.startsWith('/api/v1/auth/logout') ||
  pathname.startsWith('/dev') ||
  pathname.startsWith('/setup') ||
  pathname.startsWith('/api/v1/setup')   // ← ADD THIS LINE
```

No other changes to middleware. The `/setup` entry already covers `app/(auth)/setup/page.tsx`; the new entry covers `POST /api/v1/setup` and `GET /api/v1/setup/status`.

---

## Shared Patterns

### authDb Usage
**Source:** `app/api/v1/auth/login/route.ts` (lines 15, 38–47)
**Apply to:** `app/api/v1/setup/route.ts`, `app/api/v1/setup/status/route.ts`, `app/(auth)/setup/page.tsx`, `app/page.tsx`

```typescript
import { authDb } from '@/lib/authDb'
// Use authDb (not prisma) for any operation that runs before or outside a session.
// This bypasses the tenant-scope guard in lib/prisma.ts.
const user = await authDb.user.findFirst({ where: { email, isActive: true } })
```

### JWT Issuance + Cookie
**Source:** `app/api/v1/auth/login/route.ts` (lines 67–83)
**Apply to:** `app/api/v1/setup/route.ts`

```typescript
const token = await signJWT({ userId, companyId, roleId, role, uiMode, permissions })
const response = NextResponse.json({ ok: true })
response.cookies.set('auth-token', token, {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
})
return response
```

### Zod Safeparse + Error Response
**Source:** `app/api/v1/auth/login/route.ts` (lines 18–33)
**Apply to:** `app/api/v1/setup/route.ts`

```typescript
const parsed = setupSchema.safeParse(body)
if (!parsed.success) {
  return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
}
```

### Form Field with react-hook-form
**Source:** `app/(auth)/login/page.tsx` (lines 103–147)
**Apply to:** `app/(auth)/setup/SetupWizard.tsx` — repeat this block for each field

```tsx
<FormField
  control={form.control}
  name="fieldName"
  render={({ field }) => (
    <FormItem>
      <FormLabel className="text-sm font-medium text-gray-700">Label</FormLabel>
      <FormControl>
        <Input placeholder="..." className="border-gray-200" {...field} />
      </FormControl>
      <FormMessage className="text-xs text-red-600" />
    </FormItem>
  )}
/>
```

### Toast Error on Failed Fetch
**Source:** `app/(auth)/login/page.tsx` (lines 44–49)
**Apply to:** `app/(auth)/setup/SetupWizard.tsx`

```typescript
if (!res.ok) {
  toast.error('Incorrect email or password. Please try again.', { duration: 4000 })
  return
}
```

---

## No Analog Found

No files in Phase 19 are without an analog. All files have a direct or role-match equivalent in the existing codebase.

---

## Metadata

**Analog search scope:** `app/`, `app/api/v1/`, `middleware.ts`
**Files read:** `app/api/v1/auth/login/route.ts`, `app/(auth)/login/page.tsx`, `middleware.ts`, `app/page.tsx`
**Pattern extraction date:** 2026-05-31
