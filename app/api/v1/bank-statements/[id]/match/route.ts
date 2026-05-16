/**
 * POST /api/v1/bank-statements/[id]/match
 *
 * Re-run the matching algorithm for all BankTransactions in a BankStatement.
 * Useful when new vouchers have been created after the initial import.
 *
 * Security:
 *   - auth() first → 401 if no session
 *   - companyId ALWAYS from session.user.companyId — never from params (T-07-03-06)
 *   - IDOR protection: findFirst({ where: { id, companyId } }) — 404 for wrong company (T-07-03-03)
 */

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { runMatch } from '@/lib/banking/MatchingEngine'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.user.companyId  // NEVER from params (T-07-03-06)
  const { id } = await params

  // IDOR protection: verify statement belongs to this company
  const stmt = await prisma.bankStatement.findFirst({
    where: { id, companyId },
    select: { id: true },
  })
  if (!stmt) return NextResponse.json({ error: 'Bank statement not found' }, { status: 404 })

  try {
    await runMatch(id, companyId, session.user.id)
    return NextResponse.json({ message: 'Matching complete', statementId: id })
  } catch (err) {
    console.error('[bank-statements/[id]/match POST]', err)
    return NextResponse.json({ error: 'Matching failed' }, { status: 500 })
  }
}
