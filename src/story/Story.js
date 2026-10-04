// Progression, puzzles, items, scripted beats and endings for Larkhollow.
import * as THREE from 'three';
import { DOCS, REELS, TERMINALS } from './Documents.js';
import { ITEMS } from '../player/Inventory.js';
import { canvasTex, drawPicto, PICTOS } from '../world/Decor.js';
import { S } from '../entity/RemainderAI.js';
import { CELL } from '../world/MapData.js';

const MAX_CIRCUITS = 3;

export class Power {
  constructor(game) { this.game = game; this.reset(); }
  reset() {
    this.on = { cup: true, bed: true };
    this.tripping = 0;
  }
  isOn(c) { return !!this.on[c]; }
  count() { return Object.values(this.on).filter(Boolean).length; }
  serialize() { return { on: this.on }; }
  deserialize(d) { this.reset(); if (d) this.on = { ...d.on }; }
}

export class Story {
  constructor(game) {
    this.game = game;
    this.rng = game.rng.fork('story');
    this.flags = {};
    this.hidingSpots = [];
    this.pickups = [];
    this.timers = [];
    // Seeded variations
    this.valveSolution = [0, 1, 2].map(() => this.rng.int(1, 3));
    this.panelOrder = this.rng.shuffle(PICTOS.slice());
    this.melody = [0, 1, 2, 3, 4].map(() => this.rng.int(0, 7));
    this.melody[0] = this.rng.pick([0, 2, 4]);
  }

  // ------------------------------------------------------------------ textures for decor
  portraitTexture() {
    this.portraitCanvas = document.createElement('canvas');
    this.portraitCanvas.width = 192; this.portraitCanvas.height = 256;
    this.drawPortrait(0);
    const t = new THREE.CanvasTexture(this.portraitCanvas);
    t.colorSpace = THREE.SRGBColorSpace;
    this.portraitTex = t;
    return t;
  }
  drawPortrait(stage) {
    const c = this.portraitCanvas.getContext('2d');
    const w = 192, h = 256;
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3a3125'); gr.addColorStop(1, '#16120d');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    if (stage < 3) {
      c.fillStyle = '#1b1712'; c.beginPath(); c.ellipse(w / 2, h * 0.95, 80, 70, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#b39a7c'; c.beginPath(); c.ellipse(w / 2, h * 0.42, 38, 50, 0, 0, 7); c.fill();
      c.fillStyle = '#5b4a3a'; c.beginPath(); c.ellipse(w / 2, h * 0.32, 44, 34, 0, Math.PI, 0); c.fill();
      if (stage === 0) {
        c.fillStyle = '#2a2018'; c.fillRect(w / 2 - 22, h * 0.4, 12, 4); c.fillRect(w / 2 + 10, h * 0.4, 12, 4);
        c.fillRect(w / 2 - 10, h * 0.53, 20, 3);
      } else {
        c.strokeStyle = '#0d0a07'; c.lineWidth = 3;
        for (let k = 0; k < 40; k++) { c.beginPath(); c.moveTo(w / 2 - 35 + Math.random() * 70, h * 0.3 + Math.random() * 20); c.lineTo(w / 2 - 35 + Math.random() * 70, h * 0.5 + Math.random() * 30); c.stroke(); }
      }
    } else {
      c.fillStyle = '#4d3f30'; c.fillRect(10, 10, w - 20, h - 20);
      c.fillStyle = '#2b2219'; c.font = '14px Courier New'; c.fillText('LARKHOLLOW 1971', 30, h / 2);
    }
    c.fillStyle = '#c8b48a'; c.fillRect(w / 2 - 50, h - 30, 100, 18);
    c.fillStyle = '#2a2014'; c.font = '10px Georgia'; c.textAlign = 'center'; c.fillText('DR. A. MORROW', w / 2, h - 17);
    if (this.portraitTex) this.portraitTex.needsUpdate = true;
  }

  staffPhotoTexture() {
    return canvasTex(320, 210, (c, w, h) => {
      c.fillStyle = '#8a7f6b'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#5e5546'; c.fillRect(0, h * 0.55, w, h * 0.45);
      for (let k = 0; k < 9; k++) {
        const x = 25 + k * 34, y = 80 + (k % 2) * 8;
        c.fillStyle = '#2d2820'; c.fillRect(x - 12, y + 14, 24, 60);
        c.fillStyle = k === 6 ? '#111' : '#b8a690'; c.beginPath(); c.arc(x, y, 11, 0, 7); c.fill();
        if (k === 6) { c.strokeStyle = '#000'; c.lineWidth = 4; for (let j = 0; j < 8; j++) { c.beginPath(); c.moveTo(x - 14 + Math.random() * 6, y - 14); c.lineTo(x + 8 + Math.random() * 6, y + 14); c.stroke(); } }
      }
      c.fillStyle = '#e8dcc0'; c.font = '11px Courier New'; c.fillText('Larkhollow A.R.L. — staff, summer 1979', 12, h - 10);
      for (let k = 0; k < 2000; k++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; c.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
    });
  }

  directoryTexture() {
    return canvasTex(512, 360, (c, w, h) => {
      c.fillStyle = '#1e2420'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#d4cdb8'; c.font = 'bold 26px Georgia'; c.textAlign = 'center'; c.fillText('LARKHOLLOW A.R.L.', w / 2, 40);
      c.font = '15px Courier New'; c.textAlign = 'left';
      const rows = [['bird', 'RESEARCH WING  →  East'], ['cup', 'ADMINISTRATION  ←  West'], ['bed', 'RESIDENTIAL  ↑  North'], ['bulb', 'MAINTENANCE  —  staff only']];
      rows.forEach(([p, t], k) => { drawPicto(c, p, 50, 90 + k * 52, 34, '#c4483a', 0.09); c.fillText(t, 85, 96 + k * 52); });
      c.font = '12px Courier New'; c.fillStyle = '#8f8a7a'; c.fillText('A floor plan is pinned beneath the glass.  [E] take it', 30, h - 25);
    });
  }

  chalkTexture(id) {
    return canvasTex(512, 360, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.strokeStyle = 'rgba(225,225,215,0.85)'; c.fillStyle = 'rgba(225,225,215,0.85)';
      c.font = '26px "Segoe Print", "Comic Sans MS", cursive';
      if (id === 'valveChalk') {
        this.valveSolution.forEach((v, k) => {
          c.save(); c.translate(100 + k * 150, 150); c.rotate((v * Math.PI) / 2);
          c.lineWidth = 6; c.beginPath(); c.arc(0, 0, 45, 0, Math.PI * 2); c.stroke();
          c.beginPath(); c.arc(0, 0, 45, -Math.PI / 2, Math.PI / 2); c.closePath(); c.fill();
          c.restore();
        });
        c.fillText('SHE LIKES IT LIKE THIS', 90, 260);
        c.fillText('FLAME ON FIRST', 140, 310);
      } else {
        c.fillText('3 ONLY!!  4 = BANG', 40, 60);
        PICTOS.forEach((p, k) => drawPicto(c, p, 60 + (k % 4) * 110, 160 + Math.floor(k / 4) * 110, 70, 'rgba(225,225,215,0.9)', 0.08));
        c.fillText('— R.', 400, 340);
      }
    }, true);
  }

  boardTexture(id, papers) {
    return canvasTex(512, 268, (c, w, h) => {
      c.fillStyle = papers ? '#3a3226' : '#1f2a24'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#d8dcd2'; c.fillStyle = '#d8dcd2'; c.lineWidth = 2; c.font = '18px "Segoe Print", cursive';
      if (papers) {
        for (let k = 0; k < 14; k++) { c.fillStyle = '#cfc6ad'; c.save(); c.translate(30 + (k % 5) * 95, 25 + Math.floor(k / 5) * 80); c.rotate((Math.random() - 0.5) * 0.3); c.fillRect(0, 0, 70, 60); c.fillStyle = '#3a3226'; for (let j = 0; j < 5; j++) c.fillRect(6, 8 + j * 10, 40 + Math.random() * 18, 2); c.restore(); }
        c.strokeStyle = '#8a1f17'; c.lineWidth = 3; c.beginPath(); c.moveTo(60, 60); c.lineTo(250, 160); c.lineTo(420, 70); c.stroke();
        c.fillStyle = '#8a1f17'; c.font = 'bold 24px "Segoe Print", cursive'; c.fillText('LOUD = SAFE', 280, 250);
      } else {
        c.fillText('dB(A) over October:', 20, 40);
        c.beginPath(); c.moveTo(30, 80); c.lineTo(150, 110); c.lineTo(270, 170); c.lineTo(420, 240); c.stroke();
        c.fillText('41', 20, 80); c.fillText('19', 430, 240);
        c.fillText('WHERE IS THE SOUND GOING?', 120, 70);
      }
    });
  }

