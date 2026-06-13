'use client'

import { Decimal } from 'decimal.js'
import { formatINR } from '@/lib/utils/format'
import type { GSTTaxType } from '@/lib/services/GSTCalculator'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GSTSummaryPanelProps {
  taxableTotal: string   // Decimal.toFixed(2) string
  cgstTotal: string
  sgstTotal: string
  igstTotal: string
  roundOff: string       // Decimal(5,2) — ±₹999.99
  grandTotal: string
  taxType: GSTTaxType
  uiMode: 'simple' | 'advanced'
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GSTSummaryPanel({
  taxableTotal,
  cgstTotal,
  sgstTotal,
  igstTotal,
  roundOff,
  grandTotal,
  taxType,
  uiMode,
}: GSTSummaryPanelProps) {
  const isSimple = uiMode === 'simple'
  const isIntra = taxType === 'INTRA_STATE'
  const isInter = taxType === 'INTER_STATE'
  const hasRoundOff = new Decimal(String(roundOff || '0')).toNumber() !== 0

  // GST label in Simple Mode
  const simpleGSTLabel = (() => {
    if (taxType === 'INTRA_STATE') return 'GST (CGST + SGST)'
    if (taxType === 'INTER_STATE') return 'GST (IGST)'
    return 'GST'
  })()

  // Helper to format with high precision if needed
  const formatPrecise = (val: string) => {
    const num = new Decimal(String(val || '0')).toNumber();
    if (isNaN(num)) return "₹0.00";
    const parts = val.split('.');
    if (parts.length > 1 && parts[1].length > 2) {
      return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: parts[1].length, maximumFractionDigits: parts[1].length })}`;
    }
    return formatINR(val);
  };

  // GST total for simple mode display
  const totalGST = (() => {
    const cgst = new Decimal(cgstTotal || '0')
    const sgst = new Decimal(sgstTotal || '0')
    const igst = new Decimal(igstTotal || '0')
    return cgst.plus(sgst).plus(igst).toString()
  })()

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
      <div className="space-y-2">
        {/* Subtotal / Taxable Value */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Subtotal (Taxable Value)</span>
          <span className="text-sm text-gray-700 tabular-nums">
            {formatINR(taxableTotal)}
          </span>
        </div>

        {isSimple ? (
          /* Simple Mode: single GST line */
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">{simpleGSTLabel}</span>
            <span className="text-sm text-gray-700 tabular-nums">
              {formatPrecise(totalGST)}
            </span>
          </div>
        ) : (
          /* Advanced Mode: split CGST/SGST or IGST */
          <>
            {isIntra && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">CGST</span>
                  <span className="text-sm text-gray-700 tabular-nums">
                    {formatPrecise(cgstTotal)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">SGST</span>
                  <span className="text-sm text-gray-700 tabular-nums">
                    {formatPrecise(sgstTotal)}
                  </span>
                </div>
              </>
            )}
            {isInter && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">IGST</span>
                <span className="text-sm text-gray-700 tabular-nums">
                  {formatPrecise(igstTotal)}
                </span>
              </div>
            )}
            {!isIntra && !isInter && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">GST</span>
                <span className="text-sm text-gray-700 tabular-nums">₹0.00</span>
              </div>
            )}
          </>
        )}

        {/* Round Off — only show when non-zero */}
        {hasRoundOff && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Round Off</span>
            <span className="text-sm text-gray-700 tabular-nums">
              {formatINR(roundOff)}
            </span>
          </div>
        )}

        {/* Grand Total */}
        <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-2">
          <span className="text-base font-semibold text-gray-900">Grand Total</span>
          <span className="text-base font-semibold text-gray-900 tabular-nums">
            {formatINR(grandTotal)}
          </span>
        </div>
      </div>
    </div>
  )
}
