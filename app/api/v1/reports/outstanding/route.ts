import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { getOutstanding } from '@/lib/services/ReportEngine'

const querySchema = z.object({
  type: z.enum(['receivable', 'payable']).default('receivable'),
})

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.companyId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const companyId = session.user.companyId

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
