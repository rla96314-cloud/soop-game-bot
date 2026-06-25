import { EventEmitter } from 'events'
import type { Settings } from '../store/settings'

// ─── Types ────────────────────────────────────────────────────────────────────

export type GameId = 'roulette' | 'ladder' | 'boss' | 'quiz' |
                     'slot' | 'race' | 'rps' | 'fish' | 'lottery' | 'number'

export type GameStatus = 'idle' | 'collecting' | 'running' | 'showing_result'

export interface GameResult {
  gameId:    GameId
  triggeredBy: string
  balloon:   number
  result:    string
  detail:    string
  ts:        number
}

export interface BossParticipant {
  totalDamage:     number
  attackCount:     number
  critCount:       number
  pendingBalloons: number
}

export interface BossRollResult {
  user:       string
  roll:       number      // 1~12
  damage:     number
  isCritical: boolean
  ts:         number
}

export interface BossLootItem {
  name:        string
  description: string
}

export interface BossLootResult {
  user:             string
  item:             BossLootItem
  contributionRate: number
}

export interface BossState {
  alive:            boolean
  maxHp:            number
  currentHp:        number
  bossName:         string
  damagePerDot:     number
  critChance:       number
  critEnabled:      boolean
  critMultiplier:   number
  balloonThreshold: number
  phase2HpPercent:  number
  participants:     Record<string, BossParticipant>
  lastRoll?:        BossRollResult
  lootResults?:     BossLootResult[]
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
  prizes:       string[]
  ladderData?:  LadderData   // populated after game finishes
}

export interface QuizState {
  question:  string
  answer:    string
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
}

