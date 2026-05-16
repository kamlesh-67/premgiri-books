/**
 * GSTCalculator.test.ts
 * Unit tests for calculateGST — pure function, no DB, no mocks needed.
 */

import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import { calculateGST } from './GSTCalculator'
import type { GSTParams } from './GSTCalculator'

// ─── Helper ───────────────────────────────────────────────────────────────────

function params(
  taxableValue: string,
  gstRate: string,
  companyState: string,
  partyState: string,
  overrides?: Partial<GSTParams>
): GSTParams {
  return {
    taxableValue: new Decimal(taxableValue),
    gstRate: new Decimal(gstRate),
    companyStateCode: companyState,
    partyStateCode: partyState,
    ...overrides,
  }
}

// ─── INTRA_STATE ──────────────────────────────────────────────────────────────

describe('calculateGST — INTRA_STATE', () => {
  it('18% intra-state splits CGST 900 / SGST 900 on taxableValue 10000', () => {
    const result = calculateGST(params('10000', '18', '29', '29'))
    expect(result.taxType).toBe('INTRA_STATE')
    expect(result.cgst.toString()).toBe('900')
    expect(result.sgst.toString()).toBe('900')
    expect(result.igst.toString()).toBe('0')
  })

  it('5% intra-state splits CGST 25 / SGST 25 on taxableValue 1000', () => {
    const result = calculateGST(params('1000', '5', '29', '29'))
    expect(result.taxType).toBe('INTRA_STATE')
    expect(result.cgst.toString()).toBe('25')
    expect(result.sgst.toString()).toBe('25')
    expect(result.igst.toString()).toBe('0')
  })

  it('12% intra-state splits CGST 300 / SGST 300 on taxableValue 5000', () => {
    const result = calculateGST(params('5000', '12', '29', '29'))
    expect(result.taxType).toBe('INTRA_STATE')
    expect(result.cgst.toString()).toBe('300')
    expect(result.sgst.toString()).toBe('300')
    expect(result.igst.toString()).toBe('0')
  })

  it('28% intra-state splits CGST 14000 / SGST 14000 on taxableValue 100000', () => {
    const result = calculateGST(params('100000', '28', '29', '29'))
    expect(result.taxType).toBe('INTRA_STATE')
    expect(result.cgst.toString()).toBe('14000')
    expect(result.sgst.toString()).toBe('14000')
    expect(result.igst.toString()).toBe('0')
  })

  it('cgstRate and sgstRate equal half of gstRate (9% each for 18%)', () => {
    const result = calculateGST(params('10000', '18', '29', '29'))
    expect(result.cgstRate.toString()).toBe('9')
    expect(result.sgstRate.toString()).toBe('9')
  })

  it('igst is zero for intra-state', () => {
    const result = calculateGST(params('10000', '18', '29', '29'))
    expect(result.igst.toString()).toBe('0')
    expect(result.igstRate.toString()).toBe('0')
  })
})

// ─── INTER_STATE ──────────────────────────────────────────────────────────────

describe('calculateGST — INTER_STATE', () => {
  it('18% inter-state yields IGST 1800 on taxableValue 10000', () => {
    const result = calculateGST(params('10000', '18', '29', '27'))
    expect(result.taxType).toBe('INTER_STATE')
    expect(result.igst.toString()).toBe('1800')
    expect(result.cgst.toString()).toBe('0')
    expect(result.sgst.toString()).toBe('0')
  })

  it('12% inter-state yields IGST 600 on taxableValue 5000', () => {
    const result = calculateGST(params('5000', '12', '29', '27'))
    expect(result.taxType).toBe('INTER_STATE')
    expect(result.igst.toString()).toBe('600')
  })

  it('cgst and sgst are zero for inter-state', () => {
    const result = calculateGST(params('10000', '18', '29', '27'))
    expect(result.cgst.toString()).toBe('0')
    expect(result.sgst.toString()).toBe('0')
    expect(result.cgstRate.toString()).toBe('0')
    expect(result.sgstRate.toString()).toBe('0')
  })

  it('igstRate equals gstRate for inter-state', () => {
    const result = calculateGST(params('10000', '18', '29', '27'))
    expect(result.igstRate.toString()).toBe('18')
  })
})

