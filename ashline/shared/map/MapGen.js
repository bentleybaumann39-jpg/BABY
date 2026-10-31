// Deterministic map generation for the Kessler Valley. Server, client and practice mode all call
// generateMap(seed) and get identical terrain, buildings, trees and loot spots.
import { HM_N, HM_CELL, HM_CELLS, MAP_HALF, WATER_LEVEL, DEFAULT_MAP_SEED } from '../constants.js';
import { Rng, makeNoise, smoothstep, lerp, clamp, distToSegment } from '../rng.js';
import { instantiate, templateBBox, MAT } from './Buildings.js';

export const POIS = [
  { id: 'fort', name: 'Fort Grail', x: 300, z: -280, r: 78, tier: 3 },
  { id: 'oldtown', name: 'Old Marrow', x: -150, z: 40, r: 88, tier: 2 },
  { id: 'quarry', name: 'Cinder Quarry', x: -320, z: 300, r: 66, tier: 2, kind: 'pit', dh: -9 },
  { id: 'radio', name: 'Radio Ridge', x: -40, z: -360, r: 50, tier: 2, kind: 'hill', dh: 20 },
  { id: 'farm', name: 'Kessler Farm', x: 260, z: 130, r: 60, tier: 1 },
  { id: 'rail', name: 'Rail Yard', x: 80, z: 340, r: 72, tier: 2 },
  { id: 'hamlet', name: 'Pine Hamlet', x: -360, z: -210, r: 56, tier: 1, wooded: true },
  { id: 'mill', name: 'Millrace', x: 160, z: -80, r: 52, tier: 1 },
];

const RIVER = [[30, -620], [60, -420], [34, -250], [86, -130], [46, 0], [-6, 140], [16, 250], [-24, 400], [-14, 620]];

const ROAD_LINKS = [['fort', 'mill'], ['mill', 'oldtown'], ['oldtown', 'hamlet'], ['oldtown', 'quarry'], ['mill', 'farm'],
  ['farm', 'rail'], ['rail', 'oldtown'], ['radio', 'mill'], ['radio', 'hamlet'], ['quarry', 'rail'], ['fort', 'farm']];

