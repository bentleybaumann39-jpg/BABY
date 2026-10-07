/* helpers.js - THE WORLD OF POPPY: shared canvas helpers for the misc art.
 *
 * Loaded into a headless Chromium page by render_misc.cjs (after
 * window.STROKEFONTS has been set from strokefonts.json). Exposes window.MH.
 *
 * Conventions
 *  - Every art function draws in LOGICAL pixels (the manifest size). The runner
 *    renders at SS x supersampling (ctx pre-scaled), so anything that works in
 *    device pixels (shadowBlur, shadowOffset, filter blur, getImageData) goes
 *    through the helpers below, which read the current transform scale.
 *  - Randomness is always seeded: MH.rng('asset:part') gives an independent,
 *    repeatable stream per part, so two variants of an asset (flower_5_eye and
 *    flower_5_eye_look) differ only where their parameters differ.
 *  - Shapes are dense point lists ([[x,y],...]) so the same outline can be
 *    filled, inset for stitching, and fuzzed along its edge.
 */
(function (root) {
'use strict';

const TAU = Math.PI * 2, DEG = Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = t => t * t * (3 - 2 * t);

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
  f.sgn = () => (r() < 0.5 ? -1 : 1);
  f.gauss = () => { let s = 0; for (let i = 0; i < 4; i++) s += r(); return (s - 2) / 0.577; };
  return f;
}

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

/* ------------------------------------------------- device-space helpers */
function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
function scaleOf(g) { const m = g.getTransform(); return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)); }
function shadow(g, color, blur, ox, oy) {
  const s = scaleOf(g);
  g.shadowColor = color; g.shadowBlur = (blur || 0) * s;
  g.shadowOffsetX = (ox || 0) * s; g.shadowOffsetY = (oy || 0) * s;
}
function noShadow(g) { g.shadowColor = 'rgba(0,0,0,0)'; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0; }
function blur(g, px) { return px > 0 ? `blur(${(px * scaleOf(g)).toFixed(2)}px)` : 'none'; }
/* An offscreen layer the same device size as g's canvas, with g's transform. */
function layerLike(g) {
  const c = mk(g.canvas.width, g.canvas.height), lg = c.getContext('2d');
  lg.setTransform(g.getTransform());
  return { c, g: lg };
}
function drawLayer(g, L, alpha, op, filter) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  if (alpha !== undefined) g.globalAlpha = alpha;
  if (op) g.globalCompositeOperation = op;
  if (filter) g.filter = filter;
  g.drawImage(L.c || L, 0, 0);
  g.restore();
}

/* ------------------------------------------------------------- geometry */
function ellipsePts(cx, cy, rx, ry, rot, n) {
  n = n || Math.max(48, Math.round((rx + ry) * 1.2));
  const c = Math.cos(rot || 0), s = Math.sin(rot || 0), out = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}
/* closed Catmull-Rom through control points, sampled densely */
function splineClosed(ctrl, per) {
  per = per || 12; const n = ctrl.length, out = [];
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
  per = per || 12; const n = ctrl.length, out = [];
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
function pathOf(pts, open) {
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  if (!open) p.closePath();
  return p;
}
function area(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
function centroid(pts) { let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1]; } return [x / pts.length, y / pts.length]; }
function bbox(pts) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
/* resample a closed (or open) polyline at a uniform spacing */
function resample(pts, step, open) {
  const out = [pts[0].slice()]; let carry = 0;
  const n = open ? pts.length - 1 : pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); let d = step - carry;
    while (d <= L) { const t = d / L; out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]); d += step; }
    carry = L - (d - step);
  }
  if (!open && out.length > 2) { const f = out[0], l = out[out.length - 1]; if (Math.hypot(f[0] - l[0], f[1] - l[1]) < step * 0.5) out.pop(); }
  return out;
}
function normals(pts, open) {
  const n = pts.length, s = area(pts) > 0 ? 1 : -1, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[open ? Math.max(0, i - 1) : (i - 1 + n) % n], b = pts[open ? Math.min(n - 1, i + 1) : (i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    out.push([s * dy / L, -s * dx / L]);   // outward for a closed shape
  }
  return out;
}
/* offset a closed shape: d > 0 grows, d < 0 shrinks (inset) */
function offset(pts, d) {
  const N = normals(pts);
  return pts.map((p, i) => [p[0] + N[i][0] * d, p[1] + N[i][1] * d]);
}
/* radial wobble: hand-cut irregularity */
function wobble(pts, amp, rand, freq) {
  const [cx, cy] = centroid(pts), ph = [rand() * TAU, rand() * TAU, rand() * TAU];
  freq = freq || 1;
  return pts.map(([x, y], i) => {
    const t = i / pts.length * TAU;
    const k = 1 + amp * (0.5 * Math.sin(3 * freq * t + ph[0]) + 0.3 * Math.sin(7 * freq * t + ph[1]) + 0.2 * Math.sin(13 * freq * t + ph[2]));
    return [cx + (x - cx) * k, cy + (y - cy) * k];
  });
}
function transformPts(pts, tx, ty, rot, sx, sy) {
  const c = Math.cos(rot || 0), s = Math.sin(rot || 0); sx = sx === undefined ? 1 : sx; sy = sy === undefined ? sx : sy;
  return pts.map(([x, y]) => { x *= sx; y *= sy; return [tx + x * c - y * s, ty + x * s + y * c]; });
}
/* teardrop / petal outline from the origin pointing along +y (down) is awkward;
 * petals point along angle th from (cx,cy): base half-width bw, tip length len, max half-width mw */
function petalPts(cx, cy, th, r0, len, mw, opts) {
  opts = opts || {};
  const tipRound = opts.tipRound === undefined ? 0.55 : opts.tipRound;   // 0 pointy, 1 very round
  const bw = opts.bw === undefined ? mw * 0.25 : opts.bw, belly = opts.belly === undefined ? 0.62 : opts.belly;
  const ctrl = [
    [r0, -bw], [r0 + len * 0.25, -mw * 0.8], [r0 + len * belly, -mw], [r0 + len * (0.86 + 0.06 * tipRound), -mw * (0.45 + 0.45 * tipRound)],
    [r0 + len, 0],
    [r0 + len * (0.86 + 0.06 * tipRound), mw * (0.45 + 0.45 * tipRound)], [r0 + len * belly, mw], [r0 + len * 0.25, mw * 0.8], [r0, bw], [r0 - len * 0.04, 0],
  ];
  return transformPts(splineClosed(ctrl, 10), cx, cy, th);
}
function lineAlong(pts, t) { // point at fraction t of an open polyline
  let L = 0; const seg = [];
  for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(d); L += d; }
  let want = t * L;
  for (let i = 0; i < seg.length; i++) {
    if (want <= seg[i]) { const u = want / (seg[i] || 1); return [lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u), Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0])]; }
    want -= seg[i];
  }
  const a = pts[pts.length - 2], b = pts[pts.length - 1];
  return [b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0])];
}

/* ------------------------------------------------------------- textures
 * Tileable value noise built from small random grids, upscaled with smoothing
 * on a 3x3 tiled canvas and cropped from the centre (so the tile is seamless). */
