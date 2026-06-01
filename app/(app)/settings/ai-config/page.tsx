'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, CheckCircle2, Circle } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
import { SectionCard } from '@/components/shared/SectionCard'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { usePermission } from '@/hooks/usePermission'

type AiConfigResponse = {
  voyageKeySet: boolean
  anthropicKeySet: boolean
}

export default function AiConfigPage() {
  const queryClient = useQueryClient()
  const isAdmin = usePermission('settings', 'admin')

  const [voyageKey, setVoyageKey] = useState('')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const { data } = useQuery<AiConfigResponse>({
    queryKey: ['ai-config'],
    queryFn: () => fetch('/api/v1/ai-config').then((r) => r.json()),
    enabled: isAdmin,
  })

  if (!isAdmin) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Access denied. Owner role required.</p>
      </div>
    )
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      if (voyageKey.length > 0) {
        await window.electronAPI?.safeStorageSet('VOYAGE_API_KEY', voyageKey)
      }
      if (anthropicKey.length > 0) {
        await window.electronAPI?.safeStorageSet('ANTHROPIC_API_KEY', anthropicKey)
      }

      const res = await fetch('/api/v1/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voyageKeySet: voyageKey.length > 0 || (data?.voyageKeySet ?? false),
          anthropicKeySet: anthropicKey.length > 0 || (data?.anthropicKeySet ?? false),
        }),
      })

      if (!res.ok) {
        throw new Error('Server error')
      }

      toast.success('API keys saved')
      await queryClient.invalidateQueries({ queryKey: ['ai-config'] })
      setVoyageKey('')
      setAnthropicKey('')
    } catch {
      toast.error('Failed to save keys')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="AI Configuration"
        subtitle="Configure Voyage AI and Anthropic API keys for smart insights and semantic search"
      />

      <SectionCard title="API Keys">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Enter API keys to enable Smart Insights and semantic search. Keys are encrypted and
            stored securely on this machine. Leave a field blank to keep the existing key.
          </p>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-gray-400" />
              <Label htmlFor="voyage-key">Voyage AI API Key</Label>
            </div>
            <Input
              id="voyage-key"
              type="password"
              placeholder="Enter Voyage AI API key"
              value={voyageKey}
              onChange={(e) => setVoyageKey(e.target.value)}
            />
            <div className="flex items-center gap-1.5 text-xs">
              {data?.voyageKeySet ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-green-600">Key configured</span>
                </>
              ) : (
                <>
                  <Circle className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-gray-400">Not configured</span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-gray-400" />
              <Label htmlFor="anthropic-key">Anthropic API Key</Label>
            </div>
            <Input
              id="anthropic-key"
              type="password"
              placeholder="Enter Anthropic API key"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
            />
            <div className="flex items-center gap-1.5 text-xs">
              {data?.anthropicKeySet ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-green-600">Key configured</span>
                </>
              ) : (
                <>
                  <Circle className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-gray-400">Not configured</span>
                </>
              )}
            </div>
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="mt-2">
            {isSaving ? 'Saving...' : 'Save Keys'}
          </Button>
        </div>
      </SectionCard>
    </div>
  )
}
