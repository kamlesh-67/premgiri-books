'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, PowerOff, Power, Warehouse } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { godownSchema, type GodownInput } from '@/lib/schemas/masters'

interface Godown {
  id: string
  name: string
  address: string | null
  isMain: boolean
  isActive: boolean
}

export default function GodownsClient() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editGodown, setEditGodown] = useState<Godown | null>(null)
  const [deactivateGodown, setDeactivateGodown] = useState<Godown | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const { data: godowns = [], isLoading } = useQuery<Godown[]>({
    queryKey: ['godowns'],
    queryFn: () => fetch('/api/v1/masters/godowns').then((r) => r.json()),
    staleTime: 30 * 1000,
  })

  // ── Mutations ──────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (values: GodownInput & { id?: string }) => {
      const isEditing = !!values.id
      const url = isEditing ? `/api/v1/masters/godowns/${values.id}` : '/api/v1/masters/godowns'
      const { id: _id, ...body } = values
      return fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}))
          throw new Error(data?.error ?? 'Failed to save godown.')
        }
        return r.json()
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['godowns'] })
      toast.success('Godown saved successfully.', { duration: 3000 })
      setShowForm(false)
      setEditGodown(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/v1/masters/godowns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      }).then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}))
          throw new Error(data?.error ?? 'Failed to update godown.')
        }
        return r.json()
      }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['godowns'] })
      const name = godowns.find((g) => g.id === vars.id)?.name ?? ''
      toast.success(
        vars.isActive ? `${name} activated.` : `${name} deactivated.`,
        { duration: 3000 }
      )
      setDeactivateGodown(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
      setDeactivateGodown(null)
    },
  })

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <PageHeader
          title="Godowns"
          subtitle="Manage storage locations and warehouses"
          action={
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => { setEditGodown(null); setShowForm(true) }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Godown
            </Button>
          }
        />

        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-8">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ) : godowns.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title="No godowns yet."
            description="Add storage locations to track inventory by warehouse or shop."
            action={{
              label: 'Add Godown',
              onClick: () => { setEditGodown(null); setShowForm(true) },
            }}
          />
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Godowns list">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Address
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-32">
                      Main Godown
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-24">
                      Status
                    </th>
                    <th className="px-4 py-3 w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {godowns.map((godown) => (
                    <tr key={godown.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {godown.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {godown.address || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {godown.isMain ? (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700">
                            Main
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={godown.isActive ? 'ACTIVE' : 'INACTIVE'} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label="Edit godown"
                                onClick={() => { setEditGodown(godown); setShowForm(true) }}
                              >
                                <Pencil className="h-3.5 w-3.5 text-gray-500" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          {godown.isActive ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label="Deactivate godown"
                                  onClick={() => setDeactivateGodown(godown)}
                                >
                                  <PowerOff className="h-3.5 w-3.5 text-gray-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Deactivate</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label="Activate godown"
                                  onClick={() => toggleActiveMutation.mutate({ id: godown.id, isActive: true })}
                                >
                                  <Power className="h-3.5 w-3.5 text-gray-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Activate</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add / Edit Form Dialog */}
        {showForm && (
          <GodownFormDialog
            godown={editGodown}
            onClose={() => { setShowForm(false); setEditGodown(null) }}
            onSave={(values) => saveMutation.mutate(values)}
            isSaving={saveMutation.isPending}
          />
        )}

        {/* Deactivate Confirmation Dialog */}
        <AlertDialog
          open={!!deactivateGodown}
          onOpenChange={(open) => { if (!open) setDeactivateGodown(null) }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate &quot;{deactivateGodown?.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                This godown will be hidden from inventory forms. Existing voucher lines will not be
                affected. You can reactivate it at any time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  if (deactivateGodown)
                    toggleActiveMutation.mutate({ id: deactivateGodown.id, isActive: false })
                }}
              >
                Deactivate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}

// ── Inline Form Dialog ────────────────────────────────────────────────────────

interface GodownFormDialogProps {
  godown: Godown | null
  onClose: () => void
  onSave: (values: GodownInput & { id?: string }) => void
  isSaving: boolean
}

function GodownFormDialog({ godown, onClose, onSave, isSaving }: GodownFormDialogProps) {
  const isEditing = !!godown

  const form = useForm<GodownInput>({
    resolver: zodResolver(godownSchema),
    defaultValues: {
      name: godown?.name ?? '',
      address: godown?.address ?? '',
      isMain: godown?.isMain ?? false,
    },
  })

  function onSubmit(values: GodownInput) {
    onSave({ ...values, ...(godown ? { id: godown.id } : {}) })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Godown' : 'Add Godown'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Name <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Main Warehouse" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Address */}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Address{' '}
                    <span className="text-gray-400 text-xs font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter address..."
                      rows={3}
                      className="resize-none"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Is Main Godown — Switch (shadcn) */}
            <FormField
              control={form.control}
              name="isMain"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                    <div>
                      <FormLabel className="text-sm font-medium text-gray-700 cursor-pointer">
                        Is Main Godown?
                      </FormLabel>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Only one godown can be the main godown
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Is Main Godown"
                      />
                    </FormControl>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700 text-white"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Godown'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
