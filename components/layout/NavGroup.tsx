import type { ReactNode } from 'react'

interface NavGroupProps {
  label: string
  children: ReactNode
}

export function NavGroup({ label, children }: NavGroupProps) {
  return (
    <div className="space-y-0.5">
      <p className="px-3 py-1 text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
      {children}
    </div>
  )
}
