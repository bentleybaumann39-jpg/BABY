// Instanced city dressing from props.glb: trees, streetlights, rooftop plant, water tanks,
// antennas, harbour cranes, container stacks and pitched house roofs. Rooftop items ride
// on the chunk under them: they fall with a toppling tower and vanish when it breaks.
import * as THREE from 'three';
import { patch } from '../render/Shading.js';
import { hash2 } from '../core/Rng.js';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

// One instanced prop made of several single-material sub-meshes sharing a transform.
export class PropSet {
  constructor(scene, gltf, name, cap, opts = {}) {
    this.name = name;
    this.cap = cap;
    this.meshes = [];
    this.n = 0;
    const src = [];
    gltf.scene.traverse((o) => { if (o.isMesh && (o.name === name || o.name.startsWith(name + '_'))) src.push(o); });
    for (const o of src) {
      const mat = o.material.clone();
      if (/lamp|bulb|tail/.test(mat.name)) { mat.userData.lamp = true; }
      patch(mat, 'prop-' + mat.name + (opts.key || ''), null, { shadows: opts.shadows !== false });
      const im = new THREE.InstancedMesh(o.geometry, mat, cap);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = opts.cast !== false;
      im.receiveShadow = true;
      im.count = 0;
      im.frustumCulled = false;
      im.userData.paint = /paint|trailer/.test(o.name);
      scene.add(im);
      this.meshes.push(im);
    }
    if (!this.meshes.length) console.warn('prop not found', name);
  }
  add(m, color) {
    if (this.n >= this.cap) return -1;
    const i = this.n++;
    for (const im of this.meshes) {
      im.setMatrixAt(i, m);
      im.count = this.n;
      if (color && im.userData.paint) im.setColorAt(i, color);
    }
    return i;
  }
  set(i, m) { for (const im of this.meshes) im.setMatrixAt(i, m); this.dirty = true; }
  hide(i) { this.set(i, ZERO); }
  flush() {
    if (!this.dirty) return;
    for (const im of this.meshes) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    this.dirty = false;
  }
  lamps(intensity) { for (const im of this.meshes) if (im.material.userData.lamp) im.material.emissiveIntensity = intensity; }
}

