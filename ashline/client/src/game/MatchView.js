// Client-side match controller: input → predicted movement/shots → server reconciliation, remote
// interpolation, camera, effects, audio and HUD for one match.
import * as THREE from 'three';
import { DT, TICK_RATE, INTERP_TICKS, MODE, BTN, PLANE, PICKUP_RANGE, REVIVE_RANGE, WATER_LEVEL } from '../../../shared/constants.js';
import { createMoveState, copyMoveState, stepMove, eyeHeight, viewDir } from '../../../shared/physics/Movement.js';
import { encodeInput, decodeSnapshot, quantizeInput, weaponFromWire } from '../../../shared/net/Protocol.js';
import { WEAPONS, HEALS, magSize, itemName } from '../../../shared/sim/Items.js';
import { hash3, clamp, wrapAngle } from '../../../shared/rng.js';
import { MAT_SURFACE } from '../../../shared/map/Buildings.js';
import { Character } from '../entity/Character.js';
import { Viewmodel } from '../entity/Viewmodel.js';
import { ItemField, AshWall, buildPlane, buildTerminal } from '../render/Dynamic.js';

const D2R = Math.PI / 180;
const ACT = { none: 0, reload: 1, heal: 2, equip: 3, revive: 4, hack: 5, revived: 6 };
const GUNCLS = { pistol: 'pistol', smg: 'smg', ar: 'rifle', dmr: 'heavyrifle', lmg: 'heavyrifle', sniper: 'sniper', shotgun: 'shotgun' };
const sndOf = (wid) => { const d = WEAPONS[wid]; return d ? d.snd : 'rifle'; };

export class MatchView {
  constructor(app, init) {
    this.app = app;
    const { renderer, world } = app;
    this.R = renderer; this.world = world.world; this.map = world.map;
    this.me = init.you; this.squad = init.squad; this.mode = init.mode;
    this.roster = new Map(init.roster.map(r => [r.id, r]));
    this.myCos = (this.roster.get(this.me) || {}).cos || {};
    this.items = new ItemField(renderer.scene);
    for (const [id, x, y, z, it] of init.items) this.items.add(id, x, y, z, it);
    this.fx = app.effects;
    for (const c of init.crates) this.fx.crate(c);
    for (const s of init.smokes) this.fx.smoke(s.id, s.x, s.y, s.z, s.left);
    this.terminals = init.terminals.map(t => { const m = buildTerminal(); m.position.set(t.x, t.y, t.z); renderer.scene.add(m); return { ...t, m }; });
    this.ash = new AshWall(renderer.scene);
    this.plane = buildPlane(); renderer.scene.add(this.plane);
    this.planeInfo = init.plane;
    this.zone = { cx: 0, cz: 0, cr: 760, nx: 0, nz: 0, nr: 760, phase: 0, state: 0, timer: 0 };
    this.vm = new Viewmodel(renderer, app.tex, this.myCos);
    // prediction
    this.pred = createMoveState(0, PLANE.alt, 0); this.pred.mode = MODE.PLANE;
    this.prev = copyMoveState({}, this.pred);
    this.pending = [];
    this.seq = 1;
    this.acc = 0;
    this.smooth = new THREE.Vector3();
    this.status = { hp: 100, boost: 0, bleed: 0, slot: 0, mag: 0, act: 0, actP: 0, spec: -1, alive: true, mode: MODE.PLANE };
    this.inv = null;
    this.yaw = init.plane ? Math.atan2(-init.plane.dx, -init.plane.dz) : 0; this.pitch = -0.2;
    this.recoilP = 0; this.trauma = 0;
    this.fire = { cd: 0, bloom: 0, lastShot: -1 };
    this.predMag = 0; this.shotsBySeq = new Map();
    this.localAct = null; // { k, until } local mirror of reload/equip to gate predicted shots
    // remote players
    this.remotes = new Map();
    this.selfBuf = [];
    this.clock = init.tick; this.lastSnap = performance.now();
    this.alive = 0; this.squadsLeft = 0;
    this.eyeY = 1.62;
    this.ended = false; this.dead = false;
    this.pings = []; this.intel = null;
    this.kills = 0;
    this.stepDist = 0;
    this.adsT = 0;
    this.lastHitTime = 0;
    this.indoor = false; this.indoorT = 0;
    this.prompt = '';
    this.lookTarget = null;
    this.camPos = new THREE.Vector3();
    this.hud = app.hud;
    this.hud.startMatch(this);
    this.applyZoneEvent(init.zone);
    if (init.phase === 'plane') this.hud.notify('Board the transport. Press SPACE to jump.', 5);
  }

  dispose() {
    const s = this.R.scene;
    s.remove(this.items.group, this.ash.mesh, this.plane);
    for (const t of this.terminals) s.remove(t.m);
    for (const r of this.remotes.values()) r.char.dispose();
    if (this.selfCharObj) this.selfCharObj.dispose();
    for (const h of this.fx.holes) h.visible = false;
    for (const c of this.fx.clouds) for (const p of c.puffs) p.removeFromParent();
    this.fx.clouds = [];
    this.vm.root.removeFromParent();
    this.fx.setNades([]);
    for (const c of this.fx.crates) c.removeFromParent();
    this.fx.crates = [];
    this.app.audio.stopLoops();
    this.R.setZoom(1);
    this.hud.endMatch();
  }

  name(id) { const r = this.roster.get(id); return r ? r.name : id === -1 ? 'the ash' : '?'; }
  isMate(id) { const r = this.roster.get(id); return r && r.squad === this.squad; }

  // ------------------------------------------------------------------ network
  onMessage(m) {
    if (m instanceof ArrayBuffer) return this.onSnapshot(decodeSnapshot(m));
    switch (m.t) {
      case 'ev': for (const e of m.e) this.onEvent(e); break;
      case 'inv': this.inv = m.inv; this.hud.setInventory(m.inv); break;
    }
  }

