/* pieces_props.js - THE WORLD OF POPPY misc art: felt-board props.
 * Felt flowers 1-5 (5 is the eye flower), feelings face cards (incl. HUNGRY)
 * and the friend portrait cards (incl. the scribbled-out Pip).
 * Each piece is window.MISC[name](g, W, H) in manifest pixels; uses window.MH. */
(function (root) {
'use strict';
const M = root.MH;
const { TAU, DEG, rng, shade, rgba, mixc, lerp, clamp } = M;
const MISC = root.MISC = root.MISC || {};
const LIB = root.MISCLIB = root.MISCLIB || {};

/* ---------------------------------------------------------- shared */
/* closed outline of a tube along an open centreline (rounded ends) */
function tubePts(center, w0, w1) {
  const sp = M.resample(M.splineOpen(center, 10), 1.5, true), n = sp.length;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = sp[Math.max(0, i - 1)], b = sp[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const w = lerp(w0, w1 === undefined ? w0 : w1, i / (n - 1)) / 2;
    L.push([sp[i][0] - dy / l * w, sp[i][1] + dx / l * w]); R.push([sp[i][0] + dy / l * w, sp[i][1] - dx / l * w]);
  }
  // round caps
  const capE = [], capS = [], e = sp[n - 1], s = sp[0];
  const ae = Math.atan2(sp[n - 1][1] - sp[n - 2][1], sp[n - 1][0] - sp[n - 2][0]), as = Math.atan2(sp[0][1] - sp[1][1], sp[0][0] - sp[1][0]);
  const we = (w1 === undefined ? w0 : w1) / 2, ws = w0 / 2;
  for (let k = 1; k < 8; k++) { const a = ae + Math.PI / 2 - k / 8 * Math.PI; capE.push([e[0] + Math.cos(a) * we, e[1] + Math.sin(a) * we]); }
  for (let k = 1; k < 8; k++) { const a = as + Math.PI / 2 - k / 8 * Math.PI; capS.push([s[0] + Math.cos(a) * ws, s[1] + Math.sin(a) * ws]); }
  return L.concat(capE, R.reverse(), capS);
}
/* standard felt stem with two leaves; bottom at (cx, H+2) */
function flowerStem(g, W, H, topY, seed, o) {
  o = o || {};
  const cx = W / 2, r = rng(seed + ':stem');
  const bend = o.bend === undefined ? 6 : o.bend;
  const center = [[cx, H + 4], [cx + bend * 0.6, H * 0.8], [cx - bend * 0.4, H * 0.62], [cx + bend * 0.2, topY + 20], [cx, topY]];
  const leafC = o.leaf || '#3E8E3A';
  // leaves behind the stem
  M.feltLeaf(g, cx - 2, H * 0.80, -2.35 + (r() - 0.5) * 0.1, 66, 20, { seed: seed + ':leafL', color: leafC, stitch: { inset: 3.5, color: 'rgba(225,245,200,0.8)', dash: 3, gap: 2.6, w: 0.9 } });
  M.feltLeaf(g, cx + 2, H * 0.69, -0.72 + (r() - 0.5) * 0.1, 60, 18, { seed: seed + ':leafR', color: shade(leafC, 0.06), stitch: { inset: 3.5, color: 'rgba(225,245,200,0.8)', dash: 3, gap: 2.6, w: 0.9 } });
  M.felt(g, tubePts(center, 15, 12), '#4C9A3A', { seed: seed + ':stemfelt', rim: 0.9, rimW: 1.4, shadow: { blur: 3, dx: 1.2, dy: 1.5, color: 'rgba(0,30,0,0.4)' }, fuzz: 0.4,
    stitch: { open: false, inset: 3, color: 'rgba(220,245,200,0.75)', dash: 3.2, gap: 2.8, w: 0.85 } });
}
/* cute felt-board face: glossy black dot eyes, small smile, rosy cheeks */
function cuteFace(g, cx, cy, s, o) {
  o = o || {};
  g.save();
  for (const side of [-1, 1]) {
    const ex = cx + side * 0.34 * s, ey = cy - 0.08 * s;
    const ck = o.cheek || '#F58FA6';
    g.fillStyle = rgba(ck, 0.85); g.beginPath(); g.ellipse(cx + side * 0.56 * s, cy + 0.2 * s, 0.15 * s, 0.11 * s, 0, 0, TAU); g.fill();
    const eg = g.createRadialGradient(ex - 0.03 * s, ey - 0.05 * s, 0, ex, ey, 0.15 * s);
    eg.addColorStop(0, '#3a3438'); eg.addColorStop(0.6, '#0e0c0e'); eg.addColorStop(1, '#050405');
    g.fillStyle = eg; g.beginPath(); g.ellipse(ex, ey, 0.105 * s, 0.135 * s, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(ex - 0.035 * s, ey - 0.055 * s, 0.038 * s, 0, TAU); g.fill();
  }
  g.strokeStyle = o.mouth || '#4A1410'; g.lineWidth = Math.max(1.2, 0.075 * s); g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - 0.26 * s, cy + 0.17 * s); g.quadraticCurveTo(cx, cy + 0.46 * s, cx + 0.26 * s, cy + 0.17 * s); g.stroke();
  g.restore();
}

/* ------------------------------------------------------------ FLOWERS */
const FW = 200, FH = 320, FCX = 100, FCY = 104;
function daisyHead(g, cx, cy, R, seed, centreR) {
  const r = rng(seed + ':daisy'), n = 14, rot0 = r() * TAU;
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < n; i++) {
      if (i % 2 !== layer) continue;
      const th = rot0 + i / n * TAU + (r() - 0.5) * 0.08;
      const pts = M.wobble(M.petalPts(cx, cy, th, R * 0.2, R * (0.78 + r() * 0.1), R * 0.155, { tipRound: 1, belly: 0.62, bw: R * 0.08 }), 0.015, r);
      M.felt(g, pts, layer ? '#FFFFFF' : '#EDEADF', { seed: seed + ':p' + i, rim: 0.75, rimW: 0.8, shadow: { blur: 2.5, dx: 0.8, dy: 1.6, color: 'rgba(40,30,0,0.38)' }, tex: 0.5, fuzz: 0.35,
        paint: q => { q.strokeStyle = 'rgba(170,165,150,0.5)'; q.lineWidth = 1; q.beginPath(); q.moveTo(cx + Math.cos(th) * R * 0.32, cy + Math.sin(th) * R * 0.32); q.lineTo(cx + Math.cos(th) * R * 0.78, cy + Math.sin(th) * R * 0.78); q.stroke(); } });
      g.save(); g.strokeStyle = 'rgba(120,115,100,0.55)'; g.lineWidth = 0.8; g.stroke(M.pathOf(pts)); g.restore();
    }
  }
  const c = M.wobble(M.ellipsePts(cx, cy, centreR, centreR, 0, 64), 0.015, r);
  M.felt(g, c, '#F7C21E', { seed: seed + ':c', rim: 0.9, shadow: { blur: 3, dx: 0.8, dy: 1.5 }, fuzz: 0.4, stitch: { inset: 3.5, color: 'rgba(255,240,170,0.9)', dash: 3, gap: 2.5, w: 0.9 } });
  g.save(); g.strokeStyle = 'rgba(150,95,0,0.7)'; g.lineWidth = 1; g.stroke(M.pathOf(c)); g.restore();
}
MISC.flower_1 = function (g, W, H) {
  flowerStem(g, W, H, FCY + 30, 'f1');
  daisyHead(g, FCX, FCY, 92, 'f1', 36);
  cuteFace(g, FCX, FCY + 2, 52);
};

