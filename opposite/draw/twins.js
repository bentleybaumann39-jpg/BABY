/* twins.js - OPPOSITE DAY: BIM and MIB, the felt mirror-twins (HTML canvas 2D).
 *
 * Built on felt.js (window.FELT). Exposes window.OPP:
 *   OPP.CHAR[name](canvas)     draws one char_art manifest entry (final size)
 *   OPP.drawTwin(canvas, o)    full-body twin on the shared 360x600 registration
 *   OPP.drawClose(canvas, o)   head-and-shoulders close-up (640x480, head centre (320,220))
 *   OPP.drawHead(ctx, H)       the felt head in head-local units (radius 1)
 *
 * BIM: Easter-yellow felt boy puppet, brown felt bowl cut (parting on HIS left =
 * screen right), glossy black button eyes with the catchlight at the same
 * pixel in both, orange felt ball nose, rosy cheeks, a SEWN-ON running-stitch
 * smile in dark red thread with an upward tuck stitch at each corner,
 * red/white striped shirt, pink heart patch on HIS left chest (screen right),
 * royal-blue shorts, white socks, red sneakers, four-fingered hands with
 * fingers 1.3x too long, and a felt pointer (yellow dowel, red felt star) in
 * his RIGHT hand (screen left). Head 12% too big for the body.
 *
 * MIB is BIM's drawing run mirrored: the figure is drawn exactly as BIM and the
 * finished bitmap is flipped left/right (parting, heart, pointer, light all
 * mirror), with ONE difference drawn before the flip: his mouth is BIM's FROWN
 * turned upside down (frownMouth drawn with flipV) - the pucker stitch sits
 * ABOVE it and the corner tucks hook down-and-in. Drawn once, reused.
 *
 * Every pose shares the registration: canvas 360x600, feet bottom centre at
 * (180, 588); the parts that do not change are drawn from the same RNG streams
 * so lip-flap partners differ only in the mouth.
 */
(function (root) {
'use strict';
const F = root.FELT;
const { part, ellipse, circle, smoothClosed, smoothOpen, sampleSpline, tube, roundRect, strokeP, mixc, shade, rgba, mk, TAU, DEG, lerp, clamp, hashStr, mulberry32 } = F;
const SS = 2;                             // supersampling for every twin drawing

const PAL = {
  skin: '#F4CF4A', skinLo: '#C9971E', skinLine: '#8C6410',
  hair: '#6B4226', hairLo: '#43281A', hairLine: '#2E1A10',
  red: '#D9473B', white: '#FFF4E2', stripeLine: '#8A2A22',
  shorts: '#2A4BB8', shortsLo: '#1A2E78', shortsLine: '#101E50',
  heart: '#F49AB6', heartLine: '#B4587A',
  nose: '#F08A24', noseLine: '#A0500E',
  cheek: '#F5948E',
  thread: '#6E1020', mouthIn: '#3A0912', tongue: '#E87A8C',
  sock: '#FAF6EE', shoe: '#D2302A', shoeLo: '#8E1A16', sole: '#F4EFE4',
  dowel: '#F2C640', star: '#D7262B', starLine: '#7E1014',
  brow: '#4E2E1A',
};
function R(name) { return mulberry32(hashStr('twin:' + name)); }

/* ------------------------------------------------------------ HEAD
 * Head-local units: radius 1 (half the head width), origin at the face centre,
 * y down. H: {turn (radians, + = toward screen right), mouth: 'smile' | 'talk' |
 *  'frown' | 'bigsmile', flipV (MIB: the mouth turned upside down), brows: 'up' |
 *  'sad' | null, gaze [dx, dy] button offset (in eye radii) for each eye, eyeR,
 *  partX (hair parting x, + = screen right), px (device px per head unit)} */
function headOutline() {
  const pts = [];
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * TAU, s = Math.sin(a), c = Math.cos(a);
    const wide = 1 + 0.05 * Math.max(0, s) - 0.04 * Math.max(0, -s) * Math.abs(c);
    pts.push([c * wide, s * (s > 0 ? 0.97 : 0.93)]);
  }
  return pts;
}
/* feature position on a head turned by t (sphere mapping) */
function fx(H, u) { const t = H.turn || 0, th = Math.asin(clamp(u / 1.08, -0.99, 0.99)); return 1.08 * Math.sin(th + t); }
function fk(H, u) { const t = H.turn || 0, th = Math.asin(clamp(u / 1.08, -0.99, 0.99)); return Math.max(0.55, Math.cos(th + t) / Math.max(0.3, Math.cos(th))); }

function hairShape(H) {
  // the bowl: from the left temple over the crown to the right temple, then the
  // fringe cut straight across the forehead with small scissor notches
  const r = R('hair'), pts = [];
  const side = 0.2;
  for (let i = 0; i <= 40; i++) {
    const a = Math.PI * (1 - i / 40);                     // pi .. 0 over the top
    const rad = 1.08 + 0.015 * Math.sin(i * 1.7);
    pts.push([Math.cos(a) * rad, -Math.sin(a) * 1.1]);
  }
  // right side down to the temple
  pts.push([1.07, 0.05], [1.03, side]);
  // underside back up to the fringe (side panel over the ear)
  pts.push([0.9, side - 0.02], [0.84, -0.12]);
  // fringe across (right to left), notched
  const fr = [];
  const N = 22;
  for (let i = 0; i <= N; i++) {
    const x = lerp(0.84, -0.84, i / N);
    let y = -0.32 + 0.05 * (1 - Math.pow(x / 0.84, 2)) + (i % 2 ? 0.035 : -0.005) * (0.7 + 0.6 * r());
    const pp = H.partX === undefined ? 0.42 : H.partX; if (Math.abs(x - pp) < 0.06) y -= 0.07;     // the fringe parts at the parting
    fr.push([fx(H, x) * (Math.abs(x) > 0.8 ? 1 : 1), y]);
  }
  pts.push(...fr);
  pts.push([-0.84, -0.12], [-0.9, side - 0.02], [-1.03, side], [-1.07, 0.05]);
  return pts;
}

function buttonEye(g, x, y, r, o) {
  o = o || {};
  // thread anchoring (two tiny stitches peeking at the rim) + socket shadow
  g.save();
  g.fillStyle = 'rgba(60,30,0,0.35)'; g.beginPath(); g.ellipse(x + r * 0.08, y + r * 0.14, r * 1.12, r * 1.1, 0, 0, TAU); g.fill();
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r * 1.05);
  gr.addColorStop(0, '#4A4850'); gr.addColorStop(0.35, '#17161A'); gr.addColorStop(1, '#040405');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  // rim (the button's raised edge)
  g.strokeStyle = 'rgba(120,118,128,0.55)'; g.lineWidth = r * 0.09; g.beginPath(); g.arc(x, y, r * 0.84, Math.PI * 0.9, Math.PI * 1.6); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = r * 0.07; g.beginPath(); g.arc(x, y, r * 0.98, 0, TAU); g.stroke();
  // soft bottom-right bounce
  g.fillStyle = 'rgba(150,150,170,0.22)'; g.beginPath(); g.ellipse(x + r * 0.42, y + r * 0.45, r * 0.32, r * 0.16, -0.6, 0, TAU); g.fill();
  // catchlight: same offset in both eyes (o.cl)
  const cl = o.cl || [-0.36, -0.4];
  g.fillStyle = 'rgba(255,255,255,0.97)'; g.beginPath(); g.ellipse(x + cl[0] * r, y + cl[1] * r, r * 0.2, r * 0.15, -0.5, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(x + cl[0] * r + r * 0.28, y + cl[1] * r + r * 0.12, r * 0.05, 0, TAU); g.fill();
  if (o.crack) {
    g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = r * 0.05; g.beginPath(); g.moveTo(x - r * 0.7, y - r * 0.2); g.lineTo(x - r * 0.1, y + r * 0.05); g.lineTo(x + r * 0.3, y + r * 0.5); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = r * 0.025; g.beginPath(); g.moveTo(x - r * 0.7, y - r * 0.25); g.lineTo(x - r * 0.1, y); g.lineTo(x + r * 0.3, y + r * 0.45); g.stroke();
  }
  g.restore();
}

/* running stitch along a polyline (head units): thread dashes with a thread
 * shadow, a highlight, and tiny dimples where the needle went in */
function runStitch(g, pts, o) {
  o = Object.assign({ dash: 0.075, gap: 0.04, w: 0.026, col: PAL.thread, seed: 'st', shadow: 0.5 }, o);
  const r = R(o.seed), L = [];
  let acc = 0; for (let i = 0; i < pts.length; i++) { if (i) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(acc); }
  const at = (s) => { let i = 1; while (i < L.length - 1 && L[i] < s) i++; const t = (s - L[i - 1]) / Math.max(1e-9, L[i] - L[i - 1]); return [lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)]; };
  const segs = [];
  for (let s = o.phase || 0; s < acc - 1e-6; s += o.dash + o.gap) segs.push([at(s), at(Math.min(acc, s + o.dash))]);
  g.save(); g.lineCap = 'round';
  for (const [a, b] of segs) {             // needle holes (dimples) and the felt pulled in
    for (const p of [a, b]) { g.fillStyle = 'rgba(70,40,0,0.32)'; g.beginPath(); g.arc(p[0], p[1] + o.w * 0.2, o.w * 0.75, 0, TAU); g.fill(); }
  }
  for (const [a, b] of segs) { g.strokeStyle = `rgba(30,0,4,${o.shadow})`; g.lineWidth = o.w * 1.25; g.beginPath(); g.moveTo(a[0] + o.w * 0.25, a[1] + o.w * 0.45); g.lineTo(b[0] + o.w * 0.25, b[1] + o.w * 0.45); g.stroke(); }
  for (const [a, b] of segs) {
    const j = (r() - 0.5) * o.w * 0.4;
    g.strokeStyle = o.col; g.lineWidth = o.w * (0.9 + r() * 0.2); g.beginPath(); g.moveTo(a[0], a[1] + j); g.lineTo(b[0], b[1] - j); g.stroke();
    g.strokeStyle = 'rgba(255,190,190,0.35)'; g.lineWidth = o.w * 0.3; g.beginPath(); g.moveTo(a[0] - o.w * 0.1, a[1] - o.w * 0.22 + j); g.lineTo(b[0] - o.w * 0.1, b[1] - o.w * 0.22 - j); g.stroke();
  }
  g.restore();
}

