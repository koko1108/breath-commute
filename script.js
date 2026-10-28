(() => {
'use strict';
const $ = s => document.querySelector(s);
const stage = $('#stage'), cv = $('#cv'), ctx = cv.getContext('2d');
const FONT = '"Huninn", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- tuning ----------
const WALK_SPEED = 150;
const GLARE_RANGE = 300;
const HEAD_HIT = 38;
const FLOOR_Y = 330;
const CLEAN_TIME = 5;
const START_X = 200;

// Endless: the run ends only when your lungs give out. Titles by how many cigarettes you put out.
const ENDINGS = [
  { min: 0, title: '忍氣吞聲上班族', text: '今天又吸了一肚子二手菸，默默走進捷運站。' },
  { min: 5, title: '白眼見習生', text: '瞪是瞪了，但騎樓還是一片煙霧。再狠一點。' },
  { min: 12, title: '騎樓白眼王', text: '騎樓的人看到你走過來，都默默把菸收起來。' },
  { min: 22, title: '菸害終結者', text: '這條騎樓的地上，從此再也沒有菸蒂。' },
  { min: 35, title: '騎樓死神', text: '傳說只要在這條騎樓點菸，就會感覺到一道視線……' }
];
const GANG_FIRST = 30, GANG_EVERY = 40;
const diff = () => elapsed / 60; // difficulty climbs every minute
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const C = {
  facade: '#2c2a3b', facadeWin: '#ffd98a', facadeWinOff: '#3a3850',
  ceiling: '#24222f', tube: '#e9f6ff',
  wall: '#cfc4b3', glass: '#9fc3c9', glassIn: '#7fa7ae', shelf: '#e2d6c2',
  floor: '#b39f86', floorLine: '#9c8a72', pillar: '#ddd2bf', pillarShade: '#c3b7a3',
  mrt: '#1e64b4', mrtDark: '#123f73',
  smoke: '167,173,156', sil: '#15131c',
  ink: '#1f1d2b', text: '#f3efe6', sign: '#ffcf3f', glare: '#ff3f7f', lung: '#6fd3a8'
};
const SHOPS = [
  { n: '便利商店', c: '#2f9e6a', t: '#fff' }, { n: '早餐店', c: '#f2a33a', t: '#2b1d0e' },
  { n: '手搖飲', c: '#e2554a', t: '#fff' }, { n: '藥局', c: '#2a6fb0', t: '#fff' },
  { n: '彩券行', c: '#c9302c', t: '#ffe27a' }, { n: '麵店', c: '#f4e3b5', t: '#8a2b1a' },
  { n: '檳榔', c: '#3fa34d', t: '#fff36b' }, { n: '通訊行', c: '#6b4fb3', t: '#fff' }
];
const LOOKS = {
  smoker: [
    { body: '#6b7f5a', pants: '#3a3a46', hair: '#2b2b2b', skin: '#e8b88f', style: 'crop' },
    { body: '#3d4a63', pants: '#2a2f3d', hair: '#4a3628', skin: '#f0c49c', style: 'part' },
    { body: '#8a6d4a', pants: '#2f2f38', hair: '#1e1e1e', skin: '#dcae86', style: 'fringe' },
    { body: '#5a6f8a', pants: '#3a3a46', hair: '#3a2a20', skin: '#ecbd93', style: 'part' }
  ],
  vet: [
    { body: '#a0524a', pants: '#26262e', hair: '#d9d9d9', skin: '#d6a47a', tank: true, style: 'balding' },
    { body: '#4a4a52', pants: '#26262e', hair: '#bdbdbd', skin: '#cf9f76', tank: true, style: 'balding' }
  ],
  boba: [
    { body: '#f4f1ea', pants: '#2a4a7a', hair: '#1e1e1e', skin: '#f2c7a0', uniform: true, style: 'fringe' },
    { body: '#e9e4f5', pants: '#3a3a46', hair: '#5a3a28', skin: '#f0c49c', uniform: true, style: 'part' }
  ],
  candy: [
    { body: '#f2a33a', pants: '#2a4a7a', hair: '#2b1d14', skin: '#f6cfa8', style: 'cap', cap: '#2a6fb0' },
    { body: '#6fc3a0', pants: '#3a3a46', hair: '#1e1e1e', skin: '#f2c7a0', style: 'cap', cap: '#e2554a' }
  ]
};
// decoys look like they're smoking but aren't: glaring at them is a mistake
const DECOYS = ['boba', 'candy'];
const isDecoy = n => DECOYS.includes(n.type);
// everyone walks at their own pace: dawdlers, regular folks, people in a hurry
function speedTier() {
  const r = Math.random();
  return r < 0.3 ? rnd(18, 28) : r < 0.8 ? rnd(35, 55) : rnd(70, 95);
}

// ---------- sound (synthesized, starts after the first tap) ----------
const SFX = (() => {
  let ac = null, master = null, muted = false, hum = null;
  try { muted = localStorage.getItem('baiyan-muted') === '1'; } catch {}
  let tag = null, coughBuf = null, coughEl = null, lastCough = 0;
  // optional recorded cough: put a short clip at sfx/cough.mp3 (or embed it as COUGH_SRC)
  function loadCough() {
    const src = window.COUGH_SRC || 'sfx/cough.mp3';
    fetch(src).then(r => (r.ok ? r.arrayBuffer() : Promise.reject())).then(b => ac.decodeAudioData(b)).then(buf => { coughBuf = buf; })
      .catch(() => { const el = new Audio(src); el.preload = 'auto'; el.addEventListener('canplaythrough', () => { coughEl = el; }, { once: true }); el.load(); });
  }
  // iOS: a looping silent <audio> moves the page into "media playback", so Web Audio isn't muted by the ring/silent switch
  function unlockTag() {
    if (tag) return;
    try {
      const n = 4000, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
      const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
      w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
      w(36, 'data'); v.setUint32(40, n, true); for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
      tag = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
      tag.loop = true; tag.setAttribute('playsinline', '');
      tag.play().catch(() => {});
    } catch {}
  }
  function init() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    unlockTag();
    if (ac) { if (ac.state !== 'running') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.55; master.connect(ac.destination);
      // a silent blip inside the tap unlocks output on iOS
      const b = ac.createBuffer(1, 1, 22050), src = ac.createBufferSource();
      src.buffer = b; src.connect(ac.destination); src.start(0);
      if (ac.state !== 'running') ac.resume();
      loadCough();
    } catch { ac = null; }
  }
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(f, dur, type = 'square', vol = 0.15, f2, delay = 0) {
    if (!ac) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(g, t, 0.005, vol, dur); o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  let noiseBuf = null;
  function noise(dur, vol, freq, ftype = 'bandpass', q = 1, delay = 0, f2) {
    if (!ac) return;
    if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = ftype; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(g, t, 0.005, vol, dur); s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + 0.05);
  }
  return {
    init,
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('baiyan-muted', muted ? '1' : '0'); } catch {}
      if (master) master.gain.value = muted ? 0 : 0.55;
      return muted;
    },
    humOn(level, gold) {
      if (!ac) return;
      if (!hum) {
        const o = ac.createOscillator(), o2 = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain();
        o.type = 'sawtooth'; o2.type = 'square'; lfo.frequency.value = 18; lg.gain.value = 14;
        lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
        g.gain.value = 0.0001; o.connect(g); o2.connect(g); g.connect(master);
        o.start(); o2.start(); lfo.start();
        hum = { o, o2, lfo, g };
        g.gain.exponentialRampToValueAtTime(0.06, ac.currentTime + 0.05);
        tone(300, 0.12, 'square', 0.08, 900);
      }
      const f = (gold ? 330 : 180) + level * 420;
      hum.o.frequency.setTargetAtTime(f, ac.currentTime, 0.03);
      hum.o2.frequency.setTargetAtTime(f * 1.5, ac.currentTime, 0.03);
    },
    humOff() {
      if (!hum || !ac) return;
      const h = hum; hum = null;
      h.g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.03);
      setTimeout(() => { try { h.o.stop(); h.o2.stop(); h.lfo.stop(); } catch {} }, 200);
    },
    zap() {
      noise(0.45, 0.35, 5000, 'highpass', 0.7, 0, 1500);          // 滋～
      tone(160, 0.25, 'sine', 0.45, 40);                           // thump
      tone(1320, 0.35, 'triangle', 0.18, null, 0.08);              // ding
      tone(1760, 0.3, 'triangle', 0.12, null, 0.14);
    },
    tap() { tone(520 + Math.random() * 160, 0.05, 'square', 0.08); },
    duelStart() { tone(880, 0.1, 'square', 0.15); tone(660, 0.1, 'square', 0.15, null, 0.12); tone(880, 0.12, 'square', 0.15, null, 0.24); },
    duelWin() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'square', 0.13, null, i * 0.08)); },
    duelLose() { tone(400, 0.5, 'sawtooth', 0.14, 90); },
    mistake() { tone(140, 0.32, 'square', 0.18); tone(147, 0.32, 'square', 0.12); },
    cough() {
      const now = performance.now();
      if (now - lastCough < 1400) return;
      lastCough = now;
      if (!muted && coughBuf && ac) {
        const s = ac.createBufferSource(), g = ac.createGain();
        s.buffer = coughBuf; s.playbackRate.value = rnd(0.92, 1.12); g.gain.value = 0.32;
        s.connect(g).connect(master); s.start();
        return;
      }
      if (!muted && coughEl) { const a = coughEl.cloneNode(); a.volume = 0.18; a.play().catch(() => {}); return; }
      const bark = d => { noise(0.17, 0.6, 1300, 'bandpass', 0.8, d, 450); tone(160, 0.13, 'sawtooth', 0.08, 90, d); };
      bark(0); bark(0.22);
    },
    clean() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, 'triangle', 0.15, null, i * 0.06)); },
    tick() { tone(1800, 0.03, 'square', 0.06); },
    clear() { [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.12, null, i * 0.11)); },
    fail() { [392, 370, 349, 262].forEach((f, i) => tone(f, i === 3 ? 0.6 : 0.25, 'sawtooth', 0.1, null, i * 0.28)); }
  };
})();

