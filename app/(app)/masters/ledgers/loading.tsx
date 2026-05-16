import { Skeleton } from '@/components/ui/skeleton'

export default function LedgersLoading() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page header skeleton */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      {/* Filter tabs skeleton */}
      <Skeleton className="h-10 w-96 rounded-lg" />
      {/* Table skeleton — 5 rows */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-0">
          {/* Table header */}
          <div className="flex px-4 py-3 border-b border-gray-100 gap-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-48 ml-auto" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>
          {/* Table rows */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center px-4 py-3 border-b border-gray-50 gap-4"
            >
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-48 ml-auto" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <div className="flex gap-1">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
