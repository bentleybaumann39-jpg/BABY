// Authoritative match simulation. Runs on the server (and inside the browser for practice mode).
// No DOM, no three.js. One call to tick() advances the match by DT.
import {
  DT, TICK_RATE, MODE, BTN, PLAYER, PLANE, LAG_COMP_TICKS, REVIVE_TIME, HACK_TIME, PICKUP_RANGE, REVIVE_RANGE,
  MAP_HALF, MODES, RELEVANCE, GRAVITY,
} from '../constants.js';
import { Rng, hash3, clamp } from '../rng.js';
import { createMoveState, stepMove, bodyHeight, eyeHeight, viewDir } from '../physics/Movement.js';
import { WEAPONS, WEAPON_IDS, AMMO, ATTACH, ARMOR, PACK_CAP, HEALS, THROWS, rollLoot, magSize, canAttach } from './Items.js';
import { Zone } from './Zone.js';
import { MAT_SURFACE } from '../map/Buildings.js';
import { spawnVehicles, enterVehicle, exitVehicle, driveInput, stepVehicles, damageVehicle, rayVehicles, vehicleWire, scheduleAirdrop, stepAirdrops } from './Vehicles.js';

const HIST = LAG_COMP_TICKS + 3;
const D2R = Math.PI / 180;

export const ACT = { none: 0, reload: 1, heal: 2, equip: 3, revive: 4, hack: 5, revived: 6 };
export const ACT_NAMES = Object.keys(ACT);

export function emptyInventory() {
  return {
    w: [null, null, null], slot: 0, ammo: { '9mm': 0, '556': 0, '762': 0, '12g': 0, '338': 0 },
    heal: { bandage: 0, kit: 0, stim: 0 }, thr: { frag: 0, smoke: 0 }, thrSel: 'frag', atts: [],
    helmet: null, vest: null, pack: 0,
  };
}

export function invWeight(inv) {
  let w = 0;
  for (const k in inv.ammo) w += inv.ammo[k] * AMMO[k].w;
  for (const k in inv.heal) w += inv.heal[k] * HEALS[k].w;
  for (const k in inv.thr) w += inv.thr[k] * THROWS[k].w;
  for (const a of inv.atts) w += ATTACH[a].w;
  return w;
}

export class Sim {
  constructor({ map, world, nav = null, seed = 1, mode = 'solo', timeScale = 1, botFactory = null, lootMul = 1 }) {
    this.map = map; this.world = world; this.nav = nav; this.seed = seed; this.mode = mode;
    this.squadSize = MODES[mode] ? MODES[mode].squad : 1;
    this.timeScale = timeScale;
    this.rng = new Rng(seed);
    this.tick = 0; this.time = 0;
    this.phase = 'lobby';  // lobby | plane | live | ended
    this.players = new Map();
    this.list = [];        // dense array (index = p.idx)
    this.squads = new Map();
    this.items = new Map();
    this.itemGrid = new Map();
    this.nextItem = 1;
    this.proj = new Map(); this.nextProj = 1;
    this.smokes = [];
    this.crates = [];
    this.noises = [];
    this.events = [];
    this.terminals = map.terminals.map((t, i) => ({ id: i, x: t.x, y: t.y, z: t.z, poi: t.poi, hackedBy: -1 }));
    this.zone = new Zone(seed, timeScale, (x, z) => map.heightAt(x, z) > map.water + 0.5);
    this.hist = Array.from({ length: HIST }, () => ({ tick: -1, data: null }));
    this.botFactory = botFactory;
    this.lootMul = lootMul;
    this.winner = -1;
    this.endTick = -1;
    this.spawnLoot();
    this.vehicles = new Map();
    this.airdrops = [];
    spawnVehicles(this);
    this._ray = { kind: null, box: -1, nx: 0, ny: 0, nz: 0 };
  }

  // ------------------------------------------------------------------ setup
  addPlayer({ id, name, squad, bot = false, cos = null, skill = 0.5, human = !bot }) {
    const p = {
      id, idx: this.list.length, name, squad, bot, human, cos: cos || {}, skill,
      m: createMoveState(0, PLANE.alt, 0), yaw: 0, pitch: 0,
      alive: true, hp: PLAYER.maxHp, boost: 0, bleed: 0, knocks: 0, knockedBy: null,
      inv: emptyInventory(), act: null, fire: { cd: 0, bloom: 0, lastShot: -99, shots: 0 },
      inputs: [], lastSeq: 0, lastInput: { mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: 0, viewTick: 0, seq: 0 }, idle: 0,
      stats: { kills: 0, knocks: 0, dmg: 0, revives: 0, hacks: 0, heads: 0, longest: 0, assists: 0, survived: 0 },
      dmgBy: new Map(), place: 0, killer: null, spectate: -1, invDirty: true, deathTick: -1, landed: false,
      lastHurt: -99, connected: true,
    };
    p.m.mode = MODE.WAITING;
    this.players.set(id, p);
    this.list.push(p);
    if (!this.squads.has(squad)) this.squads.set(squad, { id: squad, members: [], alive: true, place: 0 });
    this.squads.get(squad).members.push(id);
    if (bot && this.botFactory) p.brain = this.botFactory(this, p);
    return p;
  }

  start() {
    // Plane path across the valley.
    const a = this.rng.range(0, Math.PI * 2);
    const off = this.rng.range(-180, 180);
    const dx = Math.cos(a), dz = Math.sin(a);
    const sx = -dx * PLANE.edge - dz * off, sz = -dz * PLANE.edge + dx * off;
    this.plane = { sx, sz, dx, dz, len: PLANE.edge * 2, t: 0, x: sx, z: sz, active: true };
    for (const p of this.list) {
      p.m.mode = MODE.PLANE; p.m.x = sx; p.m.z = sz; p.m.y = PLANE.alt;
      p.yaw = Math.atan2(-dx, -dz);
    }
    this.phase = 'plane';
    this.startTick = this.tick;
    this.emit({ e: 'phase', phase: 'plane' });
  }

  spawnLoot() {
    const rng = new Rng(this.seed ^ 0x10075);
    for (const s of this.map.lootSpots) {
      const rolls = s.tier >= 3 ? 2 : 1;
      for (let r = 0; r < rolls; r++) {
        if (rng.next() > 0.82 * this.lootMul) continue;
        const items = rollLoot(rng, s.tier);
        items.forEach((it, i) => this.addItem(it, s.x + rng.range(-0.35, 0.35) + i * 0.25, s.y + 0.02, s.z + rng.range(-0.35, 0.35), false));
      }
    }
  }

  // ------------------------------------------------------------------ items
  addItem(it, x, y, z, announce = true) {
    if (it.k === 'weapon' && it.mag === undefined) { it.mag = WEAPONS[it.id].mag; it.att = { optic: null, mag: null, muzzle: null, grip: null }; }
    const gi = { id: this.nextItem++, x, y, z, it };
    this.items.set(gi.id, gi);
    const key = gridKey(x, z);
    let cell = this.itemGrid.get(key);
    if (!cell) this.itemGrid.set(key, cell = new Set());
    cell.add(gi.id);
    if (announce) this.emit({ e: 'item', id: gi.id, x: r2(x), y: r2(y), z: r2(z), it });
    return gi;
  }
  removeItem(id) {
    const gi = this.items.get(id);
    if (!gi) return;
    this.items.delete(id);
    const cell = this.itemGrid.get(gridKey(gi.x, gi.z));
    if (cell) cell.delete(id);
    this.emit({ e: 'pick', id });
  }
  itemsNear(x, z, r, fn) {
    const c0 = Math.floor((x - r + 600) / 16), c1 = Math.floor((x + r + 600) / 16);
    const d0 = Math.floor((z - r + 600) / 16), d1 = Math.floor((z + r + 600) / 16);
    for (let j = d0; j <= d1; j++) for (let i = c0; i <= c1; i++) {
      const cell = this.itemGrid.get(j * 1000 + i);
      if (!cell) continue;
      for (const id of cell) { const gi = this.items.get(id); if (gi && Math.hypot(gi.x - x, gi.z - z) <= r) fn(gi); }
    }
  }

