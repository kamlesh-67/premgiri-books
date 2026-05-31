/**
 * GET /api/v1/vouchers/[id]/pdf
 *
 * Generates a Sales Invoice PDF on demand, uploads to Cloudflare R2,
 * and returns a 15-minute pre-signed URL.
 *
 * Cache behaviour (D-04):
 *  - POSTED voucher + R2 key exists  → return existing pre-signed URL (immutable PDF)
 *  - POSTED voucher + R2 key missing → generate + upload + return URL
 *  - CANCELLED voucher               → always regenerate with CANCELLED watermark
 *  - DRAFT voucher                   → 400 (no PDF for drafts)
 *
 * IDOR protection (T-03-04-01):
 *  Always WHERE { id, companyId } — id alone is NOT sufficient.
 *  companyId always from session — NEVER from URL params or request body.
 *
 * R2 key pattern (T-03-04-02):
 *  invoices/{companyId}/{voucherId}.pdf
 *  Both values come from session/DB — user input never reaches the key.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { renderToBuffer } from '@react-pdf/renderer'
import { SalesInvoicePDF } from '@/lib/services/PDFTemplates/SalesInvoicePDF'
import { uploadFile, getPresignedUrl, fileExists } from '@/lib/r2'
import React from 'react'
import QRCode from 'qrcode'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Auth guard ────────────────────────────────────────────────────────────
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // companyId MUST come from session — never from URL (T-03-04-01, CLAUDE.md Rule 9)
  const companyId = session.companyId
  const { id } = await params

  // ── Fetch voucher with IDOR protection ───────────────────────────────────
  // Both id AND companyId required — prevents cross-tenant access
  const voucher = await prisma.voucher.findFirst({
    where: { id, companyId },
    include: {
      partyLedger: {
        select: {
          name: true,
          gstin: true,
          stateCode: true,
          // Note: Ledger model has no `address` field in schema — not included
        },
      },
      voucherItems: {
        include: {
          item: { select: { name: true } },
        },
      },
    },
  })

  if (!voucher) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // ── Validate voucher type ─────────────────────────────────────────────────
  if (voucher.voucherType !== 'SALES') {
    return NextResponse.json(
      { error: 'PDF generation is only supported for Sales Invoices' },
      { status: 400 }
    )
  }

  // ── Reject DRAFT vouchers ─────────────────────────────────────────────────
  if (voucher.status === 'DRAFT') {
    return NextResponse.json(
      { error: 'PDF is not available for draft invoices. Post the invoice first.' },
      { status: 400 }
    )
  }

  // ── Fetch company details (no direct relation on Voucher) ─────────────────
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: {
      name: true,
      gstin: true,
      stateCode: true,
      address: true,
      logoUrl: true,
    },
  })

  // ── R2 key (T-03-04-02 — both values from session/DB, not user input) ─────
  const r2Key = `invoices/${companyId}/${id}.pdf`

  // ── Cache hit: POSTED + already exists ───────────────────────────────────
  // POSTED vouchers are immutable by business rule — safe to serve cached PDF.
  // CANCELLED vouchers bypass cache and always regenerate with watermark (D-04).
  if (voucher.status === 'POSTED' && (await fileExists(r2Key))) {
    const url = await getPresignedUrl(r2Key)
    return NextResponse.json({ url })
  }

  // ── Generate PDF ──────────────────────────────────────────────────────────
  try {
    // Generate QR code data URL from irnQrCode (SignedQRCode JWT) if present
    const qrDataUrl = voucher.irnQrCode
      ? await QRCode.toDataURL(voucher.irnQrCode, {
          errorCorrectionLevel: 'M',
          width: 120,
          margin: 1,
        })
      : null

    // React.createElement is used here (not JSX) because this is a .ts file.
    // The cast to React.ReactElement is required because React.createElement returns
    // React.FunctionComponentElement<Props> which is narrower than ReactElement<DocumentProps>.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(SalesInvoicePDF as any, {
      voucher: {
        id: voucher.id,
        voucherNo: voucher.voucherNo,
        date: voucher.date,
        status: voucher.status as 'DRAFT' | 'POSTED' | 'CANCELLED',
        totalAmount: voucher.totalAmount,
        cgstAmount: voucher.cgstAmount,
        sgstAmount: voucher.sgstAmount,
        igstAmount: voucher.igstAmount,
        roundOff: voucher.roundOff,
        narration: voucher.narration,
        irn: voucher.irn ?? null,
        partyLedger: voucher.partyLedger ?? null,
        voucherItems: voucher.voucherItems,
      },
      company: {
        name: company.name,
        gstin: company.gstin ?? null,
        stateCode: company.stateCode,
        address: null, // Ledger model has no address field in schema
        logoUrl: company.logoUrl ?? null,
        // Company bank details not on the Company model — future enhancement
        bankName: null,
        bankAccount: null,
        ifsc: null,
      },
      cancelled: voucher.status === 'CANCELLED',
      qrDataUrl,
    }) as React.ReactElement

    const buffer = await renderToBuffer(element)

    await uploadFile(r2Key, buffer, 'application/pdf')
    const url = await getPresignedUrl(r2Key)
    return NextResponse.json({ url })
  } catch (err) {
    console.error('[pdf GET] PDF generation failed', { voucherId: id, error: err })
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
