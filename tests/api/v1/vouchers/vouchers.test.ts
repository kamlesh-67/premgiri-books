/**
 * tests/api/v1/vouchers/vouchers.test.ts
 *
 * Integration tests for voucher API routes.
 * Uses mocked auth, prisma, and VoucherEngine — no real DB connection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks (must be before imports) ──────────────────────────────────────────

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

vi.mock('@/lib/services/VoucherEngine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/VoucherEngine')>()
  return {
    ...actual,
    createVoucher: vi.fn(),
    cancelVoucher: vi.fn(),
    postVoucher: vi.fn(),
    resolveTdsPayableLedger: vi.fn(),
    buildPaymentEntries: vi.fn().mockReturnValue([]),
    buildReceiptEntries: vi.fn().mockReturnValue([]),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    voucher: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    ledger: { findFirst: vi.fn() },
  },
}))

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createVoucher, cancelVoucher, ValidationError } from '@/lib/services/VoucherEngine'
import { GET, POST } from '@/app/api/v1/vouchers/route'
import { GET as GETById, PATCH } from '@/app/api/v1/vouchers/[id]/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPANY_ID = 'cmp-test-001'
const SESSION = {
  user: {
    id: 'usr-test-001',
    companyId: COMPANY_ID,
    name: 'Test User',
    email: 'test@example.com',
    stateCode: '29',
  },
}

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockCreateVoucher = createVoucher as ReturnType<typeof vi.fn>
const mockCancelVoucher = cancelVoucher as ReturnType<typeof vi.fn>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeListRequest(searchParams?: Record<string, string>) {
  const url = new URL('http://localhost/api/v1/vouchers')
  if (searchParams) Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url, { method: 'GET' })
}

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/v1/vouchers', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// CUIDs — must be valid CUID v1 strings (Prisma cuid() format)
const CUID_PARTY   = 'cjld2cyuq0000t3rmniod1foy'
const CUID_ITEM    = 'cjld2cyuq0001t3rmnj1d2foy'
const CUID_GODOWN  = 'cjld2cyuq0002t3rmnk2d3foy'

const VALID_SALES_BODY = {
  voucherType: 'SALES',
  date: '2025-04-07',
  partyLedgerId: CUID_PARTY,
  items: [
    {
      itemId: CUID_ITEM,
      godownId: CUID_GODOWN,
      qty: '5',
      rate: '1000',
      discountPct: '0',
      hsnCode: '1234',
    },
  ],
}

// ─── Mock voucher for list response ───────────────────────────────────────────

const mockVoucherListItem = {
  id: 'v-001',
  voucherNo: 'SI-2024-25-0001',
  voucherType: 'SALES',
  status: 'POSTED',
  date: new Date('2025-04-07'),
  totalAmount: { toString: () => '5900' },
  cgstAmount: { toString: () => '450' },
  sgstAmount: { toString: () => '450' },
  igstAmount: { toString: () => '0' },
  roundOff: { toString: () => '0' },
  partyLedger: null,
  billRefs: [],
}

// ─── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue(null) // unauthenticated by default
})

// ─── POST /api/v1/vouchers ────────────────────────────────────────────────────

describe('POST /api/v1/vouchers', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await POST(makePostRequest(VALID_SALES_BODY))
    expect(res.status).toBe(401)
  })

  it('returns 400 when Zod validation fails (missing voucherType)', async () => {
    mockAuth.mockResolvedValue(SESSION)
    const res = await POST(makePostRequest({ date: '2025-04-07' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/validation/i)
  })

  it('returns 422 when VoucherEngine throws ValidationError (unbalanced DR/CR)', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockCreateVoucher.mockRejectedValue(new ValidationError("Your entries don't balance"))
    const res = await POST(makePostRequest(VALID_SALES_BODY))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toContain("balance")
  })

  it('returns 201 with { id, voucherNo } on successful SALES voucher', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockCreateVoucher.mockResolvedValue({ id: 'v-001', voucherNo: 'SI-2024-25-0001' })
    const res = await POST(makePostRequest(VALID_SALES_BODY))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('v-001')
    expect(body.voucherNo).toBe('SI-2024-25-0001')
  })

  it('companyId in createVoucher call always comes from session, not body', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockCreateVoucher.mockResolvedValue({ id: 'v-001', voucherNo: 'SI-2024-25-0001' })
    // Even if body contained a companyId field, session.user.companyId must be used
    const bodyWithInjectedCompany = { ...VALID_SALES_BODY, companyId: 'evil-company-999' }
    await POST(makePostRequest(bodyWithInjectedCompany))
    // createVoucher is called with session — companyId injection via body is ignored
    expect(mockCreateVoucher).toHaveBeenCalledWith(
      expect.not.objectContaining({ companyId: 'evil-company-999' }),
      expect.objectContaining({ user: expect.objectContaining({ companyId: COMPANY_ID }) })
    )
  })
})

// ─── GET /api/v1/vouchers ─────────────────────────────────────────────────────

describe('GET /api/v1/vouchers', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await GET(makeListRequest())
    expect(res.status).toBe(401)
  })

  it('returns 200 with voucher array when authenticated', async () => {
    mockAuth.mockResolvedValue(SESSION)
    ;(prisma.voucher.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockVoucherListItem])
    const res = await GET(makeListRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.data ?? body)).toBe(true)
  })

  it('filters by status param — only POSTED vouchers returned', async () => {
    mockAuth.mockResolvedValue(SESSION)
    const mockFindMany = prisma.voucher.findMany as ReturnType<typeof vi.fn>
    mockFindMany.mockResolvedValue([])
    await GET(makeListRequest({ status: 'POSTED' }))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'POSTED', companyId: COMPANY_ID }),
      })
    )
  })

  it('companyId is always from session — never from query params', async () => {
    mockAuth.mockResolvedValue(SESSION)
    ;(prisma.voucher.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    // Even if query has companyId, the DB query must use session companyId
    await GET(makeListRequest({ companyId: 'evil-999' }))
    expect(prisma.voucher.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: COMPANY_ID }),
      })
    )
  })
})

// ─── GET /api/v1/vouchers/[id] ────────────────────────────────────────────────

describe('GET /api/v1/vouchers/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await GETById(new Request('http://localhost/api/v1/vouchers/v-001'), {
      params: Promise.resolve({ id: 'v-001' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 404 when voucher not found or belongs to different company (IDOR)', async () => {
    mockAuth.mockResolvedValue(SESSION)
    ;(prisma.voucher.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const res = await GETById(new Request('http://localhost/api/v1/vouchers/v-999'), {
      params: Promise.resolve({ id: 'v-999' }),
    })
    expect(res.status).toBe(404)
  })
})

// ─── PATCH /api/v1/vouchers/[id] — cancel ────────────────────────────────────

describe('PATCH /api/v1/vouchers/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await PATCH(
      new NextRequest('http://localhost/api/v1/vouchers/v-001', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'cancel' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'v-001' }) }
    )
    expect(res.status).toBe(401)
  })

  it('cancel action: calls cancelVoucher and returns 200 (soft delete — status CANCELLED)', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockCancelVoucher.mockResolvedValue({ id: 'v-001', status: 'CANCELLED' })
    const res = await PATCH(
      new NextRequest('http://localhost/api/v1/vouchers/v-001', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'cancel' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'v-001' }) }
    )
    expect(res.status).toBe(200)
    expect(mockCancelVoucher).toHaveBeenCalled()
    // Verify soft delete: cancelVoucher was called (not a delete operation)
    // The actual status=CANCELLED is set inside VoucherEngine (tested in unit tests)
  })
})
