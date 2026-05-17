'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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

interface RoleDetail {
  id: string
  name: string
  permissions: Record<string, string[]>
  userCount: number
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function EditRolePage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const qc = useQueryClient()
  const canAdmin = usePermission('settings', 'admin')

  const [name, setName] = useState('')
  const [permissions, setPermissions] = useState<Record<string, string[]>>(EMPTY_PERMISSIONS)
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const { data: role, isLoading } = useQuery<RoleDetail>({
    queryKey: ['role', id],
    queryFn: async () => {
      const r = await fetch(`/api/v1/roles/${id}`)
      if (!r.ok) throw new Error('Role not found')
      return r.json()
    },
    enabled: canAdmin,
  })

  // Populate form once role data loads
  useEffect(() => {
    if (role && !hydrated) {
      setName(role.name)
      setPermissions({ ...EMPTY_PERMISSIONS, ...role.permissions })
      setHydrated(true)
    }
  }, [role, hydrated])

  if (!canAdmin) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to view this page. Contact your Admin.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
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
      const r = await fetch(`/api/v1/roles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), permissions }),
      })
      const body = await r.json()
      if (!r.ok) {
        toast.error((body?.error as string | undefined) ?? 'Failed to save role')
        return
      }
      qc.invalidateQueries({ queryKey: ['roles'] })
      qc.invalidateQueries({ queryKey: ['role', id] })
      toast.success('Role saved')
      router.push('/settings/roles')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const r = await fetch(`/api/v1/roles/${id}`, { method: 'DELETE' })
      const body = await r.json()
      if (!r.ok) {
        toast.error((body?.error as string | undefined) ?? 'Failed to delete role')
        setDeleteOpen(false)
        return
      }
      qc.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Role deleted')
      router.push('/settings/roles')
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title={role?.name ?? 'Edit Role'}
        subtitle="Update role name and permissions"
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
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive ml-auto"
            onClick={() => setDeleteOpen(true)}
            disabled={saving}
          >
            Delete Role
          </Button>
        </div>
      </SectionCard>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role &apos;{role?.name}&apos;?</AlertDialogTitle>
            <AlertDialogDescription>
              {role && role.userCount > 0
                ? `${role.userCount} team ${role.userCount === 1 ? 'member' : 'members'} will need to be reassigned to a different role first.`
                : 'This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete Role'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
