// =====================================================================
//  WORLD — biome construction: ground, props, skyline, hazards, weather
// =====================================================================
const ARENA = 58;
const W = { scene: null, sky: null, hemi: null, sun: null, group: null, colliders: [], hazards: [], anims: [], amb: null, biome: null, mods: {}, water: null };

function initWorld() {
  const sc = new THREE.Scene(); W.scene = sc;
  W.sky = makeSky(); sc.add(W.sky);
  sc.fog = new THREE.FogExp2(0x000000, 0.02);
  W.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7); sc.add(W.hemi);
  W.sun = new THREE.DirectionalLight(0xffffff, 0.9); W.sun.castShadow = true;
  const sh = W.sun.shadow; sh.mapSize.set(2048, 2048); sh.camera.left = -34; sh.camera.right = 34; sh.camera.top = 34; sh.camera.bottom = -34; sh.camera.near = 1; sh.camera.far = 140; sh.bias = -0.0006; sh.normalBias = 0.03;
  sc.add(W.sun); sc.add(W.sun.target);
  W.amb = new THREE.AmbientLight(0xffffff, 0.12); sc.add(W.amb);
}
function onQualityChanged() {
  if (!W.sun) return;
  W.sun.castShadow = R.shadows;
  const sz = S.set.quality === 'ultra' ? 2048 : 1024;
  if (W.sun.shadow.mapSize.x !== sz) { W.sun.shadow.mapSize.set(sz, sz); if (W.sun.shadow.map) { W.sun.shadow.map.dispose(); W.sun.shadow.map = null; } }
}

// ---------------- ground textures ----------------
function paintGround(gd, seed) {
  const N = 512, rnd = mulberry32(seed);
  const cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d');
  let ev = null, e = null;
  if (gd.e) { ev = document.createElement('canvas'); ev.width = ev.height = N; e = ev.getContext('2d'); e.fillStyle = '#000'; e.fillRect(0, 0, N, N); }
  const c = gd.c, R2 = (a, b) => a + rnd() * (b - a);
  g.fillStyle = c[0]; g.fillRect(0, 0, N, N);
  const blot = (n, cols, r0, r1, a) => { for (let i = 0; i < n; i++) { g.globalAlpha = a; g.fillStyle = cols[(rnd() * cols.length) | 0]; const x = rnd() * N, y = rnd() * N, r = R2(r0, r1); for (const [dx, dy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N]]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, TAU); g.fill(); } } g.globalAlpha = 1; };
  const line = (ctx, x0, y0, x1, y1, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  const crack = (ctx, col, w, n) => { for (let i = 0; i < n; i++) { let x = rnd() * N, y = rnd() * N; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 8; k++) { x += R2(-40, 40); y += R2(-40, 40); ctx.lineTo(x, y); } ctx.stroke(); } };
  switch (gd.pat) {
    case 'snow': blot(300, [c[1], c[2]], 6, 40, 0.35); for (let i = 0; i < 400; i++) { g.fillStyle = '#fff'; g.fillRect(rnd() * N, rnd() * N, 2, 2); } break;
    case 'grass': blot(200, [c[1], c[2]], 10, 50, 0.4); for (let i = 0; i < 2500; i++) { const x = rnd() * N, y = rnd() * N; line(g, x, y, x + R2(-3, 3), y - R2(4, 10), 1.5, rnd() < 0.5 ? c[1] : '#5aaa3a'); } break;
    case 'mud': blot(260, [c[1], c[2], '#2a3a20'], 8, 60, 0.45); break;
    case 'cobble': for (let y = 0; y < N; y += 32) for (let x = 0; x < N; x += 32) { g.fillStyle = rnd() < 0.5 ? c[1] : c[0]; const ox = (y / 32) % 2 ? 16 : 0; g.beginPath(); g.roundRect ? g.roundRect(x + ox + 2, y + 2, 28, 28, 7) : g.rect(x + ox + 2, y + 2, 28, 28); g.fill(); } g.globalAlpha = 0.6; g.fillStyle = c[2]; blot(80, [c[2]], 4, 14, 0.3); break;
    case 'asphalt': blot(500, [c[1], c[2]], 2, 8, 0.4); for (let i = 0; i <= N; i += 128) { line(g, i, 0, i, N, 3, '#2a2a3a'); line(g, 0, i, N, i, 3, '#2a2a3a'); if (e) { line(e, i, 0, i, N, 2.5, gd.e); line(e, 0, i, N, i, 2.5, gd.e); } } if (e) for (let i = 0; i < 6; i++) { const y = rnd() * N; e.globalAlpha = 0.5; line(e, 0, y, N, y, 1, gd.e); e.globalAlpha = 1; } break;
    case 'lava': blot(300, [c[1], c[2]], 10, 40, 0.5); crack(g, '#000', 5, 26); if (e) { crack(e, gd.e, 3, 26); e.filter = 'blur(3px)'; e.globalAlpha = 0.7; crack(e, '#ffaa00', 6, 10); e.filter = 'none'; e.globalAlpha = 1; } break;
    case 'tiles': for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? c[0] : c[1]; g.fillRect(x * 64, y * 64, 64, 64); g.strokeStyle = '#000'; g.lineWidth = 2; g.strokeRect(x * 64, y * 64, 64, 64); } blot(60, [c[2]], 3, 20, 0.25); break;
    case 'void': blot(120, [c[1], c[2]], 20, 80, 0.5); if (e) { for (let i = 0; i < 300; i++) { e.fillStyle = rnd() < 0.7 ? '#fff' : gd.e; e.fillRect(rnd() * N, rnd() * N, 2, 2); } e.globalAlpha = 0.5; crack(e, gd.e, 2, 6); e.globalAlpha = 1; } break;
    case 'plates': for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = rnd() < 0.5 ? c[0] : c[2]; g.fillRect(x * 128 + 2, y * 128 + 2, 124, 124); g.fillStyle = '#1a1e24'; for (const [a, b] of [[10, 10], [114, 10], [10, 114], [114, 114]]) { g.beginPath(); g.arc(x * 128 + a, y * 128 + b, 4, 0, TAU); g.fill(); } } blot(60, ['#1a1e24'], 3, 18, 0.3); if (e) { e.globalAlpha = 0.8; line(e, 0, 256, N, 256, 4, gd.e); line(e, 256, 0, 256, N, 4, gd.e); e.globalAlpha = 1; } break;
    case 'sand': for (let y = 0; y < N; y += 6) { g.globalAlpha = 0.25; line(g, 0, y + Math.sin(y * 0.1) * 4, N, y + Math.sin(y * 0.1 + 2) * 4, 2, rnd() < 0.5 ? c[1] : c[2]); } g.globalAlpha = 1; blot(200, [c[1], c[2]], 4, 30, 0.25); break;
    case 'glitch': for (let i = 0; i <= N; i += 32) { line(g, i, 0, i, N, 1, '#0a2a1a'); line(g, 0, i, N, i, 1, '#0a2a1a'); } if (e) { for (let i = 0; i <= N; i += 64) { e.globalAlpha = 0.9; line(e, i, 0, i, N, 2, gd.e); line(e, 0, i, N, i, 2, gd.e); } for (let i = 0; i < 30; i++) { e.globalAlpha = rnd() * 0.8; e.fillStyle = rnd() < 0.8 ? gd.e : '#ff00ff'; e.fillRect(((rnd() * 16) | 0) * 32, ((rnd() * 16) | 0) * 32, 32, 32); } e.globalAlpha = 1; } break;
    case 'ice': blot(150, [c[1], c[2]], 20, 70, 0.35); crack(g, 'rgba(255,255,255,.7)', 1.5, 30); if (e) { e.globalAlpha = 0.35; crack(e, gd.e, 1.5, 16); e.globalAlpha = 1; } break;
    case 'clouds': blot(220, [c[1], c[2], '#ffffff'], 20, 60, 0.45); if (e) { e.globalAlpha = 0.25; for (let i = 0; i <= N; i += 128) { line(e, i, 0, i, N, 3, gd.e); line(e, 0, i, N, i, 3, gd.e); } e.globalAlpha = 1; } break;
    case 'rock': blot(400, [c[1], c[2]], 4, 30, 0.5); crack(g, '#000', 2, 20); if (e) { e.globalAlpha = 0.6; crack(e, gd.e, 2, 10); e.globalAlpha = 1; } break;
    case 'hex': { const s = 32, h = s * Math.sqrt(3) / 2; for (let row = -1; row < N / h + 1; row++) for (let col = -1; col < N / (s * 1.5) + 1; col++) { const x = col * s * 1.5, y = row * h * 2 + (col % 2 ? h : 0); g.fillStyle = rnd() < 0.5 ? c[0] : c[1]; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.lineTo(x + Math.cos(a) * (s - 2), y + Math.sin(a) * (s - 2)); } g.fill(); if (e && rnd() < 0.5) { e.strokeStyle = gd.e; e.globalAlpha = rnd() * 0.9; e.lineWidth = 2; e.beginPath(); for (let k = 0; k <= 6; k++) { const a = k / 6 * TAU; e.lineTo(x + Math.cos(a) * (s - 2), y + Math.sin(a) * (s - 2)); } e.stroke(); } } if (e) e.globalAlpha = 1; break; }
    case 'dirt': blot(400, [c[1], c[2]], 3, 24, 0.45); for (let i = 0; i < 400; i++) { const x = rnd() * N, y = rnd() * N; line(g, x, y, x + R2(-2, 2), y - R2(3, 6), 1, '#3a4a20'); } break;
    case 'sludge': blot(250, [c[1], c[2]], 10, 50, 0.5); if (e) { for (let i = 0; i < 70; i++) { e.globalAlpha = rnd() * 0.8; e.fillStyle = gd.e; e.beginPath(); e.arc(rnd() * N, rnd() * N, R2(2, 12), 0, TAU); e.fill(); } e.globalAlpha = 1; } break;
    case 'crystalfloor': blot(200, [c[1], c[2]], 10, 50, 0.5); if (e) { e.globalAlpha = 0.85; crack(e, gd.e, 2, 18); e.globalAlpha = 0.5; crack(e, '#7af8ff', 1, 10); e.globalAlpha = 1; } break;
    case 'molten': if (e) { e.fillStyle = gd.e; e.fillRect(0, 0, N, N); } blot(160, [c[1], c[2]], 15, 55, 0.85); if (e) { e.fillStyle = '#000'; for (let i = 0; i < 140; i++) { e.globalAlpha = 0.85; e.beginPath(); e.arc(rnd() * N, rnd() * N, R2(14, 50), 0, TAU); e.fill(); } e.globalAlpha = 1; } break;
    case 'reef': blot(200, [c[1], c[2]], 6, 40, 0.4); if (e) { e.globalAlpha = 0.3; for (let i = 0; i < 60; i++) { const x = rnd() * N, y = rnd() * N; e.strokeStyle = gd.e; e.lineWidth = 2; e.beginPath(); e.arc(x, y, R2(10, 30), 0, R2(1, 3)); e.stroke(); } e.globalAlpha = 1; } break;
    default: blot(200, [c[1] || c[0], c[2] || c[0]], 5, 40, 0.4);
  }
  const mk = cvs => { const t = new THREE.CanvasTexture(cvs); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(26, 26); t.anisotropy = R.renderer.capabilities.getMaxAnisotropy(); return t; };
  return { map: mk(cv), emap: ev ? mk(ev) : null };
}

