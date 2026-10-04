// Pure prop footprint definitions (no three.js) so Node tooling can validate layouts.
// w = local X extent, d = local Z extent, h = height. Rotation r (degrees) about +Y.
// collide: blocks movement. nav: blocks entity navigation (large items). hide: hiding spot.

export const PROP_DEFS = {
  desk: { w: 1.4, d: 0.75, h: 0.76, collide: true },
  deskBig: { w: 2.0, d: 0.95, h: 0.78, collide: true, nav: true },
  officeChair: { w: 0.55, d: 0.55, h: 1.0, collide: true },
  chair: { w: 0.46, d: 0.48, h: 0.9, collide: true },
  armchair: { w: 0.85, d: 0.85, h: 0.95, collide: true },
  sofa: { w: 2.0, d: 0.9, h: 0.85, collide: true, nav: true },
  coffeeTable: { w: 1.1, d: 0.6, h: 0.42, collide: true },
  table: { w: 1.6, d: 0.9, h: 0.75, collide: true, nav: true },
  bed: { w: 0.95, d: 2.0, h: 0.62, collide: true, nav: true },
  medBed: { w: 0.95, d: 2.05, h: 0.75, collide: true, nav: true },
  cot: { w: 0.8, d: 1.9, h: 0.45, collide: true },
  mattress: { w: 0.9, d: 1.9, h: 0.2, collide: false },
  locker: { w: 0.6, d: 0.55, h: 1.95, collide: true, nav: true, hide: true },
  wardrobe: { w: 1.0, d: 0.62, h: 2.0, collide: true, nav: true, hide: true },
  fileCabinet: { w: 0.5, d: 0.65, h: 1.32, collide: true },
  bookshelf: { w: 1.2, d: 0.36, h: 2.0, collide: true },
  shelfUnit: { w: 2.0, d: 0.55, h: 2.3, collide: true, nav: true },
  secretShelf: { w: 1.0, d: 0.45, h: 2.2, collide: false },
  counter: { w: 2.0, d: 0.62, h: 0.92, collide: true, nav: true },
  receptionDesk: { w: 2.6, d: 0.85, h: 1.08, collide: true, nav: true },
  vending: { w: 0.95, d: 0.8, h: 1.85, collide: true },
  fridge: { w: 0.7, d: 0.7, h: 1.7, collide: true },
  piano: { w: 1.5, d: 0.62, h: 1.25, collide: true, nav: true },
  console: { w: 2.8, d: 1.0, h: 1.05, collide: true, nav: true },
  reelDeck: { w: 0.62, d: 0.55, h: 1.25, collide: true },
  rack: { w: 0.6, d: 0.8, h: 1.9, collide: true },
  bigSpeaker: { w: 0.75, d: 0.6, h: 1.6, collide: true },
  speakerStand: { w: 0.4, d: 0.4, h: 1.55, collide: true },
  micStand: { w: 0.3, d: 0.3, h: 1.6, collide: false },
  boiler: { w: 4.4, d: 2.2, h: 2.8, collide: true, nav: true },
  breakerPanel: { w: 1.6, d: 0.22, h: 1.3, collide: false, wall: true },
  workbench: { w: 2.0, d: 0.8, h: 0.92, collide: true, nav: true },
  toolWall: { w: 1.8, d: 0.1, h: 1.2, collide: false, wall: true },
  barrel: { w: 0.62, d: 0.62, h: 0.9, collide: true },
  crate: { w: 0.8, d: 0.8, h: 0.8, collide: true },
  boxStack: { w: 0.9, d: 0.7, h: 1.2, collide: true },
  sheetChair: { w: 0.75, d: 0.75, h: 1.15, collide: true },
  sheetTable: { w: 1.5, d: 0.9, h: 0.95, collide: true },
  dummyHead: { w: 0.5, d: 0.45, h: 1.55, collide: true },
  car: { w: 1.85, d: 4.4, h: 1.42, collide: true, nav: true },
  lampPost: { w: 0.3, d: 0.3, h: 4.6, collide: true },
  tree: { w: 0.8, d: 0.8, h: 9, collide: true, nav: true },
  bench: { w: 1.6, d: 0.5, h: 0.48, collide: true },
  trashBin: { w: 0.45, d: 0.45, h: 0.8, collide: true },
  plant: { w: 0.5, d: 0.5, h: 1.3, collide: true },
  wheelchair: { w: 0.65, d: 1.0, h: 0.95, collide: true },
  ivStand: { w: 0.35, d: 0.35, h: 1.8, collide: false },
  curtain: { w: 2.0, d: 0.06, h: 2.0, collide: false },
  medCabinet: { w: 0.9, d: 0.42, h: 1.85, collide: true },
  stall: { w: 1.0, d: 1.5, h: 2.0, collide: true, nav: true },
  sink: { w: 0.55, d: 0.48, h: 0.9, collide: true, wall: true },
  showerHead: { w: 0.3, d: 0.3, h: 2.1, collide: false, wall: true },
  chairRow: { w: 2.0, d: 0.58, h: 0.85, collide: true },
  tvStand: { w: 0.7, d: 0.5, h: 1.25, collide: true },
  waterCooler: { w: 0.36, d: 0.36, h: 1.3, collide: true },
  noticeBoard: { w: 1.2, d: 0.04, h: 0.85, collide: false, wall: true },
  cart: { w: 1.0, d: 0.6, h: 0.95, collide: true },
  voicePanel: { w: 1.3, d: 0.65, h: 1.1, collide: true },
  chamberChair: { w: 0.6, d: 0.6, h: 0.9, collide: true },
  ampRack: { w: 1.7, d: 0.65, h: 1.95, collide: true, nav: true },
  pump: { w: 1.1, d: 0.8, h: 1.0, collide: true },
  pipeRun: { w: 1, d: 0.2, h: 0.2, collide: false, wall: true },
  fireExt: { w: 0.2, d: 0.15, h: 0.6, collide: false, wall: true },
  clock: { w: 0.35, d: 0.05, h: 0.35, collide: false, wall: true },
  portrait: { w: 0.8, d: 0.05, h: 1.0, collide: false, wall: true },
  photoFrame: { w: 1.1, d: 0.05, h: 0.75, collide: false, wall: true },
  directory: { w: 1.4, d: 0.05, h: 1.0, collide: false, wall: true },
  pictoPlate: { w: 0.3, d: 0.03, h: 0.3, collide: false, wall: true },
  signPlate: { w: 0.7, d: 0.03, h: 0.18, collide: false, wall: true },
  keyCabinet: { w: 0.7, d: 0.12, h: 0.8, collide: false, wall: true },
  chalkMarks: { w: 1.4, d: 0.02, h: 1.0, collide: false, wall: true },
  chalkboard: { w: 2.2, d: 0.06, h: 1.2, collide: false, wall: true },
  vent: { w: 0.6, d: 0.04, h: 0.4, collide: false, wall: true },
  mirror: { w: 2.6, d: 0.04, h: 0.9, collide: false, wall: true },
  wallPhone: { w: 0.25, d: 0.12, h: 0.3, collide: false, wall: true },
  doormat: { w: 1.1, d: 0.6, h: 0.02, collide: false },
  rug: { w: 3.0, d: 2.0, h: 0.01, collide: false },
  gateSign: { w: 2.6, d: 0.2, h: 2.2, collide: true },
  canopy: { w: 4.0, d: 2.4, h: 0.3, collide: false },
  globe: { w: 0.5, d: 0.5, h: 1.0, collide: true },
  coatRack: { w: 0.45, d: 0.45, h: 1.8, collide: false },
  scale: { w: 0.5, d: 0.5, h: 1.5, collide: true },
  tallySpeaker: { w: 1.0, d: 1.0, h: 2.4, collide: true },
  boomStand: { w: 0.6, d: 0.6, h: 2.6, collide: true },
  ladder: { w: 0.6, d: 0.15, h: 3.0, collide: false, wall: true },
  junctionBox: { w: 0.5, d: 0.2, h: 0.6, collide: false, wall: true },
  relayBox: { w: 0.6, d: 0.25, h: 0.7, collide: false, wall: true },
  transformer: { w: 1.2, d: 1.0, h: 1.6, collide: true },
  drum: { w: 0.62, d: 0.62, h: 0.9, collide: true },
  hatsDummy: { w: 0.5, d: 0.45, h: 1.55, collide: true },
  tableLamp: { w: 0.3, d: 0.3, h: 0.5, collide: false },
  paperPile: { w: 0.6, d: 0.5, h: 0.05, collide: false },
  stain: { w: 1.4, d: 1.0, h: 0.01, collide: false },
  wedgeWall: { w: 1, d: 1, h: 1, collide: false },
  railing: { w: 0.08, d: 8, h: 1.0, collide: false },
  pianoBench: { w: 0.9, d: 0.38, h: 0.5, collide: true },
  sweepPanel: { w: 1.1, d: 0.16, h: 0.95, collide: false, wall: true },
  boothPanel: { w: 0.5, d: 0.08, h: 0.4, collide: false, wall: true },
  alarmBell: { w: 0.3, d: 0.15, h: 0.3, collide: false, wall: true },
  speakerHorn: { w: 0.5, d: 0.5, h: 0.5, collide: false, wall: true },
  puddle: { w: 1.6, d: 1.2, h: 0.01, collide: false },
  cableSpool: { w: 0.8, d: 0.5, h: 0.8, collide: true },
  lantern: { w: 0.2, d: 0.2, h: 0.3, collide: false },
};

// Axis-aligned world footprint of a prop (handles arbitrary rotation conservatively).
export function propFootprint(p) {
  const def = PROP_DEFS[p.t];
  if (!def) return null;
  const w = p.w ?? def.w;
  const d = p.d ?? def.d;
  const r = (((p.r || 0) % 360) + 360) % 360;
  let hw, hd;
  if (r === 0 || r === 180) { hw = w / 2; hd = d / 2; }
  else if (r === 90 || r === 270) { hw = d / 2; hd = w / 2; }
  else {
    const a = (r * Math.PI) / 180;
    const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    hw = (w * c + d * s) / 2;
    hd = (w * s + d * c) / 2;
  }
  return { x0: p.x - hw, z0: p.z - hd, x1: p.x + hw, z1: p.z + hd };
}
