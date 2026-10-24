// Mutation strains on a kaiju model. Three layers, all switchable at runtime without recompiling:
//  1. a shader layer on every material: the hide recoloured in noise patches, a network of glowing
//     seams, edge light, and the baked glow recoloured to the strain's colour;
//  2. growths (crystals, ice, bone spikes, sacs, shards) that erupt from the body. They are skinned
//     to the body's own skeleton, so they ride every animation;
//  3. an aura of particles shed from the body capsules.
// The Mutation Surge drives the same uniforms harder (surge 0..1).
import * as THREE from 'three';
import { FORMS } from '../core/Config.js';
import { patch, NOISE_GLSL } from '../render/Shading.js';
import { Rng } from '../core/Rng.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _p = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

const PARS_V = /* glsl */`
varying vec3 vMutP;
`;
const PARS_F = /* glsl */`
varying vec3 vMutP;
uniform vec3 uMutTintA, uMutTintB, uMutGlow, uMutVeinCol, uMutRimCol, uMutSurf;
uniform float uMutMix, uMutAmt, uMutDetail, uMutRecolor, uMutVein, uMutVeinScale, uMutWarp, uMutRim, uMutK, uMutSurge;
${NOISE_GLSL}
// distance to the nearest and second-nearest feature point: their difference is small along cell walls
vec2 kjVor(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = vec3(kjH13(i + g), kjH13(i + g + 17.1), kjH13(i + g + 31.7)) * 0.85 + 0.075;
    vec3 r = g + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return vec2(sqrt(d1), sqrt(d2));
}
`;
// hide recolour and seams, after the albedo map and vertex colours are applied
const COLOR_F = /* glsl */`
vec3 kjMq = vMutP * uMutVeinScale;
float kjMv = 0.0, kjMe = 0.0;
if ((uMutVein + uMutSurge) * uMutAmt > 0.001) {
  // a network along the cell walls: a light warp gives cracks, a heavy one branching veins.
  // A patch noise breaks it into runs so it never covers the whole hide.
  vec3 wq = kjMq + (vec3(kjN3(kjMq * 1.3), kjN3(kjMq * 1.3 + 5.2), kjN3(kjMq * 1.3 + 9.4)) - 0.5) * uMutWarp;
  vec2 vr = kjVor(wq);
  float e = vr.y - vr.x;
  float run = smoothstep(0.4, 0.58, kjF3(kjMq * 0.42 + 3.3));
  float hot = 0.45 + 0.9 * kjN3(kjMq * 0.8 + 21.0);
  kjMv = exp(-e * e * 1400.0) * run * hot;    // the bright core of a seam
  kjMe = exp(-e * e * 110.0) * run;           // its scorched margin
}
if (uMutMix * uMutAmt > 0.001) {
  float pt = smoothstep(0.3, 0.7, kjF3(vMutP * 0.085 + 1.7));
  float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  vec3 tint = mix(uMutTintA, uMutTintB, pt) * mix(1.0, clamp(l * 3.2, 0.25, 1.6), uMutDetail);
  tint *= 1.0 - 0.6 * kjMe * min(1.0, uMutVein); // seams are scorched where they do not glow
  diffuseColor.rgb = mix(diffuseColor.rgb, tint, uMutMix * uMutAmt);
}
`;
const SURF_F = /* glsl */`
roughnessFactor = mix(roughnessFactor, uMutSurf.x, uMutSurf.z * uMutAmt);
metalnessFactor = mix(metalnessFactor, uMutSurf.y, uMutSurf.z * uMutAmt);
`;
const EMIT_F = /* glsl */`
{
  float em = max(max(totalEmissiveRadiance.r, totalEmissiveRadiance.g), totalEmissiveRadiance.b);
  totalEmissiveRadiance = mix(totalEmissiveRadiance, uMutGlow * em, uMutRecolor);
  float fl = 0.7 + 0.3 * sin(uTime * 2.2 + kjMq.y * 3.0 + kjMq.x * 2.0);
  totalEmissiveRadiance += uMutVeinCol * (kjMv * 1.6 + kjMe * 0.12) * (uMutVein + uMutSurge * 1.4) * uMutAmt * fl * uMutK;
  float fr = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
  totalEmissiveRadiance += uMutRimCol * fr * (uMutRim + uMutSurge * 0.55) * uMutK * step(0.001, uMutAmt);
}
`;
// growths: the emissive is masked per vertex (crystals glow from the root, sacs from the dome)
const GROW_V = /* glsl */`attribute float aEmit;\nvarying float vGEmit;\n`;
const GROW_F = /* glsl */`varying float vGEmit;\n`;

