/* horror.js - THE WORLD OF POPPY: realism-in-the-wrong-place toolkit (scare pass).
 *
 * Shared by the Poppy renderer (render_poppy.cjs) and the misc renderer
 * (misc/render_misc.cjs). Exposes window.HZ. Pure canvas 2D + typed arrays.
 *
 * The rules come from poppy/research/scarier.md: keep the felt cartoon, and
 * make ONE patch too real (wet eyes, ivory teeth and gums, skin where the felt
 * is worn through); light from below; most of the frame black; hatch the
 * shadows (Junji Ito); shaky overdrawn contours; no blood, no wounds, never red
 * pools, human teeth (never fangs).
 *
 *   HZ.wetEye(g, o)          realistic wet human eye (sclera, veins, fibred iris,
 *                            limbal ring, pupil, window catchlight, waterline, lashes)
 *   HZ.teethRow(g, o)        a row of real teeth hanging from / standing on a gum line
 *   HZ.skinPatch(g, o)       skin showing through worn felt (pores, faint veins, frayed edge)
 *   HZ.relief(o)             height-field lighting (normals, point light, cast shadows, cavity)
 *   HZ.hatch(g, lum, W, H, o) 1-px hatch strokes in the shadow band (re-seed = boil)
 *   HZ.tremor(g, pts, o)     tremoring, overdrawn ink line
 *   HZ.levels(...)           value-budget levels (percentile-driven)
 *   HZ.fblur, HZ.noise2, HZ.fbm, HZ.rng ...
 *
 * Units: functions that draw vector shapes work in g's current user space;
 * o.lw is the size of ONE FINAL-IMAGE PIXEL in those units (2 when drawing at
 * 2x with an identity transform, 1 for the misc renderer's pre-scaled ctx).
 */
(function (root) {
'use strict';

const TAU = Math.PI * 2, DEG = Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ------------------------------------------------------------------ RNG */
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function rng(name) {
  const r = mulberry32(hashStr(String(name)));
  const f = () => r();
  f.range = (a, b) => a + (b - a) * r();
  f.int = (a, b) => Math.floor(a + (b - a + 1) * r());
  f.pick = arr => arr[Math.floor(r() * arr.length)];
  f.gauss = () => { let s = 0; for (let i = 0; i < 4; i++) s += r(); return (s - 2) / 0.577; };
  return f;
}

/* ---------------------------------------------------------------- noise */
function hash2(ix, iy, seed) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/* smooth value noise in [-1, 1] */
function noise2(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return (lerp(lerp(a, b, ux), lerp(c, d, ux), uy)) * 2 - 1;
}
function fbm(x, y, seed, oct) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < (oct || 4); i++) { s += a * noise2(x * f, y * f, seed + i * 17); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
function noise1(x, seed) { return noise2(x, 0.5, seed); }

/* ------------------------------------------------------------- canvas */
function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
function scaleOf(g) { const m = g.getTransform(); return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)); }
/* an offscreen layer with the same device size and transform as g */
function layerOf(g) { const c = mk(g.canvas.width, g.canvas.height), lg = c.getContext('2d'); lg.setTransform(g.getTransform()); return { c, g: lg }; }
function blit(g, c, alpha, op, filter) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  if (alpha !== undefined) g.globalAlpha = alpha;
  if (op) g.globalCompositeOperation = op;
  if (filter) g.filter = filter;
  g.drawImage(c.c || c, 0, 0); g.restore();
}
function polyPath(pts, closed) {
  const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  if (closed) p.closePath();
  return p;
}
function hex2rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(h, a) { const c = hex2rgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function mixc(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return '#' + A.map((v, i) => clamp(Math.round(lerp(v, B[i], t)), 0, 255).toString(16).padStart(2, '0')).join(''); }

/* resample a polyline at a fixed spacing; returns [[x,y,angle],...] */
function resample(pts, step, closed) {
  const src = closed ? pts.concat([pts[0]]) : pts;
  const out = []; let carry = 0;
  for (let i = 0; i < src.length - 1; i++) {
    const a = src[i], b = src[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (L < 1e-9) continue;
    const ang = Math.atan2(dy, dx);
    let s = carry;
    while (s <= L) { out.push([a[0] + dx * s / L, a[1] + dy * s / L, ang]); s += step; }
    carry = s - L;
  }
  return out;
}
function arcLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
/* point + tangent angle at arc length s along an open polyline */
function along(pts, s) {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (acc + L >= s || i === pts.length - 1) {
      const t = L > 0 ? clamp((s - acc) / L, 0, 1) : 0;
      return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), Math.atan2(b[1] - a[1], b[0] - a[0])];
    }
    acc += L;
  }
  return [pts[0][0], pts[0][1], 0];
}

/* ------------------------------------------------------ float buffers */
/* separable box blur, 3 passes ~ gaussian (sigma ~ r * 0.9). In place. */
function fblur(a, w, h, r) {
  r = Math.max(1, Math.round(r));
  const tmp = new Float32Array(Math.max(w, h));
  const pass = () => {
    for (let y = 0; y < h; y++) {           // horizontal
      const o = y * w; let s = 0;
      for (let x = -r; x <= r; x++) s += a[o + clamp(x, 0, w - 1)];
      for (let x = 0; x < w; x++) { tmp[x] = s / (2 * r + 1); s += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)]; }
      for (let x = 0; x < w; x++) a[o + x] = tmp[x];
    }
    for (let x = 0; x < w; x++) {           // vertical
      let s = 0;
      for (let y = -r; y <= r; y++) s += a[clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) { tmp[y] = s / (2 * r + 1); s += a[Math.min(h - 1, y + r + 1) * w + x] - a[Math.max(0, y - r) * w + x]; }
      for (let y = 0; y < h; y++) a[y * w + x] = tmp[y];
    }
  };
  pass(); pass(); pass();
  return a;
}
/* read one channel of a canvas (device px) into floats 0..1 (alpha by default) */
function readMask(c, ch) {
  const id = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, n = c.width * c.height, out = new Float32Array(n);
  const k = ch === undefined ? 3 : ch;
  for (let i = 0; i < n; i++) out[i] = id[i * 4 + k] / 255;
  return out;
}
function lumaOf(id) {
  const d = id.data, n = d.length / 4, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
  return out;
}

/* ================================================================ EYE
 * wetEye(g, o) - a realistic wet human eye in g's user space.
 *  o.cx, o.cy   centre of the aperture          o.w   aperture width (corner to corner)
 *  o.open       1 = rest (height 0.38 w); 1.35 shows white above the iris
 *  o.side       -1 screen-left eye (nose to its right), +1 screen-right eye
 *  o.rot        rotation (rad)
 *  o.iris       iris radius / w (0.2)            o.irisDy  iris offset (aperture heights, + = down)
 *  o.gaze       [x, y] iris offset in w
 *  o.pupil      pupil radius / iris radius (0.09 pinpoint ... 0.9 blown)
 *  o.irisCol    [collarette, mid, outer]         o.fibres  main radial fibres (50)
 *  o.veins      capillaries (6)                  o.veinCol '#C9A3A0'
 *  o.catch      {x, y, s} window catchlight in iris radii (false = none)
 *  o.light      {x, y} direction TO the key light (screen, y down; {0,1} = from below)
 *  o.lowerFlat  0..1 flat lower lid             o.lashes  upper lashes (14), o.lashLen (in w)
 *  o.press      lashes squashed flat (against mesh / glove)
 *  o.lidSkin    skin colour of the lid ring ('#B98A78'), o.ring (ring width in w, 0.07; 0 = none)
 *  o.socket     darkness of the surrounding socket (0..1)
 *  o.lw         one final pixel in user units    o.seed
 * returns {ap, ix, iy, ir, h}
 */
function eyeShape(o) {
  const w = o.w, h = w * 0.38 * (o.open || 1), side = o.side || -1;
  const hU = h * 0.58, hL = h * 0.42;
  const ix0 = -side * w / 2, ox0 = side * w / 2;          // inner / outer corner x
  const iy0 = h * 0.06, oy0 = -h * 0.08;                    // inner corner lower, outer higher
  const N = 48, up = [], lo = [];
  const flat = o.lowerFlat || 0, eL = lerp(0.9, 0.32, flat);
  for (let i = 0; i <= N; i++) {
    const u = i / N, x = lerp(ix0, ox0, u), yb = lerp(iy0, oy0, u);
    up.push([x, yb - hU * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 0.85)]);
    lo.push([x, yb + hL * Math.pow(Math.sin(Math.PI * Math.pow(u, 1.12)), eL) * (1 - 0.18 * flat)]);
  }
  return { w, h, side, up, lo, ix0, ox0, iy0, oy0 };
}
/* per-pixel iris (device px canvas, centred): fibrous radial streaks, crypts,
 * collarette, limbal darkening, pupil with a soft edge */
