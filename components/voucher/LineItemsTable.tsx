'use client'

import { useState } from 'react'
import { Control, Controller, useFieldArray, useWatch } from 'react-hook-form'
import { Decimal } from 'decimal.js'
import { Plus, Trash2, ChevronsUpDown, Check } from 'lucide-react'

import { calculateGST } from '@/lib/services/GSTCalculator'
import { formatINR } from '@/lib/utils/format'
import { useUiStore } from '@/lib/stores/uiStore'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandEmpty,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StockItemOption {
  id: string
  name: string
  gstRate: number
  openingRate: string
  hsnCode?: string
}

export interface GodownOption {
  id: string
  name: string
}

export interface LineItemsTableProps {
  control: Control<any> // eslint-disable-line @typescript-eslint/no-explicit-any
  setValue: (name: string, value: any) => void // eslint-disable-line @typescript-eslint/no-explicit-any
  voucherType: 'SALES' | 'PURCHASE' | 'CREDIT_NOTE' | 'DEBIT_NOTE'
  companyStateCode: string
  partyStateCode: string
  stockItems: StockItemOption[]
  godowns?: GodownOption[]
  defaultGodownId?: string
  onRequestCreate?: (name: string, rowIndex: number) => void
}

// ─── Product Combobox ─────────────────────────────────────────────────────────

interface ProductComboboxProps {
  value: string
  onChange: (itemId: string) => void
  onSelect: (item: StockItemOption) => void
  onRequestCreate?: (name: string) => void
  pendingName?: string
  stockItems: StockItemOption[]
}