  onSnapshot(s) {
    if (!s) return;
    const now = performance.now();
    // clock: estimate the current server tick
    const est = this.clock;
    if (Math.abs(s.tick - est) > 8) this.clock = s.tick; else this.clock += (s.tick - est) * 0.12;
    this.lastSnapTick = s.tick; this.lastSnap = now;
    this.zone = s.zone; this.alive = s.alive; this.squadsLeft = s.squads;
    this.planePos = s.plane;
    // remotes
    const seen = new Set();
    for (const p of s.players) {
      seen.add(p.id);
      let r = this.remotes.get(p.id);
      if (!r) {
        const info = this.roster.get(p.id) || { cos: {} };
        r = { id: p.id, buf: [], char: new Character(this.app.tex, info.cos), last: now, cur: null };
        this.R.scene.add(r.char.root);
        this.remotes.set(p.id, r);
      }
      r.buf.push({ tick: s.tick, ...p });
      if (r.buf.length > 40) r.buf.splice(0, r.buf.length - 40);
      r.last = now;
    }
    for (const [id, r] of this.remotes) if (!seen.has(id) && now - r.last > 400) { r.char.dispose(); this.remotes.delete(id); }
    this.fx.setNades(s.proj);
    if (!s.self) return;
    const m = s.self;
    const wasAlive = this.status.alive;
    Object.assign(this.status, m);
    this.status.mode = m.mode;
    this.selfBuf.push({ tick: s.tick, x: m.x, y: m.y, z: m.z });
    if (this.selfBuf.length > 30) this.selfBuf.shift();
    if (wasAlive && !m.alive) this.onDeath();
    // reconcile
    while (this.pending.length && this.pending[0].seq <= s.ack) { this.shotsBySeq.delete(this.pending[0].seq); this.pending.shift(); }
    let unacked = 0; for (const p of this.pending) unacked += this.shotsBySeq.get(p.seq) || 0;
    this.predMag = Math.max(0, m.mag - unacked);
    const before = { x: this.pred.x, y: this.pred.y, z: this.pred.z, mode: this.pred.mode };
    copyMoveState(this.pred, m);
    if (m.mode === MODE.GROUND || m.mode === MODE.KNOCKED || m.mode === MODE.FREEFALL || m.mode === MODE.CHUTE) {
      for (const inp of this.pending) stepMove(this.pred, inp, this.world, DT, this.mods());
      if (before.mode === this.pred.mode) {
        const ex = before.x - this.pred.x, ey = before.y - this.pred.y, ez = before.z - this.pred.z;
        if (Math.hypot(ex, ey, ez) < 2.5) this.smooth.x += ex, this.smooth.y += ey, this.smooth.z += ez;
        else this.smooth.set(0, 0, 0);
      } else { this.smooth.set(0, 0, 0); copyMoveState(this.prev, this.pred); }
    } else copyMoveState(this.prev, this.pred);
  }

  mods() {
    const st = this.status;
    const w = this.inv && st.slot < 3 ? this.inv.w[st.slot] : null;
    const mods = { speedMul: (st.boost >= 60 ? 1.05 : 1) * (w && WEAPONS[w.id].slowMul ? WEAPONS[w.id].slowMul : 1), noSprint: false, slow: 0 };
    if (st.act === ACT.heal) mods.slow = 2.2;
    if (st.act === ACT.revive || st.act === ACT.hack) mods.slow = 0.01;
    return mods;
  }

  send(o) { this.app.conn.send(o); }
  cmd(c) { this.send({ t: 'cmd', c }); }

