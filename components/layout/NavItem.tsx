'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItemProps {
  href: string
  label: string
  icon?: LucideIcon
  shortcut?: string
}

export function NavItem({ href, label, icon: Icon, shortcut }: NavItemProps) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm transition-colors',
        isActive
          ? 'bg-purple-50 text-purple-700 font-medium'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      )}
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-purple-600' : 'text-gray-400')} />}
        <span>{label}</span>
      </div>
      {shortcut && (
        <span className="text-xs text-gray-400 font-mono">{shortcut}</span>
      )}
    </Link>
  )
}
