import { app, BrowserWindow, dialog } from 'electron'
import { join } from 'node:path'
import { ensureDataDirs, type DataPaths } from './env'
import { SqliteStore } from './db/store'
import { ClinicService } from './services/clinicService'
import { ensureDailyBackup, getLastBackupAt } from './services/backupService'
import { registerIpc } from './ipc'

const isDev = !app.isPackaged

if (isDev || process.env.YANXIA_NO_SANDBOX === '1') {
  app.commandLine.appendSwitch('no-sandbox')
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let store: SqliteStore | null = null
let paths: DataPaths

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    title: '燕霞诊所管理系统',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.whenReady().then(async () => {
  try {
    paths = ensureDataDirs()
    app.setPath('userData', paths.runtimeDir)
    const wasmDir = app.isPackaged
      ? process.resourcesPath
      : join(process.cwd(), 'node_modules', 'sql.js', 'dist')
    store = await SqliteStore.open({ dbPath: paths.dbPath, wasmDir })
    ensureDailyBackup(store, paths.backupsDir)
    const service = new ClinicService(store)
    service.syncAllNotifications()
    registerIpc({
      service,
      dataDir: paths.dataDir,
      getAppInfo: () => ({
        version: app.getVersion(),
        dataDir: paths.dataDir,
        lastBackupAt: getLastBackupAt(paths.backupsDir)
      })
    })
    createWindow()
  } catch (error) {
    dialog.showErrorBox('无法启动', (error as Error).message)
    app.quit()
    return
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  try {
    store?.close()
  } catch {
    // ignore close failure
  }
  store = null
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
