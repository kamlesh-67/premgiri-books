/**
 * Get the Indian financial year string for a given date.
 * April 1 – March 31. e.g., "2024-25"
 */
export function getFY(date: Date = new Date()): string {
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  return month >= 4
    ? `${year}-${String(year + 1).slice(-2)}`
    : `${year - 1}-${String(year).slice(-2)}`
}

/**
 * Get the start date of an Indian financial year.
 * "2024-25" → new Date("2024-04-01")
 */
export function getFYStart(fy: string): Date {
  const startYear = parseInt(fy.split('-')[0], 10)
  return new Date(`${startYear}-04-01`)
}

/**
 * Get the end date of an Indian financial year.
 * "2024-25" → new Date("2025-03-31")
 */
export function getFYEnd(fy: string): Date {
  const startYear = parseInt(fy.split('-')[0], 10)
  return new Date(`${startYear + 1}-03-31`)
}

/**
 * Get the GST return period string for a date.
 * Format: "MM/YYYY" e.g., "04/2024"
 */
export function getReturnPeriod(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${month}/${year}`
}
