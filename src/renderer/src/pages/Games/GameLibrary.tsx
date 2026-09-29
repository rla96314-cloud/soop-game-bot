import { useApp } from '../../contexts/AppContext'
import { GAMES } from '../../games'
import Icon from '../../components/Icon'
import styles from './Games.module.css'

export default function GameLibrary({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const { gameStates } = useApp()
  const busy = (id: string) => { const s = gameStates[id]?.status; return s === 'running' || s === 'collecting' }

  return (
    <div className={`card ${styles.lib}`}>
      <div className="card-head" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
        <div className="sec-title" style={{ fontSize: 18 }}>게임 라이브러리</div>
        <div className="sec-desc">방송에 사용할 게임을 선택하세요.</div>
      </div>
      <div className={styles.libList}>
        {GAMES.map(g => (
          <button key={g.id} className={`${styles.libItem} ${selected === g.id ? styles.active : ''}`} onClick={() => onSelect(g.id)}>
            <span className="game-ic lg" style={{ background: g.color }}><Icon name={g.icon} size={24} /></span>
            <span className={styles.libText}>
              <span className={styles.libName}>{g.name}{busy(g.id) && <span className={styles.libDot} title="진행 중" />}</span>
              <span className={styles.libDesc}>{g.desc}</span>
            </span>
            <Icon name="chevron-right" size={16} className={styles.libArrow} />
          </button>
        ))}
      </div>
    </div>
  )
}