  // ------------------------------------------------------------------ events
  onEvent(e) {
    const A = this.app.audio, me = this.me;
    switch (e.e) {
      case 'shot': {
        if (e.p === me) break;
        const [ox, oy, oz] = e.o;
        const r = this.remotes.get(e.p);
        const sx = r && r.cur ? r.cur.x : ox, sz = r && r.cur ? r.cur.z : oz;
        for (const h of e.h) {
          if (Math.random() < 0.6) this.fx.tracer(sx - Math.sin(r?.cur?.yaw || 0) * 0.6, oy - 0.1, sz - Math.cos(r?.cur?.yaw || 0) * 0.6, h[0], h[1], h[2]);
          if (h[3] === 1) this.fx.impact(h[0], h[1], h[2], h[4], ...this.surfNormal(ox, oy, oz, h));
          else if (h[3] === 2) this.fx.blood(h[0], h[1], h[2]);
          this.nearMiss(ox, oy, oz, h);
        }
        const d = Math.hypot(ox - this.camPos.x, oz - this.camPos.z);
        if (e.s) A.at('gun_sup', ox, oy, oz, { gain: 0.8, max: 60, ref: 3 });
        else A.at(d > 140 ? `gun_${sndOf(e.w)}_far` : `gun_${sndOf(e.w)}`, ox, oy, oz, { gain: d > 140 ? 1.4 : 1, ref: 8, max: 1400, delay: true, verb: 0.35 });
        if (r) r.firing = 4;
        break;
      }
      case 'hit': {
        if (e.a === me) {
          this.hud.hitmarker(e.z === 'head', false);
          A.play(e.z === 'head' ? 'headmark' : 'hitmark', 0.7);
          if (e.b) A.play('armor', 0.6);
        }
        if (e.v === me) {
          this.trauma = Math.min(1, this.trauma + Math.min(0.6, e.d / 60));
          this.lastHitTime = performance.now();
          A.play('hurt', 0.5 + Math.min(0.5, e.d / 50));
          if (e.a !== undefined && e.ax !== undefined) this.hud.damageFrom(Math.atan2(-(e.ax - this.pred.x), -(e.az - this.pred.z)) - this.yaw);
          if (e.b) { A.play('armor', 0.9); this.hud.notify(e.b === 'helmet' ? 'Helmet destroyed' : 'Vest destroyed', 2); }
        }
        break;
      }
      case 'knock':
        this.hud.feed(this.name(e.a), this.name(e.v), e.w, 'knocked', e.a === me || this.isMate(e.a), e.v === me || this.isMate(e.v));
        if (e.a === me) { this.hud.notify(`Knocked down ${this.name(e.v)}`, 2.5); A.play('killconfirm', 0.6); }
        if (e.v === me) { this.hud.notify('You are down! Crawl to cover — your squad can revive you.', 4); this.trauma = 1; }
        break;
      case 'kill':
        this.hud.feed(this.name(e.a), this.name(e.v), e.w, e.hs ? 'headshot' : 'killed', e.a === me || this.isMate(e.a), e.v === me || this.isMate(e.v), e.d);
        if (e.a === me) { this.kills++; this.hud.notify(`Eliminated ${this.name(e.v)}${e.d > 60 ? ` (${e.d} m)` : ''}`, 2.5); A.play('killconfirm', 0.9); this.hud.hitmarker(true, true); }
        break;
      case 'revive':
        if (e.v === me) this.hud.notify(`${this.name(e.a)} revived you`, 3);
        else if (e.a === me) this.hud.notify(`You revived ${this.name(e.v)}`, 3);
        break;
      case 'pick': this.items.remove(e.id); break;
      case 'item': this.items.add(e.id, e.x, e.y, e.z, e.it); break;
      case 'itemn': this.items.setCount(e.id, e.n); break;
      case 'crate': this.fx.crate(e); break;
      case 'smoke': this.fx.smoke(e.id, e.x, e.y, e.z, e.dur); A.at('smokehiss', e.x, e.y, e.z, { gain: 0.7, max: 80 }); break;
      case 'boom': {
        this.fx.explosion(e.x, e.y, e.z); A.at('boom', e.x, e.y, e.z, { gain: 1.6, ref: 10, max: 1200, delay: true, verb: 0.5 });
        const d = Math.hypot(e.x - this.pred.x, e.y - this.pred.y, e.z - this.pred.z);
        this.trauma = Math.min(1, this.trauma + Math.max(0, 1 - d / 30));
        break;
      }
      case 'throw': if (e.p !== me) { const r = this.remotes.get(e.p); if (r && r.cur) A.at('throw', r.cur.x, r.cur.y + 1.5, r.cur.z, { max: 40 }); } break;
      case 'reload': if (e.p !== me) { const r = this.remotes.get(e.p); if (r && r.cur) { A.at('mag_out', r.cur.x, r.cur.y + 1.2, r.cur.z, { max: 30, gain: 0.6 }); setTimeout(() => r.cur && A.at('mag_in', r.cur.x, r.cur.y + 1.2, r.cur.z, { max: 30, gain: 0.6 }), 900); } } break;
      case 'jump': if (e.p === me) { A.play('chute', 0.4); this.hud.notify('Steer with WASD, look down to dive. SPACE opens the chute early.', 5); } break;
      case 'land': if (e.p === me) { A.play('land', 0.9); this.hud.notify('Loot up. The ash is coming.', 3); } break;
      case 'fall': if (e.p === me) A.play('hurt', 0.8); break;
      case 'zone': this.applyZoneEvent(e); break;
      case 'elim':
        if (e.sq === this.squad) this.hud.notify(`Your squad is out — #${e.place}`, 6);
        else this.hud.notify(`Squad eliminated · ${e.place - 1} left`, 2);
        break;
      case 'end': {
        this.ended = true;
        const won = (this.roster.get(this.me) || {}).squad === e.winner;
        this.hud.banner(won ? 'LAST SQUAD STANDING' : `${e.names.join(', ')} survived the ash`, won ? 'win' : 'lose');
        break;
      }
      case 'ping': this.pings.push({ ...e, t: performance.now() }); A.play('beep', 0.5); break;
      case 'intel': this.intel = { ...e, t: performance.now() }; this.hud.notify(`Intel: next ash front revealed · ${e.en.length} hostiles pinged`, 5); A.play('beep', 0.8); break;
      case 'hacking': A.at('beep', e.x, e.y + 1, e.z, { max: 200, gain: 1 }); break;
      case 'hacked': { const t = this.terminals.find(x => x.id === e.term); if (t) { t.hacked = e.sq; t.m.userData.screenMat.color.setRGB(1.2, 0.2, 0.1); } break; }
      case 'msg': if (e.to === me) this.hud.notify(e.m, 2); break;
      case 'got': if (e.to === me) { A.play('pickup', 0.6); this.hud.toast(`+ ${itemName(e.it)}`); } break;
      case 'heal': if (e.p === me) A.play('bandage', 0.6); break;
      case 'dry': if (e.p === me) A.play('dry', 0.8); break;
      case 'phase': if (e.phase === 'live') this.hud.notify('The ash front has formed. Watch the map.', 4); break;
    }
  }

  applyZoneEvent(z) {
    if (!z || !z.cur) return;
    if (z.ev === 'shrink') { this.app.audio.play('horn', 0.6); this.hud.notify('The ash is closing in!', 4); }
    else if (z.ev === 'wait') this.hud.notify(`Ash front ${z.phase + 1} marked on the map`, 4);
    else if (z.ev === 'final') this.hud.notify('Final front: nowhere left to run', 4);
  }

  surfNormal(ox, oy, oz, h) {
    const dx = h[0] - ox, dy = h[1] - oy, dz = h[2] - oz, L = Math.hypot(dx, dy, dz) || 1;
    const out = {};
    const t = this.world.raycast(ox, oy, oz, dx / L, dy / L, dz / L, L + 0.5, out);
    return t < Infinity ? [out.nx, out.ny, out.nz] : [0, 1, 0];
  }

