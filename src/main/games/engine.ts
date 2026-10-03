import { EventEmitter } from 'events'
import type { Settings } from '../store/settings'

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
  ladderData?:  LadderData   // populated after game finishes
}

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
}

interface QueuedRun { triggeredBy: string; balloon: number }

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
  private queues: Map<GameId, QueuedRun[]> = new Map()
  private history: GameResult[] = []
  private settings!: Settings
  private quizTimer: ReturnType<typeof setTimeout> | null = null
  private ladderTimer: ReturnType<typeof setTimeout> | null = null
  private slotRunId = 0

  // Today stats
  todayRuns     = 0
  todayBalloons = 0
  todayViewers  = new Set<string>()

  init(settings: Settings) {
    this.settings = settings
    for (const id of GAME_IDS) {
      this.states.set(id, this.makeIdleState(id))
      this.queues.set(id, [])
    }
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
      if (id === 'ladder') {
        this.ladderJoin(username)
      } else if (id === 'quiz') {
        this.quizAnswer(username, msg.slice(cmd.length).trim())
      } else if (cfg.enabled) {
        this.trigger(id as GameId, username, 0)
      }
      break
    }
  }

  // ── Trigger / queue ───────────────────────────────────────────────────────

  /**
   * 게임 실행 요청. 대기 중이면 즉시 실행, 진행 중이면 대기열에 넣는다.
   * 반환: 'started' | 'queued' | 'rejected'
   */
  trigger(gameId: GameId, triggeredBy: string, balloon: number): 'started' | 'queued' | 'rejected' {
    const state = this.getState(gameId)
    if (state.status !== 'idle') {
      const q = this.queues.get(gameId)!
      if (q.length >= MAX_QUEUE) {
        this.emit('log', `[${gameId}] 대기열이 가득 차서 ${triggeredBy}님의 실행을 버렸습니다`)
        return 'rejected'
      }
      q.push({ triggeredBy, balloon })
      state.queued = q.length
      this.emit('game:update', gameId, state)
      return 'queued'
    }
    return this.startNow(gameId, triggeredBy, balloon) ? 'started' : 'rejected'
  }

  private startNow(gameId: GameId, by: string, balloon: number): boolean {
    let ok = false
    switch (gameId) {
      case 'roulette': ok = this.runRoulette(by, balloon); break
      case 'ladder':   ok = this.startLadder(by, balloon); break
      case 'quiz':     ok = this.startQuiz(by, balloon); break
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

  private drainQueue(gameId: GameId) {
    const q = this.queues.get(gameId)!
    while (q.length) {
      const next = q.shift()!
      this.getState(gameId).queued = q.length
      if (this.startNow(gameId, next.triggeredBy, next.balloon)) return
      // 실행 거부(설정 비어 있음 등)면 다음 항목으로
    }
  }

  clearQueue(gameId: GameId) {
    this.queues.set(gameId, [])
    const s = this.getState(gameId)
    s.queued = 0
    this.emit('game:update', gameId, s)
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
      this.drainQueue('ladder')
      return
    }

    const ladderData = buildLadder(participants, prizes)
    state.ladder.ladderData = ladderData

    const winner = ladderData.results[0]
    this.finishGame('ladder', {
      gameId: 'ladder', triggeredBy: by, balloon,
      result: `${winner.user} (${winner.prize})`,
      detail: ladderData.results.map(r => `${r.user} → ${r.prize}`).join(' | '),
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

  // 수동 퀴즈 (스트리머가 직접 문제/정답 지정)
  startManualQuiz(question: string, answer: string, timeLimit: number, by = '스트리머'): boolean {
    const state = this.getState('quiz')
    if (state.status !== 'idle') return false
    const q = question.trim(), a = answer.trim()
    if (!q || !a) return false
    const ok = this.beginQuiz(q, a, Math.max(5, Number(timeLimit) || 30), by, 0)
    if (ok) { this.todayRuns++; this.emitStats() }
    return ok
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
    const symbols = custom && custom.length >= 3 ? custom : ['🍒', '🍋', '🍊', '⭐', '🎰', '💎']
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

  private runRace(by: string, balloon: number): boolean {
    const ANIMALS = ['🐎','🐇','🐢','🐊','🦊','🐆']
    const state  = this.getState('race')
    state.status = 'running'
    this.emit('game:update', 'race', state)

    setTimeout(() => {
      const winner = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
      this.finishGame('race', {
        gameId: 'race', triggeredBy: by, balloon,
        result: `${winner} 1등!`,
        detail: `${by}님이 시작한 레이스 - ${winner} 우승!`,
        ts:     Date.now(),
      })
    }, 4000)
    return true
  }

  private runRps(by: string, balloon: number): boolean {
    const CHOICES = ['✊ 주먹', '✌️ 가위', '🖐️ 보']
    const state  = this.getState('rps')
    state.status = 'running'
    this.emit('game:update', 'rps', state)

    setTimeout(() => {
      const streamer = Math.floor(Math.random() * 3)
      const viewer   = Math.floor(Math.random() * 3)
      let outcome: string
      if (streamer === viewer) outcome = '무승부'
      else if ((streamer - viewer + 3) % 3 === 1) outcome = '스트리머 승'
      else outcome = '시청자 승'

      this.finishGame('rps', {
        gameId: 'rps', triggeredBy: by, balloon,
        result: outcome,
        detail: `스트리머: ${CHOICES[streamer]} vs 시청자: ${CHOICES[viewer]} → ${outcome}`,
        ts:     Date.now(),
      })
    }, 2000)
    return true
  }

  private runFish(by: string, balloon: number): boolean {
    const FISH = [
      { name: '고등어 🐟',   rarity: 'common',    probability: 50 },
      { name: '참치 🐠',     rarity: 'uncommon',  probability: 30 },
      { name: '복어 🐡',     rarity: 'rare',      probability: 15 },
      { name: '황금어 🐟✨', rarity: 'legendary', probability:  5 },
    ]
    const state  = this.getState('fish')
    state.status = 'running'
    this.emit('game:update', 'fish', state)

    setTimeout(() => {
      const catch_ = weightedRandom(FISH)!
      this.finishGame('fish', {
        gameId: 'fish', triggeredBy: by, balloon,
        result: catch_.name,
        detail: `${by}님이 ${catch_.name} 낚시 성공! (${catch_.rarity})`,
        ts:     Date.now(),
      })
    }, 3000)
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
      this.emit('game:update', id, s2)
      this.drainQueue(id)
    }, RESULT_SHOW_MS)
  }
}

export const gameEngine = new GameEngine()