  // ------------------------------------------------------------------ inputs & commands
  queueInput(pid, inp) {
    const p = this.players.get(pid);
    if (!p || p.bot) return;
    if (p.inputs.length > 12) p.inputs.shift();
    p.inputs.push(inp);
  }

  command(pid, c) {
    const p = this.players.get(pid);
    if (!p || !c || typeof c !== 'object') return;
    if (!p.alive) { if (c.c === 'spectate') this.cycleSpectate(p, c.d | 0); return; }
    const knocked = p.m.mode === MODE.KNOCKED;
    switch (c.c) {
      case 'pickup': if (!knocked) this.tryPickup(p, c.id | 0); break;
      case 'enter': if (!knocked) enterVehicle(this, p, c.id | 0); break;
      case 'exit': if (p.vehicle) exitVehicle(this, p); break;
      case 'slot': if (!knocked) this.switchSlot(p, c.s | 0); break;
      case 'use': if (!knocked) this.startHeal(p, c.id); break;
      case 'thr': if (THROWS[c.id]) { p.inv.thrSel = c.id; p.invDirty = true; } break;
      case 'firemode': { const w = this.activeWeapon(p); if (w && (WEAPONS[w.id].auto || WEAPONS[w.id].burst)) { w.semi = !w.semi; p.invDirty = true; } break; }
      case 'drop': if (!knocked) this.drop(p, c); break;
      case 'attach': this.attach(p, c.i | 0, c.s | 0); break;
      case 'detach': this.detach(p, c.s | 0, String(c.t)); break;
      case 'ping': this.ping(p, c); break;
      case 'cancel': if (p.act && p.act.k !== ACT.revived) p.act = null; break;
    }
  }

  // ------------------------------------------------------------------ main tick
  step() {
    this.tick++; this.time += DT;
    const ev = this.events;
    if (this.phase === 'plane' || this.phase === 'live') this.updatePlane();
    if (this.phase === 'live' || this.phase === 'plane') {
      for (const p of this.list) {
        if (!p.alive) { this.updateDead(p); continue; }
        if (p.bot) {
          const inp = p.brain ? p.brain.think() : neutralInput(p);
          this.processInput(p, inp);
        } else {
          let n = p.inputs.length > 3 ? 2 : p.inputs.length > 0 ? 1 : 0;
          if (n === 0) {
            p.idle++;
            if (p.idle > 6) this.processInput(p, { ...p.lastInput, buttons: p.lastInput.buttons & (BTN.CROUCH), mx: 0, mz: 0, seq: p.lastSeq, idle: true });
          }
          while (n-- > 0) { p.idle = 0; this.processInput(p, p.inputs.shift()); }
        }
        this.updateStatus(p);
      }
      stepVehicles(this);
      stepAirdrops(this);
      this.updateProjectiles();
      this.updateZone();
      this.checkEnd();
    } else if (this.phase === 'ended') {
      for (const p of this.list) if (p.bot && p.alive && p.brain) this.processInput(p, { ...neutralInput(p) });
    }
    this.recordHistory();
    if (this.noises.length && this.noises[0].tick < this.tick - TICK_RATE * 2) this.noises = this.noises.filter(n => n.tick >= this.tick - TICK_RATE * 2);
    return ev;
  }

  drainEvents() { const e = this.events; this.events = []; return e; }
  emit(e) { e.tick = this.tick; this.events.push(e); }

  updatePlane() {
    const pl = this.plane;
    if (!pl || !pl.active) return;
    pl.t += DT;
    const d = pl.t * PLANE.speed;
    pl.x = pl.sx + pl.dx * d; pl.z = pl.sz + pl.dz * d;
    const eject = d > pl.len * 0.86;
    for (const p of this.list) {
      if (p.m.mode !== MODE.PLANE) continue;
      p.m.x = pl.x; p.m.z = pl.z; p.m.y = PLANE.alt;
      if (eject && (p.idx % 6) * 0.25 < (d - pl.len * 0.86) / PLANE.speed + 0.01) this.leavePlane(p);
    }
    if (d > pl.len) {
      pl.active = false;
      for (const p of this.list) if (p.m.mode === MODE.PLANE) this.leavePlane(p);
    }
    if (this.phase === 'plane' && this.list.every(p => p.m.mode !== MODE.PLANE)) { this.phase = 'live'; this.emit({ e: 'phase', phase: 'live' }); }
  }

  leavePlane(p) {
    const pl = this.plane;
    p.m.mode = MODE.FREEFALL; p.m.airT = 0;
    p.m.x = pl.x + this.rng.range(-3, 3); p.m.z = pl.z + this.rng.range(-3, 3); p.m.y = PLANE.alt - 4;
    p.m.vx = pl.dx * PLANE.speed * 0.25; p.m.vz = pl.dz * PLANE.speed * 0.25; p.m.vy = -8;
    this.emit({ e: 'jump', p: p.id });
  }

  processInput(p, inp) {
    if (!inp) return;
    p.lastInput = inp;
    p.lastSeq = inp.seq >>> 0;
    p.yaw = Number.isFinite(inp.yaw) ? inp.yaw : p.yaw;
    p.pitch = clamp(Number.isFinite(inp.pitch) ? inp.pitch : 0, -1.55, 1.55);
    const prev = p.m.pb;
    const b = inp.buttons | 0;
    const pressed = b & ~prev;
    if (p.m.mode === MODE.PLANE) {
      p.m.pb = b;
      if ((pressed & BTN.JUMP) && this.plane && this.plane.t > 1.2) this.leavePlane(p);
      return;
    }
    if (p.m.mode === MODE.VEHICLE) {
      p.m.pb = b;
      if (p.seat === 0) { if (!inp.idle) driveInput(this, p, inp); }
      else { if ((pressed & BTN.RELOAD)) this.startReload(p); this.handleFire(p, inp, b, pressed); this.updateAct(p); }
      return;
    }
    const wasMode = p.m.mode;
    const w = this.activeWeapon(p);
    const mods = { speedMul: (p.boost >= 60 ? 1.05 : 1) * (w && WEAPONS[w.id].slowMul ? WEAPONS[w.id].slowMul : 1), noSprint: false, slow: 0 };
    if (p.act && p.act.k === ACT.heal) mods.slow = 2.2;
    if (p.act && (p.act.k === ACT.revive || p.act.k === ACT.hack)) mods.slow = 0.01;
    const mx = clamp(+inp.mx || 0, -1, 1), mz = clamp(+inp.mz || 0, -1, 1);
    stepMove(p.m, { mx, mz, yaw: p.yaw, pitch: p.pitch, buttons: b }, this.world, DT, mods);
    if ((wasMode === MODE.FREEFALL || wasMode === MODE.CHUTE) && p.m.mode === MODE.GROUND) { p.landed = true; this.emit({ e: 'land', p: p.id }); }
    if (p.m.impact < -13.5) {
      const dmg = (-p.m.impact - 13.5) * 7;
      this.applyDamage(p, null, dmg, 'fall', 'fall');
      this.emit({ e: 'fall', p: p.id, d: r2(dmg) });
    }
    if (!p.alive) return;

    // Hold-to-use: revive a knocked teammate or hack a terminal.
    if (p.m.mode === MODE.GROUND && (b & BTN.USE)) this.holdUse(p);
    else if (p.act && (p.act.k === ACT.revive || p.act.k === ACT.hack)) this.cancelAct(p);

    if (p.m.mode === MODE.GROUND && !p.m.crouch && false) { /* reserved */ }
    if ((pressed & BTN.RELOAD) && p.m.mode === MODE.GROUND) this.startReload(p);
    this.handleFire(p, inp, b, pressed);
    this.updateAct(p);
  }

