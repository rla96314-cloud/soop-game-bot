import { BrowserWindow } from 'electron'
import { EventEmitter }   from 'events'

const POLL_MS   = 400
const SETTLE_MS = 1200

export class WeflabWatcher extends EventEmitter {
  private win:        BrowserWindow | null = null
  private pollTimer:  ReturnType<typeof setInterval>  | null = null
  private settleTimer: ReturnType<typeof setTimeout> | null = null
  private lastResult  = ''
  private pendingText = ''
  private _url        = ''

  get url()       { return this._url }
  get isRunning() { return this.win !== null && !this.win.isDestroyed() }

  start(url: string) {
    this.stop()
    this._url       = url
    this.lastResult = ''

    this.win = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration:  false,
        contextIsolation: true,
        javascript:       true,
      },
    })

    this.win.loadURL(url).catch(err => this.emit('error', String(err)))

    this.win.webContents.on('did-finish-load', () => {
      this.emit('loaded')
      this.startPoll()
    })

    this.win.webContents.on('did-fail-load', (_e, code, desc) => {
      this.emit('error', `페이지 로드 실패: ${desc} (${code})`)
    })

    this.win.on('closed', () => {
      this.win = null
      this.stopPoll()
    })
  }

  stop() {
    this.stopPoll()
    if (this.settleTimer) { clearTimeout(this.settleTimer);  this.settleTimer = null }
    if (this.win && !this.win.isDestroyed()) {
      this.win.destroy()
      this.win = null
    }
    this._url = ''
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
          const el = document.querySelector('.roulette.result') ||
                     document.querySelector('[class*="roulette"][class*="result"]') ||
                     document.querySelector('.roulette-result');
          return el ? el.textContent.trim() : '';
        })()
      `)

      if (!text || text === this.lastResult) return

      // New result detected — wait for settle
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
      // webContents may not be ready yet — ignore
    }
  }
}

export const weflabWatcher = new WeflabWatcher()
