/**
 * PaySlipPDF.tsx
 *
 * @react-pdf/renderer component for monthly pay slips.
 *
 * SERVER-ONLY: Do not import in any "use client" component.
 * Only import in: lib/inngest.ts (pay run job) or an API route.
 *
 * Font registration via local files — never CDN (ENOTFOUND risk in serverless).
 */
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer'
import path from 'path'

// Register fonts at module scope — once on Node.js module load
// NEVER use Google Fonts CDN URLs — ENOTFOUND risk in Vercel serverless (T-06-05-04)
Font.register({
  family: 'Inter',
  fonts: [
    { src: path.join(process.cwd(), 'public', 'fonts', 'Inter-Regular.ttf'), fontWeight: 400 },
    { src: path.join(process.cwd(), 'public', 'fonts', 'Inter-Bold.ttf'), fontWeight: 700 },
  ],
})

export interface PaySlipData {
  company: { name: string; gstin: string | null; address: string | null; logoUrl?: string | null }
  employee: { name: string; employeeCode: string; designation: string | null; department: string | null }
  month: string           // 'YYYY-MM' — display as 'April 2025'
  attendance: { presentDays: string; halfDays: number; leaveDays: number; effectiveDays: string }
  earnings: Array<{ name: string; amount: string }>
  deductions: Array<{ name: string; amount: string }>   // employee deductions (PF, ESI, PT)
  grossEarnings: string
  totalDeductions: string
  netPay: string
  employerContributions: { pfEmployer: string; esiEmployer: string }  // informational only
}

// Pure arithmetic Indian lakh formatter — no ICU locale data dependency (safe in Vercel serverless)
// Copied from SalesInvoicePDF.tsx — do NOT use toLocaleString('en-IN') (breaks without full ICU)
function formatAmount(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num)) return '₹0.00'
  const [intPart, decPart = '00'] = num.toFixed(2).split('.')
  const lastThree = intPart.slice(-3)
  const rest = intPart.slice(0, -3)
  const formatted = rest.length > 0
    ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
    : lastThree
  return `₹${formatted}.${decPart}`
}

function formatMonth(month: string): string {
  const [year, m] = month.split('-')
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return `${monthNames[parseInt(m, 10) - 1]} ${year}`
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#FFFFFF', padding: 32, fontFamily: 'Inter', fontSize: 9 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  companyBlock: { flex: 1 },
  companyName: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 3 },
  companyDetail: { fontSize: 8, color: '#6B7280', marginBottom: 2 },

  // Title
  titleBar: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#7C3AED',
    textAlign: 'center',
    paddingVertical: 6,
    borderTop: '1.5px solid #7C3AED',
    borderBottom: '1.5px solid #7C3AED',
    marginBottom: 14,
  },

  // Employee info 2-col
  infoGrid: { flexDirection: 'row', gap: 24, marginBottom: 14 },
  infoBlock: { flex: 1 },
  infoLabel: { fontSize: 8, color: '#6B7280', marginBottom: 2 },
  infoValue: { fontSize: 9, color: '#111827', fontWeight: 'bold' },

  // Earnings | Deductions table
  table: { flexDirection: 'row', gap: 16, marginBottom: 14 },
  tableCol: { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 4 },
  tableHeader: {
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableHeaderText: { fontSize: 8, fontWeight: 'bold', color: '#374151', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 4 },
  tableRowAlt: { backgroundColor: '#F9FAFB' },
  tableCellLabel: { fontSize: 8, color: '#374151' },
  tableCellAmount: { fontSize: 8, color: '#374151' },

  // Totals row
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
  },
  totalLabel: { fontSize: 9, fontWeight: 'bold', color: '#111827' },
  totalAmount: { fontSize: 9, fontWeight: 'bold', color: '#111827' },

  // Net pay box
  netPayBox: {
    backgroundColor: '#7C3AED',
    padding: 10,
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  netPayLabel: { fontSize: 11, fontWeight: 'bold', color: '#FFFFFF' },
  netPayAmount: { fontSize: 13, fontWeight: 'bold', color: '#FFFFFF' },

  // Employer contributions (informational)
  infoBox: { backgroundColor: '#EDE9FE', padding: 8, borderRadius: 4, marginBottom: 12 },
  infoBoxTitle: { fontSize: 8, fontWeight: 'bold', color: '#7C3AED', marginBottom: 4 },
  infoBoxRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoBoxText: { fontSize: 8, color: '#374151' },

  // Footer
  footer: { marginTop: 'auto', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#9CA3AF' },
})

