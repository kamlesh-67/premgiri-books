/**
 * Integration tests for protected API routes (AUTH-02)
 *
 * Tests:
 *  - getSessionFromRequest returns null for: no cookie, malformed JWT, JWT with wrong secret
 *  - GET /api/v1/vouchers returns 401 when called with no auth-token cookie
 *
 * TDD: The getSessionFromRequest tests will pass immediately (testing lib/session.ts behavior).
 * The voucher route 401 test will pass once Task 2 migrates the route to use getSessionFromRequest.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Set JWT_SECRET before importing any lib module (lazy getSecret() pattern from Plan 01)
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long'

// ─── Mocks ───────────────────────────────────────────────────────────────────
// Mock @prisma/client — prevents Prisma from trying to load the generated client binary
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({})),
  VoucherType: { SALES: 'SALES', PURCHASE: 'PURCHASE', RECEIPT: 'RECEIPT', PAYMENT: 'PAYMENT', JOURNAL: 'JOURNAL', CONTRA: 'CONTRA', CREDIT_NOTE: 'CREDIT_NOTE', DEBIT_NOTE: 'DEBIT_NOTE' },
  VoucherStatus: { DRAFT: 'DRAFT', POSTED: 'POSTED', CANCELLED: 'CANCELLED' },
  Prisma: { Decimal: { prototype: {} } },
}))

// Mock prisma — used by the vouchers GET handler
vi.mock('@/lib/prisma', () => ({
  prisma: {
    voucher: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

// Mock next/headers — used by lib/session.ts readSession
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) }),
}))

// Mock @/lib/auth — prevents next-auth from being imported transitively.
// The vouchers route currently uses auth() from @/lib/auth; after Task 2 this import will be gone.
// The mock ensures the test file can collect regardless of whether migration has happened.
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}))

// ─── Imports (after mocks) ────────────────────────────────────────────────────
import { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { signJWT } from '@/lib/jwt'
import { GET } from '@/app/api/v1/vouchers/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeNextRequest(url: string, cookie?: string): NextRequest {
  const headers = new Headers()
  if (cookie) headers.set('Cookie', cookie)
  // Use NextRequest from next/server — it has the .cookies property
  return new NextRequest(url, { headers })
}

// ─── getSessionFromRequest tests ──────────────────────────────────────────────
describe('getSessionFromRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no auth-token cookie is present', async () => {
    const req = makeNextRequest('http://localhost/api/v1/test')
    const session = await getSessionFromRequest(req)
    expect(session).toBeNull()
  })

  it('returns null when auth-token cookie contains a malformed JWT', async () => {
    const req = makeNextRequest('http://localhost/api/v1/test', 'auth-token=invalid.jwt.token')
    const session = await getSessionFromRequest(req)
    expect(session).toBeNull()
  })

  it('returns null when auth-token is a JWT signed with a different secret', async () => {
    // Sign with a DIFFERENT secret
    const originalSecret = process.env.JWT_SECRET
    process.env.JWT_SECRET = 'different-secret-at-least-32-chars-long!!'
    const badToken = await signJWT({
      userId: 'user-1',
      companyId: 'co-1',
      roleId: null,
      role: 'Admin',
      uiMode: 'simple',
      permissions: {},
    })
    // Restore real secret so verifyJWT uses the original secret
    process.env.JWT_SECRET = originalSecret

    const req = makeNextRequest('http://localhost/api/v1/test', `auth-token=${badToken}`)
    const session = await getSessionFromRequest(req)
    expect(session).toBeNull()
  })
})

// ─── Protected route 401 test ─────────────────────────────────────────────────
// After Task 2: GET /api/v1/vouchers uses getSessionFromRequest instead of auth().
// With no cookie, getSessionFromRequest returns null → route returns 401.
describe('GET /api/v1/vouchers (protected route)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 JSON when called with no auth-token cookie', async () => {
    const req = makeNextRequest('http://localhost/api/v1/vouchers') as unknown as Parameters<typeof GET>[0]
    const response = await GET(req)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toHaveProperty('error')
    expect(body.error).toBeTruthy()
  })
})
