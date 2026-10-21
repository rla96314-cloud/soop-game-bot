// OBS 오버레이 페이지: slot — '카지노 전광판' 연출 (등장 → 회전 → 긴장/리치 → 공개 → 여운)
// 모션 언어: .inhabited/motion-language.md (기준: fish.ts '수중 다큐 카메라'). 캔버스 1장 + 타임라인 렌더 + 카메라 리그.
// 엔진의 state.slot(SlotSpinState: symbols[3], jackpot, twoKind, triggeredBy, spinMs, runId) 로 1회 재생.
//  - 같은 runId 는 무시, 다른 runId 가 오면 진행 중 판을 끊고 새로 시작
//  - 회전 구간(등장~두 번째 릴 정지)은 엔진 spinMs 에 맞춰 배속, 긴장·공개·여운은 고정 박자
//  - 리치(앞 두 릴 일치): 세 번째 릴이 한 칸씩 끊어 가며 멈춤 (간격이 점점 길어짐)
//  - 별풍선 수는 showing_result 의 result.balloon 으로 채움 (같은 runId 일 때)
// setTimeout 없이 rAF 한 개로 돌아가서, 새 판이 오면 cues/타임라인만 초기화하면 이전 연출이 남지 않는다.
import { FX_SCRIPT } from './_fx'

export const SLOT_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>카지노 전광판</title>
<meta name="viewport" content="width=1920">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@500;700;900&family=JetBrains+Mono:wght@500;700;800&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;padding:0;background:transparent !important;overflow:hidden;width:1920px;height:1080px}
  canvas{display:block;width:1920px;height:1080px}
  #anchor{position:fixed;left:300px;top:996px;width:740px;height:1px;pointer-events:none}
</style>
</head>
<body>
<canvas id="c" width="1920" height="1080"></canvas>
<div id="anchor"></div>
<script>${FX_SCRIPT}<\/script>
<script>
(() => {
const C = document.getElementById('c'), X = C.getContext('2d');
const W = 1920, H_ = 1080;
const NAVY='#172437', OR='#FF5B17', CR='#F5F3EF', MINT='#00CB84', YEL='#FFC61A', RED='#E8344A';
const FT = '"Black Han Sans","Noto Sans KR",sans-serif';
const FK = '"Noto Sans KR","Apple SD Gothic Neo",sans-serif';
const FM = '"JetBrains Mono",ui-monospace,Menlo,monospace';

/* ---------- helpers ---------- */
const cl=(v,a,b)=>Math.max(a===undefined?0:a,Math.min(b===undefined?1:b,v));
const lerp=(a,b,p)=>a+(b-a)*p;
const seg=(t,a,b)=>cl((t-a)/(b-a));
const eo=p=>1-Math.pow(1-p,3);
const ei=p=>p*p*p;
const eio=p=>p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
const eback=p=>{const c1=2.0,c3=c1+1;return 1+c3*Math.pow(p-1,3)+c1*Math.pow(p-1,2);};
const rnd=i=>{const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x);};

/* ---------- layout (고정 좌표, 측정 없음) ---------- */
const P = {x:140,y:96,w:1640,h:878,b:30};          // 전광판 (베젤 b 안쪽이 화면)
const S = {x:P.x+P.b,y:P.y+P.b,w:P.w-P.b*2,h:P.h-P.b*2};
const CELL=170, REEL_X=[-270,0,270], REEL_W=244, REEL_H=330;

/* ---------- symbols ---------- */
const VS=String.fromCharCode(0xFE0F);
const norm=s=>String(s==null?'':s).split(VS).join('');
const DEFAULTS=['🍒','🍋','🍊','⭐','🎰','💎'];
const SYMNAME={'🍒':'체리','🍋':'레몬','🍊':'오렌지','⭐':'별','🎰':'세븐','💎':'다이아'};
const isUrl=s=>!!s&&(s.indexOf('http')===0||s.indexOf('data:')===0);
const imgs={};
function img(src){ if(!imgs[src]){ const im=new Image(); im.src=src; imgs[src]=im; } return imgs[src]; }
function symName(s){ const n=norm(s); if(SYMNAME[n]) return SYMNAME[n]; if(isUrl(n)) return '그림'; return n.length>6?n.slice(0,6):n; }

function star(c,n,ro,ri){ c.beginPath(); for(let i=0;i<n*2;i++){const r=i%2?ri:ro,a=-Math.PI/2+i*Math.PI/n; i?c.lineTo(Math.cos(a)*r,Math.sin(a)*r):c.moveTo(Math.cos(a)*r,Math.sin(a)*r);} c.closePath(); }
/** 기본 심볼은 직접 그린다 (이모지를 주인공으로 쓰지 않음). R = 반지름 크기 */
function glyph(c,sym,R){
  const s=norm(sym);
  c.save(); c.lineJoin='round'; c.lineCap='round'; c.strokeStyle=NAVY;
  if(s==='🍒'){
    c.lineWidth=R*.1; c.strokeStyle='#0E7A4F';
    c.beginPath(); c.moveTo(-R*.4,R*.05); c.quadraticCurveTo(-R*.32,-R*.5,R*.1,-R*.78); c.stroke();
    c.beginPath(); c.moveTo(R*.4,R*.18); c.quadraticCurveTo(R*.28,-R*.36,R*.1,-R*.78); c.stroke();
    c.fillStyle=MINT; c.beginPath(); c.ellipse(R*.42,-R*.74,R*.3,R*.13,-.35,0,Math.PI*2); c.fill(); c.lineWidth=R*.05; c.strokeStyle=NAVY; c.stroke();
    [[-R*.4,R*.36,R*.42],[R*.38,R*.46,R*.4]].forEach(([x,y,r])=>{
      c.fillStyle=RED; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill(); c.lineWidth=R*.07; c.strokeStyle=NAVY; c.stroke();
      c.strokeStyle='rgba(255,255,255,.75)'; c.lineWidth=R*.08; c.beginPath(); c.arc(x,y,r*.62,Math.PI*1.1,Math.PI*1.45); c.stroke();
    });
  } else if(s==='🍋'){
    c.rotate(-.35);
    c.fillStyle='#FFD43B'; c.beginPath(); c.ellipse(0,0,R*.82,R*.58,0,0,Math.PI*2); c.fill();
    c.beginPath(); c.arc(R*.84,0,R*.13,0,Math.PI*2); c.arc(-R*.84,0,R*.13,0,Math.PI*2); c.fill();
    c.lineWidth=R*.07; c.beginPath(); c.ellipse(0,0,R*.82,R*.58,0,0,Math.PI*2); c.stroke();
    c.strokeStyle='rgba(255,255,255,.7)'; c.lineWidth=R*.08; c.beginPath(); c.ellipse(0,0,R*.55,R*.36,0,Math.PI*1.1,Math.PI*1.5); c.stroke();
    c.fillStyle='rgba(200,140,0,.35)'; for(let i=0;i<6;i++){c.beginPath();c.arc(-R*.3+i*R*.14,R*.18+(i%2)*R*.08,R*.035,0,Math.PI*2);c.fill();}
  } else if(s==='🍊'){
    c.fillStyle='#FF8A2B'; c.beginPath(); c.arc(0,R*.08,R*.7,0,Math.PI*2); c.fill(); c.lineWidth=R*.07; c.stroke();
    c.fillStyle=MINT; c.beginPath(); c.ellipse(R*.22,-R*.66,R*.28,R*.12,-.5,0,Math.PI*2); c.fill(); c.lineWidth=R*.05; c.stroke();
    c.fillStyle=NAVY; c.beginPath(); c.arc(0,-R*.58,R*.07,0,Math.PI*2); c.fill();
    c.strokeStyle='rgba(255,255,255,.7)'; c.lineWidth=R*.09; c.beginPath(); c.arc(0,R*.08,R*.46,Math.PI*1.1,Math.PI*1.45); c.stroke();
    c.fillStyle='rgba(160,60,0,.28)'; for(let i=0;i<7;i++){const a=i*.9;c.beginPath();c.arc(Math.cos(a)*R*.4,R*.08+Math.sin(a)*R*.4,R*.035,0,Math.PI*2);c.fill();}
  } else if(s==='⭐'){
    c.fillStyle=YEL; star(c,5,R*.88,R*.4); c.fill(); c.lineWidth=R*.08; c.stroke();
    c.fillStyle='#FFE58A'; c.save(); c.translate(-R*.06,-R*.08); star(c,5,R*.42,R*.2); c.fill(); c.restore();
  } else if(s==='🎰'){
    c.font=(R*2.05)+'px '+FT; c.textAlign='center'; c.textBaseline='middle';
    c.fillStyle=NAVY; c.fillText('7',R*.1,R*.16);
    c.lineWidth=R*.3; c.strokeStyle=CR; c.strokeText('7',0,R*.06);
    c.lineWidth=R*.14; c.strokeStyle=NAVY; c.strokeText('7',0,R*.06);
    c.fillStyle=RED; c.fillText('7',0,R*.06);
  } else if(s==='💎'){
    const p=[[-R*.82,-R*.22],[-R*.46,-R*.62],[R*.46,-R*.62],[R*.82,-R*.22],[0,R*.82]];
    c.fillStyle='#5CE1E6'; c.beginPath(); p.forEach((q,i)=>i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1])); c.closePath(); c.fill();
    c.fillStyle='#B8F4F6'; c.beginPath(); c.moveTo(-R*.46,-R*.62); c.lineTo(-R*.16,-R*.22); c.lineTo(R*.16,-R*.22); c.lineTo(R*.46,-R*.62); c.closePath(); c.fill();
    c.fillStyle='#21A9C7'; c.beginPath(); c.moveTo(R*.16,-R*.22); c.lineTo(R*.82,-R*.22); c.lineTo(0,R*.82); c.closePath(); c.fill();
    c.fillStyle='#8EEBEF'; c.beginPath(); c.moveTo(-R*.16,-R*.22); c.lineTo(R*.16,-R*.22); c.lineTo(0,R*.82); c.closePath(); c.fill();
    c.lineWidth=R*.07; c.beginPath(); p.forEach((q,i)=>i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1])); c.closePath(); c.stroke();
    c.lineWidth=R*.035; c.beginPath(); c.moveTo(-R*.82,-R*.22); c.lineTo(R*.82,-R*.22); c.moveTo(-R*.16,-R*.22); c.lineTo(0,R*.82); c.lineTo(R*.16,-R*.22); c.stroke();
    c.fillStyle='#fff'; c.save(); c.translate(-R*.4,-R*.38); star(c,4,R*.16,R*.04); c.fill(); c.restore();
  } else if(isUrl(s)){
    const im=img(s);
    if(im.complete&&im.naturalWidth){ const k=Math.min(R*1.7/im.naturalWidth,R*1.7/im.naturalHeight); c.drawImage(im,-im.naturalWidth*k/2,-im.naturalHeight*k/2,im.naturalWidth*k,im.naturalHeight*k); }
    else { c.fillStyle='rgba(23,36,55,.15)'; c.beginPath(); c.arc(0,0,R*.6,0,Math.PI*2); c.fill(); }
  } else {
    c.font=(R*1.3)+'px '+FT; c.textAlign='center'; c.textBaseline='middle'; c.fillStyle=NAVY;
    const mw=c.measureText(s).width; if(mw>R*1.9) c.font=Math.floor(R*1.3*R*1.9/mw)+'px '+FT;
    c.fillText(s,0,R*.05);
  }
  c.restore();
}

