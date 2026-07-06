import { getSessionFromRequest } from '@/lib/session'
import { prisma, type TransactionClient } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

const statusSchema = z.object({
  period: z.string().regex(/^\d{2}\/\d{4}$/, 'Period must be MM/YYYY'),
})

/**
 * PATCH /api/v1/gst/gstr3b/status
 *
 * Marks GSTR-3B as filed for the period — sets gstr3bStatus to FILED
 * on ALL GstTransactions for the period. Also upserts GstReturn with FILED status.
 * This action is intentionally irreversible (T-03-03-03).
 * Security:
 *  - auth() first — 401 before any processing
 *  - companyId ALWAYS from session.companyId
 *  - auditLog written inside $transaction
 */
export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId  // NEVER from body
  const body = await request.json()
  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const { period } = parsed.data

  try {
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // Update ALL GstTransactions for this company/period to FILED
      const updated = await tx.gstTransaction.updateMany({
        where: { companyId, returnPeriod: period },
        data: { gstr3bStatus: 'FILED' },
      })

      // Upsert GstReturn record to FILED status
      const existing = await tx.gstReturn.findFirst({
        where: { companyId, returnType: 'GSTR3B', returnPeriod: period },
      })

      let gstReturn
      if (existing) {
        gstReturn = await tx.gstReturn.update({
          where: { id: existing.id },
          data: { status: 'FILED' },
        })
      } else {
        gstReturn = await tx.gstReturn.create({
          data: {
            companyId,
            returnType: 'GSTR3B',
            returnPeriod: period,
            status: 'FILED',
          },
        })
      }

      // Single audit log for the entire operation
      await tx.auditLog.create({
        data: {
          companyId,
          userId: session.userId,
          entity: 'GstReturn',
          entityId: companyId,
          action: 'UPDATE',
          oldValue: { gstr3bStatus: 'PENDING', returnPeriod: period } as object,
          newValue: {
            gstr3bStatus: 'FILED',
            returnPeriod: period,
            action: 'mark_filed',
            transactionsUpdated: updated.count,
          } as object,
        },
      })

      return { updated, gstReturn }
    })

    return NextResponse.json({
      filed: true,
      period,
      transactionsUpdated: result.updated.count,
    })
  } catch (err) {
    console.error('[gst/gstr3b/status PATCH]', err)
    return NextResponse.json({ error: 'Failed to mark GSTR-3B as filed' }, { status: 500 })
  }
}