function irisCanvas(ir, s, o, seed) {
  const D = Math.ceil(ir * 2 * s) + 4, c = mk(D, D), cg = c.getContext('2d'), id = cg.createImageData(D, D), d = id.data;
  const C = o.irisCol.map(hex2rgb), rp = o.pupil, rc = rp + (1 - rp) * 0.32, sd = hashStr(seed) % 100000;
  const K = o.streaks || 70;
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
    const dx = (x + 0.5 - D / 2) / s, dy = (y + 0.5 - D / 2) / s, rr = Math.hypot(dx, dy) / ir;
    if (rr > 1.02) continue;
    const th = Math.atan2(dy, dx), u = (th / TAU + 0.5) * K;
    // colour by radius: collarette (inner) -> mid -> outer
    let col;
    if (rr < rc) col = C[0].map((v, k) => lerp(v * 0.85, v, (rr - rp) / Math.max(1e-3, rc - rp)));
    else { const t = (rr - rc) / (1 - rc); col = C[0].map((v, k) => t < 0.45 ? lerp(v, C[1][k], t / 0.45) : lerp(C[1][k], C[2][k], (t - 0.45) / 0.55)); }
    // radial streaks (anisotropic noise: fast around, slow along the radius) and clumps
    const n1 = fbm(u, rr * 2.2, sd, 3), n2 = noise2(u * 0.18, rr * 3, sd + 50), n3 = noise2(u * 2.3, rr * 7, sd + 90);
    let b = 0.78 + 0.42 * n1 + 0.14 * n2 + 0.08 * n3;
    // collarette: a wavy brighter ring
    const crr = rc * (1 + 0.07 * Math.sin(th * 9 + 1.1) + 0.04 * Math.sin(th * 4 + 2.3));
    b += 0.28 * Math.exp(-Math.pow((rr - crr) / 0.045, 2));
    // crypts: dark pits between collarette and the outer third
    if (rr > rc && rr < 0.86) { const cn = noise2(u * 0.9, rr * 15, sd + 7); if (cn > 0.55) b *= 1 - 0.45 * sstep(0.55, 0.7, cn); }
    // limbal ring: the outer 10-15% darkens to near black
    b *= 1 - 0.88 * sstep(0.8, 1.0, rr);
    // furrows: faint concentric contraction rings
    b *= 1 - 0.08 * Math.max(0, Math.sin(rr * 42 + n2 * 2));
    let a = 1 - sstep(0.985, 1.02, rr);
    // pupil
    const pe = sstep(rp * 0.92, rp * 1.08 + 0.01, rr);
    const i = (y * D + x) * 4;
    d[i] = clamp(col[0] * b * pe + 4 * (1 - pe), 0, 255); d[i + 1] = clamp(col[1] * b * pe + 4 * (1 - pe), 0, 255); d[i + 2] = clamp(col[2] * b * pe + 5 * (1 - pe), 0, 255);
    d[i + 3] = 255 * a;
  }
  cg.putImageData(id, 0, 0);
  return { c, D };
}
/* grey noise canvas (128 mean) for 'overlay' texture, device px */
function noiseCanvas(w, h, seed, cell, amp) {
  const c = mk(w, h), cg = c.getContext('2d'), id = cg.createImageData(c.width, c.height), d = id.data, sd = hashStr(String(seed)) % 100000;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const v = 128 + amp * (0.6 * noise2(x / cell, y / cell, sd) + 0.4 * (hash2(x, y, sd + 1) * 2 - 1));
    const i = (y * c.width + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  cg.putImageData(id, 0, 0);
  return c;
}
function wetEye(g, o) {
  o = Object.assign({ open: 1, side: -1, rot: 0, iris: 0.2, irisDy: 0, gaze: [0, 0], pupil: 0.3,
    irisCol: ['#9C8A5E', '#6F7D72', '#2E3A3C'], fibres: 52, veins: 6, veinCol: '#C9A3A0',
    catch: { x: -0.32, y: -0.3, s: 0.34 }, light: { x: -0.4, y: -0.9 }, lowerFlat: 0,
    lashes: 14, lashLen: 0.1, press: 0, lidSkin: '#A8786A', ring: 0.1, socket: 0.4, lw: 1, seed: 'eye', scleraK: 1 }, o || {});
  const S = eyeShape(o), w = S.w, h = S.h, lw = o.lw, r = rng(o.seed + ':eye'), s = scaleOf(g);
  const apL = polyPath(S.up.concat(S.lo.slice().reverse()), true);       // eye-local aperture
  const ir = w * o.iris;
  const ix = o.gaze[0] * w, iy = o.gaze[1] * w + o.irisDy * h + (S.iy0 + S.oy0) / 2 + h * 0.02;
  const lx = o.light.x, ly = o.light.y;
  g.save();
  g.translate(o.cx, o.cy); g.rotate(o.rot || 0);
  // ---- socket shadow
  if (o.socket > 0) {
    const sg = g.createRadialGradient(0, 0, w * 0.32, 0, 0, w * 0.95);
    sg.addColorStop(0, `rgba(18,9,6,${o.socket})`); sg.addColorStop(0.6, `rgba(18,9,6,${o.socket * 0.45})`); sg.addColorStop(1, 'rgba(18,9,6,0)');
    g.fillStyle = sg; g.beginPath(); g.ellipse(0, -h * 0.05, w * 0.95, w * 0.72, 0, 0, TAU); g.fill();
  }
  // ---- eyelid skin around the aperture, fading into the felt (irregular edge)
  if (o.ring > 0) {
    const L = layerOf(g), lg = L.g, rw = w * o.ring;
    lg.fillStyle = '#000'; lg.strokeStyle = '#000'; lg.lineJoin = 'round';
    lg.lineWidth = rw * 1.6; lg.fill(apL); lg.stroke(apL);
    lg.save(); lg.setTransform(1, 0, 0, 1, 0, 0);
    const tmp = mk(L.c.width, L.c.height), tg = tmp.getContext('2d'); tg.filter = `blur(${(rw * 0.55 * s).toFixed(2)}px)`; tg.drawImage(L.c, 0, 0);
    lg.clearRect(0, 0, L.c.width, L.c.height); lg.drawImage(tmp, 0, 0);
    lg.restore();
    lg.globalCompositeOperation = 'source-in';
    const kg = lg.createLinearGradient(-lx * w * 0.5, -ly * w * 0.5, lx * w * 0.5, ly * w * 0.5);
    kg.addColorStop(0, mixc(o.lidSkin, '#000000', 0.55)); kg.addColorStop(0.55, o.lidSkin); kg.addColorStop(1, mixc(o.lidSkin, '#F0D0C0', 0.18));
    lg.fillStyle = kg; lg.fillRect(-w * 2, -w * 2, w * 4, w * 4);
    // skin texture
    lg.globalCompositeOperation = 'overlay'; lg.save(); lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.drawImage(noiseCanvas(L.c.width, L.c.height, o.seed + 'sk', 2.5 * lw * s / Math.max(1, s), 40), 0, 0); lg.restore();
    lg.globalCompositeOperation = 'source-atop';
    // upper lid fold: soft crease shadow with the lid's own convex highlight under it
    const crease = []; for (const [x, y] of S.up) crease.push([x * 1.04, y - h * 0.32 - h * 0.12 * Math.sin(Math.PI * (x / w + 0.5))]);
    lg.save(); lg.filter = `blur(${(h * 0.06 * s).toFixed(2)}px)`;
    lg.strokeStyle = 'rgba(30,12,8,0.75)'; lg.lineWidth = h * 0.09; lg.stroke(polyPath(crease, false));
    lg.translate(0, h * 0.12); lg.strokeStyle = `rgba(255,225,210,${0.1 + 0.15 * Math.max(0, -ly)})`; lg.lineWidth = h * 0.1; lg.stroke(polyPath(S.up, false));
    lg.restore();
    // lower lid: the lid's thickness catching the light, a tear-trough shadow below it
    lg.save(); lg.filter = `blur(${(h * 0.05 * s).toFixed(2)}px)`;
    lg.translate(0, h * 0.13); lg.strokeStyle = `rgba(255,220,205,${0.12 + 0.25 * Math.max(0, ly)})`; lg.lineWidth = h * 0.12; lg.stroke(polyPath(S.lo, false));
    lg.translate(0, h * 0.2); lg.strokeStyle = 'rgba(30,12,8,0.5)'; lg.lineWidth = h * 0.08; lg.stroke(polyPath(S.lo.slice(6, -4), false));
    lg.restore();
    // fine creases at the outer corner
    lg.strokeStyle = 'rgba(40,18,12,0.4)'; lg.lineWidth = lw * 0.9; lg.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const a = (k - 1.5) * 0.3 + (r() - 0.5) * 0.12, x0 = S.ox0 + S.side * w * 0.04, y0 = S.oy0 + h * 0.05, Ln = w * (0.07 + r() * 0.06);
      lg.beginPath(); lg.moveTo(x0, y0 + Math.sin(a) * w * 0.02);
      lg.quadraticCurveTo(x0 + S.side * Ln * 0.6, y0 + Math.sin(a) * Ln * 0.6 + h * 0.03, x0 + S.side * Ln, y0 + Math.sin(a) * Ln); lg.stroke();
    }
    lg.save(); lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalCompositeOperation = 'destination-in'; lg.filter = 'none'; lg.drawImage(tmp, 0, 0); lg.restore();
    blit(g, L.c);
  }
  // ---- eyeball, clipped to the aperture
  g.save(); g.clip(apL);
  const sk = o.scleraK;
  const sc = g.createRadialGradient(ix, iy, ir * 0.9, ix * 0.5, iy, w * 0.62);
  sc.addColorStop(0, mixc('#EDE6DA', '#000000', 1 - sk)); sc.addColorStop(0.45, mixc('#DED3C2', '#000000', 1 - sk));
  sc.addColorStop(0.8, mixc('#BBA996', '#000000', 1 - sk)); sc.addColorStop(1, mixc('#857161', '#000000', 1 - sk));
  g.fillStyle = sc; g.fillRect(-w, -h * 2, w * 2, h * 4);
  // pink corners, caruncle
  for (const [x, k, rr] of [[S.ix0, 1, 0.24], [S.ox0, 0.55, 0.2]]) {
    const pg = g.createRadialGradient(x, S.iy0, 0, x, S.iy0, w * rr);
    pg.addColorStop(0, `rgba(190,104,100,${0.85 * k})`); pg.addColorStop(0.45, `rgba(210,150,140,${0.35 * k})`); pg.addColorStop(1, 'rgba(210,150,140,0)');
    g.fillStyle = pg; g.fillRect(-w, -h * 2, w * 2, h * 4);
  }
  {   // caruncle: a small wet pink mound with its own highlight
    const cx = S.ix0 - S.side * -w * 0.045, cy = S.iy0 + h * 0.02;
    const cg = g.createRadialGradient(cx, cy - h * 0.03, 0, cx, cy, w * 0.05);
    cg.addColorStop(0, '#D89890'); cg.addColorStop(1, 'rgba(160,80,78,0)');
    g.fillStyle = cg; g.beginPath(); g.ellipse(cx, cy, w * 0.05, h * 0.14, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,240,235,0.7)'; g.beginPath(); g.ellipse(cx, cy + ly * h * 0.05, lw * 1.2, lw * 0.7, 0, 0, TAU); g.fill();
  }
  // sclera texture
  g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.35;
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(noiseCanvas(g.canvas.width, g.canvas.height, o.seed + 'sc', 6, 30), 0, 0); g.restore();
  // capillaries: branching, thin, grey-pink, from the corners toward the iris
  const vein = (x, y, a, len, wd, depth) => {
    let px = x, py = y;
    const n = Math.max(3, Math.round(len / (w * 0.022)));
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      a += (r() - 0.5) * 0.75;
      const nx = px + Math.cos(a) * len / n, ny = py + Math.sin(a) * len / n * 0.8;
      g.strokeStyle = rgba(r() < 0.35 ? mixc(o.veinCol, '#8E4E52', 0.4) : o.veinCol, (0.32 + r() * 0.2) * (1 - i / n * 0.45));
      g.lineWidth = Math.max(lw * 0.45, wd * (1 - i / n * 0.7));
      g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
      if (depth < 2 && r() < 0.3) vein(nx, ny, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6), len * (0.3 + r() * 0.3), wd * 0.6, depth + 1);
      px = nx; py = ny;
    }
  };
  for (let k = 0; k < o.veins; k++) {
    const inner = k % 2 === 0, x0 = inner ? S.ix0 : S.ox0;
    const sx = x0 > 0 ? 1 : -1;
    const x = x0 - sx * w * (0.03 + r() * 0.05), y = lerp(S.iy0, S.oy0, inner ? 0 : 1) + (r() - 0.5) * h * 0.55;
    const a = (sx > 0 ? Math.PI : 0) + (r() - 0.5) * 0.9;
    vein(x, y, a, w * (0.15 + r() * 0.14), lw * (1.15 + r() * 0.5), 0);
  }
  // sclera lighting: the far side and the upper lid's occlusion darker
  {
    const lg = g.createLinearGradient(-lx * h, -ly * h, lx * h, ly * h);
    lg.addColorStop(0, 'rgba(25,12,8,0.55)'); lg.addColorStop(0.55, 'rgba(25,12,8,0.08)'); lg.addColorStop(1, 'rgba(255,250,240,0.04)');
    g.fillStyle = lg; g.fillRect(-w, -h * 2, w * 2, h * 4);
  }
  // ---- iris (per-pixel), cornea sheen, window catchlight
  const IC = irisCanvas(ir, s, o, o.seed + ':iris');
  g.save(); g.translate(ix, iy); g.rotate(-(o.rot || 0));
  g.drawImage(IC.c, -IC.D / 2 / s, -IC.D / 2 / s, IC.D / s, IC.D / s);
  // iris shading: the side away from the light falls off, the cornea glows on the light side
  g.save(); g.beginPath(); g.arc(0, 0, ir, 0, TAU); g.clip();
  const il = g.createLinearGradient(-lx * ir, -ly * ir, lx * ir, ly * ir);
  il.addColorStop(0, 'rgba(0,0,0,0.55)'); il.addColorStop(0.55, 'rgba(0,0,0,0.05)'); il.addColorStop(1, 'rgba(255,240,215,0.12)');
  g.fillStyle = il; g.fillRect(-ir, -ir, ir * 2, ir * 2);
  const cgl = g.createRadialGradient(lx * ir * 0.6, ly * ir * 0.6, 0, lx * ir * 0.6, ly * ir * 0.6, ir * 0.75);
  cgl.addColorStop(0, 'rgba(255,248,236,0.2)'); cgl.addColorStop(1, 'rgba(255,248,236,0)');
  g.fillStyle = cgl; g.fillRect(-ir, -ir, ir * 2, ir * 2);
  g.restore();
  if (o.catch) {
    const c = o.catch, cx = c.x * ir, cy = c.y * ir, sz = c.s * ir, ww = sz, hh = sz * 0.85, bar = Math.max(lw * 0.7, ww * 0.09);
    g.save();
    g.filter = `blur(${(sz * 0.2 * s).toFixed(2)}px)`;
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(cx, cy, ww * 0.8, hh * 0.8, 0, 0, TAU); g.fill();
    g.filter = 'none';
    g.fillStyle = 'rgba(255,255,253,0.98)';
    const pw = (ww - bar) / 2, ph = (hh - bar) / 2;
    for (const [qx, qy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const x0 = cx - ww / 2 + qx * (pw + bar), y0 = cy - hh / 2 + qy * (ph + bar);
      g.beginPath(); g.roundRect(x0, y0, pw, ph, Math.min(pw, ph) * 0.25); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(-cx * 0.5 + ir * 0.22, -cy * 0.5 + ir * 0.34, Math.max(lw * 0.6, ir * 0.045), 0, TAU); g.fill();
    g.restore();
  }
  g.restore();
  // shadow of the upper lid margin and lashes on the eyeball
  g.save(); g.filter = `blur(${(h * 0.06 * s).toFixed(2)}px)`;
  g.strokeStyle = 'rgba(12,5,3,0.7)'; g.lineWidth = h * 0.12; g.stroke(polyPath(S.up, false)); g.restore();
  // tear film: tiny specks of light
  for (let k = 0; k < 5; k++) {
    const x = (r() - 0.5) * w * 0.7, y = ly * h * (0.1 + r() * 0.15);
    g.fillStyle = `rgba(255,255,255,${0.12 + r() * 0.15})`; g.beginPath(); g.ellipse(x, y, lw * (0.8 + r()), lw * 0.45, 0, 0, TAU); g.fill();
  }
  g.restore();      // aperture clip
  // ---- lid margins
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.save();
  // lower lid margin (pink-brown band) and the wet waterline along its inner edge
  g.strokeStyle = rgba(mixc(o.lidSkin, '#B0605A', 0.5), 0.95); g.lineWidth = Math.max(lw * 1.8, h * 0.05);
  g.translate(0, Math.max(lw * 1.3, h * 0.03)); g.stroke(polyPath(S.lo.slice(3, -3), false));
  g.translate(0, -Math.max(lw * 1.3, h * 0.03));
  g.strokeStyle = 'rgba(255,248,240,0.92)'; g.lineWidth = Math.max(lw * 1.0, h * 0.016);
  g.translate(0, -lw * 0.1); g.stroke(polyPath(S.lo.slice(5, -6), false));
  g.restore();
  // upper lash line: thin and dark, a little heavier toward the outer corner
  g.save();
  for (let i = 1; i < S.up.length; i++) {
    const u = i / (S.up.length - 1), a = S.up[i - 1], b = S.up[i];
    g.strokeStyle = 'rgba(14,7,5,0.95)'; g.lineWidth = Math.max(lw * 1.3, h * lerp(0.03, 0.055, u));
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
  g.restore();
  // lashes: irregular single hairs, longer toward the outer corner
  const rl = rng(o.seed + ':lash');
  g.save(); g.strokeStyle = 'rgba(14,8,6,0.9)';
  for (let k = 0; k < o.lashes; k++) {
    const u = 0.14 + 0.84 * (k + rl() * 0.85) / o.lashes, idx = Math.round(u * (S.up.length - 1));
    const [bx, by] = S.up[idx];
    const Ln = w * o.lashLen * (0.5 + 0.65 * u) * (0.7 + rl() * 0.6);
    let a = -Math.PI / 2 + S.side * (0.2 + 0.85 * u) + (rl() - 0.5) * 0.4;
    if (o.press) a = lerp(a, -Math.PI / 2 + S.side * 1.4, o.press);
    const bend = S.side * (0.35 + rl() * 0.35) * (o.press ? 1.5 : 1);
    g.lineWidth = Math.max(lw * 0.5, w * 0.005 * (0.8 + rl() * 0.6));
    g.beginPath(); g.moveTo(bx, by);
    g.quadraticCurveTo(bx + Math.cos(a) * Ln * 0.55, by + Math.sin(a) * Ln * 0.55, bx + Math.cos(a + bend) * Ln, by + Math.sin(a + bend) * Ln);
    g.stroke();
  }
  for (let k = 0; k < Math.round(o.lashes * 0.4); k++) {
    const u = 0.35 + 0.6 * rl(), idx = Math.round(u * (S.lo.length - 1));
    const [bx, by] = S.lo[idx], Ln = w * o.lashLen * 0.32 * (0.6 + rl() * 0.6);
    const a = Math.PI / 2 + S.side * (0.25 + 0.5 * u) + (rl() - 0.5) * 0.3;
    g.lineWidth = Math.max(lw * 0.4, w * 0.0035); g.strokeStyle = 'rgba(20,10,8,0.55)';
    const y0 = by + Math.max(lw * 2.2, h * 0.05);
    g.beginPath(); g.moveTo(bx, y0); g.lineTo(bx + Math.cos(a) * Ln, y0 + Math.sin(a) * Ln); g.stroke();
  }
  g.restore();
  g.restore();
  const m = new DOMMatrix().translate(o.cx, o.cy).rotate((o.rot || 0) / DEG);
  const ap = new Path2D(); ap.addPath(apL, m);
  const cI = m.transformPoint(new DOMPoint(ix, iy));
  return { ap, ix: cI.x, iy: cI.y, ir, h, w, shape: S, m };
}

/* ================================================================ TEETH
 * teethRow(g, o) - real human teeth along a gum line (user space).
 *  o.line   [[x,y],...] gum line, left to right
 *  o.dir    +1: teeth hang DOWN from the line (upper jaw), -1: stand UP (lower jaw)
 *  o.n      teeth on the row (14); o.len incisor length; o.wide [left, right] fraction of the line used
 *  o.lower  true: lower-jaw proportions (narrow incisors)
 *  o.gum    gum band height (0 = none); o.gumCol, o.persp (0..1 foreshortening toward the corners)
 *  o.dark   0..1 darken (back rows); o.lw; o.seed; o.chip
 * returns [{x, y, a, w, L}] tooth placements.
 */
const UPPER_W = [1.6, 1.0, 1.12, 0.98, 0.95, 1.25, 1.2, 1.15, 1.1, 1.05, 1.0, 1.0];
const LOWER_W = [0.95, 1.0, 1.12, 1.05, 1.05, 1.3, 1.25, 1.2, 1.1, 1.05, 1.0, 1.0];
const UPPER_L = [1.0, 0.86, 1.04, 0.82, 0.76, 0.66, 0.6, 0.56, 0.52, 0.5, 0.48, 0.46];
const LOWER_L = [0.8, 0.82, 0.9, 0.72, 0.68, 0.6, 0.55, 0.5, 0.48, 0.46, 0.44, 0.42];
function layoutTeeth(line, n, persp, lower, r, jit) {
  const L = arcLen(line), half = L / 2, per = Math.ceil(n / 2);
  const W = lower ? LOWER_W : UPPER_W;
  const pf = t => 1 - persp * Math.pow(Math.min(1, t), 1.5);
  // solve the unit width so `per` teeth fill each half of the line
  let lo = 0, hi = L, unit = 0;
  for (let it = 0; it < 40; it++) {
    unit = (lo + hi) / 2; let s = 0;
    for (let k = 0; k < per; k++) s += W[Math.min(k, W.length - 1)] * unit * pf(s / half);
    if (s > half) hi = unit; else lo = unit;
  }
  const out = [];
  for (const sd of [-1, 1]) {
    let s = 0;
    for (let k = 0; k < per; k++) {
      if (sd > 0 && n % 2 === 1 && k === per - 1) break;
      const wk = W[Math.min(k, W.length - 1)] * unit * pf(s / half) * (1 + (r() - 0.5) * jit);
      const c = half + sd * (s + wk / 2);
      out.push({ s: c, w: wk, k, sd, t: (s + wk / 2) / half, pf: pf((s + wk / 2) / half) });
      s += wk;
    }
  }
  return out;
}
function toothPath(w, L, k, lower, r) {
  // local frame: x across (−w/2..w/2), y from the gum (0, hidden above) to the edge (L)
  const p = new Path2D(), cw = w * (lower ? 0.72 : 0.76), top = -L * 0.35;
  const cr = w * (k === 0 ? 0.16 : k === 1 ? 0.24 : 0.3);
  const cusp = (k === 2 ? 0.1 : 0) * L;          // canine: a blunt point (never a fang)
  const bulge = w * 0.02;
  p.moveTo(-cw / 2, top);
  p.bezierCurveTo(-w * 0.5 - bulge, L * 0.25, -w * 0.52, L * 0.6, -w * 0.5, L - cr);
  p.quadraticCurveTo(-w * 0.5, L + cusp * 0.2, -w * 0.5 + cr, L + cusp * 0.4);
  p.quadraticCurveTo(0, L + cusp + L * 0.02 * (r() - 0.3), w * 0.5 - cr, L + cusp * 0.4);
  p.quadraticCurveTo(w * 0.5, L + cusp * 0.2, w * 0.5, L - cr);
  p.bezierCurveTo(w * 0.52, L * 0.6, w * 0.5 + bulge, L * 0.25, cw / 2, top);
  p.closePath();
  return p;
}
function teethRow(g, o) {
  o = Object.assign({ dir: 1, n: 14, len: 30, lower: false, gum: 0, persp: 0.45, dark: 0, lw: 1, seed: 'teeth', jit: 0.12,
    gumCol: ['#D9A3A0', '#C98C8C', '#8E5258'], gap: '#2A2320', edge: '#9DA6AE' }, o || {});
  const r = rng(o.seed + ':teeth'), line = o.line, lw = o.lw;
  const lay = layoutTeeth(line, o.n, o.persp, o.lower, r, o.jit);
  const Ls = o.lower ? LOWER_L : UPPER_L;
  const placed = [];
  g.save();
  // the row's footprint, filled grey first so gaps between teeth read grey, not black
  for (const t of lay) {
    const [x, y, a] = along(line, t.s);
    const L = o.len * Ls[Math.min(t.k, Ls.length - 1)] * Math.pow(t.pf, 0.7) * (1 + (r() - 0.5) * 0.14);
    const tilt = (r() - 0.5) * 0.08 + t.sd * t.t * 0.06;
    const shift = (r() - 0.5) * t.w * 0.08;
    placed.push({ x, y, a, w: t.w, L, k: t.k, sd: t.sd, tilt, shift, pf: t.pf, t: t.t, chip: o.chip && r() < 0.12 });
  }
  const frame = (p) => { g.translate(p.x, p.y); g.rotate(p.a + (o.dir > 0 ? 0 : Math.PI) + p.tilt); g.translate(p.shift, 0); };
  for (const p of placed) {
    g.save(); frame(p);
    g.fillStyle = o.gap; g.fillRect(-p.w * 0.55, -p.L * 0.3, p.w * 1.1, p.L * 0.95);
    g.restore();
  }
  // draw from the back (corners) to the front (centre) so incisors overlap
  const order = placed.slice().sort((a, b) => b.t - a.t);
  for (const p of order) {
    const rr = rng(o.seed + ':t' + p.sd + ':' + p.k);
    g.save(); frame(p);
    const tp = toothPath(p.w, p.L, p.k, o.lower, rr);
    // soft contact shadow behind each tooth
    g.save(); g.fillStyle = 'rgba(0,0,0,0.45)'; g.translate(p.sd * p.w * 0.06, p.L * 0.03); g.fill(tp); g.restore();
    g.save(); g.clip(tp);
    const yel = rr() * 0.25 + (p.k > 4 ? 0.15 : 0);
    const base = g.createLinearGradient(0, -p.L * 0.35, 0, p.L);
    base.addColorStop(0, mixc('#B9A27A', '#8E7A58', yel)); base.addColorStop(0.28, mixc('#D8CAA8', '#C7B48C', yel));
    base.addColorStop(0.58, mixc('#E8DFC8', '#DCCFAE', yel)); base.addColorStop(0.84, '#DAD6CB'); base.addColorStop(1, o.edge);
    g.fillStyle = base; g.fillRect(-p.w, -p.L, p.w * 2, p.L * 2.2);
    // curvature across the face: edges fall into shadow
    const cv = g.createLinearGradient(-p.w / 2, 0, p.w / 2, 0);
    cv.addColorStop(0, 'rgba(45,32,22,0.55)'); cv.addColorStop(0.22, 'rgba(45,32,22,0.06)'); cv.addColorStop(0.62, 'rgba(45,32,22,0)'); cv.addColorStop(1, 'rgba(45,32,22,0.5)');
    g.fillStyle = cv; g.fillRect(-p.w, -p.L, p.w * 2, p.L * 2.2);
    // translucent incisal edge (bluish grey) with a thin bright halo
    const te = g.createLinearGradient(0, p.L * 0.72, 0, p.L * 1.02);
    te.addColorStop(0, 'rgba(150,165,180,0)'); te.addColorStop(0.7, 'rgba(140,155,172,0.42)'); te.addColorStop(1, 'rgba(120,135,150,0.25)');
    g.fillStyle = te; g.fillRect(-p.w, p.L * 0.6, p.w * 2, p.L * 0.6);
    g.strokeStyle = 'rgba(245,245,240,0.55)'; g.lineWidth = Math.max(lw * 0.6, p.w * 0.03);
    g.beginPath(); g.moveTo(-p.w * 0.36, p.L * 0.985); g.quadraticCurveTo(0, p.L * 1.01, p.w * 0.36, p.L * 0.985); g.stroke();
    // perikymata: faint horizontal growth lines
    g.strokeStyle = 'rgba(120,100,70,0.035)'; g.lineWidth = lw * 0.5;
    for (let i = 0; i < 4; i++) { const yy = p.L * (0.22 + i * 0.15 + rr() * 0.05); g.beginPath(); g.moveTo(-p.w / 2, yy); g.quadraticCurveTo(0, yy + p.L * 0.02, p.w / 2, yy); g.stroke(); }
    // teeth further back sit in the mouth's shadow
    g.fillStyle = `rgba(0,0,0,${0.55 * Math.pow(p.t, 1.6)})`; g.fillRect(-p.w, -p.L, p.w * 2, p.L * 2.2);
    // wet labial highlight (soft vertical streak + a crisp fleck)
    const hx = -p.w * (0.14 + rr() * 0.08) * p.sd;
    const hg = g.createLinearGradient(hx - p.w * 0.12, 0, hx + p.w * 0.12, 0);
    hg.addColorStop(0, 'rgba(255,255,250,0)'); hg.addColorStop(0.5, 'rgba(255,255,250,0.35)'); hg.addColorStop(1, 'rgba(255,255,250,0)');
    g.fillStyle = hg; g.fillRect(hx - p.w * 0.12, p.L * 0.12, p.w * 0.24, p.L * 0.66);
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(hx, p.L * 0.42, Math.max(lw * 0.6, p.w * 0.035), p.L * 0.12, 0, 0, TAU); g.fill();
    if (p.chip) { g.fillStyle = o.gap; g.beginPath(); g.moveTo(p.w * 0.5, p.L * 0.8); g.lineTo(p.w * 0.18, p.L * 1.05); g.lineTo(p.w * 0.6, p.L * 1.05); g.fill(); }
    g.restore();
    // a hair-thin dark outline on the sides (interproximal)
    g.strokeStyle = 'rgba(30,22,18,0.55)'; g.lineWidth = Math.max(lw * 0.5, p.w * 0.02); g.stroke(tp);
    g.restore();
  }
  // gums: a scalloped band over the cervical ends, papillae pointing between teeth
  let gumPath = null;
  if (o.gum > 0) {
    const N = 160, Lt = arcLen(line), mar = [], outer = [];
    const bounds = placed.map(p => ({ s: null, p })).sort((a, b) => a.p.x - b.p.x);
    for (let i = 0; i <= N; i++) {
      const s = Lt * i / N, [x, y, a] = along(line, s), nx = -Math.sin(a) * o.dir, ny = Math.cos(a) * o.dir;
      // nearest tooth: scallop depth from its centre
      let best = null, bd = 1e9;
      for (const p of placed) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }
      const u = best ? clamp(bd / (best.w / 2), 0, 1) : 1;            // 0 at the tooth centre, 1 between teeth
      const sc = o.gum * (0.02 + 0.62 * Math.pow(u, 3.0)) * (best ? Math.pow(best.pf, 0.5) : 1);
      mar.push([x + nx * sc, y + ny * sc]);
      outer.push([x - nx * o.gum * 0.9, y - ny * o.gum * 0.9]);
    }
    gumPath = polyPath(mar.concat(outer.reverse()), true);
    g.save();
    // shadow the gum casts onto the necks of the teeth
    g.save(); g.filter = `blur(${(o.gum * 0.18 * scaleOf(g)).toFixed(2)}px)`; g.fillStyle = 'rgba(30,10,10,0.6)';
    g.translate(0, o.dir * o.gum * 0.12); g.fill(gumPath); g.restore();
    g.fillStyle = o.gumCol[1]; g.fill(gumPath);
    g.save(); g.clip(gumPath);
    // darker toward the lip, lighter and wetter at the margin (stroked bands along the line)
    const lineP = polyPath(line, false);
    g.lineJoin = 'round';
    for (const [off, wd, col] of [[-0.85, 0.9, rgba(o.gumCol[2], 0.85)], [-0.55, 0.5, rgba(o.gumCol[2], 0.4)], [0.25, 0.45, rgba(o.gumCol[0], 0.55)]]) {
      g.save(); g.filter = `blur(${(o.gum * 0.2 * scaleOf(g)).toFixed(2)}px)`; g.translate(0, off * o.gum * o.dir); g.strokeStyle = col; g.lineWidth = o.gum * wd; g.stroke(lineP); g.restore();
    }
    // vertical alveolar ridges over each root
    for (const p of placed) {
      g.save(); g.translate(p.x, p.y); g.rotate(p.a + (o.dir > 0 ? 0 : Math.PI));
      const rg = g.createLinearGradient(-p.w * 0.5, 0, p.w * 0.5, 0);
      rg.addColorStop(0, 'rgba(80,25,35,0.22)'); rg.addColorStop(0.5, 'rgba(255,200,200,0.12)'); rg.addColorStop(1, 'rgba(80,25,35,0.22)');
      g.fillStyle = rg; g.fillRect(-p.w * 0.5, -o.gum, p.w, o.gum * 1.1);
      g.restore();
    }
    g.restore();
    // stippled gum texture
    g.save(); g.clip(gumPath);
    const rs = rng(o.seed + ':stip');
    for (let i = 0; i < Math.round(Lt * o.gum / (lw * lw * 6)); i++) {
      const s = rs() * Lt, [x, y, a] = along(line, s), d = (rs() - 0.3) * o.gum;
      g.fillStyle = rs() < 0.5 ? 'rgba(255,220,220,0.1)' : 'rgba(90,30,40,0.12)';
      g.fillRect(x + Math.sin(a) * d * o.dir, y - Math.cos(a) * d * o.dir, lw * 0.8, lw * 0.8);
    }
    g.restore();
    // wet highlight along the scalloped margin, broken
    const rh = rng(o.seed + ':wet');
    g.lineCap = 'round';
    for (let i = 2; i < mar.length - 3; i += 3) {
      if (rh() < 0.3) continue;
      const a = mar[i], b = mar[i + 2];
      g.strokeStyle = `rgba(255,236,236,${0.35 + rh() * 0.4})`; g.lineWidth = Math.max(lw * 0.7, o.gum * 0.06);
      g.beginPath(); g.moveTo(a[0], a[1] - o.dir * lw * 1.2); g.lineTo(b[0], b[1] - o.dir * lw * 1.2); g.stroke();
    }
    g.restore();
  }
  // back rows: darken everything just drawn (caller isolates the row on a layer)
  g.restore();
  return { placed, gumPath };
}

/* ============================================================ SKIN PATCH
 * skinPatch(g, o): skin showing through felt worn thin (user space).
 *  o.cx, o.cy, o.rx, o.ry, o.rot; o.skin ['#C9977F', '#9C6A5C'], o.vein ('#4E6E9E'), o.veinA (0.12)
 *  o.felt (felt colour for the frayed rim), o.lw, o.seed, o.light ({x,y} toward the light)
 * Pores are rasterised at device resolution (1 final px dots at two scales).
 */
function skinPatch(g, o) {
  o = Object.assign({ rot: 0, skin: ['#CC9C86', '#9E6C5E'], vein: '#4E6E9E', veinA: 0.12, felt: '#D8C8A8', lw: 1, seed: 'skin', light: { x: 0, y: 1 }, fray: 1 }, o || {});
  const s = scaleOf(g), r = rng(o.seed + ':skin');
  const pad = Math.max(o.rx, o.ry) * 0.35;
  const W = Math.ceil((o.rx + pad) * 2 * s), H = Math.ceil((o.ry + pad) * 2 * s);
  const c = mk(W, H), cg = c.getContext('2d');
  const k = s, cx = W / 2, cy = H / 2, rx = o.rx * k, ry = o.ry * k;
  // ragged outline
  const pts = [], N = 90;
  for (let i = 0; i < N; i++) {
    const a = i / N * TAU, n = 1 + 0.12 * noise1(i * 0.35, hashStr(o.seed) % 999) + 0.05 * (r() - 0.5);
    pts.push([cx + Math.cos(a) * rx * n, cy + Math.sin(a) * ry * n]);
  }
  const out = polyPath(pts, true);
  cg.save(); cg.clip(out);
  const sg = cg.createRadialGradient(cx - o.light.x * rx * 0.3, cy + o.light.y * ry * 0.3, 0, cx, cy, Math.max(rx, ry) * 1.1);
  sg.addColorStop(0, o.skin[0]); sg.addColorStop(1, o.skin[1]);
  cg.fillStyle = sg; cg.fillRect(0, 0, W, H);
  // faint blue veins under the skin
  cg.save(); cg.filter = `blur(${(1.2 * k / Math.max(1, s / 2)).toFixed(2)}px)`;
  for (let v = 0; v < 3; v++) {
    let x = cx + (r() - 0.5) * rx, y = cy + (r() - 0.5) * ry, a = r() * TAU;
    cg.strokeStyle = rgba(o.vein, o.veinA * (0.8 + r() * 0.5)); cg.lineWidth = (1.2 + r() * 1.2) * o.lw * k;
    cg.beginPath(); cg.moveTo(x, y);
    for (let i = 0; i < 9; i++) { a += (r() - 0.5) * 0.8; x += Math.cos(a) * rx * 0.18; y += Math.sin(a) * ry * 0.18; cg.lineTo(x, y); }
    cg.stroke();
  }
  cg.restore();
  cg.restore();
  // pores and mottling at two scales (pixel level)
  const id = cg.getImageData(0, 0, W, H), d = id.data, seed = hashStr(o.seed) % 100000;
  const fine = o.lw * k;                         // one final pixel in device px
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; if (!d[i + 3]) continue;
    const m = 1 + 0.07 * noise2(x / (6 * fine), y / (6 * fine), seed) + 0.04 * noise2(x / (2 * fine), y / (2 * fine), seed + 5);
    let p = 1;
    const cxp = Math.floor(x / (2.2 * fine)), cyp = Math.floor(y / (2.2 * fine));
    const hp = hash2(cxp, cyp, seed + 9);
    if (hp < 0.22) {      // a pore in this cell
      const px = (cxp + 0.2 + 0.6 * hash2(cxp, cyp, seed + 11)) * 2.2 * fine, py = (cyp + 0.2 + 0.6 * hash2(cxp, cyp, seed + 12)) * 2.2 * fine;
      const dd = Math.hypot(x - px, y - py) / (0.6 * fine);
      if (dd < 1) p = 0.72 + 0.28 * dd;
      else if (dd < 1.8 && y < py) p = 1.06;
    }
    const cxq = Math.floor(x / (5 * fine)), cyq = Math.floor(y / (5 * fine));
    if (hash2(cxq, cyq, seed + 21) < 0.3) {
      const qx = (cxq + 0.5) * 5 * fine, qy = (cyq + 0.5) * 5 * fine, dq = Math.hypot(x - qx, y - qy) / (1.1 * fine);
      if (dq < 1) p *= 0.8 + 0.2 * dq;
    }
    const f = m * p;
    d[i] = clamp(d[i] * f, 0, 255); d[i + 1] = clamp(d[i + 1] * f, 0, 255); d[i + 2] = clamp(d[i + 2] * f, 0, 255);
  }
  cg.putImageData(id, 0, 0);
  // inner shadow under the felt rim (the felt has thickness)
  cg.save(); cg.clip(out);
  cg.filter = `blur(${(3 * fine).toFixed(2)}px)`; cg.strokeStyle = 'rgba(30,15,10,0.7)'; cg.lineWidth = 6 * fine; cg.stroke(out);
  cg.restore();
  // frayed felt rim: fibres crossing the edge, pills
  if (o.fray) {
    const edge = resample(pts, 1.6 * fine, true);
    cg.lineCap = 'round';
    for (const [x, y, a] of edge) {
      const nx = Math.sin(a), ny = -Math.cos(a);     // outward normal for CCW? test both signs
      const dir = ((x - cx) * nx + (y - cy) * ny) > 0 ? 1 : -1;
      for (let q = 0; q < 2; q++) {
        const L = (2 + r() * 6) * fine, b = (r() - 0.5) * 1.2;
        const ex = x - dir * nx * L * (0.4 + r() * 0.6), ey = y - dir * ny * L * (0.4 + r() * 0.6);
        cg.strokeStyle = r() < 0.5 ? rgba(o.felt, 0.55 + r() * 0.4) : rgba(mixc(o.felt, '#000000', 0.35), 0.5);
        cg.lineWidth = (0.4 + r() * 0.5) * fine;
        cg.beginPath(); cg.moveTo(x + dir * nx * fine * 2, y + dir * ny * fine * 2);
        cg.quadraticCurveTo(lerp(x, ex, 0.5) + b * fine * 2, lerp(y, ey, 0.5) - b * fine * 2, ex, ey); cg.stroke();
      }
      if (r() < 0.06) {
        const pr = (1 + r() * 1.2) * fine, px = x + dir * nx * pr * 0.5, py = y + dir * ny * pr * 0.5;
        const pg = cg.createRadialGradient(px - pr * 0.3, py - pr * 0.3, 0, px, py, pr);
        pg.addColorStop(0, mixc(o.felt, '#ffffff', 0.15)); pg.addColorStop(1, mixc(o.felt, '#000000', 0.4));
        cg.fillStyle = pg; cg.beginPath(); cg.arc(px, py, pr, 0, TAU); cg.fill();
      }
    }
  }
  g.save(); g.translate(o.cx, o.cy); g.rotate(o.rot);
  g.drawImage(c, -W / 2 / s, -H / 2 / s, W / s, H / s);
  g.restore();
  const p2 = new Path2D(); p2.addPath(out, new DOMMatrix().translate(o.cx, o.cy).rotate(o.rot / DEG).scale(1 / s).translate(-W / 2, -H / 2));
  return p2;
}

