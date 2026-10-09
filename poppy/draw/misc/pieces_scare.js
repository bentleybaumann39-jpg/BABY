/* pieces_scare.js - THE WORLD OF POPPY: scare-pass misc art (loaded last by
 * render_misc.cjs, after helpers.js, the pieces and ../poppy.js, ../horror.js,
 * ../scare.js). Replaces feel_hungry, sub_eyes_dark and sub_teeth, adds
 * sub_scrawl_face and crt_glass.
 *
 * Realism in the wrong place: the eyes and teeth are shaded per pixel (HZ.eyePP,
 * HZ.teethPP, HZ.gumsPP) inside felt; the subliminals reuse the scare-face
 * builder (Poppy.SCARE.buildFace): underlit, mostly black, hatched shadows.
 * No blood, no wounds; human teeth, never fangs.
 */
(function (root) {
'use strict';
const M = root.MH, HZ = root.HZ, SC = root.Poppy.SCARE, LIB = root.MISCLIB;
const { TAU, DEG, lerp, clamp, sstep, rng, mk, MAT } = HZ;
const MISC = root.MISC = root.MISC || {};

/* a stage whose lights are given in LOGICAL px of g (converted to device px) */
function stageFor(g, o) {
  const m = g.getTransform(), s = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
  const cv = (l) => l && Object.assign({}, l, { x: m.a * l.x + m.c * l.y + m.e, y: m.b * l.x + m.d * l.y + m.f, z: l.z * s, d0: (l.d0 || 400) * s });
  return HZ.stage({ light: cv(o.light), fill: o.fill ? [].concat(o.fill).map(cv) : null, ambient: o.ambient });
}
/* draw a 2x scare-builder canvas into g's logical frame */
function blit2x(g, out, W, H) { g.save(); g.imageSmoothingQuality = 'high'; g.drawImage(out, 0, 0, W, H); g.restore(); }

/* ======================================================= FEEL: HUNGRY
 * The fifth feelings face that should not exist. Same card as the other four;
 * sickly pale cream-grey felt with grime in the creases; REAL wet eyes set into
 * the felt (white above the irises, pinpoint pupils, no catchlight); a cut-felt
 * mouth stretched past the face outline and packed with 32 real teeth in two
 * rows, wet gums above and below; HUNGRY in crooked marker. */
const FX = 120, FY = 116, FR = 90;
MISC.feel_hungry = function (g, W, H) {
  const r = rng('hungry2');
  LIB.cardBase(g, 'hungry', { card: '#EFE9D6', band: 'rgba(150,145,120,0.45)', edge: 'rgba(120,110,90,0.8)',
    dirty: q => {
      for (let i = 0; i < 12; i++) { q.fillStyle = `rgba(110,100,70,${0.05 + r() * 0.08})`; q.filter = M.blur(q, 6); q.beginPath(); q.ellipse(r() * W, r() * H, 20 + r() * 30, 10 + r() * 20, r() * 3, 0, TAU); q.fill(); }
      q.filter = 'none';
    } });
  const face = LIB.faceDisc(g, '#CFC9B2', 'hungry', { stitch: 'rgba(120,110,95,0.8)', tex: 0.9, wob: 0.006 });
  const fp = M.pathOf(face);
  const st = stageFor(g, { light: { x: FX - 160, y: FY - 260, z: 420, col: [1.12, 1.1, 1.04], power: 1.25, d0: 1e5 }, ambient: [0.12, 0.12, 0.13] });
  // grime: grey-brown multiply darkening around the eyes, the mouth corners and the rim
  g.save(); g.clip(fp); g.globalCompositeOperation = 'multiply';
  for (const [x, y, rx, ry, a] of [[FX - 31, FY - 18, 30, 22, 0.55], [FX + 31, FY - 18, 30, 22, 0.55], [FX - 84, FY + 24, 18, 24, 0.5], [FX + 84, FY + 24, 18, 24, 0.5], [FX, FY + 88, 80, 14, 0.4], [FX + 20, FY - 70, 30, 14, 0.25]]) {
    const gg = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    gg.addColorStop(0, `rgba(120,110,92,${a})`); gg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gg; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
  }
  g.restore();
  // ---- the eyes: real, wet, white above the irises, pinpoint pupils, NO catchlight
  for (const s of [-1, 1]) {
    // a dark felt socket cut around each eye
    g.save(); g.fillStyle = 'rgba(40,30,22,0.8)'; g.filter = M.blur(g, 1.0); g.beginPath(); g.ellipse(FX + s * 31, FY - 20, 25, 15, 0, 0, TAU); g.fill(); g.restore();
    HZ.eyePP(g, st, { cx: FX + s * 31, cy: FY - 20, w: 46, open: 1.32, side: s, iris: 0.19, pupil: 0.1, irisCol: ['#9A9C8A', '#8E9A96', '#3A4646'], veins: 3, lowerFlat: 0.85,
      gaze: [-s * 0.02, 0.0], window: false, lashes: 11, lashLen: 0.1, lidSkin: '#A08A7E', ring: 0.1, lidSpread: 0.98, socket: 0.25, lw: 1, seed: 'hungry:eye' + s, lidShadow: 0.45, wetK: 1.1 });
  }
  // ---- the mouth: cut felt stretched 8% past the face outline on both sides, real teeth inside
  const hw = FR * 1.16, my = FY + 30;
  const cl = (t) => my + 16 * (1 - t * t) - 10, op = (t) => 24 * Math.pow(Math.max(0, 1 - t * t), 0.55) + 0.8;
  const up = [], lo = [];
  for (let i = 0; i <= 80; i++) { const t = -1 + 2 * i / 80, x = FX + t * hw; up.push([x, cl(t) - op(t) * 0.48 + (r() - 0.5) * 0.6]); lo.push([x, cl(t) + op(t) * 0.52 + (r() - 0.5) * 0.6]); }
  const mp = HZ.polyPath(up.concat(lo.slice().reverse()), true);
  // felt-lip thickness: a soft shadow cut into the felt, then the black opening
  g.save(); g.filter = M.blur(g, 1.5); g.strokeStyle = 'rgba(40,25,15,0.6)'; g.lineWidth = 4; g.stroke(mp); g.restore();
  const L = M.layerLike ? M.layerLike(g) : null;
  const lay = mk(g.canvas.width, g.canvas.height), lg = lay.getContext('2d', { willReadFrequently: true }); lg.setTransform(g.getTransform());
  lg.fillStyle = '#070203'; lg.fill(mp);
  const ul = [], ll = [];
  for (let i = 0; i <= 40; i++) { const t = -0.94 + 1.88 * i / 40, x = FX + t * hw; ul.push([x, cl(t) - op(t) * 0.48 + 2.2]); ll.push([x * 1 + 0, cl(t) + op(t) * 0.52 - 2.2]); }
  const TU = HZ.archTeeth(ul, { dir: 1, n: 17, len: 11.5, persp: 0.45, seed: 'hungry:u', crooked: 2.4, jit: 0.3, ao: [1, 0.45], lw: 1, gapK: 0.05 });
  const TL = HZ.archTeeth(ll, { dir: -1, n: 15, len: 9.5, persp: 0.45, lower: true, seed: 'hungry:l', crooked: 2.6, jit: 0.3, ao: [0.95, 0.42], lw: 1, gapK: 0.05 });
  HZ.teethPP(lg, st, HZ.mergeRows(TU, TL), { sorted: true, lw: 1, ivory: '#E8DFC8' });
  HZ.gumsPP(lg, st, TU, ul, { dir: 1, depth: 4.5, height: 1.4, round: 0.9, lw: 1, seed: 'hungry:gu', fade: 0.35 });
  HZ.gumsPP(lg, st, TL, ll, { dir: -1, depth: 4.5, height: 1.4, round: 0.9, lw: 1, seed: 'hungry:gl', fade: 0.35 });
  lg.save(); lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalCompositeOperation = 'destination-in';
  const mm = mk(lay.width, lay.height), mg = mm.getContext('2d'); mg.setTransform(g.getTransform()); mg.fillStyle = '#fff'; mg.fill(mp);
  lg.drawImage(mm, 0, 0); lg.restore();
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(lay, 0, 0); g.restore();
  // contact shadow of the felt lips on the teeth, frayed cut edges with loose fibres crossing in front
  g.save(); g.clip(mp); g.filter = M.blur(g, 1.2); g.strokeStyle = 'rgba(0,0,0,0.65)'; g.lineWidth = 2.6; g.stroke(mp); g.restore();
  SC.fray(g, up, { n: 2, len: [1.2, 4.5], side: 1, seed: 'hungry:fu', col: [214, 206, 182], alpha: [0.45, 0.95], w: [0.3, 0.7] });
  SC.fray(g, lo, { n: 2, len: [1.2, 4.5], side: -1, seed: 'hungry:fl', col: [214, 206, 182], alpha: [0.45, 0.95], w: [0.3, 0.7] });
  // ---- word strip, then HUNGRY in marker: crooked, slightly too big
  LIB.wordStrip(g, 'hungry', '#F4F1E8');
  g.save();
  g.translate(FX + 3, 268); g.rotate(-6 * DEG); g.scale(0.86, 1);
  const marker = (dx, dy, col, wgt) => M.strokeText(g, 'tech', 'HUNGRY', dx, dy, 37, { align: 'center', color: col, weight: wgt, jitter: 0.01, rot: 6, bounce: 0.06, scaleJit: 0.08, track: 0.02, seed: 'hungrymk' });
  g.filter = M.blur(g, 0.7); marker(0.4, 0.6, 'rgba(10,10,20,0.35)', 0.19); g.filter = 'none';
  marker(0, 0, '#121018', 0.155);
  g.restore();
  M.grain(g, W, H, 0.03, 'hungry');
};

/* ======================================================= SUB S1: EYES IN THE DARK
 * Two realistic wet eyes in the left third, underlit from 45 degrees below, open
 * 140%, pinpoint pupils, catchlights dead centre, the left eye 5% of the frame
 * higher; a sliver of lit felt cheek, the faintest edge of dark petals; the dark
 * felt hatched (Ito); everything else black. */
MISC.sub_eyes_dark = function (g, W, H) {
  const c = {
    W: 640, H: 480, cx: 128, cy: 262, R: 200, sx: 1, sy: 1.04, tilt: -6, eyeTilt: 0, crumple: 0.5, seed: 'subeyes2', boil: 'A', noDown: true,
    petalR: 1.48, petalCol: '#2A070A', faceCol: '#C6BCA6', decay: 0.6, pills: 120, nose: { x: 0.02, y: 0.16, s: 1 },
    lights: () => ({ light: { x: 135 * 2, y: 430 * 2, z: 190 * 2, col: [1.15, 1.05, 0.95], power: 1.5, d0: 170 * 2, cut: 0.3, cutSoft: 0.15 }, ambient: [0.002, 0.002, 0.002] }),
    tone: { exp: 1.7, shoulder: 1.5, gamma: 1.1 }, fuzzH: 0.5, pillH: 0.7, feltK: 0.8, petalDim: 0.35, petalRim: '110,30,30',
    lost: { ang: 0, a: 0.5, b: 1.3, k: 0.95 }, hatch: { n: 520, band: [0.015, 0.08, 0.3] },
  };
  const EW = 0.42, eyes = [{ u: -0.3, v: -0.08 - 0.12, side: -1, seed: 'se:l' }, { u: 0.3, v: -0.08, side: 1, seed: 'se:r' }];
  // slits cut in the felt hugging the eyes: no rings round them (they read as goggles)
  c.albedo = (ag, G, U) => {
    G.sockets = eyes.map(e => {
      const S = HZ.eyeShape({ w: EW, open: 1.42, side: e.side, lowerFlat: 0.85 }), [ex, ey] = G.e(e.u, e.v), k = G.kf(e.u);
      const TU = new DOMMatrix().translate(ex, ey).scale(G.R * G.sx * k, G.R * G.sx * k), r = rng(e.seed + ':slit');
      const pts = S.up.map(([x, y]) => [x * 1.03, y * 1.04 - 0.004 + (r() - 0.5) * 0.006]).concat(S.lo.slice().reverse().map(([x, y]) => [x * 1.03, y * 1.05 + 0.005 + (r() - 0.5) * 0.006]));
      return pts.map(([x, y]) => { const p = TU.transformPoint(new DOMPoint(x, y)); return [p.x, p.y]; });
    });
    for (const s of G.sockets) { ag.fillStyle = '#0A0808'; ag.fill(U.path(s)); }
  };
  c.height = (h, mat, G, U) => {
    for (const s of G.sockets) { const m = U.maskOf(q => q.fill(U.path(s)), G.R * 0.03); for (let i = 0; i < h.length; i++) if (m[i]) h[i] -= m[i] * G.R * 0.05; }
  };
  // darkness closes in on everything but the eyes and a sliver of cheek under them
  c.grade = (cg, G) => {
    const id = cg.getImageData(0, 0, G.W, G.H), d = id.data, [ex, ey] = G.e(0, -0.14);
    for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) {
      const dx = (x - ex) / (G.R * 0.95), dy = (y - ey - G.R * 0.08) / (G.R * 0.5), k = 1 - 0.9 * sstep(0.7, 1.7, Math.hypot(dx, dy));
      const i = (y * G.W + x) * 4; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
    }
    cg.putImageData(id, 0, 0);
  };
  c.overlay = (cg, G) => {
    eyes.forEach((e, k) => SC.eyeInSocket(cg, G, Object.assign({ socketPath: G.sockets[k], w: EW, open: 1.42, iris: 0.19, pupil: 0.09, irisCol: ['#7E7A66', '#86969A', '#2E3C42'], veins: 5, lowerFlat: 0.85,
      window: { x: 0, y: -0.05, s: 0.3, a: 0.97 }, ring: 0, socket: 0.5, recess: 0.03, lidShadow: 0.8, lashes: 14, shadeLo: 0.22, gain: 2.1, marginA: 0.12, rimShadow: 0.85 }, e)));
  };
  const { out } = SC.buildFace(c);
  blit2x(g, out, W, H);
};

/* ======================================================= SUB S2: TEETH
 * Extreme close-up: cream felt lips with fibres and frayed cut edges parted on
 * REAL teeth, two rows of ~36, scalloped wet gums above the upper row; underlit
 * so the teeth and the lower lip glow and everything else falls into black; the
 * mouth runs off both frame edges; dark petal tips barely in the top corners. */
MISC.sub_teeth = function (g, W, H) {
  const R = 300, MXH = 1.25;
  const yU = (x) => { const t = clamp(x / MXH, -1, 1); return 0.36 + 0.08 * (1 - t * t) - 0.14 * t * t + 0.01 * Math.sin(x * 13); };
  const yL = (x) => { const t = clamp(x / MXH, -1, 1); return yU(x) + 0.4 * Math.pow(Math.max(0, 1 - t * t), 0.6) + 0.04; };
  const lips = SC.lipOpening(-MXH, MXH, yU, yL, 120, 0.006, 'subteeth');
  const c = {
    W: 640, H: 480, cx: 320, cy: 92, R, sx: 1, sy: 1, tilt: 0, crumple: 0.4, seed: 'subteeth2', boil: 'A', noDown: true,
    petalR: 1.5, petalCol: '#2A070A', faceCol: '#D6C8A8', decay: 0.5, pills: 260, nose: false,
    lights: () => ({ light: { x: 330 * 2, y: 560 * 2, z: 190 * 2, col: [1.25, 1.12, 0.98], power: 2.5, d0: 220 * 2, cut: 0.15, cutSoft: 0.15 }, ambient: [0.002, 0.002, 0.002] }),
    tone: { exp: 1.8, shoulder: 1.6, gamma: 1.05 }, fuzzH: 0.8, pillH: 0.9, feltK: 0.9, petalDim: 0.22, petalShadowK: 0.85, petalRim: '90,26,26', jaw: 0.08,
    hatch: { n: 380 },
  };
  c.albedo = (ag, G, U) => { G.mouthScr = U.mapPts(G.h, lips.open); ag.fillStyle = '#050203'; ag.fill(U.path(G.mouthScr)); };
  c.height = (h, mat, G, U) => {
    const mp = U.path(G.mouthScr), R2 = G.R;
    const lip = U.maskOf(q => { q.lineWidth = R2 * 0.07; q.lineJoin = 'round'; q.stroke(mp); }, R2 * 0.02), m = U.maskOf(q => q.fill(mp), 2.5);
    for (let i = 0; i < h.length; i++) { if (lip[i]) h[i] += lip[i] * R2 * 0.04; if (m[i]) h[i] -= m[i] * R2 * 0.3; }
  };
  c.overlay = (cg, G) => {
    const R2 = G.R, up = [], lo = [];
    for (let i = 0; i <= 80; i++) { const x = lerp(-MXH * 0.98, MXH * 0.98, i / 80); up.push([x, yU(x) + 0.05]); lo.push([x * 0.97, yL(x) - 0.05]); }
    SC.mouthPP(cg, G, {
      open: lips.open,
      rows: [
        { line: up, dir: 1, n: 19, len: 0.16, persp: 0.4, z: R2 * 0.06, zBack: R2 * 0.1, ao: [1, 0.45], seed: 'st:u', crooked: 2.2, jit: 0.22, gum: { depth: 0.08, height: 0.014, round: 0.012, pap: 0.24, arc: 0.07 } },
        { line: lo, dir: -1, n: 17, len: 0.12, persp: 0.4, lower: true, z: R2 * 0.04, zBack: R2 * 0.1, ao: [0.95, 0.4], seed: 'st:l', crooked: 2.5, jit: 0.22 },
      ],
      shadowLip: [{ pts: lips.up, width: 0.03, blur: 6, a: 0.6 }], ivory: '#E8DCC0',
    });
    const LI = cg.getImageData(0, 0, G.W, G.H).data, litAt = (x, y) => { const i = (clamp(y | 0, 0, G.H - 1) * G.W + clamp(x | 0, 0, G.W - 1)) * 4; return Math.min(1.4, (LI[i] + LI[i + 1] + LI[i + 2]) / 3 / 200 + 0.04); };
    SC.fray(cg, U2(G, lips.up), { n: 3, len: [3, 12], side: 1, seed: 'st:fu', col: [214, 200, 172], alpha: [0.45, 0.95], light: litAt });
    SC.fray(cg, U2(G, lips.lo), { n: 3, len: [3, 12], side: -1, seed: 'st:fl', col: [214, 200, 172], alpha: [0.45, 0.95], light: litAt });
  };
  const U2 = (G, pts) => pts.map(([u, v]) => G.h(u, v));
  const { out } = SC.buildFace(c);
  blit2x(g, out, W, H);
};

/* ======================================================= SUB S6: THE SCRAWL
 * An obsessive ballpoint drawing of Poppy's face on yellowed, creased lined
 * paper under a weak lamp: every contour overdrawn 3-4 times with tremor, the
 * petal ring as frantic loops, the eyes cross-hatched black voids with one tiny
 * glint each (the left higher), a mouth of dozens of small teeth drawn one by
 * one, 400+ hatch strokes, and along the bottom: SHE FINDS YOU ON TEN. */
MISC.sub_scrawl_face = function (g, W, H) {
  const r = rng('scrawl');
  const s = M.scaleOf(g);
  // paper: yellowed, ruled, creased, lamp-lit from the upper left, vignetted to dark
  g.fillStyle = '#D9CBA0'; g.fillRect(0, 0, W, H);
  M.texFill(g, M.paperTex(256, 'scrawl'), null, 'overlay', 0.9);
  g.save(); g.strokeStyle = 'rgba(90,120,160,0.45)'; g.lineWidth = 1;
  for (let y = 40; y < H; y += 26) { g.beginPath(); g.moveTo(0, y + Math.sin(y) * 0.6); g.lineTo(W, y + 1.5 + Math.sin(y * 0.3)); g.stroke(); }
  g.strokeStyle = 'rgba(190,70,70,0.4)'; g.beginPath(); g.moveTo(58, 0); g.lineTo(60, H); g.stroke();
  g.restore();
  // creases: a fold line with a light and a dark side, plus small crumples
  for (const [x0, y0, x1, y1] of [[0, 300, 640, 250], [420, 0, 380, 480], [0, 90, 250, 0]]) {
    g.save(); g.lineCap = 'round';
    g.filter = M.blur(g, 2); g.strokeStyle = 'rgba(70,50,20,0.35)'; g.lineWidth = 4; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.filter = M.blur(g, 1); g.strokeStyle = 'rgba(255,248,220,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0 + 2, y0 + 2); g.lineTo(x1 + 2, y1 + 2); g.stroke();
    g.restore();
  }
  // ballpoint: tremor lines in device px
  const ink = '22,26,58', T = (pts, o) => HZ.tremor(g, pts.map(([x, y]) => { const m = g.getTransform(); return [m.a * x + m.e, m.d * y + m.f]; }),
    Object.assign({ lw: s, col: ink, alpha: 0.85, passes: 3, amp: [0.6, 1.5], w: [0.6, 2.2], off: [0.5, 1.5] }, o));
  const fx = 320, fy = 205, fr = 118;
  // petal ring: frantic overlapping loops, gone over again and again
  for (let k = 0; k < 9; k++) {
    const a0 = -Math.PI / 2 + k * TAU / 9 + (r() - 0.5) * 0.1;
    for (let pass = 0; pass < 4; pass++) {
      const loop = [], sw = 0.85 + r() * 0.25, reach = 0.5 + r() * 0.2, wob = r() * 6;
      for (let i = 0; i <= 70; i++) {
        const t = i / 70, a = a0 + (t - 0.5) * sw, rr = fr * (1.02 + reach * Math.pow(Math.sin(Math.PI * t), 0.8) + 0.07 * Math.sin(t * 26 + wob + k));
        loop.push([fx + Math.cos(a) * rr, fy + Math.sin(a) * rr * 0.98]);
      }
      T(loop, { closed: false, passes: 2, off: [0.5, 2.5], seed: 'sc:p' + k + ':' + pass });
    }
    // looping scribble filling each petal (the pen never lifts)
    const sc = [];
    for (let i = 0; i <= 160; i++) { const t = i / 160, a = a0 + Math.sin(t * 31 + k) * 0.28, rr = fr * (1.08 + 0.42 * Math.abs(Math.sin(t * 7.3)) + 0.04 * Math.sin(t * 90)); sc.push([fx + Math.cos(a) * rr, fy + Math.sin(a) * rr]); }
    T(sc, { closed: false, passes: 1, alpha: 0.55, w: [0.5, 1.3], seed: 'sc:ps' + k });
  }
  // face circle, overdrawn again and again
  for (let pass = 0; pass < 3; pass++) {
    const circ = [], jr = 1 + (r() - 0.5) * 0.04; for (let i = 0; i < 100; i++) { const a = i / 100 * TAU + pass; circ.push([fx + Math.cos(a) * fr * jr, fy + Math.sin(a) * fr * 0.98 * jr]); }
    T(circ, { closed: true, passes: 3, off: [0.8, 3], w: [0.8, 2.6], seed: 'sc:face' + pass });
  }
  // pressure blots where the pen stopped
  for (let k = 0; k < 7; k++) { const a = r() * TAU, rr = fr * (0.98 + r() * 0.5); g.fillStyle = `rgba(${ink},${0.5 + r() * 0.4})`; g.beginPath(); g.ellipse(fx + Math.cos(a) * rr, fy + Math.sin(a) * rr, 1.5 + r() * 2.5, 1.2 + r() * 2, r() * 3, 0, TAU); g.fill(); }
  // eyes: dense cross-hatched black voids, one tiny glint each, the left one higher
  // eyes: irregular almond voids (pointed corners, slanted, uneven), not round patches
  const eyes = [[fx - 46, fy - 30, 40, 17, -0.22], [fx + 46, fy - 16, 37, 15, 0.3]];
  for (const [ex, ey, rx, ry, rot] of eyes) {
    const ov = []; for (let i = 0; i < 60; i++) { const t = i / 60 * TAU, c = Math.cos(t), sn = Math.sin(t), yy = sn * ry * Math.pow(Math.abs(sn), -0.15) * (sn < 0 ? 1.15 : 0.8) * (1 + 0.08 * Math.sin(t * 5 + ex)), xx = c * rx * (1 + 0.05 * Math.sin(t * 3));
      ov.push([ex + xx * Math.cos(rot) - yy * Math.sin(rot), ey + xx * Math.sin(rot) + yy * Math.cos(rot)]); }
    T(ov, { closed: true, passes: 4, w: [1, 2.5], seed: 'sc:e' + ex });
    g.save(); g.beginPath(); g.moveTo(ov[0][0], ov[0][1]); for (const q of ov) g.lineTo(q[0], q[1]); g.closePath(); g.clip();
    g.lineCap = 'round';
    for (const ang of [0.8, -0.7, 0.1, 1.5]) for (let k = -40; k <= 40; k += 1.6) {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      g.strokeStyle = `rgba(${ink},${0.55 + r() * 0.35})`; g.lineWidth = 0.6 + r() * 0.9;
      g.beginPath(); g.moveTo(ex - ca * 50 - sa * k + (r() - 0.5) * 2, ey - sa * 50 + ca * k + (r() - 0.5) * 2); g.lineTo(ex + ca * 50 - sa * k + (r() - 0.5) * 2, ey + sa * 50 + ca * k + (r() - 0.5) * 2); g.stroke();
    }
    g.restore();
    g.fillStyle = 'rgba(232,222,190,0.95)'; g.beginPath(); g.arc(ex - 2, ey - 3, 2.4, 0, TAU); g.fill();
  }
  // nose: a pressed-hard black blot
  g.save(); g.fillStyle = `rgba(${ink},0.9)`; g.beginPath(); g.ellipse(fx, fy + 20, 10, 7, 0, 0, TAU); g.fill(); g.restore();
  T([[fx - 12, fy + 18], [fx + 12, fy + 17]], { closed: false, passes: 3, seed: 'sc:n' });
  // mouth: running off the face, dozens of small rectangular teeth drawn one by one in two rows
  const mouthL = 160, my = fy + 52;
  const upLine = [], loLine = [];
  for (let i = 0; i <= 60; i++) { const t = -1 + 2 * i / 60, x = fx + t * mouthL; upLine.push([x, my - 14 * (1 - t * t) + 10 * t * t - 6]); loLine.push([x, my + 30 * (1 - t * t) + 4 * t * t + 8]); }
  T(upLine, { closed: false, passes: 4, w: [1, 2.5], seed: 'sc:mu' }); T(loLine, { closed: false, passes: 4, w: [1, 2.5], seed: 'sc:ml' });
  const teethRow = (line, dir, n, L, seed) => {
    const Lt = HZ.arcLen(line);
    for (let k = 0; k < n; k++) {
      const s0 = Lt * (k + 0.1) / n, s1 = Lt * (k + 0.9) / n, a = HZ.along(line, s0), b = HZ.along(line, s1);
      const lk = L * (0.8 + r() * 0.4) * (1 - 0.4 * Math.abs(k / n - 0.5) * 2);
      const rect = [[a[0], a[1]], [a[0], a[1] + dir * lk], [b[0], b[1] + dir * lk], [b[0], b[1]]];
      T(rect, { closed: false, passes: 2, w: [0.6, 1.4], amp: [0.4, 1], seed: seed + k });
    }
  };
  teethRow(upLine, 1, 26, 16, 'sc:tu'); teethRow(loLine, -1, 24, 13, 'sc:tl');
  // the inside of the mouth scribbled dark between the rows
  g.save();
  const mp = HZ.polyPath(upLine.map(([x, y]) => [x, y + 15]).concat(loLine.map(([x, y]) => [x, y - 12]).reverse()), true); g.clip(mp);
  for (let k = 0; k < 220; k++) { const x = fx + (r() - 0.5) * mouthL * 1.9, y = my + (r() - 0.3) * 28; g.strokeStyle = `rgba(${ink},${0.35 + r() * 0.4})`; g.lineWidth = 0.6 + r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14 + r() * 10, y + (r() - 0.5) * 8); g.stroke(); }
  g.restore();
  // hatched shadows (400+ strokes) on the lower face and down one side
  g.save(); g.beginPath(); g.ellipse(fx, fy, fr, fr * 0.98, 0, 0, TAU); g.clip(); g.lineCap = 'round';
  for (let k = 0; k < 900; k++) {
    const a = r() * TAU, rr = fr * Math.sqrt(r()), x = fx + Math.cos(a) * rr, y = fy + Math.sin(a) * rr;
    const dark = sstep(-0.35, 0.8, (x - fx) / fr * 0.6 + (y - fy) / fr * 0.8); if (r() > dark) continue;
    const ang = r() < 0.5 ? 0.9 : -0.6, L = 8 + r() * 14;
    g.strokeStyle = `rgba(${ink},${0.4 + r() * 0.4})`; g.lineWidth = 0.5 + r() * 0.8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * L, y + Math.sin(ang) * L); g.stroke();
  }
  g.restore();
  // the line at the bottom margin, in shaky capitals
  const txt = M.strokeText(g, 'tech', 'SHE FINDS YOU ON TEN', 320, 404, 36, { align: 'center', noDraw: true, jitter: 0.02, rot: 3, bounce: 0.06, scaleJit: 0.08, seed: 'scrawltxt' });
  for (const [k, stroke] of txt.strokes.entries()) T(stroke, { closed: false, passes: 3, w: [1.6, 3.2], amp: [0.5, 1.1], alpha: 0.95, seed: 'sc:t' + k });
  // weak lamp: warm, from the upper left, falling to near black at the edges
  g.save();
  const lamp = g.createRadialGradient(300, 200, 30, 315, 225, 420);
  lamp.addColorStop(0, 'rgba(255,240,200,0)'); lamp.addColorStop(0.35, 'rgba(30,20,5,0.25)'); lamp.addColorStop(0.75, 'rgba(10,6,0,0.78)'); lamp.addColorStop(1, 'rgba(0,0,0,0.96)');
  g.fillStyle = lamp; g.fillRect(0, 0, W, H);
  g.restore();
  M.grain(g, W, H, 0.035, 'scrawl');
};

