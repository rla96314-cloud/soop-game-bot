// OBS 오버레이 페이지: race — '경마 중계' 연출 (출전 → 질주 → 막판 → 사진 판정 → 결과)
// 모션 언어: .inhabited/motion-language.md (기준: fish.ts '수중 다큐 카메라'). 캔버스 1장 + 타임라인 렌더 + 카메라 리그.
// 엔진 state.race(RaceState: racers, bets, deadline, joinMs, command, raceMs, startedAt, curves, order) 를 그대로 받는다.
//  - 주자 위치는 엔진과 같은 식(raceProgress)으로 계산. 연출용 시간축만 1착 도착 직전 1.3초를 0.4배로 늘이고
//    그만큼 앞 구간을 빠르게 돌려서, 1착 도착 시각(실제 ms)은 엔진과 정확히 같다 → 순위·도착 순서 불변
//  - 1착 도착 = 히트스톱 80ms → 사진 판정 정지 컷(흑백) + '1착!' 슬램 → 라이브 복귀(나머지 도착)
//  - 결과(raceMs+600, 엔진 결과 시점) 부터 여운: 사선 결과 카드(이름 → 도장 → 적중자 → 별풍선) + 배너
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
  #anchor{position:fixed;left:270px;top:996px;width:740px;height:1px;pointer-events:none}
