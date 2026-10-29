import { contextBridge, ipcRenderer } from 'electron'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const on = (channel: string, cb: (...args: any[]) => void) => {
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
  gameTrigger:    (gameId: string)        => ipcRenderer.invoke('game:trigger', gameId),
  gameClearQueue: (gameId: string)        => ipcRenderer.invoke('game:clearQueue', gameId),
  gameStage:      ()                      => ipcRenderer.invoke('game:stage'),
  gameClearStage: ()                      => ipcRenderer.invoke('game:clearStage'),
  gameState:      (gameId: string)        => ipcRenderer.invoke('game:state', gameId),
  gameAll:        ()                      => ipcRenderer.invoke('game:all'),
  gameHistory:    (limit?: number)        => ipcRenderer.invoke('game:history', limit),

  // Fish log
  fishRanking:  (limit?: number) => ipcRenderer.invoke('fish:ranking', limit),
  fishResetLog: ()               => ipcRenderer.invoke('fish:resetLog'),

  // Ladder (모집이 끝나면 줄을 하나씩 공개)
  ladderReveal:     (idx: number) => ipcRenderer.invoke('ladder:reveal', idx),
  ladderRevealNext: ()            => ipcRenderer.invoke('ladder:revealNext'),
  ladderRevealAll:  ()            => ipcRenderer.invoke('ladder:revealAll'),

  // Pickboard (상태는 메인 프로세스)
  pickboardGet:    ()            => ipcRenderer.invoke('pickboard:get'),
  pickboardReveal: (idx: number) => ipcRenderer.invoke('pickboard:reveal', idx),
  pickboardReset:  ()            => ipcRenderer.invoke('pickboard:reset'),
  pickboardShow:   ()            => ipcRenderer.invoke('pickboard:show'),

  // Overlay
  overlayUrl:       (gameId: string)                  => ipcRenderer.invoke('overlay:url', gameId),
  overlayOpen:      (gameId: string)                  => ipcRenderer.invoke('overlay:open', gameId),
  overlayOpenGallery: ()                              => ipcRenderer.invoke('overlay:openGallery'),
  overlayBroadcast: (type: string, data: unknown)     => ipcRenderer.invoke('overlay:broadcast', type, data),
  overlayStatus:    ()                                => ipcRenderer.invoke('overlay:status'),

  // Media
  mediaList:       (game: string) => ipcRenderer.invoke('media:list', game),
  mediaOpenFolder: (game: string) => ipcRenderer.invoke('media:openFolder', game),

  // Stats
  statsGet: () => ipcRenderer.invoke('stats:get'),

  // Auth (auth:verify 는 제거됨 — SOOP 로그인만)
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

  // Auto update
  updateStatus:   ()                                  => ipcRenderer.invoke('update:status'),
  onUpdateStatus: (cb: (s: unknown) => void)          => on('update:status', cb),

  // Event subscriptions
  onSoopConnected:    (cb: () => void)                        => on('soop:connected',    cb),
  onSoopDisconnected: (cb: () => void)                        => on('soop:disconnected', cb),
  onSoopError:        (cb: (err: string) => void)             => on('soop:error',        cb),
  onSoopStandby:      (cb: (msg: string) => void)             => on('soop:standby',      cb),
  onSoopViewers:      (cb: (n: number) => void)               => on('soop:viewers',      cb),
  onSoopBalloon:      (cb: (e: SoopBalloonEvent) => void)     => on('soop:balloon',      cb),
  onSoopChat:         (cb: (e: SoopChatEvent) => void)        => on('soop:chat',         cb),
  onGameUpdate:       (cb: (id: string, s: unknown) => void)  => on('game:update',       cb),
  onStageUpdate:      (cb: (q: unknown) => void)              => on('stage:update',      cb),
  onGameResult:       (cb: (id: string, r: unknown) => void)  => on('game:result',       cb),
  onQuizQuestion:     (cb: (q: unknown) => void)              => on('quiz:question',      cb),
  onStatsUpdate:      (cb: (s: StatsSnapshot) => void)        => on('stats:update',      cb),
  onSettingsChanged:  (cb: (s: unknown) => void)              => on('settings:changed',  cb),
  onPickboardUpdate:  (cb: (s: unknown) => void)              => on('pickboard:update',  cb),
  onAppNotice:        (cb: (n: AppNotice) => void)            => on('app:notice',        cb),
  onWeflabResult:     (cb: (text: string, nick: string) => void) => on('weflab:result',   cb),
  onWeflabDonation:   (cb: (d: WeflabDonationEvent) => void)  => on('weflab:donation',   cb),
  onWeflabLoaded:     (cb: () => void)                        => on('weflab:loaded',     cb),
  onWeflabRetrying:   (cb: (m: string) => void)               => on('weflab:retrying',   cb),
  onWeflabError:      (cb: (e: string) => void)               => on('weflab:error',      cb),
})

interface SoopBalloonEvent { user: string; amount: number; ts: number }
interface WeflabDonationEvent { donor: string; balloons: number; amount: number; message: string; event: string; ts: number }
interface SoopChatEvent    { user: string; message: string; ts: number }
interface StatsSnapshot    { todayRuns: number; todayBalloons: number; todayViewers: number }
interface AppNotice        { level: 'info' | 'warn' | 'error'; message: string }
