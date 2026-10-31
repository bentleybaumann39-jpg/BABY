// Server-side bot brains. Bots produce the same input packets and commands as human players and are
// bound by the same rules: they only see what line of sight, sound and damage tell them.
import { DT, TICK_RATE, MODE, BTN, PLANE, MAP_HALF } from '../constants.js';
import { Rng, clamp, wrapAngle } from '../rng.js';
import { eyeHeight, bodyHeight } from '../physics/Movement.js';
import { WEAPONS, WEAPON_SCORE, HEALS, ATTACH, canAttach, magSize, ARMOR } from './Items.js';
import { ACT, invWeight } from './Sim.js';

const NAMES = ['Kestrel', 'Varga', 'Moth', 'Brannock', 'Ilse', 'Corvo', 'Teague', 'Halloran', 'Sutter', 'Pike', 'Renko', 'Dace',
  'Mercer', 'Oriel', 'Fenwick', 'Basso', 'Lark', 'Okafor', 'Stroud', 'Vane', 'Calder', 'Nyx', 'Ruskin', 'Thorne', 'Ambrose',
  'Quill', 'Sorrel', 'Hask', 'Wren', 'Dunmore', 'Ivo', 'Rook', 'Sabre', 'Tamsin', 'Garrow', 'Holt', 'Marek', 'Selk', 'Ural', 'Zane'];
export function botName(i, rng) { return NAMES[(i * 7 + (rng ? rng.int(0, 39) : 0)) % NAMES.length] + (rng ? '' : ''); }

export function makeBot(sim, p) { return new BotBrain(sim, p); }

class BotBrain {
  constructor(sim, p) {
    this.sim = sim; this.p = p;
    this.rng = new Rng(sim.seed * 31 + p.id * 977 + 13);
    this.skill = p.skill;
    this.nav = sim.nav;
    this.state = 'drop';
    this.dropTarget = null;
    this.goal = null; this.goalKind = null; this.path = null; this.pathI = 0; this.repath = 0;
    this.target = null; this.lastSeen = null; this.seenAt = -999; this.acquiredAt = -999;
    this.aimYaw = p.yaw; this.aimPitch = 0; this.errYaw = 0; this.errPitch = 0;
    this.strafe = 1; this.strafeT = 0; this.burstT = 0; this.pauseT = 0;
    this.blacklist = new Set();
    this.stuckT = 0; this.lastPos = { x: 0, z: 0 }; this.stuckCheck = 0;
    this.thinkT = (p.id * 3) % 6;
    this.investigate = null;
    this.healCD = 0;
    this.hurtFrom = null;
    this.lastHurtSeen = -1;
    this.crouchT = 0;
    this.useHold = false;
    this.seq = 0;
    this.jumpCD = 0;
  }

  think() {
    const p = this.p, sim = this.sim;
    this.seq++;
    const inp = { seq: this.seq, mx: 0, mz: 0, yaw: p.yaw, pitch: p.pitch, buttons: 0, viewTick: sim.tick };
    if (p.m.mode === MODE.PLANE) return this.thinkPlane(inp);
    if (p.m.mode === MODE.FREEFALL || p.m.mode === MODE.CHUTE) return this.thinkDrop(inp);
    if (sim.phase === 'ended') return inp;
    if (--this.thinkT <= 0) { this.thinkT = 6; this.decide(); }
    this.act(inp);
    return inp;
  }

  // ---------------------------------------------------------------- plane & drop
  pickDrop() {
    const sim = this.sim, rng = this.rng;
    const sq = sim.squads.get(this.p.squad);
    const lead = sim.players.get(sq.members[0]);
    if (lead !== this.p && lead.brain && lead.brain.dropTarget) {
      const t = lead.brain.dropTarget;
      return { x: t.x + rng.range(-25, 25), z: t.z + rng.range(-25, 25) };
    }
    const pl = sim.plane;
    // Prefer spots near the flight path (reachable by gliding).
    const cands = [];
    for (const poi of sim.map.pois) {
      const d = distToLine(poi.x, poi.z, pl.sx, pl.sz, pl.dx, pl.dz);
      if (d < 420) cands.push([poi, (poi.tier + 1) * (1 - d / 500)]);
    }
    if (cands.length && rng.chance(0.72)) {
      const poi = rng.weighted(cands);
      return { x: poi.x + rng.range(-poi.r * 0.6, poi.r * 0.6), z: poi.z + rng.range(-poi.r * 0.6, poi.r * 0.6) };
    }
    const bl = sim.map.buildings.filter(b => !b.prop && distToLine(b.x, b.z, pl.sx, pl.sz, pl.dx, pl.dz) < 380);
    if (bl.length) { const b = rng.pick(bl); return { x: b.x + rng.range(-12, 12), z: b.z + rng.range(-12, 12) }; }
    return { x: rng.range(-300, 300), z: rng.range(-300, 300) };
  }

