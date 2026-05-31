/**
 * GET   /api/v1/employees/[id]  — fetch employee detail with salary structure
 * PATCH /api/v1/employees/[id]  — update employee fields including salary structure assignment
 *
 * salaryStructureId: nullable FK to SalaryStructure (D-03)
 * structureEffectiveFrom: date the structure takes effect
 */
import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  designation: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  pfApplicable: z.boolean().optional(),
  esiApplicable: z.boolean().optional(),
  salaryLedgerId: z.string().cuid().optional().nullable(),
  salaryStructureId: z.string().cuid().optional().nullable(),
  structureEffectiveFrom: z.string().datetime({ offset: true }).optional().nullable(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId
  const { id } = await params

  const employee = await prisma.employee.findFirst({
    where: { id, companyId },
    include: {
      salaryStructure: { select: { id: true, name: true } },
      salaryLedger: { select: { id: true, name: true } },
    },
  })
  if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(employee)
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId
  const { id } = await params

  const existing = await prisma.employee.findFirst({ where: { id, companyId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { structureEffectiveFrom, ...rest } = parsed.data
  const data: Record<string, unknown> = { ...rest }
  if (structureEffectiveFrom !== undefined) {
    data.structureEffectiveFrom = structureEffectiveFrom ? new Date(structureEffectiveFrom) : null
  }

  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.employee.update({
      where: { id, companyId },
      data,
      include: { salaryStructure: { select: { id: true, name: true } } },
    })
    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.userId,
        entity: 'Employee',
        entityId: id,
        action: 'UPDATE',
        oldValue: existing as object,
        newValue: record as object,
      },
    })
    return record
  })

  return NextResponse.json(updated)
}
