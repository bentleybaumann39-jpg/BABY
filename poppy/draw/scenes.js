/* scenes.js - per-asset presets for THE WORLD OF POPPY (uses poppy.js).
 * Poppy.ASSETS[basename](canvas) draws that manifest file on a canvas that the
 * runner has already sized from assets.json. */
(function (root) {
'use strict';
const P = root.Poppy;
const { drawPoppy } = P;

/* Stage 1 (normal, always slightly off): matched catchlights, left eye 7%
 * bigger and higher, one pupil drifted outward, 12-degree held tilt. */
const STAGE1 = { tilt: 12, eyes: 'button', mouth: 'smile', seed: 7 };
/* Stage 2b wrong body (dark playroom) */
const WRONG = {
  tilt: 25, eyes: 'black', mouth: 'grinClosed', seed: 7, decay: 0.6, missing: [1],
  stretch: { neck: 1.25, arms: 1.32, fingers: 1.6 }, spread: 12,
  head: { eyeW: 0.22, smileW: 0.74, teeth: 20, smileD: 0.13, mouthY: 0.36, eyeAspect: 1.12 },
};

const A = {};
const full = (o) => (c) => drawPoppy(c.getContext('2d'), Object.assign({}, STAGE1, o));

A.poppy_idle = full({});
A.poppy_talk = full({ mouth: 'open' });
A.poppy_blink = full({ head: { eyeClosed: [true, true] } });
A.poppy_wave_a = full({ pose: 'wave', mouth: 'open', waveTilt: -22 });
A.poppy_wave_b = full({ pose: 'wave', mouth: 'open', waveTilt: 16 });
A.poppy_point = full({ pose: 'point' });
A.poppy_point_talk = full({ pose: 'point', mouth: 'open' });

const close = (o) => (c) => drawPoppy(c.getContext('2d'), Object.assign({}, STAGE1, { pose: 'close', px: 1.875 }, o));
A.poppy_close = close({ head: { gaze: { x: -0.09, y: 0.02 } } });
A.poppy_close_talk = close({ mouth: 'open', head: { gaze: { x: -0.09, y: 0.02 } } });
A.poppy_close_wink = close({ head: { gaze: { x: -0.09, y: 0.02 }, eyeClosed: [false, true] } });
A.poppy_close_stare = close({
  tilt: 25, eyes: 'real', mouth: 'grin',
  head: { eyeW: 0.22, eyeSep: 0.37, eyeY: -0.1, asym: false, smileW: 0.72, teeth: 19, smileD: 0.15, mouthY: 0.33,
    cheekX: 0.66, cheekY: 0.15, cheekR: 0.78,
    gaze: { x: -0.07, y: 0.01 }, real: { pupil: 0.14, iris: 0.175, open: 0.9, lower: 0.46, crease: 0.28, socket: 0.3, bags: 0.2, wetLine: true, outline: '#6A3A30', outlineW: 0.6 } },
});

A.poppy_wrong_idle = full(WRONG);
A.poppy_cover_eyes = full(Object.assign({}, WRONG, { pose: 'cover', eyes: 'real',
  head: Object.assign({}, WRONG.head, { eyeW: 0.22, gaze: { x: 0, y: 0 },
    real: { pupil: 0.1, iris: 0.19, open: 0.86, lower: 0.46, socket: 0.5, bags: 0.35, crease: 0.35, lashW: 1.2, wetLine: true, veins: 7 } }),
  gloveScale: 1.5, peekT: 24 }));

/* ------------------------------------------------------------ costume */
A.costume_slumped = (c) => drawPoppy(c.getContext('2d'), { pose: 'slumped', seed: 7, decay: 0.25, px: 0.85, light: { x: -0.3, y: -0.95 } });
A.costume_standing = (c) => drawPoppy(c.getContext('2d'), {
  seed: 7, tilt: 20, eyes: 'hollow', mouth: 'smile', decay: 0.3, limp: true, px: 1,
  head: { meshColor: 'rgba(128,124,116,0.82)', meshSheen: 0.3, meshStep: 0.05 },
  stretch: { arms: 1.36, fingers: 1.45 }, spread: 2,
  transform: [0.9, 0, 0, 0.9, 120 - 210 * 0.9, 630 - 628 * 0.9],
});

/* ------------------------------------------------------------ helpers */
const { mk, ident } = P;
function copyCanvas(c) { const o = mk(c.width, c.height); o.getContext('2d').drawImage(c, 0, 0); return o; }
/* barrel "wide-angle bulge": centre magnified */
function bulge(c, k) {
  const W = c.width, H = c.height, g = c.getContext('2d');
  const src = g.getImageData(0, 0, W, H), dst = g.createImageData(W, H);
  const cx = W / 2, cy = H / 2, R = Math.hypot(cx, cy);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - cx) / R, dy = (y - cy) / R, r2 = dx * dx + dy * dy;
    const f = 1 - k + k * r2 * 1.3;            // sample closer to centre near the middle
    let sx = cx + dx * f * R, sy = cy + dy * f * R;
    sx = Math.max(0, Math.min(W - 1.001, sx)); sy = Math.max(0, Math.min(H - 1.001, sy));
    const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0, i = (y * W + x) * 4;
    for (let ch = 0; ch < 4; ch++) {
      const a = src.data[(y0 * W + x0) * 4 + ch], b = src.data[(y0 * W + x0 + 1) * 4 + ch];
      const cc = src.data[((y0 + 1) * W + x0) * 4 + ch], d = src.data[((y0 + 1) * W + x0 + 1) * 4 + ch];
      dst.data[i + ch] = (a * (1 - fx) + b * fx) * (1 - fy) + (cc * (1 - fx) + d * fx) * fy;
    }
  }
  g.putImageData(dst, 0, 0);
}
/* blur that grows toward the frame edges (centre stays sharp) */
function edgeBlur(c, px, inner, zoom) {
  const W = c.width, H = c.height, g = c.getContext('2d');
  const b = mk(W, H), bg = b.getContext('2d');
  if (zoom) {      // radial zoom blur (lunge toward the lens)
    const n = 12;
    for (let i = 0; i < n; i++) { const s = 1 + zoom * i / n; bg.globalAlpha = 1 / (i + 1); bg.drawImage(c, W / 2 - W * s / 2, H / 2 - H * s / 2, W * s, H * s); }
    bg.globalAlpha = 1;
  } else { bg.filter = `blur(${px}px)`; bg.drawImage(c, 0, 0); }
  const m = mk(W, H), mg = m.getContext('2d');
  const rg = mg.createRadialGradient(W / 2, H / 2, Math.min(W, H) * inner, W / 2, H / 2, Math.hypot(W, H) / 2);
  rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,1)');
  mg.fillStyle = rg; mg.fillRect(0, 0, W, H);
  mg.globalCompositeOperation = 'source-in'; mg.drawImage(b, 0, 0);
  g.drawImage(m, 0, 0);
}
function vignette(g, W, H, a, inner, color) {
  const rg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * (inner || 0.3), W / 2, H / 2, Math.hypot(W, H) / 2);
  rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, color || `rgba(0,0,0,${a})`);
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
}
function grain(g, W, H, amt, seed) {
  const id = g.getImageData(0, 0, W, H), d = id.data, r = P.mulberry32(seed || 5);
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
}
function unsharp(c, amt) {
  const g = c.getContext('2d'), W = c.width, H = c.height;
  const b = mk(W, H), bg = b.getContext('2d'); bg.filter = 'blur(1.2px)'; bg.drawImage(c, 0, 0);
  const s = g.getImageData(0, 0, W, H), bl = bg.getImageData(0, 0, W, H);
  for (let i = 0; i < s.data.length; i += 4) for (let ch = 0; ch < 3; ch++) s.data[i + ch] = s.data[i + ch] + amt * (s.data[i + ch] - bl.data[i + ch]);
  g.putImageData(s, 0, 0);
}

