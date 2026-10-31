// =====================================================================
//  GAME FLOW — launch, realms, HUD, pause, death, loop, boot
// =====================================================================
let _bnT = 0;
function banner(title, sub, col, dur = 2, small) {
  const b = $('banner'); $('bnTitle').textContent = title; $('bnTitle').style.color = col || '#fff'; $('bnTitle').style.fontSize = small ? '40px' : '';
  $('bnSub').textContent = sub || ''; b.classList.add('on');
  clearTimeout(_bnT); _bnT = setTimeout(() => b.classList.remove('on'), dur * 1000);
}

// ---------------- HUD ----------------
function updateHudChar() {
  const C = PL.C; if (!C) return;
  $('hcName').textContent = fullName(C.id, PL.mut); $('hcName').style.color = PL.mut ? MUTATIONS[PL.mut].c : C.col[2];
  $('hcRarity').innerHTML = `<span style="color:${rarCol(C)}">${RARITIES[C.tier].n}</span> <span style="color:#FFE600;font-family:monospace">${oddsText(totalOdds(C.id, PL.mut))}</span>`;
  $('hcPowers').innerHTML = C.p.map(p => `<span class="pchip" style="color:${PASSIVES[p].c}">${PASSIVES[p].i} ${PASSIVES[p].n} ${ROMAN[C.L]}</span>`).join('');
  $('ultName').textContent = ULTS[C.u].n.toUpperCase();
  $('ultArc').setAttribute('stroke', C.col[2]);
}
function buildHotbar() {
  $('hotbar').innerHTML = WEAPONS.map((w, i) => `<div class="slot" id="slot${i}"><div class="k">${i + 1}</div><div class="ico">${w.ico}</div><div class="nm">${w.n}</div><div class="rl" id="slotR${i}"></div></div>`).join('');
}
function updateHotbar() { WEAPONS.forEach((w, i) => { const s = $('slot' + i); if (s) s.classList.toggle('on', i === PL.w); }); updateAmmoHud(); }
function updateAmmoHud() { const W0 = WEAPONS[PL.w]; $('ammoCur').textContent = PL.ammo[PL.w] ?? W0.mag; $('ammoMax').textContent = '/ ' + W0.mag; $('ammoCur').style.color = PL.ammo[PL.w] <= Math.ceil(W0.mag * 0.25) ? '#FF3355' : '#fff'; }
function updateCoinsHud() { $('htCoins').textContent = fmt(S.coins) + ' 🪙'; }
function updateRealmBar() {
  const k = Math.min(1, G.kills / G.killsNeed);
  $('hrBarFill').style.width = (k * 100) + '%';
  $('hrBarText').textContent = G.bossDone ? 'REALM CLEARED — FIND THE PORTAL' : G.bossPending || G.boss ? 'THE BOSS IS HERE!' : `SLAY ${Math.max(0, G.killsNeed - G.kills)} MORE TO SUMMON THE BOSS`;
}
let _hudT = 0, _fps = 60;
function updateHud(dt) {
  _hudT -= dt;
  $('hpFill').style.width = Math.max(0, PL.hp / PL.maxHp * 100) + '%'; $('hpText').textContent = Math.max(0, Math.ceil(PL.hp));
  $('shFill').style.width = (PL.maxShield ? PL.shield / PL.maxShield * 100 : 0) + '%'; $('shText').textContent = Math.ceil(PL.shield);
  $('shFill').parentElement.parentElement.style.display = PL.maxShield ? 'flex' : 'none';
  const u = PL.ult; $('ultArc').setAttribute('stroke-dashoffset', String(314 * (1 - u / 100))); $('ultPct').textContent = u >= 100 ? 'READY' : Math.floor(u) + '%'; $('ultWrap').classList.toggle('ready', u >= 100);
  const W0 = WEAPONS[PL.w];
  $('ammoReload').textContent = PL.reloadT > 0 ? 'RELOADING…' : (PL.ammo[PL.w] === 0 ? 'PRESS R' : '');
  const rl = $('slotR' + PL.w); if (rl) rl.style.width = PL.reloadT > 0 ? ((1 - PL.reloadT / PL.reloadMax) * 100) + '%' : '0';
  $('vignette').style.opacity = PL.hp < PL.maxHp * 0.3 ? String(0.5 + Math.sin(G.t * 6) * 0.25) : $('vignette').style.opacity;
  if (_hudT > 0) return; _hudT = 0.1;
  $('htKills').textContent = `KILLS ${G.runKills} • ${Math.floor(G.runTime / 60)}:${String(Math.floor(G.runTime % 60)).padStart(2, '0')}`;
  updateCoinsHud();
  if (S.set.fps) $('htFps').textContent = `${Math.round(_fps)} FPS • ${S.set.quality.toUpperCase()}`;
  const st = [];
  if (PL.berserk > 0) st.push(['BERSERK ' + PL.berserk.toFixed(0) + 's', '#FF2A2A']);
  if (G.timeStop > 0) st.push(['TIME STOP', '#FFFFFF']);
  if (PL.slow > 0) st.push(['SLOWED', '#7AE0FF']);
  if (PL.pw.undying) st.push([PL.revived ? 'UNDYING USED' : 'UNDYING READY', PL.revived ? '#777' : '#FFE27A']);
  const hz = hazardAt(PL.pos.x, PL.pos.z); if (hz) st.push([{ lava: 'BURNING!', toxic: 'TOXIC!', water: 'WADING', ice: 'SLIPPERY' }[hz.type], hz.type === 'lava' ? '#FF7A1A' : hz.type === 'toxic' ? '#7CFF4D' : '#9AE8FF']);
  $('hudStatus').innerHTML = st.map(s => `<span class="st" style="color:${s[1]}">${s[0]}</span>`).join('');
  drawRadar();
  if (G.runTime > 30) $('hint').style.opacity = '0.35';
}
function drawRadar() {
  const cv = $('radar'), g = cv.getContext('2d'), W2 = 150, c = 75, sc = 75 / 38;
  g.clearRect(0, 0, W2, W2);
  g.save(); g.beginPath(); g.arc(c, c, 73, 0, TAU); g.clip();
  g.strokeStyle = 'rgba(0,240,255,.18)'; g.lineWidth = 1; for (const r of [25, 50]) { g.beginPath(); g.arc(c, c, r, 0, TAU); g.stroke(); }
  const cs = Math.cos(PL.yaw), sn = Math.sin(PL.yaw);
  const P2 = (x, z) => { const dx = x - PL.pos.x, dz = z - PL.pos.z; return [c + (dx * cs - dz * sn) * sc, c + (dx * sn + dz * cs) * sc]; };
  // arena edge
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.beginPath(); const [ax, ay] = P2(0, 0); g.arc(ax, ay, ARENA * sc, 0, TAU); g.stroke();
  for (const h of W.hazards) { const [x, y] = P2(h.x, h.z); g.fillStyle = h.type === 'lava' ? 'rgba(255,90,0,.35)' : h.type === 'toxic' ? 'rgba(124,255,0,.3)' : 'rgba(80,160,255,.25)'; g.beginPath(); g.arc(x, y, h.r * sc, 0, TAU); g.fill(); }
  for (const p of G.pickups) { const [x, y] = P2(p.m.position.x, p.m.position.z); g.fillStyle = p.kind === 'coin' ? '#FFD700' : p.kind === 'heart' ? '#4CFF7A' : '#FF00AA'; g.fillRect(x - 1, y - 1, 2, 2); }
  for (const a of G.allies) if (a.m && a.m.position) { const [x, y] = P2(a.m.position.x, a.m.position.z); g.fillStyle = '#4CFF7A'; g.fillRect(x - 2, y - 2, 4, 4); }
  for (const e of G.enemies) { if (e.dead) continue; const [x, y] = P2(e.pos.x, e.pos.z); if (e.boss) { g.fillStyle = '#FF2A55'; g.beginPath(); g.arc(x, y, 6 + Math.sin(G.t * 8) * 1.5, 0, TAU); g.fill(); } else { g.fillStyle = e.elite ? '#FFAA00' : '#FF4466'; g.beginPath(); g.arc(x, y, e.elite ? 3.5 : 2.5, 0, TAU); g.fill(); } }
  if (G.portal) { const [x, y] = P2(G.portal.position.x, G.portal.position.z); g.fillStyle = '#00F0FF'; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill(); }
  g.restore();
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(c, c - 7); g.lineTo(c - 5, c + 5); g.lineTo(c + 5, c + 5); g.closePath(); g.fill();
}

