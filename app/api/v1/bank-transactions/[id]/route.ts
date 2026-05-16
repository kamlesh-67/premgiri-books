/**
 * PATCH /api/v1/bank-transactions/[id]
 *
 * Confirm or reject an auto-matched bank transaction.
 *
 * Actions:
 *   - 'confirm': matchStatus → CONFIRMED (only from AUTO_HIGH / AUTO_MEDIUM / AUTO_LOW)
 *   - 'reject': matchStatus → REJECTED, matchedVoucherId → null, confidence → null
 *
 * Per D-07:
 *   - UNMATCHED transactions cannot be confirmed or rejected (400)
 *   - Already CONFIRMED or REJECTED transactions cannot be re-actioned (400)
 *   - Only AUTO_* statuses are eligible for confirm/reject
 *
 * Security:
 *   - auth() first → 401 if no session
 *   - companyId ALWAYS from session.user.companyId — never from params or body (T-07-03-06)
 *   - IDOR protection: findFirst({ where: { id, companyId } }) — 404 for wrong company
 *   - action validated via Zod before any DB touch
 *   - All DB changes + auditLog written inside prisma.$transaction (T-07-03-04)
 */

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

// Zod schema for PATCH body
const patchSchema = z.object({
  action: z.enum(['confirm', 'reject']),
})

// Match statuses eligible for confirm/reject — only auto-matched rows
const ELIGIBLE_STATUSES = new Set(['AUTO_HIGH', 'AUTO_MEDIUM', 'AUTO_LOW'])

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.user.companyId  // NEVER from body (T-07-03-06)
  const userId = session.user.id
  const { id: txId } = await params

  // Parse and validate request body via Zod
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { action } = parsed.data

  // IDOR protection: fetch with companyId guard
  const tx = await prisma.bankTransaction.findFirst({
    where: { id: txId, companyId },
  })
  if (!tx) return NextResponse.json({ error: 'Bank transaction not found' }, { status: 404 })

  // T-07-03-04: Only auto-matched rows can be confirmed/rejected
  // CONFIRMED and REJECTED are terminal states; UNMATCHED has no voucher to confirm
  if (!ELIGIBLE_STATUSES.has(tx.matchStatus)) {
    return NextResponse.json(
      {
        error: `Cannot ${action} a transaction with status '${tx.matchStatus}'. Only AUTO_HIGH, AUTO_MEDIUM, or AUTO_LOW transactions can be confirmed or rejected.`,
      },
      { status: 400 },
    )
  }

  // Compute new state
  const newMatchStatus = action === 'confirm' ? 'CONFIRMED' : 'REJECTED'
  const newMatchedVoucherId = action === 'confirm' ? tx.matchedVoucherId : null
  const newConfidence = action === 'confirm' ? tx.confidence : null

  // Persist changes + audit log in a single $transaction
  let updatedTx
  try {
    updatedTx = await prisma.$transaction(async (txPrisma) => {
      const updated = await txPrisma.bankTransaction.update({
        where: { id: txId, companyId },
        data: {
          matchStatus: newMatchStatus,
          matchedVoucherId: newMatchedVoucherId,
          confidence: newConfidence,
        },
      })

      await txPrisma.auditLog.create({
        data: {
          companyId,
          userId,
          entity: 'BankTransaction',
          entityId: txId,
          action: 'UPDATE',
          oldValue: {
            matchStatus: tx.matchStatus,
            matchedVoucherId: tx.matchedVoucherId,
            confidence: tx.confidence,
          } as object,
          newValue: {
            matchStatus: newMatchStatus,
            matchedVoucherId: newMatchedVoucherId,
            confidence: newConfidence,
            action,
          } as object,
        },
      })

      return updated
    })
  } catch (err) {
    console.error('[bank-transactions/[id] PATCH]', err)
    return NextResponse.json({ error: 'Failed to update bank transaction' }, { status: 500 })
  }

  // Serialize Decimal fields for JSON-safe response
  return NextResponse.json({
    id: updatedTx.id,
    txDate: updatedTx.txDate,
    description: updatedTx.description,
    debitAmount: updatedTx.debitAmount?.toFixed(2) ?? null,
    creditAmount: updatedTx.creditAmount?.toFixed(2) ?? null,
    balance: updatedTx.balance?.toFixed(2) ?? null,
    matchStatus: updatedTx.matchStatus,
    matchedVoucherId: updatedTx.matchedVoucherId,
    confidence: updatedTx.confidence,
  })
}
