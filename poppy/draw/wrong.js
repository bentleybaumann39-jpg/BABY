/* wrong.js - THE WORLD OF POPPY: scare-pass presets for the turned Poppy
 * (loaded after poppy.js, scenes.js, horror.js and scare.js).
 *
 *   poppy_wrong_idle     Stage 2 full body: neck 1.5x, head tilted 35 degrees with the
 *                        eyes, nose and mouth kept LEVEL, flat glossy black button eyes
 *                        (one cracked, one higher), the smile re-sewn wider past the
 *                        outline with a glimpse of small real teeth, worn felt, skin
 *                        through a split seam at the neck, arms to the knees.
 *   poppy_cover_eyes     the same body counting: hands over the eyes, ONE realistic wet
 *                        human eye looking through the gap between two fingers.
 *   poppy_address(_talk) direct-address close-up (scare.js face builder, transparent).
 *   hidden_poppy_stand   near-black wrong-Poppy silhouette for the hidden figures.
 *   hidden_peek          door-gap peek: petal tips, a slice of cheek, one wet eye.
 * Act 1 presets in scenes.js are untouched.
 */
(function (root) {
'use strict';
const P = root.Poppy, HZ = root.HZ, SC = P.SCARE;
const { TAU, DEG, lerp, clamp, sstep, rng, mk, MAT } = HZ;
const A = P.ASSETS;

/* draw a drawPoppy figure at 2x and downsample into cv (detail scaled with it) */
function at2x(cv, opts, after) {
  const W = cv.width, H = cv.height, B = mk(W * 2, H * 2), bg = B.getContext('2d');
  const o = Object.assign({}, opts, { transform: [2, 0, 0, 2, 0, 0], px: (opts.px || 1) * 2, texScale: (opts.texScale || opts.px || 1) * 2 });
  const info = P.drawPoppy(bg, o);
  if (after) after(bg, info, 2);
  cv.getContext('2d').drawImage(HZ.downsample(B, W, H), 0, 0);
  return info;
}
/* neutral studio light for the per-pixel patches on the full-body art (device px) */
const studio = (W, H) => HZ.stage({ light: { x: -W * 1.2, y: -H * 1.6, z: W * 2.6, col: [1.1, 1.08, 1.04], power: 1.18, d0: 1e6 }, ambient: [0.16, 0.16, 0.17] });

/* ---------------------------------------------------------- worn felt (head frame paint hook) */
function wornFace(seed, k) {
  return (g) => {
    const r = rng(seed + ':worn'), lw = P.lpx(g, 1);
    // grime darkening the creases around the features and the rim
    g.save(); g.globalCompositeOperation = 'multiply';
    for (const [x, y, rx, ry, a] of [[0, 0.98, 0.9, 0.18, 0], [-0.62, 0.3, 0.2, 0.35, 0.4], [0.62, 0.3, 0.2, 0.35, -0.4], [0, -0.92, 0.8, 0.14, 0]]) {
      const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
      gr.addColorStop(0, `rgba(120,100,78,${0.55 * k})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.save(); g.translate(x, y); g.rotate(a); g.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); g.translate(-x, -y);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, Math.max(rx, ry), 0, TAU); g.fill(); g.restore();
    }
    // soft grey-brown stains (never red)
    for (let i = 0; i < Math.round(7 * k); i++) {
      const x = (r() - 0.5) * 1.5, y = (r() - 0.5) * 1.5, rr = 0.06 + r() * 0.16;
      g.filter = `blur(${(2 + r() * 3) * P.ENV.px}px)`;
      g.fillStyle = `rgba(${150 + r() * 20 | 0},${135 + r() * 20 | 0},${110 + r() * 15 | 0},${0.45 + r() * 0.3})`;
      g.beginPath(); g.ellipse(x, y, rr * (0.7 + r() * 0.6), rr * (0.6 + r() * 0.6), r() * 3, 0, TAU); g.fill();
    }
    g.filter = 'none'; g.restore();
    // pilling: little felt balls (2-4 px) with a highlight and a contact shadow
    for (let i = 0; i < Math.round(90 * k); i++) {
      const a = r() * TAU, rr = Math.sqrt(r()) * 0.97, x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.97;
      const s = (0.8 + r() * 0.9) * lw * P.ENV.px * 0.9;
      g.fillStyle = 'rgba(60,45,30,0.35)'; g.beginPath(); g.arc(x + s * 0.35, y + s * 0.45, s * 1.05, 0, TAU); g.fill();
      const pg = g.createRadialGradient(x - s * 0.35, y - s * 0.4, 0, x, y, s);
      pg.addColorStop(0, 'rgba(242,230,208,0.85)'); pg.addColorStop(1, 'rgba(180,158,124,0.85)');
      g.fillStyle = pg; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
    }
  };
}

/* ---------------------------------------------------------- flat glossy black button eye */
function blackButton(ctx, H, e, crackIt) {
  const rx = e.w / 2, ry = e.h / 2, lw = P.lpx(ctx, 1);
  ctx.save();
  // contact shadow on the felt
  ctx.save(); ctx.filter = `blur(${2 * P.ENV.px}px)`; ctx.fillStyle = 'rgba(30,18,10,0.6)';
  ctx.beginPath(); ctx.ellipse(e.cx + rx * 0.06, e.cy + ry * 0.1, rx * 1.04, ry * 1.04, 0, 0, TAU); ctx.fill(); ctx.restore();
  // the disc: black, a faint lift toward the bevel, no catchlight
  const gr = ctx.createRadialGradient(e.cx - rx * 0.15, e.cy - ry * 0.2, rx * 0.1, e.cx, e.cy, rx);
  gr.addColorStop(0, '#000000'); gr.addColorStop(0.78, '#040406'); gr.addColorStop(0.93, '#16161C'); gr.addColorStop(1, '#0A0A0D');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(e.cx, e.cy, rx, ry, 0, 0, TAU); ctx.fill();
  // broad, dull sheen (wet plastic) toward the key light, and a thin bevel reflection
  ctx.save(); ctx.beginPath(); ctx.ellipse(e.cx, e.cy, rx, ry, 0, 0, TAU); ctx.clip();
  ctx.filter = `blur(${3.5 * P.ENV.px}px)`; ctx.fillStyle = 'rgba(200,205,220,0.2)';
  ctx.beginPath(); ctx.ellipse(e.cx - rx * 0.38, e.cy - ry * 0.4, rx * 0.4, ry * 0.2, -0.65, 0, TAU); ctx.fill();
  ctx.filter = 'none'; ctx.strokeStyle = 'rgba(160,165,180,0.28)'; ctx.lineWidth = lw * 1.2 * P.ENV.px;
  ctx.beginPath(); ctx.ellipse(e.cx, e.cy, rx * 0.88, ry * 0.88, 0, Math.PI * 1.05, Math.PI * 1.55); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = lw * 1.1 * P.ENV.px; ctx.beginPath(); ctx.ellipse(e.cx, e.cy, rx, ry, 0, 0, TAU); ctx.stroke();
  if (crackIt) {
    // a hairline crack across the button with a 1 px highlight on one side
    const c = [[-0.95, -0.25], [-0.45, -0.08], [-0.12, 0.12], [0.2, 0.05], [0.55, 0.32], [0.97, 0.4]].map(([u, v]) => [e.cx + u * rx, e.cy + v * ry]);
    const cp = new Path2D(); cp.moveTo(c[0][0], c[0][1]); for (const q of c) cp.lineTo(q[0], q[1]);
    const br = new Path2D(); br.moveTo(c[2][0], c[2][1]); br.lineTo(e.cx - 0.05 * rx, e.cy + 0.55 * ry); br.lineTo(e.cx + 0.1 * rx, e.cy + 0.8 * ry);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.save(); ctx.translate(-lw * 0.9 * P.ENV.px, -lw * 0.9 * P.ENV.px);
    ctx.strokeStyle = 'rgba(225,228,236,0.7)'; ctx.lineWidth = lw * 0.9 * P.ENV.px; ctx.stroke(cp); ctx.stroke(br); ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,1)'; ctx.lineWidth = lw * 1.0 * P.ENV.px; ctx.stroke(cp); ctx.stroke(br);
  }
  ctx.restore();
  return null;
}

/* ---------------------------------------------------------- the re-sewn smile
 * the old painted smile, a wider seam sewn over it with a dark running stitch
 * that runs past the old corners and past the face outline, and between the
 * barely parted lips a thin glimpse of small real teeth. Head frame (levelled). */
function resewnMouth(o) {
  o = Object.assign({ y0: 0.34, D: 0.15, W: 1.14, gapW: 0.52, gap: 0.05, teeth: 14, seed: 'resewn', stage: null }, o || {});
  return (ctx, H) => {
    const lw = P.lpx(ctx, 1), px = P.ENV.px, fn = t => [t * o.W, o.y0 + o.D * (1 - t * t)];
    // old painted smile (faded cherry, Stage 1 width)
    const old = new Path2D(); for (let i = 0; i <= 40; i++) { const t = -1 + 2 * i / 40, x = t * 0.36, y = o.y0 + 0.02 + 0.17 * (1 - t * t); if (!i) old.moveTo(x, y); else old.lineTo(x, y); }
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(110,30,36,0.55)'; ctx.lineWidth = 0.035; ctx.stroke(old); ctx.restore();
    // the parted slit with teeth (centre only)
    const up = [], lo = [];
    const half = (x) => o.gap * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(x) / o.gapW, 2)), 0.7);
    for (let i = 0; i <= 50; i++) { const x = lerp(-o.gapW, o.gapW, i / 50), y = o.y0 + o.D * (1 - Math.pow(x / o.W, 2)); up.push([x, y - half(x) * 0.45]); lo.push([x, y + half(x) * 0.55]); }
    const slit = HZ.polyPath(up.concat(lo.slice().reverse()), true);
    ctx.save(); ctx.fillStyle = '#0A0304'; ctx.fill(slit); ctx.clip(slit);
    if (o.stage) {
      const line = []; for (let i = 0; i <= 30; i++) { const x = lerp(-o.gapW * 0.95, o.gapW * 0.95, i / 30); line.push([x, o.y0 + o.D * (1 - Math.pow(x / o.W, 2)) - o.gap * 0.55]); }
      const T = HZ.archTeeth(line, { dir: 1, n: o.teeth, len: o.gap * 1.25, persp: 0.35, seed: o.seed, crooked: 2.5, jit: 0.35, ao: [0.95, 0.5], lw: lw * px });
      HZ.teethPP(ctx, o.stage, T, { lw: lw * px, ivory: '#E8DFC8' });
      const lowL = line.map(([x, y]) => [x * 0.95, y + o.gap * 1.25]);
      const T2 = HZ.archTeeth(lowL, { dir: -1, n: o.teeth - 2, len: o.gap * 0.6, persp: 0.35, lower: true, seed: o.seed + 'l', crooked: 2.5, jit: 0.35, ao: [0.6, 0.35], lw: lw * px });
      HZ.teethPP(ctx, o.stage, T2, { lw: lw * px });
    }
    // lip shadows inside the slit
    ctx.filter = `blur(${0.8 * px}px)`; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = o.gap * 0.35; ctx.stroke(HZ.polyPath(up, false));
    ctx.restore();
    // seam: a dark groove the full new width, then the running stitch with its thread shadow
    const seam = new Path2D(); for (let i = 0; i <= 80; i++) { const [x, y] = fn(-1 + 2 * i / 80); if (!i) seam.moveTo(x, y); else seam.lineTo(x, y); }
    ctx.save(); ctx.lineCap = 'round';
    ctx.filter = `blur(${1.2 * px}px)`; ctx.strokeStyle = 'rgba(60,30,24,0.55)'; ctx.lineWidth = 0.03; ctx.stroke(seam); ctx.filter = 'none';
    const r = rng(o.seed + ':stitch'), st = 0.062, gp = 0.042;     // ~5 px stitches at full-body scale
    let s = 0; const pts = []; for (let i = 0; i <= 400; i++) pts.push(fn(-1 + 2 * i / 400));
    const L = HZ.arcLen(pts);
    while (s < L) {
      const len = st * (0.85 + r() * 0.3), a = HZ.along(pts, s), b = HZ.along(pts, Math.min(L, s + len));
      const jy = (r() - 0.5) * 0.012;
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.026; ctx.beginPath(); ctx.moveTo(a[0] + 0.008, a[1] + 0.012 + jy); ctx.lineTo(b[0] + 0.008, b[1] + 0.012 + jy); ctx.stroke();
      ctx.strokeStyle = '#1C1012'; ctx.lineWidth = 0.022; ctx.beginPath(); ctx.moveTo(a[0], a[1] + jy); ctx.lineTo(b[0], b[1] + jy); ctx.stroke();
      ctx.strokeStyle = 'rgba(150,120,110,0.35)'; ctx.lineWidth = 0.006; ctx.beginPath(); ctx.moveTo(a[0], a[1] + jy - 0.006); ctx.lineTo(b[0], b[1] + jy - 0.006); ctx.stroke();
      // the needle holes pull the felt into tiny dimples
      ctx.fillStyle = 'rgba(40,20,14,0.5)'; for (const q of [a, b]) { ctx.beginPath(); ctx.arc(q[0], q[1] + jy, 0.012, 0, TAU); ctx.fill(); }
      s += len + gp * (0.8 + r() * 0.4);
    }
    ctx.restore();
  };
}

/* ---------------------------------------------------------- shared wrong-Poppy options */
function wrongOpts(extra) {
  const W = 420 * 2, H = 640 * 2, st = studio(W, H);
  const head = {
    levelFeatures: true, jaw: 0.3, crumple: 0.35, sy: 1.04,
    eyeW: 0.24, eyeSep: 0.41, eyeY: -0.17, eyeAspect: 1.0, asym: false, asymDy: 0.08,
    noseY: 0.17, mouthY: 0.3, smileD: 0.24, petalR: 1.5, noSeam: true, cheekX: 0.6, cheekY: 0.22,
    facePaint: wornFace('wrong', 1),
    eyeFn: (ctx, H, e) => blackButton(ctx, H, e, e.side < 0),
    mouthFn: resewnMouth({ y0: 0.3, D: 0.24, W: 1.14, stage: st }),
  };
  return Object.assign({
    tilt: 35, levelFeatures: true, eyes: 'custom', mouth: 'custom', seed: 7, decay: 0.7, missing: [1],
    stretch: { neck: 1.5, arms: 1.4, fingers: 1.6 }, spread: 11, headC: [230, 162], head,
  }, extra || {});
}
/* a seam split on the neck: 30x6 px of real skin where the felt has worn through */
function neckSkin(bg, s) {
  const st = studio(bg.canvas.width, bg.canvas.height);
  const cx = 218 * s, cy = 292 * s, rx = 3 * s, ry = 15 * s, a = -0.08;
  const pts = []; for (let k = 0; k < 40; k++) { const t = k / 40 * TAU, j = 1 + 0.12 * HZ.noise1(k * 0.7, 5); pts.push([cx + Math.cos(t) * rx * j * Math.cos(a) - Math.sin(t) * ry * Math.sin(a), cy + Math.cos(t) * rx * j * Math.sin(a) + Math.sin(t) * ry * Math.cos(a)]); }
  const pp = HZ.polyPath(pts, true);
  HZ.pillowPP(bg, st, (lg) => {
    const g = lg.createLinearGradient(cx - rx, cy, cx + rx, cy); g.addColorStop(0, '#B89484'); g.addColorStop(1, '#94705E');
    lg.fillStyle = g; lg.fill(pp);
    lg.save(); lg.clip(pp); lg.filter = 'blur(0.8px)'; lg.strokeStyle = 'rgba(70,100,150,0.12)'; lg.lineWidth = 1.4;
    lg.beginPath(); lg.moveTo(cx - rx * 0.5, cy - ry); lg.bezierCurveTo(cx + rx, cy - ry * 0.3, cx - rx, cy + ry * 0.3, cx + rx * 0.4, cy + ry); lg.stroke(); lg.restore();
  }, { mat: MAT.skin, height: 2, round: 2, lw: 1, pores: 0.6, poreScale: 0.6, seed: 'neckskin', z: 0 });
  // frayed green felt lips of the split, pulling apart
  bg.save(); bg.lineCap = 'round';
  const r = rng('neckfray');
  for (let i = 0; i < 60; i++) {
    const t = r() * TAU, x = cx + Math.cos(t) * rx * 1.1, y = cy + Math.sin(t) * ry * 1.02, L = (1.5 + r() * 4) * s / 2;
    bg.strokeStyle = r() < 0.5 ? 'rgba(70,120,50,0.8)' : 'rgba(40,80,28,0.8)'; bg.lineWidth = 0.6 * s / 2 + r() * 0.5;
    bg.beginPath(); bg.moveTo(x, y); bg.lineTo(x - Math.cos(t) * L * (0.4 + r()), y + (r() - 0.5) * L); bg.stroke();
  }
  bg.strokeStyle = 'rgba(20,40,12,0.6)'; bg.lineWidth = s; bg.stroke(pp);
  // the old stitches across the split, snapped
  bg.strokeStyle = '#2A1E14'; bg.lineWidth = 0.9 * s;
  for (let k = 0; k < 4; k++) { const y = cy - ry * 0.7 + k * ry * 0.45, side = k % 2 ? 1 : -1; bg.beginPath(); bg.moveTo(cx + side * rx * 1.2, y); bg.quadraticCurveTo(cx + side * rx * 2.2, y + 2 * s, cx + side * rx * 2.6, y + 5 * s); bg.stroke(); }
  bg.restore();
}

A.poppy_wrong_idle = (cv) => at2x(cv, wrongOpts(), (bg, info, s) => neckSkin(bg, s));

/* the counting pose: hands over the eyes; through the gap one REAL wet human eye stares into the lens */
A.poppy_cover_eyes = (cv) => {
  const W = 420 * 2, H = 640 * 2, st = studio(W, H);
  const o = wrongOpts({ pose: 'cover', gloveScale: 1.5, peekT: 26, peekAngles: [-12, -14, 28] });
  o.head = Object.assign({}, o.head, {
    eyeFn: (ctx, Hh, e) => {
      if (e.side < 0) return blackButton(ctx, Hh, e, true);       // hidden under the palm
      // the peeking eye: realistic, wet, pinpoint pupil, sclera all round, looking dead into the lens
      return HZ.eyePP(ctx, st, { cx: e.cx, cy: e.cy, w: e.w * 0.95, open: 1.3, side: 1, iris: 0.2, pupil: 0.1, irisCol: ['#8C9078', '#7E9284', '#2E3C38'],
        veins: 5, lowerFlat: 0.8, window: { x: 0, y: -0.3, s: 0.3, a: 0.95 }, lashes: 13, lashLen: 0.12, press: 0.7, lidSkin: '#B08C7C', ring: 0.13, socket: 0.5,
        lw: P.lpx(ctx, 1) * 2, seed: 'cover:eye', z: 0, lidShadow: 0.5, ball: 0.62 });
    },
  });
  at2x(cv, o, (bg, info, s) => neckSkin(bg, s));
};

/* ---------------------------------------------------------- HIDDEN FIGURE cutout (240x640)
 * A near-black wrong-Poppy silhouette: long neck, head on one side, a jagged petal ring,
 * arms to the knees, long spread fingers; a 1 px cool rim on the right edge of the head,
 * petals and one shoulder, two tiny wet eye glints at the same height. Nothing else. */
A.hidden_poppy_stand = (cv) => {
  const W = cv.width, H = cv.height, S = 3, k = 0.97;               // drawn at 3x
  const B = mk(W * S, H * S), bg = B.getContext('2d', { willReadFrequently: true });
  const HC = [222, 166];
  const o = wrongOpts({ tilt: 32, eyes: 'button', mouth: 'custom', decay: 0, missing: [1, 6], headC: HC,
    stretch: { neck: 1.5, arms: 1.42, fingers: 1.7 }, spread: 14 });
  o.head = { levelFeatures: false, jaw: 0.25, crumple: 0.6, petalR: 1.32, petalPointy: 1.8, noCheeks: true, noSeam: true, eyeW: 0.2, mouthFn: () => {}, sx: 0.9, sy: 1.22 };
  // feet (210,628) -> (120,630); scale k; supersample S
  const tx = (120 - 210 * k) * S, ty = (630 - 628 * k) * S;
  P.drawPoppy(bg, Object.assign(o, { transform: [k * S, 0, 0, k * S, tx, ty], px: S * k, texScale: S * k }));
  // head centre in canvas px (for the petal ring, the glints and the rim region)
  const hx = (HC[0] * k * S + tx), hy = (HC[1] * k * S + ty), R = 80 * k * S;
  // classify: petal ring (red, around the head only) vs body; flatten to near-black
  const id = bg.getImageData(0, 0, W * S, H * S), d = id.data, n = W * S * H * S;
  const al = new Float32Array(n), pet = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], x = i % (W * S), y = (i / (W * S)) | 0, dd = Math.hypot(x - hx, y - hy) / R;
    al[i] = d[i * 4 + 3] / 255; pet[i] = (dd > 0.85 && dd < 1.7 && r > 1.5 * g && r > 1.4 * b && r > 60) ? 1 : 0;
  }
  HZ.fblur(pet, W * S, H * S, 2);
  for (let y = 0; y < H * S; y++) for (let x = 0; x < W * S; x++) {
    const i = y * W * S + x; if (al[i] <= 0) continue;
    const p = pet[i];
    let r = lerp(0x0B, 0x1A, p), g = lerp(0x0A, 0x0D, p), b = lerp(0x0C, 0x10, p);
    // cool 1 px rim where the figure's right edge faces the light: head, petals, the right shoulder
    const xr = Math.min(W * S - 1, x + Math.round(1.6 * S)), edge = al[i] * (1 - al[y * W * S + xr]);
    const inHead = Math.hypot(x - hx, y - hy) < R * 1.45, shoulder = y > 330 * S && y < 380 * S && x > 135 * S;
    if (edge > 0.05 && (inHead || shoulder)) { const e = Math.min(1, edge * 1.4); r = lerp(r, 0x3A, e); g = lerp(g, 0x40, e); b = lerp(b, 0x48, e); }
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b;
  }
  bg.putImageData(id, 0, 0);
  // two tiny wet eye glints, level, inside the head (the head is tilted, the glints are not)
  const ey = hy - 0.08 * R;
  for (const sd of [-1, 1]) {
    const gx = hx + sd * 0.36 * R;
    const gr = bg.createRadialGradient(gx, ey, 0, gx, ey, 1.6 * S);
    gr.addColorStop(0, 'rgba(255,255,255,0.72)'); gr.addColorStop(0.5, 'rgba(230,236,245,0.5)'); gr.addColorStop(1, 'rgba(230,236,245,0)');
    bg.fillStyle = gr; bg.beginPath(); bg.arc(gx, ey, 1.6 * S, 0, TAU); bg.fill();
  }
  // soft 0.8 px alpha edge
  const out = HZ.downsample(B, W, H), og = out.getContext('2d');
  const sm = mk(W, H), sg = sm.getContext('2d'); sg.filter = 'blur(0.5px)'; sg.drawImage(out, 0, 0);
  cv.getContext('2d').drawImage(sm, 0, 0);
};

/* ---------------------------------------------------------- DOOR-GAP PEEK (120x240)
 * The right-hand 30% of a Poppy face past a door edge: three dark petal tips, a slice of
 * cream felt cheek and ONE realistic wet eye at (70, 100), lit only by a thin warm spill
 * from the right; the left 30 px fade to transparent. */
A.hidden_peek = (cv) => {
  const W = cv.width, H = cv.height, S = 4, B = mk(W * S, H * S), g = B.getContext('2d', { willReadFrequently: true });
  const st = HZ.stage({ light: { x: 200 * S, y: 110 * S, z: 60 * S, col: [1.35, 1.1, 0.82], power: 1.6, d0: 120 * S }, ambient: [0.01, 0.01, 0.01] });
  g.scale(S, S);
  // the face: a big felt disc whose centre lies far to the left (only its right part shows)
  const fcx = -10, fcy = 112, FR = 96;
  const face = new Path2D(); face.ellipse(fcx, fcy, FR, FR * 1.05, 0, 0, TAU);
  // petal tips at the top and right
  const petals = [];
  for (const [a, rOut] of [[-1.15, 1.42], [-0.45, 1.5], [0.32, 1.45]]) {
    const p = new Path2D(), hw = 0.33;
    p.moveTo(fcx + Math.cos(a - hw) * FR * 0.8, fcy + Math.sin(a - hw) * FR * 0.8);
    for (let k = 0; k <= 12; k++) { const t = a - hw + 2 * hw * k / 12, rr = FR * rOut * (0.9 + 0.1 * Math.sin(Math.PI * k / 12)); p.lineTo(fcx + Math.cos(t) * rr, fcy + Math.sin(t) * rr); }
    p.lineTo(fcx + Math.cos(a + hw) * FR * 0.8, fcy + Math.sin(a + hw) * FR * 0.8); p.closePath(); petals.push(p);
  }
  HZ.pillowPP(g, st, (lg) => { for (const p of petals) { lg.fillStyle = '#3A0C10'; lg.fill(p); } }, { mat: MAT.felt, height: 6, round: 5, lw: 1 / S * S, seed: 'peekpet', z: 0 });
  HZ.pillowPP(g, st, (lg) => {
    const gr = lg.createRadialGradient(fcx + 40, fcy, 10, fcx, fcy, FR); gr.addColorStop(0, '#E4D2B2'); gr.addColorStop(1, '#B8A07C');
    lg.fillStyle = gr; lg.fill(face);
    lg.save(); lg.clip(face); lg.globalCompositeOperation = 'overlay'; lg.globalAlpha = 0.7; lg.setTransform(1, 0, 0, 1, 0, 0); lg.drawImage(P.feltTexture(W * S, H * S, 11, 1.6), 0, 0); lg.restore();
  }, { mat: Object.assign({}, MAT.felt, { fuzz: 0.5 }), height: 26, round: 30, lw: 1, seed: 'peekface', z: 10, noise: [1.2, 6] });
  // the eye (socket, real wet eye)
  g.save();
  const e = HZ.eyePP(g, st, { cx: 70, cy: 100, w: 44, open: 1.25, side: 1, iris: 0.205, pupil: 0.1, irisCol: ['#8C8C74', '#7E8C88', '#2E3A3A'], veins: 4, lowerFlat: 0.7,
    window: { x: -0.05, y: -0.25, s: 0.3, a: 1, panes: 1 }, lashes: 12, lashLen: 0.11, lidSkin: '#A08070', ring: 0.13, socket: 0.5, lw: 1, seed: 'peek:eye', z: 22, lidShadow: 0.6, gain: 1.3 });
  g.restore();
  g.setTransform(1, 0, 0, 1, 0, 0);
  // darkness: only a thin warm spill from the right reaches it; the left 30 px fade out
  const id = g.getImageData(0, 0, W * S, H * S), d = id.data;
  for (let y = 0; y < H * S; y++) for (let x = 0; x < W * S; x++) {
    const i = (y * W * S + x) * 4; if (!d[i + 3]) continue;
    const X = x / S, Y = y / S;
    const eyeD = Math.hypot(X - 70, Y - 100);
    const spill = 0.12 + 0.88 * sstep(50, 118, X) * (1 - 0.7 * sstep(25, 100, Math.abs(Y - 100)));
    const keep = Math.max(spill, 1 - sstep(16, 34, eyeD));
    d[i] *= keep; d[i + 1] *= keep; d[i + 2] *= keep;
    d[i + 3] *= sstep(0, 30, X) * (1 - sstep(225, 240, Y));
  }
  g.putImageData(id, 0, 0);
  cv.getContext('2d').drawImage(HZ.downsample(B, W, H), 0, 0);
};

/* ---------------------------------------------------------- DIRECT ADDRESS close-up (640x480, transparent)
 * Perfectly level and dead centre (that alone is wrong). Realistic wet eyes set into the felt,
 * pale grey irises with pinpoint pupils staring INTO the lens, the Stage 1 painted smile (corners
 * at the outer eye edges, never reaching the eyes), faded pink felt cheeks, soft cool TV glow from
 * 35 degrees below (forehead ~50% darker than the chin), petals mostly dark with a thin rim.
 * _talk: the same face with the mouth open in a rounded D and REAL teeth inside the felt. */
function address(talk) {
  const SS = SC.SS, R = 160, EW = 0.44, y0 = 0.3, mw = 0.27, top = y0 - 0.005, bot = y0 + 0.3;
  const eyes = [{ u: -0.38, v: -0.125, side: -1, seed: 'addr:eL' }, { u: 0.38, v: -0.125, side: 1, seed: 'addr:eR' }];
  const smile = (t) => [t * 0.6, y0 + 0.17 * (1 - t * t)];          // corners at the outer eye edges
  const dPath = () => { const p = new Path2D(); p.moveTo(-mw, top); p.quadraticCurveTo(0, top + 0.06, mw, top); p.bezierCurveTo(mw + 0.01, bot, -mw - 0.01, bot, -mw, top); p.closePath(); return p; };
  const dPts = () => { const pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push([lerp(-mw, mw, t), top + 0.06 * 2 * t * (1 - t) * 2 * 0.5]); }
    for (let i = 1; i < 40; i++) { const t = i / 40, a = 1 - t; // cubic bottom from (mw, top) back to (-mw, top)
      const x = a * a * a * mw + 3 * a * a * t * (mw + 0.01) + 3 * a * t * t * (-mw - 0.01) + t * t * t * (-mw), y = a * a * a * top + 3 * a * a * t * bot + 3 * a * t * t * bot + t * t * t * top; pts.push([x, y]); }
    return pts; };
  const c = {
    W: 640, H: 480, cx: 320, cy: 210, R, sx: 1, sy: 1, tilt: 0, seed: 'address3', boil: 'A', bg: null, hatch: false, contour: false,
    petalR: 1.5, petalCol: '#8A1E24', faceCol: '#E6D0AE', decay: 0.35, pills: 240, crumple: 0.12, petalRag: 0.03,
    nose: { x: 0, y: 0.13, s: 1.0 },
    lights: () => ({
      light: { x: 320 * SS, y: 640 * SS, z: 420 * SS, col: [0.84, 0.95, 1.16], power: 1.5, d0: 520 * SS },
      fill: { x: 320 * SS, y: -300 * SS, z: 900 * SS, col: [0.1, 0.1, 0.12], power: 0.3, d0: 4000 * SS },
      ambient: [0.018, 0.02, 0.028],
    }),
    tone: { exp: 1.1, shoulder: 1.2, gamma: 1.3 }, fuzzH: 0.9, pillH: 1.0, feltK: 0.85, stainK: 0.5,
    petalDim: 0.42, petalRim: '150,64,62', grain: 4,
  };
  c.albedo = (ag, G, U) => {
    G.sockets = eyes.map(e => { const pts = []; for (let k = 0; k < 72; k++) { const a = k / 72 * TAU, j = 1 + 0.03 * HZ.noise1(k * 0.6, e.u > 0 ? 3 : 7); pts.push([e.u + Math.cos(a) * EW * 0.6 * j, e.v + Math.sin(a) * EW * 0.42 * j]); } return U.mapPts(G.e, pts); });
    for (const s of G.sockets) { ag.fillStyle = '#1A1210'; ag.fill(U.path(s)); }
    // faded pink felt cheeks
    for (const sd of [-1, 1]) {
      const [x, y] = G.h(sd * 0.6, 0.22), gr = ag.createRadialGradient(x, y, 0, x, y, G.R * 0.15);
      gr.addColorStop(0, 'rgba(214,138,140,0.75)'); gr.addColorStop(0.75, 'rgba(214,138,140,0.55)'); gr.addColorStop(1, 'rgba(214,138,140,0)');
      ag.fillStyle = gr; ag.beginPath(); ag.ellipse(x, y, G.R * 0.15, G.R * 0.13, 0, 0, TAU); ag.fill();
    }
    ag.save(); ag.setTransform(G.TH);
    if (!talk) {
      // the Stage 1 painted smile (cherry felt paint, slightly faded), dimple ticks at the corners
      ag.lineCap = 'round'; ag.strokeStyle = '#6A1420'; ag.lineWidth = 0.034;
      const sp = new Path2D(); for (let i = 0; i <= 40; i++) { const [x, y] = smile(-1 + 2 * i / 40); if (!i) sp.moveTo(x, y); else sp.lineTo(x, y); } ag.stroke(sp);
      for (const sd of [-1, 1]) { const [ex, ey] = smile(sd); ag.lineWidth = 0.022; ag.beginPath(); ag.moveTo(ex - sd * 0.035, ey - 0.045); ag.quadraticCurveTo(ex + sd * 0.03, ey - 0.005, ex - sd * 0.01, ey + 0.045); ag.stroke(); }
    } else {
      // the open D: cherry lip rim, black inside (the teeth are added per pixel)
      ag.fillStyle = '#060203'; ag.fill(dPath()); ag.strokeStyle = '#6A1420'; ag.lineWidth = 0.03; ag.stroke(dPath());
    }
    ag.restore();
    if (talk) G.mouthScr = U.mapPts(G.h, dPts());
  };
  c.height = (h, mat, G, U) => {
    const R2 = G.R;
    for (const s of G.sockets) {
      const m = U.maskOf(g => g.fill(U.path(s)), 3), rim = U.maskOf(g => { g.lineWidth = R2 * 0.05; g.stroke(U.path(s)); }, R2 * 0.02);
      for (let i = 0; i < h.length; i++) { if (rim[i]) h[i] += rim[i] * R2 * 0.012; if (m[i]) h[i] -= m[i] * R2 * 0.05; }
    }
    if (talk) { const m = U.maskOf(g => g.fill(U.path(G.mouthScr)), 2), lip = U.maskOf(g => { g.lineWidth = R2 * 0.04; g.stroke(U.path(G.mouthScr)); }, R2 * 0.015);
      for (let i = 0; i < h.length; i++) { if (lip[i]) h[i] += lip[i] * R2 * 0.02; if (m[i]) h[i] -= m[i] * R2 * 0.25; } }
  };
  // neck and shoulders from the Act 1 bust, under the same cool glow; the head area is cut away
  c.background = (cg, G, U) => {
    const B = mk(G.W, G.H), bg = B.getContext('2d');
    P.drawPoppy(bg, { pose: 'close', R: 160, cx: 320, cy: 210, tilt: 0, seed: 7, eyes: 'button', mouth: 'smile', decay: 0.5, transform: [SS, 0, 0, SS, 0, 0], px: 1.875 * SS, texScale: 1.875 * SS });
    bg.save(); bg.globalCompositeOperation = 'destination-out'; bg.filter = 'blur(2px)';
    for (const p of G.petals) bg.fill(U.path(p.scr)); bg.fill(G.facePath); bg.restore();
    bg.save(); bg.globalCompositeOperation = 'source-atop';
    const gr = bg.createLinearGradient(0, 300 * SS, 0, 480 * SS);
    gr.addColorStop(0, 'rgba(4,6,10,0.9)'); gr.addColorStop(0.45, 'rgba(8,10,16,0.74)'); gr.addColorStop(1, 'rgba(14,18,28,0.6)');
    bg.fillStyle = gr; bg.fillRect(0, 0, G.W, G.H);
    bg.restore();
    const keep = mk(G.W, G.H); keep.getContext('2d').drawImage(B, 0, 0);
    bg.save(); bg.globalCompositeOperation = 'multiply'; bg.fillStyle = 'rgb(170,190,230)'; bg.fillRect(0, 0, G.W, G.H);
    bg.globalCompositeOperation = 'destination-in'; bg.drawImage(keep, 0, 0); bg.restore();
    cg.drawImage(B, 0, 0);
  };
  c.overlay = (cg, G, U) => {
    const LI = cg.getImageData(0, 0, G.W, G.H).data, litAt = (x, y) => { const i = (clamp(y | 0, 0, G.H - 1) * G.W + clamp(x | 0, 0, G.W - 1)) * 4; return Math.min(1.4, (LI[i] + LI[i + 1] + LI[i + 2]) / 3 / 200 + 0.05); };
    eyes.forEach((e, k) => SC.eyeInSocket(cg, G, Object.assign({ socketPath: G.sockets[k], w: EW, open: 1.25, iris: 0.205, pupil: 0.1, irisCol: ['#A4A8A2', '#9AA4A8', '#3E484E'], veins: 4, gaze: [0, 0], lowerFlat: 0.85,
      window: { x: 0, y: -0.05, s: 0.28, a: 0.95 }, lidSkin: '#A48478', ring: 0.11, recess: 0.04, lidShadow: 0.55, lashes: 14, shadeLo: 0.45, shadeA: -1.2, shadeB: 1.2, gain: 1.15, rimShadow: 0.35, lidSpread: 1.45 }, e)));
    G.sockets.forEach((s, k) => SC.fray(cg, s, { n: 2, len: [2, 6], side: 1, seed: 'addr:sf' + k, col: [220, 206, 182], alpha: [0.25, 0.6], light: litAt, every: 2 }));
    if (talk) {
      const R2 = G.R, upL = [], loL = [];
      for (let i = 0; i <= 30; i++) { const x = lerp(-mw * 0.92, mw * 0.92, i / 30); upL.push([x, top + 0.03 * (1 - Math.pow(x / mw, 2)) + 0.028]); loL.push([x * 0.8, bot - 0.035 - 0.06 * Math.pow(x / mw, 2)]); }
      SC.mouthPP(cg, G, {
        open: dPts(),
        rows: [
          { line: loL, dir: -1, n: 8, len: 0.05, persp: 0.4, lower: true, z: R2 * 0.02, zBack: R2 * 0.04, ao: [0.75, 0.4], seed: 'addr:l', crooked: 1.8, jit: 0.25 },
          { line: upL, dir: 1, n: 11, len: 0.085, persp: 0.42, z: R2 * 0.05, zBack: R2 * 0.06, ao: [1, 0.45], seed: 'addr:u', crooked: 1.6, jit: 0.25, gum: { depth: 0.04, height: 0.01, round: 0.008, pap: 0.24, arc: 0.07 } },
        ],
        shadowLip: [{ pts: dPts().slice(0, 31), width: 0.02, blur: 4, a: 0.6 }], ivory: '#ECE2CC',
      });
    }
  };
  return SC.buildFace(c);
}
A.poppy_address = (cv) => { const { out } = address(false); cv.getContext('2d').drawImage(out, 0, 0); };
A.poppy_address_talk = (cv) => { const { out } = address(true); cv.getContext('2d').drawImage(out, 0, 0); };

root.Poppy.WRONG = { at2x, studio, wornFace, blackButton, resewnMouth, wrongOpts, neckSkin, address };
})(typeof window !== 'undefined' ? window : globalThis);
