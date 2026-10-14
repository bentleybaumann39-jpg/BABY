/* felt.js - OPPOSITE DAY: generic felt-puppet drawing core (HTML canvas 2D).
 *
 * Copied from the proven poppy/draw/poppy.js core (felt texture, part() felt
 * pieces with puffy shading / ambient occlusion / cast shadows / outlines,
 * spline paths, tubes) with the Poppy-specific character code removed.
 * Exposes window.FELT. The twins (twins.js) are built on it.
 *
 *   FELT.setup(W, H, {px, light, seed, texScale})   size the layer pool + felt textures
 *   FELT.part(ctx, paths, style)                       one felt piece (see part() below)
 *   FELT.feltTexture(w, h, seed, scale)                neutral-grey overlay texture
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

function setup(W, Hh, opts) {
  opts = opts || {};
  ENV.W = W; ENV.H = Hh; ENV.seed = opts.seed === undefined ? 7 : opts.seed;
  ENV.px = opts.px || 1;
  ENV.light = opts.light || { x: -0.55, y: -0.83 };
  ENV.castK = opts.castK === undefined ? 1 : opts.castK;
  const ts = opts.texScale || ENV.px;
  ENV.tex = feltTexture(W, Hh, opts.texSeed || 11, ts);
  ENV.texB = feltTexture(W, Hh, (opts.texSeed || 11) + 12, ts * 0.8);
}

root.FELT = {
  ENV, setup, part, feltTexture, ellipse, circle, smoothClosed, smoothOpen, sampleSpline, tube, roundRect,
  strokeP, stitches, rng, mulberry32, hashStr, hex2rgb, rgb2hex, mixc, shade, rgba, desat, lpx, toScreen,
  mk, acquire, release, reset, ident, scaleOf, TAU, DEG, lerp, clamp,
};
})(typeof window !== 'undefined' ? window : globalThis);
