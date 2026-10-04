// The Remainder's brain: senses (path-propagated hearing, dish-cone sight, touch), suspicion, memory,
// a state machine, door use, ducts, sound theft & mimicry, habit learning, and a pacing director that
// never hands it the player's exact position.
import * as THREE from 'three';
import { RemainderBody } from './Remainder.js';
import { CELL } from '../world/MapData.js';

export const S = {
  DORMANT: 'dormant', PATROL: 'patrol', INVESTIGATE: 'investigate', SEARCH: 'search', STALK: 'stalk',
  HUNT: 'hunt', CHASE: 'chase', LOST: 'lost', AMBUSH: 'ambush', WATCH: 'watch', RETREAT: 'retreat',
  LURED: 'lured', VENT: 'vent', CHECK: 'check', DEAD: 'dead',
};

// Player habits the Remainder learns (persist across deaths).
export class PlayerModel {
  constructor() { this.reset(); }
  reset() { this.hides = {}; this.doors = {}; this.stops = 0; this.flashTime = 0; this.totalTime = 0; this.sprints = 0; this.deaths = []; }
  note(kind, id) {
    if (kind === 'hide') this.hides[id] = (this.hides[id] || 0) + 1;
    if (kind === 'door') this.doors[id] = (this.doors[id] || 0) + 1;
    if (kind === 'stop') this.stops++;
    if (kind === 'sprint') this.sprints++;
  }
  favouriteDoors(n = 3) { return Object.entries(this.doors).sort((a, b) => b[1] - a[1]).slice(0, n).map((e) => e[0]); }
  flashRatio() { return this.totalTime > 1 ? this.flashTime / this.totalTime : 0.5; }
  serialize() { return { hides: this.hides, doors: this.doors, stops: this.stops, flashTime: this.flashTime, totalTime: this.totalTime, sprints: this.sprints, deaths: this.deaths }; }
  deserialize(d) { this.reset(); if (d) Object.assign(this, d); }
}

const SOUND_FOR_TAG = { flashClick: 'flashOn', door: 'doorOpen', step: 'step_tile', run: 'step_concrete', gasp: 'gasp', piano: 'piano', phone: 'phone', radio: 'static', oscillator: 'oscTone', breaker: 'breaker', valve: 'valve' };

export class RemainderAI {
  constructor(game) {
    this.game = game;
    this.body = new RemainderBody(game.mats);
    this.body.root.visible = false;
    game.scene.add(this.body.root);
    this.rng = game.rng.fork('ai');
    this.reset();
  }

  reset() {
    this.state = S.DORMANT;
    this.stateTime = 0;
    this.pos = new THREE.Vector3(30, -4, 2.5);
    this.facing = 0;
    this.speed = 0;
    this.path = null; this.pathI = 0; this.goal = null;
    this.suspicion = 0;
    this.memory = null;
    this.detect = 0;
    this.seesPlayer = false;
    this.lostTime = 0;
    this.attention = new THREE.Vector3();
    this.listenTimer = 0;
    this.repathTimer = 0;
    this.tick = 0;
    this.poseAccum = 0;
    this.repertoire = new Set(['step_concrete']);
    this.mimicTimer = 60;
    this.doorWait = 0;
    this.searchPoints = [];
    this.stalkStepQueue = [];
    this.vent = null;
    this.ambushPoint = null;
    this.awake = false;
    this.aggression = 0.5;
    this.speedMul = 1;
    this.noKill = false;
    this.lureTarget = null;
    this.chaseLoop = null;
    this.visibleCommit = new THREE.Vector3();
    this.body.root.visible = false;
  }

  get map() { return this.game.map; }

  // ------------------------------------------------------------------ control
  setState(s, info = {}) {
    if (this.state === s && !info.force) return;
    const prev = this.state;
    this.state = s;
    this.stateTime = 0;
    this.path = null;
    this.goal = info.goal || null;
    if (s === S.CHASE && prev !== S.CHASE) this.onChaseStart();
    if (prev === S.CHASE && s !== S.CHASE) this.onChaseEnd();
    if (s === S.SEARCH) this.buildSearch(info.center || this.memory || this.pos);
    if (s === S.DORMANT || s === S.DEAD) this.body.root.visible = false;
    this.game.events.emit('ai-state', s, prev);
  }

  wake(x, z) {
    this.awake = true;
    this.teleport(x, z);
    this.body.root.visible = true;
    this.setState(S.PATROL, { force: true });
  }

  // Test/screenshot helper: show a posed body without running the AI.
  debugShow(x, z, facing, lookAt) {
    this.awake = false;
    this.teleport(x, z);
    this.facing = facing;
    this.attention.set(lookAt.x, lookAt.y, lookAt.z);
    this.forceVisible = true;
    this.body.root.visible = true;
    this.state = S.WATCH;
    this.poseAccum = 1;
    this.updateBody(0.1);
  }

  teleport(x, z) {
    this.pos.set(x, this.map.floorAt(x, z), z);
    this.path = null;
    this.visibleCommit.copy(this.pos);
    this.body.root.position.copy(this.pos);
  }

