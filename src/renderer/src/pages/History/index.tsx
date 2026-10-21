import { useMemo, useState } from 'react'
import { useApp, type HistoryItem } from '../../contexts/AppContext'
import { GAMES, gameById, gameColor, gameName, classifyResult, RESULT_LABEL } from '../../games'
import Icon from '../../components/Icon'
import styles from './History.module.css'

const PAGE_SIZES = [15, 30, 50]

function fmtTime(ts: number) {
  const d = new Date(ts)
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':')
}
function fmtDate(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}`
}

function toCSV(rows: HistoryItem[]) {
  const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`
  const head = ['시간', '게임', '트리거', '결과', '상세', '소모 별풍선', '상태']
  const body = rows.map(h => [new Date(h.ts).toLocaleString('ko-KR'), gameName(h.gameId), h.triggeredBy, h.result, h.detail, h.balloon, RESULT_LABEL[classifyResult(h.result)]].map(esc).join(','))
  return '﻿' + [head.map(esc).join(','), ...body].join('\n')
}

export default function HistoryPage() {
  const { history, stats } = useApp()
  const [game, setGame]   = useState('all')
  const [kind, setKind]   = useState<'all' | 'ok' | 'jackpot' | 'fail'>('all')
  const [q, setQ]         = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage]   = useState(0)
  const [size, setSize]   = useState(15)
  const [selected, setSelected] = useState<HistoryItem | null>(null)

  const filtered = useMemo(() => history.filter(h =>
    (game === 'all' || h.gameId === game) &&
    (kind === 'all' || classifyResult(h.result) === kind) &&
    (!query || h.triggeredBy.includes(query) || h.result.includes(query) || h.detail.includes(query))
  ), [history, game, kind, query])

  const pages = Math.max(1, Math.ceil(filtered.length / size))
  const cur = Math.min(page, pages - 1)
  const rows = filtered.slice(cur * size, cur * size + size)

  const summary = useMemo(() => {
    const viewers = new Set(history.map(h => h.triggeredBy)).size
    const balloons = history.reduce((s, h) => s + h.balloon, 0)
    const cnt = { ok: 0, jackpot: 0, fail: 0 }
    for (const h of history) cnt[classifyResult(h.result)]++
    const perGame = GAMES.map(g => ({ id: g.id, n: history.filter(h => h.gameId === g.id).length })).filter(x => x.n > 0).sort((a, b) => b.n - a.n)
    return { viewers, balloons, cnt, perGame }
  }, [history])
  const total = history.length || 1
  const pct = (n: number) => Math.round(n / total * 100)

  const download = () => {
    const blob = new Blob([toCSV(filtered)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `game-history-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const reset = () => { setGame('all'); setKind('all'); setQ(''); setQuery(''); setPage(0) }
  const first = history[history.length - 1]?.ts, last = history[0]?.ts

  const pageBtns = useMemo(() => {
    const arr: (number | '…')[] = []
    for (let i = 0; i < pages; i++) {
      if (i < 5 || i === pages - 1 || Math.abs(i - cur) <= 1) arr.push(i)
      else if (arr[arr.length - 1] !== '…') arr.push('…')
    }
    return arr
  }, [pages, cur])

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <div className={`card ${styles.head}`}>
          <div>
            <div className="sec-title" style={{ fontSize: 22 }}>게임 활동 기록</div>
            <div className="sec-desc">방송 중 실행된 게임 이벤트 내역입니다 (최근 1,000건, 앱을 켠 뒤부터).</div>
          </div>
        </div>

        <div className={`card ${styles.tableCard}`}>
          <div className={styles.filters}>
            <span className={styles.fLabel}>기간</span>
            <span className={styles.range}><Icon name="calendar" size={14} />{first ? fmtDate(first) : '-'} <em>{first ? fmtTime(first) : ''}</em> ~ {last ? fmtDate(last) : '-'} <em>{last ? fmtTime(last) : ''}</em></span>
            <select className="select" style={{ width: 130 }} value={game} onChange={e => { setGame(e.target.value); setPage(0) }}>
              <option value="all">게임 전체</option>
              {GAMES.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select className="select" style={{ width: 120 }} value={kind} onChange={e => { setKind(e.target.value as typeof kind); setPage(0) }}>
              <option value="all">결과 전체</option><option value="ok">성공</option><option value="jackpot">대박</option><option value="fail">실패</option>
            </select>
            <div className={`input-group ${styles.search}`}>
              <span className={styles.searchIc}><Icon name="search" size={14} /></span>
              <input className="input" placeholder="시청자 닉네임 검색..." value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && (setQuery(q), setPage(0))} />
              <button className="btn btn-dark" onClick={() => { setQuery(q); setPage(0) }}>검색</button>
            </div>
            <button className="btn" onClick={reset}><Icon name="refresh" size={14} />초기화</button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>#</th><th>시간</th><th>게임</th><th>시청자</th><th>결과 / 내용</th><th className={styles.r}>소모 별풍선</th><th>상태</th></tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={7} className="empty">{history.length === 0 ? '아직 게임 기록이 없습니다. 게임이 실행되면 여기에 쌓입니다.' : '조건에 맞는 기록이 없습니다.'}</td></tr>}
                {rows.map((h, i) => {
                  const k = classifyResult(h.result); const g = gameById(h.gameId)
                  return (
                    <tr key={cur * size + i} onClick={() => setSelected(h)}>
                      <td className="num" style={{ color: 'var(--muted)' }}>{cur * size + i + 1}</td>
                      <td className="num">{fmtTime(h.ts)}</td>
                      <td><span className={styles.gcell}><span className="game-ic" style={{ background: gameColor(h.gameId) }}>{g && <Icon name={g.icon} size={14} />}</span>{gameName(h.gameId)}</span></td>
                      <td>{h.triggeredBy}</td>
                      <td className={k === 'jackpot' ? styles.jackpot : ''}>{h.result}</td>
                      <td className={`num ${styles.r}`}>{h.balloon > 0 ? h.balloon.toLocaleString() : '-'}</td>
                      <td><span className={`badge badge-${k}`}>{RESULT_LABEL[k]}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.pager}>
            <div className={styles.pages}>
              <button className={styles.pg} disabled={cur === 0} onClick={() => setPage(cur - 1)}>‹</button>
              {pageBtns.map((p, i) => p === '…'
                ? <span key={`e${i}`} className={styles.ell}>…</span>
                : <button key={p} className={`${styles.pg} ${p === cur ? styles.pgActive : ''}`} onClick={() => setPage(p)}>{p + 1}</button>)}
              <button className={styles.pg} disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>›</button>
            </div>
            <div className={styles.pagerRight}>
              <span className="num">총 {filtered.length}건 중 {filtered.length === 0 ? 0 : cur * size + 1}–{Math.min(filtered.length, (cur + 1) * size)}건 표시</span>
              <select className="select" style={{ width: 120 }} value={size} onChange={e => { setSize(Number(e.target.value)); setPage(0) }}>
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s}개씩 보기</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <aside className={styles.side}>
        <div className={`card ${styles.actions}`}>
          <button className="btn" onClick={download} disabled={filtered.length === 0}><Icon name="download" size={14} />CSV 다운로드</button>
          <button className="btn" onClick={reset}><Icon name="refresh" size={14} />새로고침</button>
        </div>
        <div className="card">
          <div className="card-head"><div className="sec-title" style={{ fontSize: 18 }}>전체 요약</div><span className="badge badge-idle">오늘</span></div>
          <div className={styles.summary}>
            <div><span className={styles.sIc} style={{ color: 'var(--orange)' }}><Icon name="play" size={16} /></span><span>총 실행 횟수</span><b className="num">{stats.todayRuns.toLocaleString()} <small>회</small></b></div>
            <div><span className={styles.sIc}><Icon name="users" size={16} /></span><span>참여한 시청자</span><b className="num">{summary.viewers} <small>명</small></b></div>
            <div><span className={styles.sIc} style={{ color: 'var(--blue)' }}><Icon name="gift" size={16} /></span><span>소모 별풍선</span><b className="num">{summary.balloons.toLocaleString()} <small>개</small></b></div>
            <div><span className={styles.sIc} style={{ color: '#f2a600' }}><Icon name="check" size={16} /></span><span>성공 횟수</span><b className="num">{summary.cnt.ok} <small>회 ({pct(summary.cnt.ok)}%)</small></b></div>
            <div><span className={styles.sIc} style={{ color: 'var(--fail)' }}><Icon name="delete" size={16} /></span><span>실패 횟수</span><b className="num">{summary.cnt.fail} <small>회 ({pct(summary.cnt.fail)}%)</small></b></div>
            <div><span className={styles.sIc} style={{ color: 'var(--orange)' }}><Icon name="lottery" size={16} /></span><span>대박 이벤트</span><b className="num">{summary.cnt.jackpot} <small>회 ({pct(summary.cnt.jackpot)}%)</small></b></div>
          </div>
        </div>
        <div className={`card ${styles.perGame}`}>
          <div className="card-head"><div className="sec-title" style={{ fontSize: 18 }}>게임별 실행 수</div></div>
          <div className={styles.bars}>
            {summary.perGame.length === 0 && <div className="empty">데이터 없음</div>}
            {summary.perGame.map(x => (
              <button key={x.id} className={`${styles.barRow} ${game === x.id ? styles.barActive : ''}`} onClick={() => { setGame(game === x.id ? 'all' : x.id); setPage(0) }}>
                <span>{gameName(x.id)}</span>
                <span className={styles.track}><i style={{ width: `${Math.max(4, x.n / (summary.perGame[0]?.n || 1) * 100)}%`, background: gameColor(x.id) }} /></span>
                <b className="num">{x.n}</b>
                <small className="num">{pct(x.n)}%</small>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {selected && (
        <div className={styles.overlay} onClick={() => setSelected(null)}>
          <div className={`card ${styles.modal}`} onClick={e => e.stopPropagation()}>
            <div className="card-head"><div className="sec-title">{gameName(selected.gameId)}</div><button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button></div>
            <div className={styles.modalBody}>
              <div><span>결과</span><b className={classifyResult(selected.result) === 'jackpot' ? styles.jackpot : ''}>{selected.result}</b></div>
              <div><span>상세</span><b>{selected.detail}</b></div>
              <div><span>트리거</span><b>{selected.triggeredBy}</b></div>
              <div><span>별풍선</span><b className="num">{selected.balloon > 0 ? `${selected.balloon.toLocaleString()}개` : '-'}</b></div>
              <div><span>시간</span><b className="num">{new Date(selected.ts).toLocaleString('ko-KR')}</b></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
