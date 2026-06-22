import { useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import styles from './Boss.module.css'

interface BossLootItem   { name: string; description: string }
interface BossParticipant { totalDamage: number; attackCount: number; critCount: number; pendingBalloons: number }
interface BossRollResult  { user: string; roll: number; damage: number; isCritical: boolean; ts: number }
interface BossLootResult  { user: string; item: BossLootItem; contributionRate: number }
interface BossStateData {
  alive: boolean; maxHp: number; currentHp: number; bossName: string
  damagePerDot: number; critChance: number; critEnabled: boolean; critMultiplier: number
  balloonThreshold: number; participants: Record<string, BossParticipant>
  lastRoll?: BossRollResult; lootResults?: BossLootResult[]
}

function BossLootEditor({ list, onSave }: { list: BossLootItem[]; onSave: (v: BossLootItem[]) => void }) {
  const add    = () => onSave([...list, { name: '', description: '' }])
  const remove = (i: number) => onSave(list.filter((_, j) => j !== i))
  const update = (i: number, k: keyof BossLootItem, v: string) =>
    onSave(list.map((x, j) => j === i ? { ...x, [k]: v } : x))
  return (
    <div className={styles.lootEditor}>
      <div className={styles.lootHeader}>
        <span className={styles.lootTitle}>전리품 목록</span>
        <button className={styles.addBtn} onClick={add}>+ 추가</button>
      </div>
      {list.map((item, i) => (
        <div key={i} className={styles.lootRow}>
          <span className={styles.lootNum}>{i + 1}</span>
          <input className={styles.input} value={item.name} onChange={e => update(i, 'name', e.target.value)} placeholder="상품명" style={{ flex: 1 }} />
          <input className={styles.input} value={item.description} onChange={e => update(i, 'description', e.target.value)} placeholder="설명" style={{ flex: 1.5 }} />
          <button className={styles.removeBtn} onClick={() => remove(i)}>×</button>
        </div>
      ))}
      {list.length === 0 && <p className={styles.empty}>전리품을 추가하세요.</p>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}

function ObsUrlChip() {
  const [copied, setCopied] = useState(false)
  const url = 'http://localhost:3939/overlay/boss'
  return (
    <button
      className={`${styles.obsChip} ${copied ? styles.obsChipCopied : ''}`}
      onClick={() => { navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }}
      title={url}
    >
      {copied ? '복사됨' : 'OBS URL'}
    </button>
  )
}

export default function BossPage() {
  const { settings, patchSettings, gameStates } = useApp()
  const el = (window as unknown as Record<string, Record<string, unknown>>).electron

  const gSettings = (settings?.games as Record<string, Record<string, unknown>> | undefined)?.boss ?? {}
  const saveS     = (key: string, value: unknown) => patchSettings({ games: { boss: { [key]: value } } })

  const state  = gameStates['boss']
  const boss   = state?.boss as BossStateData | undefined
  const status = (state?.status as string) ?? 'idle'

  const [bossName,    setBossName]    = useState((gSettings.bossName         as string)  ?? '보스')
  const [maxHp,       setMaxHp]       = useState((gSettings.maxHp            as number)  ?? 100000)
  const [dmgPerDot,   setDmgPerDot]   = useState((gSettings.damagePerDot     as number)  ?? 100)
  const [threshold,   setThreshold]   = useState((gSettings.balloonThreshold as number)  ?? 100)
  const [critEnabled, setCritEnabled] = useState((gSettings.critEnabled       as boolean) !== false)
  const [critChance,  setCritChance]  = useState(Math.round(((gSettings.critChance as number) ?? 0.15) * 100))
  const [critMult,    setCritMult]    = useState((gSettings.critMultiplier    as number)  ?? 2)
  const [lootItems,   setLootItems]   = useState<BossLootItem[]>((gSettings.lootItems as BossLootItem[]) ?? [])

  const hpPct   = boss ? Math.max(0, (boss.currentHp / boss.maxHp) * 100) : 100
  const hpColor = hpPct > 60 ? '#10B981' : hpPct > 30 ? '#F59E0B' : '#EF4444'
  const parts   = boss?.participants ? Object.entries(boss.participants) : []
  const totalDmg= parts.reduce((s, [, p]) => s + (p as BossParticipant).totalDamage, 0)

  const startRaid = async () => {
    saveS('bossName', bossName); saveS('maxHp', maxHp); saveS('damagePerDot', dmgPerDot)
    saveS('balloonThreshold', threshold); saveS('critEnabled', critEnabled)
    saveS('critChance', critChance / 100); saveS('critMultiplier', critMult); saveS('lootItems', lootItems)
    await new Promise(r => setTimeout(r, 100))
    await (el.bossStart as () => Promise<unknown>)()
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div>
            <h1 className={styles.title}>보스전</h1>
            <p className={styles.sub}>별풍선 누적 → 주사위 → 데미지 → 전리품</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <ObsUrlChip />
          {status === 'idle' && (
            <button className={styles.startBtn} onClick={startRaid}>레이드 시작</button>
          )}
        </div>
      </div>

      {/* ── 항상 노출: 현재 보스 HP 미니 바 ── */}
      {boss && (
        <div className={styles.hpStatusBar}>
          <span className={styles.hpStatusName}>{boss.bossName}</span>
          <div className={styles.hpStatusTrack}>
            <div className={styles.hpStatusFill} style={{ width: `${hpPct}%`, background: hpColor }} />
          </div>
          <span className={styles.hpStatusNum}>
            {boss.currentHp.toLocaleString()} / {boss.maxHp.toLocaleString()}
          </span>
          <span className={styles.hpStatusPct}>{hpPct.toFixed(0)}%</span>
          {status === 'running' && <span className={styles.hpStatusBadge}>전투 중</span>}
          {status === 'collecting' && <span className={styles.hpStatusBadge}>주사위 대기</span>}
          {status === 'showing_result' && <span className={styles.hpStatusBadge} style={{ background: 'rgba(245,158,11,0.2)', color: '#F59E0B' }}>처치!</span>}
        </div>
      )}

      {status === 'idle' && (
        <div className={styles.body}>
          <div className={styles.col}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>기본 설정</h2>
              <div className={styles.fieldGrid}>
                <Field label="보스 이름"><input className={styles.input} value={bossName} onChange={e => setBossName(e.target.value)} /></Field>
                <Field label="최대 HP"><input className={styles.input} type="number" min={1000} step={1000} value={maxHp} onChange={e => setMaxHp(Number(e.target.value))} /></Field>
                <Field label="풍선당 데미지"><input className={styles.input} type="number" min={1} value={dmgPerDot} onChange={e => setDmgPerDot(Number(e.target.value))} /></Field>
                <Field label="트리거 별풍선"><input className={styles.input} type="number" min={1} value={threshold} onChange={e => setThreshold(Number(e.target.value))} /></Field>
              </div>
            </section>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>크리티컬 설정</h2>
              <div className={styles.fieldGrid}>
                <Field label="크리티컬 활성화">
                  <label className={styles.toggleWrap}>
                    <input type="checkbox" className={styles.toggleInput} checked={critEnabled} onChange={e => setCritEnabled(e.target.checked)} />
                    <span className={styles.toggleTrack}><span className={styles.toggleThumb} /></span>
                    <span className={styles.toggleLabel}>{critEnabled ? '활성' : '비활성'}</span>
                  </label>
                </Field>
                <Field label="크리티컬 확률 (%)"><input className={styles.input} type="number" min={1} max={100} value={critChance} onChange={e => setCritChance(Number(e.target.value))} disabled={!critEnabled} /></Field>
                <Field label="크리티컬 배율"><input className={styles.input} type="number" min={1.1} step={0.1} value={critMult} onChange={e => setCritMult(Number(e.target.value))} disabled={!critEnabled} /></Field>
              </div>
            </section>
          </div>
          <div className={styles.col}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>전리품</h2>
              <BossLootEditor list={lootItems} onSave={next => { setLootItems(next); saveS('lootItems', next) }} />
            </section>
          </div>
        </div>
      )}

      {(status === 'running' || status === 'collecting') && boss && (
        <div className={styles.body}>
          <div className={styles.col}>
            <section className={styles.section}>
              <div className={styles.bossNameRow}>
                <span className={styles.bossNameText}>{boss.bossName}</span>
                <span className={styles.hpText}>{boss.currentHp.toLocaleString()} / {boss.maxHp.toLocaleString()}</span>
              </div>
              <div className={styles.hpTrack}><div className={styles.hpFill} style={{ width: `${hpPct}%`, background: hpColor }} /></div>
              <div className={styles.hpPctLabel}>{hpPct.toFixed(1)}%</div>
            </section>
            {boss.lastRoll && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>최근 공격</h2>
                <div className={`${styles.diceCard} ${boss.lastRoll.isCritical ? styles.diceCardCrit : ''}`}>
                  <div className={styles.diceVal}>{boss.lastRoll.roll}</div>
                  <div className={styles.diceInfo}>
                    <span className={styles.diceUser}>{boss.lastRoll.user}</span>
                    <span className={styles.diceDmg}>
                      {boss.lastRoll.isCritical && <span className={styles.critBadge}>CRIT!</span>}
                      -{boss.lastRoll.damage.toLocaleString()} HP
                    </span>
                  </div>
                </div>
              </section>
            )}
          </div>
          <div className={styles.col}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>참여자 데미지</h2>
              <div className={styles.dmgTable}>
                {parts
                  .sort((a, b) => (b[1] as BossParticipant).totalDamage - (a[1] as BossParticipant).totalDamage)
                  .map(([user, p], i) => {
                    const pp  = p as BossParticipant
                    const pct = totalDmg > 0 ? (pp.totalDamage / totalDmg * 100) : 0
                    return (
                      <div key={user} className={styles.dmgRow}>
                        <span className={styles.dmgRank}>{i + 1}</span>
                        <span className={styles.dmgUser}>{user}</span>
                        <div className={styles.dmgBarWrap}><div className={styles.dmgBar} style={{ width: `${pct}%` }} /></div>
                        <span className={styles.dmgVal}>{pp.totalDamage.toLocaleString()}</span>
                        <span className={styles.dmgCrit}>{pp.critCount}크리</span>
                      </div>
                    )
                  })}
                {parts.length === 0 && <p className={styles.empty}>아직 공격자 없음</p>}
              </div>
            </section>
          </div>
        </div>
      )}

      {status === 'showing_result' && boss && (
        <div className={styles.body}>
          <div className={styles.resultBanner}>
            <span className={styles.resultTitle}>보스 처치!</span>
          </div>
          {boss.lootResults && boss.lootResults.length > 0 && (
            <div className={styles.lootGrid}>
              {boss.lootResults.map((lr, i) => (
                <div key={i} className={styles.lootCard}>
                  <div className={styles.lootCardRank}>#{i + 1}</div>
                  <div className={styles.lootCardUser}>{lr.user}</div>
                  <div className={styles.lootCardItem}>{lr.item.name}</div>
                  <div className={styles.lootCardDesc}>{lr.item.description}</div>
                  <div className={styles.lootCardPct}>{(lr.contributionRate * 100).toFixed(1)}% 기여</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
