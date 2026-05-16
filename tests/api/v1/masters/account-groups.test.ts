/**
 * tests/api/v1/masters/account-groups.test.ts
 *
 * RED phase: Tests for GET /api/v1/masters/account-groups route.
 * Verifies auth guard, multi-tenant scoping, flat response shape with affectsGP,
 * and that nested children are included in the flat array.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    accountGroup: {
      findMany: vi.fn(),
    },
  },
}))

// Import after mocks
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from '@/app/api/v1/masters/account-groups/route'

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockFindMany = prisma.accountGroup.findMany as ReturnType<typeof vi.fn>

// ─── Test Data ────────────────────────────────────────────────────────────────

const COMPANY_ID = 'cmp_test_001'

const SEEDED_TREE = [
  {
    id: 'grp_assets',
    name: 'Assets',
    parentId: null,
    nature: 'ASSET',
    affectsGP: false,
    children: [
      {
        id: 'grp_current_assets',
        name: 'Current Assets',
        parentId: 'grp_assets',
        nature: 'ASSET',
        affectsGP: false,
        children: [
          {
            id: 'grp_sundry_debtors',
            name: 'Sundry Debtors',
            parentId: 'grp_current_assets',
            nature: 'ASSET',
            affectsGP: false,
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: 'grp_liabilities',
    name: 'Liabilities',
    parentId: null,
    nature: 'LIABILITY',
    affectsGP: false,
    children: [],
  },
]

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/masters/account-groups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session exists', async () => {
    mockAuth.mockResolvedValueOnce(null)

    const response = await GET()
    expect(response.status).toBe(401)

    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when session has no companyId', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'usr_1' } })

    const response = await GET()
    expect(response.status).toBe(401)
  })

  it('fetches account groups scoped to session companyId', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'usr_1', companyId: COMPANY_ID } })
    mockFindMany.mockResolvedValueOnce(SEEDED_TREE)

    await GET()

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: COMPANY_ID }),
      })
    )
  })

  it('returns flat array including all nested children', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'usr_1', companyId: COMPANY_ID } })
    mockFindMany.mockResolvedValueOnce(SEEDED_TREE)

    const response = await GET()
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(Array.isArray(body)).toBe(true)
    // Should have: Assets + Current Assets + Sundry Debtors + Liabilities = 4 total
    expect(body).toHaveLength(4)
  })

  it('each item in response has required fields including affectsGP', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'usr_1', companyId: COMPANY_ID } })
    mockFindMany.mockResolvedValueOnce(SEEDED_TREE)

    const response = await GET()
    const body = await response.json()

    const first = body[0]
    expect(first).toHaveProperty('id')
    expect(first).toHaveProperty('name')
    expect(first).toHaveProperty('parentId')
    expect(first).toHaveProperty('nature')
    expect(first).toHaveProperty('affectsGP')
  })

  it('top-level groups have parentId of null', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'usr_1', companyId: COMPANY_ID } })
    mockFindMany.mockResolvedValueOnce(SEEDED_TREE)

    const response = await GET()
    const body = await response.json()

    const assets = body.find((g: { name: string }) => g.name === 'Assets')
    expect(assets).toBeDefined()
    expect(assets.parentId).toBeNull()
  })

  it('child groups have correct parentId linking to parent', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'usr_1', companyId: COMPANY_ID } })
    mockFindMany.mockResolvedValueOnce(SEEDED_TREE)

    const response = await GET()
    const body = await response.json()

    const currentAssets = body.find((g: { name: string }) => g.name === 'Current Assets')
    expect(currentAssets).toBeDefined()
    expect(currentAssets.parentId).toBe('grp_assets')
  })

  it('nature field is one of ASSET, LIABILITY, INCOME, EXPENSE', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'usr_1', companyId: COMPANY_ID } })
    mockFindMany.mockResolvedValueOnce(SEEDED_TREE)

    const response = await GET()
    const body = await response.json()

    const validNatures = ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE']
    for (const group of body) {
      expect(validNatures).toContain(group.nature)
    }
  })

  it('does not expose data from a different company', async () => {
    // Each session's companyId must be used in the query where clause
    const session1 = { user: { id: 'usr_1', companyId: 'cmp_a' } }
    mockAuth.mockResolvedValueOnce(session1)
    mockFindMany.mockResolvedValueOnce([])

    await GET()

    const callArgs = mockFindMany.mock.calls[0][0]
    expect(callArgs.where.companyId).toBe('cmp_a')
    // Critically: no other companyId should appear in the query
    expect(callArgs.where.companyId).not.toBe(COMPANY_ID)
  })
})
