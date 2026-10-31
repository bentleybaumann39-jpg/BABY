// =====================================================================
//  PLAYER — input, pointer lock, camera, movement, shooting
// =====================================================================
const G = {
  playing: false, paused: false, dead: false, realm: 1, biome: 0, kills: 0, killsNeed: 20, boss: null, bossDone: false,
  enemies: [], bullets: [], eproj: [], allies: [], pickups: [], zones: [], chunks: [], portal: null,
  t: 0, runKills: 0, runCoins: 0, runTime: 0, runBosses: 0, timeStop: 0, spawnT: 0, locked: false, lockFail: false, intensity: 0
};
const PL = {
  pos: V3(), vel: V3(), yaw: 0, pitch: 0.12, hp: 100, maxHp: 100, shield: 0, maxShield: 0, lastHit: -99, ult: 0, onGround: true, jumps: 0, maxJumps: 1,
  model: null, C: null, mut: '', st: null, pw: {}, w: 0, ammo: [], reloadT: 0, fireT: 0, ads: 0, recoil: 0, shots: 0, iT: 0, revived: false,
  berserk: 0, slow: 0, speed: 0, height: 2.4, hitR: 0.55, gun: null, guns: [], aimPt: V3(), timers: {}, vampPool: 0, dodgeT: 0
};
const KEYS = {};
let mouseDown = false, rmbDown = false;

// ---------------- pointer lock ----------------
function canvasEl() { return R.renderer.domElement; }
function lockPointer() {
  const c = canvasEl(); if (!c.requestPointerLock) { G.lockFail = true; return; }
  try {
    const p = c.requestPointerLock({ unadjustedMovement: true });
    if (p && p.catch) p.catch(() => { try { const p2 = c.requestPointerLock(); if (p2 && p2.catch) p2.catch(() => onLockError()); } catch (e) { onLockError(); } });
  } catch (e) { try { c.requestPointerLock(); } catch (e2) { onLockError(); } }
}
function onLockError() {
  G.lockFail = true;
  // Chrome refuses to re-lock for ~1s after ESC. Resume anyway; the next click inside the game grabs the mouse.
  if (G.paused && G.wantResume) { G.wantResume = false; doResume(); notify('Click to grab the mouse', 'Click inside the game to lock your mouse again.', '#FFE600'); }
}
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvasEl();
  G.locked = locked;
  if (locked) { G.lockFail = false; G.lockAt = performance.now(); if (G.paused && G.wantResume) { G.wantResume = false; resumeGame(true); } }
  else if (G.playing && !G.dead && !G.paused && !G.leaving) pauseGame();
});
document.addEventListener('pointerlockerror', onLockError);

// ---------------- input ----------------
addEventListener('mousemove', e => {
  if (!G.playing || G.paused || G.dead) return;
  if (!G.locked && !G.lockFail) return;
  // browsers sometimes emit one huge bogus jump right when the pointer gets locked; ignore spikes
  if (Math.abs(e.movementX || 0) > 300 || Math.abs(e.movementY || 0) > 300 || performance.now() - (G.lockAt || 0) < 120) return;
  const s = 0.0021 * S.set.sens * (PL.ads > 0.5 ? (WEAPONS[PL.w].id === 'sniper' ? 0.45 : 0.75) : 1);
  PL.yaw -= (e.movementX || 0) * s;
  PL.pitch = clamp(PL.pitch - (e.movementY || 0) * s * (S.set.inv ? -1 : 1), -1.15, 1.25);
});
addEventListener('mousedown', e => {
  if (!G.playing || G.paused || G.dead) return;
  if (!G.locked && e.target === canvasEl()) lockPointer();
  if (e.button === 0) { mouseDown = true; AU.init(); }
  if (e.button === 2) rmbDown = true;
});
addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; if (e.button === 2) rmbDown = false; });
addEventListener('contextmenu', e => { if (G.playing) e.preventDefault(); });
addEventListener('wheel', e => { if (!G.playing || G.paused || G.dead) return; setWeapon((PL.w + (e.deltaY > 0 ? 1 : -1) + WEAPONS.length) % WEAPONS.length); }, { passive: true });
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); KEYS[k] = true; KEYS[e.code] = true;
  if (!G.playing) { if (k === 'escape') closeModals(); return; }
  if (e.code === 'Space') e.preventDefault();
  if (G.paused || G.dead) { if (k === 'escape') closeModals(); return; }
  if (k >= '1' && k <= '5') setWeapon(+k - 1);
  if (k === 'r') startReload();
  if (k === 'q' || k === 'e') triggerUlt();
  if (e.code === 'Space' && !e.repeat) tryJump();
  if (k === 'escape' && G.lockFail) pauseGame();
  if (k === 'p') pauseGame();
});
addEventListener('keyup', e => { KEYS[e.key.toLowerCase()] = false; KEYS[e.code] = false; });
addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; mouseDown = rmbDown = false; });

