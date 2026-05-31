/**
 * GET  /api/v1/pay-runs  — list pay runs for company
 * POST /api/v1/pay-runs  — upsert PENDING PayRun + run payroll directly → 202
 */
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { runPayroll } from '@/lib/services/PayrollRunner'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

const createSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM format'),
})

export async function GET(_request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.user.companyId

  const runs = await prisma.payRun.findMany({
    where: { companyId },
    include: { _count: { select: { paySlips: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(
    runs.map((r) => ({
      ...r,
      totalGross: r.totalGross?.toString() ?? null,
      totalNet: r.totalNet?.toString() ?? null,
    }))
  )
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.user.companyId

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }
  const { month } = parsed.data

  // Upsert PayRun — re-run overwrites previous run for same month
  const payRun = await prisma.$transaction(async (tx) => {
    const run = await tx.payRun.upsert({
      where: { companyId_month: { companyId, month } },
      create: {
        companyId,
        month,
        status: 'PENDING',
        createdBy: session.user.id,
      },
      update: {
        status: 'PENDING',
        errorMessage: null,
        completedAt: null,
        totalGross: null,
        totalNet: null,
      },
    })
    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.user.id,
        entity: 'PayRun',
        entityId: run.id,
        action: 'CREATE',
        newValue: run as object,
      },
    })
    return run
  })

  // Run payroll synchronously (Inngest removed — CLOUD-01)
  runPayroll(payRun.id, companyId, month, session.user.id).catch((err) => {
    console.error('[pay-run route] PayrollRunner failed:', err)
  })

  return NextResponse.json(
    { id: payRun.id, month, status: 'PENDING' },
    { status: 202 }
  )
}
