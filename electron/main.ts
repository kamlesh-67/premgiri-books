import { app, BrowserWindow, ipcMain, dialog, shell, Menu, safeStorage, net } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { writeFile } from 'fs/promises'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import path, { resolve } from 'path'
import http from 'http'

const isProd = app.isPackaged
const PORT = 3000

if (isProd) {
  process.env.DATABASE_URL = 'file:' + path.join(app.getPath('userData'), 'data.db')
} else {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'file:./dev.db'
}

let mainWindow: BrowserWindow | null = null
let nextServer: ChildProcess | null = null

function waitForServer(url: string, timeout = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    function probe() {
      http.get(url, (res) => {
        res.resume()
        resolve()
      }).on('error', () => {
        if (Date.now() - start > timeout) {
          reject(new Error(`Server at ${url} did not start within ${timeout}ms`))
        } else {
          setTimeout(probe, 300)
        }
      })
    }
    probe()
  })
}

async function startNextServer(): Promise<void> {
  if (!isProd) return

  const appRoot = path.dirname(app.getPath('exe'))
  const nextBin = path.join(appRoot, 'resources', 'app', 'node_modules', '.bin', 'next')
  const appDir = path.join(appRoot, 'resources', 'app')

  nextServer = spawn(nextBin, ['start', '--port', String(PORT)], {
    cwd: appDir,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
    stdio: 'pipe',
  })

  nextServer.stdout?.on('data', (d: Buffer) => process.stdout.write(d))
  nextServer.stderr?.on('data', (d: Buffer) => process.stderr.write(d))
  nextServer.on('error', (err) => console.error('[next-server] failed to start:', err))

  await waitForServer(`http://localhost:${PORT}`)
}

function buildAppMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools', visible: !isProd },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: `Version ${app.getVersion()}`,
          enabled: false,
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/**
 * Validates that the given filePath is within an allowed directory.
 * Prevents renderer-side code from writing arbitrary files via IPC.
 */
function assertAllowedPath(filePath: string): void {
  const allowed = [
    app.getPath('userData'),
    app.getPath('downloads'),
  ]
  const abs = resolve(filePath)
  const isAllowed = allowed.some((base) => abs.startsWith(resolve(base) + path.sep) || abs === resolve(base))
  if (!isAllowed) {
    throw new Error(`Path not allowed: ${filePath}`)
  }
}

function getAiKeysStorePath(): string {
  return path.join(app.getPath('userData'), 'ai-keys.json')
}

function readAiKeyStore(): Record<string, string> {
  try {
    const filePath = getAiKeysStorePath()
    if (!existsSync(filePath)) return {}
    return JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, string>
  } catch {
    return {}
  }
}

function writeAiKeyStore(store: Record<string, string>): void {
  writeFileSync(getAiKeysStorePath(), JSON.stringify(store), 'utf8')
}

async function loadAiKeysIntoEnv(): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) return
  const store = readAiKeyStore()
  for (const key of ['VOYAGE_API_KEY', 'ANTHROPIC_API_KEY']) {
    const b64 = store[key]
    if (b64) {
      process.env[key] = safeStorage.decryptString(Buffer.from(b64, 'base64'))
    }
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('app:version', () => app.getVersion())

  ipcMain.handle('dialog:showSave', (_event, options: Electron.SaveDialogOptions) =>
    dialog.showSaveDialog(mainWindow!, options)
  )

  ipcMain.handle('dialog:showOpen', (_event, options: Electron.OpenDialogOptions) =>
    dialog.showOpenDialog(mainWindow!, options)
  )

  ipcMain.handle('shell:openPath', (_event, filePath: string) =>
    shell.openPath(filePath)
  )

  ipcMain.handle('fs:writeFile', async (_event, filePath: string, data: string | Uint8Array) => {
    assertAllowedPath(filePath)
    await writeFile(filePath, data)
  })

  ipcMain.handle('fs:mkdir', async (_event, dirPath: string) => {
    assertAllowedPath(dirPath)
    const { mkdir } = await import('fs/promises')
    await mkdir(dirPath, { recursive: true })
  })

  ipcMain.handle('app:getUserDataPath', () => app.getPath('userData'))

  ipcMain.handle('safeStorage:set', (_event, key: string, value: string) => {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('safeStorage not available')
    if (typeof key !== 'string' || key.length === 0) throw new TypeError('key must be a non-empty string')
    if (typeof value !== 'string') throw new TypeError('value must be a string')
    const encrypted = safeStorage.encryptString(value)
    const b64 = encrypted.toString('base64')
    const store = readAiKeyStore()
    store[key] = b64
    writeAiKeyStore(store)
  })

  ipcMain.handle('safeStorage:get', (_event, key: string): string => {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('safeStorage not available')
    const store = readAiKeyStore()
    if (!store[key]) return ''
    return safeStorage.decryptString(Buffer.from(store[key], 'base64'))
  })

  ipcMain.handle('safeStorage:delete', (_event, key: string) => {
    const store = readAiKeyStore()
    delete store[key]
    writeAiKeyStore(store)
  })

  ipcMain.handle('net:isOnline', () => net.isOnline())
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1280,
    minHeight: 800,
    title: 'PremGiri Books',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  const port = isProd ? PORT : (process.argv[2] ?? PORT)
  mainWindow.loadURL(`http://localhost:${port}`)

  mainWindow.on('closed', () => { mainWindow = null })
}

app.on('ready', async () => {
  buildAppMenu()
  registerIpcHandlers()
  await loadAiKeysIntoEnv()
  await startNextServer()
  createWindow()
})

app.on('window-all-closed', () => {
  nextServer?.kill()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})
