'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, ChevronRight, ChevronDown } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { supplierSchema, type SupplierInput } from '@/lib/schemas/masters'

interface SupplierFormProps {
  party: { id: string; name: string; openingBalance: string } | null
  onClose: () => void
  onSuccess: () => void
}

export function SupplierForm({ party, onClose, onSuccess }: SupplierFormProps) {
  const [addressOpen, setAddressOpen] = useState(false)
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true)
  const isEditing = !!party

  const form = useForm<SupplierInput>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: party?.name ?? '',
      gstin: '',
      phone: '',
      email: '',
      openingBalance: party?.openingBalance ?? '0',
      bankName: '',
      bankAccount: '',
      ifsc: '',
      billingAddress: '',
      shippingAddress: '',
    },
  })

  const { isSubmitting } = form.formState

  async function onSubmit(values: SupplierInput) {
    const url = isEditing
      ? `/api/v1/masters/ledgers/${party.id}`
      : '/api/v1/masters/ledgers'
    const method = isEditing ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        isEditing
          ? { name: values.name, openingBalance: values.openingBalance, bankName: values.bankName, bankAccount: values.bankAccount, ifsc: values.ifsc }
          : { ...values, partyType: 'supplier' }
      ),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const firstIssue = data?.issues?.[0]?.message
      toast.error(firstIssue ?? 'Failed to save supplier. Please try again.')
      return
    }

    toast.success('Supplier saved successfully.', { duration: 3000 })
    onSuccess()
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Supplier Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier Name <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Patel Distributors" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* GST Number */}
            <FormField
              control={form.control}
              name="gstin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GST Number <span className="text-gray-400 text-xs font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Input
                      placeholder="29ABCDE1234F1Z5"
                      maxLength={15}
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phone + Email */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="+91 98765 43210" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contact@company.com" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Bank Details — always shown for suppliers per D-13 */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Bank Details</p>
              <FormField
                control={form.control}
                name="bankName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank Name</FormLabel>
                    <FormControl>
                      <Input placeholder="HDFC Bank" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bankAccount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number</FormLabel>
                      <FormControl>
                        <Input placeholder="12345678901234" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ifsc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IFSC Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="HDFC0001234"
                          maxLength={11}
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Opening Balance */}
            <FormField
              control={form.control}
              name="openingBalance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opening Balance</FormLabel>
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

            {/* Address — collapsible per D-13 / UI-SPEC 8.5 */}
            {!isEditing && (
              <Collapsible open={addressOpen} onOpenChange={setAddressOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-sm text-purple-600 hover:underline cursor-pointer"
                  >
                    {addressOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    {addressOpen ? 'Hide Address' : 'Add Address'}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-3 pt-2">
                    <FormField
                      control={form.control}
                      name="billingAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Billing Address</FormLabel>
                          <FormControl>
                            <Textarea
                              rows={3}
                              placeholder="Street, City, State, PIN"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="sameAddressSupplier"
                        checked={shippingSameAsBilling}
                        onCheckedChange={(checked) => setShippingSameAsBilling(!!checked)}
                      />
                      <label htmlFor="sameAddressSupplier" className="text-sm text-gray-700 cursor-pointer">
                        Shipping address same as billing
                      </label>
                    </div>
                    {!shippingSameAsBilling && (
                      <FormField
                        control={form.control}
                        name="shippingAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Shipping Address</FormLabel>
                            <FormControl>
                              <Textarea
                                rows={3}
                                placeholder="Street, City, State, PIN"
                                {...field}
                                value={field.value ?? ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

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
                  'Save Supplier'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
