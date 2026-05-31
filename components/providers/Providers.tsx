'use client'
import { Toaster } from 'sonner'
import { QueryProvider } from '@/components/providers/QueryProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      {children}
      <Toaster position="bottom-right" richColors closeButton />
    </QueryProvider>
  )
}
