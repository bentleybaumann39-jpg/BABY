// Procedural prop construction from primitives. Static props are merged per material for few draw calls;
// props with ids (interactables) stay as individual groups.
import * as THREE from 'three';
import { PROP_DEFS } from './PropDefs.js';
import { mergeGeos } from './LevelBuilder.js';

const geoCache = new Map();
function boxGeo(w, h, d) {
  const k = `b${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}
function cylGeo(rt, rb, h, seg = 12) {
  const k = `c${rt},${rb},${h},${seg}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.CylinderGeometry(rt, rb, h, seg));
  return geoCache.get(k);
}

// Builder context: collects parts as {geo, mat, matrix}
class B {
  constructor(mats) { this.mats = mats; this.parts = []; }
  box(mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
    this.parts.push({ geo: boxGeo(w, h, d), mat, m });
    return this;
  }
  cyl(mat, rt, rb, h, x, y, z, rx = 0, ry = 0, rz = 0, seg = 12) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
    this.parts.push({ geo: cylGeo(rt, rb, h, seg), mat, m });
    return this;
  }
  geo(mat, geo, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
    this.parts.push({ geo, mat, m });
    return this;
  }
  legs(mat, w, d, h, r = 0.025, inset = 0.04) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.cyl(mat, r, r, h, sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset), 0, 0, 0, 6);
    return this;
  }
}

