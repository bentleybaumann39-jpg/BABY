// =====================================================================
//  COMBAT — bullets, damage, status effects, passives, pickups, deaths
// =====================================================================
const BGEO = () => kg('bullet', () => { const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1); g.rotateX(Math.PI / 2); return g; });
const ZAX = V3(0, 0, 1);
const PASSIVE_TRAIL = ['burn', 'frost', 'poison', 'chain', 'explosive', 'homing', 'vamp', 'split'];

function spawnBullet(origin, dir, speed, dmg, o = {}) {
  const colHex = new THREE.Color(o.kind === 'rocket' ? 0xff6a00 : (o.col ?? 0x00f0ff)).getHex();
  const m = new THREE.Mesh(BGEO(), matGlow(colHex, 1, true));
  const size = o.size || 0.1, len = o.len || 1.5;
  m.scale.set(size * 2, size * 2, len); m.position.copy(origin);
  m.quaternion.setFromUnitVectors(ZAX, dir);
  if (o.kind === 'rocket') { const r = new THREE.Mesh(GC(0.14, 0.14, 0.9, 8), matStd(0xd0d8e0, { m: 0.8, r: 0.3 })); r.rotation.x = Math.PI / 2; m.add(r); r.scale.set(1 / (size * 2), 1 / (size * 2), 1 / len); }
  W.scene.add(m);
  const tp = o.ally ? null : PASSIVE_TRAIL.find(p => PL.pw[p]);
  const b = {
    mesh: m, pos: m.position, vel: dir.clone().multiplyScalar(speed), dmg, life: o.life ?? (o.kind === 'rocket' ? 2.5 : 1.3), pierce: o.pierce || 0,
    bounces: o.ally || o.noProc ? 0 : (PL.pw.ricochet || 0), homing: o.homing ?? (o.ally ? 0 : (PL.pw.homing || 0)), explode: o.explode || 0, split: !o.noSplit && !o.ally && PL.pw.split,
    hit: new Set(), kind: o.kind || 'bullet', col: colHex, ally: !!o.ally, proc: !o.noProc && !o.ally, tgt: null, tgtT: 0, trail: tp ? PASSIVES[tp].c : null, ult: !!o.ult, onHit: o.onHit, grav: o.grav || 0
  };
  G.bullets.push(b); return b;
}
function removeBullet(i) { const b = G.bullets[i]; W.scene.remove(b.mesh); G.bullets.splice(i, 1); }
function nearestEnemy(p, maxD, excl, front) {
  let best = null, bd = maxD * maxD;
  for (const e of G.enemies) {
    if (e.dead || e.rising > 0 || (excl && excl.has(e))) continue;
    const dx = e.pos.x - p.x, dz = e.pos.z - p.z, d2 = dx * dx + dz * dz;
    if (d2 < bd) { if (front && (dx * front.x + dz * front.z) < 0) continue; bd = d2; best = e; }
  }
  return best;
}
function enemyCenter(e, out) { return out.set(e.pos.x, e.pos.y + (e.boss ? e.boss.B.h * 0.45 : e.h * e.scale * 0.55), e.pos.z); }

