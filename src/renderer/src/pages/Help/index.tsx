import styles from './Help.module.css'

const SECTIONS = [
  {
    title: '🎡 룰렛',
    desc: '별풍선 후원 시 룰렛을 돌려 결과를 추첨합니다.',
    items: [
      '별풍선 트리거 개수를 설정 (0 = 비활성)',
      '항목별 확률(%) 합계가 100이 되도록 설정',
      '애니메이션 타입: 원형 룰렛 / 텍스트 슬롯',
      'weflab 연동: weflab 룰렛 결과를 감지해 자동 실행',
      'OBS 오버레이 URL: /overlay/roulette',
    ],
  },
  {
    title: '🪜 사다리타기',
    desc: '채팅 참가 → 사다리 → 결과 추첨 게임입니다.',
    items: [
      '참가 명령어를 채팅에 입력하면 자동 등록',
      '참가 시간(초) 및 최대 인원 설정 가능',
      '상품 목록을 미리 등록해 결과와 매핑',
      'OBS 오버레이 URL: /overlay/ladder',
    ],
  },
  {
    title: '👾 보스전',
    desc: '별풍선 누적 → 12면체 주사위 → 데미지 방식의 레이드 게임입니다.',
    items: [
      '사이드바 "보스전" 메뉴에서 레이드 시작',
      '트리거 별풍선 개수에 도달하면 주사위 1회 자동 실행',
      '크리티컬 확률/배율 설정 가능',
      '보스 처치 시 기여도에 따라 전리품 랜덤 배분',
      'OBS 오버레이 URL: /overlay/boss',
    ],
  },
  {
    title: '🎯 뽑기판',
    desc: '격자판에서 랜덤으로 아이템을 선택하는 게임입니다.',
    items: [
      '행/열 개수와 아이템 배치 설정',
      '아이템별 이름·설명·색상·개수 설정 가능',
      '화면에서 클릭하면 하나씩 공개',
    ],
  },
  {
    title: '❓ 퀴즈',
    desc: '채팅 정답 입력 경쟁 게임입니다.',
    items: [
      '문제/정답 목록을 미리 등록',
      '제한 시간(초) 설정',
      '가장 먼저 채팅에 정답을 입력한 시청자가 우승',
      'OBS 오버레이 URL: /overlay/quiz',
    ],
  },
  {
    title: '🎰 슬롯머신',
    desc: '3개 릴이 순차적으로 멈추는 슬롯 게임입니다.',
    items: [
      '심볼 이모지 또는 이미지 URL 자유롭게 설정',
      '3개 모두 일치 시 JACKPOT, 2개 일치 시 보너스',
      '스핀 시간(ms) 조절 가능',
      'OBS 오버레이 URL: /overlay/slot',
    ],
  },
  {
    title: '🔢 숫자 추첨',
    desc: '지정 범위 내 숫자를 랜덤 추첨합니다.',
    items: [
      '추첨 범위(최솟값~최댓값) 설정',
      '한 번에 추첨할 개수 설정',
      '제외 번호 목록으로 이미 뽑은 번호 제외 가능',
      'OBS 오버레이 URL: /overlay/number',
    ],
  },
  {
    title: '📺 OBS 오버레이 연결',
    desc: 'OBS 브라우저 소스에 각 게임의 URL을 추가하면 실시간으로 결과가 표시됩니다.',
    items: [
      'OBS > 소스 추가 > 브라우저 소스',
      '너비: 1920 / 높이: 1080 권장',
      '"배경 투명도 허용" 체크',
      '게임 관리 탭 또는 OBS 오버레이 메뉴에서 URL 복사 가능',
      '기본 포트: 3939 (설정에서 변경 가능)',
    ],
  },
  {
    title: '⚙️ 설정',
    desc: '앱 전체 동작을 제어합니다.',
    items: [
      'SOOP 계정 정보: 채널ID / 사용자ID / 토큰',
      '별풍선 자동 트리거 전역 ON/OFF',
      '전역 기본 임계값 설정',
      '오버레이 포트 변경 (기본 3939)',
      'SOOP 연결 끊김 시 재연결 버튼 사용',
    ],
  },
]

export default function HelpPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>도움말</h1>
        <p className={styles.sub}>SOOP Game Bot에서 현재 사용 가능한 기능 안내입니다.</p>
      </div>
      <div className={styles.grid}>
        {SECTIONS.map(s => (
          <div key={s.title} className={styles.card}>
            <div className={styles.cardTitle}>{s.title}</div>
            <p className={styles.cardDesc}>{s.desc}</p>
            <ul className={styles.list}>
              {s.items.map((item, i) => (
                <li key={i} className={styles.item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
