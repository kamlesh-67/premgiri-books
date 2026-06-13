/**
 * SalesInvoicePDF.tsx — react-pdf v4 compatible
 *
 * react-pdf v4 rules strictly followed:
 *  - fontWeight / fontStyle only on <Text>, never on <View>
 *  - transform is a CSS string ('rotate(-45deg)'), not an array
 *  - No && short-circuit rendering — always ternary with null fallback
 *  - No empty <Text></Text> — use <Text>{' '}</Text> for spacers
 *  - Nested <Text> for inline bold/italic spans (supported by yoga-layout)
 *  - All style values are plain primitives
 */

import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import path from 'path'
import { Decimal } from 'decimal.js'

// ── Font Registration ────────────────────────────────────────────────────────
try {
  Font.register({
    family: 'Inter',
    fonts: [
      {
        src: path.join(process.cwd(), 'public', 'fonts', 'Inter-Regular.ttf'),
        fontWeight: 400,
      },
      {
        src: path.join(process.cwd(), 'public', 'fonts', 'Inter-Bold.ttf'),
        fontWeight: 700,
      },
    ],
  })
} catch (_) {
  // Non-fatal: falls back to Helvetica built-in
}

// ── Indian Lakh Number Formatter ─────────────────────────────────────────────
// e.g. 123456.78 → "1,23,456.78"
function fmtINR(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num)) return value
  const [intPart, decPart] = num.toFixed(2).split('.')
  if (intPart.length <= 3) return `${intPart}.${decPart}`
  const last3 = intPart.slice(-3)
  const rest = intPart.slice(0, -3)
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')
  return `${grouped},${last3}.${decPart}`
}

// ── Colour palette ───────────────────────────────────────────────────────────
const CLR = {
  black:      '#000000',
  dark:       '#111111',
  body:       '#333333',
  muted:      '#666666',
  light:      '#999999',
  border:     '#000000',
  rowBorder:  '#DDDDDD',
  headerBg:   '#F5F5F5',
  redBg:      '#B91C1C',
  white:      '#FFFFFF',
}

