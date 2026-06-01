import { useState, useEffect } from 'react'

/**
 * useOnlineStatus — checks window.electronAPI.isOnline() on mount.
 * Returns true in browser dev mode (no Electron) as a safe default.
 * AI widgets use this to gate AI calls and show degraded UI when offline.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(true)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.isOnline) {
      window.electronAPI.isOnline().then((result) => {
        setIsOnline(result)
      })
    }
  }, [])

  return isOnline
}