const _bp0 = V3(), _bd = V3(), _bc = V3();
function updateBullets(dt) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.life -= dt;
    if (b.life <= 0) { if (b.kind === 'rocket' || b.kind === 'meteor') detonate(b, b.pos); removeBullet(i); continue; }
    if (b.homing) {
      b.tgtT -= dt;
      if (b.tgtT <= 0 || !b.tgt || b.tgt.dead) { _bd.copy(b.vel).normalize(); b.tgt = nearestEnemy(b.pos, 40, b.hit, _bd); b.tgtT = 0.2; }
      if (b.tgt) { const sp = b.vel.length(); enemyCenter(b.tgt, _bc).sub(b.pos).normalize(); _bd.copy(b.vel).normalize().lerp(_bc, Math.min(1, dt * (1.5 + 1.6 * b.homing))).normalize(); b.vel.copy(_bd).multiplyScalar(sp); }
    }
    if (b.grav) b.vel.y -= b.grav * dt;
    _bp0.copy(b.pos); b.pos.addScaledVector(b.vel, dt);
    if (b.trail && Math.random() < 0.5 * R.partMul) FX.trail(b.pos, b.trail, 0.22, 0.2, 0.7);
    if (b.kind === 'rocket' && Math.random() < 0.9) { FX.trail(b.pos, 0xffaa33, 0.4, 0.25); FX.c.set(0x555555); PS.spawn(b.pos.x, b.pos.y, b.pos.z, rand(-0.3, 0.3), rand(0, 0.6), rand(-0.3, 0.3), FX.c, 0.4, 0.5, 0.8, -0.3, 1, 2); }
    b.mesh.quaternion.setFromUnitVectors(ZAX, _bd.copy(b.vel).normalize());
    if (b.pos.y < 0) { FX.burst(V3(b.pos.x, 0.05, b.pos.z), b.col, 5, 3, 0.2, 0.25, { up: 2 }); if (b.explode || b.kind === 'meteor') detonate(b, b.pos); removeBullet(i); continue; }
    // segment vs spheres
    const sx = b.pos.x - _bp0.x, sy = b.pos.y - _bp0.y, sz = b.pos.z - _bp0.z, sl2 = sx * sx + sy * sy + sz * sz;
    let hitE = null, hitT = 2, head = false;
    for (const e of G.enemies) {
      if (e.dead || e.rising > 0 || b.hit.has(e)) continue;
      if (Math.abs(e.pos.x - b.pos.x) > 14 || Math.abs(e.pos.z - b.pos.z) > 14) continue;
      for (const s of e.sph) {
        const cx = s[0] - _bp0.x, cy = s[1] - _bp0.y, cz = s[2] - _bp0.z;
        let t = sl2 > 0 ? (cx * sx + cy * sy + cz * sz) / sl2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = cx - sx * t, dy = cy - sy * t, dz = cz - sz * t, rr = s[3] + (b.kind === 'rocket' ? 0.3 : 0.05);
        if (dx * dx + dy * dy + dz * dz < rr * rr && t < hitT) { hitT = t; hitE = e; head = !!s[4]; }
      }
    }
    if (hitE) {
      const pt = _bp0.clone().addScaledVector(V3(sx, sy, sz), hitT);
      bulletHit(b, hitE, head, pt);
      if (b.pierce > 0 && b.kind !== 'rocket') { b.pierce--; b.hit.add(hitE); continue; }
      if (b.bounces > 0) { b.bounces--; b.hit.add(hitE); const n = nearestEnemy(pt, 16, b.hit); if (n) { const sp = b.vel.length(); b.vel.copy(enemyCenter(n, _bc).sub(pt).normalize().multiplyScalar(sp)); b.pos.copy(pt); b.life = Math.max(b.life, 0.6); continue; } }
      removeBullet(i);
    }
  }
}
function detonate(b, p) {
  const r = b.explode || 3.5;
  blast(p, r, b.dmg * (b.kind === 'meteor' ? 1 : 0.75), b.col, { big: r > 4 });
}
function bulletHit(b, e, head, pt) {
  const L = id => PL.pw[id] || 0;
  let dmg = b.dmg, crit = false;
  if (!b.ally && !b.ult) {
    if (head && b.kind !== 'rocket') { dmg *= 1.6; crit = true; }
    if (L('crit') && Math.random() < 0.1 + 0.06 * L('crit')) { dmg *= 2.2 + 0.3 * L('crit'); crit = true; }
  }
  FX.burst(pt, b.col, crit ? 9 : 5, 4, 0.22, 0.25, { g: 2 });
  if (b.onHit) b.onHit(e, pt);
  if (b.kind === 'rocket' || b.explode) { detonate(b, pt); if (e.dead) return; }
  const W0 = WEAPONS[PL.w];
  damageEnemy(e, dmg, { crit, head: head && crit, bullet: !b.ally, col: crit ? '#FFE600' : '#FFFFFF', dir: b.vel, ult: b.ally ? 0 : (0.9 + 0.5 * W0.dmg) });
  if (b.proc && !e.dead) applyOnHit(e, dmg, b, pt);
  else if (b.proc && e.dead) { if (L('split') && b.split) splitShards(b, pt); }
}
function applyOnHit(e, dmg, b, pt) {
  const L = id => PL.pw[id] || 0;
  if (L('burn')) { e.burn.dps = Math.max(e.burn.dps, dmg * 0.25 * L('burn')); e.burn.t = 3; }
  if (L('poison')) { e.poison.st = Math.min(8, e.poison.st + 1); e.poison.dps = Math.max(e.poison.dps, dmg * 0.12 * L('poison')); e.poison.t = 4; }
  if (L('frost') && !e.boss) { e.chill += 15 + 8 * L('frost'); if (e.chill >= 100) freezeEnemy(e, 1.6); }
  else if (L('frost') && e.boss) e.chill = Math.min(60, e.chill + 4);
  if (L('chain') && Math.random() < 0.2 + 0.1 * L('chain')) chainLightning(e, dmg * 0.55, 1 + Math.ceil(L('chain') / 2), 0xb57cff);
  if (L('explosive')) blast(pt, 1.6 + 0.5 * L('explosive'), dmg * (0.3 + 0.1 * L('explosive')), 0xff9f1a, { small: true, excl: e });
  if (L('knock') && !e.boss) { _bd.copy(b.vel).setY(0).normalize(); e.kb.addScaledVector(_bd, 7 + 2 * L('knock')); e.stun = Math.max(e.stun, 0.2); }
  if (L('split') && b.split) splitShards(b, pt);
}
function splitShards(b, pt) {
  const n = 1 + (PL.pw.split || 0);
  for (let i = 0; i < n; i++) { const d = V3(rand(-1, 1), rand(-0.1, 0.25), rand(-1, 1)).normalize(); const s = spawnBullet(pt, d, 60, b.dmg * 0.35, { col: 0x7af8ff, size: 0.06, len: 0.8, noSplit: true, noProc: true, life: 0.35 }); b.hit.forEach(h => s.hit.add(h)); }
}
function freezeEnemy(e, t) { if (e.boss) return; e.frozen = Math.max(e.frozen, t); e.chill = 0; AU.freeze(); FX.burst(enemyCenter(e, _bc), 0x9ae8ff, 12, 3, 0.3, 0.5); }
function chainLightning(src, dmg, n, col) {
  const hit = new Set([src]); let from = enemyCenter(src, V3()).clone();
  for (let k = 0; k < n; k++) {
    const t = nearestEnemy(from, 11, hit); if (!t) break; hit.add(t);
    const to = enemyCenter(t, V3()).clone(); FX.lightning(from, to, col, 0.2); damageEnemy(t, dmg, { col: '#C9A0FF' }); from = to;
  }
  AU.zap();
}
function blast(p, r, dmg, col, o = {}) {
  if (o.small) { FX.sphere(p, r, col, 0.25); FX.burst(p, col, 10, r * 3, 0.3, 0.35, { g: 3 }); }
  else { FX.explosion(p, r, col, o.big); AU.boom(o.big); }
  for (const e of G.enemies) {
    if (e.dead || e === o.excl) continue;
    const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z) - (e.boss ? e.boss.def.r : e.def.r * e.scale);
    if (d < r && Math.abs(e.pos.y - p.y) < r + (e.boss ? 6 : 3)) damageEnemy(e, dmg * (1 - 0.5 * Math.max(0, d) / r), { col: '#FFAA33', explosive: true });
  }
}

