/**
 * GET /api/v1/setup/status
 *
 * Returns whether first-run setup is required.
 * Public route — no authentication needed (called before session exists).
 *
 * Response: { setupRequired: boolean }
 *   true  — no company rows in DB; wizard should be shown
 *   false — company already exists; wizard is disabled
 */
import { NextResponse } from 'next/server'
import { authDb } from '@/lib/authDb'

export async function GET() {
  const count = await authDb.company.count()
  return NextResponse.json({ setupRequired: count === 0 })
}
