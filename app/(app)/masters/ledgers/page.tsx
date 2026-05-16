'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUiStore } from '@/lib/stores/uiStore'
import LedgersClient from './LedgersClient'

export default function LedgersPage() {
  const { uiMode } = useUiStore()
  const router = useRouter()

  useEffect(() => {
    if (uiMode === 'simple') {
      router.replace('/masters/parties')
    }
  }, [uiMode, router])

  if (uiMode === 'simple') return null

  return <LedgersClient />
}
