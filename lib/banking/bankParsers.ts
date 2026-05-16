/**
 * bankParsers.ts
 *
 * 5 hardcoded bank CSV parser configurations for Indian banks:
 * SBI, HDFC, ICICI, Axis, Kotak.
 *
 * Exports:
 *   - BankName (union type)
 *   - BankParserConfig (config shape)
 *   - ParsedRow (output row shape)
 *   - BANK_PARSERS (Record<BankName, BankParserConfig>)
 *   - parseCsvToRows(csvText, bank): ParsedRow[]
 *   - normalizeAmount(raw): Decimal | null
 *
 * Rules:
 *   - No parseFloat() anywhere — all amounts go through Decimal constructor
 *   - No === comparison on Decimal values
 *   - SBI uses latin1 encoding (handled by caller via TextDecoder before calling parseCsvToRows)
 *   - Amount strings with Indian lakh commas (e.g. "1,23,456.78") are normalized before Decimal parsing
 *   - Rows with unparseable dates are silently skipped (not thrown)
 */

import Papa from 'papaparse'
import { parse } from 'date-fns'
import { Decimal } from 'decimal.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BankName = 'SBI' | 'HDFC' | 'ICICI' | 'Axis' | 'Kotak'

export type BankParserConfig = {
  bank: BankName
  /** Column index (zero-based) OR header name string */
  dateCol: string | number
  /** date-fns format string */
  dateFormat: string
  descriptionCol: string | number
  debitCol: string | number
  creditCol: string | number
  balanceCol?: string | number
  /** Number of header/metadata rows to skip before data rows begin */
  skipRows: number
  /** Default 'utf-8'; SBI uses 'latin1' */
  encoding?: 'utf-8' | 'latin1'
}

export type ParsedRow = {
  txDate: Date
  description: string
  debitAmount: Decimal | null
  creditAmount: Decimal | null
  balance: Decimal | null
}

// ---------------------------------------------------------------------------
// Bank parser configs
// Source: .planning/phases/07-banking/07-CONTEXT.md — specifics section
// ---------------------------------------------------------------------------

export const BANK_PARSERS: Record<BankName, BankParserConfig> = {
  SBI: {
    bank: 'SBI',
    dateCol: 0,
    dateFormat: 'dd MMM yyyy',
    descriptionCol: 1,
    debitCol: 3,
    creditCol: 4,
    balanceCol: 5,
    skipRows: 2,
    encoding: 'latin1',
  },
  HDFC: {
    bank: 'HDFC',
    dateCol: 'Date',
    dateFormat: 'dd/MM/yy',
    descriptionCol: 'Narration',
    debitCol: 'Debit Amount',
    creditCol: 'Credit Amount',
    balanceCol: 'Closing Balance',
    skipRows: 23,
    encoding: 'utf-8',
  },
  ICICI: {
    bank: 'ICICI',
    dateCol: 'Transaction Date',
    dateFormat: 'dd/MM/yyyy',
    descriptionCol: 'Description',
    debitCol: 'Debit',
    creditCol: 'Credit',
    balanceCol: 'Balance',
    skipRows: 1,
    encoding: 'utf-8',
  },
  Axis: {
    bank: 'Axis',
    dateCol: 'Tran Date',
    dateFormat: 'dd-MM-yyyy',
    descriptionCol: 'PARTICULARS',
    debitCol: 'DR',
    creditCol: 'CR',
    balanceCol: 'BAL',
    skipRows: 1,
    encoding: 'utf-8',
  },
  Kotak: {
    bank: 'Kotak',
    dateCol: 'Txn Date',
    dateFormat: 'dd-MM-yyyy',
    descriptionCol: 'Description',
    debitCol: 'Debit',
    creditCol: 'Credit',
    balanceCol: 'Balance',
    skipRows: 1,
    encoding: 'utf-8',
  },
}

// ---------------------------------------------------------------------------
// normalizeAmount
// ---------------------------------------------------------------------------

