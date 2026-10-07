/* pieces_brand.js - THE WORLD OF POPPY misc art: Sunny Meadow ident + logo,
 * title card, segment bumper, end card and the cracked end card.
 * Each piece is window.MISC[name](g, W, H): g is already scaled so the piece
 * draws in manifest pixels. Uses window.MH (helpers.js). */
(function (root) {
'use strict';
const M = root.MH;
const { TAU, DEG, rng, shade, rgba, mixc, lerp, clamp } = M;
const MISC = root.MISC = root.MISC || {};
const LIB = root.MISCLIB = root.MISCLIB || {};

/* ------------------------------------------------------------ the sun */
function sunRays(g, cx, cy, R, o) {
  o = o || {};
  const n = o.n || 16, r = rng((o.seed || 'sun') + ':rays');
  g.save();
  g.filter = M.blur(g, o.soft === undefined ? 1.2 : o.soft);
  for (let i = 0; i < n; i++) {
    const a = (o.rot || 0) + i / n * TAU, long = i % 2 === 0;
    const r0 = R * 1.08, r1 = R * (long ? (o.long || 1.55) : (o.short || 1.32)), hw = (long ? 0.11 : 0.085) * (1 + (r() - 0.5) * 0.1);
    const gr = g.createRadialGradient(cx, cy, r0, cx, cy, r1);
    gr.addColorStop(0, o.c0 || 'rgba(255,214,70,0.95)'); gr.addColorStop(1, o.c1 || 'rgba(255,170,40,0.85)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(cx + Math.cos(a - hw) * r0, cy + Math.sin(a - hw) * r0);
    g.quadraticCurveTo(cx + Math.cos(a) * (r1 * 0.98), cy + Math.sin(a) * (r1 * 0.98), cx + Math.cos(a + hw) * r0, cy + Math.sin(a + hw) * r0);
    g.closePath(); g.fill();
  }
  g.restore();
}
/* airbrushed smiling sun disc */
function sunDisc(g, cx, cy, R, o) {
  o = o || {};
  g.save();
  const dg = g.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.05, cx, cy, R);
  dg.addColorStop(0, '#FFFBD0'); dg.addColorStop(0.35, '#FFE45C'); dg.addColorStop(0.8, '#FFC531'); dg.addColorStop(1, '#F5A21E');
  g.fillStyle = dg; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
  g.lineWidth = Math.max(1, R * 0.045); g.strokeStyle = o.rim || '#E8861A'; g.stroke();
  // face
  const ink = o.ink || '#6B3510';
  for (const s of [-1, 1]) {
    const ex = cx + s * R * 0.31, ey = cy - R * 0.12;
    g.fillStyle = ink; g.beginPath(); g.ellipse(ex, ey, R * 0.075, R * 0.115, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(ex - R * 0.022, ey - R * 0.045, R * 0.028, 0, TAU); g.fill();
    const ck = g.createRadialGradient(cx + s * R * 0.53, cy + R * 0.18, 0, cx + s * R * 0.53, cy + R * 0.18, R * 0.2);
    ck.addColorStop(0, 'rgba(255,105,80,0.55)'); ck.addColorStop(1, 'rgba(255,105,80,0)');
    g.fillStyle = ck; g.beginPath(); g.arc(cx + s * R * 0.53, cy + R * 0.18, R * 0.2, 0, TAU); g.fill();
  }
  g.strokeStyle = ink; g.lineWidth = Math.max(1, R * 0.065); g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - R * 0.36, cy + R * 0.17); g.quadraticCurveTo(cx, cy + R * 0.62, cx + R * 0.36, cy + R * 0.17); g.stroke();
  // airbrush sheen
  const sh = g.createRadialGradient(cx - R * 0.42, cy - R * 0.45, 0, cx - R * 0.42, cy - R * 0.45, R * 0.5);
  sh.addColorStop(0, 'rgba(255,255,255,0.55)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sh; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
  g.restore();
}
function sunGlow(g, cx, cy, R, k) {
  const gl = g.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 3.2);
  gl.addColorStop(0, `rgba(255,246,190,${0.85 * k})`); gl.addColorStop(0.35, `rgba(255,236,160,${0.35 * k})`); gl.addColorStop(1, 'rgba(255,236,160,0)');
  g.fillStyle = gl; g.fillRect(cx - R * 3.3, cy - R * 3.3, R * 6.6, R * 6.6);
}

/* ------------------------------------------------------------ hills */
function hillPath(pts) {   // pts: [[x,y]...] top contour left->right; closes along the bottom
  const p = new Path2D(), sp = M.splineOpen(pts, 16);
  p.moveTo(sp[0][0], sp[0][1]);
  for (const q of sp) p.lineTo(q[0], q[1]);
  p.lineTo(sp[sp.length - 1][0], 2000); p.lineTo(sp[0][0], 2000); p.closePath();
  return { p, top: sp };
}
function paintHill(g, H, y0, y1, cTop, cBot, o) {
  o = o || {};
  g.save();
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, cTop); gr.addColorStop(1, cBot);
  g.fillStyle = gr; g.fill(H.p);
  g.clip(H.p);
  // airbrushed rim light along the crest and a soft shade below it
  g.lineWidth = o.rimW || 10; g.strokeStyle = o.rim || 'rgba(230,255,170,0.45)'; g.filter = M.blur(g, o.rimBlur || 5);
  g.beginPath(); H.top.forEach((q, i) => i ? g.lineTo(q[0], q[1] + 2) : g.moveTo(q[0], q[1] + 2)); g.stroke();
  g.filter = 'none';
  g.restore();
}
function meadowFlowers(g, H, n, seed, x0, x1, y0, y1, sz) {
  const r = rng(seed + ':mf');
  const cols = [['#E8262B', '#FFE07A'], ['#FFFFFF', '#F6C21C'], ['#FFD93B', '#E07A10'], ['#FFFFFF', '#F6C21C'], ['#E8262B', '#3a1a10']];
  g.save();
  let placed = 0, tries = 0;
  while (placed < n && tries < n * 30) {
    tries++;
    const x = lerp(x0, x1, r()), y = lerp(y0, y1, Math.pow(r(), 0.8));
    if (!g.isPointInPath(H.p, x * M.scaleOf(g), y * M.scaleOf(g))) continue;
    // must be a bit below the crest
    placed++;
    const s = sz * (0.55 + 0.9 * (y - y0) / (y1 - y0)) * (0.8 + r() * 0.4);
    const [pc, cc] = cols[Math.floor(r() * cols.length)];
    g.fillStyle = 'rgba(20,60,10,0.25)'; g.beginPath(); g.arc(x + s * 0.2, y + s * 0.3, s * 1.05, 0, TAU); g.fill();
    g.fillStyle = pc;
    for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + r(); g.beginPath(); g.arc(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55, s * 0.5, 0, TAU); g.fill(); }
    g.fillStyle = cc; g.beginPath(); g.arc(x, y, s * 0.38, 0, TAU); g.fill();
  }
  g.restore();
}

