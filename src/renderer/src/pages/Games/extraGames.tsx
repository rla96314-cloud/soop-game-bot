// 경주 · 가위바위보 · 낚시 — 항목 편집기와 진행 패널
import { useEffect, useState } from 'react'
import styles from './Games.module.css'
import NumberField from '../../components/NumberField'

export interface RaceRacer { name: string; emoji: string }
export type FishRarity = 'common' | 'uncommon' | 'rare' | 'legendary'
export interface FishItem { name: string; emoji: string; probability: number; rarity: FishRarity; points: number }

type GameState = { status: string; [k: string]: unknown }
type El = Record<string, (...args: never[]) => unknown>
const electron = () => (window as unknown as { electron?: El }).electron

const RARITY_LABEL: Record<FishRarity, string> = { common: '일반', uncommon: '고급', rare: '희귀', legendary: '레전드' }
const RARITY_COLOR: Record<FishRarity, string> = { common: '#8A94A6', uncommon: '#12A866', rare: '#2F6BFF', legendary: '#F2A600' }
const HAND: Record<string, string> = { rock: '✊ 바위', paper: '🖐️ 보', scissors: '✌️ 가위' }

function useCountdown(deadline: number | undefined, active: boolean) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick(t => t + 1), 500)
    return () => clearInterval(id)
  }, [active])
  return deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0
}

// ── 편집기 ────────────────────────────────────────────────────────────────────

/** 경주 주자 편집 (2~8명) */
export function RaceEditor({ racers: init, onSave }: { racers: RaceRacer[]; onSave: (v: RaceRacer[]) => void }) {
  const [racers, setRacers] = useState<RaceRacer[]>(init)
  const commit = (next: RaceRacer[]) => { setRacers(next); onSave(next) }
  const setField = (i: number, key: keyof RaceRacer, val: string) => {
    const next = racers.map((r, idx) => idx === i ? { ...r, [key]: val } : r)
    setRacers(next); return next
  }
  return (
    <div className={styles.listEditor}>
      <div className={styles.listHeader}>
        <span className={styles.listTitle}>경주 주자 ({racers.length}/8)</span>
        <button className={styles.addBtn} disabled={racers.length >= 8}
          onClick={() => commit([...racers, { name: `주자${racers.length + 1}`, emoji: '🏃' }])}>+ 주자 추가</button>
      </div>
      {racers.map((r, i) => (
        <div key={i} className={styles.listRow}>
          <span style={{ width: 28, fontWeight: 900, textAlign: 'center' }}>{i + 1}</span>
          <input className={styles.listInput} style={{ width: 64, textAlign: 'center', fontSize: 20 }} value={r.emoji}
            onChange={e => setField(i, 'emoji', e.target.value)} onBlur={() => onSave(racers)} title="이모지" />
          <input className={styles.listInput} style={{ flex: 1 }} value={r.name} placeholder="이름"
            onChange={e => setField(i, 'name', e.target.value)} onBlur={() => onSave(racers)} />
          <button className={styles.delBtn} disabled={racers.length <= 2} onClick={() => commit(racers.filter((_, idx) => idx !== i))}>✕</button>
        </div>
      ))}
      <div className="field-hint">시청자는 채팅에 <b>명령어 + 번호</b>(예: !경주 2) 또는 이름·이모지로 1등을 예측합니다. 1등은 매번 공정하게 무작위로 정해집니다.</div>
    </div>
  )
}

