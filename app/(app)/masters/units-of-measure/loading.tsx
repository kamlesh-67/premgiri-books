import { Skeleton } from '@/components/ui/skeleton'

export default function UnitsOfMeasureLoading() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page header skeleton */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      {/* Table skeleton — 3 rows */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-3 flex gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="border-b border-gray-50 px-4 py-3 flex items-center gap-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}
