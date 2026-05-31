import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { Decimal } from 'decimal.js'

const periodSchema = z.string().regex(/^\d{2}\/\d{4}$/, 'Period must be MM/YYYY')

// ITC reconciliation match status
type MatchStatus = 'MATCHED' | 'BOOKS_ONLY' | 'PORTAL_ONLY' | 'EXCESS'

interface ItcRow {
  matchStatus: MatchStatus
  supplierGstin: string
  partyName: string
  invoiceNo: string
  invoiceDate: string
  books: { taxableValue: string; cgst: string; sgst: string } | null
  portal: { taxableValue: string; cgst: string; sgst: string } | null
}

/**
 * GET /api/v1/gst/itc?period=MM/YYYY
 *
 * Returns ITC reconciliation diff: books (GstTransaction) vs portal (Gstr2aImport).
 * Matching is by [supplierGstin + invoiceNo] with ₹1 tolerance (D-03).
 * Three states: MATCHED, BOOKS_ONLY, PORTAL_ONLY, plus EXCESS for amount mismatches.
 *
 * Security:
 *  - auth() first — 401 before any processing
 *  - companyId ALWAYS from session.companyId
 *  - period validated with Zod before any DB operation
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId  // NEVER from query params or body
  const { searchParams } = new URL(request.url)

  const periodParam = searchParams.get('period')
  const periodParsed = periodSchema.safeParse(periodParam)
  if (!periodParsed.success) {
    return NextResponse.json(
      { error: 'period query param required in MM/YYYY format' },
      { status: 400 }
    )
  }
  const period = periodParsed.data

  try {
    // Portal side: GSTR-2A imported data for this period
    const portalRows = await prisma.gstr2aImport.findMany({
      where: { companyId, returnPeriod: period },
    })

    // Books side: posted PURCHASE GstTransactions for this period
    const booksRows = await prisma.gstTransaction.findMany({
      where: {
        companyId,
        returnPeriod: period,
        voucher: {
          status: 'POSTED',
          voucherType: 'PURCHASE',
        },
      },
      include: {
        voucher: {
          select: {
            voucherNo: true,
            date: true,
            partyLedger: { select: { name: true, gstin: true } },
          },
        },
      },
    })

    // Build lookup maps: key = supplierGstin + '|' + invoiceNo
    const portalMap = new Map<string, (typeof portalRows)[number]>()
    for (const row of portalRows) {
      const key = `${row.supplierGstin}|${row.invoiceNo}`
      portalMap.set(key, row)
    }

    const booksMap = new Map<string, (typeof booksRows)[number]>()
    for (const row of booksRows) {
      // For purchase vouchers: gstinSupplier is the party's GSTIN
      const supplierGstin = row.gstinSupplier ?? row.voucher.partyLedger?.gstin ?? ''
      const invoiceNo = row.voucher.voucherNo
      const key = `${supplierGstin}|${invoiceNo}`
      booksMap.set(key, row)
    }

    // Build diff rows
    const rows: ItcRow[] = []
    const processedKeys = new Set<string>()

    // Process books entries
    for (const booksRow of booksRows) {
      const supplierGstin = booksRow.gstinSupplier ?? booksRow.voucher.partyLedger?.gstin ?? ''
      const invoiceNo = booksRow.voucher.voucherNo
      const key = `${supplierGstin}|${invoiceNo}`
      processedKeys.add(key)

      const portalRow = portalMap.get(key)
      const booksData = {
        taxableValue: booksRow.taxableValue.toString(),
        cgst: booksRow.cgst.toString(),
        sgst: booksRow.sgst.toString(),
      }

      if (!portalRow) {
        // Books only — supplier hasn't filed
        rows.push({
          matchStatus: 'BOOKS_ONLY',
          supplierGstin,
          partyName: booksRow.voucher.partyLedger?.name ?? '',
          invoiceNo,
          invoiceDate: booksRow.voucher.date.toISOString().split('T')[0],
          books: booksData,
          portal: null,
        })
      } else {
        // Both exist — check tolerance (₹1 per D-03)
        const booksTaxable = new Decimal(booksRow.taxableValue)
        const portalTaxable = new Decimal(portalRow.taxableValue)
        const diff = booksTaxable.minus(portalTaxable).abs()
        const isMatched = diff.lte(new Decimal('1.00'))

        const portalData = {
          taxableValue: portalRow.taxableValue.toString(),
          cgst: portalRow.cgst.toString(),
          sgst: portalRow.sgst.toString(),
        }

        rows.push({
          matchStatus: isMatched ? 'MATCHED' : 'EXCESS',
          supplierGstin,
          partyName: booksRow.voucher.partyLedger?.name ?? '',
          invoiceNo,
          invoiceDate: booksRow.voucher.date.toISOString().split('T')[0],
          books: booksData,
          portal: portalData,
        })
      }
    }

    // Process portal-only entries (not seen in books)
    for (const portalRow of portalRows) {
      const key = `${portalRow.supplierGstin}|${portalRow.invoiceNo}`
      if (processedKeys.has(key)) continue  // already handled

      rows.push({
        matchStatus: 'PORTAL_ONLY',
        supplierGstin: portalRow.supplierGstin,
        partyName: '',
        invoiceNo: portalRow.invoiceNo,
        invoiceDate: portalRow.invoiceDate.toISOString().split('T')[0],
        books: null,
        portal: {
          taxableValue: portalRow.taxableValue.toString(),
          cgst: portalRow.cgst.toString(),
          sgst: portalRow.sgst.toString(),
        },
      })
    }

    // Build summary counts
    const summary = {
      matched: rows.filter((r) => r.matchStatus === 'MATCHED').length,
      booksOnly: rows.filter((r) => r.matchStatus === 'BOOKS_ONLY').length,
      portalOnly: rows.filter((r) => r.matchStatus === 'PORTAL_ONLY').length,
      excess: rows.filter((r) => r.matchStatus === 'EXCESS').length,
    }

    return NextResponse.json({ summary, rows })
  } catch (err) {
    console.error('[gst/itc GET]', err)
    return NextResponse.json({ error: 'Failed to load ITC reconciliation data' }, { status: 500 })
  }
}