  // ------------------------------------------------------------------ senses
  onNoise(x, z, loud, type, tag) {
    if (!this.awake || this.state === S.DEAD || this.state === S.DORMANT || this.state === S.VENT) return;
    const nav = this.game.nav;
    const f = nav.propagate(x, z, 40);
    const d = f[nav.cellOf(this.pos.x, this.pos.z)];
    const direct = Math.hypot(x - this.pos.x, z - this.pos.z);
    let dist = isFinite(d) ? d : direct * 3 + 20;
    const perceived = loud * 22 / Math.max(2, dist);
    // Steal distinctive sounds heard clearly.
    if (tag && perceived > 0.35 && SOUND_FOR_TAG[tag]) this.repertoire.add(SOUND_FOR_TAG[tag]);
    const sens = 1 + this.aggression * 0.4;
    const p = perceived * sens;
    if (p < 0.12) return;
    this.suspicion = Math.min(100, this.suspicion + p * 25);
    // Turn the dish toward the sound.
    this.attention.set(x, this.map.floorAt(x, z) + 1, z);
    this.listenTimer = 0.8;
    const err = Math.max(0, 1.2 - p) * 3;
    const est = { x: x + this.rng.range(-err, err), z: z + this.rng.range(-err, err), t: this.game.time };
    if (this.state === S.CHASE) return;
    if (this.state === S.STALK || this.state === S.WATCH) { if (p > 1.2) this.memory = { ...est, vx: 0, vz: 0 }; return; }
    if (this.state === S.AMBUSH && p < 1.5) return;
    if (this.state === S.LURED) return;
    if (p > 1.4 && this.suspicion > 45) { this.memory = { ...est, vx: 0, vz: 0 }; this.setState(S.HUNT, { goal: est }); return; }
    if (p > 0.45 || (this.state === S.SEARCH && p > 0.25)) {
      this.memory = { ...est, vx: 0, vz: 0 };
      this.setState(S.INVESTIGATE, { goal: est, force: this.state === S.INVESTIGATE });
    }
  }

  sight(dt) {
    const g = this.game, pl = g.player;
    const dx = pl.pos.x - this.pos.x, dz = pl.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    this.playerDist = dist;
    if (pl.hiding || !pl.alive) { this.seesPlayer = false; this.detect = Math.max(0, this.detect - dt); return false; }
    if (dist < 1.6 && Math.abs(pl.pos.y - this.pos.y) < 2) { this.seesPlayer = true; this.detect = 1; return true; }
    const vis = pl.visibility();
    const flashBias = 1 + (g.playerModel.flashRatio() - 0.5) * 0.4;
    const range = (2.2 + vis * 14 * flashBias) * (0.8 + this.aggression * 0.4);
    if (dist > range) { this.detect = Math.max(0, this.detect - dt * 0.5); this.seesPlayer = false; return false; }
    // Dish cone: dish follows attention; approximate with facing + attention.
    const fx = Math.sin(this.facing), fz = Math.cos(this.facing);
    const dot = (dx * fx + dz * fz) / (dist || 1);
    if (dot < 0.2 && dist > 3) { this.detect = Math.max(0, this.detect - dt * 0.5); this.seesPlayer = false; return false; }
    if (!g.grid.los(this.pos.x, this.pos.z, pl.pos.x, pl.pos.z, 'sight')) { this.detect = Math.max(0, this.detect - dt * 0.7); this.seesPlayer = false; return false; }
    this.detect += dt * (0.6 + vis * 2.5) * (1.4 - dist / range) * (0.7 + this.aggression * 0.6);
    this.seesPlayer = this.detect > 0.55;
    if (this.seesPlayer) this.detect = Math.min(this.detect, 1.5);
    return this.seesPlayer;
  }

  // ------------------------------------------------------------------ movement
  goTo(x, z, speed, opts = {}) {
    this.targetSpeed = speed;
    if (!this.path || this.repathTimer <= 0 || opts.force) {
      this.repathTimer = opts.repath ?? 1.2;
      const p = this.game.nav.findPath(this.pos.x, this.pos.z, x, z, { vents: opts.vents !== false && this.state !== S.CHASE });
      this.path = p; this.pathI = 0;
      if (!p) return 'fail';
    }
    return this.follow();
  }

