// Game orchestrator: boot, modes, update loop, save/load, death and endings.
import * as THREE from 'three';
import { Settings } from './Settings.js';
import { Input } from './Input.js';
import { Events } from './Events.js';
import { Rng, hashString } from './Rng.js';
import { buildMapData, ZONES, POINTS } from '../world/MapData.js';
import { Grid } from '../world/Grid.js';
import { Nav } from '../world/Nav.js';
import { generateTextures } from '../world/Textures.js';
import { MaterialLibrary } from '../world/Materials.js';
import { LevelBuilder, buildWindows, buildFences, buildChamberWedges, buildGround, buildForest, makeChainLinkTexture } from '../world/LevelBuilder.js';
import { PropBuilder } from '../world/Props.js';
import { makeDecor } from '../world/Decor.js';
import { Doors } from '../world/Doors.js';
import { Lights } from '../world/Lights.js';
import { PostFX } from '../render/PostFX.js';
import { Mirror } from '../render/Mirror.js';
import { Player } from '../player/Player.js';
import { Inventory } from '../player/Inventory.js';
import { Interaction } from '../player/Interaction.js';
import { Story, Power } from '../story/Story.js';
import { RemainderAI, Director, PlayerModel, S } from '../entity/RemainderAI.js';
import { makeMirrorGhost } from '../entity/Remainder.js';
import { Anomalies } from '../horror/Anomalies.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { UI } from '../ui/UI.js';
import { DOCS } from '../story/Documents.js';

const SAVE_KEY = 'anechoic.save.v1';
const META_KEY = 'anechoic.meta.v1';