/* ============================================================== RELIEF
 * relief(o) - light a height field (device px).
 *  o.W, o.H; o.h Float32Array heights (px); o.albedo ImageData (RGBA, alpha kept)
 *  o.light {x, y, z, col:[r,g,b], power, d0 (falloff distance), hard (0..1), wrap}
 *  o.fill  optional second light (same fields), o.ambient [r,g,b], o.cavity k, o.cavityR,
 *  o.shadow {steps, soft, bias}, o.spec Float32Array (gloss 0..1) or null, o.specK
 * returns ImageData (lit) and o.L (Float32Array of the key light term) for overlays.
 */
function relief(o) {
  const W = o.W, H = o.H, h = o.h, n = W * H;
  const alb = o.albedo.data, out = new ImageData(W, H), d = out.data;
  // cavity (ambient occlusion from the blurred height)
  const bl = new Float32Array(h); fblur(bl, W, H, o.cavityR || 18);
  const keyL = new Float32Array(n);
  const lights = [o.light].concat(o.fill ? [o.fill] : []);
  const amb = o.ambient || [0.03, 0.03, 0.035], ck = o.cavity === undefined ? 0.02 : o.cavity;
  const sh = Object.assign({ steps: 48, soft: 10, bias: 1.5, maxDist: 600 }, o.shadow || {});
  let hmax = 0; for (let i = 0; i < n; i++) if (h[i] > hmax) hmax = h[i];
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (alb[i * 4 + 3] === 0) continue;
      const hz = h[i];
      let nx = -(h[i + 1] - h[i - 1]) * 0.5, ny = -(h[i + W] - h[i - W]) * 0.5, nz = 1;
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const ao = clamp(1 - Math.max(0, bl[i] - hz) * ck, 0.15, 1);
      let R = amb[0] * ao, G = amb[1] * ao, B = amb[2] * ao;
      for (let li = 0; li < lights.length; li++) {
        const Lt = lights[li];
        let lx = Lt.x - x, ly = Lt.y - y, lz = Lt.z - hz;
        const dist = Math.hypot(lx, ly, lz); lx /= dist; ly /= dist; lz /= dist;
        let lam = nx * lx + ny * ly + nz * lz;
        const wrap = Lt.wrap || 0;
        lam = (lam + wrap) / (1 + wrap);
        if (lam <= 0) continue;
        if (Lt.hard) lam = lerp(lam, sstep(0.02, 0.02 + (1 - Lt.hard) * 0.5 + 0.03, lam), Lt.hard);
        // cast shadow: march toward the light through the height field
        let vis = 1;
        if (li === 0 || Lt.shadow) {
          const len2 = Math.hypot(lx, ly) || 1e-6, stepPx = 1.5;
          const dzs = lz / len2;                // height gained per px travelled
          let t = 2, minr = 1;
          for (let s = 0; s < sh.steps; s++) {
            const sx = x + lx / len2 * t, sy = y + ly / len2 * t;
            if (sx < 0 || sy < 0 || sx >= W - 1 || sy >= H - 1) break;
            const zr = hz + dzs * t;
            if (zr > hmax + 2) break;
            const hs = h[(sy | 0) * W + (sx | 0)];
            const diff = zr - hs - sh.bias;
            if (diff < 0) { minr = 0; break; }
            minr = Math.min(minr, sh.soft * diff / t);
            t += stepPx * (1 + s * 0.08);
            if (t > sh.maxDist) break;
          }
          vis = clamp(minr, 0, 1);
        }
        const fall = 1 / (1 + Math.pow(dist / (Lt.d0 || 400), 2));
        const k = lam * vis * fall * (Lt.power || 1);
        if (li === 0) keyL[i] = k;
        R += Lt.col[0] * k; G += Lt.col[1] * k; B += Lt.col[2] * k;
      }
      const j = i * 4;
      d[j] = clamp(alb[j] * R, 0, 255); d[j + 1] = clamp(alb[j + 1] * G, 0, 255); d[j + 2] = clamp(alb[j + 2] * B, 0, 255); d[j + 3] = alb[j + 3];
      if (o.spec && o.spec[i] > 0) {
        // Blinn-Phong highlight of the key light (viewer straight on)
        const Lt = lights[0]; let lx = Lt.x - x, ly = Lt.y - y, lz = Lt.z - hz; const dl = Math.hypot(lx, ly, lz); lx /= dl; ly /= dl; lz /= dl;
        let hx = lx, hy = ly, hzv = lz + 1; const hl = Math.hypot(hx, hy, hzv); hx /= hl; hy /= hl; hzv /= hl;
        const sp = Math.pow(Math.max(0, nx * hx + ny * hy + nz * hzv), o.specPow || 60) * o.spec[i] * (o.specK || 255) * (keyL[i] > 0 ? 1 : 0.2);
        d[j] = clamp(d[j] + sp, 0, 255); d[j + 1] = clamp(d[j + 1] + sp, 0, 255); d[j + 2] = clamp(d[j + 2] + sp * 0.95, 0, 255);
      }
    }
  }
  return { img: out, key: keyL };
}

