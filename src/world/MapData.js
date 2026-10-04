// Larkhollow layout: a 2.5D sector grid painted from rectangles (1 cell = 1 m).
// Pure data + logic (no three.js) so it can be validated in Node.
//
// World coords: cell (x, z) spans [x, x+1] x [z, z+1]. +x = east, +z = south.
// Yaw 0 looks north (-z).

export const CELL = { SOLID: 0, FLOOR: 1, DOOR: 2, WINDOW: 3, FENCE: 4, FOREST: 5 };

export const FACADE_TOP = 6.4;

// Zone types. floor/ceil are heights; wall styles are material keys (see Materials.js).
export const ZONES = {
  o: { name: 'Grounds', ext: true, floorMat: 'grass', surface: 'gravel', reverb: 'outdoor', amb: 'outdoor', level: 0 },
  p: { name: 'Car Park', ext: true, floorMat: 'asphalt', surface: 'gravel', reverb: 'outdoor', amb: 'outdoor', level: 0 },
  a: { name: 'Lobby', ceil: 5.0, floorMat: 'terrazzo', wall: ['woodPanel', 'plaster', 'darkWood'], ceilMat: 'plasterCeil', surface: 'tile', reverb: 'lobby', amb: 'lobby', light: { type: 'pendant', spacing: 5, circuit: 'cup' } },
  r: { name: 'Reception', floorMat: 'carpet', wall: ['woodPanel', 'wallpaper', 'darkWood'], ceilMat: 'ceilTile', surface: 'carpet', reverb: 'room', amb: 'room', light: { type: 'fluoro', spacing: 5, circuit: 'cup' } },
  c: { name: 'Main Corridor', ceil: 3.0, floorMat: 'lino', wall: ['greenTile', 'paint', 'darkTile'], ceilMat: 'ceilTile', surface: 'tile', reverb: 'corridor', amb: 'corridor', light: { type: 'fluoro', spacing: 5, circuit: 'cup' } },
  w: { name: 'West Corridor', ceil: 3.0, floorMat: 'lino', wall: ['greenTile', 'paint', 'darkTile'], ceilMat: 'ceilTile', surface: 'tile', reverb: 'corridor', amb: 'corridor', light: { type: 'fluoro', spacing: 5, circuit: 'cup' } },
  m: { name: "Director's Office", floorMat: 'woodFloor', wall: ['darkWood', 'wallpaper2', 'darkWood'], ceilMat: 'plasterCeil', surface: 'wood', reverb: 'room', amb: 'room', light: { type: 'pendant', spacing: 6, circuit: 'cup' } },
  s: { name: "Secretary's Office", floorMat: 'carpet', wall: ['woodPanel', 'wallpaper', 'darkWood'], ceilMat: 'ceilTile', surface: 'carpet', reverb: 'room', amb: 'room', light: { type: 'fluoro', spacing: 6, circuit: 'cup' } },
  t: { name: 'Restrooms', floorMat: 'whiteTileFloor', wall: ['whiteTile', 'paint', 'darkTile'], ceilMat: 'ceilTile', surface: 'tile', reverb: 'bathroom', amb: 'room', light: { type: 'fluoro', spacing: 5, circuit: 'cup' } },
  l: { name: 'Staff Lounge', floorMat: 'carpet2', wall: ['woodPanel', 'wallpaper', 'darkWood'], ceilMat: 'ceilTile', surface: 'carpet', reverb: 'room', amb: 'room', light: { type: 'fluoro', spacing: 5, circuit: 'cup' } },
  n: { name: 'Residential Corridor', ceil: 3.0, floorMat: 'lino2', wall: ['blueTile', 'paint', 'darkTile'], ceilMat: 'ceilTile', surface: 'tile', reverb: 'corridor', amb: 'corridor', light: { type: 'fluoro', spacing: 5, circuit: 'bed' } },
  d: { name: 'Dormitory', ceil: 2.8, floorMat: 'lino2', wall: ['paint', 'paint', 'paint'], ceilMat: 'plasterCeil', surface: 'tile', reverb: 'small', amb: 'room', light: { type: 'fluoro', spacing: 6, circuit: 'bed' } },
  i: { name: 'Infirmary', floorMat: 'lino2', wall: ['whiteTile', 'paint', 'darkTile'], ceilMat: 'ceilTile', surface: 'tile', reverb: 'room', amb: 'room', light: { type: 'fluoro', spacing: 5, circuit: 'bed' } },
  4: { name: 'Showers', floorMat: 'whiteTileFloor', wall: ['whiteTile', 'whiteTile', 'darkTile'], ceilMat: 'plasterCeil', surface: 'tile', reverb: 'bathroom', amb: 'room', light: { type: 'fluoro', spacing: 6, circuit: 'bed' } },
  e: { name: 'Research Ring', ceil: 3.0, floorMat: 'linoDark', wall: ['greyPaint', 'acoustic', 'darkTile'], ceilMat: 'ceilTile', surface: 'tile', reverb: 'corridor', amb: 'corridor', light: { type: 'fluoro', spacing: 5, circuit: 'bird' } },
  k: { name: 'Control Room', floorMat: 'carpet', wall: ['acoustic', 'acoustic', 'darkWood'], ceilMat: 'acousticCeil', surface: 'carpet', reverb: 'dead', amb: 'room', light: { type: 'studio', spacing: 5, circuit: 'bird' } },
  v: { name: 'Live Room', ceil: 4.0, floorMat: 'woodFloor', wall: ['woodPanel', 'acoustic', 'darkWood'], ceilMat: 'acousticCeil', surface: 'wood', reverb: 'studio', amb: 'room', light: { type: 'studio', spacing: 5, circuit: 'bird' } },
  b: { name: 'Listening Booth', ceil: 2.6, floorMat: 'carpet', wall: ['foamPanel', 'foamPanel', 'foamPanel'], ceilMat: 'acousticCeil', surface: 'carpet', reverb: 'dead', amb: 'dead', light: { type: 'studio', spacing: 6, circuit: 'bird' } },
  h: { name: 'Reverberation Hall', ceil: 7.0, floorMat: 'polished', wall: ['concretePaint', 'concretePaint', 'concretePaint'], ceilMat: 'concrete', surface: 'concrete', reverb: 'hall', amb: 'hall', light: { type: 'flood', spacing: 6, circuit: 'bird' } },
  x: { name: 'Records Archive', floorMat: 'lino', wall: ['greyPaint', 'paint', 'darkTile'], ceilMat: 'ceilTile', surface: 'tile', reverb: 'room', amb: 'room', light: { type: 'fluoro', spacing: 5, circuit: 'bird' } },
  y: { name: 'Hidden Room', ceil: 2.6, floorMat: 'concrete', wall: ['concrete', 'concrete', 'concrete'], ceilMat: 'concrete', surface: 'concrete', reverb: 'small', amb: 'dead', light: null },
  6: { name: 'Broadcast Room', floorMat: 'linoDark', wall: ['acoustic', 'acoustic', 'darkWood'], ceilMat: 'acousticCeil', surface: 'tile', reverb: 'room', amb: 'room', light: { type: 'fluoro', spacing: 6, circuit: 'bird' } },
  7: { name: 'Research Office', floorMat: 'carpet', wall: ['greyPaint', 'paint', 'darkTile'], ceilMat: 'ceilTile', surface: 'carpet', reverb: 'room', amb: 'room', light: { type: 'fluoro', spacing: 5, circuit: 'bird' } },
  q: { name: 'Antechamber', ceil: 3.0, floorMat: 'steel', wall: ['concretePaint', 'greyPaint', 'darkTile'], ceilMat: 'concrete', surface: 'metal', reverb: 'room', amb: 'room', light: { type: 'fluoro', spacing: 5, circuit: 'bird' } },
  z: { name: 'Chamber Zero', ceil: 4.6, floorMat: 'wireGrid', wall: ['foam', 'foam', 'foam'], ceilMat: 'foam', surface: 'grate', reverb: 'anechoic', amb: 'anechoic', light: { type: 'studio', spacing: 10, circuit: 'bird', dim: 0.35 } },
  u: { name: 'Stairwell', ceil: 3.0, floorMat: 'concrete', wall: ['concrete', 'paint', 'darkTile'], ceilMat: 'concrete', surface: 'concrete', reverb: 'stair', amb: 'basement', light: { type: 'cage', spacing: 8, circuit: 'bulb' } },
  g: { name: 'Service Tunnel', floor: -4, ceil: -1.5, floorMat: 'concreteWet', wall: ['concrete', 'concrete', 'concrete'], ceilMat: 'concrete', surface: 'concrete', reverb: 'tunnel', amb: 'basement', light: { type: 'cage', spacing: 8, circuit: 'bulb' } },
  j: { name: 'Electrical Room', floor: -4, ceil: -1.0, floorMat: 'concrete', wall: ['concrete', 'greyPaint', 'darkTile'], ceilMat: 'concrete', surface: 'concrete', reverb: 'basement', amb: 'electrical', light: { type: 'cage', spacing: 8, circuit: 'bulb' } },
  f: { name: 'Boiler Room', floor: -4, ceil: -0.4, floorMat: 'concreteWet', wall: ['brick', 'brick', 'brick'], ceilMat: 'concrete', surface: 'concrete', reverb: 'basement', amb: 'boiler', light: { type: 'cage', spacing: 6, circuit: 'bulb' } },
  1: { name: 'Workshop', floor: -4, ceil: -1.0, floorMat: 'concrete', wall: ['concrete', 'greyPaint', 'darkTile'], ceilMat: 'concrete', surface: 'concrete', reverb: 'basement', amb: 'basement', light: { type: 'cage', spacing: 8, circuit: 'bulb' } },
  2: { name: 'Storage', floor: -4, ceil: -1.0, floorMat: 'concrete', wall: ['concrete', 'concrete', 'concrete'], ceilMat: 'concrete', surface: 'concrete', reverb: 'basement', amb: 'basement', light: { type: 'cage', spacing: 8, circuit: 'bulb' } },
  3: { name: 'Cistern', floor: -4, ceil: -0.8, floorMat: 'concreteWet', wall: ['brick', 'brick', 'brick'], ceilMat: 'concrete', surface: 'water', reverb: 'cistern', amb: 'cistern', light: { type: 'cage', spacing: 8, circuit: 'bulb' } },
};

