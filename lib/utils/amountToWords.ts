/**
 * amountToWords.ts
 *
 * Converts a Decimal monetary amount to Indian English words.
 * Uses the to-words package with en-IN locale for correct lakh/crore system.
 *
 * Example: amountToWords(new Decimal(5900)) → "Five Thousand Nine Hundred Rupees Only"
 *
 * Used by: lib/services/PDFTemplates/SalesInvoicePDF.tsx for "Amount in Words" line.
 * Do NOT import in any "use client" component.
 */
import { Decimal } from 'decimal.js'
import { ToWords } from 'to-words'

const toWords = new ToWords({
  localeCode: 'en-IN',
  converterOptions: {
    currency: true,
    ignoreDecimal: false,
    currencyOptions: {
      name: 'Rupee',
      plural: 'Rupees',
      symbol: '₹',
      fractionalUnit: {
        name: 'Paise',
        plural: 'Paise',
        symbol: 'p',
      },
    },
  },
})

/**
 * Convert a Decimal monetary amount to Indian English words.
 * @param amount - Decimal amount (supports paise as fractional units)
 * @returns string e.g. "Five Thousand Nine Hundred Rupees Only"
 */
export function amountToWords(amount: Decimal): string {
  return toWords.convert(amount.toNumber())
}
