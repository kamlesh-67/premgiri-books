/**
 * GET  /api/v1/company  — Return company profile for the current session's company.
 * PATCH /api/v1/company — Update name and/or address (GSTIN/PAN/stateCode are read-only).
 *
 * Security:
 *  - T-09-03-04: companyId always from session.companyId — never from request body / URL
 *  - T-09-03-01: Zod schema strips gstin/pan/stateCode — immutable after registration
 *  - Rule 7 (CLAUDE.md): every mutation writes to audit_logs inside the same $transaction
 */
import { getSessionFromRequest } from '@/lib/session'
import { requirePermission } from '@/lib/utils/requirePermission'
import { prisma } from '@/lib/prisma'
import { NextResponse, NextRequest } from 'next/server'
import { z } from 'zod'

// Zod schema — deliberately excludes gstin, pan, stateCode (read-only after registration).
// Default Zod .strip() behaviour silently drops any extra keys.
const patchSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  defaultBankLedgerId: z.string().nullable().optional(),
})

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const forbidden = requirePermission(session, 'settings', 'read')
  if (forbidden) return forbidden

  const companyId = session.companyId

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
      defaultBankLedgerId: true,
      createdAt: true,
    },
  })

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  // Resolve the default bank ledger's details for invoice printing, if set.
  let defaultBankAccount: { bankName: string | null; bankAccount: string | null; ifsc: string | null } | null = null
  if (company.defaultBankLedgerId) {
    defaultBankAccount = await prisma.ledger.findFirst({
      where: { id: company.defaultBankLedgerId, companyId },
      select: { bankName: true, bankAccount: true, ifsc: true },
    })
  }

  return NextResponse.json({ ...company, defaultBankAccount })
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const forbidden = requirePermission(session, 'settings', 'admin')
  if (forbidden) return forbidden

  const companyId = session.companyId
  const userId = session.userId

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
  if (
    parsed.data.name === undefined &&
    parsed.data.address === undefined &&
    parsed.data.defaultBankLedgerId === undefined
  ) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
  }

  // defaultBankLedgerId must reference a real ledger in THIS company with bank details set —
  // never trust the client-supplied id blindly (IDOR / cross-tenant guard).
  if (parsed.data.defaultBankLedgerId) {
    const ledger = await prisma.ledger.findFirst({
      where: { id: parsed.data.defaultBankLedgerId, companyId },
      select: { bankAccount: true, ifsc: true },
    })
    if (!ledger || !ledger.bankAccount || !ledger.ifsc) {
      return NextResponse.json(
        { error: 'Selected ledger is not a valid bank account for this company' },
        { status: 400 },
      )
    }
  }

  // Fetch existing to capture oldValue for audit log
  const existing = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, address: true, defaultBankLedgerId: true },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const oldValue = {
    name: existing.name,
    address: existing.address ?? null,
    defaultBankLedgerId: existing.defaultBankLedgerId ?? null,
  }

  // Build update data — only include fields that were provided
  const updateData: { name?: string; address?: string; defaultBankLedgerId?: string | null } = {}
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name
  if (parsed.data.address !== undefined) updateData.address = parsed.data.address
  if (parsed.data.defaultBankLedgerId !== undefined) {
    updateData.defaultBankLedgerId = parsed.data.defaultBankLedgerId
  }

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
        defaultBankLedgerId: true,
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
