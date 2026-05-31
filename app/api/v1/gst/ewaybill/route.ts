/**
 * GET /api/v1/gst/ewaybill
 *
 * Returns a paginated list of vouchers with e-Way Bills.
 * Supports filtering by status (ACTIVE | EXPIRED) and period (MM/YYYY).
 *
 * Security:
 *  - companyId always from session.companyId — never from query params
 *  - Paginated to max 50 records per page
 *  - Only returns vouchers that have eWayBillNo set
 */
import { getSessionFromRequest } from '@/lib/session'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export async function GET(req: Request) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period')   // MM/YYYY
  const status = searchParams.get('status')   // ACTIVE | EXPIRED
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const skip = (page - 1) * limit

  const now = new Date()

  // Build date filter from period param
  let dateFilter: Prisma.VoucherWhereInput = {}
  if (period) {
    const [mm, yyyy] = period.split('/')
    if (mm && yyyy) {
      const month = parseInt(mm, 10) - 1
      const year = parseInt(yyyy, 10)
      const start = new Date(year, month, 1)
      const end = new Date(year, month + 1, 1)
      dateFilter = { date: { gte: start, lt: end } }
    }
  }

  // Status filter: ACTIVE = valid (not expired), EXPIRED = past eWayBillValidUntil
  let statusFilter: Prisma.VoucherWhereInput = {}
  if (status === 'ACTIVE') {
    statusFilter = {
      OR: [
        { eWayBillValidUntil: null },
        { eWayBillValidUntil: { gte: now } },
      ],
    }
  } else if (status === 'EXPIRED') {
    statusFilter = { eWayBillValidUntil: { lt: now } }
  }

  const where: Prisma.VoucherWhereInput = {
    companyId: session.companyId,
    eWayBillNo: { not: null },
    ...dateFilter,
    ...statusFilter,
  }

  const [vouchers, total] = await prisma.$transaction([
    prisma.voucher.findMany({
      where,
      select: {
        id: true,
        voucherNo: true,
        date: true,
        totalAmount: true,
        irn: true,
        eWayBillNo: true,
        eWayBillValidUntil: true,
        partyLedger: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      skip,
      take: limit,
    }),
    prisma.voucher.count({ where }),
  ])

  return NextResponse.json({
    data: vouchers,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  })
}
