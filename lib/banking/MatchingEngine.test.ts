/**
 * MatchingEngine.test.ts
 *
 * Unit tests for MatchingEngine.ts:
 *   - scoreMatch(): pure function, no DB
 *   - getBooksClosingBalance(): Prisma-dependent, mocked with vi.mock
 *
 * RED phase: written before MatchingEngine.ts exists.
 *
 * D-06 confidence scoring table:
 *   - exact amount AND |dateDiff| <= 1 day → HIGH / AUTO_HIGH
 *   - exact amount AND |dateDiff| > 1 day  → MEDIUM / AUTO_MEDIUM
 *   - amount within ±50 (any date)         → LOW / AUTO_LOW
 *   - no match                             → null / UNMATCHED
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'

// Mock Prisma before importing MatchingEngine (which imports prisma)
vi.mock('@/lib/prisma', () => ({
  prisma: {
    bankStatement: {
      findFirst: vi.fn(),
    },
    bankTransaction: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    voucher: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
    auditLog: {
      create: vi.fn(),
    },
    ledger: {
      findFirst: vi.fn(),
    },
  },
}))

import { scoreMatch, getBooksClosingBalance, runMatch } from './MatchingEngine'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDate(dayOffset: number): Date {
  const d = new Date('2025-04-05T00:00:00.000Z')
  d.setDate(d.getDate() + dayOffset)
  return d
}

const BASE_DATE = makeDate(0)

// ---------------------------------------------------------------------------
// scoreMatch — confidence scoring algorithm (D-06)
// ---------------------------------------------------------------------------

describe('scoreMatch', () => {
  it('exact amount + same day → HIGH / AUTO_HIGH', () => {
    const result = scoreMatch(
      new Decimal('1000'),
      BASE_DATE,
      new Decimal('1000'),
      BASE_DATE,
    )
    expect(result.confidence).toBe('HIGH')
    expect(result.status).toBe('AUTO_HIGH')
  })

  it('exact amount + 1 day diff → HIGH / AUTO_HIGH (boundary)', () => {
    const result = scoreMatch(
      new Decimal('1000'),
      makeDate(1),
      new Decimal('1000'),
      BASE_DATE,
    )
    expect(result.confidence).toBe('HIGH')
    expect(result.status).toBe('AUTO_HIGH')
  })

  it('exact amount + -1 day diff → HIGH / AUTO_HIGH (boundary, negative)', () => {
    const result = scoreMatch(
      new Decimal('1000'),
      makeDate(-1),
      new Decimal('1000'),
      BASE_DATE,
    )
    expect(result.confidence).toBe('HIGH')
    expect(result.status).toBe('AUTO_HIGH')
  })

  it('exact amount + 2 day diff → MEDIUM / AUTO_MEDIUM', () => {
    const result = scoreMatch(
      new Decimal('1000'),
      makeDate(2),
      new Decimal('1000'),
      BASE_DATE,
    )
    expect(result.confidence).toBe('MEDIUM')
    expect(result.status).toBe('AUTO_MEDIUM')
  })

  it('exact amount + 3 day diff → MEDIUM / AUTO_MEDIUM (mid-range)', () => {
    const result = scoreMatch(
      new Decimal('1000'),
      makeDate(3),
      new Decimal('1000'),
      BASE_DATE,
    )
    expect(result.confidence).toBe('MEDIUM')
    expect(result.status).toBe('AUTO_MEDIUM')
  })

  it('exact amount + 30 day diff → MEDIUM / AUTO_MEDIUM (no upper bound)', () => {
    // A month-old exact-amount match is still MEDIUM for human review — no upper date bound
    const result = scoreMatch(
      new Decimal('1000'),
      makeDate(30),
      new Decimal('1000'),
      BASE_DATE,
    )
    expect(result.confidence).toBe('MEDIUM')
    expect(result.status).toBe('AUTO_MEDIUM')
  })

  it('amount within ±50 + same day → LOW / AUTO_LOW', () => {
    const result = scoreMatch(
      new Decimal('1000'),
      BASE_DATE,
      new Decimal('1020'),
      BASE_DATE,
    )
    expect(result.confidence).toBe('LOW')
    expect(result.status).toBe('AUTO_LOW')
  })

  it('amount within ±50 (negative direction) + any date → LOW / AUTO_LOW', () => {
    const result = scoreMatch(
      new Decimal('1000'),
      BASE_DATE,
      new Decimal('960'),
      makeDate(5),
    )
    expect(result.confidence).toBe('LOW')
    expect(result.status).toBe('AUTO_LOW')
  })

  it('amount exactly ±50 → LOW / AUTO_LOW (boundary)', () => {
    const result = scoreMatch(
      new Decimal('1000'),
      BASE_DATE,
      new Decimal('1050'),
      makeDate(10),
    )
    expect(result.confidence).toBe('LOW')
    expect(result.status).toBe('AUTO_LOW')
  })

  it('amount diff of exactly ₹1 → LOW / AUTO_LOW (boundary of fuzzy range)', () => {
    const result = scoreMatch(
      new Decimal('1000'),
      BASE_DATE,
      new Decimal('1001'),   // ₹1 more than bank amount
      BASE_DATE,
    )
    expect(result.confidence).toBe('LOW')
    expect(result.status).toBe('AUTO_LOW')
  })

  it('amount diff of ₹1 negative direction → LOW / AUTO_LOW', () => {
    const result = scoreMatch(
      new Decimal('1000'),
      BASE_DATE,
      new Decimal('999'),    // ₹1 less than bank amount
      BASE_DATE,
    )
    expect(result.confidence).toBe('LOW')
    expect(result.status).toBe('AUTO_LOW')
  })

  it('amount diff > 50 → null / UNMATCHED', () => {
    const result = scoreMatch(
      new Decimal('1000'),
      BASE_DATE,
      new Decimal('2000'),
      makeDate(10),
    )
    expect(result.confidence).toBeNull()
    expect(result.status).toBe('UNMATCHED')
  })

  it('completely different amounts + large date diff → null / UNMATCHED', () => {
    const result = scoreMatch(
      new Decimal('500'),
      BASE_DATE,
      new Decimal('99999'),
      makeDate(30),
    )
    expect(result.confidence).toBeNull()
    expect(result.status).toBe('UNMATCHED')
  })

  it('uses Decimal equality (not ===) — Decimal("1000.00") eq Decimal("1000") → HIGH', () => {
    // Decimal("1000.00") and Decimal("1000") are equal in value
    const result = scoreMatch(
      new Decimal('1000.00'),
      BASE_DATE,
      new Decimal('1000'),
      BASE_DATE,
    )
    expect(result.confidence).toBe('HIGH')
    expect(result.status).toBe('AUTO_HIGH')
  })
})

// ---------------------------------------------------------------------------
// getBooksClosingBalance — accounting formula
// ---------------------------------------------------------------------------

describe('getBooksClosingBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('DR ledger + opening 10000 + one DR entry 5000 → returns Decimal(15000)', async () => {
    const mockLedger = {
      id: 'led1',
      companyId: 'comp1',
      drCr: 'DR',
      openingBalance: new Decimal('10000'),
      voucherEntries: [
        { amount: new Decimal('5000'), drCr: 'DR' },
      ],
    }
    ;(prisma.ledger.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockLedger)

    const result = await getBooksClosingBalance('comp1', 'led1', new Date('2025-04-30'))
    expect(result.toString()).toBe('15000')
  })

  it('DR ledger + opening 10000 + one CR entry 3000 → returns Decimal(7000)', async () => {
    const mockLedger = {
      id: 'led1',
      companyId: 'comp1',
      drCr: 'DR',
      openingBalance: new Decimal('10000'),
      voucherEntries: [
        { amount: new Decimal('3000'), drCr: 'CR' },
      ],
    }
    ;(prisma.ledger.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockLedger)

    const result = await getBooksClosingBalance('comp1', 'led1', new Date('2025-04-30'))
    expect(result.toString()).toBe('7000')
  })

  it('CR ledger + opening 5000 + one CR entry 2000 → returns Decimal(-7000) (liability increases)', async () => {
    const mockLedger = {
      id: 'led2',
      companyId: 'comp1',
      drCr: 'CR',
      openingBalance: new Decimal('5000'),
      voucherEntries: [
        { amount: new Decimal('2000'), drCr: 'CR' },
      ],
    }
    ;(prisma.ledger.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockLedger)

    const result = await getBooksClosingBalance('comp1', 'led2', new Date('2025-04-30'))
    // DR = 0, CR = 5000 + 2000 = 7000 → DR - CR = -7000
    expect(result.toString()).toBe('-7000')
  })

  it('returns Decimal(0) if ledger not found', async () => {
    ;(prisma.ledger.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const result = await getBooksClosingBalance('comp1', 'nonexistent', new Date())
    expect(result.toString()).toBe('0')
  })

  it('calls prisma.ledger.findFirst with companyId in where clause (tenant scope)', async () => {
    const mockLedger = {
      drCr: 'DR',
      openingBalance: new Decimal('0'),
      voucherEntries: [],
    }
    ;(prisma.ledger.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockLedger)

    await getBooksClosingBalance('company-xyz', 'led1', new Date('2025-04-30'))

    expect(prisma.ledger.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 'company-xyz' }),
      }),
    )
  })

  it('voucherEntries filter includes companyId and status POSTED and date lte', async () => {
    const toDate = new Date('2025-04-30')
    const mockLedger = {
      drCr: 'DR',
      openingBalance: new Decimal('0'),
      voucherEntries: [],
    }
    ;(prisma.ledger.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockLedger)

    await getBooksClosingBalance('comp1', 'led1', toDate)

    const call = (prisma.ledger.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0]
    // Verify the voucherEntries where clause includes status POSTED and date lte
    const entriesWhere = call.include?.voucherEntries?.where?.voucher
    expect(entriesWhere).toBeDefined()
    expect(entriesWhere.status).toBe('POSTED')
    expect(entriesWhere.companyId).toBe('comp1')
    expect(entriesWhere.date?.lte).toEqual(toDate)
  })

  it('no entries → just opening balance', async () => {
    const mockLedger = {
      drCr: 'DR',
      openingBalance: new Decimal('25000'),
      voucherEntries: [],
    }
    ;(prisma.ledger.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockLedger)

    const result = await getBooksClosingBalance('comp1', 'led1', new Date())
    expect(result.toString()).toBe('25000')
  })
})

// ---------------------------------------------------------------------------
// runMatch — duplicate prevention
// ---------------------------------------------------------------------------

describe('runMatch — duplicate prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns without matching when all bank transactions are already CONFIRMED', async () => {
    // Statement exists but bankTransaction.findMany returns [] (all CONFIRMED/REJECTED filtered out)
    ;(prisma.bankStatement.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      fromDate: new Date('2025-04-01'),
      toDate: new Date('2025-04-30'),
    })
    ;(prisma.bankTransaction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    await runMatch('stmt-001', 'comp-001', 'user-001')

    // No vouchers queried — no point scoring without transactions
    expect(prisma.voucher.findMany).not.toHaveBeenCalled()
    // No DB transaction written — nothing to update
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('returns early when statement does not exist — no transaction queries fired', async () => {
    ;(prisma.bankStatement.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await runMatch('non-existent-stmt', 'comp-001', 'user-001')

    expect(prisma.bankTransaction.findMany).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// scoreMatch — no parseFloat, no === on Decimal (static checks via types)
// ---------------------------------------------------------------------------

describe('scoreMatch — type safety contract', () => {
  it('returns a MatchResult with confidence and status properties', () => {
    const result = scoreMatch(
      new Decimal('5000'),
      BASE_DATE,
      new Decimal('5000'),
      BASE_DATE,
    )
    expect(result).toHaveProperty('confidence')
    expect(result).toHaveProperty('status')
  })

  it('HIGH confidence is string not null', () => {
    const result = scoreMatch(
      new Decimal('5000'),
      BASE_DATE,
      new Decimal('5000'),
      BASE_DATE,
    )
    expect(typeof result.confidence).toBe('string')
    expect(result.confidence).not.toBeNull()
  })

  it('UNMATCHED has null confidence', () => {
    const result = scoreMatch(
      new Decimal('1'),
      BASE_DATE,
      new Decimal('9999'),
      BASE_DATE,
    )
    expect(result.confidence).toBeNull()
    expect(result.status).toBe('UNMATCHED')
  })
})