  nearMiss(ox, oy, oz, h) {
    const c = this.camPos;
    const dx = h[0] - ox, dy = h[1] - oy, dz = h[2] - oz, L = Math.hypot(dx, dy, dz) || 1;
    const t = ((c.x - ox) * dx + (c.y - oy) * dy + (c.z - oz) * dz) / L;
    if (t < 2 || t > L) return;
    const px = ox + dx / L * t - c.x, py = oy + dy / L * t - c.y, pz = oz + dz / L * t - c.z;
    const d = Math.hypot(px, py, pz);
    if (d < 3 && h[4] !== this.me) this.app.audio.at('whiz', c.x + px, c.y + py, c.z + pz, { gain: 0.8, ref: 1, max: 10, verb: 0 });
  }

  onDeath() {
    this.dead = true;
    this.hud.notify('You were eliminated', 4);
    this.app.audio.play('hurt', 1);
    this.hud.setDead(true);
  }

  // ------------------------------------------------------------------ per-frame
  frame(dt) {
    const app = this.app, input = app.input, S = app.settings;
    const ui = this.hud;
    const blocking = ui.inventoryOpen || ui.mapOpen || ui.menuOpen;
    // mouse look
    if (input.locked && !blocking) {
      const zoom = this.adsT > 0.5 ? this.vm.zoom : 1;
      const k = 0.0022 * S.sens * (this.adsT > 0.5 ? S.adsSens / Math.max(1, zoom * 0.75) : 1);
      this.yaw -= input.mouse.dx * k;
      this.pitch -= input.mouse.dy * k * (S.invertY ? -1 : 1);
      this.pitch = clamp(this.pitch, -1.5, 1.5);
    }
    this.handleKeys(input, blocking);
    // fixed-step input + prediction
    this.acc += Math.min(dt, 0.25);
    while (this.acc >= DT) { this.acc -= DT; this.tickInput(input, blocking); }
    const alpha = this.acc / DT;
    this.clock += dt * TICK_RATE;
    const renderTick = this.clock - INTERP_TICKS;
    this.updateRemotes(renderTick, dt);
    this.updateCamera(dt, alpha, renderTick);
    this.updateWorld(dt);
    ui.update(dt, this);
    input.endFrame();
  }

  handleKeys(input, blocking) {
    const st = this.status;
    const ui = this.hud;
    if (input.hit('Tab')) ui.toggleInventory();
    if (input.hit('KeyM')) ui.toggleMap();
    if (input.hit('Escape') && (ui.inventoryOpen || ui.mapOpen)) { ui.closePanels(); }
    if (!st.alive) {
      if (input.btnHit(0)) this.cmd({ c: 'spectate', d: 1 });
      if (input.btnHit(2)) this.cmd({ c: 'spectate', d: -1 });
      return;
    }
    if (blocking) return;
    const slotKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
    slotKeys.forEach((k, i) => { if (input.hit(k)) this.switchSlot(i); });
    if (input.mouse.wheel) this.cycleSlot(input.mouse.wheel);
    if (input.hit('KeyG')) { const nxt = this.inv && this.inv.thrSel === 'frag' ? 'smoke' : 'frag'; this.cmd({ c: 'thr', id: nxt }); if (st.slot !== 3) this.switchSlot(3); }
    if (input.hit('Digit5')) this.useHeal('bandage');
    if (input.hit('Digit6')) this.useHeal('kit');
    if (input.hit('Digit7')) this.useHeal('stim');
    if (input.hit('KeyH')) this.smartHeal();
    if (input.hit('KeyB')) this.cmd({ c: 'firemode' });
    if (input.hit('KeyX')) this.cmd({ c: 'cancel' });
    if (input.hit('KeyE') && this.lookTarget) this.cmd({ c: 'pickup', id: this.lookTarget.id });
    if (input.hit('KeyZ') || input.btnHit(1)) this.ping();
  }

  switchSlot(s) {
    const inv = this.inv; if (!inv) return;
    if (s < 3 && !inv.w[s]) return;
    if (s === 3 && inv.thr.frag + inv.thr.smoke <= 0) return;
    if (s === this.status.slot) return;
    this.cmd({ c: 'slot', s });
    this.status.slot = s;
    const w = s < 3 ? inv.w[s] : null;
    this.localAct = { k: 'equip', until: performance.now() + (w ? WEAPONS[w.id].equip : 0.35) * 1000 + 30 };
    this.app.audio.play('equip', 0.5);
  }
  cycleSlot(d) {
    const order = [0, 1, 2, 3];
    let i = order.indexOf(this.status.slot);
    for (let k = 0; k < 4; k++) { i = (i + (d > 0 ? 1 : 3)) % 4; const s = order[i]; if ((s < 3 && this.inv && this.inv.w[s]) || (s === 3 && this.inv && this.inv.thr.frag + this.inv.thr.smoke > 0)) { this.switchSlot(s); return; } }
  }
  useHeal(id) { if (this.inv && this.inv.heal[id] > 0) this.cmd({ c: 'use', id }); }
  smartHeal() {
    const inv = this.inv, hp = this.status.hp; if (!inv) return;
    if (hp < 75 && inv.heal.bandage > 0 && (hp > 45 || !inv.heal.kit)) this.useHeal('bandage');
    else if (hp < 100 && inv.heal.kit > 0) this.useHeal('kit');
    else if (inv.heal.stim > 0) this.useHeal('stim');
    else this.hud.notify('No usable heals', 1.5);
  }