  // ------------------------------------------------------------------ setup
  setup() {
    const g = this.game;
    const I = g.interaction;
    const P = (id) => g.map.props.find((p) => p.id === id || p.hideId === id);
    const fl = (x, z) => g.map.floorAt(x, z);
    const self = this;

    // ---- Hiding spots (lockers / wardrobes)
    for (const p of g.map.props) {
      if (!p.hideId) continue;
      const a = ((p.r || 0) * Math.PI) / 180;
      const fx = Math.sin(a), fz = Math.cos(a);
      const spot = { id: p.hideId, x: p.x, z: p.z, y: fl(p.x, p.z), facing: Math.atan2(-fx, -fz), exitX: p.x + fx * 0.75, exitZ: p.z + fz * 0.75 };
      this.hidingSpots.push(spot);
      I.add({ id: 'hide:' + p.hideId, obj: g.propsById.get(p.hideId), prompt: () => 'Hide', use: () => g.player.hideIn(spot), range: 1.8 });
    }

    // ---- Doors
    for (const d of g.doors.list) {
      if (d.style === 'shelf') continue;
      I.add({
        id: 'door:' + d.id, obj: d.hitMesh,
        prompt: () => this.doorPrompt(d),
        use: () => this.useDoor(d),
      });
    }

    // ---- Pickups
    const pickup = (id, spec, x, y, z, opts = {}) => this.addPickup({ id, ...spec, x, y, z, ...opts });
    const desk = (pid, dx = 0, dz = 0) => { const p = P(pid); return { x: p.x + dx, y: fl(p.x, p.z) + 0.78, z: p.z + dz }; };
    const at = (o) => [o.x, o.y, o.z];

    pickup('memo_keys', { doc: 'memo_keys' }, ...at(desk('secDesk', -0.4, 0.05)));
    pickup('key_maint', { item: 'key_maint' }, ...at(desk('infDesk', 0.3, 0.0)));
    pickup('infirmary_log', { doc: 'infirmary_log' }, ...at(desk('infDesk', -0.35, 0.05)));
    pickup('keene_letter', { doc: 'keene_letter' }, 33.3, fl(33, 18) + 0.78, 18.4);
    pickup('lounge_note', { doc: 'lounge_note' }, 18.4, fl(18, 37) + 1.2, 37.72, { wall: true });
    pickup('ruth_breakers', { doc: 'ruth_breakers' }, 4.75, fl(4, 10) + 1.3, 10.86, { wall: true, ry: Math.PI });
    pickup('ruth_diary', { doc: 'ruth_diary' }, ...at(desk('ruthBench', 0.5, 0.0)));
    pickup('amsel_rules', { doc: 'amsel_rules' }, ...at(desk('resDesk1', 0, 0.3)));
    pickup('control_log', { doc: 'control_log' }, ...at(desk('ctrlDesk', 0, -0.3)));
    pickup('chamber_rules', { doc: 'chamber_rules' }, 70.62, fl(70, 10) + 0.78, 9.6);
    pickup('pa_manual', { doc: 'pa_manual' }, ...at(desk('bcDesk', 0, 0.3)));
    pickup('amsel_protocol', { doc: 'amsel_protocol' }, ...at(desk('amselDesk', -0.3, 0)));
    pickup('amsel_last', { doc: 'amsel_last' }, 70.3, fl(70, 43) + 0.22, 42.9);
    pickup('morrow_note', { doc: 'morrow_note', onTake: () => this.revelation() }, ...at(desk('morrowDesk', 0.1, -0.5)));
    pickup('obituary', { doc: 'obituary', onTake: () => this.revelation() }, 16.8, fl(16, 18) + 0.79, 18.5);
    pickup('disconnection', { doc: 'disconnection' }, 16.6, fl(16, 19) + 0.79, 19.2);
    pickup('key_gate', { item: 'key_gate' }, 16.95, fl(16, 19) + 0.79, 17.7);
    pickup('reel_dictation', { item: 'reel_dictation', kind: 'reel' }, 16.95, fl(16, 19) + 0.79, 19.4);
    // Director's keys: one of four spots in the reverberation hall.
    const keySpots = [[73.0, 30.6], [79.6, 17.2], [77.0, 25.6], [72.2, 17.6]];
    const ks = this.rng.pick(keySpots);
    pickup('key_director', { item: 'key_director', kind: 'keys', onTake: () => this.beat('keysFound') }, ks[0], fl(ks[0], ks[1]) + 0.02, ks[1]);
    // Oscillators
    pickup('osc1', { item: 'oscillator', kind: 'osc' }, ...at(desk('ruthBench', -0.6, 0)));
    pickup('osc2', { item: 'oscillator', kind: 'osc' }, 69.6, fl(69, 39) + 0.82, 39.0);
    pickup('osc3', { item: 'oscillator', kind: 'osc' }, ...at(desk('bcDesk', 0, -0.4)));
    // Batteries: 7 of 13 candidate spots
    const bat = [[33.6, 0.78, 39.2], [12.4, 0.0, 26.3], [27.4, 0.78, 26.6], [43.0, 0.78, 28.4], [9.3, 0.0, 30.0], [26.0, 0.92, 10.55], [35.5, 0.0, 6.0], [61.3, 0.0, 41.4], [66.4, 0.78, 27.4], [60.5, 0.0, 9.5], [52.5, 0.0, 25.5], [3.0, 0.0, 8.0], [46.6, 0.0, 19.0]];
    this.rng.sample(bat, 7).forEach(([x, y, z], k) => pickup('bat' + k, { item: 'battery', kind: 'battery' }, x, fl(x, z) + y + 0.02, z));
    // Subject reels: fixed + random
    const reelCands = [[34.6, 0.0, 30.6], [43.6, 0.78, 18.4], [53.2, 0.48, 26.0], [41.0, 0.78, 33.1], [62.3, 0.0, 44.6], [24.6, 0.45, 8.7], [47.4, 0.48, 21.0], [12.2, 0.78, 15.0], [79.4, 0.0, 44.4], [75.0, 0.0, 9.6]];
    const rand = this.rng.sample(reelCands, 3);
    pickup('reel_s3', { item: 'reel_s3', doc: 'reel_s3', kind: 'reel' }, rand[0][0], fl(rand[0][0], rand[0][2]) + rand[0][1] + 0.02, rand[0][2]);
    pickup('reel_s5', { item: 'reel_s5', doc: 'reel_s5', kind: 'reel' }, rand[1][0], fl(rand[1][0], rand[1][2]) + rand[1][1] + 0.02, rand[1][2]);
    pickup('reel_s8', { item: 'reel_s8', doc: 'reel_s8', kind: 'reel' }, rand[2][0], fl(rand[2][0], rand[2][2]) + rand[2][1] + 0.02, rand[2][2]);
    pickup('reel_s9', { item: 'reel_s9', doc: 'reel_s9', kind: 'reel' }, 72.9, fl(72, 38) + 0.8, 38.3);
    pickup('reel_s7', { item: 'reel_s7', doc: 'reel_s7', kind: 'reel', enabled: () => this.flags.benchOpen }, 65.85, fl(65, 19) + 0.47, 19.5);
    pickup('reel_s11', { item: 'reel_s11', doc: 'reel_s11', kind: 'reel', enabled: () => this.flags.drained }, 46.5, fl(46, 8) + 0.03, 8.5);

    // ---- Static interactables
    const add = (def) => I.add(def);
    // Doormat -> front key
    add({ id: 'doormat', at: { x: 41.0, y: 0.05, z: 47.45, w: 1.1, h: 0.1, d: 0.6 }, enabled: () => !this.flags.matLifted,
      prompt: () => 'Lift the mat', use: () => { this.flags.matLifted = true; g.inventory.add('key_front'); g.audio.play('keys'); g.ui.subtitle('Under the mat. Just like she said.', 3); } });
    // Directory -> floor plan
    add({ id: 'directory', at: { x: 45.8, y: 1.55, z: 37.1, w: 1.4, h: 1.0, d: 0.1 }, prompt: () => this.flags.floorplan ? 'Building directory' : 'Take the floor plan',
      use: () => { if (!this.flags.floorplan) { this.flags.floorplan = true; g.inventory.add('floorplan'); g.audio.play('paper'); g.ui.hint('Floor plan added to journal [Tab].', 3); } } });
    // Sign-in book
    add({ id: 'signin', at: { x: 37.2, y: 1.1, z: 41.0, w: 0.5, h: 0.12, d: 0.4 }, prompt: () => 'Read the sign-in book', use: () => { const id = this.flags.signin2 ? 'sign_in_2' : 'sign_in'; g.readDoc(id); } });
    // Lobby phone (rings by script)
    add({ id: 'lobbyPhone', at: { x: 37.2, y: 1.15, z: 42.3, w: 0.35, h: 0.2, d: 0.3 }, prompt: () => this.phoneRinging ? 'Answer the phone' : 'Telephone', use: () => this.answerPhone() });
    // Answering machine
    add({ id: 'machine', at: { x: 33.6, y: 0.85, z: 39.4, w: 0.35, h: 0.15, d: 0.3 }, prompt: () => 'Play messages', use: () => { g.playTape('machine'); this.flags.machineHeard = true; this.advancePhase(2); } });
    // Key cabinet
    add({ id: 'keyCabinet', obj: g.decorById.get('keyCabinet'), prompt: () => 'Key cabinet', use: () => g.readDoc('key_cabinet') });
    // Portrait
    add({ id: 'portrait', obj: g.decorById.get('portrait'), prompt: () => 'Portrait', use: () => g.ui.subtitle(this.portraitStage === 0 ? '"Dr. Agathe Morrow, Director, 1971–1987." She looks tired.' : this.portraitStage === 1 ? 'Someone has scratched out her face.' : 'It has been turned to face the wall.', 3.5) });
    // Notice: quiet hours
    add({ id: 'quietHours', at: { x: 40.5, y: 1.5, z: 14.1, w: 1.2, h: 0.85, d: 0.1 }, prompt: () => 'Read notice', use: () => g.readDoc('quiet_hours') });
    // Valve chalk
    add({ id: 'valveChalk', at: { x: 17.0, y: fl(17, 11.5) + 1.55, z: 11.9, w: 1.6, h: 1.0, d: 0.1 }, prompt: () => 'Chalk marks', use: () => g.readDoc('valve_chalk') });
    add({ id: 'circuitChalk', at: { x: 2.1, y: fl(2, 9) + 1.5, z: 9.3, w: 0.1, h: 1.0, d: 1.4 }, prompt: () => 'Chalk marks', use: () => g.ui.subtitle('Ruth\'s signs, chalked big: bird, cup, bed, bulb, flame, speaker, bell, drop. "3 ONLY!! 4 = BANG"', 4) });
    // Booth tally
    add({ id: 'boothTally', at: { x: 52.1, y: 1.3, z: 25.5, w: 0.1, h: 0.8, d: 1.0 }, prompt: () => 'Scratches', use: () => g.readDoc('booth_tally') });
    // Terminals
    const term = (pid, key) => add({ id: 'term:' + key, at: { ...desk(pid, 0, -0.1), y: desk(pid).y + 0.25, w: 0.45, h: 0.4, d: 0.4 }, prompt: () => 'Use terminal', use: () => g.ui.openTerminal(TERMINALS[key]) });
    term('archiveDesk', 'archiveTerm'); term('secDesk', 'secretaryTerm'); term('ctrlDesk', 'controlTerm'); term('resDesk2', 'researchTerm');
    this.addTerminalMeshes(['archiveDesk', 'secDesk', 'ctrlDesk', 'resDesk2']);

    // Mirror ghost
    this.flags.mirrorDone = false;

    this.setupBreakers();
    this.setupBoiler();
    this.setupPiano();
    this.setupStudio();
    this.setupFinale();
    this.setupMisc();
  }

