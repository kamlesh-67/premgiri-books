import { app, BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import http from 'http'

const isProd = app.isPackaged
const PORT = 3000

// Set DATABASE_URL before any Prisma client is initialised
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
  if (!isProd) return // dev: nextron already starts Next.js

  const appRoot = path.dirname(app.getPath('exe'))
  const nextBin = path.join(appRoot, 'resources', 'app', 'node_modules', '.bin', 'next')
  const appDir = path.join(appRoot, 'resources', 'app')

  nextServer = spawn(nextBin, ['start', '--port', String(PORT)], {
    cwd: appDir,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(PORT),
    },
    stdio: 'pipe',
  })

  nextServer.stdout?.on('data', (d: Buffer) => process.stdout.write(d))
  nextServer.stderr?.on('data', (d: Buffer) => process.stderr.write(d))

  nextServer.on('error', (err) => {
    console.error('[next-server] failed to start:', err)
  })

  await waitForServer(`http://localhost:${PORT}`)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1280,
    minHeight: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  const port = isProd ? PORT : (process.argv[2] ?? PORT)
  mainWindow.loadURL(`http://localhost:${port}`)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', async () => {
  await startNextServer()
  createWindow()
})

app.on('window-all-closed', () => {
  nextServer?.kill()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
