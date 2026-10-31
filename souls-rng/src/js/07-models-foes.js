// =====================================================================
//  MODELS — zombies, bosses, projectiles
// =====================================================================
function buildEnemy(type, skin, elite) {
  const T = ENEMY_TYPES[type];
  const ms = ownMat(skin.s, { r: 0.85, m: 0 }), mc = ownMat(skin.c, { r: 0.85 }), mc2 = ownMat(skin.c2, { r: 0.85 }), me = ownGlow(skin.e), mbone = ownMat(0xd8d0bc, { r: 0.7 }), mmet = ownMat(0x6a7480, { r: 0.35, m: 0.85 });
  const mats = [ms, mc, mc2, mbone, mmet];
  const root = new THREE.Group(), body = grp(root);
  const pt = { body, legL: null, legR: null, armL: null, armR: null, head: null, wings: null, hover: 0, extra: [] };
  let headY = 1.95, sh = 1.65;
  const rig = (o) => {
    const lg = o.leg ?? 0.85, lw = o.lw ?? 0.24, tw = o.tw ?? 0.66, th = o.th ?? 0.85, td = o.td ?? 0.4, al = o.al ?? 0.75, aw = o.aw ?? 0.2, hr = o.hr ?? 0.27;
    pt.legL = grp(body, -tw * 0.28, lg, 0); mesh(GB(lw, lg, lw * 1.1), mc2, 0, -lg / 2, 0, pt.legL); mesh(GB(lw * 1.1, 0.14, lw * 1.5), ms, 0, -lg + 0.07, 0.05, pt.legL);
    pt.legR = grp(body, tw * 0.28, lg, 0); mesh(GB(lw, lg * 0.92, lw * 1.1), mc2, 0, -lg / 2, 0, pt.legR); mesh(GB(lw * 1.1, 0.14, lw * 1.5), ms, 0, -lg + 0.07, 0.05, pt.legR);
    const tor = grp(body, 0, lg, 0); tor.rotation.x = o.hunch ?? 0.28; pt.torso = tor;
    mesh(GB(tw, th, td), mc, 0, th / 2, 0, tor);
    mesh(GB(tw * 0.35, th * 0.3, 0.03), ms, tw * 0.15, th * 0.45, td / 2 + 0.01, tor); mesh(GB(0.12, 0.18, 0.03), mc2, -tw * 0.2, th * 0.7, td / 2 + 0.01, tor);
    sh = th - 0.08;
    pt.armL = grp(tor, -tw / 2 - aw / 2, sh, 0); mesh(GB(aw, al, aw), ms, 0, -al / 2, 0, pt.armL); mesh(GB(aw * 1.15, al * 0.45, aw * 1.15), mc, 0, -al * 0.2, 0, pt.armL);
    pt.armR = grp(tor, tw / 2 + aw / 2, sh, 0); mesh(GB(aw, al, aw), ms, 0, -al / 2, 0, pt.armR); mesh(GB(aw * 1.15, al * 0.45, aw * 1.15), mc, 0, -al * 0.2, 0, pt.armR);
    pt.head = grp(tor, 0, th + 0.02, 0.08);
    if (skin.hat !== 'pumpkin') { mesh(GB(hr * 1.6, hr * 1.7, hr * 1.6), ms, 0, hr * 0.85, 0, pt.head); mesh(GB(hr * 1.2, hr * 0.3, 0.05), ownMat(0x2a0a0a), 0, hr * 0.4, hr * 0.8, pt.head); eyes(pt.head, me, hr * 1.05, hr * 0.81, hr * 0.32, hr * 0.17); }
    else { const pm = ownMat(0xff7a00, { r: 0.6 }); mats.push(pm); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; mesh(GS(hr * 0.95, 10, 8), pm, Math.cos(a) * hr * 0.4, hr, Math.sin(a) * hr * 0.4, pt.head).scale.set(0.9, 0.85, 0.9); } mesh(GK(hr * 0.25, hr * 0.4, 3), me, -hr * 0.4, hr * 1.15, hr * 1.12, pt.head); mesh(GK(hr * 0.25, hr * 0.4, 3), me, hr * 0.4, hr * 1.15, hr * 1.12, pt.head); mesh(GB(hr, hr * 0.2, 0.05), me, 0, hr * 0.6, hr * 1.15, pt.head); }
    headY = lg + th;
  };
  if (type === 'walker' || type === 'mini') { rig({}); pt.armR.position.y -= 0.05; }
  else if (type === 'runner') { rig({ leg: 1.0, lw: 0.18, tw: 0.5, th: 0.75, td: 0.32, al: 0.8, aw: 0.15, hunch: 0.6, hr: 0.24 }); }
  else if (type === 'brute') {
    rig({ leg: 0.75, lw: 0.34, tw: 1.0, th: 0.95, td: 0.6, al: 0.95, aw: 0.34, hunch: 0.35, hr: 0.22 });
    [pt.armL, pt.armR].forEach(a => mesh(GD(0.26), ms, 0, -0.98, 0, a));
    for (let i = 0; i < 4; i++) mesh(GK(0.06, 0.32, 5), mbone, rand(-0.35, 0.35), 0.6 + i * 0.1, -0.3, pt.torso, -1);
  }
  else if (type === 'spitter') { rig({ hunch: 0.15 }); const sac = mesh(GS(0.3, 12, 10), ownMat(skin.e, { r: 0.2, e: skin.e, ei: 0.6, op: 0.85 }), 0, 0.85, 0.22, pt.torso); pt.extra.push(t => sac.scale.setScalar(1 + Math.sin(t * 6) * 0.12)); }
  else if (type === 'exploder') { rig({ leg: 0.7, tw: 0.7, hunch: 0.1 }); const bel = mesh(GS(0.62, 16, 12), ownMat(skin.e, { r: 0.3, e: skin.e, ei: 0.5 }), 0, 0.35, 0.18, pt.torso); mats.push(bel.material); pt.belly = bel; for (let i = 0; i < 5; i++) mesh(GB(0.03, 0.4, 0.03), ownMat(0x3a0a0a), rand(-0.3, 0.3), 0.35, 0.78, pt.torso, 0, 0, rand(-1, 1)); }
  else if (type === 'crawler') {
    const tor = grp(body, 0, 0.35, 0); tor.rotation.x = 1.35; pt.torso = tor;
    mesh(GB(0.6, 0.8, 0.36), mc, 0, 0.4, 0, tor); mesh(GB(0.5, 0.25, 0.3), mc2, 0, -0.05, 0, tor);
    pt.head = grp(tor, 0, 0.82, 0.12); mesh(GB(0.42, 0.44, 0.42), ms, 0, 0.18, 0, pt.head); eyes(pt.head, me, 0.25, 0.22, 0.09, 0.05); pt.head.rotation.x = -1.1;
    pt.armL = grp(tor, -0.36, 0.7, 0); mesh(GB(0.16, 0.7, 0.16), ms, 0, -0.35, 0, pt.armL);
    pt.armR = grp(tor, 0.36, 0.7, 0); mesh(GB(0.16, 0.7, 0.16), ms, 0, -0.35, 0, pt.armR);
    pt.crawl = true; headY = 0.7;
  }
  else if (type === 'leaper') {
    rig({ leg: 1.1, lw: 0.18, tw: 0.55, th: 0.7, hunch: 0.7, al: 0.95, aw: 0.16 });
    [pt.armL, pt.armR].forEach(a => { for (let i = -1; i <= 1; i++) mesh(GK(0.03, 0.22, 4), mbone, i * 0.06, -1.02, 0.04, a, Math.PI); });
  }
  else if (type === 'phantom') {
    pt.hover = 0.5;
    const mr = ownMat(skin.c, { r: 0.8, op: 0.75, e: skin.e, ei: 0.15 }); mats.push(mr);
    mesh(GK(0.55, 1.6, 10, true), mr, 0, 0.9, 0, body, Math.PI);
    pt.torso = grp(body, 0, 1.4, 0);
    mesh(GK(0.38, 0.65, 10), mr, 0, 0.75, 0, pt.torso);
    pt.head = grp(pt.torso, 0, 0.45, 0.05); mesh(GS(0.25, 10, 8), ownMat(0x05030a), 0, 0.12, 0.05, pt.head); eyes(pt.head, me, 0.15, 0.25, 0.09, 0.05);
    pt.armL = grp(pt.torso, -0.38, 0.3, 0); mesh(GK(0.1, 0.8, 6), mr, 0, -0.4, 0, pt.armL, Math.PI);
    pt.armR = grp(pt.torso, 0.38, 0.3, 0); mesh(GK(0.1, 0.8, 6), mr, 0, -0.4, 0, pt.armR, Math.PI);
    headY = 2.1;
  }
  else if (type === 'shaman') {
    const mr = mc; mesh(GC(0.3, 0.62, 1.3, 10), mr, 0, 0.65, 0, body);
    pt.torso = grp(body, 0, 1.3, 0); mesh(GB(0.6, 0.6, 0.36), mc, 0, 0.3, 0, pt.torso);
    pt.head = grp(pt.torso, 0, 0.62, 0.05); mesh(GS(0.25, 12, 10), mbone, 0, 0.2, 0, pt.head); mesh(GS(0.07), ownMat(0x000000), -0.09, 0.22, 0.2, pt.head); mesh(GS(0.07), ownMat(0x000000), 0.09, 0.22, 0.2, pt.head); eyes(pt.head, me, 0.22, 0.24, 0.09, 0.035);
    for (let i = 0; i < 5; i++) mesh(GK(0.04, 0.4, 4), ownMat(pick([0xff3a3a, 0xffaa00, 0x3a8aff])), -0.2 + i * 0.1, 0.55, -0.1, pt.head, -0.3, 0, (i - 2) * 0.2);
    pt.armL = grp(pt.torso, -0.38, 0.5, 0); mesh(GB(0.16, 0.7, 0.16), ms, 0, -0.35, 0, pt.armL);
    pt.armR = grp(pt.torso, 0.38, 0.5, 0); mesh(GB(0.16, 0.7, 0.16), ms, 0, -0.35, 0, pt.armR);
    const st = grp(pt.armR, 0, -0.7, 0.05); mesh(GC(0.03, 0.03, 1.8, 5), ownMat(0x5a3a1a), 0, 0.3, 0, st); const orb = mesh(GS(0.13), me, 0, 1.25, 0, st); orb.add(glowSprite(new THREE.Color(skin.e).getHex(), 1, 0.8));
    headY = 2.2;
  }
  else if (type === 'armored') {
    rig({ tw: 0.75, td: 0.46, hunch: 0.15 });
    mesh(GB(0.82, 0.6, 0.52), mmet, 0, 0.55, 0.02, pt.torso);
    for (const s of [-1, 1]) mesh(GS(0.22, 10, 8), mmet, s * 0.45, 0.82, 0, pt.torso).scale.set(1.2, 0.7, 1.2);
    mesh(GC(0.3, 0.3, 0.42, 10), mmet, 0, 0.3, 0, pt.head); mesh(GB(0.4, 0.05, 0.05), me, 0, 0.32, 0.3, pt.head);
  }
  else if (type === 'splitter') {
    rig({ tw: 0.85, th: 0.8, hunch: 0.2 });
    const bl = mesh(GS(0.62, 14, 12), mc, 0, 0.45, 0, pt.torso); mesh(GT(0.6, 0.05, 6, 24), me, 0, 0.45, 0, pt.torso, Math.PI / 2);
    const h2 = grp(pt.torso, 0.35, 0.9, 0.05); mesh(GB(0.34, 0.36, 0.34), ms, 0, 0.18, 0, h2); eyes(h2, me, 0.22, 0.18, 0.07, 0.04); pt.head.position.x = -0.25;
  }
  else if (type === 'bat') {
    pt.hover = 0;
    const bm = mesh(GS(0.32, 12, 10), mc, 0, 0, 0, body); bm.scale.set(1, 1.1, 1.2);
    pt.head = grp(body, 0, 0.32, 0.18); mesh(GS(0.22, 10, 8), mc, 0, 0, 0, pt.head); mesh(GK(0.08, 0.25, 4), mc, -0.13, 0.2, 0, pt.head); mesh(GK(0.08, 0.25, 4), mc, 0.13, 0.2, 0, pt.head); eyes(pt.head, me, 0.04, 0.18, 0.08, 0.045);
    pt.wings = [];
    for (const s of [-1, 1]) { const w = grp(body, s * 0.25, 0.05, 0); const sh2 = new THREE.Shape(); sh2.moveTo(0, 0); sh2.lineTo(s * 1.1, 0.35); sh2.lineTo(s * 0.9, -0.2); sh2.lineTo(s * 0.55, 0); sh2.lineTo(s * 0.35, -0.3); sh2.lineTo(0, -0.15); const wm = mesh(new THREE.ShapeGeometry(sh2), ownMat(skin.c2, { r: 0.7, side: true }), 0, 0, 0, w, Math.PI / 2); mats.push(wm.material); pt.wings.push([w, s]); }
    headY = 0.5;
  }
  // ---- hats / biome flair ----
  const H = pt.head, hr = 0.27, hy = 0.5;
  const hat = skin.hat;
  if (H && type !== 'bat') {
    if (hat === 'santa') { mesh(GT(0.24, 0.06, 6, 14), mbone, 0, hy, 0, H, Math.PI / 2); mesh(GK(0.24, 0.45, 10), ownMat(0xc0392b), 0, hy + 0.22, -0.05, H, -0.35); mesh(GS(0.07), mbone, 0, hy + 0.38, -0.2, H); }
    else if (hat === 'leaves') { for (let i = 0; i < 5; i++) mesh(GI(0.12), matStd(0x2a9a2a, { flat: true }), rand(-0.2, 0.2), hy + rand(-0.02, 0.08), rand(-0.2, 0.2), H).scale.set(1.3, 0.5, 1); }
    else if (hat === 'moss') { for (let i = 0; i < 4; i++) mesh(GI(0.11), matStd(0x4a7a2a, { flat: true }), rand(-0.2, 0.2), hy - 0.05, rand(-0.2, 0.2), H).scale.set(1.4, 0.4, 1.2); }
    else if (hat === 'visor') { mesh(GB(0.48, 0.1, 0.48), me, 0, 0.3, 0.02, H); }
    else if (hat === 'horns') { for (const s of [-1, 1]) mesh(GK(0.05, 0.3, 5), ownMat(0x1a0a0a), s * 0.17, hy + 0.08, 0, H, 0, 0, s * -0.4); }
    else if (hat === 'hood') { mesh(GK(0.36, 0.7, 10, true), mc2, 0, hy - 0.05, -0.05, H, 0.15); }
    else if (hat === 'halo') { mesh(GT(0.2, 0.025, 6, 20), ownGlow(skin.e), 0, hy + 0.25, 0, H, Math.PI / 2); }
    else if (hat === 'helmet') { mesh(GS(0.3, 12, 8), mmet, 0, hy - 0.12, 0, H).scale.set(1, 0.6, 1); mesh(GB(0.06, 0.06, 0.06), me, 0, hy + 0.05, 0.25, H); }
    else if (hat === 'wrap') { for (let i = 0; i < 5; i++) mesh(GT(0.24 + (i % 2) * 0.02, 0.035, 4, 14), mbone, 0, 0.1 + i * 0.09, 0, H, Math.PI / 2 + rand(-0.2, 0.2)); if (pt.torso) for (let i = 0; i < 4; i++) mesh(GB(0.72, 0.05, 0.44), mbone, 0, 0.15 + i * 0.2, 0, pt.torso, 0, 0, rand(-0.25, 0.25)); }
    else if (hat === 'beanie') { mesh(GS(0.25, 10, 8), ownMat(pick([0x3a6aff, 0xff3a3a, 0x2ecc71])), 0, hy - 0.08, 0, H).scale.set(1, 0.7, 1); mesh(GS(0.07), mbone, 0, hy + 0.12, 0, H); }
    else if (hat === 'mask') { mesh(GB(0.3, 0.2, 0.12), ownMat(0x1a1a1a), 0, 0.15, 0.26, H); mesh(GC(0.06, 0.06, 0.1, 8), me, 0, 0.12, 0.34, H, Math.PI / 2); }
    else if (hat === 'headphones') { mesh(GT(0.26, 0.03, 6, 16, Math.PI), ownMat(0x1a1a2a), 0, 0.28, 0, H); for (const s of [-1, 1]) mesh(GC(0.09, 0.09, 0.08, 10), me, s * 0.26, 0.25, 0, H, 0, 0, Math.PI / 2); }
    else if (hat === 'crystal') { for (let i = 0; i < 3; i++) mesh(GO(0.1), ownMat(0xaaffff, { e: 0x66ccff, ei: 0.5, flat: true }), -0.12 + i * 0.12, hy + 0.05, -0.05, H).scale.set(0.6, 1.8, 0.6); }
    else if (hat === 'flame') { pt.flame = true; }
    else if (hat === 'snorkel') { mesh(GB(0.4, 0.14, 0.06), ownAdd(0x7af8ff, 0.5), 0, 0.3, 0.26, H); mesh(GC(0.03, 0.03, 0.45, 5), ownMat(0xffaa00), 0.18, 0.5, 0.15, H); }
    else if (hat === 'flower') { for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; mesh(GS(0.06, 6, 4), ownMat(pick([0xff4a8a, 0xffe600, 0xff8a00])), Math.cos(a) * 0.3, -0.05, Math.sin(a) * 0.25, H); } }
    else if (hat === 'witch') { mesh(GC(0.38, 0.38, 0.03, 14), ownMat(0x1a0a2a), 0, hy - 0.04, 0, H); mesh(GK(0.2, 0.5, 10), ownMat(0x1a0a2a), 0, hy + 0.2, -0.04, H, -0.2); }
  }
  if (elite) { root.scale.setScalar(1.3); const ring = mesh(GT(0.9, 0.04, 6, 32), ownGlow(0xffaa00), 0, 0.08, 0, root, Math.PI / 2); pt.extra.push(t => ring.rotation.z = t * 2); mats.forEach(m => { if (m.emissive) { m.emissive.set(0x3a2000); m.userData.baseE = 0x3a2000; } }); }
  root.traverse(o => { if (o.isMesh) o.castShadow = false; });
  if (!T.fly) { const bl = new THREE.Mesh(GP(1, 1), blobShadowMat()); bl.rotation.x = -Math.PI / 2; bl.position.y = 0.04; const r = T.r * 3.2; bl.scale.set(r, r, 1); bl.renderOrder = 1; root.add(bl); }
  return { group: root, parts: pt, mats, h: headY + 0.5 };
}

