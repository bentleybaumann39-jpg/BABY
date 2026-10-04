// Light fixtures (instanced emissive meshes) + a constant-size pool of point lights assigned to the
// most relevant fixtures. Each pooled light carries its room bounds (see Materials.js).
import * as THREE from 'three';
import { LIGHT_BOUNDS, setLightPoolSize } from './Materials.js';

const TYPES = {
  fluoro: { color: 0xdfe9ff, intensity: 24, range: 9.5, geo: () => new THREE.BoxGeometry(1.2, 0.05, 0.16), emit: 3.2 },
  pendant: { color: 0xffc98c, intensity: 34, range: 11, geo: () => new THREE.CylinderGeometry(0.08, 0.32, 0.22, 14, 1, true), emit: 2.4 },
  cage: { color: 0xffbf78, intensity: 30, range: 8, geo: () => new THREE.SphereGeometry(0.08, 10, 8), emit: 4 },
  flood: { color: 0xe4eeff, intensity: 55, range: 18, geo: () => new THREE.BoxGeometry(0.6, 0.12, 0.6), emit: 4 },
  studio: { color: 0xfff0d6, intensity: 22, range: 9, geo: () => new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16), emit: 2.5 },
  emergency: { color: 0xff2a14, intensity: 9, range: 5.5, geo: () => new THREE.BoxGeometry(0.25, 0.12, 0.08), emit: 3 },
  lamppost: { color: 0xffa255, intensity: 70, range: 20, geo: null, emit: 0 },
  canopy: { color: 0xffb070, intensity: 18, range: 9, geo: () => new THREE.BoxGeometry(0.3, 0.05, 0.3), emit: 3 },
  desk: { color: 0xffbb66, intensity: 14, range: 5, geo: null, emit: 0 },
  boilerGlow: { color: 0xff5a18, intensity: 30, range: 7, geo: null, emit: 0 },
};

