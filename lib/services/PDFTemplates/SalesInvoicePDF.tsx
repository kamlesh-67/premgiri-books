/**
 * SalesInvoicePDF.tsx
 *
 * @react-pdf/renderer component for generating Sales Invoice PDFs.
 *
 * IMPORTANT: This file MUST NOT be imported in any "use client" component.
 * It uses Node.js-only modules via @react-pdf/renderer.
 *
 * Only import in: app/api/v1/vouchers/[id]/pdf/route.ts
 */
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer'
import { Decimal } from 'decimal.js'
import { amountToWords } from '@/lib/utils/amountToWords'
import path from 'path'

// Register fonts at module scope — called once when Node.js loads this module.
// NEVER use Google Fonts CDN URLs — ENOTFOUND risk in Vercel serverless (T-03-04-03).
Font.register({
  family: 'Inter',
  fonts: [
    { src: path.join(process.cwd(), 'public', 'fonts', 'Inter-Regular.ttf'), fontWeight: 400 },
    { src: path.join(process.cwd(), 'public', 'fonts', 'Inter-Bold.ttf'), fontWeight: 700 },
  ],
})

const styles = StyleSheet.create({
  // Page
  page: { backgroundColor: '#FFFFFF', padding: 40, fontFamily: 'Inter', fontSize: 9 },

  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, alignItems: 'flex-start' },
  companyName: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  companyDetail: { fontSize: 9, color: '#6B7280', marginBottom: 2 },
  logo: { width: 80, height: 40, objectFit: 'contain' },

  // Title bar
  titleBar: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    paddingVertical: 8,
    borderBottom: '1px solid #E5E7EB',
    borderTop: '1px solid #E5E7EB',
    marginBottom: 12,
  },

  // Invoice meta (number + date)
  invoiceMetaRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 32, marginBottom: 16 },
  metaBlock: { alignItems: 'flex-end' },
  metaLabel: { fontSize: 8, color: '#6B7280', marginBottom: 2 },
  metaValue: { fontSize: 9, color: '#374151', fontWeight: 'bold' },

  // Bill To
  billRow: {
    flexDirection: 'row',
    gap: 40,
    marginBottom: 16,
    borderBottom: '1px solid #E5E7EB',
    paddingBottom: 12,
  },
  billSection: { flex: 1 },
  billTitle: { fontSize: 8, fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase', marginBottom: 6 },
  billName: { fontSize: 10, fontWeight: 'bold', color: '#111827', marginBottom: 3 },
  billDetail: { fontSize: 9, color: '#374151', marginBottom: 2 },

  // Line items table
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderTop: '1px solid #E5E7EB',
    borderBottom: '1px solid #E5E7EB',
  },
  tableHeaderCell: { fontSize: 8, color: '#6B7280', fontWeight: 'bold', textTransform: 'uppercase' },
  tableHeaderCellRight: { fontSize: 8, color: '#6B7280', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'right' },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, borderBottom: '1px solid #F3F4F6' },
  tableRowAlt: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    backgroundColor: '#F9FAFB',
    borderBottom: '1px solid #F3F4F6',
  },
  tableBodyCell: { fontSize: 9, color: '#374151' },
  tableBodyCellRight: { fontSize: 9, color: '#374151', textAlign: 'right' },

  // GST summary block
  summaryContainer: { marginTop: 8, alignItems: 'flex-end' },
  summaryRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: 3 },
  summaryLabel: { fontSize: 9, color: '#374151', width: 130, textAlign: 'right', paddingRight: 8 },
  summaryValue: { fontSize: 9, color: '#374151', width: 90, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 6,
    borderTop: '2px solid #374151',
    marginTop: 2,
  },
  totalLabel: { fontSize: 11, fontWeight: 'bold', color: '#374151', width: 130, textAlign: 'right', paddingRight: 8 },
  totalValue: { fontSize: 11, fontWeight: 'bold', color: '#111827', width: 90, textAlign: 'right' },

  // Amount in words
  amountWordsBox: {
    borderTop: '1px solid #E5E7EB',
    borderBottom: '1px solid #E5E7EB',
    paddingVertical: 6,
    marginVertical: 8,
  },
  amountWordsLabel: { fontSize: 8, color: '#6B7280', marginBottom: 2 },
  amountWordsText: { fontSize: 9, color: '#374151', fontStyle: 'italic' },

  // IRN QR code block (rendered below totals when irnQrCode is present)
  qrBlock: { alignItems: 'center', marginTop: 12 },
  qrLabel: { fontSize: 8, color: '#6B7280', marginBottom: 4 },
  qrImage: { width: 80, height: 80 },
  irnText: { fontSize: 7, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },

  // Bank details + terms
  bottomRow: { flexDirection: 'row', gap: 40, marginTop: 12 },
  bankSection: { flex: 1 },
  bankTitle: { fontSize: 8, fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase', marginBottom: 6 },
  bankDetail: { fontSize: 9, color: '#374151', marginBottom: 2 },

  // Footer
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 20,
    borderTop: '1px solid #E5E7EB',
    paddingTop: 12,
  },
  footerLeft: { fontSize: 9, color: '#374151' },
  footerRight: { fontSize: 8, color: '#9CA3AF', textAlign: 'right', flex: 1 },

  // CANCELLED watermark
  watermark: {
    position: 'absolute',
    top: '38%',
    left: '5%',
    fontSize: 60,
    fontWeight: 'bold',
    color: '#EF4444',
    opacity: 0.1,
    transform: 'rotate(-45deg)',
  },
})

