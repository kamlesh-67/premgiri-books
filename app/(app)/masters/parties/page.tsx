import { readSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PartiesClient } from './PartiesClient'

export default async function PartiesPage() {
  const session = await readSession()
  if (!session) redirect('/login')

  const companyId = session.companyId
  const uiMode = session.uiMode

  // Fetch initial parties server-side — avoids client-side loading flash
  const partyGroups = await prisma.accountGroup.findMany({
    where: { companyId, name: { in: ['Sundry Debtors', 'Sundry Creditors'] } },
    select: { id: true, name: true },
  })
  const partyGroupIds = partyGroups.map((g) => g.id)
  const groupNameById = Object.fromEntries(partyGroups.map((g) => [g.id, g.name]))

  const partiesRaw = partyGroupIds.length > 0
    ? await prisma.ledger.findMany({
        where: { companyId, groupId: { in: partyGroupIds } },
        include: { group: { select: { name: true } } },
        orderBy: { name: 'asc' },
      })
    : []

  const initialData = partiesRaw.map((p) => ({
    id: p.id,
    name: p.name,
    gstin: p.gstin,
    partyType: (groupNameById[p.groupId] === 'Sundry Debtors' ? 'Customer' : 'Supplier') as 'Customer' | 'Supplier',
    phone: null as string | null, // phone not stored on ledger in Phase 1
    openingBalance: p.openingBalance.toString(),
    drCr: p.drCr,
    isActive: p.isActive,
  }))

  return <PartiesClient initialData={initialData} uiMode={uiMode} />
}
