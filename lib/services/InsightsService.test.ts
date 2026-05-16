/**
 * InsightsService.test.ts
 *
 * TDD RED phase: Tests for InsightsService.generateInsights()
 * Mocks Prisma and the Anthropic SDK — no network calls, no DB connection needed.
 *
 * Covers 6 behaviors:
 * 1. generateInsights returns InsightsResponseSchema-valid object (3 insights)
 * 2. Top customer insight contains the party name and Indian lakh-formatted amount
 * 3. Multi-tenant isolation — companyA query never includes companyB data
 * 4. No vouchers → returns { insights: [], generatedAt }
 * 5. Zod parse failure → returns { insights: [] } without throwing
 * 6. anthropicClient called with model: 'claude-haiku-4-5-20251001' and max_tokens: 256
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Decimal } from 'decimal.js'

// ─── Mock @/lib/ai BEFORE importing InsightsService ─────────────────────────
// This prevents env var validation from firing (no real API keys in test env).
vi.mock('@/lib/ai', () => ({
  anthropicClient: {
    messages: {
      create: vi.fn(),
    },
  },
  INSIGHTS_MODEL: 'claude-haiku-4-5-20251001',
}))

// ─── Mock @/lib/prisma ───────────────────────────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    voucher: {
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    ledger: {
      findUnique: vi.fn(),
    },
    voucherEntry: {
      findMany: vi.fn(),
    },
  },
}))

// ─── Now import the module under test ───────────────────────────────────────
import {
  generateInsights,
  InsightsResponseSchema,
  InsightSchema,
  type Insight,
  type InsightsResponse,
} from './InsightsService'

// ─── Import mocks to configure per-test ─────────────────────────────────────
import { anthropicClient } from '@/lib/ai'
import { prisma } from '@/lib/prisma'

// Typed mock references for convenient per-test configuration
const mockCreate = vi.mocked(anthropicClient.messages.create)
const mockGroupBy = vi.mocked(prisma.voucher.groupBy)
const mockAggregate = vi.mocked(prisma.voucher.aggregate)
const mockLedgerFindUnique = vi.mocked(prisma.ledger.findUnique)
const mockEntryFindMany = vi.mocked(prisma.voucherEntry.findMany)

// ─── Default Claude response fixture ────────────────────────────────────────
const VALID_CLAUDE_RESPONSE = `1. Sharma Traders is your top customer this month with ₹2,45,000 in sales — consider offering loyalty discounts to retain this relationship.
2. Your biggest expense is Staff Salary at ₹80,000 — review if headcount matches your current workload.
3. Your GST liability is ₹44,100 this month versus ₹38,000 last month — an increase of 16%, plan your tax payment accordingly.`

function makeClaudeResponse(text: string) {
  return {
    id: 'msg_01',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-4-5-20251001',
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 200, output_tokens: 100 },
  }
}

// ─── Setup defaults before each test ────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()

  // Default: no data (overridden in specific tests)
  mockGroupBy.mockResolvedValue([])
  mockAggregate.mockResolvedValue({
    _sum: { cgstAmount: null, sgstAmount: null, igstAmount: null, totalAmount: null },
    _count: {},
    _avg: {},
    _min: {},
    _max: {},
  } as never)
  mockLedgerFindUnique.mockResolvedValue(null)
  mockEntryFindMany.mockResolvedValue([])
  mockCreate.mockResolvedValue(makeClaudeResponse(VALID_CLAUDE_RESPONSE) as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── Test 1: Returns InsightsResponseSchema-valid object with 3 insights ─────
describe('generateInsights', () => {
  it('returns an object matching InsightsResponseSchema with 3 insights when data exists', async () => {
    // Arrange: top customer data
    mockGroupBy.mockResolvedValue([
      { partyLedgerId: 'ledger-sharma', _sum: { totalAmount: new Decimal('245000') } },
    ] as never)

    mockLedgerFindUnique.mockResolvedValue({
      id: 'ledger-sharma',
      name: 'Sharma Traders',
      companyId: 'company-a',
    } as never)

    // Expense entries — current period
    mockEntryFindMany.mockResolvedValue([
      {
        amount: new Decimal('80000'),
        ledger: { group: { name: 'Staff Salary' } },
      },
    ] as never)

    // GST aggregates (current + previous)
    mockAggregate
      .mockResolvedValueOnce({
        _sum: { cgstAmount: new Decimal('22050'), sgstAmount: new Decimal('22050'), igstAmount: new Decimal('0') },
      } as never)
      .mockResolvedValueOnce({
        _sum: { cgstAmount: new Decimal('19000'), sgstAmount: new Decimal('19000'), igstAmount: new Decimal('0') },
      } as never)

    // Act
    const result = await generateInsights('company-a')

    // Assert schema validity
    const parsed = InsightsResponseSchema.safeParse(result)
    expect(parsed.success).toBe(true)

    // Should have exactly 3 insights
    expect(result.insights).toHaveLength(3)

    // Types must match the expected order
    expect(result.insights[0].type).toBe('top_customer')
    expect(result.insights[1].type).toBe('biggest_expense')
    expect(result.insights[2].type).toBe('gst_trend')

    // Each insight must have a text of at least 10 chars
    for (const insight of result.insights) {
      expect(insight.text.length).toBeGreaterThanOrEqual(10)
      expect(insight.generatedAt).toBeTruthy()
    }

    // generatedAt must be a valid ISO datetime string
    expect(() => new Date(result.generatedAt)).not.toThrow()
  })

  // ─── Test 2: Insight text contains "Sharma" AND "2,45,000" ─────────────────
  it('top_customer insight contains party name and Indian lakh-formatted amount', async () => {
    // Arrange: 1 POSTED SALES voucher, totalAmount=245000, party="Sharma Traders"
    mockGroupBy.mockResolvedValue([
      { partyLedgerId: 'ledger-sharma', _sum: { totalAmount: new Decimal('245000') } },
    ] as never)

    mockLedgerFindUnique.mockResolvedValue({
      id: 'ledger-sharma',
      name: 'Sharma Traders',
      companyId: 'company-a',
    } as never)

    mockEntryFindMany.mockResolvedValue([
      { amount: new Decimal('80000'), ledger: { group: { name: 'Staff Salary' } } },
    ] as never)

    mockAggregate
      .mockResolvedValueOnce({
        _sum: { cgstAmount: new Decimal('22050'), sgstAmount: new Decimal('22050'), igstAmount: new Decimal('0') },
      } as never)
      .mockResolvedValueOnce({
        _sum: { cgstAmount: new Decimal('19000'), sgstAmount: new Decimal('19000'), igstAmount: new Decimal('0') },
      } as never)

    // Configure Claude to return text that references the party and amount
    const claudeText = `1. Sharma Traders is your top customer this month with ₹2,45,000 in sales.
2. Your biggest expense is Staff Salary at ₹80,000 this month.
3. Your GST liability is ₹44,100 this month versus ₹38,000 last month.`
    mockCreate.mockResolvedValue(makeClaudeResponse(claudeText) as never)

    // Act
    const result = await generateInsights('company-a')

    // Assert: top_customer insight contains both "Sharma" and "2,45,000"
    const topCustomerInsight = result.insights.find((i) => i.type === 'top_customer')
    expect(topCustomerInsight).toBeDefined()
    expect(topCustomerInsight!.text).toContain('Sharma')
    expect(topCustomerInsight!.text).toContain('2,45,000')
  })
})

// ─── Test 3: Multi-tenant isolation ─────────────────────────────────────────
describe('multi-tenant isolation', () => {
  it('generateInsights for companyA does NOT include companyB data', async () => {
    // Arrange: companyA has Sharma Traders, companyB has Patel Corp
    const companyAId = 'company-a'
    const companyBId = 'company-b'

    // Only set up mock for companyA call
    mockGroupBy.mockResolvedValue([
      { partyLedgerId: 'ledger-sharma', _sum: { totalAmount: new Decimal('245000') } },
    ] as never)

    mockLedgerFindUnique.mockResolvedValue({
      id: 'ledger-sharma',
      name: 'Sharma Traders',
      companyId: companyAId,
    } as never)

    mockEntryFindMany.mockResolvedValue([
      { amount: new Decimal('50000'), ledger: { group: { name: 'Rent' } } },
    ] as never)

    mockAggregate
      .mockResolvedValueOnce({
        _sum: { cgstAmount: new Decimal('10000'), sgstAmount: new Decimal('10000'), igstAmount: new Decimal('0') },
      } as never)
      .mockResolvedValueOnce({
        _sum: { cgstAmount: new Decimal('8000'), sgstAmount: new Decimal('8000'), igstAmount: new Decimal('0') },
      } as never)

    // Claude response only references companyA data
    const claudeTextForA = `1. Sharma Traders is your top customer with ₹2,45,000 in sales.
2. Rent is your biggest expense at ₹50,000 this month.
3. Your GST liability is ₹20,000 versus ₹16,000 last month.`
    mockCreate.mockResolvedValue(makeClaudeResponse(claudeTextForA) as never)

    // Act: generate insights for companyA only
    const resultA = await generateInsights(companyAId)

    // Assert: results only contain companyA data, not companyB
    const allInsightText = resultA.insights.map((i) => i.text).join(' ')
    expect(allInsightText).toContain('Sharma')
    expect(allInsightText).not.toContain('Patel Corp')

    // Verify groupBy was called with companyAId (not companyBId)
    expect(mockGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: companyAId }),
      })
    )
    expect(mockGroupBy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: companyBId }),
      })
    )

    // Verify aggregate was called with companyAId
    expect(mockAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: companyAId }),
      })
    )
    expect(mockAggregate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: companyBId }),
      })
    )
  })
})

// ─── Test 4: No vouchers → graceful empty fallback ───────────────────────────
describe('graceful fallback', () => {
  it('returns { insights: [], generatedAt } when no vouchers exist', async () => {
    // Arrange: all queries return empty / zero
    mockGroupBy.mockResolvedValue([])
    mockEntryFindMany.mockResolvedValue([])
    mockAggregate.mockResolvedValue({
      _sum: { cgstAmount: null, sgstAmount: null, igstAmount: null },
    } as never)

    // Act
    const result = await generateInsights('company-empty')

    // Assert: graceful empty fallback — no Claude call made
    expect(result.insights).toHaveLength(0)
    expect(result.generatedAt).toBeTruthy()
    expect(mockCreate).not.toHaveBeenCalled()

    // Schema should still be valid (InsightsResponseSchema allows 0 insights via .max(3))
    const parsed = InsightsResponseSchema.safeParse(result)
    expect(parsed.success).toBe(true)
  })
})

// ─── Test 5: Zod parse failure → returns { insights: [] } without throwing ───
describe('Zod parse failure handling', () => {
  it('returns { insights: [] } without throwing when Claude returns malformed output', async () => {
    // Arrange: data present so Claude is called
    mockGroupBy.mockResolvedValue([
      { partyLedgerId: 'ledger-x', _sum: { totalAmount: new Decimal('100000') } },
    ] as never)
    mockLedgerFindUnique.mockResolvedValue({ id: 'ledger-x', name: 'Test Party', companyId: 'c1' } as never)
    mockEntryFindMany.mockResolvedValue([
      { amount: new Decimal('20000'), ledger: { group: { name: 'Utilities' } } },
    ] as never)
    mockAggregate
      .mockResolvedValueOnce({ _sum: { cgstAmount: new Decimal('5000'), sgstAmount: new Decimal('5000'), igstAmount: new Decimal('0') } } as never)
      .mockResolvedValueOnce({ _sum: { cgstAmount: new Decimal('4000'), sgstAmount: new Decimal('4000'), igstAmount: new Decimal('0') } } as never)

    // Claude returns only 2 lines (not 3) AND each is very short (fails min(10) check)
    const malformedText = `1. OK
2. Also OK`
    mockCreate.mockResolvedValue(makeClaudeResponse(malformedText) as never)

    // Act: must NOT throw
    let result: InsightsResponse | undefined
    await expect(
      (async () => {
        result = await generateInsights('company-c')
      })()
    ).resolves.not.toThrow()

    // Assert: fallback to empty insights
    expect(result).toBeDefined()
    expect(result!.insights).toHaveLength(0)
    expect(result!.generatedAt).toBeTruthy()
  })
})

// ─── Test 6: anthropicClient called with correct model + max_tokens ──────────
describe('anthropicClient call parameters', () => {
  it('calls anthropicClient.messages.create with model claude-haiku-4-5-20251001 and max_tokens: 256', async () => {
    // Arrange: enough data so generateInsights proceeds to call Claude
    mockGroupBy.mockResolvedValue([
      { partyLedgerId: 'ledger-test', _sum: { totalAmount: new Decimal('150000') } },
    ] as never)
    mockLedgerFindUnique.mockResolvedValue({ id: 'ledger-test', name: 'ABC Corp', companyId: 'cid' } as never)
    mockEntryFindMany.mockResolvedValue([
      { amount: new Decimal('30000'), ledger: { group: { name: 'Electricity' } } },
    ] as never)
    mockAggregate
      .mockResolvedValueOnce({ _sum: { cgstAmount: new Decimal('6750'), sgstAmount: new Decimal('6750'), igstAmount: new Decimal('0') } } as never)
      .mockResolvedValueOnce({ _sum: { cgstAmount: new Decimal('5000'), sgstAmount: new Decimal('5000'), igstAmount: new Decimal('0') } } as never)

    // Act
    await generateInsights('cid')

    // Assert: Claude called with correct model and max_tokens
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
      })
    )
  })
})
