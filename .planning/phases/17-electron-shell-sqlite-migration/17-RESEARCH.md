# Phase 17: Electron Shell + SQLite Migration — Research

**Researched:** 2026-05-31
**Domain:** Electron (nextron), Prisma SQLite migration, desktop app setup
**Confidence:** HIGH (architecture patterns), MEDIUM (nextron App Router behaviour)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use `nextron` to wrap the existing Next.js 15 App Router app
- Electron main process at `electron/main.ts` (nextron convention)
- App window opens on `http://localhost:3000` (nextron dev server)
- App data directory: `app.getPath('userData')` → `%APPDATA%\PremGiriBooks\`
- No tray icon initially
- Prisma provider: change from `postgresql` to `sqlite`
- SQLite file path: `%APPDATA%\PremGiriBooks\data.db`
- Dev DATABASE_URL: `file:./dev.db`; production path injected via `process.env` before Prisma client initializes
- `SELECT FOR UPDATE` → replace with SQLite-safe pattern inside Prisma transaction
- Remove `embedding Unsupported("vector(1024)")` column from Ledger and Voucher models
- Remove all `@db.Decimal`, `@db.VarChar`, `@db.Date`, `@db.Text` annotations
- Remove `postgresqlExtensions` previewFeature and `extensions = [vector]` from generator/datasource
- Remove `@prisma/adapter-neon`, `@neondatabase/serverless` from lib/prisma.ts (keep `PrismaClient` only, no adapter)
- Run `prisma migrate dev --name init-sqlite` for fresh migration
- Minimal seed: account groups + basic ledger structure only
- `.env`: `DATABASE_URL="file:./dev.db"`, remove cloud vars

### Claude's Discretion
- Nextron version (latest stable = 10.0.0)
- Electron version (latest stable compatible = 42.3.0)
- Window size defaults (1280x800 minimum)
- `electron-store` deferred to Phase 21
- Dev vs prod Electron config split

### Deferred Ideas (OUT OF SCOPE)
- Windows installer (.exe / NSIS) — Phase 22
- NextAuth removal — Phase 18
- First-run wizard — Phase 19
- Cloud service removal — Phase 21
- AI online check — Phase 22
- User-selectable file folder — Phase 21
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ELEC-01 | App launches as native Windows desktop window (not browser) | nextron wraps Next.js dev server in Electron BrowserWindow |
| ELEC-02 | Core accounting functions work fully offline | Prisma + SQLite is fully offline; API routes work via Next.js server embedded in Electron |
| ELEC-03 | SQLite DB at `%APPDATA%\PremGiriBooks\data.db` | Electron `app.getPath('userData')` + Prisma datasource URL injection |
| DB-01 | All existing Prisma models work with SQLite provider | Remove all pg-specific annotations; enums work (stored as TEXT) |
| DB-02 | `SELECT FOR UPDATE` replaced with SQLite-safe exclusive transaction | SQLite Serializable isolation makes SELECT FOR UPDATE redundant — Prisma `$transaction` is sufficient |
| DB-03 | Financial `Decimal` fields handled correctly in SQLite | Prisma Decimal type maps to DECIMAL/NUMERIC in SQLite; remove `@db.Decimal` annotation only |
| DB-04 | All 16 tables migrate successfully to SQLite schema | Requires removing pg-specific annotations + Unsupported vector type + replacing `@db.Date` with `DateTime` |
</phase_requirements>

---

## Summary

Phase 17 converts PremGiri Books from a cloud Next.js/PostgreSQL SaaS to an Electron desktop app backed by SQLite. Two parallel workstreams run concurrently: (1) wrapping the Next.js 15 App Router app with nextron, and (2) migrating the Prisma schema from PostgreSQL to SQLite.

**Critical discovery — nextron and App Router:** nextron v10 supports running a full Next.js dev server (not static export) in development mode, which means App Router, Server Actions, and API routes all work in development. In production, the default nextron build serves static files and breaks API routes. The solution — used by DoltHub and others — is to run the Next.js server via an HTTP server inside the Electron main process using `next()` + `http.createServer()`, which gives full API route support in both dev and production. For this phase (dev-only target), the nextron dev server approach is sufficient.

**Critical discovery — SQLite and `SELECT FOR UPDATE`:** SQLite enforces Serializable isolation on all transactions. Prisma interactive transactions on SQLite are already serialized — there is no need for `SELECT FOR UPDATE`. The existing `$executeRaw` call with `FOR UPDATE` will fail at migration time (SQLite does not support `FOR UPDATE` syntax). It must be removed entirely; the `$transaction` wrapper alone provides the required concurrency safety.

**Critical discovery — Prisma adapter change:** The current `lib/prisma.ts` uses `PrismaNeon` and `PrismaPg` adapters. For SQLite, no driver adapter is needed — `new PrismaClient()` with no adapter argument is the correct pattern. The Neon/pg adapter imports must be removed entirely.

**Primary recommendation:** Use nextron v10 + Electron v42. Run a full Next.js HTTP server inside the Electron main process (not static-file serving). Remove all pg-specific Prisma annotations, the vector column, and the adapter imports. Replace `SELECT FOR UPDATE` with plain `$transaction`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Window management | Electron Main | — | `BrowserWindow` creation, lifecycle events |
| DB path resolution | Electron Main | — | `app.getPath('userData')` only available in main process |
| DATABASE_URL injection | Electron Main | — | Must set `process.env` before Prisma client instantiates |
| Next.js HTTP server (prod) | Electron Main | — | `next()` + `http.createServer()` spawned from main |
| API routes / Server Actions | Next.js Server (in main) | — | Runs in the embedded Next.js server, not renderer |
| UI rendering | Renderer (Next.js App Router) | — | BrowserWindow loads `http://localhost:PORT` |
| Database I/O | Next.js API routes / Server Actions | — | Prisma runs in Node.js context (Next.js server process) |
| Schema migration | CLI (prisma migrate dev) | — | One-time setup before first run |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| nextron | 10.0.0 | Next.js + Electron integration | Official package; supports Next.js v14-v16 range |
| electron | 42.3.0 | Desktop shell | Latest stable; nextron compatible |
| electron-builder | latest stable | App packaging config (minimal for dev) | Standard for Electron packaging |