  // ------------------------------------------------------------------ weapons
  activeWeapon(p) { return p.inv.slot < 3 ? p.inv.w[p.inv.slot] : null; }

  handleFire(p, inp, b, pressed) {
    const f = p.fire;
    f.cd -= DT;
    f.bloom = Math.max(0, f.bloom - DT * 3.5);
    if (p.m.mode !== MODE.GROUND && !(p.m.mode === MODE.VEHICLE && p.seat === 1)) { if (f.cd < 0) f.cd = 0; return; }
    if (p.inv.slot === 3) {
      if ((pressed & BTN.FIRE) && !p.act) this.throwNade(p);
      if (f.cd < 0) f.cd = 0;
      return;
    }
    const w = this.activeWeapon(p);
    const bursting = w && (f.burst | 0) > 0;
    if (!w || (!(b & BTN.FIRE) && !bursting)) { f.burst = 0; if (f.cd < 0) f.cd = 0; return; }
    if (p.act && p.act.k === ACT.heal) this.cancelAct(p);
    if (p.act) { if (f.cd < 0) f.cd = 0; return; }
    const def = WEAPONS[w.id];
    const auto = def.auto && !w.semi;
    const burst = def.burst && !w.semi;
    if (burst) {
      if ((pressed & BTN.FIRE) && (f.burst | 0) <= 0 && w.mag > 0) f.burst = def.burst;
      if ((f.burst | 0) <= 0) { if (pressed & BTN.FIRE && w.mag <= 0) { this.emit({ e: 'dry', p: p.id }); this.startReload(p); } if (f.cd < 0) f.cd = 0; return; }
    } else if (!auto && !(pressed & BTN.FIRE)) { if (f.cd < 0) f.cd = 0; return; }
    if (w.mag <= 0) {
      if (pressed & BTN.FIRE) { this.emit({ e: 'dry', p: p.id }); this.startReload(p); }
      if (f.cd < 0) f.cd = 0;
      return;
    }
    let shotsThisTick = 0;
    while (f.cd <= 0 && w.mag > 0 && shotsThisTick < 3) {
      this.shoot(p, w, inp, shotsThisTick);
      f.cd += 60 / def.rpm;
      shotsThisTick++;
      if (burst) { f.burst--; if (f.burst <= 0) { f.cd += 0.12; break; } continue; }
      if (!auto) break;
    }
    if (w.mag <= 0 && p.inv.ammo[def.ammo] > 0 && p.bot) this.startReload(p);
  }

  shoot(p, w, inp, sub) {
    const def = WEAPONS[w.id];
    w.mag--;
    p.invDirty = true;
    const f = p.fire;
    f.lastShot = this.tick; f.shots++;
    const eh = eyeHeight(p.m);
    const ox = p.m.x, oy = p.m.y + eh, oz = p.m.z;
    const ads = !!(inp.buttons & BTN.ADS);
    let spread = ads ? def.ads : def.hip;
    const hs = Math.hypot(p.m.vx, p.m.vz);
    spread += Math.min(1, hs / 5) * (ads ? 0.6 : 1.6);
    if (p.m.crouch) spread *= 0.8;
    if (w.att && w.att.grip) spread *= 0.9;
    spread += f.bloom * (w.att && w.att.grip ? 0.75 : 1);
    if (!p.m.grounded) spread += 3;
    f.bloom = Math.min(f.bloom + def.bloom, 4);
    const pellets = def.pellets || 1;
    const viewTick = p.bot ? this.tick : clamp(+inp.viewTick || this.tick, this.tick - LAG_COMP_TICKS, this.tick);
    const targets = this.rewound(viewTick, p);
    const hits = [];
    const seq = inp.seq >>> 0;
    const ray = this._ray;
    for (let k = 0; k < pellets; k++) {
      const u = hash3(p.id * 7 + 1, seq, k * 4 + sub * 64 + 1), v = hash3(p.id * 7 + 2, seq, k * 4 + sub * 64 + 2);
      const rr = spread * Math.sqrt(u) * D2R * 0.5, th = v * Math.PI * 2;
      const d = viewDir(p.yaw + Math.cos(th) * rr, p.pitch + Math.sin(th) * rr);
      const maxR = 900;
      const tw = this.world.raycast(ox, oy, oz, d[0], d[1], d[2], maxR, ray);
      let best = tw, victim = null, zone = null;
      for (const t of targets) {
        const r = hitTest(ox, oy, oz, d[0], d[1], d[2], t, best);
        if (r && r.t < best) { best = r.t; victim = t.p; zone = r.zone; }
      }
      const vh = rayVehicles(this, ox, oy, oz, d[0], d[1], d[2], best);
      let hitVeh = null;
      if (vh && vh.v.id !== p.vehicle && vh.t < best) { best = vh.t; victim = null; hitVeh = vh.v; }
      const ex = ox + d[0] * Math.min(best, maxR), ey = oy + d[1] * Math.min(best, maxR), ez = oz + d[2] * Math.min(best, maxR);
      if (hitVeh) {
        damageVehicle(this, hitVeh, def.dmg * 0.55, p);
        hits.push([r2(ex), r2(ey), r2(ez), 1, 'metal']);
      } else if (victim) {
        const dist = best;
        const fall = dist <= def.r0 ? 1 : dist >= def.r1 ? def.minMul : 1 - (1 - def.minMul) * (dist - def.r0) / (def.r1 - def.r0);
        const mul = zone === 'head' ? def.head : zone === 'limb' ? def.limb : 1;
        const dealt = this.applyDamage(victim, p, def.dmg * fall * mul, zone, w.id);
        if (zone === 'head' && dealt > 0) p.stats.heads++;
        hits.push([r2(ex), r2(ey), r2(ez), 2, victim.id]);
      } else if (best < Infinity) {
        const surf = ray.kind === 'terrain' ? this.world.surfaceAt(ex, ez) : MAT_SURFACE[this.world.mat[ray.box]];
        hits.push([r2(ex), r2(ey), r2(ez), 1, surf]);
      } else hits.push([r2(ex), r2(ey), r2(ez), 0, 0]);
    }
    const sup = !!(w.att && w.att.muzzle === 'suppressor');
    this.emit({ e: 'shot', p: p.id, w: w.id, o: [r2(ox), r2(oy), r2(oz)], h: hits, s: sup ? 1 : 0, q: seq });
    this.noises.push({ x: ox, y: oy, z: oz, r: sup ? 45 : (def.cls === 'pistol' || def.cls === 'smg' ? 220 : 340), tick: this.tick, p: p.id, sq: p.squad, kind: 'shot' });
  }

  startReload(p) {
    const w = this.activeWeapon(p);
    if (p.act && p.act.k === ACT.equip) p.act = null;
    if (!w || p.act) return;
    const def = WEAPONS[w.id];
    if (w.mag >= magSize(w) || p.inv.ammo[def.ammo] <= 0) return;
    p.act = { k: ACT.reload, t: 0, dur: def.reload, slot: p.inv.slot };
    this.emit({ e: 'reload', p: p.id, w: w.id });
  }

  switchSlot(p, s) {
    if (s < 0 || s > 3) return;
    if (s === 3 && p.inv.thr.frag + p.inv.thr.smoke <= 0) return;
    if (s < 3 && !p.inv.w[s]) return;
    if (p.inv.slot === s) return;
    if (p.act && p.act.k !== ACT.revive) this.cancelAct(p);
    p.inv.slot = s; p.invDirty = true;
    const w = this.activeWeapon(p);
    p.act = { k: ACT.equip, t: 0, dur: w ? WEAPONS[w.id].equip : 0.35 };
    p.fire.cd = Math.max(p.fire.cd, 0);
  }

