import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionCardProps {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  noPadding?: boolean
}

export function SectionCard({ title, action, children, className, noPadding }: SectionCardProps) {
  return (
    <div className={cn(
      'bg-white rounded-lg shadow-sm border border-gray-100',
      className
    )}>
      {(title || action) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          {title && <h2 className="text-base font-semibold text-gray-800">{title}</h2>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>{children}</div>
    </div>
  )
}
