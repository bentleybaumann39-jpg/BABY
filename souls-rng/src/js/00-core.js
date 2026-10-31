'use strict';
// =====================================================================
//  SOULS RNG — core helpers, audio, timers
// =====================================================================
const TAU = Math.PI * 2;
const $ = id => document.getElementById(id);
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _v1 = V3(), _v2 = V3(), _v3 = V3(), _v4 = V3();
const _q1 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
const _c1 = new THREE.Color();
const UP = V3(0, 1, 0);

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function dist2(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz); }
function fmt(n) {
  n = Math.floor(n);
  if (n < 1e6) return n.toLocaleString('en-US');
  const u = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M']];
  for (const [v, s] of u) if (n >= v) { const x = n / v; return (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)).replace(/\.0+$/, '') + s; }
  return String(n);
}
function oddsText(o) { return '1 in ' + fmt(o); }
function hexToCss(h) { return '#' + h.toString(16).padStart(6, '0'); }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------------- game-time timers (pause with the game) ----------------
const TIMERS = [];
function later(t, fn) { TIMERS.push({ t, fn }); }
function tickTimers(dt) {
  for (let i = TIMERS.length - 1; i >= 0; i--) {
    const T = TIMERS[i];
    if (!T) continue;
    T.t -= dt;
    if (T.t <= 0) { TIMERS.splice(i, 1); try { T.fn(); } catch (e) { console.error(e); } }
  }
}
function clearTimers() { TIMERS.length = 0; }

