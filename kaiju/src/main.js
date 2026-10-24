// LANDFALL: boot, screens, the menu stage, mission flow and the main loop.
import * as THREE from 'three';
import { Renderer } from './render/Renderer.js';
import { Input } from './core/Input.js';
import { Play } from './game/Play.js';
import { MenuStage } from './game/MenuStage.js';
import { UI } from './ui/UI.js';
import { Audio } from './audio/Audio.js';
import { Military } from './game/Military.js';
import { Traffic } from './game/Traffic.js';
import { Crowds } from './game/Crowds.js';
import { KAIJU, UPGRADES, MISSIONS, FORMS, GENES, GENE_SLOTS } from './core/Config.js';
import { loadProfile, saveProfile, loadSettings, saveSettings, missionUnlocked } from './core/Save.js';

class App {
  constructor() {
    this.canvas = document.getElementById('view');
    this.settings = loadSettings();
    this.profile = loadProfile();
    this.params = new URLSearchParams(location.search);
    const q = this.params.get('q') || this.settings.quality;
    this.renderer = new Renderer(this.canvas, q);
    this.renderer.noBloom = this.params.get('bloom') === '0';
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, 16 / 9, 1.5, 16000);
    this.input = new Input(this.canvas);
    this.applySettings();
    this.audio = new Audio(this);
    this.ui = new UI(this);
    this.systems = { military: Military, traffic: Traffic, crowds: Crowds };
    this.play = null;
    this.menu = null;
    this.state = 'boot';
    this.paused = false;
    this.last = performance.now();
    this.fps = 60;
    addEventListener('resize', () => this.renderer.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play') this.pause(true); });
    window.__kj = { app: this, THREE, ready: false };
    requestAnimationFrame((t) => this.loop(t));
  }

  applySettings() {
    const s = this.settings;
    this.input.sens = s.sensitivity;
    this.input.invertY = s.invertY;
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
    if (this.audio) this.audio.setVolumes(s);
    if (this.play && this.play.rig) { this.play.rig.fovBase = s.fov; this.play.rig.shakeScale = s.shake; this.play.rig.reduced = s.reducedMotion; }
  }

  saveSettings() { saveSettings(this.settings); this.applySettings(); }
  save() { saveProfile(this.profile); }

  async boot() {
    this.ui.loading(0.1, 'Preparing the menu stage');
    this.menu = new MenuStage(this);
    await this.menu.init();
    this.renderer.setup(this.menu.scene, this.camera);
    window.__kj.ready = true;
    const auto = this.params.get('auto');
    if (auto) {
      const form = this.params.get('form'), genes = this.params.get('genes');
      const opts = { time: this.params.get('time') || undefined, city: this.params.get('city') || undefined };
      // test hook: ?form=infernal&genes=thorns,echo overrides the saved mutation
      if (form || genes) opts.mut = { form: FORMS[form] ? form : 'prime', genes: (genes || '').split(',').filter((g) => GENES[g]) };
      this.startMission(this.params.get('mission') || 'landfall', KAIJU[auto] ? auto : Object.keys(KAIJU)[0], opts);
      return;
    }
    this.state = 'title';
    this.ui.show('title');
  }

  // ------------------------------------------------------------------ menu actions

  selectKaiju(id) {
    if (!this.profile.unlocked[id]) return;
    this.profile.selected = id;
    this.save();
    this.menu.showKaiju(id);
  }

  unlockKaiju(id) {
    const d = KAIJU[id];
    if (this.profile.unlocked[id] || this.profile.biomass < d.cost) return false;
    this.profile.biomass -= d.cost;
    this.profile.unlocked[id] = true;
    this.profile.selected = id;
    this.save();
    this.audio.ui('unlock');
    this.menu.showKaiju(id);
    return true;
  }

  buyUpgrade(id, up) {
    const u = UPGRADES.find((x) => x.id === up);
    const L = this.profile.levels[id] || (this.profile.levels[id] = {});
    const lv = L[up] || 0;
    if (lv >= u.max) return false;
    const cost = u.cost[lv];
    if (this.profile.biomass < cost) return false;
    this.profile.biomass -= cost;
    L[up] = lv + 1;
    this.save();
    this.audio.ui('upgrade');
    if (up === 'growth') this.menu.showKaiju(id, true);
    return true;
  }

  // ------------------------------------------------------------------ mutation lab

  mutState(id) { return this.profile.mut[id] || (this.profile.mut[id] = { forms: ['prime'], form: 'prime', genes: [] }); }

  // Mutate into a strain (bought on first use), or switch back to one already grown.
  mutate(id, form) {
    const F = FORMS[form], M = this.mutState(id);
    if (!F || !this.profile.unlocked[id]) return false;
    if (!M.forms.includes(form)) {
      if (this.profile.biomass < F.cost) return false;
      this.profile.biomass -= F.cost;
      M.forms.push(form);
      this.audio.ui('unlock');
    } else this.audio.ui('upgrade');
    M.form = form;
    this.save();
    this.menu.showKaiju(id, false, form);
    return true;
  }

