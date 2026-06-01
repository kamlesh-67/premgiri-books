/**
 * lib/localFiles.ts
 *
 * Local filesystem file write library — replaces R2 for desktop Electron app.
 *
 * getOutputFolder(): reads "file_output_folder" from app_settings DB.
 *   Falls back to %APPDATA%\PremGiriBooks\files (Windows) or
 *   ~/.PremGiriBooks/files (other platforms) when no setting exists.
 *
 * writeLocalFile(filename, buffer): writes buffer to output folder,
 *   creates folder if it doesn't exist, returns the absolute file path.
 *
 * NOTE: These functions run in the Next.js server process (API routes),
 * NOT in the Electron renderer — they use Node.js fs directly, NOT IPC.
 */

import path, { resolve, isAbsolute } from 'path'
import { mkdir, writeFile } from 'fs/promises'

/**
 * Returns the absolute path of the folder where files should be written.
 * Priority: app_settings DB row → OS default.
 */
export async function getOutputFolder(): Promise<string> {
  try {
    const { authDb } = await import('@/lib/authDb')
    const setting = await authDb.appSettings.findUnique({
      where: { key: 'file_output_folder' },
    })
    if (setting?.value) return setting.value
  } catch {
    // DB not ready yet or model missing — fall through to default
  }

  // Default: %APPDATA%\PremGiriBooks\files on Windows
  // ~/.PremGiriBooks/files on Linux/Mac (for dev)
  const base = process.env['APPDATA'] ?? path.join(process.env['HOME'] ?? '/tmp', '.PremGiriBooks')
  return path.join(base, 'PremGiriBooks', 'files')
}

/**
 * Writes buffer to a file in the output folder.
 * Creates the folder if it does not exist.
 *
 * @param filename - filename only (e.g. "INV-2024-0001.pdf"), not a full path
 * @param buffer   - file contents as a Node.js Buffer or Uint8Array
 * @returns        - absolute path where the file was written
 */
export async function writeLocalFile(filename: string, buffer: Buffer | Uint8Array): Promise<string> {
  const folder = await getOutputFolder()

  // Reject folder paths that are not absolute (relative paths could escape via ..)
  if (!isAbsolute(folder)) {
    throw new Error(`Output folder must be an absolute path, got: ${folder}`)
  }

  // Resolve and verify the final path stays inside the declared folder
  const resolvedFolder = resolve(folder)
  const resolvedPath = resolve(folder, filename)
  if (!resolvedPath.startsWith(resolvedFolder + path.sep)) {
    throw new Error(`Filename escapes output folder: ${filename}`)
  }

  await mkdir(resolvedFolder, { recursive: true })
  await writeFile(resolvedPath, buffer)
  return resolvedPath
}

/**
 * Builds a sanitized filename for a payslip PDF.
 * Replaces spaces and special chars to make it filesystem-safe.
 */
export function buildPayslipFilename(companyId: string, employeeId: string, month: string): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9-]/g, '_')
  return `payslip_${safe(companyId)}_${safe(employeeId)}_${safe(month)}.pdf`
}