  thinkPlane(inp) {
    const pl = this.sim.plane;
    if (!this.dropTarget) { this.dropTarget = this.pickDrop(); this.bestD = 1e9; }
    const d = Math.hypot(pl.x - this.dropTarget.x, pl.z - this.dropTarget.z);
    if (d < 260 || d > this.bestD + 2) { if (pl.t > 1.5 + (this.p.idx % 5) * 0.3) inp.buttons = BTN.JUMP; }
    this.bestD = Math.min(this.bestD, d);
    return inp;
  }

  thinkDrop(inp) {
    const p = this.p, t = this.dropTarget || { x: p.m.x, z: p.m.z };
    const dx = t.x - p.m.x, dz = t.z - p.m.z;
    const d = Math.hypot(dx, dz);
    p.yaw = Math.atan2(-dx, -dz);
    inp.yaw = p.yaw;
    const agl = p.m.y - this.sim.world.heightAt(p.m.x, p.m.z);
    if (p.m.mode === MODE.FREEFALL) {
      const need = d / Math.max(1, agl);   // glide ratio needed
      inp.mz = d > 25 ? 1 : 0;
      inp.pitch = need < 0.35 ? -1.2 : -0.25;
      if (d < 15 && agl < 220) inp.buttons = BTN.JUMP;
    } else {
      inp.mz = d > 12 ? 1 : d < 4 ? -1 : 0;
      inp.pitch = -0.3;
    }
    this.landed = false;
    return inp;
  }

  // ---------------------------------------------------------------- perception & decisions (5 Hz)
  decide() {
    const p = this.p, sim = this.sim;
    if (!this.landed && p.m.mode === MODE.GROUND) { this.landed = true; this.lastPos = { x: p.m.x, z: p.m.z }; }
    this.perceive();
    if (this.healCD > 0) this.healCD -= 0.2;
    const now = sim.tick;
    const zone = sim.zone;
    const mate = this.knockedMate();
    const outside = Math.hypot(p.m.x - zone.cur.x, p.m.z - zone.cur.z) > zone.cur.r - 8;
    const outsideNext = Math.hypot(p.m.x - zone.next.x, p.m.z - zone.next.z) > zone.next.r - 10;
    const zoneUrgent = outside || (outsideNext && (zone.state === 'shrink' || zone.timer < 40 * sim.timeScale));
    const armed = this.hasUsableGun();
    const fighting = armed && this.target && now - this.seenAt < TICK_RATE * 1.5;

    if (p.m.mode === MODE.KNOCKED) {
      const m = this.nearestMate();
      this.setGoal(m ? { x: m.m.x, z: m.m.z } : this.zonePoint(), 'crawl');
      return;
    }
    if (fighting && !(outside && zone.dmg >= 5)) { this.state = 'fight'; return; }
    if (zoneUrgent) { this.state = 'zone'; if (this.goalKind !== 'zone' || !this.goal) this.setGoal(this.zonePoint(), 'zone'); return; }
    if (mate && (!this.target || now - this.seenAt > TICK_RATE * 2.5 || Math.hypot(mate.m.x - p.m.x, mate.m.z - p.m.z) < 12)) { this.state = 'revive'; this.setGoal({ x: mate.m.x, z: mate.m.z }, 'revive'); this.reviveId = mate.id; return; }
    // heal
    const hasHeal = p.inv.heal.kit > 0 || (p.inv.heal.bandage > 0 && p.hp < 75) || (p.inv.heal.stim > 0 && p.boost < 40);
    if (p.hp < 70 && hasHeal && now - this.seenAt > TICK_RATE * 4 && this.healCD <= 0 && !p.act) { this.state = 'heal'; return; }
    // reload when calm
    const w = sim.activeWeapon(p);
    if (w && w.mag < magSize(w) * 0.5 && p.inv.ammo[WEAPONS[w.id].ammo] > 0 && !p.act && now - this.seenAt > TICK_RATE * 2) sim.startReload(p);
    this.pickWeapon(this.target && this.lastSeen ? Math.hypot(this.lastSeen.x - p.m.x, this.lastSeen.z - p.m.z) : 60);
    // chase last known enemy position briefly
    if (this.lastSeen && now - this.seenAt < TICK_RATE * 7 && this.hasGun()) { this.state = 'hunt'; this.setGoal(this.lastSeen, 'hunt'); return; }
    if (this.investigate && now - this.investigate.tick < TICK_RATE * 8 && this.hasGun()) { this.state = 'investigate'; this.setGoal(this.investigate, 'investigate'); return; }
    // loot
    const item = this.bestItem();
    if (item) { this.state = 'loot'; if (this.goalKind !== 'loot' || this.lootId !== item.id) { this.lootId = item.id; this.setGoal({ x: item.x, z: item.z }, 'loot'); } return; }
    // roam towards buildings inside the next circle, or follow the squad leader
    this.state = 'roam';
    const lead = this.squadLead();
    if (lead && lead !== p && Math.hypot(lead.m.x - p.m.x, lead.m.z - p.m.z) > 25) { this.setGoal({ x: lead.m.x + this.rng.range(-6, 6), z: lead.m.z + this.rng.range(-6, 6) }, 'follow'); return; }
    if (!this.goal || this.goalKind !== 'roam' || this.reached(this.goal, 4)) this.setGoal(this.roamPoint(), 'roam');
  }

