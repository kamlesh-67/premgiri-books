/**
 * POST /api/v1/gst/ewaybill/[voucherId]/generate
 *
 * Generates a standalone e-Way Bill for a voucher that already has an IRN.
 * Use this when transport details were not available at the time of IRN generation.
 *
 * Security:
 *  - T-08-04-01: IDOR — voucher fetched with companyId from session
 *  - T-08-04-03: 422 guard if voucher has no IRN
 *  - T-08-04-04: voucherId validated as CUID before any DB query
 */
import { getSessionFromRequest } from '@/lib/session'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { generateStandaloneEwb } from '@/lib/services/EInvoiceService'

const voucherIdSchema = z.string().cuid()

const generateEwbSchema = z.object({
  TransMode: z.enum(['1', '2', '3', '4']),
  Distance: z.number().int().min(1).max(4000),
  TransId: z.string().optional(),
  TransName: z.string().optional(),
  VehNo: z.string().optional(),
  VehType: z.enum(['R', 'O']).optional(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ voucherId: string }> },
) {
  // 1. Auth guard
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Validate voucherId as CUID (T-08-04-04)
  const { voucherId: rawVoucherId } = await params
  const voucherIdParsed = voucherIdSchema.safeParse(rawVoucherId)
  if (!voucherIdParsed.success) {
    return NextResponse.json({ error: 'Invalid voucher ID' }, { status: 400 })
  }
  const voucherId = voucherIdParsed.data

  // 3. Validate request body
  let body: z.infer<typeof generateEwbSchema>
  try {
    const raw = await req.json()
    body = generateEwbSchema.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // 4. Generate standalone EWB — service handles IDOR, IRN check (T-08-04-03), duplicate guard
  try {
    const result = await generateStandaloneEwb(
      voucherId,
      session.companyId,
      body,
      session.userId,
    )

    return NextResponse.json({
      ewbNo: result.ewbNo,
      ewbValidUntil: result.ewbValidUntil,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'

    if (msg === 'Voucher not found') {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
    }
    if (msg.includes('IRN must be generated')) {
      // T-08-04-03: business rule — IRN required before EWB
      return NextResponse.json({ error: msg }, { status: 422 })
    }
    if (msg.includes('already generated')) {
      return NextResponse.json({ error: msg }, { status: 409 })
    }
    return NextResponse.json({ error: 'e-Way Bill generation failed' }, { status: 500 })
  }
}