// ─── CGST + UTGST (Union Territory supplies) ──────────────────────────────────

describe('calculateGST — CGST+UTGST (Union Territory, state code 34)', () => {
  it('Puducherry intra-UT 18%: taxType INTRA_STATE, CGST=900 SGST=900 on 10000', () => {
    // State 34 = Puducherry (Union Territory). GST law uses CGST+UTGST for intra-UT.
    // GSTCalculator stores UTGST in the `sgst` field — amounts are mathematically identical.
    const result = calculateGST(params('10000', '18', '34', '34'))
    expect(result.taxType).toBe('INTRA_STATE')
    expect(result.cgst.toString()).toBe('900')
    expect(result.sgst.toString()).toBe('900')  // UTGST in tax law; stored as sgst in code
    expect(result.igst.toString()).toBe('0')
  })

  it('Puducherry seller (34) to buyer in different state (27) is INTER_STATE → IGST only', () => {
    const result = calculateGST(params('10000', '18', '34', '27'))
    expect(result.taxType).toBe('INTER_STATE')
    expect(result.cgst.toString()).toBe('0')
    expect(result.sgst.toString()).toBe('0')
    expect(result.igst.toString()).toBe('1800')
  })

  it('Puducherry intra-UT 5%: CGST=25 SGST=25 on taxableValue 1000', () => {
    const result = calculateGST(params('1000', '5', '34', '34'))
    expect(result.taxType).toBe('INTRA_STATE')
    expect(result.cgst.toString()).toBe('25')
    expect(result.sgst.toString()).toBe('25')
    expect(result.igst.toString()).toBe('0')
  })
})

// ─── ZERO_RATED (export) ──────────────────────────────────────────────────────

describe('calculateGST — ZERO_RATED (export)', () => {
  it('isExport=true returns all zero amounts and taxType ZERO_RATED regardless of rate', () => {
    const result = calculateGST(params('10000', '18', '29', '27', { isExport: true }))
    expect(result.taxType).toBe('ZERO_RATED')
    expect(result.cgst.toString()).toBe('0')
    expect(result.sgst.toString()).toBe('0')
    expect(result.igst.toString()).toBe('0')
    expect(result.cgstRate.toString()).toBe('0')
    expect(result.sgstRate.toString()).toBe('0')
    expect(result.igstRate.toString()).toBe('0')
  })

  it('isExport=true takes priority over isNilRated=true — result is ZERO_RATED not EXEMPT', () => {
    const result = calculateGST(
      params('10000', '18', '29', '27', { isExport: true, isNilRated: true })
    )
    expect(result.taxType).toBe('ZERO_RATED')
  })
})

// ─── EXEMPT ───────────────────────────────────────────────────────────────────

describe('calculateGST — EXEMPT', () => {
  it('isNilRated=true with positive gstRate returns EXEMPT with all zero amounts', () => {
    const result = calculateGST(params('10000', '18', '29', '29', { isNilRated: true }))
    expect(result.taxType).toBe('EXEMPT')
    expect(result.cgst.toString()).toBe('0')
    expect(result.sgst.toString()).toBe('0')
    expect(result.igst.toString()).toBe('0')
  })

  it('gstRate=0 returns EXEMPT with all zero amounts', () => {
    const result = calculateGST(params('10000', '0', '29', '29'))
    expect(result.taxType).toBe('EXEMPT')
    expect(result.cgst.toString()).toBe('0')
    expect(result.sgst.toString()).toBe('0')
    expect(result.igst.toString()).toBe('0')
  })
})

// ─── Reverse Charge Mechanism ─────────────────────────────────────────────────

describe('calculateGST — Reverse Charge Mechanism', () => {
  it('reverseCharge=true does not change computed CGST/SGST amounts (intra-state 18% on 10000 still yields 900/900)', () => {
    const result = calculateGST(params('10000', '18', '29', '29', { reverseCharge: true }))
    expect(result.cgst.toString()).toBe('900')
    expect(result.sgst.toString()).toBe('900')
    expect(result.igst.toString()).toBe('0')
  })

  it('reverseCharge=true does not change taxType', () => {
    const result = calculateGST(params('10000', '18', '29', '29', { reverseCharge: true }))
    expect(result.taxType).toBe('INTRA_STATE')
  })
})
