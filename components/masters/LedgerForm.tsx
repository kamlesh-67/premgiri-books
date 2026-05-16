'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Check, ChevronsUpDown } from 'lucide-react'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { ledgerSchema, type LedgerInput } from '@/lib/schemas/masters'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AccountGroupRaw {
  id: string
  name: string
  parentId: string | null
  nature: string
}

interface AccountGroupOption {
  id: string
  name: string
  fullPath: string
}

interface Ledger {
  id: string
  name: string
  groupId: string
  openingBalance: string
  drCr: 'DR' | 'CR'
  gstRegType?: string | null
  gstin?: string | null
  pan?: string | null
  creditLimit?: string | null
  creditDays?: number | null
  bankName?: string | null
  bankAccount?: string | null
  ifsc?: string | null
}

interface LedgerFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ledger?: Ledger | null
  onSave: (data: LedgerInput) => Promise<void>
}

// ─── buildPathMap ─────────────────────────────────────────────────────────────
// Builds full hierarchy paths client-side from flat account group list (D-17)
function buildPathMap(groups: AccountGroupRaw[]): AccountGroupOption[] {
  const byId = new Map(groups.map((g) => [g.id, g]))
  function getPath(g: AccountGroupRaw): string[] {
    const path = [g.name]
    if (g.parentId) {
      const parent = byId.get(g.parentId)
      if (parent) path.unshift(...getPath(parent))
    }
    return path
  }
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    fullPath: getPath(g).join(' > '),
  }))
}

// ─── LedgerForm Component ────────────────────────────────────────────────────

export function LedgerForm({ open, onOpenChange, ledger, onSave }: LedgerFormProps) {
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false)
  const isEditing = !!ledger

  const form = useForm<LedgerInput>({
    resolver: zodResolver(ledgerSchema),
    defaultValues: {
      name: ledger?.name ?? '',
      groupId: ledger?.groupId ?? '',
      openingBalance: ledger?.openingBalance ?? '0',
      drCr: (ledger?.drCr as 'DR' | 'CR') ?? 'DR',
      gstRegType: (ledger?.gstRegType as LedgerInput['gstRegType']) ?? 'UNREGISTERED',
      gstin: ledger?.gstin ?? '',
      pan: ledger?.pan ?? '',
      creditLimit: ledger?.creditLimit ?? '0',
      creditDays: ledger?.creditDays ?? 0,
      bankName: ledger?.bankName ?? '',
      bankAccount: ledger?.bankAccount ?? '',
      ifsc: ledger?.ifsc ?? '',
    },
  })

  const gstRegType = form.watch('gstRegType')
  const selectedGroupId = form.watch('groupId')

  // Fetch account groups for combobox (D-17)
  const { data: rawGroups = [] } = useQuery<AccountGroupRaw[]>({
    queryKey: ['account-groups'],
    queryFn: () => fetch('/api/v1/masters/account-groups').then((r) => r.json()),
    staleTime: 5 * 60 * 1000, // 5 min — account groups change rarely
  })

  const groupOptions = buildPathMap(rawGroups)
  const selectedGroupOption = groupOptions.find((g) => g.id === selectedGroupId)

  async function onSubmit(data: LedgerInput) {
    try {
      await onSave(data)
      form.reset()
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('Failed to save ledger. Please try again.')
    }
  }

  function handleOpenChange(value: boolean) {
    if (!value) {
      form.reset()
    }
    onOpenChange(value)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Ledger' : 'New Ledger'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Row 1: Ledger Name — full width */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Ledger Name <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. HDFC Bank Current Account" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Row 2: Account Group — full width, combobox (D-17) */}
            <FormField
              control={form.control}
              name="groupId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Account Group <span className="text-red-500">*</span>
                  </FormLabel>
                  <Popover open={groupPopoverOpen} onOpenChange={setGroupPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <button
                          type="button"
                          role="combobox"
                          aria-expanded={groupPopoverOpen}
                          className={cn(
                            'flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
                            'hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          <span className="truncate text-left">
                            {selectedGroupOption ? (
                              <>
                                <span className="text-sm text-gray-900">{selectedGroupOption.name}</span>
                                <span className="ml-1 text-xs text-gray-400">
                                  ({selectedGroupOption.fullPath})
                                </span>
                              </>
                            ) : (
                              'Search account groups...'
                            )}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[480px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search groups..." />
                        <CommandList>
                          <CommandEmpty>No account groups found.</CommandEmpty>
                          <CommandGroup>
                            {groupOptions.map((group) => (
                              <CommandItem
                                key={group.id}
                                value={group.fullPath} // cmdk searches on value
                                onSelect={() => {
                                  field.onChange(group.id)
                                  setGroupPopoverOpen(false)
                                }}
                              >
                                <div className="flex flex-1 flex-col">
                                  <span className="text-sm text-gray-900">{group.name}</span>
                                  <span className="text-xs text-gray-400 mt-0.5">{group.fullPath}</span>
                                </div>
                                <Check
                                  className={cn(
                                    'ml-2 h-4 w-4 shrink-0',
                                    field.value === group.id ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Row 3: Opening Balance + Dr/Cr */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="openingBalance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening Balance</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">₹</span>
                        <Input className="pl-7" placeholder="0.00" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="drCr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Balance Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="DR">Debit (Dr)</SelectItem>
                        <SelectItem value="CR">Credit (Cr)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 4: GST Registration Type + GSTIN (conditional) */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="gstRegType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GST Registration Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="UNREGISTERED">Unregistered</SelectItem>
                        <SelectItem value="REGULAR">Regular (GSTIN)</SelectItem>
                        <SelectItem value="COMPOSITION">Composition</SelectItem>
                        <SelectItem value="CONSUMER">Consumer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* GSTIN — shown only when REGULAR (D-17 conditional display) */}
              {gstRegType === 'REGULAR' && (
                <FormField
                  control={form.control}
                  name="gstin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GSTIN</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="29ABCDE1234F1Z5"
                          maxLength={15}
                          className="font-mono uppercase"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Row 5: PAN + Credit Limit */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="pan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PAN</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ABCDE1234F"
                        maxLength={10}
                        className="font-mono uppercase"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="creditLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credit Limit</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">₹</span>
                        <Input className="pl-7" placeholder="0.00" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 6: Credit Days + Bank Name */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="creditDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credit Days</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          className="pr-12"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                          days
                        </span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bankName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. HDFC Bank" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 7: Account Number + IFSC */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="bankAccount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 50100123456789" {...field} />
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
                        className="font-mono uppercase"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save Ledger'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
