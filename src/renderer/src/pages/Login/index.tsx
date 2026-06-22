import { useState } from 'react'
import styles from './Login.module.css'

interface Props {
  onSuccess: (user: { id: string; name: string }) => void
}

type State = 'idle' | 'waiting' | 'error'

export default function LoginScreen({ onSuccess }: Props) {
  const [state,  setState]  = useState<State>('idle')
  const [errMsg, setErrMsg] = useState('')

  const el = (window as unknown as Record<string, unknown>).electron as Record<string, (...args: unknown[]) => unknown>

  const handleSoopLogin = async () => {
    setState('waiting')
    setErrMsg('')
    try {
      const result = await (el.authSoopLogin as () => Promise<{ ok: boolean; user?: { id: string; name: string }; error?: string }>)()
      if (result.ok && result.user) {
        setState('idle')
        onSuccess(result.user)
      } else {
        setState('error')
        setErrMsg(result.error ?? '로그인에 실패했습니다.')
      }
    } catch {
      setState('error')
      setErrMsg('서버 연결 실패. 인터넷 연결을 확인해주세요.')
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.bg}>
        <div className={styles.circle1} />
        <div className={styles.circle2} />
        <div className={styles.circle3} />
      </div>

      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>🎮</div>
          <div className={styles.logoText}>
            <span className={styles.logoTop}>SOOP</span>
            <span className={styles.logoBot}>GAME BOT</span>
          </div>
        </div>

        <h1 className={styles.title}>크루 전용 접속</h1>
        <p className={styles.sub}>SOOP 계정으로 로그인하여 시작합니다.</p>

        <div className={styles.form}>
          {state === 'waiting' ? (
            <div className={styles.waitBox}>
              <span className={styles.spinner} />
              <span className={styles.waitText}>
                열린 브라우저에서 SOOP 로그인을 완료해 주세요
              </span>
            </div>
          ) : (
            <button
              className={styles.soopBtn}
              onClick={handleSoopLogin}
              disabled={state === 'waiting'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
              SOOP으로 로그인
            </button>
          )}

          {state === 'error' && (
            <div className={styles.error}>
              <span>🚫</span> {errMsg}
            </div>
          )}
        </div>

        <p className={styles.hint}>
          SOOP 로그인 창이 열립니다. 로그인 완료 시 자동으로 닫힙니다.
        </p>
      </div>
    </div>
  )
}
