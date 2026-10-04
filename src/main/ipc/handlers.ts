import { ipcMain, BrowserWindow, shell, app } from 'electron'
import { join } from 'path'
import { gameEngine, GAME_IDS, type GameId } from '../games/engine'
import { pickboardStore }          from '../games/pickboard'
import { FishLog }                 from '../games/fishlog'
import { soopClient }              from '../soop/client'
import { overlayServer, OverlayServer } from '../overlay/server'
import { loadSettings, patchSettings, takeLoadError, type SettingsPatch } from '../store/settings'
import { verifyUser }              from '../auth/allowlist'
import { openSoopLoginWindow, clearSoopCookies } from '../auth/soopLogin'
import { isAuthed, setAuthedUser, recheckSaved, currentUser } from '../auth/gate'
import { weflabWatcher }           from '../weflab/watcher'
import { donationGate }            from '../donation/gate'
import { applyAutoZoom }           from '../zoom'

const UNAUTHED = { ok: false, error: '로그인이 필요합니다.' } as const

/** 로그인 뒤에만 돌아야 하는 외부 연결 (SOOP 채팅, 위플랩 감시) */
export function startServices() {
  const s = loadSettings()
  donationGate.setSource(s.soop.donationSource)
  soopClient.connect({
    channelId:  s.soop.channelId || s.user?.id || '',
    userId:     s.soop.userId,
    token:      s.soop.token,
    simulation: false,
  })
  if (s.weflab?.url) {
    const err = weflabWatcher.start(s.weflab.url)
    if (err) weflabWatcher.emit('error', err)
  }
}

export function stopServices() {
  soopClient.disconnect()
  weflabWatcher.stop()
}