export const W = 84;
export const H = 66;

class Painter {
  constructor(w, h) {
    this.w = w; this.h = h;
    const n = w * h;
    this.type = new Uint8Array(n);         // CELL.*
    this.zone = new Uint8Array(n);         // zone char code (0 for solid)
    this.floorOv = new Float32Array(n).fill(NaN);
    this.ceilOv = new Float32Array(n).fill(NaN);
    this.rects = [];
    this.doors = [];
    this.windows = [];
  }
  idx(x, z) { return z * this.w + x; }
  inb(x, z) { return x >= 0 && z >= 0 && x < this.w && z < this.h; }
  rect(ch, x0, z0, x1, z1, opts = {}) {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const i = this.idx(x, z);
      this.type[i] = opts.type ?? CELL.FLOOR;
      this.zone[i] = ch.charCodeAt(0);
      if (opts.floor !== undefined) this.floorOv[i] = opts.floor;
      if (opts.ceil !== undefined) this.ceilOv[i] = opts.ceil;
    }
    const r = { ch, x0, z0, x1, z1, ...opts };
    if (!opts.noRecord) this.rects.push(r);
    return r;
  }
  door(x, z, opts = {}) {
    const i = this.idx(x, z);
    this.type[i] = CELL.DOOR;
    const d = { id: opts.id || `door_${x}_${z}`, x, z, style: 'wood', ...opts };
    this.doors.push(d);
    return d;
  }
  window(x, z, opts = {}) {
    const i = this.idx(x, z);
    this.type[i] = CELL.WINDOW;
    this.windows.push({ x, z, ...opts });
  }
  fence(x0, z0, x1, z1) {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const i = this.idx(x, z);
      this.type[i] = CELL.FENCE;
      this.zone[i] = 'o'.charCodeAt(0);
    }
  }
  forest(x0, z0, x1, z1) {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const i = this.idx(x, z);
      this.type[i] = CELL.FOREST;
      this.zone[i] = 'o'.charCodeAt(0);
    }
  }
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
function paintLayout(g) {
  // ===== BASEMENT (floor -4) =====
  g.rect('g', 2, 1, 57, 3, { name: 'Service Tunnel', light: { type: 'cage', spacing: 7, circuit: 'bulb' } });
  g.rect('g', 7, 4, 9, 4, { noRecord: true });
  g.rect('j', 2, 5, 5, 10, { name: 'Electrical Room' });
  g.door(4, 4, { style: 'metal', name: 'Electrical Room' });
  g.rect('u', 7, 5, 9, 12, { name: 'West Stairwell' });
  g.rect('f', 11, 5, 22, 11, { name: 'Boiler Room' });
  g.door(13, 4, { style: 'metal', name: 'Boiler Room' });
  g.door(20, 4, { style: 'metal', name: 'Boiler Room' });
  g.rect('1', 24, 5, 29, 10, { name: 'Workshop' });
  g.door(26, 4, { style: 'metal', bolt: 'z+', name: 'Workshop' });
  g.rect('2', 31, 5, 37, 10, { name: 'Storage' });
  g.door(34, 4, { style: 'metal', name: 'Storage' });
  g.rect('3', 39, 5, 48, 10, { name: 'Cistern' });
  g.door(43, 4, { style: 'metal', name: 'Cistern' });
  g.rect('u', 56, 4, 57, 11, { name: 'East Stairwell' });
  g.door(56, 12, { id: 'hatch', style: 'metal', oneWay: 'z+', name: 'Bulkhead' });

  // ===== GROUND FLOOR =====
  // Admin / west
  g.rect('w', 7, 14, 9, 32, { name: 'West Corridor' });
  g.door(8, 13, { id: 'maint', style: 'metal', locked: true, key: 'key_maint', name: 'Maintenance Stairs', lockMsg: 'Locked. A brass plate reads MAINTENANCE — STAFF ONLY.' });
  g.rect('m', 11, 14, 20, 23, { name: "Director's Office" });
  g.door(10, 18, { id: 'office', style: 'woodDark', locked: true, key: 'key_director', name: "Director's Office", lockMsg: 'Locked. DR. A. MORROW — DIRECTOR.' });
  g.rect('s', 11, 25, 18, 31, { name: "Secretary's Office" });
  g.door(10, 28, { style: 'wood', name: "Secretary's Office" });

  // Main corridor
  g.rect('c', 5, 33, 49, 35, { name: 'Main Corridor' });
  g.door(50, 34, { id: 'research', style: 'security', powerLock: 'bird', name: 'Research Wing', lockMsg: 'The security door is sealed. The card reader is dead — no power.' });

  // South rooms
  g.rect('t', 5, 37, 12, 45, { name: 'Restrooms' });
  g.door(9, 36, { style: 'wood', name: 'Restrooms' });
  g.rect('l', 14, 37, 27, 45, { name: 'Staff Lounge' });
  g.door(20, 36, { id: 'lounge', style: 'woodGlass', name: 'Staff Lounge' });
  g.rect('r', 29, 37, 33, 45, { name: 'Reception' });
  g.door(34, 41, { style: 'wood', name: 'Reception' });
  g.window(34, 38, { interior: true });
  g.window(34, 39, { interior: true });
  g.rect('a', 35, 37, 47, 45, { name: 'Lobby' });
  g.rect('a', 39, 36, 43, 36, { ceil: 3.0, noRecord: true });
  g.door(40, 46, { id: 'front_l', style: 'glassDouble', pair: 'front_r', hinge: 'l', name: 'Front Entrance', lockMsg: 'Locked. The voicemail said the key would be under the mat.' });
  g.door(41, 46, { id: 'front_r', style: 'glassDouble', pair: 'front_l', hinge: 'r', name: 'Front Entrance', lockMsg: 'Locked. The voicemail said the key would be under the mat.' });

  // Residential wing
  g.rect('n', 22, 14, 48, 16, { name: 'Residential Wing' });
  g.rect('n', 36, 17, 38, 32, { name: 'Residential Corridor' });
  const dz = [18, 23, 28];
  dz.forEach((z0, k) => {
    g.rect('d', 30, z0, 34, z0 + 3, { name: `Dormitory ${k * 2 + 1}` });
    g.door(35, z0 + 1, { style: 'wood', bolt: 'x-', name: `Dormitory ${k * 2 + 1}` });
    g.rect('d', 40, z0, 44, z0 + 3, { name: `Dormitory ${k * 2 + 2}` });
    g.door(39, z0 + 1, { style: 'wood', bolt: 'x+', name: `Dormitory ${k * 2 + 2}` });
  });
  g.rect('i', 22, 18, 28, 26, { name: 'Infirmary' });
  g.door(25, 17, { style: 'woodGlass', bolt: 'z+', name: 'Infirmary' });
  g.rect('4', 46, 18, 50, 24, { name: 'Showers' });
  g.door(47, 17, { style: 'wood', name: 'Showers' });

  // Research ring
  g.rect('e', 51, 34, 80, 35, { name: 'Research Ring', light: { type: 'fluoro', spacing: 5.5, circuit: 'bird' } });
  g.rect('e', 56, 13, 57, 33, { name: 'Research Ring West', light: { type: 'fluoro', spacing: 5.5, circuit: 'bird' } });
  g.rect('e', 58, 13, 67, 14, { name: 'Research Ring North', light: { type: 'fluoro', spacing: 5.5, circuit: 'bird' } });
  g.rect('e', 68, 13, 69, 33, { name: 'Research Ring East', light: { type: 'fluoro', spacing: 5.5, circuit: 'bird' } });
  g.rect('v', 59, 16, 66, 23, { name: 'Live Room' });
  g.door(58, 19, { style: 'studio', name: 'Live Room' });
  for (let x = 61; x <= 64; x++) g.window(x, 24, { interior: true, studio: true });
  g.rect('k', 59, 25, 66, 32, { name: 'Control Room' });
  g.door(58, 29, { style: 'studio', name: 'Control Room' });
  g.door(67, 29, { style: 'studio', name: 'Control Room' });
  [16, 20, 24, 28].forEach((z0, k) => {
    g.rect('b', 52, z0, 54, z0 + 2, { name: `Listening Booth ${k + 1}` });
    g.door(55, z0 + 1, { style: 'studio', name: `Listening Booth ${k + 1}` });
  });
  g.rect('h', 71, 16, 80, 32, { name: 'Reverberation Hall' });
  g.door(70, 24, { style: 'heavy', name: 'Reverberation Hall' });
  g.door(76, 33, { style: 'heavy', name: 'Reverberation Hall' });
  g.rect('q', 60, 5, 70, 11, { name: 'Antechamber' });
  g.door(64, 12, { id: 'ante', style: 'security', powerLock: 'bird', name: 'Antechamber', lockMsg: 'Sealed. The card reader is dark.' });
  g.rect('z', 72, 3, 80, 11, { name: 'Chamber Zero' });
  g.door(71, 7, { id: 'vault', style: 'vault', locked: true, key: '__voice', name: 'Chamber Zero', lockMsg: 'The vault does not move. A grille beside it reads: VOICE AUTHORIZATION — DR. A. MORROW.' });
  g.window(71, 9, { interior: true, thick: true });
  g.window(71, 10, { interior: true, thick: true });
  g.rect('x', 58, 37, 67, 45, { name: 'Records Archive' });
  g.door(62, 36, { style: 'wood', name: 'Records Archive' });
  g.rect('y', 69, 38, 73, 44, { name: 'Hidden Room' });
  g.door(68, 41, { id: 'secret', style: 'shelf', secret: true, name: 'Shelf' });
  g.rect('6', 75, 37, 80, 45, { name: 'Broadcast Room' });
  g.door(77, 36, { style: 'metal', name: 'Broadcast Room' });
  g.rect('7', 51, 37, 56, 45, { name: 'Research Office' });
  g.door(54, 36, { style: 'wood', name: 'Research Office' });

  // Facade windows (z = 46)
  for (const x of [7]) g.window(x, 46, { exterior: true, frosted: true });
  for (const x of [17, 18, 23, 24, 31, 36, 37, 44, 45, 53, 60, 61, 65, 66]) g.window(x, 46, { exterior: true });

  // ===== EXTERIOR =====
  g.rect('o', 4, 47, 79, 61, { name: 'Grounds' });
  g.rect('p', 40, 47, 41, 52, { name: 'Path', noRecord: true });
  g.rect('p', 30, 53, 52, 59, { name: 'Car Park' });
  g.forest(0, 47, 2, 65);
  g.forest(81, 47, 83, 65);
  g.forest(3, 63, 80, 65);
  g.fence(3, 47, 3, 62);
  g.fence(80, 47, 80, 62);
  g.fence(3, 62, 80, 62);
  g.rect('p', 40, 63, 41, 65, { name: 'Road' });
  g.door(40, 62, { id: 'gate_l', style: 'gate', locked: true, key: 'key_gate', pair: 'gate_r', hinge: 'l', name: 'Gate', lockMsg: 'Chained shut. It was open when I drove in.' });
  g.door(41, 62, { id: 'gate_r', style: 'gate', locked: true, key: 'key_gate', pair: 'gate_l', hinge: 'r', name: 'Gate', lockMsg: 'Chained shut. It was open when I drove in.' });
}

