/* scare.js - THE WORLD OF POPPY: the three scare-pass jump-scare faces and
 * their boil frames (loaded after poppy.js, scenes.js and horror.js; replaces
 * the Poppy.ASSETS entries for poppy_scare_costume/closet/final and adds _b).
 *
 * Method (research/scarier.md): keep Poppy a felt toy, make ONE patch too real.
 *  - Built at 2x as an albedo layer + a HEIGHT FIELD (felt dome, petals,
 *    pills, fuzz, brows, lips, sockets, nose) shaded per pixel by a single low
 *    point light with soft cast shadows (HZ.reliefPP): chin and mouth lit, the
 *    forehead black, the nose throwing its shadow UP between the eyes.
 *  - Realistic patches shaded per pixel under the same light: wet eyes
 *    (HZ.eyePP), real teeth and gums (HZ.teethPP / HZ.gumsPP), skin where the
 *    felt is worn through (HZ.pillowPP).
 *  - Junji-Ito hatching in the shadow band and a tremoring overdrawn contour.
 *    Boil frames (_b) re-seed ONLY the hatching and the tremor.
 *  - Levels to the value budget (55-70% of pixels <= 8% luma), grain,
 *    downsample to 800x600.
 * No blood, no wounds, no red pools: worn felt and skin, human teeth (never fangs).
 */
