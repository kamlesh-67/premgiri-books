'use client'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { stockItemSchema, type StockItemInput } from '@/lib/schemas/masters'
import { cn } from '@/lib/utils'
import { Decimal } from 'decimal.js'

interface StockItem {
  id: string
  name: string
  hsnCode: string | null
  gstRate: string
  uomId: string
  openingRate: string
  openingQty: string
}

interface Uom {
  id: string
  name: string
  symbol: string
}

interface ProductFormProps {
  item: StockItem | null
  uoms: Uom[]
  onClose: () => void
  onSuccess: () => void
}

const GST_RATES = ['0', '5', '12', '18', '28'] as const

export function ProductForm({ item, uoms, onClose, onSuccess }: ProductFormProps) {
  const isEditing = !!item

  const form = useForm<StockItemInput>({
    resolver: zodResolver(stockItemSchema),
    defaultValues: {
      name: item?.name ?? '',
      gstRate: item ? new Decimal(String(item.gstRate || '0')).toNumber() : 18,
      hsnCode: item?.hsnCode ?? '',
      uomId: item?.uomId ?? (uoms[0]?.id ?? ''),
      openingRate: item?.openingRate ?? '0',
      openingQty: item?.openingQty ?? '0',
      reorderQty: '0',
    },
  })

  const { isSubmitting } = form.formState
  const selectedUomId = form.watch('uomId')
  const selectedUom = uoms.find((u) => u.id === selectedUomId)

  async function onSubmit(values: StockItemInput) {
    const url = isEditing
      ? `/api/v1/masters/stock-items/${item.id}`
      : '/api/v1/masters/stock-items'
    const method = isEditing ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const firstIssue = data?.issues?.[0]?.message
      toast.error(firstIssue ?? 'Failed to save product. Please try again.')
      return
    }

    toast.success('Product saved successfully.', { duration: 3000 })
    onSuccess()
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Product' : 'Add Product'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Product Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Laptop Stand" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* GST Rate — ToggleGroup segmented button per D-15 / UI-SPEC 8.3 */}
            <Controller
              control={form.control}
              name="gstRate"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>GST Rate <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <ToggleGroup
                      type="single"
                      value={String(field.value)}
                      onValueChange={(val) => {
                        if (val) field.onChange(parseInt(val))
                      }}
                      className="flex gap-2 justify-start"
                    >
                      {GST_RATES.map((rate) => (
                        <ToggleGroupItem
                          key={rate}
                          value={rate}
                          className={cn(
                            'border rounded-md px-4 py-2 text-sm font-medium transition-colors',
                            String(field.value) === rate
                              ? 'border-purple-300 bg-purple-100 text-purple-700'
                              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                          )}
                        >
                          {rate}%
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </FormControl>
                  {fieldState.error && (
                    <p className="text-sm text-red-600">{fieldState.error.message}</p>
                  )}
                </FormItem>
              )}
            />

            {/* HSN Code */}
            <FormField
              control={form.control}
              name="hsnCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    HSN Code{' '}
                    <span className="text-gray-400 text-xs font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. 8471"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <p className="text-xs text-gray-400 mt-1">Enter 2, 4, 6, 8, or 12 digit HSN code</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Unit of Measure */}
            <FormField
              control={form.control}
              name="uomId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit of Measure <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit..." />
                      </SelectTrigger>
                      <SelectContent>
                        {uoms.length === 0 ? (
                          <SelectItem value="__none" disabled>
                            No units available — please add UoMs first
                          </SelectItem>
                        ) : (
                          uoms.map((uom) => (
                            <SelectItem key={uom.id} value={uom.id}>
                              {uom.name} ({uom.symbol})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Selling Price + Opening Stock in 2 columns */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="openingRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selling Price (per unit)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">₹</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-7"
                          placeholder="0.00"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="openingQty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening Stock</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="0"
                          className={selectedUom ? 'pr-12' : ''}
                          {...field}
                        />
                        {selectedUom && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                            {selectedUom.symbol}
                          </span>
                        )}
                      </div>
                    </FormControl>
                    <p className="text-xs text-gray-400 mt-1">Enter current stock for Tally migration</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700 text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Product'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