// ── StyleSheet ───────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  // Page
  page: {
    backgroundColor: CLR.white,
    paddingTop: 22,
    paddingBottom: 44,      // room for absolute footer
    paddingHorizontal: 30,
    fontFamily: 'Inter',
    fontSize: 8,
    color: CLR.dark,
    flexDirection: 'column',
  },

  // ── "Original Copy" label
  originalCopy: {
    fontSize: 7,
    color: CLR.light,
    textAlign: 'center',
    marginBottom: 8,
  },

  // ── Company header row
  headerRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
  },
  companyName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: CLR.black,
    marginBottom: 3,
  },
  companyMeta: {
    fontSize: 8,
    color: CLR.body,
    marginBottom: 1,
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  companyAddress: {
    fontSize: 7.5,
    color: CLR.muted,
    textAlign: 'right',
    maxWidth: 220,
    lineHeight: 1.4,
  },

  // ── Title bar
  titleBar: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.8,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: CLR.border,
    borderTopStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: CLR.border,
    borderBottomStyle: 'solid',
    marginBottom: 0,
  },

  // ── Billing / Shipping address section
  addressSection: {
    flexDirection: 'row',
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: CLR.border,
    borderBottomStyle: 'solid',
    marginBottom: 0,
  },
  addressCol: {
    flex: 1,
    paddingRight: 8,
  },
  addressLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: CLR.black,
    marginBottom: 3,
  },
  addressName: {
    fontSize: 8,
    fontWeight: 'bold',
    color: CLR.dark,
    marginBottom: 2,
  },
  addressMeta: {
    fontSize: 7.5,
    color: CLR.muted,
    marginBottom: 1,
  },
  addressText: {
    fontSize: 7.5,
    color: CLR.muted,
    lineHeight: 1.4,
  },

  // ── Invoice meta details (stacked single-column list)
  metaSection: {
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: CLR.border,
    borderBottomStyle: 'solid',
    marginBottom: 10,
  },
  metaLine: {
    fontSize: 8,
    color: CLR.body,
    marginBottom: 3,
    lineHeight: 1.3,
  },
  metaBold: {
    fontWeight: 'bold',
    color: CLR.dark,
  },

  // ── Items table
  tableHeader: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: CLR.border,
    borderTopStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: CLR.border,
    borderBottomStyle: 'solid',
    paddingVertical: 4,
    backgroundColor: CLR.headerBg,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: CLR.rowBorder,
    borderBottomStyle: 'solid',
    paddingVertical: 4,
  },
  tableTotalRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: CLR.border,
    borderTopStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: CLR.border,
    borderBottomStyle: 'solid',
    paddingVertical: 4,
  },

  // Table column widths — must sum to 100%
  colNo:   { width: '5%',  paddingLeft: 2 },
  colDesc: { width: '30%' },
  colQty:  { width: '7%',  textAlign: 'right' },
  colUnit: { width: '7%',  textAlign: 'center' },
  colRate: { width: '11%', textAlign: 'right' },
  colDisc: { width: '13%', textAlign: 'right' },
  colTax:  { width: '9%',  textAlign: 'right' },
  colAmt:  { width: '18%', textAlign: 'right', paddingRight: 2 },

  thText:   { fontWeight: 'bold', fontSize: 8, color: CLR.dark },
  itemName: { fontStyle: 'italic', fontSize: 7.5, color: CLR.body },
  hsnText:  { fontSize: 6.5, color: CLR.light, marginTop: 1 },

  // ── Flex spacer (pushes red bar to bottom)
  flexSpacer: { flex: 1, minHeight: 10 },

  // ── Amount-in-words red bar
  redBar: {
    backgroundColor: CLR.redBg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 12,
  },
  redBarLeft: {
    color: CLR.white,
    fontSize: 9,
    fontWeight: 'bold',
    flex: 1,
  },
  redBarRight: {
    color: CLR.white,
    fontSize: 13,
    fontWeight: 'bold',
  },

  // ── Totals block (right-aligned)
  totalsWrapper: {
    alignSelf: 'flex-end',
    width: 250,
    marginTop: 10,
    marginBottom: 14,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: CLR.rowBorder,
    borderBottomStyle: 'solid',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: CLR.border,
    borderTopStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: CLR.border,
    borderBottomStyle: 'solid',
    marginTop: 2,
    marginBottom: 2,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalLabel:   { fontSize: 8, color: CLR.muted },
  totalValue:   { fontSize: 8, color: CLR.dark },
  grandLabel:   { fontSize: 9, fontWeight: 'bold', color: CLR.dark },
  grandValue:   { fontSize: 9, fontWeight: 'bold', color: CLR.dark },
  balanceLabel: { fontSize: 8, color: CLR.muted },
  balanceValue: { fontSize: 8, color: CLR.dark },

  // ── Terms & Signatory section
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: CLR.border,
    borderTopStyle: 'solid',
  },
  termsBlock: {
    flex: 1,
    paddingRight: 16,
  },
  termsTitle: {
    fontWeight: 'bold',
    fontSize: 8,
    color: CLR.dark,
    marginBottom: 6,
  },
  termLine: {
    fontSize: 7.5,
    color: CLR.muted,
    marginBottom: 3,
    lineHeight: 1.4,
  },
  signatoryBlock: {
    width: 180,
    alignItems: 'flex-end',
  },
  signatoryFor: {
    fontWeight: 'bold',
    fontSize: 8,
    color: CLR.dark,
    marginBottom: 32,
  },
  signatoryLine: {
    borderTopWidth: 0.5,
    borderTopColor: CLR.border,
    borderTopStyle: 'solid',
    paddingTop: 3,
    width: 130,
    textAlign: 'center',
    fontSize: 8,
    fontStyle: 'italic',
    color: CLR.body,
  },

  // ── CANCELLED watermark
  watermarkWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watermarkText: {
    fontSize: 80,
    fontWeight: 'bold',
    color: '#EF4444',
    opacity: 0.12,
    transform: 'rotate(-45deg)',
  },

  // ── Page footer (absolute — always at bottom)
  pageFooter: {
    position: 'absolute',
    bottom: 16,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 7,
    color: CLR.light,
  },
})

