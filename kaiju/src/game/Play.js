// One rampage: world, kaiju, camera, destruction effects, military response, objectives.
import * as THREE from 'three';
import { World } from '../world/World.js';
import { Debris } from '../world/Debris.js';
import { Particles } from '../render/Particles.js';
import { Decals, DECAL } from '../render/Decals.js';
import { Kaiju } from '../kaiju/Kaiju.js';
import { CameraRig } from '../kaiju/CameraRig.js';
import { Abilities } from '../kaiju/Abilities.js';
import { patch, G as SG } from '../render/Shading.js';
import { KAIJU, MISSIONS, kaijuStats, MILITARY, FORMS, SURGE } from '../core/Config.js';
import { loadKaiju, loadGLB } from '../core/Assets.js';
import { Props } from '../world/Props.js';
import { clamp, damp, smooth } from '../core/Rng.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3();

export class Play {
  constructor(app, cfg) {
    this.app = app;
    this.cfg = cfg;
    this.mission = MISSIONS.find((m) => m.id === cfg.missionId) || MISSIONS[0];
    // mutation: the strain, its slotted genes, and the stats both produce
    this.mut = cfg.mut || { form: 'prime', genes: [] };
    this.form = FORMS[this.mut.form] || FORMS.prime;
    this.genes = new Set(this.mut.genes || []);
    const base = KAIJU[cfg.kaijuId];
    // a strain recolours the signature power too
    this.def = this.form.glow ? { ...base, moves: { ...base.moves, special: { ...base.moves.special, color: this.form.glow } } } : base;
    this.stats = kaijuStats(cfg.kaijuId, cfg.levels || {}, this.mut);
    const adrenal = this.genes.has('adrenal');
    this.surge = { meter: 0, on: false, t: 0, amt: 0, ready: false, dur: SURGE.duration + (adrenal ? 6 : 0), gain: adrenal ? 1.5 : 1 };
    this.dots = []; // delayed and lingering effects: acid, rifts, aftershocks, echo roars
    this.pressure = 0; // Volatile Blood
    this.ventT = 0;
    this._lastDmg = 0;
    this._lastKills = 0;
    this.time = 0;
    this.state = 'loading';
    this.fx = { haze: 0, hazeAt: new THREE.Vector3(), flash: 0, hurt: 0 };
    this.score = { damage: 0, towers: 0, buildings: 0, kills: 0, vehicles: 0, people: 0, landmark: 0, peak: 0 };
    this.feed = [];
    this.threat = 0;
    this.combo = 0;
    this.comboT = 0;
    this.lastCrumble = 0;
    this.pendingDust = [];
    this.swingHit = new Set();
  }

  shade(mat, key, hook) { return patch(mat, key, hook); }

  async load(progress = () => {}) {
    const app = this.app;
    const R = app.renderer;
    this.camera = app.camera;
    progress(0.05, 'Charting the coastline');
    await tick();
    const city = this.cfg.city || this.mission.city;
    const time = this.cfg.time || this.mission.time;
    const events = {
      chunkBroken: (e) => this.onChunkBroken(e),
      collapse: (b, g) => this.onCollapse(b, g),
      groupImpact: (p, s, g) => this.onGroupImpact(p, s, g),
      buildingDown: (b) => this.onBuildingDown(b),
    };
    this.world = new World(R, this.camera, { time, city, events, skySize: R.q.shadow >= 2048 ? 512 : 256 });
    this.scene = this.world.scene;
    progress(0.45, 'Raising the skyline');
    await tick();
    this.debris = new Debris(this.scene, this.world, R.q.particles);
    this.particles = new Particles(this.scene, R.q.particles);
    this.decals = new Decals(this.scene);
    this.particles.setLighting(this.world.keyIntensity, this.world.sky.ambient);
    this.propsReady = loadGLB('props').then((g) => { this.props = new Props(this, g); return g; }).catch((e) => { console.warn('props unavailable', e); return null; });
    await this.propsReady;
    progress(0.6, 'Waking the ' + this.def.name.toLowerCase());
    const asset = await loadKaiju(this.def.asset, (f) => progress(0.6 + f * 0.3, 'Waking ' + this.def.name));
    this.kaiju = new Kaiju(this.cfg.kaijuId, this.def, asset.gltf, this.stats, asset.meta, this.mut);
    this.kaiju.events = {
      hurt: (k, d) => this.onHurt(d),
      footstep: (k, foot, s) => this.onFootstep(k, foot, s),
      request: (k, a) => this.request(a),
      actionEnd: (k, n) => this.onActionEnd(n),
      died: () => this.onDied(),
    };
    this.scene.add(this.kaiju.root);
    this.abilities = new Abilities(this);
    this.abilities.tint(this.def.moves.special.color);
    this.rig = new CameraRig(this.camera);
    this.rig.shakeScale = app.settings.shake ?? 1;
    this.rig.reduced = !!app.settings.reducedMotion;
    // spawn offshore, facing the city
    const k = this.kaiju;
    k.pos.set(60, 0, this.world.city.coast + 380);
    k.yaw = Math.PI;
    const sp = app.params && app.params.get('spawn');
    if (sp) { const [x, z] = sp.split(',').map(Number); k.pos.set(x, 0, z); }
    k.groundY = this.world.groundAt(k.pos.x, k.pos.z);
    k.pos.y = k.groundY;
    this.rig.yaw = 0.25;
    this.rig.target.copy(k.pos).setY(k.height * 0.7);
    // optional systems
    if (app.systems) {
      for (const [name, Sys] of Object.entries(app.systems)) this[name] = new Sys(this);
    }
    R.setup(this.scene, this.camera);
    progress(1, 'Landfall');
    this.state = 'intro';
    this.introT = 0;
    if (app.params && app.params.get('nointro')) { this.state = 'intro'; this.endIntro(); }
    else this._intro();
  }

