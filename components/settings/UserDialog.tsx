'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Role {
  id: string
  name: string
}

interface UserRow {
  id: string
  name: string
  email: string
  roleId: string | null
}

export interface UserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: UserRow | null
  onSuccess: () => void
}

interface FormState {
  name: string
  email: string
  roleId: string
  password: string
}

const EMPTY_FORM: FormState = { name: '', email: '', roleId: '', password: '' }

export function UserDialog({ open, onOpenChange, user, onSuccess }: UserDialogProps) {
  const isEdit = Boolean(user)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [roleError, setRoleError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Reset form when dialog opens or user changes
  useEffect(() => {
    if (open) {
      setForm(
        user
          ? { name: user.name, email: user.email, roleId: user.roleId ?? '', password: '' }
          : EMPTY_FORM
      )
      setEmailError(null)
      setRoleError(null)
      setPasswordError(null)
    }
  }, [open, user])

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const r = await fetch('/api/v1/roles')
      if (!r.ok) throw new Error('Failed to load roles')
      return r.json()
    },
    enabled: open,
  })

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Client-side validation
    let hasError = false

    if (!form.roleId) {
      setRoleError('Please choose a role for this team member.')
      hasError = true
    } else {
      setRoleError(null)
    }

    if (!isEdit && form.password.length < 8) {
      setPasswordError('Password must be at least 8 characters.')
      hasError = true
    } else {
      setPasswordError(null)
    }

    setEmailError(null)

    if (hasError) return

    setSaving(true)
    try {
      let response: Response
      if (isEdit && user) {
        response = await fetch(`/api/v1/users/${user.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, roleId: form.roleId || null }),
        })
      } else {
        response = await fetch('/api/v1/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            roleId: form.roleId || null,
            password: form.password,
          }),
        })
      }

      if (response.status === 409) {
        const body = await response.json()
        setEmailError(
          (body?.error as string | undefined) ??
            'This email is already registered — try a different one.'
        )
        return
      }

      if (!response.ok) {
        const body = await response.json()
        setEmailError((body?.error as string | undefined) ?? 'Something went wrong. Please try again.')
        return
      }

      onSuccess()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Team Member' : 'Add Team Member'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="user-name">Full Name</Label>
            <Input
              id="user-name"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Rahul Sharma"
              required
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="user-email">Email</Label>
            <Input
              id="user-email"
              type="email"
              value={form.email}
              onChange={(e) => {
                setField('email', e.target.value)
                setEmailError(null)
              }}
              placeholder="name@company.com"
              disabled={isEdit}
              required
            />
            {emailError && (
              <p className="text-sm text-destructive">{emailError}</p>
            )}
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label htmlFor="user-role">Role</Label>
            <Select
              value={form.roleId}
              onValueChange={(v) => {
                setField('roleId', v)
                setRoleError(null)
              }}
            >
              <SelectTrigger id="user-role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {roleError && (
              <p className="text-sm text-destructive">{roleError}</p>
            )}
          </div>

          {/* Temporary Password — create only */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="user-password">Temporary Password</Label>
              <Input
                id="user-password"
                type="password"
                value={form.password}
                onChange={(e) => {
                  setField('password', e.target.value)
                  setPasswordError(null)
                }}
                placeholder="Minimum 8 characters"
                required
              />
              {passwordError && (
                <p className="text-sm text-destructive">{passwordError}</p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Team Member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
