// OBS 오버레이 페이지: lottery — '복권 긁기 매크로 렌즈' 연출 (등장 → 긁기 → 두근두근 → 공개 → 결과)
// 모션 언어: .inhabited/motion-language.md (기준: fish.ts '수중 다큐 카메라'). 캔버스 1장에 타임라인 렌더 + 카메라 리그.
// 엔진의 state.lottery(LotteryPickState: prize, color, detail, triggeredBy, scratchMs, isWin) 로 1회 재생.
//  - 긁기 구간 길이 = 엔진 scratchMs (등장 600ms 뒤 시작) → 공개 = 600 + scratchMs, 결과 화면 4.8초 뒤 페이드
//  - 진행 중 같은 판 상태가 다시 와도(대기열 수 변경 등) 무시, running 이 아닌 상태를 거친 뒤 오는 running = 새 판 (이전 판 즉시 취소)
//  - 레이아웃은 전부 고정 좌표 (DOM 측정 없음)
import { FX_SCRIPT } from './_fx'

export const LOTTERY_OVERLAY_HTML = (port: number) => `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>복권 매크로 렌즈</title>
<meta name="viewport" content="width=1920">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@500;700;800;900&family=JetBrains+Mono:wght@500;700;800&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;padding:0;background:transparent !important;overflow:hidden;width:1920px;height:1080px}
  canvas{display:block;width:1920px;height:1080px}
  #anc{position:fixed;left:142px;top:232px;width:915px;height:581px;pointer-events:none}
</style>
</head>
<body>
<canvas id="c" width="1920" height="1080"></canvas>
<div id="anc"></div>
<script>${FX_SCRIPT}<\/script>
<script>
(function(){
var C=document.getElementById('c'), X=C.getContext('2d'), ANC=document.getElementById('anc');
var W=1920, H=1080;
var NAVY='#172437', OR='#FF5B17', CR='#F5F3EF', MINT='#00CB84', YEL='#FFC61A', GREY='#7A8394';
var FT='"Black Han Sans","Noto Sans KR",sans-serif';
var FK='"Noto Sans KR","Apple SD Gothic Neo",sans-serif';
var FM='"JetBrains Mono",ui-monospace,Menlo,monospace';

/* ---------- helpers ---------- */
function cl(v,a,b){ if(a===undefined)a=0; if(b===undefined)b=1; return Math.max(a,Math.min(b,v)); }
function lerp(a,b,p){ return a+(b-a)*p; }
function seg(t,a,b){ return cl((t-a)/(b-a)); }
function eo(p){ return 1-Math.pow(1-p,3); }
function ei(p){ return p*p*p; }
function eio(p){ return p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2; }
function eback(p){ var c1=2.0,c3=c1+1; return 1+c3*Math.pow(p-1,3)+c1*Math.pow(p-1,2); }
function rnd(i){ var x=Math.sin(i*127.1+311.7)*43758.5453; return x-Math.floor(x); }
function withAlpha(hex,a){
  var m=/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex||'').trim());
  if(!m) return 'rgba(255,198,26,'+a+')';
  var h=m[1]; if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  var n=parseInt(h,16);
  return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';
}

/* ---------- data ---------- */
var D={ prize:'', color:YEL, detail:'', nick:'', isWin:true, big:false, prizeGift:'', paid:0, no:'001' };

/* ---------- timeline (실제 ms) ---------- */
var TB=600;                       // 긁기 시작 (등장 끝)
var S=3000, TT=0, R=0, END=0;     // 긁기 길이 / 긴장 시작 / 공개 / 결과 끝
var HIT=80;                       // 히트스톱
function setTimes(ms){ S=Math.max(600,Number(ms)||3000); TT=TB+S*0.62; R=TB+S; END=R+4800; }
setTimes(3000);
/* 공개 이후 파티클·후광은 슬로모션 (0.25배) */
function tau(t){ return t<R?t:R+(t-R)*0.25; }

/* ---------- ticket geometry (world) ---------- */
var TK={x:-520,y:-330,w:1040,h:660};
var SP={x:-470,y:-70,w:940,h:360};   // 은박 패널
var PY=110;                          // 상품 글자 중심 y
var ROWS=[0,7,1,6,2,5,3,4];          // 긁는 순서: 위아래 먼저(글자 끝만 살짝), 가운데 두 줄은 긴장 구간에 천천히
var NP=ROWS.length, BR=38, JUMP=0.12;
function rowY(r){ return SP.y+22.5+45*r; }
var P={x:140,y:100,w:1640,h:870,k:52};  // 카메라 화면

/* 긁기 진행도 (0~1): 진행 구간은 일정한 빠른 리듬, 긴장 구간은 감속 */
function prog(t){
  if(t<TB) return 0;
  if(t<TT) return 0.75*seg(t,TB,TT);
  if(t<R){ // 가운데 첫 줄은 보통 속도 → 마지막 줄은 글자 위에서 확 느려짐(될까 말까) → 끝에서 '탁' 하고 마저 긁음
    var u=seg(t,TT,R), h;
    if(u<.36) h=.5*(u/.36);
    else if(u<.9) h=.5+.4*(1-Math.pow(1-(u-.36)/.54,2.2));
    else h=.9+.1*ei((u-.9)/.1);
    return 0.75+0.25*h;
  }
  return 1;
}
/* 진행도 s → 동전 위치 {x,y,lift} (줄 사이는 들어서 이동) */
function pathPt(s){
  s=cl(s,0,0.99999);
  var f=s*NP, k=Math.floor(f), u=f-k;
  var ltr=(k%2===0), y=rowY(ROWS[k]);
  var x0=ltr?-505:505, x1=ltr?505:-505;
  if(k>0 && u<JUMP){
    var pk=k-1, py=rowY(ROWS[pk]), pe=(pk%2===0)?505:-505, q=eio(u/JUMP);
    return {x:lerp(pe,x0,q), y:lerp(py,y,q), lift:Math.sin(q*Math.PI), on:false, k:k};
  }
  var v=k>0?(u-JUMP)/(1-JUMP):u, x=lerp(x0,x1,v);
  return {x:x, y:y+Math.sin(x*.021+k*1.7)*7, lift:0, on:true, k:k};
}
function coinAt(t){
  if(t<350) return null;
  if(t<TB){ var p=eo(seg(t,350,TB)), e=pathPt(0); return {x:lerp(760,e.x,p), y:lerp(-560,e.y,p)-Math.sin(p*Math.PI)*120, lift:1-p, rot:(1-p)*5, on:false}; }
  if(t<R){ var c=pathPt(prog(t)); c.rot=Math.sin(t*.018)*.25+(c.k%2?.35:-.35); return c; }
  var q=seg(t,R,R+320), e2=pathPt(0.99999);
  if(q>=1) return null;
  return {x:lerp(e2.x,-900,eo(q)), y:lerp(e2.y,-900,eo(q)), lift:q, rot:-q*7, on:false};
}

/* ---------- foil (offscreen, 2x) ---------- */
var FS=2, FO=document.createElement('canvas'); FO.width=SP.w*FS; FO.height=SP.h*FS;
var FX2=FO.getContext('2d'), foilS=-1;
function drawFoil(){
  var c=FX2, w=FO.width, h=FO.height;
  c.globalCompositeOperation='source-over'; c.clearRect(0,0,w,h);
  var g=c.createLinearGradient(0,0,w*0.8,h);
  g.addColorStop(0,'#A9ADB3'); g.addColorStop(.15,'#D5D8DC'); g.addColorStop(.32,'#EEF0F2'); g.addColorStop(.46,'#F8F9FA');
  g.addColorStop(.56,'#E9ECEE'); g.addColorStop(.72,'#C9CDD2'); g.addColorStop(.86,'#B7BBC1'); g.addColorStop(1,'#9EA3AA');
  c.fillStyle=g; c.fillRect(0,0,w,h);
  for(var y=0;y<h;y+=3){ var v=150+rnd(y*.37)*60; c.fillStyle='rgba('+v+','+v+','+(v+6)+',.10)'; c.fillRect(0,y,w,2); }
  for(var i=0;i<2600;i++){ c.fillStyle=rnd(i+.5)>.5?'rgba(255,255,255,.22)':'rgba(70,76,86,.12)'; c.fillRect(rnd(i*1.3)*w,rnd(i*2.7)*h,2,2); }
  // 대각 광택
  c.save(); c.globalAlpha=.28;
  for(var j=0;j<5;j++){ var x=j*w/4-120; var sg=c.createLinearGradient(x,0,x+180,0); sg.addColorStop(0,'rgba(255,255,255,0)'); sg.addColorStop(.5,'rgba(255,255,255,.95)'); sg.addColorStop(1,'rgba(255,255,255,0)'); c.fillStyle=sg; c.beginPath(); c.moveTo(x,0); c.lineTo(x+180,0); c.lineTo(x+60,h); c.lineTo(x-120,h); c.closePath(); c.fill(); }
  c.restore();
  // 반복 문양: 별 + SCRATCH
  c.save(); c.fillStyle='rgba(95,102,114,.22)'; c.font='800 '+(26*FS)+'px '+FM; c.textBaseline='middle';
  for(var r=0;r<5;r++) for(var q=0;q<5;q++){ var px=(q*210+(r%2)*105+20)*FS, py=(40+r*72)*FS; c.fillText('LUCKY',px,py); star(c,px-24*FS,py,9*FS,4*FS); c.fill(); }
  c.restore();
  c.globalCompositeOperation='destination-out';
  foilS=0;
}
function eraseTo(s){
  if(s<foilS||foilS<0) drawFoil();
  var c=FX2, step=0.00055;
  for(var a=foilS;a<=s;a+=step){
    var p=pathPt(a); if(!p.on) continue;
    var rr=(BR+(rnd(Math.floor(a/step))-.5)*7)*FS;
    c.beginPath(); c.arc((p.x-SP.x)*FS,(p.y-SP.y)*FS,rr,0,Math.PI*2); c.fill();
  }
  foilS=Math.max(foilS,s);
}
function star(c,x,y,ro,ri){
  c.beginPath();
  for(var i=0;i<10;i++){ var r=i%2?ri:ro, a=-Math.PI/2+i*Math.PI/5; if(i) c.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r); else c.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r); }
  c.closePath();
}
function rr(c,x,y,w,h,r){ c.beginPath(); c.roundRect(x,y,w,h,r); }

/* ---------- camera rig ---------- */
function follow(t){ // 동전 뒤를 늦게 따라가는 초점 (부드러운 추적)
  var a=coinAt(Math.max(TB,t-40))||{x:0,y:0}, b=coinAt(Math.max(TB,t-100))||{x:0,y:0}, d=coinAt(Math.max(TB,t-170))||{x:0,y:0};
  return {x:(a.x+b.x+d.x)/3, y:(a.y+b.y+d.y)/3};
}
var AX=409, AY=20, AZ=.88;  // 여운: 복권이 왼쪽, 결과 카드가 오른쪽
function camAt(t){
  var x,y,z,r=0,sh=0;
  if(t<TB){
    var p=seg(t,0,520);
    z=lerp(.72,1.0,eback(p)); r=lerp(-.11,0,eo(seg(t,0,470)));
    x=lerp(-430,0,eo(p)); y=lerp(-330,0,eo(p));
    sh=t>430?10*Math.exp(-(t-430)/110):0;
  } else if(t<TT){
    var b=eio(seg(t,TB,TB+420)), f=follow(t), p2=seg(t,TB,TT);
    z=lerp(1.0,lerp(1.45,1.62,p2),b);
    x=lerp(0,f.x*.66,b); y=lerp(0,f.y*.72+30,b);
    r=Math.sin(t*.0013)*.006; sh=1.2;
  } else if(t<R){
    var q=seg(t,TT,R), f2=follow(t), cn=coinAt(t);
    z=lerp(1.62,2.55,q*q);
    x=lerp(f2.x*.66,cn.x*.7,eio(q)); y=lerp(f2.y*.72+30,PY,eio(q));
    r=Math.sin(t*.021)*.006*q; sh=1.2+q*7;
  } else if(t<R+HIT){
    var c0=camAt(R-1); return {x:c0.x,y:c0.y,z:c0.z*1.05,r:c0.r};
  } else if(t<R+420){
    var k=seg(t,R+HIT,R+HIT+180);
    z=1.9*lerp(1.15,1,eo(k)); x=0; y=PY;
    r=-.035*Math.exp(-(t-R-HIT)/160)*Math.cos((t-R)*.05);
    sh=14*Math.exp(-(t-R-HIT)/130);
  } else {
    var m=eio(seg(t,R+420,R+1250));
    z=lerp(1.9,AZ,m)+seg(t,R+1250,END)*.03; x=lerp(0,AX,m)+Math.sin(t*.0008)*6; y=lerp(PY,AY,m)+Math.sin(t*.0011)*4;
    r=lerp(0,.018,m);
  }
  var kk=Math.floor(t/16);
  return {x:x+(rnd(kk)-.5)*2*sh/z, y:y+(rnd(kk+977)-.5)*2*sh/z, z:z, r:r};
}
function w2s(cam,wx,wy){
  var dx=(wx-cam.x)*cam.z, dy=(wy-cam.y)*cam.z, c=Math.cos(cam.r), s=Math.sin(cam.r);
  return {x:960+dx*c-dy*s, y:540+dx*s+dy*c};
}

/* ---------- world ---------- */
function drawTable(c,t,cam){
  // 펠트 테이블 + 아웃포커스 보케 (화면 공간, 카메라에 살짝 시차)
  var g=c.createRadialGradient(960,520,80,960,540,1100);
  g.addColorStop(0,'#24364d'); g.addColorStop(.55,'#172437'); g.addColorStop(1,'#0a111c');
  c.fillStyle=g; c.fillRect(0,0,W,H);
  c.save(); c.globalCompositeOperation='lighter';
  for(var i=0;i<26;i++){
    var bx=((rnd(i+3)*2600-cam.x*cam.z*.25)%2400+2400)%2400-240, by=rnd(i+9)*1200-60-cam.y*cam.z*.25;
    var br=40+rnd(i+5)*110*(0.6+cam.z*.35), col=i%3===0?'255,91,23':(i%3===1?'255,198,26':'245,243,239');
    var a=(.05+rnd(i+7)*.09)*(0.7+.3*Math.sin(t*.0015+i));
    var bg=c.createRadialGradient(bx,by,0,bx,by,br); bg.addColorStop(0,'rgba('+col+','+a+')'); bg.addColorStop(.8,'rgba('+col+','+(a*.6)+')'); bg.addColorStop(1,'rgba('+col+',0)');
    c.fillStyle=bg; c.beginPath(); c.arc(bx,by,br,0,Math.PI*2); c.fill();
  }
  c.restore();
}
function drawHalo(c,t){
  if(t<R) return;
  var a=eo(seg(t,R,R+500))*(D.isWin?1:.45), col=D.isWin?D.color:'#9CA3AF';
  c.save(); c.translate(0,PY*.4); c.rotate(tau(t)*.0012);
  c.globalCompositeOperation='lighter';
  for(var i=0;i<18;i++){
    var an=i/18*Math.PI*2, w=.075;
    var gr=c.createRadialGradient(0,0,100,0,0,1500); gr.addColorStop(0,withAlpha(col,.55*a)); gr.addColorStop(1,withAlpha(col,0));
    c.fillStyle=gr; c.beginPath(); c.moveTo(0,0); c.arc(0,0,1500,an-w,an+w); c.closePath(); c.fill();
  }
  var gl=c.createRadialGradient(0,0,0,0,0,760); gl.addColorStop(0,'rgba(255,236,190,'+(.5*a)+')'); gl.addColorStop(1,'rgba(255,160,60,0)');
  c.fillStyle=gl; c.beginPath(); c.arc(0,0,760,0,Math.PI*2); c.fill();
  c.restore();
}
function drawTicket(c,t){
  // 그림자
  c.save(); c.fillStyle='rgba(3,7,14,.5)'; rr(c,TK.x+26,TK.y+34,TK.w,TK.h,44); c.fill(); c.restore();
  // 남색 외곽 → 주황 프레임 → 남색 안쪽
  c.fillStyle=NAVY; rr(c,TK.x-10,TK.y-10,TK.w+20,TK.h+20,52); c.fill();
  c.fillStyle=OR; rr(c,TK.x,TK.y,TK.w,TK.h,44); c.fill();
  c.fillStyle=NAVY; rr(c,TK.x+26,TK.y+26,TK.w-52,TK.h-52,30); c.fill();
  // 리벳
  [[TK.x+20,TK.y+20],[TK.x+TK.w-20,TK.y+20],[TK.x+20,TK.y+TK.h-20],[TK.x+TK.w-20,TK.y+TK.h-20]].forEach(function(p){
    var g=c.createRadialGradient(p[0]-4,p[1]-4,1,p[0],p[1],15); g.addColorStop(0,'#FFE27A'); g.addColorStop(.6,YEL); g.addColorStop(1,'#E0A800');
    c.fillStyle=g; c.beginPath(); c.arc(p[0],p[1],14,0,Math.PI*2); c.fill(); c.strokeStyle=NAVY; c.lineWidth=4; c.stroke();
  });
  // 헤더 선버스트
  c.save(); rr(c,TK.x+26,TK.y+26,TK.w-52,250,30); c.clip();
  c.translate(0,TK.y+290); c.rotate(t*.00012);
  c.fillStyle='rgba(255,255,255,.07)';
  for(var i=0;i<20;i++){ var a=i/20*Math.PI*2; c.beginPath(); c.moveTo(0,0); c.arc(0,0,900,a,a+Math.PI/20); c.closePath(); c.fill(); }
  c.restore();
  // 반짝이
  for(var j=0;j<8;j++){
    var sx=(j<4?-1:1)*(300+rnd(j)*140), sy=TK.y+70+rnd(j+4)*130, sc=.6+.6*Math.abs(Math.sin(t*.004+j*1.7));
    c.fillStyle=j%3===0?MINT:(j%3===1?OR:CR); star(c,sx,sy,13*sc,5*sc); c.fill();
  }
  // 제목
  c.save(); c.textBaseline='middle'; c.textAlign='center'; c.font='138px '+FT; c.lineJoin='round';
  c.strokeStyle=NAVY; c.lineWidth=18;
  c.strokeText('행운복권',0,TK.y+150);
  c.fillStyle=NAVY; c.fillText('행운복권',6,TK.y+158);
  c.textAlign='right'; c.fillStyle=YEL; c.fillText('행운',0,TK.y+150);
  c.textAlign='left'; c.fillStyle=CR; c.fillText('복권',0,TK.y+150);
  c.textAlign='center'; c.font='800 24px '+FM; c.fillStyle=MINT;
  c.fillText('No.'+D.no+'  ·  '+D.nick+'님의 복권',0,TK.y+232);
  c.restore();
  star(c,-330,TK.y+150,30,13); c.fillStyle=YEL; c.fill(); c.strokeStyle=OR; c.lineWidth=5; c.stroke();
  star(c,330,TK.y+150,30,13); c.fill(); c.stroke();
  // 은박 패널: 주황 테두리 + 크림 바탕 + 상품 글자
  c.fillStyle=OR; rr(c,SP.x-10,SP.y-10,SP.w+20,SP.h+20,22); c.fill();
  c.save(); rr(c,SP.x,SP.y,SP.w,SP.h,14); c.clip();
  c.fillStyle=CR; c.fillRect(SP.x,SP.y,SP.w,SP.h);
  var pg=c.createRadialGradient(0,PY,20,0,PY,520); pg.addColorStop(0,'rgba(255,255,255,.85)'); pg.addColorStop(1,'rgba(255,255,255,0)');
  c.fillStyle=pg; c.fillRect(SP.x,SP.y,SP.w,SP.h);
  c.fillStyle='rgba(255,91,23,.16)';
  star(c,SP.x+70,SP.y+290,44,19); c.fill(); star(c,SP.x+150,SP.y+320,20,9); c.fill();
  star(c,SP.x+SP.w-70,SP.y+290,44,19); c.fill(); star(c,SP.x+SP.w-150,SP.y+320,20,9); c.fill();
  // 상품
  var pop=t>=R?1+.16*Math.exp(-(t-R)/140)*(t>=R+HIT?1:0):1;
  c.save(); c.translate(0,PY); c.scale(pop,pop);
  c.font='128px '+FT; c.textAlign='center'; c.textBaseline='middle';
  var mw=c.measureText(D.prize).width, fit=Math.min(1,(SP.w-80)/Math.max(1,mw)); c.scale(fit,fit);
  c.fillStyle=withAlpha(NAVY,.9); c.fillText(D.prize,6,8);
  c.fillStyle=D.color; c.fillText(D.prize,0,0);
  if(t>=R && D.isWin){ // 광택 스윕
    var sx2=((tau(t)-R)*1.6%900)-450;
    c.globalCompositeOperation='source-atop';
    var sg=c.createLinearGradient(sx2-90,0,sx2+90,0); sg.addColorStop(0,'rgba(255,255,255,0)'); sg.addColorStop(.5,'rgba(255,255,255,.75)'); sg.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=sg; c.fillRect(-mw,-90,mw*2,180);
    c.globalCompositeOperation='source-over';
  }
  c.restore();
  // 은박
  if(t<R+HIT){ eraseTo(prog(Math.min(t,R))); c.drawImage(FO,SP.x,SP.y,SP.w,SP.h); }
  c.restore();
  c.strokeStyle=NAVY; c.lineWidth=4; rr(c,SP.x-10,SP.y-10,SP.w+20,SP.h+20,22); c.stroke();
}
function drawShavings(c,t){
  if(t<TB||t>=R+HIT) return;
  var s=prog(t);
  for(var i=0;i<60;i++){
    var dt=i*9;                       // 최근 540ms 동안 떨어진 은박 가루
    var tp=t-dt; if(tp<TB) break;
    var p=pathPt(prog(tp)); if(!p.on) continue;
    var a=1-dt/540, dir=(p.k%2===0)?-1:1;
    var x=p.x+dir*(20+dt*.18)+(rnd(i+tp*.01)-.5)*40, y=p.y+(rnd(i*3+1)-.5)*50+dt*.12;
    c.save(); c.translate(x,y); c.rotate(rnd(i*7)*6+dt*.02);
    c.fillStyle='rgba(206,211,217,'+(a*.95)+')'; c.fillRect(-5,-3,10+rnd(i)*6,6);
    c.fillStyle='rgba(255,255,255,'+(a*.8)+')'; c.fillRect(-5,-3,6,2);
    c.restore();
  }
  void s;
}
function drawCoin(c,t){
  var p=coinAt(t); if(!p) return;
  var lift=p.lift||0, R0=62;
  c.save(); c.fillStyle='rgba(3,7,14,'+(.4-lift*.2)+')';
  c.beginPath(); c.ellipse(p.x+22+lift*50,p.y+30+lift*70,R0*1.05,R0*.62,0,0,Math.PI*2); c.fill(); c.restore();
  c.save(); c.translate(p.x+R0*.55,p.y-R0*.4-lift*40); c.rotate(p.rot||0); c.scale(1+lift*.15,1+lift*.15);
  // 가장자리 두께
  c.fillStyle='#B07800'; c.beginPath(); c.ellipse(0,10,R0,R0*.8,0,0,Math.PI*2); c.fill();
  var g=c.createLinearGradient(-R0,-R0,R0,R0); g.addColorStop(0,'#FFF0A8'); g.addColorStop(.35,'#FFD23A'); g.addColorStop(.7,'#F2A900'); g.addColorStop(1,'#C98600');
  c.fillStyle=g; c.beginPath(); c.ellipse(0,0,R0,R0*.8,0,0,Math.PI*2); c.fill();
  c.strokeStyle=NAVY; c.lineWidth=5; c.stroke();
  c.strokeStyle='rgba(150,95,0,.7)'; c.lineWidth=3; c.beginPath(); c.ellipse(0,0,R0*.78,R0*.62,0,0,Math.PI*2); c.stroke();
  c.save(); c.scale(1,.8); star(c,0,0,R0*.48,R0*.2); c.fillStyle='#E39A00'; c.fill(); c.strokeStyle='rgba(120,70,0,.6)'; c.lineWidth=3; c.stroke(); c.restore();
  c.strokeStyle='rgba(255,255,255,.85)'; c.lineWidth=6; c.lineCap='round';
  c.beginPath(); c.ellipse(0,0,R0*.86,R0*.68,0,Math.PI*1.1,Math.PI*1.45); c.stroke();
  c.restore();
}
function drawWorld(c,t,cam){
  c.save();
  c.translate(960,540); c.rotate(cam.r); c.scale(cam.z,cam.z); c.translate(-cam.x,-cam.y);
  // 등장: 복권이 오른쪽 아래에서 밀려 들어옴 (카메라 + 기울기)
  var ip=eo(seg(t,0,480));
  c.save(); c.translate(lerp(380,0,ip),lerp(520,0,ip)); c.rotate(lerp(.16,0,eback(seg(t,0,520))));
  drawHalo(c,t);
  drawTicket(c,t);
  drawShavings(c,t);
  drawCoin(c,t);
  c.restore();
  c.restore();
}

/* ---------- screen fx ---------- */
function rays(c,x,y,n,r0,r1,alpha,col1,col2,rot){
  c.save(); c.translate(x,y); c.rotate(rot||0); c.globalAlpha=alpha;
  for(var i=0;i<n;i++){ var a=i/n*Math.PI*2+rnd(i)*.08; c.fillStyle=i%2?col1:col2;
    c.beginPath(); c.moveTo(Math.cos(a-.025)*r0,Math.sin(a-.025)*r0); c.lineTo(Math.cos(a)*r1,Math.sin(a)*r1); c.lineTo(Math.cos(a+.035)*r0,Math.sin(a+.035)*r0); c.fill(); }
  c.restore();
}
function flakes(c,t,cx,cy){ // 공개 순간 남은 은박이 사방으로 튀어 나감 (여운에선 슬로모)
  if(t<R+HIT) return;
  var dt=(tau(t)-R-HIT*.25)/1000; if(dt<0) return;
  for(var i=0;i<90;i++){
    var a=rnd(i+40)*Math.PI*2, sp=700+rnd(i+41)*1500, g=900;
    var x=cx+Math.cos(a)*(40+sp*dt), y=cy+Math.sin(a)*(30+sp*dt)*.75+.5*g*dt*dt;
    if(x<-60||x>W+60||y>H+60) continue;
    var s=8+rnd(i+42)*18, al=1-cl(dt/1.6);
    if(al<=0) continue;
    c.save(); c.translate(x,y); c.rotate(rnd(i+43)*6+dt*(6+rnd(i+44)*10)); c.scale(1,Math.cos(dt*(8+rnd(i)*8)));
    c.fillStyle='rgba(214,218,224,'+al+')'; c.fillRect(-s,-s*.5,s*2,s);
    c.fillStyle='rgba(255,255,255,'+al+')'; c.fillRect(-s,-s*.5,s*1.2,s*.3);
    c.restore();
  }
}
function screenFX(c,t,cam){
  var cn=coinAt(t), cs=cn?w2s(cam,cn.x,cn.y):{x:960,y:540};
  var ps=w2s(cam,0,PY);
  // 기본 렌즈 비네트
  var g=c.createRadialGradient(960,540,430,960,540,1080);
  g.addColorStop(0,'rgba(0,6,14,0)'); g.addColorStop(1,'rgba(0,6,14,.66)');
  c.fillStyle=g; c.fillRect(0,0,W,H);
  // 진행: 동전 주변 초점 링 (얕은 심도 느낌)
  if(t>=TB && t<R){
    var ten=seg(t,TT,R);
    var dg=c.createRadialGradient(cs.x,cs.y,lerp(380,200,ten),cs.x,cs.y,lerp(1100,760,ten));
    dg.addColorStop(0,'rgba(4,8,16,0)'); dg.addColorStop(1,'rgba(4,8,16,'+(.28+ten*.45)+')');
    c.fillStyle=dg; c.fillRect(0,0,W,H);
    if(ten>0){ // 수렴하는 줌선
      c.save(); c.translate(ps.x,ps.y);
      for(var i=0;i<44;i++){ var a=rnd(i+400)*Math.PI*2, r0=420+rnd(i+401)*220+((t*.3)%70), r1=r0+300+rnd(i+402)*380;
        c.strokeStyle='rgba(245,243,239,'+(ten*.2)+')'; c.lineWidth=2+rnd(i+403)*4;
        c.beginPath(); c.moveTo(Math.cos(a)*r0,Math.sin(a)*r0); c.lineTo(Math.cos(a)*r1,Math.sin(a)*r1); c.stroke(); }
      c.restore();
    }
    // 레터박스
    var hb=92*eo(seg(t,TT,TT+380));
    c.fillStyle='#04070c'; c.fillRect(0,P.y,W,hb); c.fillRect(0,P.y+P.h-hb,W,hb);
  }
  if(t>=R && t<R+HIT){ var c0=camAt(R-1); var hb2=92; c.fillStyle='#04070c'; c.fillRect(0,P.y,W,hb2); c.fillRect(0,P.y+P.h-hb2,W,hb2); void c0; }
  // 공개: 히트스톱 플래시 + 스타버스트
  if(t>=R && t<R+700){
    if(t<R+HIT){
      c.fillStyle='rgba(255,250,240,.9)'; c.fillRect(0,0,W,H);
      rays(c,ps.x,ps.y,44,120,1400,1,OR,NAVY,0);
    } else {
      var fl=Math.pow(1-seg(t,R+HIT,R+420),2);
      rays(c,ps.x,ps.y,44,200,1500,fl*.85,D.isWin?D.color:'#9CA3AF',NAVY,(t-R)*.0006);
      c.fillStyle='rgba(255,250,240,'+(.55*fl)+')'; c.fillRect(0,0,W,H);
    }
  }
  flakes(c,t,ps.x,ps.y);
  // 그레인
  var k=Math.floor(t/42);
  for(var j=0;j<240;j++){ c.fillStyle=rnd(k*31+j)>.5?'rgba(255,255,255,.06)':'rgba(0,0,0,.08)'; c.fillRect(P.x+rnd(k*17+j)*P.w,P.y+rnd(k*13+j+5)*P.h,2,2); }
}

/* ---------- HUD: 매크로 렌즈 ---------- */
function panelPath(c,x,y,w,h,k){ c.beginPath(); c.moveTo(x+k,y); c.lineTo(x+w,y); c.lineTo(x+w,y+h-k); c.lineTo(x+w-k,y+h); c.lineTo(x,y+h); c.lineTo(x,y+k); c.closePath(); }
var PH=[
  {n:'01',ko:'등장',en:'OPEN'},
  {n:'02',ko:'긁기',en:'SCRATCH',sub:'동전이 은박을 벗겨 낸다 — 사각, 사각'},
  {n:'03',ko:'두근두근',en:'FOCUS',sub:'마지막 한 줄… 글자가 보이기 시작한다'},
  {n:'04',ko:'공개',en:'REVEAL'},
  {n:'05',ko:'결과',en:'RESULT'}
];
function phTimes(){ return [[0,TB],[TB,TT],[TT,R],[R,R+700],[R+700,END]]; }
function phaseIdx(t){ var p=phTimes(); for(var i=4;i>=0;i--) if(t>=p[i][0]) return i; return 0; }
function hud(c,t,cam,py,ph){
  c.save();
  panelPath(c,P.x,py,P.w,ph,P.k); c.strokeStyle='rgba(245,243,239,.55)'; c.lineWidth=3; c.stroke();
  var L=70; c.strokeStyle=OR; c.lineWidth=9; c.lineCap='square';
  var y0=py, y1=py+ph;
  c.beginPath(); c.moveTo(P.x+P.w-L,y0-10); c.lineTo(P.x+P.w+10,y0-10); c.lineTo(P.x+P.w+10,y0+L); c.stroke();
  c.beginPath(); c.moveTo(P.x-10,y1-L); c.lineTo(P.x-10,y1+10); c.lineTo(P.x+L,y1+10); c.stroke();
  c.beginPath(); c.moveTo(P.x-10,y0+P.k+L); c.lineTo(P.x-10,y0+P.k-6); c.lineTo(P.x+P.k-6,y0-10); c.lineTo(P.x+P.k+L,y0-10); c.stroke();
  c.restore();
  if(ph<P.h*.98) return;
  var idx=phaseIdx(t), pt=phTimes();
  c.save(); c.textBaseline='middle';
  // 좌상단: 렌즈 장치
  var locked=t>=TT && t<R+700, af=locked?(Math.floor(t/330)%2===0):true;
  c.fillStyle=locked?(af?MINT:'rgba(0,203,132,.3)'):CR;
  c.beginPath(); c.arc(P.x+92,P.y+52,11,0,Math.PI*2); c.fill();
  c.font='800 26px '+FM; c.fillStyle=CR;
  c.fillText(locked?'AF-LOCK':'AF-C',P.x+112,P.y+53);
  c.fillStyle='rgba(245,243,239,.8)'; c.font='600 24px '+FM;
  c.fillText('MACRO 100mm  ×'+(cam.z*1.5).toFixed(2),P.x+250,P.y+53);
  c.fillStyle=MINT; c.font='700 20px '+FM;
  c.fillText('LENS-CAM 03 · 복권 클로즈업',P.x+92,P.y+86);
  if(t>=R+420 && Math.floor(t/380)%2===0){ c.fillStyle=OR; c.font='800 24px '+FM; c.fillText('▶ SLOW ×0.25',P.x+92,P.y+118); }
  // 단계 칩
  var pw=150, gap=10, total=5*pw+4*gap, sx=960-total/2+150;
  for(var i=0;i<5;i++){
    var x=sx+i*(pw+gap), y=P.y+34, act=i===idx, done=i<idx;
    c.fillStyle=act?OR:done?'rgba(245,243,239,.85)':'rgba(10,18,28,.55)'; c.fillRect(x,y,pw,40);
    if(!act&&!done){ c.strokeStyle='rgba(245,243,239,.45)'; c.lineWidth=2; c.strokeRect(x+1,y+1,pw-2,38); }
    if(act){ c.fillStyle='rgba(23,36,55,.35)'; c.fillRect(x,y+34,pw*seg(t,pt[i][0],pt[i][1]),6); }
    c.fillStyle=act?CR:done?NAVY:'rgba(245,243,239,.7)'; c.font='700 22px '+FK; c.textAlign='center';
    c.fillText(PH[i].n+' '+PH[i].ko,x+pw/2,y+21);
  }
  c.textAlign='left';
  // 오른쪽: 초점 거리 눈금 (줌에 따라 흐름)
  var rx=P.x+P.w-60, rTop=P.y+170, rBot=P.y+P.h-200, mid=(rTop+rBot)/2;
  c.save(); c.beginPath(); c.rect(rx-140,rTop,160,rBot-rTop); c.clip();
  c.strokeStyle='rgba(245,243,239,.7)'; c.fillStyle='rgba(245,243,239,.75)'; c.font='600 18px '+FM; c.textAlign='right';
  var fd=60-cam.z*18;
  for(var m=0;m<=80;m+=2){ var yy=mid+(m-fd)*14; if(yy<rTop-10||yy>rBot+10) continue; var big=m%10===0; c.lineWidth=big?3:2;
    c.beginPath(); c.moveTo(rx,yy); c.lineTo(rx-(big?28:14),yy); c.stroke(); if(big) c.fillText(m+'cm',rx-36,yy); }
  c.restore();
  c.fillStyle=OR; c.beginPath(); c.moveTo(rx+4,mid); c.lineTo(rx+22,mid-12); c.lineTo(rx+22,mid+12); c.fill();
  // 우하단: 노출값
  c.fillStyle='rgba(245,243,239,.72)'; c.font='700 22px '+FM; c.textAlign='right';
  c.fillText('f/2.8   1/500   ISO 200',P.x+P.w-60,P.y+P.h-48);
  c.textAlign='left';
  c.restore();
  // 초점 브래킷: 동전 따라다니다가 긴장 구간엔 상품 글자로 조여 듦
  if(t>=TB && t<R){
    var cn=coinAt(t), cs=w2s(cam,cn.x,cn.y), ps=w2s(cam,0,PY), q=eio(seg(t,TT,TT+500));
    var fx=lerp(cs.x,ps.x,q), fy=lerp(cs.y,ps.y,q), bw=lerp(170,520,q)+Math.sin(t*.02)*6*q, bh=lerp(130,170,q);
    c.save(); c.strokeStyle=q>.5?OR:CR; c.lineWidth=q>.5?6:4; var Lb=34;
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(s){ var x0=fx+s[0]*bw/2, y0=fy+s[1]*bh/2;
      c.beginPath(); c.moveTo(x0-s[0]*Lb,y0); c.lineTo(x0,y0); c.lineTo(x0,y0-s[1]*Lb); c.stroke(); });
    c.beginPath(); c.moveTo(fx-14,fy); c.lineTo(fx+14,fy); c.moveTo(fx,fy-14); c.lineTo(fx,fy+14); c.lineWidth=3; c.stroke();
    c.restore();
  }
}

/* ---------- typography ---------- */
function outlinedText(c,txt,x,y,fill,stroke,sw,outer,ow){
  c.lineJoin='round';
  if(outer){ c.strokeStyle=outer; c.lineWidth=ow; c.strokeText(txt,x,y); }
  c.strokeStyle=stroke; c.lineWidth=sw; c.strokeText(txt,x,y);
  c.fillStyle=fill; c.fillText(txt,x,y);
}
function chapter(c,t,i){
  var ph=PH[i]; if(!ph.sub) return;
  var pt=phTimes()[i];
  var inn=eo(seg(t,pt[0],pt[0]+340)), out=seg(t,pt[1]-60,pt[1]);
  if(inn<=0||out>=1) return;
  var x=P.x-30, y=P.y+P.h-232;
  c.save(); c.textBaseline='middle';
  c.font='96px '+FT; var tw=c.measureText(ph.ko).width;
  var bw=(tw+80)*inn*(1-ei(out)), nd=(1-eback(cl(inn)))*-140;
  c.fillStyle=OR; c.fillRect(x,y+nd,140,140);
  c.fillStyle=NAVY; c.font='86px '+FT; c.fillText(ph.n,x+16,y+76+nd);
  c.save(); c.beginPath(); c.rect(x+140,y,bw,140); c.clip();
  c.fillStyle=i===2?'#2a0f0a':NAVY; c.fillRect(x+140,y,tw+80,140);
  var jx=i===2?(rnd(Math.floor(t/30))-.5)*8:0;
  c.font='96px '+FT; c.fillStyle=CR; c.fillText(ph.ko,x+180+jx,y+76);
  c.restore();
  c.globalAlpha=inn*(1-out);
  c.fillStyle=CR; c.font='800 22px '+FM; c.fillText('CH.'+ph.n+' / '+ph.en,x+4,y-22);
  c.font='700 34px '+FK; c.lineWidth=8; c.strokeStyle='rgba(4,10,18,.85)'; c.lineJoin='round';
  c.strokeText(ph.sub,x+20,y+180); c.fillStyle=CR; c.fillText(ph.sub,x+20,y+180);
  c.restore();
}
function openTitle(c,t){ // 등장: 이름표가 위에서 떨어짐
  if(t<120||t>TB+260) return;
  var p=eback(seg(t,120,420)), out=seg(t,TB,TB+260);
  var sp=eback(seg(t,260,520));
  c.save(); c.globalAlpha=1-out; c.translate(960,190+(1-p)*-200-out*60); c.rotate(lerp(-.2,-.05,p));
  c.textAlign='center'; c.textBaseline='middle'; c.font='120px '+FT;
  outlinedText(c,'복권 도착!',0,0,YEL,NAVY,20,CR,32);
  c.restore();
  if(sp>0){ // 닉네임 띠: 이름표 아래, 화면 아래쪽에서 사선으로 밀려 들어옴
    c.save(); c.globalAlpha=1-out; c.translate(lerp(-700,0,sp)+960,860); c.transform(1,0,-.14,1,0,0);
    c.font='800 40px '+FK; c.textAlign='center'; c.textBaseline='middle';
    var s=D.nick+'님이 긁습니다'; var tw=Math.min(900,c.measureText(s).width);
    c.fillStyle=NAVY; c.fillRect(-tw/2-46,-38,tw+92,76); c.fillStyle=OR; c.fillRect(-tw/2-46,-38,14,76);
    c.fillStyle=CR; c.fillText(s,0,2,900);
    c.restore();
  }
}
function slam(c,t){ // 공개: 대형 타이포 슬램
  if(t<R+HIT||t>R+1400) return;
  var p=seg(t,R+HIT,R+HIT+220), s=lerp(1.9,1,eback(p)), rot=lerp(-.105,-.05,eo(p));
  var a=1-seg(t,R+1150,R+1400), up=seg(t,R+1150,R+1400)*-80;
  var word=D.big?'대박!!':D.isWin?'당첨!':'꽝!', col=D.isWin?D.color:'#9CA3AF';
  c.save(); c.globalAlpha=a; c.translate(D.isWin?560:600,246+up); c.rotate(rot);
  // 스타버스트
  c.save(); c.rotate(t*.0015); c.scale(s*.7,s*.7);
  c.fillStyle=D.isWin?CR:'#D9DCE1'; c.beginPath();
  for(var i=0;i<32;i++){ var r=i%2?190:290+rnd(i)*60, an=i/32*Math.PI*2; if(i) c.lineTo(Math.cos(an)*r,Math.sin(an)*r); else c.moveTo(Math.cos(an)*r,Math.sin(an)*r); }
  c.closePath(); c.fill(); c.strokeStyle=NAVY; c.lineWidth=8; c.stroke();
  c.restore();
  c.scale(s,s); c.textAlign='center'; c.textBaseline='middle'; c.font='230px '+FT;
  c.fillStyle=col; c.fillText(word,10,12);           // 등급색 그림자 (오프셋 8+)
  outlinedText(c,word,0,0,D.isWin?OR:NAVY,NAVY,22,null,0);
  if(!D.isWin){ c.fillStyle=CR; c.fillText(word,0,0); c.lineWidth=10; c.strokeStyle=NAVY; c.strokeText(word,0,0); }
  c.font='800 38px '+FM; c.fillStyle=NAVY; c.fillText(D.big?'JACKPOT':D.isWin?'WINNER':'NEXT TIME',0,150);
  c.restore();
}
function balloonIcon(c,x,y,r){
  c.save(); c.translate(x,y);
  c.fillStyle=CR; c.beginPath(); c.arc(0,0,r,0,Math.PI*2); c.fill();
  star(c,0,0,r*.78,r*.38); c.fillStyle=OR; c.fill(); c.restore();
}
function giftText(){
  if(D.prizeGift) return D.prizeGift+' 획득';
  if(D.paid>0) return '응모 별풍선 '+Number(D.paid).toLocaleString()+'개';
  return D.detail||(D.isWin?'당첨 축하해요!':'다음 기회에!');
}
function resultCard(c,t){
  if(t<R+520) return;
  var x0=1130, y0=210, w=690, h=670;
  var inP=seg(t,R+520,R+900), ox=(1-eback(inP))*900;
  c.save(); c.translate(ox,0);
  if(inP<1){ c.fillStyle='rgba(245,243,239,'+(.6*(1-inP))+')'; for(var i=0;i<8;i++) c.fillRect(x0+w+20+rnd(i)*200,y0+40+i*80,300+rnd(i+3)*300,6); }
  c.transform(1,0,-.14,1,0,0); c.translate(y0*.14+60,0);   // skewX(-8°)
  c.fillStyle='rgba(0,0,0,.45)'; c.fillRect(x0+18,y0+22,w,h);
  c.fillStyle=CR; c.fillRect(x0,y0,w,h);
  c.fillStyle=OR; c.fillRect(x0,y0,18,h);
  c.fillStyle=NAVY; c.fillRect(x0+18,y0,w-18,96);
  c.textBaseline='middle';
  c.fillStyle=OR; c.font='68px '+FT; c.fillText(D.big?'JACKPOT!':D.isWin?'당첨!':'결과!',x0+50,y0+52);
  c.fillStyle='rgba(245,243,239,.75)'; c.font='700 20px '+FM; c.textAlign='right'; c.fillText('TICKET #'+D.no,x0+w-36,y0+52); c.textAlign='left';
  // 1) 상품 이름
  var np=seg(t,R+780,R+1020), ns=lerp(1.9,1,eback(np));
  if(np>0){
    c.save(); c.globalAlpha=Math.min(1,np*3); c.translate(x0+50,y0+222); c.scale(ns,ns);
    c.font='150px '+FT; var mw=c.measureText(D.prize).width, fit=Math.min(1,(w-300)/Math.max(1,mw)); c.scale(fit,fit);
    c.fillStyle=D.isWin?D.color:'#B8BEC7'; c.fillText(D.prize,8,10);
    c.fillStyle=NAVY; c.fillText(D.prize,0,0); c.restore();
  }
  var gt=giftText();
  if(D.detail && gt!==D.detail){
    var dp=seg(t,R+960,R+1160); c.globalAlpha=dp; c.fillStyle=NAVY; c.font='800 32px '+FK;
    var dw=c.measureText(D.detail).width; if(dw>w-110) c.font='800 '+Math.max(18,Math.floor(32*(w-110)/dw))+'px '+FK;
    c.fillText(D.detail,x0+56,y0+346); c.globalAlpha=1;
  }
  c.strokeStyle='rgba(23,36,55,.25)'; c.lineWidth=3; c.setLineDash([10,10]);
  c.beginPath(); c.moveTo(x0+50,y0+396); c.lineTo(x0+w-40,y0+396); c.stroke(); c.setLineDash([]);
  // 3) 닉네임
  var cp=eo(seg(t,R+1300,R+1600));
  c.save(); c.globalAlpha=cp; c.translate((1-cp)*80,0);
  c.fillStyle='rgba(23,36,55,.6)'; c.font='700 28px '+FK; c.fillText('긁은 사람',x0+56,y0+436);
  c.fillStyle=NAVY; c.font='900 84px '+FK; var nw=c.measureText(D.nick).width; if(nw>w-110) c.font='900 '+Math.max(40,Math.floor(84*(w-110)/nw))+'px '+FK;
  c.fillText(D.nick,x0+52,y0+498);
  c.restore();
  // 4) 별풍선
  var gp=seg(t,R+1560,R+1820), gs=lerp(.4,1,eback(gp));
  if(gp>0){
    c.save(); c.translate(x0+56,y0+604); c.scale(gs,gs); c.globalAlpha=Math.min(1,gp*2);
    c.font='900 42px '+FK; var tw=c.measureText(gt).width, pw=Math.min(w-110,tw+120), f2=Math.min(1,(pw-120)/Math.max(1,tw));
    c.fillStyle=D.isWin?OR:GREY; c.beginPath(); c.roundRect(0,-40,pw,80,40); c.fill();
    balloonIcon(c,42,0,28);
    c.save(); c.translate(86,2); c.scale(f2,1); c.fillStyle=CR; c.fillText(gt,0,0); c.restore();
    c.restore();
  }
  // 2) 도장
  var bp=seg(t,R+1060,R+1300);
  if(bp>0){
    var bs=lerp(3,1,eback(bp)), sc=D.big?OR:D.isWin?MINT:GREY;
    c.save(); c.translate(x0+w-90,y0+250); c.rotate(-.2); c.scale(bs,bs); c.globalAlpha=Math.min(1,bp*2.5);
    if(bp<1){ c.strokeStyle=sc; c.lineWidth=6; for(var j=0;j<12;j++){ var a=j/12*Math.PI*2; c.beginPath(); c.moveTo(Math.cos(a)*120,Math.sin(a)*120); c.lineTo(Math.cos(a)*(140+bp*60),Math.sin(a)*(140+bp*60)); c.stroke(); } }
    c.fillStyle=NAVY; c.beginPath(); c.arc(6,8,104,0,Math.PI*2); c.fill();
    c.fillStyle=sc; c.beginPath(); c.arc(0,0,104,0,Math.PI*2); c.fill();
    c.strokeStyle=CR; c.lineWidth=5; c.beginPath(); c.arc(0,0,89,0,Math.PI*2); c.stroke();
    c.textAlign='center'; c.fillStyle=CR; c.font='80px '+FT; c.fillText(D.big?'대박':D.isWin?'당첨':'꽝',0,-4);
    c.font='800 18px '+FM; c.fillText(D.big?'JACKPOT':D.isWin?'WINNER':'NEXT TIME',0,54);
    c.restore();
  }
  c.restore();
}

/* ---------- render ---------- */
function render(t){
  X.setTransform(1,0,0,1,0,0); X.clearRect(0,0,W,H);
  if(t>=END+420) return;
  X.save(); X.globalAlpha=1-seg(t,END,END+400);
  var wt=(t>=R&&t<R+HIT)?R-1:t;          // 히트스톱: 월드 정지
  var cam=camAt(t);
  var rv=eo(seg(t,0,420)), ph=Math.max(4,P.h*rv), py=P.y+(P.h-ph)/2;
  X.save(); X.shadowColor='rgba(0,0,0,.55)'; X.shadowBlur=50; X.shadowOffsetY=14;
  panelPath(X,P.x,py,P.w,ph,P.k); X.fillStyle='#0a111c'; X.fill(); X.restore();
  X.save(); panelPath(X,P.x,py,P.w,ph,P.k); X.clip();
  drawTable(X,wt,cam);
  drawWorld(X,wt,cam);
  screenFX(X,t,cam);
  X.restore();
  hud(X,t,cam,py,ph);
  openTitle(X,t);
  if(rv>=1){ chapter(X,t,phaseIdx(t)); slam(X,t); resultCard(X,t); }
  X.restore();
}

var start=0, playing=false, paused=false, cues={}, lastScr=0;
function cue(t){
  if(!window.FX) return;
  function at(k,ms,fn){ if(t>=ms && !cues[k]){ cues[k]=1; fn(); } }
  at('open',0,function(){ FX.hideWinner(); FX.sound('whoosh'); });
  at('land',460,function(){ FX.sound('pop'); });
  // 진행: 긁는 소리 (긴장 구간엔 간격이 벌어지며 느려짐)
  if(t>=TB && t<R){ var gap=t<TT?0:lerp(60,200,seg(t,TT,R)); var c0=coinAt(t); if(c0&&c0.on&&t-lastScr>=gap){ lastScr=t; FX.scratch(); } }
  at('tense',TT,function(){ FX.drumStart(140); });
  at('hit',R,function(){ FX.drumStop(); FX.sound('stop'); FX.flash(D.isWin?withAlpha(D.color,.5):'rgba(255,255,255,.55)'); });
  at('res',R+300,function(){
    if(D.isWin){ FX.sound('win'); if(D.big){ FX.sound('jackpot'); FX.confetti({count:200,x:600,y:300}); } else FX.confetti({count:90,x:600,y:320}); }
    else FX.sound('lose');
  });
  at('stamp',R+1060,function(){ FX.sound('stop'); });
  at('banner',R+1500,function(){ FX.winner({nick:D.nick,text:D.prize,sub:D.isWin?'복권 당첨':'복권 결과',anchor:ANC,ms:3200}); });
}
function loop(now){
  if(playing && !paused){
    var t=now-start; cue(t); render(t);
    if(t>END+500){ playing=false; X.setTransform(1,0,0,1,0,0); X.clearRect(0,0,W,H); if(window.FX) FX.drumStop(); }
  }
  requestAnimationFrame(loop);
}
/** 타임라인 위치(ms)를 정지 화면으로 그린다 (미리보기·캡처용) */
window.seek=function(ms){ paused=true; render(ms); };
window.TL=function(){ return {TB:TB,TT:TT,R:R,END:END,HIT:HIT}; };
/** 진행 중인 판 멈추고 화면 비움 */
window.stopLottery=function(){ playing=false; X.setTransform(1,0,0,1,0,0); X.clearRect(0,0,W,H); if(window.FX){ FX.drumStop(); FX.hideWinner(); } };
/** ls: 엔진 LotteryPickState { prize, color, detail, triggeredBy, scratchMs, isWin } */
window.runLottery=function(ls){
  var prize=String(ls.prize==null?'':ls.prize);
  var isWin=ls.isWin!==undefined?!!ls.isWin:prize!=='꽝';
  var mg=/별풍선 *([0-9,]+) *개/.exec(prize);
  var no=1; try{ no=(Number(localStorage.getItem('lotteryNo'))||0)+1; localStorage.setItem('lotteryNo',String(no)); }catch(e){ no=1+Math.floor(Math.random()*900); }
  D={ prize:prize||'?', color:ls.color||YEL, detail:String(ls.detail||''),
    nick:ls.triggeredBy&&ls.triggeredBy!=='weflab'?String(ls.triggeredBy):'스트리머',
    isWin:isWin, big:isWin&&/200개|500개|대박|초대박/.test(prize),
    prizeGift:mg?('별풍선 '+mg[1]+'개'):'', paid:0, no:String(no).padStart(3,'0') };
  setTimes(ls.scratchMs!=null?ls.scratchMs:3000);
  if(window.FX){ FX.drumStop(); FX.hideWinner(); }
  foilS=-1; cues={}; lastScr=0; paused=false; playing=true; start=performance.now();
};
window.setLotteryBalloon=function(b){ D.paid=Number(b)||0; };
if(document.fonts&&document.fonts.load){
  Promise.all([document.fonts.load('100px '+FT),document.fonts.load('900 40px '+FK),document.fonts.load('700 40px '+FK),document.fonts.load('800 20px '+FM)]).catch(function(){});
}
requestAnimationFrame(loop);
})();
<\/script>
<script>
var lastStatus=null
function onState(s){
  // 같은 판의 running 이 다시 와도(대기열 수 변경) 무시. running 이 아니던 상태 뒤의 running = 새 판 → 이전 판 취소하고 새로 시작
  if(s.status==='running'&&s.lottery&&lastStatus!=='running') window.runLottery(s.lottery)
  if(s.status==='showing_result'&&s.result) window.setLotteryBalloon(s.result.balloon)
  lastStatus=s.status
}
function connect(){
  const ws=new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage=e=>{ try{
    const msg=JSON.parse(e.data); FX.handle(msg)
    if(msg.type==='game:state'&&msg.data&&msg.data.id==='lottery') onState(msg.data)
    if(msg.type==='ping') ws.send(JSON.stringify({type:'pong'}))
  }catch(err){} }
  ws.onopen=()=>{ if(window.__wsDown) location.reload() }
  ws.onclose=()=>{ window.__wsDown=true; setTimeout(connect,2000) }
}
connect()
<\/script>
</body>
</html>`