  ping() {
    const cam = this.R.camera;
    const d = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const out = {};
    const t = this.world.raycast(cam.position.x, cam.position.y, cam.position.z, d.x, d.y, d.z, 900, out);
    if (t === Infinity) return;
    const p = cam.position.clone().addScaledVector(d, t);
    let kind = 'loc';
    for (const r of this.remotes.values()) if (r.cur && !this.isMate(r.id) && r.cur.mode !== MODE.DEAD) {
      const v = new THREE.Vector3(r.cur.x, r.cur.y + 1.2, r.cur.z).sub(cam.position);
      if (v.angleTo(d) < 0.03 && v.length() < t + 2) { kind = 'enemy'; p.set(r.cur.x, r.cur.y + 1.2, r.cur.z); }
    }
    if (kind === 'loc' && this.lookTarget) { kind = 'item'; p.set(this.lookTarget.x, this.lookTarget.y, this.lookTarget.z); }
    this.cmd({ c: 'ping', x: p.x, y: p.y, z: p.z, k: kind });
  }

  tickInput(input, blocking) {
    const st = this.status;
    const S = this.app.settings;
    let mx = 0, mz = 0, b = 0;
    if (!blocking && st.alive) {
      if (input.down('KeyW')) mz += 1; if (input.down('KeyS')) mz -= 1;
      if (input.down('KeyD')) mx += 1; if (input.down('KeyA')) mx -= 1;
      if (input.down('Space')) b |= BTN.JUMP;
      if (input.down('ShiftLeft') || input.down('ShiftRight')) b |= BTN.SPRINT;
      if (S.crouchToggle) { if (input.hit('KeyC') || input.hit('ControlLeft')) this.crouchLatch = !this.crouchLatch; if (this.crouchLatch) b |= BTN.CROUCH; }
      else if (input.down('KeyC') || input.down('ControlLeft')) b |= BTN.CROUCH;
      if (input.down('KeyR')) b |= BTN.RELOAD;
      if (input.down('KeyE')) b |= BTN.USE;
      if (input.locked && input.btn(0)) b |= BTN.FIRE;
      if (S.adsToggle) { if (input.btnHit(2)) this.adsLatch = !this.adsLatch; if (this.adsLatch) b |= BTN.ADS; }
      else if (input.locked && input.btn(2)) b |= BTN.ADS;
    }
    const inp = quantizeInput({ seq: this.seq++, viewTick: this.clock - INTERP_TICKS, mx, mz, yaw: this.yaw, pitch: this.pitch, buttons: b });
    this.app.conn.sendBin(encodeInput(inp));
    const pressed = b & ~this.pred.pb;
    copyMoveState(this.prev, this.pred);
    if (this.pred.mode === MODE.GROUND || this.pred.mode === MODE.KNOCKED || this.pred.mode === MODE.FREEFALL || this.pred.mode === MODE.CHUTE) {
      stepMove(this.pred, inp, this.world, DT, this.mods());
      this.footsteps();
    } else this.pred.pb = b;
    this.pending.push(inp);
    if (this.pending.length > 120) this.pending.shift();
    this.predictFire(inp, b, pressed);
    if ((pressed & BTN.RELOAD) && this.inv) this.startLocalReload();
  }

  startLocalReload() {
    const w = this.inv && this.status.slot < 3 ? this.inv.w[this.status.slot] : null;
    if (!w || this.localAct) return;
    const def = WEAPONS[w.id];
    if (this.predMag >= magSize(w) || this.inv.ammo[def.ammo] <= 0) return;
    this.localAct = { k: 'reload', until: performance.now() + def.reload * 1000 };
    this.app.audio.play('mag_out', 0.6);
    setTimeout(() => this.app.audio.play('mag_in', 0.6), def.reload * 650);
  }

  predictFire(inp, b, pressed) {
    const f = this.fire, st = this.status;
    f.cd -= DT; f.bloom = Math.max(0, f.bloom - DT * 3.5);
    if (this.localAct && performance.now() > this.localAct.until) this.localAct = null;
    const busy = this.localAct || st.act === ACT.reload || st.act === ACT.equip || st.act === ACT.revive || st.act === ACT.hack;
    if (this.pred.mode !== MODE.GROUND || !this.inv || !st.alive) { if (f.cd < 0) f.cd = 0; return; }
    if (st.slot === 3) {
      if ((pressed & BTN.FIRE) && !busy && this.inv.thr.frag + this.inv.thr.smoke > 0) { this.vm.throwAnim(); this.app.audio.play('throw', 0.6); f.cd = 0.8; }
      if (f.cd < 0) f.cd = 0;
      return;
    }
    const w = this.inv.w[st.slot];
    if (!w || !(b & BTN.FIRE) || busy) { if (f.cd < 0) f.cd = 0; return; }
    const def = WEAPONS[w.id];
    const auto = def.auto && !w.semi;
    if (!auto && !(pressed & BTN.FIRE)) { if (f.cd < 0) f.cd = 0; return; }
    if (this.predMag <= 0) { if (pressed & BTN.FIRE) { this.app.audio.play('dry', 0.8); this.startLocalReload(); } if (f.cd < 0) f.cd = 0; return; }
    let n = 0;
    while (f.cd <= 0 && this.predMag > 0 && n < 3) {
      this.localShot(w, def, inp, n);
      f.cd += 60 / def.rpm; n++;
      this.predMag--;
      if (!auto) break;
    }
    if (n) this.shotsBySeq.set(inp.seq, n);
    if (this.predMag <= 0 && this.inv.ammo[def.ammo] > 0) this.startLocalReload();
  }

