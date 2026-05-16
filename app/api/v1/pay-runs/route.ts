/**
 * GET  /api/v1/pay-runs  — list pay runs for company
 * POST /api/v1/pay-runs  — upsert PENDING PayRun + fire Inngest job → 202
 */
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { inngest } from '@/lib/inngest'
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

  // Fire Inngest job — fire-and-forget; do not block 202 if Inngest is unavailable locally
  inngest.send({
    name: 'premgiri/payroll.run',
    data: {
      payRunId: payRun.id,
      companyId,
      month,
      triggeredBy: session.user.id,
    },
  }).catch((err) => {
    console.warn('[pay-runs] Inngest unavailable — job not queued:', err?.message)
  })

  return NextResponse.json(
    { id: payRun.id, month, status: 'PENDING' },
    { status: 202 }
  )
}