/** 낚시 물고기 편집 */
export function FishEditor({ fishes: init, onSave }: { fishes: FishItem[]; onSave: (v: FishItem[]) => void }) {
  const [fishes, setFishes] = useState<FishItem[]>(init)
  const commit = (next: FishItem[]) => { setFishes(next); onSave(next) }
  const setField = <K extends keyof FishItem>(i: number, key: K, val: FishItem[K]) => {
    const next = fishes.map((f, idx) => idx === i ? { ...f, [key]: val } : f)
    setFishes(next); return next
  }
  const total = fishes.reduce((s, f) => s + (f.probability || 0), 0)
  return (
    <div className={styles.listEditor}>
      <div className={styles.listHeader}>
        <span className={styles.listTitle}>물고기 목록</span>
        <span className={`${styles.totalBadge} ${total !== 100 ? styles.totalWarn : ''}`}>합계 {total}%</span>
        <button className={styles.addBtn} onClick={() => commit([...fishes, { name: '새 물고기', emoji: '🐟', probability: 5, rarity: 'common', points: 1 }])}>+ 추가</button>
      </div>
      <div className={styles.listHead4}>
        <span style={{ width: 56 }}>이모지</span>
        <span style={{ flex: 1 }}>이름</span>
        <span style={{ width: 86 }}>등급</span>
        <span style={{ width: 64, textAlign: 'right' }}>확률(%)</span>
        <span style={{ width: 64, textAlign: 'right' }}>점수</span>
        <span style={{ width: 32 }} />
      </div>
      {fishes.map((f, i) => (
        <div key={i} className={styles.listRow}>
          <input className={styles.listInput} style={{ width: 56, textAlign: 'center', fontSize: 20 }} value={f.emoji}
            onChange={e => setField(i, 'emoji', e.target.value)} onBlur={() => onSave(fishes)} />
          <input className={styles.listInput} style={{ flex: 1 }} value={f.name}
            onChange={e => setField(i, 'name', e.target.value)} onBlur={() => onSave(fishes)} />
          <select className={styles.listInput} style={{ width: 86, color: RARITY_COLOR[f.rarity], fontWeight: 800 }} value={f.rarity}
            onChange={e => commit(setField(i, 'rarity', e.target.value as FishRarity))}>
            {(Object.keys(RARITY_LABEL) as FishRarity[]).map(r => <option key={r} value={r}>{RARITY_LABEL[r]}</option>)}
          </select>
          <NumberField className={styles.listInput} style={{ width: 64, textAlign: 'right' }} min={0} max={100}
            value={f.probability} onCommit={v => commit(setField(i, 'probability', v))} />
          <NumberField className={styles.listInput} style={{ width: 64, textAlign: 'right' }} min={0} max={100000}
            value={f.points} onCommit={v => commit(setField(i, 'points', v))} />
          <button className={styles.delBtn} onClick={() => commit(fishes.filter((_, idx) => idx !== i))}>✕</button>
        </div>
      ))}
      {fishes.length === 0 && <div className={styles.listEmpty}>물고기를 추가하세요</div>}
      <div className="field-hint">레전드 등급은 기록 화면에서 '대박'으로 분류되고, 희귀·레전드는 오버레이에 축하 효과가 나옵니다.</div>
    </div>
  )
}

// ── 진행 패널 (라이브 미리보기) ───────────────────────────────────────────────

interface RaceStateData { racers: RaceRacer[]; bets: Record<string, number>; deadline: number; command: string; order?: number[] }

export function RacePanel({ state }: { state?: GameState }) {
  const status = state?.status ?? 'idle'
  const race = state?.race as RaceStateData | undefined
  const result = state?.result as { result: string; detail: string } | null | undefined
  const left = useCountdown(race?.deadline, status === 'collecting')

  if (!race || status === 'idle') {
    return <div className={`${styles.pvStage} checker`}><div className={styles.pvIdle}><b>동물 경주 대기 중</b>
      <small>실행하면 예측 접수가 시작되고, 시청자가 채팅으로 1등을 맞힙니다.</small></div></div>
  }
  const counts = race.racers.map((_, i) => Object.values(race.bets).filter(b => b === i).length)
  const rankOf = (i: number) => race.order ? race.order.indexOf(i) : -1
  return (
    <div className={`${styles.pvStage} checker`} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
        <span>{status === 'collecting' ? `예측 접수 중 · ${left}초` : status === 'running' ? '경주 중!' : '결과'}</span>
        <span>예측 {Object.keys(race.bets).length}명</span>
      </div>
      {race.racers.map((r, i) => {
        const rank = status === 'showing_result' ? rankOf(i) : -1
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 8,
                                background: rank === 0 ? '#FFF4D6' : 'rgba(255,255,255,.7)', fontWeight: 800 }}>
            <span style={{ width: 22 }}>{i + 1}</span><span style={{ fontSize: 20 }}>{r.emoji}</span>
            <span style={{ flex: 1 }}>{r.name}</span>
            {rank >= 0 && <span style={{ color: rank === 0 ? '#C77700' : 'var(--muted)' }}>{rank + 1}등</span>}
            <span style={{ width: 48, textAlign: 'right', color: 'var(--muted)' }}>{counts[i]}명</span>
          </div>
        )
      })}
      {status === 'showing_result' && result && <small style={{ color: 'var(--text2)' }}>{result.detail}</small>}
    </div>
  )
}

interface RpsStateData { picks: Record<string, string>; deadline: number; command: string; streamer?: string; winners?: string[]; draws?: string[]; losers?: string[] }

