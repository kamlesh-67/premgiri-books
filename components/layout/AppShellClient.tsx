'use client'

import { useState, useEffect } from 'react'
import { CommandPalette } from '@/components/shared/CommandPalette'
import { ShortcutsPanel } from '@/components/shared/ShortcutsPanel'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

export function AppShellClient() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // Listen for the custom event dispatched by TopbarSearchTrigger
  useEffect(() => {
    const handler = () => setPaletteOpen(true)
    window.addEventListener('open-command-palette', handler)
    return () => window.removeEventListener('open-command-palette', handler)
  }, [])

  useKeyboardShortcuts({
    openPalette: () => setPaletteOpen(true),
    openShortcuts: () => setShortcutsOpen(true),
  })

  return (
    <>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ShortcutsPanel open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  )
}
