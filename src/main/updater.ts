import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'

// 자동 업데이트 — GitHub Releases(공개 저장소)의 latest.yml 을 본다.
// 시작할 때 최신이 아니면 바로 받아서 설치·재시작한다. 실행 중(방송 중)에 나온 새 버전은
// 받아만 두고 앱을 끌 때 설치한다 — 방송 도중 갑자기 재시작되지 않게.

export type UpdateStatus =
  | { state: 'checking' }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'installing'; version: string }
  | { state: 'none' }
  | { state: 'error'; message: string }

const RECHECK_MS = 30 * 60 * 1000

export function initAutoUpdate(win: BrowserWindow): void {
  let status: UpdateStatus = { state: 'none' }
  let startup = true   // 첫 확인에서 찾은 업데이트만 즉시 설치
  const send = (s: UpdateStatus) => {
    status = s
    if (!win.isDestroyed()) win.webContents.send('update:status', s)
  }
  ipcMain.handle('update:status', () => status)

  // 개발 실행·맥 빌드(서명 없음)에서는 끈다
  if (!app.isPackaged || process.platform !== 'win32') return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => { if (startup) send({ state: 'checking' }) })
  autoUpdater.on('update-not-available', () => { startup = false; send({ state: 'none' }) })
  autoUpdater.on('update-available', info => {
    if (startup) send({ state: 'downloading', version: info.version, percent: 0 })
  })
  autoUpdater.on('download-progress', p => {
    if (status.state === 'downloading') send({ ...status, percent: Math.round(p.percent) })
  })
  autoUpdater.on('update-downloaded', info => {
    if (!startup) return   // 실행 중에 받은 건 종료 시 설치
    send({ state: 'installing', version: info.version })
    // 안내 화면을 잠깐 보여준 뒤 조용히 설치하고 다시 실행
    setTimeout(() => autoUpdater.quitAndInstall(true, true), 1500)
  })
  autoUpdater.on('error', err => {
    startup = false
    send({ state: 'error', message: String(err?.message ?? err) })
  })

  const check = () => autoUpdater.checkForUpdates().catch(() => { /* 'error' 이벤트로 처리 */ })
  check()
  setInterval(check, RECHECK_MS)
}