// Column widths — must sum to 100%
const COL = {
  num: '4%',
  desc: '22%',
  hsn: '9%',
  qty: '7%',
  rate: '10%',
  taxable: '11%',
  gstPct: '7%',
  tax: '10%',
  total: '10%',
  // disc column removed from display (kept in data) to save space; absorbed into taxable
} as const

/**
 * Format a Decimal (or string/number) as Indian lakh currency string.
 * Cannot use lib/utils/format.ts `formatINR` here because it references browser APIs.
 * This is a pure Node.js-safe equivalent.
 */
function formatAmount(value: Decimal | string | number): string {
  const d = new Decimal(value.toString())
  const negative = d.lt(0)
  const abs = d.abs()
  const [intPart, decPart] = abs.toFixed(2).split('.')

  let formatted: string
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3)
    const rest = intPart.slice(0, -3)
    formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3
  } else {
    formatted = intPart
  }

  return (negative ? '-' : '') + '₹' + formatted + '.' + decPart
}

// ---- Types ------------------------------------------------------------------

export interface VoucherForPDF {
  id: string
  voucherNo: string
  date: Date
  status: 'DRAFT' | 'POSTED' | 'CANCELLED'
  totalAmount: Decimal
  cgstAmount: Decimal
  sgstAmount: Decimal
  igstAmount: Decimal
  roundOff: Decimal
  narration?: string | null
  irn?: string | null
  partyLedger?: {
    name: string
    gstin?: string | null
    stateCode?: string | null
    // Note: Ledger model has no `address` field in the schema
  } | null
  voucherItems: Array<{
    id: string
    qty: Decimal
    rate: Decimal
    amount: Decimal
    discountAmt?: Decimal | null
    cgstRate?: Decimal | null
    cgstAmt?: Decimal | null
    sgstRate?: Decimal | null
    sgstAmt?: Decimal | null
    igstRate?: Decimal | null
    igstAmt?: Decimal | null
    hsnCode?: string | null
    item: { name: string }
  }>
}

export interface CompanyForPDF {
  name: string
  gstin?: string | null
  stateCode: string
  address?: string | null
  logoUrl?: string | null
  bankName?: string | null
  bankAccount?: string | null
  ifsc?: string | null
}

interface SalesInvoicePDFProps {
  voucher: VoucherForPDF
  company: CompanyForPDF
  cancelled?: boolean
  qrDataUrl?: string | null
}

// ---- Component --------------------------------------------------------------

