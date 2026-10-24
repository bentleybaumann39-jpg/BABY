// A rival kaiju: another of the roster in a random strain, come to fight for the city. It hunts
// the player through the blocks, trades blows with its own moves and signature power, enrages
// when it is losing, and dies with a finisher in slow motion.
import * as THREE from 'three';
import { KAIJU, FORMS, RIVAL, SURGE, kaijuStats } from '../core/Config.js';
import { loadKaiju } from '../core/Assets.js';
import { Kaiju } from '../kaiju/Kaiju.js';
import { Abilities } from '../kaiju/Abilities.js';
import { angleDiff, clamp } from '../core/Rng.js';

const _v = new THREE.Vector3();

export class Rival {
  // tier: 1.. (each one tougher); pick: optional { id, form } from the mission
  constructor(play, tier, pick = {}) {
    this.play = play;
    this.tier = tier;
    const ids = Object.keys(KAIJU).filter((id) => id !== play.cfg.kaijuId);
    this.id = pick.id && KAIJU[pick.id] ? pick.id : ids[Math.floor(Math.random() * ids.length)];
    const forms = Object.keys(FORMS).filter((f) => f !== 'prime');
    this.mut = { form: pick.form && FORMS[pick.form] ? pick.form : forms[Math.floor(Math.random() * forms.length)], genes: [] };
    const base = KAIJU[this.id], F = FORMS[this.mut.form];
    this.def = F.glow ? { ...base, moves: { ...base.moves, special: { ...base.moves.special, color: F.glow } } } : base;
    this.name = base.name;
    this.strain = F.name;
    this.k = null;
    this.state = 'loading';
    this.atkCd = 3;
    this.spCd = 6;
    this.t = 0;
    this.enraged = false;
  }

  async load() {
    const P = this.play;
    const asset = await loadKaiju(this.def.asset);
    const lv = { vitality: this.tier, might: this.tier, hide: Math.min(5, this.tier), growth: Math.min(4, this.tier - 1) };
    const stats = kaijuStats(this.id, lv, this.mut);
    stats.hp = RIVAL.ehp * (1 + RIVAL.tierGrow * (this.tier - 1)) * (1 - stats.armor);
    const k = new Kaiju(this.id, this.def, asset.gltf, stats, asset.meta, this.mut);
    this.k = k;
    k.events = {
      footstep: (kk, foot, s) => P.onFootstep(kk, foot, s),
      request: () => {},
      actionEnd: () => {},
      died: () => this.onDied(),
    };
    this.ab = new Abilities(P);
    this.ab.owner = k;
    this.ab.tint(this.def.moves.special.color);
    // arrive on the far side of the player, inside the city
    const pk = P.kaiju, B = P.world.bounds, coast = P.world.city.coast;
    const a = (Math.random() - 0.5) * 1.6;
    const x = clamp(pk.pos.x + Math.sin(a) * 480, B.x0 + 120, B.x1 - 120);
    const z = clamp(Math.min(pk.pos.z - Math.cos(a) * 480, coast - 160), B.z0 + 120, B.z1 - 120);
    k.pos.set(x, 0, z);
    k.groundY = P.world.groundAt(x, z);
    k.pos.y = k.groundY;
    k.yaw = Math.atan2(pk.pos.x - x, pk.pos.z - z);
    k.root.rotation.y = k.yaw;
    P.scene.add(k.root);
    this.state = 'intro';
    this.t = 0;
    return this;
  }

  // ------------------------------------------------------------------ per frame

