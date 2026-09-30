import { createServer, IncomingMessage, ServerResponse } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { app } from 'electron'
import type { GameResult, GameState } from '../games/engine'

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

export class OverlayServer {
  private httpServer: ReturnType<typeof createServer> | null = null
  private wss: WebSocketServer | null = null
  private clients: Set<WebSocket> = new Set()
  private port = 3939

  start(port = 3939) {
    this.port = port

    this.httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = (req.url ?? '/').split('?')[0]  // strip query string

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
