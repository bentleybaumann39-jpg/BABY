// Pooled combat effects: tracers, impact puffs/sparks, bullet holes, blood, explosions, smoke
// grenades, ash fall, death crates, grenade projectiles and flash lights.
import * as THREE from 'three';

function softTex(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  r.addColorStop(0, inner); r.addColorStop(1, outer);
  g.fillStyle = r; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function smokeTex() {
  const s = 128, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = s / 2 + (Math.random() - 0.5) * s * 0.4, y = s / 2 + (Math.random() - 0.5) * s * 0.4, r = s * (0.15 + Math.random() * 0.22);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.22)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const SURF_COL = { concrete: [0.55, 0.53, 0.5], wood: [0.45, 0.35, 0.24], metal: [0.6, 0.58, 0.55], rock: [0.5, 0.48, 0.45], dirt: [0.42, 0.35, 0.27],
  grass: [0.36, 0.33, 0.22], gravel: [0.5, 0.48, 0.44], water: [0.7, 0.75, 0.75], blood: [0.35, 0.02, 0.02] };

export class Effects {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.group = new THREE.Group(); this.group.name = 'fx'; scene.add(this.group);
    this.tSoft = softTex(); this.tSmoke = smokeTex(); this.tSpark = softTex('rgba(255,220,160,1)', 'rgba(255,120,30,0)', 32);
    // sprite pool
    this.sprites = [];
    for (let i = 0; i < 260; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tSoft, transparent: true, depthWrite: false, fog: true }));
      s.visible = false; s.userData = { life: 0 };
      this.group.add(s); this.sprites.push(s);
    }
    this.sp = 0;
    // tracers
    this.tracerGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 4, 1, true); this.tracerGeo.rotateX(Math.PI / 2); this.tracerGeo.translate(0, 0, -0.5);
    this.tracerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.2, 1.6), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.tracers = [];
    for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(this.tracerGeo, this.tracerMat); m.visible = false; m.frustumCulled = false; m.userData = {}; this.group.add(m); this.tracers.push(m); }
    this.tp = 0;
    // bullet holes
    this.holeGeo = new THREE.PlaneGeometry(0.09, 0.09);
    this.holeMat = new THREE.MeshBasicMaterial({ map: softTex('rgba(10,8,6,0.95)', 'rgba(20,18,16,0)', 32), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.holes = []; this.hp = 0;
    for (let i = 0; i < 160; i++) { const m = new THREE.Mesh(this.holeGeo, this.holeMat); m.visible = false; this.group.add(m); this.holes.push(m); }
    // lights
    this.lights = [];
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffa860, 0, 14, 2); l.userData.life = 0; this.group.add(l); this.lights.push(l); }
    this.lp = 0;
    // smoke clouds
    this.clouds = [];
    // grenades
    this.nadeGeo = new THREE.SphereGeometry(0.05, 8, 6);
    this.nadeMat = new THREE.MeshStandardMaterial({ color: 0x3c4430, roughness: 0.6 });
    this.nades = new Map();
    // crates
    this.crateGeo = new THREE.BoxGeometry(0.9, 0.5, 0.6);
    this.crateMat = new THREE.MeshStandardMaterial({ color: 0x4a5236, roughness: 0.85 });
    this.crates = [];
    // ash fall
    const N = 1600;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 60; pos[i * 3 + 1] = Math.random() * 30; pos[i * 3 + 2] = (Math.random() - 0.5) * 60; }
    const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.ash = new THREE.Points(ag, new THREE.PointsMaterial({ color: new THREE.Color(0.55, 0.52, 0.5), size: 0.07, transparent: true, opacity: 0.0, depthWrite: false, map: this.tSoft }));
    this.ash.frustumCulled = false;
    this.group.add(this.ash);
    this.ashAmt = 0;
  }

  sprite(opts) {
    const s = this.sprites[this.sp]; this.sp = (this.sp + 1) % this.sprites.length;
    const m = s.material;
    m.map = opts.tex || this.tSoft;
    m.blending = opts.add ? THREE.AdditiveBlending : THREE.NormalBlending;
    m.color.setRGB(...(opts.col || [1, 1, 1]));
    m.opacity = opts.op ?? 1;
    m.rotation = Math.random() * Math.PI * 2;
    s.position.set(opts.x, opts.y, opts.z);
    s.scale.setScalar(opts.s || 0.3);
    s.visible = true;
    Object.assign(s.userData, { life: opts.life || 0.5, max: opts.life || 0.5, grow: opts.grow || 1, vx: opts.vx || 0, vy: opts.vy || 0, vz: opts.vz || 0, op: opts.op ?? 1, g: opts.g || 0, s0: opts.s || 0.3 });
    return s;
  }

  flashLight(x, y, z, intensity = 6, life = 0.06, color = 0xffa860, dist = 14) {
    const l = this.lights[this.lp]; this.lp = (this.lp + 1) % this.lights.length;
    l.position.set(x, y, z); l.intensity = intensity; l.color.set(color); l.distance = dist; l.userData.life = life; l.userData.max = life; l.userData.i = intensity;
  }

  tracer(ax, ay, az, bx, by, bz) {
    const m = this.tracers[this.tp]; this.tp = (this.tp + 1) % this.tracers.length;
    const d = Math.hypot(bx - ax, by - ay, bz - az);
    if (d < 3) return;
    m.position.set(ax, ay, az);
    m.lookAt(bx, by, bz);
    m.userData = { a: [ax, ay, az], dir: [(bx - ax) / d, (by - ay) / d, (bz - az) / d], len: d, t: 0 };
    m.scale.set(1, 1, Math.min(9, d));
    m.visible = true;
  }

  impact(x, y, z, surf, nx = 0, ny = 1, nz = 0, hole = true) {
    const c = SURF_COL[surf] || SURF_COL.dirt;
    if (surf === 'water') {
      for (let i = 0; i < 4; i++) this.sprite({ x, y: y + 0.1, z, s: 0.25, grow: 3, life: 0.6, col: c, op: 0.6, vy: 2 + Math.random() * 2, g: 9, vx: (Math.random() - 0.5), vz: (Math.random() - 0.5) });
      return;
    }
    this.sprite({ x: x + nx * 0.05, y: y + ny * 0.05, z: z + nz * 0.05, s: 0.18, grow: 5, life: 0.7, col: c, op: 0.55, vx: nx * 0.6, vy: ny * 0.6 + 0.3, vz: nz * 0.6, tex: this.tSmoke });
    for (let i = 0; i < 3; i++) this.sprite({ x, y, z, s: 0.04, grow: 1, life: 0.35, col: c.map(v => v * 0.7), op: 1, vx: nx * 3 + (Math.random() - 0.5) * 3, vy: ny * 3 + Math.random() * 2, vz: nz * 3 + (Math.random() - 0.5) * 3, g: 12 });
    if (surf === 'metal' || surf === 'rock') for (let i = 0; i < 4; i++) this.sprite({ x, y, z, s: 0.05, grow: 0.5, life: 0.15, col: [4, 2.5, 1.2], add: true, tex: this.tSpark, vx: nx * 5 + (Math.random() - 0.5) * 6, vy: ny * 5 + Math.random() * 4, vz: nz * 5 + (Math.random() - 0.5) * 6, g: 15 });
    if (hole && surf !== 'grass' && surf !== 'dirt') {
      const h = this.holes[this.hp]; this.hp = (this.hp + 1) % this.holes.length;
      h.position.set(x + nx * 0.01, y + ny * 0.01, z + nz * 0.01);
      h.lookAt(x + nx, y + ny, z + nz);
      h.rotateZ(Math.random() * 6);
      h.visible = true;
    }
  }

  blood(x, y, z, dx = 0, dz = 0) {
    for (let i = 0; i < 3; i++) this.sprite({ x, y, z, s: 0.15, grow: 3.5, life: 0.5, col: [0.35, 0.02, 0.02], op: 0.75, vx: dx * 2 + (Math.random() - 0.5), vy: Math.random(), vz: dz * 2 + (Math.random() - 0.5), tex: this.tSmoke, g: 2 });
  }

  explosion(x, y, z) {
    this.flashLight(x, y + 1, z, 60, 0.35, 0xff9a40, 40);
    for (let i = 0; i < 10; i++) this.sprite({ x, y: y + 0.5, z, s: 1.2, grow: 3, life: 0.45, col: [6, 3, 1.2], add: true, op: 0.9, vx: (Math.random() - 0.5) * 6, vy: Math.random() * 5, vz: (Math.random() - 0.5) * 6, tex: this.tSmoke });
    for (let i = 0; i < 14; i++) this.sprite({ x, y: y + 0.5, z, s: 1.5, grow: 4, life: 3 + Math.random() * 2, col: [0.18, 0.16, 0.14], op: 0.7, vx: (Math.random() - 0.5) * 4, vy: 1 + Math.random() * 3, vz: (Math.random() - 0.5) * 4, tex: this.tSmoke });
    for (let i = 0; i < 16; i++) this.sprite({ x, y: y + 0.3, z, s: 0.06, life: 1.2, col: [0.2, 0.16, 0.12], vx: (Math.random() - 0.5) * 16, vy: 4 + Math.random() * 10, vz: (Math.random() - 0.5) * 16, g: 15 });
  }

  smoke(id, x, y, z, dur = 20) {
    const puffs = [];
    for (let i = 0; i < 26; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tSmoke, transparent: true, depthWrite: false, color: new THREE.Color(0.75, 0.75, 0.72), opacity: 0 }));
      const a = Math.random() * Math.PI * 2, r = Math.random() * 4.5;
      s.userData = { ox: Math.cos(a) * r, oz: Math.sin(a) * r, oy: Math.random() * 3.5 + 0.5, s: 3 + Math.random() * 3, rot: (Math.random() - 0.5) * 0.2 };
      s.position.set(x, y, z);
      this.group.add(s); puffs.push(s);
    }
    this.clouds.push({ id, x, y, z, t: 0, dur, puffs });
  }

  setNades(list) {
    const seen = new Set();
    for (const p of list) {
      seen.add(p.id);
      let m = this.nades.get(p.id);
      if (!m) { m = new THREE.Mesh(this.nadeGeo, this.nadeMat); m.castShadow = true; this.group.add(m); this.nades.set(p.id, m); }
      m.position.set(p.x, p.y, p.z);
    }
    for (const [id, m] of this.nades) if (!seen.has(id)) { this.group.remove(m); this.nades.delete(id); }
  }

  crate(c) {
    const m = new THREE.Mesh(this.crateGeo, this.crateMat);
    m.position.set(c.x, c.y + 0.25, c.z);
    m.rotation.y = (c.id * 1.3) % 6.28;
    m.castShadow = true; m.receiveShadow = true;
    this.group.add(m);
    this.crates.push(m);
  }

  update(dt, cam, ashAmount = 0) {
    for (const s of this.sprites) {
      if (!s.visible) continue;
      const u = s.userData;
      u.life -= dt;
      if (u.life <= 0) { s.visible = false; continue; }
      u.vy -= u.g * dt;
      s.position.x += u.vx * dt; s.position.y += u.vy * dt; s.position.z += u.vz * dt;
      const t = 1 - u.life / u.max;
      s.scale.setScalar(u.s0 * (1 + (u.grow - 1) * t));
      s.material.opacity = u.op * (1 - t);
    }
    for (const m of this.tracers) {
      if (!m.visible) continue;
      const u = m.userData;
      u.t += dt * 600;
      const len = Math.min(9, u.len);
      if (u.t > u.len) { m.visible = false; continue; }
      m.position.set(u.a[0] + u.dir[0] * u.t, u.a[1] + u.dir[1] * u.t, u.a[2] + u.dir[2] * u.t);
      m.scale.z = Math.min(len, u.len - u.t);
    }
    for (const l of this.lights) { if (l.userData.life > 0) { l.userData.life -= dt; l.intensity = Math.max(0, l.userData.i * l.userData.life / l.userData.max); } else l.intensity = 0; }
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      c.t += dt;
      const grow = Math.min(1, c.t / 3), fade = c.t > c.dur - 4 ? Math.max(0, (c.dur - c.t) / 4) : 1;
      for (const p of c.puffs) {
        const u = p.userData;
        p.position.set(c.x + u.ox * (0.3 + grow * 0.7), c.y + u.oy * grow, c.z + u.oz * (0.3 + grow * 0.7));
        p.scale.setScalar(u.s * (0.4 + grow * 0.6));
        p.material.rotation += u.rot * dt;
        p.material.opacity = 0.9 * grow * fade;
      }
      if (c.t > c.dur) { for (const p of c.puffs) { this.group.remove(p); p.material.dispose(); } this.clouds.splice(i, 1); }
    }
    // ash fall around the camera
    this.ashAmt += (ashAmount - this.ashAmt) * Math.min(1, dt * 2);
    this.ash.material.opacity = 0.15 + this.ashAmt * 0.75;
    const pa = this.ash.geometry.attributes.position;
    const wrap = (v, c) => { const d = v - c; return c + (((d + 30) % 60) + 60) % 60 - 30; };
    for (let i = 0; i < pa.count; i++) {
      let y = pa.getY(i) - dt * (0.6 + (i % 7) * 0.08);
      if (y < cam.y - 12) y += 30; else if (y > cam.y + 18) y -= 30;
      pa.setXYZ(i, wrap(pa.getX(i) + Math.sin(y * 0.7 + i) * dt * 0.3, cam.x), y, wrap(pa.getZ(i), cam.z));
    }
    pa.needsUpdate = true;
  }
}
