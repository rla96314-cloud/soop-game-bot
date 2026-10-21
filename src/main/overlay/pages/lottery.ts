// OBS 오버레이 페이지: lottery (HTML 템플릿 문자열)
import { FX_SCRIPT } from './_fx'
export const LOTTERY_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700;800;900&display=swap" rel="stylesheet">
<style>
:root{--navy:#172437;--orange:#FF5B17;--cream:#F5F3EF;--mint:#00CB84;--yellow:#FFC61A}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:transparent !important;overflow:hidden;font-family:'Noto Sans KR',sans-serif}
#lw{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.82);opacity:0;pointer-events:none;width:640px;transition:opacity 0.5s ease,transform 0.5s cubic-bezier(0.34,1.56,0.64,1)}
#lw.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
/* Card: navy outline → orange frame → navy inner */
.card{position:relative;background:var(--orange);border:5px solid var(--navy);border-radius:28px;padding:13px;box-shadow:0 26px 70px rgba(23,36,55,0.45)}
.inner{position:relative;background:var(--navy);border:3px solid var(--navy);border-radius:18px;overflow:hidden}
/* Rivets on the orange frame */
.rv{position:absolute;width:18px;height:18px;border-radius:50%;background:radial-gradient(circle at 38% 35%,#FFE27A,#FFC61A 60%,#E0A800);border:2.5px solid var(--navy);z-index:12}
.rv.tl{top:9px;left:11px}.rv.tr{top:9px;right:11px}.rv.bl{bottom:9px;left:11px}.rv.br{bottom:9px;right:11px}
/* Header with sunburst */
.hdr{position:relative;height:138px;display:flex;align-items:center;justify-content:center;gap:12px;padding:0 20px;overflow:hidden}
.rays{position:absolute;inset:-40px 0 0;background:repeating-conic-gradient(from 0deg at 50% 100%,rgba(255,255,255,0.07) 0deg 9deg,rgba(255,255,255,0) 9deg 18deg)}
.hstar{position:relative;width:34px;height:34px;flex-shrink:0;animation:spA 2s ease-in-out infinite}
.hstar.r{animation-direction:reverse}
@keyframes spA{0%,100%{transform:rotate(0deg) scale(1)}50%{transform:rotate(18deg) scale(1.15)}}
.title{position:relative;display:flex;align-items:baseline;gap:2px}
.ty,.tw{font-size:66px;font-weight:900;line-height:1;letter-spacing:-2px;-webkit-text-stroke:7px var(--navy);paint-order:stroke fill;text-shadow:0 5px 0 var(--navy)}
.ty{color:var(--yellow)}
.tw{color:var(--cream)}
.hsp{position:absolute;width:14px;height:22px;z-index:3;animation:mspA 1.6s ease-in-out infinite}
.hsp line{stroke:var(--mint);stroke-width:3.5;stroke-linecap:round}
.msp{position:absolute;color:var(--orange);z-index:3;line-height:1;animation:mspA 1.6s ease-in-out infinite}
.msp.c{color:var(--cream)}.msp.m{color:var(--mint)}
@keyframes mspA{0%,100%{opacity:0.35;transform:scale(1)}50%{opacity:1;transform:scale(1.35)}}
/* Scratch panel */
.sw{position:relative;margin:0 12px 12px;border:4px solid var(--orange);border-radius:14px;overflow:hidden;background:var(--cream)}
/* Prize zone (underneath canvas) */
.pz{position:relative;min-height:214px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:26px 24px 20px;gap:6px;background:var(--cream)}
.pz-bg{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,rgba(255,255,255,0.7) 0%,transparent 70%)}
.bgst{position:absolute;color:var(--orange);opacity:0.22;line-height:1;pointer-events:none}
.pm-row{position:relative;display:flex;align-items:center;gap:14px}
.spd{width:26px;height:44px;flex-shrink:0;opacity:0;transition:opacity 0.3s}
.spd line{stroke:var(--orange);stroke-width:5;stroke-linecap:round}
.spd.r{transform:scaleX(-1)}
.pm-row.on .spd{opacity:1}
#pm{font-size:56px;font-weight:900;text-align:center;line-height:1.1;transition:color 0.3s;-webkit-text-stroke:0;letter-spacing:-1px}
#pd{position:relative;font-size:20px;font-weight:800;color:var(--navy);text-align:center}
#pb{position:relative;font-size:14px;font-weight:700;color:#7A8394;margin-top:2px}
/* Canvas (silver foil) — above prize text */
#sc{position:absolute;inset:0;width:100%;height:100%;display:block;z-index:3}
/* Scratch hint text over canvas */
.sh{position:absolute;bottom:12px;left:0;right:0;text-align:center;font-size:12px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:rgba(23,36,55,0.45);z-index:4;pointer-events:none;animation:shP 1.1s ease-in-out infinite}
@keyframes shP{0%,100%{opacity:0.4}50%{opacity:1}}
/* Corner sparkles over foil */
.csp{position:absolute;z-index:5;font-size:20px;line-height:1;pointer-events:none;animation:mspA 1.4s ease-in-out infinite}
.csp.m{color:var(--mint)}.csp.o{color:var(--orange)}
/* Pop animation when revealed */
@keyframes popIn{0%{transform:scale(0.4) rotate(-5deg);opacity:0}60%{transform:scale(1.1) rotate(2deg)}100%{transform:scale(1) rotate(0deg);opacity:1}}
.popin{animation:popIn 0.65s cubic-bezier(0.34,1.56,0.64,1) both}
/* Jackpot shimmer */
@keyframes shimmer{0%{filter:brightness(1)}50%{filter:brightness(1.25) drop-shadow(0 0 10px rgba(255,198,26,0.6))}100%{filter:brightness(1)}}
.shimmer{animation:shimmer 1.2s ease-in-out infinite}
/* FX: 공개 직전(두구두구) 카드 테두리 펄스 */
@keyframes cardPulse{from{box-shadow:0 26px 70px rgba(23,36,55,0.45),0 0 0 0 rgba(255,198,26,0)}to{box-shadow:0 26px 70px rgba(23,36,55,0.45),0 0 0 8px rgba(255,198,26,0.8),0 0 44px rgba(255,198,26,0.7)}}
.card.tense{animation:cardPulse 0.34s ease-in-out infinite alternate}
/* FX: 꽝 흔들림 */
@keyframes cardShake{0%,100%{transform:translateX(0)}15%{transform:translateX(-9px) rotate(-0.5deg)}35%{transform:translateX(8px) rotate(0.5deg)}55%{transform:translateX(-5px)}75%{transform:translateX(3px)}}
.card.shake{animation:cardShake 0.5s ease-out}
</style>
</head>
<body>
<div id="lw">
  <div class="card">
    <span class="rv tl"></span><span class="rv tr"></span><span class="rv bl"></span><span class="rv br"></span>
    <div class="inner">
      <div class="hdr">
        <div class="rays"></div>
        <!-- scattered sparkles -->
        <span class="msp c" style="left:34px;top:34px;font-size:16px;animation-delay:0s">&#10022;</span>
        <span class="msp" style="left:68px;top:82px;font-size:18px;animation-delay:0.4s">&#10022;</span>
        <span class="msp m" style="left:130px;top:100px;font-size:12px;animation-delay:0.2s">&#10022;</span>
        <span class="msp c" style="right:34px;top:34px;font-size:16px;animation-delay:0.7s">&#10022;</span>
        <span class="msp" style="right:68px;top:82px;font-size:18px;animation-delay:0.9s">&#10022;</span>
        <span class="msp m" style="right:130px;top:100px;font-size:12px;animation-delay:0.5s">&#10022;</span>
        <svg class="hsp" style="left:112px;top:36px" viewBox="0 0 14 22"><line x1="3" y1="4" x2="10" y2="9"/><line x1="3" y1="18" x2="10" y2="13"/></svg>
        <svg class="hsp" style="right:112px;top:36px;transform:scaleX(-1)" viewBox="0 0 14 22"><line x1="3" y1="4" x2="10" y2="9"/><line x1="3" y1="18" x2="10" y2="13"/></svg>
        <svg class="hstar" viewBox="0 0 34 34"><polygon points="17,2 21.5,12.5 32,13 24,20 26.5,31 17,25 7.5,31 10,20 2,13 12.5,12.5" fill="#FFC61A" stroke="#FF5B17" stroke-width="2.5" stroke-linejoin="round"/></svg>
        <div class="title"><span class="ty">행운</span><span class="tw">복권</span></div>
        <svg class="hstar r" viewBox="0 0 34 34"><polygon points="17,2 21.5,12.5 32,13 24,20 26.5,31 17,25 7.5,31 10,20 2,13 12.5,12.5" fill="#FFC61A" stroke="#FF5B17" stroke-width="2.5" stroke-linejoin="round"/></svg>
      </div>
      <div class="sw" id="sw">
        <div class="pz">
          <div class="pz-bg"></div>
          <span class="bgst" style="left:26px;bottom:34px;font-size:46px">&#9733;</span>
          <span class="bgst" style="left:80px;bottom:16px;font-size:22px">&#9733;</span>
          <span class="bgst" style="right:26px;bottom:34px;font-size:46px">&#9733;</span>
          <span class="bgst" style="right:80px;bottom:16px;font-size:22px">&#9733;</span>
          <div class="pm-row" id="pm-row">
            <svg class="spd" viewBox="0 0 26 44"><line x1="4" y1="8" x2="22" y2="18"/><line x1="4" y1="36" x2="22" y2="26"/></svg>
            <div id="pm">?</div>
            <svg class="spd r" viewBox="0 0 26 44"><line x1="4" y1="8" x2="22" y2="18"/><line x1="4" y1="36" x2="22" y2="26"/></svg>
          </div>
          <div id="pd"></div>
          <div id="pb"></div>
        </div>
        <canvas id="sc"></canvas>
        <div class="sh" id="sh">&larr; 긁어보세요</div>
        <div id="csp">
          <span class="csp m" style="left:14px;top:12px;animation-delay:0s">&#10022;</span>
          <span class="csp m" style="right:14px;top:12px;animation-delay:0.5s">&#10022;</span>
          <span class="csp o" style="left:14px;bottom:12px;animation-delay:0.9s">&#10022;</span>
          <span class="csp o" style="right:14px;bottom:12px;animation-delay:0.3s">&#10022;</span>
        </div>
      </div>
    </div>
  </div>
</div>
<script>${FX_SCRIPT}<\/script>
<script>
const cvs=document.getElementById('sc'),ctx=cvs.getContext('2d')
const swEl=document.getElementById('sw'),wrap=document.getElementById('lw'),cardEl=document.querySelector('.card')
const pmEl=document.getElementById('pm'),pdEl=document.getElementById('pd'),pbEl=document.getElementById('pb')
const shEl=document.getElementById('sh'),cspEl=document.getElementById('csp'),pmRow=document.getElementById('pm-row')
let active=false,activeTimer=null
// '#RGB' / '#RRGGBB' → 'rgba(r,g,b,a)' (파싱 실패 시 노랑)
function withAlpha(hex,a){
  const m=/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex||'').trim())
  if(!m)return 'rgba(255,198,26,'+a+')'
  let h=m[1];if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2]
  const n=parseInt(h,16)
  return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')'
}