  _intro() {
    const k = this.kaiju;
    const H = k.height;
    const p0 = k.pos.clone();
    this.rig.play({
      from: () => _v.set(p0.x - H * 2.2, H * 0.3, p0.z - H * 2.4).clone(),
      to: () => _v.set(k.pos.x + H * 0.6, H * 0.55, k.pos.z - H * 3.1).clone(),
      lookFrom: () => _v.set(k.pos.x, H * 0.6, k.pos.z).clone(),
      lookTo: () => _v.set(k.pos.x, H * 0.75, k.pos.z).clone(),
      dur: 7.5, fov: 42,
      done: () => this.endIntro(),
    });
    this.app.audio && this.app.audio.sting('landfall');
  }

  endIntro() {
    if (this.state !== 'intro') return;
    this.state = 'play';
    this.rig.stopCine();
    this.rig.yaw = this.kaiju.yaw + Math.PI;
    this.rig.pitch = 0.2;
    if (this.app.ui) this.app.ui.missionStart(this);
  }

  // ------------------------------------------------------------------ input

  request(a) {
    const k = this.kaiju;
    if (k.dead) return;
    if (a === 'attack') {
      if (!k.canAct()) { if (k.action && !k.action.loop) k.queued = 'attack'; return; }
      const name = this.combo % 2 === 0 ? 'attack1' : 'attack2';
      this.combo++;
      this.comboT = 1.6;
      this._startMove(name);
    } else if (a === 'heavy') {
      if (!k.canAct()) { k.queued = 'heavy'; return; }
      this._startMove('heavy');
    } else if (a === 'stomp') {
      if (!k.canAct()) return;
      const mv = this.def.moves.stomp;
      if (mv.kind === 'leap') {
        if (k.energy < 15) return this.app.ui && this.app.ui.toast('Not enough energy');
        k.energy -= 15;
        const rate = this.abilities.startLeap(k, this.aim.clone());
        k.play(this.clipFor('stomp'), { full: true, speed: rate });
        this.app.audio && this.app.audio.roar(k, 0.5);
      } else this._startMove('stomp');
    } else if (a === 'roar') {
      if (!k.canAct()) return;
      k.play('roar', { full: true });
      this.app.audio && this.app.audio.roar(k, 1);
      this.roarT = 0;
      if (!this.surge.on) this.surge.meter = Math.min(1, this.surge.meter + SURGE.perRoar * this.surge.gain);
      if (this.genes.has('echo')) this.dots.push({ kind: 'echo', t: 0 });
    }
  }

  // ------------------------------------------------------------------ mutation surge

  startSurge() {
    const S = this.surge, k = this.kaiju;
    if (S.on || S.meter < 1 || !k.canAct() || this.abilities.leap) return;
    S.on = true; S.t = 0; S.ready = false;
    k.play('roar', { full: true });
    this.app.audio && this.app.audio.roar(k, 1.3);
    k.hp = Math.min(k.maxHp, k.hp + k.maxHp * 0.25);
    k.energy = k.maxEnergy;
    // the transformation itself is a shockwave
    const p = k.pos.clone();
    p.y = this.world.groundAt(p.x, p.z);
    const c = k.mutRig.glow;
    this.slam(k, p, k.height * 0.75, k.stats.stomp * 1.2);
    this.abilities.shock(p, k.height * 3, c);
    this.particles.sparks(p.clone().setY(p.y + k.height * 0.5), Math.ceil(220 * this.particles.q), k.height * 0.5, [c[0] * 7, c[1] * 7, c[2] * 7]);
    this.fx.flash = this.app.settings.reducedMotion ? 0.08 : 0.25;
    this.rig.addTrauma(0.6);
    if (this.military) this.military.suppressT = Math.max(this.military.suppressT, 3);
    this.feedPush('Mutation surge');
    this.app.ui && this.app.ui.banner('MUTATION SURGE', (this.form.tint ? this.form.name + ' strain · ' : '') + 'stronger, faster, tougher for ' + S.dur + ' seconds', 2.5);
  }

  _surge(dt, dDamage, dKills) {
    const S = this.surge, k = this.kaiju;
    if (k.dead) S.on = false;
    if (!S.on) {
      S.meter = Math.min(1, S.meter + (dDamage / SURGE.fill + dKills * SURGE.perKill) * S.gain);
      if (S.meter >= 1 && !S.ready && !k.dead) {
        S.ready = true;
        this.app.ui && this.app.ui.toast('Mutation surge ready · press T');
      }
    } else {
      S.t += dt;
      S.meter = Math.max(0, 1 - S.t / S.dur);
      if (S.t >= S.dur) { S.on = false; S.meter = 0; this.feedPush('Surge spent'); }
    }
    const prev = S.amt;
    S.amt = S.on ? Math.min(1, S.amt + dt / 1.2) : Math.max(0, S.amt - dt / 2);
    if (S.amt > 0 || prev > 0) k.applySurge(smooth(S.amt), SURGE);
  }

  // ------------------------------------------------------------------ elements and genes

  // A connecting blow carries the strain's element.
  _element(p, r, dmg) {
    const el = this.form.element;
    if (!el) return;
    const ps = this.particles, c = this.kaiju.mutRig.glow;
    if (el === 'fire') {
      this.world.buildings.ignite(p, r * 2, 0.45); // the blow has already broken what it hit: the fire takes the rest
      for (let i = 0; i < 6; i++) ps.fire(_v.copy(p).add(_v2.set(Math.random() - 0.5, Math.random() * 0.5, Math.random() - 0.5).multiplyScalar(r)), r * 0.35, { rise: 10, life: 1.8 });
      ps.sparks(p, Math.ceil(30 * ps.q), r * 1.2, [6, 2, 0.4]);
    } else if (el === 'ice') {
      if (this.military) this.military.freeze(p, r * 2.2, 6);
      this.damageVolume(p, r * 0.9, dmg * 0.25, null, 'ice'); // frozen masonry shatters
      ps.surge(p, r * 0.9, 14, { color: [0.8, 0.88, 0.96], speed: r * 0.6, life: 5, grow: 0.6, alpha: 0.5 });
      ps.sparks(p, Math.ceil(30 * ps.q), r, [2.5, 3.5, 4.5]);
    } else if (el === 'acid') {
      this.dots.push({ kind: 'acid', p: p.clone(), r: r * 1.15, dmg: dmg * 0.1, t: 0, n: 0 });
      ps.sparks(p, Math.ceil(40 * ps.q), r * 0.8, [c[0] * 3, c[1] * 3, c[2] * 3]);
    } else if (el === 'void') {
      this.dots.push({ kind: 'rift', p: p.clone(), r: r * 1.2, dmg: dmg * 0.6, t: 0 });
      ps.add.spawn({ p: p.toArray(), life: 0.5, size: r * 1.6, size1: r * 0.2, color: [c[0] * 3, c[1] * 3, c[2] * 3], alpha: 1, tile: 4, drag: 0, fadeIn: 0.05 });
    }
  }

