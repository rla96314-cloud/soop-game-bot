// OBS 오버레이 페이지: roulette — '무대 조명 중계' 연출 (캔버스 1장에 타임라인 렌더, fish.ts 와 같은 카메라 리그 문법)
// 다섯 박자: 등장(조명 하나씩 켜짐·전구 점등·카메라 스윙) → 진행(와인드업 후 발사·잔상 블러·마퀴 전구 추격)
//           → 긴장(긴 감속·핀 주변만 남기고 암전·조명 수렴·심장박동·마지막 칸에서 '넘어갈까 말까' 걸림)
//           → 공개(80ms 히트스톱·플래시·펀치 줌·흔들림·당첨 칸 들림·타이포 슬램) → 여운(슬로모 조명·회전 후광·사선 결과 카드)
// 엔진 state.roulette(RouletteSpinState: winner, winnerIdx, items, spinMs, animType) 로 1회 재생.
//  - 공개 = spinMs (엔진 game:result 시점과 같음). 닉네임·별풍선은 game:result 가 오면 카드에 채운다.
//  - 휠(wheel)·텍스트 슬롯(text) 두 모드 모두 같은 무대·HUD·카드를 쓴다. 레이아웃은 고정 좌표(측정 없음).
//  - 휠: 살짝 기울어진(원근) 두께 있는 원판 + 금속 플래퍼가 칸 경계 못(peg)에 걸려 휘었다 튕긴다.
//  - window.__rouletteSeek = ms 를 넣으면 그 시점 화면으로 고정된다 (캡처·점검용, null 이면 실시간).
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
// 휠 칸 색 (브랜드 팔레트 순환) / 글자 색 / 글자 그림자 색
const SEGC=['#FF5B17','#F5F3EF','#1F3354','#FFC928','#00CB84','#2B4C7E'];
const SEGT=['#FFFFFF','#172437','#F5F3EF','#172437','#0E2A22','#F5F3EF'];
const SEGD=['rgba(120,30,0,.55)','rgba(23,36,55,.18)','rgba(0,0,0,.55)','rgba(140,90,0,.35)','rgba(0,70,45,.35)','rgba(0,0,0,.5)'];
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
const wrapPI=a=>((a+Math.PI)%TAU+TAU)%TAU-Math.PI;

/* ---------- geometry (world units, 휠 중심 = 0,0) ---------- */
// 원판은 세로로 SQ 만큼 눌러 그려 앞으로 기운 느낌(원근)을 주고, 아래로 TH 만큼 두께(옆면)를 붙인다.
const R_OUT=410, R_RIM=398, R_RIN=336, R_SEG=326, R_BULB=367, BULB_R=11, N_BULB=36, R_HUB=84, R_PEG=R_SEG-12;
const SQ=.9, TH=34;
const FLOOR=Math.round(R_OUT*SQ)+TH+64;            // 무대 바닥선
const PIV_Y=-R_OUT*SQ-26, TIP_Y=-R_PEG*SQ+6;        // 플래퍼 축 / 끝 (끝이 칸 경계 못에 닿는다)
const CAP={y:40,w:1240,h:360,iw:1100,ih:236};       // 텍스트 슬롯 캡슐
const IH=CAP.ih;                                    // 슬롯 한 칸 높이
const LAMPS=[-980,-360,360,980], LY=-1060;          // 트러스 조명 위치

/* ---------- round state ---------- */
let RD=null;           // 진행 중인 판
let TL={OB:700,TEN:2000,S:3000,HIT:3080,RES:3700};
let DATA={nick:'',gift:'',hasResult:false,balloon:0,by:''};
let fadeAt=0, cues={};
let hideTimer=null;

function isJackpot(){return RD&&JACKPOT_RE.test(String(RD.winner||''));}
function isMiss(){return RD&&String(RD.winner||'').trim().indexOf('꽝')===0;}

/* ---------- wheel face (회전하는 판: 한 번만 그려 두고 돌린다) + 회전 블러 판 ---------- */
const FACE_S=1.6, FR=R_SEG+2;
const face=document.createElement('canvas'); face.width=face.height=Math.ceil(FR*2*FACE_S);
const blurFace=document.createElement('canvas'); blurFace.width=blurFace.height=face.width;
function estW(str){let w=0;for(const ch of str)w+=ch===' '?0.3:/[ㄱ-힝]/.test(ch)?1.0:0.58;return w;}
function segColor(i,n){return (n>1&&i===n-1&&(n-1)%SEGC.length===0)?2:i%SEGC.length;}
function buildFace(items){
  const f=face.getContext('2d'); f.setTransform(1,0,0,1,0,0); f.clearRect(0,0,face.width,face.height);
  f.setTransform(FACE_S,0,0,FACE_S,FR*FACE_S,FR*FACE_S);
  const total=items.reduce((s,i)=>s+i.probability,0)||1, n=items.length;
  let st=0; const L=[];
  items.forEach((it,i)=>{const sw=(it.probability/total)*TAU, ci=segColor(i,n);
    f.beginPath(); f.moveTo(0,0); f.arc(0,0,R_SEG,st,st+sw); f.closePath(); f.fillStyle=SEGC[ci]; f.fill();
    L.push({it,i,st,sw,ci}); st+=sw;});
  // 접시 모양 음영 (가운데 깊고, 가장자리 살짝 밝다가 테두리에서 다시 어둡게)
  let g=f.createRadialGradient(0,0,R_HUB*.8,0,0,R_SEG);
  g.addColorStop(0,'rgba(0,0,0,.30)'); g.addColorStop(.42,'rgba(0,0,0,.06)'); g.addColorStop(.86,'rgba(255,255,255,.10)'); g.addColorStop(1,'rgba(0,0,0,.30)');
  f.fillStyle=g; f.beginPath(); f.arc(0,0,R_SEG,0,TAU); f.fill();
  // 칸마다 바깥 가장자리 하이라이트
  L.forEach(l=>{ f.beginPath(); f.arc(0,0,R_SEG-7,l.st+.012,l.st+l.sw-.012); f.strokeStyle='rgba(255,255,255,.30)'; f.lineWidth=3; f.stroke(); });
  // 칸 구분선 (볼록한 띠: 그림자 + 크림 + 하이라이트)
  if(n>1) L.forEach(l=>{ f.save(); f.rotate(l.st);
    const x0=R_HUB*.55, len=R_SEG-x0;
    f.fillStyle='rgba(4,10,20,.5)'; f.fillRect(x0,1.5,len,6);
    f.fillStyle=CR; f.fillRect(x0,-3.5,len,7);
    f.fillStyle='rgba(255,255,255,.95)'; f.fillRect(x0,-3.5,len,2);
    f.restore(); });
  // 글자
  L.forEach(({it,st,sw,ci})=>{
    const mid=st+sw/2, label=it.name.length>8?it.name.slice(0,7)+'…':it.name;
    const arcLen=sw*R_SEG*.64, ew=estW(label), fsT=Math.floor((arcLen-18)/(ew+.15));
    f.save(); f.textAlign='center'; f.textBaseline='middle';
    let fs;
    if(fsT>=26||sw>1.2){
      fs=Math.min(64,Math.max(22,fsT)); const rr=R_SEG*.64;
      f.translate(Math.cos(mid)*rr,Math.sin(mid)*rr); f.rotate(mid+Math.PI/2);
    } else {
      const avail=R_SEG-R_HUB-40; fs=Math.min(46,Math.max(16,Math.floor(avail/(ew+.25)))); const rr=R_HUB+18+avail/2;
      f.translate(Math.cos(mid)*rr,Math.sin(mid)*rr); f.rotate(mid);
    }
    f.font=fs+'px '+FT;
    f.fillStyle=SEGD[ci]; f.fillText(label,2,4);
    f.fillStyle=SEGT[ci]; f.fillText(label,0,0);
    f.restore();
  });
  // 칸 경계 못 (플래퍼가 걸리는 금속 스터드)
  if(n>1) L.forEach(l=>{ const x=Math.cos(l.st)*R_PEG, y=Math.sin(l.st)*R_PEG;
    f.beginPath(); f.arc(x+2,y+3,10,0,TAU); f.fillStyle='rgba(0,0,0,.45)'; f.fill();
    const pg=f.createRadialGradient(x-3,y-3,1,x,y,10); pg.addColorStop(0,'#ffffff'); pg.addColorStop(.5,'#c3ccd8'); pg.addColorStop(1,'#4a5566');
    f.beginPath(); f.arc(x,y,9.5,0,TAU); f.fillStyle=pg; f.fill(); f.lineWidth=2; f.strokeStyle=NAVY; f.stroke(); });
  // 회전 블러 판: 판을 48번 돌려 평균 (빠를 때 섞어 쓴다)
  const b=blurFace.getContext('2d'); b.setTransform(1,0,0,1,0,0); b.clearRect(0,0,blurFace.width,blurFace.height);
  const cx=blurFace.width/2;
  for(let k=0;k<48;k++){ b.save(); b.globalAlpha=1/(k+1); b.translate(cx,cx); b.rotate(k/48*TAU); b.drawImage(face,-cx,-cx); b.restore(); }
  return L;
}
function segUnderPin(ang){
  if(!RD) return 0;
  let rel=((-Math.PI/2-ang)%TAU+TAU)%TAU;
  for(let i=0;i<RD.wedges.length;i++){const w=RD.wedges[i]; if(rel<w.st+w.sw) return i;}
  return RD.wedges.length-1;
}

