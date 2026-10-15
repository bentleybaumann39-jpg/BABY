/* faces.js - OPPOSITE DAY: the three scare faces and their boil frames.
 *
 * Loaded after horror.js (HZ), felt.js (FELT), twins.js (OPP) and portrait.js.
 * The face builder (buildFace + mouthPP / eyeInSocket / wornPatch / fray) is
 * copied from the proven poppy/draw/scare.js pipeline and generalised for
 * heads without petals (c.petals === false), with hooks for hair, ears and a
 * felt-ball nose:
 *  - built at 2x as an albedo layer + a HEIGHT FIELD shaded per pixel by one
 *    low point light with soft cast shadows (HZ.reliefPP);
 *  - realism patches shaded per pixel under the same light: wet eyes
 *    (HZ.eyePP), real teeth and gums (HZ.teethPP / HZ.gumsPP);
 *  - Junji-Ito hatching in the shadow band and a tremoring overdrawn contour;
 *    the boil frames (_b) re-seed ONLY the hatching and the tremor;
 *  - tone / levels to the value budget, grain, downsample to 800x600.
 * THATCHER faces: the eyes are drawn rotated 180 degrees inside their sockets
 * (with the nasal corner kept toward the nose) and the mouth is the inverted
 * smile with the upper teeth standing on a gum line BELOW them, so the whole
 * picture turned upside down reads as a sweet, normal face.
 * No blood, no wounds, no red pools: felt, painted gouache, human teeth.
 */
