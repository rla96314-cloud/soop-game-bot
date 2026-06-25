import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

export interface RouletteItem { name: string; probability: number }
export interface QuizQuestion { question: string; answer: string }
export interface Prize        { name: string; description: string }
export interface PickItem     { name: string; description: string; color: string; count: number }
export interface BossLootItem { name: string; description: string }

export interface GameConfig {
  enabled:          boolean
  balloonThreshold: number
  chatCommand:      string
  // roulette
  items?:        RouletteItem[]
  spinDuration?: number
  animType?:     'wheel' | 'text'
  // ladder
  maxParticipants?: number
  joinDuration?:   number
  prizes?:         Prize[]
  // boss
  maxHp?:             number
  currentHp?:         number
  damagePerBalloon?:  number
  damagePerChat?:     number
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

export interface WeflabTrigger { keyword: string }

export interface Settings {
  user?: { id: string; name: string } | null
  soop: {
    channelId:          string
    userId:             string
    token:              string
    simulationMode:     boolean
    balloonAutoTrigger: boolean
    globalThreshold:    number
  }
  games:   Record<string, GameConfig>
  overlay: { port: number; theme: string }
  weflab: {
    enabled:  boolean
    url:      string
    triggers: WeflabTrigger[]
  }
}

const DEFAULTS: Settings = {
  soop: {
    channelId:          '',
    userId:             '',
    token:              '',
    simulationMode:     true,
    balloonAutoTrigger: true,
    globalThreshold:    50,
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
    boss: {
      enabled: true, balloonThreshold: 100, chatCommand: '',
      bossName:        '보스',
      maxHp:           100000,
      damagePerDot:    100,
      critChance:      0.15,
      critEnabled:     true,
      critMultiplier:  2,
      lootItems: [
        { name: '1등 상품', description: '치킨 쿠폰'  },
        { name: '2등 상품', description: '음료 쿠폰'  },
        { name: '3등 상품', description: '간식 쿠폰'  },
      ] as BossLootItem[],
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
    race:    { enabled: false, balloonThreshold:   0, chatCommand: '!경주'    },
    rps:     { enabled: false, balloonThreshold:   0, chatCommand: '!묵찌빠'  },
    fish:    { enabled: false, balloonThreshold:   0, chatCommand: '!낚시'    },
    lottery: { enabled: false, balloonThreshold:   0, chatCommand: '!복권'    },
    number:  {
      enabled: false, balloonThreshold: 0, chatCommand: '!추첨',
      minNumber: 1, maxNumber: 100, count: 1,
      spinDuration: 3000,
      excludeList: [] as number[],
    },
  },
  overlay: { port: 3939, theme: 'purple' },
  weflab:  { enabled: false, url: '', triggers: [] },
}

function getPath() {
  const dir = join(app.getPath('userData'), 'data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'settings.json')
}

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(readFileSync(getPath(), 'utf-8'))
    return {
      ...DEFAULTS,
      ...raw,
      soop:    { ...DEFAULTS.soop,    ...(raw.soop    ?? {}) },
      overlay: { ...DEFAULTS.overlay, ...(raw.overlay ?? {}) },
      weflab:  { ...DEFAULTS.weflab,  ...(raw.weflab  ?? {}) },
      games: Object.fromEntries(
        Object.keys(DEFAULTS.games).map(k => [
          k, { ...DEFAULTS.games[k], ...(raw.games?.[k] ?? {}) }
        ])
      ),
    }
  } catch {
    return structuredClone(DEFAULTS)
  }
}

export function saveSettings(s: Settings): void {
  writeFileSync(getPath(), JSON.stringify(s, null, 2), 'utf-8')
}

export function patchSettings(patch: Partial<Settings>): Settings {
  const current = loadSettings()
  const next: Settings = {
    ...current,
    ...patch,
    soop:    { ...current.soop,    ...(patch.soop    ?? {}) },
    overlay: { ...current.overlay, ...(patch.overlay ?? {}) },
    weflab:  { ...current.weflab,  ...(patch.weflab  ?? {}) },
    games:   {
      ...current.games,
      ...(patch.games
        ? Object.fromEntries(
            Object.entries(patch.games).map(([k, v]) => [
              k, { ...current.games[k], ...v }
            ])
          )
        : {}),
    },
  }
  saveSettings(next)
  return next
}
