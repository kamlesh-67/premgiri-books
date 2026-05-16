import { Decimal } from 'decimal.js'
import { cn } from '@/lib/utils'
import { formatINR } from '@/lib/utils/format'

interface AmountDisplayProps {
  amount: number | Decimal | string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  colorBySign?: boolean
}

const sizeClasses = {
  sm:  'text-sm tabular-nums',
  md:  'text-base tabular-nums',
  lg:  'text-2xl font-bold tabular-nums',
  xl:  'text-3xl font-bold tabular-nums',
}

export function AmountDisplay({ amount, size = 'md', className, colorBySign }: AmountDisplayProps) {
  const formatted = formatINR(amount)
  const isNegative = new Decimal(amount.toString()).lt(0)
  const colorClass = colorBySign
    ? isNegative ? 'text-red-700' : 'text-green-700'
    : 'text-gray-900'

  return (
    <span className={cn(sizeClasses[size], colorClass, className)}>
      {formatted}
    </span>
  )
}
