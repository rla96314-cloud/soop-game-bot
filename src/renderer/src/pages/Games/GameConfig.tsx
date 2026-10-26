// 가운데 설정 카드: 게임 설정 / 항목 설정 / 화면 설정 탭 + 자동 실행 토글 + 테스트 실행
import { useEffect, useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import { gameById } from '../../games'
import Icon from '../../components/Icon'
import NumberField from '../../components/NumberField'
import styles from './Games.module.css'
import {
  RouletteEditor, LotteryEditor, LadderEditor, QuizEditor, PickBoardEditor, PickBoardPanel, NumberPanel, Field,
  type RouletteItem, type LotteryPrize, type Prize, type QuizQuestion, type PickItem,
} from './panels'
import { RaceEditor, FishEditor, type RaceRacer, type FishItem } from './extraGames'

type Tab = 'game' | 'items' | 'screen'

const HAS_ITEMS: Record<string, string> = {
  roulette: 'items', ladder: 'prizes', lottery: 'prizes', quiz: 'questions', pickboard: 'pickItems', race: 'racers', fish: 'fishes',
}

export default function GameConfig({ gameId, onHelp, port }: { gameId: string; onHelp?: () => void; port: number }) {
  const { settings, patchSettings, triggerGame, gameStates } = useApp()
  const [tab, setTab] = useState<Tab>('game')
  const game = gameById(gameId)!
  const g = (settings?.games as Record<string, Record<string, unknown>> | undefined)?.[gameId] ?? {}
  const status = gameStates[gameId]?.status ?? 'idle'
  const busy = status === 'running' || status === 'collecting'
  const queued = (gameStates[gameId]?.queued as number | undefined) ?? 0
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
                  <NumberField min={0} max={1000000} value={(g.balloonThreshold as number) ?? 0} onCommit={v => save('balloonThreshold', v)} />
                  <span>개</span>
                </div>
              </Field>
            )}
            {gameId === 'roulette' && (
              <Field label="스핀 시간 (ms)">
                <NumberField min={1000} max={15000} step={500} value={(g.spinDuration as number) ?? 3000} onCommit={v => save('spinDuration', v)} />
              </Field>
            )}
            {gameId === 'slot' && (
              <Field label="스핀 시간 (ms)">
                <NumberField min={2000} max={8000} step={500} value={(g.spinDuration as number) ?? 3000} onCommit={v => save('spinDuration', v)} />
              </Field>
            )}
            {gameId === 'lottery' && (
              <Field label="스크래치 시간 (ms)">
                <NumberField min={1000} max={8000} step={500} value={(g.scratchDuration as number) ?? 3000} onCommit={v => save('scratchDuration', v)} />
              </Field>
            )}
            {gameId === 'ladder' && (<>
              <Field label="참가 시간 (초)">
                <NumberField min={5} max={600} value={(g.joinDuration as number) ?? 30} onCommit={v => save('joinDuration', v)} />
              </Field>
              <Field label="최대 참가 인원">
                <NumberField min={2} max={50} value={(g.maxParticipants as number) ?? 8} onCommit={v => save('maxParticipants', v)} />
              </Field>
              <Field label="줄 공개">
                <label className="switch-row" title="끄면 스트리머가 줄을 하나씩 골라 공개합니다">
                  <span className="switch">
                    <input type="checkbox" checked={!!g.autoReveal} onChange={e => save('autoReveal', e.target.checked)} />
                    <span className="track" />
                  </span>
                  <span>{g.autoReveal ? '자동으로 차례대로' : '스트리머가 직접 고르기'}</span>
                </label>
              </Field>
            </>)}
            {gameId === 'race' && (<>
              <Field label="예측 접수 시간 (초)">
                <NumberField min={5} max={600} value={(g.joinDuration as number) ?? 20} onCommit={v => save('joinDuration', v)} />
              </Field>
              <Field label="경주 시간 (ms)">
                <NumberField min={3000} max={30000} step={500} value={(g.raceDuration as number) ?? 8000} onCommit={v => save('raceDuration', v)} />
              </Field>
            </>)}
            {gameId === 'rps' && (
              <Field label="참가 접수 시간 (초)">
                <NumberField min={5} max={600} value={(g.joinDuration as number) ?? 15} onCommit={v => save('joinDuration', v)} />
              </Field>
            )}
            {gameId === 'fish' && (
              <Field label="낚시 연출 시간 (ms)">
                <NumberField min={2000} max={15000} step={500} value={(g.castDuration as number) ?? 4000} onCommit={v => save('castDuration', v)} />
              </Field>
            )}
            {gameId === 'quiz' && (
              <Field label="자동 출제 제한 시간 (초)">
                <NumberField min={5} max={600} value={(g.timeLimit as number) ?? 30} onCommit={v => save('timeLimit', v)} />
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
            <PickBoardPanel />
            <div className={styles.note}>칸을 누르면 하나씩 공개되고 OBS 오버레이에 바로 반영됩니다. 칸 크기와 상품은 <b>항목 설정</b> 탭에서 바꿉니다.</div>
          </>)}
          {game.engine && (
            <KeywordEditor keywords={(g.weflabKeywords as string[]) ?? []} onSave={v => save('weflabKeywords', v)} />
          )}
          {gameId === 'race' && <div className={styles.note}>실행하면 예측 접수가 열리고, 시청자가 <b>{cmdValue || '!경주'} 번호</b>로 1등을 예측합니다. 접수가 닫히면 경주가 시작되고 적중자가 발표됩니다. 대기 중에 시청자가 명령어를 치면 바로 시작됩니다.</div>}
          {gameId === 'rps' && <div className={styles.note}>실행하면 참가 접수가 열리고, 시청자가 <b>{cmdValue || '!묵찌빠'} 가위/바위/보</b>로 손을 냅니다. 마감되면 스트리머의 손이 무작위로 정해지고 이긴 시청자가 발표됩니다. 대기 중에 시청자가 명령어를 치면 바로 시작됩니다.</div>}
          {gameId === 'fish' && <div className={styles.note}>실행할 때마다 한 마리를 낚습니다. 시청자별 점수와 마리 수는 앱을 껐다 켜도 유지되며, 오른쪽 미리보기에서 랭킹을 볼 수 있습니다.</div>}
        </>)}

        {/* ── 항목 설정 ── */}
        {tab === 'items' && (<>
          {gameId === 'roulette'  && <RouletteEditor  key="r" items={(g.items as RouletteItem[]) ?? []} onSave={v => save('items', v)} />}
          {gameId === 'ladder'    && <LadderEditor    key="l" prizes={(g.prizes as Prize[]) ?? []} onSave={v => save('prizes', v)} />}
          {gameId === 'lottery'   && <LotteryEditor   key="lo" prizes={(g.prizes as LotteryPrize[]) ?? []} onSave={v => save('prizes', v)} />}
          {gameId === 'quiz'      && <QuizEditor      key="q" questions={(g.questions as QuizQuestion[]) ?? []} onSave={v => save('questions', v)} />}
          {gameId === 'race'      && <RaceEditor key="ra" racers={(g.racers as RaceRacer[]) ?? []} onSave={v => save('racers', v)} />}
          {gameId === 'fish'      && <FishEditor key="fi" fishes={(g.fishes as FishItem[]) ?? []} onSave={v => save('fishes', v)} />}
          {gameId === 'pickboard' && (
            <PickBoardEditor key="p" items={(g.pickItems as PickItem[]) ?? []} rows={(g.pickRows as number) ?? 4} cols={(g.pickCols as number) ?? 5}
              onSave={v => save('pickItems', v)} onSaveSize={(r, c) => { save('pickRows', r); save('pickCols', c) }} />
          )}
          {gameId === 'slot'   && <div className={styles.note}>슬롯 심볼은 오른쪽 미리보기 패널에서 추가·삭제합니다. (이모지 또는 이미지 URL, 최소 3개)</div>}
          {gameId === 'number' && <div className={styles.note}>추첨 범위와 제외 번호는 <b>게임 설정</b> 탭에서 관리합니다.</div>}
          {gameId === 'rps' && <div className={styles.note}>가위바위보는 편집할 항목이 없습니다. 접수 시간은 <b>게임 설정</b> 탭에서 바꿉니다.</div>}
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
          {gameId === 'fish' && <FishMediaPanel />}
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
            <Icon name="play" size={14} />{busy ? (queued > 0 ? `진행 중… (대기 ${queued})` : '진행 중…') : '테스트 실행'}
          </button>
        )}
      </div>
    </div>
  )
}

