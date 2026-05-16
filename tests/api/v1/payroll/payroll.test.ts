/**
 * tests/api/v1/payroll/payroll.test.ts
 *
 * Integration tests for GET and POST /api/v1/pay-runs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks (before imports) ───────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    payRun: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/inngest', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue(undefined),
  },
}))

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { inngest } from '@/lib/inngest'
import { GET, POST } from '@/app/api/v1/pay-runs/route'

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
const mockInngestSend = inngest.send as ReturnType<typeof vi.fn>

const MOCK_PAY_RUN = {
  id: 'pr-001',
  companyId: COMPANY_ID,
  month: '2025-04',
  status: 'PENDING',
  createdBy: 'usr-test-001',
  totalGross: null,
  totalNet: null,
  createdAt: new Date(),
  _count: { paySlips: 0 },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGetRequest() {
  return new NextRequest('http://localhost/api/v1/pay-runs', { method: 'GET' })
}

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/v1/pay-runs', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue(null)
  mockInngestSend.mockResolvedValue(undefined)
})

// ─── GET /api/v1/pay-runs ─────────────────────────────────────────────────────

describe('GET /api/v1/pay-runs', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('returns 200 with pay-runs array when authenticated', async () => {
    mockAuth.mockResolvedValue(SESSION)
    ;(prisma.payRun.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([MOCK_PAY_RUN])
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].id).toBe('pr-001')
  })

  it('companyId in findMany always comes from session', async () => {
    mockAuth.mockResolvedValue(SESSION)
    ;(prisma.payRun.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    await GET(makeGetRequest())
    expect(prisma.payRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: COMPANY_ID }) })
    )
  })
})

// ─── POST /api/v1/pay-runs ────────────────────────────────────────────────────

describe('POST /api/v1/pay-runs', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await POST(makePostRequest({ month: '2025-04' }))
    expect(res.status).toBe(401)
  })

  it('returns 422 when month format is invalid (Zod validation fail)', async () => {
    mockAuth.mockResolvedValue(SESSION)
    const res = await POST(makePostRequest({ month: 'April-2025' }))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toMatch(/validation/i)
  })

  it('returns 202 with { id, month, status } and fires Inngest job', async () => {
    mockAuth.mockResolvedValue(SESSION)
    ;(prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_PAY_RUN)
    const res = await POST(makePostRequest({ month: '2025-04' }))
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.id).toBe('pr-001')
    expect(body.month).toBe('2025-04')
    expect(body.status).toBe('PENDING')
    // Inngest job was fired
    expect(mockInngestSend).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'premgiri/payroll.run' })
    )
  })

  it('still returns 202 even when Inngest send fails (fire-and-forget)', async () => {
    mockAuth.mockResolvedValue(SESSION)
    ;(prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_PAY_RUN)
    // Simulate Inngest being unavailable — caught by .catch() in the route
    mockInngestSend.mockRejectedValue(new Error('Inngest unavailable'))
    const res = await POST(makePostRequest({ month: '2025-04' }))
    // 202 must still be returned — Inngest failure is fire-and-forget
    expect(res.status).toBe(202)
  })
})
