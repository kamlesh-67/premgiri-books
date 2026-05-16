/**
 * BankService.ts
 *
 * Service layer for bank statement import and BRS data computation.
 *
 * Exports:
 *   - importStatement(params): Promise<{ statementId, rowCount }>
 *   - computeBrsData(statementId, companyId): Promise<BrsData>
 *   - BrsData (type)
 *
 * Rules:
 *   - No parseFloat() anywhere — all amounts via Decimal constructor
 *   - No === comparison on Decimal values — use Decimal.eq() / .lte() / .minus()
 *   - companyId ALWAYS from caller (session.user.companyId) — NEVER from CSV or request body
 *   - Every Prisma query includes companyId in where clause (CLAUDE.md rule 2)
 *   - All amount strings serialized as .toFixed(2) for JSON-safe output
 *
 * Matches:
 *   - D-03: statement rows persisted to DB
 *   - D-14: bank closing balance = last BankTransaction.balance OR sum(credit) - sum(debit)
 *   - D-06: confidence scoring delegated to MatchingEngine.runMatch
 */

import { parseCsvToRows, BANK_PARSERS, type BankName } from '@/lib/banking/bankParsers'
import { runMatch, getBooksClosingBalance } from '@/lib/banking/MatchingEngine'
import { prisma } from '@/lib/prisma'
import { Decimal } from 'decimal.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BrsData = {
  statementId: string
  bank: string
  ledgerName: string
  fromDate: Date
  toDate: Date
  /** Bank closing balance as a string (e.g. "12345.67") — JSON-safe */
  bankClosingBalance: string
  /** Books closing balance as a string (e.g. "12345.67") — JSON-safe */
  booksClosingBalance: string
  /** Absolute difference between bank and books balance — JSON-safe */
  difference: string
  /** true if difference <= ₹0.01 */
  isReconciled: boolean
  totalTx: number
  matchedCount: number
  unmatchedCount: number
}

// ---------------------------------------------------------------------------
// importStatement
// ---------------------------------------------------------------------------

/**
 * Parse a bank CSV, persist BankStatement + BankTransactions, then run matching.
 *
 * Steps:
 * 1. parseCsvToRows(csvText, bank) → rows
 * 2. Compute fromDate (min txDate), toDate (max txDate) from rows
 * 3. $transaction: create BankStatement + createMany BankTransactions + auditLog
 * 4. After $transaction: runMatch(statementId, companyId) to auto-match
 * 5. Return { statementId, rowCount }
 *
 * Security:
 *   - companyId and userId MUST come from session.user — never from CSV data
 *   - T-07-03-01: ledgerId verified to belong to companyId via Prisma query before insert
 *
 * @param params.ledgerId   Bank ledger ID (from dropdown selection — session-owned)
 * @param params.bank       Bank name enum: 'SBI' | 'HDFC' | 'ICICI' | 'Axis' | 'Kotak'
 * @param params.csvText    Raw CSV text (SBI: caller must decode from latin1 first)
 * @param params.companyId  From session.user.companyId — NEVER from request body
 * @param params.userId     From session.user.id — NEVER from request body
 */
