// The menu backdrop: the selected kaiju standing in a dark bay at dusk, the city lights on
// the horizon, a slow orbiting camera. Shares the sky, fog and ocean code with the game.
import * as THREE from 'three';
import { SkySystem } from '../render/Sky.js';
import { G, setCSM, patchTree } from '../render/Shading.js';
import { KAIJU, kaijuStats } from '../core/Config.js';
import { loadKaiju } from '../core/Assets.js';
import { clone as skelClone } from '../../vendor/addons/utils/SkeletonUtils.js';
import { Environment, SEA_LEVEL } from '../world/Environment.js';
import { damp } from '../core/Rng.js';

export class MenuStage {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.active = false;
    this.t = 0;
    this.current = null;
    this.models = {};
    this.orbit = 0;
  }

  async init() {
    const R = this.app.renderer;
    setCSM(null);
    this.sky = new SkySystem(R.gl, 256);
    this.sky.set('dusk', { el: -1.2, cloud: 0.5 });
    this.scene.background = this.sky.background;
    this.scene.environment = this.sky.environment;
    G.uFogCube.value = this.sky.background;
    G.uFogDensity.value = 0.0009;
    G.uSunDir.value.copy(this.sky.sunDir);
    G.uSunCol.value.copy(this.sky.sunColor);
    G.uNight.value = 0.7;
    // key + rim lights for the creature
    const key = new THREE.DirectionalLight(0xffb27a, 2.2);
    key.position.set(-120, 80, -60);
    const rim = new THREE.DirectionalLight(0x7fb8ff, 3.5);
    rim.position.set(90, 60, 140);
    const fill = new THREE.HemisphereLight(0x324058, 0x120c08, 0.6);
    this.scene.add(key, rim, fill);
    key.castShadow = false;
    // water: reuse the ocean shader with a fake "city" at the coastline far away
    this.env = new Environment({ coast: -2000, x0: -1000, x1: 1000, z0: -3000, piers: [] }, this.scene, { oceanOnly: true });
    this.env.ocean.position.set(0, SEA_LEVEL, 0);
    // distant skyline glow: a row of emissive boxes behind the haze
    const sky = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x2a2018 }), 160);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 160; i++) {
      const x = -1500 + i * 19 + Math.random() * 10, h = 20 + Math.pow(Math.random(), 2.2) * 240 * (1 - Math.abs(x) / 1800);
      m.compose(new THREE.Vector3(x, h / 2 - 2, -1900 - Math.random() * 200), new THREE.Quaternion(), new THREE.Vector3(14 + Math.random() * 20, h, 20));
      sky.setMatrixAt(i, m);
    }
    this.scene.add(sky);
    const lights = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.2) }), 600);
    for (let i = 0; i < 600; i++) {
      m.compose(new THREE.Vector3(-1500 + Math.random() * 3000, Math.random() * 160, -1880), new THREE.Quaternion(), new THREE.Vector3(2.5, 2.5, 1));
      lights.setMatrixAt(i, m);
    }
    this.scene.add(lights);
    this.app.camera.position.set(0, 40, 160);
    this.app.renderer.gl.toneMappingExposure = 1.0;
    await this.showKaiju(this.app.profile.selected);
    this.active = true;
  }

  async showKaiju(id, refresh = false) {
    this.wantId = id;
    let entry = this.models[id];
    if (!entry || refresh) {
      try {
        const { gltf, meta } = await loadKaiju(KAIJU[id].asset);
        if (this.wantId !== id) return;
        const model = skelClone(gltf.scene);
        model.traverse((o) => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map((x) => x.clone()) : o.material.clone(); });
        patchTree(model, 'menu-' + id);
        model.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const mm of ms) { mm.side = THREE.FrontSide; if (/plate|vein|glow|shard/.test(mm.name)) { mm.emissive = new THREE.Color(...KAIJU[id].moves.special.color); mm.emissiveIntensity = 1.5; } } } });
        const mixer = new THREE.AnimationMixer(model);
        const clip = gltf.animations.find((c) => c.name === 'idle');
        if (clip) mixer.clipAction(clip).play();
        if (entry) this.scene.remove(entry.model);
        entry = { model, mixer, meta, gltf };
        this.models[id] = entry;
      } catch (e) {
        // models for locked creatures may not be shipped in a cut-down build
        entry = null;
      }
    }
    if (this.current && this.current !== entry) this.scene.remove(this.current.model);
    this.current = entry;
    this.currentId = entry ? id : null;
    if (!entry) return;
    const lv = this.app.profile.levels[id] || {};
    const st = kaijuStats(id, lv);
    entry.model.scale.setScalar(st.scale);
    entry.model.position.set(0, -6, 0);
    entry.model.rotation.y = 0.5;
    this.scene.add(entry.model);
    this.height = (entry.meta.height || 50) * st.scale;
    this.roarT = 0;
    const roar = entry.gltf.animations.find((c) => c.name === 'roar');
    if (roar && !refresh) {
      const a = entry.mixer.clipAction(roar);
      a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false; a.fadeIn(0.3); a.play();
      setTimeout(() => a.fadeOut(0.6), (roar.duration - 0.6) * 1000);
      this.app.audio && this.app.audio.roarMenu(id);
    }
  }

  update(dt) {
    this.t += dt;
    G.uTime.value += dt;
    this.env.update(dt, 0.6);
    if (this.current) this.current.mixer.update(dt);
    const H = this.height || 55;
    this.orbit += dt * 0.05;
    const r = H * 2.1;
    const cam = this.app.camera;
    const tx = Math.sin(this.orbit) * r * 0.35 + H * 0.35, tz = H * 2.0 + Math.cos(this.orbit * 0.7) * H * 0.3;
    cam.position.x = damp(cam.position.x, tx, 1.5, dt);
    cam.position.y = damp(cam.position.y, H * 0.42, 1.5, dt);
    cam.position.z = damp(cam.position.z, tz, 1.5, dt);
    cam.lookAt(H * 0.25, H * 0.48, 0);
    this.env.setWake(0, 0, 0, 22, 0.5);
  }
}
