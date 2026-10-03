import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

export interface HistoryItem {
  gameId: string
  gameName: string
  triggeredBy: string
  balloon: number
  result: string
  detail: string
  ts: number
}

export interface Stats {
  todayRuns: number
  todayBalloons: number
  todayViewers: number
}

export interface GameStates {
  [gameId: string]: { status: string; queued?: number; [k: string]: unknown }
}

export interface AppNotice { id: number; level: 'info' | 'warn' | 'error'; message: string; ts: number }

export interface AppCtx {
  connected:  boolean
  simulation: boolean
  standby:    string | null   // 방송 대기/재접속 상태 메시지 (실연동 모드에서 오프라인일 때)
  lastError:  string | null   // 마지막 SOOP 연결 오류 (원인 표시용)
  liveViewers: number         // 현재 시청자 수 (방송국 API)
  history:    HistoryItem[]
  stats:      Stats
  gameStates: GameStates
  settings:   Record<string, unknown> | null
  notices:    AppNotice[]     // 메인 프로세스 알림 (포트 충돌, 설정 파일 손상 등)
  dismissNotice: (id: number) => void
  triggerGame:   (gameId: string) => void
  refreshSettings: () => void
  patchSettings: (patch: unknown) => void
}

// ── Default ──────────────────────────────────────────────────────────────────

const defaultCtx: AppCtx = {
  connected:  false,
  simulation: false,
  standby:    null,
  lastError:  null,
  liveViewers: 0,
  history:    [],
  stats:      { todayRuns: 0, todayBalloons: 0, todayViewers: 0 },
  gameStates: {},
  settings:   null,
  notices:    [],
  dismissNotice:    () => {},
  triggerGame:      () => {},
  refreshSettings:  () => {},
  patchSettings:    () => {},
}

const Ctx = createContext<AppCtx>(defaultCtx)

export function useApp() { return useContext(Ctx) }

// ── Provider ─────────────────────────────────────────────────────────────────

const GAME_META: Record<string, { name: string }> = {
  roulette: { name: '룰렛'     },
  ladder:   { name: '사다리타기' },
  pickboard:{ name: '뽑기판'    },
  quiz:     { name: '퀴즈'     },
  slot:     { name: '슬롯머신'  },
  race:     { name: '경주'     },
  rps:      { name: '가위바위보' },
  fish:     { name: '낚시'     },
  lottery:  { name: '복권'     },
  number:   { name: '숫자 추첨' },
}

// 메인 프로세스가 1000건까지 들고 있으므로 같은 상한으로 받아온다
const MAX_HISTORY = 1000

type El = Record<string, (...args: never[]) => unknown>
const el = (window as unknown as { electron?: El }).electron

let noticeSeq = 0