/* ---------- 판 데이터 + 타임라인 (기준 spinMs 3000) ---------- */
let D = { sym:['🍒','🍋','🍊'], out:'miss', rich:false, nick:'', gift:'', no:'001', win:[false,false,false] };
let T = { open:0, spin:520, S0:1350, S1:1850, R:2600, H:2680, end:6980 };
let REELS=[], STEPS=[], K=1;
const OUT = {
  jackpot:{ col:YEL, glow:'255,198,26', head:'JACKPOT!', stamp:'잭팟', en:'JACKPOT', slam:'JACKPOT!', tag:'TRIPLE MATCH', ticker:'*** WIN WIN WIN ***' },
  two:    { col:MINT, glow:'0,203,132', head:'2개 일치!', stamp:'2개', en:'TWO KIND', slam:'2개 일치!', tag:'TWO OF A KIND', ticker:'NICE - 2 MATCH' },
  miss:   { col:'#8a97a8', glow:'138,151,168', head:'결과', stamp:'꽝', en:'MISS', slam:'꽝', tag:'NO MATCH', ticker:'TRY AGAIN' }
};
let OC = OUT.miss;
const PH=[
  {n:'01',ko:'등장',plate:'레버 당김',sub:'전광판에 불이 들어온다'},
  {n:'02',ko:'회전',plate:'회전',sub:'릴이 하나씩 멈춘다'},
  {n:'03',ko:'긴장',plate:'마지막 릴',sub:'느려진다… 멈출까…'},
  {n:'04',ko:'공개'},
  {n:'05',ko:'결과'}
];
function phaseOf(t){ return t<600?0 : t<T.S1?1 : t<T.R?2 : t<T.H+700?3 : 4; }
function phaseRange(i){ return [[0,600],[600,T.S1],[T.S1,T.R],[T.R,T.H+700],[T.H+700,T.end]][i]; }

/* 릴 위치 (칸 단위, 증가하면 심볼이 아래로 흐른다) */
const ACC=200;
function mkReel(st,ds,S,k,target){ // target: 멈출 때의 칸 번호(정수)가 되도록 속도 v 를 맞춘다
  const span=(ds-st-ACC/2)+(S-ds)/k;
  const N=Math.max(8,Math.round(0.028*span));
  return { st,ds,S,k,land:N, v:N/span };
}
function basePos(r,t){
  if(t<r.st) return 0;
  const d=t-r.st;
  if(t<r.ds) return d<ACC ? r.v*d*d/(2*ACC) : r.v*(d-ACC/2);
  const p0=r.v*(r.ds-r.st-ACC/2);
  if(t<r.S){ const u=(t-r.ds)/(r.S-r.ds); return p0+r.v*(r.S-r.ds)*(1-Math.pow(1-u,r.k))/r.k; }
  return r.land;
}
function clunk(d){ return d<0||d>420?0:0.11*Math.sin(d/42)*Math.exp(-d/75); }
function reelPos(i,t){
  const r=REELS[i];
  if(i===2&&D.rich){
    if(t<r.S) return basePos(r,t);
    let p=r.land;
    for(let j=0;j<STEPS.length;j++){
      const s=STEPS[j]; if(t<s.t) break;
      const u=seg(t,s.t,s.t+s.d);
      if(u<1){ const c1=1.3,c3=c1+1; return p+(1+c3*Math.pow(u-1,3)+c1*Math.pow(u-1,2)); }
      p+=1; if(j===STEPS.length-1) return p+clunk(t-(s.t+s.d))*.6;
    }
    return p;
  }
  if(t<r.S) return basePos(r,t);
  return r.land+clunk(t-r.S);
}
function reelSpeed(i,t){ return Math.abs(reelPos(i,t+8)-reelPos(i,t))/8; }
let STRIP=[[],[],[]];

