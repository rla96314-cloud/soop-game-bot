import { ipcMain, BrowserWindow, shell } from 'electron'
import { gameEngine, type GameId } from '../games/engine'
import { soopClient }              from '../soop/client'
import { overlayServer }           from '../overlay/server'
import { loadSettings, patchSettings } from '../store/settings'
import { verifyUser }              from '../auth/allowlist'
import { openSoopLoginWindow }     from '../auth/soopLogin'
import { weflabWatcher }           from '../weflab/watcher'

export function registerIpcHandlers(win: BrowserWindow) {
  const send = (ch: string, ...args: unknown[]) => {
    if (!win.isDestroyed()) win.webContents.send(ch, ...args)
  }

  // ── SOOP connection ──────────────────────────────────────────────────────

  soopClient.on('connected',    ()           => send('soop:connected'))
  soopClient.on('disconnected', ()           => send('soop:disconnected'))
  soopClient.on('error',        (err)        => send('soop:error', err))
  soopClient.on('standby',      (msg)        => send('soop:standby', msg))
  // 닉네임 입력을 채널 아이디로 해석했으면 설정에 반영해 다음 시작부터 바로 연결
  soopClient.on('resolved',     (id: string) => {
    patchSettings({ soop: { channelId: id } } as Parameters<typeof patchSettings>[0])
  })
  soopClient.on('balloon',      (user, amt)  => {
    send('soop:balloon', { user, amount: amt, ts: Date.now() })
    gameEngine.onBalloon(user, amt)
  })
  soopClient.on('chat', (user, msg) => {
    send('soop:chat', { user, message: msg, ts: Date.now() })
    gameEngine.onChat(user, msg)
  })

  // ── Game engine ──────────────────────────────────────────────────────────

  gameEngine.on('game:update', (id, state) => {
    send('game:update', id, state)
    overlayServer.sendState(state)
  })
  gameEngine.on('game:result', (id, result) => {
    send('game:result', id, result)
    overlayServer.sendResult(result)
  })
  gameEngine.on('quiz:question', (q) => send('quiz:question', q))
  gameEngine.on('stats', () => {
    send('stats:update', {
      todayRuns:     gameEngine.todayRuns,
      todayBalloons: gameEngine.todayBalloons,
      todayViewers:  gameEngine.todayViewers.size,
    })
  })

  // ── IPC handlers ─────────────────────────────────────────────────────────

  // Settings
  ipcMain.handle('settings:get', () => loadSettings())
  ipcMain.handle('settings:set', (_, patch) => {
    const next = patchSettings(patch)
    gameEngine.updateSettings(next)
    // UI 배율 즉시 반영
    if (!win.isDestroyed()) {
      win.webContents.setZoomFactor((next.ui?.scale ?? 100) / 100)
    }
    return next
  })

  // SOOP
  ipcMain.handle('soop:connect', (_, opts) => {
    const s = loadSettings()
    soopClient.connect({
      channelId:  opts?.channelId  ?? s.soop.channelId,
      userId:     opts?.userId     ?? s.soop.userId,
      token:      opts?.token      ?? s.soop.token,
      simulation: opts?.simulation ?? s.soop.simulationMode,
    })
    return { ok: true }
  })
  ipcMain.handle('soop:disconnect', () => { soopClient.disconnect(); return { ok: true } })
  ipcMain.handle('soop:status', () => ({
    connected:  soopClient.isConnected(),
    simulation: soopClient.isSimulation(),
  }))

  // Games
  ipcMain.handle('game:trigger', (_, gameId: GameId) => {
    gameEngine.trigger(gameId, '스트리머', 0)
    return { ok: true }
  })
  ipcMain.handle('game:state',   (_, gameId: GameId) => gameEngine.getState(gameId))
  ipcMain.handle('game:all',     ()                   => gameEngine.getAllStates())
  ipcMain.handle('game:history', (_, limit = 50)      => gameEngine.getHistory(limit))

  // Overlay
  ipcMain.handle('overlay:url',       (_, gameId: string)        => overlayServer.getUrl(gameId))
  ipcMain.handle('overlay:broadcast', (_, type: string, data: unknown) => { overlayServer.broadcast(type, data); return { ok: true } })
  ipcMain.handle('overlay:open', (_, gameId: string)  => {
    shell.openExternal(overlayServer.getUrl(gameId))
    return { ok: true }
  })

  // Stats snapshot
  ipcMain.handle('stats:get', () => ({
    todayRuns:     gameEngine.todayRuns,
    todayBalloons: gameEngine.todayBalloons,
    todayViewers:  gameEngine.todayViewers.size,
  }))

  // Auth (allowlist)
  ipcMain.handle('auth:verify', async (_, id: string) => {
    const result = await verifyUser(id)
    if (result.ok && result.user) {
      patchSettings({ user: result.user })
    }
    return result
  })
  ipcMain.handle('auth:getUser', () => loadSettings().user ?? null)
  ipcMain.handle('auth:logout', () => {
    patchSettings({ user: null })
    return { ok: true }
  })
  ipcMain.handle('auth:recheck', async () => {
    const s = loadSettings()
    if (!s.user?.id) return { ok: false, error: '저장된 사용자 없음' }
    return verifyUser(s.user.id)
  })
  // SOOP OAuth login window
  ipcMain.handle('auth:soopLogin', async () => {
    const identity = await openSoopLoginWindow(win)
    if (!identity) return { ok: false, error: '로그인 취소됨' }
    const result = await verifyUser(identity.id)
    if (result.ok && result.user) {
      patchSettings({ user: result.user })
      return { ok: true, user: result.user }
    }
    return { ok: false, error: `허용되지 않은 계정입니다 (${identity.id}). 방장에게 추가를 요청하세요.` }
  })

  // Quiz manual start
  ipcMain.handle('quiz:startManual', (_, opts: { question: string; answer: string; timeLimit: number }) => {
    const ok = gameEngine.startManualQuiz(opts.question, opts.answer, opts.timeLimit)
    return { ok }
  })

  // weflab
  weflabWatcher.on('result', (text: string, nick: string) => {
    send('weflab:result', text, nick)
    const s = loadSettings()
    if (!s.weflab.enabled) return
    const validTriggers = s.weflab.triggers.filter(t => t.keyword)
    // 트리거가 없으면 모든 결과에 반응, 있으면 키워드 포함 여부 검사
    const matched = validTriggers.length === 0
      || validTriggers.some(t => text.toLowerCase().includes(t.keyword.toLowerCase()))
    if (matched) gameEngine.trigger('roulette', nick || 'weflab', 0)
  })
  // 위플랩 후원(socket.io) → 대시보드 표시 + (옵션) 별풍선 게임 트리거
  weflabWatcher.on('donation', (d: { donor: string; balloons: number; amount: number; message: string; ts: number }) => {
    send('weflab:donation', d)
    const s = loadSettings()
    if (!s.weflab.enabled || !s.weflab.balloonTrigger) return
    if (d.balloons > 0) gameEngine.onBalloon(d.donor || 'weflab', d.balloons)
  })
  weflabWatcher.on('loaded',   ()          => send('weflab:loaded'))
  weflabWatcher.on('retrying', (m: string) => send('weflab:retrying', m))
  weflabWatcher.on('error',    (e: string) => send('weflab:error', e))

  ipcMain.handle('weflab:start', (_, url: string) => {
    weflabWatcher.start(url)
    return { ok: true }
  })
  ipcMain.handle('weflab:stop', () => {
    weflabWatcher.stop()
    return { ok: true }
  })
  ipcMain.handle('weflab:status', () => ({
    running: weflabWatcher.isRunning,
    url:     weflabWatcher.url,
  }))
}
