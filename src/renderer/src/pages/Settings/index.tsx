import { useEffect, useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import Icon from '../../components/Icon'
import { CopyBtn } from '../Games/GameConfig'
import styles from './Settings.module.css'

const el = () => (window as unknown as Record<string, Record<string, unknown>>).electron
type P = Parameters<ReturnType<typeof useApp>['patchSettings']>[0]
interface WeflabTrigger { keyword: string }

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className={`card ${styles.row}`}>
      <div className={styles.rowLeft}>
        <div className="sec-title" style={{ fontSize: 19 }}>{title}</div>
        <div className="sec-desc">{desc}</div>
      </div>
      <div className={styles.rowRight}>{children}</div>
    </section>
  )
}

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <span className="switch"><input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} /><span className="track" /></span>
  )
}

export default function Settings({ user }: { user?: { id: string; name: string } | null }) {
  const { settings, patchSettings, refreshSettings, connected, simulation, standby, stats } = useApp()
  const s = (settings ?? {}) as Record<string, Record<string, unknown>>

  const [channelId, setChannelId] = useState('')
  const [port, setPort]           = useState(3939)
  const [weflabUrl, setWeflabUrl] = useState('')
  const [weflabRunning, setWeflabRunning] = useState(false)
  const [weflabLog, setWeflabLog] = useState<string[]>([])
  const [urlDirty, setUrlDirty]   = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [idSaved, setIdSaved]     = useState(false)

  useEffect(() => {
    if (!settings) return
    setChannelId((s.soop?.channelId as string) ?? '')
    setPort((s.overlay?.port as number) ?? 3939)
    setWeflabUrl((s.weflab?.url as string) ?? '')
  }, [settings])

  useEffect(() => {
    const e = el(); const push = (line: string) => setWeflabLog(l => [`[${new Date().toLocaleTimeString()}] ${line}`, ...l].slice(0, 20))
    const offs = [
      (e.onWeflabResult as (cb: (t: string, n: string) => void) => () => void)((t, n) => push(`룰렛: ${t}${n ? ` (${n})` : ''}`)),
      (e.onWeflabDonation as (cb: (d: { donor: string; balloons: number; amount: number; message: string }) => void) => () => void)(d => push(`후원: ${d.donor || '?'} ${d.balloons > 0 ? `별풍선 ${d.balloons}개` : `${d.amount.toLocaleString()}원`}${d.message ? ` "${d.message}"` : ''}`)),
      (e.onWeflabLoaded as (cb: () => void) => () => void)(() => push('페이지 로드 완료')),
      (e.onWeflabRetrying as (cb: (m: string) => void) => () => void)(m => push(`재연결: ${m}`)),
      (e.onWeflabError as (cb: (m: string) => void) => () => void)(m => push(`오류: ${m}`)),
    ]
    return () => offs.forEach(f => f())
  }, [])
  useEffect(() => { (el().weflabStatus as () => Promise<{ running: boolean }>)().then(r => setWeflabRunning(r.running)).catch(() => {}) })

  const soop = (patch: Record<string, unknown>) => patchSettings({ soop: patch } as P)
  const simMode = (s.soop?.simulationMode as boolean) !== false
  const autoTrigger = (s.soop?.balloonAutoTrigger as boolean) !== false
  const threshold = (s.soop?.globalThreshold as number) ?? 50
  const uiScale = (s.ui?.scale as number) ?? 110
  const weflabEnabled = !!(s.weflab?.enabled as boolean)
  const balloonTrigger = !!(s.weflab?.balloonTrigger as boolean)
  const triggers = (s.weflab?.triggers as WeflabTrigger[]) ?? []

  const reconnect = async () => {
    setReconnecting(true)
    try { const e = el(); await (e.soopDisconnect as () => Promise<void>)(); await (e.soopConnect as () => Promise<void>)(); refreshSettings() } catch {} finally { setReconnecting(false) }
  }
  const saveChannel = async () => { soop({ channelId: channelId.trim() }); setIdSaved(true); setTimeout(() => setIdSaved(false), 1800); await reconnect() }

  const toggleWeflab = async (on: boolean) => {
    const e = el()
    if (on) { if (!weflabUrl.trim()) return; await (e.weflabStart as (u: string) => Promise<unknown>)(weflabUrl.trim()); setWeflabRunning(true) }
    else { await (e.weflabStop as () => Promise<unknown>)(); setWeflabRunning(false) }
    patchSettings({ weflab: { enabled: on, url: weflabUrl.trim() } } as P)
  }
  const restartWeflab = async () => {
    if (!weflabUrl.trim()) return
    const e = el(); await (e.weflabStop as () => Promise<unknown>)(); await (e.weflabStart as (u: string) => Promise<unknown>)(weflabUrl.trim())
    setWeflabRunning(true); setUrlDirty(false); patchSettings({ weflab: { enabled: true, url: weflabUrl.trim() } } as P)
  }
  const saveTriggers = (next: WeflabTrigger[]) => patchSettings({ weflab: { triggers: next } } as P)

  const overlayUrl = `http://localhost:${port}/overlay/roulette`
  const connLabel = connected ? (simulation ? '시뮬레이션 중' : '연결됨') : (standby ? '방송 대기 중' : '연결 안 됨')

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.headIc}><Icon name="settings" size={26} /></span>
        <div>
          <h1 className={styles.title}>설정</h1>
          <div className="sec-desc">방송과 게임을 연결하기 위한 기본 설정을 관리합니다.</div>
        </div>
      </div>

      <Row title="SOOP 연결" desc="SOOP 계정과 방송을 연결합니다.">
        <div className={styles.connRow}>
          <span className={styles.connDot} style={{ background: connected ? 'var(--live)' : (standby ? '#f2a600' : '#ff5f57') }} />
          <b className={styles.connText}>{connLabel}</b>
          <span className={styles.connMeta}>{user ? `${user.name} (${user.id})` : ''}</span>
          <span className={styles.connMeta}>시청자 <b className="num">{stats.todayViewers}</b>명</span>
          {standby && !connected && <span className={styles.connMeta} title={standby}>{standby}</span>}
          <button className="btn" style={{ marginLeft: 'auto' }} onClick={reconnect} disabled={reconnecting}>
            <Icon name="refresh" size={14} />{reconnecting ? '재연결 중…' : '다시 연결'}
          </button>
        </div>
      </Row>

      <Row title="방송자 ID 설정" desc="내 방송의 고유 ID를 설정합니다. 채널 URL 또는 사용자명을 사용하세요.">
        <label className="field-label">방송자 ID (사용자명)</label>
        <div className="input-group" style={{ maxWidth: 640 }}>
          <input className="input" value={channelId} placeholder="예: foxyeon" onChange={e => setChannelId(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveChannel()} />
          <button className="btn btn-dark" onClick={saveChannel}>{idSaved ? '저장됨' : '확인'}</button>
        </div>
        <div className="field-hint">예시: foxyeon, mychannel (https://ch.sooplive.co.kr/{'{사용자명}'}). 닉네임을 넣어도 아이디로 자동 변환됩니다. 방송 중이 아니면 30초마다 다시 확인합니다.</div>
      </Row>

      <Row title="시뮬레이션 모드" desc="실제 방송 연결 없이 이벤트를 테스트할 수 있습니다.">
        <label className="switch-row">
          <Switch checked={simMode} onChange={v => { soop({ simulationMode: v }); setTimeout(reconnect, 50) }} />
          <div><b>시뮬레이션 모드 사용</b><div className="field-hint" style={{ marginTop: 2 }}>가상의 채팅·별풍선 이벤트로 모든 기능을 테스트할 수 있습니다. 실제 방송에서는 꺼 두세요.</div></div>
        </label>
      </Row>

      <Row title="별풍선 트리거 설정" desc="별풍선 이벤트가 발생할 때 실행할 동작을 설정합니다.">
        <label className="switch-row" style={{ marginBottom: 14 }}>
          <b>별풍선 트리거 사용</b>
          <Switch checked={autoTrigger} onChange={v => soop({ balloonAutoTrigger: v })} />
        </label>
        <div className={styles.two}>
          <div>
            <label className="field-label">최소 별풍선 개수</label>
            <div className="input-group">
              <input className="input" type="number" min={0} max={9999} value={threshold} onChange={e => soop({ globalThreshold: Number(e.target.value) })} disabled={!autoTrigger} />
              <span className={`btn ${styles.unit}`}>개</span>
            </div>
          </div>
          <div>
            <label className="field-label">트리거 대상</label>
            <select className="select" value="all" disabled><option value="all">모든 별풍선</option></select>
          </div>
        </div>
        <div className="field-hint">설정한 개수 이상의 별풍선 이벤트가 발생하면 게임 내 이벤트가 실행됩니다. 게임별 트리거 개수는 게임 화면에서 따로 정할 수 있습니다.</div>
      </Row>

      <Row title="OBS 설정" desc="OBS에서 사용할 연결 정보와 소스 URL을 확인합니다.">
        <div className={styles.obs}>
          <div>
            <label className="field-label">웹소켓 포트 (로컬)</label>
            <div className="input-group">
              <input className="input" type="number" min={1024} max={65535} value={port} onChange={e => setPort(Number(e.target.value))} onBlur={() => patchSettings({ overlay: { port: Number(port) } } as P)} />
              <CopyBtn text={String(port)} label="복사" dark={false} />
            </div>
          </div>
          <div>
            <label className="field-label">OBS 소스 URL (브라우저 소스)</label>
            <div className="input-group">
              <div className={`input ${styles.urlBox}`}>{overlayUrl}</div>
              <CopyBtn text={overlayUrl} />
            </div>
          </div>
        </div>
        <div className="field-hint">OBS에서 '브라우저' 소스를 추가하고 위 URL을 입력하세요. 권장 크기 1920×1080. 게임별 URL은 OBS 오버레이 화면에 있습니다. 포트를 바꾸면 앱을 다시 시작해야 적용됩니다.</div>
      </Row>

      <Row title="위플랩 연동" desc="위플랩 후원·룰렛 페이지를 감시해 게임을 실행합니다.">
        <label className="switch-row" style={{ marginBottom: 12 }}>
          <b>위플랩 연동 사용</b>
          <Switch checked={weflabEnabled} onChange={toggleWeflab} disabled={!weflabUrl.trim() && !weflabEnabled} />
          <span className={styles.connMeta} style={{ color: weflabRunning ? 'var(--ok)' : 'var(--muted)', fontWeight: 700 }}>{weflabRunning ? '● 감지 중' : '○ 중지됨'}</span>
        </label>
        <div className={styles.wfRow}>
          <span className={styles.wfLabel}>위플랩 URL</span>
          <div className="input-group" style={{ flex: 1 }}>
            <input className="input" value={weflabUrl} placeholder="https://weflab.com/page/..." onChange={e => { setWeflabUrl(e.target.value); if (weflabRunning) setUrlDirty(true) }} onBlur={() => { if (!weflabRunning) patchSettings({ weflab: { url: weflabUrl.trim() } } as P) }} />
            {urlDirty && weflabRunning ? <button className="btn btn-primary" onClick={restartWeflab}>재시작</button> : <CopyBtn text={weflabUrl} label="복사" dark={false} />}
          </div>
        </div>
        <div className="field-hint">위플랩 룰렛 결과가 감지되면 룰렛 게임을 실행합니다. 활성화 상태는 저장되어 앱을 켤 때 자동으로 감시를 시작합니다.</div>

        <label className="switch-row" style={{ margin: '14px 0 6px' }}>
          <Switch checked={balloonTrigger} disabled={!weflabEnabled} onChange={v => patchSettings({ weflab: { balloonTrigger: v } } as P)} />
          <div><b>후원 별풍선을 게임 트리거로 사용</b><div className="field-hint" style={{ marginTop: 2 }}>위플랩에서 감지된 별풍선 후원을 SOOP 별풍선과 똑같이 게임 발동에 씁니다.</div></div>
        </label>

        <label className="field-label" style={{ marginTop: 12 }}>트리거 키워드 (비워두면 모든 룰렛 결과에 발동)</label>
        <div className={styles.keywords}>
          {triggers.map((t, i) => (
            <div key={i} className="input-group" style={{ width: 220 }}>
              <input className="input" placeholder="키워드" value={t.keyword} disabled={!weflabEnabled} onChange={e => saveTriggers(triggers.map((x, j) => j === i ? { keyword: e.target.value } : x))} />
              <button className="btn" onClick={() => saveTriggers(triggers.filter((_, j) => j !== i))}><Icon name="delete" size={14} /></button>
            </div>
          ))}
          <button className="btn" disabled={!weflabEnabled} onClick={() => saveTriggers([...triggers, { keyword: '' }])}><Icon name="plus" size={14} />키워드 추가</button>
        </div>
        {weflabRunning && (
          <div className={styles.log}>
            <div className={styles.logTitle}>수신 로그</div>
            {weflabLog.length === 0 ? <div className={styles.logEmpty}>결과 대기 중…</div> : weflabLog.map((l, i) => <div key={i} className={styles.logLine}>{l}</div>)}
          </div>
        )}
      </Row>

      <Row title="UI 배율 설정" desc="프로그램 화면의 UI 크기를 조절합니다.">
        <div className={styles.scaleRow}>
          <span className={styles.wfLabel}>UI 배율</span>
          <select className="select" style={{ width: 300 }} value={uiScale} onChange={e => patchSettings({ ui: { scale: Number(e.target.value) } } as P)}>
            {[90, 100, 110, 120, 130].map(p => <option key={p} value={p}>{p}%{p === 100 ? ' (기본)' : ''}</option>)}
          </select>
          <span className="field-hint" style={{ marginTop: 0 }}>선택 즉시 적용됩니다. 글자가 작게 느껴지면 110~120%를 권장합니다.</span>
        </div>
      </Row>
    </div>
  )
}
