// 가운데 설정 카드: 게임 설정 / 항목 설정 / 화면 설정 탭 + 자동 실행 토글 + 테스트 실행
import { useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import { gameById } from '../../games'
import Icon from '../../components/Icon'
import styles from './Games.module.css'
import {
  RouletteEditor, LotteryEditor, LadderEditor, QuizEditor, PickBoardEditor, PickBoardPanel, NumberPanel, Field,
  type RouletteItem, type LotteryPrize, type Prize, type QuizQuestion, type PickItem,
} from './panels'

type Tab = 'game' | 'items' | 'screen'

const HAS_ITEMS: Record<string, string> = {
  roulette: 'items', ladder: 'prizes', lottery: 'prizes', quiz: 'questions', pickboard: 'pickItems',
}

export default function GameConfig({ gameId, onHelp, port }: { gameId: string; onHelp?: () => void; port: number }) {
  const { settings, patchSettings, triggerGame, gameStates } = useApp()
  const [tab, setTab] = useState<Tab>('game')
  const game = gameById(gameId)!
  const g = (settings?.games as Record<string, Record<string, unknown>> | undefined)?.[gameId] ?? {}
  const status = gameStates[gameId]?.status ?? 'idle'
  const busy = status === 'running' || status === 'collecting'
  const save = (key: string, value: unknown) => patchSettings({ games: { [gameId]: { [key]: value } } })
  const enabled = (g.enabled as boolean) ?? true

  const itemKey = HAS_ITEMS[gameId]
  const itemCount = itemKey ? ((g[itemKey] as unknown[]) ?? []).length : 0
  const url = `http://localhost:${port}/overlay/${gameId}`

  const [cmd, setCmd] = useState<string | null>(null)
  const cmdValue = cmd ?? ((g.chatCommand as string) ?? '')

  return (
    <div className={`card ${styles.cfg}`}>
      <div className={styles.cfgHead}>
        <div>
          <div className="sec-title" style={{ fontSize: 22 }}>{game.name}</div>
          <div className="sec-desc" style={{ marginTop: 6 }}>{game.desc}입니다.</div>
        </div>
        <button className="btn btn-sm" onClick={onHelp}><Icon name="help" size={14} />도움말</button>
      </div>

      <div className="tabs" style={{ padding: '0 16px' }}>
        <button className={`tab ${tab === 'game' ? 'active' : ''}`} onClick={() => setTab('game')}>게임 설정</button>
        <button className={`tab ${tab === 'items' ? 'active' : ''}`} onClick={() => setTab('items')}>항목 설정{itemKey && <span className="cnt">{itemCount}</span>}</button>
        <button className={`tab ${tab === 'screen' ? 'active' : ''}`} onClick={() => setTab('screen')}>화면 설정</button>
      </div>

      <div className={styles.cfgBody}>
        {/* ── 게임 설정 ── */}
        {tab === 'game' && (<>
          <div className={styles.fields}>
            {game.engine && (
              <Field label="별풍선 트리거 (0=비활성)">
                <div className={styles.unitField}>
                  <input type="number" min={0} value={(g.balloonThreshold as number) ?? 0} onChange={e => save('balloonThreshold', Number(e.target.value))} />
                  <span>개</span>
                </div>
              </Field>
            )}
            {gameId === 'roulette' && (
              <Field label="스핀 시간 (ms)">
                <input type="number" min={1000} step={500} value={(g.spinDuration as number) ?? 3000} onChange={e => save('spinDuration', Number(e.target.value))} />
              </Field>
            )}
            {gameId === 'slot' && (
              <Field label="스핀 시간 (ms)">
                <input type="number" min={2000} max={6000} step={500} value={(g.spinDuration as number) ?? 3000} onChange={e => save('spinDuration', Number(e.target.value))} />
              </Field>
            )}
            {gameId === 'lottery' && (
              <Field label="스크래치 시간 (ms)">
                <input type="number" min={1000} max={8000} step={500} value={(g.scratchDuration as number) ?? 3000} onChange={e => save('scratchDuration', Number(e.target.value))} />
              </Field>
            )}
            {gameId === 'ladder' && (<>
              <Field label="참가 시간 (초)">
                <input type="number" min={5} value={(g.joinDuration as number) ?? 30} onChange={e => save('joinDuration', Number(e.target.value))} />
              </Field>
              <Field label="최대 참가 인원">
                <input type="number" min={2} value={(g.maxParticipants as number) ?? 8} onChange={e => save('maxParticipants', Number(e.target.value))} />
              </Field>
            </>)}
            {gameId === 'quiz' && (
              <Field label="자동 출제 제한 시간 (초)">
                <input type="number" min={5} max={300} value={(g.timeLimit as number) ?? 30} onChange={e => save('timeLimit', Number(e.target.value))} />
              </Field>
            )}
            {game.engine && (
              <Field label="채팅 명령어">
                <input value={cmdValue} placeholder="예: !룰렛" onChange={e => setCmd(e.target.value)} onBlur={() => { if (cmd !== null) { save('chatCommand', cmd.trim()); setCmd(null) } }} />
              </Field>
            )}
            {gameId === 'roulette' && (
              <Field label="애니메이션">
                <select value={(g.animType as string) ?? 'wheel'} onChange={e => save('animType', e.target.value)}>
                  <option value="wheel">원형 룰렛</option>
                  <option value="text">텍스트 슬롯</option>
                </select>
              </Field>
            )}
          </div>

          {gameId === 'number' && (
            <NumberPanel key="number" gSettings={g} gameStates={gameStates} saveSetting={save} />
          )}
          {gameId === 'pickboard' && (<>
            <PickBoardPanel key={`${(g.pickRows as number) ?? 4}x${(g.pickCols as number) ?? 5}`}
              rows={(g.pickRows as number) ?? 4} cols={(g.pickCols as number) ?? 5} items={(g.pickItems as PickItem[]) ?? []} />
            <div className={styles.note}>칸을 누르면 하나씩 공개되고 OBS 오버레이에 바로 반영됩니다. 칸 크기와 상품은 <b>항목 설정</b> 탭에서 바꿉니다.</div>
          </>)}
          {game.engine && (
            <KeywordEditor keywords={(g.weflabKeywords as string[]) ?? []} onSave={v => save('weflabKeywords', v)} />
          )}
          {['race', 'rps', 'fish'].includes(gameId) && (
            <div className={styles.note}>이 게임은 추가 설정이 없습니다. 별풍선 트리거 개수와 채팅 명령어만 정하면 됩니다.</div>
          )}
        </>)}

        {/* ── 항목 설정 ── */}
        {tab === 'items' && (<>
          {gameId === 'roulette'  && <RouletteEditor  key="r" items={(g.items as RouletteItem[]) ?? []} onSave={v => save('items', v)} />}
          {gameId === 'ladder'    && <LadderEditor    key="l" prizes={(g.prizes as Prize[]) ?? []} onSave={v => save('prizes', v)} />}
          {gameId === 'lottery'   && <LotteryEditor   key="lo" prizes={(g.prizes as LotteryPrize[]) ?? []} onSave={v => save('prizes', v)} />}
          {gameId === 'quiz'      && <QuizEditor      key="q" questions={(g.questions as QuizQuestion[]) ?? []} onSave={v => save('questions', v)} />}
          {gameId === 'pickboard' && (
            <PickBoardEditor key="p" items={(g.pickItems as PickItem[]) ?? []} rows={(g.pickRows as number) ?? 4} cols={(g.pickCols as number) ?? 5}
              onSave={v => save('pickItems', v)} onSaveSize={(r, c) => { save('pickRows', r); save('pickCols', c) }} />
          )}
          {gameId === 'slot'   && <div className={styles.note}>슬롯 심볼은 오른쪽 미리보기 패널에서 추가·삭제합니다. (이모지 또는 이미지 URL, 최소 3개)</div>}
          {gameId === 'number' && <div className={styles.note}>추첨 범위와 제외 번호는 <b>게임 설정</b> 탭에서 관리합니다.</div>}
          {['race', 'rps', 'fish'].includes(gameId) && <div className={styles.note}>이 게임은 편집할 항목이 없습니다.</div>}
        </>)}

        {/* ── 화면 설정 ── */}
        {tab === 'screen' && (<>
          {gameId === 'roulette' && (
            <div className={styles.field}>
              <label>애니메이션 타입</label>
              <div className={styles.animBtns}>
                {(['wheel', 'text'] as const).map(t => (
                  <button key={t} className={`${styles.animBtn} ${((g.animType as string) ?? 'wheel') === t ? styles.active : ''}`} onClick={() => save('animType', t)}>
                    {t === 'wheel' ? '원형 룰렛' : '텍스트 슬롯'}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className={styles.field}>
            <label>OBS 브라우저 소스 URL</label>
            <div className={styles.pvUrlRow}>
              <div className={styles.pvUrlBox}>{url}</div>
              <CopyBtn text={url} />
            </div>
            <div className="field-hint">OBS에서 '브라우저' 소스를 추가하고 위 URL을 입력하세요. 권장 크기 1920 × 1080, 배경 투명 허용.</div>
          </div>
          <div className={styles.note}>오버레이 색상·위치는 OBS 소스의 크기와 위치로 조정합니다. 앱을 업데이트하면 OBS의 브라우저 소스를 새로고침하세요.</div>
        </>)}
      </div>

      <div className={styles.cfgFoot}>
        <label className="switch-row">
          <span className="switch">
            <input type="checkbox" checked={enabled} onChange={e => save('enabled', e.target.checked)} />
            <span className="track" />
          </span>
          <b>자동 실행 {game.engine ? '(별풍선 감지 시)' : '(사용)'}</b>
        </label>
        {game.engine && (
          <button className="btn btn-dark" disabled={busy || !enabled} onClick={() => triggerGame(gameId)}>
            <Icon name="play" size={14} />{busy ? '진행 중…' : '테스트 실행'}
          </button>
        )}
      </div>
    </div>
  )
}

/** 위플랩 룰렛 결과 키워드 — 결과 텍스트에 포함되면 이 게임 실행 */
function KeywordEditor({ keywords, onSave }: { keywords: string[]; onSave: (v: string[]) => void }) {
  const [input, setInput] = useState('')
  const add = () => { const k = input.trim(); if (!k || keywords.includes(k)) { setInput(''); return } onSave([...keywords, k]); setInput('') }
  return (
    <div className={styles.field}>
      <label>위플랩 룰렛 키워드</label>
      <div className={styles.kwRow}>
        {keywords.map(k => (
          <span key={k} className={styles.kw}>{k}<button onClick={() => onSave(keywords.filter(x => x !== k))} title="삭제">×</button></span>
        ))}
        <div className="input-group" style={{ width: 220 }}>
          <input className="input" placeholder="키워드 입력 후 Enter" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
          <button className="btn" onClick={add}><Icon name="plus" size={14} /></button>
        </div>
      </div>
      <div className="field-hint">위플랩 룰렛 결과 문구에 이 키워드가 들어 있으면 이 게임이 실행됩니다. 비워 두면 위플랩 룰렛으로는 실행되지 않습니다.</div>
    </div>
  )
}

export function CopyBtn({ text, label = 'URL 복사', dark = true, className = '' }: { text: string; label?: string; dark?: boolean; className?: string }) {
  const [done, setDone] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1800) }).catch(() => {})
  }
  return (
    <button className={`btn ${dark ? 'btn-dark' : ''} ${className}`} onClick={copy} title={text}>
      <Icon name={done ? 'check' : 'copy'} size={14} />{done ? '복사됨' : label}
    </button>
  )
}
