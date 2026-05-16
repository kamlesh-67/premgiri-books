/**
 * GET /api/v1/bank-statements/[id]/pdf
 *
 * Generates a Bank Reconciliation Statement (BRS) PDF on demand,
 * uploads to Cloudflare R2, and returns a 15-minute pre-signed URL.
 *
 * NO caching — BRS PDFs always regenerate (RESEARCH.md Pattern 7):
 *  - Unlike invoice PDFs, BRS data changes as matches are confirmed/rejected.
 *  - Always regenerate; never check fileExists before rendering.
 *
 * IDOR protection (T-07-05-01):
 *  Always WHERE { id, companyId } — id alone is NOT sufficient.
 *  companyId always from session — NEVER from URL params or request body.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { renderToBuffer } from '@react-pdf/renderer'
import { BankReconciliationPDF } from '@/lib/services/PDFTemplates/BankReconciliationPDF'
import type { BrsPdfProps } from '@/lib/services/PDFTemplates/BankReconciliationPDF'
import { computeBrsData } from '@/lib/services/BankService'
import { uploadFile, getPresignedUrl, buildR2Key } from '@/lib/r2'
import React from 'react'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Auth guard ────────────────────────────────────────────────────────────
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // companyId MUST come from session — never from URL (T-07-05-01)
  const companyId = session.user.companyId
  const { id } = await params

  // ── IDOR protection: fetch statement with companyId guard ─────────────────
  const stmt = await prisma.bankStatement.findFirst({
    where: { id, companyId },
    include: { ledger: { select: { name: true } } },
  })
  if (!stmt) {
    return NextResponse.json({ error: 'Bank statement not found' }, { status: 404 })
  }

  // ── Fetch company details ─────────────────────────────────────────────────
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { name: true, gstin: true, address: true, logoUrl: true },
  })

  // ── Compute BRS data ──────────────────────────────────────────────────────
  let brsData
  try {
    brsData = await computeBrsData(id, companyId)
  } catch (err) {
    console.error('[bank-statements/[id]/pdf GET] computeBrsData failed', err)
    return NextResponse.json({ error: 'Failed to compute BRS data' }, { status: 500 })
  }

  // ── Fetch unmatched bank entries (bank transactions without book match) ───
  const unmatchedBankTxns = await prisma.bankTransaction.findMany({
    where: {
      statementId: id,
      companyId,
      matchStatus: { in: ['UNMATCHED', 'REJECTED'] },
    },
    orderBy: { txDate: 'asc' },
  })

  const unmatchedBankEntries = unmatchedBankTxns.map((tx) => ({
    txDate: tx.txDate.toISOString(),
    description: tx.description,
    // Use debitAmount if present, otherwise creditAmount
    amount: tx.debitAmount?.toFixed(2) ?? tx.creditAmount?.toFixed(2) ?? '0.00',
  }))

  // ── Fetch unmatched book entries (posted RECEIPT/PAYMENT not matched) ─────
  // Query: POSTED vouchers in statement date window that have no CONFIRMED/AUTO_* match
  const unmatchedVouchers = await prisma.voucher.findMany({
    where: {
      companyId,
      status: 'POSTED',
      voucherType: { in: ['RECEIPT', 'PAYMENT'] },
      date: { gte: stmt.fromDate, lte: stmt.toDate },
      bankTransactions: {
        none: {
          statementId: id,
          matchStatus: { in: ['AUTO_HIGH', 'AUTO_MEDIUM', 'AUTO_LOW', 'CONFIRMED'] },
        },
      },
    },
    select: {
      voucherNo: true,
      date: true,
      totalAmount: true,
      voucherType: true,
    },
    orderBy: { date: 'asc' },
  })

  const unmatchedBookEntries = unmatchedVouchers.map((v) => ({
    voucherNo: v.voucherNo,
    date: v.date.toISOString(),
    amount: v.totalAmount.toFixed(2),
    type: v.voucherType,
  }))

  // ── Construct BrsPdfProps ─────────────────────────────────────────────────
  const partialLabel = !brsData.isReconciled
    ? `Partial reconciliation as at ${new Date(stmt.toDate).toISOString().split('T')[0]}`
    : undefined

  const pdfProps: BrsPdfProps = {
    company: {
      name: company.name,
      gstin: company.gstin ?? null,
      address: company.address ?? null,
      logoUrl: company.logoUrl ?? null,
    },
    statement: {
      bank: stmt.bank,
      ledgerName: stmt.ledger.name,
      fromDate: stmt.fromDate.toISOString(),
      toDate: stmt.toDate.toISOString(),
      bankClosingBalance: brsData.bankClosingBalance,
      booksClosingBalance: brsData.booksClosingBalance,
      difference: brsData.difference,
      isReconciled: brsData.isReconciled,
    },
    unmatchedBankEntries,
    unmatchedBookEntries,
    partialLabel,
  }

  // ── R2 key — BRS PDFs always regenerated (no cache check per RESEARCH.md P7) ─
  const r2Key = buildR2Key('statements', companyId, id, 'brs.pdf')

  // ── Generate PDF, upload to R2, return pre-signed URL ────────────────────
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(BankReconciliationPDF as any, pdfProps) as React.ReactElement
    const buffer = await renderToBuffer(element)
    await uploadFile(r2Key, buffer, 'application/pdf')
    const url = await getPresignedUrl(r2Key)
    return NextResponse.json({ url })
  } catch (err) {
    console.error('[bank-statements/[id]/pdf GET] PDF generation failed', { statementId: id, error: err })
    return NextResponse.json({ error: 'Failed to generate BRS PDF' }, { status: 500 })
  }
}
