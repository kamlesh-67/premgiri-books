/**
 * GET  /api/v1/app-settings?key=file_output_folder
 * PUT  /api/v1/app-settings   { key: 'file_output_folder', value: string }
 *
 * Machine-level settings (not tenant-scoped). Uses authDb to bypass the
 * tenant extension on the main prisma client.
 */
import { getSessionFromRequest } from '@/lib/session'
import { requirePermission } from '@/lib/utils/requirePermission'
import { authDb } from '@/lib/authDb'
import { NextResponse, NextRequest } from 'next/server'
import { z } from 'zod'

// Only one key is allowed in this MVP — prevents arbitrary key injection (T-21-04-03)
const ALLOWED_KEYS = z.literal('file_output_folder')

const putSchema = z.object({
  key: ALLOWED_KEYS,
  value: z.string().max(1000),
})

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key = request.nextUrl.searchParams.get('key')
  const parsed = ALLOWED_KEYS.safeParse(key)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
  }

  const row = await authDb.appSettings.findUnique({ where: { key: parsed.data } })
  return NextResponse.json({ key: parsed.data, value: row?.value ?? null })
}

// ─── PUT ─────────────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // T-21-04-02: restrict writes to settings.admin
  const forbidden = requirePermission(session, 'settings', 'admin')
  if (forbidden) return forbidden

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { key, value } = parsed.data

  const row = await authDb.appSettings.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })

  return NextResponse.json({ key: row.key, value: row.value, updatedAt: row.updatedAt })
}
