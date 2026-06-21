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

export default function TitleBar() {
  return (
    <div className={styles.bar}>
      <div className={styles.drag} />
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
