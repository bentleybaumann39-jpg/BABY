// Street traffic: cars in lanes on every road, keeping their distance, panicking when the
// kaiju comes close, and turning into tumbling wrecks when stepped on, swatted or blasted.
import * as THREE from 'three';
import { PropSet } from '../world/Props.js';
import { Rng } from '../core/Rng.js';

const TYPES = [
  { name: 'car_sedan', w: 45, len: 4.7, speed: 13 },
  { name: 'car_suv', w: 25, len: 4.9, speed: 13 },
  { name: 'car_van', w: 12, len: 5.3, speed: 12 },
  { name: 'car_bus', w: 5, len: 12, speed: 10 },
  { name: 'car_truck', w: 8, len: 16, speed: 10 },
];
const PAINT = [[0.85, 0.85, 0.84], [0.85, 0.85, 0.84], [0.03, 0.03, 0.035], [0.03, 0.03, 0.035], [0.45, 0.46, 0.48], [0.45, 0.46, 0.48],
  [0.18, 0.19, 0.2], [0.42, 0.04, 0.03], [0.05, 0.12, 0.3], [0.55, 0.5, 0.4], [0.75, 0.55, 0.05], [0.06, 0.2, 0.1]];
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler(), _c = new THREE.Color();

export class Traffic {
  constructor(play) {
    this.play = play;
    const city = play.world.city;
    this.ready = false;
    this.cars = [];
    this.lanes = [];
    this.flying = [];
    const rng = new Rng(city.seed + 5);
    play.propsReady.then((gltf) => {
      if (!gltf) return;
      this.sets = TYPES.map((t) => new PropSet(play.scene, gltf, t.name, 400, { key: '-car' }));
      // lanes: right-hand traffic on every road
      const z0 = city.z0, z1 = city.coast - 4, x0 = city.x0, x1 = city.x1;
      for (const r of city.xRoads) {
        const n = Math.max(1, Math.floor(r.w / 2 / 3.6));
        for (let k = 0; k < n; k++) {
          this.lanes.push({ axis: 'z', c: r.c + 1.9 + k * 3.6, dir: -1, a: z0, b: z1, cars: [], avenue: r.avenue });
          this.lanes.push({ axis: 'z', c: r.c - 1.9 - k * 3.6, dir: 1, a: z0, b: z1, cars: [], avenue: r.avenue });
        }
      }
      for (const r of city.zRoads) {
        const n = Math.max(1, Math.floor(r.w / 2 / 3.6));
        for (let k = 0; k < n; k++) {
          this.lanes.push({ axis: 'x', c: r.c - 1.9 - k * 3.6, dir: 1, a: x0, b: x1, cars: [], avenue: r.avenue });
          this.lanes.push({ axis: 'x', c: r.c + 1.9 + k * 3.6, dir: -1, a: x0, b: x1, cars: [], avenue: r.avenue });
        }
      }
      const density = play.app.renderer.q.particles;
      for (const L of this.lanes) {
        const len = L.b - L.a;
        const count = Math.floor(len / (L.avenue ? 70 : 110) * density);
        for (let i = 0; i < count; i++) {
          let t = rng.weighted(TYPES.map((tt, j) => [j, tt.w * (L.avenue || j < 3 ? 1 : 0.2)]));
          const set = this.sets[t];
          const col = PAINT[Math.floor(rng.next() * PAINT.length)];
          _c.setRGB(col[0], col[1], col[2]);
          const idx = set.add(_m.identity(), _c);
          if (idx < 0) continue;
          const car = { t, set, idx, lane: L, s: L.a + rng.next() * len, v: TYPES[t].speed * (0.6 + rng.next() * 0.5), vmax: TYPES[t].speed * (0.85 + rng.next() * 0.4), len: TYPES[t].len, state: 0, panic: 0, stop: rng.next() < 0.3 };
          this.cars.push(car);
          L.cars.push(car);
        }
      }
      const night = play.world.preset.night;
      for (const s of this.sets) s.lamps(night > 0.3 ? 5 : 0.0);
      this.ready = true;
    });
  }