// Ramps (stairs): floor interpolates along z between world edges.
const RAMPS = [
  { x0: 7, z0: 5, x1: 9, z1: 12, zA: 5, hA: -4, zB: 13, hB: 0, name: 'West Stairwell' },
  { x0: 56, z0: 4, x1: 57, z1: 11, zA: 4, hA: -4, zB: 12, hB: 0, name: 'East Stairwell' },
];

// ---------------------------------------------------------------------------
// Props (world coords; y is height above local floor)
// ---------------------------------------------------------------------------
function buildProps() {
  const P = [];
  const add = (t, x, z, r = 0, o = {}) => { const p = { t, x, z, r, ...o }; P.push(p); return p; };

  // ---- Exterior ----
  add('car', 35.5, 56.2, 180, { id: 'car' });
  add('lampPost', 39.2, 50.5, 0, { light: true });
  add('lampPost', 42.8, 50.5, 0, { light: true, flicker: true });
  add('lampPost', 29.4, 56.0, 0, { light: true });
  add('lampPost', 53.6, 56.0, 0, { light: false });
  add('canopy', 41.0, 47.25, 0, { y: 3.0 });
  add('doormat', 41.0, 47.45, 0, { id: 'doormat' });
  add('bench', 36.0, 47.3, 0);
  add('bench', 46.0, 47.3, 0);
  add('trashBin', 38.4, 47.4);
  add('gateSign', 45.5, 61.4, 180);
  const trees = [[7, 50], [11, 57], [15, 51], [20, 58], [24, 49.5], [9, 60], [61, 50], [66, 57], [70, 51], [75, 58], [77, 49.5], [57, 60], [26, 55], [64, 54], [5.5, 54], [78, 54], [17, 61], [72, 61]];
  for (const [x, z] of trees) add('tree', x + 0.5, z + 0.5, 0);

  // ---- Lobby (x35..47 z37..45) ----
  add('receptionDesk', 37.2, 41.5, 90, { id: 'lobbyDesk' });
  add('chairRow', 47.71, 39.5, 270);
  add('chairRow', 47.71, 42.6, 270);
  add('coffeeTable', 46.5, 41.05, 90);
  add('plant', 35.6, 37.6);
  add('plant', 47.4, 37.6);
  add('plant', 47.4, 45.4);
  add('plant', 35.6, 45.4);
  add('directory', 45.8, 37.03, 0, { id: 'directory', y: 1.55 });
  add('portrait', 37.0, 37.03, 0, { id: 'portrait', y: 1.9 });
  add('clock', 41.5, 37.03, 0, { y: 3.9, id: 'lobbyClock' });
  add('rug', 41.5, 42.5, 0, { w: 4.2, d: 3.2 });
  add('bench', 41.5, 39.4, 180);
  add('trashBin', 36.2, 43.6);
  add('noticeBoard', 47.97, 44.2, 270, { y: 1.5 });
  add('signPlate', 41.5, 36.03, 0, { y: 2.75, text: 'RESEARCH  ·  RESIDENTIAL  ·  ADMINISTRATION' });

  // ---- Reception (x29..33 z37..45) ----
  add('desk', 33.62, 38.9, 270, { id: 'recDesk' });
  add('officeChair', 32.75, 38.9, 270);
  add('keyCabinet', 29.06, 41.6, 90, { id: 'keyCabinet', y: 1.45 });
  add('fileCabinet', 30.0, 45.67, 180);
  add('fileCabinet', 30.6, 45.67, 180);
  add('fileCabinet', 31.2, 45.67, 180);
  add('wardrobe', 33.69, 44.4, 270, { hideId: 'hide_reception' });
  add('coatRack', 29.5, 38.0);
  add('wallPhone', 29.03, 39.6, 90, { y: 1.4 });

  // ---- Restrooms (x5..12 z37..45) ----
  for (const z of [39.0, 40.0, 41.0]) add('sink', 5.26, z, 90);
  add('mirror', 5.03, 40.0, 90, { id: 'mirror', y: 1.55 });
  for (const z of [41.0, 42.0, 43.0, 44.0]) add('stall', 12.25, z, 270, { w: 1.0, d: 1.5 });
  add('trashBin', 7.6, 37.5);
  add('vent', 10.5, 45.97, 180, { y: 0.3, ventId: 'v_rest' });

  // ---- Lounge (x14..27 z37..45) ----
  add('counter', 16.0, 37.31, 0, { w: 3.6, sink: true });
  add('fridge', 18.4, 37.36, 0);
  add('vending', 22.0, 37.41, 0, { id: 'vending' });
  add('table', 24.5, 40.0, 0);
  add('chair', 23.9, 39.15, 0);
  add('chair', 25.1, 39.15, 0);
  add('chair', 23.9, 40.85, 180);
  add('chair', 25.1, 40.85, 180, { id: 'loungeChair' });
  add('sofa', 19.0, 45.53, 180);
  add('coffeeTable', 19.0, 44.0, 0);
  add('armchair', 16.6, 44.0, 90);
  add('armchair', 21.4, 44.0, 270);
  add('tvStand', 19.0, 41.9, 0);
  add('bookshelf', 14.19, 41.5, 90);
  add('plant', 27.5, 45.5);
  add('rug', 19.0, 43.6, 0, { w: 3.6, d: 2.6 });
  add('vent', 14.03, 44.6, 90, { y: 0.3, ventId: 'v_lounge' });
  add('pictoPlate', 21.6, 36.03, 180, { y: 1.6, picto: 'cup' });

  // ---- Main corridor (x5..49 z33..35) ----
  add('waterCooler', 5.4, 33.4);
  add('bench', 14.5, 35.74, 180);
  add('bench', 30.5, 35.74, 180);
  add('noticeBoard', 13.0, 33.03, 0, { y: 1.5 });
  add('noticeBoard', 27.0, 33.03, 0, { y: 1.5 });
  add('noticeBoard', 44.0, 33.03, 0, { y: 1.5 });
  add('wheelchair', 28.6, 34.3, 205, { id: 'wheelchair' });
  add('trashBin', 10.5, 33.3);
  add('trashBin', 33.4, 35.7);
  add('fireExt', 20.5, 33.03, 0, { y: 1.0 });
  add('fireExt', 47.5, 35.97, 180, { y: 1.0 });
  add('pictoPlate', 49.97, 33.5, 270, { y: 1.6, picto: 'bird' });
  add('signPlate', 49.97, 35.5, 270, { y: 2.0, text: 'RESEARCH — AUTHORIZED ONLY' });
  add('alarmBell', 24.0, 33.03, 0, { y: 2.5, bell: true });
  add('pictoPlate', 35.97, 32.4, 270, { y: 1.6, picto: 'bed' });

  // ---- West corridor (x7..9 z14..32) ----
  add('bench', 9.75, 23.6, 270);
  add('noticeBoard', 7.03, 21.0, 90, { y: 1.5 });
  add('fireExt', 7.03, 27.0, 90, { y: 1.0 });
  add('plant', 7.45, 14.5);
  add('pictoPlate', 9.6, 14.03, 0, { y: 1.7, picto: 'bulb' });
  add('signPlate', 8.5, 14.03, 0, { y: 2.45, text: 'MAINTENANCE' });

  // ---- Director's office (x11..20 z14..23) ----
  add('deskBig', 16.8, 18.5, 90, { id: 'morrowDesk' });
  add('officeChair', 17.85, 18.5, 270);
  add('armchair', 15.0, 17.5, 90);
  add('armchair', 15.0, 19.6, 90);
  for (const x of [12.7, 13.95, 18.3, 19.55]) add('bookshelf', x, 14.19, 0);
  add('fileCabinet', 20.67, 22.2, 270);
  add('globe', 12.2, 22.8);
  add('rug', 16.4, 18.5, 0, { w: 4.4, d: 3.4 });
  add('photoFrame', 20.97, 18.5, 270, { id: 'staffPhoto', y: 1.75 });
  add('coatRack', 11.5, 23.4);
  add('tableLamp', 16.5, 17.75, 0, { y: 0.78, light: true });

  // ---- Secretary (x11..18 z25..31) ----
  add('desk', 15.0, 25.38, 0, { id: 'secDesk' });
  add('officeChair', 15.0, 26.3, 180);
  add('fileCabinet', 18.67, 27.0, 270);
  add('fileCabinet', 18.67, 27.6, 270);
  add('fileCabinet', 18.67, 28.2, 270);
  add('wardrobe', 12.1, 31.69, 180, { hideId: 'hide_secretary' });
  add('chair', 12.0, 26.2, 90);
  add('noticeBoard', 15.5, 31.97, 180, { y: 1.5 });
  add('coatRack', 18.4, 31.4);

  // ---- Upper/residential corridors ----
  add('cart', 30.5, 14.45, 0);
  add('noticeBoard', 40.5, 14.03, 0, { y: 1.5, id: 'quietHours' });
  add('trashBin', 47.4, 14.4);
  add('chair', 38.6, 22.0, 270);
  add('wheelchair', 23.0, 15.5, 80);

  // ---- Dormitories ----
  [18, 23, 28].forEach((z0, k) => {
    // West room (door east side)
    add('bed', 30.55, z0 + 1.1, 0, { room: `dW${k}` });
    add('locker', 34.7, z0 + 3.72, 180, { hideId: `hide_dW${k}` });
    add('desk', 33.3, z0 + 0.38, 0, { w: 1.2 });
    add('chair', 33.3, z0 + 1.0, 180);
    // East room (door west side)
    add('bed', 44.45, z0 + 1.1, 0, { room: `dE${k}` });
    add('locker', 40.3, z0 + 3.72, 180, { hideId: `hide_dE${k}` });
    add('desk', 41.7, z0 + 0.38, 0, { w: 1.2 });
    add('chair', 41.7, z0 + 1.0, 180);
  });
  add('vent', 44.97, 31.3, 270, { y: 0.3, ventId: 'v_dorm' });

  // ---- Infirmary (x22..28 z18..26) ----
  add('medBed', 22.55, 20.4, 0);
  add('medBed', 22.55, 23.6, 0);
  add('curtain', 23.3, 22.0, 0, { w: 1.6 });
  add('medCabinet', 28.79, 19.2, 270);
  add('desk', 27.0, 26.62, 180, { id: 'infDesk' });
  add('officeChair', 27.0, 25.85, 0);
  add('ivStand', 23.8, 21.2);
  add('wheelchair', 25.6, 23.6, 160);
  add('scale', 28.5, 24.4);
  add('locker', 28.72, 21.8, 270, { hideId: 'hide_infirmary' });
  add('stain', 26.6, 25.4, 30, { w: 1.2, d: 0.8 });

  // ---- Showers (x46..50 z18..24) ----
  for (const z of [19.5, 21.0, 22.5]) add('showerHead', 50.9, z, 270, { y: 2.0 });
  add('bench', 47.5, 21.5, 90);
  add('locker', 46.3, 24.72, 180, { hideId: 'hide_showers' });
  add('vent', 50.97, 24.1, 270, { y: 0.3, ventId: 'v_showers' });

  // ---- Research ring ----
  add('cart', 60.5, 35.55, 0);
  add('locker', 72.0, 35.72, 180, { hideId: 'hide_ringS' });
  add('locker', 66.6, 13.28, 0, { hideId: 'hide_ringN' });
  add('cableSpool', 57.2, 24.0, 90);
  add('noticeBoard', 55.97, 32.0, 270, { y: 1.5 });
  add('alarmBell', 69.97, 20.0, 270, { y: 2.5, bell: true });
  add('signPlate', 63.5, 15.0, 180, { y: 2.3, text: 'STUDIO A — LIVE' });

  // ---- Live room (x59..66 z16..23) ----
  add('piano', 66.69, 19.5, 270, { id: 'piano' });
  add('pianoBench', 65.85, 19.5, 270, { id: 'pianoBench' });
  add('micStand', 62.0, 19.0, 0);
  add('micStand', 63.6, 21.4, 0);
  add('chair', 61.0, 20.6, 50);
  add('rug', 62.8, 20.0, 0, { w: 3.6, d: 3.0 });
  add('bigSpeaker', 59.62, 16.62, 135);
  add('bigSpeaker', 59.62, 23.38, 45);

  // ---- Control room (x59..66 z25..32) ----
  add('console', 62.9, 25.85, 0, { id: 'console' });
  add('officeChair', 62.9, 27.1, 180);
  add('reelDeck', 59.32, 31.2, 90, { id: 'reelDeck' });
  for (const x of [61.0, 61.65, 64.6, 65.25]) add('rack', x, 32.6, 180);
  add('speakerStand', 60.7, 26.2, 0);
  add('speakerStand', 65.1, 26.2, 0);
  add('sweepPanel', 66.95, 31.6, 270, { id: 'sweepPanel', y: 1.25 });
  add('desk', 66.62, 27.4, 270, { w: 1.2, id: 'ctrlDesk' });

  // ---- Booths ----
  [16, 20, 24, 28].forEach((z0, k) => {
    add('chair', 53.2, z0 + 1.5, 270);
    add('boothPanel', 52.04, z0 + 1.5, 90, { y: 1.2 });
  });
  add('vent', 52.03, 30.5, 90, { y: 0.3, ventId: 'v_booth' });

  // ---- Reverberation hall (x71..80 z16..32) ----
  add('tallySpeaker', 73.5, 19.5, 30);
  add('tallySpeaker', 78.6, 29.6, 210);
  add('tallySpeaker', 78.0, 20.0, 140);
  add('boomStand', 75.6, 25.0, 0);
  add('micStand', 73.8, 28.4, 0);
  add('micStand', 79.2, 24.0, 0);
  add('ladder', 79.0, 16.08, 0, { y: 0 });
  add('paperPile', 74.8, 30.6, 20);
  add('vent', 80.97, 31.0, 270, { y: 0.3, ventId: 'v_hall' });

  // ---- Archive (x58..67 z37..45) ----
  for (const x of [60.3, 63.3, 66.0]) {
    add('shelfUnit', x, 39.6, 90);
    add('shelfUnit', x, 43.4, 90);
  }
  add('secretShelf', 67.77, 41.5, 270, { id: 'secretShelf' });
  add('desk', 58.38, 44.6, 90, { id: 'archiveDesk' });
  add('officeChair', 59.15, 44.6, 270);
  add('fileCabinet', 58.33, 38.0, 90);
  add('fileCabinet', 58.33, 38.55, 90);

  // ---- Hidden room (x69..73 z38..44) ----
  add('mattress', 70.0, 43.4, 0);
  add('desk', 72.5, 38.38, 0, { id: 'amselDesk' });
  add('chair', 72.5, 39.1, 180);
  add('chalkboard', 73.97, 41.4, 270, { y: 1.5, papers: true, id: 'amselWall' });
  add('crate', 69.6, 39.0, 15);
  add('lantern', 72.1, 38.4, 0, { y: 0.78, id: 'lantern' });
  add('paperPile', 70.8, 41.2, 70);

  // ---- Broadcast (x75..80 z37..45) ----
  add('ampRack', 78.0, 45.67, 180, { id: 'ampRack' });
  add('desk', 75.38, 41.0, 90, { id: 'bcDesk' });
  add('chair', 76.1, 41.0, 270);
  add('rack', 80.6, 39.0, 270);
  add('rack', 80.6, 39.65, 270);
  add('pictoPlate', 78.4, 36.03, 180, { y: 1.6, picto: 'speaker' });

  // ---- Research office (x51..56 z37..45) ----
  add('desk', 51.38, 39.5, 90, { id: 'resDesk1' });
  add('officeChair', 52.2, 39.5, 270);
  add('desk', 51.38, 42.6, 90, { id: 'resDesk2' });
  add('officeChair', 52.2, 42.6, 270);
  add('chalkboard', 56.97, 41.0, 270, { y: 1.6, id: 'resBoard' });
  add('hatsDummy', 55.8, 44.8, 200, { id: 'dummyOffice' });
  add('bookshelf', 56.82, 38.1, 270);

  // ---- Antechamber (x60..70 z5..11) ----
  add('voicePanel', 70.35, 5.75, 270, { id: 'voicePanel' });
  add('desk', 70.62, 10.0, 270, { w: 1.4 });
  add('chair', 69.8, 10.0, 90);
  add('rack', 60.42, 6.0, 90);
  add('rack', 60.42, 6.65, 90);
  add('rack', 60.42, 7.3, 90);
  add('bench', 64.0, 10.74, 180);
  add('signPlate', 70.97, 8.3, 270, { y: 2.5, text: 'CHAMBER ZERO' });

  // ---- Chamber Zero (x72..80 z3..11) ----
  add('chamberChair', 76.5, 7.5, 270, { id: 'chamberChair' });
  add('micStand', 75.5, 7.5, 0);
  add('reelDeck', 77.6, 8.6, 270, { id: 'chamberDeck', small: true });

  // ---- Basement ----
  // Tunnel pipes
  add('pipeRun', 29.5, 1.12, 0, { w: 55, y: 2.15, r2: 0.09 });
  add('pipeRun', 29.5, 1.12, 0, { w: 55, y: 1.85, r2: 0.06 });
  add('pipeRun', 29.5, 3.88, 180, { w: 55, y: 2.25, r2: 0.12 });
  for (const x of [12, 25, 38, 51]) add('junctionBox', x, 1.03, 0, { y: 1.3 });
  add('puddle', 18.5, 2.3, 0);
  add('puddle', 36.0, 2.0, 40);
  add('puddle', 47.0, 2.6, 10);
  add('crate', 3.2, 2.0, 10);
  add('barrel', 3.0, 3.2, 0);
  add('drum', 50.4, 1.6, 0);
  add('boxStack', 30.0, 1.5, 0);
  // Electrical (x2..5 z5..10)
  add('breakerPanel', 3.7, 10.9, 180, { id: 'breakers', y: 1.35 });
  add('relayBox', 2.03, 7.2, 90, { id: 'relay', y: 1.55 });
  add('transformer', 5.5, 7.6, 270);
  add('chalkMarks', 2.02, 9.3, 90, { y: 1.5, id: 'circuitChalk' });
  // Boiler (x11..22 z5..11)
  add('boiler', 17.0, 8.4, 0, { id: 'boiler' });
  add('chalkMarks', 17.0, 11.97, 180, { y: 1.55, id: 'valveChalk', w: 1.6 });
  add('drum', 11.6, 10.9, 0);
  add('drum', 12.3, 11.0, 0);
  add('drum', 21.9, 5.9, 0);
  add('workbench', 21.9, 9.8, 270, { w: 1.8 });
  add('vent', 12.6, 11.97, 180, { y: 0.3, ventId: 'v_boiler' });
  // Workshop (x24..29 z5..10)
  add('workbench', 27.0, 10.6, 180, { id: 'ruthBench' });
  add('toolWall', 27.0, 10.98, 180, { y: 1.55 });
  add('cot', 24.42, 8.0, 0);
  add('locker', 29.72, 6.0, 270, { hideId: 'hide_workshop' });
  add('barrel', 29.6, 10.5, 0);
  // Storage (x31..37 z5..10)
  add('shelfUnit', 31.28, 7.0, 90);
  add('shelfUnit', 31.28, 9.5, 90);
  add('sheetChair', 34.4, 8.0, 15);
  add('sheetChair', 35.7, 9.6, 200);
  add('sheetTable', 36.2, 6.6, 0);
  add('hatsDummy', 36.9, 10.3, 200);
  add('hatsDummy', 33.1, 10.4, 165);
  add('wardrobe', 37.69, 9.0, 270, { hideId: 'hide_storage' });
  add('boxStack', 33.0, 5.5, 0);
  // Cistern (x39..48 z5..10)
  add('pump', 39.6, 10.4, 0, { id: 'pump' });
  add('pictoPlate', 42.4, 4.03, 0, { y: 1.6, picto: 'drop', below: true });
  add('vent', 48.97, 9.5, 270, { y: 0.3, ventId: 'v_cistern' });
  // Boiler-room doors picto (tunnel side)
  add('pictoPlate', 14.4, 3.97, 180, { y: 1.6, picto: 'flame' });
  add('vent', 6.0, 1.03, 0, { y: 0.3, ventId: 'v_tunnel' });
  add('alarmBell', 22.0, 3.97, 180, { y: 1.9, bell: true });

  return P;
}

