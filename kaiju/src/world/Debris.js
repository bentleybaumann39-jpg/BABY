// Debris: when a chunk breaks it is replaced by convex Voronoi fragments of the same
// box (generated here at load), which keep the facade they came from via the building
// shader. Fragments fly, tumble, bounce and come to rest as rubble piles. Small gravel
// adds texture to impacts and fades out.
import * as THREE from 'three';
import { makeBuildingMaterial, INSTANCE_ATTRS } from './BuildingShader.js';
import { patch } from '../render/Shading.js';
import { Rng } from '../core/Rng.js';

const G = 9.81;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _w = new THREE.Vector3(), _dq = new THREE.Quaternion(), _e = new THREE.Matrix3();

// ------------------------------------------------------------------ convex fracture

function clipPoly(poly, n, d) {
  // keep the part of polygon with dot(n, p) <= d
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = n.dot(a) - d, db = n.dot(b) - d;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) out.push(a.clone().lerp(b, da / (da - db)));
  }
  return out;
}

function clipCell(faces, n, d) {
  const res = [];
  const capPts = [];
  for (const f of faces) {
    const v = clipPoly(f.v, n, d);
    if (v.length >= 3) res.push({ v, cut: f.cut, n: f.n });
    for (const p of v) if (Math.abs(n.dot(p) - d) < 1e-6) capPts.push(p);
  }
  if (capPts.length >= 3) {
    const c = new THREE.Vector3();
    for (const p of capPts) c.add(p);
    c.multiplyScalar(1 / capPts.length);
    const u = new THREE.Vector3().subVectors(capPts[0], c).normalize();
    const w = new THREE.Vector3().crossVectors(n, u).normalize();
    const pts = capPts.map((p) => ({ p, a: Math.atan2(_p.subVectors(p, c).dot(w), _p.subVectors(p, c).dot(u)) }));
    pts.sort((x, y) => x.a - y.a);
    const uniq = [];
    for (const q of pts) if (!uniq.length || uniq[uniq.length - 1].distanceTo(q.p) > 1e-5) uniq.push(q.p);
    if (uniq.length > 2 && uniq[0].distanceTo(uniq[uniq.length - 1]) < 1e-5) uniq.pop();
    // cap faces outward = +n; atan2 ordering around n is counter-clockwise
    if (uniq.length >= 3) res.push({ v: uniq, cut: true, n: n.clone() });
  }
  return res;
}

function fractureCube(seed, count) {
  const rng = new Rng(seed);
  const pts = [];
  for (let i = 0; i < count; i++) pts.push(new THREE.Vector3(rng.range(-0.45, 0.45), rng.range(-0.45, 0.45), rng.range(-0.45, 0.45)));
  const cube = [];
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (const [x, y, z] of dirs) {
    const n = new THREE.Vector3(x, y, z);
    const t = new THREE.Vector3(y || z ? 1 : 0, x ? 1 : 0, 0);
    if (Math.abs(n.dot(t)) > 0.5) t.set(0, 0, 1);
    const b = new THREE.Vector3().crossVectors(n, t);
    const c = n.clone().multiplyScalar(0.5);
    let v = [c.clone().addScaledVector(t, -0.5).addScaledVector(b, -0.5), c.clone().addScaledVector(t, 0.5).addScaledVector(b, -0.5),
      c.clone().addScaledVector(t, 0.5).addScaledVector(b, 0.5), c.clone().addScaledVector(t, -0.5).addScaledVector(b, 0.5)];
    // wind counter-clockwise around the outward normal
    const nn = new THREE.Vector3().subVectors(v[1], v[0]).cross(new THREE.Vector3().subVectors(v[2], v[0]));
    if (nn.dot(n) < 0) v = v.reverse();
    cube.push({ v, cut: false, n });
  }
  const pieces = [];
  for (let i = 0; i < count; i++) {
    let faces = cube.map((f) => ({ v: f.v.map((p) => p.clone()), cut: f.cut, n: f.n }));
    for (let j = 0; j < count; j++) {
      if (i === j) continue;
      const n = new THREE.Vector3().subVectors(pts[j], pts[i]).normalize();
      const d = n.dot(new THREE.Vector3().addVectors(pts[i], pts[j]).multiplyScalar(0.5));
      faces = clipCell(faces, n, d);
      if (faces.length < 4) break;
    }
    if (faces.length >= 4) pieces.push(buildPiece(faces));
  }
  return pieces;
}

