/* poppy.js - THE WORLD OF POPPY: character drawing library (HTML canvas 2D).
 *
 * Poppy is an ORIGINAL felt mascot of the fictional "Sunny Meadow Home Video":
 * a big round cream felt head framed by a bonnet-ring of nine red poppy petals,
 * a black seed-pod button nose, button eyes, a painted smile, yellow overalls,
 * a green "stem" turtleneck and white four-digit cartoon gloves.
 *
 * Usage (in a browser page):
 *   Poppy.drawPoppy(ctx, opts)          -> draws a (transparent) cutout of Poppy
 *   Poppy.renderAsset(name, canvas)     -> draws one manifest asset by basename
 *
 * Main opts for drawPoppy (all optional):
 *   pose:   'stand' | 'wave' | 'point' | 'cover' | 'close' (head + shoulders)
 *   waveTilt: degrees for the raised glove (wave pose)
 *   mouth:  'smile' | 'open' | 'grin' (parted lips on identical square teeth)
 *           | 'grinClosed' (thin row of teeth) | 'scream' | 'hang' (costume hole)
 *   smileW: half-width of the smile in head radii (stage 1: eye centre = 0.36)
 *   eyes:   'button' | 'drift' | 'black' | 'hollow' | 'real' | 'closed'
 *   eyeClosed: [leftOnScreen, rightOnScreen] booleans (wink)
 *   eyeW:   eye width as a fraction of head width (0.18-0.27)
 *   pupil:  pupil diameter as a fraction of eye width
 *   gaze:   {x, y} pupil offset in eye widths (both eyes); drift: extra outward offset
 *   tilt:   head tilt in degrees (clockwise)
 *   stretch:{neck, arms, fingers, faceY}  elongation multipliers
 *   decay:  0..1 (fading, stains, fraying, pulled stitches)  missing: [petal indices]
 *   light:  {x, y} direction towards the key light (screen space), tint: '#rrggbb'
 *   seed:   integer; every part has its own RNG stream so variants differ only
 *           in the parts that change (registration-safe lip flaps and blinks).
 */
(function (root) {
'use strict';

const TAU = Math.PI * 2, DEG = Math.PI / 180;

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
function rng(name) { return mulberry32(hashStr(ENV.seed + ':' + name)); }
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------------------------------------------------------------- color */
function hex2rgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgb2hex(c) { return '#' + c.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function mixc(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => lerp(v, B[i], t))); }
function shade(h, amt) { return amt < 0 ? mixc(h, '#000000', -amt) : mixc(h, '#ffffff', amt); }
function rgba(h, a) { const c = hex2rgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function desat(h, t) { const c = hex2rgb(h); const l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; return rgb2hex(c.map(v => lerp(v, l, t))); }

/* Palette, aged by decay (faded, greyer, a little yellowed). */
function palette(decay) {
  const base = {
    face: '#F3D9B8', faceHi: '#FCEBD6', faceLo: '#D9AE84', faceLine: '#B88A60',
    petal: '#D7262B', petalDk: '#9E1A1F', petalHi: '#EC5444', petalLine: '#6E0D14',
    blotch: '#140606',
    eyeWhite: '#FBF8F2', eyeLine: '#9A8A78',
    cherry: '#6E1020', mouthIn: '#4A0B16', tongue: '#E58090',
    cheek: '#F58FA0',
    stem: '#4E9A3A', stemDk: '#2F6B22', shirt: '#4E9A3A',
    overall: '#F2C230', overallDk: '#C9921A', overallLine: '#9A6A10',
    button: '#FFFDF6', glove: '#FBFAF6', gloveLine: '#8C8A86',
    shoe: '#7A4A2A', shoeDk: '#4A2A16',
    nose: '#0B0B0D', crown: '#3A3A3E',
    sclera: '#ECE5D3', teeth: '#FFFFFF',
  };
  if (!decay) return base;
  const out = {};
  for (const k in base) {
    let c = base[k];
    if (k === 'teeth' || k === 'nose' || k === 'blotch' || k === 'sclera') { out[k] = c; continue; }
    c = desat(c, 0.38 * decay);
    c = mixc(c, '#8A7D62', 0.16 * decay);
    c = shade(c, -0.10 * decay);
    out[k] = c;
  }
  return out;
}

/* --------------------------------------------------------- environment */
const ENV = { W: 0, H: 0, seed: 7, tex: null, texB: null, px: 1, castK: 1, light: { x: -0.55, y: -0.83 }, P: palette(0) };
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const POOL = [];
function reset(L) {
  const g = L.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  g.filter = 'none'; g.shadowColor = 'rgba(0,0,0,0)'; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0;
  g.clearRect(0, 0, L.width, L.height);
  return g;
}
function acquire() {
  for (const L of POOL) if (!L._busy && L.width === ENV.W && L.height === ENV.H) { L._busy = true; reset(L); return L; }
  const L = mk(ENV.W, ENV.H); L._busy = true; POOL.push(L); return L;
}
function release(...Ls) { for (const L of Ls) L._busy = false; }
function ident(g) { g.setTransform(1, 0, 0, 1, 0, 0); }
function scaleOf(ctx) { const m = ctx.getTransform(); return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)); }
/* n screen pixels expressed in the current local units */
function lpx(ctx, n) { return n / scaleOf(ctx); }
function toScreen(ctx, x, y) { const m = ctx.getTransform(); return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }; }

/* ---------------------------------------------------------- felt texture
 * Neutral grey (128) noise used with 'overlay': multi-scale mottling,
 * per-pixel grain, and thousands of short curly fibres, blurred 0.6 px. */
const TEXC = {};
function feltTexture(w, h, seed, scale) {
  const key = [w, h, seed, scale.toFixed(2)].join('_');
  if (TEXC[key]) return TEXC[key];
  const c = mk(w, h), g = c.getContext('2d');
  const r = mulberry32(hashStr('felt' + key));
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, w, h);
  const blot = (cell, amp, alpha) => {
    const sw = Math.max(2, Math.ceil(w / cell)) + 1, sh = Math.max(2, Math.ceil(h / cell)) + 1;
    const s = mk(sw, sh), sg = s.getContext('2d'), id = sg.createImageData(sw, sh);
    for (let i = 0; i < sw * sh; i++) {
      const v = 128 + (r() * 2 - 1) * amp;
      id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255;
    }
    sg.putImageData(id, 0, 0);
    g.save(); g.globalAlpha = alpha; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(s, 0, 0, sw * cell, sh * cell); g.restore();
  };
  blot(46 * scale, 22, 0.5);
  blot(12 * scale, 40, 0.45);
  blot(3.2 * scale, 52, 0.55);
  const id = g.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 34; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
  // fibres
  const f = mk(w, h), fg = f.getContext('2d');
  fg.lineCap = 'round';
  const n = Math.round(w * h / (26 * scale * scale));
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, a = r() * TAU, len = (2.5 + r() * 9) * scale, bend = (r() - 0.5) * 1.6;
    const lt = r() < 0.5;
    fg.strokeStyle = lt ? `rgba(255,255,255,${0.18 + r() * 0.22})` : `rgba(0,0,0,${0.16 + r() * 0.2})`;
    fg.lineWidth = (0.45 + r() * 0.8) * Math.min(scale, 2.2);
    fg.beginPath(); fg.moveTo(x, y);
    const mx = x + Math.cos(a + bend) * len * 0.5, my = y + Math.sin(a + bend) * len * 0.5;
    fg.quadraticCurveTo(mx, my, x + Math.cos(a) * len, y + Math.sin(a) * len); fg.stroke();
  }
  g.filter = `blur(${0.6 * Math.max(1, scale * 0.8)}px)`; g.drawImage(f, 0, 0); g.filter = 'none';
  TEXC[key] = c;
  return c;
}

/* ------------------------------------------------------------- paths */
function ellipse(cx, cy, rx, ry, rot) { const p = new Path2D(); p.ellipse(cx, cy, rx, ry, rot || 0, 0, TAU); return p; }
function circle(cx, cy, r) { return ellipse(cx, cy, r, r); }
/* closed Catmull-Rom spline through pts -> Path2D (or appended to p) */
function smoothClosed(pts, p, tension) {
  p = p || new Path2D(); const n = pts.length, k = (tension || 1) / 6;
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    p.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k,
      p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k, p2[0], p2[1]);
  }
  p.closePath(); return p;
}
function smoothOpen(pts, p, tension) {
  p = p || new Path2D(); const n = pts.length, k = (tension || 1) / 6;
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    p.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k,
      p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k, p2[0], p2[1]);
  }
  return p;
}
/* sample a Catmull-Rom centreline */
function sampleSpline(pts, per) {
  const out = []; const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    for (let s = 0; s < per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0[0], p1[0], p2[0], p3[0]), y: f(p0[1], p1[1], p2[1], p3[1]), u: (i + t) / (n - 1) });
    }
  }
  out.push({ x: pts[n - 1][0], y: pts[n - 1][1], u: 1 });
  return out;
}
/* tube (sleeve, leg, neck): centreline through pts, width per point, round caps */
function tube(pts, widths, opts) {
  opts = opts || {};
  const S = sampleSpline(pts, 14), n = S.length;
  const wAt = u => { const f = u * (widths.length - 1), i = Math.min(widths.length - 2, Math.floor(f)); return lerp(widths[i], widths[i + 1], f - i); };
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = S[Math.max(0, i - 1)], b = S[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const w = wAt(S[i].u) / 2 * (opts.wobble ? 1 + opts.wobble(S[i].u) : 1);
    L.push([S[i].x - ty * w, S[i].y + tx * w]); R.push([S[i].x + ty * w, S[i].y - tx * w]);
  }
  const p = new Path2D();
  p.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) p.lineTo(L[i][0], L[i][1]);
  const e = S[n - 1], ea = Math.atan2(L[n - 1][1] - e.y, L[n - 1][0] - e.x);
  if (opts.capEnd === false) p.lineTo(R[n - 1][0], R[n - 1][1]);
  else p.arc(e.x, e.y, wAt(1) / 2, ea, ea + Math.PI, true);
  for (let i = n - 2; i >= 0; i--) p.lineTo(R[i][0], R[i][1]);
  const s = S[0], sa = Math.atan2(R[0][1] - s.y, R[0][0] - s.x);
  if (opts.capStart === false) p.closePath();
  else { p.arc(s.x, s.y, wAt(0) / 2, sa, sa + Math.PI, true); p.closePath(); }
  return p;
}
function roundRect(x, y, w, h, r) { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; }

/* --------------------------------------------------------------- part()
 * Renders one felt piece: base fill (+paint details) on its own layer, felt
 * texture (overlay), puffy shading from the key light, ambient edge darkening,
 * then cast shadow onto what is already drawn (never onto empty alpha), a
 * dilated outline, and the piece itself. */