const BUILDERS = {
  desk(b, p) {
    const w = p.w ?? 1.4, d = 0.75;
    b.box('wood', w, 0.04, d, 0, 0.74, 0);
    b.box('wood', 0.42, 0.68, d - 0.04, w / 2 - 0.23, 0.36, 0);
    b.box('metalGrey', 0.03, 0.7, d - 0.06, -w / 2 + 0.05, 0.36, 0);
    b.box('wood', w - 0.1, 0.4, 0.02, 0, 0.5, -d / 2 + 0.03);
    for (let k = 0; k < 3; k++) b.box('brass', 0.1, 0.012, 0.012, w / 2 - 0.23, 0.6 - k * 0.2, d / 2 - 0.005);
  },
  deskBig(b) {
    b.box('darkWood', 2.0, 0.06, 0.95, 0, 0.75, 0);
    b.box('darkWood', 0.5, 0.72, 0.9, 0.72, 0.36, 0);
    b.box('darkWood', 0.5, 0.72, 0.9, -0.72, 0.36, 0);
    b.box('darkWood', 1.0, 0.5, 0.03, 0, 0.45, -0.44);
    b.box('leather', 0.9, 0.005, 0.5, 0, 0.783, 0.1);
  },
  officeChair(b) {
    b.box('fabricGreen', 0.48, 0.08, 0.46, 0, 0.47, 0);
    b.box('fabricGreen', 0.46, 0.5, 0.06, 0, 0.78, -0.22, -0.1);
    b.cyl('steelDark', 0.03, 0.03, 0.4, 0, 0.24, 0);
    for (let k = 0; k < 5; k++) { const a = k * 1.2566; b.box('steelDark', 0.3, 0.03, 0.04, Math.cos(a) * 0.15, 0.05, Math.sin(a) * 0.15, 0, -a, 0); }
  },
  chair(b) {
    b.box('woodLight', 0.44, 0.04, 0.44, 0, 0.45, 0);
    b.box('woodLight', 0.44, 0.38, 0.03, 0, 0.7, -0.21);
    b.legs('steelDark', 0.42, 0.42, 0.45, 0.012);
    b.cyl('steelDark', 0.012, 0.012, 0.45, -0.2, 0.7, -0.21, 0, 0, 0, 6).cyl('steelDark', 0.012, 0.012, 0.45, 0.2, 0.7, -0.21, 0, 0, 0, 6);
  },
  armchair(b) {
    b.box('fabricRed', 0.8, 0.35, 0.8, 0, 0.25, 0);
    b.box('fabricRed', 0.8, 0.55, 0.18, 0, 0.65, -0.31);
    b.box('fabricRed', 0.14, 0.25, 0.75, -0.33, 0.52, 0).box('fabricRed', 0.14, 0.25, 0.75, 0.33, 0.52, 0);
  },
  sofa(b) {
    b.box('fabricGreen', 2.0, 0.38, 0.85, 0, 0.27, 0);
    b.box('fabricGreen', 2.0, 0.5, 0.2, 0, 0.66, -0.33);
    b.box('fabricGreen', 0.18, 0.28, 0.8, -0.91, 0.55, 0).box('fabricGreen', 0.18, 0.28, 0.8, 0.91, 0.55, 0);
    b.box('fabricBeige', 0.4, 0.3, 0.12, 0.5, 0.6, -0.2, -0.4, 0.3, 0.2);
  },
  coffeeTable(b) { b.box('wood', 1.1, 0.04, 0.6, 0, 0.4, 0); b.legs('wood', 1.05, 0.55, 0.38, 0.025); b.box('paper', 0.3, 0.01, 0.22, 0.2, 0.425, 0.05, 0, 0.3, 0); },
  table(b) { b.box('woodLight', 1.6, 0.04, 0.9, 0, 0.74, 0); b.legs('steelDark', 1.5, 0.8, 0.72, 0.02); },
  bed(b) {
    b.box('steelDark', 0.95, 0.04, 2.0, 0, 0.38, 0);
    b.legs('steelDark', 0.95, 2.0, 0.4, 0.018, 0.02);
    b.box('steelDark', 0.95, 0.05, 0.03, 0, 0.85, -0.99).box('steelDark', 0.03, 0.85, 0.03, -0.46, 0.43, -0.99).box('steelDark', 0.03, 0.85, 0.03, 0.46, 0.43, -0.99);
    b.box('fabricWhite', 0.9, 0.16, 1.95, 0, 0.48, 0);
    b.box('fabricWhite', 0.6, 0.1, 0.35, 0, 0.6, -0.75);
    b.box('fabricBeige', 0.92, 0.04, 1.2, 0, 0.58, 0.35, 0.03, 0, 0);
  },
  medBed(b) {
    b.box('metalCream', 0.95, 0.06, 2.05, 0, 0.55, 0); b.legs('chrome', 0.9, 2.0, 0.55, 0.02);
    b.box('fabricWhite', 0.88, 0.14, 1.95, 0, 0.65, 0);
    b.box('chrome', 0.9, 0.3, 0.03, 0, 0.85, -1.0).box('chrome', 0.03, 0.2, 1.0, 0.46, 0.8, 0.2);
  },
  cot(b) { b.box('steelDark', 0.8, 0.03, 1.9, 0, 0.4, 0); b.legs('steelDark', 0.78, 1.85, 0.4, 0.015); b.box('fabricGreen', 0.76, 0.06, 1.85, 0, 0.44, 0); },
  mattress(b) { b.box('fabricWhite', 0.9, 0.18, 1.9, 0, 0.09, 0); b.box('stainMat', 0.5, 0.005, 0.6, 0.1, 0.185, 0.2); },
  locker(b) {
    b.box('metalGreen', 0.6, 1.95, 0.55, 0, 0.975, 0);
    for (let k = 0; k < 5; k++) b.box('black', 0.3, 0.015, 0.01, 0, 1.6 - k * 0.04, 0.276);
    b.box('chrome', 0.02, 0.12, 0.03, 0.22, 1.05, 0.28);
  },
  wardrobe(b) {
    b.box('darkWood', 1.0, 2.0, 0.62, 0, 1.0, 0);
    b.box('wood', 0.47, 1.85, 0.02, -0.245, 1.0, 0.31).box('wood', 0.47, 1.85, 0.02, 0.245, 1.0, 0.31);
    b.box('brass', 0.02, 0.1, 0.02, -0.03, 1.05, 0.33).box('brass', 0.02, 0.1, 0.02, 0.03, 1.05, 0.33);
  },
  fileCabinet(b) {
    b.box('metalGrey', 0.5, 1.32, 0.65, 0, 0.66, 0);
    for (let k = 0; k < 4; k++) { b.box('metalGrey', 0.46, 0.29, 0.02, 0, 0.17 + k * 0.32, 0.33); b.box('chrome', 0.12, 0.02, 0.03, 0, 0.25 + k * 0.32, 0.345); }
  },
  bookshelf(b, p, rng) {
    b.box('darkWood', 1.2, 2.0, 0.04, 0, 1.0, -0.16);
    b.box('darkWood', 0.04, 2.0, 0.36, -0.58, 1.0, 0).box('darkWood', 0.04, 2.0, 0.36, 0.58, 1.0, 0);
    for (let s = 0; s < 5; s++) {
      const y = 0.05 + s * 0.42;
      b.box('darkWood', 1.12, 0.03, 0.34, 0, y, 0);
      let x = -0.54;
      while (x < 0.5) {
        const w = rng.range(0.03, 0.07), h = rng.range(0.22, 0.34);
        if (rng.chance(0.85)) b.box(rng.pick(['fabricRed', 'fabricGreen', 'fabricBeige', 'leather', 'paper']), w, h, 0.24, x + w / 2, y + h / 2 + 0.015, 0.01, 0, 0, rng.chance(0.1) ? 0.25 : 0);
        x += w + 0.004;
      }
    }
  },
  shelfUnit(b, p, rng) {
    for (const x of [-0.98, 0.98]) for (const z of [-0.25, 0.25]) b.box('metalGrey', 0.04, 2.3, 0.04, x, 1.15, z);
    for (let s = 0; s < 5; s++) {
      const y = 0.1 + s * 0.52;
      b.box('metalGrey', 2.0, 0.025, 0.55, 0, y, 0);
      let x = -0.95;
      while (x < 0.85) {
        const w = rng.range(0.28, 0.42);
        if (rng.chance(0.8)) b.box('cardboard', w, rng.range(0.22, 0.32), 0.42, x + w / 2, y + 0.15, 0, 0, rng.range(-0.05, 0.05), 0);
        x += w + 0.03;
      }
    }
  },
  secretShelf(b, p, rng) { BUILDERS.shelfUnit(b, { ...p }, rng); },
  counter(b, p) {
    const w = p.w ?? 2.0;
    b.box('wood', w, 0.88, 0.6, 0, 0.44, 0);
    b.box('greyPlastic', w, 0.04, 0.62, 0, 0.9, 0.0);
    if (p.sink) { b.box('chrome', 0.5, 0.02, 0.4, -w / 2 + 0.6, 0.925, 0); b.cyl('chrome', 0.015, 0.015, 0.25, -w / 2 + 0.6, 1.04, -0.22); }
    b.box('beigePlastic', 0.22, 0.32, 0.22, w / 2 - 0.4, 1.08, -0.08);
  },
  receptionDesk(b) {
    b.box('darkWood', 2.6, 1.05, 0.12, 0, 0.525, 0.36);
    b.box('darkWood', 2.6, 0.04, 0.85, 0, 1.06, 0.0);
    b.box('wood', 2.5, 0.04, 0.6, 0, 0.74, -0.1);
    b.box('darkWood', 0.1, 1.05, 0.8, -1.25, 0.525, 0).box('darkWood', 0.1, 1.05, 0.8, 1.25, 0.525, 0);
  },
  vending(b) {
    b.box('paintRed', 0.95, 1.85, 0.8, 0, 0.925, 0);
    b.box('glassDark', 0.6, 1.3, 0.02, -0.1, 1.05, 0.405);
    b.box('emissiveCold', 0.55, 0.06, 0.01, -0.1, 1.72, 0.41);
    b.box('steelDark', 0.18, 0.5, 0.02, 0.33, 1.2, 0.405);
  },
  fridge(b) { b.box('paintWhite', 0.7, 1.7, 0.7, 0, 0.85, 0); b.box('chrome', 0.03, 0.4, 0.04, 0.3, 1.2, 0.36); b.box('black', 0.68, 0.01, 0.01, 0, 1.1, 0.352); },
  piano(b) {
    b.box('pianoBlack', 1.5, 1.25, 0.35, 0, 0.625, -0.13);
    b.box('pianoBlack', 1.5, 0.08, 0.28, 0, 0.72, 0.17);
    b.box('ivory', 1.3, 0.02, 0.16, 0, 0.765, 0.2);
    for (let k = 0; k < 17; k++) if ([0, 1, 3, 4, 5].includes(k % 7)) b.box('pianoBlack', 0.022, 0.02, 0.09, -0.6 + k * 0.072 + 0.036, 0.785, 0.16);
    b.box('pianoBlack', 0.06, 0.7, 0.3, -0.72, 0.35, 0.17).box('pianoBlack', 0.06, 0.7, 0.3, 0.72, 0.35, 0.17);
    b.box('paper', 0.3, 0.2, 0.01, 0.15, 1.0, 0.06, -0.2, 0, 0);
  },
  pianoBench(b) { b.box('pianoBlack', 0.9, 0.06, 0.38, 0, 0.48, 0); b.box('pianoBlack', 0.86, 0.12, 0.34, 0, 0.4, 0); b.legs('pianoBlack', 0.86, 0.34, 0.34, 0.025); },
  console(b) {
    b.box('darkWood', 2.8, 0.8, 0.9, 0, 0.4, 0.05);
    b.box('steelDark', 2.7, 0.06, 0.95, 0, 0.88, 0, 0.18);
    for (let k = 0; k < 24; k++) { b.box('greyPlastic', 0.04, 0.02, 0.5, -1.27 + k * 0.11, 0.93, 0.02, 0.18); b.box(k % 5 === 0 ? 'paintRed' : 'beigePlastic', 0.035, 0.03, 0.03, -1.27 + k * 0.11, 0.95, 0.02 + (k * 37 % 10) / 25 - 0.15, 0.18); }
    b.box('steelDark', 2.7, 0.3, 0.12, 0, 1.0, -0.42);
    for (let k = 0; k < 8; k++) b.box('emissiveAmber', 0.12, 0.08, 0.01, -1.05 + k * 0.3, 1.05, -0.355);
  },
  reelDeck(b, p) {
    const s = p.small ? 0.6 : 1;
    b.box('metalGrey', 0.62 * s, 1.0 * s, 0.5 * s, 0, 0.5 * s, 0);
    b.box('steelDark', 0.6 * s, 0.6 * s, 0.05 * s, 0, 1.0 * s, 0.05 * s, -0.25);
    for (const x of [-0.15, 0.15]) b.cyl('chrome', 0.13 * s, 0.13 * s, 0.02, x * s, 1.12 * s, 0.13 * s, Math.PI / 2 - 0.25, 0, 0, 24);
  },
  rack(b, p, rng) {
    b.box('steelDark', 0.6, 1.9, 0.8, 0, 0.95, 0);
    for (let k = 0; k < 7; k++) {
      b.box('metalGrey', 0.54, 0.18, 0.02, 0, 0.3 + k * 0.22, 0.41);
      if (rng.chance(0.6)) b.box(rng.chance(0.5) ? 'emissiveGreen' : 'emissiveAmber', 0.02, 0.02, 0.01, -0.2 + rng.range(0, 0.4), 0.33 + k * 0.22, 0.42);
    }
  },
  bigSpeaker(b) { b.box('blackPlastic', 0.75, 1.0, 0.6, 0, 1.0, 0); b.cyl('black', 0.25, 0.25, 0.03, 0, 0.85, 0.31, Math.PI / 2); b.cyl('black', 0.1, 0.1, 0.03, 0, 1.3, 0.31, Math.PI / 2); b.legs('steelDark', 0.5, 0.4, 0.5); },
  speakerStand(b) { b.cyl('steelDark', 0.03, 0.03, 1.1, 0, 0.55, 0); b.box('blackPlastic', 0.3, 0.45, 0.3, 0, 1.32, 0); b.cyl('black', 0.09, 0.09, 0.02, 0, 1.28, 0.16, Math.PI / 2); },
  micStand(b) { b.cyl('steelDark', 0.012, 0.012, 1.5, 0, 0.75, 0, 0, 0, 0, 6); b.cyl('steelDark', 0.15, 0.15, 0.02, 0, 0.01, 0); b.cyl('chrome', 0.025, 0.02, 0.16, 0, 1.55, 0.05, 0.6); },
  boiler(b) {
    b.cyl('rust', 1.0, 1.0, 4.0, 0, 1.25, 0, 0, 0, Math.PI / 2, 20);
    b.cyl('rust', 1.0, 1.0, 0.06, -2.0, 1.25, 0, 0, 0, Math.PI / 2, 20).cyl('rust', 1.0, 1.0, 0.06, 2.0, 1.25, 0, 0, 0, Math.PI / 2, 20);
    for (const x of [-1.4, 1.4]) b.box('steelDark', 0.3, 0.5, 1.6, x, 0.2, 0);
    b.cyl('rust', 0.12, 0.12, 1.6, -1.3, 2.9, 0).cyl('rust', 0.12, 0.12, 1.6, 0.8, 2.9, 0);
    b.cyl('steelDark', 0.18, 0.18, 0.06, 1.6, 1.8, 1.0, Math.PI / 2, 0, 0, 16);
    b.cyl('paintWhite', 0.15, 0.15, 0.065, 1.6, 1.8, 1.0, Math.PI / 2, 0, 0, 16);
    b.box('steelDark', 0.5, 0.4, 0.2, -1.6, 1.0, 1.0);
  },
  breakerPanel(b) { b.box('metalGrey', 1.6, 1.3, 0.2, 0, 0, 0); b.box('steelDark', 1.5, 1.2, 0.02, 0, 0, 0.1); },
  workbench(b, p) { const w = p.w ?? 2.0; b.box('woodLight', w, 0.06, 0.8, 0, 0.9, 0); b.legs('steelDark', w - 0.1, 0.7, 0.88, 0.03); b.box('woodLight', w - 0.1, 0.03, 0.7, 0, 0.25, 0); b.box('metalGrey', 0.3, 0.12, 0.2, -0.4, 0.99, 0); },
  toolWall(b) { b.box('woodLight', 1.8, 1.2, 0.03, 0, 0, 0); for (let k = 0; k < 8; k++) b.box(k % 2 ? 'steelDark' : 'paintRed', 0.04, 0.3 - (k % 3) * 0.05, 0.03, -0.75 + k * 0.21, 0.1, 0.04, 0, 0, (k % 3 - 1) * 0.2); },
  barrel(b) { b.cyl('rust', 0.3, 0.3, 0.9, 0, 0.45, 0, 0, 0, 0, 14); b.cyl('steelDark', 0.31, 0.31, 0.04, 0, 0.3, 0, 0, 0, 0, 14); b.cyl('steelDark', 0.31, 0.31, 0.04, 0, 0.62, 0, 0, 0, 0, 14); },
  drum(b) { BUILDERS.barrel(b); },
  crate(b) { b.box('woodLight', 0.8, 0.8, 0.8, 0, 0.4, 0); b.box('wood', 0.82, 0.08, 0.82, 0, 0.4, 0); },
  boxStack(b) { b.box('cardboard', 0.9, 0.45, 0.7, 0, 0.225, 0); b.box('cardboard', 0.7, 0.4, 0.6, 0.05, 0.65, 0.02, 0, 0.15, 0); b.box('cardboard', 0.5, 0.3, 0.45, -0.05, 1.0, 0, 0, -0.2, 0); },
  sheetChair(b) { b.box('sheet', 0.7, 1.0, 0.7, 0, 0.5, 0); b.box('sheet', 0.68, 0.4, 0.2, 0, 1.0, -0.25, -0.15); b.box('sheet', 0.85, 0.03, 0.85, 0, 0.12, 0, 0.04, 0, 0.03); },
  sheetTable(b) { b.box('sheet', 1.5, 0.75, 0.9, 0, 0.38, 0); b.box('sheet', 0.5, 0.25, 0.4, 0.3, 0.88, 0, 0, 0.3, 0); },
  dummyHead(b) { BUILDERS.hatsDummy(b); },
  hatsDummy(b) {
    b.cyl('steelDark', 0.02, 0.02, 0.9, 0, 0.45, 0, 0, 0, 0, 6); b.cyl('steelDark', 0.2, 0.2, 0.02, 0, 0.01, 0);
    b.box('skinPale', 0.42, 0.45, 0.24, 0, 1.1, 0);
    b.cyl('skinPale', 0.06, 0.07, 0.12, 0, 1.38, 0);
    b.geo('skinPale', new THREE.SphereGeometry(0.11, 14, 10), 0, 1.52, 0, 0, 0, 0, 1);
    b.cyl('black', 0.035, 0.035, 0.02, -0.11, 1.52, 0, 0, 0, Math.PI / 2, 10).cyl('black', 0.035, 0.035, 0.02, 0.11, 1.52, 0, 0, 0, Math.PI / 2, 10);
  },
  car(b) {
    b.box('carPaint', 1.8, 0.6, 4.3, 0, 0.6, 0);
    b.box('carPaint', 1.6, 0.5, 2.1, 0, 1.15, 0.2);
    b.box('glassDark', 1.55, 0.42, 2.0, 0, 1.17, 0.2);
    for (const x of [-0.82, 0.82]) for (const z of [-1.35, 1.35]) b.cyl('tyre', 0.33, 0.33, 0.22, x, 0.33, z, 0, 0, Math.PI / 2, 14);
    b.box('emissiveRed', 0.3, 0.1, 0.02, -0.65, 0.75, 2.16).box('emissiveRed', 0.3, 0.1, 0.02, 0.65, 0.75, 2.16);
    b.box('chrome', 1.7, 0.1, 0.05, 0, 0.45, -2.16);
    b.box('bulbMat', 0.3, 0.12, 0.02, -0.6, 0.7, -2.16).box('bulbMat', 0.3, 0.12, 0.02, 0.6, 0.7, -2.16);
  },
  lampPost(b, p) { b.cyl('steelDark', 0.06, 0.09, 4.4, 0, 2.2, 0, 0, 0, 0, 8); b.box('steelDark', 0.5, 0.12, 0.3, 0.18, 4.4, 0); if (p.light !== false) b.box('emissiveAmber', 0.38, 0.02, 0.2, 0.18, 4.33, 0); },
  tree() { /* rendered by instanced forest */ },
  bench(b) { b.box('woodLight', 1.6, 0.05, 0.4, 0, 0.45, 0); b.box('woodLight', 1.6, 0.3, 0.04, 0, 0.75, -0.2, -0.15); b.legs('steelDark', 1.5, 0.38, 0.45, 0.02); },
  trashBin(b) { b.cyl('metalGrey', 0.22, 0.2, 0.8, 0, 0.4, 0, 0, 0, 0, 12); b.cyl('steelDark', 0.23, 0.23, 0.04, 0, 0.8, 0, 0, 0, 0, 12); },
  plant(b) { b.cyl('cardboard', 0.2, 0.15, 0.35, 0, 0.175, 0, 0, 0, 0, 10); for (let k = 0; k < 7; k++) b.box('bark', 0.02, 0.6, 0.02, Math.sin(k) * 0.08, 0.6, Math.cos(k) * 0.08, Math.sin(k * 2) * 0.4, 0, Math.cos(k * 3) * 0.4); },
  wheelchair(b) {
    for (const x of [-0.3, 0.3]) { b.cyl('chrome', 0.3, 0.3, 0.03, x, 0.3, 0.05, 0, 0, Math.PI / 2, 18); b.cyl('steelDark', 0.08, 0.08, 0.03, x * 0.8, 0.08, -0.35, 0, 0, Math.PI / 2, 8); }
    b.box('leather', 0.5, 0.04, 0.45, 0, 0.5, 0); b.box('leather', 0.5, 0.45, 0.03, 0, 0.75, 0.22);
    b.cyl('chrome', 0.015, 0.015, 0.5, -0.25, 0.8, 0.26).cyl('chrome', 0.015, 0.015, 0.5, 0.25, 0.8, 0.26);
  },
  ivStand(b) { b.cyl('chrome', 0.012, 0.012, 1.8, 0, 0.9, 0, 0, 0, 0, 6); b.box('chrome', 0.3, 0.012, 0.012, 0, 1.78, 0); b.box('glassFrost', 0.1, 0.18, 0.04, 0.12, 1.62, 0); },
  curtain(b, p) { b.box('chrome', p.w ?? 2, 0.02, 0.02, 0, 2.0, 0); b.box('fabricBeige', p.w ?? 2, 1.6, 0.02, 0, 1.15, 0); },
  medCabinet(b) { b.box('paintWhite', 0.9, 1.85, 0.42, 0, 0.925, 0); b.box('glassFrost', 0.4, 0.8, 0.01, -0.21, 1.35, 0.215).box('glassFrost', 0.4, 0.8, 0.01, 0.21, 1.35, 0.215); },
  stall(b) {
    b.box('metalCream', 0.04, 1.8, 1.5, -0.5, 1.0, 0); b.box('metalCream', 1.0, 1.8, 0.04, 0, 1.0, 0.73);
    b.box('porcelain', 0.4, 0.42, 0.55, 0, 0.21, -0.4); b.box('porcelain', 0.38, 0.35, 0.18, 0, 0.6, -0.65);
  },
  sink(b) { b.box('porcelain', 0.55, 0.18, 0.46, 0, 0.82, 0); b.cyl('porcelain', 0.06, 0.08, 0.72, 0, 0.36, -0.05); b.cyl('chrome', 0.012, 0.012, 0.18, 0, 0.98, -0.18); },
  showerHead(b) { b.cyl('chrome', 0.012, 0.012, 0.3, 0, 0, 0.12, Math.PI / 2); b.cyl('chrome', 0.06, 0.03, 0.05, 0, -0.03, 0.25); },
  chairRow(b) { for (let k = -1; k <= 1; k++) { b.box('fabricRed', 0.6, 0.08, 0.5, k * 0.65, 0.45, 0); b.box('fabricRed', 0.6, 0.45, 0.06, k * 0.65, 0.72, -0.24); } b.box('steelDark', 2.0, 0.05, 0.08, 0, 0.3, 0); b.legs('steelDark', 1.9, 0.4, 0.3, 0.02); },
  tvStand(b) { b.box('wood', 0.7, 0.6, 0.5, 0, 0.3, 0); b.box('woodLight', 0.62, 0.5, 0.48, 0, 0.85, -0.02); b.box('screenOff', 0.48, 0.38, 0.01, -0.03, 0.86, 0.225); },
  waterCooler(b) { b.box('paintWhite', 0.36, 1.0, 0.36, 0, 0.5, 0); b.cyl('glassFrost', 0.15, 0.15, 0.35, 0, 1.18, 0); },
  noticeBoard(b, p, rng) { b.box('cardboard', 1.2, 0.85, 0.03, 0, 0, 0); for (let k = 0; k < 6; k++) b.box('paper', rng.range(0.15, 0.25), rng.range(0.18, 0.28), 0.005, rng.range(-0.45, 0.45), rng.range(-0.25, 0.25), 0.02, 0, 0, rng.range(-0.15, 0.15)); },
  cart(b) { b.box('metalGrey', 1.0, 0.04, 0.6, 0, 0.85, 0); b.box('metalGrey', 1.0, 0.04, 0.6, 0, 0.3, 0); b.legs('chrome', 0.95, 0.55, 0.85, 0.015); b.box('fabricWhite', 0.8, 0.3, 0.5, 0, 0.47, 0); },
  voicePanel(b) { b.box('steelDark', 1.3, 1.1, 0.65, 0, 0.55, 0); b.box('metalGrey', 1.2, 0.05, 0.5, 0, 1.1, 0, -0.3); b.cyl('chrome', 0.008, 0.008, 0.35, 0.3, 1.3, 0.1, 0.4); b.geo('blackPlastic', new THREE.SphereGeometry(0.035, 10, 8), 0.3, 1.46, 0.17); b.box('black', 0.3, 0.2, 0.02, -0.25, 1.15, 0.0, -0.3); },
  chamberChair(b) { b.box('steelDark', 0.5, 0.04, 0.5, 0, 0.46, 0); b.box('steelDark', 0.5, 0.5, 0.04, 0, 0.72, -0.23); b.legs('steelDark', 0.45, 0.45, 0.46, 0.015); b.box('rubber', 0.04, 0.02, 0.3, -0.22, 0.6, 0).box('rubber', 0.04, 0.02, 0.3, 0.22, 0.6, 0); },
  ampRack(b, p, rng) { b.box('steelDark', 1.7, 1.95, 0.65, 0, 0.975, 0); for (let k = 0; k < 6; k++) { b.box('metalGrey', 1.6, 0.26, 0.02, 0, 0.3 + k * 0.28, 0.33); b.box('screenOff', 0.18, 0.1, 0.01, -0.5, 0.32 + k * 0.28, 0.345); b.box('screenOff', 0.18, 0.1, 0.01, 0.5, 0.32 + k * 0.28, 0.345); } },
  pump(b) { b.cyl('rust', 0.35, 0.35, 0.7, -0.2, 0.45, 0, 0, 0, Math.PI / 2, 14); b.box('steelDark', 1.1, 0.12, 0.8, 0, 0.06, 0); b.cyl('rust', 0.1, 0.1, 1.2, 0.35, 0.7, 0); },
  pipeRun(b, p) { const r = p.r2 ?? 0.08; b.cyl('rust', r, r, p.w ?? 4, 0, 0, 0, 0, 0, Math.PI / 2, 10); },
  fireExt(b) { b.cyl('paintRed', 0.08, 0.08, 0.5, 0, 0, 0.08); b.cyl('black', 0.02, 0.02, 0.1, 0, 0.3, 0.08); },
  clock(b) { b.cyl('paintWhite', 0.17, 0.17, 0.04, 0, 0, 0, Math.PI / 2, 0, 0, 24); b.cyl('steelDark', 0.18, 0.18, 0.03, 0, 0, -0.01, Math.PI / 2, 0, 0, 24); b.box('black', 0.01, 0.12, 0.005, 0, 0.04, 0.025, 0, 0, 0.4); b.box('black', 0.01, 0.08, 0.005, 0.02, 0, 0.025, 0, 0, -1.2); },
  ladder(b) { for (const x of [-0.25, 0.25]) b.box('steelDark', 0.04, 3.0, 0.04, x, 1.5, 0); for (let k = 0; k < 10; k++) b.box('steelDark', 0.5, 0.025, 0.025, 0, 0.25 + k * 0.28, 0); },
  junctionBox(b) { b.box('metalGrey', 0.5, 0.6, 0.2, 0, 0, 0); },
  relayBox(b) { b.box('metalGrey', 0.6, 0.7, 0.25, 0, 0, 0); },
  transformer(b) { b.box('metalGreen', 1.2, 1.6, 1.0, 0, 0.8, 0); for (let k = 0; k < 6; k++) b.box('steelDark', 1.24, 0.04, 1.04, 0, 0.3 + k * 0.22, 0); },
  tallySpeaker(b) { b.cyl('steelDark', 0.05, 0.05, 1.6, 0, 0.8, 0); b.box('blackPlastic', 1.0, 0.9, 0.7, 0, 1.95, 0); b.cyl('black', 0.32, 0.32, 0.02, 0, 1.95, 0.36, Math.PI / 2); },
  boomStand(b) { b.cyl('steelDark', 0.04, 0.05, 2.0, 0, 1.0, 0); b.cyl('steelDark', 0.3, 0.3, 0.04, 0, 0.02, 0); b.cyl('chrome', 0.015, 0.015, 2.4, 0.6, 2.1, 0, 0, 0, 1.2); },
  tableLamp(b) { b.cyl('brass', 0.07, 0.09, 0.03, 0, 0.015, 0); b.cyl('brass', 0.01, 0.01, 0.35, 0, 0.2, 0); b.cyl('emissiveWarm', 0.1, 0.15, 0.16, 0, 0.42, 0, 0, 0, 0, 16); },
  lantern(b) { b.cyl('steelDark', 0.07, 0.07, 0.04, 0, 0.02, 0); b.cyl('glassFrost', 0.06, 0.06, 0.16, 0, 0.12, 0); b.cyl('steelDark', 0.04, 0.07, 0.05, 0, 0.22, 0); },
  crateSmall(b) { b.box('woodLight', 0.5, 0.4, 0.4, 0, 0.2, 0); },
  globe(b) { b.cyl('darkWood', 0.15, 0.2, 0.6, 0, 0.3, 0); b.geo('fabricBeige', new THREE.SphereGeometry(0.22, 16, 12), 0, 0.82, 0); },
  coatRack(b) { b.cyl('darkWood', 0.025, 0.025, 1.8, 0, 0.9, 0); b.cyl('darkWood', 0.2, 0.2, 0.03, 0, 0.02, 0); b.box('fabricBeige', 0.4, 0.8, 0.15, 0.1, 1.3, 0.05, 0, 0, 0.1); },
  scale(b) { b.box('paintWhite', 0.4, 0.06, 0.4, 0, 0.03, 0); b.cyl('paintWhite', 0.02, 0.02, 1.4, 0, 0.7, -0.15); b.box('paintWhite', 0.3, 0.06, 0.08, 0, 1.4, -0.15); },
  cableSpool(b) { b.cyl('woodLight', 0.4, 0.4, 0.06, 0, 0.4, -0.2, Math.PI / 2); b.cyl('woodLight', 0.4, 0.4, 0.06, 0, 0.4, 0.2, Math.PI / 2); b.cyl('black', 0.25, 0.25, 0.36, 0, 0.4, 0, Math.PI / 2); },
  canopy(b) { b.box('concrete', 4.0, 0.3, 2.4, 0, 0, 0); },
  doormat(b) { b.box('rubber', 1.1, 0.02, 0.6, 0, 0.01, 0); },
  gateSign(b) { b.box('steelDark', 0.08, 2.2, 0.08, -1.2, 1.1, 0).box('steelDark', 0.08, 2.2, 0.08, 1.2, 1.1, 0); },
  railing() {},
  wedgeWall() {},
};

