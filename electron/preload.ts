import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // App metadata
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),

  // File system — for CSV import / PDF export
  showSaveDialog: (options: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue> =>
    ipcRenderer.invoke('dialog:showSave', options),

  showOpenDialog: (options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> =>
    ipcRenderer.invoke('dialog:showOpen', options),

  // Open file/URL in OS default app (e.g. open a saved PDF)
  openPath: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('shell:openPath', filePath),

  // Write a file to disk (used after PDF generation in renderer)
  writeFile: (filePath: string, data: string | Uint8Array): Promise<void> =>
    ipcRenderer.invoke('fs:writeFile', filePath, data),

  // Create a directory (used by folder picker to ensure output folder exists)
  mkdir: (dirPath: string): Promise<void> =>
    ipcRenderer.invoke('fs:mkdir', dirPath),

  // Get the Electron app userData path (used as default output folder fallback)
  getUserDataPath: (): Promise<string> =>
    ipcRenderer.invoke('app:getUserDataPath'),
})