  update(dt) {
    const P = this.play, k = this.k;
    if (!k) return;
    this.t += dt;
    const pk = P.kaiju;
    const ctl = { moveDir: new THREE.Vector3(), sprint: false, aimPoint: null, aiming: false };
    const chest = _v.copy(pk.pos).setY(pk.pos.y + pk.height * 0.55).clone();
    const dx = pk.pos.x - k.pos.x, dz = pk.pos.z - k.pos.z;
    const d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    const face = Math.abs(angleDiff(k.yaw, want));
    const reach = (k.radius + pk.radius) * 0.5 + 18 * k.scale;
    if (!k.dead && this.state === 'fight' && !pk.dead && P.state === 'play') {
      this.atkCd -= dt;
      this.spCd -= dt;
      ctl.aimPoint = chest;
      if (this.sp) this._special(dt, ctl, chest, d);
      else {
        // close in, turn to face, then pick a blow or a power
        const dir = new THREE.Vector3(dx / (d || 1), 0, dz / (d || 1));
        if (d > reach * 0.85) { ctl.moveDir.copy(dir); ctl.sprint = d > reach * 2.2; } else if (face > 0.35) ctl.moveDir.copy(dir).multiplyScalar(0.12);
        const mv = this.def.moves;
        if (k.canAct() && this.spCd <= 0 && k.energy > 40) {
          const kind = mv.special.kind;
          const range = kind === 'pulse' ? (mv.special.radius * k.scale * 0.7) : kind === 'charge' ? 520 : kind === 'spray' ? 260 * k.scale : 650;
          if (d < range && d > (kind === 'pulse' ? 0 : reach * 0.8) && face < 0.5) this._startSpecial();
        }
        if (!this.sp && k.canAct() && this.atkCd <= 0 && d < reach * 1.1 && face < 0.6) this._attack();
        else if (!this.sp && k.canAct() && mv.stomp.kind === 'leap' && this.atkCd <= 0 && d > 160 && d < 240 * k.scale && face < 0.4) this._leap(pk.pos);
      }
      // enrage at a third of its health: it surges, like the player can
      if (!this.enraged && k.hp < k.maxHp * RIVAL.enrage) {
        this.enraged = true;
        k.play('roar', { full: true });
        P.app.audio && P.app.audio.roar(k, 1.3);
        P.abilities.shock(k.pos.clone().setY(P.world.groundAt(k.pos.x, k.pos.z)), k.height * 3, k.mutRig.glow);
        P.feedPush(this.name + ' is enraged');
        P.app.ui && P.app.ui.toast(this.name + ' IS ENRAGED');
      }
    }
    if (this.enraged && !k.dead) k.applySurge(Math.min(1, k.surgeAmt + dt / 1.5), SURGE);
    if (this.state === 'intro') ctl.moveDir.set(0, 0, 0);
    const ab = this.ab;
    if (!ab.updateLeap(dt, k)) k.update(dt, ctl, P.world);
    else { k.root.rotation.y = k.yaw; k.mixer.update(dt); k.model.updateMatrixWorld(true); }
    if (!k.dead) {
      P._moveHits(dt, k);
      P._bodyContact(dt, k);
      k.mutRig.emitAura(P.particles, dt, k.scale, k.surgeAmt, 18);
    }
    // only beam-breathers touch the beam (it also drives the shared heat haze)
    if (this.def.moves.special.kind === 'beam') ab.beamUpdate(dt, k, !!(this.sp && this.sp.phase === 'loop'), chest);
    ab.update(dt);
  }

  _attack() {
    const P = this.play, k = this.k, mv = this.def.moves;
    const r = Math.random();
    const name = r < 0.32 ? 'attack1' : r < 0.62 ? 'attack2' : r < 0.86 ? 'heavy' : (mv.stomp.kind === 'leap' ? 'heavy' : 'stomp');
    P._startMove(name, k);
    this.atkCd = (RIVAL.attackGap[0] + Math.random() * (RIVAL.attackGap[1] - RIVAL.attackGap[0])) / (this.enraged ? 1.4 : 1);
  }

  _leap(target) {
    const k = this.k;
    const rate = this.ab.startLeap(k, target.clone());
    k.play(this.play.clipFor('stomp', k), { full: true, speed: rate });
    this.play.app.audio && this.play.app.audio.roar(k, 0.5);
    this.atkCd = 2.5;
  }

  // ------------------------------------------------------------------ signature power

  _startSpecial() {
    const k = this.k, mv = this.def.moves.special, S = k.special;
    this.sp = { kind: mv.kind, phase: 'in', t: 0, shots: 0, fireT: 0 };
    S.on = true; S.kind = mv.kind; S.phase = 'in'; S.t = 0; S.rammed = false; S.fired = false;
    k.play('special_in', { full: true });
    this.play.app.audio && (mv.kind === 'charge' ? this.play.app.audio.roar(k, 0.8) : this.play.app.audio.charge(k, true));
  }

