// Buildings, props, decoration, trees, bushes, rocks and near-camera grass, built from shared map data.
import * as THREE from 'three';
import { MAT_NAMES } from '../../../shared/map/Buildings.js';
import { MAP_HALF } from '../../../shared/constants.js';
import { hash3, makeNoise } from '../../../shared/rng.js';

const TEXKEY = { concrete: 'concrete', brick: 'brick', plaster: 'plaster', wood: 'wood', metal: 'metal', roof: 'roof', rust: 'rust', bark: 'bark',
  rock: 'rock', sandbag: 'sandbag', crate: 'crate', floor: 'floor', tile: 'concrete', asphalt: 'gravel', plank: 'plank' };

export function makeMaterials(tex) {
  const mats = {};
  for (const name of MAT_NAMES) {
    const t = tex[TEXKEY[name]];
    mats[name] = new THREE.MeshStandardMaterial({
      map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), vertexColors: true,
      roughness: name === 'metal' ? 0.55 : name === 'rust' ? 0.75 : 0.9, metalness: name === 'metal' ? 0.35 : name === 'rust' ? 0.3 : 0,
    });
    mats[name].userData.scale = t.scale;
  }
  mats.glass = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.03, 0.04, 0.04), roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.6, envMapIntensity: 1.5 });
  mats.dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.05, 0.05, 0.05), roughness: 0.8 });
  mats.tyre = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.03, 0.03, 0.03), roughness: 0.95 });
  mats.frame = new THREE.MeshStandardMaterial({ map: tex.wood.map, color: new THREE.Color(0.55, 0.5, 0.45), roughness: 0.85 });
  mats.lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.3, 0.2) });
  return mats;
}

class Geo {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  get count() { return this.p.length / 3; }
  quad(a, b, c, d, n, uvs, cols) {
    const o = this.count;
    for (const v of [a, b, c, d]) this.p.push(v[0], v[1], v[2]);
    for (let k = 0; k < 4; k++) { this.n.push(n[0], n[1], n[2]); this.uv.push(uvs[k][0], uvs[k][1]); this.c.push(cols[k], cols[k], cols[k]); }
    this.i.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  tri(a, b, c, n, uvs, col = 1) {
    const o = this.count;
    for (const v of [a, b, c]) this.p.push(v[0], v[1], v[2]);
    for (let k = 0; k < 3; k++) { this.n.push(n[0], n[1], n[2]); this.uv.push(uvs[k][0], uvs[k][1]); this.c.push(col, col, col); }
    this.i.push(o, o + 1, o + 2);
  }
  // Triangle or quad oriented so its front face (CCW) and normal point away from `ref`.
  poly(vs, uvs, col, ref) {
    const a = vs[0], b = vs[1], c = vs[2];
    let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    let ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    let nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    let mx = 0, my = 0, mz = 0; for (const v of vs) { mx += v[0] / vs.length; my += v[1] / vs.length; mz += v[2] / vs.length; }
    if (nx * (mx - ref[0]) + ny * (my - ref[1]) + nz * (mz - ref[2]) < 0) { vs = vs.slice().reverse(); uvs = uvs.slice().reverse(); nx = -nx; ny = -ny; nz = -nz; }
    const cols = vs.map(() => col);
    if (vs.length === 4) this.quad(vs[0], vs[1], vs[2], vs[3], [nx, ny, nz], uvs, cols);
    else this.tri(vs[0], vs[1], vs[2], [nx, ny, nz], uvs, col);
  }
  // Axis-aligned box with world-projected UVs and simple vertical AO.
  box(b, s, opts = {}) {
    const [x0, y0, z0, x1, y1, z1] = b;
    const ao = (y) => opts.noAo ? 1 : Math.min(1, 0.58 + 0.42 * Math.min(1, (y - (opts.floor ?? y0)) / 1.3)) * (1 - 0.18 * Math.max(0, 1 - (y1 - y) / 0.5) * (opts.ceilAo ? 1 : 0));
    const U = (v) => v / s;
    // +X
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [[U(z1), U(y0)], [U(z0), U(y0)], [U(z0), U(y1)], [U(z1), U(y1)]], [ao(y0), ao(y0), ao(y1), ao(y1)]);
    // -X
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [[U(z0), U(y0)], [U(z1), U(y0)], [U(z1), U(y1)], [U(z0), U(y1)]], [ao(y0), ao(y0), ao(y1), ao(y1)]);
    // +Z
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [[U(x0), U(y0)], [U(x1), U(y0)], [U(x1), U(y1)], [U(x0), U(y1)]], [ao(y0), ao(y0), ao(y1), ao(y1)]);
    // -Z
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [[U(x1), U(y0)], [U(x0), U(y0)], [U(x0), U(y1)], [U(x1), U(y1)]], [ao(y0), ao(y0), ao(y1), ao(y1)]);
    // +Y
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [[U(x0), U(z1)], [U(x1), U(z1)], [U(x1), U(z0)], [U(x0), U(z0)]], [1, 1, 1, 1]);
    // -Y (ceilings)
    if (!opts.noBottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [[U(x0), U(z0)], [U(x1), U(z0)], [U(x1), U(z1)], [U(x0), U(z1)]], [0.72, 0.72, 0.72, 0.72]);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    return g;
  }
}

