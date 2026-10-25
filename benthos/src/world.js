/* world.js — heightfield maps for the deck, the three acts and their sampling helpers.
 * The world is a floor-depth heightfield: water above the floor, rock below. Depth z grows downward. */
'use strict';
(function (B) {
  const M = B.M;
  // Material ids and their sRGB albedo.
  const MAT = B.MAT = { ROCK: 0, SED: 1, SAND: 2, BASALT: 3, BRINE: 4, BONE: 5, NOD: 6, SPONGE: 7, STEEL: 8, SEA: 9, STRIPE: 10, KELP: 11, WOOD: 12 };
  const ALB = ['#4a4038', '#8c8270', '#c2a878', '#25282e', '#0c1a22', '#d8d0bc', '#2a2622', '#c06a3a', '#5d6266', '#1b2d3a', '#e0b020', '#4d6128', '#6b4a33'];
  B.MAT_ALB = ALB.map(B.linHex);

  function create(name, size, cell) {
    const n = Math.round(size / cell);
    return {
      name, size, cell, n, inv: 1 / cell,
      h: new Float32Array(n * n), nx: new Float32Array(n * n), ny: new Float32Array(n * n),
      mat: new Uint8Array(n * n), jit: new Uint8Array(n * n), features: {},
    };
  }

  // Bilinear floor depth.
  function H(m, x, y) {
    const n = m.n;
    let fx = x * m.inv - 0.5, fy = y * m.inv - 0.5;
    if (fx < 0) fx = 0; else if (fx > n - 1.001) fx = n - 1.001;
    if (fy < 0) fy = 0; else if (fy > n - 1.001) fy = n - 1.001;
    const ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, i = iy * n + ix, h = m.h;
    const a = h[i], b = h[i + 1], c = h[i + n], d = h[i + n + 1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  }
  function cellIndex(m, x, y) {
    let ix = (x * m.inv) | 0, iy = (y * m.inv) | 0;
    if (ix < 0) ix = 0; else if (ix >= m.n) ix = m.n - 1;
    if (iy < 0) iy = 0; else if (iy >= m.n) iy = m.n - 1;
    return iy * m.n + ix;
  }
  function finish(m) {
    const n = m.n, h = m.h, c2 = 2 * m.cell;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const hx = (h[y * n + Math.min(n - 1, x + 1)] - h[y * n + Math.max(0, x - 1)]) / c2;
      const hy = (h[Math.min(n - 1, y + 1) * n + x] - h[Math.max(0, y - 1) * n + x]) / c2;
      const l = Math.sqrt(hx * hx + hy * hy + 1);
      m.nx[i] = hx / l; m.ny[i] = hy / l;
      m.jit[i] = (B.hash2(x, y, 99) * 255) | 0;
    }
    // 8x8-cell min/max depth blocks let the renderer skip open water and solid rock in bulk
    const bn = Math.ceil(n / 8); m.bn = bn; m.bmin = new Float32Array(bn * bn); m.bmax = new Float32Array(bn * bn);
    m.bmin.fill(1e9); m.bmax.fill(-1e9);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const b = (y >> 3) * bn + (x >> 3), v = h[y * n + x];
      // a block's bilinear samples can reach one cell into its neighbours, so pad by the neighbours too
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const yy = y + oy, xx = x + ox; if (yy < 0 || xx < 0 || yy >= n || xx >= n) continue;
        if (((yy >> 3) === (y >> 3)) && ((xx >> 3) === (x >> 3))) continue;
        const b2 = (yy >> 3) * bn + (xx >> 3); if (v < m.bmin[b2]) m.bmin[b2] = v; if (v > m.bmax[b2]) m.bmax[b2] = v;
      }
      if (v < m.bmin[b]) m.bmin[b] = v; if (v > m.bmax[b]) m.bmax[b] = v;
    }
    return m;
  }

  // ------------------------------------------------------------------ deck (prologue)
  function genDeck() {
    const m = create('deck', 64, 0.25), n = m.n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * m.cell, y = (j + 0.5) * m.cell, k = j * n + i;
      // Hull outline: stern at x=12, bow point at x=53.
      let half = 7; if (x > 45) half = 7 * (1 - (x - 45) / 8.5);
      const inHull = x > 12 && x < 53.5 && Math.abs(y - 32) < half;
      if (!inHull) { m.h[k] = 0.4; m.mat[k] = MAT.SEA; continue; }
      const edge = half - Math.abs(y - 32);
      m.h[k] = -3; m.mat[k] = MAT.STEEL;
      if (edge < 0.45 && !(x < 13 && Math.abs(y - 32) < 3.2)) { m.h[k] = -4; m.mat[k] = MAT.STEEL; }
      if (x < 12.6 && Math.abs(y - 32) >= 3.2) { m.h[k] = -4; }
      if (x > 13 && x < 14 && Math.abs(y - 32) < 3.4) m.mat[k] = MAT.STRIPE; // launch line at the stern
      if (x > 38 && x < 46 && Math.abs(y - 32) < 4.6) { m.h[k] = -9; m.mat[k] = MAT.STEEL; } // deckhouse
      if (x > 24 && x < 30 && ((y > 25.6 && y < 28.2) || (y > 35.8 && y < 38.4))) { m.h[k] = -5.6; m.mat[k] = MAT.WOOD; } // containers
      if (x > 17 && x < 18.4 && y > 26 && y < 27.4) { m.h[k] = -4.1; m.mat[k] = MAT.STEEL; } // bollards
      if (x > 17 && x < 18.4 && y > 36.6 && y < 38) { m.h[k] = -4.1; m.mat[k] = MAT.STEEL; }
    }
    m.topside = true; m.depthBase = 0;
    return finish(m);
  }

  // ------------------------------------------------------------------ Act I: the shaft and its terraces
  const T1 = [120, 200, 300, 380, 470, 560, 620, 700, 780, 860, 960];
  function genAct1() {
    const m = create('act1', 160, 0.5), n = m.n, C = 80, RS = 22, RT = 62;
    const secStart = 26, secW = (360 - 2 * secStart) / T1.length;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * m.cell, y = (j + 0.5) * m.cell, k = j * n + i;
      const dx = x - C, dy = y - C, r = Math.hypot(dx, dy);
      let ang = Math.atan2(dy, dx) * 180 / Math.PI; if (ang < 0) ang += 360;
      const nz = B.fbm2(x * 0.08, y * 0.08, 4, 11), fine = B.fbm2(x * 0.5, y * 0.5, 2, 12);
      const rs = RS + (nz - 0.5) * 3;
      let h, mt = MAT.ROCK;
      const sunAng = Math.min(ang, 360 - ang);
      if (r < rs) { h = 1160 + nz * 20; }
      else if (sunAng < secStart + (nz - 0.5) * 6) {
        // The Sunlit Wall: a shelf at ~40 m that runs right up to the shaft lip.
        h = 38 + (nz - 0.5) * 10 + (fine - 0.5) * 1.2;
        const s = B.fbm2(x * 0.22, y * 0.22, 3, 13);
        mt = s > 0.62 ? MAT.SPONGE : s < 0.33 ? MAT.KELP : (fine > 0.7 ? MAT.ROCK : MAT.SAND);
        if (r < rs + 2.5) { h -= (rs + 2.5 - r) * 1.5; mt = MAT.ROCK; }
      } else {
        const rel = ang - secStart, sec = Math.min(T1.length - 1, Math.max(0, Math.floor(rel / secW)));
        const into = rel - sec * secW, edgeDeg = Math.min(into, secW - into);
        const rt = RT + (nz - 0.5) * 8;
        const ribDeg = 2.4 + (fine - 0.5) * 1.6 + (r < 30 ? 0 : (r - 30) * 0.02);
        if (r > rt) { h = 30 + nz * 14; }
        else if (edgeDeg < ribDeg && r > rs + 1.5) { h = 34 + nz * 10; }
        else {
          const D = T1[sec];
          h = D + (nz - 0.5) * 5 + (fine - 0.5) * 0.8;
          if (r < rs + 6) h += (rs + 6 - r) * 0.9;           // the lip rolls off into the shaft
          if (r > rt - 5) h = M.lerp(h, 34, M.smooth(rt - 5, rt, r) * M.smooth(rt - 5, rt, r)); // back wall
          const bump = B.fbm2(x * 0.35, y * 0.35, 2, 14 + sec);
          if (bump > 0.72) h -= (bump - 0.72) * 18;           // boulders
          mt = fine > 0.66 || bump > 0.7 ? MAT.ROCK : MAT.SED;
        }
      }
      m.h[k] = h; m.mat[k] = mt;
    }
    // Whale fall skeleton on the 700 m terrace: a chain of vertebrae and ribs raised from the floor.
    const wf = terracePoint(7, 42), wa = terraceAngle(7) + Math.PI / 2;
    for (let s = -9; s <= 9; s += 0.5) {
      const vx = wf.x + Math.cos(wa) * s * 0.9, vy = wf.y + Math.sin(wa) * s * 0.9;
      stamp(m, vx, vy, 0.7, -1.4, MAT.BONE);
      if (Math.abs(s) < 5 && (s * 2) % 2 === 0) for (const side of [-1, 1]) for (let t = 0.6; t < 3; t += 0.4)
        stamp(m, vx + Math.cos(wa + side * 1.4) * t, vy + Math.sin(wa + side * 1.4) * t, 0.35, -0.9, MAT.BONE);
    }
    m.features.T = T1; m.features.C = C; m.features.RS = RS;
    m.features.wf = wf;
    return finish(m);
  }
  function terraceAngle(sec) { const secStart = 26, secW = (360 - 52) / T1.length; return (secStart + secW * (sec + 0.5)) * Math.PI / 180; }
  function terracePoint(sec, r) { const a = terraceAngle(sec); return { x: 80 + Math.cos(a) * r, y: 80 + Math.sin(a) * r, z: T1[sec] }; }
  B.terracePoint = terracePoint; B.terraceAngle = terraceAngle; B.T1 = T1;
  // Raise (dz < 0) or lower a soft disc of floor.
  function stamp(m, x, y, rad, dz, mt) {
    const n = m.n, r2 = rad * rad;
    for (let j = Math.floor((y - rad) * m.inv); j <= Math.ceil((y + rad) * m.inv); j++)
      for (let i = Math.floor((x - rad) * m.inv); i <= Math.ceil((x + rad) * m.inv); i++) {
        if (i < 0 || j < 0 || i >= n || j >= n) continue;
        const cx = (i + 0.5) * m.cell - x, cy = (j + 0.5) * m.cell - y, d2 = cx * cx + cy * cy;
        if (d2 > r2) continue;
        const k = j * n + i, f = 1 - d2 / r2;
        m.h[k] += dz * Math.sqrt(f); if (mt !== undefined) m.mat[k] = mt;
      }
  }
  B.stamp = stamp;

  // ------------------------------------------------------------------ Act II: open water and Magpie's ledge
  function genAct2() {
    const m = create('act2', 420, 0.5), n = m.n, C = 210;
    const MX = C + 95, MY = C + 60;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * m.cell, y = (j + 0.5) * m.cell, k = j * n + i;
      const edge = Math.min(x, y, m.size - x, m.size - y);
      let h = 3320 + B.fbm2(x * 0.02, y * 0.02, 3, 21) * 60, mt = MAT.BASALT;
      if (edge < 26) h = Math.min(h, 3320 - (26 - edge) * 130);
      const dx = x - MX, dy = y - MY, r = Math.hypot(dx, dy), nz = B.fbm2(x * 0.09, y * 0.09, 4, 22);
      const lr = 30 + (nz - 0.5) * 14;
      if (r < lr) {
        h = 2904 + (nz - 0.5) * 3 + (B.fbm2(x * 0.6, y * 0.6, 2, 23) - 0.5) * 0.6;
        mt = nz > 0.6 ? MAT.ROCK : MAT.BASALT;
        const spire = B.fbm2(x * 0.3, y * 0.3, 2, 24); if (spire > 0.74) { h -= (spire - 0.74) * 40; mt = MAT.BASALT; }
        if (r > lr - 3) h += (r - (lr - 3)) * 60; // ledge edge drops away
      }
      // The mouth of the inner trench.
      const hx = x - (MX + 12), hy = y - (MY - 10), hr = Math.hypot(hx, hy);
      if (hr < 7 + (nz - 0.5) * 2) { h = 3700; mt = MAT.BASALT; }
      // Brine pool on the ledge.
      const bx = x - (MX - 13), by = y - (MY + 9), br = Math.hypot(bx, by);
      if (br < 6.5 + (nz - 0.5) * 1.5) { h = 2903.6; mt = MAT.BRINE; }
      m.h[k] = h; m.mat[k] = mt;
    }
    m.features = { C, MX, MY, mouth: { x: MX + 12, y: MY - 10 }, brine: { x: MX - 13, y: MY + 9, r: 6.5, level: 2903.6 } };
    return finish(m);
  }

  // ------------------------------------------------------------------ Act III: the Benthic Plain and the Archive
  function genAct3() {
    const m = create('act3', 300, 0.5), n = m.n, AX = 180, AY = 180;
    const lakes = [{ x: 104, y: 150, r: 15, level: 0 }, { x: 196, y: 92, r: 10, level: 0 }];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * m.cell, y = (j + 0.5) * m.cell, k = j * n + i;
      const nz = B.fbm2(x * 0.05, y * 0.05, 4, 31), fine = B.fbm2(x * 0.4, y * 0.4, 2, 32);
      const r = Math.hypot(x - AX, y - AY) + (nz - 0.5) * 12;
      let h, mt = MAT.SED;
      if (r > 122) h = 3380; else if (r > 92) h = 3440; else if (r > 62) h = 3500; else if (r > 38) h = 3560; else h = 3600;
      // escarpment faces: soften slightly so they read as cliffs with talus
      h += (nz - 0.5) * 6 + (fine - 0.5) * 0.7;
      const dune = Math.sin(x * 0.21 + B.noise2(x * 0.05, y * 0.05, 33) * 6) * 0.35; h += dune;
      const nod = B.fbm2(x * 0.15, y * 0.15, 3, 34); if (nod > 0.6) mt = MAT.NOD;
      if (fine > 0.75) mt = MAT.ROCK;
      const pr = Math.hypot(x - AX, y - AY);
      if (pr < 33 + (nz - 0.5) * 3) {
        h = 4190 + (fine - 0.5) * 0.6; mt = MAT.BASALT;
        // The Archive: a spiral ridge of bone and steel laid on the pit floor.
        const a = Math.atan2(y - AY, x - AX); let best = 99;
        for (let t = 0; t < 5; t++) { const sr = 4 + (a / (Math.PI * 2) + t) * 5.6; best = Math.min(best, Math.abs(pr - sr)); }
        if (best < 1.1 && pr > 4) { h -= (1.1 - best) * 1.6; mt = (B.hash2(i >> 2, j >> 2, 35) > 0.5) ? MAT.BONE : MAT.ROCK; }
        if (pr < 3.2) { h = 4189; mt = MAT.BASALT; }
      }
      m.h[k] = h; m.mat[k] = mt;
    }
    for (const L of lakes) {
      let rim = 1e9;
      for (let a = 0; a < 6.28; a += 0.3) rim = Math.min(rim, H(m, L.x + Math.cos(a) * L.r, L.y + Math.sin(a) * L.r));
      L.level = rim - 0.6;
      for (let j = Math.floor((L.y - L.r) * m.inv); j <= Math.ceil((L.y + L.r) * m.inv); j++)
        for (let i = Math.floor((L.x - L.r) * m.inv); i <= Math.ceil((L.x + L.r) * m.inv); i++) {
          const x = (i + 0.5) * m.cell, y = (j + 0.5) * m.cell, d = Math.hypot(x - L.x, y - L.y);
          if (d < L.r * (0.92 + 0.08 * B.noise2(x * 0.3, y * 0.3, 36))) { m.h[j * n + i] = L.level; m.mat[j * n + i] = MAT.BRINE; }
        }
    }
    // Whale fall bones on the outer plain.
    const wx = 70, wy = 112;
    for (let s = -10; s <= 10; s += 0.5) {
      stamp(m, wx + s * 0.95, wy + Math.sin(s * 0.2) * 1.5, 0.75, -1.5, MAT.BONE);
      if (Math.abs(s) < 6 && (s * 2) % 2 === 0) for (const side of [-1, 1]) for (let t = 0.6; t < 3.4; t += 0.4) stamp(m, wx + s * 0.95 + side * 0.3 * t, wy + side * t, 0.35, -1, MAT.BONE);
    }
    m.features = { AX, AY, lakes, wf: { x: wx, y: wy }, entry: { x: 46, y: 50 } };
    return finish(m);
  }

  // Open water with nothing below: the ascent.
  function genVoid() { const m = create('void', 128, 2); m.h.fill(99999); m.mat.fill(MAT.BASALT); return finish(m); }

  // ------------------------------------------------------------------ queries
  const W = B.World = {
    create(name) { return name === 'deck' ? genDeck() : name === 'act1' ? genAct1() : name === 'act2' ? genAct2() : name === 'void' ? genVoid() : genAct3(); },
    H, cellIndex,
    mat(m, x, y) { return m.mat[cellIndex(m, x, y)]; },
    normal(m, x, y) { const i = cellIndex(m, x, y), nx = m.nx[i], ny = m.ny[i]; return { x: nx, y: ny, z: -Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)) }; },
    // March a ray until it enters rock. Returns the hit point or null.
    rayRock(m, x, y, z, dx, dy, dz, max) {
      const step = 0.25;
      for (let t = 0; t < max; t += step) {
        const px = x + dx * t, py = y + dy * t, pz = z + dz * t;
        if (H(m, px, py) < pz) return { x: px - dx * step, y: py - dy * step, z: pz - dz * step, t };
      }
      return null;
    },
    // Distance from a point to the nearest rock in 8 horizontal directions plus straight down (cheap proximity test).
    nearRock(m, x, y, z, r) {
      if (H(m, x, y) - z < r) return true;
      for (let a = 0; a < 8; a++) { const c = Math.cos(a * 0.785), s = Math.sin(a * 0.785); if (H(m, x + c * r, y + s * r) < z) return true; }
      return false;
    },
  };
})(window.B);
