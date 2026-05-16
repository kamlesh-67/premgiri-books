/**
 * tests/api/v1/reports/reports.test.ts
 *
 * Integration tests for /api/v1/reports/trial-balance and /api/v1/reports/balance-sheet.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks (before imports) ───────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

vi.mock('@/lib/utils/fy', () => ({ getFY: vi.fn().mockReturnValue('2024-25') }))

vi.mock('@/lib/services/ReportEngine', () => ({
  getTrialBalance: vi.fn(),
  validateTrialBalance: vi.fn(),
  getBalanceSheet: vi.fn(),
}))

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { getTrialBalance, validateTrialBalance, getBalanceSheet } from '@/lib/services/ReportEngine'
import { GET as GETTrialBalance } from '@/app/api/v1/reports/trial-balance/route'
import { GET as GETBalanceSheet } from '@/app/api/v1/reports/balance-sheet/route'

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
const mockGetTrialBalance = getTrialBalance as ReturnType<typeof vi.fn>
const mockValidateTrialBalance = validateTrialBalance as ReturnType<typeof vi.fn>
const mockGetBalanceSheet = getBalanceSheet as ReturnType<typeof vi.fn>

// ─── Mock data ────────────────────────────────────────────────────────────────

// Trial balance rows — Decimal fields must have .toFixed() method
function makeDecimal(val: string) {
  return { toFixed: (n: number) => parseFloat(val).toFixed(n) }
}

const MOCK_TB_ROWS = [
  {
    ledgerId: 'led-001',
    name: 'Cash in Hand',
    groupName: 'Cash & Bank',
    openingDR: makeDecimal('0'),
    openingCR: makeDecimal('0'),
    periodDR: makeDecimal('10000'),
    periodCR: makeDecimal('10000'),
    closingDR: makeDecimal('10000'),
    closingCR: makeDecimal('10000'),
  },
]

const MOCK_BS_RESULT = {
  fy: '2024-25',
  balanced: true,
  totalAssets: { toFixed: (n: number) => (0).toFixed(n) },
  totalEquityLiabilities: { toFixed: (n: number) => (0).toFixed(n) },
  assetGroups: [],
  liabilityGroups: [],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(path: string, searchParams?: Record<string, string>) {
  const url = new URL(`http://localhost${path}`)
  if (searchParams) Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url.toString())
}

// ─── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue(null)
})

// ─── GET /api/v1/reports/trial-balance ───────────────────────────────────────

describe('GET /api/v1/reports/trial-balance', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await GETTrialBalance(makeRequest('/api/v1/reports/trial-balance'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with { fy, balanced, rows } shape', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockGetTrialBalance.mockResolvedValue(MOCK_TB_ROWS)
    mockValidateTrialBalance.mockReturnValue(true)
    const res = await GETTrialBalance(makeRequest('/api/v1/reports/trial-balance'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('fy')
    expect(body).toHaveProperty('balanced')
    expect(body).toHaveProperty('rows')
    expect(Array.isArray(body.rows)).toBe(true)
  })

  it('balanced is true when validateTrialBalance returns true (DR == CR invariant)', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockGetTrialBalance.mockResolvedValue(MOCK_TB_ROWS)
    mockValidateTrialBalance.mockReturnValue(true)
    const res = await GETTrialBalance(makeRequest('/api/v1/reports/trial-balance'))
    const body = await res.json()
    expect(body.balanced).toBe(true)
  })

  it('balanced is false when validateTrialBalance returns false (unbalanced books)', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockGetTrialBalance.mockResolvedValue(MOCK_TB_ROWS)
    mockValidateTrialBalance.mockReturnValue(false)
    const res = await GETTrialBalance(makeRequest('/api/v1/reports/trial-balance'))
    const body = await res.json()
    expect(body.balanced).toBe(false)
  })

  it('companyId passed to getTrialBalance always comes from session', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockGetTrialBalance.mockResolvedValue([])
    mockValidateTrialBalance.mockReturnValue(true)
    await GETTrialBalance(makeRequest('/api/v1/reports/trial-balance'))
    expect(mockGetTrialBalance).toHaveBeenCalledWith(COMPANY_ID, expect.any(String))
  })
})

// ─── GET /api/v1/reports/balance-sheet ───────────────────────────────────────

describe('GET /api/v1/reports/balance-sheet', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await GETBalanceSheet(makeRequest('/api/v1/reports/balance-sheet'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with balance sheet shape', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockGetBalanceSheet.mockResolvedValue(MOCK_BS_RESULT)
    const res = await GETBalanceSheet(makeRequest('/api/v1/reports/balance-sheet'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('fy')
    expect(body).toHaveProperty('balanced')
    expect(body).toHaveProperty('totalAssets')
    expect(body).toHaveProperty('totalEquityLiabilities')
    expect(body).toHaveProperty('assetGroups')
    expect(body).toHaveProperty('liabilityGroups')
  })

  it('companyId passed to getBalanceSheet always comes from session', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockGetBalanceSheet.mockResolvedValue(MOCK_BS_RESULT)
    await GETBalanceSheet(makeRequest('/api/v1/reports/balance-sheet'))
    expect(mockGetBalanceSheet).toHaveBeenCalledWith(COMPANY_ID, expect.any(String))
  })
})
