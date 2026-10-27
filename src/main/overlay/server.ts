import { createServer, IncomingMessage, ServerResponse } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { EventEmitter } from 'events'
import { createReadStream, statSync } from 'fs'
import { join, extname, basename } from 'path'
import type { GameResult, GameState } from '../games/engine'
import { loadSettings } from '../store/settings'
import { listMedia, mediaDir, MEDIA_TYPES } from './media'
import { OVERLAY_ASSETS } from './assets'
import { startDemo, DEMO_GAMES } from './demo'
import { GALLERY_HTML } from './pages/gallery'

import { QUIZ_OVERLAY_HTML } from './pages/quiz'
import { LADDER_OVERLAY_HTML } from './pages/ladder'
import { ROULETTE_OVERLAY_HTML } from './pages/roulette'
import { PICKBOARD_OVERLAY_HTML } from './pages/pickboard'
import { NUMBER_OVERLAY_HTML } from './pages/number'
import { PREVIEW_OVERLAY_HTML } from './pages/preview'
import { MONITOR_OVERLAY_HTML } from './pages/monitor'
import { LOTTERY_OVERLAY_HTML } from './pages/lottery'
import { SLOT_OVERLAY_HTML } from './pages/slot'
import { RACE_OVERLAY_HTML } from './pages/race'
import { RPS_OVERLAY_HTML } from './pages/rps'
import { FISH_OVERLAY_HTML } from './pages/fish'
import { FISH_VIDEO_OVERLAY_HTML } from './pages/fish-video'

// 사용자 미디어를 둘 수 있는 게임 (폴더 이름 = gameId, 이 목록 밖은 404)
const MEDIA_GAMES = new Set(['fish'])

/** 낚시 영상 클립(cast + result*)이 폴더에 있으면 영상 모드 페이지를 서빙 */
function hasFishClips(): boolean {
  const f = listMedia('fish')
  const has = (n: string) => f.some(x => new RegExp(`^${n}\\.(mp4|webm|mov)$`, 'i').test(x))
  return has('cast') && ['result', 'result-common', 'result-uncommon', 'result-rare', 'result-legendary'].some(has)
}

// URL 경로의 gameId 는 허용 목록으로만 — HTML/스크립트 안에 그대로 들어가므로 반사형 XSS 차단
const PAGES: Record<string, (port: number) => string> = {
  quiz:      QUIZ_OVERLAY_HTML,
  ladder:    LADDER_OVERLAY_HTML,
  roulette:  ROULETTE_OVERLAY_HTML,
  slot:      SLOT_OVERLAY_HTML,
  number:    NUMBER_OVERLAY_HTML,
  lottery:   LOTTERY_OVERLAY_HTML,
  pickboard: PICKBOARD_OVERLAY_HTML,
  monitor:   MONITOR_OVERLAY_HTML,
  preview:   PREVIEW_OVERLAY_HTML,
  race:      RACE_OVERLAY_HTML,
  rps:       RPS_OVERLAY_HTML,
  fish:      (port) => hasFishClips() ? FISH_VIDEO_OVERLAY_HTML(port) : FISH_OVERLAY_HTML(port),
}
export const OVERLAY_IDS = Object.keys(PAGES)

/** 새 WS 클라이언트에게 현재 상태를 보내기 위한 공급자 — 엔진을 직접 참조하지 않는다 */
export type SnapshotProvider = () => Array<{ type: string; data: unknown }>

/**
 * 이벤트:
 *  'listening' (port)
 *  'error' (message)   — 포트 충돌 등. 앱은 죽지 않고 렌더러에 알림
 */
export class OverlayServer extends EventEmitter {
  private httpServer: ReturnType<typeof createServer> | null = null
  private wss: WebSocketServer | null = null
  private demoWss: WebSocketServer | null = null
  private clients: Set<WebSocket> = new Set()
  private port = 3939
  private snapshot: SnapshotProvider = () => []
  listening = false

  setSnapshotProvider(p: SnapshotProvider) { this.snapshot = p }

