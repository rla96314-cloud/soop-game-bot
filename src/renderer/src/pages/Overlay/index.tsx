import { useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import { GAMES, gameById } from '../../games'
import Icon, { type IconName } from '../../components/Icon'
import { CopyBtn } from '../Games/GameConfig'
import { RouletteWheel } from '../Games/GamePreview'
import styles from './Overlay.module.css'

interface UrlRow { id: string; name: string; color: string; icon: IconName | null }
const ROWS: UrlRow[] = [
  ...GAMES.map(g => ({ id: g.id, name: g.name, color: g.color, icon: g.icon as IconName | null })),
  { id: 'monitor', name: '게임 모니터',   color: '#172437', icon: null },
  { id: 'preview', name: '전체 미리보기', color: '#172437', icon: null },
]

export default function OverlayPage() {
  const { settings } = useApp()
  const port = ((settings?.overlay as Record<string, unknown> | undefined)?.port as number) ?? 3939
  const [sel, setSel] = useState('roulette')
  const game = gameById(sel)!
  const g = (settings?.games as Record<string, Record<string, unknown>> | undefined)?.[sel] ?? {}
  const el = (window as unknown as Record<string, Record<string, unknown>>).electron
  const open = (id: string) => (el?.overlayOpen as (id: string) => void)?.(id)
  const url = (id: string) => `http://localhost:${port}/overlay/${id}`

  return (
    <div className={styles.layout}>
      {/* ── 왼쪽: 미리보기 ── */}
      <div className={`card ${styles.preview}`}>
        <div className="card-head">
          <div>
            <div className="sec-title">{game.name} 오버레이 미리보기</div>
            <div className="sec-desc">방송에 표시될 오버레이 모양을 미리 확인하세요.</div>
          </div>
          <div className={styles.headRight}>
            <select className="select" style={{ width: 150 }} value={sel} onChange={e => setSel(e.target.value)}>
              {GAMES.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <button className="btn" onClick={() => open(sel)}><Icon name="external" size={14} />실제 화면 열기</button>
          </div>
        </div>
        <div className={`${styles.stage} checker`}>
          {sel === 'roulette'
            ? <RouletteWheel items={(g.items as Array<{ name: string; probability: number }>) ?? []} size={440} />
            : (
              <div className={styles.placeholder}>
                <span className="game-ic lg" style={{ background: game.color, width: 80, height: 80 }}><Icon name={game.icon} size={40} /></span>
                <b>{game.name} 오버레이</b>
                <small>실제 애니메이션은 OBS 브라우저 소스 또는 '실제 화면 열기'에서 확인할 수 있습니다.<br />투명 배경으로 렌더링됩니다.</small>
              </div>
            )}
        </div>
      </div>

      {/* ── 오른쪽: URL 표 + 설정 방법 ── */}
      <div className={styles.right}>
        <div className={`card ${styles.urls}`}>
          <div className="card-head">
            <div>
              <div className="sec-title">브라우저 소스 URL</div>
              <div className="sec-desc">아래 URL을 OBS의 브라우저 소스로 추가하여 사용하세요.</div>
            </div>
          </div>
          <div className={styles.table}>
            <div className={`${styles.tr} ${styles.th}`}><span>번호</span><span>게임</span><span>브라우저 소스 URL</span><span>크기</span><span>복사</span></div>
            {ROWS.map((x, i) => (
              <div key={x.id} className={`${styles.tr} ${sel === x.id ? styles.trActive : ''}`}>
                <span className="num">{i + 1}</span>
                <span className={styles.gcell}><span className="game-ic" style={{ background: x.color }}><Icon name={x.icon ?? 'monitor'} size={14} /></span>{x.name}</span>
                <button className={styles.urlBtn} onClick={() => open(x.id)} title="클릭하면 브라우저에서 엽니다">{url(x.id)}</button>
                <span className="num" style={{ color: 'var(--muted)' }}>1920 × 1080</span>
                <CopyBtn text={url(x.id)} label="복사" dark={false} className="btn-sm" />
              </div>
            ))}
          </div>
        </div>

        <div className={`card ${styles.howto}`}>
          <div className="card-head"><div className="sec-title">OBS 설정 방법</div></div>
          <ol className={styles.steps}>
            <li><i>1</i><div><b>브라우저 소스 추가</b><small>OBS에서 '소스 추가' → '브라우저'를 선택하세요.</small></div></li>
            <li><i>2</i><div><b>URL 입력</b><small>위의 URL 중 원하는 게임을 복사하여 붙여넣으세요.</small></div></li>
            <li><i>3</i><div><b>크기 설정</b><small>가로 1920, 세로 1080으로 설정하고 필요 시 위치를 조정하세요. '배경 투명도 허용'은 켜 둡니다.</small></div></li>
          </ol>
        </div>
      </div>
    </div>
  )
}