// ---------- sizing ----------
let dpr = 1, scale = 1, viewW = 560, viewH = 400, camX = 0;
function resize() {
  const r = stage.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  scale = Math.min(r.height / 440, r.width / 315);
  viewW = r.width / scale; viewH = r.height / scale;
}
addEventListener('resize', resize); resize();

// ---------- helpers ----------
const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const hash = (i, j) => (((i * 73856093) ^ (j * 19349663)) >>> 0) % 100;

// ---------- state ----------
let state = 'title';
let P, npcs, parts, floats, sparks, stamps, cigs, duel, elapsed, shake, stats, lock, clean, freeze, flash, lastTick, spawnT, lastSpawnX, nextGang, gangCount, gangTired = 1;
const ptr = { down: false, x: 0, y: 0, glareMode: false };
const keys = { right: false };

function reset() {
  P = { x: START_X, phase: 0, moving: false, cough: 0, coughTxt: 0, lungs: 5, glaring: null, push: 0 };
  npcs = []; parts = []; floats = []; sparks = []; stamps = []; cigs = [];
  duel = null; lock = null; clean = 0; freeze = 0; flash = 0; lastTick = -1;
  elapsed = 0; shake = 0; spawnT = 1.2; nextGang = GANG_FIRST; gangCount = 0;
  stats = { out: 0, score: 0, duels: 0, miss: 0, scared: 0 };
  camX = START_X - viewW * 0.3;
  // opening line-up: one lights up quickly, one is still on his phone (bait for an early glare)
  spawn('smoker', START_X + 260, 'stand', 0.8);
  spawn('smoker', START_X + 430, 'stand', 4);
  spawn('boba', START_X + 560, 'stand');
  lastSpawnX = START_X + 560;
}

// Smokers cycle: idle (on the phone) -> light (lighter flame) -> smoke (lit, glare now!) -> done (flicks the butt, walks off)
// mode: 'stand' (may wander off later) | 'walk' (comes at you) | 'same' (walks your way, slower than you)
//       | 'pass' (overtakes from behind, then dawdles ahead of you)
function spawn(type, x, mode, idleFor) {
  const n = {
    type, x, mode, dir: mode === 'pass' || mode === 'same' ? 1 : -1,
    speed: mode === 'stand' ? 0 : mode === 'pass' ? rnd(40, 55) : speedTier(),
    standT: rnd(4, 9), pauseT: 0, look: pick(LOOKS[type]),
    state: 'free', active: false, meter: 0, early: 0, mistake: 0, fear: 0, zapT: 0, alpha: 1,
    cyc: DECOYS.includes(type) ? 'boba' : 'idle', cycT: idleFor ?? rnd(1.2, 3.4),
    st: 'rest', timer: rnd(0.4, 1.2), acc: 0, wisp: 0, puff: 0, lift: 0, phase: rnd(0, 6),
    hasCig: false, angry: 0, dueled: false, cooldown: 0, id: Math.random()
  };
  npcs.push(n);
  return n;
}
function spawnAhead() {
  const ahead = npcs.filter(n => n.state === 'free' && n.x > P.x + 20 && n.x < camX + viewW + 200).length;
  if (ahead >= 4 + Math.min(3, Math.floor(diff()))) return;
  const r = Math.random();
  const vetP = elapsed < 6 ? 0.08 : Math.min(0.4, 0.16 + diff() * 0.1);
  const type = r < 0.1 ? 'boba' : r < 0.19 ? 'candy' : r < 0.19 + vetP ? 'vet' : 'smoker';
  const m = Math.random();
  if (!DECOYS.includes(type) && elapsed > 4 && m < 0.28) {
    // overtaker: already smoking, comes up from behind you
    const o = spawn(type, camX - 30, 'pass', 0);
    o.cyc = 'smoke'; o.cycT = rnd(8, 10); o.hasCig = true;
    return;
  }
  // new arrivals appear just past the right edge, spaced out, even if you haven't moved
  const x = clamp(lastSpawnX + rnd(110, 170), camX + viewW + 40, camX + viewW + 150);
  lastSpawnX = x;
  const m2 = Math.random();
  const n = spawn(type, x, m2 < 0.5 ? 'walk' : m2 < 0.65 ? 'same' : 'stand');
  // half the head-on walkers are already puffing away
  if (n.mode === 'walk' && !DECOYS.includes(type) && Math.random() < 0.5) { n.cyc = 'smoke'; n.cycT = rnd(6, 8); n.hasCig = true; }
}
// an arcade gang every so often, one bigger each wave: a boss in shades plus his crew
function spawnGang() {
  gangCount++; gangTired = 1;
  const size = Math.min(6, 2 + gangCount);
  const x0 = Math.max(P.x + viewW * 0.62, lastSpawnX + 120);
  for (let k = 0; k < size; k++) {
    const n = spawn(k === 0 ? 'vet' : 'smoker', x0 + k * 36, 'stand');
    n.group = true; n.cyc = 'smoke'; n.cycT = 99; n.hasCig = true; n.timer = rnd(0, 1.5);
    if (k === 0) n.boss = true;
  }
  lastSpawnX = x0 + (size - 1) * 36;
  float(P.x + 120, FLOOR_Y - 200, `騎樓聚會 第 ${gangCount} 波！`, C.glare, 26);
  shake = 0.3; SFX.duelStart();
}

// ---------- particles ----------
function emit(x, y, o = {}) {
  const life = o.life ?? 2.6;
  parts.push({ x, y, r: o.r ?? 6, gr: o.gr ?? 9, a0: o.a ?? 0.3, a: o.a ?? 0.3, life, max: life, vx: o.vx ?? rnd(-5, 5), vy: o.vy ?? rnd(-12, -5) });
}
function spark(x, y, n, col) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), s = rnd(80, 320);
    sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: rnd(0.3, 0.7), max: 0.7, col: col || pick(['#fff3a0', '#ffb347', '#ff6a9a', '#ffffff']), size: rnd(2, 4.5) });
  }
}
function densityAt(x, y) {
  let d = 0;
  for (const p of parts) {
    const dx = p.x - x, dy = p.y - y;
    if (Math.abs(dx) > p.r || Math.abs(dy) > p.r) continue;
    const dist = Math.hypot(dx, dy);
    if (dist < p.r) d += (1 - dist / p.r) * p.a;
  }
  return clamp(d * 1.25, 0, 1);
}
function float(x, y, text, color, size) { floats.push({ x, y, text, color: color || C.text, life: 1.2, size: size || 20 }); }

