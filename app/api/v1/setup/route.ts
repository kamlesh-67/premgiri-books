/**
 * POST /api/v1/setup
 *
 * First-run setup wizard endpoint. Atomically creates:
 *   1. Company
 *   2. Owner Role
 *   3. 19 system AccountGroups (Chart of Accounts)
 *   4. Admin User (admin@premgiribooks.com)
 *
 * Then issues a NextAuth-compatible session cookie for immediate auto-login.
 *
 * Security:
 *   - Replay guard: returns 409 if any company already exists
 *   - Zod validation on all input fields
 *   - Password stored only as bcrypt hash (12 rounds)
 *   - Uses authDb (un-tenanted) to bypass TenantScopeError before session exists
 *   - Public route — middleware already whitelists /api/v1/setup
 */
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { authDb } from '@/lib/authDb'
import { signJWT, SESSION_COOKIE_NAME } from '@/lib/jwt'

// ─── Owner Permissions ───────────────────────────────────────────────────────
// Compile-time constant: all resources granted to the Owner role at setup.
// Accountant roles created later must use a different permissions object (T-20-01).
const OWNER_PERMISSIONS = {
  vouchers:  ['read', 'write', 'admin'],
  reports:   ['read'],
  masters:   ['read', 'write', 'admin'],
  inventory: ['read', 'write', 'admin'],
  payroll:   ['read', 'write', 'admin'],
  banking:   ['read', 'write', 'admin'],
  gst:       ['read', 'write', 'admin'],
  settings:  ['read', 'admin'],
  users:     ['read', 'admin'],
} as const

// ─── Account Groups (Chart of Accounts seed) ─────────────────────────────────
// These 19 groups form the standard Indian accounting hierarchy (Tally-style).
// All are system groups: isSystem = true prevents user deletion.
// Groups are inserted in topological order (roots first, children after).
const ACCOUNT_GROUPS = [
  // Root groups
  { name: 'Assets',              nature: 'ASSET',     affectsGP: false, parentName: null },
  { name: 'Liabilities',         nature: 'LIABILITY', affectsGP: false, parentName: null },
  { name: 'Income',              nature: 'INCOME',    affectsGP: false, parentName: null },
  { name: 'Expense',             nature: 'EXPENSE',   affectsGP: false, parentName: null },
  // Asset sub-groups
  { name: 'Fixed Assets',        nature: 'ASSET',     affectsGP: false, parentName: 'Assets' },
  { name: 'Current Assets',      nature: 'ASSET',     affectsGP: false, parentName: 'Assets' },
  { name: 'Sundry Debtors',      nature: 'ASSET',     affectsGP: false, parentName: 'Current Assets' },
  { name: 'Bank Accounts',       nature: 'ASSET',     affectsGP: false, parentName: 'Current Assets' },
  { name: 'Cash-in-Hand',        nature: 'ASSET',     affectsGP: false, parentName: 'Current Assets' },
  { name: 'Stock-in-Hand',       nature: 'ASSET',     affectsGP: true,  parentName: 'Current Assets' },
  // Liability sub-groups
  { name: 'Current Liabilities', nature: 'LIABILITY', affectsGP: false, parentName: 'Liabilities' },
  { name: 'Sundry Creditors',    nature: 'LIABILITY', affectsGP: false, parentName: 'Current Liabilities' },
  { name: 'Duties & Taxes',      nature: 'LIABILITY', affectsGP: false, parentName: 'Current Liabilities' },
  { name: 'Capital Account',     nature: 'LIABILITY', affectsGP: false, parentName: 'Liabilities' },
  // Income sub-groups
  { name: 'Direct Income',       nature: 'INCOME',    affectsGP: true,  parentName: 'Income' },
  { name: 'Indirect Income',     nature: 'INCOME',    affectsGP: false, parentName: 'Income' },
  // Expense sub-groups
  { name: 'Direct Expense',      nature: 'EXPENSE',   affectsGP: true,  parentName: 'Expense' },
  { name: 'Indirect Expense',    nature: 'EXPENSE',   affectsGP: false, parentName: 'Expense' },
  { name: 'Purchase Accounts',   nature: 'EXPENSE',   affectsGP: true,  parentName: 'Direct Expense' },
] as const

// ─── Zod Schema ──────────────────────────────────────────────────────────────
const setupSchema = z.object({
  companyName:   z.string().min(1).max(200),
  gstin:         z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .optional()
    .or(z.literal('')),
  pan:           z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .optional()
    .or(z.literal('')),
  address:       z.string().max(500).optional(),
  stateCode:     z.string().length(2),
  fyStart:       z.number().int().min(1).max(12).default(4),
  adminPassword: z.string().min(8),
})

// ─── Handler ─────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  // REPLAY GUARD — return 409 if setup has already been completed (T-19-01)
  const existing = await authDb.company.count()
  if (existing > 0) {
    return NextResponse.json({ error: 'Setup already complete' }, { status: 409 })
  }

  // JSON PARSE
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ZOD PARSE
  const parsed = setupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const {
    companyName,
    gstin,
    pan,
    address,
    stateCode,
    fyStart,
    adminPassword,
  } = parsed.data

  // HASH — bcrypt 12 rounds; raw password never stored (T-19-04)
  const passwordHash = await bcrypt.hash(adminPassword, 12)

  // TRANSACTION — Company + Role + AccountGroups + User in one atomic write
  const result = await authDb.$transaction(async (tx) => {
    // 1. Company
    const company = await tx.company.create({
      data: {
        name: companyName,
        gstin: gstin || null,
        pan: pan || null,
        address: address ?? null,
        stateCode,
        fyStart,
      },
    })

    // 2. Owner Role
    const ownerRole = await tx.role.create({
      data: {
        companyId: company.id,
        name: 'Owner',
        permissions: OWNER_PERMISSIONS,
      },
    })

    // 3. Account Groups — insert roots first, then children in topological order.
    //    Map from group name → DB id so children can reference their parent.
    const groupIdMap = new Map<string, string>()

    for (const g of ACCOUNT_GROUPS) {
      const parentId = g.parentName ? (groupIdMap.get(g.parentName) ?? null) : null
      const created = await tx.accountGroup.create({
        data: {
          companyId: company.id,
          name: g.name,
          nature: g.nature as 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE',
          affectsGP: g.affectsGP,
          isSystem: true,
          parentId,
        },
      })
      groupIdMap.set(g.name, created.id)
    }

    // 4. Admin User (T-19-04: only passwordHash stored, never raw password)
    const user = await tx.user.create({
      data: {
        companyId: company.id,
        name: 'Administrator',
        email: 'admin@premgiribooks.com',
        passwordHash,
        roleId: ownerRole.id,
        isActive: true,
      },
    })

    return { company, ownerRole, user }
  })

  // JWT — sign a NextAuth-compatible session token for immediate auto-login (SETUP-04)
  const token = await signJWT({
    userId: result.user.id,
    companyId: result.company.id,
    roleId: result.ownerRole.id,
    role: 'Owner',
    uiMode: 'simple',
    permissions: OWNER_PERMISSIONS,
  })

  // COOKIE — identical maxAge / sameSite / httpOnly to the login route pattern
  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  return response
}
