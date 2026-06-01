---
phase: 21-local-file-storage-cloud-removal
plan: "06"
subsystem: settings-ui
tags: [electron, file-storage, ui, settings]
dependency_graph:
  requires: ["21-04"]
  provides: ["file_output_folder UI", "folder picker IPC integration"]
  affects: ["app/(app)/settings/company/page.tsx"]
tech_stack:
  added: []
  patterns: ["Electron IPC showOpenDialog", "TanStack Query useQuery for app-settings", "admin-gated UI action"]
key_files:
  created: []
  modified:
    - app/(app)/settings/company/page.tsx
decisions:
  - "File Output Folder section appended after existing sections — no existing UI modified"
  - "Button disabled when !isAdmin matching server-side settings.admin enforcement (T-21-06-01 mitigation)"
  - "Default label shown inline in the path display box instead of a separate element"
metrics:
  duration: "5 minutes"
  completed: "2026-06-01"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase 21 Plan 06: File Output Folder UI Summary

Added the "File Output Folder" SectionCard to Settings → Company page, wiring the native Electron folder-picker dialog to `PUT /api/v1/app-settings` for persistence.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add File Output Folder section to Settings → Company page | c293833 | app/(app)/settings/company/page.tsx |

## What Was Built

- `FolderOpen` and `X` icon imports added
- `folderPath` and `isSavingFolder` state variables
- `useQuery` for `app-settings?key=file_output_folder` with `refetchSettings`
- `useEffect` syncing `folderPath` from query data on load
- `handlePickFolder` — opens native OS folder picker via `window.electronAPI.showOpenDialog({ properties: ['openDirectory'] })`, saves to DB via `PUT /api/v1/app-settings`
- `handleClearFolder` — resets `file_output_folder` to empty string via same API
- `SectionCard` with path display box, conditional Clear (X) button, Choose Folder button
- Choose Folder button disabled when `!isAdmin` (Owner-only, mirrors server-side guard)
- Default label `%APPDATA%\PremGiriBooks\files\ (default)` shown when no path is set

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The folder path display reads live from the database via TanStack Query.

## Threat Flags

None beyond what was already in the plan threat model. T-21-06-01 (Elevation of Privilege) is mitigated: button is disabled for non-admin users in the UI, and the PUT route enforces `settings.admin` on the server.

## Self-Check

- [x] `app/(app)/settings/company/page.tsx` — modified (confirmed in git diff)
- [x] Commit c293833 — confirmed via `git log`
- [x] `grep "file_output_folder"` returns 4 matches
- [x] `grep "handlePickFolder"` returns match
- [x] `grep "showOpenDialog"` returns match

## Self-Check: PASSED