/* ============================================================== HATCH
 * hatch(g, lum, W, H, o) - Junji-Ito hatching in the shadow band (device px,
 * identity transform). Strokes come in small parallel clusters.
 *  o.seed (re-seed for the boil frame), o.n (strokes), o.angles [rad], o.band [lo, peak, hi] luma,
 *  o.mask Float32Array (0..1) or null, o.len [min, max], o.w line width (device px), o.ink rgba prefix,
 *  o.alpha [min, max], o.cluster [min, max], o.gap, o.lite (fraction of light scratch strokes in the deep shadow)
 */
function hatch(g, lum, W, H, o) {
  o = Object.assign({ n: 420, angles: [-0.9, -0.55, 0.75], band: [0.03, 0.14, 0.42], len: [14, 40], w: 2, alpha: [0.45, 0.85],
    cluster: [4, 8], gap: 5, ink: '10,6,4', lite: 0.18, liteInk: '170,150,130', liteBand: [0.005, 0.05], seed: 'hatch' }, o || {});
  const r = rng(o.seed + ':hatch');
  const band = (l) => l < o.band[0] || l > o.band[2] ? 0 : (l < o.band[1] ? (l - o.band[0]) / (o.band[1] - o.band[0]) : 1 - (l - o.band[1]) / (o.band[2] - o.band[1]));
  const liteB = (l) => l >= o.liteBand[0] && l <= o.liteBand[1] ? 1 : 0;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.lineCap = 'round';
  let made = 0, tries = 0;
  const nLite = Math.round(o.n * o.lite);
  while (made < o.n && tries < o.n * 400) {
    tries++;
    const x = r() * W, y = r() * H, i = (y | 0) * W + (x | 0);
    const lite = made >= o.n - nLite;
    const m = o.mask ? o.mask[i] : 1;
    if (m <= 0) continue;
    const p = (lite ? liteB(lum[i]) * 0.5 : band(lum[i])) * m;
    if (r() > p) continue;
    const a = r.pick(o.angles) + (r() - 0.5) * 0.12;
    const ca = Math.cos(a), sa = Math.sin(a), nxv = -sa, nyv = ca;
    const k = Math.min(o.n - made, r.int(o.cluster[0], o.cluster[1]));
    const baseL = r.range(o.len[0], o.len[1]);
    for (let j = 0; j < k; j++) {
      const off = (j - k / 2) * o.gap * (0.85 + r() * 0.3);
      const L = baseL * (0.7 + r() * 0.5), s0 = (r() - 0.5) * L * 0.3;
      const x0 = x + nxv * off + ca * (s0 - L / 2), y0 = y + nyv * off + sa * (s0 - L / 2);
      const x1 = x0 + ca * L, y1 = y0 + sa * L;
      const mi = (((y0 + y1) / 2) | 0) * W + (((x0 + x1) / 2) | 0);
      if (mi < 0 || mi >= W * H) continue;
      const lm = lum[mi], mm = o.mask ? o.mask[mi] : 1;
      if (mm <= 0) continue;
      if (!lite && band(lm) <= 0.02) continue;
      const bow = (r() - 0.5) * L * 0.12;
      g.strokeStyle = lite ? `rgba(${o.liteInk},${r.range(0.05, 0.12)})` : `rgba(${o.ink},${r.range(o.alpha[0], o.alpha[1])})`;
      g.lineWidth = o.w * (0.7 + r() * 0.5);
      g.beginPath(); g.moveTo(x0, y0);
      // a little tremor along the stroke
      const steps = Math.max(3, Math.round(L / 6));
      for (let q = 1; q <= steps; q++) {
        const t = q / steps, bx = lerp(x0, x1, t) + nxv * bow * Math.sin(Math.PI * t) + (r() - 0.5) * 0.9, by = lerp(y0, y1, t) + nyv * bow * Math.sin(Math.PI * t) + (r() - 0.5) * 0.9;
        g.lineTo(bx, by);
      }
      g.stroke();
      made++;
    }
  }
  g.restore();
  return made;
}

/* ============================================================== TREMOR
 * tremor(g, pts, o) - shaky, overdrawn ink line (device px, identity transform).
 *  o.passes (2-4), o.amp [0.6, 1.5] (final px), o.freq cycles per final px (0.3-0.5), o.off [0.5, 1.5],
 *  o.w [0.6, 2.5] final px, o.lw (device px per final px), o.col 'r,g,b', o.alpha, o.closed, o.seed,
 *  o.fade fn(x, y) -> 0..1 visibility (lost edges)
 */
function tremor(g, pts, o) {
  o = Object.assign({ passes: 3, amp: [0.6, 1.5], freq: 0.4, off: [0.5, 1.5], w: [0.6, 2.5], lw: 2, col: '12,8,6', alpha: 0.85, closed: true, seed: 'tremor' }, o || {});
  const r = rng(o.seed + ':tremor'), lw = o.lw;
  const S = resample(pts, lw * 0.8, o.closed);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.lineCap = 'round';
  for (let p = 0; p < o.passes; p++) {
    const sd = hashStr(o.seed + ':' + p) % 100000;
    const amp = r.range(o.amp[0], o.amp[1]) * lw, off = r.range(o.off[0], o.off[1]) * lw * (r() < 0.5 ? -1 : 1);
    let prev = null;
    for (let i = 0; i < S.length; i++) {
      const [x, y, a] = S[i], s = i * 0.8;            // s in final px
      const nx = -Math.sin(a), ny = Math.cos(a);
      const j = amp * noise1(s * o.freq, sd) + off * (0.6 + 0.4 * noise1(s * 0.02, sd + 3));
      const px = x + nx * j, py = y + ny * j;
      if (prev) {
        const vis = o.fade ? o.fade(px, py) : 1;
        if (vis > 0.02) {
          const wv = lerp(o.w[0], o.w[1], 0.5 + 0.5 * noise1(s * 0.05, sd + 7)) * lw;
          g.strokeStyle = `rgba(${o.col},${o.alpha * vis * (0.75 + 0.25 * noise1(s * 0.1, sd + 9))})`;
          g.lineWidth = wv;
          g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(px, py); g.stroke();
        }
      }
      // pen lifts: occasional gaps
      prev = noise1(s * 0.013, sd + 11) > 0.72 ? null : [px, py];
    }
  }
  g.restore();
}

/* ============================================================== LEVELS
 * Percentile-driven levels that hit a value budget: the darkQ quantile of the
 * luma maps to darkV and the brightQ quantile to brightV (linear in luma,
 * chroma kept). Pixels with alpha 0 are ignored. In place on ImageData.
 */
function quantiles(lum, alpha, qs) {
  const hist = new Uint32Array(1024); let tot = 0;
  for (let i = 0; i < lum.length; i++) { if (alpha && alpha[i * 4 + 3] === 0) continue; hist[Math.min(1023, Math.round(lum[i] * 1023))]++; tot++; }
  return qs.map(q => { let acc = 0; for (let k = 0; k < 1024; k++) { acc += hist[k]; if (acc >= q * tot) return k / 1023; } return 1; });
}
function levels(id, darkQ, darkV, brightQ, brightV, o) {
  o = o || {};
  const d = id.data, lum = lumaOf(id);
  const [qd, qb] = quantiles(lum, null, [darkQ, brightQ]);
  let a = (brightV - darkV) / Math.max(1e-3, qb - qd);
  a = clamp(a, o.minGain || 0.6, o.maxGain || 2.2);
  const b = darkV - a * qd;
  for (let i = 0; i < lum.length; i++) {
    const L = lum[i]; if (L <= 0) continue;
    let L2 = a * L + b;
    // soft shoulder above 0.85
    if (L2 > 0.85) L2 = 0.85 + (1 - Math.exp(-(L2 - 0.85) * 4)) * 0.15 / 1.0 * 0.999;
    L2 = Math.max(0, L2);
    const k = L2 / L;
    d[i * 4] = clamp(d[i * 4] * k, 0, 255); d[i * 4 + 1] = clamp(d[i * 4 + 1] * k, 0, 255); d[i * 4 + 2] = clamp(d[i * 4 + 2] * k, 0, 255);
  }
  return { a, b, qd, qb };
}
/* filmic tone curve on luma (hue kept): exposure, shoulder (highlight roll-off), toe gamma (deepens darks) */
function tone(id, o) {
  o = Object.assign({ exp: 1, shoulder: 1.6, gamma: 1.0, sat: 1 }, o || {});
  const d = id.data, k = o.shoulder, norm = 1 - Math.exp(-k);
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (L <= 1e-5) continue;
    let y = (1 - Math.exp(-L * o.exp * k)) / norm;
    y = Math.pow(Math.min(1, y), o.gamma);
    const f = y / L;
    let R = r * f, G = g * f, B = b * f;
    if (o.sat !== 1) { R = y + (R - y) * o.sat; G = y + (G - y) * o.sat; B = y + (B - y) * o.sat; }
    d[i] = clamp(R * 255, 0, 255); d[i + 1] = clamp(G * 255, 0, 255); d[i + 2] = clamp(B * 255, 0, 255);
  }
  return id;
}
function budget(c) {
  const id = c.getContext('2d').getImageData(0, 0, c.width, c.height), lum = lumaOf(id);
  let dk = 0, br = 0, s = 0;
  for (let i = 0; i < lum.length; i++) { if (lum[i] <= 0.08) dk++; if (lum[i] > 0.6) br++; s += lum[i]; }
  return { dark: dk / lum.length, bright: br / lum.length, mean: s / lum.length };
}

