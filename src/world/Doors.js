// Doors: visuals, swinging, locks (keys, power, voice, one-way bolts), grid sync, sounds and noise.
import * as THREE from 'three';

const OPEN_ANGLE = 1.75;

export class Doors {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.group.name = 'doors';
    this.list = [];
    this.byId = new Map();
    for (const d of game.map.doors) this.create(d);
  }

  create(d) {
    const g = this.game;
    const mats = g.mats;
    const floor = g.map.floorH[g.map.idx(d.x, d.z)];
    const ceil = g.map.ceilH[g.map.idx(d.x, d.z)];
    const H = Math.min(ceil - floor - 0.02, d.style === 'gate' ? 2.2 : 2.6);
    const root = new THREE.Group();
    root.position.set(d.x + 0.5, floor, d.z + 0.5);
    // Local frame: leaf spans local X across the opening; passage along local Z.
    if (d.passage === 'x') root.rotation.y = Math.PI / 2;
    const hingeRight = d.hinge === 'r';
    const pivot = new THREE.Group();
    pivot.position.set(hingeRight ? 0.5 : -0.5, 0, 0);
    root.add(pivot);
    const leaf = new THREE.Group();
    leaf.position.set(hingeRight ? -0.5 : 0.5, 0, 0);
    pivot.add(leaf);
    const add = (mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; leaf.add(mesh); return mesh; };
    const box = (w, h, dd, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), mats.prop(mat)); m.position.set(x, y, z); return add(m); };
    const W = 0.96;
    let hitMesh;
    switch (d.style) {
      case 'vault': {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.45, 32), mats.prop('steelDark'));
        m.rotation.x = Math.PI / 2; m.position.set(0, 1.2, 0);
        add(m);
        for (let k = 0; k < 6; k++) { const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), mats.prop('chrome')); bolt.rotation.x = Math.PI / 2; bolt.position.set(Math.cos(k) * 0.9, 1.2 + Math.sin(k) * 0.9, 0.05); add(bolt); }
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.04, 8, 24), mats.prop('chrome')); wheel.position.set(0, 1.2, 0.3); add(wheel);
        hitMesh = m;
        break;
      }
      case 'shelf': {
        hitMesh = box(W, H, 0.1, 'black', 0, H / 2, 0);
        hitMesh.visible = false;
        break;
      }
      case 'gate': {
        hitMesh = box(W, 0.06, 0.05, 'steelDark', 0, 2.0, 0);
        box(W, 0.06, 0.05, 'steelDark', 0, 0.15, 0);
        for (let k = 0; k < 7; k++) box(0.025, 1.9, 0.025, 'steelDark', -0.42 + k * 0.14, 1.07, 0);
        box(0.05, 2.1, 0.05, 'steelDark', hingeRight ? 0.46 : -0.46, 1.05, 0);
        break;
      }
      case 'glassDouble': {
        hitMesh = box(W, 0.1, 0.06, 'steelDark', 0, H - 0.05, 0);
        box(W, 0.12, 0.06, 'steelDark', 0, 0.06, 0);
        box(0.06, H, 0.06, 'steelDark', -0.45, H / 2, 0); box(0.06, H, 0.06, 'steelDark', 0.45, H / 2, 0);
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.84, H - 0.2), mats.prop('glass')); gl.position.set(0, H / 2, 0); leaf.add(gl);
        const glb = gl.clone(); glb.rotation.y = Math.PI; leaf.add(glb);
        box(0.03, 0.4, 0.08, 'chrome', hingeRight ? -0.35 : 0.35, 1.05, 0.05);
        break;
      }
      default: {
        const mat = { wood: 'wood', woodGlass: 'wood', woodDark: 'darkWood', metal: 'metalGrey', heavy: 'metalGreen', security: 'metalGrey', studio: 'fabricGreen', hatch: 'metalGrey' }[d.style] || 'wood';
        hitMesh = box(W, H - 0.04, 0.05, mat, 0, (H - 0.04) / 2, 0);
        if (d.style === 'woodGlass') { const gl = box(0.36, 0.5, 0.06, 'glassFrost', 0, 1.5, 0); gl.castShadow = false; }
        if (d.style === 'security' || d.style === 'heavy') { box(0.2, 0.25, 0.06, 'glassDark', 0, 1.55, 0); box(0.7, 0.05, 0.08, 'chrome', 0, 1.0, 0.06); box(0.7, 0.05, 0.08, 'chrome', 0, 1.0, -0.06); }
        if (d.style === 'studio') { for (let k = 0; k < 5; k++) box(0.85, 0.02, 0.07, 'blackPlastic', 0, 0.3 + k * 0.4, 0); box(0.18, 0.22, 0.07, 'glassDark', 0, 1.55, 0); }
        const kx = hingeRight ? -0.38 : 0.38;
        box(0.04, 0.04, 0.16, 'brass', kx, 1.0, 0);
        break;
      }
    }
    // Full-size invisible hit box so the whole door is easy to aim at.
    const hb = new THREE.Mesh(new THREE.BoxGeometry(1.06, Math.min(H, 2.2), 0.3), new THREE.MeshBasicMaterial({ visible: false }));
    hb.position.set(0, Math.min(H, 2.2) / 2, 0);
    leaf.add(hb);
    hitMesh = hb;
    hitMesh.userData.door = d;
    // Card reader light for powered doors
    let reader = null;
    if (d.powerLock) {
      reader = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.04), new THREE.MeshBasicMaterial({ color: 0xff2010 }));
      reader.position.set(0.62, 1.3, 0.52);
      root.add(reader);
      const r2 = reader.clone(); r2.position.z = -0.52; root.add(r2);
      reader.userData.twin = r2;
    }
    this.group.add(root);
    const door = {
      def: d, id: d.id, x: d.x, z: d.z, root, pivot, leaf, hitMesh, reader,
      angle: 0, target: 0, speed: 2.2,
      locked: !!d.locked, bolted: false, oneWayLocked: !!d.oneWay, secretOpen: false,
      style: d.style, slideOpen: 0,
      cx: d.x + 0.5, cz: d.z + 0.5, y: floor,
    };
    this.list.push(door);
    this.byId.set(d.id, door);
    return door;
  }

  get(id) { return this.byId.get(id); }

  isLocked(door) {
    if (door.locked || door.bolted) return true;
    if (door.def.powerLock && !door.powerReleased) return true;
    if (door.oneWayLocked) return true;
    if (door.style === 'shelf' && !door.secretOpen) return true;
    return false;
  }

  // Which side of the door is a point on? (+1 / -1 along passage axis)
  sideOf(door, x, z) {
    return door.def.passage === 'x' ? Math.sign(x - door.cx) || 1 : Math.sign(z - door.cz) || 1;
  }

  open(door, fromX, fromZ, opts = {}) {
    if (door.style === 'shelf') { door.secretOpen = true; door.target = 1; this.sound(door, 'shelf'); return; }
    // Swing away from the opener.
    const side = this.sideOf(door, fromX, fromZ);
    let dir = side;
    if (door.def.passage === 'x') dir = -dir;
    if (door.def.hinge === 'r') dir = -dir;
    door.target = OPEN_ANGLE * dir;
    door.speed = opts.slow ? 0.9 : opts.slam ? 6 : (door.style === 'vault' ? 0.35 : 2.4);
    if (door.def.pair && !opts.noPair) {
      const p = this.byId.get(door.def.pair);
      if (p && p.target === 0) this.open(p, fromX, fromZ, { ...opts, noPair: true, silent: true });
    }
    if (!opts.silent) this.sound(door, opts.slow ? 'creakSlow' : opts.slam ? 'slam' : 'open', opts);
  }

  close(door, opts = {}) {
    if (door.style === 'shelf' || door.style === 'vault') return;
    door.target = 0;
    door.speed = opts.slow ? 0.9 : opts.slam ? 7 : 2.6;
    door.pendingLatch = true;
    door.latchOpts = opts;
    if (!opts.silent) this.sound(door, opts.slow ? 'creakSlow' : 'close', opts);
  }

  isOpen(door) { return Math.abs(door.angle) > 0.5 || door.slideOpen > 0.6; }

  toggle(door, player) {
    if (this.isOpen(door) || Math.abs(door.target) > 0.01) {
      if (door.style === 'shelf' || door.style === 'vault') return;
      this.close(door, { slow: player.crouched, quiet: player.crouched });
    } else this.open(door, player.pos.x, player.pos.z, { slow: player.crouched, quiet: player.crouched });
  }

  sound(door, kind, opts = {}) {
    const g = this.game;
    const pos = { x: door.cx, y: door.y + 1.1, z: door.cz };
    const metal = ['metal', 'heavy', 'security', 'vault', 'gate', 'hatch'].includes(door.style);
    const map = { open: metal ? 'doorMetalOpen' : 'doorOpen', close: metal ? 'doorMetalClose' : 'doorClose', creakSlow: 'doorCreak', slam: 'doorSlam', shelf: 'shelfScrape', locked: 'doorLocked' };
    g.audio?.playAt(map[kind] || kind, pos, { gain: opts.quiet ? 0.35 : 1 });
    const loud = { open: 0.35, close: 0.4, creakSlow: 0.12, slam: 0.95, shelf: 0.55, locked: 0.25 }[kind] ?? 0.3;
    if (!opts.byEntity) g.noise?.(pos.x, pos.z, opts.quiet ? loud * 0.35 : loud, 'door', opts.byEntity ? null : 'door');
  }

  update(dt) {
    const grid = this.game.grid;
    for (const d of this.list) {
      // Power-locked doors release when their circuit is on (and stay released).
      if (d.def.powerLock) {
        const on = this.game.power?.isOn(d.def.powerLock);
        if (on && !d.powerReleased) {
          d.powerReleased = true;
          this.game.audio?.playAt('relayClunk', { x: d.cx, y: d.y + 1.3, z: d.cz });
        }
        if (d.reader) {
          const col = d.powerReleased ? (on ? 0x20ff50 : 0x105020) : 0xff2010;
          d.reader.material.color.setHex(col);
        }
      }
      if (d.style === 'shelf') {
        d.slideOpen += (d.target - d.slideOpen) * Math.min(1, dt * 0.8);
        const shelf = this.game.propsById?.get('secretShelf');
        if (shelf) { shelf.position.z = shelf.userData.baseZ + d.slideOpen * 1.25; }
      } else if (d.angle !== d.target) {
        const step = d.speed * dt;
        const diff = d.target - d.angle;
        d.angle += Math.abs(diff) < step ? diff : Math.sign(diff) * step;
        d.pivot.rotation.y = d.angle;
        if (d.pendingLatch && Math.abs(d.angle) < 0.02) {
          d.pendingLatch = false;
          d.angle = 0; d.pivot.rotation.y = 0;
          this.game.audio?.playAt(d.latchOpts?.slam ? 'doorSlam' : 'latch', { x: d.cx, y: d.y + 1, z: d.cz }, { gain: d.latchOpts?.quiet ? 0.3 : 1 });
        }
      }
      const open = this.isOpen(d);
      const state = open ? 0 : (this.isLocked(d) ? 2 : 1);
      grid.setDoorState(d.x, d.z, state);
    }
  }

  serialize() {
    return this.list.map((d) => ({ id: d.id, t: d.target, l: d.locked ? 1 : 0, b: d.bolted ? 1 : 0, o: d.oneWayLocked ? 1 : 0, s: d.secretOpen ? 1 : 0, p: d.powerReleased ? 1 : 0 }));
  }

  deserialize(data) {
    for (const d of this.list) {
      const s = data?.find((e) => e.id === d.id);
      d.locked = s ? !!s.l : !!d.def.locked;
      d.bolted = s ? !!s.b : false;
      d.oneWayLocked = s ? !!s.o : !!d.def.oneWay;
      d.secretOpen = s ? !!s.s : false;
      d.powerReleased = s ? !!s.p : false;
      d.target = s ? s.t : 0;
      d.angle = d.target;
      d.pivot.rotation.y = d.angle;
      d.slideOpen = d.style === 'shelf' && d.secretOpen ? 1 : 0;
      d.pendingLatch = false;
    }
  }
}