// ---------------- character setup ----------------
function computePlayerStats() {
  const { cid, mut, C } = eqInfo();
  PL.C = C; PL.mut = mut; PL.st = charStats(cid, mut); PL.pw = {};
  C.p.forEach(p => PL.pw[p] = C.L);
  const L = id => PL.pw[id] || 0;
  PL.maxHp = Math.round((100 + (S.hp - 1) * 25) * PL.st.hpMult * (1 + 0.25 * L('giant')));
  PL.maxShield = L('shield') ? Math.round(PL.maxHp * 0.2 * L('shield')) : 0;
  PL.maxJumps = 1 + (L('sky') ? Math.ceil(L('sky') / 2) : 0);
  PL.speed = 7.2 * (1 + (S.spd - 1) * 0.04) * (1 + 0.12 * L('swift')) * (1 - 0.06 * L('giant'));
  PL.coinMult = (1 + 0.1 * S.greed) * (1 + 0.3 * L('midas')) * (1 + 0.1 * L('magnet'));
  PL.magnet = 4 + (L('magnet') ? 6 + 4 * L('magnet') : 0);
  PL.ultMul = 1 + 0.25 * L('battery');
}
function refreshPlayerChar() {
  if (!W.scene) return;
  if (PL.model) { W.scene.remove(PL.model.group); disposeModel(PL.model.group); }
  computePlayerStats();
  PL.model = buildCharacter(PL.C, PL.mut);
  const gs = 1 + 0.12 * (PL.pw.giant || 0); PL.model.group.scale.setScalar(gs);
  PL.height = PL.model.height * gs; PL.hitR = 0.55 * gs;
  PL.guns = WEAPONS.map(w => { const g = buildGun(w.id); g.rotation.x = Math.PI / 2; g.visible = false; const hand = PL.model.parts.armR.userData.hand || PL.model.parts.armR; hand.add(g); return g; });
  W.scene.add(PL.model.group);
  setWeapon(PL.w || 0, true);
  updateHudChar();
}
function setWeapon(i, silent) {
  if (i === PL.w && !silent) return;
  PL.w = i; PL.reloadT = 0; PL.fireT = Math.max(PL.fireT, 0.18);
  PL.guns.forEach((g, k) => g.visible = k === i); PL.gun = PL.guns[i];
  if (!silent) AU.click();
  updateHotbar();
}
function startReload() {
  const W0 = WEAPONS[PL.w]; if (PL.reloadT > 0 || PL.ammo[PL.w] >= W0.mag) return;
  PL.reloadT = W0.reload / (1 + 0.12 * (PL.pw.rapid || 0)); PL.reloadMax = PL.reloadT; AU.reload();
}
function tryJump() {
  if (PL.onGround) { PL.vel.y = 9.2 * (1 + 0.1 * (PL.pw.sky || 0)) * Math.sqrt(W.mods.grav); PL.onGround = false; PL.jumps = 1; AU.jump(); FX.burst(V3(PL.pos.x, 0.2, PL.pos.z), 0xffffff, 8, 3, 0.25, 0.4, { flat: 1, g: 0 }); }
  else if (PL.jumps < PL.maxJumps) { PL.vel.y = 8.4 * Math.sqrt(W.mods.grav); PL.jumps++; AU.jump(); FX.ring(V3(PL.pos.x, PL.pos.y, PL.pos.z), 2, PL.model.glowCol.getHex(), 0.35, PL.pos.y + 0.1); FX.burst(V3(PL.pos.x, PL.pos.y + 0.3, PL.pos.z), PL.model.glowCol.getHex(), 14, 4, 0.3, 0.4, { g: 0 }); }
}

