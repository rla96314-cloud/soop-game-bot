import { ipcMain, BrowserWindow, shell } from 'electron'
import { gameEngine, type GameId } from '../games/engine'
import { soopClient }              from '../soop/client'
import { overlayServer }           from '../overlay/server'
import { loadSettings, patchSettings, saveSettings } from '../store/settings'
import { verifyUser, fetchAllowlist }               from '../auth/allowlist'
import { openSoopLoginWindow }                      from '../auth/soopLogin'
import { fetchTodaySchedule }                       from '../schedule/fetcher'
import { weflabWatcher }                            from '../weflab/watcher'

export function registerIpcHandlers(win: BrowserWindow) {
  const send = (ch: string, ...args: unknown[]) => {
    if (!win.isDestroyed()) win.webContents.send(ch, ...args)
  }

  // ── SOOP connection ──────────────────────────────────────────────────────

  soopClient.on('connected',    ()           => send('soop:connected'))
  soopClient.on('disconnected', ()           => send('soop:disconnected'))
  soopClient.on('error',        (err)        => send('soop:error', err))
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
  ipcMain.handle('boss:start',   ()                   => { gameEngine.startBossRaid(); return { ok: true } })
  ipcMain.handle('boss:reset',   ()                   => { gameEngine.resetBoss(); return { ok: true } })

  // Overlay
  ipcMain.handle('overlay:url',  (_, gameId: string)  => overlayServer.getUrl(gameId))
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
  weflabWatcher.on('result', (text: string) => {
    send('weflab:result', text)
    const s = loadSettings()
    if (!s.weflab.enabled) return
    const matched = s.weflab.triggers.some(t =>
      t.keyword && text.toLowerCase().includes(t.keyword.toLowerCase())
    )
    if (matched) gameEngine.trigger('roulette', 'weflab', 0)
  })
  weflabWatcher.on('loaded', () => send('weflab:loaded'))
  weflabWatcher.on('error',  (e: string) => send('weflab:error', e))

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

  // Schedule
  ipcMain.handle('schedule:today', async (_, force: boolean) => {
    try {
      return { ok: true, data: await fetchTodaySchedule(force) }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })
}