  follow() {
    const p = this.path;
    if (!p) return 'fail';
    if (this.pathI >= p.length) return 'arrived';
    const wp = p[this.pathI];
    if (wp.vent) { this.enterVent(wp); return 'moving'; }
    // Doors along the way
    const ci = this.game.nav.cellOf(wp.x, wp.z);
    if (this.map.type[ci] === CELL.DOOR) {
      const door = this.game.doors.list.find((d) => d.x === Math.floor(wp.x) && d.z === Math.floor(wp.z));
      if (door && !this.game.doors.isOpen(door)) {
        const dd = Math.hypot(wp.x - this.pos.x, wp.z - this.pos.z);
        if (dd < 1.6) {
          if (this.game.doors.isLocked(door)) { this.path = null; return 'blocked'; }
          if (Math.abs(door.target) < 0.01) this.game.doors.open(door, this.pos.x, this.pos.z, { byEntity: true, slam: this.state === S.CHASE, slow: this.state === S.STALK });
          this.doorWait = this.state === S.CHASE ? 0.25 : 0.7;
          this.openedDoor = door;
        }
      }
    }
    if (this.doorWait > 0) return 'moving';
    const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.35) { this.pathI++; return this.pathI >= p.length ? 'arrived' : 'moving'; }
    this.moveDir = { x: dx / d, z: dz / d };
    return 'moving';
  }

  enterVent(wp) {
    const from = wp.ventFrom || this.pos;
    this.vent = { from: { x: this.pos.x, z: this.pos.z }, to: { x: wp.x, z: wp.z }, t: 0, dur: 3 + Math.hypot(wp.x - from.x, wp.z - from.z) * 0.12, resume: this.state };
    this.body.root.visible = false;
    this.ventLoop = this.game.audio?.loop('scratch', { pos: { x: this.pos.x, y: this.pos.y + 1.0, z: this.pos.z }, gain: 0.9, reverb: 0.2 });
    this.state = S.VENT;
  }

  updateVent(dt) {
    const v = this.vent;
    v.t += dt;
    const k = Math.min(1, v.t / v.dur);
    const x = v.from.x + (v.to.x - v.from.x) * k, z = v.from.z + (v.to.z - v.from.z) * k;
    if (this.ventLoop) { this.ventLoop.pos.x = x; this.ventLoop.pos.z = z; this.ventLoop.pos.y = this.map.floorAt(x, z) + 1.6; if (this.tick % 5 === 0) this.game.audio.updateLoopPosition(this.ventLoop); }
    if (k >= 1) {
      this.ventLoop?.stop(0.5);
      this.ventLoop = null;
      this.teleport(v.to.x, v.to.z);
      this.body.root.visible = true;
      this.game.audio?.playAt('doorMetalClose', { x: v.to.x, y: this.pos.y + 0.4, z: v.to.z }, { gain: 0.5 });
      this.state = v.resume === S.VENT ? S.PATROL : v.resume;
      this.vent = null;
      this.pathI++;
    }
  }

  integrate(dt) {
    if (!this.moveDir || this.doorWait > 0) { this.speed += (0 - this.speed) * Math.min(1, dt * 6); return; }
    this.speed += ((this.targetSpeed || 0) * this.speedMul - this.speed) * Math.min(1, dt * 3);
    const nx = this.pos.x + this.moveDir.x * this.speed * dt;
    const nz = this.pos.z + this.moveDir.z * this.speed * dt;
    const r = this.game.grid.resolveCircle(nx, nz, 0.28, true);
    this.pos.x = r.x; this.pos.z = r.z;
    this.pos.y += (this.map.floorAt(this.pos.x, this.pos.z) - this.pos.y) * Math.min(1, dt * 10);
    const want = Math.atan2(this.moveDir.x, this.moveDir.z);
    let d = want - this.facing; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    this.facing += d * Math.min(1, dt * 5);
  }

  // ------------------------------------------------------------------ behaviours
  pickPatrolPoint() {
    const g = this.game;
    const hint = g.director?.hintZone;
    if (hint && this.rng.chance(0.75)) {
      const c = hint.cells[Math.floor(this.rng.next() * hint.cells.length)];
      g.director.hintZone = null;
      return { x: (c % this.map.W) + 0.5, z: ((c / this.map.W) | 0) + 0.5 };
    }
    const zones = this.map.zones.filter((zz) => !['o', 'p', 'z'].includes(zz.ch) && zz.cells.length > 4);
    const pl = g.player.pos;
    const z = this.rng.weighted(zones, (zz) => {
      const cx = (zz.x0 + zz.x1) / 2, cz = (zz.z0 + zz.z1) / 2;
      const d = Math.hypot(cx - pl.x, cz - pl.z);
      return (g.director?.mode === 'relax' ? d : 40 / (8 + d)) + 0.2;
    });
    const c = z.cells[Math.floor(this.rng.next() * z.cells.length)];
    return { x: (c % this.map.W) + 0.5, z: ((c / this.map.W) | 0) + 0.5 };
  }

  buildSearch(center) {
    const g = this.game, nav = g.nav;
    const pts = [];
    // Hiding spots nearby, favourite first.
    const spots = g.story.hidingSpots
      .map((s) => ({ s, d: Math.hypot(s.x - center.x, s.z - center.z), w: g.playerModel.hides[s.id] || 0 }))
      .filter((e) => e.d < 9)
      .sort((a, b) => (b.w - a.w) || (a.d - b.d))
      .slice(0, 2);
    for (const e of spots) pts.push({ x: e.s.exitX, z: e.s.exitZ, spot: e.s });
    for (let k = 0; k < 3; k++) { const p = nav.randomPointNear(this.rng, center.x, center.z, 1.5, 7); if (p) pts.splice(this.rng.int(0, pts.length), 0, p); }
    if (this.memory && (this.memory.vx || this.memory.vz)) pts.unshift({ x: this.memory.x + this.memory.vx * 2.5, z: this.memory.z + this.memory.vz * 2.5 });
    this.searchPoints = pts;
  }

  onChaseStart() {
    const g = this.game;
    g.audio?.play('sting', { gain: 0.8, bus: g.audio.music });
    g.audio?.playAt('inhale', { x: this.pos.x, y: this.pos.y + 2, z: this.pos.z }, { gain: 1.2 });
    if (!this.chaseLoop) this.chaseLoop = g.audio?.loop('loopCollage', { pos: { x: this.pos.x, y: this.pos.y + 1.8, z: this.pos.z }, gain: 0.0, reverb: 0.4 });
    this.chaseLoop?.setGain(0.9, 0.3);
    g.events.emit('chase', true);
  }

  onChaseEnd() {
    this.chaseLoop?.setGain(0, 1.2);
    this.game.events.emit('chase', false);
  }

  update(dt) {
    const g = this.game;
    if (!this.awake || this.state === S.DEAD) { this.body.root.visible = this.forceVisible || false; return; }
    this.tick++;
    this.stateTime += dt;
    this.repathTimer -= dt;
    this.doorWait = Math.max(0, this.doorWait - dt);
    this.listenTimer = Math.max(0, this.listenTimer - dt);
    this.suspicion = Math.max(0, this.suspicion - dt * (this.state === S.PATROL ? 4 : 1.5));
    this.moveDir = null;
    this.aggression = g.story.aggression();

    if (this.state === S.VENT) { this.updateVent(dt); return; }
    if (this.state === S.DORMANT) return;

    // Loud places repel it (except during the sweep when it is frantic).
    if (!g.story.sweepActive && this.state !== S.RETREAT && this.state !== S.CHASE) {
      for (const r of g.nav.repel) if (Math.hypot(this.pos.x - r.x, this.pos.z - r.z) < r.r * 0.8) { this.setState(S.RETREAT); break; }
    }

    const sees = this.state === S.WATCH || this.state === S.AMBUSH || this.state === S.RETREAT ? this.sight(dt) && this.playerDist < 4 : this.sight(dt);
    const pl = g.player;
    if (sees) {
      const prevMem = this.memory;
      this.memory = { x: pl.pos.x, z: pl.pos.z, t: g.time, vx: pl.vel.x, vz: pl.vel.y };
      if (prevMem && g.time - prevMem.t < 0.5) { this.memory.vx = pl.vel.x; this.memory.vz = pl.vel.y; }
      this.suspicion = 100;
      if (this.state !== S.CHASE && this.state !== S.LURED) this.setState(S.CHASE);
      this.lostTime = 0;
    }

    switch (this.state) {
      case S.PATROL: {
        if (!this.goal) this.goal = this.pickPatrolPoint();
        if (this.listenTimer > 0) break;
        const r = this.goTo(this.goal.x, this.goal.z, 1.25 + this.aggression * 0.4, { repath: 6 });
        if (r === 'arrived' || r === 'fail' || r === 'blocked' || this.stateTime > 40) {
          this.goal = null; this.path = null; this.stateTime = 0;
          this.listenTimer = this.rng.range(1.5, 3.5);
          this.attention.set(this.pos.x + this.rng.range(-5, 5), this.pos.y + 1.4, this.pos.z + this.rng.range(-5, 5));
          // Manipulation: close a door the player left open behind it.
          if (this.openedDoor && this.rng.chance(0.4)) { const d = this.openedDoor; this.openedDoor = null; setTimeout(() => { if (this.state === S.PATROL && Math.hypot(d.cx - this.pos.x, d.cz - this.pos.z) < 6) g.doors.close(d, { slow: true, byEntity: true }); }, 1500); }
        }
        this.maybeMimic(dt);
        break;
      }
      case S.INVESTIGATE: {
        const r = this.goTo(this.goal.x, this.goal.z, 1.9 + this.aggression * 0.5, { repath: 3 });
        if (r === 'arrived' || r === 'fail' || r === 'blocked') {
          this.listenTimer = 2.2;
          this.setState(S.SEARCH, { center: this.goal });
        }
        break;
      }
      case S.HUNT: {
        const tgt = this.memory || this.goal;
        const r = this.goTo(tgt.x, tgt.z, 2.6 + this.aggression * 0.7, { repath: 1.5 });
        if (r === 'arrived' || r === 'fail' || r === 'blocked' || this.stateTime > 30) this.setState(S.SEARCH, { center: tgt });
        break;
      }
      case S.CHASE: {
        if (!sees) {
          this.lostTime += dt;
          if (this.lostTime > 2.8) { this.setState(S.LOST); break; }
        }
        const tgt = sees ? pl.pos : { x: this.memory.x + this.memory.vx * Math.min(1.5, this.lostTime), z: this.memory.z + this.memory.vz * Math.min(1.5, this.lostTime) };
        this.goTo(tgt.x, tgt.z, 3.85 + this.aggression * 0.35, { repath: 0.35, vents: false });
        this.attention.set(pl.pos.x, pl.pos.y + 1.5, pl.pos.z);
        this.body.reach = Math.min(1, this.body.reach + dt * 2);
        if (this.playerDist < 1.05 && sees && !this.noKill && Math.abs(pl.pos.y - this.pos.y) < 1.5) g.die('caught');
        break;
      }
      case S.LOST: {
        const m = this.memory;
        const r = this.goTo(m.x + m.vx * 2, m.z + m.vz * 2, 2.4, { repath: 4 });
        if (r !== 'moving' || this.stateTime > 8) { this.listenTimer = 1.5; this.setState(S.SEARCH, { center: m }); }
        break;
      }
      case S.SEARCH: {
        if (this.listenTimer > 0) break;
        if (!this.searchPoints.length || this.stateTime > 28) { this.setState(S.PATROL); break; }
        const p = this.searchPoints[0];
        const r = this.goTo(p.x, p.z, 1.6 + this.aggression * 0.4, { repath: 5 });
        if (r !== 'moving') {
          this.searchPoints.shift();
          this.path = null;
          if (p.spot) { this.checkSpot = p.spot; this.setState(S.CHECK); this.checkSpot = p.spot; }
          else { this.listenTimer = this.rng.range(1, 2.5); this.attention.set(this.pos.x + this.rng.range(-4, 4), this.pos.y + 1.2, this.pos.z + this.rng.range(-4, 4)); }
        }
        break;
      }
      case S.CHECK: {
        const s = this.checkSpot;
        if (!s) { this.setState(S.SEARCH); break; }
        this.attention.set(s.x, s.y + 1.5, s.z);
        const want = Math.atan2(s.x - this.pos.x, s.z - this.pos.z);
        this.facing += (want - this.facing) * Math.min(1, dt * 3);
        if (this.stateTime > 1.6) {
          const hidden = pl.hiding === s;
          const breathing = pl.exhausted || (!pl.holdingBreath && pl.fear > 0.75);
          const sawEnter = this.lastSawHide === s && g.time - (this.lastSawHideT || 0) < 20;
          if (hidden && (breathing || sawEnter) && !this.noKill) {
            g.audio?.playAt('doorSlam', { x: s.x, y: s.y + 1, z: s.z });
            g.die('found');
          } else {
            if (hidden) g.audio?.playAt('inhale', { x: this.pos.x, y: this.pos.y + 2, z: this.pos.z }, { gain: 0.8, variant: 1 });
            this.checkSpot = null;
            this.setState(this.searchPoints.length ? S.SEARCH : S.PATROL, { force: true });
            if (this.state === S.SEARCH) this.stateTime = 10; // keep remaining points
          }
        }
        break;
      }
      case S.STALK: this.updateStalk(dt); break;
      case S.WATCH: this.updateWatch(dt); break;
      case S.AMBUSH: this.updateAmbush(dt); break;
      case S.RETREAT: {
        if (!this.goal) {
          let best = null, bd = -1;
          for (let k = 0; k < 8; k++) { const p = this.pickPatrolPoint(); const d = Math.hypot(p.x - pl.pos.x, p.z - pl.pos.z); if (d > bd) { bd = d; best = p; } }
          this.goal = best;
        }
        const r = this.goTo(this.goal.x, this.goal.z, 2.4, { repath: 8 });
        if (r !== 'moving' || this.stateTime > 25) { this.suspicion = 0; this.setState(S.PATROL); }
        break;
      }
      case S.LURED: {
        const o = this.lureTarget;
        if (!o || o.dead) { this.setState(S.RETREAT); break; }
        const r = this.goTo(o.x, o.z, 2.8, { repath: 2 });
        this.attention.set(o.x, o.y, o.z);
        if (r !== 'moving' || Math.hypot(o.x - this.pos.x, o.z - this.pos.z) < 1.0) {
          this.listenTimer = 2;
          o.eat?.();
          this.lureTarget = null;
          this.setState(S.RETREAT);
        }
        break;
      }
    }

    this.integrate(dt);
    this.updateChaseAudio();
    this.updateBody(dt);
  }

  // Watch: stand in the dark at the edge of your view. Gone when you look properly.
  startWatch() {
    const g = this.game, pl = g.player;
    const fwd = pl.forward(new THREE.Vector3());
    for (let k = 0; k < 30; k++) {
      const a = Math.atan2(fwd.x, fwd.z) + this.rng.range(-0.6, 0.6);
      const d = this.rng.range(9, 17);
      const x = pl.pos.x + Math.sin(a) * d, z = pl.pos.z + Math.cos(a) * d;
      const ci = g.nav.cellOf(x, z);
      if (!g.grid.inb(Math.floor(x), Math.floor(z)) || !g.nav.passable(ci) || this.map.type[ci] !== CELL.FLOOR) continue;
      if (!g.grid.los(pl.pos.x, pl.pos.z, x, z, 'sight')) continue;
      if (g.lights.levelAt(x, z) > 0.25) continue;
      this.teleport(Math.floor(x) + 0.5, Math.floor(z) + 0.5);
      this.facing = Math.atan2(pl.pos.x - x, pl.pos.z - z);
      this.body.root.visible = true;
      this.setState(S.WATCH, { force: true });
      return true;
    }
    return false;
  }

  updateWatch(dt) {
    const g = this.game, pl = g.player;
    this.attention.set(pl.pos.x, pl.pos.y + 1.6, pl.pos.z);
    const toE = new THREE.Vector3(this.pos.x - pl.pos.x, 0, this.pos.z - pl.pos.z);
    const d = toE.length(); toE.normalize();
    const f = pl.forward(new THREE.Vector3()); f.y = 0; f.normalize();
    const look = f.dot(toE);
    const lit = pl.flashOn && look > 0.94 && d < 22;
    if (look > 0.985 || lit || this.stateTime > 7 || d < 5) {
      // Vanish: if out of sight relocate; otherwise simply cease to be there.
      this.game.audio?.playAt('inhale', { x: this.pos.x, y: this.pos.y + 2, z: this.pos.z }, { gain: 0.35, variant: 1 });
      if (lit) this.game.lights.killNear(this.pos.x, this.pos.z, 4, 1.2);
      this.relocateFar();
      this.setState(this.awake ? S.PATROL : S.DORMANT, { force: true });
    }
  }

  relocateFar() {
    const pl = this.game.player.pos;
    for (let k = 0; k < 20; k++) {
      const p = this.pickPatrolPoint();
      if (Math.hypot(p.x - pl.x, p.z - pl.z) > 25 && !this.game.grid.los(pl.x, pl.z, p.x, p.z)) { this.teleport(p.x, p.z); return; }
    }
  }

  // Stalk: follow at a distance, step when you step, one extra step when you stop.
  startStalk() {
    const g = this.game, pl = g.player;
    const f = pl.forward(new THREE.Vector3());
    const base = Math.atan2(-f.x, -f.z);
    let behind = null;
    for (let k = 0; k < 24 && !behind; k++) {
      const a = base + this.rng.range(-1.2, 1.2), d = this.rng.range(7, 14);
      const p = g.nav.randomPointNear(this.rng, pl.pos.x + Math.sin(a) * d, pl.pos.z + Math.cos(a) * d, 0, 2);
      if (!p || Math.abs(this.map.floorAt(p.x, p.z) - pl.pos.y) > 1.5) continue;
      const path = g.nav.findPath(p.x, p.z, pl.pos.x, pl.pos.z, { vents: false, maxIter: 3000 });
      if (!path || g.nav.pathLength(path) > 22) continue;
      // Out of view, or in the dark behind you.
      if (g.grid.los(pl.pos.x, pl.pos.z, p.x, p.z) && g.lights.levelAt(p.x, p.z) > 0.2) continue;
      behind = p;
    }
    if (!behind) return false;
    this.teleport(behind.x, behind.z);
    this.body.root.visible = true;
    this.setState(S.STALK, { force: true });
    this.stalkSteps = 0;
    if (!this._stepHook) {
      this._stepHook = (sprint, settle) => this.onPlayerStep(sprint, settle);
      pl.footstepListeners.push(this._stepHook);
    }
    return true;
  }

  onPlayerStep(sprint, settle) {
    const g = this.game;
    if (this.state !== S.STALK || !this.awake) return;
    const d = Math.hypot(this.pos.x - g.player.pos.x, this.pos.z - g.player.pos.z);
    if (d > 18) return;
    const pos = { x: this.pos.x, y: this.pos.y + 0.1, z: this.pos.z };
    if (!settle) {
      this.stalkSteps++;
      g.audio?.playAt('step_concrete', pos, { gain: 0.5, delay: 0.09 + Math.random() * 0.04, jitter: 0.1 });
    } else if (this.stalkSteps > 4) {
      g.playerModel.note('stop');
      // It learns that you stop to listen; sometimes it stops with you.
      const learned = g.playerModel.stops > 4 && this.rng.chance(0.5);
      if (!learned) g.audio?.playAt('step_concrete', pos, { gain: 0.65, delay: 0.55 });
      this.stalkSteps = 0;
    }
  }

  updateStalk(dt) {
    const g = this.game, pl = g.player;
    const d = Math.hypot(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z);
    this.attention.set(pl.pos.x, pl.pos.y + 1.6, pl.pos.z);
    // Being looked at?
    const toE = new THREE.Vector3(this.pos.x - pl.pos.x, 0, this.pos.z - pl.pos.z).normalize();
    const f = pl.forward(new THREE.Vector3()); f.y = 0; f.normalize();
    const looked = f.dot(toE) > 0.75 && g.grid.los(pl.pos.x, pl.pos.z, this.pos.x, this.pos.z) && d < 16;
    if (looked) {
      if (g.lights.levelAt(this.pos.x, this.pos.z) < 0.2 && !(pl.flashOn && f.dot(toE) > 0.93)) {
        // Freeze in the dark. Did you see that?
        this.freezeT = (this.freezeT || 0) + dt;
        if (this.freezeT > 1.2) { this.relocateFar(); this.setState(S.PATROL, { force: true }); this.freezeT = 0; }
        return;
      }
      this.relocateFar(); this.setState(S.PATROL, { force: true });
      return;
    }
    this.freezeT = 0;
    if (d > 9) this.goTo(pl.pos.x, pl.pos.z, Math.min(pl.speed + 0.4, 3.0), { repath: 1.0, vents: false });
    if (this.stateTime > this.rng.range(25, 45)) {
      const r = this.rng.next();
      if (r < 0.35 + this.aggression * 0.3) { this.memory = { x: pl.pos.x, z: pl.pos.z, t: g.time, vx: 0, vz: 0 }; this.setState(S.HUNT); }
      else if (r < 0.7) this.startAmbush();
      else this.setState(S.RETREAT);
    }
  }

  // Ambush: hang from the ceiling over a doorway the player uses often.
  startAmbush() {
    const g = this.game, pl = g.player;
    const favs = g.playerModel.favouriteDoors(4).map((id) => g.doors.get(id)).filter(Boolean)
      .filter((d) => { const dd = Math.hypot(d.cx - pl.pos.x, d.cz - pl.pos.z); return dd > 8 && dd < 35 && !g.grid.los(pl.pos.x, pl.pos.z, d.cx, d.cz); });
    const door = favs[0] || g.doors.list.filter((d) => !g.doors.isLocked(d) && d.style !== 'gate' && Math.hypot(d.cx - pl.pos.x, d.cz - pl.pos.z) > 10 && Math.hypot(d.cx - pl.pos.x, d.cz - pl.pos.z) < 30)[0];
    if (!door) { this.setState(S.RETREAT); return; }
    const side = door.def.sides[0];
    const x = side.x + 0.5, z = side.z + 0.5;
    if (g.grid.los(pl.pos.x, pl.pos.z, x, z)) { this.setState(S.RETREAT); return; }
    this.teleport(x, z);
    this.ambushPoint = { x, z, ceil: this.map.ceilH[this.map.idx(side.x, side.z)] };
    this.setState(S.AMBUSH, { force: true });
  }

  updateAmbush(dt) {
    const g = this.game, pl = g.player;
    const d = Math.hypot(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z);
    const toE = new THREE.Vector3(this.pos.x - pl.pos.x, 0, this.pos.z - pl.pos.z).normalize();
    const f = pl.forward(new THREE.Vector3());
    if (pl.flashOn && f.y > 0.25 && f.dot(toE) > 0.5 && d < 9 && g.grid.los(pl.pos.x, pl.pos.z, this.pos.x, this.pos.z)) {
      g.audio?.playAt('scratch', { x: this.pos.x, y: this.ambushPoint.ceil - 0.3, z: this.pos.z }, { gain: 0.8 });
      this.setState(S.RETREAT); return;
    }
    if (d < 2.3 && g.grid.los(pl.pos.x, pl.pos.z, this.pos.x, this.pos.z)) {
      g.audio?.playAt('heavyStep', { x: this.pos.x, y: this.pos.y, z: this.pos.z }, { gain: 1.4 });
      this.detect = 1; this.setState(S.CHASE); return;
    }
    if (this.stateTime > 50) this.setState(S.PATROL);
  }

  // Mimicry: play a stolen sound from where it is, to draw you in.
  maybeMimic(dt) {
    const g = this.game;
    this.mimicTimer -= dt;
    if (this.mimicTimer > 0) return;
    this.mimicTimer = this.rng.range(35, 80) / (0.6 + this.aggression);
    const pl = g.player.pos;
    const d = Math.hypot(pl.x - this.pos.x, pl.z - this.pos.z);
    if (d < 7 || d > 26) return;
    const list = [...this.repertoire];
    const name = this.rng.pick(list);
    g.audio?.playAt(name, { x: this.pos.x, y: this.pos.y + 1, z: this.pos.z }, { gain: 0.9 });
    if (name.startsWith('step_')) for (let k = 1; k < 5; k++) g.audio?.playAt(name, { x: this.pos.x, y: this.pos.y, z: this.pos.z }, { gain: 0.8, delay: k * 0.55 });
    g.ui.caption(captionFor(name));
  }

  lure(osc) {
    if (!this.awake || this.state === S.CHASE && this.playerDist < 4) return;
    this.lureTarget = osc;
    this.setState(S.LURED, { force: true });
  }

  updateChaseAudio() {
    if (this.chaseLoop && this.tick % 3 === 0) {
      this.chaseLoop.pos.x = this.pos.x; this.chaseLoop.pos.z = this.pos.z; this.chaseLoop.pos.y = this.pos.y + 1.8;
      this.game.audio.updateLoopPosition(this.chaseLoop);
    }
  }

  // Stop-motion: commit the pose and drawn position at ~9 fps outside chases.
  updateBody(dt) {
    const b = this.body;
    const g = this.game;
    if (!b.root.visible) return;
    const chase = this.state === S.CHASE || this.state === S.HUNT;
    const fps = chase ? 60 : 9;
    this.poseAccum += dt;
    if (this.poseAccum < 1 / fps) return;
    const step = this.poseAccum;
    this.poseAccum = 0;
    // Chase "skips": occasionally jump the drawn position ahead.
    b.root.position.copy(this.pos);
    if (chase && Math.random() < 0.04) b.root.position.addScaledVector(new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing)), 0.25);
    b.root.rotation.set(0, this.facing, 0);
    if (this.state === S.AMBUSH) {
      b.root.position.y = this.ambushPoint.ceil;
      b.root.rotation.set(Math.PI, this.facing, 0);
      b.poseCeiling(g.time);
      return;
    }
    if (this.state !== S.CHASE) b.reach = Math.max(0, b.reach - step);
    // Dish aim in local frame
    const dx = this.attention.x - this.pos.x, dz = this.attention.z - this.pos.z;
    let yaw = Math.atan2(dx, dz) - this.facing;
    while (yaw > Math.PI) yaw -= Math.PI * 2; while (yaw < -Math.PI) yaw += Math.PI * 2;
    yaw = Math.max(-1.3, Math.min(1.3, yaw));
    const pitch = Math.atan2(this.attention.y - (this.pos.y + 2.2), Math.hypot(dx, dz));
    const doorCrouch = this.map.type[g.nav.cellOf(this.pos.x, this.pos.z)] === CELL.DOOR ? 1 : 0;
    b.pose(step, this.speed, { t: g.time, hunch: this.state === S.WATCH ? 0.3 : 0.5, listening: this.listenTimer > 0 || this.state === S.WATCH, dishLocal: { yaw, pitch }, crouch: doorCrouch });
  }

  // Silence factor (0..1) for the audio engine: path distance from the listener.
  presence() {
    if (!this.awake || this.state === S.DORMANT || this.state === S.DEAD) return 0;
    const f = this.game.audio?.field;
    let d;
    if (f) d = f[this.game.nav.cellOf(this.pos.x, this.pos.z)];
    if (!isFinite(d)) d = Math.hypot(this.pos.x - this.game.player.pos.x, this.pos.z - this.game.player.pos.z) * 1.6;
    const r = this.state === S.VENT ? 8 : 16;
    return Math.max(0, Math.min(1, 1 - (d - 2.5) / r));
  }

  serialize() { return { repertoire: [...this.repertoire], awake: this.awake }; }
  deserialize(d) {
    this.ventLoop?.stop(0.1); this.chaseLoop?.stop(0.1); this.chaseLoop = null; this.ventLoop = null;
    this.reset();
    if (d?.repertoire) this.repertoire = new Set(d.repertoire);
  }
}

