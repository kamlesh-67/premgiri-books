'use client'

import { Control, Controller, useFieldArray } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'

import type { GSTTaxType } from '@/lib/services/GSTCalculator'
import { formatINR } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Freight GST options (only the common rates used for freight)
const FREIGHT_GST_RATES = [0, 5, 12, 18]

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PurchaseSummaryPanelProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>

  // Pre-computed display values from parent (line items only)
  taxableRaw: string                // gross line-item taxable, before header discounts
  headerDiscountTotal: string       // sum of all applied header discounts
  taxableAfterDiscounts: string     // taxableRaw − headerDiscountTotal
  cgstTotal: string
  sgstTotal: string
  igstTotal: string
  freightGstAmt: string             // GST computed on freight amount
  tcsAmt: string                    // TCS = tcsRate% × (sub-total after freight)
  roundOff: string                  // ±round-off
  grandTotal: string

  taxType: GSTTaxType
  uiMode: 'simple' | 'advanced'

  // For conditional rendering
  roundOffMode: 'AUTO' | 'MANUAL'

  // CR-018: supplier running balance (display only — no form field)
  previousBalance?: string
  currentBalance?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PurchaseSummaryPanel({
  control,
  taxableRaw,
  headerDiscountTotal,
  taxableAfterDiscounts,
  cgstTotal,
  sgstTotal,
  igstTotal,
  freightGstAmt,
  tcsAmt,
  roundOff,
  grandTotal,
  taxType,
  uiMode,
  roundOffMode,
  previousBalance,
  currentBalance,
}: PurchaseSummaryPanelProps) {
  const isSimple = uiMode === 'simple'
  const isIntra = taxType === 'INTRA_STATE'
  const isInter = taxType === 'INTER_STATE'

  const hasHeaderDiscount = parseFloat(headerDiscountTotal) !== 0
  const hasFreightGst = parseFloat(freightGstAmt) !== 0
  const hasTcs = parseFloat(tcsAmt) !== 0
  const hasRoundOff = parseFloat(roundOff) !== 0

  const totalGst = (parseFloat(cgstTotal) + parseFloat(sgstTotal) + parseFloat(igstTotal)).toFixed(2)

  // Header discounts field array — CR-004
  const { fields: discountFields, append: appendDiscount, remove: removeDiscount } = useFieldArray({
    control,
    name: 'headerDiscounts',
  })

  // Simple GST label
  const simpleGstLabel = taxType === 'INTRA_STATE'
    ? 'GST (CGST + SGST)'
    : taxType === 'INTER_STATE'
    ? 'GST (IGST)'
    : 'GST'

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">

      {/* ── CR-004: Header Discounts (advanced) ──────────────────────── */}
      {!isSimple && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Header Discounts
            </span>
            {discountFields.length < 5 && (
              <button
                type="button"
                onClick={() => appendDiscount({ label: 'Discount', type: 'PERCENT', value: '0' })}
                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium"
              >
                <Plus className="h-3 w-3" />
                Add row
              </button>
            )}
          </div>

          {discountFields.length === 0 && (
            <p className="text-xs text-gray-400 italic">No header discounts applied.</p>
          )}

          {discountFields.map((disc, i) => (
            <div key={disc.id} className="flex items-center gap-2">
              <Controller
                control={control}
                name={`headerDiscounts.${i}.label`}
                render={({ field: f }) => (
                  <Input
                    {...f}
                    value={f.value ?? 'Discount'}
                    placeholder="Label"
                    className="h-7 text-xs flex-1"
                  />
                )}
              />
              <Controller
                control={control}
                name={`headerDiscounts.${i}.type`}
                render={({ field: f }) => (
                  <select
                    value={(f.value as string) ?? 'PERCENT'}
                    onChange={(e) => f.onChange(e.target.value)}
                    className="h-7 border border-gray-200 rounded px-1.5 text-xs text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 w-10"
                  >
                    <option value="PERCENT">%</option>
                    <option value="FLAT_INR">₹</option>
                  </select>
                )}
              />
              <Controller
                control={control}
                name={`headerDiscounts.${i}.value`}
                render={({ field: f }) => (
                  <Input
                    {...f}
                    value={f.value ?? '0'}
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    className="h-7 text-xs w-20 text-right"
                  />
                )}
              />
              <button
                type="button"
                onClick={() => removeDiscount(i)}
                className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Totals breakdown ─────────────────────────────────────────── */}
      <div className="space-y-2">

        {/* Subtotal (raw) */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Subtotal (Taxable)</span>
          <span className="text-sm text-gray-700 tabular-nums">{formatINR(taxableRaw)}</span>
        </div>

        {/* Header discount total */}
        {hasHeaderDiscount && (
          <div className="flex justify-between items-center text-red-600">
            <span className="text-sm">(-) Discounts</span>
            <span className="text-sm tabular-nums">−{formatINR(headerDiscountTotal)}</span>
          </div>
        )}

        {/* Net taxable (after header discounts) */}
        {hasHeaderDiscount && (
          <div className="flex justify-between items-center font-medium">
            <span className="text-sm text-gray-600">Net Taxable</span>
            <span className="text-sm text-gray-900 tabular-nums">{formatINR(taxableAfterDiscounts)}</span>
          </div>
        )}

        {/* GST breakdown */}
        {isSimple ? (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">{simpleGstLabel}</span>
            <span className="text-sm text-gray-700 tabular-nums">{formatINR(totalGst)}</span>
          </div>
        ) : (
          <>
            {isIntra && parseFloat(cgstTotal) > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">CGST</span>
                <span className="text-sm text-gray-700 tabular-nums">{formatINR(cgstTotal)}</span>
              </div>
            )}
            {isIntra && parseFloat(sgstTotal) > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">SGST</span>
                <span className="text-sm text-gray-700 tabular-nums">{formatINR(sgstTotal)}</span>
              </div>
            )}
            {isInter && parseFloat(igstTotal) > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">IGST</span>
                <span className="text-sm text-gray-700 tabular-nums">{formatINR(igstTotal)}</span>
              </div>
            )}
            {!isIntra && !isInter && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">GST</span>
                <span className="text-sm text-gray-300 tabular-nums">₹0.00</span>
              </div>
            )}
          </>
        )}

        {/* ── CR-014: Freight ── (advanced) */}
        {!isSimple && (
          <div className="border-t border-gray-100 pt-2 mt-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 w-20 shrink-0">Freight ₹</span>
              <Controller
                control={control}
                name="freightAmount"
                render={({ field: f }) => (
                  <Input
                    {...f}
                    value={f.value ?? '0'}
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    className="h-7 text-xs w-24 text-right"
                  />
                )}
              />
              <span className="text-xs text-gray-400">@ GST</span>
              <Controller
                control={control}
                name="freightGstRate"
                render={({ field: f }) => (
                  <select
                    value={String(f.value ?? 18)}
                    onChange={(e) => f.onChange(parseFloat(e.target.value))}
                    className="h-7 border border-gray-200 rounded px-1.5 text-xs text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    {FREIGHT_GST_RATES.map((r) => (
                      <option key={r} value={r}>{r}%</option>
                    ))}
                  </select>
                )}
              />
              {hasFreightGst && (
                <span className="text-xs text-gray-500 ml-auto tabular-nums">
                  +{formatINR(freightGstAmt)} tax
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── CR-015: TCS ── (advanced) */}
        {!isSimple && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 w-20 shrink-0">TCS %</span>
            <Controller
              control={control}
              name="tcsRate"
              render={({ field: f }) => (
                <Input
                  {...f}
                  value={f.value ?? '0'}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="0"
                  className="h-7 text-xs w-20 text-right"
                />
              )}
            />
            {hasTcs && (
              <span className="text-sm text-gray-700 tabular-nums ml-auto">
                {formatINR(tcsAmt)}
              </span>
            )}
          </div>
        )}

        {/* ── CR-016: Round off ── */}
        {!isSimple && (
          <div className="flex items-center gap-2 border-t border-gray-100 pt-2">
            <span className="text-sm text-gray-500 w-20 shrink-0">Round off</span>
            <Controller
              control={control}
              name="roundOffMode"
              render={({ field: f }) => (
                <select
                  value={(f.value as string) ?? 'AUTO'}
                  onChange={(e) => f.onChange(e.target.value)}
                  className="h-7 border border-gray-200 rounded px-1.5 text-xs text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="AUTO">Auto</option>
                  <option value="MANUAL">Manual</option>
                </select>
              )}
            />
            {roundOffMode === 'MANUAL' ? (
              <Controller
                control={control}
                name="roundOffManual"
                render={({ field: f }) => (
                  <Input
                    {...f}
                    value={f.value ?? '0'}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="h-7 text-xs w-20 text-right"
                  />
                )}
              />
            ) : (
              hasRoundOff && (
                <span className={cn(
                  'text-sm tabular-nums ml-auto',
                  parseFloat(roundOff) > 0 ? 'text-gray-700' : 'text-gray-500'
                )}>
                  {parseFloat(roundOff) > 0 ? '+' : ''}{formatINR(roundOff)}
                </span>
              )
            )}
          </div>
        )}

        {/* Simple-mode round off */}
        {isSimple && hasRoundOff && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Round Off</span>
            <span className="text-sm text-gray-700 tabular-nums">
              {parseFloat(roundOff) > 0 ? '+' : ''}{formatINR(roundOff)}
            </span>
          </div>
        )}

        {/* ── Grand Total ── */}
        <div className="flex justify-between items-center border-t border-gray-200 pt-3 mt-2">
          <span className="text-base font-semibold text-gray-900">Grand Total</span>
          <span className="text-base font-semibold text-gray-900 tabular-nums">
            {formatINR(grandTotal)}
          </span>
        </div>

        {/* ── CR-018: Supplier balance ── */}
        {(previousBalance || currentBalance) && (
          <div className="border-t border-gray-100 pt-3 mt-1 space-y-1.5">
            {previousBalance && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Previous Balance</span>
                <span className="text-xs text-gray-500 tabular-nums">{formatINR(previousBalance)}</span>
              </div>
            )}
            {currentBalance && (
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-gray-600">Payable After This Bill</span>
                <span className="text-xs font-semibold text-gray-800 tabular-nums">{formatINR(currentBalance)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
