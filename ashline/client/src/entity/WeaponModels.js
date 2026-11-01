// Procedural weapon models (barrel along -Z, origin at the grip). Shared by the viewmodel, characters
// and ground items. Each model exposes `muzzle` and `sight` anchor objects and a `mag` mesh.
import * as THREE from 'three';
import { FINISHES } from '../../../shared/progression.js';

let MATS = null;
export function weaponMats(tex) {
  if (MATS) return MATS;
  MATS = {
    polymer: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.035, 0.036, 0.038), roughness: 0.62, metalness: 0.05 }),
    steel: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.09, 0.095, 0.1), roughness: 0.38, metalness: 0.9 }),
    wood: new THREE.MeshStandardMaterial({ map: tex ? tex.wood.map : null, color: new THREE.Color(0.75, 0.52, 0.36), roughness: 0.55, metalness: 0 }),
    lens: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.08, 0.12, 0.16), roughness: 0.05, metalness: 0.6, envMapIntensity: 2 }),
    dot: new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 0.4, 0.3) }),
    finishes: new Map(),
  };
  return MATS;
}
function finishMat(id) {
  const M = MATS;
  if (M.finishes.has(id)) return M.finishes.get(id);
  const f = FINISHES.find(x => x.id === id) || FINISHES[0];
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(f.c), roughness: f.r, metalness: f.m });
  M.finishes.set(id, m);
  return m;
}

const geoCache = new Map();
function G(key, make) { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); }
const box = (w, h, d) => G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (r1, r2, l, s = 10) => G(`c${r1},${r2},${l},${s}`, () => { const g = new THREE.CylinderGeometry(r1, r2, l, s); g.rotateX(Math.PI / 2); return g; });

function part(group, geo, mat, x, y, z, rx = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; group.add(m); return m; }

