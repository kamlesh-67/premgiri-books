'use client'
import { cn } from '@/lib/utils'

interface Tab<T extends string = string> {
  label: string
  value: T
  count?: number
}

interface FilterTabsProps<T extends string = string> {
  tabs: Tab<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function FilterTabs<T extends string = string>({ tabs, value, onChange, className }: FilterTabsProps<T>) {
  return (
    <div className={cn('flex gap-1 bg-gray-100 p-1 rounded-lg', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          type="button"
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            value === tab.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded-full',
              value === tab.value ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-600'
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
