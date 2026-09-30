import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { loadSettings }         from './store/settings'
import { gameEngine }           from './games/engine'
import { soopClient }           from './soop/client'
import { overlayServer }        from './overlay/server'
import { registerIpcHandlers }  from './ipc/handlers'
import { weflabWatcher }        from './weflab/watcher'
import { applyAutoZoom }        from './zoom'

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

  // 창 크기에 맞춘 자동 배율 (페이지 로드·창 크기 변경마다 재적용)
  win.webContents.on('did-finish-load', () => applyAutoZoom(win))
  let resizeTimer: ReturnType<typeof setTimeout> | null = null
  win.on('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => applyAutoZoom(win), 40)
  })
  win.on('maximize',   () => applyAutoZoom(win))
  win.on('unmaximize', () => applyAutoZoom(win))

  // 메인 창을 닫으면 앱 완전 종료.
  // 위플랩 감시용 숨김 창이 남아 있으면 window-all-closed가 발생하지 않아
  // 프로세스가 백그라운드에 계속 살아있게 되는 문제 방지.
  win.on('closed', () => {
    soopClient.disconnect()
    weflabWatcher.stop()
    overlayServer.stop()
    app.quit()
  })

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

  // Auto-connect SOOP (항상 실연동. 채널 ID가 비어 있으면 로그인한 SOOP 아이디 사용)
  soopClient.connect({
    channelId:  settings.soop.channelId || settings.user?.id || '',
    userId:     settings.soop.userId,
    token:      settings.soop.token,
    simulation: false,
  })

  // 위플랩 URL이 저장돼 있으면 자동 감시 시작
  if (settings.weflab?.url) {
    weflabWatcher.start(settings.weflab.url)
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