// Build a weapon. att: { optic, mag, muzzle, grip } (attachment ids or null)
export function buildWeapon(id, finish = 'parkerized', att = null) {
  const M = MATS;
  const F = finishMat(finish);
  const g = new THREE.Group();
  g.name = id;
  const muzzle = new THREE.Object3D(); muzzle.name = 'muzzle';
  const sight = new THREE.Object3D(); sight.name = 'sight';
  let mag;
  let railY = 0.07, railZ0 = 0.05, barrelEnd = -0.5, handZ = -0.25, handY = -0.01;
  switch (id) {
    case 'p9': {
      part(g, box(0.03, 0.034, 0.19), F, 0, 0.06, -0.05);
      part(g, box(0.028, 0.03, 0.15), M.polymer, 0, 0.032, -0.035);
      part(g, box(0.028, 0.11, 0.045), M.polymer, 0, -0.02, 0.02, -0.25);
      part(g, cyl(0.007, 0.007, 0.02), M.steel, 0, 0.065, -0.15);
      mag = part(g, box(0.022, 0.03, 0.035), M.steel, 0, -0.08, 0.03, -0.25);
      railY = 0.083; railZ0 = 0.02; barrelEnd = -0.16; handZ = 0.0; handY = -0.03;
      break;
    }
    case 'vespa': {
      part(g, box(0.045, 0.06, 0.3), F, 0, 0.03, -0.06);
      part(g, cyl(0.013, 0.013, 0.12), M.steel, 0, 0.035, -0.27);
      part(g, box(0.03, 0.09, 0.04), M.polymer, 0, -0.03, 0.04, -0.2);
      mag = part(g, box(0.026, (att && att.mag ? 0.21 : 0.16), 0.035), M.steel, 0, -0.07 - (att && att.mag ? 0.025 : 0), -0.09);
      part(g, box(0.012, 0.012, 0.24), M.steel, 0.012, 0.03, 0.2);
      part(g, box(0.012, 0.012, 0.24), M.steel, -0.012, 0.03, 0.2);
      part(g, box(0.03, 0.06, 0.02), M.polymer, 0, 0.02, 0.32);
      railY = 0.067; railZ0 = 0.0; barrelEnd = -0.34; handZ = -0.16;
      break;
    }
    case 'kr5': case 'halberd': {
      const wood = id === 'halberd';
      part(g, box(0.05, 0.07, 0.36), F, 0, 0.03, -0.04);
      part(g, box(0.056, 0.058, 0.28), wood ? M.wood : M.polymer, 0, 0.035, -0.36);
      part(g, cyl(0.011, 0.011, 0.2), M.steel, 0, 0.04, -0.58);
      part(g, cyl(0.016, 0.014, 0.05), M.steel, 0, 0.04, -0.69);
      part(g, box(0.032, 0.1, 0.04), M.polymer, 0, -0.035, 0.08, -0.25);
      part(g, box(0.04, 0.075, 0.26), wood ? M.wood : M.polymer, 0, 0.0, 0.28, 0.1);
      mag = part(g, box(0.028, att && att.mag ? 0.22 : 0.17, 0.05), wood ? F : M.steel, 0, -0.08, -0.08, wood ? 0.35 : 0.18);
      if (!att || !att.optic) { part(g, box(0.01, 0.03, 0.01), M.steel, 0, 0.08, -0.45); part(g, box(0.02, 0.025, 0.02), M.steel, 0, 0.078, 0.08); }
      railY = 0.075; railZ0 = 0.0; barrelEnd = -0.72; handZ = -0.34;
      break;
    }
    case 'sable': {
      part(g, box(0.05, 0.07, 0.4), F, 0, 0.03, -0.04);
      part(g, box(0.05, 0.055, 0.32), M.polymer, 0, 0.035, -0.4);
      part(g, cyl(0.012, 0.012, 0.32), M.steel, 0, 0.04, -0.72);
      part(g, cyl(0.017, 0.015, 0.06), M.steel, 0, 0.04, -0.9);
      part(g, box(0.032, 0.1, 0.04), M.polymer, 0, -0.035, 0.09, -0.25);
      part(g, box(0.045, 0.09, 0.3), M.polymer, 0, -0.005, 0.32, 0.08);
      mag = part(g, box(0.026, att && att.mag ? 0.13 : 0.09, 0.07), M.steel, 0, -0.05, -0.06);
      railY = 0.075; railZ0 = 0.0; barrelEnd = -0.93; handZ = -0.38;
      break;
    }
    case 'longreach': {
      part(g, box(0.05, 0.065, 0.3), F, 0, 0.035, -0.04);
      part(g, cyl(0.017, 0.014, 0.7), M.steel, 0, 0.045, -0.5);
      part(g, cyl(0.022, 0.022, 0.08), M.steel, 0, 0.045, -0.88);
      part(g, box(0.06, 0.08, 0.5), M.wood, 0, 0.0, -0.18);
      part(g, box(0.05, 0.12, 0.32), M.wood, 0, -0.03, 0.3, 0.12);
      part(g, cyl(0.007, 0.007, 0.06), M.steel, 0.045, 0.05, 0.05);
      part(g, box(0.012, 0.012, 0.012), M.steel, 0.075, 0.05, 0.05);
      mag = part(g, box(0.03, 0.04, 0.06), M.steel, 0, -0.045, -0.05);
      railY = 0.08; railZ0 = -0.02; barrelEnd = -0.92; handZ = -0.36;
      break;
    }
    case 'breacher': {
      part(g, box(0.05, 0.07, 0.3), F, 0, 0.03, -0.02);
      part(g, cyl(0.016, 0.016, 0.55), M.steel, 0, 0.05, -0.45);
      part(g, cyl(0.014, 0.014, 0.42), M.steel, 0, 0.015, -0.38);
      part(g, box(0.05, 0.05, 0.16), M.wood, 0, 0.015, -0.38).name = 'pump';
      part(g, box(0.045, 0.1, 0.32), M.wood, 0, -0.01, 0.3, 0.14);
      part(g, box(0.03, 0.09, 0.04), M.wood, 0, -0.035, 0.1, -0.3);
      mag = part(g, box(0.02, 0.02, 0.05), M.steel, 0, 0.0, 0.05);
      railY = 0.075; railZ0 = 0.0; barrelEnd = -0.73; handZ = -0.38;
      break;
    }
    case 'mattock': {
      part(g, box(0.07, 0.09, 0.42), F, 0, 0.03, -0.04);
      part(g, box(0.06, 0.06, 0.3), M.steel, 0, 0.045, -0.38);
      part(g, cyl(0.014, 0.014, 0.28), M.steel, 0, 0.045, -0.66);
      part(g, cyl(0.02, 0.016, 0.06), M.steel, 0, 0.045, -0.82);
      part(g, box(0.035, 0.11, 0.045), M.polymer, 0, -0.04, 0.09, -0.25);
      part(g, box(0.05, 0.09, 0.28), M.polymer, 0, -0.005, 0.32, 0.06);
      mag = part(g, box(0.1, 0.1, 0.13), M.polymer, 0.0, -0.06, -0.08);
      part(g, cyl(0.005, 0.005, 0.25), M.steel, 0.02, 0.0, -0.62, 0.2);
      part(g, cyl(0.005, 0.005, 0.25), M.steel, -0.02, 0.0, -0.62, 0.2);
      railY = 0.085; railZ0 = 0.02; barrelEnd = -0.85; handZ = -0.36;
      break;
    }
    case 'tern': { // bullpup burst rifle: magazine behind the grip
      part(g, box(0.055, 0.085, 0.5), F, 0, 0.03, 0.05);
      part(g, box(0.05, 0.05, 0.22), M.polymer, 0, 0.04, -0.3);
      part(g, cyl(0.011, 0.011, 0.18), M.steel, 0, 0.045, -0.5);
      part(g, cyl(0.016, 0.014, 0.05), M.steel, 0, 0.045, -0.6);
      part(g, box(0.03, 0.1, 0.04), M.polymer, 0, -0.04, -0.12, -0.2);
      part(g, box(0.06, 0.03, 0.12), M.polymer, 0, 0.08, -0.1);
      mag = part(g, box(0.028, att && att.mag ? 0.21 : 0.16, 0.05), M.steel, 0, -0.07, 0.12, 0.15);
      part(g, box(0.05, 0.09, 0.08), M.polymer, 0, 0.0, 0.33);
      railY = 0.095; railZ0 = -0.05; barrelEnd = -0.63; handZ = -0.3;
      break;
    }
    case 'wasp': { // machine pistol
      part(g, box(0.032, 0.036, 0.2), F, 0, 0.06, -0.05);
      part(g, box(0.03, 0.03, 0.16), M.polymer, 0, 0.032, -0.04);
      part(g, box(0.03, 0.11, 0.045), M.polymer, 0, -0.02, 0.02, -0.2);
      part(g, box(0.022, 0.06, 0.025), M.polymer, 0, -0.005, -0.12);
      part(g, cyl(0.008, 0.008, 0.03), M.steel, 0, 0.065, -0.16);
      mag = part(g, box(0.022, att && att.mag ? 0.16 : 0.1, 0.035), M.steel, 0, -0.1, 0.035, -0.2);
      railY = 0.085; railZ0 = 0.02; barrelEnd = -0.17; handZ = -0.12; handY = -0.02;
      break;
    }
    case 'magistrate': { // heavy revolver
      part(g, cyl(0.012, 0.012, 0.2), M.steel, 0, 0.055, -0.12);
      part(g, box(0.026, 0.02, 0.2), M.steel, 0, 0.072, -0.12);
      const drum = part(g, G('rdrum', () => { const c = new THREE.CylinderGeometry(0.024, 0.024, 0.045, 12); c.rotateX(Math.PI / 2); return c; }), M.steel, 0, 0.048, 0.0);
      drum.name = 'drum';
      part(g, box(0.026, 0.04, 0.07), F, 0, 0.045, 0.04);
      part(g, box(0.03, 0.1, 0.04), M.wood, 0, -0.02, 0.07, -0.35);
      mag = part(g, box(0.01, 0.01, 0.01), M.steel, 0, 0.048, 0.02);
      railY = 0.085; railZ0 = -0.02; barrelEnd = -0.23; handZ = 0.0; handY = -0.03;
      break;
    }
    default: {
      part(g, box(0.05, 0.06, 0.4), F, 0, 0.03, -0.1);
      mag = part(g, box(0.02, 0.1, 0.04), M.steel, 0, -0.04, -0.08);
    }
  }
  if (mag) mag.name = 'mag';
  // attachments
  let sightY = railY + 0.012, sightZ = railZ0;
  if (att && att.optic) {
    const o = att.optic;
    if (o === 'reddot') {
      part(g, box(0.032, 0.035, 0.05), M.polymer, 0, railY + 0.02, railZ0 - 0.06);
      part(g, box(0.024, 0.022, 0.004), M.lens, 0, railY + 0.026, railZ0 - 0.085);
      sightY = railY + 0.026; sightZ = railZ0 - 0.06;
    } else {
      const len = o === 'x2' ? 0.12 : o === 'x4' ? 0.2 : 0.28, r = o === 'x8' ? 0.022 : 0.018;
      part(g, cyl(r, r, len, 14), M.polymer, 0, railY + 0.035, railZ0 - 0.08);
      part(g, cyl(r * 1.35, r, 0.05, 14), M.polymer, 0, railY + 0.035, railZ0 - 0.08 - len / 2);
      part(g, cyl(r * 1.15, r, 0.04, 14), M.polymer, 0, railY + 0.035, railZ0 - 0.08 + len / 2);
      part(g, box(0.018, 0.028, 0.03), M.polymer, 0, railY + 0.012, railZ0 - 0.08);
      part(g, cyl(r * 1.1, r * 1.1, 0.002, 14), M.lens, 0, railY + 0.035, railZ0 - 0.08 + len / 2 + 0.021);
      sightY = railY + 0.035; sightZ = railZ0 - 0.08 + len / 2;
    }
  }
  if (att && att.muzzle === 'suppressor') { part(g, cyl(0.02, 0.02, 0.17, 12), M.polymer, 0, ['p9', 'wasp'].includes(id) ? 0.06 : 0.04, barrelEnd - 0.085); barrelEnd -= 0.17; }
  if (att && att.grip) part(g, box(0.025, 0.07, 0.03), M.polymer, 0, -0.03, handZ, 0.1);
  muzzle.position.set(0, ['p9', 'wasp', 'magistrate'].includes(id) ? 0.06 : 0.042, barrelEnd);
  sight.position.set(0, sightY, sightZ);
  g.add(muzzle, sight);
  g.userData = { muzzle, sight, mag, handZ, handY, id };
  return g;
}

export function buildGrenade(kind) {
  const M = MATS;
  const g = new THREE.Group();
  if (kind === 'smoke') {
    part(g, G('smk', () => new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10)), new THREE.MeshStandardMaterial({ color: 0x5b6150, roughness: 0.7 }), 0, 0, 0);
  } else {
    part(g, G('frg', () => new THREE.SphereGeometry(0.035, 10, 8)), new THREE.MeshStandardMaterial({ color: 0x3c4430, roughness: 0.6, metalness: 0.2 }), 0, 0, 0);
  }
  part(g, box(0.012, 0.03, 0.012), M.steel, 0, 0.05, 0);
  return g;
}
