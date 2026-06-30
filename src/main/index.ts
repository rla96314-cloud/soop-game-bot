import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { loadSettings }         from './store/settings'
import { gameEngine }           from './games/engine'
import { soopClient }           from './soop/client'
import { overlayServer }        from './overlay/server'
import { registerIpcHandlers }  from './ipc/handlers'
import { weflabWatcher }        from './weflab/watcher'

const isDev = !app.isPackaged

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440, height: 900,
    minWidth: 1100, minHeight: 700,
    show: false,
    frame: false,
    backgroundColor: '#F4F1FE',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
    },
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Window controls
  ipcMain.on('window:minimize', () => win.minimize())
  ipcMain.on('window:maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize())
  ipcMain.on('window:close',    () => win.close())
  ipcMain.handle('window:isMaximized', () => win.isMaximized())

  return win
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.soop.gamebot')

  // Load settings → init engine
  const settings = loadSettings()
  gameEngine.init(settings)

  // Start overlay server
  overlayServer.start(settings.overlay.port ?? 3939)

  // Create window
  const win = createWindow()

  // Register IPC
  registerIpcHandlers(win)

  // Auto-connect SOOP (실제 연결이 기본 — 시뮬레이션은 명시적으로 켠 경우에만)
  soopClient.connect({
    channelId:  settings.soop.channelId,
    userId:     settings.soop.userId,
    token:      settings.soop.token,
    simulation: settings.soop.simulationMode === true,
  })

  // Auto-start weflab watcher if previously enabled
  const wf = settings.weflab as Record<string, unknown> | undefined
  if (wf?.enabled && wf?.url) {
    weflabWatcher.start(wf.url as string)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  soopClient.disconnect()
  weflabWatcher.stop()
  overlayServer.stop()
  if (process.platform !== 'darwin') app.quit()
})
