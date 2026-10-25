/* models.js — every visible thing is a list of 3D primitives built fresh each frame and ray-cast by
 * render.js. Local axes: x east, y south, z down (metres). Helpers turn a facing angle into those axes. */
'use strict';
(function (B) {
  const P = B.R.P, L = B.linHex, M = B.M;
  const MD = B.MD = {};
  const col = {};
  const c = h => col[h] || (col[h] = L(h));

  // Frame from facing yaw (0 = east, +pi/2 = south) and pitch (+ leans the head forward/down).
  function frame(yaw, pitch) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch || 0), sp = Math.sin(pitch || 0);
    const f = [cy * cp, sy * cp, sp], r = [-sy, cy, 0], d = [-cy * sp, -sy * sp, cp];
    return (a, b, e) => [f[0] * a + r[0] * b + d[0] * e, f[1] * a + r[1] * b + d[1] * e, f[2] * a + r[2] * b + d[2] * e];
  }
  MD.frame = frame;
  const quant8 = a => Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
  MD.quant8 = quant8;

  // ------------------------------------------------------------------ Mara in HV-0419
  /* s: { yaw, pitch, t (anim time), kick (0..1), lamp ('white'|'red'|'off'), tank: [{c:[r,g,b]}...], cap,
   *      fill (0..1), dead, armless, growth (0..1), hollow (Machine's Eye view), plain (no palette indices) } */
  MD.diver = function (s) {
    const yaw = s.yaw || 0, T = frame(yaw, s.pitch || 0), out = [];
    const ph = Math.floor((s.t || 0) * 12) / 12; // animation runs at 12 fps, on fives
    const kick = s.kick || 0, sw = Math.sin(ph * 7) * kick, sw2 = Math.sin(ph * 7 + Math.PI) * kick, bob = Math.sin(ph * 2.1) * 0.03;
    const pal = (i, hex) => s.plain ? { c: c(hex) } : { di: i, c: c(B.DIVER[i]) };
    const g = (i) => s.plain ? c(s.plain[i] || B.DIVER[i]) : c(B.DIVER[i]);
    const push = (p, i) => { if (!s.plain) p.di = i; out.push(p); return p; };
    const V = (a, b, e) => T(a, b, e + bob);
    // torso
    push(P.e(...V(0, 0, 0), [T(1, 0, 0), T(0, 1, 0), T(0, 0, 1)], [0.36, 0.44, 0.52], g(2)), 2);
    push(P.e(...V(0.12, 0, -0.18), [T(1, 0, 0), T(0, 1, 0), T(0, 0, 1)], [0.22, 0.34, 0.24], g(3)), 3);
    // helmet dome and visor
    push(P.s(...V(0.02, 0, -0.74), 0.35, g(3)), 3);
    if (s.hollow) {
      out.push(P.s(...V(0.16, 0, -0.74), 0.27, [0, 0, 0], { m: 4 }));
    } else {
      // The visor: facing pixels show her face (skin, a cheek highlight), the rest is dark glass with a glint.
      const fw = T(1, 0, 0), fu = fw[0], fwz = fw[1] * B.SN + fw[2] * B.CS, ff = fw[1] * B.CS - fw[2] * B.SN;
      const visor = P.s(...V(0.15, 0, -0.74), 0.27, g(6), { m: 1 });
      if (!s.plain) visor.palFn = (nu, nw, nf) => {
        const dot = nu * fu + nw * fwz + nf * ff;
        if (nu < -0.45 && nw < -0.35) return 7;
        if (dot > 0.62 && nw > -0.25 && nw < 0.45) return (nu < -0.1 && nw < 0.1) ? 10 : (dot > 0.8 ? 9 : 8);
        return dot > 0.3 ? 6 : 5;
      };
      out.push(visor);
    }
    // collar ring
    push(P.e(...V(0.02, 0, -0.44), [T(1, 0, 0), T(0, 1, 0), T(0, 0, 1)], [0.3, 0.36, 0.08], g(1)), 1);
    // shoulders, arms (right arm carries the manipulator, left the specimen intake)
    if (!s.armless) for (const side of [-1, 1]) {
      const sh = V(0, side * 0.5, -0.3), el = V(0.18 + sw * 0.06 * side, side * 0.64, 0.06), ha = V(0.4, side * 0.56, 0.16 + sw2 * 0.05);
      push(P.s(...sh, 0.17, g(1)), 1);
      push(P.c(sh, el, 0.12, g(2)), 2);
      push(P.c(el, ha, 0.11, g(3)), 3);
      if (side > 0) { push(P.s(...ha, 0.13, g(1)), 1); push(P.c(ha, V(0.56, 0.62, 0.2), 0.05, g(0)), 0); push(P.c(ha, V(0.56, 0.48, 0.22), 0.05, g(0)), 0); }
      else push(P.s(...ha, 0.1, g(2)), 2);
    }
    // legs, kicking from the hip
    for (const side of [-1, 1]) {
      const k = side > 0 ? sw : sw2;
      const hip = V(0, side * 0.2, 0.42), knee = V(0.06 + k * 0.12, side * 0.24, 0.8), foot = V(-0.04 - k * 0.1, side * 0.24, 1.12);
      push(P.c(hip, knee, 0.14, g(2)), 2); push(P.c(knee, foot, 0.13, g(1)), 1); push(P.s(...V(0.04 - k * 0.1, side * 0.24, 1.18), 0.14, g(0)), 0);
    }
    // thruster pods
    for (const side of [-1, 1]) push(P.c(V(-0.4, side * 0.3, -0.2), V(-0.42, side * 0.3, 0.3), 0.1, g(15)), 15);
    // culture tank (glass) with glowing biomass filling from the bottom
    const tank = P.c(V(-0.52, 0.04, -0.36), V(-0.52, 0.04, 0.22), 0.13, g(13));
    if (!s.plain) tank.di = 13;
    const fill = s.fill || 0;
    if (fill > 0 && s.tankCol) {
      const tc = s.tankCol, q0 = tank; q0.e = tc;
      const tw = (V(-0.52, 0.04, -0.36)[1] * B.SN + V(-0.52, 0.04, -0.36)[2] * B.CS), bw = (V(-0.52, 0.04, 0.22)[1] * B.SN + V(-0.52, 0.04, 0.22)[2] * B.CS);
      const lvl = bw - (bw - tw + 0.26) * fill + 0.13;
      q0.emFn = (nu, nw, nf, pu, pw) => pw > lvl ? 0.9 : 0;
      if (!s.plain) q0.palFn = (nu, nw, nf, pu, pw) => pw > lvl ? 14 : 13;
    }
    out.push(tank);
    // helmet lamp
    if (s.lamp && s.lamp !== 'off') out.push(P.s(...V(0.24, 0.17, -0.98), 0.06, c('#ffffff'), { e: s.lamp === 'red' ? [1.6, 0.08, 0.04] : [1.8, 1.6, 1.3] }));
    // amber stencil on the chest
    push(P.s(...V(0.34, 0.14, -0.24), 0.05, g(12), { e: s.dead ? null : [0.25, 0.12, 0.02] }), 12);
    // growth: the Trench's tissue in the seams after the breach
    if (s.growth > 0) {
      const gc = s.growthCol || [0.05, 0.4, 0.3];
      const n = Math.floor(s.growth * 8);
      for (let k = 0; k < n; k++) {
        const a = k * 2.399, h = -0.4 + (k % 4) * 0.25;
        out.push(P.s(...V(Math.cos(a) * 0.38, Math.sin(a) * 0.44, h), 0.06 + (k % 3) * 0.02, c('#14504a'), { e: gc, emFn: () => 0.35 }));
      }
    }
    return out;
  };

  // ------------------------------------------------------------------ people on deck
  MD.person = function (s) {
    const T = frame(s.yaw || 0, 0), out = [], ph = s.t || 0;
    const walk = s.walk || 0, sw = Math.sin(ph * 8) * walk;
    const suit = c(s.suit || '#d4621e'), skin = c(s.skin || '#c08a64'), hair = c(s.hair || '#2a1a12'), trou = c(s.trou || '#1e2a3a');
    for (const side of [-1, 1]) out.push(P.c(T(0, side * 0.12, 0.05), T(sw * side * 0.25, side * 0.13, 0.85), 0.09, trou));
    out.push(P.e(...T(0, 0, -0.32), [T(1, 0, 0), T(0, 1, 0), T(0, 0, 1)], [0.16, 0.24, 0.36], suit));
    for (const side of [-1, 1]) out.push(P.c(T(0, side * 0.28, -0.55), T(-sw * side * 0.2 + (s.reach && side > 0 ? 0.35 : 0), side * 0.32, -0.05), 0.07, suit));
    out.push(P.s(...T(0, 0, -0.86), 0.15, skin));
    if (s.hat) out.push(P.e(...T(-0.02, 0, -0.96), [T(1, 0, 0), T(0, 1, 0), T(0, 0, 1)], [0.15, 0.15, 0.09], c(s.hat)));
    else out.push(P.e(...T(-0.04, 0, -0.93), [T(1, 0, 0), T(0, 1, 0), T(0, 0, 1)], [0.14, 0.15, 0.1], hair));
    if (s.vest) out.push(P.e(...T(0.03, 0, -0.38), [T(1, 0, 0), T(0, 1, 0), T(0, 0, 1)], [0.15, 0.25, 0.2], c(s.vest), { e: [0.05, 0.05, 0.0] }));
    return out;
  };

  // ------------------------------------------------------------------ machines and wrecks
  const AX = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  MD.box = (x, y, z, hx, hy, hz, hex, o) => P.b(x, y, z, AX, [hx, hy, hz], c(hex), o);
  MD.cage = function (s) {
    const out = [], paint = c(s.paint || '#c45a1a'), h = 1.1, w = 0.95;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) out.push(P.c([sx * w, sy * w, -h], [sx * w, sy * w, h], 0.05, paint, { m: 3 }));
    for (const z of [-h, 0, h]) {
      out.push(P.c([-w, -w, z], [w, -w, z], 0.05, paint)); out.push(P.c([-w, w, z], [w, w, z], 0.05, paint));
      out.push(P.c([-w, -w, z], [-w, w, z], 0.05, paint)); out.push(P.c([w, -w, z], [w, w, z], 0.05, paint));
    }
    out.push(MD.box(0, 0, h + 0.04, w, w, 0.04, '#3a3f44'));
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) out.push(P.c([sx * w, sy * w, -h], [0, 0, -h - 0.9], 0.025, c('#8a8a8a')));
    out.push(P.s(0, 0, -h - 0.9, 0.1, c('#8a8a8a'), { m: 3 }));
    if (s.lit) out.push(P.s(w, -w, -h, 0.07, c('#ffffff'), { e: [1.2, 1.0, 0.6] }));
    return out;
  };
  MD.aframe = function () {
    const out = [], y = c('#d8a020');
    for (const sy of [-1, 1]) out.push(P.c([1.2, sy * 3.2, 0], [-0.6, sy * 2.6, -6.2], 0.18, y, { m: 3 }));
    out.push(P.c([-0.6, -2.6, -6.2], [-0.6, 2.6, -6.2], 0.2, y, { m: 3 }));
    out.push(P.s(-0.6, 0, -6, 0.3, c('#404040'), { m: 3 }));
    return out;
  };
  MD.table = function (s) {
    const out = [MD.box(0, 0, -0.95, 0.6, 0.4, 0.04, '#5a4632'), MD.box(0, 0, -0.5, 0.05, 0.05, 0.45, '#333333')];
    out.push(MD.box(0.05, 0, -1.02, 0.22, 0.16, 0.015, '#222428'));
    out.push(P.b(-0.1, 0, -1.16, P.basis(0.4, 0, -1), [0.01, 0.16, 0.13], c('#111111'), { e: s.on ? [0.3, 0.45, 0.55] : null }));
    out.push(MD.box(0.25, -0.2, -0.99, 0.08, 0.05, 0.03, '#d0c8a0')); // dossier
    // tarp overhead
    out.push(P.b(0, 0, -2.3, AX, [1.1, 0.9, 0.02], c('#2d4a6a')));
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) out.push(P.c([sx, sy * 0.8, -2.3], [sx, sy * 0.8, 0], 0.03, c('#777777')));
    return out;
  };
  MD.locker = function () {
    return [MD.box(0, 0, -1.1, 0.5, 0.8, 1.1, '#3d4a55', { m: 3 }), MD.box(0.51, 0, -1.1, 0.01, 0.7, 1.0, '#2a333b')];
  };
  MD.magpie = function (s) {
    const out = [], yel = c('#d8b020'), fr = c('#3a3a3a');
    out.push(MD.box(0, 0, -0.45, 1.25, 0.8, 0.35, '#d8b020'));               // syntactic foam block
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) out.push(P.c([sx * 1.2, sy * 0.75, -0.1], [sx * 1.2, sy * 0.75, 0.75], 0.06, fr, { m: 3 }));
    out.push(P.c([-1.2, -0.75, 0.75], [1.2, -0.75, 0.75], 0.06, fr)); out.push(P.c([-1.2, 0.75, 0.75], [1.2, 0.75, 0.75], 0.06, fr));
    out.push(P.c([1.2, -0.75, 0.75], [1.2, 0.75, 0.75], 0.06, fr)); out.push(P.c([-1.2, -0.75, 0.75], [-1.2, 0.75, 0.75], 0.06, fr));
    out.push(P.s(1.25, 0, 0.35, 0.22, c('#0b1418'), { m: 1 }));              // camera dome
    for (const sy of [-1, 1]) out.push(P.s(1.28, sy * 0.5, 0.0, 0.12, c('#ffcc88'), { e: s.lamps ? [2.6, 1.1, 0.2] : null, m: 5 }));
    out.push(P.c([1.0, 0.4, 0.5], [1.6, 0.7, 0.8], 0.05, fr)); out.push(P.c([1.6, 0.7, 0.8], [1.9, 0.5, 1.0], 0.04, fr)); // arm
    // stripped thruster mounts and the nest packed into the frame
    for (let k = 0; k < 7; k++) out.push(P.e(-0.6 + k * 0.2, (k % 3 - 1) * 0.3, 0.5, [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [0.25, 0.12, 0.08], c(k % 2 ? '#2c3a1a' : '#4d6128')));
    out.push(P.e(-0.2, 0.35, 0.45, AX, [0.22, 0.16, 0.1], c('#e8c020'))); // the child's raincoat
    if (s.wren) out.push(P.c([0.1, 0, 0.3], [0.4, 0, 0.3], 0.08, c('#ff7a1a'), { e: s.wrenGlow ? [0.4, 0.15, 0.02] : null }));
    return out;
  };
  MD.wren = () => [P.c([-0.15, 0, 0], [0.15, 0, 0], 0.08, c('#ff7a1a'), { m: 3 }), P.s(0.17, 0, 0, 0.06, c('#202020'))];
  // Hardsuit helmet lying in the silt. era: 'mara' | '94' | '71' | 'old'
  MD.helmet = function (s) {
    const out = [], shell = c(s.era === '94' ? '#c8a020' : s.era === '71' ? '#8a8f96' : s.era === 'old' ? '#6a6050' : '#9aa2ab');
    const yaw = s.yaw || 0, T = frame(yaw, s.tilt || 0.6);
    out.push(P.s(...T(0, 0, 0), 0.35, shell, { m: 3 }));
    const v = P.s(...T(0.14, 0, 0), 0.27, c('#0b1a1f'), { m: 1, e: s.hud ? [0.5, 0.25, 0.02] : null });
    if (s.hud) v.emFn = (nu, nw) => (Math.abs(nu) < 0.15 && Math.abs(nw) < 0.15) ? 1 : 0;
    if (s.cracked) v.tex = (pu, pw) => { const a = Math.atan2(pw, pu); return (Math.abs(Math.sin(a * 5)) < 0.12 || Math.abs(Math.sin(a * 3 + 1)) < 0.08) ? 4 : 1; };
    out.push(v);
    out.push(P.e(...T(-0.02, 0, 0.3), [T(1, 0, 0), T(0, 1, 0), T(0, 0, 1)], [0.3, 0.34, 0.07], c('#3a3f47')));
    if (s.stencil) out.push(P.s(...T(-0.05, 0.3, 0.28), 0.045, c('#ffb43a'), { e: [0.2, 0.1, 0.01] }));
    return out;
  };
  MD.bell = function (s) {
    const out = [], y = c('#c8a020');
    out.push(P.e(0, 0, -0.4, AX, [1.3, 1.3, 1.1], y, { m: 3 }));
    out.push(P.e(0, 0, 0.55, AX, [1.35, 1.35, 0.18], c('#3a3a3a')));
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; out.push(P.s(Math.cos(a) * 1.15, Math.sin(a) * 1.15, -0.5, 0.18, c('#0b1418'), { m: 1, e: s.lit && k === 1 ? [0.15, 0.12, 0.05] : null })); }
    out.push(P.c([0, 0, -1.5], [0, 0, -2.2], 0.08, c('#555555')));
    out.push(P.s(0, 0, -2.25, 0.15, c('#555555'), { m: 3 }));
    return out;
  };
  MD.vigil = function () {
    const out = [], grey = c('#7a8088');
    out.push(P.e(0, 0, -3.2, [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [8.5, 2.6, 2.4], grey, { m: 3, tex: (pu, pw) => 0.85 + 0.15 * Math.sin(pu * 9) }));
    out.push(P.e(6.6, 0, -4.3, AX, [1.4, 0.9, 0.5], c('#5a6068')));       // conning tower
    out.push(P.s(0, 0, 0.3, 1.15, c('#3a3f44'), { m: 3 }));                  // crew sphere
    out.push(P.s(0.95, 0, 0.45, 0.22, c('#0b1418'), { m: 1 }));              // viewport
    out.push(P.e(0, -0.9, -0.25, P.basis(0, -1, -0.6), [0.36, 0.36, 0.06], c('#3a3f44'))); // open hatch
    for (const sx of [-3.6, 3.6]) out.push(P.c([sx, 0, -1.2], [sx, 0, 0.6], 0.35, c('#5a6068')));     // ballast silos
    return out;
  };
  MD.lander = function () {
    const out = [], fr = c('#9aa2ab');
    for (let k = 0; k < 3; k++) { const a = k * 2.094; out.push(P.c([0, 0, -1.4], [Math.cos(a) * 1.3, Math.sin(a) * 1.3, 0.2], 0.05, fr, { m: 3 })); }
    for (let k = 0; k < 3; k++) { const a = k * 2.094 + 1; out.push(P.s(Math.cos(a) * 0.4, Math.sin(a) * 0.4, -1.8, 0.28, c('#e0601a'), { m: 3 })); }
    out.push(MD.box(0, 0, -0.6, 0.35, 0.35, 0.3, '#2a2e33'));
    out.push(P.s(0.4, 0, -0.9, 0.12, c('#0b1418'), { m: 1 }));
    out.push(MD.box(0.9, 0.4, 0.0, 0.3, 0.3, 0.25, '#555a5f'));             // bait cage
    return out;
  };
  MD.transponder = function (s) {
    const blink = s.blink ? [1.6, 0.8, 0.12] : null;
    return [P.c([0, 0, -0.1], [0, 0, 0.4], 0.12, c('#d8b020'), { m: 3 }), P.c([0, 0, -0.1], [0, 0, -0.7], 0.012, c('#888888')), P.s(0, 0, -0.72, 0.05, c('#ff9a2e'), { e: blink })];
  };
  MD.debris = function (s) {
    const r = B.rng(s.seed || 1), out = [];
    const n = 4 + r.int(0, 4);
    for (let k = 0; k < n; k++) {
      const x = r.range(-2.5, 2.5), y = r.range(-2, 2), z = r.range(-0.6, 0.6);
      const kind = r();
      if (kind < 0.5) out.push(P.b(x, y, z, P.basis(r.range(-1, 1), r.range(-1, 1), r.range(-0.3, 0.3)), [r.range(0.4, 1.4), r.range(0.3, 0.9), r.range(0.05, 0.2)], c(r() < 0.5 ? '#5d6266' : '#7a4a2a'), { m: 3 }));
      else if (kind < 0.8) out.push(P.c([x, y, z], [x + r.range(-1.5, 1.5), y + r.range(-1, 1), z + r.range(-0.4, 0.4)], r.range(0.08, 0.2), c('#4a4a52'), { m: 3 }));
      else out.push(P.b(x, y, z, P.basis(r.range(-1, 1), r.range(-1, 1), 0), [0.5, 0.5, 0.45], c('#6b4a33')));
    }
    return out;
  };
  MD.carcass = function (s) {
    const out = [];
    out.push(P.e(0, 0, -0.4, P.basis(Math.cos(s.yaw || 0), Math.sin(s.yaw || 0), 0), [4.5, 1.6, 0.9], c('#8a7a78'), { tex: (pu, pw) => 0.7 + 0.3 * B.noise2(pu * 3, pw * 3, 7) }));
    return out;
  };
  // Small pickups
  MD.item = function (kind, t) {
    const bob = Math.sin(t * 2) * 0.05;
    switch (kind) {
      case 'o2': return [P.c([-0.2, 0, bob], [0.2, 0, bob], 0.08, c('#2f907c'), { m: 3 }), P.s(0.24, 0, bob, 0.05, c('#dddddd'))];
      case 'lime': return [P.c([0, 0, -0.15 + bob], [0, 0, 0.12 + bob], 0.1, c('#d8d8d0'), { m: 3 })];
      case 'ti': return [P.b(0, 0, bob, P.basis(1, 0.4, 0), [0.35, 0.12, 0.04], c('#9aa2ab'), { m: 3 })];
      case 'cer': return [P.b(0, 0, bob, P.basis(0.3, 1, 0), [0.25, 0.25, 0.02], c('#e8e4dc'), { m: 3 })];
      case 'foam': return [P.b(0, 0, bob, AX, [0.22, 0.18, 0.14], c('#d8c040'))];
      case 'cu': return [P.e(0, 0, bob, AX, [0.18, 0.18, 0.07], c('#b06a2a'), { m: 3 })];
      case 'cell': return [P.b(0, 0, bob, AX, [0.16, 0.1, 0.08], c('#2c3fa8'), { m: 3 })];
      case 'glass': return [P.s(0, 0, bob, 0.16, c('#93c8da'), { m: 1, e: [0.05, 0.12, 0.16] })];
      case 'flare': return [P.c([-0.15, 0, bob], [0.15, 0, bob], 0.04, c('#c83a22'))];
      case 'shell': return [P.c([-0.07, 0, bob], [0.07, 0, bob], 0.035, c('#d0a040'), { m: 3 })];
      case 'air': return [P.c([-0.25, 0, bob], [0.25, 0, bob], 0.09, c('#5d6266'), { m: 3 })];
      case 'chitin': return [P.e(0, 0, bob, AX, [0.25, 0.15, 0.05], c('#c8b896'))];
      case 'tape': { // a recorder: two reels behind a window and a red record light that still blinks
        const on = Math.sin(t * 4) > 0 ? [0.9, 0.05, 0.02] : null;
        return [P.b(0, 0, bob, P.basis(1, 0.2, 0), [0.2, 0.12, 0.05], c('#3a3f47'), { m: 3 }), P.s(-0.07, 0.01, bob - 0.05, 0.045, c('#9aa2ab')), P.s(0.07, 0.01, bob - 0.05, 0.045, c('#9aa2ab')), P.s(0.16, -0.06, bob - 0.04, 0.02, c('#5c1414'), on ? { e: on } : {})];
      }
      case 'log': return [P.b(0, 0, bob, P.basis(1, 0.3, 0), [0.18, 0.13, 0.02], c('#2a2a2e')), P.s(0.12, 0, bob - 0.03, 0.025, c('#ffb43a'), { e: [0.4, 0.2, 0.02] })];
      case 'lung': return [P.e(0, 0, bob, AX, [0.3, 0.22, 0.12 + Math.sin(t * 0.42 * Math.PI) * 0.04], c('#2a2a2a')), P.c([0.3, 0, bob], [0.5, 0.1, bob], 0.03, c('#2a2a2a'))];
      case 'hand': return [P.b(0, 0, bob, P.basis(1, 0.2, 0), [0.3, 0.22, 0.02], c('#1c1c1c')), P.c([0.1, 0.1, bob - 0.06], [0.35, 0.05, bob - 0.1], 0.06, c('#d8d0bc'))];
      case 'eye': return [P.s(0, 0, bob, 0.15, c('#0b1418'), { m: 1 }), P.c([-0.25, 0, bob], [0, 0, bob], 0.09, c('#d8b020'), { m: 3 })];
      case 'shard': return [P.b(0, 0, bob, P.basis(1, 1, -0.3), [0.12, 0.06, 0.01], c('#c4e6ee'), { m: 1, e: [0.3, 0.4, 0.45], emFn: () => 0.5 + 0.5 * Math.sin(t * 5) })];
      case 'wren': return MD.wren();
      default: return [P.s(0, 0, bob, 0.12, c('#888888'))];
    }
  };

  // ------------------------------------------------------------------ fauna
  MD.squid = function (s) {
    // glass squid (translucent, blue spots) or mourning squid (dark, blue-tipped web)
    const T = frame(s.yaw || 0, 0), out = [], mourning = s.kind === 'mourning';
    const body = mourning ? c('#3b1418') : c('#a8c8d0');
    out.push(P.e(...T(0, 0, 0), [T(1, 0, 0), T(0, 1, 0), T(0, 0, 1)], mourning ? [0.32, 0.22, 0.22] : [0.45, 0.14, 0.14], body, { m: mourning ? 0 : 1, e: mourning ? null : [0.02, 0.08, 0.12] }));
    if (mourning) out.push(P.e(...T(-0.3, 0, 0.05), [T(1, 0, 0), T(0, 1, 0), T(0, 0, 1)], [0.12, 0.42, 0.42], c('#2a0c10'), { e: [0.05, 0.25, 0.6], emFn: (nu, nw) => Math.abs(nu) + Math.abs(nw) > 0.9 ? 1 : 0 }));
    out.push(P.s(...T(0.35, 0.08, -0.05), 0.04, c('#000000')));
    if (s.stunned) out.push(P.s(...T(0, 0, -0.3), 0.04, c('#ffffff'), { e: [0.4, 0.4, 0.4] }));
    return out;
  };
  MD.slimewife = function (s) {
    const out = [], ph = s.t || 0, col2 = c('#8a6070');
    for (let k = 0; k < 7; k++) { const u = k * 0.18; out.push(P.s(Math.cos(s.yaw) * u + Math.sin(ph * 3 + k) * 0.08, Math.sin(s.yaw) * u + Math.cos(ph * 3 + k) * 0.08, Math.sin(ph * 4 + k * 0.8) * 0.06, 0.07 - k * 0.006, col2)); }
    return out;
  };
  // A corpse: a hardsuit (or a 1971 crewman) lying where it fell. Drawn unlit through a dead palette.
  MD.corpse = function (s) {
    if (s.era === 'mara') return MD.diver({ yaw: s.yaw, pitch: -1.4, plain: null, dead: true, t: 0, cracked: true });
    const shell = s.era === '94' ? ['#c8a020', '#6a5010', '#202020'] : ['#8a8f96', '#4a4f56', '#202020'];
    const T = frame(s.yaw || 0, -1.35), out = [];
    out.push(P.e(...T(0, 0, 0), [T(1, 0, 0), T(0, 1, 0), T(0, 0, 1)], [0.3, 0.36, 0.5], c(shell[1])));
    out.push(P.s(...T(0, 0, -0.7), 0.3, c(shell[0])));
    out.push(P.s(...T(0.12, 0, -0.7), 0.22, c(shell[2])));
    for (const side of [-1, 1]) {
      out.push(P.c(T(0, side * 0.4, -0.3), T(0.3, side * 0.85, 0.1), 0.1, c(shell[1])));
      out.push(P.c(T(0, side * 0.2, 0.4), T(0.1, side * 0.35, 1.1), 0.12, c(shell[1])));
    }
    return out;
  };
})(window.B);
