/**
 * tests/api/v1/banking/banking.test.ts
 *
 * Integration tests for GET and POST /api/v1/bank-statements.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks (before imports) ───────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    bankStatement: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/services/BankService', () => ({
  importStatement: vi.fn(),
}))

vi.mock('@/lib/banking/bankParsers', () => ({
  BANK_PARSERS: {
    SBI: { encoding: 'latin1' },
    HDFC: { encoding: 'utf-8' },
    ICICI: { encoding: 'utf-8' },
    Axis: { encoding: 'utf-8' },
    Kotak: { encoding: 'utf-8' },
  },
}))

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { importStatement } from '@/lib/services/BankService'
import { GET, POST } from '@/app/api/v1/bank-statements/route'

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
const mockImportStatement = importStatement as ReturnType<typeof vi.fn>

const MOCK_STATEMENT = {
  id: 'stmt-001',
  bank: 'HDFC',
  ledger: { name: 'HDFC Current Account' },
  fromDate: new Date('2025-04-01'),
  toDate: new Date('2025-04-30'),
  uploadedAt: new Date('2025-05-01'),
  rowCount: 45,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGetRequest() {
  return new NextRequest('http://localhost/api/v1/bank-statements', { method: 'GET' })
}

function makePostRequest(csvContent: string, bank: string, ledgerId: string, filename = 'statement.csv') {
  const formData = new FormData()
  const blob = new Blob([csvContent], { type: 'text/csv' })
  formData.append('file', new File([blob], filename, { type: 'text/csv' }))
  formData.append('bank', bank)
  formData.append('ledgerId', ledgerId)
  return new NextRequest('http://localhost/api/v1/bank-statements', {
    method: 'POST',
    body: formData,
  })
}

// ─── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue(null)
})

// ─── GET /api/v1/bank-statements ──────────────────────────────────────────────

describe('GET /api/v1/bank-statements', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('returns 200 with statement array when authenticated', async () => {
    mockAuth.mockResolvedValue(SESSION)
    ;(prisma.bankStatement.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([MOCK_STATEMENT])
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].id).toBe('stmt-001')
  })

  it('companyId in findMany always comes from session', async () => {
    mockAuth.mockResolvedValue(SESSION)
    ;(prisma.bankStatement.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    await GET(makeGetRequest())
    expect(prisma.bankStatement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: COMPANY_ID }) })
    )
  })
})

// ─── POST /api/v1/bank-statements ────────────────────────────────────────────

describe('POST /api/v1/bank-statements', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await POST(makePostRequest('Date,Amount\n01-04-2025,1000', 'HDFC', 'led-001'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when file does not have .csv extension', async () => {
    mockAuth.mockResolvedValue(SESSION)
    const formData = new FormData()
    const blob = new Blob(['data'], { type: 'application/pdf' })
    formData.append('file', new File([blob], 'statement.pdf', { type: 'application/pdf' }))
    formData.append('bank', 'HDFC')
    formData.append('ledgerId', 'led-001')
    const req = new NextRequest('http://localhost/api/v1/bank-statements', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/\.csv/i)
  })

  it('returns 201 with { id, rowCount } on successful import', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockImportStatement.mockResolvedValue({ statementId: 'stmt-001', rowCount: 45 })
    const res = await POST(makePostRequest('Date,Amount\n01-04-2025,1000', 'HDFC', 'led-001'))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('stmt-001')
    expect(body.rowCount).toBe(45)
  })

  it('companyId passed to importStatement always comes from session', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockImportStatement.mockResolvedValue({ statementId: 'stmt-001', rowCount: 1 })
    await POST(makePostRequest('Date,Amount\n01-04-2025,1000', 'HDFC', 'led-001'))
    expect(mockImportStatement).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_ID })
    )
  })
})
