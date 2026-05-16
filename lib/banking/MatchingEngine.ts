/**
 * MatchingEngine.ts
 *
 * Core matching algorithm for bank statement reconciliation.
 *
 * Exports:
 *   - scoreMatch(bankAmt, bankDate, voucherAmt, voucherDate): MatchResult
 *   - runMatch(statementId, companyId): Promise<void>
 *   - getBooksClosingBalance(companyId, ledgerId, toDate): Promise<Decimal>
 *
 * D-06 confidence scoring (from 07-CONTEXT.md):
 *   - exact amount AND |dateDiff| <= 1 day → HIGH / AUTO_HIGH
 *   - exact amount AND |dateDiff| > 1 day  → MEDIUM / AUTO_MEDIUM
 *   - amount within ±50 (any date)         → LOW / AUTO_LOW
 *   - no match                             → null / UNMATCHED
 *
 * Rules:
 *   - No parseFloat() anywhere — all amounts use Decimal constructor
 *   - No === comparison on Decimal values — use Decimal.eq()
 *   - Every Prisma query includes companyId in where clause (CLAUDE.md rule 2)
 *   - Audit log written inside $transaction alongside BankTransaction updates
 */

import { prisma } from '@/lib/prisma'
import { Decimal } from 'decimal.js'
import { differenceInDays, addDays, subDays } from 'date-fns'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MatchConfidence = 'HIGH' | 'MEDIUM' | 'LOW'
export type MatchStatus = 'AUTO_HIGH' | 'AUTO_MEDIUM' | 'AUTO_LOW' | 'UNMATCHED'

export type MatchResult = {
  confidence: MatchConfidence | null
  status: MatchStatus
}

// ---------------------------------------------------------------------------
// scoreMatch — pure function (no Prisma dependency)
// ---------------------------------------------------------------------------

/**
 * Score how well a bank transaction amount+date matches a voucher amount+date.
 *
 * Per D-06:
 *   - "Exact amount" uses Decimal.eq() — NEVER ===
 *   - "within ±50" uses Decimal difference absolute value <= 50
 *   - Date diff uses date-fns differenceInDays absolute value
 *   - No upper date bound for MEDIUM: exact amount at any date > 1 day = MEDIUM
 *
 * @param bankAmt     Bank transaction amount (debit or credit)
 * @param bankDate    Bank transaction date
 * @param voucherAmt  Voucher totalAmount
 * @param voucherDate Voucher date
 */
export function scoreMatch(
  bankAmt: Decimal,
  bankDate: Date,
  voucherAmt: Decimal,
  voucherDate: Date,
): MatchResult {
  const dateDiff = Math.abs(differenceInDays(bankDate, voucherDate))

  // Check exact amount using Decimal.eq (never ===)
  const isExactAmount = bankAmt.eq(voucherAmt)

  if (isExactAmount) {
    if (dateDiff <= 1) {
      return { confidence: 'HIGH', status: 'AUTO_HIGH' }
    }
    // Any date gap > 1 day with exact amount = MEDIUM (no upper bound)
    return { confidence: 'MEDIUM', status: 'AUTO_MEDIUM' }
  }

  // Check within ±₹50 using Decimal arithmetic
  const diff = bankAmt.minus(voucherAmt).abs()
  const within50 = diff.lte(new Decimal('50'))

  if (within50) {
    return { confidence: 'LOW', status: 'AUTO_LOW' }
  }

  return { confidence: null, status: 'UNMATCHED' }
}

// ---------------------------------------------------------------------------
// runMatch — fetches statement + transactions + vouchers, scores, updates DB
// ---------------------------------------------------------------------------

/**
 * Run the matching algorithm for all BankTransactions in a BankStatement.
 *
 * Performance: Fetches ALL relevant vouchers in ONE query before the loop
 * (Pitfall 4 from RESEARCH.md — no per-row queries in the matching loop).
 *
 * Multi-tenancy: companyId in EVERY Prisma query — never from CSV data.
 *
 * @param statementId  BankStatement.id
 * @param companyId    From session.user.companyId (never from user input)
 * @param userId       From session.user.id — required for audit log FK constraint
 */
