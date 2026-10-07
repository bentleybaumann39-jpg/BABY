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
  head: { eyeW: 0.22, eyeSep: 0.37, eyeY: -0.1, asym: false, smileW: 0.72, teeth: 19, smileD: 0.15, mouthY: 0.34,
    gaze: { x: -0.07, y: 0.01 }, real: { pupil: 0.14, iris: 0.175, open: 0.92, lower: 0.46, lashes: false, crease: 0.3, wetLine: true, outline: '#6A3A30', outlineW: 0.6 } },
});

A.poppy_wrong_idle = full(WRONG);
A.poppy_cover_eyes = full(Object.assign({}, WRONG, { pose: 'cover', eyes: 'real',
  head: Object.assign({}, WRONG.head, { eyeW: 0.21, gaze: { x: 0, y: 0 }, real: { pupil: 0.1, iris: 0.18, open: 0.9, lower: 0.46, socket: 0.55, lashes: false, crease: 0.3, wetLine: true } }),
  coverAngL: 166, coverAngR: 146, peekAngles: [-2, 0, 17], peekT: 30 }));

/* ------------------------------------------------------------ costume */
A.costume_slumped = (c) => drawPoppy(c.getContext('2d'), { pose: 'slumped', seed: 7, decay: 0.25, px: 0.85, light: { x: -0.3, y: -0.95 } });
A.costume_standing = (c) => drawPoppy(c.getContext('2d'), {
  seed: 7, tilt: 20, eyes: 'hollow', mouth: 'smile', decay: 0.3, limp: true, px: 1,
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
 * The empty costume head lunging into the camcorder's on-camera light. */
A.poppy_scare_costume = (c) => {
  const W = c.width, H = c.height, g = c.getContext('2d');
  const wg = g.createRadialGradient(W * 0.52, H * 0.42, 60, W * 0.5, H * 0.5, W * 0.62);
  wg.addColorStop(0, '#3A3630'); wg.addColorStop(0.6, '#15130F'); wg.addColorStop(1, '#030303');
  g.fillStyle = wg; g.fillRect(0, 0, W, H);
  const fig = mk(W, H), fg = fig.getContext('2d');
  drawPoppy(fg, {
    pose: 'head', cx: 402, cy: 312, R: 252, px: 3.1, texScale: 2.5, seed: 13, castK: 1.4,
    tilt: -11, eyes: 'hollow', mouth: 'hang', decay: 0.28, light: { x: -0.12, y: -0.6 },
    head: { sy: 1.05, crumple: 1.0, deepEyes: true, deepSize: 0.78, deepBright: true, meshStep: 0.024, meshAlpha: 0.55,
      crush: [{ angle: -0.15, amount: 0.38, squeeze: 0.55 }], petalR: 1.42, eyeW: 0.22, eyeY: -0.13, asym: false,
      hangY: 0.56, noseY: 0.14, noCheeks: true, noSeam: true, fuzz: 90 },
    lightFx: (lg, mask, w, h) => {
      lg.save(); lg.globalCompositeOperation = 'multiply';
      const fl = lg.createRadialGradient(w * 0.47, h * 0.40, 30, w * 0.5, h * 0.52, w * 0.56);
      fl.addColorStop(0, '#FFFFFF'); fl.addColorStop(0.45, '#E6E0D4'); fl.addColorStop(0.8, '#5A5248'); fl.addColorStop(1, '#141210');
      lg.fillStyle = fl; lg.fillRect(0, 0, w, h);
      lg.globalCompositeOperation = 'screen';
      const hs = lg.createRadialGradient(w * 0.46, h * 0.36, 10, w * 0.46, h * 0.38, w * 0.34);
      hs.addColorStop(0, 'rgba(255,252,240,0.55)'); hs.addColorStop(1, 'rgba(255,252,240,0)');
      lg.fillStyle = hs; lg.fillRect(0, 0, w, h);
      lg.restore();
    },
  });
  // hard shadow on the wall behind, down-right of the head
  const sh = mk(W, H), sg = sh.getContext('2d'); sg.drawImage(fig, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#000'; sg.fillRect(0, 0, W, H);
  g.save(); g.filter = 'blur(1.5px)'; g.globalAlpha = 0.85; g.drawImage(sh, 30, 36); g.restore();
  g.drawImage(fig, 0, 0);
  contrast(c, 1.28, 110, 4);
  unsharp(c, 0.7);
  edgeBlur(c, 0, 0.34, 0.08);
  vignette(g, W, H, 0.6, 0.45);
  grain(g, W, H, 10, 3);
};

/* ------------------------------------------------------- JUMP SCARE 2
 * Stage 3 face pushed through the closet gap, underlit by a nightlight. */
A.poppy_scare_closet = (c) => {
  const W = c.width, H = c.height, g = c.getContext('2d');
  g.fillStyle = '#000000'; g.fillRect(0, 0, W, H);
  g.save(); g.filter = 'blur(7px)';
  for (const [x, w] of [[140, 60], [250, 40], [560, 70], [640, 40]]) { const cg = g.createLinearGradient(0, 0, 0, H); cg.addColorStop(0, 'rgba(20,24,34,0.0)'); cg.addColorStop(1, 'rgba(30,38,56,0.75)'); g.fillStyle = cg; g.fillRect(x, 80, w, H); }
  g.restore();
  const fig = mk(W, H), fg = fig.getContext('2d');
  const cx = 400, cy = 292, R = 206;
  drawPoppy(fg, {
    pose: 'head', cx, cy, R, px: 2.6, texScale: 2.2, seed: 7, castK: 3.2,
    tilt: 6, eyes: 'real', mouth: 'grin', light: { x: 0.04, y: 1 },
    head: {
      sy: 1.12, eyeW: 0.27, eyeSep: 0.39, eyeY: -0.16, asym: false, gaze: { x: 0, y: 0 }, noCheeks: true,
      real: { pupil: 0.08, iris: 0.165, open: 0.9, lower: 0.5, socket: 0.5, lashes: false, crease: 0.2, lashCap: 1.2, outline: '#7A4A40', outlineW: 0.5, wetLine: true, irisColor: ['#D6DDD9', '#93A6A4', '#3A5154'] },
      smileW: 0.95, teeth: 22, smileD: 0.30, mouthY: 0.15, grinFill: true, lipColor: '#2A0508', lipW: 2.2, noTicks: true, fuzz: 90,
      humanFolds: 1.0, faceAO: 0.55, faceAOBlur: 26, faceOutline: '#2A1C14',
      crush: [{ angle: 0, amount: 0.12, squeeze: 0.45 }, { angle: Math.PI, amount: 0.12, squeeze: 0.45 }], petalR: 1.5,
    },
    lightFx: (lg, mask, w, h) => {
      lg.save(); lg.globalCompositeOperation = 'multiply';
      ramp(lg, w, h, [[cy + 1.2 * R, '#D4DEF2'], [cy + 0.5 * R, '#A4B2CE'], [cy - 0.05 * R, '#7888AA'], [cy - 0.32 * R, '#46546F'], [cy - 0.62 * R, '#0C1018'], [cy - 1.1 * R, '#000000']]);
      sphereShade(lg, w, h, cx, cy + 0.55 * R, R * 0.25, R * 1.45, '#000000');
      // the eye whites and teeth catch the nightlight
      lg.globalCompositeOperation = 'soft-light';
      const t = 6 * Math.PI / 180, sy = 1.12;
      for (const ex of [-0.39, 0.39]) {
        const ey = -0.16, x = cx + R * (ex * Math.cos(t) - ey * sy * Math.sin(t)), y = cy + R * (ex * Math.sin(t) + ey * sy * Math.cos(t));
        const eg = lg.createRadialGradient(x, y + 10, 4, x, y, R * 0.36); eg.addColorStop(0, 'rgba(235,242,255,0.95)'); eg.addColorStop(1, 'rgba(235,242,255,0)');
        lg.fillStyle = eg; lg.fillRect(0, 0, w, h);
      }
      const gl = lg.createRadialGradient(w * 0.5, h * 1.05, 20, w * 0.5, h * 1.0, h * 0.55);
      gl.addColorStop(0, 'rgba(225,238,255,0.6)'); gl.addColorStop(1, 'rgba(225,238,255,0)');
      lg.fillStyle = gl; lg.fillRect(0, 0, w, h);
      lg.restore();
    },
  });
  g.drawImage(fig, 0, 0);
  for (const side of [-1, 1]) {
    const DW = 150, x0 = side < 0 ? 0 : W - DW, x1 = side < 0 ? DW : W;
    const dg = g.createLinearGradient(x0, 0, x1, 0);
    if (side < 0) { dg.addColorStop(0, '#07080C'); dg.addColorStop(0.8, '#161B26'); dg.addColorStop(1, '#2A3242'); }
    else { dg.addColorStop(0, '#2A3242'); dg.addColorStop(0.2, '#161B26'); dg.addColorStop(1, '#07080C'); }
    g.fillStyle = dg; g.fillRect(x0, 0, x1 - x0, H);
    const lg2 = g.createLinearGradient(0, H, 0, 0); lg2.addColorStop(0, 'rgba(170,200,255,0.32)'); lg2.addColorStop(0.45, 'rgba(170,200,255,0.05)'); lg2.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = lg2; g.fillRect(x0, 0, x1 - x0, H);
    const ex = side < 0 ? DW : W - DW;
    const eg = g.createLinearGradient(0, H, 0, 0); eg.addColorStop(0, 'rgba(170,195,235,0.8)'); eg.addColorStop(0.6, 'rgba(120,140,180,0.25)'); eg.addColorStop(1, 'rgba(60,70,90,0.05)');
    g.fillStyle = eg; g.fillRect(ex - (side < 0 ? 3 : 0), 0, 3, H);
    const sh = g.createLinearGradient(ex, 0, ex - side * 80, 0); sh.addColorStop(0, 'rgba(0,0,0,0.9)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh; g.fillRect(Math.min(ex, ex - side * 80), 0, 80, H);
  }
  contrast(c, 1.18, 70, 0);
  vignette(g, W, H, 0.55, 0.38);
  unsharp(c, 0.6);
  grain(g, W, H, 8, 9);
};

/* ------------------------------------------------------- JUMP SCARE 3
 * Stage 3 at her worst: black void eyes, silent scream, red under-light. */
A.poppy_scare_final = (c) => {
  const W = c.width, H = c.height, g = c.getContext('2d');
  const bg = g.createRadialGradient(W * 0.3, H * 0.85, 30, W * 0.5, H * 0.5, W * 0.8);
  bg.addColorStop(0, '#3A0508'); bg.addColorStop(0.5, '#160103'); bg.addColorStop(1, '#040000');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const fig = mk(W, H), fg = fig.getContext('2d');
  const cx = 404, cy = 296, R = 232;
  drawPoppy(fg, {
    pose: 'head', cx, cy, R, px: 2.9, texScale: 2.4, seed: 7, castK: 2.4,
    tilt: 25, eyes: 'black', mouth: 'scream', decay: 0.25, light: { x: -0.55, y: 0.83 },
    head: {
      sy: 1.15, eyeW: 0.27, eyeSep: 0.39, eyeY: -0.24, eyeAspect: 1.38, asym: false, noCheeks: true, noSeam: true,
      noseY: 0.03, screamY: 0.58, screamRX: 0.29, screamRY: 0.47, fuzz: 90,
      petalFlare: 1.0, petalPointy: 1.9, petalR: 1.56, petalBottom: 1.0, humanFolds: 0.8, faceAO: 0.5, faceAOBlur: 30,
      petalRim: { color: '#FFFFFF', width: 5, dx: 0.6, dy: -0.8, blur: 0.8 },
      blackEyeTint: 'rgba(255,90,60,0.55)',
    },
    lightFx: (lg, mask, w, h) => {
      lg.save(); lg.globalCompositeOperation = 'multiply';
      ramp(lg, w, h, [[h * 1.0, '#FFE6D0'], [h * 0.74, '#F2A890'], [h * 0.5, '#B04A3A'], [h * 0.3, '#6A1C18'], [h * 0.08, '#3A0A0A'], [-h * 0.1, '#200404']], w * 0.05, w * 0.85);
      lg.fillStyle = '#FF6A55'; lg.globalAlpha = 0.6; lg.fillRect(0, 0, w, h); lg.globalAlpha = 1;
      sphereShade(lg, w, h, cx - 0.35 * R, cy + 0.6 * R, R * 0.2, R * 1.7, '#140404');
      lg.globalCompositeOperation = 'soft-light';
      const hs = lg.createRadialGradient(w * 0.18, h * 1.0, 10, w * 0.2, h * 0.95, w * 0.6);
      hs.addColorStop(0, 'rgba(255,170,120,0.9)'); hs.addColorStop(1, 'rgba(255,170,120,0)');
      lg.fillStyle = hs; lg.fillRect(0, 0, w, h);
      lg.restore();
      P.rimLight(lg, mask, w, h, 0.5, -0.87, 5, '#FFFFFF', 0.8, 2.5);
    },
  });
  g.drawImage(fig, 0, 0);
  contrast(c, 1.15, 60, 0);
  vignette(g, W, H, 0.55, 0.4);
  unsharp(c, 0.55);
  grain(g, W, H, 9, 4);
};

/* ------------------------------------------------------- FINAL FRAME
 * Ordinary friendly Poppy, impossibly close to the lens, in your bedroom. */
A.poppy_final_close = (c) => {
  const W = c.width, H = c.height, g = c.getContext('2d');
  // dark bedroom: moonlit window (upper right), bed edge (lower left)
  g.fillStyle = '#07090F'; g.fillRect(0, 0, W, H);
  g.save(); g.filter = 'blur(10px)';
  g.fillStyle = '#2A3A5A'; g.fillRect(500, -20, 170, 190);
  g.fillStyle = '#0A0E18'; g.fillRect(578, -20, 12, 190); g.fillRect(500, 78, 170, 10);
  const bed = g.createLinearGradient(0, 380, 0, 480); bed.addColorStop(0, '#2C2A36'); bed.addColorStop(1, '#14131A');
  g.fillStyle = bed; g.beginPath(); g.moveTo(-20, 392); g.quadraticCurveTo(140, 370, 260, 400); g.lineTo(260, 500); g.lineTo(-20, 500); g.fill();
  const lamp = g.createRadialGradient(-10, 250, 10, -10, 250, 300); lamp.addColorStop(0, 'rgba(255,190,110,0.5)'); lamp.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = lamp; g.fillRect(0, 0, W, H);
  g.restore();
  const fig = mk(W, H), fg = fig.getContext('2d');
  drawPoppy(fg, {
    pose: 'head', cx: 322, cy: 246, R: 296, px: 3.3, texScale: 2.8, seed: 7,
    tilt: 6, eyes: 'button', mouth: 'smile', light: { x: -0.95, y: -0.2 },
    head: { pupilsCentered: true, smileD: 0.16 },
    lightFx: (lg, mask, w, h) => {
      lg.save(); lg.globalCompositeOperation = 'multiply';
      const lt = lg.createLinearGradient(0, 0, w, 0);
      lt.addColorStop(0, '#FFE2B0'); lt.addColorStop(0.45, '#D8A878'); lt.addColorStop(0.85, '#3A3442'); lt.addColorStop(1, '#1A1A26');
      lg.fillStyle = lt; lg.fillRect(0, 0, w, h);
      lg.globalCompositeOperation = 'screen';
      const gl = lg.createRadialGradient(0, h * 0.5, 10, 0, h * 0.5, w * 0.5); gl.addColorStop(0, 'rgba(255,200,130,0.25)'); gl.addColorStop(1, 'rgba(255,200,130,0)');
      lg.fillStyle = gl; lg.fillRect(0, 0, w, h);
      lg.restore();
    },
  });
  g.drawImage(fig, 0, 0);
  bulge(c, 0.13);
  edgeBlur(c, 7, 0.36);
  vignette(g, W, H, 0.7, 0.3, 'rgba(10,6,4,0.75)');
  grain(g, W, H, 7, 8);
};

root.Poppy.ASSETS = A;
root.Poppy.PRESETS = { STAGE1, WRONG };
})(typeof window !== 'undefined' ? window : globalThis);
