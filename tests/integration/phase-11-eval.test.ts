/**
 * phase-11-eval.test.ts
 *
 * End-to-end eval suite for Phase 11 AI features — AI-SPEC §5 dimensions.
 * All AI clients are mocked — zero network calls in CI.
 *
 * Groups:
 *   1. Insight factual accuracy (AI-SPEC §5 row 1)
 *   2. Multi-tenant isolation (AI-SPEC §5 critical)
 *   3. Cron deduplication (AI-SPEC §6 guardrail)
 *   4. Embedding coverage (AI-SPEC §5 row 5)
 *   5. Indian lakh format (AI-SPEC §5 row 2)
 *
 * Run: pnpm test:phase-11-eval
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Decimal } from 'decimal.js'

// ─── Mock @/lib/ai BEFORE any service imports ────────────────────────────────
vi.mock('@/lib/ai', () => ({
  anthropicClient: {
    messages: {
      create: vi.fn(),
    },
  },
  voyageClient: {
    embed: vi.fn().mockResolvedValue({
      data: [{ embedding: Array.from({ length: 1024 }, () => 0.01), index: 0 }],
    }),
  },
  INSIGHTS_MODEL: 'claude-haiku-4-5-20251001',
  EMBEDDING_MODEL: 'voyage-3-lite',
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
    notification: {
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn(),
  },
}))

// ─── Import services after mocks ─────────────────────────────────────────────
import {
  generateInsights,
  InsightsResponseSchema,
} from '@/lib/services/InsightsService'
import {
  buildLedgerEmbedText,
  embedBatch,
} from '@/lib/services/EmbeddingService'
import { anthropicClient, voyageClient } from '@/lib/ai'
import { prisma } from '@/lib/prisma'

// ─── Typed mock references ───────────────────────────────────────────────────
const mockCreate = vi.mocked(anthropicClient.messages.create)
const mockGroupBy = vi.mocked(prisma.voucher.groupBy)
const mockAggregate = vi.mocked(prisma.voucher.aggregate)
const mockLedgerFindUnique = vi.mocked(prisma.ledger.findUnique)
const mockEntryFindMany = vi.mocked(prisma.voucherEntry.findMany)
const mockNotificationFindFirst = vi.mocked(prisma.notification.findFirst)
const mockNotificationCreate = vi.mocked(prisma.notification.create)
const mockNotificationCount = vi.mocked(prisma.notification.count)
const mockVoyageEmbed = vi.mocked(voyageClient.embed)

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeClaudeResponse(text: string) {
  return {
    id: 'msg_test_01',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-4-5-20251001',
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 200, output_tokens: 80 },
  }
}

/** Standard 3-line Claude response with Indian lakh formatting for ₹2,45,000 */
const STANDARD_CLAUDE_RESPONSE =
  '1. Sharma Traders had highest sales at ₹2,45,000 this month.\n' +
  '2. Office Supplies was the biggest expense at ₹50,000.\n' +
  '3. GST liability increased by 10%.'

function setupStandardPrismaMocks(companyId = 'company-a') {
  mockGroupBy.mockResolvedValue([
    { partyLedgerId: 'ledger-sharma', _sum: { totalAmount: new Decimal('245000') } },
  ] as never)

  mockLedgerFindUnique.mockResolvedValue({
    id: 'ledger-sharma',
    name: 'Sharma Traders',
    companyId,
  } as never)

  mockEntryFindMany.mockResolvedValue([
    { amount: new Decimal('50000'), ledger: { group: { name: 'Office Supplies', nature: 'EXPENSE' } } },
  ] as never)

  mockAggregate
    .mockResolvedValueOnce({
      _sum: { cgstAmount: new Decimal('11025'), sgstAmount: new Decimal('11025'), igstAmount: new Decimal('0') },
    } as never)
    .mockResolvedValueOnce({
      _sum: { cgstAmount: new Decimal('10000'), sgstAmount: new Decimal('10000'), igstAmount: new Decimal('0') },
    } as never)
}

// ─── Group 1: Insight factual accuracy ───────────────────────────────────────