  startHeal(p, id) {
    const h = HEALS[id];
    if (p.act && (p.act.k === ACT.equip || p.act.k === ACT.reload)) p.act = null;
    if (!h || p.inv.heal[id] <= 0 || p.act || p.m.mode !== MODE.GROUND) return;
    if (h.cap && p.hp >= h.cap) { this.emit({ e: 'msg', to: p.id, m: p.hp >= 100 ? 'Health is full' : `${h.name} only heals to ${h.cap}` }); return; }
    if (h.boost && p.boost >= 100) return;
    p.act = { k: ACT.heal, t: 0, dur: h.time, id };
    this.emit({ e: 'heal', p: p.id, id });
  }

  cancelAct(p) { if (p.act) { p.act = null; } }

  updateAct(p) {
    const a = p.act;
    if (!a || a.k === ACT.revived) return;
    a.t += DT;
    if (a.k === ACT.reload && a.slot !== p.inv.slot) { p.act = null; return; }
    if (a.t < a.dur) return;
    p.act = null;
    if (a.k === ACT.reload) {
      const w = this.activeWeapon(p);
      if (!w) return;
      const def = WEAPONS[w.id];
      const need = magSize(w) - w.mag;
      const got = Math.min(need, p.inv.ammo[def.ammo]);
      w.mag += got; p.inv.ammo[def.ammo] -= got; p.invDirty = true;
    } else if (a.k === ACT.heal) {
      const h = HEALS[a.id];
      if (p.inv.heal[a.id] <= 0) return;
      p.inv.heal[a.id]--; p.invDirty = true;
      if (h.heal) p.hp = Math.min(h.cap, p.hp + h.heal);
      if (h.boost) p.boost = Math.min(100, p.boost + h.boost);
    } else if (a.k === ACT.revive) {
      const t = this.players.get(a.target);
      if (t && t.alive && t.m.mode === MODE.KNOCKED) {
        t.m.mode = MODE.GROUND; t.hp = 30; t.bleed = 0; t.act = null; t.knockedBy = null;
        p.stats.revives++;
        this.emit({ e: 'revive', v: t.id, a: p.id });
      }
    } else if (a.k === ACT.hack) {
      const term = this.terminals[a.target];
      if (term && term.hackedBy < 0) this.completeHack(p, term);
    }
  }

  holdUse(p) {
    if (p.act && p.act.k === ACT.revive) {
      const t = this.players.get(p.act.target);
      if (!t || !t.alive || t.m.mode !== MODE.KNOCKED || dist3(p.m, t.m) > REVIVE_RANGE + 0.4) this.cancelAct(p);
      return;
    }
    if (p.act && p.act.k === ACT.hack) return;
    if (p.act && p.act.k !== ACT.equip) return;
    // revive?
    const sq = this.squads.get(p.squad);
    for (const id of sq.members) {
      const t = this.players.get(id);
      if (t !== p && t.alive && t.m.mode === MODE.KNOCKED && dist3(p.m, t.m) <= REVIVE_RANGE) {
        p.act = { k: ACT.revive, t: 0, dur: REVIVE_TIME, target: t.id };
        t.act = { k: ACT.revived, t: 0, dur: REVIVE_TIME, target: p.id };
        return;
      }
    }
    for (const term of this.terminals) {
      if (term.hackedBy >= 0) continue;
      if (Math.hypot(p.m.x - term.x, p.m.z - term.z) < 1.9 && Math.abs(p.m.y - term.y) < 1.5) {
        p.act = { k: ACT.hack, t: 0, dur: HACK_TIME, target: term.id };
        this.emit({ e: 'hacking', p: p.id, x: r2(term.x), y: r2(term.y), z: r2(term.z) });
        this.noises.push({ x: term.x, y: term.y, z: term.z, r: 200, tick: this.tick, p: p.id, sq: p.squad, kind: 'hack' });
        return;
      }
    }
  }

  completeHack(p, term) {
    term.hackedBy = p.squad;
    p.stats.hacks++;
    const nxt = this.zone.peek(1);
    const enemies = [];
    for (const o of this.list) if (o.alive && o.squad !== p.squad && Math.hypot(o.m.x - term.x, o.m.z - term.z) < 150) enemies.push([r2(o.m.x), r2(o.m.z)]);
    this.emit({ e: 'intel', to: { sq: p.squad }, p: p.id, term: term.id, c: nxt ? { x: r2(nxt.x), z: r2(nxt.z), r: nxt.r } : null, en: enemies });
    this.emit({ e: 'hacked', term: term.id, sq: p.squad });
  }

  throwNade(p) {
    const id = p.inv.thrSel;
    if (p.inv.thr[id] <= 0) { const other = id === 'frag' ? 'smoke' : 'frag'; if (p.inv.thr[other] > 0) p.inv.thrSel = other; else return; }
    const kind = p.inv.thrSel;
    p.inv.thr[kind]--; p.invDirty = true;
    const d = viewDir(p.yaw, p.pitch + 0.12);
    const eh = eyeHeight(p.m);
    const sp = 20;
    const pr = { id: this.nextProj++, k: kind, owner: p.id, x: p.m.x + d[0] * 0.5, y: p.m.y + eh, z: p.m.z + d[2] * 0.5,
      vx: d[0] * sp + p.m.vx * 0.5, vy: d[1] * sp + 1.5, vz: d[2] * sp + p.m.vz * 0.5, fuse: kind === 'frag' ? 3.6 : 2.2, rest: false };
    this.proj.set(pr.id, pr);
    p.fire.cd = 0.8;
    this.emit({ e: 'throw', p: p.id, k: kind });
    if (p.inv.thr.frag + p.inv.thr.smoke <= 0) { p.inv.slot = p.inv.w[0] ? 0 : p.inv.w[1] ? 1 : 2; }
  }

  updateProjectiles() {
    const ray = this._ray;
    for (const pr of this.proj.values()) {
      pr.fuse -= DT;
      if (!pr.rest) {
        pr.vy -= GRAVITY * 0.75 * DT;
        const sp = Math.hypot(pr.vx, pr.vy, pr.vz);
        if (sp > 0.01) {
          const dx = pr.vx / sp, dy = pr.vy / sp, dz = pr.vz / sp;
          const t = this.world.raycast(pr.x, pr.y, pr.z, dx, dy, dz, sp * DT + 0.08, ray);
          if (t < Infinity) {
            pr.x += dx * Math.max(0, t - 0.08); pr.y += dy * Math.max(0, t - 0.08); pr.z += dz * Math.max(0, t - 0.08);
            const n = [ray.nx, ray.ny, ray.nz];
            const vn = pr.vx * n[0] + pr.vy * n[1] + pr.vz * n[2];
            pr.vx = (pr.vx - 2 * vn * n[0]) * 0.4; pr.vy = (pr.vy - 2 * vn * n[1]) * 0.35; pr.vz = (pr.vz - 2 * vn * n[2]) * 0.4;
            if (Math.hypot(pr.vx, pr.vy, pr.vz) < 1.2 && n[1] > 0.5) { pr.rest = true; pr.vx = pr.vy = pr.vz = 0; }
          } else { pr.x += pr.vx * DT; pr.y += pr.vy * DT; pr.z += pr.vz * DT; }
        }
        const gh = this.world.heightAt(pr.x, pr.z);
        if (pr.y < gh + 0.05) { pr.y = gh + 0.05; pr.vy = Math.abs(pr.vy) * 0.3; pr.vx *= 0.5; pr.vz *= 0.5; if (Math.hypot(pr.vx, pr.vy, pr.vz) < 1.2) { pr.rest = true; pr.vx = pr.vy = pr.vz = 0; } }
      }
      if (pr.fuse <= 0) {
        this.proj.delete(pr.id);
        if (pr.k === 'frag') this.explode(pr);
        else {
          const s = { id: pr.id, x: pr.x, y: pr.y, z: pr.z, until: this.tick + 20 * TICK_RATE };
          this.smokes.push(s);
          this.emit({ e: 'smoke', id: pr.id, x: r2(pr.x), y: r2(pr.y), z: r2(pr.z), dur: 20 });
        }
      }
    }
    if (this.smokes.length && this.smokes[0].until < this.tick) this.smokes = this.smokes.filter(s => s.until >= this.tick);
  }

