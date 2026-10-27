// OBS 오버레이 페이지: race — 'TV 경마 중계' 연출 (출전 게이트 → 질주 트래킹 → 막판 슬로모션 → 사진 판정 → 시상)
// 모션 언어: .inhabited/motion-language.md (기준: fish.ts '수중 다큐 카메라'). 캔버스 1장 + 타임라인 렌더 + 카메라 리그.
// 엔진 state.race(RaceState: racers, bets, deadline, joinMs, command, raceMs, startedAt, curves, order) 를 그대로 받는다.
//  - 화면: 측면 트래킹 카메라(원근 2.5D). 깊이(d)별 시차 — 하늘·조명탑 / 관중석 / 안쪽 난간 / 잔디 줄무늬 / 주자 / 바깥 난간(전경)
//  - 주자 위치는 엔진과 같은 식(raceProgress)으로 계산. 연출용 시간축만 1착 도착 직전 1.3초를 0.4배로 늘이고
//    그만큼 앞 구간을 빠르게 돌려서, 1착 도착 시각(실제 ms)은 엔진과 정확히 같다 → 순위·도착 순서 불변
//  - 1착 도착 = 히트스톱 80ms → 사진 판정 정지 컷(슬릿 스캔 흑백 + 세로 판정선 + 시간 눈금) + '1착!' 슬램 → 라이브 복귀
//  - 결과(raceMs+600, 엔진 결과 시점) 부터 여운: 시상대 + 사선 결과 카드(이름 → 도장 → 적중자 → 별풍선) + 배너
//  - startedAt / deadline 기준이라 OBS 새로고침으로 중간에 들어와도 이어서 재생, 새 판이 오면 이전 판은 끊는다
//  - setInterval/setTimeout 없이 rAF 한 개. 레이아웃은 전부 고정 좌표 (DOM 측정 없음)
import { FX_SCRIPT } from './_fx'

export const RACE_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>경마 중계</title>
<meta name="viewport" content="width=1920">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@500;700;900&family=JetBrains+Mono:wght@500;700;800&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;padding:0;background:transparent !important;overflow:hidden;width:1920px;height:1080px}
  canvas{display:block;width:1920px;height:1080px}
  #anchor{position:fixed;left:250px;top:996px;width:740px;height:1px;pointer-events:none}
