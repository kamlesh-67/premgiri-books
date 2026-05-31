/**
 * GET /api/v1/attendance?month=YYYY-MM  — list all employee attendance for month
 * PUT /api/v1/attendance                — upsert single employee attendance
 *                                         Returns 409 if attendance is locked
 */
import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { Decimal } from 'decimal.js'

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM format')

const putSchema = z.object({
  employeeId: z.string().cuid(),
  month: monthSchema,
  presentDays: z.number().min(0).max(26),
  absentDays: z.number().min(0).max(26),
  halfDays: z.number().int().min(0).max(26),
  leaveDays: z.number().int().min(0).max(26),
})

function serializeAttendance(record: {
  id: string
  companyId: string
  employeeId: string
  month: string
  presentDays: Decimal | { toString(): string }
  absentDays: Decimal | { toString(): string }
  halfDays: number
  leaveDays: number
  lockedAt: Date | null
  createdAt: Date
  updatedAt: Date
  employee?: { id: string; name: string; employeeCode: string }
}) {
  return {
    ...record,
    presentDays: record.presentDays.toString(),
    absentDays: record.absentDays.toString(),
  }
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')

  if (!month) {
    return NextResponse.json({ error: 'month query parameter required (YYYY-MM)' }, { status: 400 })
  }
  const monthParsed = monthSchema.safeParse(month)
  if (!monthParsed.success) {
    return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 422 })
  }

  // Load all active employees for the company
  const employees = await prisma.employee.findMany({
    where: { companyId, isActive: true },
    select: { id: true, name: true, employeeCode: true },
    orderBy: { name: 'asc' },
  })

  // Load existing attendance records for this month
  const records = await prisma.attendanceRecord.findMany({
    where: { companyId, month },
    include: { employee: { select: { id: true, name: true, employeeCode: true } } },
  })

  const recordMap = new Map(records.map((r) => [r.employeeId, r]))

  // Return one row per employee (record or null placeholder)
  const result = employees.map((emp) => {
    const rec = recordMap.get(emp.id)
    if (rec) return serializeAttendance(rec)
    return {
      id: null,
      companyId,
      employeeId: emp.id,
      month,
      presentDays: '0',
      absentDays: '26',
      halfDays: 0,
      leaveDays: 0,
      lockedAt: null,
      createdAt: null,
      updatedAt: null,
      employee: emp,
    }
  })

  return NextResponse.json(result)
}

export async function PUT(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId

  const body = await request.json()
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { employeeId, month, presentDays, absentDays, halfDays, leaveDays } = parsed.data

  // Verify employee belongs to this company (IDOR protection)
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, companyId } })
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  // Check lock — cannot edit after pay run completes
  const existing = await prisma.attendanceRecord.findFirst({
    where: { companyId, employeeId, month },
  })
  if (existing?.lockedAt) {
    return NextResponse.json(
      { error: 'Attendance is locked — pay run has been completed for this month. Re-run payroll to unlock.' },
      { status: 409 }
    )
  }

  const record = await prisma.$transaction(async (tx) => {
    const upserted = await tx.attendanceRecord.upsert({
      where: { companyId_employeeId_month: { companyId, employeeId, month } },
      create: {
        companyId,
        employeeId,
        month,
        presentDays: new Decimal(presentDays),
        absentDays: new Decimal(absentDays),
        halfDays,
        leaveDays,
      },
      update: {
        presentDays: new Decimal(presentDays),
        absentDays: new Decimal(absentDays),
        halfDays,
        leaveDays,
      },
    })
    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.userId,
        entity: 'AttendanceRecord',
        entityId: upserted.id,
        action: existing ? 'UPDATE' : 'CREATE',
        oldValue: existing as object ?? null,
        newValue: upserted as object,
      },
    })
    return upserted
  })

  return NextResponse.json(serializeAttendance(record))
}
