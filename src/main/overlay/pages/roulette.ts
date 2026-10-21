// OBS 오버레이 페이지: roulette — '무대 조명 중계' 연출 (캔버스 1장에 타임라인 렌더, fish.ts 와 같은 카메라 리그 문법)
// 다섯 박자: 등장(조명 하나씩 켜짐·패널 펼침) → 진행(빠른 회전·조명 스윕) → 긴장(감속·핀 줌·레터박스·조명 수렴)
//           → 공개(80ms 히트스톱·플래시·펀치 줌·흔들림·타이포 슬램) → 여운(슬로모 조명·회전 후광·사선 결과 카드)
// 엔진 state.roulette(RouletteSpinState: winner, winnerIdx, items, spinMs, animType) 로 1회 재생.
//  - 공개 = spinMs (엔진 game:result 시점과 같음). 닉네임·별풍선은 game:result 가 오면 카드에 채운다.
//  - 휠(wheel)·텍스트 슬롯(text) 두 모드 모두 같은 무대·HUD·카드를 쓴다. 레이아웃은 고정 좌표(측정 없음).
import { FX_SCRIPT } from './_fx'

export const ROULETTE_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>룰렛 무대</title>
<meta name="viewport" content="width=1920">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@500;700;800;900&family=JetBrains+Mono:wght@600;700;800&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;padding:0;background:transparent !important;overflow:hidden;width:1920px;height:1080px}
  canvas{display:block;width:1920px;height:1080px}
</style>
</head>
<body>
<canvas id="c" width="1920" height="1080"></canvas>

