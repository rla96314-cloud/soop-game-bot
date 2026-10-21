// OBS 오버레이 페이지: rps — '격투 게임 VS 화면' 연출 (선택 → 가위·바위 → 보! 기합 → 격돌 → 결과)
// 모션 언어: .inhabited/motion-language.md (기준: fish.ts '수중 다큐 카메라'). 캔버스 1장 + 타임라인 렌더 + 카메라 리그.
// 엔진 state.rps(RpsState: picks, deadline, joinMs, command, streamer, startedAt, revealMs, winners, draws, losers) 를 그대로 받는다.
//  - 모집(collecting): VS 화면 + 라운드 타이머 + 손 선택 집계. 마감 5초 전부터 타이머가 쾅쾅 찍힘
//  - 공개(running, startedAt 기준 revealMs): 가위!(250) 바위!(650) → 보!! 기합(900~) → 손이 맞부딪히는 순간(1500) 히트스톱
//    왼쪽 '시청자 대표 손'은 판정과 그림이 맞도록 결과에서 고른다(이긴 사람이 있으면 이기는 손, 무승부만이면 같은 손, 아니면 지는 손)
//  - 결과(revealMs+100) 부터 여운: 사선 결과 카드(판정 → 도장 → 이긴 시청자 → 별풍선) + 배너
//  - startedAt / deadline 기준이라 OBS 새로고침으로 중간에 들어와도 이어서 재생, 새 판이 오면 이전 판은 끊는다
//  - setInterval/setTimeout 없이 rAF 한 개. 레이아웃은 전부 고정 좌표 (DOM 측정 없음)
import { FX_SCRIPT } from './_fx'

export const RPS_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>가위바위보 VS</title>
<meta name="viewport" content="width=1920">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@500;700;900&family=JetBrains+Mono:wght@500;700;800&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;padding:0;background:transparent !important;overflow:hidden;width:1920px;height:1080px}
  canvas{display:block;width:1920px;height:1080px}
  #anchor{position:fixed;left:240px;top:996px;width:760px;height:1px;pointer-events:none}
