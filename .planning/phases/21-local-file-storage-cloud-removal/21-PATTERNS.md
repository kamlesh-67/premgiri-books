# Phase 21 — Patterns Reference

Extracted from codebase for executor reuse. Do not re-read these source files — all
relevant patterns are captured here.

---

## 1. API Route Pattern (company route is the model)

```typescript
// app/api/v1/company/route.ts pattern
import { getSessionFromRequest } from '@/lib/session'
import { requirePermission } from '@/lib/utils/requirePermission'
import { prisma } from '@/lib/prisma'
import { NextResponse, NextRequest } from 'next/server'
import { z } from 'zod'

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const forbidden = requirePermission(session, 'settings', 'admin')
  if (forbidden) return forbidden

  const companyId = session.companyId
  const userId = session.userId

  // Zod parse, then $transaction([update, auditLog.create])
  const [result] = await prisma.$transaction([
    prisma.someModel.update({ where: { id: companyId }, data: updateData }),
    prisma.auditLog.create({
      data: { companyId, userId, entity: 'Model', entityId: id, action: 'UPDATE', oldValue, newValue: parsed.data },
    }),
  ])
  return NextResponse.json(result)
}
```

## 2. Prisma AppSettings Model (NEW — to be created in 21-01)

```prisma
model AppSettings {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt

  @@map("app_settings")
}
```

This is a single-row-per-key settings store. It is NOT tenant-scoped (no companyId) —
it stores machine-level settings like the output folder path. Use `authDb` (unextended
client) for reads/writes since `prisma` has tenant-scope enforcement that would reject
queries without companyId.

Key used for file output folder: `"file_output_folder"`

## 3. Electron IPC Already Wired

`electron/main.ts` already registers these handlers — NO changes needed for basic file ops:
- `dialog:showOpen` → `dialog.showOpenDialog`
- `dialog:showSave` → `dialog.showSaveDialog`
- `shell:openPath` → `shell.openPath`
- `fs:writeFile` → `fs/promises writeFile`

`electron/preload.ts` already exposes `window.electronAPI.showOpenDialog`,
`window.electronAPI.writeFile`, `window.electronAPI.openPath`.

Need to ADD to `electron/main.ts`:
```typescript
// Add to registerIpcHandlers():
ipcMain.handle('fs:mkdir', async (_event, dirPath: string) => {
  const { mkdir } = await import('fs/promises')
  await mkdir(dirPath, { recursive: true })
})

ipcMain.handle('app:getUserDataPath', () => app.getPath('userData'))
```

Add to `electron/preload.ts`:
```typescript
mkdir: (dirPath: string): Promise<void> => ipcRenderer.invoke('fs:mkdir', dirPath),
getUserDataPath: (): Promise<string> => ipcRenderer.invoke('app:getUserDataPath'),
```

## 4. types/electron.d.ts — ElectronAPI Interface

File exists at `types/electron.d.ts`. Add `mkdir` and `getUserDataPath` to the
`ElectronAPI` interface when extending IPC.

## 5. Payroll Run — Sync Replacement Pattern

`lib/inngest.ts` `payrollRunFn` contains the full payroll logic inline in steps.
The replacement `lib/services/PayrollRunner.ts` extracts the same logic as a plain
`async function runPayroll(payRunId, companyId, month, triggeredBy)` — no step/sleep wrappers.

The call site is `app/api/v1/payroll/pay-run/[id]/run/route.ts` (or similar).
Replace `await inngest.send({ name: 'premgiri/payroll.run', data: {...} })` with
`await runPayroll(payRunId, companyId, month, session.userId)` directly.

## 6. R2 → Local FS Replacement Pattern

`lib/r2.ts` exports `uploadFile(key, buffer, contentType)` and `buildR2Key(...)`.
Replace with `lib/localFiles.ts` which exports:
```typescript
export async function writeLocalFile(filename: string, buffer: Buffer): Promise<string>
// Returns the absolute path where the file was written.
// Reads output folder from AppSettings key "file_output_folder".
// Falls back to path.join(app.getPath('userData'), 'files') via IPC.
```

Because Next.js API routes run in the renderer-side Node.js process (nextron), they
cannot directly call Electron's `app.getPath`. Use the `app:getUserDataPath` IPC
handler defined in pattern 3 above — BUT since API routes run server-side (not in
the browser renderer), they cannot use `window.electronAPI`. Instead, read the path
from the `app_settings` DB table and fall back to `process.env.APPDATA` + `\PremGiriBooks\files`.

```typescript
// lib/localFiles.ts
import path from 'path'
import { mkdir, writeFile } from 'fs/promises'

export async function getOutputFolder(): Promise<string> {
  // Try app_settings DB first
  const { authDb } = await import('@/lib/authDb')
  const setting = await authDb.appSettings.findUnique({ where: { key: 'file_output_folder' } })
  if (setting?.value) return setting.value
  // Fallback: %APPDATA%\PremGiriBooks\files on Windows, ~/.PremGiriBooks/files on other
  const base = process.env.APPDATA ?? path.join(process.env.HOME ?? '/tmp', '.PremGiriBooks')
  return path.join(base, 'PremGiriBooks', 'files')
}

export async function writeLocalFile(filename: string, buffer: Buffer): Promise<string> {
  const folder = await getOutputFolder()
  await mkdir(folder, { recursive: true })
  const filePath = path.join(folder, filename)
  await writeFile(filePath, buffer)
  return filePath
}
```

## 7. PostHog Removal Pattern

`app/layout.tsx` wraps children in `<PostHogProvider>`. Remove the wrapper and delete:
- `components/providers/PostHogProvider.tsx`
- `lib/analytics.ts`

Any callers of `trackEvent(...)` from `lib/analytics.ts` should have the import line
deleted — the calls can be silently removed (analytics is out of scope for desktop).

## 8. Embeddings Trigger — No-Op Replacement

`app/api/v1/embeddings/trigger/route.ts` calls `inngest.send(...)`.
After removing Inngest, replace with a no-op 202 response with message:
```json
{ "status": "skipped", "reason": "AI embeddings require internet — configure in Settings → AI" }
```
This satisfies auth/permission guards without breaking the route.

## 9. Settings Company Page — Folder Picker Pattern

The existing `app/(app)/settings/company/page.tsx` uses `useQuery(['company'])` and
`fetch('/api/v1/company')`. Extend it with a new `SectionCard` for "File Output Folder":

```tsx
// In the page component, add state:
const [folderPath, setFolderPath] = useState('')

// Load on mount via new API:
const { data: settingsData } = useQuery({
  queryKey: ['app-settings'],
  queryFn: () => fetch('/api/v1/app-settings').then(r => r.json()),
})

// Folder picker button:
async function handlePickFolder() {
  const result = await window.electronAPI.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select output folder for PDFs and exports',
  })
  if (!result.canceled && result.filePaths[0]) {
    setFolderPath(result.filePaths[0])
    await fetch('/api/v1/app-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'file_output_folder', value: result.filePaths[0] }),
    })
    toast.success('Output folder saved')
  }
}
```

## 10. Packages to Remove from package.json

```
inngest
@upstash/redis
ioredis
@aws-sdk/client-s3
@aws-sdk/s3-request-presigner
resend
posthog-js
posthog-node   (if present)
```

Also remove from devDependencies if present:
```
@types/ioredis
```
