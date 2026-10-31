// =====================================================================
//  MODELS — shared geometry helpers + player characters + guns
// =====================================================================
const _geo = {};
function kg(key, make) { let g = _geo[key]; if (!g) { g = make(); g.userData.keep = true; _geo[key] = g; } return g; }
const GB = (w, h, d) => kg(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const GS = (r, a = 14, b = 10) => kg(`s${r},${a},${b}`, () => new THREE.SphereGeometry(r, a, b));
const GC = (rt, rb, h, s = 10, open = false) => kg(`c${rt},${rb},${h},${s},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, s, 1, open));
const GK = (r, h, s = 8) => kg(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const GT = (r, t, rs = 8, ts = 24, arc = TAU) => kg(`t${r},${t},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));
const GO = (r, d = 0) => kg(`o${r},${d}`, () => new THREE.OctahedronGeometry(r, d));
const GD = (r, d = 0) => kg(`d${r},${d}`, () => new THREE.DodecahedronGeometry(r, d));
const GI = (r, d = 0) => kg(`i${r},${d}`, () => new THREE.IcosahedronGeometry(r, d));
const GP = (w, h) => kg(`p${w},${h}`, () => new THREE.PlaneGeometry(w, h));
function mesh(geo, mat, x = 0, y = 0, z = 0, parent, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true; if (parent) parent.add(m); return m;
}
function grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); if (parent) parent.add(g); return g; }
function ownMat(col, o = {}) {
  const m = new THREE.MeshStandardMaterial({ color: col, roughness: o.r ?? 0.5, metalness: o.m ?? 0.2, flatShading: !!o.flat });
  if (o.e !== undefined) { m.emissive = new THREE.Color(o.e); m.emissiveIntensity = o.ei ?? 0.5; }
  if (o.op !== undefined) { m.transparent = true; m.opacity = o.op; m.depthWrite = o.op > 0.7; }
  if (o.side) m.side = THREE.DoubleSide;
  m.userData.own = true; return m;
}
function ownGlow(col, op = 1) { const m = new THREE.MeshBasicMaterial({ color: col, transparent: op < 1, opacity: op, fog: false }); m.userData.own = true; return m; }
function ownAdd(col, op = 0.8) { const m = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }); m.userData.own = true; return m; }

// ---------------- guns ----------------
function buildGun(id) {
  const g = new THREE.Group(), W = WEAPONS.find(w => w.id === id);
  const dark = matStd(0x1a1d26, { r: 0.35, m: 0.8 }), mid = matStd(0x3a4050, { r: 0.4, m: 0.7 }), glow = matGlow(W.col, 1, false);
  if (id === 'ar') { mesh(GB(0.12, 0.16, 0.8), dark, 0, 0, 0.2, g); mesh(GB(0.07, 0.07, 0.45), mid, 0, 0.02, 0.75, g); mesh(GB(0.1, 0.22, 0.12), dark, 0, -0.16, 0.1, g); mesh(GB(0.13, 0.04, 0.5), glow, 0, 0.1, 0.2, g); mesh(GB(0.1, 0.12, 0.3), mid, 0, -0.02, -0.28, g); }
  else if (id === 'shotgun') { mesh(GC(0.06, 0.06, 0.95, 8), dark, 0.04, 0.03, 0.45, g, Math.PI / 2); mesh(GC(0.06, 0.06, 0.95, 8), dark, -0.04, 0.03, 0.45, g, Math.PI / 2); mesh(GB(0.16, 0.16, 0.4), mid, 0, -0.04, 0, g); mesh(GB(0.17, 0.05, 0.3), glow, 0, 0.07, 0.35, g); mesh(GB(0.1, 0.14, 0.35), matStd(0x6a3a1a, { r: 0.7 }), 0, -0.06, -0.3, g); }
  else if (id === 'sniper') { mesh(GB(0.1, 0.13, 0.9), dark, 0, 0, 0.2, g); mesh(GC(0.035, 0.035, 0.9, 8), mid, 0, 0.02, 1.05, g, Math.PI / 2); mesh(GC(0.06, 0.06, 0.4, 10), dark, 0, 0.16, 0.25, g, Math.PI / 2); mesh(GC(0.062, 0.062, 0.02, 10), glow, 0, 0.16, 0.46, g, Math.PI / 2); mesh(GB(0.11, 0.03, 0.6), glow, 0, -0.07, 0.2, g); mesh(GB(0.09, 0.14, 0.35), mid, 0, -0.04, -0.4, g); }
  else if (id === 'smg') { mesh(GB(0.12, 0.16, 0.5), dark, 0, 0, 0.12, g); mesh(GB(0.06, 0.06, 0.25), mid, 0, 0.02, 0.48, g); mesh(GB(0.08, 0.3, 0.1), dark, 0, -0.2, 0.2, g); mesh(GB(0.13, 0.04, 0.42), glow, 0, 0.09, 0.12, g); }
  else if (id === 'rocket') { mesh(GC(0.16, 0.16, 1.3, 12), mid, 0, 0.1, 0.25, g, Math.PI / 2); mesh(GC(0.2, 0.16, 0.12, 12), dark, 0, 0.1, 0.92, g, Math.PI / 2); mesh(GT(0.165, 0.025, 6, 16), glow, 0, 0.1, 0.6, g); mesh(GB(0.08, 0.2, 0.1), dark, 0, -0.12, 0.1, g); mesh(GB(0.08, 0.06, 0.2), glow, 0, 0.3, 0.4, g); }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, id === 'rocket' ? 0.1 : 0.03, id === 'sniper' ? 1.5 : id === 'rocket' ? 1.0 : id === 'shotgun' ? 0.95 : 0.98); g.add(muzzle);
  g.userData.muzzle = muzzle;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------------- characters ----------------
