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
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
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
  control: Control<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue: (name: string, value: any) => void
  voucherType: 'SALES' | 'PURCHASE' | 'CREDIT_NOTE' | 'DEBIT_NOTE'
  companyStateCode: string
  partyStateCode: string
  stockItems: StockItemOption[]
  godowns?: GodownOption[]
}

// ─── Product Combobox ─────────────────────────────────────────────────────────

interface ProductComboboxProps {
  value: string
  onChange: (itemId: string) => void
  onSelect: (item: StockItemOption) => void
  stockItems: StockItemOption[]
}

function ProductCombobox({ value, onChange, onSelect, stockItems }: ProductComboboxProps) {
  const [open, setOpen] = useState(false)
  const selectedItem = stockItems.find((item) => item.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full min-w-[160px] justify-between text-sm font-normal text-gray-700 border-gray-200 hover:bg-gray-50"
        >
          <span className="truncate">
            {selectedItem ? selectedItem.name : 'Select product...'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gray-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search products..." />
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
  godowns,
}: LineItemsTableProps) {
  const { uiMode } = useUiStore()
  const isAdvanced = uiMode === 'advanced'
  const isPurchase = voucherType === 'PURCHASE'
  const showITC = isPurchase && isAdvanced

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = useWatch({ control, name: 'items' }) as Array<Record<string, string | number | boolean | undefined>>

  // Compute per-row GST amounts client-side
  const rowAmounts = (watchedItems ?? []).map((item) => {
    const qty = new Decimal(String(item?.qty ?? '0'))
    const rate = new Decimal(String(item?.rate ?? '0'))
    const discPct = new Decimal(String(item?.discountPct ?? '0'))
    const taxable = qty
      .times(rate)
      .times(new Decimal(1).minus(discPct.dividedBy(100)))
    const gstRate = new Decimal(
      String(item?.gstRateOverride ?? item?._gstRate ?? '0')
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

  function handleProductSelect(index: number, item: StockItemOption) {
    setValue(`items.${index}.itemId`, item.id)
    setValue(`items.${index}._gstRate`, item.gstRate)
    setValue(`items.${index}.rate`, item.openingRate)
    setValue(`items.${index}.hsnCode`, item.hsnCode ?? '')
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
    })
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100">
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* ── Header ── */}
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-[180px]">
                Product
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[80px]">
                Qty
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[100px]">
                Rate (₹)
              </th>
              {isAdvanced && (
                <>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[80px]">
                    Disc %
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-[90px]">
                    HSN
                  </th>
                </>
              )}
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[80px]">
                GST %
              </th>
              {isAdvanced && (
                <>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[90px]">
                    CGST (₹)
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[90px]">
                    SGST (₹)
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[90px]">
                    IGST (₹)
                  </th>
                </>
              )}
              {showITC && (
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wide w-[60px]">
                  ITC
                </th>
              )}
              {isAdvanced && godowns && godowns.length > 0 && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-[110px]">
                  Godown
                </th>
              )}
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[110px]">
                Amount (₹)
              </th>
              <th className="px-4 py-3 w-[48px]" />
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody>
            {fields.map((field, index) => {
              const amounts = rowAmounts[index]
              const isIntra = amounts?.taxType === 'INTRA_STATE'

              return (
                <tr key={field.id} className="hover:bg-gray-50 border-b border-gray-100">
                  {/* Product */}
                  <td className="px-4 py-3">
                    <Controller
                      control={control}
                      name={`items.${index}.itemId`}
                      render={({ field: f }) => (
                        <ProductCombobox
                          value={f.value}
                          onChange={f.onChange}
                          onSelect={(item) => handleProductSelect(index, item)}
                          stockItems={stockItems}
                        />
                      )}
                    />
                  </td>

                  {/* Qty */}
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3">
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

                  {/* Discount % — Advanced Mode only */}
                  {isAdvanced && (
                    <td className="px-4 py-3">
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
                  )}

                  {/* HSN — Advanced Mode only */}
                  {isAdvanced && (
                    <td className="px-4 py-3">
                      <Controller
                        control={control}
                        name={`items.${index}.hsnCode`}
                        render={({ field: f }) => (
                          <Input
                            {...f}
                            type="text"
                            maxLength={8}
                            placeholder="HSN"
                            className="text-sm w-full"
                          />
                        )}
                      />
                    </td>
                  )}

                  {/* GST % */}
                  <td className="px-4 py-3">
                    {isAdvanced ? (
                      // Advanced Mode: editable gstRateOverride (D-18)
                      <Controller
                        control={control}
                        name={`items.${index}.gstRateOverride`}
                        render={({ field: f }) => (
                          <Input
                            {...f}
                            value={f.value ?? watchedItems?.[index]?._gstRate ?? ''}
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            className="text-right text-sm w-full"
                          />
                        )}
                      />
                    ) : (
                      // Simple Mode: read-only, greyed
                      <span className="text-sm text-gray-400 tabular-nums">
                        {watchedItems?.[index]?._gstRate ?? 0}%
                      </span>
                    )}
                  </td>

                  {/* CGST / SGST / IGST columns — Advanced Mode only */}
                  {isAdvanced && (
                    <>
                      <td className="px-4 py-3 text-right text-sm text-gray-700 tabular-nums">
                        {amounts ? formatINR(amounts.cgst.toFixed(2)) : '₹0.00'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700 tabular-nums">
                        {amounts ? formatINR(amounts.sgst.toFixed(2)) : '₹0.00'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700 tabular-nums">
                        {amounts
                          ? isIntra
                            ? '₹0.00'
                            : formatINR(amounts.igst.toFixed(2))
                          : '₹0.00'}
                      </td>
                    </>
                  )}

                  {/* ITC Eligible — Purchase, Advanced Mode only */}
                  {showITC && (
                    <td className="px-4 py-3 text-center">
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

                  {/* Godown — Advanced Mode only, when godowns provided */}
                  {isAdvanced && godowns && godowns.length > 0 && (
                    <td className="px-4 py-3">
                      <Controller
                        control={control}
                        name={`items.${index}.godownId`}
                        render={({ field: f }) => (
                          <select
                            {...f}
                            className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                          >
                            <option value="">Select godown</option>
                            {godowns.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name}
                              </option>
                            ))}
                          </select>
                        )}
                      />
                    </td>
                  )}

                  {/* Amount */}
                  <td className="px-4 py-3 text-right text-sm text-gray-900 font-medium tabular-nums">
                    {amounts ? formatINR(amounts.total.toFixed(2)) : '₹0.00'}
                  </td>

                  {/* Remove */}
                  <td className="px-4 py-3 text-center">
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

      {/* Add item button */}
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