// ---------------- damage ----------------
function damageEnemy(e, dmg, o = {}) {
  if (e.dead || e.rising > 0) return 0;
  if (e.def && e.def.armor && !o.crit && !o.explosive) dmg *= 1 - e.def.armor;
  if (e.frozen > 0) dmg *= 1.5;
  if (e.boss && e.boss.intro > 0) dmg *= 0.25;
  e.hp -= dmg; e.hpT = 3; e.flash = 0.09;
  if (o.num !== false) { const c = enemyCenter(e, _bc); FX.num(V3(c.x, c.y + (e.boss ? e.boss.B.h * 0.4 : e.h * e.scale * 0.5), c.z), dmg, o.col || '#fff', o.crit); }
  if (o.bullet) { OV.hit = 0.15; if (o.crit) OV.hitCrit = 0.15; AU.hit(o.crit); }
  if (o.ult) addUlt(o.ult * (e.boss ? 0.65 : 1));
  if (PL.pw.vamp && !o.noVamp) { const room = PL.maxHp * 0.05 - PL.vampPool; if (room > 0) { const h = Math.min(room, dmg * 0.015 * PL.pw.vamp); PL.vampPool += h; healPlayer(h, true); } }
  if (PL.pw.execute && !e.boss && e.hp > 0 && e.hp / e.maxHp < 0.08 + 0.04 * PL.pw.execute) { e.hp = 0; FX.num(enemyCenter(e, _bc).clone().setY(e.pos.y + e.h * e.scale + 0.8), 'EXECUTED', '#E0E0E0', true); }
  if (e.hp <= 0) killEnemy(e, o);
  else if (e.boss) updateBossBar();
  return dmg;
}
function healPlayer(h, quiet) {
  if (G.dead) return; const before = PL.hp; PL.hp = Math.min(PL.maxHp, PL.hp + h);
  if (!quiet && PL.hp - before > 1) { FX.num(V3(PL.pos.x, PL.pos.y + PL.height + 0.3, PL.pos.z), '+' + Math.round(PL.hp - before), '#4CFF7A'); AU.heal(); }
}
function addUlt(a) {
  if (PL.ult >= 100) return;
  PL.ult = Math.min(100, PL.ult + a * PL.ultMul);
  if (PL.ult >= 100) { AU.tone(880, 'triangle', 0.3, 0.12); AU.tone(1320, 'triangle', 0.4, 0.1, { delay: 0.1 }); }
}
function hurtPlayer(dmg, o = {}) {
  if (G.dead || !G.playing || dmg <= 0) return;
  if (!o.dot && PL.iT > 0) return;
  if (G.boss && G.boss.boss && G.boss.boss.intro > 0) return;
  const L = id => PL.pw[id] || 0;
  if (!o.dot && L('phase') && Math.random() < 0.07 * L('phase')) { if (PL.dodgeT <= 0) { FX.num(V3(PL.pos.x, PL.pos.y + PL.height, PL.pos.z), 'DODGE', '#C0C0FF'); PL.dodgeT = 0.3; } PL.iT = 0.25; return; }
  if (PL.shield > 0) { const a = Math.min(PL.shield, dmg); PL.shield -= a; dmg -= a; AU.shieldHit(); }
  PL.hp -= dmg; PL.lastHit = G.t;
  if (!o.dot) { PL.iT = 0.3; AU.hurt(); shake(0.35); R.post && (R.post.comp.uniforms.hurt.value = Math.min(1, R.post.comp.uniforms.hurt.value + 0.6)); $('vignette').style.opacity = '1'; setTimeout(() => $('vignette').style.opacity = '0', 140); FX.num(V3(PL.pos.x, PL.pos.y + PL.height, PL.pos.z), '-' + Math.ceil(dmg), '#FF3355'); }
  if (!o.dot && L('thorns') && G.t - (PL.thornT || -9) > 0.4) { PL.thornT = G.t; const p = V3(PL.pos.x, 1, PL.pos.z); FX.ring(p, 5, 0x7cff4d, 0.35); for (const e of G.enemies) if (!e.dead && dist2(e.pos, PL.pos) < 5 + (e.boss ? e.boss.def.r : 0)) damageEnemy(e, playerBaseDmg() * 0.8 * L('thorns'), { col: '#7CFF4D' }); }
  if (PL.hp <= 0) {
    if (L('undying') && !PL.revived) {
      PL.revived = true; PL.hp = PL.maxHp * (0.3 + 0.1 * L('undying')); PL.iT = 2;
      banner('UNDYING', 'You refuse to fall!', '#FFE27A', 1.6);
      blast(V3(PL.pos.x, 1, PL.pos.z), 9, playerBaseDmg() * 6, 0xffaa00, { big: true });
      return;
    }
    playerDied();
  }
}