/* the three mouths in mouth-local units (centre of the mouth, half-width 1).
 * SMILE: corners up, an upward tuck at each corner.
 * FROWN: corners down, the puckered-chin '^' stitch UNDER its centre, tucks that
 *        hook up-and-in at the corners; flipV turns it into MIB's smile (pucker
 *        above, tucks down-and-in). TALK: the stitched line opens into a D. */
function mouthCurve(kind, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n * 2 - 1;
    let y;
    if (kind === 'frown') y = -0.34 * (1 - t * t) + 0.1 * t * t * t * t;
    else if (kind === 'bigsmile') y = 0.42 * (1 - t * t) - 0.12 * t * t * t * t;
    else y = 0.3 * (1 - t * t) - 0.08 * t * t * t * t;
    pts.push([t, y]);
  }
  return pts;
}
function drawMouth(g, H, mx, my, hw) {
  const kind = H.mouth || 'smile', flip = !!H.flipV;
  g.save();
  g.translate(mx, my); g.scale(hw, hw * (flip ? -1 : 1));
  const lwk = 1 / hw;                         // head units -> mouth units
  if (kind === 'talk') {
    // the D: flat edge along the smile line, round below (flipV: round above)
    const top = mouthCurve('smile', 24).map(([x, y]) => [x * 0.86, y * 0.55 - 0.02]);
    const bot = [];
    for (let i = 0; i <= 24; i++) { const a = Math.PI * i / 24; bot.push([Math.cos(a) * (flip ? 0.8 : 0.86), 0.1 + Math.sin(a) * (flip ? 0.46 : 0.64)]); }
    const D = smoothClosed(top.concat(bot.slice(1, -1)));
    g.save();
    const gr = g.createLinearGradient(0, 0, 0, 0.9); gr.addColorStop(0, '#1C0207'); gr.addColorStop(1, PAL.mouthIn);
    g.fillStyle = gr; g.fill(D);
    g.clip(D);
    // felt tongue
    const tg = g.createRadialGradient(-0.05, 0.7, 0.05, 0, 0.74, 0.55); tg.addColorStop(0, '#F59AAA'); tg.addColorStop(1, '#B4485C');
    g.fillStyle = tg; g.beginPath(); g.ellipse(0, flip ? 0.62 : 0.8, 0.5, flip ? 0.22 : 0.3, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(120,30,50,0.6)'; g.lineWidth = 0.035; g.beginPath(); g.moveTo(0, 0.56); g.lineTo(0, 0.78); g.stroke();
    // inner shadow along the top edge
    g.filter = 'none'; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 0.18; g.stroke(D);
    g.restore();
    // felt lip edge + stitches round the opening
    g.strokeStyle = mixc(PAL.skin, '#7A4A00', 0.35); g.lineWidth = 0.09; g.stroke(D);
    runStitch(g, top, { dash: 0.16, gap: 0.08, w: 0.07, seed: 'talkTop' });
    if (flip) runStitch(g, [[-0.1, 0.72], [0, 0.61], [0.1, 0.72]], { dash: 0.075, gap: 0.03, w: 0.065, seed: 'pucker' });   // MIB's pucker stays above his mouth
  } else {
    const c = mouthCurve(kind === 'frown' ? 'frown' : kind, 30);
    runStitch(g, c, { dash: 0.15, gap: 0.075, w: kind === 'bigsmile' ? 0.085 : 0.075, seed: 'mouth' + kind, phase: 0.01 });
    // corner tucks
    for (const sd of [-1, 1]) {
      const end = c[sd < 0 ? 0 : c.length - 1];
      let tuck;
      if (kind === 'frown') tuck = [[end[0], end[1]], [end[0] - sd * 0.1, end[1] - 0.17]];          // up-and-in (flipV: down-and-in)
      else tuck = [[end[0], end[1]], [end[0] + sd * 0.07, end[1] - 0.18]];                        // up-and-out (a dimple)
      runStitch(g, tuck, { dash: 0.15, gap: 0.0, w: 0.07, seed: 'tuck' + kind + sd });
    }
    if (kind === 'frown') {
      // the puckered-chin stitch: a small '^' under the centre of the frown
      runStitch(g, [[-0.1, 0.36], [0, 0.24], [0.1, 0.36]], { dash: 0.075, gap: 0.03, w: 0.065, seed: 'pucker' });
    }
  }
  g.restore();
}

function drawHead(f, H) {
  const P = PAL, k = H.px || 1;              // k: device px per head unit / 100 (for detail sizes)
  const turn = H.turn || 0;
  const out = headOutline();
  const headP = smoothClosed(out);
  // ears (behind the head edge, under the bowl's side panels)
  for (const sd of [-1, 1]) {
    const ex = sd * (1.0 - Math.max(0, sd * turn) * 0.25), ey = 0.24;
    part(f, ellipse(ex, ey, 0.17, 0.2, 0), { fill: shade(P.skin, -0.04), shade: 0.4, ao: 0.3, hi: 0.1, shadeColor: '#6A4000', outline: P.skinLine, outlineW: 1.1,
      paint: g => { g.fillStyle = rgba('#B07A10', 0.5); g.beginPath(); g.ellipse(ex + sd * 0.02, ey + 0.01, 0.08, 0.11, 0, 0, TAU); g.fill(); } });
  }
  // the head
  part(f, headP, {
    fill: g => { const gr = g.createRadialGradient(-0.3, -0.45, 0.1, 0, 0, 1.15); gr.addColorStop(0, shade(P.skin, 0.12)); gr.addColorStop(0.7, P.skin); gr.addColorStop(1, mixc(P.skin, '#C08A10', 0.45)); return gr; },
    paint: g => {
      // rosy cheeks (felt circles glued on, soft)
      for (const sd of [-1, 1]) {
        const cx = fx(H, sd * 0.58), cy = 0.36, rr = 0.17 * fk(H, sd * 0.58);
        const cg = g.createRadialGradient(cx, cy, 0, cx, cy, rr); cg.addColorStop(0, rgba(P.cheek, 0.75)); cg.addColorStop(0.7, rgba(P.cheek, 0.55)); cg.addColorStop(1, rgba(P.cheek, 0));
        g.fillStyle = cg; g.beginPath(); g.ellipse(cx, cy, rr, rr * 0.92, 0, 0, TAU); g.fill();
      }
      // a few grime/wear marks (old puppet)
      const r = R('headwear');
      for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(150,100,20,${0.05 + r() * 0.05})`; g.beginPath(); g.ellipse((r() - 0.5) * 1.4, 0.2 + r() * 0.6, 0.05 + r() * 0.1, 0.03 + r() * 0.06, r() * 3, 0, TAU); g.fill(); }
      // the side seam of the head (felt pattern pieces)
      g.strokeStyle = 'rgba(120,80,0,0.28)'; g.lineWidth = 0.012;
      for (const sd of [-1, 1]) { const q = new Path2D(); q.moveTo(sd * 0.82, -0.3); q.quadraticCurveTo(sd * 0.92, 0.35, sd * 0.62, 0.86); g.stroke(q); }
    },
    tex: 0.62, shade: 0.4, shadeDist: 10 * k, shadeBlur: 18 * k, ao: 0.26, aoBlur: 6 * k, hi: 0.16, shadeColor: '#7A4A00', outline: P.skinLine, outlineW: 1.3,
    cast: H.cast || { alpha: 0.35, blur: 8, dist: 5 },
  });
  // the bowl cut
  const hp = smoothClosed(hairShape(H), null, 0.9);
  const part0 = H.partX === undefined ? 0.42 : H.partX, px0 = fx(H, part0);
  part(f, hp, {
    fill: g => { const gr = g.createLinearGradient(0, -1.1, 0, 0.2); gr.addColorStop(0, shade(P.hair, 0.12)); gr.addColorStop(1, shade(P.hair, -0.12)); return gr; },
    paint: g => {
      const r = R('hairstrands');
      // cut-felt strands combed from the parting / crown down to the fringe
      g.lineCap = 'round';
      // combed felt: long soft strands fanning from the parting over the crown (not straight bars)
      for (let i = 0; i < 70; i++) {
        const u = r(), sd = u < 0.5 ? -1 : 1, tgt = sd < 0 ? lerp(-1.02, px0 - 0.05, u * 2) : lerp(px0 + 0.05, 1.02, (u - 0.5) * 2);
        const x0 = px0 + sd * 0.03 + (r() - 0.5) * 0.06, y0 = -1.0 + r() * 0.08;
        const x1 = tgt, y1 = -0.3 - 0.45 * Math.pow(Math.abs(tgt) / 1.05, 4) + r() * 0.05;
        g.strokeStyle = r() < 0.55 ? `rgba(30,14,4,${0.12 + r() * 0.12})` : `rgba(170,120,80,${0.08 + r() * 0.1})`; g.lineWidth = 0.01 + r() * 0.016;
        g.beginPath(); g.moveTo(x0, y0); g.bezierCurveTo(x0 + (x1 - x0) * 0.6, y0 - 0.06, x1, lerp(y0, y1, 0.4), x1, y1); g.stroke();
      }
      // the parting (HIS left = screen right): a pale seam line, hair swept away from it
      const q = new Path2D(); q.moveTo(px0 + 0.07, -1.1); q.quadraticCurveTo(px0 + 0.02, -0.72, px0, -0.34);
      g.strokeStyle = 'rgba(20,8,2,0.85)'; g.lineWidth = 0.05; g.stroke(q);
      g.strokeStyle = 'rgba(232,190,140,0.55)'; g.lineWidth = 0.016; g.save(); g.translate(0.022, 0.0); g.stroke(q); g.restore();
      // the fringe's cut edge catches light
      g.strokeStyle = 'rgba(40,20,8,0.5)'; g.lineWidth = 0.04;
      g.beginPath(); g.moveTo(-0.84, -0.3); g.quadraticCurveTo(0, -0.24, 0.84, -0.3); g.stroke();
    },
    tex: 0.7, texB: true, shade: 0.5, shadeDist: 9 * k, shadeBlur: 14 * k, ao: 0.3, aoBlur: 5 * k, hi: 0.2, shadeColor: '#1A0A00', outline: P.hairLine, outlineW: 1.2,
    cast: { alpha: 0.45, blur: 6, dist: 4 },
  });
  // brows (felt slivers peeking under the fringe)
  if (H.brows) {
    for (const sd of [-1, 1]) {
      const bx = fx(H, sd * 0.34), by = -0.17, ang = H.brows === 'sad' ? -sd * 0.42 : sd * 0.08;
      const bp = new Path2D(); bp.ellipse(bx, by + (H.brows === 'sad' ? -0.02 : 0), 0.14 * fk(H, sd * 0.34), 0.035, ang, 0, TAU);
      part(f, bp, { fill: P.brow, shade: 0.3, ao: 0.2, hi: 0.15, outline: '#2A1408', outlineW: 0.8, cast: { alpha: 0.35, blur: 3, dist: 2 } });
    }
  }
  // button eyes
  const eyes = [];
  for (const sd of [-1, 1]) {
    const gz = (H.gaze && H.gaze[sd < 0 ? 0 : 1]) || [0, 0];
    const ex = fx(H, sd * 0.33) + gz[0] * 0.13, ey = 0.03 + gz[1] * 0.13, er = (H.eyeR || 0.13) * Math.sqrt(fk(H, sd * 0.33));
    buttonEye(f, ex, ey, er, { cl: H.cl, crack: H.crack && H.crack === sd });
    eyes.push([ex, ey, er]);
  }
  // nose: an orange felt ball
  const nxp = fx(H, 0) * 1.05;
  part(f, circle(nxp, 0.24, 0.105), {
    fill: g => { const gr = g.createRadialGradient(nxp - 0.04, 0.2, 0.01, nxp, 0.24, 0.11); gr.addColorStop(0, '#FFC27A'); gr.addColorStop(0.5, P.nose); gr.addColorStop(1, '#B85A10'); return gr; },
    tex: 0.5, shade: 0.35, ao: 0.25, hi: 0.2, shadeColor: '#5A2000', outline: P.noseLine, outlineW: 0.9, cast: { alpha: 0.45, blur: 6, dist: 6 },
  });
  // the sewn mouth
  drawMouth(f, H, fx(H, 0), H.mouthY || (H.flipV ? 0.6 : 0.54), (H.mouthW || 0.4) * (1 - Math.abs(turn) * 0.15));
  return { eyes };
}

/* ------------------------------------------------------------ HANDS
 * four-fingered felt hands (thumb + three fingers), fingers 1.3x too long.
 * Hand frame: wrist at the origin, fingers along +y. */
function handShapes(o) {
  const fl = 22 * (o.fingerLen || 1.3), fw = 8.4, shapes = [], fingers = [];
  const palmW = 22, palmL = 19;
  const side = o.thumbSide || 1;
  if (o.mode === 'grip') {
    shapes.push(roundRect(-palmW / 2 - 1, -2, palmW + 2, palmL + 6, 9));
    for (let k = 0; k < 3; k++) shapes.push(roundRect(-palmW / 2 - 2 + side * 2, palmL - 15 + k * 7.5, palmW + 4, 8.4, 4.2));
    fingers.push({ x: side * 10, y: 3, a: -side * 32, len: 15, w: 8.4, thumb: true });
  } else if (o.mode === 'point') {
    shapes.push(roundRect(-palmW / 2, 0, palmW, palmL + 2, [8, 8, 10, 10]));
    fingers.push({ x: -side * 6, y: palmL - 2, a: 0, len: fl, w: fw });
    shapes.push(roundRect(-side * 1 - 4.5, palmL - 5, 9, 11, 4.5));
    shapes.push(roundRect(side * 6 - 4.5, palmL - 6, 9, 10, 4.5));
    fingers.push({ x: side * 9, y: 7, a: -side * 24, len: 15, w: 8.4, thumb: true });
  } else if (o.mode === 'hip') {
    shapes.push(roundRect(-palmW / 2, 0, palmW, palmL, [8, 8, 10, 10]));
    for (let k = 0; k < 3; k++) fingers.push({ x: (k - 1) * 7, y: palmL - 2, a: -side * 70 + (k - 1) * 4, len: fl * 0.7, w: fw, curl: 0.4 });
  } else {
    shapes.push(roundRect(-palmW / 2, 0, palmW, palmL + 2, [8, 8, 10, 10]));
    const spread = o.spread === undefined ? 6 : o.spread;
    [-7.5, 0, 7.5].forEach((x, k) => fingers.push({ x, y: palmL - 1, a: (k - 1) * spread + (o.fingerTilt || 0), len: fl * (k === 1 ? 1.05 : 0.97), w: fw, curl: o.curl || 0 }));
    fingers.push({ x: side * 10, y: 8, a: side * (o.thumbAng === undefined ? 44 : o.thumbAng), len: 15, w: 8.4, thumb: true });
  }
  const fpaths = fingers.map(fg => {
    const a = fg.a * DEG, c = fg.curl || 0, p0 = [fg.x, fg.y - 3], dir = [Math.sin(a), Math.cos(a)];
    const p2 = [fg.x + dir[0] * fg.len, fg.y + dir[1] * fg.len];
    const p1 = [lerp(p0[0], p2[0], 0.55) + dir[1] * c * 0.14 * fg.len, lerp(p0[1], p2[1], 0.55) - dir[0] * c * 0.14 * fg.len];
    fg.pts = [p0, p1, p2];
    return tube([p0, p1, p2], [fg.w, fg.w * 0.97, fg.w * 0.9]);
  });
  return { shapes, fingers, fpaths };
}
function drawHand(f, o) {
  const P = PAL;
  f.save(); f.translate(o.x, o.y); f.rotate((o.ang || 0) * DEG); f.scale((o.mirror ? -1 : 1) * (o.scale || 1), o.scale || 1);
  const G = handShapes(o);
  part(f, [...G.shapes, ...G.fpaths], {
    fill: g => { const gr = g.createLinearGradient(-14, 0, 16, 34); gr.addColorStop(0, shade(P.skin, 0.1)); gr.addColorStop(1, shade(P.skin, -0.06)); return gr; },
    paint: g => {
      const cp = new Path2D(); cp.rect(-1e4, -1e4, 2e4, 2e4); for (const sh of G.shapes) cp.addPath(sh);
      g.save(); g.clip(cp, 'evenodd'); for (const p of G.fpaths) { g.lineWidth = 0.9; g.strokeStyle = 'rgba(140,90,0,0.55)'; g.stroke(p); } g.restore();
      if (o.mode === 'grip') for (let k = 1; k < 3; k++) { g.strokeStyle = 'rgba(140,90,0,0.5)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-12, 4 + k * 7.5); g.lineTo(12, 4 + k * 7.5); g.stroke(); }
    },
    tex: 0.55, shade: 0.38, ao: 0.24, hi: 0.12, shadeColor: '#7A4A00', shadeDist: 6, shadeBlur: 9, outline: P.skinLine, outlineW: 1.1,
    cast: o.cast || { alpha: 0.3, blur: 5, dist: 3 },
  });
  const T = f.getTransform();
  f.restore();
  return T;
}

/* ------------------------------------------------------------ POINTER */
function drawPointer(f, a, b, o) {
  o = o || {};
  const P = PAL, ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  part(f, tube([a, b], [5.2, 5.2], { capStart: true }), { fill: g => { const gr = g.createLinearGradient(a[0], a[1], b[0], b[1]); gr.addColorStop(0, shade(P.dowel, -0.05)); gr.addColorStop(1, shade(P.dowel, 0.08)); return gr; },
    paint: g => { g.strokeStyle = 'rgba(160,110,20,0.4)'; g.lineWidth = 0.6; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(lerp(a[0], b[0], 0.1 + k * 0.2), lerp(a[1], b[1], 0.1 + k * 0.2)); g.lineTo(lerp(a[0], b[0], 0.18 + k * 0.2), lerp(a[1], b[1], 0.18 + k * 0.2)); g.stroke(); } },
    tex: 0.25, shade: 0.35, ao: 0.2, hi: 0.25, shadeDist: 3, shadeBlur: 4, outline: '#8C6A10', outlineW: 0.9, cast: { alpha: 0.3, blur: 4, dist: 3 } });
  if (o.star === false) return;
  const sr = o.starR || 15, pts = [];
  for (let i = 0; i < 10; i++) { const t = ang + Math.PI / 2 + i * Math.PI / 5 + (o.starRot || 0); const rr = i % 2 ? sr * 0.48 : sr; pts.push([b[0] + Math.cos(t) * rr, b[1] + Math.sin(t) * rr]); }
  const sp = smoothClosed(pts, null, 0.35);
  part(f, sp, { fill: g => { const gr = g.createRadialGradient(b[0] - sr * 0.3, b[1] - sr * 0.3, 1, b[0], b[1], sr); gr.addColorStop(0, '#F0584C'); gr.addColorStop(1, '#A81A1E'); return gr; },
    paint: g => { const ins = []; for (let i = 0; i < pts.length; i++) ins.push([lerp(b[0], pts[i][0], 0.72), lerp(b[1], pts[i][1], 0.72)]); ins.push(ins[0]);
      g.save(); g.setLineDash([2.4, 1.8]); g.strokeStyle = 'rgba(255,230,210,0.85)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(ins[0][0], ins[0][1]); for (const p of ins) g.lineTo(p[0], p[1]); g.stroke(); g.restore(); },
    tex: 0.6, shade: 0.4, ao: 0.25, hi: 0.15, shadeDist: 4, shadeBlur: 6, outline: P.starLine, outlineW: 1.0, cast: { alpha: 0.35, blur: 5, dist: 4 } });
}

/* ------------------------------------------------------------ BODY (360x600) */
function stripesPaint(g, x0, x1, y0, y1, h, bend, phase) {
  for (let y = y0 - h * 2 + (phase || 0); y < y1 + h; y += h * 2) {
    const q = new Path2D(); q.moveTo(x0 - 20, y); q.quadraticCurveTo((x0 + x1) / 2, y + bend, x1 + 20, y); q.lineTo(x1 + 20, y + h); q.quadraticCurveTo((x0 + x1) / 2, y + h + bend, x0 - 20, y + h); q.closePath();
    g.fillStyle = PAL.white; g.fill(q);
  }
}
function sleeve(f, pts, o) {
  const P = PAL, [sh, el, wr] = pts;
  const path = tube([sh, el, wr], [27, 24, 21]);
  part(f, path, {
    fill: P.red,
    paint: g => {
      // stripes run round the arm: bands perpendicular to the centreline
      const S = sampleSpline([sh, el, wr], 30); let acc = 0;
      for (let i = 1; i < S.length; i++) {
        const a = S[i - 1], b = S[i], L = Math.hypot(b.x - a.x, b.y - a.y); acc += L;
        if (Math.floor(acc / 9) % 2 === 1) {
          const nx = -(b.y - a.y) / (L || 1), ny = (b.x - a.x) / (L || 1);
          g.strokeStyle = P.white; g.lineWidth = L + 0.6; g.lineCap = 'butt';
          g.beginPath(); g.moveTo((a.x + b.x) / 2 - nx * 18, (a.y + b.y) / 2 - ny * 18); g.lineTo((a.x + b.x) / 2 + nx * 18, (a.y + b.y) / 2 + ny * 18); g.stroke();
        }
      }
      // elbow folds
      g.strokeStyle = 'rgba(90,20,10,0.3)'; g.lineWidth = 1;
      for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(el[0] - 9, el[1] + k * 5); g.quadraticCurveTo(el[0], el[1] + k * 5 + 3, el[0] + 9, el[1] + k * 5); g.stroke(); }
      // ribbed cuff
      const d = [wr[0] - el[0], wr[1] - el[1]], L = Math.hypot(...d), ux = d[0] / L, uy = d[1] / L;
      g.strokeStyle = P.white; g.lineWidth = 6; g.beginPath(); g.moveTo(wr[0] - ux * 4 - uy * 13, wr[1] - uy * 4 + ux * 13); g.lineTo(wr[0] - ux * 4 + uy * 13, wr[1] - uy * 4 - ux * 13); g.stroke();
    },
    tex: 0.5, shade: 0.42, ao: 0.25, hi: 0.12, shadeColor: '#3A0A06', outline: P.stripeLine, outlineW: 1.1, cast: o && o.cast || { alpha: 0.32, blur: 6, dist: 4 },
  });
}
function shoe(f, x, y, sd, o) {
  o = o || {};
  const P = PAL, w = 25, h = 24, lift = o.lift || 0, sc = o.scale || 1;
  f.save(); f.translate(x, y - lift); f.scale(sc, sc);
  const up = new Path2D();
  up.moveTo(-w, 0); up.bezierCurveTo(-w - 2, -h * 0.85, -w * 0.5, -h * 1.12, 0, -h * 1.1); up.bezierCurveTo(w * 0.5, -h * 1.12, w + 2, -h * 0.85, w, 0); up.closePath();
  part(f, up, { fill: g => { const gr = g.createLinearGradient(0, -h, 0, 0); gr.addColorStop(0, shade(P.shoe, 0.1)); gr.addColorStop(1, P.shoeLo); return gr; },
    paint: g => {
      // white toe cap + laces
      g.fillStyle = P.sole; g.beginPath(); g.ellipse(0, -2, w * 0.82, h * 0.42, 0, Math.PI, TAU); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(0, -2, w * 0.82, h * 0.42, 0, Math.PI, TAU); g.stroke();
      g.strokeStyle = '#FFFFFF'; g.lineWidth = 2.2; g.lineCap = 'round';
      for (let k = 0; k < 3; k++) { const yy = -h * 1.0 + k * 4.2; g.beginPath(); g.moveTo(-6, yy); g.lineTo(6, yy + 2.5); g.moveTo(6, yy); g.lineTo(-6, yy + 2.5); g.stroke(); }
    },
    tex: 0.35, shade: 0.4, ao: 0.25, hi: 0.18, shadeColor: '#2A0000', outline: '#4A0A08', outlineW: 1.1, cast: { alpha: 0.3, blur: 4, dist: 2 } });
  part(f, roundRect(-w - 2, -3, w * 2 + 4, 7, 3.5), { fill: P.sole, tex: 0.2, shade: 0.3, ao: 0.3, hi: 0.1, shadeColor: '#30302A', outline: '#6A6458', outlineW: 0.9 });
  f.restore();
}
/* B: body rig in 360x600 logical px. legs: {l: {lift, bend}, r: {...}} */
function drawBody(f, B) {
  const P = PAL;
  const legs = B.legs || {};
  // legs + socks + shoes (back leg first)
  const order = B.noLegs ? [] : (legs.r && legs.r.lift) ? ['r', 'l'] : ['l', 'r'];
  for (const s of order) {
    const sd = s === 'l' ? -1 : 1, L = legs[s] || {}, lift = L.lift || 0;
    const hx = 180 + sd * 22, ax = 180 + sd * 24 + (L.dx || 0);
    const knee = [lerp(hx, ax, 0.5) + (L.knee || 0), lerp(458, 560 - lift, 0.5)];
    part(f, tube([[hx, 452], knee, [ax, 560 - lift]], [24, 21, 19]), { fill: shade(P.skin, -0.04), tex: 0.55, shade: 0.42, ao: 0.28, hi: 0.1, shadeColor: '#6A4000', outline: P.skinLine, outlineW: 1.1, cast: { alpha: 0.3, blur: 5, dist: 3 } });
    part(f, roundRect(ax - 12, 538 - lift, 24, 26, 6), { fill: P.sock, tex: 0.45, texB: true, shade: 0.35, ao: 0.25, hi: 0.08, shadeColor: '#4A4A48', outline: '#8E8A80', outlineW: 1,
      paint: g => { g.strokeStyle = 'rgba(120,118,110,0.45)'; g.lineWidth = 0.8; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(ax - 9 + k * 4.5, 540 - lift); g.lineTo(ax - 9 + k * 4.5, 552 - lift); g.stroke(); } g.strokeStyle = 'rgba(217,71,59,0.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(ax - 12, 546 - lift); g.lineTo(ax + 12, 546 - lift); g.stroke(); } });
    shoe(f, ax, 588, sd, { lift, scale: L.scale || 1 });
  }
  f.save(); f.translate(0, B.dy || 0);
  // shorts
  if (!B.noShorts) {
  const sh = new Path2D();
  sh.moveTo(124, 398); sh.lineTo(236, 398); sh.bezierCurveTo(242, 420, 246, 450, 244, 466); sh.lineTo(186, 468); sh.quadraticCurveTo(180, 446, 174, 468); sh.lineTo(116, 466); sh.bezierCurveTo(114, 450, 118, 420, 124, 398); sh.closePath();
  part(f, sh, { fill: g => { const gr = g.createLinearGradient(0, 398, 0, 468); gr.addColorStop(0, shade(P.shorts, 0.08)); gr.addColorStop(1, P.shortsLo); return gr; },
    paint: g => {
      g.strokeStyle = 'rgba(10,20,60,0.5)'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(122, 410); g.lineTo(238, 410); g.stroke();
      g.save(); g.setLineDash([3, 2.5]); g.strokeStyle = 'rgba(200,210,255,0.55)'; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(180, 412); g.quadraticCurveTo(184, 432, 180, 448); g.stroke();
      g.beginPath(); g.moveTo(118, 460); g.lineTo(174, 462); g.moveTo(186, 462); g.lineTo(242, 460); g.stroke(); g.restore();
    },
    tex: 0.6, shade: 0.45, ao: 0.3, hi: 0.12, shadeColor: '#050A30', outline: P.shortsLine, outlineW: 1.2, cast: { alpha: 0.35, blur: 7, dist: 4 } });
  }
  if (B.beforeTorso) B.beforeTorso(f);
  // neck
  part(f, roundRect(162, 262, 36, 40, 10), { fill: shade(P.skin, -0.1), tex: 0.5, shade: 0.4, ao: 0.35, hi: 0.05, shadeColor: '#6A4000', outline: P.skinLine, outlineW: 1 });
  // torso (striped shirt)
  const t = new Path2D();
  t.moveTo(150, 290); t.bezierCurveTo(130, 290, 120, 298, 119, 316); t.bezierCurveTo(116, 350, 114, 380, 120, 404); t.quadraticCurveTo(180, 414, 240, 404);
  t.bezierCurveTo(246, 380, 244, 350, 241, 316); t.bezierCurveTo(240, 298, 230, 290, 210, 290); t.quadraticCurveTo(180, 300, 150, 290); t.closePath();
  part(f, t, { fill: P.red,
    paint: g => {
      stripesPaint(g, 110, 250, 296, 412, 11, 7, 2);
      // collar (white rib)
      g.strokeStyle = P.white; g.lineWidth = 7; g.beginPath(); g.moveTo(152, 291); g.quadraticCurveTo(180, 304, 208, 291); g.stroke();
      g.strokeStyle = 'rgba(120,110,100,0.5)'; g.lineWidth = 0.8; for (let k = 0; k < 14; k++) { const x = 154 + k * 3.9, y = 291 + 9 * Math.sin(Math.PI * (x - 152) / 56) * 0.95; g.beginPath(); g.moveTo(x, y - 3); g.lineTo(x, y + 3); g.stroke(); }
      // hem
      g.strokeStyle = 'rgba(80,20,10,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(121, 398); g.quadraticCurveTo(180, 408, 239, 398); g.stroke();
      // soft folds
      g.strokeStyle = 'rgba(60,10,6,0.18)'; g.lineWidth = 1.4;
      for (const [x, y] of [[146, 380], [212, 372], [166, 340]]) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y + 6, x + 14, y + 4); g.stroke(); }
    },
    tex: 0.5, shade: 0.42, shadeDist: 12, shadeBlur: 20, ao: 0.28, hi: 0.14, shadeColor: '#2A0604', outline: P.stripeLine, outlineW: 1.2, cast: { alpha: 0.4, blur: 8, dist: 5 } });
  // heart patch (HIS left chest = screen right)
  const hx = 210, hy = 332, hs = 14;
  const heart = new Path2D(); heart.moveTo(hx, hy + hs * 0.95); heart.bezierCurveTo(hx - hs * 1.3, hy + hs * 0.1, hx - hs * 0.9, hy - hs * 0.95, hx, hy - hs * 0.35); heart.bezierCurveTo(hx + hs * 0.9, hy - hs * 0.95, hx + hs * 1.3, hy + hs * 0.1, hx, hy + hs * 0.95); heart.closePath();
  part(f, heart, { fill: P.heart, tex: 0.6, shade: 0.35, ao: 0.25, hi: 0.15, shadeColor: '#6A2040', outline: P.heartLine, outlineW: 1,
    paint: g => { g.save(); g.translate(hx, hy); g.scale(0.72, 0.72); g.translate(-hx, -hy + 1); g.setLineDash([2.2, 1.6]); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.1; g.stroke(heart); g.restore(); },
    cast: { alpha: 0.35, blur: 3, dist: 2 } });
  f.restore();
}

/* ------------------------------------------------------------ POSES (BIM's frame) */
const POSES = {
  idle: {
    turn: 0.2,
    armR: [[126, 302], [98, 372], [104, 330]], handR: { mode: 'grip', ang: 178, thumbSide: -1 }, pointer: [[105, 384], [105, 226]],
    armL: [[234, 302], [252, 362], [256, 414]], handL: { ang: -6, mirror: true, spread: 4, curl: 0.3 },
  },
  point: {
    turn: 0,
    armR: [[126, 304], [90, 342], [64, 378]], handR: { mode: 'grip', ang: 132, thumbSide: -1 }, pointer: [[76, 366], [20, 426]], pointerOver: true,
    armL: [[234, 304], [272, 346], [246, 392]], handL: { mode: 'hip', ang: 150, mirror: true },
  },
  walk_a: {
    turn: 0.05, lean: -3.5, mouth: 'bigsmile',
    legs: { r: { lift: 30, knee: 8, dx: 4, scale: 0.94 }, l: { knee: -2 } },
    armR: [[126, 302], [96, 360], [86, 404]], handR: { mode: 'grip', ang: 168, thumbSide: -1 }, pointer: [[85, 452], [85, 300]], pointerUnder: true,
    armL: [[234, 302], [264, 346], [284, 384]], handL: { ang: -38, mirror: true, spread: 6, curl: 0.2 },
  },
  walk_b: {
    turn: -0.05, lean: 3.5, mouth: 'bigsmile',
    legs: { l: { lift: 30, knee: -8, dx: -4, scale: 0.94 }, r: { knee: 2 } },
    armR: [[126, 302], [102, 366], [104, 418]], handR: { mode: 'grip', ang: 182, thumbSide: -1 }, pointer: [[104, 470], [104, 312]], pointerUnder: true,
    armL: [[234, 302], [256, 360], [262, 410]], handL: { ang: 4, mirror: true, spread: 6, curl: 0.2 },
  },
  wave: {   // BIM's frame: pointer tucked under his right arm (screen left), left hand up by the head (screen right)
    turn: 0,
    armR: [[126, 304], [116, 362], [122, 414]], handR: { ang: 4, spread: 3, curl: 0.4 }, pointer: [[160, 318], [62, 380]], pointerUnder: true, starRot: 0.3,
    armL: [[234, 304], [282, 282], [276, 222]], handL: { ang: 186, mirror: true, spread: 13, curl: -0.2, thumbAng: 56, fingerTilt: 4 },
  },
};

/* full-body twin on a 360x600 canvas (feet bottom centre (180, 588)) */
function drawTwin(cv, o) {
  o = o || {};
  const W = cv.width, Hh = cv.height, P = POSES[o.pose || 'idle'];
  const BW = W * SS, BH = Hh * SS;
  F.setup(BW, BH, { px: SS, light: o.mirrorLight ? { x: 0.55, y: -0.83 } : { x: -0.55, y: -0.83 }, seed: 7 });
  const big = mk(BW, BH), f = big.getContext('2d');
  f.setTransform(SS, 0, 0, SS, 0, 0);
  // lean: rotate the upper body about the hips
  drawBody(f, { legs: P.legs });
  const leanT = () => { f.translate(180, 440); f.rotate((P.lean || 0) * DEG); f.translate(-180, -440); };
  f.save(); leanT();
  // arm behind the pointer / pointer under the arm
  if (P.pointerUnder) drawPointer(f, P.pointer[0], P.pointer[1], { starRot: P.starRot });
  const head = () => {
    f.save(); f.translate(180, 196); f.scale(86, 86);
    drawHead(f, { turn: P.turn, mouth: o.mouth || P.mouth || 'smile', flipV: !!o.flipV, brows: 'up', px: 86 * SS / 100, cl: o.cl });
    f.restore();
  };
  head();
  // free arm (screen right in BIM's frame)
  sleeve(f, P.armL);
  drawHand(f, Object.assign({ x: P.armL[2][0], y: P.armL[2][1] }, P.handL));
  // pointer arm
  sleeve(f, P.armR);
  if (!P.pointerUnder && !P.pointerOver) drawPointer(f, P.pointer[0], P.pointer[1]);
  drawHand(f, Object.assign({ x: P.armR[2][0], y: P.armR[2][1] }, P.handR));
  if (P.pointerOver) drawPointer(f, P.pointer[0], P.pointer[1]);
  if (P.pointerUnder && P.handR.mode === 'grip') {
    // the dowel passes through the fist: redraw the part above the fingers
  }
  f.restore();
  finish(cv, big, o);
}

/* downsample the 2x drawing into cv; mirror (MIB) flips the finished bitmap */
function finish(cv, big, o) {
  const g = cv.getContext('2d');
  let src = big;
  if (big.width / 2 >= cv.width) {
    const h = mk(big.width / 2, big.height / 2), hg = h.getContext('2d'); hg.imageSmoothingQuality = 'high'; hg.drawImage(big, 0, 0, h.width, h.height); src = h;
  }
  g.save();
  if (o.mirror) { g.translate(cv.width, 0); g.scale(-1, 1); }
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, cv.width, cv.height);
  g.restore();
  if (o.post) o.post(cv);
}

/* ------------------------------------------------------------ CLOSE-UPS (640x480, head centre (320,220), ~300 px wide) */
function drawClose(cv, o) {
  o = o || {};
  const W = cv.width, Hh = cv.height, BW = W * SS, BH = Hh * SS, Rh = 150;
  F.setup(BW, BH, { px: SS * 1.7, light: { x: -0.55, y: -0.83 }, seed: 7, texScale: SS * 1.3 });
  const big = mk(BW, BH), f = big.getContext('2d');
  f.setTransform(SS, 0, 0, SS, 0, 0);
  // shoulders + collar (striped shirt), neck
  part(f, roundRect(272, 340, 96, 80, 26), { fill: shade(PAL.skin, -0.12), tex: 0.5, shade: 0.4, ao: 0.35, hi: 0.05, shadeColor: '#6A4000', outline: PAL.skinLine, outlineW: 1.2 });
  const t = new Path2D(); t.moveTo(140, 520); t.bezierCurveTo(140, 440, 180, 392, 266, 386); t.quadraticCurveTo(320, 410, 374, 386); t.bezierCurveTo(460, 392, 500, 440, 500, 520); t.closePath();
  part(f, t, { fill: PAL.red,
    paint: g => {
      stripesPaint(g, 120, 520, 388, 520, 17, 12, 4);
      g.strokeStyle = PAL.white; g.lineWidth = 12; g.beginPath(); g.moveTo(268, 388); g.quadraticCurveTo(320, 414, 372, 388); g.stroke();
      g.strokeStyle = 'rgba(120,110,100,0.5)'; g.lineWidth = 1.2; for (let k = 0; k < 24; k++) { const x = 270 + k * 4.4, yy = 388 + 26 * Math.sin(Math.PI * (x - 268) / 104) * 0.5; g.beginPath(); g.moveTo(x, yy - 5); g.lineTo(x, yy + 5); g.stroke(); }
      // heart patch peeking at the bottom (HIS left chest = screen right)
      const hx = 410, hy = 480, hs = 24; const heart = new Path2D(); heart.moveTo(hx, hy + hs * 0.95); heart.bezierCurveTo(hx - hs * 1.3, hy + hs * 0.1, hx - hs * 0.9, hy - hs * 0.95, hx, hy - hs * 0.35); heart.bezierCurveTo(hx + hs * 0.9, hy - hs * 0.95, hx + hs * 1.3, hy + hs * 0.1, hx, hy + hs * 0.95);
      g.fillStyle = PAL.heart; g.fill(heart); g.save(); g.translate(hx, hy); g.scale(0.74, 0.74); g.translate(-hx, -hy + 1); g.setLineDash([3.5, 2.5]); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.6; g.stroke(heart); g.restore();
    },
    tex: 0.5, shade: 0.42, shadeDist: 14, shadeBlur: 24, ao: 0.28, hi: 0.12, shadeColor: '#2A0604', outline: PAL.stripeLine, outlineW: 1.4, cast: { alpha: 0.4, blur: 10, dist: 6 } });
  f.save(); f.translate(320, 220); f.scale(Rh, Rh);
  const head = drawHead(f, Object.assign({ turn: 0, mouth: 'smile', brows: 'up', px: Rh * SS / 100 * 0.6, cast: { alpha: 0.45, blur: 12, dist: 8 } }, o.head || {}));
  f.restore();
  finish(cv, big, o);
  return head;
}

/* ------------------------------------------------------------ SPECIAL POSES */
/* MIB sitting bolt upright on a child's chair (chair not drawn): 360x520, seat
 * contact ~(180, 380). Thighs come toward the camera (foreshortened), shins
 * hang, the feet dangle off the floor; hands flat on the knees, the pointer
 * across the lap. Drawn in BIM's frame and mirrored by the preset. */
function drawSit(cv, o) {
  o = o || {};
  const W = cv.width, Hh = cv.height, BW = W * SS, BH = Hh * SS, P = PAL;
  F.setup(BW, BH, { px: SS, light: { x: -0.55, y: -0.83 }, seed: 7 });
  const big = mk(BW, BH), f = big.getContext('2d');
  f.setTransform(SS, 0, 0, SS, 0, 0);
  const dy = -40;
  // shins + socks + dangling shoes (toes tipped down: we see the tops of the shoes)
  for (const sd of [-1, 1]) {
    const kx = 180 + sd * 30;
    part(f, tube([[kx, 404], [kx + sd * 1, 446], [kx + sd * 2, 478]], [23, 20, 18]), { fill: shade(P.skin, -0.04), tex: 0.55, shade: 0.42, ao: 0.28, hi: 0.1, shadeColor: '#6A4000', outline: P.skinLine, outlineW: 1.1, cast: { alpha: 0.3, blur: 5, dist: 3 } });
    part(f, roundRect(kx + sd * 2 - 12, 462, 24, 22, 6), { fill: P.sock, tex: 0.45, texB: true, shade: 0.35, ao: 0.25, hi: 0.08, shadeColor: '#4A4A48', outline: '#8E8A80', outlineW: 1,
      paint: g => { g.strokeStyle = 'rgba(217,71,59,0.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(kx + sd * 2 - 12, 470); g.lineTo(kx + sd * 2 + 12, 470); g.stroke(); } });
    shoe(f, kx + sd * 2, 512, sd, { scale: 0.95 });
  }
  f.save(); f.filter = `blur(${6 * SS}px)`; f.globalCompositeOperation = 'source-atop'; f.fillStyle = 'rgba(40,20,0,0.55)'; f.fillRect(130, 400, 100, 26); f.restore();
  // the seat of the shorts and the thighs coming at us
  const seat = new Path2D(); seat.moveTo(124, 352); seat.lineTo(236, 352); seat.bezierCurveTo(246, 372, 248, 392, 240, 406); seat.lineTo(120, 406); seat.bezierCurveTo(112, 392, 114, 372, 124, 352); seat.closePath();
  part(f, seat, { fill: g => { const gr = g.createLinearGradient(0, 352, 0, 406); gr.addColorStop(0, shade(P.shorts, 0.06)); gr.addColorStop(1, shade(P.shorts, 0.12)); return gr; },
    paint: g => { g.strokeStyle = 'rgba(10,20,60,0.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(180, 368); g.lineTo(180, 404); g.stroke(); },
    tex: 0.6, shade: 0.4, ao: 0.3, hi: 0.15, shadeColor: '#050A30', outline: P.shortsLine, outlineW: 1.2 });
  for (const sd of [-1, 1]) {   // knees: round yellow caps under the shorts' hems
    part(f, ellipse(180 + sd * 30, 408, 15, 11, 0), { fill: shade(P.skin, 0.04), tex: 0.55, shade: 0.35, ao: 0.3, hi: 0.15, shadeColor: '#6A4000', outline: P.skinLine, outlineW: 1 });
    part(f, roundRect(180 + sd * 30 - 27, 380, 54, 22, 9), { fill: P.shorts, tex: 0.6, shade: 0.35, ao: 0.3, hi: 0.18, shadeColor: '#050A30', outline: P.shortsLine, outlineW: 1.1,
      paint: g => { g.save(); g.setLineDash([3, 2.5]); g.strokeStyle = 'rgba(200,210,255,0.5)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(180 + sd * 30 - 24, 397); g.lineTo(180 + sd * 30 + 24, 397); g.stroke(); g.restore(); } });
  }
  // upper body (torso, neck, heart) raised by dy, then the head
  drawBody(f, { noLegs: true, noShorts: true, dy });
  f.save(); f.translate(180, 196 + dy); f.scale(86, 86);
  drawHead(f, { turn: 0, mouth: o.mouth || 'smile', flipV: !!o.flipV, brows: 'up', px: 86 * SS / 100 });
  f.restore();
  // the pointer across the lap, under the hands
  drawPointer(f, [96, 392], [262, 384], { starRot: 0.2 });
  // arms straight down, hands flat on the knees (fingers draped over them, toward us)
  for (const sd of [-1, 1]) {
    const sx = 180 + sd * 54, arm = [[sx, 262], [sx + sd * 10, 314], [180 + sd * 34, 356]];
    sleeve(f, arm);
    drawHand(f, { x: arm[2][0], y: arm[2][1], ang: -sd * 4, mirror: sd > 0, spread: 2, curl: 0.1, thumbAng: 26, scale: 0.92, fingerLen: 1.05 });
  }
  finish(cv, big, o);
}

/* MIB filming: a chunky 1990s shoulder camcorder held up to his face with both
 * hands, lens at the viewer, its lamp ON (hard white disc + bloom), one button
 * eye and the flipped-frown smile beside it. No brand names. */
function drawCamcorder(cv, o) {
  o = o || {};
  const W = cv.width, Hh = cv.height, BW = W * SS, BH = Hh * SS, P = PAL;
  F.setup(BW, BH, { px: SS, light: { x: -0.55, y: -0.83 }, seed: 7 });
  const big = mk(BW, BH), f = big.getContext('2d');
  f.setTransform(SS, 0, 0, SS, 0, 0);
  drawBody(f, {});
  f.save(); f.translate(180, 196); f.scale(86, 86);
  drawHead(f, { turn: 0, mouth: o.mouth || 'smile', flipV: !!o.flipV, brows: 'up', px: 86 * SS / 100 });
  f.restore();
  // arms: the outer hand grips the camera's side, the other arm tucks its elbow into the chest and
  // supports the lens from below (crossing UNDER the mouth, so the mouth and the free eye stay visible)
  sleeve(f, [[126, 304], [84, 280], [80, 214]]);
  sleeve(f, [[234, 304], [196, 336], [130, 262]]);
  // the camcorder: body box going back over the shoulder, the lens barrel at us
  const cx = 122, cy = 184;
  const bodyP = roundRect(cx - 50, cy - 40, 92, 82, 10);
  part(f, bodyP, { fill: g => { const gr = g.createLinearGradient(cx - 50, cy - 40, cx + 40, cy + 40); gr.addColorStop(0, '#4A4C52'); gr.addColorStop(1, '#1A1B1F'); return gr; },
    paint: g => {
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(cx + 18, cy - 30 + k * 6); g.lineTo(cx + 36, cy - 30 + k * 6); g.stroke(); }   // speaker grille
      g.fillStyle = '#B02020'; g.beginPath(); g.arc(cx + 30, cy + 26, 3, 0, TAU); g.fill();              // REC tally (dark)
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(cx - 44, cy + 28, 30, 5);                        // a blank label strip (no brand)
    },
    tex: 0.08, shade: 0.4, ao: 0.3, hi: 0.18, shadeColor: '#000000', outline: '#0A0A0C', outlineW: 1.2, cast: { alpha: 0.5, blur: 8, dist: 5 } });
  // handle on top + the lamp housing
  part(f, roundRect(cx - 40, cy - 58, 70, 14, 6), { fill: '#2A2B30', tex: 0.05, shade: 0.35, ao: 0.3, hi: 0.2, outline: '#08080A', outlineW: 1 });
  part(f, roundRect(cx - 30, cy - 82, 36, 26, 4), { fill: '#3A3B40', tex: 0.05, shade: 0.35, ao: 0.3, hi: 0.2, outline: '#08080A', outlineW: 1 });
  // lens barrel: concentric rings, deep glass with coated reflections
  const lx = cx - 4, ly = cy + 2;
  part(f, circle(lx, ly, 34), { fill: g => { const gr = g.createRadialGradient(lx - 10, ly - 12, 4, lx, ly, 34); gr.addColorStop(0, '#5A5C62'); gr.addColorStop(1, '#141418'); return gr; },
    paint: g => { g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1; for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; g.beginPath(); g.moveTo(lx + Math.cos(a) * 29, ly + Math.sin(a) * 29); g.lineTo(lx + Math.cos(a) * 33, ly + Math.sin(a) * 33); g.stroke(); } },
    tex: 0.05, shade: 0.35, ao: 0.3, hi: 0.2, outline: '#050506', outlineW: 1.2, cast: { alpha: 0.5, blur: 6, dist: 4 } });
  const glass = f.createRadialGradient(lx - 6, ly - 8, 1, lx, ly, 25);
  glass.addColorStop(0, '#2A3A55'); glass.addColorStop(0.5, '#0A0E1A'); glass.addColorStop(0.85, '#030407'); glass.addColorStop(1, '#202228');
  f.fillStyle = glass; f.beginPath(); f.arc(lx, ly, 25, 0, TAU); f.fill();
  f.strokeStyle = 'rgba(120,90,180,0.45)'; f.lineWidth = 1.5; f.beginPath(); f.arc(lx, ly, 17, Math.PI * 1.1, Math.PI * 1.6); f.stroke();
  f.strokeStyle = 'rgba(90,160,120,0.35)'; f.lineWidth = 1.2; f.beginPath(); f.arc(lx, ly, 11, Math.PI * 0.2, Math.PI * 0.7); f.stroke();
  f.fillStyle = 'rgba(255,255,255,0.75)'; f.beginPath(); f.ellipse(lx - 9, ly - 10, 4, 2.6, -0.6, 0, TAU); f.fill();
  // hands: one under the lens barrel, one gripping the body side
  drawHand(f, { x: 80, y: 214, ang: 186, mode: 'grip', thumbSide: -1, scale: 0.95 });
  drawHand(f, { x: 130, y: 262, ang: 148, mirror: true, spread: 3, curl: 0.6, thumbAng: 20, scale: 0.95 });
  finish(cv, big, o);
  // the lamp (after the mirror flip so the bloom is not resampled twice): a hard white disc
  const g = cv.getContext('2d'), lampX = o.mirror ? W - (cx - 12) : cx - 12, lampY = cy - 69;
  g.save();
  const bl = g.createRadialGradient(lampX, lampY, 2, lampX, lampY, 46);
  bl.addColorStop(0, 'rgba(255,255,250,0.9)'); bl.addColorStop(0.2, 'rgba(255,250,235,0.45)'); bl.addColorStop(0.55, 'rgba(255,245,225,0.12)'); bl.addColorStop(1, 'rgba(255,245,225,0)');
  g.fillStyle = bl; g.beginPath(); g.arc(lampX, lampY, 46, 0, TAU); g.fill();
  g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(lampX, lampY, 11, 8, 0, 0, TAU); g.fill();
  g.restore();
}

/* HIDDEN FIGURE: a near-black child-height silhouette, dead straight, arms to
 * the knees, the twins' bowl-cut puppet head tilted 15 degrees, two pinpoint
 * glints for eyes. Soft edge, 4-10% luma. 240x600, feet at (120, 588). */
function drawHidden(cv) {
  const W = cv.width, Hh = cv.height, BW = W * SS, BH = Hh * SS;
  const big = mk(BW, BH), f = big.getContext('2d');
  const sil = new Path2D();
  // legs + feet
  for (const sd of [-1, 1]) { sil.addPath(tube([[120 + sd * 15, 420], [120 + sd * 16, 510], [120 + sd * 17, 572]], [21, 18, 16])); sil.addPath(roundRect(120 + sd * 17 - 19, 566, 38, 22, 10)); }
  // torso: narrower and longer than the twins
  const t = new Path2D(); t.moveTo(94, 266); t.bezierCurveTo(84, 300, 84, 380, 90, 440); t.lineTo(150, 440); t.bezierCurveTo(156, 380, 156, 300, 146, 266); t.quadraticCurveTo(120, 272, 94, 266); t.closePath(); sil.addPath(t);
  sil.addPath(roundRect(108, 232, 24, 44, 8));
  // arms hanging dead straight, too long: the fingertips reach the knees
  for (const sd of [-1, 1]) {
    sil.addPath(tube([[120 + sd * 30, 276], [120 + sd * 41, 362], [120 + sd * 44, 446]], [18, 15, 13]));
    for (let k = 0; k < 4; k++) sil.addPath(tube([[120 + sd * 44 + (k - 1.5) * 3.6, 444], [120 + sd * 44 + (k - 1.5) * 5, 494 - Math.abs(k - 1.5) * 4]], [4.8, 3.8]));
  }
  // the head: bowl cut, tilted 15 degrees about the neck (logical units)
  const HT = new DOMMatrix().translate(120, 238).rotate(15).translate(-120, -238);
  const hd = new Path2D(); hd.ellipse(120, 178, 60, 56, 0, 0, TAU); sil.addPath(hd, HT);
  const hair = new Path2D(); hair.moveTo(54, 188); hair.bezierCurveTo(48, 98, 192, 98, 186, 188); hair.lineTo(180, 200); hair.lineTo(60, 200); hair.closePath(); sil.addPath(hair, HT);
  for (const sd of [-1, 1]) { const ear = new Path2D(); ear.ellipse(120 + sd * 60, 196, 9, 11, 0, 0, TAU); sil.addPath(ear, HT); }
  const eyesAt = [[99, 180], [141, 180]].map(([x, y]) => { const p = HT.transformPoint(new DOMPoint(x, y)); return [p.x, p.y]; });
  // fill near-black with a faint felt mottling (4-10% luma), soften the edge
  const L = mk(BW, BH), lg = L.getContext('2d'); lg.setTransform(SS, 0, 0, SS, 0, 0);
  lg.fillStyle = 'rgb(16,15,17)'; lg.fill(sil);
  {   // felt mottling as a +-30% modulation of the near-black (stays within 4-10% luma)
    const tx = F.feltTexture(BW, BH, 31, 2.2).getContext('2d').getImageData(0, 0, BW, BH).data, id = lg.getImageData(0, 0, BW, BH), d = id.data;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { const k = 0.7 + 0.6 * tx[i] / 255; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; }
    lg.putImageData(id, 0, 0);
  }
  f.filter = `blur(${2.4 * SS}px)`; f.drawImage(L, 0, 0); f.filter = `blur(${1.0 * SS}px)`; f.drawImage(L, 0, 0); f.filter = 'none';
  // two pinpoint glints where the button eyes would be
  f.setTransform(SS, 0, 0, SS, 0, 0);
  for (const [x, y] of eyesAt) {
    const gr = f.createRadialGradient(x, y, 0, x, y, 2.4); gr.addColorStop(0, 'rgba(235,238,245,1)'); gr.addColorStop(0.45, 'rgba(160,162,170,0.5)'); gr.addColorStop(1, 'rgba(60,60,70,0)');
    f.fillStyle = gr; f.beginPath(); f.arc(x, y, 2.4, 0, TAU); f.fill();
  }
  finish(cv, big, {});
}

/* a small figure kneeling on a couch cushion, back to the viewer: the bowl cut
 * from behind, yellow felt nape, striped shirt, arms at its sides, the soles of
 * the red sneakers toward us. Dim and flat (it sits at ~6% luma in a CRT
 * reflection). 240x320, knee/cushion contact at (120, 300). */
function drawCouchBack(cv) {
  const W = cv.width, Hh = cv.height, BW = W * SS, BH = Hh * SS, P = PAL;
  F.setup(BW, BH, { px: SS * 0.8, light: { x: 0.2, y: -0.98 }, seed: 7 });
  const big = mk(BW, BH), f = big.getContext('2d');
  f.setTransform(SS, 0, 0, SS, 0, 0);
  const flat = { shade: 0.3, ao: 0.25, hi: 0.06, tex: 0.45 };
  // shins folded under: the soles of the sneakers face us at the bottom
  // shorts (the seat, sitting back on the heels)
  const sh = new Path2D(); sh.moveTo(76, 216); sh.lineTo(164, 216); sh.bezierCurveTo(178, 236, 182, 256, 172, 274); sh.quadraticCurveTo(120, 284, 68, 274); sh.bezierCurveTo(58, 256, 62, 236, 76, 216); sh.closePath();
  // the soles of the sneakers stick out under the seat, toward us
  for (const sd of [-1, 1]) {
    part(f, roundRect(120 + sd * 30 - 17, 268, 34, 34, 13), Object.assign({ fill: P.sole, outline: '#5A544A', outlineW: 1,
      paint: g => { g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 1.1; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(120 + sd * 30 - 12, 274 + k * 4.5); g.lineTo(120 + sd * 30 + 12, 274 + k * 4.5); g.stroke(); }
        g.strokeStyle = 'rgba(210,48,42,0.9)'; g.lineWidth = 3; g.beginPath(); g.roundRect(120 + sd * 30 - 16, 269, 32, 32, 12); g.stroke(); } }, flat));
  }
  part(f, sh, Object.assign({ fill: P.shortsLo, outline: P.shortsLine, outlineW: 1.1, paint: g => { g.strokeStyle = 'rgba(0,0,30,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(120, 224); g.quadraticCurveTo(122, 254, 120, 280); g.stroke(); } }, flat));
  // back of the shirt
  const t = new Path2D(); t.moveTo(96, 112); t.bezierCurveTo(74, 114, 66, 126, 66, 146); t.bezierCurveTo(64, 180, 66, 204, 72, 222); t.quadraticCurveTo(120, 230, 168, 222);
  t.bezierCurveTo(174, 204, 176, 180, 174, 146); t.bezierCurveTo(174, 126, 166, 114, 144, 112); t.quadraticCurveTo(120, 118, 96, 112); t.closePath();
  part(f, t, Object.assign({ fill: P.red, outline: P.stripeLine, outlineW: 1.1, paint: g => { stripesPaint(g, 60, 180, 116, 230, 9, 5, 3); g.strokeStyle = 'rgba(60,10,6,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(120, 120); g.lineTo(120, 220); g.stroke(); } }, flat));
  // arms at the sides, hands resting on the cushion
  for (const sd of [-1, 1]) {
    const arm = [[120 + sd * 50, 124], [120 + sd * 58, 176], [120 + sd * 58, 226]];
    sleeve(f, arm, { cast: { alpha: 0.2, blur: 4, dist: 2 } });
    drawHand(f, { x: arm[2][0], y: arm[2][1], ang: -sd * 4, mirror: sd > 0, spread: 2, curl: 0.3, scale: 0.85 });
  }
  // nape (yellow felt) and the back of the bowl cut covering the whole head
  part(f, roundRect(104, 94, 32, 26, 8), Object.assign({ fill: shade(P.skin, -0.12), outline: P.skinLine, outlineW: 1 }, flat));
  const hp = new Path2D(); hp.ellipse(120, 58, 62, 54, 0, 0, TAU);
  part(f, hp, Object.assign({ fill: P.hairLo, outline: P.hairLine, outlineW: 1.1,
    paint: g => { const r = R('backhair'); g.lineCap = 'round'; for (let i = 0; i < 50; i++) { const x0 = 120 + (r() - 0.5) * 20, x1 = 120 + (r() - 0.5) * 120; g.strokeStyle = `rgba(20,8,2,${0.15 + r() * 0.2})`; g.lineWidth = 0.8 + r(); g.beginPath(); g.moveTo(x0, 10 + r() * 8); g.quadraticCurveTo((x0 + x1) / 2, 50, x1, 100 + r() * 8); g.stroke(); }
      g.strokeStyle = 'rgba(10,4,0,0.6)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(66, 100); for (let k = 0; k <= 16; k++) g.lineTo(66 + k * 6.75, 104 + (k % 2) * 3); g.stroke(); } }, flat));
  // ears peeking at the sides of the bowl
  for (const sd of [-1, 1]) part(f, ellipse(120 + sd * 62, 74, 8, 11, 0), Object.assign({ fill: shade(P.skin, -0.15), outline: P.skinLine, outlineW: 1 }, flat));
  // flatten and dim: it lives inside a dark reflection
  finish(cv, big, { post: (c) => { const g = c.getContext('2d'); const id = g.getImageData(0, 0, c.width, c.height), d = id.data; for (let i = 0; i < d.length; i += 4) { for (let k = 0; k < 3; k++) d[i + k] = d[i + k] * 0.72 + 6; } g.putImageData(id, 0, 0); } });
}

/* ------------------------------------------------------------ PRESETS */
const CHAR = {};
const T = (o) => (cv) => drawTwin(cv, o);
// MIB = BIM's drawing mirrored, with his own mouth: BIM's frown turned upside down
const MIBM = { mouth: 'frown', flipV: true, mirror: true };
const MIBT = { mouth: 'talk', flipV: true, mirror: true };
CHAR.bim_idle = T({ pose: 'idle' });
CHAR.bim_talk = T({ pose: 'idle', mouth: 'talk' });
CHAR.bim_point = T({ pose: 'point' });
CHAR.bim_point_talk = T({ pose: 'point', mouth: 'talk' });
CHAR.bim_walk_a = T({ pose: 'walk_a' });
CHAR.bim_walk_b = T({ pose: 'walk_b' });
CHAR.mib_idle = T(Object.assign({ pose: 'idle' }, MIBM));
CHAR.mib_talk = T(Object.assign({ pose: 'idle' }, MIBT));
CHAR.mib_point = T(Object.assign({ pose: 'point' }, MIBM));
CHAR.mib_wave = T(Object.assign({ pose: 'wave' }, MIBM));
// close-ups: BIM looks 5 degrees past the lens (one button offset outward by 0.08 eye width);
// MIB (mirrored) stares dead into the lens with symmetric catchlights
CHAR.bim_close = (cv) => drawClose(cv, { head: { mouth: 'smile', gaze: [[-0.16, 0], [0, 0]] } });
CHAR.bim_close_frown = (cv) => drawClose(cv, { head: { mouth: 'frown', brows: 'sad' } });
CHAR.mib_close_smile = (cv) => drawClose(cv, { head: { mouth: 'frown', flipV: true }, mirror: true });
CHAR.mib_close_talk = (cv) => drawClose(cv, { head: { mouth: 'talk', flipV: true }, mirror: true });
CHAR.mib_chair_sit = (cv) => drawSit(cv, { mouth: 'frown', flipV: true, mirror: true });
CHAR.mib_camcorder = (cv) => drawCamcorder(cv, { mouth: 'frown', flipV: true, mirror: true });
CHAR.hidden_twin_stand = (cv) => drawHidden(cv);
CHAR.bim_couch_back = (cv) => drawCouchBack(cv);

root.OPP = Object.assign(root.OPP || {}, { drawSit, drawCamcorder, drawHidden, drawCouchBack, CHAR, PAL, SS, drawTwin, drawClose, drawHead, drawBody, drawHand, drawPointer, sleeve, shoe, buttonEye, runStitch, drawMouth, mouthCurve, headOutline, hairShape, POSES, finish, fx, fk });
})(typeof window !== 'undefined' ? window : globalThis);
