export {}

declare global {
  interface Window {
    electronAPI?: {
      getVersion: () => Promise<string>
      showSaveDialog: (options: {
        title?: string
        defaultPath?: string
        filters?: { name: string; extensions: string[] }[]
      }) => Promise<{ canceled: boolean; filePath?: string }>
      showOpenDialog: (options: {
        title?: string
        defaultPath?: string
        filters?: { name: string; extensions: string[] }[]
        properties?: ('openFile' | 'openDirectory' | 'multiSelections')[]
      }) => Promise<{ canceled: boolean; filePaths: string[] }>
      openPath: (filePath: string) => Promise<string>
      writeFile: (filePath: string, data: string | Uint8Array) => Promise<void>
      mkdir: (dirPath: string) => Promise<void>
      getUserDataPath: () => Promise<string>
      safeStorageSet: (key: string, value: string) => Promise<void>
      safeStorageGet: (key: string) => Promise<string>
      safeStorageDelete: (key: string) => Promise<void>
      isOnline: () => Promise<boolean>
    }
  }
}