/* ---------- motion model ---------- */
// 휠: 와인드업(살짝 뒤로) → 발사 → 긴 감속 → [걸림: 플래퍼가 못에 눌려 버팀] → [낙하: 넘어가거나(over) 되돌아와(back) 당첨 칸에 안착]
//     → 히트스톱 뒤 잔진동. 칸이 1개거나 회전이 짧으면 걸림 없이 감속만(none).
function wheelAngle(t){
  const M=RD.mot;
  if(M.W0&&t<M.W0) return -.22*Math.sin(t/M.W0*Math.PI/2);
  const a0=M.W0?-.22:0;
  if(t>=TL.S) return t<TL.HIT?M.angF:M.angF+M.setA*Math.sin((t-TL.HIT)/42)*Math.exp(-(t-TL.HIT)/170);
  if(M.near==='none') return lerp(a0,M.angF,1-Math.pow(1-seg(t,M.W0,TL.S),3.2));
  if(t<M.T1) return lerp(a0,M.angH,1-Math.pow(1-seg(t,M.W0,M.T1),2.6));
  if(t<M.T2){ const p=seg(t,M.T1,M.T2); return M.angH+.3*M.cc*eio(p)+.07*M.cc*Math.sin(p*Math.PI*5)*Math.sin(p*Math.PI); }
  return lerp(M.angC,M.angF,eo(seg(t,M.T2,TL.S)));
}
function wheelVel(t){return (wheelAngle(t+5)-wheelAngle(Math.max(0,t-5)))/(t>=5?10:t+5);}   // rad/ms
// 텍스트 슬롯: 칸 단위 위치 (0 = 당첨 칸). 마지막에 앞 칸이 반쯤 걸렸다가 떨어진다.
function slotPos(t){
  const M=RD.mot, N=RD.list.length-1;
  if(t>=TL.S) return t<TL.HIT?0:.05*Math.sin((t-TL.HIT)/40)*Math.exp(-(t-TL.HIT)/150);
  if(M.near==='none') return N*Math.pow(1-cl(t/TL.S),3.4);
  if(t<M.T1) return lerp(N,.62,1-Math.pow(1-seg(t,0,M.T1),2.6));
  if(t<M.T2){ const p=seg(t,M.T1,M.T2); return .62-.08*eio(p)+.025*Math.sin(p*Math.PI*5)*Math.sin(p*Math.PI); }
  return .54*(1-eback(seg(t,M.T2,TL.S)));
}
function slotVel(t){return (slotPos(t+5)-slotPos(Math.max(0,t-5)))/(t>=5?10:t+5);}            // 칸/ms (음수 = 아래로)
const amb=t=>t<TL.RES?t:TL.RES+(t-TL.RES)*.25;                                 // 여운은 슬로모 ×0.25
// 심장박동 (긴장 구간): 걸림 구간에서 더 빨라진다. 0..1 펄스
function hb(t){
  const {TEN,S}=TL, M=RD.mot; if(t<TEN||t>=S) return 0;
  const fast=M.near!=='none'&&t>=M.T1, iv=fast?300:455, d=(t-(fast?M.T1:TEN))%iv;
  return Math.exp(-d/95)+.55*Math.exp(-Math.max(0,d-150)/80)*(d>150?1:0);
}
// 플래퍼 각도: 못이 다가오면 끝이 밀려 휘고, 못이 지나가면 스프링처럼 튕겨 돌아온다 (+ = 시계방향 회전)
function flapRot(t){
  if(!RD||RD.wedges.length<2) return 0;
  const M=RD.mot, cc=M.cc, K=-.62;
  if(M.near==='over'&&t>=M.tc){ const d=t-M.tc; return K*Math.exp(-d/110)*Math.cos(d/19); }
  if(M.near==='back'&&t>=M.T2){ const d=t-M.T2; return K*.88*Math.exp(-d/120)*Math.cos(d/21); }
  if(t>=TL.S){ const d=Math.max(0,t-TL.HIT); return K*.4*Math.exp(-d/130)*Math.sin(d/20); }
  const ang=wheelAngle(t), vel=wheelVel(t), dir=(M.W0&&t<M.W0)?-1:1;   // 와인드업만 역방향
  let push=0, best=9;
  for(const w of RD.wedges){ const u=wrapPI(ang+w.st+Math.PI/2)*dir;
    if(u>=-cc&&u<=0) push=Math.max(push,(u+cc)/cc); else if(u>0&&u<best) best=u; }
  let def=push;
  if(push<=0&&best<9){ const ts=best/Math.max(Math.abs(vel),1e-4); def=Math.exp(-ts/90)*Math.cos(ts/20); }
  return K*def*dir;
}
// 슬롯 페이라인 화살표 밀림 (0..1, 음수 = 반동)
function slotNudge(t){
  const M=RD.mot, cw=.16;
  if(t>=TL.S){ const d=Math.max(0,t-TL.HIT); return .35*Math.exp(-d/120)*Math.sin(d/22); }
  if(M.near!=='none'&&t>=M.tc){ const d=t-M.tc; return Math.exp(-d/100)*Math.cos(d/19); }
  const pos=slotPos(t), vel=slotVel(t), f=pos-Math.floor(pos);
  if(f>=.5&&f<=.5+cw) return (.5+cw-f)/cw;
  const past=f<.5?.5-f:1.5-f, ts=past/Math.max(Math.abs(vel),1e-5);
  return Math.exp(-ts/90)*Math.cos(ts/20);
}

/* ---------- camera rig ---------- */
let kickT=-1e9;   // 칸 통과 시각 (loop 에서 갱신)
function camAt(t){
  const tm=RD.mode==='text', {OB,TEN,S,HIT,RES}=TL, M=RD.mot;
  const yS=tm?20:-28, zT=tm?1.24:1.34, yT=tm?CAP.y+70:-232;
  let x=0,y=yS,z=1,r=0,sh=0;
  if(t<OB){
    const p=eback(seg(t,0,Math.min(OB,560)));
    z=lerp(.6,1,p); x=lerp(460,0,p); y=lerp(-260,yS,p); r=lerp(-.12,0,eo(seg(t,0,Math.min(OB,500))));
  } else if(t<TEN){
    const p=eio(seg(t,OB,TEN)), v=tm?cl(Math.abs(slotVel(t))*IH/2.2):cl(Math.abs(wheelVel(t))/.03);
    z=lerp(1,1.04,p); x=Math.sin(t*.0008)*10; y=yS+Math.sin(t*.0011)*5; sh=3.5*v;
  } else if(t<S){
    const p=seg(t,TEN,S), q=ei(p)*.5+eio(p)*.5, hang=M.near!=='none'?seg(t,M.T1,S):0;
    z=lerp(1.04,zT,q)+hang*.06+.014*hb(t); x=lerp(Math.sin(TEN*.0008)*10,0,p); y=lerp(yS,yT,eio(p));
    r=Math.sin(t*.0023)*.008*p;
    sh=1+p*3+6*Math.exp(-(t-kickT)/90)*p+hang*2;
  } else if(t<HIT){
    z=(zT+.06)*1.08; y=yT; sh=28;
  } else if(t<RES){
    const base=tm?1.0:1.1;
    z=lerp(base*1.18,base,eo(seg(t,HIT,HIT+220))); y=tm?CAP.y:-80;
    r=-.05*Math.exp(-(t-HIT)/260)*Math.cos((t-HIT)*.025);
    sh=16*(1-seg(t,HIT,HIT+380));
  } else {
    const q=eo(seg(t,RES,RES+900)), z0=tm?1.0:1.1, z1=tm?.72:.8;
    z=lerp(z0,z1,q)+seg(t,RES+900,RES+5000)*.03;
    x=lerp(0,520,q); y=lerp(tm?CAP.y:-80,tm?CAP.y+40:-30,q);
    r=lerp(.02,0,eo(seg(t,RES,RES+2200)));
    sh=8*Math.exp(-(t-RES)/200);
  }
  const k=Math.floor(t/16);
  return {x:x+(rnd(k)-.5)*2*sh/z, y:y+(rnd(k+977)-.5)*2*sh/z, z, r};
}
const toScreen=(cam,wx,wy)=>[960+(wx-cam.x)*cam.z,540+(wy-cam.y)*cam.z];
function focusY(){return RD.mode==='text'?CAP.y:TIP_Y+40;}