// ── Types ────────────────────────────────────────────────────────────────────
export interface InvoiceItem {
  id: string
  index: string
  name: string
  hsnCode: string
  qty: string
  unit: string
  rate: string
  disc: string       // discount %
  discAmt: string    // discount amount
  taxRate: string    // combined tax % (CGST+SGST or IGST)
  cgstRate: string
  sgstRate: string
  igstRate: string
  cgstAmt: string
  sgstAmt: string
  igstAmt: string
  amount: string     // taxable value (after discount, before tax)
}

export interface VoucherPayload {
  voucherNo: string
  date: string
  dueDate: string
  paymentTerms: string
  placeOfSupply: string
  reverseCharge: string
  subtotal: string      // sum of taxable amounts
  cgstTotal: string
  sgstTotal: string
  igstTotal: string
  roundOff: string
  totalAmount: string
  amountInWords: string
  partyName: string
  partyGstin: string
  partyAddress: string
  shippingAddress: string
  isTaxInvoice: boolean
  items: InvoiceItem[]
}

export interface CompanyPayload {
  name: string
  gstin: string
  pan: string
  address: string
  logoUrl: string
}

interface Props {
  voucher: VoucherPayload
  company: CompanyPayload
  cancelled?: boolean
}

// ── Component ────────────────────────────────────────────────────────────────
export function SalesInvoicePDF({ voucher, company, cancelled = false }: Props) {
  const items: InvoiceItem[] = Array.isArray(voucher.items) ? voucher.items : []

  // ── Pre-compute all values at function scope (never inside JSX)
  const totalQty = items
    .reduce((acc, it) => acc.plus(new Decimal(it.qty || '0')), new Decimal(0))
    .toFixed(2)

  const subtotalFmt  = fmtINR(voucher.subtotal || '0')
  const cgstFmt      = fmtINR(voucher.cgstTotal || '0')
  const sgstFmt      = fmtINR(voucher.sgstTotal || '0')
  const igstFmt      = fmtINR(voucher.igstTotal || '0')
  const totalFmt     = fmtINR(voucher.totalAmount || '0')

  const cgstDec   = new Decimal(voucher.cgstTotal || '0')
  const sgstDec   = new Decimal(voucher.sgstTotal || '0')
  const igstDec   = new Decimal(voucher.igstTotal || '0')
  const roundDec  = new Decimal(voucher.roundOff  || '0')

  const hasGst      = cgstDec.gt(0) || sgstDec.gt(0) || igstDec.gt(0)
  const hasCgstSgst = cgstDec.gt(0) || sgstDec.gt(0)
  const hasIgst     = igstDec.gt(0)
  const hasRoundOff = !roundDec.isZero()
  const roundFmt    = (roundDec.gte(0) ? '+' : '') + fmtINR(voucher.roundOff || '0')

  // First non-zero CGST rate for the label (e.g. "9")
  const cgstRateLabel = items.find((it) => parseFloat(it.cgstRate) > 0)?.cgstRate ?? '0'
  const sgstRateLabel = items.find((it) => parseFloat(it.sgstRate) > 0)?.sgstRate ?? '0'
  const igstRateLabel = items.find((it) => parseFloat(it.igstRate) > 0)?.igstRate ?? '0'

  const hasPartyGstin = voucher.partyGstin && voucher.partyGstin.length > 0
  const shippingAddr  = voucher.shippingAddress || voucher.partyAddress

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* ── "Original Copy" ────────────────────────────────────────────── */}
        <Text style={S.originalCopy}>Original Copy</Text>

        {/* ── Company Header ─────────────────────────────────────────────── */}
        <View style={S.headerRow}>
          <View style={S.headerLeft}>
            <Text style={S.companyName}>{company.name}</Text>
            {company.gstin ? (
              <Text style={S.companyMeta}>{`GSTIN - ${company.gstin}`}</Text>
            ) : null}
            {company.pan ? (
              <Text style={S.companyMeta}>{`PAN - ${company.pan}`}</Text>
            ) : null}
          </View>
          <View style={S.headerRight}>
            <Text style={S.companyAddress}>{company.address}</Text>
          </View>
        </View>

        {/* ── Title Bar ──────────────────────────────────────────────────── */}
        <Text style={S.titleBar}>
          {voucher.isTaxInvoice ? 'TAX INVOICE' : 'BILL OF SUPPLY'}
        </Text>

        {/* ── Billing / Shipping Addresses ───────────────────────────────── */}
        <View style={S.addressSection}>
          <View style={S.addressCol}>
            <Text style={S.addressLabel}>Billing Address:</Text>
            <Text style={S.addressName}>{voucher.partyName}</Text>
            {hasPartyGstin ? (
              <Text style={S.addressMeta}>{`GSTIN: ${voucher.partyGstin}`}</Text>
            ) : null}
            <Text style={S.addressText}>{voucher.partyAddress}</Text>
          </View>
          <View style={S.addressCol}>
            <Text style={S.addressLabel}>Shipping Address:</Text>
            <Text style={S.addressName}>{voucher.partyName}</Text>
            <Text style={S.addressText}>{shippingAddr}</Text>
          </View>
        </View>

        {/* ── Invoice Meta Details ───────────────────────────────────────── */}
        {/*
          Inline nested <Text> for bold values — react-pdf supports this.
          Pattern: <Text style={S.metaLine}>Label: <Text style={S.metaBold}>Value</Text></Text>
        */}
        <View style={S.metaSection}>
          <Text style={S.metaLine}>
            {'Invoice Number: '}
            <Text style={S.metaBold}>{voucher.voucherNo}</Text>
          </Text>
          <Text style={S.metaLine}>
            {'Invoice Date: '}
            <Text style={S.metaBold}>{voucher.date}</Text>
          </Text>
          <Text style={S.metaLine}>
            {'Due Date: '}
            <Text style={S.metaBold}>{voucher.dueDate}</Text>
          </Text>
          <Text style={S.metaLine}>
            {'Place of Supply: '}
            <Text style={S.metaBold}>{voucher.placeOfSupply}</Text>
          </Text>
          <Text style={S.metaLine}>
            {'Payment Terms: '}
            <Text style={S.metaBold}>{voucher.paymentTerms}</Text>
          </Text>
          <Text style={S.metaLine}>
            {'Reverse Charge: '}
            <Text style={S.metaBold}>{voucher.reverseCharge}</Text>
          </Text>
          {company.pan ? (
            <Text style={S.metaLine}>
              {'PAN: '}
              <Text style={S.metaBold}>{company.pan}</Text>
            </Text>
          ) : null}
        </View>

        {/* ── Items Table ────────────────────────────────────────────────── */}

        {/* Table Header */}
        <View style={S.tableHeader}>
          <Text style={[S.colNo,   S.thText]}>S. No.</Text>
          <Text style={[S.colDesc, S.thText]}>Item Description</Text>
          <Text style={[S.colQty,  S.thText]}>Qty</Text>
          <Text style={[S.colUnit, S.thText]}>Unit</Text>
          <Text style={[S.colRate, S.thText]}>List Price</Text>
          <Text style={[S.colDisc, S.thText]}>Disc.</Text>
          <Text style={[S.colTax,  S.thText]}>Tax %</Text>
          <Text style={[S.colAmt,  S.thText]}>{'Amount(₹)'}</Text>
        </View>

        {/* Table Rows */}
        {items.map((item) => (
          <View key={item.id} style={S.tableRow}>
            <Text style={S.colNo}>{item.index}</Text>
            <View style={S.colDesc}>
              <Text style={S.itemName}>{item.name}</Text>
              {item.hsnCode ? (
                <Text style={S.hsnText}>{`HSN: ${item.hsnCode}`}</Text>
              ) : null}
            </View>
            <Text style={S.colQty}>{item.qty}</Text>
            <Text style={S.colUnit}>{item.unit}</Text>
            <Text style={S.colRate}>{item.rate}</Text>
            <Text style={S.colDisc}>{`${item.disc} (%)`}</Text>
            <Text style={S.colTax}>{item.taxRate}</Text>
            <Text style={S.colAmt}>{item.amount}</Text>
          </View>
        ))}

        {/* Table Footer / Total Row */}
        <View style={S.tableTotalRow}>
          <Text style={[S.colNo,   S.thText]}>{' '}</Text>
          <Text style={[S.colDesc, S.thText]}>Total</Text>
          <Text style={[S.colQty,  S.thText]}>{totalQty}</Text>
          <Text style={S.colUnit}>{' '}</Text>
          <Text style={S.colRate}>{' '}</Text>
          <Text style={S.colDisc}>{' '}</Text>
          <Text style={S.colTax}>{' '}</Text>
          <Text style={[S.colAmt,  S.thText]}>{fmtINR(voucher.subtotal || '0')}</Text>
        </View>

        {/* ── Flex spacer: pushes red bar to page bottom ─────────────────── */}
        <View style={S.flexSpacer} />

        {/* ── Amount-in-Words Red Bar ────────────────────────────────────── */}
        <View style={S.redBar}>
          <Text style={S.redBarLeft}>{voucher.amountInWords}</Text>
          <Text style={S.redBarRight}>{`₹${totalFmt}`}</Text>
        </View>

        {/* ── Totals Block ───────────────────────────────────────────────── */}
        <View style={S.totalsWrapper}>

          {/* Subtotal (shown only when GST is present) */}
          {hasGst ? (
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>Subtotal</Text>
              <Text style={S.totalValue}>{`₹${subtotalFmt}`}</Text>
            </View>
          ) : null}

          {/* CGST row */}
          {hasCgstSgst ? (
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>{`CGST @ ${cgstRateLabel}%`}</Text>
              <Text style={S.totalValue}>{`₹${cgstFmt}`}</Text>
            </View>
          ) : null}

          {/* SGST row */}
          {hasCgstSgst ? (
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>{`SGST @ ${sgstRateLabel}%`}</Text>
              <Text style={S.totalValue}>{`₹${sgstFmt}`}</Text>
            </View>
          ) : null}

          {/* IGST row */}
          {hasIgst ? (
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>{`IGST @ ${igstRateLabel}%`}</Text>
              <Text style={S.totalValue}>{`₹${igstFmt}`}</Text>
            </View>
          ) : null}

          {/* Round-off row */}
          {hasRoundOff ? (
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>Round Off</Text>
              <Text style={S.totalValue}>{roundFmt}</Text>
            </View>
          ) : null}

          {/* Grand Total */}
          <View style={S.grandTotalRow}>
            <Text style={S.grandLabel}>Grand Total</Text>
            <Text style={S.grandValue}>{`₹${totalFmt}`}</Text>
          </View>

          {/* Invoice Balance */}
          <View style={S.balanceRow}>
            <Text style={S.balanceLabel}>Invoice Balance</Text>
            <Text style={S.balanceValue}>{totalFmt}</Text>
          </View>
        </View>

        {/* ── Terms & Signatory ──────────────────────────────────────────── */}
        <View style={S.bottomSection}>
          <View style={S.termsBlock}>
            <Text style={S.termsTitle}>Terms {'&'} Conditions</Text>
            <Text style={S.termLine}>1. Goods once sold will not be taken back.</Text>
            <Text style={S.termLine}>
              {'2. Interest @ 18% p.a. will be charged if payment is not made within the stipulated time.'}
            </Text>
            <Text style={S.termLine}>
              {"3. Subject to 'Rajasthan' Jurisdiction only."}
            </Text>
          </View>
          <View style={S.signatoryBlock}>
            <Text style={S.signatoryFor}>{`For ${company.name}`}</Text>
            <Text style={S.signatoryLine}>Authorised Signatory</Text>
          </View>
        </View>

        {/* ── CANCELLED Watermark ────────────────────────────────────────── */}
        {/*
          ✅ Ternary with null, not &&
          ✅ transform as CSS string on Text, not View
          ✅ opacity on Text directly
        */}
        {cancelled ? (
          <View style={S.watermarkWrapper}>
            <Text style={S.watermarkText}>CANCELLED</Text>
          </View>
        ) : null}

        {/* ── Page Footer (absolute — always at page bottom) ─────────────── */}
        <Text
          style={S.pageFooter}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )
}