/* --------------------------------------------------------- wordmark */
function wordmark(g, x, y, size, o) {
  o = o || {};
  return M.bubbleText(g, 'Sunny Meadow', {
    x, y, size, font: `900 ${size}px Inter`, fill: '#FFFFFF', fill2: o.fill2 || '#FFE9C2', outline: '#F28A1C', outline2: '#E2601A',
    outlineW: o.outlineW || 0.085, inflate: 0.07, keyline: o.keyline === undefined ? '#8A3A0E' : o.keyline, keylineW: 0.022,
    arch: o.arch === undefined ? size * 0.1 : o.arch, track: 0.01, gloss: 0.0, innerShade: 0.16,
    extrude: o.extrude, softShadow: o.softShadow === undefined ? { color: 'rgba(60,20,0,0.5)', blur: size * 0.09, dx: size * 0.02, dy: size * 0.07 } : o.softShadow,
    seed: 'wordmark',
  });
}
function spacedCaps(g, text, x, y, size, o) {
  o = o || {};
  g.save();
  g.font = `${o.weight || 800} ${size}px Inter`; g.textBaseline = 'alphabetic';
  const tr = (o.track || 0.3) * size;
  const ws = [...text].map(c => g.measureText(c).width);
  const total = ws.reduce((a, b) => a + b, 0) + tr * (ws.length - 1);
  let cx = x - total / 2;
  const draw = (col, dx, dy, stroke) => {
    let px = cx;
    [...text].forEach((c, i) => {
      if (stroke) { g.lineJoin = 'round'; g.lineWidth = stroke; g.strokeStyle = col; g.strokeText(c, px + dx, y + dy); }
      g.fillStyle = col; g.fillText(c, px + dx, y + dy); px += ws[i] + tr;
    });
  };
  if (o.shadow) { g.filter = M.blur(g, o.shadowBlur || 1.5); draw(o.shadow, o.sdx || 1.5, o.sdy || 2, o.shadowStroke || 0); g.filter = 'none'; }
  if (o.outline) draw(o.outline, 0, 0, o.outlineW || size * 0.16);
  draw(o.color || '#fff', 0, 0, 0);
  g.restore();
  return total;
}

