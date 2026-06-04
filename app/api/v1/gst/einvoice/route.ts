/**
 * GET /api/v1/gst/einvoice
 *
 * Returns a paginated list of SALES vouchers with e-Invoice status.
 * Supports filtering by status (PENDING | GENERATED | CANCELLED) and period (MM/YYYY).
 *
 * Security:
 *  - companyId always from session.companyId — never from query params
 *  - Paginated to max 50 records per page
 */
import { getSessionFromRequest } from '@/lib/session'
import { NextResponse, NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period')   // MM/YYYY
  const status = searchParams.get('status')   // PENDING | GENERATED | CANCELLED
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const skip = (page - 1) * limit

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

  // Status filter maps to Prisma conditions
  let statusFilter: Prisma.VoucherWhereInput = {}
  if (status === 'GENERATED') {
    statusFilter = { irn: { not: null } }
  } else if (status === 'PENDING') {
    statusFilter = { irn: null, status: 'POSTED' }
  } else if (status === 'CANCELLED') {
    statusFilter = { status: 'CANCELLED' }
  }

  const where: Prisma.VoucherWhereInput = {
    companyId: session.companyId,
    voucherType: 'SALES',
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
        irnGeneratedAt: true,
        eWayBillNo: true,
        eWayBillValidUntil: true,
        status: true,
        partyLedger: { select: { name: true, gstin: true } },
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
