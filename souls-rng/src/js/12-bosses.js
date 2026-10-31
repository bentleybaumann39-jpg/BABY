// =====================================================================
//  BOSSES — spawn, movement, 20 attack types, phases, defeat, portal
// =====================================================================
function startBossSequence() {
  if (G.boss || G.bossPending || G.bossDone) return; G.bossPending = true;
  banner('⚠ WARNING ⚠', 'A BOSS IS COMING', '#FF2A55', 2.2);
  for (let i = 0; i < 3; i++) AU.tone(440, 'square', 0.3, 0.12, { delay: i * 0.55, to: 220 });
  updateRealmBar();
  later(2.4, () => { G.bossPending = false; if (G.playing && !G.dead) spawnBoss(); });
}
function bossHp(realm) { return 3200 * (1 + 0.5 * (realm - 1)) * Math.pow(1.09, realm - 1); }
function spawnBoss() {
  const def = BOSSES[G.biome % BOSSES.length], B = buildBoss(def);
  const loop = Math.floor((G.realm - 1) / BIOMES.length);
  const fx = -Math.sin(PL.yaw), fz = -Math.cos(PL.yaw);
  let px = PL.pos.x + fx * 18, pz = PL.pos.z + fz * 18; const d = Math.hypot(px, pz); if (d > ARENA - 6) { px *= (ARENA - 6) / d; pz *= (ARENA - 6) / d; }
  B.group.position.set(px, 0, pz);
  if (loop > 0) B.group.scale.setScalar(1 + loop * 0.1);
  W.scene.add(B.group);
  const hp = bossHp(G.realm) * def.hp;
  const e = {
    type: 'boss', def: { r: def.r, coin: 0, n: def.n }, model: { group: B.group, parts: { body: B.body }, mats: B.mats }, pos: B.group.position, hp, maxHp: hp,
    dmg: 14 * dmgScale(G.realm) * (1 + 0.04 * (G.realm - 1)), spd: def.move[1] || 0, r: def.r, h: B.h, scale: 1, elite: false,
    burn: { dps: 0, t: 0 }, poison: { st: 0, dps: 0, t: 0 }, chill: 0, frozen: 0, stun: 0, flash: 0, hpT: 0, dead: false, dot: 0, dotT: 0.5, kb: V3(), sph: [], tint: -1, rising: 0, moving: 0,
    boss: { def, B, phase: 1, atkCd: 2.8, busy: 0, last: '', intro: 2.4, hopT: 1, hop: null, ang: rand(0, TAU), lockMove: 0, charging: false, hist: [] }
  };
  if (B.serpent) { const hd = B.serpent.hd; hd.position.set(px, 2, pz); B.group.position.set(0, 0, 0); e.pos = hd.position; for (let i = 0; i < 400; i++) B.serpent.hist.push(hd.position.clone()); }
  G.enemies.push(e); G.boss = e;
  // HUD + intro
  $('hudRealm').style.display = 'none'; $('hudBoss').style.display = 'block';
  $('hbName').textContent = def.n + (loop ? ' ' + 'I'.repeat(loop + 1) : ''); $('hbPower').textContent = 'POWER: ' + def.pow.toUpperCase(); $('hbPhase').textContent = '';
  updateBossBar();
  banner(def.n, def.pow.toUpperCase(), '#FF2A55', 2.6);
  AU.roar(); shake(1.2); MUSIC.intensity = 1;
  FX.ring(V3(px, 0, pz), 14, 0xff2a55, 1.0); FX.burst(V3(px, 0.5, pz), 0x6a5a4a, 40, 10, 0.6, 1, { up: 6 });
  if (!B.serpent && def.move[0] !== 'fly') B.group.position.y = -B.h;
}
function updateBossBar() {
  const e = G.boss; if (!e) return;
  const f = Math.max(0, e.hp / e.maxHp) * 100;
  $('hbFill').style.width = f + '%'; $('hbLag').style.width = f + '%';
  if (e.boss.phase === 1 && e.hp / e.maxHp < 0.5 && !e.dead) enterPhase2(e);
}
function enterPhase2(e) {
  const bs = e.boss; bs.phase = 2; bs.atkCd = 0.6;
  banner('ENRAGED!', 'THE BOSS GROWS STRONGER', '#FF6A00', 1.8); AU.roar(); shake(1);
  $('hbPhase').textContent = 'PHASE 2';
  FX.ring(V3(e.pos.x, 0, e.pos.z), 16, 0xff3a00, 0.8); FX.explosion(V3(e.pos.x, bs.B.h * 0.5, e.pos.z), 5, 0xff3a00, true);
  e.model.mats.forEach(m => { if (m.emissive) { m.userData.baseE = 0x401000; } }); e.tint = -1;
  if (!bs.B.serpent) bs.B.group.scale.multiplyScalar(1.08);
}
const _be = V3(), _bt = V3();
function eyePos(B, out) { return B.eye.getWorldPosition(out); }
function updateBossSpheres(e) {
  const B = e.boss.B; e.sph.length = 0;
  if (B.serpent) { const hd = B.serpent.hd; e.sph.push([hd.position.x, hd.position.y, hd.position.z, 1.6, 1]); B.serpent.segs.forEach((s, i) => { if (i % 2 === 0) e.sph.push([s.position.x, s.position.y, s.position.z, 1.1 - i * 0.03, 0]); }); return; }
  const gs = B.group.scale.x, by = B.body.position.y;
  e.sph.push([e.pos.x, e.pos.y + by + B.h * 0.45 * gs, e.pos.z, e.r * 1.15 * gs, 0]);
  eyePos(B, _be); e.sph.push([_be.x, _be.y, _be.z, 0.9 * gs, 1]);
  B.heads.forEach(H => { if (H.hd) { H.hd.getWorldPosition(_bt); e.sph.push([_bt.x, _bt.y, _bt.z, 1.2, 1]); } });
}
function updateBoss(e, dt) {
  const bs = e.boss, B = bs.B, def = bs.def;
  B.group.updateMatrixWorld(true);
  updateBossSpheres(e);
  if (B.anim) B.anim(G.t, dt, bs);
  tickStatus(e, dt); if (e.dead) return;
  if (e.flash > 0 !== (e.tint === 1)) { e.tint = e.flash > 0 ? 1 : 0; e.model.mats.forEach(m => { if (m.emissive) m.emissive.setHex(e.tint ? 0xffffff : m.userData.baseE || 0); }); }
  if (bs.phase === 2 && !e.tint) { const k = 0.5 + 0.5 * Math.sin(G.t * 6); e.model.mats.forEach(m => { if (m.emissive) m.emissiveIntensity = 0.6 + k * 0.8; }); }
  const dx = PL.pos.x - e.pos.x, dz = PL.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 0.01, nx = dx / d, nz = dz / d;
  if (bs.intro > 0) {
    bs.intro -= dt;
    if (!B.serpent && def.move[0] !== 'fly') { B.group.position.y = Math.min(0, -B.h * Math.max(0, (bs.intro - 0.6) / 1.8)); if (Math.random() < 0.6) FX.burst(V3(e.pos.x + rand(-def.r, def.r), 0.2, e.pos.z + rand(-def.r, def.r)), 0x6a5a4a, 3, 4, 0.5, 0.6, { up: 4 }); }
    if (def.move[0] === 'fly') B.group.position.y = lerp(B.group.position.y, 7, dt * 2);
    B.group.rotation.y = Math.atan2(nx, nz);
    return;
  }
  if (G.timeStop > 0) return;
  const spdM = bs.phase === 2 ? 1.25 : 1;
  bs.busy -= dt; bs.atkCd -= dt; if (bs.lockMove > 0) bs.lockMove -= dt;
  // ---- movement ----
  const mv = def.move[0];
  if (bs.lockMove <= 0) {
    if (mv === 'walk') { const pref = def.r + 5; if (d > pref) { e.pos.x += nx * e.spd * spdM * dt; e.pos.z += nz * e.spd * spdM * dt; e.moving = 1; } else e.moving = 0; }
    else if (mv === 'hop') { if (bs.hop) { bs.hop.t += dt; const k = Math.min(1, bs.hop.t / 0.7); e.pos.x = lerp(bs.hop.a.x, bs.hop.b.x, k); e.pos.z = lerp(bs.hop.a.z, bs.hop.b.z, k); e.pos.y = Math.sin(k * Math.PI) * 3; if (k >= 1) { bs.hop = null; e.pos.y = 0; shake(0.3); AU.slam(); FX.ring(V3(e.pos.x, 0, e.pos.z), def.r + 3, 0xaa88ff, 0.4); FX.burst(V3(e.pos.x, 0.2, e.pos.z), 0x6a5a4a, 14, 5, 0.5, 0.6, { up: 3 }); if (d < def.r + 1.5) hurtPlayer(e.dmg); } } else { bs.hopT -= dt; if (bs.hopT <= 0 && bs.busy <= 0) { bs.hopT = 1.3 / spdM; const step = Math.min(Math.max(0, d - def.r - 3), 9); bs.hop = { a: e.pos.clone(), b: V3(e.pos.x + nx * step, 0, e.pos.z + nz * step), t: 0 }; } } }
    else if (mv === 'hover') { bs.ang += (def.move[1] || 0) * 0.07 * spdM * dt; const tx = PL.pos.x + Math.cos(bs.ang) * 14, tz = PL.pos.z + Math.sin(bs.ang) * 14; const ddx = tx - e.pos.x, ddz = tz - e.pos.z, dd = Math.hypot(ddx, ddz); if (dd > 0.5) { const s = Math.min(dd, 5.5 * spdM * dt); e.pos.x += ddx / dd * s; e.pos.z += ddz / dd * s; } }
    else if (mv === 'fly') { bs.ang += 0.38 * spdM * dt; const tx = PL.pos.x + Math.cos(bs.ang) * 18, tz = PL.pos.z + Math.sin(bs.ang) * 18; e.pos.x = lerp(e.pos.x, tx, dt * 1.2); e.pos.z = lerp(e.pos.z, tz, dt * 1.2); e.pos.y = lerp(e.pos.y, (def.move[2] || 6) + Math.sin(G.t) * 1.2, dt * 2); }
    else if (mv === 'serpent') {
      const S2 = B.serpent, hd = S2.hd; bs.ang += 0.6 * dt;
      const tx = PL.pos.x + Math.cos(bs.ang) * 11, tz = PL.pos.z + Math.sin(bs.ang * 1.3) * 11;
      _bt.set(tx - hd.position.x, 0, tz - hd.position.z); const l = _bt.length() || 1;
      S2.dir = S2.dir || V3(1, 0, 0); S2.dir.lerp(_bt.divideScalar(l), dt * 1.6).normalize();
      hd.position.x += S2.dir.x * def.move[1] * spdM * dt; hd.position.z += S2.dir.z * def.move[1] * spdM * dt; hd.position.y = 2.2 + Math.sin(G.t * 1.6) * 1.4;
      hd.rotation.y = Math.atan2(S2.dir.x, S2.dir.z);
    }
  }
  if (B.serpent) {
    const S2 = B.serpent, hd = S2.hd; S2.hist.unshift(hd.position.clone()); if (S2.hist.length > 400) S2.hist.pop();
    S2.segs.forEach((s, i) => { const p = S2.hist[Math.min(S2.hist.length - 1, (i + 1) * 5)]; s.position.copy(p); s.position.y -= 0.15 * i * 0.2; });
    const r = Math.hypot(hd.position.x, hd.position.z); if (r > ARENA) { hd.position.x *= ARENA / r; hd.position.z *= ARENA / r; }
  } else {
    const r = Math.hypot(e.pos.x, e.pos.z); if (r > ARENA - 2) { e.pos.x *= (ARENA - 2) / r; e.pos.z *= (ARENA - 2) / r; }
    let yaw = Math.atan2(nx, nz); let dy = yaw - B.group.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); B.group.rotation.y += dy * Math.min(1, dt * 4);
  }
  // ---- attacks ----
  if (bs.busy <= 0 && bs.atkCd <= 0) {
    const list = bs.phase === 2 ? def.atk.concat(def.p2, def.p2) : def.atk;
    let a, tries = 0; do { a = pick(list); } while (a.k === bs.last && tries++ < 5);
    bs.last = a.k;
    try { bs.busy = bossAttack(e, a) || 1; } catch (err) { console.error('boss attack failed', a.k, err); bs.busy = 1; }
    bs.atkCd = (bs.phase === 2 ? 0.75 : 1.5) * rand(0.8, 1.2);
  }
  // contact damage
  if (d < def.r + PL.hitR && Math.abs(PL.pos.y - e.pos.y) < B.h) { hurtPlayer(e.dmg * 0.6); const k = def.r + PL.hitR - d; PL.pos.x += nx * k; PL.pos.z += nz * k; }
}

