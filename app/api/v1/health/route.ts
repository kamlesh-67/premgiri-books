/**
 * GET /api/v1/health
 * Health check endpoint. Returns DB connectivity status.
 * Redis removed in Phase 21 (local SQLite mode).
 *
 * Public endpoint — no auth required.
 * Returns only status strings; no stack traces or internal details (T-02-03).
 */
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  let dbStatus = 'connected'

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    dbStatus = 'error'
  }

  return NextResponse.json(
    { status: dbStatus === 'connected' ? 'ok' : 'degraded', db: dbStatus },
    { status: dbStatus === 'connected' ? 200 : 503 }
  )
}
