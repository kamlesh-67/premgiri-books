'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { useUiStore } from '@/lib/stores/uiStore'
import type { UiMode } from '@/lib/stores/uiStore'

export function SimpleModeToggle() {
  const { uiMode, setUiMode } = useUiStore()
  const { update } = useSession()
  const [isSaving, setIsSaving] = useState(false)

  async function handleToggle(newMode: UiMode) {
    if (newMode === uiMode || isSaving) return

    const prevMode = uiMode
    setUiMode(newMode) // optimistic update

    setIsSaving(true)
    try {
      const res = await fetch('/api/v1/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uiMode: newMode }),
      })
      if (!res.ok) throw new Error('Save failed')
      // Refresh JWT so middleware reads the updated uiMode on next navigation
      await update({ uiMode: newMode })
      toast.success(
        `Switched to ${newMode === 'simple' ? 'Simple' : 'Advanced'} Mode.`,
        { duration: 2000 }
      )
    } catch {
      setUiMode(prevMode) // revert on failure
      toast.error("Couldn't save preference. Please try again.", {
        duration: 4000,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-md" role="group" aria-label="Switch display mode">
      <button
        onClick={() => handleToggle('simple')}
        disabled={isSaving}
        aria-pressed={uiMode === 'simple'}
        className={
          uiMode === 'simple'
            ? 'px-3 py-1 text-sm rounded-[4px] bg-white text-gray-900 font-medium shadow-sm transition-colors'
            : 'px-3 py-1 text-sm rounded-[4px] text-gray-500 hover:text-gray-700 transition-colors'
        }
      >
        Simple
      </button>
      <button
        onClick={() => handleToggle('advanced')}
        disabled={isSaving}
        aria-pressed={uiMode === 'advanced'}
        className={
          uiMode === 'advanced'
            ? 'px-3 py-1 text-sm rounded-[4px] bg-white text-gray-900 font-medium shadow-sm transition-colors'
            : 'px-3 py-1 text-sm rounded-[4px] text-gray-500 hover:text-gray-700 transition-colors'
        }
      >
        Advanced
      </button>
    </div>
  )
}