export function registerIpcHandlers(win: BrowserWindow) {
  const send = (ch: string, ...args: unknown[]) => {
    if (!win.isDestroyed()) win.webContents.send(ch, ...args)
  }
  /** 인증 필요한 핸들러 래퍼 */
  const authed = <A extends unknown[], R>(fn: (...a: A) => R) =>
    (_e: Electron.IpcMainInvokeEvent, ...a: A): R | typeof UNAUTHED => isAuthed() ? fn(...a) : UNAUTHED

  const sendStats = () => send('stats:update', {
    todayRuns:     gameEngine.todayRuns,
    todayBalloons: gameEngine.todayBalloons,
    todayViewers:  gameEngine.todayViewers.size,
  })

  // 설정 파일이 깨져 기본값으로 시작했으면 알림
  win.webContents.once('did-finish-load', () => {
    const e = takeLoadError()
    if (e) send('app:notice', { level: 'error', message: e })
  })

  // ── SOOP connection ──────────────────────────────────────────────────────

  soopClient.on('connected',    ()           => send('soop:connected'))
  soopClient.on('disconnected', ()           => send('soop:disconnected'))
  soopClient.on('error',        (err)        => send('soop:error', err))
  soopClient.on('standby',      (msg)        => send('soop:standby', msg))
  soopClient.on('viewers',      (n: number)  => send('soop:viewers', n))
  // 닉네임 입력을 채널 아이디로 해석했으면(정확히 일치할 때만) 설정에 반영해 다음 시작부터 바로 연결
  soopClient.on('resolved',     (id: string) => {
    patchSettings({ soop: { channelId: id } })
    send('settings:changed', loadSettings())
  })
  soopClient.on('balloon',      (user, amt)  => {
    send('soop:balloon', { user, amount: amt, ts: Date.now() })
    donationGate.push('soop', user, amt)
  })
  soopClient.on('chat', (user, msg) => {
    send('soop:chat', { user, message: msg, ts: Date.now() })
    gameEngine.onChat(user, msg)
  })

  // 두 경로(SOOP·위플랩)를 거친 후원 중 중복이 아닌 것만 집계·트리거
  donationGate.on('balloon', (user: string, amount: number) => {
    gameEngine.recordBalloon(user, amount)
    gameEngine.onBalloon(user, amount)
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
  gameEngine.on('stats', sendStats)
  gameEngine.on('log', (m: string) => send('app:notice', { level: 'warn', message: m }))

  // ── Fish log (낚시 누적 기록) ─────────────────────────────────────────────

  const fishLog = new FishLog(() => join(app.getPath('userData'), 'data'))
  gameEngine.setFishRecorder((user, fish) => fishLog.record(user, fish))
  ipcMain.handle('fish:ranking', (_, limit = 10) => fishLog.ranking(Math.min(100, Math.max(1, Number(limit) || 10))))
  ipcMain.handle('fish:resetLog', authed(() => { fishLog.reset(); return { ok: true } }))

  // ── Pickboard (상태는 메인에 있음) ────────────────────────────────────────

  pickboardStore.syncFromSettings(loadSettings())
  pickboardStore.on('update', () => {
    send('pickboard:update', pickboardStore.get())
    overlayServer.broadcast('pickboard:state', pickboardStore.toWire())
  })

  // ── Overlay server ───────────────────────────────────────────────────────

  overlayServer.setSnapshotProvider(() => [
    ...gameEngine.getAllStates().map(s => ({ type: 'game:state', data: OverlayServer.publicState(s) })),
    { type: 'pickboard:state', data: pickboardStore.toWire() },
  ])
  overlayServer.on('error', (m: string) => send('app:notice', { level: 'error', message: m }))

  // ── IPC handlers ─────────────────────────────────────────────────────────

  // Settings
  ipcMain.handle('settings:get', () => loadSettings())
  ipcMain.handle('settings:set', (_, patch: SettingsPatch) => {
    // 렌더러는 로그인 사용자를 바꿀 수 없다 — 화이트리스트 우회 경로 차단
    const { user: _u, ...safe } = (patch ?? {}) as SettingsPatch
    void _u
    const next = patchSettings(safe)
    gameEngine.updateSettings(next)
    donationGate.setSource(next.soop.donationSource)
    pickboardStore.syncFromSettings(next)
    applyAutoZoom(win)
    return next
  })

  // SOOP
  ipcMain.handle('soop:connect', authed((opts?: { channelId?: string }) => {
    const s = loadSettings()
    soopClient.connect({
      channelId:  (opts?.channelId ?? s.soop.channelId) || s.user?.id || '',
      userId:     s.soop.userId,
      token:      s.soop.token,
      simulation: false,
    })
    return { ok: true }
  }))
  ipcMain.handle('soop:disconnect', authed(() => { soopClient.disconnect(); return { ok: true } }))
  ipcMain.handle('soop:status', () => ({
    connected:  soopClient.isConnected(),
    simulation: soopClient.isSimulation(),
  }))

  // Games
  const isGameId = (id: unknown): id is GameId => typeof id === 'string' && (GAME_IDS as string[]).includes(id)
  ipcMain.handle('game:trigger', authed((gameId: GameId) => {
    if (!isGameId(gameId)) return { ok: false, error: '알 수 없는 게임' }
    const r = gameEngine.trigger(gameId, '스트리머', 0)
    return { ok: r !== 'rejected', status: r }
  }))
  ipcMain.handle('game:clearQueue', authed((gameId: GameId) => {
    if (isGameId(gameId)) gameEngine.clearQueue(gameId)
    return { ok: true }
  }))
  ipcMain.handle('game:state',   (_, gameId: GameId) => isGameId(gameId) ? gameEngine.getState(gameId) : null)
  ipcMain.handle('game:all',     ()                   => gameEngine.getAllStates())
  ipcMain.handle('game:history', (_, limit = 50)      => gameEngine.getHistory(Math.min(1000, Math.max(1, Number(limit) || 50))))

  // Pickboard
  ipcMain.handle('pickboard:get',    ()           => pickboardStore.get())
  ipcMain.handle('pickboard:reveal', authed((idx: number) => ({ ok: true, prize: pickboardStore.reveal(Number(idx)) })))
  ipcMain.handle('pickboard:reset',  authed(() => { pickboardStore.reset(loadSettings()); return { ok: true } }))
  ipcMain.handle('pickboard:show',   authed(() => { overlayServer.broadcast('pickboard:state', pickboardStore.toWire()); return { ok: true } }))

  // Overlay
  ipcMain.handle('overlay:url',       (_, gameId: string)        => overlayServer.getUrl(gameId))
  ipcMain.handle('overlay:broadcast', authed((type: string, data: unknown) => { overlayServer.broadcast(String(type), data); return { ok: true } }))
  ipcMain.handle('overlay:open', (_, gameId: string)  => {
    const url = overlayServer.getUrl(String(gameId).replace(/[^a-z]/g, ''))
    shell.openExternal(url)
    return { ok: true }
  })
  ipcMain.handle('overlay:status', () => ({ listening: overlayServer.listening }))

  // Stats snapshot
  ipcMain.handle('stats:get', () => ({
    todayRuns:     gameEngine.todayRuns,
    todayBalloons: gameEngine.todayBalloons,
    todayViewers:  gameEngine.todayViewers.size,
  }))

  // ── Auth ─────────────────────────────────────────────────────────────────
  // auth:verify(아이디 입력만으로 통과) 는 제거 — SOOP 쿠키 로그인만 남긴다

  ipcMain.handle('auth:getUser', () => isAuthed() ? currentUser() : null)
  ipcMain.handle('auth:logout', async () => {
    stopServices()
    setAuthedUser(null)
    await clearSoopCookies(win.webContents.session)
    return { ok: true }
  })
  ipcMain.handle('auth:recheck', async () => {
    const r = await recheckSaved()
    if (r.ok) startServices()
    return r
  })
  // SOOP OAuth login window
  ipcMain.handle('auth:soopLogin', async () => {
    const identity = await openSoopLoginWindow(win)
    if (!identity) return { ok: false, error: '로그인 취소됨' }
    const result = await verifyUser(identity.id)
    if (result.ok) {
      setAuthedUser(result.user)
      startServices()
      return { ok: true, user: result.user }
    }
    // 허용 목록에 없는 계정의 쿠키는 남겨두지 않는다 (다른 계정으로 다시 시도할 수 있게)
    await clearSoopCookies(win.webContents.session)
    return result.reason === 'denied'
      ? { ok: false, error: `허용되지 않은 계정입니다 (${identity.id}). 방장에게 추가를 요청하세요.` }
      : { ok: false, error: result.error }
  })

  // Quiz manual start
  ipcMain.handle('quiz:startManual', authed((opts: { question: string; answer: string; timeLimit: number }) => {
    const ok = gameEngine.startManualQuiz(String(opts?.question ?? ''), String(opts?.answer ?? ''), Number(opts?.timeLimit) || 30)
    return { ok }
  }))

  // ── weflab ───────────────────────────────────────────────────────────────
  // 위플랩 룰렛 결과 → 게임별 키워드가 포함된 게임 실행
  weflabWatcher.on('result', (text: string, nick: string) => {
    send('weflab:result', text, nick)
    const s = loadSettings()
    const lower = text.toLowerCase()
    for (const [id, cfg] of Object.entries(s.games)) {
      if (!isGameId(id) || !cfg.enabled) continue
      const kws = ((cfg.weflabKeywords as string[] | undefined) ?? []).map(k => k.trim().toLowerCase()).filter(Boolean)
      if (kws.some(k => lower.includes(k))) gameEngine.trigger(id, nick || 'weflab', 0)
    }
  })
  // 위플랩 후원 별풍선 → 게이트를 거쳐 SOOP 별풍선과 합산
  weflabWatcher.on('donation', (d: { donor: string; balloons: number; amount: number; message: string; ts: number }) => {
    send('weflab:donation', d)
    if (d.balloons > 0) donationGate.push('weflab', d.donor || 'weflab', d.balloons)
  })
  weflabWatcher.on('loaded',   ()          => send('weflab:loaded'))
  weflabWatcher.on('retrying', (m: string) => send('weflab:retrying', m))
  weflabWatcher.on('error',    (e: string) => send('weflab:error', e))

  ipcMain.handle('weflab:start', authed((url: string) => {
    const err = weflabWatcher.start(String(url ?? '').trim())
    return err ? { ok: false, error: err } : { ok: true }
  }))
  ipcMain.handle('weflab:stop', authed(() => {
    weflabWatcher.stop()
    return { ok: true }
  }))
  ipcMain.handle('weflab:status', () => ({
    running: weflabWatcher.isRunning,
    url:     weflabWatcher.url,
  }))
}
