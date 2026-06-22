import { contextBridge, ipcRenderer } from 'electron'

const on = (channel: string, cb: (...args: unknown[]) => void) => {
  const handler = (_: Electron.IpcRendererEvent, ...args: unknown[]) => cb(...args)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

contextBridge.exposeInMainWorld('electron', {
  // Window
  minimize:    () => ipcRenderer.send('window:minimize'),
  maximize:    () => ipcRenderer.send('window:maximize'),
  close:       () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Settings
  settingsGet: ()      => ipcRenderer.invoke('settings:get'),
  settingsSet: (patch: unknown) => ipcRenderer.invoke('settings:set', patch),

  // SOOP
  soopConnect:    (opts?: unknown) => ipcRenderer.invoke('soop:connect', opts),
  soopDisconnect: ()               => ipcRenderer.invoke('soop:disconnect'),
  soopStatus:     ()               => ipcRenderer.invoke('soop:status'),

  // Games
  gameTrigger: (gameId: string)        => ipcRenderer.invoke('game:trigger', gameId),
  gameState:   (gameId: string)        => ipcRenderer.invoke('game:state', gameId),
  gameAll:     ()                      => ipcRenderer.invoke('game:all'),
  gameHistory: (limit?: number)        => ipcRenderer.invoke('game:history', limit),
  bossStart:   ()                      => ipcRenderer.invoke('boss:start'),
  bossReset:   ()                      => ipcRenderer.invoke('boss:reset'),

  // Overlay
  overlayUrl:       (gameId: string)                  => ipcRenderer.invoke('overlay:url', gameId),
  overlayOpen:      (gameId: string)                  => ipcRenderer.invoke('overlay:open', gameId),
  overlayBroadcast: (type: string, data: unknown)     => ipcRenderer.invoke('overlay:broadcast', type, data),

  // Stats
  statsGet: () => ipcRenderer.invoke('stats:get'),

  // Auth
  authVerify:    (id: string) => ipcRenderer.invoke('auth:verify', id),
  authGetUser:   ()           => ipcRenderer.invoke('auth:getUser'),
  authLogout:    ()           => ipcRenderer.invoke('auth:logout'),
  authRecheck:   ()           => ipcRenderer.invoke('auth:recheck'),
  authSoopLogin: ()           => ipcRenderer.invoke('auth:soopLogin'),

  // Quiz
  quizStartManual: (opts: { question: string; answer: string; timeLimit: number }) =>
    ipcRenderer.invoke('quiz:startManual', opts),

  // weflab
  weflabStart:  (url: string) => ipcRenderer.invoke('weflab:start', url),
  weflabStop:   ()            => ipcRenderer.invoke('weflab:stop'),
  weflabStatus: ()            => ipcRenderer.invoke('weflab:status'),

  // Schedule
  scheduleToday: (force?: boolean) => ipcRenderer.invoke('schedule:today', force ?? false),

  // Event subscriptions
  onSoopConnected:    (cb: () => void)                        => on('soop:connected',    cb),
  onSoopDisconnected: (cb: () => void)                        => on('soop:disconnected', cb),
  onSoopError:        (cb: (err: string) => void)             => on('soop:error',        cb),
  onSoopBalloon:      (cb: (e: SoopBalloonEvent) => void)     => on('soop:balloon',      cb),
  onSoopChat:         (cb: (e: SoopChatEvent) => void)        => on('soop:chat',         cb),
  onGameUpdate:       (cb: (id: string, s: unknown) => void)  => on('game:update',       cb),
  onGameResult:       (cb: (id: string, r: unknown) => void)  => on('game:result',       cb),
  onQuizQuestion:     (cb: (q: unknown) => void)              => on('quiz:question',      cb),
  onStatsUpdate:      (cb: (s: StatsSnapshot) => void)        => on('stats:update',      cb),
  onWeflabResult:     (cb: (text: string) => void)            => on('weflab:result',     cb),
  onWeflabLoaded:     (cb: () => void)                        => on('weflab:loaded',     cb),
  onWeflabError:      (cb: (e: string) => void)               => on('weflab:error',      cb),
})

interface SoopBalloonEvent { user: string; amount: number; ts: number }
interface SoopChatEvent    { user: string; message: string; ts: number }
interface StatsSnapshot    { todayRuns: number; todayBalloons: number; todayViewers: number }
