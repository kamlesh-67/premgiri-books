'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { usePermission } from '@/hooks/usePermission'

interface RoleRow {
  id: string
  name: string
  permissions: Record<string, string[]>
  userCount: number
}

function getPermissionSummary(permissions: Record<string, string[]>): string {
  const resourceLabels: Record<string, string> = {
    vouchers: 'Vouchers',
    reports: 'Reports',
    masters: 'Masters',
    settings: 'Settings',
    users: 'Users',
  }

  const granted = Object.entries(permissions)
    .filter(([, actions]) => actions.length > 0)
    .map(([resource]) => resourceLabels[resource] ?? resource)

  return granted.length > 0 ? granted.join(', ') : 'No permissions'
}

export default function RolesPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const canRead = usePermission('settings', 'read')
  const canAdmin = usePermission('settings', 'admin')

  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null)

  const { data: roles = [], isLoading } = useQuery<RoleRow[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const r = await fetch('/api/v1/roles')
      if (!r.ok) throw new Error('Failed to load roles')
      return r.json()
    },
    enabled: canRead,
  })

  const deleteMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const r = await fetch(`/api/v1/roles/${roleId}`, { method: 'DELETE' })
      const body = await r.json()
      if (!r.ok) {
        throw new Error((body?.error as string | undefined) ?? 'Failed to delete role')
      }
      return body
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Role deleted')
      setDeleteTarget(null)
    },
    onError: (e) => {
      toast.error(e.message)
      setDeleteTarget(null)
    },
  })

  if (!canRead) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to view this page. Contact your Admin.
        </p>
      </div>
    )
  }

  const adminRoleCount = roles.filter((r) =>
    r.permissions['settings']?.includes('admin')
  ).length

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Roles & Permissions"
        subtitle="Control what each team member can access"
        actions={
          canAdmin ? (
            <Button size="sm" onClick={() => router.push('/settings/roles/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Add Role
            </Button>
          ) : undefined
        }
      />

      <SectionCard>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Loading…</p>
        ) : roles.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-base font-medium text-foreground">No roles defined</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a role to define exactly what your team members can access.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((role) => {
              const isLastAdmin =
                adminRoleCount === 1 &&
                role.permissions['settings']?.includes('admin')

              return (
                <div
                  key={role.id}
                  className="bg-surface rounded-lg shadow-card border border-border p-5"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-base font-semibold text-foreground">
                        {role.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {role.userCount} {role.userCount === 1 ? 'user' : 'users'}
                      </p>
                    </div>
                  </div>

                  {/* Permission summary chips */}
                  <div className="flex flex-wrap gap-1 mb-4 min-h-[1.5rem]">
                    {Object.entries(role.permissions)
                      .filter(([, v]) => v.length > 0)
                      .map(([resource]) => (
                        <span
                          key={resource}
                          className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs"
                        >
                          {resource}
                        </span>
                      ))}
                    {getPermissionSummary(role.permissions) === 'No permissions' && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/settings/roles/${role.id}`)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={isLastAdmin}
                      title={isLastAdmin ? 'You cannot delete the last Admin role.' : undefined}
                      onClick={() => !isLastAdmin && setDeleteTarget(role)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      {/* Delete confirmation AlertDialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete role &apos;{deleteTarget?.name}&apos;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.userCount > 0
                ? `${deleteTarget.userCount} team ${deleteTarget.userCount === 1 ? 'member' : 'members'} will need to be reassigned to a different role first.`
                : 'This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              Delete Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
