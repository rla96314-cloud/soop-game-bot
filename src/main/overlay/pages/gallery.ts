// 애니메이션 미리보기 페이지 (/gallery) — 모든 게임 오버레이를 데모 모드로 한 화면에 띄운다.
// 각 칸은 /overlay/<게임>?demo=1 iframe. 데모 엔진은 방송용 엔진과 분리돼 OBS 에는 아무것도 나가지 않는다.
export const GALLERY_HTML = () => `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>게임 애니메이션 미리보기</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;700;900&display=swap" rel="stylesheet">
<style>
:root{--ink:#172437;--ink2:#22324a;--paper:#f5f3ef;--orange:#ff5b17;--line:#2c3d57;--muted:#8e9bb0}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--ink);color:#fff;font-family:'Noto Sans KR',sans-serif;min-height:100vh}
header{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:20px 28px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--ink);z-index:5}
h1{font-family:'Black Han Sans',sans-serif;font-weight:400;font-size:28px;letter-spacing:.5px}
h1 b{color:var(--orange);font-weight:400}
.note{color:var(--muted);font-size:13px;flex:1;min-width:260px}
.btn{background:var(--ink2);color:#fff;border:1px solid var(--line);border-radius:4px;padding:8px 14px;font:700 13px 'Noto Sans KR',sans-serif;cursor:pointer;white-space:nowrap}
.btn:hover{border-color:var(--orange)}
.btn.primary{background:var(--orange);border-color:var(--orange)}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:20px;padding:24px 28px 40px}
.card{background:var(--ink2);border:1px solid var(--line);border-radius:6px;overflow:hidden;display:flex;flex-direction:column}
.card-head{display:flex;align-items:center;gap:10px;padding:10px 14px}
.card-head .name{font-weight:900;font-size:16px;flex:1}
.card-head .name small{color:var(--muted);font-weight:400;font-size:12px;margin-left:8px}
.bar{width:4px;height:18px;background:var(--orange);border-radius:2px}
.stage{position:relative;aspect-ratio:16/9;overflow:hidden;cursor:zoom-in;
  background:#0d1726 repeating-conic-gradient(#132036 0 25%,#0f1a2c 0 50%) 0 0/28px 28px}
.stage iframe{position:absolute;left:0;top:0;width:1920px;height:1080px;border:0;transform-origin:0 0;pointer-events:none;background:transparent}
.stage .sleep{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px}
#modal{position:fixed;inset:0;background:rgba(6,11,20,.92);display:none;flex-direction:column;z-index:20;padding:18px 24px;gap:12px}
#modal.on{display:flex}
#modal .top{display:flex;align-items:center;gap:10px}
#modal .top .name{font-family:'Black Han Sans',sans-serif;font-size:24px;flex:1}
#modal .big{flex:1;position:relative;overflow:hidden;border-radius:6px;
  background:#0d1726 repeating-conic-gradient(#132036 0 25%,#0f1a2c 0 50%) 0 0/36px 36px}
#modal .big iframe{position:absolute;width:1920px;height:1080px;border:0;transform-origin:0 0}
@media (max-width:520px){main{grid-template-columns:1fr;padding:16px}header{padding:16px}}
</style></head><body>
<header>
  <h1>게임 애니메이션 <b>미리보기</b></h1>
  <p class="note">지금 설정(항목·상품·심볼)으로 가짜 시청자가 한 판씩 계속 돌립니다. 방송(OBS) 화면과 기록에는 나가지 않습니다. 칸을 누르면 크게, 소리와 함께 봅니다.</p>
  <button class="btn" id="restartAll">전부 처음부터</button>
</header>
<main id="grid"></main>
<div id="modal">
  <div class="top"><span class="name" id="mName"></span>
    <button class="btn" id="mSound">소리 끄기</button>
    <button class="btn" id="mRestart">처음부터</button>
    <button class="btn primary" id="mClose">닫기 (Esc)</button></div>
  <div class="big" id="mBig"></div>
</div>
<script>
var GAMES=[
  {id:'roulette',name:'룰렛',sub:'무대 조명'},
  {id:'slot',name:'슬롯머신',sub:'카지노 전광판'},
  {id:'fish',name:'낚시',sub:'수중 다큐 카메라'},
  {id:'quiz',name:'퀴즈',sub:'퀴즈쇼 세트'},
  {id:'number',name:'숫자 추첨',sub:'로또 추첨기'},
  {id:'lottery',name:'복권',sub:'매크로 렌즈'},
  {id:'race',name:'경주',sub:'경마 중계'},
  {id:'rps',name:'가위바위보',sub:'격투 VS'},
  {id:'ladder',name:'사다리타기',sub:''},
  {id:'pickboard',name:'뽑기판',sub:''}
];
var grid=document.getElementById('grid'), cards=[];
function src(id,mute){ return '/overlay/'+id+'?demo=1'+(mute?'&mute=1':'')+'&t='+Date.now() }
function fit(stage,frame){ var w=stage.clientWidth,h=stage.clientHeight,k=Math.min(w/1920,h/1080);
  frame.style.transform='scale('+k+')'; frame.style.left=((w-1920*k)/2)+'px'; frame.style.top=((h-1080*k)/2)+'px' }
GAMES.forEach(function(g){
  var card=document.createElement('section'); card.className='card';
  card.innerHTML='<div class="card-head"><span class="bar"></span><span class="name">'+g.name+(g.sub?'<small>'+g.sub+'</small>':'')+'</span>'+
    '<button class="btn" data-act="restart">처음부터</button><button class="btn" data-act="open">크게</button></div>'+
    '<div class="stage"><div class="sleep">화면에 보이면 재생합니다</div></div>';
  grid.appendChild(card);
  var stage=card.querySelector('.stage'), sleep=stage.querySelector('.sleep'), c={g:g,card:card,stage:stage,frame:null};
  c.load=function(){ if(c.frame) c.frame.remove(); sleep.style.display='none'; var f=document.createElement('iframe'); f.src=src(g.id,true); stage.appendChild(f); c.frame=f; fit(stage,f) };
  c.unload=function(){ if(c.frame){ c.frame.remove(); c.frame=null } sleep.style.display='' };
  card.querySelector('[data-act=restart]').onclick=function(){ c.load() };
  card.querySelector('[data-act=open]').onclick=function(){ openBig(g) };
  stage.onclick=function(){ openBig(g) };
  cards.push(c);
});
// 화면 밖 칸은 멈춘다 (캔버스 10개를 동시에 돌리지 않게)
var io=new IntersectionObserver(function(es){ es.forEach(function(e){ var c=cards.find(function(x){return x.stage===e.target});
  if(!c) return; if(e.isIntersecting){ if(!c.frame) c.load() } else c.unload() }) },{rootMargin:'120px'});
cards.forEach(function(c){ io.observe(c.stage) });
new ResizeObserver(function(){ cards.forEach(function(c){ if(c.frame) fit(c.stage,c.frame) }); if(cur) fit(mBig,cur.frame) }).observe(document.body);
document.getElementById('restartAll').onclick=function(){ cards.forEach(function(c){ if(c.frame) c.load() }) };

var modal=document.getElementById('modal'), mBig=document.getElementById('mBig'), cur=null, muted=false;
function loadBig(){ if(cur.frame) cur.frame.remove(); var f=document.createElement('iframe'); f.src=src(cur.g.id,muted); f.allow='autoplay'; mBig.appendChild(f); cur.frame=f; fit(mBig,f) }
function openBig(g){ cur={g:g,frame:null}; document.getElementById('mName').textContent=g.name; modal.classList.add('on'); loadBig();
  cards.forEach(function(c){ c.unload() }) }
function closeBig(){ if(cur&&cur.frame) cur.frame.remove(); cur=null; modal.classList.remove('on');
  cards.forEach(function(c){ var r=c.stage.getBoundingClientRect(); if(r.bottom>0&&r.top<innerHeight) c.load() }) }
document.getElementById('mClose').onclick=closeBig;
document.getElementById('mRestart').onclick=loadBig;
document.getElementById('mSound').onclick=function(){ muted=!muted; this.textContent=muted?'소리 켜기':'소리 끄기'; loadBig() };
addEventListener('keydown',function(e){ if(e.key==='Escape'&&cur) closeBig() });
<\/script>
</body></html>`