function part(ctx, paths, st) {
  st = st || {};
  const T = ctx.getTransform();
  const L = acquire(), M = acquire(), I = acquire();
  const g = L.getContext('2d'), mg = M.getContext('2d'), ig = I.getContext('2d');
  const s = ENV.px, BIG = 30000, lx = ENV.light.x, ly = ENV.light.y;
  g.setTransform(T);
  const list = Array.isArray(paths) ? paths : [paths];
  g.fillStyle = typeof st.fill === 'function' ? st.fill(g) : (st.fill || '#888');
  for (const p of list) g.fill(p, st.rule || 'nonzero');
  mg.drawImage(L, 0, 0);
  if (st.paint) { g.save(); g.globalCompositeOperation = 'source-atop'; st.paint(g, T); g.restore(); g.setTransform(T); }
  const ta = st.tex === undefined ? 0.55 : st.tex;
  if (ta > 0 && ENV.tex) {
    g.save(); ident(g); g.globalCompositeOperation = 'overlay'; g.globalAlpha = ta;
    g.drawImage(st.texB ? ENV.texB : ENV.tex, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in'; g.drawImage(M, 0, 0); g.restore();
  }
  const shadeA = st.shade === undefined ? 0.42 : st.shade;
  const ao = st.ao === undefined ? 0.22 : st.ao, hi = st.hi === undefined ? 0.16 : st.hi;
  if (shadeA > 0 || ao > 0 || hi > 0) {
    ig.fillStyle = '#000'; ig.fillRect(0, 0, ENV.W, ENV.H);
    ig.globalCompositeOperation = 'destination-out'; ig.drawImage(M, 0, 0); ig.globalCompositeOperation = 'source-over';
    g.save(); ident(g); g.globalCompositeOperation = 'source-atop';
    const sh = (color, blur, dx, dy) => { g.shadowColor = color; g.shadowBlur = blur; g.shadowOffsetX = BIG + dx; g.shadowOffsetY = dy; g.drawImage(I, -BIG, 0); };
    const sd = (st.shadeDist || 10) * s, sb = (st.shadeBlur || 16) * s;
    const sc = st.shadeColor || '#3A1E10';
    if (shadeA > 0) sh(rgba(sc, shadeA), sb, lx * sd, ly * sd);
    if (ao > 0) sh(rgba(sc, ao), (st.aoBlur || 5) * s, 0, 0);
    if (hi > 0) sh(rgba(st.hiColor || '#FFFFFF', hi), sb * 0.8, -lx * sd * 0.7, -ly * sd * 0.7);
    g.restore();
  }
  if (st.post) { g.save(); g.setTransform(T); g.globalCompositeOperation = 'source-atop'; st.post(g, T); g.restore(); }
  ctx.save(); ident(ctx);
  if (st.cast) {
    const c = st.cast;
    ctx.globalCompositeOperation = 'source-atop';
    ctx.shadowColor = rgba(c.color || '#1A0805', c.alpha); ctx.shadowBlur = c.blur * s;
    const dx = c.dx !== undefined ? c.dx : -lx * c.dist * ENV.castK, dy = c.dy !== undefined ? c.dy : -ly * c.dist * ENV.castK;
    ctx.shadowOffsetX = BIG + dx * s; ctx.shadowOffsetY = dy * s;
    ctx.drawImage(M, -BIG, 0);
    ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.globalCompositeOperation = 'source-over';
  }
  if (st.outline) {
    reset(I); const og = I.getContext('2d');
    og.drawImage(M, 0, 0); og.globalCompositeOperation = 'source-in'; og.fillStyle = st.outline; og.fillRect(0, 0, ENV.W, ENV.H);
    const w = (st.outlineW || 1.5) * s;
    for (let k = 0; k < 12; k++) { const a = k * TAU / 12; ctx.drawImage(I, Math.cos(a) * w, Math.sin(a) * w); }
  }
  ctx.globalAlpha = st.alpha === undefined ? 1 : st.alpha;
  ctx.drawImage(L, 0, 0);
  ctx.restore();
  if (st.onMask) st.onMask(M);
  release(L, M, I);
}

/* stroke helper in local units */
function strokeP(g, path, color, w, cap) {
  g.save(); g.strokeStyle = color; g.lineWidth = w; g.lineCap = cap || 'round'; g.lineJoin = 'round'; g.stroke(path); g.restore();
}
/* stitched line (dashes of thread) */
function stitches(g, path, color, w, dash, gap) {
  g.save(); g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.setLineDash([dash, gap]); g.stroke(path); g.restore();
}

/* ================================================================ HEAD */
/* Head-local units: face radius = 1, origin = face centre, y down. */
function headDefaults(o) {
  const H = Object.assign({
    cx: 210, cy: 190, R: 80, tilt: 12, sx: 1, sy: 1,
    eyes: 'button', eyeW: 0.20, eyeSep: 0.36, eyeY: -0.08, asym: true,
    pupil: 0.36, gaze: { x: -0.05, y: 0.02 }, drift: 0.08, eyeClosed: [false, false],
    mouth: 'smile', smileW: 0.36, teeth: 0,
    petalR: 1.5, petalFlare: 1, crush: null, missing: [], petalBottom: 0.88,
    decay: 0, costume: false, realGlint: false, deepEyes: false,
    pupilsCentered: false,
  }, o || {});
  return H;
}

function eyeGeom(H) {
  const out = [];
  for (const side of [-1, 1]) {
    let w = H.eyeW * 2, h = w * (H.eyeAspect || 1.3), cy = H.eyeY;
    if (H.asym && side === 1) { w *= 1.07; h *= 1.07; cy -= 3 / 80; }   // 3 px at full-body scale
    out.push({ side, cx: side * H.eyeSep, cy, w, h });
  }
  return out;
}

/* ---- petals */
function petalPath(th, hw, rIn, rOut, r) {
  const P = (rad, a) => [Math.cos(a) * rad, Math.sin(a) * rad];
  const pts = [];
  pts.push(P(rIn, th - hw * 0.35));
  pts.push(P(lerp(rIn, rOut, 0.45), th - hw * 0.95));
  pts.push(P(lerp(rIn, rOut, 0.80), th - hw * 1.04));
  const K = 9;
  for (let k = 0; k <= K; k++) {
    const u = k / K, a = th + (u - 0.5) * 2 * hw * 0.97;
    const rr = rOut * (0.9 + 0.1 * Math.sin(Math.PI * u)) * (1 + (r() - 0.5) * 0.05);
    pts.push(P(rr, a));
  }
  pts.push(P(lerp(rIn, rOut, 0.80), th + hw * 1.04));
  pts.push(P(lerp(rIn, rOut, 0.45), th + hw * 0.95));
  pts.push(P(rIn, th + hw * 0.35));
  return smoothClosed(pts);
}

/* flared, pointed petal for the threat display */
function petalPathPointy(th, hw, rIn, rOut, r, k) {
  const P = (rad, a) => [Math.cos(a) * rad, Math.sin(a) * rad];
  const pts = [P(rIn, th - hw * 0.35), P(lerp(rIn, rOut, 0.45), th - hw * 1.05), P(lerp(rIn, rOut, 0.78), th - hw * 0.95)];
  const K = 8;
  for (let q = 0; q <= K; q++) {
    const u = q / K, a = th + (u - 0.5) * 2 * hw * 0.8;
    const tip = Math.pow(Math.sin(Math.PI * u), 3);
    pts.push(P(rOut * (0.82 + 0.18 * tip * k + (r() - 0.5) * 0.06) , a));
  }
  pts.push(P(lerp(rIn, rOut, 0.78), th + hw * 0.95), P(lerp(rIn, rOut, 0.45), th + hw * 1.05), P(rIn, th + hw * 0.35));
  return smoothClosed(pts, null, 0.8);
}

function drawPetals(ctx, H) {
  const P = ENV.P, N = 9;
  const order = [0, 2, 4, 6, 8, 1, 3, 5, 7];
  for (const i of order) {
    const r = rng('petal' + i);
    const th = -Math.PI / 2 + i * TAU / N + (r() - 0.5) * 0.06;
    let rOut = H.petalR * (0.97 + r() * 0.06);
    const down = Math.max(0, Math.sin(th));          // 1 at the bottom
    rOut *= lerp(1, H.petalBottom, down * down);
    rOut *= H.petalFlare;
    let hw = Math.PI / N * (i % 2 ? 1.42 : 1.30);
    let crushK = 1;
    for (const c of (H.crush ? [].concat(H.crush) : [])) {   // crushed / folded on one side
      const d = Math.cos(th - c.angle);
      if (d > 0.2) { crushK = lerp(1, c.amount, (d - 0.2) / 0.8); rOut = lerp(1.02, rOut, crushK); hw *= lerp(1, c.squeeze || 0.75, 1 - crushK); }
    }
    if (H.missing.indexOf(i) >= 0) {
      // torn stub: a short ragged remnant
      const rs = rng('stub' + i); const pts = [];
      for (let k = 0; k <= 10; k++) {
        const u = k / 10, a = th + (u - 0.5) * 2 * hw * 0.8;
        pts.push([Math.cos(a) * (1.02 + 0.13 * rs() + 0.05 * Math.sin(u * 23)), Math.sin(a) * (1.02 + 0.13 * rs() + 0.05 * Math.sin(u * 23))]);
      }
      pts.push([Math.cos(th + hw * 0.5) * 0.6, Math.sin(th + hw * 0.5) * 0.6]);
      pts.push([Math.cos(th - hw * 0.5) * 0.6, Math.sin(th - hw * 0.5) * 0.6]);
      const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (const q of pts) p.lineTo(q[0], q[1]); p.closePath();
      part(ctx, p, { fill: P.petalDk, tex: 0.4, shade: 0.3, outline: P.petalLine, outlineW: 1.1, cast: { alpha: 0.3, blur: 5, dist: 3 } });
      continue;
    }
    const path = H.petalPointy ? petalPathPointy(th, hw, 0.55, rOut, r, H.petalPointy) : petalPath(th, hw, 0.55, rOut, r);
    const bright = 0.92 + r() * 0.16;
    part(ctx, path, {
      fill: g => {
        const gr = g.createRadialGradient(0, 0, 0.4, 0, 0, rOut);
        gr.addColorStop(0, shade(P.petalDk, -0.3));
        gr.addColorStop(clamp(1.0 / rOut, 0, 1), P.petalDk);
        gr.addColorStop(clamp(1.12 / rOut, 0, 1), shade(P.petal, bright < 1 ? (bright - 1) : 0));
        gr.addColorStop(0.86, shade(P.petal, (bright - 1) * 0.6 + 0.04));
        gr.addColorStop(1, shade(P.petalHi, (bright - 1) * 0.5));
        return gr;
      },
      paint: (g) => {
        const lw = lpx(g, 1);
        // fine veins
        const nv = 15;
        for (let k = 0; k < nv; k++) {
          const a = th + (k / (nv - 1) - 0.5) * 2 * hw * 0.82 + (r() - 0.5) * 0.04;
          const r0 = 1.0 + r() * 0.06, r1 = rOut * (0.86 + r() * 0.1);
          const ca = a + (r() - 0.5) * 0.12;
          const v = new Path2D(); v.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
          v.quadraticCurveTo(Math.cos(ca) * (r0 + r1) / 2, Math.sin(ca) * (r0 + r1) / 2, Math.cos(a) * r1, Math.sin(a) * r1);
          strokeP(g, v, rgba(P.petalLine, 0.28), lw * (0.7 + r() * 0.5));
          if (k % 2) { g.save(); g.translate(lw * 1.2, lw * 0.8); strokeP(g, v, 'rgba(255,170,150,0.16)', lw * 0.7); g.restore(); }
        }
        // soft radial pleats (crinkled tissue felt)
        for (let k = 0; k < 7; k++) {
          const a = th + (r() - 0.5) * hw * 1.6, r0 = 1.0 + r() * 0.1, r1 = rOut * (0.8 + r() * 0.18), bend = (r() - 0.5) * 0.08;
          const c = new Path2D(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
          c.quadraticCurveTo(Math.cos(a + bend) * (r0 + r1) / 2, Math.sin(a + bend) * (r0 + r1) / 2, Math.cos(a + bend * 0.5) * r1, Math.sin(a + bend * 0.5) * r1);
          const dark = k % 2 === 0;
          g.save(); g.filter = `blur(${(dark ? 1.6 : 2.2) * ENV.px}px)`;
          strokeP(g, c, dark ? rgba(P.petalLine, 0.30) : 'rgba(255,140,120,0.22)', lw * (dark ? 2.6 : 3.4) * ENV.px);
          g.restore();
        }
        // translucent rim
        g.save(); g.lineWidth = lw * 3 * ENV.px; g.strokeStyle = 'rgba(255,130,110,0.25)'; g.stroke(path); g.restore();
        // black blotch at the base (mostly hidden under the face)
        const bx = Math.cos(th) * 1.0, by = Math.sin(th) * 1.0;
        const bg = g.createRadialGradient(bx, by, 0, bx, by, 0.15);
        bg.addColorStop(0, rgba(P.blotch, 0.8)); bg.addColorStop(0.5, rgba(P.blotch, 0.45)); bg.addColorStop(1, rgba(P.blotch, 0));
        g.fillStyle = bg; g.beginPath(); g.ellipse(bx, by, 0.15, 0.15, 0, 0, TAU); g.fill();
        if (H.petalRim) {   // hard rim light on each petal's outer edge
          const pr = H.petalRim; g.save();
          const cl = new Path2D(); cl.arc(0, 0, rOut * 3, 0, TAU); cl.arc(0, 0, 1.15, 0, TAU, true); g.clip(cl, 'evenodd');
          const dirA = Math.atan2(pr.dy, pr.dx), facing = Math.cos(th - dirA);
          if (facing > -0.2) {
            g.lineWidth = lpx(g, pr.width * (0.5 + 0.5 * Math.max(0, facing))); g.strokeStyle = pr.color; g.globalAlpha = Math.min(1, 0.35 + facing);
            g.filter = `blur(${pr.blur || 0.6}px)`; g.stroke(path);
          }
          g.restore();
        }
        if (H.petalPaint) H.petalPaint(g, th, rOut, r);
      },
      tex: 0.32, shade: 0.34, ao: 0.16, hi: 0.12, shadeColor: '#2A0306',
      outline: P.petalLine, outlineW: 1.1,
      cast: { alpha: 0.38, blur: 7, dist: 4, color: '#1A0002' },
    });
  }
}

/* ---- face disc */
function faceOutline(H) {
  if (!H.crumple) return ellipse(0, 0, 1, 0.97);
  const r = rng('crumple'), pts = [], n = 40;
  const ph = [r() * TAU, r() * TAU, r() * TAU];
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU;
    const k = 1 + H.crumple * (0.05 * Math.sin(a * 3 + ph[0]) + 0.035 * Math.sin(a * 5 + ph[1]) + 0.02 * Math.sin(a * 9 + ph[2]) + (r() - 0.5) * 0.03);
    pts.push([Math.cos(a) * k, Math.sin(a) * 0.97 * k]);
  }
  return smoothClosed(pts);
}

function drawFace(ctx, H) {
  const P = ENV.P;
  const fp = faceOutline(H);
  part(ctx, fp, {
    fill: g => {
      const gr = g.createRadialGradient(-0.28, -0.34, 0.05, 0, 0, 1.15);
      gr.addColorStop(0, P.faceHi); gr.addColorStop(0.45, P.face); gr.addColorStop(1, P.faceLo);
      return gr;
    },
    paint: g => { if (H.crumple) crumpleCreases(g, H); if (H.humanFolds) humanFolds(g, H); if (H.facePaint) H.facePaint(g); },
    tex: 0.62, shade: H.faceShade || 0.30, ao: H.faceAO || 0.20, aoBlur: H.faceAOBlur || 5, hi: 0.18, shadeDist: 14, shadeBlur: 26,
    outline: H.faceOutline || P.faceLine, outlineW: 1.3,
    cast: { alpha: 0.55, blur: 12, dist: 6, color: '#1A0002' },
  });
  // felt fuzz on the silhouette
  const r = rng('fuzz');
  ctx.save();
  const lw = lpx(ctx, 0.8 * Math.min(1.4, ENV.px));
  const n = H.fuzz === undefined ? Math.round(150 * Math.min(1.6, ENV.px)) : H.fuzz;
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, rr = 0.99 + r() * 0.012, len = lpx(ctx, (1.0 + r() * 2.0) * Math.min(1.5, ENV.px));
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.97, b = a + (r() - 0.5) * 1.4;
    ctx.strokeStyle = r() < 0.6 ? rgba(P.face, 0.55) : rgba(P.faceLo, 0.45);
    ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(b) * len * 0.6, y + Math.sin(b) * len * 0.6, x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
  }
  ctx.restore();
  return fp;
}

/* human facial structure painted onto the felt (uncanny mismatch) */
function humanFolds(g, H) {
  const k = H.humanFolds, lw = lpx(g, 1) * ENV.px;
  const soft = (path, col, w, blur) => { g.save(); g.filter = `blur(${blur * ENV.px}px)`; strokeP(g, path, col, lw * w); g.restore(); };
  for (const sd of [-1, 1]) {
    // nasolabial fold: nose wing -> past the mouth corner
    const f = new Path2D(); f.moveTo(sd * 0.13, 0.12); f.bezierCurveTo(sd * 0.3, 0.18, sd * 0.42, 0.28, sd * 0.5, 0.42);
    soft(f, `rgba(70,35,20,${0.38 * k})`, 7, 3); soft(f, `rgba(60,28,15,${0.3 * k})`, 2, 0.8);
    const fh = new Path2D(); fh.moveTo(sd * 0.15, 0.15); fh.bezierCurveTo(sd * 0.32, 0.21, sd * 0.44, 0.31, sd * 0.52, 0.45);
    g.save(); g.translate(sd * 0.025, 0.02); soft(fh, `rgba(255,240,220,${0.22 * k})`, 6, 3); g.restore();
    // under-eye bags
    const ey = (H.eyeY || -0.1), ex = sd * (H.eyeSep || 0.36), ew = H.eyeW * 2;
    const b = new Path2D(); b.moveTo(ex - ew * 0.42, ey + ew * 0.32); b.quadraticCurveTo(ex, ey + ew * 0.62, ex + ew * 0.42, ey + ew * 0.3);
    soft(b, `rgba(70,35,25,${0.4 * k})`, 6, 2.5);
    const b2 = new Path2D(); b2.moveTo(ex - ew * 0.3, ey + ew * 0.5); b2.quadraticCurveTo(ex, ey + ew * 0.72, ex + ew * 0.3, ey + ew * 0.48);
    soft(b2, `rgba(70,35,25,${0.25 * k})`, 3, 1.5);
  }
  // philtrum + chin crease
  const ph = new Path2D(); ph.moveTo(-0.03, 0.2); ph.lineTo(-0.035, 0.3); ph.moveTo(0.03, 0.2); ph.lineTo(0.035, 0.3);
  soft(ph, `rgba(70,35,20,${0.22 * k})`, 3, 1.5);
}

