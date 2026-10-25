/* main.js — modes, the fixed-step loop, the camera, marine snow, and the frame pipeline. */
'use strict';
(function (B) {
  const M = B.M, R = B.R, E = B.E, A = B.A, I = B.I;
  const S = B.Story, Hd = B.Hud;
  B.time = 0; B.frame = 0; B.mode = 'boot'; B.act = 'title'; B.renderMs = 0; B.fps = 60;
  let shakeAmt = 0, shx = 0, shy = 0;
  const camS = { x: 0, y: 0, z: 0 };
  let pauseSnap = null, pauseT = 0;
  let lastOx = 0, lastOy = 0, lightT = 6, lightAt = -99;

  B.shake = function (a) { if (B.settings.shake && !B.settings.photo) shakeAmt = Math.max(shakeAmt, a); };
  B.setRes = function (w, h) {
    if (R.W === w && R.H === h) return;
    B.W = w; B.H = h; R.alloc(w, h); R.resize(); snow.init();
  };
  // The play resolution: 480x270, 400x225 in performance mode, 320x180 for the Second Copy (NG+).
  // The play resolution by quality: 480x270 high, 400x225 medium, 320x180 low (and always for the Second Copy).
  const QRES = [[320, 180], [400, 225], [480, 270]], QNAME = ['LOW', 'MEDIUM', 'HIGH'];
  B.playRes = function (ng) { const r = ng ? QRES[0] : QRES[M.clamp(B.settings.quality | 0, 0, 2)]; B.setRes(r[0], r[1]); };
  // Up to two automatic steps down the first time play runs slow; the setting can be put back by hand.
  let slowT = 0;
  function autoQuality(dt) {
    if (B.noAutoPause || B.settings.qualityChecked || B.mode !== 'play' || !B.player) return;
    slowT += dt; if (slowT < 6) return;
    slowT = 0;
    if (B.renderMs > 28 && B.settings.quality > 0) { B.settings.quality--; B.playRes(B.state && B.state.ng); Hd.toast('QUALITY ' + QNAME[B.settings.quality] + ' · CHANGE IT IN SETTINGS'); if (B.settings.quality === 0) B.settings.qualityChecked = true; }
    else B.settings.qualityChecked = true;
    B.saveSettings();
  }

  // ------------------------------------------------------------------ marine snow: five parallax layers
  const LAYERS = [{ n: 120, f: 0.55, s: 1, b: 0.45, far: true }, { n: 90, f: 0.75, s: 1, b: 0.65, far: true }, { n: 60, f: 1, s: 1, b: 0.85 }, { n: 30, f: 1.35, s: 2, b: 1 }, { n: 10, f: 1.9, s: 3, b: 1 }];
  const snow = {
    pts: [],
    init() { this.pts = []; const sc = R.W / 480; LAYERS.forEach((L, li) => { for (let k = 0; k < L.n * sc; k++) this.pts.push({ x: Math.random() * R.W, y: Math.random() * R.H, li, ph: Math.random() * 6.28 }); }); },
    draw(dt, dox, doy) {
      const P = B.player, buf = R.buffers(), L = R.env.lamp, W = R.W, Hh = R.H;
      if (!P) return;
      const lx = R.sx(L.x), ly = R.sy(L.y, L.z), adx = L.dx * B.PX, ady = L.dy * B.PY, al = Math.hypot(adx, ady) || 1;
      const reach = Math.sqrt(L.r2) * B.PX * 0.9, cosO = L.cosO - 0.05;
      const amb = B.act === 'deck' ? 0 : R.waterAt(P.z), sh = B.Z.wave.shear;
      const sink = Math.max(-3, Math.min(6, P.vz));
      for (const p of this.pts) {
        const Ly = LAYERS[p.li];
        p.x -= dox * Ly.f; p.y -= doy * Ly.f;
        p.y += (0.6 - sink * 0.4) * Ly.f * dt * 6;           // snow drifts down; when you sink it streams past you
        p.x += (p.li < 2 ? -1 : 1) * sh * Ly.f * dt * 14 + Math.sin(B.time * 0.5 + p.ph) * dt * 0.8;
        if (p.x < 0) p.x += W; else if (p.x >= W) p.x -= W;
        if (p.y < 0) p.y += Hh; else if (p.y >= Hh) p.y -= Hh;
        const x = p.x | 0, y = p.y | 0, i = y * W + x;
        if (Ly.far && buf.ZB[i] < P.z + 12) continue;
        let k = 0;
        if (L.on) {
          const rx = x - lx, ry = y - ly, d = Math.hypot(rx, ry);
          if (d < reach && d > 1) { const ca = (rx * adx + ry * ady) / (d * al); if (ca > cosO) k = (1 - d / reach) * (0.6 + (ca - cosO) * 6) * L.i * 0.5; }
        }
        let r = L.cr * k, g = L.cg * k, b = L.cb * k;
        if (amb) { r += amb[0] * 4; g += amb[1] * 4; b += amb[2] * 4; }
        const v = Ly.b; if (r + g + b < 0.01) continue;
        const s = Ly.s;
        for (let oy = 0; oy < s; oy++) for (let ox = 0; ox < s; ox++) {
          const px = x + ox, py = y + oy; if (px >= W || py >= Hh) continue;
          if (s > 1 && B.BAYER[(py & 3) * 4 + (px & 3)] > 0) continue;
          const j = py * W + px; buf.FR[j] += r * v * 0.5; buf.FG[j] += g * v * 0.5; buf.FB[j] += b * v * 0.5;
        }
      }
    },
  };

  // ------------------------------------------------------------------ modes
  B.toTitle = function () {
    B.mode = 'title'; B.act = 'title'; B.scene = null; B.player = null; Hd.reset(); S.clearCaps();
    B.playRes(false);
    B.map = S.getMap('act3'); E.reset(); B.Z.reset(); A.stopWaltz(); A.setLofi(16, 20000);
    const f = B.map.features;
    S.buildArchive(f.AX, f.AY, B.meta.deaths);
    if (S.archiveCore) S.archiveCore.interact = null;
    E.motes(f.AX, f.AY, 4182, 60, 6, [[0.1, 0.4, 0.5], [0.05, 0.3, 0.4]], 1e9);
    E.add({ type: 'titleLights', x: f.AX, y: f.AY, z: 4180, draw() { for (let k = 0; k < 4; k++) { const a = B.time * 0.07 + k * 1.57; R.addLight(f.AX + Math.cos(a) * (6 + k * 3), f.AY + Math.sin(a) * (6 + k * 3), 4184, 0.3, 0.8, 1, 16, 1.4); } } });
    titleMenu();
  };
  function titleMenu() {
    const items = [{ label: 'BEGIN DESCENT', fn: () => S.newGame(false) }];
    if (S.hasSave()) items.unshift({ label: 'CONTINUE · ' + (B.store.get('benthos.save', {}).label || 'MARA EKDAHL'), fn: () => S.continueGame() });
    if (B.meta.ngplus) items.push({ label: 'SECOND COPY (NEW GAME+, 320×180)', fn: () => S.newGame(true) });
    const seen = Object.keys(B.meta.seen || {}).length;
    if (seen) items.push({ label: 'FIELD NOTES · ' + seen + '/' + Object.keys(S.NOTES).length, fn: () => notesMenu(titleMenu) });
    if (B.meta.runs || B.meta.deaths) items.push({ label: 'RECORDS', fn: () => recordsMenu(titleMenu) });
    items.push({ label: 'SETTINGS', fn: () => settingsMenu(titleMenu) }, { label: 'CONTROLS', fn: () => controlsMenu(titleMenu) });
    Hd.menu({ title: '', items, y: Math.round(R.H * 0.42), bare: false });
  }
  function onOff(k) { return () => (B.settings[k] ? 'ON' : 'OFF'); }
  function settingsMenu(back) {
    const tog = k => ({ adj: () => { B.settings[k] = !B.settings[k]; B.saveSettings(); }, value: onOff(k) });
    const vol = k => ({ adj: d => { B.settings[k] = M.clamp(Math.round((B.settings[k] + d * 0.1) * 10) / 10, 0, 1); B.saveSettings(); A.setVolume(); }, value: () => '<' + Math.round(B.settings[k] * 10) + '>' });
    Hd.menu({
      title: 'SETTINGS', cancel: true, onCancel: back, items: [
        { label: 'DIFFICULTY', keep: true, adj: d => { B.settings.difficulty = (B.settings.difficulty + (d || 1) + 3) % 3; B.saveSettings(); }, value: () => B.diff().name },
        Object.assign({ label: 'MASTER VOLUME', keep: true }, vol('master')), Object.assign({ label: 'MUSIC', keep: true }, vol('music')),
        Object.assign({ label: 'CRT SHADER', keep: true }, tog('crt')), Object.assign({ label: 'PHOTOSENSITIVITY MODE', keep: true }, tog('photo')),
        Object.assign({ label: 'HONEST HUD (NO CO2 LIES)', keep: true }, tog('honest')), Object.assign({ label: 'STEADY TRIM ASSIST', keep: true }, tog('steady')),
        Object.assign({ label: 'OBJECTIVE AND BEACON', keep: true }, tog('markers')),
        Object.assign({ label: 'SCREEN SHAKE', keep: true }, tog('shake')), Object.assign({ label: I.touchMode ? 'VIBRATION' : 'RUMBLE', keep: true }, tog('rumble')),
        { label: 'QUALITY', keep: true, adj: d => { B.settings.quality = (B.settings.quality + (d || 1) + 3) % 3; B.saveSettings(); if (B.state && B.mode !== 'title') B.playRes(B.state.ng); else B.playRes(false); }, value: () => QNAME[B.settings.quality | 0] },
        { label: 'FULLSCREEN', keep: true, fn: toggleFullscreen, value: () => (document.fullscreenElement ? 'ON' : 'OFF') },
        { label: 'BACK', fn: back },
      ],
    });
  }
  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else { const p = document.documentElement.requestFullscreen({ navigationUI: 'hide' }); if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* unsupported */ } }).catch(() => Hd.toast('FULLSCREEN NOT ALLOWED HERE')); }
    } catch (e) { Hd.toast('FULLSCREEN NOT ALLOWED HERE'); }
  }
  function controlsMenu(back) {
    if (I.touchMode) {
      const T = ['LEFT THUMB: THRUST · PAST THE RING: BOOST', 'HOLD ON THE RIGHT: AIM THE LAMP AND PICK', 'RIGHT EDGE: TOP = BLOW (RISE) · BOTTOM = FLOOD (SINK)',
        'USE: INTERACT (HOLD TO ABSORB)', 'PING: TAP WIDE · HOLD+RELEASE NARROW', 'LAMP: TAP W/R/OFF · HOLD: FLARE', 'PICK: FIRE / HOLD REEL / TAP RELEASE',
        'CLMP: TAP CLAMP · HOLD BRACE · EAR: HOLD LISTEN', 'BRTH: HOLD BREATH · TAP A TANK CELL TO USE IT', 'HOLD THE O2 CLUSTER: CHEST GAUGE',
        'TAP SCRUB: SWAP CANISTER · TAP DEPTH: CHART', 'II: PAUSE'];
      Hd.menu({ title: 'TOUCH CONTROLS', cancel: true, onCancel: back, items: T.map(l => ({ label: l, disabled: true })).concat([{ label: 'BACK', fn: back }]) });
      return;
    }
    const L = ['WASD THRUST (SCREEN-RELATIVE) · MOUSE AIM LAMP', 'SHIFT BOOST · LET GO TO COAST (SILENT)', 'C FLOOD: SINK · SPACE BLOW: RISE (HISS)',
      'R PING (HOLD+RELEASE: NARROW) · RMB HOLD: LISTEN', 'LMB PICK: FIRE / HOLD REEL / RELEASE', 'F LAMP W/R/OFF · HOLD F: FLARE',
      'E INTERACT (HOLD TO ABSORB) · Q CLAMP · HOLD Q BRACE', '1-5 BIOMASS · G GRAFT · X POWERHEAD', 'V HOLD BREATH · H CHEST GAUGE · T SWAP SCRUBBER',
      'TAB FABRICATOR (AT A CAIRN) · M CHART · Z WIPE VISOR', 'GAMEPAD: LS THRUST · RS AIM · RT BOOST · LT LISTEN', 'LB RISE · RB SINK · A USE · B CLAMP · X PING · Y LAMP',
      'RS-CLICK PICK · LS-CLICK BREATH · DPAD CELLS/GAUGE'];
    Hd.menu({ title: 'CONTROLS', cancel: true, onCancel: back, items: L.map(l => ({ label: l, disabled: true })).concat([{ label: 'BACK', fn: back }]) });
  }
  function notesMenu(back) {
    const seen = B.meta.seen || {}, keys = Object.keys(S.NOTES);
    const items = keys.map(k => seen[k] ? { label: S.NOTES[k].name, fn: () => { const n = S.NOTES[k]; Hd.openDoc({ title: n.name, body: [n.sub, ''].concat(n.body) }, () => notesMenu(back)); } } : { label: '? ? ?', disabled: true });
    // two columns would be kinder; one column of short names fits the buffer
    Hd.menu({ title: 'FIELD NOTES · ' + Object.keys(seen).length + '/' + keys.length, cancel: true, onCancel: back, items: items.concat([{ label: 'BACK', fn: back }]), compact: true });
  }
  function recordsMenu(back) {
    const m = B.meta, E3 = ['ascent', 'sediment', 'lossless'], seen = Object.keys(m.seen || {}).length;
    const L = ['DESCENTS BEGUN · ' + (m.runs || 0), 'TIMES THE SIGNAL WAS LOST · ' + (m.deaths || 0), 'HELMETS IN THE ARCHIVE · ' + (26 + (m.deaths || 0)),
      'FIELD NOTES · ' + seen + '/' + Object.keys(S.NOTES).length, '', 'ENDINGS'].concat(E3.map(e => '  ' + ((m.endings || []).includes(e) ? e.toUpperCase() : '- - -')));
    if (m.ngplus) L.push('', 'THE SECOND COPY IS AVAILABLE');
    Hd.menu({ title: 'RECORDS', cancel: true, onCancel: back, items: L.map(l => ({ label: l, disabled: true })).concat([{ label: 'BACK', fn: back }]) });
  }
  function journalMenu() {
    const docs = S.journal(), items = docs.map(d => ({ label: d.title.length > 46 ? d.title.slice(0, 44) + '..' : d.title, fn: () => Hd.openDoc(d, journalMenu) }));
    Hd.menu({ title: 'JOURNAL', cancel: true, onCancel: pauseMenu, items: items.concat([{ label: 'BACK', fn: pauseMenu }]) });
  }
  function pause() {
    if (B.mode !== 'play') return;
    B.mode = 'pause'; pauseSnap = new Uint32Array(R.out32); pauseT = 0; A.mute(true);
    pauseMenu();
  }
  function pauseMenu() {
    Hd.menu({
      title: 'PAUSED', cancel: true, onCancel: resume, items: [
        { label: 'RESUME', fn: resume }, { label: 'JOURNAL · ' + S.journal().length + '/' + S.docCount(), fn: journalMenu, disabled: !S.journal().length },
        // the suit actions a gamepad has no button for
        ...(B.player && B.act !== 'deck' ? [
          { label: 'OPEN THE CHART', fn: () => { resume(); if (!B.Hud.mapOn()) B.Hud.toggleMap(); }, disabled: !B.player.relics.hand },
          { label: 'SWAP SCRUBBER CANISTER · ' + B.player.limes + ' SPARE', fn: () => { resume(); B.Player.swapLime(); }, disabled: !B.player.limes },
        ] : []),
        { label: 'FIELD NOTES · ' + Object.keys(B.meta.seen || {}).length + '/' + Object.keys(S.NOTES).length, fn: () => notesMenu(pauseMenu), disabled: !Object.keys(B.meta.seen || {}).length },
        { label: 'SETTINGS', fn: () => settingsMenu(pauseMenu) }, { label: 'CONTROLS', fn: () => controlsMenu(pauseMenu) },
        { label: 'QUIT TO TITLE', fn: () => { A.mute(false); B.toTitle(); } },
      ],
    });
  }
  function resume() { Hd.closeMenu(); B.mode = 'play'; A.mute(false); }
  B.pause = pause;

  // ------------------------------------------------------------------ fixed update
  function tick(dt) {
    B.frame++;
    if (B.mode === 'boot') return;
    if (B.mode === 'title') { B.time += dt; Hd.tick(dt); E.update(dt); audioTick(dt); return; }
    if (B.mode === 'pause') { pauseT += dt; Hd.tick(dt); return; }
    if (B.mode === 'dead') {
      B.deadT += dt; Hd.tick(dt); audioTick(dt);
      if (B.mode === 'dead' && B.deadT > 1.2 && !Hd.menuOpen()) Hd.menu({ items: [{ label: 'RETRY', fn: () => S.retry() }, { label: 'QUIT', fn: () => { B.toTitle(); } }], y: Math.round(R.H / 2 + 10), bare: true });
      return;
    }
    if (B.mode === 'scene') {
      const sc = B.scene;
      if (sc && sc.world) { B.time += dt; E.update(dt); S.update(dt); B.Z.update(dt); E.endTick(); }
      else S.update(dt);
      Hd.tick(dt);
      if (sc && B.scene === sc) sc.update(dt);
      audioTick(dt);
      return;
    }
    if (B.mode === 'play') {
      const modal = Hd.menuOpen();
      if (modal) { Hd.tick(dt); return; }
      if (I.pressed('pause')) { if (!Hd.closeOverlay()) { pause(); return; } }
      B.time += dt;
      B.grainLevel = 0; B.flange = 0;
      Hd.tick(dt);
      B.Player.update(dt);
      S.update(dt);
      E.update(dt);
      B.Z.update(dt);
      E.endTick();
      // macroblock pareidolia: at most once every four minutes in the Settling
      if (B.act === 'act3') { B.faceT = (B.faceT === undefined ? 120 : B.faceT) - dt; if (B.faceT <= 0) { B.faceT = M.rnd(240, 320); B.facePulse = 0.1; B.facePos = [M.rnd(20, R.W - 52), M.rnd(20, R.H - 52)]; } if (B.facePulse > 0) B.facePulse -= dt; }
      audioTick(dt);
    }
  }
  function audioTick(dt) {
    if (!A.ready) return;
    const P = B.player, sc = B.scene;
    if (B.mode === 'title' || !P) { A.update(dt, { depth: 4185, act: 'act3', thrust: 0, breathing: false, ostinato: 0.6, powered: false }); return; }
    A.update(dt, {
      depth: P.z, act: B.act, topside: B.act === 'deck' || (sc && sc.topside), thrust: P.thrust, boost: P.boost, hr: P.breached ? 72 + (P.hr - 72) * 0.3 : P.hr,
      breathRate: 10 + (P.hr - 60) * 0.18, breathHold: P.breathHold, ring: P.ring, crush: P.crush, listening: P.listening, powered: P.powered && !P.braced,
      inLayer: B.Z.inLayer(P.z), sofar: B.Z.sofarAt(P.z), grain: B.grainLevel, flange: B.flange > 0, reel: P.reeling, duck: B.danger > 0,
      ostinato: sc && sc.ostinato !== undefined ? sc.ostinato : undefined, extraBeat: (B.act === 'act3' && P.z > 3900) || (sc && sc.extraBeat),
      breathing: !(sc && sc.world === false) && B.mode !== 'dead',
    });
  }

  // ------------------------------------------------------------------ rendering
  function renderWorld(dt) {
    const P = B.player, sc = B.scene;
    const topside = B.act === 'deck' || (sc && sc.topside);
    let tx, ty, tz;
    if (B.mode === 'title') { const f = B.map.features, a = B.time * 0.04; tx = f.AX + Math.cos(a) * 7; ty = f.AY + Math.sin(a) * 7 + 6; tz = 4180; }
    else if (sc && sc.cam) { tx = sc.cam.x; ty = sc.cam.y; tz = sc.cam.z; }
    else { tx = P.x + P.vx * 0.4; ty = P.y + P.vy * 0.4 + (P.vz > 1 ? 1.5 : 0); tz = P.z; }
    if (B.snapCamera || !isFinite(camS.x)) { camS.x = tx; camS.y = ty; camS.z = tz; B.snapCamera = false; }
    const k = Math.min(1, dt * 5);
    camS.x += (tx - camS.x) * k; camS.y += (ty - camS.y) * k; camS.z += (tz - camS.z) * Math.min(1, dt * 8);
    shakeAmt *= Math.pow(0.02, dt);
    shx = (Math.random() - 0.5) * shakeAmt * 0.06; shy = (Math.random() - 0.5) * shakeAmt * 0.06;
    const eyeZ = B.mode === 'title' ? tz : sc && sc.cam ? sc.cam.z : P.z;
    const zCut = topside ? -60 : B.mode === 'title' ? 4176 : (sc && sc.cam ? sc.cam.z + 0.5 : P.z - 2.5);
    const maxView = topside ? 70 : eyeZ < 220 ? 100 : 64;
    R.setCamera(camS.x + shx, camS.y + shy, camS.z, zCut, maxView);
    const env = R.env;
    env.topside = topside; env.fog = !topside; env.fogMul = eyeZ < 200 ? 0.45 + eyeZ / 800 : 0.6;
    if (B.mode === 'title') env.eye = { x: tx, y: ty + 4, z: tz - 6 }; else env.eye = sc && sc.cam ? { x: sc.cam.x, y: sc.cam.y, z: sc.cam.z } : { x: P.x, y: P.y, z: P.z - 0.8 };
    env.caustic = eyeZ < 150 ? 1 : 0; env.cauFrame = (((B.time * 8) | 0) % 24) * 4096; env.time = B.time;
    env.topR = 0.95; env.topG = 0.86; env.topB = 0.8; env.sunScale = 1;
    // the storm over the Asher Deep: a double flash now and then, thunder a few seconds behind it
    if (topside && B.act === 'deck' && !B.settings.photo) {
      if ((lightT -= dt) <= 0) { lightT = M.rnd(14, 32); lightAt = B.time; A.sfxAt('thunder', M.rnd(1.2, 3.5)); }
      const lt = B.time - lightAt, f = lt < 0.08 ? 1 : lt > 0.16 && lt < 0.24 ? 0.7 : lt < 0.6 ? Math.max(0, 0.25 - lt * 0.4) : 0;
      if (f > 0) { env.topR += f * 2.2; env.topG += f * 2.3; env.topB += f * 2.6; }
    }
    if (B.mode === 'title') env.lamp.on = false;
    R.begin();
    R.terrain(B.map, B.mode === 'play' && !topside && P ? P : null);
    // the player sorts with everything else
    const extra = [];
    if (P && B.mode !== 'title' && !(sc && sc.hollow)) extra.push({ x: P.x, y: P.y, z: P.z, draw: () => B.Player.draw(), alive: true });
    if (sc && sc.hollow) extra.push({ x: P.x, y: P.y, z: P.z, alive: true, draw() { R.model(P.x, P.y, P.z, B.MD.diver({ yaw: Math.atan2(sc.cam.y - P.y, sc.cam.x - P.x), t: 0, kick: 0, lamp: 'off', hollow: true, growth: 1, fill: 1, tankCol: [0.1, 0.9, 0.6], plain: [] }), { scale: 1, minLight: 0.4 }); } });
    const saved = E.list; E.list = saved.concat(extra); E.draw(); E.list = saved;
    if (B.ghostFrame && B.mode === 'play') { const g = B.ghostFrame; R.model(g.x, g.y, g.z, B.MD.diver({ yaw: B.MD.quant8(g.yaw), t: B.time, kick: 0.5, lamp: 'off' }), { scale: P.res, lut: 1 }); B.ghostFrame = null; }
    // distant lights: pinpricks at their bearing when they're too deep to draw
    if (P && B.mode !== 'title') for (const L of S.distantLights()) {
      if (L.z > zCut + maxView - 2) {
        const fl = 0.8 + 0.2 * Math.sin(B.time * 3 + L.x), zz = zCut + maxView - 1;
        let sx = R.sx(L.x), sy = R.sy(L.y, zz);
        const inside = sx > 4 && sy > 4 && sx < R.W - 4 && sy < R.H - 4;
        if (inside) R.point(L.x, L.y, zz, 2, L.c[0] * fl, L.c[1] * fl, L.c[2] * fl, 3);
        else {
          // off-screen: pin it to the edge on its bearing, so there is always a light to steer by
          const cx = R.W / 2, cy = R.H / 2, dx = sx - cx, dy = sy - cy, k = Math.min((R.W / 2 - 6) / Math.abs(dx || 1e-6), (R.H / 2 - 6) / Math.abs(dy || 1e-6));
          sx = Math.round(cx + dx * k); sy = Math.round(cy + dy * k);
          const b = R.buffers(), i = sy * R.W + sx;
          for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const j = i + oy * R.W + ox; if (j >= 0 && j < b.FR.length) { const k = (ox || oy ? 0.5 : 1) * fl; b.FR[j] += L.c[0] * k; b.FG[j] += L.c[1] * k; b.FB[j] += L.c[2] * k; b.EM[j] = 1; } }
        }
      }
    }
    const ox = R.cam.ox, oy = R.cam.oy;
    if (!topside) snow.draw(dt, ox - lastOx, oy - lastOy);
    else if (B.act === 'deck') rain(dt);
    lastOx = ox; lastOy = oy;
    // the lamp beam made visible by particulate; strong in the scattering layer and in silt
    if (P && env.lamp.on && B.mode !== 'title' && !(sc && sc.cam)) {
      const L = env.lamp, turb = (B.Z.inLayer(P.z) ? 0.26 : 0.11) + (E.inSilt(P.x, P.y, P.z) ? 0.25 : 0) + (eyeZ > 200 && eyeZ < 1000 ? 0.03 : 0);
      // the beam stops where it meets rock
      const range = Math.sqrt(L.r2), hit = B.World.rayRock(B.map, L.x, L.y, L.z, L.dx, L.dy, L.dz, range), frac = hit ? Math.max(0.15, hit.t / range) : 1;
      // scattered light reads blue-white in water
      if (L.mode === 'red') R.beam(R.sx(L.x), R.sy(L.y, L.z), L.dx * B.PX, L.dy * B.PY, range * B.PX * 0.85 * frac, 0.45, turb, 0.5, 0.04, 0.02);
      else R.beam(R.sx(L.x), R.sy(L.y, L.z), L.dx * B.PX, L.dy * B.PY, range * B.PX * 0.85 * frac, 0.32, turb, 0.3, 0.42, 0.5);
    }
    // god rays near the surface
    if (eyeZ < 110 && !topside && B.mode !== 'title') {
      godRays((1 - eyeZ / 110) * 0.03, B.time);
    }
    // palette
    let lut = sc && sc.lut ? sc.lut : B.mode === 'title' ? 'ben2' : B.zoneFor(B.act, eyeZ);
    if (P && B.mode === 'play' && !topside) { if (P.listening) lut = 'listen'; else if (env.lamp.on && P.lampMode === 'red') lut = 'red'; }
    R.spread = B.zoneDither[lut] || 0.1;
    R.mono = lut === 'eye';
    // the Lossless Shard: hold B to look through a piece of your own viewport
    R.lens = null;
    if (P && B.mode === 'play' && !topside && P.relics.shards > 0 && I.down('lens')) {
      let lx = R.sx(P.x) + P.aimX * 70, ly = R.sy(P.y, P.z) + P.aimY * 46;
      if (I.mouse.inside && !I.usingPad) { lx = I.mouse.x; ly = I.mouse.y; }
      R.lens = { x: lx, y: ly, r: 32 };
    }
    B.lensOn = R.lens;
    R.quantize(B.lut(lut), P ? P.fidelity : 16);
    if (R.lens) R.ellipse(R.lens.x, R.lens.y, 33, 33, 0xffeee6c4);
    R.flushWires(); R.flushOverlays();
    if (B.mode === 'play' && P && !topside) Hd.drawSonar();
    if (sc && sc.dimWorld) R.shadeRect(0, 0, R.W, R.H, 0xff000000, 0.5);
  }
  B.renderWorld = renderWorld;
  // Rain coming in sideways across the deck.
  const drops = []; for (let k = 0; k < 140; k++) drops.push({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.6 });
  function rain(dt) {
    const b = R.buffers(), W = R.W, Hh = R.H;
    for (const d of drops) {
      d.x += dt * 0.5 * d.s; d.y += dt * 0.9 * d.s; if (d.x > 1) d.x -= 1; if (d.y > 1) d.y -= 1;
      const x0 = d.x * W, y0 = d.y * Hh;
      for (let t = 0; t < 5; t++) { const x = (x0 + t * 0.55) | 0, y = (y0 + t) | 0; if (x < 0 || y < 0 || x >= W || y >= Hh) continue; const i = y * W + x; b.FR[i] += 0.05; b.FG[i] += 0.055; b.FB[i] += 0.065; }
    }
  }
  // Slanted light shafts near the surface: bands along one diagonal, wobbling slowly. Tabled sine, no per-pixel trig.
  const SIN = new Float32Array(1024); for (let k = 0; k < 1024; k++) SIN[k] = Math.sin(k / 1024 * Math.PI * 2);
  const sn = v => SIN[((v * 162.97) | 0) & 1023];
  function godRays(kk, t) {
    const b = R.buffers(), W = R.W, Hh = R.H;
    const wob = new Float32Array(W); for (let x = 0; x < W; x++) wob[x] = sn(x * 0.011 + t * 0.15) * 2 + x * 0.07 + t * 0.25;
    for (let y = 0; y < Hh; y += 1) {
      const yo = -y * 0.035, mod = kk * (0.6 + 0.4 * sn(y * 0.02 - t * 0.3)) * 5;
      for (let x = (y & 1); x < W; x += 2) {
        const band = sn(wob[x] + yo); if (band <= 0.8) continue;
        const a = (band - 0.8) * mod, i = y * W + x; b.FR[i] += a * 0.4; b.FG[i] += a * 0.85; b.FB[i] += a;
        if (x + 1 < W) { b.FR[i + 1] += a * 0.4; b.FG[i + 1] += a * 0.85; b.FB[i + 1] += a; }
      }
    }
  }

  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    acc += dt;
    I.poll();
    let steps = 0;
    while (acc >= 1 / 60 && steps < 4) { tick(1 / 60); acc -= 1 / 60; steps++; I.endTick(); }
    if (steps === 4) acc = 0;
    draw(dt); autoQuality(dt);
    B.fps = B.fps ? B.fps * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05 : 60;
    requestAnimationFrame(frame);
  }
  function draw(dt) {
    const t0 = performance.now();
    R.post.flash = Math.max(0, R.post.flash - dt * 1.6);
    if (!B.player || B.mode === 'title') R.post.curve = 0.04;
    if (B.mode === 'boot') { Hd.drawBootScreen(); }
    else if (B.mode === 'title') { renderWorld(dt); Hd.drawTitle(); }
    else if (B.mode === 'pause') { Hd.drawPause(pauseSnap, pauseT); }
    else if (B.mode === 'scene') { const sc = B.scene; if (!sc || sc.world) renderWorld(dt); if (sc && sc.world !== false) Hd.draw(); if (sc && sc.draw) sc.draw(); }
    else { renderWorld(dt); Hd.draw(); if (B.mode === 'dead') Hd.drawDead(B.deadT, B.deadCause); }
    Hd.drawFade();
    if (B.debugHUD) Hd.text(2, R.H - 9, Math.round(B.fps) + ' FPS ' + B.renderMs.toFixed(1) + ' MS', 0xff00ff00);
    B.renderMs = B.renderMs * 0.9 + (performance.now() - t0) * 0.1;
    R.present();
  }

  // ------------------------------------------------------------------ boot
  function init() {
    const cv = document.getElementById('game');
    R.initOutput(cv);
    B.W = 0; R.W = 0; B.setRes(480, 270);
    B.bindMouse(cv);
    addEventListener('resize', () => R.resize());
    B.onGesture = function () {
      if (!A.ready) A.init(); A.resume();
      if (B.mode === 'boot') B.toTitle();
    };
    B.onBlur = function () { if (B.mode === 'play' && !B.noAutoPause) pause(); };
    const q = new URLSearchParams(location.search);
    B.debugHUD = q.has('fps') || q.has('debug');
    // warm the commonest palettes in idle slices so the first descent doesn't hitch
    const warm = ['top', 'sun', 'twi', 'deep', 'ben2', 'red', 'listen', 'd94', 'd71', 'dmara'];
    const step = () => { const n = warm.shift(); if (n) { B.lut(n); setTimeout(step, 30); } };
    setTimeout(step, 100);
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init); else init();

  // ------------------------------------------------------------------ debug and test hooks
  B.debug = {
    start(act, z, opts) {
      if (!A.ready) A.init();
      Hd.closeMenu(); B.scene = null; R.env.lamp.on = false; B.player = null;
      S.newState(false); B.mode = 'play';
      const flags = Object.assign({}, opts && opts.flags);
      Object.assign(B.state.flags, flags);
      if (act === 'deck') { S.loadAct('deck'); return; }
      S.loadAct(act, z !== undefined ? Object.assign({}, { act1: { x: 92, y: 80 }, act2: { x: 210, y: 210 }, act3: { x: 62, y: 64 } }[act], { z }) : null);
      if (opts && opts.breached) { const p = B.player; p.breached = true; p.res = act === 'act3' ? 3 : 2; p.flipped = true; p.rating = Math.max(p.rating, act === 'act3' ? 3700 : 1600); B.state.flags.breached = true; B.state.flags.breachStarted = true; }
    },
    warp(x, y, z) { const p = B.player; p.x = x; p.y = y; p.z = z; p.vx = p.vy = p.vz = 0; B.snapCamera = true; },
    give() { const p = B.player; Object.assign(p.inv, { ti: 9, cer: 9, cu: 9, foam: 9, cell: 9, glass: 9, chitin: 9, flare: 9, shell: 3 }); p.carts = 9; p.limes = 9; },
    god(on) { S.godMode = on !== false; },
    tick: (n) => { for (let k = 0; k < (n || 1); k++) { tick(1 / 60); I.endTick(); } },
    draw: () => draw(1 / 60),
  };
})(window.B);
