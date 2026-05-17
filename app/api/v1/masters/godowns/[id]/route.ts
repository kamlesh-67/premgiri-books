import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { godownSchema } from '@/lib/schemas/masters'
import { z } from 'zod'
import type { NextRequest } from 'next/server'

// Patch schema extends godownSchema with optional isActive for soft-delete
const patchGodownSchema = godownSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.user.companyId
  const { id } = await params

  // Verify ownership (T-01-08-02 — prevents IDOR)
  const existing = await prisma.godown.findFirst({
    where: { id, companyId },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Godown not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const partial = patchGodownSchema.safeParse(body)
  if (!partial.success) {
    return NextResponse.json({ error: 'Validation failed', issues: partial.error.issues }, { status: 400 })
  }

  const data = partial.data

  // Guard: cannot deactivate the last active godown
  if (data.isActive === false && existing.isActive) {
    const activeCount = await prisma.godown.count({
      where: { companyId, isActive: true },
    })
    if (activeCount <= 1) {
      return NextResponse.json(
        { error: 'Cannot deactivate the only active godown.' },
        { status: 400 }
      )
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    // T-01-08-03: If setting isMain: true, un-set all other main godowns atomically
    if (data.isMain === true) {
      await tx.godown.updateMany({
        where: { companyId, isMain: true, id: { not: id } },
        data: { isMain: false },
      })
    }

    const updated = await tx.godown.update({
      where: { id, companyId },
      data,
    })

    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.user.id,
        entity: 'Godown',
        entityId: id,
        action: 'UPDATE',
        oldValue: {
          name: existing.name,
          address: existing.address,
          isMain: existing.isMain,
          isActive: existing.isActive,
        } as object,
        newValue: data as object,
      },
    })

    return updated
  })

  return NextResponse.json(result)
}
