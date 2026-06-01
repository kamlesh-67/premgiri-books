---
phase: 22-optional-ai-windows-installer
plan: "03"
subsystem: ai-config
tags: [ai, settings, api-route, electron, safeStorage, online-gate]
dependency_graph:
  requires: [22-01]
  provides: [ai-config-api, ai-config-settings-page, useOnlineStatus-hook]
  affects:
    - app/api/v1/ai-config/route.ts
    - app/(app)/settings/ai-config/page.tsx
    - hooks/useOnlineStatus.ts
tech_stack:
  added: []
  patterns: [AppSettings sentinel flags, safeStorageSet IPC before API POST, online gate hook]
key_files:
  created:
    - app/api/v1/ai-config/route.ts
    - app/(app)/settings/ai-config/page.tsx
    - hooks/useOnlineStatus.ts
decisions:
  - "Route returns only boolean flags — actual key values never leave safeStorage"
  - "OWNER-only route enforced via session.user.role check (403 for others)"
  - "useOnlineStatus defaults to true so SSR/browser-dev mode works without Electron"
  - "handleSave calls safeStorageSet per-key only when input is non-empty, preserving existing keys"
metrics:
  duration: "10m"
  completed: "2026-06-01"
  tasks_completed: 2
  files_modified: 3
---

# Phase 22 Plan 03: AI Config API Route and Settings UI Summary

Built the Settings → AI Configuration page and the `/api/v1/ai-config` API route with boolean sentinel management, plus the `useOnlineStatus` hook for client-side Electron online gating.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create /api/v1/ai-config route (GET sentinel status, POST update sentinels) | c58a22f | app/api/v1/ai-config/route.ts |
| 2 | Create Settings AI Configuration page and useOnlineStatus hook | 0ad7792 | app/(app)/settings/ai-config/page.tsx, hooks/useOnlineStatus.ts |

## What Was Built

**app/api/v1/ai-config/route.ts:**
- GET: parallel `Promise.all` reads `VOYAGE_KEY_SET` and `ANTHROPIC_KEY_SET` from AppSettings; returns `{ voyageKeySet: boolean, anthropicKeySet: boolean }` — never the actual key
- POST: Zod-validated body `{ voyageKeySet?: boolean, anthropicKeySet?: boolean }`; upserts each sentinel present in body
- OWNER-only: `session.user.role !== 'OWNER'` → 403; no session → 401
- No `safeStorage`, `ipcRenderer`, or `require('electron')` references

**app/(app)/settings/ai-config/page.tsx:**
- `usePermission('settings', 'admin')` guard; renders "Access denied" and returns early for non-owners
- `useQuery(['ai-config'])` fetches GET response for masked status display
- Two `type="password"` inputs: Voyage AI API Key, Anthropic API Key
- `handleSave`: calls `window.electronAPI?.safeStorageSet` for each non-empty input, then POSTs sentinel booleans to `/api/v1/ai-config`
- Status lines with `CheckCircle2`/`Circle` icons showing "Key configured" / "Not configured"
- No `safeStorageGet` — keys are write-only from UI

**hooks/useOnlineStatus.ts:**
- `useState(true)` default (safe fallback for SSR and browser dev without Electron)
- `useEffect` on mount: checks `window.electronAPI?.isOnline?.()` and updates state
- Returns `boolean`

## Verification

- `pnpm exec tsc --noEmit` — no errors in new files (pre-existing errors unrelated to this plan)
- `grep "safeStorage" app/api/v1/ai-config/route.ts` — no matches (comment-only mention in JSDoc)
- `grep "safeStorageGet" "app/(app)/settings/ai-config/page.tsx"` — no matches
- All three files created at expected paths

## Deviations from Plan

None — plan executed exactly as written.

## Threat Mitigations Applied

- **T-22-06**: GET returns only boolean flags; actual key never returned
- **T-22-07**: `session.user.role !== 'OWNER'` → 403; applied to both GET and POST
- **T-22-08**: `usePermission('settings', 'admin')` guard renders access-denied and returns early

## Known Stubs

None.

## Threat Flags

None — no new network endpoints beyond the planned `/api/v1/ai-config`; no new auth paths.

## Self-Check: PASSED

- app/api/v1/ai-config/route.ts created: confirmed
- app/(app)/settings/ai-config/page.tsx created: confirmed
- hooks/useOnlineStatus.ts created: confirmed
- Commit c58a22f exists: confirmed
- Commit 0ad7792 exists: confirmed
