import { ipcMain, BrowserWindow, shell, app } from 'electron'
import { gameEngine, type GameId } from '../games/engine'
import { soopClient }              from '../soop/client'
import { overlayServer }           from '../overlay/server'
import { loadSettings, patchSettings, saveSettings } from '../store/settings'
import { verifyUser, fetchAllowlist }               from '../auth/allowlist'
import { openSoopLoginWindow }                      from '../auth/soopLogin'
import { fetchTodaySchedule }                       from '../schedule/fetcher'
import { weflabWatcher }                            from '../weflab/watcher'
import { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// ── 팬 DB ────────────────────────────────────────────────────────────────────
const FAN_DB_PATH = join(homedir(), 'virtual-fan-monitor', 'data', 'fans.json')

interface FanInfo { nick: string; broadcasts: { id: string; name: string; rank: number }[] }
let fanDB: Record<string, FanInfo> = {}

function loadFanDB() {
  try {
    fanDB = JSON.parse(readFileSync(FAN_DB_PATH, 'utf-8'))
  } catch { fanDB = {} }
}
loadFanDB()
setInterval(loadFanDB, 60_000)

function lookupFan(userId: string, userNick: string): FanInfo | null {
  const id = userId.toLowerCase()
  if (fanDB[id]) return fanDB[id]
  for (const info of Object.values(fanDB)) {
    if (info.nick && info.nick === userNick) return info
  }
  return null
}

// 세션 내 중복 알림 방지 (채팅+입장 둘 다 잡히는 경우)
const alertedThisSession = new Set<string>()

const BOSS_HP_SERVER = 'http://100.89.116.107:4081'
const EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp']

async function downloadBossImages(imageUrls: Record<string, string>) {
  const dataDir = join(app.getPath('userData'), 'data')
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
  for (const [phase, url] of Object.entries(imageUrls)) {
    if (!url || typeof url !== 'string') continue
    try {
      const ir  = await fetch(url)
      if (!ir.ok) continue
      const buf = Buffer.from(await ir.arrayBuffer())
      const ct  = ir.headers.get('content-type') ?? 'image/png'
      const ext = ct.includes('jpeg') || ct.includes('jpg') ? 'jpg'
                : ct.includes('gif') ? 'gif' : ct.includes('webp') ? 'webp' : 'png'
      const base = join(dataDir, `boss-image-${phase}`)
      EXTS.forEach(e => { try { unlinkSync(`${base}.${e}`) } catch {} })
      writeFileSync(`${base}.${ext}`, buf)
    } catch {}
  }
}

function emitFanAlert(send: (ch: string, ...a: unknown[]) => void, userId: string, userNick: string) {
  const key = userId.toLowerCase()
  if (alertedThisSession.has(key)) return
  const info = lookupFan(userId, userNick)
  if (!info) return
  alertedThisSession.add(key)
  // 5분 후 재감지 허용 (같은 사람이 나갔다 들어올 수 있음)
  setTimeout(() => alertedThisSession.delete(key), 5 * 60_000)
  send('soop:fan-alert', {
    userId,
    userNick: info.nick || userNick,
    broadcasts: info.broadcasts.slice(0, 3),
    ts: Date.now(),
  })
}

export function registerIpcHandlers(win: BrowserWindow) {
  const send = (ch: string, ...args: unknown[]) => {
    if (!win.isDestroyed()) win.webContents.send(ch, ...args)
  }

  let lastBossRollTs = 0

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
    // 채팅으로 열혈팬 감지 (입장 패킷 보완)
    emitFanAlert(send, user, user)
  })

  soopClient.on('enter', (userId: string, userNick: string) => {
    emitFanAlert(send, userId, userNick)
  })

  // ── Game engine ──────────────────────────────────────────────────────────

  gameEngine.on('game:update', (id, state) => {
    send('game:update', id, state)
    overlayServer.sendState(state)

    // Shared boss: report damage to server on each new roll
    if (id === 'boss' && state.boss?.lastRoll && state.boss.lastRoll.ts > lastBossRollTs) {
      lastBossRollTs = state.boss.lastRoll.ts
      const roll      = state.boss.lastRoll
      const channelId = loadSettings().soop?.channelId ?? 'unknown'
      fetch(`${BOSS_HP_SERVER}/boss-attack`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ channelId, username: roll.user, damage: roll.damage, isCrit: roll.isCritical }),
      })
        .then(r => r.json())
        .then((j: Record<string, unknown>) => {
          gameEngine.setSharedBossHp(j.currentHp as number, j.alive as boolean)
        })
        .catch(() => {})
    }
  })

  overlayServer.setCommandHandler((cmd) => {
    if (cmd.type === 'start-boss') {
      gameEngine.startBossRaid()
    } else if (cmd.type === 'reset-boss') {
      gameEngine.resetBoss()
    } else if (cmd.type === 'update-settings') {
      const s    = cmd.settings as Record<string, unknown>
      const urls = s.imageUrls as Record<string, string> | undefined
      if (urls) downloadBossImages(urls).catch(() => {})
      const { imageUrls: _drop, ...bossOnly } = s
      const next = patchSettings({ games: { boss: bossOnly } })
      gameEngine.updateSettings(next)
    } else if (cmd.type === 'sync-boss-hp') {
      gameEngine.setSharedBossHp(cmd.currentHp as number, cmd.alive as boolean)
    }
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
  ipcMain.handle('boss:start', () => {
    gameEngine.startBossRaid()
    const cfg = loadSettings().games.boss as Record<string, unknown>
    fetch(`${BOSS_HP_SERVER}/shared-boss/start`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ maxHp: (cfg?.maxHp as number) ?? 100000, bossName: (cfg?.bossName as string) ?? '보스' }),
    }).catch(() => {})
    return { ok: true }
  })
  ipcMain.handle('boss:reset', () => { gameEngine.resetBoss(); return { ok: true } })

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
  weflabWatcher.on('result', (text: string) => {
    send('weflab:result', text)
    const s = loadSettings()
    if (!s.weflab.enabled) return
    const lower = text.toLowerCase()

    // ① 게임별 weflab 트리거 단어 매칭 (각 게임 설정에 지정)
    //    weflab 룰렛 결과 글자에 게임의 트리거 단어가 포함되면 해당 게임 발동
    const perGameMatched: GameId[] = []
    let anyKeywordConfigured = false
    for (const [id, cfg] of Object.entries(s.games)) {
      const kw = (cfg.weflabKeyword as string | undefined)?.trim()
      if (!kw) continue
      anyKeywordConfigured = true
      if (cfg.enabled === false) continue
      if (lower.includes(kw.toLowerCase())) perGameMatched.push(id as GameId)
    }
    if (perGameMatched.length > 0) {
      perGameMatched.forEach(id => gameEngine.trigger(id, 'weflab', 0))
      return
    }
    // 게임별 트리거 단어를 하나라도 설정했다면 전역 룰렛 폴백은 끔 (중복 방지)
    if (anyKeywordConfigured) return

    // ② (구버전 호환) 게임별 단어 미설정 시 — 전역 트리거 키워드로 룰렛만 발동
    const validTriggers = s.weflab.triggers.filter(t => t.keyword)
    const matched = validTriggers.length === 0
      || validTriggers.some(t => lower.includes(t.keyword.toLowerCase()))
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
