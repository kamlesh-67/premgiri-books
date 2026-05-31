/**
 * POST /api/v1/embeddings/trigger
 *
 * Admin-only endpoint to fire the premgiri/embeddings.refresh Inngest event,
 * which triggers the bulk embedding population job for the calling user's company.
 *
 * Auth: session required (401 if missing)
 * Permission: settings.admin required (403 if insufficient role)
 * Response: 202 Accepted — job runs async (no polling — user checks back later)
 *
 * Per CLAUDE.md rule 7: companyId always from session, never from request body.
 */

import { getSessionFromRequest } from '@/lib/session'
import { inngest } from '@/lib/inngest'
import { requirePermission } from '@/lib/utils/requirePermission'
import { NextResponse } from 'next/server'

export async function POST(): Promise<NextResponse> {
  // ── Auth gate ───────────────────────────────────────────────────────────────
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Permission gate: Admin role required (T-11-03-04) ───────────────────────
  const forbidden = requirePermission(session, 'settings', 'admin')
  if (forbidden) return forbidden

  // ── Fire Inngest bulk embedding event ───────────────────────────────────────
  // companyId is always sourced from session (CLAUDE.md rule 7 — never from body)
  try {
    await inngest.send({
      name: 'premgiri/embeddings.refresh',
      data: { companyId: session.companyId },
    })
  } catch (err: unknown) {
    console.error('[POST /api/v1/embeddings/trigger] Failed to enqueue Inngest event:', err)
    return NextResponse.json({ error: 'Failed to enqueue job' }, { status: 500 })
  }

  // 202 Accepted — job is async, user should check back later (per UI-SPEC)
  return NextResponse.json({ status: 'triggered' }, { status: 202 })
}
