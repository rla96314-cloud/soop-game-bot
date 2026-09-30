// 오른쪽 라이브 미리보기 카드: 게임별 진행 패널 + OBS URL + 실행 버튼
import { useEffect, useRef } from 'react'
import { useApp } from '../../contexts/AppContext'
import { gameById } from '../../games'
import Icon from '../../components/Icon'
import styles from './Games.module.css'
import { CopyBtn } from './GameConfig'
import { LadderPanel, QuizPanel, SlotPanel } from './panels'

const WHEEL_COLORS = ['#e0342c', '#ff7a1a', '#f2a600', '#12a866', '#2f6bff', '#7a3cff', '#00a884', '#e0489a']

/** 큰 룰렛 휠 (mock 스타일: 이름 + 확률, 가운데 START, 위쪽 포인터) */
export function RouletteWheel({ items, size = 320 }: { items: Array<{ name: string; probability: number }>; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = size * dpr; c.height = size * dpr
    const ctx = c.getContext('2d')!; ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, size, size)
    const cx = size / 2, cy = size / 2, r = size / 2 - 10
    const total = items.reduce((s, i) => s + (i.probability || 0), 0) || 1
    let start = -Math.PI / 2
    // 바깥 흰 링
    ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill()
    ctx.shadowColor = 'rgba(23,36,55,.18)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6
    ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, Math.PI * 2); ctx.fill(); ctx.shadowColor = 'transparent'
    items.forEach((it, i) => {
      const sweep = (it.probability || 0) / total * Math.PI * 2
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, start, start + sweep); ctx.closePath()
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length]; ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke()
      const mid = start + sweep / 2
      const tx = cx + Math.cos(mid) * r * 0.62, ty = cy + Math.sin(mid) * r * 0.62
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const big = sweep > 0.5
      ctx.font = `800 ${big ? Math.round(size / 13) : Math.round(size / 20)}px "Noto Sans KR", sans-serif`
      const label = it.name.length > 7 ? it.name.slice(0, 6) + '…' : it.name
      ctx.fillText(label, tx, ty - (big ? size / 40 : size / 60))
      ctx.font = `600 ${big ? Math.round(size / 17) : Math.round(size / 26)}px Inter, sans-serif`
      ctx.fillText(`${Math.round((it.probability || 0) / total * 100)}%`, tx, ty + (big ? size / 18 : size / 30))
      start += sweep
    })
    // 가운데 START
    ctx.beginPath(); ctx.arc(cx, cy, size / 8, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill()
    ctx.fillStyle = '#172437'; ctx.font = `800 ${Math.round(size / 18)}px Inter, "Noto Sans KR", sans-serif`; ctx.fillText('START', cx, cy)
    // 포인터
    ctx.beginPath(); ctx.moveTo(cx - size / 18, 2); ctx.lineTo(cx + size / 18, 2); ctx.lineTo(cx, size / 9); ctx.closePath()
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#182538'; ctx.lineWidth = 2; ctx.fill(); ctx.stroke()
  }, [items, size])
  return <canvas ref={ref} style={{ width: size, height: size }} aria-label="룰렛 미리보기" />
}