export function RpsPanel({ state }: { state?: GameState }) {
  const status = state?.status ?? 'idle'
  const rps = state?.rps as RpsStateData | undefined
  const left = useCountdown(rps?.deadline, status === 'collecting')

  if (!rps || status === 'idle') {
    return <div className={`${styles.pvStage} checker`}><div className={styles.pvIdle}><b>가위바위보 대기 중</b>
      <small>실행하면 참가 접수가 시작되고, 시청자가 채팅으로 가위/바위/보를 냅니다.<br />마감되면 스트리머의 손이 무작위로 정해집니다.</small></div></div>
  }
  const picks = Object.values(rps.picks)
  const tally = (h: string) => picks.filter(p => p === h).length
  return (
    <div className={`${styles.pvStage} checker`} style={{ flexDirection: 'column', gap: 10 }}>
      {status === 'collecting' ? (<>
        <b style={{ fontSize: 18 }}>참가 접수 중 · {left}초</b>
        <div style={{ display: 'flex', gap: 10 }}>
          {['scissors', 'rock', 'paper'].map(h => (
            <div key={h} style={{ padding: '8px 14px', borderRadius: 10, background: '#fff', fontWeight: 900 }}>{HAND[h]} <span style={{ color: 'var(--muted)' }}>{tally(h)}</span></div>
          ))}
        </div>
        <small style={{ color: 'var(--muted)' }}>채팅: {rps.command} 가위 / 바위 / 보 (오버레이에는 손별 인원이 표시되지 않습니다)</small>
      </>) : (<>
        <div style={{ fontSize: 34, fontWeight: 900 }}>스트리머 {rps.streamer ? HAND[rps.streamer] : '…'}</div>
        <div style={{ display: 'flex', gap: 14, fontWeight: 900 }}>
          <span style={{ color: '#12A866' }}>승 {rps.winners?.length ?? 0}</span>
          <span style={{ color: 'var(--muted)' }}>무 {rps.draws?.length ?? 0}</span>
          <span style={{ color: '#E0342C' }}>패 {rps.losers?.length ?? 0}</span>
        </div>
        {!!rps.winners?.length && <small style={{ textAlign: 'center' }}>이긴 시청자: {rps.winners.slice(0, 20).join(', ')}{rps.winners.length > 20 ? ' …' : ''}</small>}
      </>)}
    </div>
  )
}

interface FishLogEntry { user: string; points: number; catches: Record<string, number>; best?: { name: string; emoji: string; points: number } }
interface FishCast { triggeredBy: string; fish: FishItem; count: number; totalPoints: number }

export function FishPanel({ state }: { state?: GameState }) {
  const status = state?.status ?? 'idle'
  const cast = state?.fish as FishCast | undefined
  const [ranking, setRanking] = useState<FishLogEntry[]>([])
  const el = electron()

  const load = () => { (el?.fishRanking as ((n: number) => Promise<FishLogEntry[]>) | undefined)?.(10).then(setRanking).catch(() => {}) }
  // 결과가 나올 때마다 랭킹 새로고침
  useEffect(load, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  const resetLog = () => {
    if (!confirm('낚시 누적 기록(랭킹)을 모두 지울까요? 되돌릴 수 없습니다.')) return
    ;(el?.fishResetLog as (() => Promise<unknown>) | undefined)?.().then(load).catch(() => {})
  }

  return (
    <div className={`${styles.pvStage} checker`} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      {status === 'idle' || !cast ? (
        <div className={styles.pvIdle}><b>낚시 대기 중</b><small>실행할 때마다 한 마리씩 낚습니다. 시청자별 점수가 쌓여 랭킹이 됩니다.</small></div>
      ) : (
        <div className={styles.pvResult}>
          <small style={{ color: 'var(--muted)' }}>{cast.triggeredBy}님 {status === 'running' ? '낚는 중…' : '의 결과'}</small>
          {status !== 'running' && <>
            <div className="big">{cast.fish.emoji} {cast.fish.name}</div>
            <small style={{ color: RARITY_COLOR[cast.fish.rarity], fontWeight: 900 }}>{RARITY_LABEL[cast.fish.rarity]} · +{cast.fish.points}점 · 누적 {cast.count}마리 · 총 {cast.totalPoints}점</small>
          </>}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <b>낚시 랭킹 TOP 10</b>
        <button className="btn btn-ghost btn-sm" onClick={resetLog} disabled={!ranking.length}>기록 초기화</button>
      </div>
      {ranking.length === 0 && <small style={{ color: 'var(--muted)' }}>아직 기록이 없습니다.</small>}
      {ranking.map((r, i) => (
        <div key={r.user} style={{ display: 'flex', gap: 8, fontWeight: 800, fontSize: 13 }}>
          <span style={{ width: 22, color: i < 3 ? '#C77700' : 'var(--muted)' }}>{i + 1}</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.user}</span>
          <span style={{ color: 'var(--muted)' }}>{r.best ? `${r.best.emoji} ` : ''}{Object.values(r.catches).reduce((a, b) => a + b, 0)}마리</span>
          <span style={{ width: 64, textAlign: 'right' }}>{r.points}점</span>
        </div>
      ))}
    </div>
  )
}
