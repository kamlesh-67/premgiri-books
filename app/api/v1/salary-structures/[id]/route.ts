/**
 * GET    /api/v1/salary-structures/[id]  — fetch detail
 * PATCH  /api/v1/salary-structures/[id]  — update name or components
 * DELETE /api/v1/salary-structures/[id]  — soft delete (isActive=false)
 */
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

const salaryComponentSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(['earning', 'deduction']),
    formula: z.string().optional(),
    amount: z.string().optional(),
    order: z.number().int().min(1),
  })
  .refine((c) => c.formula !== undefined || c.amount !== undefined, {
    message: 'Each component must have either formula or amount',
  })

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  components: z.array(salaryComponentSchema).min(1).optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.user.companyId
  const { id } = await params

  const structure = await prisma.salaryStructure.findFirst({
    where: { id, companyId },
    include: { employees: { select: { id: true, name: true, employeeCode: true } } },
  })
  if (!structure) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(structure)
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.user.companyId
  const { id } = await params

  const existing = await prisma.salaryStructure.findFirst({ where: { id, companyId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const data: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) data.name = parsed.data.name
  if (parsed.data.components !== undefined) data.components = parsed.data.components as object

  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.salaryStructure.update({
      where: { id, companyId },
      data,
    })
    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.user.id,
        entity: 'SalaryStructure',
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

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.user.companyId
  const { id } = await params

  const existing = await prisma.salaryStructure.findFirst({ where: { id, companyId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Soft delete — never hard delete (CLAUDE.md Rule 6)
  await prisma.$transaction(async (tx) => {
    await tx.salaryStructure.update({
      where: { id, companyId },
      data: { isActive: false },
    })
    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.user.id,
        entity: 'SalaryStructure',
        entityId: id,
        action: 'DELETE',
        oldValue: existing as object,
      },
    })
  })

  return NextResponse.json({ success: true })
}