export default function GamePreview({ gameId, port, wheelSize = 320, title = '라이브 미리보기' }: { gameId: string; port: number; wheelSize?: number; title?: string }) {
  const { settings, gameStates, triggerGame } = useApp()
  const game = gameById(gameId)!
  const g = (settings?.games as Record<string, Record<string, unknown>> | undefined)?.[gameId] ?? {}
  const state = gameStates[gameId]
  const status = state?.status ?? 'idle'
  const busy = status === 'running' || status === 'collecting'
  const result = state?.result as { result: string; detail: string; triggeredBy: string } | null | undefined
  const url = `http://localhost:${port}/overlay/${gameId}`
  const el = (window as unknown as Record<string, Record<string, unknown>>).electron
  const openPreview = () => (el?.overlayOpen as (id: string) => void)?.(gameId)
  const save = (_k: string, _v: unknown) => {}
  const enabled = (g.enabled as boolean) ?? true

  const idleHint = game.engine
    ? ((g.balloonThreshold as number) > 0 ? `별풍선 ${g.balloonThreshold}개 후원 시 자동 실행` : '별풍선 트리거가 꺼져 있습니다 (채팅 명령어 또는 실행 버튼)')
    : '칸을 눌러 하나씩 공개합니다'

  return (
    <div className={`card ${styles.pv}`}>
      <div className="card-head"><div className="sec-title">{title}</div>
        <span className={`badge ${busy ? 'badge-live' : status === 'showing_result' ? 'badge-jackpot' : 'badge-idle'}`}>
          {busy ? (status === 'collecting' ? '모집 중' : '진행 중') : status === 'showing_result' ? '결과' : '대기'}
        </span>
      </div>
      <div className={styles.pvBody}>
        {/* ── 게임별 무대 ── */}
        {gameId === 'roulette' && (
          <div className={`${styles.pvStage} checker`}>
            <RouletteWheel items={(g.items as Array<{ name: string; probability: number }>) ?? []} size={wheelSize} />
            {busy && <div className={styles.pvOverlay}><span>돌아가는 중…</span><em>{(state?.roulette as { winner: string } | undefined)?.winner}</em></div>}
            {status === 'showing_result' && result && <div className={styles.pvOverlay}><span>결과</span><em>{result.result}</em></div>}
          </div>
        )}
        {gameId === 'ladder' && (
          <LadderPanel key="ladder" gSettings={g} gameStates={gameStates} />
        )}
        {gameId === 'pickboard' && (
          <div className={`${styles.pvStage} checker`}>
            <div className={styles.pvIdle}>
              <span className="game-ic lg" style={{ background: game.color, width: 64, height: 64 }}><Icon name={game.icon} size={32} /></span>
              <b>뽑기판</b>
              <small>가운데 설정 칸의 뽑기판에서 칸을 누르면<br />OBS 오버레이에 바로 반영됩니다.</small>
            </div>
          </div>
        )}
        {gameId === 'quiz' && (
          <QuizPanel key="quiz" gSettings={g} gameStates={gameStates} saveSetting={save} />
        )}
        {gameId === 'slot' && (
          <SlotPanelBridge gameId={gameId} g={g} />
        )}
        {['race', 'rps', 'fish', 'lottery', 'number'].includes(gameId) && (
          <div className={`${styles.pvStage} checker`}>
            {!busy && !result && (
              <div className={styles.pvIdle}>
                <span className="game-ic lg" style={{ background: game.color, width: 64, height: 64 }}><Icon name={game.icon} size={32} /></span>
                <b>{game.name} 대기 중</b>
                <small>{idleHint}</small>
              </div>
            )}
            {busy && <div className={styles.pvIdle}><b>진행 중…</b><small>결과가 나오면 여기와 OBS 오버레이에 표시됩니다</small></div>}
            {!busy && result && (
              <div className={styles.pvResult}>
                <small style={{ color: 'var(--muted)' }}>{result.triggeredBy}님의 결과</small>
                <div className="big">{result.result}</div>
                <small style={{ color: 'var(--text2)' }}>{result.detail}</small>
              </div>
            )}
          </div>
        )}

        {/* ── OBS URL + 실행 ── */}
        <div className={styles.pvUrl}>
          <span className="field-label" style={{ marginBottom: 0 }}>OBS 소스 URL</span>
          <div className={styles.pvUrlRow}>
            <div className={styles.pvUrlBox}>{url}</div>
            <CopyBtn text={url} />
          </div>
        </div>
        <div className={styles.pvActions}>
          {game.engine ? (
            <button className="btn btn-primary btn-lg" disabled={busy || !enabled} onClick={() => triggerGame(gameId)}>
              <Icon name="play" size={20} />{busy ? '진행 중…' : '실행'}
            </button>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={openPreview}><Icon name="monitor" size={20} />오버레이 열기</button>
          )}
          <button className="btn btn-lg" style={{ fontSize: 15 }} onClick={openPreview}><Icon name="external" size={18} />미리보기 열기</button>
        </div>
      </div>
    </div>
  )
}

// SlotPanel 은 심볼 편집을 포함하므로 저장 함수를 연결해 준다
function SlotPanelBridge({ gameId, g }: { gameId: string; g: Record<string, unknown> }) {
  const { patchSettings, gameStates } = useApp()
  const save = (key: string, value: unknown) => patchSettings({ games: { [gameId]: { [key]: value } } })
  return <SlotPanel key="slot" gSettings={g} gameStates={gameStates} saveSetting={save} />
}
