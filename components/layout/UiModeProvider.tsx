'use client'
/**
 * UiModeProvider — hydrates Zustand uiMode from server-resolved session.
 *
 * WHY THIS EXISTS: AppSidebar is a Client Component that reads uiMode from Zustand.
 * On first render, Zustand defaults to 'simple'. The server knows the real mode from
 * the session JWT. Without hydration, the sidebar flickers on Advanced Mode users.
 *
 * The app layout reads uiMode from the x-ui-mode header (injected by middleware)
 * and passes it here as initialMode. This component calls setUiMode() synchronously
 * before the first paint, preventing the flicker.
 */
import { useEffect } from 'react'
import { useUiStore } from '@/lib/stores/uiStore'
import type { UiMode } from '@/lib/stores/uiStore'

interface UiModeProviderProps {
  initialMode: UiMode
}

export function UiModeProvider({ initialMode }: UiModeProviderProps) {
  const setUiMode = useUiStore((s) => s.setUiMode)

  useEffect(() => {
    setUiMode(initialMode)
  }, [initialMode, setUiMode])

  return null
}
