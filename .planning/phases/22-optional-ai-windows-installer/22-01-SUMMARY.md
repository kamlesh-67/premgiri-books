---
phase: 22-optional-ai-windows-installer
plan: "01"
subsystem: electron
tags: [electron, safeStorage, ipc, ai-keys, encryption]
dependency_graph:
  requires: []
  provides: [safeStorage-ipc, ai-key-injection, isOnline-ipc]
  affects: [electron/main.ts, electron/preload.ts, types/electron.d.ts]
tech_stack:
  added: []
  patterns: [safeStorage encrypted key store, IPC bridge pattern, env injection before child process]
key_files:
  modified:
    - electron/main.ts
    - electron/preload.ts
    - types/electron.d.ts
decisions:
  - "safeStorage IPC handlers added inside registerIpcHandlers() following existing pattern"
  - "loadAiKeysIntoEnv() called before startNextServer() so Next.js child inherits decrypted keys"
  - "ai-keys.json stores DPAPI-encrypted base64 blobs — acceptable for v1.2 threat model"
metrics:
  duration: "8m"
  completed: "2026-06-01"
  tasks_completed: 2
  files_modified: 3
---

# Phase 22 Plan 01: safeStorage IPC Bridge Summary

Wired Electron `safeStorage` encrypted key storage into the main process and exposed the IPC bridge to the renderer. AI keys are decrypted into `process.env` before the Next.js child process starts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add safeStorage helpers and loadAiKeysIntoEnv() to electron/main.ts | 22c913e | electron/main.ts |
| 2 | Extend preload.ts and types/electron.d.ts with safeStorage and isOnline bridge | 0ca0562 | electron/preload.ts, types/electron.d.ts |

## What Was Built

**electron/main.ts:**
- Imports `safeStorage`, `net` from `'electron'`; `readFileSync`, `writeFileSync`, `existsSync` from `'fs'`
- `getAiKeysStorePath()` — returns `userData/ai-keys.json`
- `readAiKeyStore()` / `writeAiKeyStore()` — JSON file helpers with safe fallback
- `loadAiKeysIntoEnv()` — decrypts `VOYAGE_API_KEY` and `ANTHROPIC_API_KEY` into `process.env` on app start
- Four new IPC handlers: `safeStorage:set`, `safeStorage:get`, `safeStorage:delete`, `net:isOnline`
- Call order in `app.on('ready')`: `buildAppMenu() → registerIpcHandlers() → loadAiKeysIntoEnv() → startNextServer() → createWindow()`

**electron/preload.ts:**
- Added `safeStorageSet`, `safeStorageGet`, `safeStorageDelete`, `isOnline` to `contextBridge.exposeInMainWorld`
- Total entries: 11 (7 existing + 4 new)

**types/electron.d.ts:**
- Added four matching TypeScript type declarations to `Window.electronAPI` interface

## Verification

- `pnpm exec tsc -p tsconfig.electron.json --noEmit` — exits 0, no errors
- `pnpm exec tsc --noEmit` — pre-existing errors only (missing modules from prior phases); no errors introduced by this plan
- `safeStorage:set`, `safeStorage:get`, `safeStorage:delete`, `net:isOnline` handlers present in main.ts
- `loadAiKeysIntoEnv()` called before `startNextServer()` in app.on('ready')
- `safeStorageSet`, `isOnline` present in preload.ts and types/electron.d.ts

## Deviations from Plan

None — plan executed exactly as written.

## Threat Mitigations Applied

- **T-22-01**: Handler returns decrypted key only; never logged in plain text
- **T-22-03**: `safeStorage:set` validates key is non-empty string; throws `TypeError` otherwise; only `VOYAGE_API_KEY` and `ANTHROPIC_API_KEY` are injected into env by `loadAiKeysIntoEnv()`

## Known Stubs

None.

## Threat Flags

None — no new network endpoints or auth paths introduced; IPC channel is contextIsolation-protected.

## Self-Check: PASSED

- electron/main.ts modified: confirmed
- electron/preload.ts modified: confirmed  
- types/electron.d.ts modified: confirmed
- Commit 22c913e exists: confirmed
- Commit 0ca0562 exists: confirmed
