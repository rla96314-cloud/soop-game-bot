import styles from './TitleBar.module.css'

declare global {
  interface Window {
    electron?: {
      minimize: () => void
      maximize: () => void
      close: () => void
    }
  }
}

interface Props {
  user?:     { id: string; name: string }
  onLogout?: () => void
}

export default function TitleBar({ user, onLogout }: Props) {
  return (
    <div className={styles.bar}>
      <div className={styles.drag} />

      {user && (
        <div className={styles.userBadge}>
          <span className={styles.userDot} />
          <span className={styles.userId}>{user.name || user.id}</span>
          <button className={styles.logoutBtn} onClick={onLogout} title="로그아웃">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      )}

      <div className={styles.controls}>
        <button className={styles.btn} onClick={() => window.electron?.minimize()} title="최소화">
          <span className={styles.min} />
        </button>
        <button className={styles.btn} onClick={() => window.electron?.maximize()} title="최대화">
          <span className={styles.max} />
        </button>
        <button className={`${styles.btn} ${styles.closeBtn}`} onClick={() => window.electron?.close()} title="닫기">
          <span className={styles.close} />
        </button>
      </div>
    </div>
  )
}