// ---------------- enemy status ticking ----------------
function tickStatus(e, dt) {
  if (e.burn.t > 0) { e.burn.t -= dt; e.dot += e.burn.dps * dt; if (Math.random() < 0.4 * R.partMul) { enemyCenter(e, _bc); FX.c.set(Math.random() < 0.5 ? 0xff6a00 : 0xffcc33); PG.spawn(_bc.x + rand(-0.4, 0.4), _bc.y + rand(-0.5, 0.5), _bc.z + rand(-0.4, 0.4), 0, rand(1, 2.5), 0, FX.c, 1, 0.3, 0.45, -1, 1, -0.5); } }
  if (e.poison.t > 0) { e.poison.t -= dt; e.dot += e.poison.dps * e.poison.st * dt; if (Math.random() < 0.25 * R.partMul) { enemyCenter(e, _bc); FX.c.set(0x7cff4d); PG.spawn(_bc.x + rand(-0.4, 0.4), _bc.y, _bc.z + rand(-0.4, 0.4), 0, rand(0.5, 1.5), 0, FX.c, 0.9, 0.25, 0.6, 0, 1, 0); } } else e.poison.st = 0;
  if (e.chill > 0) e.chill = Math.max(0, e.chill - dt * 12);
  if (e.frozen > 0) e.frozen -= dt;
  if (e.stun > 0) e.stun -= dt;
  e.dotT -= dt;
  if (e.dotT <= 0) {
    e.dotT = 0.5;
    if (e.dot > 0) { const d = e.dot; e.dot = 0; damageEnemy(e, d, { col: e.burn.t > 0 ? '#FF7A1A' : '#7CFF4D', noVamp: false }); }
  }
}

