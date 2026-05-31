import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getGstr3bSummary } from '@/lib/services/GSTService'
import { serialize } from '@/lib/services/Gstr3bJsonSerializer'
import type { Gstr3bInput } from '@/lib/services/Gstr3bJsonSerializer'

const exportSchema = z.object({
  period: z.string().regex(/^\d{2}\/\d{4}$/, 'Period must be MM/YYYY format'),  // e.g. "04/2025"
})

/**
 * POST /api/v1/gst/gstr3b/export
 *
 * Generates GSTN-format GSTR-3B JSON, persists GstReturn status as EXPORTED,
 * bulk-updates GstTransaction.gstr3bStatus, writes audit log — all in one transaction.
 * Returns the JSON as a downloadable file.
 *
 * Security:
 *  - auth() first — 401 before any processing
 *  - companyId ALWAYS from session.companyId — never from request body (T-08-03-02)
 *  - period validated with Zod regex before any DB operation (T-08-03-04)
 *  - Requires auth — download blocked for unauthenticated requests (T-08-03-01)
 */
export async function POST(request: Request) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const companyId = session.companyId  // NEVER from request body

  // Parse and validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const parsed = exportSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.errors[0]?.message ?? 'Invalid request' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
  const { period } = parsed.data

  try {
    // Fetch company GSTIN from DB — never from request (T-08-03-02)
    const company = await prisma.company.findFirst({
      where: { id: companyId },
      select: { gstin: true },
    })
    if (!company) {
      return new Response(JSON.stringify({ error: 'Company not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Aggregate GSTR-3B figures from GstTransaction rows
    const summary = await getGstr3bSummary(companyId, period)

    // Map Gstr3bSummary (GSTService) → Gstr3bInput (serializer)
    // The GSTService uses different field names from the GSTN serializer input type.
    const input: Gstr3bInput = {
      outwardTaxable: {
        taxableValue: summary.outwardTaxable.taxable,
        cgst: summary.outwardTaxable.cgst,
        sgst: summary.outwardTaxable.sgst,
        igst: summary.outwardTaxable.igst,
      },
      outwardZeroRated: {
        taxableValue: summary.zeroNilRated.taxable,
        igst: '0',  // zero-rated: no tax collected
      },
      outwardNilExempt: {
        taxableValue: '0',  // Phase 8: nil-exempt not separately tracked in Gstr3bSummary
      },
      inwardRcm: {
        taxableValue: summary.rcmInward.taxable,
        cgst: summary.rcmInward.cgst,
        sgst: summary.rcmInward.sgst,
        igst: summary.rcmInward.igst,
      },
      itcAvailable: {
        cgst: summary.itcAvailable.cgst,
        sgst: summary.itcAvailable.sgst,
        igst: summary.itcAvailable.igst,
      },
    }

    const serialized = serialize(input, company.gstin ?? '', period)

    // Persist GstReturn status + bulk-update GstTransaction.gstr3bStatus + audit log
    // All three ops in a single $transaction (T-08-03-03)
    await prisma.$transaction([
      prisma.gstReturn.upsert({
        where: {
          companyId_returnType_returnPeriod: {
            companyId,
            returnType: 'GSTR3B',
            returnPeriod: period,
          },
        },
        create: {
          companyId,
          returnType: 'GSTR3B',
          returnPeriod: period,
          status: 'EXPORTED',
          jsonData: serialized as never,
        },
        update: {
          status: 'EXPORTED',
          jsonData: serialized as never,
        },
      }),
      prisma.gstTransaction.updateMany({
        where: { companyId, returnPeriod: period, gstr3bStatus: 'PENDING' },
        // GstrStatus enum: PENDING | UPLOADED | FILED
        // 'UPLOADED' is the closest value — transactions are included in exported JSON
        data: { gstr3bStatus: 'UPLOADED' },
      }),
      prisma.auditLog.create({
        data: {
          companyId,
          userId: session.userId,
          entity: 'GstReturn',
          entityId: period,
          action: 'UPDATE',
          newValue: { status: 'EXPORTED', period } as object,
        },
      }),
    ])

    // Return JSON as downloadable file
    const filename = `GSTR3B-${period.replace('/', '-')}.json`
    return new Response(JSON.stringify(serialized, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[gst/gstr3b/export POST]', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
