import { EventEmitter } from 'events'
import type { Settings } from '../store/settings'
import { SLOT_DEFAULT_SYMBOLS } from '../store/settings'

// ─── Types ────────────────────────────────────────────────────────────────────

export type GameId = 'roulette' | 'ladder' | 'quiz' |
                     'slot' | 'race' | 'rps' | 'fish' | 'lottery' | 'number'

export const GAME_IDS: GameId[] = ['roulette','ladder','quiz','slot','race','rps','fish','lottery','number']

export type GameStatus = 'idle' | 'collecting' | 'running' | 'showing_result'

export interface GameResult {
  gameId:    GameId
  triggeredBy: string
  balloon:   number
  result:    string
  detail:    string
  ts:        number
}

export interface LadderRung  { row: number; leftCol: number }
export interface LadderPath { cols: number[] }  // cols[row] = column index at that row

export interface LadderData {
  rows:    number
  cols:    number
  rungs:   LadderRung[]
  paths:   LadderPath[]   // one per participant (left-to-right order)
  order:   string[]       // participant names left-to-right
  prizes:  string[]       // prize names left-to-right (bottom)
  results: Array<{ user: string; prize: string; startCol: number; endCol: number }>
}

export interface LadderState {
  participants: string[]
  maxSlots:     number
  deadline:     number    // timestamp
  joinMs:       number    // 모집 전체 시간 (오버레이 타이머 막대용)
  prizes:       string[]
  ladderData?:  LadderData   // 모집이 끝나면 채워진다 (상품은 오버레이에서 가려 둔다)
  revealed?:    number[]     // 공개된 줄 (열 번호, 공개 순서대로)
  revealing?:   { idx: number; at: number } | null   // 지금 내려가는 줄 — 오버레이는 at 기준으로 재생
}

/** 한 줄 공개 연출 길이 (오버레이 REVEAL 합계와 같아야 함). 이 동안은 다음 줄을 받지 않는다 */
export const LADDER_REVEAL_MS = 7000

export interface QuizState {
  question:  string
  answer:    string        // 정규화된 비교용 정답 (오버레이로는 내보내지 않음)
  displayAnswer: string    // 화면 표시용 원문
  deadline:  number
  winner:    string | null
}

export interface RouletteSpinState {
  winner:    string
  winnerIdx: number
  items:     Array<{ name: string; probability: number }>
  spinMs:    number
  animType:  'wheel' | 'text'
}

export interface NumberPickState {
  min:         number
  max:         number
  count:       number
  result:      number[]
  triggeredBy: string
  spinMs:      number
}

export interface SlotSpinState {
  symbols:     string[]
  jackpot:     boolean
  twoKind:     boolean
  triggeredBy: string
  spinMs:      number
  runId:       number   // 연속 실행 구분 (오버레이가 진행 중 연출을 끊고 새로 시작)
}

export interface LotteryPrize {
  name:    string
  prob:    number
  color:   string
  detail?: string
  isWin?:  boolean   // 없으면 이름이 '꽝'이 아닐 때 당첨으로 취급 (구버전 설정 호환)
}

export interface LotteryPickState {
  prize:       string
  color:       string
  detail:      string
  triggeredBy: string
  scratchMs:   number
  isWin:       boolean
}

// ── 경주 ──
export interface RaceRacer { name: string; emoji: string }
/** 주자 한 명의 진행 곡선 파라미터 — 오버레이가 같은 식(raceProgress)으로 그린다 */
export interface RaceCurve { finish: number; amp: number; freq: number; phase: number }
export interface RaceState {
  racers:    RaceRacer[]
  bets:      Record<string, number>   // 닉네임 → 주자 인덱스
  deadline:  number
  joinMs:    number
  command:   string
  raceMs?:   number
  startedAt?: number
  curves?:   RaceCurve[]
  order?:    number[]                 // 도착 순서 (주자 인덱스)
}

// ── 가위바위보 ──
export type RpsHand = 'rock' | 'paper' | 'scissors'
export interface RpsState {
  picks:     Record<string, RpsHand>
  deadline:  number
  joinMs:    number
  command:   string
  streamer?: RpsHand
  startedAt?: number
  revealMs?: number
  winners?:  string[]
  draws?:    string[]
  losers?:   string[]
}

// ── 낚시 ──
export type FishRarity = 'common' | 'uncommon' | 'rare' | 'legendary'
export interface FishItem { name: string; emoji: string; probability: number; rarity: FishRarity; points: number }
export interface FishCastState {
  triggeredBy: string
  fish:        FishItem
  castMs:      number
  startedAt:   number
  count:       number   // 이 사람이 이 물고기를 낚은 누적 횟수
  totalPoints: number   // 이 사람의 누적 점수
}
export type FishRecorder = (user: string, fish: FishItem) => { count: number; totalPoints: number }

export interface GameState {
  id:       GameId
  status:   GameStatus
  result:   GameResult | null
  queued:   number           // 대기열에 쌓인 실행 수
  ladder?:  LadderState
  quiz?:    QuizState
  roulette?: RouletteSpinState
  slot?:    SlotSpinState
  number?:  NumberPickState
  lottery?: LotteryPickState
  race?:    RaceState
  rps?:     RpsState
  fish?:    FishCastState
}

interface QueuedRun {
  gameId:      GameId
  triggeredBy: string
  balloon:     number
  quiz?:       { question: string; answer: string; timeLimit: number }   // 수동 출제 퀴즈
}

