import { NextResponse, NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { z } from 'zod'
import { getOutstanding } from '@/lib/services/ReportEngine'

const querySchema = z.object({
  type: z.enum(['receivable', 'payable']).default('receivable'),
})

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session?.companyId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const companyId = session.companyId

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({ type: searchParams.get('type') ?? undefined })
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })

  const drCr = parsed.data.type === 'receivable' ? 'DR' : 'CR'
  const rows = await getOutstanding(companyId, drCr)

  return NextResponse.json({
    type: parsed.data.type,
    rows: rows.map((r) => ({
      ...r,
      outstandingAmount: r.outstandingAmount.toFixed(2),
    })),
  })
}