  _dots(dt) {
    const ps = this.particles, k = this.kaiju;
    for (let i = this.dots.length - 1; i >= 0; i--) {
      const d = this.dots[i];
      d.t += dt;
      let done = false;
      if (d.kind === 'acid') {
        // corrodes in four bites over two seconds
        while (d.n < 4 && d.t >= 0.5 + d.n * 0.5) {
          d.n++;
          this.damageVolume(d.p, d.r, d.dmg, null, 'acid');
          this.hitUnitsSphere(d.p, d.r * 1.3, d.dmg, 'acid');
        }
        if (Math.random() < dt * 12) ps.smoke(d.p, d.r * 0.4, { dark: 0.2, rise: 4, life: 5, grow: 2, alpha: 0.35 });
        if (Math.random() < dt * 25) ps.add.spawn({ p: [d.p.x + (Math.random() - 0.5) * d.r, d.p.y + Math.random() * d.r * 0.5, d.p.z + (Math.random() - 0.5) * d.r], v: [0, 2, 0], life: 0.8, size: 1.5, size1: 3, color: [1, 3, 0.3], alpha: 0.8, drag: 1, tile: 4, fadeIn: 0.1 });
        done = d.n >= 4;
      } else if (d.kind === 'rift' && d.t >= 0.45) {
        const c = k.mutRig.glow;
        this.damageVolume(d.p, d.r, d.dmg, null, 'void');
        this.hitUnitsSphere(d.p, d.r * 1.5, d.dmg, 'void');
        ps.add.spawn({ p: d.p.toArray(), life: 0.35, size: d.r * 0.3, size1: d.r * 2.2, color: [c[0] * 4, c[1] * 4, c[2] * 4], alpha: 1, tile: 4, drag: 0, fadeIn: 0.02 });
        ps.sparks(d.p, Math.ceil(50 * ps.q), d.r * 1.5, [c[0] * 5, c[1] * 5, c[2] * 5]);
        this.app.audio && this.app.audio.impact(d.p, 0.6);
        done = true;
      } else if (d.kind === 'quake' && d.t >= 0.3) {
        // the aftershock: a wider, weaker ring
        this.damageVolume(new THREE.Vector3(d.p.x, d.p.y + d.r * 0.15, d.p.z), d.r, d.dmg, new THREE.Vector3(0, 10, 0), 'stomp');
        this.hitUnitsSphere(d.p, d.r * 1.2, d.dmg, 'stomp');
        ps.surge(d.p, d.r, 22, { color: [0.5, 0.45, 0.38], speed: d.r * 0.8, life: 10, grow: 0.8 });
        if (this.world.groundAt(d.p.x, d.p.z) > -0.5) this.decals.add(DECAL.CRACK, d.p.x, d.p.y, d.p.z, d.r * 1.6);
        this.rig.impulse(d.p, 0.5, d.r * 10);
        this.app.audio && this.app.audio.slam(d.p, 0.6);
        done = true;
      } else if (d.kind === 'echo' && d.t >= 0.55) {
        // Echo Chamber: the roar breaks things in front of the jaws and silences every gun
        const f = k.forward.clone();
        const p = k.pos.clone().addScaledVector(f, k.height * 0.7).setY(k.pos.y + k.height * 0.4);
        this.damageVolume(p, k.height * 0.75, k.stats.special * 0.5, f.multiplyScalar(18), 'roar');
        this.hitUnitsSphere(k.pos, 500, 80, 'roar');
        if (this.military) this.military.suppressT = Math.max(this.military.suppressT, 8);
        this.abilities.shock(k.pos.clone().setY(this.world.groundAt(k.pos.x, k.pos.z)), k.height * 4, k.mutRig.glow);
        ps.surge(k.pos.clone().setY(0), k.height * 0.9, 24, { speed: k.height, life: 8, grow: 0.7 });
        this.rig.addTrauma(0.4);
        done = true;
      }
      if (done) this.dots.splice(i, 1);
    }
  }

  // Volatile Blood: what the military does to you comes back at them.
  onHurt(dealt) {
    if (!this.genes.has('volatile')) return;
    this.pressure += dealt;
    const k = this.kaiju;
    if (this.pressure < k.maxHp * 0.1 || this.ventT > 0 || k.dead) return;
    this.pressure = 0;
    this.ventT = 3;
    const p = k.pos.clone().setY(k.pos.y + k.height * 0.45);
    const c = k.mutRig.glow;
    this.damageVolume(p, k.height * 0.55, 260 * k.scale, new THREE.Vector3(0, 12, 0), 'explosion');
    this.hitUnitsSphere(p, 420, 300, 'explosion');
    this.world.buildings.ignite(p, k.height * 0.5, 0.4);
    this.particles.fireball(p, k.height * 0.18);
    this.particles.sparks(p, Math.ceil(160 * this.particles.q), k.height * 0.6, [c[0] * 7, c[1] * 7, c[2] * 7]);
    this.abilities.shock(k.pos.clone().setY(this.world.groundAt(k.pos.x, k.pos.z)), k.height * 3.5, c);
    this.rig.addTrauma(0.5);
    this.app.audio && this.app.audio.explosion(p, 1);
    this.feedPush('Volatile blood');
  }

  clipFor(name) { return this.kaiju.clips[name] ? name : 'attack1'; }

