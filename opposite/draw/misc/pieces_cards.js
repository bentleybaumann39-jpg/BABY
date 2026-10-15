/* pieces_cards.js - OPPOSITE DAY misc art: the felt rule cards on the twins'
 * easel boards (card_rule1-4, card_see_you) and the wooden pull-toy duck.
 * Each piece is window.MISC[name](g, W, H) in manifest pixels; uses window.MH
 * and the felt-glyph / two-arrow helpers from pieces_brand.js (MISCLIB).
 * Every card is drawn READABLE; the compositor mirrors the far-side copy. */
(function (root) {
'use strict';
const M = root.MH;
const { TAU, DEG, rng, shade, rgba, mixc, lerp, clamp } = M;
const MISC = root.MISC = root.MISC || {};
const LIB = root.MISCLIB;

/* ========================================================= RULE CARDS
 * A cream felt card with a red felt border and rounded corners filling the
 * 480x360 canvas (a sliver of the dark easel board shows in the corners),
 * the text in chunky hand-cut felt letters alternating red, blue and green on
 * slightly uneven baselines, and the little two-arrow logo bottom-right. */
const CARD_COLS = ['#D23A31', '#2A5FC4', '#2F8F3E'];
function ruleCard(g, W, H, lines, seed) {
  // the easel board behind the card's rounded corners
  g.fillStyle = '#2E241D'; g.fillRect(0, 0, W, H);
  const outer = M.roundRectPts(1, 1, W - 2, H - 2, 22, 14);
  M.felt(g, outer, '#CF3A2E', { seed: seed + ':border', rim: 0.8, rimW: 0.35, tex: 0.6, fuzz: 0.6, light: 0.5, shadow: false });
  const inner = M.wobble(M.roundRectPts(24, 22, W - 48, H - 44, 18, 14), 0.004, rng(seed + ':in'));
  M.felt(g, inner, '#FBF1D6', { seed: seed + ':cream', rim: 0.5, rimW: 0.18, tex: 0.32, fuzz: 0.5, light: 0.25,
    shadow: { blur: 4, dx: 1.2, dy: 2.2, color: 'rgba(70,10,0,0.5)' }, stitch: { inset: 7, color: '#D9473B', dash: 5, gap: 3.6, w: 1.4 } });
  // a few grubby thumb marks near the edges (it has been handled on a set)
  g.save(); g.clip(M.pathOf(inner)); g.globalCompositeOperation = 'multiply';
  const r = rng(seed + ':grime');
  for (let i = 0; i < 5; i++) { const x = r() < 0.5 ? 40 + r() * 60 : W - 40 - r() * 60, y = r() < 0.5 ? 40 + r() * 40 : H - 40 - r() * 40; g.filter = M.blur(g, 8); g.fillStyle = `rgba(190,170,140,${0.12 + r() * 0.1})`; g.beginPath(); g.ellipse(x, y, 16 + r() * 14, 10 + r() * 8, r() * 3, 0, TAU); g.fill(); }
  g.restore();
  // the text: fit each line to the card, stack the block in the space above the logo
  const maxW = W - 84, gaps = 0.2;
  // long lines are cut condensed (narrow hand-cut letters) so they can stay tall
  const sxOf = (t) => t.length > 14 ? 0.8 : (t.length > 11 ? 0.9 : 1);
  const sizes = lines.map(t => {
    g.save(); g.font = '900 100px Inter'; const w = [...t].reduce((a, c) => a + g.measureText(c).width * sxOf(t), 0) + 0.04 * 100 * (t.length - 1); g.restore();
    return Math.min(/^RULE \d:$/.test(t) ? 54 : 80, 100 * maxW / w);
  });
  const total = sizes.reduce((a, s) => a + s * 0.74, 0) + sizes.slice(1).reduce((a, s) => a + s * gaps, 0);
  let y = H / 2 - total / 2 - 10;
  let ci = 0;
  const all = [];
  lines.forEach((t, li) => {
    const s = sizes[li]; y += s * 0.74;
    const cols = []; for (const ch of t) { cols.push(CARD_COLS[ci % 3]); if (ch !== ' ') ci++; }
    const w = LIB.layoutWord(g, t, W / 2, y, s, { colors: cols, seed: seed + li, rot: 4, bounce: 0.09, track: 0.04, sx: sxOf(t) });
    all.push(...w.L);
    y += s * gaps;
  });
  LIB.feltGlyphs(g, all, { backing: false, inflate: 0.08 });
  LIB.miniLogo(g, W - 52, H - 50, 22, {});
}
MISC.card_rule1 = (g, W, H) => ruleCard(g, W, H, ['RULE 1:', 'YES MEANS NO'], 'rule1');
MISC.card_rule2 = (g, W, H) => ruleCard(g, W, H, ['RULE 2:', 'FORWARD IS', 'BACKWARD'], 'rule2');
MISC.card_rule3 = (g, W, H) => ruleCard(g, W, H, ['RULE 3:', 'SAFE MEANS', 'NOT SAFE'], 'rule3');
MISC.card_rule4 = (g, W, H) => ruleCard(g, W, H, ['RULE 4:', 'TO STOP, SAY', "IT'S NOT OPPOSITE DAY!"], 'rule4');
MISC.card_see_you = (g, W, H) => ruleCard(g, W, H, ['SEE YOU YESTERDAY!', 'STAY ON YOUR SIDE.'], 'seeyou');

/* ============================================================ TOY DUCK
 * A wooden pull-toy duck facing screen right: glossy yellow painted body with
 * a carved wing, orange beak, black eye, sitting on red wheels on a natural
 * wood axle block, a string with a loop on the floor in front. */
MISC.toy_duck = function (g, W, H) {
  const r = rng('duck');
  // soft contact shadow on the floor
  g.save(); g.filter = M.blur(g, 3); g.fillStyle = 'rgba(20,12,4,0.35)'; g.beginPath(); g.ellipse(60, 95, 44, 4.5, 0, 0, TAU); g.fill(); g.restore();
  // string: from the front of the block, sagging to the floor, ending in a loop
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  const str = [[99, 77], [105, 85], [108, 93], [112, 96], [116, 95.5]];
  const sp = M.splineOpen(str, 8);
  g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.6; g.beginPath(); sp.forEach((p, i) => i ? g.lineTo(p[0] + 0.5, p[1] + 0.8) : g.moveTo(p[0] + 0.5, p[1] + 0.8)); g.stroke();
  g.strokeStyle = '#E9DFC4'; g.lineWidth = 1.2; g.beginPath(); sp.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
  g.beginPath(); g.ellipse(112, 95, 6.5, 2.6, -0.1, 0, TAU); g.stroke();
  g.restore();
  // axle block (natural wood)
  const block = M.roundRectPts(22, 70, 78, 12, 5, 6);
  woodFill(g, block, '#C99A5E', 'duck:block');
  // wheels (back wheel slightly darker / behind)
  for (const [x, y, k] of [[36, 84, 0.85], [86, 84, 1]]) wheel(g, x, y, 13, k);
  // body: a chunky plank-cut duck sitting square on the block, tail up at the left, round breast at the right
  const body = M.splineClosed([[10, 28], [20, 36], [34, 42], [52, 44], [68, 41], [80, 40], [95, 46], [100, 57], [96, 67], [84, 73], [56, 74], [34, 73], [22, 67], [16, 54], [12, 40]], 10);
  const head = M.ellipsePts(84, 25, 15.5, 14.5, 0, 64);
  const neck = M.splineClosed([[71, 41], [72, 30], [80, 32], [92, 34], [97, 47], [86, 47]], 6);
  const L = M.layerLike(g), q = L.g;
  q.fillStyle = '#F5CB2E'; q.fill(M.pathOf(body)); q.fill(M.pathOf(head)); q.fill(M.pathOf(neck));
  // shading: lit from the upper left; gloss paint
  q.save(); q.globalCompositeOperation = 'source-atop';
  const sh = q.createLinearGradient(30, 22, 70, 76); sh.addColorStop(0, 'rgba(255,255,230,0.35)'); sh.addColorStop(0.55, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(150,70,0,0.5)');
  q.fillStyle = sh; q.fillRect(0, 0, W, H);
  const hs = q.createRadialGradient(79, 19, 1, 84, 25, 16); hs.addColorStop(0, 'rgba(255,255,240,0.45)'); hs.addColorStop(1, 'rgba(160,80,0,0.3)');
  q.fillStyle = hs; q.beginPath(); q.arc(84, 25, 16, 0, TAU); q.fill();
  // the plank's cut edge: a darker band along the bottom of the silhouette
  q.fillStyle = 'rgba(170,90,0,0.35)'; q.fillRect(0, 68, W, 8);
  for (let i = 0; i < 30; i++) { const y = 14 + i * 2 + r() * 1.2; q.strokeStyle = `rgba(150,90,10,${0.06 + r() * 0.06})`; q.lineWidth = 0.6; q.beginPath(); q.moveTo(6, y); q.bezierCurveTo(40, y + (r() - 0.5) * 3, 70, y + (r() - 0.5) * 3, 112, y + (r() - 0.5) * 2); q.stroke(); }
  q.restore();
  g.save(); M.shadow(g, 'rgba(40,20,0,0.4)', 2, 0.6, 1.2); M.drawLayer(g, L); g.restore();
  // carved wing: a groove with a light lip
  const wing = M.splineOpen([[34, 50], [46, 58], [62, 61], [76, 57], [72, 51], [60, 49], [46, 47], [36, 44]], 8);
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = 'rgba(150,80,0,0.75)'; g.lineWidth = 1.6; g.beginPath(); wing.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
  g.strokeStyle = 'rgba(255,250,220,0.6)'; g.lineWidth = 0.8; g.beginPath(); wing.forEach((p, i) => i ? g.lineTo(p[0] + 0.5, p[1] + 0.8) : g.moveTo(p[0] + 0.5, p[1] + 0.8)); g.stroke();
  for (const [a, b] of [[[46, 54], [62, 56]], [[52, 51], [68, 54]]]) { g.strokeStyle = 'rgba(150,80,0,0.45)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); }
  // painted outline (thin dark line around the silhouette, toy-style)
  g.strokeStyle = 'rgba(120,60,0,0.55)'; g.lineWidth = 0.9; g.stroke(M.pathOf(body)); g.beginPath(); g.ellipse(84, 25, 15.5, 14.5, 0, -2.5, 1.0); g.stroke();
  g.restore();
  // beak (orange, two flat halves)
  g.save(); M.shadow(g, 'rgba(60,20,0,0.35)', 1, 0.4, 0.8);
  const beak = M.pathOf(M.splineClosed([[97, 21], [110, 24], [116, 27.5], [110, 31], [97, 31]], 6));
  g.fillStyle = '#F07A1A'; g.fill(beak); M.noShadow(g);
  g.strokeStyle = 'rgba(140,50,0,0.7)'; g.lineWidth = 0.8; g.stroke(beak);
  g.beginPath(); g.moveTo(98, 27); g.lineTo(114, 27.8); g.stroke();
  g.fillStyle = 'rgba(255,230,180,0.6)'; g.beginPath(); g.ellipse(103, 24, 3.5, 1, 0.15, 0, TAU); g.fill();
  g.restore();
  // eye: black painted dot with a highlight
  g.fillStyle = '#141010'; g.beginPath(); g.arc(89, 20, 2.8, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(88.1, 19.1, 1.0, 0, TAU); g.fill();
  // worn paint: chips at the edges showing raw wood
  for (let i = 0; i < 9; i++) {
    const p = body[Math.floor(r() * body.length)];
    g.fillStyle = `rgba(214,170,110,${0.6 + r() * 0.3})`; g.beginPath(); g.ellipse(p[0] + (r() - 0.5) * 2, p[1] + (r() - 0.5) * 2, 0.8 + r() * 1.4, 0.6 + r() * 0.9, r() * 3, 0, TAU); g.fill();
  }
  // gloss highlight on the back
  g.strokeStyle = 'rgba(255,255,245,0.65)'; g.lineWidth = 1.4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(28, 39); g.quadraticCurveTo(46, 45, 64, 43); g.stroke();
  // the axle pegs over the wheels
  for (const [x, y] of [[36, 84], [86, 84]]) { g.fillStyle = '#B98A50'; g.beginPath(); g.arc(x, y, 3.2, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,240,210,0.6)'; g.beginPath(); g.arc(x - 0.9, y - 0.9, 1.1, 0, TAU); g.fill(); g.strokeStyle = 'rgba(80,40,10,0.6)'; g.lineWidth = 0.6; g.beginPath(); g.arc(x, y, 3.2, 0, TAU); g.stroke(); }
};
function woodFill(g, pts, col, seed) {
  const r = rng(seed), p = M.pathOf(pts), bb = M.bbox(pts);
  g.save(); M.shadow(g, 'rgba(40,20,0,0.35)', 1.5, 0.5, 1);
  g.fillStyle = col; g.fill(p); M.noShadow(g);
  g.clip(p);
  for (let i = 0; i < 14; i++) { const y = bb.y0 + r() * bb.h; g.strokeStyle = `rgba(110,60,20,${0.15 + r() * 0.2})`; g.lineWidth = 0.5 + r() * 0.6; g.beginPath(); g.moveTo(bb.x0, y); g.bezierCurveTo(bb.x0 + bb.w * 0.3, y + (r() - 0.5) * 3, bb.x0 + bb.w * 0.7, y + (r() - 0.5) * 3, bb.x1, y + (r() - 0.5) * 2); g.stroke(); }
  const sh = g.createLinearGradient(0, bb.y0, 0, bb.y1); sh.addColorStop(0, 'rgba(255,240,210,0.35)'); sh.addColorStop(1, 'rgba(60,30,0,0.35)');
  g.fillStyle = sh; g.fillRect(bb.x0, bb.y0, bb.w, bb.h);
  g.restore();
  g.save(); g.strokeStyle = 'rgba(80,40,10,0.55)'; g.lineWidth = 0.7; g.stroke(p); g.restore();
}
function wheel(g, x, y, R, k) {
  g.save();
  M.shadow(g, 'rgba(30,10,0,0.4)', 1.5, 0.5, 1);
  const wg = g.createRadialGradient(x - R * 0.35, y - R * 0.35, R * 0.1, x, y, R);
  wg.addColorStop(0, shade('#E0322A', 0.25 * k)); wg.addColorStop(0.7, shade('#C8221E', -0.1 * (1 - k))); wg.addColorStop(1, '#7E1210');
  g.fillStyle = wg; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill(); M.noShadow(g);
  g.strokeStyle = 'rgba(60,5,5,0.7)'; g.lineWidth = 0.8; g.stroke();
  g.strokeStyle = 'rgba(255,200,190,0.35)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, R * 0.72, -2.6, -1.2); g.stroke();
  g.strokeStyle = 'rgba(80,10,10,0.45)'; g.lineWidth = 0.7; g.beginPath(); g.arc(x, y, R * 0.6, 0, TAU); g.stroke();
  // scuffs on the tread
  const r = rng('wheel' + x);
  for (let i = 0; i < 6; i++) { const a = r() * TAU; g.strokeStyle = 'rgba(230,200,170,0.35)'; g.lineWidth = 0.7; g.beginPath(); g.arc(x, y, R * (0.88 + r() * 0.08), a, a + 0.15 + r() * 0.2); g.stroke(); }
  g.restore();
}
})(typeof window !== 'undefined' ? window : globalThis);
