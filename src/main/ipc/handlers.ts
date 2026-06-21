import { ipcMain, BrowserWindow, shell } from 'electron'
import { gameEngine, type GameId } from '../games/engine'
import { soopClient }              from '../soop/client'
import { overlayServer }           from '../overlay/server'
import { loadSettings, patchSettings, saveSettings } from '../store/settings'

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
}