/* ------------------------------------------------------------ IDENT */
function identScene(g, W, H, o) {
  o = o || {};
  // sky: warm blue at the top to pale yellow at the horizon
  const sky = g.createLinearGradient(0, 0, 0, H * 0.68);
  sky.addColorStop(0, '#3E79CF'); sky.addColorStop(0.35, '#6FA6E3'); sky.addColorStop(0.7, '#BFDDEB'); sky.addColorStop(1, '#FFF2B0');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  const sx = W * 0.5, sy = o.sunY || H * 0.49, SR = o.sunR || H * 0.18;
  // long soft rays across the sky
  g.save();
  g.globalCompositeOperation = 'screen';
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * TAU + 0.09, hw = 0.075;
    const gr = g.createRadialGradient(sx, sy, SR, sx, sy, W * 0.75);
    gr.addColorStop(0, 'rgba(255,240,180,0.40)'); gr.addColorStop(1, 'rgba(255,240,180,0)');
    g.fillStyle = gr; g.filter = M.blur(g, 3);
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a - hw) * W, sy + Math.sin(a - hw) * W); g.lineTo(sx + Math.cos(a + hw) * W, sy + Math.sin(a + hw) * W); g.closePath(); g.fill();
  }
  g.restore();
  sunGlow(g, sx, sy, SR, 1);
  // a couple of airbrushed clouds
  const cloud = (cx, cy, s) => {
    g.save(); g.filter = M.blur(g, 2.5);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [dx, dy, rr] of [[-1.1, 0.15, 0.55], [-0.45, -0.2, 0.75], [0.35, -0.1, 0.65], [1.0, 0.18, 0.5], [0, 0.25, 0.6]]) { g.beginPath(); g.ellipse(cx + dx * s, cy + dy * s, rr * s * 1.15, rr * s * 0.8, 0, 0, TAU); g.fill(); }
    g.filter = 'none';
    const sh = g.createLinearGradient(0, cy - s * 0.4, 0, cy + s * 0.7);
    sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(150,175,215,0.35)');
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = sh; g.fillRect(cx - s * 2, cy - s, s * 4, s * 2);
    g.restore();
  };
  // clouds are drawn on their own layer so source-atop only shades the cloud
  const CL = M.layerLike(g);
  const cl = CL.g; const save = g;
  void save;
  [[W * 0.14, H * 0.16, 30], [W * 0.84, H * 0.12, 24], [W * 0.73, H * 0.3, 16]].forEach(([x, y, s]) => {
    const L = M.layerLike(g);
    ((gg) => {
      gg.save(); gg.filter = M.blur(gg, 2.2); gg.fillStyle = 'rgba(255,255,255,0.9)';
      for (const [dx, dy, rr] of [[-1.1, 0.15, 0.55], [-0.45, -0.2, 0.75], [0.35, -0.1, 0.65], [1.0, 0.18, 0.5], [0, 0.25, 0.6]]) { gg.beginPath(); gg.ellipse(x + dx * s, y + dy * s, rr * s * 1.15, rr * s * 0.8, 0, 0, TAU); gg.fill(); }
      gg.filter = 'none'; gg.globalCompositeOperation = 'source-atop';
      const sh = gg.createLinearGradient(0, y - s * 0.5, 0, y + s * 0.7);
      sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(140,165,210,0.45)');
      gg.fillStyle = sh; gg.fillRect(x - s * 2.5, y - s * 1.5, s * 5, s * 3); gg.restore();
    })(L.g);
    M.drawLayer(cl, L);
  });
  M.drawLayer(g, CL, 0.9);
  void cloud;
  sunRays(g, sx, sy, SR, { n: 16, rot: -0.05, seed: 'ident' });
  sunDisc(g, sx, sy, SR);
  // hills: back-left lighter, front-right richer; the sun rises in the valley
  const back = hillPath([[-40, H * 0.70], [W * 0.08, H * 0.6], [W * 0.26, H * 0.555], [W * 0.43, H * 0.6], [W * 0.62, H * 0.72], [W * 0.8, H * 0.82], [W + 40, H * 0.9]]);
  paintHill(g, back, H * 0.55, H, '#9CD35A', '#4C9A34', { rim: 'rgba(240,255,190,0.55)' });
  const front = hillPath([[W * 0.3, H + 20], [W * 0.42, H * 0.76], [W * 0.56, H * 0.655], [W * 0.74, H * 0.615], [W * 0.9, H * 0.635], [W + 40, H * 0.67]]);
  // shade cast by the front hill onto the back hill
  g.save(); g.filter = M.blur(g, 8); g.translate(-10, 6); g.fillStyle = 'rgba(20,70,20,0.35)'; g.fill(front.p); g.restore();
  paintHill(g, front, H * 0.6, H, '#8ACB48', '#2F7F2A', { rim: 'rgba(235,255,180,0.6)' });
  // foreground meadow swell
  const fg = hillPath([[-40, H * 0.86], [W * 0.2, H * 0.83], [W * 0.5, H * 0.87], [W * 0.8, H * 0.84], [W + 40, H * 0.86]]);
  g.save(); g.filter = M.blur(g, 7); g.translate(0, -4); g.fillStyle = 'rgba(20,70,20,0.3)'; g.fill(fg.p); g.restore();
  paintHill(g, fg, H * 0.82, H, '#77BD3F', '#2C7426', { rim: 'rgba(225,255,170,0.45)' });
  meadowFlowers(g, back, 60, 'b', 0, W * 0.6, H * 0.6, H * 0.84, 2.2);
  meadowFlowers(g, front, 70, 'f', W * 0.38, W, H * 0.66, H * 0.84, 2.4);
  meadowFlowers(g, fg, 80, 'g', 0, W, H * 0.86, H, 3.2);
  return { sx, sy, SR };
}

