'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionCard } from '@/components/shared/SectionCard'
import { captureEvent } from '@/lib/analytics'
import { cn } from '@/lib/utils'

type InsightType = 'top_customer' | 'biggest_expense' | 'gst_trend'

interface Insight {
  type: InsightType
  text: string
  generatedAt: string
}

interface InsightsResponse {
  insights: Insight[]
  cached: boolean
  error?: string
}

interface SmartInsightsWidgetProps {
  className?: string
}

function minutesAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
}

const insightTypeColors: Record<InsightType, string> = {
  top_customer: 'bg-green-400',
  biggest_expense: 'bg-amber-400',
  gst_trend: 'bg-blue-400',
}

export function SmartInsightsWidget({ className }: SmartInsightsWidgetProps) {
  const queryClient = useQueryClient()
  const [bypassCache, setBypassCache] = useState(false)

  const { data, isLoading, isFetching, isError } = useQuery<InsightsResponse>({
    queryKey: ['insights'],
    queryFn: async ({ signal }) => {
      const url = bypassCache ? '/api/v1/insights?refresh=1' : '/api/v1/insights'
      const r = await fetch(url, { signal })
      if (!r.ok) throw new Error('insights fetch failed')
      return r.json() as Promise<InsightsResponse>
    },
    staleTime: 15 * 60 * 1000,
  })

  // Fire insight_viewed once per fresh data load
  useEffect(() => {
    if (data && data.insights.length > 0) {
      captureEvent('insight_viewed', { count: data.insights.length })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.insights[0]?.generatedAt])

  // Reset bypass flag after fetch completes
  useEffect(() => {
    if (!isFetching && bypassCache) {
      setBypassCache(false)
    }
  }, [isFetching, bypassCache])

  const onRefresh = async () => {
    captureEvent('insight_refreshed', { source: 'widget' })
    setBypassCache(true)
    await queryClient.invalidateQueries({ queryKey: ['insights'] })
  }

  const refreshButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={onRefresh}
      disabled={isFetching}
      aria-label="Refresh AI insights"
    >
      <RotateCcw className={cn('h-4 w-4 mr-1.5', isFetching && 'animate-spin')} />
      Refresh Insights
    </Button>
  )

  return (
    <SectionCard title="Smart Insights" action={refreshButton} className={className}>
      <div className={cn('transition-opacity', isFetching && 'opacity-50 pointer-events-none')}>
        {isLoading ? (
          /* Loading state — 3 skeleton rows */
          <div className="space-y-3 px-4 py-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-1 h-5 bg-gray-200 animate-pulse rounded-full" />
                <div className="h-4 bg-gray-100 animate-pulse rounded flex-1" />
              </div>
            ))}
          </div>
        ) : isError || data?.error ? (
          /* Error state */
          <div className="bg-red-50 rounded-md px-4 py-3 mx-4 my-3 text-sm text-red-700">
            Unable to generate insights right now. Try refreshing.
          </div>
        ) : data && data.insights.length === 0 ? (
          /* Empty state */
          <div className="text-sm text-gray-500 text-center py-6">
            No transactions yet — insights will appear once you&apos;ve recorded some sales.
          </div>
        ) : data && data.insights.length > 0 ? (
          /* Success state — 3 insight rows */
          <>
            <div className="divide-y divide-gray-100">
              {data.insights.map((insight) => (
                <div key={insight.type} className="flex items-start gap-3 px-4 py-3">
                  <div
                    className={cn(
                      'w-1 self-stretch rounded-full flex-shrink-0',
                      insightTypeColors[insight.type],
                    )}
                  />
                  <p className="text-sm text-gray-700 leading-relaxed flex-1">
                    {insight.text}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 px-4 pb-3">
              {data.cached
                ? `Generated ${minutesAgo(data.insights[0].generatedAt)} minutes ago · Updates every 15 min`
                : 'Generated just now · Updates every 15 min'}
            </p>
          </>
        ) : null}
      </div>
    </SectionCard>
  )
}