/* ---------------------------------------------------- finishing passes */
/* motion smear (lunge): radial zoom-blurred copy blended in by mask fn(x,y)->0..1 */
function smear(c, cx, cy, zoom, maskFn, steps) {
  const W = c.width, H = c.height, b = mk(W, H), bg = b.getContext('2d'), n = steps || 10;
  for (let i = 0; i < n; i++) { const s = 1 + zoom * i / n; bg.globalAlpha = 1 / (i + 1); bg.drawImage(c, cx - cx * s, cy - cy * s, W * s, H * s); }
  const g = c.getContext('2d');
  const A = g.getImageData(0, 0, W, H), B = bg.getImageData(0, 0, W, H), a = A.data, bb = B.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const m = maskFn(x, y); if (m <= 0) continue;
    const i = (y * W + x) * 4;
    for (let k = 0; k < 3; k++) a[i + k] = lerp(a[i + k], bb[i + k], m);
  }
  g.putImageData(A, 0, 0);
}
function grain(c, amt, seed, mono) {
  const g = c.getContext('2d'), id = g.getImageData(0, 0, c.width, c.height), d = id.data, r = rng('grain:' + seed);
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const n = (r() - 0.5) * amt;
    if (mono === false) { d[i] += (r() - 0.5) * amt; d[i + 1] += (r() - 0.5) * amt; d[i + 2] += (r() - 0.5) * amt; }
    else { d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  }
  g.putImageData(id, 0, 0);
}
/* high-quality downsample by halving steps */
function downsample(src, w, h) {
  let s = src, sw = src.width, sh = src.height;
  while (sw / 2 >= w && sw > w) {
    const nw = Math.max(w, Math.round(sw / 2)), nh = Math.max(h, Math.round(sh / 2));
    const c = mk(nw, nh), cg = c.getContext('2d'); cg.imageSmoothingEnabled = true; cg.imageSmoothingQuality = 'high';
    cg.drawImage(s, 0, 0, nw, nh); s = c; sw = nw; sh = nh;
  }
  if (sw !== w || sh !== h) { const c = mk(w, h), cg = c.getContext('2d'); cg.imageSmoothingQuality = 'high'; cg.drawImage(s, 0, 0, w, h); s = c; }
  return s;
}
function unsharp(c, amt, rad) {
  const g = c.getContext('2d'), W = c.width, H = c.height;
  const b = mk(W, H), bg = b.getContext('2d'); bg.filter = `blur(${rad || 1.2}px)`; bg.drawImage(c, 0, 0);
  const s = g.getImageData(0, 0, W, H), bl = bg.getImageData(0, 0, W, H);
  for (let i = 0; i < s.data.length; i += 4) for (let ch = 0; ch < 3; ch++) s.data[i + ch] = s.data[i + ch] + amt * (s.data[i + ch] - bl.data[i + ch]);
  g.putImageData(s, 0, 0);
}

/* =================================================== PER-PIXEL REALISM
 * The realistic patches (wet eyes, teeth, gums, skin) are SHADED PER PIXEL
 * from analytic or height-field normals under the scene's own lights, so they
 * sit in the same underlight as the felt and read as photographed objects,
 * not as drawn gradients.
 *
 *   st = HZ.stage({light, fill, ambient})      lights in DEVICE px (z toward the viewer)
 *   st.shade(x, y, z, nx, ny, nz, mat, D, S, vis)  diffuse D[3] + specular S[3]
 *   HZ.irisTexture(rDev, o)                    fibred iris albedo canvas
 *   HZ.eyePP(g, st, o)                         complete wet eye (user space of g)
 *   HZ.teethPP(g, st, teeth, o)                per-pixel teeth (user space of g)
 *   HZ.archTeeth(line, o)                      lay teeth along a gum line
 *   HZ.pillowPP(g, st, draw, o)                albedo drawn by draw(lg) + pillow height, shaded
 *   HZ.reliefPP(st, o)                         full height-field shading with cast shadows
 * Materials: {wrap, sss:[r,g,b], spec, pow, spec2, pow2, fuzz}
 */
const MAT = {
  felt: { wrap: 0.12, sss: [1, 0.92, 0.85], spec: 0.015, pow: 6, fuzz: 0.35 },
  skin: { wrap: 0.42, sss: [1.0, 0.55, 0.42], spec: 0.1, pow: 18, spec2: 0.05, pow2: 120 },
  gum: { wrap: 0.45, sss: [1.0, 0.5, 0.45], spec: 0.32, pow: 45, spec2: 0.75, pow2: 420 },
  tooth: { wrap: 0.3, sss: [1.0, 0.86, 0.68], spec: 0.1, pow: 18, spec2: 0.85, pow2: 260 },
  sclera: { wrap: 0.6, sss: [1.0, 0.82, 0.78], spec: 0.25, pow: 70, spec2: 0.85, pow2: 900 },
  iris: { wrap: 0.25, sss: [1, 1, 1], spec: 0.0, pow: 1 },
  button: { wrap: 0.05, sss: [1, 1, 1], spec: 0.6, pow: 60, spec2: 1.2, pow2: 700 },
  thread: { wrap: 0.2, sss: [1, 0.9, 0.85], spec: 0.04, pow: 10, fuzz: 0.2 },
};
function stage(o) {
  const L = [o.light].concat(o.fill ? [].concat(o.fill) : []).map(l => Object.assign({ col: [1, 1, 1], power: 1, d0: 400 }, l));
  const amb = o.ambient || [0.012, 0.012, 0.014];
  function shade(x, y, z, nx, ny, nz, mat, D, S, vis) {
    D[0] = amb[0]; D[1] = amb[1]; D[2] = amb[2]; S[0] = S[1] = S[2] = 0;
    const w = mat.wrap || 0, ss = mat.sss || [1, 1, 1];
    for (let k = 0; k < L.length; k++) {
      const l = L[k];
      let lx = l.x - x, ly = l.y - y, lz = l.z - z;
      const d = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1; lx /= d; ly /= d; lz /= d;
      const q = d / l.d0, fall = l.power / (1 + q * q) * (k === 0 && vis !== undefined ? vis : 1);
      if (fall <= 0) continue;
      const ndl = nx * lx + ny * ly + nz * lz;
      let plain = ndl > 0 ? ndl : 0, wr = (ndl + w) / (1 + w), wrapped = wr > 0 ? wr : 0, ex = wrapped - plain;
      if (l.cut) {         // shifted terminator: grazing surfaces fall into the dark (chiaroscuro)
        const k = sstep(l.cut - (l.cutSoft || 0.12), l.cut + (l.cutSoft || 0.12), ndl); plain *= k; ex *= k;
      }
      if (l.hard) {        // hard terminator (panic light): the falloff snaps to black within a few degrees
        const hk = sstep(-0.01, 0.01 + 0.12 * (1 - l.hard), ndl);
        plain = lerp(plain, hk * (0.55 + 0.45 * Math.max(0, ndl)), l.hard); ex *= 1 - l.hard;
      }
      let fz = 0;
      if (mat.fuzz) { const g1 = 1 - nz; fz = mat.fuzz * g1 * g1 * Math.max(0, ndl + 0.35); }
      D[0] += l.col[0] * fall * (plain + ex * ss[0] + fz);
      D[1] += l.col[1] * fall * (plain + ex * ss[1] + fz);
      D[2] += l.col[2] * fall * (plain + ex * ss[2] + fz);
      if (mat.spec && ndl > -0.05) {
        let hx = lx, hy = ly, hz = lz + 1; const hl = Math.sqrt(hx * hx + hy * hy + hz * hz); hx /= hl; hy /= hl; hz /= hl;
        const nh = Math.max(0, nx * hx + ny * hy + nz * hz);
        let sp = mat.spec * Math.pow(nh, mat.pow || 30);
        if (mat.spec2) sp += mat.spec2 * Math.pow(nh, mat.pow2 || 400);
        sp *= fall * sstep(-0.05, 0.15, ndl);
        S[0] += l.col[0] * sp; S[1] += l.col[1] * sp; S[2] += l.col[2] * sp;
      }
    }
  }
  return { L, amb, shade };
}
/* device-px bbox of a user-space rectangle under g's transform */
function devBox(g, x0, y0, x1, y1, pad) {
  const m = g.getTransform(), xs = [], ys = [];
  for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) { xs.push(m.a * x + m.c * y + m.e); ys.push(m.b * x + m.d * y + m.f); }
  const W = g.canvas.width, H = g.canvas.height, p = pad || 2;
  const bx0 = clamp(Math.floor(Math.min(...xs)) - p, 0, W), by0 = clamp(Math.floor(Math.min(...ys)) - p, 0, H);
  const bx1 = clamp(Math.ceil(Math.max(...xs)) + p, 0, W), by1 = clamp(Math.ceil(Math.max(...ys)) + p, 0, H);
  return { x: bx0, y: by0, w: Math.max(0, bx1 - bx0), h: Math.max(0, by1 - by0) };
}
/* rotation angle of g's transform (radians) */
function rotOf(g) { const m = g.getTransform(); return Math.atan2(m.b, m.a); }

/* ------------------------------------------------------------- iris
 * irisTexture(rDev, o): square canvas (device px), iris of radius rDev centred.
 *  o.pupil (fraction of radius), o.col [inner/collarette, mid, outer], o.seed,
 *  o.limbal (dark ring width, fraction of radius, 0.1), o.blown (pupil > 0.6: glossy black)
 */
function irisTexture(rDev, o) {
  o = Object.assign({ pupil: 0.3, col: ['#A89668', '#7D8C80', '#3C4A4C'], seed: 'iris', limbal: 0.1, ruff: '#3A2A1C' }, o || {});
  const D = Math.ceil(rDev * 2) + 4, c = mk(D, D), cg = c.getContext('2d'), id = cg.createImageData(D, D), d = id.data;
  const C = o.col.map(hex2rgb), RF = hex2rgb(o.ruff), sd = hashStr(o.seed) % 100000, p = o.pupil;
  const cr = p + (1 - p) * 0.36;                       // collarette radius
  const K1 = Math.max(60, Math.round(rDev * 1.9));     // fine fibres around the circle
  const rc0 = rng(o.seed + ':crypt'), CR = [];
  for (let k = 0; k < 22; k++) CR.push([rc0() * TAU - Math.PI, cr * (1.05 + rc0() * 0.5), 0.012 + rc0() * 0.03, 0.04 + rc0() * 0.08, 0.25 + rc0() * 0.3]);
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
    const dx = x + 0.5 - D / 2, dy = y + 0.5 - D / 2, rp = Math.sqrt(dx * dx + dy * dy), r = rp / rDev;
    if (r > 1.0 + 1.5 / rDev) continue;
    const th = Math.atan2(dy, dx), u = th / TAU + 0.5;
    const crr = cr * (1 + 0.07 * Math.sin(th * 7 + 1.3) + 0.04 * Math.sin(th * 13 + 0.4) + 0.03 * noise1(u * 20, sd + 3));
    // base colour by zone
    let col;
    if (r < crr) { const t = clamp((r - p) / Math.max(0.01, crr - p), 0, 1); col = C[0].map((v, k) => lerp(v * 0.8, v, t)); }
    else { const t = clamp((r - crr) / (1 - crr), 0, 1); col = C[1].map((v, k) => t < 0.55 ? lerp(C[0][k], v, sstep(0, 0.35, t)) : lerp(v, C[2][k], (t - 0.55) / 0.45)); }
    // fibres: anisotropic streaks (fast around, slow along r), wavy
    const wav = 0.9 * noise2(r * 3.5, u * 6, sd + 11);
    const f1 = noise2(u * K1 + wav * 3, r * 2.2, sd), f2 = noise2(u * K1 * 0.37 + wav, r * 3.1, sd + 5), f3 = noise2(u * K1 * 2.3, r * 5, sd + 7);
    let b = 0.86 + 0.26 * f1 + 0.16 * f2 + 0.07 * f3;
    // pale trabeculae in the ciliary zone
    if (r > crr) { const tr = noise2(u * K1 * 0.55 + wav * 2, r * 1.4, sd + 13); b += 0.22 * Math.pow(Math.max(0, tr), 2.2) * sstep(crr, crr + 0.1, r); }
    // collarette: a bright, slightly raised wavy ring
    b += 0.1 * Math.exp(-Math.pow((r - crr) / 0.03, 2));
    // crypts: small dark radial lenses just outside the collarette
    for (let k = 0; k < CR.length; k++) {
      const cc = CR[k]; let dth = th - cc[0]; dth -= TAU * Math.round(dth / TAU);
      const e = Math.pow(dth * r / cc[2], 2) + Math.pow((r - cc[1]) / cc[3], 2);
      if (e < 1) b *= 1 - cc[4] * (1 - e) * (1 - e);
    }
    // contraction furrows: thin broken concentric arcs in the outer third
    if (r > 0.6) { const fr = Math.sin((r - 0.6) * 95 + 2.2 * noise2(u * 9, r * 2, sd + 19)); b *= 1 - 0.13 * Math.pow(Math.max(0, fr), 8) * (0.5 + 0.5 * noise2(u * 14, 1.3, sd + 23)); }
    // a few darker freckles
    // limbal ring
    b *= 1 - 0.86 * sstep(1 - o.limbal * 1.6, 1.0, r);
    let R = col[0] * b, G = col[1] * b, B = col[2] * b;
    // pupillary ruff
    const ruff = Math.exp(-Math.pow((r - p * 1.05) / Math.max(0.012, p * 0.08), 2));
    R = lerp(R, RF[0], ruff * 0.7); G = lerp(G, RF[1], ruff * 0.7); B = lerp(B, RF[2], ruff * 0.7);
    // pupil
    const pe = sstep(p - 0.9 / rDev, p + 0.9 / rDev, r);
    R = lerp(5, R, pe); G = lerp(5, G, pe); B = lerp(7, B, pe);
    const i = (y * D + x) * 4;
    d[i] = clamp(R, 0, 255); d[i + 1] = clamp(G, 0, 255); d[i + 2] = clamp(B, 0, 255);
    d[i + 3] = 255 * (1 - sstep(1.0 - 0.8 / rDev, 1.0 + 0.8 / rDev, r));
  }
  cg.putImageData(id, 0, 0);
  return { c, D };
}

/* ------------------------------------------------------------- EYE (per pixel)
 * eyePP(g, st, o) - a wet human eye at (o.cx, o.cy) in g's user space,
 * lit per pixel by the stage lights. Options as wetEye plus:
 *  o.z      height of the eyeball front above the picture plane (DEVICE px)
 *  o.ball   eyeball radius / w (0.6)       o.scleraCol '#E6DED0'
 *  o.window window catchlight {x, y, s, a} in iris radii (false = none)  (screen-space reflection of a TV)
 *  o.wetK   strength of the wet speculars (1)
 *  o.lidSkin, o.ring, o.socket as wetEye; o.lidFn(lg, S, h) optional extra lid drawing (felt lids)
 *  o.noLashes
 * returns {ap (Path2D in user space), ix, iy, ir, h, w}
 */