  explode(pr) {
    this.emit({ e: 'boom', x: r2(pr.x), y: r2(pr.y), z: r2(pr.z) });
    this.noises.push({ x: pr.x, y: pr.y, z: pr.z, r: 300, tick: this.tick, p: pr.owner, kind: 'boom' });
    const owner = this.players.get(pr.owner);
    const R = 7.5;
    for (const v of this.list) {
      if (!v.alive) continue;
      const cy = v.m.y + bodyHeight(v.m) * 0.55;
      const d = Math.hypot(v.m.x - pr.x, cy - pr.y, v.m.z - pr.z);
      if (d > R) continue;
      if (!this.world.los(pr.x, pr.y + 0.3, pr.z, v.m.x, cy, v.m.z)) continue;
      const dmg = 135 * Math.pow(1 - d / R, 1.25);
      if (owner && owner.squad === v.squad && owner !== v) continue;
      this.applyDamage(v, owner && owner !== v ? owner : null, dmg, 'blast', 'frag', owner === v ? owner : null);
    }
  }

  // ------------------------------------------------------------------ damage
  applyDamage(v, a, raw, zone, src, selfInflict = null) {
    if (!v.alive || raw <= 0) return 0;
    if (a && a !== v && a.squad === v.squad) return 0;
    let dmg = raw;
    let broke = null;
    const armorOf = zone === 'head' ? 'helmet' : (zone === 'torso' || zone === 'blast') ? 'vest' : null;
    if (armorOf && v.inv[armorOf]) {
      const ar = v.inv[armorOf];
      const red = ARMOR[armorOf][ar.tier].red * (zone === 'blast' ? 0.6 : 1);
      dmg = raw * (1 - red);
      ar.dur -= raw * 0.7;
      if (ar.dur <= 0) { v.inv[armorOf] = null; broke = armorOf; }
      v.invDirty = true;
    }
    v.lastHurt = this.tick;
    let dealt;
    if (v.m.mode === MODE.KNOCKED) {
      dealt = Math.min(dmg, v.bleed);
      v.bleed -= dmg;
      if (a) v.dmgBy.set(a.id, this.tick);
      if (v.bleed <= 0) this.kill(v, a || this.players.get(v.knockedBy) || null, src, zone === 'head');
    } else {
      dealt = Math.min(dmg, v.hp);
      v.hp -= dmg;
      if (a) v.dmgBy.set(a.id, this.tick);
      if (v.hp <= 0) {
        v.hp = 0;
        if (this.canKnock(v)) this.knock(v, a, src);
        else this.kill(v, a, src, zone === 'head');
      }
    }
    if (a) { a.stats.dmg += dealt; if (a.brain) a.brain.lastHitTarget = this.tick; }
    if (src !== 'zone' && src !== 'bleed') {
      const hit = { e: 'hit', to: [v.id], v: v.id, d: Math.round(dmg), z: zone, b: broke, src };
      if (a) { hit.to.push(a.id); hit.a = a.id; hit.ax = r2(a.m.x); hit.az = r2(a.m.z); }
      this.emit(hit);
    }
    if (v.act && v.act.k === ACT.heal && src !== 'zone') { /* healing continues; realistic flinch only */ }
    return dealt;
  }

  canKnock(v) {
    if (this.squadSize <= 1) return false;
    const sq = this.squads.get(v.squad);
    return sq.members.some(id => { const o = this.players.get(id); return o !== v && o.alive && o.m.mode !== MODE.KNOCKED; });
  }

  knock(v, a, src) {
    if (v.vehicle) exitVehicle(this, v, true);
    v.m.mode = MODE.KNOCKED; v.m.crouch = false;
    v.knocks++; v.bleed = 100; v.knockedBy = a ? a.id : null; v.act = null;
    if (a) a.stats.knocks++;
    this.emit({ e: 'knock', v: v.id, a: a ? a.id : -1, w: src });
    // cancel any revive on this player
    for (const o of this.list) if (o.act && o.act.k === ACT.revive && o.act.target === v.id) o.act = null;
    this.checkSquad(v.squad);
  }

  kill(v, a, src, head = false) {
    if (!v.alive) return;
    if (v.vehicle) exitVehicle(this, v, true);
    v.alive = false; v.m.mode = MODE.DEAD; v.act = null; v.hp = 0; v.bleed = 0;
    v.deathTick = this.tick;
    v.stats.survived = (this.tick - (this.startTick || 0)) * DT;
    const killer = a && a !== v ? a : null;
    if (killer) {
      killer.stats.kills++;
      const d = Math.hypot(killer.m.x - v.m.x, killer.m.z - v.m.z);
      if (d > killer.stats.longest) killer.stats.longest = Math.round(d);
    }
    v.killer = killer ? killer.id : null;
    for (const [pid, t] of v.dmgBy) {
      if (killer && pid === killer.id) continue;
      if (this.tick - t < 15 * TICK_RATE) { const o = this.players.get(pid); if (o && o.squad !== v.squad) o.stats.assists++; }
    }
    for (const o of this.list) if (o.act && (o.act.target === v.id) && o.act.k === ACT.revive) o.act = null;
    this.dropAll(v);
    this.emit({ e: 'kill', v: v.id, a: killer ? killer.id : -1, w: src, hs: head ? 1 : 0, d: killer ? Math.round(Math.hypot(killer.m.x - v.m.x, killer.m.z - v.m.z)) : 0 });
    v.spectate = this.pickSpectate(v);
    this.checkSquad(v.squad);
  }

  checkSquad(sqId) {
    const sq = this.squads.get(sqId);
    if (!sq || !sq.alive) return;
    const living = sq.members.map(id => this.players.get(id)).filter(p => p.alive);
    if (living.length && living.some(p => p.m.mode !== MODE.KNOCKED)) return;
    // Everyone left is knocked: they all bleed out now.
    sq.alive = false;
    for (const p of living) this.kill(p, this.players.get(p.knockedBy) || null, 'bleed');
    const left = [...this.squads.values()].filter(s => s.alive).length;
    sq.place = left + 1;
    for (const id of sq.members) { const p = this.players.get(id); p.place = sq.place; }
    this.emit({ e: 'elim', sq: sqId, place: sq.place });
  }

  checkEnd() {
    if (this.phase !== 'live' && this.phase !== 'plane') return;
    const alive = [...this.squads.values()].filter(s => s.alive);
    if (alive.length > 1) return;
    this.phase = 'ended';
    this.endTick = this.tick;
    let win = alive[0];
    if (!win) { // everyone died the same tick: the last eliminated squad wins
      win = [...this.squads.values()].sort((a, b) => a.place - b.place)[0];
    }
    win.place = 1;
    this.winner = win.id;
    for (const id of win.members) { const p = this.players.get(id); p.place = 1; if (p.alive) p.stats.survived = (this.tick - (this.startTick || 0)) * DT; }
    this.emit({ e: 'end', winner: win.id, names: win.members.map(id => this.players.get(id).name) });
  }

  updateStatus(p) {
    if (!p.alive) return;
    // bleeding out
    if (p.m.mode === MODE.KNOCKED) {
      const rate = 100 / Math.max(9, 26 - 6 * (p.knocks - 1));
      const beingRevived = p.act && p.act.k === ACT.revived && this.list.some(o => o.act && o.act.k === ACT.revive && o.act.target === p.id);
      if (!beingRevived) {
        if (p.act && p.act.k === ACT.revived) p.act = null;
        p.bleed -= rate * DT;
        if (p.bleed <= 0) { this.kill(p, this.players.get(p.knockedBy) || null, 'bleed'); return; }
      } else p.act.t += DT;
    }
    // boost regen
    if (p.boost > 0) {
      p.boost = Math.max(0, p.boost - DT * 1.6);
      if (p.m.mode !== MODE.KNOCKED && p.hp < 100) p.hp = Math.min(100, p.hp + DT * (p.boost > 60 ? 1.6 : 0.8));
    }
    // ash
    if (this.phase === 'live' && this.zone.outside(p.m.x, p.m.z) && p.m.mode !== MODE.PLANE) {
      const dmg = this.zone.dmg * DT;
      if (p.m.mode === MODE.KNOCKED) { p.bleed -= dmg * 2; if (p.bleed <= 0) this.kill(p, this.players.get(p.knockedBy) || null, 'zone'); }
      else this.applyDamage(p, null, dmg, 'zone', 'zone');
    }
  }

