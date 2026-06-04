import { prisma } from '@/lib/prisma'
import { Decimal } from 'decimal.js'

// ─── Business KPIs ─────────────────────────────────────────────────────────

export interface BusinessKPIs {
  receivables: string      // formatted Decimal string
  payables: string
  salesThisMonth: string
  lowStockCount: number
  gstDueInDays: number
  voucherCount: number
  salesChartData: Array<{ month: string; sales: number; purchases: number }>
  topProductsData: Array<{ name: string; qty: number; revenue: number }>
}

export async function getCachedBusinessKPIs(companyId: string): Promise<BusinessKPIs> {
  return computeBusinessKPIs(companyId)
}

async function computeBusinessKPIs(companyId: string): Promise<BusinessKPIs> {
  // KPI 1: Receivables — DR opening balance for Sundry Debtors ledgers
  const debtorGroups = await prisma.accountGroup.findMany({
    where: { companyId, name: 'Sundry Debtors' },
    select: { id: true },
  })
  const debtorGroupIds = debtorGroups.map((g) => g.id)

  let receivables = new Decimal(0)
  if (debtorGroupIds.length > 0) {
    const debtorLedgers = await prisma.ledger.findMany({
      where: { companyId, groupId: { in: debtorGroupIds }, isActive: true },
      select: { openingBalance: true, drCr: true },
    })
    receivables = debtorLedgers
      .filter((l) => l.drCr === 'DR')
      .reduce((sum, l) => sum.plus(new Decimal(l.openingBalance.toString())), new Decimal(0))
  }

  // KPI 2: Payables — CR opening balance for Sundry Creditors ledgers
  const creditorGroups = await prisma.accountGroup.findMany({
    where: { companyId, name: 'Sundry Creditors' },
    select: { id: true },
  })
  const creditorGroupIds = creditorGroups.map((g) => g.id)

  let payables = new Decimal(0)
  if (creditorGroupIds.length > 0) {
    const creditorLedgers = await prisma.ledger.findMany({
      where: { companyId, groupId: { in: creditorGroupIds }, isActive: true },
      select: { openingBalance: true, drCr: true },
    })
    payables = creditorLedgers
      .filter((l) => l.drCr === 'CR')
      .reduce((sum, l) => sum.plus(new Decimal(l.openingBalance.toString())), new Decimal(0))
  }

  // KPI 3: Sales This Month — posted SALES vouchers this calendar month
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const salesVouchers = await prisma.voucher.findMany({
    where: {
      companyId,
      voucherType: 'SALES',
      status: 'POSTED',
      date: { gte: monthStart, lte: monthEnd },
    },
    select: { totalAmount: true },
  })
  const salesThisMonth = salesVouchers.reduce(
    (sum, v) => sum.plus(new Decimal(v.totalAmount.toString())),
    new Decimal(0)
  )

  // KPI 4: Low Stock — items with reorderQty > 0 (Phase 1 proxy; full FIFO in Phase 4)
  const lowStockCount = await prisma.stockItem.count({
    where: {
      companyId,
      isActive: true,
      reorderQty: { gt: 0 },
    },
  })

  // KPI 5: GST Due In — days until next GSTR-1 deadline (11th of following month)
  const gstDueInDays = computeGSTDueDays()

  // Voucher count for Getting Started section
  const voucherCount = await prisma.voucher.count({
    where: { companyId, status: 'POSTED' },
  })

  // Chart data: Sales vs Purchases last 6 months
  const salesChartData = await computeSalesChartData(companyId)

  // Top 5 products this month (by voucher items revenue)
  const topProductsData = await computeTopProducts(companyId, monthStart, monthEnd)

  return {
    receivables: receivables.toFixed(2),
    payables: payables.toFixed(2),
    salesThisMonth: salesThisMonth.toFixed(2),
    lowStockCount,
    gstDueInDays,
    voucherCount,
    salesChartData,
    topProductsData,
  }
}

function computeGSTDueDays(): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  // GSTR-1 due: 11th of following month
  const nextDue = new Date(year, month + 1, 11)
  const diffMs = nextDue.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

