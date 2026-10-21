// 오버레이 공통 연출 모듈 — 각 페이지 HTML의 <script> 안에 `${FX_SCRIPT}` 로 인라인된다.
// 제공: window.FX
//   FX.sound(name)                 효과음 (Web Audio 합성, 파일 없음)
//     'tick' | 'stop' | 'win' | 'jackpot' | 'lose' | 'reveal' | 'pop' | 'flip' | 'buzzer' | 'timer' | 'coin' | 'whoosh'
//   FX.drumStart() / FX.drumStop() 두구두구 (반복 노이즈), 공개 직전까지
//   FX.spinStart() / FX.spinStop() 회전 중 낮은 윙 소리
//   FX.scratch()                   긁는 소리 (호출마다 짧게, 자동 스로틀)
//   FX.flash(color?)               화면 전체 플래시
//   FX.confetti(opts?)             색종이 {x,y,count,colors,spread}
//   FX.burst(el, color?)           요소 중심에서 빛 터짐 링
//   FX.winner({nick, balloons, text, sub, anchor, ms})  당첨자 배너 (anchor: 기준 요소, 아래에 붙음. 없으면 하단 중앙)
//   FX.hideWinner()
//   FX.handle(msg)                 ws 메시지 전달 → 'overlay:config' 로 효과음 on/off·볼륨 즉시 반영
//   설정: GET /api/overlay-config → {sound:{enabled,volume}} ; URL ?mute=1 ?vol=0.5 가 우선
export const FX_SCRIPT = `
(function(){
  if (window.FX) return;
  var Q = new URLSearchParams(location.search);
  var cfg = { enabled: Q.get('mute') !== '1', volume: Q.has('vol') ? Math.max(0, Math.min(1, parseFloat(Q.get('vol')))) : 0.7 };
  var lockedByQuery = Q.has('mute') || Q.has('vol');
  try {
    fetch('/api/overlay-config').then(function(r){ return r.json() }).then(function(j){
      if (lockedByQuery || !j || !j.sound) return;
      cfg.enabled = j.sound.enabled !== false; cfg.volume = typeof j.sound.volume === 'number' ? j.sound.volume : cfg.volume; applyGain();
    }).catch(function(){});
  } catch (e) {}

  // ── Web Audio ─────────────────────────────────────────────
  var AC = null, master = null;
  function ctx(){
    if (AC) { if (AC.state === 'suspended') AC.resume(); return AC; }
    var C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    AC = new C(); master = AC.createGain(); master.connect(AC.destination); applyGain(); return AC;
  }
  function applyGain(){ if (master) master.gain.value = cfg.enabled ? cfg.volume : 0; }
  function on(){ return cfg.enabled && cfg.volume > 0; }
  function tone(freq, dur, type, vol, when, slideTo){
    var c = ctx(); if (!c) return; when = when || 0;
    var o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.value = freq;
    var t0 = c.currentTime + when; if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.3, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  var noiseBuf = null;
  function noise(dur, vol, when, hp, lp){
    var c = ctx(); if (!c) return; when = when || 0;
    if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    var s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    var f1 = c.createBiquadFilter(); f1.type = 'highpass'; f1.frequency.value = hp || 800;
    var f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp || 6000;
    var g = c.createGain(); var t0 = c.currentTime + when;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f1); f1.connect(f2); f2.connect(g); g.connect(master); s.start(t0); s.stop(t0 + dur + 0.02);
  }
  var SOUNDS = {
    tick:   function(){ noise(0.03, 0.25, 0, 2500, 9000); tone(1800, 0.03, 'square', 0.05); },
    timer:  function(){ tone(1200, 0.06, 'sine', 0.12); },
    pop:    function(){ tone(600, 0.08, 'sine', 0.25, 0, 300); },
    flip:   function(){ noise(0.08, 0.18, 0, 600, 5000); tone(500, 0.1, 'triangle', 0.15, 0.02, 900); },
    whoosh: function(){ noise(0.35, 0.22, 0, 300, 2500); },
    reveal: function(){ noise(0.25, 0.2, 0, 400, 3000); tone(400, 0.25, 'sine', 0.2, 0.05, 1200); tone(1600, 0.2, 'sine', 0.15, 0.22); },
    stop:   function(){ tone(140, 0.25, 'sine', 0.5, 0, 60); noise(0.05, 0.3, 0, 1500, 7000); },
    coin:   function(){ tone(1568, 0.09, 'square', 0.12); tone(2093, 0.3, 'square', 0.12, 0.09); },
    win:    function(){ var n=[523,659,784,1047]; for (var i=0;i<n.length;i++) tone(n[i], 0.22, 'triangle', 0.28, i*0.11); tone(1047, 0.6, 'triangle', 0.25, 0.44); tone(1319, 0.6, 'sine', 0.15, 0.44); },
    jackpot:function(){ var n=[523,659,784,1047,1319,1568]; for (var i=0;i<n.length;i++) { tone(n[i], 0.2, 'square', 0.18, i*0.09); tone(n[i]*2, 0.2, 'sine', 0.08, i*0.09); } tone(1568, 1.2, 'triangle', 0.3, 0.6); tone(2093, 1.2, 'sine', 0.18, 0.6); tone(1047, 1.2, 'triangle', 0.18, 0.6); for (var k=0;k<8;k++) tone(3000+Math.random()*2000, 0.08, 'sine', 0.06, 0.7+k*0.08); },
    lose:   function(){ tone(392, 0.35, 'sawtooth', 0.12, 0, 330); tone(311, 0.6, 'sawtooth', 0.12, 0.3, 220); },
    buzzer: function(){ tone(180, 0.6, 'sawtooth', 0.25); tone(185, 0.6, 'square', 0.12); },
  };
  function sound(name){ if (!on()) return; var f = SOUNDS[name]; if (f) { try { f(); } catch (e) {} } }

  var drumT = null;
  function drumStart(bpm){ drumStop(); if (!on()) return; var iv = bpm ? 60000 / bpm : 70; var alt = false;
    drumT = setInterval(function(){ noise(0.04, alt ? 0.22 : 0.16, 0, 150, 1200); tone(alt ? 110 : 95, 0.06, 'sine', 0.35, 0, 60); alt = !alt; }, iv); }
  function drumStop(){ if (drumT) { clearInterval(drumT); drumT = null; } }

  var spinO = null, spinG = null;
  function spinStart(){ spinStop(); var c = ctx(); if (!c || !on()) return;
    spinO = c.createOscillator(); spinG = c.createGain(); var lfo = c.createOscillator(), lg = c.createGain();
    spinO.type = 'sawtooth'; spinO.frequency.value = 90; lfo.frequency.value = 14; lg.gain.value = 25; lfo.connect(lg); lg.connect(spinO.frequency);
    var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    spinG.gain.setValueAtTime(0.0001, c.currentTime); spinG.gain.exponentialRampToValueAtTime(0.08, c.currentTime + 0.2);
    spinO.connect(f); f.connect(spinG); spinG.connect(master); spinO.start(); lfo.start(); spinO._lfo = lfo; }
  function spinStop(){ if (!spinO) return; var c = AC; try { spinG.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.25); spinO.stop(c.currentTime + 0.3); spinO._lfo.stop(c.currentTime + 0.3); } catch (e) {} spinO = null; spinG = null; }

  var lastScratch = 0;
  function scratch(){ var now = Date.now(); if (now - lastScratch < 45) return; lastScratch = now; noise(0.06, 0.14, 0, 1200, 7000); }

  // ── 시각 효과 ─────────────────────────────────────────────
  function layer(z){ var d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:' + (z || 9000); document.body.appendChild(d); return d; }
  function flash(color){ var d = layer(9500); d.style.background = color || '#fff'; d.style.opacity = '0.85'; d.style.transition = 'opacity .45s ease-out';
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ d.style.opacity = '0'; }); }); setTimeout(function(){ d.remove(); }, 600); }
  function burst(el, color){ if (!el) return; var r = el.getBoundingClientRect(); var d = document.createElement('div');
    var size = Math.max(r.width, r.height); d.style.cssText = 'position:fixed;left:' + (r.left + r.width/2 - size/2) + 'px;top:' + (r.top + r.height/2 - size/2) + 'px;width:' + size + 'px;height:' + size + 'px;border-radius:50%;pointer-events:none;z-index:9400;border:6px solid ' + (color || '#FF5B17') + ';box-shadow:0 0 40px ' + (color || '#FF5B17') + ';opacity:.9;transform:scale(.6);transition:transform .6s cubic-bezier(.2,.8,.2,1),opacity .6s';
    document.body.appendChild(d); requestAnimationFrame(function(){ requestAnimationFrame(function(){ d.style.transform = 'scale(2.2)'; d.style.opacity = '0'; }); }); setTimeout(function(){ d.remove(); }, 700); }
  function confetti(o){ o = o || {}; var cv = document.createElement('canvas'); cv.width = innerWidth; cv.height = innerHeight;
    cv.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9300'; document.body.appendChild(cv); var c = cv.getContext('2d');
    var colors = o.colors || ['#FF5B17','#FFC928','#00CB84','#2F6BFF','#F5F3EF','#E0489A']; var n = o.count || 160; var ox = o.x != null ? o.x : innerWidth/2, oy = o.y != null ? o.y : innerHeight*0.45; var spread = o.spread || 1;
    var P = []; for (var i = 0; i < n; i++) { var a = -Math.PI/2 + (Math.random() - .5) * Math.PI * spread; var v = 9 + Math.random() * 13; P.push({ x: ox, y: oy, vx: Math.cos(a)*v, vy: Math.sin(a)*v, w: 7+Math.random()*7, h: 10+Math.random()*8, r: Math.random()*Math.PI, vr: (Math.random()-.5)*.3, col: colors[i % colors.length], life: 1 }); }
    var t0 = performance.now(); (function frame(now){ var dt = Math.min(2, (now - t0) / 16.7); t0 = now; c.clearRect(0,0,cv.width,cv.height); var alive = 0;
      for (var i = 0; i < P.length; i++) { var p = P[i]; p.vy += 0.35*dt; p.vx *= 0.99; p.x += p.vx*dt; p.y += p.vy*dt; p.r += p.vr*dt; if (p.y > cv.height + 20) continue; alive++; p.life = p.y > cv.height*0.85 ? Math.max(0, (cv.height - p.y) / (cv.height*0.15)) : 1;
        c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.globalAlpha = p.life; c.fillStyle = p.col; c.fillRect(-p.w/2, -p.h/2, p.w, p.h * Math.abs(Math.cos(p.r*2))); c.restore(); }
      if (alive > 0) requestAnimationFrame(frame); else cv.remove(); })(t0); }

  // ── 당첨자 배너 ───────────────────────────────────────────
  var bannerEl = null, bannerT = null, bannerStyle = false;
  function ensureStyle(){ if (bannerStyle) return; bannerStyle = true; var s = document.createElement('style'); s.textContent =
    '.fx-winner{position:fixed;left:50%;transform:translate(-50%,30px) scale(.9);opacity:0;z-index:9200;pointer-events:none;display:flex;align-items:center;gap:18px;padding:14px 28px 14px 18px;background:#172437;border:4px solid #FF5B17;border-radius:18px;box-shadow:0 14px 40px rgba(0,0,0,.45);font-family:"Noto Sans KR","Apple SD Gothic Neo",sans-serif;color:#fff;white-space:nowrap;transition:transform .45s cubic-bezier(.2,1.4,.3,1),opacity .3s}' +
    '.fx-winner.show{transform:translate(-50%,0) scale(1);opacity:1}' +
    '.fx-winner .fx-crown{width:52px;height:52px;border-radius:50%;background:#FF5B17;display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;box-shadow:inset 0 -4px 0 rgba(0,0,0,.2)}' +
    '.fx-winner .fx-nick{font-size:34px;font-weight:900;letter-spacing:-.02em;line-height:1.1}' +
    '.fx-winner .fx-sub{font-size:16px;font-weight:700;color:#c9d1de;margin-top:4px}' +
    '.fx-winner .fx-bal{margin-left:8px;padding:6px 14px;border-radius:999px;background:#FFC928;color:#172437;font-weight:900;font-size:20px;font-family:Inter,"Noto Sans KR",sans-serif}' +
    '.fx-winner .fx-text{font-size:22px;font-weight:800;color:#00CB84}'; document.head.appendChild(s); }
  function hideWinner(){ if (bannerT) { clearTimeout(bannerT); bannerT = null; } if (bannerEl) { var b = bannerEl; bannerEl = null; b.classList.remove('show'); setTimeout(function(){ b.remove(); }, 350); } }
  function winner(o){ o = o || {}; ensureStyle(); hideWinner(); if (!o.nick && !o.text) return;
    var b = document.createElement('div'); b.className = 'fx-winner';
    var html = '<div class="fx-crown">' + (o.icon || '🏆') + '</div><div>';
    if (o.nick) html += '<div class="fx-nick">' + esc(o.nick) + '</div>';
    if (o.text) html += '<div class="fx-text">' + esc(o.text) + '</div>';
    if (o.sub) html += '<div class="fx-sub">' + esc(o.sub) + '</div>';
    html += '</div>'; if (o.balloons > 0) html += '<div class="fx-bal">🎈 ' + Number(o.balloons).toLocaleString() + '개</div>';
    b.innerHTML = html;
    var bottom = 60, cx = innerWidth / 2;
    if (o.anchor && o.anchor.getBoundingClientRect) { var r = o.anchor.getBoundingClientRect(); bottom = Math.max(20, innerHeight - r.bottom - 92); if (o.above) bottom = Math.min(innerHeight - 110, innerHeight - r.top + 16); cx = r.left + r.width / 2; }
    b.style.bottom = bottom + 'px'; b.style.left = cx + 'px'; document.body.appendChild(b); bannerEl = b;
    // 기준 요소가 화면 가장자리에 있으면 배너가 잘리지 않게 안쪽으로 당긴다
    var bw = b.getBoundingClientRect().width || 0; var half = bw / 2 + 16;
    if (cx - half < 0) b.style.left = half + 'px'; else if (cx + half > innerWidth) b.style.left = (innerWidth - half) + 'px';
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ b.classList.add('show'); }); });
    bannerT = setTimeout(hideWinner, o.ms || 5000); return b; }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

  function handle(msg){ if (!msg || msg.type !== 'overlay:config' || lockedByQuery) return; var s = msg.data && msg.data.sound; if (!s) return;
    cfg.enabled = s.enabled !== false; if (typeof s.volume === 'number') cfg.volume = s.volume; applyGain(); }

  window.FX = { sound: sound, drumStart: drumStart, drumStop: drumStop, spinStart: spinStart, spinStop: spinStop, scratch: scratch,
    flash: flash, burst: burst, confetti: confetti, winner: winner, hideWinner: hideWinner, handle: handle, config: cfg };
})();
`
