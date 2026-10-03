// 숫자 입력 공용 컴포넌트
// 입력 중에는 문자열로 들고 있다가 blur / Enter 때만 clamp 해서 저장한다.
//  - 키 입력마다 settings.json 을 쓰던 부하 제거
//  - 칸을 비우면 0 이 저장돼 다시 입력할 수 없던 문제 제거
//  - min/max 범위 밖 값은 경계로 고정 (메인 프로세스에서도 한 번 더 검증함)
import { useEffect, useState, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max' | 'step'> & {
  value: number
  onCommit: (v: number) => void
  min?: number
  max?: number
  step?: number
  /** 범위 밖 값 처리: 'clamp'(기본) 또는 'revert'(이전 값으로) */
  outOfRange?: 'clamp' | 'revert'
}

export default function NumberField({ value, onCommit, min, max, step, outOfRange = 'clamp', onBlur, onKeyDown, ...rest }: Props) {
  const [text, setText] = useState(String(value))
  const [editing, setEditing] = useState(false)

  // 바깥 값이 바뀌면(다른 곳에서 저장) 편집 중이 아닐 때만 반영
  useEffect(() => { if (!editing) setText(String(value)) }, [value, editing])

  const commit = () => {
    setEditing(false)
    const n = Number(text.trim())
    if (text.trim() === '' || !Number.isFinite(n)) { setText(String(value)); return }
    let v = Math.trunc(n)
    const below = min !== undefined && v < min
    const above = max !== undefined && v > max
    if (below || above) {
      if (outOfRange === 'revert') { setText(String(value)); return }
      v = below ? (min as number) : (max as number)
    }
    setText(String(v))
    if (v !== value) onCommit(v)
  }

  return (
    <input
      {...rest}
      type="number"
      inputMode="numeric"
      min={min} max={max} step={step}
      value={text}
      onFocus={() => setEditing(true)}
      onChange={e => setText(e.target.value)}
      onBlur={e => { commit(); onBlur?.(e) }}
      onKeyDown={e => {
        if (e.key === 'Enter') { (e.target as HTMLInputElement).blur() }
        else if (e.key === 'Escape') { setText(String(value)); setEditing(false); (e.target as HTMLInputElement).blur() }
        onKeyDown?.(e)
      }}
    />
  )
}
