/**
 * GET /api/v1/pay-runs/[id]/slips/[employeeId]
 *
 * Returns a 15-minute presigned R2 URL to download the pay slip PDF.
 * 404 if slip not found or PDF not yet generated (pdfKey is null).
 */
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPresignedUrl } from '@/lib/r2'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

type Params = { params: Promise<{ id: string; employeeId: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.user.companyId
  const { id: payRunId, employeeId } = await params

  // Verify pay run belongs to this company (IDOR protection)
  const payRun = await prisma.payRun.findFirst({ where: { id: payRunId, companyId } })
  if (!payRun) return NextResponse.json({ error: 'Pay run not found' }, { status: 404 })

  const slip = await prisma.paySlip.findFirst({
    where: { payRunId, employeeId, companyId },
  })
  if (!slip) return NextResponse.json({ error: 'Pay slip not found' }, { status: 404 })
  if (!slip.pdfKey) {
    return NextResponse.json(
      { error: 'PDF not yet generated — pay run may still be processing' },
      { status: 404 }
    )
  }

  const url = await getPresignedUrl(slip.pdfKey)
  return NextResponse.json({ url, expiresInSeconds: 900 })
}
