import { EventEmitter } from 'events'
import type { Settings } from '../store/settings'

// ─── Types ────────────────────────────────────────────────────────────────────

export type GameId = 'roulette' | 'ladder' | 'boss' | 'gacha' | 'quiz' |
                     'slot' | 'race' | 'rps' | 'fish' | 'lottery'

export type GameStatus = 'idle' | 'collecting' | 'running' | 'showing_result'

export interface GameResult {
  gameId:    GameId
  triggeredBy: string
  balloon:   number
  result:    string
  detail:    string
  ts:        number
}

export interface BossState {
  maxHp:     number
  currentHp: number
  alive:     boolean
}

export interface LadderState {
  participants: string[]
  maxSlots:     number
  deadline:     number    // timestamp
  prizes:       string[]
}

export interface QuizState {
  question:  string
  answer:    string
  deadline:  number
  winner:    string | null
}

export interface GameState {
  id:       GameId
  status:   GameStatus
  result:   GameResult | null
  boss?:    BossState
  ladder?:  LadderState
  quiz?:    QuizState
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weightedRandom<T extends { probability: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.probability, 0)
  let r = Math.random() * total
  for (const item of items) {
    r -= item.probability
    if (r <= 0) return item
  }
  return items[items.length - 1]
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class GameEngine extends EventEmitter {
  private states: Map<GameId, GameState> = new Map()
  private history: GameResult[] = []
  private settings!: Settings
  private quizTimer: ReturnType<typeof setTimeout> | null = null
  private ladderTimer: ReturnType<typeof setTimeout> | null = null

  // Today stats
  todayRuns     = 0
  todayBalloons = 0
  todayViewers  = new Set<string>()

  init(settings: Settings) {
    this.settings = settings
    const ids: GameId[] = ['roulette','ladder','boss','gacha','quiz','slot','race','rps','fish','lottery']
    for (const id of ids) {
      this.states.set(id, this.makeIdleState(id))
    }
  }

  updateSettings(settings: Settings) {
    this.settings = settings
  }

  private makeIdleState(id: GameId): GameState {
    const cfg = this.settings?.games[id]
    const state: GameState = { id, status: 'idle', result: null }
    if (id === 'boss' && cfg) {
      state.boss = {
        maxHp:     (cfg.maxHp as number)     ?? 10000,
        currentHp: (cfg.currentHp as number) ?? 10000,
        alive:     true,
      }
    }
    return state
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

  // ── Balloon / chat events ─────────────────────────────────────────────────

  onBalloon(username: string, amount: number) {
    this.todayBalloons += amount
    this.todayViewers.add(username)
    this.emit('stats')

    if (!this.settings.soop.balloonAutoTrigger) return

    for (const [id, cfg] of Object.entries(this.settings.games)) {
      if (!cfg.enabled) continue
      const threshold = cfg.balloonThreshold || this.settings.soop.globalThreshold
      if (amount >= threshold) {
        this.trigger(id as GameId, username, amount)
        break
      }
    }
  }

  onChat(username: string, message: string) {
    this.todayViewers.add(username)
    const msg = message.trim()

    // Check commands
    for (const [id, cfg] of Object.entries(this.settings.games)) {
      if (!cfg.enabled) continue
      if (cfg.chatCommand && msg.startsWith(cfg.chatCommand as string)) {
        if (id === 'ladder') {
          this.ladderJoin(username)
        } else if (id === 'boss') {
          this.bossDamage(username, 0, cfg.damagePerChat as number ?? 1)
        } else if (id === 'quiz') {
          this.quizAnswer(username, msg.replace(cfg.chatCommand as string, '').trim())
        } else if (this.getState(id as GameId).status === 'idle') {
          this.trigger(id as GameId, username, 0)
        }
        break
      }
    }
  }

  // ── Trigger ───────────────────────────────────────────────────────────────

  trigger(gameId: GameId, triggeredBy: string, balloon: number) {
    const state = this.getState(gameId)
    if (state.status !== 'idle') return   // already running

    this.todayRuns++
    this.emit('stats')

    switch (gameId) {
      case 'roulette': this.runRoulette(triggeredBy, balloon); break
      case 'ladder':   this.startLadder(triggeredBy, balloon); break
      case 'boss':     this.bossDamage(triggeredBy, balloon,
                         (this.settings.games.boss?.damagePerBalloon as number ?? 10) * balloon); break
      case 'gacha':    this.runGacha(triggeredBy, balloon); break
      case 'quiz':     this.startQuiz(triggeredBy, balloon); break
      case 'slot':     this.runSlot(triggeredBy, balloon); break
      case 'race':     this.runRace(triggeredBy, balloon); break
      case 'rps':      this.runRps(triggeredBy, balloon); break
      case 'fish':     this.runFish(triggeredBy, balloon); break
      case 'lottery':  this.runLottery(triggeredBy, balloon); break
    }
  }

  // ── Roulette ──────────────────────────────────────────────────────────────

  private runRoulette(by: string, balloon: number) {
    const cfg   = this.settings.games.roulette
    const items = (cfg?.items ?? []) as Array<{ name: string; probability: number }>
    if (!items.length) return

    const state = this.getState('roulette')
    state.status = 'running'
    this.emit('game:update', 'roulette', state)

    const spinMs = (cfg?.spinDuration as number) ?? 3000
    setTimeout(() => {
      const winner = weightedRandom(items)
      const result: GameResult = {
        gameId:      'roulette',
        triggeredBy: by,
        balloon,
        result:      winner.name,
        detail:      `${by}님이 "${winner.name}" 당첨!`,
        ts:          Date.now(),
      }
      this.finishGame('roulette', result)
    }, spinMs)
  }

  // ── Ladder ────────────────────────────────────────────────────────────────

  private startLadder(by: string, balloon: number) {
    const cfg      = this.settings.games.ladder
    const maxSlots = (cfg?.maxParticipants as number) ?? 8
    const joinSec  = (cfg?.joinDuration as number) ?? 30
    const prizes   = ((cfg?.prizes ?? []) as Array<{name:string}>).map(p => p.name)

    const ladderState: LadderState = {
      participants: [by],
      maxSlots,
      deadline: Date.now() + joinSec * 1000,
      prizes,
    }

    const state = this.getState('ladder')
    state.status  = 'collecting'
    state.ladder  = ladderState
    this.emit('game:update', 'ladder', state)

    this.ladderTimer = setTimeout(() => this.finishLadder(by, balloon), joinSec * 1000)
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
    const state = this.getState('ladder')
    if (!state.ladder) return

    const { participants, prizes } = state.ladder
    if (participants.length === 0) {
      state.status = 'idle'
      this.emit('game:update', 'ladder', state)
      return
    }

    // Shuffle and assign prizes
    const shuffled = [...participants].sort(() => Math.random() - 0.5)
    const assignments = shuffled.map((user, i) => ({
      user,
      prize: prizes[i] ?? `${i + 1}등`,
    }))

    const winner = assignments[0]
    const result: GameResult = {
      gameId:      'ladder',
      triggeredBy: by,
      balloon,
      result:      `${winner.user} (${winner.prize})`,
      detail:      assignments.map(a => `${a.user} → ${a.prize}`).join(' | '),
      ts:          Date.now(),
    }
    this.finishGame('ladder', result)
  }

  // ── Boss ──────────────────────────────────────────────────────────────────

  private bossDamage(by: string, balloon: number, damage: number) {
    const state = this.getState('boss')
    if (!state.boss || !state.boss.alive) return
    if (state.status === 'idle') {
      state.status = 'running'
    }

    state.boss.currentHp = Math.max(0, state.boss.currentHp - damage)
    this.emit('game:update', 'boss', state)

    // Update settings so HP persists
    if (this.settings.games.boss) {
      this.settings.games.boss.currentHp = state.boss.currentHp
    }

    if (state.boss.currentHp <= 0) {
      state.boss.alive = false
      const result: GameResult = {
        gameId:      'boss',
        triggeredBy: by,
        balloon,
        result:      '보스 클리어!',
        detail:      `보스가 처치됨! 마지막 공격: ${by}님 (${damage} 데미지)`,
        ts:          Date.now(),
      }
      this.finishGame('boss', result)
    }
  }

  resetBoss() {
    const cfg   = this.settings.games.boss
    const maxHp = (cfg?.maxHp as number) ?? 10000
    const state = this.getState('boss')
    state.status = 'idle'
    state.result = null
    state.boss   = { maxHp, currentHp: maxHp, alive: true }
    if (this.settings.games.boss) this.settings.games.boss.currentHp = maxHp
    this.emit('game:update', 'boss', state)
  }

  // ── Gacha ─────────────────────────────────────────────────────────────────

  private runGacha(by: string, balloon: number) {
    const cfg    = this.settings.games.gacha
    const grades = (cfg?.grades ?? []) as Array<{name:string;probability:number;color:string}>

    const state = this.getState('gacha')
    state.status = 'running'
    this.emit('game:update', 'gacha', state)

    setTimeout(() => {
      const grade  = weightedRandom(grades)
      const result: GameResult = {
        gameId:      'gacha',
        triggeredBy: by,
        balloon,
        result:      `${grade.name} 등급 획득!`,
        detail:      `${by}님이 [${grade.name}] 등급 당첨!`,
        ts:          Date.now(),
      }
      this.finishGame('gacha', result)
    }, 2000)
  }

  // ── Quiz ──────────────────────────────────────────────────────────────────

  private startQuiz(by: string, balloon: number) {
    const cfg       = this.settings.games.quiz
    const questions = (cfg?.questions ?? []) as Array<{question:string;answer:string}>
    if (!questions.length) return

    const q       = questions[Math.floor(Math.random() * questions.length)]
    const timeLim = (cfg?.timeLimit as number) ?? 30

    const quizState: QuizState = {
      question: q.question,
      answer:   q.answer.toLowerCase(),
      deadline: Date.now() + timeLim * 1000,
      winner:   null,
    }

    const state  = this.getState('quiz')
    state.status = 'collecting'
    state.quiz   = quizState
    this.emit('game:update', 'quiz', state)
    this.emit('quiz:question', q.question)

    this.quizTimer = setTimeout(() => {
      const result: GameResult = {
        gameId: 'quiz', triggeredBy: by, balloon,
        result: '시간 초과 - 정답 없음',
        detail: `정답: ${q.answer}`,
        ts:     Date.now(),
      }
      this.finishGame('quiz', result)
    }, timeLim * 1000)
  }

  private quizAnswer(username: string, answer: string) {
    const state = this.getState('quiz')
    if (state.status !== 'collecting' || !state.quiz) return
    if (state.quiz.winner) return

    if (answer.toLowerCase() === state.quiz.answer) {
      state.quiz.winner = username
      if (this.quizTimer) { clearTimeout(this.quizTimer); this.quizTimer = null }

      const result: GameResult = {
        gameId:      'quiz',
        triggeredBy: username,
        balloon:     0,
        result:      `${username} 정답!`,
        detail:      `정답: ${state.quiz.answer}`,
        ts:          Date.now(),
      }
      this.finishGame('quiz', result)
    }
  }

  // ── Simple games ──────────────────────────────────────────────────────────

  private runSlot(by: string, balloon: number) {
    const SYMBOLS = ['🍒', '🍋', '🍊', '⭐', '🎰', '💎']
    const delay   = 2500

    const state  = this.getState('slot')
    state.status = 'running'
    this.emit('game:update', 'slot', state)

    setTimeout(() => {
      const s = [0,1,2].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)])
      const jackpot = s[0] === s[1] && s[1] === s[2]
      const result: GameResult = {
        gameId:      'slot',
        triggeredBy: by,
        balloon,
        result:      jackpot ? 'JACKPOT! 🎉' : s.join(' '),
        detail:      jackpot ? `${by}님 잭팟!` : `${s.join(' ')} - 꽝`,
        ts:          Date.now(),
      }
      this.finishGame('slot', result)
    }, delay)
  }

  private runRace(by: string, balloon: number) {
    const ANIMALS = ['🐎','🐇','🐢','🐊','🦊','🐆']
    const state  = this.getState('race')
    state.status = 'running'
    this.emit('game:update', 'race', state)

    setTimeout(() => {
      const winner = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
      const result: GameResult = {
        gameId:      'race',
        triggeredBy: by,
        balloon,
        result:      `${winner} 1등!`,
        detail:      `${by}님이 시작한 레이스 - ${winner} 우승!`,
        ts:          Date.now(),
      }
      this.finishGame('race', result)
    }, 4000)
  }

  private runRps(by: string, balloon: number) {
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

      const result: GameResult = {
        gameId:      'rps',
        triggeredBy: by,
        balloon,
        result:      outcome,
        detail:      `스트리머: ${CHOICES[streamer]} vs 시청자: ${CHOICES[viewer]} → ${outcome}`,
        ts:          Date.now(),
      }
      this.finishGame('rps', result)
    }, 2000)
  }

  private runFish(by: string, balloon: number) {
    const FISH = [
      { name: '고등어 🐟', rarity: 'common',    prob: 50 },
      { name: '참치 🐠',   rarity: 'uncommon',  prob: 30 },
      { name: '복어 🐡',   rarity: 'rare',      prob: 15 },
      { name: '황금어 🐟✨', rarity: 'legendary', prob:  5 },
    ]
    const state  = this.getState('fish')
    state.status = 'running'
    this.emit('game:update', 'fish', state)

    setTimeout(() => {
      const catch_ = weightedRandom(FISH)
      const result: GameResult = {
        gameId:      'fish',
        triggeredBy: by,
        balloon,
        result:      catch_.name,
        detail:      `${by}님이 ${catch_.name} 낚시 성공! (${catch_.rarity})`,
        ts:          Date.now(),
      }
      this.finishGame('fish', result)
    }, 3000)
  }

  private runLottery(by: string, balloon: number) {
    const state  = this.getState('lottery')
    state.status = 'running'
    this.emit('game:update', 'lottery', state)

    setTimeout(() => {
      const nums  = Array.from({ length: 6 }, () => Math.floor(Math.random() * 45) + 1).sort((a,b) => a-b)
      const bonus = Math.floor(Math.random() * 45) + 1
      const result: GameResult = {
        gameId:      'lottery',
        triggeredBy: by,
        balloon,
        result:      nums.join(', ') + ` 보너스: ${bonus}`,
        detail:      `${by}님이 추첨한 번호: ${nums.join(', ')} + 보너스 ${bonus}`,
        ts:          Date.now(),
      }
      this.finishGame('lottery', result)
    }, 3500)
  }

  // ── Finish ────────────────────────────────────────────────────────────────

  private finishGame(id: GameId, result: GameResult) {
    const state  = this.getState(id)
    state.status = 'showing_result'
    state.result = result
    this.history.push(result)
    this.emit('game:result', id, result)
    this.emit('game:update', id, state)

    // Reset to idle after 5s (except boss - reset manually)
    if (id !== 'boss') {
      setTimeout(() => {
        const s2 = this.states.get(id)
        if (s2) {
          s2.status = 'idle'
          s2.result = null
          if (id === 'ladder') s2.ladder = undefined
          if (id === 'quiz')   s2.quiz   = undefined
          this.emit('game:update', id, s2)
        }
      }, 5000)
    }
  }
}

export const gameEngine = new GameEngine()