// ---------------- camera & aim ----------------
const CAM = { fwd: V3(), right: V3(), tgt: V3(), smoothY: 0 };
function updateCamera(dt) {
  const ads = PL.ads, sn = WEAPONS[PL.w].id === 'sniper';
  const cp = Math.cos(PL.pitch), sp = Math.sin(PL.pitch);
  CAM.fwd.set(-Math.sin(PL.yaw) * cp, sp, -Math.cos(PL.yaw) * cp);
  CAM.right.set(Math.cos(PL.yaw), 0, -Math.sin(PL.yaw));
  const scl = PL.height / 2.4;
  CAM.smoothY = lerp(CAM.smoothY, PL.pos.y, 1 - Math.exp(-dt * 12));
  const dist = lerp(5.8, sn ? 1.6 : 3.0, ads) * (0.75 + 0.25 * scl) + (G.boss && !G.boss.dead ? 0.8 : 0);
  const sh = lerp(1.6, 0.95, ads) * (0.8 + 0.2 * scl);
  CAM.tgt.set(PL.pos.x, CAM.smoothY + PL.height * 0.82 + 0.25, PL.pos.z).addScaledVector(CAM.right, sh);
  const c = R.camera;
  c.position.copy(CAM.tgt).addScaledVector(CAM.fwd, -dist);
  if (c.position.y < 0.35) c.position.y = 0.35;
  _v1.copy(CAM.tgt).addScaledVector(CAM.fwd, 20);
  c.lookAt(_v1);
  if (SHAKE > 0) { const s = SHAKE * 0.35; c.position.x += rand(-s, s); c.position.y += rand(-s, s); c.rotation.z += rand(-s, s) * 0.04; SHAKE = Math.max(0, SHAKE - dt * 2.6); }
  const fov = S.set.fov * lerp(1, sn ? 0.32 : 0.78, ads);
  if (Math.abs(c.fov - fov) > 0.05) { c.fov = lerp(c.fov, fov, 1 - Math.exp(-dt * 18)); c.updateProjectionMatrix(); }
}
const _ro = V3(), _rd = V3();
function rayHitSphere(o, d, cx, cy, cz, r) { const ox = cx - o.x, oy = cy - o.y, oz = cz - o.z; const t = ox * d.x + oy * d.y + oz * d.z; if (t < 0) return -1; const d2 = ox * ox + oy * oy + oz * oz - t * t; if (d2 > r * r) return -1; return t - Math.sqrt(r * r - d2); }
function computeAim() {
  R.camera.getWorldDirection(_rd); _ro.copy(R.camera.position);
  let best = 250, hitE = null;
  for (const e of G.enemies) { if (e.dead || e.rising > 0) continue; for (const s of e.sph) { const t = rayHitSphere(_ro, _rd, s[0], s[1], s[2], s[3]); if (t > 0 && t < best) { best = t; hitE = e; } } }
  if (_rd.y < -0.001) { const tg = -_ro.y / _rd.y; if (tg > 0 && tg < best) { best = tg; hitE = null; } }
  PL.aimPt.copy(_ro).addScaledVector(_rd, best); PL.aimE = hitE;
  return PL.aimPt;
}

// ---------------- player update ----------------
function updatePlayer(dt) {
  const L = id => PL.pw[id] || 0;
  // movement
  const f = (KEYS.w || KEYS.arrowup ? 1 : 0) - (KEYS.s || KEYS.arrowdown ? 1 : 0), r = (KEYS.d || KEYS.arrowright ? 1 : 0) - (KEYS.a || KEYS.arrowleft ? 1 : 0);
  const sprint = (KEYS.shift || KEYS.ShiftLeft) && f > 0 && PL.ads < 0.3;
  let spd = PL.speed * (sprint ? 1.45 : 1) * (PL.ads > 0.5 ? 0.6 : 1) * (PL.berserk > 0 ? 1.35 : 1) * (PL.slow > 0 ? 0.55 : 1);
  const hz = hazardAt(PL.pos.x, PL.pos.z);
  if (hz && hz.type === 'water' && PL.onGround) spd *= 0.6;
  const fx = -Math.sin(PL.yaw), fz = -Math.cos(PL.yaw), rx = Math.cos(PL.yaw), rz = -Math.sin(PL.yaw);
  let mx = fx * f + rx * r, mz = fz * f + rz * r; const ml = Math.hypot(mx, mz); if (ml > 0) { mx /= ml; mz /= ml; }
  const fric = (hz && hz.type === 'ice') ? 0.12 : W.mods.fric;
  const acc = PL.onGround ? 14 * fric : 4;
  const k = 1 - Math.exp(-acc * dt);
  PL.vel.x = lerp(PL.vel.x, mx * spd, k); PL.vel.z = lerp(PL.vel.z, mz * spd, k);
  PL.vel.y -= 24 * W.mods.grav * dt;
  PL.pos.addScaledVector(PL.vel, dt);
  if (PL.pos.y <= 0) { if (!PL.onGround && PL.vel.y < -6) FX.burst(V3(PL.pos.x, 0.15, PL.pos.z), 0xcccccc, 6, 2.5, 0.3, 0.35, { flat: 1, g: 0 }); PL.pos.y = 0; PL.vel.y = 0; PL.onGround = true; PL.jumps = 0; }
  collide(PL.pos, PL.hitR);
  // hazards
  if (hz && PL.pos.y < 0.3) {
    if (hz.type === 'lava') { hurtPlayer(PL.maxHp * 0.12 * dt + 4 * dt * G.realm, { dot: true, col: '#FF7A1A' }); }
    if (hz.type === 'toxic') { hurtPlayer(PL.maxHp * 0.06 * dt + 2 * dt * G.realm, { dot: true, col: '#7CFF4D' }); }
  }
  // facing & animation
  const m = PL.model, gs = m.group;
  gs.position.copy(PL.pos);
  const targetRot = PL.yaw + Math.PI;
  let dr = targetRot - gs.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
  gs.rotation.y += dr * (1 - Math.exp(-dt * 20));
  const hs = Math.hypot(PL.vel.x, PL.vel.z) / 7;
  animateCharacter(m, dt, hs, !PL.onGround, G.t, PL.pitch * 0.85 + PL.recoil * 3);
  PL.recoil = Math.max(0, PL.recoil - dt * 0.35);
  // ADS
  PL.ads = lerp(PL.ads, rmbDown ? 1 : 0, 1 - Math.exp(-dt * 14));
  // reload / fire
  const W0 = WEAPONS[PL.w];
  if (PL.reloadT > 0) { PL.reloadT -= dt; if (PL.reloadT <= 0) { PL.ammo[PL.w] = W0.mag; AU.click(); updateAmmoHud(); } }
  PL.fireT -= dt;
  if (mouseDown && PL.fireT <= 0 && PL.reloadT <= 0) {
    if (PL.ammo[PL.w] <= 0) startReload(); else fireWeapon();
  }
  // timers
  PL.iT -= dt; if (PL.berserk > 0) PL.berserk -= dt; if (PL.slow > 0) PL.slow -= dt;
  // passives tick
  updatePassives(dt);
}