/* ---------- spotlights (중계 장치: 무대 조명) ---------- */
const SPOT_COL=['255,91,23','255,201,40','0,203,132','255,91,23'];
function spots(t){
  const {OB,TEN,S,RES}=TL, at=amb(t), mc=focusY(), miss=isMiss();
  const out=[];
  for(let i=0;i<4;i++){
    const onAt=40+i*95, on=t>=onAt?1:0, over=(t>=onAt&&t<onAt+70)?1.5:1;
    const sweep=Math.sin(at*.0011+i*1.9)*640;
    let tx, ty=FLOOR, w=380, a=.5*on*over, col='255,241,214';
    if(t<OB){ tx=lerp((i<2?1:-1)*720,sweep,eo(seg(t,onAt,OB))); }
    else if(t<TEN){ tx=sweep; }
    else if(t<S){
      const p=eio(seg(t,TEN,Math.min(S,TEN+900)));
      tx=lerp(sweep,(i-1.5)*22,p); ty=lerp(FLOOR,mc,p); w=lerp(380,120,p);
      const inner=i===1||i===2; a=inner?lerp(.5,RD.mode==='text'?.4:.62,p):lerp(.5,.3,p); if(!inner) col='255,91,23';
    } else if(t<RES){
      const p=seg(t,S,RES); tx=(i-1.5)*30; ty=mc; w=lerp(620,400,eo(p)); a=lerp(1.15,.62,p);
    } else {
      const p=eo(seg(t,RES,RES+700));
      tx=lerp((i-1.5)*30,Math.sin(at*.0014+i*2.2)*700,p); ty=lerp(mc,FLOOR,p); w=lerp(400,380,p);
      col=SPOT_COL[i]; a=lerp(.62,.5,p);
      if(miss){ col=i===1?'200,220,255':'120,140,170'; a=i===1?lerp(.62,.55,p):lerp(.62,.08,p); if(i===1){tx=lerp(tx,-40,p);ty=mc;w=260;} }
    }
    out.push({lx:LAMPS[i],tx,ty,w,a,col,on});
  }
  return out;
}
function drawCone(c,s){
  if(s.a<=0) return;
  const dx=s.tx-s.lx, dy=s.ty-LY, L=Math.hypot(dx,dy)||1, ux=dx/L, uy=dy/L, nx=-uy, ny=ux;
  const ext=(FLOOR+90-LY)/Math.max(.2,uy);       // 바닥까지 연장
  const fx=s.lx+ux*ext, fy=LY+uy*ext, w0=30, w1=s.w*ext/L*.62;
  const g=c.createLinearGradient(s.lx,LY,fx,fy);
  g.addColorStop(0,'rgba('+s.col+','+(.55*s.a).toFixed(3)+')');
  g.addColorStop(.7,'rgba('+s.col+','+(.22*s.a).toFixed(3)+')');
  g.addColorStop(1,'rgba('+s.col+',0)');
  c.fillStyle=g; c.beginPath();
  c.moveTo(s.lx+nx*w0,LY+ny*w0); c.lineTo(fx+nx*w1,fy+ny*w1); c.lineTo(fx-nx*w1,fy-ny*w1); c.lineTo(s.lx-nx*w0,LY-ny*w0); c.closePath(); c.fill();
}
function floorX(s,y){const uy=(s.ty-LY)||1;return s.lx+(s.tx-s.lx)*(y-LY)/uy;}

/* ---------- marquee bulbs ---------- */
// 추격 위상: 진행 중엔 빠르게, 긴장 구간 동안 점점 느려진다 (적분식이라 시점만으로 결정됨)
function chaseAt(t){
  const {TEN,S}=TL, r0=1/46, r1=1/520;
  if(t<TEN) return t*r0;
  const T=Math.max(1,S-TEN), u=Math.min(t,S)-TEN;
  return TEN*r0+r0*u-(r0-r1)*u*u/(2*T);
}
function bulbB(t,i,n){
  const {OB,TEN,S,RES}=TL, onAt=30+i*(Math.min(OB,620)*.75/n);
  if(t<onAt) return 0;
  if(t<onAt+90) return 1;
  if(t<S){
    const k=Math.floor(chaseAt(t)), m=((i-k)%6+6)%6;
    let b=m<=1?1:m===2?.75:m===5?.4:.14;
    if(t>=TEN) b*=.55+.45*Math.min(1,hb(t));
    return b;
  }
  if(t<RES) return Math.floor((t-S)/90)%2===0?1:.3;
  return (i+Math.floor(amb(t)/380))%2===0?1:.25;
}
function drawBulbs(c,pts,t,r,refl){
  const n=pts.length, B=pts.map((p,i)=>bulbB(t,i,n));
  pts.forEach(([x,y],i)=>{ const b=B[i];
    c.beginPath(); c.arc(x+1,y+2.5,r+3.5,0,TAU); c.fillStyle='rgba(8,14,26,.6)'; c.fill();
    let g=c.createRadialGradient(x-r*.3,y-r*.35,1,x,y,r); g.addColorStop(0,'#8c7a62'); g.addColorStop(1,'#3a2e22');
    c.beginPath(); c.arc(x,y,r,0,TAU); c.fillStyle=g; c.fill();
    if(b>.02){ c.globalAlpha=Math.min(1,b*1.15);
      g=c.createRadialGradient(x-r*.3,y-r*.35,1,x,y,r); g.addColorStop(0,'#FFFFFF'); g.addColorStop(.45,'#FFE68C'); g.addColorStop(1,'#FF9A1F');
      c.beginPath(); c.arc(x,y,r,0,TAU); c.fillStyle=g; c.fill(); c.globalAlpha=1; } });
  if(refl) return;
  c.save(); c.globalCompositeOperation='lighter';
  pts.forEach(([x,y],i)=>{ const b=B[i]; if(b<.2) return;
    const g=c.createRadialGradient(x,y,0,x,y,r*3.4); g.addColorStop(0,'rgba(255,214,110,'+(.55*b).toFixed(3)+')'); g.addColorStop(1,'rgba(255,140,30,0)');
    c.fillStyle=g; c.beginPath(); c.arc(x,y,r*3.4,0,TAU); c.fill(); });
  c.restore();
}