  addTerminalMeshes(ids) {
    const g = this.game;
    for (const id of ids) {
      const p = g.map.props.find((pp) => pp.id === id);
      const grp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.34, 0.38), g.mats.prop('beigePlastic'));
      body.position.y = 0.17; grp.add(body);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.21), new THREE.MeshBasicMaterial({ color: 0x0c2a12 }));
      scr.position.set(0, 0.19, 0.191); grp.add(scr);
      const kb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.15), g.mats.prop('beigePlastic')); kb.position.set(0, 0.015, 0.3); grp.add(kb);
      grp.position.set(p.x, g.map.floorAt(p.x, p.z) + 0.76, p.z);
      grp.rotation.y = ((p.r || 0) * Math.PI) / 180 + Math.PI;
      if (p.r === 90 || p.r === 270) grp.position.x += p.r === 90 ? -0.05 : 0.05;
      g.scene.add(grp);
      this.termScreens = this.termScreens || [];
      this.termScreens.push(scr);
    }
  }

  addPickup(def) {
    const g = this.game;
    const mesh = this.pickupMesh(def);
    mesh.position.set(def.x, def.y, def.z);
    if (def.ry) mesh.rotation.y = def.ry;
    g.scene.add(mesh);
    def.mesh = mesh;
    def.taken = false;
    const name = def.doc ? DOCS[def.doc]?.title : ITEMS[def.item]?.name;
    def.inter = g.interaction.add({
      id: 'pick:' + def.id, obj: mesh, range: 2.0,
      enabled: () => !def.taken && (!def.enabled || def.enabled()),
      prompt: () => (def.doc && !def.item ? 'Read' : 'Take') + ` — ${name}`,
      use: () => this.take(def),
    });
    this.pickups.push(def);
  }

  pickupMesh(def) {
    const m = this.game.mats;
    const g = new THREE.Group();
    const k = def.kind || (def.doc && !def.item ? 'paper' : 'item');
    let mesh;
    if (k === 'paper') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(def.wall ? 0.21 : 0.21, def.wall ? 0.29 : 0.004, def.wall ? 0.004 : 0.29), m.prop('paper'));
      mesh.rotation.y = def.wall ? 0 : Math.random() * 0.6 - 0.3;
      if (!def.wall) mesh.position.y = 0.003;
    } else if (k === 'battery') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.06, 10), m.prop('brass')); mesh.rotation.z = Math.PI / 2; mesh.position.y = 0.017;
    } else if (k === 'reel') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.018, 18), m.prop('blackPlastic')); mesh.position.y = 0.009;
      const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12), m.prop('paper')); lab.position.y = 0.01; g.add(lab);
    } else if (k === 'osc') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.08), m.prop('metalCream')); mesh.position.y = 0.03;
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 10), m.prop('blackPlastic')); dial.position.set(0.03, 0.065, 0); g.add(dial);
    } else if (k === 'keys') {
      mesh = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.004, 6, 14), m.prop('brass')); mesh.rotation.x = Math.PI / 2; mesh.position.y = 0.005;
      for (let j = 0; j < 3; j++) { const key = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 0.06), m.prop('brass')); key.position.set(-0.02 + j * 0.02, 0.004, 0.04); key.rotation.y = (j - 1) * 0.4; g.add(key); }
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, 0.03), m.prop('brass')); mesh.position.y = 0.005;
    }
    g.add(mesh);
    // Invisible generous hitbox
    const hb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), this.game.interaction.hitMat);
    hb.position.y = 0.05;
    g.add(hb);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  take(def) {
    const g = this.game;
    def.taken = true;
    def.mesh.visible = false;
    if (def.item) { g.inventory.add(def.item); g.audio.play(def.kind === 'keys' ? 'keys' : def.kind === 'battery' ? 'battery' : 'pickup'); }
    if (def.doc) {
      g.inventory.addDoc(def.doc);
      if (!def.item) { g.audio.play('paper'); g.readDoc(def.doc); }
      else if (DOCS[def.doc]?.kind === 'tape') g.ui.hint('A reel. Listen in the journal [Tab] → Tapes.', 3);
    }
    if (def.item === 'reel_s7' || def.item?.startsWith('reel_s')) {
      const n = g.inventory.reelCount();
      g.ui.hint(`Subject reels: ${n} / 6`, 3);
    }
    def.onTake?.();
    g.checkpointSoon();
  }

  // ------------------------------------------------------------------ doors
  doorPrompt(d) {
    const g = this.game;
    const dd = d.def;
    if (d.style === 'vault') return this.flags.vaultOpen ? null : 'Vault door';
    if (g.doors.isOpen(d)) return d.style === 'gate' ? null : 'Close';
    if (d.locked && dd.key && g.inventory.has(dd.key)) return 'Unlock';
    if (d.oneWayLocked) {
      const side = g.doors.sideOf(d, g.player.pos.x, g.player.pos.z);
      const fromOk = (dd.oneWay === 'z+' && side > 0) || (dd.oneWay === 'x+' && side > 0);
      return fromOk ? 'Draw the bolt' : 'Open';
    }
    if (d.bolted) {
      const side = g.doors.sideOf(d, g.player.pos.x, g.player.pos.z);
      return side === this.boltSide(d) ? 'Unbolt' : 'Open';
    }
    if (dd.bolt && this.boltSide(d) === g.doors.sideOf(d, g.player.pos.x, g.player.pos.z) && !d.locked) return 'Open  ·  [hold C] bolt';
    return 'Open';
  }

  boltSide(d) { return d.def.bolt?.endsWith('+') ? 1 : -1; }

  useDoor(d) {
    const g = this.game;
    const dd = d.def;
    const doors = g.doors;
    if (d.style === 'vault') { g.ui.subtitle(dd.lockMsg, 4); g.audio.playAt('doorLocked', { x: d.cx, y: d.y + 1, z: d.cz }); return; }
    if (doors.isOpen(d)) { doors.toggle(d, g.player); return; }
    if (d.locked) {
      if (dd.key && g.inventory.has(dd.key)) {
        d.locked = false;
        if (dd.pair) { const p = doors.get(dd.pair); if (p) p.locked = false; }
        g.audio.playAt('keys', { x: d.cx, y: d.y + 1, z: d.cz });
        g.ui.notify(`Unlocked: ${dd.name}`);
        if (dd.id === 'gate_l' || dd.id === 'gate_r') { this.flags.gateOpen = true; doors.open(d, g.player.pos.x, g.player.pos.z); }
        return;
      }
      doors.sound(d, 'locked');
      g.ui.subtitle(dd.lockMsg || 'Locked.', 3);
      return;
    }
    if (dd.powerLock && !d.powerReleased) { doors.sound(d, 'locked'); g.ui.subtitle(dd.lockMsg, 3.5); return; }
    if (d.oneWayLocked) {
      const side = doors.sideOf(d, g.player.pos.x, g.player.pos.z);
      if (side > 0) { d.oneWayLocked = false; g.audio.playAt('relayClunk', { x: d.cx, y: d.y + 1, z: d.cz }); g.ui.notify('Bolt drawn'); doors.open(d, g.player.pos.x, g.player.pos.z); }
      else { doors.sound(d, 'locked'); g.ui.subtitle('Bolted from the other side.', 2.5); }
      return;
    }
    if (d.bolted) {
      if (doors.sideOf(d, g.player.pos.x, g.player.pos.z) === this.boltSide(d)) { d.bolted = false; g.audio.playAt('latch', { x: d.cx, y: d.y + 1, z: d.cz }); g.ui.notify('Unbolted'); }
      else { doors.sound(d, 'locked'); g.ui.subtitle('It won\'t budge. Bolted from inside.', 2.5); }
      return;
    }
    // Bolt from inside when crouched (and closed)
    if (dd.bolt && g.input.is('crouch') && doors.sideOf(d, g.player.pos.x, g.player.pos.z) === this.boltSide(d)) {
      d.bolted = true; g.audio.playAt('latch', { x: d.cx, y: d.y + 1, z: d.cz }); g.ui.notify('Bolted'); return;
    }
    doors.toggle(d, g.player);
    g.playerModel.note('door', d.id);
    if (dd.id === 'front_l' || dd.id === 'front_r') this.beat('frontDoor');
  }

  // ------------------------------------------------------------------ breakers
  setupBreakers() {
    const g = this.game;
    const panel = g.map.props.find((p) => p.id === 'breakers');
    const y0 = g.map.floorAt(panel.x, panel.z) + 1.35;
    // Panel faces north (r=180): local +x maps to world -x.
    const group = new THREE.Group();
    group.position.set(panel.x, y0, panel.z - 0.12);
    group.rotation.y = Math.PI;
    g.scene.add(group);
    // Pictogram faceplate
    const face = canvasTex(512, 256, (c, w, h) => {
      c.fillStyle = '#4c5150'; c.fillRect(0, 0, w, h);
      this.panelOrder.forEach((p, k) => { c.fillStyle = '#c8bfa6'; c.fillRect(14 + k * 62, 18, 52, 52); drawPicto(c, p, 40 + k * 62, 44, 42, '#7a1d14', 0.09); });
      c.fillStyle = '#cfc8b4'; c.font = 'bold 16px Courier New'; c.fillText('MAIN — LARKHOLLOW DIST. BOARD — MAX LOAD 3', 20, 236);
    });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshStandardMaterial({ map: face, roughness: 0.6, metalness: 0.3 }));
    plate.position.set(0, 0.15, 0.002);
    group.add(plate);
    this.breakerLevers = [];
    this.panelOrder.forEach((name, k) => {
      const lever = new THREE.Group();
      const x = -0.75 + (14 + k * 62 + 26) / 512 * 1.5;
      lever.position.set(x, -0.15, 0.02);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.04), g.mats.prop('blackPlastic')); lever.add(base);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.05), g.mats.prop('chrome')); arm.position.set(0, 0.04, 0.04); lever.add(arm);
      lever.userData.arm = arm;
      group.add(lever);
      this.breakerLevers.push({ name, lever, arm });
      g.interaction.add({
        id: 'breaker:' + name, obj: lever, range: 1.8,
        prompt: () => `${g.power.isOn(name) ? 'Switch off' : 'Switch on'}  (${name === 'bird' || name === 'cup' || name === 'bed' || name === 'bulb' || name === 'flame' || name === 'speaker' || name === 'bell' || name === 'drop' ? '' : ''}breaker)`,
        use: () => this.flipBreaker(name),
      });
    });
    this.updateLevers();
    // Research relay box lamp
    const relay = g.map.props.find((p) => p.id === 'relay');
    this.relayLamp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2010 }));
    this.relayLamp.position.set(relay.x + 0.14, g.map.floorAt(relay.x, relay.z) + 1.75, relay.z);
    g.scene.add(this.relayLamp);
    const rtex = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#5b605e'; c.fillRect(0, 0, w, h); drawPicto(c, 'bird', 50, 64, 70, '#7a1d14', 0.09); c.fillStyle = '#e0dac6'; c.font = '16px Courier New'; c.fillText('RESEARCH', 100, 56); c.fillText('MAG SEALS', 100, 80); });
    const rp = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: rtex }));
    rp.position.set(relay.x + 0.14, g.map.floorAt(relay.x, relay.z) + 1.55, relay.z); rp.rotation.y = Math.PI / 2;
    g.scene.add(rp);
  }

  updateLevers() {
    for (const b of this.breakerLevers || []) {
      const on = this.game.power.isOn(b.name);
      b.arm.position.y = on ? 0.05 : -0.05;
      b.arm.rotation.x = on ? -0.5 : 0.5;
    }
    if (this.relayLamp) this.relayLamp.material.color.setHex(this.game.power.isOn('bird') ? 0x20ff50 : 0xff2010);
  }

  flipBreaker(name) {
    const g = this.game, pw = g.power;
    if (pw.tripping > 0) return;
    pw.on[name] = !pw.on[name];
    g.audio.playAt('breaker', { x: 3.7, y: -2.6, z: 10.8 });
    g.noiseEvent(3.7, 10.5, 0.3, 'breaker', 'breaker');
    this.updateLevers();
    if (pw.count() > MAX_CIRCUITS) {
      pw.tripping = 0.7;
      this.timer(0.7, () => {
        pw.tripping = 0;
        for (const k of Object.keys(pw.on)) pw.on[k] = false;
        this.updateLevers();
        g.audio.playAt('bang', { x: 3.7, y: -2.6, z: 10.8 }, { gain: 1.4 });
        g.noiseEvent(3.7, 10.5, 1.2, 'bang', null);
        g.lights.flickerNear(3.7, 10, 200, 1);
        g.ui.subtitle('The main trips with a bang. Everything goes dark.', 3.5);
        g.camShake = 1.0;
      });
      return;
    }
    if (name === 'bird' && pw.on.bird && !this.flags.powerRestored) { this.flags.powerRestored = true; this.beat('powerRestored'); }
    if (name === 'bell') this.updateBells();
    if (name === 'drop' && pw.on.drop && !this.flags.drained) this.startDrain();
  }

  updateBells() {
    const g = this.game;
    const on = g.power.isOn('bell');
    if (on && !this.bellLoops) {
      this.bellLoops = g.map.props.filter((p) => p.bell).map((p) => {
        const pos = { x: p.x, y: g.map.floorAt(p.x, p.z) + (p.y || 2), z: p.z };
        g.nav.repel.push({ x: p.x, z: p.z, r: 7, cost: 25, tag: 'bell' });
        return g.audio.loop('loopBell', { pos, gain: 1.0 });
      });
      g.ui.caption('[alarm bells ringing]');
    } else if (!on && this.bellLoops) {
      this.bellLoops.forEach((h) => h?.stop(0.2));
      this.bellLoops = null;
      g.nav.repel = g.nav.repel.filter((r) => r.tag !== 'bell');
    }
  }

  startDrain() {
    const g = this.game;
    g.audio.playAt('steam', { x: 39.6, y: -3, z: 10.4 }, { gain: 0.8 });
    g.ui.caption('[a pump groans into life somewhere below]');
    this.timer(18, () => { this.flags.drained = true; this.waterTarget = -4.6; g.ui.caption('[the cistern gurgles empty]'); });
  }

  // ------------------------------------------------------------------ boiler
  setupBoiler() {
    const g = this.game;
    this.valves = [0, 0, 0];
    this.valveMeshes = [];
    const by = g.map.floorAt(17, 9);
    [15.8, 17.0, 18.2].forEach((x, k) => {
      const grp = new THREE.Group();
      grp.position.set(x, by + 0.85, 9.62);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), g.mats.prop('steelDark')); stem.rotation.x = Math.PI / 2; stem.position.z = -0.08; grp.add(stem);
      const wheel = new THREE.Group();
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.018, 6, 20), g.mats.prop('paintRed')); wheel.add(rim);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.025, 0.025), g.mats.prop('paintRed')); wheel.add(bar);
      const nub = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.04), g.mats.prop('chrome')); nub.position.set(0.0, 0.14, 0.02); wheel.add(nub);
      grp.add(wheel);
      g.scene.add(grp);
      this.valveMeshes.push(wheel);
      g.interaction.add({ id: 'valve' + k, obj: grp, range: 1.8, prompt: () => 'Turn valve', use: () => {
        if (this.boilerRunning) { g.ui.hint('Not while she\'s running.', 2); return; }
        this.valves[k] = (this.valves[k] + 1) % 4;
        g.audio.playAt('valve', { x, y: by + 0.9, z: 9.6 }, { gain: 0.7 });
        g.noiseEvent(x, 9.6, 0.25, 'valve', 'valve');
        this.updateValves();
      } });
    });
    // Ignition lever
    const lever = new THREE.Group();
    lever.position.set(19.75, by + 1.0, 9.2);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05), g.mats.prop('steelDark')); h.position.y = 0.15; lever.add(h);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), g.mats.prop('paintRed')); knob.position.y = 0.36; lever.add(knob);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.05), g.mats.prop('metalGrey')); plate.position.z = -0.04; lever.add(plate);
    g.scene.add(lever);
    this.igniter = lever;
    g.interaction.add({ id: 'ignition', obj: lever, range: 1.8, prompt: () => this.boilerRunning ? 'Shut down boiler' : 'Pull ignition', use: () => this.ignite() });
    this.updateValves();
  }

  updateValves() { this.valveMeshes.forEach((w, k) => { w.rotation.z = -this.valves[k] * Math.PI / 2; }); }

  ignite() {
    const g = this.game;
    if (this.boilerRunning) { this.setBoiler(false); return; }
    this.igniter.rotation.x = 0.8; this.timer(0.6, () => { this.igniter.rotation.x = 0; });
    if (!g.power.isOn('flame')) { g.audio.playAt('click', { x: 19.7, y: -3, z: 9.2 }); g.ui.subtitle('Nothing. The igniter has no power.', 2.5); return; }
    const ok = this.valves.every((v, k) => v === this.valveSolution[k]);
    if (!ok) {
      g.audio.playAt('steamBurst', { x: 17, y: -2.5, z: 9.6 }, { gain: 1.3 });
      g.noiseEvent(17, 9.6, 1.0, 'steam', null);
      g.ui.subtitle('Steam screams from a seam. The valves are wrong.', 3);
      g.camShake = 0.6;
      return;
    }
    this.setBoiler(true);
  }

  setBoiler(on) {
    const g = this.game;
    this.boilerRunning = on;
    this.flags.boiler = on;
    if (on) {
      g.audio.playAt('boilerIgnite', { x: 17, y: -2.8, z: 9 }, { gain: 1.2 });
      this.boilerLoop = g.audio.loop('loopBoiler', { pos: { x: 17, y: -2.8, z: 8.4 }, gain: 1.6, ref: 3, rolloff: 0.9 });
      g.nav.repel.push({ x: 17, z: 8.4, r: 10, cost: 30, tag: 'boiler' });
      g.ui.subtitle('The boiler catches with a roar. It\'s loud in here. Good.', 3.5);
      this.flags.boilerEver = true;
    } else {
      this.boilerLoop?.stop(1.5); this.boilerLoop = null;
      g.nav.repel = g.nav.repel.filter((r) => r.tag !== 'boiler');
    }
  }

  // ------------------------------------------------------------------ piano + music box
  setupPiano() {
    const g = this.game;
    const piano = g.map.props.find((p) => p.id === 'piano');
    const y = g.map.floorAt(piano.x, piano.z) + 0.78;
    this.played = [];
    for (let k = 0; k < 8; k++) {
      // Piano faces west (r=270): keyboard runs along z.
      const z = piano.z + 0.6 - k * 0.15;
      g.interaction.add({ id: 'pkey' + k, at: { x: piano.x - 0.55, y, z, w: 0.2, h: 0.08, d: 0.13 }, range: 1.6, prompt: () => `Play key ${'CDEFGABC'[k]}${k === 7 ? "'" : ''}`, use: () => this.playKey(k) });
    }
    // Music box on Dormitory 4 desk (east room, z0 = 23)
    const mb = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.11), g.mats.prop('darkWood')); box.position.y = 0.045; mb.add(box);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.11), g.mats.prop('darkWood')); lid.position.set(0, 0.12, -0.04); lid.rotation.x = -1.1; mb.add(lid);
    const crank = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.05), g.mats.prop('brass')); crank.position.set(0.09, 0.05, 0); mb.add(crank);
    mb.position.set(41.5, g.map.floorAt(41.5, 23.4) + 0.78, 23.4);
    g.scene.add(mb);
    g.interaction.add({ id: 'musicbox', obj: mb, range: 1.8, prompt: () => 'Wind the music box', use: () => this.playMusicBox(mb.position) });
  }

  playMusicBox(pos) {
    const g = this.game;
    this.melody.forEach((n, k) => g.audio.playAt('musicBox', pos, { variant: n, delay: 0.5 + k * 0.55, gain: 0.9, ref: 1 }));
    g.noiseEvent(pos.x, pos.z, 0.3, 'musicbox', null);
    if (g.settings.get('captions')) g.ui.caption('[music box: ' + this.melody.map((n) => 'CDEFGABC'[n] + (n === 7 ? "'" : '')).join(' ') + ']', 5);
    else g.ui.caption('[a music box plays five notes]', 4);
    this.flags.heardMusicBox = true;
  }

  playKey(k) {
    const g = this.game;
    const piano = g.map.props.find((p) => p.id === 'piano');
    g.audio.playAt('piano', { x: piano.x, y: 1, z: piano.z }, { variant: k, gain: 0.9 });
    g.noiseEvent(piano.x, piano.z, 0.5, 'piano', 'piano');
    g.ui.caption('♪ ' + 'CDEFGABC'[k] + (k === 7 ? "'" : ''), 1.2);
    this.played.push(k);
    if (this.played.length > 5) this.played.shift();
    if (!this.flags.benchOpen && this.played.length === 5 && this.played.every((v, i) => v === this.melody[i])) {
      this.flags.benchOpen = true;
      this.timer(0.8, () => {
        g.audio.playAt('latch', { x: 65.85, y: 0.5, z: 19.5 });
        g.ui.subtitle('A click from the piano bench. The lid has come loose.', 3);
        const bench = g.propsById.get('pianoBench');
        if (bench) bench.children.forEach((c, i) => { if (i === 0) { c.position.y += 0.08; c.rotation.z = 0.5; } });
      });
    }
  }

  // ------------------------------------------------------------------ studio: reel + recording + voice lock
  setupStudio() {
    const g = this.game;
    const deck = g.map.props.find((p) => p.id === 'reelDeck');
    this.deckPos = { x: deck.x, y: g.map.floorAt(deck.x, deck.z) + 1.1, z: deck.z };
    g.interaction.add({ id: 'reelDeck', obj: g.propsById.get('reelDeck'), range: 2.0,
      prompt: () => this.reelPlaying ? 'Stop the reel' : (g.inventory.has('reel_dictation') ? 'Thread the reel and play' : 'Reel-to-reel machine'),
      use: () => this.useDeck() });
    const vp = g.map.props.find((p) => p.id === 'voicePanel');
    g.interaction.add({ id: 'voicePanel', obj: g.propsById.get('voicePanel'), range: 2.0,
      prompt: () => this.flags.vaultOpen ? null : 'Voice lock', use: () => this.useVoiceLock(vp) });
    // Recordable sources registry: [{x,z,y,r, id, label, active()}]
    this.recordables = [
      { id: 'morrow', label: 'A.M. — authorisation', get x() { return deck.x; }, z: deck.z, r: 3.6, active: () => this.reelPlaying },
      { id: 'roomtone', label: 'CHAMBER ZERO — room tone', x: 76.5, z: 7.5, r: 4.5, active: () => this.flags.vaultOpen && g.map.zoneAt(g.player.pos.x, g.player.pos.z)?.ch === 'z' },
    ];
  }

  useDeck() {
    const g = this.game;
    if (this.reelPlaying) { this.stopReel(); return; }
    if (!g.inventory.has('reel_dictation')) { g.ui.subtitle('A professional reel-to-reel. No tape on it.', 2.5); return; }
    if (!g.power.isOn('bird')) { g.ui.subtitle('No power to the studio.', 2.5); return; }
    this.reelPlaying = true;
    this.reelT = 0;
    g.audio.play('tape');
    this.reelVoice = g.audio.loop('voiceMorrow', { pos: { ...this.deckPos, x: 62.9, z: 26.3 }, gain: 1.5, ref: 3 });
    g.ui.subtitle('Morrow\'s voice fills the control room — far too loud.', 3);
    g.ui.hint('Hold [RMB] to raise the recorder, then hold [LMB] near the monitors to record.', 6);
    const lines = ['"Authorisation Morrow. Agathe. Larkhollow."', '"The room is quiet and so am I."'];
    let i = 0;
    this.reelSubs = setInterval(() => { if (this.reelPlaying) g.ui.subtitle(lines[i++ % 2], 3.2, 'Morrow (tape)'); }, 3500);
  }

  stopReel() {
    const g = this.game;
    this.reelPlaying = false;
    this.reelVoice?.stop(0.3); this.reelVoice = null;
    clearInterval(this.reelSubs);
    g.audio.play('tape');
  }

  useVoiceLock(vp) {
    const g = this.game;
    const pos = { x: vp.x, y: -0 + 1.2, z: vp.z };
    if (!g.power.isOn('bird')) { g.ui.subtitle('The panel is dead.', 2); return; }
    const tape = g.inventory.tape;
    if (!tape) { g.audio.playAt('doorLocked', pos); g.ui.subtitle('A grille, a small red lamp: SPEAK AUTHORISATION. I am not her.', 3.5); return; }
    g.audio.play('tape');
    if (tape.id === 'morrow' && tape.quality >= 1) {
      g.audio.playAt('voiceMorrow', pos, { gain: 0.8 });
      g.ui.subtitle('"Authorisation Morrow. Agathe. Larkhollow. The room is quiet and so am I."', 4, 'Your recorder');
      this.timer(4.5, () => this.openVault());
    } else {
      g.audio.playAt('voiceTape', pos, { gain: 0.6 });
      this.timer(2.5, () => { g.audio.playAt('doorLocked', pos); g.ui.subtitle(tape.id === 'morrow' ? 'PARTIAL MATCH — REJECTED. I need the whole phrase.' : 'REJECTED.', 3); });
    }
  }

  openVault() {
    const g = this.game;
    const vault = g.doors.get('vault');
    vault.locked = false;
    g.audio.playAt('vault', { x: vault.cx, y: 1.2, z: vault.cz }, { gain: 1.4 });
    g.doors.open(vault, g.player.pos.x, g.player.pos.z, { silent: true });
    this.flags.vaultOpen = true;
    this.beat('finale');
  }

  // Called each frame while the recorder is raised and LMB held.
  recordTick(dt) {
    const g = this.game;
    const p = g.player.pos;
    const src = this.recordables.find((r) => r.active() && Math.hypot(r.x - p.x, r.z - p.z) < r.r);
    if (!src) return null;
    if (!this.recording || this.recording.id !== src.id) this.recording = { id: src.id, label: src.label, t: 0 };
    this.recording.t += dt;
    const need = src.id === 'morrow' ? 9 : 7;
    if (this.recording.t >= need) {
      g.inventory.tape = { id: src.id, label: src.label, quality: 1 };
      this.recording = null;
      g.audio.play('tape');
      if (src.id === 'morrow') { g.ui.notify('Recorded: Morrow — full authorisation phrase'); this.flags.recordedVoice = true; g.checkpointSoon(); }
      else { g.ui.notify('Recorded: Chamber Zero room tone'); this.flags.roomTone = true; g.ui.subtitle('Sixty seconds of nothing. The needle never moved. The tape feels heavier.', 4); }
      return 'done';
    }
    return { label: src.label, progress: this.recording.t / need };
  }

  recordRelease() {
    const g = this.game;
    if (this.recording && this.recording.id === 'morrow' && this.recording.t > 1.5) {
      g.inventory.tape = { id: 'morrow', label: 'A.M. — partial', quality: 0.5 };
      g.ui.notify('Recorded: Morrow — partial');
    }
    this.recording = null;
  }

  // ------------------------------------------------------------------ finale systems
  setupFinale() {
    const g = this.game;
    g.interaction.add({ id: 'ampRack', obj: g.propsById.get('ampRack'), range: 2.2, prompt: () => this.flags.paOn ? 'Amplifiers are live' : 'Main amplifier switch', use: () => {
      if (this.flags.paOn) return;
      if (!g.power.isOn('speaker')) { g.audio.playAt('click', { x: 78, y: 1, z: 45.4 }); g.ui.subtitle('Dead. The speaker circuit isn\'t live.', 2.5); return; }
      this.flags.paOn = true;
      g.audio.playAt('pa', { x: 78, y: 1, z: 45.4 }, { gain: 1.2 });
      g.noiseEvent(78, 45, 0.6, 'pa', null);
      g.ui.subtitle('The racks warm up with a rising hum. Every speaker in the building crackles.', 3.5);
      this.ampLights?.forEach((m) => m.material.color.setHex(0x40ff70));
    } });
    g.interaction.add({ id: 'sweepPanel', obj: g.decorById.get('sweepPanel'), range: 2.0, prompt: () => this.flags.fullSpectrum ? null : this.sweepActive ? null : 'Full Spectrum sweep panel', use: () => this.trySweep() });
    // Chamber deck: secret ending
    g.interaction.add({ id: 'chamberDeck', obj: g.propsById.get('chamberDeck'), range: 2.0, enabled: () => this.flags.vaultOpen,
      prompt: () => g.inventory.reelCount() >= 6 ? 'Play the six reels into the room' : `Small reel player  (${g.inventory.reelCount()}/6 subject reels)`,
      use: () => { if (g.inventory.reelCount() >= 6) this.roomToneEnding(); else g.ui.subtitle('Six subjects never came back. Their reels are scattered through the building.', 3.5); } });
    // Car + gate
    g.interaction.add({ id: 'car', obj: g.propsById.get('car'), range: 2.6, prompt: () => 'Leave Larkhollow', use: () => this.tryLeave() });
  }

  trySweep() {
    const g = this.game;
    const need = [];
    if (!this.boilerRunning) need.push('BOILER WHISTLES: no pressure');
    if (!(this.flags.paOn && g.power.isOn('speaker'))) need.push('PA AMPLIFIERS: offline');
    if (!this.flags.vaultOpen) need.push('CHAMBER ZERO: sealed');
    if (!g.power.isOn('bird')) need.push('PANEL: no power');
    if (need.length) { g.audio.playAt('doorLocked', { x: 66.9, y: 1.3, z: 31.6 }); g.ui.subtitle(need.join('  ·  '), 4.5); return; }
    this.startSweep();
  }

  startSweep() {
    const g = this.game;
    this.sweepActive = true;
    this.sweepT = 0;
    g.audio.play('sweep', { gain: 0.6, bus: g.audio.music });
    this.sweepLoops = [
      g.audio.loop('loopWhistle', { pos: { x: 17, y: -1, z: 8 }, gain: 1.2 }),
      g.audio.loop('loopWhistle', { pos: { x: 37, y: 2.6, z: 25 }, gain: 0.9 }),
      g.audio.loop('loopWhistle', { pos: { x: 62, y: 2.6, z: 34.5 }, gain: 0.9 }),
      g.audio.loop('loopOsc', { pos: { x: 63, y: 2.6, z: 14 }, gain: 0.5 }),
      g.audio.loop('loopOsc', { pos: { x: 76, y: 3, z: 7 }, gain: 0.7 }),
    ];
    g.ui.subtitle('Every pipe in Larkhollow begins to scream. Sixty seconds.', 4);
    g.ui.objective('SURVIVE THE SWEEP — 60');
    g.ai.memory = { x: g.player.pos.x, z: g.player.pos.z, t: g.time, vx: 0, vz: 0 };
    if (g.ai.state !== S.CHASE) g.ai.setState(S.HUNT, { force: true });
    g.camShake = 0.3;
  }

  updateSweep(dt) {
    const g = this.game;
    this.sweepT += dt;
    const left = Math.max(0, Math.ceil(60 - this.sweepT));
    g.ui.objective(`SURVIVE THE SWEEP — ${left}`);
    this.sweepLoops.forEach((h) => h?.setGain(Math.min(1.6, 0.4 + this.sweepT / 40), 1));
    g.camShake = 0.15 + this.sweepT / 200;
    g.ai.speedMul = 1.05 - Math.min(0.35, this.sweepT / 170);
    // It always knows roughly where the one who started it is.
    this.sweepHint = (this.sweepHint || 0) - dt;
    if (this.sweepHint <= 0 && g.ai.state !== S.CHASE) {
      this.sweepHint = 5;
      g.ai.memory = { x: g.player.pos.x + this.rng.range(-3, 3), z: g.player.pos.z + this.rng.range(-3, 3), t: g.time, vx: 0, vz: 0 };
      g.ai.setState(S.HUNT, { force: true });
    }
    if (this.sweepT >= 60) this.endSweep();
  }

  endSweep() {
    const g = this.game;
    this.sweepActive = false;
    this.flags.fullSpectrum = true;
    g.ui.objective('');
    const ai = g.ai;
    g.audio.playAt('collage', { x: ai.pos.x, y: ai.pos.y + 2, z: ai.pos.z }, { gain: 1.6 });
    g.audio.playAt('inhale', { x: ai.pos.x, y: ai.pos.y + 2, z: ai.pos.z }, { gain: 1.4 });
    ai.chaseLoop?.stop(0.5); ai.chaseLoop = null;
    ai.setState(S.DEAD, { force: true });
    ai.awake = false;
    this.sweepLoops.forEach((h) => h?.stop(4));
    g.lights.globalDim = 1; g.lights.emergencyBoost = 0.2;
    g.camShake = 0;
    this.timer(4, () => { g.ui.subtitle('The pipes wind down. And then — the hum comes back. Rain on the windows. Your own breathing.', 6); g.ui.objective('Leave Larkhollow'); });
    g.checkpointSoon();
  }

  tryLeave() {
    const g = this.game;
    if (!this.flags.revelation) { g.ui.subtitle('Not yet. The money\'s already spent and the job isn\'t done.', 3); return; }
    if (!this.flags.gateOpen) { g.ui.subtitle('The gate is chained. There was a padlock key somewhere — Morrow\'s desk?', 3.5); return; }
    if (this.flags.fullSpectrum) g.ending('full_spectrum');
    else if (this.flags.vaultOpen) g.ending('carrier');
    else g.ending('quiet_job');
  }

  roomToneEnding() {
    const g = this.game;
    g.player.frozen = true;
    g.ai.noKill = true;
    g.ui.subtitle('You thread the first reel. A voice you\'ve never heard fills the dead room — and for once, it stays.', 5);
    REELS.forEach((r, k) => this.timer(1 + k * 2.2, () => g.audio.play(DOCS[r].voice || 'voiceTape', { gain: 0.8 })));
    if (g.ai.awake) { g.ai.teleport(75.5, 9.5); g.ai.setState(S.WATCH, { force: true }); g.ai.body.root.visible = true; }
    this.timer(14, () => g.ending('room_tone'));
  }

  // ------------------------------------------------------------------ misc set dressing
  setupMisc() {
    const g = this.game;
    // Radio in the lounge
    g.interaction.add({ id: 'radio', at: { x: 15.0, y: 1.0, z: 37.3, w: 0.35, h: 0.2, d: 0.2 }, prompt: () => this.radioLoop ? 'Switch off the radio' : 'Radio', use: () => this.toggleRadio() });
    // Pump
    g.interaction.add({ id: 'pump', obj: g.propsById.get('pump'), range: 2, prompt: () => 'Pump', use: () => g.ui.subtitle(this.flags.drained ? 'Drained.' : g.power.isOn('drop') ? 'Running. Give it time.' : 'A cistern pump. A little red droplet is painted on the motor.', 3) });
    // Hidden shelf
    g.interaction.add({ id: 'secretShelf', obj: g.propsById.get('secretShelf'), range: 2.0, enabled: () => !g.doors.get('secret').secretOpen,
      prompt: () => this.flags.shelfNoticed ? 'Push the shelf' : 'Examine the shelf',
      use: () => {
        if (!this.flags.shelfNoticed) { this.flags.shelfNoticed = true; g.ui.subtitle('Cold air on your hand. A thin whistle. There\'s space behind this shelf.', 3.5); return; }
        g.doors.open(g.doors.get('secret'), g.player.pos.x, g.player.pos.z);
        g.noiseEvent(67.7, 41.5, 0.55, 'shelf', null);
      } });
    // Mirror (passive scare handled in Game)
    // Water in the cistern
    const water = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), g.mats.prop('water'));
    water.rotation.x = -Math.PI / 2; water.position.set(44, -3.78, 8);
    g.scene.add(water);
    this.water = water; this.waterTarget = -3.78;
    // Amp lights
    const amp = g.propsById.get('ampRack');
    this.ampLights = [];
    if (amp) for (let k = 0; k < 6; k++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.01), new THREE.MeshBasicMaterial({ color: 0x401010 }));
      l.position.set(78.6, g.map.floorAt(78, 45) + 0.33 + k * 0.28, 45.33); l.rotation.y = Math.PI;
      g.scene.add(l); this.ampLights.push(l);
    }
  }

  toggleRadio() {
    const g = this.game;
    if (this.radioLoop) { this.radioLoop.stop(0.2); this.radioLoop = null; g.audio.play('click'); return; }
    this.radioLoop = g.audio.loop('loopRadio', { pos: { x: 15, y: 1.0, z: 37.3 }, gain: 0.7 });
    g.noiseEvent(15, 37.5, 0.5, 'radio', 'radio');
  }

  answerPhone() {
    const g = this.game;
    if (!this.phoneRinging) { g.ui.subtitle('The receiver is cold. There\'s no dial tone. There\'s no line at all — the cable is cut.', 3.5); return; }
    this.phoneRinging = false;
    this.phoneLoop?.stop(0.05); this.phoneLoop = null;
    g.audio.play('click');
    g.ui.subtitle('...', 2, 'Phone');
    this.timer(1.5, () => { g.audio.play('breathIn', { variant: 1, gain: 0.6, bus: g.audio.voice }); g.audio.play('breathOut', { variant: 1, gain: 0.6, bus: g.audio.voice, delay: 1.1 }); g.ui.subtitle('Breathing. Heavy, like after a run. It\'s yours — from the stairs, a minute ago.', 4.5, 'Phone'); });
    this.timer(6, () => { g.audio.play('click'); this.flags.phoneAnswered = true; });
  }

  ringPhone() {
    const g = this.game;
    if (this.phoneRinging) return;
    this.phoneRinging = true;
    let n = 0;
    const ring = () => {
      if (!this.phoneRinging || n++ > 6) { this.phoneRinging = false; return; }
      g.audio.playAt('phone', { x: 37.2, y: 1.15, z: 42.3 }, { gain: 1.1 });
      g.noiseEvent(37.2, 42.3, 0.6, 'phone', 'phone');
      this.timer(3.2, ring);
    };
    ring();
  }

  // ------------------------------------------------------------------ beats / phases
  advancePhase(p) { if ((this.flags.phase || 1) < p) { this.flags.phase = p; this.game.events.emit('phase', p); } }
  get phase() { return this.flags.phase || 1; }

  aggression() {
    const f = this.flags;
    let a = 0.25;
    if (f.keysFound) a = 0.45;
    if (f.recordedVoice) a = 0.6;
    if (f.revelation) a = Math.max(a, 0.55);
    if (f.finale) a = 0.95;
    return a;
  }

  revelation() {
    if (this.flags.revelation) return;
    this.flags.revelation = true;
    this.advancePhase(7);
    const g = this.game;
    this.timer(4, () => { g.ui.objective('Open Chamber Zero — or leave'); });
    this.timer(25, () => this.ringPhone());
    this.portraitStage = 2; this.drawPortrait(3);
  }

  beat(name) {
    const g = this.game;
    const f = this.flags;
    if (f['beat_' + name]) return;
    f['beat_' + name] = true;
    switch (name) {
      case 'frontDoor':
        g.ui.objective('Find a way to Chamber Zero');
        break;
      case 'keysFound':
        this.advancePhase(6);
        g.ui.subtitle('Her keys. Three of them. The hall throws the jingle back at you for seconds.', 4);
        if (g.ai.awake) { g.ai.memory = { x: g.player.pos.x, z: g.player.pos.z, t: g.time, vx: 0, vz: 0 }; this.timer(3, () => { if (g.ai.state !== S.CHASE) g.ai.setState(S.HUNT, { force: true }); }); }
        g.checkpointSoon();
        break;
      case 'powerRestored':
        this.advancePhase(3);
        g.ui.subtitle('A deep relay thunks somewhere above. The research lamp turns green.', 4);
        this.timer(6, () => {
          g.audio.play('pa', { gain: 0.5, reverb: 0.8 });
          g.ui.caption('[the PA crackles, building-wide]');
        });
        this.timer(10, () => this.lightsDieInSequence());
        g.checkpointSoon();
        break;
      case 'finale':
        f.finale = true;
        this.advancePhase(8);
        g.lights.globalDim = 0.12; g.lights.emergencyBoost = 1;
        g.ambienceOverride = 'dead';
        g.ui.subtitle('The vault rolls aside. The room beyond is perfectly, impossibly silent.', 5);
        this.timer(6, () => {
          g.audio.play('sting', { gain: 1, bus: g.audio.music });
          g.ui.subtitle('Behind you, every light in Larkhollow goes red.', 4);
          g.ui.objective('Full Spectrum: boiler · PA · sweep panel — or run');
          // The Remainder, whole now, comes out of the chamber.
          if (!g.ai.awake) g.ai.wake(76, 7); else { g.ai.teleport(76, 7); }
          g.ai.memory = { x: g.player.pos.x, z: g.player.pos.z, t: g.time, vx: 0, vz: 0 };
          this.timer(4, () => g.ai.setState(S.HUNT, { force: true }));
          // Doors swing open building-wide
          for (const d of g.doors.list) if (!g.doors.isLocked(d) && !g.doors.isOpen(d) && d.style !== 'gate' && this.rng.chance(0.6)) this.timer(this.rng.range(0, 3), () => g.doors.open(d, d.cx + 1, d.cz + 1, { slow: true, byEntity: true }));
        });
        g.checkpointSoon(12);
        break;
    }
  }

  lightsDieInSequence() {
    const g = this.game;
    const p = g.player.pos;
    const fx = g.lights.fixtures.filter((f) => f.circuit !== 'emergency' && f.circuit !== 'ext' && Math.hypot(f.x - p.x, f.z - p.z) < 30).sort((a, b) => Math.hypot(b.x - p.x, b.z - p.z) - Math.hypot(a.x - p.x, a.z - p.z));
    fx.forEach((f, k) => this.timer(k * 0.18, () => { f.kill = 3.5 - k * 0.1; g.audio.playAt('click', { x: f.x, y: f.y, z: f.z }, { gain: 0.5 }); }));
    this.timer(fx.length * 0.18 + 1, () => {
      // In the dark, it's standing there.
      g.ai.startWatch();
      g.ai.awake = false; // still a glimpse only
      g.ai.forceVisible = true;
      this.timer(3.2, () => { g.ai.forceVisible = false; g.ai.body.root.visible = false; g.ai.state = S.DORMANT; });
    });
  }

  // Story triggers checked every frame.
  update(dt) {
    const g = this.game;
    const f = this.flags;
    const pz = g.map.zoneAt(g.player.pos.x, g.player.pos.z);
    // Timers
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      t.t -= dt;
      if (t.t <= 0) { this.timers.splice(i, 1); try { t.fn(); } catch (e) { console.error(e); } }
    }
    if (this.sweepActive) this.updateSweep(dt);
    if (this.water) this.water.position.y += (this.waterTarget - this.water.position.y) * Math.min(1, dt * 0.15);
    // Terminal screens glow
    if (this.termScreens) for (const s of this.termScreens) s.material.color.setHex(g.power.isOn('bird') || g.power.isOn('cup') ? 0x1a6a2a : 0x081208);
    if (!pz) return;
    const ch = pz.ch;
    if (!f.enteredLobby && ch === 'a') {
      f.enteredLobby = true;
      this.timer(2.5, () => { const d = g.doors.get('front_l'); if (g.doors.isOpen(d)) { g.doors.close(d, { slow: true, byEntity: true }); g.doors.close(g.doors.get('front_r'), { slow: true, byEntity: true, silent: true }); } });
      g.lights.flickerNear(41, 41, 10, 1);
      g.checkpointSoon();
    }
    if (!f.enteredResidential && (ch === 'n' || ch === 'd')) { f.enteredResidential = true; this.advancePhase(2); }
    if (this.phase >= 2 && !f.firstFootstep && (ch === 'n' || ch === 'c') && g.player.stillTime > 0.6 && g.player.lastMoveDist > 6) {
      f.firstFootstep = true;
      const pl = g.player; const fw = pl.forward(new THREE.Vector3());
      g.audio.playAt('step_tile', { x: pl.pos.x - fw.x * 6, y: pl.pos.y, z: pl.pos.z - fw.z * 6 }, { gain: 0.55 });
    }
    if (!f.enteredBasement && g.player.pos.y < -1.5) {
      f.enteredBasement = true;
      this.advancePhase(3);
      const d = g.doors.get('maint');
      this.timer(1.2, () => { if (g.doors.isOpen(d)) g.doors.close(d, { slam: true, byEntity: true }); g.camShake = 0.4; });
    }
    if (!f.firstSighting && ch === 'e' && f.powerRestored) {
      f.firstSighting = true;
      this.advancePhase(4);
      this.timer(1.5, () => {
        if (g.ai.startWatch()) { g.ai.awake = true; g.ai.forceVisible = true; this.timer(0.2, () => { g.ai.forceVisible = false; }); }
        this.timer(25, () => { if (!g.ai.awake || g.ai.state === S.DORMANT) { const p = g.ai.pickPatrolPoint(); g.ai.wake(p.x, p.z); } else g.ai.awake = true; });
      });
      g.checkpointSoon();
    }
    if (!f.officeEntered && ch === 'm') { f.officeEntered = true; }
    if (this.phase >= 3 && !f.signin2 && ch === 'a' && f.enteredBasement) { f.signin2 = true; }
    if (this.phase >= 3 && this.portraitStage === undefined) this.portraitStage = 0;
    if (f.enteredBasement && this.portraitStage === 0 && ch !== 'a' && !f.portraitScratched) { f.portraitScratched = true; this.portraitStage = 1; this.drawPortrait(1); }
  }

  timer(t, fn) { this.timers.push({ t, fn }); }

  serialize() {
    return {
      flags: this.flags, valves: this.valves, boiler: !!this.boilerRunning, taken: this.pickups.filter((p) => p.taken).map((p) => p.id),
      portraitStage: this.portraitStage ?? 0, tape: this.game.inventory.tape,
    };
  }

  deserialize(d) {
    const g = this.game;
    this.timers = [];
    if (this.reelPlaying) this.stopReel();
    if (this.radioLoop) { this.radioLoop.stop(0.1); this.radioLoop = null; }
    if (this.sweepLoops) { this.sweepLoops.forEach((h) => h?.stop(0.1)); this.sweepLoops = null; }
    this.sweepActive = false;
    this.phoneRinging = false;
    this.flags = d ? JSON.parse(JSON.stringify(d.flags)) : {};
    this.valves = d?.valves ? d.valves.slice() : [0, 0, 0];
    this.updateValves();
    this.setBoiler(false);
    if (d?.boiler) { this.boilerRunning = false; this.setBoiler(true); }
    const taken = new Set(d?.taken || []);
    for (const p of this.pickups) { p.taken = taken.has(p.id); p.mesh.visible = !p.taken; }
    this.portraitStage = d?.portraitStage ?? 0;
    this.drawPortrait(this.portraitStage === 2 ? 3 : this.portraitStage);
    if (this.bellLoops) { this.bellLoops.forEach((h) => h?.stop(0.1)); this.bellLoops = null; g.nav.repel = g.nav.repel.filter((r) => r.tag !== 'bell'); }
    this.updateLevers();
    this.updateBells();
    this.waterTarget = this.flags.drained ? -4.6 : -3.78;
    if (this.water) this.water.position.y = this.waterTarget;
    if (this.flags.paOn) this.ampLights?.forEach((m) => m.material.color.setHex(0x40ff70)); else this.ampLights?.forEach((m) => m.material.color.setHex(0x401010));
    if (this.flags.finale && !this.flags.fullSpectrum) { g.lights.globalDim = 0.12; g.lights.emergencyBoost = 1; } else { g.lights.globalDim = 1; g.lights.emergencyBoost = this.flags.fullSpectrum ? 0.2 : 0; }
    g.ambienceOverride = this.flags.finale && !this.flags.fullSpectrum ? 'dead' : null;
    const bench = g.propsById.get('pianoBench');
    if (bench && this.flags.benchOpen && bench.children[0]) { bench.children[0].position.y += 0.08; bench.children[0].rotation.z = 0.5; }
  }
}

export { CELL };
