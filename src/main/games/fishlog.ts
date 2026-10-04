// 낚시 누적 기록 — 시청자별로 낚은 물고기 수와 점수를 파일에 남긴다 (앱을 껐다 켜도 유지)
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import type { FishItem } from './engine'

export interface FishLogEntry {
  user:   string
  points: number
  catches: Record<string, number>   // 물고기 이름 → 마리 수
  best?:  { name: string; emoji: string; points: number }
}

export class FishLog {
  private data: Record<string, FishLogEntry> = {}
  private loaded = false
  constructor(private dirFn: () => string) {}

  private path() {
    const dir = this.dirFn()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    return join(dir, 'fishlog.json')
  }

  private load() {
    if (this.loaded) return
    this.loaded = true
    try {
      const p = this.path()
      if (existsSync(p)) this.data = JSON.parse(readFileSync(p, 'utf-8')) ?? {}
    } catch { this.data = {} }
  }

  private save() {
    const p = this.path(), tmp = `${p}.tmp`
    try { writeFileSync(tmp, JSON.stringify(this.data), 'utf-8'); renameSync(tmp, p) } catch {}
  }

  record(user: string, fish: FishItem): { count: number; totalPoints: number } {
    this.load()
    const key = user.trim().toLowerCase()
    const e = this.data[key] ?? { user, points: 0, catches: {} }
    e.user = user
    e.points += fish.points
    e.catches[fish.name] = (e.catches[fish.name] ?? 0) + 1
    if (!e.best || fish.points > e.best.points) e.best = { name: fish.name, emoji: fish.emoji, points: fish.points }
    this.data[key] = e
    this.save()
    return { count: e.catches[fish.name], totalPoints: e.points }
  }

  ranking(limit = 10): FishLogEntry[] {
    this.load()
    return Object.values(this.data).sort((a, b) => b.points - a.points).slice(0, limit)
  }

  reset() { this.load(); this.data = {}; this.save() }
}