/* ---------- machine: wheel ---------- */
function starPath(c,x,y,ro,ri,n){c.beginPath();for(let i=0;i<n*2;i++){const a=-Math.PI/2+i*Math.PI/n,rr=i%2===0?ro:ri;c[i===0?'moveTo':'lineTo'](x+Math.cos(a)*rr,y+Math.sin(a)*rr);}c.closePath();}
function drawStand(c,top,half){
  const g=c.createLinearGradient(-half,0,half,0); g.addColorStop(0,'#0a1322'); g.addColorStop(.5,'#22324d'); g.addColorStop(1,'#0a1322');
  c.fillStyle=g; c.beginPath(); c.moveTo(-half*.42,top); c.lineTo(half*.42,top); c.lineTo(half,FLOOR); c.lineTo(-half,FLOOR); c.closePath(); c.fill();
  c.strokeStyle=NAVY; c.lineWidth=5; c.stroke();
  const g2=c.createLinearGradient(0,FLOOR-26,0,FLOOR); g2.addColorStop(0,'#FF8A4C'); g2.addColorStop(1,'#C23E08');
  c.fillStyle=g2; c.fillRect(-half-16,FLOOR-26,half*2+32,26); c.strokeRect(-half-16,FLOOR-26,half*2+32,26);
}
function wedgePath(c,a0,a1,r){c.beginPath();c.moveTo(0,0);c.arc(0,0,r,a0,a1);c.closePath();}
const BL=TIP_Y-PIV_Y;
function bladePath(c){c.beginPath();c.moveTo(-34,0);c.lineTo(34,0);c.lineTo(12,BL-14);c.lineTo(0,BL+4);c.lineTo(-12,BL-14);c.closePath();}
function drawPointer(c,t,refl){
  const rot=flapRot(t);
  c.save(); c.translate(0,PIV_Y);
  if(!refl){ c.save(); c.translate(12,16); c.rotate(rot); bladePath(c); c.fillStyle='rgba(0,0,0,.38)'; c.fill(); c.restore(); }
  c.save(); c.rotate(rot); bladePath(c);
  let g=c.createLinearGradient(-34,0,34,0); g.addColorStop(0,'#6f7b8d'); g.addColorStop(.32,'#ffffff'); g.addColorStop(.55,'#c6cfdb'); g.addColorStop(1,'#4c5767');
  c.fillStyle=g; c.fill(); c.lineWidth=4; c.strokeStyle=NAVY; c.lineJoin='round'; c.stroke();
  c.beginPath(); c.moveTo(-14,BL-52); c.lineTo(14,BL-52); c.lineTo(7,BL-14); c.lineTo(0,BL-2); c.lineTo(-7,BL-14); c.closePath(); c.fillStyle=OR; c.fill();
  c.beginPath(); c.moveTo(0,14); c.lineTo(0,BL-52); c.strokeStyle='rgba(255,255,255,.7)'; c.lineWidth=2; c.stroke();
  c.restore();
  // 축 하우징 (남색 브래킷 + 주황 띠 + 크롬 볼트)
  if(!refl){ c.fillStyle='rgba(0,0,0,.35)'; rr(c,-74,-48,156,70,20); c.fill(); }
  rr(c,-78,-56,156,70,20); g=c.createLinearGradient(0,-56,0,14); g.addColorStop(0,'#2d4266'); g.addColorStop(1,'#0d1729');
  c.fillStyle=g; c.fill(); c.lineWidth=5; c.strokeStyle=OR; c.stroke();
  c.fillStyle='rgba(255,255,255,.18)'; rr(c,-70,-50,140,14,8); c.fill();
  g=c.createRadialGradient(-6,-8,2,0,0,22); g.addColorStop(0,'#ffffff'); g.addColorStop(.5,'#b9c3d0'); g.addColorStop(1,'#465161');
  c.beginPath(); c.arc(0,-4,21,0,TAU); c.fillStyle=g; c.fill(); c.lineWidth=3; c.strokeStyle=NAVY; c.stroke();
  c.beginPath(); c.moveTo(-9,-4); c.lineTo(9,-4); c.moveTo(0,-13); c.lineTo(0,5); c.strokeStyle='rgba(23,36,55,.6)'; c.lineWidth=3; c.stroke();
  // 위쪽 주황 핀 머리 (멀리서도 읽히는 지시 표시)
  c.beginPath(); c.moveTo(-22,-56); c.lineTo(22,-56); c.lineTo(0,-30); c.closePath(); c.fillStyle=t>=TL.S?GOLD:OR; c.fill(); c.lineWidth=3; c.strokeStyle=NAVY; c.stroke();
  c.restore();
}
const BULB_PTS=[]; for(let i=0;i<N_BULB;i++){const a=i/N_BULB*TAU-Math.PI/2;BULB_PTS.push([Math.cos(a)*R_BULB,Math.sin(a)*R_BULB*SQ]);}
function drawWheel(c,t,refl){
  const {TEN,S,RES}=TL, ang=wheelAngle(t), vel=wheelVel(t);
  drawStand(c,R_OUT*SQ*.35,190);
  // 옆면 (두께)
  let g=c.createLinearGradient(-R_OUT,0,R_OUT,0); g.addColorStop(0,'#070d18'); g.addColorStop(.45,'#24365a'); g.addColorStop(1,'#070d18');
  c.fillStyle=g; c.beginPath(); c.ellipse(0,TH,R_OUT,R_OUT*SQ,0,0,Math.PI); c.lineTo(-R_OUT,0); c.ellipse(0,0,R_OUT,R_OUT*SQ,0,Math.PI,0,true); c.closePath(); c.fill();
  c.beginPath(); c.ellipse(0,TH*.55,R_OUT-1,R_OUT*SQ,0,.05,Math.PI-.05); c.strokeStyle='rgba(255,91,23,.85)'; c.lineWidth=5; c.stroke();
  c.beginPath(); c.ellipse(0,TH,R_OUT,R_OUT*SQ,0,0,Math.PI); c.strokeStyle=NAVY; c.lineWidth=4; c.stroke();
  c.save(); c.scale(1,SQ);
  // 남색 바깥 테 (위가 밝은 금속 베벨)
  g=c.createLinearGradient(0,-R_OUT,0,R_OUT); g.addColorStop(0,'#3a5177'); g.addColorStop(.5,'#15233a'); g.addColorStop(1,'#09111f');
  c.beginPath(); c.arc(0,0,R_OUT,0,TAU); c.fillStyle=g; c.fill();
  // 주황 림 (베벨: 위 밝고 아래 어둡게)
  g=c.createLinearGradient(0,-R_RIM,0,R_RIM); g.addColorStop(0,'#FFA26A'); g.addColorStop(.35,OR); g.addColorStop(1,'#B53A07');
  c.beginPath(); c.arc(0,0,R_RIM,0,TAU); c.arc(0,0,R_RIN,0,TAU,true); c.fillStyle=g; c.fill();
  c.beginPath(); c.arc(0,0,R_RIM-3,Math.PI*1.08,Math.PI*1.92); c.strokeStyle='rgba(255,255,255,.55)'; c.lineWidth=4; c.stroke();
  c.beginPath(); c.arc(0,0,R_RIN+3,Math.PI*.1,Math.PI*.9); c.strokeStyle='rgba(255,220,190,.35)'; c.lineWidth=3; c.stroke();
  c.beginPath(); c.arc(0,0,R_RIN,0,TAU); c.arc(0,0,R_SEG,0,TAU,true); c.fillStyle='#0b1424'; c.fill();
  // 판 (빠를수록 잔상 + 블러 판)
  const spd=Math.abs(vel)*16, blur=cl((spd-.12)/1.0);
  c.save(); c.beginPath(); c.arc(0,0,R_SEG,0,TAU); c.clip();
  c.save(); c.rotate(ang); c.drawImage(face,-FR,-FR,FR*2,FR*2); c.restore();
  if(spd>.03){ const k=Math.min(6,2+Math.floor(spd*4)); for(let j=1;j<=k;j++){ c.save(); c.globalAlpha=.32*(1-j/(k+1)); c.rotate(ang-vel*16*j/k*1.4); c.drawImage(face,-FR,-FR,FR*2,FR*2); c.restore(); } }
  if(blur>0){ c.save(); c.globalAlpha=blur*.9; c.rotate(ang); c.drawImage(blurFace,-FR,-FR,FR*2,FR*2); c.restore();
    if(!refl){ c.save(); c.globalCompositeOperation='lighter'; for(let i=0;i<7;i++){ const r=R_HUB+30+rnd(i+70)*(R_SEG-R_HUB-40), a0=ang*.9+rnd(i+80)*TAU;
      c.beginPath(); c.arc(0,0,r,a0,a0+.6+rnd(i+90)*.9); c.strokeStyle='rgba(255,255,255,'+(.22*blur).toFixed(3)+')'; c.lineWidth=3+rnd(i)*5; c.stroke(); } c.restore(); } }
  // 긴장: 핀 아래 칸만 밝게, 나머지는 어둡게
  const cur=segUnderPin(ang);
  if(t>=TEN){
    const d=t<S?eio(seg(t,TEN,TEN+500))*.5:(t<RES?0:.34*eo(seg(t,RES,RES+600)));
    if(d>0) RD.wedges.forEach((w,i)=>{ if(i===cur) return; wedgePath(c,ang+w.st,ang+w.st+w.sw,R_SEG+1); c.fillStyle='rgba(6,12,24,'+d.toFixed(3)+')'; c.fill(); });
  }
  // 공개: 당첨 칸 흰 펄스 2회
  if(t>=S){
    const w=RD.wedges[RD.winIdx]||RD.wedges[cur], p=seg(t,S,S+900), a=Math.pow(Math.max(0,Math.sin(p*Math.PI*2)),1.2)*(1-p*.3);
    if(a>0){ wedgePath(c,ang+w.st,ang+w.st+w.sw,R_SEG); c.fillStyle='rgba(255,255,255,'+(.6*a).toFixed(3)+')'; c.fill(); }
  }
  // 유리 광택 (돌지 않는 반사광) + 테두리 안쪽 그늘
  g=c.createLinearGradient(-R_SEG*.7,-R_SEG*.9,R_SEG*.3,R_SEG*.2); g.addColorStop(0,'rgba(255,255,255,.26)'); g.addColorStop(.5,'rgba(255,255,255,.04)'); g.addColorStop(1,'rgba(255,255,255,0)');
  c.fillStyle=g; c.beginPath(); c.ellipse(-R_SEG*.18,-R_SEG*.3,R_SEG*.82,R_SEG*.6,-.5,0,TAU); c.fill();
  g=c.createRadialGradient(0,0,R_SEG*.86,0,0,R_SEG); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,.42)');
  c.fillStyle=g; c.fillRect(-R_SEG,-R_SEG,R_SEG*2,R_SEG*2);
  c.restore();
  c.restore();
  // 마퀴 전구 (원판 위 고정 좌표, 둥글게)
  drawBulbs(c,BULB_PTS,t,BULB_R,refl);
  // 공개: 당첨 칸이 판에서 들려 올라와 빛난다
  if(t>=S){
    const w=RD.wedges[RD.winIdx], lift=eback(seg(t,S,S+240)), a0=ang+w.st, a1=a0+w.sw, mid=(a0+a1)/2, off=24*lift, sc=1+.05*lift;
    const glow=.6+.4*Math.sin(amb(t)*.006);
    c.save(); c.scale(1,SQ);
    if(!refl){ c.save(); c.translate(Math.cos(mid)*off*.4+8,Math.sin(mid)*off*.4+22); c.scale(sc,sc); wedgePath(c,a0,a1,R_SEG); c.fillStyle='rgba(0,0,0,.45)'; c.fill(); c.restore(); }
    c.save(); c.translate(Math.cos(mid)*off,Math.sin(mid)*off); c.scale(sc,sc);
    c.save(); wedgePath(c,a0,a1,R_SEG); c.clip(); c.rotate(ang); c.drawImage(face,-FR,-FR,FR*2,FR*2); c.restore();
    wedgePath(c,a0,a1,R_SEG); c.fillStyle='rgba(255,236,170,'+(.16*glow).toFixed(3)+')'; c.fill();
    c.lineJoin='round'; c.lineWidth=10; c.strokeStyle=isMiss()?'#c9d3df':GOLD; if(!refl){c.shadowColor=GOLD; c.shadowBlur=30*glow;} c.stroke();
    c.shadowBlur=0; c.lineWidth=3; c.strokeStyle='rgba(255,255,255,.85)'; c.stroke();
    c.restore(); c.restore();
  }
  // 허브 (금속 캡)
  const hs=t>=S&&t<RES?lerp(1.5,1,eback(seg(t,S+60,S+300))):1, hr=t>=S?R_HUB:66;
  c.save(); c.scale(hs,hs);
  c.save(); c.scale(1,SQ);
  c.beginPath(); c.arc(4,10,hr+4,0,TAU); c.fillStyle='rgba(0,0,0,.4)'; c.fill();
  g=c.createLinearGradient(0,-hr,0,hr); g.addColorStop(0,'#33496e'); g.addColorStop(1,'#0b1424');
  c.beginPath(); c.arc(0,0,hr,0,TAU); c.fillStyle=g; c.fill();
  g=c.createRadialGradient(-hr*.3,-hr*.35,2,0,0,hr-7);
  if(t>=S){ g.addColorStop(0,isMiss()?'#e3e8ef':'#FFF1B8'); g.addColorStop(.6,isMiss()?'#8a97a8':GOLD); g.addColorStop(1,isMiss()?'#5c6b80':'#D99A00'); }
  else { g.addColorStop(0,'#FFB487'); g.addColorStop(.6,OR); g.addColorStop(1,'#B53A07'); }
  c.beginPath(); c.arc(0,0,hr-7,0,TAU); c.fillStyle=g; c.fill();
  c.restore();
  c.textAlign='center'; c.textBaseline='middle';
  if(t>=S){ c.fillStyle=NAVY; c.font='38px '+FT; c.fillText(isMiss()?'꽝':(isJackpot()?'잭팟':'당첨'),0,-8); starPath(c,0,28,10,4.4,5); c.fill(); }
  else { c.save(); c.scale(1,SQ); starPath(c,0,1,30,13,5); c.fillStyle=CR2; c.fill(); c.lineWidth=3; c.strokeStyle='rgba(23,36,55,.45)'; c.stroke(); c.restore(); }
  c.restore();
  // 금속 플래퍼 (못에 걸려 휘고 튕김)
  drawPointer(c,t,refl);
}