// ---------- gameplay ----------
const kidScale = n => (n.type === 'candy' ? 0.93 : 1);
const headY = n => FLOOR_Y - (82 + 4 * (n.lift || 0)) * kidScale(n);
// you can glare ahead, or turn around and glare at someone coming up behind you (if they're on screen)
function canGlare(n) { return n.state === 'free' && Math.abs(n.x - P.x) > 18 && n.x - P.x < viewW * 0.95 && n.x > camX + 10; }
const facePlayer = n => (P.x >= n.x ? 1 : -1);
const heroFace = () => { const t = duel ? duel.target : P.glaring; return t && t.x < P.x ? -1 : 1; };
function headAt(wx, wy) {
  let best = null, bd = HEAD_HIT;
  for (const n of npcs) {
    if (!canGlare(n)) continue;
    const d = Math.hypot(n.x - wx, headY(n) - wy);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
const inDuel = n => duel && (duel.target === n || duel.rivals.includes(n));

function zap(n) {
  n.state = 'zapped'; n.zapT = 0; n.hasCig = false; n.meter = 1; n.fear = 1;
  freeze = 0.11; flash = 0.6; shake = Math.max(shake, 0.4);
  const hy = headY(n);
  stamps.push({ x: n.x, y: hy - 46, text: '熄！', t: 0 });
  cigs.push({ x: n.x - 18, y: FLOOR_Y - 62, vx: rnd(90, 170), vy: -300, rot: 0, vr: rnd(14, 22), life: 1.3 });
  spark(n.x - 14, FLOOR_Y - 64, 26);
  for (let i = 0; i < 10; i++) emit(n.x - 14, FLOOR_Y - 62, { r: 5, gr: 16, a: 0.35, life: 1.1, vx: rnd(-80, 80), vy: rnd(-60, 10) });
  stats.out++;
  stats.score += n.type === 'vet' ? 3000 : 1000;
  // each cigarette refills a bit less as the air gets worse
  P.lungs = Math.min(9, P.lungs + (n.type === 'vet' ? 2 : 1) * Math.max(0.25, 1 - diff() * 0.25));
  SFX.zap();
  if (P.lungs >= 9 && clean <= 0) startClean();
}
function startClean() {
  clean = CLEAN_TIME;
  float(P.x + 40, FLOOR_Y - 175, '清肺時刻！', C.sign, 30);
  flash = Math.max(flash, 0.4);
  SFX.clean();
}
// glared at someone who isn't smoking yet: he glares straight back and it costs you
function glaredBack(n) {
  n.cooldown = 1.2; n.early = 0; n.fear = 0; n.angry = 1; n.backT = 0.6; n.dir = facePlayer(n);
  P.lungs = Math.max(0, P.lungs - 1);
  float(n.x, headY(n) - 44, pick(['瞪三小？', '看屁喔！', '我又沒抽！']), '#ffd23f', 22);
  float(P.x, FLOOR_Y - 140, '太早了！肺活量 −1', '#ffb3ba', 18);
  lock = null; shake = 0.3;
  SFX.mistake();
}
function mistake(n) {
  stats.miss++;
  n.state = 'leaving'; n.angry = 1; n.dir = 1; n.speed = 110;
  P.lungs = Math.max(0, P.lungs - 1);
  float(n.x, headY(n) - 40, n.type === 'candy' ? pick(['我在吃棒棒糖啦！', '媽媽！有人瞪我！', '哇～（哭）']) : pick(['你瞪三小？', '看屁喔！', '我喝珍奶啦！']), '#ffb3ba', 22);
  lock = null; shake = 0.25;
  SFX.mistake();
}
// kind 'early': you glared before he lit up, so he glares back. kind 'vet': a veteran never goes quietly.
function startDuel(target, kind) {
  const rivals = kind === 'group' ? npcs.filter(n => n.group && n.state === 'free') : [target];
  for (const r of rivals) { r.dueled = true; r.angry = 1; r.dir = facePlayer(r); }
  let decay = kind === 'group' ? (0.18 + 0.03 * rivals.length) * gangTired : kind === 'vet' ? 0.32 : 0.25;
  if (clean > 0) decay *= 0.4; // Clean-Lung Time: your stare is overwhelming
  duel = { target, rivals, kind, p: 0.5, t: 0, pop: 0, decay };
  if (kind === 'group') float(target.x, headY(target) - 50, '整群瞪過來了！', '#ffd23f', 22);
  if (kind === 'early') float(target.x, headY(target) - 44, pick(['瞪三小？', '看屁喔！', '我又沒抽！']), '#ffd23f', 22);
  shake = 0.3;
  SFX.duelStart();
}
function duelTap() {
  if (!duel) return;
  duel.p += 0.09; duel.pop = 1;
  spark(lerp(P.x, duel.target.x, 0.55), FLOOR_Y - 88, 4, '#fff3a0');
  SFX.tap();
}
function endDuel(won) {
  const d = duel; duel = null;
  const n = d.target;
  if (won) {
    stats.duels++;
    float(P.x + 60, FLOOR_Y - 185, d.rivals.length > 1 ? `完勝 ×${d.rivals.length}！` : '瞪贏了！', C.sign, 28);
    SFX.duelWin();
    if (d.kind === 'group') {
      stats.score += 5000 * d.rivals.length;
      d.rivals.forEach((r, k) => setTimeout(() => { if (r.state === 'free' && state === 'play') zap(r); }, k * 160));
      lock = null;
    } else if (d.kind === 'vet') { stats.score += 3000; zap(n); }
    else {
      // he wasn't smoking yet: no cigarette to put out, but he slinks off without lighting up
      stats.scared++;
      n.state = 'flee'; n.dir = 1; n.speed = 240; n.fear = 1; n.angry = 0;
      float(n.x + 30, FLOOR_Y - 40, '嚇跑了', '#cfe9ff', 18);
      lock = null;
    }
  } else {
    P.lungs = Math.max(0, P.lungs - 2);
    P.push = 0.3;
    float(P.x, FLOOR_Y - 150, '被瞪輸了… 肺活量 −2', '#ffb3ba', 22);
    for (const r of d.rivals) { r.angry = 0.6; r.dueled = false; r.meter = 0; r.early = 0; r.cooldown = 2.5; }
    if (d.kind === 'group') { gangTired *= 0.8; float(n.x, headY(n) - 60, '他們也瞪累了…', '#cfe9ff', 16); }
    lock = null; shake = 0.45;
    SFX.duelLose();
  }
}

function updatePlayer(dt) {
  let walk = false;
  if (P.push > 0) { P.push -= dt; P.x = Math.max(START_X - 40, P.x - 240 * dt); }
  else if (!duel) {
    if (lock && !canGlare(lock)) lock = null;
    if (lock) { if (lock.x - P.x > GLARE_RANGE - 10) walk = true; }
    else if (ptr.down && !ptr.glareMode) walk = true;
    if (keys.right && !lock) walk = true;
  }
  P.moving = walk;
  if (walk) { P.x += WALK_SPEED * dt; P.phase += WALK_SPEED * dt * 0.09; }

  P.glaring = null;
  if (!duel && lock && canGlare(lock) && lock.x - P.x <= GLARE_RANGE) {
    const n = lock; P.glaring = n;
    const dist = Math.abs(n.x - P.x);
    const close = 1 - clamp((dist - 60) / (GLARE_RANGE - 60), 0, 1);
    if (isDecoy(n)) {
      n.mistake += dt;
      if (n.mistake > 0.45) mistake(n);
    } else if (n.cyc !== 'smoke') {
      // too early: he isn't smoking yet and notices you staring
      n.early += dt;
      n.fear = Math.min(1, n.early * 2);
      if (n.early > 0.3 && !(n.cooldown > 0)) glaredBack(n);
    } else {
      let rate = (n.type === 'vet' ? 0.55 : 0.85) * (0.7 + 1.3 * close);
      if (clean > 0) rate *= 4;
      n.meter += rate * dt;
      n.fear = Math.min(1, n.meter * 1.4);
      if (n.group && n.meter > 0.25 && !(n.cooldown > 0)) startDuel(n, 'group');
      else if (clean <= 0 && n.type === 'vet' && n.meter > 0.35 && !n.dueled) startDuel(n, 'vet');
      else if (n.meter >= 1) { zap(n); lock = null; }
    }
  }
  if (P.glaring && P.glaring.cyc === 'smoke') SFX.humOn(clamp(P.glaring.meter, 0, 1), clean > 0);
  else if (P.glaring) SFX.humOn(0.1, false);
  else SFX.humOff();

  // the arcade air keeps getting worse: lungs slowly drain, so you have to keep putting cigarettes out
  if (clean <= 0 && !duel) P.lungs = Math.max(0, P.lungs - Math.min(0.8, 0.03 + 0.08 * diff()) * dt);
  const dens = densityAt(P.x + 14, FLOOR_Y - 84);
  if (clean > 0) {
    clean -= dt;
    for (const p of parts) if (Math.abs(p.x - P.x) < 240) p.a0 *= Math.pow(0.02, dt);
    if (clean <= 0) P.lungs = Math.min(P.lungs, 3);
  } else if (dens > 0.05) {
    P.lungs = Math.max(0, P.lungs - dens * 0.55 * dt);
    P.cough = 0.4;
    P.coughTxt -= dt;
    if (P.coughTxt <= 0) { P.coughTxt = 0.8; float(P.x + 18, FLOOR_Y - 122, pick(['咳！', '咳咳']), '#d8dccb'); SFX.cough(); }
  }
  P.cough = Math.max(0, P.cough - dt);
}

function updateNPCs(dt) {
  for (const n of npcs) {
    if (n.cooldown > 0) n.cooldown -= dt;
    if (n.backT > 0) n.backT -= dt;
    n.angry = Math.max(0, n.angry - dt * 0.4);
    if (n.state === 'free') {
      if (!n.active && n.x - camX < viewW + 180) n.active = true;
      if (n !== P.glaring && !inDuel(n)) { n.meter = Math.max(0, n.meter - 0.35 * dt); n.early = Math.max(0, n.early - dt); n.mistake = Math.max(0, n.mistake - dt); n.fear = Math.max(0, n.fear - dt * 1.5); }
      const frozen = P.glaring === n || inDuel(n);
      if (frozen) n.dir = facePlayer(n);
      else if (n.active) moveNPC(n, dt);
      if (n.active && !isDecoy(n) && !inDuel(n)) {
        n.cycT -= dt;
        if (n.cyc === 'idle' && n.cycT <= 0) {
          n.cyc = 'light'; n.cycT = 0.75; n.hasCig = true;
          float(n.x - 4, headY(n) - 30, '喀擦', '#ffd9a0', 14);
        } else if (n.cyc === 'light' && n.cycT <= 0) {
          n.cyc = 'smoke'; n.cycT = rnd(5, 7.5) * Math.max(0.55, 1 - diff() * 0.2); n.st = 'rest'; n.timer = 0.5;
        } else if (n.cyc === 'smoke' && n.cycT <= 0 && P.glaring !== n) {
          // done: flicks the butt on the floor and strolls off
          n.cyc = 'done'; n.hasCig = false; n.state = 'leaving'; n.dir = 1; n.speed = 70;
          cigs.push({ x: n.x - 14, y: FLOOR_Y - 40, vx: rnd(-80, -40), vy: -160, rot: 0, vr: 12, life: 1.6 });
          float(n.x, headY(n) - 34, '亂丟菸蒂！', '#ffb3ba', 16);
        }
      }
      if (n.cyc === 'smoke') smokeRhythm(n, dt);
      if (isDecoy(n)) n.lift = lerp(n.lift, (Math.sin(elapsed * 1.7 + n.phase * 3) > (n.type === 'candy' ? -0.4 : 0.55)) ? 1 : 0, 1 - Math.exp(-dt * (n.type === 'candy' ? 5 : 8)));
      if (n.x < camX - 120) n.state = 'gone';
    } else if (n.state === 'zapped') {
      n.zapT += dt;
      n.lift = 0; n.puff = 0;
      if (n.zapT > 0.55) { n.state = 'flee'; n.dir = 1; n.speed = 260; float(n.x + 34, FLOOR_Y - 40, pick(['對不起～', '我不抽了！', '嗚哇～']), '#cfe9ff', 18); }
    } else if (n.state === 'flee' || n.state === 'leaving') {
      n.x += n.dir * n.speed * dt; n.phase += n.speed * dt * 0.1;
      n.lift = lerp(n.lift, 0, 1 - Math.exp(-dt * 10)); n.puff = 0;
      if (n.state === 'flee') n.alpha = Math.max(0, n.alpha - dt * 1.1);
      else if (n.cyc === 'done') n.alpha = Math.max(0, n.alpha - dt * 0.5);
      if (n.alpha <= 0 || n.x > camX + viewW + 120) n.state = 'gone';
    }
  }
  npcs = npcs.filter(n => n.state !== 'gone');
}

const isWalking = n => n.state === 'free' && n.active && n.mode !== 'stand' && !(n.pauseT > 0) && !(P.glaring === n || inDuel(n));
function moveNPC(n, dt) {
  if (n.mode === 'stand') {
    // loiterers eventually wander off, either way
    if (n.group || n.cyc === 'light') return;
    n.standT -= dt;
    if (n.standT <= 0) { n.mode = Math.random() < 0.5 ? 'walk' : 'same'; n.speed = speedTier(); }
    return;
  }
  if (n.pauseT > 0) { n.pauseT -= dt; return; }
  // now and then someone stops for a moment (phone, shop window, shoelace)
  if (n.mode !== 'pass' && Math.random() < dt * 0.12) { n.pauseT = rnd(0.8, 2.2); return; }
  let sp = n.speed;
  if (n.mode === 'walk') n.dir = -1;
  else { n.dir = 1; if (n.mode === 'pass' && n.x < P.x + 140) sp = 170; }
  n.x += n.dir * sp * dt; n.phase += sp * dt * 0.1;
  if (n.x > camX + viewW + 260) n.state = 'gone';
}

function smokeRhythm(n, dt) {
  const vet = n.type === 'vet';
  n.timer -= dt;
  if (n.st === 'rest' && n.timer <= 0) { n.st = 'windup'; n.timer = 0.7; }
  else if (n.st === 'windup' && n.timer <= 0) { n.st = 'exhale'; n.timer = 0.5; n.acc = 0; }
  else if (n.st === 'exhale') {
    n.acc += dt;
    const mx = n.x + n.dir * 13, my = headY(n) + 6;
    const big = n.group ? 1.25 : 1;
    while (n.acc > 0.015) {
      n.acc -= 0.015;
      // facing you: blown straight at you. walking away: hangs in the air as a trail you walk into
      const vx = n.dir === facePlayer(n) * -1 ? rnd(-25, 10) : n.dir * rnd(30, 70);
      emit(mx, my, { r: (vet ? 9 : 7) * big, gr: (vet ? 18 : 14) * big, a: 0.4, vx, vy: rnd(-10, 4), life: n.dir < 0 ? 2.4 : 3.2 });
    }
    if (n.timer <= 0) { n.st = 'rest'; n.timer = rnd(vet ? 1.6 : 2.2, vet ? 2.6 : 3.4); }
  }
  const k = 1 - Math.exp(-dt * 10);
  n.puff = lerp(n.puff, n.st === 'windup' ? 1 : n.st === 'exhale' ? 0.4 : 0, k);
  n.lift = lerp(n.lift, n.st === 'windup' ? 1 : 0, k);
  n.wisp -= dt;
  if (n.wisp <= 0) {
    const moving = isWalking(n);
    n.wisp = moving ? 0.1 : 0.2;
    emit(n.x + n.dir * 22, FLOOR_Y - (moving ? 70 : 38), { r: moving ? 5 : 3, gr: moving ? 9 : 5, a: moving ? 0.16 : 0.1, life: moving ? 2.6 : 2 });
  }
}

function updateFx(dt) {
  for (const p of parts) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= Math.pow(0.35, dt); p.vy *= Math.pow(0.5, dt);
    p.r += p.gr * dt; p.gr *= Math.pow(0.6, dt);
    p.life -= dt; p.a = p.a0 * Math.max(0, p.life / p.max);
  }
  parts = parts.filter(p => p.life > 0 && p.a > 0.005);
  for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 600 * dt; s.vx *= Math.pow(0.2, dt); s.life -= dt; }
  sparks = sparks.filter(s => s.life > 0);
  for (const c of cigs) {
    c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 900 * dt; c.rot += c.vr * dt; c.life -= dt;
    if (c.y > FLOOR_Y - 2) { c.y = FLOOR_Y - 2; c.vy *= -0.35; c.vx *= 0.5; c.vr *= 0.5; }
    if (Math.random() < dt * 30) sparks.push({ x: c.x, y: c.y, vx: rnd(-30, 30), vy: rnd(-60, 0), life: 0.3, max: 0.3, col: '#ffb347', size: 2 });
  }
  cigs = cigs.filter(c => c.life > 0);
  for (const s of stamps) s.t += dt;
  stamps = stamps.filter(s => s.t < 0.9);
  for (const f of floats) { f.life -= dt; f.y -= 26 * dt; }
  floats = floats.filter(f => f.life > 0);
  shake = Math.max(0, shake - dt);
  flash = Math.max(0, flash - dt * 3);
  if (duel) duel.pop = Math.max(0, duel.pop - dt * 8);
}

