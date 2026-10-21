import { useEffect, useState } from 'react'
import styles from './UpdateOverlay.module.css'

type UpdateStatus =
  | { state: 'checking' }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'installing'; version: string }
  | { state: 'none' }
  | { state: 'error'; message: string }

type El = {
  updateStatus?: () => Promise<UpdateStatus>
  onUpdateStatus?: (cb: (s: UpdateStatus) => void) => () => void
}
const el = (window as unknown as { electron?: El }).electron

/** 시작 시 새 버전을 받는 동안 화면 전체를 덮는 안내 (확인 중·오류·최신이면 표시 안 함) */
export default function UpdateOverlay() {
  const [s, setS] = useState<UpdateStatus>({ state: 'none' })

  useEffect(() => {
    el?.updateStatus?.().then(setS).catch(() => {})
    return el?.onUpdateStatus?.(setS)
  }, [])

  if (s.state !== 'downloading' && s.state !== 'installing') return null
  const percent = s.state === 'installing' ? 100 : s.percent

  return (
    <div className={styles.backdrop} role="alertdialog" aria-live="polite">
      <div className={styles.box}>
        <div className={styles.title}>새 버전으로 업데이트 중</div>
        <div className={styles.ver}>v{s.version}</div>
        <div className={styles.bar}><div className={styles.fill} style={{ width: `${percent}%` }} /></div>
        <div className={styles.note}>
          {s.state === 'installing' ? '설치 후 자동으로 다시 실행됩니다…' : `다운로드 ${percent}%`}
        </div>
      </div>
    </div>
  )
}