function crumpleCreases(g, H) {
  const r = rng('creases'), lw = lpx(g, 1);
  const n = Math.round(14 * H.crumple);
  for (let k = 0; k < n; k++) {
    const a = r() * TAU, r0 = 0.97, r1 = 0.35 + r() * 0.45, bend = (r() - 0.5) * 0.7;
    const pts = [[Math.cos(a) * r0, Math.sin(a) * r0]];
    for (let q = 1; q <= 3; q++) { const t = q / 3, rr = lerp(r0, r1, t), aa = a + bend * t + (r() - 0.5) * 0.12; pts.push([Math.cos(aa) * rr, Math.sin(aa) * rr]); }
    const c = smoothOpen(pts);
    g.save(); g.filter = `blur(${5 * ENV.px}px)`; strokeP(g, c, 'rgba(60,32,14,0.42)', lw * 11 * ENV.px); g.restore();
    g.save(); g.translate(lw * 6 * ENV.px, lw * 5 * ENV.px); g.filter = `blur(${3.5 * ENV.px}px)`; strokeP(g, c, 'rgba(255,248,232,0.30)', lw * 7 * ENV.px); g.restore();
    g.save(); g.filter = `blur(${1.2 * ENV.px}px)`; strokeP(g, c, 'rgba(50,25,10,0.14)', lw * 1.6 * ENV.px); g.restore();
  }
}

/* ---- cheeks */
function drawCheeks(ctx, H) {
  const P = ENV.P;
  for (const side of [-1, 1]) {
    const cx = side * 0.58, cy = 0.22;
    part(ctx, ellipse(cx, cy, 0.135, 0.12), {
      fill: g => { const gr = g.createRadialGradient(cx - 0.03, cy - 0.03, 0.01, cx, cy, 0.15); gr.addColorStop(0, shade(P.cheek, 0.12)); gr.addColorStop(1, shade(P.cheek, -0.05)); return gr; },
      tex: 0.45, shade: 0.16, ao: 0.08, hi: 0.1, outline: rgba(shade(P.cheek, -0.2), 0.45), outlineW: 0.7,
      cast: { alpha: 0.18, blur: 3, dist: 2 },
    });
  }
}

/* ---- nose: black poppy seed-pod button */
function drawNose(ctx, H) {
  const P = ENV.P, nx = 0, ny = H.noseY !== undefined ? H.noseY : 0.15;
  ctx.save(); ctx.translate(nx, ny); ctx.scale(1.25, 1.25); ctx.translate(-nx, -ny);
  const dome = new Path2D();
  dome.moveTo(nx - 0.09, ny - 0.015);
  dome.bezierCurveTo(nx - 0.1, ny + 0.06, nx - 0.055, ny + 0.095, nx, ny + 0.095);
  dome.bezierCurveTo(nx + 0.055, ny + 0.095, nx + 0.1, ny + 0.06, nx + 0.09, ny - 0.015);
  dome.closePath();
  part(ctx, dome, {
    fill: g => { const gr = g.createRadialGradient(nx - 0.03, ny + 0.0, 0.005, nx, ny + 0.03, 0.12); gr.addColorStop(0, '#4A4A50'); gr.addColorStop(0.45, '#1A1A1E'); gr.addColorStop(1, P.nose); return gr; },
    tex: 0, shade: 0.5, ao: 0.2, hi: 0.1, shadeColor: '#000000', outline: '#000000', outlineW: 0.8,
    cast: { alpha: 0.42, blur: 5, dist: 5 },
  });
  // flat crown with 7 rays
  const crown = ellipse(nx, ny - 0.018, 0.085, 0.034);
  part(ctx, crown, {
    fill: P.crown, tex: 0.15, shade: 0.2, ao: 0.15, hi: 0.1, outline: '#101012', outlineW: 0.8,
    paint: g => {
      const lw = lpx(g, 1);
      for (let k = 0; k < 7; k++) {
        const a = k / 7 * TAU - Math.PI / 2;
        const p = new Path2D(); p.moveTo(nx, ny - 0.018); p.lineTo(nx + Math.cos(a) * 0.075, ny - 0.018 + Math.sin(a) * 0.03);
        strokeP(g, p, '#77777E', lw * 1.3 * ENV.px);
      }
      g.fillStyle = '#5A5A60'; g.beginPath(); g.ellipse(nx, ny - 0.018, 0.012, 0.006, 0, 0, TAU); g.fill();
    },
  });
  // specular on the dome (screen-space so it agrees with the eyes)
  const sp = toScreen(ctx, nx - 0.035, ny + 0.035), s = H.R / 80;
  ctx.restore();
  ctx.save(); ident(ctx);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(sp.x, sp.y, 2.6 * s, 1.6 * s, -0.5, 0, TAU); ctx.fill();
  ctx.restore();
}

