'use client'

import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function TopbarSearchTrigger() {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      aria-label="Search (⌘K)"
      onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
    >
      <Search className="h-4 w-4 text-gray-500" />
    </Button>
  )
}