function roofGeometry() {
  // unit gable roof: ridge along z, eaves overhang a little
  const g = new THREE.BufferGeometry();
  const v = [-0.55, 0, -0.52, 0.55, 0, -0.52, 0, 1, -0.52, -0.55, 0, 0.52, 0.55, 0, 0.52, 0, 1, 0.52];
  const idx = [0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  return ng;
}

export class Props {
  constructor(play, gltf) {
    this.play = play;
    const scene = play.scene, city = play.world.city, B = play.world.buildings;
    this.B = B;
    const night = play.world.preset.night;
    // trees
    this.trees = ['tree_round', 'tree_conifer', 'tree_street'].map((n) => new PropSet(scene, gltf, n, city.trees.length + 50));
    this.treeRefs = [];
    for (const t of city.trees) {
      if (B.heightAt(t.x, t.z) > 0.5) continue;
      const set = this.trees[t.t % 3];
      _m.compose(_p.set(t.x, 0, t.z), _q.setFromEuler(_e.set(0, hash2(t.x | 0, t.z | 0) * 6.28, 0)), _s.setScalar(t.s));
      const i = set.add(_m);
      if (i >= 0) this.treeRefs.push({ set, i, x: t.x, z: t.z, s: t.s, down: false });
    }
    // street lights
    this.lights = new PropSet(scene, gltf, 'streetlight', city.lights.length);
    this.lightRefs = [];
    for (const l of city.lights) {
      _m.compose(_p.set(l.x, 0, l.z), _q.setFromEuler(_e.set(0, l.rot, 0)), _s.setScalar(1));
      const i = this.lights.add(_m);
      if (i >= 0) this.lightRefs.push({ i, x: l.x, z: l.z, rot: l.rot, down: false });
    }
    this.lights.lamps(night > 0.3 ? 6 : 0);
    // rooftop plant, tanks, masts
    this.ac = new PropSet(scene, gltf, 'roof_ac', 3000);
    this.tanks = new PropSet(scene, gltf, 'roof_tank', 600);
    this.masts = new PropSet(scene, gltf, 'roof_antenna', 300);
    this.roofRefs = [];
    for (const b of city.buildings) {
      if (b.style === 6 || b.kind === 'warehouse') continue;
      const top = (ix, iz) => {
        for (let iy = b.ny - 1; iy >= 0; iy--) {
          const li = (iy * b.nz + iz) * b.nx + ix;
          if (!b.voids || !b.voids[li]) return [b.start + li, (iy + 1) * b.ch];
        }
        return null;
      };
      const r = hash2(b.id, 7);
      const place = (set, fx, fz, rot, scale = 1) => {
        const ix = Math.min(b.nx - 1, Math.floor(fx * b.nx)), iz = Math.min(b.nz - 1, Math.floor(fz * b.nz));
        const t = top(ix, iz);
        if (!t) return;
        const x = b.x0 + (ix + 0.2 + 0.6 * ((fx * b.nx) % 1)) * b.cw, z = b.z0 + (iz + 0.2 + 0.6 * ((fz * b.nz) % 1)) * b.cd;
        _m.compose(_p.set(x, t[1], z), _q.setFromEuler(_e.set(0, rot, 0)), _s.setScalar(scale));
        const i = set.add(_m);
        if (i >= 0) this.roofRefs.push({ set, i, chunk: t[0], m: _m.clone(), state: 0 });
      };
      if (b.roof === 'tank' && r < 0.8) place(this.tanks, hash2(b.id, 1), hash2(b.id, 2), r * 6, 0.9 + r * 0.4);
      if (b.roof === 'spire' || b.roof === 'mast') place(this.masts, 0.5, 0.5, 0, b.roof === 'mast' ? 3.2 : 1.5 + r);
      const nac = b.kind === 'tower' ? 3 : b.kind === 'mid' ? 2 : 1;
      if (b.roof !== 'spire') for (let k = 0; k < nac; k++) if (hash2(b.id, 10 + k) < 0.75) place(this.ac, hash2(b.id, 20 + k), hash2(b.id, 30 + k), (hash2(b.id, 40 + k) > 0.5 ? Math.PI / 2 : 0), 0.8 + hash2(b.id, 50 + k) * 0.6);
    }
    // pitched roofs on houses
    const roofGeo = roofGeometry();
    const rm = patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide }), 'gableroof');
    const houses = city.buildings.filter((b) => b.style === 6);
    this.roofs = new THREE.InstancedMesh(roofGeo, rm, houses.length);
    this.roofs.castShadow = this.roofs.receiveShadow = true;
    this.roofs.frustumCulled = false;
    this.houseRoofs = [];
    const roofCols = [new THREE.Color(0.32, 0.12, 0.08), new THREE.Color(0.2, 0.2, 0.22), new THREE.Color(0.38, 0.22, 0.14), new THREE.Color(0.14, 0.15, 0.17)];
    houses.forEach((b, i) => {
      const along = b.w > b.d;
      _m.compose(_p.set(b.x0 + b.w / 2, b.h, b.z0 + b.d / 2), _q.setFromEuler(_e.set(0, along ? Math.PI / 2 : 0, 0)),
        _s.set(along ? b.d : b.w, Math.min(b.w, b.d) * 0.42, along ? b.w : b.d));
      this.roofs.setMatrixAt(i, _m);
      this.roofs.setColorAt(i, roofCols[b.id % 4]);
      this.houseRoofs.push({ i, chunk: b.start, state: 0, m: _m.clone() });
    });
    scene.add(this.roofs);
    // harbour cranes and container yards
    this.cranes = new PropSet(scene, gltf, 'crane', city.cranes.length + 1);
    this.craneRefs = city.cranes.map((c) => {
      _m.compose(_p.set(c.x, 0, c.z), _q.identity(), _s.setScalar(1));
      return { i: this.cranes.add(_m), x: c.x, z: c.z, down: 0 };
    });
    const cg = new THREE.BoxGeometry(12.2, 2.6, 2.45);
    cg.translate(0, 1.3, 0);
    const cmat = patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.4 }), 'container');
    this.containers = new THREE.InstancedMesh(cg, cmat, Math.max(1, city.containers.length));
    this.containers.castShadow = this.containers.receiveShadow = true;
    this.containers.frustumCulled = false;
    const ccols = [0x8c2b1e, 0x1f4f7a, 0x2f6b3a, 0x8a6a1d, 0x5a5f66, 0x7a3d6b].map((c) => new THREE.Color(c));
    this.contRefs = city.containers.map((c, i) => {
      _m.compose(_p.set(c.x, c.y, c.z), _q.identity(), _s.setScalar(1));
      this.containers.setMatrixAt(i, _m);
      this.containers.setColorAt(i, ccols[c.c]);
      return { i, x: c.x, y: c.y, z: c.z, down: false };
    });
    this.containers.count = city.containers.length;
    scene.add(this.containers);
    this.frame = 0;
    for (const s of this.all()) s.flush();
  }

  all() { return [...this.trees, this.lights, this.ac, this.tanks, this.masts, this.cranes]; }

  // Knock over trees, lights and containers inside a sphere (feet, body, blasts).
  knock(p, r, push) {
    const r2 = r * r;
    for (const t of this.treeRefs) {
      if (t.down) continue;
      const dx = t.x - p.x, dz = t.z - p.z;
      if (dx * dx + dz * dz > r2) continue;
      t.down = true;
      const a = Math.atan2(dz, dx);
      _m.compose(_p.set(t.x, 0.3, t.z), _q.setFromEuler(_e.set(Math.sin(a) * 1.4, 0, -Math.cos(a) * 1.4)), _s.setScalar(t.s * 0.9));
      t.set.set(t.i, _m);
    }
    for (const l of this.lightRefs) {
      if (l.down) continue;
      const dx = l.x - p.x, dz = l.z - p.z;
      if (dx * dx + dz * dz > r2) continue;
      l.down = true;
      const a = Math.atan2(dz, dx);
      _m.compose(_p.set(l.x, 0.2, l.z), _q.setFromEuler(_e.set(Math.sin(a) * 1.45, l.rot, -Math.cos(a) * 1.45)), _s.setScalar(1));
      this.lights.set(l.i, _m);
      this.play.particles.sparks(new THREE.Vector3(l.x, 8, l.z), 6, 10, [4, 3, 1.5]);
    }
    for (const c of this.contRefs) {
      if (c.down) continue;
      const dx = c.x - p.x, dz = c.z - p.z;
      if (dx * dx + dz * dz > r2) continue;
      c.down = true;
      const a = Math.random() * 6;
      _m.compose(_p.set(c.x + (push ? push.x : 0) * 0.3, 1.2, c.z + (push ? push.z : 0) * 0.3), _q.setFromEuler(_e.set(a, a * 2, a * 0.5)), _s.setScalar(1));
      this.containers.setMatrixAt(c.i, _m);
      this.containers.instanceMatrix.needsUpdate = true;
    }
    for (const c of this.craneRefs) {
      if (c.down) continue;
      const dx = c.x - p.x, dz = c.z - p.z;
      if (dx * dx + dz * dz > (r + 12) * (r + 12)) continue;
      c.down = 0.001;
      c.dir = Math.atan2(dz, dx);
    }
  }

  update(dt) {
    this.frame++;
    const B = this.B;
    // rooftop items follow their chunk: ride falling groups, disappear when it breaks
    if (this.frame % 2 === 0) {
      for (const r of this.roofRefs) {
        if (r.state === 2) continue;
        const id = r.chunk;
        if (!B.alive[id]) { r.set.hide(r.i); r.state = 2; continue; }
        const g = B.falling[id] >= 0 ? B.groups[B.falling[id]] : null;
        if (g) { _m.multiplyMatrices(g.M, r.m); r.set.set(r.i, _m); r.state = 1; }
      }
      let roofDirty = false;
      for (const h of this.houseRoofs) {
        if (h.state === 2) continue;
        if (!B.alive[h.chunk]) { this.roofs.setMatrixAt(h.i, ZERO); h.state = 2; roofDirty = true; }
      }
      if (roofDirty) this.roofs.instanceMatrix.needsUpdate = true;
    }
    // cranes buckle and fall slowly when hit
    for (const c of this.craneRefs) {
      if (!c.down || c.down >= 1) continue;
      c.down = Math.min(1, c.down + dt * (0.15 + c.down * 1.2));
      const a = c.down * c.down * 1.45;
      _m.compose(_p.set(c.x, 0, c.z), _q.setFromEuler(_e.set(Math.sin(c.dir) * a, 0, -Math.cos(c.dir) * a)), _s.setScalar(1));
      this.cranes.set(c.i, _m);
      if (c.down >= 1) {
        const p = new THREE.Vector3(c.x + Math.cos(c.dir) * 40, 0, c.z + Math.sin(c.dir) * 40);
        this.play.particles.surge(p, 40, 14);
        this.play.app.audio && this.play.app.audio.collapse(p, 0.5);
        this.play.score.extraValue = (this.play.score.extraValue || 0) + 9e7;
      }
    }
    for (const s of this.all()) s.flush();
  }
}
