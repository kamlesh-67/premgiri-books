import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { embedQuery, vectorSearch, rrfMerge } from '@/lib/services/HybridSearch'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SearchResultType = 'ledger' | 'voucher' | 'party' | 'stockItem'

interface SearchResult {
  id: string
  type: SearchResultType
  label: string
  sublabel?: string
  href: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_TYPES: SearchResultType[] = ['ledger', 'voucher', 'party', 'stockItem']

const _TYPE_ORDER: Record<SearchResultType, number> = {
  ledger: 0,
  voucher: 1,
  party: 2,
  stockItem: 3,
}

const VOUCHER_TYPE_SLUG: Record<string, string> = {
  SALES: 'sales',
  PURCHASE: 'purchase',
  RECEIPT: 'receipt',
  PAYMENT: 'payment',
  JOURNAL: 'journal',
  CONTRA: 'contra',
  CREDIT_NOTE: 'credit-note',
  DEBIT_NOTE: 'debit-note',
}

// ---------------------------------------------------------------------------
// Zod schema — validates all query params before touching DB (T-10-01-03)
// ---------------------------------------------------------------------------

const searchParamsSchema = z.object({
  q: z.string().default(''),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  types: z.string().optional(),
})

// ---------------------------------------------------------------------------
// GET /api/v1/search
//
// Security:
//  - Auth check FIRST — 401 before any body/param parsing (T-10-01-04)
//  - companyId ALWAYS from session.companyId — never from query params (T-10-01-01)
//  - All four Prisma queries include companyId guard (T-10-01-02)
//  - limit clamped to max 50; empty q short-circuits (T-10-01-03)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Auth guard — FIRST (T-10-01-04)
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // companyId ALWAYS from session — never from user-supplied input (T-10-01-01)
  const companyId = session.companyId