function initCanvas(){
  // clientWidth/Height ignores CSS transform (scale) and the panel border, so always correct
  cvs.width=swEl.clientWidth||584;cvs.height=swEl.clientHeight||214
  drawSilver()
}

function drawSilver(){
  const w=cvs.width,h=cvs.height
  // Base gradient
  const g=ctx.createLinearGradient(0,0,w*0.8,h)
  g.addColorStop(0,'#B4B4B4');g.addColorStop(0.15,'#D8D8D8')
  g.addColorStop(0.3,'#EDEDED');g.addColorStop(0.45,'#F6F6F6')
  g.addColorStop(0.55,'#F0F0F0');g.addColorStop(0.7,'#D2D2D2')
  g.addColorStop(0.85,'#BEBEBE');g.addColorStop(1,'#A8A8A8')
  ctx.fillStyle=g;ctx.fillRect(0,0,w,h)
  // Horizontal metallic grain
  ctx.globalAlpha=0.07
  for(let y=0;y<h;y+=2){
    const v=145+Math.random()*55
    ctx.fillStyle='rgb('+v+','+v+','+v+')'
    ctx.fillRect(0,y,w,1)
  }
  ctx.globalAlpha=1
  // Pixel noise for texture
  const img=ctx.getImageData(0,0,w,h),d=img.data
  for(let i=0;i<d.length;i+=4){
    const n=(Math.random()-0.5)*22
    d[i]=Math.max(100,Math.min(255,d[i]+n))
    d[i+1]=Math.max(100,Math.min(255,d[i+1]+n))
    d[i+2]=Math.max(100,Math.min(255,d[i+2]+n))
  }
  ctx.putImageData(img,0,0)
  // Bright sheen stripes
  ctx.globalAlpha=0.22
  const sg=ctx.createLinearGradient(0,0,w,0)
  sg.addColorStop(0,'transparent');sg.addColorStop(0.2,'rgba(255,255,255,0.9)')
  sg.addColorStop(0.45,'rgba(255,255,255,0.5)');sg.addColorStop(0.7,'rgba(255,255,255,0.8)')
  sg.addColorStop(1,'transparent')
  ctx.fillStyle=sg
  for(let y=0;y<h;y+=22){ctx.fillRect(0,y,w,7+Math.random()*4)}
  ctx.globalAlpha=1
}

