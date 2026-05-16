/**
 * GET /api/v1/cheques
 *
 * Returns vouchers where chequeNo IS NOT NULL (cheque-bearing vouchers only).
 * Supports optional filtering by chequeStatus and pagination.
 *
 * SECURITY: All queries scoped to session.user.companyId (Rule 2 — CLAUDE.md).
 * No companyId from query params — always from session.
 */
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

const querySchema = z.object({
  status: z.enum(['ISSUED', 'CLEARED', 'BOUNCED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.user.companyId
  const { searchParams } = new URL(request.url)

  const parsed = querySchema.safeParse({
    status: searchParams.get('status') ?? undefined,
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { status, page, limit } = parsed.data
  const skip = (page - 1) * limit

  const [vouchers, totalCount] = await prisma.$transaction([
    prisma.voucher.findMany({
      where: {
        companyId,
        chequeNo: { not: null },
        ...(status ? { chequeStatus: status } : {}),
      },
      include: {
        partyLedger: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      skip,
      take: limit,
    }),
    prisma.voucher.count({
      where: {
        companyId,
        chequeNo: { not: null },
        ...(status ? { chequeStatus: status } : {}),
      },
    }),
  ])

  const data = vouchers.map((v) => ({
    id: v.id,
    voucherNo: v.voucherNo,
    date: v.date.toISOString(),
    voucherType: v.voucherType,
    totalAmount: v.totalAmount.toFixed(2),
    partyLedger: v.partyLedger,
    chequeNo: v.chequeNo,
    chequeDated: v.chequeDated ? v.chequeDated.toISOString() : null,
    bankName: v.bankName,
    chequeStatus: v.chequeStatus,
    clearanceDate: v.clearanceDate ? v.clearanceDate.toISOString() : null,
  }))

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  })
}