function build(slot){
  const tg=(slot.symbols||[]).slice(0,3).map(norm);
  while(tg.length<3) tg.push(tg[0]||'⭐');
  const jackpot=!!slot.jackpot, two=!jackpot&&!!slot.twoKind;
  const rich=tg[0]!=null&&tg[0]===tg[1];
  const allDef=tg.every(s=>DEFAULTS.indexOf(s)>=0);
  const pool=allDef?DEFAULTS.slice():tg.filter((s,i)=>tg.indexOf(s)===i);
  const pick=(ex,seed)=>{ for(let n=0;n<24;n++){ const s=pool[Math.floor(rnd(seed+n*7.3)*pool.length)]; if(ex.indexOf(s)<0) return s; } return pool[Math.floor(rnd(seed)*pool.length)]; };
  // 타임라인
  T={ open:0, spin:520, S0:1350, S1:1850 };
  REELS=[ mkReel(520,1050,1350,2,0), mkReel(580,1500,1850,2,0) ];
  STEPS=[];
  if(rich){
    const CS=2450;
    REELS.push(mkReel(640,2050,CS,2,0));
    const OFF=[0,150,330,550,820,1180], DUR=[130,135,140,150,165,240];
    OFF.forEach((o,j)=>STEPS.push({t:CS+o,d:DUR[j]}));
    T.R=CS+OFF[5]+DUR[5];
  } else {
    REELS.push(mkReel(640,1850,2600,3.2,0));
    T.R=2600;
  }
  T.H=T.R+80; T.end=T.H+4300;
  // 릴 띠: land 칸(=최종 정지 칸)에 결과 심볼
  const seedBase=(Number(slot.runId)||1)*13.7;
  STRIP=[0,1,2].map(i=>{
    const fin=REELS[i].land+(i===2&&rich?STEPS.length:0);
    const arr=[];
    for(let k=0;k<=fin+3;k++){ const prev=arr[k-1]; arr.push(pick(prev?[prev]:[],seedBase+i*101+k*3.1)); }
    arr[fin]=tg[i];
    const avoid=[tg[i]];
    if(arr[fin-1]===tg[i]) arr[fin-1]=pick(avoid.concat([arr[fin-2]]),seedBase+i*7+1);
    if(arr[fin+1]===tg[i]) arr[fin+1]=pick(avoid.concat([arr[fin+2]]),seedBase+i*7+2);
    if(i===2&&rich){
      const m=tg[0];
      for(let k=fin-STEPS.length-1;k<fin;k++) if(arr[k]===m) arr[k]=pick([m,tg[2]],seedBase+k*5.7);
      if(!jackpot) arr[fin+1]=m;                      // 한 칸 모자라게 멈춤 (니어미스)
      else if(arr[fin+1]===m) arr[fin+1]=pick([m],seedBase+9);
    }
    return { arr, fin };
  });
  const win=[false,false,false];
  if(jackpot) win[0]=win[1]=win[2]=true;
  else if(two){ for(let a=0;a<3;a++) for(let b=a+1;b<3;b++) if(tg[a]===tg[b]){ win[a]=win[b]=true; } }
  let no=1; try{ no=(Number(localStorage.getItem('slotNo'))||0)+1; localStorage.setItem('slotNo',String(no)); }catch(e){ no=1+Math.floor(rnd(Number(slot.runId)||7)*900); }
  const nick=slot.triggeredBy&&slot.triggeredBy!=='weflab'?String(slot.triggeredBy):'스트리머';
  D={ sym:tg, out:jackpot?'jackpot':two?'two':'miss', rich, nick, gift:'', no:String(no).padStart(3,'0'), win, runId:slot.runId };
  OC=OUT[D.out];
  PH[2].ko=rich?'리치':'긴장';
  const ws=Math.max(300,Number(slot.spinMs)||3000);
  K=cl(ws/3000,.4,3);
}
// 실제 경과(ms) → 기준 타임라인: 두 번째 릴 정지까지만 spinMs 배속, 그 뒤(긴장·공개·여운)는 1:1
const toStory=e=>e<T.S1*K?e/K:T.S1+(e-T.S1*K);
const amb=t=>t<T.H?t:T.H+(t-T.H)*.25;   // 여운 구간 슬로모(배경 움직임)

/* ---------- camera ---------- */
function camAt(t){
  let x=-120,y=0,z=1,r=0,sh=0;
  if(t<600){
    const p=seg(t,0,560);
    z=lerp(.8,1,eback(p)); y=lerp(-320,0,eo(p)); r=lerp(-.07,0,eback(p)); x=-120+lerp(-180,0,eo(p));
    if(t>430){ z+=.03*Math.exp(-(t-430)/120); sh=6*Math.exp(-(t-430)/120); }
  } else if(t<T.S1){
    const p=seg(t,600,T.S1);
    z=lerp(1,1.08,eio(p)); x=-120+Math.sin(t*.0009)*6; y=Math.sin(t*.0012)*5;
    const d0=t-T.S0; if(d0>0){ sh+=10*Math.exp(-d0/110); z+=.022*Math.exp(-d0/140); }
  } else if(t<T.R){
    const p=seg(t,T.S1,T.R), d1=t-T.S1;
    sh=12*Math.exp(-d1/110);
    if(D.rich){
      x=lerp(-120,190,eo(seg(t,T.S1,T.S1+650))); y=lerp(0,-8,p);
      z=lerp(1.08,1.56,eio(p))+.03*Math.exp(-d1/140); sh+=1.5+p*5;
      STEPS.forEach(s=>{const d=t-s.t; if(d>0) sh+=9*Math.exp(-d/90);});
    } else {
      x=lerp(-120,150,eio(p)); z=lerp(1.08,1.34,p*p)+.02*Math.exp(-d1/140); sh+=1+p*4;
    }
  } else if(t<T.H){
    const c=camAt(T.R-1); x=c.x; y=c.y; z=c.z*1.06; r=0; sh=26;
  } else {
    const d=t-T.H, q=eio(seg(t,T.H+650,T.H+1300));
    const zb=lerp(1,.9,q)-.025*seg(t,T.H+1300,T.end);
    x=lerp(0,330,q); y=0;
    z=zb*(1+.15*(1-eo(seg(t,T.H,T.H+180))));
    sh=14*Math.exp(-d/120);
    r=.035*Math.exp(-d/200)*Math.cos(d*.03);
    if(D.out==='miss'){ r+=.022*eo(seg(t,T.H+120,T.H+600)); y=-24*eo(seg(t,T.H+120,T.H+600)); }
  }
  const k=Math.floor(t/16);
  return { x:x+(rnd(k)-.5)*2*sh/z, y:y+(rnd(k+977)-.5)*2*sh/z, z, r };
}
function w2s(cam,wx,wy){
  const dx=(wx-cam.x)*cam.z, dy=(wy-cam.y)*cam.z, c=Math.cos(cam.r), s=Math.sin(cam.r);
  return { x:960+dx*c-dy*s, y:540+dx*s+dy*c };
}

/* ---------- LED 도트 (전광판 테두리·마키 전구) ---------- */
let LED=null;
function ledDots(){
  if(LED) return LED;
  const pts=[], g=30, ins=P.b/2;
  const x0=P.x+ins, y0=P.y+ins, x1=P.x+P.w-ins, y1=P.y+P.h-ins;
  for(let x=x0+g;x<x1-g/2;x+=g) pts.push([x,y0]);
  for(let y=y0+g;y<y1-g/2;y+=g) pts.push([x1,y]);
  for(let x=x1-g;x>x0+g/2;x-=g) pts.push([x,y1]);
  for(let y=y1-g;y>y0+g/2;y-=g) pts.push([x0,y]);
  LED=pts; return pts;
}
/** 도트 i 의 [밝기 0..1, 색] — 박자마다 패턴이 다르다 */
function ledState(i,n,t){
  const a=amb(t);
  if(t<600){ const top=Math.floor(n*.17), dd=Math.min(Math.abs(i-top),n-Math.abs(i-top))/(n/2); return [dd<seg(t,80,560)?1:0,CR]; }
  if(t<T.S1) return [((i+Math.floor(a*.012))%6)<2?1:.0,OR];
  if(t<T.R){
    if(D.rich){ const fast=((i+Math.floor(a*.03))%4)<2; return [fast?1:0,(Math.floor(i/6)%2)?RED:YEL]; }
    return [((i+Math.floor(a*.022))%5)<2?1:0,OR];
  }
  if(t<T.H+420) return [1,'#ffffff'];
  if(D.out==='miss') return [i%7===Math.floor(a*.004)%7?.7:0,'#8a97a8'];
  const w=Math.sin(i*.42-a*.02);
  return [w>0?1:.15, D.out==='jackpot'?(w>.6?'#ffffff':(i%2?YEL:OR)):(w>.6?CR:MINT)];
}
function dot(c,x,y,r,b,col){
  c.fillStyle='#1b2536'; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill();
  if(b<=0) return;
  c.globalAlpha=b*.35; c.fillStyle=col; c.beginPath(); c.arc(x,y,r*2.3,0,Math.PI*2); c.fill();
  c.globalAlpha=b; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill();
  c.globalAlpha=b*.9; c.fillStyle='#fff'; c.beginPath(); c.arc(x-r*.3,y-r*.3,r*.35,0,Math.PI*2); c.fill();
  c.globalAlpha=1;
}

