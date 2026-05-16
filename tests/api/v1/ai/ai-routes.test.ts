/**
 * tests/api/v1/ai/ai-routes.test.ts
 *
 * Integration tests for /api/v1/insights and /api/v1/search.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks (before imports) ───────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

vi.mock('@/lib/redis', () => ({
  getCache: vi.fn(),
  setCache: vi.fn().mockResolvedValue(undefined),
  deleteCache: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/services/InsightsService', () => ({
  generateInsights: vi.fn(),
}))

vi.mock('@/lib/services/HybridSearch', () => ({
  embedQuery: vi.fn().mockResolvedValue(null),   // null = Voyage unavailable → no vector path
  vectorSearch: vi.fn().mockResolvedValue({ ledgers: [], vouchers: [] }),
  rrfMerge: vi.fn((textList: unknown[], _vectorList: unknown[], _k: number) => textList),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ledger: { findMany: vi.fn().mockResolvedValue([]) },
    voucher: { findMany: vi.fn().mockResolvedValue([]) },
    stockItem: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { getCache, setCache } from '@/lib/redis'
import { generateInsights } from '@/lib/services/InsightsService'
import { GET as GETInsights } from '@/app/api/v1/insights/route'
import { GET as GETSearch } from '@/app/api/v1/search/route'

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
const mockGetCache = getCache as ReturnType<typeof vi.fn>
const mockSetCache = setCache as ReturnType<typeof vi.fn>
const mockGenerateInsights = generateInsights as ReturnType<typeof vi.fn>

const MOCK_INSIGHTS_RESPONSE = {
  insights: [
    { type: 'top_customer', text: 'Revenue up 12% this month', generatedAt: '2025-04-07T10:00:00Z' },
  ],
  generatedAt: '2025-04-07T10:00:00Z',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInsightsRequest(searchParams?: Record<string, string>) {
  const url = new URL('http://localhost/api/v1/insights')
  if (searchParams) Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url, { method: 'GET' })
}

function makeSearchRequest(searchParams?: Record<string, string>) {
  const url = new URL('http://localhost/api/v1/search')
  if (searchParams) Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url, { method: 'GET' })
}

// ─── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue(null)
  mockGetCache.mockResolvedValue(null)        // cache miss by default
  mockSetCache.mockResolvedValue(undefined)
})

// ─── GET /api/v1/insights ─────────────────────────────────────────────────────

describe('GET /api/v1/insights', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await GETInsights(makeInsightsRequest())
    expect(res.status).toBe(401)
  })

  it('returns 200 with fresh insights when cache is empty', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockGetCache.mockResolvedValue(null)  // cache miss
    mockGenerateInsights.mockResolvedValue(MOCK_INSIGHTS_RESPONSE)
    const res = await GETInsights(makeInsightsRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('insights')
    expect(body.cached).toBe(false)
  })

  it('returns 200 with cached: true when Redis has data', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockGetCache.mockResolvedValue(MOCK_INSIGHTS_RESPONSE)  // cache hit
    const res = await GETInsights(makeInsightsRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cached).toBe(true)
    // generateInsights should NOT be called on cache hit
    expect(mockGenerateInsights).not.toHaveBeenCalled()
  })

  it('NEVER returns 5xx — returns 200 with empty insights when generateInsights throws', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockGetCache.mockResolvedValue(null)
    mockGenerateInsights.mockRejectedValue(new Error('AI model unavailable'))
    const res = await GETInsights(makeInsightsRequest())
    // Guardrail: must be 200, not 500 (AI-SPEC §6)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.insights).toEqual([])
    expect(body.error).toBe('AI temporarily unavailable')
  })

  it('bypass cache with ?refresh=1 — calls generateInsights fresh', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockGetCache.mockResolvedValue(MOCK_INSIGHTS_RESPONSE)  // would normally be a hit
    mockGenerateInsights.mockResolvedValue(MOCK_INSIGHTS_RESPONSE)
    const res = await GETInsights(makeInsightsRequest({ refresh: '1' }))
    expect(res.status).toBe(200)
    // generateInsights IS called even though cache had data
    expect(mockGenerateInsights).toHaveBeenCalled()
  })
})

// ─── GET /api/v1/search ───────────────────────────────────────────────────────

describe('GET /api/v1/search', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await GETSearch(makeSearchRequest({ q: 'test' }))
    expect(res.status).toBe(401)
  })

  it('returns 200 with empty results when q is empty (short-circuit)', async () => {
    mockAuth.mockResolvedValue(SESSION)
    const res = await GETSearch(makeSearchRequest({ q: '' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toEqual([])
  })

  it('returns 200 with results array for a valid query', async () => {
    mockAuth.mockResolvedValue(SESSION)
    const res = await GETSearch(makeSearchRequest({ q: 'cash' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('results')
    expect(Array.isArray(body.results)).toBe(true)
  })

  it('companyId in all Prisma queries always comes from session', async () => {
    mockAuth.mockResolvedValue(SESSION)
    const { prisma } = await import('@/lib/prisma')
    await GETSearch(makeSearchRequest({ q: 'test ledger' }))
    // At least one entity query must have companyId from session
    const allCalls = [
      ...(prisma.ledger.findMany as ReturnType<typeof vi.fn>).mock.calls,
      ...(prisma.voucher.findMany as ReturnType<typeof vi.fn>).mock.calls,
    ]
    for (const [args] of allCalls) {
      expect(args?.where).toMatchObject({ companyId: COMPANY_ID })
    }
  })
})
