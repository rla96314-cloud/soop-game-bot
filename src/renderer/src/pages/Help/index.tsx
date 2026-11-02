import styles from './Help.module.css'

const SECTIONS = [
  {
    title: '룰렛',
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
    title: '사다리타기',
    desc: '채팅 참가 → 사다리 → 결과 추첨 게임입니다.',
    items: [
      '참가 명령어를 채팅에 입력하면 자동 등록',
      '참가 시간(초) 및 최대 인원 설정 가능',
      '상품 목록을 미리 등록해 결과와 매핑',
      'OBS 오버레이 URL: /overlay/ladder',
    ],
  },
  {
    title: '뽑기판',
    desc: '후원이 들어오면 격자판의 칸을 열어 상품을 뽑는 게임입니다.',
    items: [
      '뽑기 방식 5종: 별풍 번호(후원 개수 = 칸 번호) · 채팅 번호(후원자가 채팅으로 번호) · 랜덤 · 순차 · 직접',
      '최소~최대 별풍선 범위로 참여 조건, 칸 번호 시작값, 번호 칸이 막혔을 때 랜덤 대체/건너뜀',
      '채팅 번호 방식은 후원자가 숫자(또는 "랜덤")를 칠 때까지 기다리고, 시간이 지나면 랜덤으로 엽니다',
      '꽝 문구 변경 가능 (사행성 경고 대비), 직접 누른 칸도 기록에 남고 CSV로 내보낼 수 있습니다',
      '행/열 개수와 상품별 이름·설명·색상·개수 설정, 후원이 몰리면 한 칸씩 차례로',
      'OBS 오버레이 URL: /overlay/pickboard',
    ],
  },
  {
    title: '퀴즈',
    desc: '채팅 정답 입력 경쟁 게임입니다.',
    items: [
      '문제/정답 목록을 미리 등록',
      '제한 시간(초) 설정',
      '가장 먼저 채팅에 정답을 입력한 시청자가 우승',
      'OBS 오버레이 URL: /overlay/quiz',
    ],
  },
  {
    title: '슬롯머신',
    desc: '3개 릴이 순차적으로 멈추는 슬롯 게임입니다.',
    items: [
      '심볼 이모지 또는 이미지 URL 자유롭게 설정',
      '3개 모두 일치 시 JACKPOT, 2개 일치 시 보너스',
      '스핀 시간(ms) 조절 가능',
      'OBS 오버레이 URL: /overlay/slot',
    ],
  },
  {
    title: '숫자 추첨',
    desc: '지정 범위 내 숫자를 랜덤 추첨합니다.',
    items: [
      '추첨 범위(최솟값~최댓값) 설정',
      '한 번에 추첨할 개수 설정',
      '제외 번호 목록으로 이미 뽑은 번호 제외 가능',
      'OBS 오버레이 URL: /overlay/number',
    ],
  },
  {
    title: 'OBS 오버레이 연결',
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
    title: '설정',
    desc: '앱 전체 동작을 제어합니다.',
    items: [
      'SOOP 계정 정보: 채널ID / 사용자ID / 토큰',
      '별풍선 자동 트리거 전역 ON/OFF',
      '전역 기본 임계값 설정',
      '오버레이 포트 변경 (기본 3939)',
      '화면은 창 크기에 맞춰 자동 배율, UI 배율은 그 위에 추가 적용',
      'SOOP 연결 끊김 시 다시 연결 버튼 사용',
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
