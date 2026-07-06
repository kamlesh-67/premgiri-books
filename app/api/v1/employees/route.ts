/**
 * GET  /api/v1/employees  — list all active employees for company
 * POST /api/v1/employees  — create a new employee
 *
 * Supports ?include=salaryStructure to join the assigned salary structure.
 */
import { getSessionFromRequest } from '@/lib/session'
import { prisma, type TransactionClient } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(100),
  employeeCode: z.string().min(1).max(20),
  designation: z.string().optional(),
  department: z.string().optional(),
  joinDate: z.string().min(1),
  salaryLedgerId: z.string().optional(),
  pfApplicable: z.boolean().default(true),
  esiApplicable: z.boolean().default(false),
})

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId
  const { searchParams } = new URL(request.url)
  const includeStructure = searchParams.get('include') === 'salaryStructure'

  const employees = await prisma.employee.findMany({
    where: { companyId, isActive: true },
    include: includeStructure
      ? { salaryStructure: { select: { id: true, name: true } } }
      : undefined,
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(employees)
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId
  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  const { name, employeeCode, designation, department, joinDate, salaryLedgerId, pfApplicable, esiApplicable } = parsed.data

  const existing = await prisma.employee.findFirst({ where: { companyId, employeeCode } })
  if (existing) return NextResponse.json({ error: 'Employee code already exists' }, { status: 409 })

  const employee = await prisma.$transaction(async (tx: TransactionClient) => {
    const record = await tx.employee.create({
      data: {
        companyId,
        name,
        employeeCode,
        designation: designation ?? null,
        department: department ?? null,
        joinDate: new Date(joinDate),
        salaryLedgerId: salaryLedgerId ?? null,
        pfApplicable,
        esiApplicable,
      },
    })
    await tx.auditLog.create({
      data: { companyId, userId: session.userId, entity: 'Employee', entityId: record.id, action: 'CREATE', newValue: record as object },
    })
    return record
  })

  return NextResponse.json(employee, { status: 201 })
}
