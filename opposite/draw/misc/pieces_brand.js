/* pieces_brand.js - OPPOSITE DAY misc art: the Two-Way Kids ident background
 * and logo, the title card, the segment bumper, the two inserted CORRECTION
 * cards and the last blue card. Adapted from poppy/draw/misc/pieces_brand.js.
 * Each piece is window.MISC[name](g, W, H): g is already scaled so the piece
 * draws in manifest pixels. Uses window.MH (helpers.js); the title card also
 * borrows the real twin heads from window.OPP (twins.js).
 * The label, its logo and the show are invented; nothing imitates a real
 * station, network, agency or warning format. */
(function (root) {
'use strict';
const M = root.MH;
const { TAU, DEG, rng, shade, rgba, mixc, lerp, clamp } = M;
const MISC = root.MISC = root.MISC || {};
const LIB = root.MISCLIB = root.MISCLIB || {};

/* ------------------------------------------------ show palette (felt) */
const FELTC = { red: '#D9473B', blue: '#2A5FC4', green: '#3C9A46', orange: '#F08A24', yellow: '#F4CF4A', purple: '#7B3FC4' };

/* ======================================================= THE TWO ARROWS
 * Two fat cartoon arrows chasing each other round a circle: the red one runs
 * along the top pointing LEFT, the blue one along the bottom pointing RIGHT;
 * each head stops just short of the other's tail (anticlockwise on screen).
 * arrowPts: outline of one arc arrow (a0 tail -> a1 tip, angles in radians,
 * canvas convention), swallow-tail notch, flared head. */
function arrowPts(cx, cy, R, th, a0, a1, o) {
  o = o || {};
  const dir = Math.sign(a1 - a0), headA = (o.headA || 0.5) * dir, aH = a1 - headA;     // head base angle
  const flare = th * (o.flare || 0.95), notch = (o.notch === undefined ? 0.16 : o.notch) * dir;
  const P = (a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  const out = [], inn = [], N = 40;
  for (let i = 0; i <= N; i++) { const a = lerp(a0, aH, i / N); out.push(P(a, R + th / 2)); inn.push(P(a, R - th / 2)); }
  const pts = [];
  pts.push(P(a0 + notch, R));                 // notch point (tail swallow)
  pts.push(...out);
  pts.push(P(aH, R + th / 2 + flare * 0.55), P(a1, R + th * 0.02), P(aH, R - th / 2 - flare * 0.5));
  pts.push(...inn.reverse());
  return M.splineClosed(pts.length > 90 ? pts : pts, 1);
}
function drawArrow(g, pts, c0, c1, o) {
  o = o || {};
  const p = M.pathOf(pts), bb = M.bbox(pts), k = o.k || 1;
  g.save();
  if (o.shadow !== false) {
    M.shadow(g, o.shadowCol || 'rgba(40,10,70,0.5)', 5 * k, 2 * k, 4 * k);
    g.fillStyle = o.key || '#2A0F4A'; g.fill(p); M.noShadow(g);
  }
  // dark keyline, white sticker rim, then the glossy body
  g.lineJoin = 'round';
  g.strokeStyle = o.key || '#2A0F4A'; g.lineWidth = (o.keyW || 6.5) * k; g.stroke(p);
  if (o.rim !== false) { g.strokeStyle = '#FFFFFF'; g.lineWidth = (o.rimW || 3) * k; g.stroke(p); }
  const gr = g.createLinearGradient(bb.x0, bb.y0, bb.x1, bb.y1);
  gr.addColorStop(0, shade(c0, 0.22)); gr.addColorStop(0.5, c0); gr.addColorStop(1, c1);
  g.fillStyle = gr; g.fill(p);
  g.save(); g.clip(p);
  // airbrushed roundness: dark inner edge on one side
  g.filter = M.blur(g, 3 * k); g.strokeStyle = rgba(shade(c1, -0.4), 0.5); g.lineWidth = 7 * k; g.translate(1.5 * k, 2.5 * k); g.stroke(p);
  g.restore();
  // gloss stripe along the outer edge
  if (o.gloss !== false && o.glossPts) {
    g.save(); g.clip(p); g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 3.2 * k;
    g.beginPath(); o.glossPts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 7 * k; g.filter = M.blur(g, 2 * k); g.stroke(); g.restore();
  }
  g.restore();
}
/* both arrows; R = ring radius, th = arrow body thickness */
function twoArrows(g, cx, cy, R, th, o) {
  o = o || {};
  const k = o.k || th / 28;
  const gap = o.gap === undefined ? 0.13 : o.gap;
  // red: tail at the upper right, running anticlockwise over the top, tip at the left
  const red = arrowPts(cx, cy, R, th, -0.06 - gap / 2, -Math.PI + 0.06 + gap / 2, o);
  const blue = arrowPts(cx, cy, R, th, Math.PI - 0.06 - gap / 2, 0.06 + gap / 2, o);
  const glossArc = (a0, a1) => { const pts = []; for (let i = 0; i <= 30; i++) { const a = lerp(a0, a1, i / 30); pts.push([cx + Math.cos(a) * (R + th * 0.24), cy + Math.sin(a) * (R + th * 0.24)]); } return pts; };
  const mono = o.mono;
  drawArrow(g, red, mono || '#F0403A', mono ? shade(mono, -0.15) : '#A8121C', Object.assign({ k, glossPts: glossArc(-0.5, -2.2) }, o.arrow || {}));
  drawArrow(g, blue, mono || '#3C82F0', mono ? shade(mono, -0.15) : '#173A9E', Object.assign({ k, glossPts: glossArc(2.6, 0.9) }, o.arrow || {}));
  return { red, blue };
}
LIB.twoArrows = twoArrows;

/* small two-arrow badge (cards, correction cards) */
function miniLogo(g, cx, cy, R, o) {
  o = o || {};
  if (o.disc !== false) {
    g.save(); M.shadow(g, 'rgba(0,0,0,0.3)', 2, 0.5, 1);
    g.fillStyle = o.disc || '#FFFDF4'; g.beginPath(); g.arc(cx, cy, R * 0.72, 0, TAU); g.fill(); M.noShadow(g);
    g.restore();
  }
  twoArrows(g, cx, cy, R * 0.86, R * 0.36, Object.assign({ k: R / 60, arrow: { shadow: false, rim: false, keyW: 3, gloss: false } }, o));
}
LIB.miniLogo = miniLogo;

/* --------------------------------------------------------- wordmark */
function spacedCaps(g, text, x, y, size, o) {
  o = o || {};
  g.save();
  g.font = `${o.weight || 800} ${size}px Inter`; g.textBaseline = 'alphabetic';
  const tr = (o.track || 0.3) * size;
  const ws = [...text].map(c => g.measureText(c).width);
  const total = ws.reduce((a, b) => a + b, 0) + tr * (ws.length - 1);
  const cx = x - total / 2;
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
LIB.spacedCaps = spacedCaps;
function wordmark(g, x, y, size, o) {
  o = o || {};
  return M.bubbleText(g, 'TWO-WAY KIDS', {
    x, y, size, font: `900 ${size}px Inter`, fill: '#FFFFFF', fill2: '#ECE4FF', outline: '#8A4ED6', outline2: '#5B2499',
    outlineW: 0.1, inflate: 0.06, keyline: '#24093F', keylineW: 0.035, arch: o.arch === undefined ? size * 0.12 : o.arch, track: 0.0,
    gloss: 0.55, glossDot: false, innerShade: 0.14,
    extrude: { dx: size * 0.02, dy: size * 0.085, color: '#24093F', steps: 8 },
    softShadow: { color: 'rgba(30,0,60,0.5)', blur: size * 0.1, dx: size * 0.02, dy: size * 0.09 },
    jitter: { rot: 2.5, bounce: size * 0.025 }, seed: 'twk:wordmark',
  });
}

/* ================================================================ LOGO */
MISC.twoway_logo = function (g, W, H) {
  const cx = 200, cy = 140, R = 92, th = 30;
  // the badge disc inside the ring: pearly white to lilac, a purple pinstripe
  g.save();
  M.shadow(g, 'rgba(40,10,70,0.35)', 6, 0, 3);
  const dg = g.createRadialGradient(cx - 30, cy - 40, 8, cx, cy, R - th / 2 + 2);
  dg.addColorStop(0, '#FFFFFF'); dg.addColorStop(0.65, '#F2ECFF'); dg.addColorStop(1, '#D9CCF6');
  g.fillStyle = dg; g.beginPath(); g.arc(cx, cy, R - th / 2 + 2, 0, TAU); g.fill();
  M.noShadow(g);
  g.strokeStyle = 'rgba(123,63,196,0.55)'; g.lineWidth = 1.6; g.beginPath(); g.arc(cx, cy, R - th / 2 - 4, 0, TAU); g.stroke();
  // airbrush sparkle in the disc
  M.twinkle(g, cx - 44, cy - 46, 7, { glow: 'rgba(255,255,255,0.9)', color: '#FFFFFF' });
  M.twinkle(g, cx + 52, cy + 44, 5, { glow: 'rgba(255,255,255,0.9)', color: '#FFFFFF' });
  g.restore();
  twoArrows(g, cx, cy, R, th, {});
  wordmark(g, cx, cy + 17, 44, { arch: 5 });
  spacedCaps(g, 'HOME VIDEO', cx, 284, 17, { color: '#FFFFFF', track: 0.42, weight: 800, outline: '#5B2499', outlineW: 4.2, shadow: 'rgba(20,0,40,0.6)', sdx: 0.8, sdy: 1.6, shadowBlur: 1.2, shadowStroke: 4.2 });
};

/* ========================================================== IDENT BG */
MISC.ident_bg = function (g, W, H) {
  // early-90s airbrush: sky blue at the top to lemon at the bottom
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#6FAEE8'); sky.addColorStop(0.38, '#A7D2F2'); sky.addColorStop(0.7, '#E6F0D8'); sky.addColorStop(1, '#FFEE9A');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // broad soft airbrushed bands (the airbrush passes)
  g.save(); g.filter = M.blur(g, 30);
  g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.ellipse(W * 0.5, H * 0.28, W * 0.7, 46, -0.05, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,240,160,0.3)'; g.beginPath(); g.ellipse(W * 0.5, H * 0.86, W * 0.75, 60, 0.03, 0, TAU); g.fill();
  g.restore();
  // soft rays from where the logo lands
  const cx = 320, cy = 210;
  g.save(); g.globalCompositeOperation = 'screen';
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU + 0.1, hw = 0.07;
    const gr = g.createRadialGradient(cx, cy, 60, cx, cy, W * 0.7);
    gr.addColorStop(0, 'rgba(255,255,235,0.22)'); gr.addColorStop(1, 'rgba(255,255,235,0)');
    g.fillStyle = gr; g.filter = M.blur(g, 4);
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a - hw) * W, cy + Math.sin(a - hw) * W); g.lineTo(cx + Math.cos(a + hw) * W, cy + Math.sin(a + hw) * W); g.closePath(); g.fill();
  }
  g.restore();
  // the glow behind the logo
  const gl = g.createRadialGradient(cx, cy, 10, cx, cy, 260);
  gl.addColorStop(0, 'rgba(255,255,248,0.95)'); gl.addColorStop(0.3, 'rgba(255,252,236,0.5)'); gl.addColorStop(1, 'rgba(255,252,236,0)');
  g.fillStyle = gl; g.fillRect(0, 0, W, H);
  // faint white stars
  const r = rng('ident:stars');
  for (let i = 0; i < 26; i++) {
    const x = r() * W, y = r() * H * 0.92;
    if (Math.hypot(x - cx, y - cy) < 150) continue;
    M.twinkle(g, x, y, 3 + r() * 7, { rot: (r() - 0.5) * 0.4, glow: `rgba(255,255,255,${0.3 + r() * 0.3})`, color: `rgba(255,255,255,${0.45 + r() * 0.3})` });
  }
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.3})`; g.beginPath(); g.arc(r() * W, r() * H, 0.6 + r() * 1.2, 0, TAU); g.fill(); }
  M.vignette(g, W, H, 0.16);
  M.grain(g, W, H, 0.03, 'identbg');
};

/* ====================================================== FELT GLYPHS
 * Big hand-cut felt letters, each on its own: L = [{ch, x, y (baseline), size,
 * rot (rad), color, flip (upside down)}]. Each letter is cut from coloured
 * felt and glued onto a slightly larger white felt backing; both get fibre
 * texture, a puffy rim and a soft cast shadow. */
function feltGlyphs(g, L, o) {
  o = o || {};
  const s = M.scaleOf(g);
  const put = (q, l, extra, col) => {
    q.save(); q.translate(l.x, l.y - l.size * 0.36); q.rotate((l.rot || 0) + (l.flip ? Math.PI : 0)); if (l.sx) q.scale(l.sx, 1);
    q.font = `900 ${l.size}px Inter`; q.textAlign = 'center'; q.textBaseline = 'alphabetic'; q.lineJoin = 'round';
    q.fillStyle = col; q.strokeStyle = col; q.lineWidth = l.size * (o.inflate === undefined ? 0.07 : o.inflate) + extra;
    q.fillText(l.ch, 0, l.size * 0.36); q.strokeText(l.ch, 0, l.size * 0.36);
    q.restore();
  };
  const texture = (Lr, seed, alpha) => {
    const A = M.layerLike(g); M.drawLayer(A.g, Lr);
    M.texFill(Lr.g, M.feltTex(512, seed), null, 'overlay', alpha, 37, 91);
    Lr.g.save(); Lr.g.setTransform(1, 0, 0, 1, 0, 0); Lr.g.globalCompositeOperation = 'destination-in'; Lr.g.drawImage(A.c, 0, 0); Lr.g.restore();
    // puffy rim: blurred inverse alpha offset down-right
    const I = M.layerLike(g);
    I.g.save(); I.g.setTransform(1, 0, 0, 1, 0, 0); I.g.fillStyle = '#000'; I.g.fillRect(0, 0, I.c.width, I.c.height); I.g.globalCompositeOperation = 'destination-out'; I.g.drawImage(A.c, 0, 0); I.g.restore();
    const sz = L[0] ? L[0].size : 60;
    Lr.g.save(); Lr.g.setTransform(1, 0, 0, 1, 0, 0); Lr.g.globalCompositeOperation = 'source-atop';
    Lr.g.filter = `blur(${sz * 0.035 * s}px)`; Lr.g.globalAlpha = 0.42; Lr.g.drawImage(I.c, -sz * 0.03 * s, -sz * 0.04 * s);
    Lr.g.filter = `blur(${sz * 0.03 * s}px)`; Lr.g.globalAlpha = 0.25; Lr.g.globalCompositeOperation = 'source-atop';
    Lr.g.restore();
  };
  // backing
  if (o.backing !== false) {
    const B = M.layerLike(g);
    for (const l of L) if (l.ch !== ' ') put(B.g, l, l.size * (o.backW || 0.12), o.backCol || '#FFFDF4');
    texture(B, 7, 0.35);
    g.save(); M.shadow(g, o.shadowCol || 'rgba(40,30,60,0.45)', (L[0] ? L[0].size : 60) * 0.07, 2, (L[0] ? L[0].size : 60) * 0.05); M.drawLayer(g, B); g.restore();
  }
  const F = M.layerLike(g);
  for (const l of L) if (l.ch !== ' ') put(F.g, l, 0, l.color);
  texture(F, 3, 0.8);
  g.save(); M.shadow(g, 'rgba(30,10,0,0.4)', 3, 1, 1.6); M.drawLayer(g, F); g.restore();
  // a hint of cut-edge fuzz on the coloured felt
  return L;
}
LIB.feltGlyphs = feltGlyphs;
/* lay out a word as felt glyphs (centred at x, baseline y) */
function layoutWord(g, text, x, y, size, o) {
  o = o || {};
  const r = rng((o.seed || 'w') + ':' + text);
  const sx = o.sx || 1;
  g.save(); g.font = `900 ${size}px Inter`; const ws = [...text].map(c => g.measureText(c).width * sx); g.restore();
  const tr = (o.track === undefined ? 0.04 : o.track) * size;
  const total = ws.reduce((a, b) => a + b, 0) + tr * (ws.length - 1);
  let px = x - total / 2;
  const out = [];
  [...text].forEach((ch, i) => {
    const u = (px + ws[i] / 2 - x) / (total / 2);
    out.push({ ch, x: px + ws[i] / 2 + (r() - 0.5) * size * 0.03, y: y + (r() - 0.5) * size * (o.bounce === undefined ? 0.07 : o.bounce) - (o.arch || 0) * (1 - u * u),
      size: size * (1 + (r() - 0.5) * 0.06), rot: (r() - 0.5) * 2 * (o.rot === undefined ? 5 : o.rot) * DEG + Math.atan(-(o.arch || 0) * 2 * u / (total / 2)) * 0.6,
      color: o.colors ? o.colors[i % o.colors.length] : (o.color || '#D9473B'), flip: o.flips ? o.flips.includes(i) : false, i, sx: sx !== 1 ? sx : undefined });
    px += ws[i] + tr;
  });
  return { L: out, total };
}
LIB.layoutWord = layoutWord;

/* felt background panel with fibre texture */
function feltPanel(g, x, y, w, h, color, seed, o) {
  o = o || {};
  g.save();
  g.fillStyle = color; g.fillRect(x, y, w, h);
  const p = new Path2D(); p.rect(x, y, w, h);
  M.texFill(g, M.feltTex(512, seed), p, 'overlay', o.tex === undefined ? 0.55 : o.tex, (seed * 53) % 400, (seed * 97) % 400);
  if (o.light !== false) {
    const gr = g.createLinearGradient(x, y, x + w * 0.4, y + h);
    gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.08)');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
  }
  g.restore();
}
/* the vertical seam where the two felt halves meet (running stitch both sides) */
function seam(g, x, H, o) {
  o = o || {};
  g.save();
  // the right panel overlaps the left by a hair: a soft shadow line
  g.filter = M.blur(g, 2); g.fillStyle = 'rgba(40,30,20,0.35)'; g.fillRect(x - 1.5, 0, 3, H); g.filter = 'none';
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 1, 0, 1, H);
  g.restore();
  for (const sd of [-1, 1]) M.stitch(g, [[x + sd * 8, -10], [x + sd * 8, H + 10]], { open: true, color: o.thread || '#FFFDF4', dash: 6, gap: 4, w: 1.6 }, 'seam' + sd);
}
LIB.feltPanel = feltPanel; LIB.seam = seam;

/* a felt star (5 points, rounded) */
function feltStar(g, x, y, R, color, seed, rot) {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = (rot || 0) - Math.PI / 2 + i / 10 * TAU, rr = i % 2 ? R * 0.48 : R; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  const sp = M.splineClosed(pts.map((p, i) => i % 2 ? p : [lerp(p[0], x, 0.06), lerp(p[1], y, 0.06)]), 6);
  M.felt(g, M.wobble(sp, 0.02, rng(seed)), color, { seed, rim: 0.7, shadow: { blur: 2.5, dx: 1, dy: 1.8, color: 'rgba(40,20,0,0.4)' }, tex: 0.6, fuzz: 0.5, light: 0.6,
    stitch: { inset: Math.max(2.2, R * 0.16), color: 'rgba(255,255,255,0.7)', dash: 2.6, gap: 2.2, w: 0.9 } });
}
LIB.feltStar = feltStar;

/* ========================================================== TITLE CARD */
MISC.title_card = function (g, W, H) {
  feltPanel(g, 0, 0, W / 2 + 2, H, '#F8E796', 21);
  feltPanel(g, W / 2, 0, W / 2, H, '#AFD6F2', 22);
  // mirrored felt stars: the two halves are reflections, with swapped colours
  const r = rng('title:stars');
  for (const [x, y, R] of [[46, 46, 15], [146, 30, 9], [258, 62, 11], [34, 270, 10], [272, 300, 8], [120, 330, 9]]) {
    const rot = (r() - 0.5) * 0.4;
    feltStar(g, x, y, R, '#5FA4E8', 'tsL' + x, rot);
    feltStar(g, W - x, y, R, '#F6D04A', 'tsR' + x, -rot);
  }
  seam(g, W / 2, H, {});
  // OPPOSITE DAY! - every second letter upside down (O P S T A ! right way up)
  const cols = [FELTC.red, FELTC.blue, FELTC.green, FELTC.orange];
  const w1 = layoutWord(g, 'OPPOSITE', W / 2, 182, 98, { colors: cols, flips: [1, 3, 5, 7], seed: 'tt1', rot: 4, arch: 10, track: 0.05 });
  const w2 = layoutWord(g, 'DAY!', W / 2, 296, 112, { colors: [FELTC.blue, FELTC.green, FELTC.red, FELTC.orange], flips: [0, 2], seed: 'tt2', rot: 5, track: 0.06 });
  feltGlyphs(g, w1.L.concat(w2.L), { backW: 0.13 });
  // the twins peeking up from the bottom corners (the real close-up heads, scaled down)
  const heads = [['bim_close', 72, 432, 10], ['mib_close_smile', W - 72, 432, -10]];
  for (const [nm, hx, hy, deg] of heads) {
    const c = M.mk(640, 480);
    if (root.OPP && root.OPP.CHAR && root.OPP.CHAR[nm]) root.OPP.CHAR[nm](c);
    const sc = 0.46;
    g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip();
    g.translate(hx, hy); g.rotate(deg * DEG);
    M.shadow(g, 'rgba(30,30,60,0.4)', 6, 0, 3);
    g.drawImage(c, -320 * sc, -220 * sc, 640 * sc, 480 * sc);
    g.restore();
  }
  // subtitle and copyright
  M.bubbleText(g, 'A Learn-Along Game Tape', {
    x: W / 2, y: 360, size: 27, font: '900 27px Inter', fill: '#FFFFFF', fill2: '#F4F0FF', outline: '#2A4BB8', outline2: '#1B2F7E', outlineW: 0.12,
    inflate: 0.09, keyline: null, arch: 3, track: 0.01, gloss: 0, innerShade: 0.1, softShadow: { color: 'rgba(10,20,70,0.45)', blur: 3, dx: 0, dy: 2.5 }, seed: 'subtitle',
  });
  spacedCaps(g, '© 1994 TWO-WAY KIDS HOME VIDEO', W / 2, 466, 11.5, { color: '#2A3A6A', track: 0.12, weight: 700, shadow: 'rgba(255,255,255,0.6)', sdx: 0.5, sdy: 0.7, shadowBlur: 0.4 });
  M.vignette(g, W, H, 0.12);
  M.grain(g, W, H, 0.02, 'title');
};

/* ========================================================== BUMPER */
MISC.bumper_bg = function (g, W, H) {
  feltPanel(g, 0, 0, W / 2 + 2, H, '#F7D550', 31);
  feltPanel(g, W / 2, 0, W / 2, H, '#5DA6EA', 32);
  seam(g, W / 2, H, {});
  // little felt stars near the border, mirrored across the seam with swapped colours
  const r = rng('bumper:stars');
  const spots = [[64, 70, 13], [150, 58, 9], [242, 74, 11], [58, 182, 9], [52, 300, 12], [74, 406, 10], [168, 420, 13], [262, 410, 9], [118, 120, 7], [100, 360, 7]];
  spots.forEach(([x, y, R], i) => {
    const rot = (r() - 0.5) * 0.5, cL = i % 3 === 0 ? '#D9473B' : (i % 3 === 1 ? '#2A5FC4' : '#FFFDF4'), cR = i % 3 === 0 ? '#D9473B' : (i % 3 === 1 ? '#F7D550' : '#FFFDF4');
    feltStar(g, x, y, R, cL, 'bsL' + i, rot);
    feltStar(g, W - x, y, R, cR, 'bsR' + i, -rot);
  });
  // scalloped white felt border
  const inner = M.scallopPts(30, 28, W - 60, H - 56, 7, 44);
  const frame = new Path2D(); frame.rect(-5, -5, W + 10, H + 10); frame.addPath(M.pathOf(inner));
  g.save();
  // the frame's shadow on the panel
  g.save(); g.clip(M.pathOf(inner)); g.filter = M.blur(g, 5); g.strokeStyle = 'rgba(40,30,10,0.45)'; g.lineWidth = 12; g.translate(2, 3); g.stroke(M.pathOf(inner)); g.restore();
  g.fillStyle = '#FFFBF0'; g.fill(frame, 'evenodd');
  g.clip(frame, 'evenodd');
  M.texFill(g, M.feltTex(512, 33), null, 'overlay', 0.45, 11, 7);
  g.filter = M.blur(g, 3); g.strokeStyle = 'rgba(120,100,70,0.35)'; g.lineWidth = 6; g.stroke(M.pathOf(inner)); g.filter = 'none';
  g.restore();
  // edge fuzz on the scallops + a running stitch in pink thread
  M.stitch(g, M.offset(inner, 9), { open: false, inset: 0, color: '#F07C9A', dash: 5, gap: 3.6, w: 1.5 }, 'bumper:stitch');
  M.vignette(g, W, H, 0.1);
  M.grain(g, W, H, 0.018, 'bumper');
};

/* =============================================== CORRECTION CARDS
 * A plain inserted video card of a 1994 dub: flat royal blue, white chunky
 * monospaced capitals with a hard character-generator drop edge, a thin white
 * rule above and below, the little two-arrow logo bottom-centre. */
function correctionCard(g, W, H, lines) {
  g.fillStyle = '#1F3BA6'; g.fillRect(0, 0, W, H);
  // a whisper of unevenness (the CG's blue is not quite flat on a dub)
  const gr = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.7);
  gr.addColorStop(0, 'rgba(255,255,255,0.04)'); gr.addColorStop(1, 'rgba(0,0,30,0.12)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const size = 30, lh = 46, y0 = H / 2 - (lines.length - 1) * lh / 2 + 10;
  g.save(); g.font = `700 ${size}px "DejaVu Sans Mono"`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const wMax = Math.max(...lines.map(t => g.measureText(t).width));
  const ruleW = Math.max(360, wMax + 50), ry0 = y0 - size - 22, ry1 = y0 + (lines.length - 1) * lh + 22;
  const cg = (fn) => { g.fillStyle = '#05082A'; g.save(); g.translate(2, 2); fn(); g.restore(); g.fillStyle = '#FFFFFF'; fn(); };
  cg(() => { g.fillRect(W / 2 - ruleW / 2, ry0, ruleW, 2.5); g.fillRect(W / 2 - ruleW / 2, ry1, ruleW, 2.5); });
  lines.forEach((t, i) => cg(() => g.fillText(t, W / 2, y0 + i * lh)));
  g.restore();
  // logo bottom-centre, in white
  miniLogo(g, W / 2, H - 62, 26, { disc: false, mono: '#FFFFFF', arrow: { shadow: false, rim: false, keyW: 2.5, key: '#05082A', gloss: false } });
  M.grain(g, W, H, 0.012, 'corr');
}
MISC.card_correction_1 = (g, W, H) => correctionCard(g, W, H, ['CORRECTION:', 'TODAY IS NOT OPPOSITE DAY.']);
MISC.card_correction_2 = (g, W, H) => correctionCard(g, W, H, ['THE PREVIOUS CORRECTION', 'WAS ALSO OPPOSITE.']);

/* ============================================================ END CARD
 * Flat VCR blue (0.08, 0.08, 0.75), white text centred in the title card's
 * chunky rounded letterforms (Inter Black inflated with round joins), flat. */
MISC.end_card_blue = function (g, W, H) {
  g.fillStyle = 'rgb(20,20,191)'; g.fillRect(0, 0, W, H);
  const lines = ['TODAY IS NOT', 'OPPOSITE DAY'], size = 58, tr = size * 0.07, sp = size * 0.18;
  g.save(); g.font = `900 ${size}px Inter`; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  g.fillStyle = '#FFFFFF'; g.strokeStyle = '#FFFFFF'; g.lineWidth = size * 0.075;
  lines.forEach((t, i) => {
    const ws = [...t].map(c => c === ' ' ? sp : g.measureText(c).width), total = ws.reduce((a, b) => a + b, 0) + tr * (t.length - 1);
    let x = W / 2 - total / 2; const y = 222 + i * 84;
    [...t].forEach((c, k) => { if (c !== ' ') { g.fillText(c, x, y); g.strokeText(c, x, y); } x += ws[k] + tr; });
  });
  g.restore();
};

LIB.wordmark = wordmark; LIB.FELTC = FELTC;
})(typeof window !== 'undefined' ? window : globalThis);