function buildCharacter(C, mut) {
  const P = new THREE.Color(C.col[0]), Sc = new THREE.Color(C.col[1]), Gc = new THREE.Color(C.col[2]);
  let mo = { r: 0.42, m: 0.3 };
  if (mut === 'golden') { P.lerp(new THREE.Color(0xffd700), 0.75); Sc.lerp(new THREE.Color(0xb8860b), 0.6); mo = { r: 0.18, m: 1 }; }
  if (mut === 'void') { P.lerp(new THREE.Color(0x10001a), 0.75); Sc.lerp(new THREE.Color(0x30005a), 0.6); Gc.set(0xc07cff); }
  if (mut === 'shiny') { mo = { r: 0.15, m: 0.65 }; }
  const mp = ownMat(P, { ...mo, e: P, ei: mut === 'void' ? 0.15 : 0.07 });
  const ms = ownMat(Sc, { r: 0.55, m: mo.m * 0.6 });
  const mg = ownGlow(Gc);
  const mdk = ownMat(0x16161f, { r: 0.4, m: 0.6 });
  const mw = ownMat(0xf4f4f4, { r: 0.6, m: 0 });
  const mgold = ownMat(0xffcc33, { r: 0.25, m: 1, e: 0x553300, ei: 0.4 });
  const mx = { p: mp, s: ms, g: mg, d: mdk, w: mw, gold: mgold, add: ownAdd(Gc, 0.55) };
  const root = new THREE.Group(), body = grp(root);
  const pt = { root, body, legL: null, legR: null, armL: null, armR: null, torso: null, head: null, hand: null, anims: [], emit: [], walk: 0, hover: 0, wings: [] };
  let headY = 2.05, hs = 1, chestZ = 0.23, backZ = -0.25, shY = 1.75, shX = 0.52, neckR = 0.18;
  const mkLeg = (x, y, w, h, d, mat, boot) => { const L = grp(body, x, y, 0); mesh(GB(w, h, d), mat, 0, -h / 2, 0, L); if (boot) mesh(GB(w * 1.15, 0.18, d * 1.35), boot, 0, -h + 0.05, 0.05, L); return L; };
  const mkArm = (x, y, w, h, mat, handMat, sph) => { const A = grp(body, x, y, 0); if (sph) mesh(GC(w / 2, w / 2.3, h, 8), mat, 0, -h / 2, 0, A); else mesh(GB(w, h, w), mat, 0, -h / 2, 0, A); mesh(GS(w * 0.62, 10, 8), handMat, 0, -h - 0.02, 0, A); const hand = grp(A, 0, -h - 0.02, 0.02); A.userData.hand = hand; return A; };
  const b = C.body;
  if (b === 'hero') {
    pt.legL = mkLeg(-0.2, 0.95, 0.27, 0.9, 0.3, ms, mdk); pt.legR = mkLeg(0.2, 0.95, 0.27, 0.9, 0.3, ms, mdk);
    pt.torso = mesh(GB(0.78, 0.85, 0.45), mp, 0, 1.42, 0, body); mesh(GB(0.82, 0.12, 0.48), ms, 0, 1.02, 0, body); mesh(GB(0.16, 0.16, 0.05), mg, 0, 1.55, 0.235, body);
    pt.armL = mkArm(-0.52, 1.75, 0.22, 0.72, mp, ms); pt.armR = mkArm(0.52, 1.75, 0.22, 0.72, mp, ms);
  } else if (b === 'heavy') {
    pt.legL = mkLeg(-0.28, 1.0, 0.36, 0.95, 0.4, ms, mdk); pt.legR = mkLeg(0.28, 1.0, 0.36, 0.95, 0.4, ms, mdk);
    pt.torso = mesh(GB(1.12, 1.0, 0.66), mp, 0, 1.55, 0, body); mesh(GB(1.16, 0.16, 0.7), ms, 0, 1.08, 0, body); mesh(GB(0.5, 0.3, 0.06), ms, 0, 1.7, 0.34, body); mesh(GO(0.12), mg, 0, 1.7, 0.38, body);
    pt.armL = mkArm(-0.74, 1.95, 0.32, 0.85, mp, ms); pt.armR = mkArm(0.74, 1.95, 0.32, 0.85, mp, ms);
    headY = 2.25; chestZ = 0.34; backZ = -0.35; shY = 1.95; shX = 0.74; neckR = 0.22;
  } else if (b === 'slim') {
    pt.legL = mkLeg(-0.16, 1.0, 0.2, 1.0, 0.22, ms, mdk); pt.legR = mkLeg(0.16, 1.0, 0.2, 1.0, 0.22, ms, mdk);
    pt.torso = mesh(GB(0.58, 0.85, 0.34), mp, 0, 1.45, 0, body); mesh(GB(0.6, 0.08, 0.36), mg, 0, 1.06, 0, body);
    pt.armL = mkArm(-0.4, 1.78, 0.16, 0.72, mp, ms); pt.armR = mkArm(0.4, 1.78, 0.16, 0.72, mp, ms);
    headY = 2.05; chestZ = 0.18; backZ = -0.19; shX = 0.4; neckR = 0.14;
  } else if (b === 'robe') {
    pt.legL = mkLeg(-0.15, 0.5, 0.18, 0.4, 0.2, mdk); pt.legR = mkLeg(0.15, 0.5, 0.18, 0.4, 0.2, mdk);
    mesh(GC(0.36, 0.78, 1.3, 14), ms, 0, 0.65, 0, body); mesh(GT(0.77, 0.04, 6, 28), mg, 0, 0.05, 0, body, Math.PI / 2);
    pt.torso = mesh(GB(0.72, 0.72, 0.44), mp, 0, 1.6, 0, body); mesh(GB(0.12, 0.7, 0.05), mg, 0, 1.6, 0.225, body);
    pt.armL = mkArm(-0.5, 1.9, 0.24, 0.72, ms, mp, true); pt.armR = mkArm(0.5, 1.9, 0.24, 0.72, ms, mp, true);
    headY = 2.15; shY = 1.9; shX = 0.5;
  } else if (b === 'float') {
    pt.hover = 0.45;
    const tail = mesh(GK(0.42, 1.2, 12), ownMat(P, { ...mo, op: 0.85, e: Gc, ei: 0.2 }), 0, 0.6, 0, body, Math.PI); pt.anims.push(t => { tail.rotation.z = Math.sin(t * 3) * 0.15; });
    pt.torso = mesh(GB(0.72, 0.8, 0.42), mp, 0, 1.5, 0, body);
    pt.armL = mkArm(-0.5, 1.82, 0.2, 0.7, mp, mg); pt.armR = mkArm(0.5, 1.82, 0.2, 0.7, mp, mg);
    headY = 2.12;
  } else if (b === 'blob') {
    const bl = mesh(GS(0.85, 20, 16), ownMat(P, { r: 0.15, m: 0.1, op: 0.85, e: P, ei: 0.25 }), 0, 0.78, 0, body); bl.scale.set(1, 0.88, 1);
    mesh(GS(0.4, 12, 10), ownMat(Sc, { r: 0.2, op: 0.7 }), 0, 0.7, 0, body);
    mesh(GS(0.17, 10, 8), mw, -0.28, 1.05, 0.66, body); mesh(GS(0.17, 10, 8), mw, 0.28, 1.05, 0.66, body);
    mesh(GS(0.08, 8, 6), mdk, -0.28, 1.05, 0.81, body); mesh(GS(0.08, 8, 6), mdk, 0.28, 1.05, 0.81, body);
    pt.anims.push((t, sp) => { const s = 1 + Math.sin(t * (4 + sp * 8)) * 0.05; bl.scale.set(1 / s, 0.88 * s, 1 / s); });
    pt.armL = grp(body, -0.85, 1.0, 0); pt.armR = grp(body, 0.85, 1.0, 0); pt.armR.userData.hand = grp(pt.armR, 0, -0.4, 0); pt.armL.userData.hand = grp(pt.armL, 0, -0.4, 0);
    headY = 1.55; chestZ = 0.8; backZ = -0.8;
  } else if (b === 'mech') {
    pt.legL = mkLeg(-0.34, 1.1, 0.4, 1.05, 0.5, mdk, ms); pt.legR = mkLeg(0.34, 1.1, 0.4, 1.05, 0.5, mdk, ms);
    [pt.legL, pt.legR].forEach(L => { mesh(GB(0.46, 0.3, 0.55), mp, 0, -0.5, 0.05, L); mesh(GS(0.12), mg, 0, -0.5, 0.3, L); });
    pt.torso = mesh(GB(1.25, 1.05, 0.85), mp, 0, 1.7, 0, body); mesh(GB(0.6, 0.4, 0.1), mg, 0, 1.8, 0.43, body); mesh(GB(1.3, 0.2, 0.9), ms, 0, 1.2, 0, body);
    pt.armL = mkArm(-0.85, 2.1, 0.36, 0.9, ms, mp); pt.armR = mkArm(0.85, 2.1, 0.36, 0.9, ms, mp);
    headY = 2.35; chestZ = 0.43; backZ = -0.45; shY = 2.1; shX = 0.85; neckR = 0.25;
  } else if (b === 'bone') {
    const bm = mp;
    pt.legL = grp(body, -0.17, 0.95, 0); mesh(GC(0.06, 0.05, 0.9, 6), bm, 0, -0.45, 0, pt.legL); mesh(GB(0.16, 0.08, 0.3), bm, 0, -0.9, 0.06, pt.legL);
    pt.legR = grp(body, 0.17, 0.95, 0); mesh(GC(0.06, 0.05, 0.9, 6), bm, 0, -0.45, 0, pt.legR); mesh(GB(0.16, 0.08, 0.3), bm, 0, -0.9, 0.06, pt.legR);
    mesh(GB(0.45, 0.14, 0.2), bm, 0, 1.0, 0, body); mesh(GC(0.05, 0.05, 0.95, 6), bm, 0, 1.45, -0.05, body);
    for (let i = 0; i < 4; i++) mesh(GT(0.26 - i * 0.025, 0.035, 5, 14, Math.PI * 1.4), bm, 0, 1.3 + i * 0.14, 0.02, body, Math.PI / 2, 0, -Math.PI * 0.2);
    pt.torso = mesh(GS(0.1), mg, 0, 1.5, 0.05, body);
    pt.armL = grp(body, -0.36, 1.78, 0); mesh(GC(0.05, 0.04, 0.72, 6), bm, 0, -0.36, 0, pt.armL); mesh(GS(0.08), bm, 0, -0.74, 0, pt.armL); pt.armL.userData.hand = grp(pt.armL, 0, -0.74, 0);
    pt.armR = grp(body, 0.36, 1.78, 0); mesh(GC(0.05, 0.04, 0.72, 6), bm, 0, -0.36, 0, pt.armR); mesh(GS(0.08), bm, 0, -0.74, 0, pt.armR); pt.armR.userData.hand = grp(pt.armR, 0, -0.74, 0);
    headY = 2.0; chestZ = 0.15; backZ = -0.2; shX = 0.36; neckR = 0.12;
  } else if (b === 'snow') {
    mesh(GS(0.65, 18, 14), mw, 0, 0.6, 0, body); pt.torso = mesh(GS(0.48, 16, 12), mw, 0, 1.45, 0, body);
    for (let i = 0; i < 3; i++) mesh(GS(0.06), mdk, 0, 1.25 + i * 0.2, 0.44 - Math.abs(i - 1) * 0.03, body);
    const stick = matStd(0x5a3a1a, { r: 0.9 });
    pt.armL = grp(body, -0.45, 1.6, 0); mesh(GC(0.035, 0.025, 0.8, 5), stick, 0, -0.4, 0, pt.armL); pt.armL.userData.hand = grp(pt.armL, 0, -0.8, 0);
    pt.armR = grp(body, 0.45, 1.6, 0); mesh(GC(0.035, 0.025, 0.8, 5), stick, 0, -0.4, 0, pt.armR); pt.armR.userData.hand = grp(pt.armR, 0, -0.8, 0);
    const hd = mesh(GS(0.36, 16, 12), mw, 0, 2.15, 0, body); mesh(GK(0.06, 0.4, 8), matStd(0xff8a1a, { r: 0.6 }), 0, 2.13, 0.5, body, Math.PI / 2);
    mesh(GS(0.05), mdk, -0.12, 2.25, 0.32, body); mesh(GS(0.05), mdk, 0.12, 2.25, 0.32, body);
    headY = 2.42; chestZ = 0.45; backZ = -0.45; neckR = 0.3;
  } else if (b === 'rock') {
    pt.legL = grp(body, -0.32, 1.0, 0); mesh(GD(0.32), mp, 0, -0.35, 0, pt.legL); mesh(GD(0.3), ms, 0, -0.8, 0.05, pt.legL);
    pt.legR = grp(body, 0.32, 1.0, 0); mesh(GD(0.32), mp, 0, -0.35, 0, pt.legR); mesh(GD(0.3), ms, 0, -0.8, 0.05, pt.legR);
    pt.torso = mesh(GD(0.78), ownMat(P, { r: 0.9, m: 0.05, flat: true }), 0, 1.65, 0, body); pt.torso.scale.set(1, 0.95, 0.8);
    for (let i = 0; i < 5; i++) mesh(GB(0.06, rand(0.3, 0.6), 0.06), mg, rand(-0.4, 0.4), 1.5 + rand(-0.3, 0.3), 0.55, body, 0, 0, rand(-1, 1));
    pt.armL = grp(body, -0.85, 2.0, 0); mesh(GD(0.3), mp, 0, -0.3, 0, pt.armL); mesh(GD(0.36), ms, 0, -0.8, 0, pt.armL); pt.armL.userData.hand = grp(pt.armL, 0, -0.85, 0.1);
    pt.armR = grp(body, 0.85, 2.0, 0); mesh(GD(0.3), mp, 0, -0.3, 0, pt.armR); mesh(GD(0.36), ms, 0, -0.8, 0, pt.armR); pt.armR.userData.hand = grp(pt.armR, 0, -0.85, 0.1);
    if (C.head === 'none') { const h = mesh(GD(0.34), mp, 0, 2.55, 0.05, body); mesh(GB(0.1, 0.06, 0.05), mg, -0.12, 2.6, 0.34, body); mesh(GB(0.1, 0.06, 0.05), mg, 0.12, 2.6, 0.34, body); }
    headY = 2.8; chestZ = 0.6; backZ = -0.6; shX = 0.85; shY = 2.0; neckR = 0.3;
  } else if (b === 'crystal') {
    const cm = ownMat(P, { r: 0.05, m: 0.9, e: Gc, ei: 0.25, flat: true, op: 0.9 });
    pt.legL = grp(body, -0.2, 1.0, 0); mesh(GO(0.22), cm, 0, -0.45, 0, pt.legL).scale.set(0.7, 2.2, 0.7);
    pt.legR = grp(body, 0.2, 1.0, 0); mesh(GO(0.22), cm, 0, -0.45, 0, pt.legR).scale.set(0.7, 2.2, 0.7);
    pt.torso = mesh(GO(0.55), cm, 0, 1.55, 0, body); pt.torso.scale.set(1, 1.3, 0.7); mesh(GO(0.18), mg, 0, 1.55, 0, body);
    pt.armL = grp(body, -0.6, 1.85, 0); mesh(GO(0.18), cm, 0, -0.38, 0, pt.armL).scale.set(0.7, 2.2, 0.7); pt.armL.userData.hand = grp(pt.armL, 0, -0.75, 0);
    pt.armR = grp(body, 0.6, 1.85, 0); mesh(GO(0.18), cm, 0, -0.38, 0, pt.armR).scale.set(0.7, 2.2, 0.7); pt.armR.userData.hand = grp(pt.armR, 0, -0.75, 0);
    for (let i = 0; i < 4; i++) { const s = mesh(GO(0.12), cm, 0, 0, 0, body); const a0 = i / 4 * TAU; pt.anims.push(t => s.position.set(Math.cos(t + a0) * 0.95, 1.6 + Math.sin(t * 2 + i) * 0.3, Math.sin(t + a0) * 0.95)); }
    headY = 2.2; chestZ = 0.35; backZ = -0.35; shX = 0.6; shY = 1.85;
  } else { // tiny (chibi)
    pt.legL = mkLeg(-0.15, 0.5, 0.2, 0.45, 0.24, ms, mdk); pt.legR = mkLeg(0.15, 0.5, 0.2, 0.45, 0.24, ms, mdk);
    pt.torso = mesh(GB(0.56, 0.52, 0.36), mp, 0, 0.78, 0, body); mesh(GB(0.12, 0.12, 0.05), mg, 0, 0.82, 0.185, body);
    pt.armL = mkArm(-0.37, 0.98, 0.15, 0.42, mp, ms); pt.armR = mkArm(0.37, 0.98, 0.15, 0.42, mp, ms);
    headY = 1.1; hs = 1.55; chestZ = 0.18; backZ = -0.19; shY = 0.98; shX = 0.37; neckR = 0.14;
  }
  // ---- head ----
  const H = grp(body, 0, headY, 0); pt.head = H; H.scale.setScalar(hs);
  buildHead(C.head, H, mx, C, P, Sc, Gc);
  // ---- accessories ----
  const ctx = { body, H, mx, chestZ, backZ, shY, shX, headY, hs, neckR, pt, C, P, Sc, Gc, root };
  for (const a of C.acc) { const f = ACC[a]; if (f) f(ctx); }
  // ---- mutation sparkle/rainbow ----
  pt.mut = mut; pt.mats = mx;
  if (mut === 'rainbow') pt.anims.push(t => { mp.color.setHSL((t * 0.25) % 1, 0.85, 0.55); mp.emissive.setHSL((t * 0.25) % 1, 1, 0.3); ms.color.setHSL((t * 0.25 + 0.5) % 1, 0.8, 0.4); mg.color.setHSL((t * 0.25 + 0.25) % 1, 1, 0.6); });
  if (mut) pt.emit.push({ o: body, y: 1.4, kind: mut === 'golden' ? 'gold' : mut === 'void' ? 'void' : mut === 'rainbow' ? 'rainbow' : 'shiny' });
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  let height = headY + 0.5 * hs + 0.2; if (b === 'tiny') height = headY + 0.9;
  return { group: root, parts: pt, height, glowCol: Gc.clone(), C, mut, gun: null };
}