MISC.flower_2 = function (g, W, H) {
  flowerStem(g, W, H, FCY + 50, 'f2', { bend: -5 });
  const pink = '#F27BB0', r = rng('f2:tulip');
  const petal = (pts, col, sd, k) => {
    M.felt(g, pts, col, { seed: 'f2:' + sd, rim: 0.85, shadow: { blur: 3, dx: 1, dy: 2, color: 'rgba(80,0,40,0.4)' }, tex: 0.6, fuzz: 0.35,
      paint: q => {
        const bb = M.bbox(pts);
        q.strokeStyle = rgba(shade(col, -0.25), 0.45); q.lineWidth = 1.1;
        for (let i = 0; i < 4; i++) { const x = lerp(bb.x0 + bb.w * 0.25, bb.x1 - bb.w * 0.25, i / 3); q.beginPath(); q.moveTo(x, bb.y1 - 6); q.quadraticCurveTo(lerp(x, bb.cx, 0.3), bb.cy, lerp(x, bb.cx, 0.55) + (k || 0), bb.y0 + bb.h * 0.2); q.stroke(); }
      } });
    g.save(); g.strokeStyle = rgba(shade(col, -0.5), 0.7); g.lineWidth = 0.9; g.stroke(M.pathOf(pts)); g.restore();
  };
  // back petals: pointed tips rising behind
  const back = (dx, tipx, sd) => M.wobble(M.splineClosed([[FCX + dx - 34, FCY + 58], [FCX + dx - 40, FCY + 4], [FCX + tipx - 16, FCY - 52], [FCX + tipx, FCY - 74], [FCX + tipx + 16, FCY - 52], [FCX + dx + 34, FCY + 6], [FCX + dx + 30, FCY + 60]], 10), 0.01, r);
  petal(back(-30, -26, 'bl'), shade(pink, -0.16), 'bl', -3);
  petal(back(30, 26, 'br'), shade(pink, -0.12), 'br', 3);
  // side front petals
  const side = s => M.splineClosed([[FCX + s * 6, FCY + 72], [FCX + s * 62, FCY + 50], [FCX + s * 70, FCY - 4], [FCX + s * 60, FCY - 52], [FCX + s * 52, FCY - 60], [FCX + s * 30, FCY - 20], [FCX + s * 4, FCY + 30]], 10);
  petal(side(-1), shade(pink, -0.04), 'sl', 4);
  petal(side(1), shade(pink, -0.02), 'sr', -4);
  // centre front petal (the cup) carries the face
  const front = M.wobble(M.splineClosed([[FCX, FCY + 80], [FCX - 48, FCY + 62], [FCX - 58, FCY + 4], [FCX - 44, FCY - 48], [FCX - 22, FCY - 60], [FCX, FCY - 42], [FCX + 22, FCY - 60], [FCX + 44, FCY - 48], [FCX + 58, FCY + 4], [FCX + 48, FCY + 62]], 12), 0.008, r);
  petal(front, pink, 'fc', 0);
  cuteFace(g, FCX, FCY + 14, 50, { cheek: '#FF5A8A', mouth: '#5A0E2A' });
};

MISC.flower_3 = function (g, W, H) {
  flowerStem(g, W, H, FCY + 40, 'f3', { bend: 4, leaf: '#3F8C35' });
  const r = rng('f3:sun'), cx = FCX, cy = FCY, R = 93;
  for (let layer = 0; layer < 2; layer++) {
    const n = 18, rot0 = layer * Math.PI / n + 0.1;
    for (let i = 0; i < n; i++) {
      const th = rot0 + i / n * TAU + (r() - 0.5) * 0.06;
      const pts = M.wobble(M.petalPts(cx, cy, th, R * 0.32, R * (0.62 + r() * 0.08), R * 0.115, { tipRound: 0.05, belly: 0.4, bw: R * 0.08 }), 0.01, r);
      const col = layer ? '#FFC81F' : '#F2A513';
      M.felt(g, pts, col, { seed: 'f3:p' + layer + ':' + i, rim: 0.7, rimW: 0.7, shadow: { blur: 2.5, dx: 0.8, dy: 1.4, color: 'rgba(90,40,0,0.4)' }, tex: 0.55, fuzz: 0.3 });
      g.save(); g.strokeStyle = 'rgba(160,80,0,0.55)'; g.lineWidth = 0.8; g.stroke(M.pathOf(pts)); g.restore();
    }
  }
  const cr = R * 0.47, c = M.wobble(M.ellipsePts(cx, cy, cr, cr, 0, 72), 0.012, r);
  M.felt(g, c, '#9A6031', { seed: 'f3:c', rim: 1, shadow: { blur: 3, dx: 1, dy: 1.6 }, fuzz: 0.4,
    paint: q => {
      // french-knot seeds in a sunflower spiral, sparse around the face
      for (let i = 0; i < 220; i++) {
        const a = i * 2.39996, d = Math.sqrt(i / 220) * cr * 0.97;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
        const fx = (x - cx) / cr, fy = (y - cy) / cr;
        if (Math.hypot(fx * 1.1, (fy - 0.05) * 1.25) < 0.78) continue;     // leave the face area calm
        q.fillStyle = r() < 0.5 ? 'rgba(70,35,10,0.8)' : 'rgba(150,95,45,0.85)';
        q.beginPath(); q.arc(x, y, 1.6 + r() * 0.8, 0, TAU); q.fill();
      }
    } });
  g.save(); g.strokeStyle = 'rgba(60,30,10,0.8)'; g.lineWidth = 1; g.stroke(M.pathOf(c)); g.restore();
  cuteFace(g, cx, cy + 2, 54, { cheek: '#FF8A8A', mouth: '#2A1206' });
};

MISC.flower_4 = function (g, W, H) {
  const r = rng('f4');
  const cx = FCX;
  // main stem continues up to an arching top that carries the side bells
  flowerStem(g, W, H, FCY + 64, 'f4', { bend: 3 });
  const stalk = (pts, w) => M.felt(g, tubePts(pts, w, w * 0.75), '#4C9A3A', { seed: 'f4:st' + pts[0][0], rim: 0.8, rimW: 1.2, shadow: { blur: 2, dx: 1, dy: 1.2, color: 'rgba(0,30,0,0.35)' }, fuzz: 0.3 });
  stalk([[cx, FCY + 90], [cx - 6, FCY - 10], [cx - 30, FCY - 66], [cx - 58, FCY - 70], [cx - 70, FCY - 56]], 8);
  stalk([[cx, FCY + 90], [cx + 8, FCY - 20], [cx + 34, FCY - 76], [cx + 60, FCY - 82], [cx + 70, FCY - 68]], 8);
  const blue = '#5B8EE6';
  const bell = (bx, by, s, rot, sd, face) => {
    // bell opening downward, scalloped rim with 5 points
    const ctrl = [];
    const top = [[0, -1.0], [0.42, -0.92], [0.62, -0.55], [0.66, -0.05], [0.8, 0.36]];
    for (const [x, y] of top) ctrl.push([x, y]);
    const pts0 = [];
    // right side down, rim scallops right -> left, left side up
    const right = M.splineOpen([[0, -1.0], [0.44, -0.92], [0.62, -0.52], [0.68, 0.0], [0.86, 0.42]], 10);
    const left = right.map(([x, y]) => [-x, y]).reverse();
    const rim = [];
    const nS = 5;
    for (let i = 0; i <= nS * 8; i++) {
      const t = i / (nS * 8), x = lerp(0.86, -0.86, t);
      const k = (i % 8) / 8, y = 0.42 + 0.14 * Math.sin(Math.PI * k) - 0.05 * Math.sin(Math.PI * 2 * t);
      rim.push([x, y + (k < 0.05 ? -0.02 : 0)]);
    }
    for (const p of right.concat(rim, left)) pts0.push(p);
    const pts = M.transformPts(pts0, bx, by, rot, s, s);
    M.felt(g, pts, sd === 'main' ? blue : shade(blue, -0.08), { seed: 'f4:' + sd, rim: 0.9, shadow: { blur: 3, dx: 1, dy: 2, color: 'rgba(0,10,60,0.4)' }, tex: 0.6, fuzz: 0.35,
      paint: q => {
        q.strokeStyle = rgba(shade(blue, -0.35), 0.5); q.lineWidth = 1.1;
        for (const u of [-0.42, 0, 0.42]) { const a = M.transformPts([[u * 0.6, -0.8], [u * 1.6, 0.48]], bx, by, rot, s, s); q.beginPath(); q.moveTo(a[0][0], a[0][1]); q.quadraticCurveTo(lerp(a[0][0], a[1][0], 0.5) + u * 4, lerp(a[0][1], a[1][1], 0.5), a[1][0], a[1][1]); q.stroke(); }
        // dark mouth of the bell under the rim
        const m = M.transformPts([[0, 0.5]], bx, by, rot, s, s)[0];
        const mg = q.createRadialGradient(m[0], m[1], 0, m[0], m[1], s * 0.7);
        mg.addColorStop(0, 'rgba(10,20,70,0.55)'); mg.addColorStop(1, 'rgba(10,20,70,0)');
        q.fillStyle = mg; q.beginPath(); q.ellipse(m[0], m[1], s * 0.75, s * 0.14, rot, 0, TAU); q.fill();
      } });
    g.save(); g.strokeStyle = 'rgba(20,40,110,0.75)'; g.lineWidth = 0.9; g.stroke(M.pathOf(pts)); g.restore();
    // little green calyx cap
    const cap = M.wobble(M.ellipsePts(...M.transformPts([[0, -1.0]], bx, by, rot, s, s)[0], s * 0.2, s * 0.1, rot, 30), 0.05, r);
    M.felt(g, cap, '#4C9A3A', { seed: 'f4:cap' + sd, rim: 0.6, shadow: false, fuzz: 0.2 });
    if (face) cuteFace(g, bx, by - s * 0.22, s * 0.7, { cheek: '#FF8FB0', mouth: '#10204A' });
  };
  bell(cx - 66, FCY - 30, 30, 0.22, 'l');
  bell(cx + 68, FCY - 40, 28, -0.2, 'r');
  bell(cx, FCY + 18, 66, 0, 'main', true);
};