/** 무대 대기열 상한 — 게임 종류와 상관없이 한 줄이다 */
const MAX_QUEUE   = 20
const MAX_HISTORY = 1000
const RESULT_SHOW_MS = 5000

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fisher-Yates — sort(() => Math.random() - 0.5) 는 분포가 치우쳐서 쓰지 않는다 */
export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 가중 랜덤. 확률 합이 0 이하면 null (휠에 보이지 않는 칸이 뽑히는 일 방지) */
export function weightedRandom<T extends { probability: number }>(items: T[]): T | null {
  const valid = items.filter(i => Number(i.probability) > 0)
  const total = valid.reduce((s, i) => s + Number(i.probability), 0)
  if (!valid.length || total <= 0) return null
  let r = Math.random() * total
  for (const item of valid) {
    r -= Number(item.probability)
    if (r <= 0) return item
  }
  return valid[valid.length - 1]
}

/** 퀴즈 정답 비교용 정규화: 유니코드 NFC + 소문자 + 공백 제거 */
export function normalizeAnswer(s: string): string {
  return (s ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, '')
}

export function isLotteryWin(p: LotteryPrize): boolean {
  return typeof p.isWin === 'boolean' ? p.isWin : p.name.trim() !== '꽝'
}

// ── 가위바위보 ──

export const RPS_EMOJI: Record<RpsHand, string> = { rock: '✊', paper: '🖐️', scissors: '✌️' }
export const RPS_LABEL: Record<RpsHand, string> = { rock: '바위', paper: '보', scissors: '가위' }

/** 채팅 문구 → 손. 가위/바위/보, 주먹/보자기, 찌/묵/빠, 이모지, s/r/p 를 받는다 */
export function parseHand(text: string): RpsHand | null {
  const t = (text ?? '').trim().toLowerCase()
  if (!t) return null
  if (/^(가위|찌|✌|✌️|scissors?|s)$/.test(t)) return 'scissors'
  if (/^(바위|주먹|묵|✊|👊|rock|r)$/.test(t)) return 'rock'
  if (/^(보|보자기|빠|🖐|🖐️|✋|paper|p)$/.test(t)) return 'paper'
  return null
}

/** 시청자 기준 결과 */
export function rpsOutcome(viewer: RpsHand, streamer: RpsHand): 'win' | 'draw' | 'lose' {
  if (viewer === streamer) return 'draw'
  const beats: Record<RpsHand, RpsHand> = { rock: 'scissors', scissors: 'paper', paper: 'rock' }
  return beats[viewer] === streamer ? 'win' : 'lose'
}

// ── 경주 ──

/**
 * 주자별 진행 곡선 생성. 도착 순서를 먼저 균등하게 섞고(공정), 순위대로 도착 시각을 배정한 뒤
 * 흔들림(사인파)을 얹는다. 흔들림은 출발·도착 지점에서 0 이 되므로 순위가 뒤집히지 않는다.
 */
export function buildRaceCurves(n: number, rand = Math.random): { curves: RaceCurve[]; order: number[] } {
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]] }
  const curves: RaceCurve[] = new Array(n)
  order.forEach((racer, rank) => {
    const finish = n === 1 ? 0.9 : 0.78 + 0.2 * (rank / (n - 1))   // 1등 0.78, 꼴찌 0.98 (전체 시간 대비)
    curves[racer] = { finish, amp: 0.05 + rand() * 0.07, freq: 1 + rand() * 2, phase: rand() * Math.PI * 2 }
  })
  return { curves, order }
}

/** t: 0..1 (경주 전체 시간 대비) → 진행도 0..1. 오버레이 스크립트에 같은 식이 있다 */
export function raceProgress(c: RaceCurve, t: number): number {
  if (t >= c.finish) return 1
  const u = Math.max(0, t / c.finish)
  const wobble = c.amp * Math.sin(2 * Math.PI * c.freq * u + c.phase) * u * (1 - u) * 4
  return Math.min(0.995, Math.max(0, u + wobble))
}

/** "!경주 3" / "!경주 토끼" / "!경주 🐇" → 주자 인덱스 */
export function parseRacerPick(arg: string, racers: RaceRacer[]): number | null {
  const a = (arg ?? '').trim()
  if (!a) return null
  const n = Number(a.replace(/번$/, ''))
  if (Number.isInteger(n) && n >= 1 && n <= racers.length) return n - 1
  const low = a.toLowerCase()
  const idx = racers.findIndex(r => r.name.toLowerCase() === low || r.emoji === a)
  return idx >= 0 ? idx : null
}

// ── 낚시 ──

export const FISH_RARITY_LABEL: Record<FishRarity, string> = { common: '일반', uncommon: '고급', rare: '희귀', legendary: '레전드' }

/**
 * 사다리 생성 (순수 함수 — 테스트용으로 분리)
 *  - 상품이 참가자보다 적으면 "N등" 으로 채우고, 채운 칸은 순위 맨 뒤
 *  - 상품이 참가자보다 많으면 앞 순위부터 남긴다 (1등이 판에서 빠지지 않게)
 *  - 결과는 원래 상품 순서(인덱스)로 정렬 → results[0] 이 항상 최상위 상품 당첨자
 */
