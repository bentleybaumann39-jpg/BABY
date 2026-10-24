// A playable kaiju: the skinned model, layered animation, heavy locomotion, body
// collisions with buildings, attacks sampled from the actual bone paths, and health/energy.
import * as THREE from 'three';
import { clone as skelClone } from '../../vendor/addons/utils/SkeletonUtils.js';
import { patchTree, G } from '../render/Shading.js';
import { MutationRig } from './Mutation.js';
import { FORMS } from '../core/Config.js';
import { clamp, damp, dampAngle, angleDiff, smooth } from '../core/Rng.js';

const LEG_BONES = ['root', 'hips', 'thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR', 'toeL', 'toeR',
  'upperlegL', 'upperlegR', 'lowerlegL', 'lowerlegR', 'pawL', 'pawR'];
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

function filterClip(clip, keep, name) {
  const tracks = clip.tracks.filter((t) => keep(t.name.split('.')[0]));
  return new THREE.AnimationClip(name, clip.duration, tracks);
}

export class Kaiju {
  constructor(id, def, asset, stats, meta, mut = null) {
    this.id = id;
    this.def = def;
    this.stats = stats;
    this.baseStats = { ...stats }; // stats before a Mutation Surge
    this.meta = meta;
    this.root = new THREE.Group();
    this.model = skelClone(asset.scene);
    this.model.scale.setScalar(stats.scale);
    this.root.add(this.model);
    this.scale = stats.scale;
    this.height = (meta.height || 50) * stats.scale;
    // horizontal half-extent: a crab-legged kaiju is far wider than it is tall
    const bb = new THREE.Box3().setFromObject(this.model);
    this.radius = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * 0.5 || this.height * 0.5;
    this.baseRadius = this.radius;
    // private material copies: the menu stage and the game patch shaders differently
    this.model.traverse((o) => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone(); });
    this.mutRig = new MutationRig(this.model, meta, def.asset, def.moves.special.color);
    patchTree(this.model, 'kaiju-' + id, (m) => this.mutRig.hookFor(m));
    const glowCol = mut && mut.form ? this.mutRig.glowOf(mut.form) : def.moves.special.color;
    this.glowMats = [];
    this.veinMats = []; // baked emissive veins/eyes: kept legible whatever the exposure
    this.model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          m.side = THREE.FrontSide;
          if (/plate|vein|glow|shard/.test(m.name)) {
            m.emissive = new THREE.Color(...glowCol);
            m.emissiveIntensity = 0;
            this.glowMats.push(m);
          } else if (m.emissiveMap || (m.emissiveIntensity > 0 && m.emissive && m.emissive.getHex() !== 0)) {
            m.userData.baseEmit = m.emissiveIntensity;
            this.veinMats.push(m);
          }
          if (/skin/.test(m.name)) { m.envMapIntensity = 0.9; }
        }
      }
    });
    // the strain's growths are added after the material scan: they manage their own glow
    this.mutRig.setForm(mut ? mut.form : 'prime');
    this.form = FORMS[mut && mut.form] || FORMS.prime;
    this.surgeAmt = 0;
    this.knock = new THREE.Vector3(); // shove from a rival's blows, metres per second
    this.swing = { hit: new Set(), prev: null, foe: false }; // per-swing hit bookkeeping
    this.bones = {};
    this.model.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });
    // animation layers
    this.mixer = new THREE.AnimationMixer(this.model);
    this.clips = {};
    for (const c of asset.animations) this.clips[c.name] = c;
    // bones locomotion keeps while an action plays: hind legs always, crab legs, and the
    // forelimbs of true quadrupeds (whose attacks come from the head and tail)
    const isLeg = (n) => LEG_BONES.includes(n) || /^(leg\d+(lo)?|foot\d+)[LR]$/.test(n) ||
      (!!def.quadruped && /^(upperarm|forearm|hand)[LR]$/.test(n));
    this.act = {};
    for (const [name, clip] of Object.entries(this.clips)) {
      const a = this.mixer.clipAction(clip);
      a.enabled = true;
      a.setEffectiveWeight(0);
      if (['idle', 'walk', 'run'].includes(name)) { a.play(); }
      this.act[name] = a;
      if (['idle', 'walk', 'run'].includes(name)) {
        const legs = this.mixer.clipAction(filterClip(clip, isLeg, name + '_legs'));
        legs.setEffectiveWeight(0); legs.play();
        this.act[name + '_legs'] = legs;
      } else {
        const up = this.mixer.clipAction(filterClip(clip, (n) => !isLeg(n), name + '_upper'));
        up.setEffectiveWeight(0);
        this.act[name + '_upper'] = up;
      }
    }
    this.act.idle.setEffectiveWeight(1);
    this.locoKeys = new Set(['idle', 'walk', 'run', 'idle_legs', 'walk_legs', 'run_legs']);
    // locomotion state
    this.pos = this.root.position;
    this.yaw = 0;
    this.speed = 0;
    this.turnVel = 0;
    this.vel = new THREE.Vector3();
    this.phase = 0;
    this.prevPhase = 0;
    this.layer = 1; // 1 = full-body locomotion, 0 = legs-only (upper body busy)
    // combat state
    this.hp = stats.hp; this.maxHp = stats.hp;
    this.energy = stats.energy; this.maxEnergy = stats.energy;
    this.rage = 0;
    this.action = null; // { name, t, dur, upper, hitDone, prev: {} }
    this.combo = 0;
    this.queued = null;
    this.special = { on: false, phase: null, t: 0, glow: 0 };
    this.dead = false;
    this.deathT = 0;
    this.hurtT = 0;
    this.aimPitch = 0; this.aimYaw = 0;
    this.groundY = 0;
    this.footPrev = { L: new THREE.Vector3(), R: new THREE.Vector3() };
    this.events = null; // set by the game: footstep, swing, hit, roar, stomp, special...
    this.capsules = [];
    this.sampleCache = new Map();
  }

  get forward() { return _v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  bonePos(name, out = new THREE.Vector3()) {
    const b = this.bones[name];
    if (!b) return out.copy(this.pos).setY(this.pos.y + this.height * 0.5);
    return b.getWorldPosition(out);
  }

  // ------------------------------------------------------------------ actions

  canAct() { return !this.dead && (!this.action || this.action.t > this.action.dur * 0.62) && !this.special.on; }

  play(name, opts = {}) {
    const clip = this.clips[name];
    if (!clip) return false;
    const moving = this.speed > this.walkSpeed * 0.25 && !opts.full;
    const key = moving && this.act[name + '_upper'] ? name + '_upper' : name;
    if (this.action) this._stopAction(0.18);
    const a = this.act[key];
    a.reset();
    a.setLoop(opts.loop ? THREE.LoopRepeat : THREE.LoopOnce, opts.loop ? Infinity : 1);
    a.clampWhenFinished = true;
    a.timeScale = opts.speed || 1;
    a.setEffectiveWeight(1);
    a.fadeIn(opts.fade ?? 0.16);
    a.play();
    this.action = { name, key, a, t: 0, dur: clip.duration / a.timeScale, upper: key !== name, loop: !!opts.loop, hitDone: false, prev: new Map(), opts };
    return true;
  }

  _stopAction(fade = 0.25) {
    if (!this.action) return;
    this.action.a.fadeOut(fade);
    this.action = null;
  }

  // ------------------------------------------------------------------ per frame

  get walkSpeed() { return this.meta.speed.walk * this.scale * this.stats.speed; }
  get runSpeed() { return this.meta.speed.run * this.scale * this.stats.speed; }

  update(dt, ctl, world) {
    // ctl: { moveDir: Vector3 world (unit or 0), sprint, aimPoint }
    const s = this.stats;
    this.hurtT = Math.max(0, this.hurtT - dt);
    if (this.dead) {
      this.deathT += dt;
      this.speed = damp(this.speed, 0, 3, dt);
      this.mixer.update(dt);
      return;
    }
    // ---- locomotion
    const busy = this.action && !this.action.upper && !this.action.loop && this.action.t < this.action.dur * 0.8;
    const slow = this.special.on ? 0.15 : this.action ? (this.action.upper ? 0.55 : 0.12) : 1;
    let target = 0;
    const want = ctl.moveDir;
    if (want.lengthSq() > 0.01 && !busy) {
      target = (ctl.sprint ? this.runSpeed : this.walkSpeed) * Math.min(1, want.length()) * slow;
      const desiredYaw = Math.atan2(want.x, want.z);
      const turnRate = (this.speed > this.walkSpeed * 1.2 ? 0.55 : 0.95) * (this.def.turn || 1);
      const d = angleDiff(this.yaw, desiredYaw);
      const maxTurn = turnRate * dt;
      const turn = clamp(d, -maxTurn, maxTurn);
      this.yaw += turn;
      this.turnVel = turn / dt;
      // slow down while turning hard so the body swings round instead of skating
      target *= 1 - 0.5 * Math.min(1, Math.abs(d) / 1.6);
    } else this.turnVel = damp(this.turnVel, 0, 6, dt);
    if (this.special.on && this.special.kind === 'charge' && this.special.phase !== 'in') target = this.runSpeed * 1.45;
    // wading: deep water drags at the legs
    const depth = -world.groundAt(this.pos.x, this.pos.z);
    if (depth > 0) target *= Math.max(0.45, 1 - depth / (this.height * 0.9));
    const accel = target > this.speed ? 0.85 : 1.6;
    this.speed = damp(this.speed, target, accel, dt);
    if (this.speed < 0.05 && target === 0) this.speed = 0;
    const f = this.forward;
    this.vel.copy(f).multiplyScalar(this.speed);
    this.pos.addScaledVector(this.vel, dt);
    // knockback from a heavy blow slides the whole body and dies away
    if (this.knock.lengthSq() > 0.01) { this.pos.addScaledVector(this.knock, dt); this.knock.multiplyScalar(Math.exp(-2.5 * dt)); }
    // stay inside the playable area
    const B = world.bounds;
    this.pos.x = clamp(this.pos.x, B.x0, B.x1);
    this.pos.z = clamp(this.pos.z, B.z0, B.z1);
    // ground: sea floor slopes away from the seawall
    const gy = world.groundAt(this.pos.x, this.pos.z);
    this.groundY = damp(this.groundY, gy, 3, dt);
    this.pos.y = this.groundY;
    this.root.rotation.y = this.yaw;
    // ---- animation weights
    this._locomotion(dt);
    // ---- action timeline
    if (this.action) {
      const A = this.action;
      A.t += dt;
      if (!A.loop && A.t >= A.dur) {
        const name = A.name;
        this._stopAction(0.3);
        if (this.events && this.events.actionEnd) this.events.actionEnd(this, name);
        if (this.queued) { const q = this.queued; this.queued = null; this.events.request(this, q); }
      }
    }
    this.mixer.update(dt);
    this._postPose(dt, ctl);
    this._secondary(dt);
    this.model.updateMatrixWorld(true);
    // ---- regen
    this.hp = Math.min(this.maxHp, this.hp + s.regen * dt * (this.hurtT > 0 ? 0.2 : 1));
    if (!this.special.on) this.energy = Math.min(this.maxEnergy, this.energy + s.energyRegen * dt);
    // glow plates: charge, sustain, fade
    const g = this.special.glow;
    const ex = Math.max(0.05, G.uExposure.value);
    const glowK = Math.min(1, 0.3 / ex);
    for (const m of this.glowMats) m.emissiveIntensity = g * g * 9 * glowK;
    // veins aim for a fixed on-screen brightness by day and run hotter while the special charges
    this._glowT = (this._glowT || 0) + dt;
    const pulse = 0.88 + 0.12 * Math.sin(this._glowT * 1.6) * Math.sin(this._glowT * 0.37 + 1.1);
    const veinK = Math.max(1, 0.6 / ex) * (1 + 1.5 * g) * pulse;
    for (const m of this.veinMats) m.emissiveIntensity = m.userData.baseEmit * veinK;
    this.mutRig.update(dt, ex, this.surgeAmt);
  }

  // Resize the creature in place (Mutation Surge). Everything that reads scale follows.
  setScale(s) {
    this.model.scale.setScalar(s);
    this.scale = s;
    this.height = (this.meta.height || 50) * s;
    this.radius = this.baseRadius * s / this.baseStats.scale;
  }

  // Blend the surge in or out (a: 0..1): stronger, faster, tougher and bigger.
  applySurge(a, cfg) {
    this.surgeAmt = a;
    const b = this.baseStats, s = this.stats;
    for (const [k, m] of Object.entries(cfg.mul)) s[k] = b[k] * (1 + (m - 1) * a);
    s.armor = Math.min(0.85, b.armor + cfg.armor * a);
    this.setScale(b.scale * (1 + (cfg.scale - 1) * a));
  }

  _locomotion(dt) {
    const v = this.speed;
    const ws = this.walkSpeed, rs = this.runSpeed;
    const moveW = smooth(v / (ws * 0.35));
    const runB = smooth((v - ws * 1.05) / (rs * 0.85 - ws * 1.05));
    const turnShuffle = v < ws * 0.3 ? Math.min(1, Math.abs(this.turnVel) / 0.5) : 0;
    const wIdle = Math.max(0, 1 - Math.max(moveW, turnShuffle * 0.8));
    const wWalk = Math.max(moveW * (1 - runB), turnShuffle * 0.8 * (1 - moveW));
    const wRun = moveW * runB;
    // cycle distance blend -> cadence; both clips share one normalised phase
    const cw = this.meta.cycle.walk * this.scale * this.stats.speed;
    const cr = this.meta.cycle.run * this.scale * this.stats.speed;
    const D = cw + (cr - cw) * runB;
    const freq = Math.max(v, turnShuffle * ws * 0.35) / D;
    this.prevPhase = this.phase;
    this.phase = (this.phase + freq * dt) % 1;
    // attack layers: full-body actions take weight from locomotion; upper-body actions move
    // locomotion onto the legs-only clips so the arms and spine are free
    let fw = 0, uw = 0;
    for (const [k, a] of Object.entries(this.act)) {
      if (this.locoKeys.has(k) || !a.isRunning()) continue;
      const w = a.getEffectiveWeight();
      if (k.endsWith('_upper')) uw += w; else fw += w;
    }
    const L = 1 - Math.min(1, uw);
    const loco = Math.max(0, 1 - fw);
    this.layer = L;
    for (const [n, w] of [['idle', wIdle], ['walk', wWalk], ['run', wRun]]) {
      this.act[n].setEffectiveWeight(w * L * loco);
      this.act[n + '_legs'].setEffectiveWeight(w * (1 - L) * loco);
    }
    for (const n of ['walk', 'run']) {
      for (const k of [n, n + '_legs']) {
        const a = this.act[k];
        a.timeScale = 0;
        a.time = this.phase * a.getClip().duration;
      }
    }
    // footsteps at the contact phases
    if (wWalk + wRun > 0.25) {
      const fp = Array.isArray(this.meta.foot_phase) ? this.meta.foot_phase : (this.meta.foot_phase && this.meta.foot_phase.walk) || [0, 0.5];
      const sides = this.meta.feet || ['toeL', 'toeR'];
      for (let i = 0; i < fp.length; i++) {
        const c = fp[i];
        const crossed = this.prevPhase <= this.phase ? (this.prevPhase < c && this.phase >= c) : (this.prevPhase < c || this.phase >= c);
        if (crossed && this.events && this.events.footstep) this.events.footstep(this, sides[i % sides.length], Math.min(1, v / rs + 0.35));
      }
    }
  }

  // Head/neck look toward the aim point after the clip pose is applied.
  _postPose(dt, ctl) {
    const want = this.special.on || (ctl.aimPoint && ctl.aiming);
    let tp = 0, ty = 0;
    if (want && ctl.aimPoint) {
      this.model.updateMatrixWorld(true);
      const head = this.bonePos(this.meta.aim?.head || 'head', _v2);
      const d = _v.copy(ctl.aimPoint).sub(head);
      const flat = Math.hypot(d.x, d.z);
      tp = clamp(Math.atan2(-d.y, flat) - (this.meta.aim?.pitch0 || 0), -0.7, 0.6);
      ty = clamp(angleDiff(this.yaw, Math.atan2(d.x, d.z)), -0.8, 0.8);
    }
    this.aimPitch = damp(this.aimPitch, tp, 6, dt);
    this.aimYaw = damp(this.aimYaw, ty, 6, dt);
    if (Math.abs(this.aimPitch) + Math.abs(this.aimYaw) < 1e-4) return;
    const chain = this.meta.aim?.chain || ['neck1', 'neck2', 'head'];
    const share = 1 / chain.length;
    this.model.updateMatrixWorld(true);
    const right = _v.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    for (const n of chain) {
      const b = this.bones[n];
      if (!b) continue;
      b.parent.getWorldQuaternion(_q);
      _q2.setFromAxisAngle(right, this.aimPitch * share).premultiply(new THREE.Quaternion().setFromAxisAngle(UP, this.aimYaw * share));
      // local' = parentWorld^-1 * delta * parentWorld * local
      const inv = _q.clone().invert();
      b.quaternion.premultiply(inv.multiply(_q2).multiply(_q));
      b.updateMatrixWorld(true);
    }
  }

  // Secondary motion: tails (and any chains the asset lists in meta.springs) lag behind the body.
  // A cascade of damped springs, each chasing the one before it, turns turning and braking into a
  // travelling wave of follow-through on top of the authored animation.
  _secondary(dt) {
    if (!this.springs) {
      let defs = this.meta.springs;
      if (!defs) {
        const tail = Object.keys(this.bones).filter((n) => /^tail\d+$/.test(n)).sort((a, b) => +a.slice(4) - +b.slice(4));
        defs = tail.length ? [{ bones: tail, yaw: 1, pitch: 1 }] : [];
      }
      this.springs = defs.map((d) => ({ ...d, bones: d.bones.filter((n) => this.bones[n]), s: d.bones.map(() => ({ y: 0, vy: 0, p: 0, vp: 0 })) }))
        .filter((d) => d.bones.length);
      this._lastSpeed = this.speed;
      this._lastY = this.pos.y;
    }
    if (!this.springs.length || dt <= 0) return;
    const accel = (this.speed - this._lastSpeed) / dt;
    const vy = (this.pos.y - this._lastY) / dt;
    this._lastSpeed = this.speed;
    this._lastY = this.pos.y;
    const right = _v.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const qd = new THREE.Quaternion(), qp = new THREE.Quaternion(), inv = new THREE.Quaternion();
    const w = 7, z = 0.55;
    this.model.updateMatrixWorld(true);
    for (const c of this.springs) {
      const dYaw = clamp(-this.turnVel * 0.35 * (c.yaw ?? 1), -0.7, 0.7);
      const dPitch = clamp((-accel * 0.012 - vy * 0.004) * (c.pitch ?? 1), -0.5, 0.5); // + lifts a trailing chain
      for (let i = 0; i < c.s.length; i++) {
        const s = c.s[i];
        const ty = i === 0 ? dYaw : c.s[i - 1].y;
        const tp = i === 0 ? dPitch : c.s[i - 1].p;
        s.vy += (-w * w * (s.y - ty) - 2 * z * w * s.vy) * dt;
        s.vp += (-w * w * (s.p - tp) - 2 * z * w * s.vp) * dt;
        s.y += s.vy * dt;
        s.p += s.vp * dt;
      }
      const gain = (c.gain ?? 0.22);
      for (let i = 0; i < c.bones.length; i++) {
        const b = this.bones[c.bones[i]];
        const s = c.s[i];
        if (Math.abs(s.y) + Math.abs(s.p) < 1e-5) continue;
        b.parent.getWorldQuaternion(qp);
        qd.setFromAxisAngle(UP, s.y * gain).multiply(new THREE.Quaternion().setFromAxisAngle(right, s.p * gain));
        inv.copy(qp).invert();
        b.quaternion.premultiply(inv.multiply(qd).multiply(qp));
        b.updateMatrixWorld(true);
      }
    }
  }

  // Swept capsules for the body this frame (legs, torso, tail) in world space.
  bodyCapsules() {
    const caps = [];
    const r = this.scale;
    const pairs = this.meta.body || [];
    for (const [a, b, rad] of pairs) {
      if (!this.bones[a] || !this.bones[b]) continue;
      caps.push([this.bonePos(a, new THREE.Vector3()), this.bonePos(b, new THREE.Vector3()), rad * r]);
    }
    return caps;
  }

  // Distance from p to the body's surface (negative inside), from the collision capsules.
  surfaceDist(p, caps = this.bodyCapsules()) {
    let best = Infinity;
    for (const [a, b, r] of caps) {
      const ab = _v2.subVectors(b, a);
      const t = clamp(_v.subVectors(p, a).dot(ab) / Math.max(ab.lengthSq(), 1e-6), 0, 1);
      const d = _v.copy(a).addScaledVector(ab, t).distanceTo(p) - r;
      if (d < best) best = d;
    }
    return best;
  }

  damage(amount, dir) {
    if (this.dead) return 0;
    const dealt = amount * (1 - this.stats.armor);
    this.hp -= dealt;
    this.hurtT = 1.2;
    if (this.events && this.events.hurt) this.events.hurt(this, dealt);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.special.on = false;
      this.play('death', { full: true, fade: 0.3 });
      if (this.events && this.events.died) this.events.died(this);
    }
    return dealt;
  }
}