  localShot(w, def, inp, sub) {
    const f = this.fire, p = this.pred;
    const ads = !!(inp.buttons & BTN.ADS);
    let spread = ads ? def.ads : def.hip;
    spread += Math.min(1, Math.hypot(p.vx, p.vz) / 5) * (ads ? 0.6 : 1.6);
    if (p.crouch) spread *= 0.8;
    if (w.att && w.att.grip) spread *= 0.9;
    spread += f.bloom * (w.att && w.att.grip ? 0.75 : 1);
    if (!p.grounded) spread += 3;
    f.bloom = Math.min(f.bloom + def.bloom, 4);
    const ox = p.x, oy = p.y + eyeHeight(p), oz = p.z;
    const muzzle = this.vm.muzzleWorld() || new THREE.Vector3(ox, oy - 0.1, oz);
    const out = {};
    for (let k = 0; k < (def.pellets || 1); k++) {
      const u = hash3(this.me * 7 + 1, inp.seq, k * 4 + sub * 64 + 1), v = hash3(this.me * 7 + 2, inp.seq, k * 4 + sub * 64 + 2);
      const rr = spread * Math.sqrt(u) * D2R * 0.5, th = v * Math.PI * 2;
      const d = viewDir(inp.yaw + Math.cos(th) * rr, inp.pitch + Math.sin(th) * rr);
      const t = this.world.raycast(ox, oy, oz, d[0], d[1], d[2], 900, out);
      const L = Math.min(t, 900);
      const ex = ox + d[0] * L, ey = oy + d[1] * L, ez = oz + d[2] * L;
      if (k < 3 || Math.random() < 0.3) this.fx.tracer(muzzle.x, muzzle.y, muzzle.z, ex, ey, ez);
      if (t < Infinity) {
        const surf = out.kind === 'terrain' ? this.world.surfaceAt(ex, ez) : MAT_SURFACE[this.world.mat[out.box]];
        this.fx.impact(ex, ey, ez, surf, out.nx, out.ny, out.nz);
      }
    }
    // recoil
    const kickMul = (ads ? 0.75 : 1) * (p.crouch ? 0.85 : 1) * (w.att && w.att.grip ? 0.8 : 1);
    const kp = def.kick * D2R * kickMul, kh = (hash3(this.me, inp.seq, sub + 9) - 0.5) * 2 * def.kickH * D2R * kickMul;
    this.pitch = clamp(this.pitch + kp, -1.5, 1.5); this.yaw += kh;
    this.recoilP += kp;
    f.lastShot = performance.now();
    this.vm.shot();
    this.trauma = Math.min(1, this.trauma + def.kick * 0.012);
    const sup = !!(w.att && w.att.muzzle === 'suppressor');
    this.app.audio.play(sup ? 'gun_sup' : `gun_${def.snd}`, sup ? 0.6 : 0.85);
    if (def.cls === 'sniper') setTimeout(() => this.app.audio.play('bolt', 0.5), 450);
    if (!sup) this.fx.flashLight(muzzle.x, muzzle.y, muzzle.z, 5, 0.05);
  }

  footsteps() {
    const p = this.pred;
    if (p.mode !== MODE.GROUND || !p.grounded) { this.stepDist = 0; return; }
    const sp = Math.hypot(p.vx, p.vz);
    this.stepDist += sp * DT;
    const stride = sp > 5.5 ? 2.1 : 1.6;
    if (this.stepDist > stride) {
      this.stepDist = 0;
      const surf = this.surfaceUnder(p.x, p.y, p.z);
      this.app.audio.play(`step_${surf}_${(Math.random() * 3) | 0}`, (p.crouch ? 0.15 : sp > 5.5 ? 0.55 : 0.32));
    }
  }

  surfaceUnder(x, y, z) {
    const out = {};
    const t = this.world.raycast(x, y + 0.3, z, 0, -1, 0, 1.0, out);
    if (t < Infinity && out.kind === 'box') { const s = MAT_SURFACE[this.world.mat[out.box]]; return s === 'dirt' ? 'dirt' : s; }
    if (y < WATER_LEVEL - 0.1) return 'water';
    return this.world.surfaceAt(x, z);
  }

  // ------------------------------------------------------------------ remotes
  sample(buf, tick) {
    if (!buf.length) return null;
    let a = buf[0], b = null;
    for (let i = buf.length - 1; i >= 0; i--) { if (buf[i].tick <= tick) { a = buf[i]; b = buf[i + 1] || null; break; } }
    if (!b) return a;
    const t = clamp((tick - a.tick) / Math.max(1, b.tick - a.tick), 0, 1);
    return { ...b, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, yaw: a.yaw + wrapAngle(b.yaw - a.yaw) * t, pitch: a.pitch + (b.pitch - a.pitch) * t };
  }

  updateRemotes(renderTick, dt) {
    const cam = this.camPos;
    for (const r of this.remotes.values()) {
      const s = this.sample(r.buf, renderTick);
      if (!s) continue;
      const prevMode = r.cur ? r.cur.mode : s.mode;
      r.cur = s;
      const ch = r.char;
      const visible = s.mode !== MODE.DEAD && s.mode !== MODE.PLANE && s.mode !== MODE.WAITING && !(this.dead && this.status.spec === r.id && this.specFirst);
      ch.root.visible = visible;
      if (!visible) continue;
      ch.setGear(s.gear);
      ch.setWeapon(s.weapon);
      const d = Math.hypot(s.x - cam.x, s.z - cam.z);
      ch.update(s, dt, d);
      // remote footsteps
      if (s.mode === MODE.GROUND && d < 45) {
        r.stepAcc = (r.stepAcc || 0) + (ch.speed * dt);
        const sprint = s.flags & 4, crouch = s.flags & 1;
        if (r.stepAcc > (sprint ? 2.1 : 1.6)) { r.stepAcc = 0; if (!crouch || d < 8) this.app.audio.at(`step_${this.world.surfaceAt(s.x, s.z)}_${(Math.random() * 3) | 0}`, s.x, s.y + 0.1, s.z, { gain: sprint ? 1.6 : 0.9, ref: 2.5, max: 45, verb: 0.05 }); }
      }
      if (prevMode === MODE.CHUTE && s.mode === MODE.GROUND && d < 80) this.app.audio.at('land', s.x, s.y, s.z, { max: 80 });
    }
  }