  start(port = 3939) {
    this.stop()
    this.port = port

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const path = (req.url ?? '/').split('?')[0]
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return }

      // ── 오버레이 공통 설정 (효과음 on/off·볼륨) ──
      if (path === '/api/overlay-config') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
        res.end(JSON.stringify({ sound: loadSettings().overlay.sound }))
        return
      }

      // ── 내장 이미지 (슬롯 캐릭터·가위바위보 손) ──
      const aFile = /^\/assets\/([a-z-]+)\.(png|webp)$/.exec(path)
      if (aFile) {
        const b64 = OVERLAY_ASSETS[aFile[1]]
        if (!b64) { res.writeHead(404); res.end(); return }
        const buf = Buffer.from(b64, 'base64')
        const isWebp = buf.length > 12 && buf.toString('ascii', 8, 12) === 'WEBP'
        if (isWebp !== (aFile[2] === 'webp')) { res.writeHead(404); res.end(); return }
        res.writeHead(200, { 'Content-Type': isWebp ? 'image/webp' : 'image/png', 'Content-Length': buf.length, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' })
        res.end(req.method === 'HEAD' ? undefined : buf)
        return
      }

      // ── 사용자 미디어 (읽기 전용, 허용된 게임 폴더의 파일 이름만) ──
      const mList = /^\/api\/media\/([a-z]+)$/.exec(path)
      if (mList) {
        if (!MEDIA_GAMES.has(mList[1])) { res.writeHead(404); res.end(); return }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
        res.end(JSON.stringify({ files: listMedia(mList[1]) }))
        return
      }
      const mFile = /^\/media\/([a-z]+)\/([^/]+)$/.exec(path)
      if (mFile) { this.serveMedia(req, res, mFile[1], mFile[2]); return }

      // ── 애니메이션 미리보기 (데모 엔진, 방송과 분리) ──
      if (path === '/gallery' || path === '/gallery/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
        res.end(GALLERY_HTML())
        return
      }

      const m = /^\/overlay\/([a-z]+)\/?$/.exec(path)
      const gameId = m ? m[1] : (path === '/' ? 'roulette' : '')
      const page = PAGES[gameId]
      if (!page) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('Not found')
        return
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      const query = new URLSearchParams((req.url ?? '').split('?')[1] ?? '')
      const demo = query.get('demo') === '1' && (DEMO_GAMES as readonly string[]).includes(gameId)
      // 데모 모드는 같은 페이지를 데모 전용 WS 로 붙인다 (gameId 는 위 허용 목록에서 온 값)
      res.end(demo ? page(port).split('/__overlay_ws__').join(`/__demo_ws__?game=${gameId}`) : page(port))
    })

    // 경로가 둘(방송용·데모용)이라 업그레이드를 직접 나눈다 — server+path 방식은 다른 경로를 400 으로 끊는다
    const verifyClient = ({ origin }: { origin: string }) =>
      !origin || origin === `http://localhost:${port}` || origin === `http://127.0.0.1:${port}`
    const demoWss = new WebSocketServer({ noServer: true, verifyClient })
    demoWss.on('connection', (ws, req: IncomingMessage) => {
      const game = new URLSearchParams((req.url ?? '').split('?')[1] ?? '').get('game') ?? ''
      const send = (type: string, data: unknown) => {
        if (ws.readyState === WebSocket.OPEN) { try { ws.send(JSON.stringify({ type, data })) } catch {} }
      }
      const stopDemo = startDemo(game, send, OverlayServer.publicState)
      ws.on('close', stopDemo)
      ws.on('error', stopDemo)
    })
    server.on('upgrade', (req, socket, head) => {
      const p = (req.url ?? '').split('?')[0]
      if (p === '/__overlay_ws__') wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req))
      else if (p === '/__demo_ws__') demoWss.handleUpgrade(req, socket, head, ws => demoWss.emit('connection', ws, req))
      else socket.destroy()
    })

    const wss = new WebSocketServer({
      noServer: true,
      // OBS 브라우저 소스는 Origin 이 http://localhost:PORT, 앱 내 미리보기도 동일.
      // 스트리머 PC 의 다른 웹페이지가 붙어 방송 상태를 읽어가는 것을 막는다.
      verifyClient,
    })
    wss.on('connection', (ws) => {
      this.clients.add(ws)
      ws.on('close', () => this.clients.delete(ws))
      ws.on('error', () => this.clients.delete(ws))
      // 접속 직후 현재 상태 — OBS "장면 활성화 시 새로고침" 뒤에도 빈 화면이 아니게
      for (const { type, data } of this.snapshot()) {
        try { ws.send(JSON.stringify({ type, data })) } catch {}
      }
    })
    wss.on('error', (err) => this.emit('error', `오버레이 WS 오류: ${err.message}`))

    server.on('error', (err: NodeJS.ErrnoException) => {
      this.listening = false
      const msg = err.code === 'EADDRINUSE'
        ? `오버레이 포트 ${port} 가 이미 사용 중입니다. 다른 프로그램(또는 이 앱의 다른 창)을 닫거나 설정에서 포트를 바꾸세요.`
        : `오버레이 서버 오류: ${err.message}`
      this.emit('error', msg)
    })
    server.on('listening', () => { this.listening = true; this.emit('listening', port) })

    this.httpServer = server
    this.wss = wss
    this.demoWss = demoWss
    try {
      server.listen(port, '127.0.0.1')
    } catch (err) {
      this.emit('error', `오버레이 서버를 열 수 없습니다: ${String(err)}`)
    }
  }

  private serveMedia(req: IncomingMessage, res: ServerResponse, game: string, rawName: string) {
    const notFound = () => { res.writeHead(404); res.end() }
    if (!MEDIA_GAMES.has(game)) return notFound()
    let name: string
    try { name = basename(decodeURIComponent(rawName)) } catch { return notFound() }
    if (!name || name.startsWith('.')) return notFound()
    const file = join(mediaDir(game), name)
    const type = MEDIA_TYPES[extname(file).slice(1).toLowerCase()]
    let st: ReturnType<typeof statSync> | null = null
    try { st = statSync(file) } catch { st = null }
    if (!type || !st || !st.isFile()) return notFound()
    const base = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : st.size - Number(range[2])   // "bytes=-N" = 끝에서 N 바이트
      let end   = range[1] && range[2] ? Number(range[2]) : st.size - 1
      start = Math.max(0, start); end = Math.min(end, st.size - 1)
      if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); res.end(); return }
      res.writeHead(206, { ...base, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 })
      if (req.method === 'HEAD') { res.end(); return }
      createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res)
    } else {
      res.writeHead(200, { ...base, 'Content-Length': st.size })
      if (req.method === 'HEAD') { res.end(); return }
      createReadStream(file).on('error', () => res.destroy()).pipe(res)
    }
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
    this.broadcast('game:state', OverlayServer.publicState(state))
  }

  /** 오버레이로 나가는 상태에서 퀴즈 정답 제거 */
  static publicState(state: GameState): GameState {
    if (!state.quiz) return state
    const { answer: _a, ...quiz } = state.quiz
    void _a
    return { ...state, quiz: { ...quiz, answer: '' } }
  }

  getGalleryUrl() {
    return `http://localhost:${this.port}/gallery`
  }

  getUrl(gameId: string) {
    return `http://localhost:${this.port}/overlay/${gameId}`
  }

  stop() {
    for (const c of this.clients) { try { c.terminate() } catch {} }
    this.clients.clear()
    try { this.wss?.close() } catch {}
    for (const c of this.demoWss?.clients ?? []) { try { c.terminate() } catch {} }
    try { this.demoWss?.close() } catch {}
    this.demoWss = null
    try { this.httpServer?.close() } catch {}
    this.wss = null
    this.httpServer = null
    this.listening = false
  }
}

export const overlayServer = new OverlayServer()
