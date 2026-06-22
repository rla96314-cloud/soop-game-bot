import { useApp } from '../../contexts/AppContext'
import styles from './RecentHistory.module.css'

const RESULT_COLORS: Record<string, string> = {
  jackpot:  '#F59E0B',
  damage:   '#EF4444',
  win:      '#8B5CF6',
  legend:   '#F59E0B',
  correct:  '#10B981',
  default:  '#6B7280',
}

const colorFor = (result: string) => {
  if (result.includes('JACKPOT') || result.includes('레전드')) return RESULT_COLORS.jackpot
  if (result.includes('클리어') || result.includes('정답'))    return RESULT_COLORS.correct
  if (result.includes('당첨'))                                  return RESULT_COLORS.win
  if (result.includes('데미지'))                                return RESULT_COLORS.damage
  return RESULT_COLORS.default
}

export default function RecentHistory() {
  const { history } = useApp()

  const fmtTime = (ts: number) => {
    const d = new Date(ts)
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>최근 실행 기록</span>
        <span className={styles.count}>{history.length}개</span>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>게임</th>
            <th>트리거한 사람</th>
            <th>소모 별풍선</th>
            <th>결과</th>
            <th>시간</th>
          </tr>
        </thead>
        <tbody>
          {history.length === 0 && (
            <tr>
              <td colSpan={5} className={styles.empty}>게임 기록 없음</td>
            </tr>
          )}
          {history.map((h, i) => (
            <tr key={i}>
              <td>
                <div className={styles.gameCell}>
                  {h.gameName}
                </div>
              </td>
              <td>
                <div className={styles.userCell}>
                  <div className={styles.userDot} />
                  {h.triggeredBy}
                </div>
              </td>
              <td>
                {h.balloon > 0 && (
                  <div className={styles.balloonCell}>
                    <span className={styles.balloonAmt}>{h.balloon.toLocaleString()}</span>
                  </div>
                )}
              </td>
              <td>
                <span className={styles.result} style={{ color: colorFor(h.result) }}>
                  {h.result}
                </span>
              </td>
              <td className={styles.timeCell}>{fmtTime(h.ts)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