// Light fixtures authored in addition to auto ones.
function extraFixtures() {
  return [
    { type: 'lamppost', x: 39.2, z: 50.5, y: 4.4, circuit: 'ext' },
    { type: 'lamppost', x: 42.8, z: 50.5, y: 4.4, circuit: 'ext', flicker: 0.7 },
    { type: 'lamppost', x: 29.4, z: 56.0, y: 4.4, circuit: 'ext' },
    { type: 'lamppost', x: 53.6, z: 56.0, y: 4.4, circuit: 'ext', broken: true },
    { type: 'canopy', x: 41.0, z: 47.6, y: 2.85, circuit: 'ext' },
    { type: 'desk', x: 16.5, z: 17.75, y: 1.15, circuit: 'cup', zoneHint: 'm' },
    // Emergency lights (always-on battery units)
    { type: 'emergency', x: 5.5, z: 34.0, y: 2.6, circuit: 'emergency' },
    { type: 'emergency', x: 49.5, z: 34.0, y: 2.6, circuit: 'emergency' },
    { type: 'emergency', x: 4.0, z: 5.6, y: 2.2, circuit: 'emergency' },
    { type: 'emergency', x: 8.5, z: 5.5, y: 2.3, circuit: 'emergency' },
    { type: 'emergency', x: 56.5, z: 33.5, y: 2.6, circuit: 'emergency' },
    { type: 'emergency', x: 69.5, z: 13.5, y: 2.6, circuit: 'emergency' },
    { type: 'emergency', x: 65.0, z: 5.5, y: 2.6, circuit: 'emergency' },
    { type: 'emergency', x: 30.0, z: 2.0, y: 2.3, circuit: 'emergency' },
    { type: 'emergency', x: 37.5, z: 17.5, y: 2.6, circuit: 'emergency' },
    { type: 'boilerGlow', x: 17.0, z: 9.9, y: 0.8, circuit: 'boiler' },
  ];
}

