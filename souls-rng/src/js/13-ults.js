// =====================================================================
//  ULTIMATES + ALLIES
// =====================================================================
function muzzleWorld(out) { PL.model.group.updateMatrixWorld(true); out.set(0, 0, 0); PL.gun.userData.muzzle.localToWorld(out); return out; }
function aimFromMuzzle() { const m = muzzleWorld(V3()); const a = computeAim().clone(); const d = a.sub(m); if (d.lengthSq() < 0.5) d.copy(CAM.fwd); return { from: m, dir: d.normalize() }; }
function ultCol() { return new THREE.Color(PL.C.col[2]).getHex(); }
function enemiesNear(p, r, noBoss) { return G.enemies.filter(e => !e.dead && e.rising <= 0 && (!noBoss || !e.boss) && dist2(e.pos, p) < r + (e.boss ? e.boss.def.r : 0)); }
function ghostify(group, col, op = 0.5) { group.traverse(o => { if (o.isMesh) { o.material = matGlow(col, op, true); o.castShadow = false; } if (o.isSprite) o.visible = false; }); }

// ---------------- allies ----------------
const ALLY = {
  drone: {
    init(a) { const g = new THREE.Group(); mesh(GS(0.28, 12, 10), matStd(0xd0d8e0, { m: 0.8, r: 0.3 }), 0, 0, 0, g).scale.set(1, 0.6, 1); mesh(GT(0.42, 0.04, 6, 20), matGlow(ultCol(), 1, false), 0, 0, 0, g, Math.PI / 2); mesh(GS(0.09), matGlow(ultCol(), 1, false), 0, 0, 0.26, g); a.m = g; },
    update(a, dt) { const ang = G.t * 1.6 + a.o.idx * TAU / 3; a.m.position.set(PL.pos.x + Math.cos(ang) * 1.7, PL.pos.y + PL.height + 0.3 + Math.sin(G.t * 3 + a.o.idx) * 0.15, PL.pos.z + Math.sin(ang) * 1.7); a.cd -= dt; if (a.cd <= 0) { const e = nearestEnemy(a.m.position, 28); if (e) { a.cd = 0.55; const c = enemyCenter(e, V3()).clone(); a.m.lookAt(c); spawnBullet(a.m.position, c.sub(a.m.position).normalize(), 90, playerBaseDmg() * 0.3, { col: ultCol(), size: 0.06, len: 1, ally: true }); } } }
  },
  skeleton: {
    init(a) { const m = buildEnemy('walker', { s: '#e0d8c4', c: '#2a2a2a', c2: '#3a3a3a', e: '#7cff4d', hat: 'none' }, false); m.group.scale.setScalar(0.9); a.m = m.group; a.mod = m; a.m.position.copy(a.pos); FX.burst(V3(a.pos.x, 0.5, a.pos.z), 0x7cff4d, 16, 4, 0.35, 0.6, { up: 3 }); },
    update(a, dt) { allyMelee(a, dt, 5.5, 0.8, 0.8, 0x7cff4d); }
  },
  guardian: {
    init(a) { const m = buildCharacter(ROSTER_BY_ID.neon_paladin, ''); ghostify(m.group, ultCol(), 0.55); m.group.scale.setScalar(1.1); a.m = m.group; a.cm = m; a.m.position.copy(a.pos); FX.burst(V3(a.pos.x, 1, a.pos.z), ultCol(), 24, 5, 0.4, 0.6); },
    update(a, dt) { allyMelee(a, dt, 8, 1.5, 0.55, ultCol(), true); }
  },
  clone: {
    init(a) { const m = buildCharacter(PL.C, PL.mut); ghostify(m.group, ultCol(), 0.45); const gn = buildGun(WEAPONS[PL.w].id); gn.rotation.x = Math.PI / 2; (m.parts.armR.userData.hand || m.parts.armR).add(gn); a.cm = m; a.gun = gn; a.m = m.group; },
    update(a, dt) {
      const ang = PL.yaw + Math.PI + (a.o.idx - 1.5) * 0.7; const tx = PL.pos.x - Math.sin(ang) * -3.2, tz = PL.pos.z - Math.cos(ang) * -3.2;
      a.m.position.x = lerp(a.m.position.x, tx, dt * 6); a.m.position.z = lerp(a.m.position.z, tz, dt * 6); a.m.position.y = PL.pos.y;
      const e = nearestEnemy(a.m.position, 32); a.cd -= dt;
      if (e) { const c = enemyCenter(e, V3()).clone(); a.m.rotation.y = Math.atan2(c.x - a.m.position.x, c.z - a.m.position.z); if (a.cd <= 0) { a.cd = 0.16; a.m.updateMatrixWorld(true); const mz = V3(); a.gun.userData.muzzle.localToWorld(mz); spawnBullet(mz, c.sub(mz).normalize(), 140, playerBaseDmg() * 0.45, { col: ultCol(), size: 0.07, len: 1.4, ally: true }); } }
      else a.m.rotation.y = PL.yaw + Math.PI;
      animateCharacter(a.cm, dt, 0.3, false, G.t, 0);
    }
  },
  turret: {
    init(a) { const g = new THREE.Group(); mesh(GC(0.5, 0.7, 0.6, 10), matStd(0x3a4250, { m: 0.8, r: 0.3 }), 0, 0.3, 0, g); const h = grp(g, 0, 0.9, 0); mesh(GB(0.6, 0.45, 0.6), matStd(0x5a6270, { m: 0.8 }), 0, 0, 0, h); mesh(GC(0.08, 0.08, 0.9, 8), matStd(0x1a1a24), 0, 0, 0.5, h, Math.PI / 2); mesh(GB(0.62, 0.06, 0.62), matGlow(ultCol(), 1, false), 0, 0.2, 0, h); a.head = h; a.m = g; g.position.copy(a.pos); FX.burst(V3(a.pos.x, 0.5, a.pos.z), ultCol(), 16, 4, 0.3, 0.5); },
    update(a, dt) { a.cd -= dt; const e = nearestEnemy(a.m.position, 32); if (e) { const c = enemyCenter(e, V3()).clone(); a.head.rotation.y = Math.atan2(c.x - a.m.position.x, c.z - a.m.position.z) - a.m.rotation.y; if (a.cd <= 0) { a.cd = 0.18; const from = V3(a.m.position.x, 0.9, a.m.position.z); spawnBullet(from, c.sub(from).normalize(), 130, playerBaseDmg() * 0.55, { col: ultCol(), size: 0.07, len: 1.2, ally: true }); AU.gun('smg'); } } }
  },
  orbult: {
    init(a) { const g = new THREE.Group(); mesh(GS(1.3, 20, 16), matGlow(ultCol(), 0.85, true), 0, 0, 0, g); mesh(GS(0.7, 16, 12), matGlow(0xffffff, 1, false), 0, 0, 0, g); g.add(glowSprite(ultCol(), 7, 0.9)); a.m = g; g.position.copy(a.pos); },
    update(a, dt) { a.m.position.addScaledVector(a.o.dir, 16 * dt); if (a.m.position.y < 1.2) a.m.position.y = 1.2; a.m.rotation.y += dt * 4; FX.burst(a.m.position, ultCol(), 3, 3, 0.4, 0.4, { g: 0 }); a.cd -= dt; if (a.cd <= 0) { a.cd = 0.2; enemiesNear(a.m.position, 3).forEach(e => damageEnemy(e, a.o.U * 1.2, { col: '#FF7AF2' })); } },
    end(a) { blast(a.m.position, 7, a.o.U * 8, ultCol(), { big: true }); }
  },
  beamult: {
    init(a) { a.m = makeBeamMesh(ultCol(), 0.8); AU.beam(); },
    update(a, dt) { const { from, dir } = aimFromMuzzle(); setBeam(a.m, from, dir, 70, 0.6 + Math.sin(G.t * 40) * 0.12); a.cd -= dt; if (a.cd <= 0) { a.cd = 0.1; for (const e of G.enemies) { if (e.dead) continue; if (e.sph.some(s => segDist(V3(s[0], s[1], s[2]), from, dir, 70) < s[3] + 0.8)) damageEnemy(e, a.o.U * 0.6, { col: '#FF7AF2', num: Math.random() < 0.5 }); } } const end = from.clone().addScaledVector(dir, Math.min(70, dir.y < -0.01 ? -from.y / dir.y : 70)); FX.burst(end, ultCol(), 3, 5, 0.4, 0.3); shake(0.05); }
  },
  blackhole: {
    init(a) { const g = new THREE.Group(); mesh(GS(1.4, 20, 16), new THREE.MeshBasicMaterial({ color: 0x000000 }), 0, 0, 0, g); a.ring = mesh(GT(2.4, 0.35, 8, 40), matGlow(ultCol(), 0.9, true), 0, 0, 0, g, Math.PI / 2.4); g.add(glowSprite(ultCol(), 9, 0.6)); a.m = g; g.position.copy(a.pos); a.from = a.pos.clone(); },
    update(a, dt) {
      const k = Math.min(1, a.t / 0.6); if (k < 1) { a.m.position.lerpVectors(a.from, a.o.to, k); a.m.position.y = 2 + Math.sin(k * Math.PI) * 3; return; }
      a.ring.rotation.z += dt * 5; const c = a.m.position;
      for (const e of G.enemies) { if (e.dead || e.boss) continue; const dx = c.x - e.pos.x, dz = c.z - e.pos.z, d = Math.hypot(dx, dz); if (d < 16 && d > 0.6) { e.pos.x += dx / d * Math.min(d, 9 * dt); e.pos.z += dz / d * Math.min(d, 9 * dt); e.stun = 0.2; } }
      for (let i = 0; i < 4 * R.partMul; i++) { const ang = rand(0, TAU), r = rand(4, 12); FX.c.set(ultCol()); PG.spawn(c.x + Math.cos(ang) * r, c.y + rand(-2, 2), c.z + Math.sin(ang) * r, -Math.cos(ang) * r * 1.5, 0, -Math.sin(ang) * r * 1.5, FX.c, 1, 0.3, 0.6, 0, 0, 0); }
      a.cd -= dt; if (a.cd <= 0) { a.cd = 0.25; enemiesNear(c, 6).forEach(e => damageEnemy(e, a.o.U * 0.5, { col: '#B04DFF' })); }
    },
    end(a) { blast(a.m.position, 9, a.o.U * 8, ultCol(), { big: true }); }
  },
  blades: {
    init(a) { const g = new THREE.Group(); a.bl = []; for (let i = 0; i < 6; i++) { const b = mesh(GB(0.25, 0.08, 1.8), matGlow(ultCol(), 1, false), 0, 0, 0, g); b.add(glowSprite(ultCol(), 1.6, 0.6)); a.bl.push(b); } a.m = g; },
    update(a, dt) { a.cd -= dt; const hitNow = a.cd <= 0; if (hitNow) a.cd = 0.15; a.bl.forEach((b, i) => { const ang = G.t * 4.5 + i / 6 * TAU; b.position.set(PL.pos.x + Math.cos(ang) * 3.6, PL.pos.y + 1.3, PL.pos.z + Math.sin(ang) * 3.6); b.rotation.y = -ang; if (hitNow) enemiesNear(b.position, 1.6).forEach(e => damageEnemy(e, a.o.U * 0.7, { col: '#FF7AF2', num: Math.random() < 0.4 })); }); }
  },
  grid: {
    init(a) { a.bm = []; for (let i = 0; i < 4; i++) a.bm.push(makeBeamMesh(ultCol(), 0.35)); a.m = null; },
    update(a, dt) { a.cd -= dt; const hitNow = a.cd <= 0; if (hitNow) a.cd = 0.15; const from = V3(PL.pos.x, 1.2, PL.pos.z); a.bm.forEach((b, i) => { const ang = G.t * 1.6 + i * Math.PI / 2, dir = V3(Math.sin(ang), 0, Math.cos(ang)); setBeam(b, from, dir, 26, 0.3); if (hitNow) for (const e of G.enemies) if (!e.dead && e.sph.length && segDist(V3(e.sph[0][0], e.sph[0][1], e.sph[0][2]), from, dir, 26) < e.sph[0][3] + 0.4) damageEnemy(e, a.o.U * 0.6, { col: '#7AF8FF', num: Math.random() < 0.4 }); }); },
    end(a) { a.bm.forEach(b => { W.scene.remove(b); disposeTemp(b); }); }
  },
  siphon: {
    init(a) { a.m = null; },
    update(a, dt) { a.cd -= dt; if (a.cd > 0) return; a.cd = 0.2; const from = V3(PL.pos.x, PL.pos.y + 1.3, PL.pos.z); enemiesNear(PL.pos, 18).sort((x, y) => dist2(x.pos, PL.pos) - dist2(y.pos, PL.pos)).slice(0, 6).forEach(e => { const c = enemyCenter(e, V3()).clone(); FX.lightning(from, c, 0xff1a4a, 0.18); const d = damageEnemy(e, a.o.U * 0.45, { col: '#FF1A4A', num: Math.random() < 0.5 }); healPlayer(Math.min(d * 0.25, PL.maxHp * 0.02), true); }); }
  },
  tornado: {
    init(a) { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const c = mesh(GK(0.6 + i * 0.45, 1.6, 12, true), matGlow(i % 2 ? 0xffffff : ultCol(), 0.35, true), 0, 0.6 + i * 1.2, 0, g, Math.PI); c.material = matGlow(i % 2 ? 0xffffff : ultCol(), 0.35, true); } a.m = g; g.position.copy(a.pos); a.dir = V3(rand(-1, 1), 0, rand(-1, 1)).normalize(); },
    update(a, dt) { a.m.rotation.y += dt * 9; a.dir.applyAxisAngle(UP, rand(-1.5, 1.5) * dt); a.m.position.addScaledVector(a.dir, 5 * dt); collide(a.m.position, 0.5); const c = a.m.position; for (const e of G.enemies) { if (e.dead || e.boss) continue; const dx = c.x - e.pos.x, dz = c.z - e.pos.z, d = Math.hypot(dx, dz); if (d < 6 && d > 0.3) { e.pos.x += (dx / d * 5 - dz / d * 4) * dt; e.pos.z += (dz / d * 5 + dx / d * 4) * dt; e.stun = 0.2; } } a.cd -= dt; if (a.cd <= 0) { a.cd = 0.2; enemiesNear(c, 4.5).forEach(e => damageEnemy(e, a.o.U * 0.5, { col: '#E0FFFF', num: Math.random() < 0.4 })); } if (Math.random() < 0.7) { FX.c.set(0xd0d0d0); PS.spawn(c.x + rand(-1, 1), 0.3, c.z + rand(-1, 1), rand(-2, 2), rand(2, 5), rand(-2, 2), FX.c, 0.5, 0.8, 0.8, 0, 1, 1); } }
  },
  cloud: {
    init(a) { a.m = null; },
    update(a, dt) { const r = a.o.r || 7; for (let i = 0; i < 4 * R.partMul; i++) { const ang = rand(0, TAU), d = rand(0, r); FX.c.set(a.o.col); (a.o.dmg ? PG : PG).spawn(PL.pos.x + Math.cos(ang) * d, rand(0.2, 2.5), PL.pos.z + Math.sin(ang) * d, rand(-0.5, 0.5), rand(0.3, 1.2), rand(-0.5, 0.5), FX.c, 0.7, rand(0.4, 0.9), rand(0.6, 1.2), 0, 0.5, 1); } if (!a.o.dmg) return; a.cd -= dt; if (a.cd <= 0) { a.cd = 0.3; enemiesNear(PL.pos, r).forEach(e => { damageEnemy(e, a.o.dmg, { col: a.o.burn ? '#FF7A1A' : '#7CFF4D', num: Math.random() < 0.5 }); if (a.o.poison) { e.poison.st = Math.min(8, e.poison.st + 1); e.poison.dps = Math.max(e.poison.dps, a.o.dmg * 0.3); e.poison.t = 4; } if (a.o.burn) { e.burn.t = 3; e.burn.dps = Math.max(e.burn.dps, a.o.dmg * 0.5); } }); } }
  },
  breath: {
    init(a) { a.m = null; AU.noise(3, 0.3, { f: 700, type: 'bandpass' }); },
    update(a, dt) { const { from, dir } = aimFromMuzzle(); for (let i = 0; i < 8 * R.partMul; i++) { const d = dir.clone().applyAxisAngle(UP, rand(-0.4, 0.4)); d.y += rand(-0.12, 0.12); const sp = rand(14, 22); FX.c.set(pick([0xff4a00, 0xffaa00, 0xffee66])); PG.spawn(from.x, from.y, from.z, d.x * sp, d.y * sp, d.z * sp, FX.c, 1, rand(0.5, 1.1), 0.8, -2, 0.4, 2.5); } a.cd -= dt; if (a.cd <= 0) { a.cd = 0.12; for (const e of G.enemies) { if (e.dead) continue; const dx = e.pos.x - from.x, dz = e.pos.z - from.z, d = Math.hypot(dx, dz); if (d < 17 + e.r && (dx * dir.x + dz * dir.z) / (d || 1) > 0.88) { damageEnemy(e, a.o.U * 0.5, { col: '#FF7A1A', num: Math.random() < 0.3 }); e.burn.t = 3; e.burn.dps = Math.max(e.burn.dps, a.o.U * 0.3); } } } }
  },
  firewall: {
    init(a) { const g = new THREE.Group(); g.position.copy(a.pos); g.rotation.y = a.o.yaw; const base = new THREE.Mesh(new THREE.PlaneGeometry(16, 1.6), tmat(0xff5a00, 0.6)); base.rotation.x = -Math.PI / 2; base.position.y = 0.06; g.add(base); a.m = g; },
    update(a, dt) { const g = a.m; for (let i = 0; i < 10 * R.partMul; i++) { const p = V3(rand(-8, 8), 0.2, rand(-0.5, 0.5)); g.localToWorld(p); FX.c.set(pick([0xff3a00, 0xff8a00, 0xffdd44])); PG.spawn(p.x, p.y, p.z, rand(-0.3, 0.3), rand(3, 7), rand(-0.3, 0.3), FX.c, 1, rand(0.5, 1), rand(0.4, 0.8), -1, 1, -0.3); } a.cd -= dt; if (a.cd <= 0) { a.cd = 0.25; g.updateMatrixWorld(); const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(); for (const e of G.enemies) { if (e.dead) continue; const l = e.pos.clone().applyMatrix4(inv); if (Math.abs(l.x) < 8 + e.r && Math.abs(l.z) < 1.6 + e.r) { damageEnemy(e, a.o.U * 0.5, { col: '#FF7A1A', num: Math.random() < 0.5 }); e.burn.t = 3; e.burn.dps = Math.max(e.burn.dps, a.o.U * 0.3); } } } }
  },
  rift: {
    init(a) { const g = new THREE.Group(); const r = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), tmat(0x8a00ff, 0.9)); r.scale.set(0.6, 1.8, 1); r.position.y = 3; g.add(r); const c = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32), new THREE.MeshBasicMaterial({ color: 0x000000 })); c.scale.set(0.6, 1.8, 1); c.position.set(0, 3, 0.01); g.add(c); g.position.copy(a.pos); a.m = g; },
    update(a, dt) { a.m.lookAt(PL.pos.x, 0, PL.pos.z); a.cd -= dt; if (a.cd <= 0) { a.cd = 0.3; const e = nearestEnemy(a.m.position, 16); if (e) { const c = enemyCenter(e, V3()).clone(), from = V3(a.m.position.x, 3, a.m.position.z); FX.lightning(from, c, 0xb04dff, 0.25); FX.beam(from, c, 0x8a00ff, 0.25, 0.25); damageEnemy(e, a.o.U * 2, { col: '#B04DFF' }); } } FX.burst(V3(a.m.position.x, 3, a.m.position.z), 0x8a00ff, 2, 2, 0.4, 0.5, { g: 0 }); }
  },
  gravity: {
    init(a) { a.m = null; a.list = enemiesNear(PL.pos, 26); a.list.forEach(e => { e.stun = 1.6; e.y0 = e.pos.y; }); a.slammed = false; },
    update(a, dt) { const k = Math.min(1, a.t / 1.0); a.list.forEach(e => { if (e.dead || e.boss) return; e.pos.y = (e.y0 || 0) + Math.sin(k * Math.PI / 2) * 6; if (Math.random() < 0.2) FX.trail(enemyCenter(e, V3()), 0xb04dff, 0.4, 0.4); }); if (k >= 1 && !a.slammed) { a.slammed = true; a.list.forEach(e => { if (e.dead) return; if (!e.boss) e.pos.y = e.def.fly ? 3.2 : 0; FX.burst(V3(e.pos.x, 0.3, e.pos.z), 0xb04dff, 14, 6, 0.4, 0.5, { up: 3 }); FX.ring(V3(e.pos.x, 0, e.pos.z), 3, 0xb04dff, 0.4); damageEnemy(e, a.o.U * (e.boss ? 3 : 6), { col: '#B04DFF' }); }); shake(1); AU.boom(true); a.done = true; } }
  },
  dragon: {
    init(a) { const g = new THREE.Group(); a.segs = []; const hd = new THREE.Group(); mesh(GB(1.2, 0.8, 1.8), matGlow(ultCol(), 0.8, true), 0, 0, 0, hd); for (const s of [-1, 1]) mesh(GK(0.12, 0.9, 4), matGlow(0xffffff, 1, false), s * 0.4, 0.6, -0.4, hd, -0.9); eyes(hd, matGlow(0xffffff, 1, false), 0.2, 0.9, 0.35, 0.12); hd.add(glowSprite(ultCol(), 5, 0.7)); g.add(hd); a.hd = hd; for (let i = 0; i < 14; i++) { const s = mesh(GS(0.7 - i * 0.035, 10, 8), matGlow(ultCol(), 0.6, true), 0, 0, 0, g); a.segs.push(s); } hd.position.set(PL.pos.x, 4, PL.pos.z); a.hist = []; for (let i = 0; i < 120; i++) a.hist.push(hd.position.clone()); a.dir = V3(0, 0, 1); a.m = g; },
    update(a, dt) { const e = nearestEnemy(a.hd.position, 60); const tgt = e ? enemyCenter(e, V3()).clone() : V3(PL.pos.x + Math.cos(G.t) * 8, 5, PL.pos.z + Math.sin(G.t) * 8); a.dir.lerp(tgt.sub(a.hd.position).normalize(), Math.min(1, dt * 3)).normalize(); a.hd.position.addScaledVector(a.dir, 17 * dt); if (a.hd.position.y < 0.8) a.hd.position.y = 0.8; a.hd.lookAt(a.hd.position.clone().add(a.dir)); a.hist.unshift(a.hd.position.clone()); a.hist.length = 120; a.segs.forEach((s, i) => s.position.copy(a.hist[(i + 1) * 4])); FX.trail(a.hd.position, ultCol(), 0.6, 0.4); a.cd -= dt; if (a.cd <= 0) { a.cd = 0.2; enemiesNear(a.hd.position, 2.6).forEach(x => damageEnemy(x, a.o.U * 2, { col: '#7AF8FF' })); } }
  }
};
function allyMelee(a, dt, spd, dmgMul, cd, col, isChar) {
  const e = nearestEnemy(a.m.position, 40); let moving = 0;
  if (e) { const dx = e.pos.x - a.m.position.x, dz = e.pos.z - a.m.position.z, d = Math.hypot(dx, dz); a.m.rotation.y = Math.atan2(dx, dz); if (d > e.r * e.scale + 1.2 + (e.boss ? e.boss.def.r : 0)) { a.m.position.x += dx / d * spd * dt; a.m.position.z += dz / d * spd * dt; moving = 1; } else { a.cd -= dt; if (a.cd <= 0) { a.cd = cd; damageEnemy(e, playerBaseDmg() * dmgMul, { col: '#B0FFB0' }); FX.burst(enemyCenter(e, V3()), col, 8, 4, 0.3, 0.3); a.atk = 0.3; } } }
  else { const dx = PL.pos.x - a.m.position.x, dz = PL.pos.z - a.m.position.z, d = Math.hypot(dx, dz); if (d > 4) { a.m.position.x += dx / d * spd * dt; a.m.position.z += dz / d * spd * dt; moving = 1; a.m.rotation.y = Math.atan2(dx, dz); } }
  collide(a.m.position, 0.5);
  if (a.atk > 0) a.atk -= dt;
  if (isChar) animateCharacter(a.cm, dt, moving, false, G.t);
  else animateEnemy({ model: a.mod, moving, spd, seed: 1, atkAnim: a.atk || 0, walk: a.walk || 0 }, dt, G.t);
  if (!isChar) a.walk = (a.walk || 0) + dt * 8 * moving;
}
function spawnAlly(kind, pos, o = {}) {
  const a = { kind, pos: pos.clone(), life: o.life ?? 10, t: 0, cd: 0, o, m: null };
  ALLY[kind].init(a); if (a.m) W.scene.add(a.m);
  G.allies.push(a); return a;
}
function updateAllies(dt) {
  for (let i = G.allies.length - 1; i >= 0; i--) {
    const a = G.allies[i]; a.t += dt; a.life -= dt;
    try { ALLY[a.kind].update(a, dt); } catch (e) { console.error(e); a.done = true; }
    if (a.life <= 0 || a.done) {
      if (ALLY[a.kind].end) ALLY[a.kind].end(a);
      if (a.m) { if (a.m.position) FX.burst(V3(a.m.position.x, a.m.position.y + 1, a.m.position.z), ultCol(), 10, 3, 0.3, 0.4); W.scene.remove(a.m); disposeModel(a.m); }
      G.allies.splice(i, 1);
    }
  }
}
function spawnDrones() { const n = PL.pw.drone ? Math.min(3, Math.ceil(PL.pw.drone / 1.6)) : 0; for (let i = 0; i < n; i++) spawnAlly('drone', PL.pos, { life: Infinity, idx: i }); }