/* ---------- machine: text slot capsule ---------- */
let capDots=null;
function buildCapDots(){
  const Wc=CAP.w, Hc=CAP.h, R=Hc/2, inset=30, r=R-inset, segs=[];
  segs.push({len:Wc-2*R,at:u=>[-Wc/2+R+u*(Wc-2*R),-Hc/2+inset]});
  segs.push({len:Math.PI*r,at:u=>{const a=-Math.PI/2+u*Math.PI;return [Wc/2-R+Math.cos(a)*r,Math.sin(a)*r];}});
  segs.push({len:Wc-2*R,at:u=>[Wc/2-R-u*(Wc-2*R),Hc/2-inset]});
  segs.push({len:Math.PI*r,at:u=>{const a=Math.PI/2+u*Math.PI;return [-Wc/2+R+Math.cos(a)*r,Math.sin(a)*r];}});
  const L=segs.reduce((s,g)=>s+g.len,0), n=Math.round(L/58), out=[];
  for(let i=0;i<n;i++){let d=i*L/n;for(const g of segs){if(d<=g.len){out.push(g.at(g.len?d/g.len:0));break;}d-=g.len;}}
  return out;
}
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function fitFont(c,txt,px,maxW,font){c.font=px+'px '+font;const m=c.measureText(txt).width;if(m>maxW){px=Math.max(24,Math.floor(px*maxW/m));c.font=px+'px '+font;}return px;}
function drawText(c,t,refl){
  const {TEN,S}=TL, pos=slotPos(t), vel=slotVel(t);
  if(!capDots) capDots=buildCapDots();
  c.save(); c.translate(0,CAP.y);
  drawStand(c,CAP.h/2-10,190);
  if(!refl){ c.strokeStyle='rgba(245,243,239,.35)'; c.lineWidth=4; [-450,450].forEach(x=>{c.beginPath();c.moveTo(x,-CAP.h/2+20);c.lineTo(x,-1400);c.stroke();}); }
  // 몸통 두께 + 베벨
  rr(c,-CAP.w/2,-CAP.h/2+26,CAP.w,CAP.h,CAP.h/2); c.fillStyle='#7c2604'; c.fill(); c.lineWidth=8; c.strokeStyle=NAVY; c.stroke();
  rr(c,-CAP.w/2,-CAP.h/2,CAP.w,CAP.h,CAP.h/2);
  let g=c.createLinearGradient(0,-CAP.h/2,0,CAP.h/2); g.addColorStop(0,'#FFA26A'); g.addColorStop(.42,OR); g.addColorStop(1,'#C24008');
  c.fillStyle=g; c.fill(); c.lineWidth=9; c.strokeStyle=NAVY; c.stroke();
  rr(c,-CAP.w/2+14,-CAP.h/2+9,CAP.w-28,CAP.h*.36,CAP.h*.32); c.fillStyle='rgba(255,255,255,.14)'; c.fill();
  // 전구 (추격)
  drawBulbs(c,capDots,t,12,refl);
  // 창 (돌아가는 드럼: 위·아래로 갈수록 눌리고 어두워진다)
  const ix=-CAP.iw/2, iy=-CAP.ih/2;
  rr(c,ix-8,iy-8,CAP.iw+16,CAP.ih+16,CAP.ih/2+8); c.fillStyle='#0b1424'; c.fill();
  rr(c,ix,iy,CAP.iw,CAP.ih,CAP.ih/2); c.fillStyle=CR2; c.fill();
  c.save(); rr(c,ix,iy,CAP.iw,CAP.ih,CAP.ih/2); c.clip();
  c.textAlign='center'; c.textBaseline='middle';
  const RC=176, k0=Math.floor(pos), spd=Math.abs(vel)*IH, blur=cl((spd-.5)/2.4);
  for(let k=k0-2;k<=k0+3;k++){
    if(k<0||k>=RD.list.length) continue;
    const o=k-pos, a=o*.85; if(Math.abs(a)>1.5) continue;
    const y=Math.sin(a)*RC, sy=Math.max(.05,Math.cos(a)), name=RD.list[k];
    c.save(); c.translate(0,y+8); c.scale(1,sy);
    fitFont(c,name,132,CAP.iw-170,FT);
    if(blur>.02){ for(let gk=1;gk<=4;gk++){ c.globalAlpha=.2*blur; c.fillStyle=NAVY; c.fillText(name,0,-gk*vel*IH*6/sy); } }
    c.globalAlpha=1-blur*.55; c.fillStyle=(t>=S&&k===0)?NAVY:'#14213a'; c.fillText(name,0,0);
    c.restore();
  }
  c.globalAlpha=1;
  g=c.createLinearGradient(0,iy,0,-iy);
  g.addColorStop(0,'rgba(11,20,36,.92)'); g.addColorStop(.3,'rgba(11,20,36,0)'); g.addColorStop(.7,'rgba(11,20,36,0)'); g.addColorStop(1,'rgba(11,20,36,.92)');
  c.fillStyle=g; c.fillRect(ix,iy,CAP.iw,CAP.ih);
  g=c.createLinearGradient(0,iy,0,iy+CAP.ih*.42); g.addColorStop(0,'rgba(255,255,255,.34)'); g.addColorStop(1,'rgba(255,255,255,0)');
  c.fillStyle=g; rr(c,ix+40,iy+10,CAP.iw-80,CAP.ih*.36,CAP.ih*.18); c.fill();
  if(t>=TEN&&t<S){ c.fillStyle='rgba(255,91,23,'+(.1*eio(seg(t,TEN,S))+.06*hb(t)).toFixed(3)+')'; c.fillRect(ix,iy,CAP.iw,CAP.ih); }
  if(t>=S){ const p=seg(t,S,S+900), a=Math.pow(Math.max(0,Math.sin(p*Math.PI*2)),1.2)*(1-p*.3); if(a>0){c.fillStyle='rgba(255,255,255,'+(.75*a).toFixed(3)+')'; c.fillRect(ix,iy,CAP.iw,CAP.ih);} }
  c.restore();
  rr(c,ix,iy,CAP.iw,CAP.ih,CAP.ih/2); c.lineWidth=7; c.strokeStyle=(t>=S)?GOLD:NAVY; if(t>=S&&!refl){c.save();c.shadowColor=GOLD;c.shadowBlur=26;c.stroke();c.restore();} else c.stroke();
  // 좌우 페이라인 화살표 = 플래퍼 (칸이 넘어갈 때 밀렸다 튕김)
  const nd=slotNudge(t);
  [-1,1].forEach(sd=>{ c.save(); c.translate(sd*(CAP.iw/2-14),0); c.scale(sd,1); c.rotate(nd*.38); c.translate(-nd*8,0);
    c.beginPath(); c.moveTo(-36,0); c.lineTo(12,-34); c.lineTo(12,34); c.closePath();
    const ag=c.createLinearGradient(0,-34,0,34); ag.addColorStop(0,t>=S?'#FFE68C':'#FF9A5C'); ag.addColorStop(1,t>=S?'#D99A00':'#C24008');
    c.fillStyle=ag; c.fill(); c.lineWidth=5; c.strokeStyle=NAVY; c.lineJoin='round'; c.stroke(); c.restore(); });
  // 상단 라벨
  c.save(); c.translate(0,-CAP.h/2-6);
  rr(c,-180,-36,360,72,36); c.fillStyle=NAVY; c.fill(); c.lineWidth=5; c.strokeStyle=OR; c.stroke();
  c.fillStyle=CR; c.font='900 31px '+FK; c.textAlign='center'; c.textBaseline='middle'; c.fillText('룰렛 추첨기',0,2);
  c.fillStyle=GOLD; starPath(c,-136,0,13,5.5,5); c.fill(); starPath(c,136,0,13,5.5,5); c.fill();
  c.restore();
  c.restore();
}
function drawMachine(c,t,refl){ if(RD.mode==='text') drawText(c,t,refl); else drawWheel(c,t,refl); }

