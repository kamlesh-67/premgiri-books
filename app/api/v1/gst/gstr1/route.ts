import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { getGstr1Sections } from '@/lib/services/GSTService'

const periodSchema = z.string().regex(/^\d{2}\/\d{4}$/, 'Period must be MM/YYYY')

/**
 * GET /api/v1/gst/gstr1?period=MM/YYYY
 *
 * Returns GSTR-1 sections (B2B, B2CS, CDNR, HSN, NIL-rated) for the given period.
 * Security:
 *  - auth() first — 401 before any processing
 *  - companyId ALWAYS from session.user.companyId (T-03-03-01)
 *  - period validated with Zod regex before DB query
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.user.companyId  // NEVER from query params or body
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
    const sections = await getGstr1Sections(companyId, period)
    return NextResponse.json(sections)
  } catch (err) {
    console.error('[gst/gstr1 GET]', err)
    return NextResponse.json({ error: 'Failed to load GSTR-1 data' }, { status: 500 })
  }
}
