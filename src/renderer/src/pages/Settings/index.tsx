import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import Icon from '../../components/Icon'
import NumberField from '../../components/NumberField'
import { CopyBtn } from '../Games/GameConfig'
import styles from './Settings.module.css'

type El = Record<string, (...args: never[]) => unknown>
const el = () => (window as unknown as { electron: El }).electron
type P = Parameters<ReturnType<typeof useApp>['patchSettings']>[0]

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
  const { settings, patchSettings, refreshSettings, connected, standby, lastError, liveViewers } = useApp()
  const s = (settings ?? {}) as Record<string, Record<string, unknown>>

  const [channelId, setChannelId] = useState('')
  const [weflabUrl, setWeflabUrl] = useState('')
  const [weflabRunning, setWeflabRunning] = useState(false)
  const [weflabLog, setWeflabLog] = useState<string[]>([])
  const [weflabBusy, setWeflabBusy] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [idSaved, setIdSaved]     = useState(false)
  const [wfSaved, setWfSaved]     = useState(false)
  const [portNote, setPortNote]   = useState<string | null>(null)

  // 텍스트 칸은 처음 로드될 때만 설정값으로 채운다 — 다른 항목을 저장할 때마다 입력 중인 내용이 지워지지 않게
  const seeded = useRef(false)
  useEffect(() => {
    if (!settings || seeded.current) return
    seeded.current = true
    setChannelId((s.soop?.channelId as string) ?? '')
    setWeflabUrl((s.weflab?.url as string) ?? '')
  }, [settings]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const e = el()
    const push = (line: string) => setWeflabLog(l => [`[${new Date().toLocaleTimeString()}] ${line}`, ...l].slice(0, 20))
    const offs = [
      (e.onWeflabResult as (cb: (t: string, n: string) => void) => () => void)((t, n) => push(`룰렛: ${t}${n ? ` (${n})` : ''}`)),
      (e.onWeflabDonation as (cb: (d: { donor: string; balloons: number; amount: number; message: string }) => void) => () => void)(d => push(`후원: ${d.donor || '?'} ${d.balloons > 0 ? `별풍선 ${d.balloons}개` : `${d.amount.toLocaleString()}원`}${d.message ? ` "${d.message}"` : ''}`)),
      (e.onWeflabLoaded as (cb: () => void) => () => void)(() => { push('페이지 로드 완료'); setWeflabRunning(true) }),
      (e.onWeflabRetrying as (cb: (m: string) => void) => () => void)(m => push(`재연결: ${m}`)),
      (e.onWeflabError as (cb: (m: string) => void) => () => void)(m => push(`오류: ${m}`)),
    ]
    ;(e.weflabStatus as () => Promise<{ running: boolean }>)().then(r => setWeflabRunning(r.running)).catch(() => {})
    return () => offs.forEach(f => f())
  }, [])

  const soop = (patch: Record<string, unknown>) => patchSettings({ soop: patch } as P)
  const autoTrigger = (s.soop?.balloonAutoTrigger as boolean) !== false
  const donationSource = (s.soop?.donationSource as string) ?? 'both'
  const multiRun = (s.soop?.multiRun as boolean) !== false
  const maxRuns = (s.soop?.maxRunsPerDonation as number) ?? 10
  const uiScale = (s.ui?.scale as number) ?? 100
  const port = (s.overlay?.port as number) ?? 3939

  const reconnect = async () => {
    setReconnecting(true)
    try { const e = el(); await (e.soopDisconnect as () => Promise<void>)(); await (e.soopConnect as () => Promise<void>)(); refreshSettings() } catch {} finally { setReconnecting(false) }
  }
  const saveChannel = async () => { soop({ channelId: channelId.trim() }); setIdSaved(true); setTimeout(() => setIdSaved(false), 1800); await reconnect() }

  // 위플랩: URL을 넣으면 바로 감시 시작, 비우면 중지
  const applyWeflab = async () => {
    const url = weflabUrl.trim(); const e = el()
    const saved = ((s.weflab?.url as string) ?? '').trim()
    setWeflabBusy(true)
    try {
      if (url) {
        const r = await (e.weflabStart as (u: string) => Promise<{ ok: boolean; error?: string }>)(url)
        if (!r.ok) { setWeflabLog(l => [`[${new Date().toLocaleTimeString()}] 오류: ${r.error ?? '시작 실패'}`, ...l].slice(0, 20)); setWeflabRunning(false); return }
        setWeflabRunning(true)
      } else if (saved || weflabRunning) {
        await (e.weflabStop as () => Promise<unknown>)()
        setWeflabRunning(false)
      }
      patchSettings({ weflab: { url } } as P)
      setWfSaved(true); setTimeout(() => setWfSaved(false), 1800)
    } catch (err) {
      setWeflabLog(l => [`[${new Date().toLocaleTimeString()}] 오류: ${String(err)}`, ...l].slice(0, 20))
    } finally { setWeflabBusy(false) }
  }

  const savePort = (v: number) => {
    patchSettings({ overlay: { port: v } } as P)
    setPortNote('저장됨 — 앱을 다시 시작하면 새 포트로 열립니다. OBS 소스 URL도 바꿔 주세요.')
    setTimeout(() => setPortNote(null), 4000)
  }

  const overlayUrl = `http://localhost:${port}/overlay/roulette`
  const connLabel = connected ? '연결됨' : (standby ? '방송 대기 중' : '연결 안 됨')
  const effectiveId = channelId.trim() || user?.id || ''

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.headIc}><Icon name="settings" size={26} /></span>
        <div>
          <h1 className={styles.title}>설정</h1>
          <div className="sec-desc">방송과 게임을 연결하기 위한 기본 설정을 관리합니다.</div>
        </div>
      </div>

      <Row title="SOOP 연결" desc="SOOP 채팅 서버에 연결해 채팅과 별풍선을 받습니다.">
        <div className={styles.connRow}>
          <span className={styles.connDot} style={{ background: connected ? 'var(--live)' : (standby ? '#f2a600' : '#ff5f57') }} />
          <b className={styles.connText}>{connLabel}</b>
          <span className={styles.connMeta}>{user ? `${user.name} (${user.id})` : ''}</span>
          <span className={styles.connMeta}>시청자 <b className="num">{liveViewers.toLocaleString()}</b>명</span>
          {standby && !connected && <span className={styles.connMeta} title={standby}>{standby}</span>}
          <button className="btn" style={{ marginLeft: 'auto' }} onClick={reconnect} disabled={reconnecting}>
            <Icon name="refresh" size={14} />{reconnecting ? '재연결 중…' : '다시 연결'}
          </button>
        </div>
        {lastError && !connected && <div className="field-hint" style={{ color: 'var(--fail)' }}>마지막 오류: {lastError}</div>}
      </Row>

      <Row title="방송자 ID 설정" desc="내 방송의 고유 ID를 설정합니다. 비워 두면 로그인한 SOOP 아이디로 연결합니다.">
        <label className="field-label">방송자 ID (사용자명)</label>
        <div className="input-group" style={{ maxWidth: 640 }}>
          <input className="input" value={channelId} placeholder={user?.id ? `비우면 ${user.id} 사용` : '예: foxyeon'} onChange={e => setChannelId(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveChannel()} />
          <button className="btn btn-dark" onClick={saveChannel}>{idSaved ? '저장됨' : '확인'}</button>
        </div>
        <div className="field-hint">현재 연결 대상: <b>{effectiveId || '-'}</b> · 예시: foxyeon (https://ch.sooplive.co.kr/{'{사용자명}'}). 닉네임을 넣으면 정확히 일치하는 채널이 있을 때만 아이디로 자동 변환되며, 방송 중이 아니면 30초마다 다시 확인합니다.</div>
      </Row>

      <Row title="별풍선 트리거 설정" desc="별풍선 이벤트가 발생할 때 게임을 자동 실행합니다.">
        <label className="switch-row">
          <Switch checked={autoTrigger} onChange={v => soop({ balloonAutoTrigger: v })} />
          <div><b>별풍선 트리거 사용</b><div className="field-hint" style={{ marginTop: 2 }}>발동 개수는 게임마다 다릅니다. 각 게임의 '게임 설정' 탭에서 별풍선 트리거 개수를 정하세요 (0이면 그 게임은 별풍선으로 실행되지 않음). 후원 개수 이상인 게임 중 개수가 가장 큰 게임 하나가 실행되고, 진행 중이면 대기열에 쌓여 차례로 실행됩니다.</div></div>
        </label>
        <div className={styles.scaleRow} style={{ marginTop: 10 }}>
          <span className={styles.wfLabel}>후원 소스</span>
          <select className="select" style={{ width: 300 }} value={donationSource} onChange={e => soop({ donationSource: e.target.value })}>
            <option value="both">SOOP + 위플랩 (같은 후원 3초 내 중복 제거)</option>
            <option value="soop">SOOP 채팅만</option>
            <option value="weflab">위플랩만</option>
          </select>
        </div>
        <label className="switch-row" style={{ marginTop: 10 }}>
          <Switch checked={multiRun} onChange={v => soop({ multiRun: v })} />
          <div><b>큰 후원은 여러 번 실행</b><div className="field-hint" style={{ marginTop: 2 }}>후원 개수 ÷ 트리거 개수 만큼 실행합니다 (예: 기준 50개에 500개 후원 → 10회). 끄면 후원 1건당 1회.</div></div>
        </label>
        {multiRun && (
          <div className={styles.scaleRow} style={{ marginTop: 8 }}>
            <span className={styles.wfLabel}>후원 1건당 최대</span>
            <NumberField className="input" style={{ width: 110 }} min={1} max={100} value={maxRuns} onCommit={v => soop({ maxRunsPerDonation: v })} />
            <span className="field-hint" style={{ marginTop: 0 }}>회</span>
          </div>
        )}
      </Row>

      <Row title="OBS 설정" desc="이 앱이 PC 안에서 여는 오버레이 서버 정보입니다. OBS 브라우저 소스는 이 주소를 읽습니다.">
        <div className={styles.obs}>
          <div>
            <label className="field-label">오버레이 서버 포트 (로컬, 1024–65535)</label>
            <div className="input-group">
              <NumberField className="input" min={1024} max={65535} outOfRange="revert" value={port} onCommit={savePort} />
              <CopyBtn text={String(port)} label="복사" dark={false} />
            </div>
            {portNote && <div className="field-hint" style={{ color: 'var(--ok)' }}>{portNote}</div>}
          </div>
          <div>
            <label className="field-label">OBS 소스 URL (브라우저 소스 · 룰렛 예시)</label>
            <div className="input-group">
              <div className={`input ${styles.urlBox}`}>{overlayUrl}</div>
              <CopyBtn text={overlayUrl} />
            </div>
          </div>
        </div>
        <div className="field-hint">앱이 켜지면 이 포트로 오버레이 웹서버가 열리고, OBS의 브라우저 소스가 여기서 게임 화면을 받아 그립니다. 다른 프로그램과 포트가 겹칠 때만 바꾸면 되고, 바꾼 뒤에는 앱을 다시 시작하고 OBS 소스 URL도 새 포트로 고쳐야 합니다. 게임별 URL은 OBS 오버레이 화면에 있습니다.</div>
      </Row>

      <Row title="위플랩 연동" desc="위플랩 후원·룰렛 페이지를 감시합니다. URL을 넣으면 바로 연동됩니다.">
        <div className={styles.wfRow}>
          <span className={styles.wfLabel}>위플랩 URL</span>
          <div className="input-group" style={{ flex: 1 }}>
            <input className="input" value={weflabUrl} placeholder="https://weflab.com/page/..." onChange={e => setWeflabUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyWeflab()} />
            <button className="btn btn-dark" onClick={applyWeflab} disabled={weflabBusy}>{weflabBusy ? '적용 중…' : wfSaved ? '적용됨' : (weflabRunning ? '다시 연결' : '연동')}</button>
          </div>
          <span className={styles.connMeta} style={{ color: weflabRunning ? 'var(--ok)' : 'var(--muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>{weflabRunning ? '● 감지 중' : '○ 중지됨'}</span>
        </div>
        <div className="field-hint">
          URL이 저장되어 있으면 앱을 켤 때 자동으로 감시를 시작합니다. 비우고 연동을 누르면 중지됩니다. https://weflab.com 주소만 허용됩니다.<br />
          위플랩 후원 별풍선은 위의 '후원 소스' 설정에 따라 SOOP 별풍선과 합쳐지고, 위플랩 룰렛 결과는 각 게임의 '게임 설정' 탭에 넣은 <b>위플랩 룰렛 키워드</b>가 포함될 때 그 게임을 실행합니다.
        </div>
        {(weflabRunning || weflabLog.length > 0) && (
          <div className={styles.log}>
            <div className={styles.logTitle}>수신 로그</div>
            {weflabLog.length === 0 ? <div className={styles.logEmpty}>결과 대기 중…</div> : weflabLog.map((l, i) => <div key={i} className={styles.logLine}>{l}</div>)}
          </div>
        )}
      </Row>

      <Row title="UI 배율 설정" desc="화면은 창 크기에 맞춰 자동으로 커지고 작아집니다. 그 위에 더할 배율입니다.">
        <div className={styles.scaleRow}>
          <span className={styles.wfLabel}>UI 배율</span>
          <select className="select" style={{ width: 300 }} value={uiScale} onChange={e => patchSettings({ ui: { scale: Number(e.target.value) } } as P)}>
            {[90, 100, 110, 120, 130].map(p => <option key={p} value={p}>{p}%{p === 100 ? ' (기본)' : ''}</option>)}
          </select>
          <span className="field-hint" style={{ marginTop: 0 }}>선택 즉시 적용됩니다. 100%가 창에 딱 맞는 크기이고, 키우면 내용이 잘릴 수 있습니다.</span>
        </div>
      </Row>
    </div>
  )
}
