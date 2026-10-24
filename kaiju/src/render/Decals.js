// Ground decals: footprint craters, scorch marks, impact craters and crack fields.
// One instanced, lit quad mesh with a procedural colour + normal atlas (2x2 tiles).
import * as THREE from 'three';
import { patch } from './Shading.js';

export const DECAL = { FOOT: 0, SCORCH: 1, CRATER: 2, CRACK: 3 };

function makeAtlas(size = 256) {
  const S = size * 2;
  const col = document.createElement('canvas'); col.width = col.height = S;
  const nor = document.createElement('canvas'); nor.width = nor.height = S;
  const cc = col.getContext('2d'), nc = nor.getContext('2d');
  const ci = cc.createImageData(S, S), ni = nc.createImageData(S, S);
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const vn = (() => {
    const p = new Float32Array(1024); for (let i = 0; i < 1024; i++) p[i] = rnd();
    const h = (x, y) => p[((x & 31) + (y & 31) * 32) & 1023];
    return (x, y) => {
      const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      return h(ix, iy) * (1 - u) * (1 - v) + h(ix + 1, iy) * u * (1 - v) + h(ix, iy + 1) * (1 - u) * v + h(ix + 1, iy + 1) * u * v;
    };
  })();
  const fbm = (x, y) => vn(x, y) * 0.5 + vn(x * 2.1, y * 2.1) * 0.25 + vn(x * 4.3, y * 4.3) * 0.125 + vn(x * 8.7, y * 8.7) * 0.0625;
  // radial cracks shared by several tiles
  const cracks = [];
  for (let i = 0; i < 9; i++) {
    const pts = [[0.5, 0.5]];
    let a = rnd() * Math.PI * 2, x = 0.5, y = 0.5;
    for (let k = 0; k < 14; k++) { a += (rnd() - 0.5) * 0.9; x += Math.cos(a) * 0.035; y += Math.sin(a) * 0.035; pts.push([x, y]); }
    cracks.push(pts);
  }
  const crackDist = (u, v) => {
    let d = 1;
    for (const c of cracks) for (let k = 0; k < c.length - 1; k++) {
      const [ax, ay] = c[k], [bx, by] = c[k + 1];
      const dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy)));
      d = Math.min(d, Math.hypot(u - ax - dx * t, v - ay - dy * t) * (1 + k * 0.08));
    }
    return d;
  };
  for (let t = 0; t < 4; t++) {
    const H = new Float32Array(size * size), A = new Float32Array(size * size), C = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size, r = Math.hypot(u - 0.5, v - 0.5) * 2;
      const n = fbm(u * 8 + t * 3, v * 8);
      let h = 0, a = 0, c = 0.5;
      if (t === 0) { // footprint: elongated bowl with three toe gouges and a raised rim
        const ex = (u - 0.5) * 1.6, ey = (v - 0.55) * 1.1;
        const er = Math.hypot(ex, ey) * 2;
        h = -Math.max(0, 1 - er) * 0.9;
        for (const tx of [-0.18, 0, 0.18]) {
          const gx = (u - 0.5 - tx * 1.2) * 5, gy = (v - 0.18) * 2.2;
          h -= Math.max(0, 1 - Math.hypot(gx, gy)) * 0.7;
        }
        h += Math.exp(-((er - 1.0) ** 2) * 18) * 0.35 * (0.6 + n);
        const cd = crackDist(u, v);
        h -= Math.max(0, 1 - cd * 60) * 0.25 * (r < 0.95 ? 1 : 0);
        a = Math.min(1, Math.max(0, 1.25 - er) * 2.2) * (0.75 + 0.25 * n) + Math.max(0, 1 - cd * 70) * Math.max(0, 1 - r) * 0.8;
        c = 0.38 + h * 0.25 + n * 0.12;
      } else if (t === 1) { // scorch
        a = Math.max(0, 1 - Math.pow(r / (0.8 + 0.25 * n), 1.6));
        c = 0.03 + 0.07 * n;
        h = -a * 0.05;
      } else if (t === 2) { // crater
        h = -(Math.max(0, 1 - r * 1.2) ** 1.5) * 1.2 + Math.exp(-((r - 0.85) ** 2) * 25) * 0.4 * (0.5 + n);
        const cd = crackDist(u, v);
        h -= Math.max(0, 1 - cd * 70) * 0.3;
        a = Math.min(1, Math.max(0, 1.1 - r) * 2.5) * (0.7 + 0.3 * n);
        c = 0.25 + 0.2 * n + h * 0.15;
      } else { // cracks
        const cd = crackDist(u, v);
        a = Math.max(0, 1 - cd * 55) * Math.max(0, 1 - r);
        h = -a * 0.6;
        c = 0.12;
      }
      H[y * size + x] = h; A[y * size + x] = a; C[y * size + x] = c;
    }
    const ox = (t % 2) * size, oy = Math.floor(t / 2) * size;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const hx = H[y * size + Math.min(size - 1, x + 1)] - H[y * size + Math.max(0, x - 1)];
      const hy = H[Math.min(size - 1, y + 1) * size + x] - H[Math.max(0, y - 1) * size + x];
      let nx = -hx * 18, ny = -hy * 18, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const j = ((oy + y) * S + ox + x) * 4;
      const cv = Math.max(0, Math.min(1, C[i])) * 255;
      ci.data[j] = cv; ci.data[j + 1] = cv * 0.96; ci.data[j + 2] = cv * 0.92; ci.data[j + 3] = Math.max(0, Math.min(1, A[i])) * 255;
      ni.data[j] = (nx / l * 0.5 + 0.5) * 255; ni.data[j + 1] = (ny / l * 0.5 + 0.5) * 255; ni.data[j + 2] = (nz / l) * 255; ni.data[j + 3] = 255;
    }
  }
  cc.putImageData(ci, 0, 0); nc.putImageData(ni, 0, 0);
  const tc = new THREE.CanvasTexture(col); tc.colorSpace = THREE.SRGBColorSpace;
  const tn = new THREE.CanvasTexture(nor); tn.colorSpace = THREE.NoColorSpace;
  for (const t of [tc, tn]) { t.anisotropy = 4; }
  return { tc, tn };
}

export class Decals {
  constructor(scene, cap = 360) {
    const { tc, tn } = makeAtlas(256);
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const tile = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2);
    geo.setAttribute('aTile', tile);
    const mat = new THREE.MeshStandardMaterial({
      map: tc, normalMap: tn, roughness: 0.95, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });
    patch(mat, 'decal', (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aTile;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = (uv + aTile) * 0.5;\n#endif\n#ifdef USE_NORMALMAP\nvNormalMapUv = (uv + aTile) * 0.5;\n#endif');
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 1;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.tile = tile;
    this.cap = cap;
    this.next = 0;
    scene.add(this.mesh);
  }

  add(kind, x, y, z, size, rot = Math.random() * Math.PI * 2, stretch = 1) {
    const k = this.next;
    this.next = (this.next + 1) % this.cap;
    if (this.mesh.count < this.cap) this.mesh.count++;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.04 + k * 0.0002, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(size, 1, size * stretch));
    this.mesh.setMatrixAt(k, m);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.tile.setXY(k, kind % 2, Math.floor(kind / 2) === 0 ? 1 : 0);
    this.tile.needsUpdate = true;
  }
}