function captionFor(name) {
  if (name.startsWith('step')) return '[footsteps, somewhere close]';
  return { flashOn: '[a flashlight clicks]', doorOpen: '[a door creaks open]', gasp: '[someone gasps]', piano: '[a piano note]', phone: '[a phone rings]', static: '[radio static]', oscTone: '[a test tone]', breaker: '[a switch snaps]', valve: '[metal squeals]' }[name] || '[a sound]';
}

// ----------------------------------------------------------------------------
// Pacing director: build-up / peak / relax. Hints zones, never positions.
// ----------------------------------------------------------------------------
export class Director {
  constructor(game) {
    this.game = game;
    this.rng = game.rng.fork('director');
    this.reset();
  }
  reset() { this.tension = 0; this.mode = 'build'; this.modeTime = 0; this.quiet = 0; this.hintZone = null; this.eventTimer = 40; this.peakTime = 0; }

  update(dt) {
    const g = this.game, ai = g.ai;
    if (!ai.awake) return;
    const pres = ai.presence();
    const chase = ai.state === S.CHASE;
    this.tension += ((chase ? 1 : pres) - this.tension) * Math.min(1, dt * (chase ? 1.5 : 0.3));
    this.modeTime += dt;
    if (g.story.sweepActive || g.story.flags.finale) { this.mode = 'peak'; return; }
    if (this.tension > 0.65) { this.peakTime += dt; this.quiet = 0; } else this.peakTime = Math.max(0, this.peakTime - dt * 0.5);
    if (this.tension < 0.15) this.quiet += dt; else this.quiet = 0;

    if (this.mode !== 'relax' && this.peakTime > 28 && !chase) {
      this.mode = 'relax'; this.modeTime = 0; this.peakTime = 0;
      ai.setState(S.RETREAT, { force: true });
    }
    if (this.mode === 'relax' && this.modeTime > 50 - ai.aggression * 20) { this.mode = 'build'; this.modeTime = 0; }

    if (this.mode === 'build') {
      const patience = 70 - ai.aggression * 35;
      if (this.quiet > patience && ai.state === S.PATROL) {
        this.quiet = 0;
        const r = this.rng.next();
        if (r < 0.4 && ai.startStalk()) return;
        if (r < 0.55 && ai.startWatch()) return;
        // Zone-level hint only.
        this.hintZone = g.map.zoneAt(g.player.pos.x, g.player.pos.z);
        ai.goal = null; ai.path = null;
      }
    }
  }
}