export function buildLadder(participants: string[], prizes: string[], rand = Math.random): LadderData {
  const cols = participants.length
  const rows = Math.max(8, cols * 2)
  const rungs: LadderRung[] = []

  for (let r = 0; r < rows; r++) {
    const used = new Set<number>()
    for (let c = 0; c < cols - 1; c++) {
      if (!used.has(c) && !used.has(c + 1) && rand() < 0.35) {
        rungs.push({ row: r, leftCol: c })
        used.add(c); used.add(c + 1)
      }
    }
  }

  // 상위 순위부터 cols 개만 사용, 모자라면 채움 (채움 칸의 rank 는 원래 상품 뒤)
  const ranked: Array<{ name: string; rank: number }> = prizes.slice(0, cols).map((name, rank) => ({ name, rank }))
  while (ranked.length < cols) ranked.push({ name: `${ranked.length + 1}등`, rank: ranked.length })

  // 바닥 위치 섞기
  const order = ranked.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const bottom = order.map(i => ranked[i])          // bottom[col] = 그 칸의 상품

  const paths: LadderPath[] = participants.map((_, startCol) => {
    const colPath: number[] = [startCol]
    let cur = startCol
    for (let r = 0; r < rows; r++) {
      const goRight = rungs.some(rg => rg.row === r && rg.leftCol === cur)
      const goLeft  = rungs.some(rg => rg.row === r && rg.leftCol === cur - 1)
      if (goRight)      cur++
      else if (goLeft)  cur--
      colPath.push(cur)
    }
    return { cols: colPath }
  })

  const results = participants.map((user, i) => {
    const endCol = paths[i].cols[rows]
    return { user, prize: bottom[endCol].name, rank: bottom[endCol].rank, startCol: i, endCol }
  })
  results.sort((a, b) => a.rank - b.rank)

  return {
    rows, cols, rungs, paths,
    order:   participants,
    prizes:  bottom.map(b => b.name),
    results: results.map(({ user, prize, startCol, endCol }) => ({ user, prize, startCol, endCol })),
  }
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class GameEngine extends EventEmitter {
  private states: Map<GameId, GameState> = new Map()
  // 무대는 하나 — 어떤 게임이든 진행 중이면 나머지는 종류 상관없이 한 줄로 기다린다 (오버레이가 겹치지 않게)
  private stage: QueuedRun[] = []
  private history: GameResult[] = []
  private settings!: Settings
  private quizTimer: ReturnType<typeof setTimeout> | null = null
  private ladderTimer: ReturnType<typeof setTimeout> | null = null
  private phaseTimers: Map<GameId, ReturnType<typeof setTimeout>> = new Map()
  private slotRunId = 0
  private ladderRun: { by: string; balloon: number } | null = null
  private fishRecorder: FishRecorder = (_u, f) => ({ count: 1, totalPoints: f.points })

  /** 낚시 누적 기록 저장소 연결 (메인에서 fishlog 주입 — 엔진은 파일을 모른다) */
  setFishRecorder(fn: FishRecorder) { this.fishRecorder = fn }

  private setPhaseTimer(id: GameId, fn: () => void, ms: number) {
    const prev = this.phaseTimers.get(id)
    if (prev) clearTimeout(prev)
    this.phaseTimers.set(id, setTimeout(() => { this.phaseTimers.delete(id); fn() }, ms))
  }

  // Today stats
  todayRuns     = 0
  todayBalloons = 0
  todayViewers  = new Set<string>()

  init(settings: Settings) {
    this.settings = settings
    for (const id of GAME_IDS) this.states.set(id, this.makeIdleState(id))
    this.stage = []
  }

  updateSettings(settings: Settings) {
    this.settings = settings
  }

  private makeIdleState(id: GameId): GameState {
    return { id, status: 'idle', result: null, queued: 0 }
  }

  getState(id: GameId): GameState {
    return this.states.get(id) ?? this.makeIdleState(id)
  }

  getAllStates(): GameState[] {
    return Array.from(this.states.values())
  }

  getHistory(limit = 50): GameResult[] {
    return this.history.slice(-limit).reverse()
  }

  private emitStats() { this.emit('stats') }

  // ── Balloon / chat events ─────────────────────────────────────────────────

  /** 통계만 반영 (게이트에서 중복으로 걸러진 후원도 집계에는 1번만 들어와야 하므로 호출측이 조절) */
  recordBalloon(username: string, amount: number) {
    this.todayBalloons += amount
    this.todayViewers.add(username)
    this.emitStats()
  }

  /** 게임 트리거용 별풍선. 임계값이 가장 높은 게임 하나를 골라 (개수 ÷ 임계값) 회 대기열에 넣는다 */
  onBalloon(username: string, amount: number) {
    if (!this.settings.soop.balloonAutoTrigger) return

    let best: { id: GameId; threshold: number } | null = null
    for (const [id, cfg] of Object.entries(this.settings.games)) {
      if (!cfg.enabled || !GAME_IDS.includes(id as GameId)) continue
      const threshold = Number(cfg.balloonThreshold) || 0
      if (threshold <= 0) continue   // 0 = 이 게임은 별풍선으로 발동하지 않음
      if (amount >= threshold && (!best || threshold > best.threshold)) {
        best = { id: id as GameId, threshold }
      }
    }
    if (!best) return

    const multi   = this.settings.soop.multiRun !== false
    const maxRuns = Math.max(1, Number(this.settings.soop.maxRunsPerDonation) || 10)
    const runs    = multi ? Math.min(maxRuns, Math.floor(amount / best.threshold)) : 1
    for (let i = 0; i < runs; i++) this.trigger(best.id, username, i === 0 ? amount : 0)
  }

  onChat(username: string, message: string) {
    this.todayViewers.add(username)
    const msg = message.trim()

    for (const [id, cfg] of Object.entries(this.settings.games)) {
      if (!GAME_IDS.includes(id as GameId)) continue
      const cmd = (cfg.chatCommand as string | undefined)?.trim()
      if (!cmd || !msg.startsWith(cmd)) continue
      // 참가·정답 명령은 모집 중인 판이 있으면 게임 활성화 여부와 상관없이 받는다 (수동 출제 퀴즈 포함)
      const arg = msg.slice(cmd.length).trim()
      if (id === 'ladder') {
        this.ladderJoin(username)
      } else if (id === 'quiz') {
        this.quizAnswer(username, arg)
      } else if (id === 'rps') {
        this.rpsChat(username, arg, cfg.enabled)
      } else if (id === 'race') {
        this.raceChat(username, arg, cfg.enabled)
      } else if (cfg.enabled) {
        this.trigger(id as GameId, username, 0)
      }
      break
    }
  }

  // ── Trigger / queue ───────────────────────────────────────────────────────

  /** 어떤 게임이든 모집·진행·결과 표시 중이면 무대가 찬 것 */
  isStageBusy(): boolean {
    for (const s of this.states.values()) if (s.status !== 'idle') return true
    return false
  }

  /** 무대 대기열 (앞이 다음 차례) */
  getStageQueue(): Array<{ gameId: GameId; triggeredBy: string; balloon: number }> {
    return this.stage.map(({ gameId, triggeredBy, balloon }) => ({ gameId, triggeredBy, balloon }))
  }

  /** 게임별 queued 숫자를 무대 대기열에서 다시 센다 (바뀐 게임만 알림) */
  private syncQueued(...changed: GameId[]) {
    for (const id of new Set(changed)) {
      const s = this.getState(id)
      s.queued = this.stage.filter(r => r.gameId === id).length
      this.emit('game:update', id, s)
    }
    this.emit('stage', this.getStageQueue())
  }

  /**
   * 게임 실행 요청. 무대가 비어 있으면 즉시 실행, 다른 게임이라도 진행 중이면 한 줄로 기다린다.
   * 반환: 'started' | 'queued' | 'rejected'
   */
  trigger(gameId: GameId, triggeredBy: string, balloon: number): 'started' | 'queued' | 'rejected' {
    return this.enqueue({ gameId, triggeredBy, balloon })
  }

  private enqueue(run: QueuedRun): 'started' | 'queued' | 'rejected' {
    if (this.isStageBusy()) {
      if (this.stage.length >= MAX_QUEUE) {
        this.emit('log', `[${run.gameId}] 대기열이 가득 차서 ${run.triggeredBy}님의 실행을 버렸습니다`)
        return 'rejected'
      }
      this.stage.push(run)
      this.syncQueued(run.gameId)
      return 'queued'
    }
    return this.startNow(run) ? 'started' : 'rejected'
  }

  private startNow({ gameId, triggeredBy: by, balloon, quiz }: QueuedRun): boolean {
    let ok = false
    switch (gameId) {
      case 'roulette': ok = this.runRoulette(by, balloon); break
      case 'ladder':   ok = this.startLadder(by, balloon); break
      case 'quiz':     ok = quiz ? this.beginQuiz(quiz.question, quiz.answer, quiz.timeLimit, by, 0) : this.startQuiz(by, balloon); break
      case 'slot':     ok = this.runSlot(by, balloon); break
      case 'race':     ok = this.runRace(by, balloon); break
      case 'rps':      ok = this.runRps(by, balloon); break
      case 'fish':     ok = this.runFish(by, balloon); break
      case 'lottery':  ok = this.runLottery(by, balloon); break
      case 'number':   ok = this.runNumber(by, balloon); break
    }
    if (ok) { this.todayRuns++; this.emitStats() }
    return ok
  }

  /** 무대가 비었을 때 호출 — 종류 상관없이 맨 앞 것부터 올린다 */
  private drainStage() {
    while (this.stage.length && !this.isStageBusy()) {
      const next = this.stage.shift()!
      this.syncQueued(next.gameId)
      if (this.startNow(next)) return
      // 실행 거부(설정 비어 있음 등)면 다음 항목으로
    }
  }

  /** 그 게임의 대기 건만 줄에서 뺀다 (다른 게임 대기는 유지) */
  clearQueue(gameId: GameId) {
    this.stage = this.stage.filter(r => r.gameId !== gameId)
    this.syncQueued(gameId)
  }

  /** 대기열 전부 비우기 */
  clearStage() {
    const ids = this.stage.map(r => r.gameId)
    this.stage = []
    this.syncQueued(...ids)
  }

  // ── Roulette ──────────────────────────────────────────────────────────────

  private runRoulette(by: string, balloon: number): boolean {
    const cfg   = this.settings.games.roulette
    const items = (cfg?.items ?? []) as Array<{ name: string; probability: number }>
    const winner = weightedRandom(items)
    if (!winner) { this.emit('log', '룰렛 항목이 없거나 확률 합이 0입니다'); return false }

    const winnerIdx = items.indexOf(winner)
    const spinMs    = Number(cfg?.spinDuration) || 3000
    const animType  = (cfg?.animType as 'wheel' | 'text') ?? 'wheel'

    const state = this.getState('roulette')
    state.status   = 'running'
    state.roulette = { winner: winner.name, winnerIdx, items, spinMs, animType }
    this.emit('game:update', 'roulette', state)

    setTimeout(() => {
      this.finishGame('roulette', {
        gameId: 'roulette', triggeredBy: by, balloon,
        result: winner.name,
        detail: `${by}님이 "${winner.name}" 당첨!`,
        ts:     Date.now(),
      })
    }, spinMs)
    return true
  }

  // ── Ladder ────────────────────────────────────────────────────────────────

  private startLadder(by: string, balloon: number): boolean {
    const cfg      = this.settings.games.ladder
    const maxSlots = Math.max(2, Number(cfg?.maxParticipants) || 8)
    const joinSec  = Math.max(5, Number(cfg?.joinDuration) || 30)
    const prizes   = ((cfg?.prizes ?? []) as Array<{name:string}>).map(p => p.name)

    const state = this.getState('ladder')
    state.status = 'collecting'
    state.ladder = {
      // 별풍선으로 시작한 후원자만 자동 참가. 스트리머 버튼·위플랩·채팅 명령 시작은 빈 목록
      participants: balloon > 0 ? [by] : [],
      maxSlots,
      deadline: Date.now() + joinSec * 1000,
      joinMs:   joinSec * 1000,
      prizes,
    }
    this.emit('game:update', 'ladder', state)

    if (this.ladderTimer) clearTimeout(this.ladderTimer)
    this.ladderTimer = setTimeout(() => this.finishLadder(by, balloon), joinSec * 1000)
    return true
  }

  private ladderJoin(username: string) {
    const state = this.getState('ladder')
    if (state.status !== 'collecting' || !state.ladder) return
    if (state.ladder.participants.includes(username)) return
    if (state.ladder.participants.length >= state.ladder.maxSlots) return

    state.ladder.participants.push(username)
    this.emit('game:update', 'ladder', state)
  }

  private finishLadder(by: string, balloon: number) {
    this.ladderTimer = null
    const state = this.getState('ladder')
    if (!state.ladder) return

    const { participants, prizes } = state.ladder
    if (participants.length === 0) {
      state.status = 'idle'
      state.ladder = undefined
      this.emit('game:update', 'ladder', state)
      this.drainStage()
      return
    }

    // 판만 깔고 멈춘다 — 스트리머가 줄을 하나씩 골라 공개한다 (자동 진행이면 차례대로)
    state.ladder.ladderData = buildLadder(participants, prizes)
    state.ladder.revealed = []
    state.ladder.revealing = null
    state.status = 'running'
    this.ladderRun = { by, balloon }
    this.emit('game:update', 'ladder', state)
    if (this.settings.games.ladder?.autoReveal) this.setPhaseTimer('ladder', () => this.ladderRevealNext(), 1800)
  }

  /** 줄 하나 공개 (열 번호). 다른 줄이 내려가는 중이거나 이미 연 줄이면 false */
  ladderReveal(idx: number): boolean {
    const state = this.getState('ladder')
    const l = state.ladder
    if (state.status !== 'running' || !l?.ladderData) return false
    const n = l.ladderData.order.length
    const revealed = l.revealed ?? (l.revealed = [])
    if (!Number.isInteger(idx) || idx < 0 || idx >= n || revealed.includes(idx)) return false
    if (l.revealing && Date.now() - l.revealing.at < LADDER_REVEAL_MS) return false
    revealed.push(idx)
    l.revealing = { idx, at: Date.now() }
    this.emit('game:update', 'ladder', state)
    if (revealed.length >= n) this.setPhaseTimer('ladder', () => this.finishLadderGame(), LADDER_REVEAL_MS + 800)
    else if (this.settings.games.ladder?.autoReveal) this.setPhaseTimer('ladder', () => this.ladderRevealNext(), LADDER_REVEAL_MS + 1200)
    return true
  }

  /** 아직 안 연 줄 중 왼쪽부터 하나 */
  ladderRevealNext(): boolean {
    const l = this.getState('ladder').ladder
    if (!l?.ladderData) return false
    const idx = l.ladderData.order.findIndex((_, i) => !(l.revealed ?? []).includes(i))
    return idx >= 0 && this.ladderReveal(idx)
  }

  /** 남은 줄을 한 번에 공개하고 결과 확정 */
  ladderRevealAll(): boolean {
    if (this.getState('ladder').status !== 'running') return false
    this.finishLadderGame()
    return true
  }

  private finishLadderGame() {
    const state = this.getState('ladder')
    const ld = state.ladder?.ladderData
    if (state.status !== 'running' || !ld) return
    const prev = this.phaseTimers.get('ladder')
    if (prev) { clearTimeout(prev); this.phaseTimers.delete('ladder') }
    const { by, balloon } = this.ladderRun ?? { by: '스트리머', balloon: 0 }
    const winner = ld.results[0]
    this.finishGame('ladder', {
      gameId: 'ladder', triggeredBy: by, balloon,
      result: `${winner.user} (${winner.prize})`,
      detail: ld.results.map(r => `${r.user} → ${r.prize}`).join(' | '),
      ts:     Date.now(),
    })
  }

  // ── Quiz ──────────────────────────────────────────────────────────────────

  private startQuiz(by: string, balloon: number): boolean {
    const cfg       = this.settings.games.quiz
    const questions = ((cfg?.questions ?? []) as Array<{question:string;answer:string}>)
      .filter(q => q.question?.trim() && q.answer?.trim())
    if (!questions.length) { this.emit('log', '퀴즈 문항이 없습니다'); return false }

    const q       = questions[Math.floor(Math.random() * questions.length)]
    const timeLim = Math.max(5, Number(cfg?.timeLimit) || 30)
    return this.beginQuiz(q.question.trim(), q.answer.trim(), timeLim, by, balloon)
  }

  // 수동 퀴즈 (스트리머가 직접 문제/정답 지정) — 다른 게임이 돌고 있으면 무대 줄에 선다
  startManualQuiz(question: string, answer: string, timeLimit: number, by = '스트리머'): boolean {
    const q = question.trim(), a = answer.trim()
    if (!q || !a) return false
    return this.enqueue({ gameId: 'quiz', triggeredBy: by, balloon: 0, quiz: { question: q, answer: a, timeLimit: Math.max(5, Number(timeLimit) || 30) } }) !== 'rejected'
  }

  private beginQuiz(question: string, answer: string, timeLim: number, by: string, balloon: number): boolean {
    const state  = this.getState('quiz')
    state.status = 'collecting'
    state.quiz   = {
      question,
      answer:        normalizeAnswer(answer),
      displayAnswer: answer,
      deadline:      Date.now() + timeLim * 1000,
      winner:        null,
    }
    this.emit('game:update', 'quiz', state)
    this.emit('quiz:question', question)

    if (this.quizTimer) clearTimeout(this.quizTimer)
    this.quizTimer = setTimeout(() => {
      this.quizTimer = null
      this.finishGame('quiz', {
        gameId: 'quiz', triggeredBy: by, balloon,
        result: '시간 초과 - 정답 없음',
        detail: `정답: ${answer}`,
        ts:     Date.now(),
      })
    }, timeLim * 1000)
    return true
  }

  private quizAnswer(username: string, answer: string) {
    const state = this.getState('quiz')
    if (state.status !== 'collecting' || !state.quiz) return
    if (state.quiz.winner) return

    if (normalizeAnswer(answer) === state.quiz.answer) {
      state.quiz.winner = username
      if (this.quizTimer) { clearTimeout(this.quizTimer); this.quizTimer = null }

      this.finishGame('quiz', {
        gameId: 'quiz', triggeredBy: username, balloon: 0,
        result: `${username} 정답!`,
        detail: `정답: ${state.quiz.displayAnswer}`,
        ts:     Date.now(),
      })
    }
  }

  // ── Simple games ──────────────────────────────────────────────────────────

  private runSlot(by: string, balloon: number): boolean {
    const cfg     = this.settings.games.slot
    const custom  = (cfg?.symbols as string[] | undefined)?.filter(Boolean)
    const symbols = custom && custom.length >= 3 ? custom : [...SLOT_DEFAULT_SYMBOLS]
    const spinMs  = Number(cfg?.spinDuration) || 3000

    // Pre-determine result so overlay can animate to it
    const s       = [0,1,2].map(() => symbols[Math.floor(Math.random() * symbols.length)])
    const jackpot = s[0] === s[1] && s[1] === s[2]
    const twoKind = !jackpot && (s[0] === s[1] || s[1] === s[2] || s[0] === s[2])

    const state  = this.getState('slot')
    state.status = 'running'
    state.slot   = { symbols: s, jackpot, twoKind, triggeredBy: by, spinMs, runId: ++this.slotRunId }
    this.emit('game:update', 'slot', state)

    setTimeout(() => {
      let outcome = s.join(' ')
      if (jackpot)  outcome = `JACKPOT! ${s[0]}${s[1]}${s[2]} 🎉`
      else if (twoKind) outcome = `${s.join(' ')} ✨`

      this.finishGame('slot', {
        gameId: 'slot', triggeredBy: by, balloon,
        result: outcome,
        detail: jackpot  ? `${by}님 잭팟!`
              : twoKind  ? `${by}님 - ${s.join(' ')} (2개 일치!)`
              :            `${by}님 - ${s.join(' ')} 꽝`,
        ts: Date.now(),
      })
    }, spinMs)
    return true
  }

  // ── Race (경주: 시청자가 1등을 맞힌다) ─────────────────────────────────────

  private raceRacers(): RaceRacer[] {
    const list = (this.settings.games.race?.racers as RaceRacer[] | undefined)?.filter(r => r?.name) ?? []
    return list.length >= 2 ? list.slice(0, 8) : [
      { name: '말', emoji: '🐎' }, { name: '토끼', emoji: '🐇' }, { name: '거북이', emoji: '🐢' },
      { name: '악어', emoji: '🐊' }, { name: '여우', emoji: '🦊' }, { name: '치타', emoji: '🐆' },
    ]
  }

  private raceChat(username: string, arg: string, enabled: boolean) {
    const state = this.getState('race')
    if (state.status === 'idle' && enabled) {
      if (this.trigger('race', username, 0) !== 'started') return
    }
    if (state.status !== 'collecting' || !state.race) return
    const pick = parseRacerPick(arg, state.race.racers)
    if (pick === null) return
    state.race.bets[username] = pick          // 마감 전에는 바꿀 수 있음
    this.emit('game:update', 'race', state)
  }

  private runRace(by: string, balloon: number): boolean {
    const cfg     = this.settings.games.race
    const joinSec = Math.max(5, Number(cfg?.joinDuration) || 20)
    const raceMs  = Math.max(3000, Number(cfg?.raceDuration) || 8000)
    const state   = this.getState('race')
    state.status  = 'collecting'
    state.race    = {
      racers:   this.raceRacers(),
      bets:     {},
      deadline: Date.now() + joinSec * 1000,
      joinMs:   joinSec * 1000,
      command:  String(cfg?.chatCommand ?? '!경주'),
    }
    this.emit('game:update', 'race', state)

    this.setPhaseTimer('race', () => {
      const s = this.getState('race')
      if (!s.race) return
      const { curves, order } = buildRaceCurves(s.race.racers.length)
      s.status = 'running'
      s.race.curves = curves
      s.race.order = order
      s.race.raceMs = raceMs
      s.race.startedAt = Date.now()
      this.emit('game:update', 'race', s)

      this.setPhaseTimer('race', () => {
        const r = s.race!
        const winner = r.racers[order[0]]
        const hits = Object.entries(r.bets).filter(([, i]) => i === order[0]).map(([u]) => u)
        const betCount = Object.keys(r.bets).length
        this.finishGame('race', {
          gameId: 'race', triggeredBy: by, balloon,
          result: `${winner.emoji} ${winner.name} 1등!`,
          detail: betCount === 0
            ? `순위: ${order.map(i => r.racers[i].emoji).join(' ')} · 예측 참가자 없음`
            : `적중 ${hits.length}/${betCount}명${hits.length ? ` — ${hits.slice(0, 20).join(', ')}${hits.length > 20 ? ' …' : ''}` : ''} · 순위: ${order.map(i => r.racers[i].emoji).join(' ')}`,
          ts: Date.now(),
        })
      }, raceMs + 600)
    }, joinSec * 1000)
    return true
  }

  // ── RPS (가위바위보: 채팅으로 손을 내고 스트리머와 대결) ───────────────────

  private rpsChat(username: string, arg: string, enabled: boolean) {
    const state = this.getState('rps')
    const hand = parseHand(arg)
    if (state.status === 'idle' && enabled) {
      if (this.trigger('rps', username, 0) !== 'started') return
    }
    if (state.status !== 'collecting' || !state.rps || !hand) return
    state.rps.picks[username] = hand          // 마감 전에는 바꿀 수 있음
    this.emit('game:update', 'rps', state)
  }

  private runRps(by: string, balloon: number): boolean {
    const cfg     = this.settings.games.rps
    const joinSec = Math.max(5, Number(cfg?.joinDuration) || 15)
    const state   = this.getState('rps')
    state.status  = 'collecting'
    state.rps     = {
      picks: {}, deadline: Date.now() + joinSec * 1000, joinMs: joinSec * 1000,
      command: String(cfg?.chatCommand ?? '!묵찌빠'),
    }
    this.emit('game:update', 'rps', state)

    this.setPhaseTimer('rps', () => {
      const s = this.getState('rps')
      if (!s.rps) return
      const hands: RpsHand[] = ['rock', 'paper', 'scissors']
      const streamer = hands[Math.floor(Math.random() * 3)]
      const winners: string[] = [], draws: string[] = [], losers: string[] = []
      for (const [u, h] of Object.entries(s.rps.picks)) {
        const o = rpsOutcome(h, streamer)
        ;(o === 'win' ? winners : o === 'draw' ? draws : losers).push(u)
      }
      const revealMs = 2200
      Object.assign(s.rps, { streamer, winners, draws, losers, startedAt: Date.now(), revealMs })
      s.status = 'running'
      this.emit('game:update', 'rps', s)

      this.setPhaseTimer('rps', () => {
        const total = winners.length + draws.length + losers.length
        this.finishGame('rps', {
          gameId: 'rps', triggeredBy: by, balloon,
          result: `스트리머 ${RPS_EMOJI[streamer]} ${RPS_LABEL[streamer]}`
                + (total ? ` — 승 ${winners.length} · 무 ${draws.length} · 패 ${losers.length}` : ' — 참가자 없음'),
          detail: winners.length
            ? `이긴 시청자: ${winners.slice(0, 30).join(', ')}${winners.length > 30 ? ' …' : ''}`
            : total ? '스트리머 승! 이긴 시청자가 없습니다' : `채팅으로 ${s.rps!.command} 가위/바위/보 를 입력해 참가하세요`,
          ts: Date.now(),
        })
      }, revealMs)
    }, joinSec * 1000)
    return true
  }

  // ── Fish (낚시: 물고기를 낚아 점수를 모은다, 누적 기록) ─────────────────────

  private runFish(by: string, balloon: number): boolean {
    const cfg    = this.settings.games.fish
    const saved  = (cfg?.fishes as FishItem[] | undefined) ?? []
    const fishes: FishItem[] = saved.length ? saved : [
      { name: '고등어', emoji: '🐟', probability: 50, rarity: 'common',    points: 1 },
      { name: '참치',   emoji: '🐠', probability: 30, rarity: 'uncommon',  points: 3 },
      { name: '복어',   emoji: '🐡', probability: 15, rarity: 'rare',      points: 10 },
      { name: '황금어', emoji: '🐉', probability:  5, rarity: 'legendary', points: 50 },
    ]
    const fish = weightedRandom(fishes)
    if (!fish) { this.emit('log', '낚시 물고기 목록이 없거나 확률 합이 0입니다'); return false }
    const castMs = Math.max(2000, Number(cfg?.castDuration) || 4000)

    const { count, totalPoints } = this.fishRecorder(by, fish)
    const state  = this.getState('fish')
    state.status = 'running'
    state.fish   = { triggeredBy: by, fish, castMs, startedAt: Date.now(), count, totalPoints }
    this.emit('game:update', 'fish', state)

    this.setPhaseTimer('fish', () => {
      const label = FISH_RARITY_LABEL[fish.rarity] ?? fish.rarity
      this.finishGame('fish', {
        gameId: 'fish', triggeredBy: by, balloon,
        result: `${fish.emoji} ${fish.name}`,
        detail: `${by}님이 ${fish.name} 낚시 성공! (${label}, +${fish.points}점) · 누적 ${count}마리 · 총 ${totalPoints}점`,
        ts: Date.now(),
      })
    }, castMs)
    return true
  }

  private runLottery(by: string, balloon: number): boolean {
    const cfg = this.settings.games.lottery
    const saved = cfg?.prizes as unknown as LotteryPrize[] | undefined
    const prizes: LotteryPrize[] = saved?.length
      ? saved
      : [
          { name: '꽝',              prob: 55, color: '#9CA3AF', detail: '다음엔 행운이 찾아올 거예요!', isWin: false },
          { name: '별풍선 10개',     prob: 25, color: '#F97316', detail: '소소한 행운!' },
          { name: '별풍선 50개',     prob: 12, color: '#10B981', detail: '행운이 찾아왔어요!' },
          { name: '별풍선 200개',    prob: 6,  color: '#8B5CF6', detail: '대박 행운!' },
          { name: '별풍선 500개!',   prob: 2,  color: '#EF4444', detail: '초대박!!!' },
        ]
    const scratchMs = Number(cfg?.scratchDuration) || 3000

    const picked = weightedRandom(prizes.map(p => ({ ...p, probability: Number(p.prob) })))
    if (!picked) { this.emit('log', '복권 상품이 없거나 확률 합이 0입니다'); return false }

    const state     = this.getState('lottery')
    state.status    = 'running'
    state.lottery   = {
      prize:       picked.name,
      color:       picked.color,
      detail:      picked.detail ?? '',
      triggeredBy: by,
      scratchMs,
      isWin:       isLotteryWin(picked),
    }
    this.emit('game:update', 'lottery', state)

    setTimeout(() => {
      this.finishGame('lottery', {
        gameId: 'lottery', triggeredBy: by, balloon,
        result: picked.name,
        detail: `${by}님의 복권 결과: ${picked.name}`,
        ts:     Date.now(),
      })
    }, scratchMs + 5000)
    return true
  }

  private runNumber(by: string, balloon: number): boolean {
    const cfg     = this.settings.games.number
    const min     = Math.trunc(Number(cfg?.minNumber) || 1)
    const max     = Math.trunc(Number(cfg?.maxNumber) || 100)
    const count   = Math.max(1, Math.trunc(Number(cfg?.count) || 1))
    const exclude = new Set(((cfg?.excludeList as number[]) ?? []).map(Number))
    const spinMs  = Number(cfg?.spinDuration) || 3000

    if (max < min || max - min > 1_000_000) { this.emit('log', `숫자 추첨 범위가 잘못되었습니다 (${min}~${max})`); return false }

    // Build available pool
    const pool: number[] = []
    for (let i = min; i <= max; i++) if (!exclude.has(i)) pool.push(i)
    if (!pool.length) { this.emit('log', '숫자 추첨 풀이 비어 있습니다'); return false }

    const results = shuffle(pool).slice(0, Math.min(count, pool.length))

    const state  = this.getState('number')
    state.status = 'running'
    state.number = { min, max, count, result: results, triggeredBy: by, spinMs }
    this.emit('game:update', 'number', state)

    setTimeout(() => {
      const resultStr = results.join(', ')
      this.finishGame('number', {
        gameId: 'number', triggeredBy: by, balloon,
        result: resultStr,
        detail: `${by}님 추첨 결과: ${resultStr}  (범위 ${min}~${max})`,
        ts:     Date.now(),
      })
    }, spinMs)
    return true
  }

  // ── Finish ────────────────────────────────────────────────────────────────

  private finishGame(id: GameId, result: GameResult) {
    const state  = this.getState(id)
    state.status = 'showing_result'
    state.result = result
    this.history.push(result)
    if (this.history.length > MAX_HISTORY) this.history.splice(0, this.history.length - MAX_HISTORY)
    this.emit('game:result', id, result)
    this.emit('game:update', id, state)

    setTimeout(() => {
      const s2 = this.states.get(id)
      if (!s2) return
      s2.status = 'idle'
      s2.result = null
      s2.roulette = undefined; s2.ladder = undefined; s2.quiz = undefined
      s2.slot = undefined; s2.number = undefined; s2.lottery = undefined
      s2.race = undefined; s2.rps = undefined; s2.fish = undefined
      this.emit('game:update', id, s2)
      this.drainStage()
    }, RESULT_SHOW_MS)
  }
}

export const gameEngine = new GameEngine()