function eyePP(g, st, o) {
  o = Object.assign({ open: 1, side: -1, rot: 0, iris: 0.2, irisDy: 0, gaze: [0, 0], pupil: 0.3,
    irisCol: ['#A89668', '#7D8C80', '#3C4A4C'], veins: 6, veinCol: '#C9A3A0', window: { x: 0, y: -0.05, s: 0.3, a: 0.95 },
    lowerFlat: 0, lashes: 14, lashLen: 0.1, press: 0, lidSkin: '#A8786A', ring: 0.1, socket: 0.4, lw: 1, seed: 'eye',
    z: 0, ball: 0.6, scleraCol: '#F0E9DE', wetK: 1, lidShadow: 0.65, waterline: 1, caruncle: 1 }, o || {});
  const S = eyeShape(o), w = S.w, h = S.h, lw = o.lw, r = rng(o.seed + ':eye'), s = scaleOf(g);
  const apL = polyPath(S.up.concat(S.lo.slice().reverse()), true);
  const ir = w * o.iris;
  const ix = o.gaze[0] * w, iy = o.gaze[1] * w + o.irisDy * h + (S.iy0 + S.oy0) / 2 + h * 0.02;
  g.save();
  g.translate(o.cx, o.cy); g.rotate(o.rot || 0);
  // ---- socket shadow + lid skin ring (as wetEye)
  if (o.socket > 0) {
    const sg = g.createRadialGradient(0, 0, w * 0.3, 0, 0, w * 0.95);
    sg.addColorStop(0, `rgba(10,6,5,${o.socket})`); sg.addColorStop(0.6, `rgba(10,6,5,${o.socket * 0.45})`); sg.addColorStop(1, 'rgba(10,6,5,0)');
    g.fillStyle = sg; g.beginPath(); g.ellipse(0, -h * 0.05, w * 0.95, w * 0.72, 0, 0, TAU); g.fill();
  }
  if (o.ring > 0) eyeLidRing(g, st, o, S, apL, s);
  // ---- eyeball albedo on a layer, then per-pixel shading
  const L = layerOf(g), lg = L.g;
  lg.save(); lg.clip(apL);
  lg.fillStyle = o.scleraCol; lg.fillRect(-w, -h * 2, w * 2, h * 4);
  // sclera albedo variation: yellowing toward the corners, faint blotches
  for (const [x, k] of [[S.ix0, 1], [S.ox0, 0.8]]) {
    const pg = lg.createRadialGradient(x, (S.iy0 + S.oy0) / 2, 0, x, 0, w * 0.3);
    pg.addColorStop(0, `rgba(200,140,124,${0.5 * k})`); pg.addColorStop(0.35, `rgba(215,185,165,${0.18 * k})`); pg.addColorStop(1, 'rgba(215,185,165,0)');
    lg.fillStyle = pg; lg.fillRect(-w, -h * 2, w * 2, h * 4);
  }
  lg.save(); lg.globalCompositeOperation = 'multiply'; lg.globalAlpha = 0.22; lg.setTransform(1, 0, 0, 1, 0, 0);
  lg.drawImage(noiseCanvas(L.c.width, L.c.height, o.seed + 'scl', 9 * s / 2, 18), 0, 0); lg.restore();
  // inner corner: caruncle + plica (pink, albedo)
  if (o.caruncle) {
    const cx = S.ix0 + S.side * w * 0.05, cy = S.iy0 + h * 0.03;
    const cgr = lg.createRadialGradient(cx, cy, 0, cx, cy, w * 0.075);
    cgr.addColorStop(0, '#C47C76'); cgr.addColorStop(0.6, 'rgba(190,120,112,0.75)'); cgr.addColorStop(1, 'rgba(200,140,130,0)');
    lg.fillStyle = cgr; lg.beginPath(); lg.ellipse(cx, cy, w * 0.075, h * 0.3, 0, 0, TAU); lg.fill();
    lg.strokeStyle = 'rgba(180,110,100,0.4)'; lg.lineWidth = lw * 1.2;
    lg.beginPath(); lg.ellipse(cx + S.side * w * 0.05, cy, w * 0.03, h * 0.3, 0, -1.2, 1.2); lg.stroke();
  }
  // capillaries (branching, grey-pink, from the corners toward the iris)
  const vein = (x, y, a, len, wd, depth) => {
    let px = x, py = y;
    const n = Math.max(3, Math.round(len / (w * 0.02)));
    lg.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      a += (r() - 0.5) * 0.7;
      const nx = px + Math.cos(a) * len / n, ny = py + Math.sin(a) * len / n * 0.8;
      lg.strokeStyle = rgba(r() < 0.4 ? mixc(o.veinCol, '#8E4E52', 0.45) : o.veinCol, (0.38 + r() * 0.2) * (1 - i / n * 0.5));
      lg.lineWidth = Math.max(lw * 0.45, wd * (1 - i / n * 0.7));
      lg.beginPath(); lg.moveTo(px, py); lg.lineTo(nx, ny); lg.stroke();
      if (depth < 2 && r() < 0.32) vein(nx, ny, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6), len * (0.3 + r() * 0.35), wd * 0.6, depth + 1);
      px = nx; py = ny;
    }
  };
  for (let k = 0; k < o.veins; k++) {
    const inner = k % 2 === 0, x0 = inner ? S.ix0 : S.ox0, sx = x0 > 0 ? 1 : -1;
    const x = x0 - sx * w * (0.03 + r() * 0.05), y = lerp(S.iy0, S.oy0, inner ? 0 : 1) + (r() - 0.5) * h * 0.6;
    vein(x, y, (sx > 0 ? Math.PI : 0) + (r() - 0.5) * 0.9, w * (0.16 + r() * 0.16), lw * (1.1 + r() * 0.5), 0);
  }
  // iris albedo
  const IT = irisTexture(ir * s, { pupil: o.pupil, col: o.irisCol, seed: o.seed + ':iris', limbal: o.limbal || 0.1 });
  lg.save(); lg.translate(ix, iy);
  lg.drawImage(IT.c, -IT.D / 2 / s, -IT.D / 2 / s, IT.D / s, IT.D / s); lg.restore();
  lg.restore();
  // ---- per-pixel shading of the eyeball layer
  const box = devBox(g, -w * 0.62, -h * 1.2, w * 0.62, h * 1.2, 3);
  if (box.w > 0 && box.h > 0) {
    const id = lg.getImageData(box.x, box.y, box.w, box.h), d = id.data;
    const inv = g.getTransform().inverse(), ang = rotOf(g), ca = Math.cos(ang), sa = Math.sin(ang);
    const Rb = w * o.ball, by = iy * 0.6, Rc = ir * 1.25, D3 = [0, 0, 0], S3 = [0, 0, 0];
    const nU = S.up.length - 1, xA = S.up[0][0], xB = S.up[nU][0];
    const yAt = (arr, x) => { const t = clamp((x - xA) / (xB - xA), 0, 1) * nU, i = Math.min(nU - 1, Math.floor(t)), f = t - i; return lerp(arr[i][1], arr[i + 1][1], f); };
    const matS = Object.assign({}, MAT.sclera, { spec: MAT.sclera.spec * o.wetK, spec2: MAT.sclera.spec2 * o.wetK });
    const matC = { wrap: 0, spec: 0.25 * o.wetK, pow: 140, spec2: 1.6 * o.wetK, pow2: 1500 };
    // the light's direction projected into the eye (for the corneal caustic on the iris)
    const L0 = st.L[0];
    for (let yy = 0; yy < box.h; yy++) for (let xx = 0; xx < box.w; xx++) {
      const i = (yy * box.w + xx) * 4; if (d[i + 3] === 0) continue;
      const X = box.x + xx + 0.5, Y = box.y + yy + 0.5;
      const pu = inv.transformPoint(new DOMPoint(X, Y));
      const lx = pu.x, ly = pu.y;                       // eye-local user coords
      // sphere normal (local), rotated to device
      let nx = lx / Rb, ny = (ly - by) / Rb; let q = nx * nx + ny * ny; if (q > 0.96) { const k = Math.sqrt(0.96 / q); nx *= k; ny *= k; q = 0.96; }
      let nz = Math.sqrt(1 - q);
      const dI = Math.hypot(lx - ix, ly - iy) / ir;
      // occlusion by the lids and in the corners
      const dUp = ly - yAt(S.up, lx), dLo = yAt(S.lo, lx) - ly;
      const occU = lerp(1 - o.lidShadow, 1, sstep(0, h * 0.3, dUp)), occL = 0.78 + 0.22 * sstep(0, h * 0.12, dLo);
      const edgeC = Math.min(lx - Math.min(S.ix0, S.ox0), Math.max(S.ix0, S.ox0) - lx);
      const occC = 0.5 + 0.5 * sstep(0, w * 0.14, edgeC);
      const occ = occU * occL * occC * (o.vis ? o.vis(X, Y) : 1) * (o.gain || 1);
      const z = o.z + nz * Rb * s * 0.35;
      const dnx = (nx * ca - ny * sa), dny = (nx * sa + ny * ca);
      let R, G, B;
      if (dI < 1.05) {
        // iris / pupil: flattened normal for the diffuse, corneal dome for the speculars
        st.shade(X, Y, z, dnx * 0.35, dny * 0.35, Math.sqrt(1 - 0.1225 * (dnx * dnx + dny * dny)), MAT.iris, D3, S3, 1);
        // corneal caustic: the side of the iris AWAY from the light gets a crescent of focused light
        const ldx = L0.x - X, ldy = L0.y - Y, ll = Math.hypot(ldx, ldy) || 1;
        const along = -((lx - ix) * (ldx / ll) + (ly - iy) * (ldy / ll)) / ir;
        const caus = 1 + 0.45 * sstep(0.1, 0.75, along) * (1 - sstep(0.8, 1.0, dI));
        const a = d[i] / 255, b2 = d[i + 1] / 255, c2 = d[i + 2] / 255;
        R = a * D3[0] * caus * occ; G = b2 * D3[1] * caus * occ; B = c2 * D3[2] * caus * occ;
        // cornea
        const cx_ = (lx - ix) / Rc, cy_ = (ly - iy) / Rc, cq = Math.min(0.9, cx_ * cx_ + cy_ * cy_);
        let cnx = cx_ * 0.8 + nx * 0.3, cny = cy_ * 0.8 + ny * 0.3, cnz = Math.sqrt(Math.max(0.05, 1 - cq)); const cl = Math.hypot(cnx, cny, cnz); cnx /= cl; cny /= cl; cnz /= cl;
        st.shade(X, Y, z, cnx * ca - cny * sa, cnx * sa + cny * ca, cnz, matC, D3, S3, 1);
        const so = Math.sqrt(occ);
        R += S3[0] * so * 255 / 255; G += S3[1] * so; B += S3[2] * so;
        // a faint corneal sheen everywhere (the eye is wet glass)
        const sh = 0.035 * (1 - sstep(0.6, 1.05, dI)) * occ; R += sh; G += sh; B += sh * 1.05;
      } else {
        st.shade(X, Y, z, dnx, dny, nz, matS, D3, S3, 1);
        const a = d[i] / 255, b2 = d[i + 1] / 255, c2 = d[i + 2] / 255;
        const so = Math.pow(occ, 0.7);
        R = a * D3[0] * occ + S3[0] * so; G = b2 * D3[1] * occ + S3[1] * so; B = c2 * D3[2] * occ + S3[2] * so;
      }
      d[i] = clamp(R * 255, 0, 255); d[i + 1] = clamp(G * 255, 0, 255); d[i + 2] = clamp(B * 255, 0, 255);
    }
    lg.putImageData(id, box.x, box.y);
  }
  // upper lid: soft shadow + lash shadow on the eyeball (inside the aperture)
  lg.save(); lg.clip(apL); lg.filter = `blur(${(h * 0.05 * s).toFixed(2)}px)`;
  lg.strokeStyle = `rgba(4,2,1,${0.55 * o.lidShadow})`; lg.lineWidth = h * 0.16; lg.stroke(polyPath(S.up, false)); lg.restore();
  // window catchlight: reflection of a lit screen, dead centre on the cornea
  if (o.window) {
    const c = o.window, cx = ix + c.x * ir, cy = iy + c.y * ir, sz = c.s * ir, ww = sz, hh = sz * 0.8, bar = Math.max(lw * 0.6, ww * 0.08);
    lg.save(); lg.clip(apL);
    lg.filter = `blur(${(sz * 0.18 * s).toFixed(2)}px)`; lg.fillStyle = `rgba(255,255,255,${0.12 * c.a})`;
    lg.beginPath(); lg.ellipse(cx, cy, ww * 0.7, hh * 0.7, 0, 0, TAU); lg.fill();
    lg.filter = `blur(${Math.max(0.25, 0.25 * lw * s).toFixed(2)}px)`; lg.fillStyle = `rgba(255,255,252,${c.a})`;
    const pw = (ww - bar) / 2, ph = (hh - bar) / 2;
    if (c.panes === 1) { lg.beginPath(); lg.roundRect(cx - ww / 2, cy - hh / 2, ww, hh, Math.min(ww, hh) * 0.2); lg.fill(); }
    else for (const [qx, qy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { lg.beginPath(); lg.roundRect(cx - ww / 2 + qx * (pw + bar), cy - hh / 2 + qy * (ph + bar), pw, ph, Math.min(pw, ph) * 0.22); lg.fill(); }
    // a second, tiny bounce glint
    lg.filter = 'none'; lg.fillStyle = `rgba(255,255,255,${0.55 * c.a})`;
    lg.beginPath(); lg.arc(cx - ir * 0.32, cy + ir * 0.38, Math.max(lw * 0.5, ir * 0.04), 0, TAU); lg.fill();
    lg.restore();
  }
  blit(g, L.c);
  // ---- lid margins: lower lid band, waterline, upper lash line, lashes
  lidMargins(g, st, o, S, lw, h, w);
  g.restore();
  const m = new DOMMatrix().translate(o.cx, o.cy).rotate((o.rot || 0) / DEG);
  const ap = new Path2D(); ap.addPath(apL, m);
  const cI = m.transformPoint(new DOMPoint(ix, iy));
  return { ap, ix: cI.x, iy: cI.y, ir, h, w, shape: S, m };
}
/* the skin of the lids around the aperture, shaded per pixel (pillow height) */
function eyeLidRing(g, st, o, S, apL, s) {
  const w = S.w, h = S.h, rw = w * o.ring, n = S.up.length - 1;
  // anatomical lids: a broad upper lid up to the crease and above, a thin lower lid; both fade into the socket
  const ex = o.lidSpread || 1.1;
  const upO = S.up.map(([x, y], i) => { const u = i / n; return [x * ex, y - h * (0.42 + 0.5 * Math.sin(Math.PI * Math.pow(u, 0.85))) - rw * 0.3]; });
  const loO = S.lo.map(([x, y], i) => { const u = i / n; return [x * (ex - 0.02), y + h * (0.12 + 0.3 * Math.sin(Math.PI * u)) + rw * 0.25]; });
  const region = polyPath(upO.concat(loO.slice().reverse()), true);
  const crease = S.up.map(([x, y], i) => { const u = i / n; return [x * 1.03, y - h * (0.18 + 0.3 * Math.sin(Math.PI * Math.pow(u, 0.85)))]; });
  pillowPP(g, st, (lg) => {
    const gr = lg.createRadialGradient(0, 0, w * 0.3, 0, 0, w * 0.75);
    gr.addColorStop(0, o.lidSkin); gr.addColorStop(1, mixc(o.lidSkin, '#2A1A16', 0.55));
    lg.fillStyle = gr; lg.fill(region);
    lg.save(); lg.filter = `blur(${(h * 0.04 * s).toFixed(2)}px)`; lg.strokeStyle = 'rgba(50,24,20,0.6)'; lg.lineWidth = h * 0.05; lg.stroke(polyPath(crease, false)); lg.restore();
    // lower lid: faint pinkish margin skin, a darker tear trough beneath
    lg.save(); lg.filter = `blur(${(h * 0.06 * s).toFixed(2)}px)`; lg.strokeStyle = 'rgba(40,20,18,0.45)'; lg.lineWidth = h * 0.08;
    lg.stroke(polyPath(loO.slice(4, -4), false)); lg.restore();
    // fine creases at the outer corner (crow's feet)
    const r = rng(o.seed + ':crow'); lg.strokeStyle = 'rgba(50,25,20,0.5)'; lg.lineWidth = o.lw * 0.8; lg.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const a = (k - 1.5) * 0.3 + (r() - 0.5) * 0.12, x0 = S.ox0 + S.side * w * 0.03, y0 = S.oy0 + h * 0.05, Ln = w * (0.06 + r() * 0.05);
      lg.beginPath(); lg.moveTo(x0, y0 + Math.sin(a) * w * 0.02); lg.quadraticCurveTo(x0 + S.side * Ln * 0.6, y0 + Math.sin(a) * Ln * 0.6 + h * 0.03, x0 + S.side * Ln, y0 + Math.sin(a) * Ln); lg.stroke();
    }
    lg.save(); lg.globalCompositeOperation = 'destination-out'; lg.fill(apL); lg.restore();
  }, { vis: o.vis, mat: Object.assign({}, MAT.skin, { spec: 0.05, spec2: 0.03 }), height: rw * 0.6, round: rw * 0.25, z: o.z, seed: o.seed + 'lid', pores: 0.18, poreScale: 0.5, noise: [0.4, 3], lw: o.lw, feather: rw * 0.7,
    hdraw: (hg) => {
      hg.fillStyle = 'rgb(70,70,70)'; hg.fill(region);
      hg.strokeStyle = 'rgb(255,255,255)'; hg.lineJoin = 'round'; hg.lineWidth = rw * 0.9; hg.stroke(polyPath(S.up, false));
      hg.lineWidth = rw * 0.6; hg.stroke(polyPath(S.lo, false));
      hg.strokeStyle = 'rgb(20,20,20)'; hg.lineWidth = h * 0.06; hg.stroke(polyPath(crease, false));
    } });
}
function lidMargins(g, st, o, S, lw, h, w) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  // lower lid margin (pink-brown band) and the wet waterline along its inner edge
  g.save();
  g.strokeStyle = rgba(mixc(o.lidSkin, '#7E5250', 0.4), 0.55); g.lineWidth = Math.max(lw * 1.2, h * 0.03);
  g.translate(0, Math.max(lw * 1.0, h * 0.022)); g.stroke(polyPath(S.lo.slice(3, -3), false));
  g.restore();
  if (o.waterline) {
    g.save(); g.strokeStyle = `rgba(255,250,244,${0.6 * o.waterline})`; g.lineWidth = Math.max(lw * 0.7, h * 0.009);
    g.setLineDash([w * 0.09, w * 0.025, w * 0.05, w * 0.03]);
    g.translate(0, -lw * 0.2); g.stroke(polyPath(S.lo.slice(7, -8), false)); g.setLineDash([]);
    // broken bright beads on the tear meniscus
    const r = rng(o.seed + ':bead');
    for (let k = 0; k < 6; k++) { const p = S.lo[6 + Math.floor(r() * (S.lo.length - 13))]; g.fillStyle = `rgba(255,255,255,${0.6 + r() * 0.4})`; g.beginPath(); g.ellipse(p[0], p[1] - lw * 0.3, lw * (0.7 + r() * 0.8), lw * 0.5, 0, 0, TAU); g.fill(); }
    g.restore();
  }
  // upper lash line
  g.save();
  for (let i = 1; i < S.up.length; i++) {
    const u = i / (S.up.length - 1), a = S.up[i - 1], b = S.up[i];
    g.strokeStyle = 'rgba(10,5,4,0.96)'; g.lineWidth = Math.max(lw * 1.2, h * lerp(0.035, 0.06, u));
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
  g.restore();
  if (o.noLashes) return;
  const rl = rng(o.seed + ':lash');
  g.save(); g.strokeStyle = 'rgba(12,7,5,0.92)';
  for (let k = 0; k < o.lashes; k++) {
    const u = 0.12 + 0.86 * (k + rl() * 0.85) / o.lashes, idx = Math.round(u * (S.up.length - 1));
    const [bx, by] = S.up[idx];
    const Ln = w * o.lashLen * (0.45 + 0.7 * u) * (0.6 + rl() * 0.7);
    let a = -Math.PI / 2 + S.side * (0.15 + 0.9 * u) + (rl() - 0.5) * 0.5;
    if (o.press) a = lerp(a, -Math.PI / 2 + S.side * 1.45 + (rl() - 0.5) * 0.4, o.press);
    const bend = S.side * (0.3 + rl() * 0.4) * (o.press ? 1.4 : 1);
    g.lineWidth = Math.max(lw * 0.5, w * 0.0055 * (0.7 + rl() * 0.7));
    g.beginPath(); g.moveTo(bx, by);
    g.quadraticCurveTo(bx + Math.cos(a) * Ln * 0.55, by + Math.sin(a) * Ln * 0.55, bx + Math.cos(a + bend) * Ln, by + Math.sin(a + bend) * Ln);
    g.stroke();
  }
  for (let k = 0; k < Math.round(o.lashes * 0.45); k++) {
    const u = 0.3 + 0.65 * rl(), idx = Math.round(u * (S.lo.length - 1));
    const [bx, by] = S.lo[idx], Ln = w * o.lashLen * 0.3 * (0.6 + rl() * 0.6);
    const a = Math.PI / 2 + S.side * (0.2 + 0.5 * u) + (rl() - 0.5) * 0.4;
    g.lineWidth = Math.max(lw * 0.4, w * 0.0035); g.strokeStyle = 'rgba(20,10,8,0.6)';
    const y0 = by + Math.max(lw * 2.2, h * 0.05);
    g.beginPath(); g.moveTo(bx, y0); g.lineTo(bx + Math.cos(a) * Ln, y0 + Math.sin(a) * Ln); g.stroke();
  }
  g.restore();
}

