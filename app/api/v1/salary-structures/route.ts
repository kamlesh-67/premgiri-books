/**
 * GET  /api/v1/salary-structures  — list active structures for company
 * POST /api/v1/salary-structures  — create new salary structure
 */
import { getSessionFromRequest } from '@/lib/session'
import { prisma, type TransactionClient } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

const salaryComponentSchema = z
  .object({
    name: z.string().min(1, 'Component name required'),
    type: z.enum(['earning', 'deduction']),
    formula: z.string().optional(),
    amount: z.string().optional(),
    order: z.number().int().min(1),
  })
  .refine((c) => c.formula !== undefined || c.amount !== undefined, {
    message: 'Each component must have either formula or amount',
  })

const createSchema = z.object({
  name: z.string().min(1).max(100),
  components: z.array(salaryComponentSchema).min(1, 'At least one component required'),
})

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId

  const structures = await prisma.salaryStructure.findMany({
    where: { companyId, isActive: true },
    include: { _count: { select: { employees: true } } },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(structures)
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { name, components } = parsed.data

  try {
    const structure = await prisma.$transaction(async (tx: TransactionClient) => {
      const created = await tx.salaryStructure.create({
        data: { companyId, name, components: components as object },
      })
      await tx.auditLog.create({
        data: {
          companyId,
          userId: session.userId,
          entity: 'SalaryStructure',
          entityId: created.id,
          action: 'CREATE',
          newValue: created as object,
        },
      })
      return created
    })
    return NextResponse.json(structure, { status: 201 })
  } catch (err: unknown) {
    const e = err as { code?: string }
    if (e.code === 'P2002') {
      return NextResponse.json(
        { error: `A salary structure named "${name}" already exists` },
        { status: 409 }
      )
    }
    console.error('[salary-structures POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
