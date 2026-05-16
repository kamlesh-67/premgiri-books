/**
 * InsightsService.ts
 *
 * Smart Insights backend service — Phase 11 Plan 02.
 * Runs 3 SQL aggregates for the trailing 30 days, sends pre-computed numbers to
 * Claude Haiku (zero hallucination risk), Zod-validates the response into 3 typed
 * insights, and returns the result.
 *
 * Server-only. No HTTP, no auth — caller (GET /api/v1/insights) handles those.
 * All Prisma queries include companyId per CLAUDE.md non-negotiable rule 2.
 */

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { anthropicClient, INSIGHTS_MODEL } from '@/lib/ai'
import { formatINR } from '@/lib/utils/format'
import { Decimal } from 'decimal.js'

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

export const InsightSchema = z.object({
  type: z.enum(['top_customer', 'biggest_expense', 'gst_trend']),
  text: z.string().min(10).max(200),
  generatedAt: z.string().datetime(),
})

export const InsightsResponseSchema = z.object({
  // .max(3) not .length(3) — allows empty fallback (graceful degradation per AI-SPEC §6)
  insights: z.array(InsightSchema).max(3),
  generatedAt: z.string().datetime(),
})

export type Insight = z.infer<typeof InsightSchema>
export type InsightsResponse = z.infer<typeof InsightsResponseSchema>

// ─── Insight Types (fixed order maps to DB queries) ──────────────────────────
const INSIGHT_TYPES = ['top_customer', 'biggest_expense', 'gst_trend'] as const

// ─── parseInsights ───────────────────────────────────────────────────────────

/**
 * Parse Claude's numbered text output into 3 typed Insight objects.
 * Per AI-SPEC §4b: split on newlines, filter blank, take first 3,
 * strip "^\d+\.\s*" prefix, build array with types in fixed order.
 *
 * Throws (caller catches) if any Zod validation fails.
 */
function parseInsights(text: string, generatedAt: string): Insight[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 3)

  return lines.map((rawLine, i) => {
    const stripped = rawLine.replace(/^\d+\.\s*/, '').trim()
    return InsightSchema.parse({
      type: INSIGHT_TYPES[i],
      text: stripped,
      generatedAt,
    })
  })
}

// ─── Query A — Top Customer ───────────────────────────────────────────────────

async function getTopCustomer(
  companyId: string,
  startDate: Date
): Promise<{ name: string; amount: Decimal } | null> {
  const rows = await prisma.voucher.groupBy({
    by: ['partyLedgerId'],
    where: {
      companyId,
      voucherType: 'SALES',
      status: 'POSTED',
      date: { gte: startDate },
      partyLedgerId: { not: null },
    },
    _sum: { totalAmount: true },
    orderBy: { _sum: { totalAmount: 'desc' } },
    take: 1,
  })

  if (rows.length === 0 || !rows[0].partyLedgerId) return null

  const totalAmount = rows[0]._sum.totalAmount
  if (!totalAmount) return null

  const ledger = await prisma.ledger.findUnique({
    where: { id: rows[0].partyLedgerId },
  })

  if (!ledger) return null

  return {
    name: ledger.name,
    amount: new Decimal(totalAmount.toString()),
  }
}

// ─── Query B — Biggest Expense ────────────────────────────────────────────────

async function getBiggestExpense(
  companyId: string,
  startDate: Date
): Promise<{ categoryName: string; amount: Decimal } | null> {
  // Fetch DR entries from POSTED PURCHASE/PAYMENT vouchers in last 30 days
  // grouped by account group name (expense categories)
  const entries = await prisma.voucherEntry.findMany({
    where: {
      voucher: {
        companyId,
        voucherType: { in: ['PURCHASE', 'PAYMENT'] },
        status: 'POSTED',
        date: { gte: startDate },
      },
      drCr: 'DR',
    },
    include: {
      ledger: {
        include: {
          group: { select: { name: true, nature: true } },
        },
      },
    },
  })

  // Group by account group name, sum amounts, filter to EXPENSE nature only
  const categoryTotals = new Map<string, Decimal>()

  for (const entry of entries) {
    const groupName = entry.ledger?.group?.name
    const nature = entry.ledger?.group?.nature
    if (!groupName || nature !== 'EXPENSE') continue

    const current = categoryTotals.get(groupName) ?? new Decimal(0)
    categoryTotals.set(groupName, current.plus(new Decimal(entry.amount.toString())))
  }

  if (categoryTotals.size === 0) return null

  // Find the category with the largest total
  let maxCategory = ''
  let maxAmount = new Decimal(0)
  for (const [categoryName, amount] of categoryTotals.entries()) {
    if (amount.greaterThan(maxAmount)) {
      maxAmount = amount
      maxCategory = categoryName
    }
  }

  if (!maxCategory) return null

  return { categoryName: maxCategory, amount: maxAmount }
}

// ─── Query C — GST Trend ──────────────────────────────────────────────────────