// How strongly each material takes the strain: the hide fully, horn and keratin partly, eyes not at all.
function amountFor(m) {
  if (/eye|lum/.test(m.name)) return 0;
  if (/skin/.test(m.name)) return 1;
  if (/plate|shard|glow|vein/.test(m.name)) return 0.7;
  return 0.5;
}

const geoCache = new Map();

export class MutationRig {
  // model: the cloned scene of one kaiju; meta: its asset metadata; key: the asset name;
  // baseGlow: the kaiju's own glow colour (used by Prime and by its surge)
  constructor(model, meta, key, baseGlow) {
    this.model = model;
    this.meta = meta;
    this.key = key;
    this.baseGlow = baseGlow;
    this.form = null;
    this.growth = null;
    this.t = 0;
    const c3 = () => ({ value: new THREE.Color() });
    this.U = {
      uMutTintA: c3(), uMutTintB: c3(), uMutGlow: c3(), uMutVeinCol: c3(), uMutRimCol: c3(),
      uMutSurf: { value: new THREE.Vector3() },
      uMutMix: { value: 0 }, uMutDetail: { value: 0.6 }, uMutRecolor: { value: 0 }, uMutVein: { value: 0 },
      uMutVeinScale: { value: 0.2 }, uMutWarp: { value: 0.35 }, uMutRim: { value: 0 }, uMutK: { value: 1 }, uMutSurge: { value: 0 },
    };
    this.body = null;
    model.traverse((o) => {
      if (o.isSkinnedMesh && (!this.body || o.geometry.attributes.position.count > this.body.geometry.attributes.position.count)) this.body = o;
    });
    this.bones = {};
    model.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });
    this.caps = (meta.body || []).filter(([a, b]) => this.bones[a] && this.bones[b]);
  }

  // Shader hook for one of the model's materials (pass to patchTree).
  hookFor(mat) {
    const U = this.U, amt = amountFor(mat);
    return (sh) => {
      for (const [k, u] of Object.entries(U)) sh.uniforms[k] = u;
      sh.uniforms.uMutAmt = { value: amt };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + PARS_V)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMutP = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + PARS_F)
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + COLOR_F)
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + SURF_F)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + EMIT_F);
    };
  }

  get glow() { return this.form && this.form.glow ? this.form.glow : this.baseGlow; }
  glowOf(id) { return FORMS[id] && FORMS[id].glow ? FORMS[id].glow : this.baseGlow; }

  setForm(id) {
    const F = FORMS[id] || FORMS.prime;
    if (this.form === F) return;
    this.form = F;
    this.formId = FORMS[id] ? id : 'prime';
    const U = this.U, prime = !F.tint;
    const g = this.glow;
    if (!prime) {
      U.uMutTintA.value.setRGB(...F.tint[0]);
      U.uMutTintB.value.setRGB(...F.tint[1]);
    }
    U.uMutMix.value = prime ? 0 : F.mix;
    U.uMutDetail.value = F.detail ?? 0.6;
    U.uMutGlow.value.setRGB(...g);
    U.uMutRecolor.value = prime ? 0 : 1;
    U.uMutVeinCol.value.setRGB(...(F.vein || g));
    U.uMutVein.value = F.veinAmt || 0;
    U.uMutVeinScale.value = F.veinScale || 0.2;
    U.uMutWarp.value = F.veinWarp ?? 0.35;
    U.uMutRimCol.value.setRGB(...(F.rim || g));
    U.uMutRim.value = F.rimAmt || 0;
    if (F.surf) U.uMutSurf.value.set(...F.surf); else U.uMutSurf.value.set(0, 0, 0);
    // growths
    if (this.growth) {
      this.growth.parent.remove(this.growth);
      this.growth.material.dispose();
      this.growth = null;
    }
    if (F.growth && this.body) this.growth = this._growth(F.growth);
  }

  // ------------------------------------------------------------------ growths

  _growth(G) {
    const ck = this.key + ':' + this.formId;
    let geo = geoCache.get(ck);
    if (!geo) { geo = buildGrowth(this.body, G, this.formId); geoCache.set(ck, geo); }
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(...G.color), roughness: G.rough, metalness: G.metal,
      emissive: new THREE.Color(...G.emit), emissiveIntensity: 1,
    });
    mat.name = 'growth';
    mat.userData.baseEmit = G.emit.some((x) => x > 0) ? G.glow ?? 0.5 : 0;
    patch(mat, 'growth-' + G.kind, (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + GROW_V)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGEmit = aEmit;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + GROW_F)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vGEmit;');
    });
    const m = new THREE.SkinnedMesh(geo, mat);
    m.name = 'MutationGrowth';
    const b = this.body;
    m.position.copy(b.position); m.quaternion.copy(b.quaternion); m.scale.copy(b.scale);
    b.parent.add(m);
    m.updateMatrixWorld(true);
    m.bind(b.skeleton, b.bindMatrix);
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    return m;
  }

  // ------------------------------------------------------------------ per frame

  // ex: current exposure; surge: 0..1
  update(dt, ex, surge = 0) {
    this.t += dt;
    const U = this.U;
    U.uMutSurge.value = surge;
    // seams and edges hold a steady on-screen brightness at any time of day, like the baked veins
    U.uMutK.value = Math.max(1, 0.6 / Math.max(0.05, ex)) * (1 + 0.8 * surge);
    if (this.growth) {
      const pulse = 0.85 + 0.15 * Math.sin(this.t * 2.1) * Math.sin(this.t * 0.53 + 0.7);
      this.growth.material.emissiveIntensity = this.growth.material.userData.baseEmit * U.uMutK.value * pulse * (1 + surge);
    }
  }

  // A random point on the body surface, in world space (for the aura).
  samplePoint(out, scale) {
    if (!this.caps.length) return out.setFromMatrixPosition(this.model.matrixWorld);
    const [a, b, r] = this.caps[Math.floor(Math.random() * this.caps.length)];
    this.bones[a].getWorldPosition(out);
    this.bones[b].getWorldPosition(_v2);
    out.lerp(_v2, Math.random());
    _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    return out.addScaledVector(_v, r * scale * (0.7 + Math.random() * 0.4));
  }

  // Shed this strain's aura into a particle system. rate: particles per second at surge 0.
  emitAura(ps, dt, scale, surge = 0, rate = 26) {
    const F = this.form;
    const kind = F && F.aura ? F.aura : surge > 0.01 ? 'surge' : null;
    if (!kind) return;
    const n = rate * dt * (1 + 4 * surge) * ps.q;
    let count = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
    const g = this.glow, s = scale;
    const p = _p;
    while (count-- > 0) {
      this.samplePoint(p, scale);
      const q = [p.x, p.y, p.z];
      const r = () => Math.random() - 0.5;
      if (kind === 'embers') {
        ps.add.spawn({ p: q, v: [r() * 3, 4 + Math.random() * 7, r() * 3], life: 1.2 + Math.random() * 1.8, size: (0.35 + Math.random() * 0.5) * s, size1: 0.1 * s,
          color: [5, 1.5, 0.25], alpha: 1, drag: 0.7, buoy: 2.5, tile: 4, stretch: 0.4, fadeIn: 0.05 });
        if (Math.random() < 0.15) ps.smoke(p, 3 * s, { dark: 0.05, rise: 6, life: 6, heat: 0.5, grow: 3, alpha: 0.35 });
      } else if (kind === 'frost') {
        if (Math.random() < 0.5) ps.lit.spawn({ p: q, v: [r() * 2, -0.6 - Math.random(), r() * 2], life: 2.5 + Math.random() * 2, size: 2 * s, size1: 6 * s,
          color: [0.82, 0.9, 0.97], alpha: 0.3, drag: 1.2, buoy: -0.2, fadeIn: 0.15 });
        else ps.add.spawn({ p: q, v: [r() * 2, r() * 2, r() * 2], life: 0.8 + Math.random(), size: 0.3 * s, size1: 0.05, color: [2.5, 3.2, 4], alpha: 1, drag: 1, tile: 4, fadeIn: 0.1 });
      } else if (kind === 'drip') {
        ps.add.spawn({ p: q, v: [r() * 0.6, -1, r() * 0.6], life: 1.4 + Math.random(), size: 0.35 * s, size1: 0.25 * s, color: [1.2, 3.6, 0.35], alpha: 1, drag: 0.1, grav: 9.81, tile: 4, stretch: 1.5, fadeIn: 0.05 });
        if (Math.random() < 0.12) ps.lit.spawn({ p: q, v: [r(), 0.8, r()], life: 3, size: 2 * s, size1: 7 * s, color: [0.35, 0.5, 0.15], alpha: 0.25, drag: 1, buoy: 0.4, fadeIn: 0.1 });
      } else if (kind === 'wisps') {
        ps.add.spawn({ p: q, v: [r() * 2, 1 + Math.random() * 2, r() * 2], life: 1.6 + Math.random() * 1.6, size: (1 + Math.random() * 1.5) * s, size1: 0.2 * s,
          color: [g[0] * 1.6, g[1] * 1.6, g[2] * 1.6], alpha: 0.7, drag: 1.4, buoy: 0.4, tile: 4, fadeIn: 0.2 });
      } else if (kind === 'motes') {
        if (Math.random() < 0.5) ps.add.spawn({ p: q, v: [r() * 1.5, 1.5 + Math.random() * 2, r() * 1.5], life: 2 + Math.random() * 2, size: 0.25 * s, size1: 0.08 * s, color: [4, 2.8, 1], alpha: 1, drag: 0.8, buoy: 0.6, tile: 4, fadeIn: 0.1 });
        else ps.lit.spawn({ p: q, v: [r(), -2, r()], life: 3, size: 1.5 * s, size1: 5 * s, color: [0.45, 0.4, 0.34], alpha: 0.25, drag: 0.8, fadeIn: 0.1 });
      }
      // a surge adds crackling sparks in the strain's glow colour, whatever the strain
      if (surge > 0.01 && Math.random() < 0.5 * surge) {
        ps.add.spawn({ p: q, v: [r() * 10, 3 + Math.random() * 10, r() * 10], life: 0.5 + Math.random() * 0.6, size: 0.45 * s, size1: 0.1 * s,
          color: [g[0] * 6, g[1] * 6, g[2] * 6], alpha: 1, drag: 1.5, tile: 4, stretch: 1, fadeIn: 0.02 });
      }
    }
  }

  dispose() {
    if (this.growth) { this.growth.parent && this.growth.parent.remove(this.growth); this.growth.material.dispose(); this.growth = null; }
  }
}

