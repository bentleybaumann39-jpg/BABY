/* scare.js - THE WORLD OF POPPY: scare-pass Poppy art (loaded after poppy.js,
 * horror.js and scenes.js; overrides / adds Poppy.ASSETS entries).
 *
 * The three jump-scare faces are no longer drawn as flat cartoon parts. Each is
 * built at 2x as an albedo layer plus a HEIGHT FIELD, lit from below by a point
 * light with cast shadows (HZ.relief), so the felt reads as a real object in a
 * dark room: chin and mouth lit, forehead black, the nose throwing its shadow
 * UP between the eyes. Then the one realistic patch (wet eyes, ivory teeth and
 * gums, skin through the felt), Junji-Ito hatching in the shadow band, a
 * tremoring overdrawn contour, smear, value-budget levels, downsample.
 *
 * Boil frames (_b): identical except the hatch strokes and the contour tremor,
 * which are seeded by `boil` only (everything else uses fixed seeds).
 */
(function (root) {
'use strict';
const P = root.Poppy, HZ = root.HZ;
const { TAU, DEG, lerp, clamp, sstep, rng, mk } = HZ;
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
function splineOpen(ctrl, per) {
  const n = ctrl.length, out = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(n - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(ctrl[n - 1].slice());
  return out;
}
const path = (pts, closed) => HZ.polyPath(pts, closed !== false);

/* rig: head-local units (face radius 1, y down) -> 2x screen px.
 * Two frames: H (outline, petals, mouth, nose) and E (eyes, brows) so the head
 * can tilt while the eyes stay level. halfK enlarges the screen-left half. */
function rig(c) {
  const cx = c.cx * SS, cy = c.cy * SS, R = c.R * SS, sx = c.sx || 1, sy = c.sy || 1;
  const TH = new DOMMatrix().translate(cx, cy).rotate(c.tilt || 0).scale(R * sx, R * sy);
  const TE = new DOMMatrix().translate(cx, cy).rotate(c.eyeTilt === undefined ? (c.tilt || 0) : c.eyeTilt).scale(R * sx, R * sy);
  const hk = c.halfK || 1;
  const warp = (u, v) => { const f = 1 + (hk - 1) * sstep(0.25, -0.55, u); return [u * f, v * lerp(1, f, 0.7)]; };
  const ap = (T) => (u, v) => { const [a, b] = warp(u, v); const p = T.transformPoint(new DOMPoint(a, b)); return [p.x, p.y]; };
  return { cx, cy, R, sx, sy, TH, TE, warp, h: ap(TH), e: ap(TE), hs: (u) => R * sy * u, k: (u) => 1 + (hk - 1) * sstep(0.25, -0.55, u) };
}
function faceLocal(c, seed) {
  const r = rng(seed + ':outline'), n = 140, cr = c.crumple || 0, jaw = c.jaw || 0, out = [];
  const ph = [r() * TAU, r() * TAU, r() * TAU, r() * TAU];
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU;
    const k = 1 + cr * (0.05 * Math.sin(a * 3 + ph[0]) + 0.035 * Math.sin(a * 5 + ph[1]) + 0.02 * Math.sin(a * 9 + ph[2]) + 0.012 * Math.sin(a * 17 + ph[3]));
    const down = Math.max(0, Math.sin(a));
    out.push([Math.cos(a) * k * (1 - 0.1 * jaw * down * down), Math.sin(a) * 0.97 * k * (1 + jaw * down * down)]);
  }
  return out;
}
function petalsLocal(c, seed) {
  const N = 9, out = [];
  for (let i = 0; i < N; i++) {
    const r = rng(seed + ':petal' + i);
    const th = -Math.PI / 2 + i * TAU / N + (r() - 0.5) * 0.08;
    let rOut = (c.petalR || 1.5) * (0.95 + r() * 0.08);
    const down = Math.max(0, Math.sin(th)); rOut *= lerp(1, c.petalBottom || 0.9, down * down);
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
  // draw order: alternate (as poppy.js does)
  return [0, 2, 4, 6, 8, 1, 3, 5, 7].map(i => out[i]);
}
const mapPts = (f, pts) => pts.map(([u, v]) => f(u, v));

/* ------------------------------------------------------------- buffers */
function maskOf(W, H, draw, blurPx) {
  const c = mk(W, H), g = c.getContext('2d'); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; draw(g);
  const m = HZ.readMask(c);
  if (blurPx) HZ.fblur(m, W, H, blurPx);
  return m;
}
function addTo(h, m, k, fn) { for (let i = 0; i < h.length; i++) if (m[i]) h[i] += (fn ? fn(m[i]) : m[i]) * k; }

/* felt overlay (neutral grey texture from poppy.js) clipped to a path */
function feltOver(g, pth, W, H, alpha, scale, seed) {
  const tex = P.feltTexture(W, H, seed || 11, scale || 2.6);
  g.save(); g.clip(pth); g.globalCompositeOperation = 'overlay'; g.globalAlpha = alpha; g.drawImage(tex, 0, 0); g.restore();
}
/* soft grey-brown stains (multiply), never red */
function stains(g, pth, box, n, seed, k) {
  const r = rng(seed + ':stains');
  g.save(); g.clip(pth); g.globalCompositeOperation = 'multiply';
  for (let i = 0; i < n; i++) {
    const x = lerp(box[0], box[2], r()), y = lerp(box[1], box[3], r()), rr = (box[2] - box[0]) * (0.04 + r() * 0.12);
    const pts = []; for (let q = 0; q < 14; q++) { const a = q / 14 * TAU; pts.push([x + Math.cos(a) * rr * (0.6 + r() * 0.7), y + Math.sin(a) * rr * (0.6 + r() * 0.7)]); }
    const sp = path(splineClosed(pts, 4));
    g.filter = `blur(${(rr * 0.12).toFixed(1)}px)`;
    g.fillStyle = `rgba(${150 + r() * 30 | 0},${135 + r() * 25 | 0},${105 + r() * 20 | 0},${(0.35 + r() * 0.4) * (k || 1)})`; g.fill(sp);
    g.filter = `blur(${(rr * 0.03 + 1).toFixed(1)}px)`; g.strokeStyle = `rgba(110,92,64,${0.3 * (k || 1)})`; g.lineWidth = 2.5; g.stroke(sp);
  }
  g.restore();
}
/* pills: little felt balls (albedo dots + height bumps) */
function pills(n, box, inside, seed, size) {
  const r = rng(seed + ':pills'), out = [];
  let tries = 0;
  while (out.length < n && tries++ < n * 30) {
    const x = lerp(box[0], box[2], r()), y = lerp(box[1], box[3], r());
    if (inside(x, y)) out.push([x, y, (size[0] + r() * (size[1] - size[0])) * SS / 2]);
  }
  return out;
}

/* ---------------------------------------------------------- the builder
 * c: W, H (final px), cx, cy, R (final px), sx, sy, tilt, eyeTilt, halfK, jaw, crumple,
 *    petalR, crush, petalCol, faceCol, decay, seed, boil, light {x, y, z (final px), col, power, d0, hard},
 *    fill (second light), ambient, lost {ang, a, b} (lost edge: fade toward angle, from a to b in R),
 *    hooks: albedo(ag, G), height(h, G, util), overlay(cg, G, util), post(cg, G, util)
 *    hatch {n, angles, band}, contour {passes}, smear {zoom, fn}, budget [darkQ, darkV, brightQ, brightV]
 */
function buildFace(c) {
  const W = c.W * SS, H = c.H * SS, seed = c.seed || 'scare', boil = c.boil || 'A';
  const G = rig(c), R = G.R;
  G.W = W; G.H = H; G.c = c;
  // shapes in screen space
  G.faceL = faceLocal(c, seed);
  G.face = mapPts(G.h, G.faceL);
  G.petals = petalsLocal(c, seed).map(p => Object.assign(p, { scr: mapPts(G.h, p.pts) }));
  const facePath = path(G.face);
  G.facePath = facePath;
  // ---------------- albedo
  const A = mk(W, H), ag = A.getContext('2d');
  const petalCol = c.petalCol || '#5A1016';
  for (const p of G.petals) {
    const pp = path(p.scr);
    const [bx, by] = G.h(0, 0);
    const gr = ag.createRadialGradient(bx, by, R * 0.5, bx, by, R * p.rOut * 1.05);
    gr.addColorStop(0, HZ.mixc(petalCol, '#000000', 0.5)); gr.addColorStop(0.55, petalCol); gr.addColorStop(1, HZ.mixc(petalCol, '#8A3030', 0.25));
    ag.fillStyle = gr; ag.fill(pp);
    // veins
    const r = rng(seed + ':veins' + p.i);
    ag.save(); ag.clip(pp); ag.lineCap = 'round';
    for (let k = 0; k < 14; k++) {
      const a = p.th + (k / 13 - 0.5) * 2 * p.hw * 0.85 + (r() - 0.5) * 0.04, r0 = 0.95, r1 = p.rOut * (0.85 + r() * 0.12);
      const a0 = G.h(Math.cos(a) * r0, Math.sin(a) * r0), a1 = G.h(Math.cos(a) * r1, Math.sin(a) * r1);
      ag.strokeStyle = `rgba(20,0,2,${0.25 + r() * 0.2})`; ag.lineWidth = 1.5 + r() * 1.5;
      ag.beginPath(); ag.moveTo(a0[0], a0[1]); ag.quadraticCurveTo((a0[0] + a1[0]) / 2 + (r() - 0.5) * 8, (a0[1] + a1[1]) / 2 + (r() - 0.5) * 8, a1[0], a1[1]); ag.stroke();
    }
    ag.restore();
    feltOver(ag, pp, W, H, 0.55, 2.6, 13);
  }
  // face felt
  const faceCol = c.faceCol || '#DCC8A4';
  {
    const [fx, fy] = G.h(-0.2, -0.25);
    const fg = ag.createRadialGradient(fx, fy, R * 0.05, G.cx, G.cy, R * 1.15);
    fg.addColorStop(0, HZ.mixc(faceCol, '#FFF4E0', 0.12)); fg.addColorStop(0.6, faceCol); fg.addColorStop(1, HZ.mixc(faceCol, '#6A5A40', 0.35));
    ag.fillStyle = fg; ag.fill(facePath);
    feltOver(ag, facePath, W, H, 0.85, 2.6, 11);
    feltOver(ag, facePath, W, H, 0.4, 1.2, 17);
    stains(ag, facePath, [G.cx - R, G.cy - R, G.cx + R, G.cy + R], Math.round(6 + 10 * (c.decay || 0.5)), seed, c.stainK);
  }
  G.inFace = (x, y) => ag.isPointInPath(facePath, x, y);
  // pills
  G.pills = pills(c.pills === undefined ? 220 : c.pills, [G.cx - R * 1.1, G.cy - R * 1.2, G.cx + R * 1.1, G.cy + R * 1.2], G.inFace, seed, [2, 4]);
  for (const [x, y, pr] of G.pills) {
    const pg = ag.createRadialGradient(x - pr * 0.3, y - pr * 0.3, 0, x, y, pr);
    pg.addColorStop(0, HZ.mixc(faceCol, '#FFFFFF', 0.25)); pg.addColorStop(1, HZ.mixc(faceCol, '#504030', 0.3));
    ag.fillStyle = pg; ag.beginPath(); ag.arc(x, y, pr, 0, TAU); ag.fill();
  }
  if (c.albedo) c.albedo(ag, G);
  // ---------------- height field (px)
  const h = new Float32Array(W * H);
  const fm = maskOf(W, H, g => g.fill(facePath));
  const fmB = new Float32Array(fm); HZ.fblur(fmB, W, H, R * 0.22);
  const fmS = new Float32Array(fm); HZ.fblur(fmS, W, H, R * 0.025);
  // petals: low ring with pleats; each petal a soft pillow
  for (const p of G.petals) {
    const pm = maskOf(W, H, g => g.fill(path(p.scr)), R * 0.04);
    addTo(h, pm, R * 0.1 * (c.petalH || 1));
  }
  // face: pillow dome on top of the petals
  for (let i = 0; i < h.length; i++) if (fmS[i] > 0) h[i] = h[i] * (1 - fmS[i]) + fmS[i] * (R * 0.16) + R * (c.dome || 0.32) * Math.pow(fmB[i], 0.65) * fmS[i];
  // fine felt relief + pills
  {
    const tex = P.feltTexture(W, H, 11, 2.6), td = tex.getContext('2d').getImageData(0, 0, W, H).data;
    const pa = maskOf(W, H, g => { for (const p of G.petals) g.fill(path(p.scr)); g.fill(facePath); });
    for (let i = 0; i < h.length; i++) if (pa[i]) h[i] += (td[i * 4] - 128) / 128 * (c.fuzzH || 1.6) * pa[i];
    const pm = maskOf(W, H, g => { for (const [x, y, pr] of G.pills) { g.beginPath(); g.arc(x, y, pr, 0, TAU); g.fill(); } }, 1.5);
    addTo(h, pm, 3.2);
  }
  // crumple creases (low-frequency ridges)
  if (c.crumple) {
    const sd = HZ.hashStr(seed) % 9999;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!fmS[i]) continue;
      const n = HZ.fbm(x / (R * 0.35), y / (R * 0.35), sd, 3);
      h[i] += (1 - Math.abs(n) * 2.2) * R * 0.018 * c.crumple * fmS[i];
    }
  }
  const spec = new Float32Array(W * H);
  const util = { maskOf: (d, b) => maskOf(W, H, d, b), addTo, path, splineClosed, splineOpen, spec, A, ag };
  // nose: seed-pod button (dome + flat crown), a sharp bump that throws a long shadow
  if (c.nose !== false) {
    const n = Object.assign({ x: 0, y: 0.14, s: 1 }, c.nose || {});
    const s = n.s * 0.1;
    const dome = []; for (let k = 0; k < 40; k++) { const a = k / 40 * TAU; dome.push([n.x + Math.cos(a) * s * 0.95, n.y + 0.035 * n.s + Math.sin(a) * s * 0.78]); }
    G.nose = mapPts(G.h, dome); G.noseC = G.h(n.x, n.y + 0.03 * n.s);
    const np = path(G.nose);
    const ng = ag.createRadialGradient(G.noseC[0] - R * 0.03, G.noseC[1] - R * 0.03, 0, G.noseC[0], G.noseC[1], R * s);
    ng.addColorStop(0, '#3A3634'); ng.addColorStop(0.6, '#1A1716'); ng.addColorStop(1, '#0A0909');
    ag.fillStyle = ng; ag.fill(np);
    // crown with rays
    const [kx, ky] = G.h(n.x, n.y - 0.01 * n.s);
    ag.save(); ag.translate(kx, ky); ag.rotate((c.tilt || 0) * DEG);
    ag.fillStyle = '#2E2B2C'; ag.beginPath(); ag.ellipse(0, 0, R * s * 0.85, R * s * 0.34, 0, 0, TAU); ag.fill();
    ag.strokeStyle = '#5A5658'; ag.lineWidth = 2.2;
    for (let k = 0; k < 7; k++) { const a = k / 7 * TAU - Math.PI / 2; ag.beginPath(); ag.moveTo(0, 0); ag.lineTo(Math.cos(a) * R * s * 0.75, Math.sin(a) * R * s * 0.3); ag.stroke(); }
    ag.restore();
    // scuffs
    const r = rng(seed + ':scuff'); ag.save(); ag.clip(np); ag.lineCap = 'round';
    for (let k = 0; k < 12; k++) { const x = G.noseC[0] + (r() - 0.5) * R * s * 1.6, y = G.noseC[1] + (r() - 0.5) * R * s * 1.2; ag.strokeStyle = `rgba(150,140,130,${0.2 + r() * 0.3})`; ag.lineWidth = 1 + r() * 1.5; ag.beginPath(); ag.moveTo(x, y); ag.lineTo(x + (r() - 0.5) * R * 0.05, y + (r() - 0.5) * R * 0.03); ag.stroke(); }
    ag.restore();
    const nm = maskOf(W, H, g => g.fill(np), R * 0.012);
    const nmB = maskOf(W, H, g => g.fill(np), R * 0.04);
    for (let i = 0; i < h.length; i++) if (nm[i]) { h[i] += R * 0.11 * Math.pow(nmB[i], 0.6) * nm[i] * n.s; spec[i] = nm[i] * 0.9; }
    G.noseMask = nm;
  }
  if (c.height) c.height(h, G, util);
  G.h0 = h;
  // ---------------- light
  const L = Object.assign({ x: c.cx, y: c.cy + c.R * 1.4, z: 700, col: [1.15, 1.08, 0.98], power: 1.4, d0: 500, hard: 0 }, c.light || {});
  const toDev = (l) => Object.assign({}, l, { x: l.x * SS, y: l.y * SS, z: l.z * SS, d0: (l.d0 || 500) * SS });
  const albedoId = ag.getImageData(0, 0, W, H);
  const lit = HZ.relief({ W, H, h, albedo: albedoId, light: toDev(L), fill: c.fill ? toDev(c.fill) : null, ambient: c.ambient || [0.025, 0.025, 0.03],
    cavity: c.cavity === undefined ? 0.012 : c.cavity, cavityR: R * 0.08, shadow: Object.assign({ steps: 60, soft: 6, bias: 1.2, maxDist: R * 1.2 }, c.shadow || {}),
    spec, specPow: 40, specK: 160 });
  // lost edge: the far side dissolves into black
  if (c.lost) {
    const d = lit.img.data, ca = Math.cos(c.lost.ang * DEG), sa = Math.sin(c.lost.ang * DEG);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = ((x - G.cx) * ca + (y - G.cy) * sa) / R, f = 1 - sstep(c.lost.a, c.lost.b, t) * (c.lost.k === undefined ? 1 : c.lost.k);
      if (f < 1) { const i = (y * W + x) * 4; d[i] *= f; d[i + 1] *= f; d[i + 2] *= f; }
    }
  }
  const C = mk(W, H), cg = C.getContext('2d');
  cg.fillStyle = c.bg || '#000'; cg.fillRect(0, 0, W, H);
  const LC = mk(W, H); LC.getContext('2d').putImageData(lit.img, 0, 0);
  cg.drawImage(LC, 0, 0);
  G.key = lit.key;
  // overlay light: a smooth stand-in for the key light on flat overlays (eyes, teeth)
  G.olight = (x, y, floor) => {
    const dx = L.x * SS - x, dy = L.y * SS - y, dz = L.z * SS, d = Math.hypot(dx, dy, dz);
    const fall = 1 / (1 + Math.pow(d / (L.d0 * SS), 2));
    return Math.max(floor || 0, (dz / d) * fall * L.power);
  };
  G.L = L;
  // realistic patches (drawn after lighting; they carry their own light)
  G.sharp = [];                 // paths kept out of hatching and smear
  if (c.overlay) c.overlay(cg, G, util);
  // ---------------- hatching in the shadow band (boil-seeded)
  const id = cg.getImageData(0, 0, W, H), lum = HZ.lumaOf(id);
  const hm = maskOf(W, H, g => { for (const p of G.petals) g.fill(path(p.scr)); g.fill(facePath); if (c.hatchExtra) c.hatchExtra(g, G); });
  if (G.sharp.length) { const sm = maskOf(W, H, g => { for (const p of G.sharp) g.fill(p); }, 6); for (let i = 0; i < hm.length; i++) hm[i] *= 1 - Math.min(1, sm[i] * 1.6); }
  const hc = Object.assign({ n: 420, angles: [-0.95 + (c.tilt || 0) * DEG, -0.45 + (c.tilt || 0) * DEG, 0.8], band: [0.025, 0.12, 0.4], len: [16, 44], w: 2, cluster: [4, 8], gap: 5.5 }, c.hatch || {});
  G.hatchCount = HZ.hatch(cg, lum, W, H, Object.assign({}, hc, { seed: seed + ':hatch:' + boil, mask: hm }));
  // ---------------- tremor contour (boil-seeded), visible only where something is lit
  const lumAt = (x, y) => { const xi = clamp(x | 0, 0, W - 1), yi = clamp(y | 0, 0, H - 1); return lum[yi * W + xi]; };
  const fadeLit = (inset) => (x, y) => sstep(0.03, 0.14, Math.max(lumAt(x, y), lumAt(x + inset[0], y + inset[1])));
  const ct = Object.assign({ passes: 3 }, c.contour || {});
  HZ.tremor(cg, G.face, Object.assign({ lw: SS, seed: seed + ':ct:' + boil, closed: true, col: '14,9,6', alpha: 0.9, fade: (x, y) => {
    const dx = G.cx - x, dy = G.cy - y, d = Math.hypot(dx, dy) || 1; return fadeLit([dx / d * 8, dy / d * 8])(x, y); } }, ct));
  for (const p of G.petals) {
    // only the outer tip arc of each petal
    const tip = p.scr.filter((q, k) => k >= 18 && k <= p.scr.length - 18);
    if (tip.length > 3) HZ.tremor(cg, tip, { lw: SS, seed: seed + ':ctp' + p.i + ':' + boil, closed: false, passes: 2, w: [0.5, 1.6], col: '10,2,3', alpha: 0.8, fade: fadeLit([0, 0]) });
  }
  if (c.contourExtra) c.contourExtra(cg, G, boil, fadeLit);
  if (c.post) c.post(cg, G, util);
  // ---------------- smear (lunge) on chosen edges, keeping the sharp patches sharp
  if (c.smear) {
    const sm = G.sharp.length ? maskOf(W, H, g => { for (const p of G.sharp) g.fill(p); }, 10) : null;
    HZ.smear(C, G.cx, G.cy, c.smear.zoom || 0.06, (x, y) => { const v = c.smear.fn(x / W, y / H); return sm ? v * (1 - Math.min(1, sm[y * W + x] * 2)) : v; }, 12);
  }
  // ---------------- value budget, grain, downsample
  if (c.budget) {
    const fid = cg.getImageData(0, 0, W, H);
    G.levels = HZ.levels(fid, c.budget[0], c.budget[1], c.budget[2], c.budget[3], { minGain: 0.7, maxGain: 1.8 });
    cg.putImageData(fid, 0, 0);
  }
  if (c.grade) c.grade(cg, G);
  HZ.grain(C, c.grain === undefined ? 7 : c.grain, seed + ':grain');
  const out = HZ.downsample(C, c.W, c.H);
  return { out, G };
}