(function (root) {
'use strict';
const HZ = root.HZ, FELT = root.FELT;
const P = { feltTexture: (w, h, seed, scale) => FELT.feltTexture(w, h, seed, scale) };
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
  G.faceL = c.outline ? c.outline.map(p => p.slice()) : faceLocal(c, seed);
  G.face = mapPts(G.h, G.faceL);
  G.facePath = path(G.face);
  G.petals = c.petals === false ? [] : petalsLocal(c, seed).map(p => Object.assign(p, { scr: mapPts(G.h, p.pts) }));
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
  if (c.faceFill) c.faceFill(ag, G, U);
  else {
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
  const lit = HZ.reliefPP(G.st, { W, H, h, alb: albedoId, matId: mat, mats: [Object.assign({}, MAT.felt, c.feltMat || {}), MAT.button, MAT.skin, MAT.thread, Object.assign({}, MAT.felt, { visK: c.petalShadowK || 0 }), c.mat5 || MAT.felt, c.mat6 || MAT.felt],
    cavity: c.cavity === undefined ? 0.012 : c.cavity, cavityR: R * 0.07, shadow: Object.assign({ steps: 70, soft: 7, bias: 1.0, maxDist: R * 1.3 }, c.shadow || {}) });
  for (const lost of [].concat(c.lost || [])) {      // lost edges: the head dissolves into black toward each direction given
    const d = lit.img.data, ca = Math.cos(lost.ang * DEG), sa = Math.sin(lost.ang * DEG);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = ((x - G.cx) * ca + (y - G.cy) * sa) / R, f = 1 - sstep(lost.a, lost.b, t) * (lost.k === undefined ? 1 : lost.k);
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
  const rows = M.rows.map(rw => rw.between === undefined ? Object.assign({ list: HZ.archTeeth(rw.line, Object.assign({ lw: lwH }, rw)).filter((t, i) => !(rw.missing || []).includes(i)) }, rw) : Object.assign({}, rw));
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
  const TU = new DOMMatrix().translate(ex, ey).rotate((G.c.eyeTilt || 0) + (E.flip ? 180 : 0)).scale(G.R * G.sx * k, G.R * G.sx * k);
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
  }, { mat: MAT.skin, height: Math.min(rx, ry) * 0.12, round: Math.min(rx, ry) * 0.6, z: z - G.R * 0.02, lw: SS, pores: o.pores || 0.6, poreScale: o.poreScale || 0.55, noise: [0.6, 5], seed: o.seed + 'sk' });
  // inner shadow under the felt rim, then the frayed felt edge and a few pills on it
  cg.save(); cg.clip(pp); cg.filter = 'blur(4px)'; cg.strokeStyle = 'rgba(0,0,0,0.75)'; cg.lineWidth = 10; cg.stroke(pp); cg.restore();
  const vis = (px, py) => { const i = (clamp(py | 0, 0, G.H - 1)) * G.W + clamp(px | 0, 0, G.W - 1); return G.key[i]; };
  const lum = (px, py) => G.st.L[0] ? 1 : 1;
  fray(cg, HZ.resample(pts, 4, true).map(p => [p[0], p[1]]), { n: 1, len: [2, 6], side: -1, seed: o.seed + 'f', col: o.feltRGB || [190, 176, 150], alpha: [0.25, 0.6], light: o.light });
  G.sharp.push(pp);
  return pp;
}

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
function nostrilAlbedo(ag, G, N, o) {
  o = o || {};
  for (const n of N) {
    ag.save(); ag.filter = 'blur(3px)'; ag.fillStyle = o.alaCol || 'rgba(120,92,80,0.55)'; ag.fill(path(n.ala)); ag.restore();
    ag.fillStyle = o.rimCol || '#7A5A50'; ag.fill(path(n.hole));
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

/* =================================================================== OPPOSITE DAY */
const OPP = root.OPP;
/* felt slit hugging an eye aperture; flip = the eye is turned upside down in it */
function eyeTU(G, e) {
  const [ex, ey] = G.e(e.u, e.v), k = G.kf(e.u);
  return new DOMMatrix().translate(ex, ey).rotate((G.c.eyeTilt || 0) + (e.flip ? 180 : 0)).scale(G.R * G.sx * k, G.R * G.sx * k);
}
function feltSlit(G, e, EW, OPEN, lowerFlat, pad) {
  const S = HZ.eyeShape({ w: EW, open: OPEN, side: e.side, lowerFlat }), TU = eyeTU(G, e), r = rng(e.seed + ':slit'), k = pad || 1.03;
  const pts = S.up.map(([x, y]) => [x * k, y * (k + 0.01) - 0.004 + (r() - 0.5) * 0.006]).concat(S.lo.slice().reverse().map(([x, y]) => [x * k, y * (k + 0.02) + 0.005 + (r() - 0.5) * 0.006]));
  return { pts: pts.map(([x, y]) => { const p = TU.transformPoint(new DOMPoint(x, y)); return [p.x, p.y]; }), S, TU,
    upper: S.up.map(([x, y]) => { const p = TU.transformPoint(new DOMPoint(x * 1.02, y * 1.06 - 0.01)); return [p.x, p.y]; }) };
}
/* a torn hole in the felt around an eye, big enough to show the human lids
 * (crease, lashes, lid skin) of the realistic eye set inside it. Eye frame
 * (TU, flips included): up = the upper-lid side BEFORE any flip. */
function tornHole(G, e, EW, OPEN, o) {
  o = Object.assign({ kx: 0.66, up: 1.55, lo: 1.0, jag: 0.07, pw: 2.6 }, o || {});
  const TU = eyeTU(G, e), w = EW, h = w * 0.38 * OPEN, r = rng(e.seed + ':hole'), sd = HZ.hashStr(e.seed) % 997, pts = [], N = 140;
  for (let i = 0; i < N; i++) {
    const a = i / N * TAU, c = Math.cos(a), sn = Math.sin(a);
    const ex = 2 / o.pw, cx = Math.sign(c) * Math.pow(Math.abs(c), ex), sy = Math.sign(sn) * Math.pow(Math.abs(sn), ex);
    const k = 1 + o.jag * HZ.noise1(i * 0.45, sd) + 0.025 * (r() - 0.5) + (r() < 0.06 ? 0.06 * r() : 0);
    pts.push([cx * w * o.kx * k, (sy < 0 ? sy * h * o.up : sy * h * o.lo) * k - h * 0.1]);
  }
  return pts.map(([x, y]) => { const p = TU.transformPoint(new DOMPoint(x, y)); return [p.x, p.y]; });
}
/* torn running stitches along a lip edge (device px points): thread stubs that
 * used to close the mouth, puncture holes, a few loose ends hanging into it */
function tornStitches(cg, G, pts, o) {
  o = Object.assign({ every: 26, len: 14, side: 1, col: [96, 18, 30], seed: 'torn', light: null, loose: 4, w: 4.2 }, o);
  const r = rng(o.seed + ':torn');
  cg.save(); cg.lineCap = 'round';
  const S = HZ.resample(pts, o.every, false);
  S.forEach(([x, y, a], i) => {
    const nx = -Math.sin(a) * o.side, ny = Math.cos(a) * o.side, lk = o.light ? o.light(x, y) : 1;
    // the needle hole, pulled and stretched
    cg.fillStyle = `rgba(4,2,2,${0.85})`; cg.beginPath(); cg.ellipse(x - nx * 9, y - ny * 9, 3.4, 2.4, a, 0, TAU); cg.fill();
    if (r() < 0.25) return;
    // the thread stub from the hole over the edge (snapped)
    const L = o.len * (0.5 + r() * 0.9), c = o.col.map(v => clamp(v * lk * (0.8 + r() * 0.4), 0, 255) | 0);
    cg.strokeStyle = `rgba(0,0,0,0.6)`; cg.lineWidth = o.w * 1.3;
    cg.beginPath(); cg.moveTo(x - nx * 9 + 1.5, y - ny * 9 + 2); cg.quadraticCurveTo(x + 1.5, y + 2, x + nx * L + (r() - 0.5) * 8 + 1.5, y + ny * L + 2); cg.stroke();
    cg.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`; cg.lineWidth = o.w;
    cg.beginPath(); cg.moveTo(x - nx * 9, y - ny * 9); cg.quadraticCurveTo(x, y, x + nx * L + (r() - 0.5) * 8, y + ny * L); cg.stroke();
    // frayed end
    const ex = x + nx * L, ey = y + ny * L;
    cg.lineWidth = 1.2; for (let q = 0; q < 3; q++) { cg.beginPath(); cg.moveTo(ex, ey); cg.lineTo(ex + nx * (3 + r() * 5) + (r() - 0.5) * 6, ey + ny * (3 + r() * 5) + (r() - 0.5) * 6); cg.stroke(); }
  });
  cg.restore();
}
function litSampler(cg, G, base) {
  const LI = cg.getImageData(0, 0, G.W, G.H).data;
  return (x, y) => { const i = (clamp(y | 0, 0, G.H - 1) * G.W + clamp(x | 0, 0, G.W - 1)) * 4; return Math.min(1.4, (LI[i] + LI[i + 1] + LI[i + 2]) / 3 / 200 + (base || 0.04)); };
}

/* BIM's felt head parts on the builder: bowl cut, ears, cheeks, brows, felt-ball nose.
 * hk: options {partX, cheekK, browSad} */
function twinHeadParts(c, hk) {
  hk = hk || {};
  const hairL = OPP.hairShape({ turn: 0, partX: hk.partX === undefined ? 0.42 : hk.partX });
  const prevA = c.albedo, prevH = c.height;
  c.albedo = (ag, G, U) => {
    G.hairScr = mapPts(G.h, hairL); G.hairPath = path(G.hairScr);
    G.ears = [-1, 1].map(sd => { const pts = []; for (let k = 0; k < 40; k++) { const a = k / 40 * TAU; pts.push([sd * 1.0 + Math.cos(a) * 0.17, 0.24 + Math.sin(a) * 0.2]); } return mapPts(G.h, pts); });
    for (const e of G.ears) { ag.fillStyle = HZ.mixc(c.faceCol, '#B07A10', 0.25); ag.fill(path(e)); U.feltOver(ag, path(e), 0.8, 2.6, 19); }
    // cheeks (felt circles) on the face
    ag.save(); ag.clip(G.facePath);
    for (const sd of [-1, 1]) {
      const [x, y] = G.h(sd * 0.6, 0.38), rr = G.R * 0.19;
      const cgd = ag.createRadialGradient(x, y, 0, x, y, rr); cgd.addColorStop(0, `rgba(236,120,112,${0.75 * (hk.cheekK || 1)})`); cgd.addColorStop(0.75, `rgba(236,120,112,${0.55 * (hk.cheekK || 1)})`); cgd.addColorStop(1, 'rgba(236,120,112,0)');
      ag.fillStyle = cgd; ag.beginPath(); ag.arc(x, y, rr, 0, TAU); ag.fill();
    }
    ag.restore();
    // the bowl cut: dark brown felt, strands combed from the parting
    const hp = G.hairPath;
    const hg = ag.createLinearGradient(0, G.h(0, -1.1)[1], 0, G.h(0, 0.2)[1]); hg.addColorStop(0, '#5E3A22'); hg.addColorStop(1, '#4A2C18');
    ag.fillStyle = hg; ag.fill(hp);
    const r = rng(c.seed + ':strands'), px0 = hk.partX === undefined ? 0.42 : hk.partX;
    ag.save(); ag.clip(hp); ag.lineCap = 'round';
    for (let i = 0; i < 180; i++) {
      const u = r(), sd = u < 0.5 ? -1 : 1, tgt = sd < 0 ? lerp(-1.06, px0 - 0.05, u * 2) : lerp(px0 + 0.05, 1.06, (u - 0.5) * 2);
      const a0 = G.h(px0 + sd * 0.03 + (r() - 0.5) * 0.06, -1.02 + r() * 0.08), a1 = G.h(tgt, -0.3 - 0.45 * Math.pow(Math.abs(tgt) / 1.05, 4) + r() * 0.05);
      ag.strokeStyle = r() < 0.6 ? `rgba(18,8,2,${0.2 + r() * 0.25})` : `rgba(150,105,70,${0.12 + r() * 0.12})`; ag.lineWidth = 2 + r() * 4;
      ag.beginPath(); ag.moveTo(a0[0], a0[1]); ag.bezierCurveTo(lerp(a0[0], a1[0], 0.6), a0[1] - 20, a1[0], lerp(a0[1], a1[1], 0.4), a1[0], a1[1]); ag.stroke();
    }
    ag.restore();
    U.feltOver(ag, hp, 0.9, 2.6, 23);
    // brows: felt slivers
    G.brows = [-1, 1].map(sd => { const pts = []; const ang = (hk.browSad ? -sd * 0.42 : sd * 0.1); for (let k = 0; k < 30; k++) { const a = k / 30 * TAU, x = Math.cos(a) * 0.15, y = Math.sin(a) * 0.035; pts.push([sd * 0.36 + x * Math.cos(ang) - y * Math.sin(ang), -0.215 + x * Math.sin(ang) + y * Math.cos(ang)]); } return mapPts(G.h, pts); });
    if (hk.noBrows) G.brows = [];
    for (const b of G.brows) { ag.fillStyle = '#4A2A16'; ag.fill(path(b)); }
    // the felt-ball nose
    const nz = hk.nose || { x: 0, y: 0.2, r: 0.1 };
    G.nosePts = []; for (let k = 0; k < 48; k++) { const a = k / 48 * TAU; G.nosePts.push([nz.x + Math.cos(a) * nz.r, nz.y + Math.sin(a) * nz.r]); }
    G.noseScr = mapPts(G.h, G.nosePts);
    const [nx, ny] = G.h(nz.x, nz.y), ngr = ag.createRadialGradient(nx, ny, 0, nx, ny, nz.r * G.R * SS / SS);
    ngr.addColorStop(0, '#F8A050'); ngr.addColorStop(1, '#C8641A'); ag.fillStyle = ngr; ag.fill(path(G.noseScr)); U.feltOver(ag, path(G.noseScr), 0.7, 2.0, 29);
    if (prevA) prevA(ag, G, U);
  };
  c.height = (h, mat, G, U) => {
    const R2 = G.R;
    // the bowl stands proud of the head; the fringe's cut edge is a step
    const hm = U.maskOf(g => g.fill(G.hairPath), R2 * 0.025), hmB = U.maskOf(g => g.fill(G.hairPath), R2 * 0.12);
    for (let i = 0; i < h.length; i++) if (hm[i]) h[i] = Math.max(h[i], h[i] * (1 - hm[i]) + hm[i] * (R2 * 0.3 + R2 * 0.12 * hmB[i]));
    U.addTo(h, U.maskOf(g => { for (const e of G.ears) g.fill(path(e)); }, R2 * 0.05), R2 * 0.12);
    U.addTo(h, U.maskOf(g => { for (const b of G.brows) g.fill(path(b)); }, R2 * 0.01), R2 * 0.025);
    const nm = U.maskOf(g => g.fill(path(G.noseScr)), R2 * 0.006), nmB = U.maskOf(g => g.fill(path(G.noseScr)), R2 * 0.05);
    for (let i = 0; i < h.length; i++) if (nm[i] > 0.02) h[i] += R2 * (hk.noseH || 0.2) * Math.pow(nmB[i], 0.5) * nm[i];
    if (prevH) prevH(h, mat, G, U);
  };
  const prevHx = c.hatchExtra;
  c.hatchExtra = (g, G) => { if (hk.hatchHair !== false) g.fill(G.hairPath); for (const e of G.ears) g.fill(path(e)); if (prevHx) prevHx(g, G); };
  const prevCx = c.contourExtra;
  c.contourExtra = (cg, G, b, fadeLit) => {
    HZ.tremor(cg, G.hairScr, { lw: SS, seed: c.seed + ':cth:' + b, closed: true, passes: 2, w: [0.6, 1.6], alpha: 0.8, fade: fadeLit([0, 10]) });
    if (prevCx) prevCx(cg, G, b, fadeLit);
  };
  return c;
}

/* ======================================================= SCARE 3: BIM THATCHERED
 * BIM's felt face right way up, 90% of the frame, with his eyes and mouth upside
 * down inside it: two real wet eyes turned over in felt slits (the heavy upper
 * lid and the lashes at the BOTTOM, the shining waterline on TOP), pinpoint
 * pupils dead into the lens, veined grey-pink whites; his sewn smile turned
 * over into a frown whose stitches have torn open on real ivory teeth that
 * stand on wet scalloped gums BELOW them. Underlit 45 degrees from below-left,
 * hard terminator, the far side lost. Rotated 180 degrees it is a sweet,
 * smiling, toothy face (bim_scare_turn). */
function bimScare(boil) {
  const R = 300;
  const MX = 0.5, mY = 0.6;
  const yB = (x) => { const t = clamp(x / MX, -1, 1); return mY + 0.13 * t * t + 0.01 * Math.sin(x * 13); };                      // inverted upper lip (bottom edge)
  const yT = (x) => { const t = clamp(x / MX, -1, 1); return yB(x) - 0.27 * Math.pow(Math.max(0, 1 - t * t), 0.7) - 0.008; };     // inverted lower lip (top edge)
  const lips = lipOpening(-MX, MX, yT, yB, 100, 0.008, 'bimS');
  const c = {
    W: 800, H: 600, cx: 400, cy: 322, R, sx: 1, sy: 1.04, tilt: 0, eyeTilt: 0, crumple: 0.1, jaw: 0.0, seed: 'bimS1', boil, halfK: 1.05,
    petals: false, nose: false, outline: OPP.headOutline(), faceCol: '#D8B444', decay: 0.55, stainK: 0.75, pills: 520, feltK: 1.0, dome: 0.42, fuzzH: 1.1, pillH: 1.0,
    lights: (G) => ({
      // key 45 degrees below, from the left: the chin and the screen-left cheek catch it, the forehead falls away
      light: { x: 270 * SS, y: 800 * SS, z: 390 * SS, col: [1.18, 1.08, 0.92], power: 2.9, d0: 250 * SS, hard: 0.8, cut: 0.15, cutSoft: 0.08 },
      fill: { x: 560 * SS, y: -200 * SS, z: 900 * SS, col: [0.55, 0.65, 0.9], power: 0.07, d0: 1200 * SS },
      ambient: [0.003, 0.003, 0.004],
    }),
    lost: [{ ang: 10, a: 0.1, b: 0.92, k: 0.97 }, { ang: -95, a: 0.35, b: 1.05, k: 0.9 }],
    shadow: { soft: 3.2, bias: 2 },
    tone: { exp: 1.6, shoulder: 1.6, gamma: 1.12 },
    hatch: { n: 640, len: [22, 54], w: 1.4, alpha: [0.45, 0.85], cluster: [5, 9], gap: 4.5, lite: 0, liteBand: [0.004, 0.06], band: [0.015, 0.08, 0.3] },
  };
  const EW = 0.43, OPEN = 1.16;
  // the eyes (drawn flipped): screen-left eye uses side +1 so its nasal corner stays toward the nose once turned
  const eyes = [
    { u: -0.36, v: 0.0, side: 1, flip: true, seed: 'bimS:eL' },
    { u: 0.36, v: 0.04, side: -1, flip: true, seed: 'bimS:eR' },       // one eye 4% lower (a proportion break)
  ];
  c.albedo = (ag, G, U) => {
    // asymmetric tears (damage, not a mask): the screen-left hole is ripped wider and ragged toward the temple
    G.sockets = eyes.map((e, k) => tornHole(G, e, EW, OPEN, k === 0 ? { kx: 0.7, up: 1.42, lo: 0.95, jag: 0.16, pw: 2.2 } : { kx: 0.58, up: 1.18, lo: 0.8, jag: 0.08, pw: 2.8 }));
    for (const s of G.sockets) { ag.fillStyle = '#0A0706'; ag.fill(path(s)); }
    G.mouthScr = mapPts(G.h, lips.open);
    ag.fillStyle = '#050203'; ag.fill(path(G.mouthScr));
    // the old smile's corner tucks, turned over: one short dark thread stitch pointing down-and-out at each corner
    ag.save(); ag.strokeStyle = 'rgba(52,10,18,0.95)'; ag.lineWidth = 9; ag.lineCap = 'round';
    for (const sd of [-1, 1]) { const a = G.h(sd * (MX + 0.01), yB(sd * MX) + 0.005), b = G.h(sd * (MX + 0.035), yB(sd * MX) + 0.05); ag.beginPath(); ag.moveTo(a[0], a[1]); ag.lineTo(b[0], b[1]); ag.stroke(); }
    ag.restore();
    // grime in the felt creases at the mouth corners and under the holes
    ag.save(); ag.strokeStyle = 'rgba(90,64,20,0.28)'; ag.lineCap = 'round'; ag.filter = 'blur(2px)';
    for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) { const a = G.h(sd * (MX + 0.02), yB(sd * MX) - 0.04 - k * 0.03), b = G.h(sd * (MX + 0.12 + k * 0.03), yB(sd * MX) - 0.12 - k * 0.06); ag.lineWidth = 2 + k; ag.beginPath(); ag.moveTo(a[0], a[1]); ag.lineTo(b[0], b[1]); ag.stroke(); }
    ag.restore();
  };
  c.height = (h, mat, G, U) => {
    const R2 = G.R;
    for (const s of G.sockets) {
      const m = U.maskOf(g => g.fill(path(s)), R2 * 0.012);
      for (let i = 0; i < h.length; i++) if (m[i]) h[i] -= m[i] * R2 * 0.06;
      // the torn felt rim stands up a little
      U.addTo(h, U.maskOf(g => { g.lineWidth = R2 * 0.03; g.lineJoin = 'round'; g.stroke(path(s)); }, R2 * 0.012), R2 * 0.012);
    }
    const mp = path(G.mouthScr);
    const lip = U.maskOf(g => { g.lineWidth = R2 * 0.07; g.lineJoin = 'round'; g.stroke(mp); }, R2 * 0.02), m = U.maskOf(g => g.fill(mp), 2.5);
    for (let i = 0; i < h.length; i++) { if (lip[i]) h[i] += lip[i] * R2 * 0.03; if (m[i]) h[i] -= m[i] * R2 * 0.32; }
    const bump = (u, v, rx, ry, amp) => { const [x, y] = G.h(u, v); const mm = U.maskOf(g => { g.beginPath(); g.ellipse(x, y, rx * R2, ry * R2 * G.sy, 0, 0, TAU); g.fill(); }, R2 * Math.min(rx, ry) * 0.7); U.addTo(h, mm, amp * R2); };
    bump(-0.6, 0.36, 0.26, 0.2, 0.045); bump(0.6, 0.36, 0.26, 0.2, 0.04); bump(0, 0.9, 0.36, 0.1, 0.03);
  };
  twinHeadParts(c, { partX: 0.42, cheekK: 0.85, noBrows: true, noseH: 0.11, hatchHair: false });
  c.overlay = (cg, G, U) => {
    const R2 = G.R, litAt = litSampler(cg, G);
    // ---- the mouth: upper teeth turned over, standing on their wet gums at the bottom of the opening;
    //      the lower row hangs at the top, set back in the dark (too many teeth: a second row behind)
    const gumL = [], backL = [];
    for (let i = 0; i <= 60; i++) { const x = lerp(-MX * 0.88, MX * 0.88, i / 60); gumL.push([x, yB(x) - 0.06]); backL.push([x * 0.92, yT(x) + 0.05]); }
    const frontVis = (X, Y) => { const [u, v] = G.toHead(X, Y); return 0.4 + 0.6 * sstep(0.0, 0.09, yB(u) - v - 0.02); };
    const backVis = (X, Y) => { const [u, v] = G.toHead(X, Y); return 0.12 + 0.3 * sstep(0.02, 0.1, v - yT(u)); };
    mouthPP(cg, G, {
      open: lips.open,
      rows: [
        { line: backL, dir: 1, n: 14, len: 0.085, crooked: 1.6, jit: 0.2, persp: 0.45, lower: true, z: R2 * 0.02, zBack: R2 * 0.1, ao: [0.75, 0.25], seed: 'bimS:lo', vis: backVis, back: true,
          gum: { depth: 0.05, height: 0.012, round: 0.01, pap: 0.22, arc: 0.06, col: ['#2A1014', '#6A3438', '#8A5052'], vis: (X, Y) => 0.25 } },
        { line: gumL, dir: -1, n: 17, len: 0.15, crooked: 2.1, jit: 0.24, persp: 0.42, z: R2 * 0.07, zBack: R2 * 0.12, ao: [1, 0.3], seed: 'bimS:up', vis: frontVis,
          gum: { depth: 0.09, height: 0.026, round: 0.014, pap: 0.3, arc: 0.075, col: ['#5E2A32', '#B56E74', '#D99C9A'] } },
      ],
      shadowLip: [{ pts: lips.up, width: 0.05, blur: 8, a: 0.85 }, { pts: lips.lo, width: 0.035, blur: 6, a: 0.5 }], ivory: '#E8DFC8',
    });
    // torn stitches on both edges, loose threads across the gap
    tornStitches(cg, G, mapPts(G.h, lips.up), { side: 1, seed: 'bimS:tu', light: litAt, every: 30, len: 16 });
    tornStitches(cg, G, mapPts(G.h, lips.lo), { side: -1, seed: 'bimS:tl', light: litAt, every: 30, len: 12 });
    fray(cg, mapPts(G.h, lips.up), { n: 2, len: [3, 10], side: 1, seed: 'bimS:fu', col: [236, 204, 96], alpha: [0.35, 0.85], light: litAt });
    fray(cg, mapPts(G.h, lips.lo), { n: 2, len: [3, 10], side: -1, seed: 'bimS:fl', col: [236, 204, 96], alpha: [0.35, 0.85], light: litAt });
    // ---- the eyes: real, wet, turned over inside torn holes in the felt: the heavy lashed lid at the
    //      BOTTOM, the shining waterline on TOP pressed against the iris; pinpoint pupils dead into the lens
    eyes.forEach((e, k) => eyeInSocket(cg, G, Object.assign({ socketPath: G.sockets[k], w: EW, open: OPEN, iris: 0.18, pupil: 0.08, lidSpread: 1.2, ring: 0.13, lidSkin: '#A88470',
      irisCol: ['#A8AC9C', '#8A9696', '#3A4448'], limbal: 0.13, veins: 9, veinCol: '#C49896', gaze: [0, 0], irisDy: 0.13, lowerFlat: 0.8, window: { x: 0, y: -0.32, s: 0.24, a: 0.95, panes: 1 },
      socket: 0.55, recess: 0.03, lidShadow: 0.9, lashes: 32, lashLen: 0.17, gain: 1.45, shadeLo: 0.18, marginA: 0.5, rimShadow: 0.9, wetK: 1.25, waterline: 1.4 }, e)));
    G.sockets.forEach((s, k) => fray(cg, s, { n: 2, len: [2, 9], side: 1, seed: 'bimS:sf' + k, col: [236, 204, 96], alpha: [0.3, 0.75], light: litAt, every: 2 }));
  };
  c.background = (cg, G) => {
    const W = G.W, H = G.H, sp = cg.createRadialGradient(250 * SS, 640 * SS, 40 * SS, 300 * SS, 560 * SS, 620 * SS);
    sp.addColorStop(0, 'rgb(46,40,34)'); sp.addColorStop(0.35, 'rgb(30,26,24)'); sp.addColorStop(0.7, 'rgb(12,11,12)'); sp.addColorStop(1, 'rgb(2,2,3)');
    cg.fillStyle = sp; cg.fillRect(0, 0, W, H);
    // the head's own shadow thrown up the wall behind it, huge and soft
    cg.save(); cg.globalCompositeOperation = 'multiply'; cg.filter = `blur(${22 * SS}px)`; cg.fillStyle = 'rgb(40,40,40)';
    cg.beginPath(); cg.ellipse(G.cx + 70 * SS, G.cy - 120 * SS, G.R * 1.35, G.R * 1.5, 0.2, 0, TAU); cg.fill(); cg.restore();
  };
  c.grade = (cg, G) => capRed(cg, G.W, G.H, 0.8);
  c.contourExtra = (cg, G, b, fadeLit) => {
    HZ.tremor(cg, G.mouthScr, { lw: SS, seed: 'bimS:ctm:' + b, closed: true, passes: 2, w: [0.5, 1.4], alpha: 0.7, fade: fadeLit([0, -10]) });
    G.sockets.forEach((s, k) => HZ.tremor(cg, s, { lw: SS, seed: 'bimS:cts' + k + ':' + b, closed: true, passes: 2, w: [0.5, 1.2], alpha: 0.55, fade: fadeLit([0, -8]) }));
  };
  return buildFace(twinHeadPartsWrap(c));
}
function twinHeadPartsWrap(c) { return c; }

/* barrel "fish-eye" of a canvas (centre magnified), in place */
function fisheye(c, k, cxF, cyF) {
  const W = c.width, H = c.height, g = c.getContext('2d');
  const src = g.getImageData(0, 0, W, H), dst = g.createImageData(W, H), sd = src.data, dd = dst.data;
  const cx = W * (cxF || 0.5), cy = H * (cyF || 0.5), R = Math.hypot(W, H) / 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - cx) / R, dy = (y - cy) / R, r2 = dx * dx + dy * dy, f = 1 - k + k * r2 * 1.25;
    const rx = cx + dx * f * R, ry = cy + dy * f * R, i = (y * W + x) * 4;
    if (rx < 0 || ry < 0 || rx > W - 1.001 || ry > H - 1.001) {      // outside the source: black (no clamped edge smears)
      const out = Math.max(-rx, -ry, rx - (W - 1), ry - (H - 1)), k = clamp(1 - out / 6, 0, 1);
      const qx = clamp(rx, 0, W - 1.001) | 0, qy = clamp(ry, 0, H - 1.001) | 0, q = (qy * W + qx) * 4;
      dd[i] = sd[q] * k; dd[i + 1] = sd[q + 1] * k; dd[i + 2] = sd[q + 2] * k; dd[i + 3] = 255; continue;
    }
    const sx = rx, sy = ry;
    const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0, a = (y0 * W + x0) * 4, b = a + 4, cc = a + W * 4, d = cc + 4;
    for (let ch = 0; ch < 4; ch++) dd[i + ch] = (sd[a + ch] * (1 - fx) + sd[b + ch] * fx) * (1 - fy) + (sd[cc + ch] * (1 - fx) + sd[d + ch] * fx) * fy;
  }
  g.putImageData(dst, 0, 0);
}

/* ======================================================= SCARE 2: MIB AT THE LENS
 * MIB inches from the camera, 75% of the frame, slightly fish-eyed. Bowl cut a
 * black mass on top (parting on screen LEFT: he is the mirror). His LEFT eye
 * (screen right) is still a glossy button, now with a hairline crack; his
 * RIGHT eye (screen left) is a real wet human eye set in a felt slit: white all
 * round the iris, pinpoint pupil, grey-pink capillaries, a shining waterline.
 * His flipped-frown grin has been RE-SEWN WIDER: new running stitches carry it
 * 12% of the head width past the old corners, and through the parted, stretched
 * stitches a sliver of real ivory teeth shows. The pucker 'v' sits ABOVE the
 * mouth. Underlit by the camcorder lamp from below-right, hard terminator; the
 * far side of the head dissolves into black. */
function mibScare(boil) {
  const R = 252, MX0 = 0.4, MX = 0.66, mY = 0.6;
  // MIB's smile = BIM's frown turned over: centre low, corners high (head units)
  const yC = (x) => { const t = x / MX0; return mY + 0.36 * 0.4 * (1 - t * t) * (Math.abs(t) <= 1 ? 1 : 1) - 0.04 * Math.pow(t, 4) * 0.4; };
  const yS = (x) => { const t = clamp(Math.abs(x) / MX0, 0, 2); return Math.abs(x) <= MX0 ? yC(x) : yC(Math.sign(x) * MX0) - (Math.abs(x) - MX0) * 0.75 - Math.pow(Math.abs(x) - MX0, 2) * 0.9; };
  const half = (x) => { const t = Math.abs(x) / MX; return 0.046 * Math.pow(Math.max(0, 1 - Math.pow(t, 2.4)), 0.6) + 0.005; };
  const lips = (() => { const up = [], lo = [], r = rng('mibS:lip'); for (let i = 0; i <= 120; i++) { const x = lerp(-MX, MX, i / 120), y = yS(x), o = half(x) * (0.8 + 0.35 * HZ.noise1(i * 0.4, 7)); up.push([x, y - o * 0.8 + (r() - 0.5) * 0.004]); lo.push([x, y + o * 1.2 + (r() - 0.5) * 0.004]); } return { up, lo, open: up.concat(lo.slice().reverse()) }; })();
  const c = {
    W: 800, H: 600, cx: 410, cy: 310, R, sx: 1, sy: 1.02, tilt: -6, eyeTilt: -6, crumple: 0.3, jaw: 0.0, seed: 'mibS1', boil, dome: 0.4,
    petals: false, nose: false, outline: OPP.headOutline(), faceCol: '#CDB04A', decay: 0.75, stainK: 0.8, pills: 640, feltK: 1.15, fuzzH: 1.4, pillH: 1.3,
    lights: (G) => ({
      light: { x: 510 * SS, y: 660 * SS, z: 265 * SS, col: [1.25, 1.2, 1.1], power: 2.6, d0: 250 * SS, hard: 0.85, cut: 0.12, cutSoft: 0.08 },
      fill: { x: 100 * SS, y: -300 * SS, z: 700 * SS, col: [0.4, 0.55, 0.5], power: 0.06, d0: 1200 * SS },
      ambient: [0.003, 0.003, 0.003],
    }),
    lost: [{ ang: 196, a: 0.18, b: 0.9, k: 0.985 }, { ang: -100, a: 0.45, b: 1.1, k: 0.85 }],
    shadow: { soft: 4, bias: 2 },
    tone: { exp: 1.6, shoulder: 1.6, gamma: 1.15 },
    hatch: { n: 600, len: [22, 56], w: 1.4, alpha: [0.45, 0.85], cluster: [4, 8], gap: 4.5, lite: 0, liteBand: [0.004, 0.06], band: [0.015, 0.08, 0.3] },
  };
  const EW = 0.48, OPEN = 1.62;
  const eye = { u: -0.37, v: 0.02, side: -1, seed: 'mibS:eye' };
  const btn = { u: 0.35, v: 0.02, r: 0.17 };
  c.albedo = (ag, G, U) => {
    G.slit = feltSlit(G, eye, EW, OPEN, 0.85, 1.04);
    G.sockets = [tornHole(G, eye, EW, OPEN, { kx: 0.6, up: 0.98, lo: 0.86, jag: 0.1 })];
    ag.fillStyle = '#0A0706'; ag.fill(path(G.sockets[0]));
    // the button eye: glossy black, cracked
    G.btnPts = []; for (let k = 0; k < 64; k++) { const a = k / 64 * TAU; G.btnPts.push([btn.u + Math.cos(a) * btn.r, btn.v + Math.sin(a) * btn.r]); }
    G.btnScr = mapPts(G.h, G.btnPts);
    ag.fillStyle = '#0E0D10'; ag.fill(path(G.btnScr));
    const [bx, by] = G.h(btn.u, btn.v), br = btn.r * G.R;
    ag.strokeStyle = 'rgba(70,68,80,0.6)'; ag.lineWidth = br * 0.08; ag.beginPath(); ag.arc(bx, by, br * 0.82, 0, TAU); ag.stroke();
    // the mouth slit (parted seam) and the pucker above it
    G.mouthScr = mapPts(G.h, lips.open);
    ag.fillStyle = '#040203'; ag.fill(path(G.mouthScr));
    // grime in the felt where the new stitches pull it
    ag.save(); ag.strokeStyle = 'rgba(80,58,20,0.5)'; ag.lineCap = 'round';
    for (const sd of [-1, 1]) for (let k = 0; k < 5; k++) { const x0 = sd * (MX0 + 0.04 + k * 0.045), a = G.h(x0, yS(x0) - 0.05), b = G.h(x0 + sd * 0.03, yS(x0) + 0.06); ag.lineWidth = 2.5; ag.beginPath(); ag.moveTo(a[0], a[1]); ag.lineTo(b[0], b[1]); ag.stroke(); }
    ag.restore();
  };
  c.height = (h, mat, G, U) => {
    const R2 = G.R;
    const m = U.maskOf(g => g.fill(path(G.sockets[0])), R2 * 0.012);
    for (let i = 0; i < h.length; i++) if (m[i]) h[i] -= m[i] * R2 * 0.06;
    U.addTo(h, U.maskOf(g => { g.lineWidth = R2 * 0.03; g.lineJoin = 'round'; g.stroke(path(G.sockets[0])); }, R2 * 0.012), R2 * 0.012);
    // button: a glossy dome (material 1)
    const bm = U.maskOf(g => g.fill(path(G.btnScr)), R2 * 0.006), bmB = U.maskOf(g => g.fill(path(G.btnScr)), R2 * 0.05);
    for (let i = 0; i < h.length; i++) if (bm[i] > 0.02) { h[i] += R2 * 0.1 * Math.pow(bmB[i], 0.5) * bm[i]; if (bm[i] > 0.5) mat[i] = 1; }
    // the seam: the felt puckers and pulls toward the stitched line
    const mp = path(G.mouthScr);
    const lip = U.maskOf(g => { g.lineWidth = R2 * 0.09; g.lineJoin = 'round'; g.stroke(path(mapPts(G.h, lips.up.map((p, i) => [p[0], (p[1] + lips.lo[i][1]) / 2])), false)); }, R2 * 0.025), mm = U.maskOf(g => g.fill(mp), 2);
    for (let i = 0; i < h.length; i++) { if (lip[i]) h[i] += lip[i] * R2 * 0.035; if (mm[i]) h[i] -= mm[i] * R2 * 0.25; }
    const bump = (u, v, rx, ry, amp) => { const [x, y] = G.h(u, v); const q = U.maskOf(g => { g.beginPath(); g.ellipse(x, y, rx * R2, ry * R2, 0, 0, TAU); g.fill(); }, R2 * Math.min(rx, ry) * 0.7); U.addTo(h, q, amp * R2); };
    bump(-0.6, 0.38, 0.24, 0.18, 0.05); bump(0.6, 0.36, 0.24, 0.18, 0.05);
  };
  twinHeadParts(c, { partX: -0.42, cheekK: 0.7, noBrows: true, noseH: 0.14, nose: { x: 0, y: 0.24, r: 0.105 }, hatchHair: false });
  c.mat5 = undefined;
  c.overlay = (cg, G, U) => {
    const R2 = G.R, litAt = litSampler(cg, G);
    // ---- a sliver of real teeth through the parted seam (upper row hanging just inside the slit)
    const line = [], lineLo = [];
    for (let i = 0; i <= 60; i++) { const x = lerp(-MX * 0.8, MX * 0.8, i / 60); line.push([x, yS(x) - half(x) * 0.9 - 0.012]); lineLo.push([x * 0.96, yS(x) + half(x) * 1.3 + 0.02]); }
    mouthPP(cg, G, {
      open: lips.open,
      rows: [
        { line: lineLo, dir: -1, n: 14, len: 0.07, crooked: 1.8, jit: 0.2, persp: 0.5, lower: true, z: R2 * 0.02, zBack: R2 * 0.06, ao: [0.75, 0.3], seed: 'mibS:lo', gum: null },
        { line, dir: 1, n: 16, len: 0.1, crooked: 1.5, jit: 0.18, persp: 0.5, z: R2 * 0.05, zBack: R2 * 0.08, ao: [1, 0.35], seed: 'mibS:up', gum: { depth: 0.035, height: 0.01, round: 0.008, pap: 0.24, arc: 0.06 } },
      ],
      shadowLip: [{ pts: lips.up, width: 0.025, blur: 5, a: 0.7 }, { pts: lips.lo, width: 0.02, blur: 5, a: 0.5 }], ivory: '#E8DFC8',
    });
    // ---- the stitches: stretched taut ACROSS the parted seam (old part) and running on past the old corners (new part)
    const thread = (a, b, w, k) => {
      const lk = litAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) * (k || 1), col = [110, 20, 34].map(v => clamp(v * lk, 0, 255) | 0);
      cg.strokeStyle = 'rgba(0,0,0,0.65)'; cg.lineWidth = w * 1.4; cg.beginPath(); cg.moveTo(a[0] + 2, a[1] + 2.5); cg.lineTo(b[0] + 2, b[1] + 2.5); cg.stroke();
      cg.strokeStyle = `rgb(${col[0]},${col[1]},${col[2]})`; cg.lineWidth = w; cg.beginPath(); cg.moveTo(a[0], a[1]); cg.lineTo(b[0], b[1]); cg.stroke();
      cg.strokeStyle = `rgba(255,170,170,${0.25 * Math.min(1, lk)})`; cg.lineWidth = w * 0.3; cg.beginPath(); cg.moveTo(a[0] - 1, a[1] - 1.5); cg.lineTo(b[0] - 1, b[1] - 1.5); cg.stroke();
    };
    const hole = (p) => { cg.fillStyle = 'rgba(6,3,2,0.9)'; cg.beginPath(); cg.ellipse(p[0], p[1], 4.5, 3.2, 0, 0, TAU); cg.fill(); };
    cg.save(); cg.lineCap = 'round';
    const r = rng('mibS:st' + boil.slice(0, 0));
    for (let x = -MX + 0.02; x <= MX - 0.02; x += 0.052) {
      const o = half(x), y = yS(x), inOld = Math.abs(x) < MX0;
      const a = G.h(x - 0.012, y - o - 0.03), b = G.h(x + 0.012, y + o + 0.035);
      hole(a); hole(b);
      thread(a, b, inOld ? 4.6 : 5.2);
    }
    // the old corner tucks (down-and-in) still there, and the pucker 'v' ABOVE the mouth
    for (const sd of [-1, 1]) { const a = G.h(sd * MX0, yS(sd * MX0) - 0.01), b = G.h(sd * (MX0 - 0.05), yS(sd * MX0) + 0.08); hole(a); hole(b); thread(a, b, 5); }
    const pv = [G.h(-0.05, mY + 0.01), G.h(0, mY + 0.06), G.h(0.05, mY + 0.01)];
    for (const p of pv) hole(p);
    thread(pv[0], pv[1], 5); thread(pv[1], pv[2], 5);
    cg.restore();
    fray(cg, mapPts(G.h, lips.up), { n: 2, len: [3, 9], side: 1, seed: 'mibS:fu', col: [214, 190, 96], alpha: [0.35, 0.85], light: litAt });
    fray(cg, mapPts(G.h, lips.lo), { n: 2, len: [3, 9], side: -1, seed: 'mibS:fl', col: [214, 190, 96], alpha: [0.35, 0.85], light: litAt });
    // ---- the real eye: white all round the iris, pinpoint pupil, dead into the lens
    // white all round the iris (lids pulled wide), pinpoint pupil, dead into the lens; human lids inside the torn felt
    eyeInSocket(cg, G, Object.assign({ socketPath: G.sockets[0], w: EW, open: OPEN, iris: 0.14, pupil: 0.075, lidSpread: 1.15, ring: 0.1, lidSkin: '#A47C68', lidPores: 0.55, lidNoise: [0.9, 2.5], irisCol: ['#8C8466', '#6C7A70', '#2A3432'], limbal: 0.13, veins: 8, veinCol: '#C49896',
      gaze: [0.03, 0], irisDy: -0.06, lowerFlat: 0.85, window: { x: 0.2, y: 0.32, s: 0.24, a: 0.97, panes: 1 }, socket: 0.55, recess: 0.03, lidShadow: 0.35, lashes: 28, lashLen: 0.13,
      gain: 1.8, shadeLo: 0.25, shadeA: -0.9, shadeB: 0.7, marginA: 0.4, rimShadow: 0.9, wetK: 1.25, waterline: 1.5 }, eye));
    fray(cg, G.sockets[0], { n: 3, len: [2, 10], side: 1, seed: 'mibS:sf', col: [214, 190, 96], alpha: [0.3, 0.8], light: litAt, every: 2 });
    // ---- the button: lamp catchlight (hard disc), a hairline crack with a 1 px highlight on one side
    const [bx, by] = G.h(btn.u, btn.v), br = btn.r * G.R;
    cg.save();
    cg.fillStyle = 'rgba(255,255,250,0.95)'; cg.beginPath(); cg.ellipse(bx + br * 0.28, by + br * 0.38, br * 0.12, br * 0.09, 0.4, 0, TAU); cg.fill();
    cg.fillStyle = 'rgba(255,255,255,0.35)'; cg.beginPath(); cg.ellipse(bx - br * 0.35, by - br * 0.42, br * 0.1, br * 0.06, -0.5, 0, TAU); cg.fill();
    const crack = [[-0.86, -0.32], [-0.45, -0.12], [-0.18, 0.02], [0.05, -0.04], [0.32, 0.18], [0.55, 0.52], [0.7, 0.66]].map(([x, y]) => [bx + x * br, by + y * br]);
    cg.lineCap = 'round'; cg.lineJoin = 'round';
    cg.strokeStyle = 'rgba(0,0,0,1)'; cg.lineWidth = 3.4; cg.stroke(path(crack, false));
    cg.translate(-1.6, -2); cg.strokeStyle = 'rgba(230,226,240,0.8)'; cg.lineWidth = 1.5; cg.stroke(path(crack, false));
    cg.restore();
    G.sharp.push(path(G.btnScr));
  };
  c.background = (cg, G) => {
    const W = G.W, H = G.H, sp = cg.createRadialGradient(560 * SS, 640 * SS, 30 * SS, 520 * SS, 560 * SS, 760 * SS);
    sp.addColorStop(0, 'rgb(26,25,23)'); sp.addColorStop(0.3, 'rgb(12,12,11)'); sp.addColorStop(0.6, 'rgb(5,5,5)'); sp.addColorStop(1, 'rgb(1,1,1)');
    cg.fillStyle = sp; cg.fillRect(0, 0, W, H);
  };
  c.grade = (cg, G) => capRed(cg, G.W, G.H, 0.8);
  c.post = (cg, G) => {
    fisheye(cg.canvas, 0.24, 0.5, 0.52);
    // close-focus: the lens can only hold the middle of the face sharp; the rim of the head goes soft
    const W = G.W, H = G.H, b = mk(W, H), bg = b.getContext('2d'); bg.filter = `blur(${3.2 * SS}px)`; bg.drawImage(cg.canvas, 0, 0);
    const m = mk(W, H), mg = m.getContext('2d'), gr = mg.createRadialGradient(W * 0.5, H * 0.52, H * 0.32, W * 0.5, H * 0.52, H * 0.78);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); mg.fillStyle = gr; mg.fillRect(0, 0, W, H);
    bg.filter = 'none'; bg.globalCompositeOperation = 'destination-in'; bg.drawImage(m, 0, 0);
    cg.drawImage(b, 0, 0);
  };
  c.contourExtra = (cg, G, b, fadeLit) => {
    HZ.tremor(cg, G.sockets[0], { lw: SS, seed: 'mibS:cts:' + b, closed: true, passes: 2, w: [0.5, 1.2], alpha: 0.55, fade: fadeLit([0, -8]) });
    HZ.tremor(cg, G.btnScr, { lw: SS, seed: 'mibS:ctb:' + b, closed: true, passes: 2, w: [0.5, 1.3], alpha: 0.6, fade: fadeLit([0, -8]) });
  };
  return buildFace(c);
}

/* ============================================================ GOUACHE
 * gouache(cg, G, o): repaint the lit picture with opaque, matte, oriented brush
 * strokes (coarse to fine, Hertzmann-style), stroke direction along the
 * isophotes, a dry-brush bristle texture in each stroke. Pixels inside the
 * sharp paths (the realism patches: eyes, teeth) are left untouched.
 * o: sizes [device px], seed, mask(x, y) -> 0..1 where painting is allowed, jitter */
function gouache(cg, G, o) {
  o = Object.assign({ sizes: [26, 15, 8], seed: 'gouache', jit: 10, alpha: 0.92, err: [0, 0.035, 0.05] }, o);
  const W = G.W, H = G.H, src = cg.getImageData(0, 0, W, H), sd = src.data;
  const lum = HZ.lumaOf(src), bl = new Float32Array(lum); HZ.fblur(bl, W, H, 3);
  const sharpM = G.sharp.length ? maskOf(W, H, g => { for (const p of G.sharp) g.fill(p); }, 3) : null;
  const keep = mk(W, H); keep.getContext('2d').putImageData(src, 0, 0);
  const r = rng(o.seed + ':g');
  const at = (x, y) => { const xi = clamp(x | 0, 0, W - 1), yi = clamp(y | 0, 0, H - 1); return yi * W + xi; };
  cg.save(); cg.lineCap = 'round'; cg.lineJoin = 'round';
  o.sizes.forEach((sz, li) => {
    const step = sz * 0.72;
    // local blurred reference for this layer: error test (only refine where the coarse layer is off)
    const cur = li ? cg.getImageData(0, 0, W, H).data : null;
    for (let gy = 0; gy < H; gy += step) for (let gx = 0; gx < W; gx += step) {
      const x = gx + (r() - 0.5) * step, y = gy + (r() - 0.5) * step, i = at(x, y);
      if (sharpM && sharpM[i] > 0.05) continue;
      if (o.mask && o.mask(x, y) <= r() * 0.999) continue;
      if (li) {      // refine only where detail differs from what is painted
        const e = Math.abs(cur[i * 4] - sd[i * 4]) + Math.abs(cur[i * 4 + 1] - sd[i * 4 + 1]) + Math.abs(cur[i * 4 + 2] - sd[i * 4 + 2]);
        if (e / 765 < o.err[li]) continue;
      }
      let R0 = sd[i * 4], G0 = sd[i * 4 + 1], B0 = sd[i * 4 + 2];
      if (o.poster) {     // flat gouache value steps: lights warmer, shadows cooler
        const L = (0.2126 * R0 + 0.7152 * G0 + 0.0722 * B0) / 255, n = o.poster;
        if (L > 0.07) {
          const q = Math.max(0.07, Math.round(L * n + (r() - 0.5) * 0.35) / n), f = q / L, warm = (q - 0.4) * 14 * Math.min(1, L * 3);
          R0 = clamp(R0 * f + warm, 0, 255); G0 = clamp(G0 * f, 0, 255); B0 = clamp(B0 * f - warm, 0, 255);
        }
      }
      if (R0 + G0 + B0 < 6 && r() < 0.85) continue;          // black stays black (no strokes needed)
      const gxv = bl[at(x + 2, y)] - bl[at(x - 2, y)], gyv = bl[at(x, y + 2)] - bl[at(x, y - 2)];
      let ang = Math.atan2(gyv, gxv) + Math.PI / 2 + (r() - 0.5) * 0.5;
      if (Math.hypot(gxv, gyv) < 0.004) ang = (o.flow ? o.flow(x, y) : -0.6) + (r() - 0.5) * 0.9;
      const L = sz * (1.4 + r() * 1.4), w = sz * (0.55 + r() * 0.3);
      const k = 1 + (r() - 0.5) * 0.08, tint = (r() - 0.5) * 7;
      const cr = clamp(R0 * k + tint, 0, 255) | 0, cgc = clamp(G0 * k, 0, 255) | 0, cb = clamp(B0 * k - tint, 0, 255) | 0;
      const ca = Math.cos(ang), sa = Math.sin(ang), bend = (r() - 0.5) * w * 0.8;
      const x0 = x - ca * L / 2, y0 = y - sa * L / 2, x1 = x + ca * L / 2, y1 = y + sa * L / 2, mx = x - sa * bend, my = y + ca * bend;
      cg.globalAlpha = o.alpha;
      cg.strokeStyle = `rgb(${cr},${cgc},${cb})`; cg.lineWidth = w;
      cg.beginPath(); cg.moveTo(x0, y0); cg.quadraticCurveTo(mx, my, x1, y1); cg.stroke();
      // dry-brush bristles: a few thin lighter/darker streaks along the stroke, a ridge of paint at its end
      cg.lineWidth = Math.max(1, w * 0.12);
      for (let q = 0; q < 3; q++) {
        const off = (r() - 0.5) * w * 0.8, d = r() < 0.5 ? 1.12 : 0.86;
        cg.globalAlpha = 0.35; cg.strokeStyle = `rgb(${clamp(cr * d, 0, 255) | 0},${clamp(cgc * d, 0, 255) | 0},${clamp(cb * d, 0, 255) | 0})`;
        cg.beginPath(); cg.moveTo(x0 - sa * off + ca * L * 0.1, y0 + ca * off + sa * L * 0.1); cg.quadraticCurveTo(mx - sa * off, my + ca * off, x1 - sa * off - ca * L * 0.15, y1 + ca * off - sa * L * 0.15); cg.stroke();
      }
    }
  });
  cg.restore();
  // the realism patches stay photographic: put them back exactly
  if (G.sharp.length) { cg.save(); const cp = new Path2D(); for (const p of G.sharp) cp.addPath(p); cg.clip(cp); cg.drawImage(keep, 0, 0); cg.restore(); }
}
/* paper / board texture of the painting (gouache sits matte on a toothy board) */
function boardTexture(cg, W, H, seed, k) {
  const tex = FELT.feltTexture(W, H, seed, 1.4);
  cg.save(); cg.globalCompositeOperation = 'overlay'; cg.globalAlpha = k; cg.drawImage(tex, 0, 0); cg.restore();
}

/* ======================================================= MR. TURNABOUT
 * The little gouache portrait of a rosy, bald, white-whiskered grandfather in a
 * blue bow tie. Painted as a THATCHER face: his eyes and mouth are painted the
 * right way up for a viewer of the portrait hanging UPSIDE DOWN, so the
 * upright painting has them inverted.
 *  mode 'scare'  : right way up, close, underlit 45 degrees from below; the eyes
 *                  are real wet eyes turned over in human lids, the inverted smile
 *                  is a down-turned open grimace of real ivory teeth standing on
 *                  wet gums BELOW them. Gouache texture everywhere else.
 *  mode 'painted': the jolly painting itself, flat portrait light, painted
 *                  button-bright eyes (no realism), for turnabout_upside. */
function turnabout(o) {
  o = Object.assign({ mode: 'scare', boil: 'A', W: 800, H: 600 }, o);
  const scare = o.mode === 'scare';
  const sc = o.W / 800;
  const R = (scare ? 152 : 150) * sc;
  // head-local outline: bald dome, temples, full cheeks, jowls, chin
  const outline = []; for (let i = 0; i < 96; i++) { const a = i / 96 * TAU, cs = Math.cos(a), sn = Math.sin(a); const top = sn < 0; const rx = top ? 1.0 - 0.06 * Math.pow(-sn, 3) : 1.0 + 0.04 * sn - 0.2 * Math.pow(sn, 6); const ry = top ? 1.28 : 1.18; outline.push([cs * rx, sn * ry]); }
  const EYE = [{ u: -0.42, v: -0.08 - (o.mode === 'scare' ? 0.035 : 0), side: 1, flip: true, seed: 'tb:eL' }, { u: 0.42, v: -0.08, side: -1, flip: true, seed: 'tb:eR' }];   // scare: one eye 3.5% higher
  const EW = 0.5, OPEN = 1.18;
  const MX = o.mode === 'scare' ? 0.56 : 0.5, mY = 0.68;
  // the jolly painted smile (corners up) turned over: corners DOWN, the opening arched
  const yB = (x) => { const t = clamp(x / MX, -1, 1); return mY + (scare ? 0.12 : 0.17) * t * t + 0.006 * Math.sin(x * 17); };
  const yT = (x) => { const t = clamp(x / MX, -1, 1); return yB(x) - (scare ? 0.27 : 0.15) * Math.pow(Math.max(0, 1 - t * t), 0.7) - 0.006; };
  const lips = lipOpening(-MX, MX, yT, yB, 90, 0.006, 'tbL');
  const skin = scare ? '#D8987E' : '#E4A684', skinLo = '#B06A58', rosy = '#D8645A', white = '#F2EEE6';
  const c = {
    W: o.W, H: o.H, cx: o.W / 2, cy: (scare ? 290 : 300) * sc, R, sx: 1, sy: scare ? 1.08 : 1, tilt: 0, eyeTilt: 0, seed: 'turnabout1', boil: o.boil,
    petals: false, nose: false, outline, faceCol: skin, pills: 0, crumple: 0, fuzzH: 0.5, dome: 0.5, cavity: 0.02,
    feltMat: { fuzz: 0, wrap: 0.32, sss: [1, 0.78, 0.68], spec: 0.02, pow: 8 },
    lights: scare ? (G) => ({
      light: { x: G.cx - 40 * SS * sc, y: (G.cy + 300 * SS * sc), z: 260 * SS * sc, col: [1.26, 1.04, 0.94], power: 2.15, d0: 250 * SS * sc, hard: 0.8, cut: 0.15, cutSoft: 0.08 },
      fill: { x: G.cx + 260 * SS * sc, y: -100 * SS * sc, z: 700 * SS * sc, col: [0.62, 0.62, 0.72], power: 0.16, d0: 1200 * SS * sc },
      ambient: [0.006, 0.005, 0.005],
    }) : (G) => ({
      // painted portrait light: soft, high and frontal (a studio portrait painter's north window), no long cast shadows
      light: { x: G.cx - 300 * SS * sc, y: G.cy - 380 * SS * sc, z: 1500 * SS * sc, col: [1.1, 1.04, 0.96], power: 1.45, d0: 2200 * SS * sc, cut: 0.0 },
      fill: { x: G.cx + 500 * SS * sc, y: G.cy + 200 * SS * sc, z: 1200 * SS * sc, col: [0.55, 0.52, 0.58], power: 0.45, d0: 2200 * SS * sc },
      ambient: [0.16, 0.14, 0.13],
    }),
    lost: scare ? [{ ang: 15, a: 0.3, b: 1.15, k: 0.92 }, { ang: -90, a: 0.55, b: 1.25, k: 0.85 }] : null,
    shadow: scare ? { soft: 4, bias: 1.5 } : { soft: 3, bias: 1.5 },
    tone: scare ? { exp: 1.55, shoulder: 1.6, gamma: 1.16 } : { exp: 1.12, shoulder: 1.2, gamma: 1.0 },
    hatch: scare ? { n: 680, len: [20, 54], w: 1.3, alpha: [0.45, 0.85], cluster: [4, 8], gap: 4.5, lite: 0, band: [0.02, 0.1, 0.4] } : false,
    contour: scare ? { passes: 3 } : false, grain: scare ? 6 : 4,
  };
  if (!scare) { c.hatch = false; c.contour = false; }
  c.faceFill = (ag, G, U) => {
    // flesh painted in warm patches: ruddy cheeks and nose, paler dome, sallow temples
    const fg = ag.createRadialGradient(...G.h(-0.15, -0.3), R * 0.1 * SS, G.cx, G.cy, R * 1.3 * SS);
    fg.addColorStop(0, HZ.mixc(skin, '#FFF0E0', 0.25)); fg.addColorStop(0.6, skin); fg.addColorStop(1, skinLo);
    ag.fillStyle = fg; ag.fill(G.facePath);
    ag.save(); ag.clip(G.facePath);
    for (const [u, v, rr, col, a] of [[-0.55, 0.3, 0.32, rosy, scare ? 0.55 : 0.72], [0.55, 0.3, 0.32, rosy, scare ? 0.55 : 0.72], [0, 0.18, 0.2, rosy, 0.6], [0, -0.95, 0.5, '#F0C8A8', 0.35]]) {
      const [x, y] = G.h(u, v), gr = ag.createRadialGradient(x, y, 0, x, y, rr * R * SS); gr.addColorStop(0, HZ.rgba(col, a)); gr.addColorStop(1, HZ.rgba(col, 0));
      ag.fillStyle = gr; ag.fillRect(0, 0, G.W, G.H);
    }
    // liver spots on the dome, faint
    const r = rng('tb:spots'); for (let k = 0; k < 9; k++) { const [x, y] = G.h((r() - 0.5) * 1.2, -0.7 - r() * 0.45); ag.fillStyle = `rgba(150,96,70,${0.2 + r() * 0.15})`; ag.beginPath(); ag.ellipse(x, y, (4 + r() * 8) * sc, (3 + r() * 6) * sc, r() * 3, 0, TAU); ag.fill(); }
    // forehead wrinkles and crow's feet (painted lines)
    ag.strokeStyle = 'rgba(140,80,60,0.45)'; ag.lineWidth = 2.6 * sc; ag.lineCap = 'round';
    for (let k = 0; k < 3; k++) { const p = []; for (let q = 0; q <= 20; q++) { const u = lerp(-0.55, 0.55, q / 20); p.push(G.h(u, -0.62 - k * 0.11 + 0.05 * u * u + 0.01 * Math.sin(q * 1.3 + k))); } ag.stroke(path(p, false)); }
    ag.restore();
    // whiskers (white mutton chops), brows (white, bushy), ears
    G.chops = [-1, 1].map(sd => { const pts = []; const ctl = [[0.92, -0.36], [1.12, -0.06], [1.18, 0.32], [1.06, 0.7], [0.82, 0.92], [0.6, 0.86], [0.62, 0.62], [0.74, 0.3], [0.8, -0.05], [0.84, -0.34]]; const rj = rng('tb:chop' + sd); splineClosed(ctl, 10).forEach(([u, v], i) => { const k = 1 + (i % 2 ? 0.045 : -0.02) * (0.6 + rj()); pts.push([sd * (0.88 + (u - 0.88) * k * 1.06), 0.25 + (v - 0.25) * k]); }); return mapPts(G.h, pts); });
    G.ears = [-1, 1].map(sd => { const pts = []; for (let k = 0; k < 40; k++) { const a = k / 40 * TAU; pts.push([sd * 1.02 + Math.cos(a) * 0.14, -0.08 + Math.sin(a) * 0.24]); } return mapPts(G.h, pts); });
    for (const e of G.ears) { ag.fillStyle = HZ.mixc(skin, rosy, 0.3); ag.fill(path(e)); }
    for (const ch of G.chops) {
      ag.save(); ag.filter = `blur(${10 * sc}px)`; ag.fillStyle = scare ? HZ.mixc(white, '#B8B0A4', 0.25) : HZ.mixc(white, '#D8D0C4', 0.15); ag.fill(path(ch)); ag.restore();
      ag.save(); ag.clip(path(ch)); const rr = rng('tb:hair' + ch[0][0]); ag.lineCap = 'round';
      for (let k = 0; k < 420; k++) { const x = lerp(G.cx - R * 1.25 * SS, G.cx + R * 1.25 * SS, rr()), y = lerp(G.cy - R * 0.6 * SS, G.cy + R * 1.0 * SS, rr()); ag.strokeStyle = rr() < 0.5 ? 'rgba(255,255,255,0.65)' : 'rgba(140,130,120,0.55)'; ag.lineWidth = (1.2 + rr() * 2.4) * sc; ag.beginPath(); ag.moveTo(x, y); ag.quadraticCurveTo(x + (rr() - 0.5) * 16 * sc, y + 16 * sc, x + (rr() - 0.5) * 22 * sc, y + 34 * sc); ag.stroke(); }
      ag.restore();
      // loose white hairs breaking the outline
      const rr2 = rng('tb:hair2' + ch[0][0]); ag.lineCap = 'round';
      for (let k = 0; k < 260; k++) { const p0 = ch[(rr2() * ch.length) | 0]; ag.strokeStyle = rr2() < 0.6 ? 'rgba(250,248,240,0.7)' : 'rgba(170,160,150,0.6)'; ag.lineWidth = (1 + rr2() * 1.8) * sc; ag.beginPath(); ag.moveTo(p0[0], p0[1]); ag.quadraticCurveTo(p0[0] + (rr2() - 0.5) * 20 * sc, p0[1] + 10 * sc, p0[0] + (rr2() - 0.5) * 30 * sc, p0[1] + (8 + rr2() * 22) * sc); ag.stroke(); }
    }
    G.browsP = [-1, 1].map(sd => { const pts = []; for (let k = 0; k < 30; k++) { const a = k / 30 * TAU; pts.push([sd * 0.4 + Math.cos(a) * 0.24, -0.37 + Math.sin(a) * 0.075 - 0.04 * Math.cos(a) * Math.cos(a) + 0.03 * Math.cos(a) * sd]); } return mapPts(G.h, pts); });
    for (const b of G.browsP) { ag.fillStyle = '#E8E2D8'; ag.fill(path(b)); ag.save(); ag.clip(path(b)); const rb = rng('tb:brow' + b[0][0]); ag.lineCap = 'round'; for (let k = 0; k < 90; k++) { const p0 = b[(rb() * b.length) | 0]; ag.strokeStyle = rb() < 0.5 ? 'rgba(255,255,255,0.8)' : 'rgba(120,110,100,0.6)'; ag.lineWidth = 1.5 * sc; ag.beginPath(); ag.moveTo(p0[0], p0[1]); ag.lineTo(p0[0] + (rb() - 0.3) * 30 * sc, p0[1] - rb() * 14 * sc); ag.stroke(); } ag.restore(); }
    // the big rosy nose
    G.nosePts = []; for (let k = 0; k < 48; k++) { const a = k / 48 * TAU; G.nosePts.push([Math.cos(a) * 0.17, 0.25 + Math.sin(a) * 0.13]); }
    const [nx, ny] = G.h(0, 0.24), ng = ag.createRadialGradient(nx, ny - 6 * sc, 2, nx, ny, 0.2 * R * SS); ng.addColorStop(0, '#F08A78'); ng.addColorStop(1, HZ.rgba(rosy, 0));
    ag.fillStyle = ng; ag.fill(path(mapPts(G.h, G.nosePts)));
  };
  c.albedo = (ag, G, U) => {
    if (scare) {
      G.slits = EYE.map(e => feltSlit(G, e, EW, OPEN, 0.6, 1.0));
      G.sockets = G.slits.map(sl => sl.pts);
    } else G.sockets = [];
    G.mouthScr = mapPts(G.h, lips.open);
    if (scare) { ag.fillStyle = '#050203'; ag.fill(path(G.mouthScr)); }
    // painted lips around the opening (dusky rose, never bright red)
    ag.save(); ag.lineJoin = 'round'; ag.strokeStyle = '#A85A50'; ag.lineWidth = (scare ? 14 : 12) * sc; ag.stroke(path(G.mouthScr)); ag.restore();
    if (!scare) {
      // the painted features of the jolly portrait, inverted on the upright board:
      // twinkling eyes (dark iris, white highlight, smile-creased lids) and a merry painted smile, all upside down
      ag.fillStyle = '#4A1E1C'; ag.fill(path(G.mouthScr));
      ag.save(); ag.clip(path(G.mouthScr)); ag.fillStyle = '#F4EEE0';
      const tl = []; for (let i = 0; i <= 20; i++) { const x = lerp(-MX * 0.8, MX * 0.8, i / 20); tl.push(G.h(x, yB(x) - 0.01)); } for (let i = 20; i >= 0; i--) { const x = lerp(-MX * 0.8, MX * 0.8, i / 20); tl.push(G.h(x, yB(x) - 0.06)); }
      ag.fill(path(tl)); ag.restore();
      for (const e of EYE) {
        const [x, y] = G.h(e.u, e.v), w = EW * R * SS * 1.18;
        ag.save(); ag.translate(x, y); ag.rotate(Math.PI);          // painted the right way up for the viewer of the hung portrait
        const out = e.u < 0 ? 1 : -1;                                  // the outer corner (local x sign) once turned over
        // a jolly crescent eye: the upper lid arched, the lower lid pushed up by the smiling cheek
        const ap = new Path2D(); ap.moveTo(-w * 0.47, w * 0.03); ap.bezierCurveTo(-w * 0.32, -w * 0.25, w * 0.32, -w * 0.25, w * 0.47, w * 0.03);
        ap.bezierCurveTo(w * 0.25, -w * 0.05, -w * 0.25, -w * 0.05, -w * 0.47, w * 0.03); ap.closePath();
        ag.save(); ag.clip(ap);
        ag.fillStyle = '#F6F0E4'; ag.fillRect(-w, -w, w * 2, w * 2);
        ag.fillStyle = '#3A6488'; ag.beginPath(); ag.arc(0, -w * 0.07, w * 0.15, 0, TAU); ag.fill();
        ag.fillStyle = '#20384E'; ag.beginPath(); ag.arc(0, -w * 0.07, w * 0.15, 0, TAU); ag.lineWidth = w * 0.03; ag.strokeStyle = '#1A2A3A'; ag.stroke();
        ag.fillStyle = '#0E0E10'; ag.beginPath(); ag.arc(0, -w * 0.07, w * 0.065, 0, TAU); ag.fill();
        ag.fillStyle = 'rgba(80,40,30,0.35)'; ag.fillRect(-w, -w * 0.3, w * 2, w * 0.08);     // the lid's shadow on the eyeball
        ag.restore();
        // twinkles
        ag.fillStyle = '#FFFFFF'; ag.beginPath(); ag.arc(-w * 0.05, -w * 0.12, w * 0.05, 0, TAU); ag.fill();
        ag.beginPath(); ag.arc(w * 0.06, -w * 0.02, w * 0.022, 0, TAU); ag.fill();
        // upper lid line and a few short lashes, the lower lid line, the smile crease under it
        ag.strokeStyle = '#5A2A20'; ag.lineCap = 'round'; ag.lineWidth = w * 0.065;
        ag.beginPath(); ag.moveTo(-w * 0.49, w * 0.04); ag.bezierCurveTo(-w * 0.32, -w * 0.26, w * 0.32, -w * 0.26, w * 0.49, w * 0.04); ag.stroke();
        ag.lineWidth = w * 0.025;
        for (let k = 0; k < 5; k++) { const t = 0.2 + k * 0.15, lx = lerp(-w * 0.42, w * 0.42, t), ly = -w * 0.19 * Math.sin(Math.PI * t) - w * 0.02; ag.beginPath(); ag.moveTo(lx, ly); ag.lineTo(lx + out * w * 0.03 + (t - 0.5) * w * 0.08, ly - w * 0.07); ag.stroke(); }
        ag.strokeStyle = 'rgba(140,60,50,0.8)'; ag.lineWidth = w * 0.03;
        ag.beginPath(); ag.moveTo(-w * 0.42, w * 0.02); ag.bezierCurveTo(-w * 0.2, -w * 0.05, w * 0.2, -w * 0.05, w * 0.42, w * 0.02); ag.stroke();
        ag.strokeStyle = 'rgba(150,70,56,0.6)'; ag.lineWidth = w * 0.035;
        ag.beginPath(); ag.moveTo(-w * 0.36, w * 0.13); ag.quadraticCurveTo(0, w * 0.04, w * 0.36, w * 0.13); ag.stroke();
        // crow's feet at the outer corner
        ag.strokeStyle = 'rgba(130,60,48,0.7)'; ag.lineWidth = w * 0.028;
        for (const [a, L] of [[-0.45, 0.17], [0.0, 0.2], [0.42, 0.16]]) { ag.beginPath(); ag.moveTo(out * w * 0.53, w * 0.0); ag.quadraticCurveTo(out * w * (0.53 + L * 0.6), Math.sin(a) * w * L * 0.4, out * w * (0.53 + L), Math.sin(a) * w * L * 0.85); ag.stroke(); }
        ag.restore();
      }
    } else {
      for (const sk of G.sockets) { ag.fillStyle = '#0A0605'; ag.fill(path(sk)); }
      // the upper-lid crease and the lid's fold, turned over: a dark painted arc UNDER each eye
      ag.save(); ag.lineCap = 'round';
      for (const sl of G.slits) {
        const cr = sl.S.up.map(([x, y], i) => { const u = i / (sl.S.up.length - 1); const p = sl.TU.transformPoint(new DOMPoint(x * 1.08, y - sl.S.h * (0.42 + 0.35 * Math.sin(Math.PI * u)))); return [p.x, p.y]; });
        ag.strokeStyle = 'rgba(96,44,34,0.75)'; ag.lineWidth = 5 * sc; ag.stroke(path(cr.slice(4, -3), false));
        ag.strokeStyle = 'rgba(150,80,64,0.5)'; ag.lineWidth = 12 * sc; ag.globalAlpha = 0.5; ag.stroke(path(cr.slice(6, -5).map(([x, y]) => [x, y - 9 * sc]), false)); ag.globalAlpha = 1;
      }
      ag.restore();
    }
  };
  c.height = (h, mat, G, U) => {
    const R2 = G.R;
    const bump = (u, v, rx, ry, amp, rot) => { const [x, y] = G.h(u, v); const q = U.maskOf(g => { g.beginPath(); g.ellipse(x, y, rx * R2, ry * R2, (rot || 0) * DEG, 0, TAU); g.fill(); }, R2 * Math.min(rx, ry) * 0.75); U.addTo(h, q, amp * R2); };
    bump(-0.38, -0.36, 0.3, 0.1, 0.07); bump(0.38, -0.36, 0.3, 0.1, 0.07);        // brow ridge
    bump(-0.56, 0.24, 0.3, 0.24, 0.1); bump(0.56, 0.24, 0.3, 0.24, 0.1);          // cheeks (apples)
    bump(0, 0.98, 0.34, 0.2, 0.08); bump(-0.6, 0.78, 0.22, 0.2, 0.05); bump(0.6, 0.78, 0.22, 0.2, 0.05);   // chin, jowls
    bump(0, 0.02, 0.08, 0.24, 0.12);                                                // nose bridge
    const nm = U.maskOf(g => g.fill(path(mapPts(G.h, G.nosePts))), R2 * 0.05); U.addTo(h, nm, R2 * (scare ? 0.24 : 0.13));
    for (const sd of [-1, 1]) {   // eye sockets
      const [x, y] = G.h(sd * 0.38, -0.1); const q = U.maskOf(g => { g.beginPath(); g.ellipse(x, y, 0.27 * R2, 0.16 * R2, 0, 0, TAU); g.fill(); }, R2 * 0.08); U.addTo(h, q, -R2 * 0.07);
      const nl = []; for (let k = 0; k <= 12; k++) { const t = k / 12; nl.push(G.h(sd * (0.2 + 0.26 * t), 0.36 + 0.34 * t)); }   // nasolabial folds
      U.addTo(h, U.maskOf(g => { g.lineWidth = R2 * 0.05; g.lineCap = 'round'; g.stroke(path(nl, false)); }, R2 * 0.03), -R2 * 0.03);
    }
    U.addTo(h, U.maskOf(g => { for (const ch of G.chops) g.fill(path(ch)); }, R2 * 0.1), R2 * 0.1);
    U.addTo(h, U.maskOf(g => { for (const b of G.browsP) g.fill(path(b)); }, R2 * 0.02), R2 * 0.05);
    U.addTo(h, U.maskOf(g => { for (const e of G.ears) g.fill(path(e)); }, R2 * 0.04), R2 * 0.1);
    for (const sk of (G.sockets || [])) { const q = U.maskOf(g => g.fill(path(sk)), R2 * 0.015); for (let i = 0; i < h.length; i++) if (q[i]) h[i] -= q[i] * R2 * 0.04; }
    const mp = path(G.mouthScr), lip = U.maskOf(g => { g.lineWidth = R2 * 0.1; g.lineJoin = 'round'; g.stroke(mp); }, R2 * 0.025), m = U.maskOf(g => g.fill(mp), 2);
    for (let i = 0; i < h.length; i++) { if (lip[i]) h[i] += lip[i] * R2 * 0.04; if (scare && m[i]) h[i] -= m[i] * R2 * 0.3; }
  };
  c.hatchExtra = (g, G) => { for (const ch of G.chops) g.fill(path(ch)); };
  // the painting around the head: dark varnished background, the coat, a white collar and the blue bow tie
  c.background = (cg, G) => {
    const W = G.W, H = G.H;
    if (scare) {     // dark varnish, reached only by the light from below
      const bg = cg.createRadialGradient(G.cx - 40 * SS, H + 60 * SS, 60 * SS, G.cx, H, 640 * SS);
      bg.addColorStop(0, '#2C2414'); bg.addColorStop(0.3, '#120E07'); bg.addColorStop(0.6, '#040302'); bg.addColorStop(1, '#010101');
      cg.fillStyle = bg; cg.fillRect(0, 0, W, H);
    } else {
      const bg = cg.createRadialGradient(G.cx - 60 * SS * sc, G.cy - 80 * SS * sc, 40 * SS * sc, G.cx, G.cy, 520 * SS * sc);
      bg.addColorStop(0, '#7A6E48'); bg.addColorStop(0.6, '#4A4228'); bg.addColorStop(1, '#2A2416');
      cg.fillStyle = bg; cg.fillRect(0, 0, W, H);
    }
  };
  c.foreground = (cg, G, U) => {
    const sc2 = SS * sc, cx = G.cx, chinY = G.h(0, 1.1)[1];
    // coat shoulders, collar, bow tie (painted, lit by the same light: simple gradients)
    const lit = scare ? (y) => clamp(1.15 - (G.H - y) / G.H * 1.2, 0.05, 1) : (y) => 1;
    cg.save();
    const coat = new Path2D(); coat.moveTo(cx - 330 * sc2, G.H); coat.bezierCurveTo(cx - 300 * sc2, chinY + 40 * sc2, cx - 150 * sc2, chinY + 10 * sc2, cx - 60 * sc2, chinY + 4 * sc2); coat.lineTo(cx + 60 * sc2, chinY + 4 * sc2); coat.bezierCurveTo(cx + 150 * sc2, chinY + 10 * sc2, cx + 300 * sc2, chinY + 40 * sc2, cx + 330 * sc2, G.H); coat.closePath();
    const cgd = cg.createLinearGradient(0, chinY, 0, G.H); cgd.addColorStop(0, scare ? '#030304' : '#2E3640'); cgd.addColorStop(1, scare ? '#17181B' : '#1E242A'); cg.fillStyle = cgd; cg.fill(coat);
    const col = new Path2D(); col.moveTo(cx - 70 * sc2, chinY - 6 * sc2); col.lineTo(cx, chinY + 70 * sc2); col.lineTo(cx + 70 * sc2, chinY - 6 * sc2); col.lineTo(cx + 40 * sc2, chinY + 20 * sc2); col.lineTo(cx, chinY + 34 * sc2); col.lineTo(cx - 40 * sc2, chinY + 20 * sc2); col.closePath();
    if (scare) { const clg = cg.createLinearGradient(0, chinY - 6 * sc2, 0, chinY + 70 * sc2); clg.addColorStop(0, '#141310'); clg.addColorStop(1, '#8A8478'); cg.fillStyle = clg; } else cg.fillStyle = '#EEE8DC'; cg.fill(col);
    const tie = new Path2D(), ty = chinY + 22 * sc2;
    tie.moveTo(cx, ty); tie.bezierCurveTo(cx - 30 * sc2, ty - 26 * sc2, cx - 62 * sc2, ty - 22 * sc2, cx - 66 * sc2, ty); tie.bezierCurveTo(cx - 62 * sc2, ty + 22 * sc2, cx - 30 * sc2, ty + 26 * sc2, cx, ty);
    tie.bezierCurveTo(cx + 30 * sc2, ty - 26 * sc2, cx + 62 * sc2, ty - 22 * sc2, cx + 66 * sc2, ty); tie.bezierCurveTo(cx + 62 * sc2, ty + 22 * sc2, cx + 30 * sc2, ty + 26 * sc2, cx, ty); tie.closePath();
    const tg = cg.createLinearGradient(0, ty - 26 * sc2, 0, ty + 26 * sc2); tg.addColorStop(0, scare ? '#03050C' : '#3A5AB0'); tg.addColorStop(1, scare ? '#1C2E5C' : '#1E3270'); cg.fillStyle = tg; cg.fill(tie);
    cg.fillStyle = scare ? '#0C1834' : '#2A4690'; cg.beginPath(); cg.ellipse(cx, ty, 13 * sc2, 16 * sc2, 0, 0, TAU); cg.fill();
    cg.strokeStyle = 'rgba(255,255,255,0.35)'; cg.lineWidth = 2 * sc2; cg.beginPath(); cg.moveTo(cx - 54 * sc2, ty - 8 * sc2); cg.quadraticCurveTo(cx - 30 * sc2, ty - 16 * sc2, cx - 14 * sc2, ty - 6 * sc2); cg.stroke();
    cg.restore();
    if (scare) {
      // ---- the realism: wet eyes turned over in human lids, the grimace of real teeth on gums below them
      const R2 = G.R, litAt = litSampler(cg, G);
      const gumL = [], backL = [];
      for (let i = 0; i <= 60; i++) { const x = lerp(-MX * 0.86, MX * 0.86, i / 60); gumL.push([x, yB(x) - 0.06]); backL.push([x * 0.9, yT(x) + 0.05]); }
      const frontVis = (X, Y) => { const [u, v] = G.toHead(X, Y); return 0.45 + 0.55 * sstep(0.0, 0.09, yB(u) - v - 0.02); };
      const backVis = (X, Y) => { const [u, v] = G.toHead(X, Y); return 0.12 + 0.3 * sstep(0.02, 0.1, v - yT(u)); };
      mouthPP(cg, G, {
        open: lips.open,
        rows: [
          { line: backL, dir: 1, n: 10, len: 0.085, crooked: 1.8, jit: 0.2, persp: 0.45, lower: true, z: R2 * 0.02, zBack: R2 * 0.1, ao: [0.7, 0.25], seed: 'tb:lo', vis: backVis, back: true,
            gum: { depth: 0.05, height: 0.012, round: 0.01, pap: 0.22, arc: 0.06, col: ['#2A1014', '#6A3438', '#8A5052'], vis: (X, Y) => 0.25 } },
          { line: gumL, dir: -1, n: 12, len: 0.15, crooked: 1.7, jit: 0.2, persp: 0.42, z: R2 * 0.07, zBack: R2 * 0.12, ao: [1, 0.3], seed: 'tb:up', vis: frontVis,
            gum: { depth: 0.08, height: 0.018, round: 0.012, pap: 0.28, arc: 0.07, col: ['#5E2A32', '#B56E74', '#C98C8C'] } },
        ],
        shadowLip: [{ pts: lips.up, width: 0.05, blur: 8, a: 0.85 }, { pts: lips.lo, width: 0.035, blur: 6, a: 0.55 }], ivory: '#E8DFC8',
      });
      EYE.forEach((e, k) => {
        eyeInSocket(cg, G, Object.assign({ socketPath: null, w: EW, open: OPEN, iris: 0.18, pupil: 0.08, lidSpread: 1.3, irisCol: ['#9A9A86', '#6E8494', '#2A3646'], limbal: 0.13, veins: 7, veinCol: '#C49896',
          gaze: [0, 0], irisDy: 0.13, lowerFlat: 0.7, window: { x: 0, y: -0.32, s: 0.24, a: 0.95, panes: 1 }, ring: 0.22, lidSkin: '#B88068', socket: 0.5, recess: 0.04, lidShadow: 0.85, lashes: 34, lashLen: 0.16,
          gain: 1.6, shadeLo: 0.22, marginA: 0.45, wetK: 1.2, waterline: 1.4, lashW: 2.6, lashLineW: 1.6 }, e));
        // keep the human lids and lashes out of the gouache repaint (the inverted lid is what reads as wrong)
        const T = eyeTU(G, e), lid = new Path2D(), m = new DOMMatrix().multiply(T);
        const ell = new Path2D(); ell.ellipse(0, -EW * 0.38 * OPEN * 0.25, EW * 0.66, EW * 0.38 * OPEN * 1.55, 0, 0, TAU); lid.addPath(ell, m);
        G.sharp.push(lid);
      });
    }
    // the gouache: every painted surface gets brush strokes (the realism patches excepted)
    gouache(cg, G, { sizes: scare ? [26, 15, 8] : [14, 8, 4.5].map(v => v * sc * 1.6), seed: 'tb:gouache', poster: scare ? 11 : 9, err: [0, 0.03, 0.045] });
    boardTexture(cg, G.W, G.H, 41, 0.35);
    // the oval gilt frame's inner edge closes the corners (scare: it catches the underlight at the bottom)
    if (scare) {
      const fr = new Path2D(); fr.rect(0, 0, G.W, G.H); fr.ellipse(G.cx, G.cy + 20 * SS, 372 * SS, 318 * SS, 0, 0, TAU);
      cg.save(); cg.fillStyle = '#0C0904'; cg.fill(fr, 'evenodd');
      const rim = cg.createLinearGradient(0, G.H, 0, 0); rim.addColorStop(0, 'rgba(210,160,70,0.9)'); rim.addColorStop(0.3, 'rgba(120,84,30,0.35)'); rim.addColorStop(0.6, 'rgba(40,28,10,0.1)'); rim.addColorStop(1, 'rgba(0,0,0,0)');
      cg.strokeStyle = rim; cg.lineWidth = 9 * SS; cg.beginPath(); cg.ellipse(G.cx, G.cy + 20 * SS, 376 * SS, 322 * SS, 0, 0, TAU); cg.stroke();
      cg.restore();
    }
  };
  c.grade = (cg, G) => capRed(cg, G.W, G.H, 0.7);
  if (scare) c.contourExtra = (cg, G, b, fadeLit) => {
    HZ.tremor(cg, G.mouthScr, { lw: SS, seed: 'tb:ctm:' + b, closed: true, passes: 2, w: [0.5, 1.4], alpha: 0.7, fade: fadeLit([0, -10]) });
    // a 1-2 px cold rim along the top of the bald dome (the only edge light up there)
    const top = G.face.filter(([x, y]) => y < G.cy - G.R * 0.75 * SS && x > G.cx - G.R * 0.9 * SS);
    HZ.tremor(cg, top, { lw: SS, seed: 'tb:rim:' + b, closed: false, passes: 2, amp: [0.3, 0.7], off: [0.8, 1.6], w: [0.7, 1.6], col: '150,165,190', alpha: 0.55,
      fade: (x, y) => sstep(G.cx - G.R * 0.7 * SS, G.cx + G.R * 0.3 * SS, x) });
  };
  return buildFace(c);
}

/* ------------------------------------------------------------ presets */
const CH = OPP.CHAR;
const put = (cv, out, rot) => { const g = cv.getContext('2d'); g.save(); if (rot) { g.translate(cv.width, cv.height); g.rotate(Math.PI); } g.drawImage(out, 0, 0, cv.width, cv.height); g.restore(); };
const CACHE = {};
const once = (key, fn) => CACHE[key] || (CACHE[key] = fn());
CH.bim_scare = (cv) => put(cv, once('bimA', () => bimScare('A').out));
CH.bim_scare_b = (cv) => put(cv, once('bimB', () => bimScare('B').out));
CH.bim_scare_turn = (cv) => put(cv, once('bimA', () => bimScare('A').out), true);
CH.mib_scare = (cv) => put(cv, once('mibA', () => mibScare('A').out));
CH.mib_scare_b = (cv) => put(cv, once('mibB', () => mibScare('B').out));
CH.turnabout_scare = (cv) => put(cv, once('tbA', () => turnabout({ mode: 'scare', boil: 'A' }).out));
CH.turnabout_scare_b = (cv) => put(cv, once('tbB', () => turnabout({ mode: 'scare', boil: 'B' }).out));

root.OPP.FACES = { SS, buildFace, rig, faceLocal, splineClosed, maskOf, mouthPP, lipOpening, eyeInSocket, wornPatch, fray, feltSlit, tornStitches, twinHeadParts, bimScare, mibScare, fisheye, turnabout, gouache, capRed, nostrilShapes, nostrilAlbedo, nostrilHeight, nostrils };
})(typeof window !== 'undefined' ? window : globalThis);