function buildPiece(faces) {
  const c = new THREE.Vector3();
  let n = 0;
  for (const f of faces) for (const p of f.v) { c.add(p); n++; }
  c.multiplyScalar(1 / n);
  const pos = [], nrm = [], cut = [];
  const lo = new THREE.Vector3(1e9, 1e9, 1e9), hi = new THREE.Vector3(-1e9, -1e9, -1e9);
  for (const f of faces) {
    for (let k = 1; k < f.v.length - 1; k++) {
      for (const p of [f.v[0], f.v[k], f.v[k + 1]]) {
        pos.push(p.x - c.x, p.y - c.y, p.z - c.z);
        nrm.push(f.n.x, f.n.y, f.n.z);
        cut.push(f.cut ? 1 : 0);
        lo.min(p); hi.max(p);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aCut', new THREE.Float32BufferAttribute(cut, 1));
  g.computeBoundingSphere();
  return { geo: g, center: c, half: hi.sub(lo).multiplyScalar(0.5) };
}

// ------------------------------------------------------------------ system

export class Debris {
  constructor(scene, world, quality = 1) {
    this.scene = scene;
    this.world = world;
    this.mat = makeBuildingMaterial(true);
    this.pieces = [];
    for (let v = 0; v < 4; v++) this.pieces.push(...fractureCube(101 + v * 17, 5 + v).map((p) => ({ ...p, variant: v })));
    this.cap = Math.round(180 * quality);
    this.pools = this.pieces.map((pc) => {
      const geo = pc.geo.clone();
      const attrs = {};
      for (const [name, size] of INSTANCE_ATTRS) {
        const a = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * size), size);
        a.setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute(name, a);
        attrs[name] = a;
      }
      const mesh = new THREE.InstancedMesh(geo, this.mat, this.cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      scene.add(mesh);
      const n = this.cap;
      return {
        pc, mesh, attrs, n: 0,
        pos: new Float32Array(n * 3), vel: new Float32Array(n * 3), rot: new Float32Array(n * 4), ang: new Float32Array(n * 3),
        size: new Float32Array(n * 3), rest: new Float32Array(n), age: new Float32Array(n), state: new Uint8Array(n), dirty: false,
      };
    });
    this.byVariant = [0, 1, 2, 3].map((v) => this.pools.map((p, i) => (p.pc.variant === v ? i : -1)).filter((i) => i >= 0));
    // gravel
    const rock = new THREE.IcosahedronGeometry(1, 0);
    this.gravelMat = patch(new THREE.MeshStandardMaterial({ color: 0x8a8580, roughness: 0.95 }), 'gravel');
    this.gcap = Math.round(1400 * quality);
    this.gravel = new THREE.InstancedMesh(rock, this.gravelMat, this.gcap);
    this.gravel.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.gravel.castShadow = true;
    this.gravel.frustumCulled = false;
    this.gravel.count = 0;
    this.gravel.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.gcap * 3), 3);
    scene.add(this.gravel);
    const gc = this.gcap;
    this.g = { pos: new Float32Array(gc * 3), vel: new Float32Array(gc * 3), rot: new Float32Array(gc * 4), size: new Float32Array(gc), age: new Float32Array(gc), life: new Float32Array(gc), n: 0, next: 0 };
    this.onSplash = null;
    this.onLand = null;
    this.frame = 0;
  }

  // Break a chunk: info from Buildings.chunkAttrs; center/rot are the chunk's world transform.
  shatter(info, center, rot, baseVel, push, strength) {
    const v = Math.floor(Math.random() * 4);
    const size = info.size;
    for (const pi of this.byVariant[v]) {
      const P = this.pools[pi];
      const k = this._alloc(P);
      if (k < 0) continue;
      const pc = P.pc;
      // fragment centre in chunk space -> world
      _p.set(pc.center.x * size[0], pc.center.y * size[1], pc.center.z * size[2]);
      if (rot) _p.applyQuaternion(rot);
      const x = center.x + _p.x, y = center.y + _p.y, z = center.z + _p.z;
      P.pos.set([x, y, z], k * 3);
      const q = rot || _q.identity();
      P.rot.set([q.x, q.y, q.z, q.w], k * 4);
      // velocity: inherited + push + spread from the chunk centre
      const spread = 2 + 6 * strength;
      let vx = (baseVel ? baseVel.x : 0) + _p.x * 0.6 * strength + (Math.random() - 0.5) * spread;
      let vy = (baseVel ? baseVel.y : 0) + Math.abs(_p.y) * 0.3 + Math.random() * 3 * strength;
      let vz = (baseVel ? baseVel.z : 0) + _p.z * 0.6 * strength + (Math.random() - 0.5) * spread;
      if (push) { vx += push.x * (0.6 + Math.random() * 0.6); vy += push.y * (0.6 + Math.random() * 0.6); vz += push.z * (0.6 + Math.random() * 0.6); }
      P.vel.set([vx, vy, vz], k * 3);
      P.ang.set([(Math.random() - 0.5) * 2.4 * strength, (Math.random() - 0.5) * 2.4 * strength, (Math.random() - 0.5) * 2.4 * strength], k * 3);
      P.size.set(size, k * 3);
      P.age[k] = 0; P.rest[k] = 0; P.state[k] = 1;
      const A = P.attrs;
      A.aCenter.setXYZ(k, info.center[0] + pc.center.x * size[0], info.center[1] + pc.center.y * size[1], info.center[2] + pc.center.z * size[2]);
      A.aSize.setXYZ(k, size[0], size[1], size[2]);
      A.aDims.setXYZ(k, info.dims[0], info.dims[1], info.dims[2]);
      A.aStyle.setXYZW(k, info.style[0], info.style[1], info.style[2], info.style[3]);
      A.aState.setXYZW(k, info.state[0], info.state[1], info.state[2], info.state[3]);
      A.aTint.setXYZ(k, info.tint[0], info.tint[1], info.tint[2]);
      for (const a of Object.values(A)) a.needsUpdate = true;
      P.dirty = true;
    }
    // gravel burst
    const n = Math.round(8 + 14 * strength);
    for (let i = 0; i < n; i++) {
      this.spawnGravel(center.x + (Math.random() - 0.5) * size[0], center.y + (Math.random() - 0.5) * size[1], center.z + (Math.random() - 0.5) * size[2],
        (baseVel ? baseVel.x : 0) + (Math.random() - 0.5) * 14 + (push ? push.x * 0.8 : 0),
        (baseVel ? baseVel.y : 0) + Math.random() * 8,
        (baseVel ? baseVel.z : 0) + (Math.random() - 0.5) * 14 + (push ? push.z * 0.8 : 0),
        0.35 + Math.random() * 1.1, info.b.style === 2 ? [0.42, 0.24, 0.18] : null);
    }
  }

  _alloc(P) {
    if (P.n < this.cap) { const k = P.n++; P.mesh.count = P.n; return k; }
    // recycle the oldest resting (or oldest overall)
    let best = -1, ba = -1;
    for (let i = 0; i < P.n; i++) {
      const a = P.age[i] + (P.state[i] === 2 ? 1000 : 0);
      if (a > ba) { ba = a; best = i; }
    }
    return best;
  }

  spawnGravel(x, y, z, vx, vy, vz, s, col) {
    const g = this.g;
    const k = g.next;
    g.next = (g.next + 1) % this.gcap;
    if (g.n < this.gcap) g.n++;
    g.pos.set([x, y, z], k * 3);
    g.vel.set([vx, vy, vz], k * 3);
    _q.setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    g.rot.set([_q.x, _q.y, _q.z, _q.w], k * 4);
    g.size[k] = s; g.age[k] = 0; g.life[k] = 14 + Math.random() * 18;
    const c = col || [0.5, 0.49, 0.46];
    const t = 0.75 + Math.random() * 0.4;
    this.gravel.instanceColor.setXYZ(k, c[0] * t, c[1] * t, c[2] * t);
    this.gravel.instanceColor.needsUpdate = true;
    this.gravel.count = g.n;
  }

  update(dt) {
    this.frame++;
    const W = this.world;
    for (const P of this.pools) {
      if (!P.n) continue;
      let moved = false;
      for (let k = 0; k < P.n; k++) {
        if (P.state[k] !== 1) { P.age[k] += dt; continue; }
        P.age[k] += dt;
        const o = k * 3;
        let vx = P.vel[o], vy = P.vel[o + 1], vz = P.vel[o + 2];
        vy -= G * dt;
        let x = P.pos[o] + vx * dt, y = P.pos[o + 1] + vy * dt, z = P.pos[o + 2] + vz * dt;
        // orientation
        const r = k * 4;
        _q.set(P.rot[r], P.rot[r + 1], P.rot[r + 2], P.rot[r + 3]);
        _w.set(P.ang[o], P.ang[o + 1], P.ang[o + 2]);
        const wl = _w.length();
        if (wl > 1e-4) { _dq.setFromAxisAngle(_w.multiplyScalar(1 / wl), wl * dt); _q.premultiply(_dq); }
        // lowest point of the oriented box
        _m.makeRotationFromQuaternion(_q);
        const e = _m.elements;
        const hx = P.pc.half.x * P.size[o], hy = P.pc.half.y * P.size[o + 1], hz = P.pc.half.z * P.size[o + 2];
        const ext = Math.abs(e[1]) * hx + Math.abs(e[5]) * hy + Math.abs(e[9]) * hz;
        let ground = W.groundAt(x, z);
        const inWater = ground < -0.5;
        if (inWater && y < -1.2) { vx *= 1 - 2.5 * dt; vy *= 1 - 3 * dt; vz *= 1 - 2.5 * dt; if (P.age[k] > 0.05 && P.pos[o + 1] >= -1.2 && this.onSplash) this.onSplash(x, z, Math.min(1, P.size[o] * P.size[o + 1] / 120)); }
        if ((this.frame + k) % 3 === 0 || y - ext < 80) {
          const roof = W.roofAt(x, z, P.pos[o + 1] - ext);
          if (roof > ground) ground = roof;
        }
        if (y - ext < ground) {
          y = ground + ext;
          const impact = -vy;
          if (vy < 0) vy = -vy * 0.18;
          vx *= 0.55; vz *= 0.55;
          P.ang[o] *= 0.6; P.ang[o + 1] *= 0.6; P.ang[o + 2] *= 0.6;
          if (impact > 6 && this.onLand) this.onLand(x, ground, z, impact, P.size[o] * P.size[o + 1] * P.size[o + 2]);
          const sp = vx * vx + vy * vy + vz * vz;
          if (sp < 0.6) { P.rest[k] += dt; if (P.rest[k] > 0.5) { P.state[k] = 2; vx = vy = vz = 0; } }
          // settle toward lying flat: damp spin harder when slow
          if (sp < 4) { P.ang[o] *= 0.8; P.ang[o + 1] *= 0.8; P.ang[o + 2] *= 0.8; }
        }
        P.vel[o] = vx; P.vel[o + 1] = vy; P.vel[o + 2] = vz;
        P.pos[o] = x; P.pos[o + 1] = y; P.pos[o + 2] = z;
        P.rot.set([_q.x, _q.y, _q.z, _q.w], r);
        _s.set(P.size[o], P.size[o + 1], P.size[o + 2]);
        _m.compose(_p.set(x, y, z), _q, _s);
        P.mesh.setMatrixAt(k, _m);
        moved = true;
      }
      if (moved || P.dirty) { P.mesh.instanceMatrix.needsUpdate = true; P.dirty = false; }
    }
    // gravel: simple ballistic bits that settle then sink away
    const g = this.g;
    if (g.n) {
      for (let k = 0; k < g.n; k++) {
        const o = k * 3;
        g.age[k] += dt;
        const lifeLeft = g.life[k] - g.age[k];
        let s = g.size[k] * Math.min(1, Math.max(0, lifeLeft / 3));
        if (g.vel[o] || g.vel[o + 1] || g.vel[o + 2]) {
          g.vel[o + 1] -= G * dt;
          g.pos[o] += g.vel[o] * dt; g.pos[o + 1] += g.vel[o + 1] * dt; g.pos[o + 2] += g.vel[o + 2] * dt;
          const gr = W.groundAt(g.pos[o], g.pos[o + 2]);
          if (g.pos[o + 1] < gr + s * 0.6) {
            g.pos[o + 1] = gr + s * 0.6;
            g.vel[o + 1] *= -0.25; g.vel[o] *= 0.5; g.vel[o + 2] *= 0.5;
            if (Math.abs(g.vel[o + 1]) < 0.8) { g.vel[o] = g.vel[o + 1] = g.vel[o + 2] = 0; }
          }
        }
        if (lifeLeft <= 0) s = 0;
        _q.set(g.rot[k * 4], g.rot[k * 4 + 1], g.rot[k * 4 + 2], g.rot[k * 4 + 3]);
        _m.compose(_p.set(g.pos[o], g.pos[o + 1], g.pos[o + 2]), _q, _s.set(s, s * 0.7, s));
        this.gravel.setMatrixAt(k, _m);
      }
      this.gravel.instanceMatrix.needsUpdate = true;
    }
  }

  get active() {
    let n = 0;
    for (const P of this.pools) for (let k = 0; k < P.n; k++) if (P.state[k] === 1) n++;
    return n;
  }
}