let _blobMat = null;
function blobShadowMat() { return _blobMat || (_blobMat = new THREE.MeshBasicMaterial({ map: GLOW_TEX, color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false })); }
function animateEnemy(e, dt, t) {
  const p = e.model.parts, sp = e.moving;
  e.walk = (e.walk || 0) + dt * (3 + e.spd * 1.2) * sp;
  const s = Math.sin(e.walk);
  if (p.legL) { p.legL.rotation.x = s * 0.6; p.legR.rotation.x = -s * 0.6; }
  if (p.crawl) { p.armL.rotation.x = -1.6 + s * 0.6; p.armR.rotation.x = -1.6 - s * 0.6; p.body.position.y = Math.abs(s) * 0.05; }
  else if (p.armL) {
    const atk = e.atkAnim > 0 ? Math.sin(e.atkAnim * 10) * 0.8 : 0;
    p.armL.rotation.x = -1.35 + Math.sin(e.walk * 0.5 + 1) * 0.15 - atk; p.armR.rotation.x = -1.25 + Math.sin(e.walk * 0.5) * 0.15 - atk;
  }
  if (p.torso && !p.crawl && e.type !== 'phantom' && e.type !== 'shaman') p.torso.rotation.z = Math.sin(e.walk * 0.5) * 0.08;
  if (p.hover) p.body.position.y = p.hover + Math.sin(t * 2.4 + e.seed) * 0.15;
  if (p.wings) p.wings.forEach(([w, si]) => w.rotation.z = si * Math.sin(t * 18 + e.seed) * 0.7);
  if (p.belly) { const k = 1 + Math.sin(t * (e.fuse > 0 ? 30 : 5)) * (e.fuse > 0 ? 0.12 : 0.05); p.belly.scale.setScalar(k); }
  for (const f of p.extra) f(t);
  if (p.flame && Math.random() < 0.3 * R.partMul) { _ep.set(0, 0.5, 0); p.head.localToWorld(_ep); FX.c.set(Math.random() < 0.5 ? 0xff6a00 : 0xffee00); PG.spawn(_ep.x, _ep.y, _ep.z, rand(-0.3, 0.3), rand(1, 2.5), rand(-0.3, 0.3), FX.c, 1, 0.3, 0.4, 0, 1, -0.5); }
}

