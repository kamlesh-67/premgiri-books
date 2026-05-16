import { prisma } from '@/lib/prisma'
import Decimal from 'decimal.js'
import { getFYStart, getFYEnd } from '@/lib/utils/fy'
import { formatINR } from '@/lib/utils/format'
import ExcelJS from 'exceljs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrialBalanceRow {
  ledgerId: string
  name: string
  groupName: string
  openingDR: Decimal
  openingCR: Decimal
  periodDR: Decimal
  periodCR: Decimal
  closingDR: Decimal
  closingCR: Decimal
}

export interface AccountGroupNode {
  id: string
  name: string
  nature: string
  parentId: string | null
  ledgers: { id: string; name: string; balance: Decimal; drCr: string }[]
  children: AccountGroupNode[]
  subtotal: Decimal
}

export interface BalanceSheetResult {
  assetGroups: AccountGroupNode[]
  liabilityGroups: AccountGroupNode[]
  totalAssets: Decimal
  totalEquityLiabilities: Decimal
  balanced: boolean
  fy: string
}

export interface ProfitLossGroup {
  groupName: string
  ledgers: { name: string; amount: Decimal }[]
  subtotal: Decimal
}

export interface ProfitLossResult {
  tradingIncome: ProfitLossGroup[]
  tradingExpenses: ProfitLossGroup[]
  grossProfit: Decimal
  otherIncome: ProfitLossGroup[]
  otherExpenses: ProfitLossGroup[]
  netProfit: Decimal
  fy: string
  compareFy?: string
  compareGrossProfit?: Decimal
  compareNetProfit?: Decimal
  hasCompareFyData: boolean
}

export interface DayBookRow {
  id: string
  date: string
  voucherNo: string
  voucherType: string
  narration: string | null
  partyName: string | null
  totalAmount: Decimal
  status: string
}