export function buildStructures(map, mats) {
  const group = new THREE.Group();
  group.name = 'structures';
  const chunks = new Map(); // key -> { matName -> Geo }
  const geoFor = (x, z, m) => {
    const key = Math.floor((x + MAP_HALF) / 128) * 100 + Math.floor((z + MAP_HALF) / 128);
    let c = chunks.get(key); if (!c) chunks.set(key, c = {});
    return c[m] || (c[m] = new Geo());
  };
  const B = map.boxes;
  const extras = [];  // non-merged meshes (cylinders etc.)
  map.buildings.forEach((b) => {
    const skipBoxes = b.tpl === 'car' || b.tpl === 'barrels';
    if (!skipBoxes) {
      for (let i = b.boxStart; i < b.boxEnd; i++) {
        const k = i * 6;
        const bx = [B[k], B[k + 1], B[k + 2], B[k + 3], B[k + 4], B[k + 5]];
        const m = MAT_NAMES[map.boxMat[i]];
        const isFoundation = bx[1] < b.y - 1;
        const g = geoFor((bx[0] + bx[3]) / 2, (bx[2] + bx[5]) / 2, m);
        g.box(bx, mats[m].userData.scale, { noBottom: isFoundation || bx[1] <= b.y + 0.01, floor: b.y, ceilAo: !b.prop });
      }
    }
    for (const d of b.deco) addDeco(d, b, geoFor, extras, mats);
  });
  for (const [, c] of chunks) for (const m in c) {
    const mesh = new THREE.Mesh(c[m].build(), m === 'glass' ? mats.glass : m === 'frame' ? mats.frame : m === 'dark' ? mats.dark : m === 'tyre' ? mats.tyre : mats[m]);
    mesh.castShadow = m !== 'glass'; mesh.receiveShadow = true;
    group.add(mesh);
  }
  for (const e of extras) group.add(e);
  return group;
}

