/**
 * authDb — unextended PrismaClient for authentication queries ONLY.
 *
 * WHY THIS EXISTS: The main prisma client in lib/prisma.ts uses a Prisma extension
 * that enforces multi-tenant companyId on every query (TenantScopeError if missing).
 * During login, we need to find a User by email WITHOUT knowing companyId yet.
 * Using authDb bypasses the tenant extension — use ONLY for auth operations.
 *
 * DO NOT use authDb for any other purpose. All other DB access must use lib/prisma.ts.
 *
 * NOTE: No driver adapter needed — Prisma's built-in SQLite provider requires no pg/PrismaPg.
 */
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const globalForAuthDb = globalThis as unknown as { __authDb?: PrismaClient }

function createAuthDb() {
  const dbUrl = process.env['DATABASE_URL'] ?? `file:${path.resolve('dev.db')}`
  const rawPath = dbUrl.replace(/^file:/, '')
  const dbPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath)
  const adapter = new PrismaBetterSqlite3({ url: dbPath })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const authDb = globalForAuthDb.__authDb ?? createAuthDb()

if (process.env.NODE_ENV !== 'production') {
  globalForAuthDb.__authDb = authDb
}
