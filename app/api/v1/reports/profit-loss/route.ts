import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { getProfitLoss } from '@/lib/services/ReportEngine'
import type { ProfitLossGroup } from '@/lib/services/ReportEngine'
import { getFY } from '@/lib/utils/fy'

const querySchema = z.object({
  fy: z.string().regex(/^\d{4}-\d{2}$/).default(getFY()),
  compareFy: z.string().regex(/^\d{4}-\d{2}$/).optional(),
})

function serializePLGroup(g: ProfitLossGroup) {
  return {
    groupName: g.groupName,
    ledgers: g.ledgers.map((l) => ({ name: l.name, amount: l.amount.toFixed(2) })),
    subtotal: g.subtotal.toFixed(2),
  }
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const companyId = session.user.companyId

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({
    fy: searchParams.get('fy') ?? undefined,
    compareFy: searchParams.get('compareFy') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  }

  const result = await getProfitLoss(companyId, parsed.data.fy, parsed.data.compareFy)

  return NextResponse.json({
    fy: result.fy,
    tradingIncome: result.tradingIncome.map(serializePLGroup),
    tradingExpenses: result.tradingExpenses.map(serializePLGroup),
    grossProfit: result.grossProfit.toFixed(2),
    otherIncome: result.otherIncome.map(serializePLGroup),
    otherExpenses: result.otherExpenses.map(serializePLGroup),
    netProfit: result.netProfit.toFixed(2),
    hasCompareFyData: result.hasCompareFyData,
    compareFy: result.compareFy ?? null,
    compareGrossProfit: result.compareGrossProfit?.toFixed(2) ?? null,
    compareNetProfit: result.compareNetProfit?.toFixed(2) ?? null,
  })
}