/* ---------- machine (world, 중심 0,0) ---------- */
function rr(c,x,y,w,h,r){ c.beginPath(); c.roundRect(x,y,w,h,r); }
function drawReel(c,i,t,cx,dim,focus,glowWin){
  const pos=reelPos(i,t), sp=reelSpeed(i,t), st=STRIP[i];
  const x=cx-REEL_W/2, y=-REEL_H/2;
  c.save(); rr(c,x,y,REEL_W,REEL_H,20); c.clip();
  c.fillStyle=CR; c.fillRect(x,y,REEL_W,REEL_H);
  const base=Math.floor(pos), blur=cl((sp-.004)/.02);
  for(let k=base-2;k<=base+3;k++){
    const sym=st.arr[Math.max(0,Math.min(st.arr.length-1,k))];
    const yy=(pos-k)*CELL;
    if(Math.abs(yy)>REEL_H/2+90) continue;
    c.save(); c.translate(cx,yy);
    if(blur>0){
      c.globalAlpha=.32*blur; c.save(); c.translate(0,-CELL*.22); c.scale(1,1+blur*.6); glyph(c,sym,62); c.restore();
      c.globalAlpha=1-.5*blur; c.scale(1,1+blur*.9);
    }
    glyph(c,sym,62);
    c.restore();
  }
  // 속도선
  if(blur>0){ c.fillStyle='rgba(23,36,55,'+(.18*blur)+')'; for(let q=0;q<7;q++){ const lx=x+20+rnd(q+i*9)*(REEL_W-40); c.fillRect(lx,y,3+rnd(q+3)*4,REEL_H);} }
  // 원통 그림자
  const g=c.createLinearGradient(0,y,0,y+REEL_H);
  g.addColorStop(0,'rgba(23,36,55,.55)'); g.addColorStop(.2,'rgba(23,36,55,0)'); g.addColorStop(.8,'rgba(23,36,55,0)'); g.addColorStop(1,'rgba(23,36,55,.55)');
  c.fillStyle=g; c.fillRect(x,y,REEL_W,REEL_H);
  if(dim>0){ c.fillStyle='rgba(8,14,26,'+dim+')'; c.fillRect(x,y,REEL_W,REEL_H); }
  c.restore();
  // 테두리
  c.lineWidth=8; c.strokeStyle=NAVY; rr(c,x,y,REEL_W,REEL_H,20); c.stroke();
  if(focus>0){ c.lineWidth=10; c.strokeStyle='rgba(255,91,23,'+focus+')'; rr(c,x-9,y-9,REEL_W+18,REEL_H+18,26); c.stroke(); }
  if(glowWin>0){
    c.save(); c.shadowColor=OC.col; c.shadowBlur=40*glowWin; c.lineWidth=12; c.strokeStyle=OC.col; c.globalAlpha=glowWin;
    rr(c,x-10,y-10,REEL_W+20,REEL_H+20,28); c.stroke(); c.restore();
  }
}
function drawMachine(c,t){
  const a=amb(t);
  // 바닥 그림자 + 남색 오프셋 그림자 (원래 슬롯머신 정체성)
  c.fillStyle='rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(0,372,520,40,0,0,Math.PI*2); c.fill();
  c.fillStyle=NAVY; rr(c,-440-26,-330+26,880,660,54); c.fill();
  // 수염 (원래 디자인)
  c.strokeStyle=OR; c.lineWidth=12; c.lineCap='round';
  [[-1],[1]].forEach(([s])=>{ c.beginPath(); c.moveTo(s*512,-60); c.lineTo(s*560,-84); c.moveTo(s*512,0); c.lineTo(s*566,0); c.moveTo(s*512,60); c.lineTo(s*560,84); c.stroke(); });
  // 레버
  const pull=t<380?0:t<520?eo(seg(t,380,520)):1-eo(seg(t,520,900));
  const ky=lerp(-250,40,pull);
  c.fillStyle=CR; c.strokeStyle=NAVY; c.lineWidth=6;
  rr(c,446,-40,40,90,10); c.fill(); c.stroke();
  c.lineWidth=18; c.strokeStyle=NAVY; c.beginPath(); c.moveTo(500,0); c.lineTo(500,ky); c.stroke();
  c.lineWidth=10; c.strokeStyle='#d9d6d0'; c.beginPath(); c.moveTo(500,0); c.lineTo(500,ky); c.stroke();
  c.fillStyle=OR; c.beginPath(); c.arc(500,ky,36,0,Math.PI*2); c.fill(); c.lineWidth=7; c.strokeStyle=NAVY; c.stroke();
  c.fillStyle='rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(488,ky-12,11,7,-.5,0,Math.PI*2); c.fill();
  // 캐비닛
  c.fillStyle=OR; rr(c,-440,-330,880,660,54); c.fill(); c.lineWidth=10; c.strokeStyle=NAVY; c.stroke();
  c.strokeStyle='rgba(255,255,255,.3)'; c.lineWidth=4; rr(c,-424,-314,848,628,42); c.stroke();
  // 마키 (타이틀 + 전구)
  c.fillStyle=CR; rr(c,-380,-308,760,96,26); c.fill(); c.lineWidth=5; c.strokeStyle='#FFC9AE'; c.stroke();
  c.font='64px '+FT; c.textAlign='center'; c.textBaseline='middle'; c.fillStyle=NAVY;
  c.fillText('슬롯머신',0,-256);
  c.fillStyle=OR; c.save(); c.translate(-170,-258); star(c,5,22,10); c.fill(); c.restore(); c.save(); c.translate(170,-258); star(c,5,22,10); c.fill(); c.restore();
  for(let q=0;q<13;q++){ const bx=-330+q*55; const [b,col]=ledState(q*3,40,t); dot(c,bx,-294,6,b,col); dot(c,bx,-222,6,ledState(q*3+1,40,t)[0],col); }
  // 릴 창
  c.fillStyle=NAVY; rr(c,-410,-190,820,380,30); c.fill();
  const ten=t>=T.S1&&t<T.R;
  const resGlow=t>=T.H?(.65+.35*Math.sin(a*.006)):0;
  [0,1,2].forEach(i=>{
    let dim=0, focus=0, gw=0;
    if(ten){
      if(i<2) dim=D.rich?0:.38*seg(t,T.S1,T.S1+300);
      if(i===2) focus=.55+.45*Math.sin(t*.02);
      if(D.rich&&i<2){ let pl=0; STEPS.forEach(s=>{const d=t-s.t; if(d>0) pl+=Math.exp(-d/140);}); gw=Math.min(1,.45+pl*.6); }
    }
    if(t>=T.H){ gw=D.win[i]?resGlow:0; dim=(D.out==='miss'||!D.win[i])?.35*seg(t,T.H+100,T.H+500):0; }
    drawReel(c,i,t,REEL_X[i],dim,focus,gw);
    if(ten&&D.rich&&i<2){ c.save(); c.globalAlpha=.9; c.shadowColor=YEL; c.shadowBlur=30; c.lineWidth=10; c.strokeStyle=YEL; rr(c,REEL_X[i]-REEL_W/2-10,-REEL_H/2-10,REEL_W+20,REEL_H+20,28); c.stroke(); c.restore(); }
  });
  // 페이라인
  const pl=t>=T.H?OC.col:OR;
  c.fillStyle=pl; c.beginPath(); c.moveTo(-404,-22); c.lineTo(-376,0); c.lineTo(-404,22); c.fill(); c.beginPath(); c.moveTo(404,-22); c.lineTo(376,0); c.lineTo(404,22); c.fill();
  if(t>=T.H&&D.out!=='miss'){ c.save(); c.globalAlpha=.85*resGlow; c.fillStyle=OC.col; c.fillRect(-392,-3,784,6); c.restore(); }
  // 하단 LED 티커
  c.fillStyle='#0a0f18'; rr(c,-380,208,760,92,18); c.fill(); c.lineWidth=5; c.strokeStyle=NAVY; c.stroke();
  c.save(); rr(c,-372,214,744,80,14); c.clip();
  c.fillStyle='rgba(255,170,40,.08)'; for(let gx=-372;gx<372;gx+=8) for(let gy=216;gy<294;gy+=8) c.fillRect(gx,gy,4,4);
  let txt, col='#FFB02E';
  if(t<T.S1) txt='BET 1  ·  GOOD LUCK  ·  SPIN!  ·  ';
  else if(t<T.R) txt=D.rich?'REACH!  ·  REACH!  ·  ':'LAST REEL  ·  ';
  else { txt=OC.ticker+'  ·  '; col=D.out==='miss'?'#8a97a8':OC.col; }
  c.font='800 48px '+FM; c.textAlign='left'; c.textBaseline='middle'; c.fillStyle=col;
  const tw=c.measureText(txt).width, spd=t<T.S1?.25:t<T.R?.45:.12;
  const off=-((a*spd)%tw);
  c.shadowColor=col; c.shadowBlur=14;
  for(let q=0;q<4;q++) c.fillText(txt,-372+off+q*tw,256);
  c.restore();
}