/* spherical form shading: light falls off from (x, y) toward the face edges */
function sphereShade(lg, w, h, x, y, r0, r1, edge) {
  const gr = lg.createRadialGradient(x, y, r0, x, y, r1);
  gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(0.55, '#C8C8C8'); gr.addColorStop(1, edge || '#101010');
  lg.fillStyle = gr; lg.fillRect(0, 0, w, h);
}
function contrast(c, k, pivot, lift) {
  const g = c.getContext('2d'), id = g.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) for (let ch = 0; ch < 3; ch++) d[i + ch] = (d[i + ch] - pivot) * k + pivot + (lift || 0);
  g.putImageData(id, 0, 0);
}
/* vertical light ramp in screen space: stops = [[y, color], ...] */
function ramp(lg, w, h, stops, x0, x1) {
  const gr = lg.createLinearGradient(x0 || 0, stops[0][0], x1 || 0, stops[stops.length - 1][0]);
  const a = stops[0][0], b = stops[stops.length - 1][0];
  for (const [y, col] of stops) gr.addColorStop((y - a) / (b - a), col);
  lg.fillStyle = gr; lg.fillRect(0, 0, w, h);
}

/* ------------------------------------------------------- JUMP SCARE 1
 * The empty costume head lunging into the lens, lit flat and hard by the
 * camcorder's on-camera light: crumpled felt, petal ring crushed on one side,
 * Poppy's painted smile torn open into a dark hole, and deep inside each grey mesh eye hole a
 * glinting real eye with a pinpoint pupil staring dead centre. */