// ---------------- bosses ----------------
function buildBoss(def) {
  const g = new THREE.Group(), body = grp(g), mats = [];
  const M = (c, o = {}) => { const m = ownMat(c, o); mats.push(m); return m; };
  const Gl = c => ownGlow(c);
  const B = { group: g, body, mats, eye: new THREE.Object3D(), heads: [], anim: null, h: 7, parts: {} };
  const eyeAt = (x, y, z, par) => { B.eye.position.set(x, y, z); (par || body).add(B.eye); };
  const t0 = rand(0, 10);
  switch (def.model) {
    case 'santa': {
      const red = M(0xc81e28, { r: 0.6 }), white = M(0xf4f4f4, { r: 0.9 }), skin = M(0xf0c0a0, { r: 0.7 }), blk = M(0x151515, { r: 0.4, m: 0.4 });
      mesh(GS(1.9, 24, 18), red, 0, 2.8, 0, body).scale.set(1, 1.05, 0.95);
      mesh(GT(1.7, 0.3, 8, 30), white, 0, 1.25, 0, body, Math.PI / 2); mesh(GC(1.88, 1.88, 0.3, 24), blk, 0, 2.5, 0, body); mesh(GB(0.6, 0.5, 0.1), M(0xffd700, { m: 1, r: 0.2 }), 0, 2.5, 1.85, body);
      const head = grp(body, 0, 4.9, 0.2); mesh(GS(0.85, 18, 14), skin, 0, 0, 0, head); mesh(GK(0.9, 1.5, 14), white, 0, -0.8, 0.45, head, Math.PI + 0.25); mesh(GS(0.18), M(0xff6a7a), 0, 0.05, 0.85, head);
      eyes(head, Gl(0xff2020), 0.25, 0.75, 0.3, 0.12); mesh(GB(0.3, 0.06, 0.06), blk, -0.3, 0.45, 0.78, head, 0, 0, -0.4); mesh(GB(0.3, 0.06, 0.06), blk, 0.3, 0.45, 0.78, head, 0, 0, 0.4);
      mesh(GT(0.85, 0.2, 8, 24), white, 0, 0.6, 0, head, Math.PI / 2); mesh(GK(0.85, 1.8, 14), red, 0.3, 1.4, -0.3, head, -0.5, 0, -0.3); mesh(GS(0.28), white, 0.75, 2.0, -1.0, head);
      for (const s of [-1, 1]) { const a = grp(body, s * 1.9, 3.6, 0); mesh(GC(0.4, 0.35, 2, 10), red, 0, -1, 0, a); mesh(GT(0.4, 0.12, 6, 14), white, 0, -1.9, 0, a, Math.PI / 2); mesh(GS(0.45), blk, 0, -2.2, 0, a); a.rotation.z = s * 0.4; B.parts['arm' + s] = a; }
      for (const s of [-1, 1]) mesh(GC(0.45, 0.55, 1.2, 10), blk, s * 0.8, 0.6, 0, body);
      const sack = mesh(GS(1.4, 14, 12), M(0x8a5a2a, { r: 0.9 }), 0, 3.5, -1.9, body); sack.scale.set(1, 1.2, 0.8);
      for (let i = 0; i < 4; i++) mesh(GB(0.5, 0.5, 0.5), Gl(pick([0xff3355, 0x33ff66, 0x3399ff, 0xffe600])), rand(-0.7, 0.7), 4.6 + rand(0, 0.4), -1.9 + rand(-0.3, 0.3), body, rand(0, 1), rand(0, 1), 0);
      eyeAt(0, 4.9, 1.2); B.h = 7.4; B.anim = (t) => { body.rotation.z = Math.sin(t * 2) * 0.04; head.rotation.y = Math.sin(t * 0.7) * 0.2; B.parts['arm1'].rotation.x = Math.sin(t * 2) * 0.3; B.parts['arm-1'].rotation.x = -Math.sin(t * 2) * 0.3; };
      break;
    }
    case 'gorilla': {
      const fur = M(0x2a2420, { r: 0.95 }), chest = M(0x5a4a40, { r: 0.8 }), face = M(0x3a3030, { r: 0.7 });
      const tor = grp(body, 0, 3, 0); tor.rotation.x = 0.4; mesh(GS(2, 18, 14), fur, 0, 0.8, 0, tor).scale.set(1.15, 1, 0.9); mesh(GS(1.3, 14, 12), chest, 0, 0.6, 1.0, tor).scale.set(1, 1.1, 0.5);
      const head = grp(tor, 0, 2.6, 0.6); mesh(GS(0.85, 14, 12), fur, 0, 0, 0, head); mesh(GS(0.6, 12, 10), face, 0, -0.15, 0.55, head).scale.set(1, 0.8, 0.7); eyes(head, Gl(0xffcc00), 0.15, 0.75, 0.28, 0.1); mesh(GB(1.1, 0.18, 0.3), fur, 0, 0.35, 0.6, head);
      for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.4; mesh(GK(0.12, 0.6, 4), M(0x3aff3a, { e: 0x0a5a0a, ei: 0.5 }), Math.sin(a) * 0.7, 0.8, Math.cos(a) * 0.3 - 0.2, head, 0, 0, -a * 0.4); }
      for (const s of [-1, 1]) { const a = grp(tor, s * 2.2, 1.6, 0.3); mesh(GC(0.6, 0.5, 2.8, 10), fur, 0, -1.4, 0, a); mesh(GS(0.75, 12, 10), face, 0, -3, 0, a); a.rotation.x = -0.3; B.parts['arm' + s] = a; }
      for (const s of [-1, 1]) mesh(GC(0.55, 0.6, 1.6, 10), fur, s * 1.0, 0.8, -0.3, body);
      eyeAt(0, 5.4, 1.6); B.h = 7; B.anim = t => { B.parts.arm1.rotation.x = -0.3 + Math.sin(t * 2.5) * 0.25; B.parts['arm-1'].rotation.x = -0.3 - Math.sin(t * 2.5) * 0.25; tor.rotation.z = Math.sin(t * 1.3) * 0.05; };
      break;
    }
    case 'house': {
      const wood = M(0x5a3a2a, { r: 0.9 }), roof = M(0x2a1a2a, { r: 0.8 }), trim = M(0x2a1a14, { r: 0.9 });
      mesh(GB(5.5, 4.2, 4.6), wood, 0, 2.6, 0, body); for (let i = 0; i < 7; i++) mesh(GB(5.6, 0.08, 4.7), trim, 0, 0.8 + i * 0.6, 0, body);
      const rf = mesh(GK(4.6, 2.8, 4), roof, 0, 6.1, 0, body, 0, Math.PI / 4, 0); rf.scale.set(1.15, 1, 1);
      mesh(GB(0.8, 2, 0.8), M(0x3a2a2a), 1.5, 6.5, -0.8, body);
      const wl = Gl(0xffcc33); const ey = [];
      for (const s of [-1, 1]) { mesh(GB(1.3, 1.2, 0.1), wl, s * 1.4, 3.4, 2.32, body); const pu = mesh(GS(0.32, 10, 8), M(0x000000), s * 1.4, 3.4, 2.4, body); ey.push(pu); mesh(GB(1.5, 0.12, 0.15), trim, s * 1.4, 4.1, 2.35, body, 0, 0, s * 0.3); }
      mesh(GB(1.6, 1.6, 0.1), M(0x050005), 0, 1.2, 2.32, body);
      for (let i = 0; i < 5; i++) { mesh(GK(0.14, 0.4, 4), M(0xf0f0e0), -0.6 + i * 0.3, 1.85, 2.4, body, Math.PI); mesh(GK(0.14, 0.4, 4), M(0xf0f0e0), -0.6 + i * 0.3, 0.55, 2.4, body); }
      const tongue = mesh(GB(0.8, 0.1, 1.2), M(0xaa2244), 0, 0.6, 2.8, body);
      eyeAt(0, 3.4, 2.5); B.h = 7.5; B.anim = (t, dt, bs) => { ey.forEach(p => { p.position.x = Math.sign(p.position.x) * 1.4 + Math.sin(t * 1.5) * 0.25; }); tongue.rotation.x = Math.sin(t * 4) * 0.2; if (Math.random() < 0.3 && PS) { _ep.set(1.5, 7.6, -0.8); body.localToWorld(_ep); FX.c.set(0x3a3a4a); PS.spawn(_ep.x, _ep.y, _ep.z, rand(-0.3, 0.3), 1.5, rand(-0.3, 0.3), FX.c, 0.5, 1.2, 2, -0.2, 0.5, 2); } };
      break;
    }
    case 'hydra': case 'serpent': {
      const isS = def.model === 'serpent';
      const sc = M(isS ? 0x2a0a4a : 0x2a6a2a, { r: 0.4, m: 0.3 }), bel = M(isS ? 0xaa00ff : 0x9aca5a, { r: 0.5, e: isS ? 0x5a00aa : 0x000000, ei: 0.5 }), ey = Gl(isS ? 0x00ffff : 0xffee00);
      if (!isS) {
        const coil = mesh(GT(2.2, 1.0, 12, 28), sc, 0, 1, 0, body, Math.PI / 2); mesh(GS(1.6, 14, 12), sc, 0, 1.6, 0, body);
        for (let h = 0; h < 3; h++) {
          const neck = grp(body, (h - 1) * 1.3, 2.2, 0.3), segs = [];
          for (let i = 0; i < 6; i++) { const sg = mesh(GS(0.55 - i * 0.04, 10, 8), i % 2 ? bel : sc, 0, 0, 0, neck); segs.push(sg); }
          const hd = grp(neck); mesh(GB(1, 0.7, 1.4), sc, 0, 0, 0.3, hd); mesh(GB(0.8, 0.25, 1.0), bel, 0, -0.35, 0.4, hd); eyes(hd, ey, 0.25, 0.75, 0.32, 0.1); for (const s of [-1, 1]) mesh(GK(0.06, 0.4, 4), M(0xffffff), s * 0.25, -0.4, 0.9, hd, Math.PI);
          for (const s of [-1, 1]) mesh(GK(0.1, 0.6, 5), M(0x1a3a1a), s * 0.3, 0.45, -0.2, hd, -0.7);
          B.heads.push({ neck, segs, hd, i: h, ang: (h - 1) * 0.5 });
        }
        eyeAt(0, 6, 1.5); B.h = 7.5;
        B.anim = (t) => { B.heads.forEach(H => { const a = H.ang + Math.sin(t * 1.3 + H.i * 2) * 0.25; for (let i = 0; i < H.segs.length; i++) { const k = i / H.segs.length; H.segs[i].position.set(Math.sin(a) * k * 2.5 + Math.sin(t * 2 + i * 0.5 + H.i) * 0.2, k * 4.2, Math.cos(a) * k * 1.2 + 0.3); } H.hd.position.set(Math.sin(a) * 2.5 + Math.sin(t * 2 + 3 + H.i) * 0.2, 4.5, Math.cos(a) * 1.2 + 0.6); H.hd.rotation.set(0.25 + Math.sin(t * 2.2 + H.i) * 0.15, a * 0.6, 0); }); };
      } else {
        const hd = grp(body, 0, 0, 0); mesh(GB(1.4, 1.0, 2.0), sc, 0, 0, 0.4, hd); mesh(GB(1.2, 0.35, 1.6), bel, 0, -0.5, 0.5, hd); eyes(hd, ey, 0.3, 1.2, 0.45, 0.14);
        for (const s of [-1, 1]) { mesh(GK(0.15, 1.2, 5), M(0xd0c0ff, { e: 0x5a00aa, ei: 0.4 }), s * 0.5, 0.7, -0.5, hd, -1.0, 0, s * 0.3); mesh(GK(0.07, 0.5, 4), M(0xffffff), s * 0.4, -0.6, 1.3, hd, Math.PI); }
        const segs = []; for (let i = 0; i < 16; i++) { const r = 1.0 - i * 0.045; const sg = new THREE.Group(); mesh(GS(r, 12, 10), sc, 0, 0, 0, sg); mesh(GT(r * 0.9, 0.08, 6, 18), bel, 0, 0, 0, sg); mesh(GK(0.15, 0.6, 4), M(0xd0c0ff, { e: 0x5a00aa, ei: 0.3 }), 0, r * 0.9, 0, sg); segs.push(sg); g.add(sg); }
        B.serpent = { hd, segs, hist: [] }; eyeAt(0, 0.2, 1.5, hd); B.h = 2;
        B.anim = (t) => { segs.forEach((sg, i) => sg.children[1].rotation.y = t + i); };
      }
      break;
    }
    case 'kaiju': {
      const sk = M(0x1a2a2a, { r: 0.6, m: 0.4 }), pl = M(0x00f0ff, { e: 0x00f0ff, ei: 0.3, r: 0.2 }), bel = M(0x3a4a4a, { r: 0.7 });
      const tor = grp(body, 0, 3.2, 0); tor.rotation.x = -0.35; mesh(GS(1.8, 16, 14), sk, 0, 0, 0, tor).scale.set(1, 1.35, 1); mesh(GS(1.3, 12, 10), bel, 0, -0.2, 0.7, tor).scale.set(1, 1.3, 0.6);
      const head = grp(tor, 0, 2.6, 0.7); mesh(GB(1.2, 1.0, 1.6), sk, 0, 0, 0.3, head); const jaw = grp(head, 0, -0.4, -0.2); mesh(GB(1.1, 0.35, 1.5), sk, 0, 0, 0.6, jaw); eyes(head, Gl(0xff2a6a), 0.25, 1.0, 0.4, 0.1); for (let i = 0; i < 6; i++) mesh(GK(0.06, 0.25, 4), M(0xffffff), -0.4 + i * 0.16, -0.3, 1.0, head, Math.PI);
      const plates = []; for (let i = 0; i < 8; i++) { const p = mesh(GK(0.35 - i * 0.02, 1.0 - i * 0.06, 4), pl, 0, 1.6 - i * 0.55, -1.5 + i * 0.05, tor, -0.5 - i * 0.1); plates.push(p); }
      for (const s of [-1, 1]) { const a = grp(tor, s * 1.6, 1.0, 0.6); mesh(GC(0.3, 0.25, 1.4, 8), sk, 0, -0.7, 0.3, a, 0.5); for (let k = 0; k < 3; k++) mesh(GK(0.06, 0.3, 4), M(0xffffff), (k - 1) * 0.12, -1.4, 0.7, a, 2); }
      for (const s of [-1, 1]) mesh(GC(0.7, 0.8, 2.4, 10), sk, s * 1.1, 1.2, -0.2, body);
      const tail = grp(body, 0, 2, -1.8); const tsg = []; for (let i = 0; i < 7; i++) { const sg = mesh(GK(0.8 - i * 0.1, 1.4, 8), sk, 0, 0, -i * 1.1, tail, -Math.PI / 2); tsg.push(sg); mesh(GK(0.15, 0.5, 4), pl, 0, 0.6 - i * 0.05, -i * 1.1, tail); }
      eyeAt(0, 0.1, 1.4, head); B.h = 8; B.plates = plates;
      B.anim = (t, dt, bs) => { tail.rotation.y = Math.sin(t * 1.5) * 0.4; jaw.rotation.x = bs && bs.charging ? 0.5 : Math.sin(t * 3) * 0.05; const k = bs && bs.charging ? 1 + Math.sin(t * 30) * 0.5 : 0.3; pl.emissiveIntensity = k; };
      break;
    }
    case 'eye': {
      const wh = M(0xf4eedd, { r: 0.3, e: 0x331100, ei: 0.2 }), tw = M(0x0a0505, { r: 0.5, m: 0.6 });
      const eye = grp(body, 0, 6.5, 0); mesh(GS(2.3, 28, 22), wh, 0, 0, 0, eye);
      const iris = mesh(GS(1.2, 20, 14), Gl(0xff5a00), 0, 0, 1.55, eye); iris.scale.set(1, 1, 0.5); mesh(GB(0.25, 1.8, 0.4), M(0x000000), 0, 0, 2.15, eye);
      mesh(GT(1.25, 0.12, 8, 30), Gl(0xffcc00), 0, 0, 1.75, eye);
      const corona = []; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; const c = mesh(GK(0.35, 1.6, 6), ownAdd(0xff5a00, 0.7), Math.cos(a) * 2.6, Math.sin(a) * 2.6, -0.3, eye, 0, 0, a - Math.PI / 2); corona.push(c); }
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; mesh(GK(0.45, 4.5, 6), tw, Math.cos(a) * 1.5, 2.4, Math.sin(a) * 1.5, body, Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3); }
      mesh(GC(1.2, 2.2, 2.5, 8), tw, 0, 1.25, 0, body);
      eyeAt(0, 0, 2.3, eye); B.h = 9; B.eyeG = eye;
      B.anim = (t) => { corona.forEach((c, i) => c.scale.y = 1 + Math.sin(t * 6 + i) * 0.3); eye.position.y = 6.5 + Math.sin(t * 1.4) * 0.3; };
      B.trackEye = eye;
      break;
    }
    case 'king': case 'angel': case 'empress': case 'pharaoh': case 'reaper': case 'overlord': case 'wraith': case 'pumpkinking': {
      const m = def.model;
      const pal = { king: [0x6a0a14, 0x2a2a30, 0xff0040], angel: [0xfff0d0, 0xffcc33, 0xff6a00], empress: [0x1a0a2a, 0x3a0a5a, 0xb04dff], pharaoh: [0xe8e0c8, 0x1a3a8a, 0x00ffaa], reaper: [0x101014, 0x2a2a2a, 0x7cff4d], overlord: [0x14102a, 0x2a1a4a, 0xff00ff], wraith: [0x0a0614, 0x1a0a2a, 0xa000ff], pumpkinking: [0x3a1a4a, 0x2a1a10, 0xff7a00] }[m];
      const A = M(pal[0], { r: 0.5, m: m === 'king' || m === 'overlord' ? 0.7 : 0.2 }), Bm = M(pal[1], { r: 0.4, m: 0.6 }), gl = Gl(pal[2]), gold = M(0xffcc33, { r: 0.2, m: 1, e: 0x553300, ei: 0.4 });
      const floaty = m !== 'king' && m !== 'pharaoh' && m !== 'pumpkinking';
      const robe = mesh(GC(0.9, 2.0, 4, 16, m === 'wraith' || m === 'reaper'), A, 0, 2, 0, body);
      if (m === 'wraith' || m === 'reaper') { robe.material.side = THREE.DoubleSide; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; mesh(GK(0.3, 1.2, 4), A, Math.cos(a) * 1.8, 0.1, Math.sin(a) * 1.8, body, Math.PI); } }
      const tor = grp(body, 0, 4.3, 0); mesh(GB(1.9, 1.6, 1.1), m === 'king' ? Bm : A, 0, 0.2, 0, tor); mesh(GB(0.3, 1.4, 0.05), gl, 0, 0.2, 0.56, tor);
      const head = grp(tor, 0, 1.6, 0);
      if (m === 'king') { mesh(GC(0.55, 0.6, 1.0, 14), Bm, 0, 0, 0, head); mesh(GB(0.8, 0.12, 0.12), gl, 0, 0.1, 0.55, head); mesh(GC(0.6, 0.55, 0.4, 10, true), gold, 0, 0.7, 0, head); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; mesh(GK(0.1, 0.45, 4), gold, Math.cos(a) * 0.58, 1.05, Math.sin(a) * 0.58, head); } }
      else if (m === 'angel') { mesh(GS(0.55, 14, 12), M(0xf0d0b0), 0, 0, 0, head); eyes(head, gl, 0.05, 0.48, 0.18, 0.08); mesh(GT(0.7, 0.07, 8, 32), Gl(0xfff0a0), 0, 0.9, -0.1, head, Math.PI / 2.4); }
      else if (m === 'empress') { mesh(GS(0.5, 14, 12), M(0x2a1a3a, { e: 0x5a00aa, ei: 0.3 }), 0, 0, 0, head); eyes(head, gl, 0.05, 0.45, 0.17, 0.08); for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2; mesh(GK(0.08, 0.9, 4), gl, Math.sin(a) * 0.45, 0.7, -0.1, head, 0, 0, -a * 0.6); } }
      else if (m === 'pharaoh') { mesh(GB(0.9, 1.0, 0.9), gold, 0, 0, 0, head); mesh(GB(1.4, 1.3, 0.5), M(0x1a3a8a), 0, -0.2, -0.4, head); for (let i = 0; i < 5; i++) mesh(GB(1.42, 0.08, 0.52), gold, 0, -0.75 + i * 0.3, -0.4, head); eyes(head, gl, 0.1, 0.46, 0.2, 0.08); mesh(GC(0.06, 0.12, 0.6, 6), gold, 0, -0.8, 0.4, head); mesh(GK(0.15, 0.4, 6), M(0x00aa66), 0, 0.65, 0.4, head); }
      else if (m === 'reaper') { mesh(GS(0.5, 14, 12), M(0xe8e0d0), 0, 0, 0.1, head); mesh(GS(0.13), M(0x000000), -0.17, 0.05, 0.52, head); mesh(GS(0.13), M(0x000000), 0.17, 0.05, 0.52, head); eyes(head, gl, 0.05, 0.6, 0.17, 0.06); mesh(GK(0.85, 1.6, 12, true), A, 0, 0.2, -0.1, head).material.side = THREE.DoubleSide; }
      else if (m === 'overlord') { mesh(GB(0.9, 1.0, 0.9), Bm, 0, 0, 0, head); mesh(GB(0.95, 0.2, 0.95), gl, 0, 0.1, 0, head); for (let i = 0; i < 5; i++) mesh(GB(0.12, 0.6, 0.12), gl, -0.5 + i * 0.25, 0.75, 0, head); }
      else if (m === 'wraith') { mesh(GK(0.85, 1.8, 12, true), A, 0, 0.2, -0.1, head).material.side = THREE.DoubleSide; mesh(GS(0.45, 12, 10), M(0x000000), 0, 0, 0.1, head); eyes(head, gl, 0.05, 0.48, 0.17, 0.09); }
      else if (m === 'pumpkinking') { const pm = M(0xff7a00, { r: 0.6, e: 0x331000, ei: 0.4 }); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; mesh(GS(0.95, 14, 12), pm, Math.cos(a) * 0.5, 0.3, Math.sin(a) * 0.5, head).scale.set(0.85, 0.85, 0.85); } const fg = Gl(0xffcc00); mesh(GK(0.28, 0.4, 3), fg, -0.45, 0.55, 1.2, head); mesh(GK(0.28, 0.4, 3), fg, 0.45, 0.55, 1.2, head); for (let i = 0; i < 6; i++) mesh(GK(0.12, 0.3, 3), fg, -0.6 + i * 0.24, -0.05, 1.25, head, i % 2 ? 0 : Math.PI); mesh(GC(0.6, 0.55, 0.45, 10, true), gold, 0, 1.25, 0, head); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; mesh(GK(0.1, 0.4, 4), gold, Math.cos(a) * 0.58, 1.6, Math.sin(a) * 0.58, head); } }
      // arms
      for (const s of [-1, 1]) {
        const a = grp(tor, s * 1.15, 0.8, 0); mesh(GC(0.28, 0.22, 2.0, 8), m === 'king' ? Bm : A, 0, -1, 0, a); mesh(GS(0.3), m === 'pharaoh' ? gold : Bm, 0, -2.05, 0, a); a.rotation.z = s * 0.35; B.parts['arm' + s] = a;
        if (m === 'wraith') for (let k = -1; k <= 1; k++) mesh(GK(0.06, 0.8, 4), gl, k * 0.12, -2.5, 0.2, a, Math.PI - 0.3);
      }
      const hand = B.parts.arm1;
      if (m === 'king') { const sw = grp(hand, 0, -2.1, 0.3); sw.rotation.x = -1.2; mesh(GB(0.3, 4.5, 0.1), M(0xd0d8e0, { r: 0.1, m: 1, e: 0xff0040, ei: 0.3 }), 0, 2.4, 0, sw); mesh(GB(0.1, 4.2, 0.12), gl, 0, 2.4, 0, sw); mesh(GB(1.2, 0.2, 0.2), gold, 0, 0.2, 0, sw); const cape = mesh(new THREE.PlaneGeometry(3, 4.5), M(0xaa0022, { side: true, r: 0.7 }), 0, 2.4, -0.7, body); B.parts.cape = cape; }
      if (m === 'angel') { const sp = grp(hand, 0, -2.1, 0); sp.rotation.x = -1.4; mesh(GC(0.06, 0.06, 5, 6), gold, 0, 1.5, 0, sp); mesh(GK(0.25, 0.9, 6), gl, 0, 4.3, 0, sp); B.wings = []; for (let i = 0; i < 4; i++) { const s = i % 2 ? 1 : -1, row = i >> 1; const w = grp(tor, s * 0.5, 0.6 - row * 0.9, -0.6); const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(s * 4, 1.6 - row); sh.lineTo(s * 3.2, -0.4); sh.lineTo(s * 1.8, -1); sh.lineTo(0, -0.4); mesh(new THREE.ShapeGeometry(sh), ownAdd(row ? 0xff6a00 : 0xffcc33, 0.7), 0, 0, 0, w).castShadow = false; B.wings.push([w, s]); } }
      if (m === 'pharaoh') { const st = grp(hand, 0, -2.1, 0); mesh(GC(0.08, 0.08, 4.5, 6), gold, 0, 0.8, 0, st); mesh(GT(0.35, 0.08, 6, 16), gold, 0, 3.4, 0, st); mesh(GS(0.25), gl, 0, 3.1, 0, st); for (let i = 0; i < 4; i++) mesh(GB(2.3, 0.1, 1.2), M(0xe8e0c8), 0, -1 + i * 0.4, 0, tor, 0, 0, rand(-0.2, 0.2)); }
      if (m === 'reaper') { const sc = grp(hand, 0, -2.1, 0); sc.rotation.x = -0.4; mesh(GC(0.07, 0.07, 6, 6), M(0x2a1a10), 0, 1.5, 0, sc); mesh(GT(1.6, 0.15, 4, 20, Math.PI * 0.75), M(0xd0d8e0, { r: 0.1, m: 1, e: 0x2a7a2a, ei: 0.5 }), -1.3, 4.3, 0, sc, 0, 0, 0.3); }
      if (m === 'empress' || m === 'overlord') { B.orbs = []; for (let i = 0; i < 5; i++) { const o = mesh(GS(0.4, 12, 10), M(0x050008, { m: 1, r: 0.1 }), 0, 0, 0, body); o.add(glowSprite(pal[2], 2.2, 0.9)); B.orbs.push(o); } mesh(GT(2.0, 0.08, 8, 48), gl, 0, 5.5, -1.2, body); }
      if (m === 'pumpkinking') { const cape = mesh(new THREE.PlaneGeometry(3.2, 4.4), M(0x2a0a3a, { side: true, r: 0.7 }), 0, 2.4, -0.7, body); B.parts.cape = cape; B.orbs = []; for (let i = 0; i < 4; i++) { const bt = buildEnemy('bat', { s: 0x222, c: 0x1a1a1a, c2: 0x2a2a2a, e: 0xff7a00, hat: 'none' }); bt.group.scale.setScalar(0.9); body.add(bt.group); B.orbs.push(bt.group); bt.group.userData.m = bt; } }
      eyeAt(0, 0.2, 0.7, head); B.h = 7.2; B.floaty = floaty;
      B.anim = (t) => {
        if (floaty) body.position.y = 0.6 + Math.sin(t * 1.6) * 0.35;
        if (B.parts.arm1) { B.parts.arm1.rotation.x = Math.sin(t * 1.5) * 0.3 - 0.3; B.parts['arm-1'].rotation.x = -Math.sin(t * 1.5) * 0.3 - 0.2; }
        if (B.wings) B.wings.forEach(([w, s], i) => w.rotation.y = s * (0.3 + Math.sin(t * 3 + i) * 0.25));
        if (B.orbs) B.orbs.forEach((o, i) => { const a = t * 1.2 + i / B.orbs.length * TAU; o.position.set(Math.cos(a) * 3.2, 4.5 + Math.sin(t * 2 + i) * 0.8, Math.sin(a) * 3.2); if (o.userData.m) animateEnemy({ model: o.userData.m, moving: 0, spd: 0, seed: i }, 0.016, t); });
        if (B.parts.cape) B.parts.cape.rotation.x = 0.2 + Math.sin(t * 2) * 0.08;
        head.rotation.y = Math.sin(t * 0.8) * 0.25;
      };
      break;
    }
    case 'mechadragon': {
      const mt = M(0x8a9aaa, { r: 0.3, m: 0.9 }), dk = M(0x2a3040, { r: 0.4, m: 0.8 }), gl = Gl(0x00aaff);
      mesh(GB(2.2, 1.8, 4.5), mt, 0, 0, 0, body); mesh(GB(1.4, 0.3, 4.2), gl, 0, -0.9, 0, body); for (let i = 0; i < 6; i++) mesh(GB(0.3, 0.6, 0.5), dk, 0, 1.1, -1.8 + i * 0.7, body);
      const neck = grp(body, 0, 0.6, 2.2); for (let i = 0; i < 4; i++) mesh(GB(1.0 - i * 0.08, 0.9 - i * 0.08, 0.8), i % 2 ? dk : mt, 0, i * 0.45, i * 0.6, neck);
      const head = grp(neck, 0, 2.0, 2.6); mesh(GB(1.1, 0.8, 1.8), mt, 0, 0, 0, head); const jaw = grp(head, 0, -0.35, -0.6); mesh(GB(0.9, 0.25, 1.6), dk, 0, 0, 0.8, jaw); eyes(head, Gl(0xff3a00), 0.2, 0.6, 0.35, 0.1); for (const s of [-1, 1]) mesh(GK(0.12, 0.9, 4), dk, s * 0.4, 0.5, -0.8, head, -1.1);
      B.wings = []; for (const s of [-1, 1]) { const w = grp(body, s * 1.1, 0.6, 0.4); for (let i = 0; i < 5; i++) { mesh(GB(4.5 - i * 0.6, 0.12, 0.8), i % 2 ? dk : mt, s * (2.2 - i * 0.2), 0, -i * 0.75, w, 0, s * 0.1 * i, 0); mesh(GB(4.3 - i * 0.6, 0.06, 0.1), gl, s * (2.2 - i * 0.2), 0.08, -i * 0.75 + 0.4, w); } B.wings.push([w, s]); }
      const tail = grp(body, 0, 0, -2.2); for (let i = 0; i < 6; i++) mesh(GB(0.9 - i * 0.12, 0.7 - i * 0.08, 1.0), i % 2 ? dk : mt, 0, 0, -i * 0.95, tail); mesh(GK(0.4, 1.0, 4), gl, 0, 0, -6.2, tail, -Math.PI / 2);
      for (const s of [-1, 1]) for (const z of [-1, 1.2]) mesh(GB(0.4, 1.3, 0.5), dk, s * 0.9, -1.3, z, body);
      eyeAt(0, 0, 1.2, head); B.h = 3;
      B.anim = (t) => { B.wings.forEach(([w, s]) => w.rotation.z = s * Math.sin(t * 3) * 0.35); tail.rotation.y = Math.sin(t * 1.4) * 0.35; jaw.rotation.x = Math.sin(t * 2) * 0.1 + 0.1; };
      break;
    }
    case 'glitch': {
      const cols = [0x00ff88, 0xff00ff, 0x00ffff, 0x111111];
      const cubes = []; const shape = [];
      for (let y = 0; y < 10; y++) { const w = y > 7 ? 1 : y > 4 ? 3 : 2; for (let x = -w; x <= w; x++) if (!(y < 5 && x === 0)) shape.push([x * 0.55, y * 0.6 + 0.3, 0]); }
      for (let y = 0; y < 4; y++) { shape.push([-2.2, 5 - y * 0.6, 0]); shape.push([2.2, 5 - y * 0.6, 0]); }
      shape.forEach(([x, y, z], i) => { const c = mesh(GB(0.5, 0.5, 0.5), i % 5 === 0 ? Gl(pick(cols)) : M(pick(cols), { e: pick(cols), ei: 0.3, r: 0.3, m: 0.5 }), x, y, z, body); c.userData.base = c.position.clone(); cubes.push(c); });
      eyes(body, Gl(0xffffff), 5.3, 0.3, 0.3, 0.14);
      eyeAt(0, 5.3, 0.4); B.h = 6.5;
      B.anim = t => { cubes.forEach(c => { if (Math.random() < 0.04) c.position.copy(c.userData.base).add(V3(rand(-0.5, 0.5), rand(-0.5, 0.5), rand(-0.5, 0.5))); else c.position.lerp(c.userData.base, 0.2); c.rotation.y += 0.02; }); body.position.y = 0.8 + Math.sin(t * 2) * 0.3; };
      break;
    }
    case 'frosttitan': case 'golem': case 'colossus': {
      const fr = def.model === 'frosttitan', co = def.model === 'colossus';
      const A = co ? M(0x3a4250, { r: 0.35, m: 0.85 }) : M(fr ? 0x9ac8e8 : 0x3a3448, { r: fr ? 0.1 : 0.85, m: fr ? 0.4 : 0.1, flat: true, e: fr ? 0x2a5a8a : 0x000000, ei: 0.3 });
      const gl = Gl(fr ? 0x7ae0ff : co ? 0x00ccff : 0xff7af2), cr = M(fr ? 0xc8f0ff : 0xff7af2, { r: 0.05, m: 0.8, e: fr ? 0x5ab4ff : 0xc07cff, ei: 0.6, flat: true, op: 0.9 });
      const tor = grp(body, 0, 4.2, 0);
      if (co) { mesh(GB(3.4, 2.6, 2.2), A, 0, 0, 0, tor); const core = mesh(GS(0.7, 16, 12), gl, 0, 0.1, 1.1, tor); core.add(glowSprite(0x00ccff, 4, 0.9)); mesh(GT(0.8, 0.12, 8, 24), M(0x8a9aaa, { m: 1, r: 0.2 }), 0, 0.1, 1.12, tor); for (const s of [-1, 1]) { mesh(GB(1.2, 1.0, 2.6), A, s * 2.2, 1.4, 0, tor); mesh(GC(0.3, 0.3, 2.2, 10), M(0x1a1a24), s * 2.2, 1.6, 1.2, tor, Math.PI / 2); mesh(GC(0.32, 0.32, 0.1, 10), gl, s * 2.2, 1.6, 2.3, tor, Math.PI / 2); } }
      else { mesh(GD(2, 0), A, 0, 0, 0, tor).scale.set(1.1, 1, 0.85); const core = mesh(GO(0.6), gl, 0, 0, 1.4, tor); }
      const head = grp(tor, 0, 1.9, 0.3);
      if (co) { mesh(GB(1.3, 1.0, 1.2), A, 0, 0, 0, head); mesh(GB(1.1, 0.25, 0.1), gl, 0, 0.05, 0.62, head); }
      else { mesh(GD(0.8, 0), A, 0, 0, 0, head); eyes(head, gl, 0.1, 0.7, 0.28, 0.12); }
      if (!co) for (let i = 0; i < 9; i++) mesh(GO(rand(0.4, 0.9)), cr, rand(-1.8, 1.8), rand(0.5, 2.2), rand(-1.4, 0.2), tor, rand(-0.6, 0.6), 0, rand(-0.8, 0.8)).scale.y = 2.2;
      for (const s of [-1, 1]) { const a = grp(tor, s * 2.3, 1.0, 0); if (co) { mesh(GB(0.9, 2.4, 0.9), A, 0, -1.3, 0, a); mesh(GB(1.2, 1.0, 1.2), M(0x1a1a24, { m: 0.8 }), 0, -2.8, 0, a); } else { mesh(GD(0.75), A, 0, -0.7, 0, a); mesh(GD(0.95), A, 0, -2.2, 0, a); mesh(GO(0.5), cr, 0, -2.6, 0.6, a).scale.y = 2; } a.rotation.z = s * 0.25; B.parts['arm' + s] = a; }
      for (const s of [-1, 1]) { if (co) mesh(GB(1.1, 3, 1.3), A, s * 1.1, 1.5, 0, body); else { mesh(GD(0.8), A, s * 1.1, 2.2, 0, body); mesh(GD(0.9), A, s * 1.15, 0.8, 0.1, body); } }
      eyeAt(0, 0.1, 1.0, head); B.h = 8;
      B.anim = t => { B.parts.arm1.rotation.x = Math.sin(t * 1.5) * 0.3; B.parts['arm-1'].rotation.x = -Math.sin(t * 1.5) * 0.3; tor.rotation.y = Math.sin(t * 0.7) * 0.1; };
      break;
    }
    case 'sludge': {
      const sl = M(0x5aff00, { r: 0.15, m: 0.1, op: 0.82, e: 0x2a8a00, ei: 0.6 });
      const blob = mesh(GS(3, 24, 18), sl, 0, 2.6, 0, body); blob.scale.set(1, 0.85, 1);
      for (let i = 0; i < 5; i++) mesh(GC(0.55, 0.55, 1.2, 12), M(pick([0xc8b000, 0x3a6aff, 0xaa2a2a]), { r: 0.5, m: 0.6 }), rand(-2, 2), rand(1.5, 3.5), rand(-1.5, 1.5), body, rand(-1, 1), 0, rand(-1, 1));
      for (let h = 0; h < 3; h++) { const tb = grp(body, (h - 1) * 1.6, 4.4, 0.8); mesh(GC(0.35, 0.45, 2.2, 10), M(0x4a5a4a, { m: 0.8, r: 0.3 }), 0, 1, 0, tb); mesh(GC(0.5, 0.35, 0.4, 10), M(0x2a2a2a, { m: 0.8 }), 0, 2.2, 0.1, tb); mesh(GS(0.3), Gl(0x88ff00), 0, 2.3, 0.2, tb); tb.rotation.x = 0.4; tb.rotation.z = (h - 1) * -0.4; B.heads.push({ hd: tb }); }
      eyes(body, Gl(0xffff00), 3.2, 2.6, 0.8, 0.3); eyeAt(0, 4.5, 2);
      B.h = 6; B.anim = t => { const s = 1 + Math.sin(t * 3) * 0.06; blob.scale.set(1 / s, 0.85 * s, 1 / s); if (Math.random() < 0.3) { _ep.set(rand(-2, 2), 4.5, rand(-2, 2)); body.localToWorld(_ep); FX.c.set(0x88ff00); PG.spawn(_ep.x, _ep.y, _ep.z, 0, rand(1, 3), 0, FX.c, 0.8, 0.4, 1, 1, 0.5, 0); } };
      break;
    }
    case 'behemoth': {
      const sun = mesh(GS(3.2, 28, 20), M(0xffaa00, { e: 0xff6a00, ei: 1.1, r: 0.6 }), 0, 6, 0, body); const spr = glowSprite(0xffaa00, 16, 0.85); spr.position.y = 6; body.add(spr);
      const cor = []; for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; const c = mesh(GK(0.5, 2.6, 6), ownAdd(i % 2 ? 0xffee00 : 0xff5a00, 0.8), Math.cos(a) * 3.5, 6 + Math.sin(a) * 3.5, 0, body, 0, 0, a - Math.PI / 2); cor.push(c); }
      const dk = M(0x2a0a00); mesh(GS(0.5), dk, -1.1, 6.8, 2.9, body); mesh(GS(0.5), dk, 1.1, 6.8, 2.9, body); eyes(body, Gl(0xffffff), 6.85, 3.25, 1.1, 0.2); mesh(GB(2.4, 0.4, 0.3), dk, 0, 5.0, 3.0, body);
      for (const s of [-1, 1]) { const a = grp(body, s * 3.0, 5.5, 0); for (let i = 0; i < 5; i++) mesh(GS(0.7 - i * 0.07, 10, 8), M(0xff6a00, { e: 0xff3a00, ei: 0.9 }), s * i * 0.7, -i * 0.5, 0.3, a); B.parts['arm' + s] = a; }
      eyeAt(0, 6, 3.3); B.h = 10;
      B.anim = t => { cor.forEach((c, i) => c.scale.y = 1 + Math.sin(t * 5 + i * 1.3) * 0.4); sun.rotation.y = t * 0.2; B.parts.arm1.rotation.z = Math.sin(t * 2) * 0.3; B.parts['arm-1'].rotation.z = -Math.sin(t * 2) * 0.3; };
      break;
    }
    case 'crab': {
      const sh = M(0xe8505a, { r: 0.4, m: 0.3 }), dk = M(0xa02a3a, { r: 0.5 });
      const shell = mesh(GS(2.6, 22, 14), sh, 0, 2.4, 0, body); shell.scale.set(1.3, 0.6, 1);
      for (let i = 0; i < 12; i++) { const c = grp(body, rand(-2.2, 2.2), 3.4, rand(-1.4, 1.2)); const col = pick([0xff5a7a, 0xffaa3a, 0xa04dff, 0x3affc8]); for (let k = 0; k < 3; k++) mesh(GC(0.08, 0.14, rand(0.6, 1.4), 6), M(col, { e: col, ei: 0.3 }), rand(-0.2, 0.2), 0.4, rand(-0.2, 0.2), c, rand(-0.5, 0.5), 0, rand(-0.5, 0.5)); }
      for (const s of [-1, 1]) { const st = grp(body, s * 0.7, 3.2, 1.9); mesh(GC(0.1, 0.12, 1.2, 6), dk, 0, 0.6, 0, st); mesh(GS(0.25), M(0x000000, { r: 0.1, m: 0.5 }), 0, 1.25, 0, st); mesh(GS(0.08), Gl(0x00ffcc), 0, 1.3, 0.22, st); }
      B.legs = []; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const L = grp(body, s * 2.6, 2.2, -0.9 + i * 0.9); mesh(GC(0.18, 0.12, 2.2, 6), dk, s * 0.8, -0.5, 0, L, 0, 0, s * 1.0); mesh(GC(0.12, 0.05, 1.8, 6), dk, s * 1.8, -1.4, 0, L, 0, 0, s * 0.2); B.legs.push([L, s, i]); }
      B.claws = []; for (const s of [-1, 1]) { const C = grp(body, s * 2.6, 2.6, 1.8); mesh(GC(0.35, 0.3, 1.8, 8), sh, 0, 0, 0.6, C, 1.3); const p1 = grp(C, 0, 0, 1.6); mesh(GS(0.8, 12, 10), sh, 0, 0, 0.5, p1).scale.set(0.8, 0.6, 1.2); const p2 = grp(p1, 0, 0.2, 1.2); mesh(GK(0.35, 1.3, 6), dk, 0, 0.1, 0.4, p2, Math.PI / 2 - 0.3); B.claws.push(p2); }
      eyeAt(0, 3, 2.4); B.h = 4.5;
      B.anim = t => { B.legs.forEach(([L, s, i]) => L.rotation.x = Math.sin(t * 8 + i * 2) * 0.25); B.claws.forEach((c, i) => c.rotation.x = -Math.abs(Math.sin(t * 3 + i)) * 0.6); };
      break;
    }
    case 'yeti': {
      const fur = M(0xf0f4ff, { r: 1 }), face = M(0x5a8aff, { r: 0.6 }), horn = M(0x3a3a4a, { r: 0.5 });
      const tor = grp(body, 0, 3.2, 0); for (let i = 0; i < 6; i++) mesh(GS(1.4, 12, 10), fur, rand(-0.5, 0.5), rand(-0.6, 1.2), rand(-0.4, 0.4), tor);
      const head = grp(tor, 0, 2.4, 0.4); mesh(GS(0.95, 14, 12), fur, 0, 0, 0, head); mesh(GS(0.65, 12, 10), face, 0, -0.1, 0.5, head).scale.set(1, 0.9, 0.6); eyes(head, Gl(0x3affff), 0.1, 0.95, 0.25, 0.1); for (const s of [-1, 1]) mesh(GK(0.2, 1.2, 6), horn, s * 0.75, 0.8, 0, head, -0.3, 0, s * -0.7); for (let i = 0; i < 4; i++) mesh(GK(0.08, 0.3, 4), M(0xffffff), -0.25 + i * 0.17, -0.45, 0.85, head, Math.PI);
      for (const s of [-1, 1]) { const a = grp(tor, s * 1.7, 1.4, 0); mesh(GS(0.75, 10, 8), fur, 0, -0.6, 0, a); mesh(GS(0.65, 10, 8), fur, 0, -1.8, 0, a); mesh(GS(0.5), face, 0, -2.5, 0.2, a); B.parts['arm' + s] = a; }
      const club = grp(B.parts.arm1, 0, -2.6, 0.3); club.rotation.x = -1; mesh(GC(0.15, 0.5, 3.2, 8), M(0x9ae8ff, { r: 0.05, m: 0.5, e: 0x3a8acc, ei: 0.5, op: 0.9 }), 0, 1.4, 0, club); for (let i = 0; i < 5; i++) mesh(GO(0.25), M(0xc8f0ff, { e: 0x5ab4ff, ei: 0.5 }), rand(-0.4, 0.4), 2.4 + rand(0, 0.6), rand(-0.4, 0.4), club).scale.y = 2;
      for (const s of [-1, 1]) mesh(GS(0.8, 10, 8), fur, s * 0.9, 1.0, 0, body).scale.set(1, 1.5, 1);
      eyeAt(0, 0, 1, head); B.h = 7;
      B.anim = t => { B.parts.arm1.rotation.x = Math.sin(t * 2) * 0.4; B.parts['arm-1'].rotation.x = -Math.sin(t * 2) * 0.4; head.rotation.z = Math.sin(t) * 0.08; };
      break;
    }
    case 'palm': {
      const bark = M(0x7a5a3a, { r: 0.95 }), leaf = M(0x3acc4a, { r: 0.6, side: true, e: 0x0a3a0a, ei: 0.3 });
      for (let i = 0; i < 9; i++) mesh(GC(0.95 - i * 0.04, 1.05 - i * 0.04, 0.8, 10), i % 2 ? bark : M(0x5a3a2a, { r: 0.95 }), Math.sin(i * 0.4) * 0.2, 0.4 + i * 0.75, 0, body);
      const crown = grp(body, 0, 7.2, 0); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; const l = grp(crown); l.rotation.y = a; const lf = mesh(new THREE.PlaneGeometry(1.0, 4.5, 1, 4), leaf, 0, 0, 2.2, l, -Math.PI / 2 + 0.5); }
      for (let i = 0; i < 3; i++) { const cc = mesh(GS(0.45, 10, 8), M(0x5a3a1a), (i - 1) * 0.6, 6.5, 0.9, body); }
      const fg = Gl(0xff3030); mesh(GS(0.18), fg, -0.6, 6.55, 1.32, body); mesh(GS(0.18), fg, 0.6, 6.55, 1.32, body);
      for (const s of [-1, 1]) { const a = grp(body, s * 0.9, 5, 0); mesh(GC(0.25, 0.18, 3, 8), bark, 0, -1.5, 0, a); for (let k = 0; k < 3; k++) mesh(GC(0.08, 0.04, 1, 5), bark, (k - 1) * 0.2, -3.2, 0.2, a, 0.3, 0, (k - 1) * 0.4); a.rotation.z = s * 0.8; B.parts['arm' + s] = a; }
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; mesh(GC(0.15, 0.35, 2.5, 6), bark, Math.cos(a) * 1.2, 0.3, Math.sin(a) * 1.2, body, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); }
      eyeAt(0, 6.5, 1.4); B.h = 9;
      B.anim = t => { crown.rotation.y = t * 0.6; crown.rotation.z = Math.sin(t * 1.2) * 0.1; B.parts.arm1.rotation.x = Math.sin(t * 1.4) * 0.4; B.parts['arm-1'].rotation.x = Math.cos(t * 1.4) * 0.4; body.rotation.z = Math.sin(t * 0.9) * 0.04; };
      break;
    }
    default: { mesh(GS(2), M(0xff003c), 0, 3, 0, body); eyeAt(0, 3, 2); }
  }
  g.traverse(o => { if (o.isMesh && o.material && !o.material.blending) o.castShadow = true; });
  mats.forEach(m => { if (m.emissive) m.userData.baseE = m.emissive.getHex(); });
  return B;
}