  updateDead(p) {
    if (p.spectate >= 0) { const t = this.players.get(p.spectate); if (!t || !t.alive) p.spectate = this.pickSpectate(p); }
  }

  pickSpectate(p) {
    const sq = this.squads.get(p.squad);
    for (const id of sq.members) { const o = this.players.get(id); if (o !== p && o.alive) return o.id; }
    if (p.killer !== null && p.killer !== undefined) { const k = this.players.get(p.killer); if (k && k.alive) return k.id; }
    const any = this.list.find(o => o.alive);
    return any ? any.id : -1;
  }

  cycleSpectate(p, dir) {
    const alive = this.list.filter(o => o.alive);
    if (!alive.length) return;
    let i = alive.findIndex(o => o.id === p.spectate);
    i = (i + (dir >= 0 ? 1 : -1) + alive.length) % alive.length;
    p.spectate = alive[i].id;
  }

  updateZone() {
    if (this.phase !== 'live' && this.phase !== 'plane') return;
    const ev = this.zone.update(DT);
    if (ev) this.emit({ e: 'zone', ev, ...this.zoneInfo() });
    if (ev === 'wait' && [1, 3, 5].includes(this.zone.phase)) scheduleAirdrop(this);
  }

  zoneInfo() {
    const z = this.zone;
    return { phase: z.phase, state: z.state, timer: r2(z.timer), cur: { x: r2(z.cur.x), z: r2(z.cur.z), r: r2(z.cur.r) }, next: { x: r2(z.next.x), z: r2(z.next.z), r: r2(z.next.r) } };
  }

  // ------------------------------------------------------------------ inventory
  tryPickup(p, id, replaceSlot = -1) {
    const gi = this.items.get(id);
    if (!gi || p.m.mode !== MODE.GROUND) return false;
    const eh = eyeHeight(p.m);
    if (Math.hypot(gi.x - p.m.x, gi.z - p.m.z) > PICKUP_RANGE || gi.y > p.m.y + eh + 0.6 || gi.y < p.m.y - 1.6) return false;
    const it = gi.it, inv = p.inv;
    const cap = PACK_CAP[inv.pack];
    const free = cap - invWeight(inv);
    const ok = () => { this.removeItem(id); p.invDirty = true; this.emit({ e: 'got', to: p.id, it }); return true; };
    const full = () => { this.emit({ e: 'msg', to: p.id, m: 'Backpack is full' }); return false; };
    switch (it.k) {
      case 'weapon': {
        const def = WEAPONS[it.id];
        const w = { id: it.id, mag: it.mag | 0, att: it.att ? { ...it.att } : { optic: null, mag: null, muzzle: null, grip: null }, semi: false };
        let slot;
        if (def.slot === 'side') slot = 2;
        else if (!inv.w[0]) slot = 0;
        else if (!inv.w[1]) slot = 1;
        else slot = replaceSlot === 0 || replaceSlot === 1 ? replaceSlot : inv.slot < 2 ? inv.slot : 0;
        const old = inv.w[slot];
        this.removeItem(id);
        if (old) this.addItem({ k: 'weapon', id: old.id, mag: old.mag, att: old.att }, p.m.x, p.m.y + 0.02, p.m.z);
        inv.w[slot] = w;
        this.mountFromBag(p, w);
        if (!this.activeWeapon(p) || inv.slot === slot || inv.slot === 3) { inv.slot = slot; p.act = { k: ACT.equip, t: 0, dur: def.equip }; }
        if (p.act && p.act.k === ACT.reload) p.act = null;
        p.invDirty = true;
        this.emit({ e: 'got', to: p.id, it });
        return true;
      }
      case 'ammo': {
        const each = AMMO[it.id].w;
        const n = Math.min(it.n, Math.floor(free / each + 1e-6));
        if (n <= 0) return full();
        inv.ammo[it.id] += n;
        if (n < it.n) { it.n -= n; this.emit({ e: 'itemn', id, n: it.n }); p.invDirty = true; this.emit({ e: 'got', to: p.id, it: { ...it, n } }); return true; }
        return ok();
      }
      case 'helmet': case 'vest': {
        const cur = inv[it.k];
        const dur = it.dur !== undefined ? it.dur : ARMOR[it.k][it.tier].dur;
        if (cur && (cur.tier > it.tier || (cur.tier === it.tier && cur.dur >= dur))) { this.emit({ e: 'msg', to: p.id, m: 'You already wear better' }); return false; }
        this.removeItem(id);
        if (cur) this.addItem({ k: it.k, tier: cur.tier, dur: Math.round(cur.dur) }, p.m.x, p.m.y + 0.02, p.m.z);
        inv[it.k] = { tier: it.tier, dur };
        p.invDirty = true; this.emit({ e: 'got', to: p.id, it });
        return true;
      }
      case 'pack': {
        if (inv.pack >= it.tier) { this.emit({ e: 'msg', to: p.id, m: 'You already carry a bigger pack' }); return false; }
        this.removeItem(id);
        if (inv.pack) this.addItem({ k: 'pack', tier: inv.pack }, p.m.x, p.m.y + 0.02, p.m.z);
        inv.pack = it.tier; p.invDirty = true; this.emit({ e: 'got', to: p.id, it });
        return true;
      }
      case 'heal': {
        const h = HEALS[it.id];
        const n = Math.min(it.n, h.max - inv.heal[it.id], Math.floor(free / h.w + 1e-6));
        if (n <= 0) return full();
        inv.heal[it.id] += n;
        if (n < it.n) { it.n -= n; this.emit({ e: 'itemn', id, n: it.n }); p.invDirty = true; return true; }
        return ok();
      }
      case 'throw': {
        const t = THROWS[it.id];
        const n = Math.min(it.n, t.max - inv.thr[it.id], Math.floor(free / t.w + 1e-6));
        if (n <= 0) return full();
        inv.thr[it.id] += n;
        if (inv.thr.frag + inv.thr.smoke === n) inv.thrSel = it.id;
        if (n < it.n) { it.n -= n; this.emit({ e: 'itemn', id, n: it.n }); p.invDirty = true; return true; }
        return ok();
      }
      case 'att': {
        const a = ATTACH[it.id];
        // Mount on the best compatible weapon with a free slot (active first).
        const order = [inv.slot, 0, 1, 2].filter((s, i, arr) => s < 3 && arr.indexOf(s) === i);
        for (const s of order) {
          const w = inv.w[s];
          if (w && canAttach(w.id, it.id) && !w.att[a.type]) { w.att[a.type] = it.id; if (a.type === 'mag') w.mag = Math.min(w.mag, magSize(w)); return ok(); }
        }
        if (free < a.w) return full();
        inv.atts.push(it.id);
        return ok();
      }
    }
    return false;
  }

  mountFromBag(p, w) {
    const inv = p.inv;
    for (let i = inv.atts.length - 1; i >= 0; i--) {
      const id = inv.atts[i], a = ATTACH[id];
      if (canAttach(w.id, id) && !w.att[a.type]) { w.att[a.type] = id; inv.atts.splice(i, 1); }
    }
  }

  attach(p, i, s) {
    const inv = p.inv, id = inv.atts[i], w = inv.w[s];
    if (!id || !w || !canAttach(w.id, id)) return;
    const type = ATTACH[id].type;
    inv.atts.splice(i, 1);
    if (w.att[type]) inv.atts.push(w.att[type]);
    w.att[type] = id;
    if (type === 'mag') w.mag = Math.min(w.mag, magSize(w));
    p.invDirty = true;
  }

