---
phase: 20-user-management
plan: "02"
subsystem: user-management-api
tags: [api, auth, bcrypt, audit-log, security]
dependency_graph:
  requires: [20-01]
  provides: [self-deactivation-guard-in-patch, post-reset-password-endpoint]
  affects:
    - app/api/v1/users/[id]/route.ts
    - app/api/v1/users/[id]/reset-password/route.ts
tech_stack:
  added: []
  patterns: [idor-guard, self-guard, prisma-transaction-with-audit-log, bcrypt-hash]
key_files:
  created:
    - app/api/v1/users/[id]/reset-password/route.ts
  modified:
    - app/api/v1/users/[id]/route.ts
decisions:
  - Self-deactivation guard placed after Zod parse + IDOR guard so isActive === false is confirmed before comparing userId
  - bcrypt rounds set to 10 to match the existing users route pattern (not 12 from seed)
  - audit log newValue is { passwordReset: true } — hash never logged (T-20-05 mitigation)
  - companyId sourced from session in IDOR guard — never from request params (T-20-04 mitigation)
metrics:
  duration_minutes: 8
  completed_date: "2026-05-31"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 20 Plan 02: User Management API Guards Summary

**One-liner:** Self-deactivation guard added to PATCH /users/[id] and new POST /users/[id]/reset-password endpoint with bcrypt + prisma transaction + audit log.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add self-deactivation guard to PATCH handler | b20833b | app/api/v1/users/[id]/route.ts |
| 2 | Create password reset endpoint | a8df4d8 | app/api/v1/users/[id]/reset-password/route.ts |

---

## What Was Built

**Task 1 — PATCH guard:** Added a self-deactivation guard to the PATCH handler in `users/[id]/route.ts`. The guard fires only when `parsed.data.isActive === false` AND `userId === session.userId`, returning 400 with "You cannot deactivate your own account." It is placed after the Zod parse success check and after the IDOR guard (where `existing` is confirmed), before the `$transaction` call. Mirrors the existing self-delete guard in the DELETE handler.

**Task 2 — reset-password route:** Created `app/api/v1/users/[id]/reset-password/route.ts` exporting a single POST handler with the full security chain: auth (401) → permission check users.admin (403) → IDOR guard with companyId from session (404) → self-reset guard (400) → Zod schema validation password.min(8) (422) → bcrypt.hash(10) → prisma.$transaction(user.update + auditLog.create) → { ok: true }. The audit log `newValue` is `{ passwordReset: true }` — the hash is never stored in logs or returned in any response.

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None.

---

## Threat Surface Scan

Both changes are within the plan's threat model:
- T-20-03 (self-deactivation DoS): mitigated by Task 1 guard
- T-20-04 (reset-password IDOR): mitigated by companyId-from-session in Task 2 IDOR guard
- T-20-05 (audit log hash disclosure): mitigated by newValue: { passwordReset: true } in Task 2
- T-20-06 (privilege escalation on reset): mitigated by requirePermission('users', 'admin') in Task 2

No new network surfaces beyond what the plan describes.

---

## Self-Check

- [x] app/api/v1/users/[id]/route.ts — modified, committed b20833b
- [x] app/api/v1/users/[id]/reset-password/route.ts — created, committed a8df4d8
- [x] grep "You cannot deactivate your own account" route.ts — 2 matches (PATCH guard + DELETE guard, both intentional)
- [x] grep -c "export async function POST" reset-password/route.ts = 1
- [x] grep -c "passwordReset: true" reset-password/route.ts = 2 (data field + JSDoc comment)
- [x] grep -c "blockUser" reset-password/route.ts = 0

## Self-Check: PASSED