function genStrokes(w,h){
  const rows=14,rowH=h/rows,strokes=[]
  for(let r=0;r<rows;r++){
    const baseY=rowH*r+rowH*0.35+Math.random()*rowH*0.3
    const ltr=r%2===0,pts=[]
    let x=ltr?-24:w+24
    while(ltr?x<w+24:x>-24){
      pts.push({x:x+(Math.random()*10-5),y:baseY+(Math.random()*rowH*0.5-rowH*0.25)})
      x+=ltr?(8+Math.random()*5):-(8+Math.random()*5)
    }
    strokes.push(pts)
  }
  return strokes
}

// 긁는 동안: 점마다 FX.scratch() (자체 스로틀), 진행 60% 지점부터 두구두구 + 카드 펄스
function animateScratch(strokes,totalMs,onDone){
  const totalPts=strokes.reduce((s,st)=>s+st.length,0)
  const msPerPt=totalMs/totalPts
  ctx.globalCompositeOperation='destination-out'
  let si=0,pi=0,lastT=null,accT=0,r0=22,done=0,tense=false
  function step(t){
    if(lastT!==null)accT+=t-lastT;lastT=t
    const want=Math.ceil(accT/msPerPt)
    let drew=0
    while(si<strokes.length&&drew<want){
      const p=strokes[si][pi]
      ctx.beginPath();ctx.arc(p.x,p.y,r0+(Math.random()*5-2.5),0,Math.PI*2);ctx.fill()
      pi++;drew++
      if(pi>=strokes[si].length){si++;pi=0}
    }
    accT-=drew*msPerPt
    if(drew>0){
      FX.scratch();done+=drew
      if(!tense&&done/totalPts>=0.6){tense=true;cardEl.classList.add('tense');FX.drumStart(90)}
    }
    if(si<strokes.length){requestAnimationFrame(step)}
    else{
      // Ensure full clear
      ctx.fillRect(0,0,cvs.width,cvs.height)
      ctx.globalCompositeOperation='source-over'
      onDone()
    }
  }
  requestAnimationFrame(step)
}