function noiseGrid(cells, rand, lo, hi) {
  const c = mk(cells, cells), g = c.getContext('2d'), id = g.createImageData(cells, cells);
  for (let i = 0; i < cells * cells; i++) { const v = Math.round(255 * lerp(lo, hi, rand())); id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
  g.putImageData(id, 0, 0);
  const t = mk(cells * 3, cells * 3), tg = t.getContext('2d');
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) tg.drawImage(c, i * cells, j * cells);
  return t;
}
function tileNoise(g, size, cells, rand, alpha, lo, hi) {
  const t = noiseGrid(cells, rand, lo === undefined ? 0 : lo, hi === undefined ? 1 : hi);
  g.save(); g.globalAlpha = alpha; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  // tiled 3x3 drawn at 3*size, offset by -size -> centre tile covers the canvas and wraps seamlessly
  g.drawImage(t, -size - size / cells / 2, -size - size / cells / 2, size * 3, size * 3);
  g.restore();
}
const TEX = {};
/* felt: grey (128 mean) mottling plus fibres; used with 'overlay' on a base colour */
function feltTex(size, seed) {
  const key = 'felt' + size + ':' + seed;
  if (TEX[key]) return TEX[key];
  const r = rng('felttex:' + seed), c = mk(size, size), g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, size, size);
  tileNoise(g, size, 6, r, 0.30, 0.25, 0.75);
  tileNoise(g, size, 20, r, 0.30, 0.2, 0.8);
  tileNoise(g, size, 70, r, 0.28, 0.15, 0.85);
  // fine grain
  const id = g.getImageData(0, 0, size, size), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 34; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
  // fibres (drawn wrapped so the tile stays seamless)
  g.lineCap = 'round';
  const fib = Math.round(size * size / 90);
  for (let i = 0; i < fib; i++) {
    const x = r() * size, y = r() * size, a = r() * TAU, L = 3 + r() * 10, bend = (r() - 0.5) * 6;
    const light = r() < 0.5;
    g.strokeStyle = light ? `rgba(255,255,255,${0.10 + r() * 0.22})` : `rgba(0,0,0,${0.08 + r() * 0.2})`;
    g.lineWidth = 0.6 + r() * 0.9;
    for (const ox of [0, -size, size]) for (const oy of [0, -size, size]) {
      if ((ox && Math.abs(x + ox - size / 2) > size / 2 + 14) || (oy && Math.abs(y + oy - size / 2) > size / 2 + 14)) continue;
      g.beginPath(); g.moveTo(x + ox, y + oy);
      g.quadraticCurveTo(x + ox + Math.cos(a) * L / 2 - Math.sin(a) * bend, y + oy + Math.sin(a) * L / 2 + Math.cos(a) * bend, x + ox + Math.cos(a) * L, y + oy + Math.sin(a) * L);
      g.stroke();
    }
  }
  const b = mk(size, size), bg = b.getContext('2d'); bg.filter = 'blur(0.6px)'; bg.drawImage(c, 0, 0);
  TEX[key] = b;
  return b;
}
/* paper: warm off-white with fibres, tooth and a few blotches; returned as grey overlay too */
function paperTex(size, seed) {
  const key = 'paper' + size + ':' + seed;
  if (TEX[key]) return TEX[key];
  const r = rng('papertex:' + seed), c = mk(size, size), g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, size, size);
  tileNoise(g, size, 5, r, 0.25, 0.3, 0.7);
  tileNoise(g, size, 40, r, 0.18, 0.3, 0.7);
  const id = g.getImageData(0, 0, size, size), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 22; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
  g.lineCap = 'round';
  for (let i = 0; i < size * size / 260; i++) {
    const x = r() * size, y = r() * size, a = r() * TAU, L = 2 + r() * 7;
    g.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'; g.lineWidth = 0.5 + r() * 0.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
  }
  TEX[key] = c;
  return c;
}
/* crayon tooth: alpha mask of the paper grain; crayon skips over the pits */
function toothTex(size, seed, density) {
  const key = 'tooth' + size + ':' + seed + ':' + density;
  if (TEX[key]) return TEX[key];
  const r = rng('tooth:' + seed), c = mk(size, size), g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, size, size);
  tileNoise(g, size, 90, r, 0.6, 0, 1);
  tileNoise(g, size, 220, r, 0.6, 0, 1);
  tileNoise(g, size, 16, r, 0.35, 0, 1);
  const id = g.getImageData(0, 0, size, size), d = id.data;
  const th = density === undefined ? 0.5 : density;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] / 255 + (r() - 0.5) * 0.25;
    // alpha = how much wax is REMOVED here (pits)
    const a = clamp((v - th) * 4.0, 0, 1);
    d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = Math.round(a * 255);
  }
  g.putImageData(id, 0, 0);
  TEX[key] = c;
  return c;
}
/* draw a texture as a pattern over a clip/path, aligned to device pixels */
function texFill(g, tex, path, op, alpha, ox, oy) {
  g.save();
  g.globalCompositeOperation = op || 'overlay'; g.globalAlpha = alpha === undefined ? 1 : alpha;
  const pat = g.createPattern(tex, 'repeat');
  const s = scaleOf(g), m = g.getTransform();
  // pattern space = user space; undo the user transform so 1 tex px = 1 device px
  const inv = new DOMMatrix([m.a, m.b, m.c, m.d, m.e, m.f]).inverse();
  pat.setTransform(inv.translate(ox || 0, oy || 0));
  g.fillStyle = pat;
  if (path) g.fill(path); else { g.setTransform(1, 0, 0, 1, 0, 0); pat.setTransform(new DOMMatrix().translate(ox || 0, oy || 0)); g.fillRect(0, 0, g.canvas.width, g.canvas.height); }
  g.restore();
  void s;
}

/* ----------------------------------------------------------------- felt
 * felt(g, pts, color, opts): a cut felt shape with cast shadow, fibre texture,
 * soft puffy rim, fuzzy cut edge and optional stitching.
 *  opts: shadow {blur, dx, dy, color} | false, tex (overlay strength), rim,
 *        light (0..1 gradient strength), fuzz (0..1), stitch {inset, color, dash, gap, w},
 *        seed, paint(g) callback drawn clipped inside after the base. */
