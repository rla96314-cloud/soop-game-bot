import styles from './RecentHistory.module.css'

const HISTORY = [
  { game: '룰렛', icon: '🎡', user: '도라이몽', balloon: 1000, result: '다이아몬드', time: '14:22:10', resultType: 'jackpot' },
  { game: '보스전', icon: '👾', user: '별하늘', balloon: 2000, result: '5,678 데미지', time: '14:18:33', resultType: 'damage' },
  { game: '사다리타기', icon: '🪜', user: '게임사랑', balloon: 500, result: '3번 사다리 당첨', time: '14:15:08', resultType: 'win' },
  { game: '뽑기', icon: '🎁', user: '행운아', balloon: 300, result: '전설 등급 당첨', time: '14:10:21', resultType: 'legend' },
  { game: '퀴즈', icon: '❓', user: '바다소년', balloon: 100, result: '정답!', time: '14:08:45', resultType: 'correct' },
  { game: '슬롯머신', icon: '🎰', user: '랜더걸', balloon: 1000, result: 'JACKPOT!', time: '14:05:12', resultType: 'jackpot' },
]

const RESULT_COLORS: Record<string, string> = {
  jackpot: '#F59E0B',
  damage: '#EF4444',
  win: '#8B5CF6',
  legend: '#F59E0B',
  correct: '#10B981',
}

export default function RecentHistory() {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>최근 실행 기록</span>
        <button className={styles.more}>더보기 ›</button>
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
          {HISTORY.map((h, i) => (
            <tr key={i}>
              <td>
                <div className={styles.gameCell}>
                  <span className={styles.gameIcon}>{h.icon}</span>
                  {h.game}
                </div>
              </td>
              <td>
                <div className={styles.userCell}>
                  <div className={styles.userDot} />
                  {h.user}
                </div>
              </td>
              <td>
                <div className={styles.balloonCell}>
                  <span>⭐</span>
                  <span className={styles.balloonAmt}>{h.balloon.toLocaleString()}</span>
                </div>
              </td>
              <td>
                <span
                  className={styles.result}
                  style={{ color: RESULT_COLORS[h.resultType] }}
                >
                  {h.result}
                </span>
              </td>
              <td className={styles.timeCell}>{h.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