// Props that are flat decals/canvas signs are handled by the Decor module (text textures).
export const DECOR_TYPES = new Set(['portrait', 'photoFrame', 'directory', 'pictoPlate', 'signPlate', 'keyCabinet', 'chalkMarks', 'chalkboard', 'vent', 'mirror', 'wallPhone', 'rug', 'paperPile', 'stain', 'puddle', 'sweepPanel', 'boothPanel', 'alarmBell', 'speakerHorn', 'gateSign']);

export class PropBuilder {
  constructor(map, mats, rng) {
    this.map = map; this.mats = mats; this.rng = rng;
    this.extraMats = {
      stainMat: mats.prop('stain'),
      skinPale: mats.custom('skinPale', () => { const m = mats.prop('porcelain').clone(); m.color.set(0xb8aa98); m.roughness = 0.6; m.onBeforeCompile = mats.prop('porcelain').onBeforeCompile; m.customProgramCacheKey = mats.prop('porcelain').customProgramCacheKey; return m; }),
      bulbMat: mats.prop('emissiveWarm'),
    };
  }

  mat(name) { return this.extraMats[name] || this.mats.prop(name); }

  // Build a single prop into a Group (local origin at floor, facing +z).
  buildOne(p) {
    const fn = BUILDERS[p.t];
    const b = new B(this.mats);
    if (fn) fn(b, p, this.rng);
    const g = new THREE.Group();
    for (const part of b.parts) {
      const mesh = new THREE.Mesh(part.geo, this.mat(part.mat));
      mesh.applyMatrix4(part.m);
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);
    }
    return g;
  }

  placement(p) {
    const def = PROP_DEFS[p.t] || {};
    const floor = this.map.floorAt(p.x, p.z);
    const y = floor + (p.y ?? 0);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(p.x, y, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((p.r || 0) * Math.PI) / 180), new THREE.Vector3(1, 1, 1));
    return { m, def, floor };
  }

  // Build all props. Returns { staticGroup, dynamic: Map(id -> group) }
  buildAll(skipIds = new Set()) {
    const byMat = new Map();
    const dynamic = new Map();
    const root = new THREE.Group();
    for (const p of this.map.props) {
      if (DECOR_TYPES.has(p.t) || p.t === 'tree') continue;
      const { m } = this.placement(p);
      if (p.id || p.hideId || skipIds.has(p.t)) {
        const g = this.buildOne(p);
        g.applyMatrix4(m);
        g.userData.prop = p;
        dynamic.set(p.id || p.hideId, g);
        root.add(g);
        continue;
      }
      const fn = BUILDERS[p.t];
      if (!fn) continue;
      const b = new B(this.mats);
      fn(b, p, this.rng);
      for (const part of b.parts) {
        const geo = part.geo.clone();
        geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(m, part.m));
        if (!byMat.has(part.mat)) byMat.set(part.mat, []);
        byMat.get(part.mat).push(geo);
      }
    }
    for (const [mat, geos] of byMat) {
      // Chunk merges to keep culling effective.
      const chunks = new Map();
      for (const g of geos) {
        g.computeBoundingSphere();
        const c = g.boundingSphere.center;
        const k = `${Math.floor(c.x / 22)},${Math.floor(c.z / 22)}`;
        if (!chunks.has(k)) chunks.set(k, []);
        chunks.get(k).push(g);
      }
      for (const list of chunks.values()) {
        const mesh = new THREE.Mesh(mergeGeos(list), this.mat(mat));
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        root.add(mesh);
      }
    }
    return { root, dynamic };
  }
}
