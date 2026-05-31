/**
 * POST /api/v1/gst/einvoice/[voucherId]/generate
 *
 * Generates an IRN for a POSTED SALES voucher.
 * Optionally generates a combined e-Way Bill when ewbDtls are provided.
 *
 * Security:
 *  - T-08-04-01: IDOR — voucher fetched with companyId from session
 *  - T-08-04-02: Atomic compare-and-swap (irn=PENDING) prevents TOCTOU double-generation (CR-01)
 *  - T-08-04-04: voucherId validated as CUID before any DB query
 */
import { getSessionFromRequest } from '@/lib/session'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { generateIrn } from '@/lib/services/EInvoiceService'

const voucherIdSchema = z.string().cuid()

const generateIrnSchema = z.object({
  // Optional EWB fields — if present, generate IRN + EWB in one call
  ewbDtls: z
    .object({
      TransMode: z.enum(['1', '2', '3', '4']),
      Distance: z.number().int().min(1).max(4000),
      TransId: z.string().optional(),
      TransName: z.string().optional(),
      VehNo: z.string().optional(),
      VehType: z.enum(['R', 'O']).optional(),
    })
    .optional(),
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
  let body: z.infer<typeof generateIrnSchema>
  try {
    const raw = await req.json().catch(() => ({}))
    body = generateIrnSchema.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // 4. Existence check — IDOR guard (T-08-04-01)
  const exists = await prisma.voucher.findFirst({
    where: { id: voucherId, companyId: session.companyId },
    select: { id: true },
  })
  if (!exists) {
    return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
  }

  // 5. CR-01: Atomic compare-and-swap — set irn=PENDING only if irn IS NULL.
  // Eliminates the TOCTOU race between the fast-path 409 check and the IRP call.
  // Concurrent requests will see locked.count===0 and receive a 409.
  const locked = await prisma.voucher.updateMany({
    where: { id: voucherId, companyId: session.companyId, irn: null },
    data: { irn: 'PENDING' },
  })
  if (locked.count === 0) {
    return NextResponse.json(
      { error: 'IRN already generated or generation in progress' },
      { status: 409 },
    )
  }

  // 6. Generate IRN (and optional EWB) — irn is now PENDING, will be overwritten by real IRN
  try {
    const result = await generateIrn(
      voucherId,
      session.companyId,
      body.ewbDtls,
      session.userId,
    )

    return NextResponse.json({
      irn: result.irn,
      ackNo: result.ackNo,
      ackDt: result.ackDt,
      ewbNo: result.ewbNo ?? null,
      ewbValidUntil: result.ewbValidUntil ?? null,
    })
  } catch (err: unknown) {
    // Reset irn back to null if IRP call failed, so the user can retry
    await prisma.voucher.updateMany({
      where: { id: voucherId, companyId: session.companyId, irn: 'PENDING' },
      data: { irn: null },
    }).catch(() => { /* best-effort reset — log is handled by EInvoiceService */ })

    const msg = err instanceof Error ? err.message : 'Unknown error'
    // 422 for business rule failures (not schema errors)
    if (
      msg.includes('must be POSTED') ||
      msg.includes('GSTIN') ||
      msg.includes('already') ||
      msg.includes('older than 30')
    ) {
      return NextResponse.json({ error: msg }, { status: 422 })
    }
    return NextResponse.json({ error: 'IRN generation failed' }, { status: 500 })
  }
}