// ---------------- window texture for buildings ----------------
let _winTex = {};
function windowTex(col) {
  if (_winTex[col]) return _winTex[col];
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 128; y += 8) for (let x = 4; x < 64; x += 8) if (Math.random() < 0.45) { g.fillStyle = Math.random() < 0.85 ? col : '#ffffff'; g.globalAlpha = rand(0.4, 1); g.fillRect(x, y, 4, 5); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return (_winTex[col] = t);
}

// ---------------- props ----------------
// a prop = { parts:[{geo,mat,m(Matrix4),colors?}], r (collider radius), cols?, anim? }
const _pm = new THREE.Matrix4(), _pq = new THREE.Quaternion(), _pe = new THREE.Euler(), _ps = V3(), _pp = V3();
function P(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, colors) {
  const m = new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V3(sx, sy, sz));
  return { geo, mat, m, colors };
}
const WOOD = () => matStd(0x5a3a22, { r: 0.9 }), DARKWOOD = () => matStd(0x2a1a12, { r: 0.9 });
const PROPS = {
  pine: o => { const leaf = matStd(o.c ? new THREE.Color(o.c).getHex() : 0x1f5a32, { r: 0.85, flat: true }), snow = matStd(0xf4f8ff, { r: 0.9, flat: true }); const p = [P(GC(0.2, 0.3, 1.6, 6), WOOD(), 0, 0.8, 0)]; [[1.6, 2, 2], [1.25, 1.8, 3.1], [0.9, 1.5, 4.1]].forEach(([r, h, y]) => { p.push(P(GK(r, h, 7), leaf, 0, y, 0)); if (o.snow) p.push(P(GK(r * 0.75, h * 0.45, 7), snow, 0, y + h * 0.3, 0)); }); return { parts: p, r: 0.5 }; },
  palm: o => { const p = []; for (let i = 0; i < 6; i++) p.push(P(GC(0.22 - i * 0.015, 0.26 - i * 0.015, 1.1, 7), matStd(i % 2 ? 0x8a6a3a : 0x7a5a2a, { r: 0.9 }), i * i * 0.04, 0.55 + i * 1.05, 0, 0, 0, -i * 0.04)); const lm = matStd(0x2aa83a, { r: 0.7, side: 1 }); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; p.push(P(GB(0.5, 0.05, 3.2), lm, 1.0 + Math.cos(a) * 1.4, 6.3, Math.sin(a) * 1.4, 0, -a + Math.PI / 2, 0.35)); } p.push(P(GS(0.22, 8, 6), matStd(0x4a3018), 1.0, 6.0, 0.25)); p.push(P(GS(0.22, 8, 6), matStd(0x4a3018), 0.8, 6.0, -0.2)); return { parts: p, r: 0.45 }; },
  jungletree: o => { const p = [P(GC(0.55, 0.85, 7, 8), matStd(0x4a3020, { r: 0.95 }), 0, 3.5, 0)]; const lm = matStd(0x1f7a2a, { r: 0.85, flat: true }), lm2 = matStd(0x2a9a3a, { r: 0.85, flat: true }); [[0, 8, 0, 3.2], [1.8, 7.2, 0.6, 2.4], [-1.6, 7.4, -0.8, 2.5], [0.4, 9.2, -1, 2.2]].forEach(([x, y, z, r], i) => p.push(P(GI(r, 1), i % 2 ? lm : lm2, x, y, z))); p.push(P(GC(0.04, 0.04, 5, 4), matStd(0x2a6a1a), 1.4, 4.5, 0.4)); p.push(P(GC(0.04, 0.04, 4, 4), matStd(0x2a6a1a), -1.2, 5, -0.5)); return { parts: p, r: 0.9 }; },
  deadtree: o => { const m = matStd(o.c ? new THREE.Color(o.c).getHex() : 0x3a2a20, { r: 0.95 }); return { parts: [P(GC(0.18, 0.38, 5, 6), m, 0, 2.5, 0, 0, 0, 0.08), P(GC(0.06, 0.14, 2.2, 5), m, 0.7, 4.0, 0, 0, 0, -0.9), P(GC(0.05, 0.12, 2, 5), m, -0.6, 3.4, 0.2, 0.2, 0, 1.0), P(GC(0.04, 0.1, 1.6, 5), m, 0.1, 5.2, -0.4, -0.6, 0, 0.2), P(GC(0.04, 0.08, 1.4, 5), m, 1.3, 4.9, 0, 0, 0, -0.3)], r: 0.4 }; },
  cherry: o => ({ parts: [P(GC(0.2, 0.35, 3, 6), matStd(0x3a2018), 0, 1.5, 0), P(GI(1.8, 1), matStd(0xff8ad8, { r: 0.8, e: 0xff2a8a, ei: 0.25, flat: true }), 0, 3.8, 0), P(GI(1.2, 1), matStd(0xffb0e0, { r: 0.8, e: 0xff2a8a, ei: 0.2, flat: true }), 1, 3.4, 0.5)], r: 0.4 }),
  fern: o => { const m = matStd(o.c ? new THREE.Color(o.c).getHex() : 0x2a8a2a, { r: 0.8, flat: true }); const p = []; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; p.push(P(GK(0.25, 1.4, 4), m, Math.cos(a) * 0.4, 0.5, Math.sin(a) * 0.4, Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8)); } return { parts: p, r: 0 }; },
  flower: o => ({ parts: [P(GC(0.03, 0.03, 0.6, 4), matStd(0x2a7a2a), 0, 0.3, 0), P(GS(0.18, 8, 6), matStd(0xffffff, { r: 0.6, e: 0x222222, ei: 1 }), 0, 0.65, 0, 0, 0, 0, 1, 0.6, 1, [0xff4a8a, 0xffe600, 0xa04dff, 0xff6a3a, 0x4ac8ff])], r: 0 }),
  reeds: o => { const p = [], m = matStd(0x5a7a3a, { r: 0.9 }); for (let i = 0; i < 6; i++) p.push(P(GK(0.05, rand(1.2, 2.2), 4), m, rand(-0.4, 0.4), 0.8, rand(-0.4, 0.4), rand(-0.15, 0.15), 0, rand(-0.15, 0.15))); p.push(P(GC(0.06, 0.06, 0.35, 5), matStd(0x5a3a1a), 0.1, 1.9, 0)); return { parts: p, r: 0 }; },
  seaweed: o => { const m = matStd(0x2a9a5a, { r: 0.7, e: 0x0a3a1a, ei: 0.4 }); return { parts: [P(GK(0.18, 2.5, 5), m, 0, 1.2, 0, 0.1), P(GK(0.15, 2, 5), m, 0.3, 1, 0.2, -0.15), P(GK(0.12, 1.6, 5), m, -0.25, 0.8, -0.1, 0, 0, 0.2)], r: 0 }; },
  coral: o => { const m = matStd(0xffffff, { r: 0.6, e: 0x222222, ei: 1 }), cols = [0xff5a7a, 0xffaa3a, 0xa04dff, 0x3affc8, 0xff7af2]; const p = []; for (let i = 0; i < 6; i++) p.push(P(GC(0.08, 0.18, rand(1, 2.4), 6), m, rand(-0.4, 0.4), 0.8, rand(-0.4, 0.4), rand(-0.5, 0.5), 0, rand(-0.5, 0.5), 1, 1, 1, cols)); p.push(P(GS(0.6, 10, 8), m, 0, 0.3, 0, 0, 0, 0, 1, 0.6, 1, cols)); return { parts: p, r: 0.5 }; },
  mushroom: o => { const cc = o.c ? new THREE.Color(o.c).getHex() : 0xff5a3a; return { parts: [P(GC(0.18, 0.25, 1.4, 8), matStd(0xf0e0c8), 0, 0.7, 0), P(GS(0.9, 14, 8), matStd(cc, { r: 0.6, e: o.glow ? cc : 0x000000, ei: o.glow ? 0.8 : 0 }), 0, 1.45, 0, 0, 0, 0, 1, 0.45, 1)], r: 0.35 }; },
  cactus: o => { const m = matStd(0x3a8a3a, { r: 0.8 }); return { parts: [P(GC(0.35, 0.4, 3.2, 8), m, 0, 1.6, 0), P(GS(0.35, 8, 6), m, 0, 3.2, 0), P(GC(0.2, 0.2, 1.2, 6), m, 0.6, 1.8, 0, 0, 0, Math.PI / 2), P(GC(0.2, 0.2, 1.1, 6), m, 1.1, 2.3, 0), P(GC(0.18, 0.18, 1, 6), m, -0.55, 1.4, 0, 0, 0, Math.PI / 2), P(GC(0.18, 0.18, 0.9, 6), m, -0.95, 1.8, 0)], r: 0.5 }; },
  rock: o => { const c = o.c ? new THREE.Color(o.c).getHex() : 0x5a5a64; const p = [P(GD(1.2), matStd(c, { r: 0.95, flat: true }), 0, 0.5, 0, 0, 0, 0, 1.3, 0.8, 1.1)]; if (o.snow) p.push(P(GD(1.0), matStd(0xf4f8ff, { r: 0.9, flat: true }), 0, 1.0, 0, 0, 0, 0, 1.1, 0.4, 0.95)); return { parts: p, r: 1.3 }; },
  lavarock: o => ({ parts: [P(GD(1.3), matStd(0x1a1210, { r: 0.95, flat: true }), 0, 0.6, 0, 0, 0, 0, 1.2, 0.9, 1.1), P(GT(1.15, 0.08, 4, 18), matGlow(0xff5a00, 1, false), 0, 0.5, 0, Math.PI / 2, 0, 0, 1.1, 1, 1)], r: 1.4 }),
  spike: o => { const c = o.c ? new THREE.Color(o.c).getHex() : 0x2a2030; return { parts: [P(GK(0.6, 4.5, 5), matStd(c, { r: 0.6, m: 0.3, flat: true }), 0, 2.25, 0, 0.1, 0, 0.1), P(GK(0.35, 2.4, 5), matStd(c, { r: 0.6, m: 0.3, flat: true }), 0.7, 1.2, 0.2, 0, 0, -0.3)], r: 0.6 }; },
  volcano: o => ({ parts: [P(GC(1.2, 5, 6, 10), matStd(0x1a1210, { r: 0.95, flat: true }), 0, 3, 0), P(GC(1.15, 1.15, 0.1, 10), matGlow(0xff5a00, 1, false), 0, 6, 0)], r: 4.5, anim: (g, t) => { if (Math.random() < 0.3) { _ep.set(0, 6.2, 0); g.localToWorld(_ep); FX.c.set(0xff6a00); PG.spawn(_ep.x + rand(-0.5, 0.5), _ep.y, _ep.z + rand(-0.5, 0.5), rand(-1, 1), rand(4, 8), rand(-1, 1), FX.c, 1, 0.4, 1.5, 4, 0.2, 0); FX.c.set(0x2a2a2a); PS.spawn(_ep.x, _ep.y, _ep.z, rand(-0.5, 0.5), rand(1.5, 3), rand(-0.5, 0.5), FX.c, 0.4, 2.5, 3, -0.2, 0.3, 2); } } }),
  crystal: o => { const mix = o.c === 'mix'; const base = mix ? 0xffffff : new THREE.Color(o.c || 0xa04dff).getHex(); const m = matStd(base, { r: 0.05, m: 0.6, e: mix ? 0x6a3aff : base, ei: mix ? 0.6 : 0.55, flat: true }); const cols = mix ? [0xff7af2, 0x7af8ff, 0xc07cff, 0xaaffcc] : null; const s = o.big ? 1.8 : 1; const p = []; for (let i = 0; i < 4; i++) p.push(P(GO(0.5 * s), m, rand(-0.5, 0.5) * s, 0.9 * s, rand(-0.5, 0.5) * s, rand(-0.4, 0.4), rand(0, 3), rand(-0.4, 0.4), 0.6, rand(2, 3.5), 0.6, cols)); return { parts: p, r: 0.7 * s }; },
  floatrock: o => { const c = o.c ? new THREE.Color(o.c).getHex() : 0x2a1a3a; return { parts: [P(GK(1.6, 2.6, 6), matStd(c, { r: 0.9, flat: true }), 0, 0, 0, Math.PI), P(GD(1.4), matStd(c, { r: 0.9, flat: true }), 0, 0.9, 0, 0, 0, 0, 1.2, 0.4, 1.2), P(GO(0.3), matGlow(0xb04dff, 1, false), 0.5, 1.4, 0.2, 0, 0, 0, 1, 2, 1)], r: 0, single: true, y: [3, 11], anim: (g, t) => { g.position.y = g.userData.by + Math.sin(t * 0.8 + g.userData.ph) * 0.6; g.rotation.y += 0.003; } }; },
  obelisk: o => { const c = new THREE.Color(o.c || 0x1a1a2a).getHex(), e = new THREE.Color(o.e || 0x00ffaa).getHex(); return { parts: [P(GC(0.5, 0.9, 7, 4), matStd(c, { r: 0.5, m: 0.4 }), 0, 3.5, 0, 0, Math.PI / 4), P(GK(0.5, 1, 4), matStd(c, { r: 0.5, m: 0.4 }), 0, 7.5, 0, 0, Math.PI / 4), P(GB(0.12, 5, 0.12), matGlow(e, 1, false), 0, 3.5, 0.62), P(GO(0.3), matGlow(e, 1, false), 0, 8.6, 0)], r: 0.8 }; },
  gift: o => ({ parts: [P(GB(1.1, 1.1, 1.1), matStd(0xffffff, { r: 0.5 }), 0, 0.55, 0, 0, 0, 0, 1, 1, 1, [0xd0202a, 0x2ecc71, 0x3a8aff, 0xa04dff, 0xff8a00]), P(GB(1.15, 1.15, 0.22), matStd(0xffd700, { r: 0.3, m: 0.6 }), 0, 0.55, 0), P(GB(0.22, 1.15, 1.15), matStd(0xffd700, { r: 0.3, m: 0.6 }), 0, 0.55, 0), P(GT(0.18, 0.06, 6, 10), matStd(0xffd700, { m: 0.6 }), 0, 1.2, 0)], r: 0.7 }),
  candycane: o => { const w = matStd(0xffffff, { r: 0.3 }), rd = matStd(0xe0202a, { r: 0.3 }); const p = [P(GC(0.14, 0.14, 2.6, 8), w, 0, 1.3, 0), P(GT(0.35, 0.14, 8, 12, Math.PI), w, 0.35, 2.6, 0)]; for (let i = 0; i < 5; i++) p.push(P(GT(0.15, 0.04, 6, 12), rd, 0, 0.3 + i * 0.5, 0, Math.PI / 2 + 0.3)); return { parts: p, r: 0.2 }; },
  snowman: o => { const w = matStd(0xf4f8ff, { r: 0.9 }); return { parts: [P(GS(0.9, 14, 10), w, 0, 0.8, 0), P(GS(0.65, 14, 10), w, 0, 1.95, 0), P(GS(0.45, 12, 10), w, 0, 2.8, 0), P(GK(0.08, 0.5, 6), matStd(0xff8a1a), 0, 2.8, 0.6, Math.PI / 2), P(GC(0.35, 0.35, 0.6, 10), matStd(0x1a1a1a), 0, 3.4, 0), P(GC(0.55, 0.55, 0.05, 12), matStd(0x1a1a1a), 0, 3.1, 0), P(GT(0.5, 0.1, 6, 14), matStd(0xc0392b), 0, 2.35, 0, Math.PI / 2)], r: 0.9 }; },
  lamppost: o => { const c = new THREE.Color(o.c || '#FFD27A').getHex(); return { parts: [P(GC(0.08, 0.12, 4, 6), matStd(0x1a1a20, { m: 0.8, r: 0.4 }), 0, 2, 0), P(GB(0.6, 0.08, 0.08), matStd(0x1a1a20, { m: 0.8 }), 0.25, 3.9, 0), P(GS(0.22, 10, 8), matGlow(c, 1, false), 0.5, 3.7, 0)], r: 0.25, glow: [[0.5, 3.7, 0, c, 2.5]] }; },
  house: o => { const wl = matStd(0x3a2a3a, { r: 0.9 }), rf = matStd(0x1a1020, { r: 0.8 }), win = matGlow(0xffaa33, 1, false); return { parts: [P(GB(5, 4, 4.5), wl, 0, 2, 0), P(GK(4, 2.6, 4), rf, 0, 5.3, 0, 0, Math.PI / 4, 0, 1.1, 1, 1), P(GB(0.9, 1.2, 0.1), win, -1.3, 2.6, 2.26), P(GB(0.9, 1.2, 0.1), win, 1.3, 2.6, 2.26), P(GB(1, 1.8, 0.1), matStd(0x1a0a0a), 0, 0.9, 2.26), P(GB(0.7, 1.8, 0.7), rf, 1.4, 5.6, -0.8)], r: 3.2 }; },
  fence: o => { const m = DARKWOOD(); return { parts: [P(GB(0.15, 1.3, 0.15), m, -1.2, 0.65, 0), P(GB(0.15, 1.3, 0.15), m, 1.2, 0.65, 0), P(GB(2.6, 0.12, 0.08), m, 0, 0.9, 0), P(GB(2.6, 0.12, 0.08), m, 0, 0.45, 0), P(GK(0.1, 0.2, 4), m, -1.2, 1.4, 0), P(GK(0.1, 0.2, 4), m, 1.2, 1.4, 0)], r: 0 }; },
  gravestone: o => { const c = o.c ? new THREE.Color(o.c).getHex() : 0x6a6a74; const m = matStd(c, { r: 0.95 }); return { parts: [P(GB(0.9, 1.2, 0.25), m, 0, 0.6, 0, rand(-0.1, 0.1), 0, rand(-0.1, 0.1)), P(GC(0.45, 0.45, 0.25, 12, false), m, 0, 1.2, 0, Math.PI / 2), P(GB(1.2, 0.15, 1.6), matStd(0x2a3a1a, { r: 1 }), 0, 0.05, 0.5)], r: 0.45 }; },
  cross: o => { const m = matStd(0x5a5a64, { r: 0.95 }); return { parts: [P(GB(0.22, 1.9, 0.22), m, 0, 0.95, 0), P(GB(1.0, 0.2, 0.2), m, 0, 1.4, 0)], r: 0.3 }; },
  mausoleum: o => { const m = matStd(0x4a4a54, { r: 0.9 }); return { parts: [P(GB(4.5, 3.5, 4), m, 0, 1.75, 0), P(GK(3.6, 1.6, 4), m, 0, 4.3, 0, 0, Math.PI / 4, 0, 1, 1, 0.8), P(GC(0.25, 0.25, 3.5, 8), m, -1.8, 1.75, 2.2), P(GC(0.25, 0.25, 3.5, 8), m, 1.8, 1.75, 2.2), P(GB(1.4, 2.2, 0.1), matGlow(0x7cff4d, 1, false), 0, 1.1, 2.02)], r: 2.8 }; },
  pumpkin: o => { const s = o.big ? rand(0.9, 1.8) : 1; const m = matStd(0xff7a00, { r: 0.65, e: 0x331000, ei: 0.4 }); const p = []; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; p.push(P(GS(0.45 * s, 10, 8), m, Math.cos(a) * 0.2 * s, 0.38 * s, Math.sin(a) * 0.2 * s, 0, 0, 0, 0.9, 0.8, 0.9)); } p.push(P(GC(0.05 * s, 0.07 * s, 0.25 * s, 5), matStd(0x2a6a1a), 0, 0.8 * s, 0)); p.push(P(GB(0.4 * s, 0.1 * s, 0.05), matGlow(0xffcc00, 1, false), 0, 0.32 * s, 0.6 * s)); p.push(P(GK(0.1 * s, 0.14 * s, 3), matGlow(0xffcc00, 1, false), -0.15 * s, 0.52 * s, 0.6 * s)); p.push(P(GK(0.1 * s, 0.14 * s, 3), matGlow(0xffcc00, 1, false), 0.15 * s, 0.52 * s, 0.6 * s)); return { parts: p, r: 0.55 * s }; },
  scarecrow: o => { const m = WOOD(); return { parts: [P(GC(0.08, 0.08, 3.2, 5), m, 0, 1.6, 0), P(GC(0.06, 0.06, 2.4, 5), m, 0, 2.3, 0, 0, 0, Math.PI / 2), P(GB(0.9, 1.0, 0.4), matStd(0x5a2a6a, { r: 0.9 }), 0, 2.1, 0), P(GS(0.4, 10, 8), matStd(0xff7a00, { r: 0.7 }), 0, 3.0, 0), P(GK(0.45, 0.6, 10), matStd(0x2a1a10), 0, 3.5, 0), P(GC(0.6, 0.6, 0.04, 12), matStd(0x2a1a10), 0, 3.25, 0), P(GB(0.3, 0.06, 0.05), matGlow(0xffcc00, 1, false), 0, 2.9, 0.38)], r: 0.4 }; },
  haybale: o => ({ parts: [P(GC(0.9, 0.9, 1.6, 12), matStd(0xd8b040, { r: 1 }), 0, 0.9, 0, 0, 0, Math.PI / 2)], r: 1 }),
  skyscraper: o => { const h = rand(14, 38), w = rand(4, 7), d = rand(4, 7), e = o.e || pick(['#ff3aa0', '#00f0ff', '#ffe600']); const wt = windowTex(e); const mat = new THREE.MeshStandardMaterial({ color: 0x0c0c16, roughness: 0.4, metalness: 0.6, emissive: 0xffffff, emissiveMap: wt, emissiveIntensity: 1.2 }); const g = new THREE.Group(); const b = new THREE.Mesh(GB(w, h, d), mat); b.position.y = h / 2; b.castShadow = true; b.receiveShadow = true; g.add(b); wt.repeat.set(1, 1); const ec = new THREE.Color(e).getHex(); [[w / 2, d / 2], [-w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2]].forEach(([x, z]) => { const s = new THREE.Mesh(GB(0.15, h, 0.15), matGlow(ec, 1, false)); s.position.set(x, h / 2, z); g.add(s); }); const top = new THREE.Mesh(GB(w * 0.6, 0.6, d * 0.6), matGlow(ec, 1, false)); top.position.y = h + 0.3; g.add(top); return { obj: g, r: Math.max(w, d) * 0.62, single: true }; },
  neonsign: o => ({ parts: [P(GC(0.08, 0.08, 4, 6), matStd(0x1a1a24, { m: 0.8 }), 0, 2, 0), P(GB(2.2, 1.2, 0.15), matGlow(0xffffff, 1, false), 0, 4.2, 0, 0, 0, 0, 1, 1, 1, [0xff2a9a, 0x00f0ff, 0xffe600, 0xa04dff, 0x00ff88]), P(GB(2.4, 1.4, 0.1), matStd(0x0a0a10), 0, 4.2, -0.1)], r: 0.3 }),
  torii: o => { const rd = matStd(0xd02020, { r: 0.6, e: 0x400000, ei: 0.4 }), dk = matStd(0x1a1a1a); return { parts: [P(GC(0.3, 0.35, 6, 10), rd, -3, 3, 0), P(GC(0.3, 0.35, 6, 10), rd, 3, 3, 0), P(GB(8.4, 0.5, 0.6), dk, 0, 6.2, 0), P(GB(7.4, 0.4, 0.5), rd, 0, 5.1, 0)], r: 0, cols: [[-3, 0, 0.5], [3, 0, 0.5]] }; },
  pillar: o => { const c = new THREE.Color(o.c || 0x6a6a74).getHex(); const m = o.gold ? matStd(0xffd060, { r: 0.25, m: 1, e: 0x553300, ei: 0.3 }) : matStd(c, { r: 0.8 }); const h = o.broken ? rand(1.5, 4) : 7; const p = [P(GB(1.6, 0.5, 1.6), m, 0, 0.25, 0), P(GC(0.55, 0.6, h, 12), m, 0, h / 2 + 0.4, 0)]; if (!o.broken) p.push(P(GB(1.5, 0.4, 1.5), m, 0, h + 0.5, 0)); return { parts: p, r: 0.8 }; },
  candelabra: o => { const g = matStd(0xb08a3a, { r: 0.3, m: 1 }); return { parts: [P(GC(0.06, 0.3, 2.2, 8), g, 0, 1.1, 0), P(GB(1.2, 0.08, 0.08), g, 0, 2.2, 0), P(GC(0.06, 0.06, 0.4, 6), matStd(0xf4f0e0), -0.55, 2.45, 0), P(GC(0.06, 0.06, 0.4, 6), matStd(0xf4f0e0), 0.55, 2.45, 0), P(GC(0.06, 0.06, 0.5, 6), matStd(0xf4f0e0), 0, 2.5, 0), P(GS(0.09, 6, 5), matGlow(0xffaa33, 1, false), -0.55, 2.75, 0), P(GS(0.09, 6, 5), matGlow(0xffaa33, 1, false), 0.55, 2.75, 0), P(GS(0.09, 6, 5), matGlow(0xffaa33, 1, false), 0, 2.85, 0)], r: 0.3 }; },
  coffin: o => ({ parts: [P(GB(1.0, 0.5, 2.3), matStd(0x2a1810, { r: 0.7 }), 0, 0.25, 0), P(GB(0.15, 0.04, 0.9), matStd(0xb08a3a, { m: 1 }), 0, 0.52, 0.2), P(GB(0.6, 0.04, 0.15), matStd(0xb08a3a, { m: 1 }), 0, 0.52, 0.4)], r: 0.9 }),
  crate: o => ({ parts: [P(GB(1.6, 1.6, 1.6), matStd(0x7a6a50, { r: 0.85 }), 0, 0.8, 0), P(GB(1.65, 0.15, 1.65), matStd(0x3a3428, { m: 0.6 }), 0, 1.5, 0), P(GB(1.65, 0.15, 1.65), matStd(0x3a3428, { m: 0.6 }), 0, 0.1, 0)], r: 1.0 }),
  pipe: o => { const m = matStd(0x5a6270, { r: 0.4, m: 0.8 }); return { parts: [P(GC(0.5, 0.5, 8, 12), m, 0, 2.6, 0, 0, 0, Math.PI / 2), P(GB(0.4, 2.6, 0.4), m, -3, 1.3, 0), P(GB(0.4, 2.6, 0.4), m, 3, 1.3, 0), P(GT(0.55, 0.08, 6, 14), matGlow(0x00c8ff, 1, false), 0, 2.6, 0, 0, Math.PI / 2, 0)], r: 0, cols: [[-3, 0, 0.4], [3, 0, 0.4]] }; },
  tower: o => { const m = matStd(0x4a5260, { r: 0.4, m: 0.8 }); return { parts: [P(GB(0.3, 6, 0.3), m, -1, 3, -1), P(GB(0.3, 6, 0.3), m, 1, 3, -1), P(GB(0.3, 6, 0.3), m, -1, 3, 1), P(GB(0.3, 6, 0.3), m, 1, 3, 1), P(GB(3, 1.4, 3), m, 0, 6.6, 0), P(GS(0.3, 8, 6), matGlow(0xff2a2a, 1, false), 0, 7.6, 0)], r: 1.6 }; },
  wall: o => { const m = matStd(0x3a4250, { r: 0.5, m: 0.7 }); return { parts: [P(GB(7, 3.2, 0.9), m, 0, 1.6, 0), P(GB(7.1, 0.2, 0.95), matGlow(0x00aaff, 1, false), 0, 2.9, 0)], r: 0, cols: [[-2.5, 0, 0.8], [0, 0, 0.8], [2.5, 0, 0.8]] }; },
  barrel: o => { const c = new THREE.Color(o.c || 0x8a3a2a).getHex(); const gl = o.glow ? new THREE.Color(o.glow).getHex() : null; const p = [P(GC(0.5, 0.5, 1.3, 12), matStd(c, { r: 0.5, m: 0.5 }), 0, 0.65, 0), P(GT(0.5, 0.04, 4, 14), matStd(0x2a2a2a, { m: 0.8 }), 0, 0.3, 0, Math.PI / 2), P(GT(0.5, 0.04, 4, 14), matStd(0x2a2a2a, { m: 0.8 }), 0, 1.0, 0, Math.PI / 2)]; if (gl) p.push(P(GC(0.42, 0.42, 0.06, 12), matGlow(gl, 1, false), 0, 1.32, 0)); return { parts: p, r: 0.55 }; },
  tank: o => { const gl = new THREE.Color(o.glow || 0x00e0ff).getHex(); return { parts: [P(GC(1.4, 1.4, 4.5, 16), matStd(0x5a6270, { r: 0.35, m: 0.8 }), 0, 2.25, 0), P(GB(0.4, 3.4, 0.1), matGlow(gl, 1, false), 0, 2.2, 1.4), P(GS(1.4, 14, 8), matStd(0x5a6270, { r: 0.35, m: 0.8 }), 0, 4.5, 0, 0, 0, 0, 1, 0.4, 1)], r: 1.5 }; },
  coil: o => ({ parts: [P(GC(0.3, 0.5, 3, 10), matStd(0x3a4250, { m: 0.8 }), 0, 1.5, 0), P(GT(0.5, 0.1, 6, 16), matStd(0xb87333, { m: 1, r: 0.3 }), 0, 1.4, 0, Math.PI / 2), P(GT(0.45, 0.1, 6, 16), matStd(0xb87333, { m: 1, r: 0.3 }), 0, 2.0, 0, Math.PI / 2), P(GT(0.4, 0.1, 6, 16), matStd(0xb87333, { m: 1, r: 0.3 }), 0, 2.6, 0, Math.PI / 2), P(GS(0.55, 14, 10), matGlow(0x7af8ff, 1, false), 0, 3.5, 0)], r: 0.7, single: true, anim: (g, t) => { if (Math.random() < 0.04) { _ep.set(0, 3.5, 0); g.localToWorld(_ep); const b = _ep.clone().add(V3(rand(-4, 4), rand(-3.4, -1), rand(-4, 4))); b.y = Math.max(0.1, b.y); FX.lightning(_ep, b, 0x7af8ff, 0.15); } } }),
  pyramid: o => ({ parts: [P(GK(12, 11, 4), matStd(0xd8b070, { r: 0.95, flat: true }), 0, 5.5, 0, 0, Math.PI / 4), P(GK(1.4, 1.3, 4), matStd(0xffd060, { r: 0.2, m: 1 }), 0, 10.4, 0, 0, Math.PI / 4)], r: 8 }),
  bones: o => { const m = matStd(0xe0d8c4, { r: 0.7 }); const p = [P(GS(0.35, 10, 8), m, 0.8, 0.3, 0)]; for (let i = 0; i < 4; i++) p.push(P(GT(0.5 - i * 0.04, 0.05, 4, 12, Math.PI), m, 0, 0.1, -0.4 + i * 0.3, 0, Math.PI / 2, 0)); return { parts: p, r: 0 }; },
  glitchcube: o => { const g = new THREE.Group(); const s = rand(0.8, 2.2); const b = new THREE.Mesh(GB(s, s, s), matStd(0x02100a, { r: 0.3, m: 0.6, e: 0x00ff88, ei: 0.08 })); g.add(b); const ed = new THREE.LineSegments(new THREE.EdgesGeometry(GB(s, s, s)), new THREE.LineBasicMaterial({ color: pick([0x00ff88, 0xff00ff, 0x00ffff]) })); g.add(ed); g.userData.s = s; return { obj: g, r: s * 0.6, single: true, y: [s / 2, s / 2 + 3], anim: (gg, t) => { if (Math.random() < 0.02) { gg.position.x += rand(-0.4, 0.4); gg.position.y = gg.userData.by + rand(-0.3, 0.3); } gg.rotation.y += 0.004; } }; },
  monolith: o => ({ parts: [P(GB(1.6, 7, 0.6), matStd(0x020604, { r: 0.2, m: 0.8 }), 0, 3.5, 0), P(GB(0.1, 6.4, 0.62), matGlow(0x00ff88, 1, false), -0.5, 3.5, 0), P(GB(0.1, 4.4, 0.62), matGlow(0x00ff88, 1, false), 0.3, 2.6, 0), P(GB(1.62, 0.1, 0.62), matGlow(0xff00ff, 1, false), 0, 5.8, 0)], r: 0.9 }),
  datatree: o => { const gm = matGlow(0x00ff88, 1, false); const p = [P(GC(0.1, 0.18, 4, 6), matStd(0x0a1a12, { m: 0.6 }), 0, 2, 0), P(GB(0.05, 4, 0.05), gm, 0.12, 2, 0)]; for (let i = 0; i < 7; i++) p.push(P(GB(0.6, 0.6, 0.6), i % 3 ? matStd(0x02100a, { e: 0x00ff88, ei: 0.4 }) : gm, rand(-1.2, 1.2), rand(3.5, 5.5), rand(-1.2, 1.2), rand(0, 1), rand(0, 1), 0)); return { parts: p, r: 0.4 }; },
  cloud: o => { const m = matStd(0xffffff, { r: 1, e: 0xffe8c0, ei: 0.25 }); const p = []; for (let i = 0; i < 5; i++) p.push(P(GS(rand(0.8, 1.6), 10, 8), m, rand(-1.5, 1.5), rand(0.1, 0.6), rand(-1.5, 1.5))); return { parts: p, r: 0 }; },
  brazier: o => { const tk = o.tiki, big = o.big; const h = tk ? 2.6 : big ? 1.6 : 1.1; const p = [P(GC(tk ? 0.08 : 0.15, tk ? 0.1 : 0.3, h, 6), tk ? matStd(0x8a6a3a) : matStd(0xc8a040, { m: 1, r: 0.3 }), 0, h / 2, 0), P(GC(big ? 1.2 : 0.55, big ? 0.6 : 0.3, 0.4, 10), matStd(0x3a2a1a, { m: 0.6 }), 0, h + 0.2, 0)]; return { parts: p, r: big ? 1.0 : 0.4, single: true, anim: (g, t) => { if (Math.random() < (big ? 0.9 : 0.5) * R.partMul) { _ep.set(rand(-0.3, 0.3) * (big ? 2 : 1), h + 0.4, rand(-0.3, 0.3) * (big ? 2 : 1)); g.localToWorld(_ep); FX.c.set(Math.random() < 0.5 ? 0xff6a00 : 0xffcc33); PG.spawn(_ep.x, _ep.y, _ep.z, rand(-0.3, 0.3), rand(1.5, 3), rand(-0.3, 0.3), FX.c, 1, big ? 0.7 : 0.4, 0.6, -1, 1, -0.5); } } }; },
  tentacle: o => { const m = matStd(0x2a0a3a, { r: 0.5, e: 0x4a0066, ei: 0.4 }); const g = new THREE.Group(); const segs = []; let par = g; for (let i = 0; i < 7; i++) { const s = new THREE.Group(); s.position.y = i ? 0.8 : 0; par.add(s); const mm = new THREE.Mesh(GS(0.5 - i * 0.06, 8, 6), m); mm.castShadow = true; s.add(mm); segs.push(s); par = s; } return { obj: g, r: 0.5, single: true, anim: (gg, t) => segs.forEach((s, i) => { s.rotation.z = Math.sin(t * 1.5 + i * 0.6 + gg.userData.ph) * 0.25; s.rotation.x = Math.cos(t * 1.2 + i * 0.5 + gg.userData.ph) * 0.15; }) }; },
  eyestalk: o => { const g = new THREE.Group(); const st = new THREE.Mesh(GC(0.12, 0.25, 3, 6), matStd(0x2a0a3a, { r: 0.6 })); st.position.y = 1.5; g.add(st); const e = new THREE.Group(); e.position.y = 3.3; g.add(e); e.add(new THREE.Mesh(GS(0.5, 14, 10), matStd(0xf0e8e0, { r: 0.3 }))); const ir = new THREE.Mesh(GS(0.25, 10, 8), matGlow(0xff00ff, 1, false)); ir.position.z = 0.35; ir.scale.z = 0.5; e.add(ir); return { obj: g, r: 0.4, single: true, anim: (gg, t) => { if (G.playing) { _v4.copy(PL.pos); _v4.y = 1.5; e.lookAt(_v4); } } }; },
  portalring: o => { const g = new THREE.Group(); const r = new THREE.Mesh(GT(2, 0.18, 8, 40), matGlow(pick([0xff00ff, 0x00ffff]), 1, false)); r.position.y = 3; g.add(r); const d = new THREE.Mesh(new THREE.CircleGeometry(1.85, 32), matGlow(0x3a0060, 0.6, true)); d.position.y = 3; g.add(d); return { obj: g, r: 0, single: true, anim: (gg, t) => { gg.rotation.y = t * 0.5 + gg.userData.ph; } }; },
  clam: o => ({ parts: [P(GS(1.2, 14, 8), matStd(0xc8a0d8, { r: 0.4, m: 0.3 }), 0, 0.3, 0, 0, 0, 0, 1, 0.35, 1), P(GS(1.2, 14, 8), matStd(0xd8b0e8, { r: 0.4, m: 0.3 }), 0, 0.9, -0.5, -0.6, 0, 0, 1, 0.35, 1), P(GS(0.35, 12, 10), matGlow(0xffffff, 1, false), 0, 0.6, 0.1)], r: 1.2 }),
  cabin: o => { const lg = matStd(0x6a4a2a, { r: 0.9 }); const p = []; for (let i = 0; i < 6; i++) p.push(P(GC(0.25, 0.25, 5, 8), lg, 0, 0.25 + i * 0.5, 0, 0, 0, Math.PI / 2, 1, 1, 0.9)); p.push(P(GB(4.8, 3, 3.6), lg, 0, 1.5, 0)); p.push(P(GK(3.5, 2, 4), matStd(0xf4f8ff, { r: 0.9 }), 0, 4, 0, 0, Math.PI / 4)); p.push(P(GB(0.8, 1, 0.1), matGlow(0xffaa33, 1, false), 1.2, 1.7, 1.82)); return { parts: p, r: 2.6 }; },
  hut: o => ({ parts: [P(GC(2, 2, 2.4, 12), matStd(0xc8a060, { r: 1 }), 0, 1.2, 0), P(GK(2.8, 2.4, 12), matStd(0xa88040, { r: 1 }), 0, 3.6, 0), P(GB(1, 1.6, 0.1), matStd(0x2a1a10), 0, 0.8, 2)], r: 2.1 }),
  flag: o => ({ parts: [P(GC(0.05, 0.05, 4.5, 5), matStd(0xc0c0c0, { m: 0.8 }), 0, 2.25, 0), P(GB(1.4, 0.8, 0.03), matStd(0xffffff, { r: 0.8 }), 0.72, 4, 0, 0, 0, 0, 1, 1, 1, [0xd02020, 0x2060ff, 0xffd000, 0x20c040])], r: 0.15 }),
  lilypad: o => ({ parts: [P(GC(0.7, 0.7, 0.05, 12), matStd(0x3a8a3a, { r: 0.6 }), 0, 0.06, 0), P(GS(0.12, 6, 5), matStd(0xff8ad8, { e: 0xff4aa0, ei: 0.3 }), 0.2, 0.15, 0.1)], r: 0 }),
  antenna: o => ({ parts: [P(GC(0.1, 0.3, 12, 4), matStd(0x5a5a6a, { m: 0.8 }), 0, 6, 0), P(GS(0.3, 8, 6), matGlow(0xff2a2a, 1, false), 0, 12.2, 0)], r: 0.4 }),
  billboard: o => ({ parts: [P(GB(0.3, 5, 0.3), matStd(0x2a2a34, { m: 0.8 }), -2, 2.5, 0), P(GB(0.3, 5, 0.3), matStd(0x2a2a34, { m: 0.8 }), 2, 2.5, 0), P(GB(6, 3, 0.2), matGlow(0xffffff, 1, false), 0, 6, 0, 0, 0, 0, 1, 1, 1, [0xff00aa, 0x00f0ff, 0x8a00ff, 0xffe600])], r: 0, cols: [[-2, 0, 0.4], [2, 0, 0.4]] })
};

