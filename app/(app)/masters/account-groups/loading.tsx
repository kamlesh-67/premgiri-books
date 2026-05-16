import { Skeleton } from '@/components/ui/skeleton'

/**
 * loading.tsx — Suspense skeleton for Account Groups page.
 * Shown while AccountGroupsClient hydrates. Mirrors the Accordion structure
 * with 4 rows (one per top-level group: Assets, Liabilities, Income, Expense).
 */
export default function AccountGroupsLoading() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page header skeleton */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>

      {/* Read-only banner skeleton */}
      <Skeleton className="h-11 w-full rounded-md" />

      {/* Accordion skeleton — 4 top-level nodes */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="px-6 py-2 space-y-0">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="flex items-center gap-3 py-4 border-b border-gray-100 last:border-b-0"
            >
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-16 rounded" />
              <div className="ml-auto">
                <Skeleton className="h-4 w-4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
