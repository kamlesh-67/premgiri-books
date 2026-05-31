import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cancelVoucher, postVoucher, ValidationError } from '@/lib/services/VoucherEngine'

// Minimal Zod schema for PATCH body — only action field matters
const patchBodySchema = z.object({
  action: z.enum(['cancel', 'post'], {
    errorMap: () => ({ message: "action must be 'cancel' or 'post'" }),
  }),
})

/**
 * GET /api/v1/vouchers/[id]
 *
 * Returns full voucher detail with entries, items, party, and billRefs.
 * IDOR protection: where clause always includes both id AND companyId (T-02-10).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId
  const { id } = await params

  // T-02-10: IDOR protection — id alone is NOT sufficient; must belong to authenticated company
  const voucher = await prisma.voucher.findFirst({
    where: { id, companyId },
    include: {
      voucherEntries: {
        include: { ledger: { select: { id: true, name: true } } },
      },
      voucherItems: {
        include: { item: { select: { id: true, name: true } } },
      },
      partyLedger: { select: { id: true, name: true, gstin: true } },
      billRefs: true,
    },
  })

  if (!voucher) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Serialize all Decimal fields to string
  return NextResponse.json({
    ...voucher,
    totalAmount: voucher.totalAmount.toString(),
    cgstAmount: voucher.cgstAmount.toString(),
    sgstAmount: voucher.sgstAmount.toString(),
    igstAmount: voucher.igstAmount.toString(),
    roundOff: voucher.roundOff.toString(),
    voucherEntries: voucher.voucherEntries.map((e) => ({
      ...e,
      amount: e.amount.toString(),
    })),
    voucherItems: voucher.voucherItems.map((item) => ({
      ...item,
      qty: item.qty.toString(),
      rate: item.rate.toString(),
      amount: item.amount.toString(),
      discountPct: item.discountPct?.toString() ?? null,
      discountAmt: item.discountAmt?.toString() ?? null,
      cgstRate: item.cgstRate?.toString() ?? null,
      cgstAmt: item.cgstAmt?.toString() ?? null,
      sgstRate: item.sgstRate?.toString() ?? null,
      sgstAmt: item.sgstAmt?.toString() ?? null,
      igstRate: item.igstRate?.toString() ?? null,
      igstAmt: item.igstAmt?.toString() ?? null,
    })),
    billRefs: voucher.billRefs.map((br) => ({
      ...br,
      totalAmount: br.totalAmount.toString(),
      outstandingAmount: br.outstandingAmount.toString(),
    })),
  })
}

/**
 * PATCH /api/v1/vouchers/[id]
 *
 * Performs a state transition on a voucher.
 *  - { action: 'cancel' } → calls cancelVoucher (POSTED → CANCELLED; soft-delete only)
 *  - { action: 'post' }   → calls postVoucher (DRAFT → POSTED; creates BillRef)
 *
 * IDOR protection: VoucherEngine always uses { id, companyId } in where clause.
 * Audit log is written inside the VoucherEngine $transaction (T-02-15).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const parsed = patchBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid action', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  try {
    if (parsed.data.action === 'cancel') {
      const cancelled = await cancelVoucher(id, session)
      const v = cancelled as { id: string; status: string }
      return NextResponse.json({ id: v.id, status: v.status })
    }

    if (parsed.data.action === 'post') {
      const posted = await postVoucher(id, session)
      const v = posted as { id: string; status: string }
      return NextResponse.json({ id: v.id, status: v.status })
    }

    // TypeScript exhaustiveness guard — patchBodySchema enum prevents reaching here
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    // P2025 = Prisma "Record not found" error
    if (err instanceof Error && err.message.includes('P2025')) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
    }
    throw err
  }
}
