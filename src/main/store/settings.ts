import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, copyFileSync } from 'fs'
import type { DonationSource } from '../donation/gate'

export interface RouletteItem { name: string; probability: number }
export interface QuizQuestion { question: string; answer: string }
export interface Prize        { name: string; description: string }
export interface PickItem     { name: string; description: string; color: string; count: number }

export interface GameConfig {
  enabled:          boolean
  balloonThreshold: number
  chatCommand:      string
  weflabKeywords?:  string[]   // 위플랩 룰렛 결과에 이 키워드가 있으면 이 게임 실행
  // roulette
  items?:        RouletteItem[]
  spinDuration?: number
  animType?:     'wheel' | 'text'
  // ladder
  maxParticipants?: number
  joinDuration?:   number
  prizes?:         Prize[]
  // pickboard
  pickRows?: number
  pickCols?: number
  pickItems?: PickItem[]
  // quiz
  timeLimit?: number
  questions?: QuizQuestion[]
  // slot / race / rps / fish / lottery
  [key: string]: unknown
}

export interface AuthUser { id: string; name: string; verifiedAt?: number }

export interface Settings {
  user?: AuthUser | null
  soop: {
    channelId:          string
    userId:             string
    token:              string
    simulationMode:     boolean   // 사용 안 함 (항상 실연동)
    balloonAutoTrigger: boolean
    donationSource:     DonationSource   // 게임 트리거로 쓸 후원 경로 (both = 둘 다 + 3초 중복 제거)
    multiRun:           boolean          // 후원 개수 ÷ 임계값 만큼 여러 번 실행
    maxRunsPerDonation: number           // 후원 1건당 최대 실행 수
  }
  games:   Record<string, GameConfig>
  overlay: { port: number; theme: string }
  ui:      { scale: number; autoFit?: boolean }   // scale: 자동 맞춤 위에 곱하는 사용자 배율(%), autoFit: 자동 맞춤 도입 후 마이그레이션 표시

  weflab: {
    url: string   // 비어 있지 않으면 앱 시작 시 자동 감시. 룰렛 결과 키워드는 게임별 weflabKeywords
  }
}

export const DEFAULTS: Settings = {
  soop: {
    channelId:          '',
    userId:             '',
    token:              '',
    simulationMode:     false,
    balloonAutoTrigger: true,
    donationSource:     'both',
    multiRun:           true,
    maxRunsPerDonation: 10,
  },
  games: {
    roulette: {
      enabled: true, balloonThreshold: 50, chatCommand: '!룰렛',
      spinDuration: 3000,
      items: [
        { name: '벌칙 1',       probability: 25 },
        { name: '미션 2',       probability: 20 },
        { name: '상금 이벤트!', probability:  5 },
        { name: '벌칙 3',       probability: 25 },
        { name: '미션 4',       probability: 15 },
        { name: '꽝',           probability: 10 },
      ],
    },
    ladder: {
      enabled: true, balloonThreshold: 0, chatCommand: '!참가',
      maxParticipants: 8, joinDuration: 30,
      prizes: [
        { name: '1등', description: '치킨 쿠폰' },
        { name: '2등', description: '음료 쿠폰' },
        { name: '꽝',  description: '' },
      ],
    },
    pickboard: {
      enabled: true, balloonThreshold: 0, chatCommand: '',
      pickRows: 4, pickCols: 5,
      pickItems: [
        { name: '1등 상품', description: '치킨 쿠폰',  color: '#F59E0B', count: 1 },
        { name: '2등 상품', description: '음료 쿠폰',  color: '#8B5CF6', count: 2 },
        { name: '3등 상품', description: '간식 쿠폰',  color: '#3B82F6', count: 3 },
        { name: '꽝',       description: '',            color: '#6B7280', count: 14 },
      ],
    },
    quiz: {
      enabled: false, balloonThreshold: 0, chatCommand: '!퀴즈',
      timeLimit: 30,
      questions: [
        { question: 'SOOP의 이전 이름은?', answer: '아프리카TV' },
        { question: '별풍선 최소 후원 단위는?', answer: '1개' },
      ],
    },
    slot: {
      enabled: false, balloonThreshold: 100, chatCommand: '!슬롯',
      spinDuration: 3000,
      symbols: ['🍒', '🍋', '🍊', '⭐', '🎰', '💎', '7️⃣', '🔔'],
    },
    race: {
      enabled: false, balloonThreshold: 0, chatCommand: '!경주',
      joinDuration: 20, raceDuration: 8000,
      racers: [
        { name: '말', emoji: '🐎' }, { name: '토끼', emoji: '🐇' }, { name: '거북이', emoji: '🐢' },
        { name: '악어', emoji: '🐊' }, { name: '여우', emoji: '🦊' }, { name: '치타', emoji: '🐆' },
      ],
    },
    rps: { enabled: false, balloonThreshold: 0, chatCommand: '!묵찌빠', joinDuration: 15 },
    fish: {
      enabled: false, balloonThreshold: 0, chatCommand: '!낚시',
      castDuration: 4000,
      fishes: [
        { name: '고등어', emoji: '🐟', probability: 50, rarity: 'common',    points: 1 },
        { name: '참치',   emoji: '🐠', probability: 30, rarity: 'uncommon',  points: 3 },
        { name: '복어',   emoji: '🐡', probability: 15, rarity: 'rare',      points: 10 },
        { name: '황금어', emoji: '🐉', probability:  5, rarity: 'legendary', points: 50 },
      ],
    },
    lottery: { enabled: false, balloonThreshold:   0, chatCommand: '!복권', scratchDuration: 3000 },
    number:  {
      enabled: false, balloonThreshold: 0, chatCommand: '!추첨',
      minNumber: 1, maxNumber: 100, count: 1,
      spinDuration: 3000,
      excludeList: [] as number[],
    },
  },
  overlay: { port: 3939, theme: 'purple' },
  ui:      { scale: 100, autoFit: true },
  weflab:  { url: '' },
}