const _icMats = {};
function addInstancedProps(type, n, o, group, rng) {
  if (!PROPS[type]) return;
  const tpl = PROPS[type](o || {});
  const placed = [];
  for (let i = 0; i < n; i++) {
    let x, z, tries = 0, ok = false;
    const minR = tpl.r > 3 ? 18 : 7;
    while (tries++ < 30) {
      const a = rng() * TAU, d = minR + Math.sqrt(rng()) * (ARENA - 2 - minR); x = Math.cos(a) * d; z = Math.sin(a) * d;
      ok = W.colliders.every(c => Math.hypot(c.x - x, c.z - z) > c.r + tpl.r + 1.5);
      if (ok) break;
    }
    if (!ok) continue;
    const s = tpl.r > 3 ? rand(0.85, 1.1) : rand(0.75, 1.3), ry = rng() * TAU;
    placed.push({ x, z, s, ry });
    if (tpl.r > 0) W.colliders.push({ x, z, r: tpl.r * s });
    if (tpl.cols) tpl.cols.forEach(([cx, , cr]) => { const c = Math.cos(ry), sn = Math.sin(ry); W.colliders.push({ x: x + cx * c * s, z: z - cx * sn * s, r: cr * s }); });
  }
  if (!placed.length) return;
  if (tpl.single || tpl.obj) {
    placed.forEach(pl => {
      const t2 = tpl.obj ? PROPS[type](o || {}) : tpl;
      let g = t2.obj;
      if (!g) { g = new THREE.Group(); t2.parts.forEach(pt => { const m = new THREE.Mesh(pt.geo, pt.mat); m.applyMatrix4(pt.m); m.castShadow = true; m.receiveShadow = true; g.add(m); }); }
      const y = t2.y ? rand(t2.y[0], t2.y[1]) : 0;
      g.position.set(pl.x, y, pl.z); g.rotation.y = pl.ry; g.scale.setScalar(pl.s); g.userData.by = y; g.userData.ph = rand(0, 10);
      group.add(g); if (t2.anim) W.anims.push([g, t2.anim]);
    });
    return;
  }
  tpl.parts.forEach(pt => {
    // r128 caches the shader per material and does not notice instanceColor changing, so tinted
    // instanced parts must never share a material with untinted ones.
    const mk = pt.mat.uuid + (pt.colors ? 'c' : 'i');
    const mat = _icMats[mk] || (_icMats[mk] = pt.mat.clone());
    const im = new THREE.InstancedMesh(pt.geo, mat, placed.length);
    im.castShadow = true; im.receiveShadow = true;
    placed.forEach((pl, i) => {
      _pm.compose(_pp.set(pl.x, 0, pl.z), _pq.setFromEuler(_pe.set(0, pl.ry, 0)), _ps.set(pl.s, pl.s, pl.s)).multiply(pt.m);
      im.setMatrixAt(i, _pm);
      if (pt.colors) im.setColorAt(i, _c1.set(pick(pt.colors)));
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    group.add(im);
  });
  if (tpl.glow) placed.forEach(pl => tpl.glow.forEach(([gx, gy, gz, c, s]) => { const sp = glowSprite(c, s * pl.s, 0.6); const cs = Math.cos(pl.ry), sn = Math.sin(pl.ry); sp.position.set(pl.x + (gx * cs) * pl.s, gy * pl.s, pl.z - gx * sn * pl.s); group.add(sp); }));
}

function buildFar(type, col, group) {
  const c = new THREE.Color(col).getHex();
  const ring = (n, r0, r1, geoF, matF, sF, yF) => {
    const geo = geoF(), mat = matF(), im = new THREE.InstancedMesh(geo, mat, n);
    for (let i = 0; i < n; i++) { const a = i / n * TAU + rand(-0.05, 0.05), r = rand(r0, r1); const s = sF(); _pm.compose(_pp.set(Math.cos(a) * r, yF ? yF(s) : 0, Math.sin(a) * r), _pq.setFromEuler(_pe.set(0, rand(0, TAU), 0)), s); im.setMatrixAt(i, _pm); }
    im.instanceMatrix.needsUpdate = true; group.add(im); return im;
  };
  const m = (o = {}) => () => matStd(c, Object.assign({ r: 0.95, flat: true }, o));
  switch (type) {
    case 'mountains': ring(46, 85, 150, () => new THREE.ConeGeometry(1, 1, 6), m(), () => { const h = rand(18, 50); return V3(rand(14, 30), h, rand(14, 30)); }, s => s.y / 2 - 1); break;
    case 'icebergs': ring(40, 85, 150, () => new THREE.ConeGeometry(1, 1, 5), m({ r: 0.2, m: 0.3, e: 0x3a7ac8, ei: 0.3 }), () => V3(rand(8, 20), rand(15, 40), rand(8, 20)), s => s.y / 2 - 1); break;
    case 'jungle': ring(60, 75, 140, () => new THREE.IcosahedronGeometry(1, 1), m(), () => { const s = rand(8, 16); return V3(s, s * rand(1, 1.6), s); }, s => s.y * 0.6); break;
    case 'city': { const g2 = new THREE.BoxGeometry(1, 1, 1); g2.translate(0, 0.5, 0); const wt = windowTex(col); const mat = new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.5, metalness: 0.5, emissive: 0xffffff, emissiveMap: wt, emissiveIntensity: 1 }); const im = new THREE.InstancedMesh(g2, mat, 70); for (let i = 0; i < 70; i++) { const a = i / 70 * TAU, r = rand(78, 140); _pm.compose(_pp.set(Math.cos(a) * r, 0, Math.sin(a) * r), _pq.setFromEuler(_pe.set(0, -a, 0)), _ps.set(rand(8, 16), rand(20, 70), rand(8, 16))); im.setMatrixAt(i, _pm); } im.instanceMatrix.needsUpdate = true; group.add(im); break; }
    case 'dunes': ring(50, 80, 150, () => new THREE.SphereGeometry(1, 12, 8), m({ flat: false }), () => V3(rand(20, 40), rand(6, 14), rand(14, 26)), s => -1); break;
    case 'spires': ring(60, 75, 140, () => new THREE.ConeGeometry(1, 1, 5), m({ r: 0.6, m: 0.4 }), () => V3(rand(2, 5), rand(18, 45), rand(2, 5)), s => s.y / 2 - 1); break;
    case 'clouds': ring(60, 70, 140, () => new THREE.SphereGeometry(1, 12, 8), () => matStd(0xffffff, { r: 1, e: 0xffe0a0, ei: 0.35 }), () => { const s = rand(8, 18); return V3(s * 1.6, s * 0.6, s); }, s => rand(-2, 6)); break;
    case 'void': ring(50, 70, 140, () => new THREE.DodecahedronGeometry(1), m({ r: 0.8 }), () => { const s = rand(3, 10); return V3(s, s, s); }, s => rand(5, 45)); break;
    case 'cliffs': ring(40, 75, 130, () => new THREE.BoxGeometry(1, 1, 1), m(), () => V3(rand(14, 28), rand(20, 50), rand(10, 20)), s => s.y / 2 - 2); break;
    case 'ocean': { const w = new THREE.Mesh(new THREE.RingGeometry(ARENA + 4, 300, 64), new THREE.MeshStandardMaterial({ color: 0x1a90c8, roughness: 0.1, metalness: 0.4, emissive: 0x0a3a6a, emissiveIntensity: 0.4 })); w.rotation.x = -Math.PI / 2; w.position.y = 0.05; group.add(w); W.water = w; ring(14, 120, 180, () => new THREE.ConeGeometry(1, 1, 6), () => matStd(0x2a7a3a, { r: 1, flat: true }), () => V3(rand(14, 26), rand(6, 14), rand(14, 26)), s => s.y / 2 - 1); break; }
  }
}