// ---------------- flow ----------------
function clearEntities() {
  G.enemies.forEach(e => { W.scene.remove(e.model.group); disposeModel(e.model.group); }); G.enemies.length = 0;
  G.bullets.forEach(b => W.scene.remove(b.mesh)); G.bullets.length = 0;
  G.eproj.forEach(s => W.scene.remove(s.m)); G.eproj.length = 0;
  G.zones.forEach(z => { if (z.obj) { W.scene.remove(z.obj); disposeTemp(z.obj); } if (z.cleanup) z.cleanup(); }); G.zones.length = 0;
  W.scene.children.filter(o => o.userData && o.userData.w !== undefined && o.type === 'Group' && o.children.length === 2).forEach(o => W.scene.remove(o));
  G.allies.forEach(a => { if (ALLY[a.kind].end && a.kind === 'grid') ALLY[a.kind].end(a); if (a.m) { W.scene.remove(a.m); disposeModel(a.m); } }); G.allies.length = 0;
  G.pickups.forEach(p => W.scene.remove(p.m)); G.pickups.length = 0;
  G.chunks.forEach(c => { if (c.o) W.scene.remove(c.o); if (c.disposeOnly) disposeModel(c.disposeOnly); }); G.chunks.length = 0;
  if (G.portal) { W.scene.remove(G.portal); G.portal = null; }
  clearTimers(); clearTemps(); PG.clear(); PS.clear(); OV.nums.length = 0;
  $('prompt').style.display = 'none';
}
function setupRealm() {
  clearEntities();
  G.biome = (G.realm - 1) % BIOMES.length;
  buildBiome(G.biome, G.realm);
  G.kills = 0; G.killsNeed = Math.min(40, 14 + G.realm * 2); G.boss = null; G.bossDone = false; G.bossPending = false; G.spawnT = 1.5; G.timeStop = 0; G.slowmo = 0;
  PL.pos.set(0, 0, 0); PL.vel.set(0, 0, 0); PL.yaw = 0; PL.pitch = 0.1; PL.revived = false; PL.berserk = 0; PL.slow = 0; PL.timers = {};
  if (PL.model) PL.model.group.position.copy(PL.pos);
  CAM.smoothY = 0;
  spawnDrones();
  const b = BIOMES[G.biome], loop = Math.floor((G.realm - 1) / BIOMES.length);
  $('hrRealm').textContent = `REALM ${G.realm}`; $('hrBiome').textContent = b.n + (loop ? ' ' + 'I'.repeat(loop + 1) : '');
  $('hudRealm').style.display = 'block'; $('hudBoss').style.display = 'none';
  updateRealmBar();
  banner(`REALM ${G.realm}`, b.n, b.skin.e, 2.4);
  MUSIC.cfg = Object.assign({ arp: 0.55 }, b.music); MUSIC.intensity = 0.15;
  if (G.realm > S.stats.best) S.stats.best = G.realm;
  saveSoon();
}
function launchGame() {
  AU.init(); closeModals(); previewKey = null; autoRoll = false;
  if (rolling) return;
  lockPointer();
  ['lobby', 'gameover', 'pause'].forEach(id => $(id).classList.remove('on'));
  G.playing = true; G.paused = false; G.dead = false; G.realm = 1; G.runKills = 0; G.runCoins = 0; G.runTime = 0; G.runBosses = 0; G.t = 0;
  setScene(W.scene);
  refreshPlayerChar();
  PL.hp = PL.maxHp; PL.shield = PL.maxShield; PL.ult = 0; PL.ammo = WEAPONS.map(w => w.mag); PL.reloadT = 0; PL.fireT = 0.3; PL.ads = 0; PL.shots = 0;
  setWeapon(0, true);
  setupRealm();
  R.camera.fov = S.set.fov; R.camera.updateProjectionMatrix();
  $('hud').classList.add('on'); $('crosshair').classList.add('on'); $('hint').style.opacity = '1';
  MUSIC.play(MUSIC.cfg);
  AU.portal();
}
function nextRealm() {
  if (G.transitioning) return; G.transitioning = true;
  AU.portal(); $('fade').style.opacity = '1';
  setTimeout(() => {
    G.realm++; PL.hp = Math.min(PL.maxHp, PL.hp + PL.maxHp * 0.4); PL.shield = PL.maxShield;
    setupRealm();
    setTimeout(() => { $('fade').style.opacity = '0'; G.transitioning = false; }, 120);
  }, 520);
}
function pauseGame() {
  if (!G.playing || G.paused || G.dead) return;
  G.paused = true; mouseDown = rmbDown = false;
  $('pauseMsg').textContent = 'Your mouse is free. Click RESUME to lock it back into the game.';
  $('pause').classList.add('on'); $('crosshair').classList.remove('on');
  if (document.pointerLockElement) document.exitPointerLock();
  AU.mus && (AU.mus.gain.value = S.set.music ? 0.12 : 0);
  saveSoon();
}
function resumeGame(fromLock) {
  if (!G.paused) return;
  if (!fromLock && !G.lockFail && document.pointerLockElement !== canvasEl()) {
    G.wantResume = true; lockPointer();
    setTimeout(() => { if (G.wantResume && G.paused) { G.wantResume = false; G.lockFail = true; doResume(); notify('Mouse lock unavailable', 'Click inside the game to capture your mouse.', '#FFE600'); } }, 1500);
    return;
  }
  doResume();
}
function doResume() { G.paused = false; closeModals(); $('pause').classList.remove('on'); $('crosshair').classList.add('on'); AU.applyVol(); }
function playerDied() {
  if (G.dead) return;
  G.dead = true; mouseDown = rmbDown = false; PL.hp = 0; S.stats.deaths++;
  AU.boom(true); shake(1); FX.explosion(V3(PL.pos.x, 1, PL.pos.z), 3, PL.model.glowCol.getHex(), true);
  PL.model.group.visible = false; G.slowmo = 2;
  MUSIC.intensity = 0;
  G.leaving = true; if (document.pointerLockElement) document.exitPointerLock(); setTimeout(() => G.leaving = false, 50);
  saveNow();
  setTimeout(() => {
    if (!G.dead) return;
    $('goStats').innerHTML = `<div>Realm reached</div><b>${G.realm}</b><div>Biome</div><b>${BIOMES[G.biome].n}</b><div>Enemies slain</div><b>${G.runKills}</b><div>Bosses defeated</div><b>${G.runBosses}</b><div>Coins earned</div><b>${fmt(G.runCoins)} 🪙</b><div>Time</div><b>${Math.floor(G.runTime / 60)}m ${Math.floor(G.runTime % 60)}s</b>`;
    $('gameover').classList.add('on'); $('crosshair').classList.remove('on');
  }, 1500);
}
function goLobby() {
  G.leaving = true; if (document.pointerLockElement) document.exitPointerLock();
  G.playing = false; G.paused = false; G.dead = false;
  clearEntities(); clearBiome();
  if (PL.model) PL.model.group.visible = true;
  ['hud'].forEach(id => $(id).classList.remove('on')); $('crosshair').classList.remove('on');
  ['pause', 'gameover'].forEach(id => $(id).classList.remove('on')); $('lobby').classList.add('on');
  setScene(Showcase.scene); Showcase.key = ''; previewKey = null;
  MUSIC.cfg = { root: 50, scale: 'dorian', tempo: 92, arp: 0.35, lead: 'sine' }; MUSIC.intensity = 0;
  AU.applyVol(); updateLobby(); saveNow();
  setTimeout(() => G.leaving = false, 100);
}

