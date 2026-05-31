/**
 * GET /api/v1/bank-statements/[id]
 *
 * Returns full statement detail: statement metadata, paginated BankTransactions,
 * and BRS closing balance data (bankClosingBalance, booksClosingBalance, difference).
 *
 * Security:
 *   - auth() first → 401 if no session
 *   - companyId ALWAYS from session.companyId — never from params (T-07-03-06)
 *   - IDOR protection: findFirst({ where: { id, companyId } }) — 404 for wrong company (T-07-03-03)
 *
 * Query params:
 *   - page: page number (default 1)
 *   - limit: rows per page (default 50)
 */

import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { computeBrsData } from '@/lib/services/BankService'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId  // NEVER from URL params (T-07-03-06)
  const { id } = await params

  // Parse pagination query params
  const searchParams = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50))

  // IDOR protection: include companyId in findFirst — 404 for non-matching company (T-07-03-03)
  const stmt = await prisma.bankStatement.findFirst({
    where: { id, companyId },
    include: { ledger: { select: { name: true } } },
  })
  if (!stmt) return NextResponse.json({ error: 'Bank statement not found' }, { status: 404 })

  // Paginated transactions
  const [transactions, totalCount] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: { statementId: id, companyId },
      orderBy: { txDate: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.bankTransaction.count({
      where: { statementId: id, companyId },
    }),
  ])

  // BRS closing balance data
  let brsData
  try {
    brsData = await computeBrsData(id, companyId)
  } catch (err) {
    console.error('[bank-statements/[id] GET] computeBrsData error', err)
    brsData = null
  }

  // Serialize Decimal fields to strings for JSON-safe response
  const serializedTransactions = transactions.map((tx) => ({
    id: tx.id,
    txDate: tx.txDate,
    description: tx.description,
    debitAmount: tx.debitAmount?.toFixed(2) ?? null,
    creditAmount: tx.creditAmount?.toFixed(2) ?? null,
    balance: tx.balance?.toFixed(2) ?? null,
    matchStatus: tx.matchStatus,
    matchedVoucherId: tx.matchedVoucherId,
    confidence: tx.confidence,
  }))

  return NextResponse.json({
    statement: {
      id: stmt.id,
      bank: stmt.bank,
      ledgerName: stmt.ledger.name,
      fromDate: stmt.fromDate,
      toDate: stmt.toDate,
      uploadedAt: stmt.uploadedAt,
      uploadedBy: stmt.uploadedBy,
      rowCount: stmt.rowCount,
    },
    transactions: serializedTransactions,
    brsData,
    totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
  })
}