</style>
</head>
<body>
<canvas id="c" width="1920" height="1080"></canvas>
<div id="anchor"></div>
<script>${FX_SCRIPT}<\/script>
<script>
(function(){
var C=document.getElementById('c'), X=C.getContext('2d'), W=1920, H=1080;
var NAVY='#172437', OR='#FF5B17', CR='#F5F3EF', MINT='#00CB84', GOLD='#FFC61A', RED='#E0342C';
var FT='"Black Han Sans","Noto Sans KR",sans-serif', FK='"Noto Sans KR","Apple SD Gothic Neo",sans-serif', FM='"JetBrains Mono",ui-monospace,Menlo,monospace';
var P={x:140,y:100,w:1640,h:870,k:52};
var SILK=['#FF5B17','#00CB84','#FFC61A','#4F6BFF','#E0342C','#B455E0','#F5F3EF','#2AB3D6'];
var SILK2=['#F5F3EF','#172437','#172437','#FFC61A','#F5F3EF','#FFC61A','#FF5B17','#F5F3EF'];
var COAT=['#9a5b36','#6e4127','#b9b2a8','#3a2a22','#a8743f','#5b4636','#c9c0b4','#7d4a2e'];
/* 월드: x = 주로 방향(오른쪽이 결승), d = 카메라에서 멀어지는 깊이. Z=(1000+d)/1000 로 원근 */
var CX=960, HY=223, HC=641, BASE=1.62, NOSEW=124*1.62, FIN=5600, X0=0, GX=X0+124*1.62+46, TRACKM=1200;
var D_NEAR=-210, D_FAR=730, D_STAND=1500, STRIDE=430;
var CAM={x:0,z:1,fy:640,ty:640,r:0,ox:0,sx:0,sy:0}, VX0=0, VX1=W;

/* ---------- helpers ---------- */
function cl(v,a,b){ if(a===undefined)a=0; if(b===undefined)b=1; return Math.max(a,Math.min(b,v)); }
function lerp(a,b,p){ return a+(b-a)*p; }
function seg(t,a,b){ return cl((t-a)/(b-a)); }
function eo(p){ return 1-Math.pow(1-p,3); }
function ei(p){ return p*p*p; }
function eio(p){ return p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2; }
function eback(p){ var c1=2.0,c3=c1+1; return 1+c3*Math.pow(p-1,3)+c1*Math.pow(p-1,2); }
function rnd(i){ var x=Math.sin(i*127.1+311.7)*43758.5453; return x-Math.floor(x); }
function hx(h){ h=h.replace('#',''); return [parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16)]; }
function mix(a,b,t){ if(t<=0) return a; var A=hx(a),B=hx(b); return 'rgb('+Math.round(lerp(A[0],B[0],t))+','+Math.round(lerp(A[1],B[1],t))+','+Math.round(lerp(A[2],B[2],t))+')'; }
function clean(s){ return String(s==null?'':s).replace(/\\p{Extended_Pictographic}/gu,'').replace(/\\uFE0F/g,'').trim(); }
function fmtT(ms){ ms=Math.max(0,ms); var s=Math.floor(ms/1000), cs=Math.floor(ms%1000/10); return (s<10?'0':'')+s+'.'+(cs<10?'0':'')+cs; }
function fitFont(c,txt,weight,size,max,fam,min){ c.font=weight+size+'px '+fam; var w=c.measureText(txt).width; if(w>max){ size=Math.max(min||12,Math.floor(size*max/w)); c.font=weight+size+'px '+fam; } return size; }
function line(c,a,b,x,y){ c.beginPath(); c.moveTo(a,b); c.lineTo(x,y); c.stroke(); }
function Zd(d){ return (1000+d)/1000; }
function PX(wx,Z){ return CX+(wx-CAM.x)/Z; }
function PY(Z,h){ return HY+(HC-(h||0))/Z; }
function wx0(Z){ return CAM.x+(VX0-CX)*Z; }
function wx1(Z){ return CAM.x+(VX1-CX)*Z; }

/* ---------- state ---------- */
var MODE='none', R=null, KEY=null, TL=null, paused=false, seekT=0, cues={}, openAt=0;
var counts=[], bump=[], lastTotal=-1, lastSec=-1, BAL=0, NO='001', resultSeen=false;
var dispPos=[], lastFrame=0, camPrev=null, camVel=0;

// 엔진(raceProgress)과 같은 식
function progress(c,t){
  if(t>=c.finish) return 1;
  var u=Math.max(0,t/c.finish);
  var w=c.amp*Math.sin(2*Math.PI*c.freq*u+c.phase)*u*(1-u)*4;
  return Math.min(0.995,Math.max(0,u+w));
}
function N(){ return R?R.racers.length:0; }
function laneSp(){ return Math.min(92,560/Math.max(1,N()-1)); }
function laneD(i){ return 340+((N()-1)/2-i)*laneSp(); }
function laneZ(i){ return Zd(laneD(i)); }
function nameOf(i){ var r=R.racers[i]||{}; return clean(r.name)||String(r.name||'')||(i+1)+'번'; }

function buildRun(){
  var Rms=Number(R.raceMs)||8000;
  var arr=R.curves.map(function(c){ return c.finish*Rms; });
  var F=Math.min.apply(null,arr);
  var A=Math.max(F*0.55,F-1300);
  var order=R.order&&R.order.length?R.order.slice():arr.map(function(v,i){return i;}).sort(function(a,b){return arr[a]-arr[b];});
  var win=order[0];
  var hits=Object.keys(R.bets||{}).filter(function(u){ return R.bets[u]===win; });
  var v=arr.map(function(a){ return (FIN-X0-NOSEW)/Math.max(1,a); });
  var c1=Math.max(1500,A*.42), c2=Math.max(c1+700,A*.7);
  TL={R:Rms,F:F,A:A,SF:0.4,HIT:F+80,PHO:F+1050,RES:Rms+600,END:Rms+600+8000,arr:arr,order:order,win:win,hits:hits,betN:Object.keys(R.bets||{}).length,v:v,c1:c1,c2:c2};
  TL.closeIdx=null;
}
/* 연출 시간축: 1착 도착 직전 구간만 느리게 (도착 시각은 그대로) */
function story(t){
  if(t>=TL.F) return t;
  var s0=TL.F-TL.SF*(TL.F-TL.A);
  if(t<TL.A) return t*s0/TL.A;
  return s0+(t-TL.A)*TL.SF;
}
function worldS(t){ if(t>=TL.F&&t<TL.PHO) return TL.F; if(t>=TL.RES) return TL.RES+(t-TL.RES)*0.25; return story(t); }
function runnerX(i,s){
  if(!TL) return X0;
  var a=TL.arr[i];
  if(s>=a) return FIN-NOSEW+TL.v[i]*1500*(1-Math.exp(-(s-a)/1500));
  var p=progress(R.curves[i],Math.max(0,s)/TL.R);
  return X0+p*(FIN-X0-NOSEW);
}
function noseX(i,s){ return runnerX(i,s)+NOSEW; }
function speedOf(i,s){ return (runnerX(i,s+30)-runnerX(i,Math.max(0,s-30)))/(s>30?60:30+s); }
function leaderX(s){ var m=-1e9; for(var i=0;i<N();i++) m=Math.max(m,runnerX(i,s)); return m; }
function packMid(s){ var a=0; for(var i=0;i<N();i++) a+=runnerX(i,s); return a/Math.max(1,N()); }
function spreadOf(s,ids){ var lo=1e9,hi=-1e9; ids.forEach(function(i){ var x=runnerX(i,s); lo=Math.min(lo,x); hi=Math.max(hi,x); }); return hi-lo; }
function allIdx(){ var a=[]; for(var i=0;i<N();i++) a.push(i); return a; }
function ranking(s){
  return allIdx().sort(function(a,b){
    var fa=s>=TL.arr[a], fb=s>=TL.arr[b];
    if(fa&&fb) return TL.arr[a]-TL.arr[b];
    if(fa) return -1; if(fb) return 1;
    return runnerX(b,s)-runnerX(a,s);
  });
}

/* ---------- camera ---------- */
function mk(x,z,fy,ty,r,ox){ return {x:x,z:z,fy:fy,ty:ty,r:r||0,ox:ox||0,sx:0,sy:0}; }
function blendCam(a,b,p){ return mk(lerp(a.x,b.x,p),lerp(a.z,b.z,p),lerp(a.fy,b.fy,p),lerp(a.ty,b.ty,p),lerp(a.r,b.r,p),lerp(a.ox,b.ox,p)); }
function shake(c,t,sh){ var k=Math.floor(t/16); c.sx=(rnd(k)-.5)*2*sh; c.sy=(rnd(k+977)-.5)*2*sh; return c; }
function camGate(t){ var o=eo(seg(t,0,1100)); return mk(GX+lerp(660,330,o),lerp(.88,1.0,o)+Math.sin(t*.0007)*.006,640,lerp(680,640,o)+Math.sin(t*.0011)*4,lerp(-.03,0,o)); }
function camCollect(t){
  var c=camGate(t), left=R.joinMs-t, sh=0;
  if(left<5000&&left>0){ var ph=(5000-left)%1000; sh=1.5+(1-ph/1000)*6*(1-left/5000+.3); c.z+=.05*(1-left/5000); }
  return shake(c,t,sh);
}
function shotWide(t,s){
  var L=leaderX(s), m=packMid(s), sp=spreadOf(s,allIdx());
  return mk(lerp(m,L,.62)+NOSEW*.5+40, cl(1900/(sp+1300),.8,1.04), 640, 640, 0);
}
function shotClose(t,s){
  if(TL.closeIdx==null) TL.closeIdx=ranking(worldS(TL.c1))[0];
  var i=TL.closeIdx, Z=laneZ(i), d=seg(t,TL.c1,TL.c2);
  return mk(runnerX(i,s)+lerp(150,40,d)*Z, lerp(1.42,1.5,d), PY(Z,150), 560, .012);
}
function shotSide(t,s){
  var L=leaderX(s), d=seg(t,TL.c2,TL.A);
  return mk(L+NOSEW-lerp(260,120,d), lerp(1.0,1.08,d), 640, 640, 0);
}
function shotTension(t,s){
  var top=TL.order.slice(0,Math.min(3,N())), m=0, zs=0;
  top.forEach(function(i){ m+=runnerX(i,s); zs+=laneZ(i); }); m/=top.length; zs/=top.length;
  var sp=spreadOf(s,top);
  return mk(m+NOSEW*.5+60, cl(1350/(sp+700),1.12,1.58), PY(zs,140), 575, -.022);
}
function camRun(t){
  var c, sh=0, s=worldS(t);
  if(t<TL.c1){
    var p=eio(seg(t,120,1500));
    c=blendCam(camGate(R.joinMs),shotWide(t,s),p);
    sh=1.6+(t<600?22*Math.exp(-t/160):0);
  } else if(t<TL.c2){ c=shotClose(t,s); sh=2.4; }
  else if(t<TL.A){ c=shotSide(t,s); sh=1.8; }
  else if(t<TL.F){
    var q=eio(seg(t,TL.A,TL.A+900));
    c=blendCam(shotSide(t,s),shotTension(t,s),q); sh=1.4+seg(t,TL.A,TL.F)*5;
  } else if(t<TL.HIT){
    c=camRun(TL.F-1); c.z*=1.06; return shake(c,t,26);
  } else if(t<TL.PHO){
    var pz=1+.14*(1-eo(seg(t,TL.HIT,TL.HIT+200)));
    c=mk(FIN,1.24*pz,PY(laneZ(TL.win),150),560,0,140);
    sh=12*(1-seg(t,TL.HIT,TL.HIT+300));
  } else if(t<TL.RES){
    var q2=eo(seg(t,TL.PHO,TL.PHO+1200));
    c=mk(lerp(FIN+80,FIN+520,q2),lerp(1.0,.92,q2),640,640,0);
    sh=10*Math.exp(-(t-TL.PHO)/150);
  } else {
    var q3=eo(seg(t,TL.RES,TL.RES+1300)), Zw=laneZ(TL.win), wx=runnerX(TL.win,s);
    c=blendCam(mk(FIN+520,.92,640,640,0), mk(wx+330*Zw,1.3,PY(Zw,0),585,0), q3);
    sh=10*Math.exp(-(t-TL.RES)/200);
  }
  return shake(c,t,sh);
}
function camLabel(t){
  if(MODE==='collect') return 'CAM 1 · 출발 게이트';
  if(t<TL.c1) return 'CAM 2 · 트래킹';
  if(t<TL.c2) return 'CAM 3 · 선두 클로즈업';
  if(t<TL.A) return 'CAM 4 · 측면 트래킹';
  if(t<TL.F) return 'CAM 5 · 막판 줌';
  if(t<TL.PHO) return 'PHOTO · 결승 판정';
  if(t<TL.RES) return 'CAM 6 · 결승선';
  return 'CAM 7 · 우승마';
}
/* 월드(base) → 화면 */
function w2s(cam,wx,Z,h){
  var bx=CX+(wx-cam.x)/Z, by=PY(Z,h);
  var dx=(bx-CX)*cam.z, dy=(by-cam.fy)*cam.z, c=Math.cos(cam.r), s=Math.sin(cam.r);
  return {x:CX+cam.ox+cam.sx+dx*c-dy*s, y:cam.ty+cam.sy+dx*s+dy*c};
}

/* ---------- drawing: horse (측면, 오른쪽을 본다. 로컬 원점 = 몸통 아래 지면) ---------- */
function legSeg(c,x,y,a1,a2,l1,l2,w1,w2,col){
  var kx=x+Math.sin(a1)*l1, ky=y+Math.cos(a1)*l1, fx=kx+Math.sin(a1+a2)*l2, fy=ky+Math.cos(a1+a2)*l2;
  c.strokeStyle=NAVY; c.lineWidth=w1+7; line(c,x,y,kx,ky); c.lineWidth=w2+7; line(c,kx,ky,fx,fy);
  c.strokeStyle=col; c.lineWidth=w1; line(c,x,y,kx,ky); c.lineWidth=w2; line(c,kx,ky,fx,fy);
  c.save(); c.translate(fx,fy); c.rotate(-(a1+a2)); c.fillStyle=NAVY; c.beginPath(); c.roundRect(-7,-4,15,10,3); c.fill(); c.restore();
}
function fold(p){ return Math.pow(Math.max(0,Math.cos(p)),1.2); }
function foreLeg(c,p,run,col){ legSeg(c,46,-94,.06+.78*Math.sin(p)*run,-1.95*fold(p)*run,44,47,15,9,col); }
function hindLeg(c,p,run,col){ legSeg(c,-46,-100,.24+.62*Math.sin(p)*run,-.36-.95*fold(p)*run,46,51,19,10,col); }
function legs(c,ph,run,cols,far){
  // 회전 구보: 뒷다리 → 앞다리 순서로 착지
  if(far){ hindLeg(c,ph+0,run,cols); foreLeg(c,ph+2.3,run,cols); }
  else { hindLeg(c,ph+.55,run,cols); foreLeg(c,ph+2.85,run,cols); }
}
function bodyShapes(c){
  c.beginPath(); c.ellipse(0,-102,66,27,0,0,Math.PI*2);
  c.moveTo(-14,-104); c.ellipse(-46,-106,33,30,0,0,Math.PI*2);
  c.moveTo(72,-104); c.ellipse(44,-103,29,29,0,0,Math.PI*2);
}
function neckShapes(c){
  c.beginPath(); c.moveTo(30,-120); c.quadraticCurveTo(62,-142,100,-166); c.lineTo(122,-150); c.quadraticCurveTo(84,-118,66,-82); c.lineTo(40,-96); c.closePath();
  c.moveTo(150,-138); c.ellipse(124,-146,30,13,.6,0,Math.PI*2);
}
/* ---------- 말 스프라이트 (24프레임 구보, /assets/race-horse*.png) ----------
   race-horse: 실크(보라) 부분을 회색 명암으로 바꾼 본그림, race-horse-mask: 실크 부분만.
   주자 색마다 마스크에 색을 곱해 한 번 만들어 두고 본그림 위에 덮는다. 번호 천(원본 '6')은 주자 색으로 덮는다 — 말은 번호 없이 색으로만 구분 */
var HS={"w":275,"h":198,"n":24,"cloth":[[103,59,35,40],[108,57,32,40],[108,63,32,37],[109,62,31,40],[110,63,32,40],[107,62,33,39],[107,59,33,40],[110,58,32,40],[108,65,32,40],[110,64,31,40],[110,64,31,40],[109,66,33,40],[106,63,34,40],[108,64,32,40],[108,68,32,38],[105,63,33,41],[111,61,31,42],[109,63,32,40],[106,58,33,41],[104,62,35,41],[109,65,33,41],[107,59,33,40],[109,65,31,39],[105,63,35,40]]};
var HIMG=new Image(), HMASK=new Image(), HTINT={};
HIMG.src='/assets/race-horse.png'; HMASK.src='/assets/race-horse-mask.png';
function horseReady(){ return HIMG.complete&&HIMG.naturalWidth&&HMASK.complete&&HMASK.naturalWidth; }
function tinted(col){
  if(HTINT[col]) return HTINT[col];
  var cv=document.createElement('canvas'); cv.width=HMASK.naturalWidth; cv.height=HMASK.naturalHeight;
  var x=cv.getContext('2d'); x.drawImage(HMASK,0,0);
  x.globalCompositeOperation='multiply'; x.fillStyle=col; x.fillRect(0,0,cv.width,cv.height);
  x.globalCompositeOperation='destination-in'; x.drawImage(HMASK,0,0);
  return (HTINT[col]=cv);
}
var HW=340, HK=HW/HS.w, HX0=-178, HY0=-HS.h*HK+8;   // 로컬 단위: 꼬리 끝 x≈-178, 발굽이 지면(y=0)에 닿게
function spriteFrame(c,f,i,col,alpha){
  var sx=f*HS.w;
  c.globalAlpha=alpha;
  c.drawImage(HIMG,sx,0,HS.w,HS.h,HX0,HY0,HW,HS.h*HK);
  c.drawImage(tinted(col),sx,0,HS.w,HS.h,HX0,HY0,HW,HS.h*HK);
  if(alpha>=1){
    var r=HS.cloth[f], cx=HX0+r[0]*HK, cy=HY0+r[1]*HK, cw=r[2]*HK, ch=r[3]*HK;
    c.fillStyle=col; c.fillRect(cx+1,cy+1,cw-2,ch-2);
    c.fillStyle='rgba(255,255,255,.28)'; c.fillRect(cx+3,cy+3,cw-6,(ch-6)*.38);
  }
  c.globalAlpha=1;
}
function drawHorse(c,x,y,k,ph,run,i,shade,glow,blur,idle){
  if(horseReady()){
    var fr=run>0 ? Math.floor((((ph/(Math.PI*2))%1)+1)%1*HS.n)%HS.n : 3;
    c.save(); c.translate(x,y); c.scale(k,k);
    c.fillStyle='rgba(0,0,0,'+(.3*(1-shade*.5))+')'; c.beginPath(); c.ellipse(6,2,96,11,0,0,Math.PI*2); c.fill();
    if(idle) c.translate(0,Math.sin(idle*.004+i*1.7)*2);
    if(shade>.02) c.filter='brightness('+(1-shade*.62)+')';
    if(glow){ c.shadowColor=glow; c.shadowBlur=46; }
    if(blur){ c.save(); c.translate(-26,0); spriteFrame(c,(fr+HS.n-1)%HS.n,i,SILK[i%8],.22); c.restore(); }
    spriteFrame(c,fr,i,SILK[i%8],1);
    c.shadowBlur=0; c.filter='none';
    c.restore();
    return;
  }
  var sd=function(col){ return mix(col,'#0a1220',shade); };
  var coat=sd(COAT[i%8]), dark=sd(mix(COAT[i%8],'#000000',.42)), silk=sd(SILK[i%8]), silk2=sd(SILK2[i%8]);
  c.save(); c.translate(x,y); c.scale(k,k);
  c.lineJoin='round'; c.lineCap='round';
  c.fillStyle='rgba(0,0,0,'+(.3*(1-shade*.5))+')'; c.beginPath(); c.ellipse(6,2,86,10,0,0,Math.PI*2); c.fill();
  var bob=-run*6*(1+Math.sin(ph+1.0)), pitch=.05*Math.sin(ph+2)*run;
  c.translate(0,bob); c.translate(0,-96); c.rotate(pitch); c.translate(0,96);
  if(blur){ c.globalAlpha=.2; legs(c,ph-.5,run,dark,true); legs(c,ph-.5,run,coat,false); c.globalAlpha=1; }
  legs(c,ph,run,dark,true);
  // 꼬리 (뒤로 흩날림)
  var wv=Math.sin(ph*1.0)*run, tl=run*22;
  c.strokeStyle=NAVY; c.lineWidth=16; c.beginPath(); c.moveTo(-74,-118); c.quadraticCurveTo(-110,-124+wv*6,-150-tl,-108+wv*12+(1-run)*50); c.stroke();
  c.strokeStyle=dark; [10,7,5].forEach(function(w,j){ c.lineWidth=w; c.beginPath(); c.moveTo(-74,-118+j*3); c.quadraticCurveTo(-112,-122+wv*(6+j*4)+j*4,-148-tl+j*6,-106+wv*(12+j*5)+j*6+(1-run)*52); c.stroke(); });
  // 몸통 + 목 + 머리: 외곽선을 먼저 한꺼번에 그리고 채운다 (합집합 외곽선)
  var nod=.065*Math.sin(ph+.4)*run+(idle?Math.sin(idle*.004+i*1.7)*.07:0);
  if(glow){ c.shadowColor=glow; c.shadowBlur=46; }
  c.strokeStyle=NAVY; c.lineWidth=9; bodyShapes(c); c.stroke();
  c.save(); c.translate(52,-112); c.rotate(nod); c.translate(-52,112); neckShapes(c); c.stroke(); c.restore();
  c.shadowBlur=0;
  c.fillStyle=coat; bodyShapes(c); c.fill();
  c.save(); c.translate(52,-112); c.rotate(nod); c.translate(-52,112);
  neckShapes(c); c.fill();
  // 갈기
  c.strokeStyle=dark; c.lineWidth=9; c.beginPath(); c.moveTo(36,-124); c.quadraticCurveTo(66,-146,100,-166); c.stroke();
  c.lineWidth=5; for(var m=0;m<4;m++){ var mx=44+m*14, my=-130-m*9; c.beginPath(); c.moveTo(mx,my); c.lineTo(mx-14-run*8,my-6+Math.sin(ph+m)*4*run); c.stroke(); }
  // 귀 + 후드(실크 색) + 눈 + 콧구멍
  c.fillStyle=coat; c.strokeStyle=NAVY; c.lineWidth=4; c.beginPath(); c.moveTo(100,-164); c.lineTo(100,-184); c.lineTo(112,-166); c.closePath(); c.fill(); c.stroke();
  c.fillStyle=silk; c.beginPath(); c.ellipse(112,-154,18,10,.6,0,Math.PI*2); c.fill(); c.stroke();
  c.fillStyle=NAVY; c.beginPath(); c.arc(116,-152,6,0,Math.PI*2); c.fill();
  c.fillStyle=dark; c.beginPath(); c.ellipse(144,-130,7,6,.6,0,Math.PI*2); c.fill();
  c.restore();
  // 배 그림자 + 등 하이라이트
  c.fillStyle='rgba(10,18,32,.22)'; c.beginPath(); c.ellipse(0,-84,58,9,0,0,Math.PI*2); c.fill();
  c.strokeStyle='rgba(255,255,255,'+(.22*(1-shade))+')'; c.lineWidth=5; c.beginPath(); c.ellipse(-4,-108,48,16,0,Math.PI*1.1,Math.PI*1.75); c.stroke();
  // 안장 + 번호 천
  c.fillStyle=CR; c.strokeStyle=NAVY; c.lineWidth=4;
  c.beginPath(); c.moveTo(-30,-128); c.lineTo(22,-128); c.lineTo(18,-82); c.lineTo(-26,-82); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle=silk; c.lineWidth=5; c.strokeRect(-23,-122,38,34);
  
  c.fillStyle=NAVY; c.beginPath(); c.ellipse(-2,-130,26,7,0,0,Math.PI*2); c.fill();
  // 기수 (말보다 덜 흔들림)
  c.save(); c.translate(0,-bob*.55);
  var bx=16,by=-122, kx=32,ky=-142, hpx=2,hpy=-152, sx=40,sy=-164, hx2=58,hy2=-172, ex=54,ey=-150, nx=76,ny=-144;
  if(!run){ hpy=-162; sy=-182; hy2=-194; hx2=50; sx=34; ey=-160; nx=70; ny=-150; }
  c.strokeStyle=NAVY; c.lineWidth=13; line(c,bx,by,kx,ky);
  c.strokeStyle=NAVY; c.lineWidth=17; line(c,kx,ky,hpx,hpy); c.strokeStyle=sd(CR); c.lineWidth=10; line(c,kx,ky,hpx,hpy);
  c.strokeStyle=NAVY; c.lineWidth=30; line(c,hpx,hpy,sx,sy); c.strokeStyle=silk; c.lineWidth=22; line(c,hpx,hpy,sx,sy);
  c.strokeStyle=silk2; c.lineWidth=6;
  if(i%3===0){ line(c,hpx+10,hpy-8,sx-8,sy+8); }
  else if(i%3===1){ line(c,hpx+14,hpy-10,hpx+10,hpy+2); line(c,hpx+26,hpy-14,hpx+22,hpy-2); }
  else { c.fillStyle=silk2; c.beginPath(); c.arc((hpx+sx)/2,(hpy+sy)/2,5,0,Math.PI*2); c.fill(); }
  c.strokeStyle=NAVY; c.lineWidth=12; c.beginPath(); c.moveTo(sx,sy+2); c.lineTo(ex,ey); c.lineTo(nx,ny); c.stroke();
  c.strokeStyle=silk; c.lineWidth=6; c.beginPath(); c.moveTo(sx,sy+2); c.lineTo(ex,ey); c.lineTo(nx,ny); c.stroke();
  c.strokeStyle=sd(CR); c.lineWidth=2; line(c,nx,ny,140,-136);
  c.fillStyle=sd('#f1d2b4'); c.strokeStyle=NAVY; c.lineWidth=4; c.beginPath(); c.arc(hx2,hy2,11,0,Math.PI*2); c.fill(); c.stroke();
  c.fillStyle=silk; c.beginPath(); c.arc(hx2,hy2-2,12,Math.PI*.95,Math.PI*2.05); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle=NAVY; c.lineWidth=4; line(c,hx2+8,hy2-3,hx2+19,hy2-1);
  c.fillStyle=silk2; c.fillRect(hx2+1,hy2-1,10,4);
  c.restore();
  // 앞쪽 다리
  legs(c,ph,run,coat,false);
  c.restore();
}
/* 발굽 흙·잔디 튐 (말 기준 뒤로) */
function kick(c,x,y,k,xw,i,run){
  if(run<.3) return;
  for(var j=0;j<10;j++){
    var life=((xw/240+rnd(i*17+j))%1), px=x-(20+life*300+rnd(j*5+i)*40)*k, py=y-Math.sin(life*Math.PI)*(24+rnd(j+i*3)*60)*k;
    c.fillStyle='rgba(226,210,172,'+(.36*(1-life)*run)+')';
    c.beginPath(); c.arc(px,py-10*k,(8+life*34)*k,0,Math.PI*2); c.fill();
  }
  c.fillStyle='rgba(58,40,24,.9)';
  for(var q=0;q<9;q++){
    var lf=((xw/150+rnd(i*7+q+50))%1); if(lf>.85) continue;
    var cx=x-(10+lf*230)*k-rnd(q)*30*k, cy=y-lf*(1-lf)*4*(30+rnd(q+i)*70)*k;
    c.fillRect(cx,cy,(5+rnd(q+3)*5)*k,(4+rnd(q+4)*3)*k);
  }
}

/* ---------- drawing: world layers ---------- */
function sky(c,amb,o){
  var yS=PY(Zd(D_STAND),760);
  var g=c.createLinearGradient(0,-400,0,yS+40);
  g.addColorStop(0,'#050a14'); g.addColorStop(.7,NAVY); g.addColorStop(1,'#2d3c5c');
  c.fillStyle=g; c.fillRect(VX0,-2400,VX1-VX0,yS+2440);
  for(var s=0;s<40;s++){ var sx=((rnd(s+1)*3000-CAM.x/40)%3000+3000)%3000+VX0-400, sy=-80+rnd(s+2)*240; c.fillStyle='rgba(245,243,239,'+(.15+rnd(s+3)*.35)+')'; c.fillRect(sx,sy,2,2); }
  // 조명탑 (Z=4.6)
  var Z=4.6, sp=2600;
  for(var L=Math.floor(wx0(Z)/sp)-1;L*sp<wx1(Z)+sp;L++){
    var lx=PX(L*sp+700,Z), top=PY(Z,1700), bot=PY(Z,0);
    var lg=c.createRadialGradient(lx,top,0,lx,top,380); lg.addColorStop(0,'rgba(255,244,214,.5)'); lg.addColorStop(1,'rgba(255,244,214,0)');
    c.fillStyle=lg; c.fillRect(lx-380,top-380,760,760);
    c.fillStyle='#0b1322'; c.fillRect(lx-4,top,8,bot-top);
    c.fillStyle=CR; c.fillRect(lx-46,top-24,92,30); c.fillStyle='rgba(23,36,55,.45)'; for(var q=0;q<4;q++) c.fillRect(lx-43+q*23,top-21,18,24);
  }
}
var ADS=['달려라!','응원 중','우승 후보','오늘의 경주'];
function stands(c,amb,o){
  var Z=Zd(D_STAND), base=PY(Z,0), top=PY(Z,700), x0=wx0(Z)-60, x1=wx1(Z)+60;
  // 지붕
  c.fillStyle='#0c1424'; c.fillRect(VX0,PY(Z,820),VX1-VX0,PY(Z,700)-PY(Z,820));
  c.fillStyle=OR; c.fillRect(VX0,PY(Z,700)-4,VX1-VX0,4);
  for(var rl=Math.floor(x0/260);rl*260<x1;rl++){ var lx=PX(rl*260,Z); c.fillStyle='rgba(255,236,190,.85)'; c.fillRect(lx-6,PY(Z,712),12,4); }
  // 관중석 계단
  var rows=8, rh=(700-90)/rows;
  for(var r=0;r<rows;r++){
    var yb=PY(Z,90+r*rh), yt=PY(Z,90+(r+1)*rh);
    c.fillStyle=r%2?'#15223a':'#1b2b48'; c.fillRect(VX0,yt,VX1-VX0,yb-yt);
  }
  // 관중 (옷 → 머리) — 머리는 한 경로로 모아 그린다
  var spc=30, heads=new Path2D(), cheer=o.cheer?1:0;
  for(var r2=0;r2<rows;r2++){
    var yb2=PY(Z,90+r2*rh+6);
    for(var col=Math.floor(x0/spc);col*spc<x1;col++){
      var id=col*7+r2*131; if(rnd(id+9)<.08) continue;
      var px=PX(col*spc+rnd(id)*12,Z), bob=Math.sin(amb*(.008+cheer*.01)+id)*(1+cheer*3);
      var hue=rnd(id+3), sh=hue<.07?OR:hue<.12?MINT:hue<.15?GOLD:hue<.4?'#2c3b58':hue<.65?'#3a4a68':hue<.85?'#4b5a78':'#66728c';
      c.fillStyle=sh; c.fillRect(px-5,yb2-26+bob,10,20);
      heads.moveTo(px+4,yb2-31+bob); heads.arc(px,yb2-31+bob,4.2,0,Math.PI*2);
      if(cheer&&rnd(id+11)<.35){ c.fillRect(px-6,yb2-44+bob-Math.abs(Math.sin(amb*.02+id))*5,2.5,14); }
    }
  }
  c.fillStyle='#c9ae92'; c.fill(heads);
  c.fillStyle='rgba(10,18,34,.34)'; c.fillRect(VX0,top,VX1-VX0,base-top);
  // 플래시
  if(o.flashes>0){
    for(var f=0;f<60;f++){ var fid=f*91+Math.floor(amb/80)*7; if(rnd(fid)>.4*o.flashes) continue; var fx=VX0+rnd(fid+1)*(VX1-VX0), fy=lerp(top,base-40,rnd(fid+2));
      var fg=c.createRadialGradient(fx,fy,0,fx,fy,16); fg.addColorStop(0,'rgba(255,255,255,.95)'); fg.addColorStop(1,'rgba(255,255,255,0)'); c.fillStyle=fg; c.fillRect(fx-16,fy-16,32,32); }
  }
  // 광고판 벽
  var wb=PY(Z,90);
  c.fillStyle=NAVY; c.fillRect(VX0,wb,VX1-VX0,base-wb);
  var aw=640;
  for(var a=Math.floor(x0/aw);a*aw<x1;a++){
    var ax=PX(a*aw+20,Z), ax2=PX(a*aw+aw-20,Z), k2=((a%3)+3)%3;
    c.fillStyle=k2===0?OR:k2===1?CR:MINT; c.fillRect(ax,wb+4,ax2-ax,base-wb-8);
    c.fillStyle=k2===1?NAVY:CR; c.font=Math.round((base-wb)*.62)+'px '+FT; c.textAlign='center'; c.textBaseline='middle';
    c.fillText(ADS[((a%4)+4)%4],(ax+ax2)/2,(wb+base)/2+1);
  }
}
function apron(c){
  var yS=PY(Zd(D_STAND),0), yF=PY(Zd(D_FAR),0), Zh=Zd(1050), yH=PY(Zh,0);
  c.fillStyle='#14281f'; c.fillRect(VX0,yS,VX1-VX0,yF-yS+2);
  // 생울타리
  c.fillStyle='#1d4a30'; c.fillRect(VX0,PY(Zh,70),VX1-VX0,yH-PY(Zh,70));
  var hb=new Path2D(), x0=wx0(Zh), x1=wx1(Zh);
  for(var b=Math.floor(x0/90);b*90<x1;b++){ var bx=PX(b*90,Zh); hb.moveTo(bx+30,PY(Zh,70)); hb.arc(bx,PY(Zh,70),30/Zh,0,Math.PI*2); }
  c.fill(hb);
}
function railAt(c,d,h,white,thick){
  var Z=Zd(d), yb=PY(Z,0), x0=wx0(Z)-200, x1=wx1(Z)+200;
  var pw=Math.max(3,10/Z);
  c.fillStyle='#c9d1dc';
  for(var p=Math.floor(x0/170);p*170<x1;p++){ var px=PX(p*170,Z); c.fillRect(px-pw/2,PY(Z,h),pw,yb-PY(Z,h)); }
  c.fillStyle=white; c.fillRect(VX0,PY(Z,h)-thick/Z/2,VX1-VX0,thick/Z);
  c.fillStyle='rgba(23,36,55,.35)'; c.fillRect(VX0,PY(Z,h)+thick/Z/2-3/Z,VX1-VX0,3/Z);
}
function farRail(c,o){
  var Z=Zd(D_FAR);
  railAt(c,D_FAR,120,CR,16);
  // 거리 표지 기둥
  [400,300,200,100].forEach(function(m){
    var wx=FIN*(1-m/TRACKM); if(wx<wx0(Z)-200||wx>wx1(Z)+200) return;
    var px=PX(wx,Z), yb=PY(Z,0);
    for(var z2=0;z2<8;z2++){ c.fillStyle=z2%2?CR:RED; c.fillRect(px-9/Z,PY(Z,(z2+1)*42),18/Z,42/Z+1); }
    var sw=150/Z, shh=80/Z, sy=PY(Z,336)-shh;
    c.fillStyle=CR; c.fillRect(px-sw/2,sy,sw,shh); c.strokeStyle=NAVY; c.lineWidth=5/Z; c.strokeRect(px-sw/2,sy,sw,shh);
    c.fillStyle=NAVY; c.font='800 '+Math.round(54/Z)+'px '+FM; c.textAlign='center'; c.textBaseline='middle'; c.fillText(String(m),px,sy+shh/2+2);
  });
  // 결승 기둥 + 원판 + 판정탑
  if(FIN>wx0(Z)-600&&FIN<wx1(Z)+600){
    var fx=PX(FIN,Z);
    c.fillStyle=NAVY; var tw=220/Z; c.fillRect(PX(FIN+260,Z)-tw/2,PY(Z,560),tw,PY(Z,0)-PY(Z,560));
    c.fillStyle='rgba(255,236,190,.85)'; c.fillRect(PX(FIN+260,Z)-tw/2+14/Z,PY(Z,520),tw-28/Z,70/Z);
    c.fillStyle=OR; c.fillRect(PX(FIN+260,Z)-tw/2,PY(Z,560),tw,10/Z);
    c.fillStyle=RED; c.fillRect(fx-9/Z,PY(Z,600),18/Z,PY(Z,0)-PY(Z,600));
    var dr=74/Z, dy=PY(Z,640);
    c.fillStyle=CR; c.beginPath(); c.arc(fx,dy,dr,0,Math.PI*2); c.fill(); c.strokeStyle=NAVY; c.lineWidth=8/Z; c.stroke();
    c.fillStyle=RED; c.beginPath(); c.arc(fx,dy,dr*.62,0,Math.PI*2); c.fill();
    c.fillStyle=NAVY; c.fillRect(fx+dr+10/Z,dy-38/Z,200/Z,76/Z); c.fillStyle=OR; c.fillRect(fx+dr+10/Z,dy-38/Z,10/Z,76/Z);
    c.fillStyle=CR; c.font=Math.round(56/Z)+'px '+FT; c.textAlign='left'; c.textBaseline='middle'; c.fillText('결승',fx+dr+34/Z,dy+2/Z);
  }
}
function turf(c,o){
  var Zf=Zd(D_FAR), Zn=Zd(D_NEAR), yF=PY(Zf,0), yN=PY(Zn,0);
  var g=c.createLinearGradient(0,yF,0,yN); g.addColorStop(0,'#256f45'); g.addColorStop(1,'#3aa766');
  c.fillStyle=g; c.fillRect(VX0,yF,VX1-VX0,yN-yF+600);
  // 잔디 줄무늬 (원근 사다리꼴 → 속도감)
  var bw=340, x0=wx0(Zf), x1=wx1(Zf);
  c.fillStyle='rgba(255,255,255,.075)';
  for(var b=Math.floor(x0/bw);b*bw<x1;b++){
    if(((b%2)+2)%2) continue;
    c.beginPath(); c.moveTo(PX(b*bw,Zf),yF); c.lineTo(PX((b+1)*bw,Zf),yF); c.lineTo(PX((b+1)*bw,Zn),yN); c.lineTo(PX(b*bw,Zn),yN); c.closePath(); c.fill();
  }
  // 발굽 자국
  c.fillStyle='rgba(20,52,30,.35)';
  var x2=wx0(Zn)-200, x3=wx1(Zf)+200;
  for(var k=Math.floor(x2/70);k*70<x3;k++){
    for(var j=0;j<2;j++){ var dd=lerp(D_NEAR+40,D_FAR-30,rnd(k*3+j)), Z=Zd(dd), px=PX(k*70+rnd(k+j*9)*70,Z); if(px<VX0||px>VX1) continue;
      c.beginPath(); c.ellipse(px,PY(Z,0),9/Z,3/Z,0,0,Math.PI*2); c.fill(); }
  }
  // 바깥 흙 경계
  c.fillStyle='rgba(120,92,58,.45)'; c.fillRect(VX0,yF,VX1-VX0,6);
  // 결승선
  var gl=o.finGlow||0;
  if(gl>0){ c.fillStyle='rgba(255,198,26,'+(.4*gl)+')'; c.beginPath(); c.moveTo(PX(FIN-140,Zf),yF); c.lineTo(PX(FIN+140,Zf),yF); c.lineTo(PX(FIN+140,Zn),yN); c.lineTo(PX(FIN-140,Zn),yN); c.closePath(); c.fill(); }
  c.fillStyle=CR; c.beginPath(); c.moveTo(PX(FIN-8,Zf),yF); c.lineTo(PX(FIN+8,Zf),yF); c.lineTo(PX(FIN+8,Zn),yN); c.lineTo(PX(FIN-8,Zn),yN); c.closePath(); c.fill();
}
/* 사진 판정(슬릿 스캔): 배경은 결승선 한 줄을 시간 방향으로 늘린 가로 띠가 된다 */
function slitBG(c){
  var Zs=Zd(D_STAND), Zf=Zd(D_FAR), Zn=Zd(D_NEAR);
  var y0=-2400, yR=PY(Zs,820), yS=PY(Zs,0), yF=PY(Zf,0);
  c.fillStyle='#1a1d24'; c.fillRect(VX0,y0,VX1-VX0,yR-y0);
  for(var y=Math.floor(yR);y<yS;y+=3){ var v=Math.round(40+rnd(y)*70); c.fillStyle='rgb('+v+','+v+','+(v+8)+')'; c.fillRect(VX0,y,VX1-VX0,3); }
  for(var y2=Math.floor(yS);y2<yF;y2+=4){ var v2=Math.round(30+rnd(y2+7)*30); c.fillStyle='rgb('+v2+','+(v2+14)+','+v2+')'; c.fillRect(VX0,y2,VX1-VX0,4); }
  c.fillStyle=CR; c.fillRect(VX0,PY(Zf,120)-8/Zf,VX1-VX0,16/Zf);
  c.fillStyle='#c9d1dc'; c.fillRect(VX0,PY(Zf,120)+8/Zf,VX1-VX0,PY(Zf,0)-PY(Zf,120)-8/Zf);
  for(var y3=Math.floor(yF);y3<PY(Zn,0)+600;y3+=2){ var v3=Math.round(70+rnd(y3+3)*26); c.fillStyle='rgb('+(v3-20)+','+(v3+40)+','+(v3-10)+')'; c.fillRect(VX0,y3,VX1-VX0,2); }
}
/* 출발 게이트: 앞면(x=GX)이 카메라 쪽으로 비스듬히 보이는 철제 칸막이 */
function gatePost(c,d,openP){
  var Z=Zd(d), x=PX(GX,Z), xr=PX(GX-340,Z), w=Math.max(4,14/Z);
  c.fillStyle='#24344f'; c.fillRect(xr-w/2,PY(Z,320),w,PY(Z,0)-PY(Z,320));
  c.strokeStyle='#33476b'; c.lineWidth=Math.max(2,7/Z); line(c,xr,PY(Z,150),x,PY(Z,150)); line(c,xr,PY(Z,300),x,PY(Z,300));
  c.fillStyle=NAVY; c.fillRect(x-w/2,PY(Z,330),w,PY(Z,0)-PY(Z,330));
}
function gateDoors(c,i,op){
  var sp=laneSp(), dF=laneD(i)+sp/2-4, dN=laneD(i)-sp/2+4, L=(dF-dN)/2, th=op*1.4;
  var lv=function(hd,dir){
    var ed=hd+dir*L*Math.cos(th), ex=GX+L*Math.sin(th)*1.6;
    var Zh=Zd(hd), Ze=Zd(ed);
    c.beginPath(); c.moveTo(PX(GX,Zh),PY(Zh,14)); c.lineTo(PX(ex,Ze),PY(Ze,14)); c.lineTo(PX(ex,Ze),PY(Ze,150)); c.lineTo(PX(GX,Zh),PY(Zh,150)); c.closePath();
    c.fillStyle=OR; c.fill(); c.strokeStyle=NAVY; c.lineWidth=4; c.stroke();
    c.strokeStyle='rgba(245,243,239,.8)'; c.lineWidth=3; var mZ=Zd((hd+ed)/2), mx=PX((GX+ex)/2,mZ); line(c,mx,PY(mZ,40),mx,PY(mZ,124));
  };
  lv(dF,-1); lv(dN,1);
}
function gateTop(c){
  var n=N(), sp=laneSp();
  var dF=laneD(0)+sp/2, dN=laneD(n-1)-sp/2, ZF=Zd(dF), ZN=Zd(dN);
  c.fillStyle=NAVY; c.beginPath(); c.moveTo(PX(GX,ZF),PY(ZF,300)); c.lineTo(PX(GX,ZN),PY(ZN,300)); c.lineTo(PX(GX,ZN),PY(ZN,370)); c.lineTo(PX(GX,ZF),PY(ZF,370)); c.closePath(); c.fill();
  c.strokeStyle=OR; c.lineWidth=4; line(c,PX(GX,ZF),PY(ZF,300),PX(GX,ZN),PY(ZN,300));
  for(var i=0;i<n;i++){
    var Z=laneZ(i), x=PX(GX,Z), y=PY(Z,335), s=1/Z;
    c.fillStyle=SILK[i%8]; c.beginPath(); c.roundRect(x-30*s,y-26*s,60*s,52*s,6*s); c.fill(); c.strokeStyle=NAVY; c.lineWidth=4*s; c.stroke();
  }
}
function nearRail(c,o){
  var Z=Zd(D_NEAR), h=130, yb=PY(Z,0), x0=wx0(Z)-300, x1=wx1(Z)+300;
  var blur=Math.min(260,Math.abs(camVel)*34);
  c.fillStyle='#1f5a39'; c.fillRect(VX0,PY(Z,20),VX1-VX0,800);
  for(var p=Math.floor(x0/240);p*240<x1;p++){
    var px=PX(p*240,Z), w=16/Z;
    if(blur>6){ var g=c.createLinearGradient(px-blur/Z,0,px+w,0); g.addColorStop(0,'rgba(220,228,238,0)'); g.addColorStop(1,'rgba(220,228,238,.85)'); c.fillStyle=g; c.fillRect(px-blur/Z,PY(Z,h),blur/Z+w,yb-PY(Z,h)); }
    else { c.fillStyle='#dfe5ec'; c.fillRect(px,PY(Z,h),w,yb-PY(Z,h)); }
  }
  c.fillStyle=CR; c.fillRect(VX0,PY(Z,h)-12/Z,VX1-VX0,24/Z);
  c.fillStyle='rgba(23,36,55,.4)'; c.fillRect(VX0,PY(Z,h)+8/Z,VX1-VX0,5/Z);
  c.fillStyle='#d2d9e2'; c.fillRect(VX0,PY(Z,72)-6/Z,VX1-VX0,12/Z);
}
function tag(c,x,y,i,lead){
  var nm=nameOf(i);
  c.save(); c.font='900 26px '+FK; var tw=Math.min(190,c.measureText(nm).width);
  var w=tw+64+(lead?62:0);
  c.fillStyle='rgba(8,14,26,.86)'; c.beginPath(); c.roundRect(x-22,y-21,w,42,8); c.fill();
  c.fillStyle=SILK[i%8]; c.beginPath(); c.roundRect(x-22,y-21,42,42,8); c.fill();
  c.textBaseline='middle';
  c.fillStyle=CR; c.font='900 26px '+FK; c.textAlign='left'; c.fillText(nm,x+30,y+1,190);
  if(lead){ c.fillStyle=OR; c.beginPath(); c.roundRect(x+36+tw,y-15,54,30,6); c.fill(); c.fillStyle=CR; c.font='900 18px '+FK; c.textAlign='center'; c.fillText('선두',x+63+tw,y+1); }
  c.restore();
}
function halo(c,x,y,amb,a){
  c.save(); c.translate(x,y); c.rotate(amb*.0008); c.globalCompositeOperation='lighter';
  for(var i=0;i<18;i++){
    var an=i/18*Math.PI*2;
    var gr=c.createRadialGradient(0,0,0,0,0,700); gr.addColorStop(0,'rgba(255,200,80,'+(.45*a)+')'); gr.addColorStop(1,'rgba(255,120,30,0)');
    c.fillStyle=gr; c.beginPath(); c.moveTo(0,0); c.arc(0,0,700,an-.07,an+.07); c.closePath(); c.fill();
  }
  var gl=c.createRadialGradient(0,0,0,0,0,260); gl.addColorStop(0,'rgba(255,226,140,'+(.55*a)+')'); gl.addColorStop(1,'rgba(255,140,40,0)');
  c.fillStyle=gl; c.beginPath(); c.arc(0,0,260,0,Math.PI*2); c.fill();
  c.restore();
}

function drawWorld(c,cam,s,amb,o){
  CAM=cam;
  c.save();
  c.translate(CX+cam.ox+cam.sx,cam.ty+cam.sy); c.rotate(cam.r); c.scale(cam.z,cam.z); c.translate(-CX,-cam.fy);
  var m=(940+Math.abs(cam.ox))/cam.z+140; VX0=CX-m; VX1=CX+m;
  if(o.photo) slitBG(c);
  else { sky(c,amb,o); stands(c,amb,o); apron(c); farRail(c,o); turf(c,o); }
  var n=N(), sp=laneSp(), op=o.gate;
  if(!o.photo) gatePost(c,laneD(0)+sp/2,op);
  var lead=o.run?ranking(s)[0]:-1, tags=[];
  for(var i=0;i<n;i++){
    var Z=laneZ(i), xw=o.run?runnerX(i,s):X0, x=PX(xw,Z), y=PY(Z,0), k=BASE/Z;
    var arrived=o.run&&s>=TL.arr[i];
    var run=o.run?cl(speedOf(i,s)/.35):0;
    var ph=o.run?xw/STRIDE*Math.PI*2+i*1.3:Math.sin(amb*.003+i)*.3;
    var sh2=(1.6-Z)*.25+(o.dim?(o.lead.indexOf(i)>=0?0:o.dim*.6):0);
    var glow=o.glowIdx===i?'rgba(255,198,26,.95)':null;
    var soloOff=o.soloA<1&&i!==TL.win; if(soloOff){ if(o.soloA<=0) continue; c.save(); c.globalAlpha=o.soloA; }
    if(o.halo&&o.glowIdx===i) halo(c,x+30*k,y-110*k,amb,o.halo);
    if(o.run&&!o.photo) kick(c,x-40*k,y,k,xw,i,run*(1-sh2*.6));
    drawHorse(c,x,y,k,ph,run,i,cl(sh2,0,.85),glow,o.run&&!o.frozen&&run>.6,o.run?0:amb+i*300);
    if(!o.photo){ gateDoors(c,i,op); gatePost(c,laneD(i)-sp/2,op); }
    if(o.tags&&o.tagSet.indexOf(i)>=0) tags.push([x+20*k,y-205*k,i,i===lead&&!arrived]);
    if(soloOff) c.restore();
    if(o.run&&arrived&&o.ranks&&!(o.soloA<1&&i!==TL.win)){
      var rk=TL.order.indexOf(i)+1, rp=eback(seg(s,TL.arr[i],TL.arr[i]+260));
      tags.push(['rk',x+150*k,y-110*k,rk,rp]);
    }
  }
  if(!o.photo) gateTop(c);
  tags.forEach(function(g){
    if(g[0]==='rk'){ c.save(); c.translate(g[1],g[2]); c.scale(g[4],g[4]);
      c.fillStyle=g[3]===1?GOLD:CR; c.beginPath(); c.arc(0,0,32,0,Math.PI*2); c.fill(); c.strokeStyle=NAVY; c.lineWidth=5; c.stroke();
      c.fillStyle=NAVY; c.font='26px '+FT; c.textAlign='center'; c.textBaseline='middle'; c.fillText(g[3]+'착',0,2); c.restore(); }
    else tag(c,g[0],g[1],g[2],g[3]);
  });
  if(!o.photo) nearRail(c,o);
  c.restore();
}

/* ---------- screen fx ---------- */
function streaks(c,t,alpha,spd,n){
  if(alpha<=0) return;
  for(var i=0;i<n;i++){
    var y=P.y+300+rnd(i+5)*(P.h-320), l=200+rnd(i+9)*520, x=P.x+P.w-((rnd(i+1)*2600+t*spd*(.7+rnd(i+3)*.6))%2600)+400;
    c.fillStyle='rgba(245,243,239,'+(alpha*(.15+rnd(i+7)*.4))+')'; c.fillRect(x,y,l,2+rnd(i+8)*4);
  }
}
function letterbox(c,hb){ if(hb<=0) return; c.fillStyle='#04070c'; c.fillRect(0,P.y,W,hb); c.fillRect(0,P.y+P.h-hb,W,hb); }
function vignette(c,a,col){
  var g=c.createRadialGradient(960,540,380,960,540,1060);
  g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,col||('rgba(0,8,16,'+a+')'));
  c.fillStyle=g; c.fillRect(0,0,W,H);
}
function grain(c,t){
  var k=Math.floor(t/42);
  for(var i=0;i<220;i++){ c.fillStyle=rnd(k*31+i)>.5?'rgba(255,255,255,.06)':'rgba(0,0,0,.08)'; c.fillRect(P.x+rnd(k*17+i)*P.w,P.y+rnd(k*13+i+5)*P.h,2,2); }
}
function cutFlash(c,t){
  if(MODE!=='run') return;
  [TL.c1,TL.c2].forEach(function(ct){
    var a=1-seg(t,ct,ct+140); if(t<ct||a<=0) return;
    c.fillStyle='rgba(255,252,244,'+(.55*a)+')'; c.fillRect(0,0,W,H);
    c.fillStyle='rgba(255,91,23,'+a+')'; c.fillRect(P.x,P.y+P.h*.5-3+(1-a)*300,P.w,6);
  });
}