// ---------------- attack helpers ----------------
function bossOrigins(e, a) {
  const B = e.boss.B;
  if (a.multi && B.heads.length) return B.heads.map(H => { const v = V3(); (H.hd || H.neck).getWorldPosition(v); return v; });
  return [eyePos(B, V3())];
}
function aimDir(from, lead = 0) { return V3(PL.pos.x + PL.vel.x * lead - from.x, PL.pos.y + 1.1 - from.y, PL.pos.z + PL.vel.z * lead - from.z).normalize(); }
function spikeAt(p, model, r, col) {
  const g = new THREE.Group(); g.position.set(p.x, 0, p.z);
  const n = model === 'pillar' ? 1 : 4;
  for (let i = 0; i < n; i++) {
    let m;
    if (model === 'pillar') { m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.7, 30, 16, 1, true), tmat(col, 0.7)); m.position.y = 15; }
    else if (model === 'geyser') { m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.4, r * 0.6, 6, 10, 1, true), tmat(col, 0.8)); m.position.y = 3; }
    else if (model === 'ice' || model === 'crystal') { m = new THREE.Mesh(GO(0.6), tmat(col, 0.85, false)); m.scale.set(1, 3.5, 1); m.position.set(rand(-r, r) * 0.4, 1.4, rand(-r, r) * 0.4); m.rotation.set(rand(-0.3, 0.3), rand(0, 3), rand(-0.3, 0.3)); }
    else { m = new THREE.Mesh(GK(model === 'spear' ? 0.25 : 0.45, model === 'spear' ? 4 : 3, 6), tmat(col, 0.9, false)); m.position.set(rand(-r, r) * 0.4, 1.5, rand(-r, r) * 0.4); m.rotation.set(rand(-0.25, 0.25), 0, rand(-0.25, 0.25)); }
    g.add(m);
  }
  tempMesh(g, model === 'pillar' ? 0.6 : 0.9, (gg, k) => { const s = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1; gg.scale.set(1, Math.max(0.01, s), 1); }, W.scene);
  FX.burst(V3(p.x, 0.3, p.z), col, 12, 5, 0.35, 0.5, { up: 5 });
}
function bossHitCircle(p, r, dmg, h = 2.5) { if (Math.hypot(PL.pos.x - p.x, PL.pos.z - p.z) < r + PL.hitR && PL.pos.y < h) hurtPlayer(dmg); }
function makeBeamMesh(col, w) {
  const g = new THREE.Group();
  const o = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), tmat(col, 0.75)); o.geometry.translate(0, 0.5, 0); o.geometry.rotateX(Math.PI / 2);
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1, 8, 1, true), tmat(0xffffff, 0.95)); c.geometry.translate(0, 0.5, 0); c.geometry.rotateX(Math.PI / 2);
  g.add(o); g.add(c); g.userData.w = w; W.scene.add(g); return g;
}
function setBeam(g, from, dir, len, w) { g.position.copy(from); g.quaternion.setFromUnitVectors(ZAX, dir); g.scale.set(w, w, len); }
function segDist(p, a, dir, len) { _bt.copy(p).sub(a); const t = clamp(_bt.dot(dir), 0, len); return _bt.addScaledVector(dir, -t).length(); }

