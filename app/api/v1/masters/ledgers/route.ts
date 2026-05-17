import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { ledgerSchema, customerSchema, supplierSchema } from '@/lib/schemas/masters'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.user.companyId
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const nature = searchParams.get('nature') // 'ASSET'|'LIABILITY'|'INCOME'|'EXPENSE'

  if (type === 'party') {
    // Filter to Sundry Debtors + Sundry Creditors groups only (D-19)
    const partyGroups = await prisma.accountGroup.findMany({
      where: { companyId, name: { in: ['Sundry Debtors', 'Sundry Creditors'] } },
      select: { id: true, name: true },
    })
    const partyGroupIds = partyGroups.map((g) => g.id)
    const groupNameById = Object.fromEntries(partyGroups.map((g) => [g.id, g.name]))

    // Auto-ensure the Walk-in Customer ledger exists (for one-time sales)
    const sundryDebtors = partyGroups.find((g) => g.name === 'Sundry Debtors')
    if (sundryDebtors) {
      await prisma.ledger.upsert({
        where: { companyId_name: { companyId, name: 'Walk-in Customer' } },
        update: {},
        create: {
          name: 'Walk-in Customer',
          companyId,
          groupId: sundryDebtors.id,
          openingBalance: '0',
          drCr: 'DR',
          gstRegType: 'CONSUMER',
          isActive: true,
        },
      })
    }

    const parties = await prisma.ledger.findMany({
      where: { companyId, groupId: { in: partyGroupIds } },
      include: { group: { select: { name: true } } },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(
      parties.map((p) => ({
        ...p,
        partyType:
          groupNameById[p.groupId] === 'Sundry Debtors' ? 'Customer' : 'Supplier',
        openingBalance: p.openingBalance.toString(),
        creditLimit: p.creditLimit?.toString() ?? null,
      }))
    )
  }

  // All ledgers — optionally filtered by account nature
  let whereClause: Record<string, unknown> = { companyId, isActive: true }
  if (nature) {
    const groups = await prisma.accountGroup.findMany({
      where: { companyId, nature: nature as 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE' },
      select: { id: true },
    })
    whereClause = { ...whereClause, groupId: { in: groups.map((g) => g.id) } }
  }

  const ledgers = await prisma.ledger.findMany({
    where: whereClause,
    include: {
      group: {
        select: {
          name: true,
          nature: true,
          parent: { select: { name: true, parent: { select: { name: true } } } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(
    ledgers.map((l) => ({
      ...l,
      openingBalance: l.openingBalance.toString(),
      creditLimit: l.creditLimit?.toString() ?? null,
      // Build full path string for display
      groupPath: [
        l.group.parent?.parent?.name,
        l.group.parent?.name,
        l.group.name,
      ]
        .filter(Boolean)
        .join(' > '),
    }))
  )
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.user.companyId
  const body = await request.json()
  const { partyType, ...rest } = body // partyType: 'customer' | 'supplier' | undefined

  let groupId: string | undefined = rest.groupId
  let parsedData: Record<string, unknown>

  if (partyType === 'customer') {
    // D-12: Auto-assign Sundry Debtors in Simple Mode — client cannot inject groupId
    const parsed = customerSchema.safeParse(rest)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
    }
    const sundryDebtors = await prisma.accountGroup.findFirst({
      where: { companyId, name: 'Sundry Debtors' },
    })
    if (!sundryDebtors) {
      return NextResponse.json({ error: 'Account groups not initialised for this company. Run database seed first.' }, { status: 422 })
    }
    groupId = sundryDebtors.id
    parsedData = { ...parsed.data }
  } else if (partyType === 'supplier') {
    // D-14: Auto-assign Sundry Creditors in Simple Mode — client cannot inject groupId
    const parsed = supplierSchema.safeParse(rest)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
    }
    const sundryCreditors = await prisma.accountGroup.findFirst({
      where: { companyId, name: 'Sundry Creditors' },
    })
    if (!sundryCreditors) {
      return NextResponse.json({ error: 'Sundry Creditors account group not found. Please ensure company master data is seeded.' }, { status: 500 })
    }
    groupId = sundryCreditors.id
    parsedData = { ...parsed.data }
  } else {
    // Advanced Mode: full ledger schema with explicit groupId
    const parsed = ledgerSchema.safeParse(rest)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
    }
    groupId = parsed.data.groupId
    parsedData = { ...parsed.data }
  }

  if (!groupId) {
    return NextResponse.json({ error: 'Account group is required' }, { status: 400 })
  }

  // Create ledger in transaction with audit log (non-negotiable rule 7)
  const result = await prisma.$transaction(async (tx) => {
    const ledger = await tx.ledger.create({
      data: {
        name: parsedData.name as string,
        groupId,
        companyId,
        gstin: (parsedData.gstin as string) || null,
        pan: (parsedData.pan as string) || null,
        openingBalance: parsedData.openingBalance as string,
        drCr: (parsedData.drCr as 'DR' | 'CR') || 'DR',
        gstRegType: (parsedData.gstRegType as 'REGULAR' | 'COMPOSITION' | 'UNREGISTERED' | 'CONSUMER') || 'UNREGISTERED',
        creditLimit: parsedData.creditLimit as string | undefined,
        creditDays: parsedData.creditDays as number | undefined,
        bankName: (parsedData.bankName as string) || null,
        bankAccount: (parsedData.bankAccount as string) || null,
        ifsc: (parsedData.ifsc as string) || null,
        isActive: true,
      },
    })

    await tx.auditLog.create({
      data: {
        companyId,
        userId: session.user.id,
        entity: 'Ledger',
        entityId: ledger.id,
        action: 'CREATE',
        oldValue: undefined,
        newValue: { name: ledger.name, groupId: ledger.groupId, partyType } as object,
      },
    })

    return ledger
  })

  return NextResponse.json(
    { ...result, openingBalance: result.openingBalance.toString(), creditLimit: result.creditLimit?.toString() ?? null },
    { status: 201 }
  )
}