MISC.ident_sunny_meadow = function (g, W, H) {
  identScene(g, W, H, { sunY: H * 0.475, sunR: 88 });
  wordmark(g, W / 2, H * 0.818, 74, { arch: 6 });
  spacedCaps(g, 'HOME VIDEO', W / 2, H * 0.925, 21, { color: '#FFFFFF', track: 0.42, weight: 800, shadow: 'rgba(10,50,10,0.75)', sdx: 1.2, sdy: 1.8, shadowBlur: 1.6 });
  M.vignette(g, W, H, 0.22);
  M.grain(g, W, H, 0.025, 'ident');
};

/* --------------------------------------------------------- SM LOGO */
function logoBadge(g, cx, cy, R) {
  g.save();
  M.shadow(g, 'rgba(0,0,0,0.45)', 3, 0, 2);
  g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(cx, cy, R + R * 0.1, 0, TAU); g.fill();
  M.noShadow(g);
  g.lineWidth = R * 0.07; g.strokeStyle = '#F28A1C'; g.beginPath(); g.arc(cx, cy, R + R * 0.1, 0, TAU); g.stroke();
  g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
  const sky = g.createLinearGradient(0, cy - R, 0, cy + R * 0.4);
  sky.addColorStop(0, '#4A86D8'); sky.addColorStop(0.6, '#A9D2EE'); sky.addColorStop(1, '#FFF1AE');
  g.fillStyle = sky; g.fillRect(cx - R, cy - R, R * 2, R * 2);
  const sR = R * 0.42, sx = cx, sy = cy + R * 0.02;
  sunGlow(g, sx, sy, sR, 0.8);
  sunRays(g, sx, sy, sR, { n: 12, long: 1.6, short: 1.35, soft: 0.4, seed: 'logo' });
  sunDisc(g, sx, sy, sR);
  const back = hillPath([[cx - R * 1.2, cy + R * 0.5], [cx - R * 0.55, cy + R * 0.22], [cx - R * 0.05, cy + R * 0.38], [cx + R * 0.5, cy + R * 0.75], [cx + R * 1.2, cy + R * 0.9]]);
  paintHill(g, back, cy + R * 0.2, cy + R, '#9CD35A', '#4C9A34', { rimW: 3, rimBlur: 1.5 });
  const front = hillPath([[cx - R * 0.3, cy + R * 1.2], [cx + R * 0.1, cy + R * 0.55], [cx + R * 0.55, cy + R * 0.34], [cx + R * 1.2, cy + R * 0.42]]);
  paintHill(g, front, cy + R * 0.3, cy + R, '#8ACB48', '#2F7F2A', { rimW: 3, rimBlur: 1.5 });
  meadowFlowers(g, back, 10, 'lb', cx - R, cx + R * 0.2, cy + R * 0.4, cy + R, 1.2);
  meadowFlowers(g, front, 10, 'lf', cx, cx + R, cy + R * 0.5, cy + R, 1.2);
  g.restore();
  g.save(); g.lineWidth = R * 0.05; g.strokeStyle = 'rgba(120,60,10,0.5)'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke(); g.restore();
}
MISC.sm_logo = function (g, W, H) {
  logoBadge(g, W / 2, 47, 40);
  wordmark(g, W / 2, 126, 29.5, { arch: 3, outlineW: 0.1, softShadow: { color: 'rgba(0,0,0,0.55)', blur: 2.5, dx: 0.5, dy: 2 } });
  spacedCaps(g, 'HOME VIDEO', W / 2, 151, 12.5, { color: '#FFFFFF', track: 0.45, weight: 800, outline: '#E2601A', outlineW: 3.2, shadow: 'rgba(0,0,0,0.6)', sdx: 0.6, sdy: 1.2, shadowBlur: 1, shadowStroke: 3.2 });
};

