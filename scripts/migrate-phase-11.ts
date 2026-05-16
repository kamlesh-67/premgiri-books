#!/usr/bin/env tsx
/**
 * Phase 11 DDL Migration Script
 * Changes embedding columns from vector(1536) to vector(1024) on vouchers and ledgers tables.
 * Creates the notifications table for cron deduplication.
 * Recreates ivfflat indexes after the column type change.
 *
 * Run: pnpm migrate:phase-11
 *
 * Prerequisites:
 *   - DATABASE_URL env var must be set (via .env.local)
 *   - pgvector extension must be installed on the target PostgreSQL instance
 *     (available on Neon; may not be available on local PostgreSQL)
 *
 * NOTE on production deployment:
 *   - Steps 2-3 (ALTER + CREATE INDEX) require pgvector extension
 *   - On local PostgreSQL without pgvector, Steps 2-3 will fail gracefully (caught)
 *   - Step 4 (notifications table) will still run successfully
 *   - For production Neon, run this script against DATABASE_URL or use Neon SQL Editor
 *   - Production index creation uses CREATE INDEX CONCURRENTLY (outside transaction):
 *     CREATE INDEX CONCURRENTLY IF NOT EXISTS "Voucher_embedding_idx"
 *       ON "vouchers" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
 */

import { Pool } from 'pg'
import { config } from 'dotenv'
import { execSync } from 'child_process'

// Load .env.local (local dev) or .env (CI/CD)
config({ path: '.env.local' })
config({ path: '.env' })

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('[migrate-phase-11] FATAL: DATABASE_URL is not set.')
  console.error('  Set it in .env.local before running this script.')
  process.exit(1)
}

const pool = new Pool({ connectionString: DATABASE_URL })

