// GPU-instanced billboard particles. Two pools: lit, alpha-blended volumes (dust, smoke,
// steam, spray) shaded with a baked puff normal map so billows catch the sun; and
// additive emitters (fire, sparks, flashes, embers, tracers). Simulation runs on the CPU
// in flat typed arrays.
import * as THREE from 'three';
import { G, FOG_FRAG_PARS } from './Shading.js';

function puffAtlas(size = 256) {
  // 2x2 atlas of soft billowy puffs: RGB = normal, A = density
  const c = document.createElement('canvas');
  c.width = c.height = size * 2;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size * 2, size * 2);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let t = 0; t < 4; t++) {
    const blobs = [];
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.28;
      blobs.push([0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r, 0.1 + rnd() * 0.16]);
    }
    const H = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      let h = 0;
      for (const [bx, by, br] of blobs) {
        const d2 = ((u - bx) ** 2 + (v - by) ** 2) / (br * br);
        if (d2 < 1) h = Math.max(h, Math.sqrt(1 - d2) * br * 3.2);
      }
      // fine noise on the surface
      h += (Math.sin(u * 61 + t) * Math.sin(v * 53 - t) * 0.5 + Math.sin(u * 131 + v * 97) * 0.25) * 0.012;
      H[y * size + x] = h;
    }
    const ox = (t % 2) * size, oy = Math.floor(t / 2) * size;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const h = H[y * size + x];
      const hx = H[y * size + Math.min(size - 1, x + 1)] - H[y * size + Math.max(0, x - 1)];
      const hy = H[Math.min(size - 1, y + 1) * size + x] - H[Math.max(0, y - 1) * size + x];
      let nx = -hx * 14, ny = hy * 14, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const edge = Math.min(1, Math.max(0, (Math.hypot(x / size - 0.5, y / size - 0.5) - 0.32) / 0.18));
      const a = Math.min(1, h * 6) * (1 - edge);
      const i = ((oy + y) * size * 2 + ox + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = nz * 255; img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

const VERT = /* glsl */`
attribute vec4 iPos;     // xyz, size
attribute vec4 iCol;     // rgb, alpha
attribute vec4 iMisc;    // rotation, atlas tile, heat, stretch
attribute vec3 iVel;
varying vec2 vUv; varying vec4 vCol; varying vec4 vMisc; varying vec3 vW; varying vec3 vFogWorld; varying vec3 vRight; varying vec3 vUp; varying vec3 vFwd;
uniform float uStretch;
void main() {
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float c = cos(iMisc.x), s = sin(iMisc.x);
  vec3 r = right * c + up * s, u = -right * s + up * c;
  vec2 q = position.xy;
  // velocity-aligned streaks for sparks
  if (iMisc.w > 0.0) {
    vec3 v = iVel; float vl = length(v);
    if (vl > 0.01) {
      vec3 vd = v / vl;
      vec3 side = cross(vd, cameraPosition - iPos.xyz);
      side /= max(length(side), 1e-4);
      r = side; u = vd * (1.0 + iMisc.w * vl * 0.05);
    }
  }
  vec3 wp = iPos.xyz + (r * q.x + u * q.y) * iPos.w;
  vUv = uv; vCol = iCol; vMisc = iMisc; vW = wp; vFogWorld = wp; vRight = r; vUp = u;
  vFwd = normalize(cameraPosition - wp);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const FRAG_LIT = /* glsl */`
uniform sampler2D uAtlas; uniform vec3 uSunDir, uSunCol, uAmb; uniform float uSunI;
varying vec2 vUv; varying vec4 vCol; varying vec4 vMisc; varying vec3 vW; varying vec3 vRight; varying vec3 vUp; varying vec3 vFwd;
${FOG_FRAG_PARS}
void main() {
  float tile = vMisc.y;
  vec2 uv = (vUv + vec2(mod(tile, 2.0), floor(tile / 2.0))) * 0.5;
  vec4 t = texture2D(uAtlas, uv);
  float a = t.a * vCol.a;
  if (a < 0.004) discard;
  vec3 n = (t.r * 2.0 - 1.0) * vRight + (t.g * 2.0 - 1.0) * vUp + t.b * vFwd;
  n /= max(length(n), 1e-4);
  float ndl = dot(n, uSunDir);
  float wrap = clamp(ndl * 0.6 + 0.4, 0.0, 1.0);
  // forward scattering when looking toward the sun through thin dust
  float fwd = pow(max(dot(-vFwd, uSunDir), 0.0), 6.0) * (1.0 - t.a) * 1.5;
  vec3 light = uSunCol * uSunI * (wrap + fwd) * 0.3183 + uAmb * (0.55 + 0.45 * n.y);
  vec3 col = vCol.rgb * light;
  // embedded glow (fire-lit smoke)
  col += vec3(2.2, 0.8, 0.25) * vMisc.z * t.a;
  col = kjSafe(kjFog(col, vW));
  gl_FragColor = vec4(col * a, a);
}
`;

const FRAG_ADD = /* glsl */`
uniform sampler2D uAtlas;
varying vec2 vUv; varying vec4 vCol; varying vec4 vMisc; varying vec3 vW;
${FOG_FRAG_PARS}
void main() {
  vec2 d = vUv - 0.5;
  float r = length(d) * 2.0;
  float a;
  if (vMisc.y > 3.5) {
    a = smoothstep(1.0, 0.0, r);                 // soft glow
    a *= a;
  } else {
    vec4 t = texture2D(uAtlas, (vUv + vec2(mod(vMisc.y, 2.0), floor(vMisc.y / 2.0))) * 0.5);
    a = t.a * smoothstep(1.0, 0.4, r);
  }
  a *= vCol.a;
  if (a < 0.003) discard;
  vec3 col = vCol.rgb * a;
  float f = clamp(length(vW - cameraPosition) * uFogDensity * 0.6, 0.0, 0.9);
  gl_FragColor = vec4(kjSafe(col * (1.0 - f)), 0.0);
}
`;

class Pool {
  constructor(scene, cap, blending, frag, atlas, extraUniforms) {
    this.cap = cap;
    const geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('uv', base.getAttribute('uv'));
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.iCol = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.iMisc = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.iVel = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.iPos); geo.setAttribute('iCol', this.iCol); geo.setAttribute('iMisc', this.iMisc); geo.setAttribute('iVel', this.iVel);
    geo.instanceCount = 0;
    this.uniforms = {
      uAtlas: { value: atlas }, uFogCube: G.uFogCube, uFogDensity: G.uFogDensity, uFogFall: G.uFogFall, uFogMix: G.uFogMix,
      uSunDir: G.uSunDir, uSunCol: G.uSunCol, uSunI: { value: 1 }, uAmb: { value: new THREE.Color(0.3, 0.32, 0.36) }, uStretch: { value: 0 },
      ...extraUniforms,
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: frag, transparent: true, depthWrite: false,
      blending: blending === 'add' ? THREE.CustomBlending : THREE.CustomBlending,
      blendSrc: THREE.OneFactor, blendDst: blending === 'add' ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = blending === 'add' ? 3 : 2;
    scene.add(this.mesh);
    this.geo = geo;
    // simulation state
    this.p = new Float32Array(cap * 3); this.v = new Float32Array(cap * 3);
    this.life = new Float32Array(cap); this.age = new Float32Array(cap);
    this.size0 = new Float32Array(cap); this.size1 = new Float32Array(cap);
    this.col = new Float32Array(cap * 3); this.a0 = new Float32Array(cap);
    this.rot = new Float32Array(cap); this.spin = new Float32Array(cap);
    this.drag = new Float32Array(cap); this.buoy = new Float32Array(cap);
    this.tile = new Float32Array(cap); this.heat = new Float32Array(cap); this.stretch = new Float32Array(cap);
    this.fadeIn = new Float32Array(cap); this.grav = new Float32Array(cap);
    this.n = 0;
  }

  spawn(o) {
    let k;
    if (this.n < this.cap) k = this.n++;
    else {
      // replace the particle closest to death
      let best = 0, bl = 1e9;
      for (let i = 0; i < this.n; i += 7) { const l = this.life[i] - this.age[i]; if (l < bl) { bl = l; best = i; } }
      k = best;
    }
    this.p.set(o.p, k * 3);
    this.v.set(o.v || [0, 0, 0], k * 3);
    this.life[k] = o.life; this.age[k] = 0;
    this.size0[k] = o.size; this.size1[k] = o.size1 ?? o.size;
    this.col.set(o.color || [1, 1, 1], k * 3);
    this.a0[k] = o.alpha ?? 1;
    this.rot[k] = Math.random() * Math.PI * 2; this.spin[k] = o.spin ?? (Math.random() - 0.5) * 0.4;
    this.drag[k] = o.drag ?? 0.5; this.buoy[k] = o.buoy ?? 0;
    this.tile[k] = o.tile ?? Math.floor(Math.random() * 4);
    this.heat[k] = o.heat ?? 0; this.stretch[k] = o.stretch ?? 0;
    this.fadeIn[k] = o.fadeIn ?? 0.08; this.grav[k] = o.grav ?? 0;
    return k;
  }

  update(dt, wind) {
    let n = this.n;
    for (let k = 0; k < n; k++) {
      this.age[k] += dt;
      if (this.age[k] >= this.life[k]) {
        // swap-remove
        n--;
        if (k !== n) this._move(n, k);
        k--;
        continue;
      }
      const o = k * 3;
      const dr = Math.exp(-this.drag[k] * dt);
      this.v[o] = (this.v[o] - wind.x) * dr + wind.x;
      this.v[o + 1] = this.v[o + 1] * dr + (this.buoy[k] - this.grav[k]) * dt;
      this.v[o + 2] = (this.v[o + 2] - wind.z) * dr + wind.z;
      this.p[o] += this.v[o] * dt; this.p[o + 1] += this.v[o + 1] * dt; this.p[o + 2] += this.v[o + 2] * dt;
      if (this.p[o + 1] < 0.3 && this.grav[k] > 0) { this.p[o + 1] = 0.3; this.v[o + 1] *= -0.3; }
      this.rot[k] += this.spin[k] * dt;
    }
    this.n = n;
    const P = this.iPos.array, C = this.iCol.array, M = this.iMisc.array, V = this.iVel.array;
    for (let k = 0; k < n; k++) {
      const t = this.age[k] / this.life[k];
      const s = this.size0[k] + (this.size1[k] - this.size0[k]) * (1 - (1 - t) * (1 - t));
      const fi = Math.min(1, this.age[k] / Math.max(0.001, this.fadeIn[k] * this.life[k]));
      const a = this.a0[k] * fi * (1 - t) * (1 - t * 0.3);
      const o = k * 3, q = k * 4;
      P[q] = this.p[o]; P[q + 1] = this.p[o + 1]; P[q + 2] = this.p[o + 2]; P[q + 3] = s;
      C[q] = this.col[o]; C[q + 1] = this.col[o + 1]; C[q + 2] = this.col[o + 2]; C[q + 3] = a;
      M[q] = this.rot[k]; M[q + 1] = this.tile[k]; M[q + 2] = this.heat[k] * (1 - t); M[q + 3] = this.stretch[k];
      V[o] = this.v[o]; V[o + 1] = this.v[o + 1]; V[o + 2] = this.v[o + 2];
    }
    this.geo.instanceCount = n;
    for (const at of [this.iPos, this.iCol, this.iMisc, this.iVel]) { at.clearUpdateRanges(); at.addUpdateRange(0, n * at.itemSize); at.needsUpdate = true; }
  }

  _move(from, to) {
    const arrays3 = [this.p, this.v, this.col];
    for (const a of arrays3) { a[to * 3] = a[from * 3]; a[to * 3 + 1] = a[from * 3 + 1]; a[to * 3 + 2] = a[from * 3 + 2]; }
    for (const a of [this.life, this.age, this.size0, this.size1, this.a0, this.rot, this.spin, this.drag, this.buoy, this.tile, this.heat, this.stretch, this.fadeIn, this.grav]) a[to] = a[from];
  }
}

export class Particles {
  constructor(scene, quality = 1) {
    this.atlas = puffAtlas(128);
    this.lit = new Pool(scene, Math.round(5000 * quality), 'alpha', FRAG_LIT, this.atlas);
    this.add = new Pool(scene, Math.round(3500 * quality), 'add', FRAG_ADD, this.atlas);
    this.wind = new THREE.Vector3(2.5, 0, -1.2);
    this.q = quality;
  }

  setLighting(sunI, amb) {
    this.lit.uniforms.uSunI.value = sunI;
    this.lit.uniforms.uAmb.value.copy(amb);
  }

  // ---- presets
  dust(p, size, n = 6, opts = {}) {
    n = Math.max(1, Math.round(n * this.q));
    const c = opts.color || [0.52, 0.49, 0.45];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * size * (opts.spread ?? 0.6);
      const sp = opts.speed ?? size * 0.25;
      const t = 0.85 + Math.random() * 0.25;
      this.lit.spawn({
        p: [p.x + Math.cos(a) * r, p.y + Math.random() * size * 0.3, p.z + Math.sin(a) * r],
        v: [Math.cos(a) * sp * (0.4 + Math.random()), (opts.up ?? 0.15) * sp * Math.random(), Math.sin(a) * sp * (0.4 + Math.random())],
        life: (opts.life ?? 14) * (0.7 + Math.random() * 0.6), size: size * (0.5 + Math.random() * 0.4), size1: size * (opts.grow ?? 2.4),
        color: [c[0] * t, c[1] * t, c[2] * t], alpha: opts.alpha ?? 0.75, drag: opts.drag ?? 0.35, buoy: opts.buoy ?? 0.25, fadeIn: 0.04,
      });
    }
  }

  // ground-hugging surge ring from a collapse or a stomp
  surge(p, radius, n = 24, opts = {}) {
    n = Math.max(4, Math.round(n * this.q));
    const c = opts.color || [0.55, 0.51, 0.46];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const sp = (opts.speed ?? radius * 0.55) * (0.6 + Math.random() * 0.6);
      const t = 0.85 + Math.random() * 0.25;
      this.lit.spawn({
        p: [p.x + Math.cos(a) * radius * 0.15, p.y + 2 + Math.random() * radius * 0.08, p.z + Math.sin(a) * radius * 0.15],
        v: [Math.cos(a) * sp, Math.random() * 2, Math.sin(a) * sp],
        life: (opts.life ?? 22) * (0.7 + Math.random() * 0.6), size: radius * 0.18, size1: radius * (opts.grow ?? 0.75),
        color: [c[0] * t, c[1] * t, c[2] * t], alpha: opts.alpha ?? 0.8, drag: 0.55, buoy: 0.35, fadeIn: 0.02,
      });
    }
  }

  smoke(p, size, opts = {}) {
    const d = opts.dark ?? 0.12;
    this.lit.spawn({
      p: [p.x + (Math.random() - 0.5) * size, p.y, p.z + (Math.random() - 0.5) * size],
      v: [(Math.random() - 0.5) * 2, (opts.rise ?? 7) * (0.7 + Math.random() * 0.6), (Math.random() - 0.5) * 2],
      life: (opts.life ?? 16) * (0.7 + Math.random() * 0.6), size: size, size1: size * (opts.grow ?? 4.5),
      color: [d, d * 0.97, d * 0.95], alpha: opts.alpha ?? 0.7, drag: 0.25, buoy: opts.buoy ?? 1.2, heat: opts.heat ?? 0, fadeIn: 0.06,
    });
  }

  fire(p, size, opts = {}) {
    const h = opts.hot ?? 1;
    this.add.spawn({
      p: [p.x + (Math.random() - 0.5) * size * 0.6, p.y, p.z + (Math.random() - 0.5) * size * 0.6],
      v: [(Math.random() - 0.5) * 2, (opts.rise ?? 6) * (0.6 + Math.random() * 0.8), (Math.random() - 0.5) * 2],
      life: (opts.life ?? 1.4) * (0.6 + Math.random() * 0.7), size: size * (0.6 + Math.random() * 0.5), size1: size * 0.25,
      color: [4.0 * h, 1.5 * h, 0.35 * h], alpha: 0.9, drag: 0.6, buoy: 3, tile: Math.floor(Math.random() * 4), fadeIn: 0.1,
    });
  }

  fireball(p, size) {
    const n = Math.max(4, Math.round(16 * this.q));
    for (let i = 0; i < n; i++) {
      const d = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize();
      const sp = size * (1.2 + Math.random() * 1.6);
      this.add.spawn({
        p: [p.x, p.y, p.z], v: [d.x * sp, d.y * sp, d.z * sp], life: 0.7 + Math.random() * 0.9,
        size: size * (0.5 + Math.random() * 0.5), size1: size * 1.6, color: [6, 2.4, 0.6], alpha: 1, drag: 2.4, buoy: 4, fadeIn: 0.02,
      });
    }
    this.add.spawn({ p: [p.x, p.y, p.z], life: 0.22, size: size * 4, size1: size * 6, color: [12, 9, 6], alpha: 1, tile: 4, drag: 0, fadeIn: 0.01 });
    for (let i = 0; i < Math.max(3, Math.round(9 * this.q)); i++) this.smoke(new THREE.Vector3(p.x, p.y + size * 0.5, p.z), size * 0.9, { dark: 0.07, rise: 5, life: 12, heat: 0.6 });
    this.sparks(p, Math.round(18 * this.q), size * 3);
  }

  sparks(p, n, speed, color = [6, 3, 1]) {
    for (let i = 0; i < n; i++) {
      const d = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.1, Math.random() - 0.5).normalize();
      const s = speed * (0.4 + Math.random());
      this.add.spawn({
        p: [p.x, p.y, p.z], v: [d.x * s, d.y * s, d.z * s], life: 0.8 + Math.random() * 1.6, size: 0.6 + Math.random() * 0.6, size1: 0.3,
        color, alpha: 1, drag: 0.4, grav: 9.81, tile: 4, stretch: 1, fadeIn: 0.01,
      });
    }
  }

  glints(p, n, spread) {
    // falling glass: tiny bright flecks catching the light
    for (let i = 0; i < n; i++) {
      this.add.spawn({
        p: [p.x + (Math.random() - 0.5) * spread, p.y + (Math.random() - 0.5) * spread, p.z + (Math.random() - 0.5) * spread],
        v: [(Math.random() - 0.5) * 8, Math.random() * 4, (Math.random() - 0.5) * 8], life: 2 + Math.random() * 2,
        size: 0.35, size1: 0.3, color: [2.2, 2.4, 2.6], alpha: 0.9, drag: 0.3, grav: 9.81, tile: 4, fadeIn: 0.01,
      });
    }
  }

  splash(p, size, n = 14) {
    n = Math.max(3, Math.round(n * this.q));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * size * 0.4;
      this.lit.spawn({
        p: [p.x + Math.cos(a) * r, p.y, p.z + Math.sin(a) * r],
        v: [Math.cos(a) * size * 0.3, size * (0.5 + Math.random() * 0.8), Math.sin(a) * size * 0.3],
        life: 1.6 + Math.random() * 1.4, size: size * 0.3, size1: size * 0.9, color: [0.55, 0.6, 0.62], alpha: 0.45, drag: 0.8, grav: 9.81, fadeIn: 0.02,
      });
    }
  }

  update(dt) {
    this.lit.update(dt, this.wind);
    this.add.update(dt, this.wind);
  }
}
