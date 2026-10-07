/* pieces_wrong.js - THE WORLD OF POPPY misc art: the pieces that should not
 * be on a children's tape. The production memo, the child's crayon drawing,
 * and the subliminal frames (eyes in the dark, the teeth).
 * Each piece is window.MISC[name](g, W, H) in manifest pixels; uses window.MH. */
(function (root) {
'use strict';
const M = root.MH;
const { TAU, DEG, rng, shade, rgba, mixc, lerp, clamp } = M;
const MISC = root.MISC = root.MISC || {};

/* felt texture scaled up (extreme close-ups: fibres read bigger) */
function bigFelt(g, path, k, alpha, seed, op) {
  const tex = M.feltTex(512, seed || 9);
  g.save();
  const pat = g.createPattern(tex, 'repeat');
  pat.setTransform(new DOMMatrix().scale(k));
  g.globalCompositeOperation = op || 'overlay'; g.globalAlpha = alpha;
  g.fillStyle = pat;
  if (path) g.fill(path); else g.fillRect(-10, -10, 4000, 4000);
  g.restore();
}

/* ---------------------------------------------------------------- MEMO */
const MEMO = [
  { t: 'SUNNY MEADOW HOME VIDEO - INTERNAL MEMO', center: true },
  { t: 'TO: "The World of Poppy" crew, Studio B', gap: 9 },
  { t: 'FROM: R. Hollis, Production Office' },
  { t: 'DATE: June 12, 1996', over: { 18: '5' } },
  { t: 'RE: After-hours rules' },
  { t: '1. Return all props to the prop room.', gap: 12, over: { 30: 'o' } },
  { t: '2. Craft services closes at 6 PM Fridays.', gap: 4 },
  { t: '3. Do not leave the Poppy costume alone', gap: 4 },
  { t: '   in Studio B or the dressing rooms.' },
  { t: '4. If the costume speaks when no one is', gap: 4 },
  { t: '   inside it, do not answer it.' },
];MISC.memo_card = function (g, W, H) {
  const r = rng('memo');
  // the mirror the memo is taped to (a sliver at the top)
  const mg = g.createLinearGradient(0, 0, W, 20);
  mg.addColorStop(0, '#2a3036'); mg.addColorStop(0.5, '#59626a'); mg.addColorStop(1, '#30363c');
  g.fillStyle = mg; g.fillRect(0, 0, W, H);
  // the paper, slightly askew, overfilling the frame
  g.save();
  g.translate(W / 2, H / 2); g.rotate(-0.55 * DEG); g.translate(-W / 2, -H / 2);
  const paper = new Path2D(); paper.rect(-30, 9, W + 60, H + 40);
  g.save();
  M.shadow(g, 'rgba(0,0,0,0.6)', 5, 0, 2);
  g.fillStyle = '#EDE3C6'; g.fill(paper); M.noShadow(g);
  g.clip(paper);
  // yellowing: warmer toward the edges, a faint water tide-line
  const yl = g.createRadialGradient(W * 0.45, H * 0.45, 60, W * 0.5, H * 0.5, W * 0.75);
  yl.addColorStop(0, 'rgba(255,252,238,0.55)'); yl.addColorStop(0.7, 'rgba(240,225,180,0)'); yl.addColorStop(1, 'rgba(205,175,110,0.35)');
  g.fillStyle = yl; g.fillRect(-40, 0, W + 80, H + 40);
  M.texFill(g, M.paperTex(512, 2), paper, 'overlay', 0.9);
  M.texFill(g, M.paperTex(256, 5), paper, 'multiply', 0.12);
  // old fold line across the middle
  g.strokeStyle = 'rgba(120,100,60,0.18)'; g.lineWidth = 2; g.filter = M.blur(g, 1.2);
  g.beginPath(); g.moveTo(-20, 252); g.lineTo(W + 20, 247); g.stroke(); g.filter = 'none';
  g.strokeStyle = 'rgba(255,255,245,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-20, 250); g.lineTo(W + 20, 245); g.stroke();
  // typed text: per-character strikes with uneven ink
  const size = 19.2, adv = size * 0.6, x0 = 88;   // 90 px margins: every line stays in frame at the 7g push
  const INK = M.layerLike(g);
  const q = INK.g;
  q.font = `400 ${size}px "Liberation Mono"`; q.textBaseline = 'alphabetic';
  let y = 79;
  const rowY = [];
  const lineH = 20.5;
  MEMO.forEach((ln, li) => {
    if (li > 0) y += lineH + (ln.gap || 0);
    rowY.push(y);
    const lx = ln.center ? Math.round((W - ln.t.length * adv) / 2) : x0;
    const lineDrop = (r() - 0.5) * 0.8;    // platen not quite level
    [...ln.t].forEach((ch, i) => {
      if (ch === ' ') return;
      const x = lx + i * adv + (r() - 0.5) * 0.7, yy = y + lineDrop + (r() - 0.5) * 0.9 + i * 0.012;
      const strike = 0.72 + r() * 0.28;
      q.save(); q.translate(x + adv / 2, yy); q.rotate((r() - 0.5) * 1.6 * DEG); q.textAlign = 'center';
      if (ln.over && ln.over[i]) {     // wrong letter first, then the correct one struck over it
        q.globalAlpha = 0.75; q.fillStyle = '#1b1a20'; q.fillText(ln.over[i], 0.6, 0.3);
      }
      q.globalAlpha = strike; q.fillStyle = '#1b1a20'; q.strokeStyle = '#1b1a20'; q.lineWidth = 0.55;
      q.fillText(ch, 0, 0); q.strokeText(ch, 0, 0);
      // uneven key strike: one side heavier
      if (r() < 0.35) { q.globalAlpha = 0.35; q.fillText(ch, (r() < 0.5 ? -0.5 : 0.5), (r() - 0.5) * 0.5); }
      q.restore();
    });
  });
  // ribbon grain: punch the paper tooth out of the ink, then soften it slightly
  q.save(); q.setTransform(1, 0, 0, 1, 0, 0); q.globalCompositeOperation = 'destination-out'; q.globalAlpha = 0.55;
  q.fillStyle = q.createPattern(M.toothTex(512, 3, 0.55), 'repeat'); q.fillRect(0, 0, INK.c.width, INK.c.height); q.restore();
  M.drawLayer(g, INK, 0.25, 'multiply', M.blur(g, 1.2));    // ink bleed halo
  M.drawLayer(g, INK, 0.95, 'source-over', M.blur(g, 0.35));
  // handwritten note in blue ballpoint
  const hy = rowY[rowY.length - 1] + 38;
  const PEN = M.layerLike(g);
  // two short lines inside the 90 px margins, ending above y~380 (clear of the camcorder date/clock band)
  PEN.g.save(); PEN.g.translate(96, hy - 2); PEN.g.rotate(-2.0 * DEG);
  const pen = (txt, dx, dy, sz, sd) => M.strokeText(PEN.g, 'tech', txt, dx, dy, sz, { color: '#1E3487', weight: 0.08, jitter: 0.006, rot: 3, bounce: 0.03, scaleJit: 0.05, seed: sd, track: 0.03 });
  pen('"Dana says it finished', 0, 0, 25, 'hw1');
  const w2a = pen('the song ', 14, 30, 25, 'hw2').width;
  const w2b = pen('without her.', 14 + w2a, 30, 25, 'hw3').width;
  pen('- R."', 14 + w2a + w2b + 14, 30, 25, 'hw4');
  // underline under "without her"
  PEN.g.strokeStyle = 'rgba(30,52,135,0.85)'; PEN.g.lineWidth = 1.7; PEN.g.lineCap = 'round';
  PEN.g.beginPath(); PEN.g.moveTo(14 + w2a, 37); PEN.g.quadraticCurveTo(14 + w2a + w2b / 2, 41, 14 + w2a + w2b, 35); PEN.g.stroke();
  PEN.g.restore();
  // ballpoint skips: thin the line here and there
  PEN.g.save(); PEN.g.setTransform(1, 0, 0, 1, 0, 0); PEN.g.globalCompositeOperation = 'destination-out'; PEN.g.globalAlpha = 0.4;
  PEN.g.fillStyle = PEN.g.createPattern(M.toothTex(512, 8, 0.62), 'repeat'); PEN.g.fillRect(0, 0, PEN.c.width, PEN.c.height); PEN.g.restore();
  M.drawLayer(g, PEN, 0.95, 'multiply', M.blur(g, 0.3));
  // coffee ring (in the right margin, clear of the text)
  const cx = 602, cy = 142, cr = 50;
  g.save();
  g.globalCompositeOperation = 'multiply';
  const fill = g.createRadialGradient(cx, cy, cr * 0.2, cx, cy, cr);
  fill.addColorStop(0, 'rgba(200,160,100,0.10)'); fill.addColorStop(0.9, 'rgba(180,130,70,0.18)'); fill.addColorStop(1, 'rgba(150,100,50,0)');
  g.fillStyle = fill; g.beginPath(); g.arc(cx, cy, cr, 0, TAU); g.fill();
  for (let k = 0; k < 3; k++) {
    g.strokeStyle = `rgba(${130 + k * 10},${85 + k * 8},${40 + k * 5},${0.5 - k * 0.12})`; g.lineWidth = 2.6 - k * 0.6;
    g.filter = M.blur(g, 0.6 + k * 0.5);
    g.beginPath();
    const a0 = 0.4 + k * 0.7, a1 = a0 + TAU * (0.72 - k * 0.12);
    for (let a = a0; a <= a1; a += 0.03) { const rr = cr * (0.98 + k * 0.04) + Math.sin(a * 5 + k) * 1.2; const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr; if (a === a0) g.moveTo(px, py); else g.lineTo(px, py); }
    g.stroke();
  }
  g.filter = 'none';
  // a drip run from the ring
  g.fillStyle = 'rgba(150,100,50,0.18)'; g.beginPath(); g.ellipse(cx - 40, cy + 44, 8, 4, 0.6, 0, TAU); g.fill();
  g.restore();
  g.restore(); // paper clip
  // strip of tape across the top, bridging paper and mirror
  g.save();
  g.translate(W / 2 + 6, 18); g.rotate(1.4 * DEG);
  const tw = 250, th = 34;
  const tp = new Path2D();
  tp.moveTo(-tw / 2, -th / 2);
  for (let x = -tw / 2; x <= tw / 2; x += 6) tp.lineTo(x, -th / 2 + (r() - 0.5) * 1.2);
  for (let yy = -th / 2; yy <= th / 2; yy += 3) tp.lineTo(tw / 2 + (r() - 0.5) * 2.4, yy);
  for (let x = tw / 2; x >= -tw / 2; x -= 6) tp.lineTo(x, th / 2 + (r() - 0.5) * 1.2);
  for (let yy = th / 2; yy >= -th / 2; yy -= 3) tp.lineTo(-tw / 2 + (r() - 0.5) * 2.4, yy);
  tp.closePath();
  M.shadow(g, 'rgba(0,0,0,0.25)', 2, 0, 1);
  g.fillStyle = 'rgba(245,238,205,0.42)'; g.fill(tp); M.noShadow(g);
  g.clip(tp);
  const tg = g.createLinearGradient(0, -th / 2, 0, th / 2);
  tg.addColorStop(0, 'rgba(255,255,255,0.25)'); tg.addColorStop(0.5, 'rgba(255,255,255,0.05)'); tg.addColorStop(1, 'rgba(120,110,80,0.12)');
  g.fillStyle = tg; g.fillRect(-tw, -th, tw * 2, th * 2);
  // wrinkles and trapped dust
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.8;
  for (let i = 0; i < 6; i++) { const x = (r() - 0.5) * tw; g.beginPath(); g.moveTo(x, -th / 2); g.lineTo(x + (r() - 0.5) * 12, th / 2); g.stroke(); }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(60,50,40,${0.2 + r() * 0.3})`; g.fillRect((r() - 0.5) * tw, (r() - 0.5) * th, 0.8, 0.8); }
  g.restore();
  g.restore(); // rotation
  // photographed: camcorder light falloff, slight softness and grain
  const lg = g.createRadialGradient(W * 0.42, H * 0.4, 80, W * 0.5, H * 0.5, W * 0.72);
  lg.addColorStop(0, 'rgba(255,250,230,0.10)'); lg.addColorStop(0.6, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(30,25,10,0.42)');
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  M.grain(g, W, H, 0.035, 'memo');
};

/* ------------------------------------------------------- CRAYON HOUSE */
function crayonText(K, text, x, y, size, color, r, o) {
  o = o || {};
  const t = M.strokeText(K.g, 'tech', text, x, y, size, { noDraw: true, jitter: 0.02, rot: 9, bounce: 0.09, scaleJit: 0.14, track: o.track || 0.08, mirror: o.mirror, seed: o.seed || text });
  for (const s of t.strokes) if (s.length) M.crayonStroke(K.g, s.length === 1 ? [s[0], [s[0][0] + 0.5, s[0][1] + 0.5]] : s, color, o.w || 6.5, r, { passes: 4, alpha: 0.8, jitter: 1.2 });
  return t;
}
MISC.sub_crayon_house = function (g, W, H) {
  const r = rng('crayon');
  // paper
  g.fillStyle = '#F4F0E3'; g.fillRect(0, 0, W, H);
  M.texFill(g, M.paperTex(512, 11), null, 'overlay', 0.9);
  const pv = g.createRadialGradient(W / 2, H / 2, 150, W / 2, H / 2, W * 0.7);
  pv.addColorStop(0, 'rgba(0,0,0,0)'); pv.addColorStop(1, 'rgba(120,100,60,0.22)');
  g.fillStyle = pv; g.fillRect(0, 0, W, H);
  const layer = () => M.crayonLayer(g);
  const fin = (K, d, a) => M.finishCrayon(g, K, { density: d || 0.5, op: 'multiply', alpha: a || 1, wax: 0.25, seed: 2 });
  const pl = (pts, per) => M.splineOpen(pts, per || 4);
  const wob = (pts, j) => pts.map(([x, y]) => [x + (r() - 0.5) * j, y + (r() - 0.5) * j]);
  const line = (K, a, b, col, w, n) => { const pts = []; n = n || 6; for (let i = 0; i <= n; i++) pts.push([lerp(a[0], b[0], i / n) + (r() - 0.5) * 3, lerp(a[1], b[1], i / n) + (r() - 0.5) * 3]); M.crayonStroke(K.g, pts, col, w, r, { passes: 4, alpha: 0.75, jitter: 1.2 }); };

  // sky strokes and grass
  let K = layer();
  for (let i = 0; i < 5; i++) { const y = 14 + i * 9 + r() * 4; line(K, [-10, y], [W + 10, y + (r() - 0.5) * 8], '#4F8FE0', 7, 14); }
  const grass = []; for (let x = -10; x <= W + 10; x += 9) grass.push([x, 446 + (r() - 0.5) * 6]);
  M.crayonFill(K.g, [[-10, 446], ...grass, [W + 10, 446], [W + 10, H + 10], [-10, H + 10]], '#3A9A35', 9, r, { angle: -1.2, step: 5, passes: 2, alpha: 0.55 });
  for (let x = 0; x < W; x += 7 + r() * 6) line(K, [x, 452 + r() * 6], [x + (r() - 0.5) * 6, 430 + r() * 8], '#2E8B2E', 3.5, 2);
  fin(K, 0.52);

  // sun, top-right corner
  K = layer();
  const sx = 572, sy = 82;
  M.crayonFill(K.g, M.ellipsePts(sx, sy, 40, 38, 0, 40), '#F5C400', 9, r, { angle: 0.5, step: 5, passes: 2, alpha: 0.75 });
  M.crayonStroke(K.g, wob(M.ellipsePts(sx, sy, 41, 39, 0, 30).concat([[sx + 41, sy + 2]]), 2), '#EFA800', 6, r, { passes: 4, alpha: 0.8 });
  for (let i = 0; i < 11; i++) { const a = i / 11 * TAU + 0.2; line(K, [sx + Math.cos(a) * 50, sy + Math.sin(a) * 48], [sx + Math.cos(a) * (74 + r() * 12), sy + Math.sin(a) * (72 + r() * 12)], '#F2B800', 6, 3); }
  fin(K, 0.5);

  // house: walls, roof, door, windows
  const hx0 = 166, hx1 = 486, hy0 = 214, hy1 = 444, apex = [326, 104];
  K = layer();
  M.crayonFill(K.g, [[hx0, hy0], [hx1, hy0], [hx1, hy1], [hx0, hy1]], '#E7A35E', 12, r, { angle: -0.35, step: 8, passes: 2, alpha: 0.35 });
  M.crayonFill(K.g, [[hx0 - 22, hy0 + 4], apex, [hx1 + 22, hy0 + 4]], '#D42A20', 11, r, { angle: 0.9, step: 6, passes: 2, alpha: 0.6 });
  fin(K, 0.5);
  K = layer();
  line(K, [hx0, hy0], [hx0 - 2, hy1], '#7A4A20', 7, 8); line(K, [hx1, hy0], [hx1 + 3, hy1], '#7A4A20', 7, 8);
  line(K, [hx0 - 4, hy1], [hx1 + 6, hy1 + 2], '#7A4A20', 7, 10); line(K, [hx0 - 26, hy0 + 6], [hx1 + 24, hy0 + 2], '#9A1A14', 7, 10);
  line(K, [hx0 - 26, hy0 + 6], apex, '#9A1A14', 7, 8); line(K, apex, [hx1 + 24, hy0 + 2], '#9A1A14', 7, 8);
  // chimney
  line(K, [420, 150], [420, 112], '#7A4A20', 6, 3); line(K, [420, 112], [448, 112], '#7A4A20', 6, 3); line(K, [448, 112], [448, 168], '#7A4A20', 6, 3);
  for (let i = 0; i < 3; i++) M.crayonStroke(K.g, wob(M.ellipsePts(446 + i * 16, 90 - i * 22, 9 + i * 3, 7 + i * 2, 0, 16), 2), '#8A8A8A', 4, r, { passes: 3, alpha: 0.5 });
  // door
  line(K, [218, hy1], [218, 352], '#5A3010', 6, 4); line(K, [218, 352], [266, 352], '#5A3010', 6, 3); line(K, [266, 352], [266, hy1], '#5A3010', 6, 4);
  M.crayonFill(K.g, [[220, 354], [264, 354], [264, hy1], [220, hy1]], '#8A5A2A', 8, r, { angle: 1.2, step: 5, passes: 2, alpha: 0.55 });
  K.g.fillStyle = '#3a2008'; K.g.beginPath(); K.g.arc(256, 400, 3.5, 0, TAU); K.g.fill();
  // downstairs window (left) with curtains
  line(K, [192, 246], [252, 246], '#1F4FB0', 6, 3); line(K, [252, 246], [252, 300], '#1F4FB0', 6, 3); line(K, [252, 300], [192, 300], '#1F4FB0', 6, 3); line(K, [192, 300], [192, 246], '#1F4FB0', 6, 3);
  line(K, [222, 246], [222, 300], '#1F4FB0', 4, 3); line(K, [192, 273], [252, 273], '#1F4FB0', 4, 3);
  fin(K, 0.46);

  // the upstairs window, where it is
  const wx0 = 300, wx1 = 446, wy0 = 232, wy1 = 336;
  K = layer();
  M.crayonFill(K.g, [[wx0, wy0], [wx1, wy0], [wx1, wy1], [wx0, wy1]], '#FFE680', 9, r, { angle: -0.2, step: 6, passes: 2, alpha: 0.5 });   // light on inside
  fin(K, 0.5);
  // the tall one: long dark body behind the child, down through the house
  K = layer();
  const fx = 384, fy = 214;        // its face centre (above the child's head)
  M.crayonFill(K.g, [[fx - 22, fy + 40], [fx + 22, fy + 40], [fx + 18, 420], [fx - 18, 420]], '#2F7A2F', 9, r, { angle: 1.3, step: 5, passes: 2, alpha: 0.7 });
  line(K, [fx - 22, fy + 40], [fx - 18, 422], '#1F5A1F', 5, 8); line(K, [fx + 22, fy + 40], [fx + 18, 422], '#1F5A1F', 5, 8);
  // very long arms: out from the shoulders, around the child, down to the floor
  M.crayonStroke(K.g, wob(pl([[fx - 20, fy + 52], [fx - 60, fy + 80], [fx - 86, fy + 150], [fx - 92, 380], [fx - 86, 432]]), 2), '#111111', 6, r, { passes: 5, alpha: 0.85 });
  M.crayonStroke(K.g, wob(pl([[fx + 20, fy + 52], [fx + 56, fy + 84], [fx + 74, fy + 160], [fx + 80, 380], [fx + 86, 432]]), 2), '#111111', 6, r, { passes: 5, alpha: 0.85 });
  // long fingers
  for (const [hx, s] of [[fx - 86, -1], [fx + 86, 1]]) for (let k = 0; k < 4; k++) line(K, [hx, 430], [hx + s * (k * 7 - 6), 456 + k * 1.5], '#111111', 3.5, 3);
  fin(K, 0.48);
  // the child in the window: small stick figure, in front
  K = layer();
  const cx = 344, cy = 286;
  M.crayonStroke(K.g, wob(M.ellipsePts(cx, cy - 22, 10, 11, 0, 18).concat([[cx + 10, cy - 22]]), 1), '#111111', 4, r, { passes: 4, alpha: 0.85 });
  line(K, [cx, cy - 11], [cx, cy + 24], '#111111', 4, 3);
  line(K, [cx, cy], [cx - 14, cy + 10], '#111111', 4, 2); line(K, [cx, cy], [cx + 14, cy + 8], '#111111', 4, 2);
  line(K, [cx, cy + 24], [cx - 9, cy + 44], '#111111', 4, 2); line(K, [cx, cy + 24], [cx + 9, cy + 44], '#111111', 4, 2);
  K.g.fillStyle = '#111'; K.g.beginPath(); K.g.arc(cx - 3.5, cy - 24, 1.6, 0, TAU); K.g.arc(cx + 3.5, cy - 24, 1.6, 0, TAU); K.g.fill();
  line(K, [cx - 4, cy - 16], [cx + 4, cy - 16], '#111111', 2.4, 2);
  // yellow hair scribble
  M.crayonStroke(K.g, wob(pl([[cx - 10, cy - 30], [cx - 4, cy - 37], [cx + 2, cy - 31], [cx + 7, cy - 37], [cx + 11, cy - 29]]), 1), '#E8B800', 4, r, { passes: 3, alpha: 0.85 });
  fin(K, 0.45);
  // its face: a ring of red petals, a round face, black dot eyes, a huge toothy smile
  K = layer();
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * TAU, px = fx + Math.cos(a) * 46, py = fy + Math.sin(a) * 44;
    M.crayonFill(K.g, M.ellipsePts(px, py, 17, 13, a, 16), '#D42A20', 7, r, { angle: a, step: 4, passes: 2, alpha: 0.8 });
    M.crayonStroke(K.g, wob(M.ellipsePts(px, py, 18, 14, a, 14).concat([[px + Math.cos(a) * 18, py + Math.sin(a) * 18]]), 1.5), '#A81810', 4, r, { passes: 3, alpha: 0.8 });
  }
  fin(K, 0.45);
  K = layer();
  M.crayonFill(K.g, M.ellipsePts(fx, fy, 36, 35, 0, 30), '#F6D9A8', 9, r, { angle: 0.3, step: 4.5, passes: 2, alpha: 0.75 });
  M.crayonStroke(K.g, wob(M.ellipsePts(fx, fy, 37, 36, 0, 26).concat([[fx + 37, fy]]), 1.5), '#B07030', 4.5, r, { passes: 4, alpha: 0.8 });
  fin(K, 0.4, 0.95);
  K = layer();
  for (const s of [-1, 1]) { K.g.fillStyle = '#0a0a0a'; K.g.beginPath(); K.g.arc(fx + s * 13, fy - 11, 5.2, 0, TAU); K.g.fill(); }
  // the smile: wide arc nearly ear to ear, packed with teeth
  const top = pl([[fx - 30, fy + 2], [fx - 12, fy + 8], [fx + 12, fy + 8], [fx + 30, fy + 2]], 6);
  const bot = pl([[fx - 30, fy + 2], [fx - 16, fy + 25], [fx + 16, fy + 25], [fx + 30, fy + 2]], 6);
  M.crayonStroke(K.g, top, '#111111', 3.5, r, { passes: 4, alpha: 0.9 });
  M.crayonStroke(K.g, bot, '#111111', 3.5, r, { passes: 4, alpha: 0.9 });
  for (let i = 1; i < 12; i++) { const t = i / 12; const a = M.lineAlong(top, t), b = M.lineAlong(bot, t); line(K, [a[0], a[1]], [b[0], b[1]], '#111111', 2.6, 2); }
  fin(K, 0.4);
  // window frame drawn last, over everything (the child pressed the crayon hard)
  K = layer();
  line(K, [wx0, wy0], [wx1, wy0 - 2], '#1F4FB0', 7, 6); line(K, [wx1, wy0 - 2], [wx1 + 2, wy1], '#1F4FB0', 7, 6);
  line(K, [wx1 + 2, wy1], [wx0, wy1 + 2], '#1F4FB0', 7, 6); line(K, [wx0, wy1 + 2], [wx0, wy0], '#1F4FB0', 7, 6);
  fin(K, 0.46);
  // POPPY IS IN MY HOUSE - big kid letters, the S in IS backwards
  K = layer();
  crayonText(K, 'POPPY IS', 30, 94, 54, '#111111', r, { mirror: [7], seed: 'cw1', w: 6.5 });
  crayonText(K, 'IN MY HOUSE', 26, 168, 46, '#111111', r, { seed: 'cw2', w: 6 });
  fin(K, 0.45);
  M.grain(g, W, H, 0.03, 'crayon');
};

/* ------------------------------------------------------- SUB: EYES */
MISC.sub_eyes_dark = function (g, W, H) {
  const r = rng('eyesdark');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  // barely-there red petals around the left edge of a felt face
  const fcx = 96, fcy = 238, FR = 230;
  g.save();
  for (let i = 0; i < 9; i++) {
    const a = -1.9 + i * 0.42;
    const px = fcx + Math.cos(a) * FR * 1.12, py = fcy + Math.sin(a) * FR * 1.08;
    const pts = M.wobble(M.petalPts(fcx, fcy, a, FR * 0.8, FR * 0.55, FR * 0.33, { tipRound: 1, belly: 0.6 }), 0.03, r);
    const pg = g.createRadialGradient(140, 236, 40, 140, 236, 330);
    pg.addColorStop(0, '#5a0c10'); pg.addColorStop(0.55, '#2a0507'); pg.addColorStop(1, '#000000');
    g.fillStyle = pg; g.fill(M.pathOf(pts));
    g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = 2; g.stroke(M.pathOf(pts));
    void px; void py;
  }
  // the face edge: cream felt fading out of the dark
  const face = M.ellipsePts(fcx, fcy, FR, FR * 1.02, 0, 160);
  g.fillStyle = '#000'; g.fill(M.pathOf(face));
  g.save(); g.clip(M.pathOf(face));
  const fg = g.createRadialGradient(132, 232, 10, 132, 240, 210);
  fg.addColorStop(0, 'rgba(120,104,84,1)'); fg.addColorStop(0.35, 'rgba(62,52,42,1)'); fg.addColorStop(0.75, 'rgba(18,14,11,1)'); fg.addColorStop(1, 'rgba(4,3,2,1)');
  g.fillStyle = fg; g.fillRect(0, 0, W, H);
  bigFelt(g, M.pathOf(face), 1.5, 0.6, 21);
  // lower light from below: shadowed sockets
  const sg = g.createLinearGradient(0, 160, 0, 300);
  sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sg; g.fillRect(0, 140, W, 160);
  g.restore();
  // rim of the face against black: faint edge light on the right side
  g.save(); g.strokeStyle = 'rgba(150,130,105,0.35)'; g.lineWidth = 2; g.filter = M.blur(g, 2);
  g.beginPath(); g.ellipse(fcx, fcy, FR, FR * 1.02, 0, -0.6, 0.5); g.stroke(); g.restore();
  // the eyes: realistic, wide, sclera all round, pinpoint pupils, a wet glint on the lids only
  const eyes = [[70, 222, 74], [176, 214, 80]];
  for (const [x, y, w] of eyes) {
    M.humanEye(g, x, y, { w, open: 0.78, irisR: 0.15, pupil: 0.1, irisColor: '#4F5F58', gaze: [0, 0], catchlight: false, wet: true,
      lashes: true, veins: 14, lower: 0.52, upper: 0.7, socketA: 0.75, socketColor: '#0a0604', seed: 'ed' + x, sclera: '#D8D0BE', lidLine: 'rgba(10,4,2,0.95)' });
  }
  // darkness creeping over everything but the eyes
  const dk = g.createRadialGradient(124, 220, 70, 124, 230, 300);
  dk.addColorStop(0, 'rgba(0,0,0,0)'); dk.addColorStop(0.5, 'rgba(0,0,0,0.45)'); dk.addColorStop(1, 'rgba(0,0,0,0.92)');
  g.fillStyle = dk; g.fillRect(0, 0, W, H);
  // tiny glints on the wet lower lids
  for (const [x, y, w] of eyes) { g.fillStyle = 'rgba(255,250,235,0.55)'; g.beginPath(); g.ellipse(x + w * 0.1, y + w * 0.18, w * 0.09, w * 0.012, -0.05, 0, TAU); g.fill(); }
  g.restore();
  M.grain(g, W, H, 0.03, 'eyesdark');
};

/* ------------------------------------------------------- SUB: TEETH */
MISC.sub_teeth = function (g, W, H) {
  const r = rng('teeth');
  // cream felt filling the frame, harsh flash from slightly below
  g.fillStyle = '#EED6B4'; g.fillRect(0, 0, W, H);
  const lg = g.createRadialGradient(W * 0.5, H * 0.72, 40, W * 0.5, H * 0.6, W * 0.75);
  lg.addColorStop(0, 'rgba(255,248,232,0.5)'); lg.addColorStop(0.55, 'rgba(255,240,215,0)'); lg.addColorStop(1, 'rgba(70,40,25,0.55)');
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  bigFelt(g, null, 2.6, 0.85, 31);
  bigFelt(g, null, 1.2, 0.35, 32);
  // loose fibres catching the flash
  g.save(); g.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const x = r() * W, y = r() * H, a = r() * TAU, L = 3 + r() * 12;
    g.strokeStyle = r() < 0.55 ? `rgba(255,248,230,${0.18 + r() * 0.25})` : `rgba(110,80,50,${0.12 + r() * 0.2})`; g.lineWidth = 0.6 + r() * 1.1;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * L / 2 + (r() - 0.5) * 6, y + Math.sin(a) * L / 2 + (r() - 0.5) * 6, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
  }
  g.restore();
  // red petals intruding at the four corners (out of focus)
  for (const [cx, cy, a0] of [[-30, -30, 0.78], [W + 30, -30, 2.36], [W + 30, H + 30, -2.36], [-30, H + 30, -0.78]]) {
    for (let k = -1; k <= 1; k++) {
      const pts = M.wobble(M.petalPts(cx, cy, a0 + k * 0.42, 0, 150 + r() * 30, 52, { tipRound: 1, belly: 0.62 }), 0.03, r);
      g.save(); g.filter = M.blur(g, 3.5);
      g.fillStyle = k ? '#B81A22' : '#D42630'; g.fill(M.pathOf(pts));
      g.strokeStyle = 'rgba(80,0,8,0.8)'; g.lineWidth = 3; g.stroke(M.pathOf(pts));
      g.restore();
    }
  }
  // the mouth: far too wide, a crescent spanning the frame
  const mx = W / 2, my = 226, hw = 296;
  const G = M.grinPts(mx, my, hw, 58, 132, 120);
  const mouth = M.pathOf(G.pts);
  g.save();
  // painted lip line and a soft cast shadow into the felt
  g.filter = M.blur(g, 5); g.strokeStyle = 'rgba(80,30,20,0.45)'; g.lineWidth = 12; g.stroke(mouth); g.filter = 'none';
  g.fillStyle = '#3E0C14'; g.fill(mouth);
  g.clip(mouth);
  const ig = g.createRadialGradient(mx, my + 70, 10, mx, my + 60, 300);
  ig.addColorStop(0, '#6A1A26'); ig.addColorStop(0.6, '#3E0C14'); ig.addColorStop(1, '#1C0408');
  g.fillStyle = ig; g.fillRect(0, 0, W, H);
  bigFelt(g, mouth, 2.2, 0.75, 33);
  // 24 identical small square teeth: 12 above, 12 below, too white, too clean
  const T = 38;
  const upper = G.up.slice(9, G.up.length - 9), lower = G.lo.slice(16, G.lo.length - 16);
  const opt = { aspect: 1.02, color: '#FFFFFF', root: '#F4F2EC', tip: '#FFFFFF', gapColor: 'rgba(25,3,8,0.95)' };
  M.squareTeeth(g, upper, 12, T, opt);
  M.squareTeeth(g, lower, 12, T * 0.96, opt);
  // gum line shadow under the upper row
  g.restore();
  g.save(); g.strokeStyle = '#5A0F1C'; g.lineWidth = 5; g.lineJoin = 'round'; g.stroke(mouth);
  g.strokeStyle = 'rgba(255,230,210,0.35)'; g.lineWidth = 1.5; g.translate(0, -3); g.stroke(mouth);
  g.restore();
  // pinched corners
  g.save(); g.strokeStyle = '#5A0F1C'; g.lineCap = 'round'; g.lineWidth = 5;
  for (const s of [-1, 1]) { const x = mx + s * hw; g.beginPath(); g.moveTo(x, my - 6); g.quadraticCurveTo(x + s * 16, my - 16, x + s * 20, my - 34); g.stroke(); }
  g.restore();
  M.vignette(g, W, H, 0.35);
  M.grain(g, W, H, 0.025, 'teeth');
};
})(typeof window !== 'undefined' ? window : globalThis);