export interface OutstandingRow {
  billRefId: string
  ledgerId: string
  partyName: string
  voucherNo: string
  billDate: string
  dueDate: string
  daysOverdue: number
  bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+'
  outstandingAmount: Decimal
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Determine ageing bucket based on days overdue.
 * Exported for unit testing.
 */
export function getAgeingBucket(daysOverdue: number): OutstandingRow['bucket'] {
  if (daysOverdue <= 0) return 'current'
  if (daysOverdue <= 30) return '1-30'
  if (daysOverdue <= 60) return '31-60'
  if (daysOverdue <= 90) return '61-90'
  return '90+'
}

// ---------------------------------------------------------------------------
// getTrialBalance
// ---------------------------------------------------------------------------

export async function getTrialBalance(
  companyId: string,
  fy: string
): Promise<TrialBalanceRow[]> {
  const startDate = getFYStart(fy)
  const endDate = getFYEnd(fy)

  const ledgers = await prisma.ledger.findMany({
    where: { companyId, isActive: true },
    include: {
      group: { select: { name: true, nature: true } },
      voucherEntries: {
        where: {
          voucher: {
            companyId,
            status: 'POSTED',
            date: { gte: startDate, lte: endDate },
          },
        },
        select: { amount: true, drCr: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  return ledgers.map((ledger) => {
    // Opening balance
    const openingDR =
      ledger.drCr === 'DR'
        ? new Decimal(ledger.openingBalance.toString())
        : new Decimal(0)
    const openingCR =
      ledger.drCr === 'CR'
        ? new Decimal(ledger.openingBalance.toString())
        : new Decimal(0)

    // Period movements
    let periodDR = new Decimal(0)
    let periodCR = new Decimal(0)
    for (const entry of ledger.voucherEntries) {
      const amt = new Decimal(entry.amount.toString())
      if (entry.drCr === 'DR') {
        periodDR = periodDR.plus(amt)
      } else {
        periodCR = periodCR.plus(amt)
      }
    }

    // Closing = opening + period, net on each side
    const netDR = openingDR.plus(periodDR)
    const netCR = openingCR.plus(periodCR)
    let closingDR = new Decimal(0)
    let closingCR = new Decimal(0)
    const net = netDR.minus(netCR)
    if (net.gt(0)) {
      closingDR = net
    } else if (net.lt(0)) {
      closingCR = net.abs()
    }

    return {
      ledgerId: ledger.id,
      name: ledger.name,
      groupName: ledger.group.name,
      openingDR,
      openingCR,
      periodDR,
      periodCR,
      closingDR,
      closingCR,
    }
  })
}

// ---------------------------------------------------------------------------
// validateTrialBalance
// ---------------------------------------------------------------------------

export function validateTrialBalance(rows: TrialBalanceRow[]): boolean {
  const totalDR = rows.reduce(
    (sum, r) => sum.plus(r.closingDR),
    new Decimal(0)
  )
  const totalCR = rows.reduce(
    (sum, r) => sum.plus(r.closingCR),
    new Decimal(0)
  )
  return totalDR.equals(totalCR)
}

// ---------------------------------------------------------------------------
// getBalanceSheet
// ---------------------------------------------------------------------------

export async function getBalanceSheet(
  companyId: string,
  fy: string
): Promise<BalanceSheetResult> {
  const startDate = getFYStart(fy)
  const endDate = getFYEnd(fy)

  const groups = await prisma.accountGroup.findMany({
    where: { companyId },
    include: {
      ledgers: {
        where: { companyId, isActive: true },
        include: {
          voucherEntries: {
            where: {
              voucher: {
                companyId,
                status: 'POSTED',
                date: { gte: startDate, lte: endDate },
              },
            },
            select: { amount: true, drCr: true },
          },
        },
      },
    },
  })

  // Compute ledger balances
  function computeLedgerBalance(
    ledger: (typeof groups)[0]['ledgers'][0]
  ): Decimal {
    let dr = new Decimal(ledger.openingBalance.toString())
    let cr = new Decimal(0)
    if (ledger.drCr === 'CR') {
      cr = dr
      dr = new Decimal(0)
    }
    for (const entry of ledger.voucherEntries) {
      const amt = new Decimal(entry.amount.toString())
      if (entry.drCr === 'DR') dr = dr.plus(amt)
      else cr = cr.plus(amt)
    }
    return dr.minus(cr) // positive = DR balance
  }

  // Build node map
  const nodeMap = new Map<string, AccountGroupNode>()
  for (const g of groups) {
    nodeMap.set(g.id, {
      id: g.id,
      name: g.name,
      nature: g.nature,
      parentId: g.parentId,
      ledgers: g.ledgers.map((l) => ({
        id: l.id,
        name: l.name,
        balance: computeLedgerBalance(l),
        drCr: l.drCr,
      })),
      children: [],
      subtotal: new Decimal(0),
    })
  }

  // Wire up children
  const roots: AccountGroupNode[] = []
  for (const node of nodeMap.values()) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Compute subtotals bottom-up
  function computeSubtotal(node: AccountGroupNode): Decimal {
    let total = node.ledgers.reduce(
      (sum, l) => sum.plus(l.balance.abs()),
      new Decimal(0)
    )
    for (const child of node.children) {
      total = total.plus(computeSubtotal(child))
    }
    node.subtotal = total
    return total
  }
  for (const root of roots) {
    computeSubtotal(root)
  }

  const assetGroups = roots.filter((r) => r.nature === 'ASSET')
  const liabilityGroups = roots.filter(
    (r) => r.nature === 'LIABILITY' || r.nature === 'INCOME' || r.nature === 'EXPENSE'
  )

  const totalAssets = assetGroups.reduce(
    (sum, g) => sum.plus(g.subtotal),
    new Decimal(0)
  )
  const totalEquityLiabilities = liabilityGroups.reduce(
    (sum, g) => sum.plus(g.subtotal),
    new Decimal(0)
  )

  const balanced = totalAssets.equals(totalEquityLiabilities)
  if (!balanced) {
    console.warn('Balance Sheet does not balance:', {
      totalAssets: totalAssets.toString(),
      totalEquityLiabilities: totalEquityLiabilities.toString(),
    })
  }

  return {
    assetGroups,
    liabilityGroups,
    totalAssets,
    totalEquityLiabilities,
    balanced,
    fy,
  }
}

// ---------------------------------------------------------------------------
// getProfitLoss
// ---------------------------------------------------------------------------

async function computePLForFY(
  companyId: string,
  fy: string
): Promise<{
  tradingIncome: ProfitLossGroup[]
  tradingExpenses: ProfitLossGroup[]
  grossProfit: Decimal
  otherIncome: ProfitLossGroup[]
  otherExpenses: ProfitLossGroup[]
  netProfit: Decimal
}> {
  const startDate = getFYStart(fy)
  const endDate = getFYEnd(fy)

  const groups = await prisma.accountGroup.findMany({
    where: {
      companyId,
      nature: { in: ['INCOME', 'EXPENSE'] },
    },
    include: {
      ledgers: {
        where: { companyId, isActive: true },
        include: {
          voucherEntries: {
            where: {
              voucher: {
                companyId,
                status: 'POSTED',
                date: { gte: startDate, lte: endDate },
              },
            },
            select: { amount: true, drCr: true },
          },
        },
      },
    },
  })

  function ledgerAmount(
    ledger: (typeof groups)[0]['ledgers'][0],
    nature: string
  ): Decimal {
    let total = new Decimal(0)
    for (const entry of ledger.voucherEntries) {
      const amt = new Decimal(entry.amount.toString())
      if (nature === 'INCOME') {
        total = entry.drCr === 'CR' ? total.plus(amt) : total.minus(amt)
      } else {
        total = entry.drCr === 'DR' ? total.plus(amt) : total.minus(amt)
      }
    }
    return total
  }

  const tradingIncome: ProfitLossGroup[] = []
  const tradingExpenses: ProfitLossGroup[] = []
  const otherIncome: ProfitLossGroup[] = []
  const otherExpenses: ProfitLossGroup[] = []

  for (const g of groups) {
    const ledgerLines = g.ledgers.map((l) => ({
      name: l.name,
      amount: ledgerAmount(l, g.nature),
    }))
    const subtotal = ledgerLines.reduce(
      (sum, l) => sum.plus(l.amount),
      new Decimal(0)
    )
    const plGroup: ProfitLossGroup = {
      groupName: g.name,
      ledgers: ledgerLines,
      subtotal,
    }

    if (g.nature === 'INCOME' && g.affectsGP) tradingIncome.push(plGroup)
    else if (g.nature === 'EXPENSE' && g.affectsGP) tradingExpenses.push(plGroup)
    else if (g.nature === 'INCOME') otherIncome.push(plGroup)
    else if (g.nature === 'EXPENSE') otherExpenses.push(plGroup)
  }

  const totalTradingIncome = tradingIncome.reduce(
    (sum, g) => sum.plus(g.subtotal),
    new Decimal(0)
  )
  const totalTradingExpenses = tradingExpenses.reduce(
    (sum, g) => sum.plus(g.subtotal),
    new Decimal(0)
  )
  const grossProfit = totalTradingIncome.minus(totalTradingExpenses)

  const totalOtherIncome = otherIncome.reduce(
    (sum, g) => sum.plus(g.subtotal),
    new Decimal(0)
  )
  const totalOtherExpenses = otherExpenses.reduce(
    (sum, g) => sum.plus(g.subtotal),
    new Decimal(0)
  )
  const netProfit = grossProfit.plus(totalOtherIncome).minus(totalOtherExpenses)

  return {
    tradingIncome,
    tradingExpenses,
    grossProfit,
    otherIncome,
    otherExpenses,
    netProfit,
  }
}

export async function getProfitLoss(
  companyId: string,
  fy: string,
  compareFy?: string
): Promise<ProfitLossResult> {
  const current = await computePLForFY(companyId, fy)

  let compareGrossProfit: Decimal | undefined
  let compareNetProfit: Decimal | undefined
  let hasCompareFyData = false

  if (compareFy) {
    const prior = await computePLForFY(companyId, compareFy)
    compareGrossProfit = prior.grossProfit
    compareNetProfit = prior.netProfit
    hasCompareFyData = prior.grossProfit.plus(prior.netProfit).gt(0)
  }

  return {
    ...current,
    fy,
    compareFy,
    compareGrossProfit,
    compareNetProfit,
    hasCompareFyData,
  }
}

// ---------------------------------------------------------------------------
// getDayBook
// ---------------------------------------------------------------------------

export async function getDayBook(
  companyId: string,
  from: Date,
  to: Date,
  type?: string
): Promise<DayBookRow[]> {
  const msPerDay = 24 * 60 * 60 * 1000
  const daysDiff = Math.floor((to.getTime() - from.getTime()) / msPerDay)
  if (daysDiff > 90) {
    throw new Error('Date range exceeds 90 days')
  }

  const vouchers = await prisma.voucher.findMany({
    where: {
      companyId,
      status: 'POSTED',
      date: { gte: from, lte: to },
      ...(type ? { voucherType: type as never } : {}),
    },
    include: {
      partyLedger: { select: { name: true } },
      voucherEntries: { select: { amount: true, drCr: true } },
    },
    orderBy: [{ date: 'asc' }, { voucherNo: 'asc' }],
  })

  return vouchers.map((v) => ({
    id: v.id,
    date: v.date.toISOString().split('T')[0],
    voucherNo: v.voucherNo,
    voucherType: v.voucherType,
    narration: v.narration,
    partyName: v.partyLedger?.name ?? null,
    totalAmount: new Decimal(v.totalAmount.toString()),
    status: v.status,
  }))
}

// ---------------------------------------------------------------------------
// getOutstanding
// ---------------------------------------------------------------------------

export async function getOutstanding(
  companyId: string,
  drCr: 'DR' | 'CR'
): Promise<OutstandingRow[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const msPerDay = 24 * 60 * 60 * 1000

  const bills = await prisma.billRef.findMany({
    where: {
      companyId,
      drCr,
      settled: false,
      outstandingAmount: { gt: 0 },
    },
    include: {
      ledger: { select: { name: true, creditDays: true } },
      voucher: { select: { voucherNo: true, date: true } },
    },
    orderBy: { billDate: 'asc' },
  })

  return bills.map((bill) => {
    const effectiveDueDate =
      bill.dueDate ??
      addDays(bill.billDate, bill.ledger.creditDays ?? 30)

    const daysOverdue = Math.floor(
      (today.getTime() - effectiveDueDate.getTime()) / msPerDay
    )
    const bucket = getAgeingBucket(daysOverdue)

    return {
      billRefId: bill.id,
      ledgerId: bill.ledgerId,
      partyName: bill.ledger.name,
      voucherNo: bill.voucher.voucherNo,
      billDate: bill.billDate.toISOString().split('T')[0],
      dueDate: effectiveDueDate.toISOString().split('T')[0],
      daysOverdue,
      bucket,
      outstandingAmount: new Decimal(bill.outstandingAmount.toString()),
    }
  })
}

// ---------------------------------------------------------------------------
// exportToExcel
// ---------------------------------------------------------------------------

export async function exportToExcel(
  data: unknown,
  reportType: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'PremGiri Books'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet(reportType)

  const rows = Array.isArray(data) ? data : [data]
  if (rows.length === 0) {
    return Buffer.from(await workbook.xlsx.writeBuffer())
  }

  // Build header row from first object keys
  const firstRow = rows[0] as Record<string, unknown>
  const headers = Object.keys(firstRow)

  const headerRow = worksheet.addRow(headers)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE9D5FF' }, // purple-100 equivalent
  }

  // Detect amount columns (keys containing 'amount', 'balance', 'total', 'profit', 'outstanding')
  const amountKeyPattern = /amount|balance|total|profit|outstanding|dr|cr/i

  // Add data rows
  for (const item of rows) {
    const record = item as Record<string, unknown>
    const rowValues = headers.map((h) => {
      const v = record[h]
      if (v instanceof Decimal) return formatINR(v)
      if (typeof v === 'object' && v !== null && 'toString' in v) {
        return String(v)
      }
      return v
    })
    worksheet.addRow(rowValues)
  }

  // Right-align amount columns
  headers.forEach((header, colIndex) => {
    if (amountKeyPattern.test(header)) {
      const col = worksheet.getColumn(colIndex + 1)
      col.alignment = { horizontal: 'right' }
      col.numFmt = '#,##0.00'
    }
  })

  // Auto-fit column widths
  headers.forEach((header, colIndex) => {
    const col = worksheet.getColumn(colIndex + 1)
    col.width = Math.max(header.length + 4, 15)
  })

  return Buffer.from(await workbook.xlsx.writeBuffer())
}
