// Seeded, phase-gated environmental anomalies that never happen in plain view.
import * as THREE from 'three';
import { S } from '../entity/RemainderAI.js';

export class Anomalies {
  constructor(game) {
    this.game = game;
    this.rng = game.rng.fork('anomaly');
    this.timer = 30;
    this.done = new Set();
    this.mirrorT = 0;
    this.events = [
      { id: 'flicker', phase: 1, weight: 3, repeat: true, run: () => this.flicker() },
      { id: 'doorCreak', phase: 2, weight: 3, repeat: true, run: () => this.doorCreak() },
      { id: 'distantSteps', phase: 2, weight: 2, repeat: true, run: () => this.distantSteps() },
      { id: 'knock', phase: 2, weight: 2, repeat: true, run: () => this.knock() },
      { id: 'radioOn', phase: 2, weight: 1, run: () => this.radioOn() },
      { id: 'chairs', phase: 3, weight: 2, run: () => this.chairs() },
      { id: 'wheelchair', phase: 3, weight: 2, run: () => this.wheelchair() },
      { id: 'phone', phase: 3, weight: 1, run: () => this.game.story.ringPhone() },
      { id: 'whisper', phase: 4, weight: 2, repeat: true, run: () => this.whisper() },
      { id: 'pipes', phase: 3, weight: 2, repeat: true, run: () => this.pipes() },
      { id: 'lightsOut', phase: 4, weight: 1, repeat: true, run: () => this.lightsOut() },
      { id: 'dummy', phase: 4, weight: 1, run: () => this.dummy() },
    ];
  }

  // Is a world point inside the player's view (and visible)?
  inView(x, y, z) {
    const g = this.game;
    const cam = g.camera;
    const v = new THREE.Vector3(x, y, z).project(cam);
    const onScreen = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    return onScreen && g.grid.los(g.player.pos.x, g.player.pos.z, x, z);
  }

  update(dt) {
    const g = this.game;
    if (g.story.flags.finale && !g.story.flags.fullSpectrum) { this.timer -= dt * 1.5; }
    else this.timer -= dt;
    this.updateMirror(dt);
    if (this.timer > 0) return;
    const ai = g.ai;
    if (ai.state === S.CHASE || g.director.mode === 'relax') { this.timer = 8; return; }
    const phase = g.story.phase;
    const cands = this.events.filter((e) => e.phase <= phase && (e.repeat || !this.done.has(e.id)));
    if (!cands.length) { this.timer = 30; return; }
    const e = this.rng.weighted(cands, (c) => c.weight);
    const ok = e.run();
    if (ok !== false) this.done.add(e.id);
    this.timer = this.rng.range(28, 60) / (0.7 + phase * 0.1);
  }

  flicker() { const p = this.game.player.pos; this.game.lights.flickerNear(p.x, p.z, 9, 0.9); }

  doorCreak() {
    const g = this.game, p = g.player.pos;
    const cands = g.doors.list.filter((d) => !g.doors.isOpen(d) && !g.doors.isLocked(d) && ['wood', 'woodGlass', 'studio', 'metal'].includes(d.style) && Math.abs(d.y - p.y) < 2)
      .filter((d) => { const dd = Math.hypot(d.cx - p.x, d.cz - p.z); return dd > 5 && dd < 18 && !this.inView(d.cx, d.y + 1, d.cz); });
    if (!cands.length) return false;
    const d = this.rng.pick(cands);
    g.doors.open(d, d.cx + this.rng.sign(), d.cz + this.rng.sign(), { slow: true, byEntity: true });
    g.ui.caption('[a door creaks open]');
  }

  distantSteps() {
    const g = this.game, p = g.player.pos;
    const pt = g.nav.randomPointNear(this.rng, p.x, p.z, 10, 18);
    if (!pt || this.inView(pt.x, p.y + 0.5, pt.z)) return false;
    for (let k = 0; k < 6; k++) g.audio.playAt('step_concrete', { x: pt.x + k * 0.4, y: g.map.floorAt(pt.x, pt.z), z: pt.z }, { gain: 0.7, delay: k * 0.62 });
    g.ui.caption('[footsteps]');
  }

