// Procedural soldier: hierarchical parts posed procedurally (walk/run cycle, crouch, aim pitch,
// knocked crawl, freefall, parachute). Gear (helmet/vest/pack tiers) and cosmetics are visible.
import * as THREE from 'three';
import { MODE } from '../../../shared/constants.js';
import { CAMOS } from '../../../shared/progression.js';
import { camoTexture } from '../render/Textures.js';
import { buildWeapon, buildGrenade } from './WeaponModels.js';
import { weaponFromWire } from '../../../shared/net/Protocol.js';

const camoMats = new Map();
let shared = null;
function sharedMats(tex) {
  if (shared) return shared;
  shared = {
    skin: new THREE.MeshStandardMaterial({ map: tex.skin.map, color: new THREE.Color(0.85, 0.7, 0.6), roughness: 0.6 }),
    glove: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.06, 0.06, 0.05), roughness: 0.8 }),
    boot: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.07, 0.06, 0.05), roughness: 0.7 }),
    vest: [null, new THREE.MeshStandardMaterial({ color: 0x4a4a3c, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0x2e3326, roughness: 0.85 }), new THREE.MeshStandardMaterial({ color: 0x1d1f1c, roughness: 0.75, metalness: 0.1 })],
    helmet: [null, new THREE.MeshStandardMaterial({ color: 0x4b5240, roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: 0x3a4032, roughness: 0.6 }), new THREE.MeshStandardMaterial({ color: 0x2b2d2b, roughness: 0.5, metalness: 0.2 })],
    covers: {
      netting: new THREE.MeshStandardMaterial({ color: 0x3b3a2a, roughness: 1, wireframe: true }),
      mesh: new THREE.MeshStandardMaterial({ color: 0x2f3427, roughness: 1, wireframe: true }),
      scrim: new THREE.MeshStandardMaterial({ color: 0x5a5236, roughness: 1 }),
      painted: new THREE.MeshStandardMaterial({ color: 0x6b6040, roughness: 0.8 }),
      tan: new THREE.MeshStandardMaterial({ color: 0x8f7a55, roughness: 0.9 }),
      ridge: new THREE.MeshStandardMaterial({ color: 0x3d4247, roughness: 0.4, metalness: 0.6 }),
      warpaint: new THREE.MeshStandardMaterial({ color: 0x5a1e14, roughness: 0.7 }),
    },
    pack: new THREE.MeshStandardMaterial({ map: tex.cloth.map, color: new THREE.Color(0.75, 0.72, 0.6), roughness: 0.95 }),
    chute: new THREE.MeshStandardMaterial({ map: tex.cloth.map, color: new THREE.Color(0.55, 0.55, 0.42), roughness: 0.95, side: THREE.DoubleSide }),
    line: new THREE.LineBasicMaterial({ color: 0x222222 }),
    far: new THREE.MeshStandardMaterial({ color: 0x3d4030, roughness: 0.9 }),
  };
  return shared;
}
function camoMat(id) {
  if (camoMats.has(id)) return camoMats.get(id);
  const c = CAMOS.find(x => x.id === id) || CAMOS[0];
  const m = new THREE.MeshStandardMaterial({ map: camoTexture(c.id, c.c), roughness: 0.92 });
  camoMats.set(id, m);
  return m;
}

const geo = {};
function cap(r, l) { const k = `cap${r},${l}`; return geo[k] || (geo[k] = new THREE.CapsuleGeometry(r, l, 6, 12)); }
function bx(w, h, d) { const k = `bx${w},${h},${d}`; return geo[k] || (geo[k] = new THREE.BoxGeometry(w, h, d)); }