// ─── Validation ───────────────────────────────────────────────────────────────
// 렌더러 입력은 믿지 않는다. 숫자는 범위로 고정하고, 깨진 값은 기본값으로.

export const LIMITS = {
  port:             { min: 1024, max: 65535 },
  balloonThreshold: { min: 0,    max: 1_000_000 },
  spinDuration:     { min: 1000, max: 15000 },
  scratchDuration:  { min: 1000, max: 15000 },
  joinDuration:     { min: 5,    max: 600 },
  maxParticipants:  { min: 2,    max: 50 },
  timeLimit:        { min: 5,    max: 600 },
  pickRows:         { min: 1,    max: 10 },
  pickCols:         { min: 1,    max: 10 },
  minNumber:        { min: -1_000_000, max: 1_000_000 },
  maxNumber:        { min: -1_000_000, max: 1_000_000 },
  count:            { min: 1,    max: 100 },
  probability:      { min: 0,    max: 1_000_000 },
  pickCount:        { min: 0,    max: 100 },
  scale:            { min: 50,   max: 200 },
  maxRunsPerDonation: { min: 1,  max: 100 },
  raceDuration:     { min: 3000, max: 30000 },
  castDuration:     { min: 2000, max: 15000 },
  points:           { min: 0,    max: 100000 },
} as const

export function clampNum(v: unknown, lim: { min: number; max: number }, fallback: number): number {
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback
  return Math.min(lim.max, Math.max(lim.min, Math.trunc(n)))
}

const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(x => String(x ?? '').trim()).filter(Boolean) : []

