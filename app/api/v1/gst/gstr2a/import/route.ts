import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { Decimal } from 'decimal.js'

const periodSchema = z.string().regex(/^\d{2}\/\d{4}$/, 'Period must be MM/YYYY')

// GSTN GSTR-2A JSON structure (standard portal download format)
interface Gstr2aItemDetail {
  txval?: string
  camt?: string
  samt?: string
  iamt?: string
}

interface Gstr2aItem {
  itm_det?: Gstr2aItemDetail
}

interface Gstr2aInvoice {
  inum: string    // invoice number
  dt: string      // DD-MM-YYYY
  val?: string    // total value
  itms?: Gstr2aItem[]
}

interface Gstr2aSupplier {
  ctin: string    // supplier GSTIN
  inv?: Gstr2aInvoice[]
}

interface Gstr2aJson {
  b2b?: Gstr2aSupplier[]
}

/**
 * POST /api/v1/gst/gstr2a/import
 *
 * Accepts multipart form data with:
 *  - file: GSTR-2A JSON downloaded from GST portal (application/json)
 *  - period: return period in MM/YYYY format
 *
 * Parses, validates, and bulk-upserts rows into Gstr2aImport table.
 * Returns import summary (imported, updated, errors).
 *
 * Security:
 *  - auth() first — 401 before any processing (T-03-03-01)
 *  - companyId ALWAYS from session.user.companyId — NEVER from form body
 *  - File MIME type validated + 10MB cap before parsing (T-03-03-02, T-03-03-05)
 *  - JSON.parse in try/catch — no eval (T-03-03-02)
 *  - auditLog written inside $transaction
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.user.companyId  // NEVER from body

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
  }

  // Extract file and period
  const file = formData.get('file')
  const periodValue = formData.get('period')

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'file field is required and must be a file' }, { status: 400 })
  }
  if (!periodValue || typeof periodValue !== 'string') {
    return NextResponse.json({ error: 'period field is required in MM/YYYY format' }, { status: 400 })
  }

  // Validate period format
  const periodParsed = periodSchema.safeParse(periodValue)
  if (!periodParsed.success) {
    return NextResponse.json({ error: 'period must be in MM/YYYY format' }, { status: 400 })
  }
  const period = periodParsed.data

  // Validate file type (T-03-03-02)
  const isJsonMime = file.type === 'application/json' || file.type === 'text/json'
  const isJsonExt = file.name.toLowerCase().endsWith('.json')
  if (!isJsonMime && !isJsonExt) {
    return NextResponse.json({ error: 'File must be a JSON file (.json)' }, { status: 400 })
  }

  // Validate file size — 10MB cap (T-03-03-05)
  const MAX_SIZE = 10 * 1024 * 1024  // 10MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: 'File size exceeds 10MB limit' },
      { status: 400 }
    )
  }

  // Read file content
  const text = await file.text()

  // Parse JSON safely (T-03-03-02 — no eval, no dynamic code execution)
  let gstr2aData: Gstr2aJson
  try {
    gstr2aData = JSON.parse(text) as Gstr2aJson
  } catch {
    return NextResponse.json({ error: 'Invalid JSON file — could not parse' }, { status: 400 })
  }

  if (!gstr2aData || typeof gstr2aData !== 'object') {
    return NextResponse.json({ error: 'Invalid GSTR-2A JSON structure' }, { status: 400 })
  }

  // Process invoices and upsert inside a transaction
  let importedCount = 0
  let updatedCount = 0
  let errorCount = 0

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const supplier of gstr2aData.b2b ?? []) {
          if (!supplier.ctin || typeof supplier.ctin !== 'string') continue

          for (const inv of supplier.inv ?? []) {
            if (!inv.inum || !inv.dt) {
              errorCount++
              continue
            }

            try {
              // Parse DD-MM-YYYY date format
              const [d, m, y] = inv.dt.split('-')
              const invoiceDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))

              if (isNaN(invoiceDate.getTime())) {
                errorCount++
                continue
              }

              // Sum taxableValue, cgst, sgst, igst from all itms entries
              let txval = new Decimal(0)
              let cgst = new Decimal(0)
              let sgst = new Decimal(0)
              let igst = new Decimal(0)

              for (const itm of inv.itms ?? []) {
                const det = itm.itm_det
                if (!det) continue
                if (det.txval) txval = txval.plus(new Decimal(det.txval))
                if (det.camt) cgst = cgst.plus(new Decimal(det.camt))
                if (det.samt) sgst = sgst.plus(new Decimal(det.samt))
                if (det.iamt) igst = igst.plus(new Decimal(det.iamt))
              }

              // Upsert: check if existing record exists
              const existing = await tx.gstr2aImport.findFirst({
                where: {
                  companyId,
                  returnPeriod: period,
                  supplierGstin: supplier.ctin,
                  invoiceNo: inv.inum,
                },
              })

              if (existing) {
                await tx.gstr2aImport.update({
                  where: { id: existing.id },
                  data: {
                    taxableValue: txval,
                    cgst,
                    sgst,
                    igst,
                    invoiceDate,
                    uploadedAt: new Date(),
                  },
                })
                updatedCount++
              } else {
                await tx.gstr2aImport.create({
                  data: {
                    companyId,
                    returnPeriod: period,
                    supplierGstin: supplier.ctin,
                    invoiceNo: inv.inum,
                    invoiceDate,
                    taxableValue: txval,
                    cgst,
                    sgst,
                    igst,
                  },
                })
                importedCount++
              }
            } catch {
              errorCount++
            }
          }
        }

        // Audit log for the entire import operation
        await tx.auditLog.create({
          data: {
            companyId,
            userId: session.user.id,
            entity: 'Gstr2aImport',
            entityId: companyId,
            action: 'CREATE',
            newValue: {
              returnPeriod: period,
              imported: importedCount,
              updated: updatedCount,
              errors: errorCount,
            } as object,
          },
        })
      },
      { timeout: 30000 }  // 30s timeout for large imports
    )

    return NextResponse.json({
      imported: importedCount,
      updated: updatedCount,
      errors: errorCount,
      period,
    })
  } catch (err) {
    console.error('[gst/gstr2a/import POST]', err)
    return NextResponse.json({ error: 'Failed to import GSTR-2A data' }, { status: 500 })
  }
}