/* flower 5: the felt poppy whose seed-pod centre is a real human eye.
 * gaze is the only parameter that differs between the two files. On the
 * board Poppy stands to the RIGHT of slot 5, so "toward Poppy" is screen-right
 * and a little up. */
function eyeFlower(g, W, H, gaze) {
  flowerStem(g, W, H, FCY + 40, 'f5', { bend: 5 });
  M.feltPoppy(g, FCX, FCY, 95, { seed: 'f5:poppy', petals: 5, rot: -Math.PI / 2 + 0.2, noCentre: true, spread: 1.5 });
  const cx = FCX, cy = FCY + 1;
  const r = rng('f5:skin');
  // black felt socket where the seed pod should be
  const sock = M.wobble(M.ellipsePts(cx, cy, 58, 45, 0, 90), 0.03, r);
  M.felt(g, sock, '#1A1013', { seed: 'f5:sock', rim: 0.8, light: 0.6, shadow: { blur: 3, dx: 0.6, dy: 1.2, color: 'rgba(0,0,0,0.5)' }, fuzz: 0.5, tex: 0.8 });
  // fleshy eyelid skin set into the felt
  const skin = M.wobble(M.splineClosed([[cx - 50, cy + 2], [cx - 38, cy - 26], [cx - 6, cy - 37], [cx + 30, cy - 32], [cx + 50, cy - 8], [cx + 44, cy + 20], [cx + 12, cy + 33], [cx - 24, cy + 30]], 12), 0.015, r);
  g.save();
  M.shadow(g, 'rgba(10,0,0,0.75)', 4, 0, 1);
  const sk = g.createRadialGradient(cx - 4, cy - 6, 8, cx, cy, 54);
  sk.addColorStop(0, '#EDC2AA'); sk.addColorStop(0.55, '#DDA48E'); sk.addColorStop(0.85, '#B8746A'); sk.addColorStop(1, '#7E4442');
  g.fillStyle = sk; g.fill(M.pathOf(skin)); M.noShadow(g);
  g.clip(M.pathOf(skin));
  // pores / skin grain, fine wrinkles, lid crease and an under-eye bag
  for (let i = 0; i < 420; i++) { const x = cx + (r() - 0.5) * 104, y = cy + (r() - 0.5) * 74; g.fillStyle = r() < 0.5 ? 'rgba(120,60,50,0.16)' : 'rgba(255,228,214,0.16)'; g.beginPath(); g.arc(x, y, 0.35 + r() * 0.6, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(110,50,45,0.45)'; g.lineWidth = 0.7;
  for (const s2 of [-1, 1]) for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(cx + s2 * 38, cy - 3 + k * 5); g.quadraticCurveTo(cx + s2 * 44, cy - 1 + k * 6, cx + s2 * 49, cy - 5 + k * 8); g.stroke(); }
  g.lineWidth = 1.6; g.strokeStyle = 'rgba(100,40,38,0.45)'; g.filter = M.blur(g, 1.2);
  g.beginPath(); g.moveTo(cx - 40, cy - 12); g.bezierCurveTo(cx - 24, cy - 34, cx + 20, cy - 36, cx + 42, cy - 14); g.stroke();
  g.beginPath(); g.moveTo(cx - 30, cy + 22); g.quadraticCurveTo(cx, cy + 32, cx + 32, cy + 20); g.stroke();
  g.filter = 'none';
  // where the skin meets the felt: a dark, damp-looking seam
  g.lineWidth = 7; g.strokeStyle = 'rgba(50,8,10,0.6)'; g.filter = M.blur(g, 3); g.stroke(M.pathOf(skin)); g.filter = 'none';
  g.restore();
  M.humanEye(g, cx, cy - 1, {
    w: 80, open: 0.6, irisR: 0.16, pupil: 0.16, irisColor: '#5F7E62', gaze, catchlight: [-0.42, -0.42], wet: true,
    lashes: true, veins: 16, lower: 0.5, upper: 0.66, socketA: 0.28, socketColor: '#6a2a24', seed: 'f5:eye', crease: false,
  });
  // a few felt fibres creeping over the skin edge
  g.save(); g.strokeStyle = 'rgba(30,14,16,0.6)'; g.lineWidth = 0.6;
  const edge = M.resample(skin, 2);
  for (const [x, y] of edge) { if (r() < 0.5) continue; const a = Math.atan2(y - cy, x - cx); g.beginPath(); g.moveTo(x + Math.cos(a) * 1.5, y + Math.sin(a) * 1.5); g.lineTo(x - Math.cos(a) * (1.5 + r() * 3.5), y - Math.sin(a) * (1.5 + r() * 3.5)); g.stroke(); }
  g.restore();
}
MISC.flower_5_eye = (g, W, H) => eyeFlower(g, W, H, [0.72, -0.35]);
MISC.flower_5_eye_look = (g, W, H) => eyeFlower(g, W, H, [0, 0]);

/* --------------------------------------------------- FEELINGS CARDS */
/* hand-cut felt letters: heavy rounded glyphs, felt texture, rim, shadow */
function feltLetters(g, text, x, y, size, color, o) {
  o = o || {};
  const r = rng((o.seed || 'fl') + ':' + text), font = `900 ${size}px Inter`;
  g.save(); g.font = font; const ws = [...text].map(c => g.measureText(c).width); g.restore();
  const tr = (o.track === undefined ? 0.03 : o.track) * size;
  const total = ws.reduce((a, b) => a + b, 0) + tr * (ws.length - 1);
  let px = x - total / 2;
  const L = M.layerLike(g);
  const inflate = size * (o.inflate === undefined ? 0.07 : o.inflate);
  [...text].forEach((ch, i) => {
    const q = L.g; q.save();
    q.translate(px + ws[i] / 2 + (r() - 0.5) * size * 0.03, y + (r() - 0.5) * size * 0.06);
    q.rotate((r() - 0.5) * 2 * (o.rot === undefined ? 5 : o.rot) * DEG);
    const sc = 1 + (r() - 0.5) * 0.06; q.scale(sc, sc);
    q.font = font; q.textAlign = 'center'; q.textBaseline = 'alphabetic'; q.lineJoin = 'round';
    q.fillStyle = color; q.strokeStyle = color; q.lineWidth = inflate;
    q.fillText(ch, 0, 0); q.strokeText(ch, 0, 0);
    q.restore();
    px += ws[i] + tr;
  });
  // keep a copy of the letter alpha
  const A = M.layerLike(g); M.drawLayer(A.g, L);
  // felt texture + broad light, re-masked to the letters
  M.texFill(L.g, M.feltTex(512, 3), null, 'overlay', 0.8, r() * 300, r() * 300);
  L.g.save(); L.g.setTransform(1, 0, 0, 1, 0, 0); L.g.globalCompositeOperation = 'destination-in'; L.g.drawImage(A.c, 0, 0); L.g.restore();
  // inner rim: blurred inverse alpha, offset down-right (dark) and up-left (light)
  const s = M.scaleOf(g);
  const I = M.layerLike(g);
  I.g.save(); I.g.setTransform(1, 0, 0, 1, 0, 0); I.g.fillStyle = '#000'; I.g.fillRect(0, 0, I.c.width, I.c.height); I.g.globalCompositeOperation = 'destination-out'; I.g.drawImage(A.c, 0, 0); I.g.restore();
  L.g.save(); L.g.setTransform(1, 0, 0, 1, 0, 0); L.g.globalCompositeOperation = 'source-atop';
  L.g.filter = `blur(${size * 0.035 * s}px)`; L.g.globalAlpha = 0.45; L.g.drawImage(I.c, -size * 0.03 * s, -size * 0.04 * s);
  L.g.restore();
  g.save();
  M.shadow(g, o.shadowColor || 'rgba(40,20,0,0.5)', size * 0.06, size * 0.02, size * 0.04);
  M.drawLayer(g, L);
  g.restore();
  // a hint of cut-edge fuzz
  return { total };
}
LIB.feltLetters = feltLetters;

const CW = 240, CH = 300, FX = 120, FY = 116, FR = 90;
function cardBase(g, seed, o) {
  o = o || {};
  const pts = M.roundRectPts(8, 6, 224, 286, 18, 12);
  g.save();
  M.shadow(g, 'rgba(30,20,0,0.45)', 5, 1.5, 3);
  g.fillStyle = o.card || '#FBF5E4'; g.fill(M.pathOf(pts));
  M.noShadow(g);
  g.clip(M.pathOf(pts));
  M.texFill(g, M.paperTex(256, seed), null, 'overlay', 0.7);
  const lg = g.createLinearGradient(0, 0, CW, CH);
  lg.addColorStop(0, 'rgba(255,255,255,0.25)'); lg.addColorStop(1, 'rgba(120,90,40,0.12)');
  g.fillStyle = lg; g.fillRect(0, 0, CW, CH);
  if (o.dirty) o.dirty(g);
  g.restore();
  g.save(); g.strokeStyle = o.edge || 'rgba(170,140,90,0.7)'; g.lineWidth = 1.2; g.stroke(M.pathOf(pts)); g.restore();
  // a coloured border band (printed card)
  if (o.band) { g.save(); g.strokeStyle = o.band; g.lineWidth = 5; g.stroke(M.pathOf(M.offset(pts, -7))); g.restore(); }
  return pts;
}
function faceDisc(g, color, seed, o) {
  o = o || {};
  const r = rng(seed + ':disc');
  const pts = M.wobble(M.ellipsePts(FX, FY, FR, FR * 0.98, 0, 120), o.wob === undefined ? 0.012 : o.wob, r);
  M.felt(g, pts, color, { seed: seed + ':face', rim: 1, shadow: { blur: 4, dx: 1.2, dy: 2.5, color: 'rgba(40,20,0,0.45)' }, tex: o.tex === undefined ? 0.7 : o.tex, fuzz: 0.4, light: 0.6,
    stitch: { inset: 5, color: o.stitch || 'rgba(255,255,255,0.8)', dash: 4, gap: 3.2, w: 1.1 } });
  g.save(); g.strokeStyle = rgba(shade(color, -0.45), 0.8); g.lineWidth = 1.1; g.stroke(M.pathOf(pts)); g.restore();
  return pts;
}
function wordStrip(g, seed, color, o) {
  o = o || {};
  const pts = M.wobble(M.roundRectPts(26, 222, 188, 58, 10, 10), 0.006, rng(seed + ':strip'));
  M.felt(g, pts, color || '#FFFFFF', { seed: seed + ':strip', rim: 0.6, tex: 0.45, shadow: { blur: 3, dx: 1, dy: 2, color: 'rgba(40,20,0,0.4)' }, fuzz: 0.35, light: 0.3 });
  g.save(); g.strokeStyle = 'rgba(150,130,100,0.6)'; g.lineWidth = 0.9; g.stroke(M.pathOf(pts)); g.restore();
  return pts;
}
function feltPiece(g, pts, color, seed, o) {
  o = o || {};
  M.felt(g, pts, color, Object.assign({ seed, rim: 0.7, rimW: 0.9, shadow: { blur: 2, dx: 0.8, dy: 1.4, color: 'rgba(30,10,0,0.45)' }, tex: 0.5, fuzz: 0.3, light: 0.6 }, o));
  if (o.line !== false) { g.save(); g.strokeStyle = rgba(shade(color, -0.5), 0.75); g.lineWidth = 0.8; g.stroke(M.pathOf(pts)); g.restore(); }
}
/* glossy black felt eye (oval) with a white felt highlight */
function feltEye(g, x, y, rx, ry, seed, o) {
  o = o || {};
  feltPiece(g, M.ellipsePts(x, y, rx, ry, o.rot || 0, 48), '#141114', seed, { light: 1, line: false });
  g.save(); g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.ellipse(x - rx * 0.32, y - ry * 0.38, rx * 0.3, ry * 0.22, -0.4, 0, TAU); g.fill(); g.restore();
}
/* a felt strip shape along an open curve */
function feltStrip(g, center, w, color, seed, o) { feltPiece(g, tubePts(center, w, (o && o.w1) || w), color, seed, o); }
function cheeks(g, col, dy, k) {
  for (const s of [-1, 1]) feltPiece(g, M.ellipsePts(FX + s * 54, FY + (dy || 18), 15 * (k || 1), 11 * (k || 1), 0, 40), col, 'ck' + s + col, { line: false, rim: 0.4, shadow: { blur: 1, dx: 0.4, dy: 0.8, color: 'rgba(60,0,0,0.25)' } });
}

MISC.feel_happy = function (g, W, H) {
  cardBase(g, 'happy', { band: 'rgba(247,190,40,0.55)' });
  faceDisc(g, '#F9CD2E', 'happy');
  cheeks(g, '#F7849A', 20);
  feltEye(g, FX - 30, FY - 22, 10, 14, 'h:el'); feltEye(g, FX + 30, FY - 22, 10, 14, 'h:er');
  // big open smile: felt D with a pink tongue
  const mouth = M.splineClosed([[FX - 46, FY + 12], [FX, FY + 18], [FX + 46, FY + 12], [FX + 36, FY + 40], [FX, FY + 58], [FX - 36, FY + 40]], 12);
  feltPiece(g, mouth, '#7A1424', 'h:m', { light: 0.3,
    paint: q => { q.fillStyle = '#F07A92'; q.beginPath(); q.ellipse(FX, FY + 56, 24, 14, 0, 0, TAU); q.fill(); q.fillStyle = 'rgba(255,255,255,0.25)'; q.beginPath(); q.ellipse(FX - 6, FY + 50, 8, 4, 0, 0, TAU); q.fill(); } });
  wordStrip(g, 'happy');
  feltLetters(g, 'HAPPY', FX, 268, 44, '#F07E12', { seed: 'happy' });
};
MISC.feel_sad = function (g, W, H) {
  cardBase(g, 'sad', { band: 'rgba(90,150,220,0.5)' });
  faceDisc(g, '#93C8F0', 'sad');
  cheeks(g, '#E9A3BD', 22, 0.85);
  // sad brows sloping up toward the middle
  feltStrip(g, [[FX - 46, FY - 38], [FX - 30, FY - 44], [FX - 14, FY - 52]], 6, '#2B4A78', 's:bl');
  feltStrip(g, [[FX + 46, FY - 38], [FX + 30, FY - 44], [FX + 14, FY - 52]], 6, '#2B4A78', 's:br');
  feltEye(g, FX - 30, FY - 16, 9.5, 12.5, 's:el'); feltEye(g, FX + 30, FY - 16, 9.5, 12.5, 's:er');
  // downturned mouth
  feltStrip(g, [[FX - 30, FY + 46], [FX - 14, FY + 32], [FX, FY + 29], [FX + 14, FY + 32], [FX + 30, FY + 46]], 8, '#3A2440', 's:m');
  // one felt tear
  const tx = FX + 34, ty = FY + 14;
  const tear = M.splineClosed([[tx, ty - 16], [tx + 6, ty - 2], [tx + 8, ty + 8], [tx, ty + 14], [tx - 8, ty + 8], [tx - 6, ty - 2]], 10);
  feltPiece(g, tear, '#DDF4FF', 's:tear', { light: 0.8, paint: q => { q.fillStyle = 'rgba(255,255,255,0.9)'; q.beginPath(); q.ellipse(tx - 2.5, ty + 3, 2, 4, 0.3, 0, TAU); q.fill(); } });
  wordStrip(g, 'sad');
  feltLetters(g, 'SAD', FX, 268, 46, '#2E6FC4', { seed: 'sad' });
};
MISC.feel_angry = function (g, W, H) {
  cardBase(g, 'angry', { band: 'rgba(230,80,40,0.5)' });
  faceDisc(g, '#F0652E', 'angry');
  cheeks(g, '#D8323A', 22, 0.9);
  // slanted brows: low in the middle
  feltStrip(g, [[FX - 50, FY - 50], [FX - 30, FY - 42], [FX - 10, FY - 30]], 9, '#3A140C', 'a:bl');
  feltStrip(g, [[FX + 50, FY - 50], [FX + 30, FY - 42], [FX + 10, FY - 30]], 9, '#3A140C', 'a:br');
  feltEye(g, FX - 28, FY - 16, 9, 11, 'a:el'); feltEye(g, FX + 28, FY - 16, 9, 11, 'a:er');
  // frown
  feltStrip(g, [[FX - 34, FY + 46], [FX - 16, FY + 30], [FX, FY + 27], [FX + 16, FY + 30], [FX + 34, FY + 46]], 9, '#3A140C', 'a:m');
  // little steam puffs
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const px = FX + s * (82 + k * 4), py = FY - 70 - k * 9;
    feltPiece(g, M.ellipsePts(px, py, 5 - k, 4 - k * 0.6, 0, 20), '#FFFFFF', 'a:puff' + s + k, { rim: 0.3, line: false, shadow: { blur: 1, dx: 0.5, dy: 1, color: 'rgba(0,0,0,0.25)' } });
  }
  wordStrip(g, 'angry');
  feltLetters(g, 'ANGRY', FX, 268, 42, '#D7261E', { seed: 'angry' });
};
MISC.feel_scared = function (g, W, H) {
  cardBase(g, 'scared', { band: 'rgba(160,120,220,0.5)' });
  faceDisc(g, '#BBA4E6', 'scared');
  // raised brows
  feltStrip(g, [[FX - 46, FY - 50], [FX - 30, FY - 60], [FX - 14, FY - 56]], 6, '#3C2466', 'k:bl');
  feltStrip(g, [[FX + 46, FY - 50], [FX + 30, FY - 60], [FX + 14, FY - 56]], 6, '#3C2466', 'k:br');
  // big round eyes: white felt with small pupils
  for (const s of [-1, 1]) {
    feltPiece(g, M.ellipsePts(FX + s * 30, FY - 20, 18, 20, 0, 48), '#FFFFFF', 'k:ew' + s, { light: 0.4 });
    feltEye(g, FX + s * 30 + s * 1, FY - 18, 6.5, 7.5, 'k:ep' + s);
  }
  // wavy mouth
  const wav = []; for (let i = 0; i <= 8; i++) wav.push([FX - 32 + i * 8, FY + 38 + (i % 2 ? -6 : 6)]);
  feltStrip(g, wav, 7, '#3C2466', 'k:m');
  // sweat drop
  const tx = FX - 62, ty = FY - 34;
  feltPiece(g, M.splineClosed([[tx, ty - 12], [tx + 5, ty], [tx + 6, ty + 7], [tx, ty + 11], [tx - 6, ty + 7], [tx - 5, ty]], 10), '#D6F1FF', 'k:sw', { light: 0.8 });
  wordStrip(g, 'scared');
  feltLetters(g, 'SCARED', FX, 268, 38, '#6E43B8', { seed: 'scared' });
};

