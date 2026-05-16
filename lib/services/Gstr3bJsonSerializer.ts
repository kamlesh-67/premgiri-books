import { Decimal } from 'decimal.js'

/**
 * Input type for GSTR-3B serializer.
 * Field names are intentionally separate from Gstr3bSummary (GSTService) to
 * decouple the serializer from internal aggregation logic.
 */
export type Gstr3bInput = {
  outwardTaxable: { taxableValue: string; cgst: string; sgst: string; igst: string }
  outwardZeroRated: { taxableValue: string; igst: string }
  outwardNilExempt: { taxableValue: string }
  inwardRcm: { taxableValue: string; cgst: string; sgst: string; igst: string }
  itcAvailable: { cgst: string; sgst: string; igst: string }
}

/**
 * GSTN GSTR-3B JSON schema (v3.0).
 * All monetary amounts are strings with exactly 2 decimal places.
 * Cess (csamt) is always "0.00" — not tracked in this application.
 */
export type Gstr3bJson = {
  gstin: string
  ret_period: string  // "MMYYYY" e.g. "042025"
  sup_details: {
    osup_det: { txval: string; iamt: string; camt: string; samt: string; csamt: string }
    osup_zero: { txval: string; iamt: string }
    osup_nil_exmp: { txval: string }
    isup_rev: { txval: string; iamt: string; camt: string; samt: string; csamt: string }
  }
  itc_elg: {
    itc_avl: Array<{ ty: string; iamt: string; camt: string; samt: string; csamt: string }>
    itc_rev: Array<{ ty: string; iamt: string; camt: string; samt: string; csamt: string }>
    itc_net: { iamt: string; camt: string; samt: string; csamt: string }
    itc_inelg: Array<{ ty: string; iamt: string; camt: string; samt: string; csamt: string }>
  }
  inward_sup: {
    isup_details: Array<{ ty: string; inter: string; intra: string }>
  }
}

/**
 * Serialize a Gstr3bInput to GSTN-compatible GSTR-3B JSON.
 *
 * Rules:
 * - All amounts: strings with exactly 2 decimal places (e.g. "12345.00")
 * - ret_period: "MMYYYY" — strip the "/" from "MM/YYYY"
 * - Cess (csamt) always "0.00" — not tracked in this app
 *
 * @param summary  - Aggregated GSTR-3B figures (use Gstr3bInput; map from Gstr3bSummary at call site)
 * @param gstin    - Company GSTIN (from DB, never from request)
 * @param period   - "MM/YYYY" format, e.g. "04/2025"
 */
export function serialize(summary: Gstr3bInput, gstin: string, period: string): Gstr3bJson {
  // period: "04/2025" → ret_period: "042025"
  const ret_period = period.replace(/\//g, '')
  if (!/^\d{6}$/.test(ret_period)) {
    throw new Error(`Invalid ret_period produced from period "${period}": expected MMYYYY`)
  }

  const fmt = (val: string): string => new Decimal(val).toFixed(2)

  return {
    gstin,
    ret_period,
    sup_details: {
      osup_det: {
        txval: fmt(summary.outwardTaxable.taxableValue),
        iamt: fmt(summary.outwardTaxable.igst),
        camt: fmt(summary.outwardTaxable.cgst),
        samt: fmt(summary.outwardTaxable.sgst),
        csamt: '0.00',
      },
      osup_zero: {
        txval: fmt(summary.outwardZeroRated.taxableValue),
        iamt: fmt(summary.outwardZeroRated.igst),
      },
      osup_nil_exmp: {
        txval: fmt(summary.outwardNilExempt.taxableValue),
      },
      isup_rev: {
        txval: fmt(summary.inwardRcm.taxableValue),
        iamt: fmt(summary.inwardRcm.igst),
        camt: fmt(summary.inwardRcm.cgst),
        samt: fmt(summary.inwardRcm.sgst),
        csamt: '0.00',
      },
    },
    itc_elg: {
      itc_avl: [
        {
          ty: 'OTH',  // Other ITC — covers all normal purchases (most common)
          iamt: fmt(summary.itcAvailable.igst),
          camt: fmt(summary.itcAvailable.cgst),
          samt: fmt(summary.itcAvailable.sgst),
          csamt: '0.00',
        },
      ],
      itc_rev: [],     // No reversals tracked in Phase 8
      itc_net: {
        iamt: fmt(summary.itcAvailable.igst),
        camt: fmt(summary.itcAvailable.cgst),
        samt: fmt(summary.itcAvailable.sgst),
        csamt: '0.00',
      },
      itc_inelg: [],   // No ineligible ITC tracked in Phase 8
    },
    inward_sup: {
      isup_details: [
        { ty: 'ISRC', inter: '0.00', intra: '0.00' },  // RCM inward (stub)
        { ty: 'OE',   inter: '0.00', intra: '0.00' },  // Other exempt (stub)
      ],
    },
  }
}