const VENTS = [
  // Entity-only duct links (it crawls through walls; the player hears scratching).
  ['v_rest', 'v_tunnel'],
  ['v_lounge', 'v_boiler'],
  ['v_showers', 'v_booth'],
  ['v_hall', 'v_cistern'],
  ['v_dorm', 'v_showers'],
];

export const POINTS = {
  start: { x: 37.3, z: 55.6, yaw: 0.18 },
  frontDoor: { x: 41.0, z: 48.6, yaw: 0 },
  lobby: { x: 41.5, z: 41.0, yaw: 0 },
  mainCorr: { x: 25.0, z: 34.0, yaw: Math.PI / 2 },
  basement: { x: 8.5, z: 3.0, yaw: Math.PI / 2 },
  electrical: { x: 4.0, z: 7.5, yaw: Math.PI },
  boiler: { x: 17.0, z: 10.8, yaw: 0 },
  research: { x: 52.0, z: 34.5, yaw: -Math.PI / 2 },
  control: { x: 62.9, z: 28.5, yaw: 0 },
  live: { x: 61.0, z: 18.5, yaw: -Math.PI / 2 },
  hall: { x: 72.5, z: 24.5, yaw: -Math.PI / 2 },
  archive: { x: 62.5, z: 41.5, yaw: -Math.PI / 2 },
  ante: { x: 64.5, z: 9.0, yaw: -Math.PI / 2 },
  chamber: { x: 74.0, z: 7.5, yaw: -Math.PI / 2 },
  office: { x: 13.0, z: 18.5, yaw: -Math.PI / 2 },
  dorm: { x: 37.5, z: 24.0, yaw: 0 },
  infirmary: { x: 25.5, z: 19.5, yaw: Math.PI },
  restroom: { x: 8.0, z: 40.0, yaw: Math.PI / 2 },
  lounge: { x: 20.5, z: 39.0, yaw: Math.PI },
  workshop: { x: 26.5, z: 6.5, yaw: Math.PI },
  cistern: { x: 43.5, z: 6.0, yaw: Math.PI },
  broadcast: { x: 77.5, z: 39.0, yaw: Math.PI },
  hidden: { x: 71.0, z: 41.0, yaw: -Math.PI / 2 },
};

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------
export function buildMapData() {
  const g = new Painter(W, H);
  paintLayout(g);

  const n = W * H;
  const floorH = new Float32Array(n);
  const ceilH = new Float32Array(n);
  const zoneId = new Int16Array(n).fill(-1);

  const zoneOf = (i) => (g.zone[i] ? String.fromCharCode(g.zone[i]) : null);

  // Doors take the zone of a neighbouring floor cell (prefer non-exterior).
  const doorAt = new Int16Array(n).fill(-1);
  g.doors.forEach((d, k) => {
    const i = g.idx(d.x, d.z);
    doorAt[i] = k;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dz]) => [d.x + dx, d.z + dz])
      .filter(([x, z]) => g.inb(x, z) && g.type[g.idx(x, z)] === CELL.FLOOR);
    // Passage axis: along x if the x-neighbours are walkable.
    const open = (x, z) => g.inb(x, z) && (g.type[g.idx(x, z)] === CELL.FLOOR || g.type[g.idx(x, z)] === CELL.DOOR);
    const ex = open(d.x - 1, d.z) && open(d.x + 1, d.z);
    d.passage = ex ? 'x' : 'z';
    const sides = d.passage === 'x' ? [[d.x - 1, d.z], [d.x + 1, d.z]] : [[d.x, d.z - 1], [d.x, d.z + 1]];
    d.sides = sides.map(([x, z]) => ({ x, z, zone: zoneOf(g.idx(x, z)) }));
    const pref = nb.find(([x, z]) => !ZONES[zoneOf(g.idx(x, z))]?.ext) || nb[0];
    if (pref) g.zone[i] = g.zone[g.idx(pref[0], pref[1])];
  });

  // Windows take the zone of an interior neighbour.
  for (const w of g.windows) {
    const i = g.idx(w.x, w.z);
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dz]) => [w.x + dx, w.z + dz])
      .filter(([x, z]) => g.inb(x, z) && g.type[g.idx(x, z)] === CELL.FLOOR);
    const inner = nb.find(([x, z]) => !ZONES[zoneOf(g.idx(x, z))]?.ext) || nb[0];
    if (inner) g.zone[i] = g.zone[g.idx(inner[0], inner[1])];
    const ex = nb.some(([x, z]) => ZONES[zoneOf(g.idx(x, z))]?.ext);
    w.exterior = w.exterior || ex;
    w.passage = (g.inb(w.x - 1, w.z) && g.type[g.idx(w.x - 1, w.z)] === CELL.FLOOR) ? 'x' : 'z';
  }

  // Heights
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const i = g.idx(x, z);
    const t = g.type[i];
    const zc = zoneOf(i);
    const zd = zc ? ZONES[zc] : null;
    let f = zd?.floor ?? 0;
    let c = zd?.ext ? FACADE_TOP : (zd?.ceil ?? 3.2);
    if (!isNaN(g.floorOv[i])) f = g.floorOv[i];
    if (!isNaN(g.ceilOv[i])) c = g.ceilOv[i];
    if (t === CELL.DOOR) {
      const d = g.doors[doorAt[i]];
      if (d.style === 'gate') { c = FACADE_TOP; }
      else if (d.style === 'glassDouble') c = 2.5;
      else if (d.style === 'vault') c = 2.5;
      else if (d.style === 'security' || d.style === 'heavy') c = 2.3;
      else c = 2.2;
      // Door floors match their neighbours (basement doors).
      const s0 = d.sides[0], s1 = d.sides[1];
      const fz = [s0, s1].map((s) => ZONES[s.zone]?.floor ?? 0);
      f = Math.max(fz[0], fz[1]);
      if (d.id === 'hatch') f = 0;
      c = f + c;
    } else if (t === CELL.WINDOW) {
      const w = g.windows.find((ww) => ww.x === x && ww.z === z);
      f = 1.0;
      c = w?.exterior ? 2.7 : (w?.studio ? 2.3 : 2.2);
      if (w?.thick) { f = 1.1; c = 2.0; }
    } else if (t === CELL.SOLID) {
      f = 0; c = 0;
    }
    floorH[i] = f;
    ceilH[i] = c;
  }

  // Ramps: per-cell floor height is the cell-centre height; floorAt() interpolates.
  for (const r of RAMPS) {
    for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) {
      const i = g.idx(x, z);
      const t = (z + 0.5 - r.zA) / (r.zB - r.zA);
      floorH[i] = r.hA + (r.hB - r.hA) * t;
      ceilH[i] = floorH[i] + 3.0;
    }
  }

  // Zone components (4-connected, same zone char, FLOOR cells only).
  const zones = [];
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const i = g.idx(x, z);
    if (g.type[i] !== CELL.FLOOR || zoneId[i] !== -1) continue;
    const ch = zoneOf(i);
    const id = zones.length;
    const comp = { id, ch, cells: [], x0: x, z0: z, x1: x, z1: z, name: ZONES[ch]?.name || ch };
    const stack = [i];
    zoneId[i] = id;
    while (stack.length) {
      const c = stack.pop();
      const cx = c % W, cz = (c / W) | 0;
      comp.cells.push(c);
      comp.x0 = Math.min(comp.x0, cx); comp.x1 = Math.max(comp.x1, cx);
      comp.z0 = Math.min(comp.z0, cz); comp.z1 = Math.max(comp.z1, cz);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, nz = cz + dz;
        if (!g.inb(nx, nz)) continue;
        const ni = g.idx(nx, nz);
        if (zoneId[ni] !== -1 || g.type[ni] !== CELL.FLOOR || g.zone[ni] !== g.zone[i]) continue;
        zoneId[ni] = id;
        stack.push(ni);
      }
    }
    zones.push(comp);
  }
  // Names from rects (first rect touching a component names it)
  for (const r of g.rects) {
    const zi = zoneId[g.idx(r.x0, r.z0)];
    if (zi >= 0 && r.name && !zones[zi].named) { zones[zi].name = r.name; zones[zi].named = true; }
  }
  // Doors / windows / forest/fence belong to a zone id of a neighbour for lookup.
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const i = g.idx(x, z);
    if (zoneId[i] !== -1 || g.type[i] === CELL.SOLID) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (!g.inb(nx, nz)) continue;
      const ni = g.idx(nx, nz);
      if (zoneId[ni] >= 0 && g.zone[ni] === g.zone[i]) { zoneId[i] = zoneId[ni]; break; }
    }
    if (zoneId[i] === -1) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (g.inb(nx, nz) && zoneId[g.idx(nx, nz)] >= 0) { zoneId[i] = zoneId[g.idx(nx, nz)]; break; }
      }
    }
  }

  // Fixtures: auto-place per painted rect, plus authored extras.
  const fixtures = [];
  for (const r of g.rects) {
    const zd = ZONES[r.ch];
    const spec = r.light === undefined ? zd?.light : r.light;
    if (!spec || zd?.ext) continue;
    const w = r.x1 - r.x0 + 1, d = r.z1 - r.z0 + 1;
    const sp = spec.spacing || 5;
    const nx = Math.max(1, Math.round(w / sp));
    const nz = Math.max(1, Math.round(d / sp));
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
      const x = r.x0 + (a + 0.5) * (w / nx);
      const z = r.z0 + (b + 0.5) * (d / nz);
      const ci = g.idx(Math.floor(x), Math.floor(z));
      if (g.type[ci] !== CELL.FLOOR) continue;
      const ceil = ceilH[ci];
      fixtures.push({ type: spec.type, x, z, y: ceil - (spec.type === 'pendant' ? 0.9 : spec.type === 'flood' ? 0.35 : 0.06), circuit: spec.circuit, dim: spec.dim, horiz: w >= d ? 'x' : 'z' });
    }
  }
  for (const f of extraFixtures()) {
    const ci = g.idx(Math.floor(f.x), Math.floor(f.z));
    fixtures.push({ ...f, y: (f.type === 'lamppost' || f.type === 'canopy') ? f.y : floorH[ci] + f.y });
  }
  fixtures.forEach((f, k) => {
    f.id = k;
    f.zoneId = zoneId[g.idx(Math.floor(f.x), Math.floor(f.z))];
  });

  const props = buildProps();
  props.forEach((p, k) => { p.index = k; });

  const vents = VENTS.map(([a, b]) => {
    const pa = props.find((p) => p.ventId === a);
    const pb = props.find((p) => p.ventId === b);
    return { a: ventPoint(pa), b: ventPoint(pb), ids: [a, b] };
  });

  const map = {
    W, H,
    type: g.type, zone: g.zone, floorH, ceilH, zoneId,
    zones, doors: g.doors, doorAt, windows: g.windows, ramps: RAMPS,
    rects: g.rects, props, fixtures, vents, points: POINTS,
    idx: (x, z) => z * W + x,
    inb: (x, z) => x >= 0 && z >= 0 && x < W && z < H,
  };
  map.zoneDefAt = (x, z) => {
    const cx = Math.floor(x), cz = Math.floor(z);
    if (!map.inb(cx, cz)) return null;
    const c = map.zone[map.idx(cx, cz)];
    return c ? ZONES[String.fromCharCode(c)] : null;
  };
  map.zoneAt = (x, z) => {
    const cx = Math.floor(x), cz = Math.floor(z);
    if (!map.inb(cx, cz)) return null;
    const id = map.zoneId[map.idx(cx, cz)];
    return id >= 0 ? map.zones[id] : null;
  };
  map.floorAt = (x, z) => floorAt(map, x, z);
  return map;
}

