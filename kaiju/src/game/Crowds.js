// Pedestrians on the sidewalks. They stroll until the kaiju comes near, then run for it,
// streaming away along the streets. Tiny at kaiju scale, but they sell the size of things.
import * as THREE from 'three';
import { PropSet } from '../world/Props.js';
import { Rng } from '../core/Rng.js';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler(), _c = new THREE.Color();
const SHIRTS = [[0.6, 0.1, 0.08], [0.1, 0.2, 0.45], [0.8, 0.8, 0.78], [0.1, 0.1, 0.1], [0.5, 0.45, 0.2], [0.2, 0.35, 0.2], [0.55, 0.3, 0.5]];

export class Crowds {
  constructor(play) {
    this.play = play;
    this.ready = false;
    this.p = [];
    const city = play.world.city;
    const rng = new Rng(city.seed + 9);
    play.propsReady.then((gltf) => {
      if (!gltf) return;
      const n = Math.round(1600 * play.app.renderer.q.particles);
      this.set = new PropSet(play.scene, gltf, 'person', n, { key: '-ped', cast: false });
      for (const im of this.set.meshes) im.userData.paint = /cloth/.test(im.material.name);
      const blocks = city.blocks.filter((b) => b.kind !== 'port');
      for (let i = 0; i < n; i++) {
        const b = blocks[Math.floor(rng.next() * blocks.length)];
        // a point on the sidewalk ring
        const side = Math.floor(rng.next() * 4), off = 1 + rng.next() * 3.5;
        let x, z;
        if (side === 0) { x = b.x0 + off; z = b.z0 + rng.next() * (b.z1 - b.z0); }
        else if (side === 1) { x = b.x1 - off; z = b.z0 + rng.next() * (b.z1 - b.z0); }
        else if (side === 2) { z = b.z0 + off; x = b.x0 + rng.next() * (b.x1 - b.x0); }
        else { z = b.z1 - off; x = b.x0 + rng.next() * (b.x1 - b.x0); }
        const sh = SHIRTS[Math.floor(rng.next() * SHIRTS.length)];
        _c.setRGB(sh[0], sh[1], sh[2]);
        const idx = this.set.add(_m.makeTranslation(x, 0, z), _c);
        const a = (side < 2 ? Math.PI / 2 : 0) + (rng.next() < 0.5 ? Math.PI : 0);
        this.p.push({ idx, x, z, h: a, v: 1.2 + rng.next() * 0.5, run: 0, alive: true, ph: rng.next() * 6, t: rng.next() * 10 });
      }
      this.ready = true;
    });
  }

  scare(p, r) {
    if (!this.ready) return;
    for (const q of this.p) if (q.alive && Math.hypot(q.x - p.x, q.z - p.z) < r) q.run = Math.max(q.run, 1);
  }

  crush(p, r) {
    if (!this.ready || p.y - r > 4) return;
    const r2 = r * r;
    for (const q of this.p) {
      if (!q.alive) continue;
      const dx = q.x - p.x, dz = q.z - p.z;
      if (dx * dx + dz * dz < r2) { q.alive = false; this.set.hide(q.idx); }
    }
  }

  update(dt) {
    if (!this.ready) return;
    const kp = this.play.kaiju.pos;
    const W = this.play.world;
    this.t = (this.t || 0) + dt;
    for (const q of this.p) {
      if (!q.alive) continue;
      const dx = q.x - kp.x, dz = q.z - kp.z, d = Math.hypot(dx, dz);
      if (d < 520) q.run = Math.min(1, q.run + dt * 2);
      let h = q.h, v = q.v;
      if (q.run > 0) {
        const away = Math.atan2(dx, dz);
        // run away, snapped toward the street grid so the flow follows the avenues
        const snap = Math.round(away / (Math.PI / 2)) * (Math.PI / 2);
        const want = away * 0.35 + snap * 0.65;
        q.h += Math.atan2(Math.sin(want - q.h), Math.cos(want - q.h)) * Math.min(1, dt * 3);
        h = q.h;
        v = 4 + q.run * 2.5;
      } else {
        q.t += dt;
        if (q.t > 8) { q.t = 0; q.h += Math.PI; }
      }
      const nx = q.x + Math.sin(h) * v * dt, nz = q.z + Math.cos(h) * v * dt;
      // don't walk into buildings: try the step, else slide along an axis
      if (W.buildings.heightAt(nx, nz) < 0.5 && W.groundAt(nx, nz) > -0.5) { q.x = nx; q.z = nz; }
      else if (W.buildings.heightAt(nx, q.z) < 0.5) q.x = nx;
      else if (W.buildings.heightAt(q.x, nz) < 0.5) q.z = nz;
      else q.h += 1.2;
      const bob = Math.abs(Math.sin(this.t * (q.run ? 9 : 5) + q.ph)) * (q.run ? 0.12 : 0.04);
      _m.compose(_p.set(q.x, bob, q.z), _q.setFromEuler(_e.set(q.run ? 0.25 : 0, h, 0)), _s.set(1, 1, 1));
      this.set.set(q.idx, _m);
    }
    this.set.flush();
  }
}