function bossAttack(e, a) {
  const bs = e.boss, B = bs.B, D = e.dmg, col = a.col || 0xff3355;
  const center = V3(e.pos.x, Math.max(1.4, e.pos.y + 1.4), e.pos.z);
  if (bs.def.move[0] === 'fly') center.y = e.pos.y;
  switch (a.k) {
    case 'fan': {
      const rep = a.rep || 1;
      for (let r = 0; r < rep; r++) later(r * 0.32, () => { if (e.dead) return; bossOrigins(e, a).forEach(o => {
        const dir = aimDir(o, 0.3), base = Math.atan2(dir.x, dir.z), pitch = Math.asin(clamp(dir.y, -1, 1)), n = a.n;
        for (let k = 0; k < n; k++) { const ang = base + (n > 1 ? (k / (n - 1) - 0.5) * a.spread : 0); eShot(o, V3(Math.sin(ang) * Math.cos(pitch), Math.sin(pitch), Math.cos(ang) * Math.cos(pitch)).multiplyScalar(a.spd), D * 0.8, col, { model: a.model, size: a.size || 0.45, slow: a.slow, pool: a.pool }); }
      }); AU.enemyShot(); });
      return 0.5 + rep * 0.32;
    }
    case 'ring': {
      const rep = a.rep || 1;
      for (let r = 0; r < rep; r++) later(r * 0.45, () => { if (e.dead) return; const off = r * Math.PI / a.n, dy = center.y > 3 ? -0.18 : 0; for (let k = 0; k < a.n; k++) { const ang = off + k / a.n * TAU; eShot(center, V3(Math.sin(ang), dy, Math.cos(ang)).normalize().multiplyScalar(a.spd), D * 0.75, col, { model: a.model, size: a.size || 0.45 }); } AU.enemyShot(); FX.ring(V3(e.pos.x, 0, e.pos.z), bs.def.r + 2, col, 0.3); });
      return 0.6 + rep * 0.45;
    }
    case 'spiral': {
      const shots = Math.floor(a.dur / a.rate), dirSign = Math.random() < 0.5 ? 1 : -1;
      for (let s = 0; s < shots; s++) later(s * a.rate, () => { if (e.dead) return; const base = s * 0.33 * dirSign, dy = center.y > 3 ? -0.2 : 0; for (let k = 0; k < a.arms; k++) { const ang = base + k / a.arms * TAU; eShot(center, V3(Math.sin(ang), dy, Math.cos(ang)).normalize().multiplyScalar(a.spd), D * 0.7, a.glow || col, { model: a.model, size: a.size || 0.4 }); } if (s % 3 === 0) AU.enemyShot(); });
      bs.lockMove = a.dur * 0.7; return a.dur * 0.75;
    }
    case 'lob': {
      if (a.mark) { const p = V3(PL.pos.x, 0, PL.pos.z); FX.num(V3(PL.pos.x, PL.pos.y + PL.height + 0.6, PL.pos.z), 'MOVE!', '#7CFF4D', true); telegraphCircle(p.x, p.z, a.aoe, a.delay || 2, col, () => { if (!e.dead) { hostileImpact(p, a.aoe, D * 2, col); spikeAt(p, 'pillar', 2.5, col); } }); return 1.2; }
      for (let k = 0; k < a.n; k++) later(k * 0.15, () => { if (e.dead) return; const t = k === 0 ? V3(PL.pos.x + PL.vel.x * 0.9, 0, PL.pos.z + PL.vel.z * 0.9) : V3(PL.pos.x + rand(-6, 6), 0, PL.pos.z + rand(-6, 6)); lobShot(eyePos(B, V3()), t, a.big ? 1.4 : 1.1, D * 1.2, col, { aoe: a.aoe, model: a.model, size: a.big ? 0.9 : 0.6, pool: a.pool ? 'toxic' : null }); });
      return 0.8 + a.n * 0.15;
    }
    case 'meteors': {
      for (let k = 0; k < a.n; k++) later(k * 0.13, () => { if (e.dead) return; const p = V3(PL.pos.x + rand(-1, 1) * (k < 3 ? 2 : 9), 0, PL.pos.z + rand(-1, 1) * (k < 3 ? 2 : 9)); telegraphCircle(p.x, p.z, a.aoe, 1.2, col, () => { if (!e.dead) hostileImpact(p, a.aoe, D * 1.1, col); }); eShot(V3(p.x + rand(-4, 4), 26, p.z + rand(-4, 4)), V3(0, 0, 0), 0, col, { model: a.model || 'boulder', size: 0.7, life: 1.3 }).vel.set(0, -26 / 1.2, 0); });
      return 1 + a.n * 0.1;
    }
    case 'beam': case 'sweep': {
      const sweep = a.k === 'sweep', charge = sweep ? 0.7 : a.charge || 1;
      const beams = [makeBeamMesh(col, a.width)]; if (a.prism) { beams.push(makeBeamMesh(0x7af8ff, a.width * 0.7)); beams.push(makeBeamMesh(0xffe600, a.width * 0.7)); }
      const from = V3(), dir = aimDir(eyePos(B, from)); let t = 0, tick = 0;
      const base = Math.atan2(dir.x, dir.z), dist0 = Math.hypot(PL.pos.x - e.pos.x, PL.pos.z - e.pos.z);
      bs.charging = true; bs.lockMove = charge + a.dur; AU.beam();
      addZone({ update(dt) {
        if (e.dead || !G.playing) { beams.forEach(b => { W.scene.remove(b); disposeTemp(b); }); bs.charging = false; return false; }
        t += dt; eyePos(B, from);
        if (sweep) { const k = clamp((t - charge) / a.dur, 0, 1), ang = base + (k - 0.5) * a.arc * 2; const pitch = Math.atan2(1.1 - from.y, dist0); dir.set(Math.sin(ang) * Math.cos(pitch), Math.sin(pitch), Math.cos(ang) * Math.cos(pitch)); }
        else { const tgt = aimDir(from); dir.lerp(tgt, Math.min(1, dt * (t < charge ? 3 : a.track))).normalize(); }
        const firing = t >= charge, w = firing ? a.width * (0.85 + Math.sin(t * 40) * 0.15) : 0.06 + Math.sin(t * 30) * 0.03;
        let len = 80; if (dir.y < -0.01) len = Math.min(80, -from.y / dir.y);
        beams.forEach((b, i) => { const dd = i === 0 ? dir : dir.clone().applyAxisAngle(UP, i === 1 ? 0.4 : -0.4); setBeam(b, from, dd, len, w); b.children[0].material.opacity = firing ? 0.75 : 0.5; });
        if (!firing) { if (Math.random() < 0.8) { FX.c.set(col); const q = from.clone().add(V3(rand(-2, 2), rand(-2, 2), rand(-2, 2))); PG.spawn(q.x, q.y, q.z, (from.x - q.x) * 3, (from.y - q.y) * 3, (from.z - q.z) * 3, FX.c, 1, 0.3, 0.3, 0, 0, 0); } }
        else {
          const end = from.clone().addScaledVector(dir, len); if (Math.random() < 0.8) { FX.burst(V3(end.x, Math.max(0.2, end.y), end.z), col, 3, 5, 0.4, 0.35, { up: 3 }); }
          tick -= dt; _v4.set(PL.pos.x, PL.pos.y + 1, PL.pos.z);
          if (tick <= 0) { const hit = beams.some((b, i) => { const dd = i === 0 ? dir : dir.clone().applyAxisAngle(UP, i === 1 ? 0.4 : -0.4); return segDist(_v4, from, dd, len) < (i === 0 ? a.width : a.width * 0.7) * 0.6 + PL.hitR; }); if (hit) { hurtPlayer(D * 0.6); tick = 0.25; } }
          if (Math.random() < 0.2) shake(0.08);
        }
        if (t > charge + a.dur) { beams.forEach(b => { W.scene.remove(b); disposeTemp(b); }); bs.charging = false; return false; }
      } });
      return charge + a.dur + 0.3;
    }
    case 'shock': { for (let k = 0; k < a.n; k++) later(k * 0.6, () => { if (e.dead) return; shockRing(e.pos.x, e.pos.z, a.spd, D, col); AU.slam(); shake(0.4); FX.burst(V3(e.pos.x, 0.3, e.pos.z), 0x8a7a6a, 18, 7, 0.5, 0.6, { up: 4 }); }); if (a.n) FX.num(V3(PL.pos.x, PL.pos.y + PL.height + 0.6, PL.pos.z), 'JUMP!', '#FFE600', true); return 0.6 * a.n + 0.3; }
    case 'slam': {
      const go = (delay) => later(delay, () => {
        if (e.dead) return; const tgt = V3(PL.pos.x, 0, PL.pos.z), from = e.pos.clone(); bs.lockMove = 1.2;
        telegraphCircle(tgt.x, tgt.z, a.aoe, 1.0, col);
        let t = 0; addZone({ update(dt) { if (e.dead) return false; t += dt; const k = Math.min(1, t / 1.0); e.pos.x = lerp(from.x, tgt.x, k); e.pos.z = lerp(from.z, tgt.z, k); e.pos.y = Math.sin(k * Math.PI) * 7; if (k >= 1) { e.pos.y = 0; hostileImpact(tgt, a.aoe, D * 1.6, col); shockRing(tgt.x, tgt.z, 14, D * 0.7, col, 20); shake(1); return false; } } });
      });
      go(0); if (a.twice) go(1.4); return a.twice ? 2.8 : 1.5;
    }
    case 'charge': {
      const dir = V3(PL.pos.x - e.pos.x, 0, PL.pos.z - e.pos.z).normalize(), len = Math.min(36, Math.hypot(PL.pos.x - e.pos.x, PL.pos.z - e.pos.z) + 10), w = bs.def.r * 1.8;
      bs.lockMove = 0.9 + len / a.spd + 0.2;
      telegraphLine(e.pos.x, e.pos.z, dir.x, dir.z, len, w, 0.85, col, () => {
        if (e.dead) return; let gone = 0, hit = false; AU.roar();
        addZone({ update(dt) { if (e.dead) return false; const s = a.spd * dt; gone += s; e.pos.x += dir.x * s; e.pos.z += dir.z * s; if (B.serpent) B.serpent.dir && B.serpent.dir.copy(dir); FX.burst(V3(e.pos.x, 0.4, e.pos.z), col, 3, 3, 0.45, 0.4, { up: 2 }); if (!hit && Math.hypot(PL.pos.x - e.pos.x, PL.pos.z - e.pos.z) < bs.def.r + PL.hitR + 0.5 && PL.pos.y < 3) { hit = true; hurtPlayer(D * 1.5); PL.vel.addScaledVector(dir, 14); PL.vel.y = 7; } return gone < len; } });
      });
      return 0.9 + len / a.spd + 0.3;
    }
    case 'erupt': {
      const model = a.model || 'spike';
      const one = (p, delay) => telegraphCircle(p.x, p.z, a.aoe, delay, col, () => { if (e.dead) return; spikeAt(p, model, a.aoe, col); bossHitCircle(p, a.aoe, D * 1.1); AU.slam(); });
      if (a.mode === 'line') { const dir = V3(PL.pos.x - e.pos.x, 0, PL.pos.z - e.pos.z).normalize(); for (let i = 0; i < a.n; i++) later(i * 0.07, () => one(V3(e.pos.x + dir.x * (bs.def.r + 1.5 + i * 2.3), 0, e.pos.z + dir.z * (bs.def.r + 1.5 + i * 2.3)), 0.7)); return 1.2; }
      if (a.mode === 'under') { for (let i = 0; i < a.n; i++) later(i * 0.42, () => { if (!e.dead) one(V3(PL.pos.x + PL.vel.x * 0.35, 0, PL.pos.z + PL.vel.z * 0.35), 0.85); }); return a.n * 0.42 + 0.6; }
      const c = V3(PL.pos.x, 0, PL.pos.z); for (let i = 0; i < a.n; i++) { const ang = i / a.n * TAU; one(V3(c.x + Math.cos(ang) * 5, 0, c.z + Math.sin(ang) * 5), 1.0); } later(0.9, () => { if (!e.dead) one(V3(PL.pos.x, 0, PL.pos.z), 0.9); });
      return 1.8;
    }
    case 'summon': {
      const n = Math.min(a.n, Math.max(0, 46 - G.enemies.length)); AU.roar();
      for (let k = 0; k < n; k++) { const ang = rand(0, TAU), r = a.rise ? rand(5, 8) : rand(3, 6); const c = a.rise ? PL.pos : e.pos; spawnEnemy(a.t, V3(c.x + Math.cos(ang) * r, 0, c.z + Math.sin(ang) * r), { elite: false }); }
      FX.ring(V3(e.pos.x, 0, e.pos.z), 10, col || 0x7cff4d, 0.7); return 1.2;
    }
    case 'pull': {
      let t = 0, tick = 0; const ring = decalCircle(e.pos.x, e.pos.z, bs.def.r + 3, col); AU.tone(80, 'sawtooth', a.dur, 0.15, { to: 40, lp: 400 });
      bs.lockMove = a.dur;
      addZone({ obj: ring, update(dt) {
        if (e.dead) return false; t += dt; tick -= dt; ring.position.set(e.pos.x, 0.07, e.pos.z); ring.rotation.y += dt * 3;
        const dx = e.pos.x - PL.pos.x, dz = e.pos.z - PL.pos.z, d = Math.hypot(dx, dz) || 1;
        if (d < 34) { const f = a.str * dt * (1 - d / 40); PL.pos.x += dx / d * f; PL.pos.z += dz / d * f; }
        if (d < bs.def.r + 3 && tick <= 0) { tick = 0.3; hurtPlayer(D * 0.5); }
        for (let i = 0; i < 3 * R.partMul; i++) { const ang = rand(0, TAU), r = rand(8, 22); FX.c.set(col); PG.spawn(e.pos.x + Math.cos(ang) * r, rand(0.3, 3), e.pos.z + Math.sin(ang) * r, -Math.cos(ang) * r * 1.4 - Math.sin(ang) * 6, 0, -Math.sin(ang) * r * 1.4 + Math.cos(ang) * 6, FX.c, 1, 0.3, 0.6, 0, 0, 0); }
        return t < a.dur;
      } });
      return a.dur + 0.2;
    }
    case 'homing': {
      for (let k = 0; k < a.n; k++) later(k * 0.12, () => { if (e.dead) return; const o = eyePos(B, V3()); const ang = rand(0, TAU); eShot(o, V3(Math.cos(ang) * 0.7, 0.9, Math.sin(ang) * 0.7).normalize().multiplyScalar(a.spd), D * 0.8, col, { model: a.model, size: a.size || 0.42, homing: a.turn, life: 6 }); AU.enemyShot(); });
      return 0.6 + a.n * 0.12;
    }
    case 'teleport': {
      const from = e.pos.clone(); FX.burst(V3(from.x, B.h * 0.5, from.z), col || 0xa000ff, 40, 8, 0.6, 0.6, { g: 0 }); FX.smoke(from, 0x2a1a3a, 10, 2, 2, 1);
      B.group.visible = false; bs.lockMove = 1.3;
      if (a.burrow) { const p = V3(PL.pos.x, 0, PL.pos.z); telegraphCircle(p.x, p.z, 4.2, 1.2, 0x7cff4d, () => { if (e.dead) return; e.pos.set(p.x, 0, p.z); B.group.visible = true; hostileImpact(p, 4.2, D * 1.4, 0x7cff4d); FX.burst(V3(p.x, 0.5, p.z), 0x5a4a3a, 30, 9, 0.6, 0.8, { up: 6 }); shake(0.8); }); return 1.6; }
      later(0.45, () => { if (e.dead) return; const ang = rand(0, TAU), r = rand(11, 16); let x = PL.pos.x + Math.cos(ang) * r, z = PL.pos.z + Math.sin(ang) * r; const d = Math.hypot(x, z); if (d > ARENA - 4) { x *= (ARENA - 4) / d; z *= (ARENA - 4) / d; } e.pos.x = x; e.pos.z = z; B.group.visible = true; FX.burst(V3(x, B.h * 0.5, z), col || 0xa000ff, 40, 8, 0.6, 0.6, { g: 0 }); FX.ring(V3(x, 0, z), 6, col || 0xa000ff, 0.4); AU.tone(200, 'sine', 0.3, 0.12, { to: 900 }); });
      return 1;
    }
    case 'cone': {
      let t = 0, tick = 0; const from = V3(), dir = aimDir(eyePos(B, from)); dir.y = 0; dir.normalize(); bs.lockMove = a.dur;
      const pal = { fire: [0xff4a00, 0xffcc33], frost: [0xc8f0ff, 0x7ae0ff], sand: [0xffcc66, 0xd8a050], plasma: [0x00aaff, 0xaaffff] }[a.kind] || [col, 0xffffff];
      AU.noise(a.dur, 0.25, { f: 900, type: 'bandpass' });
      addZone({ update(dt) {
        if (e.dead) return false; t += dt; tick -= dt; eyePos(B, from);
        const tgt = V3(PL.pos.x - from.x, 0, PL.pos.z - from.z).normalize(); dir.lerp(tgt, Math.min(1, dt * 0.9)).normalize();
        for (let i = 0; i < 5 * R.partMul; i++) { const sp = rand(12, 20), ang = rand(-a.angle, a.angle), dd = dir.clone().applyAxisAngle(UP, ang); FX.c.set(pick(pal)); PG.spawn(from.x, from.y, from.z, dd.x * sp, -from.y / (a.range / sp) * 0.9 + rand(-1, 1), dd.z * sp, FX.c, 1, rand(0.4, 0.9), a.range / sp, 0, 0.3, 2.5); }
        const dx = PL.pos.x - from.x, dz = PL.pos.z - from.z, dd = Math.hypot(dx, dz);
        if (dd < a.range && (dx * dir.x + dz * dir.z) / (dd || 1) > Math.cos(a.angle)) { if (tick <= 0) { tick = 0.3; hurtPlayer(D * 0.55); } if (a.slow) PL.slow = 1; if (a.push) { PL.pos.x += dir.x * 7 * dt; PL.pos.z += dir.z * 7 * dt; } }
        return t < a.dur;
      } });
      return a.dur + 0.3;
    }
    case 'wall': {
      const dir = V3(PL.pos.x - e.pos.x, 0, PL.pos.z - e.pos.z).normalize(), perp = V3(dir.z, 0, -dir.x);
      if (a.kind === 'wave') {
        const g = new THREE.Mesh(new THREE.BoxGeometry(120, 1.4, 1.6), tmat(col, 0.7)); const foam = new THREE.Mesh(new THREE.BoxGeometry(120, 0.25, 1.8), tmat(0xffffff, 0.8)); foam.position.y = 0.75; g.add(foam);
        const p = V3(e.pos.x + dir.x * 3, 0.7, e.pos.z + dir.z * 3); g.position.copy(p); g.rotation.y = Math.atan2(perp.x, perp.z) + Math.PI / 2; W.scene.add(g);
        FX.num(V3(PL.pos.x, PL.pos.y + PL.height + 0.6, PL.pos.z), 'JUMP THE WAVE!', '#7AF8FF', true);
        let gone = 0, hit = false;
        addZone({ obj: g, update(dt) { gone += 14 * dt; g.position.x = p.x + dir.x * gone; g.position.z = p.z + dir.z * gone; const along = (PL.pos.x - g.position.x) * dir.x + (PL.pos.z - g.position.z) * dir.z; if (!hit && Math.abs(along) < 1.1 && PL.pos.y < 1.3) { hit = true; hurtPlayer(D * 1.5); PL.vel.addScaledVector(dir, 10); } if (Math.random() < 0.8) { const q = g.position.clone().addScaledVector(perp, rand(-30, 30)); FX.c.set(0xffffff); PG.spawn(q.x, 1.4, q.z, dir.x * 10, rand(1, 3), dir.z * 10, FX.c, 0.8, 0.5, 0.5, 6, 0, 0); } return gone < 90; } });
        return 1.5;
      }
      const lanes = [-9, -4.5, 0, 4.5, 9].map(o => o + rand(-1, 1)); lanes.splice(randi(0, 4), 1);
      const start = V3(e.pos.x - dir.x * 4, 0, e.pos.z - dir.z * 4);
      lanes.forEach(o => { const s = start.clone().addScaledVector(perp, o); telegraphLine(s.x, s.z, dir.x, dir.z, 60, 2.6, 1.3, 0xff5522, () => {
        const deer = new THREE.Group(); const bm = matStd(0x8a5a3a, { r: 0.8 }); mesh(GB(1.2, 1.1, 2.2), bm, 0, 1.4, 0, deer); mesh(GB(0.6, 0.6, 0.8), bm, 0, 2.1, 1.3, deer); mesh(GS(0.14), matGlow(0xff2020, 1, false), 0, 2.0, 1.75, deer); for (const sx of [-1, 1]) { mesh(GK(0.06, 0.9, 4), matStd(0xd8c8a0), sx * 0.25, 2.8, 1.1, deer, -0.3, 0, sx * -0.5); for (const sz of [-0.7, 0.7]) mesh(GB(0.2, 0.9, 0.2), bm, sx * 0.4, 0.45, sz, deer); }
        deer.position.copy(s); deer.rotation.y = Math.atan2(dir.x, dir.z); W.scene.add(deer); let gone = 0, hit = false;
        addZone({ obj: deer, update(dt) { gone += 26 * dt; deer.position.set(s.x + dir.x * gone, Math.abs(Math.sin(gone)) * 0.3, s.z + dir.z * gone); if (!hit && Math.hypot(PL.pos.x - deer.position.x, PL.pos.z - deer.position.z) < 1.6 && PL.pos.y < 2) { hit = true; hurtPlayer(D * 1.3); } if (Math.random() < 0.4) FX.burst(V3(deer.position.x, 0.2, deer.position.z), 0xffffff, 2, 2, 0.3, 0.4, { up: 2 }); return gone < 60; } });
      }); });
      AU.tone(1200, 'triangle', 0.6, 0.08); return 2.2;
    }
    case 'grid': {
      const lines = [];
      if (a.cross) { const b = rand(0, Math.PI); for (let i = 0; i < a.lines; i++) lines.push([PL.pos.x, PL.pos.z, b + i * Math.PI / a.lines]); }
      else for (let i = 0; i < a.lines; i++) lines.push([PL.pos.x + rand(-6, 6), PL.pos.z + rand(-6, 6), rand(0, Math.PI)]);
      lines.forEach(([x, z, ang]) => { const dx = Math.sin(ang), dz = Math.cos(ang), sx = x - dx * 45, sz = z - dz * 45;
        telegraphLine(sx, sz, dx, dz, 90, 1.4, 1.15, col, () => { if (e.dead) return; const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.2, 90), tmat(col, 0.9)); m.position.set(x, 1.6, z); m.rotation.y = ang; const c = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.3, 90), tmat(0xffffff, 1)); m.add(c); tempMesh(m, 0.35, (mm, k) => { mm.material.opacity = 0.9 * (1 - k); mm.scale.x = 1 + k; }, W.scene); if (inLine(PL.pos.x, PL.pos.z, sx, sz, dx, dz, 90, 1.4) && PL.pos.y < 3) hurtPlayer(D * 1.3); AU.zap(); });
      });
      return 1.6;
    }
    case 'pools': { for (let i = 0; i < a.n; i++) later(i * 0.25, () => { if (e.dead) return; const p = V3(PL.pos.x + PL.vel.x * 0.4 + rand(-4, 4), 0, PL.pos.z + PL.vel.z * 0.4 + rand(-4, 4)); const c = a.kind === 'fire' ? 0xff6a00 : a.kind === 'glitch' ? 0x00ff88 : 0x7cff00; telegraphCircle(p.x, p.z, 2.8, 0.6, c, () => { if (!e.dead) hazardPool(p.x, p.z, 2.8, 7, a.kind, D * 0.8); }); }); return 0.8 + a.n * 0.25; }
    case 'tether': {
      if (Math.hypot(PL.pos.x - e.pos.x, PL.pos.z - e.pos.z) > 24) return 0.3;
      const b = makeBeamMesh(col, 0.25); let t = 0, tick = 0; AU.tone(300, 'sawtooth', a.dur, 0.08, { to: 150, lp: 900 });
      addZone({ obj: b, update(dt) {
        if (e.dead) return false; t += dt; tick -= dt; const from = eyePos(B, V3()), to = V3(PL.pos.x, PL.pos.y + 1.1, PL.pos.z), len = from.distanceTo(to);
        if (len > 27) { FX.num(to, 'BROKE FREE', '#C0C0FF'); return false; }
        setBeam(b, from, to.clone().sub(from).normalize(), len, 0.2 + Math.random() * 0.15);
        if (tick <= 0) { tick = 0.25; hurtPlayer(D * 0.2, { dot: true }); e.hp = Math.min(e.maxHp, e.hp + D * 0.6); updateBossBar(); FX.c.set(col); PG.spawn(to.x, to.y, to.z, (from.x - to.x) * 1.5, (from.y - to.y) * 1.5, (from.z - to.z) * 1.5, FX.c, 1, 0.5, 0.6, 0, 0, 0); }
        return t < a.dur;
      } });
      FX.num(V3(PL.pos.x, PL.pos.y + PL.height + 0.6, PL.pos.z), 'RUN AWAY!', '#C07CFF', true);
      return a.dur * 0.5;
    }
    case 'decoys': {
      for (let k = 0; k < a.n; k++) { const ang = k / a.n * TAU, p = V3(e.pos.x + Math.cos(ang) * 4, 0, e.pos.z + Math.sin(ang) * 4); const d = spawnEnemy(a.explode ? 'exploder' : 'phantom', p, { noRise: true, elite: false }); d.hp *= 0.6; d.maxHp = d.hp; FX.smoke(p, 0x3a1a4a, 6, 2, 1.5, 1); FX.burst(V3(p.x, 1, p.z), 0xa000ff, 12, 4, 0.4, 0.5, { g: 0 }); }
      return 1;
    }
  }
  return 1;
}