export interface LotteryPrize {
  name:    string
  prob:    number
  color:   string
  detail?: string
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
  boss?:    BossState
  ladder?:  LadderState
  quiz?:    QuizState
  roulette?: RouletteSpinState
  slot?:    SlotSpinState
  number?:  NumberPickState
  lottery?: LotteryPickState
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
    const ids: GameId[] = ['roulette','ladder','boss','quiz','slot','race','rps','fish','lottery','number']
    for (const id of ids) {
      this.states.set(id, this.makeIdleState(id))
    }
  }

  updateSettings(settings: Settings) {
    this.settings = settings
  }

  private makeIdleState(id: GameId): GameState {
    const cfg   = this.settings?.games[id]
    const state: GameState = { id, status: 'idle', result: null }
    if (id === 'boss' && cfg) {
      const maxHp = (cfg.maxHp as number) ?? 100000
      state.boss = {
        alive:            true,
        maxHp,
        currentHp:        maxHp,
        bossName:         (cfg.bossName         as string)  ?? '보스',
        damagePerDot:     (cfg.damagePerDot     as number)  ?? 100,
        critChance:       (cfg.critChance        as number)  ?? 0.15,
        critEnabled:      (cfg.critEnabled       as boolean) !== false,
        critMultiplier:   (cfg.critMultiplier    as number)  ?? 2,
        balloonThreshold: (cfg.balloonThreshold  as number)  ?? 100,
        participants:     {},
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

    // ── 보스전: 특정 갯수 별풍선 → 자동 시작 + 즉시 주사위 ──────────────
    const bossCfg       = this.settings.games.boss
    const bossEnabled   = bossCfg?.enabled !== false
    const bossThreshold = (bossCfg?.balloonThreshold as number) ?? 100

    if (bossEnabled && amount === bossThreshold) {
      const bs = this.getState('boss')
      if (bs.status === 'idle') this.startBossRaid()
      const bs2 = this.getState('boss')
      if (bs2.status === 'running' && bs2.boss?.alive) {
        bs2.boss.participants[username] ??= { totalDamage: 0, attackCount: 0, critCount: 0, pendingBalloons: 0 }
        this.bossRollDice(username, bs2)
        return  // 보스가 트리거 처리 — 다른 게임 중복 발동 방지
      }
    }

    if (!this.settings.soop.balloonAutoTrigger) return

    for (const [id, cfg] of Object.entries(this.settings.games)) {
      if (id === 'boss') continue
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
          const bossState = this.getState('boss')
          if (bossState.status === 'running' && bossState.boss?.alive) {
            this.bossRollDice(username, bossState)
          }
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
      case 'boss':     this.startBossRaid(); break

      case 'quiz':     this.startQuiz(triggeredBy, balloon); break
      case 'slot':     this.runSlot(triggeredBy, balloon); break
      case 'race':     this.runRace(triggeredBy, balloon); break
      case 'rps':      this.runRps(triggeredBy, balloon); break
      case 'fish':     this.runFish(triggeredBy, balloon); break
      case 'lottery':  this.runLottery(triggeredBy, balloon); break
      case 'number':   this.runNumber(triggeredBy, balloon); break
    }
  }

  // ── Roulette ──────────────────────────────────────────────────────────────

  private runRoulette(by: string, balloon: number) {
    const cfg   = this.settings.games.roulette
    const items = (cfg?.items ?? []) as Array<{ name: string; probability: number }>
    if (!items.length) return

    const winner    = weightedRandom(items)
    const winnerIdx = items.indexOf(winner)
    const spinMs    = (cfg?.spinDuration as number) ?? 3000
    const animType  = (cfg?.animType as 'wheel' | 'text') ?? 'wheel'

    const state = this.getState('roulette')
    state.status   = 'running'
    state.roulette = { winner: winner.name, winnerIdx, items, spinMs, animType }
    this.emit('game:update', 'roulette', state)

    setTimeout(() => {
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

    const ladderData = this.buildLadder(participants, prizes)
    state.ladder.ladderData = ladderData

    const winner = ladderData.results[0]
    const result: GameResult = {
      gameId:      'ladder',
      triggeredBy: by,
      balloon,
      result:      `${winner.user} (${winner.prize})`,
      detail:      ladderData.results.map(r => `${r.user} → ${r.prize}`).join(' | '),
      ts:          Date.now(),
    }
    this.finishGame('ladder', result)
  }

  private buildLadder(participants: string[], prizes: string[]): LadderData {
    const cols   = participants.length
    const rows   = Math.max(8, cols * 2)   // more rungs as more people join
    const rungs: LadderRung[] = []

    // Generate rungs: for each row, place rungs randomly (no two share a column)
    for (let r = 0; r < rows; r++) {
      const used = new Set<number>()
      for (let c = 0; c < cols - 1; c++) {
        if (!used.has(c) && !used.has(c + 1) && Math.random() < 0.35) {
          rungs.push({ row: r, leftCol: c })
          used.add(c)
          used.add(c + 1)
        }
      }
    }

    // Pad prizes list
    const paddedPrizes = prizes.slice()
    while (paddedPrizes.length < cols) paddedPrizes.push(`${paddedPrizes.length + 1}등`)

    // Shuffle prize positions at bottom
    const prizeOrder = [...paddedPrizes].sort(() => Math.random() - 0.5).slice(0, cols)

    // Compute each participant's path
    const paths: LadderPath[] = participants.map((_, startCol) => {
      const colPath: number[] = [startCol]
      let cur = startCol
      for (let r = 0; r < rows; r++) {
        // Check if rung goes right (cur → cur+1)
        const goRight = rungs.some(rg => rg.row === r && rg.leftCol === cur)
        // Check if rung goes left (cur-1 → cur)
        const goLeft  = rungs.some(rg => rg.row === r && rg.leftCol === cur - 1)
        if (goRight)      cur++
        else if (goLeft)  cur--
        colPath.push(cur)
      }
      return { cols: colPath }
    })

    const results = participants.map((user, i) => {
      const endCol = paths[i].cols[rows]
      return { user, prize: prizeOrder[endCol] ?? `${endCol + 1}등`, startCol: i, endCol }
    })

    // Sort results by prize order (first prize = winner)
    results.sort((a, b) => prizes.indexOf(a.prize) - prizes.indexOf(b.prize))

    return { rows, cols, rungs, paths, order: participants, prizes: prizeOrder, results }
  }

  // ── Boss Raid ─────────────────────────────────────────────────────────────

  startBossRaid() {
    const state = this.getState('boss')
    if (state.status !== 'idle') return   // already running

    const cfg   = this.settings.games.boss
    const maxHp = (cfg?.maxHp as number) ?? 100000
    state.status = 'running'
    state.boss   = {
      alive:            true,
      maxHp,
      currentHp:        maxHp,
      bossName:         (cfg?.bossName          as string)  ?? '보스',
      damagePerDot:     (cfg?.damagePerDot      as number)  ?? 100,
      critChance:       (cfg?.critChance         as number)  ?? 0.15,
      critEnabled:      (cfg?.critEnabled        as boolean) !== false,
      critMultiplier:   (cfg?.critMultiplier     as number)  ?? 2,
      balloonThreshold: (cfg?.balloonThreshold   as number)  ?? 100,
      phase2HpPercent:  (cfg?.phase2HpPercent    as number)  ?? 50,
      participants:     {},
    }
    this.emit('game:update', 'boss', state)
  }

  private bossRollDice(user: string, state: GameState) {
    if (!state.boss?.alive) return

    const roll         = Math.floor(Math.random() * 12) + 1
    let   damage       = roll * state.boss.damagePerDot
    const isCritical   = state.boss.critEnabled && Math.random() < state.boss.critChance
    if (isCritical) damage = Math.round(damage * state.boss.critMultiplier)

    state.boss.currentHp = Math.max(0, state.boss.currentHp - damage)

    const p = state.boss.participants[user]
    if (p) {
      p.totalDamage  += damage
      p.attackCount  += 1
      if (isCritical) p.critCount++
    }

    state.boss.lastRoll = { user, roll, damage, isCritical, ts: Date.now() }
    this.emit('game:update', 'boss', state)

    if (state.boss.currentHp <= 0) {
      state.boss.alive = false
      this.defeatBoss(user, state)
    }
  }

  private defeatBoss(lastUser: string, state: GameState) {
    if (!state.boss) return

    const cfg       = this.settings.games.boss
    const lootItems = (cfg?.lootItems as BossLootItem[]) ?? []
    const loot      = this.drawBossLoot(state.boss.participants, lootItems)

    state.boss.lootResults = loot

    const totalDamage = Object.values(state.boss.participants)
      .reduce((s, p) => s + p.totalDamage, 0)

    // Fire-and-forget Google Sheets webhook
    const webhookUrl = (cfg as Record<string, unknown>)?.sheetsWebhookUrl as string
    if (webhookUrl) {
      this.postRaidToSheets(webhookUrl, state.boss, loot).catch(() => {})
    }

    const result: GameResult = {
      gameId:      'boss',
      triggeredBy: lastUser,
      balloon:     0,
      result:      '보스 처치!',
      detail:      `총 데미지: ${totalDamage.toLocaleString()} | 참여자: ${Object.keys(state.boss.participants).length}명`,
      ts:          Date.now(),
    }
    this.finishGame('boss', result)

    // 30초 후 자동 idle 리셋 — 다음 별풍선 트리거로 새 보스 시작 가능
    setTimeout(() => {
      const bs = this.states.get('boss')
      if (bs && bs.status === 'showing_result') this.resetBoss()
    }, 30000)
  }

  private async postRaidToSheets(url: string, boss: BossState, loot: BossLootResult[]) {
    const totalDmg = Object.values(boss.participants).reduce((s, p) => s + p.totalDamage, 0)
    const participants = Object.entries(boss.participants)
      .filter(([, p]) => p.totalDamage > 0)
      .sort((a, b) => b[1].totalDamage - a[1].totalDamage)
      .map(([user, p]) => ({
        user,
        totalDamage:      p.totalDamage,
        attackCount:      p.attackCount,
        critCount:        p.critCount,
        contributionRate: totalDmg > 0 ? +(p.totalDamage / totalDmg * 100).toFixed(1) : 0,
      }))

    const payload = {
      bossName:    boss.bossName,
      maxHp:       boss.maxHp,
      raidedAt:    new Date().toISOString(),
      participants,
      lootResults: loot.map((r, i) => ({
        rank:             i + 1,
        user:             r.user,
        item:             r.item.name,
        description:      r.item.description ?? '',
        contributionRate: +r.contributionRate.toFixed(1),
      })),
    }

    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
  }

  private drawBossLoot(
    participants: Record<string, BossParticipant>,
    lootItems:   BossLootItem[],
  ): BossLootResult[] {
    if (!lootItems.length) return []

    const entries = Object.entries(participants)
      .filter(([, p]) => p.totalDamage > 0)
      .map(([user, p]) => ({ user, weight: p.totalDamage }))

    if (!entries.length) return []

    const totalWeight = entries.reduce((s, e) => s + e.weight, 0)

    return lootItems.map(item => {
      let r      = Math.random() * totalWeight
      let winner = entries[entries.length - 1]
      for (const e of entries) {
        r -= e.weight
        if (r <= 0) { winner = e; break }
      }
      return {
        user:             winner.user,
        item,
        contributionRate: (winner.weight / totalWeight) * 100,
      }
    })
  }

  resetBoss() {
    const state  = this.getState('boss')
    state.status = 'idle'
    state.result = null
    state.boss   = undefined
    const idle   = this.makeIdleState('boss')
    state.boss   = idle.boss
    this.emit('game:update', 'boss', state)
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

  // 수동 퀴즈 (스트리머가 직접 문제/정답 지정)
  startManualQuiz(question: string, answer: string, timeLimit: number, by = '스트리머'): boolean {
    const state = this.getState('quiz')
    if (state.status !== 'idle') return false

    this.todayRuns++
    this.emit('stats')

    const quizState: QuizState = {
      question,
      answer:   answer.toLowerCase().trim(),
      deadline: Date.now() + timeLimit * 1000,
      winner:   null,
    }

    state.status = 'collecting'
    state.quiz   = quizState
    this.emit('game:update', 'quiz', state)
    this.emit('quiz:question', question)

    this.quizTimer = setTimeout(() => {
      const result: GameResult = {
        gameId: 'quiz', triggeredBy: by, balloon: 0,
        result: '시간 초과 - 정답 없음',
        detail: `정답: ${answer}`,
        ts:     Date.now(),
      }
      this.finishGame('quiz', result)
    }, timeLimit * 1000)

    return true
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
    const cfg     = this.settings.games.slot
    const symbols = ((cfg?.symbols as string[])?.length >= 3 ? cfg.symbols : null) as string[] | null
                 ?? ['🍒', '🍋', '🍊', '⭐', '🎰', '💎']
    const spinMs  = (cfg?.spinDuration as number) ?? 3000

    // Pre-determine result so overlay can animate to it
    const s       = [0,1,2].map(() => symbols[Math.floor(Math.random() * symbols.length)])
    const jackpot = s[0] === s[1] && s[1] === s[2]
    const twoKind = !jackpot && (s[0] === s[1] || s[1] === s[2] || s[0] === s[2])

    const state  = this.getState('slot')
    state.status = 'running'
    state.slot   = { symbols: s, jackpot, twoKind, triggeredBy: by, spinMs }
    this.emit('game:update', 'slot', state)

    setTimeout(() => {
      let outcome = s.join(' ')
      if (jackpot)  outcome = `JACKPOT! ${s[0]}${s[1]}${s[2]} 🎉`
      else if (twoKind) outcome = `${s.join(' ')} ✨`

      const result: GameResult = {
        gameId:      'slot',
        triggeredBy: by,
        balloon,
        result:      outcome,
        detail:      jackpot    ? `${by}님 잭팟!`
                   : twoKind   ? `${by}님 - ${s.join(' ')} (2개 일치!)`
                   :             `${by}님 - ${s.join(' ')} 꽝`,
        ts:          Date.now(),
      }
      this.finishGame('slot', result)
    }, spinMs)
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
    const cfg = this.settings.games.lottery
    const prizes = (cfg?.prizes as LotteryPrize[])?.length
      ? (cfg.prizes as LotteryPrize[])
      : [
          { name: '꽝',              prob: 55, color: '#9CA3AF', detail: '다음엔 행운이 찾아올 거예요!' },
          { name: '별풍선 10개',     prob: 25, color: '#F97316', detail: '소소한 행운!' },
          { name: '별풍선 50개',     prob: 12, color: '#10B981', detail: '행운이 찾아왔어요!' },
          { name: '별풍선 200개',    prob: 6,  color: '#8B5CF6', detail: '대박 행운!' },
          { name: '별풍선 500개!',   prob: 2,  color: '#EF4444', detail: '초대박!!!' },
        ]
    const scratchMs = (cfg?.scratchDuration as number) ?? 3000

    const total  = prizes.reduce((s, p) => s + p.prob, 0)
    let r        = Math.random() * total
    let picked   = prizes[prizes.length - 1]
    for (const p of prizes) { r -= p.prob; if (r <= 0) { picked = p; break } }

    const state     = this.getState('lottery')
    state.status    = 'running'
    state.lottery   = {
      prize:       picked.name,
      color:       picked.color,
      detail:      picked.detail ?? '',
      triggeredBy: by,
      scratchMs,
      isWin:       picked.name !== '꽝',
    }
    this.emit('game:update', 'lottery', state)

    setTimeout(() => {
      const result: GameResult = {
        gameId:      'lottery',
        triggeredBy: by,
        balloon,
        result:      picked.name,
        detail:      `${by}님의 복권 결과: ${picked.name}`,
        ts:          Date.now(),
      }
      this.finishGame('lottery', result)
    }, scratchMs + 5000)
  }

  private runNumber(by: string, balloon: number) {
    const cfg     = this.settings.games.number
    const min     = (cfg?.minNumber  as number)   ?? 1
    const max     = (cfg?.maxNumber  as number)   ?? 100
    const count   = (cfg?.count      as number)   ?? 1
    const exclude = (cfg?.excludeList as number[]) ?? []
    const spinMs  = (cfg?.spinDuration as number)  ?? 3000

    // Build available pool
    const pool: number[] = []
    for (let i = min; i <= max; i++) {
      if (!exclude.includes(i)) pool.push(i)
    }

    // Fisher-Yates pick
    const results: number[] = []
    const bag = [...pool]
    for (let i = 0; i < Math.min(count, bag.length); i++) {
      const idx = Math.floor(Math.random() * (bag.length - i))
      ;[bag[i], bag[idx + i]] = [bag[idx + i], bag[i]]
      results.push(bag[i])
    }

    const state  = this.getState('number')
    state.status = 'running'
    state.number = { min, max, count, result: results, triggeredBy: by, spinMs }
    this.emit('game:update', 'number', state)

    setTimeout(() => {
      const resultStr = results.join(', ')
      const result: GameResult = {
        gameId:      'number',
        triggeredBy: by,
        balloon,
        result:      resultStr,
        detail:      `${by}님 추첨 결과: ${resultStr}  (범위 ${min}~${max})`,
        ts:          Date.now(),
      }
      this.finishGame('number', result)
    }, spinMs)
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
          if (id === 'roulette') s2.roulette = undefined
          if (id === 'ladder')  s2.ladder   = undefined
          if (id === 'quiz')    s2.quiz     = undefined
          if (id === 'slot')    s2.slot     = undefined
          if (id === 'number')  s2.number   = undefined
          this.emit('game:update', id, s2)
        }
      }, 5000)
    }
  }
}

export const gameEngine = new GameEngine()
