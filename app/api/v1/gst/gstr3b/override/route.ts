import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

const overrideSchema = z.object({
  period: z.string().regex(/^\d{2}\/\d{4}$/, 'Period must be MM/YYYY'),
  cellKey: z.string().min(1, 'cellKey is required'),
  autoValue: z.string(),
  userValue: z.string(),
})

/**
 * PATCH /api/v1/gst/gstr3b/override
 *
 * Stores a user override for a specific GSTR-3B cell in GstReturn.jsonData.
 * Overrides are display-only — do not affect underlying GstTransaction amounts.
 * Security:
 *  - auth() first — 401 before any processing
 *  - companyId ALWAYS from session.companyId
 *  - cellKey stored alongside autoValue for audit trail (T-03-03-06)
 *  - auditLog written inside $transaction
 */
export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId  // NEVER from body
  const body = await request.json()
  const parsed = overrideSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const { period, cellKey, autoValue, userValue } = parsed.data

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Upsert GstReturn record and merge the override into jsonData
      const existing = await tx.gstReturn.findFirst({
        where: { companyId, returnType: 'GSTR3B', returnPeriod: period },
      })

      // Build updated overrides map
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingData = (existing?.jsonData as any) ?? {}
      const existingOverrides = existingData.overrides ?? {}
      const updatedOverrides = {
        ...existingOverrides,
        [cellKey]: {
          autoValue,
          userValue,
          overriddenAt: new Date().toISOString(),
          overriddenBy: session.userId,
        },
      }
      const updatedJsonData = { ...existingData, overrides: updatedOverrides }

      let gstReturn
      if (existing) {
        gstReturn = await tx.gstReturn.update({
          where: { id: existing.id },
          data: { jsonData: updatedJsonData },
        })
      } else {
        gstReturn = await tx.gstReturn.create({
          data: {
            companyId,
            returnType: 'GSTR3B',
            returnPeriod: period,
            jsonData: updatedJsonData,
          },
        })
      }

      // Write audit log — records what was changed and by whom
      await tx.auditLog.create({
        data: {
          companyId,
          userId: session.userId,
          entity: 'GstReturn',
          entityId: gstReturn.id,
          action: 'UPDATE',
          oldValue: { cellKey, autoValue } as object,
          newValue: { cellKey, userValue, overriddenAt: updatedOverrides[cellKey].overriddenAt } as object,
        },
      })

      return gstReturn
    })

    return NextResponse.json({
      id: result.id,
      period,
      cellKey,
      autoValue,
      userValue,
    })
  } catch (err) {
    console.error('[gst/gstr3b/override PATCH]', err)
    return NextResponse.json({ error: 'Failed to save GSTR-3B override' }, { status: 500 })
  }
}
