import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * GET /api/v1/bill-refs
 *
 * Returns open (unsettled) BillRef rows for a party ledger.
 * Used by the settlement table in Receipt/Payment voucher forms.
 *
 * Security:
 *  - Auth check is first — 401 before any logic (T-02-13)
 *  - companyId always from session.companyId (T-02-14)
 *  - ledgerId from query param is filtered WITHIN the companyId scope — cannot access another company's bills
 *
 * Query params:
 *  - ledgerId (required): party ledger ID
 *  - type: 'receivable' | 'payable' — maps to DrCr DR/CR respectively
 *    receivable (AR) = DR bills (sales invoices outstanding)
 *    payable (AP) = CR bills (purchase invoices outstanding)
 *    Defaults to 'receivable' (DR) if not provided.
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // T-02-14: companyId always from session — NEVER from query params
  const companyId = session.companyId
  const { searchParams } = new URL(request.url)

  const ledgerId = searchParams.get('ledgerId')
  if (!ledgerId) {
    return NextResponse.json({ error: 'ledgerId is required' }, { status: 400 })
  }

  const type = searchParams.get('type') // 'receivable' | 'payable'
  // receivable (money owed TO us) = DR side (sales invoices)
  // payable (money we OWE) = CR side (purchase invoices)
  const drCr = type === 'payable' ? 'CR' : 'DR'

  const billRefs = await prisma.billRef.findMany({
    where: {
      companyId,       // T-02-14: always scoped to authenticated company
      ledgerId,        // filter within company scope — cannot leak cross-tenant
      settled: false,  // only open (outstanding) bills
      drCr,            // DR = receivable, CR = payable
    },
    include: {
      voucher: {
        select: {
          voucherNo: true,
          date: true,
          voucherType: true,
        },
      },
    },
    orderBy: { billDate: 'asc' }, // oldest first (useful for aging in settlement table)
  })

  // Serialize and compute age in days
  const now = Date.now()
  const serialized = billRefs.map((br) => ({
    ...br,
    totalAmount: br.totalAmount.toString(),
    outstandingAmount: br.outstandingAmount.toString(),
    // Age in calendar days from bill date to today
    ageDays: Math.floor((now - new Date(br.billDate).getTime()) / 86400000),
  }))

  return NextResponse.json(serialized)
}
