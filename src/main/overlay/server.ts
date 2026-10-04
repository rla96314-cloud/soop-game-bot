import { createServer, IncomingMessage, ServerResponse } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { EventEmitter } from 'events'
import type { GameResult, GameState } from '../games/engine'

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
  fish:      FISH_OVERLAY_HTML,
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
      res.end(page(port))
    })

    const wss = new WebSocketServer({
      server,
      path: '/__overlay_ws__',
      // OBS 브라우저 소스는 Origin 이 http://localhost:PORT, 앱 내 미리보기도 동일.
      // 스트리머 PC 의 다른 웹페이지가 붙어 방송 상태를 읽어가는 것을 막는다.
      verifyClient: ({ origin }: { origin: string }) => {
        if (!origin) return true
        return origin === `http://localhost:${port}` || origin === `http://127.0.0.1:${port}`
      },
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
    try {
      server.listen(port, '127.0.0.1')
    } catch (err) {
      this.emit('error', `오버레이 서버를 열 수 없습니다: ${String(err)}`)
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

  getUrl(gameId: string) {
    return `http://localhost:${this.port}/overlay/${gameId}`
  }

  stop() {
    for (const c of this.clients) { try { c.terminate() } catch {} }
    this.clients.clear()
    try { this.wss?.close() } catch {}
    try { this.httpServer?.close() } catch {}
    this.wss = null
    this.httpServer = null
    this.listening = false
  }
}

export const overlayServer = new OverlayServer()