/* ---------- 무대 배경 (world) ---------- */
function drawStage(c,t,cam){
  const a=amb(t);
  c.save(); c.setTransform(1,0,0,1,0,0);
  let g=c.createLinearGradient(0,S.y,0,S.y+S.h);
  g.addColorStop(0,'#0a1220'); g.addColorStop(.55,NAVY); g.addColorStop(1,'#0b111c');
  c.fillStyle=g; c.fillRect(S.x,S.y,S.w,S.h);
  // 벽면 LED 격자 (패럴랙스)
  const ox=(-cam.x*.35)%36, oy=(-cam.y*.35)%36;
  c.fillStyle='rgba(245,243,239,.05)';
  for(let x=S.x+ox-36;x<S.x+S.w;x+=36) for(let y=S.y+oy-36;y<S.y+S.h;y+=36) c.fillRect(x,y,4,4);
  c.restore();
  // 회전 선버스트 (진행: 은은 / 여운: 결과색 후광)
  const mc=w2s(cam,0,-20);
  c.save(); c.translate(mc.x,mc.y);
  const res=t>=T.H?eo(seg(t,T.H,T.H+500)):0;
  c.rotate(a*.00045); c.globalCompositeOperation='lighter';
  for(let i=0;i<24;i++){
    const ang=i/24*Math.PI*2, w=.06;
    const al=res>0&&D.out!=='miss' ? (D.out==='jackpot'?.5:.32)*res : (i%2?.035:.06);
    const gr=c.createRadialGradient(0,0,0,0,0,1100);
    gr.addColorStop(0,res>0&&D.out!=='miss'?'rgba('+OC.glow+','+al+')':'rgba(255,91,23,'+al+')'); gr.addColorStop(1,'rgba(255,91,23,0)');
    c.fillStyle=gr; c.beginPath(); c.moveTo(0,0); c.arc(0,0,1100,ang-w,ang+w); c.closePath(); c.fill();
  }
  if(res>0&&D.out!=='miss'){ const gl=c.createRadialGradient(0,0,0,0,0,560); gl.addColorStop(0,'rgba('+OC.glow+','+(.45*res)+')'); gl.addColorStop(1,'rgba('+OC.glow+',0)'); c.fillStyle=gl; c.beginPath(); c.arc(0,0,560,0,Math.PI*2); c.fill(); }
  c.restore();
  // 스포트라이트
  c.save(); c.globalCompositeOperation='lighter';
  [[-1],[1]].forEach(([s])=>{ const top=w2s(cam,s*700,-700), bot=w2s(cam,s*120,380);
    const gr=c.createLinearGradient(top.x,top.y,bot.x,bot.y); gr.addColorStop(0,'rgba(255,236,200,.16)'); gr.addColorStop(1,'rgba(255,236,200,0)');
    c.fillStyle=gr; c.beginPath(); c.moveTo(top.x-40,top.y); c.lineTo(top.x+40,top.y); c.lineTo(bot.x+260*cam.z,bot.y); c.lineTo(bot.x-260*cam.z,bot.y); c.closePath(); c.fill(); });
  c.restore();
  // 여운: 배경 단어
  if(t>=T.H){
    c.save(); c.setTransform(1,0,0,1,0,0);
    const al=eo(seg(t,T.H+150,T.H+700));
    c.globalAlpha=.16*al; c.font='300px '+FT; c.textBaseline='middle'; c.textAlign='left';
    c.strokeStyle=CR; c.lineWidth=3; const off=(t-T.H)*.05;
    c.strokeText(OC.en+'  '+OC.en+'  '+OC.en,S.x+40-off,560); c.restore();
  }
}

/* ---------- screen fx ---------- */
function screenFX(c,t,cam){
  let g=c.createRadialGradient(960,540,420,960,540,1080);
  g.addColorStop(0,'rgba(0,6,14,0)'); g.addColorStop(1,'rgba(0,6,14,.6)');
  c.fillStyle=g; c.fillRect(S.x,S.y,S.w,S.h);
  // 등장: 아래→위 속도선
  if(t<620){ const al=1-seg(t,300,620);
    for(let i=0;i<30;i++){ const x=S.x+rnd(i+11)*S.w, l=200+rnd(i+12)*360, y=S.y+S.h-((t*2.4+rnd(i+13)*900)%1200);
      c.fillStyle='rgba(245,243,239,'+(al*(.15+rnd(i+14)*.35))+')'; c.fillRect(x,y,2+rnd(i+15)*5,l); } }
  // 긴장
  if(t>=T.S1&&t<T.H){
    const p=seg(t,T.S1,T.R);
    let pulse=0; STEPS.forEach(s=>{const d=t-s.t; if(d>0) pulse+=Math.exp(-d/150);});
    const rc=w2s(cam,REEL_X[2],0);
    const og=c.createRadialGradient(rc.x,rc.y,220,rc.x,rc.y,1150);
    og.addColorStop(0,'rgba(255,60,10,0)'); og.addColorStop(1,'rgba(255,60,10,'+Math.min(.55,p*(D.rich?.3:.18)+pulse*.22)+')');
    c.fillStyle=og; c.fillRect(S.x,S.y,S.w,S.h);
    if(t<T.R){
      // 표적 브래킷 (마지막 릴)
      const hw=(REEL_W/2+30)*cam.z, hh=(REEL_H/2+30)*cam.z, L=60*cam.z, k=1+Math.sin(t*.014)*.03-pulse*.04;
      c.save(); c.translate(rc.x,rc.y); c.scale(k,k); c.strokeStyle=OR; c.lineWidth=9; c.lineCap='square';
      [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx,sy])=>{ c.beginPath(); c.moveTo(sx*hw,sy*(hh-L)); c.lineTo(sx*hw,sy*hh); c.lineTo(sx*(hw-L),sy*hh); c.stroke(); });
      c.fillStyle=OR; c.fillRect(-hw,-hh-52,230,44); c.fillStyle=CR; c.font='800 26px '+FM; c.textAlign='left'; c.textBaseline='middle';
      c.fillText(D.rich?'REEL 3 · REACH':'REEL 3 · LAST',-hw+14,-hh-29);
      c.restore();
      if(D.rich){
        // 수렴 집중선
        c.save(); c.translate(rc.x,rc.y); const za=Math.min(1,p*.6+pulse*.5);
        for(let i=0;i<50;i++){ const an=rnd(i+400)*Math.PI*2, r0=380+rnd(i+401)*200+((t*.3)%60), r1=r0+300+rnd(i+402)*500;
          c.strokeStyle='rgba(245,243,239,'+(za*.22)+')'; c.lineWidth=2+rnd(i+403)*4; c.beginPath(); c.moveTo(Math.cos(an)*r0,Math.sin(an)*r0); c.lineTo(Math.cos(an)*r1,Math.sin(an)*r1); c.stroke(); }
        c.restore();
      }
    }
    // 레터박스 (리치만)
    if(D.rich){ const hb=80*eo(seg(t,T.S1,T.S1+380))*(1-seg(t,T.H,T.H+200)); c.fillStyle='#04070c'; c.fillRect(S.x,S.y,S.w,hb); c.fillRect(S.x,S.y+S.h-hb,S.w,hb); }
  }
  // 공개: 히트스톱 플래시 + 방사 쐐기, 이후 감쇠
  if(t>=T.R&&t<T.H+420){
    const fl=Math.pow(1-seg(t,T.R,T.H+260),2);
    const fc=D.out==='miss'?'220,226,235':'255,250,236';
    if(t<T.H){
      c.fillStyle='rgba('+fc+','+(.88*fl)+')'; c.fillRect(S.x,S.y,S.w,S.h);
      c.save(); c.translate(960,520);
      for(let i=0;i<40;i++){ const an=i/40*Math.PI*2+rnd(i)*.1, r0=130, r1=1300;
        c.fillStyle=i%2?(D.out==='miss'?'#5b6b80':OR):NAVY; c.beginPath(); c.moveTo(Math.cos(an-.02)*r0,Math.sin(an-.02)*r0); c.lineTo(Math.cos(an)*r1,Math.sin(an)*r1); c.lineTo(Math.cos(an+.03)*r0,Math.sin(an+.03)*r0); c.fill(); }
      c.restore();
    } else { c.fillStyle='rgba('+fc+','+(.8*fl)+')'; c.fillRect(S.x,S.y,S.w,S.h); }
  }
  // 여운: 동전 비 (잭팟 많이, 2개 조금)
  if(t>=T.H&&D.out!=='miss'){
    const n=D.out==='jackpot'?48:14;
    for(let i=0;i<n;i++){
      const t0=T.H+60+i*(D.out==='jackpot'?28:70), d=(t-t0)/1000; if(d<0) continue;
      const x=S.x+60+rnd(i+700)*(S.w*.62), y=S.y-40+d*(260+rnd(i+701)*240)+d*d*420, r=18+rnd(i+702)*12;
      if(y>S.y+S.h+40) continue;
      const sx=Math.abs(Math.cos(t*.008+i));
      c.save(); c.translate(x,y); c.scale(Math.max(.15,sx),1);
      c.fillStyle=D.out==='jackpot'?YEL:MINT; c.beginPath(); c.arc(0,0,r,0,Math.PI*2); c.fill(); c.lineWidth=4; c.strokeStyle=NAVY; c.stroke();
      c.fillStyle='rgba(255,255,255,.65)'; star(c,5,r*.5,r*.22); c.fill();
      c.restore();
    }
  }
}

