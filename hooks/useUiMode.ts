'use client'

import { useUiStore } from '@/lib/stores/uiStore'

/**
 * Convenience hook that returns the current UI mode (simple | advanced).
 * Wraps the Zustand uiStore so consumers don't need to know the store shape.
 */
export function useUiMode(): { mode: 'simple' | 'advanced' } {
  const uiMode = useUiStore((state) => state.uiMode)
  return { mode: uiMode }
}