  _endSpecial(cd) {
    const k = this.k;
    k.special.on = false; k.special.phase = null; k.special.kind = null;
    this.sp = null;
    this.spCd = cd * (this.enraged ? 0.65 : 1);
  }

  _special(dt, ctl, chest, d) {
    const P = this.play, k = this.k, sp = this.sp, S = k.special, mv = this.def.moves.special;
    const clip = (n, f) => (k.clips[n] ? k.clips[n].duration : f);
    sp.t += dt;
    S.t = sp.t;
    // keep turning toward the target while the power builds
    const want = Math.atan2(chest.x - k.pos.x, chest.z - k.pos.z);
    if (sp.kind !== 'charge' || sp.phase === 'in') k.yaw += clamp(angleDiff(k.yaw, want), -dt * 0.9, dt * 0.9);
    if (sp.phase === 'in') {
      S.glow = Math.min(1, sp.t / clip('special_in', 1));
      if (sp.t >= clip('special_in', 1)) {
        sp.phase = 'loop'; sp.t = 0; S.phase = 'loop';
        if (sp.kind === 'pulse') { sp.phase = 'out'; S.phase = 'out'; k.play('special_out', { full: true, fade: 0.05 }); }
        else k.play('special_loop', { full: true, loop: true, fade: 0.1, speed: sp.kind === 'charge' ? 1.45 : 1 });
      }
      return;
    }
    if (sp.phase === 'loop') {
      S.glow = 1;
      const len = sp.kind === 'charge' ? 3.2 : sp.kind === 'beam' || sp.kind === 'spray' ? 2.6 : 2.4;
      if (sp.kind === 'spray') this.ab.spray(dt, k, chest);
      if (sp.kind === 'spit' || sp.kind === 'mortar') {
        sp.fireT += dt;
        const every = clip('special_loop', 1) / 2;
        if (sp.fireT >= every) {
          sp.fireT -= every;
          const from = k.bonePos(sp.kind === 'mortar' ? (k.meta.launcher || 'mouth') : (k.meta.mouth || 'mouth'), new THREE.Vector3());
          const aim = P.kaiju.pos.clone().setY(P.kaiju.pos.y + P.kaiju.height * 0.4);
          aim.x += (Math.random() - 0.5) * 30; aim.z += (Math.random() - 0.5) * 30;
          this.ab.launchOrb(k, from, aim, sp.kind === 'spit');
        }
      }
      if (sp.kind === 'charge') {
        ctl.moveDir.set(Math.sin(k.yaw), 0, Math.cos(k.yaw));
        k.yaw += clamp(angleDiff(k.yaw, want), -dt * 0.5, dt * 0.5);
        k.speed = Math.max(k.speed, k.runSpeed * 1.2);
      }
      k.energy = Math.max(10, k.energy - mv.cost * 0.4 * dt);
      if (sp.t >= len || (sp.kind === 'charge' && S.rammed && sp.t > 0.6)) {
        sp.phase = 'out'; sp.t = 0; S.phase = 'out';
        k.play('special_out', { full: true, fade: 0.12 });
      }
      return;
    }
    // out
    S.glow = Math.max(0, 1 - sp.t / 0.7);
    if (sp.kind === 'pulse' && !S.fired && sp.t >= (k.meta.hits?.special_out ?? 0.2)) { S.fired = true; this.ab.pulse(k); }
    if (sp.t >= Math.max(0.6, clip('special_out', 0.6) * 0.9)) this._endSpecial(RIVAL.specialGap + Math.random() * 3);
  }

  // ------------------------------------------------------------------ events

  onDied() {
    this.state = 'dead';
    if (this.sp) this._endSpecial(99);
    this.play.onRivalDown(this);
  }

  dispose() {
    if (this.k) this.play.scene.remove(this.k.root);
    if (this.ab) for (const m of [this.ab.beam, this.ab.sheath, this.ab.boulder, this.ab.ring, this.ab.hitLight, this.ab.mouthLight]) this.play.scene.remove(m);
  }
}