/* ---------- panel + HUD ---------- */
function panelPath(c,x,y,w,h,k){ c.beginPath(); c.moveTo(x+k,y); c.lineTo(x+w,y); c.lineTo(x+w,y+h-k); c.lineTo(x+w-k,y+h); c.lineTo(x,y+h); c.lineTo(x,y+k); c.closePath(); }
var PH=[{n:'01',ko:'출전'},{n:'02',ko:'질주'},{n:'03',ko:'막판'},{n:'04',ko:'사진 판정'},{n:'05',ko:'결과'}];
function phaseOf(t){
  if(MODE==='collect') return {i:0,p:cl(t/R.joinMs)};
  if(t<TL.A) return {i:1,p:seg(t,0,TL.A)};
  if(t<TL.F) return {i:2,p:seg(t,TL.A,TL.F)};
  if(t<TL.RES) return {i:3,p:seg(t,TL.F,TL.RES)};
  return {i:4,p:seg(t,TL.RES,TL.END)};
}
function hud(c,t,py,ph){
  c.save();
  panelPath(c,P.x,py,P.w,ph,P.k); c.strokeStyle='rgba(245,243,239,.55)'; c.lineWidth=3; c.stroke();
  var L=70; c.strokeStyle=OR; c.lineWidth=9; c.lineCap='square';
  var y0=py, y1=py+ph;
  c.beginPath(); c.moveTo(P.x+P.w-L,y0-10); c.lineTo(P.x+P.w+10,y0-10); c.lineTo(P.x+P.w+10,y0+L); c.stroke();
  c.beginPath(); c.moveTo(P.x-10,y1-L); c.lineTo(P.x-10,y1+10); c.lineTo(P.x+L,y1+10); c.stroke();
  c.beginPath(); c.moveTo(P.x-10,y0+P.k+L); c.lineTo(P.x-10,y0+P.k-6); c.lineTo(P.x+P.k-6,y0-10); c.lineTo(P.x+P.k+L,y0-10); c.stroke();
  c.restore();
  if(ph<P.h*.98) return;
  c.save(); c.textBaseline='middle';
  var photo=MODE==='run'&&t>=TL.F&&t<TL.PHO;
  if(!photo){
    c.fillStyle='rgba(6,12,22,.72)'; c.fillRect(P.x+70,P.y+28,360,MODE==='run'?150:84);
    var on=Math.floor(t/450)%2===0;
    c.fillStyle=on?'#ff2e2e':'rgba(255,46,46,.3)'; c.beginPath(); c.arc(P.x+96,P.y+52,11,0,Math.PI*2); c.fill();
    c.font='800 26px '+FM; c.fillStyle=CR; c.fillText('LIVE',P.x+116,P.y+53);
    c.font='700 22px '+FK; c.fillStyle='rgba(245,243,239,.85)'; c.fillText('경마 중계',P.x+194,P.y+53);
    c.fillStyle=MINT; c.font='700 20px '+FM; c.fillText(camLabel(t),P.x+96,P.y+86);
    if(MODE==='run'){
      var rt=t<TL.F?story(t):t>=TL.PHO?t:TL.F;
      c.fillStyle=CR; c.font='800 30px '+FM; c.fillText('RACE '+(t>=TL.F?fmtT(TL.F):fmtT(rt)),P.x+96,P.y+124);
      var slow=(t>=TL.A&&t<TL.F)?'▶ SLOW ×0.4':(t>=TL.RES?'▶ SLOW ×0.25':'');
      if(slow&&Math.floor(t/380)%2===0){ c.fillStyle=OR; c.font='800 22px '+FM; c.fillText(slow,P.x+96,P.y+158); }
    }
  }
  var pi=phaseOf(t), pw=140, gap=8, total=5*pw+4*gap, sx=960-total/2;
  for(var i=0;i<5;i++){
    var x=sx+i*(pw+gap), y=P.y+30, act=i===pi.i, done=i<pi.i;
    c.fillStyle=act?OR:done?'rgba(245,243,239,.85)':'rgba(10,18,28,.6)'; c.fillRect(x,y,pw,38);
    if(!act&&!done){ c.strokeStyle='rgba(245,243,239,.45)'; c.lineWidth=2; c.strokeRect(x+1,y+1,pw-2,36); }
    if(act){ c.fillStyle='rgba(23,36,55,.35)'; c.fillRect(x,y+32,pw*pi.p,6); }
    c.fillStyle=act?CR:done?NAVY:'rgba(245,243,239,.7)'; c.font='700 21px '+FK; c.textAlign='center';
    c.fillText(PH[i].n+' '+PH[i].ko,x+pw/2,y+20);
  }
  c.textAlign='left';
  if(MODE==='run'&&t<TL.F) distPanel(c,t);
  if(MODE==='run'&&(t<TL.F||(t>=TL.PHO&&t<TL.RES+400))) rankStrip(c,t,t<TL.F?1:t<TL.RES?1:1-seg(t,TL.RES,TL.RES+400));
  c.restore();
}
/* 남은 거리 + 미니 트랙 */
function distPanel(c,t){
  var s=worldS(t), ln=leaderX(s)+NOSEW, dist=Math.max(0,Math.round((FIN-ln)/FIN*TRACKM));
  var ten=t>=TL.A, x=P.x+P.w-380, y=P.y+28, w=330, h=118;
  c.save();
  c.fillStyle='rgba(6,12,22,.82)'; c.fillRect(x,y,w,h); c.fillStyle=ten?OR:MINT; c.fillRect(x,y,8,h);
  c.fillStyle='rgba(245,243,239,.75)'; c.font='700 20px '+FK; c.textBaseline='middle'; c.fillText('결승까지',x+26,y+28);
  var pulse=ten?1+.06*Math.sin(t*.025):1;
  c.save(); c.translate(x+w-24,y+56); c.scale(pulse,pulse); c.textAlign='right'; c.fillStyle=ten?OR:CR; c.font='800 56px '+FM; c.fillText(dist+'m',0,2); c.restore();
  var bx=x+26, bw=w-52, by=y+98;
  c.fillStyle='rgba(245,243,239,.18)'; c.fillRect(bx,by-3,bw,6);
  c.fillStyle=RED; c.fillRect(bx+bw-3,by-14,6,28);
  for(var i=N()-1;i>=0;i--){ var pp=cl((runnerX(i,s)+NOSEW)/FIN); c.fillStyle=SILK[i%8]; c.strokeStyle=NAVY; c.lineWidth=2; c.beginPath(); c.arc(bx+bw*pp,by,7,0,Math.PI*2); c.fill(); c.stroke(); }
  c.restore();
}
/* 실시간 순위 띠 (자리 바뀌면 미끄러지며 재정렬) */
function rankStrip(c,t,alpha){
  if(alpha<=0) return;
  var s=worldS(t), rk=ranking(s), n=N(), now=performance.now(), dt=cl(now-lastFrame,0,100); lastFrame=now;
  var cw=Math.min(232,(P.w-140)/n), x0=960-cw*n/2, y=P.y+P.h-78, hh=54;
  var tgt=[]; rk.forEach(function(ri,j){ tgt[ri]=j; });
  var ln=leaderX(s)+NOSEW;
  c.save(); c.globalAlpha=alpha; c.textBaseline='middle';
  c.fillStyle='rgba(4,8,16,.78)'; c.fillRect(x0-80,y-8,cw*n+96,hh+16);
  c.fillStyle=OR; c.fillRect(x0-80,y-8,64,hh+16); c.fillStyle=CR; c.font='800 18px '+FM; c.textAlign='center'; c.fillText('POS',x0-48,y+hh/2);
  for(var i=0;i<n;i++){
    if(dispPos[i]==null||paused||dt===0) dispPos[i]=tgt[i]; else dispPos[i]+=(tgt[i]-dispPos[i])*(1-Math.exp(-dt/60));
    var px=x0+dispPos[i]*cw, j=tgt[i], fin=s>=TL.arr[i];
    c.fillStyle=j===0?'rgba(255,91,23,.3)':'rgba(245,243,239,.06)'; c.fillRect(px+3,y,cw-6,hh);
    c.fillStyle=j===0?OR:CR; c.font='800 26px '+FM; c.textAlign='center'; c.fillText(String(j+1),px+22,y+hh/2+1);
    c.fillStyle=SILK[i%8]; c.fillRect(px+40,y+8,38,38);
    c.textAlign='left'; c.fillStyle=CR; fitFont(c,nameOf(i),'900 ',24,cw-100,FK,14); c.fillText(nameOf(i),px+86,y+19,cw-100);
    var gap=fin?(TL.order.indexOf(i)+1)+'착':(j===0?'선두':'-'+Math.max(.1,(ln-(runnerX(i,s)+NOSEW))/370).toFixed(1)+'마신');
    c.fillStyle=j===0||fin?GOLD:'rgba(245,243,239,.6)'; c.font='700 17px '+FM; c.fillText(gap,px+86,y+42);
  }
  c.restore();
}