function ProductCombobox({
  value,
  onChange,
  onSelect,
  onRequestCreate,
  pendingName,
  stockItems,
}: ProductComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selectedItem = stockItems.find((item) => item.id === value)

  function handleClose(o: boolean) {
    setOpen(o)
    if (!o) setQuery('')
  }

  const triggerLabel = selectedItem
    ? selectedItem.name
    : pendingName
    ? pendingName
    : 'Select product...'

  return (
    <Popover open={open} onOpenChange={handleClose}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full min-w-[150px] justify-between text-sm font-normal border-gray-200 hover:bg-gray-50"
        >
          <span className={cn('truncate', pendingName && !selectedItem ? 'text-purple-700 italic' : 'text-gray-700')}>
            {triggerLabel}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gray-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search products..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No product found.</CommandEmpty>
            <CommandGroup>
              {stockItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.name}
                  onSelect={() => {
                    onChange(item.id)
                    onSelect(item)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === item.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="flex-1">{item.name}</span>
                  <span className="ml-2 text-xs text-gray-400">{item.gstRate}%</span>
                </CommandItem>
              ))}
            </CommandGroup>

            {/* Add as new item — stored in form, created automatically on submit */}
            {query.trim() && onRequestCreate && (
              <CommandGroup>
                <CommandItem
                  value={`__new__${query}`}
                  onSelect={() => {
                    onRequestCreate(query.trim())
                    setOpen(false)
                    setQuery('')
                  }}
                  className="text-purple-600 font-medium"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add &quot;{query.trim()}&quot; as new item
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LineItemsTable({
  control,
  setValue,
  voucherType,
  companyStateCode,
  partyStateCode,
  stockItems,
  defaultGodownId,
  onRequestCreate,
}: LineItemsTableProps) {
  const { uiMode } = useUiStore()
  const isAdvanced = uiMode === 'advanced'
  const isPurchase = voucherType === 'PURCHASE'
  const showITC = isPurchase && isAdvanced

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = useWatch({ control, name: 'items' }) as Array<
    Record<string, string | number | boolean | undefined>
  >

  const rowAmounts = (watchedItems ?? []).map((item) => {
    const qty = new Decimal(String(item?.qty || '0'))
    const rate = new Decimal(String(item?.rate || '0'))
    const discPct = new Decimal(String(item?.discountPct || '0'))
    const taxable = qty
      .times(rate)
      .times(new Decimal(1).minus(discPct.dividedBy(100)))
    const gstRate = new Decimal(
      String(item?.gstRateOverride || item?._gstRate || '0')
    )
    const { cgst, sgst, igst, taxType } = calculateGST({
      taxableValue: taxable,
      gstRate,
      companyStateCode,
      partyStateCode,
    })
    const total = taxable.plus(cgst).plus(sgst).plus(igst)
    return { taxable, cgst, sgst, igst, total, taxType }
  })

  // Determine SGST vs IGST column label based on current rows
  const anyInterState = rowAmounts.some((r) => r.taxType === 'INTER_STATE')
  const sgstIgstHeader = anyInterState ? 'IGST (₹)' : 'SGST (₹)'

  function handleProductSelect(index: number, item: StockItemOption) {
    setValue(`items.${index}.itemId`, item.id)
    setValue(`items.${index}._gstRate`, item.gstRate)
    setValue(`items.${index}.rate`, item.openingRate)
    setValue(`items.${index}.hsnCode`, item.hsnCode ?? '')
    setValue(`items.${index}._newItemName`, '')
  }

  function handleAddRow() {
    append({
      itemId: '',
      qty: '1',
      rate: '0',
      discountPct: '0',
      hsnCode: '',
      _gstRate: 0,
      gstRateOverride: undefined,
      itcEligible: isPurchase,
      godownId: defaultGodownId ?? '',
    })
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
          {/* ── Header ── */}
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-[180px]">
                Product
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[72px]">
                Qty
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[90px]">
                Rate (₹)
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[64px]">
                Disc %
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-[82px]">
                HSN
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[64px]">
                GST %
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[82px]">
                CGST (₹)
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[82px]">
                {sgstIgstHeader}
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[100px]">
                Amount (₹)
              </th>
              {showITC && (
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wide w-[50px]">
                  ITC
                </th>
              )}
              <th className="px-3 py-3 w-[40px]" />
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody>
            {fields.map((field, index) => {
              const amounts = rowAmounts[index]
              const isIntra = amounts?.taxType === 'INTRA_STATE'
              const gstDisplay = watchedItems?.[index]?._gstRate ?? 0

              return (
                <tr
                  key={field.id}
                  className="hover:bg-gray-50 border-b border-gray-100"
                >
                  {/* Product */}
                  <td className="px-3 py-2">
                    <Controller
                      control={control}
                      name={`items.${index}.itemId`}
                      render={({ field: f }) => (
                        <ProductCombobox
                          value={f.value}
                          onChange={f.onChange}
                          onSelect={(item) => handleProductSelect(index, item)}
                          onRequestCreate={
                            onRequestCreate
                              ? (name) => onRequestCreate(name, index)
                              : undefined
                          }
                          pendingName={watchedItems?.[index]?._newItemName as string | undefined}
                          stockItems={stockItems}
                        />
                      )}
                    />
                  </td>

                  {/* Qty */}
                  <td className="px-3 py-2">
                    <Controller
                      control={control}
                      name={`items.${index}.qty`}
                      render={({ field: f }) => (
                        <Input
                          {...f}
                          type="number"
                          min="0"
                          step="any"
                          className="text-right text-sm w-full"
                        />
                      )}
                    />
                  </td>

                  {/* Rate */}
                  <td className="px-3 py-2">
                    <Controller
                      control={control}
                      name={`items.${index}.rate`}
                      render={({ field: f }) => (
                        <Input
                          {...f}
                          type="number"
                          min="0"
                          step="any"
                          className="text-right text-sm w-full"
                        />
                      )}
                    />
                  </td>

                  {/* Disc % */}
                  <td className="px-3 py-2">
                    <Controller
                      control={control}
                      name={`items.${index}.discountPct`}
                      render={({ field: f }) => (
                        <Input
                          {...f}
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          className="text-right text-sm w-full"
                        />
                      )}
                    />
                  </td>

                  {/* HSN */}
                  <td className="px-3 py-2">
                    <Controller
                      control={control}
                      name={`items.${index}.hsnCode`}
                      render={({ field: f }) => (
                        <Input
                          {...f}
                          value={f.value ?? ''}
                          type="text"
                          maxLength={12}
                          placeholder="HSN"
                          className="text-sm w-full"
                        />
                      )}
                    />
                  </td>

                  {/* GST % */}
                  <td className="px-3 py-2">
                    {isAdvanced ? (
                      <Controller
                        control={control}
                        name={`items.${index}.gstRateOverride`}
                        render={({ field: f }) => (
                          <Input
                            {...f}
                            value={f.value ?? gstDisplay}
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            className="text-right text-sm w-full"
                          />
                        )}
                      />
                    ) : (
                      <span className="text-sm text-gray-600 tabular-nums block text-right pr-1">
                        {gstDisplay}%
                      </span>
                    )}
                  </td>

                  {/* CGST ₹ */}
                  <td className="px-3 py-2 text-right text-sm tabular-nums">
                    {amounts && isIntra ? (
                      <span className="text-gray-700">
                        {formatINR(amounts.cgst.toFixed(2))}
                      </span>
                    ) : (
                      <span className="text-gray-300">₹0.00</span>
                    )}
                  </td>

                  {/* SGST / IGST ₹ */}
                  <td className="px-3 py-2 text-right text-sm tabular-nums">
                    {amounts ? (
                      isIntra ? (
                        <span className="text-gray-700">
                          {formatINR(amounts.sgst.toFixed(2))}
                        </span>
                      ) : (
                        <span className="text-gray-700">
                          {formatINR(amounts.igst.toFixed(2))}
                        </span>
                      )
                    ) : (
                      <span className="text-gray-300">₹0.00</span>
                    )}
                  </td>

                  {/* Amount */}
                  <td className="px-3 py-2 text-right text-sm text-gray-900 font-medium tabular-nums">
                    {amounts ? formatINR(amounts.total.toFixed(2)) : '₹0.00'}
                  </td>

                  {/* ITC — purchase advanced only */}
                  {showITC && (
                    <td className="px-3 py-2 text-center">
                      <Controller
                        control={control}
                        name={`items.${index}.itcEligible`}
                        render={({ field: f }) => (
                          <Checkbox
                            checked={!!f.value}
                            onCheckedChange={f.onChange}
                          />
                        )}
                      />
                    </td>
                  )}

                  {/* Remove */}
                  <td className="px-3 py-2 text-center">
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        aria-label="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add item */}
      <div className="px-4 py-3 border-t border-gray-100">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleAddRow}
          className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add item
        </Button>
      </div>
    </div>
  )
}