export class Character {
  constructor(tex, cos = {}, opts = {}) {
    const S = sharedMats(tex);
    this.S = S;
    this.cos = cos;
    const camo = camoMat(cos.camo || 'olive');
    this.root = new THREE.Group();
    this.body = new THREE.Group();          // rotated as a whole for prone/freefall
    this.root.add(this.body);
    this.hips = new THREE.Group(); this.hips.position.y = 0.95; this.body.add(this.hips);
    const pelvis = new THREE.Mesh(bx(0.32, 0.18, 0.2), camo); this.hips.add(pelvis);
    this.spine = new THREE.Group(); this.spine.position.y = 0.08; this.hips.add(this.spine);
    const chest = new THREE.Mesh(cap(0.17, 0.32), camo); chest.position.y = 0.3; chest.scale.set(1.12, 1, 0.75); this.spine.add(chest);
    this.vest = new THREE.Mesh(bx(0.38, 0.4, 0.27), S.vest[1]); this.vest.position.set(0, 0.32, 0); this.spine.add(this.vest);
    this.pouches = new THREE.Mesh(bx(0.3, 0.1, 0.06), S.vest[1]); this.pouches.position.set(0, 0.2, -0.16); this.spine.add(this.pouches);
    this.pack = new THREE.Mesh(bx(0.32, 0.4, 0.18), S.pack); this.pack.position.set(0, 0.36, 0.22); this.spine.add(this.pack);
    const ant = new THREE.Mesh(geo.ant || (geo.ant = new THREE.CylinderGeometry(0.006, 0.008, 0.55, 4)), S.boot); ant.position.set(0.12, 0.42, 0.02); this.pack.add(ant);
    const roll = new THREE.Mesh(geo.roll || (geo.roll = new THREE.CylinderGeometry(0.07, 0.07, 0.34, 8)), S.pack); roll.rotation.z = Math.PI / 2; roll.position.set(0, 0.24, 0.0); this.pack.add(roll);
    for (let i = -1; i <= 1; i++) { const m = new THREE.Mesh(bx(0.075, 0.12, 0.05), S.vest[2]); m.position.set(i * 0.09, 0.23, -0.16); this.spine.add(m); m.userData.pouch = true; }
    const strapG = bx(0.05, 0.42, 0.3);
    for (const sx of [-1, 1]) { const st = new THREE.Mesh(strapG, S.boot); st.position.set(sx * 0.13, 0.42, 0.0); this.spine.add(st); }
    const belt = new THREE.Mesh(bx(0.35, 0.07, 0.23), S.boot); belt.position.set(0, 0.06, 0); this.hips.add(belt);
    const holster = new THREE.Mesh(bx(0.06, 0.16, 0.1), S.boot); holster.position.set(0.19, -0.05, 0.02); this.hips.add(holster);
    this.neck = new THREE.Group(); this.neck.position.y = 0.6; this.spine.add(this.neck);
    const head = new THREE.Mesh(geo.head || (geo.head = new THREE.SphereGeometry(0.115, 14, 10)), S.skin); head.scale.set(0.9, 1.1, 1); head.position.y = 0.12; this.neck.add(head);
    const balaclava = new THREE.Mesh(geo.bala || (geo.bala = new THREE.SphereGeometry(0.118, 12, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45)), camo); balaclava.position.y = 0.12; this.neck.add(balaclava);
    this.helmet = new THREE.Mesh(geo.helm || (geo.helm = new THREE.SphereGeometry(0.145, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)), S.helmet[1]); this.helmet.position.set(0, 0.15, 0.01); this.neck.add(this.helmet);
    const gog = new THREE.Mesh(bx(0.17, 0.045, 0.05), new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 0.15, metalness: 0.6 })); gog.position.set(0, 0.035, -0.115); gog.rotation.x = -0.35; this.helmet.add(gog);
    const strap = new THREE.Mesh(bx(0.3, 0.02, 0.02), S.boot); strap.position.set(0, -0.06, 0.0); this.helmet.add(strap);
    const cover = S.covers[cos.helmet];
    this.cover = cover ? new THREE.Mesh(geo.helm, cover) : null;
    if (this.cover) { this.cover.scale.setScalar(1.04); this.helmet.add(this.cover); }
    // arms
    const arm = (side) => {
      const sh = new THREE.Group(); sh.position.set(0.22 * side, 0.5, 0); this.spine.add(sh);
      const up = new THREE.Mesh(cap(0.055, 0.22), camo); up.position.y = -0.14; sh.add(up);
      const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
      const fo = new THREE.Mesh(cap(0.05, 0.2), camo); fo.position.y = -0.13; el.add(fo);
      const hand = new THREE.Mesh(bx(0.07, 0.09, 0.04), S.glove); hand.position.y = -0.28; el.add(hand);
      return { sh, el };
    };
    this.armR = arm(1); this.armL = arm(-1);
    const leg = (side) => {
      const hip = new THREE.Group(); hip.position.set(0.1 * side, -0.04, 0); this.hips.add(hip);
      const th = new THREE.Mesh(cap(0.075, 0.3), camo); th.position.y = -0.21; hip.add(th);
      const kn = new THREE.Group(); kn.position.y = -0.44; hip.add(kn);
      const sh = new THREE.Mesh(cap(0.065, 0.3), camo); sh.position.y = -0.2; kn.add(sh);
      const boot = new THREE.Mesh(bx(0.1, 0.1, 0.24), S.boot); boot.position.set(0, -0.42, -0.05); kn.add(boot);
      const pad = new THREE.Mesh(bx(0.12, 0.13, 0.05), S.boot); pad.position.set(0, -0.05, -0.07); kn.add(pad);
      return { hip, kn };
    };
    this.legR = leg(1); this.legL = leg(-1);
    // weapon socket in front of the chest, follows aim pitch
    this.socket = new THREE.Group(); this.socket.position.set(0.12, 0.36, -0.28); this.spine.add(this.socket);
    this.weaponId = null; this.weapon = null;
    // parachute
    this.chute = this.buildChute(S); this.chute.visible = false; this.root.add(this.chute);
    // far LOD
    this.far = new THREE.Mesh(cap(0.3, 1.1), S.far); this.far.position.y = 0.85; this.far.visible = false; this.root.add(this.far);
    this.phase = 0; this.recoil = 0; this.lastPos = null; this.speed = 0;
    this.crouchT = 0; this.gear = -1; this.flinchT = 0; this.flinchAmt = 0; this.deadT = -1; this.deadDir = 1;
    this.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.setGear(0x15);
  }

  buildChute(S) {
    const g = new THREE.Group();
    const canopyGeo = new THREE.SphereGeometry(4.2, 18, 6, 0, Math.PI * 2, 0, Math.PI * 0.32);
    canopyGeo.scale(1, 0.55, 0.7);
    const canopy = new THREE.Mesh(canopyGeo, S.chute);
    canopy.position.y = 4.4;
    g.add(canopy);
    const pts = [];
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; pts.push(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(Math.cos(a) * 3.3, 4.6, Math.sin(a) * 2.2)); }
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), S.line));
    return g;
  }

  flinch(a = 0.6) { this.flinchT = 0.22; this.flinchAmt = a; }
  die(head = 0) { this.deadT = 0; this.deadDir = head ? -1 : (Math.random() < 0.5 ? 1 : -1); this.deadSpin = (Math.random() - 0.5) * 0.8; }

  setGear(gear) {
    if (gear === this.gear) return;
    this.gear = gear;
    const h = gear & 3, v = (gear >> 2) & 3, p = (gear >> 4) & 3;
    this.helmet.visible = h > 0; if (h) this.helmet.material = this.S.helmet[h];
    this.vest.visible = v > 0; this.pouches.visible = v > 1; if (v) { this.vest.material = this.S.vest[v]; this.pouches.material = this.S.vest[v]; }
    this.pack.visible = p > 0; if (p) { this.pack.scale.set(1, 0.75 + p * 0.25, 0.8 + p * 0.25); this.pack.position.z = 0.18 + p * 0.03; }
  }

  setWeapon(wire) {
    const id = typeof wire === 'number' ? weaponFromWire(wire) : wire;
    if (id === this.weaponId) return;
    this.weaponId = id;
    if (this.weapon) { this.socket.remove(this.weapon); }
    this.weapon = null;
    if (!id) return;
    this.weapon = id === 'throw' ? buildGrenade('frag') : buildWeapon(id, this.cos.finish);
    this.weapon.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.socket.add(this.weapon);
  }

  // st: { x,y,z,yaw,pitch,mode,flags } interpolated; dt seconds; dist from camera
  update(st, dt, dist) {
    const root = this.root;
    root.position.set(st.x, st.y, st.z);
    root.rotation.y = st.yaw;
    const far = dist > 150;
    this.far.visible = far && st.mode !== MODE.CHUTE && st.mode !== MODE.FREEFALL;
    this.body.visible = !this.far.visible;
    if (far && this.far.visible) return;
    // speed estimate
    if (this.lastPos) { const d = Math.hypot(st.x - this.lastPos.x, st.z - this.lastPos.z); this.speed += (Math.min(9, d / Math.max(dt, 1e-3)) - this.speed) * Math.min(1, dt * 10); }
    this.lastPos = { x: st.x, z: st.z };
    const crouch = !!(st.flags & 1), ads = !!(st.flags & 2), sprint = !!(st.flags & 4), reload = !!(st.flags & 8), heal = !!(st.flags & 16), busy = !!(st.flags & 32);
    if (st.flags & 64) this.recoil = Math.min(1, this.recoil + dt * 25);
    this.recoil = Math.max(0, this.recoil - dt * 8);
    this.crouchT += ((crouch ? 1 : 0) - this.crouchT) * Math.min(1, dt * 10);
    this.chute.visible = st.mode === MODE.CHUTE;
    const b = this.body;
    b.rotation.set(0, 0, 0); b.position.set(0, 0, 0);
    const sp = this.speed;
    this.phase += dt * (2 + sp * 1.5);
    const sw = Math.sin(this.phase), cw = Math.cos(this.phase);
    const walkAmp = Math.min(1, sp / 5) * (sprint ? 1.15 : 0.75);
    const c = this.crouchT;
    let pitch = st.pitch;
    // defaults: standing, weapon raised
    this.hips.position.y = 0.95 - c * 0.38 - Math.abs(cw) * 0.03 * walkAmp;
    this.spine.rotation.set(-(c * 0.25 + (sprint ? 0.25 : 0)), 0, 0);
    this.neck.rotation.set(pitch * 0.4 + c * 0.2, 0, 0);
    this.legR.hip.rotation.set(sw * 0.7 * walkAmp + c * 1.25, 0, 0);
    this.legL.hip.rotation.set(-sw * 0.7 * walkAmp + c * 0.6, 0, 0);
    this.legR.kn.rotation.set(-(Math.max(0, -cw) * 0.9 * walkAmp + c * 1.9), 0, 0);
    this.legL.kn.rotation.set(-(Math.max(0, cw) * 0.9 * walkAmp + c * 1.5), 0, 0);
    // arms hold the weapon: aim follows pitch
    const aim = sprint ? -0.5 : pitch * 0.6;
    this.socket.rotation.set((sprint ? -0.7 : pitch * 0.9) + this.recoil * 0.12, sprint ? 0.6 : 0, 0);
    this.socket.position.set(ads ? 0.04 : 0.12, 0.36 + (ads ? 0.08 : 0), -0.28 + this.recoil * 0.04);
    this.armR.sh.rotation.set(1.0 + aim, 0, -0.25); this.armR.el.rotation.set(1.0, 0, 0);
    this.armL.sh.rotation.set(1.35 + aim, 0, 0.6); this.armL.el.rotation.set(0.45, 0, 0);
    if (reload) { this.armL.sh.rotation.x = 0.6 + Math.sin(this.phase * 3) * 0.3; this.socket.rotation.z = 0.5; }
    if (heal || busy) { this.armL.sh.rotation.set(0.8, 0, 0.2); this.armR.sh.rotation.set(0.7, 0, -0.2); this.socket.rotation.x = -1.0; }
    if (!this.weaponId) { this.armR.sh.rotation.set(sw * 0.6 * walkAmp, 0, 0.1); this.armL.sh.rotation.set(-sw * 0.6 * walkAmp, 0, -0.1); this.armR.el.rotation.x = 0.3; this.armL.el.rotation.x = 0.3; }
    if (this.weapon) this.weapon.visible = true;

    if (this.flinchT > 0) {
      this.flinchT -= dt;
      const f = Math.sin((this.flinchT / 0.22) * Math.PI) * this.flinchAmt;
      this.spine.rotation.x += f * 0.35; this.neck.rotation.x += f * 0.4; this.spine.rotation.z += f * 0.15;
    }
    if (st.mode === MODE.DEAD && this.deadT >= 0) {
      this.deadT += dt;
      const t = Math.min(1, this.deadT / 0.75), e = t * t;
      b.rotation.set(-this.deadDir * 1.5 * e, this.deadSpin * e, 0);
      b.position.set(0, 0.12 * e, this.deadDir * 0.35 * e);
      this.hips.position.y = 0.95 - 0.1 * e;
      this.spine.rotation.set(-this.deadDir * 0.2 * e, 0, 0.2 * e);
      this.neck.rotation.set(this.deadDir * 0.6 * e, 0.4 * e, 0);
      this.armR.sh.rotation.set(0.4 + 1.6 * e, 0, -0.9 * e); this.armR.el.rotation.x = 0.3;
      this.armL.sh.rotation.set(0.2 + 1.2 * e, 0, 1.1 * e); this.armL.el.rotation.x = 0.6 * e;
      this.legR.hip.rotation.set(0.25 * e, 0, 0.15 * e); this.legL.hip.rotation.set(-0.1 * e, 0, -0.2 * e);
      this.legR.kn.rotation.x = -0.5 * e; this.legL.kn.rotation.x = -0.2 * e;
      if (this.weapon) this.weapon.visible = t < 0.4;
      this.chute.visible = false;
      return;
    }
    if (st.mode === MODE.VEHICLE) {
      root.rotation.order = 'YXZ';
      root.rotation.set(st.vpitch || 0, st.yaw, st.vroll || 0);
      this.hips.position.y = 0.12;
      this.spine.rotation.set(0.12, 0, 0);
      this.legR.hip.rotation.set(1.45, 0, 0.08); this.legL.hip.rotation.set(1.45, 0, -0.08);
      this.legR.kn.rotation.x = -1.35; this.legL.kn.rotation.x = -1.35;
      if (st.driver) {
        this.armR.sh.rotation.set(1.1, 0, -0.15); this.armR.el.rotation.x = 0.7;
        this.armL.sh.rotation.set(1.1, 0, 0.15); this.armL.el.rotation.x = 0.7;
        if (this.weapon) this.weapon.visible = false;
      }
      this.chute.visible = false;
      return;
    }
    root.rotation.order = 'XYZ'; root.rotation.x = 0; root.rotation.z = 0;
    switch (st.mode) {
      case MODE.KNOCKED: {
        b.rotation.x = -1.35; b.position.set(0, 0.3, 0.55);
        this.hips.position.y = 0.95;
        this.spine.rotation.x = 0;
        this.neck.rotation.x = 0.9;
        this.armR.sh.rotation.set(2.6 + sw * 0.5 * Math.min(1, sp), 0, -0.3); this.armR.el.rotation.x = 0.4;
        this.armL.sh.rotation.set(2.6 - sw * 0.5 * Math.min(1, sp), 0, 0.3); this.armL.el.rotation.x = 0.4;
        this.legR.hip.rotation.x = -0.1 + sw * 0.2 * Math.min(1, sp); this.legL.hip.rotation.x = -0.1 - sw * 0.2 * Math.min(1, sp);
        this.legR.kn.rotation.x = -0.4; this.legL.kn.rotation.x = -0.3;
        if (this.weapon) this.weapon.visible = false;
        break;
      }
      case MODE.FREEFALL: {
        b.rotation.x = -1.3 - pitch * 0.2; b.position.y = 0.9;
        this.armR.sh.rotation.set(1.4, 0, 1.1); this.armL.sh.rotation.set(1.4, 0, -1.1);
        this.armR.el.rotation.x = 0.5; this.armL.el.rotation.x = 0.5;
        this.legR.hip.rotation.set(-0.15, 0, 0.3); this.legL.hip.rotation.set(-0.15, 0, -0.3);
        this.legR.kn.rotation.x = -0.7; this.legL.kn.rotation.x = -0.7;
        if (this.weapon) this.weapon.visible = false;
        break;
      }
      case MODE.CHUTE: {
        this.armR.sh.rotation.set(2.9, 0, 0.3); this.armL.sh.rotation.set(2.9, 0, -0.3);
        this.armR.el.rotation.x = 0.2; this.armL.el.rotation.x = 0.2;
        this.legR.hip.rotation.set(0.15 + Math.sin(this.phase * 0.5) * 0.1, 0, 0); this.legL.hip.rotation.set(0.1, 0, 0);
        this.legR.kn.rotation.x = -0.3; this.legL.kn.rotation.x = -0.35;
        if (this.weapon) this.weapon.visible = false;
        break;
      }
    }
  }

  dispose() { this.root.removeFromParent(); }
}