async function run(): Promise<void> {
  console.log('[migrate-phase-11] Starting Phase 11 DDL migration...')
  console.log(`[migrate-phase-11] Target: ${DATABASE_URL?.replace(/:([^@]+)@/, ':***@')}`)
  console.log('')

  const client = await pool.connect()
  try {
    // ─────────────────────────────────────────────────────────────────────────
    // Step 1 — Drop existing ivfflat indexes (no-op if absent)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[Step 1] Dropping existing embedding indexes (if any)...')

    const indexesToDrop = [
      'Voucher_embedding_idx',
      'vouchers_embedding_idx',
      'Ledger_embedding_idx',
      'ledgers_embedding_idx',
      'Party_embedding_idx',
      'parties_embedding_idx',
    ]

    for (const idx of indexesToDrop) {
      try {
        await client.query(`DROP INDEX IF EXISTS "${idx}"`)
        console.log(`  [OK] DROP INDEX IF EXISTS "${idx}"`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`  [WARN] Could not drop index "${idx}": ${msg}`)
      }
    }
    console.log('[Step 1] Done.\n')

    // ─────────────────────────────────────────────────────────────────────────
    // Step 2 — Alter columns to vector(1024)
    // NOTE: Requires pgvector extension. Will fail gracefully if not available.
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[Step 2] Altering embedding columns to vector(1024)...')
    console.log('  NOTE: Requires pgvector extension. On local PostgreSQL without pgvector,')
    console.log('  this step will fail gracefully — the schema change is still valid for Prisma.')

    let vectorAvailable = true

    try {
      await client.query(`
        ALTER TABLE "ledgers"
          ALTER COLUMN "embedding" TYPE vector(1024) USING NULL
      `)
      console.log('  [OK] ledgers.embedding: vector(1024)')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  [WARN] ledgers ALTER failed: ${msg}`)
      if (msg.includes('type "vector" does not exist') || msg.includes('extension')) {
        vectorAvailable = false
        console.warn('  [INFO] pgvector not installed locally. Skipping vector column changes.')
        console.warn('  [INFO] Schema source-of-truth (prisma/schema.prisma) already updated.')
        console.warn('  [INFO] Run this script against Neon (production) to apply the column change.')
      }
    }

    if (vectorAvailable) {
      try {
        await client.query(`
          ALTER TABLE "vouchers"
            ALTER COLUMN "embedding" TYPE vector(1024) USING NULL
        `)
        console.log('  [OK] vouchers.embedding: vector(1024)')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`  [WARN] vouchers ALTER failed: ${msg}`)
      }
    }
    console.log('[Step 2] Done.\n')

    // ─────────────────────────────────────────────────────────────────────────
    // Step 3 — Recreate ivfflat indexes with vector_cosine_ops
    // NOTE: Locally we use plain CREATE INDEX (not CONCURRENTLY).
    // Production (Neon): use CREATE INDEX CONCURRENTLY in Neon SQL Editor.
    // Per AI-SPEC §3 Common Pitfall 3: ivfflat indexes must be recreated after ALTER COLUMN.
    // ─────────────────────────────────────────────────────────────────────────
    if (vectorAvailable) {
      console.log('[Step 3] Recreating ivfflat indexes (vector_cosine_ops)...')

      try {
        await client.query(`
          CREATE INDEX IF NOT EXISTS "Voucher_embedding_idx"
            ON "vouchers" USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100)
        `)
        console.log('  [OK] Voucher_embedding_idx created')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`  [WARN] Voucher_embedding_idx creation failed: ${msg}`)
      }

      try {
        await client.query(`
          CREATE INDEX IF NOT EXISTS "Ledger_embedding_idx"
            ON "ledgers" USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100)
        `)
        console.log('  [OK] Ledger_embedding_idx created')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`  [WARN] Ledger_embedding_idx creation failed: ${msg}`)
      }

      console.log('[Step 3] Done.\n')
    } else {
      console.log('[Step 3] Skipped (pgvector not available).\n')
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 4 — Create notifications table (idempotent)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[Step 4] Creating notifications table...')

    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS "notifications" (
          id               text PRIMARY KEY,
          "companyId"      text NOT NULL,
          type             text NOT NULL,
          "entityId"       text,
          "sentAt"         timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "recipientEmail" text NOT NULL,
          metadata         jsonb NOT NULL DEFAULT '{}',
          CONSTRAINT notifications_company_fk
            FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE
        )
      `)
      console.log('  [OK] notifications table created (or already exists)')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  [ERROR] notifications table creation failed: ${msg}`)
      throw err
    }

    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS "notifications_companyId_type_sentAt_idx"
          ON "notifications" ("companyId", type, "sentAt")
      `)
      console.log('  [OK] notifications_companyId_type_sentAt_idx created (or already exists)')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  [ERROR] notifications index creation failed: ${msg}`)
      throw err
    }

    console.log('[Step 4] Done.\n')

    // ─────────────────────────────────────────────────────────────────────────
    // Step 5 — Verify
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[Step 5] Verification queries...')

    // Check notifications table exists
    const notifCheck = await client.query<{ regclass: string | null }>(
      `SELECT to_regclass('public.notifications') AS regclass`
    )
    const notifExists = notifCheck.rows[0]?.regclass === 'notifications'
    console.log(`  notifications table: ${notifExists ? '[OK] EXISTS' : '[FAIL] NOT FOUND'}`)

    // Check index on notifications
    const notifIdxCheck = await client.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'notifications' AND indexname LIKE '%companyId%'`
    )
    console.log(`  notifications index: ${notifIdxCheck.rows.length > 0 ? '[OK] EXISTS' : '[FAIL] NOT FOUND'}`)

    if (vectorAvailable) {
      // Check embedding column type on vouchers
      const voucherColCheck = await client.query<{ format_type: string }>(
        `SELECT format_type(atttypid, atttypmod) AS format_type
         FROM pg_attribute
         WHERE attrelid = '"vouchers"'::regclass AND attname = 'embedding'`
      )
      const vType = voucherColCheck.rows[0]?.format_type
      console.log(`  vouchers.embedding type: ${vType ?? 'NOT FOUND'} ${vType === 'vector(1024)' ? '[OK]' : '[UNEXPECTED]'}`)

      // Check embedding column type on ledgers
      const ledgerColCheck = await client.query<{ format_type: string }>(
        `SELECT format_type(atttypid, atttypmod) AS format_type
         FROM pg_attribute
         WHERE attrelid = '"ledgers"'::regclass AND attname = 'embedding'`
      )
      const lType = ledgerColCheck.rows[0]?.format_type
      console.log(`  ledgers.embedding type: ${lType ?? 'NOT FOUND'} ${lType === 'vector(1024)' ? '[OK]' : '[UNEXPECTED]'}`)

      // Check embedding indexes
      const embIdxCheck = await client.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes
         WHERE tablename IN ('vouchers', 'ledgers') AND indexname LIKE '%embedding%'`
      )
      console.log(`  embedding indexes: ${embIdxCheck.rows.length} found (${embIdxCheck.rows.map(r => r.indexname).join(', ')})`)
    }

    console.log('[Step 5] Done.\n')
    console.log('[migrate-phase-11] DDL complete.')
    console.log('')
    console.log('Next step: Run pnpm prisma generate to regenerate the TypeScript client.')

  } finally {
    client.release()
    await pool.end()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 6 — Run prisma generate
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Step 6] Running pnpm prisma generate...')
  try {
    execSync('pnpm prisma generate', { stdio: 'inherit', cwd: process.cwd() })
    console.log('[Step 6] prisma generate complete.')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Step 6] prisma generate failed: ${msg}`)
    console.error('Run manually: pnpm prisma generate')
    process.exit(1)
  }
}

run().catch(err => {
  console.error('[migrate-phase-11] FATAL:', err instanceof Error ? err.message : err)
  process.exit(1)
})
