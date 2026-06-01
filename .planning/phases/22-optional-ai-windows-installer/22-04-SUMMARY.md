---
phase: 22-optional-ai-windows-installer
plan: "04"
subsystem: ai-online-gate
tags: [ai, online-gate, electron, useOnlineStatus, SmartInsightsWidget, search]
dependency_graph:
  requires: [22-03]
  provides: [smart-insights-online-gate, search-online-gate]
  affects:
    - components/shared/SmartInsightsWidget.tsx
    - app/api/v1/search/route.ts
    - hooks/useOnlineStatus.ts
    - types/electron.d.ts
tech_stack:
  added: []
  patterns: [TanStack Query enabled option, Electron net.isOnline() try/catch guard, offline degraded UI]
key_files:
  modified:
    - components/shared/SmartInsightsWidget.tsx
    - app/api/v1/search/route.ts
  created:
    - hooks/useOnlineStatus.ts (synced into worktree from main repo — created in plan 22-03)
    - types/electron.d.ts (synced into worktree from main repo)
decisions:
  - "useQuery enabled: isOnline prevents fetch when offline; data stays undefined; no error state triggered"
  - "Offline branch uses same SectionCard wrapper as online path to preserve layout consistency"
  - "embedQuery is skipped via isOnline conditional on the queryVecPromise — text iLike queries run regardless"
  - "require('electron').net.isOnline() wrapped in try/catch defaults to true in browser dev mode"
metrics:
  duration: "8m"
  completed: "2026-06-01"
  tasks_completed: 2
  files_modified: 4
---

# Phase 22 Plan 04: Online Gate for SmartInsightsWidget and Search Route Summary

Applied the `useOnlineStatus` hook (created in Plan 22-03) to `SmartInsightsWidget` to prevent AI fetch when offline and show a degraded message. Gated `embedQuery` in the search route behind `net.isOnline()` so text-only fallback activates automatically when offline. Closes AI-01, AI-02, AI-03.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Apply useOnlineStatus gate to SmartInsightsWidget | d65ecd8 | components/shared/SmartInsightsWidget.tsx, hooks/useOnlineStatus.ts, types/electron.d.ts |
| 2 | Gate /api/v1/search route — skip embedQuery when offline | 23f8dd8 | app/api/v1/search/route.ts |

## What Was Built

**components/shared/SmartInsightsWidget.tsx:**
- Added `import { useOnlineStatus } from '@/hooks/useOnlineStatus'`
- Added `const isOnline = useOnlineStatus()` in component body (all hooks called unconditionally)
- Added `enabled: isOnline` to existing `useQuery` options object — prevents fetch when offline
- Added offline early-return branch after hook calls: renders same `SectionCard` with offline message paragraph (`text-sm text-gray-500`)
- Message text: "AI insights are unavailable while offline. Connect to the internet to enable Smart Insights."
- No direct `window.electronAPI.isOnline()` call — routed through hook

**app/api/v1/search/route.ts:**
- Added `let isOnline = true; try { isOnline = require('electron').net.isOnline() } catch {}`
- `queryVecPromise` now conditional: when `isOnline` is false, resolves immediately to `{ ledgers: [], vouchers: [] }`
- `embedQuery` is never called when offline — text iLike queries still run normally
- Response schema unchanged — no `mode` field added (it wasn't in the existing route)

**hooks/useOnlineStatus.ts (worktree sync):**
- Synced from main repo into worktree (created in plan 22-03, missing from worktree)
- Named export `useOnlineStatus(): boolean`
- Defaults to `true`; checks `window.electronAPI?.isOnline()` on mount

**types/electron.d.ts (worktree sync):**
- Synced from main repo to resolve TypeScript errors on `window.electronAPI`

## Verification

- `npx tsc --noEmit` — no new errors in modified files; pre-existing errors are unrelated missing packages
- `grep "useOnlineStatus" components/shared/SmartInsightsWidget.tsx` — matches (import + hook call)
- `grep "enabled: isOnline" components/shared/SmartInsightsWidget.tsx` — matches
- `grep "AI insights are unavailable while offline" components/shared/SmartInsightsWidget.tsx` — matches
- `grep "require('electron').net.isOnline" app/api/v1/search/route.ts` — matches
- No `window.electronAPI.isOnline` direct call in SmartInsightsWidget

## Deviations from Plan

**[Rule 3 - Blocking] Added hooks/useOnlineStatus.ts to worktree**
- Found during: Task 1
- Issue: The hook was created in Plan 22-03 in the main repo but was not present in the worktree; TypeScript import failed
- Fix: Synced the file from `D:/My/BPG/design-inspirations-main/hooks/useOnlineStatus.ts` into the worktree
- Files modified: hooks/useOnlineStatus.ts (created)

**[Rule 3 - Blocking] Added types/electron.d.ts to worktree**
- Found during: Task 1
- Issue: `Window.electronAPI` type declaration was absent in the worktree, causing TS2551 errors
- Fix: Synced the file from `D:/My/BPG/design-inspirations-main/types/electron.d.ts` into the worktree
- Files modified: types/electron.d.ts (created)

## Known Stubs

None.

## Threat Flags

None — no new network endpoints or auth paths introduced.

## Self-Check: PASSED

- components/shared/SmartInsightsWidget.tsx modified: confirmed
- app/api/v1/search/route.ts modified: confirmed
- hooks/useOnlineStatus.ts created: confirmed
- types/electron.d.ts created: confirmed
- Commit d65ecd8 exists: confirmed
- Commit 23f8dd8 exists: confirmed