  _startMove(name) {
    const k = this.kaiju;
    k.play(this.clipFor(name), { full: name === 'stomp' || name === 'heavy' });
    k.action.hitDone = false;
    k.action.move = name;
    this.swingHit.clear();
    this.swingPrev = null;
    this.app.audio && this.app.audio.swing(k, name);
  }

  // ------------------------------------------------------------------ frame

  update(dt) {
    const app = this.app, inp = app.input;
    const k = this.kaiju;
    this.time += dt;
    // ---- controls
    const ctl = { moveDir: new THREE.Vector3(), sprint: false, aimPoint: null, aiming: false };
    const playing = this.state === 'play' && !k.dead;
    if (this.state === 'intro') {
      ctl.moveDir.set(0, 0, -0.55);
      if (inp.attack || inp.hit('Space') || inp.hit('Enter') || inp.hit('Escape')) this.endIntro();
    }
    if (playing) {
      const m = inp.move;
      _f.set(-Math.sin(this.rig.yaw), 0, -Math.cos(this.rig.yaw));
      _r.set(Math.cos(this.rig.yaw), 0, -Math.sin(this.rig.yaw));
      ctl.moveDir.copy(_f).multiplyScalar(m.y).addScaledVector(_r, m.x);
      ctl.sprint = inp.sprint;
      this.aim = this.rig.aimPoint(this.world);
      ctl.aimPoint = this.aim;
      if (inp.attack) this.request('attack');
      if (inp.heavy) this.request('heavy');
      if (inp.stomp) this.request('stomp');
      if (inp.roar) this.request('roar');
      if (inp.mutate) this.startSurge();
      this._special(dt, inp.special);
      ctl.aiming = this.kaiju.special.on;
      this.rig.aiming = inp.special || this.kaiju.special.on;
    }
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    // ---- kaiju (a brief hit-stop sells the weight of a connecting blow)
    const kdt = this.hitstop > 0 ? dt * 0.25 : dt;
    this.hitstop = Math.max(0, (this.hitstop || 0) - dt);
    if (!this.abilities.updateLeap(kdt, k)) k.update(kdt, ctl, this.world);
    else { k.root.rotation.y = k.yaw; k.mixer.update(kdt); k.model.updateMatrixWorld(true); }
    this._moveHits(dt);
    this._bodyContact(dt);
    this._water(dt);
    // ---- camera
    this.rig.update(dt, k, playing ? inp.look : { x: 0, y: 0 }, playing ? inp.zoom : 0, this.world);
    // ---- occlusion cutaway between camera and kaiju
    SG.uCutA.value.copy(this.camera.position);
    SG.uCutB.value.copy(k.pos).setY(k.pos.y + k.height * 0.55);
    SG.uCutR.value = k.height * 0.55;
    // ---- world + effects
    this.world.update(dt);
    this.debris.update(dt);
    this.abilities.update(dt);
    this._fires(dt);
    this._pending(dt);
    this.particles.update(dt);
    if (this.props) this.props.update(dt);
    for (const s of ['traffic', 'military', 'crowds']) if (this[s]) this[s].update(dt);
    // ---- score, threat, objectives
    const bs = this.world.buildings.stats;
    this.score.damage = bs.value + (this.score.extraValue || 0);
    const dDamage = this.score.damage - this._lastDmg, dKills = this.score.kills - this._lastKills;
    this._lastDmg = this.score.damage;
    this._lastKills = this.score.kills;
    if (this.state === 'play') this._surge(dt, dDamage, dKills);
    if (dKills > 0 && this.genes.has('frenzy') && !k.dead) {
      k.hp = Math.min(k.maxHp, k.hp + k.maxHp * 0.03 * dKills);
      k.energy = Math.min(k.maxEnergy, k.energy + 8 * dKills);
    }
    this.ventT = Math.max(0, this.ventT - dt);
    this._dots(dt);
    if (!k.dead) k.mutRig.emitAura(this.particles, dt, k.scale, k.surgeAmt);
    this.threat = Math.min(5, this.mission.military * 0.5 + this.score.damage / 1e9 * MILITARY.threatPerBillion + this.time / 120);
    this._objectives(dt);
    // ---- post fx
    const g = app.renderer.grade.uniforms;
    this.fx.hurt = damp(this.fx.hurt, k.hurtT > 0.9 ? 0.6 : 0, 5, dt);
    g.uHurt.value = this.fx.hurt * (app.settings.reducedMotion ? 0.4 : 1);
    this.fx.flash = Math.max(0, this.fx.flash - dt * 4);
    g.uFlash.value = this.fx.flash;
    g.uHaze.value = this.fx.haze;
    if (this.fx.haze > 0.01) {
      _v.copy(this.fx.hazeAt).project(this.camera);
      g.uHazeCenter.value.set(_v.x * 0.5 + 0.5, _v.y * 0.5 + 0.5);
    }
    g.uLetter.value = damp(g.uLetter.value, this.state === 'intro' || this.state === 'outro' ? 0.11 : 0, 3, dt);
    if (app.audio) app.audio.update(dt, this);
    if (app.ui) app.ui.hud(this);
  }

  // ------------------------------------------------------------------ specials