// ---------------- ultimate dispatch ----------------
function triggerUlt() {
  if (PL.ult < 100 || G.dead || G.paused || !G.playing) return;
  PL.ult = 0; const id = PL.C.u, U = playerBaseDmg() * 1.0;
  AU.ult(); shake(0.5); if (R.post) R.post.comp.uniforms.ca.value = 2;
  banner(ULTS[id].n.toUpperCase(), '', PL.C.col[2], 1.1, true);
  FX.ring(V3(PL.pos.x, 0, PL.pos.z), 6, ultCol(), 0.5); FX.burst(V3(PL.pos.x, 1.2, PL.pos.z), ultCol(), 30, 7, 0.4, 0.6);
  try { (ULT_FN[id] || ULT_FN.orb)(U); } catch (e) { console.error('ult failed', id, e); }
}
const ULT_FN = {
  orb: U => { const { from, dir } = aimFromMuzzle(); spawnAlly('orbult', from, { dir, U, life: 2.4 }); },
  beam: U => spawnAlly('beamult', PL.pos, { U, life: 3 }),
  nova: U => { for (let r = 0; r < 4; r++) later(r * 0.15, () => { const R0 = 4 + r * 4.5; FX.ring(V3(PL.pos.x, 0, PL.pos.z), R0 + 2, ultCol(), 0.5, 0.5, 0.25); AU.boom(false); enemiesNear(PL.pos, R0 + 2.5).filter(e => dist2(e.pos, PL.pos) > R0 - 3.5).forEach(e => damageEnemy(e, U * 3, { col: '#FF7AF2' })); }); },
  storm: U => { for (let i = 0; i < 16; i++) later(i * 0.25, () => { const e = randomEnemyNear(PL.pos, 28); if (!e) return; const c = enemyCenter(e, V3()).clone(); FX.lightning(V3(c.x, 25, c.z), c, 0x9a7cff, 0.3); FX.flash(c, 0x9a7cff, 5, 14); damageEnemy(e, U * 1.6, { col: '#B9A0FF' }); chainLightning(e, U * 0.8, 3, 0x9a7cff); }); },
  blackhole: U => { const a = computeAim().clone(); const d = a.clone().sub(PL.pos); d.y = 0; if (d.length() > 18) d.setLength(18); spawnAlly('blackhole', V3(PL.pos.x, 2, PL.pos.z), { to: V3(PL.pos.x + d.x, 2.5, PL.pos.z + d.z), U, life: 3.6 }); },
  meteor: U => { const a = computeAim().clone(); for (let i = 0; i < 12; i++) later(i * 0.15, () => fallingStar(V3(a.x + rand(-7, 7), 0, a.z + rand(-7, 7)), U * 3.5, 0xff6a00, 3.5)); },
  zero: U => { FX.ring(V3(PL.pos.x, 0, PL.pos.z), 26, 0x9ae8ff, 0.8); FX.burst(V3(PL.pos.x, 1, PL.pos.z), 0xffffff, 80, 18, 0.4, 1); if (R.post) R.post.comp.uniforms.desat.value = 0.8; AU.freeze(); enemiesNear(PL.pos, 26).forEach(e => { if (e.boss) { damageEnemy(e, U * 4, { col: '#9AE8FF' }); e.chill = 60; } else { freezeEnemy(e, 5); damageEnemy(e, U * 2, { col: '#9AE8FF' }); } }); },
  blades: U => spawnAlly('blades', PL.pos, { U, life: 8 }),
  grid: U => spawnAlly('grid', PL.pos, { U, life: 5 }),
  guardians: U => { for (let i = 0; i < 3; i++) spawnAlly('guardian', V3(PL.pos.x + Math.cos(i * 2.1) * 2.5, 0, PL.pos.z + Math.sin(i * 2.1) * 2.5), { life: 15 }); },
  siphon: U => spawnAlly('siphon', PL.pos, { U, life: 4 }),
  timestop: U => { G.timeStop = 4; if (R.post) R.post.comp.uniforms.desat.value = 1; for (let i = 0; i < 8; i++) AU.tone(1000, 'square', 0.05, 0.06, { delay: i * 0.5 }); FX.ring(V3(PL.pos.x, 0, PL.pos.z), 40, 0xffffff, 1); },
  clones: U => { for (let i = 0; i < 4; i++) spawnAlly('clone', PL.pos, { idx: i, life: 8 }); },
  cyclone: U => { for (let i = 0; i < 3; i++) spawnAlly('tornado', V3(PL.pos.x + rand(-3, 3), 0, PL.pos.z + rand(-3, 3)), { U, life: 7 }); },
  quake: U => { const yaw = PL.yaw; for (let r = 0; r < 7; r++) later(r * 0.08, () => { for (let k = -2; k <= 2; k++) { const ang = yaw + k * 0.17 * (1 + r * 0.05), d = 4 + r * 3.2, p = V3(PL.pos.x - Math.sin(ang) * d, 0, PL.pos.z - Math.cos(ang) * d); spikeAt(p, 'spike', 1.6, 0x9a7a5a); enemiesNear(p, 2.4).forEach(e => { damageEnemy(e, U * 3, { col: '#D8B080' }); if (!e.boss) e.stun = 0.6; }); } shake(0.3); AU.slam(); }); },
  breath: U => spawnAlly('breath', PL.pos, { U, life: 3 }),
  arrows: U => { const a = computeAim().clone(); for (let i = 0; i < 80; i++) later(i * 0.03, () => { const p = V3(a.x + rand(-9, 9), 0, a.z + rand(-9, 9)); spawnBullet(V3(p.x + rand(-1, 1), 22, p.z + rand(-1, 1)), V3(0, -1, 0), 55, U * 0.9, { col: ultCol(), size: 0.06, len: 1.8, noProc: true, noSplit: true, homing: 0, life: 1 }); }); },
  titanblade: U => {
    const a = computeAim().clone(); const d = a.clone().sub(PL.pos); d.y = 0; if (d.length() > 25) d.setLength(25); const p = V3(PL.pos.x + d.x, 0, PL.pos.z + d.z);
    const dc = decalCircle(p.x, p.z, 7, ultCol()); const sw = new THREE.Group(); mesh(GB(1.4, 14, 0.4), matStd(0xdde4ee, { r: 0.1, m: 1, e: ultCol(), ei: 0.6 }), 0, 7, 0, sw); mesh(GB(0.4, 13, 0.45), matGlow(ultCol(), 1, false), 0, 7, 0, sw); mesh(GB(5, 0.8, 0.9), matStd(0xffcc33, { m: 1, r: 0.2 }), 0, 14.2, 0, sw); mesh(GC(0.35, 0.35, 3, 8), matStd(0x2a1a10), 0, 16, 0, sw); sw.rotation.x = Math.PI; sw.position.set(p.x, 40, p.z); W.scene.add(sw);
    let t = 0; addZone({ player: true, obj: dc, update(dt) { t += dt; const k = Math.min(1, t / 0.8); sw.position.y = lerp(40, 13.5, k * k); dc.userData.fill.scale.setScalar(Math.max(0.01, k)); if (k >= 1 && !this.hit) { this.hit = true; blast(p, 7.5, U * 14, ultCol(), { big: true }); shockRingPlayer(p, U * 2); shake(1.5); } if (t > 2.2) { W.scene.remove(sw); return false; } } });
  },
  smite: U => { G.enemies.filter(e => !e.dead && dist2(e.pos, PL.pos) < 35).sort((x, y) => dist2(x.pos, PL.pos) - dist2(y.pos, PL.pos)).slice(0, 12).forEach((e, i) => later(i * 0.08, () => { if (e.dead) return; spikeAt(e.pos, 'pillar', 2.2, 0xfff0a0); FX.flash(enemyCenter(e, V3()), 0xfff0a0, 5, 12); damageEnemy(e, U * 4, { col: '#FFF27A' }); AU.zap(); })); },
  plague: U => spawnAlly('cloud', PL.pos, { life: 8, col: 0x7cff4d, r: 7, dmg: U * 0.4, poison: true }),
  berserk: U => { PL.berserk = 8; spawnAlly('cloud', PL.pos, { life: 8, col: 0xff2a2a, r: 1.3, dmg: 0 }); if (R.post) R.post.comp.uniforms.hurt.value = 0.6; },
  missiles: U => { for (let i = 0; i < 18; i++) later(i * 0.05, () => { const from = V3(PL.pos.x, PL.pos.y + PL.height, PL.pos.z); spawnBullet(from, V3(rand(-0.6, 0.6), 1, rand(-0.6, 0.6)).normalize(), 24, U * 2.4, { kind: 'rocket', homing: 3, explode: 3, noProc: true, noSplit: true, life: 4, size: 0.15 }); AU.gun('rocket'); }); },
  shadowstep: U => { const tg = G.enemies.filter(e => !e.dead && e.rising <= 0 && dist2(e.pos, PL.pos) < 26).sort((x, y) => dist2(x.pos, PL.pos) - dist2(y.pos, PL.pos)).slice(0, 8); PL.iT = 0.3 + tg.length * 0.1; tg.forEach((e, i) => later(i * 0.09, () => { if (e.dead) return; const from = V3(PL.pos.x, 1.2, PL.pos.z), dx = e.pos.x - PL.pos.x, dz = e.pos.z - PL.pos.z, d = Math.hypot(dx, dz) || 1; PL.pos.set(e.pos.x + dx / d * (e.r * e.scale + 1.2), PL.pos.y, e.pos.z + dz / d * (e.r * e.scale + 1.2)); collide(PL.pos, PL.hitR); FX.beam(from, V3(PL.pos.x, 1.2, PL.pos.z), 0x6a00ff, 0.2, 0.3); FX.burst(enemyCenter(e, V3()), 0xb04dff, 16, 5, 0.35, 0.4); damageEnemy(e, U * 5, { col: '#B04DFF' }); AU.tone(1800, 'sawtooth', 0.08, 0.08, { to: 400 }); PL.iT = Math.max(PL.iT, 0.3); })); },
  railgun: U => { const { from } = aimFromMuzzle(); for (let i = 0; i < 20; i++) { const q = from.clone().add(V3(rand(-2, 2), rand(-2, 2), rand(-2, 2))); FX.c.set(ultCol()); PG.spawn(q.x, q.y, q.z, (from.x - q.x) * 3, (from.y - q.y) * 3, (from.z - q.z) * 3, FX.c, 1, 0.3, 0.35, 0, 0, 0); } later(0.35, () => { const { from, dir } = aimFromMuzzle(); const end = from.clone().addScaledVector(dir, 120); FX.beam(from, end, ultCol(), 0.9, 0.6); FX.beam(from, end, 0xffffff, 0.35, 0.4); shake(1.2); AU.boom(true); for (const e of G.enemies) if (!e.dead && e.sph.some(s => segDist(V3(s[0], s[1], s[2]), from, dir, 120) < s[3] + 1.2)) damageEnemy(e, U * 20, { col: '#FFFFFF', crit: true }); }); },
  sentries: U => { for (let i = 0; i < 3; i++) spawnAlly('turret', V3(PL.pos.x + Math.cos(i * 2.1) * 2.6, 0, PL.pos.z + Math.sin(i * 2.1) * 2.6), { life: 12 }); },
  phoenix: U => { healPlayer(PL.maxHp); blast(V3(PL.pos.x, 1, PL.pos.z), 10, U * 8, 0xff6a00, { big: true }); enemiesNear(PL.pos, 10).forEach(e => { e.burn.t = 5; e.burn.dps = Math.max(e.burn.dps, U * 0.8); }); spawnAlly('cloud', PL.pos, { life: 5, col: 0xff6a00, r: 5, dmg: U * 0.4, burn: true }); for (let i = 0; i < 60; i++) { FX.c.set(pick([0xff6a00, 0xffcc33, 0xff3300])); const a = rand(-1, 1); PG.spawn(PL.pos.x + a * 4, PL.pos.y + 1.5 + Math.abs(a) * 1.5, PL.pos.z, a * 3, rand(4, 9), rand(-1, 1), FX.c, 1, rand(0.4, 0.8), rand(0.8, 1.4), 2, 0.5, 0); } },
  icespikes: U => { for (let r = 0; r < 3; r++) later(r * 0.22, () => { const R0 = 4 + r * 4, n = 10 + r * 6; for (let i = 0; i < n; i++) { const ang = i / n * TAU; spikeAt(V3(PL.pos.x + Math.cos(ang) * R0, 0, PL.pos.z + Math.sin(ang) * R0), 'ice', 1.1, 0x9ae8ff); } AU.freeze(); enemiesNear(PL.pos, R0 + 2.4).filter(e => dist2(e.pos, PL.pos) > R0 - 2.4).forEach(e => { damageEnemy(e, U * 3, { col: '#9AE8FF' }); freezeEnemy(e, 2); }); }); },
  firewall: U => { const fx = -Math.sin(PL.yaw), fz = -Math.cos(PL.yaw); spawnAlly('firewall', V3(PL.pos.x + fx * 9, 0, PL.pos.z + fz * 9), { yaw: PL.yaw, U, life: 6 }); },
  rift: U => { const a = computeAim().clone(); const d = a.clone().sub(PL.pos); d.y = 0; if (d.length() > 15) d.setLength(15); spawnAlly('rift', V3(PL.pos.x + d.x, 0, PL.pos.z + d.z), { U, life: 6 }); },
  gravity: U => spawnAlly('gravity', PL.pos, { U, life: 1.5 }),
  dragon: U => spawnAlly('dragon', PL.pos, { U, life: 10 }),
  starfall: U => { for (let i = 0; i < 20; i++) later(i * 0.14, () => { const ang = rand(0, TAU), d = rand(4, 16); fallingStar(V3(PL.pos.x + Math.cos(ang) * d, 0, PL.pos.z + Math.sin(ang) * d), U * 5, pick([0xffe600, 0x7af8ff, 0xff7af2]), 4.5); }); },
  supernova: U => { PL.iT = 2; G.slowmo = 1.2; for (let i = 0; i < 80; i++) { const q = V3(PL.pos.x + rand(-12, 12), rand(0, 8), PL.pos.z + rand(-12, 12)); FX.c.set(pick([0xffffff, 0xffe600, ultCol()])); PG.spawn(q.x, q.y, q.z, (PL.pos.x - q.x) * 1.0, (1.2 - q.y), (PL.pos.z - q.z) * 1.0, FX.c, 1, 0.35, 1, 0, 0, 0); } later(1.2, () => { blast(V3(PL.pos.x, 1, PL.pos.z), 38, U * 25, 0xffffff, { big: true }); FX.ring(V3(PL.pos.x, 0, PL.pos.z), 45, ultCol(), 1.2); flashScreen('#ffffff'); shake(1.6); }); },
  glitch: U => { if (R.post) R.post.comp.uniforms.glitch.value = 1.5; for (let i = 0; i < 6; i++) AU.noise(0.1, 0.3, { f: rand(500, 6000), type: 'bandpass', delay: i * 0.12 }); G.enemies.filter(e => !e.dead).slice(0, 18).forEach((e, i) => later(i * 0.06, () => { if (e.dead) return; const c = enemyCenter(e, V3()).clone(); for (let k = 0; k < 20; k++) { FX.c.set(pick([0x00ff66, 0xff00ff, 0x00ffff])); PG.spawn(c.x + rand(-1, 1), c.y + rand(-1, 1), c.z + rand(-1, 1), rand(-4, 4), rand(-1, 4), rand(-4, 4), FX.c, 1, 0.35, 0.4, 0, 0, 0); } if (e.boss) damageEnemy(e, U * 15, { col: '#00FF66' }); else { FX.num(c, 'DELETED', '#00FF66', true); damageEnemy(e, e.hp + 1, { col: '#00FF66', num: false }); } })); }
};
function shockRingPlayer(p, dmg) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), tmat(ultCol(), 0.9)); m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.1, p.z); W.scene.add(m); let r = 1; const hit = new Set();
  addZone({ player: true, obj: m, update(dt) { r += 30 * dt; m.scale.set(r, r, r); m.material.opacity = 0.9 * (1 - r / 22); for (const e of G.enemies) if (!e.dead && !hit.has(e) && Math.abs(dist2(e.pos, p) - r) < 1.5) { hit.add(e); damageEnemy(e, dmg, { col: '#FFFFFF' }); } return r < 22; } });
}