  buyGene(g) {
    const G = GENES[g];
    if (!G || this.profile.genes.includes(g) || this.profile.biomass < G.cost) return false;
    this.profile.biomass -= G.cost;
    this.profile.genes.push(g);
    this.save();
    this.audio.ui('unlock');
    return true;
  }

  // Slot an owned gene into a kaiju, or take it out again.
  toggleGene(id, g) {
    const M = this.mutState(id);
    if (!this.profile.genes.includes(g)) return false;
    const i = M.genes.indexOf(g);
    if (i >= 0) M.genes.splice(i, 1);
    else if (M.genes.length < GENE_SLOTS) M.genes.push(g);
    else return false;
    this.save();
    this.audio.ui('upgrade');
    if (g === 'giant') this.menu.showKaiju(id, true);
    return true;
  }

  async startMission(missionId, kaijuId, opts = {}) {
    const m = MISSIONS.find((x) => x.id === missionId);
    if (!m || (!missionUnlocked(this.profile, m) && !this.params.get('auto'))) return;
    this.state = 'loading';
    this.audio.resume();
    this.ui.show('loading');
    if (this.menu) this.menu.active = false;
    if (this.play) { this.play.dispose(); this.play = null; }
    const play = new Play(this, { missionId, kaijuId, levels: this.profile.levels[kaijuId], mut: this.mutState(kaijuId), ...opts });
    try {
      await play.load((f, t) => this.ui.loading(f, t));
    } catch (e) {
      console.error(e);
      this.ui.error('Could not load the mission: ' + e.message);
      return;
    }
    this.play = play;
    this.state = 'play';
    this.paused = false;
    this.ui.hudSetup(play);
    this.ui.show('hud');
    this.input.lock();
    window.__kj.play = play;
  }

  pause(on) {
    if (this.state !== 'play') return;
    this.paused = on;
    this.ui.show(on ? 'pause' : 'hud');
    if (on) this.input.unlock(); else this.input.lock();
    this.audio.pause(on);
  }

  retreat() {
    if (this.play) { this.paused = false; this.play.finish(true); }
  }

  endMission(play, result) {
    const m = play.mission;
    const s = play.score;
    let reward = Math.round(s.damage / 1e9 * 22 + s.kills * 6 + s.towers * 40);
    if (result.complete) reward += m.reward;
    if (result.died) reward = Math.round(reward * 0.5);
    this.profile.biomass += reward;
    const rec = this.profile.missions[m.id] || (this.profile.missions[m.id] = { done: false, best: 0 });
    if (result.complete) rec.done = true;
    rec.best = Math.max(rec.best, s.damage);
    const st = this.profile.stats;
    st.rampages++; st.damage += s.damage; st.towers += s.towers; st.kills += s.kills;
    this.save();
    this.input.unlock();
    this.state = 'results';
    this.ui.results(play, result, reward);
  }

  toMenu() {
    if (this.play) { this.play.dispose(); this.play = null; window.__kj.play = null; }
    this.audio.stopAll();
    this.renderer.setup(this.menu.scene, this.camera);
    this.menu.active = true;
    this.state = 'lab';
    this.ui.show('lab');
    this.menu.showKaiju(this.profile.selected);
  }

  // ------------------------------------------------------------------ loop

  loop(t) {
    requestAnimationFrame((tt) => this.loop(tt));
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (!(dt > 0)) return;
    dt = Math.min(dt, 1 / 20);
    this.fps = this.fps * 0.95 + (1 / dt) * 0.05;
    this.input.poll();
    try {
      if (this.state === 'play' && this.play) {
        if (this.input.pause) this.pause(!this.paused);
        if (!this.paused) this.play.update(dt);
        this.renderer.render(this.paused ? 0 : dt);
        this._adapt(dt);
      } else if (this.menu && this.menu.active) {
        this.menu.update(dt);
        this.renderer.render(dt);
      }
      this.ui.frame(dt);
    } catch (e) {
      console.error(e);
      this.ui.error(e.message + '\n' + (e.stack || ''));
      this.state = 'error';
    }
    this.input.endFrame();
  }

  // dynamic resolution keeps frame time near the target on weaker GPUs
  _adapt(dt) {
    const R = this.renderer;
    this._ft = (this._ft || 16) * 0.97 + dt * 1000 * 0.03;
    this._adaptT = (this._adaptT || 0) + dt;
    if (this._adaptT < 1.5) return;
    this._adaptT = 0;
    const cur = R.dynScale || 1;
    let next = cur;
    if (this._ft > 24) next = Math.max(0.6, cur - 0.08);
    else if (this._ft < 15 && cur < 1) next = Math.min(1, cur + 0.05);
    if (next !== cur) { R.dynScale = next; R.resize(); }
  }
}

const app = new App();
app.boot().catch((e) => { console.error(e); app.ui.error(String(e && e.stack || e)); });