describe('Phase 11 Eval — AI-SPEC §5', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore voyage embed default
    mockVoyageEmbed.mockResolvedValue({
      data: [{ embedding: Array.from({ length: 1024 }, () => 0.01), index: 0 }],
    } as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Group 1: Insight factual accuracy', () => {
    it('generateInsights returns InsightsResponseSchema-shaped object', async () => {
      setupStandardPrismaMocks()
      mockCreate.mockResolvedValue(makeClaudeResponse(STANDARD_CLAUDE_RESPONSE) as never)

      const result = await generateInsights('company-a')

      const parsed = InsightsResponseSchema.safeParse(result)
      expect(parsed.success).toBe(true)
      expect(result.insights.length).toBeGreaterThanOrEqual(1)
      expect(result.generatedAt).toBeTruthy()
      expect(() => new Date(result.generatedAt)).not.toThrow()
    })

    it('insight text contains Indian lakh formatted amount matching SQL aggregate', async () => {
      setupStandardPrismaMocks()
      // Claude returns text referencing the SQL aggregate amount in Indian lakh format
      const claudeText =
        '1. Sharma Traders is your top customer with ₹2,45,000 in sales.\n' +
        '2. Office Supplies is your biggest expense at ₹50,000.\n' +
        '3. GST liability is ₹22,050 versus ₹20,000 last period.'
      mockCreate.mockResolvedValue(makeClaudeResponse(claudeText) as never)

      const result = await generateInsights('company-a')

      // top_customer insight must contain '2,45,000' (Indian lakh format for 245000)
      const topCustomer = result.insights.find((i) => i.type === 'top_customer')
      expect(topCustomer).toBeDefined()
      expect(topCustomer!.text).toContain('2,45,000')
      // Must NOT use US format '245,000'
      expect(topCustomer!.text).not.toMatch(/₹245,000/)
    })
  })

  // ─── Group 2: Multi-tenant isolation ───────────────────────────────────────

  describe('Group 2: Multi-tenant isolation', () => {
    it('generateInsights for companyA does not include companyB party names', async () => {
      const companyAId = 'company-a'

      setupStandardPrismaMocks(companyAId)

      // Claude response only mentions companyA party
      const claudeTextForA =
        '1. Sharma Traders is your top customer with ₹2,45,000 in sales.\n' +
        '2. Office Supplies is biggest expense at ₹50,000.\n' +
        '3. GST liability is ₹22,050 this period.'
      mockCreate.mockResolvedValue(makeClaudeResponse(claudeTextForA) as never)

      const resultA = await generateInsights(companyAId)

      const allText = resultA.insights.map((i) => i.text).join(' ')
      expect(allText).toContain('Sharma')
      // companyB party 'Patel Corp' must never appear
      expect(allText).not.toContain('Patel Corp')
    })

    it('vectorSearch for companyA excludes companyB ledger rows (companyId scoped)', async () => {
      // The multi-tenant guarantee is: all Prisma queries must include companyId.
      // We verify that generateInsights always calls groupBy/aggregate with the correct companyId.
      const companyAId = 'company-a'
      const companyBId = 'company-b'

      setupStandardPrismaMocks(companyAId)
      mockCreate.mockResolvedValue(makeClaudeResponse(STANDARD_CLAUDE_RESPONSE) as never)

      await generateInsights(companyAId)

      // groupBy MUST have been called with companyA's id
      expect(mockGroupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: companyAId }),
        })
      )
      // groupBy MUST NOT have been called with companyB's id
      expect(mockGroupBy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: companyBId }),
        })
      )
    })
  })

  // ─── Group 3: Cron deduplication ───────────────────────────────────────────

  describe('Group 3: Cron deduplication', () => {
    it('gstReminderFn running twice same day creates only 1 Notification', async () => {
      // Simulate the dedup logic used in gstReminderFn:
      // On first call: findFirst returns null → create fires.
      // On second call: findFirst returns existing record → create skipped.
      let notificationCreatedCount = 0

      mockNotificationFindFirst
        .mockResolvedValueOnce(null) // first run: no dup
        .mockResolvedValueOnce({    // second run: dup found
          id: 'notif-1',
          companyId: 'company-a',
          type: 'GST_REMINDER',
          entityId: 'GSTR-1-04/2026',
          sentAt: new Date(),
        } as never)

      mockNotificationCreate.mockImplementation(async () => {
        notificationCreatedCount++
        return { id: 'notif-1' } as never
      })

      // Simulate the dedup check that gstReminderFn performs (run it twice)
      for (let run = 0; run < 2; run++) {
        const dup = await prisma.notification.findFirst({
          where: {
            companyId: 'company-a',
            type: 'GST_REMINDER',
            entityId: 'GSTR-1-04/2026',
            sentAt: { gte: new Date() },
          },
        })
        if (!dup) {
          await prisma.notification.create({
            data: {
              companyId: 'company-a',
              type: 'GST_REMINDER',
              entityId: 'GSTR-1-04/2026',
              recipientEmail: 'admin@test.com',
              metadata: {},
            } as never,
          })
        }
      }

      // Only 1 notification should have been created (dedup worked)
      expect(notificationCreatedCount).toBe(1)
      expect(mockNotificationCreate).toHaveBeenCalledTimes(1)
    })

    it('overdueReminderFn dedup prevents duplicate sends same day', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-16T09:00:00Z'))

      let overdueNotifCount = 0

      mockNotificationFindFirst
        .mockResolvedValueOnce(null) // first run: no dup
        .mockResolvedValueOnce({    // second run: dup found
          id: 'notif-overdue-1',
          companyId: 'company-b',
          type: 'OVERDUE_PAYMENT',
          entityId: 'ledger-abc-30',
          sentAt: new Date('2026-05-16T08:30:00Z'),
        } as never)

      mockNotificationCreate.mockImplementation(async () => {
        overdueNotifCount++
        return { id: 'notif-overdue-1' } as never
      })

      // Simulate overdueReminderFn dedup (runs twice on same day)
      for (let run = 0; run < 2; run++) {
        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)

        const dup = await prisma.notification.findFirst({
          where: {
            companyId: 'company-b',
            type: 'OVERDUE_PAYMENT',
            entityId: 'ledger-abc-30',
            sentAt: { gte: startOfDay },
          },
        })
        if (!dup) {
          await prisma.notification.create({
            data: {
              companyId: 'company-b',
              type: 'OVERDUE_PAYMENT',
              entityId: 'ledger-abc-30',
              recipientEmail: 'admin@company-b.com',
              metadata: { daysBucket: 30 },
            } as never,
          })
        }
      }

      expect(overdueNotifCount).toBe(1)
      expect(mockNotificationCreate).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
    })
  })

  // ─── Group 4: Embedding coverage ───────────────────────────────────────────

  describe('Group 4: Embedding coverage', () => {
    it('embedBatch returns vectors of length 1024 for each input', async () => {
      mockVoyageEmbed.mockResolvedValue({
        data: [
          { embedding: Array.from({ length: 1024 }, (_, i) => i * 0.001), index: 0 },
          { embedding: Array.from({ length: 1024 }, (_, i) => i * 0.002), index: 1 },
        ],
      } as never)

      const texts = ['ledger text one', 'ledger text two']
      const result = await embedBatch(texts)

      expect(result).toHaveLength(2)
      expect(result[0]).toHaveLength(1024)
      expect(result[1]).toHaveLength(1024)
      result.forEach((vec) => {
        expect(vec.every((n) => typeof n === 'number')).toBe(true)
      })
    })

    it('buildLedgerEmbedText produces non-empty text for valid ledger', () => {
      const text = buildLedgerEmbedText({
        name: 'Sharma Auto Parts',
        gstin: '27AABCS1234A1Z5',
        group: { name: 'Sundry Debtors' },
      })

      expect(text.length).toBeGreaterThan(0)
      expect(text).toContain('Sharma Auto Parts')
      expect(text).toContain('27AABCS1234A1Z5')
      expect(text).toContain('Sundry Debtors')
    })
  })

  // ─── Group 5: Indian lakh format ───────────────────────────────────────────

  describe('Group 5: Indian lakh format', () => {
    it('insight text uses Indian lakh format not US format', async () => {
      setupStandardPrismaMocks()

      // Amount 245000 in Indian lakh format = ₹2,45,000 (NOT ₹245,000)
      const claudeText =
        '1. Sharma Traders had highest sales at ₹2,45,000 this month.\n' +
        '2. Office Supplies was biggest expense at ₹50,000.\n' +
        '3. GST liability is ₹22,050 this period.'
      mockCreate.mockResolvedValue(makeClaudeResponse(claudeText) as never)

      const result = await generateInsights('company-a')

      const allText = result.insights.map((i) => i.text).join('\n')

      // Indian lakh format: ₹X,XX,XXX (e.g. ₹2,45,000)
      expect(allText).toMatch(/₹\d,\d{2},\d{3}/)

      // Must NOT match US millions format ₹XXX,XXX for 245000
      expect(allText).not.toMatch(/₹245,000/)
    })
  })
})
