---
phase: 21-local-file-storage-cloud-removal
plan: "01"
subsystem: local-file-storage
tags: [prisma, sqlite, local-files, cloud-removal]
dependency_graph:
  requires: []
  provides: [AppSettings-model, localFiles-library]
  affects: [lib/authDb.ts, prisma/schema.prisma]
tech_stack:
  added: []
  patterns: [key-value-store, local-fs-abstraction]
key_files:
  created:
    - prisma/migrations/20260601000000_add_app_settings/migration.sql
    - lib/localFiles.ts
  modified:
    - prisma/schema.prisma
decisions:
  - AppSettings is machine-level (no companyId), accessed via authDb to bypass tenant extension
  - getOutputFolder falls back to OS APPDATA/PremGiriBooks/files when no DB row exists
  - filename-only parameter in writeLocalFile prevents path traversal (full path built server-side)
metrics:
  duration: "5 minutes"
  completed: "2026-05-31"
---

# Phase 21 Plan 01: AppSettings Model + Local File Library Summary

One-liner: SQLite AppSettings key-value model and local filesystem write library replacing R2 for the desktop Electron app.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add AppSettings model to Prisma schema and migration | 92a26f5 | prisma/schema.prisma, prisma/migrations/20260601000000_add_app_settings/migration.sql |
| 2 | Create lib/localFiles.ts — local filesystem write library | 38b55c5 | lib/localFiles.ts |

## What Was Built

### AppSettings Prisma Model

Added `AppSettings` model to `prisma/schema.prisma` with `key TEXT PRIMARY KEY`, `value TEXT`, and `updatedAt DATETIME`. Mapped to `app_settings` table via `@@map("app_settings")`. Not tenant-scoped — machine-level settings for the desktop app (e.g., output folder path).

Created migration SQL at `prisma/migrations/20260601000000_add_app_settings/migration.sql` with `CREATE TABLE "app_settings"` statement.

### lib/localFiles.ts

Three exports:
- `getOutputFolder()`: reads `file_output_folder` key from `app_settings` via `authDb.appSettings.findUnique`. Falls back to `%APPDATA%\PremGiriBooks\files` on Windows or `~/.PremGiriBooks/files` on other platforms.
- `writeLocalFile(filename, buffer)`: creates output folder recursively if missing, writes buffer, returns absolute path. Accepts filename-only (not full path) to prevent path traversal.
- `buildPayslipFilename(companyId, employeeId, month)`: returns a sanitized filesystem-safe filename for payslip PDFs.

No cloud service imports — no R2, AWS SDK, redis, inngest, resend, or posthog.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

T-21-01-01 (path traversal): mitigated — `writeLocalFile` accepts filename-only; full path is constructed server-side from a trusted DB-sourced folder. No user-controlled path component reaches `path.join` directly.

T-21-01-02 (app_settings disclosure): accepted — single-user desktop app; no cross-user isolation needed.

No new threat surface beyond what the plan's threat model covers.

## Self-Check: PASSED

- prisma/schema.prisma contains AppSettings model: confirmed (grep returns 1)
- prisma/migrations/20260601000000_add_app_settings/migration.sql exists: confirmed
- lib/localFiles.ts exports writeLocalFile: confirmed (grep returns 2 matches)
- No cloud imports in lib/localFiles.ts: confirmed (only comment mention, no import statements)
- Both commits verified in git log
