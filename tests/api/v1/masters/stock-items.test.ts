/**
 * tests/api/v1/masters/stock-items.test.ts
 *
 * Integration tests for GET and POST /api/v1/masters/stock-items.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks (before imports) ───────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    stockItem: { findMany: vi.fn() },
    stockGroup: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}))

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET, POST } from '@/app/api/v1/masters/stock-items/route'

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

// Valid CUID for uomId — Zod stockItemSchema uses z.string().cuid()
const VALID_UOM_ID = 'clhxe7m0t0000jnrmggm74751'

const mockAuth = auth as ReturnType<typeof vi.fn>

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_STOCK_ITEM = {
  id: 'si-001',
  companyId: COMPANY_ID,
  name: 'Rice Basmati',
  groupId: 'grp-stk-001',
  uomId: VALID_UOM_ID,
  hsnCode: '1006',
  gstRate: '5',
  gstApplicable: true,
  openingQty: '100',
  openingRate: '50',
  reorderQty: '10',
  isActive: true,
  uom: { name: 'Kilogram', symbol: 'Kg' },
}

// openingRate, openingQty, reorderQty are z.string() in stockItemSchema
// gstRate is z.coerce.number() — must be one of [0, 5, 12, 18, 28]
const VALID_STOCK_ITEM_BODY = {
  name: 'Rice Basmati',
  uomId: VALID_UOM_ID,
  hsnCode: '1006',
  gstRate: 5,
  openingQty: '100',
  openingRate: '50',
  reorderQty: '10',
}

// ─── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue(null)
})

// ─── GET /api/v1/masters/stock-items ─────────────────────────────────────────

describe('GET /api/v1/masters/stock-items', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 200 with stock items array when authenticated', async () => {
    mockAuth.mockResolvedValue(SESSION)
    ;(prisma.stockItem.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([MOCK_STOCK_ITEM])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].id).toBe('si-001')
    // Decimal fields serialized as strings
    expect(body[0].gstRate).toBe('5')
    expect(body[0].openingQty).toBe('100')
  })

  it('companyId in findMany always comes from session', async () => {
    mockAuth.mockResolvedValue(SESSION)
    ;(prisma.stockItem.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    await GET()
    expect(prisma.stockItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: COMPANY_ID, isActive: true }),
      })
    )
  })
})

// ─── POST /api/v1/masters/stock-items ────────────────────────────────────────

describe('POST /api/v1/masters/stock-items', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await POST(
      new Request('http://localhost/api/v1/masters/stock-items', {
        method: 'POST',
        body: JSON.stringify(VALID_STOCK_ITEM_BODY),
        headers: { 'Content-Type': 'application/json' },
      })
    )
    expect(res.status).toBe(401)
  })

  it('returns 400 when Zod validation fails (missing name)', async () => {
    mockAuth.mockResolvedValue(SESSION)
    const res = await POST(
      new Request('http://localhost/api/v1/masters/stock-items', {
        method: 'POST',
        body: JSON.stringify({ uomId: VALID_UOM_ID }),
        headers: { 'Content-Type': 'application/json' },
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/validation/i)
  })

  it('returns 201 with stock item on successful creation', async () => {
    mockAuth.mockResolvedValue(SESSION)
    ;(prisma.stockGroup.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'grp-stk-001',
      name: 'General',
    })
    ;(prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_STOCK_ITEM)
    const res = await POST(
      new Request('http://localhost/api/v1/masters/stock-items', {
        method: 'POST',
        body: JSON.stringify(VALID_STOCK_ITEM_BODY),
        headers: { 'Content-Type': 'application/json' },
      })
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('si-001')
    expect(body.name).toBe('Rice Basmati')
  })
})
