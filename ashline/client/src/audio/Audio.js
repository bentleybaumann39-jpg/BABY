// Procedural audio: every sound is synthesised at load. HRTF-panned 3D one-shots with distance
// low-pass and speed-of-sound delay for gunfire, plus looping beds (wind, plane, ash roar).
const SR = 44100;

function rnd(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function noise(n, seed = 1) { const r = rnd(seed); const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = r() * 2 - 1; return a; }
// Simple biquad (RBJ) applied in place.
function biquad(x, type, f, q = 0.707, gainDb = 0) {
  const w = 2 * Math.PI * f / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q), A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y;
  }
  return x;
}
const env = (i, a, d, n) => { const t = i / SR; return t < a ? t / a : Math.exp(-(t - a) / d); };
function norm(x, peak = 0.9) { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= peak / m; return x; }
function mix(...arrs) { const n = Math.max(...arrs.map(a => a.length)); const o = new Float32Array(n); for (const a of arrs) for (let i = 0; i < a.length; i++) o[i] += a[i]; return o; }
function scale(x, g) { for (let i = 0; i < x.length; i++) x[i] *= g; return x; }
function tone(n, f0, f1, d, type = 'sin', seed = 1) { const o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / n; const f = f0 + (f1 - f0) * t; ph += 2 * Math.PI * f / SR; const s = type === 'sin' ? Math.sin(ph) : type === 'sq' ? Math.sign(Math.sin(ph)) : ((ph / Math.PI) % 2) - 1; o[i] = s * Math.exp(-i / SR / d); } return o; }