export class Game {
  constructor() {
    this.params = new URLSearchParams(location.search);
    this.test = this.params.has('test');
    this.events = new Events();
    this.settings = new Settings();
    if (this.params.get('quality')) this.settings.data.quality = this.params.get('quality');
    this.canvas = document.getElementById('view');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.autoClear = false;
    this.renderer.shadowMap.enabled = this.settings.q.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.input = new Input(this.canvas);
    this.input.synthetic = this.test;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.get('fov'), 1, 0.05, 140);
    this.camera.layers.enable(0);
    this.post = new PostFX(this.renderer, this.settings);
    this.mode = 'loading';
    this.time = 0;
    this.camShake = 0;
    this.seed = Number(this.params.get('seed')) || Number(sessionStorage.getItem('anechoic.seed')) || (Math.floor(Math.random() * 1e9) + 1);
    sessionStorage.removeItem('anechoic.seed');
    this.rng = new Rng(this.seed);
    this.meta = this.loadMeta();
    this.oscillators = [];
    window.addEventListener('resize', () => this.resize());
    this.input.onLockChange = (locked) => { if (!locked && this.mode === 'play' && !this.test) this.pause(); };
    this.lastMoveDist = 0;
  }

  // ------------------------------------------------------------------ boot
  async init() {
    const bar = document.getElementById('load-fill'), txt = document.getElementById('load-text');
    const prog = (p, t) => { bar.style.width = (p * 100).toFixed(1) + '%'; if (t) txt.textContent = t; };
    prog(0.02, 'generating surfaces…');
    const tex = await generateTextures((p, k) => prog(0.02 + p * 0.4, `surfaces: ${k}`));
    this.mats = new MaterialLibrary(tex);
    prog(0.43, 'synthesising sound…');
    this.audio = new AudioEngine(this);
    await this.audio.synthesize((p) => prog(0.43 + p * 0.3, 'synthesising sound…'));
    prog(0.75, 'building Larkhollow…');
    await tick();
    this.map = buildMapData();
    this.grid = new Grid(this.map);
    this.nav = new Nav(this.map, this.grid);
    this.buildWorld();
    prog(0.9, 'placing what was left behind…');
    await tick();
    this.inventory = new Inventory(this);
    this.power = new Power(this);
    this.playerModel = new PlayerModel();
    this.ui = new UI(this);
    this.interaction = new Interaction(this);
    this.player = new Player(this);
    this.story = new Story(this);
    if (this._earlyStory) { this.story.portraitCanvas = this._earlyStory.portraitCanvas; this.story.portraitTex = this._earlyStory.portraitTex; }
    this.story.setup();
    this.ai = new RemainderAI(this);
    this.director = new Director(this);
    this.anomalies = new Anomalies(this);
    this.events.on('hide', (spot) => { if (this.ai.detect > 0.3 || (this.ai.seesPlayer)) { this.ai.lastSawHide = spot; this.ai.lastSawHideT = this.time; } });
    this.resize();
    prog(0.97, 'compiling shaders…');
    await tick();
    this.player.place(POINTS.start.x, POINTS.start.z, POINTS.start.yaw);
    this.player.updateCamera(0.016);
    this.lights.update(0.016, this.camera.position, 0);
    try { this.renderer.compile(this.scene, this.camera); } catch (e) { console.warn(e); }
    prog(1, 'ready');
    this.applyState(null);
    this.ready = true;
    window.__game = this;
    window.__ready = true;
    document.getElementById('loading').classList.remove('show');
    const auto = sessionStorage.getItem('anechoic.autostart');
    sessionStorage.removeItem('anechoic.autostart');
    if (this.test) { this.startNew(true); }
    else if (auto === 'new') { this.startNew(true); this.ui.show('click-to-play'); }
    else if (auto === 'continue') { this.loadCheckpoint(); this.ui.show('click-to-play'); }
    else this.toTitle();
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  buildWorld() {
    const s = this.scene;
    s.background = new THREE.Color(0x06080b);
    s.fog = new THREE.FogExp2(0x06080b, 0.045);
    s.add(new LevelBuilder(this.map, this.mats).build());
    s.add(buildWindows(this.map, this.mats));
    s.add(buildFences(this.map, this.mats, makeChainLinkTexture()));
    const wedges = buildChamberWedges(this.map, this.mats);
    if (wedges) { s.add(wedges.mesh); for (const c of wedges.colliders) { const col = { ...c, enabled: true, prop: { t: 'wedges' } }; this.grid.colliders.push(col); for (let z = Math.floor(c.z0); z <= Math.floor(c.z1); z++) for (let x = Math.floor(c.x0); x <= Math.floor(c.x1); x++) { const i = this.grid.idx(x, z); if (!this.grid.cellColliders.has(i)) this.grid.cellColliders.set(i, []); this.grid.cellColliders.get(i).push(col); } } }
    s.add(buildGround(this.mats));
    s.add(buildForest(this.map, this.mats, this.rng.fork('forest')));
    const props = new PropBuilder(this.map, this.mats, this.rng.fork('props')).buildAll();
    s.add(props.root);
    this.propsById = props.dynamic;
    const shelf = this.propsById.get('secretShelf');
    if (shelf) shelf.userData.baseZ = shelf.position.z;
    const decor = makeDecor(this.map, this.mats, { portraitTexture: () => this.storyTex('portraitTexture'), staffPhotoTexture: () => this.storyTex('staffPhotoTexture'), directoryTexture: () => this.storyTex('directoryTexture'), chalkTexture: (id) => this.storyTex('chalkTexture', id), boardTexture: (id, p) => this.storyTex('boardTexture', id, p) });
    s.add(decor.group);
    this.decorById = decor.byId;
    this.doors = new Doors(this);
    s.add(this.doors.group);
    this.lights = new Lights(this, this.map, this.settings.q.lightPool);
    s.add(this.lights.group);
    this.hemi = new THREE.HemisphereLight(0x5a6878, 0x1a1712, 0.06);
    s.add(this.hemi);
    // Mirror in the restrooms
    if (this.settings.q.mirror) {
      const mp = this.map.props.find((p) => p.id === 'mirror');
      this.mirror = new Mirror(this.renderer, 2.6, 0.9, 512);
      this.mirror.mesh.position.set(mp.x + 0.02, this.map.floorAt(mp.x, mp.z) + mp.y, mp.z);
      this.mirror.mesh.rotation.y = Math.PI / 2;
      s.add(this.mirror.mesh);
      this.mirrorGhost = makeMirrorGhost(this.mats);
      this.mirrorGhost.root.visible = false;
      s.add(this.mirrorGhost.root);
    }
    this.buildParticles();
  }

  // Story textures are needed before Story exists: use a lightweight early instance.
  storyTex(fn, ...args) {
    if (!this._earlyStory) this._earlyStory = new Story(this);
    return this._earlyStory[fn](...args);
  }

  buildParticles() {
    // Rain: line segments around the player when near the outside.
    const n = this.settings.q.rain;
    const pos = new Float32Array(n * 6);
    this.rainData = [];
    for (let i = 0; i < n; i++) this.rainData.push({ x: Math.random() * 40 - 20, y: Math.random() * 12, z: Math.random() * 40 - 20, v: 9 + Math.random() * 4 });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x8a96a2, transparent: true, opacity: 0.35 }));
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
    // Dust motes visible in the flashlight
    if (this.settings.q.dust) {
      const m = 500;
      const dp = new Float32Array(m * 3);
      for (let i = 0; i < m; i++) { dp[i * 3] = Math.random() * 8 - 4; dp[i * 3 + 1] = Math.random() * 3; dp[i * 3 + 2] = Math.random() * 8 - 4; }
      const dg = new THREE.BufferGeometry();
      dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
      const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
      this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.022, map: tex, transparent: true, opacity: 0.0, depthWrite: false, color: 0xfff2dd, blending: THREE.AdditiveBlending }));
      this.dust.frustumCulled = false;
      this.scene.add(this.dust);
    }
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.post.resize(w, h);
  }

  // ------------------------------------------------------------------ modes
  setMode(m) {
    this.mode = m;
    const playing = m === 'play';
    this.input.wantLock = playing;
    this.ui.hud.classList.toggle('show', ['play', 'reader', 'terminal', 'journal', 'cutscene'].includes(m));
    // Keep the pointer locked while reading or at a terminal; free it for menus and the journal.
    if (['title', 'pause', 'death', 'ending', 'journal', 'settings', 'gallery'].includes(m)) this.input.exitLock();
    else if (playing && !this.test && !document.pointerLockElement) this.input.requestLock();
  }

  toTitle() {
    this.ui.hideAllScreens();
    this.ui.show('title');
    document.getElementById('btn-continue').disabled = !this.hasSave();
    this.setMode('title');
    this.audio.restore();
    this.ui.setFade(0, 0.1);
  }

  startNew(skipReload = false) {
    if (!skipReload && this.started) {
      sessionStorage.setItem('anechoic.autostart', 'new');
      sessionStorage.setItem('anechoic.seed', String(Math.floor(Math.random() * 1e9) + 1));
      location.reload();
      return;
    }
    this.started = true;
    this.clearSave();
    this.applyState(null);
    this.ui.hideAllScreens();
    this.setMode('play');
    this.audio.start();
    this.intro();
    this.saveCheckpoint();
  }

  intro() {
    this.ui.setFade(1, 0.01);
    setTimeout(() => this.ui.setFade(0, 3), 300);
    this.story.timer(1.0, () => this.ui.subtitle('Larkhollow Acoustical Research Laboratory. 23:41.', 4));
    this.story.timer(5.5, () => this.ui.subtitle('Sixty seconds of silence. Two thousand pounds. In and out.', 4));
    this.story.timer(10, () => this.ui.hint('[Tab] journal · [F] flashlight · hold [RMB] to raise your recorder', 5));
    this.story.timer(2, () => this.ui.objective('Get inside'));
  }

  pause() {
    if (this.mode !== 'play') return;
    this.setMode('pause');
    this.ui.show('pause');
    this.audio.ctx?.suspend();
  }

  resume() {
    this.ui.hideAllScreens();
    this.setMode('play');
    this.audio.ctx?.resume();
  }

  menuAction(act, screen) {
    switch (act) {
      case 'continue': if (this.hasSave()) { const s = this.readSave(); if (s.seed !== this.seed) { sessionStorage.setItem('anechoic.autostart', 'continue'); sessionStorage.setItem('anechoic.seed', String(s.seed)); location.reload(); } else { this.started = true; this.loadCheckpoint(); } } break;
      case 'new': this.startNew(!this.started); break;
      case 'resume': this.resume(); break;
      case 'settings': this.ui.buildSettings(); this.settingsReturn = screen; this.ui.show(screen, false); this.ui.show('settings'); break;
      case 'endings': this.ui.buildGallery('endings'); this.ui.show('title', false); this.ui.show('gallery'); break;
      case 'credits': this.ui.buildGallery('credits'); this.ui.show('title', false); this.ui.show('gallery'); break;
      case 'back': this.ui.show('settings', false); this.ui.show('gallery', false); this.ui.show(this.settingsReturn && screen === 'settings' ? this.settingsReturn : 'title'); this.audio.applyVolumes(); break;
      case 'checkpoint': this.ui.hideAllScreens(); this.loadCheckpoint(); break;
      case 'quit': this.ui.hideAllScreens(); this.audio.ctx?.resume(); this.toTitle(); break;
    }
  }

  // ------------------------------------------------------------------ world state
  applyState(s) {
    this.inventory.deserialize(s?.inv);
    this.power.deserialize(s?.power);
    this.doors.deserialize(s?.doors);
    this.lights.deserialize(s?.lights);
    this.playerModel.deserialize(s?.habits);
    this.story.deserialize(s?.story);
    this.inventory.tape = s?.inv?.tape || null;
    this.anomalies.deserialize(s?.anomalies);
    this.ai.deserialize(s?.ai);
    this.director.reset();
    for (const o of this.oscillators) o.destroy();
    this.oscillators = [];
    const p = s?.player || { x: POINTS.start.x, z: POINTS.start.z, yaw: POINTS.start.yaw, battery: 1, flash: false };
    this.player.deserialize(p);
    this.story.flags.phase = this.story.flags.phase || 1;
    // Wake the Remainder if the story says it is awake.
    if (s?.ai?.awake) {
      const pp = this.player.pos;
      let best = null;
      for (let k = 0; k < 20; k++) { const q = this.ai.pickPatrolPoint(); const d = Math.hypot(q.x - pp.x, q.z - pp.z); if (d > 22 && (!best || d < best.d + 10)) best = { ...q, d }; }
      if (best) this.ai.wake(best.x, best.z); else this.ai.wake(30, 2.5);
      this.ai.setState(S.PATROL, { force: true });
    }
    this.ui.objective(this.story.flags.objective || '');
    this.audio.restore();
    this.ui.setFade(0, 0.8);
    this.camShake = 0;
    this.lastMoveDist = 0;
  }

  snapshot() {
    return {
      v: 1, seed: this.seed, time: Date.now(),
      player: this.player.serialize(), inv: this.inventory.serialize(), power: this.power.serialize(),
      doors: this.doors.serialize(), lights: this.lights.serialize(), story: this.story.serialize(),
      habits: this.playerModel.serialize(), anomalies: this.anomalies.serialize(), ai: this.ai.serialize(),
    };
  }

  saveCheckpoint() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.snapshot())); this.lastSave = this.snapshot(); } catch (e) { this.lastSave = this.snapshot(); }
  }

  checkpointSoon(delay = 1.5) {
    clearTimeout(this._cp);
    this._cp = setTimeout(() => {
      if (this.mode === 'play' && this.player.alive && this.ai.state !== S.CHASE && this.ai.state !== S.HUNT && !this.story.sweepActive) { this.saveCheckpoint(); this.ui.notify('…'); }
      else this.checkpointSoon(4);
    }, delay * 1000);
  }

  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return !!this.lastSave; } }
  readSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || this.lastSave; } catch { return this.lastSave; } }
  clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }

  loadCheckpoint() {
    const s = this.readSave();
    if (!s) { this.startNew(true); return; }
    // Keep what the Remainder learned about you across deaths.
    const habits = this.playerModel.serialize();
    const rep = this.ai.serialize();
    if (this.lastHabits) s.habits = habits;
    s.ai = { ...(s.ai || {}), repertoire: [...new Set([...(s.ai?.repertoire || []), ...rep.repertoire])] };
    this.applyState(s);
    this.lastHabits = true;
    this.ui.hideAllScreens();
    this.setMode('play');
    this.audio.start();
  }

  loadMeta() { try { return { endings: [], bestReels: 0, ...JSON.parse(localStorage.getItem(META_KEY) || '{}') }; } catch { return { endings: [], bestReels: 0 }; } }
  saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(this.meta)); } catch { /* ignore */ } }

  // ------------------------------------------------------------------ gameplay services
  noiseEvent(x, z, loud, type, tag) {
    if (!this.ai) return;
    this.ai.onNoise(x, z, loud, type, tag);
  }
  noise(x, z, loud, type, tag) { this.noiseEvent(x, z, loud, type, tag); }

  readDoc(id) {
    this.inventory.addDoc(id);
    this.ui.openReader(id);
    this.setMode('reader');
    this.audio.play('paper', { gain: 0.6 });
  }

  playTape(id) {
    const d = DOCS[id];
    this.inventory.addDoc(id);
    this.audio.play('tape');
    this.audio.play(d.voice || 'voiceTape', { gain: 0.6, bus: this.audio.voice, delay: 0.4 });
    this.ui.openReader(id);
    this.setMode('reader');
  }

  die(reason) {
    if (!this.player.alive || this.mode !== 'play') return;
    const p = this.player;
    p.alive = false;
    p.frozen = true;
    this.setMode('cutscene');
    const ai = this.ai;
    p.lookOverride = { x: ai.pos.x, y: ai.pos.y + 2.1, z: ai.pos.z, speed: 9 };
    if (p.hiding) { p.hiding = null; this.ui.setSlats(false); }
    this.audio.playAt('inhale', { x: ai.pos.x, y: ai.pos.y + 2, z: ai.pos.z }, { gain: 1.5 });
    ai.state = S.WATCH; ai.speed = 0;
    ai.body.reach = 1;
    this.playerModel.deaths.push({ x: p.pos.x, z: p.pos.z });
    this.camShake = 0.6;
    this.story.timer(1.5, () => { this.audio.cutAll(0.02); this.ui.setFade(1, 0.05); });
    this.story.timer(2.6, () => { this.ui.showDeath(); this.setMode('death'); this.ai.chaseLoop?.stop(0.1); this.ai.chaseLoop = null; });
  }

  ending(id) {
    this.setMode('cutscene');
    this.player.frozen = true;
    this.ui.setFade(1, 3);
    if (!this.meta.endings.includes(id)) this.meta.endings.push(id);
    this.meta.bestReels = Math.max(this.meta.bestReels, this.inventory.reelCount());
    this.saveMeta();
    const f = this.story.flags;
    const stats = `Seed ${this.seed} · Documents found: ${this.inventory.docs.length} · Subject reels: ${this.inventory.reelCount()}/6<br>Times it learned your hiding place: ${Object.values(this.playerModel.hides).reduce((a, b) => a + b, 0)} · Deaths: ${this.playerModel.deaths.length}<br>${f.roomTone ? 'You carried its room tone out on your tape.' : ''}`;
    this.story.timer(1.5, () => { this.audio.cutAll(2); });
    this.story.timer(4, () => { this.ui.showEnding(id, stats); this.setMode('ending'); this.clearSave(); });
  }

  throwOscillator() {
    if (!this.inventory.has('oscillator')) { this.ui.hint('No oscillators.', 1.5); return; }
    this.inventory.remove('oscillator');
    const p = this.player;
    const f = p.forward(new THREE.Vector3());
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.08), this.mats.prop('metalCream'));
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff3020 }));
    led.position.y = 0.04; mesh.add(led);
    mesh.position.copy(this.camera.position).addScaledVector(f, 0.4);
    this.scene.add(mesh);
    const o = { mesh, vel: f.clone().multiplyScalar(7).add(new THREE.Vector3(0, 2, 0)), landed: false, x: 0, y: 0, z: 0, t: 0, dead: false };
    o.eat = () => {
      if (o.dead) return;
      this.audio.playAt('inhale', { x: o.x, y: o.y + 1, z: o.z }, { gain: 0.8 });
      o.loop?.stop(0.05);
      o.dead = true;
      this.ui.caption('[the tone stops. not switched off — stopped.]');
    };
    o.destroy = () => { o.loop?.stop(0.05); this.scene.remove(mesh); o.dead = true; };
    this.oscillators.push(o);
    this.audio.play('click');
  }

  updateOscillators(dt) {
    for (const o of this.oscillators) {
      if (o.dead) continue;
      o.t += dt;
      if (!o.landed) {
        o.vel.y -= 9.8 * dt;
        const m = o.mesh.position;
        const nx = m.x + o.vel.x * dt, nz = m.z + o.vel.z * dt;
        if (this.grid.cellBlocksMove(Math.floor(nx), Math.floor(nz))) { o.vel.x *= -0.3; o.vel.z *= -0.3; }
        else { m.x = nx; m.z = nz; }
        m.y += o.vel.y * dt;
        const fl = this.map.floorAt(m.x, m.z) + 0.03;
        if (m.y <= fl) {
          m.y = fl; o.landed = true;
          o.x = m.x; o.y = m.y; o.z = m.z;
          this.audio.playAt('latch', { x: m.x, y: m.y, z: m.z }, { gain: 0.8 });
          o.loop = this.audio.loop('loopOsc', { pos: { x: m.x, y: m.y + 0.1, z: m.z }, gain: 1.0 });
          this.ai.lure(o);
        }
      } else {
        o.pulse = (o.pulse || 0) - dt;
        if (o.pulse <= 0) { o.pulse = 2; this.noiseEvent(o.x, o.z, 0.9, 'oscillator', null); }
        if (o.t > 45) o.destroy();
      }
    }
    this.oscillators = this.oscillators.filter((o) => !o.dead || o.mesh.parent);
  }

  // ------------------------------------------------------------------ main loop
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (this.fixedDt) dt = this.fixedDt;
    dt = Math.min(0.05, Math.max(0, dt));
    try { this.step(dt); } catch (e) { console.error(e); this.fatal(e); }
  }

  fatal(e) {
    if (this._fatalShown) return;
    this._fatalShown = true;
    window.__fatal = String(e?.stack || e);
    const el = document.getElementById('error');
    el.textContent = 'Something broke:\n\n' + (e?.stack || e);
    el.classList.add('show');
  }

  step(dt) {
    const input = this.input;
    this.time += dt;
    const mode = this.mode;
    if (mode === 'title') this.updateTitle(dt);
    else if (mode === 'play' || mode === 'cutscene') this.updatePlay(dt);
    else if (mode === 'reader') {
      if (input.hit('interact') || input.hit('pause') || input.mouseReleased[0]) { this.ui.show('reader', false); this.setMode('play'); }
    } else if (mode === 'journal') {
      if (input.hit('journal') || input.hit('pause')) { this.ui.show('journal', false); this.setMode('play'); }
    } else if (mode === 'terminal') {
      const atRoot = this.ui.terminal && this.ui.terminal.open < 0;
      const leave = input.hit('pause') || input.hit('journal') || (atRoot && input.pressed.has('Backspace'));
      if (leave) { this.ui.show('terminal', false); this.ui.terminal = null; this.setMode('play'); }
      else for (const code of input.pressed) this.ui.terminalKey(code);
    } else if (mode === 'pause') {
      if (input.pressed.has('Escape') && this.pauseOpenedAt !== this.time) { /* handled by browser exiting lock; ignore */ }
    }
    if (!this.noRender) this.render(dt);
    input.endFrame();
  }

  updateTitle(dt) {
    const t = this.time;
    const cam = this.camera;
    cam.position.set(33 + Math.sin(t * 0.05) * 3, 1.7 + Math.sin(t * 0.13) * 0.15, 59 - Math.sin(t * 0.04) * 1.5);
    cam.lookAt(38.5 + Math.sin(t * 0.03) * 1.5, 3.4, 44);
    cam.updateMatrixWorld();
    this.lights.update(dt, cam.position, t);
    this.updateRain(dt, true);
    this.post.u.grain.value = 0.07; this.post.u.sat.value = 0.75; this.post.u.vignette.value = 0.45; this.post.u.chroma.value = 0.4;
    this.post.u.time.value = t;
    if (this.audio.ready) { this.audio.setAmbience('outdoor'); this.audio.update(dt, cam, { forward: cam.getWorldDirection(new THREE.Vector3()), up: new THREE.Vector3(0, 1, 0) }); }
  }

  updatePlay(dt) {
    const input = this.input;
    const p = this.player;
    if (this.mode === 'play') {
      if (input.hit('pause')) { if (this.test || !document.pointerLockElement) this.pause(); }
      if (input.hit('journal')) { this.ui.openJournal(); this.setMode('journal'); return; }
      if (input.hit('throw')) this.throwOscillator();
      this.interaction.update();
    }
    p.update(dt);
    // Distance travelled since last stop (story beat helper)
    if (p.moving) this.lastMoveDist += p.speed * dt; else if (p.stillTime > 1.5) this.lastMoveDist = 0;
    p.lastMoveDist = this.lastMoveDist;
    // Recorder
    const raise = this.mode === 'play' && input.mouseDown[2] && p.alive && !p.hiding;
    p.recRaise += ((raise ? 1 : 0) - p.recRaise) * Math.min(1, dt * 10);
    let recInfo = null;
    if (raise && p.recRaise > 0.7) {
      if (input.mouseDown[0]) recInfo = this.story.recordTick(dt);
      else if (this.story.recording) this.story.recordRelease();
      if (input.mousePressed[0] && !recInfo) this.ui.hint('Nothing here worth recording. Just the room.', 2);
    } else if (this.story.recording) this.story.recordRelease();
    const level = this.roomLevel();
    p.vuNeedle += (level - p.vuNeedle) * Math.min(1, dt * 6) + (Math.random() - 0.5) * 0.02 * level;
    if (p.recRaise > 0.02) p.drawVU(Math.max(0, Math.min(1, p.vuNeedle)), !!(recInfo && recInfo !== 'done'), recInfo && recInfo !== 'done' ? `REC ${Math.round(recInfo.progress * 100)}% ${recInfo.label}` : (this.inventory.tape ? this.inventory.tape.label : 'BLANK TAPE'));

    this.doors.update(dt);
    this.story.update(dt);
    this.ai.update(dt);
    this.director.update(dt);
    this.anomalies.update(dt);
    this.updateOscillators(dt);
    this.lights.update(dt, this.camera.position, this.time);
    this.playerModel.totalTime += dt;
    if (p.flashOn) this.playerModel.flashTime += dt;

    // Zone ambience & reverb
    const zd = this.map.zoneDefAt(p.pos.x, p.pos.z);
    this.zoneDef = zd;
    if (zd && this.audio.ready) {
      const amb = this.ambienceOverride || zd.amb;
      const extra = {};
      const nearExt = this.nearOutside();
      if (nearExt > 0 && !zd.ext) extra.loopRain = 0.15 * nearExt;
      if (this.story.boilerRunning && p.pos.y < -1) extra.loopBasement = 0.2;
      const key = amb + JSON.stringify(extra);
      if (key !== this._ambKey) { this._ambKey = key; this.audio.setAmbience(amb, extra); }
      this.audio.setReverb(zd.reverb);
    }
    // Fear & silence
    const pres = this.ai.presence();
    const chase = this.ai.state === S.CHASE;
    const finale = this.story.flags.finale && !this.story.flags.fullSpectrum;
    const targetFear = Math.max(pres * 0.9, chase ? 1 : 0, finale ? 0.35 : 0, this.ai.state === S.WATCH && this.ai.body.root.visible ? 0.5 : 0);
    p.fear += (targetFear - p.fear) * Math.min(1, dt * (targetFear > p.fear ? 1.5 : 0.25));
    this.audio.silence = Math.max(pres, finale ? 0.25 : 0);
    this.audio.muffle = p.hiding ? 0.35 : 0;
    // Battery HUD
    this.ui.battery(p.battery, p.flashOn && (p.battery < 0.25 || input.hit('flashlight')) || input.is('reload'));
    this.updateRain(dt, false);
    this.updateDust(dt);
    if (this.audio.ready) {
      const cam = this.camera;
      const fwd = cam.getWorldDirection(new THREE.Vector3());
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
      const st = this.ai.state;
      this.audio.update(dt, cam, {
        forward: fwd, up, tinnitus: p.fear > 0.8 ? 0.5 : 0,
        music: { low: Math.max(pres > 0.35 ? pres : 0, finale ? 0.6 : 0), high: (st === S.HUNT || st === S.STALK) && pres > 0.2 ? 0.6 : 0, pulse: chase || this.story.sweepActive ? 1 : 0 },
      });
    }
    // Post FX
    const u = this.post.u;
    u.time.value = this.time;
    u.grain.value = 0.055 + p.fear * 0.06;
    u.chroma.value = 0.25 + p.fear * 1.2 + (chase ? 0.6 : 0);
    u.sat.value = 0.84 - p.fear * 0.45;
    u.vignette.value = 0.25 + p.fear * 0.6 + (p.hiding ? 0.4 : 0);
    u.pulse.value = p.fear > 0.5 ? (Math.sin(this.time * (4 + p.fear * 5)) * 0.5 + 0.5) * p.fear : 0;
    u.distort.value = 0.07 + pres * 0.12;
    u.shake.value = this.camShake;
    u.redden.value = !p.alive ? 0.4 : 0;
    this.camShake = Math.max(0, this.camShake - dt * 0.8);
    this.camera.fov += (this.settings.get('fov') + (p.speed > 3.5 ? 4 : 0) - this.camera.fov) * Math.min(1, dt * 4);
    this.camera.updateProjectionMatrix();
  }

  // 0..1 needle reading: ambient loudness at the player, crushed by the Remainder's presence.
  roomLevel() {
    const zd = this.zoneDef;
    let base = { outdoor: 0.62, lobby: 0.5, room: 0.4, corridor: 0.5, hall: 0.45, dead: 0.2, anechoic: 0.02, basement: 0.48, electrical: 0.62, boiler: 0.5, cistern: 0.55 }[this.ambienceOverride || zd?.amb] ?? 0.4;
    if (this.story.boilerRunning && this.map.zoneAt(this.player.pos.x, this.player.pos.z)?.ch === 'f') base = 0.95;
    if (this.story.sweepActive) base = 1;
    if (this.player.moving) base += 0.06;
    return Math.max(0, base * (1 - this.audio.silence * 1.1));
  }

  nearOutside() {
    const p = this.player.pos;
    if (p.y < -1) return 0;
    if (p.z > 45) return 1;
    return Math.max(0, 1 - (46 - p.z) / 8);
  }

  updateRain(dt, force) {
    const p = this.camera.position;
    const outside = force || this.nearOutside() > 0;
    this.rain.visible = outside;
    if (!outside) return;
    const pos = this.rain.geometry.attributes.position.array;
    for (let i = 0; i < this.rainData.length; i++) {
      const r = this.rainData[i];
      r.y -= r.v * dt;
      if (r.y < 0) { r.y = 12; r.x = Math.random() * 40 - 20; r.z = Math.random() * 40 - 20; }
      let x = p.x + r.x, z = p.z + r.z;
      // Only over exterior cells
      if (z < 46.3) { x = -999; }
      pos[i * 6] = x; pos[i * 6 + 1] = r.y; pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = x + 0.03; pos[i * 6 + 4] = r.y + 0.35; pos[i * 6 + 5] = z;
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
  }

  updateDust(dt) {
    if (!this.dust) return;
    const p = this.camera.position;
    this.dust.position.set(Math.floor(p.x / 8) * 8, this.player.pos.y, Math.floor(p.z / 8) * 8);
    const a = this.dust.geometry.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) { a[i] += Math.sin(this.time * 0.3 + i) * 0.0008; a[i + 1] += Math.cos(this.time * 0.2 + i * 0.7) * 0.0006; }
    this.dust.geometry.attributes.position.needsUpdate = true;
    this.dust.material.opacity = this.player.flashOn ? 0.55 : 0.08;
    // Tile the motes around the player using a modulo offset group
    this.dust.position.x = p.x - 4; this.dust.position.z = p.z - 4;
  }

  render(dt) {
    const r = this.renderer;
    const mirrorActive = this.mirror && this.mode !== 'title' && this.map.zoneAt(this.player.pos.x, this.player.pos.z)?.ch === 't';
    if (mirrorActive) this.mirror.render(this.scene, this.camera);
    const showVM = (this.mode === 'play' || this.mode === 'cutscene') && this.player.alive;
    this.post.render(this.scene, this.camera, showVM ? this.player.vm : null);
  }

  // ------------------------------------------------------------------ debug / test API
  debugTeleport(name) { const p = POINTS[name]; if (p) this.player.place(p.x, p.z, p.yaw); }
}

function tick() { return new Promise((r) => setTimeout(r, 0)); }
export { hashString };