function sanitizeGame(id: string, g: GameConfig, def: GameConfig): GameConfig {
  const out: GameConfig = { ...def, ...g }
  out.enabled          = Boolean(g.enabled ?? def.enabled)
  out.balloonThreshold = clampNum(g.balloonThreshold, LIMITS.balloonThreshold, def.balloonThreshold)
  out.chatCommand      = String(g.chatCommand ?? def.chatCommand ?? '').trim()
  if (g.weflabKeywords !== undefined) out.weflabKeywords = strArr(g.weflabKeywords)

  if ('spinDuration'    in out) out.spinDuration    = clampNum(out.spinDuration,    LIMITS.spinDuration,    Number(def.spinDuration) || 3000)
  if ('scratchDuration' in out) out.scratchDuration = clampNum(out.scratchDuration, LIMITS.scratchDuration, 3000)

  if (id === 'roulette') {
    out.items = Array.isArray(g.items) ? g.items.map(it => ({
      name:        String((it as RouletteItem)?.name ?? '').trim() || '항목',
      probability: clampNum((it as RouletteItem)?.probability, LIMITS.probability, 0),
    })) : def.items
    out.animType = out.animType === 'text' ? 'text' : 'wheel'
  }
  if (id === 'ladder') {
    out.maxParticipants = clampNum(g.maxParticipants, LIMITS.maxParticipants, 8)
    out.joinDuration    = clampNum(g.joinDuration,    LIMITS.joinDuration,    30)
    out.prizes = Array.isArray(g.prizes) ? g.prizes.map(p => ({
      name: String((p as Prize)?.name ?? '').trim() || '상품', description: String((p as Prize)?.description ?? ''),
    })) : def.prizes
  }
  if (id === 'pickboard') {
    out.pickRows = clampNum(g.pickRows, LIMITS.pickRows, 4)
    out.pickCols = clampNum(g.pickCols, LIMITS.pickCols, 5)
    out.pickItems = Array.isArray(g.pickItems) ? g.pickItems.map(p => ({
      name:        String((p as PickItem)?.name ?? '').trim() || '상품',
      description: String((p as PickItem)?.description ?? ''),
      color:       /^#[0-9a-f]{6}$/i.test(String((p as PickItem)?.color)) ? String((p as PickItem).color) : '#6B7280',
      count:       clampNum((p as PickItem)?.count, LIMITS.pickCount, 1),
    })) : def.pickItems
  }
  if (id === 'quiz') {
    out.timeLimit = clampNum(g.timeLimit, LIMITS.timeLimit, 30)
    out.questions = Array.isArray(g.questions) ? g.questions.map(q => ({
      question: String((q as QuizQuestion)?.question ?? '').trim(), answer: String((q as QuizQuestion)?.answer ?? '').trim(),
    })) : def.questions
  }
  if (id === 'slot') {
    const syms = strArr(g.symbols)
    out.symbols = syms.length >= 3 ? syms : def.symbols
  }
  if (id === 'lottery' && Array.isArray(g.prizes)) {
    out.prizes = (g.prizes as unknown[]).map(p => {
      const o = (p ?? {}) as Record<string, unknown>
      return {
        name:   String(o.name ?? '').trim() || '상품',
        prob:   clampNum(o.prob, LIMITS.probability, 0),
        color:  /^#[0-9a-f]{6}$/i.test(String(o.color)) ? String(o.color) : '#6B7280',
        detail: String(o.detail ?? ''),
        isWin:  typeof o.isWin === 'boolean' ? o.isWin : String(o.name ?? '').trim() !== '꽝',
      }
    }) as unknown as Prize[]
  }
  if (id === 'race') {
    out.joinDuration = clampNum(g.joinDuration, LIMITS.joinDuration, 20)
    out.raceDuration = clampNum(g.raceDuration, LIMITS.raceDuration, 8000)
    const racers = Array.isArray(g.racers) ? (g.racers as unknown[]).map(r => {
      const o = (r ?? {}) as Record<string, unknown>
      return { name: String(o.name ?? '').trim(), emoji: String(o.emoji ?? '').trim() || '🏃' }
    }).filter(r => r.name).slice(0, 8) : []
    out.racers = racers.length >= 2 ? racers : def.racers
  }
  if (id === 'rps') {
    out.joinDuration = clampNum(g.joinDuration, LIMITS.joinDuration, 15)
  }
  if (id === 'fish') {
    out.castDuration = clampNum(g.castDuration, LIMITS.castDuration, 4000)
    const RAR = ['common', 'uncommon', 'rare', 'legendary']
    out.fishes = Array.isArray(g.fishes) ? (g.fishes as unknown[]).map(f => {
      const o = (f ?? {}) as Record<string, unknown>
      return {
        name:        String(o.name ?? '').trim() || '물고기',
        emoji:       String(o.emoji ?? '').trim() || '🐟',
        probability: clampNum(o.probability, LIMITS.probability, 0),
        rarity:      RAR.includes(String(o.rarity)) ? String(o.rarity) : 'common',
        points:      clampNum(o.points, LIMITS.points, 1),
      }
    }) : def.fishes
  }
  if (id === 'number') {
    let min = clampNum(g.minNumber, LIMITS.minNumber, 1)
    let max = clampNum(g.maxNumber, LIMITS.maxNumber, 100)
    if (max < min) [min, max] = [max, min]
    out.minNumber = min; out.maxNumber = max
    out.count = clampNum(g.count, LIMITS.count, 1)
    out.excludeList = Array.isArray(g.excludeList)
      ? Array.from(new Set((g.excludeList as unknown[]).map(Number).filter(Number.isFinite).map(Math.trunc))).sort((a, b) => a - b)
      : []
  }
  return out
}

