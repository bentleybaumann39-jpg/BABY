/* audio.js — procedural Web Audio. Nothing is sampled; every sound is synthesised.
 * Inside the suit: dry, close, stereo. Outside: through the hull (low-pass + hull resonances), mono unless
 * the hydrophone is listening. Act III runs the whole mix through a bit-crusher (DESIGN.md §4.5–4.7). */
'use strict';
(function (B) {
  const M = B.M;
  const A = B.A = { ready: false };
  let ctx, master, comp, crush, lofiLP, interior, exterior, hullLP, extOut, revSend, conv, revGain, comms, music, pre;
  let white, brown, fan, fanG, thrN, thrF, thrG, thrO, thrOG, swellN, swellG, engG, engO1, engO2, humN, humG, murN, murG, ost = [], ostG, ringO, ringG, grainN, grainG, reelO, reelG, rainN, rainG, windG;
  let nextBreath = 0, nextBeat = 0, nextTick = 0, nextCreak = 0, nextShrimp = 0, nextWhale = 0, lastDepthM = null, ostBeat = 0, nextOst = 0;
  let reverbKind = '';
  const now = () => ctx.currentTime;

  function noiseBuf(kind) {
    const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }
  function src(buf, loop) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = !!loop; return s; }
  function gain(v, to) { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; }
  function filt(type, f, q, to) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q; if (to) b.connect(to); return b; }
  function osc(type, f, to) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; if (to) o.connect(to); return o; }
  function makeIR(len, early, decay) {
    const sr = ctx.sampleRate, n = Math.floor(sr * len), b = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) {
        const t = i / sr; let v = (Math.random() * 2 - 1) * Math.exp(-t / decay);
        if (!early) v *= Math.min(1, t / 0.35); // no early reflections: open void
        d[i] = v * 0.6;
      }
      if (early) for (let k = 0; k < 6; k++) { const at = Math.floor(sr * (0.02 + Math.random() * 0.09)); if (at < n) d[at] += (Math.random() < 0.5 ? -1 : 1) * 0.5; }
    }
    return b;
  }
  function crushCurve(bits) {
    const n = 4096, c = new Float32Array(n), steps = Math.pow(2, bits) / 2;
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.round(x * steps) / steps; }
    return c;
  }

  A.init = function () {
    if (A.ready || A.failed) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { A.failed = true; return; }
    white = noiseBuf('white'); brown = noiseBuf('brown');
    master = gain(B.settings.master);
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    crush = ctx.createWaveShaper(); crush.curve = null;
    lofiLP = filt('lowpass', 20000, 0.5);
    master.connect(comp); comp.connect(crush); crush.connect(lofiLP); lofiLP.connect(ctx.destination);
    pre = gain(1, master);
    interior = gain(0.9, pre);
    extOut = gain(1, pre);
    const pk3 = filt('peaking', 1100, 4, extOut); pk3.gain.value = 3;
    const pk2 = filt('peaking', 420, 4, pk3); pk2.gain.value = 4;
    const pk1 = filt('peaking', 180, 4, pk2); pk1.gain.value = 6;
    hullLP = filt('lowpass', 800, 0.7, pk1);
    exterior = gain(1, hullLP);
    conv = ctx.createConvolver(); revGain = gain(0.45, pre); conv.connect(revGain);
    revSend = gain(0.6, conv); exterior.connect(revSend);
    // comms: narrowband, clipped, warbling
    comms = gain(0.9);
    const cHP = filt('highpass', 300, 0.7), cLP = filt('lowpass', 3000, 0.7), cShape = ctx.createWaveShaper();
    const cc = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 1023 * 2 - 1; cc[i] = Math.tanh(x * 3); } cShape.curve = cc;
    comms.connect(cHP); cHP.connect(cLP); cLP.connect(cShape); cShape.connect(gain(0.55, pre));
    music = gain(B.settings.music * 0.6, pre);
    A.setReverb('shelf');

    // fan: 117 Hz whir
    fanG = gain(0.012, interior); fan = osc('triangle', 117, fanG); fan.start();
    // thrusters: brown noise band + low saw
    thrG = gain(0, interior); thrF = filt('bandpass', 260, 0.8, thrG); thrN = src(brown, true); thrN.connect(thrF); thrN.start();
    thrOG = gain(0, interior); const thrLP = filt('lowpass', 420, 1, thrOG); thrO = osc('sawtooth', 92, thrLP); thrO.start();
    // surface swell
    swellG = gain(0, exterior); const swF = filt('lowpass', 420, 0.6, swellG); swellN = src(brown, true); swellN.connect(swF); swellN.start();
    // ship engine thrum
    engG = gain(0, exterior); engO1 = osc('sawtooth', 41, engG); engO2 = osc('square', 82.5, gain(0.3, engG)); engO1.start(); engO2.start();
    const engLFO = osc('sine', 5.6), engLG = gain(0.5); engLFO.connect(engLG); engLG.connect(engG.gain); engLFO.start();
    // deep hum
    humG = gain(0, exterior); const humF = filt('lowpass', 110, 0.8, humG); humN = src(brown, true); humN.connect(humF); humN.start();
    // phantom floor murmur (fins)
    murG = gain(0, exterior); const murF = filt('bandpass', 620, 1.4, murG); murN = src(white, true); murN.connect(murF); murN.start();
    const murLFO = osc('sine', 7.3), murLG = gain(0.0); murLFO.connect(murLG); murLG.connect(murG.gain); murLFO.start(); A._murLG = murLG;
    // the Ostinato: harmonics 2-5 of a 17 Hz fundamental nobody's speakers can play
    A._ostEnv = gain(0, pre); ostG = gain(1, A._ostEnv);
    [34, 51, 68, 85].forEach((f, i) => { const g = gain([0.5, 0.35, 0.25, 0.18][i], ostG); const o = osc('sine', f, g); o.start(); ost.push(o); });
    // hull ring after a ping
    ringG = gain(0, interior); ringO = osc('sine', 1100, ringG); ringO.start();
    // grain hiss
    grainG = gain(0, exterior); const grF = filt('highpass', 2600, 0.7, grainG); grainN = src(white, true); grainN.connect(grF); grainN.start();
    // winch whir
    reelG = gain(0, interior); reelO = osc('triangle', 310, filt('lowpass', 900, 1, reelG)); reelO.start();
    // rain on deck
    rainG = gain(0, pre); const rnF = filt('highpass', 1800, 0.5, rainG); rainN = src(white, true); rainN.connect(rnF); rainN.start();
    windG = gain(0, pre); const wnF = filt('bandpass', 380, 0.5, windG); const wn = src(brown, true); wn.connect(wnF); wn.start();
    A.ready = true;
  };
  A.resume = function () { if (ctx && ctx.state === 'suspended') ctx.resume(); };
  A.setVolume = function () { if (!A.ready) return; master.gain.setTargetAtTime(B.settings.master, now(), 0.05); music.gain.setTargetAtTime(B.settings.music * 0.6, now(), 0.05); };
  A.setReverb = function (kind) {
    if (!ctx || kind === reverbKind) return; reverbKind = kind;
    conv.buffer = kind === 'mid' ? makeIR(5, false, 1.8) : kind === 'deck' ? makeIR(0.8, true, 0.15) : kind === 'archive' ? makeIR(6, true, 2.4) : makeIR(3.5, true, 1.1);
  };
  A.mute = function (on) { if (!A.ready) return; pre.gain.setTargetAtTime(on ? 0 : 1, now(), 0.08); };
  A.setLofi = function (bits, cutoff) {
    if (!A.ready) return;
    crush.curve = bits >= 16 ? null : crushCurve(bits);
    lofiLP.frequency.setTargetAtTime(cutoff || 20000, now(), 0.2);
  };

  // ------------------------------------------------------------------ envelopes & one-shots
  function envG(dest, t, a, h, d, peak) {
    const g = gain(0, dest); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + h); g.gain.exponentialRampToValueAtTime(0.0001, t + a + h + d); return g;
  }
  function tone(dest, type, f0, f1, t, a, h, d, peak) {
    const g = envG(dest, t, a, h, d, peak), o = osc(type, f0, g);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + h + d);
    o.start(t); o.stop(t + a + h + d + 0.05); return o;
  }
  function burst(dest, type, f, q, t, a, h, d, peak, buf, f1) {
    const g = envG(dest, t, a, h, d, peak), fl = filt(type, f, q, g), s = src(buf || white);
    if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + a + h + d);
    s.connect(fl); s.start(t, Math.random() * 1.5); s.stop(t + a + h + d + 0.05); return fl;
  }
  function spatial(x, y, z, vol) {
    // distance attenuation always; direction only while the hydrophone listens (divers can't localise underwater)
    const P = B.player; let d = 6, pan = 0;
    if (P && x !== undefined) {
      d = Math.hypot(x - P.x, y - P.y, (z - P.z) * 0.8);
      if (A.listening) pan = M.clamp((x - P.x) / 14, -1, 1);
    }
    const g = gain(M.clamp(vol / (1 + d / 9), 0, 1.5));
    if (pan && ctx.createStereoPanner) { const sp = ctx.createStereoPanner(); sp.pan.value = pan; g.connect(sp); sp.connect(exterior); } else g.connect(exterior);
    return g;
  }

  const SFX = {
    ping(t) { const g = gain(1, exterior); tone(g, 'sine', 1520, 1180, t, 0.005, 0.05, 1.6, 0.35); tone(revSend, 'sine', 1520, 1300, t, 0.005, 0.02, 2.4, 0.25); tone(interior, 'sine', 1520, 1180, t, 0.002, 0.03, 0.4, 0.12); },
    narrow(t) { tone(exterior, 'sine', 2100, 1900, t, 0.004, 0.03, 0.9, 0.28); tone(interior, 'sine', 2100, 1900, t, 0.002, 0.02, 0.25, 0.1); },
    click(t) { burst(interior, 'bandpass', 2400, 8, t, 0.001, 0.004, 0.02, 0.25); },
    relay(t) { burst(interior, 'bandpass', 2900, 10, t, 0.001, 0.002, 0.018, 0.12); tone(interior, 'square', 1800, 1800, t, 0.001, 0.002, 0.012, 0.012); },
    tick(t) { burst(interior, 'bandpass', 5200, 6, t, 0.001, 0.001, 0.01, 0.05); },
    creak(t) { const f = M.rnd(900, 3200); tone(exterior, 'sine', f, f * 0.97, t, 0.002, 0.01, M.rnd(0.15, 0.5), 0.05); burst(exterior, 'bandpass', f, 12, t, 0.001, 0.01, 0.2, 0.08); },
    groan(t) { tone(exterior, 'sawtooth', M.rnd(60, 90), M.rnd(40, 55), t, 0.3, 0.6, 1.2, 0.06); },
    knock(t) { tone(exterior, 'sine', 120, 70, t, 0.002, 0.01, 0.18, 0.5); burst(exterior, 'bandpass', 700, 3, t, 0.001, 0.005, 0.08, 0.4); I_rumble(0.8, 0.2, 90); },
    knock3(t) { for (let k = 0; k < 3; k++) SFX.knock(t + k * 0.32); },
    impact(t) { tone(exterior, 'sine', 90, 45, t, 0.002, 0.02, 0.4, 0.7); burst(exterior, 'lowpass', 1400, 1, t, 0.001, 0.02, 0.3, 0.6, brown); I_rumble(1, 0.5, 160); },
    crack(t) { burst(interior, 'highpass', 2500, 0.7, t, 0.0005, 0.02, 0.35, 1.2); tone(interior, 'sine', 70, 28, t, 0.002, 0.1, 1.6, 0.9); burst(revSend, 'bandpass', 1800, 2, t, 0.001, 0.05, 2.5, 0.6); I_rumble(1, 1, 600); },
    boom(t) { burst(exterior, 'lowpass', 900, 0.7, t, 0.001, 0.05, 1.2, 1.4, brown); tone(exterior, 'sine', 55, 26, t, 0.002, 0.2, 2.2, 1.0); burst(revSend, 'lowpass', 1200, 0.7, t, 0.001, 0.1, 3, 0.8, brown); I_rumble(1, 1, 400); },
    pickFire(t) { burst(interior, 'lowpass', 600, 2, t, 0.001, 0.01, 0.12, 0.5, brown); burst(exterior, 'bandpass', 1600, 1, t, 0.002, 0.05, 0.3, 0.2, white, 500); },
    pickHit(t) { tone(exterior, 'triangle', 900, 700, t, 0.001, 0.01, 0.1, 0.25); },
    clamp(t) { burst(exterior, 'bandpass', 1300, 2, t, 0.02, 0.6, 0.8, 0.22, white, 700); tone(exterior, 'sawtooth', 210, 160, t, 0.02, 0.4, 0.6, 0.04); },
    absorb(t) { for (let k = 0; k < 6; k++) burst(exterior, 'lowpass', M.rnd(300, 700), 3, t + k * 0.18, 0.01, 0.04, 0.12, 0.3, brown); tone(interior, 'sine', 180, 90, t + 1, 0.05, 0.1, 0.4, 0.15); },
    siphon(t) { burst(exterior, 'bandpass', 500, 1, t, 0.02, 0.1, 0.5, 0.4, white, 140); },
    caul(t) { tone(exterior, 'sine', 240, 80, t, 0.02, 0.2, 0.8, 0.35); for (let k = 0; k < 8; k++) tone(exterior, 'sine', M.rnd(300, 900), M.rnd(200, 400), t + k * 0.06, 0.005, 0.01, 0.08, 0.06); },
    bloom(t) { for (let k = 0; k < 6; k++) tone(exterior, 'sine', 1400 + k * 330, 1600 + k * 300, t + k * 0.04, 0.02, 0.1, 1.2, 0.04); burst(exterior, 'highpass', 3000, 0.7, t, 0.01, 0.1, 0.6, 0.12); },
    graft(t) { burst(interior, 'lowpass', 500, 4, t, 0.01, 0.2, 0.3, 0.4, brown); burst(interior, 'highpass', 4000, 0.7, t + 0.3, 0.05, 0.6, 0.5, 0.15); },
    pickup(t) { tone(interior, 'square', 880, 880, t, 0.002, 0.03, 0.05, 0.05); tone(interior, 'square', 1320, 1320, t + 0.06, 0.002, 0.03, 0.08, 0.05); },
    beep(t) { tone(interior, 'square', 1240, 1240, t, 0.002, 0.03, 0.04, 0.04); },
    deny(t) { tone(interior, 'square', 300, 220, t, 0.002, 0.08, 0.06, 0.06); },
    swap(t) { SFX.click(t); burst(interior, 'highpass', 3000, 0.7, t + 0.08, 0.02, 0.25, 0.3, 0.12); },
    alarm(t) { for (let k = 0; k < 10; k++) tone(exterior, 'sine', M.rnd(2500, 4200), M.rnd(2000, 3800), t + k * 0.05, 0.003, 0.01, 0.12, 0.05); },
    glass(t) { tone(exterior, 'sine', M.rnd(2200, 4100), 0, t, 0.002, 0.005, M.rnd(0.08, 0.3), 0.06); },
    chime(t, f) { tone(exterior, 'sine', f, f, t, 0.003, 0.02, 0.6, 0.07); tone(exterior, 'sine', f * 2.76, f * 2.76, t, 0.003, 0.01, 0.25, 0.03); },
    bone(t) { const f = M.rnd(500, 1300); tone(exterior, 'sine', f, f * 0.99, t, 0.002, 0.01, 0.35, 0.05); tone(exterior, 'sine', f * 2.4, f * 2.4, t, 0.002, 0.01, 0.15, 0.03); },
    whump(t) { tone(exterior, 'sine', 42, 30, t, 0.06, 0.08, 0.6, 0.55); I_rumble(0.5, 0, 220); },
    rush(t) { burst(exterior, 'bandpass', 900, 0.8, t, 0.05, 0.3, 0.6, 0.6, white, 3000); },
    gasp(t) { burst(interior, 'bandpass', 900, 2, t, 0.25, 0.4, 0.6, 0.18, white, 1400); },
    sing(t) { tone(exterior, 'sine', 330, 335, t, 0.2, 0.3, 0.8, 0.05); tone(exterior, 'sine', 495, 490, t, 0.2, 0.3, 0.8, 0.03); },
    static(t, d) { burst(comms, 'bandpass', 1500, 0.5, t, 0.01, d || 0.3, 0.1, 0.25); },
    boot(t) { for (let k = 0; k < 9; k++) SFX.relay(t + k * 0.11 + Math.random() * 0.04); tone(interior, 'square', 660, 660, t + 1.2, 0.002, 0.08, 0.05, 0.05); },
    thrusterGhost(t) { burst(interior, 'bandpass', 260, 0.8, t, 0.08, 0.35, 0.3, 0.25, brown); },
    hiss(t) { burst(interior, 'highpass', 2600, 0.7, t, 0.02, 0.3, 0.2, 0.14); },
    seal(t) { burst(interior, 'bandpass', 3000, 3, t, 0.01, 0.2, 0.2, 0.1); },
    eyeshut(t) { tone(interior, 'square', 220, 110, t, 0.002, 0.1, 0.2, 0.08); },
    heartbeat(t, v) { tone(interior, 'sine', 58, 40, t, 0.004, 0.02, 0.16, v); tone(interior, 'sine', 52, 38, t + 0.22, 0.004, 0.02, 0.14, v * 0.7); },
    wave(t) { burst(exterior, 'lowpass', 160, 0.7, t, 1.2, 1.4, 2.4, 0.5, brown); tone(exterior, 'sine', 48, 36, t, 1, 1.5, 2, 0.25); },
    // crown jelly alarm: a rising glassy spiral
    jelly(t) { for (let k = 0; k < 7; k++) tone(exterior, 'sine', 900 * Math.pow(1.19, k), 940 * Math.pow(1.19, k), t + k * 0.07, 0.01, 0.03, 0.5, 0.035); },
    // a sea pen or bamboo coral lighting up when brushed: a soft breath of noise and a low bell
    glow(t) { burst(exterior, 'bandpass', 1200, 1.5, t, 0.08, 0.2, 0.6, 0.06, white, 2400); tone(exterior, 'sine', 620, 610, t + 0.05, 0.02, 0.1, 1.2, 0.03); },
    // the objective transponder answering a ping: two thin chirps, filtered by distance
    transponder(t) { for (let k = 0; k < 2; k++) { tone(exterior, 'sine', 3100, 3300, t + k * 0.13, 0.003, 0.03, 0.08, 0.05); tone(revSend, 'sine', 3100, 3300, t + k * 0.13, 0.003, 0.02, 0.4, 0.03); } },
    // viewport glass crazing under load
    crackle(t) { for (let k = 0; k < 5; k++) burst(interior, 'highpass', 5000 + Math.random() * 3000, 2, t + Math.random() * 0.25, 0.0005, 0.001, 0.012, 0.18); },
    // a sperm whale's click: a hard broadband snap with a long tail in the water
    whaleClick(t) { burst(exterior, 'bandpass', 2800, 1.2, t, 0.0005, 0.001, 0.025, 0.5); burst(revSend, 'bandpass', 2200, 1, t, 0.0005, 0.002, 0.4, 0.15); },
    // a black smoker: a deep roar breathing up out of the floor
    vent(t) { burst(exterior, 'lowpass', 220, 0.8, t, 0.6, 1.2, 1.5, 0.35, brown); burst(exterior, 'bandpass', 900, 0.6, t + 0.2, 0.4, 0.8, 1, 0.05); },
    // thunder over the sea: a crack, then a long low roll
    thunder(t) { burst(exterior, 'lowpass', 900, 0.7, t, 0.01, 0.05, 0.6, 0.35, white); burst(exterior, 'lowpass', 160, 0.6, t + 0.1, 0.4, 1.4, 3.2, 0.7, brown); burst(revSend, 'lowpass', 220, 0.6, t + 0.2, 0.6, 1.2, 3.5, 0.3, brown); },
    splash(t) { burst(exterior, 'lowpass', 1500, 0.6, t, 0.01, 0.2, 1.2, 0.6, white, 300); },
  };
  function I_rumble(a, b, ms) { if (B.I) B.I.rumble(a, b, ms); }
  A.sfx = function (name, a, b) { if (!A.ready || !SFX[name]) return; SFX[name](now() + (a && a.delay || 0), b); };
  A.sfxAt = function (name, delay) { if (!A.ready || !SFX[name]) return; SFX[name](now() + (delay || 0)); };
  // Spatial one-shot from a world position (routes through a temporary gain on the exterior bus).
  A.at = function (name, x, y, z, vol, extra) {
    if (!A.ready) return;
    const g = spatial(x, y, z, vol === undefined ? 1 : vol);
    const saveE = exterior; exterior = g; try { SFX[name] && SFX[name](now(), extra); } finally { exterior = saveE; }
  };

  // Breath: inhale four counts, exhale six. The copy one frame late is the Second Diver's flange.
  function breath(t, dur, inhale, vol, flange) {
    const g = envG(interior, t, dur * 0.35, dur * 0.3, dur * 0.35, vol);
    const f = filt('bandpass', inhale ? 700 : 480, 1.2, g);
    f.frequency.linearRampToValueAtTime(inhale ? 1100 : 380, t + dur);
    const s = src(white); s.connect(f); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    if (flange) {
      const g2 = envG(interior, t + 0.0167, dur * 0.35, dur * 0.3, dur * 0.35, vol * 0.95);
      const f2 = filt('bandpass', inhale ? 700 : 480, 1.2, g2); f2.frequency.linearRampToValueAtTime(inhale ? 1100 : 380, t + dur + 0.0167);
      const s2 = src(white); s2.connect(f2); s2.start(t + 0.0167, 0.3); s2.stop(t + dur + 0.07);
    }
  }

  // Voice babble under a caption: formant-filtered noise in syllables.
  A.voice = function (who, dur) {
    if (!A.ready) return;
    const t0 = now() + 0.02, dest = who === 'mara' ? interior : comms;
    if (who !== 'mara') SFX.static(t0, 0.15);
    const base = who === 'mara' ? 1.15 : who === 'new' ? 1.05 : 0.85;
    let t = t0 + 0.1;
    const end = t0 + Math.min(dur, 9);
    while (t < end) {
      const syl = M.rnd(0.09, 0.2), gap = Math.random() < 0.2 ? M.rnd(0.1, 0.3) : M.rnd(0.01, 0.05);
      const g = envG(dest, t, 0.02, syl * 0.6, syl * 0.4, who === 'mara' ? 0.06 : 0.22);
      const f1 = filt('bandpass', M.rnd(450, 800) * base, 6, g), f2 = filt('bandpass', M.rnd(1100, 2300) * base, 8, g);
      const s = src(white); s.connect(f1); s.connect(f2); s.start(t, Math.random()); s.stop(t + syl + 0.05);
      const o = osc('sawtooth', (who === 'mara' ? 190 : 118) * M.rnd(0.95, 1.08), filt('lowpass', 900, 1, envG(dest, t, 0.02, syl * 0.6, syl * 0.4, who === 'mara' ? 0.02 : 0.05)));
      o.start(t); o.stop(t + syl + 0.05);
      t += syl + gap;
    }
    if (who !== 'mara') SFX.static(end + 0.05, 0.08);
  };

  // ------------------------------------------------------------------ the waltz
  // A short music-box waltz in 3/4 (original melody). Played through the galley radio, by the Procession,
  // and clean once, at the end.
  const WALTZ = [ // [semitones above A3, beats]
    [7, 1], [11, 1], [14, 1], [12, 2], [11, 1], [9, 1], [7, 1], [9, 1], [11, 3],
    [12, 1], [14, 1], [16, 1], [14, 2], [12, 1], [11, 1], [9, 1], [11, 1], [7, 3],
    [7, 1], [11, 1], [14, 1], [19, 2], [17, 1], [16, 1], [14, 1], [12, 1], [11, 3],
    [9, 1], [11, 1], [12, 1], [11, 1], [9, 1], [6, 1], [7, 3], [-99, 3],
  ];
  let waltzTimer = null, waltzMode = null, waltzPos = 0;
  A.waltz = function (mode) {
    if (!A.ready) return;
    A.stopWaltz(); waltzMode = mode; waltzPos = 0;
    const beat = mode === 'clean' ? 0.62 : mode === 'chime' ? 0.48 : 0.42;
    let t = now() + 0.1;
    const dest = mode === 'radio' ? comms : mode === 'chime' ? exterior : music;
    const step = () => {
      if (waltzMode !== mode) return;
      while (t < now() + 1.2) {
        const [n, b] = WALTZ[waltzPos % WALTZ.length]; waltzPos++;
        if (n > -90) {
          const f = 220 * Math.pow(2, n / 12);
          if (mode === 'chime') { SFX.chime(t, f * 4); }
          else {
            const v = mode === 'radio' ? 0.16 : 0.11;
            tone(dest, 'sine', f * 2, f * 2, t, 0.004, 0.03, beat * b * 1.6, v);
            tone(dest, 'triangle', f * 4, f * 4, t, 0.002, 0.01, beat * 0.8, v * 0.35);
            if (mode === 'clean') tone(dest, 'sine', f, f, t, 0.02, 0.1, beat * b * 2.2, v * 0.6);
            // left-hand oom-pah-pah
            if (waltzPos % 3 === 1) tone(dest, 'sine', 110 * Math.pow(2, ((n % 12) - 12) / 12), 0, t, 0.01, 0.05, beat * 1.4, v * 0.4);
          }
        }
        t += beat * b;
        if (mode === 'clean' && waltzPos >= WALTZ.length * 2) { waltzMode = null; return; }
      }
      waltzTimer = setTimeout(step, 400);
    };
    step();
  };
  A.stopWaltz = function () { waltzMode = null; if (waltzTimer) clearTimeout(waltzTimer); waltzTimer = null; };

  // ------------------------------------------------------------------ per-frame update
  A.update = function (dt, s) {
    if (!A.ready) return;
    const t = now();
    A.listening = !!s.listening;
    const deck = !!s.topside;
    const z = s.depth || 0;
    // interior
    fanG.gain.setTargetAtTime(s.powered === false ? 0 : 0.012, t, 0.2);
    thrG.gain.setTargetAtTime(s.thrust * (s.boost ? 0.32 : 0.14), t, 0.08);
    thrF.frequency.setTargetAtTime(s.boost ? 420 : 260, t, 0.1);
    thrOG.gain.setTargetAtTime(s.thrust * (s.boost ? 0.05 : 0.025), t, 0.08);
    thrO.frequency.setTargetAtTime(s.boost ? 140 : 92, t, 0.1);
    reelG.gain.setTargetAtTime(s.reel ? 0.05 : 0, t, 0.05);
    ringG.gain.setTargetAtTime(Math.max(0, s.ring || 0) * 0.012, t, 0.05);
    // exterior beds
    hullLP.frequency.setTargetAtTime(deck ? 12000 : M.lerp(800, 400, M.clamp(z / 4000, 0, 1)), t, 0.3);
    swellG.gain.setTargetAtTime(deck ? 0.35 : z < 60 ? 0.25 * (1 - z / 60) : 0, t, 0.3);
    const engine = deck ? 0.05 : s.engine !== undefined ? s.engine : z < 300 ? 0.09 * (1 - z / 300) : 0;
    engG.gain.setTargetAtTime(engine, t, 0.5);
    humG.gain.setTargetAtTime(deck ? 0 : M.clamp(z / 1500, 0, 1) * 0.12 * (z > 3000 ? 0.5 : 1), t, 0.5);
    murG.gain.setTargetAtTime(s.inLayer ? 0.05 : 0, t, 0.6); A._murLG.gain.setTargetAtTime(s.inLayer ? 0.04 : 0, t, 0.6);
    grainG.gain.setTargetAtTime(M.clamp(s.grain || 0, 0, 1) * 0.08, t, 0.2);
    rainG.gain.setTargetAtTime(deck ? 0.06 : 0, t, 0.5); windG.gain.setTargetAtTime(deck ? 0.15 : 0, t, 0.5);
    exterior.gain.setTargetAtTime(s.duck ? 0.35 : 1, t, 0.6);
    A.setReverb(deck ? 'deck' : s.act === 'act2' ? 'mid' : z >= 4100 ? 'archive' : 'shelf');
    // Ostinato
    const ostLvl = s.ostinato !== undefined ? s.ostinato : z < 1000 ? 0 : M.clamp((z - 1000) / 2500, 0.15, 1);
    if (t > nextOst && ostLvl > 0) {
      // four beats and a hesitation; the count gains a beat in Act III ("it's yours")
      const n = s.extraBeat ? 5 : 4, beatLen = 0.72;
      const slot = ostBeat % (n + 1);
      if (slot < n) { const g = A._ostEnv.gain; g.cancelScheduledValues(t); g.setValueAtTime(0, t); g.linearRampToValueAtTime(ostLvl * 0.5, t + 0.12); g.exponentialRampToValueAtTime(0.0001, t + 0.62); I_rumble(ostLvl * 0.35, 0, 120); }
      ostBeat++; nextOst = t + beatLen;
    }
    // breathing and heart
    if (s.breathing !== false && !deck) {
      if (t > nextBreath) {
        const cycle = 60 / Math.max(6, s.breathRate || 12), inh = cycle * 0.4, exh = cycle * 0.6, vol = s.breathHold ? 0.05 : 0.11;
        breath(t, inh, true, vol, s.flange); breath(t + inh, exh, false, vol * 0.85, s.flange);
        nextBreath = t + cycle;
      }
      if (t > nextBeat) { const hr = s.hr || 70; const v = M.clamp((hr - 60) / 80, 0.03, 0.4) * (s.breathHold ? 1.8 : 1); SFX.heartbeat(t, v); nextBeat = t + 60 / hr; }
    }
    if (!deck && t > nextTick && s.powered !== false) { SFX.tick(t); nextTick = t + 1.3; }
    // depth relay: one click per metre, like a clock or a Geiger counter
    const dm = Math.floor(z);
    if (lastDepthM !== null && dm !== lastDepthM && !deck && s.powered !== false && Math.abs(dm - lastDepthM) < 40) SFX.relay(t);
    lastDepthM = dm;
    if (!deck && t > nextCreak) {
      const stress = M.clamp((s.crush || 0) / 100, 0, 1);
      SFX.creak(t); if (Math.random() < 0.2 + stress) SFX.groan(t + 0.2);
      nextCreak = t + M.rnd(20, 50) * (1 - stress * 0.85);
    }
    if (z < 130 && !deck && t > nextShrimp) { for (let k = 0; k < 6; k++) burst(exterior, 'highpass', 4000, 1, t + Math.random() * 0.5, 0.001, 0.001, 0.008, 0.06 * (1 - z / 130)); nextShrimp = t + M.rnd(0.2, 0.8); }
    if (((z < 200 && z > 20) || s.sofar) && !deck && t > nextWhale) {
      const f = M.rnd(180, 420), g = gain(s.sofar ? 0.09 : 0.05, exterior);
      tone(g, 'sine', f, f * M.rnd(0.6, 1.6), t, 0.8, 1.5, 1.8, 0.5); tone(g, 'sine', f * 1.5, f * M.rnd(0.9, 2), t + 0.5, 0.7, 1.2, 1.5, 0.25);
      nextWhale = t + M.rnd(25, 60);
    }
  };
})(window.B);
