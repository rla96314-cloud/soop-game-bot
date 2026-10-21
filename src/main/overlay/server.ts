import { createServer, IncomingMessage, ServerResponse } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { app } from 'electron'
import type { GameResult, GameState } from '../games/engine'
import { loadSettings } from '../store/settings'

// ── Quiz overlay ──────────────────────────────────────────────────────────────
import { QUIZ_OVERLAY_HTML } from './pages/quiz'
import { LADDER_OVERLAY_HTML } from './pages/ladder'
import { ROULETTE_OVERLAY_HTML } from './pages/roulette'
import { PICKBOARD_OVERLAY_HTML } from './pages/pickboard'
import { NUMBER_OVERLAY_HTML } from './pages/number'
import { PREVIEW_OVERLAY_HTML } from './pages/preview'
import { MONITOR_OVERLAY_HTML } from './pages/monitor'
import { LOTTERY_OVERLAY_HTML } from './pages/lottery'
import { SLOT_OVERLAY_HTML } from './pages/slot'
import { OVERLAY_HTML } from './pages/generic'
import { FISH_OVERLAY_HTML } from './pages/fish'
import { FISH_VIDEO_OVERLAY_HTML } from './pages/fish-video'
import { listMedia, mediaDir, MEDIA_TYPES } from './media'
import { createReadStream, statSync } from 'fs'
import { join, extname, basename } from 'path'

// 낚시 영상 클립(cast + result*)이 폴더에 있으면 영상 모드 페이지를 서빙
function hasFishClips(): boolean {
  const f = listMedia('fish')
  const has = (n: string) => f.some(x => new RegExp(`^${n}\\.(mp4|webm|mov)$`, 'i').test(x))
  return has('cast') && ['result', 'result-common', 'result-uncommon', 'result-rare', 'result-legendary'].some(has)
}

export class OverlayServer {
  private httpServer: ReturnType<typeof createServer> | null = null
  private wss: WebSocketServer | null = null
  private clients: Set<WebSocket> = new Set()
  private port = 3939

  start(port = 3939) {
    this.port = port

    this.httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = (req.url ?? '/').split('?')[0]  // strip query string

      // ── 사용자 미디어 (예: 낚시 영상 클립) ─────────────────────────────────
      const mList = url.match(/^\/api\/media\/([a-z]+)$/)
      if (mList) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        res.end(JSON.stringify({ dir: mediaDir(mList[1]), files: listMedia(mList[1]) }))
        return
      }
      const mFile = url.match(/^\/media\/([a-z]+)\/([^/]+)$/)
      if (mFile) {
        const file = join(mediaDir(mFile[1]), basename(decodeURIComponent(mFile[2])))
        const type = MEDIA_TYPES[extname(file).slice(1).toLowerCase()]
        let st: ReturnType<typeof statSync> | null = null
        try { st = statSync(file) } catch { st = null }
        if (!type || !st || !st.isFile()) { res.writeHead(404); res.end(); return }
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
        if (range) {
          const start = range[1] ? Number(range[1]) : 0
          const end   = range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1
          res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 })
          createReadStream(file, { start, end }).pipe(res)
        } else {
          res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' })
          createReadStream(file).pipe(res)
        }
        return
      }

      // ── 오버레이 공통 설정 (효과음 on/off·볼륨) ──────────────────────────
      if (url === '/api/overlay-config') {
        const s = loadSettings()
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        res.end(JSON.stringify({ sound: s.overlay.sound ?? { enabled: true, volume: 0.7 } }))
        return
      }

      // ── Overlay pages ─────────────────────────────────────────────────────
      const gameId = url.replace('/overlay/', '').split('?')[0] || 'roulette'
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })

      let html: string
      if      (gameId === 'quiz')      html = QUIZ_OVERLAY_HTML(port)
      else if (gameId === 'ladder')    html = LADDER_OVERLAY_HTML(port)
      else if (gameId === 'roulette')  html = ROULETTE_OVERLAY_HTML(port)
      else if (gameId === 'slot')      html = SLOT_OVERLAY_HTML(port)
      else if (gameId === 'number')    html = NUMBER_OVERLAY_HTML(port)
      else if (gameId === 'lottery')   html = LOTTERY_OVERLAY_HTML(port)
      else if (gameId === 'fish')      html = hasFishClips() ? FISH_VIDEO_OVERLAY_HTML(port) : FISH_OVERLAY_HTML(port)
      else if (gameId === 'pickboard') html = PICKBOARD_OVERLAY_HTML(port)
      else if (gameId === 'monitor')   html = MONITOR_OVERLAY_HTML(port)
      else if (gameId === 'preview')   html = PREVIEW_OVERLAY_HTML(port)
      else html = OVERLAY_HTML(gameId, 'purple', port)

      res.end(html)
    })

    this.wss = new WebSocketServer({ server: this.httpServer, path: '/__overlay_ws__' })
    this.wss.on('connection', (ws) => {
      this.clients.add(ws)
      ws.on('close', () => this.clients.delete(ws))
      ws.on('error', () => this.clients.delete(ws))
    })

    this.httpServer.listen(port, '127.0.0.1')
  }

  broadcast(type: string, data: unknown) {
    const msg = JSON.stringify({ type, data })
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try { client.send(msg) } catch {}
      }
    }
  }

  sendResult(result: GameResult) {
    this.broadcast('game:result', result)
  }

  sendState(state: GameState) {
    this.broadcast('game:state', state)
  }

  getUrl(gameId: string) {
    return `http://localhost:${this.port}/overlay/${gameId}`
  }

  stop() {
    this.wss?.close()
    this.httpServer?.close()
  }
}

export const overlayServer = new OverlayServer()