async function getGstTrend(
  companyId: string,
  startDate: Date,
  prevStartDate: Date
): Promise<{ current: Decimal; previous: Decimal }> {
  const [currentAgg, previousAgg] = await Promise.all([
    prisma.voucher.aggregate({
      where: {
        companyId,
        voucherType: 'SALES',
        status: 'POSTED',
        date: { gte: startDate },
      },
      _sum: { cgstAmount: true, sgstAmount: true, igstAmount: true },
    }),
    prisma.voucher.aggregate({
      where: {
        companyId,
        voucherType: 'SALES',
        status: 'POSTED',
        date: { gte: prevStartDate, lt: startDate },
      },
      _sum: { cgstAmount: true, sgstAmount: true, igstAmount: true },
    }),
  ])

  const toDecimal = (v: Decimal | null | undefined): Decimal =>
    v ? new Decimal(v.toString()) : new Decimal(0)

  const currentGst = toDecimal(currentAgg._sum.cgstAmount)
    .plus(toDecimal(currentAgg._sum.sgstAmount))
    .plus(toDecimal(currentAgg._sum.igstAmount))

  const previousGst = toDecimal(previousAgg._sum.cgstAmount)
    .plus(toDecimal(previousAgg._sum.sgstAmount))
    .plus(toDecimal(previousAgg._sum.igstAmount))

  return { current: currentGst, previous: previousGst }
}

// ─── Main export: generateInsights ───────────────────────────────────────────

/**
 * Generate 3 plain-English business insights for the given company.
 *
 * Flow:
 * 1. Compute 30-day date window
 * 2. Run 3 Prisma queries in parallel (top customer, biggest expense, GST trend)
 * 3. If ALL 3 return empty/zero → return graceful fallback { insights: [], generatedAt }
 * 4. Build a strictly-grounded prompt with Indian lakh-formatted numbers
 * 5. Call Claude Haiku with max_tokens: 256
 * 6. Parse response into 3 typed Insight objects via Zod
 * 7. On ANY failure (Zod or API) → return { insights: [] } — never throw to caller
 *
 * @param companyId - From session.user.companyId — NEVER from user input
 */
export async function generateInsights(companyId: string): Promise<InsightsResponse> {
  const generatedAt = new Date().toISOString()

  // Step 1: Date windows
  const now = Date.now()
  const startDate = new Date(now - 30 * 86_400_000) // 30 days ago
  const prevStartDate = new Date(now - 60 * 86_400_000) // 60 days ago

  try {
    // Step 2: Run 3 queries in parallel (AI-SPEC §4b Async-First Design)
    const [topCustomer, biggestExpense, gstTrend] = await Promise.all([
      getTopCustomer(companyId, startDate),
      getBiggestExpense(companyId, startDate),
      getGstTrend(companyId, startDate, prevStartDate),
    ])

    // Step 3: Graceful fallback — no data at all
    const hasNoData =
      topCustomer === null &&
      biggestExpense === null &&
      gstTrend.current.isZero() &&
      gstTrend.previous.isZero()

    if (hasNoData) {
      return { insights: [], generatedAt }
    }

    // Step 4: Build strictly-grounded prompt (AI-SPEC §4b Prompt Engineering Discipline)
    const topCustomerLine = topCustomer
      ? `- Top customer: ${topCustomer.name} — ${formatINR(topCustomer.amount)}`
      : '- Top customer: No sales recorded in the last 30 days'

    const biggestExpenseLine = biggestExpense
      ? `- Biggest expense: ${biggestExpense.categoryName} — ${formatINR(biggestExpense.amount)}`
      : '- Biggest expense: No expense data recorded in the last 30 days'

    const gstTrendLine =
      `- GST liability: ${formatINR(gstTrend.current)} vs ${formatINR(gstTrend.previous)} previous period`

    const systemPrompt =
      'You are a business analyst. You only report numbers you are given. Do not add analysis beyond the data.'

    const userPrompt = `Here is data for the last 30 days:
${topCustomerLine}
${biggestExpenseLine}
${gstTrendLine}

Write exactly 3 insights in plain English for an Indian business owner. Number each line 1., 2., 3. Each insight must be one sentence. Use ₹ with Indian lakh format (e.g. ₹1,23,456). Do not use accounting jargon.`

    // Step 5: Call Claude Haiku
    const message = await anthropicClient.messages.create({
      model: INSIGHTS_MODEL,
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    // Step 6: Extract text from response
    const rawText =
      message.content[0]?.type === 'text' ? message.content[0].text : ''

    // Step 7: Parse and Zod-validate insights
    try {
      const insights = parseInsights(rawText, generatedAt)
      const response = InsightsResponseSchema.parse({ insights, generatedAt })
      return response
    } catch {
      // Zod parse failure — graceful fallback (AI-SPEC §6 guardrail row 3)
      return { insights: [], generatedAt }
    }
  } catch {
    // API error or unexpected failure — graceful fallback (AI-SPEC §6 guardrail row 2)
    return { insights: [], generatedAt }
  }
}