function addDeco(d, b, geoFor, extras, mats) {
  const [x0, y0, z0, x1, y1, z1] = d.box;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const h = hash3(Math.round(cx * 10), Math.round(y0 * 10), Math.round(cz * 10));
  switch (d.k) {
    case 'window': case 'door': {
      const alongX = (x1 - x0) > (z1 - z0);
      const t = 0.07;
      const G = geoFor(cx, cz, 'frame');
      const thin = alongX ? [z0 - 0.02, z1 + 0.02] : [x0 - 0.02, x1 + 0.02];
      const mk = (a0, a1, yy0, yy1) => alongX ? [a0, yy0, thin[0], a1, yy1, thin[1]] : [thin[0], yy0, a0, thin[1], yy1, a1];
      const a0 = alongX ? x0 : z0, a1 = alongX ? x1 : z1;
      G.box(mk(a0 - t, a0, y0, y1 + t), 1, { noAo: true });
      G.box(mk(a1, a1 + t, y0, y1 + t), 1, { noAo: true });
      G.box(mk(a0 - t, a1 + t, y1, y1 + t), 1, { noAo: true });
      if (d.k === 'window') {
        G.box(mk(a0 - t, a1 + t, y0 - t, y0), 1, { noAo: true });
        const mid = alongX ? (z0 + z1) / 2 : (x0 + x1) / 2;
        if (h < 0.42) {
          const gg = geoFor(cx, cz, 'glass');
          gg.box(alongX ? [x0, y0, mid - 0.01, x1, y1, mid + 0.01] : [mid - 0.01, y0, z0, mid + 0.01, y1, z1], 1, { noAo: true });
        } else if (h > 0.72) {
          // boarded up
          const pg = geoFor(cx, cz, 'plank');
          const out = alongX ? z1 + 0.03 : x1 + 0.03;
          for (let k = 0; k < 3; k++) {
            const yy = y0 + (y1 - y0) * (0.18 + k * 0.3);
            pg.box(alongX ? [x0 - 0.1, yy, out - 0.03, x1 + 0.1, yy + 0.16, out] : [out - 0.03, yy, z0 - 0.1, out, yy + 0.16, z1 + 0.1], 1.2, { noAo: true });
          }
        }
      }
      break;
    }
    case 'roof': {
      const G = geoFor(cx, cz, d.m === undefined || d.m === 5 ? 'roof' : MAT_NAMES[d.m]);
      const gable = geoFor(cx, cz, 'plank');
      const s = 2.2;
      const ref = [cx, y0 - 0.5, cz];
      if (d.ridge === 'p') {
        const apex = [cx, y1, cz];
        const c = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]];
        for (let k = 0; k < 4; k++) G.poly([c[k], c[(k + 1) % 4], apex], [[0, 0], [1, 0], [0.5, 2.5]], 1, ref);
      } else if (d.ridge === 'x') {
        const L = Math.hypot((z1 - z0) / 2, y1 - y0) / s;
        G.poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, cz], [x0, y1, cz]], [[x0 / s, 0], [x1 / s, 0], [x1 / s, L], [x0 / s, L]], 0.95, ref);
        G.poly([[x1, y0, z0], [x0, y0, z0], [x0, y1, cz], [x1, y1, cz]], [[x1 / s, 0], [x0 / s, 0], [x0 / s, L], [x1 / s, L]], 0.95, ref);
        gable.poly([[x1 - 0.3, y0, z1 - 0.3], [x1 - 0.3, y0, z0 + 0.3], [x1 - 0.3, y1 - 0.25, cz]], [[z1 / 2, y0 / 2], [z0 / 2, y0 / 2], [cz / 2, y1 / 2]], 0.8, [cx, y0, cz]);
        gable.poly([[x0 + 0.3, y0, z0 + 0.3], [x0 + 0.3, y0, z1 - 0.3], [x0 + 0.3, y1 - 0.25, cz]], [[z0 / 2, y0 / 2], [z1 / 2, y0 / 2], [cz / 2, y1 / 2]], 0.8, [cx, y0, cz]);
      } else {
        const L = Math.hypot((x1 - x0) / 2, y1 - y0) / s;
        G.poly([[x1, y0, z0], [x1, y0, z1], [cx, y1, z1], [cx, y1, z0]], [[z0 / s, 0], [z1 / s, 0], [z1 / s, L], [z0 / s, L]], 0.95, ref);
        G.poly([[x0, y0, z1], [x0, y0, z0], [cx, y1, z0], [cx, y1, z1]], [[z1 / s, 0], [z0 / s, 0], [z0 / s, L], [z1 / s, L]], 0.95, ref);
        gable.poly([[x0 + 0.3, y0, z1 - 0.3], [x1 - 0.3, y0, z1 - 0.3], [cx, y1 - 0.25, z1 - 0.3]], [[x0 / 2, y0 / 2], [x1 / 2, y0 / 2], [cx / 2, y1 / 2]], 0.8, [cx, y0, cz]);
        gable.poly([[x1 - 0.3, y0, z0 + 0.3], [x0 + 0.3, y0, z0 + 0.3], [cx, y1 - 0.25, z0 + 0.3]], [[x1 / 2, y0 / 2], [x0 / 2, y0 / 2], [cx / 2, y1 / 2]], 0.8, [cx, y0, cz]);
      }
      break;
    }
    case 'mast': {
      const G = geoFor(cx, cz, 'rust');
      const H = y1 - y0;
      for (let yy = y0 + 2; yy < y1; yy += 2.5) { G.box([cx - 0.6, yy, cz - 0.04, cx + 0.6, yy + 0.06, cz + 0.04], 1, { noAo: true }); G.box([cx - 0.04, yy + 1.2, cz - 0.6, cx + 0.04, yy + 1.26, cz + 0.6], 1, { noAo: true }); }
      for (const [ox, oz] of [[-0.5, -0.5], [0.5, -0.5], [0, 0.5]]) G.box([cx + ox - 0.05, y0, cz + oz - 0.05, cx + ox + 0.05, y1, cz + oz + 0.05], 1, { noAo: true });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mats.lamp);
      lamp.position.set(cx, y1 + 0.2, cz);
      lamp.userData.blink = true;
      extras.push(lamp);
      void H;
      break;
    }
    case 'cyl': {
      const r = (x1 - x0) / 2, H = y1 - y0;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, H, 24, 1, true), mats.rust);
      m.position.set(cx, y0 + H / 2, cz); m.castShadow = true; m.receiveShadow = true;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 1.03, 1.6, 24), mats.rust);
      cap.position.set(cx, y1 + 0.8, cz); cap.castShadow = true;
      extras.push(m, cap);
      break;
    }
    case 'car': {
      const alongX = (x1 - x0) > (z1 - z0);
      const car = carMesh(mats, h);
      car.position.set(cx, y0, cz);
      if (alongX) car.rotation.y = Math.PI / 2;
      car.rotation.y += h > 0.5 ? Math.PI : 0;
      extras.push(car);
      break;
    }
    case 'barrels': {
      for (const [ox, oz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4]]) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.92, 14), mats.rust);
        m.position.set(cx + ox, y0 + 0.46, cz + oz); m.castShadow = true; m.receiveShadow = true;
        extras.push(m);
      }
      break;
    }
    case 'railcar': {
      const alongX = (x1 - x0) > (z1 - z0);
      const L = alongX ? x1 - x0 : z1 - z0;
      for (const s of [-1, 1]) for (const k of [-0.36, 0.36]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.18, 12), mats.tyre);
        w.rotation.z = Math.PI / 2;
        if (alongX) { w.rotation.set(Math.PI / 2, 0, 0); w.position.set(cx + k * L, y0 + 0.42, cz + s * 0.75); }
        else { w.rotation.set(0, 0, Math.PI / 2); w.position.set(cx + s * 0.75, y0 + 0.42, cz + k * L); }
        extras.push(w);
      }
      break;
    }
  }
}

