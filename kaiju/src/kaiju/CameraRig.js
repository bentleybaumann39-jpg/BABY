// Third-person camera for something 60 m tall: orbit with mouse/stick, heavy smoothing,
// pull-in when a tower blocks the view, trauma-based shake and a few cinematic modes.
import * as THREE from 'three';
import { clamp, damp, dampAngle } from '../core/Rng.js';

const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _d = new THREE.Vector3();

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.yaw = Math.PI;      // behind a kaiju facing +z
    this.pitch = 0.22;
    this.dist = 1;           // multiplier of the kaiju's preferred distance
    this.zoom = 1;
    this.curDist = 150;
    this.target = new THREE.Vector3();
    this.trauma = 0;
    this.shakeT = 0;
    this.fovBase = 55;
    this.fovKick = 0;
    this.mode = 'follow';
    this.cine = null;
    this.aim = new THREE.Vector3();
    this.reduced = false;
    this.shakeScale = 1;
    this.aiming = false;
    this.aimBlend = 0;
  }

  addTrauma(a) { this.trauma = Math.min(1, this.trauma + a * this.shakeScale); }

  // Distance-attenuated shake from an event at p with strength s (0..1) and radius r.
  impulse(p, s, r) {
    const d = this.cam.position.distanceTo(p);
    this.addTrauma(s * Math.max(0, 1 - d / r));
  }

  update(dt, k, look, zoomSteps, world) {
    if (this.mode === 'cine' && this.cine) { this._cine(dt); return; }
    this.yaw -= look.x;
    this.pitch = clamp(this.pitch + look.y, -0.25, 1.15);
    this.zoom = clamp(this.zoom + zoomSteps * 0.08, 0.55, 1.8);
    const H = k.height;
    // aiming: pull in over the right shoulder so the crosshair ray clears the head
    this.aimBlend = damp(this.aimBlend, this.aiming ? 1 : 0, 5, dt);
    const ab = this.aimBlend;
    const want = H * 2.35 * this.zoom * (1 - 0.3 * ab) * (1 + 0.12 * Math.min(1, k.speed / Math.max(1, k.runSpeed)));
    _t.copy(k.pos);
    _t.y += H * (0.78 + 0.3 * ab);
    _t.x += Math.cos(this.yaw) * H * 0.45 * ab;
    _t.z -= Math.sin(this.yaw) * H * 0.45 * ab;
    // lead the target a little in the direction of travel
    _t.addScaledVector(k.vel, 0.35);
    this.target.x = damp(this.target.x, _t.x, 6, dt);
    this.target.y = damp(this.target.y, _t.y, 4, dt);
    this.target.z = damp(this.target.z, _t.z, 6, dt);
    // camera direction from yaw/pitch; if rooftops block the view, swing up over them
    // before resorting to pulling in
    const clear = (pitch, dist) => {
      _d.set(Math.sin(this.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch));
      for (let i = 2; i <= 12; i++) {
        const s = (i / 12) * dist;
        _v.copy(this.target).addScaledVector(_d, s);
        if (_v.y < world.solidHeightAt(_v.x, _v.z) + 6) return s;
      }
      return -1;
    };
    let pitchFix = this.pitch, allowed = want;
    let hitAt = clear(this.pitch, want);
    if (hitAt >= 0) {
      let ok = false;
      for (let p = this.pitch + 0.08; p <= 1.38; p += 0.08) { if (clear(p, want) < 0) { pitchFix = p; ok = true; break; } }
      // boxed in on every side: stay high and far enough to frame the whole body and let the
      // building cutaway clear the line of sight, rather than diving into the kaiju
      if (!ok) { pitchFix = 1.0; allowed = Math.max(H * 1.3, (k.radius || H * 0.5) * 1.6, hitAt - want / 12); }
    }
    this.pitchEff = damp(this.pitchEff ?? this.pitch, pitchFix, pitchFix > (this.pitchEff ?? 0) ? 6 : 1.5, dt);
    _d.set(Math.sin(this.yaw) * Math.cos(this.pitchEff), Math.sin(this.pitchEff), Math.cos(this.yaw) * Math.cos(this.pitchEff));
    this.curDist = damp(this.curDist, allowed, allowed < this.curDist ? 9 : 2.5, dt);
    _v.copy(this.target).addScaledVector(_d, this.curDist);
    const gy = world.groundAt(_v.x, _v.z);
    _v.y = Math.max(_v.y, Math.max(gy, -1) + 4);
    this.cam.position.copy(_v);
    this.cam.lookAt(this.target);
    this._shake(dt);
    this.fovKick = damp(this.fovKick, k.speed > k.walkSpeed * 1.4 ? 6 : 0, 2, dt);
    const fov = this.fovBase + this.fovKick;
    if (Math.abs(this.cam.fov - fov) > 0.01) { this.cam.fov = fov; this.cam.updateProjectionMatrix(); }
  }

  _shake(dt) {
    this.trauma = Math.max(0, this.trauma - dt * 0.9);
    if (this.trauma <= 0) return;
    this.shakeT += dt;
    const s = this.trauma * this.trauma * (this.reduced ? 0.3 : 1);
    const t = this.shakeT * 22;
    const n = (a) => Math.sin(t * a) * 0.5 + Math.sin(t * a * 2.17 + 1.3) * 0.3 + Math.sin(t * a * 4.3 + 0.4) * 0.2;
    this.cam.rotateZ(n(0.9) * 0.035 * s);
    this.cam.rotateX(n(1.13) * 0.025 * s);
    this.cam.rotateY(n(0.77) * 0.025 * s);
    this.cam.position.y += n(1.31) * 1.2 * s;
  }

  // Scripted shot: { from, to, lookFrom, lookTo, dur, t, fov, done }
  play(shot) { this.mode = 'cine'; this.cine = { t: 0, ...shot }; }
  stopCine() { this.mode = 'follow'; this.cine = null; }

  _cine(dt) {
    const c = this.cine;
    c.t += dt;
    const u = clamp(c.t / c.dur, 0, 1);
    const e = u * u * (3 - 2 * u);
    const from = typeof c.from === 'function' ? c.from() : c.from;
    const to = typeof c.to === 'function' ? c.to() : c.to;
    const lf = typeof c.lookFrom === 'function' ? c.lookFrom() : c.lookFrom;
    const lt = typeof c.lookTo === 'function' ? c.lookTo() : c.lookTo;
    this.cam.position.lerpVectors(from, to, e);
    _t.lerpVectors(lf, lt, e);
    this.cam.lookAt(_t);
    if (c.fov && Math.abs(this.cam.fov - c.fov) > 0.01) { this.cam.fov = c.fov; this.cam.updateProjectionMatrix(); }
    this._shake(dt);
    if (u >= 1 && c.done) { const d = c.done; c.done = null; d(); }
  }

  // World point under the screen centre (for aiming).
  aimPoint(world, maxDist = 1400) {
    this.cam.getWorldDirection(_d);
    const o = this.cam.position;
    // start past the kaiju so the ray does not stop on its own feet
    const s0 = this.curDist * 0.9;
    let last = s0;
    for (let s = s0; s < maxDist; s += 12) {
      _v.copy(o).addScaledVector(_d, s);
      const h = world.solidHeightAt(_v.x, _v.z);
      if (_v.y <= h) {
        // refine
        let a = last, b = s;
        for (let i = 0; i < 5; i++) {
          const m = (a + b) / 2;
          _v.copy(o).addScaledVector(_d, m);
          if (_v.y <= world.solidHeightAt(_v.x, _v.z)) b = m; else a = m;
        }
        return this.aim.copy(o).addScaledVector(_d, b);
      }
      last = s;
    }
    return this.aim.copy(o).addScaledVector(_d, maxDist);
  }
}
