'use client'

import { useState } from 'react'
import { Users, UserCheck, Pencil, UserMinus, KeyRound } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { KpiCard } from '@/components/primitives/KpiCard'
import { StatusBadge } from '@/components/primitives/StatusBadge'
import { DataTable, type Column } from '@/components/primitives/DataTable'
import { Toolbar } from '@/components/primitives/Toolbar'
import { UserDialog } from '@/components/settings/UserDialog'
import { ResetPasswordDialog } from '@/components/settings/ResetPasswordDialog'
import { usePermission } from '@/hooks/usePermission'
import { useUiStore } from '@/lib/stores/uiStore'

interface UserRow {
  id: string
  name: string
  email: string
  roleId: string | null
  roleName: string | null
  isActive: boolean
  lastLogin: string | null
  createdAt: string
}

interface Role {
  id: string
  name: string
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr))
}

export default function UsersPageClient() {
  const qc = useQueryClient()
  const canRead = usePermission('users', 'read')
  const canAdmin = usePermission('users', 'admin')
  const uiMode = useUiStore((s) => s.uiMode)

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<UserRow | null>(null)
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null)

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ['users', roleFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (roleFilter !== 'all') params.set('role', roleFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const r = await fetch(`/api/v1/users?${params.toString()}`)
      if (!r.ok) throw new Error('Failed to load users')
      return r.json()
    },
    enabled: canRead,
  })

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const r = await fetch('/api/v1/roles')
      if (!r.ok) throw new Error('Failed to load roles')
      return r.json()
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const r = await fetch(`/api/v1/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      })
      if (!r.ok) throw new Error(await r.text())
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deactivated')
      setDeactivateTarget(null)
    },
    onError: (e) => {
      toast.error(e.message)
      setDeactivateTarget(null)
    },
  })

  const reactivateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const r = await fetch(`/api/v1/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      })
      if (!r.ok) throw new Error(await r.text())
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User reactivated')
    },
    onError: (e) => toast.error(e.message),
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

  const filteredUsers = users.filter((u) => {
    if (!search) return true
    const q = search.toLowerCase()
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  const totalUsers = users.length
  const activeUsers = users.filter((u) => u.isActive).length

  const columns: Column<UserRow>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (u) => <span className="font-medium text-foreground">{u.name}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      cell: (u) => <span className="text-muted-foreground">{u.email}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      cell: (u) =>
        u.roleName ? (
          <span className="bg-primary-soft text-primary rounded-full px-2.5 py-0.5 text-xs">
            {u.roleName}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (u) => (
        <StatusBadge status={u.isActive ? 'ACTIVE' : 'INACTIVE'} />
      ),
    },
    {
      key: 'lastLogin',
      header: 'Last Login',
      cell: (u) => (
        <span className="text-muted-foreground text-sm">{formatDate(u.lastLogin)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (u) => (
        <div className="flex items-center justify-end gap-1">
          {canAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={`Edit ${u.name}`}
              onClick={() => {
                setEditUser(u)
                setDialogOpen(true)
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={`Reset password for ${u.name}`}
              onClick={() => setResetTarget({ id: u.id, name: u.name })}
            >
              <KeyRound className="h-4 w-4" />
            </Button>
          )}
          {u.isActive ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              aria-label={`Deactivate ${u.name}`}
              onClick={() => setDeactivateTarget(u)}
            >
              <UserMinus className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-success hover:text-success"
              aria-label={`Reactivate ${u.name}`}
              onClick={() => reactivateMutation.mutate(u.id)}
            >
              <UserCheck className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title={uiMode === 'simple' ? 'Team Members' : 'Users'}
        subtitle="Manage who can access this company"
        actions={
          canAdmin ? (
            <Button
              size="sm"
              onClick={() => {
                setEditUser(null)
                setDialogOpen(true)
              }}
            >
              Add Team Member
            </Button>
          ) : undefined
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          title="Total Users"
          value={String(totalUsers)}
          icon={Users}
          iconTone="primary"
        />
        <KpiCard
          title="Active Users"
          value={String(activeUsers)}
          icon={UserCheck}
          iconTone="success"
        />
      </div>

      <SectionCard title="Team Members">
        <Toolbar
          searchPlaceholder="Search by name or email…"
          searchValue={search}
          onSearchChange={setSearch}
        >
          {/* Role filter */}
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-9 min-w-[140px]">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 min-w-[130px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </Toolbar>

        <DataTable
          columns={columns}
          rows={filteredUsers}
          rowKey={(u) => u.id}
          empty={
            isLoading
              ? 'Loading…'
              : filteredUsers.length === 0 && users.length > 0
              ? 'No team members match your search.'
              : 'No team members yet. Add your first team member to control who can access PremGiri Books.'
          }
        />
      </SectionCard>

      {/* Add / Edit user dialog */}
      <UserDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o)
          if (!o) setEditUser(null)
        }}
        user={editUser}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['users'] })}
      />

      {/* Reset Password dialog */}
      <ResetPasswordDialog
        open={resetTarget !== null}
        onOpenChange={(o) => { if (!o) setResetTarget(null) }}
        userId={resetTarget?.id ?? ''}
        userName={resetTarget?.name ?? ''}
        onSuccess={() => {
          setResetTarget(null)
          qc.invalidateQueries({ queryKey: ['users'] })
        }}
      />

      {/* Deactivate confirmation */}
      <AlertDialog
        open={!!deactivateTarget}
        onOpenChange={(o) => !o && setDeactivateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Deactivate {deactivateTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will be signed out within 60 seconds and cannot log back in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)
              }
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
