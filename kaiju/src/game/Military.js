// The military response. A director keeps a number of tanks, attack helicopters, jets
// and artillery batteries in play that scales with the threat level. Tanks drive the
// street grid to firing positions; helicopters orbit and fire rocket salvos and cannon
// bursts; jets make strafing runs; artillery shells fall from the hills. Everything
// shoots real projectiles that can miss and hit the city instead.
import * as THREE from 'three';
import { PropSet } from '../world/Props.js';
import { MILITARY } from '../core/Config.js';
import { clamp, angleDiff } from '../core/Rng.js';

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
const _e = new THREE.Euler(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function segCapsuleDist(a, b, c, d) {
  // closest distance between segments ab and cd (approximate by sampling cd)
  let best = Infinity;
  for (let i = 0; i <= 4; i++) {
    _v.lerpVectors(c, d, i / 4);
    const ab = _v2.subVectors(b, a);
    const t = clamp(_v.clone().sub(a).dot(ab) / Math.max(ab.lengthSq(), 1e-6), 0, 1);
    best = Math.min(best, _v.distanceTo(a.clone().addScaledVector(ab, t)));
  }
  return best;
}

export class Military {
  constructor(play) {
    this.play = play;
    this.units = [];
    this.shots = [];
    this.ready = false;
    this.spawnT = 6;
    this.jetT = 40;
    this.artT = 30;
    this.suppressT = 0;
    play.propsReady.then((gltf) => {
      if (!gltf) return;
      const S = play.scene;
      this.sets = {
        hull: new PropSet(S, gltf, 'mil_tank', 24), turret: new PropSet(S, gltf, 'mil_turret', 24),
        heli: new PropSet(S, gltf, 'mil_heli', 14), rotor: new PropSet(S, gltf, 'mil_rotor', 14, { cast: false }),
        tail: new PropSet(S, gltf, 'mil_tailrotor', 14, { cast: false }), jet: new PropSet(S, gltf, 'mil_jet', 8),
        missile: new PropSet(S, gltf, 'mil_missile', 80, { cast: false }),
      };
      this.free = { hull: [], heli: [], jet: [], missile: [] };
      for (const k of Object.keys(this.free)) for (let i = this.sets[k].cap - 1; i >= 0; i--) this.free[k].push(i);
      for (const set of Object.values(this.sets)) { for (let i = 0; i < set.cap; i++) set.add(_m.makeScale(0, 0, 0)); set.flush(); }
      this.ready = true;
    });
  }

  // ------------------------------------------------------------------ director

  update(dt) {
    if (!this.ready) return;
    const P = this.play;
    if (P.state !== 'play') { this._draw(dt); return; }
    const lvl = Math.max(0, Math.min(5, Math.round(P.threat)));
    this.suppressT = Math.max(0, this.suppressT - dt);
    if (P.roarT !== undefined) { this.suppressT = 4; P.roarT = undefined; }
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 4;
      const count = (k) => this.units.filter((u) => u.kind === k && u.hp > 0).length;
      if (count('tank') < MILITARY.tanks[lvl]) this._spawnTank();
      else if (count('heli') < MILITARY.helis[lvl]) this._spawnHeli();
    }
    this.jetT -= dt;
    if (this.jetT <= 0 && MILITARY.jets[lvl] > 0) { this.jetT = 28 - lvl * 3; for (let i = 0; i < MILITARY.jets[lvl]; i++) setTimeout(() => this._spawnJet(i), i * 1500); }
    this.artT -= dt;
    if (this.artT <= 0 && MILITARY.artillery[lvl] > 0) { this.artT = 12 - lvl; for (let i = 0; i < MILITARY.artillery[lvl]; i++) this._artillery(i * 0.6); }
    for (const u of this.units) this['_' + u.kind](u, dt);
    this._shots(dt);
    this.units = this.units.filter((u) => !u.gone);
    this._draw(dt);
  }

  _alloc(k) { return this.free[k].pop(); }
  _release(k, i) { this.free[k].push(i); this.sets[k].hide(i); if (k === 'hull') this.sets.turret.hide(i); if (k === 'heli') { this.sets.rotor.hide(i); this.sets.tail.hide(i); } }

  // ------------------------------------------------------------------ tanks

  _spawnTank() {
    const i = this._alloc('hull');
    if (i === undefined) return;
    const P = this.play, city = P.world.city, kp = P.kaiju.pos;
    // enter on a road 800-1100 m from the kaiju, on the city side
    const roads = city.xRoads.filter((r) => Math.abs(r.c - kp.x) < 1400);
    const r = roads[Math.floor(Math.random() * roads.length)];
    const z = clamp(kp.z - 800 - Math.random() * 300, city.z0 + 20, city.coast - 30);
    const u = { kind: 'tank', i, pos: new THREE.Vector3(r.c + (Math.random() < 0.5 ? 3 : -3), 0, z), yaw: 0, tur: 0, hp: 120, axis: 'z', fireT: 3 + Math.random() * 3, v: 0 };
    this.units.push(u);
    P.feedPush('Armour approaching');
  }

  _tank(u, dt) {
    const P = this.play, k = P.kaiju;
    if (u.hp <= 0) { u.deadT = (u.deadT || 0) + dt; if (Math.random() < dt * 4) P.particles.smoke(u.pos, 4, { dark: 0.05, rise: 6, life: 12, heat: 0.4 }); if (u.deadT > 25) { u.gone = true; this._release('hull', u.i); } return; }
    const kp = k.pos;
    const d = Math.hypot(kp.x - u.pos.x, kp.z - u.pos.z);
    const want = 330 + (u.i % 4) * 40;
    // drive along the grid: move on the axis with the larger error, switching at intersections
    const city = P.world.city;
    if (d > want || d < 150) {
      const sign = d < 150 ? -1 : 1;
      const tx = (kp.x - u.pos.x) * sign, tz = (kp.z - u.pos.z) * sign;
      const onX = this._nearRoad(city.xRoads, u.pos.x), onZ = this._nearRoad(city.zRoads, u.pos.z);
      if (onX && onZ) u.axis = Math.abs(tz) > Math.abs(tx) ? 'z' : 'x';
      else if (onX) u.axis = 'z'; else if (onZ) u.axis = 'x';
      const dir = u.axis === 'z' ? Math.sign(tz) : Math.sign(tx);
      u.v = Math.min(14, u.v + dt * 4);
      const yaw = u.axis === 'z' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      u.yaw += angleDiff(u.yaw, yaw) * Math.min(1, dt * 2);
      u.pos.x += Math.sin(u.yaw) * u.v * dt;
      u.pos.z += Math.cos(u.yaw) * u.v * dt;
      // snap to the road centre line we are driving on
      if (u.axis === 'z' && onX) u.pos.x += (onX.c + (dir > 0 ? -3 : 3) - u.pos.x) * Math.min(1, dt * 2);
      if (u.axis === 'x' && onZ) u.pos.z += (onZ.c + (dir > 0 ? 3 : -3) - u.pos.z) * Math.min(1, dt * 2);
    } else u.v = Math.max(0, u.v - dt * 8);
    // turret tracks the chest
    const tgt = _v.copy(kp).setY(kp.y + k.height * 0.6);
    const ty = Math.atan2(tgt.x - u.pos.x, tgt.z - u.pos.z);
    u.tur += angleDiff(u.tur, ty) * Math.min(1, dt * 1.5);
    u.fireT -= dt;
    if (u.fireT <= 0 && d < 700 && this.suppressT <= 0 && Math.abs(angleDiff(u.tur, ty)) < 0.08) {
      u.fireT = 4 + Math.random() * 3;
      const muzzle = new THREE.Vector3(u.pos.x + Math.sin(u.tur) * 7, 2.7, u.pos.z + Math.cos(u.tur) * 7);
      const aim = tgt.clone().add(new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 14));
      this._fire('shell', muzzle, aim, 420, MILITARY.tankDamage);
      P.particles.add.spawn({ p: muzzle.toArray(), life: 0.12, size: 6, size1: 10, color: [8, 5, 2], alpha: 1, tile: 4, fadeIn: 0.01 });
      P.particles.smoke(muzzle, 3, { dark: 0.3, rise: 2, life: 4 });
      P.app.audio && P.app.audio.cannon(muzzle);
    }
  }

  _nearRoad(roads, c) { for (const r of roads) if (Math.abs(c - r.c) < r.w / 2) return r; return null; }

  // ------------------------------------------------------------------ helicopters

  _spawnHeli() {
    const i = this._alloc('heli');
    if (i === undefined) return;
    const P = this.play, kp = P.kaiju.pos;
    const a = Math.random() * Math.PI * 2;
    const u = { kind: 'heli', i, pos: new THREE.Vector3(kp.x + Math.cos(a) * 1500, 160, kp.z + Math.sin(a) * 1500 - 400), vel: new THREE.Vector3(), yaw: 0, roll: 0, pitch: 0,
      hp: 90, ang: a, R: 240 + Math.random() * 120, alt: 75 + Math.random() * 70, dirn: Math.random() < 0.5 ? 1 : -1, fireT: 5 + Math.random() * 4, gunT: 2, rotor: 0 };
    this.units.push(u);
    P.feedPush('Gunships inbound');
  }

  _heli(u, dt) {
    const P = this.play, k = P.kaiju, kp = k.pos;
    u.rotor += dt * 32;
    if (u.hp <= 0) {
      // spinning crash
      u.vel.y -= 9.81 * dt;
      u.pos.addScaledVector(u.vel, dt);
      u.yaw += dt * 6;
      if (Math.random() < dt * 20) P.particles.smoke(u.pos, 4, { dark: 0.08, rise: 1, life: 6, heat: 0.6 });
      const g = P.world.solidHeightAt(u.pos.x, u.pos.z);
      if (u.pos.y <= g + 1) { P.explode(u.pos.clone(), 16, 120, new THREE.Vector3(0, 10, 0)); u.gone = true; this._release('heli', u.i); }
      return;
    }
    u.ang += u.dirn * dt * 0.12;
    const H = k.height;
    const tgt = new THREE.Vector3(kp.x + Math.cos(u.ang) * u.R * (H / 58 + 0.3), Math.max(u.alt, P.world.solidHeightAt(u.pos.x, u.pos.z) + 30), kp.z + Math.sin(u.ang) * u.R * (H / 58 + 0.3));
    const want = tgt.sub(u.pos);
    const dist = want.length();
    want.normalize().multiplyScalar(Math.min(45, dist * 0.5));
    u.vel.lerp(want, Math.min(1, dt * 0.8));
    u.pos.addScaledVector(u.vel, dt);
    const face = Math.atan2(kp.x - u.pos.x, kp.z - u.pos.z);
    u.yaw += angleDiff(u.yaw, face) * Math.min(1, dt * 1.5);
    // bank into the motion
    const lv = _v.set(u.vel.x, 0, u.vel.z);
    const fwd = _v2.set(Math.sin(u.yaw), 0, Math.cos(u.yaw));
    u.pitch += (clamp(lv.dot(fwd) * 0.012, -0.35, 0.35) - u.pitch) * Math.min(1, dt * 2);
    u.roll += (clamp(-lv.dot(new THREE.Vector3(fwd.z, 0, -fwd.x)) * 0.012, -0.4, 0.4) - u.roll) * Math.min(1, dt * 2);
    P.app.audio && P.app.audio.loop('heli' + u.i, 'rotor', u.pos, { gain: 0.9, ref: 120, rate: 1 + (u.i % 3) * 0.04 });
    if (this.suppressT > 0) return;
    const chest = kp.clone().setY(kp.y + H * 0.6);
    u.fireT -= dt;
    if (u.fireT <= 0 && u.pos.distanceTo(chest) < 700) {
      u.fireT = 7 + Math.random() * 3;
      for (let n = 0; n < 4; n++) setTimeout(() => { if (u.hp > 0) this._fire('rocket', u.pos.clone().add(new THREE.Vector3(0, -1.5, 0)), chest.clone().add(new THREE.Vector3((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20)), 160, MILITARY.heliDamage * 1.5); }, n * 180);
    }
    u.gunT -= dt;
    if (u.gunT <= 0) {
      u.gunT = 0.09;
      if (!u.burst || u.burst <= 0) { u.burst = Math.random() < 0.02 ? 22 : 0; return; }
      u.burst--;
      this._fire('bullet', u.pos.clone(), chest.clone().add(new THREE.Vector3((Math.random() - 0.5) * 24, (Math.random() - 0.5) * 24, (Math.random() - 0.5) * 24)), 700, 0.35);
      P.app.audio && P.app.audio.mg(u.pos);
    }
  }

  // ------------------------------------------------------------------ jets and artillery

  _spawnJet(n) {
    const i = this._alloc('jet');
    if (i === undefined) return;
    const P = this.play, kp = P.kaiju.pos;
    const a = Math.random() * Math.PI * 2;
    const start = new THREE.Vector3(kp.x + Math.cos(a) * 3200, 260 + n * 30, kp.z + Math.sin(a) * 3200);
    const dir = new THREE.Vector3(kp.x - start.x, 0, kp.z - start.z).normalize();
    const u = { kind: 'jet', i, pos: start, dir, speed: 230, hp: 60, fired: false, t: 0 };
    this.units.push(u);
    P.feedPush('Air strike!');
  }

  _jet(u, dt) {
    const P = this.play, kp = P.kaiju.pos;
    u.t += dt;
    if (u.hp <= 0) {
      u.dir.y -= dt * 0.5;
      u.pos.addScaledVector(u.dir, u.speed * dt);
      if (Math.random() < dt * 30) P.particles.smoke(u.pos, 5, { dark: 0.07, rise: 0, life: 6, heat: 0.7 });
      if (u.pos.y <= P.world.solidHeightAt(u.pos.x, u.pos.z) + 2) { P.explode(u.pos.clone(), 26, 220, u.dir.clone().multiplyScalar(40)); u.gone = true; this._release('jet', u.i); }
      return;
    }
    u.pos.addScaledVector(u.dir, u.speed * dt);
    const d = Math.hypot(kp.x - u.pos.x, kp.z - u.pos.z);
    const ahead = (kp.x - u.pos.x) * u.dir.x + (kp.z - u.pos.z) * u.dir.z;
    if (!u.fired && ahead > 0 && d < 1300 && this.suppressT <= 0) {
      u.fired = true;
      const chest = kp.clone().setY(kp.y + P.kaiju.height * 0.55);
      for (let n = 0; n < 2; n++) setTimeout(() => this._fire('missile', u.pos.clone(), chest.clone().add(new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, 0)), 300, MILITARY.jetDamage), n * 250);
    }
    // pull up after the pass and leave
    if (ahead < -200) u.dir.y = Math.min(0.4, u.dir.y + dt * 0.25);
    P.app.audio && P.app.audio.loop('jet' + u.i, 'jet', u.pos, { gain: 1.4, ref: 250, rate: ahead > 0 ? 1.12 : 0.85 });
    if (u.t > 30) { u.gone = true; this._release('jet', u.i); }
  }

  _artillery(delay) {
    const P = this.play;
    setTimeout(() => {
      if (P.state !== 'play') return;
      const kp = P.kaiju.pos;
      const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * 90;
      const target = new THREE.Vector3(kp.x + Math.cos(a) * r, 0, kp.z + Math.sin(a) * r);
      target.y = P.world.solidHeightAt(target.x, target.z);
      const from = new THREE.Vector3(target.x + 300, 900, target.z - 2200);
      this._fire('artillery', from, target, 520, MILITARY.artilleryDamage);
    }, delay * 1000);
  }

  // ------------------------------------------------------------------ projectiles

  _fire(kind, from, to, speed, dmg) {
    const dir = to.clone().sub(from).normalize();
    const s = { kind, pos: from.clone(), prev: from.clone(), vel: dir.multiplyScalar(speed), dmg, t: 0, target: to.clone() };
    if (kind === 'rocket' || kind === 'missile') {
      const i = this._alloc('missile');
      s.mi = i;
    }
    this.shots.push(s);
  }

  _shots(dt) {
    const P = this.play, k = P.kaiju;
    const caps = k.dead ? [] : k.bodyCapsules();
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.t += dt;
      s.prev.copy(s.pos);
      if (s.kind === 'rocket' || s.kind === 'missile') {
        // light homing
        const want = s.target.clone().sub(s.pos).normalize().multiplyScalar(s.vel.length());
        s.vel.lerp(want, Math.min(1, dt * (s.kind === 'missile' ? 1.5 : 0.6)));
        if (Math.random() < 0.8) P.particles.lit.spawn({ p: s.pos.toArray(), v: [0, 1, 0], life: 3.5, size: 1.6, size1: 7, color: [0.55, 0.55, 0.55], alpha: 0.5, drag: 1, buoy: 0.5, fadeIn: 0.02 });
        P.particles.add.spawn({ p: s.pos.toArray(), life: 0.05, size: 2.2, size1: 1.5, color: [6, 3, 1], alpha: 1, tile: 4, fadeIn: 0.01 });
      } else if (s.kind === 'artillery') {
        s.vel.y -= 9.81 * dt * 0.3;
      } else {
        // tracer
        P.particles.add.spawn({ p: s.pos.toArray(), v: s.vel.toArray(), life: 0.06, size: 0.8, size1: 0.8, color: s.kind === 'shell' ? [8, 5, 2] : [6, 4, 1.5], alpha: 1, tile: 4, stretch: 0.6, fadeIn: 0.01 });
      }
      s.pos.addScaledVector(s.vel, dt);
      let hit = null;
      for (const [a, b, r] of caps) {
        if (segCapsuleDist(a, b, s.prev, s.pos) < r) { hit = 'kaiju'; break; }
      }
      const g = P.world.solidHeightAt(s.pos.x, s.pos.z);
      if (!hit && s.pos.y <= g) hit = 'world';
      if (!hit && s.t > 8) hit = 'expire';
      if (!hit) continue;
      if (s.mi !== undefined) this._release('missile', s.mi);
      this.shots.splice(i, 1);
      if (hit === 'expire') continue;
      const big = s.kind === 'missile' || s.kind === 'artillery' ? 1 : s.kind === 'shell' || s.kind === 'rocket' ? 0.5 : 0.1;
      if (hit === 'kaiju') {
        const dealt = k.damage(s.dmg);
        P.rig.addTrauma(0.08 + big * 0.12);
        if (big >= 0.5) { P.particles.fireball(s.pos, 3 + big * 4); P.app.audio && P.app.audio.explosion(s.pos, big * 0.5); }
        else P.particles.sparks(s.pos, 3, 12);
        if (dealt > 12 && !k.action && !k.special.on && Math.random() < 0.3) k.play('hit', { full: false });
      } else {
        if (big >= 0.5) P.explode(s.pos.clone(), 6 + big * 10, 30 + big * 60, s.vel.clone().normalize().multiplyScalar(8));
        else if (Math.random() < 0.2) P.particles.dust(s.pos, 2, 1, { life: 2 });
      }
    }
  }

  // ------------------------------------------------------------------ damage from the kaiju

  damageSphere(p, r, dmg, src, push) {
    const P = this.play;
    for (const u of this.units) {
      if (u.hp <= 0) continue;
      const d = u.pos.distanceTo(p);
      if (d > r + (u.kind === 'tank' ? 4 : 8)) continue;
      u.hp -= dmg * (1 - 0.5 * Math.min(1, d / r)) + (src === 'stomp' || src === 'melee' || src === 'foot' ? 999 : 0);
      if (u.hp > 0) continue;
      P.score.kills++;
      P.score.extraValue = (P.score.extraValue || 0) + (u.kind === 'jet' ? 9e7 : u.kind === 'heli' ? 3e7 : 8e6);
      P.feedPush(u.kind === 'tank' ? 'Tank destroyed' : u.kind === 'heli' ? 'Gunship down' : 'Jet down');
      if (u.kind === 'tank') { P.explode(u.pos.clone().setY(2), 10, 40, push || new THREE.Vector3(0, 6, 0)); u.flat = src === 'foot' || src === 'stomp'; }
      if (u.kind === 'heli') { u.vel.add(push ? push.clone().multiplyScalar(0.3) : new THREE.Vector3(0, 0, 0)); P.particles.fireball(u.pos, 5); P.app.audio && P.app.audio.stopLoop('heli' + u.i); }
      if (u.kind === 'jet') P.particles.fireball(u.pos, 6);
    }
  }

  // ------------------------------------------------------------------ rendering

  _draw(dt) {
    if (!this.ready) return;
    const S = this.sets;
    for (const u of this.units) {
      if (u.gone) continue;
      if (u.kind === 'tank') {
        const sy = u.flat ? 0.4 : 1;
        _m.compose(u.pos, _q.setFromEuler(_e.set(0, u.yaw, 0)), _s.set(1, sy, 1));
        S.hull.set(u.i, _m);
        _m2.compose(_v.set(u.pos.x, 2.1 * sy, u.pos.z), _q.setFromEuler(_e.set(0, u.tur, 0)), _s.set(1, sy, 1));
        S.turret.set(u.i, _m2);
      } else if (u.kind === 'heli') {
        _q.setFromEuler(_e.set(u.pitch, u.yaw, u.roll, 'YXZ'));
        _m.compose(u.pos, _q, _s.set(1, 1, 1));
        S.heli.set(u.i, _m);
        _m2.makeRotationY(u.rotor).setPosition(0, 3.75, 0.5);
        S.rotor.set(u.i, _m.clone().multiply(_m2));
        _m2.makeRotationX(u.rotor * 2.3).setPosition(0.35, 4.0, -9.0);
        S.tail.set(u.i, _m.clone().multiply(_m2));
      } else if (u.kind === 'jet') {
        _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), u.dir.clone().normalize());
        _m.compose(u.pos, _q, _s.set(1, 1, 1));
        S.jet.set(u.i, _m);
      }
    }
    for (const s of this.shots) {
      if (s.mi === undefined) continue;
      _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), s.vel.clone().normalize());
      _m.compose(s.pos, _q, _s.set(2, 2, 2));
      S.missile.set(s.mi, _m);
    }
    for (const set of Object.values(S)) set.flush();
  }
}
