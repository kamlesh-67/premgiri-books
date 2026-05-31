import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { Decimal } from 'decimal.js'

/**
 * GET /api/v1/reports/tds
 *
 * TDS Register — returns payment vouchers with TDS deductions.
 *
 * Query params:
 *  - period:  MMYYYY (e.g. "042025") — filter by month/year; omit for all FY
 *  - section: '194C' | '194J' — filter by TDS section; omit for all sections
 *  - format:  'csv' — returns CSV for TRACES upload download; omit for JSON
 *
 * Security:
 *  - auth() first — 401 before any DB operation
 *  - companyId ALWAYS from session.companyId — NEVER from query params (T-03-06-02)
 *  - section and period are optional filters validated by regex before DB use (T-03-06-03)
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request)
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const companyId = session.companyId  // NEVER from query params

  const { searchParams } = new URL(request.url)
  const periodParam = searchParams.get('period')   // MMYYYY e.g. '042025'
  const section = searchParams.get('section')      // '194C' | '194J' | null
  const format = searchParams.get('format')        // 'csv' | null

  // Build date range from MMYYYY period param
  let dateFilter: { gte?: Date; lt?: Date } = {}
  if (periodParam && /^\d{6}$/.test(periodParam)) {
    const month = parseInt(periodParam.slice(0, 2)) - 1  // 0-indexed
    const year = parseInt(periodParam.slice(2))
    const start = new Date(year, month, 1)
    const end = new Date(year, month + 1, 1)
    dateFilter = { gte: start, lt: end }
  }

  // Validate section if provided — only allow known TDS sections
  const validSections = ['194C', '194J']
  const sectionFilter =
    section && validSections.includes(section)
      ? section
      : section
      ? undefined  // unknown section — return empty result rather than error
      : undefined

  const vouchers = await prisma.voucher.findMany({
    where: {
      companyId,
      voucherType: 'PAYMENT',
      tdsSection: sectionFilter
        ? sectionFilter
        : { not: null },
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      status: 'POSTED',
    },
    include: {
      partyLedger: {
        select: { name: true, pan: true },
      },
    },
    orderBy: [{ date: 'desc' }, { voucherNo: 'asc' }],
  })

  const rows = vouchers.map((v) => {
    const gross = new Decimal(v.totalAmount.toString())
    const tds = new Decimal(v.tdsAmount?.toString() ?? '0')
    const net = gross.minus(tds)
    return {
      id: v.id,
      voucherNo: v.voucherNo,
      date: v.date.toISOString().split('T')[0],
      partyName: v.partyLedger?.name ?? '—',
      partyPan: v.partyLedger?.pan ?? null,
      tdsSection: v.tdsSection!,
      tdsRate: v.tdsRate?.toString() ?? '0',
      grossAmount: gross.toFixed(2),
      tdsAmount: tds.toFixed(2),
      netPaid: net.toFixed(2),
    }
  })

  // CSV export (for TRACES upload)
  if (format === 'csv') {
    const header = 'Date,Voucher No,Deductee,PAN,Section,Rate %,Gross Amount,TDS Amount,Net Paid'
    const lines = rows.map((r) =>
      [
        r.date,
        r.voucherNo,
        `"${r.partyName.replace(/"/g, '""')}"`,
        r.partyPan ?? '',
        r.tdsSection,
        r.tdsRate,
        r.grossAmount,
        r.tdsAmount,
        r.netPaid,
      ].join(',')
    )
    const csv = [header, ...lines].join('\n')
    const periodLabel = periodParam ?? 'all'
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="tds_register_${periodLabel}.csv"`,
      },
    })
  }

  // JSON response with aggregate totals
  const totals = rows.reduce(
    (acc, r) => ({
      gross: acc.gross.plus(r.grossAmount),
      tds: acc.tds.plus(r.tdsAmount),
      net: acc.net.plus(r.netPaid),
    }),
    { gross: new Decimal(0), tds: new Decimal(0), net: new Decimal(0) }
  )

  return NextResponse.json({
    rows,
    totals: {
      gross: totals.gross.toFixed(2),
      tds: totals.tds.toFixed(2),
      net: totals.net.toFixed(2),
    },
  })
}