A.poppy_scare_costume = (c) => {
  const W = c.width, H = c.height, g = c.getContext('2d');
  const cx = 398, cy = 300, R = 236, SY = 1.06, TILT = -9;
  // corridor wall right behind, catching the fall-off of the on-camera light
  const wg = g.createRadialGradient(W * 0.5, H * 0.45, 40, W * 0.5, H * 0.5, W * 0.7);
  wg.addColorStop(0, '#4A463E'); wg.addColorStop(0.5, '#24221E'); wg.addColorStop(1, '#050505');
  g.fillStyle = wg; g.fillRect(0, 0, W, H);
  const opts = {
    pose: 'head', cx, cy, R, px: 3.0, texScale: 2.5, seed: 13, castK: 0.9,
    tilt: TILT, eyes: 'hollow', mouth: 'torn', decay: 0.3, light: { x: -0.15, y: -0.45 },
    head: {
      sy: SY, crumple: 1.15, eyeW: 0.25, eyeSep: 0.4, eyeY: -0.15, eyeAspect: 1.22, asym: true,
      deepEyes: true, deepSize: 0.58, deepOpen: 0.5, deepBright: true, deepPupil: 0.03, deepSkin: 0.3, deepLid: 0.85,
      deepOff: [[0.04, 0.06], [-0.03, 0.05]], meshStep: 0.034, meshColor: 'rgba(150,146,136,0.62)', meshSheen: 0.28,
      crush: [{ angle: -0.25, amount: 0.34, squeeze: 0.5 }], petalR: 1.45,
      smileW: 0.62, smileD: 0.2, mouthY: 0.36, tornOpen: 0.1, tornSag: 1.7,
      noseY: 0.14, noCheeks: true, noSeam: true, fuzz: 140, faceAO: 0.32, jaw: 0.12,
    },
  };
  const lightFx = (lg, mask, w, h) => {
    lg.save(); lg.globalCompositeOperation = 'multiply';
    const fl = lg.createRadialGradient(w * 0.47, h * 0.4, 20, w * 0.5, h * 0.52, w * 0.6);
    fl.addColorStop(0, '#FFFFFF'); fl.addColorStop(0.42, '#EAE4D8'); fl.addColorStop(0.75, '#6E665A'); fl.addColorStop(1, '#1E1C18');
    lg.fillStyle = fl; lg.fillRect(0, 0, w, h);
    lg.globalCompositeOperation = 'screen';      // the hot spot blows the felt out
    const hs = lg.createRadialGradient(w * 0.45, h * 0.36, 10, w * 0.46, h * 0.4, w * 0.3);
    hs.addColorStop(0, 'rgba(255,252,242,0.6)'); hs.addColorStop(1, 'rgba(255,252,242,0)');
    lg.fillStyle = hs; lg.fillRect(0, 0, w, h);
    lg.restore();
  };
  const { U, F, info } = litTwice(W, H, opts, lightFx);
  // the eyes inside keep their own light (they glint at the lens)
  const holes = info.eyes.E.map(e => P.ellipse(e.cx, e.cy, e.w / 2 * 1.04, e.h / 2 * 1.02));
  pasteFeature(F, U, info.T, holes, 0.85, null, 0);
  // hard shadow of the head on the wall just behind (light is at the lens)
  const sh = mk(W, H), sg = sh.getContext('2d'); sg.drawImage(F, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#000'; sg.fillRect(0, 0, W, H);
  g.save(); g.filter = 'blur(1.2px)'; g.globalAlpha = 0.9; g.drawImage(sh, 26, 30); g.restore();
  g.drawImage(F, 0, 0);
  contrast(c, 1.3, 105, 2);
  unsharp(c, 0.8);
  edgeBlur(c, 0, 0.4, 0.07);
  vignette(g, W, H, 0.55, 0.48);
  grain(g, W, H, 9, 3);
};

/* ------------------------------------------------------- JUMP SCARE 2
 * Stage 3 face pushed through the closet gap, underlit by a nightlight:
 * face ~75% of the frame height, stretched 12% vertically, realistic wide
 * eyes (27% HW, sclera all round, 8% pinpoint pupils) dead centre, a smile
 * 30% wider than Stage 2 packed with 22 identical square teeth, petals
 * crushed by the painted door edges at the left and right. */
/* draw the same figure twice (lit / unlit) and paste the unlit eyes and teeth
 * back over the lit one, so they glow out of the darkness. */
function litTwice(W, H, opts, lightFx) {
  const U = mk(W, H), F = mk(W, H);
  const info = drawPoppy(U.getContext('2d'), Object.assign({}, opts));
  drawPoppy(F.getContext('2d'), Object.assign({}, opts, { lightFx }));
  return { U, F, info };
}
function pasteFeature(F, U, T, paths, alpha, tint, feather) {
  const W = F.width, H = F.height;
  const M = mk(W, H), mg = M.getContext('2d');           // feature mask (optionally feathered)
  mg.setTransform(T); mg.fillStyle = '#000'; for (const p of paths) mg.fill(p);
  let Mask = M;
  if (feather) { Mask = mk(W, H); const m2 = Mask.getContext('2d'); m2.filter = `blur(${feather}px)`; m2.drawImage(M, 0, 0); }
  const L = mk(W, H), lg = L.getContext('2d');
  lg.drawImage(U, 0, 0);
  if (tint) { lg.globalCompositeOperation = 'multiply'; lg.fillStyle = tint; lg.fillRect(0, 0, W, H); }
  lg.globalCompositeOperation = 'destination-in'; lg.drawImage(U, 0, 0); lg.drawImage(Mask, 0, 0);
  const fg = F.getContext('2d'); fg.save(); fg.globalAlpha = alpha; fg.drawImage(L, 0, 0); fg.restore();
}

/* post-lighting gloss on flat black button eyes (screen space, clipped):
 * a soft highlight toward the key light and a thin reflection of the rim
 * light.  Soft-edged, so there is still no point catchlight. */
function glossEyes(F, T, E, o) {
  const g = F.getContext('2d');
  for (const e of E) {
    g.save(); g.setTransform(T);
    const rx = e.w / 2, ry = e.h / 2 * 0.92;
    g.beginPath(); g.ellipse(e.cx, e.cy, rx, ry, 0, 0, Math.PI * 2); g.clip();
    g.globalCompositeOperation = 'screen';
    for (const s of o.spots) {
      const a = Math.atan2(s.dy, s.dx) - o.tilt * Math.PI / 180;
      const x = e.cx + Math.cos(a) * rx * s.d, y = e.cy + Math.sin(a) * ry * s.d;
      const gr = g.createRadialGradient(x, y, 0, x, y, rx * s.r);
      gr.addColorStop(0, s.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2); g.scale(1, s.squash || 0.45); g.translate(-x, -y);
      g.fillStyle = gr; g.fillRect(x - rx * 2, y - rx * 2, rx * 4, rx * 4); g.restore();
    }
    if (o.rim) {
      const a = Math.atan2(o.rim.dy, o.rim.dx) - o.tilt * Math.PI / 180;
      g.strokeStyle = o.rim.color; g.lineWidth = rx * 0.05; g.filter = 'blur(1px)';
      g.beginPath(); g.ellipse(e.cx, e.cy, rx * 0.9, ry * 0.9, 0, a - 0.5, a + 0.5); g.stroke();
    }
    g.restore();
  }
}

A.poppy_scare_closet = (c) => {
  const W = c.width, H = c.height, g = c.getContext('2d');
  const cx = 400, cy = 296, R = 200, SY = 1.12, TILT = 4;
  // black closet interior: a rail of hanging clothes barely touched by the nightlight
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.save(); g.filter = 'blur(6px)';
  const r = P.mulberry32(77);
  for (let i = 0; i < 9; i++) {
    const x = 120 + i * 70 + r() * 30, w = 50 + r() * 40, top = 20 + r() * 30;
    const cg = g.createLinearGradient(0, top, 0, H); cg.addColorStop(0, 'rgba(14,18,28,0)'); cg.addColorStop(0.7, 'rgba(22,28,44,0.55)'); cg.addColorStop(1, 'rgba(40,52,78,0.8)');
    g.fillStyle = cg; g.beginPath(); g.moveTo(x, top); g.lineTo(x + w, top + 8); g.lineTo(x + w + 12, H); g.lineTo(x - 10, H); g.closePath(); g.fill();
  }
  g.restore();
  const opts = {
    pose: 'head', cx, cy, R, px: 2.6, texScale: 2.2, seed: 7, castK: 3.0,
    tilt: TILT, eyes: 'real', mouth: 'grin', light: { x: 0.0, y: 1 }, decay: 0.15,
    head: {
      sy: SY, eyeW: 0.27, eyeSep: 0.4, eyeY: -0.2, asym: false, gaze: { x: 0, y: 0 }, noCheeks: true, noSeam: true,
      real: { pupil: 0.08, iris: 0.175, open: 0.96, lower: 0.5, socket: 0.55, bags: 0.45, crease: 0.4, lashCap: 2, lashW: 1.3, lashes: false, outline: '#5A2C24', outlineW: 0.5,
        wetLine: true, veins: 14, lidShadow: 0.15, irisColor: ['#CBD3CF', '#8A9C99', '#33474A'] },
      smileW: 0.94, teeth: 22, smileD: 0.27, mouthY: 0.2, grinFill: true, grinOpen: 1.12, lipColor: '#2A0508', lipW: 2.4,
      fuzz: 120, humanFolds: 1.0, faceAO: 0.5, faceAOBlur: 24, faceOutline: '#2A1C14',
      crush: [{ angle: 0, amount: 0.45, squeeze: 0.55 }, { angle: Math.PI, amount: 0.45, squeeze: 0.55 }], petalR: 1.6,
    },
  };
  const lightFx = (lg, mask, w, h) => {
    lg.save(); lg.globalCompositeOperation = 'multiply';
    // nightlight from below: bright chin, the brow falling into darkness
    ramp(lg, w, h, [[cy + 1.15 * R * SY, '#EEF4FF'], [cy + 0.55 * R * SY, '#C4D0E8'], [cy + 0.05 * R, '#8494B6'], [cy - 0.4 * R * SY, '#4C5876'], [cy - 0.85 * R * SY, '#262E42'], [cy - 1.4 * R * SY, '#0A0C12']]);
    sphereShade(lg, w, h, cx, cy + 0.35 * R, R * 0.5, R * 2.1, '#2A3040');
    lg.restore();
  };
  const { U, F, info } = litTwice(W, H, opts, lightFx);
  const T = info.T;
  // eyes and teeth catch the light and glow
  pasteFeature(F, U, T, info.eyes.real.map(e => e.ap), 0.9, '#D4DEEE', 0.6);
  if (info.mouth) pasteFeature(F, U, T, [info.mouth], 0.8, '#C8D4EA', 0.6);
  g.drawImage(F, 0, 0);
  // painted closet doors pressing in from both sides (crushing the petals)
  for (const side of [-1, 1]) {
    const edge = side < 0 ? 172 : W - 172;
    // shadow the doors cast onto the petals
    const sh = g.createLinearGradient(edge, 0, edge - side * 34, 0);
    sh.addColorStop(0, 'rgba(0,0,0,0.85)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh; g.fillRect(Math.min(edge, edge - side * 34), 0, 34, H);
    // door face
    const x0 = side < 0 ? 0 : edge, x1 = side < 0 ? edge : W;
    const dg = g.createLinearGradient(0, 0, 0, H);
    dg.addColorStop(0, '#05060A'); dg.addColorStop(0.55, '#0E121C'); dg.addColorStop(1, '#232C40');
    g.fillStyle = dg; g.fillRect(x0, 0, x1 - x0, H);
    // a recessed panel line + paint texture
    g.strokeStyle = 'rgba(70,86,120,0.25)'; g.lineWidth = 2;
    const px0 = side < 0 ? 30 : edge + 38, pw = 172 - 68;
    g.strokeRect(px0, 60, pw, 600);
    // door thickness at the gap: a lit bevel strip (nightlight from below)
    const bw = 14, bx = side < 0 ? edge - bw : edge;
    const bg = g.createLinearGradient(0, H, 0, 0);
    bg.addColorStop(0, '#9FB2D6'); bg.addColorStop(0.35, '#5A6A8C'); bg.addColorStop(0.75, '#1E2638'); bg.addColorStop(1, '#0A0D14');
    g.fillStyle = bg; g.fillRect(bx, 0, bw, H);
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(side < 0 ? edge - 1 : edge, 0, 1.5, H);
    const hl = g.createLinearGradient(0, H, 0, H * 0.3); hl.addColorStop(0, 'rgba(225,235,255,0.9)'); hl.addColorStop(1, 'rgba(225,235,255,0)');
    g.fillStyle = hl; g.fillRect(side < 0 ? edge - bw : edge + bw - 2, 0, 2, H);
  }
  // nightlight glow spilling up from the bottom of the gap
  g.save(); g.globalCompositeOperation = 'screen';
  const gl = g.createRadialGradient(W / 2, H + 40, 10, W / 2, H + 40, 330);
  gl.addColorStop(0, 'rgba(150,175,230,0.32)'); gl.addColorStop(1, 'rgba(150,175,230,0)');
  g.fillStyle = gl; g.fillRect(0, 0, W, H); g.restore();
  contrast(c, 1.22, 70, 0);
  vignette(g, W, H, 0.5, 0.42);
  unsharp(c, 0.6);
  grain(g, W, H, 7, 9);
};

/* ------------------------------------------------------- JUMP SCARE 3
 * Stage 3 at her worst: 25-degree tilt, huge glossy BLACK eyes (27% HW, no
 * catchlight), a silent-scream oval lined with rows of identical square
 * teeth, face stretched 15%, red key light from below-left, a hard white rim
 * light on the petals, which flare outward like a threat display. */
A.poppy_scare_final = (c) => {
  const W = c.width, H = c.height, g = c.getContext('2d');
  const cx = 404, cy = 318, R = 212, SY = 1.15, TILT = 25;
  const bg = g.createRadialGradient(W * 0.22, H * 0.95, 20, W * 0.45, H * 0.55, W * 0.85);
  bg.addColorStop(0, '#5A0A0C'); bg.addColorStop(0.35, '#240305'); bg.addColorStop(1, '#050000');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const opts = {
    pose: 'head', cx, cy, R, px: 2.7, texScale: 2.3, seed: 7, castK: 2.2,
    tilt: TILT, eyes: 'black', mouth: 'scream', decay: 0.3, light: { x: -0.6, y: 0.8 }, missing: [],
    head: {
      sy: SY, eyeW: 0.27, eyeSep: 0.4, eyeY: -0.3, eyeAspect: 1.48, asym: true, noCheeks: true, noSeam: true, crumple: 0.45, jaw: 0.22,
      noseY: 0.02, screamY: 0.62, fuzz: 120,
      screamRX: 0.29, screamRY: 0.47, screamRows: [{ k: 0.92, n: 30, s: 0.068 }, { k: 0.78, n: 26, s: 0.06 }],
      petalFlare: 1.0, petalPointy: 2.2, petalR: 1.62, petalBottom: 1.0, humanFolds: 0.9, faceAO: 0.5, faceAOBlur: 30,
      blackEyeTint: 'rgba(255,90,60,0.55)', blackEyeSheen: 'rgba(255,150,120,0.2)', blackEyeRim: { color: 'rgba(255,255,255,0.55)', dx: 0.55, dy: -0.83 }, faceOutline: '#2A0E0A',
    },
  };
  const lightFx = (lg, mask, w, h) => {
    lg.save(); lg.globalCompositeOperation = 'multiply';
    // red key light from below-left (radial falloff, never fully black)
    const kx = w * 0.02, ky = h * 1.06;
    const kg = lg.createRadialGradient(kx, ky, 10, kx, ky, w * 1.15);
    kg.addColorStop(0, '#FFF0E4'); kg.addColorStop(0.3, '#FFC4AC'); kg.addColorStop(0.52, '#DA6448');
    kg.addColorStop(0.7, '#701E1A'); kg.addColorStop(0.86, '#3A0C0C'); kg.addColorStop(1, '#2A0808');
    lg.fillStyle = kg; lg.fillRect(0, 0, w, h);
    lg.fillStyle = '#FF7A62'; lg.globalAlpha = 0.45; lg.fillRect(0, 0, w, h); lg.globalAlpha = 1;
    lg.globalCompositeOperation = 'screen';
    const hs = lg.createRadialGradient(kx, ky, 10, kx, ky, w * 0.6);
    hs.addColorStop(0, 'rgba(255,120,80,0.35)'); hs.addColorStop(1, 'rgba(255,120,80,0)');
    lg.fillStyle = hs; lg.fillRect(0, 0, w, h);
    lg.restore();
    // hard white rim light on the upper-right edges (the flared petals)
    P.rimLight(lg, mask, w, h, 0.55, -0.83, 4, '#FFC4B0', 0.42, 3.0, 16);
  };
  const { U, F, info } = litTwice(W, H, opts, lightFx);
  if (info.mouth) pasteFeature(F, U, info.T, [info.mouth], 0.55, '#FFB8A0', 0.8);
  glossEyes(F, info.T, info.eyes.E, { tilt: TILT,
    spots: [{ dx: -0.6, dy: 0.8, d: 0.5, r: 0.5, squash: 0.42, color: 'rgba(255,110,80,0.55)' },
            { dx: -0.6, dy: 0.8, d: 0.58, r: 0.18, squash: 0.5, color: 'rgba(255,200,170,0.35)' }],
    rim: { dx: 0.55, dy: -0.83, color: 'rgba(255,235,225,0.42)' } });
  g.drawImage(F, 0, 0);
  contrast(c, 1.18, 55, 0);
  vignette(g, W, H, 0.5, 0.45, 'rgba(8,0,0,0.6)');
  unsharp(c, 0.55);
  grain(g, W, H, 8, 4);
};

/* ------------------------------------------------------- FINAL FRAME
 * Ordinary friendly Poppy (Stage 1 face, catchlights back, gentle closed
 * smile) impossibly close to the lens: the face overfills the frame, petals
 * only in the corners, a slight wide-angle bulge, both pupils dead centre on
 * the lens, warm bedside-lamp light from the left, and the dark bedroom
 * (moonlit window, bed edge) faintly visible and blurred at the edges. */
const finalClose = (look) => (c) => {
  const W = c.width, H = c.height, g = c.getContext('2d');
  const cx = 310, cy = 240, R = 218;
  // the dark bedroom behind her (it will be blurred and mostly covered)
  g.fillStyle = '#06080E'; g.fillRect(0, 0, W, H);
  // moonlit window, upper right: four panes, cross bars, cold light
  g.save();
  const win = g.createLinearGradient(500, -40, 660, 150); win.addColorStop(0, '#7088B8'); win.addColorStop(1, '#2A3A5C');
  g.fillStyle = win; g.fillRect(500, -40, 180, 190);
  g.fillStyle = '#080A12'; g.fillRect(586, -40, 12, 190); g.fillRect(500, 40, 180, 10); g.fillRect(492, 146, 196, 14);
  g.fillStyle = 'rgba(140,165,210,0.12)'; g.fillRect(420, 170, 260, 120);           // moonlight on the wall below the sill
  // bed edge, lower left: pale blanket with a fold, catching the lamp
  const bed = g.createLinearGradient(0, 380, 0, 480); bed.addColorStop(0, '#6A6A80'); bed.addColorStop(1, '#2A2A3A');
  g.fillStyle = bed; g.beginPath(); g.moveTo(400, 410); g.bezierCurveTo(480, 384, 580, 380, 680, 392); g.lineTo(680, 500); g.lineTo(400, 500); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(20,14,24,0.6)'; g.lineWidth = 6; g.beginPath(); g.moveTo(470, 440); g.quadraticCurveTo(560, 420, 650, 432); g.stroke();
  g.fillStyle = 'rgba(200,210,240,0.18)'; g.beginPath(); g.moveTo(420, 412); g.bezierCurveTo(500, 390, 590, 386, 680, 396); g.lineTo(680, 404); g.bezierCurveTo(590, 396, 500, 400, 420, 420); g.fill();
  // bedside lamp glow, far left
  const lamp = g.createRadialGradient(-30, 230, 10, -30, 230, 330); lamp.addColorStop(0, 'rgba(255,190,110,0.75)'); lamp.addColorStop(0.4, 'rgba(255,170,90,0.25)'); lamp.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = lamp; g.fillRect(0, 0, W, H);
  g.restore();
  const bgc = mk(W, H); bgc.getContext('2d').filter = 'blur(9px)'; bgc.getContext('2d').drawImage(c, 0, 0);
  g.clearRect(0, 0, W, H); g.drawImage(bgc, 0, 0);
  // Stage 1 face: the normal frame looks just past the lens (catchlights, one
  // pupil drifted); the 'look' variant (one field of the VCR pause in 11g)
  // has both pupils dead centre on the lens, a little wider, no catchlight.
  const head = look
    ? { pupilsCentered: true, catchlight: false, pupil: 0.42 }
    : { gaze: { x: -0.09, y: 0.02 } };
  const opts = {
    pose: 'head', cx, cy, R, px: 3.4, texScale: 2.6, seed: 7,
    tilt: 5, eyes: 'button', mouth: 'smile', light: { x: -0.95, y: -0.25 }, castK: 1.2,
    head: Object.assign({ smileD: 0.15, smileW: 0.36, petalR: 1.4, fuzz: 260 }, head),
  };
  const lightFx = (lg, mask, w, h) => {
      lg.save(); lg.globalCompositeOperation = 'multiply';
      // warm lamp from the left, the right side of the face falling into the dark room
      const lt = lg.createLinearGradient(0, 0, w, 0);
      lt.addColorStop(0, '#FFE6BC'); lt.addColorStop(0.35, '#F0C694'); lt.addColorStop(0.7, '#7A6264'); lt.addColorStop(1, '#2A2834');
      lg.fillStyle = lt; lg.fillRect(0, 0, w, h);
      const vg = lg.createRadialGradient(w * 0.38, h * 0.45, h * 0.25, w * 0.45, h * 0.5, w * 0.62);
      vg.addColorStop(0, '#FFFFFF'); vg.addColorStop(1, '#9A8A86');
      lg.fillStyle = vg; lg.fillRect(0, 0, w, h);
      lg.globalCompositeOperation = 'screen';
      const gl = lg.createRadialGradient(0, h * 0.45, 10, 0, h * 0.45, w * 0.5); gl.addColorStop(0, 'rgba(255,200,130,0.28)'); gl.addColorStop(1, 'rgba(255,200,130,0)');
      lg.fillStyle = gl; lg.fillRect(0, 0, w, h);
      lg.restore();
      // faint cold moonlight rim on the right edge of the petals
      P.rimLight(lg, mask, w, h, 0.8, -0.6, 3, '#8FA6D8', 0.6, 3);
  };
  const { U, F: fig, info } = litTwice(W, H, opts, lightFx);
  // opaque felt eye whites (#ECE5D3) with their pupils, so the eyes read as
  // finished white felt instead of taking the skin colour of the lamp light
  const whites = info.eyes.E.map(e => P.ellipse(e.cx, e.cy, e.w / 2, e.h / 2));
  pasteFeature(fig, U, info.T, whites, 0.88, '#F2EBDA', 0.8);
  g.drawImage(fig, 0, 0);
  bulge(c, 0.1);
  edgeBlur(c, 6, 0.4);
  vignette(g, W, H, 0.5, 0.42, 'rgba(8,6,6,0.5)');
  grain(g, W, H, 6, 8);
};
A.poppy_final_close = finalClose(false);
A.poppy_final_close_look = finalClose(true);

root.Poppy.ASSETS = A;
root.Poppy.PRESETS = { STAGE1, WRONG };
})(typeof window !== 'undefined' ? window : globalThis);
