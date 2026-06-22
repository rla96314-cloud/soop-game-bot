import { useEffect, useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import styles from './Settings.module.css'

const el = () => (window as unknown as Record<string, Record<string, unknown>>).electron

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
  }, [settings])

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
      weflab:  { enabled: weflabEnabled, url: weflabUrl },
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
          {['roulette','ladder','quiz','slot','boss','number'].map(id => (
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
        <h2 className={styles.sectionTitle}>weflab 연동 (룰렛)</h2>
        <div className={styles.toggle}>
          <label>
            <input type="checkbox" checked={weflabEnabled} onChange={e => setWeflabEnabled(e.target.checked)} />
            <span>weflab 룰렛 결과 감지 사용</span>
          </label>
        </div>
        <div className={styles.field} style={{ marginTop: 12 }}>
          <label>weflab 방송 URL</label>
          <input
            value={weflabUrl}
            onChange={e => setWeflabUrl(e.target.value)}
            placeholder="https://weflab.com/page/..."
            disabled={!weflabEnabled}
          />
        </div>
        <p className={styles.hint}>
          룰렛 결과가 감지되면 트리거 키워드와 일치할 경우 게임이 자동 실행됩니다.
          트리거 키워드는 게임 설정 → 룰렛에서 관리합니다.
        </p>
      </section>
    </div>
  )
}
