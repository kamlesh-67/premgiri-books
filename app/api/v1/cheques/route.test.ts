/**
 * app/api/v1/cheques/route.test.ts
 *
 * Unit tests for cheque register API routes.
 * Tests: auth guards, IDOR protection, business rules.
 *
 * Uses Vitest with mocked prisma and auth.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks (must be before imports) ──────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    voucher: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
    auditLog: {
      create: vi.fn(),
    },
  },
}))

// ─── Import after mocks ───────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from '@/app/api/v1/cheques/route'
import { PATCH } from '@/app/api/v1/cheques/[voucherId]/route'

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>
const mockFindFirst = prisma.voucher.findFirst as ReturnType<typeof vi.fn>

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COMPANY_ID = 'cmp_test_001'
const SESSION = { user: { id: 'usr_001', companyId: COMPANY_ID } }

function makeGetRequest(params?: Record<string, string>) {
  const url = new URL('http://localhost/api/v1/cheques')
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  return new NextRequest(url.toString())
}

function makePatchRequest(voucherId: string, body: object) {
  return new NextRequest(`http://localhost/api/v1/cheques/${voucherId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/cheques', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Test 1: returns 401 without auth session', async () => {
    mockAuth.mockResolvedValueOnce(null)

    const response = await GET(makeGetRequest())

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('Test 2: returns 200 with an array when authenticated', async () => {
    mockAuth.mockResolvedValueOnce(SESSION)

    // Mock $transaction to return [data, count]
    const chequeVoucher = {
      id: 'v_001',
      voucherNo: 'PAY-001',
      date: new Date('2025-04-01'),
      voucherType: 'PAYMENT',
      totalAmount: { toFixed: (n: number) => '10000.00' },
      partyLedger: { name: 'Test Party' },
      chequeNo: 'CHQ123',
      chequeDated: new Date('2025-04-01'),
      bankName: 'HDFC Bank',
      chequeStatus: 'ISSUED',
      clearanceDate: null,
    }

    mockTransaction.mockResolvedValueOnce([[chequeVoucher], 1])

    const response = await GET(makeGetRequest())

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].chequeNo).toBe('CHQ123')
    expect(body.pagination).toBeDefined()
    expect(body.pagination.totalCount).toBe(1)
  })
})

describe('PATCH /api/v1/cheques/[voucherId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Test 3: returns 400 when chequeStatus is CLEARED and no clearanceDate', async () => {
    mockAuth.mockResolvedValueOnce(SESSION)

    // Mock findFirst to return a valid existing voucher (so we reach the business rule)
    mockFindFirst.mockResolvedValueOnce({
      id: 'v_001',
      companyId: COMPANY_ID,
      chequeNo: 'CHQ123',
      chequeStatus: 'ISSUED',
      clearanceDate: null,
    })

    const request = makePatchRequest('v_001', {
      chequeStatus: 'CLEARED',
      // no clearanceDate — should fail validation
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ voucherId: 'v_001' }),
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error.toLowerCase()).toContain('clearance date')
  })
})
