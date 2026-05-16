import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { getDayBook } from '@/lib/services/ReportEngine'

const voucherTypeEnum = z.enum([
  'SALES',
  'PURCHASE',
  'RECEIPT',
  'PAYMENT',
  'JOURNAL',
  'CONTRA',
  'CREDIT_NOTE',
  'DEBIT_NOTE',
])

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
  type: voucherTypeEnum.optional(),
})

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const companyId = session.user.companyId

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    type: searchParams.get('type') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid parameters', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const fromDate = new Date(parsed.data.from)
  const toDate = new Date(parsed.data.to)
  const daysDiff = Math.floor(
    (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysDiff > 90) {
    return NextResponse.json(
      { error: 'Date range exceeds 90 days. Maximum allowed is 90 days.' },
      { status: 400 }
    )
  }

  try {
    const rows = await getDayBook(companyId, fromDate, toDate, parsed.data.type)
    return NextResponse.json({
      rows: rows.map((r) => ({
        ...r,
        totalAmount: r.totalAmount.toFixed(2),
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
