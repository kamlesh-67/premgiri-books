import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { getTrialBalance, validateTrialBalance } from '@/lib/services/ReportEngine'
import { getFY } from '@/lib/utils/fy'

const querySchema = z.object({
  fy: z.string().regex(/^\d{4}-\d{2}$/).default(getFY()),
})

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const companyId = session.user.companyId

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({ fy: searchParams.get('fy') ?? undefined })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid parameters', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { fy } = parsed.data

  const rows = await getTrialBalance(companyId, fy)
  const balanced = validateTrialBalance(rows)

  // Serialize Decimal fields to strings for JSON transport
  const serialized = rows.map((r) => ({
    ledgerId: r.ledgerId,
    name: r.name,
    groupName: r.groupName,
    openingDR: r.openingDR.toFixed(2),
    openingCR: r.openingCR.toFixed(2),
    periodDR: r.periodDR.toFixed(2),
    periodCR: r.periodCR.toFixed(2),
    closingDR: r.closingDR.toFixed(2),
    closingCR: r.closingCR.toFixed(2),
  }))

  return NextResponse.json({ fy, balanced, rows: serialized })
}
