// Dynamic world pieces: ground loot, the ash wall, the transport plane and intel terminals.
import * as THREE from 'three';
import { buildWeapon, buildGrenade, weaponMats } from '../entity/WeaponModels.js';
import { itemName } from '../../../shared/sim/Items.js';

const AMMO_COL = { '9mm': 0x8a7a3a, '556': 0x4f6b3a, '762': 0x6b4a2a, '12g': 0x7a2a22, '338': 0x2f3f55 };

export class ItemField {
  constructor(scene) {
    this.group = new THREE.Group(); this.group.name = 'items'; scene.add(this.group);
    this.items = new Map();
    this.mats = {
      box: new THREE.MeshStandardMaterial({ color: 0x4d5238, roughness: 0.8 }),
      kit: new THREE.MeshStandardMaterial({ color: 0xd9d6cc, roughness: 0.6 }),
      cross: new THREE.MeshStandardMaterial({ color: 0x9a1c18, roughness: 0.6 }),
      stim: new THREE.MeshStandardMaterial({ color: 0x5a7a8a, roughness: 0.3, metalness: 0.3 }),
      helmet: [null, 0x4b5240, 0x3a4032, 0x2b2d2b].map(c => c && new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })),
      vest: [null, 0x4a4a3c, 0x2e3326, 0x1d1f1c].map(c => c && new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })),
      pack: new THREE.MeshStandardMaterial({ color: 0x5c5a45, roughness: 0.95 }),
      ammo: {},
      highlight: new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.18, depthWrite: false }),
    };
    for (const k in AMMO_COL) this.mats.ammo[k] = new THREE.MeshStandardMaterial({ color: AMMO_COL[k], roughness: 0.6, metalness: 0.2 });
    this.geo = { s: new THREE.BoxGeometry(0.22, 0.12, 0.14), helm: new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), vest: new THREE.BoxGeometry(0.45, 0.1, 0.5), pack: new THREE.BoxGeometry(0.35, 0.18, 0.45), kit: new THREE.BoxGeometry(0.25, 0.08, 0.18), band: new THREE.CylinderGeometry(0.04, 0.04, 0.08, 10), stim: new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8), att: new THREE.BoxGeometry(0.1, 0.06, 0.08) };
    this.lastCull = 0;
    this.focus = null;
  }

  mesh(it) {
    const M = this.mats, Gm = this.geo;
    const g = new THREE.Group();
    switch (it.k) {
      case 'weapon': { const w = buildWeapon(it.id, 'parkerized', it.att); w.rotation.z = Math.PI / 2; w.position.y = 0.035; g.add(w); break; }
      case 'ammo': { const m = new THREE.Mesh(Gm.s, M.ammo[it.id] || M.box); m.position.y = 0.06; g.add(m); break; }
      case 'helmet': { const m = new THREE.Mesh(Gm.helm, M.helmet[it.tier]); g.add(m); break; }
      case 'vest': { const m = new THREE.Mesh(Gm.vest, M.vest[it.tier]); m.position.y = 0.05; g.add(m); break; }
      case 'pack': { const m = new THREE.Mesh(Gm.pack, M.pack); m.scale.setScalar(0.8 + it.tier * 0.15); m.position.y = 0.09; g.add(m); break; }
      case 'heal': {
        if (it.id === 'kit') { const m = new THREE.Mesh(Gm.kit, M.kit); m.position.y = 0.04; const c = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.082, 0.03), M.cross); c.position.y = 0.04; g.add(m, c); }
        else if (it.id === 'stim') { const m = new THREE.Mesh(Gm.stim, M.stim); m.rotation.z = Math.PI / 2; m.position.y = 0.02; g.add(m); }
        else { const m = new THREE.Mesh(Gm.band, M.kit); m.rotation.z = Math.PI / 2; m.position.y = 0.04; g.add(m); }
        break;
      }
      case 'throw': { const m = buildGrenade(it.id); m.position.y = 0.05; m.rotation.z = Math.PI / 2; g.add(m); break; }
      case 'att': { const m = new THREE.Mesh(Gm.att, weaponMats().polymer); m.position.y = 0.03; g.add(m); break; }
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  add(id, x, y, z, it) {
    if (this.items.has(id)) this.remove(id);
    const m = this.mesh(it);
    m.position.set(x, y, z);
    m.rotation.y = (id * 2.399) % 6.283;
    m.userData = { id, it };
    this.group.add(m);
    this.items.set(id, { id, x, y, z, it, m });
  }
  remove(id) { const e = this.items.get(id); if (e) { this.group.remove(e.m); this.items.delete(id); } }
  setCount(id, n) { const e = this.items.get(id); if (e) e.it.n = n; }
  clear() { for (const id of [...this.items.keys()]) this.remove(id); }

  // Distance culling (cheap) every ~0.3 s.
  update(dt, cx, cz) {
    this.lastCull -= dt;
    if (this.lastCull > 0) return;
    this.lastCull = 0.3;
    for (const e of this.items.values()) e.m.visible = Math.abs(e.x - cx) < 70 && Math.abs(e.z - cz) < 70;
  }

  // Item the player is looking at (ray from eye), within reach.
  pick(eye, dir, reach = 2.9) {
    let best = null, bd = 0.6;
    for (const e of this.items.values()) {
      const dx = e.x - eye.x, dy = e.y + 0.08 - eye.y, dz = e.z - eye.z;
      const along = dx * dir.x + dy * dir.y + dz * dir.z;
      if (along < 0 || along > reach + 0.6) continue;
      const hd = Math.hypot(dx, dz);
      if (hd > reach) continue;
      const px = dx - dir.x * along, py = dy - dir.y * along, pz = dz - dir.z * along;
      const off = Math.hypot(px, py, pz) / Math.max(0.6, along) * 2.2;
      if (off < bd) { bd = off; best = e; }
    }
    return best;
  }

  near(x, y, z, r = 2.7) {
    const out = [];
    for (const e of this.items.values()) if (Math.hypot(e.x - x, e.z - z) < r && e.y < y + 2.2 && e.y > y - 1.6) out.push(e);
    out.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    return out;
  }
}
export { itemName };

