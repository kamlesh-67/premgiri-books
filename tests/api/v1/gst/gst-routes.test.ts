/**
 * tests/api/v1/gst/gst-routes.test.ts
 *
 * Integration tests for GSTR-1 and GSTR-3B API routes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks (before imports) ───────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

vi.mock('@/lib/services/GSTService', () => ({
  getGstr1Sections: vi.fn(),
  getGstr3bSummary: vi.fn(),
}))

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { getGstr1Sections, getGstr3bSummary } from '@/lib/services/GSTService'
import { GET as GETGstr1 } from '@/app/api/v1/gst/gstr1/route'
import { GET as GETGstr3b } from '@/app/api/v1/gst/gstr3b/route'

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
const mockGetGstr1Sections = getGstr1Sections as ReturnType<typeof vi.fn>
const mockGetGstr3bSummary = getGstr3bSummary as ReturnType<typeof vi.fn>

// ─── Mock response shapes ─────────────────────────────────────────────────────

const MOCK_GSTR1_SECTIONS = {
  b2b: [],
  b2cs: [],
  cdnr: [],
  hsn: { data: [] },
  nil: { inv: [] },
}

const MOCK_GSTR3B_SUMMARY = {
  '3_1': { txval: '0', iamt: '0', camt: '0', samt: '0', csamt: '0' },
  '3_2': { inter_supplies: [] },
  '4': { itc_avl: [] },
  '5': { intr_ltfee: { intr: '0', fee: '0' } },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGstr1Request(searchParams?: Record<string, string>) {
  const url = new URL('http://localhost/api/v1/gst/gstr1')
  if (searchParams) Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url, { method: 'GET' })
}

function makeGstr3bRequest(searchParams?: Record<string, string>) {
  const url = new URL('http://localhost/api/v1/gst/gstr3b')
  if (searchParams) Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url, { method: 'GET' })
}

// ─── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue(null)
})

// ─── GET /api/v1/gst/gstr1 ───────────────────────────────────────────────────

describe('GET /api/v1/gst/gstr1', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await GETGstr1(makeGstr1Request({ period: '04/2025' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when period param is missing', async () => {
    mockAuth.mockResolvedValue(SESSION)
    const res = await GETGstr1(makeGstr1Request())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/period/i)
  })

  it('returns 400 when period is in wrong format (YYYY-MM instead of MM/YYYY)', async () => {
    mockAuth.mockResolvedValue(SESSION)
    const res = await GETGstr1(makeGstr1Request({ period: '2025-04' }))
    expect(res.status).toBe(400)
  })

  it('returns 200 with sections object on valid period', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockGetGstr1Sections.mockResolvedValue(MOCK_GSTR1_SECTIONS)
    const res = await GETGstr1(makeGstr1Request({ period: '04/2025' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('b2b')
    expect(body).toHaveProperty('b2cs')
    expect(body).toHaveProperty('hsn')
  })

  it('companyId passed to getGstr1Sections always comes from session', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockGetGstr1Sections.mockResolvedValue(MOCK_GSTR1_SECTIONS)
    await GETGstr1(makeGstr1Request({ period: '04/2025' }))
    expect(mockGetGstr1Sections).toHaveBeenCalledWith(COMPANY_ID, '04/2025')
  })
})

// ─── GET /api/v1/gst/gstr3b ──────────────────────────────────────────────────

describe('GET /api/v1/gst/gstr3b', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await GETGstr3b(makeGstr3bRequest({ period: '04/2025' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when period is missing', async () => {
    mockAuth.mockResolvedValue(SESSION)
    const res = await GETGstr3b(makeGstr3bRequest())
    expect(res.status).toBe(400)
  })

  it('returns 400 when period format is wrong', async () => {
    mockAuth.mockResolvedValue(SESSION)
    const res = await GETGstr3b(makeGstr3bRequest({ period: 'April-2025' }))
    expect(res.status).toBe(400)
  })

  it('returns 200 with summary object on valid period', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockGetGstr3bSummary.mockResolvedValue(MOCK_GSTR3B_SUMMARY)
    const res = await GETGstr3b(makeGstr3bRequest({ period: '04/2025' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toBeTruthy()
  })

  it('companyId passed to getGstr3bSummary always comes from session', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockGetGstr3bSummary.mockResolvedValue(MOCK_GSTR3B_SUMMARY)
    await GETGstr3b(makeGstr3bRequest({ period: '04/2025' }))
    expect(mockGetGstr3bSummary).toHaveBeenCalledWith(COMPANY_ID, '04/2025')
  })
})
