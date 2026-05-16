'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SearchResultType = 'ledger' | 'voucher' | 'party' | 'stockItem'

interface SearchResult {
  id: string
  type: SearchResultType
  label: string
  sublabel?: string
  href: string
}

interface SearchResponse {
  results: SearchResult[]
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_ORDER: SearchResultType[] = ['ledger', 'voucher', 'party', 'stockItem']

const GROUP_LABELS: Record<SearchResultType, string> = {
  ledger: 'Ledgers',
  voucher: 'Vouchers',
  party: 'Parties',
  stockItem: 'Stock Items',
}

const DEBOUNCE_MS = 200

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Reset query when palette closes
  useEffect(() => {
    if (!open) {
      setQuery('')
    }
  }, [open])

  // Debounced search effect
  useEffect(() => {
    const trimmed = query.trim()

    if (trimmed === '') {
      setResults([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    const timeoutId = setTimeout(async () => {
      try {
        const url = `/api/v1/search?q=${encodeURIComponent(trimmed)}&limit=10`
        const response = await fetch(url)
        if (!response.ok) {
          setResults([])
          return
        }
        const data = (await response.json()) as SearchResponse
        setResults(data.results ?? [])
      } catch {
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [query])

  const handleSelect = useCallback(
    (href: string) => {
      router.push(href)
      onOpenChange(false)
    },
    [router, onOpenChange]
  )

  // Group results by type in the canonical order
  const grouped = TYPE_ORDER.reduce<Record<SearchResultType, SearchResult[]>>(
    (acc, type) => {
      acc[type] = results.filter((r) => r.type === type)
      return acc
    },
    { ledger: [], voucher: [], party: [], stockItem: [] }
  )

  const hasResults = results.length > 0

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search ledgers, vouchers, parties..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isLoading
            ? 'Searching...'
            : query.trim()
              ? 'No results found.'
              : 'Type to search...'}
        </CommandEmpty>

        {hasResults &&
          TYPE_ORDER.map((type) => {
            const items = grouped[type]
            if (items.length === 0) return null

            return (
              <CommandGroup key={type} heading={GROUP_LABELS[type]}>
                {items.map((result) => (
                  <CommandItem
                    key={result.id}
                    value={`${result.type}-${result.id}-${result.label}`}
                    onSelect={() => handleSelect(result.href)}
                  >
                    <span className="font-medium text-gray-900">{result.label}</span>
                    {result.sublabel && (
                      <span className="text-xs text-gray-400 ml-2">{result.sublabel}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )
          })}
      </CommandList>
    </CommandDialog>
  )
}