/**
 * Normalize a raw amount string from a bank CSV:
 * - Strips commas and spaces (Indian lakh formatting: "1,23,456.78" → "123456.78")
 * - Returns null for empty, dash, or whitespace-only strings
 * - Returns new Decimal(cleaned) for valid numeric strings
 *
 * NEVER calls parseFloat() — always uses Decimal constructor directly.
 */
export function normalizeAmount(raw: string): Decimal | null {
  // Remove commas and spaces first (Indian number format uses commas)
  const cleaned = raw.replace(/[, ]/g, '').trim()

  // Null for empty, dash, or zero-length after strip
  if (!cleaned || cleaned === '-') return null

  // Let Decimal parse — it will throw on non-numeric; catch means null
  try {
    return new Decimal(cleaned)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// parseCsvToRows
// ---------------------------------------------------------------------------

/**
 * Parse bank CSV text into typed ParsedRow objects.
 *
 * Strategy:
 * 1. Parse with Papa.parse (header:false, skipEmptyLines:true)
 * 2. Slice off config.skipRows header/metadata rows
 * 3. The LAST skipped row is the header row (for string-type column configs)
 * 4. For numeric column configs (SBI): use direct index
 * 5. For header-name configs: find column index by matching header row values
 * 6. For each data row: extract date, description, debit, credit, balance
 * 7. Parse date with date-fns; skip row if date is invalid
 * 8. Normalize amounts with normalizeAmount()
 *
 * @param csvText  Raw CSV text (SBI: already decoded from latin1 by caller)
 * @param bank     Bank name — selects parser config from BANK_PARSERS
 * @returns        Array of ParsedRow objects (invalid-date rows excluded)
 */
export function parseCsvToRows(csvText: string, bank: BankName): ParsedRow[] {
  const config = BANK_PARSERS[bank]

  const result = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
    dynamicTyping: false, // Always string — Decimal handles parsing
  })

  const allRows = result.data as string[][]

  // The header row is the last row we skip (row at index skipRows - 1)
  // Data rows start from index skipRows
  const headerRow: string[] = allRows[config.skipRows - 1] ?? []
  const dataRows: string[][] = allRows.slice(config.skipRows)

  // Build a header-name → column-index map (for string-type configs)
  const headerMap: Record<string, number> = {}
  for (let i = 0; i < headerRow.length; i++) {
    const key = (headerRow[i] ?? '').trim()
    if (key) headerMap[key] = i
  }

  /**
   * Resolve a config column specifier (number or string) to a column index.
   * Returns -1 if not found.
   */
  function resolveColIndex(col: string | number | undefined): number {
    if (col === undefined) return -1
    if (typeof col === 'number') return col
    // Header-name lookup
    return headerMap[col] ?? -1
  }

  const dateColIdx = resolveColIndex(config.dateCol)
  const descColIdx = resolveColIndex(config.descriptionCol)
  const debitColIdx = resolveColIndex(config.debitCol)
  const creditColIdx = resolveColIndex(config.creditCol)
  const balanceColIdx = config.balanceCol !== undefined ? resolveColIndex(config.balanceCol) : -1

  const rows: ParsedRow[] = []

  for (const row of dataRows) {
    const rawDate = (row[dateColIdx] ?? '').trim()
    const rawDesc = (row[descColIdx] ?? '').trim()
    const rawDebit = row[debitColIdx] ?? ''
    const rawCredit = row[creditColIdx] ?? ''
    const rawBalance = balanceColIdx >= 0 ? (row[balanceColIdx] ?? '') : ''

    // Parse date — skip row if invalid
    const txDate = parse(rawDate, config.dateFormat, new Date())
    if (isNaN(txDate.getTime())) continue

    const debitAmount = normalizeAmount(rawDebit)
    const creditAmount = normalizeAmount(rawCredit)
    const balance = rawBalance ? normalizeAmount(rawBalance) : null

    rows.push({
      txDate,
      description: rawDesc,
      debitAmount,
      creditAmount,
      balance,
    })
  }

  return rows
}
