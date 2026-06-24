import { useEffect, useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import styles from './Settings.module.css'

const el = () => (window as unknown as Record<string, Record<string, unknown>>).electron

interface WeflabTrigger { keyword: string }

export default function Settings() {
  const { settings, patchSettings, refreshSettings, connected } = useApp()

  // SOOP
  const [channelId,          setChannelId]          = useState('')
  const [userId,             setUserId]             = useState('')
  const [token,              setToken]              = useState('')
  const [simMode,            setSimMode]            = useState(true)
  const [balloonAutoTrigger, setBalloonAutoTrigger] = useState(true)
  const [globalThreshold,    setGlobalThreshold]    = useState(50)

  // Overlay
  const [overlayPort, setOverlayPort] = useState(3939)

  // Weflab
  const [weflabEnabled, setWeflabEnabled] = useState(false)
  const [weflabUrl,     setWeflabUrl]     = useState('')
  const [triggers,      setTriggers]      = useState<WeflabTrigger[]>([])
  const [weflabRunning, setWeflabRunning] = useState(false)
  const [weflabLog,     setWeflabLog]     = useState<string[]>([])
  const [urlDirty,      setUrlDirty]      = useState(false)

  const [saved,        setSaved]        = useState(false)
  const [reconnecting, setReconnecting] = useState(false)

  useEffect(() => {
    if (!settings) return
    const s = settings as Record<string, Record<string, unknown>>
    setChannelId(         (s.soop?.channelId          as string)  ?? '')
    setUserId(            (s.soop?.userId              as string)  ?? '')
    setToken(             (s.soop?.token               as string)  ?? '')
    setSimMode(           (s.soop?.simulationMode      as boolean) !== false)
    setBalloonAutoTrigger((s.soop?.balloonAutoTrigger  as boolean) !== false)
    setGlobalThreshold(   (s.soop?.globalThreshold     as number)  ?? 50)
    setOverlayPort(       (s.overlay?.port             as number)  ?? 3939)
    setWeflabEnabled(     !!(s.weflab?.enabled         as boolean))
    setWeflabUrl(         (s.weflab?.url               as string)  ?? '')
    setTriggers(          (s.weflab?.triggers          as WeflabTrigger[]) ?? [])
  }, [settings])

  // weflab event listeners
  useEffect(() => {
    const e = el()
    const offResult = (e.onWeflabResult as (cb: (t: string) => void) => () => void)(
      (text) => setWeflabLog(l => [`[${new Date().toLocaleTimeString()}] ${text}`, ...l].slice(0, 20))
    )
    const offLoaded = (e.onWeflabLoaded as (cb: () => void) => () => void)(
      () => setWeflabLog(l => [`[${new Date().toLocaleTimeString()}] 페이지 로드 완료`, ...l].slice(0, 20))
    )
    const offError  = (e.onWeflabError  as (cb: (err: string) => void) => () => void)(
      (err) => setWeflabLog(l => [`[오류] ${err}`, ...l].slice(0, 20))
    )
    return () => { offResult(); offLoaded(); offError() }
  }, [])

  // Sync weflab running state on every mount (tab switch 후 정확한 상태 반영)
  useEffect(() => {
    (el().weflabStatus as () => Promise<{ running: boolean; url: string }>)()
      .then(s => setWeflabRunning(s.running))
      .catch(() => {})
  })

  const save = () => {
    patchSettings({
      soop: {
        channelId,
        userId,
        token,
        simulationMode:     simMode,
        balloonAutoTrigger,
        globalThreshold:    Number(globalThreshold),
      },
      overlay: { port: Number(overlayPort) },
      weflab:  { enabled: weflabEnabled, url: weflabUrl, triggers },
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const reconnect = async () => {
    setReconnecting(true)
    try {
      const e = el()
      await (e.soopDisconnect as () => Promise<void>)()
      await (e.soopConnect    as () => Promise<void>)()
      refreshSettings()
    } catch {
      /* ignore */
    } finally {
      setReconnecting(false)
    }
  }

  // 체크박스 토글: 감지 시작/중지 + 즉시 설정 저장
  const toggleWeflab = async () => {
    const e = el()
    const newEnabled = !weflabEnabled
    setWeflabEnabled(newEnabled)

    if (newEnabled) {
      if (!weflabUrl.trim()) { setWeflabEnabled(false); return }
      await (e.weflabStart as (url: string) => Promise<unknown>)(weflabUrl.trim())
      setWeflabRunning(true)
    } else {
      await (e.weflabStop as () => Promise<unknown>)()
      setWeflabRunning(false)
    }
    // 즉시 저장 (프로그램 재시작 시 자동 감지용)
    patchSettings({ weflab: { enabled: newEnabled, url: weflabUrl, triggers } } as Parameters<typeof patchSettings>[0])
  }

  // URL 변경 후 재시작
  const restartWeflab = async () => {
    if (!weflabUrl.trim()) return
    const e = el()
    await (e.weflabStop  as () => Promise<unknown>)()
    await (e.weflabStart as (url: string) => Promise<unknown>)(weflabUrl.trim())
    setWeflabRunning(true); setUrlDirty(false)
    patchSettings({ weflab: { enabled: true, url: weflabUrl, triggers } } as Parameters<typeof patchSettings>[0])
  }

  const saveTriggers = (next: WeflabTrigger[]) => {
    setTriggers(next)
    patchSettings({ weflab: { triggers: next } } as Parameters<typeof patchSettings>[0])
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>설정</h1>
        <button className={styles.saveBtn} onClick={save}>
          {saved ? '✓ 저장됨' : '저장'}
        </button>
      </div>

      {/* SOOP 연동 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>SOOP 연동</h2>
        <div className={styles.statusRow}>
          <span className={styles.statusDot} style={{ background: connected ? '#10B981' : '#EF4444' }} />
          <span className={styles.statusText}>{connected ? '연결됨' : '연결 안 됨'}</span>
          <button
            className={styles.reconnectBtn}
            onClick={reconnect}
            disabled={reconnecting}
          >
            {reconnecting ? '재연결 중…' : '재연결'}
          </button>
        </div>

        <div className={styles.field}>
          <label>채널 ID</label>
          <input value={channelId} onChange={e => setChannelId(e.target.value)} placeholder="스트리머 채널 ID" />
        </div>
        <div className={styles.field}>
          <label>유저 ID</label>
          <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="SOOP 로그인 ID" />
        </div>
        <div className={styles.field}>
          <label>인증 토큰</label>
          <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="채팅 인증 토큰" />
        </div>

        <div className={styles.toggle}>
          <label>
            <input type="checkbox" checked={simMode} onChange={e => setSimMode(e.target.checked)} />
            <span>시뮬레이션 모드 (실제 연결 없이 테스트)</span>
          </label>
        </div>
        <div className={styles.toggle}>
          <label>
            <input type="checkbox" checked={balloonAutoTrigger} onChange={e => setBalloonAutoTrigger(e.target.checked)} />
            <span>별풍선 자동 게임 트리거</span>
          </label>
        </div>

        <div className={styles.field} style={{ marginTop: 12 }}>
          <label>전역 최소 별풍선 수량</label>
          <input
            type="number"
            value={globalThreshold}
            onChange={e => setGlobalThreshold(Number(e.target.value))}
            min={0}
            max={9999}
          />
          <p className={styles.hint}>
            이 수량 미만의 별풍선은 게임 트리거로 인식하지 않습니다.
          </p>
        </div>
      </section>

      {/* OBS 오버레이 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>OBS 오버레이</h2>
        <div className={styles.field}>
          <label>포트</label>
          <input
            type="number"
            value={overlayPort}
            onChange={e => setOverlayPort(Number(e.target.value))}
            min={1024} max={65535}
          />
        </div>
        <div className={styles.overlayUrls}>
          {['roulette','ladder','quiz','slot','boss','number','lottery'].map(id => (
            <div key={id} className={styles.overlayRow}>
              <span className={styles.overlayName}>{id}</span>
              <code className={styles.overlayCode}>
                http://localhost:{overlayPort}/overlay/{id}
              </code>
            </div>
          ))}
        </div>
      </section>

      {/* weflab */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>weflab 연동</h2>

        <div className={styles.field}>
          <label>weflab 방송 URL</label>
          <div className={styles.rwRow}>
            <input
              className={styles.rwInput}
              value={weflabUrl}
              onChange={e => { setWeflabUrl(e.target.value); if (weflabRunning) setUrlDirty(true) }}
              placeholder="https://weflab.com/page/..."
            />
            {urlDirty && weflabRunning && (
              <button className={styles.rwToggleBtn} onClick={restartWeflab}>재시작</button>
            )}
          </div>
        </div>

        <div className={styles.toggle} style={{ marginTop: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={weflabEnabled} onChange={toggleWeflab} disabled={!weflabUrl.trim() && !weflabEnabled} />
            <span>weflab 룰렛 결과 감지 활성화</span>
          </label>
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: weflabRunning ? '#3fb950' : '#6e7681' }}>
            {weflabRunning ? '● 감지 중' : '○ 중지됨'}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
          활성화하면 프로그램 시작 시 자동으로 감지를 시작합니다
        </div>

        <div className={styles.field}>
          <label>트리거 키워드 (결과에 포함 시 게임 자동 발동)</label>
          <div className={styles.rwTriggerList}>
            {triggers.map((t, i) => (
              <div key={i} className={styles.rwTriggerRow}>
                <input
                  className={styles.rwInput}
                  placeholder="키워드"
                  value={t.keyword}
                  onChange={e => saveTriggers(triggers.map((x, j) => j === i ? { keyword: e.target.value } : x))}
                  disabled={!weflabEnabled}
                />
                <button className={styles.rwDelBtn}
                  onClick={() => saveTriggers(triggers.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button
              className={styles.rwAddTriggerBtn}
              onClick={() => saveTriggers([...triggers, { keyword: '' }])}
              disabled={!weflabEnabled}
            >+ 키워드 추가</button>
          </div>
        </div>

        {weflabRunning && (
          <div className={styles.rwLog}>
            <div className={styles.rwLogTitle}>수신 로그</div>
            {weflabLog.length === 0
              ? <div className={styles.rwLogEmpty}>결과 대기 중...</div>
              : weflabLog.map((line, i) => (
                  <div key={i} className={styles.rwLogLine}>{line}</div>
                ))
            }
          </div>
        )}
      </section>
    </div>
  )
}