/* The fifth face nobody introduced. Same card format; sickly pale felt,
 * realistic eyes (sclera all round, pinpoint pupils, no catchlight), a smile
 * far too wide packed with 24 identical square teeth, crooked marker label. */
MISC.feel_hungry = function (g, W, H) {
  const r = rng('hungry');
  cardBase(g, 'hungry', { card: '#F1EBDA', band: 'rgba(150,145,120,0.45)', edge: 'rgba(120,110,90,0.8)',
    dirty: q => {
      for (let i = 0; i < 10; i++) { q.fillStyle = `rgba(110,100,70,${0.05 + r() * 0.07})`; q.filter = M.blur(q, 6); q.beginPath(); q.ellipse(r() * CW, r() * CH, 20 + r() * 30, 10 + r() * 20, r() * 3, 0, TAU); q.fill(); }
      q.filter = 'none';
    } });
  const face = faceDisc(g, '#D8D3C0', 'hungry', { stitch: 'rgba(120,110,95,0.8)', tex: 0.85, wob: 0.006 });
  // faint grey bruising under the eyes and around the mouth corners
  g.save(); g.clip(M.pathOf(face));
  for (const [x, y, rx, ry, a] of [[FX - 31, FY - 6, 26, 12, 0.25], [FX + 31, FY - 6, 26, 12, 0.3], [FX - 74, FY + 22, 14, 18, 0.25], [FX + 74, FY + 22, 14, 18, 0.25]]) {
    const gg = g.createRadialGradient(x, y, 0, x, y, rx);
    gg.addColorStop(0, `rgba(95,90,80,${a})`); gg.addColorStop(1, 'rgba(95,90,80,0)');
    g.fillStyle = gg; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
  }
  g.restore();
  // realistic eyes: wide, sclera all round, pinpoint pupils, no catchlight, dead ahead
  for (const s of [-1, 1]) {
    M.humanEye(g, FX + s * 31, FY - 20, {
      w: 48 * (s > 0 ? 1.05 : 1), open: 0.8, irisR: 0.165, pupil: 0.12, irisColor: '#6A6F60', gaze: [-s * 0.04, 0.02], catchlight: false, wet: false,
      lashes: false, veins: 9, lower: 0.5, upper: 0.68, socketA: 0.4, socketColor: '#6a5a48', seed: 'hungry:eye' + s, lidLine: 'rgba(60,40,30,0.95)',
    });
  }
  // the grin: corners run almost to the edge of the face
  const mx = FX, my = FY + 26, hw = 80;
  const G = M.grinPts(mx, my, hw, 20, 29, 80);
  const mouth = M.pathOf(G.pts);
  g.save();
  M.shadow(g, 'rgba(40,0,0,0.35)', 2, 0, 1);
  g.fillStyle = '#4A1018'; g.fill(mouth); M.noShadow(g);
  g.clip(mouth);
  const ig = g.createLinearGradient(0, my - 10, 0, my + 40);
  ig.addColorStop(0, '#2A060C'); ig.addColorStop(0.5, '#5A1420'); ig.addColorStop(1, '#2A060C');
  g.fillStyle = ig; g.fillRect(mx - hw - 4, my - 30, hw * 2 + 8, 90);
  M.texFill(g, M.feltTex(512, 5), mouth, 'overlay', 0.5);
  // 24 identical small square teeth: 13 along the top, 11 along the bottom
  const upper = G.up.slice(6, G.up.length - 6), lowerRow = G.lo.slice(14, G.lo.length - 14);
  const T = 10.2;
  M.squareTeeth(g, upper, 13, T, { aspect: 1.0, color: '#FFFFFF', root: '#F1EEE6', tip: '#FBFBF6', gapColor: 'rgba(30,5,10,0.9)' });
  M.squareTeeth(g, lowerRow, 11, T, { aspect: 1.0, flip: false, color: '#FFFFFF', root: '#F1EEE6', tip: '#FBFBF6', gapColor: 'rgba(30,5,10,0.9)' });
  g.restore();
  // lips: thin dark painted line, corners pinched
  g.save(); g.strokeStyle = 'rgba(70,20,25,0.95)'; g.lineWidth = 1.6; g.lineJoin = 'round'; g.stroke(mouth);
  g.lineCap = 'round'; g.lineWidth = 1.4;
  for (const s of [-1, 1]) { const x = mx + s * hw, y = my; g.beginPath(); g.moveTo(x - s * 1, y - 1); g.quadraticCurveTo(x + s * 5, y - 3, x + s * 7, y - 7); g.stroke(); }
  g.restore();
  // word strip, then HUNGRY in marker: crooked, slightly too big
  wordStrip(g, 'hungry', '#F4F1E8');
  g.save();
  g.translate(FX + 3, 268); g.rotate(-6 * DEG);
  g.scale(0.86, 1);
  const marker = (dx, dy, col, wgt) => M.strokeText(g, 'tech', 'HUNGRY', dx, dy, 37, { align: 'center', color: col, weight: wgt, jitter: 0.01, rot: 6, bounce: 0.06, scaleJit: 0.08, track: 0.02, seed: 'hungrymk' });
  g.filter = M.blur(g, 0.7); marker(0.4, 0.6, 'rgba(10,10,20,0.35)', 0.19); g.filter = 'none';
  marker(0, 0, '#121018', 0.155);
  g.restore();
  M.grain(g, W, H, 0.03, 'hungry');
};