/* ------------------------------------------------- show backgrounds */
function blueBurst(g, W, H, cx, cy) {
  M.sunburst(g, W, H, cx, cy, { rays: 22, rot: 0.06, colA: '#8FD4F6', colB: '#5DB6EA', glow: 'rgba(255,255,255,0.85)', glow2: 'rgba(255,255,255,0.22)', edge: 'rgba(10,40,110,0.32)' });
  // keep the caption band calmer: wash the rays toward a flat sky blue at the bottom
  const cal = g.createLinearGradient(0, H - 95, 0, H);
  cal.addColorStop(0, 'rgba(84,170,226,0)'); cal.addColorStop(1, 'rgba(84,170,226,0.62)');
  g.fillStyle = cal; g.fillRect(0, H - 95, W, 95);
  M.grain(g, W, H, 0.018, 'burst');
}
function poppyCorner(g, W, H, seed) {
  // a felt border of poppies and leaves hugging the bottom-left corner
  // (kept left of x~150 in the bottom 60 px so the caption band stays calm)
  const r = rng(seed + ':corner');
  const leaves = [[14, 214, -1.35, 62, 18], [62, 262, -0.95, 58, 17], [-6, 300, -0.35, 64, 18], [118, 330, -0.75, 62, 17], [66, 384, -0.45, 60, 17], [150, 410, -0.3, 54, 15], [10, 420, -1.7, 58, 17], [112, 462, -0.15, 52, 15], [40, 480, -1.2, 50, 15]];
  for (const [x, y, th, len, w] of leaves) M.feltLeaf(g, x, y, th + (r() - 0.5) * 0.15, len, w, { seed: seed + ':lf' + x + ':' + y, color: r() < 0.5 ? '#3E8E3A' : '#4C9F3E' });
  const bud = (x, y, a) => {
    const pts = M.wobble(M.ellipsePts(x, y, 7, 11, a, 40), 0.03, r);
    M.felt(g, pts, '#4C9F3E', { seed: seed + ':bud' + x, rim: 0.7, shadow: { blur: 2, dx: 1, dy: 1.5 }, fuzz: 0.3 });
    const tip = M.wobble(M.ellipsePts(x + Math.sin(a) * 6, y - Math.cos(a) * 8, 6, 7, a, 30), 0.04, r);
    M.felt(g, tip, '#D7262B', { seed: seed + ':budt' + x, rim: 0.6, shadow: false, fuzz: 0.3 });
  };
  bud(126, 300, 0.5); bud(40, 196, -0.2); bud(172, 392, 0.8);
  const fl = [[30, 262, 36], [94, 330, 42], [18, 360, 34], [58, 434, 44], [136, 418, 32], [-4, 470, 30], [128, 486, 30]];
  fl.forEach(([x, y, R], i) => M.feltPoppy(g, x, y, R, { seed: seed + ':pp' + i, petals: i % 3 === 0 ? 4 : 5 }));
}
function twinkles(g, list, seed) {
  const r = rng(seed + ':tw');
  for (const [x, y, s] of list) M.twinkle(g, x, y, s, { rot: (r() - 0.5) * 0.3 });
}
function bigTitle(g, text, x, y, size, o) {
  o = o || {};
  return M.bubbleText(g, text, Object.assign({
    x, y, size, font: `900 ${size}px Inter`, fill: '#E8262B', fill2: '#B3141C', outline: '#FFE03A', outline2: '#F7B21A', outlineW: 0.085,
    inflate: 0.035, keyline: '#4A0A10', keylineW: 0.028, arch: size * 0.12,
    extrude: { dx: size * 0.03, dy: size * 0.07, color: '#2B0A12', steps: 10 },
    softShadow: { color: 'rgba(0,20,60,0.45)', blur: size * 0.07, dx: 0, dy: size * 0.04 },
    jitter: { rot: 3, bounce: size * 0.02 }, gloss: 0.9, glossDot: false, seed: 'title:' + text,
  }, o));
}
function smallCaps(g, text, x, y, size, o) {
  o = o || {};
  return M.bubbleText(g, text, Object.assign({
    x, y, size, font: `900 ${size}px Inter`, fill: '#FFFFFF', fill2: '#E6F3FF', outline: '#1E5CB3', outline2: '#173F86', outlineW: 0.1,
    inflate: 0.08, keyline: null, arch: 2, track: 0.08, gloss: 0, innerShade: 0.12,
    softShadow: { color: 'rgba(0,20,70,0.5)', blur: 3, dx: 0, dy: 3 }, seed: 'caps:' + text,
  }, o));
}

function titleBackground(g, W, H, seed) {
  blueBurst(g, W, H, W * 0.47, H * 0.3);
  twinkles(g, [[44, 40, 13], [596, 42, 15], [612, 160, 10], [30, 168, 9], [520, 112, 8], [250, 236, 9], [372, 250, 7], [138, 222, 7]], seed);
  poppyCorner(g, W, H, seed);
}
MISC.title_card = function (g, W, H) {
  titleBackground(g, W, H, 'title');
  smallCaps(g, 'THE WORLD OF', W * 0.47, 62, 36);
  bigTitle(g, 'POPPY!', W * 0.47, 197, 134, { arch: 18 });
  M.vignette(g, W, H, 0.12);
};

