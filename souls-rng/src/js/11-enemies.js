// =====================================================================
//  ENEMIES — spawning, zombie AI, enemy projectiles, telegraphs & zones
// =====================================================================
const hpScale = r => (1 + 0.32 * (r - 1)) * Math.pow(1.09, r - 1);
const dmgScale = r => 1 + 0.13 * (r - 1);
function pickWeighted(pool) { const tot = pool.reduce((a, p) => a + p[1], 0); let x = Math.random() * tot; for (const p of pool) { x -= p[1]; if (x <= 0) return p[0]; } return pool[0][0]; }

function spawnEnemy(type, pos, o = {}) {
  const b = BIOMES[G.biome], T = ENEMY_TYPES[type];
  const elite = o.elite ?? (type !== 'mini' && Math.random() < 0.04 + G.realm * 0.004);
  const model = buildEnemy(type, b.skin, elite);
  const scale = T.sc * (elite ? 1.3 : 1);
  model.group.scale.setScalar(scale);
  if (!pos) {
    let tries = 0; pos = V3();
    do { const a = rand(0, TAU), d = rand(22, 36); pos.set(PL.pos.x + Math.cos(a) * d, 0, PL.pos.z + Math.sin(a) * d); if (Math.hypot(pos.x, pos.z) > ARENA - 2) pos.multiplyScalar((ARENA - 2) / Math.hypot(pos.x, pos.z)); tries++; }
    while (tries < 12 && W.colliders.some(c => Math.hypot(c.x - pos.x, c.z - pos.z) < c.r + 1));
  }
  model.group.position.set(pos.x, 0, pos.z);
  const lvl = G.realm + (o.bonusLvl || 0);
  const e = {
    type, def: T, model, pos: model.group.position, hp: T.hp * hpScale(lvl) * (elite ? 3 : 1), maxHp: 0, dmg: T.dmg * dmgScale(lvl) * (elite ? 1.4 : 1),
    spd: T.spd * (1 + Math.min(0.35, 0.015 * (G.realm - 1))) * rand(0.9, 1.1), r: T.r, h: model.h, scale, elite, boss: null,
    burn: { dps: 0, t: 0 }, poison: { st: 0, dps: 0, t: 0 }, chill: 0, frozen: 0, stun: 0, flash: 0, hpT: 0, dead: false, dot: 0, dotT: 0.5,
    atkCd: rand(0.5, 1.5), atkAnim: 0, state: 'chase', stT: 0, fuse: 0, seed: rand(0, 10), moving: 1, kb: V3(), vy: 0, sph: [[0, 0, 0, 1], [0, 0, 0, 0.4, 1]], tint: -1, rising: o.noRise ? 0 : 0.8, air: null
  };
  e.maxHp = e.hp;
  if (T.fly) e.pos.y = 3.2;
  if (e.rising > 0) { e.pos.y = -e.h * scale; FX.burst(V3(pos.x, 0.1, pos.z), 0x5a4a3a, 10, 3, 0.35, 0.6, { up: 3, a: 0.9 }); FX.ring(V3(pos.x, 0, pos.z), 1.8, new THREE.Color(b.skin.e).getHex(), 0.6); AU.spawn(); }
  W.scene.add(model.group); G.enemies.push(e);
  return e;
}
function updateSpheres(e) {
  const s = e.scale;
  if (e.def.fly) { e.sph[0][0] = e.pos.x; e.sph[0][1] = e.pos.y; e.sph[0][2] = e.pos.z; e.sph[0][3] = 0.75 * s; e.sph[1][3] = 0; return; }
  const bodyH = e.model.parts.body.position.y;
  e.sph[0][0] = e.pos.x; e.sph[0][1] = e.pos.y + bodyH + e.h * s * 0.42; e.sph[0][2] = e.pos.z; e.sph[0][3] = Math.max(e.r * s * 1.15, e.h * s * 0.36);
  e.sph[1][0] = e.pos.x; e.sph[1][1] = e.pos.y + bodyH + (e.h - 0.32) * s; e.sph[1][2] = e.pos.z; e.sph[1][3] = 0.36 * s;
  if (e.model.parts.crawl) { e.sph[0][1] = e.pos.y + 0.45 * s; e.sph[0][3] = 0.75 * s; e.sph[1][1] = e.pos.y + 0.6 * s; }
}
function tintEnemy(e) {
  const want = e.flash > 0 ? 1 : e.frozen > 0 ? 2 : e.fuse > 0 && Math.sin(G.t * 30) > 0 ? 3 : 0;
  if (want === e.tint) return; e.tint = want;
  for (const m of e.model.mats) { if (!m.emissive) continue; m.emissive.setHex(want === 1 ? 0xffffff : want === 2 ? 0x3aa8ff : want === 3 ? 0xff2200 : (m.userData.baseE || 0)); m.emissiveIntensity = want === 1 ? 0.9 : want ? 0.7 : 1; }
}