/* ---- eyes */
function buttonEye(ctx, H, e, i) {
  const P = ENV.P, rx = e.w / 2, ry = e.h / 2;
  const white = ellipse(e.cx, e.cy, rx, ry);
  part(ctx, white, {
    fill: g => { const gr = g.createRadialGradient(e.cx - rx * 0.3, e.cy - ry * 0.35, 0.01, e.cx, e.cy, ry * 1.1); gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(1, shade(P.eyeWhite, -0.06)); return gr; },
    tex: 0.42, texB: true, shade: 0.30, ao: 0.20, hi: 0.1, shadeDist: 6, shadeBlur: 10, shadeColor: '#4A3A30',
    outline: P.eyeLine, outlineW: 1.1, cast: { alpha: 0.3, blur: 4, dist: 3 },
  });
  // pupil (glossy black button)
  const pd = H.pupil * e.w, pr = pd / 2;
  let gx = H.gaze.x, gy = H.gaze.y;
  if (H.eyes === 'drift') gx += e.side * H.drift * 3;
  else if (e.side === -1) gx -= H.drift;            // one pupil drifts outward
  if (H.pupilsCentered) { gx = 0; gy = 0; }
  const px = e.cx + gx * e.w, py = e.cy + gy * e.w + ry * 0.12;
  const pp = circle(px, py, pr);
  part(ctx, pp, {
    fill: g => { const gr = g.createRadialGradient(px + pr * 0.25, py + pr * 0.35, pr * 0.05, px, py, pr * 1.05); gr.addColorStop(0, '#2E2E36'); gr.addColorStop(0.6, '#0E0E12'); gr.addColorStop(1, '#030304'); return gr; },
    paint: g => { g.strokeStyle = 'rgba(120,120,135,0.35)'; g.lineWidth = pr * 0.1; g.beginPath(); g.arc(px, py, pr * 0.82, 0, TAU); g.stroke(); },
    tex: 0, shade: 0.25, ao: 0.15, hi: 0, shadeColor: '#000000', outline: '#000000', outlineW: 0.6,
    cast: { alpha: 0.4, blur: 3, dist: 2.5 },
  });
  if (H.catchlight !== false) {
    // catchlight at the SAME screen offset in both eyes, regardless of head tilt
    const c = toScreen(ctx, px, py), prs = pr * scaleOf(ctx);
    ctx.save(); ident(ctx);
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.beginPath(); ctx.ellipse(c.x - prs * 0.34, c.y - prs * 0.36, prs * 0.30, prs * 0.22, -0.6, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(c.x + prs * 0.36, c.y + prs * 0.34, prs * 0.11, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

function closedEye(ctx, H, e) {
  const P = ENV.P, rx = e.w / 2, ry = e.h / 2;
  const lid = ellipse(e.cx, e.cy, rx, ry);
  part(ctx, lid, {
    fill: g => { const gr = g.createLinearGradient(0, e.cy - ry, 0, e.cy + ry); gr.addColorStop(0, shade(P.faceHi, 0.04)); gr.addColorStop(1, mixc(P.face, P.faceLo, 0.35)); return gr; },
    tex: 0.6, shade: 0.24, ao: 0.12, hi: 0.18, shadeDist: 6, shadeBlur: 10,
    outline: rgba(P.faceLine, 0.8), outlineW: 1.0, cast: { alpha: 0.22, blur: 4, dist: 3 },
  });
  const arc = new Path2D();
  arc.moveTo(e.cx - rx * 0.78, e.cy + ry * 0.02);
  arc.quadraticCurveTo(e.cx, e.cy + ry * 0.62, e.cx + rx * 0.78, e.cy + ry * 0.02);
  const lw = lpx(ctx, 1);
  ctx.save();
  strokeP(ctx, arc, rgba(shade(P.faceLo, -0.35), 0.5), lw * 3.4 * ENV.px);
  stitches(ctx, arc, '#3A1A12', lw * 2.2 * ENV.px, lw * 4.5 * ENV.px, lw * 3.2 * ENV.px);
  ctx.restore();
}

function blackEye(ctx, H, e) {
  const rx = e.w / 2, ry = e.h / 2 * 0.92;
  const p = ellipse(e.cx, e.cy, rx, ry);
  part(ctx, p, {
    fill: g => { const gr = g.createRadialGradient(e.cx, e.cy + ry * 0.2, rx * 0.1, e.cx, e.cy, rx * 1.1); gr.addColorStop(0, '#000000'); gr.addColorStop(0.8, '#060608'); gr.addColorStop(1, '#16161C'); return gr; },
    paint: g => {
      // broad dull sheen, NO point catchlight
      const sh = g.createLinearGradient(0, e.cy - ry, 0, e.cy - ry * 0.2);
      sh.addColorStop(0, 'rgba(200,205,220,0.20)'); sh.addColorStop(1, 'rgba(200,205,220,0)');
      g.fillStyle = sh; g.beginPath(); g.ellipse(e.cx, e.cy - ry * 0.18, rx * 0.86, ry * 0.7, 0, Math.PI, TAU); g.fill();
      g.strokeStyle = 'rgba(160,160,175,0.18)'; g.lineWidth = rx * 0.04; g.beginPath(); g.ellipse(e.cx, e.cy, rx * 0.93, ry * 0.93, 0, 0, TAU); g.stroke();
      if (H.blackEyeTint) {
        g.save(); g.beginPath(); g.ellipse(e.cx, e.cy, rx, ry, 0, 0, TAU); g.clip();
        g.filter = `blur(${2 * ENV.px}px)`; g.strokeStyle = H.blackEyeTint; g.lineWidth = rx * 0.14;
        g.beginPath(); g.ellipse(e.cx, e.cy, rx * 0.9, ry * 0.9, 0, Math.PI * 0.35, Math.PI * 0.95); g.stroke(); g.restore();
      }
    },
    tex: 0, shade: 0.2, ao: 0.1, hi: 0, shadeColor: '#000000', outline: '#000000', outlineW: 1,
    cast: { alpha: 0.5, blur: 5, dist: 4 },
  });
}

function hollowEye(ctx, H, e, i) {
  const P = ENV.P, rx = e.w / 2 * 1.04, ry = e.h / 2 * 1.02;
  const hole = ellipse(e.cx, e.cy, rx, ry);
  part(ctx, hole, {
    fill: '#050505',
    paint: g => {
      let glint = null;
      if (H.deepEyes) glint = drawDeepEye(g, H, e, i);
      // mesh
      const lw = lpx(g, 1) * Math.max(1, ENV.px * 0.7), step = H.meshStep || 0.032;
      g.lineWidth = lw * 1.1;
      for (const dir of [1, -1]) {
        for (let k = -40; k <= 40; k++) {
          const o = k * step;
          g.strokeStyle = `rgba(70,70,70,${H.meshAlpha || 0.85})`;
          g.beginPath(); g.moveTo(e.cx + o - rx * 1.2, e.cy - dir * rx * 1.2); g.lineTo(e.cx + o + rx * 1.2, e.cy + dir * rx * 1.2); g.stroke();
        }
      }
      const sh = g.createRadialGradient(e.cx - rx * 0.3, e.cy - ry * 0.4, 0, e.cx, e.cy, ry * 1.2);
      sh.addColorStop(0, 'rgba(160,160,160,0.20)'); sh.addColorStop(1, 'rgba(0,0,0,0.0)');
      g.fillStyle = sh; g.fillRect(e.cx - rx, e.cy - ry, rx * 2, ry * 2);
      if (glint) glint(g);
    },
    tex: 0, shade: 0.6, ao: 0.5, hi: 0, shadeColor: '#000000', shadeDist: 8, shadeBlur: 10, outline: shade(P.faceLine, -0.3), outlineW: 1.6,
  });
}

/* realistic human eye (painted): almond aperture, sclera visible all round,
 * radial-stroke iris with a dark limbal ring, pinpoint pupil. */
function realEye(ctx, H, e, o) {
  o = o || {};
  const P = ENV.P;
  const w = e.w, h = w * (o.open || 0.62);
  const cx = e.cx, cy = e.cy;
  const ap = new Path2D();                                   // aperture: high arched upper lid, flat lower lid
  const xi = cx - e.side * w * 0.5, xo = cx + e.side * w * 0.5;  // inner / outer corner
  const L = Math.min(xi, xo), Rr = Math.max(xi, xo);
  const yL = cy + (L === xi ? h * 0.06 : -h * 0.02), yR = cy + (Rr === xi ? h * 0.06 : -h * 0.02);
  ap.moveTo(L, yL);
  const lo = o.lower || 0.41;
  ap.bezierCurveTo(L + w * 0.18, cy - h * 0.62, Rr - w * 0.22, cy - h * 0.66, Rr, yR);
  ap.bezierCurveTo(Rr - w * 0.2, cy + h * lo, L + w * 0.2, cy + h * (lo + 0.01), L, yL);
  ap.closePath();
  const irisR = w * (o.iris || 0.21), pupilR = w * (o.pupil || 0.14) / 2;
  const gx = cx + (o.gx || 0) * w, gy = cy + (o.gy || 0) * w - h * 0.02;
  const r = rng('iris' + e.side + (o.key || ''));
  // socket shadow on the felt
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(1, 0.8);
  const sg = ctx.createRadialGradient(0, 0, w * 0.3, 0, 0, w * 0.8);
  sg.addColorStop(0, rgba('#5A3020', o.socket || 0.35)); sg.addColorStop(0.6, rgba('#5A3020', (o.socket || 0.35) * 0.4)); sg.addColorStop(1, 'rgba(90,48,32,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, w * 0.8, 0, TAU); ctx.fill();
  ctx.restore();
  part(ctx, ap, {
    fill: g => { const gr = g.createLinearGradient(0, cy - h * 0.6, 0, cy + h * 0.4); gr.addColorStop(0, shade(P.sclera, -0.32)); gr.addColorStop(0.35, P.sclera); gr.addColorStop(1, shade(P.sclera, -0.08)); return gr; },
    paint: g => {
      const lw = lpx(g, 1);
      // pink corners
      for (const [x, k] of [[xi, 0.95], [xo, 0.55]]) {
        const pg = g.createRadialGradient(x, cy, 0, x, cy, w * 0.2);
        pg.addColorStop(0, `rgba(200,110,110,${0.75 * k})`); pg.addColorStop(1, 'rgba(200,110,110,0)');
        g.fillStyle = pg; g.fillRect(x - w * 0.25, cy - h, w * 0.5, h * 2);
      }
      // faint veins
      for (let k = 0; k < 7; k++) {
        const x0 = (k % 2 ? xi : xo), a = (r() - 0.5) * 1.2 + (x0 === xi ? (xi < cx ? 0 : Math.PI) : (xo < cx ? 0 : Math.PI));
        const pts = [[x0, cy + (r() - 0.5) * h * 0.4]];
        for (let q = 1; q < 4; q++) pts.push([pts[q - 1][0] + Math.cos(a + (r() - 0.5)) * w * 0.07, pts[q - 1][1] + Math.sin(a + (r() - 0.5)) * w * 0.05]);
        strokeP(g, smoothOpen(pts), 'rgba(170,50,50,0.28)', lw * 0.8 * Math.max(1, ENV.px * 0.6));
      }
      // iris
      const ig = g.createRadialGradient(gx, gy, pupilR, gx, gy, irisR);
      const ic = o.irisColor || ['#B8C4C0', '#7D918F', '#3E4F52'];
      ig.addColorStop(0, ic[0]); ig.addColorStop(0.55, ic[1]); ig.addColorStop(1, ic[2]);
      g.fillStyle = ig; g.beginPath(); g.arc(gx, gy, irisR, 0, TAU); g.fill();
      const ns = 52;
      for (let k = 0; k < ns; k++) {
        const a = k / ns * TAU + (r() - 0.5) * 0.08, r0 = pupilR * (1.15 + r() * 0.4), r1 = irisR * (0.8 + r() * 0.17);
        g.strokeStyle = k % 2 ? 'rgba(235,240,232,0.42)' : 'rgba(25,38,40,0.42)';
        g.lineWidth = Math.max(lw * 0.6, irisR * 0.022);
        g.beginPath(); g.moveTo(gx + Math.cos(a) * r0, gy + Math.sin(a) * r0);
        g.quadraticCurveTo(gx + Math.cos(a + 0.1) * (r0 + r1) / 2, gy + Math.sin(a + 0.1) * (r0 + r1) / 2, gx + Math.cos(a) * r1, gy + Math.sin(a) * r1); g.stroke();
      }
      // collarette
      g.strokeStyle = 'rgba(210,190,140,0.35)'; g.lineWidth = irisR * 0.05; g.beginPath();
      for (let k = 0; k <= 40; k++) { const a = k / 40 * TAU, rr = irisR * (0.5 + 0.04 * Math.sin(a * 9)); k ? g.lineTo(gx + Math.cos(a) * rr, gy + Math.sin(a) * rr) : g.moveTo(gx + Math.cos(a) * rr, gy + Math.sin(a) * rr); }
      g.stroke();
      // limbal ring
      g.save(); g.filter = `blur(${0.7 * ENV.px}px)`; g.strokeStyle = 'rgba(12,16,18,0.9)'; g.lineWidth = irisR * 0.14; g.beginPath(); g.arc(gx, gy, irisR * 0.95, 0, TAU); g.stroke(); g.restore();
      // pupil
      g.fillStyle = '#020202'; g.beginPath(); g.arc(gx, gy, pupilR, 0, TAU); g.fill();
      // upper lid shadow on the eyeball
      const ls = g.createLinearGradient(0, cy - h * 0.62, 0, cy - h * 0.1);
      ls.addColorStop(0, 'rgba(40,20,15,0.55)'); ls.addColorStop(1, 'rgba(40,20,15,0)');
      g.fillStyle = ls; g.fillRect(cx - w, cy - h, w * 2, h);
      if (o.glint) { g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(gx - irisR * 0.32, gy - irisR * 0.3, irisR * 0.13, 0, TAU); g.fill(); }
      if (o.extraPaint) o.extraPaint(g, gx, gy, irisR);
    },
    tex: 0.08, shade: 0.35, ao: 0.4, hi: 0, shadeColor: '#3A1810', shadeDist: 4, shadeBlur: 7, aoBlur: 3,
    outline: o.outline || '#5A2A20', outlineW: o.outlineW || 0.7,
  });
  // lash line + lid crease
  const lw = lpx(ctx, 1);
  const lash = new Path2D(); lash.moveTo(L, yL); lash.bezierCurveTo(L + w * 0.18, cy - h * 0.62, Rr - w * 0.22, cy - h * 0.66, Rr, yR);
  strokeP(ctx, lash, '#1A0C0A', lw * 1.5 * Math.min(ENV.px, o.lashCap || 9));
  // sparse painted lashes
  const rl = rng('lash' + e.side);
  for (let k = 1; k < (o.lashes === false ? 0 : 12); k++) {
    const t = k / 12, bx = (1 - t) ** 3 * L + 3 * (1 - t) ** 2 * t * (L + w * 0.18) + 3 * (1 - t) * t * t * (Rr - w * 0.22) + t ** 3 * Rr;
    const by = (1 - t) ** 3 * yL + 3 * (1 - t) ** 2 * t * (cy - h * 0.62) + 3 * (1 - t) * t * t * (cy - h * 0.66) + t ** 3 * yR;
    const out = (bx - cx) / (w / 2), ln = w * (0.06 + rl() * 0.03);
    const q = new Path2D(); q.moveTo(bx, by); q.quadraticCurveTo(bx + out * ln * 0.3, by - ln * 0.7, bx + out * ln * 0.9, by - ln);
    strokeP(ctx, q, 'rgba(26,12,10,0.8)', lw * 0.9 * ENV.px);
  }
  const crease = new Path2D(); crease.moveTo(L + w * 0.08, cy - h * 0.45); crease.bezierCurveTo(L + w * 0.25, cy - h * 1.0, Rr - w * 0.25, cy - h * 1.02, Rr - w * 0.06, cy - h * 0.5);
  strokeP(ctx, crease, `rgba(90,40,30,${o.crease === undefined ? 0.45 : o.crease})`, lw * 1.4 * ENV.px);
  const low = new Path2D(); low.moveTo(L + w * 0.06, yL + h * 0.06); low.bezierCurveTo(L + w * 0.22, cy + h * 0.5, Rr - w * 0.22, cy + h * 0.48, Rr - w * 0.04, yR + h * 0.04);
  strokeP(ctx, low, 'rgba(120,60,50,0.4)', lw * 1.1 * ENV.px);
  if (o.wetLine) { ctx.save(); ctx.translate(0, -lw * 1.5 * ENV.px); strokeP(ctx, low, 'rgba(230,170,165,0.55)', lw * 1.6 * ENV.px); ctx.restore(); }
  return { ap, gx, gy, irisR };
}

/* a realistic eye seen deep inside a dark mesh hole (costume scare) */
function drawDeepEye(g, H, e, i) {
  const w = e.w * (H.deepSize || 0.62), h = w * 0.62, cx = e.cx + e.side * -0.01, cy = e.cy + 0.01;
  const irisR = w * 0.22, pr = w * 0.04;
  const sg = g.createRadialGradient(cx, cy, 0, cx, cy, w * 0.6);
  sg.addColorStop(0, 'rgba(80,60,50,0.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sg; g.beginPath(); g.ellipse(cx, cy, w * 0.7, w * 0.5, 0, 0, TAU); g.fill();
  const ap = new Path2D(); ap.moveTo(cx - w / 2, cy); ap.bezierCurveTo(cx - w * 0.3, cy - h * 0.65, cx + w * 0.3, cy - h * 0.65, cx + w / 2, cy);
  ap.bezierCurveTo(cx + w * 0.3, cy + h * 0.5, cx - w * 0.3, cy + h * 0.5, cx - w / 2, cy); ap.closePath();
  g.save(); g.clip(ap);
  const scl = g.createLinearGradient(0, cy - h / 2, 0, cy + h / 2); scl.addColorStop(0, '#5E574A'); scl.addColorStop(0.45, H.deepBright ? '#E2DAC6' : '#B9B09C'); scl.addColorStop(1, '#8A8270');
  g.fillStyle = scl; g.fillRect(cx - w, cy - h, w * 2, h * 2);
  const ig = g.createRadialGradient(cx, cy, pr, cx, cy, irisR); ig.addColorStop(0, '#9A8E62'); ig.addColorStop(1, '#3A3420');
  g.fillStyle = ig; g.beginPath(); g.arc(cx, cy, irisR, 0, TAU); g.fill();
  const r = rng('deep' + i);
  for (let k = 0; k < 44; k++) { const a = k / 44 * TAU; g.strokeStyle = k % 2 ? 'rgba(220,210,170,0.35)' : 'rgba(20,16,8,0.45)'; g.lineWidth = irisR * 0.03; g.beginPath(); g.moveTo(cx + Math.cos(a) * pr * 1.3, cy + Math.sin(a) * pr * 1.3); g.lineTo(cx + Math.cos(a) * irisR * (0.85 + r() * 0.1), cy + Math.sin(a) * irisR * (0.85 + r() * 0.1)); g.stroke(); }
  g.strokeStyle = 'rgba(8,8,6,0.95)'; g.lineWidth = irisR * 0.16; g.beginPath(); g.arc(cx, cy, irisR * 0.94, 0, TAU); g.stroke();
  g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy, pr, 0, TAU); g.fill();
  const ls = g.createLinearGradient(0, cy - h * 0.6, 0, cy); ls.addColorStop(0, 'rgba(0,0,0,0.75)'); ls.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = ls; g.fillRect(cx - w, cy - h, w * 2, h);
  g.restore();
  // the glint (drawn over the mesh by the caller)
  return (g2) => {
    g2.save(); g2.filter = `blur(${0.6 * ENV.px}px)`;
    g2.fillStyle = 'rgba(255,255,255,0.5)'; g2.beginPath(); g2.arc(cx - irisR * 0.3, cy - irisR * 0.28, irisR * 0.3, 0, TAU); g2.fill(); g2.restore();
    g2.fillStyle = 'rgba(255,255,255,1)'; g2.beginPath(); g2.arc(cx - irisR * 0.3, cy - irisR * 0.28, irisR * 0.15, 0, TAU); g2.fill();
    g2.fillStyle = 'rgba(255,255,255,0.7)'; g2.beginPath(); g2.arc(cx + irisR * 0.25, cy + irisR * 0.3, irisR * 0.06, 0, TAU); g2.fill();
    // the pupil stays visible through the mesh
    g2.fillStyle = '#000'; g2.beginPath(); g2.arc(cx, cy, pr * 1.1, 0, TAU); g2.fill();
  };
}

function drawEyes(ctx, H) {
  const E = eyeGeom(H);
  const out = [];
  E.forEach((e, i) => {
    const closed = H.eyeClosed[i];
    if (closed) closedEye(ctx, H, e);
    else if (H.eyes === 'button' || H.eyes === 'drift') buttonEye(ctx, H, e, i);
    else if (H.eyes === 'black') blackEye(ctx, H, e);
    else if (H.eyes === 'hollow') hollowEye(ctx, H, e, i);
    else if (H.eyes === 'real') out.push(realEye(ctx, H, e, Object.assign({ gx: H.gaze.x, gy: H.gaze.y, key: 'r' }, H.real || {})));
  });
  return { E, real: out };
}

/* ---- mouths */
function smileCurve(W, y0, D) { return t => ({ x: t * W, y: y0 + D * (1 - t * t) }); }
function arcSample(fn, n) {
  const S = []; let len = 0, prev = fn(-1);
  for (let i = 0; i <= 400; i++) { const t = -1 + 2 * i / 400, p = fn(t); len += Math.hypot(p.x - prev.x, p.y - prev.y); S.push({ t, len }); prev = p; }
  const out = [];
  for (let k = 0; k < n; k++) {
    const target = (k + 0.5) / n * len; let j = 0; while (j < S.length - 1 && S[j].len < target) j++;
    const t = S[j].t, p = fn(t), q = fn(Math.min(1, t + 0.005)), pq = fn(Math.max(-1, t - 0.005));
    out.push({ x: p.x, y: p.y, a: Math.atan2(q.y - pq.y, q.x - pq.x) });
  }
  return { pts: out, len };
}

function drawMouth(ctx, H) {
  const P = ENV.P, m = H.mouth, lw = lpx(ctx, 1);
  const W = H.smileW, y0 = H.mouthY !== undefined ? H.mouthY : 0.33;
  if (m === 'smile') {
    const D = H.smileD || 0.19;
    const fn = smileCurve(W, y0, D);
    const up = [], lo = [], n = 40;
    for (let i = 0; i <= n; i++) {
      const t = -1 + 2 * i / n, a = fn(t), b = fn(Math.min(1, t + 0.01)), c = fn(Math.max(-1, t - 0.01));
      const ang = Math.atan2(b.y - c.y, b.x - c.x), th = lerp(0.016, 0.03, 1 - t * t);
      up.push([a.x + Math.sin(ang) * th, a.y - Math.cos(ang) * th]); lo.push([a.x - Math.sin(ang) * th, a.y + Math.cos(ang) * th]);
    }
    const p = new Path2D(); p.moveTo(up[0][0], up[0][1]); for (const q of up) p.lineTo(q[0], q[1]);
    const e1 = fn(1); p.arc(e1.x, e1.y, 0.016, -Math.PI / 2, Math.PI / 2);
    for (let i = n; i >= 0; i--) p.lineTo(lo[i][0], lo[i][1]);
    const e0 = fn(-1); p.arc(e0.x, e0.y, 0.016, Math.PI / 2, Math.PI * 1.5); p.closePath();
    ctx.save();
    ctx.filter = `blur(${0.8 * ENV.px}px)`; ctx.fillStyle = rgba('#3A0A10', 0.22); ctx.translate(0, 0.008); ctx.fill(p); ctx.restore();
    ctx.save(); ctx.fillStyle = P.cherry; ctx.fill(p);
    // dimple ticks: short arcs across each corner
    for (const sd of [-1, 1]) {
      const e = fn(sd), t = new Path2D();
      t.moveTo(e.x - sd * 0.035, e.y - 0.045); t.quadraticCurveTo(e.x + sd * 0.03, e.y - 0.005, e.x - sd * 0.01, e.y + 0.045);
      strokeP(ctx, t, P.cherry, 0.022);
    }
    ctx.restore();
    feltOver(ctx, p, 0.03, 0.4);
    return;
  }
  if (m === 'open') {
    const w = 0.27, top = y0 - 0.005, bot = y0 + 0.30;
    const p = new Path2D(); p.moveTo(-w, top); p.quadraticCurveTo(0, top + 0.06, w, top);
    p.bezierCurveTo(w + 0.01, bot, -w - 0.01, bot, -w, top); p.closePath();
    part(ctx, p, {
      fill: g => { const gr = g.createRadialGradient(0, top + 0.08, 0.02, 0, top + 0.1, 0.32); gr.addColorStop(0, '#2A040A'); gr.addColorStop(1, P.mouthIn); return gr; },
      paint: g => {
        const tg = g.createRadialGradient(0.02, bot - 0.02, 0.01, 0.02, bot - 0.02, 0.2); tg.addColorStop(0, shade(P.tongue, 0.12)); tg.addColorStop(1, shade(P.tongue, -0.15));
        g.fillStyle = tg; g.beginPath(); g.ellipse(0.03, bot - 0.035, 0.19, 0.11, 0, 0, TAU); g.fill();
        strokeP(g, (() => { const q = new Path2D(); q.moveTo(0.03, bot - 0.1); q.lineTo(0.03, bot - 0.03); return q; })(), rgba(shade(P.tongue, -0.4), 0.6), 0.012);
      },
      tex: 0.3, shade: 0.5, ao: 0.35, hi: 0, shadeColor: '#000000', shadeDist: 5, shadeBlur: 8,
      outline: P.cherry, outlineW: 3.2,
    });
    for (const s of [-1, 1]) {
      const t = new Path2D(); t.moveTo(s * w - s * 0.02, top - 0.05); t.quadraticCurveTo(s * w + s * 0.03, top, s * w, top + 0.05);
      strokeP(ctx, t, P.cherry, 0.03);
    }
    return;
  }
  if (m === 'grin' || m === 'grinClosed') {
    // a band of parted lips following the smile curve, holding N identical square teeth
    const n = H.teeth || 19, D = H.smileD || 0.14;
    const fn = smileCurve(W, y0, D);
    const { pts, len } = arcSample(fn, n);
    const tooth = len / n * 0.84;
    const band = H.grinFill ? tooth * 1.06 : (m === 'grin' ? tooth * 1.32 : tooth * 1.08);
    const S = []; for (let i = 0; i <= 60; i++) S.push(fn(-1 + 2 * i / 60));
    const up = [], lo = [];
    for (let i = 0; i <= 60; i++) {
      const a = S[Math.max(0, i - 1)], b = S[Math.min(60, i + 1)], ang = Math.atan2(b.y - a.y, b.x - a.x);
      const t = Math.abs(-1 + 2 * i / 60), taper = t > 0.93 ? Math.sqrt(Math.max(0, 1 - (t - 0.93) / 0.07)) : 1;
      const hh = band / 2 * taper * 1.05;
      up.push([S[i].x + Math.sin(ang) * hh, S[i].y - Math.cos(ang) * hh]);
      lo.push([S[i].x - Math.sin(ang) * hh, S[i].y + Math.cos(ang) * hh]);
    }
    const p = new Path2D(); p.moveTo(up[0][0], up[0][1]);
    for (const q of up) p.lineTo(q[0], q[1]);
    for (let i = lo.length - 1; i >= 0; i--) p.lineTo(lo[i][0], lo[i][1]);
    p.closePath();
    part(ctx, p, {
      fill: '#1A0306',
      paint: g => {
        for (const q of pts) {
          g.save(); g.translate(q.x, q.y - (band - tooth) * (H.grinFill ? 0 : 0.28)); g.rotate(q.a);
          const tg = g.createLinearGradient(0, -tooth / 2, 0, tooth / 2); tg.addColorStop(0, '#FFFFFF'); tg.addColorStop(0.8, '#F4F4F0'); tg.addColorStop(1, '#C9C9C2');
          g.fillStyle = tg; g.fillRect(-tooth / 2, -tooth / 2, tooth, tooth);
          g.restore();
        }
      },
      tex: 0, shade: 0.35, ao: 0.3, hi: 0, shadeColor: '#000000', shadeDist: 3, shadeBlur: 5, aoBlur: 2.5,
      outline: H.lipColor || P.cherry, outlineW: H.lipW || (H.R > 120 ? 3.2 : 2.2),
    });
    for (const s of [-1, 1]) {
      if (H.noTicks) break;
      const t = new Path2D(); t.moveTo(s * W - s * 0.025, y0 - 0.05); t.quadraticCurveTo(s * W + s * 0.03, y0, s * W - s * 0.005, y0 + 0.055);
      strokeP(ctx, t, P.cherry, 0.026);
    }
    return;
  }
  if (m === 'scream') {
    const cx = 0, cy = H.screamY || 0.5, rx = H.screamRX || 0.27, ry = H.screamRY || 0.42;
    const p = ellipse(cx, cy, rx, ry);
    part(ctx, p, {
      fill: g => { const gr = g.createRadialGradient(cx, cy + ry * 0.1, 0, cx, cy, ry); gr.addColorStop(0, '#000000'); gr.addColorStop(0.7, '#0A0003'); gr.addColorStop(1, '#2A0208'); return gr; },
      paint: g => {
        // rows of identical small square teeth lining the rim, pointing inward
        const rows = H.screamRows || [{ k: 0.92, n: 26, s: 0.075 }, { k: 0.74, n: 22, s: 0.066 }];
        for (const row of rows) {
          for (let i = 0; i < row.n; i++) {
            const a = (i + (row.k < 0.9 ? 0.5 : 0)) / row.n * TAU;
            const x = cx + Math.cos(a) * rx * row.k, y = cy + Math.sin(a) * ry * row.k;
            const nx = Math.cos(a) * ry, ny = Math.sin(a) * rx; const ang = Math.atan2(ny, nx) + Math.PI / 2;
            g.save(); g.translate(x, y); g.rotate(ang);
            const tg = g.createLinearGradient(0, -row.s / 2, 0, row.s / 2); tg.addColorStop(0, '#FFFFFF'); tg.addColorStop(1, '#BDBDB6');
            g.fillStyle = tg; g.fillRect(-row.s / 2, -row.s / 2, row.s, row.s);
            g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-row.s / 2, row.s * 0.3, row.s, row.s * 0.2); g.restore();
          }
        }
        const dg = g.createRadialGradient(cx, cy + ry * 0.05, 0, cx, cy, ry * 0.7); dg.addColorStop(0, 'rgba(0,0,0,1)'); dg.addColorStop(0.75, 'rgba(0,0,0,0.85)'); dg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = dg; g.beginPath(); g.ellipse(cx, cy, rx * 0.66, ry * 0.68, 0, 0, TAU); g.fill();
      },
      tex: 0, shade: 0.3, ao: 0.3, hi: 0, shadeColor: '#000000', outline: P.cherry, outlineW: 4,
    });
    return;
  }
  if (m === 'hang') {
    // costume mouth: a dark stretched hole hanging open, lips crumpled
    const r = rng('hang'), pts = [];
    const cx = 0.03, cy = H.hangY || 0.52, rx = 0.25, ry = 0.36;
    for (let i = 0; i < 22; i++) { const a = i / 22 * TAU; const k = 1 + (r() - 0.5) * 0.18; pts.push([cx + Math.cos(a) * rx * k * (1 - 0.25 * Math.max(0, -Math.sin(a))), cy + Math.sin(a) * ry * k]); }
    const p = smoothClosed(pts);
    part(ctx, p, {
      fill: g => { const gr = g.createRadialGradient(cx, cy + 0.05, 0, cx, cy, ry); gr.addColorStop(0, '#000000'); gr.addColorStop(0.8, '#050203'); gr.addColorStop(1, '#2A0A0C'); return gr; },
      tex: 0, shade: 0.5, ao: 0.6, hi: 0, shadeColor: '#000000', outline: P.cherry, outlineW: 3.5,
    });
  }
}

/* low-alpha felt overlay over a stroked feature so paint looks absorbed into felt */
function feltOver(ctx, path, width, amt) {
  const L = acquire(), g = L.getContext('2d');
  g.setTransform(ctx.getTransform()); g.fillStyle = '#000'; g.fill(path); g.lineWidth = width; g.lineCap = 'round'; g.strokeStyle = '#000'; g.stroke(path);
  ident(g); g.globalCompositeOperation = 'source-in'; g.drawImage(ENV.tex, 0, 0);
  ctx.save(); ident(ctx); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = amt; ctx.drawImage(L, 0, 0); ctx.restore();
  release(L);
}

/* ---- decay: stains, pulled stitches, loose threads */
function drawDecayHead(ctx, H) {
  if (!H.decay) return;
  const r = rng('stain-head'), d = H.decay;
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < Math.round(5 * d); i++) {
    const cx = (r() - 0.5) * 1.5, cy = (r() - 0.5) * 1.4, rr = 0.1 + r() * 0.22, pts = [];
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; pts.push([cx + Math.cos(a) * rr * (0.7 + r() * 0.6), cy + Math.sin(a) * rr * (0.7 + r() * 0.6)]); }
    const p = smoothClosed(pts);
    ctx.filter = `blur(${2.5 * ENV.px}px)`; ctx.fillStyle = `rgba(95,72,40,${0.14 + 0.12 * d})`; ctx.fill(p);
    ctx.filter = `blur(${0.8 * ENV.px}px)`; ctx.strokeStyle = `rgba(80,55,28,${0.16 + 0.1 * d})`; ctx.lineWidth = lpx(ctx, 1.4 * ENV.px); ctx.stroke(p);
  }
  ctx.filter = 'none';
  ctx.restore();
  // a seam pulling apart on the left cheek
  if (d > 0.3 && !H.noSeam) {
    const seam = new Path2D(); seam.moveTo(-0.86, -0.38); seam.quadraticCurveTo(-0.7, -0.05, -0.8, 0.3);
    const gap = new Path2D(); gap.moveTo(-0.86, -0.38); gap.quadraticCurveTo(-0.66, -0.05, -0.8, 0.3); gap.quadraticCurveTo(-0.76, -0.05, -0.86, -0.38); gap.closePath();
    part(ctx, gap, { fill: '#120806', tex: 0, shade: 0.4, ao: 0.4, hi: 0, outline: rgba(ENV.P.faceLine, 0.8), outlineW: 1 });
    const lw = lpx(ctx, 1);
    ctx.save(); ctx.strokeStyle = '#3A2A20'; ctx.lineWidth = lw * 1.3 * ENV.px; ctx.lineCap = 'round';
    for (let k = 0; k < 7; k++) {
      const t = (k + 0.5) / 7, y = lerp(-0.38, 0.3, t), xm = lerp(-0.86, -0.8, t) + 0.12 * Math.sin(Math.PI * t) * 0.9;
      ctx.beginPath(); ctx.moveTo(xm - 0.05, y - 0.012); ctx.lineTo(xm + 0.06, y + 0.012); ctx.stroke();
    }
    // loose thread
    ctx.beginPath(); ctx.moveTo(-0.74, 0.18); ctx.bezierCurveTo(-0.7, 0.3, -0.85, 0.36, -0.76, 0.5); ctx.stroke();
    ctx.restore();
  }
}

function neckHole(ctx, H, o) {
  o = o || {};
  const cx = o.x || 0, cy = o.y || 1.0, rx = o.rx || 0.5, ry = o.ry || 0.24;
  const rim = ellipse(cx, cy, rx * 1.12, ry * 1.25);
  part(ctx, rim, { fill: shade(ENV.P.stem, -0.15), tex: 0.5, shade: 0.4, ao: 0.3, hi: 0.15, outline: shade(ENV.P.stemDk, -0.4), outlineW: 1.3, cast: { alpha: 0.4, blur: 6, dist: 4 },
    paint: g => { for (let k = 0; k < 18; k++) { const a = k / 18 * TAU; const q = new Path2D(); q.moveTo(cx + Math.cos(a) * rx * 0.95, cy + Math.sin(a) * ry * 0.95); q.lineTo(cx + Math.cos(a) * rx * 1.1, cy + Math.sin(a) * ry * 1.22); strokeP(g, q, 'rgba(20,50,12,0.4)', lpx(g, 1.2)); } } });
  const hole = ellipse(cx, cy + ry * 0.05, rx * 0.92, ry * 0.85);
  part(ctx, hole, {
    fill: g => { const gr = g.createRadialGradient(cx, cy + ry * 0.2, 0, cx, cy, rx); gr.addColorStop(0, '#000000'); gr.addColorStop(0.7, '#030202'); gr.addColorStop(1, '#1E1410'); return gr; },
    paint: g => { // the far inside wall of the hollow head, catching a little light
      const lg = g.createLinearGradient(cx, cy - ry, cx, cy + ry * 0.2); lg.addColorStop(0, 'rgba(120,95,70,0.75)'); lg.addColorStop(1, 'rgba(40,30,20,0)');
      g.fillStyle = lg; g.beginPath(); g.ellipse(cx, cy - ry * 0.25, rx * 0.8, ry * 0.55, 0, Math.PI, TAU); g.fill();
      g.strokeStyle = 'rgba(150,140,120,0.35)'; g.lineWidth = lpx(g, 1);
      for (let k = 0; k < 9; k++) { const x = cx - rx * 0.6 + k * rx * 0.15; g.beginPath(); g.moveTo(x, cy - ry * 0.75); g.lineTo(x + rx * 0.05, cy - ry * 0.2); g.stroke(); }
    },
    tex: 0, shade: 0.7, ao: 0.6, hi: 0, shadeColor: '#000000', shadeDist: 10, shadeBlur: 10, outline: '#0A0604', outlineW: 1,
  });
}

/* ---- full head */
function drawHead(ctx, H) {
  ctx.save();
  ctx.translate(H.cx, H.cy); ctx.rotate(H.tilt * DEG); ctx.scale(H.R * H.sx, H.R * H.sy);
  if (H.behind) H.behind(ctx, H);
  drawPetals(ctx, H);
  drawFace(ctx, H);
  if (!H.noCheeks) drawCheeks(ctx, H);
  drawMouth(ctx, H);
  const eyes = drawEyes(ctx, H);
  drawNose(ctx, H);
  drawDecayHead(ctx, H);
  if (H.front) H.front(ctx, H, eyes);
  const T = ctx.getTransform();
  ctx.restore();
  return { T, eyes };
}

/* ================================================================ GLOVES
 * Glove frame: origin at the wrist, +y towards the fingertips, units = px at
 * full-body scale.  Four digits: three long fingers + thumb, each 1.4x long
 * with one extra knuckle crease. */
function gloveShapes(o) {
  const fl = 24 * (o.fingerLen || 1), fw = 10.5, spread = o.spread === undefined ? 7 : o.spread, side = o.thumbSide || 1;
  const shapes = [];
  const palmW = 31 * (o.palmW || 1), palmL = 27;
  const cuff = new Path2D(); cuff.moveTo(-15, -9); cuff.lineTo(15, -9); cuff.quadraticCurveTo(21, -1, 18, 6); cuff.lineTo(-18, 6); cuff.quadraticCurveTo(-21, -1, -15, -9); cuff.closePath();
  const fingers = [];
  if (o.mode === 'point') {
    // fist + extended index finger; two curled knuckles; thumb folded across
    shapes.push(roundRect(-palmW / 2, 1, palmW, palmL + 2, [10, 10, 12, 12]));
    fingers.push({ x: -side * 9, y: palmL - 2, a: (o.indexAng || 0), len: fl * 1.0, w: fw });
    shapes.push(roundRect(-side * 1 - 5.5, palmL - 6, 11, 13, 5.5));
    shapes.push(roundRect(side * 9 - 5.5, palmL - 8, 11, 12, 5.5));
    fingers.push({ x: side * 12, y: 9, a: -side * 24, len: 19, w: 10.5, thumb: true });
  } else {
    shapes.push(roundRect(-palmW / 2, 1, palmW, palmL + 2, [10, 10, 12, 12]));
    const xs = [-10, 0, 10];
    xs.forEach((x, k) => fingers.push({ x: x * (o.palmW || 1), y: palmL - 1,
      a: o.fingerAngles ? o.fingerAngles[k] : (k - 1) * spread + (o.curl || 0) * (k - 1) * 0.3,
      len: fl * (k === 1 ? 1.06 : 0.98), w: fw, curl: o.curl || 0 }));
    fingers.push({ x: side * 13, y: 10, a: side * (o.thumbAng === undefined ? 48 : o.thumbAng), len: 19 * Math.min(1.25, o.fingerLen || 1), w: 10.5, thumb: true });
  }
  const fpaths = fingers.map(f => {
    const a = f.a * DEG, c = f.curl || 0;
    const p0 = [f.x, f.y - 4], dir = [Math.sin(a), Math.cos(a)];
    const p2 = [f.x + dir[0] * f.len, f.y + dir[1] * f.len];
    const p1 = [lerp(p0[0], p2[0], 0.55) + dir[1] * c * 0.12 * f.len, lerp(p0[1], p2[1], 0.55) - dir[0] * c * 0.12 * f.len];
    f.pts = [p0, p1, p2];
    return tube([p0, p1, p2], [f.w, f.w * 0.98, f.w * 0.92]);
  });
  return { cuff, shapes, fingers, fpaths };
}

function drawGlove(ctx, o) {
  const P = ENV.P;
  ctx.save();
  ctx.translate(o.x, o.y); ctx.rotate((o.ang || 0) * DEG); ctx.scale((o.mirror ? -1 : 1) * (o.scale || 1), (o.scale || 1));
  const G = gloveShapes(o);
  const all = [...G.shapes, ...G.fpaths];
  part(ctx, all, {
    fill: g => { const gr = g.createLinearGradient(-20, 0, 25, 40); gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(1, shade(P.glove, -0.06)); return gr; },
    paint: g => {
      const lw = lpx(g, 1);
      // finger separations + knuckle creases (3 per finger: one too many)
      G.fingers.forEach((f, k) => {
        const [p0, p1, p2] = f.pts;
        const crease = (t, wk) => {
          const x = lerp(p0[0], p2[0], t), y = lerp(p0[1], p2[1], t);
          const ang = Math.atan2(p2[1] - p0[1], p2[0] - p0[0]) + Math.PI / 2;
          const q = new Path2D(); q.moveTo(x - Math.cos(ang) * f.w * 0.3 * wk, y - Math.sin(ang) * f.w * 0.3 * wk);
          q.quadraticCurveTo(x, y + 1.6, x + Math.cos(ang) * f.w * 0.3 * wk, y + Math.sin(ang) * f.w * 0.3 * wk);
          strokeP(g, q, 'rgba(120,118,112,0.55)', lw * 1.0 * Math.max(1, ENV.px * 0.7));
        };
        const ts = f.thumb ? [0.42, 0.7] : [0.3, 0.52, 0.74];
        ts.forEach(t => crease(t, 1));
      });
      { // finger separations, clipped so they never show through the palm
        const cp = new Path2D(); cp.rect(-1e4, -1e4, 2e4, 2e4); for (const sh of G.shapes) cp.addPath(sh);
        g.save(); g.clip(cp, 'evenodd');
        for (const p of G.fpaths) { g.lineWidth = lw * 1.1; g.strokeStyle = 'rgba(110,108,104,0.55)'; g.stroke(p); }
        g.restore();
      }
      if (o.limp) { for (let k = 0; k < 4; k++) { const q = new Path2D(); q.moveTo(-12 + k * 7, 4); q.quadraticCurveTo(-8 + k * 7, 16, -12 + k * 8, 26); strokeP(g, q, 'rgba(110,108,104,0.45)', lw * 1.2); } }
    },
    tex: 0.42, texB: true, shade: 0.36, ao: 0.22, hi: 0.1, shadeColor: '#4A4A50', shadeDist: 7, shadeBlur: 10,
    outline: P.gloveLine, outlineW: 1.2, cast: o.cast || { alpha: 0.3, blur: 6, dist: 4 },
  });
  part(ctx, G.cuff, {
    fill: shade(P.glove, -0.02), tex: 0.4, texB: true, shade: 0.4, ao: 0.25, hi: 0.1, shadeColor: '#4A4A50', shadeDist: 5, shadeBlur: 8,
    paint: g => { const q = new Path2D(); q.moveTo(-17, 1); q.lineTo(17, 1); strokeP(g, q, 'rgba(120,118,112,0.5)', lpx(g, 1.2)); },
    outline: P.gloveLine, outlineW: 1.2, cast: { alpha: 0.25, blur: 4, dist: 2 },
  });
  const T = ctx.getTransform();
  ctx.restore();
  return { T, G };
}

/* ================================================================ BODY
 * Full-body canvas: 420 x 640, feet bottom-centre at (210, 628). */
function bodyRig(o) {
  const st = o.stretch || {};
  const neck = st.neck || 1, arms = st.arms || 1;
  const B = {
    feetY: 628,
    hipL: [184, 486], hipR: [236, 486],
    ankleL: [180, 594], ankleR: [240, 594],
    shL: [154, 352], shR: [266, 352],
    neckBase: [210, 340],
    R: 80 * (o.headScale || 1),
  };
  B.headC = [210, 340 - 150 * (neck === 1 ? 1 : 1 + (neck - 1) * 0.95)];
  B.armLen = arms;
  return B;
}

function drawShoe(ctx, x, y, side, P, turn) {
  const p = new Path2D();
  const w = 36, h = 30, t = turn || 0;
  p.moveTo(x - w + side * 4 + t, y);
  p.bezierCurveTo(x - w - 4 + t, y - h * 0.9, x - 6, y - h * 1.15, x + side * 6, y - h * 0.95);
  p.bezierCurveTo(x + w * 0.9 + t, y - h * 0.9, x + w + 6 + t, y - 4, x + w - 2 + t, y);
  p.closePath();
  part(ctx, p, {
    fill: g => { const gr = g.createLinearGradient(x, y - h, x, y); gr.addColorStop(0, shade(P.shoe, 0.15)); gr.addColorStop(1, P.shoeDk); return gr; },
    paint: g => { const q = new Path2D(); q.moveTo(x - w + 6 + t, y - 6); q.quadraticCurveTo(x + t, y - 3, x + w - 6 + t, y - 6); stitches(g, q, 'rgba(240,210,170,0.6)', 1.3, 3.5, 3); },
    tex: 0.55, shade: 0.4, ao: 0.25, hi: 0.15, outline: shade(P.shoeDk, -0.4), outlineW: 1.2,
  });
}

function drawLegs(ctx, B, P, o) {
  const turn = o.pose === 'point' ? -6 : 0;
  for (const [hip, ank, side] of [[B.hipL, B.ankleL, -1], [B.hipR, B.ankleR, 1]]) {
    const p = tube([[hip[0], hip[1] - 20], [lerp(hip[0], ank[0], 0.5) + side * 2, lerp(hip[1], ank[1], 0.5)], [ank[0], ank[1] - 6]], [50, 46, 47], { capStart: false });
    part(ctx, p, {
      fill: g => { const gr = g.createLinearGradient(hip[0] - 25, 0, hip[0] + 25, 0); gr.addColorStop(0, shade(P.overall, side < 0 ? 0.05 : -0.04)); gr.addColorStop(1, shade(P.overall, side < 0 ? -0.06 : -0.12)); return gr; },
      paint: g => { const q = new Path2D(); q.moveTo(hip[0] + side * 16, hip[1] + 10); q.quadraticCurveTo(hip[0] + side * 20, hip[1] + 60, ank[0] + side * 18, ank[1] - 20); stitches(g, q, 'rgba(150,100,20,0.6)', 1.2, 4, 3); },
      tex: 0.5, shade: 0.42, ao: 0.25, hi: 0.14, outline: P.overallLine, outlineW: 1.3,
    });
    // rolled cuff
    const c = roundRect(ank[0] - 26, ank[1] - 18, 52, 15, 6);
    part(ctx, c, { fill: shade(P.overall, -0.06), tex: 0.5, shade: 0.45, ao: 0.3, hi: 0.15, outline: P.overallLine, outlineW: 1.2, cast: { alpha: 0.3, blur: 4, dist: 3 } });
  }
  drawShoe(ctx, B.ankleL[0] - 4, B.feetY, -1, P, turn);
  drawShoe(ctx, B.ankleR[0] + 4, B.feetY, 1, P, turn);
}

function torsoPath(B, o) {
  const tx = o.pose === 'point' ? -4 : 0;
  const p = new Path2D();
  const [lx, ly] = B.shL, [rx, ry] = B.shR;
  p.moveTo(lx + 2, ly - 4);
  p.bezierCurveTo(lx + 12, ly - 16, 186, 338, 210, 338);
  p.bezierCurveTo(234, 338, rx - 12, ry - 16, rx - 2, ry - 4);
  p.bezierCurveTo(rx + 12, ry + 30, 276 + tx * 0.5, 440, 278, 486);
  p.bezierCurveTo(272, 512, 148, 512, 142, 486);
  p.bezierCurveTo(144 + tx, 440, lx - 12, ly + 30, lx + 2, ly - 4);
  p.closePath();
  return p;
}

function drawTorso(ctx, B, P, o) {
  const tx = o.pose === 'point' ? -9 : 0;          // body turned 15 deg toward screen-left
  // shirt (green) torso
  part(ctx, torsoPath(B, o), {
    fill: g => { const gr = g.createLinearGradient(150, 340, 270, 480); gr.addColorStop(0, shade(P.shirt, 0.1)); gr.addColorStop(1, shade(P.shirt, -0.12)); return gr; },
    tex: 0.55, shade: 0.4, ao: 0.25, hi: 0.14, outline: shade(P.stemDk, -0.3), outlineW: 1.3,
  });
  // overalls: bib + pants top
  const ov = new Path2D();
  ov.moveTo(176 + tx, 380);
  ov.lineTo(244 + tx, 380);
  ov.bezierCurveTo(246 + tx, 410, 250, 430, 268, 440);
  ov.bezierCurveTo(276, 452, 280, 470, 279, 488);
  ov.bezierCurveTo(272, 518, 148, 518, 141, 488);
  ov.bezierCurveTo(140, 470, 144, 452, 152, 440);
  ov.bezierCurveTo(170, 430, 174 + tx, 410, 176 + tx, 380);
  ov.closePath();
  part(ctx, ov, {
    fill: g => { const gr = g.createLinearGradient(150, 380, 270, 510); gr.addColorStop(0, shade(P.overall, 0.12)); gr.addColorStop(1, shade(P.overall, -0.1)); return gr; },
    paint: g => {
      // waist seam + bib stitching
      const q = new Path2D(); q.moveTo(150, 446); q.quadraticCurveTo(210 + tx, 456, 270, 446); stitches(g, q, 'rgba(150,100,20,0.65)', 1.3, 4, 3);
      const b = new Path2D(); b.moveTo(181 + tx, 385); b.lineTo(239 + tx, 385); stitches(g, b, 'rgba(150,100,20,0.65)', 1.3, 4, 3);
      const fly = new Path2D(); fly.moveTo(210 + tx * 0.6, 452); fly.quadraticCurveTo(212 + tx * 0.5, 480, 205 + tx * 0.5, 500); stitches(g, fly, 'rgba(150,100,20,0.55)', 1.2, 4, 3);
    },
    tex: 0.5, shade: 0.42, ao: 0.25, hi: 0.16, outline: P.overallLine, outlineW: 1.3, cast: { alpha: 0.32, blur: 6, dist: 4 },
  });
  // pocket with poppy patch
  const pk = roundRect(190 + tx, 398, 40, 32, [3, 3, 9, 9]);
  part(ctx, pk, {
    fill: shade(P.overall, 0.04), tex: 0.5, shade: 0.35, ao: 0.25, hi: 0.15, outline: P.overallLine, outlineW: 1.1, cast: { alpha: 0.28, blur: 3, dist: 2 },
    paint: g => { const q = new Path2D(); q.roundRect(193 + tx, 401, 34, 26, [2, 2, 7, 7]); stitches(g, q, 'rgba(150,100,20,0.7)', 1.1, 3, 2.5); },
  });
  const pcx = 210 + tx, pcy = 413;
  const petals = [];
  for (let k = 0; k < 5; k++) { const a = k / 5 * TAU - Math.PI / 2; petals.push(ellipse(pcx + Math.cos(a) * 6.5, pcy + Math.sin(a) * 6.5, 7, 6, a)); }
  part(ctx, petals, { fill: P.petal, tex: 0.3, shade: 0.3, ao: 0.2, hi: 0.1, outline: P.petalLine, outlineW: 0.9, cast: { alpha: 0.25, blur: 2, dist: 1.5 } });
  part(ctx, circle(pcx, pcy, 3.6), { fill: '#141414', tex: 0, shade: 0.2, ao: 0, hi: 0, outline: '#000', outlineW: 0.5 });
}

function drawStraps(ctx, B, P, o) {
  const tx = o.pose === 'point' ? -9 : 0;
  for (const side of [-1, 1]) {
    const bx = 210 + tx + side * 27;
    const p = new Path2D();
    p.moveTo(bx - 9, 383); p.lineTo(bx + 9, 383);
    p.quadraticCurveTo(210 + side * 40, 350, 210 + side * 40 + 8, 336);
    p.lineTo(210 + side * 40 - 9, 333);
    p.quadraticCurveTo(210 + side * 28, 352, bx - 9, 383);
    p.closePath();
    part(ctx, p, { fill: shade(P.overall, 0.02), tex: 0.5, shade: 0.35, ao: 0.25, hi: 0.15, outline: P.overallLine, outlineW: 1.1, cast: { alpha: 0.3, blur: 4, dist: 3 } });
    const bc = [bx, 384];
    part(ctx, circle(bc[0], bc[1], 8.5), {
      fill: g => { const gr = g.createRadialGradient(bc[0] - 3, bc[1] - 3, 1, bc[0], bc[1], 9); gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(1, shade(P.button, -0.12)); return gr; },
      paint: g => { g.fillStyle = 'rgba(90,80,70,0.8)'; for (const [dx, dy] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) { g.beginPath(); g.arc(bc[0] + dx, bc[1] + dy, 1.2, 0, TAU); g.fill(); } g.strokeStyle = 'rgba(150,140,130,0.6)'; g.lineWidth = 0.9; g.beginPath(); g.arc(bc[0], bc[1], 6.4, 0, TAU); g.stroke(); },
      tex: 0.1, shade: 0.35, ao: 0.2, hi: 0.2, shadeColor: '#5A5040', outline: '#8C8478', outlineW: 1, cast: { alpha: 0.35, blur: 3, dist: 2.5 },
    });
  }
}

function drawNeck(ctx, B, P, top, o) {
  const base = B.neckBase;
  const p = tube([[base[0], base[1] + 6], [lerp(base[0], top[0], 0.5), lerp(base[1], top[1], 0.5)], [top[0], top[1]]], [46, 41, 40], { capStart: false });
  part(ctx, p, {
    fill: g => { const gr = g.createLinearGradient(base[0] - 24, 0, base[0] + 24, 0); gr.addColorStop(0, shade(P.stem, 0.08)); gr.addColorStop(0.6, P.stem); gr.addColorStop(1, shade(P.stemDk, -0.05)); return gr; },
    paint: g => {
      // vertical ribbing
      for (let k = -4; k <= 4; k++) {
        const q = new Path2D(); q.moveTo(base[0] + k * 4.8, base[1] + 4); q.lineTo(lerp(base[0], top[0], 1) + k * 4.4, top[1]);
        strokeP(g, q, k % 2 ? 'rgba(20,60,15,0.32)' : 'rgba(170,230,140,0.18)', 1.1);
      }
      // rolled collar fold near the shoulders
      const f = new Path2D(); f.moveTo(base[0] - 24, base[1] - 6); f.quadraticCurveTo(base[0], base[1] + 3, base[0] + 24, base[1] - 6);
      strokeP(g, f, 'rgba(20,50,12,0.45)', 2.2);
    },
    tex: 0.5, shade: 0.45, ao: 0.28, hi: 0.12, outline: shade(P.stemDk, -0.3), outlineW: 1.3,
  });
}

function armPath(sh, el, wr, wide) {
  const k = wide || 1;
  return tube([sh, el, wr], [31 * k, 26 * k, 23 * k]);
}

function drawArm(ctx, P, pts, o) {
  const [sh, el, wr] = pts;
  part(ctx, armPath(sh, el, wr, o && o.wide), {
    fill: g => { const gr = g.createLinearGradient(sh[0], sh[1], wr[0], wr[1]); gr.addColorStop(0, shade(P.shirt, 0.06)); gr.addColorStop(1, shade(P.shirt, -0.1)); return gr; },
    paint: g => {
      // elbow folds
      for (let k = -1; k <= 1; k++) {
        const ax = el[0] + k * 6 * (wr[1] - sh[1]) / 120, ay = el[1] + k * 6;
        const dx = wr[0] - sh[0], dy = wr[1] - sh[1], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
        const q = new Path2D(); q.moveTo(ax - nx * 9, ay - ny * 9); q.quadraticCurveTo(ax + dx / l * 3, ay + dy / l * 3, ax + nx * 7, ay + ny * 7);
        strokeP(g, q, 'rgba(25,60,15,0.32)', 1.3);
      }
    },
    tex: 0.55, shade: 0.42, ao: 0.25, hi: 0.13, outline: shade(P.stemDk, -0.3), outlineW: 1.3,
    cast: { alpha: 0.32, blur: 7, dist: 5 },
  });
}

/* ---- the main entry point */
function drawPoppy(ctx, opts) {
  opts = opts || {};
  const W = ctx.canvas.width, Hh = ctx.canvas.height;
  setupEnv(W, Hh, opts);
  const P = ENV.P;
  // render the figure on its own layer so lighting/tint can be applied with alpha preserved
  const FIG = mk(W, Hh), f = FIG.getContext('2d');
  if (opts.transform) f.setTransform(...opts.transform);
  const pose = opts.pose || 'stand';
  let headInfo = null;
  if (pose === 'close') headInfo = drawBust(f, opts);
  else if (pose === 'slumped') headInfo = drawSlumped(f, opts);
  else if (pose === 'head') headInfo = drawHead(f, headOpts(opts, opts.cx, opts.cy, opts.R));
  else headInfo = drawFullBody(f, opts);
  applyLighting(FIG, opts);
  ctx.drawImage(FIG, 0, 0);
  return headInfo;
}

function setupEnv(W, Hh, opts) {
  ENV.W = W; ENV.H = Hh; ENV.seed = opts.seed === undefined ? 7 : opts.seed;
  ENV.px = opts.px || 1;
  ENV.light = opts.light || { x: -0.55, y: -0.83 };
  ENV.castK = opts.castK || 1;
  ENV.P = palette(opts.decay || 0);
  const ts = opts.texScale || ENV.px;
  ENV.tex = feltTexture(W, Hh, 11, ts);
  ENV.texB = feltTexture(W, Hh, 23, ts * 0.8);
}

function headOpts(opts, cx, cy, R) {
  return headDefaults(Object.assign({}, opts.head || {}, {
    cx, cy, R,
    tilt: opts.tilt === undefined ? 12 : opts.tilt,
    eyes: opts.eyes || 'button', mouth: opts.mouth || 'smile',
    decay: opts.decay || 0, missing: opts.missing || [],
  }));
}

function drawFullBody(f, opts) {
  const P = ENV.P;
  const B = bodyRig(opts);
  const pose = opts.pose || 'stand';
  const arms = opts.stretch && opts.stretch.arms || 1;
  const fingers = (opts.stretch && opts.stretch.fingers) || 1.4;
  const H = headOpts(opts, B.headC[0], B.headC[1], B.R);
  // neck top follows the tilted head
  const tt = H.tilt * DEG;
  const neckTop = [H.cx - Math.sin(tt) * 0.78 * H.R, H.cy + Math.cos(tt) * 0.78 * H.R];
  const armL = (pose === 'point') ? [[150, 356], [112, 352], [82, 347]]
    : (pose === 'wave') ? [[152, 358], [104, 330], [84, 270]]
      : (pose === 'cover') ? null
        : [[154, 356], [140, 420 + (arms - 1) * 60], [135 - (arms - 1) * 8, 476 + (arms - 1) * 120]];
  const armR = (pose === 'cover') ? null : [[266, 356], [280, 420 + (arms - 1) * 60], [285 + (arms - 1) * 8, 476 + (arms - 1) * 120]];
  drawLegs(f, B, P, opts);
  drawTorso(f, B, P, opts);
  drawNeck(f, B, P, neckTop, opts);
  drawStraps(f, B, P, opts);
  if (opts.decay) drawDecayBody(f, opts);
  const gl = (pt, ang, mirror, extra) => drawGlove(f, Object.assign({ x: pt[0], y: pt[1], ang, mirror, fingerLen: fingers, spread: opts.spread === undefined ? 6 : opts.spread, curl: 0.6, limp: !!opts.limp }, opts.limp ? { fingerAngles: [3, 0, -3], thumbAng: 16, curl: 0.1 } : {}, extra || {}));
  // arms that hang at the sides are drawn before the head
  if (armR) { drawArm(f, P, armR); gl(armR[2], -8, true); }
  if (pose !== 'wave' && pose !== 'point' && armL) { drawArm(f, P, armL); gl(armL[2], 8, false); }
  let head;
  if (opts.hollowHead) H.front = (c) => {};
  if (pose === 'cover') {
    head = drawHead(f, Object.assign(H, { front: (c, HH, eyes) => coverHands(c, HH, eyes, opts, B) }));
  } else head = drawHead(f, H);
  if (pose === 'wave') {
    drawArm(f, P, armL);
    gl(armL[2], 180 + (opts.waveTilt || 0), false, { spread: 9, curl: -0.2, thumbAng: 55 });
  }
  if (pose === 'point') {
    drawArm(f, P, armL);
    drawGlove(f, { x: armL[2][0], y: armL[2][1], ang: 90, mirror: true, mode: 'point', fingerLen: fingers, thumbSide: 1, indexAng: 0 });
  }
  return { B, head };
}

/* cover-eyes pose: both gloves pressed over the eyes, fingers spread; one real
 * eye peeks through a finger gap.  Drawn in head-local space so the hands
 * stay glued to the tilted head; arms run from the shoulders to the wrists. */
/* point between finger i and i+1 at distance t along the fingers (glove frame) */
function gloveGapPoint(o, i, t) {
  const G = gloveShapes(o), a = G.fingers[i], b = G.fingers[i + 1];
  const pa = [a.x + Math.sin(a.a * DEG) * t, a.y - 4 + Math.cos(a.a * DEG) * t];
  const pb = [b.x + Math.sin(b.a * DEG) * t, b.y - 4 + Math.cos(b.a * DEG) * t];
  return [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
}
/* wrist position so that glove-frame point gp lands on target (head-local) */
function wristFor(target, gp, ang, scale, mirror) {
  const x = gp[0] * (mirror ? -1 : 1) * scale, y = gp[1] * scale, c = Math.cos(ang * DEG), s = Math.sin(ang * DEG);
  return [target[0] - (c * x - s * y), target[1] - (s * x + c * y)];
}

function coverHands(ctx, H, eyes, opts, B) {
  const P = ENV.P;
  const fingers = (opts.stretch && opts.stretch.fingers) || 1.55;
  const gs = (opts.gloveScale || 1.4) / H.R;     // glove px -> head units
  const E = eyeGeom(H);
  // screen-left hand: fingers closed over the hidden eye.
  const oL = { ang: opts.coverAngL || 202, scale: gs, mirror: false, fingerLen: fingers, fingerAngles: [1.5, 0, -1.5], curl: 0, thumbAng: 62 };
  // screen-right hand: middle/outer fingers splayed; the gap sits on the eye.
  const oR = { ang: opts.coverAngR || 160, scale: gs, mirror: true, fingerLen: fingers, fingerAngles: opts.peekAngles || [-2, 0, 30], curl: 0, thumbAng: 62 };
  const gapR = gloveGapPoint(oR, 1, opts.peekT || 24);
  const midL = gloveGapPoint(oL, 0, 22);
  const wL = wristFor([E[0].cx + 0.02, E[0].cy], midL, oL.ang, gs, false);
  const wR = wristFor([E[1].cx, E[1].cy + 0.01], gapR, oR.ang, gs, true);
  const toS = (w, ang) => toScreen(ctx, w[0] + Math.sin(-ang * DEG) * 0.0, w[1] + 0.08);
  const sL = toS(wL, oL.ang), sR = toS(wR, oR.ang);
  const T = ctx.getTransform();
  ctx.save(); ident(ctx);
  const el = opts.coverElbows || [[104, 400], [316, 400]];
  drawArm(ctx, P, [[154, 358], el[0], [sL.x, sL.y]]);
  drawArm(ctx, P, [[266, 358], el[1], [sR.x, sR.y]]);
  ctx.restore();
  ctx.setTransform(T);
  const cast = { alpha: 0.55, blur: 9, dist: 7 };
  drawGlove(ctx, Object.assign({ x: wL[0], y: wL[1], cast }, oL));
  drawGlove(ctx, Object.assign({ x: wR[0], y: wR[1], cast }, oR));
}

function drawDecayBody(ctx, opts) {
  const r = rng('stain-body'), d = opts.decay;
  ctx.save(); ctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < Math.round(9 * d); i++) {
    const cx = 150 + r() * 120, cy = 360 + r() * 250, rr = 8 + r() * 22, pts = [];
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; pts.push([cx + Math.cos(a) * rr * (0.6 + r() * 0.7), cy + Math.sin(a) * rr * (0.6 + r() * 0.7)]); }
    const p = smoothClosed(pts);
    ctx.filter = 'blur(2.5px)'; ctx.fillStyle = `rgba(80,62,34,${0.18 + 0.14 * d})`; ctx.fill(p);
    ctx.filter = 'blur(0.7px)'; ctx.strokeStyle = `rgba(70,50,25,${0.18 + 0.1 * d})`; ctx.lineWidth = 1.2; ctx.stroke(p);
  }
  ctx.filter = 'none'; ctx.restore();
}

/* wrinkle lines for deflated fabric (paint hook) */
function wrinkles(g, box, n, seed, color) {
  const r = rng('wr' + seed), lw = lpx(g, 1);
  for (let k = 0; k < n; k++) {
    const x = box[0] + r() * box[2], y = box[1] + r() * box[3], a = (r() - 0.5) * 1.6 + (box[4] || 0), len = 10 + r() * 26;
    const q = new Path2D(); q.moveTo(x, y); q.quadraticCurveTo(x + Math.cos(a + 0.5) * len * 0.5, y + Math.sin(a + 0.5) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.save(); g.filter = 'blur(1.2px)'; strokeP(g, q, color || 'rgba(40,30,10,0.38)', lw * 3); g.restore();
    g.save(); g.translate(1.5, 1.5); g.filter = 'blur(1px)'; strokeP(g, q, 'rgba(255,255,230,0.22)', lw * 2); g.restore();
  }
}

/* The EMPTY costume slumped in a chair (chair not drawn).  Canvas 420x480,
 * seat contact point (bottom centre of the pelvis) at (210, 330). */
function drawSlumped(f, opts) {
  const P = ENV.P;
  const sx = 210, sy = 330;
  // arms (behind the torso edge) draped to where the chair arms would be
  const armL = [[150, 252], [104, 286], [74, 302]], armR = [[268, 262], [312, 292], [346, 304]];
  for (const a of [armL, armR]) {
    part(f, tube(a, [30, 27, 24], { wobble: u => 0.08 * Math.sin(u * 19) }), {
      fill: g => { const gr = g.createLinearGradient(a[0][0], a[0][1], a[2][0], a[2][1]); gr.addColorStop(0, shade(P.shirt, 0.02)); gr.addColorStop(1, shade(P.shirt, -0.14)); return gr; },
      paint: g => wrinkles(g, [Math.min(a[0][0], a[2][0]), a[0][1] - 10, Math.abs(a[2][0] - a[0][0]), 50, 1.4], 7, 'arm' + a[0][0], 'rgba(15,40,10,0.4)'),
      tex: 0.55, shade: 0.42, ao: 0.25, hi: 0.12, outline: shade(P.stemDk, -0.3), outlineW: 1.3,
    });
  }
  // pelvis / overall seat, flattened
  const pel = new Path2D();
  pel.moveTo(148, 300); pel.bezierCurveTo(150, 276, 272, 276, 274, 300);
  pel.bezierCurveTo(280, 320, 262, sy + 2, sx, sy); pel.bezierCurveTo(158, sy + 2, 142, 320, 148, 300); pel.closePath();
  // torso: deflated, folded forward, leaning to screen-left
  const tor = new Path2D();
  tor.moveTo(142, 246); tor.bezierCurveTo(160, 232, 196, 236, 214, 240);
  tor.bezierCurveTo(240, 244, 262, 248, 272, 258);
  tor.bezierCurveTo(282, 274, 270, 288, 276, 304);
  tor.lineTo(150, 304);
  tor.bezierCurveTo(140, 290, 150, 270, 142, 246); tor.closePath();
  part(f, tor, {
    fill: g => { const gr = g.createLinearGradient(140, 230, 280, 305); gr.addColorStop(0, shade(P.shirt, 0.04)); gr.addColorStop(1, shade(P.shirt, -0.16)); return gr; },
    paint: g => wrinkles(g, [150, 240, 120, 50, 0.3], 9, 'torso', 'rgba(15,40,10,0.4)'),
    tex: 0.55, shade: 0.42, ao: 0.28, hi: 0.12, outline: shade(P.stemDk, -0.3), outlineW: 1.3,
  });
  // empty collar: crumpled green ring around a dark opening
  const col = ellipse(206, 244, 34, 13, -0.08);
  part(f, col, { fill: shade(P.stem, -0.05), tex: 0.5, shade: 0.4, ao: 0.3, hi: 0.15, outline: shade(P.stemDk, -0.35), outlineW: 1.2, cast: { alpha: 0.35, blur: 5, dist: 3 },
    paint: g => { for (let k = -5; k <= 5; k++) { const q = new Path2D(); q.moveTo(206 + k * 5.5, 233); q.lineTo(206 + k * 6, 256); strokeP(g, q, 'rgba(20,55,12,0.35)', 1.1); } } });
  part(f, ellipse(207, 245, 24, 7.5, -0.08), { fill: '#020101', tex: 0, shade: 0.6, ao: 0.5, hi: 0, shadeColor: '#000', outline: '#000', outlineW: 0.8 });
  part(f, pel, {
    fill: g => { const gr = g.createLinearGradient(150, 280, 270, 330); gr.addColorStop(0, shade(P.overall, 0.08)); gr.addColorStop(1, shade(P.overall, -0.14)); return gr; },
    paint: g => wrinkles(g, [150, 282, 120, 40, 0], 8, 'pelvis'),
    tex: 0.5, shade: 0.42, ao: 0.25, hi: 0.15, outline: P.overallLine, outlineW: 1.3, cast: { alpha: 0.3, blur: 6, dist: 4 },
  });
  // sagging bib: top edge drooping and folded over
  const bib = new Path2D();
  bib.moveTo(172, 270); bib.bezierCurveTo(190, 280, 222, 282, 244, 274);
  bib.bezierCurveTo(250, 288, 252, 298, 256, 306); bib.lineTo(164, 306);
  bib.bezierCurveTo(168, 296, 168, 284, 172, 270); bib.closePath();
  part(f, bib, {
    fill: g => { const gr = g.createLinearGradient(170, 270, 250, 306); gr.addColorStop(0, shade(P.overall, 0.1)); gr.addColorStop(1, shade(P.overall, -0.12)); return gr; },
    paint: g => { const q = new Path2D(); q.moveTo(176, 276); q.bezierCurveTo(192, 285, 222, 287, 240, 279); stitches(g, q, 'rgba(150,100,20,0.65)', 1.2, 4, 3); wrinkles(g, [172, 278, 76, 26, 0.1], 5, 'bib'); },
    tex: 0.5, shade: 0.4, ao: 0.25, hi: 0.15, outline: P.overallLine, outlineW: 1.2, cast: { alpha: 0.35, blur: 5, dist: 3 },
  });
  // poppy patch on the sagging pocket
  const pcx = 208, pcy = 291, pet = [];
  for (let k = 0; k < 5; k++) { const a = k / 5 * TAU - Math.PI / 2 + 0.2; pet.push(ellipse(pcx + Math.cos(a) * 5.5, pcy + Math.sin(a) * 4.5, 6, 4.5, a)); }
  part(f, pet, { fill: P.petal, tex: 0.3, shade: 0.3, ao: 0.2, hi: 0.1, outline: P.petalLine, outlineW: 0.8 });
  part(f, circle(pcx, pcy, 2.8), { fill: '#141414', tex: 0, shade: 0.2, ao: 0, hi: 0, outline: '#000', outlineW: 0.4 });
  // slack straps from the bib corners to the shoulders, with buttons
  for (const [bx, by, tx, ty] of [[176, 274, 160, 246], [240, 276, 258, 254]]) {
    const st = tube([[bx, by], [lerp(bx, tx, 0.5) + (tx < 200 ? -6 : 6), lerp(by, ty, 0.5) + 4], [tx, ty]], [15, 14, 13], { capStart: false });
    part(f, st, { fill: shade(P.overall, 0.0), tex: 0.5, shade: 0.35, ao: 0.25, hi: 0.15, outline: P.overallLine, outlineW: 1.1, cast: { alpha: 0.3, blur: 4, dist: 3 } });
    part(f, circle(bx, by, 7.5), { fill: P.button, tex: 0.1, shade: 0.35, ao: 0.2, hi: 0.2, shadeColor: '#5A5040', outline: '#8C8478', outlineW: 1, cast: { alpha: 0.35, blur: 3, dist: 2 },
      paint: g => { g.fillStyle = 'rgba(90,80,70,0.8)'; for (const [dx, dy] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) { g.beginPath(); g.arc(bx + dx, by + dy, 1.1, 0, TAU); g.fill(); } } });
  }
  // empty gloves hanging limp over the chair arms
  drawGlove(f, { x: 72, y: 302, ang: 6, mirror: false, fingerLen: 1.4, fingerAngles: [3, 0, -4], curl: 0.2, thumbAng: 18, palmW: 1.08, limp: true });
  drawGlove(f, { x: 348, y: 304, ang: -4, mirror: true, fingerLen: 1.4, fingerAngles: [5, 1, -2], curl: 0.2, thumbAng: 14, palmW: 1.08, limp: true });
  // legs: thighs come toward the viewer, flattened, shins hang down
  for (const [hip, knee, ank, sd] of [[[182, 318], [166, 372], [156, 436], -1], [[240, 320], [258, 376], [270, 438], 1]]) {
    const th = tube([hip, knee], [52, 60], { wobble: u => 0.05 * Math.sin(u * 13 + sd) });
    const sh = tube([[knee[0], knee[1] - 6], [lerp(knee[0], ank[0], 0.5) + sd * 3, lerp(knee[1], ank[1], 0.5)], ank], [52, 46, 46], { capStart: false, wobble: u => 0.05 * Math.sin(u * 17) });
    part(f, sh, { fill: shade(P.overall, -0.08), paint: g => wrinkles(g, [knee[0] - 22, knee[1] + 4, 44, 50, 1.2], 6, 'shin' + sd), tex: 0.5, shade: 0.42, ao: 0.25, hi: 0.14, outline: P.overallLine, outlineW: 1.3 });
    part(f, roundRect(ank[0] - 25, ank[1] - 16, 50, 15, 6), { fill: shade(P.overall, -0.1), tex: 0.5, shade: 0.45, ao: 0.3, hi: 0.15, outline: P.overallLine, outlineW: 1.2, cast: { alpha: 0.3, blur: 4, dist: 3 } });
    const thF = tube([hip, [lerp(hip[0], knee[0], 0.5) + sd * 4, lerp(hip[1], knee[1], 0.5)], knee], [56, 62, 58], { wobble: u => 0.07 * Math.sin(u * 23 + sd * 2) });
    part(f, thF, { fill: g => { const gr = g.createLinearGradient(hip[0], hip[1], knee[0], knee[1] + 20); gr.addColorStop(0, shade(P.overall, -0.02)); gr.addColorStop(1, shade(P.overall, 0.04)); return gr; },
      paint: g => { wrinkles(g, [hip[0] - 26, hip[1] - 4, 52, 56, 0.2], 11, 'thigh' + sd); wrinkles(g, [hip[0] - 26, hip[1] + 10, 52, 40, 1.6], 6, 'thighB' + sd); },
      tex: 0.5, shade: 0.3, ao: 0.32, aoBlur: 3, hi: 0.06, outline: P.overallLine, outlineW: 1.3, cast: { alpha: 0.35, blur: 7, dist: 5 } });
    // shoes flopped outward
    f.save(); f.translate(ank[0] + sd * 8, ank[1] + 24); f.rotate(sd * 0.35); f.translate(-(ank[0] + sd * 8), -(ank[1] + 24));
    drawShoe(f, ank[0] + sd * 8, ank[1] + 24, sd, P, 0);
    f.restore();
  }
  // the hollow head, fallen onto its right shoulder (screen-left)
  const H = headDefaults(Object.assign({ cx: 122, cy: 206, R: 64, tilt: -78, eyes: 'hollow', mouth: 'smile', decay: opts.decay || 0.25,
    asym: true, noCheeks: false, behind: null,
    front: (c) => neckHole(c, H, { x: 0.02, y: 0.97, rx: 0.56, ry: 0.27 }) }, opts.head || {}));
  return drawHead(f, H);
}

/* head-and-shoulders close-up: canvas 640x480, head centre (320, 210). */
function drawBust(f, opts) {
  const P = ENV.P;
  const R = opts.R || 150, cx = opts.cx || 320, cy = opts.cy || 210;
  const H = headOpts(opts, cx, cy, R);
  const k = R / 80;
  // shoulders + overall straps, cut by the bottom edge
  const sy = cy + 1.72 * R;
  const sh = new Path2D();
  sh.moveTo(cx - 2.1 * R, sy + 0.5 * R);
  sh.bezierCurveTo(cx - 2.05 * R, sy - 0.02 * R, cx - 1.75 * R, sy - 0.2 * R, cx - 1.35 * R, sy - 0.24 * R);
  sh.bezierCurveTo(cx - 0.95 * R, sy - 0.28 * R, cx - 0.6 * R, sy - 0.36 * R, cx - 0.3 * R, sy - 0.38 * R);
  sh.lineTo(cx + 0.3 * R, sy - 0.38 * R);
  sh.bezierCurveTo(cx + 0.6 * R, sy - 0.36 * R, cx + 0.95 * R, sy - 0.28 * R, cx + 1.35 * R, sy - 0.24 * R);
  sh.bezierCurveTo(cx + 1.75 * R, sy - 0.2 * R, cx + 2.05 * R, sy - 0.02 * R, cx + 2.1 * R, sy + 0.5 * R);
  sh.closePath();
  part(f, sh, {
    fill: g => { const gr = g.createLinearGradient(cx - 2 * R, sy - 0.4 * R, cx + 2 * R, sy + 0.5 * R); gr.addColorStop(0, shade(P.shirt, 0.08)); gr.addColorStop(1, shade(P.shirt, -0.14)); return gr; },
    paint: g => { for (const s2 of [-1, 1]) { const q = new Path2D(); q.moveTo(cx + s2 * 1.45 * R, sy - 0.23 * R); q.quadraticCurveTo(cx + s2 * 1.3 * R, sy + 0.1 * R, cx + s2 * 1.38 * R, sy + 0.4 * R); strokeP(g, q, 'rgba(20,55,12,0.45)', 1.6 * k); stitches(g, q, 'rgba(190,240,160,0.35)', 1.1 * k, 3 * k, 3 * k); } },
    tex: 0.55, shade: 0.4, ao: 0.25, hi: 0.13, outline: shade(P.stemDk, -0.3), outlineW: 1.4,
  });
  for (const s of [-1, 1]) {
    const st = new Path2D();
    st.moveTo(cx + s * 0.55 * R, sy - 0.37 * R); st.lineTo(cx + s * 0.88 * R, sy - 0.32 * R);
    st.lineTo(cx + s * 0.74 * R, sy + 0.6 * R); st.lineTo(cx + s * 0.40 * R, sy + 0.6 * R); st.closePath();
    part(f, st, { fill: P.overall, tex: 0.5, shade: 0.4, ao: 0.25, hi: 0.15, outline: P.overallLine, outlineW: 1.3, cast: { alpha: 0.32, blur: 6, dist: 4 },
      paint: g => { const q = new Path2D(); q.moveTo(cx + s * 0.60 * R, sy - 0.33 * R); q.lineTo(cx + s * 0.46 * R, sy + 0.6 * R); stitches(g, q, 'rgba(150,100,20,0.65)', 1.3 * k, 4 * k, 3 * k); const q2 = new Path2D(); q2.moveTo(cx + s * 0.83 * R, sy - 0.29 * R); q2.lineTo(cx + s * 0.69 * R, sy + 0.6 * R); stitches(g, q2, 'rgba(150,100,20,0.65)', 1.3 * k, 4 * k, 3 * k); } });
  }
  // neck
  const tt = H.tilt * DEG;
  const top = [cx - Math.sin(tt) * 0.7 * R, cy + Math.cos(tt) * 0.7 * R];
  const base = [cx, sy - 0.2 * R];
  const np = tube([[base[0], base[1] + 0.3 * R], [lerp(base[0], top[0], 0.5), lerp(base[1], top[1], 0.5)], top], [0.62 * R, 0.55 * R, 0.52 * R], { capStart: false });
  part(f, np, {
    fill: g => { const gr = g.createLinearGradient(cx - 0.3 * R, 0, cx + 0.3 * R, 0); gr.addColorStop(0, shade(P.stem, 0.08)); gr.addColorStop(1, shade(P.stemDk, -0.05)); return gr; },
    paint: g => { for (let i = -5; i <= 5; i++) { const q = new Path2D(); q.moveTo(base[0] + i * 0.055 * R, base[1] + 0.3 * R); q.lineTo(top[0] + i * 0.05 * R, top[1]); strokeP(g, q, i % 2 ? 'rgba(20,60,15,0.32)' : 'rgba(170,230,140,0.18)', 1.3 * k); } },
    tex: 0.5, shade: 0.45, ao: 0.28, hi: 0.12, outline: shade(P.stemDk, -0.3), outlineW: 1.4, cast: { alpha: 0.35, blur: 8, dist: 5 },
  });
  const head = drawHead(f, H);
  return { head };
}

/* ------------------------------------------------------------ lighting
 * Applied to the finished figure layer with alpha preserved. */
function applyLighting(FIG, opts) {
  const g = FIG.getContext('2d'), W = FIG.width, Hh = FIG.height;
  const keep = mk(W, Hh); keep.getContext('2d').drawImage(FIG, 0, 0);
  const restoreAlpha = () => { g.save(); ident(g); g.globalCompositeOperation = 'destination-in'; g.drawImage(keep, 0, 0); g.restore(); };
  if (opts.tint && opts.tint !== '#ffffff') {
    g.save(); ident(g); g.globalCompositeOperation = 'multiply'; g.fillStyle = opts.tint; g.fillRect(0, 0, W, Hh); g.restore(); restoreAlpha();
  }
  if (opts.lightFx) { opts.lightFx(g, keep, W, Hh); restoreAlpha(); }
}

/* rim light: bright edge on the side facing (dx,dy) */
function rimLight(g, mask, W, Hh, dx, dy, width, color, alpha, blur) {
  const L = mk(W, Hh), lg = L.getContext('2d');
  lg.drawImage(mask, 0, 0);
  lg.globalCompositeOperation = 'destination-out'; lg.drawImage(mask, -dx * width, -dy * width);
  lg.globalCompositeOperation = 'source-in'; lg.fillStyle = color; lg.fillRect(0, 0, W, Hh);
  // no rim along the canvas border (the figure continues past the frame)
  const m = Math.ceil(width * 1.5) + 2;
  lg.globalCompositeOperation = 'destination-in'; lg.fillStyle = '#000'; lg.fillRect(m, m, W - 2 * m, Hh - 2 * m);
  g.save(); ident(g); g.globalCompositeOperation = 'lighter'; g.globalAlpha = alpha; g.filter = `blur(${blur}px)`; g.drawImage(L, 0, 0); g.filter = 'none'; g.drawImage(L, 0, 0); g.restore();
}

root.Poppy = {
  drawPoppy, drawHead, headDefaults, drawGlove, part, setupEnv, ENV, palette, feltTexture,
  ellipse, circle, smoothClosed, smoothOpen, tube, rng, mulberry32, hashStr, shade, mixc, rgba, lpx, toScreen,
  eyeGeom, realEye, rimLight, neckHole, wrinkles, applyLighting, mk, acquire, release, ident, strokeP, stitches, TAU, DEG, lerp, clamp,
};
})(typeof window !== 'undefined' ? window : globalThis);
