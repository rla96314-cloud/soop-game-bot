import { useState, useRef, useEffect } from 'react'
import styles from './Login.module.css'

interface Props {
  onSuccess: (user: { id: string; name: string }) => void
}

export default function LoginScreen({ onSuccess }: Props) {
  const [id,      setId]      = useState('')
  const [state,   setState]   = useState<'idle' | 'loading' | 'error'>('idle')
  const [errMsg,  setErrMsg]  = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const el = (window as unknown as Record<string, unknown>).electron as Record<string, (...args: unknown[]) => unknown>

  const submit = async () => {
    const trimmed = id.trim()
    if (!trimmed) return

    setState('loading')
    setErrMsg('')

    try {
      const result = await (el.authVerify as (id: string) => Promise<{ ok: boolean; user?: { id: string; name: string }; error?: string }>)(trimmed)
      if (result.ok && result.user) {
        setState('idle')
        onSuccess(result.user)
      } else {
        setState('error')
        setErrMsg(result.error ?? '허용되지 않은 계정입니다.')
      }
    } catch (err) {
      setState('error')
      setErrMsg('서버 연결 실패. 인터넷 연결을 확인해주세요.')
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submit()
  }

  return (
    <div className={styles.overlay}>
      {/* Background decoration */}
      <div className={styles.bg}>
        <div className={styles.circle1} />
        <div className={styles.circle2} />
        <div className={styles.circle3} />
      </div>

      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>🎮</div>
          <div className={styles.logoText}>
            <span className={styles.logoTop}>SOOP</span>
            <span className={styles.logoBot}>GAME BOT</span>
          </div>
        </div>

        <h1 className={styles.title}>크루 전용 접속</h1>
        <p className={styles.sub}>허용된 SOOP 아이디로만 사용 가능합니다.</p>

        <div className={styles.form}>
          <div className={`${styles.inputWrap} ${state === 'error' ? styles.inputErr : ''}`}>
            <span className={styles.inputIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
            </span>
            <input
              ref={inputRef}
              className={styles.input}
              type="text"
              placeholder="SOOP 아이디를 입력하세요"
              value={id}
              onChange={e => { setId(e.target.value); setState('idle'); setErrMsg('') }}
              onKeyDown={onKey}
              disabled={state === 'loading'}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {state === 'error' && (
            <div className={styles.error}>
              <span>🚫</span> {errMsg}
            </div>
          )}

          <button
            className={`${styles.btn} ${state === 'loading' ? styles.btnLoading : ''}`}
            onClick={submit}
            disabled={state === 'loading' || !id.trim()}
          >
            {state === 'loading'
              ? <span className={styles.spinner} />
              : '접속하기'
            }
          </button>
        </div>

        <p className={styles.hint}>
          접속이 안 되면 방장에게 아이디 추가를 요청하세요.
        </p>
      </div>
    </div>
  )
}