function addHazards(type, n, group) {
  const cfg = { lava: [0xff5a00, 0xff8a00, true], toxic: [0x7cff00, 0x3a8a00, true], water: [0x1a6aaa, 0x3a9ae0, false], ice: [0xc8f0ff, 0x8ac8ff, false] }[type];
  if (!cfg) return;
  for (let i = 0; i < n; i++) {
    let x, z, r = rand(3, 6.5), tries = 0;
    do { const a = rand(0, TAU), d = rand(12, ARENA - 6); x = Math.cos(a) * d; z = Math.sin(a) * d; } while (tries++ < 20 && W.hazards.some(h => Math.hypot(h.x - x, h.z - z) < h.r + r + 2));
    const mat = cfg[2] ? new THREE.MeshBasicMaterial({ color: cfg[0], fog: true }) : new THREE.MeshStandardMaterial({ color: cfg[0], roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.8, emissive: cfg[1], emissiveIntensity: 0.25 });
    mat.userData.own = true;
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.04 + i * 0.002, z); m.receiveShadow = !cfg[2];
    group.add(m);
    if (cfg[2]) { const rim = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.6, 28), matStd(0x1a1210, { r: 1 })); rim.rotation.x = -Math.PI / 2; rim.position.set(x, 0.035, z); group.add(rim); }
    W.hazards.push({ type, x, z, r, mesh: m, col: cfg[1] });
  }
}

