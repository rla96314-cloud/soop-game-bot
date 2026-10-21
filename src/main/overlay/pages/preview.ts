// OBS 오버레이 페이지: preview (HTML 템플릿 문자열)
// 모든 오버레이를 한 화면에 iframe 그리드로 미리보기 (1920×1080)
export const PREVIEW_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700;800;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--navy:#172437;--navy-deep:#111a2b;--orange:#FF5B17;--cream:#F5F3EF;--line:#D9D3C6}
html,body{width:1920px;height:1080px;overflow:hidden;background:#070b13;font-family:'Noto Sans KR',sans-serif}
.grid{display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(3,1fr);gap:10px;padding:10px;width:1920px;height:1080px}
.cell{position:relative;background:linear-gradient(170deg,#1b2b45 0%,var(--navy) 55%,var(--navy-deep) 100%);border-radius:12px;overflow:hidden;border:1.5px solid rgba(217,211,198,.7);box-shadow:0 8px 22px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.05)}
/* 탭 오른쪽으로 이어지는 오렌지 상단 라인 */
.cell::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:var(--orange);z-index:9;border-radius:12px 12px 0 0}
/* 좌상단 사선 라벨 탭: 크림 테두리 → 네이비 본체 → 오렌지 슬래시 */
.label{position:absolute;top:-1px;left:-1px;z-index:10;height:36px;padding:0 40px 0 26px;display:flex;align-items:center;font-size:16px;font-weight:800;color:#fff;letter-spacing:0.02em;pointer-events:none;background:var(--line);clip-path:polygon(0 0,calc(100% - 22px) 0,100% 100%,0 100%);border-radius:12px 0 0 0}
.label::before{content:'';position:absolute;inset:0 1.5px 1.5px 0;background:var(--navy);clip-path:polygon(0 0,calc(100% - 22px) 0,100% 100%,0 100%);border-radius:12px 0 0 0}
.label::after{content:'';position:absolute;left:0;top:0;bottom:1.5px;width:24px;background:var(--orange);clip-path:polygon(10px 0,20px 0,10px 100%,0 100%)}
.label span{position:relative;z-index:2}
iframe{position:absolute;top:0;left:0;width:1920px;height:1080px;border:none;transform-origin:top left;pointer-events:none}
</style>
</head>
<body>
<div class="grid" id="grid"></div>
<script>
const GAMES=[
  {id:'roulette',  name:'룰렛'},
  {id:'ladder',    name:'사다리타기'},
  {id:'slot',      name:'슬롯머신'},
  {id:'quiz',      name:'퀴즈'},
  {id:'number',    name:'숫자추첨'},
  {id:'lottery',   name:'행운복권'},
  {id:'pickboard', name:'뽑기판'},
  {id:'race',      name:'동물경주'},
  {id:'rps',       name:'가위바위보'},
  {id:'fish',      name:'낚시'},
]
const grid=document.getElementById('grid')
function layout(){
  // grid 1920×1080, padding 10, gap 10 → 측정 없이 계산 (OBS CEF 는 offsetWidth 가 불안정)
  const cellW=(1920-20-30)/4
  const cellH=(1080-20-20)/3
  const scale=Math.min(cellW/1920, cellH/1080)
  grid.querySelectorAll('iframe').forEach(f=>{f.style.transform='scale('+scale+')'})
}
GAMES.forEach(g=>{
  const cell=document.createElement('div')
  cell.className='cell'
  cell.innerHTML='<div class="label"><span>'+g.name+'</span></div><iframe src="http://localhost:${port}/overlay/'+g.id+'" scrolling="no"></iframe>'
  grid.appendChild(cell)
})
layout()
window.addEventListener('resize',layout)
<\/script>
</body>
</html>`
