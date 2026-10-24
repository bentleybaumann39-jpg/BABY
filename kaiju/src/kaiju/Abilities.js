// Signature abilities: breath beam, hurled boulder, charge, spray, spat globs, lobbed bile bombs,
// the EMP pulse and the leaping slam. Each owns its visuals and applies damage through the play session.
import * as THREE from 'three';
import { G as SG } from '../render/Shading.js';
import { clamp, damp } from '../core/Rng.js';
import { DECAL } from '../render/Decals.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

const BEAM_VERT = /* glsl */`
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`;
const BEAM_FRAG = /* glsl */`
uniform float uTime, uI, uLen; uniform vec3 uCol;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float facing = abs(dot(vN, vV));
  float core = pow(facing, 3.0);
  float along = vUv.y * uLen;
  float flow = n2(vec2(vUv.x * 8.0, along * 0.06 - uTime * 14.0)) * 0.6 + n2(vec2(vUv.x * 21.0, along * 0.17 - uTime * 31.0)) * 0.4;
  float a = (core * 1.4 + facing * 0.35 * flow) * uI;
  a *= smoothstep(0.0, 0.02, vUv.y) * smoothstep(1.0, 0.97, vUv.y);
  vec3 c = mix(uCol, vec3(1.0), core * 0.7) * a * 9.0;
  gl_FragColor = vec4(min(c, vec3(2.0e4)), 0.0);
}`;

