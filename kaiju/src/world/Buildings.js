// Destructible buildings. Each building is a grid of structural chunks rendered as
// instances in spatial tiles. Damage removes chunks; a support pass then finds storeys
// that lost too many columns or chunks no longer connected to the ground, and turns them
// into falling groups that either pancake straight down (crushing floor after floor) or
// topple about the failed edge and smash into whatever is beside them.
import * as THREE from 'three';
import { makeBuildingMaterial, addInstanceAttrs, INSTANCE_ATTRS } from './BuildingShader.js';
import { clamp } from '../core/Rng.js';

const TILE = 360;
const GRID = 16;
const G = 9.81;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const _p = new THREE.Vector3(), _axis = new THREE.Vector3();

export class Buildings {
  constructor(city, scene, events) {
    this.city = city;
    this.scene = scene;
    this.events = events; // { chunkBroken(info), collapse(b, group), groupImpact(pos, energy) }
    const N = city.chunkCount;
    this.N = N;
    this.bid = new Int32Array(N);
    this.alive = new Uint8Array(N);
    this.falling = new Int32Array(N).fill(-1);
    this.hp = new Float32Array(N);
    this.hp0 = new Float32Array(N);
    this.tileOf = new Int16Array(N);
    this.slot = new Int32Array(N).fill(-1);
    this.face = new Uint8Array(N);
    this.burn = new Float32Array(N);
    this.dust = new Float32Array(N);
    this.dmgv = new Float32Array(N);
    this.aliveCount = 0;
    this.burning = new Set();
    this.groups = [];
    this.material = makeBuildingMaterial(false);
    this.box = new THREE.BoxGeometry(1, 1, 1);
    this.stats = { chunksDestroyed: 0, buildingsCollapsed: 0, buildingsDamaged: 0, value: 0 };
    this._build();
  }

  // ------------------------------------------------------------------ setup