  _special(dt, held) {
    const k = this.kaiju, S = k.special, mv = this.def.moves.special;
    const canStart = k.canAct() && k.energy > mv.cost * 0.35;
    const clipDur = (n, d) => (k.clips[n] ? k.clips[n].duration : d);
    const channel = mv.kind === 'beam' || mv.kind === 'spray' || mv.kind === 'spit' || mv.kind === 'mortar';
    if (channel) {
      // hold to channel: wind up, sustain while held and fed, wind down
      const shots = mv.kind === 'spit' || mv.kind === 'mortar';
      const shotCost = mv.cost * k.stats.specialCost;
      if (held && !S.on && canStart && (!shots || k.energy >= shotCost)) {
        S.on = true; S.kind = mv.kind; S.phase = 'in'; S.t = 0;
        k.play('special_in', { full: true });
        this.app.audio && this.app.audio.charge(k, true);
      }
      if (S.on) {
        S.t += dt;
        if (S.phase === 'in') {
          S.glow = Math.min(1, S.t / 1.0);
          if (S.t >= clipDur('special_in', 0.8)) {
            S.phase = 'loop';
            S.fireT = shots ? (mv.kind === 'spit' ? 0.38 : 0.48) : 0;
            k.play('special_loop', { full: true, loop: true, fade: 0.1 });
            if (!shots) this.app.audio && this.app.audio.beam(k, true);
          }
        } else if (S.phase === 'loop') {
          S.glow = 1;
          if (shots) {
            // one glob or bomb per heave of the loop clip (two heaves per loop)
            const every = clipDur('special_loop', 1.0) / 2;
            S.fireT += dt;
            if (S.fireT >= every && k.energy >= shotCost) {
              S.fireT -= every;
              k.energy -= shotCost;
              const from = k.bonePos(mv.kind === 'mortar' ? (k.meta.launcher || 'mouth') : (k.meta.mouth || 'mouth'), new THREE.Vector3());
              const aim = this.aim.clone();
              if (mv.kind === 'mortar') aim.add(new THREE.Vector3((Math.random() - 0.5) * 40, 0, (Math.random() - 0.5) * 40));
              this.abilities.launchOrb(k, from, aim, mv.kind === 'spit');
            }
          }
          if (!held || k.energy <= 0 || (shots && k.energy < shotCost)) {
            S.phase = 'out'; S.t = 0;
            k.play('special_out', { full: true, fade: 0.12 });
            if (!shots) this.app.audio && this.app.audio.beam(k, false);
          }
        } else if (S.phase === 'out') {
          S.glow = Math.max(0, 1 - S.t / 0.6);
          if (S.t > 0.6) { S.on = false; S.phase = null; }
        }
      } else S.glow = Math.max(0, S.glow - dt);
      const firing = S.on && S.phase === 'loop';
      if (mv.kind === 'beam') this.abilities.beamUpdate(dt, k, firing, this.aim);
      else if (mv.kind === 'spray' && firing) this.abilities.spray(dt, k, this.aim);
      if (k.energy < 0) k.energy = 0;
    } else if (mv.kind === 'pulse') {
      // one press: rear up while the shell charges, slam, and the pulse leaves on impact
      const cost = mv.cost * k.stats.specialCost;
      if (!held) S.latch = false; // each pulse needs its own press
      if (held && !S.latch && !S.on && k.canAct() && k.energy >= cost) {
        S.on = true; S.kind = 'pulse'; S.phase = 'in'; S.t = 0; S.fired = false; S.latch = true;
        k.energy -= cost;
        k.play('special_in', { full: true });
        this.app.audio && this.app.audio.charge(k, true);
      }
      if (S.on) {
        S.t += dt;
        if (S.phase === 'in') {
          S.glow = Math.min(1, S.t / clipDur('special_in', 1.0));
          if (S.t >= clipDur('special_in', 1.0)) { S.phase = 'out'; S.t = 0; k.play('special_out', { full: true, fade: 0.05 }); }
        } else {
          if (!S.fired && S.t >= (k.meta.hits?.special_out ?? 0.2)) { S.fired = true; this.abilities.pulse(k); }
          S.glow = Math.max(0, 1 - S.t / 0.8);
          if (S.t >= clipDur('special_out', 1.0)) { S.on = false; S.phase = null; }
        }
      } else S.glow = Math.max(0, S.glow - dt);
    } else if (mv.kind === 'throw') {
      if (held && !S.on && canStart) {
        S.on = true; S.kind = 'throw'; S.t = 0; S.phase = 'in';
        k.energy -= mv.cost * k.stats.specialCost;
        k.play('special_in', { full: true });
      }
      if (S.on) {
        S.t += dt;
        if (S.phase === 'in' || S.phase === 'hold') {
          this.abilities.holdBoulder(k, S.phase === 'in' ? S.t : 1);
          const tIn = clipDur('special_in', 1.0);
          if (S.phase === 'in' && S.t >= tIn && held) {
            // keep the rock overhead while the button stays down
            S.phase = 'hold';
            k.play('special_loop', { full: true, loop: true, fade: 0.12 });
          } else if ((S.phase === 'hold' && !held) || (S.phase === 'in' && S.t >= tIn)) {
            S.phase = 'out'; S.t = 0;
            k.play('special_out', { full: true, fade: 0.08 });
          }
        } else if (S.phase === 'out') {
          if (S.t > 0.25 && !S.thrown) { S.thrown = true; this.abilities.throwBoulder(k, this.aim.clone()); }
          if (S.t > 0.8) { S.on = false; S.thrown = false; S.phase = null; }
        }
      }
      S.glow = S.on ? 1 : Math.max(0, S.glow - dt);
    } else if (mv.kind === 'charge') {
      if (held && !S.on && canStart) {
        S.on = true; S.kind = 'charge'; S.t = 0;
        S.phase = k.clips.special_in ? 'in' : 'loop';
        k.energy -= mv.cost * k.stats.specialCost;
        if (k.clips.special_in) k.play('special_in', { full: true });
        this.app.audio && this.app.audio.roar(k, 0.8);
      }
      if (S.on) {
        S.t += dt;
        S.glow = 1;
        if (S.phase === 'in') {
          if (S.t >= clipDur('special_in', 0.7)) {
            S.phase = 'loop';
            // the charge cycle is authored at run pace; play it as fast as the charge actually goes
            if (k.clips.special_loop) k.play('special_loop', { full: true, loop: true, fade: 0.1, speed: 1.45 });
          }
        } else k.speed = Math.max(k.speed, k.runSpeed * 1.2);
        if (S.t > mv.duration * (1 + 0.1 * (this.cfg.levels?.power || 0))) {
          S.on = false; S.kind = null; S.phase = null;
          if (k.clips.special_out) k.play('special_out', { full: true, fade: 0.15 });
        }
      } else S.glow = Math.max(0, S.glow - dt);
    }
  }

  // ------------------------------------------------------------------ damage