<script>${FX_SCRIPT}<\/script>
<script>
(() => {
const C = document.getElementById('c'), X = C.getContext('2d');
const W = 1920, H = 1080;
const NAVY='#172437', OR='#FF5B17', CR='#F5F3EF', CR2='#FBF6EA', MINT='#00CB84', GOLD='#FFC928';
const FT='"Black Han Sans","Noto Sans KR",sans-serif';
const FK='"Noto Sans KR","Apple SD Gothic Neo",sans-serif';
const FM='"JetBrains Mono",ui-monospace,Menlo,monospace';
const PASTEL=['#FFD6D6','#FFE1C4','#FFF3B8','#D4F3E0','#CFE7FF','#E4D9FF','#FFD9EC','#D2F5F1','#FFD6D6','#FFE1C4'];
const DARK  =['#C8323A','#C2621A','#A88600','#1E8A4E','#1F63B8','#5A34B8','#B8307C','#0F8A80','#C8323A','#C2621A'];
const JACKPOT_RE=/상금|이벤트|당첨|1등|JACKPOT/i;
const P={x:140,y:100,w:1640,h:870,k:52};          // 무대 카메라 패널 (fish 와 같은 틀)

/* ---------- helpers ---------- */
const cl=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,p)=>a+(b-a)*p;
const seg=(t,a,b)=>b<=a?(t>=b?1:0):cl((t-a)/(b-a));
const eo=p=>1-Math.pow(1-p,3);
const ei=p=>p*p*p;
const eio=p=>p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
const eback=p=>{const c1=2.0,c3=c1+1;return 1+c3*Math.pow(p-1,3)+c1*Math.pow(p-1,2);};
const rnd=i=>{const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const TAU=Math.PI*2;

/* ---------- geometry (world units, 휠 중심 = 0,0) ---------- */
const R_OUT=280, R_RING=274, R_SEG=228, R_DOT=252, R_HUB=77, BULB_R=13, N_BULB=24;
const FLOOR=R_OUT+50;                               // 무대 바닥선
const CAP={y:40,w:1180,h:340,iw:1050,ih:220};       // 텍스트 슬롯 캡슐
const IH=CAP.ih;                                    // 슬롯 한 칸 높이
const LAMPS=[-780,-290,290,780], LY=-780;           // 트러스 조명 위치

/* ---------- round state ---------- */
let RD=null;           // 진행 중인 판
let TL={OB:700,TEN:2000,S:3000,HIT:3080,RES:3700};
let DATA={nick:'',gift:'',hasResult:false,balloon:0,by:''};
let fadeAt=0, cues={};
let hideTimer=null;
let lastAnimType='wheel';

function isJackpot(){return RD&&JACKPOT_RE.test(String(RD.winner||''));}
function isMiss(){return RD&&String(RD.winner||'').trim().indexOf('꽝')===0;}

/* ---------- wheel face (회전하는 판: 한 번만 그려 두고 돌린다) ---------- */
const FACE_S=2, FR=R_SEG+4;
const face=document.createElement('canvas'); face.width=face.height=FR*2*FACE_S;
function estW(str){let w=0;for(const ch of str)w+=ch===' '?0.3:/[ㄱ-힝]/.test(ch)?1.0:0.58;return w;}
function buildFace(items){
  const f=face.getContext('2d'); f.setTransform(1,0,0,1,0,0); f.clearRect(0,0,face.width,face.height);
  f.setTransform(FACE_S,0,0,FACE_S,FR*FACE_S,FR*FACE_S);
  const total=items.reduce((s,i)=>s+i.probability,0)||1;
  let st=0; const L=[];
  items.forEach((it,i)=>{const sw=(it.probability/total)*TAU;
    f.beginPath(); f.moveTo(0,0); f.arc(0,0,R_SEG,st,st+sw); f.closePath(); f.fillStyle=PASTEL[i%PASTEL.length]; f.fill();
    L.push({it,i,st,sw}); st+=sw;});
  // 바깥쪽 은은한 그늘 (입체감)
  const g=f.createRadialGradient(0,0,R_SEG*.55,0,0,R_SEG); g.addColorStop(0,'rgba(23,36,55,0)'); g.addColorStop(1,'rgba(23,36,55,.16)');
  f.fillStyle=g; f.beginPath(); f.arc(0,0,R_SEG,0,TAU); f.fill();
  if(items.length>1) L.forEach(l=>{f.beginPath();f.moveTo(0,0);f.lineTo(Math.cos(l.st)*R_SEG,Math.sin(l.st)*R_SEG);f.strokeStyle='#fff';f.lineWidth=4;f.lineCap='round';f.stroke();});
  L.forEach(({it,i,st,sw})=>{
    const mid=st+sw/2, label=it.name.length>7?it.name.slice(0,6)+'…':it.name;
    const arcLen=sw*R_SEG*.66, ew=estW(label), fsT=Math.floor((arcLen-14)/(ew+.2));
    f.save(); f.fillStyle=DARK[i%DARK.length]; f.textAlign='center'; f.textBaseline='middle';
    if(fsT>=19||sw>1.2){
      const fs=Math.min(38,Math.max(16,fsT)), rr=R_SEG*.66;
      f.translate(Math.cos(mid)*rr,Math.sin(mid)*rr); f.rotate(mid+Math.PI/2);
      f.font='900 '+fs+'px '+FK; f.fillText(label,0,0);
    } else {
      const avail=R_SEG-R_HUB-20, fs=Math.min(26,Math.max(13,Math.floor(avail/(ew+.3)))), rr=R_HUB+6+avail/2;
      f.translate(Math.cos(mid)*rr,Math.sin(mid)*rr); f.rotate(mid);
      f.font='900 '+fs+'px '+FK; f.fillText(label,0,0);
    }
    f.restore();
  });
  return L;
}
function segUnderPin(ang){
  if(!RD) return 0;
  let rel=((-Math.PI/2-ang)%TAU+TAU)%TAU;
  for(let i=0;i<RD.wedges.length;i++){const w=RD.wedges[i]; if(rel<w.st+w.sw) return i;}
  return RD.wedges.length-1;
}

/* ---------- motion model ---------- */
// 회전: 마지막 25% 구간에서 확실히 느려지는 감속 곡선 (1-(1-p)^3.4)
const spinE=p=>1-Math.pow(1-cl(p),3.4);
const spinV=p=>3.4*Math.pow(1-cl(p),2.4);
function wheelAngle(t){return RD.finalAngle*spinE(t/TL.S);}
function wheelVel(t){return t>=TL.S?0:RD.finalAngle*spinV(t/TL.S)/TL.S;}     // rad/ms
function slotPos(t){return (RD.list.length-1)*(1-spinE(t/TL.S));}             // 칸 단위 (0 = 당첨 칸)
function slotVel(t){return t>=TL.S?0:(RD.list.length-1)*spinV(t/TL.S)/TL.S;}
const amb=t=>t<TL.RES?t:TL.RES+(t-TL.RES)*.25;                                 // 여운은 슬로모 ×0.25

/* ---------- camera rig ---------- */
let kickT=-1e9, kickN=0;   // 핀 튕김 / 칸 통과 시각 (loop 에서 갱신)
function camAt(t){
  const tm=RD.mode==='text', {OB,TEN,S,HIT,RES}=TL;
  const zT=tm?1.24:1.45, yT=tm?CAP.y+70:-150;
  let x=0,y=20,z=1,r=0,sh=0;
  if(t<OB){
    const p=eback(seg(t,0,Math.min(OB,520)));
    z=lerp(.66,1,p); x=lerp(420,0,p); y=lerp(-220,20,p); r=lerp(-.11,0,eo(seg(t,0,Math.min(OB,480))));
  } else if(t<TEN){
    const p=eio(seg(t,OB,TEN));
    z=lerp(1,1.08,p); x=Math.sin(t*.0008)*12; y=20+Math.sin(t*.0011)*6;
  } else if(t<S){
    const p=seg(t,TEN,S), q=ei(p)*.55+eio(p)*.45;
    z=lerp(1.08,zT,q); x=lerp(Math.sin(TEN*.0008)*12,0,p); y=lerp(20,yT,eio(p));
    r=Math.sin(t*.0023)*.008*p;
    sh=1+p*5+5*Math.exp(-(t-kickT)/90)*p;
  } else if(t<HIT){
    z=zT*1.06; y=yT; sh=26;
  } else if(t<RES){
    const base=tm?1.0:1.12;
    z=lerp(base*1.15,base,eo(seg(t,HIT,HIT+180))); y=tm?CAP.y:-30;
    r=-.045*Math.exp(-(t-HIT)/260)*Math.cos((t-HIT)*.025);
    sh=14*(1-seg(t,HIT,HIT+350));
  } else {
    const q=eo(seg(t,RES,RES+900)), z0=tm?1.0:1.12, z1=tm?.72:.95;
    z=lerp(z0,z1,q)+seg(t,RES+900,RES+5000)*.03;
    x=lerp(0,tm?520:330,q); y=lerp(tm?CAP.y:-30,tm?CAP.y+40:10,q);
    r=lerp(.02,0,eo(seg(t,RES,RES+2200)));
    sh=8*Math.exp(-(t-RES)/200);
  }
  const k=Math.floor(t/16);
  return {x:x+(rnd(k)-.5)*2*sh/z, y:y+(rnd(k+977)-.5)*2*sh/z, z, r};
}

/* ---------- spotlights (중계 장치: 무대 조명) ---------- */
const SPOT_COL=['255,91,23','255,201,40','0,203,132','255,91,23'];
function spots(t){
  const {OB,TEN,S,RES}=TL, at=amb(t), mc=RD.mode==='text'?CAP.y:-20, miss=isMiss();
  const out=[];
  for(let i=0;i<4;i++){
    const onAt=40+i*95, on=t>=onAt?1:0, over=(t>=onAt&&t<onAt+70)?1.5:1;
    const sweep=Math.sin(at*.0011+i*1.9)*560;
    let tx, ty=FLOOR, w=300, a=.5*on*over, col='255,241,214';
    if(t<OB){ tx=lerp((i<2?1:-1)*620,sweep,eo(seg(t,onAt,OB))); }
    else if(t<TEN){ tx=sweep; }
    else if(t<S){
      const p=eio(seg(t,TEN,S));
      tx=lerp(sweep,(i-1.5)*36,p); ty=lerp(FLOOR,mc,p); w=lerp(300,170,p);
      const inner=i===1||i===2; a=inner?lerp(.5,.85,p):lerp(.5,.2,p); if(!inner) col='255,91,23';
    } else if(t<RES){
      const p=seg(t,S,RES); tx=(i-1.5)*30; ty=mc; w=lerp(560,360,eo(p)); a=lerp(1.15,.62,p);
    } else {
      const p=eo(seg(t,RES,RES+700));
      tx=lerp((i-1.5)*30,Math.sin(at*.0014+i*2.2)*620,p); ty=FLOOR; w=lerp(360,320,p);
      col=SPOT_COL[i]; a=lerp(.62,.5,p);
      if(miss){ col=i===1?'200,220,255':'120,140,170'; a=i===1?lerp(.62,.55,p):lerp(.62,.08,p); if(i===1){tx=lerp(tx,-40,p);ty=mc;w=230;} }
    }
    out.push({lx:LAMPS[i],tx,ty,w,a,col,on});
  }
  return out;
}
function drawCone(c,s){
  if(s.a<=0) return;
  const dx=s.tx-s.lx, dy=s.ty-LY, L=Math.hypot(dx,dy)||1, ux=dx/L, uy=dy/L, nx=-uy, ny=ux;
  const ext=(FLOOR+90-LY)/Math.max(.2,uy);       // 바닥까지 연장
  const fx=s.lx+ux*ext, fy=LY+uy*ext, w0=26, w1=s.w*ext/L*.62;
  const g=c.createLinearGradient(s.lx,LY,fx,fy);
  g.addColorStop(0,'rgba('+s.col+','+(.55*s.a).toFixed(3)+')');
  g.addColorStop(.7,'rgba('+s.col+','+(.22*s.a).toFixed(3)+')');
  g.addColorStop(1,'rgba('+s.col+',0)');
  c.fillStyle=g; c.beginPath();
  c.moveTo(s.lx+nx*w0,LY+ny*w0); c.lineTo(fx+nx*w1,fy+ny*w1); c.lineTo(fx-nx*w1,fy-ny*w1); c.lineTo(s.lx-nx*w0,LY-ny*w0); c.closePath(); c.fill();
}
function floorX(s,y){const uy=(s.ty-LY)||1;return s.lx+(s.tx-s.lx)*(y-LY)/uy;}

/* ---------- machine: wheel ---------- */
const PIN=new Path2D('M 25 3 C 12.5 3 4.5 12.5 4.5 23.5 C 4.5 34 12 40 25 66 C 38 40 45.5 34 45.5 23.5 C 45.5 12.5 37.5 3 25 3 Z');
function starPath(c,x,y,ro,ri,n){c.beginPath();for(let i=0;i<n*2;i++){const a=-Math.PI/2+i*Math.PI/n,rr=i%2===0?ro:ri;c[i===0?'moveTo':'lineTo'](x+Math.cos(a)*rr,y+Math.sin(a)*rr);}c.closePath();}
function bulbState(t){
  const {TEN,S,RES}=TL, at=amb(t);
  if(t<TEN) return i=>(i+Math.floor(t/130))%3===0;
  if(t<S) return i=>(i+Math.floor(t/240))%2===0;
  if(t<RES) return ()=>true;
  return i=>(i+Math.floor(at/420))%2===0;
}
function drawStand(c,top,half){
  c.fillStyle='#0d1729'; c.beginPath(); c.moveTo(-half*.45,top); c.lineTo(half*.45,top); c.lineTo(half,FLOOR); c.lineTo(-half,FLOOR); c.closePath(); c.fill();
  c.strokeStyle=NAVY; c.lineWidth=5; c.stroke();
  c.fillStyle=OR; c.fillRect(-half-14,FLOOR-22,half*2+28,22); c.strokeRect(-half-14,FLOOR-22,half*2+28,22);
}
function drawWheel(c,t,refl){
  const {TEN,S,RES}=TL, ang=t>=S?RD.finalAngle:wheelAngle(t), vel=wheelVel(t);
  drawStand(c,R_OUT-40,150);
  // 남색 외곽 + 주황 마퀴 링
  c.beginPath(); c.arc(0,0,R_OUT,0,TAU); c.fillStyle=NAVY; c.fill();
  c.beginPath(); c.arc(0,0,R_RING,0,TAU); c.fillStyle=OR; c.fill();
  c.beginPath(); c.arc(0,0,R_RING,0,TAU); c.arc(0,0,R_RING-9,0,TAU,true); c.fillStyle='rgba(255,255,255,.16)'; c.fill();
  c.beginPath(); c.arc(0,0,R_SEG+5,0,TAU); c.fillStyle=NAVY; c.fill();
  // 판 (빠를수록 잔상)
  const blur=cl(Math.abs(vel)/0.012);
  c.save(); c.beginPath(); c.arc(0,0,R_SEG,0,TAU); c.clip();
  c.save(); c.rotate(ang); c.drawImage(face,-FR,-FR,FR*2,FR*2); c.restore();
  if(blur>.05){ for(let k=1;k<=4;k++){ c.save(); c.globalAlpha=.26*blur; c.rotate(ang-vel*k*9); c.drawImage(face,-FR,-FR,FR*2,FR*2); c.restore(); } }
  // 긴장: 핀 아래 칸만 밝게, 나머지는 어둡게
  const cur=segUnderPin(ang);
  if(t>=TEN){
    const d=t<S?eio(seg(t,TEN,TEN+500))*.42:(t<RES?0:.3*eo(seg(t,RES,RES+600)));
    if(d>0) RD.wedges.forEach((w,i)=>{ if(i===cur) return; c.beginPath(); c.moveTo(0,0); c.arc(0,0,R_SEG+1,ang+w.st,ang+w.st+w.sw); c.closePath(); c.fillStyle='rgba(6,12,24,'+d.toFixed(3)+')'; c.fill(); });
  }
  // 공개: 당첨 칸 흰 펄스 2회 + 금색 테두리 유지
  if(t>=S){
    const w=RD.wedges[RD.winIdx]||RD.wedges[cur], p=seg(t,S,S+900), a=Math.pow(Math.max(0,Math.sin(p*Math.PI*2)),1.2)*(1-p*.3);
    if(a>0){ c.beginPath(); c.moveTo(0,0); c.arc(0,0,R_SEG,ang+w.st,ang+w.st+w.sw); c.closePath(); c.fillStyle='rgba(255,255,255,'+(.7*a).toFixed(3)+')'; c.fill(); }
    c.save(); c.beginPath(); c.moveTo(0,0); c.arc(0,0,R_SEG-4,ang+w.st,ang+w.st+w.sw); c.closePath();
    c.strokeStyle=GOLD; c.lineWidth=9; c.lineJoin='round'; if(!refl){c.shadowColor=GOLD; c.shadowBlur=22;} c.stroke(); c.restore();
  }
  c.restore();
  // 전구
  const lit=bulbState(t);
  for(let i=0;i<N_BULB;i++){
    const a=i/N_BULB*TAU-Math.PI/2, x=Math.cos(a)*R_DOT, y=Math.sin(a)*R_DOT, on=lit(i);
    c.beginPath(); c.arc(x,y+2,BULB_R,0,TAU); c.fillStyle='rgba(23,36,55,.25)'; c.fill();
    if(on&&!refl){c.save(); c.shadowColor=GOLD; c.shadowBlur=18;}
    c.beginPath(); c.arc(x,y,BULB_R,0,TAU); c.fillStyle=on?GOLD:CR2; c.fill();
    if(on&&!refl) c.restore();
  }
  // 허브
  if(t>=S){
    const s=t<RES?lerp(1.5,1,eback(seg(t,S+60,S+300))):1;
    c.save(); c.scale(s,s);
    c.beginPath(); c.arc(0,4,R_HUB,0,TAU); c.fillStyle='rgba(23,36,55,.3)'; c.fill();
    c.beginPath(); c.arc(0,0,R_HUB,0,TAU); c.fillStyle=NAVY; c.fill();
    c.beginPath(); c.arc(0,0,R_HUB-7,0,TAU); c.fillStyle=isMiss()?'#8a97a8':GOLD; c.fill();
    c.save(); c.beginPath(); c.arc(0,0,R_HUB-16,0,TAU); c.strokeStyle='rgba(23,36,55,.55)'; c.lineWidth=2; c.setLineDash([5,5]); c.stroke(); c.restore();
    c.fillStyle=NAVY; c.textAlign='center'; c.textBaseline='middle'; c.font='34px '+FT;
    c.fillText(isMiss()?'꽝':(isJackpot()?'잭팟':'당첨'),0,-6); starPath(c,0,32,10,4.4,5); c.fill();
    c.restore();
  } else {
    const hr=60;
    c.beginPath(); c.arc(0,4,hr,0,TAU); c.fillStyle='rgba(23,36,55,.3)'; c.fill();
    c.beginPath(); c.arc(0,0,hr,0,TAU); c.fillStyle=NAVY; c.fill();
    c.beginPath(); c.arc(0,0,hr-7,0,TAU); c.fillStyle=OR; c.fill();
    c.save(); c.rotate(ang*.0); starPath(c,0,1,27,12,5); c.fillStyle=CR2; c.fill(); c.restore();
  }
  // 핀 (칸 경계를 넘을 때마다 튕김)
  const ps=1.66, d=t-kickT, amp=t<TEN?.2:.34;
  const kick=(t<S&&d>=0)?amp*Math.sin(Math.min(1,d/35)*Math.PI/2)*Math.exp(-Math.max(0,d-35)/80):0;
  const land=(t>=S&&t<S+300)?-.18*Math.exp(-(t-S)/90)*Math.cos((t-S)*.04):0;
  c.save(); c.translate(0,-R_SEG-44*ps); c.rotate(kick+land); c.scale(ps,ps); c.translate(-25,-22);
  if(!refl){c.shadowColor='rgba(0,0,0,.4)'; c.shadowBlur=10; c.shadowOffsetY=5;}
  c.fillStyle=OR; c.fill(PIN); c.shadowColor='transparent'; c.lineWidth=3.5; c.strokeStyle=NAVY; c.lineJoin='round'; c.stroke(PIN);
  c.beginPath(); c.arc(25,22,7.5,0,TAU); c.fillStyle=CR2; c.fill(); c.lineWidth=2; c.stroke();
  c.restore();
}

/* ---------- machine: text slot capsule ---------- */
let capDots=null;
function buildCapDots(){
  const Wc=CAP.w, Hc=CAP.h, R=Hc/2, inset=30, r=R-inset, segs=[];
  segs.push({len:Wc-2*R,at:u=>[-Wc/2+R+u*(Wc-2*R),-Hc/2+inset]});
  segs.push({len:Math.PI*r,at:u=>{const a=-Math.PI/2+u*Math.PI;return [Wc/2-R+Math.cos(a)*r,Math.sin(a)*r];}});
  segs.push({len:Wc-2*R,at:u=>[Wc/2-R-u*(Wc-2*R),Hc/2-inset]});
  segs.push({len:Math.PI*r,at:u=>{const a=Math.PI/2+u*Math.PI;return [-Wc/2+R+Math.cos(a)*r,Math.sin(a)*r];}});
  const L=segs.reduce((s,g)=>s+g.len,0), n=Math.round(L/62), out=[];
  for(let i=0;i<n;i++){let d=i*L/n;for(const g of segs){if(d<=g.len){out.push(g.at(g.len?d/g.len:0));break;}d-=g.len;}}
  return out;
}
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function fitFont(c,txt,px,maxW,font){c.font=px+'px '+font;const m=c.measureText(txt).width;if(m>maxW){px=Math.max(24,Math.floor(px*maxW/m));c.font=px+'px '+font;}return px;}
function drawText(c,t,refl){
  const {TEN,S,RES}=TL, pos=t>=S?0:slotPos(t), vel=slotVel(t);
  if(!capDots) capDots=buildCapDots();
  c.save(); c.translate(0,CAP.y);
  drawStand(c,CAP.h/2-10,170);
  if(!refl){ c.strokeStyle='rgba(245,243,239,.35)'; c.lineWidth=4; [-430,430].forEach(x=>{c.beginPath();c.moveTo(x,-CAP.h/2+20);c.lineTo(x,-1400);c.stroke();}); }
  // 몸통
  rr(c,-CAP.w/2,-CAP.h/2,CAP.w,CAP.h,CAP.h/2); c.fillStyle=OR; c.fill(); c.lineWidth=9; c.strokeStyle=NAVY; c.stroke();
  rr(c,-CAP.w/2+12,-CAP.h/2+10,CAP.w-24,CAP.h*.42,CAP.h*.4); c.fillStyle='rgba(255,255,255,.12)'; c.fill();
  // 전구
  const lit=bulbState(t);
  capDots.forEach(([x,y],i)=>{const on=lit(i);
    c.beginPath(); c.arc(x,y+2,12,0,TAU); c.fillStyle='rgba(23,36,55,.22)'; c.fill();
    if(on&&!refl){c.save();c.shadowColor=GOLD;c.shadowBlur=16;}
    c.beginPath(); c.arc(x,y,12,0,TAU); c.fillStyle=on?GOLD:CR2; c.fill(); if(on&&!refl) c.restore();});
  // 창
  const ix=-CAP.iw/2, iy=-CAP.ih/2;
  rr(c,ix,iy,CAP.iw,CAP.ih,CAP.ih/2); c.fillStyle=CR2; c.fill();
  c.save(); rr(c,ix,iy,CAP.iw,CAP.ih,CAP.ih/2); c.clip();
  c.textAlign='center'; c.textBaseline='middle';
  const k0=Math.floor(pos);
  const blur=cl(Math.abs(vel)*IH/2.2);
  for(let k=k0-1;k<=k0+2;k++){
    if(k<0||k>=RD.list.length) continue;
    const y=(k-pos)*IH, name=RD.list[k];
    fitFont(c,name,128,CAP.iw-160,FT);
    if(blur>.05){ for(let g=1;g<=3;g++){ c.globalAlpha=.22*blur; c.fillStyle=NAVY; c.fillText(name,0,y-g*vel*IH*10+8); } c.globalAlpha=1; }
    const focus=t>=TEN&&t<S&&Math.abs(y)<IH*.5;
    c.fillStyle=(t>=S&&k===0)?NAVY:(focus?'#0b1424':NAVY); c.fillText(name,0,y+8);
  }
  // 위·아래 페이드
  let g=c.createLinearGradient(0,iy,0,iy+60); g.addColorStop(0,'rgba(251,246,234,1)'); g.addColorStop(1,'rgba(251,246,234,0)'); c.fillStyle=g; c.fillRect(ix,iy,CAP.iw,60);
  g=c.createLinearGradient(0,-iy-60,0,-iy); g.addColorStop(0,'rgba(251,246,234,0)'); g.addColorStop(1,'rgba(251,246,234,1)'); c.fillStyle=g; c.fillRect(ix,-iy-60,CAP.iw,60);
  if(t>=TEN&&t<S){ c.fillStyle='rgba(255,91,23,'+(.12*eio(seg(t,TEN,S))).toFixed(3)+')'; c.fillRect(ix,iy,CAP.iw,CAP.ih); }
  if(t>=S){ const p=seg(t,S,S+900), a=Math.pow(Math.max(0,Math.sin(p*Math.PI*2)),1.2)*(1-p*.3); if(a>0){c.fillStyle='rgba(255,255,255,'+(.75*a).toFixed(3)+')'; c.fillRect(ix,iy,CAP.iw,CAP.ih);} }
  c.restore();
  rr(c,ix,iy,CAP.iw,CAP.ih,CAP.ih/2); c.lineWidth=7; c.strokeStyle=(t>=S)?GOLD:NAVY; if(t>=S&&!refl){c.save();c.shadowColor=GOLD;c.shadowBlur=20;c.stroke();c.restore();} else c.stroke();
  // 좌우 지시 화살표 (페이라인)
  const d=t-kickT, nudge=(t<S&&d>=0)?10*Math.exp(-d/70):0;
  [-1,1].forEach(sd=>{ c.save(); c.translate(sd*(CAP.iw/2-18+nudge),0); c.scale(sd,1);
    c.beginPath(); c.moveTo(-30,0); c.lineTo(10,-30); c.lineTo(10,30); c.closePath(); c.fillStyle=t>=S?GOLD:OR; c.fill(); c.lineWidth=5; c.strokeStyle=NAVY; c.stroke(); c.restore(); });
  // 상단 라벨
  c.save(); c.translate(0,-CAP.h/2-6);
  rr(c,-170,-34,340,68,34); c.fillStyle=NAVY; c.fill(); c.lineWidth=5; c.strokeStyle=OR; c.stroke();
  c.fillStyle=CR; c.font='900 30px '+FK; c.textAlign='center'; c.textBaseline='middle'; c.fillText('룰렛 추첨기',0,2);
  c.fillStyle=GOLD; starPath(c,-128,0,13,5.5,5); c.fill(); starPath(c,128,0,13,5.5,5); c.fill();
  c.restore();
  c.restore();
}
function drawMachine(c,t,refl){ if(RD.mode==='text') drawText(c,t,refl); else drawWheel(c,t,refl); }

/* ---------- world (stage) ---------- */
function drawWorld(c,t,cam){
  const at=amb(t), {S,RES}=TL, mc=RD.mode==='text'?CAP.y:0, sp=spots(t);
  c.save(); c.translate(960,540); c.rotate(cam.r); c.scale(cam.z,cam.z); c.translate(-cam.x,-cam.y);
  // 뒷벽
  let g=c.createLinearGradient(0,-1300,0,FLOOR);
  g.addColorStop(0,'#04080f'); g.addColorStop(.55,'#0a1424'); g.addColorStop(1,'#16243b');
  c.fillStyle=g; c.fillRect(-4000,-3000,8000,3000+FLOOR);
  // LED 벽 기둥 (여운엔 색이 번진다)
  for(let i=-16;i<=16;i++){
    const x=i*130, hue=t>=RES?SPOT_COL[(i+40)%4]:'245,243,239';
    const a=(t>=RES?.07+.05*Math.sin(at*.004+i*.8):.035)*(t>=TL.TEN&&t<S?.4:1);
    c.fillStyle='rgba('+hue+','+Math.max(0,a).toFixed(3)+')'; c.fillRect(x-40,-1300,80,FLOOR+1300-10);
  }
  // 회전 후광 (공개~여운)
  if(t>=S){
    const a=t<RES?eo(seg(t,S,S+200)):1, miss=isMiss();
    c.save(); c.translate(0,mc); c.rotate(at*.0007); c.globalCompositeOperation='lighter';
    for(let i=0;i<24;i++){ const an=i/24*TAU, w=.065;
      const gr=c.createRadialGradient(0,0,0,0,0,1100); gr.addColorStop(0,miss?'rgba(170,190,220,'+(.22*a)+')':'rgba(255,200,80,'+(.42*a)+')'); gr.addColorStop(1,'rgba(255,120,30,0)');
      c.fillStyle=gr; c.beginPath(); c.moveTo(0,0); c.arc(0,0,1100,an-w,an+w); c.closePath(); c.fill(); }
    const gl=c.createRadialGradient(0,0,0,0,0,520); gl.addColorStop(0,miss?'rgba(180,200,230,'+(.3*a)+')':'rgba(255,226,140,'+(.55*a)+')'); gl.addColorStop(1,'rgba(255,140,40,0)');
    c.fillStyle=gl; c.beginPath(); c.arc(0,0,520,0,TAU); c.fill();
    c.restore();
  }
  // 트러스 + 조명 헤드
  c.fillStyle='#1d2a40'; c.fillRect(-1600,LY-40,3200,34);
  c.strokeStyle='#2c3c57'; c.lineWidth=4; for(let x=-1600;x<1600;x+=60){c.beginPath();c.moveTo(x,LY-40);c.lineTo(x+60,LY-6);c.stroke();}
  sp.forEach(s=>{ c.save(); c.translate(s.lx,LY); c.rotate(Math.atan2(s.ty-LY,s.tx-s.lx)-Math.PI/2);
    c.fillStyle='#0b111c'; c.fillRect(-34,-30,68,60); c.fillStyle=s.on?'rgba('+s.col+','+Math.min(1,.4+s.a)+')':'#222c3c'; c.beginPath(); c.ellipse(0,30,30,10,0,0,TAU); c.fill(); c.restore(); });
  // 바닥
  g=c.createLinearGradient(0,FLOOR,0,FLOOR+700); g.addColorStop(0,'#1a2840'); g.addColorStop(1,'#03070d');
  c.fillStyle=g; c.fillRect(-4000,FLOOR,8000,3000);
  c.strokeStyle='rgba(245,243,239,.06)'; c.lineWidth=2;
  for(let i=-14;i<=14;i++){c.beginPath();c.moveTo(i*120,FLOOR);c.lineTo(i*420,FLOOR+900);c.stroke();}
  for(let j=1;j<8;j++){const y=FLOOR+Math.pow(j/8,1.7)*700;c.beginPath();c.moveTo(-4000,y);c.lineTo(4000,y);c.stroke();}
  // 바닥 반사 (머신을 뒤집어 흐리게)
  c.save(); c.beginPath(); c.rect(-4000,FLOOR,8000,3000); c.clip();
  c.translate(0,FLOOR*2); c.scale(1,-1); c.globalAlpha=.24; drawMachine(c,t,true); c.restore();
  g=c.createLinearGradient(0,FLOOR,0,FLOOR+380); g.addColorStop(0,'rgba(10,18,32,0)'); g.addColorStop(1,'rgba(4,8,14,.96)');
  c.fillStyle=g; c.fillRect(-4000,FLOOR,8000,3000);
  // 조명 원뿔 + 바닥 조명 웅덩이
  c.save(); c.globalCompositeOperation='lighter';
  sp.forEach(s=>drawCone(c,s));
  sp.forEach(s=>{ if(s.a<=0) return; const x=floorX(s,FLOOR+70), rx=s.w*.95;
    const pg=c.createRadialGradient(x,FLOOR+70,0,x,FLOOR+70,rx); pg.addColorStop(0,'rgba('+s.col+','+(.5*s.a).toFixed(3)+')'); pg.addColorStop(1,'rgba('+s.col+',0)');
    c.save(); c.translate(x,FLOOR+70); c.scale(1,.2); c.translate(-x,-(FLOOR+70)); c.fillStyle=pg; c.beginPath(); c.arc(x,FLOOR+70,rx,0,TAU); c.fill(); c.restore(); });
  c.restore();
  // 무대 앞 가장자리 전구줄
  for(let i=-30;i<=30;i++){ const x=i*56, on=t>=RES?(i+Math.floor(at/300))%2===0:(t<TL.TEN?(i+Math.floor(t/150))%4===0:false);
    c.fillStyle=on?GOLD:'rgba(245,243,239,.25)'; c.beginPath(); c.arc(x,FLOOR+520,7,0,TAU); c.fill(); }
  // 머신
  drawMachine(c,t,false);
  // 머신에 떨어지는 핀 조명 (긴장·공개)
  if(t>=TL.TEN){
    const a=t<S?eio(seg(t,TL.TEN,S))*.35:(t<RES?.5*(1-seg(t,S,RES))+.15:.12);
    c.save(); c.globalCompositeOperation='lighter';
    const fy=RD.mode==='text'?CAP.y:-R_SEG*.55;
    const lg=c.createRadialGradient(0,fy,0,0,fy,380); lg.addColorStop(0,'rgba(255,241,214,'+a.toFixed(3)+')'); lg.addColorStop(1,'rgba(255,241,214,0)');
    c.fillStyle=lg; c.beginPath(); c.arc(0,fy,380,0,TAU); c.fill(); c.restore();
  }
  c.restore();
}

/* ---------- crowd silhouettes (앞줄 관객) ---------- */
function crowd(c,t,cam){
  const {S,HIT,RES}=TL, at=amb(t), cheer=t>=HIT;
  const base=P.y+P.h+6, ox=-(cam.x)*.12;
  for(let i=0;i<19;i++){
    const r=30+rnd(i+5)*14, x=P.x+20+i*90+rnd(i)*30+ox;
    const jump=cheer?Math.abs(Math.sin((t<RES?t:at)*.012+i*1.3))*(t<RES?22:12)*(isMiss()?.3:1):0;
    const y=base-r*1.25-jump;
    c.fillStyle='#02050a';
    if(cheer&&rnd(i+9)>.4&&!isMiss()){ c.strokeStyle='#02050a'; c.lineWidth=r*.42; c.lineCap='round';
      const wv=Math.sin(at*.01+i)*.25; [-1,1].forEach(sd=>{c.beginPath();c.moveTo(x+sd*r*.9,y+r*1.1);c.lineTo(x+sd*r*(1.4+wv),y-r*1.6);c.stroke();}); }
    c.beginPath(); c.arc(x,y,r,0,TAU); c.fill();
    c.beginPath(); c.ellipse(x,y+r*1.9,r*1.45,r*1.1,0,0,TAU); c.fill();
    c.strokeStyle='rgba(255,236,200,'+(t>=S&&t<RES?.45:.18)+')'; c.lineWidth=3; c.beginPath(); c.arc(x,y,r,Math.PI*1.15,Math.PI*1.85); c.stroke();
  }
}

/* ---------- screen fx ---------- */
function screenFX(c,t,cam){
  const {TEN,S,HIT,RES}=TL;
  let g=c.createRadialGradient(960,540,420,960,540,1060);
  g.addColorStop(0,'rgba(0,6,14,0)'); g.addColorStop(1,'rgba(0,6,14,.66)'); c.fillStyle=g; c.fillRect(0,0,W,H);
  // 진행: 회전 속도선 (휠 둘레 원호)
  if(t>=TL.OB&&t<S){
    const v=RD.mode==='text'?cl(slotVel(t)*IH/2.2):cl(Math.abs(wheelVel(t))/.012), a=v*(1-seg(t,TEN,TEN+400))*.7;
    if(a>.02){ c.save(); c.translate(960-cam.x*cam.z,540+((RD.mode==='text'?CAP.y:0)-cam.y)*cam.z);
      for(let i=0;i<26;i++){ const rr=(RD.mode==='text'?420:330)+rnd(i)*240, a0=rnd(i+3)*TAU+t*.004*(1+rnd(i+7)), len=.25+rnd(i+9)*.4;
        c.strokeStyle='rgba(245,243,239,'+(a*(.25+rnd(i+11)*.4)).toFixed(3)+')'; c.lineWidth=2+rnd(i+13)*4;
        if(RD.mode==='text'){ const x=(rnd(i+20)-.5)*1500, y=((rnd(i+21)*900+t*1.4)%900)-450; c.beginPath(); c.moveTo(x,y); c.lineTo(x,y+60+rnd(i)*120); c.stroke(); }
        else { c.beginPath(); c.arc(0,0,rr*cam.z,a0,a0+len); c.stroke(); } }
      c.restore(); }
  }
  // 긴장: 주황 가장자리 + 모이는 집중선 + 레터박스
  if(t>=TEN&&t<RES){
    const ten=seg(t,TEN,S), pulse=t<S?Math.exp(-(t-kickT)/140):0;
    const og=c.createRadialGradient(960,560,300,960,560,1150);
    og.addColorStop(0,'rgba(255,91,23,0)'); og.addColorStop(1,'rgba(255,60,10,'+Math.min(.5,ten*.3+pulse*.18).toFixed(3)+')');
    if(t<S){ c.fillStyle=og; c.fillRect(0,0,W,H);
      c.save(); c.translate(960,RD.mode==='text'?560:470);
      for(let i=0;i<48;i++){ const a=rnd(i+400)*TAU, r0=380+rnd(i+401)*200+((t*.3)%70), r1=r0+260+rnd(i+402)*420;
        c.strokeStyle='rgba(245,243,239,'+(ten*.24).toFixed(3)+')'; c.lineWidth=2+rnd(i+403)*4;
        c.beginPath(); c.moveTo(Math.cos(a)*r0,Math.sin(a)*r0); c.lineTo(Math.cos(a)*r1,Math.sin(a)*r1); c.stroke(); }
      c.restore(); }
    const hb=90*eo(seg(t,TEN,TEN+450))*(1-seg(t,HIT,HIT+220));
    c.fillStyle='#03060b'; c.fillRect(0,P.y,W,hb); c.fillRect(0,P.y+P.h-hb,W,hb);
  }
  // 공개: 히트스톱 동안 흰 플래시 + 방사 집중선, 이후 잔광
  if(t>=S&&t<RES+300){
    const fl=Math.pow(1-seg(t,S,S+240),2);
    if(t<HIT){
      c.fillStyle='rgba(255,250,240,'+(.82*fl).toFixed(3)+')'; c.fillRect(0,0,W,H);
      c.save(); c.translate(960,560);
      for(let i=0;i<44;i++){ const a=i/44*TAU+rnd(i)*.08, r0=130, r1=1300;
        c.fillStyle=i%2?OR:NAVY; c.beginPath(); c.moveTo(Math.cos(a-.022)*r0,Math.sin(a-.022)*r0); c.lineTo(Math.cos(a)*r1,Math.sin(a)*r1); c.lineTo(Math.cos(a+.03)*r0,Math.sin(a+.03)*r0); c.fill(); }
      c.restore();
    } else {
      const f2=Math.pow(1-seg(t,HIT,HIT+300),2); c.fillStyle='rgba(255,250,240,'+(.46*f2).toFixed(3)+')'; c.fillRect(0,0,W,H);
    }
  }
  if(t>=RES){ const a=.4*(1-seg(t,RES,RES+260)); c.fillStyle='rgba(255,240,210,'+a.toFixed(3)+')'; c.fillRect(0,0,W,H); }
  // 필름 그레인
  const k=Math.floor(t/42);
  for(let i=0;i<220;i++){ c.fillStyle=rnd(k*31+i)>.5?'rgba(255,255,255,.06)':'rgba(0,0,0,.08)'; c.fillRect(P.x+rnd(k*17+i)*P.w,P.y+rnd(k*13+i+5)*P.h,2,2); }
}

/* ---------- panel + HUD ---------- */
function panelPath(c,x,y,w,h,k){c.beginPath();c.moveTo(x+k,y);c.lineTo(x+w,y);c.lineTo(x+w,y+h-k);c.lineTo(x+w-k,y+h);c.lineTo(x,y+h);c.lineTo(x,y+k);c.closePath();}
const PH=[
  {n:'01',ko:'등장',en:'OPEN',cue:'오프닝',sub:'조명 ON — 오늘의 룰렛 쇼'},
  {n:'02',ko:'회전',en:'SPIN',cue:'스윕',sub:'돌아간다, 돌아간다'},
  {n:'03',ko:'긴장',en:'TENSION',cue:'핀 조명',sub:'멈춘다… 과연?'},
  {n:'04',ko:'공개',en:'REVEAL',cue:'풀 화이트'},
  {n:'05',ko:'결과',en:'RESULT',cue:'컬러 웨이브'}
];
function phStart(i){return [0,TL.OB,TL.TEN,TL.S,TL.RES][i];}
function phEnd(i){return [TL.OB,TL.TEN,TL.S,TL.RES,TL.RES+5000][i];}
function phaseIdx(t){for(let i=4;i>=0;i--)if(t>=phStart(i))return i;return 0;}
function hud(c,t,cam,py,ph){
  c.save();
  panelPath(c,P.x,py,P.w,ph,P.k); c.strokeStyle='rgba(245,243,239,.55)'; c.lineWidth=3; c.stroke();
  const L=70, y0=py, y1=py+ph; c.strokeStyle=OR; c.lineWidth=9; c.lineCap='square';
  c.beginPath(); c.moveTo(P.x+P.w-L,y0-10); c.lineTo(P.x+P.w+10,y0-10); c.lineTo(P.x+P.w+10,y0+L); c.stroke();
  c.beginPath(); c.moveTo(P.x-10,y1-L); c.lineTo(P.x-10,y1+10); c.lineTo(P.x+L,y1+10); c.stroke();
  c.beginPath(); c.moveTo(P.x-10,y0+P.k+L); c.lineTo(P.x-10,y0+P.k-6); c.lineTo(P.x+P.k-6,y0-10); c.lineTo(P.x+P.k+L,y0-10); c.stroke();
  c.restore();
  if(ph<P.h*.98) return;
  c.save(); c.textBaseline='middle';
  // ON AIR + 카메라
  const on=Math.floor(t/450)%2===0;
  c.fillStyle=on?'#ff2e2e':'rgba(255,46,46,.3)'; c.beginPath(); c.arc(P.x+92,P.y+52,11,0,TAU); c.fill();
  c.font='800 26px '+FM; c.fillStyle=CR; c.fillText('ON AIR',P.x+112,P.y+53);
  c.fillStyle=MINT; c.font='700 20px '+FM; c.fillText('STAGE CAM 01 · 룰렛 무대',P.x+92,P.y+86);
  if(t>=TL.RES&&Math.floor(t/380)%2===0){c.fillStyle=OR;c.font='800 24px '+FM;c.fillText('▶ SLOW ×0.25',P.x+92,P.y+118);}
  // 단계 칩
  const idx=phaseIdx(t), pw=150, gap=10, total=5*pw+4*gap, sx=960-total/2;
  for(let i=0;i<5;i++){
    const x=sx+i*(pw+gap), y=P.y+34, act=i===idx, done=i<idx;
    c.fillStyle=act?OR:done?'rgba(245,243,239,.85)':'rgba(10,18,28,.55)'; c.fillRect(x,y,pw,40);
    if(!act&&!done){c.strokeStyle='rgba(245,243,239,.45)';c.lineWidth=2;c.strokeRect(x+1,y+1,pw-2,38);}
    if(act){c.fillStyle='rgba(23,36,55,.35)';c.fillRect(x,y+34,pw*seg(t,phStart(i),phEnd(i)),6);}
    c.fillStyle=act?CR:done?NAVY:'rgba(245,243,239,.7)'; c.font='700 22px '+FK; c.textAlign='center';
    c.fillText(PH[i].n+' '+PH[i].ko,x+pw/2,y+21);
  }
  c.textAlign='left';
  // 조명 콘솔 (중계 장치)
  const sp=spots(t), bx=P.x+P.w-360, by=P.y+30;
  c.fillStyle='rgba(6,10,18,.72)'; c.fillRect(bx,by,316,128); c.strokeStyle='rgba(245,243,239,.35)'; c.lineWidth=2; c.strokeRect(bx,by,316,128);
  c.fillStyle=CR; c.font='800 18px '+FM; c.fillText('LX CUE '+PH[idx].n,bx+14,by+20);
  c.fillStyle=OR; c.font='700 18px '+FK; c.fillText(PH[idx].cue,bx+150,by+21);
  sp.forEach((s,i)=>{ const x=bx+22+i*74, h=70, v=cl(s.a/1.15);
    c.fillStyle='rgba(245,243,239,.12)'; c.fillRect(x,by+40,26,h);
    c.fillStyle='rgba('+s.col+',.95)'; c.fillRect(x,by+40+h*(1-v),26,h*v);
    c.fillStyle='rgba(245,243,239,.7)'; c.font='700 14px '+FM; c.fillText('SP'+'ABCD'[i],x+30,by+100);
    c.fillText(String(Math.round(v*100)).padStart(3,' '),x+30,by+80); });
  c.restore();
}

/* ---------- typography ---------- */
function outlinedText(c,txt,x,y,fill,stroke,sw,outer,ow){
  c.lineJoin='round';
  if(outer){c.strokeStyle=outer;c.lineWidth=ow;c.strokeText(txt,x,y);}
  c.strokeStyle=stroke; c.lineWidth=sw; c.strokeText(txt,x,y);
  c.fillStyle=fill; c.fillText(txt,x,y);
}
function chapter(c,t,i){
  const ph=PH[i]; if(!ph.sub) return;
  const s=phStart(i), e=phEnd(i);
  const inn=eo(seg(t,s+(i===0?120:0),s+(i===0?420:300))), out=seg(t,e-60,e);
  if(inn<=0||out>=1) return;
  const x=P.x-30, y=P.y+P.h-250;
  c.save(); c.textBaseline='middle';
  c.font='108px '+FT; const tw=c.measureText(ph.ko).width;
  const bw=(tw+90)*inn*(1-ei(out)), nd=(1-eback(cl(inn)))*-140;
  c.fillStyle=OR; c.fillRect(x,y+nd,156,156);
  c.fillStyle=NAVY; c.font='96px '+FT; c.fillText(ph.n,x+18,y+84+nd);
  c.save(); c.beginPath(); c.rect(x+156,y,bw,156); c.clip();
  c.fillStyle=i===2?'#2a0f0a':NAVY; c.fillRect(x+156,y,tw+90,156);
  const jx=i===2?(rnd(Math.floor(t/30))-.5)*8:0;
  c.font='108px '+FT; c.fillStyle=CR; c.fillText(ph.ko,x+200+jx,y+84);
  c.restore();
  c.globalAlpha=inn*(1-out);
  c.fillStyle=CR; c.font='800 22px '+FM; c.fillText('CH.'+ph.n+' / '+ph.en,x+4,y-22);
  c.font='700 38px '+FK; c.lineWidth=8; c.strokeStyle='rgba(4,10,18,.85)'; c.lineJoin='round';
  c.strokeText(ph.sub,x+20,y+196); c.fillStyle=CR; c.fillText(ph.sub,x+20,y+196);
  c.restore();
}
// 긴장: 지금 핀 아래 있는 칸 이름이 오른쪽에서 떨며 바뀐다 (될까 말까)
function tensionText(c,t){
  const {TEN,S}=TL; if(t<TEN||t>=S) return;
  const inn=eback(seg(t,TEN,TEN+260)), pop=Math.exp(-(t-kickT)/110);
  let txt;
  if(RD.mode==='text'){ txt=String(RD.list[Math.round(slotPos(t))]||'')+'?'; }
  else { const it=RD.items[segUnderPin(wheelAngle(t))]; txt=(it?it.name:'')+'?'; }
  const k=Math.floor(t/24), j=4+pop*16;
  const tx0=RD.mode==='text'?1420:1560, ty0=RD.mode==='text'?790:640;
  c.save(); c.translate(tx0+(rnd(k)-.5)*j,ty0+(rnd(k+5)-.5)*j); c.rotate(-.07); c.scale(inn*(1+pop*.16),inn*(1+pop*.16));
  c.textAlign='center'; c.textBaseline='middle';
  fitFont(c,txt,128,380,FT);
  outlinedText(c,txt,0,0,OR,NAVY,20,CR,32);
  c.font='800 30px '+FM; c.fillStyle=CR; c.strokeStyle=NAVY; c.lineWidth=8;
  const lab=RD.mode==='text'?'SLOWING DOWN':'PIN ▸ NOW'; c.strokeText(lab,0,104); c.fillText(lab,0,104);
  c.restore();
}
// 공개: 당첨 이름 대형 슬램 (1.9→1, -6°→0) + 스타버스트
function impactText(c,t){
  const {S,RES}=TL; if(t<S||t>RES+160) return;
  const p=seg(t,S+10,S+190), s=lerp(1.9,1,eback(p))*(1+seg(t,S+190,RES)*.05), a=Math.min(1,p*4)*(1-seg(t,RES+20,RES+160));
  const rot=lerp(-.105,0,eback(p)), miss=isMiss(), jp=isJackpot();
  const tag=miss?'꽝!':(jp?'JACKPOT!':'당첨!'), name=String(RD.winner||'');
  c.save(); c.globalAlpha=a; c.translate(960,RD.mode==='text'?835:800); c.rotate(rot);
  c.save(); c.rotate(t*.0012); c.scale(s*.9,s*.62);
  c.fillStyle=miss?'#c9d3df':CR; c.beginPath();
  for(let i=0;i<40;i++){const r=i%2?300:430+rnd(i)*80,an=i/40*TAU;i?c.lineTo(Math.cos(an)*r,Math.sin(an)*r):c.moveTo(Math.cos(an)*r,Math.sin(an)*r);}
  c.closePath(); c.fill(); c.strokeStyle=NAVY; c.lineWidth=9; c.stroke();
  c.restore();
  c.scale(s,s); c.textAlign='center'; c.textBaseline='middle';
  fitFont(c,name,190,1100,FT);
  c.fillStyle=miss?'#5c6b80':(jp?GOLD:OR); c.fillText(name,10,14);
  outlinedText(c,name,0,0,miss?'#e6ebf1':CR,NAVY,22,null,0);
  c.font='64px '+FT; const tw=c.measureText(tag).width;
  c.save(); c.translate(0,-140); c.rotate(-.06);
  c.fillStyle=miss?'#5c6b80':OR; c.fillRect(-tw/2-28,-44,tw+56,86); c.strokeStyle=NAVY; c.lineWidth=7; c.strokeRect(-tw/2-28,-44,tw+56,86);
  c.fillStyle=CR; c.fillText(tag,0,2); c.restore();
  c.restore();
}
function balloon(c,x,y,r){
  c.save(); c.translate(x,y);
  c.fillStyle=CR; c.beginPath(); c.arc(0,0,r,0,TAU); c.fill();
  c.fillStyle=OR; c.beginPath();
  for(let i=0;i<10;i++){const rr2=i%2?r*.38:r*.78,a=-Math.PI/2+i*Math.PI/5;i?c.lineTo(Math.cos(a)*rr2,Math.sin(a)*rr2):c.moveTo(Math.cos(a)*rr2,Math.sin(a)*rr2);}
  c.closePath(); c.fill(); c.restore();
}
const CARD={x:1130,y:212,w:690,h:640};
function resultCard(c,t){
  const R0=TL.RES; if(t<R0+40) return;
  const {x:x0,y:y0,w,h}=CARD, miss=isMiss(), jp=isJackpot();
  const stampCol=miss?'#7d8a9c':(jp?OR:MINT);
  const inP=seg(t,R0+40,R0+460), ox=(1-eback(inP))*900;
  c.save(); c.translate(ox,0);
  if(inP<1){c.fillStyle='rgba(245,243,239,'+(.6*(1-inP)).toFixed(3)+')';for(let i=0;i<8;i++)c.fillRect(x0+w+20+rnd(i)*200,y0+40+i*75,300+rnd(i+3)*300,6);}
  c.transform(1,0,-.14,1,0,0); c.translate(y0*.14+60,0);   // skewX(−8°)
  c.fillStyle='rgba(0,0,0,.45)'; c.fillRect(x0+18,y0+22,w,h);
  c.fillStyle=CR; c.fillRect(x0,y0,w,h);
  c.fillStyle=OR; c.fillRect(x0,y0,18,h);
  c.fillStyle=NAVY; c.fillRect(x0+18,y0,w-18,96);
  c.textBaseline='middle';
  c.fillStyle=jp?GOLD:OR; c.font='68px '+FT; c.fillText(jp?'JACKPOT!':'결과!',x0+50,y0+52);
  c.fillStyle='rgba(245,243,239,.75)'; c.font='700 22px '+FM; c.fillText('ROULETTE · '+RD.items.length+'칸',x0+(jp?370:250),y0+52);
  // 이름 슬램
  const np=seg(t,R0+380,R0+620), ns=lerp(1.9,1,eback(np));
  if(np>0){
    c.save(); c.globalAlpha=Math.min(1,np*3); c.translate(x0+50,y0+222); c.scale(ns,ns);
    c.font='150px '+FT; {const mw=c.measureText(RD.winner).width, fit=Math.min(1,(w-280)/Math.max(1,mw)); c.scale(fit,fit);}
    c.fillStyle=stampCol; c.fillText(RD.winner,8,10); c.fillStyle=NAVY; c.fillText(RD.winner,0,0); c.restore();
  }
  // 확률 줄
  const sp=seg(t,R0+620,R0+820);
  c.globalAlpha=sp; c.fillStyle=NAVY; c.font='800 30px '+FK;
  c.fillText('당첨 확률 '+RD.pct+'% · '+RD.items.length+'칸 중 '+(RD.winIdx+1)+'번',x0+56,y0+336);
  c.globalAlpha=1;
  c.strokeStyle='rgba(23,36,55,.25)'; c.lineWidth=3; c.setLineDash([10,10]);
  c.beginPath(); c.moveTo(x0+50,y0+386); c.lineTo(x0+w-40,y0+386); c.stroke(); c.setLineDash([]);
  // 닉네임
  const cp=eo(seg(t,R0+760,R0+1060));
  if(cp>0){
    c.save(); c.globalAlpha=cp; c.translate((1-cp)*80,0);
    c.fillStyle='rgba(23,36,55,.6)'; c.font='700 28px '+FK; c.fillText('뽑은 사람',x0+56,y0+424);
    const nick=DATA.nick||(DATA.hasResult?'스트리머':'…');
    c.fillStyle=NAVY; c.font='900 84px '+FK; {const mw=c.measureText(nick).width; if(mw>w-110){c.font='900 '+Math.max(40,Math.floor(84*(w-110)/mw))+'px '+FK;}} c.fillText(nick,x0+52,y0+486);
    c.restore();
  }
  // 별풍선
  const gp=seg(t,R0+940,R0+1200), gs=lerp(.4,1,eback(gp));
  if(gp>0&&DATA.gift){
    c.save(); c.translate(x0+56,y0+578); c.scale(gs,gs); c.globalAlpha=Math.min(1,gp*2);
    c.fillStyle=OR; rr(c,0,-40,420,80,40); c.fill();
    balloon(c,42,0,28);
    c.fillStyle=CR; c.font='900 44px '+FK; c.fillText(DATA.gift,86,2);
    c.restore();
  }
  // 판정 도장
  const bp=seg(t,R0+560,R0+800);
  if(bp>0){
    const bs=lerp(3,1,eback(bp)), lab=miss?'꽝':(jp?'잭팟':'당첨'), en=miss?'MISS':(jp?'JACKPOT':'WIN');
    c.save(); c.translate(x0+w-70,y0+40); c.rotate(-.2); c.scale(bs,bs); c.globalAlpha=Math.min(1,bp*2.5);
    if(bp<1){c.strokeStyle=stampCol;c.lineWidth=6;for(let i=0;i<12;i++){const a=i/12*TAU;c.beginPath();c.moveTo(Math.cos(a)*125,Math.sin(a)*125);c.lineTo(Math.cos(a)*(145+bp*60),Math.sin(a)*(145+bp*60));c.stroke();}}
    c.fillStyle=NAVY; c.beginPath(); c.arc(6,8,106,0,TAU); c.fill();
    c.fillStyle=stampCol; c.beginPath(); c.arc(0,0,106,0,TAU); c.fill();
    c.strokeStyle=CR; c.lineWidth=5; c.beginPath(); c.arc(0,0,90,0,TAU); c.stroke();
    c.textAlign='center'; c.fillStyle=CR; c.font='80px '+FT; c.fillText(lab,0,-6);
    c.font='800 20px '+FM; c.fillText(en,0,54);
    c.restore();
  }
  c.restore();
}
function bgWord(c,t){
  if(t<TL.RES) return;
  const a=eo(seg(t,TL.RES+150,TL.RES+700)), wd=isMiss()?'MISS MISS MISS':(isJackpot()?'JACKPOT JACKPOT':'WINNER WINNER');
  c.save(); c.globalAlpha=.16*a; c.font='300px '+FT; c.textBaseline='middle';
  c.strokeStyle=CR; c.lineWidth=3; c.strokeText(wd,120-(t-TL.RES)*.05,300); c.restore();
}

/* ---------- render ---------- */
function render(t){
  X.setTransform(1,0,0,1,0,0); X.clearRect(0,0,W,H);
  if(!RD) return;
  const fade=fadeAt?1-cl((performance.now()-fadeAt)/400):1;
  if(fade<=0) return;
  X.save(); X.globalAlpha=fade;
  const tw=(t>=TL.S&&t<TL.HIT)?TL.S:t;              // 히트스톱: 80ms 동안 세계 정지
  const cam=camAt(t);
  const rv=eo(seg(t,0,300)), ph=Math.max(4,P.h*rv), py=P.y+(P.h-ph)/2;
  X.save(); X.shadowColor='rgba(0,0,0,.55)'; X.shadowBlur=50; X.shadowOffsetY=14;
  panelPath(X,P.x,py,P.w,ph,P.k); X.fillStyle='#050a12'; X.fill(); X.restore();
  X.save(); panelPath(X,P.x,py,P.w,ph,P.k); X.clip();
  drawWorld(X,tw,cam);
  bgWord(X,t);
  crowd(X,tw,cam);
  screenFX(X,t,cam);
  X.restore();
  hud(X,t,cam,py,ph);
  if(rv>=1){
    chapter(X,t,phaseIdx(t));
    tensionText(X,t);
    impactText(X,t);
    resultCard(X,t);
  }
  X.restore();
}

/* ---------- sound cues (FX 모듈, 새 박자에 맞춤) ---------- */
function cue(t){
  if(!window.FX||!RD) return;
  const at=(k,ms,fn,cond)=>{ if(t>=ms&&!cues[k]&&(cond===undefined||cond)){ cues[k]=1; fn(); } };
  const jp=isJackpot(), miss=isMiss();
  at('open',0,()=>{ FX.sound('whoosh'); if(RD.mode!=='text') FX.spinStart(); });
  at('lamps',Math.min(TL.OB,330),()=>FX.sound('pop'));
  at('ten',TL.TEN,()=>FX.drumStart(150));
  at('imp',TL.S,()=>{ FX.drumStop(); FX.spinStop(); FX.sound('stop'); FX.flash('rgba(255,255,255,.34)'); });
  at('res',TL.RES+40,()=>FX.sound('reveal'));
  at('name',TL.RES+400,()=>{ FX.sound(jp?'jackpot':miss?'lose':'win');
    if(jp){ FX.confetti({x:620,y:420,count:220,colors:['#FFC928','#FF5B17','#fff','#FFE49A']}); FX.flash('rgba(255,201,40,.3)'); }
    else if(!miss) FX.confetti({x:620,y:420,count:90}); });
  at('stamp',TL.RES+560,()=>FX.sound('stop'));
  at('banner',TL.RES+1300,()=>{
    const r={left:CARD.x,right:CARD.x+CARD.w,top:CARD.y,bottom:CARD.y+CARD.h,width:CARD.w,height:CARD.h};
    const anchor={getBoundingClientRect:()=>r}, by=DATA.by;
    if(by&&by!=='스트리머'&&by!=='weflab') FX.winner({nick:by,balloons:DATA.balloon,sub:'룰렛 당첨',anchor,ms:6000,icon:jp?'🎉':'🏆'});
    else FX.winner({text:RD.winner,sub:'룰렛 결과',anchor,ms:6000,icon:'🎡'});
  },DATA.hasResult);
}

/* ---------- loop ---------- */
let lastSeg=-1, lastTickAt=0;
function loop(now){
  if(RD){
    const t=now-RD.start;
    if(t<TL.S){                                         // 칸 통과 → 틱 + 핀 튕김
      const sg=RD.mode==='text'?Math.round(slotPos(t)):segUnderPin(wheelAngle(t));
      if(sg!==lastSeg){ if(lastSeg!==-1){ kickT=t; kickN++; if(now-lastTickAt>=40){ lastTickAt=now; if(window.FX) FX.sound('tick'); } } lastSeg=sg; }
    }
    cue(t); render(t);
    if(fadeAt&&now-fadeAt>420){ RD=null; fadeAt=0; X.setTransform(1,0,0,1,0,0); X.clearRect(0,0,W,H); }
  }
  requestAnimationFrame(loop);
}

/* ---------- public ---------- */
// data: RouletteSpinState { winner, winnerIdx, items, spinMs, animType }
window.startRoulette=data=>{
  const items=(data.items||[]).filter(i=>i&&i.name!=null).map(i=>({name:String(i.name),probability:Number(i.probability)||0}));
  if(!items.length) return;
  if(window.FX){ FX.hideWinner(); FX.spinStop(); FX.drumStop(); }
  const S=Math.max(400,Number(data.spinMs)||3000);
  const OB=Math.min(700,S*.3), TEN=Math.max(OB,S-cl(S*.32,500,1500));
  TL={OB,TEN,S,HIT:S+80,RES:S+700};
  const mode=data.animType==='text'?'text':'wheel';
  let winIdx=Number(data.winnerIdx); if(!(winIdx>=0&&winIdx<items.length)){ winIdx=items.findIndex(i=>i.name===data.winner); if(winIdx<0) winIdx=0; }
  const winner=String(data.winner!=null?data.winner:items[winIdx].name);
  const wedges=buildFace(items);
  const w=wedges[winIdx], jitter=(Math.random()-.5)*.56*w.sw;
  const winMid=-Math.PI/2+w.st+w.sw/2+jitter;
  const finalAngle=-Math.PI-winMid+6*TAU;
  const names=items.map(i=>i.name), list=[winner];
  for(let r=0;r<5;r++) list.push(...[...names].sort(()=>Math.random()-.5));
  const total=items.reduce((s,i)=>s+i.probability,0)||1;
  RD={mode,items,winIdx,winner,wedges,finalAngle,list,start:performance.now(),pct:(items[winIdx].probability/total*100).toFixed(1).replace(/[.]0$/,'')};
  DATA={nick:'',gift:'',hasResult:false,balloon:0,by:''};
  cues={}; fadeAt=0; lastSeg=-1; kickT=-1e9;
};
// result: GameResult { triggeredBy, balloon, result }
window.setRouletteResult=res=>{
  if(!RD) return;
  const by=res.triggeredBy||'';
  DATA={by,nick:by&&by!=='weflab'?by:'스트리머',balloon:Number(res.balloon)||0,gift:Number(res.balloon)>0?'별풍선 '+Number(res.balloon).toLocaleString()+'개':'',hasResult:true};
};
window.hideRoulette=()=>{
  if(window.FX){ FX.hideWinner(); FX.spinStop(); FX.drumStop(); }
  if(RD&&!fadeAt) fadeAt=performance.now();
};
if(document.fonts&&document.fonts.load){
  Promise.all([document.fonts.load('100px '+FT),document.fonts.load('900 40px '+FK),document.fonts.load('700 40px '+FK),document.fonts.load('800 20px '+FM)]).catch(()=>{});
}
requestAnimationFrame(loop);
})();
<\/script>
<script>
let hideTimer = null