function eyes(H, mat, y, z, sep = 0.13, r = 0.06) { mesh(GS(r, 8, 6), mat, -sep, y, z, H); mesh(GS(r, 8, 6), mat, sep, y, z, H); }
function buildHead(type, H, m, C, P, Sc, Gc) {
  const T = type;
  if (T === 'none') return;
  if (T === 'round') { mesh(GS(0.33, 18, 14), m.p, 0, 0.33, 0, H); eyes(H, m.g, 0.37, 0.29); }
  else if (T === 'box') { mesh(GB(0.55, 0.52, 0.52), m.p, 0, 0.3, 0, H); mesh(GB(0.5, 0.12, 0.04), m.g, 0, 0.34, 0.27, H); }
  else if (T === 'tv') { mesh(GB(0.66, 0.5, 0.42), m.s, 0, 0.3, 0, H); mesh(GP(0.54, 0.38), m.g, 0, 0.3, 0.215, H); mesh(GB(0.08, 0.12, 0.02), m.d, -0.12, 0.34, 0.225, H); mesh(GB(0.08, 0.12, 0.02), m.d, 0.12, 0.34, 0.225, H); mesh(GB(0.22, 0.04, 0.02), m.d, 0, 0.2, 0.225, H); }
  else if (T === 'helm') { mesh(GS(0.34, 16, 12), m.p, 0, 0.33, 0, H); mesh(GB(0.5, 0.08, 0.1), m.g, 0, 0.36, 0.28, H); mesh(GB(0.06, 0.3, 0.1), m.g, 0, 0.25, 0.3, H); mesh(GB(0.06, 0.2, 0.62), m.s, 0, 0.6, 0, H); }
  else if (T === 'knight') { mesh(GC(0.3, 0.32, 0.55, 14), m.p, 0, 0.3, 0, H); mesh(GS(0.3, 14, 8), m.p, 0, 0.56, 0, H).scale.set(1, 0.5, 1); mesh(GB(0.44, 0.05, 0.05), m.g, 0, 0.36, 0.3, H); mesh(GB(0.05, 0.25, 0.05), m.g, 0, 0.26, 0.31, H); }
  else if (T === 'skull') { const sk = mesh(GS(0.34, 16, 12), m.p, 0, 0.36, 0, H); sk.scale.set(0.95, 1, 1); mesh(GB(0.34, 0.16, 0.3), m.p, 0, 0.12, 0.06, H); mesh(GS(0.09, 8, 6), m.d, -0.12, 0.38, 0.27, H); mesh(GS(0.09, 8, 6), m.d, 0.12, 0.38, 0.27, H); eyes(H, m.g, 0.38, 0.3, 0.12, 0.04); mesh(GK(0.04, 0.08, 3), m.d, 0, 0.27, 0.32, H, Math.PI); }
  else if (T === 'pumpkin') {
    const pm = ownMat(Sc, { r: 0.6, m: 0.05, e: 0x331100, ei: 0.3 });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; mesh(GS(0.28, 12, 10), pm, Math.cos(a) * 0.14, 0.34, Math.sin(a) * 0.14, H).scale.set(0.9, 0.85, 0.9); }
    mesh(GC(0.04, 0.06, 0.18, 6), matStd(0x2a6a1a), 0, 0.65, 0, H, 0.2);
    const fg = ownGlow(Gc); mesh(GK(0.08, 0.12, 3), fg, -0.13, 0.42, 0.37, H, 0, 0, 0); mesh(GK(0.08, 0.12, 3), fg, 0.13, 0.42, 0.37, H); mesh(GB(0.3, 0.06, 0.04), fg, 0, 0.24, 0.38, H);
    for (let i = 0; i < 3; i++) mesh(GK(0.035, 0.07, 3), fg, -0.1 + i * 0.1, 0.29, 0.39, H, Math.PI);
  }
  else if (T === 'wolf' || T === 'fox') {
    mesh(GS(0.32, 14, 12), m.p, 0, 0.34, 0, H);
    const sn = mesh(GK(T === 'fox' ? 0.15 : 0.17, T === 'fox' ? 0.42 : 0.36, 8), T === 'fox' ? m.w : m.p, 0, 0.26, 0.38, H, Math.PI / 2); mesh(GS(0.05), m.d, 0, 0.26, 0.58, H);
    mesh(GK(0.1, 0.28, 4), m.p, -0.18, 0.66, 0, H, 0, 0, 0.2); mesh(GK(0.1, 0.28, 4), m.p, 0.18, 0.66, 0, H, 0, 0, -0.2);
    eyes(H, m.g, 0.4, 0.27, 0.12, 0.05);
  }
  else if (T === 'cat') { mesh(GS(0.32, 14, 12), m.p, 0, 0.34, 0, H); mesh(GK(0.11, 0.22, 3), m.p, -0.18, 0.62, 0, H, 0, 0, 0.25); mesh(GK(0.11, 0.22, 3), m.p, 0.18, 0.62, 0, H, 0, 0, -0.25); mesh(GK(0.06, 0.14, 3), m.s, -0.18, 0.6, 0.03, H, 0, 0, 0.25); mesh(GK(0.06, 0.14, 3), m.s, 0.18, 0.6, 0.03, H, 0, 0, -0.25); eyes(H, m.g, 0.38, 0.27, 0.12, 0.06); mesh(GS(0.035), m.s, 0, 0.3, 0.32, H); for (const s of [-1, 1]) for (let i = 0; i < 2; i++) mesh(GB(0.22, 0.01, 0.01), m.w, s * 0.2, 0.28 + i * 0.05, 0.28, H, 0, 0, s * (i ? 0.15 : -0.1)); }
  else if (T === 'bear') { mesh(GS(0.34, 14, 12), m.p, 0, 0.34, 0, H); mesh(GS(0.11), m.p, -0.24, 0.6, 0, H); mesh(GS(0.11), m.p, 0.24, 0.6, 0, H); mesh(GS(0.15), m.s, 0, 0.26, 0.26, H).scale.set(1, 0.8, 0.8); mesh(GS(0.05), m.d, 0, 0.3, 0.38, H); eyes(H, m.g, 0.42, 0.28, 0.12, 0.045); }
  else if (T === 'bird' || T === 'owl') {
    mesh(GS(0.33, 14, 12), m.p, 0, 0.34, 0, H);
    mesh(GK(0.1, 0.3, 6), ownMat(T === 'owl' ? 0xffaa33 : Sc, { r: 0.4, m: 0.2 }), 0, 0.26, 0.38, H, Math.PI / 2);
    if (T === 'owl') { mesh(GC(0.12, 0.12, 0.04, 14), m.w, -0.13, 0.4, 0.28, H, Math.PI / 2); mesh(GC(0.12, 0.12, 0.04, 14), m.w, 0.13, 0.4, 0.28, H, Math.PI / 2); eyes(H, m.g, 0.4, 0.31, 0.13, 0.06); mesh(GK(0.06, 0.2, 4), m.p, -0.22, 0.62, 0, H, 0, 0, 0.3); mesh(GK(0.06, 0.2, 4), m.p, 0.22, 0.62, 0, H, 0, 0, -0.3); }
    else { eyes(H, m.g, 0.4, 0.27, 0.13, 0.055); for (let i = 0; i < 3; i++) mesh(GK(0.06, 0.36, 4), ownMat(Sc, { e: Gc, ei: 0.4 }), 0, 0.68, -0.05 - i * 0.1, H, -0.5 - i * 0.3); }
  }
  else if (T === 'dragon') { mesh(GB(0.46, 0.4, 0.5), m.p, 0, 0.32, 0, H); mesh(GB(0.34, 0.24, 0.36), m.p, 0, 0.24, 0.38, H); mesh(GB(0.3, 0.06, 0.3), m.s, 0, 0.1, 0.36, H); for (const s of [-1, 1]) { mesh(GK(0.06, 0.4, 6), m.d, s * 0.16, 0.6, -0.12, H, -0.6); for (let i = 0; i < 3; i++) mesh(GK(0.02, 0.06, 3), m.w, s * 0.1, 0.15, 0.48 + i * 0.07, H, Math.PI); } eyes(H, m.g, 0.42, 0.26, 0.14, 0.05); }
  else if (T === 'frog') { const f = mesh(GS(0.34, 14, 12), m.p, 0, 0.26, 0, H); f.scale.set(1.25, 0.75, 1); mesh(GS(0.13), m.p, -0.2, 0.5, 0.06, H); mesh(GS(0.13), m.p, 0.2, 0.5, 0.06, H); eyes(H, m.g, 0.53, 0.17, 0.2, 0.07); mesh(GB(0.4, 0.03, 0.05), m.s, 0, 0.18, 0.31, H); }
  else if (T === 'shark') { mesh(GS(0.33, 14, 12), m.p, 0, 0.32, 0.08, H).scale.set(1, 0.95, 1.35); mesh(GK(0.1, 0.4, 3), m.p, 0, 0.75, -0.05, H, -0.3); mesh(GB(0.36, 0.08, 0.2), m.w, 0, 0.18, 0.36, H); for (let i = 0; i < 5; i++) mesh(GK(0.025, 0.06, 3), m.w, -0.14 + i * 0.07, 0.24, 0.47, H, Math.PI); eyes(H, m.g, 0.38, 0.3, 0.24, 0.045); }
  else if (T === 'octo') { mesh(GS(0.36, 16, 12), m.p, 0, 0.42, -0.05, H).scale.set(1, 1.2, 1); eyes(H, m.g, 0.35, 0.27, 0.13, 0.065); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI + Math.PI; const t = mesh(GK(0.05, 0.4, 6), m.p, Math.cos(a) * 0.22, 0.05, 0.12 + Math.sin(a) * -0.05, H, Math.PI, 0, 0); H.userData.tent = H.userData.tent || []; H.userData.tent.push(t); } }
  else if (T === 'diver') { mesh(GS(0.38, 16, 12), ownMat(0xc89a3a, { r: 0.25, m: 1 }), 0, 0.35, 0, H); mesh(GC(0.2, 0.2, 0.05, 16), ownAdd(Gc, 0.6), 0, 0.37, 0.36, H, Math.PI / 2); mesh(GT(0.2, 0.035, 6, 16), ownMat(0xc89a3a, { r: 0.25, m: 1 }), 0, 0.37, 0.37, H); for (const s of [-1, 1]) mesh(GC(0.08, 0.08, 0.06, 10), ownMat(0xc89a3a, { r: 0.25, m: 1 }), s * 0.36, 0.35, 0, H, 0, 0, Math.PI / 2); }
  else if (T === 'ninja') { mesh(GS(0.32, 14, 12), m.d, 0, 0.33, 0, H); mesh(GB(0.5, 0.1, 0.1), m.p, 0, 0.36, 0.25, H); eyes(H, m.g, 0.37, 0.31, 0.1, 0.035); }
  else if (T === 'samurai') { mesh(GS(0.32, 14, 12), m.d, 0, 0.32, 0, H); mesh(GS(0.36, 14, 8, 0), m.p, 0, 0.42, 0, H).scale.set(1, 0.7, 1); mesh(GC(0.32, 0.5, 0.18, 14, true), m.p, 0, 0.32, -0.05, H); mesh(GB(0.34, 0.16, 0.1), ownMat(0x220000), 0, 0.2, 0.28, H); eyes(H, m.g, 0.36, 0.3, 0.1, 0.04); for (const s of [-1, 1]) mesh(GB(0.05, 0.4, 0.02), m.gold, s * 0.12, 0.72, 0.22, H, 0, 0, s * -0.45); }
  else if (T === 'cyber') { mesh(GS(0.33, 16, 12), m.p, 0, 0.33, 0, H); const v = mesh(GC(0.335, 0.335, 0.13, 20, true), m.g, 0, 0.36, 0, H); v.scale.set(1, 1, 1); mesh(GB(0.06, 0.2, 0.15), m.s, -0.34, 0.36, 0, H); mesh(GB(0.06, 0.2, 0.15), m.s, 0.34, 0.36, 0, H); }
  else if (T === 'void') { mesh(GS(0.34, 16, 12), ownMat(0x05030a, { r: 0.2, m: 0.8, e: Gc, ei: 0.08 }), 0, 0.33, 0, H); for (let i = 0; i < 9; i++) { const v = V3(rand(-1, 1), rand(-1, 1), rand(0, 1)).normalize().multiplyScalar(0.345); mesh(GS(0.015, 4, 3), m.w, v.x, 0.33 + v.y, v.z, H); } eyes(H, m.g, 0.37, 0.29, 0.12, 0.06); }
  else if (T === 'astro') { mesh(GS(0.24, 12, 10), m.p, 0, 0.33, 0, H); mesh(GS(0.4, 18, 14), ownMat(0xaaddff, { r: 0.05, m: 0.4, op: 0.35 }), 0, 0.35, 0, H); const vz = mesh(GS(0.36, 16, 10, 0), ownMat(0xffcc44, { r: 0.1, m: 1, e: 0x553300, ei: 0.3 }), 0, 0.36, 0.06, H); vz.scale.set(0.9, 0.6, 0.6); mesh(GT(0.4, 0.04, 6, 24), m.s, 0, 0.1, 0, H, Math.PI / 2); }
  else if (T === 'eye') { const e = mesh(GS(0.36, 18, 14), m.w, 0, 0.36, 0, H); mesh(GS(0.17, 14, 10), ownGlow(Gc), 0, 0.36, 0.26, H).scale.set(1, 1, 0.5); mesh(GS(0.08, 10, 8), m.d, 0, 0.36, 0.34, H); mesh(GT(0.37, 0.05, 6, 24), m.p, 0, 0.36, 0, H, 0, 0, 0); H.userData.eye = e; }
  else if (T === 'crystal') { mesh(GO(0.34), ownMat(P, { r: 0.05, m: 0.9, e: Gc, ei: 0.3, flat: true, op: 0.9 }), 0, 0.38, 0, H).scale.set(0.8, 1.2, 0.8); eyes(H, m.g, 0.4, 0.2, 0.09, 0.05); }
  else if (T === 'orb') { mesh(GS(0.32, 18, 14), ownGlow(Gc), 0, 0.36, 0, H); const s = glowSprite(Gc.getHex(), 1.6, 0.8); s.position.y = 0.36; H.add(s); mesh(GT(0.45, 0.025, 6, 32), m.gold, 0, 0.36, 0, H, Math.PI / 2.4); }
  else if (T === 'mushroom') { mesh(GC(0.16, 0.2, 0.36, 10), m.p, 0, 0.16, 0, H); eyes(H, mdkEye(), 0.2, 0.17, 0.07, 0.035); const cap = mesh(GS(0.45, 18, 10, 0), m.s, 0, 0.36, 0, H); cap.scale.set(1, 0.6, 1); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; mesh(GS(0.07, 6, 5), m.w, Math.cos(a) * 0.3, 0.52, Math.sin(a) * 0.3, H); } mesh(GS(0.08, 6, 5), m.w, 0, 0.62, 0, H); }
  function mdkEye() { return m.d; }
}