// =====================================================================
//  AUDIO — all procedural, no files
// =====================================================================
const AU = {
  ctx: null, master: null, sfx: null, mus: null, noiseBuf: null, last: {},
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    try { this.ctx = new C(); } catch (e) { return; }
    const ctx = this.ctx;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
    comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.connect(comp);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.mus = ctx.createGain(); this.mus.connect(this.master);
    const len = ctx.sampleRate; const b = ctx.createBuffer(1, len, ctx.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = b;
    this.applyVol();
  },
  applyVol() { if (!this.ctx) return; this.master.gain.value = S.set.vol; this.mus.gain.value = S.set.music ? 0.32 : 0; },
  ok(key, gap) { if (!this.ctx) return false; const t = performance.now(); if (this.last[key] && t - this.last[key] < gap) return false; this.last[key] = t; return true; },
  tone(f, type, dur, vol, o = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + (o.slide || dur));
    if (o.detune) osc.detune.value = o.detune;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + (o.att || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (o.lp) { const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o.lp; node.connect(f2); node = f2; }
    node.connect(g); g.connect(o.dest || this.sfx); osc.start(t0); osc.stop(t0 + dur + 0.05);
  },
  noise(dur, vol, o = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.f || 1200, t0); f.Q.value = o.q || 0.8;
    if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t0 + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + (o.att || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || this.sfx); src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
  },
  // --- sound library ---
  gun(id) {
    if (!this.ok('gun', 28)) return;
    if (id === 'ar') { this.noise(0.09, 0.22, { f: 2400, to: 500 }); this.tone(190, 'square', 0.07, 0.08, { to: 70 }); }
    else if (id === 'smg') { this.noise(0.06, 0.16, { f: 3200, to: 900 }); this.tone(260, 'square', 0.05, 0.06, { to: 120 }); }
    else if (id === 'shotgun') { this.noise(0.28, 0.42, { f: 1600, to: 120 }); this.tone(90, 'sawtooth', 0.22, 0.2, { to: 35 }); }
    else if (id === 'sniper') { this.noise(0.4, 0.4, { f: 4000, to: 150 }); this.tone(420, 'square', 0.12, 0.14, { to: 60 }); this.tone(60, 'sine', 0.5, 0.3, { to: 30 }); }
    else if (id === 'rocket') { this.noise(0.5, 0.3, { f: 600, to: 2400, type: 'bandpass' }); this.tone(110, 'sawtooth', 0.35, 0.14, { to: 300 }); }
    else this.tone(880, 'sawtooth', 0.06, 0.08, { to: 400 });
  },
  hit(crit) { if (!this.ok('hit', 35)) return; this.tone(crit ? 1500 : 900, 'square', 0.05, crit ? 0.1 : 0.06, { to: crit ? 2200 : 500 }); },
  kill() { if (!this.ok('kill', 45)) return; this.noise(0.2, 0.25, { f: 900, to: 120 }); this.tone(220, 'triangle', 0.18, 0.12, { to: 60 }); },
  boom(big) { if (!this.ok('boom', 60)) return; this.noise(big ? 1.1 : 0.55, big ? 0.7 : 0.45, { f: big ? 900 : 1400, to: 40 }); this.tone(big ? 70 : 110, 'sine', big ? 0.9 : 0.4, big ? 0.6 : 0.4, { to: 28 }); },
  hurt() { if (!this.ok('hurt', 120)) return; this.tone(140, 'sawtooth', 0.22, 0.25, { to: 50 }); this.noise(0.15, 0.2, { f: 700, to: 200 }); },
  shieldHit() { if (!this.ok('shit', 100)) return; this.tone(1200, 'sine', 0.15, 0.12, { to: 600 }); },
  ult() { this.tone(180, 'sawtooth', 0.8, 0.25, { to: 900, lp: 2400 }); this.tone(360, 'square', 0.6, 0.12, { to: 1800, delay: 0.05, lp: 3000 }); this.noise(0.9, 0.3, { f: 300, to: 6000, type: 'bandpass' }); },
  coin() { if (!this.ok('coin', 40)) return; this.tone(1320, 'sine', 0.06, 0.1); this.tone(1980, 'sine', 0.1, 0.09, { delay: 0.045 }); },
  heal() { if (!this.ok('heal', 120)) return; this.tone(660, 'sine', 0.2, 0.1, { to: 1320 }); },
  tick(i) { this.tone(500 + (i % 7) * 90, 'triangle', 0.04, 0.07); },
  reveal(tier) {
    const base = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880, 988, 1047][tier] || 440;
    [0, 4, 7, 12].forEach((s, i) => this.tone(base * Math.pow(2, s / 12), 'triangle', 0.6 + tier * 0.08, 0.14, { delay: i * 0.08 }));
    if (tier >= 3) this.noise(1.2, 0.25, { f: 800, to: 8000, type: 'bandpass' });
    if (tier >= 6) { this.tone(base / 2, 'sawtooth', 1.6, 0.18, { lp: 1600 }); this.tone(55, 'sine', 1.8, 0.4, { to: 30 }); }
  },
  roar() { this.noise(1.6, 0.6, { f: 400, to: 90 }); this.tone(70, 'sawtooth', 1.4, 0.4, { to: 40, lp: 600 }); this.tone(95, 'square', 1.2, 0.2, { to: 50, lp: 500, delay: 0.1 }); },
  jump() { if (!this.ok('jump', 80)) return; this.tone(300, 'sine', 0.12, 0.07, { to: 520 }); },
  reload() { this.tone(500, 'square', 0.04, 0.05); this.tone(700, 'square', 0.04, 0.05, { delay: 0.25 }); },
  zap() { if (!this.ok('zap', 60)) return; this.noise(0.12, 0.18, { f: 5000, to: 1500, type: 'highpass' }); this.tone(1800, 'sawtooth', 0.08, 0.05, { to: 300 }); },
  freeze() { if (!this.ok('frz', 90)) return; this.tone(2400, 'sine', 0.3, 0.07, { to: 1200 }); this.noise(0.3, 0.12, { f: 6000, type: 'highpass' }); },
  portal() { this.tone(200, 'sine', 1.2, 0.2, { to: 800 }); this.tone(300, 'triangle', 1.2, 0.12, { to: 1200, delay: 0.1 }); },
  click() { this.tone(900, 'square', 0.03, 0.05); },
  enemyShot() { if (!this.ok('es', 70)) return; this.tone(420, 'square', 0.1, 0.05, { to: 180 }); },
  slam() { if (!this.ok('slam', 120)) return; this.noise(0.5, 0.45, { f: 500, to: 50 }); this.tone(60, 'sine', 0.5, 0.45, { to: 25 }); },
  beam() { if (!this.ok('beam', 200)) return; this.tone(110, 'sawtooth', 0.6, 0.12, { to: 220, lp: 1500 }); },
  spawn() { if (!this.ok('spawn', 160)) return; this.noise(0.3, 0.08, { f: 300, to: 100 }); }
};