  // Apply damage to every chunk in a sphere at most once per swing.
  damageVolume(p, r, dmg, push, src) {
    const B = this.world.buildings;
    let n = 0;
    const touched = new Set();
    B.forChunksInSphere(p, r, (id, d) => {
      const f = 1 - 0.55 * (d / r);
      B.hp[id] -= dmg * f;
      B.dmgv[id] = Math.min(1, B.dmgv[id] + 0.4 * f);
      touched.add(B.bid[id]);
      if (B.hp[id] <= 0) { B.breakChunk(id, push, Math.min(1.5, 0.6 + dmg / 400), src); n++; }
      else B._setState(id);
    });
    for (const bi of touched) B.checkSupport(this.world.city.buildings[bi]);
    if (this.traffic) this.traffic.crushSphere(p, r, push);
    return n;
  }

  _moveHits(dt) {
    const k = this.kaiju, A = k.action;
    if (!A || !A.move) return;
    const mv = this.def.moves[A.move];
    if (!mv) return;
    const ct = A.t * (k.clips[A.name].duration / A.dur); // clip seconds, whatever the play rate
    const S = k.scale;
    if (A.move === 'stomp') {
      if (!A.hitDone && ct >= (mv.time || 0.85)) {
        A.hitDone = true;
        const foot = k.bonePos(mv.foot || 'toeR', new THREE.Vector3());
        foot.y = this.world.groundAt(foot.x, foot.z);
        this.slam(k, foot, mv.radius * S * (this.genes.has('seismic') ? 1.25 : 1), k.stats.stomp);
      }
      return;
    }
    if (ct < mv.window[0] || ct > mv.window[1]) return;
    const bones = mv.bones || [mv.bone];
    const dmg = A.move === 'heavy' ? k.stats.heavy : k.stats.melee;
    const B = this.world.buildings;
    const pts = bones.map((b) => k.bonePos(b, new THREE.Vector3()));
    if (mv.reach) {
      const f = k.forward;
      for (const p of pts) p.addScaledVector(f, mv.reach * S);
    }
    if (mv.aoe) {
      if (!A.hitDone) {
        A.hitDone = true;
        const c = pts[0].clone().add(pts[pts.length - 1]).multiplyScalar(0.5);
        c.y = this.world.groundAt(c.x, c.z);
        this.slam(k, c, mv.radius * S, dmg);
      }
      return;
    }
    const prev = this.swingPrev || pts;
    const R = mv.radius * S;
    let broke = 0;
    const touched = new Set();
    for (let i = 0; i < pts.length; i++) {
      const a = prev[i], b = pts[i];
      const vel = _v2.subVectors(b, a).multiplyScalar(1 / Math.max(dt, 1e-3));
      const push = vel.clone().multiplyScalar(0.35).add(_v.set(0, 6, 0));
      const steps = Math.max(1, Math.ceil(a.distanceTo(b) / (R * 0.6)));
      for (let s = 0; s <= steps; s++) {
        const p = _v.lerpVectors(a, b, s / steps).clone();
        B.forChunksInSphere(p, R, (id, d) => {
          if (this.swingHit.has(id)) return;
          this.swingHit.add(id);
          const f = 1 - 0.5 * d / R;
          B.hp[id] -= dmg * f;
          B.dmgv[id] = Math.min(1, B.dmgv[id] + 0.6);
          touched.add(B.bid[id]);
          if (B.hp[id] <= 0) { B.breakChunk(id, push, 1.2, 'melee'); broke++; }
          else B._setState(id);
        });
        this.hitUnitsSphere(p, R * 1.2, dmg * 0.5, 'melee', push);
        if (this.traffic) this.traffic.crushSphere(p, R, push);
      }
      // a single segment between consecutive bones (tail) also sweeps
      if (i > 0 && mv.bones) {
        const mid = _v.lerpVectors(pts[i - 1], pts[i], 0.5).clone();
        B.forChunksInSphere(mid, R, (id) => {
          if (this.swingHit.has(id)) return;
          this.swingHit.add(id);
          B.hp[id] -= dmg;
          touched.add(B.bid[id]);
          if (B.hp[id] <= 0) { B.breakChunk(id, push, 1.2, 'melee'); broke++; } else B._setState(id);
        });
      }
    }
    for (const bi of touched) B.checkSupport(this.world.city.buildings[bi]);
    if (broke && !A.hitDone) {
      A.hitDone = true;
      this.rig.addTrauma(0.35);
      this.hitstop = 0.06;
      this.app.audio && this.app.audio.impact(pts[0], Math.min(1, broke / 6));
      this._element(pts[0], R, dmg);
    }
    this.swingPrev = pts;
  }

  slam(k, p, radius, dmg) {
    const B = this.world.buildings;
    this.damageVolume(new THREE.Vector3(p.x, p.y + radius * 0.25, p.z), radius * 0.75, dmg, new THREE.Vector3(0, 14, 0), 'stomp');
    this.hitUnitsSphere(p, radius * 1.4, dmg * 0.8, 'stomp');
    if (this.traffic) this.traffic.blast(p, radius * 1.6);
    if (this.props) this.props.knock(p, radius);
    if (this.crowds) this.crowds.scare(p, radius * 6);
    this.particles.surge(p, radius, 26, { color: [0.5, 0.47, 0.43], speed: radius * 0.9, life: 12, grow: 0.8 });
    this.particles.dust(p, radius * 0.3, 10, { up: 1.2, speed: radius * 0.5 });
    const g = this.world.groundAt(p.x, p.z);
    if (g > -0.5) {
      this.decals.add(DECAL.CRATER, p.x, g, p.z, radius * 0.9);
      this.decals.add(DECAL.CRACK, p.x, g, p.z, radius * 1.8);
    } else {
      this.world.env.ripple(p.x, p.z, 1);
      this.particles.splash(p, radius * 0.6, 30);
    }
    this.rig.impulse(p, 0.85, radius * 12);
    this.fx.flash = 0.05;
    this.app.audio && this.app.audio.slam(p, 1);
    B.dustAround(p, radius * 2.5, 0.3);
    this._element(p, radius * 0.75, dmg);
    if (this.form.element === 'quake') this.dots.push({ kind: 'quake', p: p.clone(), r: radius * 1.7, dmg: dmg * 0.35, t: 0 });
  }

