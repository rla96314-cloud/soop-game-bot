// OBS 오버레이 페이지: monitor (HTML 템플릿 문자열)
// 운영자용 게임 모니터링 대시보드 (1920×1080)
export const MONITOR_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@500;700;800;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--navy:#172437;--navy-deep:#111a2b;--navy-light:#1d2e48;--orange:#FF5B17;--cream:#F5F3EF;--mint:#00CB84;--blue:#2E7BFF}
html,body{width:1920px;height:1080px;overflow:hidden;background:#0a0f19;font-family:'Noto Sans KR',sans-serif;color:var(--cream)}
body{background:radial-gradient(90% 70% at 50% 0%,#101a2c 0%,#0a0f19 70%)}

/* ── 상단 바 ── */
.hd{position:relative;height:88px;padding:22px 26px 0;display:flex;align-items:flex-start;justify-content:space-between}
.hd-title{position:relative;display:flex;align-items:center;gap:16px;height:54px;padding:0 70px 0 22px;background:var(--navy);border-radius:12px 0 0 12px;clip-path:polygon(0 0,calc(100% - 42px) 0,100% 100%,0 100%);font-size:27px;font-weight:900;color:#fff;letter-spacing:-0.01em;filter:drop-shadow(0 6px 14px rgba(0,0,0,.45))}
.hd-title::before{content:'';position:absolute;left:0;top:0;height:4px;width:calc(100% - 38px);background:var(--orange);border-radius:12px 0 0 0}
.hd-title::after{content:'';position:absolute;right:0;top:0;bottom:0;width:14px;background:var(--orange);clip-path:polygon(0 0,100% 100%,calc(100% - 6px) 100%,-6px 0)}
.hd-title i{display:block;width:8px;height:30px;background:var(--orange);border-radius:2px}
.hd-clock{height:46px;padding:0 20px;display:flex;align-items:center;background:var(--navy);border-radius:10px;border-left:5px solid var(--orange);font-size:23px;font-weight:800;color:#A9C8FF;font-variant-numeric:tabular-nums;letter-spacing:0.02em;box-shadow:0 6px 14px rgba(0,0,0,.45)}

/* ── 카드 그리드 ── */
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;padding:6px 24px 24px;height:calc(100% - 88px)}
.card{position:relative;background:radial-gradient(120% 80% at 100% 0%,rgba(255,255,255,.04),transparent 60%),linear-gradient(170deg,var(--navy-light) 0%,var(--navy) 55%,var(--navy-deep) 100%);border:2px solid #E7E2D7;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 10px 28px rgba(0,0,0,.45);transition:box-shadow .3s,border-color .3s}
.card::after{content:'';position:absolute;top:0;left:0;bottom:0;width:6px;background:var(--accent,#5b6b85)}
.card.running{border-color:#7FE8C3;box-shadow:0 0 0 3px rgba(0,203,132,.25),0 10px 28px rgba(0,0,0,.45)}
.card.running::after{animation:pl 1s ease-in-out infinite}
.card.waiting{border-color:#F3D08A}
.card.finished{border-color:#9CC3FF;box-shadow:0 0 0 3px rgba(46,123,255,.25),0 10px 28px rgba(0,0,0,.45)}
@keyframes pl{0%,100%{opacity:.5}50%{opacity:1}}
/* 상태 전환 연출: 진행/모집 진입 시 테두리 1회 플래시, 완료 시 1초 글로우 + 결과 팝인 */
.card.fx-flash{animation:cflash .7s ease-out}
@keyframes cflash{0%{border-color:#fff;box-shadow:0 0 0 6px rgba(255,255,255,.55),0 10px 28px rgba(0,0,0,.45)}100%{}}
.card.fx-glow{animation:cglow 1s ease-out}
@keyframes cglow{0%{box-shadow:0 0 0 8px rgba(255,200,61,.6),0 0 40px rgba(255,200,61,.6),0 10px 28px rgba(0,0,0,.45);border-color:#FFC83D}100%{}}
.cresult.fx-pop{animation:cpop .4s cubic-bezier(.2,1.4,.3,1) both}
@keyframes cpop{from{transform:scale(.9);opacity:.3}to{transform:scale(1);opacity:1}}

/* 크림 헤더 스트립 */
.ch{display:flex;align-items:center;justify-content:space-between;background:var(--cream);height:48px;padding:0 14px 0 22px;flex:none}
.cname{font-size:22px;font-weight:900;color:var(--accent,#172437);letter-spacing:-0.01em;white-space:nowrap}
/* 사선 상태 탭 (왼쪽 오렌지 슬래시 + 상태색) */
.cbadge{position:relative;height:30px;padding:0 20px 0 28px;display:flex;align-items:center;font-size:14px;font-weight:800;color:#fff;letter-spacing:0.02em;background:var(--st,#172437);clip-path:polygon(16px 0,100% 0,100% 100%,0 100%);border-radius:0 15px 15px 0;white-space:nowrap}
.cbadge::before{content:'';position:absolute;left:0;top:0;bottom:0;width:26px;background:var(--orange);clip-path:polygon(16px 0,26px 0,10px 100%,0 100%)}
.badge-idle    {--st:#172437}
.badge-running {--st:#0FA96E}
.badge-waiting {--st:#3A4B68}
.badge-finished{--st:#2E7BFF}

/* 본문 */
.cbody{padding:18px 22px 16px;display:flex;flex-direction:column;gap:6px;flex:1;min-width:0}
.cresult{font-size:34px;font-weight:900;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff;min-height:42px;letter-spacing:-0.02em;text-shadow:0 2px 0 rgba(0,0,0,.25)}
.cresult.empty{color:#7B8BA6;font-size:26px;font-weight:700;text-shadow:none}
.cmeta{font-size:16px;font-weight:500;color:#C9D2E0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* 게임별 액센트 */
.c-roulette{--accent:#2E7BFF}.c-ladder{--accent:#4C8DFF}
.c-quiz{--accent:#16B85A}.c-slot{--accent:#22C55E}
.c-race{--accent:#3B8BFF}.c-rps{--accent:#FF4FA3}.c-fish{--accent:#3B8BFF}
.c-lottery{--accent:#FF6A1F}.c-number{--accent:#12B5A8}.c-pickboard{--accent:#FF3E9E}
</style>
</head>
<body>
<div class="hd">
  <div class="hd-title"><i></i>게임 모니터링</div>
  <div class="hd-clock" id="clock">--:--:--</div>
</div>
<div class="grid" id="grid"></div>
<script>
const GAMES=[
  {id:'roulette',name:'룰렛'},{id:'ladder',name:'사다리타기'},
  {id:'quiz',name:'퀴즈'},{id:'slot',name:'슬롯머신'},{id:'race',name:'경주'},{id:'rps',name:'가위바위보'},
  {id:'fish',name:'낚시'},{id:'lottery',name:'행운복권'},{id:'number',name:'숫자추첨'},{id:'pickboard',name:'뽑기판'},
]
const states={};GAMES.forEach(g=>{states[g.id]={status:'idle',result:'',by:''}})
const grid=document.getElementById('grid'),cards={}
const BL={idle:'badge-idle',running:'badge-running',collecting:'badge-waiting',waiting:'badge-waiting',showing_result:'badge-finished',finished:'badge-finished'}
const BT={idle:'대기',running:'진행 중',collecting:'모집 중',waiting:'모집 중',showing_result:'완료',finished:'완료'}
GAMES.forEach(g=>{
  const el=document.createElement('div')
  el.className='card c-'+g.id
  el.innerHTML='<div class="ch"><span class="cname">'+g.name+'</span><span class="cbadge badge-idle" id="b-'+g.id+'">대기</span></div><div class="cbody"><div class="cresult empty" id="r-'+g.id+'">—</div><div class="cmeta" id="m-'+g.id+'">대기 중</div></div>'
  grid.appendChild(el);cards[g.id]=el
})
const prevSt={}
function pulse(el,cls){el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);el.addEventListener('animationend',()=>el.classList.remove(cls),{once:true})}
function upd(id,st,res,by,meta){
  const c=cards[id];if(!c)return
  const was=prevSt[id];prevSt[id]=st
  c.className='card c-'+id+(st!=='idle'?' '+st:'')
  if(st!==was){
    if(st==='running'||st==='collecting'||st==='waiting')pulse(c,'fx-flash')
    if(st==='finished'||st==='showing_result'){pulse(c,'fx-glow');pulse(document.getElementById('r-'+id),'fx-pop')}
  }
  const b=document.getElementById('b-'+id);b.className='cbadge '+(BL[st]||BL.idle);b.textContent=BT[st]||st
  const r=document.getElementById('r-'+id)
  if(res){r.textContent=res;r.className='cresult'}else{r.textContent='—';r.className='cresult empty'}
  const m=document.getElementById('m-'+id)
  m.textContent=(by?by+'님':'')+((by&&meta)?' - ':'')+( meta||(!by?'대기 중':''))
}
setInterval(()=>{const d=new Date();document.getElementById('clock').textContent=d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0')+':'+d.getSeconds().toString().padStart(2,'0')},1000)
function connect(){
  const ws=new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage=e=>{
    try{
      const msg=JSON.parse(e.data)
      if(msg.type==='game:state'&&msg.data?.id){
        const d=msg.data,s=states[d.id]||{}
        s.status=d.status||'idle';states[d.id]=s
        upd(d.id,s.status,s.result||'',s.by||'',s.meta||'')
      }
      if(msg.type==='game:result'&&msg.data?.gameId){
        const d=msg.data,id=d.gameId
        states[id]={status:'finished',result:d.result||'',by:d.triggeredBy||'',meta:d.detail||''}
        upd(id,'finished',d.result||'',d.triggeredBy||'',d.detail||'')
        setTimeout(()=>{if(states[id]?.status==='finished'){states[id].status='idle';upd(id,'idle',d.result||'',d.triggeredBy||'')}},8000)
      }
      if(msg.type==='ping')ws.send(JSON.stringify({type:'pong'}))
    }catch{}
  }
  ws.onopen=()=>{ if(window.__wsDown) location.reload() }
  ws.onclose=()=>{ window.__wsDown=true; setTimeout(connect,2000) }
}
connect()
<\/script>
</body>
</html>`
