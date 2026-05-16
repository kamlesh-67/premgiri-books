import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AccountGroupFlat {
  id: string
  name: string
  parentId: string | null
  nature: string
  affectsGP: boolean
}

// Recursive type for nested Prisma result
interface AccountGroupNode {
  id: string
  name: string
  parentId: string | null
  nature: string
  affectsGP: boolean
  children?: AccountGroupNode[]
}

// ─── Flatten helper ───────────────────────────────────────────────────────────

function flattenTree(groups: AccountGroupNode[]): AccountGroupFlat[] {
  const result: AccountGroupFlat[] = []
  function walk(g: AccountGroupNode) {
    result.push({
      id: g.id,
      name: g.name,
      parentId: g.parentId ?? null,
      nature: g.nature,
      affectsGP: g.affectsGP,
    })
    if (g.children) g.children.forEach(walk)
  }
  groups.forEach(walk)
  return result
}

// ─── Route Handler ────────────────────────────────────────────────────────────

/**
 * GET /api/v1/masters/account-groups
 *
 * Returns flat array of all account groups for the authenticated company.
 * Used by:
 *   - LedgerForm combobox (Plan 01-07) — buildPathMap to show full hierarchy paths
 *   - AccountGroupsClient (Plan 01-09) — rebuild tree for Accordion rendering
 *
 * Response shape: { id, name, parentId, nature, affectsGP }[]
 * Top-level groups have parentId: null; children reference parent by id.
 *
 * Security: T-01-09-01 (auth check), T-01-09-02 (companyId scoping)
 */
export async function GET() {
  // T-01-09-01: Auth check — always first
  const session = await auth()
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { companyId } = session.user

  // Fetch nested tree (3 levels deep covers full seeded hierarchy)
  // T-01-09-02: Always filter by companyId — no cross-tenant data
  const topLevel = await prisma.accountGroup.findMany({
    where: { companyId, parentId: null },
    select: {
      id: true,
      name: true,
      parentId: true,
      nature: true,
      affectsGP: true,
      children: {
        select: {
          id: true,
          name: true,
          parentId: true,
          nature: true,
          affectsGP: true,
          children: {
            select: {
              id: true,
              name: true,
              parentId: true,
              nature: true,
              affectsGP: true,
              children: {
                select: {
                  id: true,
                  name: true,
                  parentId: true,
                  nature: true,
                  affectsGP: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  // Flatten nested tree → flat array with parentId for client buildPathMap
  const flat = flattenTree(topLevel as AccountGroupNode[])

  return NextResponse.json(flat)
}
