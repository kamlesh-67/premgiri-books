import { Decimal } from 'decimal.js'

/**
 * Format a number/Decimal as Indian lakh currency.
 * Output: ₹1,23,456.00 (NOT ₹123,456.00 — Western million format is wrong)
 * Indian system: ones, thousands, then lakhs (groups of 2 after the first 3)
 * Examples: 1234567 → ₹12,34,567.00 | 123456 → ₹1,23,456.00 | 1000 → ₹1,000.00
 */
export function formatINR(value: number | Decimal | string): string {
  const num = new Decimal(value).toFixed(2)
  const [intPart, decPart] = num.split('.')

  // Indian lakh formatting: last 3 digits first, then groups of 2
  const lastThree = intPart.slice(-3)
  const remaining = intPart.slice(0, -3)
  const formatted =
    remaining.length > 0
      ? remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
      : lastThree

  return `₹${formatted}.${decPart}`
}

/**
 * Format a Date as DD/MM/YYYY (Indian date format).
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Format a Date as the Indian financial year display.
 * E.g., 2024-05-01 → "2024-25"
 */
export function formatFY(date: Date): string {
  const month = date.getMonth() + 1 // 1-indexed
  const year = date.getFullYear()
  if (month >= 4) {
    return `${year}-${String(year + 1).slice(-2)}`
  }
  return `${year - 1}-${String(year).slice(-2)}`
}

/**
 * Parse an INR-formatted string back to Decimal.
 * "₹1,23,456.00" → Decimal("123456.00")
 */
export function parseINR(formatted: string): Decimal {
  const cleaned = formatted.replace(/[₹,\s]/g, '')
  return new Decimal(cleaned)
}