  // Parse + validate query params with Zod
  const rawParams = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = searchParamsSchema.safeParse(rawParams)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters', issues: parsed.error.issues }, { status: 400 })
  }

  const { q: rawQ, limit, types: typesParam } = parsed.data
  const q = rawQ.trim()

  // Determine which entity types to query
  const requestedTypes: Set<SearchResultType> = typesParam
    ? new Set(
        typesParam
          .split(',')
          .map((t) => t.trim())
          .filter((t): t is SearchResultType => VALID_TYPES.includes(t as SearchResultType))
      )
    : new Set(VALID_TYPES)

  // Short-circuit: empty query → no DB calls (T-10-01-03)
  if (q === '') {
    return NextResponse.json({ results: [] })
  }

  // Online check — skip embedQuery when Electron reports offline (AI-01)
  let isOnline = true
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    isOnline = (require('electron') as { net: { isOnline: () => boolean } }).net.isOnline()
  } catch {}

  // Performance timer for slow-query monitoring
  const t0 = performance.now()

  try {
    // ── 1. Embed the query (vector path) — only when online ──
    const queryVecPromise = isOnline
      ? embedQuery(q).then(async (queryVec) => {
          if (!queryVec) return { ledgers: [], vouchers: [] }
          return vectorSearch({ companyId, vec: queryVec, limit })
        })
      : Promise.resolve({ ledgers: [], vouchers: [] })

    // ── 2. Run all requested entity iLike queries in parallel ──
    const [ledgerRows, voucherRows, partyRows, stockItemRows, vectorResults] = await Promise.all([
      // 1. Ledgers — exclude parties (REGULAR/COMPOSITION have GSTIN; they go in the party bucket)
      requestedTypes.has('ledger')
        ? prisma.ledger.findMany({
            where: {
              companyId,
              isActive: true,
              gstRegType: { notIn: ['REGULAR', 'COMPOSITION'] },
              name: { contains: q },
            },
            select: { id: true, name: true, gstin: true },
            take: limit,
          })
        : [],

      // 2. Vouchers — match by voucherNo or party name
      requestedTypes.has('voucher')
        ? prisma.voucher.findMany({
            where: {
              companyId,
              OR: [
                { voucherNo: { contains: q } },
                { partyLedger: { name: { contains: q } } },
              ],
            },
            select: {
              id: true,
              voucherType: true,
              voucherNo: true,
              date: true,
              partyLedger: { select: { name: true } },
            },
            take: limit,
          })
        : [],

      // 3. Parties — Ledger rows that ARE REGULAR or COMPOSITION GST registrations
      requestedTypes.has('party')
        ? prisma.ledger.findMany({
            where: {
              companyId,
              isActive: true,
              gstRegType: { in: ['REGULAR', 'COMPOSITION'] },
              OR: [
                { name: { contains: q } },
                { gstin: { contains: q } },
              ],
            },
            select: { id: true, name: true, gstin: true },
            take: limit,
          })
        : [],

      // 4. Stock items
      requestedTypes.has('stockItem')
        ? prisma.stockItem.findMany({
            where: {
              companyId,
              isActive: true,
              name: { contains: q },
            },
            select: { id: true, name: true, hsnCode: true },
            take: limit,
          })
        : [],

      // 5. Vector path (resolves to empty arrays if Voyage unavailable)
      queryVecPromise,
    ])

    const elapsed = performance.now() - t0
    if (elapsed > 400) {
      console.warn('[search] slow query', elapsed.toFixed(0), 'ms, q:', q)
    }

    // Log hybrid mode for ops visibility
    if (vectorResults.ledgers.length > 0 || vectorResults.vouchers.length > 0) {
      console.log('[search] hybrid mode, q:', q)
    }

    // ── 3. Map iLike rows → SearchResult ──

    const ledgerResults: SearchResult[] = (ledgerRows as Array<{ id: string; name: string; gstin: string | null }>).map(
      (row) => ({
        id: row.id,
        type: 'ledger',
        label: row.name,
        sublabel: row.gstin ?? undefined,
        href: `/masters/ledgers/${row.id}`,
      })
    )

    const voucherResults: SearchResult[] = (
      voucherRows as Array<{
        id: string
        voucherType: string
        voucherNo: string
        date: Date
        partyLedger: { name: string } | null
      }>
    ).map((row) => ({
      id: row.id,
      type: 'voucher',
      label: `${row.voucherNo}${row.partyLedger?.name ? ` — ${row.partyLedger.name}` : ''}`,
      sublabel: row.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      href: `/vouchers/${VOUCHER_TYPE_SLUG[row.voucherType] ?? row.voucherType.toLowerCase()}/${row.id}`,
    }))

    const partyResults: SearchResult[] = (partyRows as Array<{ id: string; name: string; gstin: string | null }>).map(
      (row) => ({
        id: row.id,
        type: 'party',
        label: row.name,
        sublabel: row.gstin ?? undefined,
        href: `/masters/ledgers/${row.id}`,
      })
    )

    const stockItemResults: SearchResult[] = (
      stockItemRows as Array<{ id: string; name: string; hsnCode: string }>
    ).map((row) => ({
      id: row.id,
      type: 'stockItem',
      label: row.name,
      sublabel: row.hsnCode || undefined,
      href: `/masters/stock-items?highlight=${row.id}`,
    }))

    // ── 4. RRF merge: text results + vector results → ranked by relevance ──
    // Text list: all 4 entity types concatenated (preserving type-order within)
    const textList: SearchResult[] = [
      ...ledgerResults,
      ...voucherResults,
      ...partyResults,
      ...stockItemResults,
    ]
    // Vector list: ledgers + vouchers from pgvector
    const vectorList: SearchResult[] = [
      ...vectorResults.ledgers,
      ...vectorResults.vouchers,
    ]

    const results: SearchResult[] = rrfMerge(textList, vectorList, 60).slice(0, limit)

    return NextResponse.json({ results })
  } catch (err) {
    console.error('[search] query failed', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
