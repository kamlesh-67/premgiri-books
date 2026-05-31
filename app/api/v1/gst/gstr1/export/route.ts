import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { Decimal } from 'decimal.js'
import { getGstr1Sections } from '@/lib/services/GSTService'

const periodSchema = z.string().regex(/^\d{2}\/\d{4}$/, 'Period must be MM/YYYY')

/**
 * Formats a DD-MM-YYYY date string for GSTN JSON (DD-MM-YYYY).
 * Input: ISO date string (YYYY-MM-DD)
 * Output: DD-MM-YYYY as required by GSTN
 */
function toGstnDateFormat(isoDateStr: string): string {
  const date = new Date(isoDateStr)
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).replace(/\//g, '-')
}

/**
 * GET /api/v1/gst/gstr1/export?period=MM/YYYY
 *
 * Returns GSTN-format GSTR-1 JSON as a downloadable file.
 * ALL monetary amounts use toFixed(2) (string, never JS number) per GSTN spec.
 * Security:
 *  - auth() first — 401 before any processing
 *  - companyId and GSTIN always from DB (session scope) — T-03-03-04
 *  - period validated with Zod before any DB operation
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId  // NEVER from query params
  const { searchParams } = new URL(request.url)

  const periodParam = searchParams.get('period')
  const periodParsed = periodSchema.safeParse(periodParam)
  if (!periodParsed.success) {
    return NextResponse.json(
      { error: 'period query param required in MM/YYYY format' },
      { status: 400 }
    )
  }
  const period = periodParsed.data  // e.g. "04/2025"

  try {
    // Fetch company GSTIN from DB (T-03-03-04 — never from request)
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { gstin: true },
    })

    // GSTN fp field: "042025" from "04/2025"
    const fp = period.replace('/', '')

    const sections = await getGstr1Sections(companyId, period)

    // Build GSTN-format B2B section
    const b2bGstn = sections.b2b.map((party) => ({
      ctin: party.gstin,
      inv: party.invoices.map((inv) => ({
        inum: inv.invoiceNo,
        idt: toGstnDateFormat(inv.invoiceDate),
        val: new Decimal(inv.taxableValue)
          .plus(new Decimal(inv.cgst))
          .plus(new Decimal(inv.sgst))
          .plus(new Decimal(inv.igst))
          .toFixed(2),
        pos: inv.placeOfSupply,
        rchrg: inv.reverseCharge ? 'Y' : 'N',
        inv_typ: 'R',
        itms: [
          {
            num: 1,
            itm_det: {
              txval: new Decimal(inv.taxableValue).toFixed(2),
              iamt: new Decimal(inv.igst).toFixed(2),
              camt: new Decimal(inv.cgst).toFixed(2),
              samt: new Decimal(inv.sgst).toFixed(2),
              csamt: '0.00',
            },
          },
        ],
      })),
    }))

    // Build GSTN-format B2CS section
    const b2csGstn = sections.b2cs.map((row) => ({
      pos: row.placeOfSupply,
      typ: 'OE',
      txval: new Decimal(row.taxableValue).toFixed(2),
      iamt: new Decimal(row.igst).toFixed(2),
      camt: new Decimal(row.cgst).toFixed(2),
      samt: new Decimal(row.sgst).toFixed(2),
      csamt: '0.00',
    }))

    // Build GSTN-format CDNR section
    const cdnrGstn = sections.cdnr.map((party) => ({
      ctin: party.gstin,
      nt: party.notes.map((note) => ({
        ntty: note.noteType === 'C' ? 'C' : 'D',
        nt_num: note.noteNo,
        nt_dt: toGstnDateFormat(note.noteDate),
        val: new Decimal(note.taxableValue)
          .plus(new Decimal(note.cgst))
          .plus(new Decimal(note.sgst))
          .plus(new Decimal(note.igst))
          .toFixed(2),
        itms: [
          {
            num: 1,
            itm_det: {
              txval: new Decimal(note.taxableValue).toFixed(2),
              iamt: new Decimal(note.igst).toFixed(2),
              camt: new Decimal(note.cgst).toFixed(2),
              samt: new Decimal(note.sgst).toFixed(2),
              csamt: '0.00',
            },
          },
        ],
      })),
    }))

    // Build GSTN-format HSN section
    const hsnGstn = {
      data: sections.hsn.map((row, idx) => ({
        num: idx + 1,
        hsn_sc: row.hsnCode,
        desc: row.description,
        uqc: row.uom,
        cnt: parseFloat(row.qty),
        txval: new Decimal(row.taxableValue).toFixed(2),
        iamt: new Decimal(row.igst).toFixed(2),
        camt: new Decimal(row.cgst).toFixed(2),
        samt: new Decimal(row.sgst).toFixed(2),
        csamt: '0.00',
      })),
    }

    const gstnJson = {
      gstin: company.gstin ?? '',
      fp,
      b2b: b2bGstn,
      b2cs: b2csGstn,
      cdnr: cdnrGstn,
      hsn: hsnGstn,
    }

    const filename = `gstr1_${period.replace('/', '_')}.json`

    return new NextResponse(JSON.stringify(gstnJson, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[gst/gstr1/export GET]', err)
    return NextResponse.json({ error: 'Failed to export GSTR-1 JSON' }, { status: 500 })
  }
}