  explode(p, r, dmg, push) {
    this.damageVolume(p, r, dmg, push, 'explosion');
    if (this.props && p.y < 20) this.props.knock(p, r);
    if (this.traffic && p.y < 20) this.traffic.blast(p, r * 1.5);
    this.hitUnitsSphere(p, r * 1.5, dmg, 'explosion');
    this.world.buildings.ignite(p, r, 0.5);
    this.particles.fireball(p, r * 0.35);
    this.particles.dust(p, r * 0.5, 8, { up: 0.8 });
    this.rig.impulse(p, 0.7, r * 14);
    if (p.y < 4) this.decals.add(DECAL.SCORCH, p.x, Math.max(0, this.world.groundAt(p.x, p.z)), p.z, r * 2.2);
    this.app.audio && this.app.audio.explosion(p, Math.min(1, r / 30));
  }

  hitUnitsSphere(p, r, dmg, src, push) {
    if (this.military) this.military.damageSphere(p, r, dmg, src, push);
    if (this.crowds) this.crowds.crush(p, r);
  }

  // The kaiju's body plows through whatever it walks into.
  _bodyContact(dt) {
    const k = this.kaiju;
    if (k.dead) return;
    const sp = k.speed + (k.special.kind === 'charge' && k.special.on ? k.runSpeed : 0);
    if (sp < 1) return;
    const B = this.world.buildings;
    const caps = k.bodyCapsules();
    if (this.props) for (const [a, b, r] of caps) if (b.y - r < 12) this.props.knock(b, r * 1.2);
    if (this.crowds) for (const [a, b, r] of caps) if (b.y - r < 3) this.crowds.crush(b, r);
    const hit = new Map();
    for (const [a, b, r] of caps) {
      const steps = Math.max(1, Math.ceil(a.distanceTo(b) / r));
      for (let s = 0; s <= steps; s++) {
        _v.lerpVectors(a, b, s / steps);
        if (_v.y - r > 200) continue;
        B.forChunksInSphere(_v, r, (id, d) => hit.set(id, Math.max(hit.get(id) || 0, 1 - d / r)));
      }
    }
    if (!hit.size) return;
    const charge = k.special.on && k.special.kind === 'charge' ? 4 : 1;
    const thorns = this.genes.has('thorns');
    const dmg = 220 * (sp / Math.max(1, k.walkSpeed)) * k.scale * charge * dt * (thorns ? 2 : 1);
    if (thorns) for (const [a, b, r] of caps) if (b.y - r < 8) this.hitUnitsSphere(b, r * 1.1, 400 * dt, 'body');
    const push = k.vel.clone().multiplyScalar(1.1).add(_v2.set(0, 3, 0));
    const touched = new Set();
    for (const [id, f] of hit) {
      B.hp[id] -= dmg * (0.4 + f);
      touched.add(B.bid[id]);
      if (B.hp[id] <= 0) B.breakChunk(id, push, 0.9, 'body');
    }
    for (const bi of touched) B.checkSupport(this.world.city.buildings[bi]);
    // buildings resist in proportion to what is in the way, up to a cap: against the kaiju's
    // acceleration (rate 0.85) a full wall of blocks settles it at ~45% of its intended speed
    k.speed *= Math.exp(-1.05 * Math.min(1, hit.size / 60) * dt / charge);
    if (Math.random() < dt * 6) this.app.audio && this.app.audio.crumble(_v.copy(k.pos).setY(20), 0.5);
  }

  _water(dt) {
    const k = this.kaiju;
    const g = this.world.groundAt(k.pos.x, k.pos.z);
    const env = this.world.env;
    if (g < -1) {
      env.setWake(0, k.pos.x, k.pos.z, 26 * k.scale, clamp(k.speed / k.walkSpeed, 0.25, 1));
      if (Math.random() < dt * 4 * (k.speed / k.walkSpeed + 0.2)) {
        const p = k.pos.clone(); p.y = -1.2;
        p.x += (Math.random() - 0.5) * 30 * k.scale; p.z += (Math.random() - 0.5) * 30 * k.scale;
        this.particles.splash(p, 7 * k.scale, 4);
      }
    } else env.setWake(0, 0, 0, 0, 0);
  }

  // ------------------------------------------------------------------ world events

  onChunkBroken(e) {
    const s = e.info.size;
    const vol = s[0] * s[1] * s[2];
    this.debris.shatter(e.info, e.center, e.rot, e.vel, e.push, e.strength);
    const big = Math.cbrt(vol);
    this.particles.dust(e.center, big * 0.8, e.src === 'collapse' ? 2 : 4, { life: 10, grow: 2.2, speed: big * 0.4 });
    if (e.info.style[0] === 0 || e.info.style[0] === 3) { this.particles.glints(e.center, 10, big); this.app.audio && this.app.audio.glassAt(e.center); }
    if (this.app.audio && e.src !== 'collapse') this.app.audio.crumble(e.center, Math.min(1.2, big / 12));
    if (e.src === 'beam' || e.src === 'explosion' || e.info.state[2] > 0.3) { this.particles.fire(e.center, big * 0.7); }
    this.lastCrumble += 1;
  }

  onCollapse(b, g) {
    const c = new THREE.Vector3(b.x0 + b.w / 2, 0, b.z0 + b.d / 2);
    this.app.audio && this.app.audio.collapse(c, Math.min(1, g.height / 120));
    this.rig.impulse(c, 0.35, 900);
    this.feedPush(g.mode === 'topple' ? 'Toppling!' : 'Collapse!');
  }

  onGroupImpact(p, speed, g) {
    g.dustT = (g.dustT || 0) - 1;
    if (g.dustT > 0) return;
    g.dustT = 4;
    const sz = Math.max(g.b.cw, g.b.cd) * 1.3;
    this.particles.dust(p, sz, 3, { life: 18, grow: 2.6, speed: sz * 0.6, up: 0.4 });
    if (p.y < 6) this.particles.surge(new THREE.Vector3(p.x, 0, p.z), sz * 1.4, 6, { life: 20, grow: 1.1 });
  }

