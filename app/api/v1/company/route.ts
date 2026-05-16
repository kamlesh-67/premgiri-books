/**
 * GET  /api/v1/company  — Return company profile for the current session's company.
 * PATCH /api/v1/company — Update name and/or address (GSTIN/PAN/stateCode are read-only).
 *
 * Security:
 *  - T-09-03-04: companyId always from session.user.companyId — never from request body / URL
 *  - T-09-03-01: Zod schema strips gstin/pan/stateCode — immutable after registration
 *  - Rule 7 (CLAUDE.md): every mutation writes to audit_logs inside the same $transaction
 */
import { auth } from '@/lib/auth'
import { requirePermission } from '@/lib/utils/requirePermission'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'

// Zod schema — deliberately excludes gstin, pan, stateCode (read-only after registration).
// Default Zod .strip() behaviour silently drops any extra keys.
const patchSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
})

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(_request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const forbidden = requirePermission(session, 'settings', 'read')
  if (forbidden) return forbidden

  const companyId = session.user.companyId

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      gstin: true,
      pan: true,
      stateCode: true,
      address: true,
      fyStart: true,
      logoUrl: true,
      createdAt: true,
    },
  })

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  return NextResponse.json(company)
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const forbidden = requirePermission(session, 'settings', 'admin')
  if (forbidden) return forbidden

  const companyId = session.user.companyId
  const userId = session.user.id

  // Parse + validate — extra fields (gstin, pan, stateCode) are stripped silently
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  // Nothing to update
  if (parsed.data.name === undefined && parsed.data.address === undefined) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
  }

  // Fetch existing to capture oldValue for audit log
  const existing = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, address: true },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const oldValue = { name: existing.name, address: existing.address ?? null }

  // Build update data — only include fields that were provided
  const updateData: { name?: string; address?: string } = {}
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name
  if (parsed.data.address !== undefined) updateData.address = parsed.data.address

  const [updatedCompany] = await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: updateData,
      select: {
        id: true,
        name: true,
        gstin: true,
        pan: true,
        stateCode: true,
        address: true,
        fyStart: true,
        logoUrl: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.create({
      data: {
        companyId,
        userId,
        entity: 'Company',
        entityId: companyId,
        action: 'UPDATE',
        oldValue,
        newValue: parsed.data,
        ipAddress: request.headers.get('x-forwarded-for') ?? null,
      },
    }),
  ])

  return NextResponse.json(updatedCompany)
}