// ---------------------------------------------------------------- sound designs
function gunshot(cls, variant, seed) {
  const big = { pistol: 0.7, smg: 0.75, rifle: 1, heavyrifle: 1.15, sniper: 1.45, shotgun: 1.3 }[cls] || 1;
  if (variant === 'sup') {
    const n = SR * 0.35;
    const a = noise(n, seed); for (let i = 0; i < n; i++) a[i] *= env(i, 0.001, 0.03, n);
    biquad(a, 'bp', 900, 0.8); biquad(a, 'lp', 2500);
    const mech = noise(SR * 0.05, seed + 7); for (let i = 0; i < mech.length; i++) mech[i] *= env(i, 0.0005, 0.006); biquad(mech, 'hp', 3000);
    return norm(mix(a, scale(mech, 0.4)), 0.6);
  }
  if (variant === 'far') {
    const n = Math.floor(SR * (1.6 + big * 0.6));
    const a = noise(n, seed); for (let i = 0; i < n; i++) a[i] *= env(i, 0.004, 0.09 * big, n) * 0.8 + env(i, 0.06, 0.6 * big, n) * 0.25;
    biquad(a, 'lp', 900 / big); biquad(a, 'lp', 1400);
    const boom = tone(n, 70 * (1.2 / big), 40, 0.25 * big, 'sin');
    return norm(mix(a, scale(boom, 0.5)), 0.85);
  }
  const n = Math.floor(SR * (0.9 + big * 0.5));
  const crack = noise(n, seed); for (let i = 0; i < n; i++) crack[i] *= env(i, 0.0003, 0.012 * big, n);
  biquad(crack, 'hp', 1200);
  const body = noise(n, seed + 3); for (let i = 0; i < n; i++) body[i] *= env(i, 0.001, 0.05 * big, n);
  biquad(body, 'lp', 2600 / big); biquad(body, 'peak', 180, 1, 9);
  const thump = tone(n, 140 / big, 45, 0.07 * big);
  const tail = noise(n, seed + 9); for (let i = 0; i < n; i++) tail[i] *= env(i, 0.03, 0.35 * big, n) * 0.22;
  biquad(tail, 'lp', 1100); biquad(tail, 'hp', 120);
  const mech = noise(Math.floor(SR * 0.06), seed + 4); for (let i = 0; i < mech.length; i++) mech[i] *= env(i, 0.0005, 0.008); biquad(mech, 'bp', 3500, 2);
  return norm(mix(scale(crack, 0.9), body, scale(thump, 0.8), tail, scale(mech, 0.25)), 0.95);
}
function footstep(surf, seed) {
  const n = Math.floor(SR * 0.22);
  const a = noise(n, seed);
  for (let i = 0; i < n; i++) a[i] *= env(i, 0.002, surf === 'metal' ? 0.05 : 0.03, n);
  if (surf === 'grass') { biquad(a, 'bp', 2400, 0.7); }
  else if (surf === 'gravel') { const g = noise(n, seed + 1); for (let i = 0; i < n; i++) g[i] *= (rnd(seed + i)() > 0.93 ? 1 : 0.1) * env(i, 0.002, 0.05, n); biquad(g, 'bp', 3200, 1); for (let i = 0; i < n; i++) a[i] = a[i] * 0.3 + g[i]; biquad(a, 'lp', 6000); }
  else if (surf === 'wood') { biquad(a, 'bp', 500, 2); const t = tone(n, 190, 150, 0.04); for (let i = 0; i < n; i++) a[i] += t[i] * 0.6; }
  else if (surf === 'metal') { biquad(a, 'bp', 1800, 4); const t = tone(n, 640, 600, 0.08); for (let i = 0; i < n; i++) a[i] += t[i] * 0.3; }
  else if (surf === 'water') { biquad(a, 'bp', 900, 0.6); for (let i = 0; i < n; i++) a[i] *= 1 + Math.sin(i / 90) * 0.5; }
  else if (surf === 'rock') { biquad(a, 'bp', 1400, 1.4); }
  else { biquad(a, 'bp', 1100, 1.2); biquad(a, 'lp', 3500); }
  return norm(a, 0.7);
}
function click(f = 3000, d = 0.01, seed = 1) { const n = Math.floor(SR * 0.08); const a = noise(n, seed); for (let i = 0; i < n; i++) a[i] *= env(i, 0.0003, d); biquad(a, 'bp', f, 3); return norm(a, 0.6); }
function seqSounds(parts) { const n = Math.floor(SR * Math.max(...parts.map(p => p[0] + p[1].length / SR))); const o = new Float32Array(n); for (const [t, s, g = 1] of parts) { const off = Math.floor(t * SR); for (let i = 0; i < s.length && off + i < n; i++) o[off + i] += s[i] * g; } return o; }
function explosion(seed) {
  const n = SR * 3;
  const a = noise(n, seed); for (let i = 0; i < n; i++) a[i] *= env(i, 0.003, 0.5, n);
  biquad(a, 'lp', 700); biquad(a, 'lp', 900);
  const boom = tone(n, 60, 25, 0.6);
  const crack = noise(n, seed + 1); for (let i = 0; i < n; i++) crack[i] *= env(i, 0.0005, 0.03); biquad(crack, 'hp', 800);
  return norm(mix(a, scale(boom, 1.2), scale(crack, 0.6)), 0.95);
}
function loop(kind, seed) {
  const n = SR * 4;
  const a = noise(n, seed);
  if (kind === 'wind') { biquad(a, 'bp', 500, 0.5); for (let i = 0; i < n; i++) a[i] *= 0.6 + 0.4 * Math.sin(i / SR * 1.3) * Math.sin(i / SR * 0.37 + 1); }
  else if (kind === 'freefall') { biquad(a, 'bp', 900, 0.4); biquad(a, 'hp', 300); }
  else if (kind === 'plane') { const t = tone(n, 62, 62, 1e9, 'saw'); const t2 = tone(n, 93.5, 93.5, 1e9, 'saw'); biquad(a, 'lp', 300); for (let i = 0; i < n; i++) a[i] = a[i] * 0.6 + (t[i] * 0.4 + t2[i] * 0.25) * (0.8 + 0.2 * Math.sin(i / SR * 6)); biquad(a, 'lp', 800); }
  else if (kind === 'ash') { biquad(a, 'lp', 260); for (let i = 0; i < n; i++) a[i] *= 0.7 + 0.3 * Math.sin(i / SR * 0.9); }
  else if (kind === 'heart') { const o = new Float32Array(n); const beat = tone(SR * 0.2, 60, 40, 0.06); for (const t of [0, 0.25, 1, 1.25, 2, 2.25, 3, 3.25]) { const off = Math.floor(t * SR); for (let i = 0; i < beat.length; i++) o[off + i] += beat[i] * (t % 1 ? 0.6 : 1); } return norm(o, 0.8); }
  // crossfade loop seam
  const f = Math.floor(SR * 0.2);
  for (let i = 0; i < f; i++) { const t = i / f; a[i] = a[i] * t + a[n - f + i] * (1 - t); }
  return norm(a.subarray(0, n - f), 0.6);
}