  onBuildingDown(b) {
    const c = new THREE.Vector3(b.x0 + b.w / 2, 0, b.z0 + b.d / 2);
    const R = Math.max(b.w, b.d) * (0.8 + Math.min(1.6, b.h / 110));
    this.pendingDust.push({ p: c, r: R, t: 0.6, h: b.h });
    this.score.buildings++;
    if (b.kind === 'tower') { this.score.towers++; this.feedPush('Skyscraper destroyed'); }
    const k = this.kaiju;
    if (this.genes.has('regen') && k && !k.dead) k.hp = Math.min(k.maxHp, k.hp + k.maxHp * 0.025);
    const v = b.w * b.d * b.h * (b.kind === 'tower' ? 4200 : 3000);
    this.app.ui && this.app.ui.popup(c.setY(b.h * 0.5), '$' + fmtMoney(v));
  }

  _pending(dt) {
    for (let i = this.pendingDust.length - 1; i >= 0; i--) {
      const d = this.pendingDust[i];
      d.t -= dt;
      if (d.t > 0) continue;
      this.particles.surge(d.p, d.r, 30, { life: 28, grow: 0.9, speed: d.r * 0.7 });
      this.particles.dust(d.p, d.r * 0.35, 12, { life: 26, up: 0.6, grow: 2.8 });
      this.world.buildings.dustAround(d.p, d.r * 3, 0.5);
      this.decals.add(DECAL.CRATER, d.p.x, 0, d.p.z, d.r * 0.9);
      this.pendingDust.splice(i, 1);
    }
  }

  _fires(dt) {
    const B = this.world.buildings;
    if (!B.burning.size) return;
    const n = Math.min(B.burning.size, Math.ceil(dt * 40));
    const arr = this._burnArr && this._burnArr.length === B.burning.size ? this._burnArr : (this._burnArr = [...B.burning]);
    for (let i = 0; i < n; i++) {
      const id = arr[Math.floor(Math.random() * arr.length)];
      if (!B.alive[id]) continue;
      const [b, ix, iy, iz] = B.chunkCoords(id);
      const p = B.chunkCenter(id, _v);
      p.y = (iy + 1) * b.ch - 1;
      const heat = B.burn[id];
      if (Math.random() < 0.6) this.particles.fire(p, Math.max(b.cw, b.cd) * 0.7 * heat, { rise: 8, life: 1.6 });
      if (Math.random() < 0.35) this.particles.smoke(p, Math.max(b.cw, b.cd) * 0.6, { dark: 0.06 + Math.random() * 0.06, rise: 9, heat: heat * 0.5, life: 24, grow: 6 });
    }
    if (Math.random() < dt) this._burnArr = null;
  }

  _objectives(dt) {
    if (this.state !== 'play') return;
    const goals = this.mission.goals;
    if (!goals.length) return;
    let done = true;
    for (const g of goals) {
      g.progress = this.goalProgress(g);
      if (g.progress < 1) done = false;
    }
    if (done && !this.complete) {
      this.complete = true;
      this.app.ui && this.app.ui.objectiveComplete(this);
      this.app.audio && this.app.audio.sting('victory');
    }
  }

  goalProgress(g) {
    switch (g.kind) {
      case 'damage': return Math.min(1, this.score.damage / g.value);
      case 'towers': return Math.min(1, this.score.towers / g.value);
      case 'percent': return Math.min(1, this.world.buildings.destroyedFraction / g.value);
      case 'survive': return Math.min(1, this.time / g.value);
      case 'landmark': return Math.min(1, this.score.landmark / g.value);
      default: return 0;
    }
  }

  onFootstep(k, foot, s) {
    const p = k.bonePos(foot, new THREE.Vector3());
    const g = this.world.groundAt(p.x, p.z);
    p.y = g;
    const S = k.scale;
    const seis = this.genes.has('seismic') ? 1.5 : 1;
    if (g > -0.5) {
      this.decals.add(DECAL.FOOT, p.x, g, p.z, 13 * S, k.yaw + Math.PI, 1.1);
      this.particles.dust(p, 8 * S * seis, 3, { life: 6, grow: 1.8, speed: 6, up: 0.3 });
      this.damageVolume(p.clone().setY(3), 7 * S * seis, 120 * S * (seis > 1 ? 3 : 1), new THREE.Vector3(0, 4, 0), 'foot');
    } else {
      p.y = -1.2;
      this.particles.splash(p, 7 * S, 8);
      this.world.env.ripple(p.x, p.z, 0.5 * s);
    }
    this.rig.impulse(p, 0.22 * s, 420 * S);
    if (this.props) this.props.knock(p, 12 * S);
    if (this.traffic) this.traffic.blast(p, 30 * S * seis);
    if (seis > 1 && g > -0.5) this.hitUnitsSphere(p, 14 * S * seis, 60, 'foot');
    if (this.crowds) this.crowds.scare(p, 300);
    this.app.audio && this.app.audio.footstep(p, s, g < -0.5);
  }

  onActionEnd(name) {}

  onDied() {
    this.app.audio && this.app.audio.sting('defeat');
    setTimeout(() => this.finish(false), 4500);
  }

  feedPush(text) {
    this.feed.push({ text, t: this.time });
    if (this.feed.length > 5) this.feed.shift();
  }

  finish(retreat) {
    if (this.state === 'done') return;
    this.state = 'done';
    this.app.endMission(this, { retreat, complete: !!this.complete, died: this.kaiju.dead });
  }

  dispose() {
    SG.uCutR.value = 0;
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose && m.dispose();
    });
    this.world.csm.dispose();
  }
}

export function fmtMoney(v) {
  if (v >= 1e12) return (v / 1e12).toFixed(2) + 'T';
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(0) + 'M';
  return Math.round(v / 1e3) + 'K';
}

const tick = () => new Promise((r) => setTimeout(r, 0));