  perceive() {
    const p = this.p, sim = this.sim, w = sim.world;
    const eh = eyeHeight(p.m);
    const ex = p.m.x, ey = p.m.y + eh, ez = p.m.z;
    const range = 140 + this.skill * 140;
    let best = null, bestD = 1e9;
    const hurt = sim.tick - p.lastHurt < TICK_RATE * 2;
    for (const o of sim.list) {
      if (!o.alive || o.squad === p.squad || o.m.mode === MODE.PLANE) continue;
      const dx = o.m.x - ex, dz = o.m.z - ez;
      const d = Math.hypot(dx, dz);
      if (d > range) continue;
      const ang = Math.abs(wrapAngle(Math.atan2(-dx, -dz) - p.yaw));
      const fov = hurt || d < 14 ? Math.PI : 1.25;
      if (ang > fov) continue;
      // stance / distance detection
      const crouchMul = o.m.crouch ? 0.7 : 1;
      if (d > range * crouchMul) continue;
      const ty = o.m.y + bodyHeight(o.m) * 0.7;
      if (!w.los(ex, ey, ez, o.m.x, ty, o.m.z)) continue;
      if (this.smokeBlocks(ex, ey, ez, o.m.x, ty, o.m.z)) continue;
      const knockedPenalty = o.m.mode === MODE.KNOCKED ? 30 : 0;
      if (d + knockedPenalty < bestD) { bestD = d + knockedPenalty; best = o; }
    }
    if (best) {
      if (this.target !== best) { this.acquiredAt = sim.tick; this.errYaw = this.rng.range(-1, 1) * (0.14 - this.skill * 0.1); this.errPitch = this.rng.range(-1, 1) * (0.08 - this.skill * 0.05); }
      this.target = best; this.seenAt = sim.tick; this.lastSeen = { x: best.m.x, z: best.m.z };
    } else if (this.target && (!this.target.alive || sim.tick - this.seenAt > TICK_RATE * 3)) this.target = null;
    // sounds
    for (const n of sim.noises) {
      if (n.sq === p.squad || n.tick < sim.tick - 8) continue;
      const d = Math.hypot(n.x - p.m.x, n.z - p.m.z);
      if (d < n.r && (!this.investigate || this.investigate.tick < n.tick)) this.investigate = { x: n.x + this.rng.range(-10, 10), z: n.z + this.rng.range(-10, 10), tick: n.tick };
    }
    // damage direction
    if (hurt && !best) {
      let att = null, t = -1;
      for (const [pid, tk] of p.dmgBy) if (tk > t) { t = tk; att = pid; }
      const a = att !== null ? sim.players.get(att) : null;
      if (a && a.alive) { this.investigate = { x: a.m.x + this.rng.range(-15, 15), z: a.m.z + this.rng.range(-15, 15), tick: sim.tick }; this.turnTo = Math.atan2(-(a.m.x - p.m.x), -(a.m.z - p.m.z)); }
    }
  }

