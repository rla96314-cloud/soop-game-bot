// OBS 오버레이 페이지: fish — '수중 다큐 카메라' 연출 (찌 던지기 → 기다리기 → 입질 → 챔질 → 결과)
// 원본 시안: .inhabited/board/underwater (inhabited-design 이미지보드에서 채택). 캔버스 1장에 타임라인 렌더.
// 엔진의 state.fish(FishCastState: triggeredBy, fish{name,emoji,rarity,points}, castMs, startedAt, count, totalPoints) 로 1회 재생.
//  - 연출 시간축(T0)은 기준 5100ms(던지기~챔질)를 엔진의 castMs 에 맞춰 늘이고 줄인다 → 결과 공개 = 엔진 결과 시점
//  - startedAt 기준이라 OBS 새로고침으로 중간에 들어와도 이어서 재생
// 영상 클립이 있으면 server 가 fish-video 를 대신 서빙.
import { FX_SCRIPT } from './_fx'

export const FISH_OVERLAY_HTML = (port: number) => `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>수중 다큐 카메라</title>
<meta name="viewport" content="width=1920">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@500;700;900&family=JetBrains+Mono:wght@500;700;800&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;padding:0;background:transparent;overflow:hidden;width:1920px;height:1080px}
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

/* ---------- data ---------- */
let DATA = { fish:'', rarity:'일반', label:'일반', nick:'', gift:'', score:'', no:'' };
const RARITY = {
  '일반':{a:'#c9d6df',b:'#6b8396',belly:'#f1f5f7',glow:'#cfe0ea',badge:'#7d93a6',en:'COMMON'},
  '고급':{a:'#5cf0bd',b:'#00936a',belly:'#e3fff4',glow:'#00CB84',badge:'#00CB84',en:'UNCOMMON'},
  '희귀':{a:'#8fc1ff',b:'#3a4fd0',belly:'#eaf2ff',glow:'#6f8bff',badge:'#4f6bff',en:'RARE'},
  '전설':{a:'#ffd84d',b:'#ff6a12',belly:'#fff4c9',glow:'#ffb02e',badge:'#FF5B17',en:'LEGEND'}
};
let FC = RARITY['일반'];
const NAVY='#172437', OR='#FF5B17', CR='#F5F3EF', MINT='#00CB84';
const FT = '"Black Han Sans","Noto Sans KR",sans-serif';
const FK = '"Noto Sans KR","Apple SD Gothic Neo",sans-serif';
const FM = '"JetBrains Mono",ui-monospace,Menlo,monospace';

/* ---------- timeline ---------- */
const T0 = { cast:0, wait:1400, bite:3000, hook:4400, res:5100, end:7700, loop:9200 };
const HIT = 4480;            // hit-stop ends
const NIBS = [[3950,14],[4100,22],[4220,30],[4320,50]];
const FL = 360;              // fish length (world units)
const RT = {x:1150,y:-1300}; // rod tip (off-screen)
const P = {x:140,y:100,w:1640,h:870,k:52}; // camera panel

/* ---------- helpers ---------- */
const cl=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,p)=>a+(b-a)*p;
const seg=(t,a,b)=>cl((t-a)/(b-a));
const eo=p=>1-Math.pow(1-p,3);
const ei=p=>p*p*p;
const eio=p=>p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
const eback=p=>{const c1=2.0,c3=c1+1;return 1+c3*Math.pow(p-1,3)+c1*Math.pow(p-1,2);};
const rnd=i=>{const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const tau=t=>t<T0.res?t:T0.res+(t-T0.res)*0.22;   // slow-mo after the hook
/* 연출 시간(t, 기준 타임라인) ↔ 실제 경과(ms). 결과 전 구간만 castMs 에 맞춰 배속, 결과 이후는 1:1 */
let K=1;                                           // 실제 ms / 기준 ms (결과 전 구간)
const toStory=e=>e<T0.res*K?e/K:T0.res+(e-T0.res*K);
/* 물결·해초·물고기 떼 같은 배경 움직임은 배속 없이 실제 시간으로 (결과 후엔 슬로모션) */
const ambOf=t=>t<T0.res?t*K:T0.res*K+(t-T0.res)*0.22;

/* ---------- motion model ---------- */
function dip(t){
  let d=0;
  NIBS.forEach(([nt,amp],i)=>{
    const k=t-nt; if(k<0) return;
    if(k<80) d+=amp*(k/80);
    else d+= (i===NIBS.length-1)? amp : amp*Math.exp(-(k-80)/120);
  });
  return d;
}
function bobber(t){
  if(t<900){const p=t/900;return {x:lerp(1150,0,p),y:lerp(-980,0,p)-Math.sin(Math.PI*p)*330,r:p*Math.PI*5,vis:1};}
  if(t<T0.hook){
    const l=t-900; let y=Math.sin(t*.004)*5, r=Math.sin(t*.003)*.06;
    if(l<600){y+=Math.sin(l*.03)*34*Math.exp(-l/170);r+=Math.sin(l*.03)*.35*Math.exp(-l/170);}
    y+=dip(t); r+=dip(t)*.004;
    return {x:0,y,r,vis:1};
  }
  if(t<HIT) return bobber(4399);
  const p=seg(t,HIT,HIT+260);
  return {x:lerp(0,160,p),y:lerp(dip(4399),-1000,ei(p)),r:p*3,vis:t<HIT+300?1:0};
}
function fish(t){
  if(t<T0.bite){
    const p=seg(t,1400,3000);
    return {x:lerp(-1050,-470,eio(p)),y:300+Math.sin(t*.001)*12,a:.08,s:.95,dark:.8,tail:t*.007,mouth:0};
  }
  if(t<T0.hook){
    const p=eo(seg(t,3000,3950));
    let x=lerp(-470,-FL*.5-8,p), y=lerp(300,392,p), m=0;
    NIBS.forEach(([nt])=>{const d=t-nt;if(d>0&&d<220){x+=Math.sin(d/220*Math.PI)*18;m=Math.max(m,Math.sin(d/220*Math.PI));}});
    return {x,y,a:Math.sin(t*.005)*.04-(t>3950?.06:0),s:lerp(.95,1,p),dark:.8*(1-seg(t,3000,3700)),tail:t*.012+(t>3950?t*.012:0),mouth:m};
  }
  if(t<HIT) return fish(4399);
  if(t<T0.res){
    const q=seg(t,HIT,T0.res);
    return {x:lerp(-FL*.5-8,-150,eo(q)),y:lerp(392,-560,eo(q)),
      a:lerp(0,-1.25,eo(seg(t,HIT,HIT+200)))+Math.sin(t*.06)*.13,s:1,dark:0,tail:t*.05,mouth:1};
  }
  const u=tau(t)-T0.res, q=seg(t,T0.res,T0.end);
  return {x:-150-u*.12,y:-560-u*.06,a:lerp(-1.25,-.42,eio(q))+Math.sin(u*.02)*.05,
    s:lerp(1,1.34,eo(seg(t,T0.res,T0.res+900))),dark:0,tail:tau(t)*.03,mouth:1};
}
function mouthOf(f){return {x:f.x+Math.cos(f.a)*FL*.5*f.s,y:f.y+Math.sin(f.a)*FL*.5*f.s};}
function bait(t){
  const b=bobber(Math.min(t,899));
  if(t<900) return {x:b.x-6,y:b.y+66};
  if(t<T0.hook){
    const s=eo(seg(t,900,2400));
    return {x:Math.sin(t*.0015)*8*s,y:lerp(66,388,s)+dip(t)*.4};
  }
  return mouthOf(fish(t));
}
const BREAK = 4581, BX = -168;

/* ---------- camera ---------- */
function camAt(t){
  let x,y,z,r=0,sh=0;
  if(t<T0.wait){
    const b=bobber(Math.min(t,899)), p=seg(t,900,1400);
    x=lerp(b.x*.55,0,eio(p)); y=lerp(b.y*.55+40,80,eio(p));
    z=lerp(.84,1,eo(seg(t,0,1400))); r=lerp(-.06,0,eo(seg(t,0,1100)));
    if(t>900){ sh=22*Math.exp(-(t-900)/140); z+=.28*Math.exp(-(t-900)/260)*seg(t,900,960); }
  } else if(t<T0.bite){
    const p=seg(t,1400,3000);
    x=Math.sin(t*.0007)*14; y=lerp(80,175,eio(p))+Math.sin(t*.0011)*8; z=lerp(1,1.14,eio(p)); r=Math.sin(t*.0005)*.01;
  } else if(t<T0.hook){
    const p=seg(t,3000,4150);
    x=lerp(0,-10,eio(p)); y=lerp(175,350,eio(p)); z=lerp(1.14,1.8,eio(p));
    sh=1.5+seg(t,3300,4400)*4;
    NIBS.forEach(([nt,amp])=>{const d=t-nt;if(d>0)sh+=amp*.55*Math.exp(-d/90);});
  } else if(t<HIT){
    const c=camAt(4399); x=c.x; y=c.y; z=c.z*1.06; sh=30;
  } else if(t<T0.res){
    const f=fish(t);
    x=-70; y=f.y+70; z=lerp(1.5,1.28,eo(seg(t,HIT,T0.res)));
    r=-.07*Math.exp(-(t-HIT)/320)*Math.cos((t-HIT)*.03);
    sh=34*Math.exp(-(t-HIT)/170)+(t>BREAK?24*Math.exp(-(t-BREAK)/160):0);
  } else {
    const p=seg(t,T0.res,T0.end);
    x=lerp(150,185,p); y=lerp(-470,-395,eo(seg(t,T0.res,T0.res+900)));
    z=lerp(1.2,1.04,eo(seg(t,T0.res,T0.res+1100))); r=lerp(.035,0,eo(p));
    sh=12*Math.exp(-(t-T0.res)/200);
  }
  const k=Math.floor(t/16);
  return {x:x+(rnd(k)-.5)*2*sh/z, y:y+(rnd(k+977)-.5)*2*sh/z, z, r};
}
function w2s(cam,wx,wy,cx=960,cy=540){
  const dx=(wx-cam.x)*cam.z, dy=(wy-cam.y)*cam.z, c=Math.cos(cam.r), s=Math.sin(cam.r);
  return {x:cx+dx*c-dy*s, y:cy+dx*s+dy*c};
}

/* ---------- drawing primitives ---------- */
function fishBody(c,L){
  c.beginPath();
  c.moveTo(L*.5,L*.02);
  c.bezierCurveTo(L*.44,-L*.2,L*.12,-L*.3,-L*.16,-L*.21);
  c.bezierCurveTo(-L*.29,-L*.16,-L*.35,-L*.07,-L*.39,0);
  c.bezierCurveTo(-L*.35,L*.07,-L*.29,L*.14,-L*.16,L*.19);
  c.bezierCurveTo(L*.12,L*.28,L*.43,L*.19,L*.5,L*.02);
  c.closePath();
}
function drawFish(c,f,glow,t){
  const L=FL;
  c.save(); c.translate(f.x,f.y); c.rotate(f.a); c.scale(f.s,f.s);
  const sw=Math.sin(f.tail)*L*.08, fl=Math.sin(f.tail*1.3)*.25;
  const ol='rgba(23,36,55,.95)';
  c.lineJoin='round'; c.lineWidth=L*.013; c.strokeStyle=ol;
  if(glow){c.shadowColor=FC.glow;c.shadowBlur=glow;}
  // tail
  let g=c.createLinearGradient(-L*.66,0,-L*.36,0); g.addColorStop(0,FC.b); g.addColorStop(1,FC.a);
  c.beginPath(); c.moveTo(-L*.35,0);
  c.quadraticCurveTo(-L*.48,-L*.05+sw*.3,-L*.68,-L*.27+sw);
  c.quadraticCurveTo(-L*.55,sw*.55,-L*.68,L*.27+sw);
  c.quadraticCurveTo(-L*.48,L*.05+sw*.3,-L*.35,0); c.closePath();
  c.fillStyle=g; c.fill(); c.stroke();
  // dorsal
  c.beginPath(); c.moveTo(L*.14,-L*.25);
  c.quadraticCurveTo(-L*.02,-L*.47+sw*.2,-L*.27,-L*.37+sw*.3);
  c.quadraticCurveTo(-L*.21,-L*.26,-L*.24,-L*.17); c.closePath();
  c.fillStyle=FC.b; c.fill(); c.stroke();
  // ventral
  c.beginPath(); c.moveTo(-L*.02,L*.24); c.quadraticCurveTo(-L*.12,L*.38,-L*.22,L*.34); c.quadraticCurveTo(-L*.18,L*.25,-L*.2,L*.17); c.closePath();
  c.fillStyle=FC.b; c.fill(); c.stroke();
  // body
  fishBody(c,L);
  g=c.createLinearGradient(0,-L*.3,0,L*.26);
  g.addColorStop(0,FC.b); g.addColorStop(.45,FC.a); g.addColorStop(1,FC.belly);
  c.fillStyle=g; c.fill(); c.shadowBlur=0; c.stroke();
  // scales + shimmer, clipped
  c.save(); fishBody(c,L); c.clip();
  c.strokeStyle='rgba(255,255,255,.28)'; c.lineWidth=L*.006;
  for(let col=0;col<11;col++)for(let row=-4;row<=4;row++){
    const x=-L*.28+col*L*.06, y=row*L*.065+(col%2)*L*.032;
    c.beginPath(); c.arc(x,y,L*.042,-Math.PI/2,Math.PI/2); c.stroke();
  }
  c.fillStyle='rgba(255,255,255,.22)';
  c.beginPath(); c.ellipse(L*.05,-L*.13,L*.32,L*.045,-.05,0,Math.PI*2); c.fill();
  if(DATA.rarity!=='일반'){
    const sx=((t*.9)%1400)/1400*L*2.2-L*1.1;
    const sg=c.createLinearGradient(sx-L*.2,0,sx+L*.2,0);
    sg.addColorStop(0,'rgba(255,255,255,0)');sg.addColorStop(.5,'rgba(255,255,255,.55)');sg.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=sg; c.fillRect(-L*.6,-L*.4,L*1.2,L*.8);
  }
  c.restore();
  // gill
  c.strokeStyle='rgba(23,36,55,.6)'; c.lineWidth=L*.01;
  c.beginPath(); c.arc(L*.33,L*.0,L*.17,Math.PI*.62,Math.PI*1.38); c.stroke();
  // pectoral
  c.save(); c.translate(L*.18,L*.07); c.rotate(.5+fl);
  c.beginPath(); c.moveTo(0,0); c.quadraticCurveTo(-L*.1,-L*.06,-L*.17,L*.02); c.quadraticCurveTo(-L*.09,L*.06,0,0);
  c.fillStyle=FC.b; c.globalAlpha=.9; c.fill(); c.globalAlpha=1; c.lineWidth=L*.008; c.strokeStyle=ol; c.stroke(); c.restore();
  // eye
  c.fillStyle=CR; c.beginPath(); c.arc(L*.37,-L*.06,L*.05,0,Math.PI*2); c.fill();
  c.lineWidth=L*.008; c.strokeStyle=ol; c.stroke();
  c.fillStyle=NAVY; c.beginPath(); c.arc(L*.383,-L*.06,L*.031,0,Math.PI*2); c.fill();
  c.fillStyle='#fff'; c.beginPath(); c.arc(L*.392,-L*.072,L*.011,0,Math.PI*2); c.fill();
  // mouth
  const mo=f.mouth*L*.035;
  c.strokeStyle=ol; c.lineWidth=L*.012; c.lineCap='round';
  c.beginPath(); c.moveTo(L*.5,L*.02); c.lineTo(L*.42,L*.06+mo*.4); c.stroke();
  if(mo>1){c.fillStyle='#5a1e1e';c.beginPath();c.moveTo(L*.5,L*.0);c.lineTo(L*.43,L*.05);c.lineTo(L*.5,L*.04+mo);c.closePath();c.fill();}
  // dark silhouette overlay (lurking)
  if(f.dark>0){
    c.globalAlpha=f.dark; c.fillStyle='#061826';
    fishBody(c,L); c.fill();
    c.beginPath(); c.moveTo(-L*.35,0); c.quadraticCurveTo(-L*.48,-L*.05+sw*.3,-L*.68,-L*.27+sw); c.quadraticCurveTo(-L*.55,sw*.55,-L*.68,L*.27+sw); c.quadraticCurveTo(-L*.48,L*.05+sw*.3,-L*.35,0); c.fill();
    c.beginPath(); c.moveTo(L*.14,-L*.25); c.quadraticCurveTo(-L*.02,-L*.47,-L*.27,-L*.37); c.quadraticCurveTo(-L*.21,-L*.26,-L*.24,-L*.17); c.fill();
    c.globalAlpha=1;
    // glinting eye in the dark
    c.fillStyle=\`rgba(255,216,77,\${f.dark*.9})\`; c.beginPath(); c.arc(L*.37,-L*.06,L*.022,0,Math.PI*2); c.fill();
  }
  c.restore();
}
function drawBobber(c,b){
  c.save(); c.translate(b.x,b.y); c.rotate(b.r);
  c.lineWidth=3; c.strokeStyle=NAVY;
  c.fillStyle=OR; c.fillRect(-4,-86,8,46); c.strokeRect(-4,-86,8,46);
  c.fillStyle=CR; c.fillRect(-4,-86,8,12);
  c.save(); c.beginPath(); c.rect(-40,-80,80,78); c.clip();
  c.beginPath(); c.ellipse(0,-6,23,36,0,0,Math.PI*2); c.fillStyle=OR; c.fill(); c.stroke(); c.restore();
  c.save(); c.beginPath(); c.rect(-40,6,80,80); c.clip();
  c.beginPath(); c.ellipse(0,2,23,50,0,0,Math.PI*2); c.fillStyle=NAVY; c.fill(); c.strokeStyle=CR; c.lineWidth=2; c.stroke(); c.restore();
  c.fillStyle=CR; c.fillRect(-23,-2,46,8); c.strokeStyle=NAVY; c.lineWidth=3; c.strokeRect(-23,-2,46,8);
  c.strokeStyle='rgba(255,255,255,.7)'; c.lineWidth=4; c.lineCap='round';
  c.beginPath(); c.arc(0,-8,15,Math.PI*1.1,Math.PI*1.45); c.stroke();
  c.restore();
}
function drawBait(c,p,t,hooked){
  c.save(); c.translate(p.x,p.y);
  // hook
  c.strokeStyle='#d8e1e8'; c.lineWidth=4; c.lineCap='round';
  c.beginPath(); c.moveTo(0,-10); c.lineTo(0,26); c.arc(-11,26,11,0,Math.PI*.95); c.lineTo(-18,18); c.stroke();
  if(!hooked){
    // worm
    const w=Math.sin(t*.008)*5;
    c.strokeStyle='#ff8f73'; c.lineWidth=11;
    c.beginPath(); c.moveTo(2,4); c.bezierCurveTo(22+w,14,18,40,-4,40); c.bezierCurveTo(-26,40,-30,22+w,-22,10); c.stroke();
    c.strokeStyle='rgba(120,30,30,.45)'; c.lineWidth=2;
    for(let i=0;i<5;i++){c.beginPath();c.arc(-4+(i-2)*7,40-Math.abs(i-2)*3,5,0,Math.PI);c.stroke();}
  }
  c.restore();
}
function drawDrops(c,time,t0,cx,n,seed,vmin,vmax,spread,g,size,col){
  const dt=(time-t0)/1000; if(dt<0) return;
  for(let i=0;i<n;i++){
    const a=rnd(seed+i), b=rnd(seed+i*3+1), d=rnd(seed+i*7+2);
    const vx=(a-.5)*spread*(.4+d), vy=-(vmin+b*(vmax-vmin));
    const x=cx+(rnd(seed+i*11)-.5)*90+vx*dt, y=vy*dt+.5*g*dt*dt;
    if(y>6) continue;
    const vyy=vy+g*dt, sp=Math.hypot(vx,vyy)||1, r=size*(.35+d*.9);
    c.save(); c.translate(x,y); c.rotate(Math.atan2(vyy,vx));
    c.fillStyle=col; c.beginPath(); c.ellipse(0,0,r*(1+Math.min(2.4,sp/500)),r,0,0,Math.PI*2); c.fill();
    c.fillStyle='rgba(255,255,255,.9)'; c.beginPath(); c.arc(r*.4,-r*.3,r*.35,0,Math.PI*2); c.fill();
    c.restore();
  }
}
function drawCrown(c,time,t0,cx,height,width,seed,life){
  const dt=(time-t0)/1000; if(dt<0||dt>life) return;
  const grow=Math.sin(Math.min(1,dt/(life*.45))*Math.PI/2), fade=1-seg(dt,life*.5,life);
  const h=height*grow;
  const g=c.createLinearGradient(0,-h,0,0);
  g.addColorStop(0,\`rgba(255,255,255,\${.95*fade})\`); g.addColorStop(.6,\`rgba(190,245,250,\${.8*fade})\`); g.addColorStop(1,\`rgba(80,190,210,\${.5*fade})\`);
  c.fillStyle=g; c.beginPath(); c.moveTo(cx-width*(.6+grow*.5),6);
  const N=13;
  for(let i=0;i<=N;i++){
    const u=i/N, x=cx+(u-.5)*width*(1.1+grow*.9);
    const edge=Math.sin(u*Math.PI);
    const hh=h*(i%2? .45+rnd(seed+i)*.55 : .15+rnd(seed+i)*.2)*(.35+edge*.9);
    c.lineTo(x+(i%2?(u-.5)*40*grow:0),-hh);
  }
  c.lineTo(cx+width*(.6+grow*.5),6); c.closePath(); c.fill();
}
function drawRipples(c,time,t0,cx,n,maxr){
  const dt=time-t0; if(dt<0) return;
  for(let i=0;i<n;i++){
    const d=dt-i*150; if(d<0) continue;
    const p=d/1300; if(p>1) continue;
    c.strokeStyle=\`rgba(245,243,239,\${(1-p)*.8})\`; c.lineWidth=4*(1-p)+1;
    c.beginPath(); c.ellipse(cx,0,maxr*eo(p)+20,(maxr*eo(p)+20)*.14,0,0,Math.PI*2); c.stroke();
  }
}

/* ---------- world ---------- */
function drawWorld(c,t,cam,cx,cy,pip){
  const wt=tau(t), at=ambOf(t);
  c.save();
  c.translate(cx,cy); c.rotate(cam.r); c.scale(cam.z,cam.z); c.translate(-cam.x,-cam.y);
  // sky
  let g=c.createLinearGradient(0,-1500,0,0);
  g.addColorStop(0,'#0a111e'); g.addColorStop(.42,NAVY); g.addColorStop(.74,'#46304a'); g.addColorStop(.92,'#d8562a'); g.addColorStop(1,'#ffa25c');
  c.fillStyle=g; c.fillRect(-4000,-4000,8000,4020);
  let sg=c.createRadialGradient(560,-120,0,560,-120,620);
  sg.addColorStop(0,'rgba(255,236,190,1)'); sg.addColorStop(.1,'rgba(255,180,100,.85)'); sg.addColorStop(.4,'rgba(255,91,23,.28)'); sg.addColorStop(1,'rgba(255,91,23,0)');
  c.fillStyle=sg; c.fillRect(-100,-760,1300,780);
  // far coast
  c.fillStyle='rgba(23,22,40,.75)'; c.beginPath(); c.moveTo(-4000,4);
  for(let x=-4000;x<=4000;x+=80) c.lineTo(x,-26-Math.max(0,Math.sin(x*.0021+1.3))*70-Math.sin(x*.009)*12);
  c.lineTo(4000,4); c.closePath(); c.fill();

  const wv=x=>Math.sin(x*.011+at*.0021)*7+Math.sin(x*.027-at*.0033)*3.5;
  const waterPath=()=>{c.beginPath();c.moveTo(-4000,3200);for(let x=-4000;x<=4000;x+=20)c.lineTo(x,wv(x));c.lineTo(4000,3200);c.closePath();};
  g=c.createLinearGradient(0,0,0,720);
  g.addColorStop(0,'#38b3bf'); g.addColorStop(.12,'#178197'); g.addColorStop(.5,'#0b4766'); g.addColorStop(1,'#05182a');
  waterPath(); c.fillStyle=g; c.fill();

  // god rays
  c.save(); waterPath(); c.clip(); c.globalCompositeOperation='lighter';
  for(let i=0;i<10;i++){
    const x0=-1500+i*330+Math.sin(at*.0004+i*1.7)*70, w0=40+rnd(i+3)*120, sl=-(.2+rnd(i+11)*.22);
    const a=(.11+.07*Math.sin(at*.0013+i*2.3))*(.55+rnd(i)*.7);
    const gr=c.createLinearGradient(0,0,0,860);
    gr.addColorStop(0,\`rgba(225,255,235,\${a})\`); gr.addColorStop(1,'rgba(225,255,235,0)');
    c.fillStyle=gr; c.beginPath(); c.moveTo(x0,0); c.lineTo(x0+w0,0); c.lineTo(x0+w0*2.4+860*sl,860); c.lineTo(x0-w0*.5+860*sl,860); c.closePath(); c.fill();
  }
  c.restore();

  // background word (result)
  if(!pip && t>=T0.res){
    c.save(); c.setTransform(1,0,0,1,0,0);
    const a=eo(seg(t,T0.res+150,T0.res+700));
    c.globalAlpha=.2*a; c.font=\`330px \${FT}\`; c.textBaseline='middle';
    c.strokeStyle=CR; c.lineWidth=3; const off=(t-T0.res)*.05;
    c.strokeText(FC.en+' '+FC.en, 120-off, 560); c.restore();
  }

  // seabed
  const bed=x=>568+Math.sin(x*.004)*22+Math.sin(x*.013+1)*9;
  // seaweed (behind)
  for(let i=0;i<18;i++){
    const x0=-1700+i*205+rnd(i+40)*90, h=110+rnd(i+41)*190, by=bed(x0)+6;
    const col=i%3?'#0e6650':'#1a876a';
    for(let k=0;k<10;k++){
      const u0=k/10,u1=(k+1)/10, s=Math.sin(at*.0016+i*1.3);
      const xa=x0+s*28*Math.pow(u0,1.6)+Math.sin(u0*6+i)*6, xb=x0+s*28*Math.pow(u1,1.6)+Math.sin(u1*6+i)*6;
      c.strokeStyle=col; c.lineCap='round'; c.lineWidth=16*(1-u0*.8);
      c.beginPath(); c.moveTo(xa,by-u0*h); c.lineTo(xb,by-u1*h); c.stroke();
    }
  }
  g=c.createLinearGradient(0,530,0,820); g.addColorStop(0,'#0f4152'); g.addColorStop(1,'#03101a');
  c.fillStyle=g; c.beginPath(); c.moveTo(-4000,3200); for(let x=-4000;x<=4000;x+=40)c.lineTo(x,bed(x)); c.lineTo(4000,3200); c.closePath(); c.fill();
  for(let i=0;i<12;i++){
    const x=-1700+i*300+rnd(i+60)*140, rx=50+rnd(i+61)*110, ry=26+rnd(i+62)*40, y=bed(x)+12;
    c.fillStyle='#072230'; c.beginPath(); c.ellipse(x,y,rx,ry,0,0,Math.PI*2); c.fill();
    c.strokeStyle='rgba(140,220,220,.14)'; c.lineWidth=4; c.beginPath(); c.ellipse(x,y,rx,ry,0,Math.PI*1.15,Math.PI*1.85); c.stroke();
  }

  // background schools
  for(let i=0;i<22;i++){
    const y=170+rnd(i+20)*320, sp=.03+rnd(i)*.04, x=((rnd(i+30)*3800+at*sp)%3800)-1900, s=18+rnd(i+33)*26;
    c.fillStyle=\`rgba(6,34,50,\${.35+rnd(i+34)*.3})\`;
    c.beginPath(); c.ellipse(x,y,s,s*.36,0,0,Math.PI*2); c.fill();
    c.beginPath(); c.moveTo(x-s*.8,y); c.lineTo(x-s*1.4,y-s*.4); c.lineTo(x-s*1.4,y+s*.4); c.closePath(); c.fill();
  }
  // marine snow
  for(let i=0;i<150;i++){
    const x=rnd(i)*3800-1900+Math.sin(at*.0008+i)*12, y=30+((rnd(i+7)*560+at*.008*(.5+rnd(i+8)))%560), r=.8+rnd(i+9)*2;
    c.fillStyle=\`rgba(230,252,245,\${.18+rnd(i+10)*.3})\`; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill();
  }
  // ambient bubbles
  c.lineWidth=1.6;
  for(let i=0;i<34;i++){
    const per=4000+rnd(i+51)*3000, x=-1700+rnd(i+50)*3400+Math.sin(at*.002+i)*8;
    const y=560-((at+rnd(i+52)*per)%per)/per*560, r=2+rnd(i+53)*6;
    if(y<14) continue;
    c.strokeStyle='rgba(235,255,250,.5)'; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.stroke();
  }
  // bait-sinking bubbles
  for(let i=0;i<20;i++){
    const tb=920+i*75; if(t<tb||t>T0.hook) continue;
    const b0=bait(tb), d=t-tb, y=b0.y-d*.13, a=1-d/2600;
    if(y<12||a<=0) continue;
    const r=2+rnd(i+90)*5;
    c.strokeStyle=\`rgba(240,255,250,\${a*.8})\`; c.beginPath(); c.arc(b0.x+Math.sin(d*.006+i)*10,y,r,0,Math.PI*2); c.stroke();
  }

  // result: rarity burst behind fish
  const f=fish(t);
  if(t>=T0.res && !pip){
    const a=eo(seg(t,T0.res,T0.res+500));
    c.save(); c.translate(f.x,f.y); c.rotate(at*.0006);
    c.globalCompositeOperation='lighter';
    for(let i=0;i<20;i++){
      const ang=i/20*Math.PI*2, w=.07;
      const gr=c.createRadialGradient(0,0,0,0,0,900); gr.addColorStop(0,\`rgba(255,200,80,\${.5*a})\`); gr.addColorStop(1,'rgba(255,120,30,0)');
      c.fillStyle=gr; c.beginPath(); c.moveTo(0,0); c.arc(0,0,900,ang-w,ang+w); c.closePath(); c.fill();
    }
    const gl=c.createRadialGradient(0,0,0,0,0,420); gl.addColorStop(0,\`rgba(255,226,140,\${.65*a})\`); gl.addColorStop(1,'rgba(255,140,40,0)');
    c.fillStyle=gl; c.beginPath(); c.arc(0,0,420,0,Math.PI*2); c.fill();
    c.restore();
  }
  // break crown (behind fish)
  drawCrown(c,wt,BREAK,BX,430,300,300,.8);

  // hook trail bubbles
  if(t>=HIT){
    for(let i=0;i<70;i++){
      const tb=HIT+i*5; if(t<tb) continue;
      const f0=fish(tb), d=tau(t)-tau(tb);
      const x=f0.x-Math.cos(f0.a)*FL*.4+(rnd(i+200)-.5)*80, y=f0.y-Math.sin(f0.a)*FL*.4-d*.25+(rnd(i+201)-.5)*40;
      if(y<10) continue;
      const r=3+rnd(i+202)*10;
      c.strokeStyle='rgba(240,255,250,.75)'; c.lineWidth=2; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.stroke();
    }
  }

  // line
  const b=bobber(t), bt={x:b.x+Math.sin(b.r)*86,y:b.y-Math.cos(b.r)*86};
  c.lineCap='round';
  if(t<HIT){
    c.strokeStyle='rgba(245,243,239,.75)'; c.lineWidth=2.4/Math.max(.6,cam.z)*1.4;
    c.beginPath(); c.moveTo(RT.x,RT.y); c.quadraticCurveTo((RT.x+bt.x)/2+60,(RT.y+bt.y)/2+120,bt.x,bt.y); c.stroke();
    const bb={x:b.x-Math.sin(b.r)*50,y:b.y+Math.cos(b.r)*50}, bp=bait(t);
    c.strokeStyle='rgba(245,243,239,.55)'; c.lineWidth=2;
    c.beginPath(); c.moveTo(bb.x,bb.y); c.lineTo(bp.x,bp.y-10); c.stroke();
  } else {
    const m=mouthOf(f);
    c.strokeStyle='rgba(255,250,235,.95)'; c.lineWidth=4;
    c.beginPath(); c.moveTo(m.x,m.y); c.lineTo(m.x+(RT.x-m.x)*3,m.y+(RT.y-m.y)*3); c.stroke();
  }

  // cast trail
  if(t<1150){
    for(let k=14;k>=1;k--){
      const tk=t-k*22; if(tk<0||tk>900) continue;
      const p=bobber(tk), a=(1-k/15)*(1-seg(t,900,1150));
      const p2=bobber(Math.min(900,tk+22));
      c.strokeStyle=\`rgba(255,\${120+k*6},60,\${a*.7})\`; c.lineWidth=40*(1-k/16); c.lineCap='round';
      c.beginPath(); c.moveTo(p.x,p.y-20); c.lineTo(p2.x,p2.y-20); c.stroke();
    }
  }

  // main fish
  if(t>=1400) drawFish(c,f,t>=T0.res?50:(t>=HIT?24:0),wt);
  // bait / bobber
  if(t<T0.hook) drawBait(c,bait(t),wt,false);
  else drawBait(c,mouthOf(f),wt,true);
  if(b.vis) drawBobber(c,b);

  // underwater tint over everything below surface
  waterPath(); c.fillStyle='rgba(18,96,128,.16)'; c.fill();

  // surface lines
  c.beginPath(); for(let x=-4000;x<=4000;x+=20){const y=wv(x); x===-4000?c.moveTo(x,y):c.lineTo(x,y);}
  c.strokeStyle='rgba(150,240,240,.3)'; c.lineWidth=16; c.stroke();
  c.strokeStyle='rgba(250,250,240,.92)'; c.lineWidth=3.2; c.stroke();
  for(let i=0;i<16;i++){
    const x=250+rnd(i+300)*700+Math.sin(at*.001+i)*20, a=.4+.6*Math.abs(Math.sin(at*.004+i*2));
    c.strokeStyle=\`rgba(255,226,170,\${a})\`; c.lineWidth=3; c.beginPath(); c.moveTo(x,wv(x)-2); c.lineTo(x+18+rnd(i)*30,wv(x)-2); c.stroke();
  }

  // splashes
  drawRipples(c,t,900,0,3,260);
  NIBS.forEach(([nt,amp])=>drawRipples(c,t,nt,0,1,60+amp*3));
  drawRipples(c,wt,BREAK,BX,4,520);
  drawCrown(c,t,900,0,240,120,10,.8);
  drawDrops(c,t,900,0,70,20,400,1150,1000,2600,9,'rgba(220,250,255,.95)');
  drawDrops(c,wt,BREAK,BX,150,500,700,1650,1300,2200,13,'rgba(215,248,255,.95)');

  c.restore();
}

/* ---------- screen fx ---------- */
function speedLines(c,t,ang,alpha,seed,n,len,spd){
  if(alpha<=0) return;
  c.save(); c.translate(960,540); c.rotate(ang);
  for(let i=0;i<n;i++){
    const x=(rnd(seed+i)-.5)*2400, l=len*(.4+rnd(seed+i+50)), y=((rnd(seed+i+90)*1800+t*spd*(.7+rnd(seed+i+5)*.6))%1800)-900;
    c.strokeStyle=\`rgba(245,243,239,\${alpha*(.25+rnd(seed+i+7)*.5)})\`; c.lineWidth=2+rnd(seed+i+8)*5;
    c.beginPath(); c.moveTo(x,y); c.lineTo(x,y+l); c.stroke();
  }
  c.restore();
}
function screenFX(c,t,cam){
  // vignette
  let g=c.createRadialGradient(960,540,420,960,540,1060);
  g.addColorStop(0,'rgba(0,8,16,0)'); g.addColorStop(1,'rgba(0,8,16,.62)');
  c.fillStyle=g; c.fillRect(0,0,W,H);
  // cast speed lines (diagonal, from the throw)
  speedLines(c,t,-.9,(1-seg(t,700,950))*.9,10,34,320,2.6);
  // bite: tension
  if(t>=T0.bite && t<T0.res){
    let pulse=0; NIBS.forEach(([nt])=>{const d=t-nt;if(d>0)pulse+=Math.exp(-d/160);});
    const ten=seg(t,3000,4400);
    const bp=w2s(cam,bait(Math.min(t,4399)).x,bait(Math.min(t,4399)).y);
    const og=c.createRadialGradient(bp.x,bp.y,260,bp.x,bp.y,1150);
    og.addColorStop(0,'rgba(255,91,23,0)'); og.addColorStop(1,\`rgba(255,60,10,\${Math.min(.55,ten*.18+pulse*.28)})\`);
    c.fillStyle=og; c.fillRect(0,0,W,H);
    // converging zoom lines
    if(t<HIT){
      c.save(); c.translate(bp.x,bp.y);
      const za=Math.min(1,ten*.5+pulse*.6);
      for(let i=0;i<46;i++){
        const a=rnd(i+400)*Math.PI*2, r0=330+rnd(i+401)*200+((t*.25)%60), r1=r0+260+rnd(i+402)*400;
        c.strokeStyle=\`rgba(245,243,239,\${za*.22})\`; c.lineWidth=2+rnd(i+403)*4;
        c.beginPath(); c.moveTo(Math.cos(a)*r0,Math.sin(a)*r0); c.lineTo(Math.cos(a)*r1,Math.sin(a)*r1); c.stroke();
      }
      // target ring around bait
      const rr=90+Math.sin(t*.012)*8-pulse*14;
      c.strokeStyle=\`rgba(255,91,23,\${.6+pulse*.4})\`; c.lineWidth=4;
      for(let q=0;q<4;q++){c.beginPath();c.arc(0,0,rr,q*Math.PI/2+.25,q*Math.PI/2+Math.PI/2-.25);c.stroke();}
      c.restore();
    }
    // letterbox
    const hb=86*eo(seg(t,3000,3450))*(1-seg(t,HIT,HIT+220));
    c.fillStyle='#04070c'; c.fillRect(0,P.y,W,hb); c.fillRect(0,P.y+P.h-hb,W,hb);
  }
  // hook: impact flash + radial burst + vertical speed lines
  if(t>=T0.hook && t<T0.res+300){
    const fl=Math.pow(1-seg(t,4400,4620),2);
    if(t<HIT){
      c.fillStyle=\`rgba(255,250,240,\${.85*fl})\`; c.fillRect(0,0,W,H);
      c.save(); c.translate(960,560);
      for(let i=0;i<40;i++){const a=i/40*Math.PI*2+rnd(i)*.1,r0=120,r1=1200;
        c.fillStyle=i%2?OR:NAVY; c.beginPath(); c.moveTo(Math.cos(a-.02)*r0,Math.sin(a-.02)*r0); c.lineTo(Math.cos(a)*r1,Math.sin(a)*r1); c.lineTo(Math.cos(a+.03)*r0,Math.sin(a+.03)*r0); c.fill();}
      c.restore();
    } else {
      c.fillStyle=\`rgba(255,250,240,\${.5*fl})\`; c.fillRect(0,0,W,H);
      speedLines(c,t,0,(1-seg(t,4900,5100)),70,60,420,3.2);
    }
  }
  // result cut flash
  if(t>=T0.res){const a=.45*(1-seg(t,T0.res,T0.res+260));c.fillStyle=\`rgba(255,240,210,\${a})\`;c.fillRect(0,0,W,H);}
  // grain
  const k=Math.floor(t/42);
  for(let i=0;i<260;i++){
    c.fillStyle=rnd(k*31+i)>.5?'rgba(255,255,255,.07)':'rgba(0,0,0,.09)';
    c.fillRect(P.x+rnd(k*17+i)*P.w,P.y+rnd(k*13+i+5)*P.h,2,2);
  }
}

/* ---------- panel + HUD ---------- */
function panelPath(c,x,y,w,h,k){c.beginPath();c.moveTo(x+k,y);c.lineTo(x+w,y);c.lineTo(x+w,y+h-k);c.lineTo(x+w-k,y+h);c.lineTo(x,y+h);c.lineTo(x,y+k);c.closePath();}
const PH=[
  {n:'01',ko:'찌 던지기',en:'CAST',s:0,e:1400,sub:'노을 진 수면 위로, 찌가 날아든다'},
  {n:'02',ko:'기다리기',en:'WAIT',s:1400,e:3000,sub:'미끼가 가라앉는다 — 어둠 속 무언가가 보고 있다'},
  {n:'03',ko:'입질',en:'BITE',s:3000,e:4400,sub:'다가온다… 건드린다…'},
  {n:'04',ko:'챔질',en:'HOOK',s:4400,e:5100},
  {n:'05',ko:'결과',en:'CATCH',s:5100,e:7700}   // e 는 runFish 에서 T0.end 로 맞춤
];
function phaseIdx(t){for(let i=PH.length-1;i>=0;i--)if(t>=PH[i].s)return i;return 0;}
function hud(c,t,cam,py,ph){
  // frame
  c.save();
  panelPath(c,P.x,py,P.w,ph,P.k); c.strokeStyle='rgba(245,243,239,.55)'; c.lineWidth=3; c.stroke();
  // orange corner brackets
  const L=70; c.strokeStyle=OR; c.lineWidth=9; c.lineCap='square';
  const y0=py, y1=py+ph;
  c.beginPath(); c.moveTo(P.x+P.w-L,y0-10); c.lineTo(P.x+P.w+10,y0-10); c.lineTo(P.x+P.w+10,y0+L); c.stroke();
  c.beginPath(); c.moveTo(P.x-10,y1-L); c.lineTo(P.x-10,y1+10); c.lineTo(P.x+L,y1+10); c.stroke();
  c.beginPath(); c.moveTo(P.x-10,y0+P.k+L); c.lineTo(P.x-10,y0+P.k-6); c.lineTo(P.x+P.k-6,y0-10); c.lineTo(P.x+P.k+L,y0-10); c.stroke();
  c.restore();
  if(ph<P.h*.98) return;
  // REC + timecode
  c.save();
  const on=Math.floor(t/450)%2===0;
  c.fillStyle=on?'#ff2e2e':'rgba(255,46,46,.3)'; c.beginPath(); c.arc(P.x+92,P.y+52,11,0,Math.PI*2); c.fill();
  c.font=\`800 26px \${FM}\`; c.fillStyle=CR; c.textBaseline='middle';
  c.fillText('REC',P.x+112,P.y+53);
  const rt=ambOf(t), fr=Math.floor(rt/1000*30)%30, s=Math.floor(rt/1000);
  c.fillStyle='rgba(245,243,239,.8)'; c.font=\`600 24px \${FM}\`;
  c.fillText(\`TC 00:12:\${String(40+s).padStart(2,'0')}:\${String(fr).padStart(2,'0')}\`,P.x+184,P.y+53);
  c.fillStyle=MINT; c.font=\`700 20px \${FM}\`;
  c.fillText(cam.y>0?'UW-CAM 02 · 수중':'CAM 02 · 수면 위',P.x+92,P.y+86);
  if(t>=T0.res && Math.floor(t/380)%2===0){c.fillStyle=OR;c.font=\`800 24px \${FM}\`;c.fillText('▶ SLOW ×0.25',P.x+92,P.y+118);}
  // phase pills
  const idx=phaseIdx(t), pw=150, gap=10, total=5*pw+4*gap, sx=960-total/2+60;
  for(let i=0;i<5;i++){
    const x=sx+i*(pw+gap), y=P.y+34;
    const act=i===idx, done=i<idx;
    c.fillStyle=act?OR:done?'rgba(245,243,239,.85)':'rgba(10,18,28,.55)';
    c.fillRect(x,y,pw,40);
    if(!act&&!done){c.strokeStyle='rgba(245,243,239,.45)';c.lineWidth=2;c.strokeRect(x+1,y+1,pw-2,38);}
    if(act){const pr=seg(t,PH[i].s,PH[i].e);c.fillStyle='rgba(23,36,55,.35)';c.fillRect(x,y+34,pw*pr,6);}
    c.fillStyle=act?CR:done?NAVY:'rgba(245,243,239,.7)'; c.font=\`700 22px \${FK}\`; c.textAlign='center';
    c.fillText(\`\${PH[i].n} \${PH[i].ko}\`,x+pw/2,y+21);
  }
  c.textAlign='left';
  // depth ruler (left)
  const rx=P.x+44, rTop=P.y+170, rBot=P.y+P.h-300, mid=(rTop+rBot)/2;
  c.save(); c.beginPath(); c.rect(rx-10,rTop,120,rBot-rTop); c.clip();
  c.strokeStyle='rgba(245,243,239,.7)'; c.fillStyle='rgba(245,243,239,.75)'; c.font=\`600 18px \${FM}\`;
  for(let m=-10;m<=10;m+=.5){
    const y=mid+(m*100-cam.y)*.55; if(y<rTop-10||y>rBot+10) continue;
    const big=Math.abs(m%1)<.01; c.lineWidth=big?3:2;
    c.beginPath(); c.moveTo(rx,y); c.lineTo(rx+(big?28:14),y); c.stroke();
    if(big) c.fillText(m===0?'0':(m>0?m+'m':'+'+(-m)+'m'),rx+36,y);
  }
  c.restore();
  c.fillStyle=OR; c.beginPath(); c.moveTo(rx-4,mid); c.lineTo(rx-22,mid-12); c.lineTo(rx-22,mid+12); c.fill();
  const dm=cam.y/100;
  c.fillStyle=NAVY; c.fillRect(rx+86,mid-22,160,44);
  c.fillStyle=CR; c.font=\`700 24px \${FK}\`;
  c.fillText(dm>=0?\`수심 \${dm.toFixed(1)}m\`:\`수면 +\${(-dm).toFixed(1)}m\`,rx+98,mid+1);
  c.restore();
}

/* ---------- PiP surface cam during bite ---------- */
function pip(c,t){
  if(t<3150||t>=T0.hook+120) return;
  const a=eo(seg(t,3150,3400))*(1-seg(t,T0.hook,T0.hook+120));
  const w=470,h=270,x=P.x+P.w-w-44,y=P.y+128;
  let pulse=0; NIBS.forEach(([nt])=>{const d=t-nt;if(d>0)pulse+=Math.exp(-d/140);});
  c.save(); c.globalAlpha=a;
  c.translate(x+w,y); c.scale(lerp(.6,1,a),lerp(.6,1,a)); c.translate(-(x+w),-y);
  c.fillStyle='#000'; c.fillRect(x-6,y-6,w+12,h+12);
  c.save(); c.beginPath(); c.rect(x,y,w,h); c.clip();
  const k=Math.floor(t/16), sh=pulse*10;
  drawWorld(c,t,{x:(rnd(k)-.5)*sh,y:-14+(rnd(k+3)-.5)*sh,z:2.1,r:0},x+w/2,y+h/2,true);
  c.restore();
  c.strokeStyle=pulse>.3?OR:CR; c.lineWidth=pulse>.3?7:4; c.strokeRect(x,y,w,h);
  c.fillStyle=pulse>.3?OR:NAVY; c.fillRect(x,y-40,236,40);
  c.fillStyle=CR; c.font=\`800 22px \${FM}\`; c.textBaseline='middle'; c.fillText('CAM A · 수면 찌',x+14,y-19);
  // tension meter
  const ten=seg(t,3000,4400);
  c.fillStyle='rgba(4,8,14,.75)'; c.fillRect(x,y+h+14,w,46);
  c.fillStyle=OR; c.fillRect(x+128,y+h+28,(w-144)*Math.min(1,ten*.7+pulse*.25),18);
  c.fillStyle=CR; c.font=\`700 22px \${FK}\`; c.fillText('긴장도',x+16,y+h+38);
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
  const inn=eo(seg(t,ph.s+(i===0?250:0),ph.s+(i===0?650:380))), out=seg(t,ph.e-40,ph.e);
  if(inn<=0||out>=1) return;
  const x=P.x-30, y=P.y+P.h-232;
  c.save(); c.textBaseline='middle';
  c.font=\`108px \${FT}\`; const tw=c.measureText(ph.ko).width;
  const bw=(tw+90)*inn*(1-ei(out));
  // number block (drops in)
  const nd=(1-eback(cl(inn)))*-140;
  c.fillStyle=OR; c.fillRect(x,y+nd,156,156);
  c.fillStyle=NAVY; c.font=\`96px \${FT}\`; c.fillText(ph.n,x+18,y+84+nd);
  // title plate (wipe)
  c.save(); c.beginPath(); c.rect(x+156,y,bw,156); c.clip();
  c.fillStyle=i===2?'#2a0f0a':NAVY; c.fillRect(x+156,y,tw+90,156);
  const jx=i===2?(rnd(Math.floor(t/30))-.5)*8:0;
  c.font=\`108px \${FT}\`; c.fillStyle=CR; c.fillText(ph.ko,x+200+jx,y+84);
  c.restore();
  // english tag + subtitle
  c.globalAlpha=inn*(1-out);
  c.fillStyle=CR; c.font=\`800 22px \${FM}\`; c.fillText(\`CH.\${ph.n} / \${ph.en}\`,x+4,y-22);
  c.font=\`700 38px \${FK}\`; c.lineWidth=8; c.strokeStyle='rgba(4,10,18,.85)'; c.lineJoin='round';
  c.strokeText(ph.sub,x+20,y+196); c.fillStyle=CR; c.fillText(ph.sub,x+20,y+196);
  c.restore();
}
function biteText(c,t){
  if(t<NIBS[0][0]||t>=T0.hook+60) return;
  let pop=0; NIBS.forEach(([nt],i)=>{const d=t-nt;if(d>0)pop+=(.25+i*.08)*Math.exp(-d/110);});
  const k=Math.floor(t/24), j=6+pop*24;
  const n=NIBS.filter(([nt])=>t>=nt).length;
  c.save(); c.translate(1410+(rnd(k)-.5)*j,640+(rnd(k+5)-.5)*j); c.rotate(-.08); c.scale(1+pop*.7,1+pop*.7);
  c.textAlign='center'; c.textBaseline='middle'; c.font=\`210px \${FT}\`;
  outlinedText(c,'입질'+'!'.repeat(Math.min(2,n)),0,0,OR,NAVY,24,CR,36);
  c.font=\`800 34px \${FM}\`; c.fillStyle=CR; c.strokeStyle=NAVY; c.lineWidth=8;
  const lab=\`NIBBLE ×\${n}\`; c.strokeText(lab,0,135); c.fillText(lab,0,135);
  c.restore();
}
function hookText(c,t){
  if(t<4420||t>5160) return;
  const p=seg(t,4420,4560), s=lerp(2.8,1,eback(p))*(1+seg(t,4560,5100)*.06), a=1-seg(t,5040,5160);
  c.save(); c.globalAlpha=a; c.translate(1370,540); c.rotate(-.1);
  // starburst
  c.save(); c.rotate(t*.0015); c.scale(s*.9,s*.9);
  c.fillStyle=CR; c.beginPath();
  for(let i=0;i<36;i++){const r=i%2?250:380+rnd(i)*80,an=i/36*Math.PI*2;i?c.lineTo(Math.cos(an)*r,Math.sin(an)*r):c.moveTo(Math.cos(an)*r,Math.sin(an)*r);}
  c.closePath(); c.fill(); c.strokeStyle=NAVY; c.lineWidth=8; c.stroke();
  c.restore();
  c.scale(s,s); c.textAlign='center'; c.textBaseline='middle';
  c.font=\`300px \${FT}\`;
  c.fillStyle=NAVY; c.fillText('챔질!',14,18);
  outlinedText(c,'챔질!',0,0,OR,NAVY,22,null,0);
  c.font=\`800 40px \${FM}\`; c.fillStyle=NAVY; c.fillText('HOOK SET',0,170);
  c.restore();
}
function balloon(c,x,y,r){
  c.save(); c.translate(x,y);
  c.fillStyle=CR; c.beginPath(); c.arc(0,0,r,0,Math.PI*2); c.fill();
  c.fillStyle=OR; c.beginPath();
  for(let i=0;i<10;i++){const rr=i%2?r*.38:r*.78,a=-Math.PI/2+i*Math.PI/5;i?c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}
  c.closePath(); c.fill(); c.restore();
}
function resultCard(c,t){
  if(t<T0.res+40) return;
  const x0=1130,y0=232,w=690,h=650;
  const inP=seg(t,T0.res+40,T0.res+460), ox=(1-eback(inP))*900;
  c.save(); c.translate(ox,0);
  // motion streaks while entering
  if(inP<1){c.fillStyle=\`rgba(245,243,239,\${.6*(1-inP)})\`;for(let i=0;i<8;i++)c.fillRect(x0+w+20+rnd(i)*200,y0+40+i*75,300+rnd(i+3)*300,6);}
  c.transform(1,0,-.08,1,0,0); c.translate(y0*.08+40,0);
  // shadow + card
  c.fillStyle='rgba(0,0,0,.45)'; c.fillRect(x0+18,y0+22,w,h);
  c.fillStyle=CR; c.fillRect(x0,y0,w,h);
  c.fillStyle=OR; c.fillRect(x0,y0,18,h);
  c.fillStyle=NAVY; c.fillRect(x0+18,y0,w-18,96);
  c.textBaseline='middle';
  c.fillStyle=OR; c.font=\`68px \${FT}\`; c.fillText('CATCH!',x0+50,y0+52);
  c.fillStyle='rgba(245,243,239,.75)'; c.font=\`700 22px \${FM}\`; c.fillText('포획 기록 #'+DATA.no,x0+300,y0+52);
  // fish name hit
  const np=seg(t,T0.res+380,T0.res+620), ns=lerp(1.9,1,eback(np));
  if(np>0){
    c.save(); c.globalAlpha=Math.min(1,np*3); c.translate(x0+50,y0+226); c.scale(ns,ns);
    c.font=\`188px \${FT}\`; {const mw=c.measureText(DATA.fish).width, fit=Math.min(1,(w-120)/Math.max(1,mw)); c.scale(fit,fit);} c.fillStyle=FC.badge; c.fillText(DATA.fish,8,10);
    c.fillStyle=NAVY; c.fillText(DATA.fish,0,0); c.restore();
  }
  // stats
  const sp=seg(t,T0.res+620,T0.res+820);
  c.globalAlpha=sp; c.fillStyle=NAVY; c.font=\`800 32px \${FK}\`;
  {const mw=c.measureText(DATA.score).width; if(mw>w-110) c.font=\`800 \${Math.max(18,Math.floor(32*(w-110)/mw))}px \${FK}\`;}
  c.fillText(DATA.score,x0+56,y0+346);
  c.globalAlpha=1;
  c.strokeStyle='rgba(23,36,55,.25)'; c.lineWidth=3; c.setLineDash([10,10]);
  c.beginPath(); c.moveTo(x0+50,y0+392); c.lineTo(x0+w-40,y0+392); c.stroke(); c.setLineDash([]);
  // catcher
  const cp=eo(seg(t,T0.res+760,T0.res+1060));
  c.save(); c.globalAlpha=cp; c.translate((1-cp)*80,0);
  c.fillStyle='rgba(23,36,55,.6)'; c.font=\`700 28px \${FK}\`; c.fillText('잡은 사람',x0+56,y0+430);
  c.fillStyle=NAVY; c.font=\`900 84px \${FK}\`; {const mw=c.measureText(DATA.nick).width; if(mw>w-110){c.font=\`900 \${Math.max(40,Math.floor(84*(w-110)/mw))}px \${FK}\`;}} c.fillText(DATA.nick,x0+52,y0+492);
  c.restore();
  // gift pill
  const gp=seg(t,T0.res+940,T0.res+1200), gs=lerp(.4,1,eback(gp));
  if(gp>0&&DATA.gift){
    c.save(); c.translate(x0+56,y0+590); c.scale(gs,gs); c.globalAlpha=Math.min(1,gp*2);
    c.fillStyle=OR; c.beginPath(); c.roundRect(0,-40,420,80,40); c.fill();
    balloon(c,42,0,28);
    c.fillStyle=CR; c.font=\`900 46px \${FK}\`; c.fillText(DATA.gift,86,2);
    c.restore();
  }
  // rarity stamp
  const bp=seg(t,T0.res+560,T0.res+800);
  if(bp>0){
    const bs=lerp(3,1,eback(bp));
    c.save(); c.translate(x0+w-60,y0+20); c.rotate(-.2); c.scale(bs,bs); c.globalAlpha=Math.min(1,bp*2.5);
    if(bp<1){c.strokeStyle=FC.badge;c.lineWidth=6;for(let i=0;i<12;i++){const a=i/12*Math.PI*2;c.beginPath();c.moveTo(Math.cos(a)*130,Math.sin(a)*130);c.lineTo(Math.cos(a)*(150+bp*60),Math.sin(a)*(150+bp*60));c.stroke();}}
    c.fillStyle=NAVY; c.beginPath(); c.arc(6,8,112,0,Math.PI*2); c.fill();
    c.fillStyle=FC.badge; c.beginPath(); c.arc(0,0,112,0,Math.PI*2); c.fill();
    c.strokeStyle=CR; c.lineWidth=5; c.beginPath(); c.arc(0,0,96,0,Math.PI*2); c.stroke();
    c.textAlign='center'; c.fillStyle=CR; c.font=\`84px \${FT}\`; {const mw=c.measureText(DATA.label).width; if(mw>170) c.font=\`\${Math.floor(84*170/mw)}px \${FT}\`;} c.fillText(DATA.label,0,-4);
    c.font=\`800 20px \${FM}\`; c.fillText(FC.en,0,58);
    c.restore();
  }
  c.restore();
}

/* ---------- render ---------- */
function render(t){
  X.setTransform(1,0,0,1,0,0); X.clearRect(0,0,W,H);
  if(t>=T0.end+420) return;
  X.save(); X.globalAlpha=1-seg(t,T0.end,T0.end+400);
  const wt=(t>=T0.hook&&t<HIT)?4399:t;
  const cam=camAt(t);
  const rv=eo(seg(t,0,450)), ph=Math.max(4,P.h*rv), py=P.y+(P.h-ph)/2;
  X.save(); X.shadowColor='rgba(0,0,0,.55)'; X.shadowBlur=50; X.shadowOffsetY=14;
  panelPath(X,P.x,py,P.w,ph,P.k); X.fillStyle='#061019'; X.fill(); X.restore();
  X.save(); panelPath(X,P.x,py,P.w,ph,P.k); X.clip();
  drawWorld(X,wt,cam,960,540,false);
  screenFX(X,t,cam);
  X.restore();
  hud(X,t,cam,py,ph);
  if(rv>=1){
    pip(X,t);
    chapter(X,t,phaseIdx(t));
    biteText(X,t);
    hookText(X,t);
    resultCard(X,t);
  }
  X.restore();
}

let start=0, playing=false, paused=false, cues={};
const RMAP={common:'일반',uncommon:'고급',rare:'희귀',legendary:'전설'};        // 연출 색·크기 (전설 = 레전드 연출)
const RLABEL={common:'일반',uncommon:'고급',rare:'희귀',legendary:'레전드'};     // 화면 표기 (엔진 FISH_RARITY_LABEL 과 동일)
const BASE_PRE=T0.res;       // 기준 타임라인의 던지기~챔질 길이 (5100)
const HOLD=5000;             // 결과 화면 유지 (엔진 결과 표시 5초와 맞춤) → 이후 0.4초 페이드
function cue(t,silent){ // 단계 전환 효과음 (FX 모듈). silent: 중간 합류 시 지난 효과음은 건너뜀
  if(!window.FX) return;
  const at=(k,ms,fn)=>{ if(t>=ms && !cues[k]){ cues[k]=1; if(!silent) fn(); } };
  at('cast',60,()=>FX.sound('whoosh'));
  at('land',T0.wait-150,()=>FX.sound('pop'));
  at('bite',T0.bite,()=>FX.drumStart(130));
  NIBS.forEach((n,i)=>at('nib'+i,n[0],()=>FX.sound('tick')));
  at('hook',T0.hook,()=>{ FX.drumStop(); FX.sound('stop'); });
  at('res',T0.res+40,()=>FX.sound('reveal'));
  at('name',T0.res+400,()=>{ const r=DATA.rarity; FX.sound(r==='전설'?'jackpot':r==='희귀'?'win':r==='고급'?'coin':'pop');
    if(r==='전설'||r==='희귀') FX.confetti({x:700,y:420,count:r==='전설'?220:120,colors:r==='전설'?['#FFC928','#FF5B17','#fff','#FFE49A']:undefined}); });
  at('stamp',T0.res+560,()=>FX.sound('stop'));
}
function loop(now){
  if(playing && !paused){ const t=toStory(now-start); cue(t); render(t);
    if(t>T0.end+500){ playing=false; X.setTransform(1,0,0,1,0,0); X.clearRect(0,0,W,H); if(window.FX) FX.drumStop(); } }
  requestAnimationFrame(loop);
}
/** 기준 타임라인(ms) 위치를 정지 화면으로 그린다 (미리보기·캡처용) */
window.seek=ms=>{ paused=true; render(ms); };
window.TIMELINE=T0;
/** 진행 중인 판 멈추고 화면 비움 */
window.stopFish=()=>{ playing=false; X.setTransform(1,0,0,1,0,0); X.clearRect(0,0,W,H); if(window.FX){ FX.drumStop(); FX.hideWinner(); } };
/**
 * fs: 엔진 FishCastState { triggeredBy, fish{name,emoji,rarity,points}, castMs, startedAt, count, totalPoints }
 * balloon: 결과(GameResult) 에 담겨 오는 별풍선 수 (진행 중엔 모름 → setFishBalloon 으로 나중에 채움)
 */
window.runFish=(fs,balloon)=>{
  const f=fs.fish||{};
  const rarity=RMAP[f.rarity]||'일반';
  const name=String(f.name||'물고기').replace(/\\p{Extended_Pictographic}/gu,'').replace(/\\uFE0F/g,'').trim()||'물고기';
  let no=1; try{ no=(Number(localStorage.getItem('fishNo'))||0)+1; localStorage.setItem('fishNo',String(no)); }catch(e){ no=1+Math.floor(rnd((Number(fs.startedAt)||Date.now())%997)*900); }
  const nick=fs.triggeredBy&&fs.triggeredBy!=='weflab'?fs.triggeredBy:'스트리머';
  const pts=Number(f.points)||0;
  DATA={ fish:name, rarity, label:RLABEL[f.rarity]||String(f.rarity||'일반'), nick, gift:'',
    score:\`\${f.emoji?f.emoji+' ':''}+\${pts}점 · 누적 \${Number(fs.count)||1}마리 · 총 \${Number(fs.totalPoints)||pts}점\`,
    no:String(no).padStart(3,'0') };
  window.setFishBalloon(balloon);
  FC=RARITY[rarity];
  // 엔진 castMs 에 맞춰 결과 전 구간 배속, 결과 화면은 HOLD 만큼
  K=Math.max(200,Number(fs.castMs)||BASE_PRE)/BASE_PRE;
  T0.end=T0.res+HOLD; PH[4].e=T0.end;
  // 중간 합류: startedAt 기준 경과만큼 앞으로 (지난 효과음은 건너뛰고, 입질 구간이면 두구두구만 이어서)
  const elapsed=Math.max(0,Date.now()-(Number(fs.startedAt)||Date.now()));
  if(window.FX){ FX.drumStop(); FX.hideWinner(); }
  cues={}; paused=false; playing=true; start=performance.now()-elapsed;
  const t0=toStory(elapsed);
  if(t0>200){ cue(t0-1,true); if(window.FX && t0>=T0.bite && t0<T0.hook) FX.drumStart(130); }
};
window.setFishBalloon=b=>{ DATA.gift=Number(b)>0?\`별풍선 \${Number(b).toLocaleString()}개\`:''; };
if(document.fonts&&document.fonts.load){
  Promise.all([document.fonts.load(\`100px \${FT}\`),document.fonts.load(\`900 40px \${FK}\`),document.fonts.load(\`700 40px \${FK}\`),document.fonts.load(\`800 20px \${FM}\`)]).catch(()=>{});
}
requestAnimationFrame(loop);
})();
<\/script>
<script>
let curStart=null
function onState(s){
  const f=s.fish
  if((s.status==='running'||s.status==='showing_result')&&f&&f.startedAt!==curStart){
    curStart=f.startedAt; window.runFish(f, s.status==='showing_result'&&s.result?s.result.balloon:0)
  }
  if(s.status==='showing_result'&&s.result&&f&&f.startedAt===curStart) window.setFishBalloon(s.result.balloon)
}
function connect(){
  const ws=new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage=e=>{ try{
    const msg=JSON.parse(e.data); FX.handle(msg)
    if(msg.type==='game:state'&&msg.data&&msg.data.id==='fish') onState(msg.data)
    if(msg.type==='ping') ws.send(JSON.stringify({type:'pong'}))
  }catch(err){} }
  ws.onopen=()=>{ if(window.__wsDown) location.reload() }
  ws.onclose=()=>{ window.__wsDown=true; setTimeout(connect,2000) }
}
connect()
<\/script>
</body>
</html>`