  _build() {
    const c = this.city;
    const tx = Math.ceil((c.x1 - c.x0) / TILE) + 1, tz = Math.ceil((c.coast + 400 - c.z0) / TILE) + 1;
    this.tx = tx; this.tz = tz;
    const tileCounts = new Int32Array(tx * tz);
    for (const b of c.buildings) {
      const t = this._tileIndex(b.x0 + b.w / 2, b.z0 + b.d / 2);
      b.tile = t;
      b.alive = 0; b.total = 0; b.collapsed = false; b.damaged = false;
      b.levelTotal = new Int32Array(b.ny);
      for (let iy = 0; iy < b.ny; iy++) for (let iz = 0; iz < b.nz; iz++) for (let ix = 0; ix < b.nx; ix++) {
        const li = (iy * b.nz + iz) * b.nx + ix;
        if (b.voids && b.voids[li]) continue;
        b.levelTotal[iy]++;
        b.total++;
      }
      b.alive = b.total;
      tileCounts[t] += b.total;
    }
    this.tiles = [];
    for (let i = 0; i < tx * tz; i++) {
      if (!tileCounts[i]) { this.tiles.push(null); continue; }
      const geo = this.box.clone();
      const attrs = addInstanceAttrs(geo, tileCounts[i]);
      const mesh = new THREE.InstancedMesh(geo, this.material, tileCounts[i]);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.count = 0;
      const ix = i % tx, iz = Math.floor(i / tx);
      mesh.userData.tile = i;
      const cx = c.x0 + (ix + 0.5) * TILE, cz = c.z0 + (iz + 0.5) * TILE;
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, 120, cz), TILE * 0.75 + 340);
      this.scene.add(mesh);
      this.tiles.push({ mesh, attrs, chunk: new Int32Array(tileCounts[i]), dirty: false, active: 0 });
    }
    // fill
    const hpScale = { 0: 1.0, 1: 1.25, 2: 1.15, 3: 1.0, 4: 1.4, 5: 0.7, 6: 0.45, 7: 1.0, 8: 2.2 };
    for (const b of c.buildings) {
      for (let iy = 0; iy < b.ny; iy++) for (let iz = 0; iz < b.nz; iz++) for (let ix = 0; ix < b.nx; ix++) {
        const li = (iy * b.nz + iz) * b.nx + ix;
        const id = b.start + li;
        this.bid[id] = b.id;
        if (b.voids && b.voids[li]) continue;
        this.alive[id] = 1;
        this.aliveCount++;
        const vol = b.cw * b.ch * b.cd;
        const hp = 60 * Math.pow(vol / 800, 0.7) * (hpScale[b.style] || 1) * (1 + 0.6 * (1 - iy / b.ny));
        this.hp[id] = this.hp0[id] = hp;
        this.face[id] = this._faceMask(b, ix, iy, iz);
        this._place(id, b, ix, iy, iz);
      }
    }
    for (const t of this.tiles) if (t) this._flushTile(t, true);
    // spatial hash over the chunk AABBs
    this.gx0 = c.x0 - 200; this.gz0 = c.z0 - 200;
    this.gw = Math.ceil((c.x1 - c.x0 + 400) / GRID); this.gd = Math.ceil((c.coast + 600 - c.z0) / GRID);
    const cells = new Map();
    for (const b of c.buildings) {
      const ax = Math.floor((b.x0 - this.gx0) / GRID), bx = Math.floor((b.x0 + b.w - this.gx0) / GRID);
      const az = Math.floor((b.z0 - this.gz0) / GRID), bz = Math.floor((b.z0 + b.d - this.gz0) / GRID);
      for (let x = ax; x <= bx; x++) for (let z = az; z <= bz; z++) {
        const k = x + z * this.gw;
        let l = cells.get(k);
        if (!l) cells.set(k, (l = []));
        l.push(b.id);
      }
    }
    this.cells = cells;
  }

  _tileIndex(x, z) {
    const c = this.city;
    const ix = clamp(Math.floor((x - c.x0) / TILE), 0, this.tx - 1), iz = clamp(Math.floor((z - c.z0) / TILE), 0, this.tz - 1);
    return ix + iz * this.tx;
  }

  _isSolid(b, ix, iy, iz) {
    if (ix < 0 || iy < 0 || iz < 0 || ix >= b.nx || iy >= b.ny || iz >= b.nz) return false;
    return !(b.voids && b.voids[(iy * b.nz + iz) * b.nx + ix]);
  }

  _faceMask(b, ix, iy, iz) {
    let m = 0;
    if (!this._isSolid(b, ix + 1, iy, iz)) m |= 1;
    if (!this._isSolid(b, ix - 1, iy, iz)) m |= 2;
    if (!this._isSolid(b, ix, iy + 1, iz)) m |= 4;
    if (iy > 0 && !this._isSolid(b, ix, iy - 1, iz)) m |= 8;
    if (!this._isSolid(b, ix, iy, iz + 1)) m |= 16;
    if (!this._isSolid(b, ix, iy, iz - 1)) m |= 32;
    return m;
  }

  chunkCoords(id) {
    const b = this.city.buildings[this.bid[id]];
    const li = id - b.start;
    const ix = li % b.nx, iz = Math.floor(li / b.nx) % b.nz, iy = Math.floor(li / (b.nx * b.nz));
    return [b, ix, iy, iz];
  }

  chunkCenter(id, out = new THREE.Vector3()) {
    const [b, ix, iy, iz] = this.chunkCoords(id);
    return out.set(b.x0 + (ix + 0.5) * b.cw, (iy + 0.5) * b.ch, b.z0 + (iz + 0.5) * b.cd);
  }

  _place(id, b, ix, iy, iz) {
    const t = this.tiles[b.tile];
    const s = t.mesh.count++;
    t.chunk[s] = id;
    this.slot[id] = s;
    this.tileOf[id] = b.tile;
    _m.makeScale(b.cw, b.ch, b.cd).setPosition(b.x0 + (ix + 0.5) * b.cw, (iy + 0.5) * b.ch, b.z0 + (iz + 0.5) * b.cd);
    t.mesh.setMatrixAt(s, _m);
    this._writeAttrs(t, s, id, b, ix, iy, iz);
  }

  _writeAttrs(t, s, id, b, ix, iy, iz) {
    const A = t.attrs;
    A.aCenter.setXYZ(s, (ix + 0.5) * b.cw, (iy + 0.5) * b.ch, (iz + 0.5) * b.cd);
    A.aSize.setXYZ(s, b.cw, b.ch, b.cd);
    A.aDims.setXYZ(s, b.w, b.h, b.d);
    A.aStyle.setXYZW(s, b.style, b.seed, b.floorH, b.bayW);
    A.aState.setXYZW(s, this.face[id], this.dmgv[id], this.burn[id], this.dust[id]);
    A.aTint.setXYZ(s, b.tint[0], b.tint[1], b.tint[2]);
  }

  // Fills the attribute values a debris fragment from this chunk needs.
  chunkAttrs(id) {
    const [b, ix, iy, iz] = this.chunkCoords(id);
    return {
      center: [(ix + 0.5) * b.cw, (iy + 0.5) * b.ch, (iz + 0.5) * b.cd], size: [b.cw, b.ch, b.cd], dims: [b.w, b.h, b.d],
      style: [b.style, b.seed, b.floorH, b.bayW], state: [this.face[id], Math.max(0.6, this.dmgv[id]), this.burn[id], this.dust[id]],
      tint: b.tint, b,
    };
  }

  _setState(id) {
    const t = this.tiles[this.tileOf[id]], s = this.slot[id];
    if (!t || s < 0) return;
    t.attrs.aState.setXYZW(s, this.face[id], this.dmgv[id], this.burn[id], this.dust[id]);
    t.dirtyState = true;
  }

  _remove(id) {
    const t = this.tiles[this.tileOf[id]];
    const s = this.slot[id];
    if (s < 0) return;
    const last = --t.mesh.count;
    if (s !== last) {
      const moved = t.chunk[last];
      t.mesh.getMatrixAt(last, _m);
      t.mesh.setMatrixAt(s, _m);
      for (const [name, size] of INSTANCE_ATTRS) {
        const a = t.attrs[name].array;
        for (let k = 0; k < size; k++) a[s * size + k] = a[last * size + k];
      }
      t.chunk[s] = moved;
      this.slot[moved] = s;
    }
    this.slot[id] = -1;
    t.dirty = true;
  }

  _flushTile(t, all = false) {
    t.mesh.instanceMatrix.needsUpdate = true;
    for (const a of Object.values(t.attrs)) a.needsUpdate = true;
    t.dirty = false; t.dirtyState = false;
  }

  // ------------------------------------------------------------------ queries

  buildingsNear(x, z, r) {
    const out = new Set();
    const ax = Math.floor((x - r - this.gx0) / GRID), bx = Math.floor((x + r - this.gx0) / GRID);
    const az = Math.floor((z - r - this.gz0) / GRID), bz = Math.floor((z + r - this.gz0) / GRID);
    for (let gx = ax; gx <= bx; gx++) for (let gz = az; gz <= bz; gz++) {
      const l = this.cells.get(gx + gz * this.gw);
      if (l) for (const id of l) out.add(id);
    }
    return out;
  }

  // Calls fn(chunkId, dist) for every live, static chunk whose box overlaps the sphere.
  forChunksInSphere(p, r, fn) {
    for (const bi of this.buildingsNear(p.x, p.z, r)) {
      const b = this.city.buildings[bi];
      if (b.alive === 0) continue;
      const lx = p.x - b.x0, lz = p.z - b.z0;
      const ax = clamp(Math.floor((lx - r) / b.cw), 0, b.nx - 1), bx = clamp(Math.floor((lx + r) / b.cw), 0, b.nx - 1);
      const az = clamp(Math.floor((lz - r) / b.cd), 0, b.nz - 1), bz = clamp(Math.floor((lz + r) / b.cd), 0, b.nz - 1);
      const ay = clamp(Math.floor((p.y - r) / b.ch), 0, b.ny - 1), by = clamp(Math.floor((p.y + r) / b.ch), 0, b.ny - 1);
      if (p.y + r < 0 || p.y - r > b.h) continue;
      for (let iy = ay; iy <= by; iy++) for (let iz = az; iz <= bz; iz++) for (let ix = ax; ix <= bx; ix++) {
        const id = b.start + (iy * b.nz + iz) * b.nx + ix;
        if (!this.alive[id] || this.falling[id] >= 0) continue;
        // sphere-box distance
        const cx = clamp(p.x, b.x0 + ix * b.cw, b.x0 + (ix + 1) * b.cw);
        const cy = clamp(p.y, iy * b.ch, (iy + 1) * b.ch);
        const cz = clamp(p.z, b.z0 + iz * b.cd, b.z0 + (iz + 1) * b.cd);
        const d = Math.hypot(p.x - cx, p.y - cy, p.z - cz);
        if (d <= r) fn(id, d);
      }
    }
  }

  // Highest live, static chunk top under (x, z), for landing debris, units and the camera.
  heightAt(x, z) {
    const l = this.cells.get(Math.floor((x - this.gx0) / GRID) + Math.floor((z - this.gz0) / GRID) * this.gw);
    if (!l) return 0;
    let h = 0;
    for (let i = 0; i < l.length; i++) {
      const b = this.city.buildings[l[i]];
      if (b.alive === 0 || x < b.x0 || x > b.x0 + b.w || z < b.z0 || z > b.z0 + b.d) continue;
      const ix = Math.min(b.nx - 1, Math.floor((x - b.x0) / b.cw)), iz = Math.min(b.nz - 1, Math.floor((z - b.z0) / b.cd));
      for (let iy = b.ny - 1; iy >= 0; iy--) {
        if ((iy + 1) * b.ch <= h) break;
        const id = b.start + (iy * b.nz + iz) * b.nx + ix;
        if (this.alive[id] && this.falling[id] < 0) { h = (iy + 1) * b.ch; break; }
      }
    }
    return h;
  }

  // Top of the solid column at (x, z) that lies below height y (for things landing on roofs).
  roofBelow(x, z, y) {
    const l = this.cells.get(Math.floor((x - this.gx0) / GRID) + Math.floor((z - this.gz0) / GRID) * this.gw);
    if (!l) return 0;
    let h = 0;
    for (let i = 0; i < l.length; i++) {
      const b = this.city.buildings[l[i]];
      if (b.alive === 0 || x < b.x0 || x > b.x0 + b.w || z < b.z0 || z > b.z0 + b.d) continue;
      const ix = Math.min(b.nx - 1, Math.floor((x - b.x0) / b.cw)), iz = Math.min(b.nz - 1, Math.floor((z - b.z0) / b.cd));
      const top = Math.min(b.ny - 1, Math.floor(y / b.ch));
      for (let iy = top; iy >= 0; iy--) {
        const id = b.start + (iy * b.nz + iz) * b.nx + ix;
        if (this.alive[id] && this.falling[id] < 0) { h = Math.max(h, (iy + 1) * b.ch); break; }
      }
    }
    return h;
  }

  // ------------------------------------------------------------------ damage

  damageSphere(p, r, amount, push = null, src = 'melee') {
    let broken = 0;
    const touched = new Set();
    this.forChunksInSphere(p, r, (id, d) => {
      const f = 1 - 0.6 * (d / r);
      this.hp[id] -= amount * f;
      const bi = this.bid[id];
      touched.add(bi);
      this.dmgv[id] = Math.min(1, this.dmgv[id] + 0.5 * f);
      if (this.hp[id] <= 0) {
        this.breakChunk(id, push, f, src);
        broken++;
      } else this._setState(id);
    });
    for (const bi of touched) this.checkSupport(this.city.buildings[bi]);
    return broken;
  }

  damageCapsule(a, b, r, amount, push, src = 'body') {
    const len = a.distanceTo(b);
    const steps = Math.max(1, Math.ceil(len / (r * 0.8)));
    let broken = 0;
    for (let i = 0; i <= steps; i++) {
      _p.lerpVectors(a, b, i / steps);
      broken += this.damageSphere(_p, r, amount / (steps + 1) * 2, push, src);
    }
    return broken;
  }

  ignite(p, r, amount = 0.6) {
    this.forChunksInSphere(p, r, (id) => {
      this.burn[id] = Math.min(1, this.burn[id] + amount);
      this.burning.add(id);
      this._setState(id);
    });
  }

  breakChunk(id, push = null, strength = 1, src = 'melee', vel = null) {
    if (!this.alive[id]) return;
    const b = this.city.buildings[this.bid[id]];
    const info = this.chunkAttrs(id);
    const center = vel ? this._groupChunkWorld(id, new THREE.Vector3()) : this.chunkCenter(id, new THREE.Vector3());
    const rot = vel ? this._groupChunkQuat(id, new THREE.Quaternion()) : null;
    this.alive[id] = 0;
    this.aliveCount--;
    b.alive--;
    this.burning.delete(id);
    if (this.falling[id] >= 0) {
      const g = this.groups[this.falling[id]];
      if (g) g.live--;
      this.falling[id] = -1;
    }
    this._remove(id);
    // newly exposed neighbours become interior faces; clear their exterior bits facing this chunk
    const [, ix, iy, iz] = this.chunkCoords(id);
    const nb = [[1, 0, 0, 2], [-1, 0, 0, 1], [0, 1, 0, 8], [0, -1, 0, 4], [0, 0, 1, 32], [0, 0, -1, 16]];
    for (const [dx, dy, dz, bit] of nb) {
      const x = ix + dx, y = iy + dy, z = iz + dz;
      if (!this._isSolid(b, x, y, z)) continue;
      const n = b.start + (y * b.nz + z) * b.nx + x;
      if (this.alive[n]) {
        this.face[n] &= ~bit;
        this.dmgv[n] = Math.min(1, this.dmgv[n] + 0.35);
        this._setState(n);
      }
    }
    this.stats.chunksDestroyed++;
    this.stats.value += b.cw * b.ch * b.cd * (b.kind === 'tower' ? 4200 : b.kind === 'house' ? 2600 : 3000);
    if (!b.damaged) { b.damaged = true; this.stats.buildingsDamaged++; }
    if (this.events.chunkBroken) this.events.chunkBroken({ id, b, center, rot, info, push, strength, src, vel });
    if (b.alive <= Math.max(1, b.total * 0.12) && !b.collapsed) {
      b.collapsed = true;
      this.stats.buildingsCollapsed++;
      if (this.events.buildingDown) this.events.buildingDown(b);
    }
  }

  // ------------------------------------------------------------------ structure

  checkSupport(b) {
    if (b.alive === 0) return;
    const nx = b.nx, ny = b.ny, nz = b.nz;
    const ok = (ix, iy, iz) => {
      const id = b.start + (iy * nz + iz) * nx + ix;
      return this.alive[id] && this.falling[id] < 0;
    };
    // 1) storey failure: a level that lost most of its columns drops everything above it
    let failLevel = -1;
    for (let iy = 0; iy < ny - 1; iy++) {
      if (!b.levelTotal[iy]) continue;
      let a = 0;
      for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) if (ok(ix, iy, iz)) a++;
      let above = 0;
      for (let y = iy + 1; y < ny && !above; y++) for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) if (ok(ix, y, iz)) above++;
      if (!above) break;
      const ratio = a / b.levelTotal[iy];
      const need = b.levelTotal[iy] <= 2 ? 0.49 : 0.36;
      if (ratio < need) { failLevel = iy + 1; break; }
    }
    // 2) connectivity to the ground
    const n = nx * ny * nz;
    const seen = new Uint8Array(n);
    const stack = [];
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      if (ok(ix, 0, iz)) { const li = iz * nx + ix; seen[li] = 1; stack.push(li); }
    }
    while (stack.length) {
      const li = stack.pop();
      const ix = li % nx, iz = Math.floor(li / nx) % nz, iy = Math.floor(li / (nx * nz));
      if (failLevel >= 0 && iy >= failLevel) continue;
      const nbs = [[ix + 1, iy, iz], [ix - 1, iy, iz], [ix, iy + 1, iz], [ix, iy - 1, iz], [ix, iy, iz + 1], [ix, iy, iz - 1]];
      for (const [x, y, z] of nbs) {
        if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) continue;
        if (failLevel >= 0 && y >= failLevel) continue;
        const l2 = (y * nz + z) * nx + x;
        if (seen[l2] || !ok(x, y, z)) continue;
        seen[l2] = 1;
        stack.push(l2);
      }
    }
    const loose = [];
    for (let li = 0; li < n; li++) {
      const id = b.start + li;
      if (!seen[li] && this.alive[id] && this.falling[id] < 0) loose.push(id);
    }
    if (loose.length) this._makeGroup(b, loose, failLevel);
  }

  _makeGroup(b, ids, failLevel) {
    // centre of mass and the footprint of what is left underneath
    const com = new THREE.Vector3();
    let minY = 1e9, maxY = 0;
    for (const id of ids) {
      this.chunkCenter(id, _v);
      com.add(_v);
      const [, , iy] = this.chunkCoords(id);
      minY = Math.min(minY, iy * b.ch);
      maxY = Math.max(maxY, (iy + 1) * b.ch);
    }
    com.multiplyScalar(1 / ids.length);
    const supp = new THREE.Vector3();
    let ns = 0;
    const lvl = Math.round(minY / b.ch) - 1;
    if (lvl >= 0) {
      for (let iz = 0; iz < b.nz; iz++) for (let ix = 0; ix < b.nx; ix++) {
        const id = b.start + (lvl * b.nz + iz) * b.nx + ix;
        if (this.alive[id] && this.falling[id] < 0) { supp.add(this.chunkCenter(id, _v)); ns++; }
      }
    }
    const height = maxY - minY;
    const width = Math.min(b.w, b.d);
    let mode = 'pancake';
    const dir = new THREE.Vector3();
    if (ns > 0) {
      supp.multiplyScalar(1 / ns);
      dir.set(com.x - supp.x, 0, com.z - supp.z);
      if (dir.length() > width * 0.12 && height > width * 0.6) mode = 'topple';
    } else if (height > width * 1.4 && Math.random() < 0.6) {
      mode = 'topple';
      const a = Math.random() * Math.PI * 2;
      dir.set(Math.cos(a), 0, Math.sin(a));
    }
    if (dir.lengthSq() < 1e-6) { const a = Math.random() * Math.PI * 2; dir.set(Math.cos(a), 0, Math.sin(a)); }
    dir.normalize();
    // pivot on the edge of the footprint in the direction of the fall
    const pivot = new THREE.Vector3(
      clamp(com.x + dir.x * b.w, b.x0, b.x0 + b.w), minY, clamp(com.z + dir.z * b.d, b.z0, b.z0 + b.d));
    const axis = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
    const g = {
      id: this.groups.length, b, ids, live: ids.length, mode, pivot, axis, dir,
      angle: (Math.random() * 0.03 + 0.01), omega: 0, offset: new THREE.Vector3(), vy: 0,
      height, minY, t: 0, M: new THREE.Matrix4(), q: new THREE.Quaternion(), crushY: minY,
    };
    this.groups.push(g);
    for (const id of ids) this.falling[id] = g.id;
    this.tiles[b.tile].active++;
    if (this.events.collapse) this.events.collapse(b, g);
  }

  _groupMatrix(g) {
    // M p = R (p - pivot) + pivot + offset
    g.q.setFromAxisAngle(g.axis, g.angle);
    g.M.makeRotationFromQuaternion(g.q);
    const t = _s.copy(g.pivot).applyQuaternion(g.q);
    g.M.elements[12] = g.pivot.x - t.x + g.offset.x;
    g.M.elements[13] = g.pivot.y - t.y + g.offset.y;
    g.M.elements[14] = g.pivot.z - t.z + g.offset.z;
  }

  _groupChunkWorld(id, out) {
    const g = this.groups[this.falling[id]];
    this.chunkCenter(id, out);
    if (g) out.applyMatrix4(g.M);
    return out;
  }

  _groupChunkQuat(id, out) {
    const g = this.groups[this.falling[id]];
    return g ? out.copy(g.q) : out.identity();
  }

  _groupVel(g, p, out) {
    // v = omega x r + vertical drop speed
    out.copy(p).sub(g.pivot);
    out.crossVectors(_axis.copy(g.axis).multiplyScalar(g.omega), out);
    out.y += g.vy;
    return out;
  }

  update(dt) {
    // falling groups
    for (const g of this.groups) {
      if (g.live <= 0 || g.done) continue;
      g.t += dt;
      if (g.mode === 'topple') {
        // rigid rod pivoting on its base: theta'' = 3g/(2L) sin(theta)
        const L = Math.max(10, g.height);
        g.omega += (3 * G / (2 * L)) * Math.sin(g.angle) * dt;
        g.angle += g.omega * dt;
        // the base slides down a little as columns buckle
        g.vy -= G * 0.15 * dt;
        g.offset.y = Math.max(g.offset.y + g.vy * dt, -g.minY);
      } else {
        g.vy -= G * dt;
        g.offset.y += g.vy * dt;
        g.angle += g.omega * dt;
        g.omega += 0.004 * dt;
      }
      this._groupMatrix(g);
      const t = this.tiles[g.b.tile];
      t.dirty = true;
      // move the instances and crush chunks that hit the ground or other buildings
      const crushed = [];
      for (const id of g.ids) {
        if (!this.alive[id] || this.falling[id] !== g.id) continue;
        const [b, ix, iy, iz] = this.chunkCoords(id);
        _m.makeScale(b.cw, b.ch, b.cd).setPosition(b.x0 + (ix + 0.5) * b.cw, (iy + 0.5) * b.ch, b.z0 + (iz + 0.5) * b.cd);
        _m.premultiply(g.M);
        t.mesh.setMatrixAt(this.slot[id], _m);
        _p.setFromMatrixPosition(_m);
        const half = Math.min(b.cw, b.ch, b.cd) * 0.45;
        let hit = _p.y - half < 0.5;
        if (!hit && g.mode === 'pancake') {
          // the floor below the falling block: the remaining structure's top under this chunk
          const top = this.heightAt(_p.x, _p.z);
          if (_p.y - b.ch * 0.5 < top + 0.5) hit = true;
        }
        if (!hit && g.mode === 'topple' && g.angle > 0.25) {
          let other = false;
          this.forChunksInSphere(_p, half * 1.2, (oid) => {
            if (this.bid[oid] !== b.id) { other = true; this.hp[oid] -= 120 * dt * 10; if (this.hp[oid] <= 0) crushed.push([oid, true]); }
          });
          if (other) hit = true;
        }
        if (hit) crushed.push([id, false]);
      }
      for (const [id, isOther] of crushed) {
        if (!this.alive[id]) continue;
        if (isOther) {
          this.breakChunk(id, null, 1, 'impact');
          this.checkSupport(this.city.buildings[this.bid[id]]);
          continue;
        }
        const wp = this._groupChunkWorld(id, new THREE.Vector3());
        const vel = this._groupVel(g, wp, new THREE.Vector3());
        this.breakChunk(id, null, 1, 'collapse', vel);
        if (g.mode === 'pancake') {
          // impact eats the storey underneath too
          const top = this.heightAt(wp.x, wp.z);
          if (top > 0.5) {
            this.forChunksInSphere(_v.set(wp.x, top - 1, wp.z), 2, (oid) => { if (Math.random() < 0.35) this.breakChunk(oid, null, 1, 'collapse'); });
          }
          g.vy *= 0.985;
        }
        if (this.events.groupImpact) this.events.groupImpact(wp, vel.length(), g);
      }
      if (g.mode === 'topple' && g.angle > 1.45) {
        for (const id of g.ids) if (this.alive[id] && this.falling[id] === g.id) {
          const wp = this._groupChunkWorld(id, new THREE.Vector3());
          this.breakChunk(id, null, 1, 'collapse', this._groupVel(g, wp, new THREE.Vector3()));
        }
      }
      if (g.live <= 0 || g.t > 25) {
        g.done = true;
        for (const id of g.ids) if (this.alive[id] && this.falling[id] === g.id) this.breakChunk(id, null, 1, 'collapse');
        this.tiles[g.b.tile].active--;
        this.checkSupport(g.b);
      }
    }
    // fire: spreads to neighbours and slowly weakens the structure
    if (this.burning.size) {
      const list = [...this.burning];
      for (const id of list) {
        if (!this.alive[id]) { this.burning.delete(id); continue; }
        this.burn[id] = Math.min(1, this.burn[id] + dt * 0.05);
        this.hp[id] -= dt * this.hp0[id] * 0.012 * this.burn[id];
        if (Math.random() < dt * 0.05 * this.burn[id]) {
          const [b, ix, iy, iz] = this.chunkCoords(id);
          const d = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]][Math.floor(Math.random() * 5)];
          if (this._isSolid(b, ix + d[0], iy + d[1], iz + d[2])) {
            const n = b.start + ((iy + d[1]) * b.nz + iz + d[2]) * b.nx + ix + d[0];
            if (this.alive[n] && !this.burning.has(n)) { this.burn[n] = 0.15; this.burning.add(n); }
          }
        }
        if (this.hp[id] <= 0) { const b = this.city.buildings[this.bid[id]]; this.breakChunk(id, null, 0.3, 'fire'); this.checkSupport(b); }
        else this._setState(id);
      }
    }
    for (const t of this.tiles) if (t && (t.dirty || t.dirtyState)) this._flushTile(t);
  }

  // Dust settles on facades near a collapse.
  dustAround(p, r, amount) {
    this.forChunksInSphere(p, r, (id, d) => {
      this.dust[id] = Math.min(1, this.dust[id] + amount * (1 - d / r));
      this._setState(id);
    });
  }

  get destroyedFraction() { return 1 - this.aliveCount / this._total(); }
  _total() { return this.__t || (this.__t = this.city.buildings.reduce((s, b) => s + b.total, 0)); }
}