// ---------------- accessories ----------------
const ACC = {
  backpack: c => { mesh(GB(0.5, 0.55, 0.25), c.mx.s, 0, c.shY - 0.35, c.backZ - 0.1, c.body); mesh(GB(0.3, 0.2, 0.05), c.mx.g, 0, c.shY - 0.3, c.backZ - 0.24, c.body); },
  jetpack: c => { for (const s of [-1, 1]) { mesh(GC(0.12, 0.12, 0.6, 10), c.mx.d, s * 0.16, c.shY - 0.4, c.backZ - 0.14, c.body); mesh(GK(0.1, 0.16, 10), c.mx.s, s * 0.16, c.shY - 0.78, c.backZ - 0.14, c.body, Math.PI); c.pt.emit.push({ o: c.body, x: s * 0.16, y: c.shY - 0.9, z: c.backZ - 0.14, kind: 'jet' }); } },
  antenna: c => { mesh(GC(0.015, 0.015, 0.4, 4), c.mx.d, 0.1, 0.75, 0, c.H); const b = mesh(GS(0.06), c.mx.g, 0.1, 0.96, 0, c.H); c.pt.anims.push(t => b.material.color && (b.scale.setScalar(1 + Math.sin(t * 6) * 0.3))); },
  sparks: c => c.pt.emit.push({ o: c.body, y: c.headY, kind: 'spark' }),
  scarf: c => { mesh(GT(c.neckR + 0.06, 0.07, 6, 16), c.mx.s, 0, c.headY - 0.04, 0, c.body, Math.PI / 2); const tl = grp(c.body, 0.12, c.headY - 0.08, c.backZ); mesh(GB(0.14, 0.6, 0.04), c.mx.s, 0, -0.3, 0, tl); c.pt.anims.push((t, sp) => { tl.rotation.x = 0.3 + sp * 0.9 + Math.sin(t * 8) * 0.1 * (0.3 + sp); }); },
  headband: c => { mesh(GT(0.33, 0.035, 6, 20), c.mx.s, 0, 0.45, 0, c.H, Math.PI / 2); const tl = grp(c.H, 0, 0.45, -0.33); mesh(GB(0.08, 0.4, 0.02), c.mx.s, 0.05, -0.2, 0, tl); mesh(GB(0.08, 0.35, 0.02), c.mx.s, -0.05, -0.18, 0, tl); c.pt.anims.push((t, sp) => tl.rotation.x = 0.4 + sp * 0.8 + Math.sin(t * 9) * 0.15); },
  cape: c => { const cp = grp(c.body, 0, c.shY + 0.05, c.backZ - 0.04); const m = mesh(new THREE.PlaneGeometry(c.shX * 1.9, c.shY * 0.95, 1, 4), ownMat(c.Sc, { r: 0.7, side: true, e: c.Gc, ei: 0.05 }), 0, -c.shY * 0.47, 0, cp); m.castShadow = true; c.pt.anims.push((t, sp) => { cp.rotation.x = 0.12 + sp * 0.55 + Math.sin(t * 3) * 0.05; }); },
  halo: c => { const h = mesh(GT(0.3, 0.035, 8, 32), c.mx.gold.clone ? ownGlow(0xfff0a0) : c.mx.g, 0, 0.95, -0.05, c.H, Math.PI / 2); c.pt.anims.push(t => { h.position.y = 0.95 + Math.sin(t * 2) * 0.04; }); },
  halo2: c => { const a = mesh(GT(0.7, 0.03, 6, 48), ownGlow(c.Gc), 0, c.headY, c.backZ - 0.25, c.body); const b = mesh(GT(0.5, 0.025, 6, 40), ownGlow(0xffffff), 0, c.headY, c.backZ - 0.28, c.body); c.pt.anims.push(t => { a.rotation.z = t * 0.6; b.rotation.z = -t * 0.9; a.rotation.y = Math.sin(t) * 0.2; }); },
  wings: c => wingPair(c, 'feather', 1),
  batwings: c => wingPair(c, 'bat', 1),
  energywings: c => wingPair(c, 'energy', 1),
  sixwings: c => { wingPair(c, 'feather', 1.15, 0.25); wingPair(c, 'feather', 0.85, -0.25); wingPair(c, 'energy', 0.7, -0.75); },
  horns: c => { for (const s of [-1, 1]) { const h = mesh(GK(0.07, 0.42, 6), c.mx.d, s * 0.2, 0.68, 0.02, c.H, -0.25, 0, s * -0.45); } },
  ramhorns: c => { for (const s of [-1, 1]) mesh(GT(0.16, 0.05, 6, 14, Math.PI * 1.5), ownMat(0xd8c8a0, { r: 0.6 }), s * 0.32, 0.45, 0, c.H, 0, s * Math.PI / 2, 0); },
  crown: c => { mesh(GC(0.26, 0.24, 0.12, 12, true), c.mx.gold, 0, 0.7, 0, c.H); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; mesh(GK(0.05, 0.16, 4), c.mx.gold, Math.cos(a) * 0.24, 0.83, Math.sin(a) * 0.24, c.H); mesh(GS(0.03, 6, 4), c.mx.g, Math.cos(a) * 0.26, 0.7, Math.sin(a) * 0.26, c.H); } },
  tophat: c => { mesh(GC(0.38, 0.38, 0.04, 16), c.mx.d, 0, 0.66, 0, c.H); mesh(GC(0.24, 0.24, 0.45, 16), c.mx.d, 0, 0.9, 0, c.H); mesh(GC(0.245, 0.245, 0.08, 16), c.mx.s, 0, 0.72, 0, c.H); },
  wizardhat: c => { mesh(GC(0.5, 0.5, 0.04, 18), c.mx.s, 0, 0.64, 0, c.H); const k = mesh(GK(0.3, 0.8, 14), c.mx.s, 0, 1.04, -0.05, c.H, -0.18); mesh(GO(0.06), c.mx.g, 0.12, 0.95, 0.15, c.H); mesh(GO(0.04), c.mx.g, -0.1, 1.15, 0.05, c.H); },
  witchhat: c => { mesh(GC(0.55, 0.55, 0.04, 18), c.mx.d, 0, 0.62, 0, c.H); mesh(GK(0.28, 0.55, 14), c.mx.d, 0, 0.9, 0, c.H); mesh(GK(0.12, 0.35, 10), c.mx.d, 0.1, 1.28, -0.12, c.H, -0.8, 0, -0.4); mesh(GC(0.285, 0.29, 0.08, 14), c.mx.s, 0, 0.68, 0, c.H); },
  santahat: c => { mesh(GT(0.3, 0.07, 8, 20), c.mx.w, 0, 0.6, 0, c.H, Math.PI / 2); mesh(GK(0.3, 0.6, 14), ownMat(0xd0202a, { r: 0.7 }), 0.05, 0.9, -0.05, c.H, -0.3, 0, -0.2); mesh(GS(0.09), c.mx.w, 0.18, 1.12, -0.22, c.H); },
  elfhat: c => { mesh(GT(0.3, 0.05, 8, 20), ownMat(0xe74c3c), 0, 0.6, 0, c.H, Math.PI / 2); mesh(GK(0.3, 0.7, 14), ownMat(0x2ecc71), 0, 0.95, -0.1, c.H, -0.45); mesh(GS(0.07), c.mx.gold, 0, 1.18, -0.38, c.H); },
  piratehat: c => { const h = mesh(GC(0.5, 0.5, 0.06, 3), c.mx.d, 0, 0.66, 0, c.H, 0, Math.PI / 2, 0); h.scale.set(1, 1, 0.7); mesh(GS(0.28, 14, 8, 0), c.mx.d, 0, 0.64, 0, c.H).scale.set(1, 0.7, 1); mesh(GS(0.06), c.mx.w, 0, 0.78, 0.25, c.H); },
  cowboyhat: c => { const br = mesh(GC(0.55, 0.55, 0.04, 18), c.mx.s, 0, 0.62, 0, c.H); br.scale.set(1, 1, 0.85); mesh(GC(0.25, 0.28, 0.32, 14), c.mx.s, 0, 0.8, 0, c.H); mesh(GC(0.285, 0.285, 0.06, 14), c.mx.d, 0, 0.68, 0, c.H); },
  vikinghelm: c => { mesh(GS(0.36, 14, 8, 0), ownMat(0x9aa0aa, { r: 0.3, m: 0.9 }), 0, 0.42, 0, c.H).scale.set(1, 0.85, 1); for (const s of [-1, 1]) mesh(GK(0.08, 0.42, 8), c.mx.w, s * 0.38, 0.62, 0, c.H, 0, 0, s * -0.9); mesh(GB(0.05, 0.2, 0.06), ownMat(0x9aa0aa, { m: 0.9 }), 0, 0.3, 0.33, c.H); },
  jester: c => { for (const s of [-1, 1]) { mesh(GK(0.14, 0.6, 10), s < 0 ? c.mx.p : c.mx.s, s * 0.22, 0.85, 0, c.H, 0, 0, s * -0.9); mesh(GS(0.07), c.mx.gold, s * 0.5, 1.02, 0, c.H); } },
  tail: c => { const t = grp(c.body, 0, 1.0, c.backZ); for (let i = 0; i < 5; i++) mesh(GS(0.11 - i * 0.015, 8, 6), c.mx.p, 0, -i * 0.05, -0.1 - i * 0.16, t); c.pt.anims.push((tt, sp) => t.rotation.y = Math.sin(tt * (3 + sp * 6)) * 0.4); },
  fluffytail: c => { const t = grp(c.body, 0, 1.0, c.backZ); const m1 = mesh(GS(0.22, 12, 10), c.mx.p, 0, 0.1, -0.3, t); m1.scale.set(0.8, 0.8, 1.6); mesh(GS(0.16, 10, 8), c.mx.w, 0, 0.25, -0.62, t); c.pt.anims.push((tt, sp) => { t.rotation.y = Math.sin(tt * 4) * 0.35; t.rotation.x = -0.4; }); },
  spiketail: c => { const t = grp(c.body, 0, 1.0, c.backZ); for (let i = 0; i < 6; i++) { mesh(GS(0.15 - i * 0.02, 8, 6), c.mx.p, 0, -i * 0.08, -0.1 - i * 0.2, t); mesh(GK(0.05, 0.16, 4), c.mx.g, 0, 0.12 - i * 0.09, -0.1 - i * 0.2, t); } c.pt.anims.push((tt, sp) => t.rotation.y = Math.sin(tt * 2.5) * 0.35); },
  sword: c => { const s = grp(c.body, 0.15, c.shY - 0.2, c.backZ - 0.1); s.rotation.z = 0.6; mesh(GB(0.1, 1.2, 0.03), ownMat(0xdde4ee, { r: 0.15, m: 1, e: c.Gc, ei: 0.25 }), 0, 0.3, 0, s); mesh(GB(0.03, 1.1, 0.035), c.mx.g, 0, 0.3, 0, s); mesh(GB(0.34, 0.06, 0.08), c.mx.gold, 0, -0.32, 0, s); mesh(GC(0.035, 0.035, 0.28, 6), c.mx.d, 0, -0.48, 0, s); },
  shield: c => { const A = c.pt.armL; if (!A) return; const s = mesh(GC(0.38, 0.38, 0.07, 18), c.mx.s, -0.12, -0.42, 0.05, A, 0, 0, Math.PI / 2); mesh(GC(0.16, 0.16, 0.08, 6), c.mx.g, -0.16, -0.42, 0.05, A, 0, 0, Math.PI / 2); },
  shoulderpads: c => { for (const s of [-1, 1]) { const p = mesh(GS(0.26, 12, 8, 0), c.mx.s, s * c.shX, c.shY + 0.05, 0, c.body); p.scale.set(1.1, 0.7, 1); mesh(GK(0.06, 0.2, 5), c.mx.g, s * c.shX, c.shY + 0.3, 0, c.body); } },
  spikes: c => { for (let i = 0; i < 5; i++) mesh(GK(0.07, 0.35, 5), c.mx.g.color ? ownMat(c.Gc, { r: 0.1, m: 0.5, e: c.Gc, ei: 0.5 }) : c.mx.g, rand(-0.3, 0.3), c.shY - 0.1 - i * 0.12, c.backZ - 0.05, c.body, -1.2); for (const s of [-1, 1]) mesh(GK(0.07, 0.32, 5), c.mx.d, s * c.shX, c.shY + 0.22, 0, c.body); },
  orbs: c => { const os = []; for (let i = 0; i < 3; i++) { const o = mesh(GS(0.1, 10, 8), c.mx.g, 0, 0, 0, c.body); const sp = glowSprite(c.Gc.getHex(), 0.7, 0.7); o.add(sp); os.push(o); } c.pt.anims.push(t => os.forEach((o, i) => { const a = t * 1.8 + i * TAU / 3; o.position.set(Math.cos(a) * 0.95, c.headY - 0.3 + Math.sin(t * 3 + i) * 0.2, Math.sin(a) * 0.95); })); },
  rings: c => { const r1 = mesh(GT(1.0, 0.025, 6, 48), ownGlow(c.Gc), 0, c.shY - 0.4, 0, c.body), r2 = mesh(GT(1.15, 0.02, 6, 48), ownGlow(0xffffff), 0, c.shY - 0.4, 0, c.body); c.pt.anims.push(t => { r1.rotation.set(1.2 + Math.sin(t) * 0.3, t, 0); r2.rotation.set(-1.0, -t * 1.3, 0.4); }); },
  beard: c => { const col = c.C.acc.includes('santahat') ? c.mx.w : ownMat(c.Sc.clone().offsetHSL(0, 0, 0.1), { r: 0.9 }); mesh(GK(0.24, 0.42, 10), col, 0, 0.08, 0.2, c.H, Math.PI); },
  eyepatch: c => { mesh(GB(0.13, 0.11, 0.04), c.mx.d, 0.13, 0.37, 0.31, c.H); mesh(GT(0.335, 0.012, 4, 24), c.mx.d, 0, 0.4, 0, c.H, Math.PI / 2.3); },
  mask: c => { mesh(GB(0.34, 0.24, 0.16), c.mx.d, 0, 0.2, 0.28, c.H); for (const s of [-1, 1]) mesh(GC(0.07, 0.07, 0.12, 10), c.mx.g, s * 0.14, 0.15, 0.38, c.H, Math.PI / 2); mesh(GB(0.38, 0.1, 0.04), ownAdd(0x88ffcc, 0.5), 0, 0.38, 0.31, c.H); },
  leaves: c => { const lm = matStd(0x3aa83a, { r: 0.8, flat: true }); for (let i = 0; i < 7; i++) { const s = i < 4 ? (i % 2 ? 1 : -1) : 0; const l = mesh(GI(0.16), lm, s ? s * c.shX : rand(-0.2, 0.2), s ? c.shY + 0.1 : 0, s ? rand(-0.1, 0.1) : 0, s ? c.body : c.H); if (!s) l.position.y = 0.62 + rand(0, 0.1); l.scale.set(1.2, 0.6, 1); } },
  flames: c => { c.pt.emit.push({ o: c.body, y: c.shY + 0.1, x: c.shX, kind: 'flame' }); c.pt.emit.push({ o: c.body, y: c.shY + 0.1, x: -c.shX, kind: 'flame' }); },
  tentacles: c => { const ts = []; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const g = grp(c.body, Math.cos(a) * 0.3, 0.9, Math.sin(a) * 0.3); for (let j = 0; j < 4; j++) mesh(GS(0.09 - j * 0.017, 8, 6), c.mx.s, 0, -j * 0.2, 0, g); g.rotation.z = Math.cos(a) * 0.5; g.rotation.x = -Math.sin(a) * 0.5; ts.push(g); } c.pt.anims.push(t => ts.forEach((g, i) => g.rotation.y = Math.sin(t * 2 + i) * 0.5)); },
  fins: c => { mesh(GK(0.2, 0.6, 3), c.mx.p, 0, c.shY - 0.1, c.backZ - 0.15, c.body, -0.6); for (const s of [-1, 1]) if (c.pt[s < 0 ? 'armL' : 'armR']) mesh(GK(0.1, 0.35, 3), c.mx.p, s * 0.1, -0.35, -0.08, c.pt[s < 0 ? 'armL' : 'armR'], 0, 0, s * 1.2); },
  petals: c => { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; mesh(GS(0.07, 6, 5), ownMat(0xff8ad8, { e: 0xff4aa0, ei: 0.3 }), Math.cos(a) * 0.25, 0.66, Math.sin(a) * 0.25, c.H); } c.pt.emit.push({ o: c.body, y: c.headY + 0.4, kind: 'petal' }); },
  gears: c => { const gs = []; for (let i = 0; i < 2; i++) { const g = grp(c.body, (i ? 0.25 : -0.2), c.shY - 0.2 - i * 0.35, c.backZ - 0.08); mesh(GT(0.22 - i * 0.05, 0.05, 6, 16), c.mx.gold, 0, 0, 0, g); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; mesh(GB(0.07, 0.07, 0.07), c.mx.gold, Math.cos(a) * (0.27 - i * 0.05), Math.sin(a) * (0.27 - i * 0.05), 0, g); } gs.push(g); } c.pt.anims.push(t => { gs[0].rotation.z = t * 1.5; gs[1].rotation.z = -t * 2; }); },
  book: c => { const b = grp(c.body, 0.6, c.headY - 0.1, 0.3); mesh(GB(0.3, 0.06, 0.4), c.mx.s, 0, 0, 0, b); mesh(GB(0.26, 0.07, 0.36), c.mx.w, 0, 0.01, 0, b); mesh(GB(0.2, 0.02, 0.3), c.mx.g, 0, 0.05, 0, b); c.pt.anims.push(t => { b.position.y = c.headY - 0.1 + Math.sin(t * 2) * 0.1; b.rotation.y = Math.sin(t) * 0.3; }); },
  lantern: c => { const A = c.pt.armL; if (!A) return; const l = grp(A.userData.hand || A, 0, -0.2, 0.05); mesh(GB(0.16, 0.22, 0.16), c.mx.d, 0, 0, 0, l); mesh(GS(0.07), c.mx.g, 0, 0, 0, l); const s = glowSprite(c.Gc.getHex(), 0.8, 0.8); l.add(s); },
  broom: c => { const b = grp(c.body, 0, c.shY - 0.3, c.backZ - 0.12); b.rotation.z = 0.8; mesh(GC(0.03, 0.03, 1.5, 6), matStd(0x6a4a2a), 0, 0, 0, b); mesh(GK(0.15, 0.45, 8), matStd(0xc8a050, { r: 1 }), 0, -0.85, 0, b, Math.PI); },
  scythe: c => { const s = grp(c.body, 0, c.shY - 0.2, c.backZ - 0.12); s.rotation.z = -0.5; mesh(GC(0.035, 0.035, 2.0, 6), c.mx.d, 0, 0, 0, s); mesh(GT(0.45, 0.05, 4, 16, Math.PI * 0.8), ownMat(0xdde4ee, { r: 0.15, m: 1, e: c.Gc, ei: 0.4 }), -0.35, 0.9, 0, s, 0, 0, Math.PI * 0.15); },
  clock: c => { const k = grp(c.body, 0, c.shY - 0.1, c.backZ - 0.3); mesh(GC(0.5, 0.5, 0.05, 32), c.mx.gold, 0, 0, 0, k, Math.PI / 2); mesh(GC(0.44, 0.44, 0.06, 32), c.mx.w, 0, 0, 0.01, k, Math.PI / 2); const h1 = grp(k, 0, 0, -0.04), h2 = grp(k, 0, 0, -0.045); mesh(GB(0.04, 0.3, 0.02), c.mx.d, 0, 0.15, 0, h1); mesh(GB(0.03, 0.4, 0.02), c.mx.g, 0, 0.2, 0, h2); c.pt.anims.push(t => { h1.rotation.z = -t * 0.3; h2.rotation.z = -t * 3; }); },
  planet: c => { const p = grp(c.body); mesh(GS(0.22, 14, 10), ownMat(0x6a8aff, { e: 0x2a3a8a, ei: 0.4 }), 0, 0, 0, p); mesh(GT(0.36, 0.03, 4, 32), c.mx.gold, 0, 0, 0, p, 1.2); c.pt.anims.push(t => p.position.set(Math.cos(t * 0.7) * 1.1, c.headY + 0.3 + Math.sin(t) * 0.15, Math.sin(t * 0.7) * 1.1)); },
  stars: c => { c.pt.emit.push({ o: c.body, y: c.headY, kind: 'star' }); },
  glitch: c => { c.pt.emit.push({ o: c.body, y: c.headY - 0.5, kind: 'glitch' }); c.pt.anims.push(t => { if (Math.random() < 0.06) c.body.position.x = rand(-0.12, 0.12); else c.body.position.x *= 0.7; }); },
  trident: c => { const A = c.pt.armL; if (!A) return; const t = grp(A.userData.hand || A, 0, 0, 0); mesh(GC(0.03, 0.03, 1.8, 6), c.mx.gold, 0, 0.3, 0, t); for (let i = -1; i <= 1; i++) mesh(GK(0.04, 0.3, 4), c.mx.g, i * 0.1, 1.3, 0, t); },
  plume: c => { mesh(GB(0.06, 0.25, 0.6), ownMat(0xcc2222, { r: 0.9 }), 0, 0.82, -0.1, c.H, 0.2); }
};
function wingPair(c, kind, sc, yo = 0) {
  const ws = [];
  for (const s of [-1, 1]) {
    const w = grp(c.body, s * 0.15, c.shY - 0.05 + yo, c.backZ - 0.05);
    if (kind === 'feather') { for (let i = 0; i < 5; i++) mesh(GB(0.95 * sc - i * 0.12, 0.14, 0.04), i % 2 ? c.mx.w : c.mx.p, s * (0.45 * sc - i * 0.04), 0.15 - i * 0.13, -0.02, w, 0, 0, s * (0.35 - i * 0.12)); }
    else if (kind === 'bat') { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(s * 1.1 * sc, 0.5); sh.lineTo(s * 0.9 * sc, -0.2); sh.lineTo(s * 0.6 * sc, 0.05); sh.lineTo(s * 0.45 * sc, -0.35); sh.lineTo(s * 0.2 * sc, -0.1); sh.lineTo(0, -0.3); const m = mesh(new THREE.ShapeGeometry(sh), ownMat(c.Sc, { r: 0.7, side: true, e: c.Gc, ei: 0.1 }), 0, 0, 0, w); mesh(GC(0.025, 0.025, 1.1 * sc, 5), c.mx.d, s * 0.55 * sc, 0.25, 0, w, 0, 0, s * -1.13); }
    else { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(s * 1.2 * sc, 0.6); sh.lineTo(s * 0.9 * sc, -0.1); sh.lineTo(s * 0.5 * sc, -0.6); sh.lineTo(0, -0.2); mesh(new THREE.ShapeGeometry(sh), c.mx.add, 0, 0, -0.02, w).castShadow = false; }
    w.rotation.y = s * 0.35; ws.push([w, s]);
  }
  c.pt.anims.push((t, sp, air) => ws.forEach(([w, s]) => { w.rotation.z = s * (Math.sin(t * (air ? 9 : 2)) * (air ? 0.4 : 0.1)); }));
}