[VERIFIED: npm registry] — `npm view nextron version` → `10.0.0`; `npm view electron version` → `42.3.0`; all three passed slopcheck [OK]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| prisma (SQLite provider) | ^7.8.0 (already installed) | ORM for SQLite | Replace postgresql provider |
| @prisma/client | ^7.8.0 (already installed) | Generated client | No change to import |

### Removed Dependencies (this phase)

| Package | Why Removed |
|---------|-------------|
| `@prisma/adapter-neon` | PostgreSQL-specific; not used with SQLite |
| `@neondatabase/serverless` | Neon serverless driver; irrelevant for SQLite |
| `@prisma/adapter-pg` | pg adapter; only needed for PostgreSQL |
| `pg` | PostgreSQL driver; replaced by SQLite |

These remain in `package.json` for now (other phases may clean up) but must be removed from `lib/prisma.ts` imports.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| nextron | Manual electron + next setup | More control; no convenience scripts; more config |
| nextron | next-electron-rsc | Uses protocol interceptor instead of HTTP server; more complex |
| Prisma SQLite | better-sqlite3 + Drizzle | Sync API; more Electron-friendly; larger migration effort |

---

## Package Legitimacy Audit

| Package | Registry | slopcheck | Disposition |
|---------|----------|-----------|-------------|
| nextron | npm | [OK] | Approved |
| electron | npm | [OK] | Approved |
| electron-builder | npm | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
[ Windows user double-clicks app ]
         |
         v
