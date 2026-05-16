/**
 * HybridSearch.ts
 * Three search primitives for the hybrid vector + text search pipeline.
 *
 * Exports:
 *   embedQuery   — embed a search query via Voyage AI; returns null on failure (graceful fallback)
 *   vectorSearch — run pgvector cosine similarity queries for ledgers + vouchers
 *   rrfMerge     — merge ranked lists via Reciprocal Rank Fusion (k=60)
 *
 * Security: every $queryRaw includes WHERE "companyId" = ${companyId} inline.
 *           pgvector queries do NOT go through the Prisma extension companyId filter —
 *           the WHERE clause must be explicit in raw SQL. (AI-SPEC failure mode #2)
 *
 * AI-SPEC pitfall #2: embedding array MUST be JSON.stringify()'d before the ::vector cast.
 */

import { voyageClient, EMBEDDING_MODEL } from '@/lib/ai'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SearchResultType = 'ledger' | 'voucher' | 'party' | 'stockItem'

export interface SearchResult {
  id: string
  type: SearchResultType
  label: string
  sublabel?: string
  href: string
}

// ---------------------------------------------------------------------------
// Constants (redeclared locally to avoid circular import with search/route.ts)
// TODO: consolidate into a shared lib/search-constants.ts when the route is refactored
// ---------------------------------------------------------------------------

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

// Ledger gstRegType values that indicate a "party" (customer/supplier with GSTIN)
const PARTY_GST_REG_TYPES = new Set(['REGULAR', 'COMPOSITION'])

// ---------------------------------------------------------------------------
// embedQuery
// ---------------------------------------------------------------------------

/**
 * Embed a search query string via Voyage AI.
 *
 * - Trims q; returns null immediately for empty strings.
 * - Returns null (does NOT throw) on any Voyage error so the search route
 *   can fall back to text-only results gracefully (AI-SPEC §6 guardrail).
 *
 * @param q Search query string
 * @returns 1024-dimensional embedding vector, or null on failure/empty input
 */
export async function embedQuery(q: string): Promise<number[] | null> {
  const trimmed = q.trim()
  if (!trimmed) return null

  try {
    const response = await voyageClient.embed({
      input: [trimmed],
      model: EMBEDDING_MODEL,
    })
    if (!response.data || response.data.length === 0) return null
    return response.data[0].embedding as number[]
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[search] vector embed failed — falling back to text-only:', message)
    return null
  }
}

// ---------------------------------------------------------------------------
// vectorSearch
// ---------------------------------------------------------------------------

interface VectorSearchParams {
  companyId: string
  vec: number[]
  limit: number
}

interface VectorSearchResult {
  ledgers: SearchResult[]
  vouchers: SearchResult[]
}

/**
 * Run parallel pgvector cosine similarity queries for ledgers and vouchers.
 *
 * CRITICAL (T-11-04-01): Both $queryRaw blocks include WHERE "companyId" = ${companyId}
 * to enforce multi-tenant isolation. Raw SQL is not covered by the Prisma companyId extension.
 *
 * CRITICAL (AI-SPEC pitfall #2): vec is JSON.stringify()'d → passed as ::vector cast.
 *
 * @param params companyId from session only; vec is the embedded query; limit caps results
 * @returns ledger and voucher SearchResult arrays sorted by cosine similarity descending
 */
