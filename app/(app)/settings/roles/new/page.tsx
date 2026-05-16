'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/primitives/PageHeader'
import { SectionCard } from '@/components/primitives/SectionCard'
import { PermissionGrid } from '@/components/settings/PermissionGrid'
import { usePermission } from '@/hooks/usePermission'

const EMPTY_PERMISSIONS: Record<string, string[]> = {
  vouchers: [],
  reports: [],
  masters: [],
  settings: [],
  users: [],
}

export default function NewRolePage() {
  const router = useRouter()
  const canAdmin = usePermission('settings', 'admin')

  const [name, setName] = useState('')
  const [permissions, setPermissions] = useState<Record<string, string[]>>(EMPTY_PERMISSIONS)
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  if (!canAdmin) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to view this page. Contact your Admin.
        </p>
      </div>
    )
  }

  async function handleSave() {
    if (!name.trim()) {
      setNameError('Role name is required.')
      return
    }
    setNameError(null)

    setSaving(true)
    try {
      const r = await fetch('/api/v1/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), permissions }),
      })
      const body = await r.json()
      if (!r.ok) {
        toast.error((body?.error as string | undefined) ?? 'Failed to create role')
        return
      }
      toast.success('Role created')
      router.push('/settings/roles')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="New Role"
        subtitle="Define a name and permission set for this role"
      />

      <SectionCard title="Role Details">
        <div className="space-y-1.5 max-w-sm">
          <Label htmlFor="role-name">Role Name</Label>
          <Input
            id="role-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setNameError(null)
            }}
            placeholder="e.g. Senior Accountant"
          />
          {nameError && <p className="text-sm text-destructive">{nameError}</p>}
        </div>
      </SectionCard>

      <SectionCard title="Permissions">
        <PermissionGrid value={permissions} onChange={setPermissions} />

        <div className="flex gap-3 mt-6">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Role'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push('/settings/roles')}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      </SectionCard>
    </div>
  )
}
