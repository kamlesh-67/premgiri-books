/**
 * BankReconciliationPDF.tsx
 *
 * @react-pdf/renderer component for Bank Reconciliation Statement (BRS).
 * Renders the standard Indian BRS format per D-12 (07-CONTEXT.md).
 *
 * SERVER-ONLY: Do not import in any "use client" component.
 * Only import in: app/api/v1/bank-statements/[id]/pdf/route.ts
 *
 * Font registration via local TTF files — never CDN (ENOTFOUND risk in Vercel serverless).
 */
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer'
import { Decimal } from 'decimal.js'
import path from 'path'

// Register fonts at module scope — once on Node.js module load.
// NEVER use Google Fonts CDN URLs — ENOTFOUND risk in Vercel serverless (T-07-04-*).
Font.register({
  family: 'Inter',
  fonts: [
    { src: path.join(process.cwd(), 'public', 'fonts', 'Inter-Regular.ttf'), fontWeight: 400 },
    { src: path.join(process.cwd(), 'public', 'fonts', 'Inter-Bold.ttf'), fontWeight: 700 },
  ],
})

// ─── Types ────────────────────────────────────────────────────────────────────

export type BrsPdfProps = {
  company: { name: string; gstin: string | null; address: string | null; logoUrl?: string | null }
  statement: {
    bank: string
    ledgerName: string
    fromDate: string    // ISO date string
    toDate: string      // ISO date string
    bankClosingBalance: string    // toFixed(2) string
    booksClosingBalance: string   // toFixed(2) string
    difference: string            // toFixed(2) string
    isReconciled: boolean
  }
  unmatchedBankEntries: Array<{ txDate: string; description: string; amount: string }>
  unmatchedBookEntries: Array<{ voucherNo: string; date: string; amount: string; type: string }>
  partialLabel?: string    // if not fully reconciled: "Partial reconciliation as at [date]"
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format a pre-parsed numeric string as Indian lakh currency.
 * Amounts in BrsPdfProps are already toFixed(2) strings from the API layer.
 * Pure Node.js-safe — no ICU locale data dependency (safe in Vercel serverless).
 * Copied from PaySlipPDF.tsx — do NOT use toLocaleString('en-IN').
 */
function formatAmount(value: string): string {
  let d: Decimal
  try { d = new Decimal(value) } catch { return '₹0.00' }
  const negative = d.isNegative()
  const abs = d.abs()
  const [intPart, decPart = '00'] = abs.toFixed(2).split('.')
  const lastThree = intPart.slice(-3)
  const rest = intPart.slice(0, -3)
  const formatted = rest.length > 0
    ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
    : lastThree
  return (negative ? '(' : '') + '₹' + formatted + '.' + decPart + (negative ? ')' : '')
}

/**
 * Format an ISO date string as "DD MMM YYYY" (e.g., "30 Apr 2025").
 */
function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate)
    const day = String(d.getUTCDate()).padStart(2, '0')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const mon = months[d.getUTCMonth()]
    const year = d.getUTCFullYear()
    return `${day} ${mon} ${year}`
  } catch {
    return isoDate
  }
}

/**
 * Sum an array of amount strings (toFixed(2) format).
 * Returns formatted string.
 */
