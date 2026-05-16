'use client'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function GodownsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[400px] gap-4">
      <p className="text-base font-semibold text-gray-800">
        Something went wrong loading godowns.
      </p>
      <p className="text-sm text-gray-500">Your data is safe. Try refreshing the page.</p>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  )
}