/* ---------- typography ---------- */
function outlined(c,txt,x,y,fill,stroke,sw,outer,ow){
  c.lineJoin='round';
  if(outer){ c.strokeStyle=outer; c.lineWidth=ow; c.strokeText(txt,x,y); }
  c.strokeStyle=stroke; c.lineWidth=sw; c.strokeText(txt,x,y);
  c.fillStyle=fill; c.fillText(txt,x,y);
}
function chapter(c,t,n,ko,sub,s0,dark,e){
  var e2=Math.min(s0+1650,e||1e12), inn=eo(seg(t,s0,s0+360)), out=seg(t,e2-250,e2);
  if(inn<=0||out>=1) return;
  var x=P.x-30, y=P.y+200;
  c.save(); c.textBaseline='middle';
  c.font='84px '+FT; var tw=c.measureText(ko).width, bw=(tw+70)*inn*(1-ei(out));
  var nd=(1-eback(cl(inn)))*-120;
  c.fillStyle=OR; c.fillRect(x,y+nd,120,120);
  c.fillStyle=NAVY; c.font='74px '+FT; c.fillText(n,x+14,y+66+nd);
  c.save(); c.beginPath(); c.rect(x+120,y,bw,120); c.clip();
  c.fillStyle=dark?'#2a0f0a':NAVY; c.fillRect(x+120,y,tw+70,120);
  var jx=dark?(rnd(Math.floor(t/30))-.5)*8:0;
  c.font='84px '+FT; c.fillStyle=CR; c.fillText(ko,x+154+jx,y+66);
  c.restore();
  c.globalAlpha=inn*(1-out);
  c.font='700 30px '+FK; c.lineWidth=8; c.strokeStyle='rgba(4,10,18,.85)'; c.lineJoin='round';
  c.strokeText(sub,x+20,y+152); c.fillStyle=CR; c.fillText(sub,x+20,y+152);
  c.restore();
}
function starburst(c,r0,r1,n,fill){
  c.beginPath();
  for(var i=0;i<n*2;i++){ var r=i%2?r0:r1+rnd(i)*r1*.2, an=i/(n*2)*Math.PI*2; if(i) c.lineTo(Math.cos(an)*r,Math.sin(an)*r); else c.moveTo(Math.cos(an)*r,Math.sin(an)*r); }
  c.closePath(); c.fillStyle=fill; c.fill(); c.strokeStyle=NAVY; c.lineWidth=8; c.stroke();
}
function balloonIcon(c,x,y,r){
  c.save(); c.translate(x,y);
  c.fillStyle=CR; c.beginPath(); c.arc(0,0,r,0,Math.PI*2); c.fill();
  c.fillStyle=OR; c.beginPath();
  for(var i=0;i<10;i++){ var rr=i%2?r*.38:r*.78, a=-Math.PI/2+i*Math.PI/5; if(i) c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr); else c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr); }
  c.closePath(); c.fill(); c.restore();
}

