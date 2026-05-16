'use client'
import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'sonner'
import { QueryProvider } from '@/components/providers/QueryProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <QueryProvider>
        {children}
      </QueryProvider>
      <Toaster position="bottom-right" richColors closeButton />
    </SessionProvider>
  )
}