  knock() {
    const g = this.game, p = g.player.pos;
    for (let k = 0; k < 12; k++) {
      const a = this.rng.range(0, Math.PI * 2);
      const x = p.x + Math.cos(a) * 2.2, z = p.z + Math.sin(a) * 2.2;
      if (g.grid.cellBlocksSight(Math.floor(x), Math.floor(z))) {
        g.audio.playAt('knock', { x, y: p.y + 1.2, z }, { gain: 0.9 });
        g.ui.caption('[three knocks, inside the wall]');
        return;
      }
    }
    return false;
  }

  radioOn() {
    const g = this.game, p = g.player.pos;
    if (Math.hypot(p.x - 15, p.z - 37.3) < 10 || g.story.radioLoop) return false;
    g.story.toggleRadio();
    g.ui.caption('[faint music, somewhere]');
  }

  chairs() {
    const g = this.game;
    const pz = g.map.zoneAt(g.player.pos.x, g.player.pos.z);
    if (pz?.ch === 'l') return false;
    const c = g.propsById.get('loungeChair');
    if (c) { c.rotation.y += Math.PI; c.position.z -= 0.3; }
    g.story.flags.chairsTurned = true;
  }

  wheelchair() {
    const g = this.game;
    const w = g.propsById.get('wheelchair');
    if (!w || this.inView(w.position.x, w.position.y + 0.5, w.position.z)) return false;
    w.position.x += 2.4; w.rotation.y += 0.9;
    if (Math.hypot(g.player.pos.x - w.position.x, g.player.pos.z - w.position.z) < 25) g.audio.playAt('scratch', { x: w.position.x, y: w.position.y + 0.3, z: w.position.z }, { gain: 0.4 });
  }

  whisper() {
    const g = this.game, p = g.player;
    const f = p.forward(new THREE.Vector3());
    g.audio.playAt('whisper', { x: p.pos.x - f.x * 1.2, y: p.pos.y + 1.6, z: p.pos.z - f.z * 1.2 }, { gain: 0.35, ref: 0.6 });
    g.ui.caption('[a whisper, right behind you]');
  }

  pipes() {
    const g = this.game, p = g.player.pos;
    if (p.y > -1.5) return this.knock();
    g.audio.playAt('knock', { x: p.x + this.rng.range(-6, 6), y: p.y + 2.2, z: p.z + this.rng.range(-6, 6) }, { gain: 0.8, rate: 0.6 });
    g.ui.caption('[the pipes knock]');
  }

  lightsOut() {
    const g = this.game, p = g.player.pos;
    g.lights.killNear(p.x, p.z, 7, this.rng.range(2, 5));
    g.audio.play('click', { gain: 0.3 });
  }

  dummy() {
    const g = this.game;
    const d = g.propsById.get('dummyOffice');
    if (!d) return false;
    const pz = g.map.zoneAt(g.player.pos.x, g.player.pos.z);
    if (pz?.ch === '7') return false;
    d.position.set(54.5, d.position.y, 37.6);
    d.rotation.y = 0;
  }

  // Mirror: phase >= 3, something stands behind you in the reflection only.
  updateMirror(dt) {
    const g = this.game;
    const ghost = g.mirrorGhost;
    if (!ghost) return;
    const inRest = g.map.zoneAt(g.player.pos.x, g.player.pos.z)?.ch === 't';
    if (!inRest || g.story.phase < 3 || this.done.has('mirror')) { ghost.root.visible = false; this.mirrorT = 0; return; }
    const f = g.player.forward(new THREE.Vector3());
    const facingMirror = f.x < -0.6 && g.player.pos.x < 9.5;
    if (facingMirror) {
      this.mirrorT += dt;
      if (this.mirrorT > 1.2) {
        ghost.root.visible = true;
        ghost.root.position.set(g.player.pos.x + 2.6, g.map.floorAt(9, 41), g.player.pos.z + 0.4);
        ghost.root.rotation.y = -Math.PI / 2;
        if (!this.mirrorSting) { this.mirrorSting = true; g.audio.play('inhale', { gain: 0.5, variant: 1 }); }
        if (this.mirrorT > 3.0) { this.done.add('mirror'); ghost.root.visible = false; g.audio.play('click', { gain: 0.3 }); g.lights.killNear(8, 41, 6, 1.5); }
      }
    } else if (this.mirrorT > 1.2) { this.done.add('mirror'); ghost.root.visible = false; }
  }

  serialize() { return { done: [...this.done] }; }
  deserialize(d) { this.done = new Set(d?.done || []); this.timer = 30; this.mirrorSting = false; }
}