export class Abilities {
  constructor(play) {
    this.play = play;
    this.scene = play.scene;
    // thermal beam: inner core + outer sheath, a light at each end
    const geo = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true);
    geo.translate(0, 0.5, 0);
    geo.rotateX(Math.PI / 2); // along +z
    this.beamU = { uTime: SG.uTime, uI: { value: 0 }, uLen: { value: 100 }, uCol: { value: new THREE.Color(0.4, 0.8, 1.0) } };
    const bm = new THREE.ShaderMaterial({ uniforms: this.beamU, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.beam = new THREE.Mesh(geo, bm);
    this.beam.frustumCulled = false;
    this.beam.visible = false;
    this.beam.renderOrder = 4;
    this.scene.add(this.beam);
    this.sheath = new THREE.Mesh(geo, bm.clone());
    this.sheath.material.uniforms = { ...this.beamU, uI: { value: 0 } };
    this.sheath.frustumCulled = false; this.sheath.visible = false; this.sheath.renderOrder = 4;
    this.scene.add(this.sheath);
    this.hitLight = new THREE.PointLight(0x88ccff, 0, 380, 2);
    this.mouthLight = new THREE.PointLight(0x88ccff, 0, 220, 2);
    this.scene.add(this.hitLight, this.mouthLight);
    this.beamT = 0;
    this.beamEnd = new THREE.Vector3();
    // boulder for throws
    const rock = new THREE.IcosahedronGeometry(1, 2);
    const p = rock.attributes.position;
    for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); _v.multiplyScalar(0.8 + 0.35 * Math.abs(Math.sin(_v.x * 3.1) * Math.cos(_v.y * 2.7 + _v.z))); p.setXYZ(i, _v.x, _v.y, _v.z); }
    rock.computeVertexNormals();
    this.rockMat = new THREE.MeshStandardMaterial({ color: 0x5a5550, roughness: 0.95, emissive: new THREE.Color(1, 0.35, 0.05), emissiveIntensity: 0 });
    play.shade(this.rockMat, 'boulder');
    this.boulder = new THREE.Mesh(rock, this.rockMat);
    this.boulder.castShadow = true;
    this.boulder.visible = false;
    this.scene.add(this.boulder);
    this.projectiles = [];
    this.owner = null; // the kaiju these powers belong to (the play session sets it)
    this.sprayT = 0;
    this.leap = null;
    this.orbGeo = new THREE.IcosahedronGeometry(1, 2);
    this.orbMats = new Map();
    // EMP shock ring
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 96, 1), this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.ring.renderOrder = 5;
    this.scene.add(this.ring);
    this.ringT = -1;
  }

  // The signature power's colour (a mutation strain changes it).
  tint(c) {
    this.beamU.uCol.value.setRGB(c[0], c[1], c[2]);
    this.hitLight.color.setRGB(0.5 + c[0] * 0.5, 0.5 + c[1] * 0.5, 0.5 + c[2] * 0.5);
    this.mouthLight.color.copy(this.hitLight.color);
  }

  // An expanding ring of light on the ground with a flash (surge, echo roar, vented blood).
  shock(p, R, c) {
    this.ringMat.color.setRGB(c[0] * 5, c[1] * 5, c[2] * 5);
    this.ring.position.set(p.x, p.y + 3, p.z);
    this.ringT = 0;
    this.ringR = R;
    this.mouthLight.color.setRGB(c[0], c[1], c[2]);
    this.mouthLight.position.set(p.x, p.y + 40, p.z);
    this.mouthLight.intensity = 30000;
  }

  // ------------------------------------------------------------------ beam

  beamUpdate(dt, k, on, aim) {
    const P = this.play;
    this.beamT = on ? Math.min(1, this.beamT + dt * 4) : Math.max(0, this.beamT - dt * 3);
    const I = this.beamT;
    this.beam.visible = this.sheath.visible = I > 0.01;
    this.mouthLight.intensity = I * 2500;
    this.hitLight.intensity = I * 7000;
    if (I <= 0.01) { P.fx.haze = damp(P.fx.haze, 0, 4, dt); return; }
    const mouth = k.bonePos(k.meta.mouth || 'mouth', _v);
    // direction: toward the aim point, limited to the cone in front of the head
    const dir = _v2.copy(aim).sub(mouth).normalize();
    const fwd = k.forward.clone();
    const ang = dir.angleTo(fwd);
    if (ang > 0.9) dir.lerp(fwd, 1 - 0.9 / ang).normalize();
    const range = k.def.moves.special.range * k.scale;
    // march until the beam meets something solid
    let len = range;
    const step = 6;
    // a rival in the way stops the beam on its hide
    const foe = P.foeOf(k);
    const caps = foe && !foe.dead ? foe.bodyCapsules() : null;
    let onFoe = false;
    for (let s = 6; s < range; s += step) {
      const x = mouth.x + dir.x * s, y = mouth.y + dir.y * s, z = mouth.z + dir.z * s;
      if (y <= P.world.solidHeightAt(x, z)) { len = s; break; }
      if (caps && s % 12 === 0 && foe.surfaceDist(_q2.set(x, y, z), caps) < 2) { len = s; onFoe = true; break; }
    }
    const end = this.beamEnd.copy(mouth).addScaledVector(dir, len);
    const R = k.def.moves.special.radius * k.scale;
    this.beam.position.copy(mouth);
    this.beam.lookAt(end);
    this.beam.scale.set(R * 0.28 * I, R * 0.28 * I, len);
    this.sheath.position.copy(mouth);
    this.sheath.quaternion.copy(this.beam.quaternion);
    this.sheath.scale.set(R * 0.75 * I, R * 0.75 * I, len);
    this.beamU.uI.value = I;
    this.beamU.uLen.value = len;
    this.sheath.material.uniforms.uI.value = I * 0.35;
    this.mouthLight.position.copy(mouth);
    this.hitLight.position.copy(end).addScaledVector(dir, -8);
    if (!on) return;
    // damage along the last stretch of the beam, fire and blast at the end
    const dps = k.stats.special * (I * I);
    P.damageVolume(end, R * 1.6, dps * dt * 2.2, dir.clone().multiplyScalar(20), 'beam');
    P.world.buildings.ignite(end, R * 2.2, dt * 1.2);
    P.hitUnitsSphere(end, R * 3, dps * dt * 0.8, 'beam', null, k);
    for (let s = 0; s < len; s += 40) P.hitUnitsSphere(_v.copy(mouth).addScaledVector(dir, s), R, dps * dt * 0.5, 'beam', null, k);
    if (onFoe) P.hitKaiju(k, foe, dps * dt * 0.6, end, { tick: true });
    const ps = P.particles;
    if (Math.random() < dt * 30) ps.fireball(end, R * 0.9);
    if (Math.random() < dt * 20) ps.smoke(end, R * 1.2, { dark: 0.1, rise: 10, heat: 0.8, life: 14 });
    ps.sparks(end, Math.ceil(dt * 120), 40, [3, 6, 9]);
    if (end.y < 2 && Math.random() < dt * 6) P.decals.add(1, end.x, Math.max(0, P.world.groundAt(end.x, end.z)), end.z, R * 3.5);
    P.rig.impulse(end, 0.08 * dt * 60, 500);
    P.fx.haze = damp(P.fx.haze, 0.8, 4, dt);
    P.fx.hazeAt = end;
    k.energy -= k.def.moves.special.cost * k.stats.specialCost * dt;
  }

  // ------------------------------------------------------------------ hurled boulder

  holdBoulder(k, t) {
    this.boulder.visible = true;
    const s = 9 * k.scale;
    this.boulder.scale.setScalar(s * Math.min(1, t * 3));
    k.bonePos('handR', this.boulder.position);
    this.rockMat.emissiveIntensity = 0.4 + t;
  }

  throwBoulder(k, aim) {
    const start = k.bonePos('handR', new THREE.Vector3());
    this.boulder.visible = false;
    const m = new THREE.Mesh(this.boulder.geometry, this.rockMat);
    m.scale.setScalar(9 * k.scale);
    m.castShadow = true;
    m.position.copy(start);
    this.scene.add(m);
    // ballistic solve for a fixed flight time based on distance
    const d = aim.clone().sub(start);
    const flat = Math.hypot(d.x, d.z);
    const T = clamp(flat / 160, 0.6, 3.2);
    const vel = new THREE.Vector3(d.x / T, (d.y + 0.5 * 9.81 * T * T) / T, d.z / T);
    this.projectiles.push({ mesh: m, vel, t: 0, T: T + 0.5, kind: 'boulder', dmg: k.stats.special * 1.6, r: k.def.moves.special.radius * k.scale, spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()) });
    this.play.audio && this.play.audio.whoosh(start, 1);
  }

  // ------------------------------------------------------------------ acid torrent

  spray(dt, k, aim) {
    const P = this.play;
    const mouth = k.bonePos(k.meta.mouth || 'head', _v);
    const dir = _v2.copy(aim).sub(mouth).normalize();
    const fwd = k.forward;
    if (dir.angleTo(fwd) > 0.8) dir.lerp(fwd, 0.5).normalize();
    const range = k.def.moves.special.range * k.scale;
    const ps = P.particles;
    const n = Math.ceil(dt * 90 * ps.q);
    for (let i = 0; i < n; i++) {
      const sp = 70 + Math.random() * 40;
      const jitter = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.25);
      const d = dir.clone().add(jitter).normalize();
      const c = k.def.moves.special.color;
      ps.add.spawn({ p: [mouth.x, mouth.y, mouth.z], v: [d.x * sp, d.y * sp, d.z * sp], life: 1.6, size: 4, size1: 11, color: [c[0] * 2.2, c[1] * 2.2, c[2] * 2.2], alpha: 0.75, drag: 0.4, grav: 9.81, tile: 4, fadeIn: 0.02 });
      if (i % 3 === 0) ps.lit.spawn({ p: [mouth.x, mouth.y, mouth.z], v: [d.x * sp * 0.7, d.y * sp * 0.7, d.z * sp * 0.7], life: 3, size: 6, size1: 26, color: [0.3 + c[0] * 0.25, 0.3 + c[1] * 0.25, 0.25 + c[2] * 0.2], alpha: 0.5, drag: 1.2, buoy: 0.5, fadeIn: 0.02 });
    }
    // damage in a cone: sample points along the aim
    for (let s = 20; s < range; s += 24) {
      const p = _v.copy(mouth).addScaledVector(dir, s);
      p.y -= s * s * 0.0006;
      const g = P.world.solidHeightAt(p.x, p.z);
      if (p.y < g) p.y = g + 2;
      const R = 8 + s * 0.12;
      P.damageVolume(p, R * k.scale, k.stats.special * dt, null, 'acid');
      P.hitUnitsSphere(p, R * k.scale * 1.3, k.stats.special * dt * 0.8, 'acid', null, k);
      P.hitKaijuSphere(k, p, R * k.scale, k.stats.special * dt * 0.7, { tick: true });
      P.world.buildings.forChunksInSphere(p, R * k.scale, (id) => {
        const B = P.world.buildings;
        B.dmgv[id] = Math.min(1, B.dmgv[id] + dt * 0.6);
        B.dust[id] = Math.min(1, B.dust[id] + dt * 0.15);
        B._setState(id);
      });
      if (p.y < 3 && Math.random() < dt * 2) P.decals.add(1, p.x, 0, p.z, R * 1.5);
    }
    k.energy -= k.def.moves.special.cost * k.stats.specialCost * dt;
  }

  // ------------------------------------------------------------------ spat globs and lobbed bombs

  _orbMat(c) {
    const key = c.join(',');
    if (!this.orbMats.has(key)) {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0] * 6, c[1] * 6, c[2] * 6) });
      this.play.shade(m, 'orb');
      this.orbMats.set(key, m);
    }
    return this.orbMats.get(key);
  }

  // A glowing glob of acid or bile. flat: fast, low trajectory (spit); otherwise a high mortar arc.
  launchOrb(k, from, aim, flat) {
    const mv = k.def.moves.special;
    const d = aim.clone().sub(from);
    const flatD = Math.hypot(d.x, d.z);
    const T = flat ? clamp(flatD / 320, 0.35, 1.6) : clamp(flatD / 150, 1.3, 3.6);
    const vel = new THREE.Vector3(d.x / T, (d.y + 0.5 * 9.81 * T * T) / T, d.z / T);
    const size = (flat ? 3.2 : 6.0) * k.scale;
    const m = new THREE.Mesh(this.orbGeo, this._orbMat(mv.color));
    m.scale.setScalar(size);
    m.position.copy(from);
    this.scene.add(m);
    this.projectiles.push({ mesh: m, vel, t: 0, T: T + 0.5, kind: 'orb', owner: k, color: mv.color, r: mv.radius * k.scale * (flat ? 0.7 : 1.0),
      dmg: k.stats.special * (flat ? 0.55 : 0.9), spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()) });
    this.play.audio && this.play.audio.whoosh(from, flat ? 0.5 : 0.8);
  }

  splash(p, r, dmg, c, owner = this.owner) {
    const P = this.play;
    P.damageVolume(p, r, dmg, new THREE.Vector3(0, 6, 0), 'acid');
    P.hitUnitsSphere(p, r * 1.4, dmg, 'acid', null, owner);
    P.hitKaijuSphere(owner, p, r * 0.9, dmg, { push: 0.5 });
    P.world.buildings.forChunksInSphere(p, r * 1.4, (id) => {
      const B = P.world.buildings;
      B.dmgv[id] = Math.min(1, B.dmgv[id] + 0.5);
      B._setState(id);
    });
    if (P.traffic && p.y < 20) P.traffic.blast(p, r);
    const ps = P.particles;
    const n = Math.ceil(60 * ps.q);
    for (let i = 0; i < n; i++) {
      const d = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5).normalize();
      const sp = r * (0.6 + Math.random() * 1.2);
      ps.add.spawn({ p: [p.x, p.y, p.z], v: [d.x * sp, d.y * sp, d.z * sp], life: 1.4, size: 3, size1: 9, color: [c[0] * 3, c[1] * 3, c[2] * 3], alpha: 0.8, drag: 0.6, grav: 9.81, tile: 4, fadeIn: 0.02 });
    }
    for (let i = 0; i < 6; i++) ps.smoke(p, r * 0.8, { dark: 0.05, rise: 6, life: 10, heat: 0.2 });
    if (p.y < 6) P.decals.add(DECAL.SCORCH, p.x, Math.max(0, P.world.groundAt(p.x, p.z)), p.z, r * 1.8);
    P.rig.impulse(p, 0.4, r * 12);
    P.app.audio && P.app.audio.impact(p, Math.min(1, r / 40));
  }

  // ------------------------------------------------------------------ EMP pulse

  pulse(k) {
    const P = this.play, mv = k.def.moves.special;
    const p = k.pos.clone();
    p.y = P.world.groundAt(p.x, p.z);
    const R = mv.radius * k.scale;
    P.slam(k, p, R * 0.45, k.stats.special * 1.3);
    P.damageVolume(new THREE.Vector3(p.x, p.y + 60 * k.scale, p.z), R * 0.42, k.stats.special * 0.7, new THREE.Vector3(0, 10, 0), 'pulse');
    P.hitUnitsSphere(p, R * 1.8, k.stats.special * 4, 'pulse', null, k);  // the pulse fries every machine in reach
    P.hitKaijuSphere(k, p, R * 0.9, k.stats.special * 1.2, { push: 2 });
    const c = mv.color;
    P.particles.sparks(new THREE.Vector3(p.x, p.y + 30 * k.scale, p.z), Math.ceil(260 * P.particles.q), R * 0.5, [c[0] * 8, c[1] * 8, c[2] * 8]);
    this.ringMat.color.setRGB(c[0] * 5, c[1] * 5, c[2] * 5);
    this.ring.position.set(p.x, p.y + 3, p.z);
    this.ringT = 0;
    this.ringR = R * 2.2;
    this.mouthLight.color.setRGB(c[0], c[1], c[2]);
    this.mouthLight.position.set(p.x, p.y + 40 * k.scale, p.z);
    this.mouthLight.intensity = 30000;
    P.fx.flash = P.app.settings.reducedMotion ? 0.08 : 0.3;
    P.rig.addTrauma(0.8);
  }

  // ------------------------------------------------------------------ leap slam

  startLeap(k, target) {
    const from = k.pos.clone();
    const d = target.clone().sub(from);
    d.y = 0;
    const maxD = 260 * k.scale * (k.def.moves.stomp.range || 1); // winged kaiju glide further
    if (d.length() > maxD) d.setLength(maxD);
    const to = from.clone().add(d);
    to.y = this.play.world.groundAt(to.x, to.z);
    // leap clips crouch until 0.35 s and touch down at 1.2 s: play them at the rate that lines the
    // airborne part up with the ballistic flight
    const T = 0.8 + d.length() / 700;
    const rate = 0.85 / T;
    this.leap = { from, to, t: 0, delay: 0.35 / rate, T, h: Math.max(40, d.length() * 0.35) * k.scale };
    k.yaw = Math.atan2(d.x, d.z);
    return rate;
  }

  updateLeap(dt, k) {
    const L = this.leap;
    if (!L) return false;
    L.t += dt;
    k.speed = 0;
    if (L.t < L.delay) return true;
    const u = Math.min(1, (L.t - L.delay) / L.T);
    k.pos.lerpVectors(L.from, L.to, u);
    k.pos.y += Math.sin(Math.PI * u) * L.h;
    if (u >= 1) {
      this.leap = null;
      this.play.slam(k, k.pos.clone(), k.def.moves.stomp.radius * k.scale, k.stats.stomp * 1.4);
    }
    return true;
  }

  // ------------------------------------------------------------------ per frame

  update(dt) {
    const P = this.play;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.t += dt;
      pr.vel.y -= 9.81 * dt;
      pr.mesh.position.addScaledVector(pr.vel, dt);
      pr.mesh.rotation.x += pr.spin.x * dt * 2; pr.mesh.rotation.y += pr.spin.y * dt * 2;
      const p = pr.mesh.position;
      if (pr.kind === 'orb') {
        const c = pr.color;
        if (Math.random() < dt * 40) P.particles.add.spawn({ p: [p.x, p.y, p.z], v: [0, 0, 0], life: 0.8, size: pr.mesh.scale.x * 1.2, size1: pr.mesh.scale.x * 2.4, color: [c[0] * 1.5, c[1] * 1.5, c[2] * 1.5], alpha: 0.5, drag: 1, tile: 4, fadeIn: 0.02 });
      } else if (Math.random() < dt * 30) P.particles.smoke(p, 5, { dark: 0.15, rise: 2, life: 4, heat: 0.7 });
      const g = P.world.solidHeightAt(p.x, p.z);
      if (p.y <= g + 4 || pr.t > pr.T + 3) {
        if (pr.kind === 'orb') this.splash(p.clone(), pr.r, pr.dmg, pr.color, pr.owner);
        else P.explode(p.clone(), pr.r, pr.dmg, pr.vel.clone().normalize().multiplyScalar(30));
        this.scene.remove(pr.mesh);
        this.projectiles.splice(i, 1);
      }
    }
    if (this.ringT >= 0) {
      this.ringT += dt;
      const u = this.ringT / 0.9;
      this.ring.visible = u < 1;
      const s = this.ringR * (1 - Math.pow(1 - Math.min(1, u), 3));
      this.ring.scale.set(s, s, 1);
      this.ringMat.opacity = Math.max(0, 1 - u);
      this.mouthLight.intensity = Math.max(0, 30000 * (1 - u * 2));
      if (u >= 1) this.ringT = -1;
    }
  }
}
