import { Skeleton } from '@/components/ui/skeleton'

export default function StockItemsLoading() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page header skeleton */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      {/* Table skeleton */}
      <Skeleton className="h-[400px] rounded-lg" />
    </div>
  )
}
