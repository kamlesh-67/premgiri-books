/**
 * GET /api/v1/insights
 *
 * Smart Insights API route — Phase 11 Plan 02.
 * Returns 3 plain-English business insights for the authenticated company,
 * cached in Redis for 15 minutes. Supports ?refresh=1 to bypass cache.
 *
 * Security:
 * - Auth check FIRST — 401 before any cache/DB touch (CLAUDE.md rule 9)
 * - companyId ALWAYS from session.companyId — never from query params (CLAUDE.md rule 2)
 * - Zod validates all query params (CLAUDE.md rule 10)
 * - NEVER returns 5xx to client — on AI error returns 200 + empty insights (AI-SPEC §6)
 *
 * Cache: Redis key `insights:{companyId}`, TTL 900s (15 minutes) per D-07.
 * Refresh: ?refresh=1 deletes cache entry and regenerates.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { getSessionFromRequest } from '@/lib/session'
import { getCache, setCache, deleteCache } from '@/lib/redis'
import { generateInsights } from '@/lib/services/InsightsService'
import type { InsightsResponse } from '@/lib/services/InsightsService'

// ─── Response type ────────────────────────────────────────────────────────────

type InsightsRouteResponse = {
  insights: Array<{ type: string; text: string; generatedAt: string }>
  cached: boolean
  error?: string
}

// ─── Query param validation schema ───────────────────────────────────────────

const refreshSchema = z.object({
  refresh: z.enum(['1']).optional(),
})

// ─── Cache TTL ────────────────────────────────────────────────────────────────

const CACHE_TTL_SECONDS = 900 // 15 minutes per D-07

// ─── GET /api/v1/insights ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Step 1: Auth gate FIRST (CLAUDE.md rule 9)
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Step 2: companyId ALWAYS from session — never from query/body (CLAUDE.md rule 2)
  const companyId = session.companyId

  // Step 3: Parse + validate query params with Zod (CLAUDE.md rule 10)
  const rawParams = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = refreshSchema.safeParse(rawParams)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 })
  }
  const bypassCache = parsed.data.refresh === '1'

  // Step 4: Redis cache key (exact pattern per D-07)
  const cacheKey = `insights:${companyId}`

  // Step 5: Serve from cache if not bypassing
  if (!bypassCache) {
    try {
      const cached = await getCache<InsightsResponse>(cacheKey)
      if (cached !== null) {
        return NextResponse.json({ ...cached, cached: true } satisfies InsightsRouteResponse)
      }
    } catch (cacheErr) {
      // Redis error must not block insight generation (AI-SPEC §6 fallback policy)
      console.warn('[insights] Redis read error, falling through to fresh generation:', cacheErr)
    }
  }

  // Step 6: Bypass → delete stale cache entry
  if (bypassCache) {
    try {
      await deleteCache(cacheKey)
    } catch {
      // Non-blocking — if del fails, the old cache key expires naturally
    }
  }

  // Step 7: Structured log on cache miss (useful for offline flywheel metric — AI-SPEC §6)
  console.log('[insights] cache miss for company:', companyId)

  // Step 8: Generate fresh insights
  try {
    const result = await generateInsights(companyId)

    // Step 9: Cache on success (errors return empty insights, not worth caching long-term)
    // Only cache if we got at least some content (or empty — still valid to cache briefly)
    try {
      await setCache(cacheKey, result, CACHE_TTL_SECONDS)
    } catch {
      // Cache write failure must not break the response
    }

    return NextResponse.json({ ...result, cached: false } satisfies InsightsRouteResponse)
  } catch (err) {
    // Step 10: On unexpected error — return 200 with empty insights (AI-SPEC §6 guardrail row 2)
    // NEVER return 5xx to dashboard — it would break the page render
    console.error('[insights] generateInsights threw unexpectedly:', err)
    return NextResponse.json({
      insights: [],
      cached: false,
      error: 'AI temporarily unavailable',
    } satisfies InsightsRouteResponse)
  }
}