/* ---------- collect: 예측 보드 (누가 누구에게 걸었나) + 카운트다운 ---------- */
function betNicks(i){ var b=R.bets||{}; return Object.keys(b).filter(function(u){ return b[u]===i; }); }
function collectBoard(c,t){
  var n=N(), rowH=Math.min(54,330/n), x0=1110, y0=196, w=640, h=176+n*rowH+170;
  var inP=seg(t,160,560), ox=(1-eback(inP))*760;
  if(inP<=0) return;
  c.save(); c.translate(ox,0); c.textBaseline='middle';
  if(inP<1){ c.fillStyle='rgba(245,243,239,'+(.6*(1-inP))+')'; for(var i=0;i<8;i++) c.fillRect(x0+w+20+rnd(i)*200,y0+20+i*70,260+rnd(i+3)*260,6); }
  c.transform(1,0,-.07,1,0,0); c.translate(y0*.07+34,0);
  c.fillStyle='rgba(0,0,0,.45)'; c.fillRect(x0+16,y0+20,w,h);
  c.fillStyle=CR; c.fillRect(x0,y0,w,h);
  c.fillStyle=OR; c.fillRect(x0,y0,18,h);
  c.fillStyle=NAVY; c.fillRect(x0+18,y0,w-18,86);
  c.fillStyle=OR; c.font='56px '+FT; c.fillText('1등을 맞혀라!',x0+44,y0+45);
  var total=Object.keys(R.bets||{}).length;
  c.fillStyle=CR; c.font='800 22px '+FK; c.textAlign='right'; c.fillText('예측 '+total+'명',x0+w-26,y0+45); c.textAlign='left';
  var cmd=String(R.command||'!경주')+' 번호';
  c.fillStyle=NAVY; c.beginPath(); c.roundRect(x0+44,y0+102,w-84,58,12); c.fill();
  c.fillStyle='rgba(245,243,239,.7)'; c.font='700 20px '+FK; c.fillText('채팅',x0+66,y0+131);
  c.fillStyle=OR; fitFont(c,cmd,'900 ',34,w-220,FK,18); c.fillText(cmd,x0+126,y0+131);
  var maxC=1; counts.forEach(function(v){ maxC=Math.max(maxC,v); });
  var now=performance.now();
  for(var r=0;r<n;r++){
    var ry=y0+176+r*rowH, cy=ry+rowH/2, cnt=counts[r]||0, bp=bump[r]?1-seg(now-bump[r],0,480):0, racer=R.racers[r]||{};
    if(r%2===0){ c.fillStyle='rgba(23,36,55,.06)'; c.fillRect(x0+30,ry,w-50,rowH); }
    var sq=rowH-12;
    c.fillStyle=SILK[r%8]; c.fillRect(x0+44,ry+6,sq,sq); c.strokeStyle=NAVY; c.lineWidth=3; c.strokeRect(x0+44,ry+6,sq,sq);
    c.fillStyle=NAVY; c.font=Math.round(sq*.72)+'px '+FT; c.textAlign='center'; c.fillText(String(r+1),x0+44+sq/2,cy+2); c.textAlign='left';
    c.fillStyle=NAVY; fitFont(c,nameOf(r),'900 ',Math.round(rowH*.5),130,FK,14); c.fillText(nameOf(r),x0+56+sq,cy+1);
    if(racer.emoji){ c.font=Math.round(rowH*.4)+'px '+FK; c.fillText(String(racer.emoji),x0+196+sq,cy+1); }
    var bx=x0+236+sq, bw=w-bx+x0-110, fillW=bw*cnt/maxC;
    c.fillStyle='rgba(23,36,55,.12)'; c.beginPath(); c.roundRect(bx,ry+9,bw,rowH-18,(rowH-18)/2); c.fill();
    if(cnt>0){ c.fillStyle=bp>0?mix(OR,'#ffffff',bp*.5):OR; c.beginPath(); c.roundRect(bx,ry+9,Math.max(rowH-18,fillW),rowH-18,(rowH-18)/2); c.fill();
      var nk=betNicks(r), nt=nk.length?nk[nk.length-1]+(nk.length>1?' 외 '+(nk.length-1):''):'';
      c.fillStyle=fillW>120?CR:NAVY; fitFont(c,nt,'700 ',Math.round(rowH*.32),bw-24,FK,11); c.fillText(nt,fillW>120?bx+14:bx+Math.max(rowH-18,fillW)+10,cy+1,bw-24); }
    c.save(); c.translate(x0+w-56,cy); c.scale(1+bp*.5,1+bp*.5); c.textAlign='center';
    c.fillStyle=cnt>0?NAVY:'rgba(23,36,55,.35)'; c.font='900 '+Math.round(rowH*.44)+'px '+FK; c.fillText(cnt+'명',0,1); c.restore();
  }
  var yc=y0+176+n*rowH+22;
  c.strokeStyle='rgba(23,36,55,.25)'; c.lineWidth=3; c.setLineDash([10,10]); line(c,x0+44,yc-10,x0+w-30,yc-10); c.setLineDash([]);
  var left=Math.max(0,R.joinMs-t), sec=Math.ceil(left/1000), urgent=left>0&&sec<=5;
  if(left>0){
    c.fillStyle='rgba(23,36,55,.6)'; c.font='800 22px '+FK; c.fillText('출발까지',x0+48,yc+20);
    var sp2=urgent?eback(cl(((R.joinMs-left)%1000)/180)):1, sc=urgent?lerp(1.6,1,sp2):1;
    c.save(); c.translate(x0+190,yc+64); c.scale(sc,sc);
    c.font='110px '+FT; c.fillStyle=urgent?RED:NAVY; c.fillText(String(sec),6,6);
    c.fillStyle=urgent?OR:NAVY; c.fillText(String(sec),0,0);
    c.restore();
    c.fillStyle=NAVY; c.font='900 36px '+FK; c.fillText('초',x0+190+(sec>=10?130:72),yc+80);
  } else {
    var mp=eback(seg(t,R.joinMs,R.joinMs+260));
    c.save(); c.translate(x0+48,yc+64); c.scale(lerp(1.8,1,mp),lerp(1.8,1,mp)); c.font='100px '+FT; outlined(c,'마감!',0,0,OR,NAVY,12,null,0); c.restore();
  }
  c.fillStyle=NAVY; c.fillRect(x0+340,yc+52,w-380,20);
  c.fillStyle=urgent?OR:MINT; c.fillRect(x0+343,yc+55,(w-386)*cl(left/R.joinMs),14);
  c.restore();
}
/* 마지막 3초: 게이트 위로 큰 숫자 */
function gateCount(c,t){
  var left=R.joinMs-t; if(left>3000||left<=-500) return;
  var sec=Math.max(0,Math.ceil(left/1000)), ph=left>0?(3000-left)%1000:seg(-left,0,500)*1000, p=eback(cl(ph/200)), a=left>0?1-seg(ph,750,1000)*.35:1-seg(-left,200,500);
  var txt=left>0?String(sec):'준비!';
  c.save(); c.globalAlpha=a; c.translate(900,640); c.scale(lerp(2.4,1,p),lerp(2.4,1,p)); c.textAlign='center'; c.textBaseline='middle';
  c.strokeStyle='rgba(255,91,23,'+(1-cl(ph/600))+')'; c.lineWidth=10; c.beginPath(); c.arc(0,0,130+ph*.2,0,Math.PI*2); c.stroke();
  c.font=(left>0?'230px ':'150px ')+FT; c.fillStyle=NAVY; c.fillText(txt,10,14);
  outlined(c,txt,0,0,left>0?CR:OR,NAVY,18,null,0);
  c.restore();
}