/* ---------- world (stage) ---------- */
function drawWorld(c,t,cam){
  const at=amb(t), {TEN,S,RES}=TL, mc=RD.mode==='text'?CAP.y:-20, sp=spots(t), tens=t>=TEN&&t<S+40;
  c.save(); c.translate(960,540); c.rotate(cam.r); c.scale(cam.z,cam.z); c.translate(-cam.x,-cam.y);
  // 뒷벽
  let g=c.createLinearGradient(0,-1300,0,FLOOR);
  g.addColorStop(0,'#04080f'); g.addColorStop(.55,'#0a1424'); g.addColorStop(1,'#16243b');
  c.fillStyle=g; c.fillRect(-4000,-3000,8000,3000+FLOOR);
  // LED 벽 기둥 (여운엔 색이 번진다)
  for(let i=-16;i<=16;i++){
    const x=i*140, hue=t>=RES?SPOT_COL[(i+40)%4]:'245,243,239';
    const a=(t>=RES?.07+.05*Math.sin(at*.004+i*.8):.035)*(t>=TEN&&t<S?.4:1);
    c.fillStyle='rgba('+hue+','+Math.max(0,a).toFixed(3)+')'; c.fillRect(x-44,-1400,88,FLOOR+1400-10);
  }
  // 회전 후광 (공개~여운)
  if(t>=S){
    const a=t<RES?eo(seg(t,S,S+200)):1, miss=isMiss();
    c.save(); c.translate(0,mc); c.rotate(at*.0007); c.globalCompositeOperation='lighter';
    for(let i=0;i<24;i++){ const an=i/24*TAU, w=.065;
      const gr=c.createRadialGradient(0,0,0,0,0,1300); gr.addColorStop(0,miss?'rgba(170,190,220,'+(.22*a)+')':'rgba(255,200,80,'+(.42*a)+')'); gr.addColorStop(1,'rgba(255,120,30,0)');
      c.fillStyle=gr; c.beginPath(); c.moveTo(0,0); c.arc(0,0,1300,an-w,an+w); c.closePath(); c.fill(); }
    const gl=c.createRadialGradient(0,0,0,0,0,640); gl.addColorStop(0,miss?'rgba(180,200,230,'+(.3*a)+')':'rgba(255,226,140,'+(.55*a)+')'); gl.addColorStop(1,'rgba(255,140,40,0)');
    c.fillStyle=gl; c.beginPath(); c.arc(0,0,640,0,TAU); c.fill();
    c.restore();
  }
  // 트러스 + 조명 헤드
  c.fillStyle='#1d2a40'; c.fillRect(-1800,LY-40,3600,34);
  c.strokeStyle='#2c3c57'; c.lineWidth=4; for(let x=-1800;x<1800;x+=60){c.beginPath();c.moveTo(x,LY-40);c.lineTo(x+60,LY-6);c.stroke();}
  sp.forEach(s=>{ c.save(); c.translate(s.lx,LY); c.rotate(Math.atan2(s.ty-LY,s.tx-s.lx)-Math.PI/2);
    c.fillStyle='#0b111c'; c.fillRect(-34,-30,68,60); c.fillStyle=s.on?'rgba('+s.col+','+Math.min(1,.4+s.a)+')':'#222c3c'; c.beginPath(); c.ellipse(0,30,30,10,0,0,TAU); c.fill(); c.restore(); });
  // 바닥
  g=c.createLinearGradient(0,FLOOR,0,FLOOR+700); g.addColorStop(0,'#1a2840'); g.addColorStop(1,'#03070d');
  c.fillStyle=g; c.fillRect(-4000,FLOOR,8000,3000);
  c.strokeStyle='rgba(245,243,239,.06)'; c.lineWidth=2;
  for(let i=-14;i<=14;i++){c.beginPath();c.moveTo(i*130,FLOOR);c.lineTo(i*460,FLOOR+900);c.stroke();}
  for(let j=1;j<8;j++){const y=FLOOR+Math.pow(j/8,1.7)*700;c.beginPath();c.moveTo(-4000,y);c.lineTo(4000,y);c.stroke();}
  // 바닥 반사 (머신을 뒤집어 흐리게)
  c.save(); c.beginPath(); c.rect(-4000,FLOOR,8000,3000); c.clip();
  c.translate(0,FLOOR*2); c.scale(1,-1); c.globalAlpha=.22; drawMachine(c,t,true); c.restore();
  g=c.createLinearGradient(0,FLOOR,0,FLOOR+380); g.addColorStop(0,'rgba(10,18,32,0)'); g.addColorStop(1,'rgba(4,8,14,.96)');
  c.fillStyle=g; c.fillRect(-4000,FLOOR,8000,3000);
  // 조명 원뿔 + 바닥 조명 웅덩이 (긴장 구간에는 암전 위에 다시 그린다)
  const cones=()=>{ c.save(); c.globalCompositeOperation='lighter';
    sp.forEach(s=>drawCone(c,s));
    sp.forEach(s=>{ if(s.a<=0) return; const x=floorX(s,FLOOR+70), rx=s.w*.95;
      const pg=c.createRadialGradient(x,FLOOR+70,0,x,FLOOR+70,rx); pg.addColorStop(0,'rgba('+s.col+','+(.5*s.a).toFixed(3)+')'); pg.addColorStop(1,'rgba('+s.col+',0)');
      c.save(); c.translate(x,FLOOR+70); c.scale(1,.2); c.translate(-x,-(FLOOR+70)); c.fillStyle=pg; c.beginPath(); c.arc(x,FLOOR+70,rx,0,TAU); c.fill(); c.restore(); });
    c.restore(); };
  if(!tens) cones();
  // 무대 앞 가장자리 전구줄
  for(let i=-32;i<=32;i++){ const x=i*56, on=t>=RES?(i+Math.floor(at/300))%2===0:(t<TEN?(i+Math.floor(t/150))%4===0:false);
    c.fillStyle=on?GOLD:'rgba(245,243,239,.25)'; c.beginPath(); c.arc(x,FLOOR+520,7,0,TAU); c.fill(); }
  // 머신
  drawMachine(c,t,false);
  // 긴장: 핀 주변만 남기고 암전 (심장박동에 맞춰 조여든다) → 그 위로 수렴한 조명
  if(tens){
    const p=eio(seg(t,TEN,TEN+650)), p2=eio(seg(t,TEN,S)), d=Math.min(.94,(.86+.06*hb(t))*p*(t<S?1:1-seg(t,S,S+40)));
    c.save(); c.translate(0,focusY()-30);
    if(RD.mode==='text') c.scale(2.7,1);
    const r0=RD.mode==='text'?150:lerp(240,110,p2)*(1-.05*hb(t)), r1=RD.mode==='text'?330:lerp(640,360,p2);
    const dg=c.createRadialGradient(0,0,r0,0,0,r1); dg.addColorStop(0,'rgba(2,5,10,0)'); dg.addColorStop(1,'rgba(2,5,10,'+d.toFixed(3)+')');
    c.fillStyle=dg; c.fillRect(-5000,-5000,10000,10000); c.restore();
    cones();
    // 핀 위 집중 조명
    const a=(eio(seg(t,TEN,S))*.26+.08*hb(t))*(RD.mode==='text'?.45:1), fy=focusY();
    c.save(); c.globalCompositeOperation='lighter';
    const lg=c.createRadialGradient(0,fy,0,0,fy,360); lg.addColorStop(0,'rgba(255,241,214,'+a.toFixed(3)+')'); lg.addColorStop(1,'rgba(255,241,214,0)');
    c.fillStyle=lg; c.beginPath(); c.arc(0,fy,360,0,TAU); c.fill(); c.restore();
  } else if(t>=S&&t<RES){
    const a=.5*(1-seg(t,S,RES))+.12, fy=focusY();
    c.save(); c.globalCompositeOperation='lighter';
    const lg=c.createRadialGradient(0,fy,0,0,fy,420); lg.addColorStop(0,'rgba(255,241,214,'+a.toFixed(3)+')'); lg.addColorStop(1,'rgba(255,241,214,0)');
    c.fillStyle=lg; c.beginPath(); c.arc(0,fy,420,0,TAU); c.fill(); c.restore();
  }
  c.restore();
}

