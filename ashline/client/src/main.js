// ASHLINE client bootstrap: loads the world, runs the menu, connects online or to the practice
// server, and hands control to MatchView during a match.
import * as THREE from 'three';
import { PROTOCOL_VERSION, DEFAULT_MAP_SEED } from '../../shared/constants.js';
import { getWorld } from '../../shared/sim/Setup.js';
import { levelInfo, sanitizeCosmetics, DEFAULT_COS } from '../../shared/progression.js';
import { Settings } from './core/Settings.js';
import { Input } from './core/Input.js';
import { Renderer } from './render/Renderer.js';
import { generateTextures } from './render/Textures.js';
import { buildTerrain, buildWater, buildFarTerrain } from './render/Terrain.js';
import { makeMaterials, buildStructures, buildVegetation, Grass } from './render/WorldMeshes.js';
import { Effects } from './render/Effects.js';
import { weaponMats } from './entity/WeaponModels.js';
import { Character } from './entity/Character.js';
import { Audio } from './audio/Audio.js';
import { HUD } from './ui/HUD.js';
import { Menu } from './ui/Menu.js';
import { WsTransport, LocalServer, loadLocalProfile } from './net/Connection.js';
import { MatchView } from './game/MatchView.js';

const $ = (id) => document.getElementById(id);

class App {
  async boot() {
    const setLoad = (p, t) => { $('load-fill').style.width = Math.round(p * 100) + '%'; if (t) $('load-text').textContent = t; };
    this.settings = new Settings();
    this.canvas = $('view');
    this.input = new Input(this.canvas);
    this.renderer = new Renderer(this.canvas, this.settings);
    this.audio = new Audio(this.settings);
    setLoad(0.02, 'generating materials…');
    this.tex = await generateTextures((p, k) => setLoad(0.02 + p * 0.45, `painting ${k}…`));
    weaponMats(this.tex);
    setLoad(0.5, 'surveying the valley…');
    await tick();
    this.world = getWorld(DEFAULT_MAP_SEED, false);
    const { map, world } = this.world;
    setLoad(0.6, 'raising terrain…'); await tick();
    const scene = this.renderer.scene;
    scene.add(buildTerrain(map, this.tex));
    this.water = buildWater(this.tex); scene.add(this.water);
    scene.add(buildFarTerrain(map));
    setLoad(0.72, 'building Old Marrow…'); await tick();
    this.mats = makeMaterials(this.tex);
    this.structures = buildStructures(map, this.mats); scene.add(this.structures);
    setLoad(0.85, 'growing forests…'); await tick();
    this.veg = buildVegetation(map, this.tex, this.settings.q); scene.add(this.veg);
    this.grass = new Grass(map, world, Math.round(5000 * this.settings.q.grass));
    scene.add(this.grass.mesh);
    this.effects = new Effects(scene, this.renderer.camera);
    this.hud = new HUD(this);
    this.hud.setMap(map);
    setLoad(0.95, 'warming up…'); await tick();
    this.profile = null; this.conn = null; this.match = null;
    this.menu = new Menu(this);
    this.setupPreview();
    this.input.onLock = (locked) => { if (!locked && this.match && !this.hud.inventoryOpen && !this.hud.mapOpen && !this.leaving) this.menu.showPause(); };
    window.addEventListener('pointerdown', () => this.audio.init(), { once: true });
    window.addEventListener('keydown', () => this.audio.init(), { once: true });
    // Compile shaders once with the menu view.
    this.renderer.render(0.016, false);
    $('loading').classList.remove('show');
    this.menu.open();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    window.__ashline = this;
    if (/[?&]practice/.test(location.search)) this.goPractice();
  }

  defaultServer() { return location.protocol.startsWith('http') ? `${location.host}` : ''; }