/* ---------------------------------------------------- FRIEND CARDS */
const PW = 320, PH = 360;
function friendFrame(g, colour, seed, bg) {
  const outer = M.scallopPts(18, 14, 284, 284, 9, 26);
  M.felt(g, outer, colour, { seed: seed + ':frame', rim: 1, shadow: { blur: 5, dx: 1.5, dy: 3.5, color: 'rgba(20,10,0,0.45)' }, tex: 0.6, fuzz: 0.35, light: 0.6,
    stitch: { inset: 11, color: 'rgba(255,255,255,0.85)', dash: 4.5, gap: 3.5, w: 1.3 } });
  g.save(); g.strokeStyle = rgba(shade(colour, -0.5), 0.8); g.lineWidth = 1.1; g.stroke(M.pathOf(outer)); g.restore();
  const inner = M.roundRectPts(46, 42, 228, 228, 26, 12);
  // recessed picture area
  g.save();
  g.fillStyle = bg[0]; g.fill(M.pathOf(inner));
  g.clip(M.pathOf(inner));
  const rg = g.createRadialGradient(160, 130, 10, 160, 156, 170);
  rg.addColorStop(0, bg[1]); rg.addColorStop(1, bg[0]);
  g.fillStyle = rg; g.fillRect(40, 36, 240, 240);
  M.texFill(g, M.feltTex(512, 7), M.pathOf(inner), 'overlay', 0.35);
  // inner shadow from the frame
  g.lineWidth = 14; g.strokeStyle = 'rgba(40,20,0,0.35)'; g.filter = M.blur(g, 5); g.translate(2, 3); g.stroke(M.pathOf(inner)); g.filter = 'none';
  g.restore();
  g.save(); g.strokeStyle = rgba(shade(colour, -0.45), 0.9); g.lineWidth = 1.2; g.stroke(M.pathOf(inner)); g.restore();
  return { outer, inner };
}
function nameBanner(g, text, colour, seed, size) {
  // ribbon: tails behind, then the main band with a gentle smile curve
  const dark = shade(colour, -0.3);
  const tail = s => {
    const x0 = 160 + s * 116, pts = [[x0, 292], [x0 + s * 50, 292], [x0 + s * 38, 312], [x0 + s * 50, 334], [x0, 334]];
    feltPiece(g, pts, dark, seed + ':tail' + s, { rim: 0.6, shadow: { blur: 3, dx: 1, dy: 2, color: 'rgba(0,0,0,0.4)' } });
  };
  tail(-1); tail(1);
  const top = [], bot = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24, x = lerp(26, 294, t), c = Math.sin(Math.PI * t) * 7; top.push([x, 282 + c]); bot.push([x, 324 + c]); }
  const band = top.concat(bot.reverse());
  feltPiece(g, band, colour, seed + ':band', { rim: 0.7, stitch: { inset: 4.5, color: 'rgba(255,255,255,0.75)', dash: 4, gap: 3, w: 1 } });
  return M.bubbleText(g, text, {
    x: 160, y: 318, size: size || 32, font: `900 ${size || 32}px Inter`, fill: '#FFFFFF', fill2: '#F1ECE0', outline: '#2A1A20', outlineW: 0.09, inflate: 0.05,
    arch: -4, track: 0.04, gloss: 0, innerShade: 0.12, softShadow: { color: 'rgba(0,0,0,0.4)', blur: 2, dx: 0, dy: 2 }, seed: 'banner:' + text,
  });
}
/* sewing-button eye */
function button(g, x, y, R, col, holes, seed) {
  g.save();
  M.shadow(g, 'rgba(20,10,0,0.55)', R * 0.25, R * 0.06, R * 0.12);
  const bg = g.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R);
  bg.addColorStop(0, shade(col, 0.35)); bg.addColorStop(0.6, col); bg.addColorStop(1, shade(col, -0.45));
  g.fillStyle = bg; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill(); M.noShadow(g);
  // raised rim and dish
  g.strokeStyle = rgba(shade(col, -0.5), 0.8); g.lineWidth = R * 0.08; g.beginPath(); g.arc(x, y, R * 0.97, 0, TAU); g.stroke();
  const dg = g.createRadialGradient(x + R * 0.1, y + R * 0.15, 0, x, y, R * 0.72);
  dg.addColorStop(0, rgba(shade(col, -0.25), 0.9)); dg.addColorStop(1, rgba(shade(col, 0.1), 0.4));
  g.fillStyle = dg; g.beginPath(); g.arc(x, y, R * 0.72, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = R * 0.06; g.beginPath(); g.arc(x, y, R * 0.74, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
  const hp = holes === 4 ? [[-1, -1], [1, -1], [1, 1], [-1, 1]] : [[-1, 0], [1, 0]];
  const hd = R * (holes === 4 ? 0.22 : 0.26);
  // thread through the holes
  g.strokeStyle = '#EDE6D2'; g.lineWidth = R * 0.11; g.lineCap = 'round';
  if (holes === 4) { g.beginPath(); g.moveTo(x - hd, y - hd); g.lineTo(x + hd, y + hd); g.moveTo(x + hd, y - hd); g.lineTo(x - hd, y + hd); g.stroke(); }
  else { g.beginPath(); g.moveTo(x - hd, y); g.lineTo(x + hd, y); g.stroke(); }
  for (const [hx, hy] of hp) { g.fillStyle = 'rgba(10,8,8,0.85)'; g.beginPath(); g.arc(x + hx * hd, y + hy * hd, R * 0.1, 0, TAU); g.fill(); }
  if (holes === 4) { g.strokeStyle = 'rgba(237,230,210,0.95)'; g.lineWidth = R * 0.09; g.beginPath(); g.moveTo(x - hd * 0.7, y - hd * 0.7); g.lineTo(x + hd * 0.7, y + hd * 0.7); g.moveTo(x + hd * 0.7, y - hd * 0.7); g.lineTo(x - hd * 0.7, y + hd * 0.7); g.stroke(); }
  // specular
  g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(x - R * 0.45, y - R * 0.5, R * 0.18, R * 0.1, -0.7, 0, TAU); g.fill();
  g.restore();
}
function plaid(q, bb) {
  q.fillStyle = '#C8352E'; q.fillRect(bb.x0 - 2, bb.y0 - 2, bb.w + 4, bb.h + 4);
  const st = 7;
  for (let x = bb.x0 - 20; x < bb.x1 + 20; x += st * 2) { q.fillStyle = 'rgba(30,70,40,0.55)'; q.fillRect(x, bb.y0 - 30, st * 0.9, bb.h + 60); }
  for (let y = bb.y0 - 20; y < bb.y1 + 20; y += st * 2) { q.fillStyle = 'rgba(30,70,40,0.45)'; q.fillRect(bb.x0 - 30, y, bb.w + 60, st * 0.9); }
  q.strokeStyle = 'rgba(250,230,160,0.8)'; q.lineWidth = 1;
  for (let x = bb.x0 - 20; x < bb.x1 + 20; x += st * 2) { q.beginPath(); q.moveTo(x + st * 1.45, bb.y0 - 30); q.lineTo(x + st * 1.45, bb.y1 + 30); q.stroke(); }
  for (let y = bb.y0 - 20; y < bb.y1 + 20; y += st * 2) { q.beginPath(); q.moveTo(bb.x0 - 30, y + st * 1.45); q.lineTo(bb.x1 + 30, y + st * 1.45); q.stroke(); }
}

MISC.friend_mr_buttons = function (g, W, H) {
  const fr = friendFrame(g, '#6EC1EE', 'mb', ['#FFF4D8', '#FFFDF2']);
  const brown = '#8E5A32';
  g.save(); g.clip(M.pathOf(fr.inner));
  // body / shoulders
  feltPiece(g, M.ellipsePts(160, 300, 100, 74, 0, 90), brown, 'mb:body', { rim: 0.9, stitch: { inset: 5, color: 'rgba(240,220,190,0.6)', dash: 4, gap: 3, w: 1 } });
  feltPiece(g, M.ellipsePts(160, 300, 52, 50, 0, 60), '#E9CFA6', 'mb:belly', { rim: 0.5 });
  // ears
  for (const s of [-1, 1]) {
    feltPiece(g, M.ellipsePts(160 + s * 60, 86, 30, 28, 0, 60), brown, 'mb:ear' + s, { rim: 0.9 });
    if (s > 0) {
      const patch = M.transformPts([[-15, -14], [15, -15], [16, 14], [-14, 15]], 160 + s * 62, 88, 0.25);
      feltPiece(g, M.splineClosed(patch, 6), '#C8352E', 'mb:patch', { rim: 0.4, paint: plaid, stitch: { inset: 2.5, color: '#2A1A10', dash: 2.6, gap: 2, w: 1.1 } });
    } else feltPiece(g, M.ellipsePts(160 + s * 60, 88, 16, 15, 0, 40), '#D9B488', 'mb:inner' + s, { rim: 0.5 });
  }
  // head
  feltPiece(g, M.wobble(M.ellipsePts(160, 152, 76, 70, 0, 120), 0.008, rng('mb:h')), brown, 'mb:head', { rim: 1, light: 0.7, stitch: { inset: 5, color: 'rgba(240,220,190,0.55)', dash: 4, gap: 3, w: 1 } });
  // muzzle
  feltPiece(g, M.ellipsePts(160, 184, 44, 32, 0, 72), '#F1DDBB', 'mb:muzzle', { rim: 0.6 });
  // nose
  feltPiece(g, M.splineClosed([[147, 166], [173, 166], [168, 177], [160, 182], [152, 177]], 8), '#3A2012', 'mb:nose', { light: 1, paint: q => { q.fillStyle = 'rgba(255,255,255,0.5)'; q.beginPath(); q.ellipse(155, 169, 4, 2, -0.2, 0, TAU); q.fill(); } });
  // stitched smile
  const stitchLine = (pts) => M.stitch(g, M.splineOpen(pts, 8), { open: true, color: '#3A2012', dash: 3.4, gap: 2.2, w: 1.7 }, 'mb:smile' + pts[0][0]);
  stitchLine([[160, 182], [160, 194]]);
  stitchLine([[136, 190], [146, 199], [160, 194], [174, 199], [184, 190]]);
  // mismatched button eyes
  button(g, 126, 136, 17, '#3E86D8', 4, 'mb:eb');
  button(g, 195, 138, 8.5, '#151214', 2, 'mb:es');
  // red bow tie
  const bx = 160, by = 238;
  for (const s of [-1, 1]) feltPiece(g, M.splineClosed([[bx + s * 6, by - 6], [bx + s * 36, by - 18], [bx + s * 42, by], [bx + s * 36, by + 18], [bx + s * 6, by + 6]], 8), '#D7262B', 'mb:bow' + s, { rim: 0.8, stitch: { inset: 3.5, color: 'rgba(255,220,220,0.7)', dash: 3, gap: 2.4, w: 0.9 } });
  feltPiece(g, M.roundRectPts(bx - 9, by - 10, 18, 20, 5, 4), '#B81C22', 'mb:knot', { rim: 0.6 });
  g.restore();
  nameBanner(g, 'MR. BUTTONS', '#E0362F', 'mb', 30);
};

function pomPom(g, x, y, R, col, seed) {
  const r = rng(seed + ':pom');
  g.save();
  M.shadow(g, 'rgba(0,0,0,0.35)', 2, 0.6, 1.2);
  g.fillStyle = col; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill(); M.noShadow(g);
  g.lineCap = 'round';
  for (let i = 0; i < 160; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * R, L = 1.5 + r() * 2.5, b = r() * TAU;
    g.strokeStyle = r() < 0.5 ? rgba(shade(col, 0.35), 0.6) : rgba(shade(col, -0.3), 0.5); g.lineWidth = 0.6 + r() * 0.5;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(b) * L, py + Math.sin(b) * L); g.stroke();
  }
  const hg = g.createRadialGradient(x - R * 0.4, y - R * 0.4, 0, x, y, R * 1.1);
  hg.addColorStop(0, 'rgba(255,255,255,0.35)'); hg.addColorStop(0.6, 'rgba(255,255,255,0)'); hg.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = hg; g.beginPath(); g.arc(x, y, R * 1.05, 0, TAU); g.fill();
  g.restore();
}
function pipeCleaner(g, pts, col, w, seed) {
  const r = rng(seed + ':pc');
  const sp = M.resample(M.splineOpen(pts, 12), 0.8, true);
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  M.shadow(g, 'rgba(0,0,0,0.35)', 2, 0.8, 1.2);
  g.strokeStyle = col; g.lineWidth = w * 0.7; g.beginPath(); sp.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
  M.noShadow(g);
  for (const p of sp) for (let k = 0; k < 3; k++) {
    const a = r() * TAU, L = w * (0.3 + r() * 0.35);
    g.strokeStyle = r() < 0.4 ? rgba(shade(col, 0.45), 0.7) : rgba(col, 0.9); g.lineWidth = 0.5;
    g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0] + Math.cos(a) * L, p[1] + Math.sin(a) * L); g.stroke();
  }
  g.restore();
}
MISC.friend_dot = function (g, W, H) {
  const fr = friendFrame(g, '#F59BC4', 'dot', ['#E8F6DA', '#FBFFF2']);
  g.save(); g.clip(M.pathOf(fr.inner));
  // the leaf she sits on
  const leaf = M.splineClosed([[40, 262], [90, 222], [170, 210], [250, 218], [300, 248], [250, 276], [160, 290], [80, 284]], 10);
  feltPiece(g, leaf, '#4E9F3D', 'dot:leaf', { rim: 0.9, paint: q => { q.strokeStyle = 'rgba(30,80,20,0.6)'; q.lineWidth = 2; q.beginPath(); q.moveTo(50, 258); q.quadraticCurveTo(170, 238, 295, 248); q.stroke(); for (let i = 0; i < 6; i++) { const x = 80 + i * 36; q.lineWidth = 1.2; q.beginPath(); q.moveTo(x, 252 - i * 1.5); q.lineTo(x + 18, 230); q.moveTo(x, 252 - i * 1.5); q.lineTo(x + 16, 274); q.stroke(); } } });
  // little legs
  for (const [x, a] of [[112, 0.5], [130, 0.2], [190, -0.2], [208, -0.5]]) feltStrip(g, [[x, 236], [x - a * 12, 252], [x - a * 18, 258]], 6, '#1A1618', 'dot:leg' + x);
  // body
  const bx = 160, by = 182, BR = 76;
  feltPiece(g, M.ellipsePts(bx, by, BR, BR * 0.94, 0, 140), '#E0262E', 'dot:body', { rim: 1, light: 0.8,
    paint: q => {
      q.strokeStyle = 'rgba(40,0,0,0.8)'; q.lineWidth = 3; q.beginPath(); q.moveTo(bx, by - BR); q.lineTo(bx, by + BR); q.stroke();
    } });
  for (const [x, y, rr] of [[-42, 6, 14], [42, 4, 14], [-30, 44, 12], [30, 46, 12], [-58, -28, 9], [58, -30, 9], [0, 62, 8]]) feltPiece(g, M.wobble(M.ellipsePts(bx + x, by + y, rr, rr * 0.92, 0, 40), 0.04, rng('dot' + x + y)), '#141114', 'dot:spot' + x + y, { rim: 0.5, light: 0.8, line: false });
  // head
  const hx = 160, hy = 124, HR = 52;
  feltPiece(g, M.ellipsePts(hx, hy, HR, HR * 0.9, 0, 100), '#1A1618', 'dot:head', { rim: 0.8, light: 1, stitch: { inset: 4, color: 'rgba(255,255,255,0.35)', dash: 3.5, gap: 3, w: 0.9 } });
  // antennae with pom-poms
  pipeCleaner(g, [[hx - 16, hy - 42], [hx - 22, hy - 54], [hx - 38, hy - 62], [hx - 46, hy - 54], [hx - 38, hy - 46], [hx - 32, hy - 54], [hx - 44, hy - 66]], '#1A1618', 6, 'dot:al');
  pipeCleaner(g, [[hx + 16, hy - 42], [hx + 22, hy - 54], [hx + 38, hy - 62], [hx + 46, hy - 54], [hx + 38, hy - 46], [hx + 32, hy - 54], [hx + 44, hy - 66]], '#1A1618', 6, 'dot:ar');
  pomPom(g, hx - 46, hy - 70, 11, '#FF6FA8', 'dot:pl');
  pomPom(g, hx + 46, hy - 70, 11, '#FFD23A', 'dot:pr');
  // big friendly eyes
  for (const s of [-1, 1]) {
    feltPiece(g, M.ellipsePts(hx + s * 20, hy - 8, 16, 20, 0, 48), '#FFFFFF', 'dot:ew' + s, { light: 0.4 });
    feltEye(g, hx + s * 18, hy - 4, 9, 11, 'dot:ep' + s);
  }
  // rosy cheeks and a stitched smile
  for (const s of [-1, 1]) feltPiece(g, M.ellipsePts(hx + s * 34, hy + 18, 10, 7.5, 0, 30), '#FF7FA8', 'dot:ck' + s, { line: false, rim: 0.4 });
  M.stitch(g, M.splineOpen([[hx - 16, hy + 18], [hx, hy + 28], [hx + 16, hy + 18]], 8), { open: true, color: '#FFFFFF', dash: 3.2, gap: 2, w: 1.8 }, 'dot:sm');
  g.restore();
  nameBanner(g, 'DOT', '#3C8FE0', 'dot', 36);
};

