'use client'

import { Checkbox } from '@/components/ui/checkbox'

const RESOURCES = ['vouchers', 'reports', 'masters', 'settings', 'users'] as const
const ACTIONS = ['read', 'write', 'admin'] as const

const RESOURCE_LABELS: Record<typeof RESOURCES[number], string> = {
  vouchers: 'Vouchers',
  reports: 'Reports',
  masters: 'Masters',
  settings: 'Settings',
  users: 'Users',
}

type Resource = typeof RESOURCES[number]
type Action = typeof ACTIONS[number]

export interface PermissionGridProps {
  value: Record<string, string[]>
  onChange: (permissions: Record<string, string[]>) => void
  disabled?: boolean
}

function handleCheck(
  current: Record<string, string[]>,
  resource: Resource,
  action: Action,
  checked: boolean
): Record<string, string[]> {
  let actions = [...(current[resource] ?? [])]

  if (checked) {
    if (!actions.includes(action)) actions.push(action)
    // Implied-up cascade
    if (action === 'write' && !actions.includes('read')) actions.push('read')
    if (action === 'admin') {
      if (!actions.includes('read')) actions.push('read')
      if (!actions.includes('write')) actions.push('write')
    }
  } else {
    actions = actions.filter((a) => a !== action)
    // Implied-down cascade
    if (action === 'read') {
      actions = actions.filter((a) => a !== 'write' && a !== 'admin')
    }
    if (action === 'write') {
      actions = actions.filter((a) => a !== 'admin')
    }
  }

  return { ...current, [resource]: actions }
}

export function PermissionGrid({ value, onChange, disabled }: PermissionGridProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-y-1">
        <thead>
          <tr>
            <th className="w-28 pr-4 text-left" />
            {ACTIONS.map((action) => (
              <th
                key={action}
                className="w-20 text-center text-xs font-normal text-muted-foreground uppercase tracking-wide"
              >
                {action}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RESOURCES.map((resource) => (
            <tr key={resource}>
              <td className="w-28 pr-4 text-sm font-medium text-foreground">
                {RESOURCE_LABELS[resource]}
              </td>
              {ACTIONS.map((action) => {
                const checked = value[resource]?.includes(action) ?? false
                return (
                  <td key={action} className="p-3 text-center">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) =>
                        onChange(handleCheck(value, resource, action, Boolean(c)))
                      }
                      disabled={disabled}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      aria-label={`${RESOURCE_LABELS[resource]} ${action}`}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