/* ======================================================= SCARE 1: COSTUME
 * The empty costume head lunging at the lens, lit only by the camcorder light
 * held low (40 deg below, slightly right). Tilted 32 deg clockwise; its right
 * side dissolves into black. A real eye pressed to the left mesh hole; real
 * teeth through the torn smile; petals crushed flat on the left. */
function costume(boil) {
  const R = 162;
  const c = {
    W: 800, H: 600, cx: 380, cy: 310, R, sx: 1, sy: 1.04, tilt: 32, crumple: 1.0, jaw: 0.05, seed: 'costume3', boil,
    petalR: 1.48, crush: [{ angle: Math.PI * 0.95, amount: 0.3, squeeze: 0.55 }], petalCol: '#4A0E12', faceCol: '#D2BE98', decay: 0.8, petalRag: 0.08,
    nose: { x: 0.0, y: 0.12, s: 1.05 },
    light: { x: 380 + 40, y: 310 + 520, z: 620, col: [1.25, 1.12, 0.98], power: 2.2, d0: 520, hard: 0.85 },
    ambient: [0.004, 0.004, 0.005],
    lost: { ang: -32 + 0, a: 0.05, b: 0.95, k: 1 },
    shadow: { soft: 30 },
    hatch: { n: 430 },
    smear: { zoom: 0.05, fn: (u, v) => Math.max(sstep(0.32, 0.0, v), sstep(0.68, 1.0, u)) * 0.85 },
    budget: [0.65, 0.08, 0.93, 0.62],
  };
  // eye holes (head frame): left with the real eye, right empty and 5% of head height lower
  const holes = [{ x: -0.38, y: -0.2, rx: 0.205, ry: 0.235 }, { x: 0.38, y: -0.2 + 0.1, rx: 0.2, ry: 0.23 }];
  // torn smile centreline (head frame): wide, corners up, running past the outline on the right
  const mouthC = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, x = lerp(-0.66, 1.1, t);
    const xs = clamp(x / 0.72, -1, 1);
    let y = 0.36 + 0.15 * (1 - xs * xs);
    if (x > 0.72) y = 0.36 - (x - 0.72) * 0.55 - Math.pow(x - 0.72, 2) * 0.6;
    mouthC.push([x, y]);
  }
  const openAt = (x) => x < 0.75 ? 0.115 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs((x - 0.04) / 0.72), 2.2)), 0.55) + 0.012 : 0.03 * Math.max(0, 1 - (x - 0.75) / 0.38) + 0.006;
  function tornMouth() {
    const r = rng('costume:torn'), up = [], lo = [];
    for (let i = 0; i < mouthC.length; i++) {
      const [x, y] = mouthC[i], a = i < mouthC.length - 1 ? Math.atan2(mouthC[i + 1][1] - y, mouthC[i + 1][0] - x) : Math.atan2(y - mouthC[i - 1][1], x - mouthC[i - 1][0]);
      const nx = -Math.sin(a), ny = Math.cos(a), o = openAt(x);
      const ru = o * (0.55 + 0.25 * HZ.noise1(i * 0.7, 3) + 0.12 * (r() - 0.5)), rl = o * (1.0 + 0.4 * HZ.noise1(i * 0.6, 9) + 0.18 * (r() - 0.5));
      up.push([x - nx * ru, y - ny * ru]); lo.push([x + nx * rl, y + ny * rl]);
    }
    return { up, lo, pts: up.concat(lo.slice().reverse()) };
  }
  const TM = tornMouth();
  c.albedo = (ag, G) => {
    // eye holes: black, with the felt's cut thickness
    G.holes = holes.map(o => { const pts = []; for (let k = 0; k < 48; k++) { const a = k / 48 * TAU; pts.push([o.x + Math.cos(a) * o.rx, o.y + Math.sin(a) * o.ry]); } return mapPts(G.h, pts); });
    for (const hp of G.holes) { ag.fillStyle = '#050403'; ag.fill(path(hp)); }
    // running stitch around the face edge (thread on felt)
    const inset = mapPts(G.h, G.faceL.map(([u, v]) => [u * 0.93, v * 0.93]));
    ag.save(); ag.setLineDash([9, 7]); ag.strokeStyle = 'rgba(70,52,36,0.85)'; ag.lineWidth = 2.6; ag.stroke(path(inset)); ag.restore();
    // the tear: black void, frayed grey-cream felt edges with loose threads
    G.mouth = mapPts(G.h, TM.pts); const mp = path(G.mouth);
    ag.fillStyle = '#020101'; ag.fill(mp);
    const r = rng('costume:fray');
    ag.lineCap = 'round';
    for (const edge of [TM.up, TM.lo]) {
      const E = mapPts(G.h, edge);
      for (let i = 1; i < E.length - 1; i++) {
        for (let q = 0; q < 5; q++) {
          const [x, y] = E[i], a = Math.atan2(E[i + 1][1] - E[i - 1][1], E[i + 1][0] - E[i - 1][0]);
          const toward = edge === TM.up ? 1 : -1;
          const L = (3 + r() * 14), ang = a + Math.PI / 2 * toward + (r() - 0.5) * 1.3;
          ag.strokeStyle = r() < 0.6 ? `rgba(206,192,166,${0.5 + r() * 0.5})` : `rgba(120,108,90,${0.5 + r() * 0.4})`;
          ag.lineWidth = 0.8 + r() * 1.4;
          ag.beginPath(); ag.moveTo(x - Math.cos(ang) * 3, y - Math.sin(ang) * 3); ag.quadraticCurveTo(x + Math.cos(ang + 0.4) * L * 0.5, y + Math.sin(ang + 0.4) * L * 0.5, x + Math.cos(ang) * L, y + Math.sin(ang) * L); ag.stroke();
        }
      }
    }
    // remnants of the painted smile line along the upper edge (dark maroon-brown, never bright red)
    ag.save(); ag.strokeStyle = 'rgba(62,22,20,0.8)'; ag.lineWidth = 4; ag.setLineDash([28, 9, 14, 12]);
    ag.translate(0, -3); ag.stroke(path(mapPts(G.h, TM.up.slice(4, 46)), false)); ag.restore();
  };
  c.height = (h, G, U) => {
    const R2 = G.R;
    // eye holes: deep, with a slightly raised cut rim
    for (const hp of G.holes) {
      const m = U.maskOf(g => g.fill(path(hp)), 3), rim = U.maskOf(g => { g.lineWidth = R2 * 0.05; g.stroke(path(hp)); }, R2 * 0.02);
      for (let i = 0; i < h.length; i++) { if (m[i]) h[i] -= m[i] * R2 * 0.35; if (rim[i]) h[i] += rim[i] * R2 * 0.02; }
    }
    // brow ridge above the holes, cheeks, chin
    const bump = (u, v, rx, ry, amp) => { const [x, y] = G.h(u, v); const m = U.maskOf(g => { g.beginPath(); g.ellipse(x, y, rx * R2, ry * R2, (G.c.tilt || 0) * DEG, 0, TAU); g.fill(); }, R2 * Math.min(rx, ry) * 0.8); U.addTo(h, m, amp * R2); };
    bump(-0.4, -0.5, 0.32, 0.1, 0.035); bump(0.4, -0.42, 0.3, 0.1, 0.03);
    bump(-0.55, 0.2, 0.22, 0.18, 0.05); bump(0.55, 0.25, 0.2, 0.18, 0.03);
    bump(0.05, 0.78, 0.3, 0.12, 0.04);
    // the tear: a deep slit with frayed, slightly raised lips
    const mp = path(G.mouth);
    const m = U.maskOf(g => g.fill(mp), 2.5), lip = U.maskOf(g => { g.lineWidth = R2 * 0.06; g.stroke(mp); }, R2 * 0.02);
    for (let i = 0; i < h.length; i++) { if (lip[i]) h[i] += lip[i] * R2 * 0.025; if (m[i]) h[i] -= m[i] * R2 * 0.4; }
  };
  c.overlay = (cg, G) => {
    const R2 = G.R;
    // ---- the real eye inside the left hole, pressed to the mesh
    const hp = path(G.holes[0]);
    const [ex, ey] = G.h(-0.38, -0.19);
    cg.save(); cg.clip(hp);
    // dim human skin around the eye inside the dark hole
    const sk = cg.createRadialGradient(ex, ey + R2 * 0.05, R2 * 0.05, ex, ey, R2 * 0.26);
    sk.addColorStop(0, 'rgba(120,82,66,0.9)'); sk.addColorStop(0.6, 'rgba(60,38,30,0.75)'); sk.addColorStop(1, 'rgba(8,5,4,0.9)');
    cg.fillStyle = sk; cg.fillRect(ex - R2, ey - R2, R2 * 2, R2 * 2);
    const L = HZ.layerOf(cg);
    const eye = HZ.wetEye(L.g, { cx: ex, cy: ey + R2 * 0.01, w: R2 * 0.36, open: 1.18, side: -1, rot: (G.c.tilt) * DEG * 0.6, pupil: 0.09,
      irisCol: ['#A08A58', '#7C8470', '#2F3834'], veins: 5, catch: { x: 0.1, y: 0.18, s: 0.3 }, light: { x: 0.15, y: 1 }, lowerFlat: 0.6,
      lashes: 13, lashLen: 0.12, press: 0.85, lidSkin: '#8A5E50', ring: 0.13, socket: 0.25, lw: SS, seed: 'costume:eye' });
    // light: lower half lit by the low lamp, the top falls into the dark
    const lg = L.g; lg.save(); lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalCompositeOperation = 'source-atop';
    const gr = lg.createLinearGradient(0, ey - R2 * 0.2, 0, ey + R2 * 0.12);
    gr.addColorStop(0, 'rgba(0,0,0,0.78)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    lg.fillStyle = gr; lg.fillRect(0, 0, G.W, G.H); lg.restore();
    HZ.blit(cg, L.c);
    // the mesh pressed against the eye: dark wires, lower edges catching the light
    meshGrid(cg, G, hp, ex, ey, true);
    // hole rim: the lower inside edge of the cut felt catches the light
    cg.restore();
    G.sharp.push(eye.ap);
    // right hole: black, empty, its mesh barely visible
    const hp2 = path(G.holes[1]); const [rx, ry] = G.h(0.38, -0.1);
    cg.save(); cg.clip(hp2); cg.fillStyle = '#010101'; cg.fill(hp2); meshGrid(cg, G, hp2, rx, ry, false); cg.restore();
    // ---- teeth through the tear
    teethInTear(cg, G);
  };
  function meshGrid(cg, G, hp, ex, ey, bright) {
    const R2 = G.R, step = R2 * 0.052, a = (G.c.tilt || 0) * DEG + Math.PI / 4;
    cg.save(); cg.clip(hp); cg.translate(ex, ey); cg.rotate(a);
    for (const dir of [0, 1]) {
      for (let k = -14; k <= 14; k++) {
        const o = k * step;
        cg.save(); if (dir) cg.rotate(Math.PI / 2);
        cg.fillStyle = 'rgba(14,12,10,0.92)'; cg.fillRect(-R2, o - 1.8, R2 * 2, 3.6);
        if (bright) { cg.fillStyle = 'rgba(160,150,132,0.55)'; cg.fillRect(-R2, o + 1.2, R2 * 2, 1.4); }
        else { cg.fillStyle = 'rgba(80,74,66,0.25)'; cg.fillRect(-R2, o + 1.2, R2 * 2, 1.2); }
        cg.restore();
      }
    }
    cg.restore();
  }
  function teethInTear(cg, G) {
    const R2 = G.R, mp = path(G.mouth);
    const L = HZ.layerOf(cg), lg = L.g;
    // gum lines follow the smile arch, set back behind the felt
    const upLine = [], loLine = [];
    for (let i = 0; i <= 40; i++) {
      const x = lerp(-0.6, 0.66, i / 40), xs = x / 0.72, y = 0.36 + 0.15 * (1 - xs * xs);
      upLine.push(G.h(x * 1.0, y - 0.105)); loLine.push(G.h(x * 0.96, y + 0.15));
    }
    lg.fillStyle = '#020101'; lg.fill(mp);
    lg.save(); lg.clip(mp);
    HZ.teethRow(lg, { line: loLine, dir: -1, n: 14, len: R2 * 0.13, lower: true, gum: R2 * 0.05, lw: SS, seed: 'costume:lo', persp: 0.55 });
    HZ.teethRow(lg, { line: upLine, dir: 1, n: 14, len: R2 * 0.16, gum: R2 * 0.07, lw: SS, seed: 'costume:up', persp: 0.55 });
    // under-light: bright along the bottom, the upper gum falls off; the far right corner into black
    lg.globalCompositeOperation = 'source-atop';
    const [mx, my] = G.h(0.0, 0.42);
    const gr = lg.createLinearGradient(0, my - R2 * 0.2, 0, my + R2 * 0.12);
    gr.addColorStop(0, 'rgba(0,0,0,0.7)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    lg.fillStyle = gr; lg.fillRect(0, 0, G.W, G.H);
    const sg = lg.createLinearGradient(mx - R2 * 0.6, 0, mx + R2 * 0.9, 0);
    sg.addColorStop(0, 'rgba(0,0,0,0.15)'); sg.addColorStop(0.5, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.9)');
    lg.fillStyle = sg; lg.fillRect(0, 0, G.W, G.H);
    lg.restore();
    // the frayed lip edges overlap the teeth a little (fibres in front)
    HZ.blit(cg, L.c);
    G.sharp.push(mp);
    // fibres crossing in front of the teeth
    const r = rng('costume:frontfibres'); cg.save(); cg.lineCap = 'round';
    for (const edge of [TM.up, TM.lo]) {
      const E = mapPts(G.h, edge);
      for (let i = 2; i < E.length - 2; i += 1) {
        if (r() < 0.4) continue;
        const [x, y] = E[i], toward = edge === TM.up ? 1 : -1, L2 = 4 + r() * 12, ang = Math.PI / 2 * toward + (r() - 0.5) * 1.2 + (G.c.tilt * DEG);
        cg.strokeStyle = `rgba(${190 + r() * 30 | 0},${176 + r() * 30 | 0},${150 + r() * 25 | 0},${0.35 + r() * 0.5})`; cg.lineWidth = 0.8 + r() * 1.0;
        cg.beginPath(); cg.moveTo(x, y); cg.quadraticCurveTo(x + Math.cos(ang + 0.5) * L2 * 0.5, y + Math.sin(ang + 0.5) * L2 * 0.5, x + Math.cos(ang) * L2, y + Math.sin(ang) * L2); cg.stroke();
      }
    }
    // loose threads still bridging the tear
    for (const t of [0.18, 0.42, 0.63]) {
      const i = Math.round(t * (TM.up.length - 1));
      const a = G.h(...TM.up[i]), b = G.h(...TM.lo[Math.min(TM.lo.length - 1, i + 2)]);
      cg.strokeStyle = 'rgba(214,200,172,0.85)'; cg.lineWidth = 1.6;
      cg.beginPath(); cg.moveTo(a[0], a[1]); cg.quadraticCurveTo((a[0] + b[0]) / 2 + 6, (a[1] + b[1]) / 2 + 10, b[0], b[1]); cg.stroke();
    }
    cg.restore();
  }
  c.contourExtra = (cg, G, b, fadeLit) => {
    HZ.tremor(cg, G.mouth, { lw: SS, seed: 'costume:ctm:' + b, closed: true, passes: 2, w: [0.5, 1.6], alpha: 0.75, fade: fadeLit([0, -10]) });
    for (let k = 0; k < 2; k++) HZ.tremor(cg, G.holes[k], { lw: SS, seed: 'costume:cth' + k + ':' + b, closed: true, passes: 2, w: [0.5, 1.8], alpha: 0.8, fade: fadeLit([0, 10]) });
  };
  return buildFace(c);
}

const A = P.ASSETS;
A.poppy_scare_costume = (cv) => { const { out } = costume('A'); cv.getContext('2d').drawImage(out, 0, 0); };
A.poppy_scare_costume_b = (cv) => { const { out } = costume('B'); cv.getContext('2d').drawImage(out, 0, 0); };

root.Poppy.SCARE = { buildFace, rig, faceLocal, petalsLocal, splineClosed, splineOpen, maskOf, costume };
})(typeof window !== 'undefined' ? window : globalThis);
