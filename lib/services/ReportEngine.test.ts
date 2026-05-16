/**
 * ReportEngine.test.ts
 * Unit tests for the two pure exported functions: validateTrialBalance and getAgeingBucket.
 * No Prisma mocking required — both functions are synchronous and have no DB calls.
 */

import { describe, it, expect, vi } from 'vitest'
import { Decimal } from 'decimal.js'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('exceljs', () => ({
  default: class Workbook {
    creator = ''
    created = new Date()
    addWorksheet() {
      return {
        addRow: vi.fn().mockReturnValue({ font: {}, fill: {} }),
        getColumn: vi.fn().mockReturnValue({ alignment: {}, numFmt: '', width: 0 }),
      }
    }
    xlsx = { writeBuffer: vi.fn().mockResolvedValue(Buffer.from('')) }
  },
}))
vi.mock('@/lib/utils/fy', () => ({
  getFYStart: vi.fn().mockReturnValue(new Date('2024-04-01')),
  getFYEnd: vi.fn().mockReturnValue(new Date('2025-03-31')),
}))

import { validateTrialBalance, getAgeingBucket } from './ReportEngine'
import type { TrialBalanceRow } from './ReportEngine'

// ─── Helper ───────────────────────────────────────────────────────────────────

function row(closingDR: string, closingCR: string): TrialBalanceRow {
  return {
    ledgerId: 'l-1',
    name: 'Test',
    groupName: 'Assets',
    openingDR: new Decimal(0),
    openingCR: new Decimal(0),
    periodDR: new Decimal(0),
    periodCR: new Decimal(0),
    closingDR: new Decimal(closingDR),
    closingCR: new Decimal(closingCR),
  }
}

// ─── validateTrialBalance ─────────────────────────────────────────────────────

describe('validateTrialBalance', () => {
  it('returns true for empty rows array', () => {
    expect(validateTrialBalance([])).toBe(true)
  })

  it('returns true when single row has equal DR and CR (e.g., DR=1000, CR=1000)', () => {
    expect(validateTrialBalance([row('1000', '1000')])).toBe(true)
  })

  it('returns true for two rows where total DR equals total CR (e.g., 5000 DR + 3000 DR vs 6000 CR + 2000 CR)', () => {
    const rows: TrialBalanceRow[] = [
      row('5000', '0'),
      row('3000', '0'),
      row('0', '6000'),
      row('0', '2000'),
    ]
    expect(validateTrialBalance(rows)).toBe(true)
  })

  it('returns false when total DR does not equal total CR', () => {
    const rows: TrialBalanceRow[] = [
      row('5000', '0'),
      row('0', '4000'),
    ]
    expect(validateTrialBalance(rows)).toBe(false)
  })

  it('handles Decimal precision: Decimal("100.001") DR and Decimal("100.001") CR returns true', () => {
    expect(validateTrialBalance([row('100.001', '100.001')])).toBe(true)
  })
})

// ─── getAgeingBucket ──────────────────────────────────────────────────────────

describe('getAgeingBucket', () => {
  it('returns current for daysOverdue = 0', () => {
    expect(getAgeingBucket(0)).toBe('current')
  })

  it('returns current for negative daysOverdue (bill not yet due)', () => {
    expect(getAgeingBucket(-5)).toBe('current')
  })

  it('returns 1-30 for daysOverdue = 1', () => {
    expect(getAgeingBucket(1)).toBe('1-30')
  })

  it('returns 1-30 for daysOverdue = 30 (boundary inclusive)', () => {
    expect(getAgeingBucket(30)).toBe('1-30')
  })

  it('returns 31-60 for daysOverdue = 31', () => {
    expect(getAgeingBucket(31)).toBe('31-60')
  })

  it('returns 31-60 for daysOverdue = 60 (boundary inclusive)', () => {
    expect(getAgeingBucket(60)).toBe('31-60')
  })

  it('returns 61-90 for daysOverdue = 61', () => {
    expect(getAgeingBucket(61)).toBe('61-90')
  })

  it('returns 61-90 for daysOverdue = 90 (boundary inclusive)', () => {
    expect(getAgeingBucket(90)).toBe('61-90')
  })

  it('returns 90+ for daysOverdue = 91', () => {
    expect(getAgeingBucket(91)).toBe('90+')
  })

  it('returns 90+ for daysOverdue = 365 (one year overdue)', () => {
    expect(getAgeingBucket(365)).toBe('90+')
  })
})
