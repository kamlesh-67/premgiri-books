import { cn } from '@/lib/utils'

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  POSTED:              { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Posted' },
  PAID:                { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Paid' },
  FILED:               { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Filed' },
  ACTIVE:              { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Active' },
  APPROVED:            { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Approved' },
  CLEARED:             { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Cleared' },
  DRAFT:               { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Draft' },
  NOT_FILED:           { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Not Filed' },
  INACTIVE:            { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Inactive' },
  CLOSED:              { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Closed' },
  EXPORTED:            { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Exported' },
  CANCELLED:           { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Cancelled' },
  OVERDUE:             { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Overdue' },
  BOUNCED:             { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Bounced' },
  UPLOADED:            { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Uploaded' },
  PROCESSING:          { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Processing' },
  PARTIALLY_FULFILLED: { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Partial' },
  PENDING:             { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Pending' },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', label: status }
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
      config.bg, config.text, className
    )}>
      {config.label}
    </span>
  )
}