export async function runMatch(statementId: string, companyId: string, userId: string): Promise<void> {
  // 1. Fetch the BankStatement to get fromDate / toDate
  const statement = await prisma.bankStatement.findFirst({
    where: { id: statementId, companyId },
    select: { fromDate: true, toDate: true },
  })
  if (!statement) return

  const { fromDate, toDate } = statement

  // 2. Fetch BankTransactions for this statement — skip CONFIRMED/REJECTED (WR-01: preserve human decisions)
  const transactions = await prisma.bankTransaction.findMany({
    where: {
      statementId,
      companyId,
      matchStatus: { notIn: ['CONFIRMED', 'REJECTED'] },
    },
  })

  if (transactions.length === 0) return

  // 3. Fetch ALL relevant vouchers in ONE query before the loop (Pitfall 4)
  // Date window: fromDate - 3 days to toDate + 3 days (processing delays)
  const vouchers = await prisma.voucher.findMany({
    where: {
      companyId,
      status: 'POSTED',
      voucherType: { in: ['RECEIPT', 'PAYMENT'] },
      date: {
        gte: subDays(fromDate, 3),
        lte: addDays(toDate, 3),
      },
    },
    select: { id: true, voucherType: true, date: true, totalAmount: true },
  })

  // 4. Score each BankTransaction and prepare update data
  type UpdatePayload = {
    id: string
    matchStatus: string
    matchedVoucherId: string | null
    confidence: string | null
  }

  const updates: UpdatePayload[] = []

  for (const tx of transactions) {
    // Debit bank = money leaving = PAYMENT vouchers
    // Credit bank = money arriving = RECEIPT vouchers
    const txAmt = tx.debitAmount ?? tx.creditAmount
    const isDebit = tx.debitAmount !== null

    const relevantVouchers = vouchers.filter((v) =>
      isDebit ? v.voucherType === 'PAYMENT' : v.voucherType === 'RECEIPT',
    )

    let bestScore: MatchResult = { confidence: null, status: 'UNMATCHED' }
    let bestVoucherId: string | null = null
    let bestDateDiff = Infinity

    for (const v of relevantVouchers) {
      if (!txAmt) continue

      const bankAmtDecimal = new Decimal(txAmt.toString())
      const voucherAmtDecimal = new Decimal(v.totalAmount.toString())
      const result = scoreMatch(bankAmtDecimal, tx.txDate, voucherAmtDecimal, v.date)

      if (result.status === 'UNMATCHED') continue

      // Compare scores: HIGH > MEDIUM > LOW
      const scoreRank = { AUTO_HIGH: 3, AUTO_MEDIUM: 2, AUTO_LOW: 1, UNMATCHED: 0 }
      const bestRank = scoreRank[bestScore.status] ?? 0
      const currentRank = scoreRank[result.status] ?? 0

      const dateDiff = Math.abs(differenceInDays(tx.txDate, v.date))

      if (
        currentRank > bestRank ||
        (currentRank === bestRank && dateDiff < bestDateDiff)
      ) {
        bestScore = result
        bestVoucherId = v.id
        bestDateDiff = dateDiff
      }
    }

    updates.push({
      id: tx.id,
      matchStatus: bestScore.status,
      matchedVoucherId: bestVoucherId,
      confidence: bestScore.confidence,
    })
  }

  // 5. Wrap all BankTransaction updates + audit log in a single $transaction
  const matchedCount = updates.filter((u) => u.matchStatus !== 'UNMATCHED').length
  const totalCount = updates.length

  await prisma.$transaction(async (tx) => {
    // Update each BankTransaction
    for (const update of updates) {
      await tx.bankTransaction.update({
        where: { id: update.id, companyId },
        data: {
          matchStatus: update.matchStatus,
          matchedVoucherId: update.matchedVoucherId,
          confidence: update.confidence,
        },
      })
    }

    // Audit log for the matching run
    await tx.auditLog.create({
      data: {
        companyId,
        userId,
        entity: 'BankStatement',
        entityId: statementId,
        action: 'UPDATE',
        oldValue: {} as object,
        newValue: { matchedCount, totalCount } as unknown as object,
        ipAddress: null,
      },
    })
  })
}

// ---------------------------------------------------------------------------
// getBooksClosingBalance — adapted from ReportEngine.computeLedgerBalance
// ---------------------------------------------------------------------------

/**
 * Compute a bank ledger's net balance up to a specific date from voucher entries.
 *
 * Pattern: starts from ledger.openingBalance (adjusted for DR/CR direction),
 * then sums all POSTED VoucherEntry amounts up to toDate.
 *
 * Source: ReportEngine.ts computeLedgerBalance pattern
 * (Pattern 4 from 07-RESEARCH.md)
 *
 * Multi-tenancy: companyId in EVERY Prisma query (CLAUDE.md rule 2).
 *
 * @param companyId  From session.user.companyId
 * @param ledgerId   Bank ledger ID
 * @param toDate     Upper bound date (inclusive) for voucher entries
 * @returns          Net balance as Decimal (positive = DR balance)
 */
export async function getBooksClosingBalance(
  companyId: string,
  ledgerId: string,
  toDate: Date,
): Promise<Decimal> {
  const ledger = await prisma.ledger.findFirst({
    where: { id: ledgerId, companyId },
    include: {
      voucherEntries: {
        where: {
          voucher: {
            companyId,
            status: 'POSTED',
            date: { lte: toDate },
          },
        },
        select: { amount: true, drCr: true },
      },
    },
  })

  if (!ledger) return new Decimal(0)

  // Start from opening balance, adjusted for ledger's natural side
  let dr =
    ledger.drCr === 'DR'
      ? new Decimal(ledger.openingBalance.toString())
      : new Decimal(0)
  let cr =
    ledger.drCr === 'CR'
      ? new Decimal(ledger.openingBalance.toString())
      : new Decimal(0)

  // Sum all voucher entry amounts
  for (const entry of ledger.voucherEntries) {
    const amt = new Decimal(entry.amount.toString())
    if (entry.drCr === 'DR') {
      dr = dr.plus(amt)
    } else {
      cr = cr.plus(amt)
    }
  }

  // Positive = DR balance (bank asset account)
  return dr.minus(cr)
}
