// The Remainder: procedural rig built from primitives, animated with analytic IK.
// Signature traits: a concave skin dish instead of a head that turns toward what it hears, and
// stop-motion movement (pose + position committed at ~9 fps outside of chases).
import * as THREE from 'three';

function capsule(r, len, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
  m.position.y = -len / 2 - r * 0.2;
  m.castShadow = true;
  return m;
}

export class RemainderBody {
  constructor(mats) {
    const skin = mats.prop('skin');
    const dark = mats.prop('skinDark');
    this.root = new THREE.Group();
    this.root.name = 'remainder';
    this.hips = new THREE.Group();
    this.hips.position.y = 1.1;
    this.root.add(this.hips);

    // Pelvis + spine
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), skin);
    pelvis.scale.set(1.2, 0.75, 0.8); this.hips.add(pelvis);
    this.spine = new THREE.Group(); this.hips.add(this.spine);
    const s1 = capsule(0.085, 0.35, skin); s1.position.y = 0.2; s1.rotation.z = Math.PI; this.spine.add(s1);
    this.chest = new THREE.Group(); this.chest.position.y = 0.42; this.spine.add(this.chest);
    const ribs = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), skin);
    ribs.scale.set(0.95, 1.35, 0.6); ribs.position.y = 0.12; ribs.castShadow = true; this.chest.add(ribs);
    for (let k = 0; k < 5; k++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.17 - k * 0.012, 0.012, 5, 16, Math.PI), skin); rib.rotation.set(Math.PI / 2, 0, 0); rib.position.set(0, 0.02 + k * 0.06, 0.05); rib.scale.set(1.15, 1, 1); this.chest.add(rib); }

    // Neck: three segments
    this.neck = [];
    let parent = this.chest;
    let y = 0.32;
    for (let k = 0; k < 3; k++) {
      const n = new THREE.Group(); n.position.y = y; parent.add(n);
      const seg = capsule(0.045 - k * 0.006, 0.15, skin); seg.position.y = 0.09; seg.rotation.z = Math.PI; n.add(seg);
      this.neck.push(n); parent = n; y = 0.19;
    }
    // Dish head
    this.dish = new THREE.Group(); this.dish.position.y = 0.2; parent.add(this.dish);
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const r = 0.02 + t * 0.44;
      const yy = Math.pow(t, 2.0) * 0.26 + Math.sin(t * Math.PI * 5) * 0.008 * t;
      pts.push(new THREE.Vector2(r, yy));
    }
    const dishGeo = new THREE.LatheGeometry(pts, 36);
    const outer = new THREE.Mesh(dishGeo, skin); outer.castShadow = true;
    const innerMat = skin.clone(); innerMat.side = THREE.BackSide; innerMat.color.setHex(0x4e3c38); innerMat.roughness = 0.22;
    innerMat.onBeforeCompile = skin.onBeforeCompile; innerMat.customProgramCacheKey = skin.customProgramCacheKey;
    const inner = new THREE.Mesh(dishGeo, innerMat); inner.scale.setScalar(0.985); inner.position.y = 0.004;
    const dishPivot = new THREE.Group(); dishPivot.rotation.x = Math.PI / 2; // dish opens toward +z
    dishPivot.add(outer, inner);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.045, 16), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    hole.rotation.x = -Math.PI / 2; hole.position.y = 0.005; dishPivot.add(hole);
    dishPivot.position.z = -0.05;
    this.dish.add(dishPivot);
    this.dishPivot = dishPivot;

    // Arms
    this.arms = [];
    for (const side of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(side * 0.24, 0.24, 0); this.chest.add(sh);
      const upper = capsule(0.034, 0.6, skin); sh.add(upper);
      const elbow = new THREE.Group(); elbow.position.y = -0.68; sh.add(elbow);
      const fore = capsule(0.027, 0.62, skin); elbow.add(fore);
      const wrist = new THREE.Group(); wrist.position.y = -0.7; elbow.add(wrist);
      for (let f = 0; f < 4; f++) {
        const fing = capsule(0.007, 0.28 + (f === 1 || f === 2 ? 0.07 : 0), skin);
        const fg = new THREE.Group(); fg.position.set((f - 1.5) * 0.022, 0, 0); fg.rotation.z = (f - 1.5) * 0.08; fg.add(fing);
        wrist.add(fg);
      }
      this.arms.push({ side, sh, elbow, wrist });
    }
    // Legs
    this.legs = [];
    for (const side of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(side * 0.11, -0.04, 0); this.hips.add(hip);
      const thigh = capsule(0.045, 0.5, skin); hip.add(thigh);
      const knee = new THREE.Group(); knee.position.y = -0.6; hip.add(knee);
      const shin = capsule(0.032, 0.5, skin); knee.add(shin);
      const ankle = new THREE.Group(); ankle.position.y = -0.6; knee.add(ankle);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.22), skin); foot.position.set(0, -0.02, 0.06); foot.castShadow = true; ankle.add(foot);
      this.legs.push({ side, hip, knee, ankle });
    }
    this.L1 = 0.6; this.L2 = 0.6;
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    this.phase = 0;
    this.hunch = 0.35;
    this.tremble = 0;
    this.mode = 'walk'; // walk | stand | ceiling | crawl
    this.dishTarget = new THREE.Vector3();
    this.reach = 0;
  }

  // Analytic 2-bone IK in the sagittal plane. Foot target relative to hip: (fz forward, fy down).
  solveLeg(leg, fz, fy) {
    const d = Math.min(this.L1 + this.L2 - 0.001, Math.hypot(fz, fy));
    const a = Math.acos(Math.max(-1, Math.min(1, (this.L1 * this.L1 + d * d - this.L2 * this.L2) / (2 * this.L1 * d))));
    const base = Math.atan2(fz, fy); // angle from straight down toward +z
    leg.hip.rotation.x = -(base + a);
    const k = Math.acos(Math.max(-1, Math.min(1, (this.L1 * this.L1 + this.L2 * this.L2 - d * d) / (2 * this.L1 * this.L2))));
    leg.knee.rotation.x = Math.PI - k;
    leg.ankle.rotation.x = -(leg.hip.rotation.x + leg.knee.rotation.x) * 0.8;
  }

  // Pose the rig. speed m/s; dt seconds of motion since last pose; worldDish: world point to face.
  pose(dt, speed, opts = {}) {
    const stride = 1.1 + speed * 0.12;
    this.phase += (speed * dt) / stride * Math.PI;
    const ph = this.phase;
    const run = Math.min(1, Math.max(0, (speed - 2) / 2));
    const hunch = (opts.hunch ?? 0.5) + run * 0.45;
    this.hunch += (hunch - this.hunch) * Math.min(1, dt * 4 + 0.15);
    const moving = speed > 0.1;
    this.hips.position.y = 1.08 - run * 0.22 - (moving ? Math.abs(Math.sin(ph)) * 0.04 : 0) - (opts.crouch || 0) * 0.45;
    this.spine.rotation.x = this.hunch;
    this.spine.rotation.z = moving ? Math.sin(ph) * 0.06 : Math.sin(opts.t * 0.7) * 0.02;
    this.chest.rotation.x = this.hunch * 0.4;
    const hipH = this.hips.position.y - 0.04;
    for (const leg of this.legs) {
      const p = ph + (leg.side > 0 ? Math.PI : 0);
      const fz = moving ? Math.sin(p) * stride * 0.32 : 0.05 * leg.side;
      const lift = moving ? Math.max(0, Math.cos(p)) * (0.12 + run * 0.15) : 0;
      this.solveLeg(leg, fz - this.hunch * 0.05, hipH - lift - 0.02);
      leg.hip.rotation.z = leg.side * 0.04;
    }
    for (const arm of this.arms) {
      const p = ph + (arm.side > 0 ? 0 : Math.PI);
      const swing = moving ? Math.sin(p) * (0.25 + run * 0.3) : Math.sin(opts.t * 1.3 + arm.side) * 0.03;
      const reach = this.reach;
      arm.sh.rotation.x = -this.hunch * 0.9 + swing - reach * 1.2;
      arm.sh.rotation.z = arm.side * (0.16 + reach * 0.2);
      arm.elbow.rotation.x = -0.15 - reach * 0.3 - Math.max(0, swing) * 0.3;
      arm.wrist.rotation.x = -0.2;
    }
    // Neck curls forward and up so the dish faces the target.
    const t = opts.t || 0;
    for (let k = 0; k < this.neck.length; k++) this.neck[k].rotation.x = (k === 0 ? 0.55 : -0.35) - this.hunch * 0.25 * (k === 0 ? 1 : -0.6);
    // Dish: aim at the world target in the root's local frame.
    if (opts.dishLocal) {
      const { yaw, pitch } = opts.dishLocal;
      this.dish.rotation.set(-pitch * 0.8 - 0.3, yaw, 0.38 + Math.sin(t * 0.37) * 0.08);
    }
    this.tremble += ((opts.listening ? 1 : 0) - this.tremble) * 0.2;
    this.dishPivot.rotation.z = this.tremble * Math.sin(t * 61) * 0.06;
    this.dishPivot.rotation.y = this.tremble * Math.sin(t * 47) * 0.04;
  }

  poseCeiling(t) {
    this.hips.position.y = 1.0;
    this.spine.rotation.x = 1.3; this.chest.rotation.x = 0.2;
    for (const leg of this.legs) { leg.hip.rotation.set(-1.2, 0, leg.side * 0.7); leg.knee.rotation.x = 1.8; }
    for (const arm of this.arms) { arm.sh.rotation.set(-2.4, 0, arm.side * 0.9); arm.elbow.rotation.x = -0.9; }
    this.dish.rotation.set(-0.9 + Math.sin(t * 0.8) * 0.1, Math.sin(t * 0.5) * 0.3, 0);
  }
}

// A light-weight clone used only for the mirror (layer 2).
export function makeMirrorGhost(mats) {
  const b = new RemainderBody(mats);
  b.pose(0, 0, { t: 0, hunch: 0.5 });
  b.root.traverse((o) => o.layers.set(2));
  return b;
}