// ---------------------------------------------------------------- ash wall
const ASH_VERT = /* glsl */`
varying vec3 vW; varying vec2 vUv;
#include <fog_pars_vertex>
void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`;
const ASH_FRAG = /* glsl */`
uniform float time; varying vec3 vW; varying vec2 vUv;
#include <fog_pars_fragment>
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += n(p) * a; p *= 2.03; a *= 0.5; } return s; }
void main() {
  vec2 p = vec2(atan(vW.z, vW.x) * 60.0, vW.y * 0.06);
  float f = fbm(p * vec2(0.25, 1.0) + vec2(time * 0.05, -time * 0.18));
  float g = fbm(p * vec2(0.6, 2.0) + vec2(-time * 0.08, -time * 0.3) + f);
  float a = smoothstep(0.2, 0.75, g) * (0.55 + 0.45 * (1.0 - vUv.y)) + (1.0 - vUv.y) * 0.25;
  vec3 col = mix(vec3(0.12, 0.1, 0.09), vec3(0.42, 0.36, 0.3), g);
  col += vec3(0.9, 0.35, 0.1) * smoothstep(0.78, 0.95, g) * 0.25 * (1.0 - vUv.y);
  gl_FragColor = vec4(col, clamp(a, 0.0, 0.92));
  #include <fog_fragment>
}`;

export class AshWall {
  constructor(scene) {
    this.u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 } }]);
    const g = new THREE.CylinderGeometry(1, 1, 1, 96, 1, true);
    g.translate(0, 0.5, 0);
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: ASH_VERT, fragmentShader: ASH_FRAG, uniforms: this.u, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: true }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }
  update(t, cx, cz, r) {
    this.u.time.value = t;
    this.mesh.position.set(cx, -20, cz);
    this.mesh.scale.set(Math.max(0.5, r), 480, Math.max(0.5, r));
    this.mesh.visible = r < 740;
  }
}

// ---------------------------------------------------------------- plane
export function buildPlane() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a4f44, roughness: 0.6, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1d1b, roughness: 0.7 });
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.6, 26, 16), mat); fus.rotation.x = Math.PI / 2; g.add(fus);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat); nose.rotation.x = -Math.PI / 2; nose.position.z = -13; g.add(nose);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(34, 0.4, 4), mat); wing.position.set(0, 1.4, -2); g.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(11, 0.3, 2.5), mat); tail.position.set(0, 1.6, 12); g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, 3), mat); fin.position.set(0, 4, 12); g.add(fin);
  for (const x of [-7, -12, 7, 12]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 3.5, 12), dark); e.rotation.x = Math.PI / 2; e.position.set(x, 0.9, -3.6); g.add(e); }
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 4), dark); ramp.position.set(0, -1.4, 13.5); ramp.rotation.x = 0.4; g.add(ramp);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function buildTerminal() {
  const g = new THREE.Group();
  const screenMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.6, 0.6) });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.28), screenMat);
  s.position.set(0, 1.1, 0.02);
  g.add(s);
  const light = new THREE.PointLight(0x55ff99, 0.8, 4, 2); light.position.set(0, 1.2, 0.4); g.add(light);
  g.userData = { screenMat, light };
  return g;
}