function carMesh(mats, h) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.62, 4.3), mats.rust);
  body.position.y = 0.62;
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 1.2), mats.rust);
  hood.position.set(0, 0.98, 1.45); hood.rotation.x = 0.06;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 2.0), mats.rust);
  cabin.position.set(0, 1.2, -0.2);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.4, 1.7), mats.dark);
  glass.position.set(0, 1.22, -0.2);
  g.add(body, hood, cabin, glass);
  for (const [x, z] of [[-0.8, 1.35], [0.8, 1.35], [-0.8, -1.35], [0.8, -1.35]]) {
    if (h > 0.6 && x > 0 && z > 0) continue; // a missing wheel
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 14), mats.tyre);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.3, z);
    g.add(w);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.rotation.z = (h - 0.5) * 0.06;
  return g;
}

// ---------------------------------------------------------------- vegetation
function displace(geo, amt, seed) {
  const N = makeNoise(seed);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = N.noise(x * 1.7 + 3, z * 1.7 + y * 1.3) * amt;
    p.setXYZ(i, x * (1 + n), y + n * 0.3, z * (1 + n));
  }
  geo.computeVertexNormals();
  return geo;
}

function mergeGeos(list) {
  // list of [geometry, colorRGB]; returns non-indexed merged geometry with vertex colours
  let total = 0;
  const parts = list.map(([g, c]) => { const ng = g.index ? g.toNonIndexed() : g; total += ng.attributes.position.count; return [ng, c]; });
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let o = 0;
  for (const [g, c] of parts) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    for (let i = 0; i < n; i++) { const y = g.attributes.position.array[i * 3 + 1]; const s = c[3] ? 0.75 + 0.25 * Math.min(1, y / c[3]) : 1; col[(o + i) * 3] = c[0] * s; col[(o + i) * 3 + 1] = c[1] * s; col[(o + i) * 3 + 2] = c[2] * s; }
    o += n;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

function windMaterial(mat, strength, wind) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = wind;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
#else
  vec3 ip = vec3(0.0);
#endif
  float sw = max(transformed.y, 0.0) * ${strength.toFixed(4)};
  transformed.x += sin(uWind * 1.3 + ip.x * 0.11 + ip.z * 0.07) * sw;
  transformed.z += cos(uWind * 1.1 + ip.z * 0.13) * sw * 0.6;`);
  };
  mat.customProgramCacheKey = () => 'wind' + strength;
  return mat;
}

export function buildVegetation(map, tex, quality) {
  const group = new THREE.Group();
  group.name = 'vegetation';
  const wind = { value: 0 };
  const barkMat = new THREE.MeshStandardMaterial({ map: tex.bark.map, normalMap: tex.bark.normalMap, roughness: 0.95 });
  const leafMat = windMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }), 0.012, wind);
  const birchBark = new THREE.MeshStandardMaterial({ map: tex.bark.map, color: new THREE.Color(1.9, 1.85, 1.75), roughness: 0.9 });

  // pine: trunk + stacked displaced cones
  const pineTrunk = new THREE.CylinderGeometry(0.09, 0.26, 9.5, 7); pineTrunk.translate(0, 4.75, 0);
  const cones = [];
  for (let k = 0; k < 5; k++) {
    const r = 2.3 - k * 0.38, hh = 3.2 - k * 0.3;
    const c = displace(new THREE.ConeGeometry(r, hh, 9, 3), 0.18, 11 + k);
    c.translate(0, 3.2 + k * 1.45 + hh / 2, 0);
    cones.push([c, [0.11, 0.15 + k * 0.006, 0.09, 10]]);
  }
  const pineLeaves = mergeGeos(cones);
  // birch: white trunk + blobby canopy
  const birchTrunk = new THREE.CylinderGeometry(0.08, 0.17, 8, 7); birchTrunk.translate(0, 4, 0);
  const blobs = [];
  for (let k = 0; k < 4; k++) {
    for (let c = 0; c < 3; c++) {
      const pl = new THREE.PlaneGeometry(3.4 - k * 0.3, 2.8, 1, 1);
      pl.rotateY(c * Math.PI / 3 + k * 0.4);
      pl.translate(Math.sin(k * 2.1) * 0.7, 5.0 + k * 1.0, Math.cos(k * 2.1) * 0.7);
      blobs.push([pl, [0.95, 0.9, 0.62]]);
    }
  }
  const birchLeaves = mergeGeos(blobs);
  const birchLeafMat = windMaterial(new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.95 }), 0.012, wind);
  // dead tree: trunk + a few bare branches
  const deadParts = [[new THREE.CylinderGeometry(0.07, 0.22, 8, 6).translate(0, 4, 0), [0.25, 0.22, 0.19]]];
  for (let k = 0; k < 4; k++) {
    const br = new THREE.CylinderGeometry(0.02, 0.06, 2.2, 4);
    br.translate(0, 1.1, 0); br.rotateZ(0.9 + k * 0.2); br.rotateY(k * 1.7); br.translate(0, 3.5 + k * 1.1, 0);
    deadParts.push([br, [0.25, 0.22, 0.19]]);
  }
  const deadGeo = mergeGeos(deadParts);
  const deadMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: tex.bark.map });

  const byType = [[], [], []];
  for (const t of map.trees) byType[t[4]].push(t);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const inst = (geo, mat, list, tint, shadow) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((t, i) => {
      q.setFromAxisAngle(up, hash3(Math.round(t[0] * 10), Math.round(t[2] * 10), 7) * Math.PI * 2);
      s.setScalar(t[3]); p.set(t[0], t[1] - 0.3, t[2]);
      m4.compose(p, q, s); im.setMatrixAt(i, m4);
      if (tint) { const v = 0.8 + hash3(i, 3, 9) * 0.4; im.setColorAt(i, new THREE.Color(v, v * (0.95 + hash3(i, 5, 1) * 0.1), v * 0.9)); }
    });
    im.castShadow = shadow; im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
    return im;
  };
  const sh = quality.treeShadows;
  inst(pineTrunk, barkMat, byType[0], false, sh);
  inst(pineLeaves, leafMat, byType[0], true, sh);
  inst(birchTrunk, birchBark, byType[1], false, sh);
  inst(birchLeaves, birchLeafMat, byType[1], true, sh);
  inst(deadGeo, deadMat, byType[2], false, sh);

  // bushes
  const cards = [];
  for (let k = 0; k < 4; k++) { const pl = new THREE.PlaneGeometry(1.7, 1.25, 2, 2); pl.translate(0, 0.6, 0); pl.rotateY(k * Math.PI / 4); cards.push([pl, [1, 1, 1, 1.2]]); }
  const top = new THREE.PlaneGeometry(1.4, 1.4); top.rotateX(-Math.PI / 2); top.translate(0, 1.05, 0); cards.push([top, [1, 1, 1]]);
  const bushGeo = mergeGeos(cards);
  const bushMat = windMaterial(new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.95 }), 0.04, wind);
  const bm = new THREE.InstancedMesh(bushGeo, bushMat, map.bushes.length);
  map.bushes.forEach((b, i) => {
    q.setFromAxisAngle(up, b[0]); s.set(b[3], b[3] * 0.75, b[3]); p.set(b[0], b[1] - 0.1, b[2]);
    m4.compose(p, q, s); bm.setMatrixAt(i, m4);
    const v = 0.7 + hash3(i, 2, 2) * 0.45; bm.setColorAt(i, new THREE.Color(v * (b[4] === 2 ? 1.25 : 1), v, v * 0.9));
  });
  bm.receiveShadow = true; bm.castShadow = false;
  group.add(bm);

  // rocks
  const rockGeo = displace(new THREE.IcosahedronGeometry(1, 2), 0.32, 5);
  const rockMat = new THREE.MeshStandardMaterial({ map: tex.rock.map, normalMap: tex.rock.normalMap, roughness: 0.9 });
  const rm = new THREE.InstancedMesh(rockGeo, rockMat, map.rocks.length);
  map.rocks.forEach((r, i) => {
    q.setFromEuler(new THREE.Euler(hash3(i, 1, 1) * 0.5, r[4] % 6.28, hash3(i, 2, 1) * 0.5));
    s.set(r[3] * 0.95, r[3] * 0.8, r[3] * 0.95); p.set(r[0], r[1] + r[3] * 0.15, r[2]);
    m4.compose(p, q, s); rm.setMatrixAt(i, m4);
  });
  rm.castShadow = true; rm.receiveShadow = true;
  group.add(rm);

  group.userData.wind = wind;
  return group;
}

// Near-camera grass tufts that wrap around the viewer (toroidal scatter).
export class Grass {
  constructor(map, world, count) {
    this.map = map; this.world = world;
    this.R = 48;
    this.count = count;
    const blades = [];
    for (let k = 0; k < 3; k++) {
      const pl = new THREE.PlaneGeometry(0.55, 0.42, 1, 2);
      pl.translate(0, 0.21, 0); pl.rotateY(k * Math.PI / 3);
      blades.push(pl);
    }
    const geo = mergeGeos(blades.map(b => [b, [1, 1, 1]]));
    const tex = grassTexture();
    this.wind = { value: 0 };
    const mat = windMaterial(new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, color: new THREE.Color(0.62, 0.66, 0.46), roughness: 1 }), 0.25, this.wind);
    this.mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.count = count;
    this.off = new Float32Array(count * 2);
    this.cell = new Int32Array(count * 2).fill(-999999);
    for (let i = 0; i < count; i++) { this.off[i * 2] = hash3(i, 1, 99) * this.R * 2; this.off[i * 2 + 1] = hash3(i, 2, 99) * this.R * 2; }
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(); this.p = new THREE.Vector3();
  }
  update(cx, cz, t) {
    this.wind.value = t;
    const R2 = this.R * 2;
    let dirty = false;
    for (let i = 0; i < this.count; i++) {
      const ox = this.off[i * 2], oz = this.off[i * 2 + 1];
      const kx = Math.round((cx - ox) / R2), kz = Math.round((cz - oz) / R2);
      if (kx === this.cell[i * 2] && kz === this.cell[i * 2 + 1]) continue;
      this.cell[i * 2] = kx; this.cell[i * 2 + 1] = kz;
      const x = ox + kx * R2, z = oz + kz * R2;
      let sc = 0.7 + hash3(i, kx, kz) * 0.7;
      const y = this.world.heightAt(x, z);
      if (y < this.map.water + 0.4 || this.map.roadDist(x, z) < 3.5) sc = 0;
      else {
        const n = this.world.normalAt(x, z);
        if (n[1] < 0.85) sc = 0;
        else if (this.world.overlaps(x - 0.3, y - 0.2, z - 0.3, x + 0.3, y + 0.4, z + 0.3) >= 0) sc = 0;
      }
      this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash3(i, kz, kx) * 6.28);
      this.s.set(sc, sc * (0.7 + hash3(kx, i, 3) * 0.6), sc); this.p.set(x, y - 0.05, z);
      this.m4.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m4);
      dirty = true;
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

function grassTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 70; i++) {
    const x = 4 + Math.random() * 120, w = 1 + Math.random() * 1.6, h = 50 + Math.random() * 76, bend = (Math.random() - 0.5) * 34;
    const tone = Math.random(), dry = Math.random() < 0.3;
    g.strokeStyle = dry ? `rgb(${Math.round(120 + tone * 40)},${Math.round(108 + tone * 30)},${Math.round(64 + tone * 20)})` : `rgb(${Math.round(64 + tone * 40)},${Math.round(84 + tone * 40)},${Math.round(36 + tone * 18)})`;
    g.lineWidth = w;
    g.beginPath(); g.moveTo(x, 128); g.quadraticCurveTo(x + bend * 0.3, 128 - h * 0.6, x + bend, 128 - h); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function leafTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.pow(Math.random(), 0.6) * 118;
    const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r * 0.85 + 10;
    const tone = Math.random(), dead = Math.random() < 0.15;
    g.fillStyle = dead ? `rgb(${Math.round(100 + tone * 40)},${Math.round(80 + tone * 30)},${Math.round(40 + tone * 20)})` : `rgb(${Math.round(36 + tone * 34)},${Math.round(52 + tone * 40)},${Math.round(24 + tone * 16)})`;
    g.save(); g.translate(x, y); g.rotate(Math.random() * Math.PI * 2);
    g.beginPath(); g.ellipse(0, 0, 5 + Math.random() * 4, 2.2 + Math.random() * 1.5, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  g.strokeStyle = 'rgb(48,38,28)'; g.lineWidth = 2;
  for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(128, 250); g.quadraticCurveTo(128 + (Math.random() - 0.5) * 80, 180, 128 + (Math.random() - 0.5) * 200, 40 + Math.random() * 100); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
