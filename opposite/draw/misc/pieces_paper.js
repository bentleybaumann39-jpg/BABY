/* pieces_paper.js - OPPOSITE DAY misc art: the stage manager's camcorder
 * documents (memo_setb, memo_cutlist), the dark CRT glass overlay and
 * Mr. Turnabout's little gouache portrait as it hangs, upside down.
 * Each piece is window.MISC[name](g, W, H) in manifest pixels; uses window.MH,
 * and window.OPP.FACES.turnabout (faces.js) for the painted portrait. */
(function (root) {
'use strict';
const M = root.MH;
const { TAU, DEG, rng, shade, rgba, mixc, lerp, clamp } = M;
const MISC = root.MISC = root.MISC || {};

/* ------------------------------------------------------------ helpers */
/* typed lines, one strike per character: uneven ink, platen drift, a soft
 * ribbon bleed. lines: [{t, x, y, center}]; returns nothing (draws on g). */
function typewrite(g, W, H, lines, o) {
  o = o || {};
  const r = rng(o.seed || 'type'), size = o.size || 16.5, adv = size * 0.6;
  const INK = M.layerLike(g), q = INK.g;
  q.font = `400 ${size}px "Courier 10 Pitch"`; q.textBaseline = 'alphabetic';
  for (const ln of lines) {
    const lx = ln.center ? Math.round(ln.x - ln.t.length * adv / 2) : ln.x;
    const drop = (r() - 0.5) * 0.8;
    [...ln.t].forEach((ch, i) => {
      if (ch === ' ') return;
      const x = lx + i * adv + (r() - 0.5) * 0.7, yy = ln.y + drop + (r() - 0.5) * 0.9 + i * 0.01;
      q.save(); q.translate(x + adv / 2, yy); q.rotate((r() - 0.5) * 1.6 * DEG); q.textAlign = 'center';
      q.globalAlpha = 0.72 + r() * 0.28; q.fillStyle = o.ink || '#1b1a20'; q.strokeStyle = o.ink || '#1b1a20'; q.lineWidth = 0.6;
      q.fillText(ch, 0, 0); q.strokeText(ch, 0, 0);
      if (r() < 0.35) { q.globalAlpha = 0.35; q.fillText(ch, (r() < 0.5 ? -0.5 : 0.5), (r() - 0.5) * 0.5); }
      q.restore();
    });
  }
  q.save(); q.setTransform(1, 0, 0, 1, 0, 0); q.globalCompositeOperation = 'destination-out'; q.globalAlpha = 0.5;
  q.fillStyle = q.createPattern(M.toothTex(512, 3, 0.55), 'repeat'); q.fillRect(0, 0, INK.c.width, INK.c.height); q.restore();
  M.drawLayer(g, INK, 0.25, 'multiply', M.blur(g, 1.2));
  M.drawLayer(g, INK, 0.95, 'source-over', M.blur(g, 0.35));
  return { adv };
}
/* hand writing with the single-stroke 'tech' font on its own layer (pen or pencil) */
function handwrite(g, items, o) {
  o = o || {};
  const PEN = M.layerLike(g);
  for (const it of items) {
    PEN.g.save(); PEN.g.translate(it.x, it.y); PEN.g.rotate((it.rot || 0) * DEG);
    const res = M.strokeText(PEN.g, 'tech', it.t, 0, 0, it.size, { color: o.color, weight: o.weight || 0.08, jitter: o.jitter || 0.006, rot: 3, bounce: 0.03, scaleJit: 0.05, seed: it.seed || it.t, track: 0.03 });
    it.width = res.width;
    if (it.after) it.after(PEN.g, res);
    PEN.g.restore();
  }
  // skips / graphite grain
  PEN.g.save(); PEN.g.setTransform(1, 0, 0, 1, 0, 0); PEN.g.globalCompositeOperation = 'destination-out'; PEN.g.globalAlpha = o.skip || 0.4;
  PEN.g.fillStyle = PEN.g.createPattern(M.toothTex(512, o.toothSeed || 8, o.tooth || 0.62), 'repeat'); PEN.g.fillRect(0, 0, PEN.c.width, PEN.c.height); PEN.g.restore();
  M.drawLayer(g, PEN, o.alpha || 0.95, o.op || 'multiply', M.blur(g, o.soft || 0.3));
  return items;
}
function coffeeRing(g, cx, cy, cr) {
  g.save(); g.globalCompositeOperation = 'multiply';
  const fill = g.createRadialGradient(cx, cy, cr * 0.2, cx, cy, cr);
  fill.addColorStop(0, 'rgba(200,160,100,0.10)'); fill.addColorStop(0.9, 'rgba(180,130,70,0.18)'); fill.addColorStop(1, 'rgba(150,100,50,0)');
  g.fillStyle = fill; g.beginPath(); g.arc(cx, cy, cr, 0, TAU); g.fill();
  for (let k = 0; k < 3; k++) {
    g.strokeStyle = `rgba(${130 + k * 10},${85 + k * 8},${40 + k * 5},${0.5 - k * 0.12})`; g.lineWidth = 2.6 - k * 0.6;
    g.filter = M.blur(g, 0.6 + k * 0.5); g.beginPath();
    const a0 = 0.4 + k * 0.7, a1 = a0 + TAU * (0.72 - k * 0.12);
    for (let a = a0; a <= a1; a += 0.03) { const rr = cr * (0.98 + k * 0.04) + Math.sin(a * 5 + k) * 1.2; const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr; if (a === a0) g.moveTo(px, py); else g.lineTo(px, py); }
    g.stroke();
  }
  g.restore();
}
/* a strip of brown packing tape (semi-transparent, glossy, ragged ends) */
function tape(g, x, y, w, h, rot, seed) {
  const r = rng(seed);
  g.save(); g.translate(x, y); g.rotate(rot * DEG);
  const tp = new Path2D(); tp.moveTo(-w / 2, -h / 2);
  for (let xx = -w / 2; xx <= w / 2; xx += 6) tp.lineTo(xx, -h / 2 + (r() - 0.5) * 0.8);
  for (let yy = -h / 2; yy <= h / 2; yy += 2.5) tp.lineTo(w / 2 + (r() - 0.5) * 3.2, yy);
  for (let xx = w / 2; xx >= -w / 2; xx -= 6) tp.lineTo(xx, h / 2 + (r() - 0.5) * 0.8);
  for (let yy = h / 2; yy >= -h / 2; yy -= 2.5) tp.lineTo(-w / 2 + (r() - 0.5) * 3.2, yy);
  tp.closePath();
  M.shadow(g, 'rgba(0,0,0,0.35)', 2, 0.5, 1.2);
  g.fillStyle = 'rgba(156,104,48,0.72)'; g.fill(tp); M.noShadow(g);
  g.clip(tp);
  const gl = g.createLinearGradient(0, -h / 2, 0, h / 2); gl.addColorStop(0, 'rgba(255,230,190,0.32)'); gl.addColorStop(0.35, 'rgba(255,230,190,0.05)'); gl.addColorStop(1, 'rgba(60,30,0,0.15)');
  g.fillStyle = gl; g.fillRect(-w, -h, w * 2, h * 2);
  for (let i = 0; i < 10; i++) { g.strokeStyle = `rgba(255,240,210,${0.06 + r() * 0.08})`; g.lineWidth = 0.6; const yy = (r() - 0.5) * h; g.beginPath(); g.moveTo(-w / 2, yy); g.lineTo(w / 2, yy + (r() - 0.5) * 2); g.stroke(); }
  g.restore();
}
/* the camcorder's own lamp: a warm hot spot falling off to the corners */
function camLamp(g, W, H, cx, cy, k, o) {
  o = o || {};
  g.save(); g.globalCompositeOperation = 'multiply';
  const lg = g.createRadialGradient(cx, cy, 20, cx, cy, Math.hypot(W, H) * (o.reach || 0.62));
  lg.addColorStop(0, 'rgb(255,250,240)'); lg.addColorStop(0.45, `rgb(${Math.round(235 - 60 * k)},${Math.round(225 - 70 * k)},${Math.round(205 - 80 * k)})`);
  lg.addColorStop(1, `rgb(${Math.round(120 - 90 * k)},${Math.round(105 - 85 * k)},${Math.round(90 - 75 * k)})`);
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  g.restore();
  g.save(); g.globalCompositeOperation = 'screen';
  const hs = g.createRadialGradient(cx, cy, 0, cx, cy, 180); hs.addColorStop(0, `rgba(255,248,230,${0.18 * (o.hot === undefined ? 1 : o.hot)})`); hs.addColorStop(1, 'rgba(255,248,230,0)');
  g.fillStyle = hs; g.fillRect(0, 0, W, H);
  g.restore();
}
/* yellowing paper rectangle (rotated), returns the clip path in user space */
function paperSheet(g, x, y, w, h, rot, seed, o) {
  o = o || {};
  g.save();
  g.translate(x + w / 2, y + h / 2); g.rotate(rot * DEG); g.translate(-w / 2, -h / 2);
  const pp = new Path2D(); pp.rect(0, 0, w, h);
  M.shadow(g, 'rgba(0,0,0,0.55)', 6, 1, 3);
  g.fillStyle = o.col || '#EDE1C2'; g.fill(pp); M.noShadow(g);
  g.clip(pp);
  const yl = g.createRadialGradient(w * 0.45, h * 0.4, 40, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
  yl.addColorStop(0, 'rgba(255,252,238,0.5)'); yl.addColorStop(0.7, 'rgba(240,225,180,0)'); yl.addColorStop(1, 'rgba(200,168,100,0.4)');
  g.fillStyle = yl; g.fillRect(0, 0, w, h);
  M.texFill(g, M.paperTex(512, seed), pp, 'overlay', 0.9);
  M.texFill(g, M.paperTex(256, seed + 3), pp, 'multiply', 0.12);
  return { pp };   // caller restores
}

/* ============================================================== MEMO (7f) */
MISC.memo_setb = function (g, W, H) {
  const r = rng('memo_setb');
  // the set flat it is taped to: scenic-painted canvas over a frame, the Turnaround Room's lemon base coat, scuffed
  g.fillStyle = '#C9BC7E'; g.fillRect(0, 0, W, H);
  M.texFill(g, M.paperTex(512, 21), null, 'overlay', 0.8);
  g.save(); g.globalAlpha = 0.5;
  for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(${r() < 0.5 ? '255,250,220' : '120,104,60'},${0.1 + r() * 0.15})`; g.lineWidth = 4 + r() * 10; g.lineCap = 'round'; const x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 80, y + (r() - 0.5) * 20); g.stroke(); }
  g.restore();
  // the paper, slightly askew
  g.save();
  paperSheet(g, 38, 18, 566, 520, -0.7, 2);
  // old fold line
  g.strokeStyle = 'rgba(120,100,60,0.18)'; g.lineWidth = 2; g.filter = M.blur(g, 1.2); g.beginPath(); g.moveTo(-20, 236); g.lineTo(620, 233); g.stroke(); g.filter = 'none';
  g.strokeStyle = 'rgba(255,255,245,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-20, 234); g.lineTo(620, 231); g.stroke();
  // typed text in paper coordinates (the paper origin is at its top-left; 90 px screen margins -> x0 = 52)
  const lines = [
    { t: 'TWO-WAY KIDS - OPPOSITE DAY! - STAGE MANAGEMENT', x: 283, y: 46, center: true },
    { t: 'MARCH 17, 1994', x: 52, y: 70 },
    { t: '1. Turnaround Room is struck nightly to the', x: 52, y: 108 },
    { t: '   A side only.', x: 52, y: 129 },
    { t: '2. SET B IS NOT TO BE LIT.', x: 52, y: 155 },
    { t: '3. Performers are not to work the left-hand', x: 52, y: 181 },
    { t: '   puppet.', x: 52, y: 202 },
    { t: '4. If the left-hand puppet is in a different', x: 52, y: 228 },
    { t: '   place in the morning, leave it there and', x: 52, y: 249 },
    { t: '   tell nobody.', x: 52, y: 270 },
  ];
  typewrite(g, W, H, lines, { seed: 'memo_setb:type', size: 16.6 });
  // a typed underline under the header
  g.fillStyle = 'rgba(27,26,32,0.8)'; for (let i = 0; i < 47; i++) { g.fillRect(52 + i * 9.96 + (r() - 0.5) * 0.5 - 1, 51 + (r() - 0.5) * 0.6, 9.4, 1.2); }
  // blue ballpoint, below the list
  handwrite(g, [
    { t: 'Nobody has worked it since', x: 60, y: 318, size: 21, rot: -1.8, seed: 'hw1' },
    { t: 'the pilot.  - D.', x: 74, y: 346, size: 21, rot: -1.3, seed: 'hw2' },
  ], { color: '#1E3487', weight: 0.075, jitter: 0.009 });
  coffeeRing(g, 548, 132, 38);
  g.restore();
  // brown packing tape across the top corners
  tape(g, 70, 30, 120, 30, -32, 'tpA');
  tape(g, 574, 24, 120, 30, 28, 'tpB');
  tape(g, 330, 16, 90, 26, 1.5, 'tpC');
  camLamp(g, W, H, W * 0.5, H * 0.46, 0.55, { reach: 0.66 });
  M.grain(g, W, H, 0.035, 'memo_setb');
};

/* ========================================================= STRIKE LIST (10d) */
MISC.memo_cutlist = function (g, W, H) {
  const r = rng('cutlist');
  // the back of a flat: unpainted luan with wood grain, a 1x3 frame, a stencil, a nail
  g.fillStyle = '#A9875C'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 140; i++) {
    const x = r() * W; g.strokeStyle = `rgba(${r() < 0.5 ? '90,60,30' : '220,190,140'},${0.08 + r() * 0.12})`; g.lineWidth = 0.6 + r() * 2;
    g.beginPath(); g.moveTo(x, -10); g.bezierCurveTo(x + (r() - 0.5) * 30, H * 0.3, x + (r() - 0.5) * 30, H * 0.7, x + (r() - 0.5) * 20, H + 10); g.stroke();
  }
  M.texFill(g, M.paperTex(512, 31), null, 'overlay', 0.6);
  // battens: a vertical stile on the left, a toggle rail low across
  const batten = (x, y, w, h) => {
    g.save(); M.shadow(g, 'rgba(0,0,0,0.6)', 8, 3, 4); g.fillStyle = '#C7A270'; g.fillRect(x, y, w, h); M.noShadow(g);
    const gr = g.createLinearGradient(x, y, x + (w > h ? 0 : w), y + (w > h ? h : 0)); gr.addColorStop(0, 'rgba(255,240,200,0.3)'); gr.addColorStop(1, 'rgba(60,30,0,0.35)');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    for (let i = 0; i < 12; i++) { g.strokeStyle = `rgba(110,70,30,${0.15 + r() * 0.2})`; g.lineWidth = 0.8; g.beginPath(); if (w > h) { const yy = y + r() * h; g.moveTo(x, yy); g.lineTo(x + w, yy + (r() - 0.5) * 3); } else { const xx = x + r() * w; g.moveTo(xx, y); g.lineTo(xx + (r() - 0.5) * 3, y + h); } g.stroke(); }
    g.restore();
  };
  batten(26, -10, 62, H + 20);
  batten(-10, 404, W + 20, 58);
  // a corner block (plywood keystone) with nails
  g.save(); g.fillStyle = 'rgba(200,170,120,0.9)'; g.beginPath(); g.moveTo(88, 404); g.lineTo(150, 404); g.lineTo(88, 352); g.closePath(); g.fill(); g.restore();
  for (const [x, y] of [[96, 396], [112, 396], [96, 380], [52, 120], [52, 260], [200, 432], [420, 432]]) { g.fillStyle = '#3A3634'; g.beginPath(); g.arc(x, y, 2.2, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(x - 0.6, y - 0.6, 0.8, 0, TAU); g.fill(); }
  // spray stencil on the luan
  g.save(); g.font = '700 54px "DejaVu Sans Mono"'; g.fillStyle = 'rgba(25,22,20,0.7)'; g.filter = M.blur(g, 0.8); g.fillText('B-4', 512, 120);
  g.font = '700 22px "DejaVu Sans Mono"'; g.fillText('SET B  SR', 500, 150); g.restore();
  // the nail the clipboard hangs from
  const nx = 320, ny = 30;
  // the clipboard (masonite) hanging slightly crooked
  g.save();
  g.translate(nx, ny); g.rotate(1.6 * DEG); g.translate(-nx, -ny);
  const cb = M.roundRectPts(130, 22, 380, 520, 14, 8);
  g.save(); M.shadow(g, 'rgba(0,0,0,0.7)', 12, 6, 8); g.fillStyle = '#6E4E30'; g.fill(M.pathOf(cb)); M.noShadow(g);
  g.clip(M.pathOf(cb)); M.texFill(g, M.paperTex(256, 41), null, 'overlay', 0.7);
  const cgd = g.createLinearGradient(130, 0, 510, 0); cgd.addColorStop(0, 'rgba(255,220,170,0.12)'); cgd.addColorStop(1, 'rgba(0,0,0,0.2)'); g.fillStyle = cgd; g.fillRect(130, 22, 380, 520);
  g.restore();
  // the paper under the clip
  g.save();
  const pr = paperSheet(g, 146, 60, 348, 470, 0.4, 7, { col: '#F1EAD4' });
  // typed list (paper coords: origin = sheet top-left)
  typewrite(g, W, H, [
    { t: 'STRIKE LIST - 3/22/94', x: 30, y: 62 },
    { t: 'GOLD FRAME ...... (1)', x: 30, y: 108 },
    { t: 'TOY CHEST ....... (2)', x: 30, y: 136 },
    { t: 'WALL CLOCK ...... (2)', x: 30, y: 164 },
    { t: 'CHILD CHAIR ..... (1)', x: 30, y: 192 },
  ], { seed: 'cutlist:type', size: 17 });
  g.fillStyle = 'rgba(27,26,32,0.8)'; for (let i = 0; i < 21; i++) g.fillRect(30 + i * 10.2 + (r() - 0.5) * 0.4, 67 + (r() - 0.5) * 0.5, 9.6, 1.2);
  // pencil: the (1) after CHILD CHAIR scratched out, (2) beside it, the note underneath
  const adv = 17 * 0.6, x1 = 30 + 18 * adv;
  handwrite(g, [
    { t: '(2)', x: x1 + 3 * adv + 8, y: 194, size: 21, rot: -4, seed: 'pc2' },
    { t: 'There is only one chair.', x: 22, y: 252, size: 16, rot: -1.2, seed: 'pc3' },
    { t: 'Who is the other one for?', x: 22, y: 282, size: 16, rot: -0.6, seed: 'pc4',
      after: (q, res) => { q.strokeStyle = 'rgba(70,70,74,0.85)'; q.lineWidth = 1.5; q.lineCap = 'round'; q.beginPath(); q.moveTo(0, 8); q.quadraticCurveTo(res.width * 0.5, 11, res.width + 4, 6); q.stroke(); } },
  ], { color: '#4A4A50', weight: 0.075, skip: 0.55, tooth: 0.5, toothSeed: 12, alpha: 0.9 });
  // the scratch-out over (1): pencil scribble
  g.save(); g.strokeStyle = 'rgba(64,64,70,0.85)'; g.lineWidth = 1.4; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); let sx = x1 - 2; g.moveTo(sx, 188);
  for (let i = 0; i < 9; i++) { sx += 3.6; g.lineTo(sx + (r() - 0.5) * 2, i % 2 ? 178 + r() * 2 : 192 - r() * 2); }
  g.stroke(); g.beginPath(); g.moveTo(x1 - 3, 184); g.lineTo(x1 + 3 * adv + 3, 182); g.stroke(); g.restore();
  g.restore();      // paper clip
  // the metal clip (with the hanging hole the nail goes through)
  g.save();
  M.shadow(g, 'rgba(0,0,0,0.6)', 6, 2, 4);
  const clip = new Path2D(); clip.roundRect(250, 34, 140, 52, 10);
  const mg = g.createLinearGradient(0, 34, 0, 86); mg.addColorStop(0, '#E8E8EC'); mg.addColorStop(0.45, '#9A9AA2'); mg.addColorStop(0.55, '#C8C8D0'); mg.addColorStop(1, '#6A6A72');
  g.fillStyle = mg; g.fill(clip); M.noShadow(g);
  g.strokeStyle = 'rgba(40,40,46,0.8)'; g.lineWidth = 1.2; g.stroke(clip);
  g.fillStyle = '#1A1612'; g.beginPath(); g.ellipse(320, 46, 10, 6, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.beginPath(); g.ellipse(320, 46.6, 10, 6, 0, 0.2, Math.PI - 0.2); g.stroke();
  // the lever
  const lv = new Path2D(); lv.roundRect(276, 60, 88, 12, 4);
  g.fillStyle = '#B0B0B8'; g.fill(lv); g.strokeStyle = 'rgba(40,40,46,0.7)'; g.stroke(lv);
  // rivets
  for (const x of [262, 378]) { g.fillStyle = '#5A5A62'; g.beginPath(); g.arc(x, 76, 3.4, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(x - 1, 75, 1.2, 0, TAU); g.fill(); }
  g.restore();
  g.restore();      // clipboard rotation
  // the nail head through the hole
  g.fillStyle = '#4A4440'; g.beginPath(); g.arc(nx, ny + 16, 3.4, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.arc(nx - 1, ny + 15, 1.2, 0, TAU); g.fill();
  // the camcorder lamp: the back of the set is dark
  camLamp(g, W, H, W * 0.5, H * 0.42, 1.0, { reach: 0.55, hot: 1.2 });
  M.vignette(g, W, H, 0.35);
  M.grain(g, W, H, 0.04, 'cutlist');
};

/* ======================================================= CRT GLASS overlay
 * Ported unchanged from poppy/draw/misc/pieces_scare.js (the spec allows the
 * poppy overlay as is): a soft curved specular band from the upper left (6-10%
 * white), dust specks and one fingerprint smudge (3-5%), a faint convex-glass
 * vignette, the rounded tube edge darkening to opaque black in the corners. */
MISC.crt_glass = function (g, W, H) {
  const r = rng('crt');
  const L = M.mk(g.canvas.width, g.canvas.height), lg = L.getContext('2d'); lg.setTransform(g.getTransform());
  lg.fillStyle = '#000'; lg.fillRect(0, 0, W, H);
  lg.globalCompositeOperation = 'destination-out'; lg.filter = M.blur(lg, 10);
  lg.beginPath(); lg.roundRect(12, 10, W - 24, H - 20, 60); lg.fill();
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(L, 0, 0); g.restore();
  g.save(); g.beginPath(); g.rect(0, 0, W, H); g.roundRect(4, 3, W - 8, H - 6, 64); g.fillStyle = '#000'; g.fill('evenodd'); g.restore();
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  g.save(); g.filter = M.blur(g, 16);
  const band = new Path2D(); band.moveTo(30, 40); band.quadraticCurveTo(200, 20, 360, 150); band.quadraticCurveTo(250, 120, 60, 130); band.closePath();
  const bg = g.createLinearGradient(30, 40, 360, 160); bg.addColorStop(0, 'rgba(255,255,255,0.1)'); bg.addColorStop(0.6, 'rgba(255,255,255,0.07)'); bg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = bg; g.fill(band);
  g.filter = M.blur(g, 5); g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 6; g.beginPath(); g.moveTo(40, 60); g.quadraticCurveTo(190, 40, 330, 140); g.stroke();
  g.restore();
  g.save(); g.filter = M.blur(g, 22); g.fillStyle = 'rgba(200,215,255,0.035)'; g.beginPath(); g.ellipse(500, 360, 70, 40, -0.3, 0, TAU); g.fill(); g.restore();
  for (let i = 0; i < 160; i++) {
    const x = 20 + r() * (W - 40), y = 20 + r() * (H - 40), s = 0.4 + r() * 1.3;
    g.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.06})`; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
  }
  g.save(); g.translate(452, 196); g.rotate(-0.4); g.scale(1, 1.35); g.lineWidth = 1.1;
  for (let k = 0; k < 16; k++) {
    g.strokeStyle = `rgba(255,255,255,${0.035 + r() * 0.015})`;
    g.beginPath(); g.ellipse(Math.sin(k) * 1.5, k * 0.6, 4 + k * 1.6, 3 + k * 1.3, 0.1 * Math.sin(k * 0.7), 0.3, TAU - 0.4 + r() * 0.3); g.stroke();
  }
  g.filter = M.blur(g, 6); g.fillStyle = 'rgba(255,255,255,0.03)'; g.beginPath(); g.ellipse(0, 6, 26, 22, 0, 0, TAU); g.fill();
  g.restore();
};

/* ===================================================== MR. TURNABOUT (hung)
 * A small oval gilt-framed gouache portrait of a jolly bald grandfather with
 * white side whiskers and a blue bow tie, hung UPSIDE DOWN from a brass ring
 * at (120, 8). The painting itself is faces.js turnabout({mode:'painted'}):
 * its eyes and mouth are painted the right way up for the viewer of the hung
 * portrait (Thatcher), so turned over here he reads as twinkling and smiling. */
let TB_CACHE = null;
MISC.turnabout_upside = function (g, W, H) {
  const cx = 120, cy = 166, orx = 106, ory = 128, irx = 86, iry = 108;
  if (!TB_CACHE) TB_CACHE = root.OPP.FACES.turnabout({ mode: 'painted', W: 400, H: 500 }).out;
  const P = TB_CACHE;
  // the painting, rotated 180 degrees (hung upside down), inside the oval
  g.save();
  g.beginPath(); g.ellipse(cx, cy, irx + 2, iry + 2, 0, 0, TAU); g.clip();
  g.fillStyle = '#3E3622'; g.fillRect(0, 0, W, H);
  g.translate(cx, cy); g.rotate(Math.PI);
  // crop: the head and the bow tie (painting px 200 +- 124, y 34 .. 344) into the oval
  const sw = 250, sh = 312, sx = 200 - sw / 2, sy = 36;
  const k = (iry * 2 + 4) / sh;
  g.drawImage(P, sx, sy, sw, sh, -sw * k / 2, -sh * k / 2, sw * k, sh * k);
  g.restore();
  // old varnish: a warm yellowing and a faint craquelure
  g.save(); g.beginPath(); g.ellipse(cx, cy, irx + 2, iry + 2, 0, 0, TAU); g.clip();
  g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(240,220,170,0.35)'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  const r = rng('tb:crack'); g.lineWidth = 0.5;
  for (let i = 0; i < 70; i++) { let x = cx + (r() - 0.5) * irx * 2, y = cy + (r() - 0.5) * iry * 2; g.strokeStyle = `rgba(40,28,10,${0.05 + r() * 0.06})`; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (r() - 0.5) * 12; y += (r() - 0.5) * 12; g.lineTo(x, y); } g.stroke(); }
  const vg = g.createRadialGradient(cx, cy, 30, cx, cy, iry * 1.05); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,18,4,0.45)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  // a soft varnish sheen at the upper left
  const sh2 = g.createRadialGradient(cx - 40, cy - 60, 2, cx - 40, cy - 60, 70); sh2.addColorStop(0, 'rgba(255,250,230,0.16)'); sh2.addColorStop(1, 'rgba(255,250,230,0)');
  g.fillStyle = sh2; g.fillRect(0, 0, W, H);
  g.restore();
  // the oval gilt frame: carved, gold leaf over red bole, a bead ring and an inner sight edge
  const frame = new Path2D(); frame.ellipse(cx, cy, orx, ory, 0, 0, TAU); frame.ellipse(cx, cy, irx, iry, 0, 0, TAU);
  g.save(); M.shadow(g, 'rgba(0,0,0,0.55)', 5, 1.5, 3); g.fillStyle = '#8A6420'; g.fill(frame, 'evenodd'); M.noShadow(g); g.restore();
  g.save(); g.clip(frame, 'evenodd');
  // gold: a ridge across the frame's width, lit from the upper left
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, rx = lerp(irx, orx, t), ry = lerp(iry, ory, t);
    const lum = 0.45 + 0.55 * Math.sin(Math.PI * Math.pow(t, 0.8));
    const gd = g.createLinearGradient(cx - orx, cy - ory, cx + orx, cy + ory);
    gd.addColorStop(0, `rgba(${Math.round(255 * lum)},${Math.round(226 * lum)},${Math.round(140 * lum)},1)`);
    gd.addColorStop(0.5, `rgba(${Math.round(200 * lum)},${Math.round(150 * lum)},${Math.round(60 * lum)},1)`);
    gd.addColorStop(1, `rgba(${Math.round(110 * lum)},${Math.round(72 * lum)},${Math.round(22 * lum)},1)`);
    g.strokeStyle = gd; g.lineWidth = (orx - irx) / 10 + 1.2; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.stroke();
  }
  // bead ring
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * TAU, x = cx + Math.cos(a) * (irx + 13), y = cy + Math.sin(a) * (iry + 13);
    const lit = 0.5 + 0.5 * Math.cos(a + 2.3);
    g.fillStyle = `rgb(${Math.round(120 + 135 * lit)},${Math.round(84 + 120 * lit)},${Math.round(30 + 80 * lit)})`; g.beginPath(); g.arc(x, y, 2.1, 0, TAU); g.fill();
    g.fillStyle = `rgba(255,250,220,${0.5 * lit})`; g.beginPath(); g.arc(x - 0.6, y - 0.6, 0.8, 0, TAU); g.fill();
  }
  // worn gilt: red bole showing through on the high spots, grime in the hollows
  const rw = rng('tb:wear');
  for (let i = 0; i < 26; i++) { const a = rw() * TAU, t = 0.3 + rw() * 0.5; const x = cx + Math.cos(a) * lerp(irx, orx, t), y = cy + Math.sin(a) * lerp(iry, ory, t); g.fillStyle = `rgba(140,60,40,${0.25 + rw() * 0.25})`; g.beginPath(); g.ellipse(x, y, 1.5 + rw() * 3, 1 + rw() * 1.5, a, 0, TAU); g.fill(); }
  g.restore();
  g.save(); g.strokeStyle = 'rgba(40,24,6,0.85)'; g.lineWidth = 1.6; g.beginPath(); g.ellipse(cx, cy, irx + 0.5, iry + 0.5, 0, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(60,40,10,0.7)'; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, cy, orx, ory, 0, 0, TAU); g.stroke(); g.restore();
  // the brass hanging ring and its plate (ring top inside edge at (120, 8))
  g.save(); g.lineCap = 'round';
  M.shadow(g, 'rgba(0,0,0,0.5)', 2, 0.6, 1.4);
  const plate = new Path2D(); plate.roundRect(cx - 7, 30, 14, 12, 3); const pg = g.createLinearGradient(cx - 7, 0, cx + 7, 0); pg.addColorStop(0, '#E8C870'); pg.addColorStop(1, '#8A6420'); g.fillStyle = pg; g.fill(plate);
  M.noShadow(g);
  g.strokeStyle = '#6A4A14'; g.lineWidth = 4.2; g.beginPath(); g.arc(cx, 18, 10, 0, TAU); g.stroke();
  const rg = g.createLinearGradient(cx - 10, 8, cx + 10, 28); rg.addColorStop(0, '#FFE9A0'); rg.addColorStop(0.5, '#D4A440'); rg.addColorStop(1, '#7A5418');
  g.strokeStyle = rg; g.lineWidth = 3; g.beginPath(); g.arc(cx, 18, 10, 0, TAU); g.stroke();
  g.fillStyle = '#7A5418'; g.fillRect(cx - 2.5, 27, 5, 5);
  g.restore();
};
})(typeof window !== 'undefined' ? window : globalThis);
