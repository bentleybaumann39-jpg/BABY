/* life.js — the ambient ecosystem. Three layers, none of them scripted:
 *  1. Wake light: dinoflagellates flare where anything moves fast, the diver's fins and the things
 *     hunting her alike, so a blue smear in the dark is sometimes the only warning.
 *  2. Drifters: mid-water animals kept in a loose ring around the diver and recycled as she moves.
 *     Most are invisible until the lamp finds them; a few make their own light.
 *  3. Benthos: seabed fauna scattered over whatever floor is in view, placed by a hash of the ground
 *     cell so a sea pen is still there when you come back for it. */
'use strict';
(function (B) {
  const M = B.M, R = B.R, E = B.E, MD = B.MD, P = R.P;
  const Lf = B.Life = {};
  const cache = {}, c = h => cache[h] || (cache[h] = B.linHex(h));
  const H = (x, y) => B.World.H(B.map, x, y);
  const pl = () => B.player;
  const AXV = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

  // ------------------------------------------------------------------ 1. wake light
  const SMAX = 420, SX = new Float32Array(SMAX), SY = new Float32Array(SMAX), SZ = new Float32Array(SMAX);
  const SVX = new Float32Array(SMAX), SVY = new Float32Array(SMAX), SVZ = new Float32Array(SMAX);
  const SA = new Float32Array(SMAX), SL = new Float32Array(SMAX), SC = new Uint8Array(SMAX);
  let sn = 0;
  // colour per kind: dinoflagellate blue-green, sea-pen violet, bamboo-coral blue, pyrosome blue-white
  const SCOL = [[0.12, 0.75, 1.1], [0.6, 0.25, 1.2], [0.15, 0.45, 1.4], [0.5, 0.8, 1.4]];
  Lf.spark = function (x, y, z, vx, vy, vz, life, kind) {
    if (sn >= SMAX) return;
    SX[sn] = x; SY[sn] = y; SZ[sn] = z; SVX[sn] = vx; SVY[sn] = vy; SVZ[sn] = vz; SA[sn] = 0; SL[sn] = life; SC[sn] = kind || 0; sn++;
  };
  Lf.burst = function (x, y, z, n, spread, kind) {
    for (let k = 0; k < n; k++) Lf.spark(x + M.rnd(-spread, spread), y + M.rnd(-spread, spread), z + M.rnd(-spread, spread) * 0.6, M.rnd(-0.4, 0.4), M.rnd(-0.4, 0.4), M.rnd(-0.2, 0.2), M.rnd(0.6, 1.6), kind);
  };
  // how much living light there is at a depth: none in the sunlit zone, most in the mid-water
  function wakeDensity(z) { if (B.act === 'deck' || z < 180) return 0; if (z < 300) return (z - 180) / 120; if (B.act === 'act3') return 0.45; return 1; }
  const HUNTERS = { sleeper: 1, reliquary: 1, squid: 0.6, double: 1, grain: 0.4, ghost: 0.8 };
  function sparksUpdate(dt) {
    const Pp = pl();
    if (Pp && !Pp.dead && !B.Story.hideBody) {
      const dens = wakeDensity(Pp.z), sp = Math.hypot(Pp.vx, Pp.vy, Pp.vz);
      const rate = dens * (Pp.thrust * 26 + (Pp.boost ? 40 : 0) + Math.max(0, sp - 1.2) * 20);
      let n = rate * dt; while (n > 0) {
        if (Math.random() < n) {
          const back = 0.55 + Math.random() * 0.35, cy = Math.cos(Pp.yaw), sy = Math.sin(Pp.yaw), side = M.rnd(-0.25, 0.25);
          Lf.spark(Pp.x - cy * back - sy * side, Pp.y - sy * back + cy * side, Pp.z + M.rnd(0, 0.5), -cy * 0.6 + M.rnd(-0.3, 0.3), -sy * 0.6 + M.rnd(-0.3, 0.3), M.rnd(-0.15, 0.15), M.rnd(0.7, 1.7), 0);
        }
        n -= 1;
      }
      // anything big moving fast through living water lights it up
      for (const e of E.list) {
        const w = e.alive && HUNTERS[e.type]; if (!w) continue;
        const ev = Math.hypot(e.vx || 0, e.vy || 0, e.vz || 0); if (ev < 0.8) continue;
        const d = Math.hypot(e.x - Pp.x, e.y - Pp.y); if (d > 40) continue;
        const dz = wakeDensity(e.z); if (Math.random() < dt * ev * 14 * w * dz) Lf.spark(e.x + M.rnd(-0.8, 0.8), e.y + M.rnd(-0.8, 0.8), e.z + M.rnd(-0.6, 0.6), -e.vx * 0.2, -e.vy * 0.2, 0, M.rnd(0.8, 1.8), 0);
      }
    }
    for (let k = 0; k < sn; k++) {
      SA[k] += dt;
      if (SA[k] >= SL[k]) { sn--; SX[k] = SX[sn]; SY[k] = SY[sn]; SZ[k] = SZ[sn]; SVX[k] = SVX[sn]; SVY[k] = SVY[sn]; SVZ[k] = SVZ[sn]; SA[k] = SA[sn]; SL[k] = SL[sn]; SC[k] = SC[sn]; k--; continue; }
      const dr = Math.exp(-dt * 2.2); SVX[k] *= dr; SVY[k] *= dr; SVZ[k] *= dr;
      SX[k] += SVX[k] * dt; SY[k] += SVY[k] * dt; SZ[k] += SVZ[k] * dt;
    }
  }
  function sparksDraw() {
    for (let k = 0; k < sn; k++) {
      const a = SA[k] / SL[k], fl = a < 0.12 ? a / 0.12 : (1 - a) * (1 - a) * 1.3, tw = 0.75 + 0.25 * Math.sin(SA[k] * 31 + k);
      const col = SCOL[SC[k]], kk = fl * tw * 0.55;
      R.point(SX[k], SY[k], SZ[k], 1, col[0] * kk, col[1] * kk, col[2] * kk, 2);
    }
  }

  // ------------------------------------------------------------------ 2. drifters
  // weights per depth band: [atolla, comb, siphonophore, lanternfish, pyrosome, dragonfish]
  function drifterTable(z) {
    if (B.act === 'act3') return { n: 5, w: [3, 1, 1, 0, 1, 0] };
    if (z < 200) return { n: 0, w: [0, 0, 0, 0, 0, 0] };
    if (z < 420) return { n: 7, w: [0, 4, 1, 5, 0, 0] };
    if (z < 1000) return { n: 11, w: [2, 3, 2, 4, 1, 0] };
    if (z < 2000) return { n: 14, w: [3, 3, 3, 3, 2, 1] };
    return { n: 12, w: [3, 2, 3, 2, 2, 1] };
  }
  const KINDS = ['atolla', 'comb', 'siph', 'lfish', 'pyro', 'dragon'];
  function pick(w) { let t = 0; for (const v of w) t += v; let r = Math.random() * t; for (let k = 0; k < w.length; k++) { r -= w[k]; if (r <= 0) return k; } return 0; }
  const lit = (x, y, z) => R.lightAt(x, y, z);
  // Is the lamp beam on this point (and close enough to matter)?
  function inBeam(x, y, z, range) {
    const L = R.env.lamp; if (!L.on) return 0;
    const dx = x - L.x, dy = y - L.y, dz = z - L.z, d = Math.hypot(dx, dy, dz); if (d > (range || Math.sqrt(L.r2))) return 0;
    return (dx * L.dx + dy * L.dy + dz * L.dz) / (d || 1) > L.cosO ? 1 - d / Math.sqrt(L.r2) : 0;
  }
  function hue(h) { h = ((h % 1) + 1) % 1; const k = n => { const v = (n + h * 6) % 6; return Math.max(0, Math.min(1, Math.min(v, 4 - v))); }; return [k(5), k(3), k(1)]; }

  const DR = {
    atolla: {
      init(d) { d.r = M.rnd(0.35, 0.6); d.alarm = 0; d.ph = Math.random() * 6; },
      update(d, dt, Pp) {
        d.ph += dt * 1.6; d.z += Math.sin(d.ph) * dt * 0.08;
        const near = Math.hypot(d.x - Pp.x, d.y - Pp.y, d.z - Pp.z);
        if (d.alarm <= 0 && (near < 3.5 || inBeam(d.x, d.y, d.z, 9) > 0.15)) { d.alarm = 5; B.A && B.A.at && B.A.at('jelly', d.x, d.y, d.z, 0.4); }
        d.alarm -= dt;
      },
      draw(d) {
        const pulse = 1 - Math.max(0, Math.sin(d.ph)) * 0.18, r = d.r * pulse;
        if (lit(d.x, d.y, d.z) > 0.02) R.model(d.x, d.y, d.z, [P.e(0, 0, 0, AXV, [r, r, r * 0.35], c('#5c1414'), { m: 1 }), P.e(0, 0, -r * 0.2, AXV, [r * 0.45, r * 0.45, r * 0.3], c('#922218'), { m: 1 })], { outline: false });
        // the pinwheel: a rotating wave of blue around the rim, the "burglar alarm" that calls bigger things
        const n = 20, al = d.alarm > 0;
        for (let k = 0; k < n; k++) {
          const a = k / n * Math.PI * 2, wave = al ? Math.max(0, Math.cos(a - B.time * 9)) ** 3 : (0.3 + 0.2 * Math.sin(B.time * 0.7 + k)) * 0.55;
          const kk = (al ? 1.6 * Math.min(1, d.alarm / 1.5) : 1) * wave; if (kk < 0.03) continue;
          R.point(d.x + Math.cos(a) * r * 1.05, d.y + Math.sin(a) * r * 1.05, d.z, 1, 0.12 * kk, 0.45 * kk, 1.3 * kk, 2);
        }
      },
    },
    comb: {
      init(d) { d.len = M.rnd(0.18, 0.32); d.yaw = Math.random() * 6.28; d.ph = Math.random() * 6; },
      update(d, dt) { d.ph += dt; d.yaw += Math.sin(d.ph * 0.3) * dt * 0.2; d.x += Math.cos(d.yaw) * dt * 0.05; d.y += Math.sin(d.yaw) * dt * 0.05; },
      draw(d) {
        const L = lit(d.x, d.y, d.z); if (L < 0.015) return;
        const T = MD.frame(d.yaw, -1.2), a = d.len, k = Math.min(1, L * 3);
        R.model(d.x, d.y, d.z, [P.e(...T(0, 0, 0), [T(1, 0, 0), T(0, 1, 0), T(0, 0, 1)], [a, a * 0.62, a * 0.62], c('#a8c8d0'), { m: 1 })], { outline: false, alpha: 0.55 });
        // eight comb rows scatter the lamp into running rainbows
        for (let r = 0; r < 8; r++) {
          const th = r / 8 * Math.PI * 2;
          for (let s = 1; s < 6; s++) {
            const u = -a + s / 6 * 2 * a, rad = Math.sqrt(Math.max(0, 1 - (u / a) ** 2)) * a * 0.64;
            const p = T(u, Math.cos(th) * rad, Math.sin(th) * rad), col = hue(r / 8 + s * 0.08 - B.time * 1.4), kk = k * 0.9;
            R.point(d.x + p[0], d.y + p[1], d.z + p[2], 1, col[0] * kk, col[1] * kk, col[2] * kk, 2);
          }
        }
      },
    },
    siph: {
      init(d) { d.n = 10 + Math.floor(Math.random() * 18); d.yaw = Math.random() * 6.28; d.slope = M.rnd(-0.3, 0.3); d.ph = Math.random() * 10; d.pulse = -1; },
      update(d, dt, Pp) {
        d.ph += dt; d.yaw += Math.sin(d.ph * 0.13) * dt * 0.05; d.x += Math.cos(d.yaw) * dt * 0.08; d.y += Math.sin(d.yaw) * dt * 0.08;
        if (d.pulse < 0 && (Math.random() < dt * 0.08 || (Math.hypot(d.x - Pp.x, d.y - Pp.y, d.z - Pp.z) < 6 && Math.random() < dt * 0.8))) d.pulse = 0;
        if (d.pulse >= 0) { d.pulse += dt * 9; if (d.pulse > d.n + 6) d.pulse = -1; }
      },
      node(d, k) { const t = k * 0.32, w = Math.sin(t * 0.6 + d.ph * 0.5) * 0.6; return [d.x + Math.cos(d.yaw) * t - Math.sin(d.yaw) * w, d.y + Math.sin(d.yaw) * t + Math.cos(d.yaw) * w, d.z + t * d.slope + Math.sin(t * 0.4 + d.ph) * 0.3]; },
      draw(d) {
        const L = lit(d.x, d.y, d.z);
        let prev = null;
        for (let k = 0; k < d.n; k++) {
          const p = DR.siph.node(d, k), wave = d.pulse >= 0 ? Math.max(0, 1 - Math.abs(k - d.pulse) / 2.5) : 0, base = k === 0 ? 0.7 : 0.14 + 0.06 * Math.sin(B.time * 2 + k);
          const kk = base + wave * 1.4;
          R.point(p[0], p[1], p[2], 1, 0.15 * kk, 0.5 * kk, 1.2 * kk, 2);
          if (L > 0.02 && prev) R.line(prev[0], prev[1], prev[2], p[0], p[1], p[2], 0.6, 0.55, 0.5, false, 0.5);
          prev = p;
        }
      },
    },
    lfish: {
      init(d) {
        d.fish = []; const n = 5 + Math.floor(Math.random() * 8);
        for (let k = 0; k < n; k++) d.fish.push({ x: d.x + M.rnd(-2, 2), y: d.y + M.rnd(-2, 2), z: d.z + M.rnd(-1, 1), vx: 0, vy: 0, vz: 0, ph: Math.random() * 6 });
        d.hx = Math.cos(Math.random() * 6.28); d.hy = Math.sin(Math.random() * 6.28);
      },
      update(d, dt, Pp) {
        // the school wanders; the lamp scatters it
        const L = R.env.lamp; let cx = 0, cy = 0, cz = 0; for (const f of d.fish) { cx += f.x; cy += f.y; cz += f.z; } const n = d.fish.length; cx /= n; cy /= n; cz /= n;
        d.x = cx; d.y = cy; d.z = cz;
        for (const f of d.fish) {
          f.ph += dt * 8;
          let ax = d.hx * 0.6 + (cx - f.x) * 0.4, ay = d.hy * 0.6 + (cy - f.y) * 0.4, az = (cz - f.z) * 0.3;
          const lb = inBeam(f.x, f.y, f.z, 10);
          if (lb > 0) { const dx = f.x - L.x, dy = f.y - L.y, dl = Math.hypot(dx, dy) || 1; ax += dx / dl * 6 * lb; ay += dy / dl * 6 * lb; }
          const dp = Math.hypot(f.x - Pp.x, f.y - Pp.y, f.z - Pp.z); if (dp < 3) { ax += (f.x - Pp.x) / dp * 5; ay += (f.y - Pp.y) / dp * 5; az += (f.z - Pp.z) / dp * 2; }
          f.vx = (f.vx + ax * dt) * Math.exp(-dt * 1.5); f.vy = (f.vy + ay * dt) * Math.exp(-dt * 1.5); f.vz = (f.vz + az * dt) * Math.exp(-dt * 1.5);
          f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
        }
        if (Math.random() < dt * 0.1) { const a = Math.random() * 6.28; d.hx = Math.cos(a); d.hy = Math.sin(a); }
      },
      draw(d) {
        for (const f of d.fish) {
          const yaw = Math.atan2(f.vy, f.vx), L = lit(f.x, f.y, f.z);
          if (L > 0.02) {
            const T = MD.frame(yaw, 0);
            R.model(f.x, f.y, f.z, [P.e(...T(0, 0, 0), [T(1, 0, 0), T(0, 1, 0), T(0, 0, 1)], [0.1, 0.03, 0.04], c('#9aa2ab'), { m: 3 }), P.s(...T(-0.1, 0, 0), 0.025, c('#4a4a52'))], { outline: false });
          }
          // photophores: a dotted line along the belly, always on, very faint
          const tw = 0.6 + 0.4 * Math.sin(f.ph * 0.3);
          R.point(f.x, f.y, f.z + 0.03, 1, 0.12 * tw, 0.4 * tw, 1.0 * tw, 2);
        }
      },
    },
    pyro: {
      init(d) { d.yaw = Math.random() * 6.28; d.len = M.rnd(0.6, 1.4); d.glow = 0; d.ph = Math.random() * 6; },
      update(d, dt, Pp) {
        d.ph += dt; d.yaw += dt * 0.03; d.x += Math.cos(d.yaw) * dt * 0.04; d.y += Math.sin(d.yaw) * dt * 0.04;
        if (Math.hypot(d.x - Pp.x, d.y - Pp.y, d.z - Pp.z) < 2.5 || inBeam(d.x, d.y, d.z, 6) > 0.5) { if (d.glow < 0.2) Lf.burst(d.x, d.y, d.z, 8, d.len * 0.5, 3); d.glow = 4; }
        d.glow = Math.max(0, d.glow - dt);
      },
      draw(d) {
        const T = MD.frame(d.yaw, 0.3), a = d.len / 2, g = Math.min(1, d.glow / 2), L = lit(d.x, d.y, d.z);
        if (L > 0.02 || g > 0) R.model(d.x, d.y, d.z, [P.c(T(-a, 0, 0), T(a, 0, 0), 0.12, c('#c8708f'), { m: 1, e: [0.25 * g, 0.45 * g, 0.9 * g], emFn: (nu, nw, nf, pu) => 0.5 + 0.5 * Math.sin(pu * 30 - B.time * 6) })], { outline: false, alpha: 0.75 });
        else R.point(d.x, d.y, d.z, 1, 0.05, 0.1, 0.25, 2);
      },
    },
    dragon: {
      init(d) { d.yaw = Math.random() * 6.28; d.ph = Math.random() * 6; },
      update(d, dt, Pp) {
        d.ph += dt; const dp = Math.hypot(d.x - Pp.x, d.y - Pp.y, d.z - Pp.z);
        // it holds still and fishes; if the lamp lands on it, it is gone
        if (inBeam(d.x, d.y, d.z, 10) > 0.1 || dp < 3) { d.flee = 1.5; d.yaw = Math.atan2(d.y - Pp.y, d.x - Pp.x); }
        if (d.flee > 0) { d.flee -= dt; d.x += Math.cos(d.yaw) * dt * 3.5; d.y += Math.sin(d.yaw) * dt * 3.5; }
      },
      draw(d) {
        const T = MD.frame(d.yaw, 0), L = lit(d.x, d.y, d.z), sw = Math.sin(d.ph * 1.3) * 0.12;
        if (L > 0.02) R.model(d.x, d.y, d.z, [P.e(...T(0, 0, 0), [T(1, 0, 0), T(0, 1, 0), T(0, 0, 1)], [0.35, 0.05, 0.06], c('#16161b'), { m: 1 }), P.s(...T(0.3, 0.02, -0.01), 0.03, c('#000000'), { m: 2 })], { outline: false });
        const lure = T(0.75, sw, 0.25 + Math.abs(sw)), red = R.env.lamp.on && R.env.lamp.cr > 0.9 && R.env.lamp.cg < 0.3; // the cheek light shows only under a red lamp
        R.point(d.x + lure[0], d.y + lure[1], d.z + lure[2], 1, 0.5, 0.8, 1.3, 2);
        const ch = T(0.28, 0.04, 0); R.point(d.x + ch[0], d.y + ch[1], d.z + ch[2], 1, red ? 1.2 : 0.35, red ? 0.1 : 0.02, 0.02, 2);
      },
    },
  };

  E.life = function () {
    const sys = E.add({
      type: 'life', x: 0, y: 0, z: 0, layer: 9, drifters: [], benthos: new Map(), scanT: 0,
      update(dt) {
        sparksUpdate(dt);
        const Pp = pl(); if (!Pp || B.act === 'deck') return;
        // keep the drifter ring full, recycle anything left behind
        const tab = drifterTable(Pp.z), want = Math.round(tab.n * (B.settings.quality === 0 ? 0.6 : 1));
        for (const d of this.drifters) if (Math.hypot(d.x - Pp.x, (d.y - Pp.y) * 1.2, (d.z - Pp.z) * 0.8) > 42) d.alive = false;
        this.drifters = this.drifters.filter(d => d.alive);
        let tries = 3;
        while (this.drifters.length < want && tries-- > 0) {
          const first = this.drifters.length < want / 2 && B.time - (this.t0 || 0) < 1;
          const a = Math.random() * 6.28, r = first ? M.rnd(6, 30) : M.rnd(26, 36);
          const x = Pp.x + Math.cos(a) * r, y = Pp.y + Math.sin(a) * r * 0.8, z = Pp.z + M.rnd(-6, 16);
          if (H(x, y) < z + 3 || z < 20) continue;
          const kind = KINDS[pick(tab.w)], d = E.add({ type: 'drift', kind, x, y, z, layer: 1, draw() { DR[this.kind].draw(this); } });
          DR[kind].init(d); this.drifters.push(d);
        }
        for (const d of this.drifters) DR[d.kind].update(d, dt, Pp);
        if ((this.scanT -= dt) <= 0) { this.scanT = 0.25; benthosScan(this, Pp); }
        for (const b of this.benthos.values()) if (b.beh) b.beh(dt, Pp);
      },
      draw() { sparksDraw(); },
    });
    sys.t0 = B.time;
    sn = 0;
    return sys;
  };

  // ------------------------------------------------------------------ 3. benthos
  const CELL = 2.5;
  // What grows on a given material at a given depth. Each entry: [kind, weight].
  function benthicTable(mt, z) {
    const MAT = B.MAT;
    if (B.act === 'act1' && z < 160) return mt === MAT.SAND || mt === MAT.SED ? [['kelp', 5], ['anemone', 2], ['rock', 2], ['fan', 1]] : [['kelp', 2], ['fan', 4], ['anemone', 3], ['sponge', 1]];
    if (mt === MAT.BRINE || mt === MAT.SEA || mt === MAT.STEEL) return null;
    if (mt === MAT.BONE) return [['osedax', 4], ['bone', 3]];
    if (mt === MAT.NOD) return [['xeno', 3], ['stalk', 3], ['rock', 2], ['seapig', 1]];
    if (mt === MAT.SED || mt === MAT.SAND) return z > 3000 ? [['seapig', 3], ['tripod', 2], ['xeno', 3], ['seapen', 2], ['brittle', 3], ['mound', 3]] : [['seapen', 4], ['brittle', 3], ['mound', 2], ['anemone', 1], ['tripod', 1]];
    if (mt === MAT.BASALT) return z > 2500 ? [['tubeworm', 2], ['sponge', 3], ['bamboo', 3], ['crinoid', 2], ['rock', 2]] : [['sponge', 3], ['bamboo', 2], ['crinoid', 3], ['anemone', 2], ['rock', 2]];
    return [['crinoid', 3], ['sponge', 3], ['bamboo', 2], ['anemone', 2], ['fan', 2], ['rock', 3]];
  }
  function benthosScan(sys, Pp) {
    const map = B.map; if (!map || map.topside) return;
    const zCut = R.cam.zCut, zMax = zCut + 40, keep = new Set();
    const i0 = Math.floor((Pp.x - 26) / CELL), i1 = Math.floor((Pp.x + 26) / CELL), j0 = Math.floor((Pp.y - 14) / CELL), j1 = Math.floor((Pp.y + 30) / CELL);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const key = i * 4096 + j, hv = B.hash2(i, j, 501);
      const dens = (B.act === 'act3' ? 0.5 : Pp.z < 160 ? 0.32 : 0.62) * (B.settings.quality === 0 ? 0.6 : 1); if (hv > dens) continue;
      const x = (i + 0.2 + 0.6 * B.hash2(i, j, 502)) * CELL, y = (j + 0.2 + 0.6 * B.hash2(i, j, 503)) * CELL;
      if (x < 1 || y < 1 || x > map.size - 1 || y > map.size - 1) continue;
      const z = H(x, y); if (z < zCut + 0.3 || z > zMax) continue;
      keep.add(key);
      if (sys.benthos.has(key)) continue;
      const mt = map.mat[B.World.cellIndex ? B.World.cellIndex(map, x, y) : 0];
      const tab = benthicTable(mt, z); if (!tab) { sys.benthos.set(key, { kind: null }); continue; }
      let tot = 0; for (const t of tab) tot += t[1]; let r = B.hash2(i, j, 504) * tot, kind = tab[0][0];
      for (const t of tab) { r -= t[1]; if (r <= 0) { kind = t[0]; break; } }
      const b = E.add({ type: 'benthos', kind, x, y, z, yaw: B.hash2(i, j, 505) * 6.28, s: 0.7 + B.hash2(i, j, 506) * 0.6, seed: (hv * 1e6) | 0, glow: 0, layer: 0, draw() { drawBenthos(this); } });
      if (BU[kind]) b.beh = BU[kind];
      sys.benthos.set(key, b);
    }
    for (const [key, b] of sys.benthos) if (!keep.has(key)) { if (b.kind) b.alive = false; sys.benthos.delete(key); }
  }
  // Behaviour for the few benthic animals that do something.
  const BU = {
    seapig(dt, Pp) { this.yaw += Math.sin(B.time * 0.1 + this.seed) * dt * 0.1; const nx = this.x + Math.cos(this.yaw) * dt * 0.05, ny = this.y + Math.sin(this.yaw) * dt * 0.05; this.x = nx; this.y = ny; this.z = H(nx, ny); void Pp; },
    tripod(dt, Pp) {
      const d = Math.hypot(this.x - Pp.x, this.y - Pp.y, this.z - Pp.z);
      if (d < 2.6 && !this.flee) { this.flee = 2; this.yaw = Math.atan2(this.y - Pp.y, this.x - Pp.x); B.E.silt && B.E.silt(this.x, this.y, this.z, 1.2); }
      if (this.flee > 0) { this.flee -= dt; this.x += Math.cos(this.yaw) * dt * 2.4; this.y += Math.sin(this.yaw) * dt * 2.4; this.lift = Math.min(1, (this.lift || 0) + dt * 2); if (this.flee <= 0) { this.flee = 0; this.z = H(this.x, this.y); this.lift = 0; } }
    },
    seapen(dt, Pp) { touchGlow(this, dt, Pp, 1, 2.2); },
    bamboo(dt, Pp) { touchGlow(this, dt, Pp, 2, 2.4); },
  };
  function touchGlow(b, dt, Pp, kind, r) {
    const d = Math.hypot(b.x - Pp.x, b.y - Pp.y, b.z - 0.5 - Pp.z), mv = Math.hypot(Pp.vx, Pp.vy, Pp.vz);
    if (d < r && mv > 0.4 && b.glow < 0.5) { b.glow = 3.5; Lf.burst(b.x, b.y, b.z - 0.4 * b.s, 6, 0.3, kind); }
    b.glow = Math.max(0, b.glow - dt);
  }

  // Models. Local axes as everywhere: x east, y south, z down, so "up" is -z.
  const BM = {
    kelp(b) {
      const out = [], n = 4 + (b.seed % 3), sway = B.time * 0.9 + b.seed;
      for (let s = 0; s < 2; s++) {
        let px = (s - 1) * 0.25, py = ((b.seed >> s) % 3 - 1) * 0.2, pz = 0;
        for (let k = 0; k < n; k++) {
          const t = k / n, nx = px + Math.sin(sway + k * 0.6 + s) * 0.22 * t + 0.08, ny = py + Math.cos(sway * 0.7 + k * 0.5) * 0.12 * t, nz = pz - 0.8 * b.s;
          out.push(P.c([px, py, pz], [nx, ny, nz], 0.05, c(k % 2 ? '#4d6128' : '#7a8f3b')));
          if (k % 2) out.push(P.e(nx + 0.14, ny, nz, P.basis(1, 0.3, -0.4), [0.2, 0.07, 0.015], c('#7a8f3b')));
          px = nx; py = ny; pz = nz;
        }
      }
      return out;
    },
    fan(b) { const T = MD.frame(b.yaw, 0); return [P.c(T(0, 0, 0), T(0, 0, -0.25), 0.03, c('#6b4a33')), P.e(...T(0, 0, -0.6 * b.s), [T(0, 1, 0), T(0, 0, 1), T(1, 0, 0)], [0.55 * b.s, 0.45 * b.s, 0.03], c('#c06a3a'), { tex: (pu, pw) => ((Math.abs(Math.sin(pu * 40)) > 0.75 || Math.abs(Math.sin(pw * 40 + pu * 10)) > 0.8) ? 1 : 0.35) })]; },
    anemone(b) {
      const out = [P.c([0, 0, 0], [0, 0, -0.18 * b.s], 0.12 * b.s, c(b.seed % 2 ? '#c83a22' : '#d3a46f'))], sw = Math.sin(B.time * 1.3 + b.seed) * 0.03;
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; out.push(P.c([Math.cos(a) * 0.1 * b.s, Math.sin(a) * 0.1 * b.s, -0.18 * b.s], [Math.cos(a) * 0.22 * b.s + sw, Math.sin(a) * 0.22 * b.s, -0.26 * b.s], 0.025, c('#f2b8cb'))); }
      return out;
    },
    sponge(b) { // glass sponge: a lattice vase
      const h = 0.7 * b.s; return [P.c([0, 0, 0], [0, 0, -h], 0.13 * b.s, c('#e8e4d8'), { m: 1, tex: (pu, pw) => (Math.abs(Math.sin(pu * 70)) > 0.8 || Math.abs(Math.sin(pw * 70)) > 0.8 ? 1.1 : 0.45) }), P.s(0, 0, -h, 0.09 * b.s, c('#4a4a52'))];
    },
    crinoid(b) {
      const out = [], h = 0.9 * b.s, col = c(b.seed % 3 ? '#d0b040' : '#a04060'), sw = Math.sin(B.time * 0.8 + b.seed) * 0.05;
      out.push(P.c([0, 0, 0], [sw, 0, -h], 0.025, c('#8a5d3a')));
      for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28 + b.yaw; out.push(P.c([sw, 0, -h], [sw + Math.cos(a) * 0.3 * b.s, Math.sin(a) * 0.3 * b.s, -h + 0.15 + Math.sin(B.time + k) * 0.03], 0.03, col)); }
      return out;
    },
    bamboo(b) {
      const out = [], g = b.glow > 0 ? Math.min(1, b.glow) : 0; let px = 0, py = 0, pz = 0;
      for (let k = 0; k < 5; k++) {
        const nx = px + Math.cos(b.yaw + k * 1.7) * 0.15, ny = py + Math.sin(b.yaw + k * 1.7) * 0.1, nz = pz - 0.28 * b.s;
        out.push(P.c([px, py, pz], [nx, ny, nz], 0.035, c('#e8e4dc'), { m: 1 }));
        out.push(P.s(nx, ny, nz, 0.05, c('#2a2622'), g ? { e: [0.1 * g, 0.4 * g, 1.4 * g] } : {}));
        px = nx; py = ny; pz = nz;
      }
      return out;
    },
    seapen(b) {
      const h = 0.75 * b.s, g = b.glow > 0 ? Math.min(1, b.glow / 1.5) : 0, sw = Math.sin(B.time * 0.6 + b.seed) * 0.06;
      return [P.c([0, 0, 0], [sw, 0, -h], 0.025, c('#c8a0b0')), P.e(sw, 0, -h - 0.15, P.basis(0, 0, 1), [0.2 * b.s, 0.09 * b.s, 0.03], c('#e0b0c0'), { m: 1, e: g ? [0.6 * g, 0.25 * g, 1.2 * g] : null, emFn: (nu, nw, nf, pu, pw) => 0.5 + 0.5 * Math.sin(pw * 60 + B.time * 5) })];
    },
    brittle(b) { const out = [P.e(0, 0, 0, AXV, [0.06, 0.06, 0.02], c('#c09070'))]; for (let k = 0; k < 5; k++) { const a = b.yaw + k / 5 * 6.28, w = Math.sin(B.time * 0.7 + k + b.seed) * 0.4; out.push(P.c([Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0], [Math.cos(a + w * 0.3) * 0.32 * b.s, Math.sin(a + w * 0.3) * 0.32 * b.s, -0.02], 0.015, c('#c09070'))); } return out; },
    mound(b) { return [P.e(0, 0, 0.05, AXV, [0.3 * b.s, 0.3 * b.s, 0.12], c('#8c8270')), P.s(0, 0, -0.08, 0.05, c('#16161b'), { m: 4 })]; },
    xeno(b) { const out = [], r = B.rng(b.seed); for (let k = 0; k < 4; k++) out.push(P.s(r.range(-0.12, 0.12) * b.s, r.range(-0.12, 0.12) * b.s, -0.08 - k * 0.04, r.range(0.08, 0.14) * b.s, c('#b0a890'))); return out; },
    stalk(b) { return [P.c([0, 0, 0], [0, 0, -0.5 * b.s], 0.02, c('#c8c8cd')), P.s(0, 0, -0.55 * b.s, 0.1 * b.s, c('#d8d0bc'), { m: 1 })]; },
    seapig(b) {
      const T = MD.frame(b.yaw, 0), out = [P.e(...T(0, 0, -0.12), [T(1, 0, 0), T(0, 1, 0), T(0, 0, 1)], [0.3 * b.s, 0.12 * b.s, 0.1 * b.s], c('#d8a0a8'), { m: 1 })];
      for (const [u, v] of [[0.15, -0.1], [0.15, 0.1], [-0.05, -0.11], [-0.05, 0.11], [-0.2, -0.09], [-0.2, 0.09]]) out.push(P.s(...T(u * b.s, v * b.s, -0.04), 0.035, c('#c8708f')));
      out.push(P.c(T(0.2 * b.s, -0.04, -0.2), T(0.3 * b.s, -0.06, -0.32), 0.02, c('#f2b8cb')), P.c(T(0.2 * b.s, 0.04, -0.2), T(0.3 * b.s, 0.06, -0.32), 0.02, c('#f2b8cb')));
      return out;
    },
    tripod(b) {
      const T = MD.frame(b.yaw, 0), lift = b.lift || 0, hgt = 0.35 * (1 - lift) + lift * 0.6, out = [];
      out.push(P.e(...T(0, 0, -hgt), [T(1, 0, 0), T(0, 1, 0), T(0, 0, 1)], [0.28, 0.05, 0.06], c('#3a3f47'), { m: 1 }));
      if (lift < 0.3) { out.push(P.c(T(0.08, -0.04, -hgt), T(0.12, -0.12, 0), 0.008, c('#9aa2ab')), P.c(T(0.08, 0.04, -hgt), T(0.12, 0.12, 0), 0.008, c('#9aa2ab')), P.c(T(-0.25, 0, -hgt), T(-0.45, 0, 0), 0.008, c('#9aa2ab'))); }
      out.push(P.c(T(0.15, -0.03, -hgt - 0.02), T(0.55, -0.15, -hgt - 0.05), 0.006, c('#9aa2ab')), P.c(T(0.15, 0.03, -hgt - 0.02), T(0.55, 0.15, -hgt - 0.05), 0.006, c('#9aa2ab')));
      return out;
    },
    tubeworm(b) { const out = [], r = B.rng(b.seed); for (let k = 0; k < 6; k++) { const x = r.range(-0.2, 0.2), y = r.range(-0.2, 0.2), h = r.range(0.4, 1.0) * b.s; out.push(P.c([x, y, 0], [x, y, -h], 0.03, c('#e8e4d8'))); out.push(P.s(x, y, -h - 0.04, 0.05, c('#c83a22'))); } return out; },
    osedax(b) { const out = [], r = B.rng(b.seed); for (let k = 0; k < 9; k++) out.push(P.s(r.range(-0.25, 0.25), r.range(-0.25, 0.25), -0.04, 0.03, c('#c83a22'))); return out; },
    bone(b) { const T = MD.frame(b.yaw, 0); return [P.c(T(-0.4 * b.s, 0, -0.05), T(0.4 * b.s, 0, -0.05), 0.05, c('#d8d0bc')), P.s(...T(-0.45 * b.s, 0, -0.06), 0.08, c('#d8d0bc')), P.s(...T(0.45 * b.s, 0, -0.06), 0.08, c('#d8d0bc'))]; },
    rock(b) { const T = MD.frame(b.yaw, 0), r = B.rng(b.seed); return [P.e(...T(0, 0, -0.1), [T(1, 0, 0), T(0, 1, 0), T(0, 0, 1)], [r.range(0.25, 0.5) * b.s, r.range(0.2, 0.4) * b.s, r.range(0.12, 0.25) * b.s], c(B.act === 'act3' ? '#2a2622' : '#4a4038'))]; },
  };
  function drawBenthos(b) {
    if (!b.kind) return;
    const glowing = b.glow > 0, L = R.lightAt(b.x, b.y, b.z - 0.3);
    if (L < 0.012 && !glowing) return;
    R.model(b.x, b.y, b.z, BM[b.kind](b), { outline: b.kind !== 'osedax', minLight: glowing ? 0.04 : 0 });
  }

  Lf.count = () => ({ sparks: sn, drifters: E.byType('drift').length, benthos: E.byType('benthos').length });
})(window.B);