// ---------------- kills & deaths ----------------
function killEnemy(e, o = {}) {
  if (e.dead) return; e.dead = true;
  if (e.boss) { defeatBoss(e); return; }
  G.kills++; G.runKills++; S.stats.kills++; S.bpXp += e.elite ? 5 : 1;
  OV.hitKill = 0.2; AU.kill(); addUlt(3);
  const c = enemyCenter(e, V3()).clone();
  const coins = Math.round((6 + G.realm * 2.5) * e.def.coin * (e.elite ? 4 : 1) * PL.coinMult);
  if (coins > 0) { const n = Math.min(6, Math.max(1, Math.ceil(coins / 15))); for (let i = 0; i < n; i++) spawnPickup('coin', c, Math.ceil(coins / n)); }
  if (Math.random() < (e.elite ? 0.6 : 0.06)) spawnPickup('heart', c, 0);
  if (Math.random() < (e.elite ? 0.6 : 0.07)) spawnPickup('soul', c, 0);
  deathFX(e, c);
  if (e.def.split) for (let i = 0; i < 2; i++) spawnEnemy('mini', V3(e.pos.x + rand(-1, 1), 0, e.pos.z + rand(-1, 1)), { noRise: true });
  if (e.type === 'exploder') hostileBlast(c, 3.8, e.dmg * 1.1, 0x9dff00, true);
  updateRealmBar();
  if (!G.boss && !G.bossDone && G.kills >= G.killsNeed) startBossSequence();
}
function deathFX(e, c) {
  const eyeC = e.model.mats[0] ? new THREE.Color(BIOMES[G.biome].skin.e).getHex() : 0xffffff;
  FX.burst(c, eyeC, 22, 6, 0.4, 0.7, { g: 3 });
  FX.burst(c, 0xaa0010, 14, 5, 0.3, 0.6, { g: 12, a: 0.9 });
  FX.smoke(c, 0x1a1a1a, 3, 1, 0.8, 0.8);
  FX.ring(V3(c.x, 0, c.z), 2.2, eyeC, 0.4);
  // fling body parts
  const p = e.model.parts, parts = [p.head, p.armL, p.armR, p.legL, p.legR].filter(Boolean);
  e.model.group.updateMatrixWorld(true);
  for (const part of parts) {
    if (G.chunks.length > 90) break;
    W.scene.attach(part);
    G.chunks.push({ o: part, v: V3(rand(-5, 5), rand(4, 9), rand(-5, 5)), r: V3(rand(-8, 8), rand(-8, 8), rand(-8, 8)), t: 0, life: rand(1.4, 2.2), s: part.scale.x });
  }
  // ground splat
  const sp = new THREE.Mesh(new THREE.CircleGeometry(rand(0.9, 1.6), 10), tmat(0x6a0008, 0.75, false)); sp.rotation.x = -Math.PI / 2; sp.position.set(c.x, 0.03 + Math.random() * 0.01, c.z);
  tempMesh(sp, 6, (m, k) => m.material.opacity = 0.75 * (1 - k * k));
  W.scene.remove(e.model.group);
  G.chunks.push({ disposeOnly: e.model.group, t: 0, life: 2.5 });
}
function updateChunks(dt) {
  for (let i = G.chunks.length - 1; i >= 0; i--) {
    const c = G.chunks[i]; c.t += dt;
    if (c.disposeOnly) { if (c.t > c.life) { disposeModel(c.disposeOnly); G.chunks.splice(i, 1); } continue; }
    c.v.y -= 22 * dt; c.o.position.addScaledVector(c.v, dt);
    if (c.o.position.y < 0.15) { c.o.position.y = 0.15; c.v.y *= -0.3; c.v.x *= 0.6; c.v.z *= 0.6; c.r.multiplyScalar(0.6); }
    c.o.rotation.x += c.r.x * dt; c.o.rotation.y += c.r.y * dt; c.o.rotation.z += c.r.z * dt;
    const k = c.t / c.life; if (k > 0.7) c.o.scale.setScalar(c.s * Math.max(0.01, 1 - (k - 0.7) / 0.3));
    if (k >= 1) { W.scene.remove(c.o); G.chunks.splice(i, 1); }
  }
}
function hostileBlast(p, r, dmg, col, hitsEnemies) {
  FX.explosion(p, r, col, false); AU.boom(false);
  if (Math.hypot(PL.pos.x - p.x, PL.pos.z - p.z) < r + PL.hitR && PL.pos.y < p.y + r) hurtPlayer(dmg);
  if (hitsEnemies) for (const e of G.enemies) if (!e.dead && !e.boss && dist2(e.pos, p) < r) damageEnemy(e, dmg * 0.6, { col: '#9DFF00', explosive: true });
}