function showLottery(prize,color,detail,by,scratchMs,isWin){
  if(active)return;active=true
  if(activeTimer){clearTimeout(activeTimer);activeTimer=null}
  FX.hideWinner();cardEl.classList.remove('tense','shake')
  pmEl.textContent=prize;pmEl.style.color=color;pmEl.className=''
  pmRow.classList.remove('on')
  pdEl.textContent=detail||'';pbEl.textContent=by?by+'님의 복권':''
  shEl.style.display='block';cspEl.style.display='block'
  // Show first so layout sizes are correct
  wrap.classList.add('show')
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    initCanvas()
    setTimeout(()=>{
      const strokes=genStrokes(cvs.width,cvs.height)
      animateScratch(strokes,scratchMs,()=>{
        shEl.style.display='none';cspEl.style.display='none'
        pmEl.classList.add('popin')
        if(prize!=='꽝'){pmEl.classList.add('shimmer');pmRow.classList.add('on')}
        // ── 공개 연출 ──
        FX.drumStop();cardEl.classList.remove('tense')
        if(isWin){
          FX.sound('win')
          const big=/200개|500개|대박|초대박/.test(String(prize||''))
          if(big){
            FX.sound('jackpot')
            const r=swEl.getBoundingClientRect()
            FX.confetti({count:200,x:r.left+r.width/2,y:r.top})
          }
          FX.flash(withAlpha(color,0.5))
          FX.burst(swEl,color||'#FFC928')
        } else {
          FX.sound('lose')
          cardEl.classList.remove('shake');void cardEl.offsetWidth;cardEl.classList.add('shake')
          cardEl.addEventListener('animationend',()=>cardEl.classList.remove('shake'),{once:true})
        }
        FX.winner({nick:by||'',text:prize,sub:isWin?'복권 당첨':'복권 결과',anchor:cardEl,ms:4800})
        activeTimer=setTimeout(hide,5000)
      })
    },600)
  }))
}

function hide(){
  wrap.classList.remove('show')
  FX.hideWinner();FX.drumStop();cardEl.classList.remove('tense','shake')
  setTimeout(()=>{
    active=false
    pmEl.classList.remove('popin','shimmer');pmRow.classList.remove('on')
    shEl.style.display='block';cspEl.style.display='block'
    ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,cvs.width,cvs.height)
  },600)
}

function connect(){
  const ws=new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage=e=>{
    try{
      const msg=JSON.parse(e.data)
      FX.handle(msg)
      if(msg.type==='game:state'&&msg.data?.id==='lottery'&&msg.data?.status==='running'){
        const ls=msg.data.lottery
        if(ls)showLottery(ls.prize,ls.color,ls.detail,ls.triggeredBy,ls.scratchMs??3000,ls.isWin??(ls.prize!=='꽝'))
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