/* ======================================================= CRT GLASS overlay
 * The glass of a switched-off 1990s CRT, head-on: a soft curved specular band
 * from the upper left toward the centre (6-10% white), dust specks and one
 * fingerprint smudge (3-5%), a faint convex-glass vignette, and the rounded
 * tube edge darkening to opaque black in the corners (radius ~60). */
MISC.crt_glass = function (g, W, H) {
  const r = rng('crt');
  // tube edge: opaque black outside a rounded rectangle, a soft falloff inside it
  const L = mk(g.canvas.width, g.canvas.height), lg = L.getContext('2d'); lg.setTransform(g.getTransform());
  lg.fillStyle = '#000'; lg.fillRect(0, 0, W, H);
  lg.globalCompositeOperation = 'destination-out'; lg.filter = M.blur(lg, 10);
  lg.beginPath(); lg.roundRect(12, 10, W - 24, H - 20, 60); lg.fill();
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(L, 0, 0); g.restore();
  g.save(); g.beginPath(); g.rect(0, 0, W, H); g.roundRect(4, 3, W - 8, H - 6, 64); g.fillStyle = '#000'; g.fill('evenodd'); g.restore();
  // convex-glass vignette
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  // the specular band: a feathered curved sweep from the upper left toward the centre
  g.save(); g.filter = M.blur(g, 16);
  const band = new Path2D(); band.moveTo(30, 40); band.quadraticCurveTo(200, 20, 360, 150); band.quadraticCurveTo(250, 120, 60, 130); band.closePath();
  const bg = g.createLinearGradient(30, 40, 360, 160); bg.addColorStop(0, 'rgba(255,255,255,0.1)'); bg.addColorStop(0.6, 'rgba(255,255,255,0.07)'); bg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = bg; g.fill(band);
  g.filter = M.blur(g, 5); g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 6; g.beginPath(); g.moveTo(40, 60); g.quadraticCurveTo(190, 40, 330, 140); g.stroke();
  g.restore();
  // a dim second reflection low on the right (the room's window)
  g.save(); g.filter = M.blur(g, 22); g.fillStyle = 'rgba(200,215,255,0.035)'; g.beginPath(); g.ellipse(500, 360, 70, 40, -0.3, 0, TAU); g.fill(); g.restore();
  // dust specks
  for (let i = 0; i < 160; i++) {
    const x = 20 + r() * (W - 40), y = 20 + r() * (H - 40), s = 0.4 + r() * 1.3;
    g.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.06})`; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
  }
  // one fingerprint smudge: whorled ridges at 3-5%
  g.save(); g.translate(452, 196); g.rotate(-0.4); g.scale(1, 1.35); g.lineWidth = 1.1;
  for (let k = 0; k < 16; k++) {
    g.strokeStyle = `rgba(255,255,255,${0.035 + r() * 0.015})`;
    g.beginPath(); g.ellipse(Math.sin(k) * 1.5, k * 0.6, 4 + k * 1.6, 3 + k * 1.3, 0.1 * Math.sin(k * 0.7), 0.3, TAU - 0.4 + r() * 0.3); g.stroke();
  }
  g.filter = M.blur(g, 6); g.fillStyle = 'rgba(255,255,255,0.03)'; g.beginPath(); g.ellipse(0, 6, 26, 22, 0, 0, TAU); g.fill();
  g.restore();
};

root.MISCLIB.scare = { stageFor, blit2x };
})(typeof window !== 'undefined' ? window : globalThis);