/* ---------- HUD (흔들리지 않음) ---------- */
function hud(c,t){
  // 좌상단 게임 태그 + 전광판 표기
  c.save(); c.textBaseline='middle';
  c.fillStyle=OR; c.fillRect(S.x+24,S.y+22,118,48); c.fillStyle=NAVY; c.font='34px '+FT; c.textAlign='center'; c.fillText('SLOT',S.x+83,S.y+47);
  c.fillStyle='rgba(10,16,26,.75)'; c.fillRect(S.x+142,S.y+22,250,48);
  c.fillStyle=CR; c.font='800 20px '+FM; c.textAlign='left'; c.fillText('CASINO BOARD · 07',S.x+158,S.y+47);
  c.fillStyle=MINT; c.font='700 18px '+FM; c.fillText('BET ×1   LINE 1',S.x+28,S.y+92);
  if(t>=T.H&&Math.floor(t/400)%2===0){ c.fillStyle=OR; c.font='800 22px '+FM; c.fillText('▶ SLOW ×0.25',S.x+28,S.y+122); }
  // 단계 칩
  const idx=phaseOf(t), pw=142, gap=10, total=5*pw+4*gap, sx=960-total/2;
  for(let i=0;i<5;i++){
    const x=sx+i*(pw+gap), y=S.y+24, act=i===idx, done=i<idx;
    c.fillStyle=act?OR:done?'rgba(245,243,239,.85)':'rgba(10,18,28,.6)'; c.fillRect(x,y,pw,40);
    if(!act&&!done){ c.strokeStyle='rgba(245,243,239,.4)'; c.lineWidth=2; c.strokeRect(x+1,y+1,pw-2,38); }
    if(act){ const rg=phaseRange(i), pr=seg(t,rg[0],rg[1]); c.fillStyle='rgba(23,36,55,.35)'; c.fillRect(x,y+34,pw*pr,6); }
    c.fillStyle=act?CR:done?NAVY:'rgba(245,243,239,.7)'; c.font='700 21px '+FK; c.textAlign='center';
    c.fillText(PH[i].n+' '+PH[i].ko,x+pw/2,y+21);
  }
  // 우상단 잭팟 카운터 (LED 숫자)
  const bx=S.x+S.w-404, by=S.y+18;
  const jp=t>=T.H&&D.out==='jackpot';
  c.fillStyle='#05080e'; c.fillRect(bx,by,380,78); c.lineWidth=3; c.strokeStyle=jp?YEL:'rgba(255,176,46,.5)'; c.strokeRect(bx,by,380,78);
  c.fillStyle=jp?YEL:'rgba(245,243,239,.7)'; c.font='800 16px '+FM; c.textAlign='left'; c.fillText('JACKPOT POOL',bx+14,by+16);
  const v=2480000+Math.floor(amb(t)*1.7)+(jp?Math.floor((t-T.H)*41):0);
  const sv=String(v).padStart(8,'0');
  c.font='800 46px '+FM; c.textAlign='right';
  c.fillStyle='rgba(255,176,46,.12)'; c.fillText('88888888',bx+366,by+50);
  c.fillStyle=jp?'#FFE27A':'#FFB02E'; c.shadowColor='#FF8A00'; c.shadowBlur=jp?22:12; c.fillText(sv,bx+366,by+50);
  c.restore();
}