</style>
</head>
<body>
<canvas id="c" width="1920" height="1080"></canvas>
<div id="anchor"></div>
<script>${FX_SCRIPT}<\/script>
<script>
(function(){
var C=document.getElementById('c'), X=C.getContext('2d'), W=1920, H=1080;
var NAVY='#172437', OR='#FF5B17', CR='#F5F3EF', MINT='#00CB84', GOLD='#FFC61A';
var FT='"Black Han Sans","Noto Sans KR",sans-serif', FK='"Noto Sans KR","Apple SD Gothic Neo",sans-serif', FM='"JetBrains Mono",ui-monospace,Menlo,monospace';
var P={x:140,y:100,w:1640,h:870,k:52};
var SILK=['#FF5B17','#00CB84','#FFC61A','#4F6BFF','#E0342C','#B455E0','#F5F3EF','#2AB3D6'];
var COAT=['#9a5b36','#6e4127','#b9b2a8','#3a2a22','#a8743f','#5b4636','#c9c0b4','#7d4a2e'];
var FIN=3200, X0=0, NOSE=96, CX=960, CY=610;

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

/* ---------- state ---------- */
var MODE='none', R=null, KEY=null, TL=null, paused=false, seekT=0, cues={}, openAt=0;
var counts=[], bump=[], lastTotal=-1, lastSec=-1, BAL=0, NO='001', resultSeen=false;

// 엔진(raceProgress)과 같은 식
function progress(c,t){
  if(t>=c.finish) return 1;
  var u=Math.max(0,t/c.finish);
  var w=c.amp*Math.sin(2*Math.PI*c.freq*u+c.phase)*u*(1-u)*4;
  return Math.min(0.995,Math.max(0,u+w));
}
function N(){ return R?R.racers.length:0; }
function LH(){ return Math.min(92,600/Math.max(2,N())); }
function laneY(i){ return (i-(N()-1)/2)*LH(); }
function hk(){ return LH()/122; }
function nameOf(i){ var r=R.racers[i]||{}; return clean(r.name)||String(r.name||'')||(i+1)+'번'; }

function buildRun(){
  var Rms=Number(R.raceMs)||8000;
  var arr=R.curves.map(function(c){ return c.finish*Rms; });
  var F=Math.min.apply(null,arr);
  var A=Math.max(F*0.55,F-1300);
  var order=R.order&&R.order.length?R.order.slice():arr.map(function(v,i){return i;}).sort(function(a,b){return arr[a]-arr[b];});
  var win=order[0];
  var hits=Object.keys(R.bets||{}).filter(function(u){ return R.bets[u]===win; });
  TL={R:Rms,F:F,A:A,SF:0.4,HIT:F+80,PHO:F+1050,RES:Rms+600,END:Rms+600+8000,arr:arr,order:order,win:win,hits:hits,betN:Object.keys(R.bets||{}).length};
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
  var a=TL.arr[i];
  if(s>=a) return FIN-NOSE*hk()+460*(1-Math.exp(-(s-a)/760));
  var p=progress(R.curves[i],s/TL.R);
  return X0+p*(FIN-X0-NOSE*hk());
}
function leaderX(s){ var m=-1e9; for(var i=0;i<N();i++) m=Math.max(m,runnerX(i,s)); return m; }
function ranking(s){
  var idx=[]; for(var i=0;i<N();i++) idx.push(i);
  return idx.sort(function(a,b){
    var fa=s>=TL.arr[a], fb=s>=TL.arr[b];
    if(fa&&fb) return TL.arr[a]-TL.arr[b];
    if(fa) return -1; if(fb) return 1;
    return runnerX(b,s)-runnerX(a,s);
  });
}

/* ---------- camera ---------- */
function shake(c,t,sh){ var k=Math.floor(t/16); c.x+=(rnd(k)-.5)*2*sh/c.z; c.y+=(rnd(k+977)-.5)*2*sh/c.z; return c; }
function camCollect(t){
  var o=eo(seg(t,0,520));
  var c={x:lerp(40,240,o), y:lerp(-60,0,o)+Math.sin(t*.0011)*5, z:lerp(.84,1,o)+Math.sin(t*.0007)*.006, r:lerp(-.06,0,eo(seg(t,0,620)))};
  var left=R.joinMs-t, sh=0;
  if(left<5000&&left>0){ var ph=(5000-left)%1000; sh=2+(1-ph/1000)*7*(1-left/5000+.3); c.z+=.04*(1-left/5000); }
  return shake(c,t,sh);
}
function camRun(t){
  var c, sh=0;
  if(t<TL.A){
    var s=worldS(t);
    c={x:cl(leaderX(s)-180,240,FIN), y:Math.sin(t*.0013)*6, z:lerp(1,1.08,seg(t,0,TL.A)), r:0};
    sh=1.4+(t<520?20*Math.exp(-t/150):0);
  } else if(t<TL.F){
    var p=seg(t,TL.A,TL.F), s2=worldS(t), lead=leaderX(s2), ly=laneY(TL.win);
    c={x:lerp(cl(lead-180,240,FIN),FIN-110,eio(p)), y:lerp(0,ly*.5,eio(p)), z:lerp(1.08,1.46,ei(p)), r:-.025*eio(p)};
    sh=1.6+p*7;
  } else if(t<TL.HIT){
    c=camRun(TL.F-1); c.z*=1.06; return shake(c,t,26);
  } else if(t<TL.PHO){
    var pz=1+.15*(1-eo(seg(t,TL.HIT,TL.HIT+180)));
    c={x:FIN+200/(1.5*pz), y:laneY(TL.win)*.42, z:1.5*pz, r:.0};
    sh=14*(1-seg(t,TL.HIT,TL.HIT+350));
  } else if(t<TL.RES){
    var q=eo(seg(t,TL.PHO,TL.PHO+900));
    c={x:lerp(FIN-60,FIN+180,q), y:lerp(laneY(TL.win)*.4,0,q), z:lerp(1.42,1.12,q), r:lerp(.02,0,q)};
    sh=10*Math.exp(-(t-TL.PHO)/150);
  } else {
    var q2=eo(seg(t,TL.RES,TL.RES+1100)), z=lerp(1.12,1.32,q2);
    var wx=runnerX(TL.win,worldS(t));
    c={x:lerp(FIN+180,wx+430/z,q2), y:lerp(0,laneY(TL.win)*.6,q2), z:z, r:lerp(.03,0,q2)};
    sh=12*Math.exp(-(t-TL.RES)/200);
  }
  return shake(c,t,sh);
}

/* ---------- drawing: horse ---------- */
function leg(c,hx0,hy0,ph,run,col,back){
  var a=Math.sin(ph)*0.8*run, fold=Math.max(0,Math.sin(ph+1.25))*1.25*run, b=back?fold*.7:-fold;
  var kx=hx0+Math.sin(a)*30, ky=hy0+Math.cos(a)*30;
  var fx=kx+Math.sin(a+b)*32, fy=ky+Math.cos(a+b)*32;
  c.strokeStyle=NAVY; c.lineWidth=16; c.beginPath(); c.moveTo(hx0,hy0); c.lineTo(kx,ky); c.lineTo(fx,fy); c.stroke();
  c.strokeStyle=col; c.lineWidth=9; c.beginPath(); c.moveTo(hx0,hy0); c.lineTo(kx,ky); c.lineTo(fx,fy); c.stroke();
  c.fillStyle=NAVY; c.beginPath(); c.arc(fx,fy,6,0,Math.PI*2); c.fill();
}
function drawHorse(c,x,y,k,ph,run,i,shade,glow){
  var coat=mix(COAT[i%8],'#0a1220',shade), dark=mix(mix(COAT[i%8],'#000000',.38),'#0a1220',shade), silk=mix(SILK[i%8],'#0a1220',shade);
  c.save(); c.translate(x,y); c.scale(k,k);
  c.lineJoin='round'; c.lineCap='round';
  c.fillStyle='rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(4,4,78,10,0,0,Math.PI*2); c.fill();
  var bob=-Math.abs(Math.sin(ph))*8*run;
  c.translate(0,bob);
  if(glow){ c.shadowColor=glow; c.shadowBlur=40; }
  leg(c,-36,-58,ph+.5,run,dark,true);
  leg(c,34,-60,ph+Math.PI*1.1,run,dark,false);
  c.shadowBlur=0;
  var sw=Math.sin(ph*1.0)*12*run;
  c.strokeStyle=NAVY; c.lineWidth=4;
  c.fillStyle=dark; c.beginPath(); c.moveTo(-48,-78); c.quadraticCurveTo(-84,-76+sw*.3,-100-run*8,-46+sw); c.quadraticCurveTo(-74,-54,-46,-64); c.closePath(); c.fill(); c.stroke();
  if(glow){ c.shadowColor=glow; c.shadowBlur=40; }
  c.fillStyle=coat; c.beginPath(); c.ellipse(-2,-74,52,23,0,0,Math.PI*2); c.fill(); c.shadowBlur=0; c.stroke();
  c.beginPath(); c.moveTo(24,-90); c.quadraticCurveTo(40,-118,58,-132); c.lineTo(76,-121); c.quadraticCurveTo(60,-98,48,-64); c.closePath(); c.fill(); c.stroke();
  c.save(); c.translate(72,-124); c.rotate(.62+Math.sin(ph)*.08*run);
  c.fillStyle=coat; c.beginPath(); c.ellipse(12,0,26,12,0,0,Math.PI*2); c.fill(); c.stroke();
  c.fillStyle=dark; c.beginPath(); c.ellipse(32,2,7,8,0,0,Math.PI*2); c.fill();
  c.fillStyle=NAVY; c.beginPath(); c.arc(4,-4,3,0,Math.PI*2); c.fill();
  c.restore();
  c.fillStyle=coat; c.beginPath(); c.moveTo(58,-134); c.lineTo(61,-150); c.lineTo(69,-134); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle=dark; c.lineWidth=8; c.beginPath(); c.moveTo(24,-96); c.quadraticCurveTo(42,-120,60,-134); c.stroke();
  c.strokeStyle=NAVY; c.lineWidth=4;
  leg(c,-30,-58,ph,run,coat,true);
  leg(c,38,-60,ph+Math.PI*.95,run,coat,false);
  // 번호 천
  c.fillStyle=mix(CR,'#0a1220',shade); c.beginPath(); c.roundRect(-34,-96,38,32,5); c.fill(); c.stroke();
  c.fillStyle=NAVY; c.font='900 24px '+FK; c.textAlign='center'; c.textBaseline='middle'; c.fillText(String(i+1),-15,-79);
  // 기수
  c.fillStyle=NAVY; c.beginPath(); c.ellipse(-2,-92,9,14,.5,0,Math.PI*2); c.fill();
  c.fillStyle=silk; c.beginPath(); c.ellipse(10,-112,22,12,-.4,0,Math.PI*2); c.fill(); c.stroke();
  c.strokeStyle=silk; c.lineWidth=8; c.beginPath(); c.moveTo(22,-110); c.lineTo(46,-104); c.stroke();
  c.strokeStyle=NAVY; c.lineWidth=4;
  c.fillStyle=mix('#f1d2b4','#0a1220',shade); c.beginPath(); c.arc(32,-128,10,0,Math.PI*2); c.fill(); c.stroke();
  c.fillStyle=silk; c.beginPath(); c.arc(32,-130,11,Math.PI,0); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(40,-131); c.lineTo(50,-129); c.stroke();
  c.restore();
}
function dust(c,x,y,k,amb,i,run){
  if(run<=0) return;
  for(var j=0;j<7;j++){
    var life=((amb*.004+rnd(i*13+j))%1), px=x-70*k-life*180*k-rnd(j+i)*20, py=y-life*40*k-rnd(j*3+i)*10;
    c.fillStyle='rgba(214,190,150,'+(.42*(1-life)*run)+')';
    c.beginPath(); c.arc(px,py,(8+life*22)*k,0,Math.PI*2); c.fill();
  }
}

/* ---------- drawing: world ---------- */
function drawWorld(c,cam,s,amb,o){
  var n=N(), lh=LH(), top=-n*lh/2, bot=n*lh/2, k=hk();
  var vx0=cam.x-1100/cam.z-200, vx1=cam.x+1100/cam.z+200;
  c.save();
  c.translate(CX,CY); c.rotate(cam.r); c.scale(cam.z,cam.z); c.translate(-cam.x,-cam.y);
  // 하늘
  var g=c.createLinearGradient(0,top-900,0,top-60);
  g.addColorStop(0,'#070d18'); g.addColorStop(.6,NAVY); g.addColorStop(1,'#2b3550');
  c.fillStyle=g; c.fillRect(vx0,top-1600,vx1-vx0,1560);
  // 조명탑 (시차 0.3)
  for(var L=-2;L<8;L++){
    var lx=L*1300+cam.x*.7, ly=top-560;
    if(lx<vx0-400||lx>vx1+400) continue;
    var lg=c.createRadialGradient(lx,ly,0,lx,ly,420); lg.addColorStop(0,'rgba(255,244,214,.55)'); lg.addColorStop(1,'rgba(255,244,214,0)');
    c.fillStyle=lg; c.fillRect(lx-420,ly-420,840,840);
    c.fillStyle='#0b1322'; c.fillRect(lx-6,ly,12,420);
    c.fillStyle=CR; c.fillRect(lx-60,ly-26,120,40); c.fillStyle='rgba(23,36,55,.5)'; for(var q=0;q<4;q++) c.fillRect(lx-56+q*30,ly-22,24,32);
  }
  // 관중석 (시차 0.5)
  var sx=cam.x*.5, st=top-300;
  c.fillStyle='#101a2c'; c.fillRect(vx0,st,vx1-vx0,300);
  for(var row=0;row<6;row++){
    var ry=st+20+row*44;
    c.fillStyle=row%2?'#15223a':'#1a2a46'; c.fillRect(vx0,ry,vx1-vx0,40);
    var cx0=Math.floor((vx0-sx)/30)-1, cx1=Math.floor((vx1-sx)/30)+1;
    for(var col=cx0;col<cx1;col++){
      var id=col*7+row*131, px=col*30+sx+rnd(id)*10, bob2=Math.sin(amb*.01+id)*(o.cheer?5:1.5);
      var hue=rnd(id+3);
      c.fillStyle=hue<.12?OR:hue<.2?MINT:hue<.26?GOLD:'rgba(245,243,239,'+(.18+rnd(id+5)*.25)+')';
      c.beginPath(); c.arc(px,ry+20+bob2,7,0,Math.PI*2); c.fill();
      if(o.flashes>0&&rnd(id+Math.floor(amb/90))<.035*o.flashes){ c.fillStyle='rgba(255,255,255,.95)'; c.beginPath(); c.arc(px,ry+16,11,0,Math.PI*2); c.fill(); }
    }
  }
  // 전광판 띠
  c.fillStyle=NAVY; c.fillRect(vx0,top-56,vx1-vx0,26);
  c.fillStyle=OR; c.fillRect(vx0,top-56,vx1-vx0,4);
  // 주로
  c.fillStyle='#2c8452'; c.fillRect(vx0,top-30,vx1-vx0,bot-top+70);
  var b0=Math.floor(vx0/220);
  for(var b=b0;b*220<vx1;b++){ if(b%2){ c.fillStyle='#329460'; c.fillRect(b*220,top-30,220,bot-top+70); } }
  for(var li=1;li<n;li++){
    c.strokeStyle='rgba(245,243,239,.28)'; c.lineWidth=3; c.setLineDash([36,28]);
    c.beginPath(); c.moveTo(vx0,top+li*lh); c.lineTo(vx1,top+li*lh); c.stroke();
  }
  c.setLineDash([]);
  // 거리 표지 (펄롱 기둥)
  [[FIN-1200,'300'],[FIN-800,'200'],[FIN-400,'100']].forEach(function(m){
    var mx=m[0]; if(mx<vx0||mx>vx1) return;
    c.fillStyle='rgba(245,243,239,.12)'; c.fillRect(mx-3,top-30,6,bot-top+70);
    for(var z2=0;z2<6;z2++){ c.fillStyle=z2%2?CR:'#E0342C'; c.fillRect(mx-8,top-170+z2*24,16,24); }
    c.fillStyle=CR; c.fillRect(mx-46,top-220,92,52); c.strokeStyle=NAVY; c.lineWidth=4; c.strokeRect(mx-46,top-220,92,52);
    c.fillStyle=NAVY; c.font='800 30px '+FM; c.textAlign='center'; c.textBaseline='middle'; c.fillText(m[1],mx,top-193);
  });
  // 결승선
  if(FIN>vx0-200&&FIN<vx1+200){
    var gl=o.finGlow||0;
    if(gl>0){ var fg=c.createLinearGradient(FIN-180,0,FIN+180,0); fg.addColorStop(0,'rgba(255,198,26,0)'); fg.addColorStop(.5,'rgba(255,198,26,'+(.45*gl)+')'); fg.addColorStop(1,'rgba(255,198,26,0)'); c.fillStyle=fg; c.fillRect(FIN-180,top-30,360,bot-top+70); }
    for(var cy=top-30;cy<bot+40;cy+=16){ for(var cx2=0;cx2<2;cx2++){ c.fillStyle=((cy/16|0)+cx2)%2?'#0d1626':CR; c.fillRect(FIN-16+cx2*16,cy,16,16); } }
    c.fillStyle='#E0342C'; c.fillRect(FIN-7,top-300,14,270);
    c.fillStyle=CR; c.beginPath(); c.arc(FIN,top-310,46,0,Math.PI*2); c.fill(); c.strokeStyle=NAVY; c.lineWidth=6; c.stroke();
    c.fillStyle='#E0342C'; c.beginPath(); c.arc(FIN,top-310,30,0,Math.PI*2); c.fill();
    c.fillStyle=NAVY; c.fillRect(FIN+60,top-262,220,62); c.fillStyle=OR; c.fillRect(FIN+60,top-262,10,62);
    c.fillStyle=CR; c.font='42px '+FT; c.textAlign='left'; c.textBaseline='middle'; c.fillText('FINISH',FIN+86,top-230);
  }
  // 위 난간
  c.strokeStyle=CR; c.lineWidth=8; c.beginPath(); c.moveTo(vx0,top-34); c.lineTo(vx1,top-34); c.stroke();
  for(var pp=Math.floor(vx0/140);pp*140<vx1;pp++){ c.fillStyle='#cfd6df'; c.fillRect(pp*140-3,top-34,6,22); }
  // 출발 게이트 (뒤쪽 틀)
  var go=o.gate;
  if(vx0<300){
    for(var gi=0;gi<n;gi++){
      var gy=top+gi*lh;
      c.fillStyle='#0f1a2c'; c.fillRect(-150,gy+4,18,lh-8);
    }
  }
  // 주자 (위 레인부터 → 아래 레인이 앞에 겹침)
  for(var i=0;i<n;i++){
    var x=runnerX0(i,s,o), y=laneY(i)+lh*.34;
    var arrived=o.run&&s>=TL.arr[i];
    var run=o.run? (arrived? Math.max(.25,Math.exp(-(s-TL.arr[i])/900)) : Math.min(1,s/300)) : 0;
    var ph=o.run? amb*.024*(.9+rnd(i)*.25)+i : 0;
    if(!o.run){ ph=Math.sin(amb*.003+i)*.3; }
    if(o.run&&!arrived) dust(c,x,y,k,amb,i,run);
    var sh2=o.dim? (o.lead.indexOf(i)>=0?0:o.dim*.55) : 0;
    var solo=o.solo>=0&&o.solo!==i;
    var glow=o.glowIdx===i? 'rgba(255,198,26,.9)' : null;
    if(o.halo&&o.glowIdx===i) halo(c,x+20*k,y-80*k,amb,o.halo);
    drawHorse(c,x,y,k,ph,run,i,sh2,glow);
    // 이름표
    if(o.tags&&!solo){
      var ty=y-170*k, nm=nameOf(i);
      c.save(); c.globalAlpha=1-sh2;
      c.font='900 26px '+FK; var tw=Math.min(200,c.measureText(nm).width);
      c.fillStyle='rgba(10,18,30,.82)'; c.beginPath(); c.roundRect(x-20,ty-20,tw+62,40,8); c.fill();
      c.fillStyle=SILK[i%8]; c.beginPath(); c.roundRect(x-20,ty-20,40,40,8); c.fill();
      c.fillStyle=NAVY; c.font='900 24px '+FK; c.textAlign='center'; c.textBaseline='middle'; c.fillText(String(i+1),x,ty+1);
      c.fillStyle=CR; c.font='900 26px '+FK; c.textAlign='left'; c.fillText(nm,x+30,ty+1,200);
      c.restore();
    }
    if(o.run&&arrived&&o.ranks&&!solo){
      var rk=TL.order.indexOf(i)+1, rp=eback(seg(s,TL.arr[i],TL.arr[i]+260));
      c.save(); c.translate(x+120*k,y-70*k); c.scale(rp,rp);
      c.fillStyle=rk===1?GOLD:CR; c.beginPath(); c.arc(0,0,30,0,Math.PI*2); c.fill(); c.strokeStyle=NAVY; c.lineWidth=5; c.stroke();
      c.fillStyle=NAVY; c.font='26px '+FT; c.textAlign='center'; c.textBaseline='middle'; c.fillText(rk+'착',0,2);
      c.restore();
    }
  }
  // 출발 게이트 (앞 문)
  if(vx0<400){
    for(var gj=0;gj<n;gj++){
      var gy2=top+gj*lh, open=go;
      c.save(); c.translate(150,gy2+4);
      c.fillStyle=NAVY; c.fillRect(-8,0,16,lh-8);
      c.scale(1-open*.92,1);
      c.fillStyle=OR; c.fillRect(8,0,26,lh-8); c.strokeStyle=NAVY; c.lineWidth=4; c.strokeRect(8,0,26,lh-8);
      c.fillStyle=CR; c.fillRect(14,(lh-8)/2-12,14,24);
      c.restore();
    }
    c.fillStyle=NAVY; c.fillRect(-160,top-60,320,30); c.fillStyle=CR; c.font='800 20px '+FM; c.textAlign='center'; c.textBaseline='middle'; c.fillText('START GATE',0,top-45);
  }
  // 아래 난간 + 안쪽 잔디
  c.fillStyle='#1c5e3a'; c.fillRect(vx0,bot+44,vx1-vx0,900);
  c.strokeStyle=CR; c.lineWidth=10; c.beginPath(); c.moveTo(vx0,bot+40); c.lineTo(vx1,bot+40); c.stroke();
  for(var pq=Math.floor(vx0/140);pq*140<vx1;pq++){ c.fillStyle='#cfd6df'; c.fillRect(pq*140-4,bot+40,8,30); }
  // 출전표 (대기 화면)
  if(o.plates) plates(c,top,lh);
  c.restore();
}
function runnerX0(i,s,o){ return o.run? runnerX(i,s) : X0; }
function halo(c,x,y,amb,a){
  c.save(); c.translate(x,y); c.rotate(amb*.0008); c.globalCompositeOperation='lighter';
  for(var i=0;i<18;i++){
    var an=i/18*Math.PI*2;
    var gr=c.createRadialGradient(0,0,0,0,0,700); gr.addColorStop(0,'rgba(255,200,80,'+(.5*a)+')'); gr.addColorStop(1,'rgba(255,120,30,0)');
    c.fillStyle=gr; c.beginPath(); c.moveTo(0,0); c.arc(0,0,700,an-.07,an+.07); c.closePath(); c.fill();
  }
  var gl=c.createRadialGradient(0,0,0,0,0,260); gl.addColorStop(0,'rgba(255,226,140,'+(.6*a)+')'); gl.addColorStop(1,'rgba(255,140,40,0)');
  c.fillStyle=gl; c.beginPath(); c.arc(0,0,260,0,Math.PI*2); c.fill();
  c.restore();
}
function plates(c,top,lh){
  var n=N(), now=performance.now();
  for(var i=0;i<n;i++){
    var y=top+i*lh, h=lh-12, x=-560, w=380;
    var inP=eo(seg(o_t,120+i*55,420+i*55));
    c.save(); c.translate((1-inP)*-260,0); c.globalAlpha=inP;
    c.fillStyle='rgba(10,18,30,.86)'; c.beginPath(); c.roundRect(x,y+6,w,h,10); c.fill();
    c.fillStyle=SILK[i%8]; c.beginPath(); c.roundRect(x,y+6,h,h,10); c.fill();
    c.fillStyle=NAVY; c.font=Math.round(h*.62)+'px '+FT; c.textAlign='center'; c.textBaseline='middle'; c.fillText(String(i+1),x+h/2,y+6+h/2+2);
    var r=R.racers[i]||{}, nm=nameOf(i);
    c.textAlign='left'; c.fillStyle=CR; fitFont(c,nm,'900 ',Math.round(h*.46),210,FK,16); c.fillText(nm,x+h+18,y+6+h/2+1);
    var b=counts[i]||0, bp=bump[i]?1-seg(now-bump[i],0,420):0;
    c.save(); c.translate(x+w-56,y+6+h/2); c.scale(1+bp*.45,1+bp*.45);
    c.fillStyle=b>0?OR:'rgba(245,243,239,.14)'; c.beginPath(); c.roundRect(-44,-h*.32,88,h*.64,h*.32); c.fill();
    c.fillStyle=b>0?CR:'rgba(245,243,239,.7)'; c.font='900 '+Math.round(h*.34)+'px '+FK; c.textAlign='center'; c.fillText(b+'명',0,1);
    c.restore();
    if(r.emoji){ c.font=Math.round(h*.36)+'px '+FK; c.textAlign='left'; c.globalAlpha=inP*.9; c.fillText(String(r.emoji),x+w-150,y+6+h/2+1); }
    c.restore();
  }
}
var o_t=0;

/* ---------- screen fx ---------- */
function streaks(c,t,alpha,spd,n){
  if(alpha<=0) return;
  for(var i=0;i<n;i++){
    var y=P.y+140+rnd(i+5)*(P.h-180), l=160+rnd(i+9)*420, x=P.x+P.w-((rnd(i+1)*2400+t*spd*(.7+rnd(i+3)*.6))%2400)+300;
    c.fillStyle='rgba(245,243,239,'+(alpha*(.2+rnd(i+7)*.45))+')'; c.fillRect(x,y,l,2+rnd(i+8)*4);
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
function w2s(cam,wx,wy){ var dx=(wx-cam.x)*cam.z, dy=(wy-cam.y)*cam.z, c=Math.cos(cam.r), s=Math.sin(cam.r); return {x:CX+dx*c-dy*s,y:CY+dx*s+dy*c}; }

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
  var on=Math.floor(t/450)%2===0;
  c.fillStyle=on?'#ff2e2e':'rgba(255,46,46,.3)'; c.beginPath(); c.arc(P.x+92,P.y+52,11,0,Math.PI*2); c.fill();
  c.font='800 26px '+FM; c.fillStyle=CR; c.fillText('LIVE',P.x+112,P.y+53);
  c.font='700 22px '+FK; c.fillStyle='rgba(245,243,239,.85)'; c.fillText('경마 중계',P.x+190,P.y+53);
  c.fillStyle=MINT; c.font='700 20px '+FM;
  var camTxt=MODE==='collect'?'CAM 1 · 출발 게이트':(t<TL.F?'CAM 3 · 트래킹':t<TL.PHO?'PHOTO · 결승 판정':'CAM 5 · 결승선');
  c.fillText(camTxt,P.x+92,P.y+86);
  if(MODE==='run'){
    var rt=t<TL.F?story(t):t>=TL.PHO?t:TL.F;
    c.fillStyle=CR; c.font='800 30px '+FM; c.fillText('RACE '+(t>=TL.F?fmtT(TL.F):fmtT(rt)),P.x+92,P.y+124);
    if(t>=TL.A&&t<TL.F&&Math.floor(t/380)%2===0){ c.fillStyle=OR; c.font='800 24px '+FM; c.fillText('▶ SLOW ×0.4',P.x+92,P.y+160); }
    if(t>=TL.RES&&Math.floor(t/380)%2===0){ c.fillStyle=OR; c.font='800 24px '+FM; c.fillText('▶ SLOW ×0.25',P.x+92,P.y+160); }
  }
  }
  var pi=phaseOf(t), pw=150, gap=10, total=5*pw+4*gap, sx=960-total/2+60;
  for(var i=0;i<5;i++){
    var x=sx+i*(pw+gap), y=P.y+34, act=i===pi.i, done=i<pi.i;
    c.fillStyle=act?OR:done?'rgba(245,243,239,.85)':'rgba(10,18,28,.55)'; c.fillRect(x,y,pw,40);
    if(!act&&!done){ c.strokeStyle='rgba(245,243,239,.45)'; c.lineWidth=2; c.strokeRect(x+1,y+1,pw-2,38); }
    if(act){ c.fillStyle='rgba(23,36,55,.35)'; c.fillRect(x,y+34,pw*pi.p,6); }
    c.fillStyle=act?CR:done?NAVY:'rgba(245,243,239,.7)'; c.font='700 22px '+FK; c.textAlign='center';
    c.fillText(PH[i].n+' '+PH[i].ko,x+pw/2,y+21);
  }
  c.textAlign='left';
  // 순위판 (질주·막판·결승 라이브)
  if(MODE==='run'&&(t<TL.F||(t>=TL.PHO&&t<TL.RES+300))){
    var s=worldS(t), rk=ranking(s), bx=P.x+P.w-300, by=P.y+120, rh=Math.min(40,300/N());
    var a=t<TL.A?1:t<TL.F?.55:1-seg(t,TL.RES,TL.RES+300);
    c.globalAlpha=a;
    c.fillStyle='rgba(6,12,22,.78)'; c.fillRect(bx,by,256,rh*N()+48);
    c.fillStyle=OR; c.fillRect(bx,by,256,36); c.fillStyle=CR; c.font='800 20px '+FM; c.fillText('POSITION',bx+14,by+19);
    for(var j=0;j<rk.length;j++){
      var ri=rk[j], ry=by+44+j*rh+rh/2;
      if(j===0){ c.fillStyle='rgba(255,91,23,.28)'; c.fillRect(bx,ry-rh/2,256,rh); }
      c.fillStyle=CR; c.font='800 '+Math.round(rh*.55)+'px '+FM; c.fillText(String(j+1),bx+14,ry+1);
      c.fillStyle=SILK[ri%8]; c.fillRect(bx+44,ry-rh*.38,rh*.76,rh*.76);
      c.fillStyle=NAVY; c.font='900 '+Math.round(rh*.5)+'px '+FK; c.textAlign='center'; c.fillText(String(ri+1),bx+44+rh*.38,ry+1); c.textAlign='left';
      c.fillStyle=CR; c.font='900 '+Math.round(rh*.52)+'px '+FK; c.fillText(nameOf(ri),bx+56+rh*.8,ry+1,150);
    }
    c.globalAlpha=1;
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
  var e2=Math.min(s0+1750,e||1e12), inn=eo(seg(t,s0,s0+380)), out=seg(t,e2-250,e2);
  if(inn<=0||out>=1) return;
  var x=P.x-30, y=P.y+P.h-232;
  c.save(); c.textBaseline='middle';
  c.font='108px '+FT; var tw=c.measureText(ko).width, bw=(tw+90)*inn*(1-ei(out));
  var nd=(1-eback(cl(inn)))*-140;
  c.fillStyle=OR; c.fillRect(x,y+nd,156,156);
  c.fillStyle=NAVY; c.font='96px '+FT; c.fillText(n,x+18,y+84+nd);
  c.save(); c.beginPath(); c.rect(x+156,y,bw,156); c.clip();
  c.fillStyle=dark?'#2a0f0a':NAVY; c.fillRect(x+156,y,tw+90,156);
  var jx=dark?(rnd(Math.floor(t/30))-.5)*8:0;
  c.font='108px '+FT; c.fillStyle=CR; c.fillText(ko,x+200+jx,y+84);
  c.restore();
  c.globalAlpha=inn*(1-out);
  c.font='700 38px '+FK; c.lineWidth=8; c.strokeStyle='rgba(4,10,18,.85)'; c.lineJoin='round';
  c.strokeText(sub,x+20,y+196); c.fillStyle=CR; c.fillText(sub,x+20,y+196);
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

/* ---------- collect board (screen) ---------- */
function collectBoard(c,t){
  var x0=1120, y0=290, inP=seg(t,160,560), ox=(1-eback(inP))*700;
  if(inP<=0) return;
  c.save(); c.translate(ox,0); c.textBaseline='middle';
  if(inP<1){ c.fillStyle='rgba(245,243,239,'+(.6*(1-inP))+')'; for(var i=0;i<8;i++) c.fillRect(x0+620+rnd(i)*200,y0+20+i*60,260+rnd(i+3)*260,6); }
  c.transform(1,0,-.08,1,0,0); c.translate(y0*.08+30,0);
  c.fillStyle='rgba(0,0,0,.45)'; c.fillRect(x0+16,y0+20,600,520);
  c.fillStyle=CR; c.fillRect(x0,y0,600,520);
  c.fillStyle=OR; c.fillRect(x0,y0,18,520);
  c.fillStyle=NAVY; c.fillRect(x0+18,y0,582,92);
  c.fillStyle=OR; c.font='60px '+FT; c.fillText('1등을 맞혀라!',x0+46,y0+48);
  c.fillStyle=NAVY; c.font='800 26px '+FK; c.fillText('채팅으로 1등 예측',x0+46,y0+136);
  var cmd=String(R.command||'!경주')+' 번호';
  c.fillStyle=NAVY; c.beginPath(); c.roundRect(x0+46,y0+164,520,70,14); c.fill();
  c.fillStyle=OR; fitFont(c,cmd,'900 ',40,480,FK,20); c.fillText(cmd,x0+70,y0+200);
  var total=0; counts.forEach(function(v){ total+=v; });
  c.fillStyle='rgba(23,36,55,.65)'; c.font='800 26px '+FK; c.fillText('예측 참가 '+total+'명',x0+46,y0+272);
  var left=Math.max(0,R.joinMs-t), sec=Math.ceil(left/1000), urgent=left>0&&sec<=5;
  if(left>0){
    var sp=urgent?eback(cl(((R.joinMs-left)%1000)/180)):1, sc=urgent?lerp(1.9,1,sp):1;
    c.save(); c.translate(x0+48,y0+392); c.scale(sc,sc);
    c.font='150px '+FT; c.fillStyle=urgent?'#E0342C':NAVY; c.fillText(String(sec),8,8);
    c.fillStyle=urgent?OR:NAVY; c.fillText(String(sec),0,0);
    c.restore();
    c.fillStyle=NAVY; c.font='900 44px '+FK; c.fillText('초',x0+48+(sec>=10?180:100)+(urgent?20:0),y0+420);
  } else {
    var mp=eback(seg(t,R.joinMs,R.joinMs+260));
    c.save(); c.translate(x0+48,y0+392); c.scale(lerp(1.9,1,mp),lerp(1.9,1,mp)); c.font='130px '+FT; outlined(c,'마감!',0,0,OR,NAVY,12,null,0); c.restore();
  }
  c.fillStyle=NAVY; c.fillRect(x0+46,y0+476,520,22);
  c.fillStyle=urgent?OR:MINT; c.fillRect(x0+49,y0+479,514*cl(left/R.joinMs),16);
  c.restore();
}

/* ---------- run overlays ---------- */
function goText(c,t){
  if(t<0||t>900) return;
  var p=seg(t,0,200), s=lerp(2.2,1,eback(p)), a=1-seg(t,700,900);
  c.save(); c.globalAlpha=a; c.translate(1120,470); c.rotate(-.08+.08*eo(p)); c.scale(s,s);
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
    var lp=w2s(cam,runnerX(TL.win,worldS(t))+40,laneY(TL.win));
    var og=c.createRadialGradient(lp.x,lp.y,260,lp.x,lp.y,1200);
    og.addColorStop(0,'rgba(255,91,23,0)'); og.addColorStop(1,'rgba(255,60,10,'+Math.min(.5,ten*.5)+')');
    c.fillStyle=og; c.fillRect(0,0,W,H);
    c.save(); c.translate(lp.x,lp.y);
    for(var i=0;i<46;i++){
      var a=rnd(i+400)*Math.PI*2, r0=300+rnd(i+401)*200+((t*.3)%60), r1=r0+260+rnd(i+402)*420;
      c.strokeStyle='rgba(245,243,239,'+(ten*.24)+')'; c.lineWidth=2+rnd(i+403)*4;
      c.beginPath(); c.moveTo(Math.cos(a)*r0,Math.sin(a)*r0); c.lineTo(Math.cos(a)*r1,Math.sin(a)*r1); c.stroke();
    }
    c.restore();
    // 남은 거리
    var dist=Math.max(0,Math.round((FIN-NOSE*hk()-runnerX(TL.win,worldS(t)))/FIN*1200));
    c.save(); c.translate(960,P.y+150); c.textAlign='center'; c.textBaseline='middle';
    c.fillStyle='rgba(4,8,14,.8)'; c.fillRect(-190,-30,380,60); c.fillStyle=OR; c.fillRect(-190,-30,8,60);
    c.fillStyle=CR; c.font='800 34px '+FM; c.fillText('결승까지 '+dist+'m',0,2);
    c.restore();
  }
  var hb=86*eo(seg(t,TL.A,TL.A+400))*(1-seg(t,TL.HIT,TL.HIT+220));
  letterbox(c,hb);
}
function impactFX(c,t,cam){
  if(t<TL.F||t>=TL.PHO+300) return;
  var fp=w2s(cam,FIN,laneY(TL.win));
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
/* 사진 판정 정지 컷: 흑백 + 세피아 + 판정선 + 필름 테두리 */
function photoLook(c,t,cam){
  if(t<TL.HIT||t>=TL.PHO) return;
  c.save();
  c.globalCompositeOperation='saturation'; c.fillStyle='#808080'; c.fillRect(P.x,P.y,P.w,P.h);
  c.globalCompositeOperation='multiply'; c.fillStyle='#d6c49c'; c.fillRect(P.x,P.y,P.w,P.h);
  c.globalCompositeOperation='source-over';
  var fx=w2s(cam,FIN,0).x;
  c.fillStyle='rgba(224,52,44,.9)'; c.fillRect(fx-3,P.y,6,P.h);
  var sy=P.y+((t-TL.HIT)*1.6%P.h);
  c.fillStyle='rgba(255,255,255,.18)'; c.fillRect(P.x,sy,P.w,10);
  for(var y=P.y;y<P.y+P.h;y+=4){ c.fillStyle='rgba(0,0,0,.05)'; c.fillRect(P.x,y,P.w,1); }
  c.fillStyle='#0b0b0b'; c.fillRect(P.x,P.y,P.w,46); c.fillRect(P.x,P.y+P.h-46,P.w,46);
  for(var x=P.x+20;x<P.x+P.w;x+=56){ c.fillStyle='#efe2c4'; c.fillRect(x,P.y+12,30,22); c.fillRect(x,P.y+P.h-34,30,22); }
  c.fillStyle='#0b0b0b'; c.fillRect(P.x+60,P.y+70,520,56);
  c.fillStyle='#E0342C'; c.beginPath(); c.arc(P.x+92,P.y+98,12,0,Math.PI*2); c.fill();
  c.fillStyle='#efe2c4'; c.font='800 30px '+FM; c.textBaseline='middle'; c.fillText('PHOTO FINISH · 사진 판정',P.x+116,P.y+99);
  c.fillStyle='#0b0b0b'; c.fillRect(P.x+P.w-470,P.y+P.h-130,410,60);
  c.fillStyle='#efe2c4'; c.font='800 34px '+FM; c.textAlign='right'; c.fillText('1착  '+fmtT(TL.F)+'s',P.x+P.w-80,P.y+P.h-99);
  c.restore();
}
function winText(c,t){
  if(t<TL.HIT||t>TL.PHO+260) return;
  var p=seg(t,TL.HIT,TL.HIT+200), s=lerp(1.9,1,eback(p))*(1+seg(t,TL.HIT+200,TL.PHO)*.05), a=1-seg(t,TL.PHO,TL.PHO+260);
  var ang=lerp(-.105,0,eo(p))-.06;
  c.save(); c.globalAlpha=a; c.translate(1360,500); c.rotate(ang);
  c.save(); c.rotate(t*.0015); c.scale(s*.92,s*.92); starburst(c,190,290,18,CR); c.restore();
  c.scale(s,s); c.textAlign='center'; c.textBaseline='middle';
  c.font='240px '+FT; c.fillStyle=GOLD; c.fillText('1착!',12,16);
  outlined(c,'1착!',0,0,OR,NAVY,22,null,0);
  var nm=(TL.win+1)+'번 '+nameOf(TL.win);
  fitFont(c,nm,'',76,560,FT,30); c.fillStyle=NAVY; c.fillRect(-290,112,580,92);
  c.fillStyle=CR; c.fillText(nm,0,160);
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
    c.fillStyle=NAVY; c.font='96px '+FT; c.textAlign='center'; c.fillText(String(TL.win+1),62,6); c.textAlign='left';
    var nm=nameOf(TL.win); fitFont(c,nm,'',150,w-260,FT,40);
    c.fillStyle=SILK[TL.win%8]==='#F5F3EF'?OR:SILK[TL.win%8]; c.fillText(nm,154,12); c.fillStyle=NAVY; c.fillText(nm,146,4);
    c.restore();
  }
  // 순위 줄
  var sp=seg(t,T+620,T+820);
  c.globalAlpha=sp; c.fillStyle=NAVY;
  var line=TL.order.slice(1,4).map(function(ri,k){ return (k+2)+'착 '+nameOf(ri); }).join(' · ');
  fitFont(c,line||'단독 질주','800 ',30,w-110,FK,16); c.fillText(line||'단독 질주',x0+56,y0+330);
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
  o_t=t;
  if(MODE==='collect'){
    cam=camCollect(t); s=0; amb=t;
    o={run:false,gate:0,tags:false,plates:true,flashes:0};
  } else {
    var frozen=t>=TL.F&&t<TL.PHO;
    cam=camRun(t); s=worldS(t); amb=frozen?TL.F:(t>=TL.RES?TL.RES+(t-TL.RES)*.25:t);
    var ten=seg(t,TL.A,TL.F);
    o={run:true,gate:eo(seg(t,0,260)),tags:t<TL.F||t>=TL.PHO,plates:false,ranks:true,
       dim:(t>=TL.A&&t<TL.F)?eo(ten):(t>=TL.RES?.9*eo(seg(t,TL.RES,TL.RES+500)):0), lead:t>=TL.RES?[TL.win]:ranking(s).slice(0,2), solo:t>=TL.RES+200?TL.win:-1, finGlow:t<TL.F?ten:(t<TL.RES?1-seg(t,TL.PHO,TL.PHO+800):0),
       glowIdx:t>=TL.F?TL.win:-1, halo:t>=TL.RES?eo(seg(t,TL.RES,TL.RES+500)):0,
       flashes:(t>=TL.HIT&&t<TL.RES)?1:(t>=TL.A&&t<TL.F?.3:0), cheer:t>=TL.A};
  }
  X.save(); X.shadowColor='rgba(0,0,0,.55)'; X.shadowBlur=50; X.shadowOffsetY=14;
  panelPath(X,P.x,py,P.w,ph,P.k); X.fillStyle='#061019'; X.fill(); X.restore();
  X.save(); panelPath(X,P.x,py,P.w,ph,P.k); X.clip();
  drawWorld(X,cam,s,amb,o);
  if(MODE==='run'){
    if(t>=TL.RES){
      var wa=eo(seg(t,TL.RES+150,TL.RES+700));
      X.save(); X.globalAlpha=.18*wa; X.font='300px '+FT; X.textBaseline='middle'; X.strokeStyle=CR; X.lineWidth=3;
      X.strokeText('WINNER WINNER',160-(t-TL.RES)*.05,560); X.restore();
    }
    streaks(X,t,t<TL.A?.55:t<TL.F?.25:0,3.2,40);
  }
  vignette(X,.6);
  if(MODE==='run'){ tensionFX(X,t,cam); photoLook(X,t,cam); impactFX(X,t,cam); }
  if(MODE==='run'&&t>=TL.RES){ var a2=.45*(1-seg(t,TL.RES,TL.RES+260)); X.fillStyle='rgba(255,240,210,'+a2+')'; X.fillRect(0,0,W,H); }
  grain(X,t);
  X.restore();
  hud(X,t,py,ph);
  if(rv>=.97){
    if(MODE==='collect') collectBoard(X,t);
    else {
      goText(X,t);
      chapter(X,t,'02','질주','게이트 오픈 — 트래킹 카메라 추적 중',150,false,TL.A);
      chapter(X,t,'03','막판','결승선 직전, 누가 먼저 코를 내미나',TL.A,true,TL.F);
      winText(X,t);
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
  at('go',0,function(){ FX.sound('whoosh'); FX.sound('stop'); });
  for(var k=0;k*340+520<TL.A;k++) (function(k){ at('hoof'+k,520+k*340,function(){ FX.sound('tick'); }); })(k);
  at('tension',TL.A,function(){ FX.drumStart(200); FX.sound('reveal'); });
  at('impact',TL.F,function(){ FX.drumStop(); FX.sound('stop'); FX.flash('rgba(255,250,236,.35)'); });
  for(var j=1;j<TL.order.length;j++) (function(j){ var ri=TL.order[j]; at('arr'+j,TL.arr[ri],function(){ if(t<TL.PHO) return; FX.sound('pop'); }); })(j);
  at('back',TL.PHO,function(){ FX.sound('whoosh'); });
  at('res',TL.RES+40,function(){ FX.sound('reveal'); });
  at('name',TL.RES+400,function(){
    FX.sound(TL.hits.length?'jackpot':'win');
    FX.confetti({x:560,y:420,count:TL.hits.length?200:110,colors:TL.hits.length?['#FFC928','#FF5B17','#fff','#00CB84']:undefined});
  });
  at('stamp',TL.RES+560,function(){ FX.sound('stop'); });
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
  MODE='collect'; KEY=key; R=r; TL=null; cues={}; lastSec=-1; lastTotal=-1; counts=[]; bump=[]; BAL=0; resultSeen=false;
  if(wasNone) openAt=performance.now();
  setCounts(r,false);
  var t=Date.now()-(r.deadline-r.joinMs);
  if(t>300) cue(t,true);
}
function startRun(r,key){
  var wasNone=MODE==='none';
  if(window.FX){ FX.drumStop(); FX.hideWinner(); }
  MODE='run'; KEY=key; R=r; cues={}; BAL=0; resultSeen=false;
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