/** 어떤 입력이 와도 Settings 모양으로 정리 */
export function sanitizeSettings(raw: Partial<Settings> | Record<string, unknown>): Settings {
  const r = (raw ?? {}) as Partial<Settings>
  const soop = { ...DEFAULTS.soop, ...(r.soop ?? {}) }
  soop.channelId = String(soop.channelId ?? '').trim()
  soop.userId    = String(soop.userId ?? '')
  soop.token     = String(soop.token ?? '')
  soop.balloonAutoTrigger = soop.balloonAutoTrigger !== false
  soop.donationSource = (['soop', 'weflab', 'both'] as const).includes(soop.donationSource) ? soop.donationSource : 'both'
  soop.multiRun = soop.multiRun !== false
  soop.maxRunsPerDonation = clampNum(soop.maxRunsPerDonation, LIMITS.maxRunsPerDonation, 10)

  const overlay = { ...DEFAULTS.overlay, ...(r.overlay ?? {}) }
  // 포트는 범위 밖(0, 70000 등)이면 경계값이 아니라 기본값 — 빈 칸을 저장했을 때 1024 로 바뀌면 OBS 소스가 전부 끊긴다
  const portN = Number(overlay.port)
  overlay.port = Number.isInteger(portN) && portN >= LIMITS.port.min && portN <= LIMITS.port.max ? portN : DEFAULTS.overlay.port

  const ui = { ...DEFAULTS.ui, ...(r.ui ?? {}) }
  ui.scale = clampNum(ui.scale, LIMITS.scale, 100)

  const weflab = { ...DEFAULTS.weflab, ...(r.weflab ?? {}) }
  weflab.url = String(weflab.url ?? '').trim()

  const games = Object.fromEntries(
    Object.keys(DEFAULTS.games).map(k => [k, sanitizeGame(k, { ...DEFAULTS.games[k], ...(r.games?.[k] ?? {}) }, DEFAULTS.games[k])])
  )

  const u = r.user
  const user: AuthUser | null = u && typeof u === 'object' && typeof u.id === 'string' && u.id.trim()
    ? { id: u.id.trim(), name: String(u.name ?? u.id).trim(), verifiedAt: typeof u.verifiedAt === 'number' ? u.verifiedAt : undefined }
    : null

  return { user, soop, games, overlay, ui, weflab }
}

// ─── Persistence ──────────────────────────────────────────────────────────────

function getDir() {
  const dir = join(app.getPath('userData'), 'data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}
function getPath() { return join(getDir(), 'settings.json') }

/** 마지막 로드에서 파일이 깨져 기본값으로 대체됐으면 그 메시지 (렌더러에 한 번 알림) */
export let lastLoadError: string | null = null
export function takeLoadError(): string | null { const e = lastLoadError; lastLoadError = null; return e }

let cache: Settings | null = null

export function loadSettings(): Settings {
  if (cache) return cache
  const path = getPath()
  if (!existsSync(path)) { cache = sanitizeSettings(structuredClone(DEFAULTS)); return cache }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8'))
    // 자동 맞춤 도입 전 저장된 배율(기본 110)은 100으로 되돌림 — 이제 창 크기에 맞춰 자동으로 커짐
    if (raw.ui && raw.ui.autoFit === undefined) raw.ui = { ...raw.ui, scale: 100, autoFit: true }
    cache = sanitizeSettings(raw)
  } catch (err) {
    // 깨진 파일은 덮어쓰지 않고 백업으로 남긴다 — 사용자가 복구할 수 있게
    const bak = `${path}.corrupt-${Date.now()}.bak`
    try { copyFileSync(path, bak) } catch {}
    lastLoadError = `설정 파일을 읽을 수 없어 기본값으로 시작합니다. 원본은 ${bak} 에 보관했습니다. (${String(err)})`
    cache = sanitizeSettings(structuredClone(DEFAULTS))
  }
  return cache
}

/** 임시 파일에 쓴 뒤 rename — 저장 도중 꺼져도 기존 파일은 온전함 */
export function saveSettings(s: Settings): void {
  const path = getPath()
  const tmp  = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(s, null, 2), 'utf-8')
  renameSync(tmp, path)
  cache = s
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }
export type SettingsPatch = DeepPartial<Settings> & { games?: Record<string, Partial<GameConfig>> }

export function patchSettings(patch: SettingsPatch): Settings {
  const current = loadSettings()
  const merged = {
    ...current,
    ...patch,
    soop:    { ...current.soop,    ...(patch.soop    ?? {}) },
    overlay: { ...current.overlay, ...(patch.overlay ?? {}) },
    ui:      { ...current.ui,      ...(patch.ui      ?? {}) },
    weflab:  { ...current.weflab,  ...(patch.weflab  ?? {}) },
    games:   {
      ...current.games,
      ...(patch.games
        ? Object.fromEntries(Object.entries(patch.games).map(([k, v]) => [k, { ...current.games[k], ...v }]))
        : {}),
    },
  } as Settings
  const next = sanitizeSettings(merged)
  saveSettings(next)
  return next
}