/* ------------------------------------------------------------- PILLOW (per pixel)
 * pillowPP(g, st, draw, o): draw(lg) paints an ALBEDO layer (user space of g);
 * its alpha is blurred into a soft pillow height, plus fine noise; the layer is
 * shaded per pixel and composited onto g.
 *  o.mat, o.height (user units), o.round (blur radius, user units), o.z (DEVICE px),
 *  o.noise [amp, cell] (device px), o.pores (1 = skin pores), o.extraH(hArr, W, H, box) adds height,
 *  o.vis(X, Y) -> 0..1 key-light visibility, o.seed, o.op composite op
 */
function pillowPP(g, st, draw, o) {
  o = Object.assign({ mat: MAT.skin, height: 10, round: 6, z: 0, noise: null, pores: 0, seed: 'pillow', lw: 1 }, o || {});
  const s = scaleOf(g), L = layerOf(g), lg = L.g, fp = o.lw * s;     // device px per final px
  draw(lg);
  if (o.feather) {     // soften the albedo edge (skin melting into its surroundings)
    const t = mk(L.c.width, L.c.height), tg = t.getContext('2d'); tg.filter = `blur(${(o.feather * s).toFixed(2)}px)`; tg.drawImage(L.c, 0, 0);
    lg.save(); lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalCompositeOperation = 'destination-in'; lg.drawImage(t, 0, 0); lg.restore();
  }
  // bbox of painted pixels
  const W = L.c.width, H = L.c.height, full = lg.getImageData(0, 0, W, H), fd = full.data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (fd[(y * W + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return L;
  const R = Math.ceil(o.round * s) + 3;
  x0 = Math.max(0, x0 - R - 2); y0 = Math.max(0, y0 - R - 2); x1 = Math.min(W - 1, x1 + R + 2); y1 = Math.min(H - 1, y1 + R + 2);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, hA = new Float32Array(bw * bh);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) hA[y * bw + x] = fd[((y + y0) * W + x + x0) * 4 + 3] / 255;
  fblur(hA, bw, bh, Math.max(1, o.round * s / 2));
  const Hd = o.height * s, sd = hashStr(o.seed) % 99991;
  if (o.hdraw) {      // painted height (red channel), blurred, masked by the albedo alpha
    const HL = layerOf(g); o.hdraw(HL.g);
    const hd = HL.g.getImageData(x0, y0, bw, bh).data, hb = new Float32Array(bw * bh);
    for (let i = 0; i < hb.length; i++) hb[i] = hd[i * 4] / 255 * (hd[i * 4 + 3] / 255);
    fblur(hb, bw, bh, Math.max(1, o.round * s / 2));
    for (let i = 0; i < hA.length; i++) hA[i] = hb[i] * Hd * Math.min(1, hA[i] * 3);
  } else for (let i = 0; i < hA.length; i++) hA[i] = Math.pow(hA[i], 0.6) * Hd;
  if (o.noise) { const [amp, cell] = o.noise; for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) hA[y * bw + x] += amp * fbm((x + x0) / cell, (y + y0) / cell, sd, 3); }
  if (o.pores) {
    const pc = 2.4 * fp * (o.poreScale || 1);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const X = x + x0, Y = y + y0, cx = Math.floor(X / pc), cy = Math.floor(Y / pc);
      if (hash2(cx, cy, sd + 9) < 0.16) {
        const px = (cx + 0.25 + 0.5 * hash2(cx, cy, sd + 11)) * pc, py = (cy + 0.25 + 0.5 * hash2(cx, cy, sd + 12)) * pc, dd = Math.hypot(X - px, Y - py) / (0.55 * pc);
        if (dd < 1) hA[y * bw + x] -= o.pores * 0.45 * fp * (1 - dd * dd);
      }
      hA[y * bw + x] += o.pores * 0.3 * fp * noise2(X / (4 * pc), Y / (4 * pc), sd + 21);
    }
  }
  if (o.extraH) o.extraH(hA, bw, bh, { x: x0, y: y0 });
  const id = lg.getImageData(x0, y0, bw, bh), d = id.data, D3 = [0, 0, 0], S3 = [0, 0, 0];
  for (let y = 1; y < bh - 1; y++) for (let x = 1; x < bw - 1; x++) {
    const j = y * bw + x, i = j * 4; if (!d[i + 3]) continue;
    let nx = -(hA[j + 1] - hA[j - 1]) * 0.5, ny = -(hA[j + bw] - hA[j - bw]) * 0.5, nz = 1; const nl = Math.sqrt(nx * nx + ny * ny + 1); nx /= nl; ny /= nl; nz /= nl;
    const X = x + x0 + 0.5, Y = y + y0 + 0.5;
    st.shade(X, Y, o.z + hA[j], nx, ny, nz, o.mat, D3, S3, o.vis ? o.vis(X, Y) : 1);
    d[i] = clamp(d[i] * D3[0] + S3[0] * 255, 0, 255); d[i + 1] = clamp(d[i + 1] * D3[1] + S3[1] * 255, 0, 255); d[i + 2] = clamp(d[i + 2] * D3[2] + S3[2] * 255, 0, 255);
  }
  lg.putImageData(id, x0, y0);
  if (!o.keep) blit(g, L.c, o.alpha, o.op);
  return L;
}

/* ------------------------------------------------------------- TEETH (per pixel)
 * A tooth: {x, y} cervical centre where it leaves the gum (user space), ang (radians,
 * direction gum -> biting edge), w (crown width), L (visible crown length), kind
 * 'ci' | 'li' | 'c' | 'pm' | 'm', tint (0..1 yellow), ao (0..1 overall light reaching it),
 * z (DEVICE px height), lean (rad), seed.
 * teethPP(g, st, teeth, o): draws back-to-front (o.sorted = already ordered).
 *  o.vis(X, Y) -> 0..1 shadow of the lips etc. (device px); o.mat; o.translucent (0..1)
 */
function toothShape(kind, lower) {
  if (kind === 'c') return { hw: v => lerp(0.8, 1.0, sstep(-0.1, 0.45, v)) * (1 - 0.25 * sstep(0.75, 1.05, v)), tip: u => 1 - 0.2 * Math.pow(Math.abs(u - 0.06), 1.3), rc: 0.5 };
  if (kind === 'pm') return { hw: v => lerp(0.82, 1.0, sstep(-0.1, 0.4, v)), tip: u => 1 - 0.16 * Math.pow(Math.abs(u), 1.6), rc: 0.5 };
  if (kind === 'm') return { hw: v => lerp(0.88, 1.0, sstep(-0.1, 0.3, v)), tip: u => 1 - 0.07 * u * u - 0.035 * Math.abs(Math.sin(Math.PI * u)), rc: 0.4 };
  const rc = kind === 'ci' ? (lower ? 0.16 : 0.2) : (lower ? 0.24 : 0.38), rv = kind === 'ci' ? 0.07 : 0.12;
  return { hw: v => lerp(lower ? 0.84 : 0.8, 1.0, sstep(-0.1, 0.4, v)),
    tip: u => { const au = Math.abs(u); return au < 1 - rc ? 1 - 0.012 * au : 1 - rv * (1 - Math.sqrt(Math.max(0, 1 - Math.pow((au - (1 - rc)) / rc, 2)))); }, rc };
}
function teethPP(g, st, teeth, o) {
  o = Object.assign({ mat: MAT.tooth, translucent: 1, seed: 'teeth', lw: 1 }, o || {});
  const s = scaleOf(g), fp = o.lw * s, m = g.getTransform(), inv = m.inverse(), Wc = g.canvas.width, Hc = g.canvas.height;
  const list = o.sorted ? teeth : teeth.slice().sort((a, b) => (a.z || 0) - (b.z || 0));
  const D3 = [0, 0, 0], S3 = [0, 0, 0];
  const IV = hex2rgb(o.ivory || '#F0EADC'), NECK = hex2rgb('#D6C29E'), YEL = hex2rgb('#E8D6AE'), TRANS = hex2rgb('#A6B2C2');
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  for (const t of list) {
    const sh = toothShape(t.kind || 'ci', t.lower), ca = Math.cos(t.ang), sa = Math.sin(t.ang);
    const ax = -sa, ay = ca, bxv = ca, byv = sa;            // across, along (user space)
    const hwMax = t.w / 2, Lt = t.L, v0 = -0.35;
    // user-space bbox
    const pts = [];
    for (const [uu, vv] of [[-1.1, v0], [1.1, v0], [-1.1, 1.08], [1.1, 1.08]]) pts.push([t.x + ax * uu * hwMax + bxv * vv * Lt, t.y + ay * uu * hwMax + byv * vv * Lt]);
    const dx = pts.map(p => m.a * p[0] + m.c * p[1] + m.e), dy = pts.map(p => m.b * p[0] + m.d * p[1] + m.f);
    const bx0 = clamp(Math.floor(Math.min(...dx)) - 1, 0, Wc), by0 = clamp(Math.floor(Math.min(...dy)) - 1, 0, Hc);
    const bx1 = clamp(Math.ceil(Math.max(...dx)) + 1, 0, Wc), by1 = clamp(Math.ceil(Math.max(...dy)) + 1, 0, Hc);
    const bw = bx1 - bx0, bh = by1 - by0; if (bw <= 0 || bh <= 0) continue;
    const id = g.getImageData(bx0, by0, bw, bh), d = id.data;
    const r = rng((t.seed || o.seed) + ':tooth');
    const tint = t.tint || 0, ao0 = t.ao === undefined ? 1 : t.ao, z = t.z || 0, tr = o.translucent * (t.trans === undefined ? 1 : t.trans);
    const crazeU = r() * 1.4 - 0.7, crazeK = r() < 0.5 ? 0.06 : 0;
    const sd = hashStr((t.seed || o.seed) + 'n') % 9973;
    const pxU = hwMax * s, pxL = Lt * s;                       // device px per unit
    const rotA = Math.atan2(m.b, m.a);
    for (let yy = 0; yy < bh; yy++) for (let xx = 0; xx < bw; xx++) {
      const X = bx0 + xx + 0.5, Y = by0 + yy + 0.5;
      const ux = inv.a * X + inv.c * Y + inv.e - t.x, uy = inv.b * X + inv.d * Y + inv.f - t.y;
      const u = (ux * ax + uy * ay) / hwMax, v = (ux * bxv + uy * byv) / Lt;
      if (v < v0 || v > 1.1 || Math.abs(u) > 1.1) continue;
      const hw = sh.hw(v), tipv = sh.tip(u);
      const dS = (hw - Math.abs(u)) * pxU, dT = (tipv - v) * pxL, dd = Math.min(dS, dT, (v - v0) * pxL + 2);
      const a = clamp(dd + 0.5, 0, 1); if (a <= 0) continue;
      // normal in tooth space: across curvature, along convexity, rounded tip and sides
      const q = u / hw;
      let nxl = q * 0.38 + Math.pow(Math.abs(q), 7) * Math.sign(q) * 1.3;
      const tipZone = 1 - clamp(dT / (0.05 * pxL), 0, 1);
      let nyl = (v - 0.45) * 0.3 + 0.7 * tipZone * tipZone - (v < 0.08 ? (0.08 - v) * 2.5 : 0);
      // micro relief: perikymata, developmental grooves, bumps
      nyl += 0.012 * Math.sin(v * pxL / (3.2 * fp) + noise2(u * 3, v * 4, sd) * 2) * sstep(0.1, 0.4, v) * (1 - tipZone);
      nxl += 0.05 * Math.sin(q * Math.PI * 1.5) * sstep(0.3, 0.8, v) * (t.kind === 'ci' || t.kind === 'li' ? 1 : 0);
      nxl += 0.05 * noise2(u * 5, v * 7, sd + 1); nyl += 0.05 * noise2(u * 6, v * 5, sd + 2);
      let Nx = nxl * ax + nyl * bxv, Ny = nxl * ay + nyl * byv, Nz = 1; const nl = Math.sqrt(Nx * Nx + Ny * Ny + 1);
      Nx /= nl; Ny /= nl; Nz /= nl;
      const Dx = Nx * Math.cos(rotA) - Ny * Math.sin(rotA), Dy = Nx * Math.sin(rotA) + Ny * Math.cos(rotA);
      // albedo
      let cr = IV[0], cg2 = IV[1], cb = IV[2];
      const neck = (1 - sstep(-0.05, 0.32, v)) * 0.6;
      cr = lerp(cr, NECK[0], neck); cg2 = lerp(cg2, NECK[1], neck); cb = lerp(cb, NECK[2], neck);
      cr = lerp(cr, YEL[0], tint * 0.7); cg2 = lerp(cg2, YEL[1], tint * 0.7); cb = lerp(cb, YEL[2], tint * 0.7);
      const mam = 0.7 + 0.3 * Math.cos(3 * Math.PI * u);
      const tt = sstep(0.7, 0.98, v) * mam * tr * (t.kind === 'm' || t.kind === 'pm' ? 0.4 : 1);
      cr = lerp(cr, TRANS[0], tt * 0.6); cg2 = lerp(cg2, TRANS[1], tt * 0.6); cb = lerp(cb, TRANS[2], tt * 0.6);
      const dark = 1 - 0.3 * tt;
      const halo = dT < 1.3 * fp ? 1.1 : 1;
      const craze = crazeK && Math.abs(u - crazeU - 0.1 * v) < 0.025 ? 1 - crazeK : 1;
      const fn = 1 + 0.035 * noise2(u * 9, v * 14, sd + 3) + 0.02 * (hash2(X | 0, Y | 0, sd) - 0.5);
      const alb = dark * halo * craze * fn / 255;
      // occlusion: interproximal, cervical, external
      const aoS = 0.42 + 0.58 * sstep(0.0, 0.42, hw - Math.abs(u));
      const aoG = 0.5 + 0.5 * sstep(-0.1, 0.32, v);
      const vis = t.vis ? t.vis(X, Y) : (o.vis ? o.vis(X, Y) : 1);
      const ao = aoS * aoG * ao0;
      st.shade(X, Y, z + nl * 0, Dx, Dy, Nz, o.mat, D3, S3, vis);
      const so = Math.sqrt(ao) * (0.5 + 0.5 * aoS);
      let R = cr * alb * D3[0] * ao + S3[0] * so, G = cg2 * alb * D3[1] * ao + S3[1] * so, B = cb * alb * D3[2] * ao + S3[2] * so;
      const i = (yy * bw + xx) * 4, da = d[i + 3] / 255, oa = a + da * (1 - a);
      d[i] = clamp((R * 255 * a + d[i] * da * (1 - a)) / oa, 0, 255);
      d[i + 1] = clamp((G * 255 * a + d[i + 1] * da * (1 - a)) / oa, 0, 255);
      d[i + 2] = clamp((B * 255 * a + d[i + 2] * da * (1 - a)) / oa, 0, 255);
      d[i + 3] = oa * 255;
    }
    g.putImageData(id, bx0, by0);
  }
  g.restore();
}
/* archTeeth(line, o): place teeth along a gum line [[x,y],...] (left -> right, user space).
 *  o.dir +1 teeth hang DOWN from the line (upper jaw), -1 stand up (lower jaw)
 *  o.n count, o.len incisor length, o.persp (0..1 shrink toward the corners), o.lower, o.z, o.zBack (device px drop at the corners),
 *  o.ao [centre, corner], o.seed, o.jit, o.extraW (multiplier per index fn)
 * returns tooth list ordered back -> front (corners first).
 */
