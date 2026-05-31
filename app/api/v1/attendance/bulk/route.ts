/**
 * PATCH /api/v1/attendance/bulk
 *
 * Mark all active employees as present (26 days, 0 absent) for a month.
 * Per D-05: bulk upsert; individual records can be adjusted afterward.
 * Skips employees whose attendance is locked (lockedAt is set).
 */
import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { Decimal } from 'decimal.js'

const bulkSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM format'),
})

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId

  const body = await request.json()
  const parsed = bulkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }
  const { month } = parsed.data

  const employees = await prisma.employee.findMany({
    where: { companyId, isActive: true },
    select: { id: true },
  })

  if (employees.length === 0) {
    return NextResponse.json({ updated: 0, month })
  }

  // Wrap all upserts + audit log in a single $transaction (CLAUDE.md Rule 7)
  let updated = 0
  await prisma.$transaction(async (tx) => {
    for (const emp of employees) {
      const existing = await tx.attendanceRecord.findFirst({
        where: { companyId, employeeId: emp.id, month },
      })
      if (existing?.lockedAt) continue // skip locked attendance

      await tx.attendanceRecord.upsert({
        where: { companyId_employeeId_month: { companyId, employeeId: emp.id, month } },
        create: {
          companyId,
          employeeId: emp.id,
          month,
          presentDays: new Decimal(26),
          absentDays: new Decimal(0),
          halfDays: 0,
          leaveDays: 0,
        },
        update: {
          presentDays: new Decimal(26),
          absentDays: new Decimal(0),
          halfDays: 0,
          leaveDays: 0,
        },
      })
      updated++
    }

    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.userId,
        entity: 'AttendanceRecord',
        entityId: 'bulk',
        action: 'UPDATE',
        newValue: { month, updated, action: 'mark-all-present' } as object,
      },
    })
  })

  return NextResponse.json({ updated, month })
}