/* Pip, scribbled out */
function pipPortrait(g) {
  const fr = friendFrame(g, '#F7CF2F', 'pip', ['#E6F2FB', '#FAFDFF']);
  g.save(); g.clip(M.pathOf(fr.inner));
  // twig perch
  feltStrip(g, [[40, 246], [120, 238], [200, 242], [290, 236]], 12, '#8A5A34', 'pip:twig');
  const bx = 160, by = 168, BR = 70, blue = '#78C3EE';
  // tail feathers behind
  for (const a of [0.35, 0.6, 0.85]) feltPiece(g, M.petalPts(bx + 40, by + 40, a, 0, 54, 12, { tipRound: 0.6 }), shade(blue, -0.15), 'pip:tail' + a, { rim: 0.6 });
  feltPiece(g, M.ellipsePts(bx, by, BR, BR * 0.95, 0, 120), blue, 'pip:body', { rim: 1, light: 0.8, stitch: { inset: 5, color: 'rgba(255,255,255,0.75)', dash: 4, gap: 3, w: 1 } });
  feltPiece(g, M.ellipsePts(bx, by + 30, 44, 34, 0, 60), '#D8F0FF', 'pip:belly', { rim: 0.5 });
  // wings
  for (const s of [-1, 1]) feltPiece(g, M.petalPts(bx + s * 56, by + 10, Math.PI / 2 + s * 0.5, 0, 46, 16, { tipRound: 0.4 }), shade(blue, -0.1), 'pip:wing' + s, { rim: 0.7 });
  // feather tuft
  for (const [a, l] of [[-1.9, 34], [-1.57, 40], [-1.25, 32]]) feltPiece(g, M.petalPts(bx, by - BR + 8, a, 0, l, 8, { tipRound: 0.5 }), shade(blue, -0.05), 'pip:tuft' + a, { rim: 0.6 });
  // eyes, beak, feet
  for (const s of [-1, 1]) feltEye(g, bx + s * 24, by - 16, 9, 11, 'pip:e' + s);
  feltPiece(g, M.splineClosed([[bx - 13, by + 2], [bx + 13, by + 2], [bx, by + 22]], 6), '#F59A1E', 'pip:beak', { rim: 0.6, light: 0.8 });
  for (const s of [-1, 1]) feltPiece(g, M.ellipsePts(bx + s * 40, by + 10, 9, 6.5, 0, 30), '#FF9AB8', 'pip:ck' + s, { line: false, rim: 0.4 });
  for (const s of [-1, 1]) feltStrip(g, [[bx + s * 18, by + 64], [bx + s * 20, by + 76], [bx + s * 14, by + 82]], 5, '#F59A1E', 'pip:foot' + s);
  g.restore();
  nameBanner(g, 'PIP', '#3C8FE0', 'pip', 38);
  return fr;
}
MISC.friend_pip_scribbled = function (g, W, H) {
  const s = M.scaleOf(g);
  // 1. the clean card on its own layer
  const C = M.layerLike(g);
  pipPortrait(C.g);
  // 2. crease folds (light ridge + dark valley + a shading shift on one side)
  const folds = [[[-10, 132], [334, 196]], [[214, -10], [178, 372]]];
  for (const [[x0, y0], [x1, y1]] of folds) {
    const q = C.g; q.save(); q.globalCompositeOperation = 'source-atop';
    const nx = -(y1 - y0), ny = x1 - x0, L = Math.hypot(nx, ny);
    const gr = q.createLinearGradient(lerp(x0, x1, 0.5), lerp(y0, y1, 0.5), lerp(x0, x1, 0.5) + nx / L * 60, lerp(y0, y1, 0.5) + ny / L * 60);
    gr.addColorStop(0, 'rgba(0,0,0,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    q.fillStyle = gr; q.fillRect(-20, -20, 380, 420);
    const r = rng('fold' + x0);
    const line = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20; line.push([lerp(x0, x1, t) + (r() - 0.5) * 1.5, lerp(y0, y1, t) + (r() - 0.5) * 1.5]); }
    const strokeL = (col, w, dx, dy) => { q.strokeStyle = col; q.lineWidth = w; q.beginPath(); line.forEach((p, i) => i ? q.lineTo(p[0] + dx, p[1] + dy) : q.moveTo(p[0] + dx, p[1] + dy)); q.stroke(); };
    q.filter = M.blur(q, 1); strokeL('rgba(0,0,0,0.35)', 3, 1, 1); q.filter = 'none';
    strokeL('rgba(255,255,255,0.55)', 1.2, -0.8, -0.6);
    strokeL('rgba(40,20,10,0.45)', 0.8, 0.6, 0.6);
    // tiny cracks in the felt/paint along the fold
    for (let i = 0; i < 26; i++) { const t = r(), x = lerp(x0, x1, t), y = lerp(y0, y1, t); q.strokeStyle = 'rgba(255,255,255,0.5)'; q.lineWidth = 0.6; q.beginPath(); q.moveTo(x, y); q.lineTo(x + (r() - 0.5) * 6, y + (r() - 0.5) * 6); q.stroke(); }
    q.restore();
  }
  // 3. heavy black crayon scribble: loops piled over the face, overrunning the frame
  const r = rng('pip:scribble');
  const K = M.crayonLayer(C.g);
  K.g.lineCap = 'round';
  const loops = (cx, cy, rx, ry, n, w, turns, wob) => {
    const pts = [];
    let a = r() * TAU;
    for (let i = 0; i < n * turns; i++) {
      a += TAU / n * (0.85 + r() * 0.3);
      const k = 0.75 + r() * 0.45;
      pts.push([cx + Math.cos(a) * rx * k + (r() - 0.5) * wob, cy + Math.sin(a) * ry * k + (r() - 0.5) * wob]);
      cx += (r() - 0.5) * 7; cy += (r() - 0.5) * 6;
    }
    M.crayonStroke(K.g, pts, '#0b0a0c', w, r, { passes: 5, alpha: 0.75, jitter: 1.6 });
  };
  loops(160, 162, 64, 52, 9, 10, 9, 18);      // the face: buried
  loops(150, 150, 90, 70, 8, 8.5, 6, 30);
  loops(176, 178, 74, 64, 7, 9, 6, 26);
  loops(160, 160, 140, 120, 6, 7.5, 4, 40);   // big loops overrunning the frame
  // violent zig-zag slashes
  for (let k = 0; k < 4; k++) {
    const pts = []; let x = 20 + r() * 40, y = 40 + k * 55 + r() * 20;
    for (let i = 0; i < 8; i++) { pts.push([x, y]); x += 18 + r() * 40; y += (i % 2 ? -1 : 1) * (25 + r() * 70); }
    M.crayonStroke(K.g, pts, '#0b0a0c', 5, r, { passes: 4, alpha: 0.7, jitter: 1.4, straight: true });
  }
  // a dense filled patch right on the face so nothing of it reads (own layer, less paper tooth)
  const K2 = M.crayonLayer(C.g);
  for (const [ang, st] of [[-0.6, 3.4], [0.75, 3.8], [1.5, 4.2]]) M.crayonFill(K2.g, M.wobble(M.ellipsePts(158, 160, 58, 52, 0, 60), 0.12, r), '#0b0a0c', 9, r, { angle: ang, step: st, passes: 2, alpha: 0.8 });
  loops(158, 158, 52, 46, 7, 12, 7, 14);
  K2.g.save(); K2.g.setTransform(1, 0, 0, 1, 0, 0); K2.g.globalCompositeOperation = 'destination-in'; K2.g.drawImage(C.c, 0, 0); K2.g.restore();
  M.finishCrayon(C.g, K2, { density: 0.6, op: 'source-over', alpha: 1, seed: 6 });
  // keep the crayon on the card (and off the banner text mostly)
  K.g.save(); K.g.setTransform(1, 0, 0, 1, 0, 0); K.g.globalCompositeOperation = 'destination-in'; K.g.drawImage(C.c, 0, 0); K.g.restore();
  K.g.save(); K.g.globalCompositeOperation = 'destination-out';
  K.g.fillStyle = 'rgba(0,0,0,0.85)'; K.g.beginPath(); K.g.roundRect(108, 290, 104, 34, 6); K.g.fill();
  K.g.restore();
  // waxy: tooth punched, multiplied, then a sheen pass
  M.finishCrayon(C.g, K, { density: 0.5, op: 'source-over', alpha: 0.97, seed: 4 });
  // 4. torn-off corner (top right) with a fibrous white edge
  const tear = [[206, -5]];
  let tx = 206, ty = -5;
  const tr2 = rng('pip:tear');
  while (tx < 330) { tx += 4 + tr2() * 6; ty += 3.5 + tr2() * 5 + (tr2() - 0.5) * 5; tear.push([tx, ty]); }
  const tearPath = new Path2D();
  tearPath.moveTo(206, -10); tear.forEach(p => tearPath.lineTo(p[0], p[1])); tearPath.lineTo(340, ty); tearPath.lineTo(340, -10); tearPath.closePath();
  // fibrous edge: white card core showing along the tear
  C.g.save();
  C.g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < tear.length - 1; i++) {
    const [x0, y0] = tear[i], [x1, y1] = tear[i + 1];
    C.g.strokeStyle = 'rgba(250,246,234,0.95)'; C.g.lineWidth = 5 + tr2() * 3;
    C.g.beginPath(); C.g.moveTo(x0 - 2, y0 + 2); C.g.lineTo(x1 - 2, y1 + 2); C.g.stroke();
  }
  for (let i = 0; i < 160; i++) {
    const t = tr2() * (tear.length - 1), k = Math.floor(t), u = t - k;
    const x = lerp(tear[k][0], tear[k + 1][0], u), y = lerp(tear[k][1], tear[k + 1][1], u);
    C.g.strokeStyle = 'rgba(255,252,240,0.9)'; C.g.lineWidth = 0.6;
    C.g.beginPath(); C.g.moveTo(x, y); C.g.lineTo(x + (tr2() - 0.2) * 5, y - (tr2() - 0.2) * 5); C.g.stroke();
  }
  C.g.restore();
  C.g.save(); C.g.globalCompositeOperation = 'destination-out'; C.g.fill(tearPath); C.g.restore();
  M.drawLayer(g, C);
  void s;
};
LIB.pipPortrait = pipPortrait;
})(typeof window !== 'undefined' ? window : globalThis);