  smokeBlocks(ax, ay, az, bx, by, bz) {
    for (const s of this.sim.smokes) {
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      const L2 = dx * dx + dy * dy + dz * dz;
      let t = ((s.x - ax) * dx + (s.y + 1.5 - ay) * dy + (s.z - az) * dz) / L2;
      t = clamp(t, 0, 1);
      const cx = ax + dx * t - s.x, cy = ay + dy * t - s.y - 1.5, cz = az + dz * t - s.z;
      if (cx * cx + cy * cy + cz * cz < 30) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- per-tick actions
  act(inp) {
    const p = this.p, sim = this.sim;
    let wantYaw = p.yaw, wantPitch = 0;
    let moveTo = null, sprint = false;
    const fighting = this.state === 'fight' && this.target && this.target.alive;

    if (fighting) {
      const t = this.target;
      const th = t.m.y + bodyHeight(t.m) * (t.m.mode === MODE.KNOCKED ? 0.4 : 0.72);
      const dx = t.m.x - p.m.x, dz = t.m.z - p.m.z, dy = th - (p.m.y + eyeHeight(p.m));
      const d = Math.hypot(dx, dz);
      // decaying aim error while tracking
      const tracking = (sim.tick - this.acquiredAt) * DT;
      const k = Math.max(0.25, 1 - tracking * (0.25 + this.skill * 0.6));
      wantYaw = Math.atan2(-dx, -dz) + this.errYaw * k + Math.sin(sim.tick * 0.21 + p.id) * 0.006 * (1.4 - this.skill);
      wantPitch = Math.atan2(dy, d) + this.errPitch * k;
      const w = sim.activeWeapon(p);
      // movement: keep preferred range, strafe
      const def = w ? WEAPONS[w.id] : null;
      const pref = !def ? 5 : def.cls === 'shotgun' ? 6 : def.cls === 'smg' ? 14 : def.cls === 'pistol' ? 12 : def.cls === 'sniper' || def.cls === 'dmr' ? 70 : 30;
      this.strafeT -= DT;
      if (this.strafeT <= 0) { this.strafe = this.rng.chance(0.5) ? 1 : -1; this.strafeT = this.rng.range(0.5, 1.6); if (d > 40 && this.rng.chance(0.35 * this.skill)) this.crouchT = this.rng.range(1, 2.5); }
      inp.mx = this.strafe * (d > 90 ? 0.4 : 1);
      inp.mz = !def ? -1 : d > pref * 1.5 ? 0.8 : d < pref * 0.6 ? -0.6 : 0;
      if (this.crouchT > 0) { this.crouchT -= DT; inp.buttons |= BTN.CROUCH; inp.mx *= 0.5; }
      if (!w) { this.pickWeapon(d); }
      // fire control
      const reactTime = 0.65 - this.skill * 0.45;
      const yawErr = Math.abs(wrapAngle(wantYaw - p.yaw)), pitchErr = Math.abs(wantPitch - p.pitch);
      const tol = Math.atan2(0.45, Math.max(d, 1)) + 0.02;
      if (def && d > 25 && def.cls !== 'shotgun') inp.buttons |= BTN.ADS;
      const effective = def ? d < def.r1 * 1.25 + 10 : false;
      if (def && w.mag > 0 && !p.act && tracking > reactTime && yawErr < tol * 2.5 && pitchErr < tol * 2.5 && effective && sim.tick - this.seenAt < 4) {
        if (def.auto && d > 30) {
          this.burstT -= DT;
          if (this.burstT > 0) inp.buttons |= BTN.FIRE;
          else if (this.burstT < -this.rng.range(0.15, 0.5)) this.burstT = this.rng.range(0.15, 0.45);
        } else if (def.auto) inp.buttons |= BTN.FIRE;
        else if ((sim.tick + p.id) % Math.max(2, Math.round(TICK_RATE * 60 / def.rpm * (1.15 - this.skill * 0.3))) === 0) inp.buttons |= BTN.FIRE;
      }
      if (w && w.mag === 0 && !p.act) {
        if (p.inv.ammo[def.ammo] > 0) sim.startReload(p);
        else this.pickWeapon(d, true);
      }
    } else {
      if (this.state === 'heal') this.doHeal();
      if (this.goal && this.state !== 'heal') moveTo = this.steer();
      if (this.state === 'revive' && this.reviveId !== undefined) {
        const m = sim.players.get(this.reviveId);
        if (m && m.alive && m.m.mode === MODE.KNOCKED && Math.hypot(m.m.x - p.m.x, m.m.z - p.m.z) < 1.6) { inp.buttons |= BTN.USE; moveTo = null; }
      }
      if (this.state === 'loot' && this.lootId) {
        const gi = sim.items.get(this.lootId);
        if (!gi) { this.lootId = 0; this.goal = null; }
        else if (Math.hypot(gi.x - p.m.x, gi.z - p.m.z) < 1.8) {
          const inv = p.inv;
          const worst = inv.w[0] && inv.w[1] ? (WEAPON_SCORE[inv.w[0].id] <= WEAPON_SCORE[inv.w[1].id] ? 0 : 1) : -1;
          const ok = sim.tryPickup(p, gi.id, worst);
          if (!ok) this.blacklist.add(gi.id);
          this.lootId = 0; this.goal = null; this.thinkT = 1;
        }
      }
      if (moveTo) {
        wantYaw = Math.atan2(-(moveTo[0] - p.m.x), -(moveTo[1] - p.m.z));
        sprint = this.state === 'zone' || this.state === 'roam' || this.state === 'follow' || this.state === 'revive' || Math.hypot(moveTo[0] - p.m.x, moveTo[1] - p.m.z) > 8;
        inp.mz = 1;
      } else if (this.turnTo !== undefined) { wantYaw = this.turnTo; }
      if (this.state === 'hunt' || this.state === 'investigate') { sprint = false; inp.buttons |= BTN.ADS * 0; }
      wantPitch = 0;
    }

    // turn with a skill-limited rate
    const rate = (3.5 + this.skill * 7) * DT * (fighting ? 1 : 0.8);
    p.yaw = p.yaw + clamp(wrapAngle(wantYaw - p.yaw), -rate, rate);
    p.pitch = p.pitch + clamp(wantPitch - p.pitch, -rate * 0.7, rate * 0.7);
    inp.yaw = p.yaw; inp.pitch = p.pitch;
    if (moveTo && !fighting) {
      // movement relative to the current yaw (we may still be turning)
      const dx = moveTo[0] - p.m.x, dz = moveTo[1] - p.m.z, L = Math.hypot(dx, dz) || 1;
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      inp.mz = (dx * fx + dz * fz) / L; inp.mx = (dx * rx + dz * rz) / L;
      if (sprint && inp.mz > 0.7) inp.buttons |= BTN.SPRINT;
    }
    // stuck handling
    this.stuckCheck += DT;
    if (this.stuckCheck > 1.2) {
      const moved = Math.hypot(p.m.x - this.lastPos.x, p.m.z - this.lastPos.z);
      if ((moveTo || fighting) && moved < 0.6 && !p.act) { this.stuckT++; this.path = null; if (this.stuckT > 1) { inp.buttons |= BTN.JUMP; this.strafe = -this.strafe; } if (this.stuckT > 4) { this.goal = null; this.stuckT = 0; this.blacklist.add(this.lootId); } }
      else this.stuckT = 0;
      this.lastPos = { x: p.m.x, z: p.m.z }; this.stuckCheck = 0;
    }
    if (this.stuckT > 1 && this.jumpCD <= 0) { inp.buttons |= BTN.JUMP; this.jumpCD = 1; }
    this.jumpCD -= DT;
  }

  doHeal() {
    const p = this.p, sim = this.sim;
    if (p.act) return;
    if (p.hp < 75 && p.inv.heal.bandage > 0 && (p.hp > 50 || !p.inv.heal.kit)) sim.startHeal(p, 'bandage');
    else if (p.inv.heal.kit > 0 && p.hp < 90) sim.startHeal(p, 'kit');
    else if (p.inv.heal.stim > 0 && p.boost < 50) sim.startHeal(p, 'stim');
    else { this.healCD = 3; this.state = 'roam'; }
  }

  // ---------------------------------------------------------------- navigation
  setGoal(g, kind) {
    if (!g) return;
    if (this.goal && this.goalKind === kind && Math.hypot(this.goal.x - g.x, this.goal.z - g.z) < 3) return;
    this.goal = { x: g.x, z: g.z }; this.goalKind = kind; this.path = null; this.pathI = 0;
  }
  reached(g, r) { return Math.hypot(g.x - this.p.m.x, g.z - this.p.m.z) < r; }

  steer() {
    const p = this.p, g = this.goal, nav = this.nav;
    if (this.reached(g, 1.0)) { if (this.goalKind !== 'loot') this.goal = null; return null; }
    if (!nav) return [g.x, g.z];
    if (nav.lineClear(p.m.x, p.m.z, g.x, g.z) && Math.hypot(g.x - p.m.x, g.z - p.m.z) < 120) return [g.x, g.z];
    if (!this.path || this.repath-- <= 0) {
      const far = Math.hypot(g.x - p.m.x, g.z - p.m.z) > 140;
      let tx = g.x, tz = g.z;
      if (far) { const d = Math.hypot(g.x - p.m.x, g.z - p.m.z); tx = p.m.x + (g.x - p.m.x) / d * 120; tz = p.m.z + (g.z - p.m.z) / d * 120; }
      this.path = nav.findPath(p.m.x, p.m.z, tx, tz, 9000) || [[g.x, g.z]];
      this.pathI = 0; this.repath = TICK_RATE * 3;
    }
    while (this.pathI < this.path.length - 1 && Math.hypot(this.path[this.pathI][0] - p.m.x, this.path[this.pathI][1] - p.m.z) < 1.1) this.pathI++;
    // skip ahead when visible
    for (let j = Math.min(this.path.length - 1, this.pathI + 4); j > this.pathI; j--) if (nav.lineClear(p.m.x, p.m.z, this.path[j][0], this.path[j][1])) { this.pathI = j; break; }
    return this.path[this.pathI];
  }

  zonePoint() {
    const z = this.sim.zone;
    const c = z.state === 'shrink' || z.timer < 50 ? z.next : z.next;
    const a = this.rng.range(0, Math.PI * 2), r = Math.sqrt(this.rng.next()) * c.r * 0.6;
    let x = c.x + Math.cos(a) * r, zz = c.z + Math.sin(a) * r;
    if (this.nav) { const f = this.nav.nearestFree(x, zz, 10); if (f) [x, zz] = f; }
    return { x, z: zz };
  }

  roamPoint() {
    const sim = this.sim, z = sim.zone, p = this.p;
    const cands = sim.map.buildings.filter(b => !b.prop && Math.hypot(b.x - z.next.x, b.z - z.next.z) < z.next.r * 0.9 && Math.hypot(b.x - p.m.x, b.z - p.m.z) < 260 && Math.hypot(b.x - p.m.x, b.z - p.m.z) > 25);
    if (cands.length) { const b = this.rng.pick(cands); const f = this.nav ? this.nav.nearestFree(b.x, b.z, 10) : [b.x, b.z]; if (f) return { x: f[0], z: f[1] }; }
    return this.zonePoint();
  }

  // ---------------------------------------------------------------- squad helpers
  knockedMate() {
    const sq = this.sim.squads.get(this.p.squad);
    let best = null, bd = 120;
    for (const id of sq.members) {
      const o = this.sim.players.get(id);
      if (o === this.p || !o.alive || o.m.mode !== MODE.KNOCKED) continue;
      const d = Math.hypot(o.m.x - this.p.m.x, o.m.z - this.p.m.z);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  nearestMate() {
    const sq = this.sim.squads.get(this.p.squad);
    let best = null, bd = 1e9;
    for (const id of sq.members) {
      const o = this.sim.players.get(id);
      if (o === this.p || !o.alive || o.m.mode === MODE.KNOCKED) continue;
      const d = Math.hypot(o.m.x - this.p.m.x, o.m.z - this.p.m.z);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  squadLead() {
    const sq = this.sim.squads.get(this.p.squad);
    for (const id of sq.members) { const o = this.sim.players.get(id); if (o.alive && o.m.mode === MODE.GROUND) return o; }
    return null;
  }

  // ---------------------------------------------------------------- loot evaluation
  hasGun() { return this.p.inv.w.some(w => w); }
  hasUsableGun() { const inv = this.p.inv; return inv.w.some(w => w && (w.mag > 0 || inv.ammo[WEAPONS[w.id].ammo] > 0)); }

  pickWeapon(dist, needAmmo = false) {
    const p = this.p, sim = this.sim, inv = p.inv;
    let best = -1, bs = -1e9;
    for (let s = 0; s < 3; s++) {
      const w = inv.w[s]; if (!w) continue;
      const def = WEAPONS[w.id];
      if (w.mag === 0 && inv.ammo[def.ammo] === 0) continue;
      let sc = WEAPON_SCORE[w.id];
      if (dist < 20 && (def.cls === 'shotgun' || def.cls === 'smg')) sc += 4;
      if (dist > 80 && (def.cls === 'sniper' || def.cls === 'dmr' || def.cls === 'ar')) sc += 3;
      if (dist < 12 && def.cls === 'sniper') sc -= 6;
      if (sc > bs) { bs = sc; best = s; }
    }
    if (best >= 0 && best !== inv.slot && (!p.act || p.act.k === ACT.equip || needAmmo)) sim.switchSlot(p, best);
  }

  itemValue(it) {
    const inv = this.p.inv;
    switch (it.k) {
      case 'weapon': {
        const def = WEAPONS[it.id], sc = WEAPON_SCORE[it.id];
        if (def.slot === 'side') return inv.w[2] || inv.w[0] ? 0.3 : 3;
        if (!inv.w[0] && !inv.w[1]) return 8 + sc;
        if (!inv.w[0] || !inv.w[1]) { const cur = inv.w[0] || inv.w[1]; return cur.id === it.id ? 0.5 : 2 + sc * 0.4; }
        const worst = Math.min(WEAPON_SCORE[inv.w[0].id], WEAPON_SCORE[inv.w[1].id]);
        return sc > worst + 1 ? sc - worst : 0;
      }
      case 'ammo': {
        const uses = inv.w.some(w => w && WEAPONS[w.id].ammo === it.id);
        return uses && inv.ammo[it.id] < 150 ? 2.5 : 0;
      }
      case 'helmet': case 'vest': { const cur = inv[it.k]; return !cur ? 4 : it.tier > cur.tier ? 2 + it.tier : 0; }
      case 'pack': return it.tier > inv.pack ? 2 : 0;
      case 'heal': return inv.heal[it.id] < (it.id === 'bandage' ? 8 : 3) ? 1.6 : 0;
      case 'throw': return inv.thr[it.id] < 2 ? 0.6 : 0;
      case 'att': return inv.w.some(w => w && canAttach(w.id, it.id) && !w.att[ATTACH[it.id].type]) ? 1.2 : 0;
    }
    return 0;
  }

  bestItem() {
    const p = this.p, sim = this.sim;
    let best = null, bs = 0.25;
    sim.itemsNear(p.m.x, p.m.z, 65, gi => {
      if (this.blacklist.has(gi.id)) return;
      if (gi.y > sim.world.heightAt(gi.x, gi.z) + 1.3) return; // upper floors: skip
      if (this.nav && this.nav.blockedAt(gi.x, gi.z)) return;
      const v = this.itemValue(gi.it);
      if (v <= 0) return;
      const d = Math.hypot(gi.x - p.m.x, gi.z - p.m.z);
      const s = v / (1 + d / 14);
      if (s > bs) { bs = s; best = gi; }
    });
    return best;
  }
}

function distToLine(px, pz, sx, sz, dx, dz) {
  const vx = px - sx, vz = pz - sz;
  const t = vx * dx + vz * dz;
  return Math.hypot(vx - dx * t, vz - dz * t);
}
