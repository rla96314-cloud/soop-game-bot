// 애니메이션 미리보기(/gallery) 전용 데모 — 접속마다 실제 게임 엔진을 따로 하나씩 돌려
// 가짜 시청자로 한 판씩 계속 재생한다. 방송용 엔진·기록·OBS 오버레이와는 완전히 분리.
import { GameEngine, GAME_IDS, type GameId, type GameState, type GameResult } from '../games/engine'
import { PickboardStore } from '../games/pickboard'
import { loadSettings, type Settings } from '../store/settings'

export const DEMO_GAMES = [...GAME_IDS, 'pickboard'] as const

const VIEWERS = ['별빛여우', '감자도리', '치즈냥', '멍멍이', '하늘콩', '초코칩', '새벽달']
const HANDS = ['가위', '바위', '보']
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]

/** 저장된 설정(항목·상품·심볼 등)은 그대로 쓰고, 기다리는 시간만 미리보기에 맞게 줄인다 */
function demoSettings(): Settings {
  const s = JSON.parse(JSON.stringify(loadSettings())) as Settings
  for (const g of Object.values(s.games)) g.enabled = true
  const set = (id: string, k: string, v: number) => { if (s.games[id]) s.games[id][k] = v }
  set('ladder', 'joinDuration', 8)
  if (s.games.ladder) s.games.ladder.autoReveal = true   // 미리보기는 줄을 차례대로 자동 공개
  set('race', 'joinDuration', 6)
  set('rps', 'joinDuration', 6)
  set('quiz', 'timeLimit', 10)
  return s
}

type Send = (type: string, data: unknown) => void

/** 데모 재생 시작. 반환값을 부르면 멈춘다 (WS 연결이 끊길 때) */
export function startDemo(game: string, send: Send, publicState: (s: GameState) => GameState): () => void {
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let stopped = false
  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => { timers.delete(t); if (!stopped) fn() }, ms)
    timers.add(t)
  }
  const stop = () => { stopped = true; for (const t of timers) clearTimeout(t); timers.clear() }
  const settings = demoSettings()

  if (game === 'pickboard') {
    const board = new PickboardStore()
    const round = () => {
      board.reset(settings)
      send('pickboard:state', board.toWire())
      let opened = 0
      const next = () => {
        const closed = board.get().cells.map((c, i) => (c.revealed ? -1 : i)).filter(i => i >= 0)
        if (!closed.length || opened >= 5) { later(round, 3500); return }
        board.reveal(pick(closed)); opened++
        send('pickboard:state', board.toWire())
        later(next, 3600)
      }
      later(next, 2200)
    }
    round()
    return stop
  }

  if (!(GAME_IDS as string[]).includes(game)) return stop
  const id = game as GameId
  const eng = new GameEngine()
  eng.init(settings)
  const cmd = String(settings.games[id]?.chatCommand ?? '').trim()
  const chat = (user: string, arg = '') => eng.onChat(user, arg ? `${cmd} ${arg}` : cmd)
  let started = false
  let roundNo = 0

  eng.on('game:result', (gid: GameId, r: GameResult) => { if (!stopped && gid === id) send('game:result', r) })
  eng.on('game:update', (gid: GameId, st: GameState) => {
    if (stopped || gid !== id) return
    send('game:state', publicState(st))
    if (started && st.status === 'idle') { started = false; later(round, 1800) }
  })

  const round = () => {
    roundNo++
    started = true
    const by = pick(VIEWERS)
    if (eng.trigger(id, by, id === 'ladder' || id === 'race' || id === 'rps' || id === 'quiz' ? 0 : 100) === 'rejected') {
      started = false; later(round, 4000); return
    }
    const crowd = [...VIEWERS].sort(() => Math.random() - 0.5)
    if (id === 'ladder') crowd.slice(0, 5).forEach((u, i) => later(() => chat(u), 700 + i * 900))
    if (id === 'race') {
      const n = eng.getState('race').race?.racers.length ?? 6
      crowd.forEach((u, i) => later(() => chat(u, String(1 + Math.floor(Math.random() * n))), 500 + i * 600))
    }
    if (id === 'rps') crowd.forEach((u, i) => later(() => chat(u, pick(HANDS)), 500 + i * 600))
    if (id === 'quiz') {
      // 홀수 판은 정답자, 짝수 판은 시간 초과 — 두 결과 연출을 번갈아 보여준다
      const answer = eng.getState('quiz').quiz?.displayAnswer
      if (answer && roundNo % 2 === 1) later(() => chat(crowd[0], answer), 6500)
    }
  }
  later(round, 600)
  return () => { stop(); eng.removeAllListeners() }
}
