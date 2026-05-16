/**
 * GSTService.ts
 *
 * Server-side aggregation service for GSTR-1 and GSTR-3B data.
 * All amounts returned as strings (Decimal.toString()).
 * For GSTN export, callers use Decimal.toFixed(2) on the values.
 *
 * companyId MUST be passed from session — never derived internally.
 */
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/prisma'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface B2bInvoice {
  invoiceNo: string
  invoiceDate: string  // ISO date string YYYY-MM-DD
  taxableValue: string
  cgst: string
  sgst: string
  igst: string
  totalGst: string
  placeOfSupply: string
  reverseCharge: boolean
  gstr1Status: string
}

export interface B2bRow {
  gstin: string
  partyName: string
  invoices: B2bInvoice[]
  totalTaxable: string
  totalCgst: string
  totalSgst: string
  totalIgst: string
}

export interface B2csRow {
  placeOfSupply: string
  taxableValue: string
  igst: string
  cgst: string
  sgst: string
}

export interface CdnrNote {
  noteNo: string
  noteDate: string  // ISO date string YYYY-MM-DD
  noteType: 'C' | 'D'  // Credit or Debit
  taxableValue: string
  cgst: string
  sgst: string
  igst: string
}

export interface CdnrRow {
  gstin: string
  partyName: string
  notes: CdnrNote[]
}

export interface HsnRow {
  hsnCode: string
  description: string
  uom: string
  qty: string
  taxableValue: string
  cgst: string
  sgst: string
  igst: string
}

export interface NilRatedRow {
  placeOfSupply: string
  taxableValue: string  // aggregated taxable value for nil/exempt supplies
}

export interface Gstr1Sections {
  b2b: B2bRow[]
  b2cs: B2csRow[]
  cdnr: CdnrRow[]
  hsn: HsnRow[]
  nilRated: NilRatedRow[]
}

export interface Gstr3bSummary {
  outwardTaxable: { taxable: string; cgst: string; sgst: string; igst: string }  // 3.1(a)
  zeroNilRated: { taxable: string }  // 3.1(b)
  rcmInward: { taxable: string; cgst: string; sgst: string; igst: string }  // 3.1(d)
  itcAvailable: { cgst: string; sgst: string; igst: string }  // 4(A)(5) — eligible only
  netPayable: { cgst: string; sgst: string; igst: string }  // 6.1
  overrides: Record<string, { autoValue: string; userValue: string; overriddenAt: string; overriddenBy: string }> | null
}

// ─── GSTR-1 Sections ─────────────────────────────────────────────────────────

/**
 * Aggregates GstTransaction rows into GSTR-1 sections.
 * Only includes POSTED vouchers for the specified return period.
 *
 * @param companyId  - Must come from session.user.companyId
 * @param period     - "MM/YYYY" format (e.g., "04/2025")
 */