// POI layouts: [template, dx, dz, rot, variant]
function layout(id) {
  const L = [];
  const P = (t, x, z, r = 0, v = 0) => L.push([t, x, z, r, v]);
  switch (id) {
    case 'fort': {
      for (const s of [-1, 1]) for (const c of [12, 24, 36, 46]) {
        P('fortwall', s * c, -48, 0); P('fortwall', s * c, 48, 0); P('fortwall', -48, s * c, 1); P('fortwall', 48, s * c, 1);
      }
      P('barracks', -30, -20); P('barracks', -18, -20); P('barracks', -6, -20);
      P('warehouse', 24, 18, 1); P('warehouse', 24, -22, 1);
      P('tower', -40, -40, 0); P('tower', 40, -40, 1); P('tower', 40, 40, 2); P('tower', -40, 40, 3);
      P('radiohut', -28, 22, 0); P('house2', -8, 26, 2, 0);
      P('container', 2, 2, 0, 0); P('container', 5, 2, 0, 1); P('container', -2, 6, 1, 1);
      P('sandbags', 0, -40, 0); P('sandbags', 0, 41, 0); P('sandbags', -40, 0, 1); P('sandbags', 41, 0, 1);
      P('crates', -6, 8); P('crates', 10, -4); P('barrels', -14, 5); P('car', -22, 6, 1); P('car', 8, 38, 0);
      break;
    }
    case 'oldtown': {
      const xs = [-70, -56, -42, -28, 28, 42, 56, 70];
      xs.forEach((x, i) => { P(i % 3 === 1 ? 'house2' : 'house', x, -11, 0, i); P(i % 3 === 2 ? 'house2' : 'house', x, 11, 2, i + 1); });
      const zs = [-70, -56, -42, 42, 56, 70];
      zs.forEach((z, i) => { P(i % 2 ? 'house2' : 'house', -11, z, 3, i); P(i % 3 === 0 ? 'house2' : 'house', 11, z, 1, i + 1); });
      P('church', 22, -30, 0);
      P('car', -20, -2, 1); P('car', 36, 3, 1); P('car', 2, 20, 0); P('barrels', -22, 22); P('crates', 22, 22);
      break;
    }
    case 'quarry': {
      P('warehouse', -20, 10, 0); P('shed', 10, -20); P('shed', 16, -20); P('container', 20, 10, 1, 1); P('container', 20, 14, 1, 0);
      P('house', 5, 30, 2, 1); P('tower', 30, -30, 0); P('crates', -2, -8); P('barrels', 8, 2); P('crates', 30, 24);
      P('container', -36, -24, 0, 1); P('car', 0, 14, 1);
      break;
    }
    case 'radio': {
      P('radiohut', -12, 0, 0); P('radiohut', 12, 10, 2); P('tower', 0, -22, 0); P('shed', 22, -10, 1);
      P('barracks', -24, 22, 1); P('crates', 4, -4); P('sandbags', -4, 14, 0); P('barrels', 18, 2);
      break;
    }
    case 'farm': {
      P('barn', -18, 0, 0); P('barn', 14, -16, 1); P('house2', 14, 14, 2, 1); P('silo', -5, -26); P('silo', 0, -26);
      P('shed', -16, 22, 0); P('shed', 30, 6, 1); P('house', -30, -26, 0, 0); P('car', 0, 4, 0); P('crates', 2, 26); P('barrels', -6, -12);
      break;
    }
    case 'rail': {
      P('warehouse', -30, -14, 1); P('warehouse', 24, -14, 1);
      for (const x of [-40, -25, -10, 10, 25]) P('railcar', x, 8, 1);
      for (const x of [-32, -2, 30]) P('railcar', x, 16, 1);
      P('radiohut', 0, -30, 0); P('container', 46, -32, 0, 1); P('container', 49, -32, 0, 0); P('container', 46, 26, 1, 0);
      P('crates', -50, 0); P('barrels', 44, 2); P('house', -50, 26, 2, 2); P('shed', 0, 28, 2);
      break;
    }
    case 'hamlet': {
      P('cabin', -20, -14, 0); P('cabin', 0, -20, 0); P('cabin', 18, -10, 1); P('cabin', -24, 10, 3);
      P('cabin', 4, 4, 2); P('cabin', 22, 18, 2); P('cabin', -6, 26, 0); P('shed', 12, -30); P('house', -38, -4, 3, 1);
      break;
    }
    case 'mill': {
      P('house', -20, -12, 0, 0); P('house', -8, -12, 0, 1); P('house', 4, -12, 0, 2); P('house2', 18, -12, 0, 1);
      P('house', -14, 12, 2, 3); P('house2', 2, 12, 2, 0); P('barn', 24, 18, 2); P('silo', -30, 4); P('car', -2, 0, 1);
      break;
    }
  }
  return L;
}