export function SalesInvoicePDF({ voucher, company, cancelled = false, qrDataUrl }: SalesInvoicePDFProps) {
  const cgst = new Decimal(voucher.cgstAmount)
  const sgst = new Decimal(voucher.sgstAmount)
  const igst = new Decimal(voucher.igstAmount)
  const total = new Decimal(voucher.totalAmount)
  const roundOff = new Decimal(voucher.roundOff)

  // taxable = total - cgst - sgst - igst - roundOff
  const taxableValue = total.minus(cgst).minus(sgst).minus(igst).minus(roundOff)

  const invoiceDateStr = new Date(voucher.date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  const isInterState = igst.gt(0)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* CANCELLED watermark — rendered behind content via position absolute */}
        {cancelled && <Text style={styles.watermark}>CANCELLED</Text>}

        {/* ── Header: Company info + optional logo ─────────────────────────── */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.companyName}>{company.name}</Text>
            {company.gstin && (
              <Text style={styles.companyDetail}>GSTIN: {company.gstin}</Text>
            )}
            {company.address && (
              <Text style={styles.companyDetail}>{company.address}</Text>
            )}
            <Text style={styles.companyDetail}>State Code: {company.stateCode}</Text>
          </View>
          {company.logoUrl && (
            <Image src={company.logoUrl} style={styles.logo} />
          )}
        </View>

        {/* ── TAX INVOICE title ────────────────────────────────────────────── */}
        <Text style={styles.titleBar}>TAX INVOICE</Text>

        {/* ── Invoice meta: number + date ──────────────────────────────────── */}
        <View style={styles.invoiceMetaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Invoice No.</Text>
            <Text style={styles.metaValue}>{voucher.voucherNo}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{invoiceDateStr}</Text>
          </View>
        </View>

        {/* ── Bill To ──────────────────────────────────────────────────────── */}
        <View style={styles.billRow}>
          <View style={styles.billSection}>
            <Text style={styles.billTitle}>Bill To</Text>
            <Text style={styles.billName}>{voucher.partyLedger?.name ?? '—'}</Text>
            {voucher.partyLedger?.gstin && (
              <Text style={styles.billDetail}>GSTIN: {voucher.partyLedger.gstin}</Text>
            )}
            {voucher.partyLedger?.stateCode && (
              <Text style={styles.billDetail}>
                Place of Supply: State Code {voucher.partyLedger.stateCode}
              </Text>
            )}
          </View>
          <View style={styles.billSection}>
            <Text style={styles.billTitle}>Supply Type</Text>
            <Text style={styles.billDetail}>{isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)'}</Text>
          </View>
        </View>

        {/* ── Line Items Table ─────────────────────────────────────────────── */}
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCell, { width: COL.num }]}>#</Text>
          <Text style={[styles.tableHeaderCell, { width: COL.desc }]}>Description</Text>
          <Text style={[styles.tableHeaderCell, { width: COL.hsn }]}>HSN/SAC</Text>
          <Text style={[styles.tableHeaderCellRight, { width: COL.qty }]}>Qty</Text>
          <Text style={[styles.tableHeaderCellRight, { width: COL.rate }]}>Rate</Text>
          <Text style={[styles.tableHeaderCellRight, { width: COL.taxable }]}>Taxable</Text>
          <Text style={[styles.tableHeaderCellRight, { width: COL.gstPct }]}>GST%</Text>
          <Text style={[styles.tableHeaderCellRight, { width: COL.tax }]}>Tax Amt</Text>
          <Text style={[styles.tableHeaderCellRight, { width: COL.total }]}>Total</Text>
        </View>

        {voucher.voucherItems.map((item, idx) => {
          const taxAmt = new Decimal(item.cgstAmt ?? 0)
            .plus(item.sgstAmt ?? 0)
            .plus(item.igstAmt ?? 0)
          const gstPct = item.igstRate
            ? new Decimal(item.igstRate)
            : item.cgstRate
              ? new Decimal(item.cgstRate).times(2)
              : new Decimal(0)
          const lineTotal = new Decimal(item.amount).plus(taxAmt)
          const rowStyle = idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt

          return (
            <View key={item.id} style={rowStyle} wrap={false}>
              <Text style={[styles.tableBodyCell, { width: COL.num }]}>{idx + 1}</Text>
              <Text style={[styles.tableBodyCell, { width: COL.desc }]}>{item.item.name}</Text>
              <Text style={[styles.tableBodyCell, { width: COL.hsn }]}>{item.hsnCode ?? ''}</Text>
              <Text style={[styles.tableBodyCellRight, { width: COL.qty }]}>
                {new Decimal(item.qty).toFixed(2)}
              </Text>
              <Text style={[styles.tableBodyCellRight, { width: COL.rate }]}>
                {formatAmount(item.rate)}
              </Text>
              <Text style={[styles.tableBodyCellRight, { width: COL.taxable }]}>
                {formatAmount(item.amount)}
              </Text>
              <Text style={[styles.tableBodyCellRight, { width: COL.gstPct }]}>
                {gstPct.toFixed(0)}%
              </Text>
              <Text style={[styles.tableBodyCellRight, { width: COL.tax }]}>
                {formatAmount(taxAmt)}
              </Text>
              <Text style={[styles.tableBodyCellRight, { width: COL.total }]}>
                {formatAmount(lineTotal)}
              </Text>
            </View>
          )
        })}

        {/* ── GST Summary ──────────────────────────────────────────────────── */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Taxable Value</Text>
            <Text style={styles.summaryValue}>{formatAmount(taxableValue)}</Text>
          </View>

          {cgst.gt(0) && (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>CGST</Text>
                <Text style={styles.summaryValue}>{formatAmount(cgst)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>SGST</Text>
                <Text style={styles.summaryValue}>{formatAmount(sgst)}</Text>
              </View>
            </>
          )}

          {igst.gt(0) && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>IGST</Text>
              <Text style={styles.summaryValue}>{formatAmount(igst)}</Text>
            </View>
          )}

          {roundOff.abs().gt(0) && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Round Off</Text>
              <Text style={styles.summaryValue}>{formatAmount(roundOff)}</Text>
            </View>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalValue}>{formatAmount(total)}</Text>
          </View>
        </View>

        {/* ── IRN QR Code (rendered only when irnQrCode is present) ────────── */}
        {qrDataUrl && (
          <View style={styles.qrBlock}>
            <Text style={styles.qrLabel}>IRN QR Code</Text>
            <Image src={qrDataUrl} style={styles.qrImage} />
            {voucher.irn && (
              <Text style={styles.irnText}>{voucher.irn}</Text>
            )}
          </View>
        )}

        {/* ── Amount in Words ──────────────────────────────────────────────── */}
        <View style={styles.amountWordsBox}>
          <Text style={styles.amountWordsLabel}>Amount in Words</Text>
          <Text style={styles.amountWordsText}>{amountToWords(total)}</Text>
        </View>

        {/* ── Bank Details + Terms ─────────────────────────────────────────── */}
        <View style={styles.bottomRow}>
          {(company.bankName || company.bankAccount) && (
            <View style={styles.bankSection}>
              <Text style={styles.bankTitle}>Bank Details</Text>
              {company.bankName && (
                <Text style={styles.bankDetail}>Bank: {company.bankName}</Text>
              )}
              {company.bankAccount && (
                <Text style={styles.bankDetail}>Account No: {company.bankAccount}</Text>
              )}
              {company.ifsc && (
                <Text style={styles.bankDetail}>IFSC: {company.ifsc}</Text>
              )}
            </View>
          )}
          {voucher.narration && (
            <View style={[styles.bankSection, { flex: 1 }]}>
              <Text style={styles.bankTitle}>Terms &amp; Conditions</Text>
              <Text style={styles.bankDetail}>{voucher.narration}</Text>
            </View>
          )}
        </View>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <View style={styles.footerRow}>
          <Text style={styles.footerLeft}>
            Authorised Signatory{'\n'}{company.name}
          </Text>
          <Text style={styles.footerRight}>
            This is a computer generated invoice and does not require a physical signature.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
