import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createVoucherSchema } from '@/lib/schemas/vouchers'
import { createVoucher, ValidationError, resolveTdsPayableLedger, buildPaymentEntries, buildReceiptEntries } from '@/lib/services/VoucherEngine'
import { calculateGST } from '@/lib/services/GSTCalculator'
import { VoucherType, VoucherStatus } from '@prisma/client'
import { Decimal } from 'decimal.js'

const VALID_VOUCHER_TYPES = Object.values(VoucherType)
const VALID_STATUSES = Object.values(VoucherStatus)

/**
 * POST /api/v1/vouchers
 *
 * Creates a new voucher using VoucherEngine.
 * Security:
 *  - Auth check is FIRST — 401 before body parsing (T-02-13)
 *  - companyId is NEVER read from body — always from session.user.companyId (T-02-12)
 *  - Zod parse happens before any DB write (T-02-11)
 *  - ValidationError from VoucherEngine (unbalanced DR/CR) returns 422
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = createVoucherSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  // Server-side canonical TDS re-computation (T-03-07-02) — never trust client-provided tdsAmount
  // Applies only to PAYMENT vouchers with tdsSection + tdsRate present
  const parsedData = parsed.data as Record<string, unknown>
  if (parsedData.voucherType === 'PAYMENT' && parsedData.tdsSection && parsedData.tdsRate) {
    try {
      const canonical = new Decimal(parsedData.amount as string)
        .times(new Decimal(parsedData.tdsRate as string))
        .dividedBy(100)
      parsedData.tdsAmount = canonical.toDecimalPlaces(2).toString()
    } catch {
      // If arithmetic fails (invalid strings), leave tdsAmount as-is; VoucherEngine will reject
    }
  }

  // Entry builder for PAYMENT — constructs double-entry legs from high-level fields (TDS-01 gap closure)
  // companyId for TDS Payable lookup comes exclusively from session.user.companyId (T-02-12)
  if (parsedData.voucherType === 'PAYMENT') {
    const gross = new Decimal(parsedData.amount as string)
    let tdsPayableLedgerId: string | null = null
    let tdsAmt: Decimal | null = null

    if (parsedData.tdsSection && parsedData.tdsAmount) {
      try {
        tdsAmt = new Decimal(parsedData.tdsAmount as string)
        tdsPayableLedgerId = await resolveTdsPayableLedger(prisma, session.user.companyId)
      } catch {
        tdsAmt = null
        tdsPayableLedgerId = null
      }
    }

    parsedData.entries = buildPaymentEntries(
      parsedData.partyLedgerId as string,
      parsedData.bankLedgerId as string,
      gross,
      tdsPayableLedgerId,
      tdsAmt,
    )
  }

  // Entry builder for RECEIPT — Dr Bank, Cr Party (TDS-01 gap closure scope)
  if (parsedData.voucherType === 'RECEIPT') {
    const amt = new Decimal(parsedData.amount as string)
    parsedData.entries = buildReceiptEntries(
      parsedData.bankLedgerId as string,
      parsedData.partyLedgerId as string,
      amt,
    )
  }

  // Entry builder for PURCHASE and SALES — auto-resolve standard ledgers, compute GST server-side
  if ((parsedData.voucherType === 'PURCHASE' || parsedData.voucherType === 'SALES') && (parsedData.items as Array<Record<string, unknown>>).length > 0) {
    const companyId = session.user.companyId
    const isPurchase = parsedData.voucherType === 'PURCHASE'

    // Resolve required account groups FIRST — fail fast with a clear message if missing
    const [purchaseGroup, salesGroup, gstGroup] = await Promise.all([
      prisma.accountGroup.findFirst({ where: { companyId, name: 'Purchase Accounts' } }),
      prisma.accountGroup.findFirst({ where: { companyId, name: 'Direct Income' } }),
      prisma.accountGroup.findFirst({ where: { companyId, name: 'Duties & Taxes' } }),
    ])

    if (!purchaseGroup || !salesGroup || !gstGroup) {
      return NextResponse.json(
        { error: 'Standard account groups (Purchase Accounts / Direct Income / Duties & Taxes) not found. Please run the database seed for this company.' },
        { status: 422 }
      )
    }

    // Upsert standard trading ledgers — safe now that groups are confirmed to exist
    const [tradingLedger, gstLedger] = await Promise.all([
      isPurchase
        ? prisma.ledger.upsert({
            where: { companyId_name: { companyId, name: 'Purchase Account' } },
            update: {},
            create: {
              companyId, name: 'Purchase Account',
              groupId: purchaseGroup.id,
              openingBalance: '0', drCr: 'DR',
              gstRegType: 'UNREGISTERED', isActive: true,
            },
          })
        : prisma.ledger.upsert({
            where: { companyId_name: { companyId, name: 'Sales Income' } },
            update: {},
            create: {
              companyId, name: 'Sales Income',
              groupId: salesGroup.id,
              openingBalance: '0', drCr: 'CR',
              gstRegType: 'UNREGISTERED', isActive: true,
            },
          }),
      prisma.ledger.upsert({
        where: { companyId_name: { companyId, name: 'GST Payable' } },
        update: {},
        create: {
          companyId, name: 'GST Payable',
          groupId: gstGroup.id,
          openingBalance: '0', drCr: 'CR',
          gstRegType: 'UNREGISTERED', isActive: true,
        },
      }),
    ])

    // Compute totals from items — GST rate is per-item gstRateOverride or looked up from stock master
    const items = parsedData.items as Array<Record<string, unknown>>
    const itemIds = items.map((i) => i.itemId as string)
    const stockItems = await prisma.stockItem.findMany({
      where: { companyId, id: { in: itemIds } },
      select: { id: true, gstRate: true },
    })
    const rateByItemId = Object.fromEntries(stockItems.map((s) => [s.id, Number(s.gstRate)]))

    // Determine intra vs inter-state using company and party state codes
    const [company, partyLedger] = await Promise.all([
      prisma.company.findUnique({ where: { id: companyId }, select: { stateCode: true } }),
      prisma.ledger.findUnique({ where: { id: parsedData.partyLedgerId as string }, select: { gstin: true } }),
    ])
    const companyState = company?.stateCode ?? ''
    const partyState = partyLedger?.gstin ? partyLedger.gstin.substring(0, 2) : companyState
    const isInterState = companyState !== '' && partyState !== '' && companyState !== partyState

    let taxableTotal = new Decimal(0)
    let gstTotal = new Decimal(0)

    for (const item of items) {
      const qty = new Decimal(String(item.qty || 0))
      const rate = new Decimal(String(item.rate || 0))
      const discPct = new Decimal(String(item.discountPct || 0))
      const itemTaxable = qty.times(rate).times(new Decimal(1).minus(discPct.dividedBy(100)))
      taxableTotal = taxableTotal.plus(itemTaxable)

      const gstRate = new Decimal(
        String(item.gstRateOverride ?? rateByItemId[item.itemId as string] ?? 0)
      )
      const gstResult = calculateGST({
        taxableValue: itemTaxable,
        gstRate,
        companyStateCode: companyState,
        partyStateCode: partyState,
      })
      gstTotal = gstTotal.plus(gstResult.cgst).plus(gstResult.sgst).plus(gstResult.igst)

      // Enrich item — amount is required (non-nullable) on VoucherItem; GST components feed GstTransaction
      item.amount = itemTaxable.toDecimalPlaces(2).toString()
      item.cgstRate = gstResult.cgstRate.toString()
      item.cgstAmt = gstResult.cgst.toDecimalPlaces(2).toString()
      item.sgstRate = gstResult.sgstRate.toString()
      item.sgstAmt = gstResult.sgst.toDecimalPlaces(2).toString()
      item.igstRate = gstResult.igstRate.toString()
      item.igstAmt = gstResult.igst.toDecimalPlaces(2).toString()
    }

    const grandTotal = taxableTotal.plus(gstTotal)

    // Double-entry: trading side + GST side + party side
    const entries: Array<Record<string, unknown>> = []

    if (taxableTotal.gt(0)) {
      entries.push({
        ledgerId: tradingLedger.id,
        drCr: isPurchase ? 'DR' : 'CR',
        amount: taxableTotal.toDecimalPlaces(2),
        narration: isPurchase ? 'Purchases' : 'Sales',
      })
    }
    if (gstTotal.gt(0)) {
      entries.push({
        ledgerId: gstLedger.id,
        drCr: isPurchase ? 'DR' : 'CR',
        amount: gstTotal.toDecimalPlaces(2),
        narration: isInterState ? 'IGST' : 'CGST + SGST',
      })
    }
    if (grandTotal.gt(0)) {
      entries.push({
        ledgerId: parsedData.partyLedgerId,
        drCr: isPurchase ? 'CR' : 'DR',
        amount: grandTotal.toDecimalPlaces(2),
      })
    }

    parsedData.entries = entries
  }

  try {
    // companyId is injected from session inside createVoucher — never from parsed.data (T-02-12)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const voucher = await createVoucher(parsedData as unknown as Parameters<typeof createVoucher>[0], session)
    const v = voucher as { id: string; voucherNo: string }
    return NextResponse.json({ id: v.id, voucherNo: v.voucherNo }, { status: 201 })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[POST /api/v1/vouchers]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * GET /api/v1/vouchers
 *
 * Lists vouchers for the authenticated company (multi-tenant).
 * Security:
 *  - companyId always from session.user.companyId (T-02-11)
 *  - type/status/date/partyId/q filters are additive ON TOP of companyId scope
 *
 * Query params:
 *  - type:    VoucherType filter (SALES | PURCHASE | RECEIPT | PAYMENT | JOURNAL | CONTRA | CREDIT_NOTE | DEBIT_NOTE)
 *  - status:  VoucherStatus filter (DRAFT | POSTED | CANCELLED)
 *  - from:    ISO date string (YYYY-MM-DD) — start of date range
 *  - to:      ISO date string (YYYY-MM-DD) — end of date range
 *  - partyId: ledger ID — filter by party
 *  - q:       search string — matches voucherNo (contains)
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // T-02-11: companyId always from session — NEVER from query params or body
  const companyId = session.user.companyId
  const { searchParams } = new URL(request.url)

  const typeParam = searchParams.get('type')
  const statusParam = searchParams.get('status')
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const partyId = searchParams.get('partyId')
  const q = searchParams.get('q')

  // Build where clause — companyId is always first and mandatory
  const whereClause: Record<string, unknown> = { companyId }

  if (typeParam && VALID_VOUCHER_TYPES.includes(typeParam as VoucherType)) {
    whereClause.voucherType = typeParam as VoucherType
  }
  if (statusParam && VALID_STATUSES.includes(statusParam as VoucherStatus)) {
    whereClause.status = statusParam as VoucherStatus
  }
  if (fromParam && toParam) {
    whereClause.date = {
      gte: new Date(fromParam),
      lte: new Date(toParam),
    }
  }
  if (partyId) {
    whereClause.partyLedgerId = partyId
  }
  if (q) {
    whereClause.voucherNo = { contains: q, mode: 'insensitive' }
  }

  try {
    const vouchers = await prisma.voucher.findMany({
      where: whereClause,
      include: {
        partyLedger: { select: { id: true, name: true } },
        billRefs: { select: { outstandingAmount: true }, where: { settled: false } },
      },
      orderBy: { date: 'desc' },
      take: 100,
    })

    // Serialize Decimal fields to string (Decimal instances are not JSON-serializable)
    const serialized = vouchers.map((v) => ({
      ...v,
      totalAmount: v.totalAmount.toString(),
      cgstAmount: v.cgstAmount.toString(),
      sgstAmount: v.sgstAmount.toString(),
      igstAmount: v.igstAmount.toString(),
      roundOff: v.roundOff.toString(),
      billRefs: v.billRefs.map((br) => ({
        ...br,
        outstandingAmount: br.outstandingAmount.toString(),
      })),
    }))

    return NextResponse.json(serialized)
  } catch (err) {
    console.error('[vouchers GET]', err)
    return NextResponse.json({ error: 'Failed to load vouchers' }, { status: 500 })
  }
}
