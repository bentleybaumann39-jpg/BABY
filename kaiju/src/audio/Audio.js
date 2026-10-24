// Audio engine: buses, a city convolution reverb, positional one-shots with speed-of-sound
// delay and air absorption, looping emitters (rotors, jets, beam), layered ambience, and
// a generative score whose intensity follows the rampage.
import * as S from './Synth.js';

const C = 343; // speed of sound, m/s

export class Audio {
  constructor(app) {
    this.app = app;
    this.ctx = null;
    this.buf = {};
    this.ready = false;
    this.loops = new Map();
    this.musicI = 0;
    this.musicTarget = 0.15;
    this.vol = { master: 0.9, music: 0.6, sfx: 0.9 };
    this.lastFoot = 0;
    this.recent = 0;
    this.throttle = new Map();
  }

  // AudioContext can only start after a user gesture.
  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { return; }
      this._graph();
      this._build();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  _graph() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.connect(this.master);
    this.amb = ctx.createGain(); this.amb.connect(this.master);
    this.verb = ctx.createConvolver();
    this.verbIn = ctx.createGain(); this.verbIn.gain.value = 0.9;
    this.verbIn.connect(this.verb); this.verb.connect(this.sfx);
    const sr = ctx.sampleRate;
    const ir = S.cityIR(sr, 7);
    const b = ctx.createBuffer(2, ir[0].length, sr);
    b.copyToChannel(ir[0], 0); b.copyToChannel(ir[1], 1);
    this.verb.buffer = b;
    // music reverb: a longer, darker hall
    this.mverb = ctx.createConvolver();
    const ir2 = S.cityIR(sr, 11, 5.5);
    const b2 = ctx.createBuffer(2, ir2[0].length, sr);
    b2.copyToChannel(ir2[0], 0); b2.copyToChannel(ir2[1], 1);
    this.mverb.buffer = b2;
    this.mverbIn = ctx.createGain(); this.mverbIn.gain.value = 0.5;
    this.mverbIn.connect(this.mverb); this.mverb.connect(this.music);
    this.setVolumes(this.app.settings);
  }

  _mk(chs) {
    const ctx = this.ctx;
    const arr = Array.isArray(chs) ? chs : [chs];
    const b = ctx.createBuffer(arr.length, arr[0].length, ctx.sampleRate);
    arr.forEach((c, i) => b.copyToChannel(c, i));
    return b;
  }

  // Synthesis is spread over idle slices so the first click never hitches.
  _build() {
    const sr = this.ctx.sampleRate;
    const jobs = [
      ['ui', () => S.blip(sr, 1200, 0.05)], ['ui2', () => S.blip(sr, 660, 0.12)],
      ['thump0', () => S.thump(sr, 1, 1)], ['thump1', () => S.thump(sr, 2, 1.1)], ['thump2', () => S.thump(sr, 3, 0.9)],
      ['crumble0', () => S.crumble(sr, 4, 3.5, 0.4)], ['crumble1', () => S.crumble(sr, 5, 2.5, 0.8)], ['crumble2', () => S.crumble(sr, 6, 4.5, 0.2)],
      ['glass', () => S.glass(sr, 8)], ['expl0', () => S.explosion(sr, 9, 1)], ['expl1', () => S.explosion(sr, 10, 0.5)],
      ['rumble', () => S.rumble(sr, 12, 10)], ['whoosh', () => S.whoosh(sr, 13, 0.9)], ['whooshL', () => S.whoosh(sr, 14, 1.6, 120, 700)],
      ...Object.keys(S.VOICES).map((id, i) => ['roar_' + id, () => S.roar(sr, S.VOICES[id], 21 + i)]),
      ['beam', () => S.beamLoop(sr, 30)], ['charge', () => S.charge(sr, 31)],
      ['cannon', () => S.gunshot(sr, 40, 1.4)], ['mg', () => S.gunshot(sr, 41, 0.15)], ['rotor', () => S.rotorLoop(sr, 42)], ['jet', () => S.jetLoop(sr, 43)],
      ['siren', () => S.siren(sr)], ['police', () => S.policeLoop(sr)],
      ['city', () => S.cityLoop(sr, 50)], ['ocean', () => S.oceanLoop(sr, 51)], ['screams', () => S.screams(sr, 52)],
      ['taiko', () => S.taiko(sr, 60, 1)], ['taikoHi', () => S.taiko(sr, 61, 1.7)],
    ];
    let i = 0;
    const step = () => {
      const t0 = performance.now();
      while (i < jobs.length && performance.now() - t0 < 12) {
        const [k, f] = jobs[i++];
        try { this.buf[k] = this._mk(f()); } catch (e) { console.warn('audio synth failed', k, e); }
      }
      if (i < jobs.length) setTimeout(step, 0);
      else { this.ready = true; this._ambience(); }
    };
    step();
  }

  setVolumes(s) {
    this.vol = { master: s.master, music: s.music, sfx: s.sfx };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.master, t, 0.05);
    this.music.gain.setTargetAtTime(s.music * 0.55, t, 0.05);
    this.sfx.gain.setTargetAtTime(s.sfx, t, 0.05);
    this.amb.gain.setTargetAtTime(s.sfx * 0.6, t, 0.05);
  }

  pause(on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfx.gain.setTargetAtTime(on ? 0 : this.vol.sfx, t, 0.08);
    this.amb.gain.setTargetAtTime(on ? 0 : this.vol.sfx * 0.6, t, 0.08);
    this.music.gain.setTargetAtTime(this.vol.music * (on ? 0.25 : 0.55), t, 0.2);
  }

  stopAll() {
    for (const [k, l] of this.loops) this._stopLoop(k);
    this.musicTarget = 0.15;
    this.inPlay = false;
  }

  // ------------------------------------------------------------------ playback

  _listener() { return this.app.camera.position; }

  // One-shot at a world position. Distant sounds arrive late, muffled and wetter.
  at(name, p, o = {}) {
    if (!this.ready || !this.buf[name] || !p) return null;
    const ctx = this.ctx;
    const L = this._listener();
    const d = Math.hypot(p.x - L.x, p.y - L.y, p.z - L.z);
    const ref = o.ref || 80;
    const g0 = (o.gain ?? 1) * Math.min(1.4, ref / Math.max(ref * 0.5, d));
    if (g0 < 0.004) return null;
    const src = ctx.createBufferSource();
    src.buffer = this.buf[name];
    src.playbackRate.value = (o.rate ?? 1) * (o.vary === false ? 1 : 0.92 + Math.random() * 0.16);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.max(700, 18000 * Math.exp(-d / 900));
    const g = ctx.createGain();
    g.gain.value = g0;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(lp); lp.connect(g);
    if (pan) {
      // project onto the camera's right axis for left/right placement
      const e = this.app.camera.matrixWorld.elements;
      pan.pan.value = Math.max(-0.9, Math.min(0.9, ((p.x - L.x) * e[0] + (p.z - L.z) * e[2]) / Math.max(30, d)));
      g.connect(pan); pan.connect(this.sfx);
    } else g.connect(this.sfx);
    const wet = ctx.createGain();
    wet.gain.value = Math.min(0.9, (o.wet ?? 0.25) + d / 2500);
    g.connect(wet); wet.connect(this.verbIn);
    const delay = o.nodelay ? 0 : Math.min(2.5, d / C);
    src.start(ctx.currentTime + delay + (o.offset || 0));
    return src;
  }

  flat(name, o = {}) {
    if (!this.ready || !this.buf[name]) return null;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.buf[name];
    src.playbackRate.value = o.rate ?? 1;
    const g = ctx.createGain();
    g.gain.value = o.gain ?? 1;
    src.connect(g); g.connect(o.bus || this.sfx);
    if (o.wet) { const w = ctx.createGain(); w.gain.value = o.wet; g.connect(w); w.connect(this.verbIn); }
    src.start(ctx.currentTime + (o.delay || 0));
    return src;
  }

  // Looping emitter updated each frame by its owner (rotor, jet, beam, sirens...).
  loop(key, name, p, o = {}) {
    if (!this.ready || !this.buf[name]) return;
    let l = this.loops.get(key);
    const ctx = this.ctx;
    if (!l) {
      const src = ctx.createBufferSource();
      src.buffer = this.buf[name];
      src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      const g = ctx.createGain(); g.gain.value = 0;
      const pan = ctx.createStereoPanner();
      src.connect(lp); lp.connect(g); g.connect(pan); pan.connect(o.bus || this.sfx);
      const w = ctx.createGain(); w.gain.value = 0.2; g.connect(w); w.connect(this.verbIn);
      src.start(ctx.currentTime, Math.random() * src.buffer.duration);
      l = { src, lp, g, pan, alive: true };
      this.loops.set(key, l);
    }
    const t = ctx.currentTime;
    let gain = o.gain ?? 1, pv = 0, f = 16000;
    if (p) {
      const L = this._listener();
      const d = Math.hypot(p.x - L.x, p.y - L.y, p.z - L.z);
      const ref = o.ref || 80;
      gain *= Math.min(1.3, ref / Math.max(ref * 0.5, d));
      f = Math.max(600, 18000 * Math.exp(-d / 900));
      const e = this.app.camera.matrixWorld.elements;
      pv = Math.max(-0.9, Math.min(0.9, ((p.x - L.x) * e[0] + (p.z - L.z) * e[2]) / Math.max(30, d)));
    }
    l.g.gain.setTargetAtTime(gain, t, 0.08);
    l.lp.frequency.setTargetAtTime(f, t, 0.1);
    l.pan.pan.setTargetAtTime(pv, t, 0.1);
    if (o.rate) l.src.playbackRate.setTargetAtTime(o.rate, t, 0.1);
    l.seen = true;
  }

  _stopLoop(key) {
    const l = this.loops.get(key);
    if (!l) return;
    const t = this.ctx.currentTime;
    l.g.gain.setTargetAtTime(0, t, 0.15);
    try { l.src.stop(t + 0.8); } catch (e) { /* already stopped */ }
    this.loops.delete(key);
  }

  stopLoop(key) { if (this.loops.has(key)) this._stopLoop(key); }

  _limit(key, sec) {
    const now = performance.now();
    if ((this.throttle.get(key) || 0) > now) return false;
    this.throttle.set(key, now + sec * 1000);
    return true;
  }

  // ------------------------------------------------------------------ game vocabulary

  ui(kind) {
    if (!this.ctx) return;
    if (kind === 'click') this.flat('ui', { gain: 0.25, bus: this.master });
    else if (kind === 'upgrade') { this.flat('ui2', { gain: 0.4, bus: this.master }); this.flat('ui2', { gain: 0.3, rate: 1.5, delay: 0.08, bus: this.master }); }
    else if (kind === 'unlock') { this.flat('taiko', { gain: 0.8, bus: this.master }); this.flat('ui2', { gain: 0.4, rate: 2, delay: 0.2, bus: this.master }); }
  }

  roar(k, s = 1) {
    const name = 'roar_' + (S.VOICES[k.id] ? k.id : Object.keys(S.VOICES)[0]);
    const p = k.bonePos(k.meta.mouth || 'head');
    this.at(name, p, { gain: 1.6 * s, ref: 400, rate: 1 / Math.sqrt(k.scale), vary: false, wet: 0.45, nodelay: true });
    this.musicKick = 1;
  }
  roarMenu(id) { this.resume(); this.flat('roar_' + id, { gain: 0.6, wet: 0.5 }); }

  footstep(p, s, water) {
    if (water) { this.at('whooshL', p, { gain: 0.5 * s, ref: 200, rate: 0.6 }); return; }
    this.at('thump' + Math.floor(Math.random() * 3), p, { gain: 1.3 * s, ref: 260, rate: 0.85 + Math.random() * 0.2, wet: 0.3 });
  }
  swing(k, name) { this.at(name === 'heavy' ? 'whooshL' : 'whoosh', k.pos.clone().setY(k.height * 0.6), { gain: 0.9, ref: 200, nodelay: true }); }
  impact(p, s) { this.at('crumble' + Math.floor(Math.random() * 3), p, { gain: 0.7 + s, ref: 220, rate: 1.1 }); this.at('thump1', p, { gain: 0.8 * s, ref: 200, rate: 1.3 }); }
  slam(p, s) { this.at('thump0', p, { gain: 2 * s, ref: 400, rate: 0.7 }); this.at('expl1', p, { gain: 0.8 * s, ref: 300, rate: 0.6 }); this.at('crumble2', p, { gain: 0.8, ref: 300 }); }
  crumble(p, s) { if (this._limit('crumble', 0.18)) this.at('crumble' + Math.floor(Math.random() * 3), p, { gain: s, ref: 180 }); }
  glassAt(p) { if (this._limit('glass', 0.3)) this.at('glass', p, { gain: 0.7, ref: 160 }); }
  collapse(p, s) { this.at('rumble', p, { gain: 1.5 * s + 0.5, ref: 600, wet: 0.5 }); this.at('crumble2', p, { gain: 1.2, ref: 500, offset: 0.4 }); this.musicKick = Math.max(this.musicKick || 0, 0.7); }
  explosion(p, s) { if (this._limit('expl', 0.06)) this.at(s > 0.5 ? 'expl0' : 'expl1', p, { gain: 1.2 + s, ref: 300 + s * 300 }); }
  whoosh(p, s) { this.at('whooshL', p, { gain: s, ref: 200 }); }
  cannon(p) { this.at('cannon', p, { gain: 1.2, ref: 250 }); }
  mg(p) { if (this._limit('mg' + Math.round(p.x), 0.07)) this.at('mg', p, { gain: 0.6, ref: 120 }); }
  charge(k, on) { if (on) this.at('charge', k.bonePos(k.meta.mouth || 'head'), { gain: 1.2, ref: 300, nodelay: true, vary: false }); }
  beam(k, on) { this.beamOn = on; }
  sting(kind) {
    if (!this.ctx || !this.ready) return;
    const t = this.ctx.currentTime + 0.05;
    if (kind === 'landfall') { this._braam(t, 38, 5); this.flat('taiko', { gain: 0.9, bus: this.music }); this.flat('taiko', { gain: 0.8, bus: this.music, delay: 0.6 }); }
    if (kind === 'victory') this._chord(t, [50, 57, 62, 66], 6, 0.12);
    if (kind === 'defeat') this._braam(t, 31, 7, 0.6);
  }

  // ------------------------------------------------------------------ ambience and music

  _ambience() {
    if (!this.ctx) return;
    this.startMusic();
  }

  update(dt, play) {
    if (!this.ctx || !this.ready) return;
    this.inPlay = true;
    const k = play.kaiju;
    const cam = this.app.camera.position;
    const coast = play.world.city.coast;
    const nearSea = Math.max(0, Math.min(1, 1 - (coast - cam.z) / 600));
    this.loop('amb_city', 'city', null, { gain: 0.5 * (1 - nearSea * 0.6) * (1 - Math.min(0.8, play.threat / 4)), bus: this.amb });
    this.loop('amb_ocean', 'ocean', null, { gain: 0.15 + 0.6 * nearSea, bus: this.amb });
    const panic = Math.min(1, play.time / 20) * Math.min(1, (play.score.buildings + 2) / 6);
    this.loop('amb_screams', 'screams', null, { gain: 0.32 * panic * (1 - nearSea * 0.5), bus: this.amb });
    if (play.threat >= 1) this.loop('amb_siren', 'siren', { x: 0, y: 60, z: -400 }, { gain: 0.22, ref: 1500, bus: this.amb });
    // the thermal beam
    if (this.beamOn && k.special.on) this.loop('beam', 'beam', k.bonePos(k.meta.mouth || 'head'), { gain: 1.0, ref: 300 });
    else this.stopLoop('beam');
    // music intensity from what is happening
    const act = Math.min(1, (play.world.buildings.stats.chunksDestroyed - (this._lastChunks || 0)) / 8);
    this._lastChunks = play.world.buildings.stats.chunksDestroyed;
    this.recent = this.recent * Math.exp(-dt / 6) + act * 0.5;
    const combat = Math.min(1, this.recent * 0.6 + (k.special.on ? 0.4 : 0) + (k.hurtT > 0 ? 0.3 : 0));
    this.musicTarget = Math.min(1, 0.22 + 0.45 * combat + 0.08 * play.threat + (this.musicKick || 0) * 0.3);
    this.musicKick = Math.max(0, (this.musicKick || 0) - dt * 0.15);
    // retire loops nobody refreshed this frame
    for (const [key, l] of this.loops) {
      if (!l.seen && !key.startsWith('amb_') && key !== 'beam') this._stopLoop(key);
      l.seen = false;
    }
  }

  startMusic() {
    if (this.musicTimer || !this.ctx) return;
    this.beat = 0;
    this.nextT = this.ctx.currentTime + 0.1;
    this.bpm = 88;
    // D minor: i - VI - iv - V
    this.prog = [[38, 50, 53, 57], [34, 50, 53, 58], [31, 50, 55, 58], [33, 49, 52, 57]];
    this.musicTimer = setInterval(() => this._schedule(), 100);
  }

  _schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const spb = 60 / this.bpm / 2; // eighth notes
    this.musicI += (this.musicTarget - this.musicI) * 0.04;
    const I = this.musicI;
    while (this.nextT < ctx.currentTime + 0.35) {
      const b = this.beat, t = this.nextT;
      const bar = Math.floor(b / 8), inBar = b % 8;
      const chord = this.prog[Math.floor(bar / 2) % this.prog.length];
      if (inBar === 0 && bar % 2 === 0) this._pad(t, chord, spb * 16, 0.05 + 0.08 * I);
      if (I > 0.32) this._pluck(t, chord[0] - 12 + (inBar % 4 === 3 ? 7 : 0), spb * 0.9, 0.07 * Math.min(1, (I - 0.32) * 3));
      if (I > 0.5) {
        const pat = [1, 0, 0, 1, 0.6, 0, 1, 0];
        if (pat[inBar]) this.flat('taiko', { gain: 0.5 * pat[inBar] * Math.min(1, (I - 0.5) * 3), bus: this.music, delay: Math.max(0, t - ctx.currentTime), rate: 0.95 + Math.random() * 0.1 });
        if (I > 0.7 && inBar % 2 === 1) this.flat('taikoHi', { gain: 0.25, bus: this.music, delay: Math.max(0, t - ctx.currentTime) });
      }
      if (I > 0.78 && b % 32 === 0) this._braam(t, chord[0] - 12, 4.5, 0.5);
      this.beat++;
      this.nextT += spb;
    }
  }

  _osc(type, midi, t, dur, gain, dest, detune = 0) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.1);
    return g;
  }

  _pad(t, chord, dur, gain) {
    const ctx = this.ctx;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(700 + 1600 * this.musicI, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(400, t + dur);
    lp.Q.value = 0.7;
    const out = ctx.createGain(); out.gain.value = 1;
    lp.connect(out); out.connect(this.music); out.connect(this.mverbIn);
    for (const m of chord) {
      for (const dt of [-9, 7]) {
        const g = this._osc('sawtooth', m, t, dur, gain, lp, dt);
        g.gain.linearRampToValueAtTime(gain / chord.length, t + 1.4);
        g.gain.setValueAtTime(gain / chord.length, t + dur - 1.2);
        g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
      }
    }
  }

  _pluck(t, midi, dur, gain) {
    const ctx = this.ctx;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(180, t + dur);
    lp.connect(this.music); lp.connect(this.mverbIn);
    for (const [ty, dt] of [['sawtooth', -6], ['square', 5]]) {
      const g = this._osc(ty, midi, t, dur, gain, lp, dt);
      g.gain.linearRampToValueAtTime(gain, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
  }

  _braam(t, midi, dur, gain = 0.8) {
    const ctx = this.ctx;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(120, t); lp.frequency.exponentialRampToValueAtTime(1400, t + 0.6); lp.frequency.exponentialRampToValueAtTime(200, t + dur);
    const sh = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 2.5); }
    sh.curve = curve;
    lp.connect(sh); sh.connect(this.music); sh.connect(this.mverbIn);
    for (const m of [midi, midi + 7, midi + 12, midi - 12]) for (const dt of [-12, 0, 11]) {
      const g = this._osc('sawtooth', m, t, dur, gain, lp, dt);
      g.gain.linearRampToValueAtTime(gain * 0.09, t + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
  }

  _chord(t, notes, dur, gain) {
    const out = this.ctx.createGain(); out.connect(this.music); out.connect(this.mverbIn);
    for (const m of notes) {
      const g = this._osc('triangle', m, t, dur, gain, out);
      g.gain.linearRampToValueAtTime(gain, t + 1.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
  }
}
