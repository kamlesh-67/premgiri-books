import { Skeleton } from '@/components/ui/skeleton'

export default function PartiesLoading() {
  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Page header skeleton */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      {/* Filter tabs skeleton */}
      <Skeleton className="h-10 w-64 rounded-lg" />
      {/* Table skeleton */}
      <Skeleton className="h-[400px] rounded-lg" />
    </div>
  )
}