function updateEnemies(dt) {
  const ts = G.timeStop > 0, L = PL.pw, frostR = L.frostaura ? 4 + L.frostaura : 0;
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (e.dead) { G.enemies.splice(i, 1); continue; }
    if (e.flash > 0) e.flash -= dt; if (e.hpT > 0) e.hpT -= dt;
    if (e.boss) { updateBoss(e, dt); continue; }
    updateSpheres(e);
    if (e.rising > 0) { e.rising -= dt; e.pos.y = -e.h * e.scale * Math.max(0, e.rising / 0.8); if (Math.random() < 0.3) FX.burst(V3(e.pos.x, 0.1, e.pos.z), 0x5a4a3a, 2, 2, 0.3, 0.4, { up: 2 }); if (e.rising <= 0) e.pos.y = e.def.fly ? 3.2 : 0; animateEnemy(e, 0, G.t); continue; }
    tickStatus(e, dt); if (e.dead) continue;
    tintEnemy(e);
    if (ts || e.frozen > 0) continue;
    const dx = PL.pos.x - e.pos.x, dz = PL.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 0.001, nx = dx / d, nz = dz / d;
    let slow = 1 - e.chill / 250; if (frostR && d < frostR) slow *= 1 - 0.12 * L.frostaura; if (e.stun > 0) slow = 0;
    let mv = 0, want = 1; // want: 1 approach, -1 retreat, 0 hold
    const reach = e.r * e.scale + PL.hitR + 0.7;
    e.atkCd -= dt; if (e.atkAnim > 0) e.atkAnim -= dt;
    switch (e.def.atk) {
      case 'melee':
        if (e.state === 'windup') { want = 0; e.stT -= dt; if (e.stT <= 0) { e.state = 'chase'; if (d < reach + 0.5 && Math.abs(PL.pos.y - e.pos.y) < 2) hurtPlayer(e.dmg); } }
        else if (d < reach && e.atkCd <= 0) { e.state = 'windup'; e.stT = 0.35; e.atkAnim = 0.35; e.atkCd = 1.1; }
        break;
      case 'slam':
        if (e.state === 'slam') { want = 0; e.stT -= dt; if (e.stT <= 0) { e.state = 'chase'; FX.ring(V3(e.pos.x, 0, e.pos.z), 4, 0xffaa55, 0.4); FX.burst(V3(e.pos.x, 0.2, e.pos.z), 0x8a7a6a, 18, 6, 0.45, 0.6, { up: 4 }); AU.slam(); shake(0.4); if (Math.hypot(PL.pos.x - e.pos.x, PL.pos.z - e.pos.z) < 3.6 && PL.pos.y < 1) hurtPlayer(e.dmg); } }
        else if (d < 3.4 && e.atkCd <= 0) { e.state = 'slam'; e.stT = 0.9; e.atkAnim = 0.9; e.atkCd = 2.6; telegraphCircle(e.pos.x, e.pos.z, 3.6, 0.9, 0xff5522); }
        break;
      case 'spit':
        want = d > 15 ? 1 : d < 9 ? -1 : 0;
        if (d < e.def.range && e.atkCd <= 0) { e.atkCd = rand(2.4, 3.2); e.atkAnim = 0.3; const tgt = V3(PL.pos.x + PL.vel.x * 0.6, 0, PL.pos.z + PL.vel.z * 0.6); lobShot(V3(e.pos.x, e.pos.y + e.h * e.scale * 0.85, e.pos.z), tgt, 1.0, e.dmg, new THREE.Color(BIOMES[G.biome].skin.e).getHex(), { aoe: 1.8, model: 'acid', size: 0.35, pool: 'toxic', poolR: 1.6, poolT: 3 }); AU.enemyShot(); }
        break;
      case 'explode':
        if (e.fuse > 0) { want = 0; e.fuse -= dt; if (Math.random() < 0.2) AU.tone(1400, 'square', 0.04, 0.05); if (e.fuse <= 0) { e.hp = 0; killEnemy(e); continue; } }
        else if (d < 2.6) { e.fuse = 0.75; }
        break;
      case 'leap':
        if (e.air) { want = 0; e.air.t += dt; const k = Math.min(1, e.air.t / e.air.T); e.pos.x = lerp(e.air.a.x, e.air.b.x, k); e.pos.z = lerp(e.air.a.z, e.air.b.z, k); e.pos.y = Math.sin(k * Math.PI) * 3.5; if (k >= 1) { e.air = null; e.pos.y = 0; FX.ring(V3(e.pos.x, 0, e.pos.z), 2.5, 0xffaa55, 0.3); if (Math.hypot(PL.pos.x - e.pos.x, PL.pos.z - e.pos.z) < 2.2 && PL.pos.y < 1.5) hurtPlayer(e.dmg); } }
        else if (e.state === 'crouch') { want = 0; e.stT -= dt; if (e.stT <= 0) { e.state = 'chase'; e.air = { a: e.pos.clone(), b: V3(PL.pos.x + PL.vel.x * 0.4, 0, PL.pos.z + PL.vel.z * 0.4), t: 0, T: 0.65 }; } }
        else if (d > 4.5 && d < 12 && e.atkCd <= 0) { e.state = 'crouch'; e.stT = 0.45; e.atkCd = 3; e.model.parts.body.position.y = -0.25; }
        else if (d < reach && e.atkCd <= 0) { hurtPlayer(e.dmg * 0.7); e.atkCd = 1; e.atkAnim = 0.3; }
        break;
      case 'blink':
        if (e.atkCd <= 0 && d > 5) { e.atkCd = rand(3, 5); const a = rand(0, TAU), r = rand(2.5, 4); FX.burst(V3(e.pos.x, 1.2, e.pos.z), 0xa000ff, 14, 3, 0.35, 0.5, { g: 0 }); e.pos.x = PL.pos.x + Math.cos(a) * r; e.pos.z = PL.pos.z + Math.sin(a) * r; FX.burst(V3(e.pos.x, 1.2, e.pos.z), 0xa000ff, 14, 3, 0.35, 0.5, { g: 0 }); AU.tone(300, 'sine', 0.25, 0.08, { to: 900 }); }
        else if (d < reach && e.stT <= 0) { e.stT = 1.1; e.atkAnim = 0.3; later(0.3, () => { if (!e.dead && Math.hypot(PL.pos.x - e.pos.x, PL.pos.z - e.pos.z) < reach + 0.6) hurtPlayer(e.dmg); }); }
        e.stT -= dt;
        break;
      case 'summon':
        want = d > 17 ? 1 : d < 11 ? -1 : 0;
        if (e.atkCd <= 0 && G.enemies.length < 50) { e.atkCd = 7.5; e.atkAnim = 0.8; FX.ring(V3(e.pos.x, 0, e.pos.z), 3.5, 0x7cff4d, 0.8); for (let k = 0; k < 2; k++) spawnEnemy(Math.random() < 0.5 ? 'mini' : 'walker', V3(e.pos.x + rand(-3, 3), 0, e.pos.z + rand(-3, 3)), { elite: false }); }
        break;
      case 'dive':
        if (e.state === 'dive') { want = 0; e.stT -= dt; e.pos.x += e.dv.x * dt; e.pos.y += e.dv.y * dt; e.pos.z += e.dv.z * dt; e.pos.y = Math.max(0.6, e.pos.y); if (Math.hypot(PL.pos.x - e.pos.x, PL.pos.y + 1 - e.pos.y, PL.pos.z - e.pos.z) < 1.4) { hurtPlayer(e.dmg); e.stT = 0; } if (e.stT <= 0) e.state = 'chase'; }
        else { e.pos.y = lerp(e.pos.y, 3.4 + Math.sin(G.t * 2 + e.seed) * 0.5, dt * 2); if (d < 9 && e.atkCd <= 0) { e.atkCd = rand(2.2, 3.5); e.state = 'dive'; e.stT = 0.7; e.dv = V3(PL.pos.x - e.pos.x, PL.pos.y + 1 - e.pos.y, PL.pos.z - e.pos.z).normalize().multiplyScalar(e.spd * 2.4); AU.tone(700, 'sawtooth', 0.2, 0.04, { to: 300 }); } if (d < 6) want = 0; }
        break;
    }
    if (!e.air && e.state !== 'dive') {
      const sp = e.spd * slow * (e.fuse > 0 ? 0 : 1) * (e.def.atk === 'explode' ? 1.15 : 1);
      if (want === 1 && d > reach * 0.85) { e.pos.x += nx * sp * dt; e.pos.z += nz * sp * dt; mv = 1; }
      else if (want === -1) { e.pos.x -= nx * sp * 0.6 * dt; e.pos.z -= nz * sp * 0.6 * dt; mv = 0.6; }
      else if (e.def.atk === 'dive') { e.pos.x += -nz * sp * 0.7 * dt; e.pos.z += nx * sp * 0.7 * dt; mv = 1; }
    }
    if (e.state === 'crouch') e.model.parts.body.position.y = -0.25; else if (!e.model.parts.hover && e.model.parts.body.position.y < 0) e.model.parts.body.position.y = 0;
    e.pos.x += e.kb.x * dt; e.pos.z += e.kb.z * dt; e.kb.multiplyScalar(Math.max(0, 1 - dt * 6));
    e.moving = lerp(e.moving, mv * slow, dt * 8);
    if (!e.def.fly) collide(e.pos, e.r * e.scale * 0.8);
    const yaw = Math.atan2(nx, nz); let dy = yaw - e.model.group.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); e.model.group.rotation.y += dy * Math.min(1, dt * 8);
    animateEnemy(e, dt, G.t);
  }
  // separation
  const es = G.enemies;
  for (let i = 0; i < es.length; i++) { const a = es[i]; if (a.dead || a.rising > 0 || a.boss) continue; for (let j = i + 1; j < es.length; j++) { const b = es[j]; if (b.dead || b.rising > 0 || b.boss) continue; const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, rr = (a.r * a.scale + b.r * b.scale) * 0.85, d2 = dx * dx + dz * dz; if (d2 < rr * rr && d2 > 1e-5) { const d = Math.sqrt(d2), k = (rr - d) / d * 0.5; a.pos.x -= dx * k; a.pos.z -= dz * k; b.pos.x += dx * k; b.pos.z += dz * k; } } }
}

