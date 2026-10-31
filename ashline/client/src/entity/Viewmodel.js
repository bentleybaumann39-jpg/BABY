// First-person arms + weapon, rendered in the overlay scene. Procedural sway, bob, ADS alignment,
// recoil, reload/equip/heal/throw poses and a muzzle flash.
import * as THREE from 'three';
import { CAMOS } from '../../../shared/progression.js';
import { camoTexture } from '../render/Textures.js';
import { buildWeapon, buildGrenade } from './WeaponModels.js';
import { WEAPONS, ATTACH } from '../../../shared/sim/Items.js';

const HIP = new THREE.Vector3(0.15, -0.165, -0.36);

export class Viewmodel {
  constructor(renderer, tex, cos) {
    this.R = renderer;
    this.scene = renderer.vmScene;
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.gun = new THREE.Group(); this.root.add(this.gun);
    this.tex = tex;
    this.cos = cos || {};
    this.camo = null;
    this.glove = new THREE.MeshStandardMaterial({ color: 0x141412, roughness: 0.75 });
    this.armGeo = new THREE.CapsuleGeometry(0.045, 0.32, 4, 10);
    this.armR = new THREE.Mesh(this.armGeo, this.glove); this.armL = new THREE.Mesh(this.armGeo, this.glove);
    this.handGeo = new THREE.BoxGeometry(0.075, 0.05, 0.1);
    this.handR = new THREE.Mesh(this.handGeo, this.glove); this.handL = new THREE.Mesh(this.handGeo, this.glove);
    this.root.add(this.armR, this.armL, this.handR, this.handL);
    this.setCosmetics(this.cos);
    // muzzle flash
    const fc = document.createElement('canvas'); fc.width = fc.height = 64;
    const g = fc.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,240,200,1)'); grd.addColorStop(0.25, 'rgba(255,170,60,0.9)'); grd.addColorStop(1, 'rgba(255,90,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 5; k++) { g.save(); g.translate(32, 32); g.rotate(k / 5 * Math.PI * 2); g.fillStyle = 'rgba(255,200,120,0.6)'; g.fillRect(-2, 0, 4, 30); g.restore(); }
    const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace;
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: ft, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(3, 2.4, 1.8) }));
    this.flash.visible = false;
    this.flashLight = new THREE.PointLight(0xffaa55, 0, 3, 2);
    this.root.add(this.flashLight);
    this.weaponKey = null; this.weapon = null;
    this.t = 0; this.adsT = 0; this.sprintT = 0; this.kick = 0; this.kickRot = 0; this.flashT = 0;
    this.swayX = 0; this.swayY = 0; this.bobPhase = 0; this.lowerT = 0; this.equipT = 1; this.throwT = 0;
    this.visible = true;
  }

  setCosmetics(cos) {
    this.cos = cos || {};
    const c = CAMOS.find(x => x.id === this.cos.camo) || CAMOS[0];
    const mat = new THREE.MeshStandardMaterial({ map: camoTexture(c.id, c.c), roughness: 0.9 });
    this.armR.material = mat; this.armL.material = mat;
    this.weaponKey = null;
  }

  // w: inventory weapon {id, att} | 'frag' | 'smoke' | null
  setWeapon(w) {
    const key = !w ? 'none' : typeof w === 'string' ? w : `${w.id}|${JSON.stringify(w.att)}|${this.cos.finish}`;
    if (key === this.weaponKey) return;
    this.weaponKey = key;
    if (this.weapon) this.gun.remove(this.weapon);
    this.weapon = null; this.def = null;
    if (key === 'none') return;
    if (typeof w === 'string') { this.weapon = buildGrenade(w); this.weapon.position.set(0, 0, 0); this.isThrow = true; }
    else { this.weapon = buildWeapon(w.id, this.cos.finish, w.att); this.def = WEAPONS[w.id]; this.att = w.att; this.isThrow = false; }
    this.gun.add(this.weapon);
    const mz = this.weapon.userData.muzzle;
    if (mz) { this.flash.removeFromParent(); mz.add(this.flash); }
    this.equipT = 0;
  }

  get optic() { return this.att && this.att.optic ? ATTACH[this.att.optic] : null; }
  get zoom() { const o = this.optic; return o ? o.zoom : (this.def ? this.def.zoom : 1); }
  get scoped() { const o = this.optic; return !!(o && o.scope); }

  shot() {
    const d = this.def;
    const k = d ? d.kick : 1;
    this.kick = Math.min(0.09, this.kick + 0.012 + k * 0.006);
    this.kickRot = Math.min(0.25, this.kickRot + 0.02 + k * 0.012);
    this.flashT = 0.05;
    this.flash.rotation.z = Math.random() * Math.PI;
    const s = 0.8 + Math.random() * 0.5;
    this.flash.scale.set(s, s, s);
    if (d && this.weapon && this.weapon.getObjectByName('pump')) this.pumpT = 0.6;
  }

  throwAnim() { this.throwT = 0.6; }

  // st: { dt, speed, sprint, ads, grounded, crouch, act, actP, lookDX, lookDY, hidden, suppressed }
  update(st) {
    const dt = st.dt;
    this.t += dt;
    const R = this.R;
    // mirror the main sun so lighting matches
    R.vmSun.position.copy(R.sun.position).sub(R.sun.target.position).normalize().applyQuaternion(R.camera.quaternion.clone().invert());
    R.vmSun.intensity = st.indoor ? 0.35 : 2.2;
    R.vmHemi.intensity = st.indoor ? 0.55 : 1.1;
    const visible = !st.hidden && !!this.weapon;
    this.root.visible = visible;
    if (!visible) return;
    this.adsT += ((st.ads && !st.sprint ? 1 : 0) - this.adsT) * Math.min(1, dt * (this.def ? 14 / Math.max(0.6, this.def.equip * 1.6) : 12));
    this.sprintT += ((st.sprint ? 1 : 0) - this.sprintT) * Math.min(1, dt * 8);
    const lower = st.act === 2 || st.act === 4 || st.act === 5 ? 1 : 0;
    this.lowerT += (lower - this.lowerT) * Math.min(1, dt * 7);
    this.equipT = Math.min(1, this.equipT + dt * 2.6);
    this.kick *= Math.exp(-dt * 14); this.kickRot *= Math.exp(-dt * 10);
    this.swayX += (-st.lookDX * 0.0006 - this.swayX) * Math.min(1, dt * 8);
    this.swayY += (st.lookDY * 0.0006 - this.swayY) * Math.min(1, dt * 8);
    const sp = Math.min(1, st.speed / 6.6);
    if (st.grounded) this.bobPhase += dt * (4 + st.speed * 1.4);
    const ads = this.adsT, hip = 1 - ads;
    const bobA = sp * (st.grounded ? 1 : 0) * (hip * 0.9 + ads * 0.15);
    const breathe = Math.sin(this.t * 1.6) * 0.0025 * (1 - ads * 0.7);
    // base pose
    const w = this.weapon;
    const sight = w.userData.sight;
    let px = HIP.x, py = HIP.y, pz = HIP.z;
    if (sight && !this.isThrow) {
      const eyeDist = this.optic && this.optic.scope ? 0.11 : this.optic ? 0.2 : 0.17;
      const ax = -sight.position.x, ay = -sight.position.y, az = -eyeDist - sight.position.z;
      px = px * hip + ax * ads; py = py * hip + ay * ads; pz = pz * hip + az * ads;
    }
    if (this.isThrow) { px = 0.18; py = -0.2; pz = -0.32; }
    px += Math.sin(this.bobPhase * 0.5) * 0.012 * bobA + this.swayX;
    py += -Math.abs(Math.cos(this.bobPhase * 0.5)) * 0.012 * bobA + breathe + this.swayY;
    pz += this.kick;
    // sprint / lower / equip offsets
    py -= this.sprintT * 0.05 + this.lowerT * 0.35 + (1 - easeOut(this.equipT)) * 0.3;
    px += this.sprintT * 0.02;
    this.gun.position.set(px, py, pz);
    this.gun.rotation.set(this.kickRot * (hip * 1 + ads * 0.45) - this.sprintT * 0.35 + this.swayY * 2, this.sprintT * 0.75 + this.swayX * 2, this.sprintT * 0.25 + Math.sin(this.bobPhase * 0.5) * 0.02 * bobA);
    // reload: roll the weapon and drop the mag
    const mag = w.userData.mag;
    if (st.act === 1) {
      const p = st.actP;
      const roll = Math.sin(Math.min(1, p * 1.15) * Math.PI);
      this.gun.rotation.z += roll * 0.55; this.gun.rotation.x += roll * 0.25; this.gun.position.y -= roll * 0.04;
      if (mag) { if (!mag.userData.y0) mag.userData.y0 = mag.position.y; mag.position.y = mag.userData.y0 - (p > 0.2 && p < 0.65 ? 0.3 : p >= 0.65 && p < 0.8 ? (0.8 - p) * 2 : 0); }
    } else if (mag && mag.userData.y0 !== undefined) mag.position.y = mag.userData.y0;
    if (this.throwT > 0) { this.throwT -= dt; const p = 1 - this.throwT / 0.6; this.gun.position.z -= Math.sin(p * Math.PI) * 0.25; this.gun.position.y += Math.sin(p * Math.PI) * 0.15; }
    if (this.pumpT > 0) { this.pumpT -= dt; const pump = this.weapon.getObjectByName('pump'); if (pump) pump.position.z = -0.38 + Math.sin(Math.min(1, (0.6 - this.pumpT) / 0.4) * Math.PI) * 0.08; }
    // hands & forearms
    const handR = new THREE.Vector3(0, -0.04, 0.09), handL = new THREE.Vector3(0, -0.005, w.userData.handZ ?? -0.25);
    if (this.isThrow) { handR.set(0, -0.02, 0.02); handL.set(-0.14, -0.06, 0.05); }
    this.gun.updateMatrixWorld(true);
    handR.applyMatrix4(this.gun.matrixWorld); handL.applyMatrix4(this.gun.matrixWorld);
    if (this.root.parent) { const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert(); handR.applyMatrix4(inv); handL.applyMatrix4(inv); }
    this.place(this.handR, this.armR, handR, new THREE.Vector3(0.24, -0.42, 0.12));
    this.place(this.handL, this.armL, handL, new THREE.Vector3(-0.2, -0.45, 0.05));
    this.handL.visible = this.armL.visible = this.lowerT < 0.9 || !this.isThrow;
    // flash
    this.flashT -= dt;
    this.flash.visible = this.flashT > 0 && !st.suppressed;
    this.flashLight.intensity = this.flashT > 0 && !st.suppressed ? 4 : 0;
    if (this.flash.visible) { const mp = new THREE.Vector3(); w.userData.muzzle.getWorldPosition(mp); this.flashLight.position.copy(mp); }
    this.root.updateMatrixWorld(true);
  }

  place(hand, arm, hp, elbow) {
    hand.position.copy(hp);
    const dir = hp.clone().sub(elbow);
    const len = dir.length();
    arm.position.copy(elbow).addScaledVector(dir, 0.5);
    arm.scale.set(1, len / 0.41, 1);
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    hand.quaternion.copy(arm.quaternion);
  }

  // World-space muzzle position (approximate: maps the overlay camera space onto the main camera).
  muzzleWorld(out) {
    if (!this.weapon || !this.weapon.userData.muzzle) return null;
    const p = new THREE.Vector3();
    this.weapon.userData.muzzle.getWorldPosition(p);
    p.applyMatrix4(this.R.camera.matrixWorld);
    return out ? out.copy(p) : p;
  }
}

function easeOut(t) { return 1 - (1 - t) * (1 - t); }