export function PaySlipPDF({ data }: { data: PaySlipData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyBlock}>
            {data.company.logoUrl && (
              <Image
                src={data.company.logoUrl}
                style={{ width: 48, height: 48, objectFit: 'contain', marginBottom: 8 }}
              />
            )}
            <Text style={styles.companyName}>{data.company.name}</Text>
            {data.company.gstin && (
              <Text style={styles.companyDetail}>GSTIN: {data.company.gstin}</Text>
            )}
            {data.company.address && (
              <Text style={styles.companyDetail}>{data.company.address}</Text>
            )}
          </View>
        </View>

        {/* Title */}
        <Text style={styles.titleBar}>PAY SLIP — {formatMonth(data.month)}</Text>

        {/* Employee info 2-col */}
        <View style={styles.infoGrid}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Employee Name</Text>
            <Text style={styles.infoValue}>{data.employee.name}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Employee Code</Text>
            <Text style={styles.infoValue}>{data.employee.employeeCode}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Designation</Text>
            <Text style={styles.infoValue}>{data.employee.designation ?? '—'}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Department</Text>
            <Text style={styles.infoValue}>{data.employee.department ?? '—'}</Text>
          </View>
        </View>

        {/* Attendance summary */}
        <View style={[styles.infoGrid, { marginBottom: 12 }]}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Days Present</Text>
            <Text style={styles.infoValue}>{data.attendance.presentDays}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Half Days</Text>
            <Text style={styles.infoValue}>{data.attendance.halfDays}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Leave Days</Text>
            <Text style={styles.infoValue}>{data.attendance.leaveDays}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Effective Days</Text>
            <Text style={styles.infoValue}>{data.attendance.effectiveDays} / 26</Text>
          </View>
        </View>

        {/* Earnings | Deductions side-by-side */}
        <View style={styles.table}>
          {/* Earnings column */}
          <View style={styles.tableCol}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderText}>Earnings</Text>
              <Text style={styles.tableHeaderText}>Amount</Text>
            </View>
            {data.earnings.map((e, i) => (
              <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={styles.tableCellLabel}>{e.name}</Text>
                <Text style={styles.tableCellAmount}>{formatAmount(e.amount)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Gross Earnings</Text>
              <Text style={styles.totalAmount}>{formatAmount(data.grossEarnings)}</Text>
            </View>
          </View>

          {/* Deductions column */}
          <View style={styles.tableCol}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderText}>Deductions</Text>
              <Text style={styles.tableHeaderText}>Amount</Text>
            </View>
            {data.deductions.map((d, i) => (
              <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={styles.tableCellLabel}>{d.name}</Text>
                <Text style={styles.tableCellAmount}>{formatAmount(d.amount)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Deductions</Text>
              <Text style={styles.totalAmount}>{formatAmount(data.totalDeductions)}</Text>
            </View>
          </View>
        </View>

        {/* Net Pay */}
        <View style={styles.netPayBox}>
          <Text style={styles.netPayLabel}>NET PAY</Text>
          <Text style={styles.netPayAmount}>{formatAmount(data.netPay)}</Text>
        </View>

        {/* Employer contributions (informational) */}
        <View style={styles.infoBox}>
          <Text style={styles.infoBoxTitle}>Employer Contributions (Informational)</Text>
          <View style={styles.infoBoxRow}>
            <Text style={styles.infoBoxText}>Employer PF: {formatAmount(data.employerContributions.pfEmployer)}</Text>
            <Text style={styles.infoBoxText}>Employer ESI: {formatAmount(data.employerContributions.esiEmployer)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Generated by PremGiri Books</Text>
          <Text style={styles.footerText}>This is a computer-generated document. No signature required.</Text>
        </View>

      </Page>
    </Document>
  )
}