/* ---------- typography ---------- */
function outlined(c,txt,x,y,fill,stroke,sw,outer,ow){
  c.lineJoin='round';
  if(outer){ c.strokeStyle=outer; c.lineWidth=ow; c.strokeText(txt,x,y); }
  c.strokeStyle=stroke; c.lineWidth=sw; c.strokeText(txt,x,y);
  c.fillStyle=fill; c.fillText(txt,x,y);
}
function chapter(c,t){
  const i=phaseOf(t); if(i>2||(i===2&&D.rich)) return;
  const ph=PH[i], rg=phaseRange(i);
  const inn=eo(seg(t,rg[0]+(i===0?250:0),rg[0]+(i===0?560:320))), out=seg(t,rg[1]-60,rg[1]);
  if(inn<=0||out>=1) return;
  const x=S.x+10, y=S.y+S.h-200;
  c.save(); c.textBaseline='middle'; c.textAlign='left';
  c.font='84px '+FT; const tw=c.measureText(ph.plate).width;
  const bw=(tw+70)*inn*(1-ei(out));
  const nd=(1-eback(cl(inn)))*-120;
  c.fillStyle=OR; c.fillRect(x,y+nd,124,124); c.fillStyle=NAVY; c.font='76px '+FT; c.fillText(ph.n,x+14,y+66+nd);
  c.save(); c.beginPath(); c.rect(x+124,y,bw,124); c.clip();
  c.fillStyle=i===2?'#2a0f0a':NAVY; c.fillRect(x+124,y,tw+70,124);
  const jx=i===2?(rnd(Math.floor(t/30))-.5)*8:0;
  c.font='84px '+FT; c.fillStyle=CR; c.fillText(ph.plate,x+158+jx,y+66);
  c.restore();
  c.globalAlpha=inn*(1-out);
  c.fillStyle=CR; c.font='800 20px '+FM; c.fillText('CH.'+ph.n+' / '+['OPEN','SPIN','TENSION'][i],x+4,y-20);
  c.font='700 32px '+FK; c.lineWidth=8; c.strokeStyle='rgba(4,10,18,.85)'; c.lineJoin='round';
  c.strokeText(ph.sub,x+16,y+160); c.fillStyle=CR; c.fillText(ph.sub,x+16,y+160);
  c.restore();
}
function reachText(c,t){
  if(!D.rich||t<T.S1||t>=T.R+60) return;
  let pop=0; STEPS.forEach((s,i)=>{const d=t-s.t; if(d>0) pop+=(.16+i*.04)*Math.exp(-d/110);});
  const p=seg(t,T.S1,T.S1+220), s=lerp(2.4,1,eback(p))*(1+pop*.5), a=1-seg(t,T.R,T.R+60);
  const k=Math.floor(t/26), j=4+pop*18+seg(t,T.S1,T.R)*6;
  c.save(); c.globalAlpha=a; c.translate(560+(rnd(k)-.5)*j,330+(rnd(k+5)-.5)*j); c.rotate(-.09); c.scale(s,s);
  c.textAlign='center'; c.textBaseline='middle'; c.font='200px '+FT;
  c.fillStyle=NAVY; c.fillText('리치!',12,14);
  outlined(c,'리치!',0,0,OR,NAVY,22,CR,36);
  c.font='800 30px '+FM; c.fillStyle=CR; c.strokeStyle=NAVY; c.lineWidth=8;
  const lab='REACH · 앞 두 릴 일치'; c.strokeText(lab,0,124); c.fillText(lab,0,124);
  c.restore();
}
function slam(c,t){
  if(t<T.R+20||t>T.H+980) return;
  const p=seg(t,T.H-40,T.H+200), s=lerp(1.9,1,eback(p))*(1+seg(t,T.H+200,T.H+900)*.06), a=1-seg(t,T.H+820,T.H+980);
  const rot=lerp(-.105,0,eback(p));
  c.save(); c.globalAlpha=a; c.translate(960,430); c.rotate(rot);
  if(D.out!=='miss'){
    c.save(); c.rotate(Math.sin(t*.004)*.05); c.scale(s*.95,s*.95);
    c.fillStyle=CR; c.beginPath();
    for(let i=0;i<36;i++){ const r=i%2?300:450+rnd(i)*90, an=i/36*Math.PI*2; i?c.lineTo(Math.cos(an)*r*1.4,Math.sin(an)*r*.78):c.moveTo(Math.cos(an)*r*1.4,Math.sin(an)*r*.78); }
    c.closePath(); c.fill(); c.strokeStyle=NAVY; c.lineWidth=8; c.stroke(); c.restore();
  } else {
    c.save(); c.scale(s,s); c.fillStyle='rgba(23,36,55,.85)'; c.beginPath();
    for(let i=0;i<14;i++){ const r=i%2?150:230+rnd(i+30)*50, an=i/14*Math.PI*2; i?c.lineTo(Math.cos(an)*r*1.2,Math.sin(an)*r):c.moveTo(Math.cos(an)*r*1.2,Math.sin(an)*r); }
    c.closePath(); c.fill(); c.restore();
  }
  c.scale(s,s); c.textAlign='center'; c.textBaseline='middle';
  const big=D.out==='miss'?320:D.out==='two'?220:230;
  c.font=big+'px '+FT;
  const fill=D.out==='jackpot'?YEL:D.out==='two'?MINT:CR;
  const shadow=D.out==='jackpot'?OR:D.out==='two'?NAVY:'#5b6b80';
  c.fillStyle=shadow; c.fillText(OC.slam,12,16);
  outlined(c,OC.slam,0,0,fill,NAVY,22,D.out==='miss'?null:CR,D.out==='miss'?0:34);
  c.font='800 38px '+FM; c.fillStyle=D.out==='miss'?CR:NAVY; c.fillText(OC.tag,0,big*.62);
  c.restore();
}
function balloonIcon(c,x,y,r){
  c.save(); c.translate(x,y);
  c.fillStyle=CR; c.beginPath(); c.arc(0,0,r,0,Math.PI*2); c.fill();
  c.fillStyle=OR; star(c,5,r*.78,r*.38); c.fill(); c.restore();
}
function resultCard(c,t){
  const c0=T.H+850; if(t<c0) return;
  const x0=1120,y0=214,w=690,h=650;
  const inP=seg(t,c0,c0+420), ox=(1-eback(inP))*900;
  c.save(); c.translate(ox,0);
  if(inP<1){ c.fillStyle='rgba(245,243,239,'+(.6*(1-inP))+')'; for(let i=0;i<8;i++) c.fillRect(x0+w+20+rnd(i)*200,y0+40+i*75,300+rnd(i+3)*300,6); }
  c.transform(1,0,-.14,1,0,0); c.translate(y0*.14+56,0);   // skewX(-8°)
  c.fillStyle='rgba(0,0,0,.45)'; c.fillRect(x0+18,y0+22,w,h);
  c.fillStyle=CR; c.fillRect(x0,y0,w,h);
  c.fillStyle=OR; c.fillRect(x0,y0,18,h);
  c.fillStyle=NAVY; c.fillRect(x0+18,y0,w-18,96);
  c.textBaseline='middle'; c.textAlign='left';
  c.fillStyle=D.out==='jackpot'?YEL:D.out==='two'?MINT:OR; c.font='64px '+FT; c.fillText(OC.head,x0+50,y0+52);
  c.fillStyle='rgba(245,243,239,.75)'; c.font='700 22px '+FM; c.fillText('SPIN #'+D.no,x0+400,y0+52);
  // 1) 이름: 심볼 3칸 + 결과명
  const np=seg(t,c0+300,c0+540), ns=lerp(1.9,1,eback(np));
  if(np>0){
    c.save(); c.globalAlpha=Math.min(1,np*3); c.translate(x0+50,y0+120); c.scale(ns,ns);
    for(let i=0;i<3;i++){
      const tx=i*120; c.fillStyle='#fff'; c.fillRect(tx,0,104,104); c.lineWidth=6; c.strokeStyle=D.win[i]?OC.col:'rgba(23,36,55,.3)'; c.strokeRect(tx,0,104,104);
      c.save(); c.translate(tx+52,52); glyph(c,D.sym[i],38); c.restore();
      if(!D.win[i]&&D.out!=='miss'){ c.fillStyle='rgba(245,243,239,.55)'; c.fillRect(tx,0,104,104); }
    }
    const nm=D.out==='jackpot'?symName(D.sym[0])+' ×3':D.out==='two'?symName(D.sym[D.win.indexOf(true)])+' ×2':'꽝';
    c.font='96px '+FT; c.textBaseline='middle';
    { const mw=c.measureText(nm).width, fit=Math.min(1,(w-330)/Math.max(1,mw)); c.save(); c.translate(0,186); c.scale(fit,fit);
      c.fillStyle=D.out==='miss'?'#8a97a8':OC.col; c.fillText(nm,7,8); c.fillStyle=NAVY; c.fillText(nm,0,0); c.restore(); }
    c.restore();
  }
  c.strokeStyle='rgba(23,36,55,.25)'; c.lineWidth=3; c.setLineDash([10,10]);
  c.beginPath(); c.moveTo(x0+50,y0+380); c.lineTo(x0+w-40,y0+380); c.stroke(); c.setLineDash([]);
  // 3) 닉네임
  const cp=eo(seg(t,c0+700,c0+1000));
  c.save(); c.globalAlpha=cp; c.translate((1-cp)*80,0);
  c.fillStyle='rgba(23,36,55,.6)'; c.font='700 28px '+FK; c.fillText('돌린 사람',x0+56,y0+420);
  c.fillStyle=NAVY; c.font='900 84px '+FK; { const mw=c.measureText(D.nick).width; if(mw>w-110) c.font='900 '+Math.max(40,Math.floor(84*(w-110)/mw))+'px '+FK; } c.fillText(D.nick,x0+52,y0+484);
  c.restore();
  // 4) 별풍선
  const gp=seg(t,c0+900,c0+1160), gs=lerp(.4,1,eback(gp));
  if(gp>0&&D.gift){
    c.save(); c.translate(x0+56,y0+584); c.scale(gs,gs); c.globalAlpha=Math.min(1,gp*2);
    c.fillStyle=OR; c.beginPath(); c.roundRect(0,-40,420,80,40); c.fill();
    balloonIcon(c,42,0,28);
    c.fillStyle=CR; c.font='900 44px '+FK; c.fillText(D.gift,86,2);
    c.restore();
  }
  // 2) 도장
  const bp=seg(t,c0+500,c0+740);
  if(bp>0){
    const bs=lerp(3,1,eback(bp)), sc=D.out==='jackpot'?OR:D.out==='two'?MINT:'#5b6b80';
    c.save(); c.translate(x0+w-150,y0+250); c.rotate(-.2); c.scale(bs,bs); c.globalAlpha=Math.min(1,bp*2.5);
    if(bp<1){ c.strokeStyle=sc; c.lineWidth=6; for(let i=0;i<12;i++){ const an=i/12*Math.PI*2; c.beginPath(); c.moveTo(Math.cos(an)*124,Math.sin(an)*124); c.lineTo(Math.cos(an)*(144+bp*60),Math.sin(an)*(144+bp*60)); c.stroke(); } }
    c.fillStyle=NAVY; c.beginPath(); c.arc(6,8,106,0,Math.PI*2); c.fill();
    c.fillStyle=sc; c.beginPath(); c.arc(0,0,106,0,Math.PI*2); c.fill();
    c.strokeStyle=CR; c.lineWidth=5; c.beginPath(); c.arc(0,0,90,0,Math.PI*2); c.stroke();
    c.textAlign='center'; c.fillStyle=CR; c.font='78px '+FT; c.fillText(OC.stamp,0,-6);
    c.font='800 19px '+FM; c.fillText(OC.en,0,54);
    c.restore();
  }
  c.restore();
}