async function computeSalesChartData(
  companyId: string
): Promise<Array<{ month: string; sales: number; purchases: number }>> {
  const months: Array<{ month: string; sales: number; purchases: number }> = []
  const now = new Date()

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)

    const [salesAgg, purchasesAgg] = await Promise.all([
      prisma.voucher.aggregate({
        where: { companyId, voucherType: 'SALES', status: 'POSTED', date: { gte: start, lte: end } },
        _sum: { totalAmount: true },
      }),
      prisma.voucher.aggregate({
        where: { companyId, voucherType: 'PURCHASE', status: 'POSTED', date: { gte: start, lte: end } },
        _sum: { totalAmount: true },
      }),
    ])

    months.push({
      month: d.toLocaleString('default', { month: 'short' }),
      sales: Number(salesAgg._sum.totalAmount ?? 0),
      purchases: Number(purchasesAgg._sum.totalAmount ?? 0),
    })
  }
  return months
}

async function computeTopProducts(
  companyId: string,
  start: Date,
  end: Date
): Promise<Array<{ name: string; qty: number; revenue: number }>> {
  // Group voucherItems by stockItem for SALES vouchers this month
  const items = await prisma.voucherItem.findMany({
    where: {
      voucher: {
        companyId,
        voucherType: 'SALES',
        status: 'POSTED',
        date: { gte: start, lte: end },
      },
    },
    include: {
      item: { select: { name: true } },
    },
  })

  // Aggregate by item
  const byItem = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const item of items) {
    const name = item.item?.name ?? 'Unknown'
    const existing = byItem.get(name) ?? { name, qty: 0, revenue: 0 }
    byItem.set(name, {
      name,
      qty: existing.qty + Number(item.qty),
      revenue: existing.revenue + Number(item.amount),
    })
  }

  return Array.from(byItem.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
}

// ─── Accountant KPIs ────────────────────────────────────────────────────────

export interface AccountantKPIs {
  totalAssets: string
  totalLiabilities: string
  revenueMTD: string
  gstPayable: string
}

export async function getCachedAccountantKPIs(companyId: string): Promise<AccountantKPIs> {
  return computeAccountantKPIs(companyId)
}

async function computeAccountantKPIs(companyId: string): Promise<AccountantKPIs> {
  // Total Assets: sum DR opening balances for ASSET nature account groups
  const assetGroups = await prisma.accountGroup.findMany({
    where: { companyId, nature: 'ASSET' },
    select: { id: true },
  })
  const assetGroupIds = assetGroups.map((g) => g.id)

  let totalAssets = new Decimal(0)
  if (assetGroupIds.length > 0) {
    const assetLedgers = await prisma.ledger.findMany({
      where: { companyId, groupId: { in: assetGroupIds }, isActive: true },
      select: { openingBalance: true, drCr: true },
    })
    totalAssets = assetLedgers
      .filter((l) => l.drCr === 'DR')
      .reduce((sum, l) => sum.plus(new Decimal(l.openingBalance.toString())), new Decimal(0))
  }

  // Total Liabilities: sum CR opening balances for LIABILITY nature groups
  const liabilityGroups = await prisma.accountGroup.findMany({
    where: { companyId, nature: 'LIABILITY' },
    select: { id: true },
  })
  const liabilityGroupIds = liabilityGroups.map((g) => g.id)

  let totalLiabilities = new Decimal(0)
  if (liabilityGroupIds.length > 0) {
    const liabilityLedgers = await prisma.ledger.findMany({
      where: { companyId, groupId: { in: liabilityGroupIds }, isActive: true },
      select: { openingBalance: true, drCr: true },
    })
    totalLiabilities = liabilityLedgers
      .filter((l) => l.drCr === 'CR')
      .reduce((sum, l) => sum.plus(new Decimal(l.openingBalance.toString())), new Decimal(0))
  }

  // Revenue MTD: sum totalAmount of posted SALES vouchers this month
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const revAgg = await prisma.voucher.aggregate({
    where: { companyId, voucherType: 'SALES', status: 'POSTED', date: { gte: monthStart, lte: monthEnd } },
    _sum: { totalAmount: true },
  })
  const revenueMTD = new Decimal(revAgg._sum.totalAmount?.toString() ?? '0')

  // GST Payable: balance of "GST Payable" ledger
  const gstLedger = await prisma.ledger.findFirst({
    where: { companyId, name: 'GST Payable', isActive: true },
    select: { openingBalance: true },
  })
  const gstPayable = new Decimal(gstLedger?.openingBalance?.toString() ?? '0')

  return {
    totalAssets: totalAssets.toFixed(2),
    totalLiabilities: totalLiabilities.toFixed(2),
    revenueMTD: revenueMTD.toFixed(2),
    gstPayable: gstPayable.toFixed(2),
  }
}