// ---------------- procedural music ----------------
const MUSIC = {
  on: false, step: 0, next: 0, timer: null, cfg: null, intensity: 0,
  SCALES: { minor: [0, 2, 3, 5, 7, 8, 10], phryg: [0, 1, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], major: [0, 2, 4, 5, 7, 9, 11], penta: [0, 3, 5, 7, 10], harm: [0, 2, 3, 5, 7, 8, 11], whole: [0, 2, 4, 6, 8, 10] },
  play(cfg) {
    if (!AU.ctx) return;
    this.cfg = Object.assign({ root: 45, scale: 'minor', tempo: 110, arp: 0.6, lead: 'triangle' }, cfg || {});
    if (!this.on) { this.on = true; this.step = 0; this.next = AU.ctx.currentTime + 0.1; this.timer = setInterval(() => this.tick(), 60); }
  },
  stop() { this.on = false; clearInterval(this.timer); this.timer = null; },
  note(n) { return 440 * Math.pow(2, (n - 69) / 12); },
  tick() {
    if (!this.on || !AU.ctx) return;
    const ctx = AU.ctx, c = this.cfg, spb = 60 / (c.tempo * (1 + this.intensity * 0.12)) / 4;
    while (this.next < ctx.currentTime + 0.25) { this.sched(this.step, this.next); this.next += spb; this.step++; }
  },
  sched(s, t) {
    const c = this.cfg, sc = this.SCALES[c.scale] || this.SCALES.minor, d = Math.max(0, t - AU.ctx.currentTime), I = this.intensity;
    const bar = Math.floor(s / 16) % 4, prog = [0, 5, 3, 4][bar], st = s % 16;
    const deg = i => { const o = Math.floor(i / sc.length); return c.root + sc[((i % sc.length) + sc.length) % sc.length] + o * 12; };
    if (st % 8 === 0) AU.tone(this.note(deg(prog) - 12), 'sawtooth', 0.42, 0.09, { delay: d, lp: 500 + I * 500, dest: AU.mus });
    if (st === 4 || st === 12) AU.tone(this.note(deg(prog + 4) - 12), 'sawtooth', 0.2, 0.05, { delay: d, lp: 600, dest: AU.mus });
    if (Math.random() < c.arp) { const i = prog + [0, 2, 4, 7, 4, 2, 9, 7][st % 8]; AU.tone(this.note(deg(i) + 12), c.lead, 0.18, 0.035, { delay: d, dest: AU.mus, lp: 3200 }); }
    if (st === 0) [0, 2, 4].forEach(k => AU.tone(this.note(deg(prog + k)), 'triangle', 1.6, 0.022, { delay: d, att: 0.25, dest: AU.mus }));
    if (I > 0.3) {
      if (st % 4 === 0) AU.tone(150, 'sine', 0.18, 0.22 * I, { to: 40, slide: 0.12, delay: d, dest: AU.mus });
      if (st % 4 === 2) AU.noise(0.04, 0.05 * I, { f: 7000, type: 'highpass', delay: d, dest: AU.mus });
      if (st === 4 || st === 12) AU.noise(0.14, 0.09 * I, { f: 1800, type: 'bandpass', delay: d, dest: AU.mus });
    }
  }
};
