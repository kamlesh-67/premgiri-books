/**
 * HybridSearch.test.ts
 * 7 behaviors for embedQuery, vectorSearch, rrfMerge — Plan 11-04 Task 1.
 *
 * Tests 1-2: embedQuery (Voyage AI mock)
 * Tests 3-4: vectorSearch (Prisma $queryRaw mock — cross-tenant isolation)
 * Tests 5-7: rrfMerge (pure function — no mocks needed)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock @/lib/ai so voyageClient.embed is controlled
vi.mock('@/lib/ai', () => {
  const mockEmbed = vi.fn()
  return {
    voyageClient: { embed: mockEmbed },
    EMBEDDING_MODEL: 'voyage-3-lite',
  }
})

// Mock @/lib/prisma so $queryRaw doesn't hit a real DB
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

// Import after mocks are registered
import { embedQuery, vectorSearch, rrfMerge } from './HybridSearch'
import { voyageClient } from '@/lib/ai'
import { prisma } from '@/lib/prisma'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a 1024-element embedding vector. */
function makeVec(seed = 0): number[] {
  return Array.from({ length: 1024 }, (_, i) => (seed + i) * 0.001)
}

/** Build a minimal SearchResult. */
function makeResult(id: string, type: 'ledger' | 'party' | 'voucher' | 'stockItem' = 'ledger') {
  return {
    id,
    type,
    label: `Label ${id}`,
    sublabel: undefined as string | undefined,
    href: `/masters/ledgers/${id}`,
  }
}

// ─── embedQuery ───────────────────────────────────────────────────────────────

describe('embedQuery', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  // Test 1: returns number[] of length 1024
  it('returns number[] of length 1024 when Voyage succeeds', async () => {
    const mockEmbedFn = vi.mocked(voyageClient.embed)
    const vec = makeVec()
    mockEmbedFn.mockResolvedValue({
      data: [{ embedding: vec, index: 0 }],
    } as never)

    const result = await embedQuery('test query')

    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(1024)
    expect(result!.every((n) => typeof n === 'number')).toBe(true)
  })

  // Test 2: returns null (does NOT throw) when Voyage rejects
  it('returns null gracefully when Voyage AI rejects (fallback to text-only)', async () => {
    const mockEmbedFn = vi.mocked(voyageClient.embed)
    mockEmbedFn.mockRejectedValue(new Error('Network timeout'))

    const result = await embedQuery('test query')

    expect(result).toBeNull()
  })
})

// ─── vectorSearch ─────────────────────────────────────────────────────────────

describe('vectorSearch', () => {
  const queryVec = makeVec(1)

  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  // Test 3: returns ledger + voucher arrays with SearchResult shape
  it('returns ledger and voucher result arrays with SearchResult shape', async () => {
    const mockQueryRaw = vi.mocked(prisma.$queryRaw)

    // First call: ledger rows
    const ledgerRow = {
      id: 'ledger-1',
      name: 'Cash Account',
      gstin: null,
      gstRegType: null,
      sim: 0.87,
    }
    // Second call: voucher rows
    const voucherRow = {
      id: 'voucher-1',
      voucherNo: 'SI-001',
      voucherType: 'SALES',
      date: new Date('2024-01-15'),
      partyName: 'Sharma Traders',
      sim: 0.82,
    }

    mockQueryRaw
      .mockResolvedValueOnce([ledgerRow])
      .mockResolvedValueOnce([voucherRow])

    const result = await vectorSearch({ companyId: 'company-a', vec: queryVec, limit: 10 })

    // Shape checks
    expect(result).toHaveProperty('ledgers')
    expect(result).toHaveProperty('vouchers')
    expect(result.ledgers).toHaveLength(1)
    expect(result.vouchers).toHaveLength(1)

    // Ledger SearchResult fields
    const ledger = result.ledgers[0]
    expect(ledger).toHaveProperty('id', 'ledger-1')
    expect(ledger).toHaveProperty('type', 'ledger')
    expect(ledger).toHaveProperty('label')
    expect(ledger).toHaveProperty('href')

    // Voucher SearchResult fields
    const voucher = result.vouchers[0]
    expect(voucher).toHaveProperty('id', 'voucher-1')
    expect(voucher).toHaveProperty('type', 'voucher')
    expect(voucher).toHaveProperty('label')
    expect(voucher).toHaveProperty('href')
  })

  // Test 4: cross-tenant isolation — companyId filter is in the SQL
  it('passes companyId filter in SQL so companyB rows cannot leak into companyA results', async () => {
    const mockQueryRaw = vi.mocked(prisma.$queryRaw)

    // Capture the raw SQL template tag calls to inspect
    const capturedTemplates: string[] = []
    mockQueryRaw.mockImplementation(((template: TemplateStringsArray, ..._values: unknown[]) => {
      // Join template parts to inspect the SQL skeleton
      capturedTemplates.push(template.join('?'))
      return Promise.resolve([])
    }) as never)

    await vectorSearch({ companyId: 'company-a', vec: queryVec, limit: 10 })

    // Both SQL calls must contain the companyId WHERE clause
    expect(capturedTemplates).toHaveLength(2)
    capturedTemplates.forEach((sql) => {
      expect(sql).toContain('"companyId"')
    })
  })
})

// ─── rrfMerge (pure function — no mocks) ─────────────────────────────────────

describe('rrfMerge', () => {
  const a = makeResult('a')
  const b = makeResult('b')
  const c = makeResult('c')
  const d = makeResult('d')

  // Test 5: item appearing in both lists ranks higher
  it('ranks b higher than a or d when b appears in both lists', () => {
    const merged = rrfMerge([a, b, c], [b, c, d], 60)

    const ids = merged.map((r) => r.id)
    const bIdx = ids.indexOf('b')
    const aIdx = ids.indexOf('a')
    const dIdx = ids.indexOf('d')

    // b must rank higher (earlier index) than a and d
    expect(bIdx).toBeGreaterThanOrEqual(0)
    expect(bIdx).toBeLessThan(aIdx)
    expect(bIdx).toBeLessThan(dIdx)
  })

  // Test 6: degenerate case — empty first list returns second list intact
  it('returns [b,c,d] when first list is empty', () => {
    const merged = rrfMerge([], [b, c, d], 60)
    const ids = merged.map((r) => r.id)
    expect(ids).toEqual(['b', 'c', 'd'])
  })

  // Test 7: preserves SearchResult shape (id/type/label/sublabel/href)
  it('preserves SearchResult shape on every returned item', () => {
    const partyItem = { ...makeResult('p', 'party'), sublabel: 'GSTIN-123' }
    const merged = rrfMerge([partyItem, a], [a, b], 60)

    merged.forEach((item) => {
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('type')
      expect(item).toHaveProperty('label')
      expect(item).toHaveProperty('href')
      // sublabel may be undefined (optional) but key existence not required
    })

    // Verify the party item (with sublabel) round-trips correctly
    const party = merged.find((r) => r.id === 'p')
    expect(party?.sublabel).toBe('GSTIN-123')
  })
})
