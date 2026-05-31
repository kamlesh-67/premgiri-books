import { app, BrowserWindow } from 'electron'
import path from 'path'

const isProd = app.isPackaged

if (isProd) {
  process.env.DATABASE_URL = 'file:' + path.join(app.getPath('userData'), 'data.db')
} else {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'file:./dev.db'
}

let mainWindow: BrowserWindow | null = null

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

  const port = process.argv[2] ?? '3000'
  mainWindow.loadURL(`http://localhost:${port}`)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', () => {
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