function startSpin(data) {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  window.startRoulette(data)
}
function showResult(result) {
  // 숨김 타이머는 결과 도착 기준 7초 유지 (엔진 idle 이 먼저 오면 그때 숨김)
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => { hideTimer = null; window.hideRoulette() }, 7000)
  window.setRouletteResult(result)
}
function hide() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  window.hideRoulette()
}

function connect() {
  const ws = new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage = e => {
    try {
      const msg = JSON.parse(e.data)
      FX.handle(msg)   // overlay:config → 효과음 on/off·볼륨 즉시 반영
      if (msg.type === 'game:state' && msg.data?.id === 'roulette') {
        const s = msg.data
        if (s.status === 'running' && s.roulette) startSpin(s.roulette)
        else if (s.status === 'idle') hide()
      }
      if (msg.type === 'game:result' && msg.data?.gameId === 'roulette') showResult(msg.data)
      if (msg.type === 'ping') ws.send(JSON.stringify({type:'pong'}))
    } catch {}
  }
  ws.onopen  = () => { if (window.__wsDown) location.reload() }  // 서버 재시작(앱 업데이트) → 새 코드 로드
  ws.onclose = () => { window.__wsDown = true; setTimeout(connect, 2000) }
}
connect()
<\/script>
</body>
</html>`

// ── Pickboard overlay (ticket board) ─────────────────────────────────────────