/** 낚시 영상 클립 폴더 — 클립을 넣으면 내장 애니메이션 대신 영상을 단계별로 재생 */
const FISH_CLIPS: Array<[string, string]> = [
  ['cast', '찌 던지기'], ['wait', '기다리기'], ['bite', '입질'], ['hook', '챔질'],
  ['result-common', '결과 · 일반'], ['result-uncommon', '결과 · 고급'], ['result-rare', '결과 · 희귀'], ['result-legendary', '결과 · 전설'],
]
function FishMediaPanel() {
  const [info, setInfo] = useState<{ dir: string; files: string[] } | null>(null)
  const el = (window as unknown as Record<string, Record<string, unknown>>).electron
  const load = () => {
    const list = el?.mediaList as ((g: string) => Promise<{ dir: string; files: string[] } | null>) | undefined
    list?.('fish').then(setInfo).catch(() => setInfo(null))
  }
  useEffect(() => { load() }, [])
  const has = (name: string) => (info?.files ?? []).some(f => new RegExp(`^${name}\\.(mp4|webm|mov)$`, 'i').test(f))
  const videoMode = has('cast') && (has('result') || FISH_CLIPS.slice(4).some(([n]) => has(n)))
  return (
    <div className={styles.field}>
      <label>낚시 영상 클립 <span style={{ fontWeight: 500, color: videoMode ? 'var(--ok)' : 'var(--muted)' }}>· {videoMode ? '영상 모드' : '내장 애니메이션 모드'}</span></label>
      <div className={styles.note} style={{ marginBottom: 10 }}>
        아래 이름으로 mp4/webm 파일을 폴더에 넣으면 "찌 던지기 → 입질 → 챔질 → 결과"를 그 영상으로 재생합니다. <b>cast</b>와 <b>result</b>(또는 등급별 result-*)만 있어도 영상 모드가 되고, 빠진 단계는 내장 애니메이션으로 대체됩니다. 단계 길이보다 긴 영상은 잘리고 짧으면 마지막 화면에서 멈춥니다.
      </div>
      <div className={styles.kwRow} style={{ marginBottom: 10 }}>
        {FISH_CLIPS.map(([n, label]) => (
          <span key={n} className={styles.kw} style={{ background: has(n) ? 'var(--ok)' : 'var(--surface2)', color: has(n) ? '#fff' : 'var(--muted)', border: '1px solid var(--line)' }} title={`${n}.mp4`}>
            {has(n) ? '✓ ' : ''}{label}
          </span>
        ))}
      </div>
      <div className={styles.pvUrlRow}>
        <div className={styles.pvUrlBox} style={{ color: 'var(--text2)' }}>{info?.dir ?? '폴더 정보를 불러오는 중…'}</div>
        <button className="btn btn-dark" onClick={() => (el?.mediaOpenFolder as (g: string) => Promise<unknown>)?.('fish')}><Icon name="external" size={14} />폴더 열기</button>
        <button className="btn" onClick={load}><Icon name="refresh" size={14} /></button>
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
