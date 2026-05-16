/**
 * EmbeddingService.ts
 * Pure helpers for building embed text, batching Voyage API calls, and persisting
 * embedding vectors to the DB via Prisma $executeRaw with ::vector cast.
 *
 * AI-SPEC pitfall #2: embedding array MUST be JSON.stringify()'d before the ::vector cast.
 * AI-SPEC pitfall #5: Voyage batch size hard limit is 128 inputs — batch by 50 per D-12.
 *
 * All functions are pure (no Inngest, no auth) — callers wire those dependencies.
 */

import { voyageClient, EMBEDDING_MODEL } from '@/lib/ai'
import { prisma } from '@/lib/prisma'

// ─── Text builder: Ledger ─────────────────────────────────────────────────────

/**
 * Builds the embedding input text for a Ledger row.
 * D-11: "${name} ${gstin ?? ''} ${group.name}" — trim whitespace, max 2048 chars.
 */
export function buildLedgerEmbedText(l: {
  name: string
  gstin: string | null
  group: { name: string }
}): string {
  const raw = [l.name, l.gstin, l.group.name]
    .filter(Boolean)
    .join(' ')
    .trim()
  return raw.slice(0, 2048)
}

// ─── Text builder: Voucher ────────────────────────────────────────────────────

/**
 * Builds the embedding input text for a Voucher row.
 * D-11: "${voucherNo} ${narration ?? ''} ${partyLedger?.name ?? ''}" — trim, max 2048 chars.
 */
export function buildVoucherEmbedText(v: {
  voucherNo: string
  narration: string | null
  partyLedger: { name: string } | null
}): string {
  const raw = [v.voucherNo, v.narration, v.partyLedger?.name]
    .filter(Boolean)
    .join(' ')
    .trim()
  return raw.slice(0, 2048)
}

// ─── Batch embedder ───────────────────────────────────────────────────────────

/**
 * Calls Voyage AI embed endpoint for a batch of texts.
 *
 * - Returns [] immediately for empty input (no API call).
 * - Throws RangeError if texts.length > 128 (AI-SPEC pitfall #5 — Voyage hard limit).
 * - Does NOT catch errors — lets Inngest's retries handle 429/5xx (failure mode #4).
 *
 * @param texts Array of strings to embed (max 128; use batches of 50 per D-12)
 * @returns Array of 1024-dimensional embedding vectors
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return []
  }

  if (texts.length > 128) {
    throw new RangeError(
      `Voyage batch size exceeds 128 (got ${texts.length}). Caller must batch by 50 per D-12.`
    )
  }

  const response = await voyageClient.embed({
    input: texts,
    model: EMBEDDING_MODEL,
  })

  if (!response.data) {
    throw new Error('[EmbeddingService] Voyage API returned no data')
  }

  return response.data.map((d) => d.embedding as number[])
}

// ─── Persist embedding ────────────────────────────────────────────────────────

/**
 * Persists an embedding vector to the specified table via Prisma $executeRaw.
 *
 * CRITICAL (AI-SPEC pitfall #2): embedding MUST be JSON.stringify()'d before the ::vector
 * cast. Raw JS arrays cause Prisma serialization errors. The ::vector cast enforces
 * the 1024-dimension constraint at the Postgres level.
 *
 * Table names are NEVER dynamic — only literal branches prevent SQL injection (T-11-03-01).
 * No companyId WHERE clause here — the caller's SELECT already scoped to the correct company;
 * the id is an opaque cuid and is not enumerable across tenants.
 *
 * @param table Target table — 'vouchers' or 'ledgers'
 * @param id    Row id (cuid)
 * @param embedding 1024-dimensional vector as number[]
 */
export async function persistEmbedding(
  table: 'vouchers' | 'ledgers',
  id: string,
  embedding: number[]
): Promise<void> {
  // AI-SPEC pitfall #2: JSON.stringify is required for Prisma + pgvector ::vector cast
  const vecStr = JSON.stringify(embedding)

  if (table === 'vouchers') {
    await prisma.$executeRaw`UPDATE vouchers SET embedding = ${vecStr}::vector WHERE id = ${id}`
  } else if (table === 'ledgers') {
    await prisma.$executeRaw`UPDATE ledgers SET embedding = ${vecStr}::vector WHERE id = ${id}`
  }
}
