/**
 * GSTCalculator.ts
 *
 * Pure function for Indian GST calculations.
 * No side effects, no Prisma, no DB — deterministic math only.
 *
 * GST rules (CLAUDE.md non-negotiable):
 *  - Intra-state (same stateCode):  CGST = rate/2,  SGST = rate/2, IGST = 0
 *  - Inter-state (diff stateCode):  CGST = 0,       SGST = 0,      IGST = rate
 *  - Nil-rated / gstRate = 0:       all zeros, taxType = 'EXEMPT'
 *  - Export / isExport = true:      all zeros, taxType = 'ZERO_RATED'
 *
 * All amounts are Decimal instances (never plain JS numbers).
 */

import { Decimal } from 'decimal.js'

// ─── Public types ─────────────────────────────────────────────────────────────

export type GSTTaxType = 'INTRA_STATE' | 'INTER_STATE' | 'ZERO_RATED' | 'EXEMPT'

export interface GSTResult {
  /** CGST amount (Decimal) */
  cgst: Decimal
  /** SGST amount (Decimal) */
  sgst: Decimal
  /** IGST amount (Decimal) */
  igst: Decimal
  /** CGST rate percentage (e.g. Decimal("9") for 18% GST intra-state) */
  cgstRate: Decimal
  /** SGST rate percentage */
  sgstRate: Decimal
  /** IGST rate percentage */
  igstRate: Decimal
  /** Classification of the supply for GST purposes */
  taxType: GSTTaxType
}

export interface GSTParams {
  /** Base taxable value (excluding GST) */
  taxableValue: Decimal
  /** GST rate as a percentage (e.g. Decimal("18") for 18%) */
  gstRate: Decimal
  /** 2-digit state code of the company (from Company.stateCode) */
  companyStateCode: string
  /** 2-digit state code of the party / place of supply */
  partyStateCode: string
  /**
   * True for export supplies — results in ZERO_RATED regardless of rate.
   * Takes priority over all other flags.
   */
  isExport?: boolean
  /**
   * True for nil-rated items — results in EXEMPT even when gstRate > 0.
   * Checked after isExport.
   */
  isNilRated?: boolean
  /**
   * True when the buyer pays GST under Reverse Charge Mechanism.
   * GST amounts are computed normally; the caller must set the reverseCharge
   * flag on the GstTransaction row. This flag does NOT change tax amounts.
   */
  reverseCharge?: boolean
}

// ─── Implementation ───────────────────────────────────────────────────────────

const ZERO = new Decimal(0)

/**
 * Build a zero-tax result with the given tax type.
 */
function zeroResult(taxType: GSTTaxType): GSTResult {
  return {
    cgst: ZERO,
    sgst: ZERO,
    igst: ZERO,
    cgstRate: ZERO,
    sgstRate: ZERO,
    igstRate: ZERO,
    taxType,
  }
}

/**
 * Calculate GST amounts for a single line item.
 *
 * @param params - Supply parameters including taxable value, rate, and state codes.
 * @returns GSTResult with Decimal amounts and applicable rates.
 *
 * @example
 * // Intra-state 18% GST on ₹10,000
 * const result = calculateGST({
 *   taxableValue: new Decimal('10000'),
 *   gstRate: new Decimal('18'),
 *   companyStateCode: '29',
 *   partyStateCode: '29',
 * })
 * // result.cgst = Decimal(900), result.sgst = Decimal(900), result.igst = Decimal(0)
 */
export function calculateGST(params: GSTParams): GSTResult {
  const { taxableValue, gstRate, companyStateCode, partyStateCode, isExport, isNilRated } = params

  // 1. Export supplies → ZERO_RATED (no tax, but not exempt — can claim ITC refund)
  if (isExport) {
    return zeroResult('ZERO_RATED')
  }

  // 2. Nil-rated or zero-rate items → EXEMPT
  if (isNilRated || gstRate.isZero()) {
    return zeroResult('EXEMPT')
  }

  // 3. Compute total GST amount using Decimal arithmetic (never Float)
  const totalTax = taxableValue.times(gstRate.dividedBy(100))

  // 4. Intra-state: same state code → split into CGST + SGST
  if (companyStateCode === partyStateCode) {
    const halfTax = totalTax.dividedBy(2)
    const halfRate = gstRate.dividedBy(2)
    return {
      cgst: halfTax,
      sgst: halfTax,
      igst: ZERO,
      cgstRate: halfRate,
      sgstRate: halfRate,
      igstRate: ZERO,
      taxType: 'INTRA_STATE',
    }
  }

  // 5. Inter-state: different state codes → IGST only
  return {
    cgst: ZERO,
    sgst: ZERO,
    igst: totalTax,
    cgstRate: ZERO,
    sgstRate: ZERO,
    igstRate: gstRate,
    taxType: 'INTER_STATE',
  }
}
