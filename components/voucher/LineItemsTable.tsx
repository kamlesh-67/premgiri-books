'use client'

import { Fragment, useState } from 'react'
import { Control, Controller, useFieldArray, useWatch } from 'react-hook-form'
import { Decimal } from 'decimal.js'
import { Plus, Trash2, ChevronsUpDown, Check, ChevronDown } from 'lucide-react'

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

// Indian GST slab rates
const GST_RATES = ['0', '0.1', '0.25', '1', '1.5', '3', '5', '6', '7.5', '12', '18', '28']

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StockItemOption {
  id: string
  name: string
  gstRate: number
  openingRate: string
  currentQty: string // Added to show available stock
  hsnCode?: string
  uom?: string | { symbol: string } // CR-002: unit symbol or object
}

export interface GodownOption {
  id: string
  name: string
}

export interface LineItemsTableProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue: (name: string, value: any) => void
  voucherType: 'SALES' | 'PURCHASE' | 'CREDIT_NOTE' | 'DEBIT_NOTE'
  companyStateCode: string
  partyStateCode: string
  stockItems: StockItemOption[]
  godowns?: GodownOption[]
  uoms?: Array<{ id: string; name: string; symbol: string }>
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
          className="w-full min-w-[140px] justify-between text-sm font-normal border-gray-200 hover:bg-gray-50"
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
                  <div className="flex flex-col flex-1">
                    <span className="text-sm font-medium">{item.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded uppercase">
                        {item.gstRate}% GST
                      </span>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-semibold",
                        new Decimal(item.currentQty ?? 0).gt(0) ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                      )}>
                        Stock: {item.currentQty ?? 0}
                      </span>
                    </div>
                  </div>
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
  godowns: _godowns,
  uoms = [],
  defaultGodownId,
  onRequestCreate,
}: LineItemsTableProps) {
  const { uiMode } = useUiStore()
  const isAdvanced = uiMode === 'advanced'
  const isPurchase = voucherType === 'PURCHASE'
  const showITC = isPurchase && isAdvanced

  // Track which rows have their extra-fields sub-row expanded
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  function toggleExpand(fieldId: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(fieldId)) next.delete(fieldId)
      else next.add(fieldId)
      return next
    })
  }

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = useWatch({ control, name: 'items' }) as Array<
    Record<string, string | number | boolean | undefined>
  >

  const rowAmounts = (watchedItems ?? []).map((item) => {
    const qty = new Decimal(String(item?.qty || '0'))
    const rate = new Decimal(String(item?.rate || '0'))
    const discType = (item?.discountType as string | undefined) ?? 'PERCENT'
    let taxable: Decimal
    if (discType === 'NONE') {
      taxable = qty.times(rate)
    } else if (discType === 'FLAT_INR') {
      const flatDisc = new Decimal(String(item?.discountAmt || '0'))
      taxable = qty.times(rate).minus(flatDisc).gt(0) ? qty.times(rate).minus(flatDisc) : new Decimal(0)
    } else {
      const discPct = new Decimal(String(item?.discountPct || '0'))
      taxable = qty.times(rate).times(new Decimal(1).minus(discPct.dividedBy(100)))
    }
    const gstRate = new Decimal(String(item?.gstRateOverride || item?._gstRate || '0'))
    const { cgst, sgst, igst, taxType } = calculateGST({
      taxableValue: taxable,
      gstRate,
      companyStateCode,
      partyStateCode,
    })
    const total = taxable.plus(cgst).plus(sgst).plus(igst)
    return { taxable, cgst, sgst, igst, total, taxType }
  })

  const anyInterState = rowAmounts.some((r) => r.taxType === 'INTER_STATE')
  const sgstIgstHeader = anyInterState ? 'IGST (₹)' : 'SGST (₹)'

  const isSales = voucherType === 'SALES'

  function handleProductSelect(index: number, item: StockItemOption) {
    setValue(`items.${index}.itemId`, item.id)
    setValue(`items.${index}._gstRate`, item.gstRate)
    
    // User Requirement: RATE PRICE + 5% MARGINE
    let rate = new Decimal(item.openingRate)
    if (isSales) {
      rate = rate.times(1.05).toDecimalPlaces(2)
    }
    setValue(`items.${index}.rate`, rate.toString())
    
    setValue(`items.${index}.hsnCode`, item.hsnCode ?? '')
    setValue(`items.${index}._maxQty`, item.currentQty) // Store max available qty for validation
    
    // Handle UOM safely — if it's an object, get the symbol
    let uomSymbol = ''
    if (typeof item.uom === 'string') uomSymbol = item.uom
    else if (item.uom && typeof item.uom === 'object' && 'symbol' in item.uom) uomSymbol = item.uom.symbol
    
    setValue(`items.${index}.unit`, uomSymbol)  // CR-002
    setValue(`items.${index}._newItemName`, '')
  }

  function handleAddRow() {
    append({
      itemId: '',
      qty: '1',
      rate: '0',
      unit: '',
      discountType: 'PERCENT',
      discountPct: '0',
      discountAmt: '0',
      hsnCode: '',
      _gstRate: 0,
      _maxQty: '999999',
      gstRateOverride: undefined,
      itcEligible: isPurchase,
      godownId: defaultGodownId ?? '',
      batchNo: '',
      materialCode: '',
      packSize: '',
      packUnit: '',
      listPrice: '',
    })
  }

  // Column count for expanded sub-row colspan
  const colCount = 10 + (showITC ? 1 : 0) + 2 // +2 for expand + delete

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px]">
          {/* ── Header ── */}
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-[200px]">
                Product
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[90px]">
                Qty
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-[100px]">
                Unit
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[110px]">
                Rate (₹)
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[120px]">
                Disc
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-[90px]">
                HSN
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[70px]">
                GST %
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[100px]">
                CGST (₹)
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[100px]">
                {sgstIgstHeader}
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-[110px]">
                Amount (₹)
              </th>
              <th className="px-3 py-3 w-[32px]" />
              {showITC && (
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wide w-[48px]">
                  ITC
                </th>
              )}
              <th className="px-3 py-3 w-[38px]" />
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody>
            {fields.map((field, index) => {
              const amounts = rowAmounts[index]
              const isIntra = amounts?.taxType === 'INTRA_STATE'
              const gstDisplay = watchedItems?.[index]?._gstRate ?? 0
              const discType = (watchedItems?.[index]?.discountType as string | undefined) ?? 'PERCENT'
              const isExpanded = expandedRows.has(field.id)

              return (
                <Fragment key={field.id}>
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
                            className={cn(
                              "text-right text-sm w-full min-w-[60px]",
                              isSales && new Decimal(f.value || "0").gt(new Decimal((watchedItems?.[index]?._maxQty as string) || "999999")) && "border-red-500 text-red-600 focus-visible:ring-red-500"
                            )}
                            onChange={(e) => {
                              const val = e.target.value;
                              const max = new Decimal((watchedItems?.[index]?._maxQty as string) || "999999");
                              if (isSales && new Decimal(val || "0").gt(max)) {
                                import('sonner').then(({ toast }) => toast.error(`Only ${max} available in stock`));
                                f.onChange(max.toString());
                              } else {
                                f.onChange(val);
                              }
                            }}
                          />
                        )}
                      />
                    </td>

                    {/* Unit — CR-002: Dropdown */}
                    <td className="px-3 py-2">
                      <Controller
                        control={control}
                        name={`items.${index}.unit`}
                        render={({ field: f }) => (
                          <select
                            {...f}
                            className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 min-w-[80px]"
                          >
                            <option value="">—</option>
                            {uoms.map(u => (
                              <option key={u.id} value={u.symbol}>{u.symbol}</option>
                            ))}
                          </select>
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
                            className="text-right text-sm w-full min-w-[80px]"
                          />
                        )}
                      />
                    </td>

                    {/* Discount — CR-003: type toggle + value */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Controller
                          control={control}
                          name={`items.${index}.discountType`}
                          render={({ field: f }) => (
                            <select
                              value={(f.value as string) ?? 'PERCENT'}
                              onChange={(e) => f.onChange(e.target.value)}
                              className="border border-gray-200 rounded px-1 py-1.5 text-xs text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 w-9 shrink-0"
                            >
                              <option value="PERCENT">%</option>
                              <option value="FLAT_INR">₹</option>
                              <option value="NONE">—</option>
                            </select>
                          )}
                        />
                        {discType !== 'NONE' && (
                          <Controller
                            control={control}
                            name={
                              discType === 'FLAT_INR'
                                ? `items.${index}.discountAmt`
                                : `items.${index}.discountPct`
                            }
                            render={({ field: f }) => (
                              <Input
                                {...f}
                                value={f.value ?? '0'}
                                type="number"
                                min="0"
                                step="any"
                                className="text-right text-sm flex-1 min-w-[60px]"
                              />
                            )}
                          />
                        )}
                      </div>
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
                            className="text-sm w-full min-w-[70px]"
                          />
                        )}
                      />
                    </td>

                    {/* GST % — dropdown with fixed Indian slab rates */}
                    <td className="px-3 py-2">
                      <Controller
                        control={control}
                        name={`items.${index}.gstRateOverride`}
                        render={({ field: f }) => {
                          const effectiveRate = String(f.value ?? gstDisplay)
                          const ratesWithCurrent = GST_RATES.includes(effectiveRate)
                            ? GST_RATES
                            : [effectiveRate, ...GST_RATES]
                          return (
                            <select
                              value={effectiveRate}
                              onChange={(e) => f.onChange(new Decimal(String(e.target.value || '0')).toNumber())}
                              className="w-full border border-gray-200 rounded-md px-1.5 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 min-w-[60px]"
                            >
                              {ratesWithCurrent.map((r) => (
                                <option key={r} value={r}>{r}%</option>
                              ))}
                            </select>
                          )
                        }}
                      />
                    </td>

                    {/* CGST ₹ — Increase precision display if requested */}
                    <td className="px-3 py-2 text-right text-sm tabular-nums min-w-[90px]">
                      {amounts && isIntra ? (
                        <span className="text-gray-700">
                          {amounts.cgst.gt(0) && amounts.cgst.decimalPlaces() > 2 
                            ? amounts.cgst.toFixed(4) 
                            : formatINR(amounts.cgst.toFixed(2))}
                        </span>
                      ) : (
                        <span className="text-gray-300">₹0.00</span>
                      )}
                    </td>

                    {/* SGST / IGST ₹ — Increase precision display if requested */}
                    <td className="px-3 py-2 text-right text-sm tabular-nums min-w-[90px]">
                      {amounts ? (
                        isIntra ? (
                          <span className="text-gray-700">
                            {amounts.sgst.gt(0) && amounts.sgst.decimalPlaces() > 2 
                              ? amounts.sgst.toFixed(4) 
                              : formatINR(amounts.sgst.toFixed(2))}
                          </span>
                        ) : (
                          <span className="text-gray-700">
                            {amounts.igst.gt(0) && amounts.igst.decimalPlaces() > 2 
                              ? amounts.igst.toFixed(4) 
                              : formatINR(amounts.igst.toFixed(2))}
                          </span>
                        )
                      ) : (
                        <span className="text-gray-300">₹0.00</span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="px-3 py-2 text-right text-sm text-gray-900 font-medium tabular-nums min-w-[100px]">
                      {amounts ? formatINR(amounts.total.toFixed(2)) : '₹0.00'}
                    </td>

                    {/* Expand toggle — reveals CR-010/011/012 fields */}
                    <td className="px-1 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggleExpand(field.id)}
                        className={cn(
                          'text-gray-300 hover:text-gray-500 transition-colors',
                          isExpanded && 'text-purple-500 hover:text-purple-600',
                        )}
                        aria-label="Toggle extra fields"
                        title="Batch / pack / list price"
                      >
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 transition-transform duration-150',
                            isExpanded && 'rotate-180',
                          )}
                        />
                      </button>
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

                  {/* ── Expanded sub-row: CR-010 Pack, CR-011 List Price, CR-012 Batch/Material ── */}
                  {isExpanded && (
                    <tr key={`${field.id}-expanded`} className="border-b border-gray-100 bg-purple-50/20">
                      <td colSpan={colCount} className="px-4 py-2">
                        <div className="flex items-center gap-4 flex-wrap">
                          {/* CR-012: Batch no */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 shrink-0 w-12">Batch</span>
                            <Controller
                              control={control}
                              name={`items.${index}.batchNo`}
                              render={({ field: f }) => (
                                <Input
                                  {...f}
                                  value={f.value ?? ''}
                                  placeholder="Batch no"
                                  className="h-7 text-xs w-24"
                                />
                              )}
                            />
                          </div>

                          {/* CR-012: Material/supplier code */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 shrink-0 w-20">Mat. Code</span>
                            <Controller
                              control={control}
                              name={`items.${index}.materialCode`}
                              render={({ field: f }) => (
                                <Input
                                  {...f}
                                  value={f.value ?? ''}
                                  placeholder="Supplier code"
                                  className="h-7 text-xs w-28"
                                />
                              )}
                            />
                          </div>

                          {/* CR-010: Pack size + unit */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 shrink-0 w-8">Pack</span>
                            <Controller
                              control={control}
                              name={`items.${index}.packSize`}
                              render={({ field: f }) => (
                                <Input
                                  {...f}
                                  value={f.value ?? ''}
                                  type="number"
                                  placeholder="Size"
                                  className="h-7 text-xs w-16 text-right"
                                />
                              )}
                            />
                            <Controller
                              control={control}
                              name={`items.${index}.packUnit`}
                              render={({ field: f }) => (
                                <Input
                                  {...f}
                                  value={f.value ?? ''}
                                  placeholder="CTN"
                                  maxLength={10}
                                  className="h-7 text-xs w-14 uppercase"
                                />
                              )}
                            />
                          </div>

                          {/* CR-011: List price */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 shrink-0 w-12">List ₹</span>
                            <Controller
                              control={control}
                              name={`items.${index}.listPrice`}
                              render={({ field: f }) => (
                                <Input
                                  {...f}
                                  value={f.value ?? ''}
                                  type="number"
                                  placeholder="0.00"
                                  className="h-7 text-xs w-20 text-right"
                                />
                              )}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
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
