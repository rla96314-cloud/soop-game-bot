import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import { GAMES, gameById, gameColor, gameName, classifyResult } from '../../games'
import Icon from '../../components/Icon'
import GameConfig from '../Games/GameConfig'
import GamePreview from '../Games/GamePreview'
import styles from './Dashboard.module.css'

const fmtTime = (ts: number) => {
  const d = new Date(ts)
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':')
}
const APP_START = Date.now()
const fmtElapsed = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(n => String(n).padStart(2, '0')).join(':')
}

export default function Dashboard({ onNavigate, user }: {
  onNavigate: (page: 'games' | 'overlay' | 'help' | 'history', gameId?: string) => void
  user?: { id: string; name: string } | null
}) {
  const { settings, stats, history, gameStates, connected, liveViewers } = useApp()
  const [selected, setSelected] = useState('roulette')
  const port = ((settings?.overlay as Record<string, unknown> | undefined)?.port as number) ?? 3939
  const games = (settings?.games as Record<string, Record<string, unknown>> | undefined) ?? {}

  // 진행 중인 게임이 있으면 그 게임을 활성으로 보여준다
  const runningId = useMemo(() => GAMES.find(g => { const s = gameStates[g.id]?.status; return s === 'running' || s === 'collecting' })?.id, [gameStates])
  useEffect(() => { if (runningId) setSelected(runningId) }, [runningId])

  const active = gameById(selected)!
  const quick = GAMES.filter(g => g.id !== selected)
  const busy = (id: string) => { const s = gameStates[id]?.status; return s === 'running' || s === 'collecting' }

  const [elapsed, setElapsed] = useState(0)
  useEffect(() => { const id = setInterval(() => setElapsed(Date.now() - APP_START), 1000); return () => clearInterval(id) }, [])

  const wins = useMemo(() => history.filter(h => classifyResult(h.result) !== 'fail').length, [history])
  const enabledNames = GAMES.filter(g => (games[g.id]?.enabled as boolean) ?? true).map(g => g.name)

  return (
    <div className={styles.grid}>
      {/* ── 왼쪽: 활성 게임 + 빠른 실행 ── */}
      <div className={`card ${styles.left}`}>
        <div className={styles.leftHead}>
          <div className="sec-title" style={{ fontSize: 18 }}>현재 활성 게임</div>
          <div className="sec-desc">지금 방송에서 사용하는 게임입니다.</div>
        </div>
        <button className={`${styles.gameRow} ${styles.activeRow}`} onClick={() => onNavigate('games', active.id)}>
          <span className="game-ic lg" style={{ background: active.color }}><Icon name={active.icon} size={24} /></span>
          <span className={styles.gameText}><b>{active.name}</b><small>{active.desc}</small></span>
          <Icon name="chevron-right" size={16} className={styles.arrow} />
        </button>
        <div className={styles.leftHead} style={{ borderTop: '1px solid var(--line)' }}>
          <div className="sec-title" style={{ fontSize: 18 }}>빠른 실행</div>
          <div className="sec-desc">즐겨 사용하는 게임을 바로 실행하세요.</div>
        </div>
        <div className={styles.quickList}>
          {quick.map(g => (
            <button key={g.id} className={styles.gameRow} title="선택하면 가운데 설정과 오른쪽 미리보기가 바뀝니다. 실행은 오른쪽 실행 버튼으로."
              onClick={() => setSelected(g.id)}>
              <span className="game-ic lg" style={{ background: g.color }}><Icon name={g.icon} size={24} /></span>
              <span className={styles.gameText}><b>{g.name}{busy(g.id) && <span className={styles.dot} />}</b><small>{g.desc}</small></span>
              <Icon name="chevron-right" size={16} className={styles.arrow} />
            </button>
          ))}
        </div>
      </div>

      {/* ── 가운데: 선택 게임 설정 ── */}
      <GameConfig key={selected} gameId={selected} port={port} onHelp={() => onNavigate('help')} />

      {/* ── 오른쪽: 실시간 미리보기 ── */}
      <GamePreview key={`pv-${selected}`} gameId={selected} port={port} wheelSize={260} title="실시간 미리보기" />

      {/* ── 맨 오른쪽: 최근 실행 내역 ── */}
      <div className={`card ${styles.recent}`}>
        <div className="card-head">
          <div className="sec-title" style={{ fontSize: 16 }}>최근 실행 내역</div>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('history')}>전체 보기 <Icon name="chevron-right" size={14} /></button>
        </div>
        <div className={styles.recentHead}><span>시간</span><span>결과</span><span>트리거</span></div>
        <div className={styles.recentList}>
          {history.length === 0 && <div className="empty">아직 실행된 게임이 없습니다.</div>}
          {history.slice(0, 30).map((h, i) => (
            <div key={i} className={styles.recentRow}>
              <span className="num" style={{ color: 'var(--muted)' }}>{fmtTime(h.ts)}</span>
              <span className={styles.recentRes}><i style={{ background: gameColor(h.gameId) }} /><span className="truncate" title={`${gameName(h.gameId)} · ${h.result}`}>{h.result}</span></span>
              <span className="num">{h.balloon > 0 ? h.balloon.toLocaleString() : h.triggeredBy}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 하단 3칸 ── */}
      <div className={`card ${styles.bottom} ${styles.b1}`}>
        <div className="card-head"><div className="sec-title" style={{ fontSize: 16 }}>방송 현황</div>
          <span className={`badge ${connected ? 'badge-live' : 'badge-idle'}`}>{connected ? 'LIVE' : 'OFF'}</span></div>
        <div className={styles.kpis}>
          <div className={styles.kpi} title="현재 시청자 수 (방송국 API, 15초마다 갱신)"><small><Icon name="users" size={12} /> 동시 시청자</small><b className="num">{liveViewers.toLocaleString()}</b></div>
          <div className={styles.kpi}><small><Icon name="play" size={12} /> 오늘 실행 수</small><b className="num">{stats.todayRuns.toLocaleString()}</b></div>
          <div className={styles.kpi}><small><Icon name="gift" size={12} /> 소모 별풍선</small><b className={`num ${styles.orange}`}>{stats.todayBalloons.toLocaleString()}</b></div>
          <div className={styles.kpi}><small><Icon name="clock" size={12} /> 실행 시간</small><b className="num">{fmtElapsed(elapsed)}</b></div>
        </div>
        <div className={styles.userLine}>
          <Icon name="users" size={18} />
          <div><b>{user?.name ?? '스트리머'} ({user?.id ?? '-'})</b><small>{connected ? '지금, 시청자와 함께하는 방송이 진행 중입니다.' : 'SOOP 채팅에 연결되어 있지 않습니다.'}</small></div>
        </div>
      </div>

      <div className={`card ${styles.bottom} ${styles.b2}`}>
        <div className="card-head"><div className="sec-title" style={{ fontSize: 16 }}>OBS 오버레이 연결 상태</div>
          <span className={styles.okDot}><i /> 연결됨</span></div>
        <div className={styles.obsGrid}>
          <div className={styles.obsInfo}>
            <div><span>서버 주소</span><b className="num">http://localhost:{port}</b></div>
            <div><span>상태</span><b style={{ color: 'var(--ok)' }}>● 정상 작동 중</b></div>
            <div><span>마지막 이벤트</span><b className="num">{history[0] ? fmtTime(history[0].ts) : '-'}</b></div>
            <div><span>연결된 소스</span><b className="truncate" title={enabledNames.join(', ')}>{enabledNames.length}개 · {enabledNames.slice(0, 3).join(', ')}{enabledNames.length > 3 ? ' 외' : ''}</b></div>
          </div>
          <div className={styles.obsBtns}>
            <button className="btn" onClick={() => onNavigate('help')}><Icon name="help" size={14} />OBS 설정 가이드</button>
            <button className="btn" onClick={() => onNavigate('overlay')}><Icon name="link" size={14} />소스 URL 목록</button>
          </div>
        </div>
      </div>

      <div className={`card ${styles.bottom} ${styles.b3}`}>
        <div className="card-head"><div className="sec-title" style={{ fontSize: 16 }}>빠른 통계</div><span className="badge badge-idle">오늘</span></div>
        <div className={styles.stat4}>
          <div title="오늘 채팅하거나 후원한 시청자 수"><small><Icon name="users" size={14} /> 참여 시청자</small><b className="num">{stats.todayViewers.toLocaleString()}</b></div>
          <div><small><Icon name="play" size={14} /> 총 실행 수</small><b className="num">{stats.todayRuns.toLocaleString()}</b></div>
          <div><small><Icon name="gift" size={14} /> 소모 별풍선</small><b className={`num ${styles.orange}`}>{stats.todayBalloons.toLocaleString()}</b></div>
          <div><small><Icon name="check" size={14} /> 당첨 횟수</small><b className="num">{wins}</b></div>
        </div>
      </div>
    </div>
  )
}