function felt(g, pts, color, o) {
  o = o || {};
  const p = pathOf(pts), bb = bbox(pts), seed = o.seed || 'felt';
  const r = rng(seed + ':felt');
  g.save();
  // cast shadow
  if (o.shadow !== false) {
    const sh = o.shadow || {};
    shadow(g, sh.color || 'rgba(30,15,0,0.42)', sh.blur === undefined ? 4 : sh.blur, sh.dx === undefined ? 1.5 : sh.dx, sh.dy === undefined ? 2.5 : sh.dy);
  }
  g.fillStyle = color; g.fill(p); noShadow(g);
  g.save(); g.clip(p);
  // broad light: lighter top-left, darker bottom-right
  const lk = o.light === undefined ? 0.5 : o.light;
  if (lk > 0) {
    const gr = g.createLinearGradient(bb.x0, bb.y0, bb.x1, bb.y1);
    gr.addColorStop(0, `rgba(255,255,255,${0.22 * lk})`); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(0,0,0,${0.22 * lk})`);
    g.fillStyle = gr; g.fillRect(bb.x0 - 2, bb.y0 - 2, bb.w + 4, bb.h + 4);
  }
  if (o.paint) o.paint(g, bb);
  // fibre texture
  const s = scaleOf(g);
  texFill(g, feltTex(512, o.texSeed || 1), p, 'overlay', o.tex === undefined ? 0.75 : o.tex, r() * 512, r() * 512);
  // puffy rim: dark inner edge, light just inside top-left
  const rim = o.rim === undefined ? 1 : o.rim;
  if (rim > 0) {
    const rw = Math.max(2, Math.min(bb.w, bb.h) * 0.08) * (o.rimW || 1);
    g.globalCompositeOperation = 'multiply';
    g.filter = blur(g, rw * 0.6); g.lineWidth = rw * 1.6; g.strokeStyle = rgba(shade(color, -0.45), 0.55 * rim); g.stroke(p);
    g.filter = 'none';
    g.globalCompositeOperation = 'screen';
    g.translate(rw * 0.5, rw * 0.6);
    g.filter = blur(g, rw * 0.5); g.lineWidth = rw * 0.9; g.strokeStyle = `rgba(255,255,255,${0.13 * rim})`; g.stroke(p);
    g.filter = 'none';
  }
  g.restore();
  // cut-edge fuzz
  const fz = o.fuzz === undefined ? 1 : o.fuzz;
  if (fz > 0) {
    const edge = resample(pts, 1.1), N = normals(edge);
    g.lineCap = 'round';
    const c1 = shade(color, 0.12), c2 = shade(color, -0.2);
    for (let i = 0; i < edge.length; i++) {
      if (r() > 0.75 * fz) continue;
      const [x, y] = edge[i], [nx, ny] = N[i], L = 0.4 + r() * 1.2, a = (r() - 0.5) * 1.6;
      const ca = Math.cos(a), sa = Math.sin(a), dx = nx * ca - ny * sa, dy = nx * sa + ny * ca;
      g.strokeStyle = rgba(r() < 0.5 ? c1 : c2, 0.25 + r() * 0.35); g.lineWidth = 0.35 + r() * 0.45;
      g.beginPath(); g.moveTo(x - dx * 0.8, y - dy * 0.8); g.lineTo(x + dx * L, y + dy * L); g.stroke();
    }
  }
  if (o.stitch) stitch(g, pts, o.stitch, seed);
  g.restore();
  void s;
  return p;
}
/* running stitch along an inset of a closed shape (or along an open line with open:true) */
function stitch(g, pts, st, seed) {
  st = st || {};
  const r = rng((seed || 'st') + ':stitch');
  const line = st.open ? resample(pts, 0.8, true) : resample(offset(pts, -(st.inset === undefined ? 4 : st.inset)), 0.8);
  const dash = st.dash || 4.5, gap = st.gap || 3.5, w = st.w || 1.3, col = st.color || '#f4ecd8';
  let acc = r() * (dash + gap), on = false, start = null;
  g.save(); g.lineCap = 'round';
  const segs = [];
  for (let i = 0; i < line.length - (st.open ? 1 : 0); i++) {
    const a = line[i];
    acc += 0.8;
    if (!on && acc >= gap) { on = true; acc = 0; start = a; }
    else if (on && acc >= dash) { on = false; acc = 0; segs.push([start, a]); }
  }
  for (const [a, b] of segs) {   // thread shadow
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = w * 1.15;
    g.beginPath(); g.moveTo(a[0] + 0.5, a[1] + 0.7); g.lineTo(b[0] + 0.5, b[1] + 0.7); g.stroke();
  }
  for (const [a, b] of segs) {
    const jx = (r() - 0.5) * 0.5, jy = (r() - 0.5) * 0.5;
    g.strokeStyle = col; g.lineWidth = w * (0.85 + r() * 0.3);
    g.beginPath(); g.moveTo(a[0] + jx, a[1] + jy); g.lineTo(b[0] - jx, b[1] - jy); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = w * 0.35;
    g.beginPath(); g.moveTo(a[0] + jx - 0.2, a[1] + jy - 0.3); g.lineTo(b[0] - jx - 0.2, b[1] - jy - 0.3); g.stroke();
  }
  g.restore();
}

/* ---------------------------------------------------------- stroke font
 * Single-stroke vector fonts from strokefonts.json: 'tech' (hand printing),
 * 'sans1' (rounded sans when stroked thick), 'script1' (cursive).
 * strokeText returns {width, strokes: [[ [x,y], ...], ...]} in canvas units. */
function glyphStrokes(font, text, size, o) {
  o = o || {};
  const F = root.STROKEFONTS[font];
  const r = rng((o.seed || 'txt') + ':' + text);
  const track = (o.track || 0) * size;
  let x = 0; const strokes = [], letters = [];
  for (let ci = 0; ci < text.length; ci++) {
    const ch = text[ci], G = F.chars[ch] || F.chars['?'];
    const adv = G.adv * size;
    const rot = (o.rot || 0) * (r() - 0.5) * 2 * DEG, by = (o.bounce || 0) * (r() - 0.5) * 2 * size;
    const sc = 1 + (o.scaleJit || 0) * (r() - 0.5) * 2;
    const flip = o.mirror && o.mirror.includes(ci);
    const cxl = adv / 2, ls = [];
    for (const s of G.s) {
      const pts = [];
      for (let k = 0; k < s.length; k += 2) {
        let px = s[k] * size, py = s[k + 1] * size;
        if (flip) px = adv - px;
        // rotate/scale about the glyph's centre at x-height
        let dx = (px - cxl) * sc, dy = (py + 0.35 * size) * sc;
        const rx = dx * Math.cos(rot) - dy * Math.sin(rot), ry = dx * Math.sin(rot) + dy * Math.cos(rot);
        const j = o.jitter || 0;
        pts.push([x + cxl + rx + (r() - 0.5) * j * size, ry - 0.35 * size + by + (r() - 0.5) * j * size]);
      }
      strokes.push(pts); ls.push(pts);
    }
    letters.push({ ch, x0: x, adv, strokes: ls });
    x += adv * sc + track;
  }
  return { width: x - track, strokes, letters };
}
function strokeText(g, font, text, x, y, size, o) {
  o = o || {};
  const G = glyphStrokes(font, text, size, o);
  const ax = o.align === 'center' ? -G.width / 2 : o.align === 'right' ? -G.width : 0;
  const out = G.strokes.map(s => s.map(([px, py]) => [x + ax + px, y + py]));
  if (o.noDraw) return { width: G.width, strokes: out, letters: G.letters };
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = o.color || '#000'; g.lineWidth = (o.weight || 0.1) * size;
  for (const s of out) {
    const sp = s.length > 2 ? splineOpen(s, 4) : s;
    g.beginPath(); g.moveTo(sp[0][0], sp[0][1]);
    if (sp.length === 1) g.lineTo(sp[0][0] + 0.01, sp[0][1]);
    for (let i = 1; i < sp.length; i++) g.lineTo(sp[i][0], sp[i][1]);
    g.stroke();
  }
  g.restore();
  return { width: G.width, strokes: out, letters: G.letters };
}

/* ---------------------------------------------------------- bubble text
 * 90s kids-TV title lettering: inflated heavy letters (round-joined stroke
 * around a heavy sans), coloured outline, optional thin dark keyline, a solid
 * extruded drop shadow, top-lit gradient and white gloss highlights.
 *   o: x, y (baseline centre), size, font, fill, fill2 (bottom colour), outline,
 *      outlineW, keyline, keylineW, inflate, extrude {dx, dy, color, steps},
 *      softShadow {color, blur, dx, dy}, arch (px rise of the middle), track,
 *      jitter {rot (deg), bounce (px), scale}, gloss (0..1), seed, chipped (fn) */
function bubbleLayout(g, text, o) {
  const size = o.size, r = rng((o.seed || 'bub') + ':' + text);
  g.save(); g.font = o.font || `900 ${size}px Inter`;
  const ws = [...text].map(ch => g.measureText(ch).width);
  g.restore();
  const track = (o.track || 0) * size;
  const total = ws.reduce((a, b) => a + b, 0) + track * (ws.length - 1);
  const half = total / 2, arch = o.arch || 0, J = o.jitter || {};
  let x = o.x - half; const L = [];
  [...text].forEach((ch, i) => {
    const cx = x + ws[i] / 2, u = (cx - o.x) / half;
    const dy = -arch * (1 - u * u), slope = arch * 2 * u / half;
    L.push({ ch, x: cx, y: o.y + dy + (J.bounce || 0) * (r() - 0.5) * 2, rot: Math.atan(slope) + (J.rot || 0) * DEG * (r() - 0.5) * 2, sc: 1 + (J.scale || 0) * (r() - 0.5) * 2, w: ws[i] });
    x += ws[i] + track;
  });
  return { letters: L, total, size };
}
function bubbleText(g, text, o) {
  const lay = bubbleLayout(g, text, o), size = o.size;
  const font = o.font || `900 ${size}px Inter`;
  const inflate = (o.inflate === undefined ? 0.08 : o.inflate) * size;
  const ow = (o.outlineW === undefined ? 0.09 : o.outlineW) * size;
  const kw = (o.keylineW === undefined ? 0.025 : o.keylineW) * size;
  const each = (gg, fn) => { for (const l of lay.letters) { if (l.ch === ' ') continue; gg.save(); gg.translate(l.x, l.y); gg.rotate(l.rot); gg.scale(l.sc, l.sc); gg.font = font; gg.textAlign = 'center'; gg.textBaseline = 'alphabetic'; gg.lineJoin = 'round'; gg.lineCap = 'round'; fn(gg, l); gg.restore(); } };
  const solid = (gg, w, col) => each(gg, (q, l) => { q.fillStyle = col; q.strokeStyle = col; q.lineWidth = w; q.fillText(l.ch, 0, 0); if (w > 0) q.strokeText(l.ch, 0, 0); });
  const outerW = inflate + 2 * ow + (o.keyline ? 2 * kw : 0);
  // build the letter stack on one layer so overlapping letters stay clean
  const S = layerLike(g);
  // extruded shadow
  if (o.extrude) {
    const ex = o.extrude, steps = ex.steps || 8;
    for (let i = steps; i >= 1; i--) {
      S.g.save(); S.g.translate(ex.dx * i / steps, ex.dy * i / steps);
      solid(S.g, outerW, ex.color || '#3a1408');
      S.g.restore();
    }
  }
  if (o.keyline) solid(S.g, outerW, o.keyline);
  // outline (with its own top-lit gradient)
  const O = layerLike(g);
  solid(O.g, inflate + 2 * ow, o.outline || '#FFD21F');
  if (o.outline2) {
    O.g.save(); O.g.globalCompositeOperation = 'source-atop';
    const gr = O.g.createLinearGradient(0, o.y - size, 0, o.y + size * 0.15);
    gr.addColorStop(0, o.outline); gr.addColorStop(1, o.outline2);
    O.g.fillStyle = gr; O.g.fillRect(0, 0, 4000, 4000); O.g.restore();
  }
  drawLayer(S.g, O);
  // face
  const F = layerLike(g);
  solid(F.g, inflate, o.fill || '#E8262B');
  F.g.save(); F.g.globalCompositeOperation = 'source-atop';
  const top = o.y - size * 0.95 - (o.arch || 0), bot = o.y + size * 0.05;
  const gr = F.g.createLinearGradient(0, top, 0, bot);
  gr.addColorStop(0, shade(o.fill || '#E8262B', 0.18)); gr.addColorStop(0.55, o.fill || '#E8262B'); gr.addColorStop(1, o.fill2 || shade(o.fill || '#E8262B', -0.28));
  F.g.fillStyle = gr; F.g.fillRect(0, 0, 4000, 4000);
  // inner bottom-right shade for roundness: offset copy of the letters punched out
  const sh = layerLike(g); solid(sh.g, inflate, '#000');
  const I = layerLike(g); I.g.fillStyle = 'rgba(0,0,0,1)'; I.g.save(); I.g.setTransform(1, 0, 0, 1, 0, 0); I.g.fillRect(0, 0, I.c.width, I.c.height); I.g.globalCompositeOperation = 'destination-out'; I.g.drawImage(sh.c, -0.045 * size * scaleOf(g), -0.06 * size * scaleOf(g)); I.g.restore();
  F.g.restore();
  F.g.save(); F.g.globalCompositeOperation = 'source-atop'; F.g.setTransform(1, 0, 0, 1, 0, 0); F.g.globalAlpha = o.innerShade === undefined ? 0.28 : o.innerShade; F.g.filter = `blur(${0.03 * size * scaleOf(g)}px)`; F.g.drawImage(I.c, 0, 0); F.g.restore();
  // gloss highlights
  const gl = o.gloss === undefined ? 1 : o.gloss;
  if (gl > 0) {
    const r = rng((o.seed || 'bub') + ':gloss:' + text);
    F.g.save(); F.g.globalCompositeOperation = 'source-atop';
    each(F.g, (q, l) => {
      q.strokeStyle = `rgba(255,255,255,${0.85 * gl})`; q.fillStyle = `rgba(255,255,255,${0.9 * gl})`;
      const w = l.w, hx = -w * 0.28 + (r() - 0.5) * w * 0.06, hy = -size * 0.56;
      q.lineWidth = size * 0.055;
      q.beginPath(); q.moveTo(hx, hy + size * 0.16); q.quadraticCurveTo(hx, hy, hx + size * 0.12, hy - size * 0.05); q.stroke();
      if (o.glossDot !== false) { q.beginPath(); q.arc(hx, hy + size * 0.27, size * 0.028, 0, TAU); q.fill(); }
    });
    F.g.restore();
  }
  if (o.faceFx) o.faceFx(F.g, lay);
  drawLayer(S.g, F);
  if (o.stackFx) o.stackFx(S.g, lay, S);
  // final: soft shadow under the whole stack, then the stack
  if (o.softShadow) {
    const ss = o.softShadow;
    g.save(); shadow(g, ss.color || 'rgba(0,0,0,0.45)', ss.blur || 6, ss.dx || 0, ss.dy || 4);
    drawLayer(g, S); g.restore();
  } else drawLayer(g, S);
  return lay;
}

/* ------------------------------------------------------------- sunburst */
function sunburst(g, W, H, cx, cy, o) {
  o = o || {};
  const n = o.rays || 20, R = Math.hypot(W, H) * 1.2, rot = o.rot || 0;
  g.save();
  g.fillStyle = o.colB; g.fillRect(0, 0, W, H);
  g.fillStyle = o.colA;
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a0 = rot + i / n * TAU, a1 = a0 + TAU / n / 2;
    g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); g.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R); g.closePath();
  }
  g.fill();
  // airbrushed glow from the centre and darker edges
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(W, H) * 0.75);
  gr.addColorStop(0, o.glow || 'rgba(255,255,255,0.75)'); gr.addColorStop(0.25, o.glow2 || 'rgba(255,255,255,0.18)'); gr.addColorStop(0.7, 'rgba(255,255,255,0)'); gr.addColorStop(1, o.edge || 'rgba(0,0,40,0.25)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.restore();
}

/* sparkle / twinkle star */
function twinkle(g, x, y, r, o) {
  o = o || {};
  g.save(); g.translate(x, y); g.rotate(o.rot || 0);
  const gl = g.createRadialGradient(0, 0, 0, 0, 0, r * 1.3);
  gl.addColorStop(0, o.glow || 'rgba(255,255,230,0.8)'); gl.addColorStop(1, 'rgba(255,255,230,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(0, 0, r * 1.3, 0, TAU); g.fill();
  g.fillStyle = o.color || '#fffbe6';
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU - Math.PI / 2, rr = i % 2 ? r * 0.2 : (i % 4 === 0 ? r : r * 0.72);
    const x1 = Math.cos(a) * rr, y1 = Math.sin(a) * rr;
    if (i === 0) g.moveTo(x1, y1); else g.lineTo(x1, y1);
  }
  g.closePath(); g.fill();
  g.restore();
}

/* ------------------------------------------------------ flowers (felt)
 * Poppy flower in felt: 4 broad crinkled petals, black blotches at the petal
 * bases, black seed-pod centre with a star crown. Returns centre info. */
function feltPoppy(g, cx, cy, R, o) {
  o = o || {};
  const seed = o.seed || 'poppy', r = rng(seed + ':pf');
  const n = o.petals || 5, rot0 = o.rot === undefined ? r() * TAU : o.rot;
  const red = o.color || '#D7262B', dk = o.dark || '#9E1A1F', line = o.outline === undefined ? '#6E0E16' : o.outline;
  const hs = TAU / n / 2 * (o.spread || 1.45);       // half-angle of each petal (overlapping)
  const petals = [];
  for (let i = 0; i < n; i++) {
    const th = rot0 + i / n * TAU + (r() - 0.5) * 0.18;
    const k = 0.93 + r() * 0.12, ph = r() * TAU, nb = 3 + Math.floor(r() * 3);
    const pts = [];
    // outer edge: rounded fan with crinkles, scalloped toward the sides
    const NE = 36;
    for (let j = 0; j <= NE; j++) {
      const u = j / NE * 2 - 1, a = th + u * hs;
      const rr = R * k * (0.74 + 0.26 * Math.sqrt(Math.max(0, 1 - u * u))) * (1 + 0.03 * Math.sin(nb * Math.PI * u + ph) + 0.012 * Math.sin(17 * u + ph));
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    // sides back to a narrow base
    const base = R * 0.08;
    for (let j = 1; j <= 6; j++) { const t = j / 6, u = lerp(1, 0.8, t), rr = lerp(R * k * 0.74, base, t); const a = th + u * hs * lerp(1, 0.9, t); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
    for (let j = 0; j <= 6; j++) { const t = 1 - j / 6, u = -lerp(1, 0.8, t), rr = lerp(R * k * 0.74, base, t); const a = th + u * hs * lerp(1, 0.9, t); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
    petals.push({ pts: pts.reverse().slice(0, pts.length), th, len: R * k });
  }
  // dark underlay so no background shows between petal bases
  g.save(); g.fillStyle = shade(red, -0.35); g.beginPath(); g.arc(cx, cy, R * 0.5, 0, TAU); g.fill(); g.restore();
  // back petals (odd) first, then the front ones
  const order = [...petals.keys()].sort((a, b) => (b % 2) - (a % 2));
  for (const i of order) {
    const P = petals[i], back = i % 2 === 1;
    felt(g, P.pts, back ? shade(red, -0.12) : red, {
      seed: seed + ':p' + i, shadow: { blur: 3, dx: 0.8, dy: 1.6, color: 'rgba(60,0,0,0.45)' }, rim: 0.9, tex: o.tex === undefined ? 0.6 : o.tex, fuzz: o.fuzz === undefined ? 0.3 : o.fuzz, light: 0.4,
      paint: (q) => {
        q.lineCap = 'round';
        // crinkle veins radiating from the centre
        for (let k = 0; k < 9; k++) {
          const a = P.th + (k - 4) / 4 * hs * 0.8 + (r() - 0.5) * 0.06, l0 = R * 0.22, l1 = P.len * (0.62 + r() * 0.3);
          q.strokeStyle = rgba(dk, 0.3 + r() * 0.25); q.lineWidth = Math.max(0.5, R * 0.022);
          q.beginPath(); q.moveTo(cx + Math.cos(a) * l0, cy + Math.sin(a) * l0);
          const mid = (l0 + l1) / 2, wob = (r() - 0.5) * R * 0.07;
          q.quadraticCurveTo(cx + Math.cos(a) * mid - Math.sin(a) * wob, cy + Math.sin(a) * mid + Math.cos(a) * wob, cx + Math.cos(a) * l1, cy + Math.sin(a) * l1);
          q.stroke();
        }
        // soft highlight band on the petal
        const hx = cx + Math.cos(P.th - 0.25) * R * 0.62, hy = cy + Math.sin(P.th - 0.25) * R * 0.62;
        const hg = q.createRadialGradient(hx, hy, 0, hx, hy, R * 0.35);
        hg.addColorStop(0, 'rgba(255,190,170,0.28)'); hg.addColorStop(1, 'rgba(255,190,170,0)');
        q.fillStyle = hg; q.fillRect(cx - R * 1.2, cy - R * 1.2, R * 2.4, R * 2.4);
        // black blotch at the base
        const bx = cx + Math.cos(P.th) * R * 0.3, by = cy + Math.sin(P.th) * R * 0.3;
        const bg = q.createRadialGradient(bx, by, 0, bx, by, R * 0.27);
        bg.addColorStop(0, 'rgba(20,6,8,0.92)'); bg.addColorStop(0.6, 'rgba(20,6,8,0.55)'); bg.addColorStop(1, 'rgba(20,6,8,0)');
        q.fillStyle = bg; q.beginPath(); q.ellipse(bx, by, R * 0.3, R * 0.21, P.th, 0, TAU); q.fill();
      },
    });
    if (line) { g.save(); g.strokeStyle = rgba(line, 0.85); g.lineWidth = Math.max(0.6, R * 0.022); g.lineJoin = 'round'; g.stroke(pathOf(P.pts)); g.restore(); }
  }
  if (o.noCentre) return { cx, cy, R };
  // seed pod centre
  const pr = R * (o.podR || 0.24);
  const pod = ellipsePts(cx, cy, pr, pr, 0, 40);
  // stamens ring
  g.save();
  for (let i = 0; i < 30; i++) { const a = i / 30 * TAU, rr = pr * (1.1 + r() * 0.25); g.fillStyle = r() < 0.5 ? '#2a2220' : '#4a3a2e'; g.beginPath(); g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, Math.max(0.7, pr * 0.1), 0, TAU); g.fill(); }
  g.restore();
  felt(g, pod, '#1d1a1c', { seed: seed + ':pod', rim: 0.6, light: 1, shadow: { blur: 2, dx: 0.8, dy: 1.2 }, fuzz: 0.2 });
  g.save(); g.strokeStyle = 'rgba(120,115,120,0.85)'; g.lineWidth = Math.max(0.8, pr * 0.12); g.lineCap = 'round';
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + rot0; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * pr * 0.75, cy + Math.sin(a) * pr * 0.75); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(cx - pr * 0.35, cy - pr * 0.4, pr * 0.28, pr * 0.16, -0.6, 0, TAU); g.fill();
  g.restore();
  return { cx, cy, R, pr };
}
function feltDaisy(g, cx, cy, R, o) {
  o = o || {};
  const seed = o.seed || 'daisy', r = rng(seed + ':dz');
  const n = o.petals || 12, rot0 = o.rot || r() * TAU;
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < n; i++) {
      if ((i % 2) !== layer) continue;
      const th = rot0 + i / n * TAU + (r() - 0.5) * 0.08;
      const pts = wobble(petalPts(cx, cy, th, R * 0.15, R * (0.85 + r() * 0.12), R * 0.17, { tipRound: 1, belly: 0.6, bw: R * 0.08 }), 0.02, r);
      felt(g, pts, layer ? '#fbfaf3' : '#eeeadc', { seed: seed + ':p' + i, rim: 0.7, shadow: { blur: 2.5, dx: 1, dy: 1.5, color: 'rgba(40,30,0,0.35)' }, tex: 0.6 });
    }
  }
  const c = ellipsePts(cx, cy, R * 0.3, R * 0.3, 0, 48);
  felt(g, wobble(c, 0.03, r), o.centre || '#F6C21C', { seed: seed + ':c', rim: 0.9, shadow: { blur: 2, dx: 0.8, dy: 1.2 } });
  return { cx, cy, R };
}
function feltLeaf(g, x, y, th, len, w, o) {
  o = o || {};
  const seed = o.seed || 'leaf', r = rng(seed + ':lf');
  const pts = wobble(petalPts(x, y, th, 0, len, w, { tipRound: 0.1, belly: 0.45, bw: w * 0.15 }), 0.015, r);
  const col = o.color || '#3E8E3A';
  felt(g, pts, col, {
    seed, rim: 0.8, shadow: o.shadow || { blur: 3, dx: 1, dy: 2, color: 'rgba(0,30,0,0.35)' },
    paint: (q) => {
      q.strokeStyle = rgba(shade(col, -0.35), 0.55); q.lineWidth = Math.max(0.8, w * 0.07); q.lineCap = 'round';
      q.beginPath(); q.moveTo(x + Math.cos(th) * len * 0.05, y + Math.sin(th) * len * 0.05);
      q.quadraticCurveTo(x + Math.cos(th) * len * 0.5 - Math.sin(th) * w * 0.1, y + Math.sin(th) * len * 0.5 + Math.cos(th) * w * 0.1, x + Math.cos(th) * len * 0.88, y + Math.sin(th) * len * 0.88);
      q.stroke();
    },
    stitch: o.stitch,
  });
  return pts;
}

/* -------------------------------------------------------- realistic eye
 * A painted human eye: almond aperture, sclera with pink corners and veins,
 * radial-stroked iris with a dark limbal ring, pupil, optional wet line and
 * catchlight. gaze = [-1..1, -1..1] in fractions of the free travel.
 * o: w (corner to corner), open (height/w), irisR (fraction of w), pupil (fraction of iris),
 *    irisColor, gaze, catchlight, wet, lidColor, lidLine, veins, seed, allRound (sclera all round) */
function humanEye(g, cx, cy, o) {
  o = o || {};
  const w = o.w || 60, h = w * (o.open || 0.55), seed = o.seed || 'eye', r = rng(seed + ':eye');
  const tilt = o.tilt || 0;
  const L = -w / 2, Rr = w / 2;
  g.save(); g.translate(cx, cy); g.rotate(tilt);
  const ap = new Path2D();
  const lo = o.lower === undefined ? 0.42 : o.lower, up = o.upper === undefined ? 0.62 : o.upper;
  const ys = o.cornerDy || 0.04;
  ap.moveTo(L, h * ys);
  ap.bezierCurveTo(L + w * 0.2, -h * up * 1.05, Rr - w * 0.28, -h * up * 1.05, Rr, -h * ys);
  ap.bezierCurveTo(Rr - w * 0.22, h * lo, L + w * 0.24, h * lo * 1.02, L, h * ys);
  ap.closePath();
  // socket shading around the aperture
  if (o.socket !== false) {
    const sg = g.createRadialGradient(0, 0, w * 0.3, 0, 0, w * 0.85);
    sg.addColorStop(0, rgba(o.socketColor || '#5a3a30', o.socketA === undefined ? 0.45 : o.socketA)); sg.addColorStop(1, rgba(o.socketColor || '#5a3a30', 0));
    g.fillStyle = sg; g.beginPath(); g.ellipse(0, -h * 0.05, w * 0.85, w * 0.6, 0, 0, TAU); g.fill();
  }
  g.save(); g.clip(ap);
  // sclera
  g.fillStyle = o.sclera || '#ECE5D3'; g.fillRect(L - 2, -h, w + 4, h * 2);
  // pink corners
  for (const [x, k] of [[L, 1.0], [Rr, 0.7]]) {
    const pg = g.createRadialGradient(x, 0, 0, x, 0, w * 0.22);
    pg.addColorStop(0, `rgba(205,95,100,${0.85 * k})`); pg.addColorStop(0.45, `rgba(220,140,135,${0.45 * k})`); pg.addColorStop(1, 'rgba(220,150,140,0)');
    g.fillStyle = pg; g.fillRect(L - 2, -h, w + 4, h * 2);
  }
  // caruncle (inner corner bump)
  g.fillStyle = 'rgba(200,90,95,0.8)'; g.beginPath(); g.ellipse(L + w * 0.05, h * 0.05, w * 0.045, h * 0.13, 0, 0, TAU); g.fill();
  // veins
  const vn = o.veins === undefined ? 8 : o.veins;
  g.lineCap = 'round';
  for (let i = 0; i < vn; i++) {
    const side = i % 2 ? 1 : -1, x0 = side * w * 0.5, y0 = (r() - 0.5) * h * 0.5;
    let x = x0, y = y0, a = side > 0 ? Math.PI + (r() - 0.5) * 0.9 : (r() - 0.5) * 0.9;
    g.strokeStyle = `rgba(180,40,45,${0.25 + r() * 0.3})`; g.lineWidth = Math.max(0.35, w * 0.006 + r() * w * 0.004);
    g.beginPath(); g.moveTo(x, y);
    const steps = 4 + Math.floor(r() * 4);
    for (let k = 0; k < steps; k++) { a += (r() - 0.5) * 0.9; const s = w * (0.03 + r() * 0.03); x += Math.cos(a) * s; y += Math.sin(a) * s; g.lineTo(x, y); }
    g.stroke();
  }
  // upper-lid shadow on the eyeball and spherical shading
  const sh = g.createLinearGradient(0, -h * 0.7, 0, h * 0.5);
  sh.addColorStop(0, 'rgba(60,30,25,0.55)'); sh.addColorStop(0.35, 'rgba(60,30,25,0.1)'); sh.addColorStop(1, 'rgba(60,30,25,0.18)');
  g.fillStyle = sh; g.fillRect(L - 2, -h, w + 4, h * 2);
  const sph = g.createRadialGradient(0, 0, w * 0.15, 0, 0, w * 0.55);
  sph.addColorStop(0, 'rgba(0,0,0,0)'); sph.addColorStop(1, 'rgba(70,40,35,0.35)');
  g.fillStyle = sph; g.fillRect(L - 2, -h, w + 4, h * 2);
  // iris
  const ir = w * (o.irisR || 0.2), gz = o.gaze || [0, 0];
  const travelX = w * 0.5 - ir * 1.35, travelY = Math.max(0, h * 0.18);
  const ix = gz[0] * travelX, iy = gz[1] * travelY + (o.irisDy || 0) * h;
  const ic = o.irisColor || '#5b7a5a';
  const ig = g.createRadialGradient(ix, iy, ir * 0.1, ix, iy, ir);
  ig.addColorStop(0, shade(ic, 0.25)); ig.addColorStop(0.35, ic); ig.addColorStop(0.8, shade(ic, -0.3)); ig.addColorStop(1, shade(ic, -0.65));
  g.fillStyle = ig; g.beginPath(); g.arc(ix, iy, ir, 0, TAU); g.fill();
  // radial fibres
  const nf = o.fibres || 56;
  for (let i = 0; i < nf; i++) {
    const a = i / nf * TAU + (r() - 0.5) * 0.08, r0 = ir * (0.25 + r() * 0.15), r1 = ir * (0.75 + r() * 0.22);
    const light = r() < 0.45;
    g.strokeStyle = light ? rgba(shade(ic, 0.45), 0.35 + r() * 0.3) : rgba(shade(ic, -0.55), 0.3 + r() * 0.35);
    g.lineWidth = Math.max(0.3, ir * (0.025 + r() * 0.03));
    g.beginPath(); g.moveTo(ix + Math.cos(a) * r0, iy + Math.sin(a) * r0);
    const am = a + (r() - 0.5) * 0.12;
    g.quadraticCurveTo(ix + Math.cos(am) * (r0 + r1) / 2, iy + Math.sin(am) * (r0 + r1) / 2, ix + Math.cos(a) * r1, iy + Math.sin(a) * r1); g.stroke();
  }
  // collarette ring and crypts
  g.strokeStyle = rgba(shade(ic, 0.35), 0.4); g.lineWidth = Math.max(0.4, ir * 0.05);
  g.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU, rr = ir * (0.42 + 0.05 * Math.sin(a * 7 + 1.3)); const px = ix + Math.cos(a) * rr, py = iy + Math.sin(a) * rr; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.stroke();
  // limbal ring
  g.strokeStyle = 'rgba(15,10,10,0.75)'; g.lineWidth = Math.max(0.6, ir * 0.13);
  g.beginPath(); g.arc(ix, iy, ir * 0.95, 0, TAU); g.stroke();
  // pupil
  const pr = ir * (o.pupil === undefined ? 0.3 : o.pupil);
  g.fillStyle = '#060404'; g.beginPath(); g.arc(ix, iy, pr, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = Math.max(0.4, ir * 0.06); g.beginPath(); g.arc(ix, iy, pr + ir * 0.05, 0, TAU); g.stroke();
  // corneal sheen (soft), plus optional crisp catchlight
  if (o.wet !== false) {
    const cg = g.createRadialGradient(ix - ir * 0.3, iy - ir * 0.35, 0, ix - ir * 0.3, iy - ir * 0.35, ir * 0.9);
    cg.addColorStop(0, 'rgba(255,255,255,0.22)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = cg; g.beginPath(); g.arc(ix, iy, ir, 0, TAU); g.fill();
  }
  if (o.catchlight) {
    const cl = o.catchlight === true ? [-0.35, -0.4] : o.catchlight;
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.beginPath(); g.ellipse(ix + cl[0] * ir, iy + cl[1] * ir, ir * 0.16, ir * 0.12, -0.5, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.beginPath(); g.arc(ix + cl[0] * ir + ir * 0.5, iy + cl[1] * ir + ir * 0.75, ir * 0.05, 0, TAU); g.fill();
  }
  // upper lid lash-line shadow inside the aperture
  g.lineWidth = h * 0.16; g.strokeStyle = 'rgba(40,15,10,0.35)'; g.filter = blur(g, h * 0.05);
  const ul = new Path2D(); ul.moveTo(L, h * ys); ul.bezierCurveTo(L + w * 0.2, -h * up * 1.05, Rr - w * 0.28, -h * up * 1.05, Rr, -h * ys); g.stroke(ul); g.filter = 'none';
  g.restore(); // aperture clip
  // wet waterline on the lower lid
  if (o.wet !== false) {
    const wl = new Path2D(); wl.moveTo(L + w * 0.08, h * (ys + 0.05)); wl.bezierCurveTo(L + w * 0.28, h * lo * 1.0, Rr - w * 0.26, h * lo * 0.98, Rr - w * 0.06, -h * ys + h * 0.07);
    g.strokeStyle = 'rgba(255,240,235,0.55)'; g.lineWidth = Math.max(0.6, h * 0.04); g.stroke(wl);
    g.strokeStyle = 'rgba(200,110,110,0.45)'; g.lineWidth = Math.max(0.5, h * 0.035);
    g.save(); g.translate(0, h * 0.05); g.stroke(wl); g.restore();
  }
  // lid edges
  g.strokeStyle = o.lidLine || 'rgba(45,18,14,0.95)'; g.lineWidth = Math.max(0.8, w * 0.03); g.lineCap = 'round';
  const ul2 = new Path2D(); ul2.moveTo(L, h * ys); ul2.bezierCurveTo(L + w * 0.2, -h * up * 1.05, Rr - w * 0.28, -h * up * 1.05, Rr, -h * ys);
  g.stroke(ul2);
  g.lineWidth = Math.max(0.5, w * 0.012); g.strokeStyle = 'rgba(70,30,25,0.6)';
  const ll = new Path2D(); ll.moveTo(L, h * ys); ll.bezierCurveTo(L + w * 0.24, h * lo * 1.02, Rr - w * 0.22, h * lo, Rr, -h * ys); g.stroke(ll);
  // lashes
  if (o.lashes) {
    g.strokeStyle = 'rgba(25,10,8,0.9)'; g.lineWidth = Math.max(0.5, w * 0.012);
    for (let i = 1; i < 14; i++) {
      const t = i / 14, bx = lerp(L, Rr, t), by = -h * up * 0.79 * Math.sin(Math.PI * Math.pow(t, 0.85));
      const a = -Math.PI / 2 + (t - 0.5) * 1.4; const len = w * (0.06 + 0.04 * Math.sin(Math.PI * t));
      g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + Math.cos(a) * len * 0.5, by + Math.sin(a) * len, bx + Math.cos(a + 0.4) * len, by + Math.sin(a) * len * 1.1); g.stroke();
    }
  }
  // crease above
  if (o.crease !== false) {
    g.strokeStyle = 'rgba(60,30,25,0.35)'; g.lineWidth = Math.max(0.5, w * 0.018); g.filter = blur(g, w * 0.008);
    g.beginPath(); g.moveTo(L + w * 0.1, -h * 0.55); g.bezierCurveTo(L + w * 0.3, -h * 1.15, Rr - w * 0.3, -h * 1.15, Rr - w * 0.04, -h * 0.6); g.stroke(); g.filter = 'none';
  }
  g.restore();
  return { cx, cy, w, h, ix: cx + ix, iy: cy + iy, ir };
}

/* ------------------------------------------------------ teeth / mouths
 * A crescent grin packed with identical small square teeth.
 *  cx, cy: centre of the mouth line; hw: half width; depth: how far the
 *  lower lip drops; open: gap between the rows. Returns the mouth path. */
function grinPts(cx, cy, hw, curve, open, n) {
  n = n || 60;
  const up = [], lo = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n * 2 - 1, x = cx + t * hw;
    const base = cy + curve * (1 - t * t);           // upward-curving smile
    const gap = open * Math.pow(1 - t * t, 0.7);
    up.push([x, base - gap * 0.35 - 0.02 * hw * (1 - t * t)]);
    lo.push([x, base + gap * 0.65]);
  }
  return { up, lo, pts: up.concat(lo.reverse()) };
}
function squareTeeth(g, curvePts, nTeeth, size, o) {
  // place identical square teeth along a polyline, each rotated to its tangent
  o = o || {};
  const out = [];
  for (let i = 0; i < nTeeth; i++) {
    const t = (i + 0.5) / nTeeth;
    const [x, y, a] = lineAlong(curvePts, t);
    out.push([x, y, a]);
  }
  g.save();
  for (const [x, y, a] of out) {
    g.save(); g.translate(x, y); g.rotate(a + (o.flip ? Math.PI : 0));
    const s = size, h = s * (o.aspect || 1.05);
    // tooth: square with softly rounded corners, too white
    g.fillStyle = o.gapColor || 'rgba(60,20,20,0.6)';
    g.beginPath(); g.roundRect(-s / 2 - 0.4, -0.2, s + 0.8, h + 0.6, s * 0.12); g.fill();
    const tg = g.createLinearGradient(0, 0, 0, h);
    tg.addColorStop(0, o.root || '#e9e4d6'); tg.addColorStop(0.25, o.color || '#fdfdf8'); tg.addColorStop(1, o.tip || '#f4f2ea');
    g.fillStyle = tg; g.beginPath(); g.roundRect(-s / 2 + s * 0.06, 0, s * 0.88, h, [s * 0.05, s * 0.05, s * 0.16, s * 0.16]); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.roundRect(-s * 0.28, h * 0.25, s * 0.16, h * 0.55, s * 0.08); g.fill();
    g.restore();
  }
  g.restore();
  return out;
}

/* ----------------------------------------------------------- crayon
 * Crayon strokes are drawn into a per-colour layer, then the paper tooth is
 * punched out of the layer so the wax skips over the grain, then the layer is
 * multiplied onto the paper. */
function crayonLayer(g) { return layerLike(g); }
function crayonStroke(lg, pts, color, width, r, o) {
  o = o || {};
  const passes = o.passes || 4;
  lg.save(); lg.lineCap = 'round'; lg.lineJoin = 'round';
  const sp = pts.length > 2 && !o.straight ? splineOpen(pts, 6) : pts;
  for (let p = 0; p < passes; p++) {
    lg.strokeStyle = rgba(color, (o.alpha || 0.55) * (0.6 + r() * 0.5));
    lg.lineWidth = width * (0.55 + r() * 0.5);
    const ox = (r() - 0.5) * width * 0.6, oy = (r() - 0.5) * width * 0.6;
    lg.beginPath();
    for (let i = 0; i < sp.length; i++) {
      const j = (o.jitter === undefined ? 0.6 : o.jitter);
      const x = sp[i][0] + ox + (r() - 0.5) * j, y = sp[i][1] + oy + (r() - 0.5) * j;
      if (i) lg.lineTo(x, y); else lg.moveTo(x, y);
    }
    lg.stroke();
  }
  lg.restore();
}
/* fill a region with back-and-forth crayon hatching */
function crayonFill(lg, pts, color, width, r, o) {
  o = o || {};
  const bb = bbox(pts), ang = o.angle === undefined ? -0.5 : o.angle, step = o.step || width * 0.75;
  lg.save(); lg.clip(pathOf(pts));
  const c = Math.cos(ang), s = Math.sin(ang), R = Math.hypot(bb.w, bb.h) / 2 + width;
  const zig = [];
  for (let d = -R, k = 0; d <= R; d += step * (0.8 + r() * 0.4), k++) {
    const a = [bb.cx + c * -R - s * d, bb.cy + s * -R + c * d], b = [bb.cx + c * R - s * d, bb.cy + s * R + c * d];
    if (k % 2) zig.push(b, a); else zig.push(a, b);
  }
  crayonStroke(lg, zig, color, width, r, { passes: o.passes || 2, alpha: o.alpha || 0.5, straight: true, jitter: width * 0.5 });
  lg.restore();
}
function finishCrayon(g, L, o) {
  o = o || {};
  // punch the paper tooth
  L.g.save(); L.g.setTransform(1, 0, 0, 1, 0, 0); L.g.globalCompositeOperation = 'destination-out';
  const tooth = toothTex(512, o.seed || 1, o.density === undefined ? 0.52 : o.density);
  const pat = L.g.createPattern(tooth, 'repeat'); L.g.fillStyle = pat; L.g.fillRect(0, 0, L.c.width, L.c.height);
  L.g.restore();
  drawLayer(g, L, o.alpha === undefined ? 1 : o.alpha, o.op || 'multiply');
  if (o.wax) drawLayer(g, L, o.wax, 'source-over');
}

/* ------------------------------------------------------- misc utilities */
function grain(g, W, H, amt, seed, mono) {
  const s = scaleOf(g); g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const cw = g.canvas.width, ch = g.canvas.height, id = g.getImageData(0, 0, cw, ch), d = id.data, r = rng('grain:' + seed);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const n = (r() - 0.5) * amt * 255;
    if (mono === false) { d[i] += (r() - 0.5) * amt * 255; d[i + 1] += (r() - 0.5) * amt * 255; d[i + 2] += (r() - 0.5) * amt * 255; }
    else { d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  }
  g.putImageData(id, 0, 0); g.restore(); void s;
}
/* per-pixel colour transform: fn(r,g,b,a, x, y) -> [r,g,b] (device pixels) */
function pixelMap(g, fn) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const cw = g.canvas.width, ch = g.canvas.height, id = g.getImageData(0, 0, cw, ch), d = id.data;
  for (let y = 0, i = 0; y < ch; y++) for (let x = 0; x < cw; x++, i += 4) {
    const o = fn(d[i], d[i + 1], d[i + 2], d[i + 3], x, y);
    d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; if (o.length > 3) d[i + 3] = o[3];
  }
  g.putImageData(id, 0, 0); g.restore();
}
function vignette(g, W, H, k, col) {
  const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, col || `rgba(0,0,0,${k})`);
  g.save(); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
}
function roundRectPts(x, y, w, h, rad, per) {
  per = per || 10; const pts = [];
  const corners = [[x + w - rad, y + rad, -Math.PI / 2], [x + w - rad, y + h - rad, 0], [x + rad, y + h - rad, Math.PI / 2], [x + rad, y + rad, Math.PI]];
  for (const [cx, cy, a0] of corners) for (let i = 0; i <= per; i++) { const a = a0 + i / per * Math.PI / 2; pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); }
  return resample(pts, 2);
}
/* scalloped frame outline (closed) around a rounded rect */
function scallopPts(x, y, w, h, bump, n) {
  const base = roundRectPts(x, y, w, h, Math.min(w, h) * 0.12, 16);
  const rs = resample(base, 1), N = normals(rs), per = rs.length / n;
  return rs.map((p, i) => { const t = (i % per) / per; const k = Math.sin(Math.PI * t); return [p[0] + N[i][0] * bump * k, p[1] + N[i][1] * bump * k]; });
}

root.MH = {
  TAU, DEG, lerp, clamp, smooth, hashStr, mulberry32, rng,
  hex2rgb, rgb2hex, mixc, shade, rgba,
  mk, scaleOf, shadow, noShadow, blur, layerLike, drawLayer,
  ellipsePts, splineClosed, splineOpen, pathOf, area, centroid, bbox, resample, normals, offset, wobble, transformPts, petalPts, lineAlong,
  tileNoise, feltTex, paperTex, toothTex, texFill,
  felt, stitch, glyphStrokes, strokeText, bubbleLayout, bubbleText, sunburst, twinkle,
  feltPoppy, feltDaisy, feltLeaf, humanEye, grinPts, squareTeeth,
  crayonLayer, crayonStroke, crayonFill, finishCrayon, grain, pixelMap, vignette, roundRectPts, scallopPts,
};
})(typeof window !== 'undefined' ? window : globalThis);
