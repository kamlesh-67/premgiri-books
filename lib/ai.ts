/**
 * Phase 11 AI singletons. Server-only — never import from a 'use client' file.
 * voyageClient: default import (per AI-SPEC pitfall #1).
 * anthropicClient: model id must include date suffix (per AI-SPEC pitfall #4).
 */

// NOTE: AI-SPEC pitfall #1 said "use default import" but voyageai@0.2.1 exports
// VoyageAIClient as a named export (no default). Using named import is correct.
// The plan's pitfall note was based on an older version of the SDK.
import { VoyageAIClient } from 'voyageai'
import Anthropic from '@anthropic-ai/sdk'

// ─── Model constants ─────────────────────────────────────────────────────────

export const INSIGHTS_MODEL = 'claude-haiku-4-5-20251001' as const
export const EMBEDDING_MODEL = 'voyage-3-lite' as const

// ─── Lazy singletons — validated at call time, not module load ────────────────
// Throwing at module load prevents the route's try/catch from catching missing
// keys, resulting in a 500 instead of the graceful empty-insights fallback.

let _voyageClient: VoyageAIClient | null = null
let _anthropicClient: Anthropic | null = null

export function getVoyageClient(): VoyageAIClient {
  if (!process.env.VOYAGE_API_KEY) {
    throw new Error('VOYAGE_API_KEY is required for AI features. See .env.example.')
  }
  if (!_voyageClient) {
    _voyageClient = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY })
  }
  return _voyageClient
}

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required for AI features. See .env.example.')
  }
  if (!_anthropicClient) {
    _anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _anthropicClient
}

/** @deprecated Use getVoyageClient() — kept for backward compatibility */
export const voyageClient = new Proxy({} as VoyageAIClient, {
  get: (_, prop) => getVoyageClient()[prop as keyof VoyageAIClient],
})

/** @deprecated Use getAnthropicClient() — kept for backward compatibility */
export const anthropicClient = new Proxy({} as Anthropic, {
  get: (_, prop) => getAnthropicClient()[prop as keyof Anthropic],
})