// ------------------------------------------------------------------ growth geometry

// Bones growths never sprout from: anything that opens, grips, flaps or is already a blade.
const SKIP = /jaw|mouth|finger|toe|eye|tongue|mandible|ant\d|foot|hand|paw|claw|crest|wing|fork|spade/;

function buildGrowth(body, G, seed) {
  const geo = body.geometry;
  const P = geo.attributes.position, N = geo.attributes.normal;
  const SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
  const bones = body.skeleton.bones;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const H = bb.max.y - bb.min.y, W = bb.max.x - bb.min.x;
  let h = 7;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rng = new Rng(h);
  // candidate sites, weighted by where this growth belongs
  const cand = [];
  const n = new THREE.Vector3(), p = new THREE.Vector3();
  const step = Math.max(1, Math.floor(P.count / 14000));
  for (let i = 0; i < P.count; i += step) {
    let bi = 0, bw = -1;
    for (let j = 0; j < 4; j++) { const w = SW.getComponent(i, j); if (w > bw) { bw = w; bi = SI.getComponent(i, j); } }
    if (SKIP.test(bones[bi].name)) continue;
    p.fromBufferAttribute(P, i);
    n.fromBufferAttribute(N, i);
    const hy = (p.y - bb.min.y) / H;
    if (hy < 0.18) continue;
    let w;
    if (G.where === 'dorsal') {
      w = Math.max(0, n.y + Math.max(0, -n.z) * 0.6 - 0.15);
      w *= 0.3 + 0.7 * Math.exp(-((p.x / (0.14 * W)) ** 2)); // crowd the spine line
    } else {
      w = Math.max(0, 1 - Math.abs(n.y) * 0.7) * 0.7 + Math.max(0, n.y) * 0.3;
    }
    if (w <= 0.02) continue;
    cand.push({ i, key: Math.pow(rng.next(), 1 / w) });
  }
  cand.sort((a, b) => b.key - a.key);
  const sites = [];
  const minD = H * (G.kind === 'pustule' ? 0.045 : 0.065);
  for (const c of cand) {
    if (sites.length >= G.n) break;
    p.fromBufferAttribute(P, c.i);
    if (sites.some((s) => s.p.distanceTo(p) < minD)) continue;
    sites.push({ i: c.i, p: p.clone(), n: n.fromBufferAttribute(N, c.i).clone() });
  }
  // shapes
  const pos = [], nrm = [], emit = [], si = [], sw = [];
  const back = new THREE.Vector3(0, 0, -1);
  for (const s of sites) {
    const start = pos.length;
    const L = H * rng.range(G.len[0], G.len[1]) * (0.6 + 0.4 * Math.exp(-((s.p.x / (0.2 * W)) ** 2)));
    const base = s.p.clone().addScaledVector(s.n, -L * 0.1);
    if (G.kind === 'crystal' || G.kind === 'ice' || G.kind === 'shard') {
      const count = G.kind === 'ice' ? rng.int(2, 4) : G.kind === 'shard' ? rng.int(1, 2) : rng.int(1, 3);
      for (let c = 0; c < count; c++) {
        const ax = s.n.clone().addScaledVector(UP, 0.35).addScaledVector(back, 0.25)
          .add(new THREE.Vector3(rng.range(-0.5, 0.5), rng.range(-0.2, 0.4), rng.range(-0.5, 0.5)).multiplyScalar(c ? 0.9 : 0.35)).normalize();
        const len = L * (c ? rng.range(0.45, 0.8) : 1);
        const rad = len * (G.kind === 'ice' ? rng.range(0.09, 0.14) : G.kind === 'shard' ? 0.13 : rng.range(0.14, 0.2));
        const sides = G.kind === 'shard' ? 4 : 6;
        const flat = G.kind === 'shard' ? 0.3 : 1;
        crystal(pos, nrm, emit, base, ax, len, rad, sides, flat, rng.range(0, Math.PI), G.kind === 'ice' ? 0.3 : 0.04);
      }
    } else if (G.kind === 'spike') {
      const ax = s.n.clone().addScaledVector(UP, 0.4).normalize();
      spike(pos, nrm, emit, base, ax, back, L, L * 0.17, 0.35);
    } else if (G.kind === 'pustule') {
      const count = rng.int(1, 3);
      for (let c = 0; c < count; c++) {
        const off = new THREE.Vector3(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).multiplyScalar(c ? L * 0.9 : 0);
        const r = L * (c ? rng.range(0.45, 0.75) : 1);
        sac(pos, nrm, emit, base.clone().add(off), s.n, r);
      }
    }
    // every vertex of the growth follows its root vertex's skin binding
    const vc = (pos.length - start) / 3;
    for (let k = 0; k < vc; k++) {
      for (let j = 0; j < 4; j++) { si.push(SI.getComponent(s.i, j)); sw.push(SW.getComponent(s.i, j)); }
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  out.setAttribute('aEmit', new THREE.Float32BufferAttribute(emit, 1));
  out.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  out.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  out.computeBoundingSphere();
  return out;
}

function frame(ax, roll) {
  const x = Math.abs(ax.y) < 0.95 ? new THREE.Vector3().crossVectors(ax, UP).normalize() : new THREE.Vector3(1, 0, 0);
  const z = new THREE.Vector3().crossVectors(x, ax).normalize();
  const c = Math.cos(roll), s = Math.sin(roll);
  return [x.clone().multiplyScalar(c).addScaledVector(z, s), ax, z.multiplyScalar(c).addScaledVector(x, -s)];
}

function tri(pos, nrm, emit, a, b, c, ea, eb, ec) {
  const fn = _v.subVectors(b, a).cross(_v2.subVectors(c, a)).normalize();
  for (const v of [a, b, c]) { pos.push(v.x, v.y, v.z); nrm.push(fn.x, fn.y, fn.z); }
  emit.push(ea, eb, ec);
}

// A faceted crystal: a prism that narrows slightly, capped by a pyramid. Glows from the root.
function crystal(pos, nrm, emit, base, ax, len, rad, sides, flat, roll, glowTip) {
  const [X, , Z] = frame(ax, roll);
  const ring = (t, r) => Array.from({ length: sides }, (_, i) => {
    const a = (i / sides) * Math.PI * 2;
    return base.clone().addScaledVector(ax, t * len).addScaledVector(X, Math.cos(a) * r).addScaledVector(Z, Math.sin(a) * r * flat);
  });
  const r0 = ring(0, rad), r1 = ring(0.72, rad * 0.82);
  const tip = base.clone().addScaledVector(ax, len);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    tri(pos, nrm, emit, r0[i], r1[i], r1[j], 1, 0.12, 0.12);
    tri(pos, nrm, emit, r0[i], r1[j], r0[j], 1, 0.12, 1);
    tri(pos, nrm, emit, r1[i], tip, r1[j], 0.12, glowTip, 0.12);
  }
}

// A curved bone spike, smooth shaded, sweeping back.
function spike(pos, nrm, emit, base, ax, back, len, rad, bend) {
  const sides = 8, rings = 5;
  const [X, , Z] = frame(ax, 0);
  const pts = [], nn = [];
  for (let k = 0; k <= rings; k++) {
    const t = k / rings;
    const c = base.clone().addScaledVector(ax, t * len).addScaledVector(back, bend * len * t * t);
    const r = rad * (1 - t) ** 1.2;
    const row = [], nrow = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const d = X.clone().multiplyScalar(Math.cos(a)).addScaledVector(Z, Math.sin(a));
      row.push(c.clone().addScaledVector(d, r));
      nrow.push(d.clone().addScaledVector(ax, 0.25).normalize());
    }
    pts.push(row); nn.push(nrow);
  }
  for (let k = 0; k < rings; k++) for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    for (const [rk, ri] of [[k, i], [k + 1, i], [k + 1, j], [k, i], [k + 1, j], [k, j]]) {
      const v = pts[rk][ri], q = nn[rk][ri];
      pos.push(v.x, v.y, v.z); nrm.push(q.x, q.y, q.z); emit.push(0);
    }
  }
}

// A glowing sac, half sunk into the hide; the dome glows, the rim does not.
function sac(pos, nrm, emit, base, n, r) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const P = g.attributes.position;
  const [X, Y, Z] = frame(n, 0);
  for (let i = 0; i < P.count; i++) {
    _v.fromBufferAttribute(P, i);
    const local = _v.clone();
    const w = base.clone().addScaledVector(X, local.x * r).addScaledVector(Y, (local.y * 0.75 + 0.15) * r).addScaledVector(Z, local.z * r);
    const nm = X.clone().multiplyScalar(local.x).addScaledVector(Y, local.y).addScaledVector(Z, local.z).normalize();
    pos.push(w.x, w.y, w.z); nrm.push(nm.x, nm.y, nm.z); emit.push(0.1 + 0.9 * Math.pow(Math.max(0, local.y), 2));
  }
  g.dispose();
}
