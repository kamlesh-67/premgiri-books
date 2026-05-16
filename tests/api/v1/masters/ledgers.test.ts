/**
 * tests/api/v1/masters/ledgers.test.ts
 *
 * Integration tests for GET and POST /api/v1/masters/ledgers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks (before imports) ───────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    accountGroup: { findMany: vi.fn(), findFirst: vi.fn() },
    ledger: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET, POST } from '@/app/api/v1/masters/ledgers/route'

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGetRequest(searchParams?: Record<string, string>) {
  const url = new URL('http://localhost/api/v1/masters/ledgers')
  if (searchParams) Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url, { method: 'GET' })
}

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/v1/masters/ledgers', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const MOCK_LEDGER = {
  id: 'led-001',
  companyId: COMPANY_ID,
  name: 'Test Party',
  groupId: 'grp-001',
  gstin: null,
  pan: null,
  openingBalance: '0',
  creditLimit: null,
  drCr: 'DR',
  gstRegType: 'UNREGISTERED',
  creditDays: null,
  bankName: null,
  bankAccount: null,
  ifsc: null,
  isActive: true,
  group: { name: 'Sundry Debtors', nature: 'ASSET', parent: null },
}

// ─── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue(null)
})

// ─── GET /api/v1/masters/ledgers ──────────────────────────────────────────────

describe('GET /api/v1/masters/ledgers', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('returns 200 with ledger array when authenticated', async () => {
    mockAuth.mockResolvedValue(SESSION)
    ;(prisma.ledger.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([MOCK_LEDGER])
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].id).toBe('led-001')
  })

  it('companyId in findMany always comes from session', async () => {
    mockAuth.mockResolvedValue(SESSION)
    ;(prisma.ledger.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    await GET(makeGetRequest())
    expect(prisma.ledger.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: COMPANY_ID }),
      })
    )
  })

  it('type=party queries accountGroup then ledger with group filter', async () => {
    mockAuth.mockResolvedValue(SESSION)
    const mockGroupFindMany = prisma.accountGroup.findMany as ReturnType<typeof vi.fn>
    mockGroupFindMany.mockResolvedValue([
      { id: 'grp-debtors', name: 'Sundry Debtors' },
      { id: 'grp-creditors', name: 'Sundry Creditors' },
    ])
    ;(prisma.ledger.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    const res = await GET(makeGetRequest({ type: 'party' }))
    expect(res.status).toBe(200)
    expect(mockGroupFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: COMPANY_ID,
          name: { in: ['Sundry Debtors', 'Sundry Creditors'] },
        }),
      })
    )
  })
})

// ─── POST /api/v1/masters/ledgers ─────────────────────────────────────────────

describe('POST /api/v1/masters/ledgers', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await POST(makePostRequest({ name: 'Test' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when Zod validation fails for customer (missing name)', async () => {
    mockAuth.mockResolvedValue(SESSION)
    const res = await POST(makePostRequest({ partyType: 'customer' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/validation/i)
  })

  it('returns 201 with ledger on successful customer creation', async () => {
    mockAuth.mockResolvedValue(SESSION)
    ;(prisma.accountGroup.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'grp-debtors',
      name: 'Sundry Debtors',
    })
    ;(prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_LEDGER)
    const res = await POST(
      makePostRequest({ partyType: 'customer', name: 'Test Party', gstin: '', pan: '' })
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('led-001')
    expect(body.name).toBe('Test Party')
  })

  it('Sundry Debtors group is auto-assigned from DB — not injectable from body', async () => {
    mockAuth.mockResolvedValue(SESSION)
    ;(prisma.accountGroup.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'grp-debtors',
      name: 'Sundry Debtors',
    })
    ;(prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_LEDGER)
    await POST(
      makePostRequest({ partyType: 'customer', name: 'Test Party', groupId: 'evil-group-999' })
    )
    // The route looks up Sundry Debtors and uses that groupId — never uses body groupId
    expect(prisma.accountGroup.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ name: 'Sundry Debtors' }) })
    )
  })
})
