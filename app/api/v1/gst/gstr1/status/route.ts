import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

const statusUpdateSchema = z.object({
  period: z.string().regex(/^\d{2}\/\d{4}$/, 'Period must be MM/YYYY'),
  status: z.enum(['PENDING', 'UPLOADED']),
})

/**
 * PATCH /api/v1/gst/gstr1/status
 *
 * Updates gstr1Status on all GstTransactions for the given period.
 * Only PENDING → UPLOADED transition is allowed (filed status is managed by gstr3b/status).
 * Security:
 *  - auth() first — 401 before any processing
 *  - companyId ALWAYS from session.companyId
 *  - period and status validated with Zod before any DB operation
 *  - auditLog written inside $transaction
 */
export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId  // NEVER from body
  const body = await request.json()
  const parsed = statusUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const { period, status } = parsed.data

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Update all GstTransactions for this company and period
      const updated = await tx.gstTransaction.updateMany({
        where: { companyId, returnPeriod: period },
        data: { gstr1Status: status },
      })

      // Write audit log
      await tx.auditLog.create({
        data: {
          companyId,
          userId: session.userId,
          entity: 'GstTransaction',
          entityId: companyId,
          action: 'UPDATE',
          oldValue: { gstr1Status: 'PENDING', returnPeriod: period } as object,
          newValue: { gstr1Status: status, returnPeriod: period, count: updated.count } as object,
        },
      })

      return updated
    })

    return NextResponse.json({ updated: result.count, period, status })
  } catch (err) {
    console.error('[gst/gstr1/status PATCH]', err)
    return NextResponse.json({ error: 'Failed to update GSTR-1 status' }, { status: 500 })
  }
}