// ---------------- defeat & portal ----------------
function defeatBoss(e) {
  const bs = e.boss, B = bs.B; G.bossDone = true; G.runBosses++; S.stats.bosses++; S.bpXp += 160 + G.realm * 10; S.stats.realms++;
  const reward = Math.round(500 * G.realm * PL.coinMult);
  G.boss = null; MUSIC.intensity = 0.2;
  $('hudBoss').style.display = 'none';
  banner('BOSS DEFEATED!', `+${fmt(reward)} COINS • +${160 + G.realm * 10} PASS XP`, '#FFE600', 3.2);
  AU.roar(); G.slowmo = 1.4;
  // clear the battlefield of hostiles
  G.eproj.forEach(s => { FX.burst(s.pos, s.col, 4, 2, 0.3, 0.3); W.scene.remove(s.m); }); G.eproj.length = 0;
  G.zones.forEach(z => { if (z.obj) { W.scene.remove(z.obj); disposeTemp(z.obj); } }); G.zones.length = 0;
  for (const o of G.enemies) if (!o.dead && o !== e) { o.dead = true; deathFX(o, enemyCenter(o, V3()).clone()); }
  const c = V3(e.pos.x, B.h * 0.5, e.pos.z);
  for (let k = 0; k < 6; k++) later(k * 0.25, () => { FX.explosion(c.clone().add(V3(rand(-2, 2), rand(-2, 2), rand(-2, 2))), 3 + k * 0.3, pick([0xff2a55, 0xffaa00, 0xffffff]), true); });
  later(1.6, () => {
    FX.explosion(c, 9, 0xffffff, true); AU.boom(true); shake(1.5);
    B.group.updateMatrixWorld(true);
    const pieces = []; B.body.traverse(o => { if (o.isMesh && pieces.length < 24 && Math.random() < 0.5) pieces.push(o); });
    pieces.forEach(p => { W.scene.attach(p); G.chunks.push({ o: p, v: V3(rand(-9, 9), rand(6, 14), rand(-9, 9)), r: V3(rand(-6, 6), rand(-6, 6), rand(-6, 6)), t: 0, life: rand(1.8, 2.8), s: p.scale.x }); });
    W.scene.remove(B.group); G.chunks.push({ disposeOnly: B.group, t: 0, life: 3.5 });
    for (let i = 0; i < 24; i++) spawnPickup('coin', c, Math.ceil(reward / 24));
    for (let i = 0; i < 3; i++) spawnPickup('heart', c, 0);
    saveSoon();
  });
  later(3.4, () => { if (G.playing && !G.dead) spawnPortal(); });
}
function spawnPortal() {
  const fx = -Math.sin(PL.yaw), fz = -Math.cos(PL.yaw);
  let x = PL.pos.x + fx * 9, z = PL.pos.z + fz * 9; const d = Math.hypot(x, z); if (d > ARENA - 4) { x *= (ARENA - 4) / d; z *= (ARENA - 4) / d; }
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const nb = BIOMES[(G.biome + 1) % BIOMES.length];
  const c1 = new THREE.Color(nb.skin.e).getHex(), c2 = new THREE.Color(nb.sky[1]).getHex();
  const ring = new THREE.Mesh(GT(2.6, 0.28, 12, 48), matGlow(c1, 1, false)); ring.position.y = 3.2; g.add(ring);
  const ring2 = new THREE.Mesh(GT(2.9, 0.06, 6, 48), matGlow(0xffffff, 1, false)); ring2.position.y = 3.2; g.add(ring2);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.5, 48), new THREE.ShaderMaterial({ uniforms: { t: { value: 0 }, a: { value: new THREE.Color(c1) }, b: { value: new THREE.Color(c2) } }, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float t;uniform vec3 a,b;varying vec2 vUv;void main(){vec2 p=vUv-.5;float r=length(p)*2.;float ang=atan(p.y,p.x);float s=sin(ang*5.+r*12.-t*6.)*.5+.5;vec3 c=mix(a,b,s)*(1.6-r);c+=vec3(1.)*pow(1.-r,4.)*1.5;gl_FragColor=vec4(c,smoothstep(1.,.85,r));}' }));
  disc.position.y = 3.2; g.add(disc); g.add(glowSprite(c1, 10, 0.5)); g.children[g.children.length - 1].position.y = 3.2;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.3, 32), matStd(0x14102a, { r: 0.3, m: 0.8 })); base.position.y = 0.15; g.add(base);
  W.scene.add(g); G.portal = g; g.userData = { disc, ring, ring2, c1 };
  FX.explosion(V3(x, 3, z), 4, c1, false); AU.portal();
  $('prompt').style.display = 'block'; $('prompt').textContent = `ENTER THE PORTAL ➜ ${nb.n}`;
}
function updatePortal(dt) {
  const g = G.portal; if (!g) return;
  const u = g.userData; u.disc.material.uniforms.t.value += dt; u.ring.rotation.z += dt; u.ring2.rotation.z -= dt * 1.5;
  g.lookAt(PL.pos.x, 0, PL.pos.z);
  if (Math.random() < 0.8 * R.partMul) { const a = rand(0, TAU); FX.c.set(u.c1); const p = V3(Math.cos(a) * 3, 3.2 + Math.sin(a) * 3, 0); g.localToWorld(p); PG.spawn(p.x, p.y, p.z, (g.position.x - p.x) * 1.2, (3.2 - p.y) * 1.2, (g.position.z - p.z) * 1.2, FX.c, 1, 0.3, 0.8, 0, 0, 0); }
  if (Math.hypot(PL.pos.x - g.position.x, PL.pos.z - g.position.z) < 2.6 && !G.transitioning) nextRealm();
}