// ---------------- ambient weather particles ----------------
const AMB = {
  snow: { n: 700, col: [0xffffff], size: 0.2, vy: [-1.6, -0.8], drift: 0.6, add: false, a: 0.9 },
  blizzard: { n: 1100, col: [0xffffff], size: 0.17, vy: [-3, -1.5], wind: [9, 2], add: false, a: 0.85 },
  fireflies: { n: 180, col: [0xd0ff60, 0xffee88], size: 0.3, vy: [-0.2, 0.2], drift: 0.8, blink: 1, add: true, ymax: 7, a: 1 },
  rain: { n: 1100, col: [0x9ab0ff], size: 0.09, vy: [-24, -18], add: true, a: 0.6 },
  embers: { n: 450, col: [0xff6a00, 0xffaa00], size: 0.2, vy: [0.8, 2.6], drift: 0.8, add: true, blink: 0.5, a: 1 },
  spores: { n: 320, col: [0xb08aff, 0x8affaa], size: 0.15, vy: [-0.3, 0.3], drift: 0.5, add: true, a: 0.8 },
  stars: { n: 380, col: [0xffffff, 0xff7af2, 0x7af8ff], size: 0.16, vy: [-0.1, 0.1], drift: 0.2, add: true, blink: 1, a: 1 },
  glitch: { n: 320, col: [0x00ff88, 0xff00ff], size: 0.28, vy: [-0.2, 0.2], jitter: 1, add: true, a: 1 },
  sand: { n: 700, col: [0xe8c890, 0xd8b070], size: 0.13, vy: [-0.3, 0.3], wind: [11, 0], add: false, a: 0.65 },
  bubbles: { n: 320, col: [0xc8ffff], size: 0.22, vy: [1, 2.5], drift: 0.4, add: true, a: 0.6 },
  sparkle: { n: 280, col: [0xffffff, 0xc0a0ff, 0x7af8ff], size: 0.13, vy: [-0.1, 0.3], blink: 1, add: true, a: 1 },
  sparks: { n: 220, col: [0xffcc33, 0x7af8ff], size: 0.11, vy: [-7, -3], add: true, a: 1 },
  petals: { n: 320, col: [0xff6a8a, 0xaa0022], size: 0.2, vy: [-1, -0.5], drift: 1, add: false, a: 0.9 },
  leaves: { n: 320, col: [0xff7a00, 0xaa4a00, 0xffaa00], size: 0.22, vy: [-1.2, -0.6], drift: 1.2, add: false, a: 0.95 }
};
function buildAmbient(type, group) {
  const A = AMB[type]; if (!A) { W.ambP = null; return; }
  const n = Math.floor(A.n * R.partMul), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), ph = new Float32Array(n), vel = new Float32Array(n * 3);
  const ymax = A.ymax || 26;
  for (let i = 0; i < n; i++) {
    pos[i * 3] = rand(-40, 40); pos[i * 3 + 1] = rand(0, ymax); pos[i * 3 + 2] = rand(-40, 40);
    _c1.set(pick(A.col)); col[i * 3] = _c1.r; col[i * 3 + 1] = _c1.g; col[i * 3 + 2] = _c1.b; ph[i] = rand(0, 10);
    vel[i * 3] = (A.wind ? A.wind[0] : 0) + rand(-1, 1) * (A.drift || 0.1); vel[i * 3 + 1] = rand(A.vy[0], A.vy[1]); vel[i * 3 + 2] = (A.wind ? A.wind[1] : 0) + rand(-1, 1) * (A.drift || 0.1);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { size: { value: A.size }, scale: { value: PG.mat.uniforms.uScale.value }, time: { value: 0 }, blink: { value: A.blink || 0 }, op: { value: A.a } },
    transparent: true, depthWrite: false, blending: A.add ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: 'attribute vec3 color;attribute float ph;uniform float size,scale,time,blink;varying vec3 vC;varying float vA;void main(){vC=color;vA=1.-blink*(.5+.5*sin(time*3.+ph*7.));vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=min(64.,size*scale/max(.3,-mv.z));gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform float op;varying vec3 vC;varying float vA;void main(){float r=length(gl_PointCoord-.5)*2.;float a=1.-smoothstep(.3,1.,r);if(a<.02)discard;gl_FragColor=vec4(vC,a*op*vA);}'
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; group.add(pts);
  W.ambP = { pts, pos, vel, n, A, ymax, attr: g.attributes.position };
}
function updateAmbient(dt, t) {
  const a = W.ambP; if (!a) return;
  const cx = R.camera.position.x, cz = R.camera.position.z, p = a.pos, v = a.vel, A = a.A;
  a.pts.material.uniforms.time.value = t;
  for (let i = 0; i < a.n; i++) {
    const k = i * 3;
    if (A.jitter) { if (Math.random() < 0.02) { p[k] = cx + rand(-40, 40); p[k + 1] = rand(0, a.ymax); p[k + 2] = cz + rand(-40, 40); } continue; }
    p[k] += (v[k] + (A.drift ? Math.sin(t + i) * A.drift * 0.5 : 0)) * dt; p[k + 1] += v[k + 1] * dt; p[k + 2] += v[k + 2] * dt;
    if (p[k + 1] < 0) p[k + 1] += a.ymax; else if (p[k + 1] > a.ymax) p[k + 1] -= a.ymax;
    if (p[k] < cx - 40) p[k] += 80; else if (p[k] > cx + 40) p[k] -= 80;
    if (p[k + 2] < cz - 40) p[k + 2] += 80; else if (p[k + 2] > cz + 40) p[k + 2] -= 80;
  }
  a.attr.needsUpdate = true;
}