/* ---------- crowd silhouettes (앞줄 관객) ---------- */
function crowd(c,t,cam){
  const {S,HIT,RES,TEN}=TL, at=amb(t), cheer=t>=HIT;
  const base=P.y+P.h+6, ox=-(cam.x)*.12, dim=t>=TEN&&t<S?.5:1;
  for(let i=0;i<19;i++){
    const r=26+rnd(i+5)*12, x=P.x+20+i*90+rnd(i)*30+ox;
    const jump=cheer?Math.abs(Math.sin((t<RES?t:at)*.012+i*1.3))*(t<RES?22:12)*(isMiss()?.3:1):0;
    const y=base-r*1.2-jump;
    c.fillStyle='#02050a';
    if(cheer&&rnd(i+9)>.4&&!isMiss()){ c.strokeStyle='#02050a'; c.lineWidth=r*.42; c.lineCap='round';
      const wv=Math.sin(at*.01+i)*.25; [-1,1].forEach(sd=>{c.beginPath();c.moveTo(x+sd*r*.9,y+r*1.1);c.lineTo(x+sd*r*(1.4+wv),y-r*1.6);c.stroke();}); }
    c.beginPath(); c.arc(x,y,r,0,TAU); c.fill();
    c.beginPath(); c.ellipse(x,y+r*1.9,r*1.45,r*1.1,0,0,TAU); c.fill();
    c.strokeStyle='rgba(255,236,200,'+((t>=S&&t<RES?.45:.18)*dim)+')'; c.lineWidth=3; c.beginPath(); c.arc(x,y,r,Math.PI*1.15,Math.PI*1.85); c.stroke();
  }
}