  detach(p, s, type) {
    const w = p.inv.w[s];
    if (!w || !w.att || !w.att[type]) return;
    const id = w.att[type];
    w.att[type] = null;
    if (type === 'mag') { const over = w.mag - magSize(w); if (over > 0) { w.mag -= over; p.inv.ammo[WEAPONS[w.id].ammo] += over; } }
    if (invWeight(p.inv) + ATTACH[id].w <= PACK_CAP[p.inv.pack]) p.inv.atts.push(id);
    else this.addItem({ k: 'att', id }, p.m.x, p.m.y + 0.02, p.m.z);
    p.invDirty = true;
  }

  drop(p, c) {
    const inv = p.inv, x = p.m.x, y = p.m.y + 0.02, z = p.m.z;
    switch (c.k) {
      case 'weapon': {
        const s = c.s | 0, w = inv.w[s];
        if (!w) return;
        inv.w[s] = null;
        this.addItem({ k: 'weapon', id: w.id, mag: w.mag, att: w.att }, x, y, z);
        if (inv.slot === s) { inv.slot = inv.w[0] ? 0 : inv.w[1] ? 1 : inv.w[2] ? 2 : 0; p.act = null; }
        break;
      }
      case 'ammo': { const n = Math.min(inv.ammo[c.id] | 0, c.n | 0 || inv.ammo[c.id]); if (n > 0 && AMMO[c.id]) { inv.ammo[c.id] -= n; this.addItem({ k: 'ammo', id: c.id, n }, x, y, z); } break; }
      case 'heal': { const n = Math.min(inv.heal[c.id] | 0, c.n | 0 || 1); if (n > 0 && HEALS[c.id]) { inv.heal[c.id] -= n; this.addItem({ k: 'heal', id: c.id, n }, x, y, z); } break; }
      case 'throw': { const n = Math.min(inv.thr[c.id] | 0, c.n | 0 || 1); if (n > 0 && THROWS[c.id]) { inv.thr[c.id] -= n; this.addItem({ k: 'throw', id: c.id, n }, x, y, z); } break; }
      case 'att': { const i = c.i | 0; const id = inv.atts[i]; if (id) { inv.atts.splice(i, 1); this.addItem({ k: 'att', id }, x, y, z); } break; }
      case 'helmet': case 'vest': { const a = inv[c.k]; if (a) { inv[c.k] = null; this.addItem({ k: c.k, tier: a.tier, dur: Math.round(a.dur) }, x, y, z); } break; }
      default: return;
    }
    p.invDirty = true;
  }

  dropAll(p) {
    const inv = p.inv;
    const items = [];
    for (const w of inv.w) if (w) items.push({ k: 'weapon', id: w.id, mag: w.mag, att: w.att });
    for (const k in inv.ammo) if (inv.ammo[k] > 0) items.push({ k: 'ammo', id: k, n: inv.ammo[k] });
    for (const k in inv.heal) if (inv.heal[k] > 0) items.push({ k: 'heal', id: k, n: inv.heal[k] });
    for (const k in inv.thr) if (inv.thr[k] > 0) items.push({ k: 'throw', id: k, n: inv.thr[k] });
    for (const a of inv.atts) items.push({ k: 'att', id: a });
    if (inv.helmet) items.push({ k: 'helmet', tier: inv.helmet.tier, dur: Math.round(inv.helmet.dur) });
    if (inv.vest) items.push({ k: 'vest', tier: inv.vest.tier, dur: Math.round(inv.vest.dur) });
    if (inv.pack) items.push({ k: 'pack', tier: inv.pack });
    p.inv = emptyInventory();
    p.invDirty = true;
    const gy = Math.max(p.m.y, this.world.heightAt(p.m.x, p.m.z));
    const crate = { x: r2(p.m.x), y: r2(gy), z: r2(p.m.z), name: p.name, id: p.id };
    this.crates.push(crate);
    this.emit({ e: 'crate', ...crate });
    items.forEach((it, i) => {
      const a = i * 2.39996, r = 0.25 + 0.12 * Math.sqrt(i);
      this.addItem(it, p.m.x + Math.cos(a) * r, gy + 0.35, p.m.z + Math.sin(a) * r);
    });
  }

  ping(p, c) {
    const x = +c.x, y = +c.y, z = +c.z;
    if (![x, y, z].every(Number.isFinite)) return;
    if (p.lastPing && this.tick - p.lastPing < 10) return;
    p.lastPing = this.tick;
    this.emit({ e: 'ping', to: { sq: p.squad }, p: p.id, x: r2(x), y: r2(y), z: r2(z), k: ['loc', 'enemy', 'item', 'danger'].includes(c.k) ? c.k : 'loc' });
  }

  // ------------------------------------------------------------------ lag compensation
  recordHistory() {
    const h = this.hist[this.tick % HIST];
    if (!h.data || h.data.length !== this.list.length * 5) h.data = new Float32Array(this.list.length * 5);
    h.tick = this.tick;
    const d = h.data;
    for (const p of this.list) {
      const k = p.idx * 5;
      d[k] = p.m.x; d[k + 1] = p.m.y; d[k + 2] = p.m.z; d[k + 3] = p.alive ? bodyHeight(p.m) : 0; d[k + 4] = p.m.mode;
    }
  }

  // Hitboxes of all living players except `shooter`, rewound to viewTick (fractional).
  rewound(viewTick, shooter) {
    const out = [];
    const t0 = Math.floor(viewTick), f = viewTick - t0;
    const a = this.hist[((t0 % HIST) + HIST) % HIST], b = this.hist[(((t0 + 1) % HIST) + HIST) % HIST];
    const okA = a.tick === t0 && a.data, okB = b.tick === t0 + 1 && b.data;
    for (const p of this.list) {
      if (!p.alive || p === shooter || p.m.mode === MODE.PLANE) continue;
      let x = p.m.x, y = p.m.y, z = p.m.z, h = bodyHeight(p.m), mode = p.m.mode;
      const k = p.idx * 5;
      if (okA && k + 4 < a.data.length && a.data[k + 3] > 0) {
        x = a.data[k]; y = a.data[k + 1]; z = a.data[k + 2]; h = a.data[k + 3]; mode = a.data[k + 4];
        if (okB && k + 4 < b.data.length && b.data[k + 3] > 0 && f > 0) {
          x += (b.data[k] - x) * f; y += (b.data[k + 1] - y) * f; z += (b.data[k + 2] - z) * f;
        }
      }
      out.push({ p, x, y, z, h, knocked: mode === MODE.KNOCKED });
    }
    return out;
  }