/* ------------------------------------------------------- END CARDS */
function endCardText(g, W, H) {
  const l1 = bigTitle(g, 'SEE YOU TOMORROW,', W * 0.5, 104, 52, { arch: 9, extrude: { dx: 1.6, dy: 3.6, color: '#2B0A12', steps: 8 }, softShadow: { color: 'rgba(0,20,60,0.45)', blur: 4, dx: 0, dy: 2.5 }, jitter: { rot: 4, bounce: 1.5 } });
  const l2 = bigTitle(g, 'FRIEND!', W * 0.5, 203, 92, { arch: 12, jitter: { rot: 4, bounce: 2 } });
  return [l1, l2];
}
MISC.end_card = function (g, W, H) {
  titleBackground(g, W, H, 'end');
  endCardText(g, W, H);
  M.vignette(g, W, H, 0.12);
};
LIB.endCardText = endCardText;
LIB.titleBackground = titleBackground;

/* end card, broken: drained colour, smashed screen, chipped letters, grime */
MISC.end_card_cracked = function (g, W, H) {
  const s = M.scaleOf(g);
  // background-only plate (for chips) and the full card
  const BG = M.layerLike(g); titleBackground(BG.g, W, H, 'end');
  const lay = (() => { const L = M.layerLike(g); M.drawLayer(L.g, BG); const t = endCardText(L.g, W, H); M.vignette(L.g, W, H, 0.12); return { L, t }; })();
  M.drawLayer(g, lay.L);
  // chips: bites out of letter edges showing the (drained) backdrop + a pale broken-plastic rim
  const r = rng('crack:chips');
  const chips = [];
  const pick = [[0, 2], [0, 7], [0, 12], [0, 15], [1, 1], [1, 4], [1, 6]];
  for (const [li, ci] of pick) {
    const L = lay.t[li].letters.filter(l => l.ch !== ' ' && l.ch !== ',')[ci] || lay.t[li].letters[ci];
    if (!L) continue;
    const size = li ? 92 : 52;
    const side = r() < 0.5 ? -1 : 1;
    const cx = L.x + side * L.w * (0.35 + r() * 0.2), cy = L.y - size * (0.15 + r() * 0.6);
    const n = 6 + Math.floor(r() * 3), rad = size * (0.1 + r() * 0.07), pts = [];
    for (let k = 0; k < n; k++) { const a = k / n * TAU + r() * 0.5; const rr = rad * (0.55 + r() * 0.6); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
    chips.push(pts);
  }
  for (const pts of chips) {
    const p = M.pathOf(pts);
    g.save(); g.clip(p); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(BG.c, 0, 0); g.restore();
    g.save(); g.strokeStyle = 'rgba(255,250,235,0.85)'; g.lineWidth = 1.1; g.stroke(p);
    g.translate(0.8, 1); g.strokeStyle = 'rgba(40,30,20,0.55)'; g.lineWidth = 0.8; g.stroke(p); g.restore();
  }
  // colour drain to a sickly sepia-green
  M.pixelMap(g, (R, G, B) => {
    const l = 0.3 * R + 0.59 * G + 0.11 * B;
    const t = l / 255;
    const tr = lerp(28, 206, t), tg = lerp(30, 200, t), tb = lerp(14, 150, t);
    return [lerp(tr, R, 0.14) * 0.97, lerp(tg, G, 0.14), lerp(tb, B, 0.12) * 0.92];
  });
  // grime: grey smudges, finger smears, dirty edges
  const gr = rng('crack:grime');
  g.save();
  for (let i = 0; i < 26; i++) {
    const x = gr() * W, y = gr() * H, rx = 20 + gr() * 70, ry = 10 + gr() * 40;
    g.filter = M.blur(g, 6 + gr() * 10);
    g.fillStyle = `rgba(${55 + gr() * 30},${58 + gr() * 30},${50 + gr() * 20},${0.10 + gr() * 0.16})`;
    g.beginPath(); g.ellipse(x, y, rx, ry, gr() * TAU, 0, TAU); g.fill();
  }
  g.filter = 'none';
  // finger smears: soft parallel arcs
  for (const [x, y, a] of [[120, 160, -0.4], [430, 90, 0.3], [300, 300, -0.1], [560, 210, 0.6]]) {
    g.save(); g.translate(x, y); g.rotate(a); g.filter = M.blur(g, 1.4);
    for (let k = 0; k < 9; k++) { g.strokeStyle = `rgba(70,72,60,${0.10 + gr() * 0.12})`; g.lineWidth = 1.5 + gr() * 1.5; g.beginPath(); g.ellipse(0, 0, 14 + k * 3.2, 9 + k * 2.4, 0, Math.PI * 1.1, Math.PI * 1.95); g.stroke(); }
    g.restore();
  }
  const ed = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
  ed.addColorStop(0, 'rgba(20,22,12,0)'); ed.addColorStop(1, 'rgba(20,22,12,0.55)');
  g.fillStyle = ed; g.fillRect(0, 0, W, H);
  g.restore();
  // ---- cracks: impact where Poppy stood (lower right)
  const ix = 538, iy = 352;
  const cr = rng('crack:lines');
  const snapshot = M.mk(g.canvas.width, g.canvas.height); snapshot.getContext('2d').drawImage(g.canvas, 0, 0);
  const nRad = 15, rays = [];
  for (let i = 0; i < nRad; i++) {
    const a = i / nRad * TAU + (cr() - 0.5) * 0.3;
    const pts = [[ix, iy]]; let x = ix, y = iy, ang = a;
    const L = 260 + cr() * 520;
    for (let d = 0; d < L; d += 10 + cr() * 22) { ang += (cr() - 0.5) * 0.28; x += Math.cos(ang) * (10 + cr() * 16); y += Math.sin(ang) * (10 + cr() * 16); pts.push([x, y]); if (x < -20 || x > W + 20 || y < -20 || y > H + 20) break; }
    rays.push({ a, pts });
  }
  // displaced shards: re-draw wedges between neighbouring rays slightly shifted
  rays.sort((p, q) => p.a - q.a);
  for (let i = 0; i < rays.length; i++) {
    if (cr() < 0.45) continue;
    const A = rays[i].pts, B = rays[(i + 1) % rays.length].pts;
    const rmax = 40 + cr() * 110;
    const clipA = A.filter(p => Math.hypot(p[0] - ix, p[1] - iy) < rmax), clipB = B.filter(p => Math.hypot(p[0] - ix, p[1] - iy) < rmax);
    if (clipA.length < 2 || clipB.length < 2) continue;
    const poly = clipA.concat(clipB.slice().reverse());
    const dx = (cr() - 0.5) * 4, dy = (cr() - 0.5) * 4;
    g.save(); g.clip(M.pathOf(poly)); g.setTransform(1, 0, 0, 1, 0, 0);
    g.filter = `brightness(${0.82 + cr() * 0.3})`; g.drawImage(snapshot, dx * s, dy * s); g.restore();
  }
  // crushed centre
  g.save();
  const cg = g.createRadialGradient(ix, iy, 0, ix, iy, 34);
  cg.addColorStop(0, 'rgba(15,14,8,0.85)'); cg.addColorStop(0.6, 'rgba(15,14,8,0.35)'); cg.addColorStop(1, 'rgba(15,14,8,0)');
  g.fillStyle = cg; g.beginPath(); g.arc(ix, iy, 34, 0, TAU); g.fill();
  for (let i = 0; i < 90; i++) {
    const a = cr() * TAU, d = Math.pow(cr(), 1.6) * 30, sz = 0.6 + cr() * 2.6;
    g.fillStyle = cr() < 0.5 ? `rgba(235,232,210,${0.4 + cr() * 0.5})` : `rgba(10,10,6,${0.5 + cr() * 0.4})`;
    g.beginPath(); g.moveTo(ix + Math.cos(a) * d, iy + Math.sin(a) * d);
    g.lineTo(ix + Math.cos(a) * d + sz, iy + Math.sin(a) * d + sz * 0.3); g.lineTo(ix + Math.cos(a) * d + sz * 0.2, iy + Math.sin(a) * d + sz); g.closePath(); g.fill();
  }
  g.restore();
  const crackLine = (pts, w) => {
    const draw = (col, lw, dx, dy) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); pts.forEach((p, k) => k ? g.lineTo(p[0] + dx, p[1] + dy) : g.moveTo(p[0] + dx, p[1] + dy)); g.stroke(); };
    g.save(); g.lineJoin = 'miter'; g.lineCap = 'round';
    draw('rgba(255,252,235,0.55)', w * 0.6, -0.9, -0.9);
    draw('rgba(8,8,4,0.92)', w, 0, 0);
    draw('rgba(0,0,0,0.25)', w * 2.6, 0.8, 1.2);
    g.restore();
  };
  for (const ray of rays) {
    // taper: thick near the impact
    const pts = ray.pts;
    for (let k = 0; k < pts.length - 1; k++) {
      const d = Math.hypot(pts[k][0] - ix, pts[k][1] - iy);
      crackLine([pts[k], pts[k + 1]], clamp(3.2 - d / 140, 0.9, 3.2));
    }
    // branches
    for (let k = 2; k < pts.length - 1; k += 2) {
      if (cr() > 0.5) continue;
      let [x, y] = pts[k], ang = ray.a + (cr() < 0.5 ? -1 : 1) * (0.4 + cr() * 0.6);
      const br = [[x, y]];
      for (let j = 0; j < 3 + cr() * 5; j++) { ang += (cr() - 0.5) * 0.4; x += Math.cos(ang) * (8 + cr() * 14); y += Math.sin(ang) * (8 + cr() * 14); br.push([x, y]); }
      crackLine(br, 0.9);
    }
  }
  // concentric spider-web rings near the impact
  for (const rr of [22, 48, 84, 130]) {
    for (let i = 0; i < rays.length; i++) {
      if (cr() < (rr > 100 ? 0.55 : 0.2)) continue;
      const a0 = rays[i].a, a1 = rays[(i + 1) % rays.length].a + (i === rays.length - 1 ? TAU : 0);
      const seg = [], n = 4;
      for (let k = 0; k <= n; k++) { const a = lerp(a0, a1, k / n), q = rr * (0.85 + cr() * 0.3); seg.push([ix + Math.cos(a) * q, iy + Math.sin(a) * q]); }
      crackLine(seg, rr > 100 ? 0.8 : 1.3);
    }
  }
  // glass glare streak
  g.save(); g.globalCompositeOperation = 'screen';
  const gl = g.createLinearGradient(W * 0.1, 0, W * 0.6, H);
  gl.addColorStop(0.42, 'rgba(255,255,240,0)'); gl.addColorStop(0.5, 'rgba(255,255,240,0.08)'); gl.addColorStop(0.58, 'rgba(255,255,240,0)');
  g.fillStyle = gl; g.fillRect(0, 0, W, H); g.restore();
  M.grain(g, W, H, 0.04, 'cracked');
};