function sumAmounts(items: Array<{ amount: string }>): string {
  let total = new Decimal(0)
  for (const item of items) {
    try { total = total.plus(new Decimal(item.amount)) } catch { /* skip */ }
  }
  return total.toFixed(2)
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    padding: 36,
    fontFamily: 'Inter',
    fontSize: 9,
  },

  // Company header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  companyBlock: { flex: 1 },
  companyName: { fontSize: 14, fontWeight: 'bold', color: '#111827', marginBottom: 3 },
  companyDetail: { fontSize: 8, color: '#6B7280', marginBottom: 2 },

  // Document title
  titleBar: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#7C3AED',
    textAlign: 'center',
    paddingVertical: 7,
    borderTop: '1.5px solid #7C3AED',
    borderBottom: '1.5px solid #7C3AED',
    marginBottom: 12,
  },

  // Statement meta (bank, period)
  metaRow: { flexDirection: 'row', gap: 32, marginBottom: 14 },
  metaBlock: { flex: 1 },
  metaLabel: { fontSize: 8, color: '#6B7280', marginBottom: 2 },
  metaValue: { fontSize: 9, color: '#374151', fontWeight: 'bold' },

  // BRS table — add/less format
  brsTable: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
  },
  brsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  brsRowAlt: {
    backgroundColor: '#F9FAFB',
  },
  brsLabel: { fontSize: 9, color: '#374151' },
  brsLabelBold: { fontSize: 9, color: '#111827', fontWeight: 'bold' },
  brsAmount: { fontSize: 9, color: '#374151', textAlign: 'right', fontFamily: 'Inter' },
  brsAmountBold: { fontSize: 9, color: '#111827', fontWeight: 'bold', textAlign: 'right' },

  // Separator line (single)
  separator: {
    marginHorizontal: 12,
    marginVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  // Double separator
  doubleSeparator: {
    marginHorizontal: 12,
    marginVertical: 2,
    borderBottomWidth: 2,
    borderBottomColor: '#374151',
  },

  // Reconciliation status line
  statusRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
    borderRadius: 4,
  },
  statusReconciled: { backgroundColor: '#DCFCE7' },
  statusUnreconciled: { backgroundColor: '#FEE2E2' },
  statusTextReconciled: { fontSize: 9, color: '#15803D', fontWeight: 'bold' },
  statusTextUnreconciled: { fontSize: 9, color: '#B91C1C', fontWeight: 'bold' },

  // Supporting sections
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 6,
    marginTop: 12,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  // Support table
  supportTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  supportTableHeaderCell: { fontSize: 8, fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase' },
  supportTableRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  supportTableRowAlt: { backgroundColor: '#F9FAFB' },
  supportTableCell: { fontSize: 8, color: '#374151' },
  supportTableCellRight: { fontSize: 8, color: '#374151', textAlign: 'right' },

  // Footer
  footer: {
    marginTop: 'auto',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: { fontSize: 8, color: '#6B7280' },
  footerRight: { fontSize: 7, color: '#9CA3AF' },

  // Partial label
  partialLabel: { fontSize: 8, color: '#92400E', fontStyle: 'italic', marginBottom: 6 },
})

// ─── Component ────────────────────────────────────────────────────────────────