// ---------------------------------------------------------------- engine
export class Audio {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null; this.buf = {}; this.loops = {}; this.ready = false;
  }

  async init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.amb = ctx.createGain(); this.amb.connect(this.master);
    this.applyVolume();
    this.settings.onChange(() => this.applyVolume());
    // reverb send (outdoor slap)
    this.verb = ctx.createConvolver();
    const ir = ctx.createBuffer(2, SR * 1.8, SR);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); const r = rnd(c + 5); for (let i = 0; i < d.length; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / d.length, 3) * (i < SR * 0.04 ? 0.2 : 1); }
    this.verb.buffer = ir;
    this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.22;
    this.verb.connect(this.verbGain).connect(this.sfx);
    await this.build();
    this.ready = true;
  }

  applyVolume() { if (!this.ctx) return; const s = this.settings; this.master.gain.value = s.master; this.sfx.gain.value = s.sfx; this.amb.gain.value = s.music * 0.9; }

  async build() {
    const B = (name, data) => { const b = this.ctx.createBuffer(1, data.length, SR); b.copyToChannel(data, 0); this.buf[name] = b; };
    const tasks = [];
    for (const cls of ['pistol', 'smg', 'rifle', 'heavyrifle', 'sniper', 'shotgun']) {
      tasks.push(() => B(`gun_${cls}`, gunshot(cls, 'near', cls.length * 13)));
      tasks.push(() => B(`gun_${cls}_far`, gunshot(cls, 'far', cls.length * 17)));
    }
    tasks.push(() => B('gun_sup', gunshot('rifle', 'sup', 3)));
    for (const s of ['grass', 'gravel', 'wood', 'metal', 'water', 'rock', 'concrete', 'dirt']) for (let v = 0; v < 3; v++) tasks.push(() => B(`step_${s}_${v}`, footstep(s, s.length * 31 + v * 7)));
    tasks.push(() => B('mag_out', click(1800, 0.02, 11)));
    tasks.push(() => B('mag_in', seqSounds([[0, click(2200, 0.015, 12)], [0.05, click(1200, 0.03, 13), 0.7]])));
    tasks.push(() => B('bolt', seqSounds([[0, click(2600, 0.02, 14)], [0.12, click(3200, 0.015, 15)]])));
    tasks.push(() => B('dry', click(4200, 0.006, 16)));
    tasks.push(() => B('equip', seqSounds([[0, click(1500, 0.03, 17), 0.6], [0.08, click(2800, 0.01, 18)]])));
    tasks.push(() => B('pickup', (() => { const a = noise(SR * 0.25, 19); for (let i = 0; i < a.length; i++) a[i] *= env(i, 0.02, 0.05); biquad(a, 'bp', 1600, 0.8); return norm(a, 0.5); })()));
    tasks.push(() => B('bandage', (() => { const a = noise(SR * 0.6, 20); for (let i = 0; i < a.length; i++) a[i] *= (0.5 + 0.5 * Math.sin(i / 400)) * env(i, 0.05, 0.3); biquad(a, 'hp', 2000); return norm(a, 0.5); })()));
    tasks.push(() => B('hitmark', norm(mix(click(5200, 0.004, 21), scale(tone(SR * 0.05, 2400, 2200, 0.01), 0.5)), 0.5)));
    tasks.push(() => B('headmark', norm(mix(click(6000, 0.005, 22), scale(tone(SR * 0.12, 1800, 1700, 0.04), 0.7)), 0.6)));
    tasks.push(() => B('killconfirm', norm(mix(tone(SR * 0.3, 120, 80, 0.08), scale(click(900, 0.02, 23), 0.6)), 0.7)));
    tasks.push(() => B('hurt', (() => { const a = noise(SR * 0.3, 24); for (let i = 0; i < a.length; i++) a[i] *= env(i, 0.002, 0.06); biquad(a, 'lp', 400); return norm(mix(a, tone(SR * 0.3, 90, 50, 0.08)), 0.8); })()));
    tasks.push(() => B('armor', norm(mix(tone(SR * 0.2, 1900, 1700, 0.03), scale(click(3000, 0.01, 25), 0.6)), 0.6)));
    tasks.push(() => B('boom', explosion(26)));
    tasks.push(() => B('whiz', (() => { const a = noise(SR * 0.15, 27); for (let i = 0; i < a.length; i++) a[i] *= Math.sin(Math.PI * i / a.length); biquad(a, 'bp', 3800, 3); return norm(a, 0.5); })()));
    tasks.push(() => B('horn', (() => { const n = SR * 1.6; const o = mix(tone(n, 220, 220, 1e9, 'saw'), scale(tone(n, 277, 277, 1e9, 'saw'), 0.7)); biquad(o, 'lp', 900); for (let i = 0; i < n; i++) o[i] *= Math.min(1, i / (SR * 0.1)) * Math.min(1, (n - i) / (SR * 0.3)); return norm(o, 0.4); })()));
    tasks.push(() => B('beep', norm(tone(SR * 0.1, 1400, 1400, 0.05, 'sq'), 0.25)));
    tasks.push(() => B('ui', click(2400, 0.008, 28)));
    tasks.push(() => B('chute', (() => { const a = noise(SR * 0.8, 29); for (let i = 0; i < a.length; i++) a[i] *= env(i, 0.01, 0.2) * (1 + Math.sin(i / 300)); biquad(a, 'lp', 1200); return norm(a, 0.7); })()));
    tasks.push(() => B('land', footstep('dirt', 99)));
    tasks.push(() => B('throw', (() => { const a = noise(SR * 0.3, 30); for (let i = 0; i < a.length; i++) a[i] *= Math.sin(Math.PI * i / a.length) ** 2; biquad(a, 'bp', 700, 0.7); return norm(a, 0.5); })()));
    tasks.push(() => B('smokehiss', (() => { const a = noise(SR * 3, 31); for (let i = 0; i < a.length; i++) a[i] *= env(i, 0.2, 1.5); biquad(a, 'hp', 2500); return norm(a, 0.4); })()));
    for (const k of ['wind', 'freefall', 'plane', 'ash', 'heart']) tasks.push(() => B(`loop_${k}`, loop(k, k.length * 3)));
    for (const t of tasks) { t(); await new Promise(r => setTimeout(r, 0)); }
  }

  setListener(cam) {
    if (!this.ctx) return;
    const L = this.ctx.listener, p = cam.position;
    const f = { x: -Math.sin(cam.rotation.y) * Math.cos(cam.rotation.x), y: Math.sin(cam.rotation.x), z: -Math.cos(cam.rotation.y) * Math.cos(cam.rotation.x) };
    if (L.positionX) { L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z; L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
    this.lp = p;
  }

  // 2D (non-positional) one-shot
  play(name, gain = 1, rate = 1) {
    if (!this.ready || !this.buf[name]) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.buf[name]; s.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = gain;
    s.connect(g).connect(this.sfx); s.start();
  }

  // 3D one-shot with distance attenuation, air absorption and optional speed-of-sound delay.
  at(name, x, y, z, { gain = 1, rate = 1, ref = 4, max = 600, delay = false, verb = 0.25 } = {}) {
    if (!this.ready || !this.buf[name] || !this.lp) return;
    const d = Math.hypot(x - this.lp.x, y - this.lp.y, z - this.lp.z);
    if (d > max) return;
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.buf[name]; s.playbackRate.value = rate * (0.97 + Math.random() * 0.06);
    const p = ctx.createPanner(); p.panningModel = d < 120 ? 'HRTF' : 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = 1; p.maxDistance = 10000;
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
    const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = Math.max(700, 20000 / (1 + d / 60));
    const g = ctx.createGain(); g.gain.value = gain;
    s.connect(lpf).connect(g).connect(p).connect(this.sfx);
    if (verb > 0) { const vg = ctx.createGain(); vg.gain.value = verb * Math.min(1, 0.3 + d / 150); g.connect(vg).connect(this.verb); }
    s.start(ctx.currentTime + (delay ? d / 343 : 0));
  }

  loop(name, gain) {
    if (!this.ready) return;
    let l = this.loops[name];
    if (!l) {
      if (gain <= 0.001) return;
      const s = this.ctx.createBufferSource(); s.buffer = this.buf[`loop_${name}`]; s.loop = true;
      const g = this.ctx.createGain(); g.gain.value = 0;
      s.connect(g).connect(name === 'heart' ? this.sfx : this.amb); s.start();
      l = this.loops[name] = { s, g };
    }
    l.g.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.15);
  }
  stopLoops() { for (const k in this.loops) this.loops[k].g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); }
}

export const GUN_SOUND = { pistol: 'pistol', smg: 'smg', rifle: 'rifle', heavyrifle: 'heavyrifle', sniper: 'sniper', shotgun: 'shotgun' };
