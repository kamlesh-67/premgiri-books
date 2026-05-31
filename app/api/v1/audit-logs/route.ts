/**
 * GET /api/v1/audit-logs  — Paginated audit trail viewer (Admin-only).
 *
 * Query params:
 *   userId    — filter by user ID (optional)
 *   dateFrom  — ISO date string, inclusive lower bound on createdAt (optional)
 *   dateTo    — ISO date string, inclusive upper bound on createdAt (optional)
 *   entity    — filter by entity name, e.g. 'Company', 'Voucher' (optional)
 *   cursor    — opaque cursor: "{createdAt.toISOString()}__{id}" (optional)
 *
 * Pagination: cursor-based, 50 rows per page.
 * Takes 51 rows; if 51 returned, there is a next page — nextCursor = row[49]'s cursor.
 *
 * Security:
 *  - T-09-03-03: requirePermission('settings','admin') — Admin-only
 *  - T-09-03-04: companyId always from session.companyId
 *  - T-09-03-05: hard take:51 limit prevents full-table scans
 */
import { getSessionFromRequest } from '@/lib/session'
import { requirePermission } from '@/lib/utils/requirePermission'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Admin-only — audit trail exposes all mutations (T-09-03-03)
  const forbidden = requirePermission(session, 'settings', 'admin')
  if (forbidden) return forbidden

  const companyId = session.companyId
  const { searchParams } = new URL(request.url)

  const userId = searchParams.get('userId') ?? undefined
  const dateFrom = searchParams.get('dateFrom') ?? undefined
  const dateTo = searchParams.get('dateTo') ?? undefined
  const entity = searchParams.get('entity') ?? undefined
  const cursorParam = searchParams.get('cursor') ?? undefined

  // Parse cursor: "{isoDate}__{id}"
  let cursorId: string | undefined
  if (cursorParam) {
    const separatorIndex = cursorParam.lastIndexOf('__')
    if (separatorIndex !== -1) {
      cursorId = cursorParam.slice(separatorIndex + 2)
    }
  }

  // Build where clause — companyId is always from session (multi-tenant rule)
  const where: Prisma.AuditLogWhereInput = {
    companyId,
    ...(userId ? { userId } : {}),
    ...(entity ? { entity } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
  }

  // Take 51 to detect whether there is a next page (T-09-03-05)
  const results = await prisma.auditLog.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 51,
    ...(cursorId
      ? {
          cursor: { id: cursorId },
          skip: 1,
        }
      : {}),
  })

  const hasMore = results.length === 51
  const rows = hasMore ? results.slice(0, 50) : results

  // Compute next cursor from the 50th item (index 49)
  const nextCursor =
    hasMore ? `${rows[49].createdAt.toISOString()}__${rows[49].id}` : null

  return NextResponse.json({
    data: rows,
    nextCursor,
  })
}
