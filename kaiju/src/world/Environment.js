// Ocean, seawall, piers, harbour cranes and the distant hills that close the horizon.
import * as THREE from 'three';
import { G, patch, FOG_FRAG_PARS, NOISE_GLSL } from '../render/Shading.js';
import { Rng } from '../core/Rng.js';

export const SEA_LEVEL = -1.2;

const OCEAN_VERT = /* glsl */`
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vFogWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;

const OCEAN_FRAG = /* glsl */`
uniform float uTime; uniform vec3 uSunDir, uSunCol; uniform float uSunI, uCoast, uNight;
uniform vec4 uWakes[6]; uniform vec4 uRipples[16];
varying vec3 vW;
${NOISE_GLSL}
vec2 waveGrad(vec2 p, float t) {
  // sum of directional swells + two scrolling noise layers for chop
  vec2 g = vec2(0.0);
  vec4 dirs[5];
  dirs[0] = vec4(0.8, 0.6, 0.045, 1.1); dirs[1] = vec4(-0.4, 0.9, 0.07, 0.8); dirs[2] = vec4(0.95, -0.3, 0.11, 0.55);
  dirs[3] = vec4(0.2, 1.0, 0.19, 0.35); dirs[4] = vec4(-0.85, 0.5, 0.29, 0.22);
  for (int i = 0; i < 5; i++) {
    vec2 d = normalize(dirs[i].xy); float k = dirs[i].z; float a = dirs[i].w;
    float ph = dot(d, p) * k - t * sqrt(9.81 * k);
    g += d * k * a * cos(ph);
  }
  float e = 0.6;
  vec2 q = p * 0.11 + vec2(t * 0.05, t * 0.03);
  g += vec2(kjF2(q + vec2(e, 0.0)) - kjF2(q - vec2(e, 0.0)), kjF2(q + vec2(0.0, e)) - kjF2(q - vec2(0.0, e))) * 0.9;
  vec2 q2 = p * 0.47 - vec2(t * 0.09, t * 0.11);
  g += vec2(kjN2(q2 + vec2(0.3, 0.0)) - kjN2(q2 - vec2(0.3, 0.0)), kjN2(q2 + vec2(0.0, 0.3)) - kjN2(q2 - vec2(0.0, 0.3))) * 0.5;
  return g;
}
void main() {
  vec2 p = vW.xz;
  float dist = length(vW - cameraPosition);
  vec2 g = waveGrad(p, uTime) * mix(0.32, 0.06, smoothstep(300.0, 3000.0, dist));
  float foam = 0.0;
  // kaiju wakes: rings and a turbulent trail
  for (int i = 0; i < 6; i++) {
    vec4 w = uWakes[i];
    if (w.w <= 0.0) continue;
    vec2 d = p - w.xy; float r = length(d);
    float ring = sin(r * 0.35 - uTime * 3.0) * exp(-r / (w.z * 1.6));
    g += normalize(d + 1e-3) * ring * 0.6 * w.w;
    foam += smoothstep(w.z * 1.3, w.z * 0.5, r) * w.w * (0.6 + 0.4 * kjN2(p * 0.4 + uTime));
  }
  for (int i = 0; i < 16; i++) {
    vec4 rp = uRipples[i];
    if (rp.w <= 0.0) continue;
    vec2 d = p - rp.xy; float r = length(d);
    float front = rp.z;
    float ring = exp(-pow((r - front) / 6.0, 2.0)) * rp.w;
    g += normalize(d + 1e-3) * ring * 1.2;
    foam += ring * 0.8 + smoothstep(front * 0.6, 0.0, r) * rp.w * 0.8;
  }
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 V = normalize(cameraPosition - vW);
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 refl = textureLod(uFogCube, R, 1.5).rgb;
  vec3 deep = vec3(0.004, 0.018, 0.024) * (uSunI * 0.035 + 0.02);
  vec3 sss = vec3(0.01, 0.05, 0.05) * max(dot(V, -uSunDir) * 0.5 + 0.5, 0.0) * uSunI * 0.03;
  vec3 col = mix(deep + sss, refl, fres);
  vec3 H = normalize(V + uSunDir);
  float spec = pow(max(dot(N, H), 0.0), 900.0) * 9.0 + pow(max(dot(N, H), 0.0), 120.0) * 0.22;
  col += uSunCol * spec * uSunI * step(0.0, uSunDir.y);
  // shoreline wash along the seawall
  float shore = exp(-max(p.y - uCoast, 0.0) / 6.0) * (0.5 + 0.5 * sin(uTime * 1.2 + p.x * 0.05));
  foam += shore * 0.6 * kjN2(p * 0.3 + uTime * 0.2);
  foam = clamp(foam, 0.0, 1.0);
  col = mix(col, vec3(0.75, 0.78, 0.78) * (uSunI * 0.05 + 0.03), foam * (0.5 + 0.5 * kjN2(p * 0.9 - uTime)));
  col = kjSafe(kjFog(col, vW));
  gl_FragColor = vec4(col, 1.0);
}
`;

export class Environment {
  constructor(city, scene, opts = {}) {
    this.city = city;
    this.scene = scene;
    this.wakes = Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, 0, 0));
    this.ripples = Array.from({ length: 16 }, () => new THREE.Vector4(0, 0, 0, 0));
    this.rippleAge = new Float32Array(16);
    this.rippleSpeed = new Float32Array(16);
    this._ocean();
    if (!opts.oceanOnly) {
      this._seawall();
      this._hills();
    }
  }

  _ocean() {
    const u = {
      uFogCube: G.uFogCube, uFogDensity: G.uFogDensity, uFogFall: G.uFogFall, uFogMix: G.uFogMix, uTime: G.uTime,
      uSunDir: G.uSunDir, uSunCol: G.uSunCol, uNight: G.uNight, uSunI: { value: 1 }, uCoast: { value: this.city.coast + 6 },
      uWakes: { value: this.wakes }, uRipples: { value: this.ripples },
    };
    this.oceanUniforms = u;
    const mat = new THREE.ShaderMaterial({
      uniforms: u, vertexShader: 'varying vec3 vFogWorld;\n' + OCEAN_VERT,
      fragmentShader: FOG_FRAG_PARS + OCEAN_FRAG,
    });
    const geo = new THREE.PlaneGeometry(30000, 16000, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(0, SEA_LEVEL, this.city.coast + 6 + 8000);
    this.ocean = m;
    this.scene.add(m);
  }

  _seawall() {
    const c = this.city;
    const concrete = patch(new THREE.MeshStandardMaterial({ color: 0x6d6a64, roughness: 0.9 }), 'seawall');
    const wall = new THREE.Mesh(new THREE.BoxGeometry(c.x1 - c.x0 + 1800, 10, 6), concrete);
    wall.position.set((c.x0 + c.x1) / 2, -4.6, c.coast + 3);
    wall.receiveShadow = true;
    this.scene.add(wall);
    const deck = patch(new THREE.MeshStandardMaterial({ color: 0x55534f, roughness: 0.85 }), 'pier');
    const pileGeo = new THREE.CylinderGeometry(0.7, 0.7, 12, 8);
    const piles = [];
    for (const p of c.piers) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(p.x1 - p.x0, 1.6, p.z1 - p.z0), deck);
      m.position.set((p.x0 + p.x1) / 2, -0.8, (p.z0 + p.z1) / 2 + 6);
      m.castShadow = m.receiveShadow = true;
      this.scene.add(m);
      for (let x = p.x0 + 3; x < p.x1; x += 8) for (let z = p.z0 + 10; z < p.z1 + 6; z += 10) piles.push([x, z]);
    }
    const pm = new THREE.InstancedMesh(pileGeo, concrete, piles.length);
    piles.forEach(([x, z], i) => pm.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, -7, z)));
    this.scene.add(pm);
  }

  _hills() {
    // countryside heightfield: flat around the city, rising into ridges; the coast bends
    // south on both sides so the city sits inside a bay
    const c = this.city;
    const N = 180, S = 30000;
    const cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.coast) / 2;
    const pos = new Float32Array((N + 1) * (N + 1) * 3), col = new Float32Array((N + 1) * (N + 1) * 3);
    const hash = (x, z) => { let h = Math.imul(x, 374761393) + Math.imul(z, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const vn = (x, z) => {
      const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
      const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
      const a = hash(ix, iz), b = hash(ix + 1, iz), d = hash(ix, iz + 1), e = hash(ix + 1, iz + 1);
      return a + (b - a) * u + (d - a) * v + (a - b - d + e) * u * v;
    };
    const ridge = (x, z) => {
      let s = 0, a = 1, f = 1 / 2200;
      for (let i = 0; i < 6; i++) { const n = 1 - Math.abs(vn(x * f + i * 7.1, z * f - i * 3.3) * 2 - 1); s += a * n * n; f *= 2.05; a *= 0.48; }
      return s;
    };
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const x = cx - S / 2 + (j / N) * S, z = cz - S / 2 + (i / N) * S;
      const coastZ = c.coast + 6 + Math.max(0, Math.abs(x) - 2300) * 0.75;
      const dx = Math.max(0, Math.max(c.x0 - 700 - x, x - c.x1 - 700)), dz = Math.max(0, c.z0 - 700 - z);
      const d = Math.hypot(dx, dz);
      const k = THREE.MathUtils.smoothstep(d, 200, 4200);
      let h = ridge(x, z) * 520 * k + vn(x / 900, z / 900) * 40 * k - 0.6;
      const sea = THREE.MathUtils.smoothstep(z, coastZ - 40, coastZ + 160);
      h = h * (1 - sea) - sea * 26;
      const o = (i * (N + 1) + j) * 3;
      pos[o] = x; pos[o + 1] = h; pos[o + 2] = z;
      const t = Math.min(1, Math.max(0, h / 450));
      const rock = THREE.MathUtils.smoothstep(h, 260, 520);
      const g = 0.75 + 0.5 * vn(x / 300, z / 300);
      col[o] = (0.07 + 0.05 * t + 0.12 * rock) * g; col[o + 1] = (0.09 + 0.03 * t + 0.1 * rock) * g; col[o + 2] = (0.045 + 0.02 * t + 0.09 * rock) * g;
      if (sea > 0.5) { col[o] = 0.16; col[o + 1] = 0.15; col[o + 2] = 0.12; }
    }
    const idx = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const a = i * (N + 1) + j, b = a + N + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), 'hills');
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    this.scene.add(m);
    this.terrain = m;
  }

  // A kaiju or ship moving through the water: position, radius, strength 0..1.
  setWake(i, x, z, r, s) { this.wakes[i].set(x, z, r, s); }
  ripple(x, z, energy) {
    let k = 0, best = Infinity;
    for (let i = 0; i < 16; i++) { if (this.ripples[i].w <= 0) { k = i; break; } if (this.rippleAge[i] < best) { best = this.rippleAge[i]; k = i; } }
    this.ripples[k].set(x, z, 0, Math.min(1, energy));
    this.rippleAge[k] = 0;
    this.rippleSpeed[k] = 18 + energy * 20;
  }

  update(dt, sunI) {
    this.oceanUniforms.uSunI.value = sunI;
    for (let i = 0; i < 16; i++) {
      const r = this.ripples[i];
      if (r.w <= 0) continue;
      this.rippleAge[i] += dt;
      r.z += this.rippleSpeed[i] * dt;
      r.w -= dt * 0.25;
    }
  }
}
