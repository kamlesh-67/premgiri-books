/**
 * route.tsx — Sales Invoice PDF generation endpoint
 *
 * Next.js 15 App Router, Node.js runtime only.
 * react-pdf uses native Node modules — Edge runtime is not supported.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { uploadFile, getPresignedUrl, fileExists } from '@/lib/r2'
import { amountToWords } from '@/lib/utils/amountToWords'
import { Decimal } from 'decimal.js'
import React from 'react'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyId = session.companyId
    const { id } = await params

    // ── Fetch Voucher ────────────────────────────────────────────────────
    const voucher = await prisma.voucher.findFirst({
      where: { id, companyId },
      include: {
        partyLedger: {
          select: {
            name: true,
            gstin: true,
            pan: true,
            stateCode: true,
            address: true,
          },
        },
        voucherItems: {
          include: { item: { select: { name: true } } },
        },
      },
    })

    if (!voucher || voucher.voucherType !== 'SALES') {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    if (voucher.status === 'DRAFT') {
      return NextResponse.json(
        { error: 'PDF not available for draft invoices' },
        { status: 400 }
      )
    }

    // ── Fetch Company ────────────────────────────────────────────────────
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: {
        name: true,
        gstin: true,
        pan: true,
        stateCode: true,
        address: true,
        logoUrl: true,
      },
    })

    // ── R2 Cache (POSTED invoices only) ──────────────────────────────────
    const r2Key = `invoices/${companyId}/${id}.pdf`
    if (voucher.status === 'POSTED' && (await fileExists(r2Key))) {
      const url = await getPresignedUrl(r2Key)
      return NextResponse.json({ url })
    }

    // ── Build Plain Payloads ─────────────────────────────────────────────
    const totalDec    = new Decimal(voucher.totalAmount.toString())
    const cgstDec     = new Decimal(voucher.cgstAmount?.toString()  ?? '0')
    const sgstDec     = new Decimal(voucher.sgstAmount?.toString()  ?? '0')
    const igstDec     = new Decimal(voucher.igstAmount?.toString()  ?? '0')
    const roundOffDec = new Decimal(voucher.roundOff?.toString()    ?? '0')
    // Taxable subtotal: grand total minus all GST components and round-off
    const subtotalDec = totalDec
      .minus(cgstDec)
      .minus(sgstDec)
      .minus(igstDec)
      .minus(roundOffDec)

    const fmtDate = (d: Date) =>
      d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })

    const voucherPayload = {
      voucherNo:       String(voucher.voucherNo ?? ''),
      date:            fmtDate(voucher.date),
      dueDate:         fmtDate(voucher.dueDate ?? voucher.date),
      paymentTerms:    String(voucher.paymentTerms ?? '0 days'),
      placeOfSupply:   String(
        voucher.placeOfSupply ??
          (voucher.partyLedger?.stateCode
            ? `${voucher.partyLedger.stateCode} - Rajasthan`
            : '—')
      ),
      reverseCharge:   voucher.reverseCharge ? 'Yes' : 'No',
      // GST totals
      subtotal:        subtotalDec.toFixed(2),
      cgstTotal:       cgstDec.toFixed(2),
      sgstTotal:       sgstDec.toFixed(2),
      igstTotal:       igstDec.toFixed(2),
      roundOff:        roundOffDec.toFixed(2),
      totalAmount:     totalDec.toFixed(2),
      amountInWords:   String(amountToWords(totalDec)),
      // Party details
      partyName:       String(voucher.partyLedger?.name ?? 'Cash'),
      partyGstin:      String(voucher.partyLedger?.gstin ?? ''),
      partyAddress:    String(
        voucher.billingAddress ?? voucher.partyLedger?.address ?? '—'
      ),
      shippingAddress: String(
        voucher.shippingAddress ??
          voucher.billingAddress ??
          voucher.partyLedger?.address ??
          '—'
      ),
      isTaxInvoice:    !!(company.gstin && voucher.partyLedger?.gstin),
      items: (voucher.voucherItems ?? []).map((item, idx) => {
        const cgstRateDec  = new Decimal((item.cgstRate ?? 0).toString())
        const sgstRateDec  = new Decimal((item.sgstRate ?? 0).toString())
        const igstRateDec  = new Decimal((item.igstRate ?? 0).toString())
        const cgstAmtDec   = new Decimal(item.cgstAmt?.toString()     ?? '0')
        const sgstAmtDec   = new Decimal(item.sgstAmt?.toString()     ?? '0')
        const igstAmtDec   = new Decimal(item.igstAmt?.toString()     ?? '0')
        const discAmtDec   = new Decimal(item.discountAmt?.toString() ?? '0')
        const totalTaxRate = cgstRateDec.plus(sgstRateDec).plus(igstRateDec)
        return {
          id:       String(item.id),
          index:    String(idx + 1),
          name:     String(item.item?.name ?? 'Item'),
          hsnCode:  String(item.hsnCode     ?? ''),
          qty:      new Decimal(item.qty.toString()).toFixed(2),
          unit:     String(item.unit         ?? 'Pcs.'),
          rate:     new Decimal(item.rate.toString()).toFixed(2),
          disc:     new Decimal(item.discountPct?.toString() ?? '0').toFixed(2),
          discAmt:  discAmtDec.toFixed(2),
          taxRate:  totalTaxRate.gt(0) ? totalTaxRate.toFixed(2) : '0',
          cgstRate: cgstRateDec.toFixed(2),
          sgstRate: sgstRateDec.toFixed(2),
          igstRate: igstRateDec.toFixed(2),
          cgstAmt:  cgstAmtDec.toFixed(2),
          sgstAmt:  sgstAmtDec.toFixed(2),
          igstAmt:  igstAmtDec.toFixed(2),
          amount:   new Decimal(item.amount.toString()).toFixed(2),
        }
      }),
    }

    const companyPayload = {
      name:    String(company.name    ?? ''),
      gstin:   String(company.gstin   ?? ''),
      pan:     String(company.pan     ?? ''),
      address: String(company.address ?? ''),
      logoUrl: String(company.logoUrl ?? ''),
    }

    // Serialize to strip all Prisma/Decimal proxy objects — pure JSON only
    const safeVoucher = JSON.parse(JSON.stringify(voucherPayload))
    const safeCompany = JSON.parse(JSON.stringify(companyPayload))
    const isCancelled = voucher.status === 'CANCELLED'

    // ── Render PDF ────────────────────────────────────────────────────────
    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { SalesInvoicePDF } =
      await import('@/lib/services/PDFTemplates/SalesInvoicePDF')

    // Use React.createElement so the reconciler invokes SalesInvoicePDF as a
    // proper component (with fiber context) rather than as a plain function.
    const element = React.createElement(SalesInvoicePDF, {
      voucher:   safeVoucher,
      company:   safeCompany,
      cancelled: isCancelled,
    }) as React.ReactElement

    const buffer = await renderToBuffer(element)

    // ── Upload to R2 & return pre-signed URL ─────────────────────────────
    await uploadFile(r2Key, buffer, 'application/pdf')
    const url = await getPresignedUrl(r2Key)
    return NextResponse.json({ url })

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err))
    console.error('[pdf GET] Critical failure', {
      error: error.stack ?? error.message,
    })
    return NextResponse.json(
      { error: `PDF Generation Failed: ${error.message}` },
      { status: 500 }
    )
  }
}
