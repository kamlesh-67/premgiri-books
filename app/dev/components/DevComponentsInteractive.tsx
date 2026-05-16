'use client'
import { useState } from 'react'
import { SearchInput } from '@/components/shared/SearchInput'
import { FilterTabs } from '@/components/shared/FilterTabs'
import { DateRangePicker } from '@/components/shared/DateRangePicker'
import type { DateRange } from 'react-day-picker'

export function DevComponentsInteractive() {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [dateRange, setDateRange] = useState<DateRange | undefined>()

  return (
    <div className="space-y-6">
      {/* SearchInput */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-700 border-b pb-2">SearchInput (interactive)</h2>
        <SearchInput value={search} onChange={setSearch} placeholder="Search ledgers..." className="max-w-sm" />
        {search && <p className="text-sm text-gray-500">Searching for: &quot;{search}&quot;</p>}
      </section>

      {/* FilterTabs */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-700 border-b pb-2">FilterTabs (interactive)</h2>
        <FilterTabs
          tabs={[
            { label: 'All', value: 'all', count: 42 },
            { label: 'Posted', value: 'posted', count: 38 },
            { label: 'Draft', value: 'draft', count: 3 },
            { label: 'Cancelled', value: 'cancelled', count: 1 },
          ]}
          value={tab}
          onChange={setTab}
        />
        <p className="text-sm text-gray-500">Active tab: {tab}</p>
      </section>

      {/* DateRangePicker */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-700 border-b pb-2">DateRangePicker (interactive)</h2>
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Select date range" />
        {dateRange?.from && (
          <p className="text-sm text-gray-500">
            Selected: {dateRange.from.toLocaleDateString()} &ndash; {dateRange.to?.toLocaleDateString() ?? 'end'}
          </p>
        )}
      </section>
    </div>
  )
}