export function AppProvider({ children }: { children: ReactNode }) {
  const [connected,  setConnected]  = useState(false)
  const [simulation, setSimulation] = useState(false)
  const [standby,    setStandby]    = useState<string | null>(null)
  const [lastError,  setLastError]  = useState<string | null>(null)
  const [liveViewers, setLiveViewers] = useState(0)
  const [history,    setHistory]    = useState<HistoryItem[]>([])
  const [stats,      setStats]      = useState<Stats>({ todayRuns: 0, todayBalloons: 0, todayViewers: 0 })
  const [gameStates, setGameStates] = useState<GameStates>({})
  const [settings,   setSettings]   = useState<Record<string, unknown> | null>(null)
  const [notices,    setNotices]    = useState<AppNotice[]>([])

  const call = <T,>(name: string, ...args: unknown[]): Promise<T> => {
    const fn = el?.[name] as ((...a: unknown[]) => Promise<T>) | undefined
    return fn ? fn(...args) : Promise.reject(new Error(`electron.${name} 없음`))
  }
  const sub = (name: string, cb: (...a: unknown[]) => void): (() => void) => {
    const fn = el?.[name] as ((cb: (...a: unknown[]) => void) => () => void) | undefined
    return fn ? fn(cb) : () => {}
  }

  // ── Boot ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!el) return
    call<Record<string, unknown>>('settingsGet').then(setSettings).catch(() => {})
    call<{ connected: boolean; simulation: boolean }>('soopStatus')
      .then(s => { setConnected(s.connected); setSimulation(s.simulation) }).catch(() => {})
    call<Stats>('statsGet').then(setStats).catch(() => {})
    call<GameStates[string][]>('gameAll')
      // 메인은 배열(getAllStates)로 주므로 gameId 키의 맵으로 바꾼다 — 예전엔 배열을 그대로 넣어 첫 갱신 전까지 상태가 비어 있었음
      .then(list => setGameStates(Object.fromEntries((list ?? []).map(s => [String(s.id ?? ''), s]))))
      .catch(() => {})
    call<HistoryItem[]>('gameHistory', MAX_HISTORY)
      .then(items => setHistory((items ?? []).map(r => ({ ...r, gameName: GAME_META[r.gameId]?.name ?? r.gameId }))))
      .catch(() => {})
  }, [])

  // ── Event listeners ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!el) return
    const off: Array<() => void> = []

    off.push(sub('onSoopConnected', () => {
      setConnected(true); setStandby(null); setLastError(null)
      call<{ connected: boolean; simulation: boolean }>('soopStatus').then(s => setSimulation(s.simulation)).catch(() => {})
    }))
    off.push(sub('onSoopDisconnected', () => setConnected(false)))
    off.push(sub('onSoopStandby', (msg) => { setConnected(false); setStandby(String(msg)) }))
    off.push(sub('onSoopError',   (err) => setLastError(String(err))))
    off.push(sub('onSoopViewers', (n) => setLiveViewers(Number(n) || 0)))

    // 별풍선·실행 수 집계는 메인 프로세스(stats:update)가 단일 소스 — 렌더러에서 따로 더하면 이중 집계
    off.push(sub('onGameUpdate', (id, state) => {
      setGameStates(prev => ({ ...prev, [String(id)]: state as GameStates[string] }))
    }))
    off.push(sub('onGameResult', (id, result) => {
      const r = result as HistoryItem
      const item: HistoryItem = { ...r, gameId: String(id), gameName: GAME_META[String(id)]?.name ?? String(id) }
      setHistory(prev => [item, ...prev].slice(0, MAX_HISTORY))
    }))
    off.push(sub('onStatsUpdate', (s) => setStats(s as Stats)))
    off.push(sub('onSettingsChanged', (s) => setSettings(s as Record<string, unknown>)))
    off.push(sub('onAppNotice', (n) => {
      const { level, message } = n as { level: AppNotice['level']; message: string }
      setNotices(prev => [...prev.slice(-9), { id: ++noticeSeq, level, message, ts: Date.now() }])
    }))

    return () => off.forEach(fn => fn())
  }, [])

  // ── Actions ───────────────────────────────────────────────────────────────

  const triggerGame = useCallback((gameId: string) => { call('gameTrigger', gameId).catch(() => {}) }, [])
  const refreshSettings = useCallback(() => {
    call<Record<string, unknown>>('settingsGet').then(setSettings).catch(() => {})
  }, [])
  const patchSettings = useCallback((patch: unknown) => {
    call<Record<string, unknown>>('settingsSet', patch).then(setSettings).catch(() => {})
  }, [])
  const dismissNotice = useCallback((id: number) => setNotices(prev => prev.filter(n => n.id !== id)), [])

  // value 를 memo 하지 않으면 이벤트마다 모든 소비자가 다시 렌더링된다
  const value = useMemo<AppCtx>(() => ({
    connected, simulation, standby, lastError, liveViewers,
    history, stats, gameStates, settings, notices,
    dismissNotice, triggerGame, refreshSettings, patchSettings,
  }), [connected, simulation, standby, lastError, liveViewers, history, stats, gameStates, settings, notices,
       dismissNotice, triggerGame, refreshSettings, patchSettings])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