export function generateMap(seed = DEFAULT_MAP_SEED) {
  const rng = new Rng(seed);
  const N = makeNoise(seed);
  const pois = POIS.map(p => ({ ...p }));

  // ---- roads (polylines between POIs with a jittered midpoint) ----
  const byId = Object.fromEntries(pois.map(p => [p.id, p]));
  const roads = ROAD_LINKS.map(([a, b]) => {
    const A = byId[a], B = byId[b];
    const pts = [[A.x, A.z]];
    const segs = 4;
    const nx = -(B.z - A.z), nz = B.x - A.x, nl = Math.hypot(nx, nz);
    const bend = rng.range(-0.12, 0.12);
    for (let i = 1; i < segs; i++) {
      const t = i / segs, s = Math.sin(t * Math.PI) * bend * nl;
      pts.push([lerp(A.x, B.x, t) + (nx / nl) * s + rng.range(-8, 8), lerp(A.z, B.z, t) + (nz / nl) * s + rng.range(-8, 8)]);
    }
    pts.push([B.x, B.z]);
    return { pts, w: 5 };
  });

  // ---- height pipeline ----
  const base = (x, z) => {
    const n = N.fbm(x / 380 + 11.3, z / 380 - 7.1, 5);
    const d = N.fbm(x / 90 + 3.3, z / 90 + 1.7, 3);
    const r = N.ridged(x / 520 + 3, z / 520 + 9, 4);
    let h = 18 + n * 26 + d * 2.6 + (r - 0.5) * 22;
    const e = Math.pow(Math.pow(Math.abs(x), 4) + Math.pow(Math.abs(z), 4), 0.25) / MAP_HALF;
    h += smoothstep(0.78, 1.08, e) * 70;
    return h;
  };
  const riverDist = (x, z) => {
    let best = 1e9;
    for (let i = 0; i < RIVER.length - 1; i++) {
      const d = distToSegment(x, z, RIVER[i][0], RIVER[i][1], RIVER[i + 1][0], RIVER[i + 1][1]).d;
      if (d < best) best = d;
    }
    return best;
  };
  for (const p of pois) p.y = Math.max(base(p.x, p.z), WATER_LEVEL + 3) + (p.dh || 0);
  const withPoiOnly = (x, z) => {
    let h = base(x, z);
    for (const p of pois) {
      const d = Math.hypot(x - p.x, z - p.z);
      let w;
      if (p.kind === 'hill') w = 1 - smoothstep(p.r * 0.9, p.r * 2.8, d);
      else if (p.kind === 'pit') w = 1 - smoothstep(p.r * 0.95, p.r * 1.25, d);
      else w = 1 - smoothstep(p.r * 0.9, p.r * 1.8, d);
      if (w > 0) h = lerp(h, p.y + N.noise(x / 14, z / 14) * 0.25, w);
    }
    return h;
  };
  const withPoi = (x, z) => {
    let h = withPoiOnly(x, z);
    const rd = riverDist(x, z);
    if (rd < 60) {
      const bed = lerp(0.7, 3.4, smoothstep(4, 10, rd));
      h = lerp(bed, Math.max(h, 3.4), smoothstep(10, 60, rd));
    }
    if (rd > 10) h = Math.max(h, WATER_LEVEL + 0.9);
    return h;
  };
  const roadNear = (x, z) => {
    let best = { d: 1e9 };
    for (const r of roads) for (let i = 0; i < r.pts.length - 1; i++) {
      const s = distToSegment(x, z, r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1]);
      if (s.d < best.d) best = s;
    }
    return best;
  };

  const heights = new Float32Array(HM_N * HM_N);
  for (let j = 0; j < HM_N; j++) for (let i = 0; i < HM_N; i++) {
    const x = -MAP_HALF + i * HM_CELL, z = -MAP_HALF + j * HM_CELL;
    let h = withPoi(x, z);
    const rn = roadNear(x, z);
    if (rn.d < 8) h = lerp(h, withPoi(rn.cx, rn.cz), (1 - smoothstep(3.5, 8, rn.d)) * 0.9);
    heights[j * HM_N + i] = h;
  }

  const hAt = (x, z) => sampleHeight(heights, x, z);

  // ---- buildings ----
  const buildings = [];
  const bboxes = []; // [minx, minz, maxx, maxz]
  const overlaps = (bb, m) => bboxes.some(o => bb[0] - m < o[2] && bb[2] + m > o[0] && bb[1] - m < o[3] && bb[3] + m > o[1]);
  const place = (tpl, x, z, r, v, tier, poi) => {
    const bb = templateBBox(tpl, r);
    const wb = [bb[0] + x, bb[1] + z, bb[2] + x, bb[3] + z];
    buildings.push({ tpl, x, z, r, v, tier, poi, bb: wb });
    bboxes.push(wb);
  };
  for (const p of pois) for (const [t, dx, dz, r, v] of layout(p.id)) place(t, Math.round(p.x + dx), Math.round(p.z + dz), r, v, p.tier, p.id);

  // scattered cabins / sheds / farmhouses
  let tries = 0, placed = 0;
  while (placed < 30 && tries++ < 3000) {
    const x = Math.round(rng.range(-450, 450)), z = Math.round(rng.range(-450, 450));
    if (pois.some(p => Math.hypot(x - p.x, z - p.z) < p.r + 24)) continue;
    if (riverDist(x, z) < 28) continue;
    if (roadNear(x, z).d < 12) continue;
    const tpl = rng.weighted([['cabin', 4], ['shed', 3], ['house', 2], ['barn', 1]]);
    const r = rng.int(0, 3);
    const bb = templateBBox(tpl, r);
    const wb = [bb[0] + x, bb[1] + z, bb[2] + x, bb[3] + z];
    if (overlaps(wb, 8)) continue;
    // slope check
    const hs = [hAt(wb[0], wb[1]), hAt(wb[2], wb[1]), hAt(wb[0], wb[3]), hAt(wb[2], wb[3])];
    if (Math.max(...hs) - Math.min(...hs) > 3.5) continue;
    place(tpl, x, z, r, rng.int(0, 3), 1, null);
    placed++;
  }
  // wrecks along roads
  for (let i = 0; i < 26; i++) {
    const road = roads[rng.int(0, roads.length - 1)];
    const k = rng.int(0, road.pts.length - 2);
    const t = rng.range(0.15, 0.85);
    const ax = road.pts[k][0], az = road.pts[k][1], bx = road.pts[k + 1][0], bz = road.pts[k + 1][1];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const side = rng.chance(0.5) ? 1 : -1;
    const x = Math.round(lerp(ax, bx, t) + (-(bz - az) / len) * 4 * side), z = Math.round(lerp(az, bz, t) + ((bx - ax) / len) * 4 * side);
    if (pois.some(p => Math.hypot(x - p.x, z - p.z) < p.r)) continue;
    if (riverDist(x, z) < 12) continue;
    const r = Math.abs(bx - ax) > Math.abs(bz - az) ? 1 : 0;
    const bb = templateBBox('car', r);
    if (overlaps([bb[0] + x, bb[1] + z, bb[2] + x, bb[3] + z], 2)) continue;
    place(rng.chance(0.85) ? 'car' : 'barrels', x, z, r, 0, 1, null);
  }

  // ---- terrain pads under buildings ----
  for (const b of buildings) {
    if (b.tpl === 'fortwall' || ['car', 'container', 'railcar', 'crates', 'sandbags', 'barrels'].includes(b.tpl)) continue;
    const [x0, z0, x1, z1] = b.bb;
    let sum = 0, n = 0;
    for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 4) for (let z = z0; z <= z1 + 0.01; z += (z1 - z0) / 4) { sum += hAt(x, z); n++; }
    const padH = sum / n;
    b.pad = padH;
    const i0 = Math.max(0, Math.floor((x0 - 12 + MAP_HALF) / HM_CELL)), i1 = Math.min(HM_CELLS, Math.ceil((x1 + 12 + MAP_HALF) / HM_CELL));
    const j0 = Math.max(0, Math.floor((z0 - 12 + MAP_HALF) / HM_CELL)), j1 = Math.min(HM_CELLS, Math.ceil((z1 + 12 + MAP_HALF) / HM_CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = -MAP_HALF + i * HM_CELL, z = -MAP_HALF + j * HM_CELL;
      const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1);
      const d = Math.hypot(dx, dz);
      const w = 1 - smoothstep(2.5, 11, d);
      if (w > 0) { const k = j * HM_N + i; heights[k] = lerp(heights[k], padH - 0.12, w); }
    }
  }

  // ---- instantiate building geometry ----
  const boxList = [];   // [minx,miny,minz,maxx,maxy,maxz,mat,owner]
  const lootSpots = [];
  const terminals = [];
  buildings.forEach((b, bi) => {
    let y;
    if (b.pad !== undefined) y = b.pad;
    else {
      const [x0, z0, x1, z1] = b.bb;
      y = Math.min(hAt(x0, z0), hAt(x1, z0), hAt(x0, z1), hAt(x1, z1), hAt(b.x, b.z)) - 0.04;
    }
    const inst = instantiate(b.tpl, b.x, b.z, b.r, y, b.v || 0);
    b.y = y; b.prop = inst.prop; b.deco = inst.deco;
    b.boxStart = boxList.length;
    for (const bx of inst.boxes) { bx.push(bi); boxList.push(bx); }
    b.boxEnd = boxList.length;
    for (const l of inst.loot) lootSpots.push({ x: l[0], y: l[1], z: l[2], tier: b.tier, poi: b.poi });
    for (const t of inst.terms) terminals.push({ x: t[0], y: t[1], z: t[2], poi: b.poi });
  });

  // ---- vegetation and rocks ----
  const inBuilding = (x, z, m) => bboxes.some(o => x > o[0] - m && x < o[2] + m && z > o[1] - m && z < o[3] + m);
  const trees = [];   // x, y, z, scale, type
  const bushes = [];
  const rocks = [];
  const vrng = new Rng(seed ^ 0x51ed);
  for (let i = 0; i < 30000 && trees.length < 3400; i++) {
    const x = vrng.range(-505, 505), z = vrng.range(-505, 505);
    const forest = N.fbm(x / 150 + 40, z / 150 - 20, 3);
    let p = smoothstep(-0.05, 0.3, forest) * 0.95 + 0.025;
    const poi = pois.find(q => Math.hypot(x - q.x, z - q.z) < q.r * 0.95);
    if (poi && !poi.wooded) continue;
    if (poi && poi.wooded) p = 0.7;
    if (vrng.next() > p) continue;
    if (riverDist(x, z) < 11) continue;
    if (roadNear(x, z).d < 5.5) continue;
    if (inBuilding(x, z, 3)) continue;
    const y = hAt(x, z);
    const type = y > 34 ? (vrng.chance(0.85) ? 0 : 2) : vrng.weighted([[0, 6], [1, 3], [2, 1]]);
    trees.push([x, y, z, vrng.range(0.75, 1.35), type]);
  }
  for (let i = 0; i < 2200; i++) {
    const x = vrng.range(-505, 505), z = vrng.range(-505, 505);
    if (inBuilding(x, z, 1.5) || roadNear(x, z).d < 4 || riverDist(x, z) < 7) continue;
    bushes.push([x, hAt(x, z), z, vrng.range(0.6, 1.5), vrng.int(0, 2)]);
  }
  for (let i = 0; i < 900 && rocks.length < 280; i++) {
    const x = vrng.range(-500, 500), z = vrng.range(-500, 500);
    if (pois.some(q => Math.hypot(x - q.x, z - q.z) < q.r * 0.8 && q.kind !== 'pit')) continue;
    if (inBuilding(x, z, 4) || roadNear(x, z).d < 6 || riverDist(x, z) < 9) continue;
    const s = vrng.range(0.8, 2.6);
    rocks.push([x, hAt(x, z), z, s, vrng.int(0, 1e6)]);
  }
  for (const t of trees) {
    const w = 0.22 + 0.12 * t[3];
    boxList.push([t[0] - w, t[1] - 0.5, t[2] - w, t[0] + w, t[1] + 9 * t[3], t[2] + w, MAT.bark, -2]);
  }
  for (const r of rocks) {
    const s = r[3];
    boxList.push([r[0] - s * 0.8, r[1] - 0.6, r[2] - s * 0.8, r[0] + s * 0.8, r[1] + s * 0.95, r[2] + s * 0.8, MAT.rock, -3]);
  }

  const boxes = new Float32Array(boxList.length * 6);
  const boxMat = new Uint8Array(boxList.length);
  const boxOwner = new Int16Array(boxList.length);
  boxList.forEach((b, i) => { for (let k = 0; k < 6; k++) boxes[i * 6 + k] = b[k]; boxMat[i] = b[6]; boxOwner[i] = b[7]; });

  return {
    seed, heights, water: WATER_LEVEL, river: RIVER, roads, pois, buildings, boxes, boxMat, boxOwner,
    trees, bushes, rocks, lootSpots, terminals,
    heightAt: (x, z) => sampleHeight(heights, x, z),
    farHeight: (x, z) => base(x, z),
    riverDist, roadDist: (x, z) => roadNear(x, z).d,
  };
}

// Triangle interpolation matching the render mesh split: (00,01,10) and (10,01,11).
export function sampleHeight(heights, x, z) {
  let fx = (x + MAP_HALF) / HM_CELL, fz = (z + MAP_HALF) / HM_CELL;
  fx = clamp(fx, 0, HM_CELLS - 1e-6); fz = clamp(fz, 0, HM_CELLS - 1e-6);
  const i = Math.floor(fx), j = Math.floor(fz);
  const tx = fx - i, tz = fz - j;
  const k = j * HM_N + i;
  const h00 = heights[k], h10 = heights[k + 1], h01 = heights[k + HM_N], h11 = heights[k + HM_N + 1];
  if (tx + tz <= 1) return h00 + (h10 - h00) * tx + (h01 - h00) * tz;
  return h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
}
