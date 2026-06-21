import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

export interface RouletteItem { name: string; probability: number }
export interface GachaGrade  { name: string; probability: number; color: string }
export interface QuizQuestion { question: string; answer: string }
export interface Prize        { name: string; description: string }

export interface GameConfig {
  enabled:          boolean
  balloonThreshold: number
  chatCommand:      string
  // roulette
  items?:      RouletteItem[]
  spinDuration?: number
  // ladder
  maxParticipants?: number
  joinDuration?:   number
  prizes?:         Prize[]
  // boss
  maxHp?:             number
  currentHp?:         number
  damagePerBalloon?:  number
  damagePerChat?:     number
  // gacha
  grades?: GachaGrade[]
  // quiz
  timeLimit?: number
  questions?: QuizQuestion[]
  // slot / race / rps / fish / lottery
  [key: string]: unknown
}

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
      enabled: true, balloonThreshold: 0, chatCommand: '!공격',
      maxHp: 10000, currentHp: 10000,
      damagePerBalloon: 10, damagePerChat: 1,
    },
    gacha: {
      enabled: true, balloonThreshold: 30, chatCommand: '!뽑기',
      grades: [
        { name: '레전드', probability:  1, color: '#F59E0B' },
        { name: '영웅',   probability:  5, color: '#8B5CF6' },
        { name: '희귀',   probability: 20, color: '#3B82F6' },
        { name: '일반',   probability: 74, color: '#6B7280' },
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
    slot:    { enabled: false, balloonThreshold: 100, chatCommand: '!슬롯'    },
    race:    { enabled: false, balloonThreshold:   0, chatCommand: '!경주'    },
    rps:     { enabled: false, balloonThreshold:   0, chatCommand: '!묵찌빠'  },
    fish:    { enabled: false, balloonThreshold:   0, chatCommand: '!낚시'    },
    lottery: { enabled: false, balloonThreshold:   0, chatCommand: '!복권'    },
  },
  overlay: { port: 3939, theme: 'purple' },
}

function getPath() {
  const dir = join(app.getPath('userData'), 'data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'settings.json')
}

export function loadSettings(): Settings {
  try {
    const raw = readFileSync(getPath(), 'utf-8')
    return { ...DEFAULTS, ...JSON.parse(raw) }
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
