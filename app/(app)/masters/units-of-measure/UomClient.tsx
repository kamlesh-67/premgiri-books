'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Ruler } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
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
import { uomSchema, type UomInput } from '@/lib/schemas/masters'

interface Uom {
  id: string
  name: string
  symbol: string
  inUse: boolean
}

export default function UomClient() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editUom, setEditUom] = useState<Uom | null>(null)
  const [deleteUom, setDeleteUom] = useState<Uom | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const { data: uoms = [], isLoading } = useQuery<Uom[]>({
    queryKey: ['uom'],
    queryFn: () => fetch('/api/v1/masters/uom').then((r) => r.json()),
    staleTime: 30 * 1000,
  })

  // ── Mutations ──────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (values: UomInput & { id?: string }) => {
      const isEditing = !!values.id
      const url = isEditing ? `/api/v1/masters/uom/${values.id}` : '/api/v1/masters/uom'
      const { id: _id, ...body } = values
      return fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}))
          throw new Error(data?.error ?? 'Failed to save unit.')
        }
        return r.json()
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uom'] })
      toast.success('Unit saved successfully.', { duration: 3000 })
      setShowForm(false)
      setEditUom(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/v1/masters/uom/${id}`, { method: 'DELETE' }).then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}))
          throw new Error(data?.error ?? 'Failed to delete unit.')
        }
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uom'] })
      toast.success('Unit deleted.', { duration: 2000 })
      setDeleteUom(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
      setDeleteUom(null)
    },
  })

  // ── Delete guard ───────────────────────────────────────────────────────────
  function handleDeleteClick(uom: Uom) {
    if (uom.inUse) {
      toast.error('This unit is used by products. Remove all products using it first.')
      return
    }
    setDeleteUom(uom)
  }

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <PageHeader
          title="Units of Measure"
          subtitle="Define measurement units for products"
          action={
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => { setEditUom(null); setShowForm(true) }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Unit
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
        ) : uoms.length === 0 ? (
          <EmptyState
            icon={Ruler}
            title="No custom units yet."
            description="Standard units (Pcs, Kg, Ltr) are pre-loaded. Add custom units your business needs."
            action={{
              label: 'Add Unit',
              onClick: () => { setEditUom(null); setShowForm(true) },
            }}
          />
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Units of measure list">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-32">
                      Symbol
                    </th>
                    <th className="px-4 py-3 w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {uoms.map((uom) => (
                    <tr key={uom.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {uom.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {uom.symbol}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label="Edit unit"
                                onClick={() => { setEditUom(uom); setShowForm(true) }}
                              >
                                <Pencil className="h-3.5 w-3.5 text-gray-500" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label="Delete unit"
                                onClick={() => handleDeleteClick(uom)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-gray-500" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
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
          <UomFormDialog
            uom={editUom}
            onClose={() => { setShowForm(false); setEditUom(null) }}
            onSave={(values) => saveMutation.mutate(values)}
            isSaving={saveMutation.isPending}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={!!deleteUom}
          onOpenChange={(open) => { if (!open) setDeleteUom(null) }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete &quot;{deleteUom?.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                This unit will be permanently removed. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => { if (deleteUom) deleteMutation.mutate(deleteUom.id) }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}

// ── Inline Form Dialog ────────────────────────────────────────────────────────

interface UomFormDialogProps {
  uom: Uom | null
  onClose: () => void
  onSave: (values: UomInput & { id?: string }) => void
  isSaving: boolean
}

function UomFormDialog({ uom, onClose, onSave, isSaving }: UomFormDialogProps) {
  const isEditing = !!uom

  const form = useForm<UomInput>({
    resolver: zodResolver(uomSchema),
    defaultValues: {
      name: uom?.name ?? '',
      symbol: uom?.symbol ?? '',
    },
  })

  function onSubmit(values: UomInput) {
    onSave({ ...values, ...(uom ? { id: uom.id } : {}) })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Unit' : 'Add Unit'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Name <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Kilogram" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="symbol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Symbol <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Kg"
                      maxLength={10}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
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
                  'Save Unit'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