const ARCH_UP = [['ci', 1.6, 1.0], ['li', 1.04, 0.84], ['c', 1.1, 1.0], ['pm', 1.0, 0.8], ['pm', 0.98, 0.76], ['m', 1.25, 0.66], ['m', 1.2, 0.6], ['m', 1.15, 0.56], ['m', 1.1, 0.52], ['m', 1.05, 0.5]];
const ARCH_LO = [['ci', 0.95, 0.86], ['li', 1.02, 0.88], ['c', 1.1, 0.96], ['pm', 1.05, 0.78], ['pm', 1.05, 0.74], ['m', 1.3, 0.62], ['m', 1.25, 0.58], ['m', 1.2, 0.55], ['m', 1.1, 0.52], ['m', 1.05, 0.5]];
function archTeeth(line, o) {
  o = Object.assign({ dir: 1, n: 14, len: 30, persp: 0.45, lower: false, z: 0, zBack: 0, ao: [1, 0.35], seed: 'arch', jit: 0.1, gapK: 0.04 }, o || {});
  const r = rng(o.seed + ':arch'), Lt = arcLen(line), half = Lt / 2, per = Math.ceil(o.n / 2);
  const A = o.lower ? ARCH_LO : ARCH_UP;
  const pf = t => 1 - o.persp * Math.pow(Math.min(1, t), 1.4);
  let lo = 0, hi = Lt, unit = 0;
  for (let it = 0; it < 40; it++) { unit = (lo + hi) / 2; let s = 0; for (let k = 0; k < per; k++) s += A[Math.min(k, A.length - 1)][1] * unit * pf(s / half) * (1 + o.gapK); if (s > half) hi = unit; else lo = unit; }
  const out = [];
  for (const sd of [-1, 1]) {
    let s = 0;
    for (let k = 0; k < per; k++) {
      if (sd > 0 && o.n % 2 === 1 && k === per - 1) break;
      const [kind, wk0, lk] = A[Math.min(k, A.length - 1)];
      const t0 = s / half, wk = wk0 * unit * pf(t0) * (1 + (r() - 0.5) * o.jit);
      const sc = half + sd * (s + wk * (1 + o.gapK) / 2);
      const [x, y, a] = along(line, sc);
      const tt = (s + wk / 2) / half;
      const ang = a + (o.dir > 0 ? Math.PI / 2 : -Math.PI / 2) + (r() - 0.5) * 0.09 * (o.crooked || 1) + sd * tt * 0.05;
      const Lk = o.len * lk * Math.pow(pf(t0), 0.6) * (1 + (r() - 0.5) * 0.12 * (o.crooked || 1));
      out.push({ x: x + (r() - 0.5) * wk * 0.04 * (o.crooked || 1), y: y + (r() - 0.5) * wk * 0.06 * (o.crooked || 1), ang, w: wk, L: Lk, kind, lower: o.lower, tint: clamp(0.08 + r() * 0.22 + tt * 0.15, 0, 1),
        ao: lerp(o.ao[0], o.ao[1], Math.pow(tt, 1.3)), z: o.z - o.zBack * tt * tt, t: tt, sd, k, seed: o.seed + ':' + sd + ':' + k });
      s += wk * (1 + o.gapK);
    }
  }
  for (const t of out) t.key = t.t + (o.lower ? 0.004 : 0);
  return out.sort((a, b) => b.key - a.key);
}
/* merge rows (back to front; upper incisors overlap the lower ones) */
function mergeRows(...rows) {
  // all lower teeth first, then the upper ones (upper incisors overlap the lower: overbite); back to front within each
  const all = [].concat(...rows);
  return all.sort((a, b) => ((a.lower ? 0 : 1) - (b.lower ? 0 : 1)) || ((b.key === undefined ? b.t : b.key) - (a.key === undefined ? a.t : a.key)));
}
/* gum band for a row of teeth: albedo path (user space) - band between the
 * line pushed toward the root by o.depth and a scalloped margin with papillae
 * reaching between the teeth. */
function gumPath(teeth, line, o) {
  o = Object.assign({ dir: 1, depth: 20, pap: 0.22, arc: 0.06 }, o || {});
  const srt = teeth.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const Lt = arcLen(line), N = 220, mar = [], top = [];
  for (let i = 0; i <= N; i++) {
    const s = Lt * i / N, [x, y, a] = along(line, s);
    const nx = -Math.sin(a) * o.dir, ny = Math.cos(a) * o.dir;     // toward the teeth
    // nearest tooth (by projection)
    let best = null, bd = 1e9;
    for (const t of srt) { const dd = Math.hypot(t.x - x, t.y - y); if (dd < bd) { bd = dd; best = t; } }
    const uu = best ? clamp(bd / (best.w / 2), 0, 1.2) : 1;
    // margin: arcs toward the root over each tooth, papilla down between teeth
    const sc = best ? best.L * (o.pap * Math.pow(uu, 2.4) - o.arc * (1 - uu * uu)) : 0;
    mar.push([x + nx * sc, y + ny * sc]);
    top.push([x - nx * o.depth, y - ny * o.depth]);
  }
  return { path: polyPath(mar.concat(top.reverse()), true), mar };
}

/* gumsPP(g, st, teeth, line, o): wet gums over a row of teeth, shaded per pixel.
 *  o.dir (+1 upper), o.depth (user units toward the root), o.pap, o.arc, o.col [root, mid, margin],
 *  o.height, o.round, o.z, o.fade (fraction of depth fading to black at the root side), o.lw, o.seed, o.vis
 */
function gumsPP(g, st, teeth, line, o) {
  o = Object.assign({ dir: 1, depth: 30, pap: 0.22, arc: 0.06, col: ['#5E2A32', '#B56E74', '#D99C9A'], height: 8, round: 5, z: 0, fade: 0.55, lw: 1, seed: 'gum', ridge: 0.35 }, o || {});
  const gp = gumPath(teeth, line, o), m = g.getTransform();
  // tooth axes in device px (root ridges)
  const ax = teeth.map(t => { const x = m.a * t.x + m.c * t.y + m.e, y = m.b * t.x + m.d * t.y + m.f; const dx = m.a * Math.cos(t.ang) + m.c * Math.sin(t.ang), dy = m.b * Math.cos(t.ang) + m.d * Math.sin(t.ang); const l = Math.hypot(dx, dy); return [x, y, dx / l, dy / l, t.w * scaleOf(g) / 2, t.ao === undefined ? 1 : t.ao]; });
  return pillowPP(g, st, (lg) => {
    // albedo: deep at the root side, pinker and paler toward the margin; fades to black at the root
    const [x0, y0] = along(line, arcLen(line) / 2);
    const a = along(line, arcLen(line) / 2)[2], nx = -Math.sin(a) * o.dir, ny = Math.cos(a) * o.dir;
    const gr = lg.createLinearGradient(x0 - nx * o.depth, y0 - ny * o.depth, x0 + nx * o.depth * 0.25, y0 + ny * o.depth * 0.25);
    gr.addColorStop(0, '#000000'); gr.addColorStop(o.fade * 0.6, o.col[0]); gr.addColorStop(0.75, o.col[1]); gr.addColorStop(1, o.col[2]);
    lg.fillStyle = gr; lg.fill(gp.path);
    // stipple and small vessels
    const r = rng(o.seed + ':st'); lg.save(); lg.clip(gp.path);
    for (let k = 0; k < 3; k++) {
      let s0 = r() * arcLen(line), [px, py, aa] = along(line, s0); let x = px - nx * o.depth * (0.3 + r() * 0.4), y = py - ny * o.depth * (0.3 + r() * 0.4), ang = aa + (r() - 0.5);
      lg.strokeStyle = 'rgba(120,40,60,0.18)'; lg.lineWidth = o.lw * 0.8; lg.beginPath(); lg.moveTo(x, y);
      for (let q = 0; q < 8; q++) { ang += (r() - 0.5) * 0.8; x += Math.cos(ang) * o.depth * 0.12; y += Math.sin(ang) * o.depth * 0.12; lg.lineTo(x, y); }
      lg.stroke();
    }
    lg.restore();
  }, { mat: MAT.gum, height: o.height, round: o.round, z: o.z, lw: o.lw, seed: o.seed, noise: [0.25 * o.lw * scaleOf(g), 3 * o.lw * scaleOf(g)], vis: o.vis,
    extraH: (hA, bw, bh, box) => {
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        const j = y * bw + x; if (hA[j] <= 0.01) continue;
        const X = x + box.x, Y = y + box.y; let add = 0, aoK = 1;
        for (const [tx, ty, dx, dy, hw, ao] of ax) {
          const ux = X - tx, uy = Y - ty, al = ux * dx + uy * dy, ac = (-ux * dy + uy * dx) / hw;
          if (al > hw * 0.5 || al < -hw * 6 || Math.abs(ac) > 2) continue;
          add += Math.exp(-ac * ac * 1.6) * sstep(-hw * 6, -hw * 0.5, al) * hw * o.ridge * ao;
        }
        hA[j] += add;
      }
    } });
}

/* ------------------------------------------------------------- RELIEF with materials
 * reliefPP(st, o) - shade a full height field (device px) with per-pixel materials,
 * soft cast shadows toward light 0 and a cavity term.
 *  o.W, o.H, o.h (Float32Array), o.alb (ImageData), o.matId (Uint8Array) + o.mats [..], or o.mat
 *  o.shadow {steps, soft, bias, maxDist} | false, o.cavity, o.cavityR, o.zk (height multiplier for light distance)
 * returns {img: ImageData, key: Float32Array (key-light term incl. shadow)}
 */
function reliefPP(st, o) {
  const W = o.W, H = o.H, h = o.h, n = W * H, alb = o.alb.data, out = new ImageData(W, H), d = out.data;
  const mats = o.mats || [o.mat || MAT.felt], mid = o.matId;
  const bl = new Float32Array(h); fblur(bl, W, H, o.cavityR || 16);
  const ck = o.cavity === undefined ? 0.015 : o.cavity;
  const sh = o.shadow === false ? null : Object.assign({ steps: 64, soft: 8, bias: 1.2, maxDist: 500 }, o.shadow || {});
  let hmax = 0; for (let i = 0; i < n; i++) if (h[i] > hmax) hmax = h[i];
  const key = new Float32Array(n), D3 = [0, 0, 0], S3 = [0, 0, 0], L0 = st.L[0];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, j = i * 4;
    if (alb[j + 3] === 0) continue;
    const hz = h[i];
    let nx = -(h[i + 1] - h[i - 1]) * 0.5, ny = -(h[i + W] - h[i - W]) * 0.5, nz = 1; const nl = Math.sqrt(nx * nx + ny * ny + 1); nx /= nl; ny /= nl; nz /= nl;
    const ao = clamp(1 - Math.max(0, bl[i] - hz) * ck, 0.12, 1);
    let vis = 1;
    const matI = mid ? mats[mid[i]] || mats[0] : mats[0];
    if (sh && !matI.noShadow) {
      let lx = L0.x - x, ly = L0.y - y, lz = L0.z - hz; const len2 = Math.hypot(lx, ly) || 1e-6;
      const dzs = lz / len2; lx /= len2; ly /= len2;
      let t = 1.5, minr = 1;
      for (let s = 0; s < sh.steps; s++) {
        const sx = x + lx * t, sy = y + ly * t;
        if (sx < 0 || sy < 0 || sx >= W - 1 || sy >= H - 1) break;
        const zr = hz + dzs * t; if (zr > hmax + 2) break;
        const diff = zr - h[(sy | 0) * W + (sx | 0)] - sh.bias * Math.min(1, t / 8);
        if (diff < 0) { minr = 0; break; }
        const v = sh.soft * diff / t; if (v < minr) minr = v;
        t += 1.2 * (1 + s * 0.09); if (t > sh.maxDist) break;
      }
      vis = clamp(minr, 0, 1);
    }
    if (matI.visK !== undefined) vis = lerp(matI.visK, 1, vis);
    st.shade(x + 0.5, y + 0.5, hz * (o.zk || 1), nx, ny, nz, matI, D3, S3, vis);
    key[i] = vis;
    const so = Math.sqrt(ao);
    d[j] = clamp(alb[j] * D3[0] * ao + S3[0] * 255 * so, 0, 255);
    d[j + 1] = clamp(alb[j + 1] * D3[1] * ao + S3[1] * 255 * so, 0, 255);
    d[j + 2] = clamp(alb[j + 2] * D3[2] * ao + S3[2] * 255 * so, 0, 255);
    d[j + 3] = alb[j + 3];
  }
  return { img: out, key };
}


root.HZ = {
  TAU, DEG, lerp, clamp, sstep, hashStr, mulberry32, rng, hash2, noise2, noise1, fbm,
  mk, scaleOf, layerOf, blit, polyPath, hex2rgb, rgba, mixc, resample, arcLen, along,
  fblur, readMask, lumaOf, eyeShape, wetEye, irisCanvas, noiseCanvas, teethRow, layoutTeeth, toothPath, skinPatch, relief, hatch, tremor,
  quantiles, levels, tone, budget, smear, grain, downsample, unsharp,
  MAT, mergeRows, stage, devBox, rotOf, irisTexture, eyePP, eyeLidRing, lidMargins, pillowPP, gumsPP, toothShape, teethPP, archTeeth, gumPath, reliefPP,
};
})(typeof window !== 'undefined' ? window : globalThis);