function step(dt) {
  camX = lerp(camX, P.x - viewW * (viewW < 420 ? 0.2 : 0.3), 1 - Math.exp(-dt * 5));
  if (state === 'play') {
    if (freeze > 0) { freeze -= dt; updateFx(dt * 0.15); return; }
    elapsed += dt;
    spawnT -= dt;
    const gangOn = npcs.some(n => n.group && n.state === 'free');
    if (!gangOn && elapsed >= nextGang) { spawnGang(); nextGang = elapsed + GANG_EVERY; }
    if (spawnT <= 0 && !gangOn) { spawnT = rnd(1.0, 1.7) * Math.max(0.5, 1 - diff() * 0.25); spawnAhead(); }
    if (duel) {
      duel.t += dt;
      if (duel.t > 0.4) duel.p -= duel.decay * dt; // a moment to react before they push back
      if (duel.p >= 1) endDuel(true);
      else if (duel.p <= 0) endDuel(false);
    }
    updatePlayer(dt);
    updateNPCs(dt);
    updateFx(dt);
    // heartbeat tick when you're about to pass out
    if (P.lungs < 1.5 && Math.floor(elapsed * 2) !== lastTick) { lastTick = Math.floor(elapsed * 2); SFX.tick(); }
    if (P.lungs <= 0) return finish('faint');
  } else {
    updateFx(dt);
  }
}