// ---------------- projectile meshes ----------------
function buildProj(model, col, size = 0.45) {
  const g = new THREE.Group();
  const add = (geo, mat, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); g.add(m); return m; };
  const s = size;
  switch (model) {
    case 'gift': add(GB(1, 1, 1), matStd(col, { r: 0.5 }), s * 1.6, s * 1.6, s * 1.6); add(GB(1.05, 1.05, 0.2), matStd(0xffe600, { r: 0.3, m: 0.6 }), s * 1.6, s * 1.6, s * 1.6); add(GB(0.2, 1.05, 1.05), matStd(0xffe600, { r: 0.3, m: 0.6 }), s * 1.6, s * 1.6, s * 1.6); break;
    case 'candy': add(GC(0.3, 0.3, 2, 8), matStd(0xffffff, { r: 0.3 }), s, s, s); for (let i = 0; i < 3; i++) { const t = add(GT(0.32, 0.08, 6, 12), matStd(0xff2244), s, s, s); t.rotation.x = Math.PI / 2; t.position.y = (i - 1) * s * 0.6; } break;
    case 'coal': add(GD(0.8), matStd(0x1a1a1a, { r: 0.9, flat: true }), s, s, s); break;
    case 'crate': add(GB(1, 1, 1), matStd(0x8a6a4a, { r: 0.9 }), s * 1.5, s * 1.5, s * 1.5); break;
    case 'eyeball': add(GS(1, 12, 10), matStd(0xffffff, { r: 0.3 }), s, s, s); add(GS(0.5, 10, 8), matGlow(0xff2200, 1, false), s, s, s).position.z = s * 0.7; break;
    case 'boulder': case 'iceboulder': add(GD(1), matStd(model === 'boulder' ? 0x7a6a5a : 0xa8e0ff, { r: model === 'boulder' ? 1 : 0.1, m: model === 'boulder' ? 0 : 0.4, flat: true }), s * 2, s * 2, s * 2); break;
    case 'shard': case 'ice': add(GO(1), matGlow(col, 1, false), s * 0.7, s * 1.6, s * 0.7); break;
    case 'missile': add(GC(0.25, 0.25, 1.4, 8), matStd(0xd0d8e0, { m: 0.8, r: 0.3 }), s, s, s).rotation.x = Math.PI / 2; add(GK(0.25, 0.5, 8), matStd(col, { r: 0.4 }), s, s, s).rotation.x = Math.PI / 2; g.children[1].position.z = s * 0.9; break;
    case 'bomb': add(GS(1, 12, 10), matStd(0x151515, { r: 0.4, m: 0.6 }), s, s, s); break;
    case 'scarab': add(GS(1, 10, 8), matStd(0xffcc33, { r: 0.2, m: 1, e: 0x553300, ei: 0.4 }), s, s * 0.6, s * 1.3); break;
    case 'pixel': add(GB(1, 1, 1), matGlow(col, 1, false), s * 1.2, s * 1.2, s * 1.2); break;
    case 'feather': add(GO(1), matGlow(col, 1, false), s * 0.3, s * 0.15, s * 1.8); break;
    case 'skull': add(GS(1, 10, 8), matStd(0xe8e0d0, { r: 0.6 }), s, s, s); add(GS(0.25, 6, 5), matGlow(col, 1, false), s, s, s).position.set(s * 0.35, s * 0.1, s * 0.8); add(GS(0.25, 6, 5), matGlow(col, 1, false), s, s, s).position.set(-s * 0.35, s * 0.1, s * 0.8); break;
    case 'scythe': add(GT(1, 0.12, 4, 16, Math.PI * 1.2), matStd(0xd0d8e0, { r: 0.1, m: 1, e: col, ei: 0.4 }), s, s, s).rotation.x = Math.PI / 2; break;
    case 'bone': add(GC(0.15, 0.15, 1.8, 6), matStd(0xe8e0d0), s, s, s).rotation.z = Math.PI / 2; add(GS(0.3), matStd(0xe8e0d0), s, s, s).position.x = s * 0.9; add(GS(0.3), matStd(0xe8e0d0), s, s, s).position.x = -s * 0.9; break;
    case 'acid': add(GS(1, 10, 8), matGlow(col, 1, false), s, s, s); break;
    case 'bubble': add(GS(1, 14, 10), matStd(0xc8f8ff, { r: 0.05, m: 0.5, op: 0.4 }), s, s, s); break;
    case 'shell': add(GK(0.8, 1.6, 8), matStd(col, { r: 0.4 }), s, s, s).rotation.x = Math.PI / 2; break;
    case 'snowball': add(GI(1, 1), matStd(0xffffff, { r: 1 }), s * 1.4, s * 1.4, s * 1.4); break;
    case 'leaf': add(GO(1), matStd(col, { r: 0.6, e: col, ei: 0.4 }), s * 0.9, s * 0.15, s * 1.6); break;
    case 'coconut': add(GS(1, 10, 8), matStd(0x5a3a1a, { r: 0.9 }), s * 1.2, s * 1.2, s * 1.2); break;
    case 'pumpkin': add(GS(1, 12, 10), matStd(0xff7a00, { r: 0.6, e: 0x552200, ei: 0.5 }), s * 1.3, s * 1.1, s * 1.3); add(GB(0.8, 0.25, 0.1), matGlow(0xffee00, 1, false), s, s, s).position.set(0, -s * 0.2, s * 1.25); break;
    case 'vine': case 'spike': case 'spear': case 'crystal': case 'coral': case 'geyser': case 'pillar': break;
    default: add(GS(1, 10, 8), matGlow(0xffffff, 1, false), s * 0.55, s * 0.55, s * 0.55); break;
  }
  const spr = glowSprite(col, s * 4, 0.9); g.add(spr);
  return g;
}
