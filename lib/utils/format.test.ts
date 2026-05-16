import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { formatINR } from '@/lib/utils/format'

describe('formatINR — Indian lakh system', () => {
  it('formats thousands', () => {
    expect(formatINR(1000)).toBe('₹1,000.00')
  })

  it('formats lakhs', () => {
    expect(formatINR(123456)).toBe('₹1,23,456.00')
  })

  it('formats crore boundary', () => {
    expect(formatINR(1234567)).toBe('₹12,34,567.00')
  })

  it('formats Decimal input', () => {
    expect(formatINR(new Decimal('123456.50'))).toBe('₹1,23,456.50')
  })

  it('formats zero', () => {
    expect(formatINR(0)).toBe('₹0.00')
  })

  it('formats string input', () => {
    expect(formatINR('99999.99')).toBe('₹99,999.99')
  })
})
