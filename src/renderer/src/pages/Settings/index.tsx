import { useEffect, useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import styles from './Settings.module.css'

export default function Settings() {
  const { settings, patchSettings, connected } = useApp()

  const [channelId,  setChannelId]  = useState('')
  const [userId,     setUserId]     = useState('')
  const [token,      setToken]      = useState('')
  const [simMode,    setSimMode]    = useState(true)
  const [overlayPort,setOverlayPort]= useState(3939)
  const [saved,      setSaved]      = useState(false)

  useEffect(() => {
    if (!settings) return
    const s = settings as Record<string, Record<string, unknown>>
    setChannelId(  (s.soop?.channelId  as string) ?? '')
    setUserId(     (s.soop?.userId     as string) ?? '')
    setToken(      (s.soop?.token      as string) ?? '')
    setSimMode(    (s.soop?.simulationMode as boolean) !== false)
    setOverlayPort((s.overlay?.port    as number) ?? 3939)
  }, [settings])

  const save = () => {
    patchSettings({
      soop: { channelId, userId, token, simulationMode: simMode },
      overlay: { port: overlayPort },
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
        <p className={styles.hint}>
          OBS 브라우저 소스 URL: <code>http://localhost:{overlayPort}/overlay/roulette</code>
        </p>
      </section>
    </div>
  )
}