// ---------- drawing ----------
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function circ(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function star(x, y, spikes, ro, ri, rot) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 ? ri : ro, a = rot + (i * Math.PI) / spikes;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

// upper floors of the arcade building: iron window grilles, AC units, laundry, vertical shop signs
function drawUpperFloors(topY) {
  const SEG = 240;
  const i0 = Math.floor(camX / SEG) - 1, i1 = Math.ceil((camX + viewW) / SEG) + 1;
  for (let i = i0; i <= i1; i++) {
    const sx = i * SEG;
    ctx.fillStyle = hash(i, 7) < 50 ? '#3a3548' : '#332f42'; ctx.fillRect(sx, topY, SEG, -topY + 1);
    ctx.fillStyle = 'rgba(255,255,255,.04)';
    for (let y = -8; y > topY; y -= 8) ctx.fillRect(sx, y, SEG, 1); // tiled facade
    for (let f = 0; -(f + 1) * 84 > topY - 84; f++) {
      const fy = -(f + 1) * 84 + 14;
      for (let w = 0; w < 2; w++) {
        const wx = sx + 34 + w * 104, lit = hash(i * 3 + w, f) < 45;
        ctx.fillStyle = lit ? '#ffd98a' : '#4a4560'; ctx.fillRect(wx, fy, 68, 48);
        if (lit) { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(wx + 4, fy + 4, 20, 40); }
        // iron grille sticking out of the window
        ctx.strokeStyle = '#6d6a78'; ctx.lineWidth = 2; ctx.strokeRect(wx - 5, fy - 5, 78, 58);
        for (let b = 1; b < 6; b++) line(wx - 5 + b * 13, fy - 5, wx - 5 + b * 13, fy + 53);
        if (hash(i + w * 11, f * 5) < 45) {
          ctx.fillStyle = '#d8d3c7'; ctx.fillRect(wx + 44, fy + 56, 30, 18);
          ctx.fillStyle = '#9a958a'; for (let k = 0; k < 3; k++) ctx.fillRect(wx + 47, fy + 59 + k * 5, 24, 2);
          ctx.fillStyle = 'rgba(140,200,230,.5)'; ctx.fillRect(wx + 58, fy + 74, 2, 6); // AC drip
        }
        if (hash(i * 7 + w, f + 3) < 22) {
          ctx.strokeStyle = '#9a958a'; ctx.lineWidth = 1; line(wx - 5, fy + 30, wx + 73, fy + 30);
          const cols = ['#e2554a', '#5a8ac9', '#f2efe8', '#f2a33a'];
          for (let k = 0; k < 4; k++) { ctx.fillStyle = cols[(k + f) % 4]; ctx.fillRect(wx + 2 + k * 18, fy + 31, 12, 15); }
        }
      }
    }
    // vertical signboard, the classic Taiwanese 直式招牌
    const s = SHOPS[((i * 3 + 1) % SHOPS.length + SHOPS.length) % SHOPS.length];
    const vx = sx + 206, vtop = Math.max(topY + 16, -300), vbot = -14;
    if (vbot - vtop > 70) {
      ctx.fillStyle = s.c; rr(vx, vtop, 30, vbot - vtop, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; rr(vx + 3, vtop + 3, 24, vbot - vtop - 6, 2); ctx.stroke();
      ctx.fillStyle = '#6d6a78'; ctx.fillRect(vx - 8, vtop + 10, 8, 3); ctx.fillRect(vx - 8, vbot - 14, 8, 3);
      ctx.fillStyle = s.t; ctx.font = `18px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const chars = [...s.n], room = Math.min(26, (vbot - vtop - 12) / chars.length);
      chars.forEach((ch, k) => ctx.fillText(ch, vx + 15, vtop + 8 + room * (k + 0.5)));
    }
  }
}

function drawBackground() {
  const topY = 400 - viewH;
  if (topY < 0) drawUpperFloors(topY);
  ctx.fillStyle = C.ceiling; ctx.fillRect(camX, 0, viewW, 60);
  const SEG = 240;
  const i0 = Math.floor(camX / SEG) - 1, i1 = Math.ceil((camX + viewW) / SEG) + 1;
  ctx.fillStyle = C.tube;
  for (let i = i0; i <= i1; i++) { rr(i * SEG + 80, 46, 90, 6, 3); ctx.fill(); }
  for (let i = i0; i <= i1; i++) {
    const sx = i * SEG;
    const s = SHOPS[((i * 5) % SHOPS.length + SHOPS.length) % SHOPS.length];
    ctx.fillStyle = C.wall; ctx.fillRect(sx, 60, SEG, 240);
    ctx.fillStyle = s.c; rr(sx + 36, 70, SEG - 52, 36, 4); ctx.fill();
    ctx.fillStyle = s.t; ctx.font = `22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s.n, sx + 36 + (SEG - 52) / 2, 89);
    ctx.fillStyle = C.glass; ctx.fillRect(sx + 44, 118, SEG - 64, 182);
    ctx.fillStyle = C.glassIn; ctx.fillRect(sx + 44 + (SEG - 64) * 0.6, 130, 40, 170);
    ctx.fillStyle = C.shelf;
    for (let k = 0; k < 3; k++) ctx.fillRect(sx + 54, 160 + k * 40, (SEG - 64) * 0.5, 5);
  }
  // floor
  ctx.fillStyle = C.floor; ctx.fillRect(camX, 300, viewW, 100);
  ctx.strokeStyle = C.floorLine; ctx.lineWidth = 1.5;
  for (const y of [318, 345, 376]) line(camX, y, camX + viewW, y);
  for (let x = Math.floor(camX / 52) * 52 - 52; x < camX + viewW + 52; x += 52) line(x, 300, x - 24, 400);
  for (let i = i0; i <= i1; i++) {
    const sx = i * SEG;
    ctx.fillStyle = C.pillarShade; ctx.fillRect(sx - 2, 60, 34, 262);
    ctx.fillStyle = C.pillar; ctx.fillRect(sx, 60, 26, 260);
  }
}

// the jagged "being zapped" burst behind a target
function drawBurst(n, power) {
  const cx = n.x, cy = FLOOR_Y - 62, t = performance.now() / 1000;
  const s = 0.75 + 0.45 * power + (reduceMotion ? 0 : Math.sin(t * 30) * 0.04);
  const gold = clean > 0;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(s, s);
  const g = ctx.createRadialGradient(0, 0, 8, 0, 0, 82);
  g.addColorStop(0, '#fffbe0'); g.addColorStop(0.45, gold ? '#ffd23f' : '#ffb347'); g.addColorStop(1, gold ? '#ff9a2f' : '#ff4f8f');
  ctx.fillStyle = g;
  star(0, 0, 14, 84, 52, reduceMotion ? 0 : t * 0.8);
  ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = gold ? '#ff7a00' : '#ff2e6d'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  star(0, 0, 10, 46, 30, reduceMotion ? 0 : -t * 1.2);
  ctx.fill();
  ctx.restore();
  // lightning
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2; ctx.lineJoin = 'miter';
  for (let b = 0; b < 3; b++) {
    const a = (reduceMotion ? b * 2.1 : rnd(0, Math.PI * 2)), r0 = 18, r1 = 70 * s;
    ctx.beginPath();
    for (let k = 0; k <= 4; k++) {
      const r = lerp(r0, r1, k / 4), j = k % 2 ? 9 : -9;
      ctx.lineTo(cx + Math.cos(a) * r + Math.cos(a + Math.PI / 2) * j, cy + Math.sin(a) * r + Math.sin(a + Math.PI / 2) * j);
    }
    ctx.stroke();
  }
}

function drawSilhouette(n) {
  const t = performance.now() / 1000;
  const flail = reduceMotion ? 0.4 : Math.sin(t * 22 + n.id * 9);
  const jit = reduceMotion ? 0 : rnd(-1.5, 1.5);
  const xray = !reduceMotion && Math.floor(t * 14 + n.id * 5) % 3 === 0; // classic cartoon electrocution flash
  const dark = '#15131c', look = n.look;
  const body = xray ? dark : look.body, pants = xray ? dark : look.pants, skin = xray ? dark : look.skin, hair = xray ? dark : look.hair;
  const la = [-22 - flail * 6, -92 + flail * 8], ra = [22 + flail * 6, -94 - flail * 8];
  ctx.save(); ctx.translate(n.x + jit, FLOOR_Y); ctx.globalAlpha = n.alpha; ctx.lineCap = 'round';
  ctx.strokeStyle = pants; ctx.lineWidth = 8;
  line(-4, -32, -14 - flail * 3, -2); line(4, -32, 14 + flail * 3, -2);
  ctx.fillStyle = body; rr(-12, -68, 24, 40, 7); ctx.fill();
  ctx.strokeStyle = body; ctx.lineWidth = 7;
  line(-8, -60, la[0], la[1]); line(8, -60, ra[0], ra[1]);
  ctx.fillStyle = skin; circ(la[0], la[1], 4); circ(ra[0], ra[1], 4);
  // hair standing straight up
  ctx.fillStyle = hair; ctx.beginPath();
  for (let i = 0; i <= 12; i++) { const a = Math.PI * (1.08 + i * 0.07), r = i % 2 ? 15 : 25; ctx.lineTo(Math.cos(a) * r, -84 + Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = skin; circ(0, -84, 15);
  if (xray) {
    // skeleton flashes through
    ctx.strokeStyle = '#f4f1ea'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -85, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#f4f1ea'; circ(-4, -86, 2.6); circ(4, -86, 2.6);
    line(0, -74, 0, -32);
    for (let k = 0; k < 3; k++) line(-8, -62 + k * 8, 8, -62 + k * 8);
    line(-8, -60, la[0], la[1]); line(8, -60, ra[0], ra[1]);
    line(-4, -32, -14 - flail * 3, -2); line(4, -32, 14 + flail * 3, -2);
  } else {
    // shocked face: wide eyes, open mouth
    ctx.fillStyle = '#fff'; circ(-5, -87, 4); circ(5, -87, 4);
    ctx.fillStyle = '#1b1b22'; circ(-5, -87, 1.4); circ(5, -87, 1.4);
    ctx.fillStyle = '#5a1f1f'; ctx.beginPath(); ctx.ellipse(0, -77, 3.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function shade(hex, f) {
  const v = parseInt(hex.slice(1), 16);
  const c = k => Math.round(((v >> k) & 255) * f);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
// side-view hair, facing +x: a cap of hair above the forehead plus the back of the head down to the nape
function drawHair(style, col, cy, r, capCol) {
  ctx.fillStyle = col;
  const ring = (a0, a1, ri) => { ctx.beginPath(); ctx.arc(0, cy, r + 0.6, a0, a1); ctx.arc(0, cy, ri, a1, a0, true); ctx.closePath(); ctx.fill(); };
  if (style === 'cap') {
    ring(Math.PI * 0.86, Math.PI * 1.1, r - 3.5);
    ctx.fillStyle = capCol; ctx.beginPath(); ctx.arc(0, cy - 2, r + 1, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
    rr(r * 0.35, cy - 5, r * 0.95, 4, 2); ctx.fill(); // brim facing forward
    return;
  }
  ring(Math.PI * 0.86, Math.PI * 1.1, r - 3.5); // back of the head
  if (style === 'balding') return;               // bald on top, hair only at the back
  // hairline: 'crop' sits high, 'part' sweeps a little lower at the front, 'fringe' has bangs down to the brow
  const front = style === 'fringe' ? 1.97 : style === 'part' ? 1.94 : 1.9;
  ctx.beginPath(); ctx.arc(0, cy, r + 0.6, Math.PI * 1.06, Math.PI * front); ctx.closePath(); ctx.fill();
}

function drawNPC(n) {
  const look = n.look, dir = n.dir;
  const walking = isWalking(n) || n.state === 'flee' || n.state === 'leaving';
  const ks = kidScale(n);
  ctx.save(); ctx.globalAlpha = n.alpha;
  ctx.translate(n.x, FLOOR_Y); ctx.scale(dir * ks, ks);
  ctx.lineCap = 'round';
  const sw = Math.sin(n.phase) * (walking ? 10 : 0);
  ctx.strokeStyle = look.pants; ctx.lineWidth = 8;
  line(-4, -32, -4 + sw, -6); line(4, -32, 4 - sw, -6);
  ctx.fillStyle = '#1b1b22'; rr(-8 + sw, -6, 13, 6, 2.5); ctx.fill(); rr(0 - sw, -6, 13, 6, 2.5); ctx.fill(); // heel flush with the back of each trouser leg
  const lift = n.lift || 0, oy = -4 * lift;
  const armCol = look.tank ? shade(look.skin, 0.9) : shade(look.body, 0.8);
  if (n.state !== 'flee') {
    ctx.strokeStyle = look.tank ? shade(look.skin, 0.82) : shade(look.body, 0.72); ctx.lineWidth = 6.5;
    line(-3, -58 + oy, -6 - sw * 0.5, -36 + oy);
    ctx.fillStyle = shade(look.skin, 0.85); circ(-6 - sw * 0.5, -35 + oy, 3.2);
  }
  ctx.fillStyle = look.body; rr(-12, -66 + oy, 24, 38 + 4 * lift, 7); ctx.fill();
  if (look.tank) {
    // sleeveless vest: bare shoulders, two straps
    ctx.fillStyle = look.skin; rr(-12, -66 + oy, 24, 7, 6); ctx.fill();
    ctx.fillStyle = look.body; ctx.fillRect(-7, -66 + oy, 3, 8); ctx.fillRect(4, -66 + oy, 3, 8);
  }
  if (look.uniform) { ctx.fillStyle = '#2a4a7a'; ctx.fillRect(-2, -64 + oy, 4, 10); }
  const idle = n.cyc === 'idle', lighting = n.cyc === 'light';
  const up = isDecoy(n) ? lift : lighting ? 1 : idle ? 0.55 : n.puff;
  let hx = lerp(10, 12, up), hy = lerp(-34, -72, up) + oy;
  // lollipop: the hand holds the bottom of the stick, so the candy (not the stick) reaches the mouth
  let cbx = 0, cby = 0;
  if (n.type === 'candy') {
    // the candy rises in front of the face to mouth height, then slides straight into the mouth;
    // the hand holds the far end of a rigid stick that tips from upright to level
    const u1 = Math.min(1, lift / 0.6), u2 = Math.max(0, (lift - 0.6) / 0.4), a = lerp(-Math.PI / 2, -Math.PI, u1), L = 11;
    cbx = lerp(17, 8, u2); cby = lerp(-57, -74, u1) + oy;
    hx = cbx - Math.cos(a) * L; hy = cby - Math.sin(a) * L;
  }
  // boba: the cup stays below the chin, only the straw reaches the mouth
  if (n.type === 'boba') { hx = lerp(10, 14, lift); hy = lerp(-36, -58, lift) + oy; }
  // lighting up: cigarette in the mouth, hand holds the lighter upright under its tip
  if (lighting) { hx = 21; hy = -58 + oy; }
  ctx.strokeStyle = armCol; ctx.lineWidth = 7;
  if (n.state !== 'flee') line(4, -58 + oy, hx, hy);
  ctx.fillStyle = look.skin;
  if (n.state !== 'flee') circ(hx, hy, 3.5);
  if (idle && n.state === 'free') {
    // scrolling on the phone, not smoking yet
    ctx.fillStyle = '#22252e'; rr(hx - 1, hy - 9, 8, 13, 2); ctx.fill();
    ctx.fillStyle = '#8fd3ff'; ctx.fillRect(hx + 0.5, hy - 7.5, 5, 9);
  } else if (lighting) {
    const my = -74 + oy;
    ctx.strokeStyle = '#f2efe8'; ctx.lineWidth = 2.5; line(11, my, 23, my + 1);
    ctx.fillStyle = '#c9302c'; rr(hx - 3, hy - 12, 6, 11, 1.5); ctx.fill();
    ctx.fillStyle = '#9aa0a8'; ctx.fillRect(hx - 3, hy - 13, 6, 2);
    const f = reduceMotion ? 1 : 0.8 + Math.random() * 0.4;
    ctx.fillStyle = 'rgba(255,170,60,.5)'; circ(hx + 1, hy - 17, 6 * f);
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(hx + 1, hy - 17, 2.2, 4 * f, 0, 0, Math.PI * 2); ctx.fill();
  } else if (n.hasCig) {
    ctx.strokeStyle = '#f2efe8'; ctx.lineWidth = 2.5; line(hx + 1, hy - 1, hx + 10, hy - 3);
    if (lift > 0.2) { ctx.fillStyle = `rgba(255,140,60,${0.35 * lift})`; circ(hx + 11, hy - 3, 9 * lift); }
    ctx.fillStyle = lift > 0.2 ? '#ffd23f' : '#ff7a2f'; circ(hx + 11, hy - 3, 2.4 + n.puff * 1.2);
  } else if (n.type === 'candy') {
    // a rigid lollipop: the stick keeps its length and just tips over, from pointing up to pointing into the mouth.
    // drawn before the head, so once the candy is in the mouth the face covers it and only the stick end shows
    ctx.strokeStyle = '#f2efe8'; ctx.lineWidth = 2.5; line(hx, hy, cbx, cby);
    ctx.fillStyle = '#ffb347'; circ(cbx, cby, 4.5);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cbx, cby, 2.3, 0, Math.PI * 1.5); ctx.stroke();
  } else if (n.type === 'boba') {
    ctx.fillStyle = '#c99a6b'; rr(hx - 4, hy - 4, 11, 15, 3); ctx.fill();
    ctx.fillStyle = '#f2efe8'; ctx.fillRect(hx - 4, hy - 4, 11, 2);
    ctx.fillStyle = '#3a2418'; circ(hx, hy + 7, 1.6); circ(hx + 4, hy + 8, 1.6);
  }
  const hy0 = -82 + oy;
  const tilt = idle && n.state === 'free' ? 0.22 : 0; // looking down at the phone
  if (tilt) { ctx.save(); ctx.translate(0, hy0); ctx.rotate(tilt); ctx.translate(0, -hy0); }
  ctx.fillStyle = look.skin; circ(0, hy0, 15);
  drawHair(look.style || 'crop', look.hair, hy0, 15, look.cap);
  ctx.strokeStyle = '#1b1b22'; ctx.fillStyle = '#1b1b22'; ctx.lineWidth = 1.8;
  if (n.angry > 0.3 || (duel && duel.rivals.includes(n))) {
    line(3, hy0 - 6, 11, hy0 - 3); circ(7, hy0 + 1, 2);
    ctx.strokeStyle = '#6b2b2b'; line(6, hy0 + 8, 12, hy0 + 7);
  } else if (n.state === 'flee') {
    ctx.fillStyle = '#fff'; circ(7, hy0, 4); ctx.fillStyle = '#1b1b22'; circ(8, hy0, 1.5);
    ctx.fillStyle = '#5a1f1f'; ctx.beginPath(); ctx.ellipse(10, hy0 + 9, 2.2, 3.2, 0, 0, Math.PI * 2); ctx.fill();
  } else if (n.fear > 0.3) {
    ctx.fillStyle = '#fff'; circ(7, hy0, 4); ctx.fillStyle = '#1b1b22'; circ(8, hy0, 1.5);
    ctx.fillStyle = '#5a1f1f'; ctx.beginPath(); ctx.ellipse(10, hy0 + 9, 1.8, 2.2, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    circ(7, hy0, 1.8);
    ctx.strokeStyle = '#6b3b2b'; line(7, hy0 + 8, 12, hy0 + 8);
  }
  if (tilt) ctx.restore();
  if (n.state === 'flee') {
    // running off with both hands on the head
    ctx.strokeStyle = armCol; ctx.lineWidth = 6.5;
    ctx.beginPath(); ctx.moveTo(4, -58 + oy); ctx.lineTo(18, hy0 + 2); ctx.lineTo(8, hy0 - 15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4, -58 + oy); ctx.lineTo(-17, hy0 + 2); ctx.lineTo(-7, hy0 - 15); ctx.stroke();
    ctx.fillStyle = look.skin; circ(8, hy0 - 15, 3.6); circ(-7, hy0 - 15, 3.6);
  }
  if (n.type === 'boba' && n.state !== 'flee') {
    // straw from the cup lid: upright at rest, tipped into the mouth when sipping
    ctx.strokeStyle = '#f2efe8'; ctx.lineWidth = 2.2;
    line(hx + 2, hy - 4, lerp(hx + 3, 11, lift), lerp(hy - 16, -75 + oy, lift));
  }
  if (n.type === 'candy' && n.state !== 'flee') {
    // pursed lips around the stick, so it clearly goes into the mouth
    if (cbx < 14) {
      const k = clamp((14 - cbx) / 6, 0, 1);
      ctx.strokeStyle = '#f2efe8'; ctx.lineWidth = 2.5; line(12 + 2 * (1 - k), cby, hx, hy);
    }
  }
  if (n.boss) {
    // 大哥: shades and a gold chain
    ctx.fillStyle = '#111'; rr(1, hy0 - 4, 13, 6, 2); ctx.fill();
    ctx.strokeStyle = '#ffcf3f'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(2, -64 + oy, 8, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }
  if (n.fear > 0.35 || n.state === 'flee') {
    ctx.fillStyle = '#7fd0ef';
    const t = (performance.now() / 400 + n.id) % 1;
    circ(-10, hy0 - 8 + t * 14, 2.6); circ(-14, hy0 - 2 + ((t + 0.5) % 1) * 14, 2);
  }
  ctx.restore();
}

function drawPlayer() {
  const glaring = !!P.glaring || !!duel;
  const bob = P.moving ? Math.abs(Math.sin(P.phase)) * 2 : 0;
  ctx.save(); ctx.translate(P.x, FLOOR_Y - bob); ctx.scale(heroFace(), 1);
  ctx.lineCap = 'round';
  if (clean > 0) {
    const g = ctx.createRadialGradient(0, -60, 10, 0, -60, 80);
    g.addColorStop(0, 'rgba(255,207,63,.55)'); g.addColorStop(1, 'rgba(255,207,63,0)');
    ctx.fillStyle = g; circ(0, -60, 80);
  }
  const sw = Math.sin(P.phase) * (P.moving ? 10 : 0);
  ctx.strokeStyle = '#2f3448'; ctx.lineWidth = 8;
  line(-4, -32, -4 + sw, -6); line(4, -32, 4 - sw, -6);
  ctx.fillStyle = '#5a3a28'; rr(-8 + sw, -6, 14, 6, 2.5); ctx.fill(); rr(0 - sw, -6, 14, 6, 2.5); ctx.fill(); // heel flush with the back of each trouser leg
  ctx.fillStyle = '#e2554a'; rr(-22, -64, 14, 30, 5); ctx.fill();
  ctx.fillStyle = '#f4f1ea'; rr(-12, -68, 24, 40, 7); ctx.fill();
  ctx.fillStyle = '#2a6fb0'; ctx.beginPath(); ctx.moveTo(4, -66); ctx.lineTo(9, -48); ctx.lineTo(4, -42); ctx.lineTo(0, -48); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#cfc8ba'; ctx.lineWidth = 7;
  const phx = glaring ? 14 : -4 + Math.sin(P.phase) * -6, phy = glaring ? -48 : -36;
  line(glaring ? 2 : -2, -60, phx, phy);
  ctx.fillStyle = '#f2c7a0'; circ(phx, phy, 3.5);
  const hy = -88;
  ctx.fillStyle = P.cough > 0 && !glaring ? '#d9d2a4' : '#f2c7a0'; circ(0, hy, 18);
  drawHair('part', '#2a211c', hy, 18);
  const ex = 8, ey = hy - 1;
  if (glaring) {
    ctx.strokeStyle = '#1b1b22'; ctx.lineWidth = 3.2; line(1, ey - 9, 15, ey - 4);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, 5.5, 3.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = clean > 0 ? '#ff9a2f' : C.glare; circ(ex + 2, ey, 2);
    ctx.strokeStyle = '#7a3b2b'; ctx.lineWidth = 1.8; line(9, hy + 9, 15, hy + 8);
  } else if (P.cough > 0) {
    ctx.strokeStyle = '#1b1b22'; ctx.lineWidth = 2; line(ex - 3, ey - 3, ex + 3, ey + 3); line(ex - 3, ey + 3, ex + 3, ey - 3);
  } else {
    ctx.fillStyle = '#1b1b22'; circ(ex, ey, 2);
    ctx.strokeStyle = '#7a3b2b'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(11, hy + 6, 3.5, 0.2, Math.PI * 0.8); ctx.stroke();
  }
  ctx.restore();
}

function beam(x1, y1, x2, y2, col, glow, w) {
  const t = performance.now();
  const wob = reduceMotion ? 0 : Math.sin(t / 35) * 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = glow; ctx.lineWidth = w * 2.6 + wob; line(x1, y1, x2, y2);
  ctx.strokeStyle = col; ctx.lineWidth = w; line(x1, y1, x2, y2);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.5, w * 0.35); line(x1, y1, x2, y2);
  // energy running down the beam
  ctx.fillStyle = '#ffffff';
  for (let k = 0; k < 6; k++) {
    const u = ((t / 260) + k / 6) % 1;
    const px = lerp(x1, x2, u), py = lerp(y1, y2, u);
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore();
  }
}
function impact(x, y, col) {
  const t = performance.now() / 1000;
  ctx.fillStyle = '#fff6b0'; star(x, y, 8, 20, 7, reduceMotion ? 0 : t * 6); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#fff'; circ(x, y, 5);
}

function drawGauge(n) {
  const x = n.x, y = FLOOR_Y - 158;
  const w = 70;
  // icon + arrow pointing at the target, like a lock-on tag
  ctx.fillStyle = clean > 0 ? C.sign : C.glare;
  ctx.beginPath(); ctx.moveTo(x - 6, y + 12); ctx.lineTo(x + 6, y + 12); ctx.lineTo(x, y + 22); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(31,29,43,.9)'; rr(x - w / 2 - 3, y - 7, w + 6, 16, 8); ctx.fill();
  ctx.strokeStyle = clean > 0 ? C.sign : C.glare; ctx.lineWidth = 2; ctx.stroke();
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, clean > 0 ? '#ffe680' : '#ff8ab4'); g.addColorStop(1, clean > 0 ? '#ff9a2f' : '#ff3f7f');
  ctx.fillStyle = g; rr(x - w / 2, y - 4, w * clamp(n.meter, 0, 1), 10, 5); ctx.fill();
  ctx.fillStyle = clean > 0 ? C.sign : C.glare; circ(x - w / 2 - 12, y + 1, 12);
  ctx.fillStyle = '#fff'; ctx.font = `14px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('瞪', x - w / 2 - 12, y + 2);
}

function drawDuelUI() {
  const n = duel.target, x = n.x, y = FLOOR_Y - 172;
  const w = 110, pop = 1 + duel.pop * 0.12;
  ctx.save(); ctx.translate(x, y - 34); ctx.scale(pop, pop);
  ctx.fillStyle = '#ff3f7f'; rr(-40, -16, 80, 30, 15); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-6, 13); ctx.lineTo(6, 13); ctx.lineTo(0, 22); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; rr(-40, -16, 80, 30, 15); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `18px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(duel.rivals.length > 1 ? `連打！×${duel.rivals.length}` : '連打！', 0, 0);
  ctx.restore();
  ctx.fillStyle = 'rgba(31,29,43,.92)'; rr(x - w / 2 - 3, y - 7, w + 6, 18, 9); ctx.fill();
  ctx.fillStyle = '#7a3a2a'; rr(x - w / 2, y - 4, w, 12, 6); ctx.fill();
  ctx.fillStyle = C.sign; rr(x - w / 2, y - 4, w * clamp(duel.p, 0, 1), 12, 6); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 7, 2, 18);
}

function render() {
  const W = cv.width, H = cv.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = C.facade; ctx.fillRect(0, 0, W, H);
  let sx = 0, sy = 0;
  if (shake > 0 && !reduceMotion) { sx = rnd(-7, 7) * shake; sy = rnd(-7, 7) * shake; }
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * scale * (sx - camX), dpr * scale * (viewH - 400 + sy));
  drawBackground();

  const vis = n => n.x > camX - 80 && n.x < camX + viewW + 80;
  const charging = n => (n.state === 'free' && ((P.glaring === n && !isDecoy(n) && n.meter > 0.06) || inDuel(n))) || (n.state === 'zapped' && n.zapT < 0.35);
  for (const n of npcs) if (vis(n) && charging(n)) drawBurst(n, n.state === 'zapped' ? 1 - n.zapT * 2.5 : clamp(n.meter, 0, 1));
  for (const n of npcs) {
    if (!vis(n)) continue;
    if (charging(n)) drawSilhouette(n); else drawNPC(n);
  }
  if (state !== 'title') drawPlayer();

  for (const p of parts) {
    if (p.x + p.r < camX || p.x - p.r > camX + viewW) continue;
    ctx.fillStyle = `rgba(${C.smoke},${p.a.toFixed(3)})`; circ(p.x, p.y, p.r);
  }
  // beams
  const eyeX = P.x + 10 * heroFace(), eyeY = FLOOR_Y - 89;
  if (duel) {
    for (const r of duel.rivals) {
      if (r === duel.target) continue;
      beam(r.x + r.dir * 8, headY(r) - 1, eyeX, eyeY, '#ffd23f', 'rgba(255,190,40,.35)', 5);
    }
    const t = duel.target;
    beam(eyeX, eyeY, t.x, headY(t), clean > 0 ? '#ffd23f' : '#ff5c9a', clean > 0 ? 'rgba(255,170,40,.4)' : 'rgba(255,63,127,.35)', 8);
    beam(t.x + t.dir * 8, headY(t) + 4, eyeX, eyeY + 2, '#ffd23f', 'rgba(255,190,40,.35)', 5);
    impact(lerp(eyeX, t.x, 0.55), lerp(eyeY, headY(t), 0.55), '#ff7a2f');
  } else if (P.glaring) {
    const n = P.glaring;
    const big = clean > 0;
    beam(eyeX, eyeY, n.x, headY(n), big ? '#ffd23f' : '#ff5c9a', big ? 'rgba(255,170,40,.4)' : 'rgba(255,63,127,.35)', big ? 13 : 8);
    impact(n.x, headY(n), big ? '#ff7a00' : '#ff2e6d');
  }
  for (const n of npcs) if (n.backT > 0 && n.state === 'free' && vis(n)) beam(n.x + n.dir * 8, headY(n), eyeX, eyeY, '#ffd23f', 'rgba(255,190,40,.35)', 5);
  for (const n of npcs) if (n.state === 'free' && vis(n) && !isDecoy(n) && (n.meter > 0.01) && !inDuel(n)) drawGauge(n);
  for (const n of npcs) if (isDecoy(n) && n.state === 'free' && n.mistake > 0.05 && vis(n)) {
    ctx.font = `26px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.strokeText('？', n.x, headY(n) - 36); ctx.fillStyle = C.text; ctx.fillText('？', n.x, headY(n) - 36);
  }
  if (duel) drawDuelUI();
  // warning when someone smoking is coming up behind you
  const sneak = npcs.find(n => n.mode === 'pass' && n.state === 'free' && n.cyc === 'smoke' && n.x < P.x - 20);
  if (sneak && state === 'play') {
    const pulse = reduceMotion ? 1 : 1 + 0.08 * Math.sin(performance.now() / 90);
    ctx.save(); ctx.translate(camX + 92, FLOOR_Y - 190); ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(31,29,43,.9)'; rr(-82, -15, 164, 30, 15); ctx.fill();
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.font = `15px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('◀ 後面有人邊走邊抽！', 0, 1);
    ctx.restore();
  }
  if (lock && !P.glaring && canGlare(lock)) {
    ctx.strokeStyle = C.glare; ctx.lineWidth = 2.5; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(lock.x, headY(lock), 24, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  // flying cigarettes and sparks
  for (const c of cigs) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
    ctx.fillStyle = '#f2efe8'; ctx.fillRect(-6, -1.5, 12, 3);
    ctx.fillStyle = '#c98a4a'; ctx.fillRect(-6, -1.5, 4, 3);
    ctx.restore();
  }
  for (const s of sparks) { ctx.globalAlpha = clamp(s.life / 0.3, 0, 1); ctx.fillStyle = s.col; ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size); }
  ctx.globalAlpha = 1;
  // 熄！ stamps
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const s of stamps) {
    const k = s.t < 0.14 ? lerp(2.4, 1, s.t / 0.14) : 1 + Math.max(0, 0.05 - (s.t - 0.14)) ;
    ctx.save(); ctx.translate(s.x, s.y); ctx.scale(k, k); ctx.rotate(-0.12);
    ctx.globalAlpha = clamp((0.9 - s.t) / 0.25, 0, 1);
    ctx.font = `46px ${FONT}`;
    ctx.lineWidth = 9; ctx.strokeStyle = C.ink; ctx.strokeText(s.text, 0, 0);
    ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.strokeText(s.text, 0, 0);
    ctx.fillStyle = C.glare; ctx.fillText(s.text, 0, 0);
    ctx.restore();
  }
  for (const f of floats) {
    ctx.globalAlpha = clamp(f.life / 0.4, 0, 1);
    ctx.font = `${f.size}px ${FONT}`;
    ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  if (flash > 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(255,255,255,${(flash * 0.5).toFixed(3)})`; ctx.fillRect(0, 0, W, H);
  }
}

// ---------- HUD ----------
const cellsEl = $('#cells');
for (let i = 0; i < 9; i++) cellsEl.appendChild(document.createElement('i'));
const cellEls = [...cellsEl.children];
function hud() {
  const full = Math.ceil(P.lungs - 0.001);
  cellEls.forEach((c, i) => c.classList.toggle('on', i < full));
  cellsEl.classList.toggle('low', P.lungs <= 2 && clean <= 0);
  cellsEl.classList.toggle('full', clean > 0);
  const clock = $('#clock');
  clock.textContent = '撐了 ' + fmtTime(elapsed);
  clock.classList.toggle('late', P.lungs < 1.5);
  $('#outCount').textContent = stats.out;
  $('#score').textContent = stats.score.toLocaleString();
  const cur = ending(stats.out), next = ENDINGS.find(x => x.min > stats.out);
  const prog = next ? clamp((stats.out - cur.min) / (next.min - cur.min), 0, 1) * 100 : 100;
  $('#progFill').style.width = prog + '%'; $('#progDot').style.left = prog + '%';
  $('#quotaLbl').textContent = next ? `再 ${next.min - stats.out} 根：${next.title}` : `最高稱號：${cur.title}`;
  $('#hint').hidden = !(state === 'play' && stats.out === 0 && elapsed > 0.4 && elapsed < 12);
}

// ---------- flow ----------
const titleScreen = $('#titleScreen'), endScreen = $('#endScreen'), hudEl = $('#hud');
function loadBest() { try { return JSON.parse(localStorage.getItem('baiyan-best') || 'null'); } catch { return null; } }
function saveBest(b) { try { localStorage.setItem('baiyan-best', JSON.stringify(b)); } catch {} }
function showBestOnTitle() {
  const b = loadBest();
  $('#bestTitle').textContent = b ? `個人最佳：熄 ${b.out} 根・${b.title}` : '';
}

function start() {
  SFX.init();
  reset();
  state = 'play';
  titleScreen.hidden = true; endScreen.hidden = true; hudEl.hidden = false;
  ptr.down = false; lock = null;
}
function ending(out) {
  let e = ENDINGS[0];
  for (const x of ENDINGS) if (out >= x.min) e = x;
  return e;
}
function finish(kind) {
  state = 'end'; ptr.down = false; lock = null; duel = null;
  SFX.humOff();
  hudEl.hidden = true; $('#hint').hidden = true;
  const e = ending(stats.out);
  const tier = ENDINGS.indexOf(e);
  tier >= 2 ? SFX.clear() : SFX.fail();
  $('#endTitle').textContent = e.title;
  $('#endBadge').textContent = '肺活量歸零';
  $('#endTime').textContent = fmtTime(elapsed);
  const fainted = false;
  const stars = Math.max(0, tier - 1);
  $('#endStars').innerHTML = `${'★'.repeat(stars)}<span class="off">${'★'.repeat(3 - stars)}</span>`;
  $('#endOut').textContent = stats.out;
  $('#endScore').textContent = stats.score.toLocaleString();
  $('#endDuel').textContent = stats.duels;
  $('#endMiss').textContent = stats.miss + ' 次';
  const next = ENDINGS.find(x => x.min > stats.out);
  $('#endNote').textContent = e.text + (next && !fainted ? `（熄 ${next.min} 根可解鎖「${next.title}」）` : '');
  let best = loadBest(), note;
  if (!best || stats.out > best.out) { best = { out: stats.out, title: e.title, time: elapsed }; saveBest(best); note = '新的個人最佳！'; }
  else note = `個人最佳：熄 ${best.out} 根・${best.title}`;
  $('#endBest').textContent = note;
  endScreen.hidden = false;
  $('#againBtn').focus({ preventScroll: true });
}
$('#startBtn').addEventListener('click', start);
$('#againBtn').addEventListener('click', start);
$('#menuBtn').addEventListener('click', () => { endScreen.hidden = true; titleScreen.hidden = false; state = 'title'; showBestOnTitle(); });
const muteBtn = $('#mute');
const muteLabel = () => { muteBtn.textContent = SFX.muted ? '音效 關' : '音效 開'; };
muteBtn.addEventListener('click', e => { e.stopPropagation(); SFX.init(); SFX.toggle(); muteLabel(); });
muteBtn.addEventListener('pointerdown', e => e.stopPropagation());
muteLabel();
showBestOnTitle();

// ---------- input ----------
function setPtr(e) {
  const r = stage.getBoundingClientRect();
  ptr.x = (e.clientX - r.left) / scale + camX;
  ptr.y = (e.clientY - r.top) / scale - (viewH - 400);
}
stage.addEventListener('pointerdown', e => {
  if (state !== 'play' || e.target.closest('button')) return;
  e.preventDefault();
  SFX.init();
  setPtr(e); ptr.down = true;
  if (duel) { duelTap(); ptr.glareMode = true; return; }
  lock = headAt(ptr.x, ptr.y);
  // a press that starts on a face stays a glare press
  ptr.glareMode = !!lock;
});
stage.addEventListener('pointermove', e => {
  setPtr(e);
  if (state !== 'play' || duel || !ptr.down) return;
  if (lock) { if (Math.hypot(lock.x - ptr.x, headY(lock) - ptr.y) > 75) lock = null; }
  else if (ptr.glareMode) lock = headAt(ptr.x, ptr.y);
});
addEventListener('pointerup', () => { ptr.down = false; lock = null; });
addEventListener('pointercancel', () => { ptr.down = false; lock = null; });
stage.addEventListener('contextmenu', e => e.preventDefault());
// iOS: block the long-press loupe / text selection / callout while holding on the game
stage.addEventListener('touchstart', e => { if (!e.target.closest('button, .overlay')) e.preventDefault(); }, { passive: false });
document.addEventListener('selectstart', e => e.preventDefault());
stage.addEventListener('dblclick', e => e.preventDefault());
addEventListener('keydown', e => {
  if (state !== 'play') return;
  if (e.code === 'ArrowRight') keys.right = true;
  if (e.code === 'Space') {
    e.preventDefault();
    SFX.init();
    if (duel) { if (!e.repeat) duelTap(); return; }
    if (lock) return;
    let best = null, bd = Infinity;
    for (const n of npcs) if (canGlare(n) && Math.abs(n.x - P.x) < bd) { bd = Math.abs(n.x - P.x); best = n; }
    lock = best;
  }
});
addEventListener('keyup', e => {
  if (e.code === 'ArrowRight') keys.right = false;
  if (e.code === 'Space' && !duel) lock = null;
});
addEventListener('blur', () => { ptr.down = false; lock = null; keys.right = false; SFX.humOff(); });

// test hook for automated play-throughs (file:// with ?debug only)
if (location.protocol === 'file:' && location.search.includes('debug')) window.__g = () => ({ P, npcs, camX, scale, viewH, duel, stats, state, clean, lock });

// ---------- loop ----------
reset();
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  step(dt);
  render();
  if (state === 'play') hud();
  requestAnimationFrame(frame);
}
(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(frame));
})();
