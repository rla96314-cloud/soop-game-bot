import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { loadSettings }         from './store/settings'
import { gameEngine }           from './games/engine'
import { overlayServer }        from './overlay/server'
import { registerIpcHandlers, startServices, stopServices } from './ipc/handlers'
import { isAuthed }             from './auth/gate'
import { applyAutoZoom }        from './zoom'
import { initAutoUpdate }       from './updater'

const isDev = !app.isPackaged

// 두 번째 인스턴스가 뜨면 오버레이 포트 충돌 + 후원 이중 처리 — 하나만 허용
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

function isSafeExternalUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'))
  } catch { return false }
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440, height: 900,
    minWidth: 1100, minHeight: 700,
    show: false,
    frame: false,
    backgroundColor: '#F4F1FE',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,            // preload 는 contextBridge/ipcRenderer 만 쓰므로 샌드박스 가능
      contextIsolation: true,
      nodeIntegration: false,
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
    stopServices()
    overlayServer.stop()
    app.quit()
  })

  // 외부 링크: https 와 로컬 오버레이만. file:// 등 다른 스킴은 열지 않는다
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  // 렌더러 자체가 다른 페이지로 이동하는 것도 차단 (dev 서버 / 번들 파일만)
  win.webContents.on('will-navigate', (e, url) => {
    const dev = process.env['ELECTRON_RENDERER_URL']
    if (dev && url.startsWith(dev)) return
    if (url.startsWith('file://')) return
    e.preventDefault()
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

  // Start overlay server (포트 충돌은 'error' 이벤트로 알림 — 앱이 죽지 않음)
  overlayServer.start(settings.overlay.port ?? 3939)

  // Create window
  const win = createWindow()

  // Register IPC
  registerIpcHandlers(win)

  // 최신 버전이 아니면 시작하자마자 업데이트
  initAutoUpdate(win)

  // SOOP 자동연결·위플랩 감시는 로그인(허용 목록 통과) 상태일 때만.
  // 미인증 상태의 재검증은 렌더러가 auth:recheck 로 요청하고, 통과하면 그때 시작된다.
  if (isAuthed()) startServices()

  app.on('second-instance', () => {
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopServices()
  overlayServer.stop()
  if (process.platform !== 'darwin') app.quit()
})
