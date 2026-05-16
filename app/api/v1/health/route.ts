/**
 * GET /api/v1/health
 * Health check endpoint for deployment verification.
 * Returns DB and Redis connectivity status.
 *
 * Public endpoint — no auth required.
 * Returns only status strings; no stack traces or internal details (T-02-03).
 */
import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { NextResponse } from 'next/server'

export async function GET() {
  let dbStatus = 'connected'
  let redisStatus = 'connected'

  try {
    // Simple DB ping — raw query bypasses tenant scope guard
    await prisma.$queryRaw`SELECT 1`
  } catch {
    dbStatus = 'error'
  }

  try {
    const redis = await getRedis()
    await redis.ping()
  } catch {
    redisStatus = 'error'
  }

  const allOk = dbStatus === 'connected' && redisStatus === 'connected'

  return NextResponse.json(
    { status: allOk ? 'ok' : 'degraded', db: dbStatus, redis: redisStatus },
    { status: allOk ? 200 : 503 }
  )
}
