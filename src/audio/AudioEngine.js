// Web Audio engine: buses, zone reverb, silence-ducking (the Remainder's presence), HRTF positional
// sources relocated through doorways via sound propagation, ambience beds, sparse dynamic music.
import { LIBRARY, makeFootsteps, impulse, SR } from './Synth.js';

const AMB = {
  outdoor: [['loopRain', 0.5], ['loopWind', 0.35]],
  lobby: [['loopRoom', 0.35], ['loopHum', 0.12], ['loopRain', 0.08]],
  room: [['loopRoom', 0.3], ['loopHum', 0.06]],
  corridor: [['loopCorridor', 0.32], ['loopHum', 0.14]],
  hall: [['loopRoom', 0.25]],
  dead: [['loopRoom', 0.05]],
  anechoic: [],
  basement: [['loopBasement', 0.45], ['loopDrip', 0.25]],
  electrical: [['loopElectrical', 0.4], ['loopBasement', 0.25]],
  boiler: [['loopBasement', 0.35], ['loopDrip', 0.15]],
  cistern: [['loopBasement', 0.3], ['loopDrip', 0.6]],
};

export class AudioEngine {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.raw = {};
    this.buffers = {};
    this.ready = false;
    this.voices = 0;
    this.silence = 0;      // 0..1 how much the Remainder's presence mutes the world
    this.muffle = 0;       // 0..1 extra lowpass (hiding / death)
    this.zonePreset = null;
    this.ambActive = new Map();
    this.lastFieldCell = -1;
    this.timeouts = [];
  }

  // Synthesize everything (can happen before the AudioContext exists).
  async synthesize(onProgress) {
    const names = Object.keys(LIBRARY);
    let k = 0;
    for (const n of names) {
      this.raw[n] = LIBRARY[n].map((fn) => fn());
      k++;
      if (onProgress && k % 4 === 0) { onProgress(k / names.length); await new Promise((r) => setTimeout(r, 0)); }
    }
    const steps = makeFootsteps();
    for (const s of Object.keys(steps)) this.raw['step_' + s] = steps[s];
    this.irRaw = {};
    for (const p of ['outdoor', 'lobby', 'room', 'small', 'corridor', 'bathroom', 'hall', 'studio', 'dead', 'anechoic', 'stair', 'tunnel', 'basement', 'cistern']) this.irRaw[p] = impulse(p);
  }

  // Must be called from a user gesture.
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC({ latencyHint: 'interactive' });
    const mk = (n) => { const b = ctx.createBuffer(1, n.length, SR); b.copyToChannel(n, 0); return b; };
    for (const [k, list] of Object.entries(this.raw)) this.buffers[k] = list.map(mk);
    this.irs = {};
    for (const [k, [L, R]] of Object.entries(this.irRaw)) { const b = ctx.createBuffer(2, L.length, SR); b.copyToChannel(L, 0); b.copyToChannel(R, 1); this.irs[k] = b; }

    this.master = ctx.createGain();
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 4; this.comp.attack.value = 0.005; this.comp.release.value = 0.2;
    this.muffleFilter = ctx.createBiquadFilter(); this.muffleFilter.type = 'lowpass'; this.muffleFilter.frequency.value = 20000;
    this.master.connect(this.muffleFilter).connect(this.comp).connect(ctx.destination);

    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.amb = ctx.createGain(); this.ambDuck = ctx.createGain(); this.amb.connect(this.ambDuck).connect(this.master);
    this.music = ctx.createGain(); this.music.connect(this.master);
    this.voice = ctx.createGain(); this.voice.connect(this.master);
    this.ui = ctx.createGain(); this.ui.connect(this.master);
    this.self = ctx.createGain(); this.self.connect(this.master); // player body sounds (breath, heartbeat)

    // Reverb: two convolvers crossfaded on zone change; ducked by silence.
    this.revSend = ctx.createGain();
    this.revDuck = ctx.createGain();
    this.convA = ctx.createConvolver(); this.convB = ctx.createConvolver();
    this.revA = ctx.createGain(); this.revB = ctx.createGain(); this.revB.gain.value = 0;
    this.revSend.connect(this.convA).connect(this.revA).connect(this.revDuck);
    this.revSend.connect(this.convB).connect(this.revB).connect(this.revDuck);
    this.revDuck.connect(this.master);
    this.convA.buffer = this.irs.room; this.convB.buffer = this.irs.room;
    this.revActive = 'A';

    // Entity presence: tinnitus + heartbeat-driven layers
    this.tinnitus = this.loop('loopTinnitus', { bus: this.self, gain: 0 });
    // Music layers (sparse)
    this.mLow = this.loop('loopDroneLow', { bus: this.music, gain: 0 });
    this.mHigh = this.loop('loopDroneHigh', { bus: this.music, gain: 0 });
    this.mPulse = this.loop('loopPulse', { bus: this.music, gain: 0 });
    this.collage = null;

    this.applyVolumes();
    this.ready = true;
    this.listener = ctx.listener;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = this.game.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.get('masterVolume'), t, 0.05);
    this.sfx.gain.setTargetAtTime(s.get('sfxVolume'), t, 0.05);
    this.amb.gain.setTargetAtTime(s.get('ambienceVolume'), t, 0.05);
    this.music.gain.setTargetAtTime(s.get('musicVolume') * 0.6, t, 0.05);
  }

  pick(name) {
    const list = this.buffers[name];
    if (!list || !list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  // Non-positional sound.
  play(name, opts = {}) {
    if (!this.ready) return null;
    const b = typeof opts.variant === 'number' ? this.buffers[name]?.[opts.variant] : this.pick(name);
    if (!b) return null;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = (opts.rate ?? 1) * (opts.jitter ? 1 + (Math.random() - 0.5) * opts.jitter : 1);
    const g = ctx.createGain();
    g.gain.value = opts.gain ?? 1;
    src.connect(g).connect(opts.bus || this.sfx);
    if (opts.reverb) { const s = ctx.createGain(); s.gain.value = opts.reverb; g.connect(s).connect(this.revSend); }
    src.start(ctx.currentTime + (opts.delay || 0));
    return { src, gain: g };
  }

  // Positional sound with propagation (heard around corners, through doorways).
  playAt(name, pos, opts = {}) {
    if (!this.ready) return null;
    const b = typeof opts.variant === 'number' ? this.buffers[name]?.[opts.variant] : this.pick(name);
    if (!b) return null;
    if (this.voices > 48) return null;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = (opts.rate ?? 1) * (opts.jitter ? 1 + (Math.random() - 0.5) * opts.jitter : 1);
    const node = this.spatialChain(src, pos, opts);
    this.voices++;
    src.onended = () => { this.voices--; try { node.out.disconnect(); } catch { /* ignore */ } };
    src.start(ctx.currentTime + (opts.delay || 0));
    return { src, ...node };
  }

  spatialChain(src, pos, opts) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    const p = ctx.createPanner();
    p.panningModel = this.game.settings.q.shadows ? 'HRTF' : 'equalpower';
    p.distanceModel = 'inverse'; p.refDistance = opts.ref ?? 1.5; p.rolloffFactor = opts.rolloff ?? 1.1; p.maxDistance = 80;
    const prop = this.propagation(pos.x, pos.z);
    const ppos = prop.portal;
    // Apparent distance: keep direction of the portal but push it to the path distance.
    const lx = this.lpos?.x ?? pos.x, lz = this.lpos?.z ?? pos.z;
    let dx = ppos.x - lx, dz = ppos.z - lz;
    const dl = Math.hypot(dx, dz) || 1;
    const dist = Math.max(dl, prop.path);
    dx = dx / dl * dist; dz = dz / dl * dist;
    p.positionX.value = lx + dx; p.positionY.value = pos.y ?? 1.2; p.positionZ.value = lz + dz;
    lp.frequency.value = prop.cutoff;
    g.gain.value = (opts.gain ?? 1) * prop.gain;
    src.connect(lp).connect(g).connect(p).connect(opts.bus || this.sfx);
    const send = ctx.createGain(); send.gain.value = (opts.reverb ?? 0.35) * Math.min(1, 0.4 + dist / 15);
    p.connect(send).connect(this.revSend);
    return { gain: g, panner: p, filter: lp, out: p };
  }

  // Propagation from listener field: path distance, portal point, occlusion.
  propagation(x, z) {
    const nav = this.game.nav;
    const field = this.field;
    if (!nav || !field || !this.lpos) return { portal: { x, z }, path: 1, cutoff: 20000, gain: 1 };
    const i = nav.cellOf(x, z);
    let path = field[i];
    const direct = Math.hypot(x - this.lpos.x, z - this.lpos.z);
    if (!isFinite(path)) {
      // Not reachable through air within range: heavily occluded through-wall sound.
      const occ = this.game.grid.countOccluders(this.lpos.x, this.lpos.z, x, z);
      const g = Math.max(0, 1 - occ.walls * 0.35) * 0.4;
      return { portal: { x, z }, path: direct * 1.5, cutoff: 350, gain: g };
    }
    // Walk the field toward the listener to find the visible portal.
    const portal = this.portalFromField(x, z);
    const extra = Math.max(0, path - direct);
    const cutoff = Math.max(500, 18000 - extra * 1400 - (portal.x === x && portal.z === z ? 0 : 3000));
    return { portal, path: Math.max(direct, path * 0.9), cutoff, gain: 1 };
  }

  portalFromField(x, z) {
    const nav = this.game.nav, grid = this.game.grid, W = this.game.map.W;
    const f = this.field;
    if (grid.los(x, z, this.lpos.x, this.lpos.z, 'sight')) return { x, z };
    let cur = nav.cellOf(x, z);
    for (let s = 0; s < 70; s++) {
      const cx = cur % W, cz = (cur / W) | 0;
      let best = cur, bd = f[cur];
      for (const [ddx, ddz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = (cz + ddz) * W + cx + ddx;
        if (ni >= 0 && ni < f.length && f[ni] < bd) { bd = f[ni]; best = ni; }
      }
      if (best === cur) break;
      cur = best;
      const px = (cur % W) + 0.5, pz = ((cur / W) | 0) + 0.5;
      if (grid.los(px, pz, this.lpos.x, this.lpos.z, 'sight')) return { x: px, z: pz };
    }
    return { x: (cur % W) + 0.5, z: ((cur / W) | 0) + 0.5 };
  }

  // Looping source; positional when opts.pos given. Returns handle.
  loop(name, opts = {}) {
    if (!this.ready && !this.ctx) return null;
    const b = this.pick(name);
    if (!b) return null;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = b; src.loop = true;
    src.playbackRate.value = opts.rate ?? 1;
    let handle;
    if (opts.pos) {
      const chain = this.spatialChain(src, opts.pos, { ...opts, gain: 1 });
      const vol = ctx.createGain(); vol.gain.value = opts.gain ?? 1;
      chain.gain.disconnect(); chain.gain.connect(vol).connect(chain.panner);
      handle = { src, vol, chain, pos: { ...opts.pos }, positional: true, base: opts.gain ?? 1 };
    } else {
      const vol = ctx.createGain(); vol.gain.value = opts.gain ?? 1;
      src.connect(vol).connect(opts.bus || this.amb);
      handle = { src, vol, positional: false };
    }
    src.start(ctx.currentTime + Math.random() * 0.05, Math.random() * b.duration);
    handle.setGain = (v, tc = 0.2) => handle.vol.gain.setTargetAtTime(v, ctx.currentTime, tc);
    handle.stop = (fade = 0.3) => {
      handle.vol.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
      setTimeout(() => { try { src.stop(); } catch { /* ignore */ } }, fade * 1000 + 100);
      if (handle.positional) this.posLoops.delete(handle);
    };
    if (handle.positional) { this.posLoops = this.posLoops || new Set(); this.posLoops.add(handle); }
    return handle;
  }

  updateLoopPosition(h) {
    if (!h || !h.positional) return;
    const prop = this.propagation(h.pos.x, h.pos.z);
    const lx = this.lpos.x, lz = this.lpos.z;
    let dx = prop.portal.x - lx, dz = prop.portal.z - lz;
    const dl = Math.hypot(dx, dz) || 1;
    const dist = Math.max(dl, prop.path);
    const t = this.ctx.currentTime;
    h.chain.panner.positionX.setTargetAtTime(lx + dx / dl * dist, t, 0.1);
    h.chain.panner.positionZ.setTargetAtTime(lz + dz / dl * dist, t, 0.1);
    h.chain.panner.positionY.setTargetAtTime(h.pos.y ?? 1.2, t, 0.1);
    h.chain.filter.frequency.setTargetAtTime(prop.cutoff, t, 0.1);
    h.chain.gain.gain.setTargetAtTime(prop.gain, t, 0.1);
  }

  setReverb(preset) {
    if (!this.ready || preset === this.zonePreset || !this.irs[preset]) return;
    this.zonePreset = preset;
    const t = this.ctx.currentTime;
    if (this.revActive === 'A') { this.convB.buffer = this.irs[preset]; this.revB.gain.setTargetAtTime(1, t, 0.4); this.revA.gain.setTargetAtTime(0, t, 0.4); this.revActive = 'B'; }
    else { this.convA.buffer = this.irs[preset]; this.revA.gain.setTargetAtTime(1, t, 0.4); this.revB.gain.setTargetAtTime(0, t, 0.4); this.revActive = 'A'; }
  }

  setAmbience(preset, extra = {}) {
    if (!this.ready) return;
    const want = new Map((AMB[preset] || []).map(([n, g]) => [n, g]));
    for (const [n, g] of Object.entries(extra)) want.set(n, Math.max(want.get(n) || 0, g));
    for (const [n, h] of this.ambActive) {
      if (!want.has(n)) { h.setGain(0, 0.8); }
    }
    for (const [n, g] of want) {
      let h = this.ambActive.get(n);
      if (!h) { h = this.loop(n, { bus: this.amb, gain: 0 }); this.ambActive.set(n, h); }
      h?.setGain(g, 0.8);
    }
  }

  update(dt, camera, state) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // Listener
    const p = camera.position;
    const fwd = state.forward, up = state.up;
    const L = ctx.listener;
    if (L.positionX) {
      L.positionX.setTargetAtTime(p.x, t, 0.02); L.positionY.setTargetAtTime(p.y, t, 0.02); L.positionZ.setTargetAtTime(p.z, t, 0.02);
      L.forwardX.setTargetAtTime(fwd.x, t, 0.02); L.forwardY.setTargetAtTime(fwd.y, t, 0.02); L.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      L.upX.setTargetAtTime(up.x, t, 0.02); L.upY.setTargetAtTime(up.y, t, 0.02); L.upZ.setTargetAtTime(up.z, t, 0.02);
    } else {
      L.setPosition(p.x, p.y, p.z); L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }
    this.lpos = { x: p.x, z: p.z };
    // Propagation field from the listener's cell (recomputed when the cell changes or periodically).
    const nav = this.game.nav;
    const cell = nav.cellOf(p.x, p.z);
    this.fieldTimer = (this.fieldTimer || 0) - dt;
    if (cell !== this.lastFieldCell || this.fieldTimer <= 0) {
      this.lastFieldCell = cell;
      this.fieldTimer = 0.5;
      const f = nav.propagate(p.x, p.z, 45);
      this.field = this.field && this.field.length === f.length ? this.field : new Float32Array(f.length);
      this.field.set(f);
      if (this.posLoops) for (const h of this.posLoops) this.updateLoopPosition(h);
    }
    // Silence: the Remainder's presence ducks the world, kills reverb, raises tinnitus.
    const s = this.silence;
    this.ambDuck.gain.setTargetAtTime(Math.max(0.02, 1 - s * 1.05), t, 0.25);
    this.revDuck.gain.setTargetAtTime(Math.max(0, 1 - s * 1.2), t, 0.25);
    this.sfx.gain.setTargetAtTime(this.game.settings.get('sfxVolume') * (1 - s * 0.55), t, 0.3);
    this.tinnitus?.setGain(Math.max(0, s - 0.25) * 0.06 + (state.tinnitus || 0) * 0.08, 0.4);
    const cutoff = 20000 * Math.pow(1 - Math.min(0.95, this.muffle), 2.5) + 200;
    this.muffleFilter.frequency.setTargetAtTime(cutoff, t, 0.15);
    // Music layers
    const m = state.music || {};
    this.mLow?.setGain((m.low || 0) * 0.5, 1.5);
    this.mHigh?.setGain((m.high || 0) * 0.25, 1.5);
    this.mPulse?.setGain((m.pulse || 0) * 0.5, 0.5);
  }

  // Death: cut everything to absolute silence.
  cutAll(sec = 0.05) {
    if (!this.ready) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, sec);
  }

  restore() { if (this.ready) { this.applyVolumes(); this.muffle = 0; this.silence = 0; } }
}
