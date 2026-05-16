import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { getBalanceSheet } from '@/lib/services/ReportEngine'
import type { AccountGroupNode } from '@/lib/services/ReportEngine'
import { getFY } from '@/lib/utils/fy'

const querySchema = z.object({
  fy: z.string().regex(/^\d{4}-\d{2}$/).default(getFY()),
})

function serializeNode(node: AccountGroupNode): unknown {
  return {
    ...node,
    subtotal: node.subtotal.toFixed(2),
    ledgers: node.ledgers.map((l) => ({ ...l, balance: l.balance.toFixed(2) })),
    children: node.children.map(serializeNode),
  }
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const companyId = session.user.companyId

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({ fy: searchParams.get('fy') ?? undefined })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  }

  const result = await getBalanceSheet(companyId, parsed.data.fy)

  return NextResponse.json({
    fy: result.fy,
    balanced: result.balanced,
    totalAssets: result.totalAssets.toFixed(2),
    totalEquityLiabilities: result.totalEquityLiabilities.toFixed(2),
    assetGroups: result.assetGroups.map(serializeNode),
    liabilityGroups: result.liabilityGroups.map(serializeNode),
  })
}
