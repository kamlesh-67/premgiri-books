'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUiStore } from '@/lib/stores/uiStore'
import AccountGroupsClient from './AccountGroupsClient'

export default function AccountGroupsPage() {
  const { uiMode } = useUiStore()
  const router = useRouter()

  useEffect(() => {
    if (uiMode === 'simple') {
      router.replace('/dashboard')
    }
  }, [uiMode, router])

  if (uiMode === 'simple') return null

  return <AccountGroupsClient />
}