</style>
</head>
<body>
<canvas id="c" width="1920" height="1080"></canvas>
<div id="anchor"></div>
<script>${FX_SCRIPT}<\/script>
<script>
(function(){
var C=document.getElementById('c'), X=C.getContext('2d'), W=1920, H=1080;
var NAVY='#172437', OR='#FF5B17', CR='#F5F3EF', MINT='#00CB84', GOLD='#FFC61A', RED='#E0342C', GRAY='#8A94A6';
var FT='"Black Han Sans","Noto Sans KR",sans-serif', FK='"Noto Sans KR","Apple SD Gothic Neo",sans-serif', FM='"JetBrains Mono",ui-monospace,Menlo,monospace';
var P={x:140,y:100,w:1640,h:870,k:52};
var CX=960, CY=600, HS=1.12, TIP=168;
var EMOJI={rock:'✊',paper:'🖐️',scissors:'✌️'}, LABEL={rock:'바위',paper:'보',scissors:'가위'};
var BEATS={rock:'scissors',scissors:'paper',paper:'rock'}, LOSES={rock:'paper',scissors:'rock',paper:'scissors'};

/* ---------- helpers ---------- */
function cl(v,a,b){ if(a===undefined)a=0; if(b===undefined)b=1; return Math.max(a,Math.min(b,v)); }
function lerp(a,b,p){ return a+(b-a)*p; }
function seg(t,a,b){ return cl((t-a)/(b-a)); }
function eo(p){ return 1-Math.pow(1-p,3); }
function ei(p){ return p*p*p; }
function eio(p){ return p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2; }
function eback(p){ var c1=2.0,c3=c1+1; return 1+c3*Math.pow(p-1,3)+c1*Math.pow(p-1,2); }
function rnd(i){ var x=Math.sin(i*127.1+311.7)*43758.5453; return x-Math.floor(x); }
function fitFont(c,txt,weight,size,max,fam,min){ c.font=weight+size+'px '+fam; var w=c.measureText(txt).width; if(w>max){ size=Math.max(min||12,Math.floor(size*max/w)); c.font=weight+size+'px '+fam; } return size; }

/* ---------- state ---------- */
var MODE='none', S=null, KEY=null, TL=null, paused=false, seekT=0, cues={}, openAt=0;
var hc={rock:0,paper:0,scissors:0}, bump={}, lastTotal=-1, lastSec=-1, BAL=0, NO='001', resultSeen=false;

function buildRun(){
  var REV=Number(S.revealMs)||2200, k=Math.min(1,REV/2200);
  var w=(S.winners||[]).length, d=(S.draws||[]).length, l=(S.losers||[]).length, total=w+d+l;
  var res=w?'win':(d&&!l?'draw':(total?'lose':'none'));
  var st=S.streamer||'rock';
  var vh=res==='win'?LOSES[st]:res==='draw'?st:BEATS[st];
  TL={C1:250*k,C2:650*k,WIND:900*k,THR:1420*k,HIT:1500*k,HS:1580*k,RES:REV+100,END:REV+100+6500,
      res:res,st:st,vh:vh,w:w,d:d,l:l,total:total};
}

/* ---------- hand ---------- */
function rr(c,x,y,w,h,r){ c.beginPath(); c.roundRect(x,y,w,h,r); c.fill(); c.stroke(); }
function finger(c,bx,by,ang,len,wd){
  c.save(); c.translate(bx,by); c.rotate(ang);
  rr(c,-wd/2,-len,wd,len+24,wd/2);
  c.strokeStyle='rgba(23,36,55,.35)'; c.lineWidth=4; c.beginPath(); c.moveTo(-wd*.28,-len*.42); c.lineTo(wd*.28,-len*.42); c.stroke();
  c.strokeStyle=NAVY; c.lineWidth=7;
  c.restore();
}
function knuckle(c,x){ rr(c,x-19,-82,38,66,19); c.strokeStyle='rgba(23,36,55,.35)'; c.lineWidth=4; c.beginPath(); c.moveTo(x-9,-48); c.lineTo(x+9,-48); c.stroke(); c.strokeStyle=NAVY; c.lineWidth=7; }
/* 손 (손끝이 위, 손목이 아래 y=+110 기준). kind: rock/paper/scissors, side: 소매 색 */
/* 손 그림 (서버 /assets/rps-*.png). 못 불러오면 아래 벡터 손으로 그린다 */
var HIMG={};
['rock','paper','scissors'].forEach(function(k){ var im=new Image(); im.src='/assets/rps-'+k+'.png'; HIMG[k]=im; });
function drawHand(c,kind,side,skin,mini){
  c.lineJoin='round'; c.lineCap='round'; c.strokeStyle=NAVY; c.lineWidth=7;
  // 소매
  var sl=mini?40:900;
  c.fillStyle=side; c.fillRect(-74,128,148,sl); c.strokeRect(-74,128,148,sl);
  if(!mini){ c.fillStyle='rgba(0,0,0,.18)'; c.fillRect(-74,170,148,16); }
  var im=HIMG[kind];
  if(im&&im.complete&&im.naturalWidth){
    var h=340, w=h*im.naturalWidth/im.naturalHeight;
    if(skin&&skin!==CR) c.filter='grayscale(.85) brightness(.8)';
    c.drawImage(im,-w/2,150-h,w,h);
    c.filter='none';
    return;
  }
  c.fillStyle=skin||CR;
  if(kind==='paper'){
    finger(c,-54,-24,-.24,104,32); finger(c,-18,-34,-.08,126,34); finger(c,18,-34,.07,122,34); finger(c,52,-24,.22,100,30);
    c.save(); c.translate(-66,40); c.rotate(-1.0); rr(c,-17,-88,34,100,17); c.restore();
  }
  // 손바닥
  rr(c,-74,-44,148,160,46);
  c.strokeStyle='rgba(23,36,55,.22)'; c.lineWidth=4;
  c.beginPath(); c.arc(-6,58,44,Math.PI*1.1,Math.PI*1.7); c.stroke();
  c.strokeStyle=NAVY; c.lineWidth=7;
  if(kind==='rock'){
    knuckle(c,-54); knuckle(c,-18); knuckle(c,18); knuckle(c,54);
    rr(c,-86,-14,112,44,22);
  } else if(kind==='scissors'){
    knuckle(c,22); knuckle(c,56);
    finger(c,-50,-30,-.26,132,34); finger(c,-12,-36,.1,138,34);
    rr(c,-6,-18,96,42,21);
  }
  // 손목 밴드
  c.fillStyle=NAVY; c.fillRect(-78,112,156,22);
}
function handAt(c,x,y,ang,kind,left,sc,col,skin){
  c.save(); c.translate(x,y);
  if(!left) c.scale(-1,1);
  c.rotate(Math.PI/2+ang); c.scale(sc,sc);
  drawHand(c,kind,col,skin);
  c.restore();
}

/* ---------- pose ---------- */
function pose(t){
  // 반환: 왼손/오른손 {x(손목에서 중심까지 거리), ang, kind}
  var L={hx:360,ang:0,kind:'rock',y:0}, Rh={hx:360,ang:0,kind:'rock',y:0};
  if(MODE==='collect'){
    L.ang=Math.sin(t*.003)*.05; Rh.ang=Math.sin(t*.003+1.4)*.05; L.y=Math.sin(t*.0024)*8; Rh.y=Math.sin(t*.0024+1)*8;
    return {L:L,R:Rh};
  }
  if(t<TL.WIND){
    var u=(t-TL.C1)/(TL.C2-TL.C1), a=-.42*Math.abs(Math.sin(Math.PI*u))*eo(seg(t,0,140));
    L.ang=a; Rh.ang=a; L.y=a*90; Rh.y=a*90;
  } else if(t<TL.THR){
    var p=eio(seg(t,TL.WIND,TL.THR)), a0=-.42*Math.abs(Math.sin(Math.PI*(TL.WIND-TL.C1)/(TL.C2-TL.C1)));
    var j=(rnd(Math.floor(t/24))-.5)*.08*p;
    L.ang=lerp(a0,-.72,p)+j; Rh.ang=lerp(a0,-.72,p)-j; L.hx=Rh.hx=lerp(360,410,p); L.y=Rh.y=lerp(a0*90,-70,p);
  } else if(t<TL.HIT){
    var q=ei(seg(t,TL.THR,TL.HIT));
    L.ang=Rh.ang=lerp(-.72,0,q); L.hx=Rh.hx=lerp(410,16,q); L.y=Rh.y=lerp(-70,0,q);
    if(t>=TL.THR+(TL.HIT-TL.THR)*.4){ L.kind=TL.vh; Rh.kind=TL.st; }
  } else if(t<TL.HS){
    L.hx=Rh.hx=16; L.kind=TL.vh; Rh.kind=TL.st;
  } else {
    var r=eo(seg(t,TL.HS,TL.HS+420)), wob=Math.exp(-(t-TL.HS)/260)*Math.sin((t-TL.HS)*.04);
    L.kind=TL.vh; Rh.kind=TL.st;
    var win=TL.res==='win', draw=TL.res==='draw';
    if(draw){ L.hx=Rh.hx=lerp(16,170,r); L.ang=-.12*wob; Rh.ang=.12*wob; }
    else {
      var W2=win?L:Rh, Lo=win?Rh:L;
      W2.hx=lerp(16,-30,r); W2.ang=.05*wob;
      Lo.hx=lerp(16,330,r); Lo.ang=lerp(0,.42,r)+.2*wob; Lo.y=lerp(0,60,r);
    }
    if(t>=TL.RES){ var b=Math.sin((t-TL.RES)*.0016)*6; L.y+=b; Rh.y-=b; }
  }
  return {L:L,R:Rh};
}

/* ---------- camera ---------- */
function shake(c,t,sh){ var k=Math.floor(t/16); c.x+=(rnd(k)-.5)*2*sh/c.z; c.y+=(rnd(k+977)-.5)*2*sh/c.z; return c; }
function camAt(t){
  var c, sh=0;
  if(MODE==='collect'){
    var o=eo(seg(t,0,520));
    c={x:lerp(-140,0,o), y:lerp(-50,0,o)+Math.sin(t*.0011)*4, z:lerp(.84,1,o)+Math.sin(t*.0008)*.006, r:lerp(-.06,0,eo(seg(t,0,620)))};
    var left=S.joinMs-t;
    if(left<5000&&left>0){ var ph=(5000-left)%1000; sh=2+(1-ph/1000)*8; c.z+=.05*(1-left/5000); }
    if(t>150&&t<700) sh+=16*Math.exp(-(t-150)/120);
    return shake(c,t,sh);
  }
  if(t<TL.WIND){
    c={x:0,y:0,z:lerp(1,1.08,seg(t,0,TL.WIND)),r:0};
    sh=1.2; [TL.C1,TL.C2].forEach(function(b){ var d=t-b; if(d>0) sh+=12*Math.exp(-d/90); });
  } else if(t<TL.HIT){
    var p=seg(t,TL.WIND,TL.HIT);
    c={x:0,y:lerp(0,-30,eio(p)),z:lerp(1.08,1.34,ei(p)),r:-.025*eio(p)};
    sh=2+p*8;
  } else if(t<TL.HS){
    c=camAt(TL.HIT-1); c.z*=1.06; return shake(c,t,26);
  } else if(t<TL.RES){
    var pz=1+.15*(1-eo(seg(t,TL.HS,TL.HS+180))), dx=TL.res==='win'?60:TL.res==='draw'?0:-60;
    c={x:lerp(0,dx,eo(seg(t,TL.HS,TL.HS+500))),y:-10,z:1.22*pz,r:.015*Math.exp(-(t-TL.HS)/300)*Math.cos((t-TL.HS)*.03)};
    sh=14*(1-seg(t,TL.HS,TL.HS+350));
  } else {
    var q=eo(seg(t,TL.RES,TL.RES+1000));
    c={x:lerp(0,360,q),y:lerp(-10,10,q),z:lerp(1.2,.86,q),r:lerp(.03,0,q)};
    sh=10*Math.exp(-(t-TL.RES)/200);
  }
  return shake(c,t,sh);
}
function w2s(cam,wx,wy){ var dx=(wx-cam.x)*cam.z, dy=(wy-cam.y)*cam.z, c=Math.cos(cam.r), s=Math.sin(cam.r); return {x:CX+dx*c-dy*s,y:CY+dx*s+dy*c}; }

/* ---------- world ---------- */
function drawWorld(c,cam,t,amb,ps){
  c.save();
  c.translate(CX,CY); c.rotate(cam.r); c.scale(cam.z,cam.z); c.translate(-cam.x,-cam.y);
  var split=0, run=MODE==='run';
  if(run&&t>=TL.HS&&TL.res!=='draw'&&TL.res!=='none') split=(TL.res==='win'?1:-1)*260*eo(seg(t,TL.HS,TL.HS+380));
  if(run&&TL.res==='none'&&t>=TL.HS) split=-260*eo(seg(t,TL.HS,TL.HS+380));
  // 왼쪽 (시청자 팀)
  var g=c.createLinearGradient(-1500,0,200,0); g.addColorStop(0,'#081428'); g.addColorStop(1,'#1f5592');
  c.fillStyle=g; c.beginPath(); c.moveTo(-3000,-1600); c.lineTo(150+split,-1600); c.lineTo(-150+split,1600); c.lineTo(-3000,1600); c.closePath(); c.fill();
  // 오른쪽 (스트리머)
  g=c.createLinearGradient(-200,0,1500,0); g.addColorStop(0,'#ff6a1f'); g.addColorStop(.35,'#b8360c'); g.addColorStop(1,'#3a0e05');
  c.fillStyle=g; c.beginPath(); c.moveTo(150+split,-1600); c.lineTo(3000,-1600); c.lineTo(3000,1600); c.lineTo(-150+split,1600); c.closePath(); c.fill();
  // 속도선 (양쪽에서 가운데로)
  var sp=run?(t<TL.HIT?1.2+seg(t,TL.WIND,TL.HIT)*2.4:.25):.5;
  for(var i=0;i<46;i++){
    var y=-700+rnd(i+3)*1400, l=120+rnd(i+5)*380, side=i%2?1:-1;
    var x=side*(1500-((rnd(i+7)*1500+amb*sp*(.6+rnd(i+9)*.8))%1500));
    c.fillStyle=side<0?'rgba(140,200,255,'+(.08+rnd(i)*.16)+')':'rgba(255,220,180,'+(.08+rnd(i)*.16)+')';
    c.fillRect(side<0?x-l:x,y,l,3+rnd(i+2)*5);
  }
  // 하프톤 점 (중앙선 주변)
  for(var gy=-640;gy<=640;gy+=40){
    for(var gx=-480;gx<=480;gx+=40){
      var lx=gx+(gy/1600)*-300, d=Math.abs(lx-split*(.5-gy/3200));
      var r=Math.max(0,9-d/40); if(r<=.6) continue;
      c.fillStyle='rgba(245,243,239,.10)'; c.beginPath(); c.arc(gx+split,gy,r,0,Math.PI*2); c.fill();
    }
  }
  // 바닥 격자
  c.save(); c.globalAlpha=.32; c.strokeStyle=CR; c.lineWidth=2;
  for(var fx=-12;fx<=12;fx++){ c.beginPath(); c.moveTo(fx*60,300); c.lineTo(fx*260,900); c.stroke(); }
  for(var fy=0;fy<6;fy++){ var yy=300+Math.pow(fy/5,1.7)*600; c.beginPath(); c.moveTo(-3000,yy); c.lineTo(3000,yy); c.stroke(); }
  c.restore();
  g=c.createLinearGradient(0,250,0,320); g.addColorStop(0,'rgba(245,243,239,0)'); g.addColorStop(1,'rgba(245,243,239,.25)');
  c.fillStyle=g; c.fillRect(-3000,250,6000,52);
  // 중앙 분할선
  c.strokeStyle='rgba(255,240,210,.35)'; c.lineWidth=40; c.beginPath(); c.moveTo(150+split,-1600); c.lineTo(-150+split,1600); c.stroke();
  c.strokeStyle=CR; c.lineWidth=10; c.beginPath(); c.moveTo(150+split,-1600); c.lineTo(-150+split,1600); c.stroke();
  // 기합 에너지 (보!! 구간)
  if(run&&t>=TL.WIND&&t<TL.HIT){
    var e=seg(t,TL.WIND,TL.HIT);
    [-1,1].forEach(function(sd){
      var hx=sd*(ps[sd<0?'L':'R'].hx), cx=hx+sd*-60;
      var gl=c.createRadialGradient(cx,ps.L.y,0,cx,ps.L.y,260+e*120);
      gl.addColorStop(0,sd<0?'rgba(120,200,255,'+(.55*e)+')':'rgba(255,170,60,'+(.55*e)+')'); gl.addColorStop(1,'rgba(0,0,0,0)');
      c.fillStyle=gl; c.fillRect(cx-400,ps.L.y-400,800,800);
    });
  }
  // 충돌 섬광 (월드)
  if(run&&t>=TL.HIT&&t<TL.RES+600){
    var a=1-seg(t,TL.HS,TL.RES+600);
    c.save(); c.translate(0,0); c.rotate(amb*.001); c.globalCompositeOperation='lighter';
    for(var k=0;k<16;k++){ var an=k/16*Math.PI*2; var gr=c.createRadialGradient(0,0,0,0,0,900); gr.addColorStop(0,'rgba(255,220,140,'+(.5*a)+')'); gr.addColorStop(1,'rgba(255,120,30,0)');
      c.fillStyle=gr; c.beginPath(); c.moveTo(0,0); c.arc(0,0,900,an-.06,an+.06); c.closePath(); c.fill(); }
    c.restore();
  }
  // 후광 (여운: 이긴 쪽 손 뒤)
  if(run&&t>=TL.RES&&TL.res!=='none'){
    var ha=eo(seg(t,TL.RES,TL.RES+500)), hx2=TL.res==='win'?-ps.L.hx-90:TL.res==='draw'?0:ps.R.hx+90;
    c.save(); c.translate(hx2,0); c.rotate(amb*.0007); c.globalCompositeOperation='lighter';
    for(var m=0;m<18;m++){ var an2=m/18*Math.PI*2; var g2=c.createRadialGradient(0,0,0,0,0,700); g2.addColorStop(0,'rgba(255,210,100,'+(.42*ha)+')'); g2.addColorStop(1,'rgba(255,120,30,0)');
      c.fillStyle=g2; c.beginPath(); c.moveTo(0,0); c.arc(0,0,700,an2-.07,an2+.07); c.closePath(); c.fill(); }
    c.restore();
  }
  // 손
  var loseDim=run&&t>=TL.RES&&TL.res!=='draw';
  var lSk=loseDim&&TL.res!=='win'?'#b9bcc2':CR, rSk=loseDim&&TL.res==='win'?'#b9bcc2':CR;
  if(run&&t>=TL.HIT&&t<TL.HS+220){ c.shadowColor='rgba(255,240,200,.95)'; c.shadowBlur=60; }
  handAt(c,-ps.L.hx-TIP,ps.L.y,ps.L.ang,ps.L.kind,true,HS,'#2b6fc0',lSk);
  handAt(c,ps.R.hx+TIP,ps.R.y,ps.R.ang,ps.R.kind,false,HS,OR,rSk);
  c.shadowBlur=0;
  // 충격파 링
  if(run&&t>=TL.HS&&t<TL.HS+700){
    var rp=(t-TL.HS)/700;
    [0,120].forEach(function(dl){ var u=cl(((t-TL.HS)-dl)/580); if(u<=0) return; c.strokeStyle='rgba(255,246,220,'+(1-u)+')'; c.lineWidth=26*(1-u)+2; c.beginPath(); c.ellipse(0,0,60+eo(u)*620,40+eo(u)*420,0,0,Math.PI*2); c.stroke(); });
  }
  // 충돌 파편
  if(run&&t>=TL.HIT&&t<TL.RES+400){
    var dt=(t<TL.HS?0:(t-TL.HS))/1000;
    for(var q=0;q<60;q++){
      var an3=rnd(q+50)*Math.PI*2, v=500+rnd(q+51)*1100, px=Math.cos(an3)*v*dt, py=Math.sin(an3)*v*dt+900*dt*dt, al=1-seg(dt,0,.7);
      if(al<=0) continue;
      c.fillStyle=q%3?'rgba(255,240,200,'+al+')':(q%2?'rgba(255,91,23,'+al+')':'rgba(120,200,255,'+al+')');
      c.save(); c.translate(px,py); c.rotate(an3); c.fillRect(-14-v*dt*.04,-3,28+v*dt*.08,6); c.restore();
    }
  }
  c.restore();
}

/* ---------- screen fx ---------- */
function vignette(c,a){ var g=c.createRadialGradient(960,540,380,960,540,1060); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,8,16,'+a+')'); c.fillStyle=g; c.fillRect(0,0,W,H); }
function letterbox(c,hb){ if(hb<=0) return; c.fillStyle='#04070c'; c.fillRect(0,P.y,W,hb); c.fillRect(0,P.y+P.h-hb,W,hb); }
function grain(c,t){ var k=Math.floor(t/42); for(var i=0;i<220;i++){ c.fillStyle=rnd(k*31+i)>.5?'rgba(255,255,255,.06)':'rgba(0,0,0,.08)'; c.fillRect(P.x+rnd(k*17+i)*P.w,P.y+rnd(k*13+i+5)*P.h,2,2); } }
function screenFX(c,t,cam){
  if(MODE!=='run') return;
  if(t>=TL.WIND&&t<TL.HIT){
    var e=seg(t,TL.WIND,TL.HIT);
    var og=c.createRadialGradient(960,560,260,960,560,1150); og.addColorStop(0,'rgba(255,91,23,0)'); og.addColorStop(1,'rgba(255,40,10,'+Math.min(.55,e*.55)+')');
    c.fillStyle=og; c.fillRect(0,0,W,H);
    var cp=w2s(cam,0,0);
    c.save(); c.translate(cp.x,cp.y);
    for(var i=0;i<52;i++){ var a=rnd(i+400)*Math.PI*2, r0=240+rnd(i+401)*200+((t*.3)%60), r1=r0+260+rnd(i+402)*420;
      c.strokeStyle='rgba(245,243,239,'+(e*.26)+')'; c.lineWidth=2+rnd(i+403)*4; c.beginPath(); c.moveTo(Math.cos(a)*r0,Math.sin(a)*r0); c.lineTo(Math.cos(a)*r1,Math.sin(a)*r1); c.stroke(); }
    c.restore();
  }
  letterbox(c,86*eo(seg(t,TL.WIND,TL.WIND+380))*(1-seg(t,TL.HS,TL.HS+220)));
  if(t>=TL.HIT&&t<TL.HS+300){
    if(t<TL.HS){
      c.fillStyle='rgba(255,250,240,.9)'; c.fillRect(0,0,W,H);
      var p=w2s(cam,0,0);
      c.save(); c.translate(p.x,p.y);
      for(var j=0;j<40;j++){ var an=j/40*Math.PI*2+rnd(j)*.1; c.fillStyle=j%2?OR:NAVY; c.beginPath(); c.moveTo(Math.cos(an-.02)*110,Math.sin(an-.02)*110); c.lineTo(Math.cos(an)*1400,Math.sin(an)*1400); c.lineTo(Math.cos(an+.03)*110,Math.sin(an+.03)*110); c.fill(); }
      c.restore();
    } else {
      var fl=Math.pow(1-seg(t,TL.HS,TL.HS+260),2); c.fillStyle='rgba(255,250,240,'+(.82*fl)+')'; c.fillRect(0,0,W,H);
    }
  }
  if(t>=TL.RES){ var a2=.4*(1-seg(t,TL.RES,TL.RES+260)); c.fillStyle='rgba(255,240,210,'+a2+')'; c.fillRect(0,0,W,H); }
}

/* ---------- panel + HUD ---------- */
function panelPath(c,x,y,w,h,k){ c.beginPath(); c.moveTo(x+k,y); c.lineTo(x+w,y); c.lineTo(x+w,y+h-k); c.lineTo(x+w-k,y+h); c.lineTo(x,y+h); c.lineTo(x,y+k); c.closePath(); }
var PH=[{n:'01',ko:'선택'},{n:'02',ko:'가위바위'},{n:'03',ko:'보!'},{n:'04',ko:'격돌'},{n:'05',ko:'결과'}];
function phaseOf(t){
  if(MODE==='collect') return {i:0,p:cl(t/S.joinMs)};
  if(t<TL.WIND) return {i:1,p:seg(t,0,TL.WIND)};
  if(t<TL.HIT) return {i:2,p:seg(t,TL.WIND,TL.HIT)};
  if(t<TL.RES) return {i:3,p:seg(t,TL.HIT,TL.RES)};
  return {i:4,p:seg(t,TL.RES,TL.END)};
}
function bar(c,x,y,w,h,fill,dmg,col,left){
  c.save(); c.translate(x,y); c.transform(1,0,left?-.25:.25,1,0,0);
  c.fillStyle='rgba(4,8,14,.85)'; c.fillRect(-6,-6,w+12,h+12);
  c.fillStyle=NAVY; c.fillRect(0,0,w,h);
  var dw=w*dmg, fw=w*fill;
  c.fillStyle=CR; if(left) c.fillRect(w-dw,0,dw,h); else c.fillRect(0,0,dw,h);
  c.fillStyle=col; if(left) c.fillRect(w-fw,0,fw,h); else c.fillRect(0,0,fw,h);
  c.fillStyle='rgba(255,255,255,.28)'; if(left) c.fillRect(w-fw,0,fw,h*.32); else c.fillRect(0,0,fw,h*.32);
  c.restore();
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
  // 체력바: 충돌 순간 진 쪽이 깎인다
  var lf=1, rf=1, ld=1, rd=1;
  if(MODE==='run'&&t>=TL.HS){
    var p=eo(seg(t,TL.HS,TL.HS+260)), q=eo(seg(t,TL.HS+300,TL.HS+900));
    var lt=TL.res==='win'?1:TL.res==='draw'?.6:0, rt=TL.res==='win'?0:TL.res==='draw'?.6:1;
    if(TL.res==='none'){ lt=0; rt=1; }
    lf=lerp(1,lt,p); rf=lerp(1,rt,p); ld=lerp(1,lt,q); rd=lerp(1,rt,q);
  }
  var bw=600, bh=40, by=P.y+44;
  bar(c,P.x+90,by,bw,bh,lf,ld,MINT,true);
  bar(c,P.x+P.w-90-bw,by,bw,bh,rf,rd,OR,false);
  var n=(S.picks?Object.keys(S.picks).length:0);
  c.font='38px '+FT; c.fillStyle=CR; c.lineWidth=8; c.strokeStyle=NAVY; c.lineJoin='round';
  c.strokeText('시청자 팀',P.x+80,by+80); c.fillText('시청자 팀',P.x+80,by+80);
  c.font='800 26px '+FM; c.fillStyle=MINT; c.fillText(n+' PLAYERS',P.x+290,by+82);
  c.textAlign='right'; c.font='38px '+FT; c.fillStyle=CR;
  c.strokeText('스트리머',P.x+P.w-80,by+80); c.fillText('스트리머',P.x+P.w-80,by+80);
  c.font='800 26px '+FM; c.fillStyle=OR; c.fillText('BOSS',P.x+P.w-262,by+82);
  c.textAlign='center';
  // 가운데 라운드 타이머
  var tx=960, ty=P.y+70;
  c.fillStyle='rgba(4,8,14,.9)'; c.beginPath(); c.moveTo(tx-96,ty-58); c.lineTo(tx+96,ty-58); c.lineTo(tx+76,ty+62); c.lineTo(tx-76,ty+62); c.closePath(); c.fill();
  c.strokeStyle=GOLD; c.lineWidth=4; c.stroke();
  c.fillStyle=GOLD; c.font='800 18px '+FM; c.fillText('ROUND 1',tx,ty-38);
  var big='VS', bc=CR, bs=1;
  if(MODE==='collect'){
    var left=Math.max(0,S.joinMs-t), sec=Math.ceil(left/1000);
    big=left>0?String(sec):'0'; bc=left>0&&sec<=5?OR:CR;
    if(left>0&&sec<=5) bs=lerp(1.6,1,eback(cl(((S.joinMs-left)%1000)/160)));
  } else if(t>=TL.HS){ big=TL.res==='draw'?'DRAW':TL.res==='none'?'—':'K.O.'; bc=TL.res==='draw'?CR:GOLD; bs=lerp(1.9,1,eback(seg(t,TL.HS,TL.HS+220))); }
  c.save(); c.translate(tx,ty+12); c.scale(bs,bs); c.fillStyle=bc; fitFont(c,big,'',big.length>2?50:72,150,FT,30); c.fillText(big,0,2); c.restore();
  // 단계 칩
  var pi=phaseOf(t), pw=124, gap=8, total=5*pw+4*gap, sx=960-total/2;
  for(var i=0;i<5;i++){
    var x=sx+i*(pw+gap), y=P.y+152, act=i===pi.i, done=i<pi.i;
    c.fillStyle=act?OR:done?'rgba(245,243,239,.85)':'rgba(10,18,28,.6)'; c.fillRect(x,y,pw,34);
    if(!act&&!done){ c.strokeStyle='rgba(245,243,239,.45)'; c.lineWidth=2; c.strokeRect(x+1,y+1,pw-2,32); }
    if(act){ c.fillStyle='rgba(23,36,55,.35)'; c.fillRect(x,y+29,pw*pi.p,5); }
    c.fillStyle=act?CR:done?NAVY:'rgba(245,243,239,.75)'; c.font='700 19px '+FK; c.fillText(PH[i].n+' '+PH[i].ko,x+pw/2,y+18);
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
function starburst(c,r0,r1,n,fill){
  c.beginPath();
  for(var i=0;i<n*2;i++){ var r=i%2?r0:r1+rnd(i)*r1*.2, an=i/(n*2)*Math.PI*2; if(i) c.lineTo(Math.cos(an)*r,Math.sin(an)*r); else c.moveTo(Math.cos(an)*r,Math.sin(an)*r); }
  c.closePath(); c.fillStyle=fill; c.fill(); c.strokeStyle=NAVY; c.lineWidth=8; c.stroke();
}
function slam(c,txt,x,y,size,t0,t,fill,shadow,rot){
  var p=seg(t,t0,t0+130), s=lerp(1.9,1,eback(p));
  c.save(); c.translate(x,y); c.rotate(lerp(-.105,0,eo(p))+(rot||0)); c.scale(s,s);
  c.textAlign='center'; c.textBaseline='middle'; c.font=size+'px '+FT;
  c.fillStyle=shadow; c.fillText(txt,10,14);
  outlined(c,txt,0,0,fill,NAVY,Math.round(size*.09),CR,Math.round(size*.15));
  c.restore();
}
function chant(c,t){
  if(MODE!=='run') return;
  [[TL.C1,'가위!'],[TL.C2,'바위!']].forEach(function(b){
    if(t<b[0]||t>b[0]+360) return;
    c.save(); c.globalAlpha=1-seg(t,b[0]+260,b[0]+360);
    slam(c,b[1],960,400,190,b[0],t,CR,OR,-.05);
    c.restore();
  });
  if(t>=TL.WIND&&t<TL.HIT){
    var e=seg(t,TL.WIND,TL.HIT), k=Math.floor(t/24), j=4+e*20;
    c.save(); c.translate((rnd(k)-.5)*j,(rnd(k+5)-.5)*j);
    var s=lerp(.9,1.35,ei(e));
    c.translate(960,410); c.scale(s,s); c.translate(-960,-410);
    slam(c,'보!!',960,410,230,TL.WIND,t,OR,NAVY,-.06);
    c.restore();
  }
}
function verdictTxt(){ return TL.res==='win'?'시청자 승!':TL.res==='lose'?'스트리머 승!':TL.res==='draw'?'무승부!':'참가자 없음'; }
function verdictCol(){ return TL.res==='win'?MINT:TL.res==='lose'?OR:GRAY; }
function verdict(c,t){
  if(MODE!=='run'||t<TL.HS||t>TL.RES+260) return;
  var a=1-seg(t,TL.RES,TL.RES+260), p=seg(t,TL.HS,TL.HS+130);
  c.save(); c.globalAlpha=a;
  c.save(); c.translate(960,350); c.rotate(t*.0015); var bs=lerp(1.6,1,eback(p)); c.scale(bs,bs*.62); starburst(c,190,270,18,CR); c.restore();
  slam(c,verdictTxt(),960,345,TL.res==='none'?130:170,TL.HS,t,verdictCol()===GRAY?CR:verdictCol(),NAVY,-.04);
  // 손 이름표
  var lp=eo(seg(t,TL.HS+120,TL.HS+360));
  c.globalAlpha=a*lp;
  c.font='900 38px '+FK; c.textBaseline='middle';
  c.fillStyle=NAVY; c.fillRect(220-(1-lp)*200,780,440,70); c.fillStyle='#2b6fc0'; c.fillRect(220-(1-lp)*200,780,12,70);
  c.fillStyle=CR; c.textAlign='left'; c.fillText(TL.total?'시청자 대표 · '+LABEL[TL.vh]:'시청자 없음',248-(1-lp)*200,816);
  c.fillStyle=NAVY; c.fillRect(1260+(1-lp)*200,780,440,70); c.fillStyle=OR; c.fillRect(1688+(1-lp)*200,780,12,70);
  c.fillStyle=CR; c.textAlign='right'; c.fillText('스트리머 · '+LABEL[TL.st],1672+(1-lp)*200,816);
  c.restore();
}
function balloonIcon(c,x,y,r){
  c.save(); c.translate(x,y);
  c.fillStyle=CR; c.beginPath(); c.arc(0,0,r,0,Math.PI*2); c.fill();
  c.fillStyle=OR; c.beginPath();
  for(var i=0;i<10;i++){ var rr2=i%2?r*.38:r*.78, a=-Math.PI/2+i*Math.PI/5; if(i) c.lineTo(Math.cos(a)*rr2,Math.sin(a)*rr2); else c.moveTo(Math.cos(a)*rr2,Math.sin(a)*rr2); }
  c.closePath(); c.fill(); c.restore();
}

/* ---------- collect overlay (screen) ---------- */
function collectFX(c,t){
  // VS 슬램
  var vp=seg(t,150,330);
  if(vp>0){
    c.save(); c.translate(960,470); var s=lerp(2.4,1,eback(vp))+Math.sin(t*.004)*.015; c.rotate(lerp(-.2,-.06,eo(vp))); c.scale(s,s);
    c.textAlign='center'; c.textBaseline='middle'; c.font='240px '+FT;
    c.fillStyle=NAVY; c.fillText('VS',12,16);
    outlined(c,'VS',0,0,GOLD,NAVY,22,CR,36);
    c.restore();
  }
  // 플래시 (VS 착지)
  if(t>=330&&t<560){ c.fillStyle='rgba(255,250,240,'+(.5*(1-seg(t,330,560)))+')'; c.fillRect(P.x,P.y,P.w,P.h); }
  // 시청자 손 선택 집계 (왼쪽)
  var ip=eo(seg(t,260,620)), now=performance.now();
  c.save(); c.translate(-(1-ip)*420,0); c.globalAlpha=ip; c.textBaseline='middle';
  c.fillStyle='rgba(4,8,14,.82)'; c.fillRect(220,760,600,130); c.fillStyle='#2b6fc0'; c.fillRect(220,760,12,130);
  ['scissors','rock','paper'].forEach(function(h,i){
    var x=290+i*190, b=bump[h]?1-seg(now-bump[h],0,420):0;
    c.save(); c.translate(x,826); c.scale(.2*(1+b*.4),.2*(1+b*.4)); c.lineWidth=7; drawHand(c,h,'#2b6fc0',CR,true); c.restore();
    c.fillStyle=CR; c.font='900 30px '+FK; c.textAlign='left'; c.fillText(LABEL[h],x+44,806);
    c.fillStyle=hc[h]>0?MINT:'rgba(245,243,239,.5)'; c.font='800 34px '+FM; c.fillText(String(hc[h]),x+44,846);
  });
  c.restore();
  // 스트리머 ??? (오른쪽)
  c.save(); c.translate((1-ip)*420,0); c.globalAlpha=ip; c.textBaseline='middle';
  c.fillStyle='rgba(4,8,14,.82)'; c.fillRect(1100,760,600,130); c.fillStyle=OR; c.fillRect(1688,760,12,130);
  c.fillStyle=CR; c.font='900 30px '+FK; c.textAlign='right'; c.fillText('스트리머의 손은?',1664,800);
  var qj=(rnd(Math.floor(t/90))-.5)*4;
  c.fillStyle=OR; c.font='64px '+FT; c.fillText('? ? ?',1664+qj,850);
  c.restore();
  // 참가 방법 띠
  var bp=eo(seg(t,420,760)), cmd=String(S.command||'!묵찌빠')+' 가위 / 바위 / 보';
  c.save(); c.globalAlpha=bp; c.translate(0,(1-bp)*60); c.textAlign='center'; c.textBaseline='middle';
  c.fillStyle=CR; c.beginPath(); c.moveTo(560,630); c.lineTo(1380,630); c.lineTo(1360,700); c.lineTo(540,700); c.closePath(); c.fill();
  c.fillStyle=NAVY; c.font='800 30px '+FK; c.fillText('채팅에',700,666);
  c.fillStyle=OR; fitFont(c,cmd,'900 ',38,560,FK,20); c.fillText(cmd,1040,666);
  c.restore();
  // 마감
  if(t>=S.joinMs){ c.save(); c.globalAlpha=1; slam(c,'마감!',960,300,150,S.joinMs,t,OR,NAVY,-.05); c.restore(); }
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
  c.fillStyle='rgba(245,243,239,.75)'; c.font='700 22px '+FM; c.fillText('ROUND #'+NO+' · 가위바위보',x0+230,y0+52);
  // 판정
  var np=seg(t,T+380,T+620), ns=lerp(1.9,1,eback(np));
  if(np>0){
    c.save(); c.globalAlpha=Math.min(1,np*3); c.translate(x0+50,y0+214); c.scale(ns,ns);
    var vt=verdictTxt(); fitFont(c,vt,'',138,w-120,FT,40);
    c.fillStyle=verdictCol(); c.fillText(vt,8,10); c.fillStyle=NAVY; c.fillText(vt,0,0);
    c.restore();
  }
  // 손 / 집계
  var sp=seg(t,T+620,T+820);
  c.globalAlpha=sp;
  c.fillStyle=NAVY; c.font='800 30px '+FK; c.fillText('스트리머 '+LABEL[TL.st],x0+56,y0+326);
  [['승',TL.w,MINT],['무',TL.d,GRAY],['패',TL.l,RED]].forEach(function(r,i){
    var bx=x0+290+i*120;
    c.fillStyle=r[2]; c.beginPath(); c.roundRect(bx,y0+300,108,52,10); c.fill();
    c.fillStyle=CR; c.font='900 28px '+FK; c.textAlign='center'; c.fillText(r[0]+' '+r[1],bx+54,y0+327); c.textAlign='left';
  });
  c.fillStyle='rgba(23,36,55,.6)'; c.font='800 24px '+FK; c.fillText(TL.total?'참가 '+TL.total+'명':'참가자 없음',x0+56,y0+374);
  c.globalAlpha=1;
  c.strokeStyle='rgba(23,36,55,.25)'; c.lineWidth=3; c.setLineDash([10,10]);
  c.beginPath(); c.moveTo(x0+50,y0+404); c.lineTo(x0+w-40,y0+404); c.stroke(); c.setLineDash([]);
  // 이긴 시청자
  var cp=eo(seg(t,T+760,T+1060)), ws=S.winners||[];
  c.save(); c.globalAlpha=cp; c.translate((1-cp)*80,0);
  c.fillStyle='rgba(23,36,55,.6)'; c.font='700 28px '+FK; c.fillText('이긴 시청자',x0+56,y0+440);
  var nick=ws.length?(ws.slice(0,2).join(', ')+(ws.length>2?' 외 '+(ws.length-2)+'명':'')):'이긴 시청자 없음';
  c.fillStyle=ws.length?NAVY:'rgba(23,36,55,.45)'; fitFont(c,nick,'900 ',ws.length?80:60,w-110,FK,30); c.fillText(nick,x0+52,y0+502);
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
    var bs=lerp(3,1,eback(bp)), col=verdictCol();
    var lab=TL.res==='win'?'K.O.':TL.res==='lose'?'방어':TL.res==='draw'?'무':'없음';
    var en=TL.res==='win'?'VIEWER WIN':TL.res==='lose'?'BOSS WIN':TL.res==='draw'?'DRAW':'NO ENTRY';
    c.save(); c.translate(x0+w-60,y0+20); c.rotate(-.2); c.scale(bs,bs); c.globalAlpha=Math.min(1,bp*2.5);
    if(bp<1){ c.strokeStyle=col; c.lineWidth=6; for(var j=0;j<12;j++){ var a=j/12*Math.PI*2; c.beginPath(); c.moveTo(Math.cos(a)*130,Math.sin(a)*130); c.lineTo(Math.cos(a)*(150+bp*60),Math.sin(a)*(150+bp*60)); c.stroke(); } }
    c.fillStyle=NAVY; c.beginPath(); c.arc(6,8,112,0,Math.PI*2); c.fill();
    c.fillStyle=col; c.beginPath(); c.arc(0,0,112,0,Math.PI*2); c.fill();
    c.strokeStyle=CR; c.lineWidth=5; c.beginPath(); c.arc(0,0,96,0,Math.PI*2); c.stroke();
    c.textAlign='center'; c.fillStyle=CR; fitFont(c,lab,'',84,170,FT,40); c.fillText(lab,0,-4);
    c.font='800 18px '+FM; c.fillText(en,0,58);
    c.restore();
  }
  c.restore();
}

/* ---------- render ---------- */
function render(t){
  X.setTransform(1,0,0,1,0,0); X.clearRect(0,0,W,H);
  if(MODE==='none'||!S) return;
  var fade=MODE==='run'?1-seg(t,TL.END,TL.END+400):1;
  if(fade<=0) return;
  X.save(); X.globalAlpha=fade;
  var ot=paused?99999:performance.now()-openAt;
  var rv=Math.min(eo(seg(ot,0,450)),MODE==='collect'?eo(seg(t,0,450)):1), ph=Math.max(4,P.h*rv), py=P.y+(P.h-ph)/2;
  var frozen=MODE==='run'&&t>=TL.HIT&&t<TL.HS;
  var wt=frozen?TL.HIT:t;
  var amb=MODE==='run'&&t>=TL.RES?TL.RES+(t-TL.RES)*.25:wt;
  var cam=camAt(t), ps=pose(wt);
  X.save(); X.shadowColor='rgba(0,0,0,.55)'; X.shadowBlur=50; X.shadowOffsetY=14;
  panelPath(X,P.x,py,P.w,ph,P.k); X.fillStyle='#061019'; X.fill(); X.restore();
  X.save(); panelPath(X,P.x,py,P.w,ph,P.k); X.clip();
  drawWorld(X,cam,wt,amb,ps);
  vignette(X,.55);
  screenFX(X,t,cam);
  grain(X,t);
  X.restore();
  hud(X,t,py,ph);
  if(rv>=.97){
    if(MODE==='collect') collectFX(X,t);
    else { chant(X,t); verdict(X,t); resultCard(X,t); }
  }
  X.restore();
}

/* ---------- sound cues ---------- */
function cue(t,silent){
  if(!window.FX) return;
  var at=function(k,ms,fn){ if(t>=ms&&!cues[k]){ cues[k]=1; if(!silent) fn(); } };
  if(MODE==='collect'){
    at('open',0,function(){ FX.sound('whoosh'); });
    at('vs',330,function(){ FX.sound('stop'); });
    var left=S.joinMs-t, sec=Math.ceil(left/1000);
    if(left>0&&sec<=5&&sec!==lastSec){ lastSec=sec; if(!silent) FX.sound('timer'); }
    return;
  }
  at('go',0,function(){ FX.sound('whoosh'); });
  at('c1',TL.C1,function(){ FX.sound('tick'); });
  at('c2',TL.C2,function(){ FX.sound('tick'); });
  at('wind',TL.WIND,function(){ FX.drumStart(260); });
  at('hit',TL.HIT,function(){ FX.drumStop(); FX.sound('stop'); FX.flash('rgba(255,250,236,.35)'); });
  at('ko',TL.HS,function(){ FX.sound(TL.res==='draw'||TL.res==='none'?'pop':'reveal'); });
  at('res',TL.RES+40,function(){ FX.sound('whoosh'); });
  at('name',TL.RES+400,function(){
    if(!TL.total) return;
    if(TL.w){ FX.sound('win'); FX.confetti({x:560,y:380,count:Math.min(220,100+TL.w*10)}); }
    else FX.sound('lose');
  });
  at('stamp',TL.RES+560,function(){ FX.sound('stop'); });
  at('banner',TL.RES+1300,function(){
    if(!TL.total) return;
    var hand=EMOJI[TL.st]+' '+LABEL[TL.st], an=document.getElementById('anchor'), ms=Math.max(1500,TL.END-(TL.RES+1300)), w=S.winners||[];
    if(w.length) FX.winner({nick:w[0]+(w.length>1?' 외 '+(w.length-1)+'명':''),text:'스트리머 '+hand+' 격파!',sub:'가위바위보 승리',anchor:an,above:true,ms:ms,icon:'✌️',balloons:BAL});
    else FX.winner({text:'스트리머 승리! ('+hand+')',sub:'무 '+TL.d+' · 패 '+TL.l,anchor:an,above:true,ms:ms,icon:'😎'});
  });
}

/* ---------- state handling ---------- */
function stopAll(){ MODE='none'; KEY=null; TL=null; if(window.FX){ FX.drumStop(); FX.hideWinner(); } X.setTransform(1,0,0,1,0,0); X.clearRect(0,0,W,H); }
function setCounts(r,sound){
  var nc={rock:0,paper:0,scissors:0}, now=performance.now();
  Object.keys(r.picks||{}).forEach(function(u){ var h=r.picks[u]; if(nc[h]!==undefined) nc[h]++; });
  if(lastTotal>=0) Object.keys(nc).forEach(function(h){ if(nc[h]>hc[h]) bump[h]=now; });
  var total=Object.keys(r.picks||{}).length;
  if(sound&&lastTotal>=0&&total>lastTotal&&window.FX) FX.sound('pop');
  lastTotal=total; hc=nc;
}
function nextNo(){ var no=1; try{ no=(Number(localStorage.getItem('rpsNo'))||0)+1; localStorage.setItem('rpsNo',String(no)); }catch(e){ no=1+Math.floor(Math.random()*900); } NO=String(no).padStart(3,'0'); }
function startCollect(r,key){
  var wasNone=MODE==='none';
  if(window.FX){ FX.drumStop(); FX.hideWinner(); }
  MODE='collect'; KEY=key; S=r; TL=null; cues={}; lastSec=-1; lastTotal=-1; bump={}; BAL=0; resultSeen=false;
  if(wasNone) openAt=performance.now();
  setCounts(r,false);
  var t=Date.now()-(r.deadline-r.joinMs);
  if(t>300) cue(t,true);
}
function startRun(r,key){
  var wasNone=MODE==='none';
  if(window.FX){ FX.drumStop(); FX.hideWinner(); }
  MODE='run'; KEY=key; S=r; cues={}; BAL=0; resultSeen=false;
  if(wasNone) openAt=performance.now();
  lastTotal=-1; setCounts(r,false); buildRun(); nextNo();
  var t=Date.now()-r.startedAt;
  if(t>150){ cue(t-1,true); if(window.FX&&t>=TL.WIND&&t<TL.HIT) FX.drumStart(260); }
}
function onState(s){
  var r=s.rps;
  if(s.status==='collecting'&&r){
    var key='c'+r.deadline;
    if(KEY!==key) startCollect(r,key); else { S=r; setCounts(r,true); }
  } else if(s.status==='running'&&r&&r.streamer){
    var key2='r'+r.startedAt;
    if(KEY!==key2) startRun(r,key2);
  } else if(s.status==='showing_result'){
    if(r&&r.streamer&&r.startedAt){ var key3='r'+r.startedAt; if(KEY!==key3) startRun(r,key3); }
    if(MODE==='run'&&s.result){ BAL=Number(s.result.balloon)||0; resultSeen=true; }
  } else if(s.status==='idle'){
    if(MODE==='collect') stopAll();
    else if(MODE==='run'&&!resultSeen&&!paused&&Date.now()-S.startedAt<TL.RES) stopAll();   // 결과 전에 취소된 판
  }
}
window.seek=function(ms){ paused=true; seekT=ms; };
window.unseek=function(){ paused=false; };
function loop(){
  if(MODE!=='none'&&S){
    var t=paused?seekT:(MODE==='collect'?Date.now()-(S.deadline-S.joinMs):Date.now()-S.startedAt);
    if(!paused) cue(t,false);
    render(t);
    if(MODE==='run'&&!paused&&t>TL.END+450) stopAll();
  }
  requestAnimationFrame(loop);
}
window.onRpsState=onState;
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
    if(msg.type==='game:state'&&msg.data&&msg.data.id==='rps') window.onRpsState(msg.data)
    if(msg.type==='ping') ws.send(JSON.stringify({type:'pong'}))
  }catch(err){} }
  ws.onopen=function(){ if(window.__wsDown) location.reload() }
  ws.onclose=function(){ window.__wsDown=true; setTimeout(connect,2000) }
}
connect()
<\/script>
</body>
</html>`