// ---------------- main loop ----------------
let _last = performance.now();
function stepGame(dt) {
  G.t += dt; G.runTime += dt; S.stats.time += dt;
  tickTimers(dt);
  if (G.timeStop > 0) G.timeStop -= dt;
  if (PL.model.group.visible) updatePlayer(dt);
  updateSpawner(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updateEProj(dt);
  updateZones(dt);
  updateAllies(dt);
  updatePickups(dt);
  updateChunks(dt);
  updatePortal(dt);
}
const PERF = { t: 0, n: 0 };
function autoQuality(raw) {
  if (!S.set.autoQ || !G.playing || G.paused || G.dead) { PERF.t = PERF.n = 0; return; }
  PERF.t += raw; PERF.n++;
  if (PERF.t < 6) return;
  const fps = PERF.n / PERF.t; PERF.t = PERF.n = 0;
  const order = ['low', 'medium', 'high', 'ultra'], i = order.indexOf(S.set.quality);
  if (fps < 32 && i > 0) { S.set.quality = order[i - 1]; applySettings(); saveSoon(); notify('Graphics adjusted', `Switched to ${S.set.quality.toUpperCase()} quality for smoother play (${Math.round(fps)} FPS). Change it in Settings.`, '#FFE600'); }
}
function loop(now) {
  requestAnimationFrame(loop);
  const raw = Math.max(0, (now - _last) / 1000);
  let dt = Math.min(0.05, raw); _last = now;
  if (raw < 1) autoQuality(raw);
  _fps = lerp(_fps, 1 / Math.max(0.001, dt), 0.05);
  R.time += dt;
  try {
    if (G.playing) {
      let sdt = dt; if (G.slowmo > 0) { G.slowmo -= dt; sdt = dt * 0.35; }
      if (!G.paused) {
        if (G.dead) { G.t += sdt; tickTimers(sdt); updateEnemies(sdt * 0.5); updateChunks(sdt); }
        else stepGame(sdt);
        updateWorld(sdt, G.t);
        PG.update(sdt); PS.update(sdt); updateTemps(sdt); updateFlashes(sdt);
        updateHud(dt);
      }
      updateCamera(dt);
    } else if (R.scene === Showcase.scene) {
      Showcase.update(dt); PG.update(dt); PS.update(dt); updateTemps(dt); updateFlashes(dt);
    }
    if (R.post) { const u = R.post.comp.uniforms; u.hurt.value = Math.max(0, u.hurt.value - dt * 2); u.ca.value = Math.max(0, u.ca.value - dt * 3); u.glitch.value = Math.max(0, u.glitch.value - dt * 0.7); u.desat.value = G.timeStop > 0 ? 0.85 : Math.max(0, u.desat.value - dt * 1.5); u.vig.value = 0.35 + (G.playing && PL.hp < PL.maxHp * 0.3 ? 0.25 : 0); }
    renderFrame();
    OV.draw(dt);
  } catch (err) { console.error(err); if (!window.__loopErr) { window.__loopErr = String(err && err.stack || err); } }
}

// ---------------- boot ----------------
function boot() {
  if (!window.THREE) { $('bootMsg').textContent = 'Could not load the 3D engine (three.js). Check your internet connection and reload the page.'; return; }
  try {
    loadSave();
    initRenderer(); initWorld(); onQualityChanged();
    Showcase.init(); setScene(Showcase.scene);
    initLobbyUI(); applySettings(); buildHotbar();
  } catch (e) { console.error(e); $('bootMsg').textContent = 'Something went wrong starting the game: ' + e.message; return; }
  $('btnPlay').onclick = launchGame; $('btnResume').onclick = () => resumeGame(); $('btnQuit').onclick = goLobby; $('btnRetry').onclick = launchGame; $('btnMenu').onclick = goLobby;
  $('lobby').classList.add('on'); $('boot').style.display = 'none';
  setInterval(saveNow, 10000); addEventListener('beforeunload', saveNow);
  const firstTouch = () => { AU.init(); if (!G.playing) MUSIC.play({ root: 50, scale: 'dorian', tempo: 92, arp: 0.35, lead: 'sine' }); removeEventListener('pointerdown', firstTouch); };
  addEventListener('pointerdown', firstTouch);
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.playing && !G.dead) pauseGame(); });
  window.__SOULS = { G, PL, S, W, R, ROSTER, BIOMES, BOSSES, spawnBoss, spawnEnemy, triggerUlt, launchGame, goLobby, nextRealm, setupRealm, doRoll, ULT_FN, buildCharacter, buildBoss, killEnemy, damageEnemy };
  requestAnimationFrame(loop);
}
boot();