export function BankReconciliationPDF({
  company,
  statement,
  unmatchedBankEntries,
  unmatchedBookEntries,
  partialLabel,
}: BrsPdfProps) {
  const {
    bank,
    ledgerName,
    fromDate,
    toDate,
    bankClosingBalance,
    booksClosingBalance,
    difference,
    isReconciled,
  } = statement

  const unmatchedBankTotal = sumAmounts(unmatchedBankEntries)
  const unmatchedBookTotal = sumAmounts(unmatchedBookEntries)
  const totalUnmatched = unmatchedBankEntries.length + unmatchedBookEntries.length

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── Company Header ──────────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <View style={styles.companyBlock}>
            {company.logoUrl && (
              <Image
                src={company.logoUrl}
                style={{ width: 48, height: 48, objectFit: 'contain', marginBottom: 8 }}
              />
            )}
            <Text style={styles.companyName}>{company.name}</Text>
            {company.gstin && (
              <Text style={styles.companyDetail}>GSTIN: {company.gstin}</Text>
            )}
            {company.address && (
              <Text style={styles.companyDetail}>{company.address}</Text>
            )}
          </View>
        </View>

        {/* ── Document Title ─────────────────────────────────────────────── */}
        <Text style={styles.titleBar}>BANK RECONCILIATION STATEMENT</Text>

        {/* ── Statement Meta ─────────────────────────────────────────────── */}
        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Bank</Text>
            <Text style={styles.metaValue}>{ledgerName} ({bank})</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>As at</Text>
            <Text style={styles.metaValue}>{formatDate(toDate)}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Statement Period</Text>
            <Text style={styles.metaValue}>{formatDate(fromDate)} to {formatDate(toDate)}</Text>
          </View>
        </View>

        {/* ── BRS Table (Add/Less Indian Format per D-12) ─────────────────── */}
        <View style={styles.brsTable}>
          {/* Row 1: Balance as per Bank Statement */}
          <View style={styles.brsRow}>
            <Text style={styles.brsLabel}>Balance as per Bank Statement</Text>
            <Text style={styles.brsAmount}>{formatAmount(bankClosingBalance)}</Text>
          </View>

          {/* Row 2: Add — Deposits recorded in books not yet in bank */}
          <View style={[styles.brsRow, styles.brsRowAlt]}>
            <Text style={styles.brsLabel}>
              Add: Deposits recorded in books not yet in bank
              {unmatchedBookEntries.length > 0 ? ` (${unmatchedBookEntries.length} items)` : ''}
            </Text>
            <Text style={styles.brsAmount}>{formatAmount(unmatchedBookTotal)}</Text>
          </View>

          {/* Row 3: Less — Cheques issued but not yet presented */}
          <View style={styles.brsRow}>
            <Text style={styles.brsLabel}>
              Less: Cheques issued but not yet presented
              {unmatchedBankEntries.length > 0 ? ` (${unmatchedBankEntries.length} items)` : ''}
            </Text>
            <Text style={styles.brsAmount}>({formatAmount(unmatchedBankTotal)})</Text>
          </View>

          {/* Single separator */}
          <View style={styles.separator} />

          {/* Row 4: Balance as per Books (bold) */}
          <View style={styles.brsRow}>
            <Text style={styles.brsLabelBold}>Balance as per Books</Text>
            <Text style={styles.brsAmountBold}>{formatAmount(booksClosingBalance)}</Text>
          </View>

          {/* Double separator */}
          <View style={styles.doubleSeparator} />
        </View>

        {/* ── Reconciliation Status ──────────────────────────────────────── */}
        {partialLabel && (
          <Text style={styles.partialLabel}>{partialLabel}</Text>
        )}

        <View style={[styles.statusRow, isReconciled ? styles.statusReconciled : styles.statusUnreconciled]}>
          {isReconciled ? (
            <Text style={styles.statusTextReconciled}>
              Reconciled — Closing balances agree
            </Text>
          ) : (
            <Text style={styles.statusTextUnreconciled}>
              Difference: {formatAmount(difference)} — {totalUnmatched} unmatched item{totalUnmatched !== 1 ? 's' : ''} remaining
            </Text>
          )}
        </View>

        {/* ── Unmatched Bank Entries (bank transactions without book match) ─ */}
        {unmatchedBankEntries.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Unmatched Bank Entries ({unmatchedBankEntries.length} items)
            </Text>

            {/* Table header */}
            <View style={styles.supportTableHeader}>
              <Text style={[styles.supportTableHeaderCell, { width: '18%' }]}>Date</Text>
              <Text style={[styles.supportTableHeaderCell, { flex: 1 }]}>Description</Text>
              <Text style={[styles.supportTableHeaderCell, { width: '20%', textAlign: 'right' }]}>Amount</Text>
            </View>

            {/* Table rows */}
            {unmatchedBankEntries.map((entry, idx) => (
              <View
                key={idx}
                style={[styles.supportTableRow, idx % 2 === 1 ? styles.supportTableRowAlt : {}]}
              >
                <Text style={[styles.supportTableCell, { width: '18%' }]}>
                  {formatDate(entry.txDate)}
                </Text>
                <Text style={[styles.supportTableCell, { flex: 1 }]}>
                  {entry.description}
                </Text>
                <Text style={[styles.supportTableCellRight, { width: '20%' }]}>
                  {formatAmount(entry.amount)}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* ── Unmatched Book Entries (vouchers without bank match) ──────── */}
        {unmatchedBookEntries.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Unmatched Book Entries ({unmatchedBookEntries.length} items)
            </Text>

            {/* Table header */}
            <View style={styles.supportTableHeader}>
              <Text style={[styles.supportTableHeaderCell, { width: '18%' }]}>Date</Text>
              <Text style={[styles.supportTableHeaderCell, { width: '20%' }]}>Voucher No</Text>
              <Text style={[styles.supportTableHeaderCell, { width: '14%' }]}>Type</Text>
              <Text style={[styles.supportTableHeaderCell, { flex: 1, textAlign: 'right' }]}>Amount</Text>
            </View>

            {/* Table rows */}
            {unmatchedBookEntries.map((entry, idx) => (
              <View
                key={idx}
                style={[styles.supportTableRow, idx % 2 === 1 ? styles.supportTableRowAlt : {}]}
              >
                <Text style={[styles.supportTableCell, { width: '18%' }]}>
                  {formatDate(entry.date)}
                </Text>
                <Text style={[styles.supportTableCell, { width: '20%' }]}>
                  {entry.voucherNo}
                </Text>
                <Text style={[styles.supportTableCell, { width: '14%' }]}>
                  {entry.type}
                </Text>
                <Text style={[styles.supportTableCellRight, { flex: 1 }]}>
                  {formatAmount(entry.amount)}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerLeft}>
            {partialLabel ?? `Generated by PremGiri Books`}
          </Text>
          <Text
            style={styles.footerRight}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
            fixed
          />
        </View>

      </Page>
    </Document>
  )
}