  // ------------------------------------------------------------------ camera & world
  updateCamera(dt, alpha, renderTick) {
    const cam = this.R.camera, p = this.pred, st = this.status;
    this.smooth.multiplyScalar(Math.exp(-dt * 12));
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    // recoil recovery when not firing
    if (performance.now() - this.fire.lastShot > 120 && this.recoilP > 0) { const r = this.recoilP * Math.min(1, dt * 7) * 0.65; this.pitch -= r; this.recoilP -= r / 0.65; if (this.recoilP < 1e-4) this.recoilP = 0; }
    const shake = this.trauma * this.trauma;
    const sx = (Math.sin(performance.now() * 0.047) * 0.012 + Math.sin(performance.now() * 0.031) * 0.008) * shake;
    const sy = (Math.cos(performance.now() * 0.043) * 0.012) * shake;
    const x = this.prev.x + (p.x - this.prev.x) * alpha + this.smooth.x;
    const y = this.prev.y + (p.y - this.prev.y) * alpha + this.smooth.y;
    const z = this.prev.z + (p.z - this.prev.z) * alpha + this.smooth.z;
    const mode = st.alive ? p.mode : MODE.DEAD;
    const ads = this.app.input.locked && this.app.input.btn(2) && mode === MODE.GROUND && !this.hud.blocking && !(this.app.input.down('ShiftLeft') && this.app.input.down('KeyW'));
    const adsOn = this.app.settings.adsToggle ? this.adsLatch && mode === MODE.GROUND : ads;
    this.adsT += ((adsOn && this.inv && this.status.slot < 3 ? 1 : 0) - this.adsT) * Math.min(1, dt * 12);
    let fp = false;
    if (mode === MODE.PLANE) {
      const s = this.sample(this.selfBuf, renderTick) || p;
      const back = viewDir(this.yaw, this.pitch);
      cam.position.set(s.x - back[0] * 32, s.y + 6 - back[1] * 32, s.z - back[2] * 32);
      cam.lookAt(s.x, s.y + 2, s.z);
      this.R.followShadow(s.x, this.world.heightAt(s.x, s.z), s.z);
    } else if (mode === MODE.FREEFALL || mode === MODE.CHUTE) {
      const back = viewDir(this.yaw, this.pitch * 0.6 - 0.25);
      const dist = mode === MODE.CHUTE ? 9 : 6;
      cam.position.set(x - back[0] * dist, y + 2.2 - back[1] * dist, z - back[2] * dist);
      cam.lookAt(x, y + (mode === MODE.CHUTE ? 2.5 : 0.8), z);
      this.R.followShadow(x, this.world.heightAt(x, z), z);
      this.selfChar(x, y, z, mode, dt);
    } else if (mode === MODE.DEAD) {
      const t = this.status.spec >= 0 ? this.remotes.get(this.status.spec) : null;
      if (t && t.cur) {
        const back = viewDir(t.cur.yaw, -0.25);
        const tx = t.cur.x, ty = t.cur.y + 1.6, tz = t.cur.z;
        const want = new THREE.Vector3(tx - back[0] * 3.2 + Math.cos(t.cur.yaw) * 0.6, ty + 0.5, tz - back[2] * 3.2 - Math.sin(t.cur.yaw) * 0.6);
        cam.position.lerp(want, Math.min(1, dt * 6));
        cam.lookAt(tx + back[0] * 6, ty + 0.2, tz + back[2] * 6);
        this.R.followShadow(tx, t.cur.y, tz);
      } else {
        cam.position.set(x + Math.sin(performance.now() / 4000) * 8, y + 5, z + Math.cos(performance.now() / 4000) * 8);
        cam.lookAt(x, y, z);
      }
      if (this.selfCharObj) this.selfCharObj.root.visible = false;
    } else {
      fp = true;
      const eh = eyeHeight(p);
      this.eyeY += (eh - this.eyeY) * Math.min(1, dt * 14);
      const bob = p.grounded ? Math.sin(performance.now() * 0.011) * Math.min(1, Math.hypot(p.vx, p.vz) / 6) * 0.025 * (1 - this.adsT * 0.8) : 0;
      cam.position.set(x, y + this.eyeY + bob, z);
      cam.rotation.set(this.pitch + sy, this.yaw + sx, mode === MODE.KNOCKED ? 0.25 : 0);
      this.R.followShadow(x, y, z);
      if (this.selfCharObj) this.selfCharObj.root.visible = false;
    }
    if (!fp && mode !== MODE.DEAD) cam.rotation.z = 0;
    this.camPos.copy(cam.position);
    cam.updateMatrixWorld();
    // zoom & viewmodel
    const scoped = this.vm.scoped && this.adsT > 0.85;
    this.R.setZoom(fp ? 1 + (this.vm.zoom - 1) * this.adsT : 1);
    const w = this.inv && st.slot < 3 ? this.inv.w[st.slot] : null;
    this.vm.setWeapon(st.slot === 3 && this.inv ? this.inv.thrSel : w);
    // indoor test for viewmodel lighting
    this.indoorT -= dt;
    if (this.indoorT <= 0) { this.indoorT = 0.25; this.indoor = this.world.raycastBoxes(cam.position.x, cam.position.y, cam.position.z, 0, 1, 0, 12) < Infinity; }
    const act = this.localAct ? (this.localAct.k === 'reload' ? ACT.reload : ACT.equip) : st.act;
    const actP = this.localAct && this.localAct.k === 'reload' && this.inv ? 1 - (this.localAct.until - performance.now()) / (WEAPONS[(w || {}).id || 'kr5'].reload * 1000) : st.actP;
    this.vm.update({
      dt, speed: Math.hypot(p.vx, p.vz), sprint: !!(p.pb & BTN.SPRINT) && Math.hypot(p.vx, p.vz) > 5, ads: this.adsT > 0.5 || adsOn, grounded: p.grounded,
      act, actP, lookDX: this.app.input.mouse.dx, lookDY: this.app.input.mouse.dy, hidden: !fp || mode === MODE.KNOCKED || scoped || !st.alive,
      indoor: this.indoor, suppressed: !!(w && w.att && w.att.muzzle === 'suppressor'),
    });
    this.scoped = scoped;
    // listener
    this.app.audio.setListener(cam);
    // look target
    this.lookTarget = null;
    if (fp && mode === MODE.GROUND) {
      const d = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      const it = this.items.pick(cam.position, d, PICKUP_RANGE);
      if (it) {
        const out = {};
        const L = Math.hypot(it.x - cam.position.x, it.y - cam.position.y, it.z - cam.position.z);
        const blockedT = this.world.raycastBoxes(cam.position.x, cam.position.y, cam.position.z, (it.x - cam.position.x) / L, (it.y + 0.05 - cam.position.y) / L, (it.z - cam.position.z) / L, L - 0.15, out);
        if (blockedT === Infinity) this.lookTarget = it;
      }
    }
  }

