/**
 * PATCH /api/v1/cheques/[voucherId]
 *
 * Updates chequeStatus and clearanceDate on a voucher.
 * Only updates vouchers that are cheque-bearing (chequeNo IS NOT NULL).
 *
 * SECURITY:
 *  - T-07-04-01: IDOR protection — findFirst requires { id, companyId, chequeNo: { not: null } }
 *  - companyId always from session, never from request body
 *  - Audit log written in same $transaction as the update
 */
import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

const patchSchema = z.object({
  chequeStatus: z.enum(['ISSUED', 'CLEARED', 'BOUNCED', 'CANCELLED']),
  clearanceDate: z.string().date().nullable().optional(),  // WR-05: validates ISO YYYY-MM-DD
})

interface RouteContext {
  params: Promise<{ voucherId: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId
  const { voucherId } = await context.params

  // Parse + validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { chequeStatus, clearanceDate } = parsed.data

  // Business rule: clearanceDate is required when status is CLEARED
  if (chequeStatus === 'CLEARED' && !clearanceDate) {
    return NextResponse.json(
      { error: 'Clearance date is required when marking a cheque as cleared' },
      { status: 400 }
    )
  }

  // IDOR guard: find only cheque-bearing voucher belonging to this company
  const existing = await prisma.voucher.findFirst({
    where: {
      id: voucherId,
      companyId,
      chequeNo: { not: null },
    },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Cheque not found' }, { status: 404 })
  }

  // Update cheque fields + audit log in a single transaction
  const updated = await prisma.$transaction(async (tx) => {
    const voucher = await tx.voucher.update({
      where: {
        id: voucherId,
        companyId,              // CR-04: atomic IDOR guard — prevents TOCTOU race
        chequeNo: { not: null },
      },
      data: {
        chequeStatus,
        clearanceDate: clearanceDate ? new Date(clearanceDate) : null,
      },
      include: {
        partyLedger: { select: { name: true } },
      },
    })

    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.userId,
        entity: 'Voucher',
        entityId: voucherId,
        action: 'UPDATE',
        oldValue: {
          chequeStatus: existing.chequeStatus,
          clearanceDate: existing.clearanceDate,
        } as object,
        newValue: {
          chequeStatus,
          clearanceDate,
        } as object,
      },
    })

    return voucher
  })

  return NextResponse.json({
    id: updated.id,
    voucherNo: updated.voucherNo,
    date: updated.date.toISOString(),
    voucherType: updated.voucherType,
    totalAmount: updated.totalAmount.toFixed(2),
    partyLedger: updated.partyLedger,
    chequeNo: updated.chequeNo,
    chequeDated: updated.chequeDated ? updated.chequeDated.toISOString() : null,
    bankName: updated.bankName,
    chequeStatus: updated.chequeStatus,
    clearanceDate: updated.clearanceDate ? updated.clearanceDate.toISOString() : null,
  })
}
