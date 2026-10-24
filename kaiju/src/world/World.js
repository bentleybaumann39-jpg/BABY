// Assembles the static world for a mission: sky + lighting, city buildings, ground,
// ocean and horizon, and keeps the shared shading uniforms in sync.
import * as THREE from 'three';
import { CSM } from '../../vendor/addons/csm/CSM.js';
import { SkySystem } from '../render/Sky.js';
import { G, setCSM } from '../render/Shading.js';
import { generateCity } from './CityGen.js';
import { Buildings } from './Buildings.js';
import { createGround } from './Ground.js';
import { Environment } from './Environment.js';

export class World {
  constructor(renderer, camera, opts) {
    this.renderer = renderer;
    this.camera = camera;
    this.opts = opts;
    this.scene = new THREE.Scene();
    this.sky = new SkySystem(renderer.gl, opts.skySize || 512);
    const q = renderer.q;
    this.csm = new CSM({
      maxFar: 2600, cascades: q.cascades, mode: 'practical', practicalModeLambda: 0.86, parent: this.scene,
      shadowMapSize: q.shadow, lightDirection: new THREE.Vector3(0, -1, 0), camera, lightIntensity: 3,
      lightNear: 1, lightFar: 6000, lightMargin: 600, shadowBias: -0.00012,
    });
    for (const l of this.csm.lights) { l.shadow.normalBias = 0.6; }
    this.csm.fade = true;
    setCSM(this.csm);
    this.hemi = new THREE.HemisphereLight(0x8899aa, 0x2a2622, 0.0);
    this.scene.add(this.hemi);
    this.setTime(opts.time || 'golden');
    this.city = generateCity(opts.city || 'harbor', opts.density || 1);
    this.buildings = new Buildings(this.city, this.scene, opts.events || {});
    this.ground = createGround(this.city);
    this.scene.add(this.ground);
    this.env = new Environment(this.city, this.scene);
  }

  setTime(name) {
    const p = this.sky.set(name);
    this.time = name;
    this.preset = p;
    this.scene.background = this.sky.background;
    this.scene.environment = this.sky.environment;
    // the sky cube is in absolute radiance units and the sun light is scaled to match, so image
    // based lighting (diffuse and glass reflections) uses the sky at full strength
    this.scene.environmentIntensity = 1.0;
    G.uFogCube.value = this.sky.background;
    G.uSunDir.value.copy(this.sky.sunDir);
    G.uSunCol.value.copy(this.sky.sunColor);
    G.uNight.value = p.night;
    G.uWet.value = name === 'storm' ? 1 : 0;
    G.uFogDensity.value = name === 'storm' ? 0.0009 : name === 'night' ? 0.00022 : name === 'golden' || name === 'dawn' ? 0.00024 : 0.00015;
    // the moon takes over as the key light at night
    const night = this.sky.sunIntensity < 0.05;
    const dir = night ? new THREE.Vector3(-0.35, 0.55, 0.76).normalize() : this.sky.sunDir;
    this.keyDir = dir.clone();
    this.csm.lightDirection.copy(dir).multiplyScalar(-1);
    const col = night ? new THREE.Color(0.55, 0.65, 1.0) : this.sky.sunColor;
    const I = night ? 0.5 : this.sky.sunIntensity;
    for (const l of this.csm.lights) { l.color.copy(col); l.intensity = I; }
    this.keyIntensity = I;
    // light bounced off sunlit streets and facades: a warm fill from below
    const el = Math.max(0.09, this.sky.sunDir.y);
    this.hemi.color.setRGB(0, 0, 0);
    this.hemi.groundColor.copy(night ? new THREE.Color(0.5, 0.45, 0.4) : this.sky.sunColor).lerp(new THREE.Color(0.8, 0.75, 0.7), 0.4);
    this.hemi.intensity = night ? 0.05 : I * el * 0.24;
    this.renderer.gl.toneMappingExposure = p.exposure;
    G.uExposure.value = p.exposure;
  }

  get bounds() {
    const c = this.city;
    return { x0: c.x0 - 600, x1: c.x1 + 600, z0: c.z0 - 600, z1: c.coast + 1600 };
  }

  // Terrain height: flat city, a sea floor that shelves away from the seawall.
  groundAt(x, z) {
    const s = this.city.coast + 6;
    if (z <= s) return 0;
    return -Math.min(46, 3 + (z - s) * 0.075);
  }

  solidHeightAt(x, z) { return Math.max(this.groundAt(x, z), this.buildings.heightAt(x, z)); }
  roofAt(x, z, y) { return this.buildings.roofBelow(x, z, y); }

  update(dt) {
    G.uTime.value += dt;
    this.csm.update();
    this.buildings.update(dt);
    this.env.update(dt, this.keyIntensity);
  }
}
