---
phase: 21
plan: 05
subsystem: dependencies
tags: [cloud-removal, package-cleanup, inngest]
dependency_graph:
  requires: ["21-02", "21-03"]
  provides: ["CLOUD-06"]
  affects: ["package.json", "pnpm-lock.yaml", "app/api/inngest/route.ts"]
tech_stack:
  removed: ["inngest", "@upstash/redis", "ioredis", "@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner", "resend", "posthog-js", "@neondatabase/serverless", "@prisma/adapter-neon", "@prisma/adapter-pg", "@types/ioredis", "posthog-node"]
key_files:
  modified: ["package.json", "pnpm-lock.yaml"]
  deleted: ["app/api/inngest/route.ts"]
decisions:
  - "Removed @neondatabase/serverless and @prisma/adapter-neon along with the 7 specified cloud packages — these were Neon PostgreSQL adapters no longer needed with SQLite"
  - "Deleted app/api/inngest/route.ts outright; lib/inngest.ts no-op stub remains for internal reference safety"
metrics:
  duration: "5 minutes"
  completed: "2026-06-01"
  tasks_completed: 2
  files_modified: 2
  files_deleted: 1
---

# Phase 21 Plan 05: Cloud Package Removal Summary

**One-liner:** Removed 12 cloud packages from package.json and deleted the Inngest API route so the app starts without any cloud env vars.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove cloud packages from package.json | c95248a | package.json, pnpm-lock.yaml |
| 2 | Delete Inngest API route | 5c2a627 | app/api/inngest/route.ts (deleted) |

## Packages Removed

**dependencies:**
- `inngest` ^4.2.6
- `@upstash/redis` ^1.37.0
- `ioredis` ^5.10.1
- `@aws-sdk/client-s3` ^3.1040.0
- `@aws-sdk/s3-request-presigner` ^3.1040.0
- `resend` ^6.12.2
- `posthog-js` ^1.372.6
- `@neondatabase/serverless` ^1.1.0 (Neon PostgreSQL — unused with SQLite)
- `@prisma/adapter-neon` ^7.8.0 (Neon adapter — unused with SQLite)

**devDependencies:**
- `@prisma/adapter-pg` ^7.8.0
- `@types/ioredis` ^5.0.0
- `posthog-node` ^5.34.2

## Verification

- `node -e "..."` check: PASS — no cloud packages in package.json
- `grep -rn "from 'inngest'" app/ lib/`: zero results (excluding lib/inngest.ts no-op stub)
- `pnpm install --no-frozen-lockfile`: exits 0, lockfile updated

## Deviations from Plan

**1. [Rule 2 - Missing critical] Also removed @neondatabase/serverless and @prisma/adapter-neon**
- Found during: Task 1
- Issue: Plan mentioned checking these Neon-specific packages; they were present in package.json but unused since SQLite migration
- Fix: Removed both from dependencies alongside the 7 specified packages
- Files modified: package.json
- Commit: c95248a

## Self-Check: PASSED

- package.json modified: confirmed (c95248a)
- pnpm-lock.yaml updated: confirmed (c95248a)
- app/api/inngest/route.ts deleted: confirmed (5c2a627)
- No direct inngest imports remain: verified
