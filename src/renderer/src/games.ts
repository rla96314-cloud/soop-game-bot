// 게임 목록 메타데이터 (화면 전역 공용)
import type { IconName } from './components/Icon'

export interface GameMeta {
  id:    string
  name:  string
  desc:  string
  color: string
  icon:  IconName
  /** 엔진이 돌리는 게임인지 (뽑기판은 렌더러에서 직접 진행) */
  engine: boolean
}

export const GAMES: GameMeta[] = [
  { id: 'roulette',  name: '룰렛',      desc: '항목을 돌려 당첨 결과를 추첨하는 게임',   color: '#ff5b17', icon: 'roulette',  engine: true  },
  { id: 'ladder',    name: '사다리타기', desc: '참여자 중 당첨자를 뽑는 게임',            color: '#12a866', icon: 'ladder',    engine: true  },
  { id: 'pickboard', name: '뽑기판',     desc: '칸을 선택해 상품을 뽑는 게임',            color: '#ff7a3d', icon: 'pickboard', engine: false },
  { id: 'quiz',      name: '퀴즈',      desc: '질문과 보기로 진행하는 퀴즈 게임',        color: '#2f6bff', icon: 'quiz',      engine: true  },
  { id: 'slot',      name: '슬롯머신',   desc: '3개의 슬롯으로 잭팟을 노리는 게임',       color: '#7a3cff', icon: 'slot',      engine: true  },
  { id: 'race',      name: '경주',      desc: '캐릭터 경주 시뮬레이션 게임',             color: '#00a884', icon: 'race',      engine: true  },
  { id: 'rps',       name: '가위바위보', desc: '시청자와 대결하는 가위바위보 게임',       color: '#e0342c', icon: 'rps',       engine: true  },
  { id: 'fish',      name: '낚시',      desc: '물고기를 낚아 아이템을 획득하는 게임',    color: '#1aa7d8', icon: 'fishing',   engine: true  },
  { id: 'lottery',   name: '복권',      desc: '복권을 긁어 당첨을 노리는 게임',          color: '#f2a600', icon: 'lottery',   engine: true  },
  { id: 'number',    name: '숫자 추첨',  desc: '랜덤 숫자를 추첨하는 게임',               color: '#2f6bff', icon: 'number',    engine: true  },
]

export const gameById = (id: string) => GAMES.find(g => g.id === id)
export const gameName  = (id: string) => gameById(id)?.name ?? id
export const gameColor = (id: string) => gameById(id)?.color ?? '#657084'

/** 결과 문자열 → 상태 분류 (기록 화면 배지) */
export function classifyResult(result: string): 'ok' | 'jackpot' | 'fail' {
  const r = result ?? ''
  if (/JACKPOT|레전드|황금어|상금|legendary/i.test(r)) return 'jackpot'
  if (/꽝|시간 초과|오답|패배|시청자 승/.test(r)) return 'fail'
  return 'ok'
}
export const RESULT_LABEL = { ok: '성공', jackpot: '대박', fail: '실패' } as const
