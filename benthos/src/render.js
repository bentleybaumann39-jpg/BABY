/* render.js — the software renderer.
 *  1. Terrain: a column ray-march over the floor heightfield, front to back, with a cut plane just above the
 *     diver so everything shallower than her is sliced away (the rock "section" you see as dark walls).
 *  2. Lighting: sunlight that dies with depth, the headlamp cone, coloured point lights, Beer–Lambert water.
 *  3. Models: creatures and machines are lists of 3D primitives ray-cast into a small G-buffer, then lit.
 *  4. Quantise: ordered dither into the zone palette through a 32^3 LUT.
 *  5. Present: WebGL CRT pass (curvature that inverts under pressure, scanlines, phosphor bloom) or plain 2D. */
'use strict';
(function (B) {
  const M = B.M;
  const R = B.R = {};
  let W, H, N, FR, FG, FB, ZB, LID, EM, MD, img, OUT32, OUT8;
  const cam = R.cam = { x: 0, y: 0, z: 0, ox: 0, oy: 0, fx: 0, fy: 0, zCut: 0, maxView: 64 };

  R.alloc = function (w, h) {
    W = w; H = h; N = W * H;
    FR = new Float32Array(N); FG = new Float32Array(N); FB = new Float32Array(N);
    ZB = new Float32Array(N); LID = new Uint8Array(N); EM = new Uint8Array(N); MD = new Uint8Array(N);
    img = new ImageData(W, H); OUT32 = new Uint32Array(img.data.buffer); OUT8 = img.data;
    R.W = W; R.H = H; R.out32 = OUT32; R.img = img;
    colLights = new Int16Array(W * MAXCL); colCount = new Uint8Array(W);
  };

  // ------------------------------------------------------------------ environment tables
  const KR = 0.35, KG = 0.07, KB = 0.02;          // water absorption per metre (DESIGN.md §4.2)
  const EXR = new Float32Array(1201), EXG = new Float32Array(1201), EXB = new Float32Array(1201);
  for (let i = 0; i <= 1200; i++) { const d = i / 4; EXR[i] = Math.exp(-KR * d); EXG[i] = Math.exp(-KG * d); EXB[i] = Math.exp(-KB * d); }
  const ZT = 4400;
  const SUNR = new Float32Array(ZT), SUNG = new Float32Array(ZT), SUNB = new Float32Array(ZT);
  const WR = new Float32Array(ZT), WG = new Float32Array(ZT), WB = new Float32Array(ZT);
  for (let z = 0; z < ZT; z++) {
    SUNR[z] = 1.25 * Math.exp(-z * 0.075); SUNG[z] = 1.15 * Math.exp(-z * 0.032); SUNB[z] = 1.05 * Math.exp(-z * 0.021);
    // in-scattered water colour: sunlit blue near the top, then the faint twilight dither, then nothing.
    const deep = z < 2700 ? 1 : Math.max(0, 1 - (z - 2700) / 300); // flat black below 3,000 m
    WR[z] = SUNR[z] * 0.18 + 0.0004 * deep; WG[z] = SUNG[z] * 0.32 + 0.0016 * deep; WB[z] = SUNB[z] * 0.42 + 0.0042 * deep;
  }
  R.waterAt = z => { const i = M.clamp(z | 0, 0, ZT - 1); return [WR[i], WG[i], WB[i]]; };
  // Caustics: tileable animated Voronoi-edge pattern, 64x64, 24 frames.
  const CAU = new Float32Array(64 * 64 * 24);
  (function () {
    const rnd = B.rng(7), pts = [];
    for (let i = 0; i < 14; i++) pts.push([rnd() * 64, rnd() * 64, rnd() * 6.28, 3 + rnd() * 5]);
    for (let f = 0; f < 24; f++) {
      const t = f / 24 * Math.PI * 2;
      const P = pts.map(p => [p[0] + Math.cos(t + p[2]) * p[3], p[1] + Math.sin(t + p[2]) * p[3]]);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        let d1 = 1e9, d2 = 1e9;
        for (const p of P) for (let oy = -64; oy <= 64; oy += 64) for (let ox = -64; ox <= 64; ox += 64) {
          const dx = x - p[0] - ox, dy = y - p[1] - oy, d = dx * dx + dy * dy;
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
        const e = Math.sqrt(d2) - Math.sqrt(d1);
        CAU[f * 4096 + y * 64 + x] = Math.max(0, 1 - e / 2.2) ** 2;
      }
    }
  })();

  // ------------------------------------------------------------------ per-frame environment
  const env = R.env = {
    topside: false, fog: true, fogMul: 1, eye: { x: 0, y: 0, z: 0 }, caustic: 0, cauFrame: 0,
    lamp: { on: false, x: 0, y: 0, z: 0, dx: 1, dy: 0, dz: 0, cosO: 0.9, cosI: 0.95, r2: 225, i: 2, cr: 1, cg: 1, cb: 1 },
    lights: [], turbid: 0, time: 0, topR: 0, topG: 0, topB: 0, sunScale: 1, ambient: 0, deep: false,
  };
  const MAXCL = 12; let colLights, colCount;
  // Lights are collected while models draw and used from the next frame on, so the terrain (drawn first) gets them too.
  let pending = [];
  R.addLight = function (x, y, z, r, g, b, range, i) { if (pending.length < 40) pending.push({ x, y, z, r, g, b, range, r2: range * range, i: i === undefined ? 1 : i }); };

  R.setCamera = function (x, y, z, zCut, maxView) {
    const sx = x * B.PX, sy = y * B.PY + z * B.PZ;
    cam.x = x; cam.y = y; cam.z = z; cam.ox = Math.floor(sx); cam.oy = Math.floor(sy);
    cam.fx = sx - cam.ox; cam.fy = sy - cam.oy; cam.zCut = zCut; cam.maxView = maxView;
  };
  // World -> screen (compressed projection).
  R.sx = x => x * B.PX - cam.ox + W / 2;
  R.sy = (y, z) => y * B.PY + z * B.PZ - cam.oy + H / 2 + B.OFF;

  R.begin = function () {
    FR.fill(0); FG.fill(0); FB.fill(0); ZB.fill(1e9); LID.fill(0); EM.fill(0); MD.fill(0);
    env.lights = pending; pending = []; wires.length = 0; overlays.length = 0;
  };
  // Distribute lights to the screen columns they can touch.
  function binLights() {
    colCount.fill(0);
    const L = env.lights;
    for (let li = 0; li < L.length; li++) {
      const l = L[li], sx = R.sx(l.x), rp = l.range * B.PX;
      const a = Math.max(0, Math.floor(sx - rp)), b = Math.min(W - 1, Math.ceil(sx + rp));
      for (let c = a; c <= b; c++) { const k = colCount[c]; if (k < MAXCL) { colLights[c * MAXCL + k] = li; colCount[c] = k + 1; } }
    }
  }

  // ------------------------------------------------------------------ shading
  let SR = 0, SG = 0, SB = 0;
  // Lit colour of a surface point, including fog toward the eye. Result in SR/SG/SB (linear).
  function shade(x, y, z, nx, ny, nz, ar, ag, ab, col, glossy) {
    let lr, lg, lb;
    const E = env;
    if (E.topside) {
      const up = 0.55 + 0.45 * (nz < 0 ? -nz : 0), side = 0.15 * (nx > 0 ? nx : 0);
      lr = E.topR * (up + side); lg = E.topG * (up + side); lb = E.topB * (up + side);
    } else {
      const zi = z < 0 ? 0 : z >= ZT ? ZT - 1 : z | 0;
      const up = 0.3 + 0.7 * (nz < 0 ? -nz : 0);
      let cs = up * E.sunScale;
      if (zi < 150 && E.caustic > 0) {
        const cx = ((x * 4) | 0) & 63, cy = ((y * 4) | 0) & 63;
        cs *= 0.6 + CAU[E.cauFrame + cy * 64 + cx] * 1.7 * E.caustic * (1 - zi / 150);
      }
      lr = SUNR[zi] * cs; lg = SUNG[zi] * cs; lb = SUNB[zi] * cs;
      lr += E.ambient * 0.3; lg += E.ambient * 0.6; lb += E.ambient;
    }
    const L = E.lamp;
    if (L.on) {
      const dx = x - L.x, dy = y - L.y, dz = z - L.z, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < L.r2 && d2 > 0.0001) {
        const d = Math.sqrt(d2), ca = (dx * L.dx + dy * L.dy + dz * L.dz) / d;
        if (ca > L.cosO) {
          let sp = (ca - L.cosO) / (L.cosI - L.cosO); if (sp > 1) sp = 1;
          let ndl = -(nx * dx + ny * dy + nz * dz) / d; ndl = ndl > 0 ? ndl : 0; ndl = 0.25 + 0.75 * ndl;
          let at = 1 - d2 / L.r2; at *= at;
          const k = L.i * sp * ndl * at, di = (d * 4) | 0;
          lr += k * L.cr * EXR[di]; lg += k * L.cg * EXG[di]; lb += k * L.cb * EXB[di];
          if (glossy) { const g = Math.pow(ca, 40) * 3 * at; lr += g * L.cr; lg += g * L.cg; lb += g * L.cb; }
        }
      }
    }
    const nl = colCount[col];
    if (nl) {
      const LS = E.lights, base = col * MAXCL;
      for (let q = 0; q < nl; q++) {
        const l = LS[colLights[base + q]];
        const dx = x - l.x, dy = y - l.y, dz = z - l.z, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= l.r2) continue;
        const d = Math.sqrt(d2) + 0.001;
        let ndl = -(nx * dx + ny * dy + nz * dz) / d; ndl = 0.35 + 0.65 * (ndl > 0 ? ndl : 0);
        let at = 1 - d2 / l.r2; at *= at;
        const k = l.i * ndl * at, di = d * 4 > 1200 ? 1200 : (d * 4) | 0;
        lr += k * l.r * EXR[di]; lg += k * l.g * EXG[di]; lb += k * l.b * EXB[di];
      }
    }
    if (lr + lg + lb < 1e-6 && E.fog) {
      let wi = ((z + E.eye.z) * 0.5) | 0; wi = wi < 0 ? 0 : wi >= ZT ? ZT - 1 : wi;
      SR = WR[wi]; SG = WG[wi]; SB = WB[wi]; return;
    }
    let r = ar * lr, g = ag * lg, b = ab * lb;
    if (E.fog) {
      const e = E.eye, ex = x - e.x, ey = y - e.y, ez = z - e.z;
      let di = (Math.sqrt(ex * ex + ey * ey + ez * ez) * E.fogMul * 4) | 0; if (di > 1200) di = 1200;
      const tr = EXR[di], tg = EXG[di], tb = EXB[di];
      let wi = ((z + e.z) * 0.5) | 0; wi = wi < 0 ? 0 : wi >= ZT ? ZT - 1 : wi;
      r = r * tr + WR[wi] * (1 - tr); g = g * tg + WG[wi] * (1 - tg); b = b * tb + WB[wi] * (1 - tb);
    }
    SR = r; SG = g; SB = b;
  }
  R.shadeAt = function (x, y, z, nx, ny, nz, ar, ag, ab) { shade(x, y, z, nx, ny, nz, ar, ag, ab, M.clamp(R.sx(x) | 0, 0, W - 1), false); return [SR, SG, SB]; };
  // Transmittance of emitted light from a point to the eye.
  function trans(x, y, z) {
    if (!env.fog) return 1;
    const e = env.eye; let di = (Math.sqrt((x - e.x) ** 2 + (y - e.y) ** 2 + (z - e.z) ** 2) * env.fogMul * 4) | 0; if (di > 1200) di = 1200;
    TR_R = EXR[di]; TR_G = EXG[di]; TR_B = EXB[di]; return 1;
  }
  let TR_R = 1, TR_G = 1, TR_B = 1;
  // Light intensity (scalar) arriving at a point, used for sprite-less effects like particles.
  R.lightAt = function (x, y, z) { shade(x, y, z, 0, 0.6, -0.8, 1, 1, 1, M.clamp(R.sx(x) | 0, 0, W - 1), false); return (SR + SG + SB) / 3; };

  // ------------------------------------------------------------------ terrain
  const ALB = B.MAT_ALB;
  R.terrain = function (map, P) {
    binLights();
    const PX = B.PX, PY = B.PY, PZ = B.PZ, half = W / 2;
    const zCut = cam.zCut, zFar = zCut + cam.maxView, baseY = H / 2 + B.OFF - cam.oy;
    const hm = map.h, n = map.n, inv = map.inv, MT = map.mat, JT = map.jit, NX = map.nx, NY = map.ny;
    const dY = 1 / PY, topside = !!map.topside, t = env.time;
    const secR = topside ? 0 : 0.0042, secG = 0.0046, secB = 0.0052;
    const abyssZ = zFar;
    let wai = ((abyssZ + env.eye.z) * 0.5) | 0; wai = M.clamp(wai, 0, ZT - 1);
    const abR = WR[wai], abG = WG[wai], abB = WB[wai];
    for (let sx = 0; sx < W; sx++) {
      const X = (sx + 0.5 - half + cam.ox) / PX;
      let fx = X * inv - 0.5; if (fx < 0) fx = 0; else if (fx > n - 1.001) fx = n - 1.001;
      const ix = fx | 0, tx = fx - ix;
      let ybuf = H, dbuf = H;
      let Y = (H - baseY - zCut * PZ) / PY;
      const Ystop = (0 - baseY - zFar * PZ) / PY - 1;
      const doorCol = P && Math.abs(X - P.x) < 5.5;
      const bxi = ix >> 3, BN = map.bn, BMIN = map.bmin;
      while (Y > Ystop && ybuf > 0) {
        let fy = Y * inv - 0.5; if (fy < 0) fy = 0; else if (fy > n - 1.001) fy = n - 1.001;
        const iy = fy | 0, ty = fy - iy, ci = iy * n + ix;
        // empty-space skip: the whole block is deeper than we can see, so it is all abyss down to its north edge
        if (BMIN[(iy >> 3) * BN + bxi] > zFar && !(doorCol && Y > P.y - 1 && Y < P.y + 13)) {
          const Yb = ((iy >> 3) << 3) * map.cell - 0.0001;
          const yb = Math.max(Yb, Ystop);
          let sy2 = Math.floor(yb * PY + zFar * PZ + baseY); if (sy2 < 0) sy2 = 0;
          for (let p = sy2; p < ybuf; p++) { const i = p * W + sx; if (MD[i]) continue; FR[i] = abR; FG[i] = abG; FB[i] = abB; ZB[i] = 1e9; }
          if (sy2 < ybuf) { ybuf = sy2; if (dbuf > ybuf) dbuf = ybuf; }
          Y = yb - dY * 0.5;
          continue;
        }
        const a = hm[ci], b = hm[ci + 1], c = hm[ci + n], d = hm[ci + n + 1];
        const h = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
        let s = h, cut = false, abyss = false;
        if (h < zCut) { s = zCut; cut = true; } else if (h > zFar) { s = zFar; abyss = true; }
        const syf = Y * PY + s * PZ + baseY;
        const sy = Math.floor(syf);
        const door = doorCol && Y > P.y + 0.4 && Y < P.y + 12 && s < P.z + 1.2;
        const lim = door ? dbuf : ybuf;
        if (sy < lim) {
          const top = sy < 0 ? 0 : sy;
          const cidx = (ty < 0.5 ? iy : iy + 1) * n + (tx < 0.5 ? ix : ix + 1);
          const mt = MT[cidx], jt = 0.88 + JT[cidx] / 255 * 0.24;
          const nx = NX[cidx], ny = NY[cidx], nz = -Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
          const al = ALB[mt];
          for (let p = top; p < lim; p++) {
            const i = p * W + sx;
            if (door) { if (B.BAYER[(p & 3) * 4 + (sx & 3)] < 0) continue; MD[i] = 1; }
            else if (MD[i]) continue;
            const dy = p - syf;
            if (abyss) {
              FR[i] = abR; FG[i] = abG; FB[i] = abB; ZB[i] = 1e9; continue;
            }
            if (cut && dy < 1.2) {
              // Rock section at the cut plane: dark, hatched, faintly lit by the lamp.
              const hatch = ((sx + p) & 3) === 0 ? 2.2 : 1;
              shade(X, Y, zCut, 0, 0.2, -0.98, 0.05, 0.045, 0.04, sx, false);
              FR[i] = (secR + SR * 0.5) * hatch; FG[i] = (secG + SG * 0.5) * hatch; FB[i] = (secB + SB * 0.5) * hatch; ZB[i] = zCut; continue;
            }
            const face = dy >= 1.5;
            const zp = face ? s + dy / PZ : s;
            let ar = al[0] * jt, ag = al[1] * jt, ab = al[2] * jt, gl = false;
            let snx = nx, sny = ny, snz = nz;
            if (face) {
              const strata = 0.75 + 0.35 * B.hash2(sx >> 1, (zp * 1.5) | 0, 5);
              const rk = mt === MAT_BONE ? ALB[MAT_BONE] : ALB[0];
              ar = rk[0] * strata; ag = rk[1] * strata; ab = rk[2] * strata;
              snx = nx * 0.4; sny = 0.85; snz = -0.35;
            } else if (mt === MAT_BRINE) {
              const rip = 0.5 + 0.5 * Math.sin(X * 1.7 + Y * 2.3 + t * 0.8) * Math.sin(X * 0.9 - Y * 1.3 - t * 0.5);
              ar *= 0.6 + rip * 0.8; ag *= 0.6 + rip * 0.8; ab *= 0.6 + rip * 0.8; gl = true;
            } else if (mt === MAT_SEA) {
              const w = B.noise2(X * 0.35 + t * 0.4, Y * 0.5 - t * 0.25, 3) * 0.6 + B.noise2(X * 1.3 - t, Y * 1.6, 4) * 0.4;
              const cap = w > 0.72 ? 3.2 : 1;
              ar = 0.012 * cap + w * 0.02; ag = 0.03 * cap + w * 0.03; ab = 0.05 * cap + w * 0.04; gl = true;
            }
            shade(X, Y, zp, snx, sny, snz, ar, ag, ab, sx, gl);
            if (face && cut && dy < 4 && !topside) { SR += 0.004; SG += 0.0055; SB += 0.007; } // rim where the wall meets the cut
            FR[i] = SR; FG[i] = SG; FB[i] = SB; ZB[i] = zp;
          }
          if (door) dbuf = top; else { ybuf = top; if (dbuf > ybuf) dbuf = ybuf; }
        }
        Y -= dY;
      }
      for (let p = 0; p < ybuf; p++) { const i = p * W + sx; if (MD[i]) continue; FR[i] = abR; FG[i] = abG; FB[i] = abB; ZB[i] = 1e9; }
    }
  };
  const MAT_BONE = 5, MAT_BRINE = 4, MAT_SEA = 9;

  // ------------------------------------------------------------------ models (3D primitives -> G-buffer)
  const GMAX = 360 * 220;
  const gf = new Float32Array(GMAX), gr = new Float32Array(GMAX), gg = new Float32Array(GMAX), gb = new Float32Array(GMAX);
  const gnx = new Float32Array(GMAX), gny = new Float32Array(GMAX), gnz = new Float32Array(GMAX);
  const ger = new Float32Array(GMAX), geg = new Float32Array(GMAX), geb = new Float32Array(GMAX);
  const gm = new Uint8Array(GMAX), gcov = new Uint8Array(GMAX), gpal = new Uint8Array(GMAX), gu = new Float32Array(GMAX), gw = new Float32Array(GMAX);
  const SN = B.SN, CS = B.CS;
  // Local (east, south, down) -> camera space (u right, w screen-down, f toward camera), all in metres.
  function toCam(x, y, z, o) { o[0] = x; o[1] = y * SN + z * CS; o[2] = y * CS - z * SN; return o; }
  const tmpA = [0, 0, 0], tmpB = [0, 0, 0];
  // Prepared prim cache to avoid allocation: each prim gets ._ (camera-space data) on demand.
  function prep(p) {
    const q = p._ || (p._ = {});
    if (p.t === 's') { toCam(p.x, p.y, p.z, tmpA); q.u = tmpA[0]; q.w = tmpA[1]; q.f = tmpA[2]; q.R = p.r; }
    else if (p.t === 'c') {
      toCam(p.a[0], p.a[1], p.a[2], tmpA); toCam(p.b[0], p.b[1], p.b[2], tmpB);
      q.au = tmpA[0]; q.aw = tmpA[1]; q.af = tmpA[2]; q.bu = tmpB[0]; q.bw = tmpB[1]; q.bf = tmpB[2];
      q.u = (q.au + q.bu) / 2; q.w = (q.aw + q.bw) / 2; q.f = (q.af + q.bf) / 2;
      q.R = Math.hypot(q.bu - q.au, q.bw - q.aw, q.bf - q.af) / 2 + p.r;
    } else if (p.t === 'e' || p.t === 'b') {
      toCam(p.x, p.y, p.z, tmpA); q.u = tmpA[0]; q.w = tmpA[1]; q.f = tmpA[2];
      q.ax = []; for (let k = 0; k < 3; k++) { const v = p.ax[k]; q.ax[k] = toCam(v[0], v[1], v[2], [0, 0, 0]); }
      const rr = p.t === 'e' ? p.rad : p.h; q.rr = rr;
      q.R = p.t === 'e' ? Math.max(rr[0], rr[1], rr[2]) : Math.hypot(rr[0], rr[1], rr[2]);
    }
    return q;
  }
  // Intersect a camera-space ray at (pu,pw) heading -f. Returns f of the hit (or -1e9) and writes the normal.
  let HNU = 0, HNW = 0, HNF = 0;
  function hit(p, q, pu, pw) {
    const du = pu - q.u, dw = pw - q.w;
    if (p.t === 's') {
      const r2 = q.R * q.R, d2 = du * du + dw * dw; if (d2 > r2) return -1e9;
      const df = Math.sqrt(r2 - d2); HNU = du / q.R; HNW = dw / q.R; HNF = df / q.R; return q.f + df;
    }
    if (p.t === 'c') {
      // Inigo Quilez's ray-capsule, ray origin far toward the camera, direction (0,0,-1).
      const ro0 = pu, ro1 = pw, ro2 = q.f + 100;
      const ba0 = q.bu - q.au, ba1 = q.bw - q.aw, ba2 = q.bf - q.af;
      const oa0 = ro0 - q.au, oa1 = ro1 - q.aw, oa2 = ro2 - q.af;
      const baba = ba0 * ba0 + ba1 * ba1 + ba2 * ba2, bard = -ba2, baoa = ba0 * oa0 + ba1 * oa1 + ba2 * oa2;
      const rdoa = -oa2, oaoa = oa0 * oa0 + oa1 * oa1 + oa2 * oa2, ra = p.r;
      const A = baba - bard * bard, Bq = baba * rdoa - baoa * bard, Cq = baba * oaoa - baoa * baoa - ra * ra * baba;
      let h = Bq * Bq - A * Cq; if (h < 0 || A < 1e-9) {
        // degenerate (capsule seen end-on): treat as sphere at nearer end
        return capEnd(q, pu, pw, ra);
      }
      const tt = (-Bq - Math.sqrt(h)) / A, yy = baoa + tt * bard;
      if (yy > 0 && yy < baba) {
        const px = ro0, py = ro1, pz = ro2 - tt, k = yy / baba;
        const cx = q.au + ba0 * k, cy = q.aw + ba1 * k, cz = q.af + ba2 * k;
        HNU = (px - cx) / ra; HNW = (py - cy) / ra; HNF = (pz - cz) / ra; return pz;
      }
      return capEnd(q, pu, pw, ra, yy <= 0);
    }
    if (p.t === 'e') {
      const ax = q.ax, rr = q.rr;
      let A = 0, Bq = 0, Cq = -1;
      for (let k = 0; k < 3; k++) { const a = ax[k], q0 = (du * a[0] + dw * a[1]) / rr[k], kk = a[2] / rr[k]; A += kk * kk; Bq += q0 * kk; Cq += q0 * q0; }
      const disc = Bq * Bq - A * Cq; if (disc < 0) return -1e9;
      const f = (-Bq + Math.sqrt(disc)) / A;
      let nu = 0, nw = 0, nf = 0;
      for (let k = 0; k < 3; k++) { const a = ax[k], pr = (du * a[0] + dw * a[1] + f * a[2]) / (rr[k] * rr[k]); nu += pr * a[0]; nw += pr * a[1]; nf += pr * a[2]; }
      const l = Math.hypot(nu, nw, nf) || 1; HNU = nu / l; HNW = nw / l; HNF = nf / l; return q.f + f;
    }
    if (p.t === 'b') {
      // Slab test in box space; the ray starts 200 m toward the camera and heads (0,0,-1).
      const ax = q.ax, hh = q.rr; let tmin = -1e9, tmax = 1e9, nk = -1;
      for (let k = 0; k < 3; k++) {
        const a = ax[k], o = du * a[0] + dw * a[1] + 200 * a[2], dd = -a[2];
        if (Math.abs(dd) < 1e-6) { if (o < -hh[k] || o > hh[k]) return -1e9; continue; }
        let t1 = (-hh[k] - o) / dd, t2 = (hh[k] - o) / dd;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        if (t1 > tmin) { tmin = t1; nk = k; }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return -1e9;
      }
      if (nk < 0) return -1e9;
      const a = ax[nk], sg = -a[2] > 0 ? -1 : 1;
      HNU = a[0] * sg; HNW = a[1] * sg; HNF = a[2] * sg; return q.f + 200 - tmin;
    }
    return -1e9;
  }
  function capEnd(q, pu, pw, ra, useA) {
    const cu = useA === undefined ? (q.af > q.bf ? q.au : q.bu) : useA ? q.au : q.bu;
    const cw = useA === undefined ? (q.af > q.bf ? q.aw : q.bw) : useA ? q.aw : q.bw;
    const cf = useA === undefined ? Math.max(q.af, q.bf) : useA ? q.af : q.bf;
    const du = pu - cu, dw = pw - cw, d2 = du * du + dw * dw; if (d2 > ra * ra) return -1e9;
    const df = Math.sqrt(ra * ra - d2); HNU = du / ra; HNW = dw / ra; HNF = df / ra; return cf + df;
  }

  // Shared prim helpers for model builders.
  const P = R.P = {
    s: (x, y, z, r, c, o) => Object.assign({ t: 's', x, y, z, r, c }, o),
    c: (a, b, r, c, o) => Object.assign({ t: 'c', a, b, r, c }, o),
    e: (x, y, z, ax, rad, c, o) => Object.assign({ t: 'e', x, y, z, ax, rad, c }, o),
    b: (x, y, z, ax, h, c, o) => Object.assign({ t: 'b', x, y, z, ax, h, c }, o),
    // An orthonormal basis whose first axis points along (dx,dy,dz).
    basis(dx, dy, dz) {
      const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
      let ux = 0, uy = 0, uz = -1; if (Math.abs(dz) > 0.9) { ux = 0; uy = 1; uz = 0; }
      let sx = dy * uz - dz * uy, sy = dz * ux - dx * uz, sz = dx * uy - dy * ux; const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
      const tx = sy * dz - sz * dy, ty = sz * dx - sx * dz, tz = sx * dy - sy * dx;
      return [[dx, dy, dz], [sx, sy, sz], [tx, ty, tz]];
    },
    // Basis from a heading angle in the horizontal plane and a pitch (radians, +down).
    hb(yaw, pitch) { const c = Math.cos(pitch); return P.basis(Math.cos(yaw) * c, Math.sin(yaw) * c, Math.sin(pitch || 0)); },
    lin: hex => B.linHex(hex),
  };

  /* Draw a model.
   * ox,oy,oz: world origin. prims: list. o: { scale (1..3), flip, lut, alpha (0..1 dithered), door (screen-door),
   *   outline (default true), dead (unlit, dead palette), minLight, dim, noFog } */
  R.model = function (ox, oy, oz, prims, o) {
    o = o || {};
    const scale = o.scale || 1, flip = !!o.flip, K = 12 * B.SC;
    const ax = ox * B.PX - cam.ox + W / 2, ay = oy * B.PY + oz * B.PZ - cam.oy + H / 2 + B.OFF;
    let u0 = 1e9, u1 = -1e9, w0 = 1e9, w1 = -1e9;
    for (let k = 0; k < prims.length; k++) {
      const q = prep(prims[k]); const qu = flip ? -q.u : q.u;
      if (qu - q.R < u0) u0 = qu - q.R; if (qu + q.R > u1) u1 = qu + q.R; if (q.w - q.R < w0) w0 = q.w - q.R; if (q.w + q.R > w1) w1 = q.w + q.R;
    }
    let x0 = Math.floor(ax + u0 * K), x1 = Math.ceil(ax + u1 * K), y0 = Math.floor(ay + w0 * K), y1 = Math.ceil(ay + w1 * K);
    if (x1 < 0 || y1 < 0 || x0 >= W || y0 >= H) return null;
    // snap the block grid so 2x2/3x3 art pixels stay locked to the screen
    if (scale > 1) { x0 -= ((x0 % scale) + scale) % scale; y0 -= ((y0 % scale) + scale) % scale; }
    const gwid = Math.ceil((x1 - x0) / scale), ghei = Math.ceil((y1 - y0) / scale);
    if (gwid * ghei > GMAX || gwid <= 0 || ghei <= 0) return null;
    const gn = gwid * ghei;
    gcov.fill(0, 0, gn); gf.fill(-1e9, 0, gn);
    for (let k = 0; k < prims.length; k++) {
      const p = prims[k], q = p._, qu = flip ? -q.u : q.u;
      const gx0 = Math.max(0, Math.floor((ax + (qu - q.R) * K - x0) / scale)), gx1 = Math.min(gwid - 1, Math.ceil((ax + (qu + q.R) * K - x0) / scale));
      const gy0 = Math.max(0, Math.floor((ay + (q.w - q.R) * K - y0) / scale)), gy1 = Math.min(ghei - 1, Math.ceil((ay + (q.w + q.R) * K - y0) / scale));
      const c = p.c, e = p.e, mt = p.m || 0, pal = p.di === undefined ? 255 : p.di;
      for (let gy = gy0; gy <= gy1; gy++) {
        const pw = (y0 + (gy + 0.5) * scale - ay) / K;
        for (let gx = gx0; gx <= gx1; gx++) {
          let pu = (x0 + (gx + 0.5) * scale - ax) / K; if (flip) pu = -pu;
          const f = hit(p, q, pu, pw);
          const gi = gy * gwid + gx;
          if (f > gf[gi]) {
            gf[gi] = f; gcov[gi] = 1; gm[gi] = mt; gpal[gi] = p.palFn ? p.palFn(HNU, HNW, HNF, pu, pw, f) : pal;
            const nu = flip ? -HNU : HNU;
            gnx[gi] = nu; gny[gi] = HNW * SN + HNF * CS; gnz[gi] = HNW * CS - HNF * SN;
            gu[gi] = flip ? -pu : pu; gw[gi] = pw;
            if (p.tex) { const v = p.tex(pu, pw, f, HNU, HNW, HNF); gr[gi] = c[0] * v; gg[gi] = c[1] * v; gb[gi] = c[2] * v; }
            else { gr[gi] = c[0]; gg[gi] = c[1]; gb[gi] = c[2]; }
            if (e) { const k = p.emFn ? p.emFn(HNU, HNW, HNF, pu, pw, f) : 1; ger[gi] = e[0] * k; geg[gi] = e[1] * k; geb[gi] = e[2] * k; } else { ger[gi] = 0; geg[gi] = 0; geb[gi] = 0; }
          }
        }
      }
    }
    const res = { x0, y0, gwid, ghei, scale, ax, ay };
    if (o.wire) { wireFrom(res, o.wireCol); return res; }
    // selective outline: darken the edge pixels of the silhouette
    if (o.outline !== false) {
      for (let gy = 0; gy < ghei; gy++) for (let gx = 0; gx < gwid; gx++) {
        const gi = gy * gwid + gx; if (!gcov[gi]) continue;
        if (gx === 0 || gy === 0 || gx === gwid - 1 || gy === ghei - 1 || !gcov[gi - 1] || !gcov[gi + 1] || !gcov[gi - gwid] || !gcov[gi + gwid]) gm[gi] |= 128;
      }
    }
    composite(res, ox, oy, oz, o);
    return res;
  };
  const DIVER_LIN = B.DIVER.map(B.linHex);
  let diverMap = B.diverMap(16);
  R.setFidelity = f => { diverMap = B.diverMap(f); };
  function composite(res, ox, oy, oz, o) {
    const { x0, y0, gwid, ghei, scale } = res;
    const lut = o.lut || 0, alpha = o.alpha === undefined ? 1 : o.alpha, door = !!o.door, dead = !!o.dead;
    const minL = o.minLight || 0, dim = o.dim === undefined ? 1 : o.dim, ztol = o.ztol === undefined ? 0.6 : o.ztol;
    const emScale = o.em === undefined ? 1 : o.em;
    for (let gy = 0; gy < ghei; gy++) for (let gx = 0; gx < gwid; gx++) {
      const gi = gy * gwid + gx; if (!gcov[gi]) continue;
      const pu = gu[gi], pw = gw[gi], f = gf[gi];
      const wx = ox + pu, wy = oy + pw * SN + f * CS, wz = oz + pw * CS - f * SN;
      const sxp = x0 + gx * scale, syp = y0 + gy * scale;
      const edge = gm[gi] & 128, mt = gm[gi] & 127;
      let ar = gr[gi], ag = gg[gi], ab = gb[gi];
      if (gpal[gi] !== 255) { const c = DIVER_LIN[diverMap[gpal[gi]]]; ar = c[0]; ag = c[1]; ab = c[2]; }
      if (edge) { ar *= 0.45; ag *= 0.45; ab *= 0.45; }
      let r, g, b;
      const col = sxp < 0 ? 0 : sxp >= W ? W - 1 : sxp;
      if (dead) { r = ar * 0.5; g = ag * 0.5; b = ab * 0.5; }
      else {
        shade(wx, wy, wz, gnx[gi], gny[gi], gnz[gi], ar, ag, ab, col, mt === 1 || mt === 3);
        r = SR; g = SG; b = SB;
        if (minL > 0) { r += ar * minL; g += ag * minL; b += ab * minL; }
        if (mt === 2 && env.lamp.on) { // tapetum: eyeshine back toward the lamp
          const L = env.lamp, dx = wx - L.x, dy = wy - L.y, dz = wz - L.z, d = Math.hypot(dx, dy, dz) + 0.01;
          if ((dx * L.dx + dy * L.dy + dz * L.dz) / d > L.cosO * 0.98 && d * d < L.r2) { const k = 1.4 * (1 - d * d / L.r2); r += k * 0.6; g += k * 0.75; b += k * 0.2; }
        }
      }
      if (mt === 4) { r = 0; g = 0; b = 0; } // void: the inside of a mouth, flat #000
      r *= dim; g *= dim; b *= dim;
      let er = ger[gi] * emScale, eg = geg[gi] * emScale, eb = geb[gi] * emScale, isEm = 0;
      if (er + eg + eb > 0.01) {
        if (mt === 5) { r += er; g += eg; b += eb; isEm = 1; }
        else { trans(wx, wy, wz); r += er * TR_R; g += eg * TR_G; b += eb * TR_B; isEm = (er + eg + eb) * (TR_R + TR_G + TR_B) > 0.3 ? 1 : 0; }
      }
      for (let by = 0; by < scale; by++) {
        const py = syp + by; if (py < 0 || py >= H) continue;
        for (let bx = 0; bx < scale; bx++) {
          const px = sxp + bx; if (px < 0 || px >= W) continue;
          const i = py * W + px;
          if (wz > ZB[i] + ztol) continue;
          if (door || alpha < 1) { const th = B.BAYER[(py & 3) * 4 + (px & 3)] + 0.5; if (door && th < 0.5) continue; if (th > alpha) continue; }
          FR[i] = r; FG[i] = g; FB[i] = b; LID[i] = lut; EM[i] = isEm;
          if (o.writeZ) ZB[i] = wz;
        }
      }
    }
  }

  // ------------------------------------------------------------------ simple primitives in world space
  // Point (emissive or lit), with depth test.
  R.point = function (x, y, z, size, r, g, b, emissive, alpha) {
    const sx = Math.round(R.sx(x)), sy = Math.round(R.sy(y, z));
    if (sx < -4 || sy < -4 || sx >= W + 4 || sy >= H + 4) return;
    let cr = r, cg = g, cb = b;
    if (emissive === 3) { /* unfiltered */ }
    else if (emissive) { trans(x, y, z); cr *= TR_R; cg *= TR_G; cb *= TR_B; }
    else { shade(x, y, z, 0, 0.6, -0.8, r, g, b, M.clamp(sx, 0, W - 1), false); cr = SR; cg = SG; cb = SB; }
    const s = size | 0, h0 = -(s >> 1);
    for (let oy = h0; oy < h0 + s; oy++) for (let ox = h0; ox < h0 + s; ox++) {
      const px = sx + ox, py = sy + oy; if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const i = py * W + px; if (z > ZB[i] + 0.5) continue;
      if (alpha !== undefined && alpha < 1 && B.BAYER[(py & 3) * 4 + (px & 3)] + 0.5 > alpha) continue;
      if (emissive >= 2) { FR[i] += cr; FG[i] += cg; FB[i] += cb; } else { FR[i] = cr; FG[i] = cg; FB[i] = cb; }
      LID[i] = 0; if (emissive && cr + cg + cb > 0.25) EM[i] = 1;
    }
  };
  // 3D line (world space). Emissive lines glow; others are shaded once at their midpoint.
  R.line = function (x1, y1, z1, x2, y2, z2, r, g, b, emissive, alpha) {
    const ax = R.sx(x1), ay = R.sy(y1, z1), bx = R.sx(x2), by = R.sy(y2, z2);
    let cr = r, cg = g, cb = b;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, mz = (z1 + z2) / 2;
    if (emissive) { trans(mx, my, mz); cr *= TR_R; cg *= TR_G; cb *= TR_B; }
    else { shade(mx, my, mz, 0, 0.6, -0.8, r, g, b, M.clamp(R.sx(mx) | 0, 0, W - 1), false); cr = SR; cg = SG; cb = SB; }
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
    if (steps > 2000) return;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, px = Math.round(ax + (bx - ax) * t), py = Math.round(ay + (by - ay) * t);
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const z = z1 + (z2 - z1) * t, i = py * W + px; if (z > ZB[i] + 0.5) continue;
      if (alpha !== undefined && alpha < 1 && B.BAYER[(py & 3) * 4 + (px & 3)] + 0.5 > alpha) continue;
      FR[i] = cr; FG[i] = cg; FB[i] = cb; LID[i] = 0; if (emissive && cr + cg + cb > 0.25) EM[i] = 1;
    }
  };
  // Line between two local offsets of a model (natural projection), e.g. legs.
  R.lineL = function (ox, oy, oz, p, q, r, g, b, emissive) {
    const ax = ox * B.PX - cam.ox + W / 2, ay = oy * B.PY + oz * B.PZ - cam.oy + H / 2 + B.OFF;
    const a = toCam(p[0], p[1], p[2], [0, 0, 0]), c = toCam(q[0], q[1], q[2], [0, 0, 0]);
    const K = 12 * B.SC, x1 = ax + a[0] * K, y1 = ay + a[1] * K, x2 = ax + c[0] * K, y2 = ay + c[1] * K;
    let cr = r, cg = g, cb = b;
    const wx = ox + (p[0] + q[0]) / 2, wy = oy + (p[1] + q[1]) / 2, wz = oz + (p[2] + q[2]) / 2;
    if (emissive) { trans(wx, wy, wz); cr *= TR_R; cg *= TR_G; cb *= TR_B; }
    else { shade(wx, wy, wz, 0, 0.6, -0.8, r, g, b, M.clamp(x1 | 0, 0, W - 1), false); cr = SR; cg = SG; cb = SB; }
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, px = Math.round(x1 + (x2 - x1) * t), py = Math.round(y1 + (y2 - y1) * t);
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const z = oz + p[2] + (q[2] - p[2]) * t, i = py * W + px; if (z > ZB[i] + 0.6) continue;
      FR[i] = cr; FG[i] = cg; FB[i] = cb; LID[i] = 0;
    }
  };
  // Dithered disc in world space (silt, mucus, glow clouds). density 0..1.
  R.disc = function (x, y, z, rad, r, g, b, density, emissive, flat) {
    const sx = R.sx(x), sy = R.sy(y, z), rx = rad * 12 * B.SC, ry = rad * (flat ? 8 : 11) * B.SC;
    const x0 = Math.max(0, Math.floor(sx - rx)), x1 = Math.min(W - 1, Math.ceil(sx + rx));
    const y0 = Math.max(0, Math.floor(sy - ry)), y1 = Math.min(H - 1, Math.ceil(sy + ry));
    if (x0 > x1 || y0 > y1) return;
    let cr = r, cg = g, cb = b;
    if (emissive) { trans(x, y, z); cr *= TR_R; cg *= TR_G; cb *= TR_B; }
    else { shade(x, y, z, 0, 0.5, -0.86, r, g, b, M.clamp(sx | 0, 0, W - 1), false); cr = SR; cg = SG; cb = SB; }
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const dx = (px - sx) / rx, dy = (py - sy) / ry, d = dx * dx + dy * dy; if (d > 1) continue;
      const i = py * W + px; if (z > ZB[i] + rad) continue;
      const a = density * (1 - d);
      if (B.BAYER[(py & 3) * 4 + (px & 3)] + 0.5 > a) continue;
      if (emissive === 2) { FR[i] += cr; FG[i] += cg; FB[i] += cb; } else { FR[i] = cr; FG[i] = cg; FB[i] = cb; }
      LID[i] = 0; if (emissive) EM[i] = 1;
    }
  };
  // Darken a dithered flat ellipse on a surface (drop shadow).
  R.shadow = function (x, y, z, rad, density) {
    const sx = R.sx(x), sy = R.sy(y, z), rx = rad * 12 * B.SC, ry = rad * 8 * B.SC;
    const x0 = Math.max(0, Math.floor(sx - rx)), x1 = Math.min(W - 1, Math.ceil(sx + rx)), y0 = Math.max(0, Math.floor(sy - ry)), y1 = Math.min(H - 1, Math.ceil(sy + ry));
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const dx = (px - sx) / rx, dy = (py - sy) / ry, d = dx * dx + dy * dy; if (d > 1) continue;
      const i = py * W + px; if (Math.abs(ZB[i] - z) > 1.5) continue;
      if (B.BAYER[(py & 3) * 4 + (px & 3)] + 0.5 > density * (1 - d * 0.6)) continue;
      FR[i] *= 0.25; FG[i] *= 0.25; FB[i] *= 0.25;
    }
  };
  // Lamp beam made visible by particulate: an additive dithered cone in screen space.
  R.beam = function (x0, y0, dx, dy, len, spread, k, cr, cg, cb) {
    if (k <= 0.001) return;
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const bx0 = Math.max(0, Math.floor(Math.min(x0, x0 + dx * len) - len * spread)), bx1 = Math.min(W - 1, Math.ceil(Math.max(x0, x0 + dx * len) + len * spread));
    const by0 = Math.max(0, Math.floor(Math.min(y0, y0 + dy * len) - len * spread)), by1 = Math.min(H - 1, Math.ceil(Math.max(y0, y0 + dy * len) + len * spread));
    for (let py = by0; py <= by1; py++) for (let px = bx0; px <= bx1; px++) {
      const rx = px - x0, ry = py - y0, along = rx * dx + ry * dy; if (along <= 0 || along > len) continue;
      const across = Math.abs(rx * dy - ry * dx); const w = along * spread + 2; if (across > w) continue;
      const a = (1 - along / len) * (1 - across / w) * k;
      if (B.BAYER[(py & 3) * 4 + (px & 3)] + 0.5 > a * 2.2) continue;
      const i = py * W + px; FR[i] += cr * a; FG[i] += cg * a; FB[i] += cb * a;
    }
  };
  // Additive glow in screen space before quantisation (lamp backscatter, light shafts, flashes).
  R.addScreen = function (fn) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; fn(x, y, i, FR, FG, FB); }
  };
  R.buffers = () => ({ FR, FG, FB, ZB, LID, EM, W, H });

  // ------------------------------------------------------------------ quantise
  const overlays = []; const wires = [];
  // R.lens = { x, y, r } shows a circle at full palette: the Lossless Shard.
  R.quantize = function (worldLUT, fid) {
    const luts = [worldLUT, B.diverLUT(fid), B.lut('d71'), B.lut('d94'), B.lut('dmara'), B.lut('eye')];
    const spread = R.spread || 0.1, GT = B.GT, GTS = B.GTS, BA = B.BAYER, lens = R.lens, full = lens ? B.lut('top') : null;
    for (let y = 0; y < H; y++) {
      const by = (y & 3) * 4;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const inLens = lens && (x - lens.x) * (x - lens.x) + (y - lens.y) * (y - lens.y) < lens.r * lens.r;
        const d = BA[by + (x & 3)] * (inLens ? 0.04 : spread);
        let r = FR[i], g = FG[i], b = FB[i];
        if (R.mono) { const v = Math.max(r, g, b) * 2.4; r = g = b = v; } // the machine sees brightness, not colour
        r = r <= 0 ? 0 : r >= 1.5 ? GT[4096] : GT[(r * GTS) | 0];
        g = g <= 0 ? 0 : g >= 1.5 ? GT[4096] : GT[(g * GTS) | 0];
        b = b <= 0 ? 0 : b >= 1.5 ? GT[4096] : GT[(b * GTS) | 0];
        let ri = ((r + d) * 31 + 0.5) | 0, gi = ((g + d) * 31 + 0.5) | 0, bi = ((b + d) * 31 + 0.5) | 0;
        ri = ri < 0 ? 0 : ri > 31 ? 31 : ri; gi = gi < 0 ? 0 : gi > 31 ? 31 : gi; bi = bi < 0 ? 0 : bi > 31 ? 31 : bi;
        let c = (inLens && LID[i] === 0 ? full : luts[LID[i]])[(ri << 10) | (gi << 5) | bi];
        if (EM[i]) c = (c & 0x00ffffff) | 0x80000000;
        OUT32[i] = c;
      }
    }
  };

  // ------------------------------------------------------------------ post-quantise overlays (exact colours)
  R.pset = function (x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < W && y < H) OUT32[y * W + x] = c; };
  R.rect = function (x, y, w, h, c) {
    x |= 0; y |= 0; const xa = Math.max(0, x), ya = Math.max(0, y), xb = Math.min(W, x + w), yb = Math.min(H, y + h);
    for (let py = ya; py < yb; py++) OUT32.fill(c, py * W + xa, py * W + xb);
  };
  // dithered rect (screen-door shade)
  R.shadeRect = function (x, y, w, h, c, a) {
    x |= 0; y |= 0; const xa = Math.max(0, x), ya = Math.max(0, y), xb = Math.min(W, x + w), yb = Math.min(H, y + h);
    for (let py = ya; py < yb; py++) for (let px = xa; px < xb; px++) if (B.BAYER[(py & 3) * 4 + (px & 3)] + 0.5 < a) OUT32[py * W + px] = c;
  };
  R.darken = function (k) { // halve brightness of everything (pause, menus)
    for (let i = 0; i < N; i++) { const c = OUT32[i]; const r = (c & 255) * k, g = ((c >> 8) & 255) * k, b = ((c >> 16) & 255) * k; OUT32[i] = (255 << 24 | b << 16 | g << 8 | r) >>> 0; }
  };
  R.hline = (x0, x1, y, c) => { for (let x = x0; x <= x1; x++) R.pset(x, y, c); };
  R.vline = (x, y0, y1, c) => { for (let y = y0; y <= y1; y++) R.pset(x, y, c); };
  R.ellipse = function (cx, cy, rx, ry, c, dither) {
    const n = Math.max(12, Math.ceil((rx + ry) * 3));
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry); if (dither && B.BAYER[(y & 3) * 4 + (x & 3)] + 0.5 > dither) continue; R.pset(x, y, c); }
  };
  // Silhouette edge of the G-buffer we just filled -> sonar wireframe pixels.
  function wireFrom(res, col) {
    const { x0, y0, gwid, ghei, scale } = res;
    for (let gy = 0; gy < ghei; gy++) for (let gx = 0; gx < gwid; gx++) {
      const gi = gy * gwid + gx; if (!gcov[gi]) continue;
      const e = gx === 0 || gy === 0 || gx === gwid - 1 || gy === ghei - 1 || !gcov[gi - 1] || !gcov[gi + 1] || !gcov[gi - gwid] || !gcov[gi + gwid];
      // interior creases where depth jumps also draw, so the wireframe reads as a shape
      const crease = !e && gx > 0 && Math.abs(gf[gi] - gf[gi - 1]) > 0.35;
      if (e || crease) for (let b = 0; b < scale; b++) R.pset(x0 + gx * scale + b, y0 + gy * scale, col);
    }
  }
  // Deferred wireframe (drawn after quantise so it ignores occlusion: sonar sees through rock).
  R.wire = function (ox, oy, oz, prims, col, scale) { wires.push([ox, oy, oz, prims, col, scale || 1]); };
  R.flushWires = function () { for (const w of wires) R.model(w[0], w[1], w[2], w[3], { wire: true, wireCol: w[4], scale: w[5] }); wires.length = 0; };
  R.overlay = fn => overlays.push(fn);
  R.flushOverlays = function () { for (const f of overlays) f(); overlays.length = 0; };

  // ------------------------------------------------------------------ present (WebGL CRT or 2D)
  let canvas, gl = null, ctx2d = null, prog, tex, uni = {}, off, offCtx, texW = 0, texH = 0;
  const post = R.post = { curve: 0.04, chroma: 0, flash: 0, scan: 0.14, mask: 0.18, bloom: 1, vig: 0.35, crt: true };
  R.initOutput = function (cv) {
    canvas = cv;
    try {
      gl = cv.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
    } catch (e) { gl = null; }
    if (gl) {
      const vs = 'attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*0.5+0.5,0.5-p.y*0.5);gl_Position=vec4(p,0.,1.);}';
      const fs = `precision mediump float;
uniform sampler2D T;uniform vec2 R;uniform float curve,scan,mask,chroma,flash,bloom,crt,vig;uniform vec2 frac;
varying vec2 v;
vec4 tx(vec2 p){return texture2D(T,p);}
void main(){
  vec2 uv=v;
  if(crt>0.5){vec2 c=uv*2.-1.;float r2=dot(c,c);c*=1.+curve*r2;uv=c*.5+.5;}
  if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.){gl_FragColor=vec4(0.,0.,0.,1.);return;}
  vec2 s=uv+frac/R;
  vec2 px=(floor(s*R)+.5)/R;
  vec3 col;
  if(chroma>0.){col.r=tx(px+vec2(chroma/R.x,0.)).r;col.g=tx(px).g;col.b=tx(px-vec2(chroma/R.x,0.)).b;}else col=tx(px).rgb;
  if(bloom>0.){
    vec3 a=vec3(0.);
    for(int i=0;i<12;i++){float fi=float(i);float ang=fi*0.5236;float rr=(mod(fi,3.)+1.)*1.15;vec2 o=vec2(cos(ang),sin(ang))*rr;vec4 q=tx(px+o/R);a+=q.rgb*step(q.a,0.9)/(0.6+rr);}
    vec4 me=tx(px);a+=me.rgb*step(me.a,0.9)*0.6;
    col+=a*bloom*0.16;
  }
  if(crt>0.5){
    float yy=fract(s.y*R.y);col*=1.-scan*(1.-sin(yy*3.14159));
    float m=mod(gl_FragCoord.x,3.);vec3 g=m<1.?vec3(1.,1.-mask,1.-mask):m<2.?vec3(1.-mask,1.,1.-mask):vec3(1.-mask,1.-mask,1.);
    col*=g*(1.+mask*0.55);
    vec2 cc=uv-.5;col*=1.-vig*dot(cc,cc)*1.7;
  }
  col=mix(col,vec3(1.),flash);
  gl_FragColor=vec4(col,1.);
}`;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      try {
        prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
        gl.useProgram(prog);
        const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        for (const n of ['T', 'R', 'curve', 'scan', 'mask', 'chroma', 'flash', 'bloom', 'crt', 'vig', 'frac']) uni[n] = gl.getUniformLocation(prog, n);
      } catch (e) { console.warn('WebGL CRT unavailable, using 2D', e); gl = null; }
    }
    if (!gl) {
      if (cv.getContext) ctx2d = cv.getContext('2d');
      off = document.createElement('canvas'); offCtx = off.getContext('2d');
    }
    R.glOK = !!gl;
  };
  R.resize = function () {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.floor(innerWidth * dpr), ch = Math.floor(innerHeight * dpr);
    canvas.width = cw; canvas.height = ch; canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
    // Integer scaling when it fills most of the screen, otherwise fill and let nearest sampling cope.
    let s = Math.min(cw / W, ch / H); const fs = Math.floor(s);
    if (fs >= 1 && fs / s > 0.82) s = fs;
    const w = Math.round(W * s), h = Math.round(H * s);
    R.view = { x: Math.floor((cw - w) / 2), y: Math.floor((ch - h) / 2), w, h };
    B.out = { x: R.view.x / dpr, y: R.view.y / dpr, w: w / dpr, h: h / dpr };
  };
  R.present = function () {
    const v = R.view; if (!v) return;
    if (gl) {
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.viewport(v.x, canvas.height - v.y - v.h, v.w, v.h);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (texW !== W || texH !== H) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, OUT8); texW = W; texH = H; }
      else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, OUT8);
      const crt = post.crt && B.settings.crt;
      gl.uniform1i(uni.T, 0); gl.uniform2f(uni.R, W, H);
      gl.uniform1f(uni.curve, crt ? post.curve : 0); gl.uniform1f(uni.scan, post.scan); gl.uniform1f(uni.mask, post.mask);
      gl.uniform1f(uni.chroma, B.settings.photo ? 0 : post.chroma); gl.uniform1f(uni.flash, B.settings.photo ? post.flash * 0.25 : post.flash);
      gl.uniform1f(uni.bloom, post.bloom); gl.uniform1f(uni.crt, crt ? 1 : 0); gl.uniform1f(uni.vig, post.vig);
      gl.uniform2f(uni.frac, cam.fx, cam.fy);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else if (ctx2d) {
      // Strip the bloom flag from alpha before drawing.
      for (let i = 0; i < N; i++) OUT32[i] |= 0xff000000;
      if (off.width !== W) { off.width = W; off.height = H; }
      offCtx.putImageData(img, 0, 0);
      ctx2d.fillStyle = '#000'; ctx2d.fillRect(0, 0, canvas.width, canvas.height);
      ctx2d.imageSmoothingEnabled = false; ctx2d.drawImage(off, v.x, v.y, v.w, v.h);
      if (post.flash > 0) { ctx2d.fillStyle = `rgba(255,255,255,${post.flash})`; ctx2d.fillRect(v.x, v.y, v.w, v.h); }
    }
  };
})(window.B);