/* ---------- render ---------- */
function bezel(c,py,ph){
  c.beginPath(); c.roundRect(P.x,py,P.w,ph,30);
}
function render(t){
  X.setTransform(1,0,0,1,0,0); X.clearRect(0,0,W,H_);
  if(t>=T.end+420) return;
  X.save(); X.globalAlpha=1-seg(t,T.end,T.end+400);
  const wt=(t>=T.R&&t<T.H)?T.R:t;      // 히트스톱: 80ms 동안 세계 정지
  const cam=camAt(t);
  const rv=eo(seg(t,0,420)), ph=Math.max(6,P.h*rv), py=P.y+(P.h-ph)/2;
  // 베젤
  X.save(); X.shadowColor='rgba(0,0,0,.55)'; X.shadowBlur=50; X.shadowOffsetY=14;
  bezel(X,py,ph); X.fillStyle='#0b1320'; X.fill(); X.restore();
  X.lineWidth=5; X.strokeStyle=OR; bezel(X,py,ph); X.stroke();
  // 화면
  X.save(); X.beginPath(); X.rect(S.x,Math.max(S.y,py+P.b),S.w,Math.max(0,ph-P.b*2)); X.clip();
  drawStage(X,wt,cam);
  X.save(); X.translate(960,540); X.rotate(cam.r); X.scale(cam.z,cam.z); X.translate(-cam.x,-cam.y);
  drawMachine(X,wt);
  X.restore();
  screenFX(X,t,cam);
  X.restore();
  // LED 테두리
  const pts=ledDots();
  pts.forEach((q,i)=>{ if(q[1]<py-2||q[1]>py+ph+2) return; const st=ledState(i,pts.length,t); dot(X,q[0],q[1],5.5,st[0],st[1]); });
  if(rv>=1){
    hud(X,t);
    chapter(X,t);
    reachText(X,t);
    slam(X,t);
    resultCard(X,t);
  }
  X.restore();
}

/* ---------- 재생 / 효과음 박자 ---------- */
let start=0, playing=false, paused=false, cues={};
function cue(t){
  if(!window.FX) return;
  const at=(k,ms,fn)=>{ if(t>=ms&&!cues[k]){ cues[k]=1; fn(); } };
  at('open',0,()=>FX.sound('whoosh'));
  at('lever',440,()=>FX.sound('pop'));
  at('spin',T.spin,()=>FX.spinStart());
  at('s0',T.S0,()=>FX.sound('stop'));
  at('s1',T.S1,()=>{ FX.sound('stop'); FX.drumStart(D.rich?190:130); if(D.rich) FX.sound('reveal'); });
  STEPS.forEach((s,i)=>at('step'+i,s.t,()=>FX.sound('tick')));
  at('impact',T.R,()=>{ FX.drumStop(); FX.spinStop(); FX.sound('stop');
    FX.flash(D.out==='jackpot'?'rgba(255,200,40,.7)':D.out==='two'?'rgba(255,250,236,.45)':'rgba(220,226,235,.3)'); });
  at('result',T.H+60,()=>{
    if(D.out==='jackpot'){ FX.sound('jackpot'); FX.confetti({count:220,x:640,y:300,colors:['#FFC928','#FF5B17','#fff','#FFE49A']}); }
    else if(D.out==='two'){ FX.sound('win'); FX.confetti({count:90,x:640,y:320,colors:['#00CB84','#F5F3EF','#FFC928']}); }
    else FX.sound('lose');
  });
  at('stamp',T.H+850+500,()=>FX.sound('stop'));
  at('banner',T.H+2100,()=>FX.winner({
    nick:D.nick, sub:D.out==='jackpot'?'잭팟!':D.out==='two'?'2개 일치':'슬롯 결과',
    anchor:document.getElementById('anchor'), above:true, ms:Math.max(1500,T.end-(T.H+2100)) }));
}
function stopAll(){ playing=false; X.setTransform(1,0,0,1,0,0); X.clearRect(0,0,W,H_); if(window.FX){ FX.drumStop(); FX.spinStop(); FX.hideWinner(); } }
function loop(now){
  if(playing&&!paused){ const t=toStory(now-start); cue(t); render(t); if(t>T.end+500) stopAll(); }
  requestAnimationFrame(loop);
}
let lastRunId=null;
window.startSlot=slot=>{
  // 같은 판(runId)이 다시 오면 무시, 다른 판이면 진행 중 연출을 끊고 새로 시작
  if(slot.runId!==undefined&&slot.runId===lastRunId) return;
  lastRunId=slot.runId===undefined?null:slot.runId;
  if(window.FX){ FX.drumStop(); FX.spinStop(); FX.hideWinner(); }
  build(slot);
  cues={}; paused=false; playing=true; start=performance.now();
};
window.setSlotBalloon=(runId,b)=>{ if(runId!==undefined&&runId!==D.runId) return; D.gift=Number(b)>0?'별풍선 '+Number(b).toLocaleString()+'개':''; };
/** 기준 타임라인(ms) 위치를 정지 화면으로 그린다 (미리보기·캡처용) */
window.seek=ms=>{ paused=true; render(ms); };
window.slotTimeline=()=>Object.assign({},T,{steps:STEPS.map(s=>s.t)});
if(document.fonts&&document.fonts.load){
  Promise.all([document.fonts.load('100px '+FT),document.fonts.load('900 40px '+FK),document.fonts.load('700 40px '+FK),document.fonts.load('800 20px '+FM)]).catch(()=>{});
}
requestAnimationFrame(loop);
})();
<\/script>
<script>
function connect() {
  const ws = new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage = e => {
    try {
      const msg = JSON.parse(e.data)
      FX.handle(msg)
      if (msg.type === 'game:state' && msg.data?.id === 'slot' && msg.data?.status === 'running' && msg.data.slot?.symbols)
        window.startSlot(msg.data.slot)
      if (msg.type === 'game:state' && msg.data?.id === 'slot' && msg.data?.status === 'showing_result' && msg.data.result)
        window.setSlotBalloon(msg.data.slot?.runId, msg.data.result.balloon)
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