[ Electron Main Process ]
  - electron/main.ts
  - Reads app.getPath('userData') → sets process.env.DATABASE_URL
  - Starts Next.js HTTP server on random port (dev: 3000, prod: dynamic)
  - Creates BrowserWindow → loads http://localhost:PORT
         |
         +---> [ Next.js Server (Node.js) ]
               - App Router: /app/**
               - API routes: /app/api/v1/**
               - Server Actions
               - Prisma Client ← reads DATABASE_URL from process.env
                      |
                      v
               [ SQLite: %APPDATA%\PremGiriBooks\data.db ]
         |
         v
[ Electron Renderer Process ]
  - BrowserWindow renders http://localhost:PORT
  - Full Next.js UI (React, Tailwind, shadcn/ui)
  - No direct DB access (renderer cannot reach Node.js/Prisma)
```

### Recommended Project Structure Changes

```
premgiri-books/
├── electron/
│   ├── main.ts          ← NEW: Electron main process (nextron convention)
│   └── preload.ts       ← NEW: contextBridge (minimal for this phase)
├── nextron.config.ts    ← NEW: nextron configuration
├── electron-builder.yml ← NEW: minimal packaging config (dev only)
├── app/                 ← UNCHANGED: Next.js App Router (keep as-is)
├── lib/
│   └── prisma.ts        ← MODIFY: remove adapters, plain PrismaClient
├── prisma/
│   └── schema.prisma    ← MODIFY: sqlite provider, remove pg annotations
├── .env                 ← MODIFY: DATABASE_URL=file:./dev.db
└── package.json         ← MODIFY: add nextron scripts, electron deps
```

### Pattern 1: nextron Dev Setup

**What:** nextron wraps the Next.js dev server. On `pnpm dev`, nextron starts the Next.js server and opens an Electron BrowserWindow pointing to localhost.

**When to use:** Development mode — App Router, API routes, Server Actions all work.

```typescript
// electron/main.ts (nextron convention)
import { app, BrowserWindow } from 'electron'
import path from 'path'

const isProd = process.env.NODE_ENV === 'production'

// CRITICAL: Set DATABASE_URL BEFORE any import that might trigger Prisma client
// (Prisma client is lazy-loaded but must resolve env at instantiation time)
if (isProd) {
  const dbPath = path.join(app.getPath('userData'), 'data.db')
  process.env.DATABASE_URL = `file:${dbPath}`
}

app.on('ready', async () => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1280,
    minHeight: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  const port = process.argv[2] // nextron passes the dev port as argv[2]
  const url = isProd
    ? `http://localhost:${port}`
    : `http://localhost:${port}`
  mainWindow.loadURL(url)
})
```

```typescript
// nextron.config.ts
import type { NextronConfig } from 'nextron'

const config: NextronConfig = {
  rendererSrcDir: 'app',       // or keep default 'renderer'
  mainSrcDir: 'electron',
}

export default config
```

[ASSUMED] — nextron v10 config file name and shape; verify against official nextron docs before implementation.

### Pattern 2: Prisma SQLite Client (No Adapter)

**What:** For SQLite, Prisma does NOT use a driver adapter. Remove `PrismaNeon`/`PrismaPg` imports and instantiate `PrismaClient` directly.

```typescript
// lib/prisma.ts — MODIFIED for SQLite
import { PrismaClient } from '@prisma/client'

// No adapter needed for SQLite — Prisma uses bundled SQLite3 driver
function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  }).$extends({
    query: {
      $allOperations({ model, operation, args, query }) {
        guardTenantScope(model ?? '', operation, args as Record<string, unknown>)
        return query(args)
      },
    },
  })
}
```

[VERIFIED: npm registry / Prisma docs] — SQLite provider requires no adapter; `PrismaClient()` alone is correct.

### Pattern 3: Voucher Sequence (SQLite-safe — No `FOR UPDATE`)

**What:** SQLite enforces Serializable isolation on all transactions. `SELECT FOR UPDATE` is not a valid SQLite SQL syntax and will throw at runtime. The Prisma `$transaction` wrapper alone is sufficient.

**Replace the `$executeRaw` call entirely:**

```typescript
// BEFORE (PostgreSQL — REMOVE THIS):
await tx.$executeRaw`SELECT id FROM voucher_sequences WHERE id = ${seqRow.id} FOR UPDATE`

// AFTER (SQLite — remove the executeRaw entirely):
// No lock needed — SQLite $transaction is already serialized (Serializable isolation)
// The upsert + update inside $transaction is concurrency-safe on SQLite

export async function getNextVoucherNo(
  tx: PrismaTx,
  companyId: string,
  voucherType: VoucherType,
  fy: string
): Promise<string> {
  const seqRow = await tx.voucherSequence.upsert({
    where: { companyId_voucherType_financialYear: { companyId, voucherType, financialYear: fy } },
    create: { companyId, voucherType, financialYear: fy, lastSequence: 0 },
    update: {},
  })

  // Re-read current value (no FOR UPDATE needed — transaction is already exclusive)
  const lockedRow = await tx.voucherSequence.findFirstOrThrow({
    where: { id: seqRow.id, companyId },
  })

  const nextSeq = lockedRow.lastSequence + 1
  await tx.voucherSequence.update({
    where: { id: seqRow.id, companyId },
    data: { lastSequence: nextSeq },
  })

  const prefix = TYPE_PREFIX[voucherType]
  return `${prefix}-${fy}-${String(nextSeq).padStart(4, '0')}`
}
```

[VERIFIED: Prisma docs] — "CockroachDB and SQLite only support the Serializable isolation level." Prisma $transaction on SQLite is fully serialized.

### Pattern 4: DATABASE_URL Runtime Injection

**What:** Electron main process must set `process.env.DATABASE_URL` before the Next.js server starts (and before Prisma client is first instantiated).

```typescript
// electron/main.ts — top of file, before any other imports that may load Prisma
import { app } from 'electron'
import path from 'path'

const isProd = app.isPackaged
if (isProd) {
  // Inject the user-specific SQLite path BEFORE Next.js server starts
  const dbDir = app.getPath('userData')
  process.env.DATABASE_URL = `file:${path.join(dbDir, 'data.db')}`
} else {
  // Dev: use local dev.db (relative to project root, handled by .env)
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'file:./dev.db'
}
```

**Prisma client then reads `process.env.DATABASE_URL` at instantiation time** (which is lazy, on first use from a Next.js API route). This pattern works because Node.js environment variables are process-global and Prisma reads them synchronously at instantiation.

[ASSUMED] — Timing of Prisma client instantiation relative to env injection; needs verification with a smoke test.

### Prisma Schema Changes Required

```diff
 generator client {
   provider        = "prisma-client-js"
-  previewFeatures = ["postgresqlExtensions"]
 }

 datasource db {
-  provider   = "postgresql"
-  extensions = [vector]
+  provider = "sqlite"
+  url      = env("DATABASE_URL")
 }

 model Company {
-  gstin          String?  @db.VarChar(15)
-  pan            String?  @db.VarChar(10)
+  gstin          String?
+  pan            String?
-  annualTurnover  Decimal? @db.Decimal(15, 2)
+  annualTurnover  Decimal?
   ...
 }

 model Ledger {
-  openingBalance Decimal    @default(0) @db.Decimal(15, 2)
+  openingBalance Decimal    @default(0)
-  embedding      Unsupported("vector(1024)")?   ← REMOVE ENTIRE FIELD
   ...
 }

 model Voucher {
-  date            DateTime      @db.Date          ← change to DateTime (no @db.Date)
+  date            DateTime
-  embedding       Unsupported("vector(1024)")?   ← REMOVE ENTIRE FIELD
   ...
 }
```

**All `@db.VarChar(N)`, `@db.Decimal(N,M)`, `@db.Date` annotations must be removed.**
**All `Unsupported("vector(1024)")` fields must be removed.**
SQLite ignores length constraints; Prisma will error on migration if pg-specific native type annotations are present.

[VERIFIED: Prisma community / linen.dev] — "Native type VarChar is not supported for sqlite connector"

### Anti-Patterns to Avoid

- **Keep `SELECT FOR UPDATE` in SQLite:** Will throw SQL syntax error — SQLite does not support `FOR UPDATE`. Remove it.
- **Keep `@db.Decimal` in SQLite schema:** Prisma CLI will reject these — "native type X is not supported for sqlite connector". Remove all `@db.*` except `@db.Blob`.
- **Keep `Unsupported("vector(1024)")` in SQLite schema:** `Unsupported` type in migration will fail — SQLite has no vector type. Remove these fields.
- **Keep the Neon/pg adapter in lib/prisma.ts:** Will fail at runtime — adapter is PostgreSQL-specific. Remove it.
- **Run `prisma migrate deploy` instead of `prisma migrate dev` for initial setup:** Use `prisma migrate dev --name init-sqlite` for the initial SQLite migration to generate the SQL file.
- **Load Next.js in renderer process:** Prisma cannot run in renderer (browser context). All DB calls must go through Next.js API routes/Server Actions running in the server process.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Electron + Next.js integration | Custom `child_process.fork` setup from scratch | `nextron` | Convention, scripts, TypeScript config included |
| SQLite driver for Prisma | Custom SQLite binding | Prisma's built-in SQLite provider | Prisma bundles better-sqlite3 for Node.js |
| Concurrent write safety | Custom mutex/queue | Prisma `$transaction` | SQLite Serializable isolation handles it |
| Window management | Raw Electron boilerplate | nextron `createWindow` helper | nextron abstracts BrowserWindow setup |

---

## Runtime State Inventory

This phase is not a rename/refactor — it is a provider migration. Runtime state inventory applies only for the database:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | PostgreSQL: Neon cloud database (dev/staging data) | Not migrated — fresh SQLite; data loss acceptable (per CONTEXT.md) |
| Live service config | Vercel env vars (DATABASE_URL pointing to Neon) | Not relevant for desktop; remove from .env.example |
| OS-registered state | None | None |
| Secrets/env vars | `DATABASE_URL`, `NEXTAUTH_SECRET`, cloud keys in .env | Replace DATABASE_URL; others cleaned up in Phase 21 |
| Build artifacts | `prisma/migrations/` — existing PostgreSQL migration files | Reset with `prisma migrate reset` or delete migrations folder and re-init |

---

## Common Pitfalls

### Pitfall 1: `SELECT FOR UPDATE` SQL Error on SQLite

**What goes wrong:** The existing `VoucherEngine.ts` calls `tx.$executeRaw\`SELECT id FROM voucher_sequences WHERE id = ${seqRow.id} FOR UPDATE\`` — SQLite does not support `FOR UPDATE` and throws `sqlite3: near "FOR": syntax error`.

**Why it happens:** PostgreSQL-specific row-level locking syntax.

**How to avoid:** Remove the `$executeRaw` call entirely. SQLite's Serializable isolation guarantees that Prisma `$transaction` already serializes all writes. The upsert + update pattern is safe without any explicit lock.

**Warning signs:** Runtime error mentioning `FOR UPDATE` or `syntax error near "FOR"` on SQLite.

### Pitfall 2: Prisma Schema Annotation Validation Errors

**What goes wrong:** Running `prisma migrate dev` with `@db.VarChar`, `@db.Decimal`, `@db.Date` in the schema when provider is `sqlite` causes Prisma CLI to error: `Native type VarChar is not supported for sqlite connector`.

**Why it happens:** These annotations are PostgreSQL/MySQL-specific.

**How to avoid:** Remove every `@db.*` annotation (except `@db.Blob` which is valid for SQLite). Search: `grep -n "@db\." prisma/schema.prisma`.

**Warning signs:** `prisma validate` or `prisma migrate dev` errors mentioning "native type not supported".

### Pitfall 3: Prisma Client Instantiates Before DATABASE_URL is Set

**What goes wrong:** If any module that imports `prisma` is evaluated before `process.env.DATABASE_URL` is set in main.ts, Prisma uses the `.env` file value (`file:./dev.db`), which points to the wrong location in production.

**Why it happens:** Prisma reads `DATABASE_URL` once at `new PrismaClient()` time. If the import chain evaluates before env injection, the wrong path is used.

**How to avoid:** Set `process.env.DATABASE_URL` at the very top of `electron/main.ts`, before any other imports. Prisma uses lazy instantiation (singleton in `lib/prisma.ts`) — the env must be set before the first query is executed, not just before import.

**Warning signs:** Production DB file appears in wrong directory (project root instead of `%APPDATA%`).

### Pitfall 4: `Unsupported("vector(1024)")` in SQLite Migration

**What goes wrong:** The schema has `embedding Unsupported("vector(1024)")` on both `Ledger` and `Voucher` models. Prisma cannot generate a valid SQLite migration for `Unsupported` types — it will error or generate invalid SQL.

**Why it happens:** `Unsupported` was used for the pgvector extension which does not exist in SQLite.

**How to avoid:** Remove the `embedding` field entirely from both models before running migration.

**Warning signs:** Migration file contains SQL with `vector(1024)` which SQLite cannot execute.

### Pitfall 5: nextron App Router API Routes Break in Production Build

**What goes wrong:** Default nextron production build exports static files, breaking all Next.js API routes and Server Actions. The app works in `pnpm dev` but API calls 404 in production.

**Why it happens:** nextron's production build uses `next export` (static) by default, not `next build` + server.

**How to avoid (Phase 22 concern, but must design for now):** Use an HTTP server pattern in the Electron main process for production: `next()` + `http.createServer()`. For this phase (dev mode only), the default nextron dev server is sufficient. Document this limitation so Phase 22 handles production.

**Warning signs:** All API routes return 404 or network errors in packaged `.exe`.

### Pitfall 6: `Json` Fields with SQLite Default Migration Error

**What goes wrong:** Prisma has a known issue (#26571) where `Json` fields with `@default("{}")` in SQLite can cause migration problems — the generated SQL may have syntax errors.

**Why it happens:** SQLite stores JSON as TEXT; Prisma's migration generator may emit invalid DEFAULT expressions.

**How to avoid:** After running `prisma migrate dev`, inspect the generated SQL in `prisma/migrations/` for any `DEFAULT '{}'` expressions. If present, manually fix to `DEFAULT '{}'` (TEXT literal). Alternatively remove the `@default("{}")` from `Json` fields in the schema and handle default in application code.

**Warning signs:** Migration fails with SQL syntax error on a `Json` column.

---

## Code Examples

### nextron package.json scripts

```json
{
  "scripts": {
    "dev": "nextron",
    "build": "nextron build",
    "build:electron": "electron-builder"
  }
}
```

[ASSUMED] — verify against nextron v10 docs; script names may differ.

### Minimal electron-builder.yml (dev reference only — full packaging is Phase 22)

```yaml
appId: com.premgiribooks.app
productName: PremGiri Books
directories:
  output: dist
files:
  - electron/**
  - renderer/.next/**
  - package.json
```

[ASSUMED] — minimal config; electron-builder requires tuning for Phase 22.

### Prisma schema datasource (after migration)

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

[VERIFIED: Prisma docs] — correct SQLite datasource block.

### Seed script pattern (minimal)

```typescript
// prisma/seed.ts — minimal seed for SQLite (no demo data)
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Seed account groups (system-level, required for ledger creation)
  const groups = [
    { name: 'Capital Account', nature: 'LIABILITY', affectsGP: false, isSystem: true },
    { name: 'Current Assets', nature: 'ASSET', affectsGP: false, isSystem: true },
    { name: 'Current Liabilities', nature: 'LIABILITY', affectsGP: false, isSystem: true },
    { name: 'Sales Accounts', nature: 'INCOME', affectsGP: true, isSystem: true },
    { name: 'Purchase Accounts', nature: 'EXPENSE', affectsGP: true, isSystem: true },
    { name: 'Direct Expenses', nature: 'EXPENSE', affectsGP: true, isSystem: true },
    { name: 'Indirect Expenses', nature: 'EXPENSE', affectsGP: false, isSystem: true },
    { name: 'Indirect Income', nature: 'INCOME', affectsGP: false, isSystem: true },
    { name: 'Fixed Assets', nature: 'ASSET', affectsGP: false, isSystem: true },
    { name: 'Bank Accounts', nature: 'ASSET', affectsGP: false, isSystem: true },
    { name: 'Cash-in-Hand', nature: 'ASSET', affectsGP: false, isSystem: true },
    { name: 'Sundry Debtors', nature: 'ASSET', affectsGP: false, isSystem: true },
    { name: 'Sundry Creditors', nature: 'LIABILITY', affectsGP: false, isSystem: true },
    { name: 'Duties & Taxes', nature: 'LIABILITY', affectsGP: false, isSystem: true },
  ]
  // Seed requires a companyId — seed runs after first company is created in Phase 19
  // For schema validation, seed can be a no-op placeholder here
  console.log('Seed: schema-only run. Company-level seed runs post first-run wizard.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
```

[ASSUMED] — account group list based on standard Indian accounting groups; verify against existing seed.ts if one exists.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Nextron static export for production | Run Next.js HTTP server inside Electron main process | 2023-2024 | API routes work in packaged apps |
| `SELECT FOR UPDATE` in SQLite | Remove; rely on Prisma $transaction Serializable isolation | Always true for SQLite | Simpler code, no SQL syntax error |
| Prisma with pg adapter (Neon) | Plain `PrismaClient()` for SQLite | N/A (different provider) | Simpler lib/prisma.ts |

**Deprecated/outdated:**
- `postgresqlExtensions` previewFeature: remove — not valid for SQLite
- `@db.VarChar`, `@db.Decimal`, `@db.Date` annotations: remove — not supported by SQLite connector
- `Unsupported("vector(1024)")` fields: remove — pgvector is PostgreSQL-only

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | nextron v10 supports Next.js 15 App Router (dev server mode) | Standard Stack | May need manual server setup instead of nextron dev command |
| A2 | nextron config file is `nextron.config.ts` with `rendererSrcDir` and `mainSrcDir` fields | Code Examples | Wrong config keys cause nextron CLI to fail |
| A3 | nextron passes the dev port as `process.argv[2]` | Pattern 1 | Window fails to load if port injection differs |
| A4 | Prisma singleton in lib/prisma.ts is lazy enough that env injection in main.ts before first query is sufficient | Pattern 4 | Production DB path resolves to wrong location |
| A5 | Account group list in seed script is complete | Code Examples | First-run wizard may fail if groups are missing |
| A6 | electron-builder.yml `files` glob covers all required assets | Code Examples | Packaged app missing files (Phase 22 concern) |

---

## Open Questions (RESOLVED)

1. **Does nextron v10 officially support Next.js 15 App Router?**
   - What we know: nextron README states Next.js v14-v16 range is supported; App Router works in dev (server mode); production requires custom server setup
   - What's unclear: Whether nextron v10 has an `app-router` example template
   - Recommendation: Start implementation; if nextron CLI fails with Next.js 15, the manual `next()` + `http.createServer()` pattern (DoltHub approach) is the fallback
   - **RESOLVED:** nextron runs a full Node.js dev server (not static export), so App Router including Server Components and Route Handlers works in dev. Smoke-test verification is in Plan 17-03. If nextron dev server fails with App Router, Pitfall 5 fallback applies.

2. **Does `prisma migrate dev` work cleanly with the existing schema after removing pg annotations?**
   - What we know: `Json @default("{}")` has a known migration bug (#26571); must inspect generated SQL
   - What's unclear: Whether Prisma 7.x has fixed this for SQLite
   - Recommendation: Run `prisma validate` after schema changes, then `prisma migrate dev`; manually fix SQL if needed
   - **RESOLVED:** Pitfall 6 in RESEARCH.md documents the Json `@default({})` migration bug and the fix. Plan 17-03 Task 2 includes inspection and manual fix step. This is an accepted risk with a documented mitigation.

3. **Does the `@db.Date` annotation (`DateTime @db.Date`) cause migration errors or just get ignored in SQLite?**
   - What we know: `@db.Date` is PostgreSQL-specific; Prisma schema reference does not list it for SQLite
   - What's unclear: Whether Prisma 7.x throws on `@db.Date` for SQLite or silently drops it
   - Recommendation: Remove all `@db.Date` annotations proactively; use plain `DateTime`
   - **RESOLVED:** Plan 17-02 Task 1 removes ALL `@db.*` annotations proactively, so `@db.Date` will not be present in the SQLite schema. No migration error risk.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | nextron / Electron build | ✓ | v20 LTS (project requirement) | — |
| pnpm | package install | ✓ | Project standard | — |
| electron | Electron shell | needs install | 42.3.0 | — |
| nextron | Dev workflow | needs install | 10.0.0 | Manual setup |
| Python (for native modules) | electron-builder | [ASSUMED] available on Windows | — | Install Python 3 if missing |

**Missing dependencies with no fallback:** electron, nextron — must be installed (pnpm add -D nextron electron electron-builder)

**Note:** Prisma's SQLite provider uses a bundled SQLite3 binary — no external SQLite installation required.

---

## Validation Architecture

Testing is explicitly deferred for this milestone (per REQUIREMENTS.md "Vitest/Playwright test suite — deferred until Electron migration stabilises"). The validation approach is smoke-test based:

### Phase Gate Smoke Tests

| Test | How to Run | What Passes |
|------|-----------|-------------|
| Prisma schema validates | `pnpm prisma validate` | No errors |
| SQLite migration runs | `pnpm prisma migrate dev --name init-sqlite` | All 16 tables created |
| Prisma client generates | `pnpm prisma generate` | No errors |
| Electron window opens | `pnpm dev` | BrowserWindow appears |
| App Router loads | `pnpm dev` → navigate to `/dashboard` | Page renders |
| API route works | `pnpm dev` → call any API route | Returns data from SQLite |
| Voucher sequence test | Create a sales voucher | Sequence number SI-2024-25-0001 assigned |
| DB file location | After first API call | `%APPDATA%\PremGiriBooks\dev.db` exists (dev) |

---

## Security Domain

ASVS categories applicable to this phase:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (Phase 18) | — |
| V3 Session Management | No (Phase 18) | — |
| V4 Access Control | Partial | companyId guard in lib/prisma.ts preserved |
| V5 Input Validation | Yes | Zod on all API inputs (unchanged) |
| V6 Cryptography | No | — |

**Security notes specific to Electron:**
- `nodeIntegration: false` and `contextIsolation: true` are mandatory in BrowserWindow config — never enable nodeIntegration in renderer
- preload.ts must use `contextBridge.exposeInMainWorld` for any IPC — do not expose raw `ipcRenderer`
- SQLite file path is derived from `app.getPath('userData')` — never accept the path from renderer/user input

---

## Sources

### Primary (HIGH confidence)
- Prisma docs: SQLite connector — https://www.prisma.io/docs/orm/overview/databases/sqlite
- Prisma docs: Transactions — https://www.prisma.io/docs/orm/prisma-client/queries/transactions
- Prisma community (linen.dev): "Native type VarChar is not supported for sqlite connector" — https://www.linen.dev/s/prisma/t/2351548/
- Prisma GitHub issue #7889: Electron integration — https://github.com/prisma/prisma/discussions/7889

### Secondary (MEDIUM confidence)
- nextron GitHub: https://github.com/saltyshiomix/nextron — version 10.0.0 confirmed
- DoltHub blog: Building Electron + Next.js with nextron — https://www.dolthub.com/blog/2024-09-11-building-an-electron-app-with-nextjs/
- brunolm blog: nextron API routes in production — https://brunolm.wordpress.com/2023/12/19/how-to-make-a-nextron-app-with-api-routes-even-in-production-bundled-mode/
- nextron discussion #254: API routes in production — https://github.com/saltyshiomix/nextron/discussions/254

### Tertiary (LOW confidence)
- WebSearch: nextron App Router support claims — unverified; treat nextron App Router support as [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — npm registry confirmed; slopcheck [OK]
- SQLite annotation cleanup: HIGH — Prisma docs + community confirmed
- SELECT FOR UPDATE removal: HIGH — Prisma docs confirm SQLite Serializable isolation
- nextron App Router support: MEDIUM — README claims Next.js v14-v16; App Router unconfirmed in official examples
- nextron config structure: LOW — inferred from README and third-party boilerplates

**Research date:** 2026-05-31
**Valid until:** 2026-07-01 (nextron is moderately stable; Prisma SQLite support is stable)
