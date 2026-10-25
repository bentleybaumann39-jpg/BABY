/* player.js — Mara Ekdahl in HV-0419: inertial swimming, trim, the Pick, lamp, sonar, breath, Crush Debt,
 * Fidelity, biomass, interactions and the input recorder the Second Diver replays. */
'use strict';
(function (B) {
  const M = B.M, R = B.R, MD = B.MD, A = B.A, E = B.E, I = B.I;
  const H = (x, y) => B.World.H(B.map, x, y);
  B.SONAR = B.hex32('#e8fff8');
  const STRAIN = {
    siphon: { name: 'SIPHON', col: [0.5, 1.2, 1.5], hex: '#9fe8ff' },
    caul: { name: 'CAUL', col: [0.9, 1.2, 0.5], hex: '#c8e890' },
    bloom: { name: 'BLOOM', col: [0.15, 1.1, 0.8], hex: '#4bd3b0' },
  };
  B.STRAIN = STRAIN;
  const RECN = 7200, REC = new Float32Array(RECN * 7);
  let recIdx = 0;

  const Pm = B.Player = {};
  let P = null;
  Pm.state = () => P;

  Pm.fresh = function () {
    return {
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, aimX: 1, aimY: 0, thrust: 0, trim: 0, boost: false, kick: 0,
      lampMode: 'white', powered: true, braced: false, braceT: 0, clamped: false, rebootT: 0,
      anchor: null, reeling: false, o2: 360, o2Max: 360, carts: 2, lime: 1, limes: 1, paco2: 40, hr: 70, air: 100, suffoT: 0,
      crush: 0, rating: 1100, fidelity: 16, res: 1, flipped: false, breached: false, cells: [], cap: 3, sel: 0, overT: 0, singT: 0, lungT: 0,
      ring: 0, trail: [], pingCD: 0, pingHold: -1, lampHold: -1, reveal: new Map(), pts: [], pings: [], lastNode: null, nodeT: 0,
      inv: { ti: 0, cer: 0, foam: 0, cu: 0, cell: 0, glass: 0, chitin: 0, flare: 1, shell: 1 },
      relics: { lung: false, hand: false, eye: false, wren: false, shards: 0 }, up: { hull: 0, scrub: 0, thr: 0, sonar: 0, tank: 0 },
      caul: 0, tangled: null, grip: 0, grabbed: null, listening: false, breathHold: false, gaugeT: 0, dead: false, cause: '',
      walking: false, inCage: null, interactT: 0, prompt: null, holdTarget: null, knocks: 0, chroma: 0, copepods: 0, growth: 0, lockT: 0,
      stealth: 1, ghostTankShift: false, deck: false, lastFid: 16,
    };
  };
  Pm.spawn = function (x, y, z, o) {
    P = B.player = Object.assign(Pm.fresh(), o || {});
    P.x = x; P.y = y; P.z = z;
    R.setFidelity(P.fidelity);
    return P;
  };

  // ------------------------------------------------------------------ queries used by creatures
  Pm.powered = () => P && P.powered && !P.braced && !P.dead;
  Pm.weakness = function () {
    if (!P) return 0;
    const br = P.o2 / P.o2Max;
    let w = Math.max(br < 0.25 && P.carts === 0 ? (0.25 - br) / 0.25 : 0, P.crush / 100 * 0.9, (16 - P.fidelity) / 13 * 0.4);
    if (P.tangled || P.braced) w = Math.max(w, 0.9);
    if (P.suffoT > 0) w = 1;
    return w;
  };
  Pm.revealed = function (e) { if (!P) return false; const r = P.reveal.get(e.id); return !!r && B.time >= r[0] && B.time <= r[1]; };
  Pm.recFrame = function (i) { if (i < 0 || i >= recIdx || recIdx - i > RECN) return null; const o = (i % RECN) * 7; return REC.subarray(o, o + 7); };
  Pm.recIndex = () => recIdx;
  Pm.say = (who, txt, o) => B.Story.say(who, txt, o);

  // ------------------------------------------------------------------ damage and loss
  Pm.hurt = function (src, debt) {
    if (P.dead) return;
    P.crush = Math.min(100, P.crush + debt * B.diff().hurt); A.sfx('impact'); B.shake(6);
    if (P.crush >= 100) Pm.die(src);
  };
  Pm.bite = function (s) {
    B.shake(14); A.sfx('crack'); A.sfx('boom');
    if (P.crush > 50 + (1 - B.diff().hurt) * 40) { Pm.die('sleeper'); return; }
    P.crush = Math.min(100, P.crush + 45 * B.diff().hurt);
    if (P.cells.length) { P.cells = []; Pm.say('hud', 'CULTURE TANK RUPTURED'); }
    const a = Math.atan2(P.y - s.y, P.x - s.x); P.vx += Math.cos(a) * 7; P.vy += Math.sin(a) * 7;
    if (P.crush >= 100) Pm.die('sleeper');
  };
  Pm.caulPop = function () { if (P.caul > 0) { P.caul = 0; A.sfx('caul'); return true; } return false; };
  Pm.tangle = function (proc) {
    if (P.tangled || P.dead || P.caul > 0) { if (P.caul > 0) { Pm.caulPop(); } return; }
    P.tangled = proc; P.grip = 1; P.vx = P.vy = P.vz = 0; A.sfx('glass'); A.sfx('knock');
    Pm.say('hud', 'ENTANGLED · STRUGGLE (MOVE)');
    proc.feed(P);
  };
  Pm.stripped = function (n, dt) {
    if (P.dead) return;
    P.stripAcc = (P.stripAcc || 0) + dt * n / 300;
    if (P.cells.length && P.stripAcc > 4) { P.cells.pop(); P.stripAcc = 0; Pm.say('hud', 'BIOMASS STRIPPED'); for (const g of E.byType('grain')) g.took++; }
    else if (!P.cells.length) {
      P.crush = Math.min(100, P.crush + dt * n / 100);
      P.stripFid = (P.stripFid || 0) + dt;
      if (P.stripFid > 30) { P.stripFid = 0; Pm.loseFidelity(1, 'grain'); }
      if (P.crush >= 100) Pm.die('grain');
    }
  };
  Pm.grabbed = function (d) { P.grabbed = d; Pm.say('mara', 'GET OFF ME—'); };
  Pm.loseFidelity = function (n, why) {
    const before = P.fidelity;
    P.fidelity = Math.max(3, P.fidelity - n);
    if (P.fidelity !== before) { R.setFidelity(P.fidelity); P.chroma = 0.14; A.sfx('static', { delay: 0 }, 0.2); if (P.breached && !P.fidLoggedOnce) { P.fidLoggedOnce = true; } }
    void why;
  };
  Pm.die = function (cause) {
    if (P.dead || B.Story.godMode) return;
    P.dead = true; P.cause = cause; P.vx = P.vy = P.vz = 0;
    B.Story.onDeath(cause);
  };

  // ------------------------------------------------------------------ interactions
  Pm.take = function (it) {
    const k = it.kind;
    if (B.state && it.sid) B.state.taken[it.sid] = true;
    it.alive = false;
    if (k === 'log') { A.sfx('pickup'); B.Hud.openDoc(it.doc); B.Story.onRead && B.Story.onRead(it.doc); return; }
    if (k === 'tape') { B.Story.playTape(it.tape); return; }
    if (k === 'o2') P.carts += it.n; else if (k === 'lime') P.limes += it.n; else if (k === 'air') P.air = Math.min(100, P.air + 50);
    else if (k === 'lung') { P.relics.lung = true; P.o2Max = 432; }
    else if (k === 'hand') P.relics.hand = true;
    else if (k === 'eye') P.relics.eye = true;
    else if (k === 'wren') P.relics.wren = true;
    else if (k === 'shard') P.relics.shards++;
    else P.inv[k] = (P.inv[k] || 0) + it.n;
    A.sfx('pickup');
    B.Hud.toast('+' + (it.n > 1 ? it.n + ' ' : '') + (it.title || B.ITEM_NAME[k]));
    B.Story.onTake && B.Story.onTake(it);
  };
  Pm.atCairn = function (c) {
    A.sfx('beep');
    B.Story.checkpoint(c);
    P.air = 100;
    B.Hud.openCraft(c);
  };
  Pm.rideCage = function (c) {
    if (c.moving || c.fallen) return;
    const next = c.stop + 1; if (next >= c.stops.length) return;
    P.inCage = c; E.cageGo(c, next); A.sfx('beep');
    // the downline carries an air hose: the ballast bottle tops up for the ride
    if (P.air < 100) { P.air = 100; B.Hud.toast('BALLAST AIR TOPPED UP FROM THE DOWNLINE'); }
    B.Story.onCageRide && B.Story.onCageRide(c, next);
  };
  Pm.absorb = function (src, strain) {
    if (P.cells.length >= P.cap) { Pm.say('hud', 'CULTURE TANK FULL'); A.sfx('deny'); return false; }
    P.cells.push(strain); A.sfx('absorb'); B.noise(P.x, P.y, P.z, 45, 'absorb');
    B.Hud.toast('ABSORBED: ' + STRAIN[strain].name);
    B.Story.onAbsorb && B.Story.onAbsorb(strain);
    return true;
  };
  function useCell(i) {
    if (!P.cells.length || P.dead || P.braced) { A.sfx('deny'); return; }
    i = M.clamp(i, 0, P.cells.length - 1);
    const s = P.cells.splice(i, 1)[0];
    if (s === 'siphon') {
      P.vx += P.aimX * 9; P.vy += P.aimY * 9; A.sfx('siphon'); B.noise(P.x, P.y, P.z, 25, 'jet');
      if (P.tangled) { P.tangled = null; Pm.say('hud', 'TORN FREE'); }
      if (P.grabbed) { P.grabbed.mode = 'away'; P.grabbed.cool = 10; P.grabbed = null; }
      for (const sq of E.byType('squid')) if (Math.hypot(sq.x - P.x, sq.y - P.y, sq.z - P.z) < 3) sq.stunned = 14;
    } else if (s === 'caul') {
      P.caul = 8; P.ring = 0; for (const n of P.trail) n.muffled = true; A.sfx('caul');
      if (P.tangled) { P.tangled = null; }
      if (P.grabbed) { P.grabbed.mode = 'away'; P.grabbed.cool = 12; P.grabbed = null; }
    } else if (s === 'bloom') {
      E.bloomCloud(P.x + P.aimX * 1.5, P.y + P.aimY * 1.5, P.z);
    }
  }
  function graft() {
    if (!P.cells.length) { A.sfx('deny'); Pm.say('hud', 'NO BIOMASS TO GRAFT'); return; }
    P.cells.pop(); P.crush = Math.max(0, P.crush - 40); P.growth = Math.min(1, P.growth + 0.15);
    Pm.loseFidelity(1, 'graft'); A.sfx('graft'); B.Hud.toast('GRAFT: HULL SEALED WITH LIVING TISSUE');
    B.Story.onGraft && B.Story.onGraft();
  }
  function powerhead() {
    if (P.inv.shell <= 0) { A.sfx('deny'); Pm.say('hud', 'NO POWERHEAD SHELLS'); return; }
    let best = null, bd = 3.2;
    for (const e of E.list) {
      if (!e.alive || !['reliquary', 'sleeper', 'squid', 'double', 'grain'].includes(e.type)) continue;
      const d = Math.hypot(e.x - P.x, e.y - P.y, e.z - P.z);
      const along = ((e.x - P.x) * P.aimX + (e.y - P.y) * P.aimY) / Math.max(0.1, Math.hypot(e.x - P.x, e.y - P.y));
      if (d < bd && (along > 0.2 || d < 1.8)) { bd = d; best = e; }
    }
    if (!best) { A.sfx('deny'); Pm.say('hud', 'NOTHING IN REACH'); return; }
    P.inv.shell--; A.sfx('boom'); B.shake(18); R.post.flash = 0.5; B.noise(P.x, P.y, P.z, 130, 'boom');
    if (best.type === 'reliquary') best.hit();
    else if (best.type === 'sleeper') { best.mode = 'flee'; best.fleeT = 30; }
    else if (best.type === 'squid') { best.dead = true; }
    else if (best.type === 'double') best.stun();
    else if (best.type === 'grain') best.killSome(0.5);
  }
  function throwFlare() {
    if (P.inv.flare <= 0) { A.sfx('deny'); Pm.say('hud', 'NO FLARES'); return; }
    P.inv.flare--; E.flareFx(P.x + P.aimX * 2, P.y + P.aimY * 2, P.z + 0.5); A.sfx('hiss'); B.noise(P.x, P.y, P.z, 30, 'flare');
  }

  // ------------------------------------------------------------------ sonar
  function ping(narrow) {
    if (!P.powered || P.braced || P.pingCD > 0 || P.dead) { A.sfx('deny'); return; }
    P.pingCD = 1.2;
    const silt = E.inSilt(P.x, P.y, P.z), lvl = P.up.sonar;
    const range = (narrow ? 55 + lvl * 8 : 30 + lvl * 5) * (silt ? 0.3 : 1), hold = narrow ? 2 : 3;
    const cosC = 0.866;
    P.ring = Math.max(P.ring, (narrow ? 6 : 10) - lvl * 1.2);
    B.noise(P.x, P.y, P.z, narrow ? 110 : 120, 'ping');
    A.sfx(narrow ? 'narrow' : 'ping');
    (B.signals = B.signals || []).push(B.time); if (B.signals.length > 12) B.signals.shift();
    P.pings.push({ t0: B.time, x: P.x, y: P.y, z: P.z, r: range, narrow, ax: P.aimX, ay: P.aimY });
    P.pingFlag = 1;
    const inCone = (x, y) => { if (!narrow) return true; const dx = x - P.x, dy = y - P.y, d = Math.hypot(dx, dy) || 1; return (dx * P.aimX + dy * P.aimY) / d > cosC; };
    for (const e of E.list) {
      if (!e.alive || !['reliquary', 'sleeper', 'squid', 'procession', 'double', 'cage', 'prop', 'carcass', 'item', 'cairn', 'corpse', 'whale', 'vent'].includes(e.type)) continue;
      let ex = e.x, ey = e.y, ez = e.z;
      if (e.type === 'procession') { ez = M.clamp(P.z, e.zTop, e.zTop + e.len * e.cf); ex = e.px[0]; ey = e.py[0]; }
      const d = Math.hypot(ex - P.x, ey - P.y, (ez - P.z) * 0.7);
      if (d > range + (e.r || 0) || !inCone(ex, ey)) continue;
      const t0 = B.time + d / 50;
      P.reveal.set(e.id, [t0, t0 + hold]);
    }
    // terrain point cloud
    const pts = [], layer = B.Z.inLayer(P.z), step = narrow ? 1.6 : 1.2;
    const fake = layer ? B.Z.layerTop() + 34 : 0;
    for (let gy = -range; gy <= range; gy += step) for (let gx = -range; gx <= range; gx += step) {
      const dd = Math.hypot(gx, gy); if (dd > range) continue;
      const x = P.x + gx + (Math.random() - 0.5) * 0.6, y = P.y + gy + (Math.random() - 0.5) * 0.6;
      if (!inCone(x, y)) continue;
      const f = H(x, y), t0 = B.time + dd / 50;
      if (layer && f > fake && Math.random() < 0.7) { pts.push([x, y, fake + Math.random() * 0.4, t0, 0.7]); continue; }
      if (f < P.z - 2) {
        // wall at our depth: only where it meets open water
        if (H(x + step, y) > P.z || H(x - step, y) > P.z || H(x, y + step) > P.z || H(x, y - step) > P.z) for (let dz = -3; dz <= 6; dz += 3) pts.push([x, y, P.z + dz, t0, 0.9]);
      } else if (f < P.z + 64) {
        const n = B.World.normal(B.map, x, y); const face = M.clamp(-n.z * 0.6 + 0.5, 0.3, 1);
        pts.push([x, y, f, t0, face]);
      }
    }
    if (layer && Math.random() < 1) Pm.say('hud', 'SONAR: FLOOR AT ' + Math.round(fake) + ' M?', { quiet: true });
    P.pts = pts.concat(P.pts.filter(p => B.time < p[3] + hold)).slice(0, 4000);
    P.ptsHold = hold;
    B.Story.onPing && B.Story.onPing(narrow);
  }

  // ------------------------------------------------------------------ the main update
  Pm.update = function (dt) {
    if (!P) return;
    const st = B.state;
    P.pingFlag = 0;
    if (P.dead) { recordFrame(); return; }
    if (B.act === 'deck') { walk(dt); recordFrame(); return; }
    const lock = P.lockT > 0 || B.Story.locked || B.Hud.capture(); if (P.lockT > 0) P.lockT -= dt;
    // ----- input
    const mv = lock ? { x: 0, y: 0 } : I.move();
    const mag = Math.hypot(mv.x, mv.y);
    // aim: mouse relative to the diver on screen, or the right stick
    if (I.usingPad && Math.hypot(I.aimPad.x, I.aimPad.y) > 0.3) { const l = Math.hypot(I.aimPad.x, I.aimPad.y); P.aimX = I.aimPad.x / l; P.aimY = I.aimPad.y / l; }
    else if (I.mouse.inside) {
      const psx = R.sx(P.x), psy = R.sy(P.y, P.z) - 8;
      const dx = (I.mouse.x - psx) / B.PX, dy = (I.mouse.y - psy) / B.PY;
      const l = Math.hypot(dx, dy); if (l > 0.2) { P.aimX = dx / l; P.aimY = dy / l; }
    } else if (mag > 0.2) { P.aimX = mv.x / mag; P.aimY = mv.y / mag; }
    P.listening = !lock && I.down('listen') && P.powered && !P.braced;
    P.breathHold = !lock && I.down('breath');
    P.boost = !lock && I.down('boost') && mag > 0.1;
    const canThrust = P.powered && !P.braced && !P.listening && !P.tangled && !P.inCage && !P.grabbed && !lock;
    if (P.clamped && mag > 0.3) { P.clamped = false; }
    const target = canThrust && !P.clamped ? mag : 0;
    P.thrust = M.approach(P.thrust, target, dt * (target > P.thrust ? 1 / 0.3 : 1 / 0.6));
    P.kick = P.thrust;
    // ----- physics
    const stiff = P.crush / 100 * 0.35;
    if (mag > 0.1 && canThrust) {
      const want = Math.atan2(mv.y, mv.x), d = M.wrap(want - P.yaw);
      P.yaw += M.clamp(d, -3 * (1 - stiff) * dt, 3 * (1 - stiff) * dt);
    } else if (!P.inCage) {
      const want = Math.atan2(P.aimY, P.aimX), d = M.wrap(want - P.yaw); P.yaw += M.clamp(d, -1.5 * dt, 1.5 * dt);
    }
    const thrLvl = P.up.thr, F = P.thrust * (P.boost ? 4.7 : 1.09) * (1 - thrLvl * 0.08);
    if (mag > 0.01) { P.vx += mv.x / Math.max(mag, 0.01) * F * dt; P.vy += mv.y / Math.max(mag, 0.01) * F * dt; }
    // anisotropic quadratic drag: sideways is 2.4x harder than forward
    const fx = Math.cos(P.yaw), fy = Math.sin(P.yaw);
    const vf = P.vx * fx + P.vy * fy, vl = -P.vx * fy + P.vy * fx;
    const dragF = 0.12 * vf + 0.35 * vf * Math.abs(vf), dragL = (0.12 * vl + 0.35 * vl * Math.abs(vl)) * 2.4;
    const nvf = vf - dragF * dt, nvl = vl - dragL * dt;
    P.vx = nvf * fx - nvl * fy; P.vy = nvf * fy + nvl * fx;
    // trim: flooding is silent and cheap; blowing hisses and spends air. The Trench makes it easy to go down.
    const sink = !lock && I.down('sink') && P.powered, rise = !lock && I.down('rise') && P.powered && P.air > 0;
    if (sink) P.trim = Math.max(-1, P.trim - dt * 0.8);
    if (rise) {
      P.trim = Math.min(1, P.trim + dt * 0.8); P.air = Math.max(0, P.air - dt * 2.2);
      if ((P.hissT = (P.hissT || 0) - dt) <= 0) { P.hissT = 0.6; A.sfx('hiss'); B.noise(P.x, P.y, P.z, 50, 'ballast'); }
    }
    if (B.settings.steady && !sink && !rise) P.trim = M.approach(P.trim, M.clamp(P.vz * 0.6, -1, 1), dt * 0.6);
    let az = P.trim < 0 ? -P.trim * 2.0 : -P.trim * 0.9;
    if (B.Story.upIsDown && P.trim > 0) az = P.trim * 2.4; // after Magpie: dropping weight makes you sink
    az -= 0.05 * P.vz + 0.0988 * P.vz * Math.abs(P.vz);
    P.vz += az * dt;
    // world forces
    B.Z.forces(P, dt);
    // the Pick
    if (P.anchor) {
      const a = P.anchor, dx = a.x - P.x, dy = a.y - P.y, dz = a.z - P.z, d = Math.hypot(dx, dy, dz) || 1;
      P.reeling = !lock && I.down('pick') && P.powered;
      if (P.reeling) { const sp = P.breached ? 4.5 : 2.6; a.len = Math.max(1.2, a.len - sp * dt); P.vx += dx / d * 3 * dt; P.vy += dy / d * 3 * dt; P.vz += dz / d * 3 * dt; }
      if (d > a.len) { const k = (d - a.len) / d; P.x += dx * k; P.y += dy * k; P.z += dz * k; const vd = (P.vx * dx + P.vy * dy + P.vz * dz) / d; if (vd < 0) { P.vx -= dx / d * vd; P.vy -= dy / d * vd; P.vz -= dz / d * vd; } }
      if (a.ent && !a.ent.alive) P.anchor = null;
    } else P.reeling = false;
    // clamp / cage / tangle / grab override motion
    if (P.inCage) {
      const c = P.inCage; P.x = c.x; P.y = c.y; P.z = c.z + 0.1; P.vx = P.vy = P.vz = 0;
      if (!c.moving) { P.inCage = null; }
    } else if (P.clamped || P.braced) { P.vx *= 0.8; P.vy *= 0.8; P.vz *= 0.8; }
    if (P.tangled) {
      P.vx = P.vy = 0; P.vz = -0.3;
      if (mag > 0.5 && (P.strT = (P.strT || 0) - dt) <= 0) { P.strT = 0.35; P.grip -= 0.08; B.noise(P.x, P.y, P.z, 40, 'struggle'); A.sfx('glass'); }
      P.crush = Math.min(100, P.crush + 2 * dt); P.tangleT = (P.tangleT || 0) + dt;
      if (P.grip <= 0 || !P.tangled.alive) { P.tangled = null; P.tangleT = 0; Pm.say('hud', 'FREE'); P.vx = -P.aimX * 2; P.vy = -P.aimY * 2; }
      else if (P.tangleT > 25 || P.crush >= 100) { P.tangled = null; P.tangleT = 0; Pm.die('procession'); return; }
    }
    if (P.grabbed) { P.vx = P.vy = P.vz = 0; if (mag > 0.5) P.grabbed.shake(); if (!P.grabbed.alive || P.grabbed.mode !== 'hold') P.grabbed = null; }
    // integrate
    const ox = P.x, oy = P.y, oz = P.z;
    if (!P.inCage) { P.x += P.vx * dt; P.y += P.vy * dt; P.z += P.vz * dt; }
    collide(ox, oy, oz);
    // ----- systems
    lamp(dt);
    breathe(dt);
    pressure(dt);
    biomass(dt);
    sonarTick(dt);
    // ----- actions
    if (!lock) actions(dt);
    interactScan(dt, lock);
    recordFrame();
  };

  function collide(ox, oy, oz) {
    const m = B.map;
    P.x = M.clamp(P.x, 2, m.size - 2); P.y = M.clamp(P.y, 2, m.size - 2);
    if (P.z < 1.2 && !B.Story.surfacing) { P.z = 1.2; if (P.vz < 0) P.vz = 0; }
    if (B.Story.noclip) return; // the ledge giving way under her
    let impact = 0;
    // walls: ring samples around the body at hip and chest height
    for (let a = 0; a < 8; a++) {
      const cx = Math.cos(a * 0.785), cy = Math.sin(a * 0.785);
      const hz = Math.min(H(P.x + cx * 0.75, P.y + cy * 0.75), H(P.x + cx * 0.6, P.y + cy * 0.6));
      if (hz < P.z + 0.5) {
        const pen = 0.75 - 0.0; P.x -= cx * 0.08; P.y -= cy * 0.08;
        const vd = P.vx * cx + P.vy * cy; if (vd > 0) { impact = Math.max(impact, vd); P.vx -= cx * vd * 1.15; P.vy -= cy * vd * 1.15; }
        void pen;
      }
    }
    const f = H(P.x, P.y);
    if (f < P.z + 1.15) {
      if (f > P.z - 1.5) { if (P.vz > 0) { impact = Math.max(impact, P.vz); P.vz = -P.vz * 0.15; } P.z = f - 1.15; }
      else { P.x = ox; P.y = oy; P.z = Math.min(P.z, oz); P.vx *= -0.2; P.vy *= -0.2; }
    }
    // solid props
    for (const e of E.list) {
      if (!e.alive || !e.solid) continue;
      const dx = P.x - e.x, dy = P.y - e.y, dz = (P.z - e.z) * (e.flatZ || 1), d = Math.hypot(dx, dy, dz), rr = e.r + 0.8;
      if (d < rr && d > 0.001) { const k = (rr - d) / d; P.x += dx * k; P.y += dy * k; P.z += dz * k / (e.flatZ || 1); const vd = -(P.vx * dx + P.vy * dy + P.vz * dz) / d; if (vd > 0) { impact = Math.max(impact, vd); P.vx += dx / d * vd; P.vy += dy / d * vd; P.vz += dz / d * vd; } }
    }
    if (impact > 2.5) {
      P.crush = Math.min(100, P.crush + (impact - 2.5) * 9); A.sfx('impact'); B.shake(8); B.noise(P.x, P.y, P.z, 70, 'impact');
      E.silt(P.x, P.y, f - 0.5, 1); if (P.crush >= 100) Pm.die('impact');
    } else if (impact > 1.2 && f - P.z < 2) { E.silt(P.x, P.y, f - 0.4, 0.4); }
    // kicking near a silty floor stirs a little plume
    if (P.thrust > 0.6 && f - P.z < 1.8 && Math.random() < 0.02) E.silt(P.x, P.y, f - 0.4, 0.3);
  }

  function walk(dt) {
    const lock = B.Story.locked || B.Hud.capture(), mv = lock ? { x: 0, y: 0 } : I.move();
    const sp = 2.2, nx = P.x + mv.x * sp * dt, ny = P.y + mv.y * sp * dt;
    const ok = (x, y) => { const h = H(x, y); return h > -3.4 && h < -2.6; };
    if (ok(nx, P.y)) P.x = nx; if (ok(P.x, ny)) P.y = ny;
    for (const e of E.list) if (e.alive && e.solid) { const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy), rr = e.r + 0.35; if (d < rr && d > 0.01) { P.x += dx / d * (rr - d); P.y += dy / d * (rr - d); } }
    if (Math.hypot(mv.x, mv.y) > 0.1) P.yaw = Math.atan2(mv.y, mv.x);
    P.walk = Math.hypot(mv.x, mv.y); P.z = -3.9;
    R.env.lamp.on = false;
    interactScan(dt, lock);
  }

  function lamp(dt) {
    const L = R.env.lamp;
    L.on = P.powered && !P.braced && P.lampMode !== 'off' && P.rebootT <= 0;
    // the lamp drops toward the floor when there is one close below, and levels out in open water so
    // things at your own depth can be found
    const alt = H(P.x + P.aimX * 6, P.y + P.aimY * 6) - P.z, want = alt < 6 ? 0.72 : alt > 30 ? 0.3 : 0.72 - (alt - 6) / 24 * 0.42;
    P.lampTilt = P.lampTilt === undefined ? want : M.approach(P.lampTilt, want, dt * 0.6);
    const tilt = P.lampTilt, ct = Math.cos(tilt);
    L.x = P.x + Math.cos(P.yaw) * 0.25; L.y = P.y + Math.sin(P.yaw) * 0.25; L.z = P.z - 0.95;
    L.dx = P.aimX * ct; L.dy = P.aimY * ct; L.dz = Math.sin(tilt);
    let k = 3.4;
    if (P.caul > 0) k *= 0.4;
    if (E.inSilt(P.x, P.y, P.z)) k *= 0.3;
    if (B.Z.flicker > 0) k *= Math.random() < 0.5 ? 0 : 1;
    L.mode = P.lampMode;
    if (P.lampMode === 'red') { L.cosO = Math.cos(0.66); L.cosI = Math.cos(0.46); L.r2 = 49; L.i = 2.6 * (k / 3.4); L.cr = 1; L.cg = 0.08; L.cb = 0.04; }
    else { L.cosO = Math.cos(0.5); L.cosI = Math.cos(0.3); L.r2 = 400; L.i = k; L.cr = 1; L.cg = 0.93; L.cb = 0.8; }
  }

  function breathe(dt) {
    const panic = B.danger > 0;
    let mult = (P.boost ? 2 : P.thrust > 0.2 ? 1.3 : 1) * (panic ? 1.4 : 1) * (P.breathHold ? 0.6 : 1);
    P.o2 -= dt * mult * B.diff().air;
    if (P.relics.lung) { P.lungT += dt; if (P.lungT > 60) { P.lungT = 0; P.o2 = Math.min(P.o2Max, P.o2 + 5.6); } if ((P.gaspT = (P.gaspT === undefined ? 120 : P.gaspT) - dt) <= 0) { P.gaspT = M.rnd(90, 180); A.sfx('gasp'); B.noise(P.x, P.y, P.z, 34, 'gasp'); } }
    if (P.o2 <= 0) {
      if (P.carts > 0) { P.carts--; P.o2 = P.o2Max; A.sfx('swap'); Pm.say('hud', 'O2 CARTRIDGE CHANGED · ' + P.carts + ' LEFT'); }
      else if (P.breached) { P.o2 = 0; P.suffoT += dt; if (P.suffoT > 45) { P.suffoT = 0; Pm.loseFidelity(1, 'air'); } }
      else { P.o2 = 0; P.suffoT += dt; if (P.suffoT > 20) { Pm.die('air'); return; } }
    } else if (!P.breached) P.suffoT = 0;
    // scrubber and CO2
    P.lime = Math.max(0, P.lime - dt / (330 * (1 + P.up.scrub * 0.2)) * mult);
    // on the gentlest setting the suit changes its own canister while there is a spare
    if (B.settings.difficulty === 0 && P.lime < 0.05 && P.limes > 0) Pm.swapLime();
    const eff = P.lime > 0.25 ? 1 : P.lime / 0.25;
    if (eff < 1) P.paco2 += (1 - eff) * 0.45 * mult * dt / (1 + P.up.scrub * 0.25);
    else P.paco2 = Math.max(40, P.paco2 - dt * 0.7);
    if (!P.breached && P.paco2 > 90) { Pm.die('co2'); return; }
    P.paco2 = Math.min(P.paco2, 95);
    const tgt = 66 + P.thrust * 10 + (P.boost ? 25 : 0) + (panic ? 35 : 0) + Math.max(0, P.paco2 - 40) * 0.8 + (P.breathHold ? 12 : 0);
    P.hr = M.approach(P.hr, tgt, dt * 6);
    if (B.I.pressed('swap')) Pm.swapLime();
  }
  Pm.swapLime = function () { if (P.limes > 0) { P.limes--; P.lime = 1; A.sfx('swap'); B.Hud.toast('SCRUBBER CANISTER SWAPPED'); } else { A.sfx('deny'); Pm.say('hud', 'NO SPARE CANISTERS'); } };

  function pressure(dt) {
    const before = P.crush;
    if (P.braced) P.crush = Math.max(0, P.crush - 0.5 * dt);
    else if (P.z > P.rating) P.crush = Math.min(100, P.crush + Math.pow((P.z - P.rating) / 100, 1.5) * 0.4 * dt * (B.Z.crushMul || 1) * B.diff().crush);
    else P.crush = Math.max(0, P.crush - 2 * dt);
    for (const th of [25, 50, 75]) if (before < th && P.crush >= th) { A.sfx('knock3'); B.shake(4); B.Story.onKnock && B.Story.onKnock(th); }
    if (P.crush >= 100) { Pm.die('crush'); return; }
    R.post.curve = 0.04 - P.crush / 100 * 0.1;
    P.chroma = Math.max(0, P.chroma - dt); R.post.chroma = P.chroma > 0 ? 2 : 0;
  }

  function biomass(dt) {
    P.cap = 3 + P.up.tank;
    if (P.caul > 0) P.caul -= dt;
    const over = P.cells.length >= Math.ceil(P.cap * 2 / 3) && P.cells.length > 1;
    P.overT = over ? P.overT + dt : 0;
    if (P.overT > 90) {
      if ((P.singT -= dt) <= 0) { P.singT = 4; A.sfx('sing'); B.noise(P.x, P.y, P.z, 30, 'sing'); }
      if ((P.overFid = (P.overFid || 0) + dt) > 60) { P.overFid = 0; Pm.loseFidelity(1, 'overfill'); P.growth = Math.min(1, P.growth + 0.1); }
    }
  }

  function sonarTick(dt) {
    P.pingCD -= dt;
    if (P.ring > 0) {
      P.ring -= dt * (P.clamped ? 5 : 1);
      P.nodeT -= dt;
      if (P.nodeT <= 0) {
        P.nodeT = 0.25;
        const ln = P.lastNode;
        if (!ln || Math.hypot(ln.x - P.x, ln.y - P.y, ln.z - P.z) > 0.3) { const n = { x: P.x, y: P.y, z: P.z, t: B.time, muffled: E.inSilt(P.x, P.y, P.z) }; P.trail.push(n); P.lastNode = n; }
      }
    }
    P.trail = P.trail.filter(n => B.time - n.t < 12);
    P.pings = P.pings.filter(p => B.time - p.t0 < 1.2);
    if (B.frame % 30 === 0) for (const [k, v] of P.reveal) if (B.time > v[1]) P.reveal.delete(k);
  }

  function actions(dt) {
    // lamp: tap cycles white -> red -> off; hold throws a flare
    if (I.pressed('lamp')) P.lampHold = 0;
    if (P.lampHold >= 0) {
      P.lampHold += dt;
      if (P.lampHold > 0.55) { P.lampHold = -1; throwFlare(); }
      else if (I.released('lamp')) { P.lampHold = -1; P.lampMode = P.lampMode === 'white' ? 'red' : P.lampMode === 'red' ? 'off' : 'white'; A.sfx('click'); (B.signals = B.signals || []).push(B.time); }
    }
    // ping: tap = wide, hold-release = narrow cone toward the aim
    if (I.pressed('ping')) P.pingHold = 0;
    if (P.pingHold >= 0) { P.pingHold += dt; if (I.released('ping') || !I.down('ping')) { ping(P.pingHold > 0.25); P.pingHold = -1; } }
    // the Pick
    if (I.pressed('pick')) {
      if (P.anchor) { P.anchor = null; A.sfx('click'); }
      else if (P.powered && !P.braced) {
        const range = P.breached ? 18 : 12;
        let hit = B.World.rayRock(B.map, P.x, P.y, P.z - 0.3, P.aimX * 0.94, P.aimY * 0.94, 0.34, range);
        let ent = null;
        for (const e of E.list) {
          if (!e.alive || !e.anchor) continue;
          let ex = e.x, ey = e.y, ez = e.z;
          if (e.type === 'procession') { ex = e.px[0]; ey = e.py[0]; ez = M.clamp(P.z, e.zTop, e.zTop + e.len * e.cf); }
          const dx = ex - P.x, dy = ey - P.y, dz = ez - P.z, d = Math.hypot(dx, dy, dz);
          if (d > range + (e.r || 1)) continue;
          const along = (dx * P.aimX + dy * P.aimY) / Math.max(0.1, Math.hypot(dx, dy));
          if (along > 0.85 && (!hit || d < hit.t)) { hit = { x: ex, y: ey, z: ez, t: d }; ent = e; }
        }
        A.sfx('pickFire');
        if (hit) { P.anchor = { x: hit.x, y: hit.y, z: hit.z, len: Math.hypot(hit.x - P.x, hit.y - P.y, hit.z - P.z), ent }; A.sfx('pickHit', { delay: 0.12 }); }
        else { P.pickMiss = { t: B.time, x: P.x + P.aimX * range, y: P.y + P.aimY * range }; }
      }
    }
    // clamp (tap) / brace (hold)
    if (I.pressed('clamp')) P.clampHold = 0;
    if (P.clampHold >= 0) {
      P.clampHold += dt;
      const near = B.World.nearRock(B.map, P.x, P.y, P.z + 0.5, 1.7) || (P.anchor && Math.hypot(P.anchor.x - P.x, P.anchor.y - P.y, P.anchor.z - P.z) < 2.6);
      if (P.braced && I.released('clamp')) { P.braced = false; P.powered = true; P.rebootT = 2; P.clampHold = -1; A.sfx('boot'); B.Hud.toast('POWER RESTORED'); }
      else if (P.clampHold > 0.6 && !P.braced) {
        P.clampHold = -1;
        if (near) { P.braced = true; P.clamped = true; P.powered = false; A.sfx('clamp'); B.Hud.toast('BRACED · POWER DOWN'); B.Story.onBrace && B.Story.onBrace(); }
        else { A.sfx('deny'); Pm.say('hud', 'NOTHING TO BRACE AGAINST'); }
      } else if (I.released('clamp') && P.clampHold >= 0) {
        P.clampHold = -1;
        if (P.clamped) { P.clamped = false; A.sfx('click'); }
        else if (near) { P.clamped = true; P.vx = P.vy = P.vz = 0; A.sfx('clamp'); B.noise(P.x, P.y, P.z, 48, 'clamp'); }
        else { A.sfx('deny'); Pm.say('hud', 'NOTHING TO CLAMP TO'); }
      }
    }
    if (P.rebootT > 0) { P.rebootT -= dt; P.powered = P.rebootT <= 0; }
    // biomass cells
    for (let k = 0; k < 5; k++) if (I.pressed('c' + (k + 1))) useCell(k);
    if (I.pressed('cPrev')) P.sel = Math.max(0, P.sel - 1);
    if (I.pressed('cNext')) P.sel = Math.min(Math.max(0, P.cells.length - 1), P.sel + 1);
    if (I.pressed('useCell')) useCell(P.sel);
    if (I.pressed('graft')) graft();
    if (I.pressed('powerhead')) powerhead();
    if (I.pressed('craft')) { const c = E.list.find(e => e.alive && e.type === 'cairn' && Math.hypot(e.x - P.x, e.y - P.y, e.z - P.z) < 4); if (c) Pm.atCairn(c); else { A.sfx('deny'); Pm.say('hud', 'FABRICATOR NEEDS A CAIRN'); } }
    if (I.pressed('map')) { if (P.relics.hand) B.Hud.toggleMap(); else { A.sfx('deny'); Pm.say('hud', 'NO CHART'); } }
    if (I.down('gauge')) P.gaugeT = Math.max(P.gaugeT, 1.5); else P.gaugeT = Math.max(0, P.gaugeT - dt);
    if (I.down('wipe')) P.copepods = Math.max(0, P.copepods - dt * 0.6);
  }

  // Find the nearest thing to interact with; E (or A) uses it, holding when the action takes time.
  function interactScan(dt, lock) {
    let best = null, bd = 2.8;
    for (const e of E.list) {
      if (!e.alive || !e.interact) continue;
      let ex = e.x, ey = e.y, ez = e.z;
      if (e.type === 'procession') { ex = e.px[0]; ey = e.py[0]; ez = e.pz[0]; }
      const d = Math.hypot(ex - P.x, ey - P.y, (ez - P.z) * 0.8) - (e.reach || 0);
      if (d < bd) { const lb = e.interact.label(); if (lb) { bd = d; best = e; } }
    }
    P.prompt = best ? { label: best.interact.label(), hold: best.interact.hold || 0, prog: 0, e: best } : null;
    if (!best || lock) { P.interactT = 0; return; }
    if (best.interact.hold) {
      if (I.down('interact')) { P.interactT += dt; P.prompt.prog = P.interactT / best.interact.hold; if (P.interactT >= best.interact.hold) { P.interactT = 0; best.interact.fn.call(best); } }
      else P.interactT = 0;
    } else if (I.pressed('interact')) best.interact.fn.call(best);
  }

  function recordFrame() {
    const o = (recIdx % RECN) * 7;
    REC[o] = P.x; REC[o + 1] = P.y; REC[o + 2] = P.z; REC[o + 3] = P.yaw; REC[o + 4] = P.kick;
    REC[o + 5] = P.lampMode === 'white' ? 1 : P.lampMode === 'red' ? 2 : 0; REC[o + 6] = P.pingFlag || 0;
    recIdx++;
  }

  // ------------------------------------------------------------------ drawing
  Pm.draw = function () {
    if (!P) return;
    if (B.act === 'deck') {
      R.model(P.x, P.y, P.z, MD.person({ yaw: P.yaw, t: B.time, walk: P.walk, suit: '#d4621e', hair: '#3a2416', skin: '#c89070' }), {});
      return;
    }
    if (P.dead && B.Story.hideBody) return;
    // suit work lights: a dim spill so the rock right beside you reads
    if (P.powered && !P.braced) R.addLight(P.x, P.y, P.z - 0.6, 0.85, 0.9, 1, 6, 0.3);
    const f = H(P.x, P.y), alt = f - P.z;
    if (alt < 60 && !P.inCage) R.shadow(P.x, P.y, f, 0.9 + alt * 0.02, 0.85 * (1 - alt / 60));
    const west = Math.cos(MD.quant8(P.yaw)) < -0.3;
    const flip = P.flipped && west;
    const yaw = flip ? Math.PI - MD.quant8(P.yaw) : MD.quant8(P.yaw);
    const top = P.cells[P.cells.length - 1];
    // through the Lossless Shard her helmet is empty
    const L = B.lensOn, hollow = !!(L && Math.hypot(L.x - R.sx(P.x), L.y - R.sy(P.y, P.z) + 6) < L.r);
    const prims = MD.diver({
      yaw, pitch: P.thrust * 0.25 * (P.boost ? 1.4 : 1), t: B.time, kick: P.kick, lamp: R.env.lamp.on ? P.lampMode : 'off',
      fill: P.cells.length / P.cap, tankCol: top ? STRAIN[top].col : null, growth: P.growth, hollow,
    });
    R.model(P.x, P.y, P.z, prims, { scale: P.res, flip, lut: 1, minLight: 0.12 });
    // the Pick line
    if (P.anchor) {
      const hx = P.x + Math.cos(P.yaw) * 0.5, hy = P.y + Math.sin(P.yaw) * 0.6, hz = P.z + 0.1;
      if (P.breached) R.line(hx, hy, hz, P.anchor.x, P.anchor.y, P.anchor.z, 0.12, 0.5, 0.38, true, 0.9);
      else R.line(hx, hy, hz, P.anchor.x, P.anchor.y, P.anchor.z, 0.6, 0.6, 0.55, false);
    }
    if (P.caul > 0) R.disc(P.x, P.y, P.z - 0.4, 2.4, 0.5, 0.6, 0.3, 0.22 * Math.min(1, P.caul), false);
  };

  // ------------------------------------------------------------------ save / load
  Pm.serialize = function () {
    const keys = ['x', 'y', 'z', 'yaw', 'o2', 'o2Max', 'carts', 'lime', 'limes', 'air', 'rating', 'fidelity', 'res', 'flipped', 'breached', 'cells', 'growth', 'lampMode', 'trim'];
    const o = {}; for (const k of keys) o[k] = P[k];
    o.inv = Object.assign({}, P.inv); o.relics = Object.assign({}, P.relics); o.up = Object.assign({}, P.up);
    return JSON.parse(JSON.stringify(o));
  };
  Pm.restore = function (o) {
    P = B.player = Object.assign(Pm.fresh(), o, { inv: Object.assign(Pm.fresh().inv, o.inv), relics: Object.assign(Pm.fresh().relics, o.relics), up: Object.assign(Pm.fresh().up, o.up) });
    P.vx = P.vy = P.vz = 0; P.crush = 0; P.paco2 = 40;
    R.setFidelity(P.fidelity);
    return P;
  };
})(window.B);
