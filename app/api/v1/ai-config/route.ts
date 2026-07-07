/**
 * GET  /api/v1/ai-config  — Return boolean sentinel flags for Voyage AI and Anthropic keys.
 * POST /api/v1/ai-config  — Update VOYAGE_KEY_SET and ANTHROPIC_KEY_SET sentinels in AppSettings.
 *
 * Security:
 *  - T-22-06: Route returns only boolean flags — actual key values never returned
 *  - T-22-07: OWNER-only route; 403 for non-owner roles
 *  - Actual key values are provided via environment variables (VOYAGE_API_KEY, ANTHROPIC_API_KEY); this route only tracks whether they're set
 */
import { getSessionFromRequest } from '@/lib/session'
import { authDb as prisma } from '@/lib/authDb'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const postSchema = z.object({
  voyageKeySet: z.boolean().optional(),
  anthropicKeySet: z.boolean().optional(),
})

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'OWNER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [voyageRow, anthropicRow] = await Promise.all([
    prisma.appSettings.findUnique({ where: { key: 'VOYAGE_KEY_SET' } }),
    prisma.appSettings.findUnique({ where: { key: 'ANTHROPIC_KEY_SET' } }),
  ])

  return NextResponse.json({
    voyageKeySet: voyageRow?.value === 'true',
    anthropicKeySet: anthropicRow?.value === 'true',
  })
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'OWNER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body: unknown = await request.json()
  const result = postSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const data = result.data
  const upserts: Promise<unknown>[] = []

  if (data.voyageKeySet !== undefined) {
    upserts.push(
      prisma.appSettings.upsert({
        where: { key: 'VOYAGE_KEY_SET' },
        update: { value: String(data.voyageKeySet) },
        create: { key: 'VOYAGE_KEY_SET', value: String(data.voyageKeySet) },
      })
    )
  }

  if (data.anthropicKeySet !== undefined) {
    upserts.push(
      prisma.appSettings.upsert({
        where: { key: 'ANTHROPIC_KEY_SET' },
        update: { value: String(data.anthropicKeySet) },
        create: { key: 'ANTHROPIC_KEY_SET', value: String(data.anthropicKeySet) },
      })
    )
  }

  await Promise.all(upserts)

  return NextResponse.json({ ok: true })
}