export async function getGstr1Sections(companyId: string, period: string): Promise<Gstr1Sections> {
  // B2B: SALES vouchers with gstinRecipient (registered buyer)
  const b2bTxs = await prisma.gstTransaction.findMany({
    where: {
      companyId,
      returnPeriod: period,
      gstinRecipient: { not: null },
      voucher: { status: 'POSTED', voucherType: { in: ['SALES'] } },
    },
    include: {
      voucher: {
        select: {
          voucherNo: true,
          date: true,
          totalAmount: true,
          partyLedger: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // B2CS: SALES vouchers with no gstinRecipient (unregistered buyer)
  const b2csTxs = await prisma.gstTransaction.findMany({
    where: {
      companyId,
      returnPeriod: period,
      gstinRecipient: null,
      voucher: { status: 'POSTED', voucherType: 'SALES' },
    },
  })

  // CDNR: Credit Notes and Debit Notes to registered buyers
  const cdnrTxs = await prisma.gstTransaction.findMany({
    where: {
      companyId,
      returnPeriod: period,
      gstinRecipient: { not: null },
      voucher: { status: 'POSTED', voucherType: { in: ['CREDIT_NOTE', 'DEBIT_NOTE'] } },
    },
    include: {
      voucher: {
        select: {
          voucherNo: true,
          date: true,
          totalAmount: true,
          voucherType: true,
          partyLedger: { select: { name: true } },
        },
      },
    },
  })

  // HSN Summary: aggregate by hsnCode across all SALES voucher items for the period
  const hsnItems = await prisma.voucherItem.findMany({
    where: {
      voucher: {
        companyId,
        status: 'POSTED',
        voucherType: 'SALES',
        gstTransactions: { some: { returnPeriod: period } },
      },
    },
    select: {
      hsnCode: true,
      qty: true,
      amount: true,
      cgstAmt: true,
      sgstAmt: true,
      igstAmt: true,
      item: { select: { name: true, uom: { select: { symbol: true } } } },
    },
  })

  // Group HSN items
  const hsnMap = new Map<string, HsnRow>()
  for (const item of hsnItems) {
    const key = item.hsnCode ?? 'UNKNOWN'
    const existing = hsnMap.get(key)
    const taxable = new Decimal(item.amount)
      .minus(item.cgstAmt ?? 0)
      .minus(item.sgstAmt ?? 0)
      .minus(item.igstAmt ?? 0)
    if (existing) {
      existing.qty = new Decimal(existing.qty).plus(item.qty).toString()
      existing.taxableValue = new Decimal(existing.taxableValue).plus(taxable).toString()
      existing.cgst = new Decimal(existing.cgst).plus(item.cgstAmt ?? 0).toString()
      existing.sgst = new Decimal(existing.sgst).plus(item.sgstAmt ?? 0).toString()
      existing.igst = new Decimal(existing.igst).plus(item.igstAmt ?? 0).toString()
    } else {
      hsnMap.set(key, {
        hsnCode: key,
        description: item.item.name,
        uom: item.item.uom?.symbol ?? 'PCS',
        qty: item.qty.toString(),
        taxableValue: taxable.toString(),
        cgst: (item.cgstAmt ?? new Decimal(0)).toString(),
        sgst: (item.sgstAmt ?? new Decimal(0)).toString(),
        igst: (item.igstAmt ?? new Decimal(0)).toString(),
      })
    }
  }

  // Group B2B by gstinRecipient
  const b2bMap = new Map<string, B2bRow>()
  for (const tx of b2bTxs) {
    const gstin = tx.gstinRecipient!
    const existing = b2bMap.get(gstin)
    const inv: B2bInvoice = {
      invoiceNo: tx.voucher.voucherNo,
      invoiceDate: tx.voucher.date.toISOString().split('T')[0],
      taxableValue: tx.taxableValue.toString(),
      cgst: tx.cgst.toString(),
      sgst: tx.sgst.toString(),
      igst: tx.igst.toString(),
      totalGst: new Decimal(tx.cgst).plus(tx.sgst).plus(tx.igst).toString(),
      placeOfSupply: tx.placeOfSupply,
      reverseCharge: tx.reverseCharge,
      gstr1Status: tx.gstr1Status,
    }
    if (existing) {
      existing.invoices.push(inv)
      existing.totalTaxable = new Decimal(existing.totalTaxable).plus(tx.taxableValue).toString()
      existing.totalCgst = new Decimal(existing.totalCgst).plus(tx.cgst).toString()
      existing.totalSgst = new Decimal(existing.totalSgst).plus(tx.sgst).toString()
      existing.totalIgst = new Decimal(existing.totalIgst).plus(tx.igst).toString()
    } else {
      b2bMap.set(gstin, {
        gstin,
        partyName: tx.voucher.partyLedger?.name ?? '',
        invoices: [inv],
        totalTaxable: tx.taxableValue.toString(),
        totalCgst: tx.cgst.toString(),
        totalSgst: tx.sgst.toString(),
        totalIgst: tx.igst.toString(),
      })
    }
  }

  // B2CS: aggregate by state code (place of supply)
  const b2csMap = new Map<string, B2csRow>()
  for (const tx of b2csTxs) {
    const key = tx.placeOfSupply
    const existing = b2csMap.get(key)
    if (existing) {
      existing.taxableValue = new Decimal(existing.taxableValue).plus(tx.taxableValue).toString()
      existing.igst = new Decimal(existing.igst).plus(tx.igst).toString()
      existing.cgst = new Decimal(existing.cgst).plus(tx.cgst).toString()
      existing.sgst = new Decimal(existing.sgst).plus(tx.sgst).toString()
    } else {
      b2csMap.set(key, {
        placeOfSupply: key,
        taxableValue: tx.taxableValue.toString(),
        igst: tx.igst.toString(),
        cgst: tx.cgst.toString(),
        sgst: tx.sgst.toString(),
      })
    }
  }

  // CDNR: group by gstinRecipient
  const cdnrMap = new Map<string, CdnrRow>()
  for (const tx of cdnrTxs) {
    const gstin = tx.gstinRecipient!
    const existing = cdnrMap.get(gstin)
    const note: CdnrNote = {
      noteNo: tx.voucher.voucherNo,
      noteDate: tx.voucher.date.toISOString().split('T')[0],
      noteType: tx.voucher.voucherType === 'CREDIT_NOTE' ? 'C' : 'D',
      taxableValue: tx.taxableValue.toString(),
      cgst: tx.cgst.toString(),
      sgst: tx.sgst.toString(),
      igst: tx.igst.toString(),
    }
    if (existing) {
      existing.notes.push(note)
    } else {
      cdnrMap.set(gstin, {
        gstin,
        partyName: tx.voucher.partyLedger?.name ?? '',
        notes: [note],
      })
    }
  }

  // NIL-rated: SALES vouchers where cgst+sgst+igst = 0 but taxableValue > 0
  // Covers: exempt supplies, nil-rated HSN (gstRate=0), non-export zero-rated transactions
  const nilRatedTxs = await prisma.gstTransaction.findMany({
    where: {
      companyId,
      returnPeriod: period,
      voucher: { status: 'POSTED', voucherType: 'SALES' },
    },
  })
  const nilRatedFiltered = nilRatedTxs.filter(
    (tx) =>
      new Decimal(tx.cgst).isZero() &&
      new Decimal(tx.sgst).isZero() &&
      new Decimal(tx.igst).isZero() &&
      new Decimal(tx.taxableValue).gt(0)
  )

  // Aggregate nil-rated by state
  const nilMap = new Map<string, NilRatedRow>()
  for (const tx of nilRatedFiltered) {
    const key = tx.placeOfSupply
    const existing = nilMap.get(key)
    if (existing) {
      existing.taxableValue = new Decimal(existing.taxableValue).plus(tx.taxableValue).toString()
    } else {
      nilMap.set(key, { placeOfSupply: key, taxableValue: tx.taxableValue.toString() })
    }
  }

  return {
    b2b: Array.from(b2bMap.values()),
    b2cs: Array.from(b2csMap.values()),
    cdnr: Array.from(cdnrMap.values()),
    hsn: Array.from(hsnMap.values()),
    nilRated: Array.from(nilMap.values()),
  }
}

// ─── GSTR-3B Summary ─────────────────────────────────────────────────────────

/**
 * Aggregates GstTransaction rows into GSTR-3B summary figures.
 * Includes any user overrides stored in GstReturn.jsonData.
 *
 * @param companyId  - Must come from session.user.companyId
 * @param period     - "MM/YYYY" format (e.g., "04/2025")
 */
export async function getGstr3bSummary(companyId: string, period: string): Promise<Gstr3bSummary> {
  // 3.1(a): outward taxable supplies from SALES (non-RCM)
  const salesTxs = await prisma.gstTransaction.findMany({
    where: {
      companyId,
      returnPeriod: period,
      reverseCharge: false,
      voucher: { status: 'POSTED', voucherType: 'SALES' },
    },
  })

  // 3.1(b): zero/nil-rated (igst=0, cgst=0, sgst=0 — export or nil-rated)
  const zeroTxs = salesTxs.filter(
    (tx) =>
      new Decimal(tx.cgst).isZero() &&
      new Decimal(tx.sgst).isZero() &&
      new Decimal(tx.igst).isZero()
  )

  // 3.1(d): RCM inward supplies
  const rcmTxs = await prisma.gstTransaction.findMany({
    where: {
      companyId,
      returnPeriod: period,
      reverseCharge: true,
      voucher: { status: 'POSTED', voucherType: 'PURCHASE' },
    },
  })

  // 4(A)(5): eligible ITC from purchase invoices — itcEligible = true only
  const itcItems = await prisma.voucherItem.findMany({
    where: {
      itcEligible: true,
      voucher: {
        companyId,
        status: 'POSTED',
        voucherType: 'PURCHASE',
        gstTransactions: { some: { returnPeriod: period } },
      },
    },
    select: { cgstAmt: true, sgstAmt: true, igstAmt: true },
  })

  // Helper to sum a field across GstTransaction rows
  type GstTxRow = (typeof salesTxs)[number]
  const sumField = (txs: GstTxRow[], field: 'taxableValue' | 'cgst' | 'sgst' | 'igst') =>
    txs.reduce((acc, tx) => acc.plus(tx[field]), new Decimal(0))

  const outward = {
    taxable: sumField(salesTxs, 'taxableValue').toString(),
    cgst: sumField(salesTxs, 'cgst').toString(),
    sgst: sumField(salesTxs, 'sgst').toString(),
    igst: sumField(salesTxs, 'igst').toString(),
  }

  const zeroRated = {
    taxable: sumField(zeroTxs, 'taxableValue').toString(),
  }

  const rcm = {
    taxable: sumField(rcmTxs, 'taxableValue').toString(),
    cgst: sumField(rcmTxs, 'cgst').toString(),
    sgst: sumField(rcmTxs, 'sgst').toString(),
    igst: sumField(rcmTxs, 'igst').toString(),
  }

  const itcCgst = itcItems.reduce((acc, i) => acc.plus(i.cgstAmt ?? 0), new Decimal(0))
  const itcSgst = itcItems.reduce((acc, i) => acc.plus(i.sgstAmt ?? 0), new Decimal(0))
  const itcIgst = itcItems.reduce((acc, i) => acc.plus(i.igstAmt ?? 0), new Decimal(0))

  const itcAvailable = {
    cgst: itcCgst.toString(),
    sgst: itcSgst.toString(),
    igst: itcIgst.toString(),
  }

  // 6.1: net tax payable = outward GST minus eligible ITC (floor at 0)
  const netCgst = new Decimal(outward.cgst).minus(itcCgst)
  const netSgst = new Decimal(outward.sgst).minus(itcSgst)
  const netIgst = new Decimal(outward.igst).minus(itcIgst)
  const netPayable = {
    cgst: netCgst.gt(0) ? netCgst.toString() : '0',
    sgst: netSgst.gt(0) ? netSgst.toString() : '0',
    igst: netIgst.gt(0) ? netIgst.toString() : '0',
  }

  // Load any overrides from GstReturn.jsonData
  const gstReturn = await prisma.gstReturn.findFirst({
    where: { companyId, returnType: 'GSTR3B', returnPeriod: period },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overrides = (gstReturn?.jsonData as any)?.overrides ?? null

  return {
    outwardTaxable: outward,
    zeroNilRated: zeroRated,
    rcmInward: rcm,
    itcAvailable,
    netPayable,
    overrides,
  }
}
