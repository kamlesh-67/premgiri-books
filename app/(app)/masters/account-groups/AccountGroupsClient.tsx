'use client'

import { useQuery } from '@tanstack/react-query'
import { Lock, ChevronRight, Info } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { SectionCard } from '@/components/shared/SectionCard'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AccountGroupFlat {
  id: string
  name: string
  parentId: string | null
  nature: 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE'
  affectsGP: boolean
}

// ─── Tree builder ─────────────────────────────────────────────────────────────

/**
 * Rebuild a map of parentId → children from the flat API response.
 * The flat array keeps parentId references so we can reconstruct the tree
 * client-side without needing a recursive API.
 */
function buildByParentMap(flat: AccountGroupFlat[]): Map<string | null, AccountGroupFlat[]> {
  const byParent = new Map<string | null, AccountGroupFlat[]>()
  flat.forEach(g => {
    const key = g.parentId
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(g)
  })
  return byParent
}

// ─── Nature badge ─────────────────────────────────────────────────────────────

const NATURE_LABELS: Record<AccountGroupFlat['nature'], string> = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
}

function NatureBadge({ nature }: { nature: AccountGroupFlat['nature'] }) {
  return (
    <span className="bg-gray-100 text-gray-600 text-xs rounded px-2 py-0.5 font-normal ml-2">
      {NATURE_LABELS[nature]}
    </span>
  )
}

// ─── Recursive node renderer ──────────────────────────────────────────────────

interface RecursiveNodeProps {
  node: AccountGroupFlat
  byParent: Map<string | null, AccountGroupFlat[]>
  depth: number
}

function RecursiveNode({ node, byParent, depth }: RecursiveNodeProps) {
  const children = byParent.get(node.id) ?? []
  const hasChildren = children.length > 0

  if (hasChildren) {
    // Intermediate node — render nested Accordion
    return (
      <Accordion type="multiple" className="w-full">
        <AccordionItem value={node.id} className="border-b-0">
          <AccordionTrigger className="text-sm text-gray-700 font-medium py-2 hover:no-underline">
            <span className="flex items-center gap-1">
              {node.name}
              <Lock className="h-3 w-3 text-gray-300" />
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="pl-6">
              {children.map(child => (
                <RecursiveNode
                  key={child.id}
                  node={child}
                  byParent={byParent}
                  depth={depth + 1}
                />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    )
  }

  // Leaf node
  return (
    <div className="text-sm text-gray-600 py-1.5 flex items-center gap-2">
      <ChevronRight className="h-3 w-3 text-gray-300 mr-1 flex-shrink-0" />
      {node.name}
      <Lock className="h-3 w-3 text-gray-300 ml-auto" />
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function AccountGroupsSkeleton() {
  return (
    <div className="space-y-3 p-2">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex items-center gap-3 py-4 border-b border-gray-100">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-5 w-16 rounded" />
        </div>
      ))}
    </div>
  )
}

// ─── Main client component ───────────────────────────────────────────────────

/**
 * AccountGroupsClient — Advanced Mode only (server-redirected for Simple Mode)
 * Shows standard seeded account hierarchy as expandable/collapsible shadcn Accordion tree.
 * Read-only per D-22 (Phase 1 — all groups are system-seeded).
 */
export default function AccountGroupsClient() {
  const { data: flat, isLoading, isError } = useQuery<AccountGroupFlat[]>({
    queryKey: ['account-groups'],
    queryFn: async () => {
      const res = await fetch('/api/v1/masters/account-groups')
      if (!res.ok) throw new Error('Failed to load account groups')
      return res.json()
    },
  })

  // Build parent map once for rendering
  const byParent: Map<string | null, AccountGroupFlat[]> = flat
    ? buildByParentMap(flat)
    : new Map<string | null, AccountGroupFlat[]>()
  const topLevelGroups: AccountGroupFlat[] = byParent.get(null) ?? []

  // Stable default open values — all four top-level nodes start expanded
  const defaultValues = topLevelGroups.map(g => g.id)

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Page header — no action button (read-only per D-22) */}
      <PageHeader
        title="Account Groups"
        subtitle="Standard account hierarchy — read only in this release"
      />

      {/* Read-only informational banner — UI-SPEC 9.8 */}
      <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-md p-3 text-sm text-gray-500">
        <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />
        Account groups are read-only. Custom account groups can be added from Settings in a future release.
      </div>

      {/* Account group tree */}
      <SectionCard title="Account Hierarchy" noPadding>
        <div className="px-6 py-2">
          {isLoading && <AccountGroupsSkeleton />}

          {isError && (
            <p className="text-sm text-red-600 py-4">
              Failed to load account groups. Please refresh the page.
            </p>
          )}

          {!isLoading && !isError && flat && (
            <Accordion
              type="multiple"
              defaultValue={defaultValues}
              className="w-full"
            >
              {topLevelGroups.map(group => {
                const children = byParent.get(group.id) ?? []
                return (
                  <AccordionItem key={group.id} value={group.id}>
                    <AccordionTrigger className="text-sm font-semibold text-gray-900 hover:no-underline">
                      <span className="flex items-center gap-2">
                        {group.name}
                        <NatureBadge nature={group.nature} />
                        <Lock className="h-3 w-3 text-gray-300" />
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pl-6">
                        {children.map(child => (
                          <RecursiveNode
                            key={child.id}
                            node={child}
                            byParent={byParent}
                            depth={1}
                          />
                        ))}
                        {children.length === 0 && (
                          <p className="text-xs text-gray-400 py-2">No sub-groups</p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
