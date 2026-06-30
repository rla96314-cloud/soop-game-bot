import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChatItem {
  user: string
  message: string
  ts: number
  isBalloon: boolean
  amount?: number
}

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
  [gameId: string]: { status: string; [k: string]: unknown }
}

export interface FanAlertItem {
  userId:     string
  userNick:   string
  broadcasts: { id: string; name: string; rank: number }[]
  ts:         number
}

export interface AppCtx {
  connected:  boolean
  simulation: boolean
  chat:       ChatItem[]
  history:    HistoryItem[]
  stats:      Stats
  gameStates: GameStates
  settings:   Record<string, unknown> | null
  fanAlerts:  FanAlertItem[]
  triggerGame:   (gameId: string) => void
  refreshSettings: () => void
  patchSettings: (patch: unknown) => void
}

// ── Default ──────────────────────────────────────────────────────────────────

const defaultCtx: AppCtx = {
  connected:  false,
  simulation: true,
  chat:       [],
  history:    [],
  stats:      { todayRuns: 0, todayBalloons: 0, todayViewers: 0 },
  gameStates: {},
  settings:   null,
  fanAlerts:  [],
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
  boss:     { name: '보스전'    },
  quiz:     { name: '퀴즈'     },
  slot:     { name: '슬롯머신'  },
  race:     { name: '경주'     },
  rps:      { name: '가위바위보' },
  fish:     { name: '낚시'     },
  lottery:  { name: '복권'     },
  number:   { name: '숫자 추첨' },
}

const MAX_CHAT    = 100
const MAX_HISTORY = 50

export function AppProvider({ children }: { children: ReactNode }) {
  const [connected,  setConnected]  = useState(false)
  const [simulation, setSimulation] = useState(true)
  const [chat,       setChat]       = useState<ChatItem[]>([])
  const [history,    setHistory]    = useState<HistoryItem[]>([])
  const [stats,      setStats]      = useState<Stats>({ todayRuns: 0, todayBalloons: 0, todayViewers: 0 })
  const [gameStates, setGameStates] = useState<GameStates>({})
  const [settings,   setSettings]   = useState<Record<string, unknown> | null>(null)
  const [fanAlerts,  setFanAlerts]  = useState<FanAlertItem[]>([])

  const el = (window as unknown as Record<string, unknown>).electron as Record<string, unknown>

  // ── Boot ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!el) return

    // Load initial data
    ;(el.settingsGet as () => Promise<unknown>)()
      .then(s => setSettings(s as Record<string, unknown>))
      .catch(() => {})

    ;(el.soopStatus as () => Promise<{ connected: boolean; simulation: boolean }>)()
      .then(s => { setConnected(s.connected); setSimulation(s.simulation) })
      .catch(() => {})

    ;(el.statsGet as () => Promise<Stats>)()
      .then(s => setStats(s))
      .catch(() => {})

    ;(el.gameAll as () => Promise<GameStates>)()
      .then(s => setGameStates(s))
      .catch(() => {})

    ;(el.gameHistory as (n: number) => Promise<unknown[]>)(MAX_HISTORY)
      .then(items => {
        const mapped = (items as HistoryItem[]).map(r => ({
          ...r,
          gameName: GAME_META[r.gameId]?.name ?? r.gameId,
        }))
        setHistory(mapped)
      })
      .catch(() => {})
  }, [])

  // ── Event listeners ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!el) return

    const off: Array<() => void> = []

    off.push((el.onSoopConnected as (cb: () => void) => () => void)(() => {
      setConnected(true)
      ;(el.soopStatus as () => Promise<{ connected: boolean; simulation: boolean }>)()
        .then(s => setSimulation(s.simulation))
        .catch(() => {})
    }))

    off.push((el.onSoopDisconnected as (cb: () => void) => () => void)(() => {
      setConnected(false)
    }))

    off.push((el.onSoopBalloon as (cb: (e: { user: string; amount: number; ts: number }) => void) => () => void)(
      ({ user, amount, ts }) => {
        setChat(prev => {
          const item: ChatItem = { user, message: `별풍선 ${amount.toLocaleString()}개`, ts, isBalloon: true, amount }
          return [item, ...prev].slice(0, MAX_CHAT)
        })
        setStats(prev => ({
          ...prev,
          todayBalloons: prev.todayBalloons + amount,
        }))
      }
    ))

    off.push((el.onSoopChat as (cb: (e: { user: string; message: string; ts: number }) => void) => () => void)(
      ({ user, message, ts }) => {
        setChat(prev => {
          const item: ChatItem = { user, message, ts, isBalloon: false }
          return [item, ...prev].slice(0, MAX_CHAT)
        })
      }
    ))

    off.push((el.onGameUpdate as (cb: (id: string, s: unknown) => void) => () => void)(
      (id, state) => {
        setGameStates(prev => ({ ...prev, [id]: state as GameStates[string] }))
      }
    ))

    off.push((el.onGameResult as (cb: (id: string, r: unknown) => void) => () => void)(
      (id, result) => {
        const r = result as HistoryItem
        const item: HistoryItem = {
          ...r,
          gameId:   id,
          gameName: GAME_META[id]?.name ?? id,
        }
        setHistory(prev => [item, ...prev].slice(0, MAX_HISTORY))
        setStats(prev => ({ ...prev, todayRuns: prev.todayRuns + 1 }))
      }
    ))

    off.push((el.onStatsUpdate as (cb: (s: Stats) => void) => () => void)(
      s => setStats(s)
    ))

    off.push((el.onSoopFanAlert as (cb: (e: FanAlertItem) => void) => () => void)(
      (e) => setFanAlerts(prev => [e, ...prev].slice(0, 20))
    ))

    return () => off.forEach(fn => fn())
  }, [])

  // ── Actions ───────────────────────────────────────────────────────────────

  const triggerGame = (gameId: string) => {
    ;(el.gameTrigger as (id: string) => Promise<unknown>)(gameId).catch(() => {})
  }

  const refreshSettings = () => {
    ;(el.settingsGet as () => Promise<unknown>)()
      .then(s => setSettings(s as Record<string, unknown>))
      .catch(() => {})
  }

  const patchSettings = (patch: unknown) => {
    ;(el.settingsSet as (p: unknown) => Promise<unknown>)(patch)
      .then(s => setSettings(s as Record<string, unknown>))
      .catch(() => {})
  }

  return (
    <Ctx.Provider value={{
      connected, simulation,
      chat, history, stats, gameStates, settings, fanAlerts,
      triggerGame, refreshSettings, patchSettings,
    }}>
      {children}
    </Ctx.Provider>
  )
}
