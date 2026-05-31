/**
 * POST /api/v1/embeddings/trigger
 *
 * Admin-only endpoint. Inngest removed in Phase 21 (CLOUD-01).
 * AI embedding refresh requires internet and will be re-enabled
 * in Phase 22 (online-only AI configuration).
 *
 * Auth: session required (401 if missing)
 * Permission: settings.admin required (403 if insufficient role)
 * Response: 202 Accepted with skipped reason
 */

import { auth } from '@/lib/auth'
import { requirePermission } from '@/lib/utils/requirePermission'
import { NextResponse } from 'next/server'

export async function POST(): Promise<NextResponse> {
  // ── Auth gate ───────────────────────────────────────────────────────────────
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Permission gate: Admin role required (T-11-03-04) ───────────────────────
  const forbidden = requirePermission(session, 'settings', 'admin')
  if (forbidden) return forbidden

  // Inngest removed in Phase 21 (CLOUD-01).
  // AI embedding refresh is handled by Phase 22 (online-only AI configuration).
  return NextResponse.json(
    { status: 'skipped', reason: 'AI embeddings require internet — configure in Settings → AI (Phase 22)' },
    { status: 202 }
  )
}