// ---------------------------------------------------------------- buggy
let buggyMats = null;
export function buildBuggy(tex, variant = 0) {
  if (!buggyMats) buggyMats = {
    paint: [0x4d5236, 0x6a5a3c, 0x3d4447].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.35, map: tex ? tex.rust.map : null })),
    tube: new THREE.MeshStandardMaterial({ color: 0x1d1e1f, roughness: 0.45, metalness: 0.7 }),
    tyre: new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.95 }),
    rim: new THREE.MeshStandardMaterial({ color: 0x6b6d6e, roughness: 0.35, metalness: 0.85 }),
    seat: new THREE.MeshStandardMaterial({ color: 0x241f1a, roughness: 0.8 }),
    light: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.8, 2.2) }),
    tail: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.15, 0.1) }),
  };
  const M = buggyMats;
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const paint = M.paint[variant % M.paint.length];
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; body.add(m); return m; };
  add(new THREE.BoxGeometry(1.7, 0.22, 3.5), paint, 0, 0.55, 0);                 // floor pan
  add(new THREE.BoxGeometry(1.5, 0.35, 0.9), paint, 0, 0.78, -1.45, -0.25);       // nose
  add(new THREE.BoxGeometry(1.4, 0.5, 0.8), M.tube, 0, 0.85, 1.35);               // engine
  add(new THREE.BoxGeometry(1.75, 0.08, 0.5), paint, 0, 0.72, -1.95);             // bumper
  const tube = (x0, y0, z0, x1, y1, z1, r = 0.035) => {
    const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1);
    const L = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 6), M.tube);
    m.position.copy(a).lerp(b, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    m.castShadow = true; body.add(m);
  };
  for (const s of [-1, 1]) {
    tube(s * 0.75, 0.65, -0.75, s * 0.7, 1.75, -0.35); tube(s * 0.7, 1.75, -0.35, s * 0.7, 1.75, 0.75); tube(s * 0.7, 1.75, 0.75, s * 0.75, 0.65, 1.1);
    tube(s * 0.82, 0.62, -1.7, s * 0.82, 0.62, 1.6);
  }
  tube(-0.7, 1.75, -0.35, 0.7, 1.75, -0.35); tube(-0.7, 1.75, 0.75, 0.7, 1.75, 0.75); tube(-0.75, 0.65, -0.75, 0.75, 0.65, -0.75);
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.55, 0.1, 0.55), M.seat, s * 0.42, 0.72, 0.15);
    add(new THREE.BoxGeometry(0.55, 0.6, 0.1), M.seat, s * 0.42, 1.0, 0.45, 0.15);
    add(new THREE.BoxGeometry(0.16, 0.1, 0.04), M.light, s * 0.55, 0.88, -1.86);
    add(new THREE.BoxGeometry(0.14, 0.08, 0.04), M.tail, s * 0.6, 0.85, 1.76);
  }
  const wheel = add(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 8), M.tube, -0.42, 1.05, -0.45, 1.0, 0, 0); // steering wheel
  wheel.rotation.set(-0.9, 0, 0);
  // wheels
  const wheels = [];
  const tyreGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.34, 16); tyreGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.36, 8); rimGeo.rotateZ(Math.PI / 2);
  for (const [x, z, front] of [[-0.95, -1.25, true], [0.95, -1.25, true], [-0.95, 1.2, false], [0.95, 1.2, false]]) {
    const hub = new THREE.Group(); hub.position.set(x, 0.44, z);
    const spin = new THREE.Group(); hub.add(spin);
    const t = new THREE.Mesh(tyreGeo, M.tyre); t.castShadow = true; spin.add(t);
    const r = new THREE.Mesh(rimGeo, M.rim); spin.add(r);
    g.add(hub); wheels.push({ hub, spin, front });
  }
  g.userData = { body, wheels, roll: 0 };
  return g;
}

export function buildSupplyCrate() {
  const g = new THREE.Group();
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.4), new THREE.MeshStandardMaterial({ color: 0x2c4a6b, roughness: 0.6, metalness: 0.3 }));
  crate.position.y = 0.5; crate.castShadow = true; crate.receiveShadow = true; g.add(crate);
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.14, 1.44), new THREE.MeshStandardMaterial({ color: 0xc8a032, roughness: 0.5 }));
  band.position.y = 0.55; g.add(band);
  const chuteGeo = new THREE.SphereGeometry(3.4, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.35);
  const chute = new THREE.Mesh(chuteGeo, new THREE.MeshStandardMaterial({ color: 0xd0d4d8, roughness: 0.9, side: THREE.DoubleSide }));
  chute.position.y = 5.2; g.add(chute);
  const pts = [];
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; pts.push(new THREE.Vector3(0, 1.0, 0), new THREE.Vector3(Math.cos(a) * 2.8, 5.0, Math.sin(a) * 2.8)); }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x222222 })));
  const beacon = new THREE.PointLight(0xff3020, 0, 18, 2); beacon.position.y = 1.6; g.add(beacon);
  g.userData = { chute, beacon };
  return g;
}
