'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShortcutsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ---------------------------------------------------------------------------
// Shortcut data
// ---------------------------------------------------------------------------

interface ShortcutRow {
  keys: string[]
  action: string
}

const SHORTCUTS: ShortcutRow[] = [
  { keys: ['⌘K', 'Ctrl+K'], action: 'Open command palette / search' },
  { keys: ['⌘/', 'Ctrl+/'], action: 'Show keyboard shortcuts' },
  { keys: ['F8'], action: 'New Sales Invoice' },
  { keys: ['F9'], action: 'New Purchase Invoice' },
  { keys: ['F6'], action: 'New Receipt' },
  { keys: ['F5'], action: 'New Payment' },
  { keys: ['F7'], action: 'New Journal Entry' },
  { keys: ['Esc'], action: 'Close dialog / palette' },
]

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

function KbdKey({ label }: { label: string }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 text-xs font-mono border border-gray-300">
      {label}
    </kbd>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShortcutsPanel({ open, onOpenChange }: ShortcutsPanelProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>

        <table className="w-full text-sm mt-2">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left pb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Shortcut
              </th>
              <th className="text-left pb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {SHORTCUTS.map((row) => (
              <tr key={row.action} className="py-2">
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-1 flex-wrap">
                    {row.keys.map((key, idx) => (
                      <span key={key} className="flex items-center gap-1">
                        {idx > 0 && (
                          <span className="text-gray-400 text-xs">or</span>
                        )}
                        <KbdKey label={key} />
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-2.5 text-gray-700">{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  )
}
