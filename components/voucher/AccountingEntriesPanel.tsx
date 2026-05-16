'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { formatINR } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AccountingEntryRow {
  ledgerId: string
  ledgerName: string
  drCr: 'DR' | 'CR'
  amount: string   // Decimal.toFixed(2)
}

export interface AccountingEntriesPanelProps {
  entries: AccountingEntryRow[]
  isBalanced: boolean  // DR total === CR total
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AccountingEntriesPanel({
  entries,
  isBalanced,
}: AccountingEntriesPanelProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Compute DR and CR totals for footer
  const drTotal = entries
    .filter((e) => e.drCr === 'DR')
    .reduce((sum, e) => sum + parseFloat(e.amount), 0)
    .toFixed(2)

  const crTotal = entries
    .filter((e) => e.drCr === 'CR')
    .reduce((sum, e) => sum + parseFloat(e.amount), 0)
    .toFixed(2)

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mt-4"
    >
      {/* Trigger row */}
      <div className="flex items-center justify-between">
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-purple-600 transition-colors">
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Accounting Entries
        </CollapsibleTrigger>

        {/* Balance indicator */}
        {isBalanced ? (
          <span className="text-xs text-green-600 bg-green-50 rounded px-2 py-0.5 font-medium">
            Balanced
          </span>
        ) : (
          <span className="text-xs text-red-600 bg-red-50 rounded px-2 py-0.5 font-medium">
            Unbalanced
          </span>
        )}
      </div>

      <CollapsibleContent>
        <div className="mt-3">
          {/* Unbalanced warning banner */}
          {!isBalanced && (
            <div className="mb-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
              <p className="text-xs text-amber-700">
                These entries don&apos;t balance yet — amounts will be validated before posting
              </p>
            </div>
          )}

          {/* Entries table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Ledger
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[120px]">
                  DR (₹)
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[120px]">
                  CR (₹)
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={`${entry.ledgerId}-${entry.drCr}`}
                  className="border-b border-gray-50 hover:bg-gray-50"
                >
                  <td className="px-4 py-2 text-gray-700">{entry.ledgerName}</td>
                  <td
                    className={cn(
                      'px-4 py-2 text-right tabular-nums',
                      entry.drCr === 'DR' ? 'text-gray-900' : 'text-gray-300'
                    )}
                  >
                    {entry.drCr === 'DR' ? formatINR(entry.amount) : '—'}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-2 text-right tabular-nums',
                      entry.drCr === 'CR' ? 'text-gray-900' : 'text-gray-300'
                    )}
                  >
                    {entry.drCr === 'CR' ? formatINR(entry.amount) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Footer totals row */}
            <tfoot>
              <tr className="bg-gray-50 font-semibold border-t border-gray-100">
                <td className="px-4 py-2 text-gray-700">Total</td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-900">
                  {formatINR(drTotal)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-900">
                  {formatINR(crTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
