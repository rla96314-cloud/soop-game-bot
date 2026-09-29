import styles from './TitleBar.module.css'
import Icon from './Icon'

declare global {
  interface Window {
    electron?: {
      minimize: () => void
      maximize: () => void
      close: () => void
    }
  }
  const __APP_VERSION__: string
}

interface Props {
  user?:      { id: string; name: string }
  onLogout?:  () => void
  onSettings?: () => void
}

export default function TitleBar({ user, onLogout, onSettings }: Props) {
  const version = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''
  return (
    <div className={styles.bar}>
      <div className={styles.controls}>
        <button className={`${styles.dot} ${styles.close}`} onClick={() => window.electron?.close()} title="닫기" />
        <button className={`${styles.dot} ${styles.min}`}   onClick={() => window.electron?.minimize()} title="최소화" />
        <button className={`${styles.dot} ${styles.max}`}   onClick={() => window.electron?.maximize()} title="최대화" />
      </div>
      <div className={styles.drag} />
      <div className={styles.right}>
        <span className={styles.app}>SOOP Game Bot</span>
        {version && <span className={styles.ver}>v{version}</span>}
        {user && (<>
          <span className={styles.sep} />
          <span className={styles.user}>{user.name || user.id} <span className={styles.userId}>({user.id})</span></span>
          <button className={styles.iconBtn} onClick={onLogout} title="로그아웃">
            <Icon name="external" size={14} />
          </button>
        </>)}
        <span className={styles.sep} />
        <button className={styles.iconBtn} onClick={onSettings} title="설정">
          <Icon name="settings" size={15} />
        </button>
      </div>
    </div>
  )
}