// ---------------- pickups ----------------
function spawnPickup(kind, p, val) {
  let m;
  if (kind === 'coin') { m = new THREE.Mesh(GC(0.28, 0.28, 0.07, 14), matStd(0xffcc22, { r: 0.25, m: 1, e: 0x664400, ei: 0.6 })); m.rotation.x = Math.PI / 2; const g = new THREE.Group(); g.add(m); m = g; }
  else if (kind === 'heart') { m = new THREE.Group(); const h = new THREE.Mesh(GO(0.32), matGlow(0x4cff7a, 1, false)); m.add(h); m.add(glowSprite(0x4cff7a, 1.6, 0.8)); }
  else { m = new THREE.Group(); const h = new THREE.Mesh(GS(0.25, 10, 8), matGlow(0xff00aa, 1, false)); m.add(h); m.add(glowSprite(0xff00aa, 1.6, 0.8)); }
  m.position.copy(p); W.scene.add(m);
  G.pickups.push({ kind, m, val, v: V3(rand(-3, 3), rand(4, 7), rand(-3, 3)), t: 0 });
}
function updatePickups(dt) {
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const p = G.pickups[i]; p.t += dt;
    const dx = PL.pos.x - p.m.position.x, dy = PL.pos.y + 1 - p.m.position.y, dz = PL.pos.z - p.m.position.z, d = Math.hypot(dx, dy, dz);
    if (d < PL.magnet && p.t > 0.35) { const sp = Math.max(10, 30 - d * 2); p.v.set(dx / d * sp, dy / d * sp, dz / d * sp); }
    else { p.v.y -= 20 * dt; p.v.x *= 0.98; p.v.z *= 0.98; }
    p.m.position.addScaledVector(p.v, dt);
    if (p.m.position.y < 0.4) { p.m.position.y = 0.4; p.v.y = Math.abs(p.v.y) * 0.4; }
    p.m.rotation.y += dt * 4;
    if (d < 1.3 && p.t > 0.25) {
      if (p.kind === 'coin') { S.coins += p.val; G.runCoins += p.val; AU.coin(); updateCoinsHud(); }
      else if (p.kind === 'heart') healPlayer(PL.maxHp * 0.25);
      else { addUlt(15); AU.tone(990, 'sine', 0.2, 0.1, { to: 1600 }); }
      W.scene.remove(p.m); G.pickups.splice(i, 1); continue;
    }
    if (p.t > 25) { W.scene.remove(p.m); G.pickups.splice(i, 1); }
  }
}