/* ---------- run overlays ---------- */
function goText(c,t,cam){
  if(t<0||t>1000) return;
  // 게이트 폭발: 섬광 + 흙먼지 링
  var gp=w2s(cam,GX,Zd(340),120), fl=1-seg(t,0,260);
  if(fl>0){ var g=c.createRadialGradient(gp.x,gp.y,0,gp.x,gp.y,900); g.addColorStop(0,'rgba(255,250,236,'+(.95*fl)+')'); g.addColorStop(1,'rgba(255,250,236,0)'); c.fillStyle=g; c.fillRect(0,0,W,H); }
  c.save(); c.translate(gp.x,gp.y);
  for(var i=0;i<26;i++){ var a=rnd(i+40)*Math.PI*2, r=(80+t*.9*(.6+rnd(i+41)*.8)), al=(1-seg(t,0,900))*.5;
    c.fillStyle='rgba(226,210,172,'+al+')'; c.beginPath(); c.arc(Math.cos(a)*r*1.4,Math.sin(a)*r*.5,30+t*.06,0,Math.PI*2); c.fill(); }
  c.restore();
  var p=seg(t,0,200), s=lerp(2.2,1,eback(p)), a2=1-seg(t,750,1000);
  c.save(); c.globalAlpha=a2; c.translate(1180,470); c.rotate(-.08+.08*eo(p)); c.scale(s,s);
  c.textAlign='center'; c.textBaseline='middle';
  c.save(); c.rotate(t*.002); c.scale(.8,.8); starburst(c,200,300,18,CR); c.restore();
  c.font='220px '+FT; c.fillStyle=NAVY; c.fillText('출발!',12,16);
  outlined(c,'출발!',0,0,OR,NAVY,20,null,0);
  c.restore();
}
function tensionFX(c,t,cam){
  if(t<TL.A||t>=TL.RES) return;
  var ten=seg(t,TL.A,TL.F);
  if(t<TL.F){
    var wz=laneZ(TL.win), lp=w2s(cam,runnerX(TL.win,worldS(t)),wz,120);
    var og=c.createRadialGradient(lp.x,lp.y,320,lp.x,lp.y,1200);
    og.addColorStop(0,'rgba(255,91,23,0)'); og.addColorStop(1,'rgba(255,60,10,'+Math.min(.45,ten*.45)+')');
    c.fillStyle=og; c.fillRect(0,0,W,H);
    c.save(); c.translate(lp.x,lp.y);
    for(var i=0;i<46;i++){
      var a=rnd(i+400)*Math.PI*2, r0=360+rnd(i+401)*200+((t*.3)%60), r1=r0+260+rnd(i+402)*420;
      c.strokeStyle='rgba(245,243,239,'+(ten*.22)+')'; c.lineWidth=2+rnd(i+403)*4;
      c.beginPath(); c.moveTo(Math.cos(a)*r0,Math.sin(a)*r0); c.lineTo(Math.cos(a)*r1,Math.sin(a)*r1); c.stroke();
    }
    c.restore();
  }
  var hb=70*eo(seg(t,TL.A,TL.A+400))*(1-seg(t,TL.HIT,TL.HIT+220));
  letterbox(c,hb);
}
function impactFX(c,t,cam){
  if(t<TL.F||t>=TL.PHO+300) return;
  var fp=w2s(cam,FIN,laneZ(TL.win),120);
  if(t<TL.HIT){
    c.fillStyle='rgba(255,250,240,.92)'; c.fillRect(0,0,W,H);
    c.save(); c.translate(fp.x,fp.y);
    for(var i=0;i<40;i++){ var a=i/40*Math.PI*2+rnd(i)*.1, r0=110, r1=1400;
      c.fillStyle=i%2?OR:NAVY; c.beginPath(); c.moveTo(Math.cos(a-.02)*r0,Math.sin(a-.02)*r0); c.lineTo(Math.cos(a)*r1,Math.sin(a)*r1); c.lineTo(Math.cos(a+.03)*r0,Math.sin(a+.03)*r0); c.fill(); }
    c.restore();
  } else {
    var fl=Math.pow(1-seg(t,TL.HIT,TL.HIT+240),2);
    c.fillStyle='rgba(255,250,240,'+(.85*fl)+')'; c.fillRect(0,0,W,H);
  }
}
/* 사진 판정 정지 컷: 슬릿 스캔 흑백 + 세피아 + 세로 판정선 + 시간 눈금 + 필름 테두리 */
function photoLook(c,t,cam){
  if(t<TL.HIT||t>=TL.PHO) return;
  c.save();
  c.globalCompositeOperation='saturation'; c.fillStyle='#808080'; c.fillRect(P.x,P.y,P.w,P.h);
  c.globalCompositeOperation='multiply'; c.fillStyle='#dccba2'; c.fillRect(P.x,P.y,P.w,P.h);
  c.globalCompositeOperation='source-over';
  for(var y=P.y;y<P.y+P.h;y+=4){ c.fillStyle='rgba(0,0,0,.05)'; c.fillRect(P.x,y,P.w,1); }
  var lx=w2s(cam,FIN,1,0).x;
  c.fillStyle='rgba(224,52,44,.95)'; c.fillRect(lx-3,P.y,6,P.h);
  c.fillStyle='rgba(224,52,44,.25)'; c.fillRect(lx-14,P.y,28,P.h);
  var sy=P.y+((t-TL.HIT)*1.6%P.h);
  c.fillStyle='rgba(255,255,255,.14)'; c.fillRect(P.x,sy,P.w,10);
  // 시간 눈금 (슬릿 스캔: 가로축 = 시간)
  var wz=laneZ(TL.win), vpx=TL.v[TL.win]/wz*cam.z, yb=P.y+P.h-86;
  c.fillStyle='rgba(11,11,11,.82)'; c.fillRect(P.x,yb-6,P.w,40);
  c.strokeStyle='#efe2c4'; c.fillStyle='#efe2c4'; c.font='700 17px '+FM; c.textAlign='center'; c.textBaseline='middle';
  for(var k=-80;k<=240;k++){ var x=lx-k*10*vpx; if(x<P.x+10||x>P.x+P.w-10) continue; var big=k%5===0; c.lineWidth=big?3:1.5; line(c,x,yb-6,x,yb+(big?12:4));
    if(big&&k%10===0) c.fillText(fmtT(TL.F+k*10),x,yb+24); }
  c.fillStyle='#0b0b0b'; c.fillRect(P.x,P.y,P.w,46); c.fillRect(P.x,P.y+P.h-46,P.w,46);
  for(var x2=P.x+20;x2<P.x+P.w;x2+=56){ c.fillStyle='#efe2c4'; c.fillRect(x2,P.y+12,30,22); c.fillRect(x2,P.y+P.h-34,30,22); }
  c.textAlign='left';
  c.fillStyle='#0b0b0b'; c.fillRect(P.x+60,P.y+70,540,56);
  c.fillStyle=RED; c.beginPath(); c.arc(P.x+92,P.y+98,12,0,Math.PI*2); c.fill();
  c.fillStyle='#efe2c4'; c.font='800 30px '+FM; c.fillText('PHOTO FINISH · 사진 판정',P.x+116,P.y+99);
  c.fillStyle='#0b0b0b'; c.fillRect(P.x+P.w-470,P.y+70,410,56);
  c.fillStyle='#efe2c4'; c.font='800 32px '+FM; c.textAlign='right'; c.fillText('1착  '+fmtT(TL.F)+'s',P.x+P.w-80,P.y+99);
  c.restore();
}
function winText(c,t){
  if(t<TL.HIT||t>TL.PHO+260) return;
  var p=seg(t,TL.HIT,TL.HIT+200), s=lerp(1.9,1,eback(p))*(1+seg(t,TL.HIT+200,TL.PHO)*.05), a=1-seg(t,TL.PHO,TL.PHO+260);
  var ang=lerp(-.105,0,eo(p))-.06;
  c.save(); c.globalAlpha=a; c.translate(1450,480); c.rotate(ang);
  c.save(); c.rotate(t*.0015); c.scale(s*.86,s*.86); starburst(c,180,270,18,CR); c.restore();
  c.scale(s,s); c.textAlign='center'; c.textBaseline='middle';
  c.font='220px '+FT; c.fillStyle=GOLD; c.fillText('1착!',12,16);
  outlined(c,'1착!',0,0,OR,NAVY,22,null,0);
  var nm=nameOf(TL.win);
  fitFont(c,nm,'',70,400,FT,30); var tw=Math.min(400,c.measureText(nm).width);
  c.fillStyle=NAVY; c.fillRect(-tw/2-90,108,tw+180,92);
  c.fillStyle=SILK[TL.win%8]; c.fillRect(-tw/2-80,116,76,76);
  fitFont(c,nm,'',70,400,FT,30); c.fillStyle=CR; c.textAlign='left'; c.fillText(nm,-tw/2+14,156);
  c.restore();
}
/* 여운: 시상대 (2착 · 1착 · 3착) */
function podium(c,t){
  var T=TL.RES+650; if(t<T) return;
  var top=TL.order.slice(0,Math.min(3,N())), slots=[1,0,2], cx=600, bw=200, base=850, hs=[180,128,92];
  c.save(); c.textBaseline='middle'; c.textAlign='center';
  slots.forEach(function(r,k){
    var ri=top[r]; if(ri===undefined) return;
    var st=T+(2-r)*170, p=seg(t,st,st+420); if(p<=0) return;
    var hh=hs[r]*eback(p), x=cx+(k-1)*(bw+16)-bw/2, y=base-hh;
    c.fillStyle='rgba(0,0,0,.4)'; c.fillRect(x+10,y+10,bw,hh);
    c.fillStyle=r===0?GOLD:r===1?'#d9dee6':'#d79a62'; c.fillRect(x,y,bw,hh); c.strokeStyle=NAVY; c.lineWidth=5; c.strokeRect(x,y,bw,hh);
    c.fillStyle=CR; c.fillRect(x-8,y-14,bw+16,16); c.strokeRect(x-8,y-14,bw+16,16);
    c.save(); c.beginPath(); c.rect(x,y,bw,hh); c.clip();
    c.fillStyle=NAVY; c.font=(r===0?'84px ':'64px ')+FT; c.fillText((r+1)+'착',x+bw/2,y+(r===0?62:48)); c.restore();
    var tp=eo(seg(t,st+260,st+520)); if(tp<=0) return;
    c.save(); c.globalAlpha=tp; c.translate(x+bw/2,y-48-(1-tp)*30);
    var nm=nameOf(ri); c.font='900 28px '+FK; var tw=Math.min(bw+20,c.measureText(nm).width);
    c.fillStyle='rgba(8,14,26,.9)'; c.beginPath(); c.roundRect(-tw/2-34,-24,tw+70,48,10); c.fill();
    c.fillStyle=SILK[ri%8]; c.beginPath(); c.roundRect(-tw/2-28,-18,36,36,6); c.fill();
    c.fillStyle=CR; c.font='900 28px '+FK; c.textAlign='left'; c.fillText(nm,-tw/2+16,1,bw+20);
    c.restore();
  });
  c.restore();
}

