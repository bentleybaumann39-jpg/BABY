/* zones.js — the three Rules of the Trench (DESIGN.md §1.3):
 *  I   the Phantom Floor (420–560 m): false sonar, lamp backscatter, burglar alarms
 *  II  the Slow Wave and the SOFAR channel (900–1,300 m): invisible currents that carry you down
 *  III the Settling (3,000 m+): pre-echo and compression of palette, audio and HUD precision */
'use strict';
(function (B) {
  const M = B.M, A = B.A;
  const Z = B.Z = {
    wave: { phase: 'calm', t: 60, pull: 0, shear: 0, big: false }, ambientT: 0, ambientMax: 0, flicker: 0, crushMul: 1, preT: 20,
  };
  const DAY = 24 * 60; // compressed dive-clock day, seconds
  Z.layerTop = () => 440 + Math.sin((B.time / DAY) * Math.PI * 2) * 30;
  Z.inLayer = z => B.act === 'act1' && z > Z.layerTop() && z < Z.layerTop() + 60;
  Z.sofarAt = z => B.act === 'act2' && z > 900 && z < 1300;
  Z.flareAmbient = function (sec) { Z.ambientT = sec; Z.ambientMax = sec; };
  Z.bigWave = function () { const w = Z.wave; w.phase = 'warn'; w.t = 6; w.big = true; };
  Z.reset = function () { Z.wave = { phase: 'calm', t: 70, pull: 0, shear: 0, big: false }; Z.ambientT = 0; Z.flicker = 0; };

  // Depth readout precision collapses in the Settling.
  Z.depthText = function (z) {
    if (B.act !== 'act3' || z < 3250) return String(Math.max(0, Math.round(z))).padStart(4, '0');
    if (z < 3500) return String(Math.round(z / 10) * 10).padStart(4, '0');
    if (z < 3750) return String(Math.round(z / 100) * 100).padStart(4, '0');
    if (z < 4000) return String(Math.round(z / 1000) * 1000).padStart(4, '0');
    return 'DEEP';
  };
  Z.lofi = function (z) {
    if (B.act !== 'act3') return [16, 20000];
    if (z < 3250) return [16, 11000];
    if (z < 3500) return [12, 8000];
    if (z < 3750) return [8, 6000];
    if (z < 4000) return [6, 4000];
    return [4, 3000];
  };

  Z.update = function (dt) {
    const P = B.player; if (!P) return;
    // ambient light from a collapsed Procession
    if (Z.ambientT > 0) { Z.ambientT -= dt; B.R.env.ambient = 0.02 * (Z.ambientT / Z.ambientMax); } else B.R.env.ambient = 0;
    if (Z.flicker > 0) Z.flicker -= dt;
    // the Slow Wave cycle (Act II, in and around the SOFAR band)
    const w = Z.wave;
    if (B.act === 'act2' && P.z > 860 && P.z < 1450) {
      w.t -= dt;
      if (w.phase === 'calm' && w.t <= 0) { w.phase = 'warn'; w.t = 12; A.sfx('groan'); B.Story.onWaveWarn && B.Story.onWaveWarn(); }
      else if (w.phase === 'warn' && w.t <= 0) { w.phase = 'trough'; w.t = w.big ? 45 : M.rnd(25, 40); A.sfx('wave'); }
      else if (w.phase === 'trough' && w.t <= 0) { w.phase = 'calm'; w.t = M.rnd(150, 200); w.big = false; }
    } else if (w.phase !== 'calm' && !w.big) { w.phase = 'calm'; w.t = 60; }
    w.shear = M.approach(w.shear, w.phase === 'warn' ? 1 : w.phase === 'trough' ? 0.7 : 0, dt * 0.5);
    w.pull = M.approach(w.pull, w.phase === 'trough' ? (w.big ? 4.2 : 2.6) : 0, dt * 0.4);
    // the Settling: pre-echo — sounds that arrive before their sources (one in four never happen)
    if (B.act === 'act3') {
      Z.preT -= dt;
      if (Z.preT <= 0) {
        Z.preT = M.rnd(14, 30);
        const r = Math.random();
        if (r < 0.4) A.sfx('thrusterGhost');
        else if (r < 0.7) A.at('rush', P.x + M.rnd(-15, 15), P.y + M.rnd(-15, 15), P.z, 1);
        else A.at('bone', P.x + M.rnd(-10, 10), P.y + M.rnd(-10, 10), P.z, 1);
      }
      const lf = Z.lofi(P.z); A.setLofi(lf[0], lf[1]);
    } else A.setLofi(16, 20000);
  };
  // Forces on the diver from the current zone.
  Z.forces = function (P, dt) {
    const w = Z.wave;
    if (w.pull > 0 && B.act === 'act2') {
      const anchored = P.anchor && P.anchor.ent && P.anchor.ent.type !== 'procession';
      const k = anchored ? 0.15 : 1;
      P.vz += (w.pull - P.vz) * Math.min(1, dt * 0.8) * k;
      P.vx += Math.sin(B.time * 0.2) * w.pull * 0.05 * dt;
    }
    if (B.act === 'act1') { P.vx += Math.sin(B.time * 0.05) * 0.012 * dt; P.vy += Math.cos(B.time * 0.04) * 0.01 * dt; }
  };
})(window.B);