/* ---------------------------------------------------------- BUMPER */
MISC.bumper_bg = function (g, W, H) {
  M.sunburst(g, W, H, W / 2, H / 2, { rays: 24, rot: 0.04, colA: '#FFD84A', colB: '#FFAE22', glow: 'rgba(255,255,235,0.8)', glow2: 'rgba(255,250,200,0.25)', edge: 'rgba(160,50,0,0.32)' });
  M.grain(g, W, H, 0.018, 'bumper');
  // felt-flower border: leaves first, then flowers, all outside the panel
  const r = rng('bumper:border');
  const spots = [];
  const addRow = (x0, x1, y, n, jy) => { for (let i = 0; i < n; i++) spots.push([lerp(x0, x1, n === 1 ? 0.5 : i / (n - 1)) + (r() - 0.5) * 14, y + (r() - 0.5) * jy]); };
  addRow(18, 622, 26, 9, 14);      // top
  addRow(18, 622, 458, 9, 14);     // bottom
  for (const y of [112, 196, 282, 368]) { spots.push([22 + (r() - 0.5) * 10, y + (r() - 0.5) * 16]); spots.push([618 + (r() - 0.5) * 10, y + (r() - 0.5) * 16]); }
  // leaves peeking out between flowers
  for (const [x, y] of spots) {
    for (let k = 0; k < 2; k++) {
      const th = r() * TAU;
      M.feltLeaf(g, x, y, th, 40 + r() * 14, 12 + r() * 3, { seed: 'bl' + x + ':' + y + k, color: r() < 0.5 ? '#3E8E3A' : '#4FA43F' });
    }
  }
  spots.forEach(([x, y], i) => {
    const R = 27 + r() * 7;
    if ((i + Math.floor(i / 9) + (i >= 18 ? Math.floor((i - 18) / 2) : 0)) % 2) M.feltPoppy(g, x, y, R, { seed: 'bp' + i, petals: 5 });
    else MISCLIB_daisy(g, x, y, R * 0.98, 'bd' + i);
  });
  // centre panel: rounded white felt card with an orange piped edge
  const px = 90, py = 150, pw = 460, ph = 180;
  const pts = M.roundRectPts(px, py, pw, ph, 30, 14);
  g.save();
  M.shadow(g, 'rgba(120,40,0,0.45)', 10, 3, 6);
  g.fillStyle = '#E8601A'; g.fill(M.pathOf(M.offset(pts, 7)));
  M.noShadow(g); g.restore();
  M.felt(g, M.offset(pts, 7), '#F07A20', { seed: 'panel:rim', rim: 0.6, tex: 0.5, shadow: false, fuzz: 0.4 });
  M.felt(g, pts, '#FFFDF6', { seed: 'panel', rim: 0.35, tex: 0.25, light: 0.2, shadow: { blur: 4, dx: 0, dy: 1.5, color: 'rgba(120,50,0,0.4)' }, fuzz: 0.3, stitch: { inset: 7, color: '#F3B04A', dash: 5, gap: 4, w: 1.4 } });
};
function MISCLIB_daisy(g, x, y, R, seed) {
  M.feltDaisy(g, x, y, R, { seed, petals: 11 });
}

LIB.sunDisc = sunDisc; LIB.sunRays = sunRays; LIB.wordmark = wordmark; LIB.bigTitle = bigTitle; LIB.spacedCaps = spacedCaps;
})(typeof window !== 'undefined' ? window : globalThis);
