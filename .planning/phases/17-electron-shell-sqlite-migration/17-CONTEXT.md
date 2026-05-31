# Phase 17: Electron Shell + SQLite Migration — Context

**Gathered:** 2026-05-31
**Status:** Ready for planning
**Source:** Conversation context (user's explicit decisions)

<domain>
## Phase Boundary

Convert the existing Next.js 15 web app (currently targeting Vercel + Neon PostgreSQL) into an Electron desktop app that runs offline on Windows. This phase covers:

1. Wrapping the Next.js app in Electron using `nextron`
2. Replacing the Prisma PostgreSQL provider with SQLite
3. Ensuring the app launches as a native Electron window on `pnpm dev`
4. Storing the SQLite database at `%APPDATA%\PremGiriBooks\data.db`

Does NOT include auth changes (Phase 18), first-run wizard (Phase 19), user management (Phase 20), cloud service removal (Phase 21), or AI/installer (Phase 22).

</domain>

<decisions>
## Implementation Decisions

### Electron Framework
- Use `nextron` to wrap the existing Next.js 15 App Router app — chosen because it supports Next.js App Router and requires minimal structural change vs a full rewrite
- Electron main process lives at `electron/main.ts` (nextron convention)
- App window opens on `http://localhost:3000` (nextron dev server)
- App data directory: `app.getPath('userData')` → `%APPDATA%\PremGiriBooks\`
- No tray icon initially — standard window only

### Database
- Prisma provider: change from `postgresql` to `sqlite`
- SQLite file path: `%APPDATA%\PremGiriBooks\data.db` (accessed via Electron main process `app.getPath`)
- Prisma `DATABASE_URL` in `.env`: `file:./data.db` for dev; actual production path set at runtime via Electron's `process.env` injection before Prisma client initializes
- `prisma/schema.prisma` provider field changes from `postgresql` to `sqlite`

### SQLite Compatibility Adjustments
- `SELECT FOR UPDATE` (used in voucher sequence increment) → replace with SQLite `BEGIN EXCLUSIVE` transaction pattern inside Prisma `$executeRawUnsafe` or a serialized queue
- `@db.Decimal(15,2)` annotations: SQLite has no `DECIMAL` type; use Prisma `Decimal` type (Prisma handles this transparently with the SQLite driver) — verify with a round-trip test
- `pgvector` extension and embedding columns (`embedding` Float[]): remove from schema or comment out for this milestone (AI phase handles conditionally)
- Any `@db.Text` or `@db.VarChar(N)` annotations that are PostgreSQL-specific: remove (SQLite ignores them anyway but Prisma may complain)
- JSON fields (`JSONB` in Postgres → `Json` in Prisma for SQLite): verify Prisma handles this; SQLite stores JSON as TEXT

### Schema Migration
- Run `prisma migrate dev --name init-sqlite` after provider switch to generate fresh SQLite migration
- If existing migrations conflict, reset with `prisma migrate reset` in dev (data loss acceptable for fresh start)
- Create a seed script (`prisma/seed.ts`) that is minimal — just account groups and basic ledger structure (no demo data per user requirement)

### Environment
- `.env` for dev: `DATABASE_URL="file:./dev.db"` (local dev)
- Electron main process injects production DB path into `process.env.DATABASE_URL` before the Next.js server starts
- Remove all cloud env vars from `.env.example` that are now irrelevant (NEON_DATABASE_URL, UPSTASH_REDIS_URL, etc.) — they will error on startup otherwise

### Claude's Discretion
- Nextron version selection (latest stable)
- Electron version (latest stable compatible with Next.js 15)
- Window size defaults (1280×800 minimum)
- Whether to use `electron-store` for app config (deferred to Phase 21 for folder path preference)
- Dev vs prod Electron config split

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — stack, constraints, non-negotiable rules
- `.planning/REQUIREMENTS.md` — ELEC-01..03, DB-01..04 (this phase's requirements)
- `prisma/schema.prisma` — current schema (needs provider change + annotation cleanup)
- `CLAUDE.md` — project-specific rules

### Key Files to Modify
- `package.json` — add nextron, electron, electron-builder deps
- `prisma/schema.prisma` — provider: sqlite, remove pg-specific annotations
- `.env` / `.env.example` — update DATABASE_URL, remove cloud vars
- `lib/prisma.ts` — Prisma client singleton (may need path injection)

</canonical_refs>

<specifics>
## Specific Requirements This Phase

**ELEC-01:** App launches as native Windows desktop window (not browser)
**ELEC-02:** Core accounting functions work fully offline
**ELEC-03:** SQLite DB at `%APPDATA%\PremGiriBooks\data.db`
**DB-01:** All existing Prisma models work with SQLite provider
**DB-02:** Voucher sequence `SELECT FOR UPDATE` replaced with SQLite-safe exclusive transaction
**DB-03:** `Decimal @db.Decimal(15,2)` fields handled correctly (Prisma Decimal + SQLite)
**DB-04:** All 16 tables in fresh SQLite migration without errors

</specifics>

<deferred>
## Deferred (not this phase)

- Windows installer (.exe / NSIS) — Phase 22
- NextAuth removal — Phase 18
- First-run wizard — Phase 19
- Cloud service removal (Inngest, Redis, R2, email) — Phase 21
- AI online check — Phase 22
- User-selectable file folder — Phase 21

</deferred>

---

*Phase: 17-electron-shell-sqlite-migration*
*Context gathered: 2026-05-31 from conversation*
