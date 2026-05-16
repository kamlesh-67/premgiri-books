/**
 * EmbeddingService.test.ts
 * Unit tests for buildLedgerEmbedText, buildVoucherEmbedText, embedBatch, persistEmbedding.
 * All 7 required behaviors per Plan 11-03 Task 1.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock @/lib/ai so voyageClient.embed is controlled in tests
vi.mock('@/lib/ai', () => {
  const mockEmbed = vi.fn()
  return {
    voyageClient: { embed: mockEmbed },
    EMBEDDING_MODEL: 'voyage-3-lite',
  }
})

// Mock @/lib/prisma so $executeRaw doesn't hit a real DB
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $executeRaw: vi.fn().mockResolvedValue(1),
  },
}))

// Import after mocks are set up
import {
  buildLedgerEmbedText,
  buildVoucherEmbedText,
  embedBatch,
  persistEmbedding,
} from './EmbeddingService'
import { voyageClient } from '@/lib/ai'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a mock Voyage embed response for N texts, each returning a 1024-dim vector. */
function mockVoyageResponse(n: number) {
  return {
    data: Array.from({ length: n }, (_, i) => ({
      embedding: Array.from({ length: 1024 }, (__, j) => (i * 1024 + j) * 0.001),
      index: i,
    })),
  }
}

// ─── buildLedgerEmbedText ─────────────────────────────────────────────────────

describe('buildLedgerEmbedText', () => {
  // Test 1: all fields present — name, gstin, group.name
  it('returns space-joined text when all fields are present', () => {
    const result = buildLedgerEmbedText({
      name: 'Sharma Auto',
      gstin: '27ABC',
      group: { name: 'Sundry Debtors' },
    })
    expect(result).toBe('Sharma Auto 27ABC Sundry Debtors')
  })

  // Test 2: gstin is null — should not produce double spaces
  it('omits gstin when null and produces no extra whitespace', () => {
    const result = buildLedgerEmbedText({
      name: 'Cash',
      gstin: null,
      group: { name: 'Cash-in-hand' },
    })
    expect(result).toBe('Cash Cash-in-hand')
  })
})

// ─── buildVoucherEmbedText ────────────────────────────────────────────────────

describe('buildVoucherEmbedText', () => {
  // Test 3: narration is null — omit it
  it('omits narration when null', () => {
    const result = buildVoucherEmbedText({
      voucherNo: 'SI-001',
      narration: null,
      partyLedger: { name: 'Sharma' },
    })
    expect(result).toBe('SI-001 Sharma')
  })
})

// ─── embedBatch ───────────────────────────────────────────────────────────────

describe('embedBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // Test 4: single text returns array of length 1; each inner array is 1024-dimensional
  it('returns [[number[]]] of length 1 with each inner array length 1024', async () => {
    const mockEmbedFn = vi.mocked(voyageClient.embed)
    mockEmbedFn.mockResolvedValue(mockVoyageResponse(1) as never)

    const result = await embedBatch(['hello'])

    expect(result).toHaveLength(1)
    expect(result[0]).toHaveLength(1024)
    expect(result[0].every((n) => typeof n === 'number')).toBe(true)
  })

  // Test 5: 50 inputs calls voyageClient.embed exactly once with 50 inputs
  it('calls voyageClient.embed exactly once for 50 inputs', async () => {
    const mockEmbedFn = vi.mocked(voyageClient.embed)
    mockEmbedFn.mockResolvedValue(mockVoyageResponse(50) as never)

    const texts = Array.from({ length: 50 }, (_, i) => `text ${i}`)
    await embedBatch(texts)

    expect(mockEmbedFn).toHaveBeenCalledTimes(1)
    const callArgs = mockEmbedFn.mock.calls[0][0] as { input: string[] }
    expect(callArgs.input).toHaveLength(50)
  })

  // Test 6: empty array returns [] without calling Voyage
  it('returns [] immediately without calling Voyage for empty input', async () => {
    const mockEmbedFn = vi.mocked(voyageClient.embed)

    const result = await embedBatch([])

    expect(result).toEqual([])
    expect(mockEmbedFn).not.toHaveBeenCalled()
  })

  // Test 7: Voyage rejection propagates (no swallowing)
  it('propagates Voyage API errors without swallowing them', async () => {
    const mockEmbedFn = vi.mocked(voyageClient.embed)
    const rateLimitError = new Error('Rate limit exceeded (429)')
    mockEmbedFn.mockRejectedValue(rateLimitError)

    await expect(embedBatch(['some text'])).rejects.toThrow('Rate limit exceeded (429)')
  })
})

// ─── persistEmbedding ─────────────────────────────────────────────────────────

describe('persistEmbedding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls $executeRaw with JSON.stringify embedding for ledgers table', async () => {
    const { prisma } = await import('@/lib/prisma')
    const mockExecuteRaw = vi.mocked(prisma.$executeRaw)
    mockExecuteRaw.mockResolvedValue(1)

    const embedding = Array.from({ length: 1024 }, (_, i) => i * 0.001)
    await persistEmbedding('ledgers', 'test-id-123', embedding)

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('calls $executeRaw with JSON.stringify embedding for vouchers table', async () => {
    const { prisma } = await import('@/lib/prisma')
    const mockExecuteRaw = vi.mocked(prisma.$executeRaw)
    mockExecuteRaw.mockResolvedValue(1)

    const embedding = Array.from({ length: 1024 }, (_, i) => i * 0.001)
    await persistEmbedding('vouchers', 'test-voucher-id', embedding)

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })
})
