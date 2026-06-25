import { BrowserWindow } from 'electron'
import { EventEmitter }   from 'events'

const POLL_MS    = 400
const SETTLE_MS  = 1200
const RETRY_MS   = 5000   // 실패 시 재시도 간격

export class WeflabWatcher extends EventEmitter {
  private win:          BrowserWindow | null = null
  private pollTimer:    ReturnType<typeof setInterval> | null = null
  private settleTimer:  ReturnType<typeof setTimeout>  | null = null
  private retryTimer:   ReturnType<typeof setTimeout>  | null = null
  private lastResult    = ''
  private pendingText   = ''
  private _url          = ''
  private _active       = false  // stop()이 명시적으로 호출됐는지 여부

  get url()       { return this._url }
  get isRunning() { return this._active && this.win !== null && !this.win.isDestroyed() }

  start(url: string) {
    this.stop()
    this._url    = url
    this._active = true
    this.lastResult = ''
    this._launch()
  }

  stop() {
    this._active = false
    this._url    = ''
    this._clearTimers()
    if (this.win && !this.win.isDestroyed()) {
      this.win.destroy()
      this.win = null
    }
  }

  private _launch() {
    if (!this._active) return
    this._clearRetry()

    if (this.win && !this.win.isDestroyed()) {
      this.win.destroy()
      this.win = null
    }
    this.stopPoll()

    this.win = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration:  false,
        contextIsolation: true,
        javascript:       true,
      },
    })

    this.win.loadURL(this._url).catch(err => {
      this.emit('error', String(err))
      this._scheduleRetry()
    })

    this.win.webContents.on('did-finish-load', () => {
      this.emit('loaded')
      this.startPoll()
    })

    this.win.webContents.on('did-fail-load', (_e, code, desc) => {
      // -3 = aborted (탐색 중 새 요청으로 취소) → 무시
      if (code === -3) return
      this.emit('error', `페이지 로드 실패: ${desc} (${code}) — ${RETRY_MS/1000}초 후 재시도`)
      this._scheduleRetry()
    })

    // 렌더러 크래시 복구
    this.win.webContents.on('render-process-gone', (_e, details) => {
      if (!this._active) return
      this.emit('error', `렌더러 종료 (${details.reason}) — 재시도`)
      this._scheduleRetry()
    })

    // 창이 예기치않게 닫혔을 때 재연결
    this.win.on('closed', () => {
      this.stopPoll()
      this.win = null
      if (this._active) {
        this.emit('error', '창이 닫혔습니다 — 재연결 시도 중')
        this._scheduleRetry()
      }
    })
  }

  private _scheduleRetry() {
    if (!this._active) return
    this._clearRetry()
    this.retryTimer = setTimeout(() => {
      if (this._active) {
        this.emit('loaded')   // UI에 재연결 시도 알림 (loaded 이벤트 재사용)
        this._launch()
      }
    }, RETRY_MS)
  }

  private _clearRetry() {
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null }
  }

  private _clearTimers() {
    this.stopPoll()
    this._clearRetry()
    if (this.settleTimer) { clearTimeout(this.settleTimer); this.settleTimer = null }
  }

  private startPoll() {
    this.stopPoll()
    this.pollTimer = setInterval(() => this.poll(), POLL_MS)
  }

  private stopPoll() {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null }
  }

  private async poll() {
    if (!this.win || this.win.isDestroyed()) { this.stopPoll(); return }
    try {
      const text: string = await this.win.webContents.executeJavaScript(`
        (() => {
          const el = document.querySelector('p.text.roulette.result') ||
                     document.querySelector('.roulette.result') ||
                     document.querySelector('[class*="roulette"][class*="result"]');
          return el ? el.textContent.trim() : '';
        })()
      `)

      if (!text) {
        // 결과 요소가 사라지면 lastResult 초기화 → 같은 결과가 다음에 또 와도 감지
        if (this.lastResult) this.lastResult = ''
        if (this.pendingText) {
          this.pendingText = ''
          if (this.settleTimer) { clearTimeout(this.settleTimer); this.settleTimer = null }
        }
        return
      }

      if (text === this.lastResult) return

      if (text !== this.pendingText) {
        this.pendingText = text
        if (this.settleTimer) clearTimeout(this.settleTimer)
        this.settleTimer = setTimeout(() => {
          if (this.pendingText === text) {
            this.lastResult = text
            this.emit('result', text)
          }
        }, SETTLE_MS)
      }
    } catch {
      // webContents가 아직 준비 안 됐을 때 — 무시
    }
  }
}

export const weflabWatcher = new WeflabWatcher()