export class Lights {
  constructor(game, map, poolSize) {
    this.game = game;
    this.map = map;
    this.poolSize = poolSize;
    setLightPoolSize(poolSize);
    this.group = new THREE.Group();
    this.group.name = 'lights';
    this.fixtures = map.fixtures.map((f) => ({
      ...f,
      def: TYPES[f.type] || TYPES.fluoro,
      bright: 0,          // current displayed brightness 0..1
      target: 0,
      broken: !!f.broken,
      flicker: f.flicker || 0,
      kill: 0,            // anomaly-forced off timer
      colorOverride: null,
      phase: Math.random() * 100,
      bounds: null,
    }));
    for (const f of this.fixtures) f.bounds = this.boundsFor(f);
    // Seeded decay: some tubes are dead, some stutter. Never the emergency units.
    const rng = game.rng.fork('fixtures');
    for (const f of this.fixtures) {
      if (['emergency', 'lamppost', 'canopy', 'desk', 'boilerGlow', 'flood'].includes(f.type)) continue;
      const r = rng.next();
      if (r < 0.22) f.broken = true;
      else if (r < 0.36) f.flicker = rng.range(0.3, 0.8);
      f.dim = (f.dim ?? 1) * rng.range(0.7, 1.0);
    }
    this.pool = [];
    for (let i = 0; i < poolSize; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 2);
      l.castShadow = false;
      this.group.add(l);
      this.pool.push({ light: l, fx: null, fade: 0 });
    }
    // Instanced emissive fixture meshes per type
    this.inst = new Map();
    const byType = new Map();
    this.fixtures.forEach((f, k) => {
      if (!f.def.geo) return;
      if (!byType.has(f.type)) byType.set(f.type, []);
      byType.get(f.type).push(k);
    });
    const m4 = new THREE.Matrix4();
    for (const [type, list] of byType) {
      const def = TYPES[type];
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const mesh = new THREE.InstancedMesh(def.geo(), mat, list.length);
      list.forEach((fi, j) => {
        const f = this.fixtures[fi];
        const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.horiz === 'z' ? Math.PI / 2 : 0);
        m4.compose(new THREE.Vector3(f.x, f.y, f.z), rot, new THREE.Vector3(1, 1, 1));
        mesh.setMatrixAt(j, m4);
        mesh.setColorAt(j, new THREE.Color(0, 0, 0));
        f.inst = mesh; f.instIndex = j;
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.inst.set(type, mesh);
    }
    // Housings (unlit dark) for fluorescent fixtures
    const housings = this.fixtures.filter((f) => f.type === 'fluoro');
    if (housings.length) {
      const hm = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.06, 0.28), game.mats.prop('metalCream'), housings.length);
      housings.forEach((f, j) => {
        m4.compose(new THREE.Vector3(f.x, f.y + 0.04, f.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.horiz === 'z' ? Math.PI / 2 : 0), new THREE.Vector3(1, 1, 1));
        hm.setMatrixAt(j, m4);
      });
      this.group.add(hm);
    }
    this.tmpColor = new THREE.Color();
    this.reassignTimer = 0;
    this.globalDim = 1;      // finale / events
    this.emergencyBoost = 0; // finale red light
  }

  boundsFor(f) {
    if (f.type === 'lamppost' || f.type === 'canopy') return [3, 46.2, 81, 66];
    const z = this.map.zones[f.zoneId];
    if (!z) return [f.x - 6, f.z - 6, f.x + 6, f.z + 6];
    return [z.x0 - 0.05, z.z0 - 0.05, z.x1 + 1.05, z.z1 + 1.05];
  }

  powered(f) {
    const c = f.circuit;
    if (c === 'ext' || c === 'emergency') return true;
    if (c === 'boiler') return !!this.game.puzzles?.boilerRunning;
    return this.game.power ? this.game.power.isOn(c) : true;
  }

  // Momentarily kill lights near a point (anomalies / entity).
  killNear(x, z, radius, seconds) {
    for (const f of this.fixtures) if (Math.hypot(f.x - x, f.z - z) < radius && f.circuit !== 'emergency') f.kill = Math.max(f.kill, seconds);
  }

  flickerNear(x, z, radius, amount = 1) {
    for (const f of this.fixtures) if (Math.hypot(f.x - x, f.z - z) < radius) f.flickerBurst = Math.max(f.flickerBurst || 0, amount);
  }

  // Approximate light level at a point (0..1) for AI visibility.
  levelAt(x, z) {
    let s = 0;
    for (const f of this.fixtures) {
      if (f.bright < 0.05) continue;
      const d = Math.hypot(f.x - x, f.z - z);
      if (d > f.def.range) continue;
      const [x0, z0, x1, z1] = f.bounds;
      if (x < x0 - 0.5 || x > x1 + 0.5 || z < z0 - 0.5 || z > z1 + 0.5) continue;
      s += f.bright * (1 - d / f.def.range) * (f.type === 'emergency' ? 0.25 : 1);
    }
    return Math.min(1, s);
  }

  // Instantly re-settle the pool (after teleports / loads).
  snap(camPos, time = 0) {
    for (const s of this.pool) { s.fx = null; s.fade = 0; s.leaving = false; }
    for (const f of this.fixtures) f.bright = (!f.broken && this.powered(f)) ? (f.dim ?? 1) : 0;
    this.reassignTimer = 0;
    this.update(0.0001, camPos, time);
    for (const s of this.pool) if (s.fx) s.fade = 1;
    this.update(0.0001, camPos, time);
  }

  update(dt, camPos, time) {
    // Fixture brightness
    for (const f of this.fixtures) {
      let target = (!f.broken && this.powered(f)) ? 1 : 0;
      if (f.kill > 0) { f.kill -= dt; target = 0; }
      if (f.dim) target *= f.dim;
      if (target > 0 && (f.flicker > 0 || f.flickerBurst > 0)) {
        const amt = Math.max(f.flicker, f.flickerBurst || 0);
        const n = Math.sin(time * 23 + f.phase) * Math.sin(time * 7.3 + f.phase * 2) + Math.sin(time * 61 + f.phase);
        if (n > 1.6 - amt * 1.4) target *= 0.05;
        else if (n > 1.2 - amt) target *= 0.6;
      }
      if (f.flickerBurst > 0) f.flickerBurst = Math.max(0, f.flickerBurst - dt * 0.6);
      if (f.circuit !== 'emergency') target *= this.globalDim;
      else target *= 1 + this.emergencyBoost * 2.5;
      // Fluorescents snap; incandescent ease.
      const rate = f.type === 'fluoro' || f.type === 'flood' ? 30 : 8;
      f.bright += (target - f.bright) * Math.min(1, dt * rate);
      if (f.inst) {
        const e = f.def.emit * f.bright;
        const col = this.tmpColor.set(f.colorOverride ?? f.def.color).multiplyScalar(0.25 + e);
        if (f.bright < 0.02) col.setRGB(0.03, 0.03, 0.03);
        f.inst.setColorAt(f.instIndex, col);
      }
    }
    for (const m of this.inst.values()) if (m.instanceColor) m.instanceColor.needsUpdate = true;

    // Pool assignment (throttled)
    this.reassignTimer -= dt;
    if (this.reassignTimer <= 0) {
      this.reassignTimer = 0.12;
      const cand = [];
      const pz = this.game.player ? this.game.map.zoneAt(camPos.x, camPos.z) : null;
      for (const f of this.fixtures) {
        if (f.bright < 0.03 && !this.pool.some((s) => s.fx === f)) continue;
        const d = Math.hypot(f.x - camPos.x, f.z - camPos.z) - Math.max(0, f.y - camPos.y) * 0.2;
        if (d > f.def.range + 14) continue;
        let score = d - (pz && f.zoneId === pz.id ? 6 : 0) - (f.type === 'lamppost' ? 4 : 0);
        if (f.bright < 0.03) score += 100;
        cand.push({ f, score });
      }
      cand.sort((a, b) => a.score - b.score);
      const want = new Set(cand.slice(0, this.poolSize).map((c) => c.f));
      for (const s of this.pool) if (s.fx && !want.has(s.fx)) s.leaving = true; else s.leaving = false;
      for (const f of want) {
        if (this.pool.some((s) => s.fx === f)) continue;
        const free = this.pool.find((s) => !s.fx) || this.pool.find((s) => s.leaving && s.fade < 0.05);
        if (free) { free.fx = f; free.fade = 0; free.leaving = false; }
      }
    }
    for (let i = 0; i < this.pool.length; i++) {
      const s = this.pool[i];
      const l = s.light;
      if (!s.fx) { l.intensity = 0; LIGHT_BOUNDS.value[i].set(-1e5, -1e5, -1e5, -1e5); continue; }
      s.fade += ((s.leaving ? 0 : 1) - s.fade) * Math.min(1, dt * 8);
      if (s.leaving && s.fade < 0.02) { s.fx = null; s.leaving = false; l.intensity = 0; continue; }
      const f = s.fx;
      l.position.set(f.x, f.y - 0.12, f.z);
      l.color.set(f.colorOverride ?? f.def.color);
      l.intensity = f.def.intensity * f.bright * s.fade * (f.dim ?? 1) * (f.circuit === 'emergency' ? 1 + this.emergencyBoost * 2 : 1);
      l.distance = f.def.range * (f.circuit === 'emergency' ? 1 + this.emergencyBoost : 1);
      const b = f.bounds;
      LIGHT_BOUNDS.value[i].set(b[0], b[1], b[2], b[3]);
    }
  }

  serialize() { return { broken: this.fixtures.map((f) => (f.broken ? 1 : 0)) }; }
  deserialize(d) {
    if (!d) return;
    d.broken?.forEach((b, k) => { if (this.fixtures[k]) this.fixtures[k].broken = !!b; });
  }
}