  update(dt) {
    if (!this.ready) return;
    const k = this.play.kaiju;
    const kp = k.pos;
    for (const L of this.lanes) {
      const cars = L.cars;
      cars.sort((a, b) => (a.s - b.s) * L.dir);
      for (let i = 0; i < cars.length; i++) {
        const c = cars[i];
        if (c.state !== 0) continue;
        const ahead = cars[i + 1];
        const x = L.axis === 'z' ? L.c : c.s, z = L.axis === 'z' ? c.s : L.c;
        const dk = Math.hypot(x - kp.x, z - kp.z);
        // panic: flee if heading away, brake and abandon if heading toward the monster
        if (dk < 700) {
          const toward = L.axis === 'z' ? (kp.z - z) * L.dir > 0 : (kp.x - x) * L.dir > 0;
          c.panic = Math.min(1, c.panic + dt);
          c.target = toward ? (c.stop || dk < 250 ? 0 : c.vmax * 0.4) : c.vmax * 1.7;
        } else c.target = c.vmax;
        let v = c.target;
        if (ahead && ahead.state === 0) {
          const gap = (ahead.s - c.s) * L.dir - (ahead.len + c.len) / 2;
          v = Math.min(v, Math.max(0, (gap - 3) * 0.8));
        } else if (ahead) {
          const gap = (ahead.s - c.s) * L.dir - (ahead.len + c.len) / 2;
          if (gap < 30) v = Math.min(v, Math.max(0, gap - 4) * 0.5);
        }
        c.v += (v - c.v) * Math.min(1, dt * (v < c.v ? 3 : 0.8));
        c.s += c.v * L.dir * dt;
        if (c.s > L.b) c.s = L.a; else if (c.s < L.a) c.s = L.b;
        const yaw = L.axis === 'z' ? (L.dir > 0 ? 0 : Math.PI) : (L.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
        _m.compose(_p.set(L.axis === 'z' ? L.c : c.s, 0, L.axis === 'z' ? c.s : L.c), _q.setFromEuler(_e.set(0, yaw, 0)), _s.set(1, 1, 1));
        c.set.set(c.idx, _m);
      }
    }
    // flung wrecks
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      f.vel.y -= 9.81 * dt;
      f.pos.addScaledVector(f.vel, dt);
      f.rot.x += f.spin.x * dt; f.rot.z += f.spin.z * dt; f.rot.y += f.spin.y * dt;
      const g = Math.max(0, this.play.world.groundAt(f.pos.x, f.pos.z));
      if (f.pos.y <= g + 0.6) {
        f.pos.y = g + 0.6;
        if (f.vel.y < -6) {
          this.play.particles.dust(f.pos, 6, 2, { life: 5 });
          if (Math.random() < 0.35) { this.play.particles.fireball(f.pos, 4); this.play.app.audio && this.play.app.audio.explosion(f.pos, 0.2); }
        }
        f.vel.multiplyScalar(0.4); f.vel.y = Math.abs(f.vel.y) * 0.2; f.spin.multiplyScalar(0.4);
        if (f.vel.lengthSq() < 1) { this.flying.splice(i, 1); f.car.state = 2; }
      }
      _m.compose(f.pos, _q.setFromEuler(f.rot), _s.set(1, f.car.state === 2 ? 0.55 : 1, 1));
      f.car.set.set(f.car.idx, _m);
    }
    for (const s of this.sets) s.flush();
  }

  _wreck(c, pos, flatten = true) {
    c.state = 2;
    c.set.meshes.forEach((im) => { if (im.userData.paint) { im.getColorAt(c.idx, _c); _c.multiplyScalar(0.25); im.setColorAt(c.idx, _c); im.instanceColor.needsUpdate = true; } });
    const L = c.lane;
    const yaw = L.axis === 'z' ? 0 : Math.PI / 2;
    _m.compose(pos.setY(0.15), _q.setFromEuler(_e.set(0, yaw + (Math.random() - 0.5) * 0.4, 0)), _s.set(1.1, flatten ? 0.3 : 1, 1.05));
    c.set.set(c.idx, _m);
    this.play.score.vehicles++;
    this.play.score.extraValue = (this.play.score.extraValue || 0) + 4e4;
  }

  _carPos(c) { const L = c.lane; return new THREE.Vector3(L.axis === 'z' ? L.c : c.s, 0.8, L.axis === 'z' ? c.s : L.c); }

  // Stepped on or swatted: crush, or fling when there is a strong push.
  crushSphere(p, r, push) {
    if (!this.ready || p.y - r > 6) return;
    const r2 = r * r;
    for (const c of this.cars) {
      if (c.state !== 0) continue;
      const q = this._carPos(c);
      const dx = q.x - p.x, dz = q.z - p.z;
      if (dx * dx + dz * dz > r2) continue;
      if (push && push.lengthSq() > 400) this._fling(c, q, push);
      else { this._wreck(c, q, true); if (Math.random() < 0.15) this.play.particles.fireball(q, 3); }
    }
  }

  blast(p, r) {
    if (!this.ready) return;
    const r2 = r * r;
    for (const c of this.cars) {
      if (c.state !== 0) continue;
      const q = this._carPos(c);
      const dx = q.x - p.x, dz = q.z - p.z, d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      const d = Math.sqrt(d2) + 1;
      const f = (1 - d / r) * 22;
      this._fling(c, q, new THREE.Vector3(dx / d * f, 6 + f * 0.8, dz / d * f));
    }
  }

  _fling(c, q, v) {
    c.state = 1;
    this.flying.push({ car: c, pos: q.clone(), vel: v.clone(), rot: new THREE.Euler(0, c.lane.axis === 'z' ? 0 : Math.PI / 2, 0), spin: new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 6) });
    this.play.score.vehicles++;
    this.play.score.extraValue = (this.play.score.extraValue || 0) + 4e4;
    if (this.flying.length > 120) { const f = this.flying.shift(); f.car.state = 2; }
  }
}
