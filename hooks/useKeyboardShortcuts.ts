'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseKeyboardShortcutsOptions {
  openPalette: () => void
  openShortcuts: () => void
}

// ---------------------------------------------------------------------------
// Voucher shortcut map (F5–F9)
// ---------------------------------------------------------------------------

const VOUCHER_SHORTCUTS: Record<string, string> = {
  F5: '/payment/new',
  F6: '/receipt/new',
  F7: '/journal/new',
  F8: '/sales-invoice/new',
  F9: '/purchase-invoice/new',
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void {
  const router = useRouter()
  const { openPalette, openShortcuts } = options

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      // F5–F9 voucher navigation shortcuts
      if (VOUCHER_SHORTCUTS[e.key] !== undefined) {
        e.preventDefault()
        router.push(VOUCHER_SHORTCUTS[e.key])
        return
      }

      const isModifier = e.metaKey || e.ctrlKey

      // ⌘K / Ctrl+K → open command palette
      if (isModifier && e.key === 'k') {
        e.preventDefault()
        openPalette()
        return
      }

      // ⌘/ / Ctrl+/ → open shortcuts help panel
      if (isModifier && e.key === '/') {
        e.preventDefault()
        openShortcuts()
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openPalette, openShortcuts, router])
}