  selfChar(x, y, z, mode, dt) {
    if (!this.selfCharObj) { this.selfCharObj = new Character(this.app.tex, this.myCos); this.R.scene.add(this.selfCharObj.root); }
    const c = this.selfCharObj;
    c.root.visible = true;
    c.update({ x, y, z, yaw: this.yaw, pitch: this.pitch, mode, flags: 0 }, dt, 5);
  }

  updateWorld(dt) {
    const t = this.R.time;
    const z = this.zone;
    this.ash.update(t, z.cx, z.cz, z.cr);
    const pl = this.planePos;
    if (pl && pl.active && this.planeInfo) {
      this.plane.visible = true;
      this.plane.position.set(pl.x, PLANE.alt + 4, pl.z);
      this.plane.rotation.y = Math.atan2(-this.planeInfo.dx, -this.planeInfo.dz);
      const d = Math.hypot(pl.x - this.camPos.x, pl.z - this.camPos.z, PLANE.alt - this.camPos.y);
      this.app.audio.loop('plane', Math.max(0, 1 - d / 900) * (this.pred.mode === MODE.PLANE ? 0.9 : 0.6));
    } else { this.plane.visible = false; this.app.audio.loop('plane', 0); }
    const p = this.pred;
    const outside = Math.hypot(this.camPos.x - z.cx, this.camPos.z - z.cz) > z.cr;
    const edge = Math.abs(Math.hypot(this.camPos.x - z.cx, this.camPos.z - z.cz) - z.cr);
    const ashAmt = outside ? 1 : Math.max(0, 1 - edge / 60) * 0.4;
    this.fx.update(dt, this.camPos, ashAmt);
    this.items.update(dt, this.camPos.x, this.camPos.z);
    const R = this.R;
    R.post.u.ash.value += ((outside ? 0.85 : 0) - R.post.u.ash.value) * Math.min(1, dt * 2);
    R.skyU.ash.value = R.post.u.ash.value;
    const agl = this.camPos.y - this.world.heightAt(this.camPos.x, this.camPos.z);
    const alt = Math.min(1, Math.max(0.1, 1 - (agl - 30) / 320));
    R.scene.fog.density = (1.6 / this.app.settings.q.view) * (1 + R.post.u.ash.value * 6) * alt;
    const hpLow = this.status.alive ? Math.max(0, 1 - this.status.hp / 40) : 0;
    const hitFlash = Math.max(0, 1 - (performance.now() - this.lastHitTime) / 450);
    R.post.u.dmg.value = Math.max(hitFlash * 0.8, hpLow * 0.5, p.mode === MODE.KNOCKED ? 0.6 : 0);
    R.post.u.sat.value = 0.8 - (p.mode === MODE.KNOCKED ? 0.5 : hpLow * 0.3);
    const A = this.app.audio;
    A.loop('wind', 0.25 + (p.mode === MODE.FREEFALL ? 0 : 0.15));
    A.loop('freefall', p.mode === MODE.FREEFALL ? 0.9 : p.mode === MODE.CHUTE ? 0.25 : 0);
    A.loop('ash', Math.min(1, ashAmt * 1.2) * 0.9);
    A.loop('heart', this.status.alive && (this.status.hp < 30 || p.mode === MODE.KNOCKED) ? 0.7 : 0);
    for (const tm of this.terminals) if (tm.hacked < 0 || tm.hacked === undefined) tm.m.userData.light.intensity = 0.6 + Math.sin(t * 4) * 0.3;
    R.scene.traverse; // noop (keep tree-shaking honest)
  }

  // Interaction prompt text (used by HUD)
  interaction() {
    const st = this.status, p = this.pred;
    if (!st.alive || p.mode !== MODE.GROUND) return null;
    if (st.act === ACT.revive) return { text: 'Reviving…', p: st.actP };
    if (st.act === ACT.hack) return { text: 'Hacking terminal…', p: st.actP };
    if (st.act === ACT.heal) return { text: 'Healing…', p: st.actP };
    if (st.act === ACT.reload || (this.localAct && this.localAct.k === 'reload')) return { text: 'Reloading', p: st.act === ACT.reload ? st.actP : null };
    if (this.lookTarget) return { text: `[E] ${itemName(this.lookTarget.it)}`, key: true };
    for (const r of this.remotes.values()) if (r.cur && this.isMate(r.id) && r.cur.mode === MODE.KNOCKED && Math.hypot(r.cur.x - p.x, r.cur.z - p.z) < REVIVE_RANGE) return { text: `Hold [E] to revive ${this.name(r.id)}` };
    for (const t of this.terminals) if ((t.hacked === undefined || t.hacked < 0) && Math.hypot(t.x - p.x, t.z - p.z) < 1.9) return { text: 'Hold [E] to hack the intel terminal' };
    return null;
  }

  nearbyItems() { return this.items.near(this.pred.x, this.pred.y, this.pred.z, PICKUP_RANGE); }
}

export { GUNCLS, HEALS, weaponFromWire };
