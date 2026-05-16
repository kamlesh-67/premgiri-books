import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type DeltaType = 'positive' | 'negative' | 'neutral'

interface KPICardProps {
  title: string
  value: string
  delta?: string
  deltaType?: DeltaType
  icon: LucideIcon
  iconBg?: string
  iconColor?: string
  className?: string
}

const deltaColors: Record<DeltaType, string> = {
  positive: 'text-green-600',
  negative: 'text-red-600',
  neutral: 'text-gray-500',
}

export function KPICard({
  title,
  value,
  delta,
  deltaType = 'neutral',
  icon: Icon,
  iconBg = 'bg-purple-100',
  iconColor = 'text-purple-600',
  className,
}: KPICardProps) {
  return (
    <div className={cn(
      'bg-white rounded-lg shadow-sm border border-gray-100 p-5',
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 truncate">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
          {delta && (
            <p className={cn('mt-1 text-xs', deltaColors[deltaType])}>{delta}</p>
          )}
        </div>
        <div className={cn('ml-4 flex-shrink-0 p-2 rounded-full', iconBg)}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
      </div>
    </div>
  )
}
