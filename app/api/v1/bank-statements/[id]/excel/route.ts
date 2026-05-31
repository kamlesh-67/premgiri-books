/**
 * GET /api/v1/bank-statements/[id]/excel
 *
 * Generates a BRS Excel workbook (.xlsx) on demand and streams it as an
 * attachment (no R2 storage needed — served directly from memory).
 *
 * Sheet 1 "BRS Summary" — Standard Indian BRS add/less format.
 * Sheet 2 "Transactions" — Full bank transaction list with match status.
 *
 * IDOR protection (T-07-05-01):
 *  Always WHERE { id, companyId } — companyId always from session.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { computeBrsData } from '@/lib/services/BankService'
import ExcelJS from 'exceljs'

type Params = { params: Promise<{ id: string }> }

export async function GET(
  (request: NextRequest),
  { params }: Params
) {
  // ── Auth guard ────────────────────────────────────────────────────────────
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // companyId MUST come from session — never from URL (T-07-05-01)
  const companyId = session.companyId
  const { id } = await params

  // ── IDOR protection: fetch statement with companyId guard ─────────────────
  const stmt = await prisma.bankStatement.findFirst({
    where: { id, companyId },
    include: { ledger: { select: { name: true } } },
  })
  if (!stmt) {
    return NextResponse.json({ error: 'Bank statement not found' }, { status: 404 })
  }

  // ── Fetch company name ────────────────────────────────────────────────────
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { name: true },
  })

  // ── Compute BRS data ──────────────────────────────────────────────────────
  let brsData
  try {
    brsData = await computeBrsData(id, companyId)
  } catch (err) {
    console.error('[bank-statements/[id]/excel GET] computeBrsData failed', err)
    return NextResponse.json({ error: 'Failed to compute BRS data' }, { status: 500 })
  }

  // ── Fetch all transactions ordered by date ────────────────────────────────
  const transactions = await prisma.bankTransaction.findMany({
    where: { statementId: id, companyId },
    orderBy: { txDate: 'asc' },
    include: { voucher: { select: { voucherNo: true } } },
  })

  // ── Build ExcelJS workbook ─────────────────────────────────────────────────
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'PremGiri Books'
  workbook.created = new Date()

  // ── Sheet 1: BRS Summary ──────────────────────────────────────────────────
  const summarySheet = workbook.addWorksheet('BRS Summary')

  // Company name header (merged, bold)
  summarySheet.mergeCells('A1:C1')
  const companyCell = summarySheet.getCell('A1')
  companyCell.value = company.name
  companyCell.font = { bold: true, size: 14 }
  companyCell.alignment = { horizontal: 'center' }

  // BRS title
  summarySheet.mergeCells('A2:C2')
  const titleCell = summarySheet.getCell('A2')
  titleCell.value = 'BANK RECONCILIATION STATEMENT'
  titleCell.font = { bold: true, size: 12, color: { argb: 'FF7C3AED' } }
  titleCell.alignment = { horizontal: 'center' }

  // Bank + date range meta
  summarySheet.getCell('A3').value = 'Bank'
  summarySheet.getCell('A3').font = { bold: true }
  summarySheet.getCell('B3').value = `${stmt.ledger.name} (${stmt.bank})`

  summarySheet.getCell('A4').value = 'Period'
  summarySheet.getCell('A4').font = { bold: true }
  const fromIso = stmt.fromDate.toISOString().split('T')[0]
  const toIso = stmt.toDate.toISOString().split('T')[0]
  summarySheet.getCell('B4').value = `${fromIso} to ${toIso}`

  summarySheet.getCell('A5').value = 'As at'
  summarySheet.getCell('A5').font = { bold: true }
  summarySheet.getCell('B5').value = toIso

  // Blank row separator
  summarySheet.addRow([])

  // BRS Standard rows
  // CR-03: amounts written as strings — ExcelJS accepts string values; avoids float imprecision
  const brsRows = [
    ['Balance as per Bank Statement', brsData.bankClosingBalance],
    ['Add: Deposits recorded in books not yet in bank', null],
    ['Less: Cheques issued but not yet presented', null],
    ['', ''],
    ['Balance as per Books', brsData.booksClosingBalance],
    ['Difference', brsData.difference],
  ]

  let rowIndex = 7 // row 6 is blank
  for (const [label, amount] of brsRows) {
    const row = summarySheet.addRow([label, amount])
    row.getCell(1).font = {
      bold: label === 'Balance as per Books' || label === 'Balance as per Bank Statement',
    }
    if (typeof amount === 'string' && amount !== '' && amount !== null) {
      row.getCell(2).numFmt = '#,##0.00'
    }
    rowIndex++
  }

  // Reconciliation status row
  const statusRow = summarySheet.addRow([
    brsData.isReconciled
      ? 'Reconciled — Closing balances agree'
      : `Gap: ${brsData.difference} — ${brsData.unmatchedCount} items remaining`,
  ])
  statusRow.getCell(1).font = {
    bold: true,
    color: { argb: brsData.isReconciled ? 'FF15803D' : 'FFB91C1C' },
  }

  // Set column widths
  summarySheet.getColumn(1).width = 50
  summarySheet.getColumn(2).width = 20
  summarySheet.getColumn(3).width = 20

  // Freeze first row
  summarySheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }]

  // ── Sheet 2: Transactions ─────────────────────────────────────────────────
  const txSheet = workbook.addWorksheet('Transactions')

  // Headers
  const txHeaders = ['Date', 'Description', 'Debit', 'Credit', 'Balance', 'Match Status', 'Voucher No', 'Confidence']
  const headerRow = txSheet.addRow(txHeaders)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3F4F6' },
  }

  // Column widths
  txSheet.getColumn(1).width = 14  // Date
  txSheet.getColumn(2).width = 40  // Description
  txSheet.getColumn(3).width = 15  // Debit
  txSheet.getColumn(4).width = 15  // Credit
  txSheet.getColumn(5).width = 15  // Balance
  txSheet.getColumn(6).width = 18  // Match Status
  txSheet.getColumn(7).width = 16  // Voucher No
  txSheet.getColumn(8).width = 12  // Confidence

  // Freeze first row
  txSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }]

  // Transaction rows
  for (const tx of transactions) {
    const row = txSheet.addRow([
      tx.txDate.toISOString().split('T')[0],
      tx.description,
      tx.debitAmount !== null ? tx.debitAmount.toFixed(2) : null,
      tx.creditAmount !== null ? tx.creditAmount.toFixed(2) : null,
      tx.balance !== null ? tx.balance.toFixed(2) : null,
      tx.matchStatus,
      tx.voucher?.voucherNo ?? '',
      tx.confidence ?? '',
    ])

    // Format amount columns as numbers with 2 decimal places
    for (const colIdx of [3, 4, 5]) {
      const cell = row.getCell(colIdx)
      if (cell.value !== null) {
        cell.numFmt = '#,##0.00'
      }
    }
  }

  // ── Generate buffer and return as HTTP response ───────────────────────────
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="brs-${id}.xlsx"`,
    },
  })
}