  // ------------------------------------------------------------------ snapshots
  snapshotFor(pid) {
    const p = this.players.get(pid);
    const z = this.zone;
    const focus = p && !p.alive && p.spectate >= 0 ? this.players.get(p.spectate) : p;
    const fx = focus ? focus.m.x : 0, fz = focus ? focus.m.z : 0;
    const players = [];
    for (const o of this.list) {
      if (o === p) continue;
      if (!o.alive && o.deathTick < this.tick - 2) continue;
      const mate = p && o.squad === p.squad;
      if (!mate && Math.hypot(o.m.x - fx, o.m.z - fz) > RELEVANCE && o.m.mode !== MODE.PLANE) continue;
      players.push(this.playerWire(o, mate));
    }
    const proj = [];
    for (const pr of this.proj.values()) proj.push({ id: pr.id, k: pr.k === 'frag' ? 1 : 2, x: pr.x, y: pr.y, z: pr.z });
    const veh = [];
    for (const v of this.vehicles.values()) if (v.alive && Math.hypot(v.x - fx, v.z - fz) < RELEVANCE) veh.push(vehicleWire(v));
    let aliveN = 0; for (const o of this.list) if (o.alive) aliveN++;
    let sqN = 0; for (const s of this.squads.values()) if (s.alive) sqN++;
    const self = p ? {
      x: p.m.x, y: p.m.y, z: p.m.z, vx: p.m.vx, vy: p.m.vy, vz: p.m.vz, mode: p.m.mode, grounded: p.m.grounded, crouch: p.m.crouch,
      airT: p.m.airT, pb: p.m.pb, slide: p.m.slide || 0, slideCD: p.m.slideCD || 0, vault: p.m.vault || 0, hp: p.hp, boost: p.boost, bleed: p.bleed, slot: p.inv.slot,
      mag: this.activeWeapon(p) ? this.activeWeapon(p).mag : 0,
      act: p.act ? p.act.k : 0, actP: p.act ? clamp(p.act.t / p.act.dur, 0, 1) : 0,
      spec: p.alive ? -1 : p.spectate, alive: p.alive,
    } : null;
    return {
      tick: this.tick, ack: p ? p.lastSeq : 0, self,
      zone: { cx: z.cur.x, cz: z.cur.z, cr: z.cur.r, nx: z.next.x, nz: z.next.z, nr: z.next.r, phase: z.phase, state: z.state === 'wait' ? 0 : z.state === 'shrink' ? 1 : 2, timer: Math.max(0, z.timer) },
      plane: this.plane ? { x: this.plane.x, z: this.plane.z, active: this.plane.active } : { x: 0, z: 0, active: false },
      alive: aliveN, squads: sqN, players, proj, veh,
    };
  }

  playerWire(o, mate) {
    const w = o.inv.slot < 3 ? o.inv.w[o.inv.slot] : null;
    let flags = 0;
    if (o.m.crouch) flags |= 1;
    if (o.lastInput.buttons & BTN.ADS) flags |= 2;
    if ((o.lastInput.buttons & BTN.SPRINT) && Math.hypot(o.m.vx, o.m.vz) > 5) flags |= 4;
    if (o.act && o.act.k === ACT.reload) flags |= 8;
    if (o.act && o.act.k === ACT.heal) flags |= 16;
    if (o.act && (o.act.k === ACT.revive || o.act.k === ACT.hack)) flags |= 32;
    if (this.tick - o.fire.lastShot < 4) flags |= 64;
    if (mate) flags |= 128;
    let weapon = 0;
    if (w) weapon = WEAPON_IDS.indexOf(w.id) + 1;
    else if (o.inv.slot === 3) weapon = 20;
    const gear = (o.inv.helmet ? o.inv.helmet.tier : 0) | ((o.inv.vest ? o.inv.vest.tier : 0) << 2) | (o.inv.pack << 4);
    const hp = mate ? Math.round(o.m.mode === MODE.KNOCKED ? o.bleed : o.hp) : 255;
    return { id: o.id, x: o.m.x, y: o.m.y, z: o.m.z, yaw: o.yaw, pitch: o.pitch, mode: o.m.mode, flags, weapon, gear, hp };
  }

  inventoryFor(pid) {
    const p = this.players.get(pid);
    if (!p) return null;
    const inv = p.inv;
    return {
      w: inv.w.map(w => w ? { id: w.id, mag: w.mag, att: w.att, semi: !!w.semi } : null), slot: inv.slot,
      ammo: inv.ammo, heal: inv.heal, thr: inv.thr, thrSel: inv.thrSel, atts: inv.atts,
      helmet: inv.helmet ? { tier: inv.helmet.tier, dur: Math.round(inv.helmet.dur) } : null,
      vest: inv.vest ? { tier: inv.vest.tier, dur: Math.round(inv.vest.dur) } : null,
      pack: inv.pack, cap: PACK_CAP[inv.pack], wt: Math.round(invWeight(inv) * 10) / 10,
    };
  }

  // Everything a client needs when it first joins (or rejoins) a match.
  initialState(pid) {
    return {
      seed: this.seed, mode: this.mode, tick: this.tick, phase: this.phase,
      roster: this.list.map(p => ({ id: p.id, name: p.name, squad: p.squad, bot: p.bot, cos: p.cos })),
      items: [...this.items.values()].map(g => [g.id, r2(g.x), r2(g.y), r2(g.z), g.it]),
      crates: this.crates, smokes: this.smokes.map(s => ({ id: s.id, x: r2(s.x), y: r2(s.y), z: r2(s.z), left: (s.until - this.tick) * DT })),
      terminals: this.terminals.map(t => ({ id: t.id, x: t.x, y: t.y, z: t.z, hacked: t.hackedBy })),
      zone: this.zoneInfo(), plane: this.plane ? { sx: this.plane.sx, sz: this.plane.sz, dx: this.plane.dx, dz: this.plane.dz, len: this.plane.len } : null,
      you: pid, squad: this.players.get(pid) ? this.players.get(pid).squad : -1,
      airdrops: this.airdrops.map(d => ({ id: d.id, x: d.x, z: d.z, g: d.g, y0: d.y0, t0: d.t0, sp: d.speed, landed: d.landed })),
    };
  }

  results() {
    return this.list.map(p => ({ id: p.id, name: p.name, squad: p.squad, bot: p.bot, place: p.place || 1, alive: p.alive, ...p.stats,
      survived: Math.round(p.alive ? (this.tick - (this.startTick || 0)) * DT : p.stats.survived) }));
  }
}

// ------------------------------------------------------------------ helpers
function gridKey(x, z) { return Math.floor((z + 600) / 16) * 1000 + Math.floor((x + 600) / 16); }
function r2(v) { return Math.round(v * 100) / 100; }
function dist3(a, b) { return Math.hypot(a.x - b.x, (a.y - b.y) * 0.5, a.z - b.z); }
export function neutralInput(p) { return { seq: p.lastSeq, mx: 0, mz: 0, yaw: p.yaw, pitch: p.pitch, buttons: 0, viewTick: 0 }; }

// Ray vs player hitbox: head sphere + vertical body capsule. Returns {t, zone} or null.
export function hitTest(ox, oy, oz, dx, dy, dz, t, maxT) {
  const h = t.h;
  let best = null;
  if (!t.knocked) {
    const hy = t.y + h - 0.14;
    const r = h < 1.5 ? 0.16 : 0.15;
    const tt = raySphere(ox, oy, oz, dx, dy, dz, t.x, hy, t.z, r);
    if (tt !== null && tt < maxT) best = { t: tt, zone: 'head' };
  }
  const y0 = t.y + 0.15, y1 = t.y + (t.knocked ? h : h - 0.3);
  const rad = t.knocked ? 0.38 : 0.27;
  const tc = rayCapsuleY(ox, oy, oz, dx, dy, dz, t.x, y0, y1, t.z, rad);
  if (tc !== null && tc < maxT && (!best || tc < best.t - 0.02)) {
    const hy = oy + dy * tc;
    best = { t: tc, zone: t.knocked ? 'torso' : (hy < t.y + h * 0.47 ? 'limb' : 'torso') };
  }
  return best;
}

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = ox - cx, ly = oy - cy, lz = oz - cz;
  const b = lx * dx + ly * dy + lz * dz;
  const c = lx * lx + ly * ly + lz * lz - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : null;
}

function rayCapsuleY(ox, oy, oz, dx, dy, dz, cx, y0, y1, cz, r) {
  // infinite cylinder in xz
  const lx = ox - cx, lz = oz - cz;
  const a = dx * dx + dz * dz;
  let best = null;
  if (a > 1e-9) {
    const b = lx * dx + lz * dz, c = lx * lx + lz * lz - r * r;
    const disc = b * b - a * c;
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / a;
      if (t >= 0) { const y = oy + dy * t; if (y >= y0 && y <= y1) best = t; }
    }
  }
  for (const cy of [y0, y1]) {
    const t = raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r);
    if (t !== null && (best === null || t < best)) best = t;
  }
  return best;
}
