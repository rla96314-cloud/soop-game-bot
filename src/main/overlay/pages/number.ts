// OBS 오버레이 페이지: number (HTML 템플릿 문자열)
export const NUMBER_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700;800;900&display=swap" rel="stylesheet">
<style>
:root{--navy:#172437;--orange:#FF5B17;--cream:#F5F3EF;--mint:#00CB84;--yellow:#FFC61A}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:transparent !important;overflow:hidden;font-family:'Noto Sans KR',sans-serif}
#nw{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.78);opacity:0;pointer-events:none;width:560px;transition:opacity 0.5s ease,transform 0.55s cubic-bezier(0.34,1.56,0.64,1)}
#nw.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
/* ── Machine column ── */
.mc{display:flex;flex-direction:column;align-items:center;gap:0;filter:drop-shadow(0 22px 40px rgba(23,36,55,0.35))}
/* Sign */
.sign{position:relative;z-index:8;width:470px;background:var(--cream);border:4px solid var(--orange);border-radius:18px;box-shadow:0 0 0 4px var(--navy);padding:14px 20px 10px;text-align:center;margin-bottom:-14px}
.sdots{position:absolute;top:-11px;left:50%;transform:translateX(-50%);display:flex;gap:8px}
.sdot{width:13px;height:13px;border-radius:50%;background:var(--orange);border:2.5px solid var(--navy);transition:background 0.25s}
.sdot.lit{background:var(--yellow)}
.n-ti{display:flex;align-items:center;justify-content:center;gap:10px;font-size:28px;font-weight:900;color:var(--navy);letter-spacing:-0.02em;line-height:1.15}
.n-ti .st{color:var(--orange);font-size:22px}
.spk{width:22px;height:30px;flex-shrink:0}
.spk line{stroke:var(--mint);stroke-width:3.5;stroke-linecap:round}
.spk.r{transform:scaleX(-1)}
/* Sphere scene */
.scene{position:relative;width:300px;height:300px;margin-bottom:0}
.sph{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 50% 60%,#2C3F5F 0%,#1B2A44 45%,#0F1A2B 100%);border:9px solid var(--orange);box-shadow:0 0 0 4px var(--navy),inset 0 0 0 3px rgba(23,36,55,0.6)}
.bf{position:absolute;inset:12px;border-radius:50%;overflow:hidden}
.sgl{position:absolute;inset:12px;border-radius:50%;pointer-events:none;z-index:4}
.sgl::before{content:'';position:absolute;top:22px;left:38px;width:34px;height:74px;background:rgba(255,255,255,0.85);border-radius:20px;transform:rotate(38deg)}
.sgl::after{content:'';position:absolute;top:104px;left:24px;width:14px;height:24px;background:rgba(255,255,255,0.7);border-radius:10px;transform:rotate(38deg)}
.sgl2{position:absolute;inset:12px;border-radius:50%;pointer-events:none;z-index:4}
.sgl2::before{content:'';position:absolute;bottom:22px;right:36px;width:12px;height:44px;background:rgba(255,255,255,0.45);border-radius:10px;transform:rotate(38deg)}
/* Side arms */
.arm-l,.arm-r{position:absolute;bottom:-42px;width:44px;height:110px;background:var(--orange);border:4px solid var(--navy);border-radius:10px;z-index:6}
.arm-l{left:26px}.arm-r{right:26px}
.arm-l::before,.arm-r::before{content:'';position:absolute;top:10px;left:8px;width:8px;bottom:12px;background:rgba(255,255,255,0.35);border-radius:4px}
/* Balls (8) */
.b{position:absolute;top:50%;left:50%;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;color:var(--cream);border:2.5px solid var(--navy);text-shadow:0 1px 0 rgba(23,36,55,0.4)}
.b::after{content:'';position:absolute;top:9%;left:20%;width:30%;height:22%;background:rgba(255,255,255,0.6);border-radius:50%}
.b1{width:48px;height:48px;font-size:15px;margin:-24px 0 0 -24px;background:radial-gradient(circle at 40% 35%,#FF8A8A,#F0453F 70%);animation:ob1 1.4s linear infinite}
.b2{width:46px;height:46px;font-size:14px;margin:-23px 0 0 -23px;background:radial-gradient(circle at 40% 35%,#8FC8FF,#3A8DE0 70%);animation:ob2 1.7s linear infinite}
.b3{width:44px;height:44px;font-size:14px;margin:-22px 0 0 -22px;background:radial-gradient(circle at 40% 35%,#5EE8B4,#00CB84 70%);animation:ob3 1.1s linear infinite}
.b4{width:48px;height:48px;font-size:15px;margin:-24px 0 0 -24px;background:radial-gradient(circle at 40% 35%,#FFA06E,#FF5B17 70%);animation:ob4 1.6s linear infinite}
.b5{width:46px;height:46px;font-size:14px;margin:-23px 0 0 -23px;background:radial-gradient(circle at 40% 35%,#FFE27A,#FFC61A 70%);color:var(--navy);text-shadow:none;animation:ob5 1.3s linear infinite}
.b6{width:44px;height:44px;font-size:14px;margin:-22px 0 0 -22px;background:radial-gradient(circle at 40% 35%,#D39CFF,#9B4DE0 70%);animation:ob6 2.1s linear infinite}
.b7{width:42px;height:42px;font-size:13px;margin:-21px 0 0 -21px;background:radial-gradient(circle at 40% 35%,#FFFFFF,#E6E2DA 70%);color:var(--navy);text-shadow:none;animation:ob7 1.0s linear infinite}
.b8{width:46px;height:46px;font-size:14px;margin:-23px 0 0 -23px;background:radial-gradient(circle at 40% 35%,#7FE0FF,#1FA9D6 70%);animation:ob8 1.8s linear infinite}
/* Orbital keyframes (8 different paths) */
@keyframes ob1{0%{transform:translate(0,-100px)}12.5%{transform:translate(70px,-70px)}25%{transform:translate(100px,0)}37.5%{transform:translate(70px,70px)}50%{transform:translate(0,100px)}62.5%{transform:translate(-70px,70px)}75%{transform:translate(-100px,0)}87.5%{transform:translate(-70px,-70px)}100%{transform:translate(0,-100px)}}
@keyframes ob2{0%{transform:translate(90px,0)}12.5%{transform:translate(64px,64px)}25%{transform:translate(0,90px)}37.5%{transform:translate(-64px,64px)}50%{transform:translate(-90px,0)}62.5%{transform:translate(-64px,-64px)}75%{transform:translate(0,-90px)}87.5%{transform:translate(64px,-64px)}100%{transform:translate(90px,0)}}
@keyframes ob3{0%{transform:translate(-55px,-80px)}33%{transform:translate(85px,30px)}66%{transform:translate(-30px,90px)}100%{transform:translate(-55px,-80px)}}
@keyframes ob4{0%{transform:translate(50px,85px)}25%{transform:translate(-90px,20px)}50%{transform:translate(20px,-95px)}75%{transform:translate(80px,-40px)}100%{transform:translate(50px,85px)}}
@keyframes ob5{0%{transform:translate(-80px,-55px)}33%{transform:translate(40px,90px)}66%{transform:translate(85px,-60px)}100%{transform:translate(-80px,-55px)}}
@keyframes ob6{0%{transform:translate(70px,-70px)}20%{transform:translate(85px,50px)}40%{transform:translate(-30px,95px)}60%{transform:translate(-90px,-10px)}80%{transform:translate(-30px,-90px)}100%{transform:translate(70px,-70px)}}
@keyframes ob7{0%{transform:translate(-40px,-60px)}25%{transform:translate(60px,-40px)}50%{transform:translate(40px,60px)}75%{transform:translate(-60px,40px)}100%{transform:translate(-40px,-60px)}}
@keyframes ob8{0%{transform:translate(0,80px)}16%{transform:translate(-80px,35px)}33%{transform:translate(-75px,-45px)}50%{transform:translate(0,-85px)}66%{transform:translate(75px,-45px)}83%{transform:translate(80px,35px)}100%{transform:translate(0,80px)}}
/* Chute + display bay */
.chute-wrap{position:relative;display:flex;flex-direction:column;align-items:center;width:300px;margin-top:-6px;z-index:7}
.chute{width:78px;height:40px;display:block}
.bay-row{position:relative;display:flex;align-items:center;justify-content:center;margin-top:-6px}
.bay{min-width:150px;min-height:96px;padding:10px 14px;background:var(--cream);border:4px solid var(--orange);box-shadow:0 0 0 4px var(--navy);border-radius:16px;display:flex;align-items:center;justify-content:center;position:relative}
.bspk{position:absolute;top:50%;width:34px;height:60px;transform:translateY(-50%);opacity:0;transition:opacity 0.3s}
.bspk line{stroke-width:5;stroke-linecap:round}
.bspk .m{stroke:var(--mint)}.bspk .o{stroke:var(--orange)}
.bspk.l{left:-46px}.bspk.r{right:-46px;transform:translateY(-50%) scaleX(-1)}
.bay-row.hit .bspk{opacity:1;animation:bsp 0.9s ease-in-out infinite alternate}
@keyframes bsp{from{opacity:0.5}to{opacity:1}}
/* Winner ball */
.wball{width:70px;height:70px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#FFE27A,#FFC61A 70%);border:3px solid var(--navy);color:var(--navy);font-size:26px;font-weight:900;display:flex;align-items:center;justify-content:center;opacity:0;transform:scale(0.3);transition:opacity 0.5s ease,transform 0.5s cubic-bezier(0.34,1.56,0.64,1);position:relative}
.wball::after{content:'';position:absolute;top:9%;left:20%;width:30%;height:22%;background:rgba(255,255,255,0.65);border-radius:50%}
.wball.show{opacity:1;transform:scale(1);animation:wbPulse 1.5s ease-in-out infinite 0.5s}
@keyframes wbPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,198,26,0)}50%{box-shadow:0 0 0 8px rgba(255,198,26,0.35)}}
/* Platform */
.plat-wrap{width:480px;margin-top:10px;display:flex;flex-direction:column;align-items:center;gap:0;position:relative;z-index:5}
.plat1{width:340px;height:34px;background:var(--orange);border:4px solid var(--navy);border-radius:12px 12px 0 0;position:relative}
.plat1::before{content:'';position:absolute;top:6px;left:14px;right:14px;height:5px;border-radius:3px;background:rgba(255,255,255,0.35)}
.plat2{width:400px;height:26px;background:var(--orange);border:4px solid var(--navy);border-bottom:none;border-radius:10px 10px 0 0;margin-top:-4px}
.plat3{width:480px;height:36px;background:var(--orange);border:4px solid var(--navy);border-radius:14px;display:flex;align-items:center;justify-content:space-evenly;padding:0 16px;margin-top:-4px}
.led{width:12px;height:12px;border-radius:50%;background:var(--cream);border:2px solid #E0A800;box-shadow:0 0 6px rgba(255,255,255,0.8)}
/* Multi-draw chips */
.mchips{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;max-width:300px}
.mchip{width:50px;height:50px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:var(--navy);background:radial-gradient(circle at 40% 35%,#FFE27A,#FFC61A 70%);border:3px solid var(--navy);position:relative;animation:chIn 0.4s cubic-bezier(0.34,1.56,0.64,1)}
.mchip::after{content:'';position:absolute;top:9%;left:20%;width:30%;height:22%;background:rgba(255,255,255,0.65);border-radius:50%}
@keyframes chIn{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
</style>
</head>
<body>
<div id="nw">
  <div class="mc">
    <!-- Sign -->
    <div class="sign">
      <div class="sdots"><div class="sdot" id="sd0"></div><div class="sdot lit" id="sd1"></div><div class="sdot" id="sd2"></div><div class="sdot lit" id="sd3"></div><div class="sdot" id="sd4"></div></div>
      <div class="n-ti">
        <svg class="spk" viewBox="0 0 22 30"><line x1="4" y1="6" x2="12" y2="12"/><line x1="4" y1="24" x2="12" y2="18"/></svg>
        <span class="st">&#9733;</span><span>랜덤 번호 추첨기</span><span class="st">&#9733;</span>
        <svg class="spk r" viewBox="0 0 22 30"><line x1="4" y1="6" x2="12" y2="12"/><line x1="4" y1="24" x2="12" y2="18"/></svg>
      </div>
    </div>
    <!-- Sphere machine -->
    <div class="scene">
      <div class="sph"></div>
      <div class="bf" id="bf">
        <div class="b b1" id="bl0">?</div>
        <div class="b b2" id="bl1">?</div>
        <div class="b b3" id="bl2">?</div>
        <div class="b b4" id="bl3">?</div>
        <div class="b b5" id="bl4">?</div>
        <div class="b b6" id="bl5">?</div>
        <div class="b b7" id="bl6">?</div>
        <div class="b b8" id="bl7">?</div>
      </div>
      <div class="sgl"></div>
      <div class="sgl2"></div>
      <div class="arm-l"></div>
      <div class="arm-r"></div>
    </div>
    <!-- Chute + display bay -->
    <div class="chute-wrap">
      <svg class="chute" viewBox="0 0 78 40"><polygon points="4,2 74,2 52,38 26,38" fill="#FF5B17" stroke="#172437" stroke-width="4" stroke-linejoin="round"/><line x1="18" y1="9" x2="60" y2="9" stroke="rgba(255,255,255,0.35)" stroke-width="4" stroke-linecap="round"/></svg>
      <div class="bay-row" id="bay-row">
        <svg class="bspk l" viewBox="0 0 34 60"><line class="m" x1="4" y1="8" x2="28" y2="20"/><line class="o" x1="4" y1="30" x2="28" y2="30"/><line class="m" x1="4" y1="52" x2="28" y2="40"/></svg>
        <div class="bay" id="bay">
          <div class="wball" id="wball"></div>
          <div class="mchips" id="mchips" style="display:none"></div>
        </div>
        <svg class="bspk r" viewBox="0 0 34 60"><line class="m" x1="4" y1="8" x2="28" y2="20"/><line class="o" x1="4" y1="30" x2="28" y2="30"/><line class="m" x1="4" y1="52" x2="28" y2="40"/></svg>
      </div>
    </div>
    <!-- Platform -->
    <div class="plat-wrap">
      <div class="plat1"></div>
      <div class="plat2"></div>
      <div class="plat3" id="pleds"></div>
    </div>
  </div>
</div>
<script>
// Build LEDs
const pled=document.getElementById('pleds')
for(let i=0;i<14;i++){const d=document.createElement('div');d.className='led';pled.appendChild(d)}
// Sign dots twinkle
setInterval(()=>{document.querySelectorAll('.sdot').forEach(d=>d.classList.toggle('lit',Math.random()>0.5))},420)
// Ball refs
const BALLS=[...Array(8)].map((_,i)=>document.getElementById('bl'+i))
const wrap=document.getElementById('nw'),wball=document.getElementById('wball'),mchips=document.getElementById('mchips'),bayRow=document.getElementById('bay-row')
let rolling=false,rollIv=null,timers=[],chipIv=null
function later(fn,ms){const t=setTimeout(fn,ms);timers.push(t);return t}
function cancelAll(){timers.forEach(clearTimeout);timers=[];if(rollIv){clearInterval(rollIv);rollIv=null}if(chipIv){clearInterval(chipIv);chipIv=null}}
function rnd(a,b){return Math.floor(Math.random()*(b-a+1))+a}
function tickBalls(a,b){BALLS.forEach(bl=>{bl.textContent=rnd(a,b)})}
function rollAnimation(min,max,targets,spinMs,triggeredBy){
  cancelAll();rolling=true   // 진행 중이면 끊고 새 판 (엔진은 spinMs 뒤에 결과를 확정하므로 연출도 그 안에 끝나야 함)
  wrap.classList.add('show')
  bayRow.classList.remove('hit')
  wball.textContent='';wball.classList.remove('show');wball.style.display=''
  mchips.style.display='none';mchips.innerHTML=''
  tickBalls(min,max)
  if(targets.length>1){
    rollIv=setInterval(()=>tickBalls(min,max),25)
    mchips.style.display='flex';wball.style.display='none'
    // 숫자 하나당 시간 = 전체 연출 시간 ÷ 개수 (60% 는 돌아가는 연출, 40% 는 멈춤)
    const per=Math.max(250,Math.floor((spinMs-300)/targets.length)),frames=18,frameMs=Math.max(15,Math.floor(per*0.6/frames)),pause=per-frameMs*frames
    let idx=0
    function landNext(){
      if(idx>=targets.length){clearInterval(rollIv);rollIv=null;bayRow.classList.add('hit');later(hide,5000);rolling=false;return}
      const chip=document.createElement('div');chip.className='mchip';chip.textContent='?';mchips.appendChild(chip)
      let f=0;chipIv=setInterval(()=>{chip.textContent=rnd(min,max);if(++f>=frames){clearInterval(chipIv);chipIv=null;chip.textContent=targets[idx];idx++;later(landNext,pause)}},frameMs)
    }
    landNext()
  } else {
    rollIv=setInterval(()=>tickBalls(min,max),25)
    later(()=>{
      clearInterval(rollIv);rollIv=null
      wball.textContent=targets[0];wball.classList.add('show');bayRow.classList.add('hit')
      rolling=false;later(hide,5000)
    },Math.max(spinMs-800,500))
  }
}
function hide(){wrap.classList.remove('show');cancelAll();rolling=false;later(()=>{wball.classList.remove('show');wball.style.display='';mchips.innerHTML='';mchips.style.display='none';bayRow.classList.remove('hit')},600)}
function connect(){
  const ws=new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage=e=>{
    try{
      const msg=JSON.parse(e.data)
      if(msg.type==='game:state'&&msg.data?.id==='number'&&msg.data?.status==='running'){
        const ns=msg.data.number;if(ns?.result)rollAnimation(ns.min,ns.max,ns.result,ns.spinMs??3000,ns.triggeredBy??'')
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