function updateSpawner(dt) {
  if (G.timeStop > 0 || G.bossDone) return;
  const alive = G.enemies.filter(e => !e.boss && !e.dead).length;
  const cap = G.boss ? Math.min(8, 3 + G.realm) : Math.min(40, 10 + G.realm * 2);
  G.spawnT -= dt;
  if (G.spawnT <= 0 && alive < cap) {
    G.spawnT = (G.boss ? 4 : Math.max(0.35, 1.1 - G.realm * 0.03)) * rand(0.6, 1.4);
    const n = G.boss ? 1 : randi(1, Math.min(4, 1 + Math.floor(G.realm / 3)));
    for (let k = 0; k < n; k++) spawnEnemy(pickWeighted(BIOMES[G.biome].pool));
  }
}

// ---------------- enemy projectiles ----------------
function eShot(p, vel, dmg, col, o = {}) {
  const m = buildProj(o.model || 'orb', col, o.size || 0.4); m.position.copy(p); W.scene.add(m);
  const s = { m, pos: m.position, vel: vel.clone(), dmg, col, life: o.life || 7, grav: o.grav || 0, homing: o.homing || 0, r: (o.size || 0.4) * 0.9 + 0.25, onLand: o.onLand, slow: o.slow, pool: o.pool, spin: o.model && o.model !== 'orb' ? rand(4, 10) : 0, t: 0 };
  G.eproj.push(s); return s;
}
function lobShot(from, to, T, dmg, col, o = {}) {
  const g = 22, v = V3((to.x - from.x) / T, (to.y - from.y) / T + 0.5 * g * T, (to.z - from.z) / T);
  telegraphCircle(to.x, to.z, o.aoe || 2.5, T, col);
  return eShot(from, v, 0, col, { model: o.model, size: o.size || 0.55, grav: g, life: T + 0.5, onLand: p => { hostileImpact(p, o.aoe || 2.5, dmg, col, o); } });
}
function hostileImpact(p, r, dmg, col, o = {}) {
  FX.sphere(V3(p.x, 0.5, p.z), r, col, 0.3); FX.burst(V3(p.x, 0.3, p.z), col, 16, r * 2.5, 0.4, 0.5, { up: 3 }); FX.ring(V3(p.x, 0, p.z), r * 1.2, col, 0.35);
  if (r > 3) { AU.boom(false); shake(0.25); } else AU.slam();
  if (Math.hypot(PL.pos.x - p.x, PL.pos.z - p.z) < r + PL.hitR && PL.pos.y < 2.2) hurtPlayer(dmg);
  if (o.pool) hazardPool(p.x, p.z, o.poolR || r * 0.9, o.poolT || 4, o.pool, dmg * 0.4);
}
function updateEProj(dt) {
  if (G.timeStop > 0) return;
  for (let i = G.eproj.length - 1; i >= 0; i--) {
    const s = G.eproj[i]; s.life -= dt; s.t += dt;
    if (s.homing && s.t > 0.4) { _v4.set(PL.pos.x, PL.pos.y + 1.2, PL.pos.z).sub(s.pos).normalize(); const sp = s.vel.length(); _bd.copy(s.vel).normalize().lerp(_v4, Math.min(1, dt * s.homing)).normalize(); s.vel.copy(_bd).multiplyScalar(sp); }
    if (s.grav) s.vel.y -= s.grav * dt;
    s.pos.addScaledVector(s.vel, dt);
    if (s.spin) { s.m.rotation.y += s.spin * dt; s.m.rotation.x += s.spin * 0.5 * dt; }
    else if (s.vel.lengthSq() > 0.01) s.m.quaternion.setFromUnitVectors(ZAX, _bd.copy(s.vel).normalize());
    if (Math.random() < 0.25 * R.partMul) FX.trail(s.pos, s.col, s.r * 0.8, 0.25, 0.6);
    const dx = PL.pos.x - s.pos.x, dy = PL.pos.y + 1.1 - s.pos.y, dz = PL.pos.z - s.pos.z;
    if (s.dmg > 0 && dx * dx + dy * dy * 0.6 + dz * dz < (s.r + PL.hitR) * (s.r + PL.hitR) * 1.2) {
      hurtPlayer(s.dmg); if (s.slow) PL.slow = 2; FX.burst(s.pos, s.col, 10, 4, 0.3, 0.35);
      if (s.pool) hazardPool(s.pos.x, s.pos.z, 1.8, 3, 'toxic', s.dmg * 0.3);
      W.scene.remove(s.m); G.eproj.splice(i, 1); continue;
    }
    if (s.pos.y <= 0.05) { if (s.onLand) s.onLand(s.pos); else { FX.burst(V3(s.pos.x, 0.1, s.pos.z), s.col, 6, 3, 0.25, 0.3, { up: 2 }); if (s.pool) hazardPool(s.pos.x, s.pos.z, 1.8, 3, 'toxic', s.dmg * 0.3); } W.scene.remove(s.m); G.eproj.splice(i, 1); continue; }
    if (s.life <= 0 || Math.abs(s.pos.x) > 120 || Math.abs(s.pos.z) > 120) { W.scene.remove(s.m); G.eproj.splice(i, 1); }
  }
}