// ---------------- passive abilities that tick ----------------
function updatePassives(dt) {
  const L = id => PL.pw[id] || 0, T = PL.timers;
  PL.vampPool = Math.max(0, PL.vampPool - PL.maxHp * 0.05 * dt);
  if (PL.dodgeT > 0) PL.dodgeT -= dt;
  if (L('regen') && PL.hp < PL.maxHp) PL.hp = Math.min(PL.maxHp, PL.hp + PL.maxHp * 0.008 * L('regen') * dt);
  if (PL.maxShield && G.t - PL.lastHit > 4 && PL.shield < PL.maxShield) PL.shield = Math.min(PL.maxShield, PL.shield + PL.maxShield * 0.3 * dt);
  const base = playerBaseDmg();
  if (L('aura')) {
    const r = 3 + L('aura'); T.aura = (T.aura || 0) - dt;
    if (Math.random() < 0.7 * R.partMul) { const a = rand(0, TAU); FX.c.set(Math.random() < 0.5 ? 0xff5a1a : 0xffaa33); PG.spawn(PL.pos.x + Math.cos(a) * r, 0.2, PL.pos.z + Math.sin(a) * r, 0, rand(1, 2.5), 0, FX.c, 0.9, 0.35, 0.5, -0.5, 1, -0.4); }
    if (T.aura <= 0) { T.aura = 0.5; for (const e of G.enemies) if (!e.dead && dist2(e.pos, PL.pos) < r + (e.boss ? e.boss.def.r : 0)) { damageEnemy(e, base * 0.35 * L('aura'), { col: '#FF7A1A' }); e.burn.t = Math.max(e.burn.t, 1); e.burn.dps = Math.max(e.burn.dps, base * 0.1 * L('aura')); } }
  }
  if (L('frostaura') && Math.random() < 0.5 * R.partMul) { const a = rand(0, TAU), r = 4 + L('frostaura'); FX.c.set(0xc8f0ff); PG.spawn(PL.pos.x + Math.cos(a) * r * Math.random(), rand(0.2, 2.5), PL.pos.z + Math.sin(a) * r * Math.random(), 0, -0.4, 0, FX.c, 0.8, 0.15, 1, 0, 0, 0); }
  if (L('necro')) { T.necro = (T.necro || 3) - dt; if (T.necro <= 0) { T.necro = 10 - L('necro'); if (G.allies.filter(a => a.kind === 'skeleton').length < 1 + L('necro')) spawnAlly('skeleton', V3(PL.pos.x + rand(-3, 3), 0, PL.pos.z + rand(-3, 3)), { life: 30 }); } }
  if (L('meteor')) { T.meteor = (T.meteor || 2) - dt; if (T.meteor <= 0) { T.meteor = 6 - 0.8 * L('meteor'); const e = randomEnemyNear(PL.pos, 30); if (e) fallingStar(V3(e.pos.x, 0, e.pos.z), base * 2.5 * L('meteor'), 0xff8a3d, 2.5 + L('meteor') * 0.3); } }
  if (L('thunder')) { T.thunder = (T.thunder || 1.5) - dt; if (T.thunder <= 0) { T.thunder = 3; for (let k = 0; k < L('thunder'); k++) { const e = randomEnemyNear(PL.pos, 26); if (!e) break; const c = enemyCenter(e, V3()).clone(); FX.lightning(V3(c.x + rand(-2, 2), 22, c.z + rand(-2, 2)), c, 0x9a7cff, 0.25); FX.flash(c, 0x9a7cff, 4, 12); damageEnemy(e, base * 1.6, { col: '#B9A0FF' }); } if (G.enemies.length) AU.zap(); } }
}
function randomEnemyNear(p, r) { const c = G.enemies.filter(e => !e.dead && e.rising <= 0 && dist2(e.pos, p) < r); return c.length ? pick(c) : null; }
function fallingStar(target, dmg, col, r) {
  const start = V3(target.x + rand(-6, 6), 30, target.z + rand(-6, 6));
  const dir = target.clone().sub(start).normalize();
  const b = spawnBullet(start, dir, 45, dmg, { col, size: 0.6, len: 3, noProc: true, noSplit: true, kind: 'meteor', homing: 0, life: 3 });
  b.explode = r; b.bounces = 0; b.pierce = 0;
  b.mesh.add(glowSprite(col, 3, 0.9));
}