/* ---------- result card ---------- */
function resultCard(c,t){
  var T=TL.RES; if(t<T+40) return;
  var x0=1130,y0=232,w=690,h=650;
  var inP=seg(t,T+40,T+460), ox=(1-eback(inP))*900;
  c.save(); c.translate(ox,0);
  if(inP<1){ c.fillStyle='rgba(245,243,239,'+(.6*(1-inP))+')'; for(var i=0;i<8;i++) c.fillRect(x0+w+20+rnd(i)*200,y0+40+i*75,300+rnd(i+3)*300,6); }
  c.transform(1,0,-.08,1,0,0); c.translate(y0*.08+40,0);
  c.fillStyle='rgba(0,0,0,.45)'; c.fillRect(x0+18,y0+22,w,h);
  c.fillStyle=CR; c.fillRect(x0,y0,w,h);
  c.fillStyle=OR; c.fillRect(x0,y0,18,h);
  c.fillStyle=NAVY; c.fillRect(x0+18,y0,w-18,96);
  c.textBaseline='middle';
  c.fillStyle=OR; c.font='68px '+FT; c.fillText('결과!',x0+50,y0+52);
  c.fillStyle='rgba(245,243,239,.75)'; c.font='700 22px '+FM; c.fillText('RACE #'+NO+' · '+fmtT(TL.F)+'s',x0+230,y0+52);
  // 1착 이름
  var np=seg(t,T+380,T+620), ns=lerp(1.9,1,eback(np));
  if(np>0){
    c.save(); c.globalAlpha=Math.min(1,np*3); c.translate(x0+50,y0+214); c.scale(ns,ns);
    c.fillStyle=SILK[TL.win%8]; c.fillRect(0,-62,124,124); c.strokeStyle=NAVY; c.lineWidth=6; c.strokeRect(0,-62,124,124);
    var nm=nameOf(TL.win); fitFont(c,nm,'',150,w-260,FT,40);
    c.fillStyle=SILK[TL.win%8]==='#F5F3EF'?OR:SILK[TL.win%8]; c.fillText(nm,154,12); c.fillStyle=NAVY; c.fillText(nm,146,4);
    c.restore();
  }
  // 순위 줄
  var sp=seg(t,T+620,T+820);
  c.globalAlpha=sp; c.fillStyle=NAVY;
  var line2=TL.order.slice(1,4).map(function(ri,k){ return (k+2)+'착 '+nameOf(ri); }).join(' · ');
  fitFont(c,line2||'단독 질주','800 ',30,w-110,FK,16); c.fillText(line2||'단독 질주',x0+56,y0+330);
  c.fillStyle='rgba(23,36,55,.6)'; c.font='800 26px '+FK;
  c.fillText(TL.betN?('예측 '+TL.betN+'명 중 '+TL.hits.length+'명 적중'):'예측 참가자 없음',x0+56,y0+372);
  c.globalAlpha=1;
  c.strokeStyle='rgba(23,36,55,.25)'; c.lineWidth=3; c.setLineDash([10,10]);
  c.beginPath(); c.moveTo(x0+50,y0+404); c.lineTo(x0+w-40,y0+404); c.stroke(); c.setLineDash([]);
  // 적중자
  var cp=eo(seg(t,T+760,T+1060));
  c.save(); c.globalAlpha=cp; c.translate((1-cp)*80,0);
  c.fillStyle='rgba(23,36,55,.6)'; c.font='700 28px '+FK; c.fillText(TL.hits.length?'1등 적중':'적중자',x0+56,y0+440);
  var nick=TL.hits.length?(TL.hits[0]+(TL.hits.length>1?' 외 '+(TL.hits.length-1)+'명':'')):'적중자 없음';
  c.fillStyle=TL.hits.length?NAVY:'rgba(23,36,55,.45)'; fitFont(c,nick,'900 ',TL.hits.length?84:64,w-110,FK,36); c.fillText(nick,x0+52,y0+502);
  c.restore();
  // 별풍선
  var gp=seg(t,T+940,T+1200), gs=lerp(.4,1,eback(gp));
  if(gp>0&&BAL>0){
    c.save(); c.translate(x0+56,y0+596); c.scale(gs,gs); c.globalAlpha=Math.min(1,gp*2);
    c.fillStyle=OR; c.beginPath(); c.roundRect(0,-40,420,80,40); c.fill();
    balloonIcon(c,42,0,28);
    c.fillStyle=CR; c.font='900 46px '+FK; c.fillText('별풍선 '+BAL.toLocaleString()+'개',86,2,320);
    c.restore();
  }
  // 도장
  var bp=seg(t,T+560,T+800);
  if(bp>0){
    var bs=lerp(3,1,eback(bp)), hit=TL.hits.length>0, col=hit?MINT:OR;
    c.save(); c.translate(x0+w-60,y0+20); c.rotate(-.2); c.scale(bs,bs); c.globalAlpha=Math.min(1,bp*2.5);
    if(bp<1){ c.strokeStyle=col; c.lineWidth=6; for(var j=0;j<12;j++){ var a=j/12*Math.PI*2; c.beginPath(); c.moveTo(Math.cos(a)*130,Math.sin(a)*130); c.lineTo(Math.cos(a)*(150+bp*60),Math.sin(a)*(150+bp*60)); c.stroke(); } }
    c.fillStyle=NAVY; c.beginPath(); c.arc(6,8,112,0,Math.PI*2); c.fill();
    c.fillStyle=col; c.beginPath(); c.arc(0,0,112,0,Math.PI*2); c.fill();
    c.strokeStyle=CR; c.lineWidth=5; c.beginPath(); c.arc(0,0,96,0,Math.PI*2); c.stroke();
    c.textAlign='center'; c.fillStyle=CR; c.font='84px '+FT; c.fillText(hit?'적중':'1착',0,-4);
    c.font='800 20px '+FM; c.fillText(hit?'HIT':'WINNER',0,58);
    c.restore();
  }
  c.restore();
}