function ventPoint(p) {
  if (!p) return null;
  // Point just in front of the vent grille.
  const a = ((p.r || 0) * Math.PI) / 180;
  return { x: p.x + Math.sin(a) * 0.6, z: p.z + Math.cos(a) * 0.6 };
}

export function floorAt(map, x, z) {
  const cx = Math.floor(x), cz = Math.floor(z);
  if (!map.inb(cx, cz)) return 0;
  for (const r of map.ramps) {
    if (cx >= r.x0 && cx <= r.x1 && cz >= r.z0 && cz <= r.z1) {
      const t = (z - r.zA) / (r.zB - r.zA);
      return r.hA + (r.hB - r.hA) * Math.min(1, Math.max(0, t));
    }
  }
  return map.floorH[map.idx(cx, cz)];
}

// ASCII dump for debugging / floor-plan rendering.
export function mapToAscii(map) {
  const rows = [];
  for (let z = 0; z < map.H; z++) {
    let s = '';
    for (let x = 0; x < map.W; x++) {
      const i = map.idx(x, z);
      const t = map.type[i];
      if (t === CELL.SOLID) s += '#';
      else if (t === CELL.DOOR) s += 'D';
      else if (t === CELL.WINDOW) s += '=';
      else if (t === CELL.FENCE) s += '|';
      else if (t === CELL.FOREST) s += '*';
      else s += String.fromCharCode(map.zone[i]);
    }
    rows.push(s);
  }
  return rows.join('\n');
}