// ---------------- build / clear ----------------
function clearBiome() {
  if (W.group) {
    W.scene.remove(W.group);
    W.group.traverse(o => { if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); if (o.material && o.material.userData && o.material.userData.own) o.material.dispose(); });
  }
  W.group = null; W.colliders = []; W.hazards = []; W.anims = []; W.ambP = null; W.water = null;
}
function buildBiome(bi, realm) {
  clearBiome();
  const b = BIOMES[bi]; W.biome = b; W.mods = Object.assign({ fric: 1, grav: 1 }, b.mods || {});
  const grp2 = new THREE.Group(); W.group = grp2; W.scene.add(grp2);
  setSky(W.sky, b);
  W.scene.fog.color.set(b.fog[0]); W.scene.fog.density = b.fog[1];
  W.hemi.color.set(b.hemi[0]); W.hemi.groundColor.set(b.hemi[1]); W.hemi.intensity = b.hemi[2];
  W.sun.color.set(b.sun[0]); W.sun.intensity = b.sun[1]; W.sunDir = V3(...b.sun[2]).normalize(); if (W.sunDir.y < 0.35) { W.sunDir.y = 0.35; W.sunDir.normalize(); }
  W.amb.color.set(b.hemi[0]); W.amb.intensity = 0.1;
  const tex = paintGround(b.ground, hashStr(b.id) + realm);
  const lum = new THREE.Color(b.ground.c[0]); const bright = 0.299 * lum.r + 0.587 * lum.g + 0.114 * lum.b;
  const gm = new THREE.MeshStandardMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(bright > 0.6 ? 0.62 : 1), map: tex.map, roughness: b.ground.rough ?? 0.8, metalness: b.ground.metal ?? 0.05 });
  if (tex.emap) { gm.emissive = new THREE.Color(0xffffff); gm.emissiveMap = tex.emap; gm.emissiveIntensity = b.ground.ei ?? 1; }
  gm.userData.own = true;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), gm); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; grp2.add(ground); W.ground = ground;
  // arena edge glow ring
  const edge = new THREE.Mesh(new THREE.RingGeometry(ARENA + 0.6, ARENA + 1.2, 96), matGlow(new THREE.Color(b.skin.e).getHex(), 0.35, true)); edge.rotation.x = -Math.PI / 2; edge.position.y = 0.06; grp2.add(edge);
  if (b.haz) addHazards(b.haz[0], b.haz[1], grp2);
  const rng = mulberry32(hashStr(b.id) * 7 + realm);
  b.props.forEach(([type, n, o]) => addInstancedProps(type, n, o, grp2, rng));
  buildFar(b.far[0], b.far[1], grp2);
  buildAmbient(b.part, grp2);
}
function updateWorld(dt, t) {
  W.sky.material.uniforms.time.value = t;
  W.sky.position.copy(R.camera.position);
  for (const [g, f] of W.anims) f(g, t);
  for (const h of W.hazards) if (h.type === 'lava' || h.type === 'toxic') { if (Math.random() < 0.08 * R.partMul) { const a = rand(0, TAU), d = rand(0, h.r); FX.c.set(h.col); PG.spawn(h.x + Math.cos(a) * d, 0.1, h.z + Math.sin(a) * d, 0, rand(1, 3), 0, FX.c, 1, rand(0.2, 0.5), rand(0.5, 1.2), h.type === 'lava' ? -0.5 : 0, 0.5, 0); } }
  if (W.water) W.water.material.emissiveIntensity = 0.35 + Math.sin(t) * 0.1;
  updateAmbient(dt, t);
  // sun follows player for crisp shadows
  W.sun.position.set(PL.pos.x + W.sunDir.x * 60, W.sunDir.y * 60, PL.pos.z + W.sunDir.z * 60);
  W.sun.target.position.set(PL.pos.x, 0, PL.pos.z); W.sun.target.updateMatrixWorld();
}
function collide(p, r) {
  for (const c of W.colliders) {
    const dx = p.x - c.x, dz = p.z - c.z, d2 = dx * dx + dz * dz, rr = r + c.r;
    if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), k = (rr - d) / d; p.x += dx * k; p.z += dz * k; }
  }
  const d = Math.hypot(p.x, p.z); if (d > ARENA) { p.x *= ARENA / d; p.z *= ARENA / d; }
}
function hazardAt(x, z) { for (const h of W.hazards) if ((x - h.x) ** 2 + (z - h.z) ** 2 < h.r * h.r) return h; return null; }
