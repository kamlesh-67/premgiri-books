import { getSessionFromRequest } from '@/lib/session'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { getGstr3bSummary } from '@/lib/services/GSTService'

const periodSchema = z.string().regex(/^\d{2}\/\d{4}$/, 'Period must be MM/YYYY')

/**
 * GET /api/v1/gst/gstr3b?period=MM/YYYY
 *
 * Returns auto-populated GSTR-3B summary figures for the given period.
 * Includes any user overrides stored in GstReturn.jsonData.
 * Security:
 *  - auth() first — 401 before any processing
 *  - companyId ALWAYS from session.companyId
 *  - period validated with Zod before DB query
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId  // NEVER from query params or body
  const { searchParams } = new URL(request.url)

  const periodParam = searchParams.get('period')
  const periodParsed = periodSchema.safeParse(periodParam)
  if (!periodParsed.success) {
    return NextResponse.json(
      { error: 'period query param required in MM/YYYY format' },
      { status: 400 }
    )
  }
  const period = periodParsed.data  // e.g. "04/2025"

  try {
    const summary = await getGstr3bSummary(companyId, period)
    return NextResponse.json(summary)
  } catch (err) {
    console.error('[gst/gstr3b GET]', err)
    return NextResponse.json({ error: 'Failed to load GSTR-3B data' }, { status: 500 })
  }
}