(function (root) {
'use strict';
const P = root.Poppy, HZ = root.HZ;
const { TAU, DEG, lerp, clamp, sstep, rng, mk, MAT } = HZ;
const SS = 2;                     // supersampling: everything below is in 2x device px

/* ------------------------------------------------------------ geometry */
function splineClosed(ctrl, per) {
  const n = ctrl.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  return out;
}
const path = (pts, closed) => HZ.polyPath(pts, closed !== false);
const mapPts = (f, pts) => pts.map(([u, v]) => f(u, v));

/* rig: head-local units (face radius 1, y down) -> 2x device px.
 * TH (outline, petals, mouth, nose) carries the head tilt; TE (eyes, brows)
 * keeps c.eyeTilt (0 = level), so the head can tilt while the eyes stay level.
 * halfK enlarges the screen-left half of the face. */
function rig(c) {
  const cx = c.cx * SS, cy = c.cy * SS, R = c.R * SS, sx = c.sx || 1, sy = c.sy || 1;
  const TH = new DOMMatrix().translate(cx, cy).rotate(c.tilt || 0).scale(R * sx, R * sy);
  let TE = new DOMMatrix().translate(cx, cy).rotate(c.eyeTilt || 0).scale(R * sx, R * sy);
  if (c.eyeAnchor !== undefined) {     // eyes level as a pair, centred where the tilted face carries them
    const a = TH.transformPoint(new DOMPoint(0, c.eyeAnchor));
    TE = new DOMMatrix().translate(a.x, a.y).rotate(c.eyeTilt || 0).scale(R * sx, R * sy).translate(0, -c.eyeAnchor);
  }
  const hk = c.halfK || 1;
  const kf = (u) => 1 + (hk - 1) * sstep(0.3, -0.6, u);
  const warp = (u, v) => { const f = kf(u); return [u * f, v * lerp(1, f, 0.6)]; };
  const ap = (T) => (u, v) => { const [a, b] = warp(u, v); const p = T.transformPoint(new DOMPoint(a, b)); return [p.x, p.y]; };
  const G = { cx, cy, R, sx, sy, TH, TE, THi: TH.inverse(), TEi: TE.inverse(), warp, kf, h: ap(TH), e: ap(TE) };
  G.toHead = (X, Y) => { const p = G.THi.transformPoint(new DOMPoint(X, Y)); return [p.x, p.y]; };
  return G;
}
function faceLocal(c, seed) {
  const r = rng(seed + ':outline'), n = 160, cr = c.crumple || 0, jaw = c.jaw || 0, out = [];
  const ph = [r() * TAU, r() * TAU, r() * TAU, r() * TAU];
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU;
    const k = 1 + cr * (0.045 * Math.sin(a * 3 + ph[0]) + 0.03 * Math.sin(a * 5 + ph[1]) + 0.018 * Math.sin(a * 9 + ph[2]) + 0.01 * Math.sin(a * 17 + ph[3]));
    const down = Math.max(0, Math.sin(a));
    out.push([Math.cos(a) * k * (1 - 0.08 * jaw * down * down), Math.sin(a) * 0.98 * k * (1 + jaw * down * down)]);
  }
  return out;
}
function petalsLocal(c, seed) {
  const N = 9, out = [];
  for (let i = 0; i < N; i++) {
    const r = rng(seed + ':petal' + i);
    const th = -Math.PI / 2 + i * TAU / N + (r() - 0.5) * 0.1;
    let rOut = (c.petalR || 1.5) * (0.94 + r() * 0.1);
    const down = Math.max(0, Math.sin(th)); rOut *= lerp(1, c.petalBottom || 0.92, down * down);
    let hw = Math.PI / N * (i % 2 ? 1.42 : 1.3);
    for (const cr of (c.crush || [])) {
      const d = Math.cos(th - cr.angle);
      if (d > 0.2) { const k = lerp(1, cr.amount, (d - 0.2) / 0.8); rOut = lerp(1.02, rOut, k); hw *= lerp(1, cr.squeeze || 0.75, 1 - k); }
    }
    const rIn = 0.55, P2 = (rad, a) => [Math.cos(a) * rad, Math.sin(a) * rad];
    const ctrl = [P2(rIn, th - hw * 0.35), P2(lerp(rIn, rOut, 0.45), th - hw * 0.95), P2(lerp(rIn, rOut, 0.8), th - hw * 1.04)];
    const K = 9;
    for (let k = 0; k <= K; k++) {
      const u = k / K, a = th + (u - 0.5) * 2 * hw * 0.97;
      const ragged = c.petalRag ? (r() - 0.5) * c.petalRag : 0;
      ctrl.push(P2(rOut * (0.9 + 0.1 * Math.sin(Math.PI * u)) * (1 + (r() - 0.5) * 0.06 + ragged), a));
    }
    ctrl.push(P2(lerp(rIn, rOut, 0.8), th + hw * 1.04), P2(lerp(rIn, rOut, 0.45), th + hw * 0.95), P2(rIn, th + hw * 0.35));
    out.push({ th, hw, rOut, pts: splineClosed(ctrl, 6), i });
  }
  return [0, 2, 4, 6, 8, 1, 3, 5, 7].map(i => out[i]);
}

/* ------------------------------------------------------------- buffers */
function maskOf(W, H, draw, blurPx) {
  const c = mk(W, H), g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; draw(g);
  const m = HZ.readMask(c);
  if (blurPx) HZ.fblur(m, W, H, blurPx);
  return m;
}
function addTo(h, m, k) { for (let i = 0; i < h.length; i++) if (m[i]) h[i] += m[i] * k; }
function feltOver(g, pth, W, H, alpha, scale, seed) {
  const tex = P.feltTexture(W, H, seed || 11, scale || 2.6);
  g.save(); g.clip(pth); g.globalCompositeOperation = 'overlay'; g.globalAlpha = alpha; g.drawImage(tex, 0, 0); g.restore();
}
/* soft grey-brown stains (multiply), never red */
function stains(g, pth, box, n, seed, k) {
  const r = rng(seed + ':stains');
  g.save(); g.clip(pth); g.globalCompositeOperation = 'multiply';
  for (let i = 0; i < n; i++) {
    const x = lerp(box[0], box[2], r()), y = lerp(box[1], box[3], r()), rr = (box[2] - box[0]) * (0.03 + r() * 0.1);
    const pts = []; for (let q = 0; q < 14; q++) { const a = q / 14 * TAU; pts.push([x + Math.cos(a) * rr * (0.6 + r() * 0.7), y + Math.sin(a) * rr * (0.6 + r() * 0.7)]); }
    const sp = path(splineClosed(pts, 4));
    g.filter = `blur(${(rr * 0.12).toFixed(1)}px)`;
    g.fillStyle = `rgba(${150 + r() * 30 | 0},${138 + r() * 25 | 0},${112 + r() * 20 | 0},${(0.35 + r() * 0.4) * (k || 1)})`; g.fill(sp);
    g.filter = `blur(${(rr * 0.03 + 1).toFixed(1)}px)`; g.strokeStyle = `rgba(110,94,70,${0.3 * (k || 1)})`; g.lineWidth = 2.5; g.stroke(sp);
  }
  g.restore();
}
/* frayed felt edge: fibres crossing a polyline (device px), pointing to one side */
function fray(g, pts, o) {
  o = Object.assign({ n: 2, len: [3, 14], col: [206, 192, 166], dark: 0.4, side: 1, seed: 'fray', alpha: [0.4, 0.9], every: 1, w: [0.8, 2.0] }, o);
  const r = rng(o.seed + ':fray');
  g.save(); g.lineCap = 'round';
  for (let i = 1; i < pts.length - 1; i += o.every) {
    const [x, y] = pts[i], a = Math.atan2(pts[i + 1][1] - pts[i - 1][1], pts[i + 1][0] - pts[i - 1][0]);
    for (let q = 0; q < o.n; q++) {
      const L = lerp(o.len[0], o.len[1], r()), ang = a + Math.PI / 2 * o.side + (r() - 0.5) * 1.4;
      const lk = o.light ? o.light(x, y) : 1;
      const k = (r() < o.dark ? 0.45 : 1) * lk, c = o.col.map(v => clamp(v * k * (0.85 + r() * 0.3), 0, 255) | 0);
      g.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${lerp(o.alpha[0], o.alpha[1], r())})`; g.lineWidth = lerp(o.w[0], o.w[1], r());
      g.beginPath(); g.moveTo(x - Math.cos(ang) * 3, y - Math.sin(ang) * 3);
      g.quadraticCurveTo(x + Math.cos(ang + 0.5) * L * 0.5, y + Math.sin(ang + 0.5) * L * 0.5, x + Math.cos(ang) * L, y + Math.sin(ang) * L); g.stroke();
    }
  }
  g.restore();
}
/* resample a polyline to n points */
function resampleN(pts, n) {
  const L = HZ.arcLen(pts), out = [];
  for (let i = 0; i < n; i++) { const p = HZ.along(pts, L * i / (n - 1)); out.push([p[0], p[1]]); }
  return out;
}

/* ---------------------------------------------------------- the builder
 * c: W, H (final px), cx, cy, R (final px), sx, sy, tilt, eyeTilt, halfK, jaw, crumple,
 *    petalR, crush, petalCol, faceCol, decay, seed, boil,
 *    lights(G) -> {light, fill, ambient} in DEVICE px,
 *    lost {ang, a, b, k}, bg,
 *    hooks: albedo(ag, G, U), height(h, mat, G, U), overlay(cg, G, U), foreground(cg, G, U), post(cg, G, U)
 *    hatch {...}, contour {...}, smear {zoom, fn}, budget [darkQ, darkV, brightQ, brightV]
 */
function buildFace(c) {
  const W = c.W * SS, H = c.H * SS, seed = c.seed || 'scare', boil = c.boil || 'A';
  const G = rig(c), R = G.R;
  G.W = W; G.H = H; G.c = c; G.seed = seed;
  G.faceL = faceLocal(c, seed);
  G.face = mapPts(G.h, G.faceL);
  G.facePath = path(G.face);
  G.petals = petalsLocal(c, seed).map(p => Object.assign(p, { scr: mapPts(G.h, p.pts) }));
  G.st = HZ.stage(c.lights(G));
  G.lw = SS;                                     // device px per final px
  G.sharp = [];                                  // paths kept out of hatching and smear
  const U = { maskOf: (d, b) => maskOf(W, H, d, b), addTo, path, mapPts, splineClosed, fray, resampleN, feltOver: (g, p, a, sc, sd) => feltOver(g, p, W, H, a, sc, sd), stains };
  // ---------------- albedo
  const A = mk(W, H), ag = A.getContext('2d', { willReadFrequently: true });
  const petalCol = c.petalCol || '#5A1016';
  for (const p of G.petals) {
    const pp = path(p.scr);
    const [bx, by] = G.h(0, 0);
    const gr = ag.createRadialGradient(bx, by, R * 0.5, bx, by, R * p.rOut * 1.05);
    gr.addColorStop(0, HZ.mixc(petalCol, '#000000', 0.45)); gr.addColorStop(0.55, petalCol); gr.addColorStop(1, HZ.mixc(petalCol, '#7A3A34', 0.3));
    ag.fillStyle = gr; ag.fill(pp);
    const r = rng(seed + ':veins' + p.i);
    ag.save(); ag.clip(pp); ag.lineCap = 'round';
    for (let k = 0; k < 14; k++) {
      const a = p.th + (k / 13 - 0.5) * 2 * p.hw * 0.85 + (r() - 0.5) * 0.04, r0 = 0.95, r1 = p.rOut * (0.85 + r() * 0.12);
      const a0 = G.h(Math.cos(a) * r0, Math.sin(a) * r0), a1 = G.h(Math.cos(a) * r1, Math.sin(a) * r1);
      ag.strokeStyle = `rgba(20,2,4,${0.25 + r() * 0.2})`; ag.lineWidth = 1.5 + r() * 1.5;
      ag.beginPath(); ag.moveTo(a0[0], a0[1]); ag.quadraticCurveTo((a0[0] + a1[0]) / 2 + (r() - 0.5) * 8, (a0[1] + a1[1]) / 2 + (r() - 0.5) * 8, a1[0], a1[1]); ag.stroke();
    }
    ag.restore();
    feltOver(ag, pp, W, H, 0.6, 2.6, 13);
  }
  const faceCol = c.faceCol || '#DCC8A4';
  {
    const [fx, fy] = G.h(-0.2, -0.2);
    const fg = ag.createRadialGradient(fx, fy, R * 0.05, G.cx, G.cy, R * 1.15);
    fg.addColorStop(0, HZ.mixc(faceCol, '#FFF4E0', 0.1)); fg.addColorStop(0.65, faceCol); fg.addColorStop(1, HZ.mixc(faceCol, '#6A5A40', 0.3));
    ag.fillStyle = fg; ag.fill(G.facePath);
    feltOver(ag, G.facePath, W, H, 0.85 * (c.feltK || 1), 2.6, 11);
    feltOver(ag, G.facePath, W, H, 0.45 * (c.feltK || 1), 1.1, 17);
    stains(ag, G.facePath, [G.cx - R, G.cy - R * 1.2, G.cx + R, G.cy + R * 1.2], Math.round(6 + 12 * (c.decay || 0.5)), seed, c.stainK);
  }
  G.inFace = (x, y) => ag.isPointInPath(G.facePath, x, y);
  // pills (felt balls): albedo now, height below
  G.pills = [];
  {
    const r = rng(seed + ':pills'), n = c.pills === undefined ? 260 : c.pills;
    let tries = 0;
    while (G.pills.length < n && tries++ < n * 30) {
      const x = G.cx + (r() - 0.5) * R * 2.3, y = G.cy + (r() - 0.5) * R * 2.6;
      if (G.inFace(x, y)) G.pills.push([x, y, (2 + r() * 2.2) * SS / 2]);
    }
    for (const [x, y, pr] of G.pills) {
      const pg = ag.createRadialGradient(x - pr * 0.3, y - pr * 0.3, 0, x, y, pr);
      pg.addColorStop(0, HZ.mixc(faceCol, '#FFFFFF', 0.2)); pg.addColorStop(1, HZ.mixc(faceCol, '#504030', 0.3));
      ag.fillStyle = pg; ag.beginPath(); ag.arc(x, y, pr, 0, TAU); ag.fill();
    }
  }
  if (c.albedo) c.albedo(ag, G, U);
  // ---------------- height field (device px) + material ids
  const h = new Float32Array(W * H), mat = new Uint8Array(W * H);
  const fm = maskOf(W, H, g => g.fill(G.facePath));
  const fmB = new Float32Array(fm); HZ.fblur(fmB, W, H, R * 0.22);
  const fmS = new Float32Array(fm); HZ.fblur(fmS, W, H, R * 0.02);
  for (const p of G.petals) addTo(h, maskOf(W, H, g => g.fill(path(p.scr)), R * 0.04), R * 0.1 * (c.petalH || 1));
  if (c.petalShadowK !== undefined) {     // petals: the head's cast shadow only partly reaches them (material 4)
    const pmk = maskOf(W, H, g => { for (const p of G.petals) g.fill(path(p.scr)); }), fmk = maskOf(W, H, g => g.fill(G.facePath));
    for (let i = 0; i < mat.length; i++) if (pmk[i] > 0.5 && fmk[i] < 0.5) mat[i] = 4;
  }
  for (let i = 0; i < h.length; i++) if (fmS[i] > 0) h[i] = h[i] * (1 - fmS[i]) + fmS[i] * (R * 0.14) + R * (c.dome || 0.34) * Math.pow(fmB[i], 0.6) * fmS[i];
  {
    const tex = P.feltTexture(W, H, 11, 2.6), td = tex.getContext('2d').getImageData(0, 0, W, H).data;
    const pa = maskOf(W, H, g => { for (const p of G.petals) g.fill(path(p.scr)); g.fill(G.facePath); });
    for (let i = 0; i < h.length; i++) if (pa[i]) h[i] += (td[i * 4] - 128) / 128 * (c.fuzzH || 1.8) * pa[i];
    const pm = maskOf(W, H, g => { for (const [x, y, pr] of G.pills) { g.beginPath(); g.arc(x, y, pr, 0, TAU); g.fill(); } }, 1.5);
    addTo(h, pm, c.pillH === undefined ? 0.8 : c.pillH);
  }
  if (c.crumple) {
    const sd = HZ.hashStr(seed) % 9999;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!fmS[i]) continue;
      const n = HZ.fbm(x / (R * 0.35), y / (R * 0.35), sd, 3);
      h[i] += (1 - Math.abs(n) * 2.2) * R * 0.016 * c.crumple * fmS[i];
    }
  }
  // seed-pod button nose (head frame): glossy dome, flat crown with rays, scuffs
  if (c.nose !== false) {
    const n = Object.assign({ x: 0, y: 0.12, s: 1 }, c.nose || {});
    const s = n.s * 0.1;
    const dome = []; for (let k = 0; k < 48; k++) { const a = k / 48 * TAU; dome.push([n.x + Math.cos(a) * s * 0.95, n.y + Math.sin(a) * s * 0.8]); }
    G.nose = mapPts(G.h, dome); G.noseC = G.h(n.x, n.y); G.noseS = s;
    const np = path(G.nose);
    ag.fillStyle = '#121012'; ag.fill(np);
    const [kx, ky] = G.h(n.x, n.y - 0.02 * n.s);
    ag.save(); ag.translate(kx, ky); ag.rotate((c.tilt || 0) * DEG);
    ag.fillStyle = '#2E2B2C'; ag.beginPath(); ag.ellipse(0, 0, R * s * 0.8, R * s * 0.3, 0, 0, TAU); ag.fill();
    ag.strokeStyle = '#4A4648'; ag.lineWidth = 2.2;
    for (let k = 0; k < 7; k++) { const a = k / 7 * TAU - Math.PI / 2; ag.beginPath(); ag.moveTo(0, 0); ag.lineTo(Math.cos(a) * R * s * 0.7, Math.sin(a) * R * s * 0.27); ag.stroke(); }
    ag.restore();
    const r = rng(seed + ':scuff'); ag.save(); ag.clip(np); ag.lineCap = 'round';
    for (let k = 0; k < 16; k++) { const x = G.noseC[0] + (r() - 0.5) * R * s * 1.6, y = G.noseC[1] + (r() - 0.5) * R * s * 1.2; ag.strokeStyle = `rgba(130,124,118,${0.2 + r() * 0.3})`; ag.lineWidth = 1 + r() * 1.5; ag.beginPath(); ag.moveTo(x, y); ag.lineTo(x + (r() - 0.5) * R * 0.05, y + (r() - 0.5) * R * 0.03); ag.stroke(); }
    ag.restore();
    const nm = maskOf(W, H, g => g.fill(np), R * 0.006), nmB = maskOf(W, H, g => g.fill(np), R * 0.035);
    for (let i = 0; i < h.length; i++) if (nm[i] > 0.02) { h[i] += R * 0.12 * Math.pow(nmB[i], 0.55) * nm[i] * n.s; if (nm[i] > 0.5) mat[i] = 1; }
  }
  if (c.height) c.height(h, mat, G, U);
  G.hf = h;
  G.hAt = (x, y) => h[clamp(Math.round(y), 0, H - 1) * W + clamp(Math.round(x), 0, W - 1)];
  // ---------------- light the felt
  const albedoId = ag.getImageData(0, 0, W, H);
  const lit = HZ.reliefPP(G.st, { W, H, h, alb: albedoId, matId: mat, mats: [Object.assign({}, MAT.felt, c.feltMat || {}), MAT.button, MAT.skin, MAT.thread, Object.assign({}, MAT.felt, { visK: c.petalShadowK || 0 })],
    cavity: c.cavity === undefined ? 0.012 : c.cavity, cavityR: R * 0.07, shadow: Object.assign({ steps: 70, soft: 7, bias: 1.0, maxDist: R * 1.3 }, c.shadow || {}) });
  if (c.lost) {
    const d = lit.img.data, ca = Math.cos(c.lost.ang * DEG), sa = Math.sin(c.lost.ang * DEG);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = ((x - G.cx) * ca + (y - G.cy) * sa) / R, f = 1 - sstep(c.lost.a, c.lost.b, t) * (c.lost.k === undefined ? 1 : c.lost.k);
      if (f < 1) { const i = (y * W + x) * 4; d[i] *= f; d[i + 1] *= f; d[i + 2] *= f; }
    }
  }
  if (c.petalDim !== undefined) {
    const pm = maskOf(W, H, g => { for (const p of G.petals) g.fill(path(p.scr)); }, 2), fmk = maskOf(W, H, g => g.fill(G.facePath), R * 0.02);
    const d = lit.img.data;
    for (let i = 0; i < pm.length; i++) if (pm[i] > 0) { const k = 1 - (1 - c.petalDim) * pm[i] * (1 - fmk[i]); d[i * 4] *= k; d[i * 4 + 1] *= k; d[i * 4 + 2] *= k; }
  }
  const C = mk(W, H), cg = C.getContext('2d', { willReadFrequently: true });
  if (c.bg !== null) { cg.fillStyle = c.bg || '#000'; cg.fillRect(0, 0, W, H); }   // bg: null -> transparent cutout
  if (c.background) c.background(cg, G, U);
  const LC = mk(W, H); LC.getContext('2d').putImageData(lit.img, 0, 0);
  cg.drawImage(LC, 0, 0);
  G.key = lit.key;
  if (c.overlay) c.overlay(cg, G, U);
  if (c.foreground) c.foreground(cg, G, U);
  // ---------------- hatching in the shadow band (boil-seeded)
  const id = cg.getImageData(0, 0, W, H), lum = HZ.lumaOf(id);
  if (c.hatch !== false) {
  const hm = maskOf(W, H, g => { for (const p of G.petals) g.fill(path(p.scr)); g.fill(G.facePath); if (c.hatchExtra) c.hatchExtra(g, G); });
  const noHatch = G.sharp.concat((G.sockets || []).map(s => path(s)), G.mouthScr ? [path(G.mouthScr)] : []);
  if (noHatch.length) { const sm = maskOf(W, H, g => { for (const p of noHatch) g.fill(p); }, 10); for (let i = 0; i < hm.length; i++) hm[i] *= 1 - Math.min(1, sm[i] * 1.6); }
  if (c.hatchMask) c.hatchMask(hm, G);
  const hc = Object.assign({ n: 460, angles: [-0.95 + (c.tilt || 0) * DEG, -0.42 + (c.tilt || 0) * DEG, 0.85], band: [0.02, 0.1, 0.36], len: [14, 40], w: 1.6, cluster: [4, 8], gap: 5, alpha: [0.5, 0.9], lite: 0.22 }, c.hatch || {});
  G.hatchCount = HZ.hatch(cg, lum, W, H, Object.assign({}, hc, { seed: seed + ':hatch:' + boil, mask: hm }));
  }
  // ---------------- tremor contour (boil-seeded), visible only where something is lit
  const lumAt = (x, y) => { const xi = clamp(x | 0, 0, W - 1), yi = clamp(y | 0, 0, H - 1); return lum[yi * W + xi]; };
  const fadeLit = (inset) => (x, y) => sstep(0.025, 0.12, Math.max(lumAt(x, y), lumAt(x + inset[0], y + inset[1])));
  G.fadeLit = fadeLit;
  const ct = Object.assign({ passes: 3 }, c.contour || {});
  if (c.contour !== false) HZ.tremor(cg, G.face, Object.assign({ lw: SS, seed: seed + ':ct:' + boil, closed: true, col: '12,8,6', alpha: 0.85, fade: (x, y) => {
    const dx = G.cx - x, dy = G.cy - y, d = Math.hypot(dx, dy) || 1; return fadeLit([dx / d * 8, dy / d * 8])(x, y); } }, ct));
  for (const p of G.petals) {
    const tip = p.scr.filter((q, k) => k >= 18 && k <= p.scr.length - 18);
    if (tip.length > 3 && c.contour !== false) HZ.tremor(cg, tip, { lw: SS, seed: seed + ':ctp' + p.i + ':' + boil, closed: false, passes: 2, w: [0.5, 1.4], col: '8,2,3', alpha: 0.75, fade: fadeLit([0, 0]) });
    // a thin warm-red rim on the lit petal edges (the only red in the frame)
    if (c.petalRim && tip.length > 3) {
      const L0 = G.st.L[0];
      HZ.tremor(cg, tip, { lw: SS, seed: seed + ':rim' + p.i, closed: false, passes: 1, amp: [0.3, 0.6], off: [1.5, 2.5], w: [0.8, 1.6], col: c.petalRim, alpha: 0.85,
        fade: (x, y) => { const dx = L0.x - x, dy = L0.y - y, d = Math.hypot(dx, dy) || 1; return sstep(0.3, 0.8, (dx * Math.cos(p.th + (c.tilt || 0) * DEG) + dy * Math.sin(p.th + (c.tilt || 0) * DEG)) / d) * sstep(R * 3.2, R * 1.2, d); } });
    }
  }
  if (c.contourExtra) c.contourExtra(cg, G, boil, fadeLit);
  if (c.post) c.post(cg, G, U);
  // ---------------- smear (lunge) on chosen edges, keeping the sharp patches sharp
  if (c.smear) {
    const sm = G.sharp.length ? maskOf(W, H, g => { for (const p of G.sharp) g.fill(p); }, 12) : null;
    HZ.smear(C, G.cx, G.cy, c.smear.zoom || 0.06, (x, y) => { const v = c.smear.fn(x / W, y / H); return sm ? v * (1 - Math.min(1, sm[y * W + x] * 2)) : v; }, 12);
  }
  // ---------------- value budget, grain, downsample
  if (c.tone) { const fid = cg.getImageData(0, 0, W, H); HZ.tone(fid, c.tone); cg.putImageData(fid, 0, 0); }
  if (c.budget) {
    const fid = cg.getImageData(0, 0, W, H);
    G.levels = HZ.levels(fid, c.budget[0], c.budget[1], c.budget[2], c.budget[3], { minGain: c.minGain || 0.7, maxGain: c.maxGain || 2.0 });
    cg.putImageData(fid, 0, 0);
  }
  if (c.grade) c.grade(cg, G);
  HZ.grain(C, c.grain === undefined ? 6 : c.grain, seed + ':grain');
  const out = c.noDown ? C : HZ.downsample(C, c.W, c.H);       // noDown: hand back the 2x canvas (misc renderer)
  return { out, G };
}

/* ------------------------------------------------------- shared features */
/* the mouth: dark interior, rows of real teeth, wet gums, lip contact shadow.
 * All geometry in HEAD units (G.TH). M:
 *  open: closed polygon of the opening (head units)
 *  rows: [{line (head pts), dir, n, len, persp, z, zBack, ao, lower, seed, gum {depth, height, round, col, pap, arc} | null, vis}]
 *  interior(lg, G) optional, shadowLip: [{pts (head), side, width}] contact shadows inside the opening */
function mouthPP(cg, G, M) {
  const L = HZ.layerOf(cg), lg = L.g;
  lg.setTransform(G.TH);
  const op = path(M.open);
  // interior: black throat, a warm-dark cavity near the teeth
  lg.fillStyle = M.cavity || '#050203'; lg.fill(op);
  if (M.interior) M.interior(lg, G);
  const lwH = SS / (G.R * Math.sqrt(G.sx * G.sy));
  const rows = M.rows.map(rw => rw.between === undefined ? Object.assign({ list: HZ.archTeeth(rw.line, Object.assign({ lw: lwH }, rw)) }, rw) : Object.assign({}, rw));
  // a second row hanging BETWEEN the teeth of a front row, set back, longer and in shadow
  for (const rw of rows) if (rw.between !== undefined) {
    const F = rows[rw.between].list.slice().sort((a, b) => a.x - b.x), rr = rng(rw.seed + ':between'), out = [];
    for (let i = 0; i < F.length - 1; i++) {
      const a = F[i], b = F[i + 1]; if (rr() < (rw.skip || 0)) continue;
      const tt = (a.t + b.t) / 2;
      out.push({ x: (a.x + b.x) / 2 - Math.cos(a.ang) * (rw.up || 0.02), y: (a.y + b.y) / 2 - Math.sin(a.ang) * (rw.up || 0.02), ang: (a.ang + b.ang) / 2 + (rr() - 0.5) * 0.25,
        w: (a.w + b.w) / 2 * (rw.wk || 0.8), L: (a.L + b.L) / 2 * (rw.lk || 1.35) * (0.85 + rr() * 0.3), kind: rr() < 0.3 ? 'c' : (a.kind === 'm' ? 'pm' : a.kind), lower: a.lower,
        tint: 0.3 + rr() * 0.3, ao: lerp(rw.ao[0], rw.ao[1], Math.pow(tt, 1.2)), z: (a.z + b.z) / 2 - (rw.zDrop || G.R * 0.05), t: tt, seed: rw.seed + i });
    }
    rw.list = out.sort((a, b) => b.t - a.t);
  }
  for (const rw of rows) for (const t of rw.list) { if (rw.vis) t.vis = rw.vis; if (rw.order !== undefined) t.key = (t.key || t.t) + rw.order; }
  // back rows first, then the front rows merged (upper incisors overlap the lower ones)
  const back = rows.filter(r => r.back), front = rows.filter(r => !r.back);
  for (const rw of back) {
    HZ.teethPP(lg, G.st, rw.list, { lw: lwH, vis: rw.vis, ivory: rw.ivory });
    if (rw.gum) HZ.gumsPP(lg, G.st, rw.list, rw.line, Object.assign({ dir: rw.dir, lw: lwH, seed: rw.seed + 'g', z: rw.z }, rw.gum));
  }
  HZ.teethPP(lg, G.st, HZ.mergeRows(...front.map(r => r.list)), { sorted: true, lw: lwH, ivory: M.ivory });
  for (const rw of front) if (rw.gum) HZ.gumsPP(lg, G.st, rw.list, rw.line, Object.assign({ dir: rw.dir, lw: lwH, seed: rw.seed + 'g', z: rw.z, vis: rw.vis }, rw.gum));
  // contact shadow where the felt lips meet the teeth (ambient occlusion inside the opening)
  lg.save(); lg.clip(op);
  for (const s of (M.shadowLip || [])) {
    lg.save(); lg.filter = `blur(${(s.blur || 6).toFixed(1)}px)`; lg.strokeStyle = `rgba(0,0,0,${s.a || 0.85})`; lg.lineWidth = s.width; lg.lineJoin = 'round';
    lg.stroke(path(s.pts, false)); lg.restore();
  }
  lg.restore();
  // keep only the opening
  lg.save(); lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalCompositeOperation = 'destination-in';
  const mk2 = mk(L.c.width, L.c.height), m2 = mk2.getContext('2d'); m2.setTransform(G.TH); m2.fillStyle = '#fff'; m2.fill(op);
  if (M.feather) { const m3 = mk(L.c.width, L.c.height), g3 = m3.getContext('2d'); g3.filter = `blur(${M.feather}px)`; g3.drawImage(mk2, 0, 0); lg.drawImage(m3, 0, 0); } else lg.drawImage(mk2, 0, 0);
  lg.restore();
  HZ.blit(cg, L.c);
  const sp = new Path2D(); sp.addPath(op, G.TH); G.sharp.push(sp);
  return { rows, path: sp };
}
/* the mouth opening polygon from upper/lower lip functions over [x0, x1] (head units) */
function lipOpening(x0, x1, yU, yL, n, jitter, seed) {
  const r = rng(seed + ':lip'), up = [], lo = [];
  for (let i = 0; i <= n; i++) { const x = lerp(x0, x1, i / n); up.push([x, yU(x) + (r() - 0.5) * jitter]); lo.push([x, yL(x) + (r() - 0.5) * jitter]); }
  return { up, lo, open: up.concat(lo.slice().reverse()) };
}
/* a realistic eye in a felt socket. E: {u, v (eye frame), w, open, side, iris, pupil, irisCol, veins, gaze, lowerFlat, window, seed, lidSkin, ring, socketK} */
function eyeInSocket(cg, G, E) {
  const lwH = SS / (G.R * G.sx);
  const [ex, ey] = G.e(E.u, E.v), [wu, wv] = G.warp(E.u, E.v), k = G.kf(E.u);
  const z = G.hAt(ex, ey) - G.R * (E.recess === undefined ? 0.06 : E.recess);
  const TU = new DOMMatrix().translate(ex, ey).rotate(G.c.eyeTilt || 0).scale(G.R * G.sx * k, G.R * G.sx * k);
  // the eye is drawn on its own layer and shows only through the torn felt socket (the felt overlaps the lids)
  const Lc = mk(G.W, G.H), lg = Lc.getContext('2d', { willReadFrequently: true });
  lg.setTransform(TU);
  const hpx = E.w * k * 0.38 * (E.open || 1) * G.R * G.sx, L0 = G.st.L[0];
  const ldx = L0.x - ex, ldy = L0.y - ey, ll = Math.hypot(ldx, ldy) || 1, lo = E.shadeLo === undefined ? 0.12 : E.shadeLo;
  const vis = (X, Y) => { const t = ((X - ex) * ldx + (Y - ey) * ldy) / ll / hpx; return lo + (1 - lo) * sstep(E.shadeA === undefined ? -0.7 : E.shadeA, E.shadeB === undefined ? 0.8 : E.shadeB, t); };
  const res = HZ.eyePP(lg, G.st, Object.assign({ lw: lwH / k, z, ball: 0.62, socket: 0.25, ring: 0.14, lashLen: 0.11, lashes: 16, lidShadow: 0.6, vis, lidSpread: 1.35 }, E, { cx: 0, cy: 0, w: E.w }));
  if (E.socketPath) {
    lg.setTransform(1, 0, 0, 1, 0, 0);
    const m = mk(G.W, G.H), mg = m.getContext('2d'); mg.filter = 'blur(1.5px)'; mg.fillStyle = '#fff'; mg.fill(path(E.socketPath));
    lg.globalCompositeOperation = 'destination-in'; lg.drawImage(m, 0, 0); lg.globalCompositeOperation = 'source-over';
    // the felt rim's contact shadow on the lids
    lg.save(); lg.globalCompositeOperation = 'source-atop'; lg.filter = 'blur(4px)'; lg.strokeStyle = `rgba(0,0,0,${E.rimShadow === undefined ? 0.7 : E.rimShadow})`; lg.lineWidth = 8; lg.stroke(path(E.socketPath)); lg.restore();
  }
  cg.drawImage(Lc, 0, 0);
  const ap = new Path2D(); ap.addPath(res.ap, TU);
  G.sharp.push(ap);
  return res;
}
/* worn-through felt: a patch of skin with pores and faint veins, a frayed felt rim */
function wornPatch(cg, G, o) {
  // o: u, v (head), rx, ry (head units), rot (deg), skin [hi, lo], seed, veinA
  const [x, y] = G.h(o.u, o.v), rx = o.rx * G.R * G.sx, ry = o.ry * G.R * G.sy, rot = ((o.rot || 0) + (G.c.tilt || 0)) * DEG;
  const r = rng(o.seed + ':worn'), pts = [], N = 90;
  for (let i = 0; i < N; i++) { const a = i / N * TAU, k = 1 + 0.14 * HZ.noise1(i * 0.32, 77) + 0.05 * (r() - 0.5); pts.push([x + Math.cos(a) * rx * k * Math.cos(rot) - Math.sin(a) * ry * k * Math.sin(rot), y + Math.cos(a) * rx * k * Math.sin(rot) + Math.sin(a) * ry * k * Math.cos(rot)]); }
  const pp = path(pts);
  const z = G.hAt(x, y) - G.R * 0.015;
  HZ.pillowPP(cg, G.st, (lg) => {
    const sg = lg.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    sg.addColorStop(0, o.skin ? o.skin[0] : '#C9A08A'); sg.addColorStop(1, o.skin ? o.skin[1] : '#9C7262');
    lg.fillStyle = sg; lg.fill(pp);
    lg.save(); lg.clip(pp); lg.filter = 'blur(1.2px)';
    for (let v = 0; v < 4; v++) {
      let vx = x + (r() - 0.5) * rx, vy = y + (r() - 0.5) * ry, a = r() * TAU;
      lg.strokeStyle = `rgba(70,100,150,${(o.veinA || 0.12) * (0.8 + r() * 0.6)})`; lg.lineWidth = 1.6 + r() * 1.6;
      lg.beginPath(); lg.moveTo(vx, vy);
      for (let i = 0; i < 9; i++) { a += (r() - 0.5) * 0.8; vx += Math.cos(a) * rx * 0.2; vy += Math.sin(a) * ry * 0.2; lg.lineTo(vx, vy); }
      lg.stroke();
    }
    lg.restore();
  }, { mat: MAT.skin, height: Math.min(rx, ry) * 0.12, round: Math.min(rx, ry) * 0.6, z: z - G.R * 0.02, lw: SS, pores: 0.6, poreScale: 0.55, noise: [0.6, 5], seed: o.seed + 'sk' });
  // inner shadow under the felt rim, then the frayed felt edge and a few pills on it
  cg.save(); cg.clip(pp); cg.filter = 'blur(4px)'; cg.strokeStyle = 'rgba(0,0,0,0.75)'; cg.lineWidth = 10; cg.stroke(pp); cg.restore();
  const vis = (px, py) => { const i = (clamp(py | 0, 0, G.H - 1)) * G.W + clamp(px | 0, 0, G.W - 1); return G.key[i]; };
  const lum = (px, py) => G.st.L[0] ? 1 : 1;
  fray(cg, HZ.resample(pts, 4, true).map(p => [p[0], p[1]]), { n: 1, len: [2, 6], side: -1, seed: o.seed + 'f', col: o.feltRGB || [190, 176, 150], alpha: [0.25, 0.6], light: o.light });
  G.sharp.push(pp);
  return pp;
}

/* ======================================================= SCARE 2: CLOSET
 * Poppy's face pushed through the closet gap, underlit from below-left by the
 * cold nightlight. Face stretched 15% vertically, head/petals/mouth tilted 28
 * degrees counter-clockwise, eyes level, wide-set and realistic with pinpoint
 * pupils; a smile 12% of head width past the outline on both sides with 34
 * real teeth (a half-lit second row behind); two real nostrils; skin through
 * worn felt on the left cheek; the closet door edges squeeze the petals. */
function closet(boil) {
  const R = 187;
  const mouthX = 1.16;
  const yU = (x) => { const t = clamp(x / mouthX, -1, 1); return 0.25 + 0.2 * (1 - t * t) + 0.012 * Math.sin(x * 9); };
  const yL = (x) => { const t = clamp(x / mouthX, -1, 1); return yU(x) + 0.5 * Math.pow(Math.max(0, 1 - t * t), 0.75) + 0.012; };
  const lips = lipOpening(-mouthX, mouthX, yU, yL, 90, 0.008, 'closet');
  const c = {
    W: 800, H: 600, cx: 400, cy: 300, R, sx: 1, sy: 1.15, tilt: -28, eyeTilt: 0, crumple: 0.6, jaw: 0.1, seed: 'closet4', boil,
    petalR: 1.55, crush: [{ angle: 28 * DEG, amount: 0.42, squeeze: 0.6 }, { angle: Math.PI + 28 * DEG, amount: 0.42, squeeze: 0.6 }],
    petalCol: '#300A0E', faceCol: '#CFC4AE', decay: 0.7, petalRag: 0.06, pills: 300,
    nose: { x: 0.0, y: 0.1, s: 0.95 },
    lights: (G) => ({
      light: { x: 290 * SS, y: 630 * SS, z: 210 * SS, col: [0.86, 0.98, 1.25], power: 2.2, d0: 210 * SS, cut: 0.22, cutSoft: 0.14 },
      ambient: [0.004, 0.005, 0.008],
    }),
    lost: { ang: -10, a: 0.25, b: 1.05, k: 0.92 },
    shadow: { soft: 9 },
    tone: { exp: 2.05, shoulder: 1.6, gamma: 1.05 }, fuzzH: 0.5, pills: 200, feltK: 0.7, petalDim: 0.45, petalRim: '120,40,44',
    hatch: { n: 470 },
  };
  const eyes = [
    { u: -0.47, v: -0.27 - 0.04 * 1.15, side: -1, seed: 'closet:eL' },
    { u: 0.47, v: -0.27, side: 1, seed: 'closet:eR' },
  ];
  const EW = 0.54;                        // eye width = 27% of head width (head width = 2 units)
  c.albedo = (ag, G, U) => {
    // eye sockets: dark holes cut in the felt (the real eyes sit inside)
    G.sockets = eyes.map(e => { const pts = []; for (let k = 0; k < 72; k++) { const a = k / 72 * TAU, j = 1 + 0.05 * HZ.noise1(k * 0.6, e.u > 0 ? 3 : 7); pts.push([e.u + Math.cos(a) * EW * 0.58 * j, e.v + Math.sin(a) * EW * 0.4 * j + 0.01]); } return mapPts(G.e, pts); });
    for (const s of G.sockets) { ag.fillStyle = '#1A1210'; ag.fill(path(s)); }
    // brows: thin dark felt strips raised high (terror over a smile)
    G.brows = eyes.map(e => { const pts = []; for (let k = 0; k <= 20; k++) { const t = k / 20 * 2 - 1; pts.push([e.u + t * EW * 0.36 - e.side * EW * 0.06, e.v - 0.44 - 0.03 * (1 - t * t) + e.side * t * 0.07]); } return mapPts(G.e, pts); });
    ag.save(); ag.lineCap = 'round';
    for (const b of G.brows) { ag.strokeStyle = '#3A2C24'; ag.lineWidth = G.R * 0.045; ag.stroke(path(b, false)); }
    ag.restore();
    // the mouth opening (felt cut) and the old painted smile line along the upper lip
    G.mouthScr = mapPts(G.h, lips.open);
    ag.fillStyle = '#060304'; ag.fill(path(G.mouthScr));
    G.nostrils = nostrilShapes(G, { y: 0.205, sep: 0.068, s: 0.046 }); nostrilAlbedo(ag, G, G.nostrils);
    // creases at the mouth corners (grime in the folds)
    ag.save(); ag.strokeStyle = 'rgba(70,58,44,0.6)'; ag.lineCap = 'round';
    for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) {
      const a = G.h(sd * (mouthX - 0.05), yU(sd * mouthX) + 0.03 + k * 0.03), b = G.h(sd * (mouthX + 0.08 + k * 0.03), yU(sd * mouthX) - 0.1 + k * 0.08);
      ag.lineWidth = 2 + k; ag.beginPath(); ag.moveTo(a[0], a[1]); ag.lineTo(b[0], b[1]); ag.stroke();
    }
    ag.restore();
  };
  c.height = (h, mat, G, U) => {
    const R2 = G.R;
    // sockets: a raised felt rim and a deep hole
    for (const s of G.sockets) {
      const m = U.maskOf(g => g.fill(path(s)), 3), rim = U.maskOf(g => { g.lineWidth = R2 * 0.06; g.stroke(path(s)); }, R2 * 0.025);
      for (let i = 0; i < h.length; i++) { if (rim[i]) h[i] += rim[i] * R2 * 0.012; if (m[i]) h[i] -= m[i] * R2 * 0.06; }
    }
    // brows: raised felt strips
    U.addTo(h, U.maskOf(g => { g.lineCap = 'round'; g.lineWidth = R2 * 0.05; for (const b of G.brows) g.stroke(path(b, false)); }, R2 * 0.012), R2 * 0.035);
    // cheeks pushed up by the smile, chin
    const bump = (u, v, rx, ry, amp) => { const [x, y] = G.h(u, v); const m = U.maskOf(g => { g.beginPath(); g.ellipse(x, y, rx * R2, ry * R2 * G.sy, (G.c.tilt || 0) * DEG, 0, TAU); g.fill(); }, R2 * Math.min(rx, ry) * 0.7); U.addTo(h, m, amp * R2); };
    bump(-0.62, 0.12, 0.26, 0.2, 0.06); bump(0.62, 0.12, 0.26, 0.2, 0.06); bump(0, 0.98, 0.34, 0.12, 0.03);
    // lips: frayed felt ridges around the opening, deep hole inside
    const mp = path(G.mouthScr);
    const lip = U.maskOf(g => { g.lineWidth = R2 * 0.07; g.lineJoin = 'round'; g.stroke(mp); }, R2 * 0.02), m = U.maskOf(g => g.fill(mp), 2.5);
    for (let i = 0; i < h.length; i++) { if (lip[i]) h[i] += lip[i] * R2 * 0.035; if (m[i]) h[i] -= m[i] * R2 * 0.3; }
    nostrilHeight(h, mat, G, U, G.nostrils);
    // creases at the mouth corners
    U.addTo(h, U.maskOf(g => { g.lineCap = 'round'; for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) { const a = G.h(sd * (mouthX - 0.05), yU(sd * mouthX) + 0.03 + k * 0.03), b = G.h(sd * (mouthX + 0.08 + k * 0.03), yU(sd * mouthX) - 0.1 + k * 0.08); g.lineWidth = 3 + k * 2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } }, 2), -R2 * 0.012);
  };
  c.overlay = (cg, G, U) => {
    const R2 = G.R;
    // ---- mouth
    const up = [], lo = [], up2 = [];
    for (let i = 0; i <= 60; i++) {
      const x = lerp(-mouthX * 0.97, mouthX * 0.97, i / 60);
      up.push([x, yU(x) + 0.045]); lo.push([x * 0.97, yL(x) - 0.045]); up2.push([x * 0.88 + 0.03, yU(x) + 0.07]);
    }
    const lowVis = (X, Y) => { const [u, v] = G.toHead(X, Y); return 0.25 + 0.75 * sstep(0.03, 0.12, yL(u) - v); };
    mouthPP(cg, G, {
      open: lips.open,
      rows: [
        { between: 1, back: true, ao: [0.42, 0.12], lk: 1.6, wk: 0.78, up: 0.015, seed: 'closet:b', skip: 0.5 },
        { line: up, dir: 1, n: 16, len: 0.145, crooked: 2.2, jit: 0.22, persp: 0.5, z: R2 * 0.08, zBack: R2 * 0.12, ao: [1, 0.3], seed: 'closet:u', gum: { depth: 0.08, height: 0.016, round: 0.012, pap: 0.24, arc: 0.07 } },
        { line: lo, dir: -1, n: 12, len: 0.11, crooked: 2.5, jit: 0.22, persp: 0.45, lower: true, z: R2 * 0.06, zBack: R2 * 0.12, ao: [0.95, 0.28], seed: 'closet:l', vis: lowVis, gum: { depth: 0.07, height: 0.014, round: 0.012, pap: 0.22, arc: 0.06 } },
      ],
      shadowLip: [{ pts: mapPts((u, v) => [u, v], lips.lo), width: 0.05, blur: 8, a: 0.7 }], ivory: '#EADBB8',
    });
    // ---- eyes
    eyes.forEach((e, k) => eyeInSocket(cg, G, Object.assign({ socketPath: G.sockets[k], w: EW, open: 1.5, iris: 0.19, pupil: 0.09, lidSpread: 1.25, irisCol: ['#77705C', '#8E9EA6', '#34424A'], veins: 6, gaze: [0, 0], lowerFlat: 0.85,
      window: { x: 0, y: -0.32, s: 0.28, a: 0.95 }, lidSkin: '#86685E', ring: 0.1, recess: 0.05, lidShadow: 0.85, lashes: 14, gain: 1.55, shadeLo: 0.2 }, e)));
    // frayed felt over the socket edges
    const LI = cg.getImageData(0, 0, G.W, G.H).data, litAt = (x, y) => { const i = (clamp(y | 0, 0, G.H - 1) * G.W + clamp(x | 0, 0, G.W - 1)) * 4; return Math.min(1.4, (LI[i] + LI[i + 1] + LI[i + 2]) / 3 / 200 + 0.04); };
    G.sockets.forEach((s, k) => fray(cg, s, { n: 2, len: [2, 7], side: 1, seed: 'closet:sf' + k, col: [200, 190, 170], alpha: [0.3, 0.7], light: litAt, every: 2 }));
    // felt fibres along the lip edges, crossing in front of the teeth
    fray(cg, mapPts(G.h, lips.up), { n: 3, len: [3, 11], side: 1, seed: 'closet:lu', col: [205, 195, 172], alpha: [0.4, 0.9], light: litAt });
    fray(cg, mapPts(G.h, lips.lo), { n: 3, len: [3, 11], side: -1, seed: 'closet:ll', col: [205, 195, 172], alpha: [0.4, 0.9], light: litAt });
    // ---- two real nostrils under the button nose
    // ---- skin through the worn felt on the left cheek (40x30 px)
    wornPatch(cg, G, { u: -0.58, v: 0.12, rx: 20 / R, ry: 15 / R / 1.15, rot: 15, seed: 'closet:skin', skin: ['#9C928A', '#6E6460'], light: litAt, feltRGB: [200, 190, 170] });
  };
  c.foreground = (cg, G) => doors(cg, G, [150, 650]);
  c.contourExtra = (cg, G, b, fadeLit) => {
    HZ.tremor(cg, G.mouthScr, { lw: SS, seed: 'closet:ctm:' + b, closed: true, passes: 2, w: [0.5, 1.4], alpha: 0.7, fade: fadeLit([0, 10]) });
    G.sockets.forEach((s, k) => HZ.tremor(cg, s, { lw: SS, seed: 'closet:cts' + k + ':' + b, closed: true, passes: 2, w: [0.4, 1.0], alpha: 0.35, fade: fadeLit([0, 8]) }));
  };
  return buildFace(c);
}
/* desaturate strongly saturated reds (petals) by k: red stays a rim, never a field */
function capRed(cg, W, H, k) {
  const id = cg.getImageData(0, 0, W, H), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (r > 70 && r > 1.6 * g && r > 1.6 * b) {
      const L = 0.3 * r + 0.59 * g + 0.11 * b, t = k * sstep(1.6, 2.6, r / Math.max(1, Math.max(g, b)));
      d[i] = lerp(r, L * 1.15, t); d[i + 1] = lerp(g, L * 0.95, t); d[i + 2] = lerp(b, L * 0.9, t);
    }
  }
  cg.putImageData(id, 0, 0);
}
/* two real nostrils carved under the button: dark teardrop holes with a skin inner rim and a soft
 * alar bulge, lit by the relief pass (no separate sticker). Head frame. */
function nostrilShapes(G, o) {
  const out = [];
  for (const sd of [-1, 1]) {
    const x = sd * o.sep, y = o.y, s = o.s, pts = [];
    for (let k = 0; k < 40; k++) {
      const a = k / 40 * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const rx = s * 0.85 * (1 + 0.35 * ca * sd), ry = s * 0.42 * (1 - 0.25 * ca * sd);
      const px = ca * rx, py = sa * ry, rot = sd * 0.55;
      pts.push([x + sd * s * 0.1 + px * Math.cos(rot) - py * Math.sin(rot), y + s * 0.12 + px * Math.sin(rot) + py * Math.cos(rot)]);
    }
    out.push({ hole: mapPts(G.h, pts), ala: mapPts(G.h, pts.map(([px, py]) => [x + (px - x) * 1.7, y + s * 0.05 + (py - y - s * 0.12) * 1.9])) });
  }
  return out;
}
function nostrilAlbedo(ag, G, N) {
  for (const n of N) {
    ag.save(); ag.filter = 'blur(3px)'; ag.fillStyle = 'rgba(120,92,80,0.55)'; ag.fill(path(n.ala)); ag.restore();
    ag.fillStyle = '#7A5A50'; ag.fill(path(n.hole));
    ag.save(); ag.clip(path(n.hole)); ag.filter = 'blur(2px)'; ag.fillStyle = '#040202';
    const c0 = n.hole.reduce((a, p) => [a[0] + p[0] / n.hole.length, a[1] + p[1] / n.hole.length], [0, 0]);
    ag.beginPath(); ag.moveTo(n.hole[0][0] * 0.8 + c0[0] * 0.2, n.hole[0][1] * 0.8 + c0[1] * 0.2);
    for (const p of n.hole) ag.lineTo(p[0] * 0.82 + c0[0] * 0.18, p[1] * 0.82 + c0[1] * 0.18 + 2);
    ag.fill(); ag.restore();
  }
}
function nostrilHeight(h, mat, G, U, N) {
  const R = G.R;
  U.addTo(h, U.maskOf(g => { for (const n of N) g.fill(path(n.ala)); }, R * 0.02), R * 0.022);
  const hm = U.maskOf(g => { for (const n of N) g.fill(path(n.hole)); }, R * 0.006);
  for (let i = 0; i < h.length; i++) if (hm[i] > 0) { h[i] -= hm[i] * R * 0.06; mat[i] = 2; }
}
/* two real nostrils (skin, per-pixel) under the seed-pod nose; head frame */
function nostrils(cg, G, o) {
  const s = o.s, R = G.R;
  HZ.pillowPP(cg, G.st, (lg) => {
    lg.setTransform(G.TH);
    for (const sd of [-1, 1]) {
      const x = sd * o.sep, y = o.y;
      const al = lg.createRadialGradient(x, y, 0, x, y, s * 1.3);
      al.addColorStop(0, o.skin || '#5A4842'); al.addColorStop(0.55, o.skin || '#5A4842'); al.addColorStop(1, 'rgba(70,56,50,0)');
      lg.fillStyle = al; lg.beginPath(); lg.ellipse(x, y, s * 1.3, s * 0.9, sd * 0.4, 0, TAU); lg.fill();
      // the nostril: a dark teardrop angled toward the septum
      lg.fillStyle = '#030101'; lg.save(); lg.translate(x + sd * s * 0.1, y + s * 0.15); lg.rotate(sd * 0.6);
      lg.beginPath(); lg.moveTo(-s * 0.9, 0); lg.bezierCurveTo(-s * 0.6, -s * 0.55, s * 0.65, -s * 0.5, s * 0.85, 0.02 * s); lg.bezierCurveTo(s * 0.6, s * 0.42, -s * 0.5, s * 0.4, -s * 0.9, 0); lg.fill(); lg.restore();
    }
  }, { mat: MAT.skin, height: R * s * 0.45, round: R * s * 0.22, z: G.hAt(...G.h(0, o.y)), lw: SS, pores: 0.3, poreScale: 0.6, seed: o.seed, feather: R * s * 0.15,
    hdraw: (hg) => { hg.setTransform(G.TH); for (const sd of [-1, 1]) { hg.fillStyle = '#fff'; hg.beginPath(); hg.ellipse(sd * o.sep, o.y - s * 0.1, s * 1.1, s * 0.8, sd * 0.4, 0, TAU); hg.fill(); hg.fillStyle = '#000'; hg.beginPath(); hg.ellipse(sd * o.sep + sd * s * 0.12, o.y + s * 0.18, s * 0.5, s * 0.24, sd * 0.55, 0, TAU); hg.fill(); } } });
}
/* closet doors pressing in from the left and right (final px edges) */
function doors(cg, G, edges) {
  const W = G.W, H = G.H;
  for (const [side, e] of [[-1, edges[0] * SS], [1, edges[1] * SS]]) {
    const x0 = side < 0 ? 0 : e, x1 = side < 0 ? e : W;
    // the shadow the door casts on the petals
    const sh = cg.createLinearGradient(e, 0, e - side * 70, 0); sh.addColorStop(0, 'rgba(0,0,0,0.9)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    cg.fillStyle = sh; cg.fillRect(Math.min(e, e - side * 70), 0, 70, H);
    const dg = cg.createLinearGradient(0, 0, 0, H); dg.addColorStop(0, '#010102'); dg.addColorStop(0.6, '#04050A'); dg.addColorStop(1, '#0B0F19');
    cg.fillStyle = dg; cg.fillRect(x0, 0, x1 - x0, H);
    // painted-wood grain, barely visible
    const r = rng('door' + side); cg.save(); cg.beginPath(); cg.rect(x0, 0, x1 - x0, H); cg.clip();
    for (let k = 0; k < 40; k++) { const x = lerp(x0, x1, r()); cg.strokeStyle = `rgba(40,50,70,${0.02 + r() * 0.03})`; cg.lineWidth = 1 + r() * 2; cg.beginPath(); cg.moveTo(x, 0); cg.bezierCurveTo(x + (r() - 0.5) * 20, H * 0.3, x + (r() - 0.5) * 20, H * 0.7, x + (r() - 0.5) * 10, H); cg.stroke(); }
    cg.restore();
    // door thickness at the gap: a narrow bevel lit from below, and a 1-2 px cold rim
    const bw = 10, bx = side < 0 ? e - bw : e;
    const bg = cg.createLinearGradient(0, H, 0, 0); bg.addColorStop(0, '#4E5E80'); bg.addColorStop(0.35, '#1C2436'); bg.addColorStop(0.8, '#06080E'); bg.addColorStop(1, '#030305');
    cg.fillStyle = bg; cg.fillRect(bx, 0, bw, H);
    const rim = cg.createLinearGradient(0, H, 0, H * 0.15); rim.addColorStop(0, 'rgba(190,212,255,0.85)'); rim.addColorStop(0.5, 'rgba(150,175,230,0.35)'); rim.addColorStop(1, 'rgba(150,175,230,0)');
    cg.fillStyle = rim; cg.fillRect(side < 0 ? e - 3 : e, 0, 3, H);
  }
}

/* ======================================================= SCARE 3: FINAL
 * The last image of the tape: the closest, most realistic, most broken Poppy.
 * Face ~560 px tall (forehead and chin cut by the frame), tilted 35 degrees
 * clockwise with the eyes kept level, stretched 18% vertically, the left half
 * 6% larger. A dim warm underlight off the playroom floor. Blown black pupils
 * with white all round; a silent scream wider than the face and past the chin
 * with 38 real teeth, wet gums top and bottom, a black throat. Two real
 * nostrils, a cracked seed-pod nose, skin through the worn felt at the temple
 * seam. Not a red frame: red only as thin petal rims. */
function finalFace(boil) {
  const R = 238, TILT = 35;
  const MX = 1.12;                                   // mouth half-width (15% of head width past the outline at its height)
  // a tall screaming 'O' in the middle whose corners are stretched into thin slits past the outline
  const OW = 0.5;                                    // half-width of the screaming O (fraction of MX)
  const ring = (t) => { const q = t / OW; return q * q < 1 ? Math.sqrt(1 - q * q) : 0; };
  const yU = (x) => { const t = clamp(x / MX, -1, 1); return 0.4 + 0.08 * t * t - 0.2 * Math.pow(ring(t), 0.8) + 0.01 * Math.sin(x * 11) + 0.02 * t; };
  const yL = (x) => { const t = clamp(x / MX, -1, 1); return 0.4 + 0.08 * t * t + 0.62 * Math.pow(ring(t), 0.9) * (1 + 0.06 * t) + 0.055 * Math.pow(Math.max(0, 1 - t * t), 0.5) + 0.01 + 0.01 * Math.sin(x * 7); };
  const lips = lipOpening(-MX, MX, yU, yL, 110, 0.01, 'final');
  const c = {
    W: 800, H: 600, cx: 392, cy: 292, R, sx: 1, sy: 1.18, tilt: TILT, eyeTilt: 0, eyeAnchor: -0.38, halfK: 1.06, crumple: 0.4, jaw: 0.1, seed: 'final5', boil,
    petalR: 1.42, petalCol: '#2A080B', faceCol: '#BCAE94', decay: 0.45, petalRag: 0.1, pills: 380,
    nose: { x: 0.0, y: 0.02, s: 1.0 },
    lights: (G) => ({
      light: { x: 300 * SS, y: 700 * SS, z: 250 * SS, col: [1.28, 1.02, 0.8], power: 2.0, d0: 240 * SS, cut: 0.22, cutSoft: 0.14 },
      ambient: [0.006, 0.004, 0.004],
    }),
    tone: { exp: 2.1, shoulder: 1.6, gamma: 0.92 }, fuzzH: 0.5, pillH: 1.0, feltK: 0.65, petalDim: 0.35, petalRim: '150,40,36',
    shadow: { soft: 8 },
    hatch: { n: 560 },
    contour: { passes: 3 },
  };
  const EW = 0.54;
  const eyes = [
    { u: -0.44, v: -0.38 - 0.1, side: -1, seed: 'final:eL' },
    { u: 0.44, v: -0.38, side: 1, seed: 'final:eR' },
  ];
  c.albedo = (ag, G, U) => {
    G.sockets = eyes.map(e => { const k = G.kf(e.u), pts = []; for (let q = 0; q < 72; q++) { const a = q / 72 * TAU, j = 1 + 0.05 * HZ.noise1(q * 0.6, e.u > 0 ? 5 : 9); pts.push([e.u + Math.cos(a) * EW * 0.58 * k * j, e.v + Math.sin(a) * EW * 0.45 * k / 1.18 * j + 0.005]); } return mapPts(G.e, pts); });
    for (const s of G.sockets) { ag.fillStyle = '#140E0C'; ag.fill(path(s)); }
    G.brows = eyes.map(e => { const pts = []; for (let k = 0; k <= 20; k++) { const t = k / 20 * 2 - 1; pts.push([e.u + t * EW * 0.36 - e.side * EW * 0.06, e.v - 0.5 - 0.03 * (1 - t * t) + e.side * t * 0.08]); } return mapPts(G.e, pts); });
    ag.save(); ag.lineCap = 'round';
    for (const b of G.brows) { ag.strokeStyle = '#33261E'; ag.lineWidth = G.R * 0.04; ag.stroke(path(b, false)); }
    ag.restore();
    G.mouthScr = mapPts(G.h, lips.open);
    ag.fillStyle = '#050203'; ag.fill(path(G.mouthScr));
    G.nostrils = nostrilShapes(G, { y: 0.125, sep: 0.068, s: 0.05 }); nostrilAlbedo(ag, G, G.nostrils);
    // running-stitch seams on the felt (an old repair across the cheek, the temple seam)
    G.seams = [
      [[-0.95, 0.05], [-0.7, 0.0], [-0.5, 0.04]].map(p => G.h(...p)),
      [[0.62, -0.78], [0.8, -0.45], [0.92, -0.12]].map(p => G.h(...p)),
    ];
    ag.save(); ag.setLineDash([9, 6]); ag.lineCap = 'round';
    for (const sm of G.seams) { ag.strokeStyle = 'rgba(40,28,20,0.9)'; ag.lineWidth = 3.2; ag.stroke(path(U.splineClosed ? sm : sm, false)); }
    ag.restore();
    // crack across the seed-pod nose (hairline, highlight on one side)
    const [nx, ny] = G.noseC || G.h(0, 0.05), ns = G.R * 0.1;
    G.crack = [[nx - ns * 0.8, ny - ns * 0.4], [nx - ns * 0.3, ny - ns * 0.05], [nx - ns * 0.1, ny + ns * 0.12], [nx + ns * 0.35, ny + ns * 0.25], [nx + ns * 0.7, ny + ns * 0.55]];
  };
  c.height = (h, mat, G, U) => {
    const R2 = G.R;
    for (const s of G.sockets) {
      const m = U.maskOf(g => g.fill(path(s)), 3), rim = U.maskOf(g => { g.lineWidth = R2 * 0.06; g.stroke(path(s)); }, R2 * 0.025);
      for (let i = 0; i < h.length; i++) { if (rim[i]) h[i] += rim[i] * R2 * 0.012; if (m[i]) h[i] -= m[i] * R2 * 0.06; }
    }
    U.addTo(h, U.maskOf(g => { g.lineCap = 'round'; g.lineWidth = R2 * 0.045; for (const b of G.brows) g.stroke(path(b, false)); }, R2 * 0.012), R2 * 0.03);
    const mp = path(G.mouthScr);
    // felt lips only around the screaming O; the stretched corners are bare slits cut in the felt
    const oClip = (g) => { g.save(); g.setTransform(G.TH); g.beginPath(); g.ellipse(0, (yU(0) + yL(0)) / 2, OW * MX * 1.25, 0.62, 0, 0, TAU); g.restore(); g.clip(); };
    const lip = U.maskOf(g => { oClip(g); g.lineWidth = R2 * 0.08; g.lineJoin = 'round'; g.stroke(mp); }, R2 * 0.02), m = U.maskOf(g => g.fill(mp), 2.5);
    for (let i = 0; i < h.length; i++) { if (lip[i]) h[i] += lip[i] * R2 * 0.04; if (m[i]) h[i] -= m[i] * R2 * 0.35; }
    // seams: pinched grooves
    U.addTo(h, U.maskOf(g => { g.lineWidth = 6; g.lineCap = 'round'; for (const sm of G.seams) g.stroke(path(sm, false)); }, 3), -R2 * 0.01);
    nostrilHeight(h, mat, G, U, G.nostrils);
    // stretched cheeks beside the scream
    const bump = (u, v, rx, ry, amp) => { const [x, y] = G.h(u, v); const mm = U.maskOf(g => { g.beginPath(); g.ellipse(x, y, rx * R2, ry * R2 * G.sy, (G.c.tilt || 0) * DEG, 0, TAU); g.fill(); }, R2 * Math.min(rx, ry) * 0.7); U.addTo(h, mm, amp * R2); };
    bump(-0.7, 0.05, 0.22, 0.25, 0.05); bump(0.7, 0.05, 0.22, 0.25, 0.05);
  };
  c.overlay = (cg, G, U) => {
    const R2 = G.R;
    const LI = cg.getImageData(0, 0, G.W, G.H).data, litAt = (x, y) => { const i = (clamp(y | 0, 0, G.H - 1) * G.W + clamp(x | 0, 0, G.W - 1)) * 4; return Math.min(1.4, (LI[i] + LI[i + 1] + LI[i + 2]) / 3 / 200 + 0.04); };
    // ---- the scream: teeth across the top and bottom of the O, small clenched rows in the stretched slits
    const ox = OW * MX, yTop = yU(0), yBot = yL(0);
    const arc = (x0, x1, f) => { const out = []; for (let i = 0; i <= 40; i++) { const x = lerp(x0, x1, i / 40); out.push([x, f(x)]); } return out; };
    const up = arc(-ox * 0.95, ox * 0.95, x => yTop + 0.055 + 0.3 * Math.pow(x / ox, 2));
    const lo = arc(-ox * 0.8, ox * 0.8, x => yBot - 0.065 - 0.28 * Math.pow(x / ox, 2));
    const slit = (sd, top) => arc(sd > 0 ? ox * 0.9 : -MX * 0.93, sd > 0 ? MX * 0.93 : -ox * 0.9, x => top ? yU(x) + 0.012 : yL(x) - 0.012);
    const lowVis = (X, Y) => { const [u, v] = G.toHead(X, Y); return 0.3 + 0.7 * sstep(0.03, 0.14, yL(u) - v); };
    const slitRow = (sd, top, seed) => ({ line: slit(sd, top), dir: top ? 1 : -1, n: 3, len: 0.05, persp: 0.55, lower: !top, z: R2 * 0.05, zBack: R2 * 0.04, ao: [0.75, 0.4], seed, crooked: 2, jit: 0.3, gapK: 0.08 });
    mouthPP(cg, G, {
      open: lips.open,
      interior: (lg) => {
        // the throat: black, a faint warm sheen far below the light
        const [tx, ty] = [0, (yTop + yBot) / 2 + 0.2];
        const tg = lg.createRadialGradient(tx, ty, 0.02, tx, ty, 0.5);
        tg.addColorStop(0, 'rgba(18,7,7,0.9)'); tg.addColorStop(1, 'rgba(4,2,2,0)');
        lg.fillStyle = tg; lg.beginPath(); lg.ellipse(tx, ty, 0.6, 0.3, 0, 0, TAU); lg.fill();
      },
      rows: [
        { line: up, dir: 1, n: 13, len: 0.2, persp: 0.4, z: R2 * 0.08, zBack: R2 * 0.12, ao: [1, 0.4], seed: 'final:u', crooked: 2.4, jit: 0.24, gum: { depth: 0.12, height: 0.022, round: 0.016, pap: 0.24, arc: 0.07 } },
        { line: lo, dir: -1, n: 11, len: 0.15, persp: 0.4, lower: true, z: R2 * 0.05, zBack: R2 * 0.12, ao: [0.95, 0.35], seed: 'final:l', vis: lowVis, crooked: 2.8, jit: 0.24, gum: { depth: 0.12, height: 0.02, round: 0.016, pap: 0.22, arc: 0.06 } },
        { between: 0, back: true, ao: [0.42, 0.15], lk: 1.45, wk: 0.8, up: 0.02, seed: 'final:b', skip: 0.3 },
        { between: 1, back: true, ao: [0.36, 0.12], lk: 1.35, wk: 0.8, up: 0.02, seed: 'final:b2', skip: 0.3 },
      ],
      shadowLip: [{ pts: lips.lo, width: 0.06, blur: 10, a: 0.7 }, { pts: lips.up, width: 0.03, blur: 6, a: 0.5 }], ivory: '#E8D8B4',
    });
    // ---- eyes: blown pupils, white all round
    eyes.forEach((e, k) => eyeInSocket(cg, G, Object.assign({ socketPath: G.sockets[k], w: EW, open: 1.42, iris: 0.19, pupil: 0.9, irisCol: ['#6E7A64', '#71806A', '#28322A'], veins: 8, gaze: [0, 0], lowerFlat: 0.9, irisDy: -0.05,
      window: { x: 0, y: -0.05, s: 0.32, a: 0.97 }, lidSkin: '#7E6458', ring: 0.1, recess: 0.05, lidShadow: 0.8, lashes: 14, shadeLo: 0.22, gain: 1.7 }, e)));
    G.sockets.forEach((s, k) => fray(cg, s, { n: 2, len: [2, 7], side: 1, seed: 'final:sf' + k, col: [200, 188, 166], alpha: [0.3, 0.7], light: litAt, every: 2 }));
    const inO = ([u]) => Math.abs(u) < OW * MX * 1.15;
    fray(cg, mapPts(G.h, lips.up.filter(inO)), { n: 3, len: [3, 12], side: 1, seed: 'final:lu', col: [205, 192, 168], alpha: [0.4, 0.9], light: litAt });
    fray(cg, mapPts(G.h, lips.lo.filter(inO)), { n: 3, len: [3, 12], side: -1, seed: 'final:ll', col: [205, 192, 168], alpha: [0.4, 0.9], light: litAt });
    // ---- nostrils, cracked nose, temple skin
    cg.save(); cg.lineCap = 'round'; cg.lineJoin = 'round';
    cg.strokeStyle = 'rgba(0,0,0,0.95)'; cg.lineWidth = 2.2; cg.stroke(path(G.crack, false));
    cg.translate(-1.2, -1.4); cg.strokeStyle = 'rgba(255,226,190,0.55)'; cg.lineWidth = 1.2; cg.stroke(path(G.crack, false));
    cg.restore();
    wornPatch(cg, G, { u: 0.8, v: -0.42, rx: 0.12, ry: 0.065, rot: 70, seed: 'final:skin', skin: ['#968676', '#5E5048'], veinA: 0.15, light: litAt, feltRGB: [196, 182, 156] });
  };
  c.grade = (cg, G) => capRed(cg, G.W, G.H, 0.3);
  c.contourExtra = (cg, G, b, fadeLit) => {
    HZ.tremor(cg, G.mouthScr, { lw: SS, seed: 'final:ctm:' + b, closed: true, passes: 3, w: [0.5, 1.6], alpha: 0.75, fade: fadeLit([0, 10]) });
    G.sockets.forEach((s, k) => HZ.tremor(cg, s, { lw: SS, seed: 'final:cts' + k + ':' + b, closed: true, passes: 2, w: [0.4, 1.0], alpha: 0.35, fade: fadeLit([0, 8]) }));
  };
  return buildFace(c);
}

/* ======================================================= SCARE 1: COSTUME
 * The empty costume head lunging at the lens out of black, lit ONLY by the
 * camcorder light held low (40 degrees below, slightly right, hard terminator).
 * Tilted 32 degrees clockwise; its right side dissolves into black. A REAL eye
 * pressed against the left mesh hole from inside; the right hole black, empty,
 * lower. Poppy's painted smile torn open along its line: real teeth through
 * the frayed felt. Petals crushed flat on the left and sunk in shadow. */
function costume(boil) {
  const R = 182;
  const c = {
    W: 800, H: 600, cx: 380, cy: 306, R, sx: 1, sy: 1.02, tilt: 32, eyeTilt: 32, crumple: 1.1, jaw: 0.05, seed: 'costume6', boil,
    petalR: 1.48, crush: [{ angle: Math.PI - 32 * DEG, amount: 0.25, squeeze: 0.5 }], petalCol: '#4A0E12', faceCol: '#C8BCA2', decay: 0.85, petalRag: 0.08, pills: 300,
    nose: { x: 0.0, y: 0.1, s: 1.05 },
    lights: (G) => ({
      light: { x: 440 * SS, y: 590 * SS, z: 270 * SS, col: [1.3, 1.22, 1.08], power: 1.6, d0: 330 * SS, hard: 0.85, cut: 0.12, cutSoft: 0.1 },
      ambient: [0.003, 0.003, 0.003],
    }),
    lost: { ang: -8, a: 0.2, b: 0.95, k: 0.98 },
    shadow: { soft: 3, bias: 2.5 },
    tone: { exp: 1.45, shoulder: 1.2, gamma: 1.3 }, fuzzH: 0.6, feltK: 0.85, petalDim: 0.72, petalRim: '150,42,40', petalShadowK: 0.85,
    hatch: { n: 430 },
    smear: { zoom: 0.075, fn: (u, v) => Math.max(sstep(0.36, 0.05, v), sstep(0.6, 0.95, u)) * 0.9 },
  };
  const holes = [{ x: -0.38, y: -0.22, rx: 0.21, ry: 0.245 }, { x: 0.38, y: -0.22 + 0.1, rx: 0.2, ry: 0.235 }];
  // the corridor wall right behind catches a faint spill of the camcorder light; the head's
  // shadow climbs it, huge and soft (the wall stays under ~9% luma: it reads as black on tape)
  c.background = (cg, G) => {
    const W = G.W, H = G.H, sp = cg.createRadialGradient(G.cx + 40 * SS, G.cy + 120 * SS, 30 * SS, G.cx + 20 * SS, G.cy + 40 * SS, 430 * SS);
    sp.addColorStop(0, 'rgb(52,45,37)'); sp.addColorStop(0.4, 'rgb(30,26,21)'); sp.addColorStop(0.75, 'rgb(9,8,6)'); sp.addColorStop(1, 'rgb(0,0,0)');
    cg.fillStyle = sp; cg.fillRect(0, 0, W, H);
    const sh = mk(W, H), sg = sh.getContext('2d');
    sg.translate(G.cx, G.cy); sg.scale(1.35, 1.5); sg.translate(-G.cx, -G.cy - 95 * SS);
    for (const p of G.petals) sg.fill(path(p.scr)); sg.fill(G.facePath);
    cg.save(); cg.globalCompositeOperation = 'multiply'; cg.filter = `blur(${18 * SS}px)`; cg.globalAlpha = 0.85;
    const t2 = mk(W, H), t2g = t2.getContext('2d'); t2g.fillStyle = '#fff'; t2g.fillRect(0, 0, W, H); t2g.globalCompositeOperation = 'destination-out'; t2g.drawImage(sh, 0, 0);
    const t3 = mk(W, H), t3g = t3.getContext('2d'); t3g.fillStyle = '#000'; t3g.fillRect(0, 0, W, H); t3g.drawImage(t2, 0, 0);
    cg.drawImage(t3, 0, 0); cg.restore();
  };
  // torn smile centreline (head frame): wide, corners up, running past the outline on the right
  const mouthC = [];
  for (let i = 0; i <= 70; i++) {
    const t = i / 70, x = lerp(-0.68, 1.12, t), xs = clamp(x / 0.74, -1, 1);
    let y = 0.36 + 0.16 * (1 - xs * xs);
    if (x > 0.74) y = 0.36 - (x - 0.74) * 0.5 - Math.pow(x - 0.74, 2) * 0.5;
    mouthC.push([x, y]);
  }
  const openAt = (x) => x < 0.74 ? 0.16 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs((x - 0.03) / 0.74), 2.2)), 0.55) + 0.014 : 0.03 * Math.max(0, 1 - (x - 0.74) / 0.4) + 0.007;
  const TM = (() => {
    const r = rng('costume:torn'), up = [], lo = [], cU = [], cL = [];
    for (let i = 0; i < mouthC.length; i++) {
      const [x, y] = mouthC[i], a = i < mouthC.length - 1 ? Math.atan2(mouthC[i + 1][1] - y, mouthC[i + 1][0] - x) : Math.atan2(y - mouthC[i - 1][1], x - mouthC[i - 1][0]);
      const nx = -Math.sin(a), ny = Math.cos(a), o = openAt(x);
      const ru = o * (0.55 + 0.25 * HZ.noise1(i * 0.7, 3) + 0.14 * (r() - 0.5)), rl = o * (1.0 + 0.4 * HZ.noise1(i * 0.6, 9) + 0.2 * (r() - 0.5));
      up.push([x - nx * ru, y - ny * ru]); lo.push([x + nx * rl, y + ny * rl]);
    }
    return { up, lo, open: up.concat(lo.slice().reverse()) };
  })();
  c.albedo = (ag, G, U) => {
    G.holes = holes.map(o => { const pts = []; for (let k = 0; k < 64; k++) { const a = k / 64 * TAU; pts.push([o.x + Math.cos(a) * o.rx * (1 + 0.03 * Math.sin(a * 5)), o.y + Math.sin(a) * o.ry]); } return mapPts(G.h, pts); });
    for (const hp of G.holes) { ag.fillStyle = '#040303'; ag.fill(path(hp)); }
    // running stitch around the face edge and an old repair seam across the forehead
    const inset = mapPts(G.h, G.faceL.map(([u, v]) => [u * 0.93, v * 0.93]));
    ag.save(); ag.setLineDash([9, 7]); ag.strokeStyle = 'rgba(64,48,34,0.85)'; ag.lineWidth = 2.6; ag.stroke(path(inset)); ag.restore();
    // the tear: black void
    G.mouthScr = mapPts(G.h, TM.open);
    ag.fillStyle = '#030102'; ag.fill(path(G.mouthScr));
    // remnants of the painted smile line along the upper edge (dark maroon-brown, never bright red)
    ag.save(); ag.strokeStyle = 'rgba(58,22,20,0.85)'; ag.lineWidth = 4; ag.setLineDash([28, 9, 14, 12]);
    ag.translate(0, -3); ag.stroke(path(mapPts(G.h, TM.up.slice(4, 52)), false)); ag.restore();
  };
  c.height = (h, mat, G, U) => {
    const R2 = G.R;
    for (const hp of G.holes) {
      const m = U.maskOf(g => g.fill(path(hp)), 3), rim = U.maskOf(g => { g.lineWidth = R2 * 0.05; g.stroke(path(hp)); }, R2 * 0.02);
      for (let i = 0; i < h.length; i++) { if (m[i]) h[i] -= m[i] * R2 * 0.3; if (rim[i]) h[i] += rim[i] * R2 * 0.02; }
    }
    const bump = (u, v, rx, ry, amp) => { const [x, y] = G.h(u, v); const m = U.maskOf(g => { g.beginPath(); g.ellipse(x, y, rx * R2, ry * R2, (G.c.tilt || 0) * DEG, 0, TAU); g.fill(); }, R2 * Math.min(rx, ry) * 0.8); U.addTo(h, m, amp * R2); };
    bump(-0.4, -0.52, 0.32, 0.1, 0.035); bump(0.4, -0.44, 0.3, 0.1, 0.03);
    bump(-0.56, 0.2, 0.22, 0.18, 0.05); bump(0.56, 0.25, 0.2, 0.18, 0.03);
    bump(0.05, 0.8, 0.3, 0.12, 0.04);
    const mp = path(G.mouthScr);
    const m = U.maskOf(g => g.fill(mp), 2.5), lip = U.maskOf(g => { g.lineWidth = R2 * 0.06; g.stroke(mp); }, R2 * 0.02);
    for (let i = 0; i < h.length; i++) { if (lip[i]) h[i] += lip[i] * R2 * 0.025; if (m[i]) h[i] -= m[i] * R2 * 0.4; }
  };
  c.overlay = (cg, G, U) => {
    const R2 = G.R;
    const LI = cg.getImageData(0, 0, G.W, G.H).data, litAt = (x, y) => { const i = (clamp(y | 0, 0, G.H - 1) * G.W + clamp(x | 0, 0, G.W - 1)) * 4; return Math.min(1.4, (LI[i] + LI[i + 1] + LI[i + 2]) / 3 / 200 + 0.03); };
    // ---- teeth through the tear (upper row hanging, lower row standing), set back behind the felt
    const upL = [], loL = [];
    for (let i = 0; i <= 40; i++) { const x = lerp(-0.62, 0.7, i / 40), xs = x / 0.74, y = 0.36 + 0.16 * (1 - xs * xs); upL.push([x, y - 0.09]); loL.push([x * 0.97, y + 0.17]); }
    const lowVis = (X, Y) => 0.55;
    mouthPP(cg, G, {
      open: TM.open,
      rows: [
        { line: upL, dir: 1, n: 8, len: 0.15, persp: 0.45, z: R2 * 0.02, zBack: R2 * 0.08, ao: [1, 0.35], seed: 'costume:u', crooked: 2, jit: 0.2, gum: { depth: 0.06, height: 0.014, round: 0.012, pap: 0.24, arc: 0.07 } },
        { line: loL, dir: -1, n: 7, len: 0.12, persp: 0.45, lower: true, z: R2 * 0.0, zBack: R2 * 0.08, ao: [0.8, 0.3], seed: 'costume:l', crooked: 2.4, jit: 0.2, gum: { depth: 0.05, height: 0.012, round: 0.012, pap: 0.22, arc: 0.06 } },
      ],
      shadowLip: [{ pts: TM.up, width: 0.035, blur: 6, a: 0.75 }, { pts: TM.lo, width: 0.03, blur: 6, a: 0.6 }], ivory: '#E8DFC8',
    });
    // frayed felt edges of the tear: fibres crossing in front of the teeth, loose threads bridging it
    fray(cg, mapPts(G.h, TM.up), { n: 2, len: [3, 10], side: 1, seed: 'costume:fu', col: [214, 200, 172], alpha: [0.45, 0.95], light: litAt, w: [0.6, 1.4] });
    fray(cg, mapPts(G.h, TM.lo), { n: 2, len: [3, 10], side: -1, seed: 'costume:fl', col: [214, 200, 172], alpha: [0.45, 0.95], light: litAt, w: [0.6, 1.4] });
    cg.save(); cg.lineCap = 'round';
    for (const t of [0.16, 0.37, 0.58]) {
      const i = Math.round(t * (TM.up.length - 1)), a = G.h(...TM.up[i]), b = G.h(...TM.lo[Math.min(TM.lo.length - 1, i + 3)]);
      const k = litAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      cg.strokeStyle = `rgba(${210 * k | 0},${196 * k | 0},${170 * k | 0},0.9)`; cg.lineWidth = 1.6;
      cg.beginPath(); cg.moveTo(a[0], a[1]); cg.quadraticCurveTo((a[0] + b[0]) / 2 + 6, (a[1] + b[1]) / 2 + 12, b[0], b[1]); cg.stroke();
    }
    cg.restore();
    // ---- the left hole: someone's real eye pressed to the mesh from inside
    const hp = path(G.holes[0]);
    const [ex, ey] = G.h(holes[0].x + 0.01, holes[0].y + 0.01);
    cg.save(); cg.clip(hp);
    // dim skin around the eye, inside the dark head
    HZ.pillowPP(cg, G.st, (lg) => { const sg = lg.createRadialGradient(ex, ey + R2 * 0.04, R2 * 0.02, ex, ey, R2 * 0.3); sg.addColorStop(0, '#7E6458'); sg.addColorStop(1, '#2A1C18'); lg.fillStyle = sg; lg.fill(hp); },
      { mat: MAT.skin, height: R2 * 0.05, round: R2 * 0.05, z: G.hAt(ex, ey) - R2 * 0.12, lw: SS, pores: 0.4, poreScale: 0.7, seed: 'costume:sk' });
    const k = 1, lwH = SS / (G.R * G.sx);
    const TU = new DOMMatrix().translate(ex, ey).rotate(14).scale(G.R * G.sx, G.R * G.sx);
    const L0 = G.st.L[0], hpx = 0.4 * 0.38 * 1.2 * G.R, ldx = L0.x - ex, ldy = L0.y - ey, ll = Math.hypot(ldx, ldy);
    cg.save(); cg.setTransform(TU);
    const eye = HZ.eyePP(cg, G.st, { cx: 0, cy: 0, w: 0.52, open: 1.3, side: -1, iris: 0.2, pupil: 0.09, irisCol: ['#8E7A50', '#7E8676', '#2E3634'], veins: 5, lowerFlat: 0.6,
      window: { x: 0, y: -0.3, s: 0.28, a: 0.95 }, lashes: 16, lashLen: 0.12, press: 0.9, lidSkin: '#7A5E52', ring: 0.12, socket: 0.3, lw: lwH, seed: 'costume:eye',
      z: G.hAt(ex, ey) - R2 * 0.08, lidShadow: 0.5, gain: 2.3,
      vis: (X, Y) => 0.35 + 0.65 * sstep(-0.9, 0.7, ((X - ex) * ldx + (Y - ey) * ldy) / ll / hpx) });
    cg.restore();
    meshGrid(cg, G, hp, ex, ey, true, litAt);
    cg.restore();
    const eap = new Path2D(); eap.addPath(eye.ap, TU); G.sharp.push(eap);
    // ---- the right hole: black, empty, its mesh barely there
    const hp2 = path(G.holes[1]); const [rx, ry] = G.h(holes[1].x, holes[1].y);
    cg.save(); cg.clip(hp2); cg.fillStyle = '#010101'; cg.fill(hp2); meshGrid(cg, G, hp2, rx, ry, false, litAt); cg.restore();
  };
  function meshGrid(cg, G, hp, ex, ey, bright, litAt) {
    const R2 = G.R, step = R2 * 0.085, a = (G.c.tilt || 0) * DEG + Math.PI / 4;
    cg.save(); cg.clip(hp); cg.translate(ex, ey); cg.rotate(a);
    for (const dir of [0, 1]) {
      for (let k = -14; k <= 14; k++) {
        const o = k * step;
        cg.save(); if (dir) cg.rotate(Math.PI / 2);
        cg.fillStyle = 'rgba(10,9,8,0.9)'; cg.fillRect(-R2, o - 1.1, R2 * 2, 2.2);
        // the lower edge of each wire catches the low light
        cg.fillStyle = bright ? 'rgba(170,160,140,0.32)' : 'rgba(70,64,56,0.18)'; cg.fillRect(-R2, o + 1.0, R2 * 2, 0.9);
        cg.restore();
      }
    }
    cg.restore();
  }
  c.contourExtra = (cg, G, b, fadeLit) => {
    HZ.tremor(cg, G.mouthScr, { lw: SS, seed: 'costume:ctm:' + b, closed: true, passes: 2, w: [0.5, 1.5], alpha: 0.75, fade: fadeLit([0, -10]) });
    for (let k = 0; k < 2; k++) HZ.tremor(cg, G.holes[k], { lw: SS, seed: 'costume:cth' + k + ':' + b, closed: true, passes: 2, w: [0.5, 1.6], alpha: 0.75, fade: fadeLit([0, 10]) });
  };
  return buildFace(c);
}

const A = P.ASSETS;
A.poppy_scare_closet = (cv) => { const { out } = closet('A'); cv.getContext('2d').drawImage(out, 0, 0); };
A.poppy_scare_closet_b = (cv) => { const { out } = closet('B'); cv.getContext('2d').drawImage(out, 0, 0); };
A.poppy_scare_costume = (cv) => { const { out } = costume('A'); cv.getContext('2d').drawImage(out, 0, 0); };
A.poppy_scare_costume_b = (cv) => { const { out } = costume('B'); cv.getContext('2d').drawImage(out, 0, 0); };
A.poppy_scare_final = (cv) => { const { out } = finalFace('A'); cv.getContext('2d').drawImage(out, 0, 0); };
A.poppy_scare_final_b = (cv) => { const { out } = finalFace('B'); cv.getContext('2d').drawImage(out, 0, 0); };

root.Poppy.SCARE = { SS, buildFace, rig, faceLocal, petalsLocal, splineClosed, maskOf, mouthPP, lipOpening, eyeInSocket, wornPatch, nostrils, doors, fray, closet, finalFace, costume };
})(typeof window !== 'undefined' ? window : globalThis);
