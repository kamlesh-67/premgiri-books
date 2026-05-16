import { auth } from '@/lib/auth'
import { z } from 'zod'
import { getProfitLoss, exportToExcel } from '@/lib/services/ReportEngine'
import { getFY } from '@/lib/utils/fy'

const querySchema = z.object({
  fy: z.string().regex(/^\d{4}-\d{2}$/).default(getFY()),
})

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.companyId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  const companyId = session.user.companyId

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({ fy: searchParams.get('fy') ?? undefined })
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid parameters' }), { status: 400 })
  }

  const { fy } = parsed.data
  const data = await getProfitLoss(companyId, fy)
  const buffer = await exportToExcel(data, 'profit-loss')

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="profit-loss-${fy}.xlsx"`,
    },
  })
}