  wsUrl(input) {
    let s = (input || '').trim();
    if (!s) s = this.defaultServer();
    if (!s) return null;
    if (/^https?:\/\//.test(s)) s = s.replace(/^http/, 'ws');
    if (!/^wss?:\/\//.test(s)) s = (location.protocol === 'https:' ? 'wss://' : 'ws://') + s;
    if (!/\/ws\/?$/.test(s)) s = s.replace(/\/$/, '') + '/ws';
    return s;
  }

  async goOnline(input) {
    this.audio.init();
    const url = this.wsUrl(input);
    if (!url) { this.menu.setError('Enter the server address, e.g. 192.168.1.20:8090'); return; }
    this.menu.setError('Connecting…');
    this.disconnect();
    try {
      const c = new WsTransport(url);
      await c.connect();
      this.settings.set('server', input || '');
      this.serverLabel = url.replace(/^wss?:\/\//, '').replace(/\/ws$/, '');
      this.attach(c);
      this.menu.setError('');
    } catch (e) {
      this.menu.setError(`${e.message}. Is the server running? (npm start in ashline/)`);
    }
  }

  async goPractice() {
    this.audio.init();
    this.disconnect();
    this.attach(new LocalServer());
  }

  attach(c) {
    this.conn = c;
    c.on((m) => this.onMessage(m));
    c.onClose(() => { if (this.conn === c) { this.menu.setError('Disconnected from server'); this.endMatchView(); this.conn = null; this.profile = null; this.menu.renderConn(); this.menu.renderProfile(); } });
    const name = this.settings.name || '';
    const token = c.kind === 'ws' ? localStorage.getItem('ashline.token') : null;
    c.send({ t: 'hello', v: PROTOCOL_VERSION, token, name, cos: this.offlineCos() });
    this.menu.renderConn();
    clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => this.conn && this.conn.send({ t: 'ping', c: performance.now() }), 2000);
  }

  disconnect() {
    if (!this.conn) return;
    const c = this.conn; this.conn = null;
    this.endMatchView();
    c.close();
    this.profile = null;
    this.menu.renderConn(); this.menu.renderProfile();
  }

  offlineCos() { try { return JSON.parse(localStorage.getItem('ashline.cos')) || null; } catch { return null; } }
  saveOfflineCos(c) { try { localStorage.setItem('ashline.cos', JSON.stringify(c)); } catch {} }

  onMessage(m) {
    if (this.match && (m instanceof ArrayBuffer || m.t === 'ev' || m.t === 'inv')) { this.match.onMessage(m); return; }
    if (m instanceof ArrayBuffer) return;
    switch (m.t) {
      case 'welcome':
        this.myId = m.id; this.profile = m.profile; this.testMode = m.test;
        if (this.conn.kind === 'ws') localStorage.setItem('ashline.token', m.token);
        this.saveOfflineCos(m.profile.cos);
        this.menu.renderProfile(); this.menu.renderConn(); this.refreshPreview();
        if (this.menu.tab !== 'play') this.menu.show(this.menu.tab);
        break;
      case 'profile': this.profile = m.profile; this.menu.renderProfile(); this.refreshPreview(); if (this.menu.tab === 'locker') this.menu.renderLocker(); if (this.menu.tab === 'stats') this.menu.renderStats(); break;
      case 'party': this.menu.renderParty(m.party, this.myId); break;
      case 'err': this.menu.setError(m.m); setTimeout(() => this.menu.setError(''), 4000); break;
      case 'pong': this.ping = performance.now() - m.c; break;
      case 'match': this.startMatchView(m.init); break;
      case 'results': this.profile = m.profile; this.menu.renderProfile(); setTimeout(() => { if (this.match) { this.input.unlock(); this.menu.showResults(m); } }, 1500); break;
      case 'lobby': this.endMatchView(); break;
    }
  }

  startMatchView(init) {
    this.endMatchView();
    this.menu.close(); this.menu.hideResults();
    this.match = new MatchView(this, init);
    this.input.enabled = true;
    this.input.lock();
    this.preview.root.visible = false;
  }

  endMatchView() {
    if (this.match) { this.match.dispose(); this.match = null; }
    this.input.enabled = false;
    this.input.unlock();
    this.menu.hideResults(); this.menu.hidePause();
    if (this.preview) this.preview.root.visible = true;
    this.menu.open();
  }

  leaveMatch() {
    this.leaving = true;
    if (this.conn) this.conn.send({ t: 'leave' });
    this.endMatchView();
    setTimeout(() => { this.leaving = false; }, 200);
  }

  // ---------------------------------------------------------------- menu backdrop
  setupPreview() {
    const map = this.world.map;
    const poi = map.pois.find(p => p.id === 'oldtown');
    const x = poi.x + 1.5, z = poi.z + 4.5;
    this.previewSpot = { x, y: map.heightAt(x, z), z };
    this.preview = new Character(this.tex, this.offlineCos() || DEFAULT_COS);
    this.preview.setWeapon('kr5');
    this.renderer.scene.add(this.preview.root);
    this.menuCamera('play');
  }
  refreshPreview() {
    const cos = (this.profile && this.profile.cos) || this.offlineCos() || DEFAULT_COS;
    const key = JSON.stringify(cos);
    if (key === this.previewKey) return;
    this.previewKey = key;
    this.preview.dispose();
    this.preview = new Character(this.tex, cos);
    this.preview.setWeapon('kr5');
    this.preview.setGear(0x2a);
    this.renderer.scene.add(this.preview.root);
    if (this.match) this.preview.root.visible = false;
  }
  menuCamera(tab) { this.menuTab = tab; }

  loop(t) {
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    try {
      if (this.match) this.match.frame(dt);
      else this.menuFrame(dt);
      const cam = this.renderer.camera;
      this.grass.update(cam.position.x, cam.position.z, this.renderer.time);
      this.veg.userData.wind.value = this.renderer.time;
      this.water.userData.update(this.renderer.time);
      this.structures.children.forEach(o => { if (o.userData.blink) o.visible = Math.sin(this.renderer.time * 3) > 0; });
      this.renderer.render(dt, !!this.match);
    } catch (e) { console.error(e); }
    requestAnimationFrame((tt) => this.loop(tt));
  }

  menuFrame(dt) {
    const s = this.previewSpot, cam = this.renderer.camera;
    const locker = this.menuTab === 'locker';
    const a = Math.sin(this.renderer.time * 0.08) * 0.25 + 0.35;
    const dist = locker ? 3.1 : 4.6;
    cam.position.set(s.x + Math.sin(a) * dist + (locker ? 0 : -1.2), s.y + (locker ? 1.35 : 1.6), s.z - Math.cos(a) * dist);
    cam.lookAt(s.x + (locker ? 0.6 : -0.6), s.y + (locker ? 1.05 : 1.4), s.z);
    this.renderer.setZoom(1);
    this.preview.root.visible = true;
    this.preview.update({ x: s.x, y: s.y, z: s.z, yaw: Math.atan2(cam.position.x - s.x, cam.position.z - s.z) + Math.PI + 0.35, pitch: -0.05, mode: 0, flags: 0 }, dt, 3);
    this.renderer.followShadow(s.x, s.y, s.z);
    this.effects.update(dt, cam.position, 0.15);
    this.audio.setListener(cam);
    if (this.audio.ready) { this.audio.loop('wind', 0.35); this.audio.loop('plane', 0); }
    this.renderer.post.u.ash.value = 0; this.renderer.post.u.dmg.value = 0; this.renderer.post.u.sat.value = 0.8;
    this.renderer.skyU.ash.value = 0;
    void THREE; void levelInfo; void sanitizeCosmetics; void loadLocalProfile;
  }
}

const tick = () => new Promise(r => setTimeout(r, 0));
new App().boot().catch(e => { console.error(e); $('load-text').textContent = 'Failed to start: ' + e.message; });