function playerBaseDmg() {
  const L = id => PL.pw[id] || 0;
  return (12 + S.dmg * 6) * PL.st.boost * (1 + 0.08 * L('giant')) * (1 + 0.25 * L('rage') * (1 - PL.hp / PL.maxHp)) * (PL.berserk > 0 ? 2 : 1);
}
function fireWeapon() {
  const W0 = WEAPONS[PL.w], L = id => PL.pw[id] || 0;
  const rate = W0.rate / (1 + 0.12 * L('rapid')) / (PL.berserk > 0 ? 3 : 1);
  PL.fireT = rate; PL.ammo[PL.w]--; PL.shots++;
  PL.model.group.updateMatrixWorld(true);
  const muzzle = PL.gun.userData.muzzle; _v2.set(0, 0, 0); muzzle.localToWorld(_v2);
  const aim = computeAim();
  const dir = _v3.copy(aim).sub(_v2); if (dir.lengthSq() < 0.5) dir.copy(CAM.fwd); dir.normalize();
  const spread = lerp(W0.spread, W0.aim, PL.ads) * (PL.onGround ? 1 : 1.6);
  const dmg = playerBaseDmg() * W0.dmg;
  const pellets = W0.pellets + (L('multishot') ? (L('multishot') >= 3 ? 2 : 1) : 0);
  for (let i = 0; i < pellets; i++) {
    const d = dir.clone();
    if (i >= W0.pellets) { d.applyAxisAngle(UP, (i - W0.pellets + 1) * (i % 2 ? 1 : -1) * 0.07); }
    d.x += rand(-spread, spread); d.y += rand(-spread, spread) * 0.7; d.z += rand(-spread, spread); d.normalize();
    spawnBullet(_v2, d, W0.speed, dmg, { col: PL.C.col[2], wcol: W0.col, size: W0.size, len: W0.len, explode: W0.explode, pierce: (W0.pierce || 0) + L('pierce'), kind: W0.id === 'rocket' ? 'rocket' : 'bullet' });
  }
  if (L('echo') && PL.shots % Math.max(2, 7 - L('echo')) === 0) spawnBullet(_v2, dir.clone(), 90, dmg * 3, { col: 0xd07cff, size: 0.35, len: 2.5, pierce: 99, kind: 'echo', noSplit: true });
  AU.gun(W0.id);
  PL.recoil = Math.min(0.2, PL.recoil + W0.kick); PL.pitch = Math.min(1.25, PL.pitch + W0.kick * 0.25);
  FX.flash(_v2, W0.col, W0.id === 'rocket' || W0.id === 'shotgun' ? 4 : 2, 9);
  FX.burst(_v2, W0.col, W0.id === 'shotgun' ? 10 : 4, 3, 0.25, 0.12, { g: 0 });
  if (W0.id === 'sniper' || W0.id === 'rocket') shake(0.25);
  updateAmmoHud();
}
