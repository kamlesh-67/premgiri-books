import { describe, it, expect } from 'vitest'
// amountToWords does not exist yet — this import will fail (RED)
import { amountToWords } from '@/lib/utils/amountToWords'
import { Decimal } from 'decimal.js'

describe('amountToWords', () => {
  it('converts whole rupee amount to Indian words', () => {
    // to-words en-IN locale produces "Five Thousand Nine Hundred Rupees Only"
    // (amount first, then "Rupees", then "Only" — different from "Rupees ... Only" prefix format)
    expect(amountToWords(new Decimal(5900))).toContain('Five Thousand Nine Hundred')
  })

  it('converts lakh amount to Indian words', () => {
    const result = amountToWords(new Decimal(123456.5))
    expect(result).toContain('Lakh')
    expect(result).toContain('Twenty Three Thousand')
  })

  it('handles zero amount', () => {
    const result = amountToWords(new Decimal(0))
    expect(result).toContain('Zero')
  })
})