/* ---------- screen fx ---------- */
function screenFX(c,t,cam){
  const {TEN,S,HIT,RES}=TL, tm=RD.mode==='text';
  let g=c.createRadialGradient(960,540,420,960,540,1060);
  g.addColorStop(0,'rgba(0,6,14,0)'); g.addColorStop(1,'rgba(0,6,14,.66)'); c.fillStyle=g; c.fillRect(0,0,W,H);
  // 진행: 회전 속도선 (휠 둘레 원호)
  if(t>=TL.OB*.4&&t<S){
    const v=tm?cl(Math.abs(slotVel(t))*IH/2.2):cl(Math.abs(wheelVel(t))/.03), a=v*(1-seg(t,TEN,TEN+400))*.75;
    if(a>.02){ const [sx,sy]=toScreen(cam,0,tm?CAP.y:0); c.save(); c.translate(sx,sy);
      for(let i=0;i<30;i++){ const rr=(tm?440:440)+rnd(i)*280, a0=rnd(i+3)*TAU+t*.006*(1+rnd(i+7)), len=.25+rnd(i+9)*.45;
        c.strokeStyle='rgba(245,243,239,'+(a*(.25+rnd(i+11)*.4)).toFixed(3)+')'; c.lineWidth=2+rnd(i+13)*5;
        if(tm){ const x=(rnd(i+20)-.5)*1500, y=((rnd(i+21)*900+t*1.4)%900)-450; c.beginPath(); c.moveTo(x,y); c.lineTo(x,y+60+rnd(i)*120); c.stroke(); }
        else { c.beginPath(); c.ellipse(0,0,rr*cam.z,rr*cam.z*SQ,0,a0,a0+len); c.stroke(); } }
      c.restore(); }
  }
  // 긴장: 심장박동 붉은 가장자리 + 모이는 집중선 + 레터박스
  if(t>=TEN&&t<RES){
    const ten=seg(t,TEN,S), beat=t<S?hb(t):0;
    const og=c.createRadialGradient(960,560,300,960,560,1150);
    og.addColorStop(0,'rgba(255,91,23,0)'); og.addColorStop(1,'rgba(255,40,10,'+Math.min(.6,ten*.22+beat*.26).toFixed(3)+')');
    if(t<S){ c.fillStyle=og; c.fillRect(0,0,W,H);
      const [fx,fy]=toScreen(cam,0,focusY());
      c.save(); c.translate(fx,fy);
      for(let i=0;i<48;i++){ const a=rnd(i+400)*TAU, r0=300+rnd(i+401)*200+((t*.3)%70), r1=r0+260+rnd(i+402)*420;
        c.strokeStyle='rgba(245,243,239,'+(ten*.2).toFixed(3)+')'; c.lineWidth=2+rnd(i+403)*4;
        c.beginPath(); c.moveTo(Math.cos(a)*r0,Math.sin(a)*r0); c.lineTo(Math.cos(a)*r1,Math.sin(a)*r1); c.stroke(); }
      c.restore(); }
    const hbx=96*eo(seg(t,TEN,TEN+450))*(1-seg(t,HIT,HIT+220));
    c.fillStyle='#03060b'; c.fillRect(0,P.y,W,hbx); c.fillRect(0,P.y+P.h-hbx,W,hbx);
  }
  // 공개: 히트스톱 동안 흰 플래시 + 방사 집중선, 이후 잔광
  if(t>=S&&t<RES+300){
    const fl=Math.pow(1-seg(t,S,S+240),2);
    if(t<HIT){
      c.fillStyle='rgba(255,250,240,'+(.82*fl).toFixed(3)+')'; c.fillRect(0,0,W,H);
      const [fx,fy]=toScreen(cam,0,tm?CAP.y:TIP_Y+120);
      c.save(); c.translate(fx,fy);
      for(let i=0;i<44;i++){ const a=i/44*TAU+rnd(i)*.08, r0=150, r1=1500;
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
  // 단계 칩 (오른쪽 아래: 가운데 위쪽은 플래퍼 자리)
  const idx=phaseIdx(t), pw=118, gap=8, total=5*pw+4*gap, sx=P.x+P.w-60-total, cy=P.y+P.h-74;
  c.globalAlpha=1-seg(t,TL.RES+600,TL.RES+1000);
  if(c.globalAlpha>0) for(let i=0;i<5;i++){
    const x=sx+i*(pw+gap), y=cy, act=i===idx, done=i<idx;
    c.fillStyle=act?OR:done?'rgba(245,243,239,.85)':'rgba(10,18,28,.7)'; c.fillRect(x,y,pw,38);
    if(!act&&!done){c.strokeStyle='rgba(245,243,239,.45)';c.lineWidth=2;c.strokeRect(x+1,y+1,pw-2,36);}
    if(act){c.fillStyle='rgba(23,36,55,.35)';c.fillRect(x,y+32,pw*seg(t,phStart(i),phEnd(i)),6);}
    c.fillStyle=act?CR:done?NAVY:'rgba(245,243,239,.7)'; c.font='700 20px '+FK; c.textAlign='center';
    c.fillText(PH[i].n+' '+PH[i].ko,x+pw/2,y+20);
  }
  c.globalAlpha=1; c.textAlign='left';
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
// 긴장: 지금 핀 아래 있는 칸 이름이 오른쪽에서 떨며 바뀐다. 걸림 구간엔 '넘어갈까 말까!'
function tensionText(c,t){
  const {TEN,S}=TL, M=RD.mot; if(t<TEN||t>=S) return;
  const inn=eback(seg(t,TEN,TEN+260)), pop=Math.exp(-(t-kickT)/110), hang=M.near!=='none'&&t>=M.T1;
  let txt;
  if(RD.mode==='text'){ txt=String(RD.list[Math.round(slotPos(t))]||'')+'?'; }
  else { const it=RD.items[segUnderPin(wheelAngle(t))]; txt=(it?it.name:'')+'?'; }
  const k=Math.floor(t/24), j=4+pop*16+(hang?10:0)+hb(t)*6;
  const tx0=RD.mode==='text'?1420:1555, ty0=RD.mode==='text'?725:600, sc=inn*(1+pop*.16+hb(t)*.06);
  c.save(); c.translate(tx0+(rnd(k)-.5)*j,ty0+(rnd(k+5)-.5)*j); c.rotate(-.07); c.scale(sc,sc);
  c.textAlign='center'; c.textBaseline='middle';
  fitFont(c,txt,124,330,FT);
  outlinedText(c,txt,0,0,OR,NAVY,20,CR,32);
  const lab=hang?'넘어갈까 말까!':(RD.mode==='text'?'멈춘다…':'핀 ▸ 지금');
  c.font='900 34px '+FK; c.lineJoin='round';
  if(hang){ c.fillStyle=OR; const lw=c.measureText(lab).width; c.fillRect(-lw/2-18,82,lw+36,52); c.fillStyle=CR; c.fillText(lab,0,109); }
  else { c.fillStyle=CR; c.strokeStyle=NAVY; c.lineWidth=8; c.strokeText(lab,0,104); c.fillText(lab,0,104); }
  c.restore();
}
// 공개: 당첨 이름 대형 슬램 (1.9→1, -6°→0) + 스타버스트
function impactText(c,t){
  const {S,RES}=TL; if(t<S||t>RES+160) return;
  const p=seg(t,S+10,S+190), s=lerp(1.9,1,eback(p))*(1+seg(t,S+190,RES)*.05), a=Math.min(1,p*4)*(1-seg(t,RES+20,RES+160));
  const rot=lerp(-.105,0,eback(p)), miss=isMiss(), jp=isJackpot();
  const tag=miss?'꽝!':(jp?'JACKPOT!':'당첨!'), name=String(RD.winner||'');
  c.save(); c.globalAlpha=a; c.translate(960,RD.mode==='text'?835:790); c.rotate(rot);
  c.save(); c.rotate(t*.0012); c.scale(s*.9,s*.62);
  c.fillStyle=miss?'#c9d3df':CR; c.beginPath();
  for(let i=0;i<40;i++){const r=i%2?300:430+rnd(i)*80,an=i/40*TAU;i?c.lineTo(Math.cos(an)*r,Math.sin(an)*r):c.moveTo(Math.cos(an)*r,Math.sin(an)*r);}
  c.closePath(); c.fill(); c.strokeStyle=NAVY; c.lineWidth=9; c.stroke();
  c.restore();
  c.scale(s,s); c.textAlign='center'; c.textBaseline='middle';
  fitFont(c,name,200,1100,FT);
  c.fillStyle=miss?'#5c6b80':(jp?GOLD:OR); c.fillText(name,10,14);
  outlinedText(c,name,0,0,miss?'#e6ebf1':CR,NAVY,22,null,0);
  c.font='64px '+FT; const tw=c.measureText(tag).width;
  c.save(); c.translate(0,-146); c.rotate(-.06);
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
  const jp=isJackpot(), miss=isMiss(), M=RD.mot;
  at('open',0,()=>{ FX.sound('whoosh'); });
  at('launch',M.W0||0,()=>{ if(RD.mode!=='text') FX.spinStart(); FX.sound('flip'); });
  at('lamps',Math.min(TL.OB,330),()=>FX.sound('pop'));
  at('ten',TL.TEN,()=>FX.drumStart(132));                         // 심장박동
  at('hang',M.T1,()=>FX.drumStart(200),M.near!=='none'&&M.T1>TL.TEN);
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
    const sk=window.__rouletteSeek, t=(typeof sk==='number')?sk:now-RD.start;
    if(t<TL.S){                                         // 칸 통과 → 틱 + 카메라 킥
      const sg=RD.mode==='text'?Math.round(slotPos(t)):segUnderPin(wheelAngle(t));
      if(sg!==lastSeg){ if(lastSeg!==-1){ kickT=t; if(now-lastTickAt>=40){ lastTickAt=now; if(window.FX) FX.sound('tick'); } } lastSeg=sg; }
    }
    cue(t); render(t);
    if(fadeAt&&now-fadeAt>420){ RD=null; fadeAt=0; X.setTransform(1,0,0,1,0,0); X.clearRect(0,0,W,H); }
  }
  requestAnimationFrame(loop);
}

/* ---------- public ---------- */
// 이진 탐색: 단조 증가 함수 fn 이 target 에 닿는 p (0..1)
function solveP(fn,target){let lo=0,hi=1;for(let i=0;i<30;i++){const m=(lo+hi)/2;if(fn(m)<target)lo=m;else hi=m;}return (lo+hi)/2;}
// data: RouletteSpinState { winner, winnerIdx, items, spinMs, animType }
window.startRoulette=data=>{
  const items=(data.items||[]).filter(i=>i&&i.name!=null).map(i=>({name:String(i.name),probability:Number(i.probability)||0}));
  if(!items.length) return;
  if(window.FX){ FX.hideWinner(); FX.spinStop(); FX.drumStop(); }
  const S=Math.max(400,Number(data.spinMs)||3000);
  const OB=Math.min(700,S*.3), TEN=Math.max(OB,S-cl(S*.36,500,1700));
  TL={OB,TEN,S,HIT:S+80,RES:S+700};
  const mode=data.animType==='text'?'text':'wheel';
  let winIdx=Number(data.winnerIdx); if(!(winIdx>=0&&winIdx<items.length)){ winIdx=items.findIndex(i=>i.name===data.winner); if(winIdx<0) winIdx=0; }
  const winner=String(data.winner!=null?data.winner:items[winIdx].name);
  const wedges=buildFace(items), n=items.length;
  const w=wedges[winIdx];
  // 걸림·낙하 구간 (짧은 회전이나 1칸이면 생략)
  const HANG=(S>=1400&&(n>1||mode==='text'))?cl(S*.15,220,520):0, DROP=HANG?cl(S*.1,160,320):0;
  const T2=S-DROP, T1=Math.max(TEN,T2-HANG), W0=mode==='text'?0:Math.min(200,S*.07);
  const M={W0,T1,T2,near:'none',cc:.05,angH:0,angC:0,angF:0,setA:0,tc:T2};
  const base=-Math.PI/2+7*TAU;
  if(mode==='text'){
    if(HANG){ M.near='over'; M.tc=T2+solveP(p=>.54*eback(p),.04)*(S-T2); }
  } else if(HANG&&T2-T1>=120){
    M.near=Math.random()<.6?'over':'back';
    const minSw=Math.min(...wedges.map(x=>x.sw)); M.cc=Math.min(.07,minSw*.25);
    const dd=(.25+Math.random()*.2)*w.sw, ph=M.near==='over'?w.st+w.sw:w.st;
    M.angH=-.42*M.cc-ph+base; M.angC=M.angH+.3*M.cc;
    M.angF=(M.near==='over'?dd:-dd)-ph+base;
    if(M.near==='over'){ const x=.12*M.cc/(M.angF-M.angC); M.tc=T2+(1-Math.cbrt(1-x))*(S-T2); }
    M.setA=(M.near==='over'?1:-1)*Math.min(.025,dd*.3);
  } else {
    const jitter=(Math.random()-.5)*.56*w.sw;
    M.angF=-Math.PI/2-(w.st+w.sw/2+jitter)+7*TAU; M.setA=.02*Math.min(1,w.sw); M.cc=Math.min(.07,Math.min(...wedges.map(x=>x.sw))*.25);
  }
  if(M.near==='none'){ M.T1=S; M.T2=S; }
  const names=items.map(i=>i.name), list=[winner];
  for(let r=0;r<5;r++) list.push(...[...names].sort(()=>Math.random()-.5));
  if(mode==='text'&&list.length>1&&list[1]===winner&&names.length>1){ const j=list.findIndex((x,i)=>i>1&&x!==winner); if(j>1){ const tmp=list[1]; list[1]=list[j]; list[j]=tmp; } }
  const total=items.reduce((s,i)=>s+i.probability,0)||1;
  RD={mode,items,winIdx,winner,wedges,mot:M,list,start:performance.now(),pct:(items[winIdx].probability/total*100).toFixed(1).replace(/[.]0$/,'')};
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
  Promise.all([document.fonts.load('100px '+FT),document.fonts.load('900 40px '+FK),document.fonts.load('700 40px '+FK),document.fonts.load('800 20px '+FM)])
    .then(()=>{ if(RD) buildFace(RD.items); }).catch(()=>{});      // 글꼴이 늦게 오면 판 글자를 다시 그린다
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