const _ep = V3();
function animateCharacter(M, dt, speed, airborne, t, aim) {
  const p = M.parts;
  p.walk += dt * (2 + speed * 9);
  const sw = Math.sin(p.walk) * Math.min(1, speed) * 0.75;
  if (p.legL) p.legL.rotation.x = airborne ? -0.5 : sw;
  if (p.legR) p.legR.rotation.x = airborne ? 0.3 : -sw;
  p.body.position.y = p.hover + (p.hover ? Math.sin(t * 2.2) * 0.12 : Math.abs(Math.cos(p.walk)) * 0.06 * Math.min(1, speed) + Math.sin(t * 2) * 0.015);
  if (aim !== undefined && p.armR) {
    p.armR.rotation.set(-Math.PI / 2 - aim, 0, 0);
    if (p.armL) { p.armL.rotation.set(-Math.PI / 2.3 - aim, 0, 0.55); }
  } else {
    if (p.armR) p.armR.rotation.set(-sw * 0.8 + Math.sin(t * 1.6) * 0.04, 0, -0.08);
    if (p.armL) p.armL.rotation.set(sw * 0.8 + Math.sin(t * 1.6 + 1) * 0.04, 0, 0.08);
  }
  if (p.head && p.head.userData.tent) p.head.userData.tent.forEach((tt, i) => tt.rotation.z = Math.sin(t * 3 + i) * 0.25);
  for (const f of p.anims) f(t, speed, airborne);
  if (!PG || Math.random() > 0.9 * R.partMul) return;
  for (const e of p.emit) {
    if (Math.random() > 0.5) continue;
    _ep.set(e.x || 0, e.y || 1, e.z || 0); e.o.localToWorld(_ep);
    const c = FX.c;
    if (e.kind === 'flame') { c.set(Math.random() < 0.5 ? 0xff6a00 : 0xffcc33); PG.spawn(_ep.x + rand(-0.1, 0.1), _ep.y, _ep.z + rand(-0.1, 0.1), rand(-0.2, 0.2), rand(1.5, 3), rand(-0.2, 0.2), c, 1, rand(0.2, 0.4), rand(0.3, 0.6), -1, 1, -0.6); }
    else if (e.kind === 'jet') { c.set(airborne ? 0x7af8ff : 0xffaa33); PG.spawn(_ep.x, _ep.y, _ep.z, rand(-0.2, 0.2), airborne ? -6 : -1.5, rand(-0.2, 0.2), c, 1, airborne ? 0.4 : 0.18, 0.3, 0, 1, -0.5); }
    else if (e.kind === 'spark') { c.set(M.glowCol); PG.spawn(_ep.x + rand(-0.7, 0.7), _ep.y + rand(-1.2, 0.3), _ep.z + rand(-0.7, 0.7), rand(-2, 2), rand(-1, 2), rand(-2, 2), c, 1, 0.12, 0.25, 0, 3, 0); }
    else if (e.kind === 'petal') { c.set(0xff8ad8); PG.spawn(_ep.x + rand(-0.8, 0.8), _ep.y, _ep.z + rand(-0.8, 0.8), rand(-0.4, 0.4), -0.6, rand(-0.4, 0.4), c, 0.9, 0.16, 1.5, 0, 0.5, 0); }
    else if (e.kind === 'star') { c.set(Math.random() < 0.5 ? 0xffffff : M.glowCol.getHex()); PG.spawn(_ep.x + rand(-1, 1), _ep.y + rand(-1.5, 0.5), _ep.z + rand(-1, 1), 0, 0.3, 0, c, 1, rand(0.08, 0.2), rand(0.6, 1.2), 0, 0, 0); }
    else if (e.kind === 'glitch') { c.set(Math.random() < 0.5 ? 0x00ff66 : 0xff00ff); PG.spawn(_ep.x + rand(-0.8, 0.8), _ep.y + rand(-1, 1), _ep.z + rand(-0.8, 0.8), rand(-3, 3), 0, rand(-3, 3), c, 1, 0.2, 0.12, 0, 0, 0); }
    else { c.set(e.kind === 'gold' ? 0xffd700 : e.kind === 'void' ? 0xb04dff : e.kind === 'rainbow' ? new THREE.Color().setHSL(Math.random(), 1, 0.6).getHex() : 0xe0ffff); PG.spawn(_ep.x + rand(-0.6, 0.6), _ep.y + rand(-1.2, 1), _ep.z + rand(-0.6, 0.6), 0, rand(0.2, 0.8), 0, c, 1, rand(0.06, 0.16), rand(0.5, 1), 0, 0, 0); }
  }
}