export async function importStatement(params: {
  ledgerId: string
  bank: BankName
  csvText: string
  companyId: string
  userId: string
}): Promise<{ statementId: string; rowCount: number }> {
  const { ledgerId, bank, csvText, companyId, userId } = params

  // T-07-03-01: Verify ledger belongs to this company before proceeding
  const ledger = await prisma.ledger.findFirst({
    where: { id: ledgerId, companyId },
    select: { id: true },
  })
  if (!ledger) {
    throw new Error(`Ledger ${ledgerId} not found for company ${companyId}`)
  }

  // 1. Parse CSV rows
  const rows = parseCsvToRows(csvText, bank)
  const rowCount = rows.length

  if (rowCount === 0) {
    throw new Error('No valid rows found in CSV after parsing')
  }

  // 2. Compute date range from rows
  let fromDate = rows[0].txDate
  let toDate = rows[0].txDate
  for (const row of rows) {
    if (row.txDate < fromDate) fromDate = row.txDate
    if (row.txDate > toDate) toDate = row.txDate
  }

  // 3. $transaction: create BankStatement + createMany BankTransactions + auditLog
  let statementId: string

  try {
    statementId = await prisma.$transaction(async (tx) => {
      // Create the BankStatement record
      const stmt = await tx.bankStatement.create({
        data: {
          companyId,
          ledgerId,
          bank,
          fromDate,
          toDate,
          uploadedBy: userId,
          rowCount,
        },
      })

      // Bulk-insert all BankTransaction rows
      await tx.bankTransaction.createMany({
        data: rows.map((r) => ({
          companyId,
          statementId: stmt.id,
          txDate: r.txDate,
          description: r.description,
          debitAmount: r.debitAmount ?? null,
          creditAmount: r.creditAmount ?? null,
          balance: r.balance ?? null,
          matchStatus: 'UNMATCHED',
        })),
      })

      // Audit log for the import
      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          entity: 'BankStatement',
          entityId: stmt.id,
          action: 'CREATE',
          newValue: {
            bank,
            rowCount,
            ledgerId,
            fromDate,
            toDate,
          } as object,
        },
      })

      return stmt.id
    })
  } catch (err) {
    throw new Error(`Failed to import bank statement: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 4. After $transaction: run matching (not inside transaction — updates individual txns)
  try {
    await runMatch(statementId, companyId, userId)
  } catch (err) {
    // Matching failure is non-fatal — statement is already saved
    console.error(`[BankService.importStatement] runMatch failed for ${statementId}:`, err)
  }

  // 5. Return result
  return { statementId, rowCount }
}

// ---------------------------------------------------------------------------
// computeBrsData
// ---------------------------------------------------------------------------

/**
 * Compute Bank Reconciliation Statement data for a given BankStatement.
 *
 * Per D-14:
 *   - bankClosingBalance = last BankTransaction.balance (fallback: sum credits - debits)
 *   - booksClosingBalance = getBooksClosingBalance(companyId, ledgerId, toDate)
 *   - difference = |bankClosingBalance - booksClosingBalance|
 *   - isReconciled = difference <= ₹0.01
 *
 * matchedCount includes: AUTO_HIGH, AUTO_MEDIUM, AUTO_LOW, CONFIRMED statuses.
 *
 * @param statementId  BankStatement.id
 * @param companyId    From session.user.companyId — NEVER from request
 * @returns            BrsData object with all amounts as .toFixed(2) strings
 */
export async function computeBrsData(
  statementId: string,
  companyId: string,
): Promise<BrsData> {
  // 1. Fetch BankStatement with ledger name
  const stmt = await prisma.bankStatement.findFirst({
    where: { id: statementId, companyId },
    include: { ledger: { select: { name: true } } },
  })
  if (!stmt) {
    throw new Error(`BankStatement ${statementId} not found for company ${companyId}`)
  }

  // 2. Fetch all BankTransactions for this statement
  const transactions = await prisma.bankTransaction.findMany({
    where: { statementId, companyId },
    orderBy: { txDate: 'asc' },
  })

  const totalTx = transactions.length

  // 3. Compute bankClosingBalance
  // Primary: last transaction with a non-null balance column
  let bankClosingBalance: Decimal

  const lastWithBalance = [...transactions].reverse().find((tx) => tx.balance !== null)

  if (lastWithBalance && lastWithBalance.balance !== null) {
    // Use the last available running balance
    bankClosingBalance = new Decimal(lastWithBalance.balance.toString())
  } else {
    // Fallback (Pitfall 8): sum(creditAmount) - sum(debitAmount)
    // This gives the net change; for a complete BRS, an opening balance would be needed,
    // but when the balance column is absent we compute from transactions only.
    let totalCredit = new Decimal(0)
    let totalDebit = new Decimal(0)

    for (const tx of transactions) {
      if (tx.creditAmount !== null) {
        totalCredit = totalCredit.plus(new Decimal(tx.creditAmount.toString()))
      }
      if (tx.debitAmount !== null) {
        totalDebit = totalDebit.plus(new Decimal(tx.debitAmount.toString()))
      }
    }

    bankClosingBalance = totalCredit.minus(totalDebit)
  }

  // 4. Compute booksClosingBalance from voucher entries
  const booksClosingBalance = await getBooksClosingBalance(companyId, stmt.ledgerId, stmt.toDate)

  // 5. Compute difference
  const difference = bankClosingBalance.minus(booksClosingBalance).abs()

  // 6. isReconciled: difference <= ₹0.01
  const isReconciled = difference.lte(new Decimal('0.01'))

  // 7. Count matched transactions
  // Matched = AUTO_HIGH, AUTO_MEDIUM, AUTO_LOW, CONFIRMED
  const MATCHED_STATUSES = new Set(['AUTO_HIGH', 'AUTO_MEDIUM', 'AUTO_LOW', 'CONFIRMED'])
  const matchedCount = transactions.filter((tx) => MATCHED_STATUSES.has(tx.matchStatus)).length
  const unmatchedCount = totalTx - matchedCount

  return {
    statementId,
    bank: stmt.bank,
    ledgerName: stmt.ledger.name,
    fromDate: stmt.fromDate,
    toDate: stmt.toDate,
    bankClosingBalance: bankClosingBalance.toFixed(2),
    booksClosingBalance: booksClosingBalance.toFixed(2),
    difference: difference.toFixed(2),
    isReconciled,
    totalTx,
    matchedCount,
    unmatchedCount,
  }
}
