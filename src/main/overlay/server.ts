import { createServer, IncomingMessage, ServerResponse } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import type { GameResult, GameState } from '../games/engine'

const OVERLAY_HTML = (gameId: string, theme: string) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: transparent;
    font-family: 'Noto Sans KR', sans-serif;
    overflow: hidden;
  }
  #overlay {
    position: fixed; bottom: 40px; right: 40px;
    min-width: 280px; max-width: 380px;
    background: rgba(20, 10, 40, 0.88);
    border: 1.5px solid rgba(139, 92, 246, 0.5);
    border-radius: 16px;
    padding: 18px 22px;
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 32px rgba(109,40,217,0.35), inset 0 1px 0 rgba(255,255,255,0.07);
    transform: translateY(120px);
    opacity: 0;
    transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease;
  }
  #overlay.show {
    transform: translateY(0);
    opacity: 1;
  }
  .game-label {
    font-size: 11px; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; color: rgba(139,92,246,0.9);
    margin-bottom: 6px;
  }
  .result-text {
    font-size: 22px; font-weight: 800; color: #fff;
    letter-spacing: -0.02em; line-height: 1.2;
    margin-bottom: 4px;
  }
  .detail-text {
    font-size: 13px; color: rgba(255,255,255,0.6);
  }
  .trigger-row {
    display: flex; align-items: center; gap: 7px;
    margin-top: 10px; padding-top: 10px;
    border-top: 1px solid rgba(255,255,255,0.08);
  }
  .trigger-user { font-size: 12px; color: rgba(255,255,255,0.5); }
  .trigger-balloon { font-size: 12px; color: #F59E0B; font-weight: 700; }

  @keyframes confetti-fall {
    to { transform: translateY(100vh) rotate(720deg); opacity: 0; }
  }
  .confetti-piece {
    position: fixed; top: -20px;
    width: 8px; height: 12px; border-radius: 2px;
    animation: confetti-fall 2.5s ease-in forwards;
  }
</style>
</head>
<body>
<div id="overlay">
  <div class="game-label" id="game-label">SOOP GAME BOT</div>
  <div class="result-text" id="result-text">대기 중...</div>
  <div class="detail-text" id="detail-text"></div>
  <div class="trigger-row">
    <span class="trigger-user" id="trigger-user"></span>
    <span class="trigger-balloon" id="trigger-balloon"></span>
  </div>
</div>
<script>
  const GAME_NAMES = {
    roulette:'룰렛', ladder:'사다리타기', boss:'보스전', gacha:'뽑기',
    quiz:'퀴즈', slot:'슬롯머신', race:'경주', rps:'가위바위보',
    fish:'낚시', lottery:'복권'
  }

  const overlay  = document.getElementById('overlay')
  const label    = document.getElementById('game-label')
  const resultEl = document.getElementById('result-text')
  const detailEl = document.getElementById('detail-text')
  const userEl   = document.getElementById('trigger-user')
  const balloonEl= document.getElementById('trigger-balloon')

  let hideTimer = null

  function showResult(data) {
    label.textContent     = GAME_NAMES[data.gameId] ?? data.gameId
    resultEl.textContent  = data.result
    detailEl.textContent  = data.detail
    userEl.textContent    = data.triggeredBy ? '@' + data.triggeredBy : ''
    balloonEl.textContent = data.balloon ? '🎈 ' + data.balloon.toLocaleString() + '개' : ''

    overlay.classList.add('show')
    if (data.result.includes('클리어') || data.result.includes('JACKPOT') || data.result.includes('레전드')) {
      launchConfetti()
    }

    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => overlay.classList.remove('show'), 6000)
  }

  function launchConfetti() {
    const colors = ['#8B5CF6','#EC4899','#F59E0B','#10B981','#3B82F6','#EF4444']
    for (let i = 0; i < 40; i++) {
      const el = document.createElement('div')
      el.className = 'confetti-piece'
      el.style.left     = Math.random() * 100 + 'vw'
      el.style.background = colors[Math.floor(Math.random() * colors.length)]
      el.style.animationDelay    = Math.random() * 0.8 + 's'
      el.style.animationDuration = (2 + Math.random()) + 's'
      document.body.appendChild(el)
      el.addEventListener('animationend', () => el.remove())
    }
  }

  // WebSocket
  function connect() {
    const ws = new WebSocket('ws://localhost:${3939}/__overlay_ws__')
    ws.onmessage = e => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'game:result') showResult(msg.data)
        if (msg.type === 'ping') ws.send(JSON.stringify({type:'pong'}))
      } catch {}
    }
    ws.onclose = () => setTimeout(connect, 2000)
  }
  connect()
<\/script>
</body>
</html>`

export class OverlayServer {
  private httpServer: ReturnType<typeof createServer> | null = null
  private wss: WebSocketServer | null = null
  private clients: Set<WebSocket> = new Set()
  private port = 3939

  start(port = 3939) {
    this.port = port

    this.httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = req.url ?? '/'
      const gameId = url.replace('/overlay/', '').split('?')[0] || 'roulette'

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(OVERLAY_HTML(gameId, 'purple'))
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
