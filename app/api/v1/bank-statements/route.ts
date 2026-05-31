/**
 * GET /api/v1/bank-statements — list all bank statement imports for the company
 * POST /api/v1/bank-statements — upload + parse + auto-match a bank CSV
 *
 * Security:
 *   - auth() first on every handler → 401 before any processing
 *   - companyId ALWAYS from session.companyId — NEVER from form body (T-07-03-06)
 *   - File size: 10MB cap before file.text() (T-07-03-02)
 *   - File type: validated by extension (.csv) not MIME (RESEARCH.md anti-pattern)
 *   - bank + ledgerId validated via Zod before DB touch
 *
 * Uploads pattern follows app/api/v1/gst/gstr2a/import/route.ts exactly.
 */

import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { importStatement } from '@/lib/services/BankService'
import { BANK_PARSERS } from '@/lib/banking/bankParsers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

// Zod schema for POST form fields (bank + ledgerId)
const uploadSchema = z.object({
  bank: z.enum(['SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak']),
  ledgerId: z.string().min(1, 'ledgerId is required'),
})

// ---------------------------------------------------------------------------
// GET — list bank statements for the authenticated company
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId  // NEVER from query params

  try {
    const statements = await prisma.bankStatement.findMany({
      where: { companyId },
      include: { ledger: { select: { name: true } } },
      orderBy: { uploadedAt: 'desc' },
    })

    return NextResponse.json(
      statements.map((stmt) => ({
        id: stmt.id,
        bank: stmt.bank,
        ledgerName: stmt.ledger.name,
        fromDate: stmt.fromDate,
        toDate: stmt.toDate,
        uploadedAt: stmt.uploadedAt,
        rowCount: stmt.rowCount,
      })),
    )
  } catch (err) {
    console.error('[bank-statements GET]', err)
    return NextResponse.json({ error: 'Failed to fetch bank statements' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST — upload a bank CSV, parse it, persist, and run auto-matching
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId  // NEVER from form body (T-07-03-06)
  const userId = session.userId

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
  }

  // Extract file
  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'file field is required and must be a file' }, { status: 400 })
  }

  // Validate .csv extension (not MIME — browsers send inconsistent MIME for CSV)
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return NextResponse.json({ error: 'Only .csv files are accepted' }, { status: 400 })
  }

  // 10MB cap before reading file bytes (T-07-03-02 DoS protection)
  const MAX_SIZE = 10 * 1024 * 1024  // 10MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 })
  }

  // Validate bank + ledgerId form fields via Zod
  const bankValue = formData.get('bank')
  const ledgerIdValue = formData.get('ledgerId')

  const parsed = uploadSchema.safeParse({
    bank: bankValue,
    ledgerId: ledgerIdValue,
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid form fields', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { bank, ledgerId } = parsed.data

  // Decode CSV text — SBI uses latin1 encoding, others use utf-8
  let csvText: string
  try {
    const config = BANK_PARSERS[bank]
    if (config.encoding === 'latin1') {
      const buffer = await file.arrayBuffer()
      csvText = new TextDecoder('latin1').decode(buffer)
    } else {
      csvText = await file.text()
    }
  } catch (err) {
    console.error('[bank-statements POST] file read error', err)
    return NextResponse.json({ error: 'Failed to read CSV file' }, { status: 400 })
  }

  // Import: parse + persist + match
  try {
    const result = await importStatement({
      ledgerId,
      bank,
      csvText,
      companyId,
      userId,
    })

    return NextResponse.json({ id: result.statementId, rowCount: result.rowCount }, { status: 201 })
  } catch (err) {
    console.error('[bank-statements POST]', err)
    const message = err instanceof Error ? err.message : 'Failed to import bank statement'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
