// Procedural city layout. Pure data: no three.js. A seeded street grid is split into
// blocks, blocks into lots, lots into buildings described as grids of structural chunks.
// x runs east, z runs south toward the sea, y is up. Units are metres.
import { Rng, clamp } from '../core/Rng.js';

export const STYLE = {
  GLASS: 0, OFFICE: 1, BRICK: 2, DARKGLASS: 3, DECO: 4, INDUSTRIAL: 5, HOUSE: 6, STUCCO: 7, CONCRETE: 8,
};

export const CITY_PRESETS = {
  harbor: { seed: 1337, w: 2600, north: -1250, coast: 880, downtown: [120, -260], dtR: 430, midR: 880, maxH: 300, density: 1.0 },
  metro: { seed: 9001, w: 2900, north: -1500, coast: 880, downtown: [-80, -380], dtR: 560, midR: 1050, maxH: 420, density: 1.15 },
  capital: { seed: 4242, w: 2800, north: -1400, coast: 880, downtown: [200, -500], dtR: 480, midR: 950, maxH: 340, density: 1.05 },
};

export function generateCity(presetName = 'harbor', quality = 1) {
  const P = CITY_PRESETS[presetName] || CITY_PRESETS.harbor;
  const rng = new Rng(P.seed);
  const x0 = -P.w / 2, x1 = P.w / 2, z0 = P.north, coast = P.coast;
  const city = {
    preset: presetName, seed: P.seed, x0, x1, z0, coast, seaZ: coast + 6,
    xRoads: [], zRoads: [], blocks: [], buildings: [], trees: [], lights: [], piers: [], cranes: [],
    containers: [], landmarks: [], parks: [], chunkCount: 0,
  };

  // ---- street grid: alternating blocks and roads, avenues every few blocks
  function lines(a, b, minB, maxB, avenueEvery) {
    const roads = [];
    let p = a, i = 0;
    while (p < b) {
      const avenue = i % avenueEvery === 0;
      const w = avenue ? 32 : 22;
      roads.push({ c: p + w / 2, w, avenue });
      p += w + rng.range(minB, maxB);
      i++;
    }
    return roads;
  }
  city.xRoads = lines(x0, x1, 92, 128, 3);   // roads running north-south (constant x)
  city.zRoads = lines(z0, coast - 30, 76, 104, 3); // roads running east-west (constant z)
  // waterfront boulevard along the seawall
  city.zRoads.push({ c: coast - 14, w: 28, avenue: true, shore: true });

  const dtx = P.downtown[0], dtz = P.downtown[1];
  const inPark = (x, z) => x > -840 && x < -430 && z > -820 && z < -420;

  for (let i = 0; i < city.xRoads.length - 1; i++) {
    for (let j = 0; j < city.zRoads.length - 1; j++) {
      const rx = city.xRoads[i], rx2 = city.xRoads[i + 1], rz = city.zRoads[j], rz2 = city.zRoads[j + 1];
      const b = { x0: rx.c + rx.w / 2, x1: rx2.c - rx2.w / 2, z0: rz.c + rz.w / 2, z1: rz2.c - rz2.w / 2, i, j };
      if (b.x1 - b.x0 < 30 || b.z1 - b.z0 < 30) continue;
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      const d = Math.hypot(cx - dtx, (cz - dtz) * 1.15);
      b.kind = inPark(cx, cz) ? 'park'
        : cz > coast - 150 ? 'port'
          : d < P.dtR ? 'downtown'
            : d < P.midR ? 'midtown' : 'residential';
      if (b.kind === 'downtown' && rng.chance(0.07)) b.kind = 'plaza';
      if (b.kind === 'midtown' && rng.chance(0.05)) b.kind = 'park';
      if (b.kind === 'residential' && rng.chance(0.04)) b.kind = 'park';
      b.d = d;
      city.blocks.push(b);
    }
  }

  // ---- landmark: a broadcast tower in a downtown plaza
  let best = null;
  for (const b of city.blocks) if (b.kind !== 'park' && b.kind !== 'port' && (!best || b.d < best.d)) best = b;
  if (best) { best.kind = 'plaza'; best.landmark = true; }

  const B = city.buildings;
  const sizeOf = (d) => clamp(1 - d / P.dtR, 0, 1);

  function addBuilding(o) {
    // o: x0,z0,w,d,h,style,floorH,bayW,podium?{h,inset}
    const floorH = o.floorH || 3.7;
    const ch = o.style === STYLE.HOUSE ? o.h : o.h > 120 ? floorH * 3 : Math.max(floorH * 2, Math.min(9, floorH * Math.round(8 / floorH)));
    const ny = Math.max(1, Math.round(o.h / ch));
    const h = ny * ch;
    const target = o.style === STYLE.HOUSE ? 40 : o.h > 120 ? 13 : o.h > 50 ? 11 : 10;
    const nx = Math.max(1, Math.round(o.w / target)), nz = Math.max(1, Math.round(o.d / target));
    const bld = {
      id: B.length, x0: o.x0, z0: o.z0, w: o.w, d: o.d, h, nx, ny, nz, cw: o.w / nx, ch, cd: o.d / nz,
      style: o.style, seed: rng.next(), floorH, bayW: o.bayW || 3.2, kind: o.kind,
      tint: [rng.range(0.85, 1.12), rng.range(0.9, 1.08), rng.range(0.88, 1.1)],
      voids: null, roof: o.roof || null, start: 0,
    };
    // setbacks: the tower above the podium keeps an inset footprint
    if (o.podium) {
      const py = Math.max(1, Math.round(o.podium / ch));
      const ix = Math.min(Math.floor((nx - 1) / 2), o.inset || 1), iz = Math.min(Math.floor((nz - 1) / 2), o.inset || 1);
      if (ix > 0 || iz > 0) {
        bld.voids = new Uint8Array(nx * ny * nz);
        for (let y = py; y < ny; y++) for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
          if (x < ix || x >= nx - ix || z < iz || z >= nz - iz) bld.voids[(y * nz + z) * nx + x] = 1;
        }
      }
      // second step near the crown of very tall towers
      if (o.crown && nx - 2 * ix > 2 && nz - 2 * iz > 2) {
        const cy = Math.floor(ny * 0.82);
        for (let y = cy; y < ny; y++) for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
          if (x < ix + 1 || x >= nx - ix - 1 || z < iz + 1 || z >= nz - iz - 1) bld.voids[(y * nz + z) * nx + x] = 1;
        }
      }
    }
    B.push(bld);
    return bld;
  }

  const towerStyles = [[STYLE.GLASS, 5], [STYLE.DARKGLASS, 3], [STYLE.OFFICE, 2], [STYLE.DECO, 1.4]];
  const midStyles = [[STYLE.OFFICE, 4], [STYLE.BRICK, 3], [STYLE.GLASS, 1.6], [STYLE.DECO, 1.2], [STYLE.STUCCO, 1.5], [STYLE.DARKGLASS, 0.6]];

  for (const b of city.blocks) {
    const bw = b.x1 - b.x0, bd = b.z1 - b.z0;
    const sw = 5; // sidewalk
    const ix0 = b.x0 + sw, iz0 = b.z0 + sw, iw = bw - 2 * sw, id = bd - 2 * sw;
    if (b.kind === 'park') {
      city.parks.push(b);
      const n = Math.floor(bw * bd / 260 * quality);
      for (let k = 0; k < n; k++) {
        const x = rng.range(ix0, ix0 + iw), z = rng.range(iz0, iz0 + id);
        city.trees.push({ x, z, s: rng.range(0.75, 1.35), t: rng.int(0, 2) });
      }
      continue;
    }
    if (b.kind === 'plaza') {
      if (b.landmark) {
        // broadcast tower: a concrete shaft with a glazed observation pod near the top
        const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
        const t = addBuilding({ x0: cx - 22, z0: cz - 22, w: 44, d: 44, h: 300, style: STYLE.CONCRETE, floorH: 4.5, bayW: 3.2, kind: 'landmark', roof: 'mast' });
        const ny = t.ny, nx = t.nx, nz = t.nz;
        t.voids = new Uint8Array(nx * ny * nz);
        const podA = Math.floor(ny * 0.74), podB = podA + 2;
        for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
          const core = x >= 1 && x <= nx - 2 && z >= 1 && z <= nz - 2;
          const pod = y >= podA && y <= podB;
          const base = y < 2 && x >= 0 && z >= 0;
          if (!(core || pod || base)) t.voids[(y * nz + z) * nx + x] = 1;
        }
        t.pod = [podA, podB];
        t.landmark = true;
        city.landmarks.push({ kind: 'tower', x: cx, z: cz, h: t.h, id: t.id });
      }
      for (let k = 0; k < 10; k++) {
        const t = k / 10 * Math.PI * 2;
        city.trees.push({ x: (b.x0 + b.x1) / 2 + Math.cos(t) * Math.min(bw, bd) * 0.38, z: (b.z0 + b.z1) / 2 + Math.sin(t) * Math.min(bw, bd) * 0.38, s: 0.8, t: 1 });
      }
      continue;
    }
    if (b.kind === 'downtown') {
      const k = sizeOf(b.d);
      const splitX = bw > 100 && rng.chance(0.65) ? 2 : 1, splitZ = bd > 80 && rng.chance(0.5) ? 2 : 1;
      const lw = iw / splitX, ld = id / splitZ;
      for (let a = 0; a < splitX; a++) for (let c = 0; c < splitZ; c++) {
        const gap = 4;
        const w = lw - gap, d = ld - gap;
        const x = ix0 + a * lw + gap / 2, z = iz0 + c * ld + gap / 2;
        const tall = 70 + Math.pow(rng.next(), 1.6) * (P.maxH - 70) * (0.35 + 0.65 * k);
        const style = rng.weighted(towerStyles);
        const podium = tall > 110 && rng.chance(0.75) ? rng.range(14, 26) : 0;
        addBuilding({ x0: x, z0: z, w, d, h: tall, style, floorH: style === STYLE.DECO ? 4.0 : 3.8, bayW: style === STYLE.GLASS ? 3.0 : 3.4,
          podium, inset: 1, crown: tall > 200 && rng.chance(0.6), kind: 'tower', roof: tall > 160 && rng.chance(0.5) ? 'spire' : 'mech' });
      }
      continue;
    }
    if (b.kind === 'midtown') {
      // perimeter row buildings along the two long sides, courtyard in the middle
      const along = bw >= bd;
      const len = along ? iw : id, depth = Math.min(along ? id : iw, 36);
      for (const side of [0, 1]) {
        let p = 0;
        while (p < len - 8) {
          const lw = Math.min(len - p, rng.range(18, 42));
          const d = Math.min(depth * rng.range(0.7, 1.0), (along ? id : iw) / 2 - 1);
          const h = 14 + Math.pow(rng.next(), 1.3) * 70 * (0.7 + 0.6 * clamp(1 - (b.d - P.dtR) / (P.midR - P.dtR), 0, 1));
          const style = rng.weighted(midStyles);
          const fx = along ? ix0 + p : side ? ix0 + iw - d : ix0;
          const fz = along ? (side ? iz0 + id - d : iz0) : iz0 + p;
          addBuilding({ x0: fx, z0: fz, w: along ? lw - 1.2 : d, d: along ? d : lw - 1.2, h, style,
            floorH: style === STYLE.BRICK ? 3.3 : 3.6, bayW: style === STYLE.BRICK ? 3.6 : 3.3, kind: 'mid', roof: rng.chance(0.4) ? 'tank' : 'mech' });
          p += lw;
        }
      }
      for (let k = 0; k < 3 * quality; k++) city.trees.push({ x: rng.range(ix0 + 20, ix0 + iw - 20), z: rng.range(iz0 + 18, iz0 + id - 18), s: 0.8, t: rng.int(0, 2) });
      continue;
    }
    if (b.kind === 'residential') {
      // houses around the perimeter facing the streets, small apartment blocks mixed in
      const lotW = rng.range(15, 20), lotD = Math.min(26, id / 2 - 1);
      for (const side of [0, 1]) {
        for (let p = 0; p + lotW <= iw; p += lotW) {
          if (rng.chance(0.08)) continue;
          if (rng.chance(0.12)) {
            addBuilding({ x0: ix0 + p + 1, z0: side ? iz0 + id - lotD : iz0, w: lotW * 2 - 2, d: lotD - 2, h: rng.range(10, 20), style: rng.pick([STYLE.BRICK, STYLE.STUCCO]), floorH: 3.2, bayW: 3.4, kind: 'apt', roof: 'flat' });
            p += lotW;
            continue;
          }
          const hw = lotW * rng.range(0.55, 0.75), hd = lotD * rng.range(0.45, 0.62);
          const hx = ix0 + p + (lotW - hw) / 2, hz = side ? iz0 + id - lotD + rng.range(2, 5) : iz0 + lotD - hd - rng.range(2, 5);
          addBuilding({ x0: hx, z0: hz, w: hw, d: hd, h: rng.chance(0.6) ? 7 : 4.2, style: STYLE.HOUSE, floorH: 3.0, bayW: 3.0, kind: 'house', roof: 'gable' });
          if (rng.chance(0.7)) city.trees.push({ x: ix0 + p + rng.range(2, lotW - 2), z: side ? iz0 + id - rng.range(1, 4) : iz0 + rng.range(1, 4), s: rng.range(0.6, 1.0), t: rng.int(0, 2) });
        }
      }
      continue;
    }
    if (b.kind === 'port') {
      // warehouses, container yards
      let p = 0;
      while (p < iw - 20) {
        const lw = Math.min(iw - p, rng.range(40, 80));
        if (rng.chance(0.55)) {
          addBuilding({ x0: ix0 + p + 2, z0: iz0 + 2, w: lw - 4, d: Math.min(id - 4, rng.range(28, 45)), h: rng.range(10, 18), style: STYLE.INDUSTRIAL, floorH: 6, bayW: 6, kind: 'warehouse', roof: 'flat' });
        } else {
          for (let cx = ix0 + p + 3; cx < ix0 + p + lw - 13; cx += 13.2) for (let cz = iz0 + 3; cz < iz0 + id - 3; cz += 3.0) {
            const stack = rng.int(1, 4);
            for (let s = 0; s < stack; s++) city.containers.push({ x: cx + 6.1, z: cz + 1.25, y: s * 2.6, c: rng.int(0, 5), r: 0 });
          }
        }
        p += lw;
      }
    }
  }

  // piers and cranes on the waterfront
  for (let x = x0 + 200; x < x1 - 200; x += rng.range(260, 420)) {
    const w = rng.range(60, 90), len = rng.range(140, 220);
    city.piers.push({ x0: x, x1: x + w, z0: coast, z1: coast + len });
    for (let k = 0; k < 2; k++) city.cranes.push({ x: x + w * (0.3 + 0.4 * k), z: coast + len * rng.range(0.35, 0.8), rot: 0 });
  }

  // street lights and street trees along every road
  for (const r of city.xRoads) for (let z = z0; z < coast - 20; z += 38) {
    city.lights.push({ x: r.c - r.w / 2 - 1.2, z, rot: 0 }, { x: r.c + r.w / 2 + 1.2, z: z + 19, rot: Math.PI });
  }
  for (const r of city.zRoads) for (let x = x0; x < x1; x += 38) {
    city.lights.push({ x, z: r.c - r.w / 2 - 1.2, rot: Math.PI / 2 }, { x: x + 19, z: r.c + r.w / 2 + 1.2, rot: -Math.PI / 2 });
  }
  // drop lights that ended up on a crossing road, in the sea or inside a building
  city.lights = city.lights.filter((l) => l.z < coast - 4 && !onRoad(city, l.x, l.z) && !inBuilding(city, l.x, l.z, 1.5));

  let n = 0;
  for (const b of B) { b.start = n; n += b.nx * b.ny * b.nz; }
  city.chunkCount = n;
  return city;
}

function onRoad(city, x, z) {
  for (const r of city.xRoads) if (Math.abs(x - r.c) < r.w / 2) return true;
  for (const r of city.zRoads) if (Math.abs(z - r.c) < r.w / 2) return true;
  return false;
}

function inBuilding(city, x, z, pad) {
  for (const b of city.buildings) {
    if (x > b.x0 - pad && x < b.x0 + b.w + pad && z > b.z0 - pad && z < b.z0 + b.d + pad) return true;
  }
  return false;
}

// Road lookup used by traffic, the ground shader and spawners.
export function roadAt(city, x, z) {
  for (const r of city.xRoads) if (Math.abs(x - r.c) < r.w / 2) return { axis: 'z', r };
  for (const r of city.zRoads) if (Math.abs(z - r.c) < r.w / 2) return { axis: 'x', r };
  return null;
}