// ---------------- zones: telegraphs, pools, rings, beams ----------------
function addZone(z) { G.zones.push(z); return z; }
function updateZones(dt) {
  for (let i = G.zones.length - 1; i >= 0; i--) {
    const z = G.zones[i];
    if (G.timeStop > 0 && !z.player) continue;
    let alive = true; try { alive = z.update(dt) !== false; } catch (e) { console.error(e); alive = false; }
    if (!alive) { if (z.obj) { W.scene.remove(z.obj); disposeTemp(z.obj); } G.zones.splice(i, 1); }
  }
}
function decalCircle(x, z, r, col, op = 0.85) {
  const g = new THREE.Group(); g.position.set(x, 0.07, z);
  const ring = new THREE.Mesh(new THREE.RingGeometry(Math.max(0.01, r - 0.16), r, 40), tmat(col, op)); ring.rotation.x = -Math.PI / 2; g.add(ring);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(r, 40), tmat(col, 0.28)); fill.rotation.x = -Math.PI / 2; fill.position.y = -0.01; g.add(fill);
  W.scene.add(g); g.userData.fill = fill; return g;
}
function telegraphCircle(x, z, r, delay, col, onDone) {
  const g = decalCircle(x, z, r, col); g.userData.fill.scale.setScalar(0.01); let t = 0;
  return addZone({ obj: g, update(dt) { t += dt; const k = Math.min(1, t / delay); g.userData.fill.scale.setScalar(Math.max(0.01, k)); g.children[0].material.opacity = 0.5 + 0.5 * Math.sin(t * 20); if (k >= 1) { if (onDone) onDone(); return false; } } });
}
function telegraphLine(x, z, dx, dz, len, w, delay, col, onDone) {
  const g = new THREE.Group(); g.position.set(x, 0.07, z); g.rotation.y = Math.atan2(dx, dz);
  const out = new THREE.Mesh(new THREE.PlaneGeometry(w, len), tmat(col, 0.3)); out.rotation.x = -Math.PI / 2; out.position.z = len / 2; g.add(out);
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(w, 1), tmat(col, 0.55)); fill.rotation.x = -Math.PI / 2; g.add(fill);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.PlaneGeometry(0.12, len), tmat(col, 0.9)); e.rotation.x = -Math.PI / 2; e.position.set(s * w / 2, 0.005, len / 2); g.add(e); }
  W.scene.add(g); let t = 0;
  return addZone({ obj: g, update(dt) { t += dt; const k = Math.min(1, t / delay); fill.scale.y = Math.max(0.01, len * k); fill.position.z = len * k / 2; if (k >= 1) { if (onDone) onDone(); return false; } } });
}
function inLine(px, pz, x, z, dx, dz, len, w) { const l = Math.hypot(dx, dz) || 1; const ux = dx / l, uz = dz / l; const rx = px - x, rz = pz - z; const along = rx * ux + rz * uz, perp = Math.abs(rx * uz - rz * ux); return along > -1 && along < len && perp < w / 2 + PL.hitR; }
function hazardPool(x, z, r, dur, kind, dps) {
  const col = kind === 'fire' ? 0xff6a00 : kind === 'glitch' ? 0x00ff88 : 0x7cff00;
  const g = decalCircle(x, z, r, col, 0.9); g.userData.fill.material.opacity = 0.45; let t = 0, tick = 0;
  const glitchCubes = [];
  if (kind === 'glitch') for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(GB(0.5, 0.5, 0.5), tmat(pick([0x00ff88, 0xff00ff]), 0.9)); c.position.set(rand(-r, r) * 0.7, 0.3, rand(-r, r) * 0.7); g.add(c); glitchCubes.push(c); }
  return addZone({ obj: g, update(dt) {
    t += dt; tick -= dt;
    const fade = t > dur - 0.5 ? (dur - t) / 0.5 : Math.min(1, t * 3); g.userData.fill.material.opacity = 0.45 * fade; g.children[0].material.opacity = 0.9 * fade;
    if (Math.random() < 0.3 * R.partMul) { const a = rand(0, TAU), d = rand(0, r); FX.c.set(col); PG.spawn(x + Math.cos(a) * d, 0.1, z + Math.sin(a) * d, 0, rand(1, 2.5), 0, FX.c, 0.9, rand(0.25, 0.5), 0.7, kind === 'fire' ? -1 : 0, 0.5, 0); }
    glitchCubes.forEach(c => { if (Math.random() < 0.1) c.position.set(rand(-r, r) * 0.7, rand(0.2, 1.2), rand(-r, r) * 0.7); });
    if (tick <= 0 && Math.hypot(PL.pos.x - x, PL.pos.z - z) < r && PL.pos.y < 1) { tick = 0.25; hurtPlayer(dps * 0.25 + PL.maxHp * 0.015, { dot: true }); if (kind === 'glitch' && R.post) R.post.comp.uniforms.glitch.value = 0.5; }
    return t < dur;
  } });
}
function shockRing(x, z, spd, dmg, col, maxR = 40) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.9, 64, 1, true), tmat(col, 0.8)); m.position.set(x, 0.45, z);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), tmat(0xffffff, 0.9)); ring.rotation.x = -Math.PI / 2; ring.position.y = -0.4; m.add(ring);
  W.scene.add(m); let r = 1, hit = false;
  return addZone({ obj: m, update(dt) {
    r += spd * dt; m.scale.set(r, 1, r); m.material.opacity = 0.8 * (1 - r / maxR);
    const d = Math.hypot(PL.pos.x - x, PL.pos.z - z);
    if (!hit && Math.abs(d - r) < 0.9 && PL.pos.y < 0.85) { hit = true; hurtPlayer(dmg); }
    if (Math.random() < 0.6 * R.partMul) { const a = rand(0, TAU); FX.c.set(col); PG.spawn(x + Math.cos(a) * r, 0.3, z + Math.sin(a) * r, 0, rand(1, 3), 0, FX.c, 1, 0.4, 0.4, 3, 1, 0); }
    return r < maxR;
  } });
}
