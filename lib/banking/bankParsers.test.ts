/**
 * bankParsers.test.ts
 *
 * Unit tests for parseCsvToRows() and normalizeAmount() in bankParsers.ts.
 * Uses inline CSV strings as fixtures — no file I/O needed.
 *
 * RED phase: written before bankParsers.ts exists.
 */
import { describe, it, expect } from 'vitest'
import {
  BANK_PARSERS,
  parseCsvToRows,
  normalizeAmount,
  type BankName,
  type BankParserConfig,
  type ParsedRow,
} from './bankParsers'
import { Decimal } from 'decimal.js'

// ---------------------------------------------------------------------------
// normalizeAmount
// ---------------------------------------------------------------------------

describe('normalizeAmount', () => {
  it('parses plain number string', () => {
    const result = normalizeAmount('1234.56')
    expect(result).not.toBeNull()
    expect(result!.toString()).toBe('1234.56')
  })

  it('strips Indian lakh comma formatting', () => {
    const result = normalizeAmount('1,23,456.78')
    expect(result).not.toBeNull()
    expect(result!.toString()).toBe('123456.78')
  })

  it('strips spaces from amount string', () => {
    const result = normalizeAmount('  5000.00  ')
    expect(result).not.toBeNull()
    expect(result!.toString()).toBe('5000')
  })

  it('returns null for empty string', () => {
    expect(normalizeAmount('')).toBeNull()
  })

  it('returns null for dash', () => {
    expect(normalizeAmount('-')).toBeNull()
  })

  it('returns null for whitespace-only string', () => {
    expect(normalizeAmount('   ')).toBeNull()
  })

  it('returns null for zero-length after strip (commas only)', () => {
    expect(normalizeAmount(',,')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// BANK_PARSERS — config correctness
// ---------------------------------------------------------------------------

describe('BANK_PARSERS', () => {
  it('has exactly 5 keys', () => {
    expect(Object.keys(BANK_PARSERS)).toHaveLength(5)
  })

  it('has all 5 bank names', () => {
    const banks: BankName[] = ['SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak']
    for (const bank of banks) {
      expect(BANK_PARSERS[bank]).toBeDefined()
    }
  })

  it('SBI config: dateCol=0, skipRows=2, encoding=latin1', () => {
    const cfg = BANK_PARSERS.SBI
    expect(cfg.dateCol).toBe(0)
    expect(cfg.skipRows).toBe(2)
    expect(cfg.encoding).toBe('latin1')
  })

  it('SBI config: debitCol=3, creditCol=4, balanceCol=5', () => {
    const cfg = BANK_PARSERS.SBI
    expect(cfg.debitCol).toBe(3)
    expect(cfg.creditCol).toBe(4)
    expect(cfg.balanceCol).toBe(5)
  })

  it('HDFC config: skipRows=23, dateFormat=dd/MM/yy', () => {
    const cfg = BANK_PARSERS.HDFC
    expect(cfg.skipRows).toBe(23)
    expect(cfg.dateFormat).toBe('dd/MM/yy')
  })

  it('HDFC config: descriptionCol=Narration', () => {
    const cfg = BANK_PARSERS.HDFC
    expect(cfg.descriptionCol).toBe('Narration')
  })

  it('ICICI config: skipRows=1, dateFormat=dd/MM/yyyy', () => {
    const cfg = BANK_PARSERS.ICICI
    expect(cfg.skipRows).toBe(1)
    expect(cfg.dateFormat).toBe('dd/MM/yyyy')
  })

  it('Axis config: skipRows=1, dateFormat=dd-MM-yyyy', () => {
    const cfg = BANK_PARSERS.Axis
    expect(cfg.skipRows).toBe(1)
    expect(cfg.dateFormat).toBe('dd-MM-yyyy')
  })

  it('Kotak config: skipRows=1, dateFormat=dd-MM-yyyy', () => {
    const cfg = BANK_PARSERS.Kotak
    expect(cfg.skipRows).toBe(1)
    expect(cfg.dateFormat).toBe('dd-MM-yyyy')
  })
})

// ---------------------------------------------------------------------------
// parseCsvToRows — SBI (numeric column indices)
// ---------------------------------------------------------------------------

describe('parseCsvToRows — SBI', () => {
  // SBI CSV format: skip 2 rows, then data
  // Cols: 0=Date, 1=Narration, 2=Ref, 3=Debit, 4=Credit, 5=Balance
  const sbiCsv = `Account Number,123456789
Bank Name,State Bank of India
05 Apr 2025,NEFT/CR/ABC,REF001,,"1,00,000.00","5,50,000.00"
10 Apr 2025,UPI/DEBIT/XYZ,REF002,"25,000.00",,"`

  it('parses credit transaction correctly', () => {
    const rows = parseCsvToRows(sbiCsv, 'SBI')
    expect(rows.length).toBeGreaterThanOrEqual(1)
    const row = rows[0]
    expect(row.txDate).toBeInstanceOf(Date)
    expect(row.txDate.getFullYear()).toBe(2025)
    expect(row.txDate.getMonth()).toBe(3) // April = 3 (0-indexed)
    expect(row.txDate.getDate()).toBe(5)
    expect(row.creditAmount).not.toBeNull()
    expect(row.creditAmount!.toString()).toBe('100000')
    expect(row.debitAmount).toBeNull()
  })

  it('parses debit transaction correctly', () => {
    const rows = parseCsvToRows(sbiCsv, 'SBI')
    const row = rows[1]
    expect(row.debitAmount).not.toBeNull()
    expect(row.debitAmount!.toString()).toBe('25000')
    expect(row.creditAmount).toBeNull()
  })

  it('parses Indian lakh amount: 1,23,456.78 → Decimal("123456.78")', () => {
    const csv = `Header row 1
Header row 2
05 Apr 2025,NEFT,REF,"1,23,456.78",,`
    const rows = parseCsvToRows(csv, 'SBI')
    expect(rows).toHaveLength(1)
    expect(rows[0].debitAmount!.toString()).toBe('123456.78')
  })

  it('skips rows with invalid dates', () => {
    const csv = `Header row 1
Header row 2
INVALID DATE,NEFT,REF,"1000.00",,
06 Apr 2025,NEFT,REF,"500.00",,`
    const rows = parseCsvToRows(csv, 'SBI')
    // Only the valid row should be returned
    expect(rows).toHaveLength(1)
    expect(rows[0].txDate.getDate()).toBe(6)
  })

  it('returns empty/dash amounts as null', () => {
    const csv = `Header row 1
Header row 2
07 Apr 2025,NEFT,REF,-,"1,000.00",`
    const rows = parseCsvToRows(csv, 'SBI')
    expect(rows).toHaveLength(1)
    expect(rows[0].debitAmount).toBeNull()
    expect(rows[0].creditAmount!.toString()).toBe('1000')
  })
})

// ---------------------------------------------------------------------------
// parseCsvToRows — HDFC (header-name columns, skipRows=23)
// ---------------------------------------------------------------------------

describe('parseCsvToRows — HDFC', () => {
  // HDFC: skipRows=23 means the header row is at index 22 (0-based),
  // so we need 22 metadata rows followed by the header row at position 22,
  // then data rows starting at position 23.
  // Array(22) gives 22 metadata rows (indices 0-21), header at index 22.
  const hdfcHeaderRows = Array(22).fill('metadata row').join('\n')
  const hdfcCsv = `${hdfcHeaderRows}
Date,Narration,Value Dat,Debit Amount,Credit Amount,Closing Balance
01/04/25,NEFT/IN/XYZ,,,"50,000.00","2,00,000.00"
02/04/25,UPI/OUT/ABC,,"15,000.00",,"1,85,000.00"`

  it('parses HDFC credit row correctly', () => {
    const rows = parseCsvToRows(hdfcCsv, 'HDFC')
    expect(rows.length).toBeGreaterThanOrEqual(1)
    const row = rows[0]
    expect(row.txDate).toBeInstanceOf(Date)
    expect(row.txDate.getFullYear()).toBe(2025)
    expect(row.creditAmount).not.toBeNull()
    expect(row.creditAmount!.toString()).toBe('50000')
    expect(row.debitAmount).toBeNull()
  })

  it('parses HDFC debit row correctly', () => {
    const rows = parseCsvToRows(hdfcCsv, 'HDFC')
    expect(rows.length).toBeGreaterThanOrEqual(2)
    const row = rows[1]
    expect(row.debitAmount).not.toBeNull()
    expect(row.debitAmount!.toString()).toBe('15000')
    expect(row.creditAmount).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// parseCsvToRows — ICICI
// ---------------------------------------------------------------------------

describe('parseCsvToRows — ICICI', () => {
  const iciciCsv = `Transaction Date,Value Date,Description,Ref No./Cheque No.,Debit,Credit,Balance
05/04/2025,05/04/2025,NEFT INW,,,"75000.00","3,25,000.00"
06/04/2025,06/04/2025,IMPS OUT,,12000.00,,"3,13,000.00"`

  it('parses ICICI credit row correctly', () => {
    const rows = parseCsvToRows(iciciCsv, 'ICICI')
    expect(rows.length).toBeGreaterThanOrEqual(1)
    const row = rows[0]
    expect(row.txDate.getDate()).toBe(5)
    expect(row.txDate.getMonth()).toBe(3) // April
    expect(row.creditAmount!.toString()).toBe('75000')
    expect(row.debitAmount).toBeNull()
  })

  it('parses ICICI debit row correctly', () => {
    const rows = parseCsvToRows(iciciCsv, 'ICICI')
    const row = rows[1]
    expect(row.debitAmount!.toString()).toBe('12000')
    expect(row.creditAmount).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// parseCsvToRows — Axis
// ---------------------------------------------------------------------------

describe('parseCsvToRows — Axis', () => {
  const axisCsv = `Tran Date,CHQNO,PARTICULARS,DR,CR,BAL
05-04-2025,,UPI CREDIT,,"80000.00","4,00,000.00"
07-04-2025,,BILL PAYMENT,"22500.00",,"3,77,500.00"`

  it('parses Axis credit row correctly', () => {
    const rows = parseCsvToRows(axisCsv, 'Axis')
    expect(rows.length).toBeGreaterThanOrEqual(1)
    const row = rows[0]
    expect(row.txDate.getDate()).toBe(5)
    expect(row.txDate.getMonth()).toBe(3) // April
    expect(row.creditAmount!.toString()).toBe('80000')
    expect(row.debitAmount).toBeNull()
  })

  it('parses Axis debit row correctly', () => {
    const rows = parseCsvToRows(axisCsv, 'Axis')
    const row = rows[1]
    expect(row.debitAmount!.toString()).toBe('22500')
    expect(row.creditAmount).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// parseCsvToRows — Kotak
// ---------------------------------------------------------------------------

describe('parseCsvToRows — Kotak', () => {
  const kotakCsv = `Txn Date,Description,Ref No./Cheque No.,Debit,Credit,Balance
05-04-2025,NEFT CREDIT,,,"95000.00","5,95,000.00"
08-04-2025,ECS DEBIT,,"18000.00",,"5,77,000.00"`

  it('parses Kotak credit row correctly', () => {
    const rows = parseCsvToRows(kotakCsv, 'Kotak')
    expect(rows.length).toBeGreaterThanOrEqual(1)
    const row = rows[0]
    expect(row.txDate.getDate()).toBe(5)
    expect(row.creditAmount!.toString()).toBe('95000')
    expect(row.debitAmount).toBeNull()
  })

  it('parses Kotak debit row correctly', () => {
    const rows = parseCsvToRows(kotakCsv, 'Kotak')
    const row = rows[1]
    expect(row.debitAmount!.toString()).toBe('18000')
    expect(row.creditAmount).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// parseCsvToRows — ParsedRow shape
// ---------------------------------------------------------------------------

describe('ParsedRow shape', () => {
  it('row has all required fields', () => {
    const csv = `Header row 1
Header row 2
09 Apr 2025,UPI,REF,"500.00",,"2,000.00"`
    const rows = parseCsvToRows(csv, 'SBI')
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row).toHaveProperty('txDate')
    expect(row).toHaveProperty('description')
    expect(row).toHaveProperty('debitAmount')
    expect(row).toHaveProperty('creditAmount')
    expect(row).toHaveProperty('balance')
  })

  it('description is populated from narration column', () => {
    const csv = `Header row 1
Header row 2
09 Apr 2025,MY DESCRIPTION,REF,"500.00",,`
    const rows = parseCsvToRows(csv, 'SBI')
    expect(rows[0].description).toBe('MY DESCRIPTION')
  })
})