export async function vectorSearch(params: VectorSearchParams): Promise<VectorSearchResult> {
  const { companyId, vec, limit } = params

  // AI-SPEC pitfall #2: must stringify before ::vector cast
  const vecStr = JSON.stringify(vec)

  const [ledgerRows, voucherRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        id: string
        name: string
        gstin: string | null
        gstRegType: string | null
        sim: number
      }>
    >`
      SELECT id, name, gstin, "gstRegType", 1 - (embedding <=> ${vecStr}::vector) AS sim
      FROM "ledgers"
      WHERE "companyId" = ${companyId}
        AND embedding IS NOT NULL
        AND "isActive" = true
      ORDER BY embedding <=> ${vecStr}::vector
      LIMIT ${limit}
    `,

    prisma.$queryRaw<
      Array<{
        id: string
        voucherNo: string
        voucherType: string
        date: Date
        partyName: string | null
        sim: number
      }>
    >`
      SELECT v.id, v."voucherNo", v."voucherType", v.date,
             pl.name AS "partyName",
             1 - (v.embedding <=> ${vecStr}::vector) AS sim
      FROM "vouchers" v
      LEFT JOIN "ledgers" pl ON pl.id = v."partyLedgerId"
      WHERE v."companyId" = ${companyId}
        AND v.embedding IS NOT NULL
      ORDER BY v.embedding <=> ${vecStr}::vector
      LIMIT ${limit}
    `,
  ])

  // Map ledger rows → SearchResult
  // Distinguish 'party' (REGULAR/COMPOSITION gstRegType) from 'ledger' (all others)
  const ledgers: SearchResult[] = ledgerRows.map((row) => {
    const isParty = row.gstRegType !== null && PARTY_GST_REG_TYPES.has(row.gstRegType)
    return {
      id: row.id,
      type: isParty ? 'party' : 'ledger',
      label: row.name,
      sublabel: row.gstin ?? undefined,
      href: `/masters/ledgers/${row.id}`,
    }
  })

  // Map voucher rows → SearchResult
  const vouchers: SearchResult[] = voucherRows.map((row) => {
    const slug = VOUCHER_TYPE_SLUG[row.voucherType] ?? row.voucherType.toLowerCase()
    const dateStr = row.date instanceof Date
      ? row.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : String(row.date)
    return {
      id: row.id,
      type: 'voucher',
      label: `${row.voucherNo}${row.partyName ? ` — ${row.partyName}` : ''}`,
      sublabel: dateStr,
      href: `/vouchers/${slug}/${row.id}`,
    }
  })

  return { ledgers, vouchers }
}

// ---------------------------------------------------------------------------
// rrfMerge
// ---------------------------------------------------------------------------

/**
 * Reciprocal Rank Fusion — merge multiple ranked result lists by RRF score.
 *
 * Algorithm (D-10, k=60 standard default):
 *   For each list: score(item) += 1 / (k + rank + 1)  [rank is 0-based]
 * Items appearing in multiple lists accumulate higher scores → ranked first.
 *
 * Pure function — no I/O, no Prisma, no fetch, no side effects.
 *
 * @param lists   Ranked SearchResult arrays (any number, including zero items)
 * @param k       RRF smoothing constant (default 60)
 * @returns       Deduplicated, RRF-ranked SearchResult array
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rrfMerge(...args: any[]): SearchResult[] {
  // Call signatures supported:
  //   rrfMerge([list1], [list2], 60)      — variadic arrays + optional k at end
  //   rrfMerge([[list1], [list2]])         — single array-of-arrays
  //   rrfMerge([[list1], [list2]], 60)     — array-of-arrays + k
  let lists: SearchResult[][]
  let k: number

  if (args.length === 0) {
    return []
  }

  // If first arg is an array of arrays (array whose first element is also an array or empty)
  if (
    args.length >= 1 &&
    Array.isArray(args[0]) &&
    (args[0].length === 0 || !Array.isArray(args[0][0]))
  ) {
    // Each positional arg is a list (SearchResult[]), last may be k (number)
    if (typeof args[args.length - 1] === 'number') {
      k = args[args.length - 1] as number
      lists = args.slice(0, -1) as SearchResult[][]
    } else {
      k = 60
      lists = args as SearchResult[][]
    }
  } else {
    // args[0] is SearchResult[][] (array of arrays)
    lists = args[0] as SearchResult[][]
    k = typeof args[1] === 'number' ? args[1] : 60
  }
  const scoreMap = new Map<string, { result: SearchResult; score: number }>()

  for (const list of lists) {
    list.forEach((item, rank) => {
      const existing = scoreMap.get(item.id)
      const delta = 1 / (k + rank + 1)
      if (existing) {
        existing.score += delta
      } else {
        scoreMap.set(item.id, { result: item, score: delta })
      }
    })
  }

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.result)
}