/* ---------- render ---------- */
function render(t){
  X.setTransform(1,0,0,1,0,0); X.clearRect(0,0,W,H);
  if(MODE==='none'||!R) return;
  var fade=MODE==='run'?1-seg(t,TL.END,TL.END+400):1;
  if(fade<=0) return;
  X.save(); X.globalAlpha=fade;
  var ot=paused?99999:performance.now()-openAt;
  var rv=Math.min(eo(seg(ot,0,450)),MODE==='collect'?eo(seg(t,0,450)):1), ph=Math.max(4,P.h*rv), py=P.y+(P.h-ph)/2;
  var cam, s, amb, o;
  if(MODE==='collect'){
    cam=camCollect(t); s=0; amb=t;
    o={run:false,gate:0,tags:false,tagSet:[],soloA:1,flashes:t>R.joinMs-3000?.5:.15,cheer:t>R.joinMs-3000};
  } else {
    var frozen=t>=TL.F&&t<TL.PHO;
    cam=camRun(t); s=worldS(t); amb=frozen?TL.F:(t>=TL.RES?TL.RES+(t-TL.RES)*.25:t);
    var ten=seg(t,TL.A,TL.F);
    var tagSet=t>=TL.RES?[TL.win]:(t>=TL.c1&&t<TL.c2&&TL.closeIdx!=null?[TL.closeIdx]:ranking(s).slice(0,t<TL.A?3:2));
    o={run:true,gate:eo(seg(t,0,240)),tags:!frozen,tagSet:tagSet,ranks:true,photo:t>=TL.HIT&&t<TL.PHO,frozen:frozen,
       dim:(t>=TL.A&&t<TL.F)?eo(ten)*.8:(t>=TL.RES?.9*eo(seg(t,TL.RES,TL.RES+500)):0), lead:t>=TL.RES?[TL.win]:TL.order.slice(0,3), finGlow:t<TL.F?ten:(t<TL.RES?1-seg(t,TL.PHO,TL.PHO+800):0),
       glowIdx:t>=TL.F?TL.win:-1, halo:t>=TL.RES?eo(seg(t,TL.RES,TL.RES+500)):0,
       flashes:(t>=TL.HIT&&t<TL.RES)?1:(t>=TL.A&&t<TL.F?.6:.2), cheer:t>=TL.A||t<900, soloA:t>=TL.RES?1-eo(seg(t,TL.RES+100,TL.RES+600)):1};
  }
  // 카메라 속도 (전경 난간 모션 블러용)
  if(camPrev&&camPrev.k===KEY&&t>camPrev.t&&t-camPrev.t<120&&!o.frozen){ var v=(cam.x-camPrev.x)/(t-camPrev.t)*cam.z; camVel=lerp(camVel,v,.3); } else if(o.frozen) camVel=0;
  camPrev={x:cam.x,t:t,k:KEY};
  X.save(); X.shadowColor='rgba(0,0,0,.55)'; X.shadowBlur=50; X.shadowOffsetY=14;
  panelPath(X,P.x,py,P.w,ph,P.k); X.fillStyle='#061019'; X.fill(); X.restore();
  X.save(); panelPath(X,P.x,py,P.w,ph,P.k); X.clip();
  drawWorld(X,cam,s,amb,o);
  if(MODE==='run'){
    if(t>=TL.RES){
      var wa=eo(seg(t,TL.RES+150,TL.RES+700));
      X.save(); X.globalAlpha=.16*wa; X.font='300px '+FT; X.textBaseline='middle'; X.strokeStyle=CR; X.lineWidth=3;
      X.strokeText('WINNER WINNER',160-(t-TL.RES)*.05,470); X.restore();
    }
    var spd=Math.abs(camVel);
    streaks(X,t,t<TL.F?cl(spd*.9,0,.6)*(t<TL.A?1:.5):0,3.4,46);
  }
  vignette(X,.55);
  if(MODE==='run'){ tensionFX(X,t,cam); photoLook(X,t,cam); impactFX(X,t,cam); cutFlash(X,t); }
  if(MODE==='run'&&t>=TL.RES){ var a2=.45*(1-seg(t,TL.RES,TL.RES+260)); X.fillStyle='rgba(255,240,210,'+a2+')'; X.fillRect(0,0,W,H); }
  grain(X,t);
  X.restore();
  hud(X,t,py,ph);
  if(rv>=.97){
    if(MODE==='collect'){ gateCount(X,t); collectBoard(X,t); }
    else {
      goText(X,t,cam);
      chapter(X,t,'02','질주','게이트 오픈 — 트래킹 카메라 추적 중',1100,false,TL.c1);
      chapter(X,t,'03','막판','결승선 직전, 누가 먼저 코를 내미나',TL.A,true,TL.F);
      winText(X,t);
      podium(X,t);
      resultCard(X,t);
    }
  }
  X.restore();
}

/* ---------- sound cues ---------- */
function cue(t,silent){
  if(!window.FX) return;
  var at=function(k,ms,fn){ if(t>=ms&&!cues[k]){ cues[k]=1; if(!silent) fn(); } };
  if(MODE==='collect'){
    at('open',0,function(){ FX.sound('whoosh'); });
    var left=R.joinMs-t, sec=Math.ceil(left/1000);
    if(left>0&&sec<=5&&sec!==lastSec){ lastSec=sec; if(!silent) FX.sound('timer'); }
    return;
  }
  at('go',0,function(){ FX.sound('buzzer'); FX.sound('whoosh'); FX.sound('stop'); });
  for(var k=0;k*300+520<TL.A;k++) (function(k){ at('hoof'+k,520+k*300,function(){ FX.sound('tick'); }); })(k);
  at('cut1',TL.c1,function(){ FX.sound('whoosh'); });
  at('cut2',TL.c2,function(){ FX.sound('whoosh'); });
  at('tension',TL.A,function(){ FX.drumStart(200); FX.sound('reveal'); });
  at('impact',TL.F,function(){ FX.drumStop(); FX.sound('stop'); FX.flash('rgba(255,250,236,.35)'); });
  at('photo',TL.HIT,function(){ FX.sound('flip'); });
  for(var j=1;j<TL.order.length;j++) (function(j){ var ri=TL.order[j]; at('arr'+j,TL.arr[ri],function(){ if(t<TL.PHO) return; FX.sound('pop'); }); })(j);
  at('back',TL.PHO,function(){ FX.sound('whoosh'); });
  at('res',TL.RES+40,function(){ FX.sound('reveal'); });
  at('name',TL.RES+400,function(){
    FX.sound(TL.hits.length?'jackpot':'win');
    FX.confetti({x:600,y:420,count:TL.hits.length?200:110,colors:TL.hits.length?['#FFC928','#FF5B17','#fff','#00CB84']:undefined});
  });
  at('stamp',TL.RES+560,function(){ FX.sound('stop'); });
  at('pod',TL.RES+650,function(){ FX.sound('coin'); });
  at('banner',TL.RES+1300,function(){
    var racer=R.racers[TL.win], txt=racer?(String(racer.emoji||'')+' '+String(racer.name||'')+' 1등').trim():'';
    var an=document.getElementById('anchor'), ms=Math.max(1500,TL.END-(TL.RES+1300));
    if(TL.hits.length) FX.winner({nick:TL.hits[0]+(TL.hits.length>1?' 외 '+(TL.hits.length-1)+'명':''),text:txt,sub:'1등 예측 적중!',anchor:an,above:true,ms:ms,icon:'🎯',balloons:BAL});
    else FX.winner({text:txt,sub:'적중자 없음',anchor:an,above:true,ms:ms,icon:'🏁'});
  });
}

/* ---------- state handling ---------- */
function stopAll(){ MODE='none'; KEY=null; TL=null; if(window.FX){ FX.drumStop(); FX.hideWinner(); } X.setTransform(1,0,0,1,0,0); X.clearRect(0,0,W,H); }
function setCounts(r,sound){
  var n=r.racers.length, nc=[]; for(var i=0;i<n;i++) nc.push(0);
  Object.keys(r.bets||{}).forEach(function(u){ var i=r.bets[u]; if(nc[i]!==undefined) nc[i]++; });
  var total=Object.keys(r.bets||{}).length, now=performance.now();
  for(var j=0;j<n;j++){ if(counts.length===n&&nc[j]>counts[j]) bump[j]=now; }
  if(sound&&lastTotal>=0&&total>lastTotal&&window.FX) FX.sound('pop');
  lastTotal=total; counts=nc;
}
function nextNo(){ var no=1; try{ no=(Number(localStorage.getItem('raceNo'))||0)+1; localStorage.setItem('raceNo',String(no)); }catch(e){ no=1+Math.floor(Math.random()*900); } NO=String(no).padStart(3,'0'); }
function startCollect(r,key){
  var wasNone=MODE==='none';
  if(window.FX){ FX.drumStop(); FX.hideWinner(); }
  MODE='collect'; KEY=key; R=r; TL=null; cues={}; lastSec=-1; lastTotal=-1; counts=[]; bump=[]; BAL=0; resultSeen=false; dispPos=[]; camVel=0;
  if(wasNone) openAt=performance.now();
  setCounts(r,false);
  var t=Date.now()-(r.deadline-r.joinMs);
  if(t>300) cue(t,true);
}
function startRun(r,key){
  var wasNone=MODE==='none';
  if(window.FX){ FX.drumStop(); FX.hideWinner(); }
  MODE='run'; KEY=key; R=r; cues={}; BAL=0; resultSeen=false; dispPos=[];
  if(wasNone) openAt=performance.now();
  setCounts(r,false); buildRun(); nextNo();
  var t=Date.now()-r.startedAt;
  if(t>200){ cue(t-1,true); if(window.FX&&t>=TL.A&&t<TL.F) FX.drumStart(200); }
}
function onState(s){
  var r=s.race;
  if(s.status==='collecting'&&r){
    var key='c'+r.deadline;
    if(KEY!==key) startCollect(r,key); else { R=r; setCounts(r,true); }
  } else if(s.status==='running'&&r&&r.curves){
    var key2='r'+r.startedAt;
    if(KEY!==key2) startRun(r,key2);
  } else if(s.status==='showing_result'){
    if(r&&r.curves&&r.startedAt){ var key3='r'+r.startedAt; if(KEY!==key3) startRun(r,key3); }
    if(MODE==='run'&&s.result){ BAL=Number(s.result.balloon)||0; resultSeen=true; }
  } else if(s.status==='idle'){
    if(MODE==='collect') stopAll();
    else if(MODE==='run'&&!resultSeen&&!paused&&Date.now()-R.startedAt<TL.RES) stopAll();   // 결과 전에 취소된 판
  }
}
window.seek=function(ms){ paused=true; seekT=ms; };
window.unseek=function(){ paused=false; };
function loop(){
  if(MODE!=='none'&&R){
    var t=paused?seekT:(MODE==='collect'?Date.now()-(R.deadline-R.joinMs):Date.now()-R.startedAt);
    if(!paused) cue(t,false);
    render(t);
    if(MODE==='run'&&!paused&&t>TL.END+450) stopAll();
  }
  requestAnimationFrame(loop);
}
window.onRaceState=onState;
if(document.fonts&&document.fonts.load){
  Promise.all([document.fonts.load('100px '+FT),document.fonts.load('900 40px '+FK),document.fonts.load('700 40px '+FK),document.fonts.load('800 20px '+FM)]).catch(function(){});
}
requestAnimationFrame(loop);
})();
<\/script>
<script>
function connect(){
  var ws=new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage=function(e){ try{
    var msg=JSON.parse(e.data); FX.handle(msg)
    if(msg.type==='game:state'&&msg.data&&msg.data.id==='race') window.onRaceState(msg.data)
    if(msg.type==='ping') ws.send(JSON.stringify({type:'pong'}))
  }catch(err){} }
  ws.onopen=function(){ if(window.__wsDown) location.reload() }   // 서버 재시작(앱 업데이트) → 새 코드 로드
  ws.onclose=function(){ window.__wsDown=true; setTimeout(connect,2000) }
}
connect()
<\/script>
</body>
</html>`
