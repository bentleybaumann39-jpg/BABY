// Builds the static 2.5D level geometry from map data: floors, ceilings, walls (with wainscot bands),
// lintels/risers, stairs, windows, fences, Chamber Zero wedges, the ground and the forest.
// Geometry is batched per material and spatial chunk, with baked vertex AO.
import * as THREE from 'three';
import { CELL, ZONES, FACADE_TOP } from './MapData.js';
import { textureScale } from './Textures.js';

const CHUNK = 22;
const WAINSCOT = 1.0;
const TRIM = 0.12;

class Batch {
  constructor(matKey) {
    this.matKey = matKey;
    this.pos = []; this.nrm = []; this.uv = []; this.col = []; this.idx = [];
    this.n = 0;
  }
  quad(p, n, uv, c) {
    // p: 4 corners [x,y,z] CCW from front; uv: 4 [u,v]; c: 4 AO scalars
    const b = this.n;
    for (let k = 0; k < 4; k++) {
      this.pos.push(p[k][0], p[k][1], p[k][2]);
      this.nrm.push(n[0], n[1], n[2]);
      this.uv.push(uv[k][0], uv[k][1]);
      const a = c ? c[k] : 1;
      this.col.push(a, a, a);
    }
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    this.n += 4;
  }
  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

export class LevelBuilder {
  constructor(map, mats) {
    this.map = map;
    this.mats = mats;
    this.batches = new Map();
  }

  batch(matKey, x, z) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const k = `${matKey}|${cx},${cz}`;
    let b = this.batches.get(k);
    if (!b) { b = new Batch(matKey); this.batches.set(k, b); }
    return b;
  }

  cell(x, z) {
    const m = this.map;
    if (!m.inb(x, z)) return null;
    const i = m.idx(x, z);
    return { i, t: m.type[i], f: m.floorH[i], c: m.ceilH[i], zc: m.zone[i] ? String.fromCharCode(m.zone[i]) : null };
  }

  isSolid(x, z) {
    const m = this.map;
    if (!m.inb(x, z)) return true;
    return m.type[m.idx(x, z)] === CELL.SOLID;
  }

  rampAt(x, z) {
    for (const r of this.map.ramps) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r;
    return null;
  }

  // Floor height at a cell corner-edge position for ramps; otherwise flat cell height.
  hAt(x, z, wx, wz) {
    const r = this.rampAt(x, z);
    if (r) {
      const t = (wz - r.zA) / (r.zB - r.zA);
      return r.hA + (r.hB - r.hA) * Math.min(1, Math.max(0, t));
    }
    return this.map.floorH[this.map.idx(x, z)];
  }

  // Vertex AO for a floor/ceiling corner at integer (vx, vz).
  cornerAO(vx, vz) {
    let s = 0;
    if (this.isSolid(vx - 1, vz - 1)) s++;
    if (this.isSolid(vx, vz - 1)) s++;
    if (this.isSolid(vx - 1, vz)) s++;
    if (this.isSolid(vx, vz)) s++;
    return [1, 0.78, 0.6, 0.5, 0.5][s];
  }

  build() {
    const m = this.map;
    for (let z = 0; z < m.H; z++) {
      for (let x = 0; x < m.W; x++) {
        const c = this.cell(x, z);
        if (c.t === CELL.SOLID) continue;
        this.buildCell(x, z, c);
      }
    }
    const group = new THREE.Group();
    group.name = 'level';
    for (const b of this.batches.values()) {
      if (b.n === 0) continue;
      const mesh = new THREE.Mesh(b.toGeometry(), this.mats.surface(b.matKey));
      mesh.receiveShadow = true;
      mesh.castShadow = b.matKey !== 'wireGrid';
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.userData.static = true;
      group.add(mesh);
    }
    return group;
  }

  zoneDef(zc) { return ZONES[zc] || null; }

  wallStyle(zc) {
    const zd = this.zoneDef(zc);
    if (!zd) return ['concrete', 'concrete', 'concrete'];
    if (zd.ext) return ['facade', 'facade', 'facade'];
    return zd.wall || ['paint', 'paint', 'darkTile'];
  }

  buildCell(x, z, c) {
    const zd = this.zoneDef(c.zc);
    const ext = !!zd?.ext;
    const ramp = this.rampAt(x, z);
    const isDoor = c.t === CELL.DOOR;
    const isWin = c.t === CELL.WINDOW;

    // ---- Floor ----
    if (c.t === CELL.FLOOR || isDoor || c.t === CELL.FENCE || c.t === CELL.FOREST) {
      let fmat = zd?.floorMat || 'concrete';
      if (isDoor) {
        const d = this.map.doors[this.map.doorAt[c.i]];
        if (d && d.style === 'gate') fmat = 'asphalt';
        else if (zd?.ext) fmat = 'concrete';
      }
      if (c.t === CELL.FOREST || c.t === CELL.FENCE) fmat = 'grass';
      if (ramp) this.stairs(x, z, ramp, zd);
      else if (c.zc === 'z' && !isDoor) {
        this.floorQuad(x, z, c.f, 'wireGrid', false);
        this.floorQuad(x, z, -1.45, 'foam', true);
      } else this.floorQuad(x, z, c.f, fmat, true);
    }
    if (isWin) {
      // Sill and lintel underside
      const wmat = this.wallStyle(c.zc)[0];
      this.floorQuad(x, z, c.f, 'concretePaint', true);
      this.ceilQuad(x, z, c.c, wmat, false);
    }

    // ---- Ceiling ----
    if (!ext && (c.t === CELL.FLOOR || isDoor)) {
      const cmat = isDoor ? this.wallStyle(c.zc)[1] : (zd?.ceilMat || 'concrete');
      if (ramp) this.rampCeiling(x, z, ramp, cmat);
      else this.ceilQuad(x, z, c.c, cmat, true);
    }

    // ---- Walls ----
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dz] of dirs) {
      const nx = x + dx, nz = z + dz;
      const nb = this.cell(nx, nz);
      const style = this.wallStyle(c.zc);
      if (!nb || nb.t === CELL.SOLID) {
        // Full wall face from floor to ceiling.
        let bottom = c.f, top = c.c;
        if (ext) { bottom = -0.05; top = FACADE_TOP; }
        if (isWin) { bottom = c.f; top = c.c; }
        if (c.zc === 'z' && !isDoor) bottom = -1.5;
        this.wallFace(x, z, dx, dz, bottom, top, style, ramp, ext, isWin || isDoor);
      } else {
        // Lintel: neighbour's ceiling lower than ours.
        const ourTop = ext ? FACADE_TOP : c.c;
        const theirTop = (ZONES[nb.zc]?.ext && nb.t !== CELL.WINDOW && nb.t !== CELL.DOOR) ? FACADE_TOP : nb.c;
        const nramp = this.rampAt(nx, nz);
        if (!ramp && !nramp && theirTop < ourTop - 0.01 && !(ext && ZONES[nb.zc]?.ext && nb.t !== CELL.WINDOW && nb.t !== CELL.DOOR)) {
          this.wallFace(x, z, dx, dz, theirTop, ourTop, ext ? ['facade', 'facade', 'facade'] : [style[1], style[1], style[1]], null, ext, true);
        }
        // Riser: neighbour's floor higher than ours.
        if (!ramp && !nramp) {
          const ourF = c.f, theirF = nb.f;
          if (theirF > ourF + 0.01) {
            const st = ext ? ['facade', 'facade', 'facade'] : [style[0], style[0], style[0]];
            this.wallFace(x, z, dx, dz, ourF, theirF, st, null, ext, true);
          }
        } else if (ramp && !nramp && nb.t !== CELL.SOLID) {
          // Ramp next to flat floor sideways (no-op) — handled by stairs.
        }
        // Chamber Zero pit sides facing door cells
        if (c.zc === 'z' && nb.zc !== 'z') this.wallFace(x, z, dx, dz, -1.5, nb.f, ['foam', 'foam', 'foam'], null, false, true);
      }
    }
  }

  floorQuad(x, z, h, mat, ao) {
    const b = this.batch(mat, x, z);
    const s = textureScale(mat);
    const p = [[x, h, z], [x, h, z + 1], [x + 1, h, z + 1], [x + 1, h, z]];
    const uv = p.map((q) => [q[0] / s, -q[2] / s]);
    const c = ao ? [this.cornerAO(x, z), this.cornerAO(x, z + 1), this.cornerAO(x + 1, z + 1), this.cornerAO(x + 1, z)] : null;
    b.quad(p, [0, 1, 0], uv, c);
  }

  ceilQuad(x, z, h, mat, ao) {
    const b = this.batch(mat, x, z);
    const s = textureScale(mat);
    const p = [[x, h, z], [x + 1, h, z], [x + 1, h, z + 1], [x, h, z + 1]];
    const uv = p.map((q) => [q[0] / s, q[2] / s]);
    const c = ao ? [this.cornerAO(x, z), this.cornerAO(x + 1, z), this.cornerAO(x + 1, z + 1), this.cornerAO(x, z + 1)].map((a) => 0.35 + a * 0.65) : null;
    b.quad(p, [0, -1, 0], uv, c);
  }

  stairs(x, z, r, zd) {
    // Two treads per cell with risers; the collision ramp runs through the tread centres.
    const steps = 2;
    const run = 1 / steps;
    const dir = Math.sign(r.hB - r.hA) * Math.sign(r.zB - r.zA); // +1: height increases with z
    for (let k = 0; k < steps; k++) {
      const z0 = z + k * run, z1 = z0 + run;
      const hc = this.hAt(x, z, x + 0.5, (z0 + z1) / 2);
      const b = this.batch('concrete', x, z);
      const s = textureScale('concrete');
      const p = [[x, hc, z0], [x, hc, z1], [x + 1, hc, z1], [x + 1, hc, z0]];
      b.quad(p, [0, 1, 0], p.map((q) => [q[0] / s, -q[2] / s]), [0.85, 0.85, 0.85, 0.85]);
      // Riser at the high side of this tread
      const hn = this.hAt(x, z, x + 0.5, dir > 0 ? z1 + run / 2 : z0 - run / 2);
      if (dir > 0) {
        // next tread (higher) at z1: riser faces -z, from hc to hn
        const pr = [[x + 1, hc, z1], [x, hc, z1], [x, hn, z1], [x + 1, hn, z1]];
        this.batch('darkTile', x, z).quad(pr, [0, 0, -1], pr.map((q) => [-q[0] / 1.2, q[1] / 1.2]), [0.6, 0.6, 0.9, 0.9]);
      } else {
        const pr = [[x, hc, z0], [x + 1, hc, z0], [x + 1, hn, z0], [x, hn, z0]];
        this.batch('darkTile', x, z).quad(pr, [0, 0, 1], pr.map((q) => [q[0] / 1.2, q[1] / 1.2]), [0.6, 0.6, 0.9, 0.9]);
      }
    }
  }

  rampCeiling(x, z, r, mat) {
    const b = this.batch(mat, x, z);
    const s = textureScale(mat);
    const h0 = this.hAt(x, z, x, z) + 3.0, h1 = this.hAt(x, z, x, z + 1) + 3.0;
    const p = [[x, h0, z], [x + 1, h0, z], [x + 1, h1, z + 1], [x, h1, z + 1]];
    const ny = 1, nz = (h1 - h0);
    const l = Math.hypot(ny, nz);
    b.quad(p, [0, -ny / l, nz / l], p.map((q) => [q[0] / s, q[2] / s]), [0.6, 0.6, 0.6, 0.6]);
  }

  // Wall face on the edge between cell (x,z) and its neighbour in direction (dx,dz), facing into (x,z).
  wallFace(x, z, dx, dz, bottom, top, style, ramp, ext, simple) {
    if (top - bottom < 0.005) return;
    // Edge endpoints (a -> b) in CCW order seen from inside the cell.
    let ax, az, bx, bz, n;
    if (dx === 1) { ax = x + 1; az = z; bx = x + 1; bz = z + 1; n = [-1, 0, 0]; }
    else if (dx === -1) { ax = x; az = z + 1; bx = x; bz = z; n = [1, 0, 0]; }
    else if (dz === 1) { ax = x + 1; az = z + 1; bx = x; bz = z + 1; n = [0, 0, -1]; }
    else { ax = x; az = z; bx = x + 1; bz = z; n = [0, 0, 1]; }

    // Bottom heights per endpoint (ramps slope; extend 0.25 below to hide tread gaps).
    let ba = bottom, bb = bottom, ta = top, tb = top;
    if (ramp) {
      ba = this.hAt(x, z, ax, az) - 0.3; bb = this.hAt(x, z, bx, bz) - 0.3;
      ta = this.hAt(x, z, ax, az) + 3.0; tb = this.hAt(x, z, bx, bz) + 3.0;
    }

    // Inner-corner AO at endpoints: the perpendicular neighbour on that side is solid.
    const perp = (px, pz) => {
      // Endpoint (px,pz) is a cell corner; an inner corner exists if the cell beside us along the wall is solid.
      if (dx !== 0) return this.isSolid(x, pz > z + 0.5 ? z + 1 : z - 1);
      return this.isSolid(px > x + 0.5 ? x + 1 : x - 1, z);
    };
    const cornerA = perp(ax, az) ? 0.72 : 1;
    const cornerB = perp(bx, bz) ? 0.72 : 1;

    const tangentU = (px, pz) => {
      if (n[2] === 1) return px;
      if (n[2] === -1) return -px;
      if (n[0] === 1) return -pz;
      return pz;
    };

    // Bands relative to bottom.
    const bands = [];
    if (simple || ext) {
      if (ext) {
        bands.push([ba, 0.35, style[0], 0.5, 1]);
        bands.push([0.35, top, style[1], 1, 1]);
      } else bands.push([bottom, top, style[1], 1, 1, true]);
    } else {
      const f = bottom;
      const H = top;
      const cut = (v) => Math.min(Math.max(v, f), H);
      bands.push([f, cut(f + 0.3), style[0], 0.5, 1]);
      bands.push([cut(f + 0.3), cut(f + WAINSCOT), style[0], 1, 1]);
      bands.push([cut(f + WAINSCOT), cut(f + WAINSCOT + TRIM), style[2], 1, 1]);
      bands.push([cut(f + WAINSCOT + TRIM), cut(H - 0.35), style[1], 1, 1]);
      bands.push([cut(H - 0.35), H, style[1], 1, 0.62]);
    }
    for (const [y0, y1, mat, aoBot, aoTop, plain] of bands) {
      if (y1 - y0 < 0.002) continue;
      const b = this.batch(mat, (ax + bx) / 2, (az + bz) / 2);
      const s = textureScale(mat);
      let y0a = y0, y0b = y0, y1a = y1, y1b = y1;
      if (ramp && plain) { y0a = ba; y0b = bb; y1a = ta; y1b = tb; }
      else if (ramp) { y0a = y0; y0b = y0; }
      const p = [[ax, y0a, az], [bx, y0b, bz], [bx, y1b, bz], [ax, y1a, az]];
      const uv = p.map((q) => [tangentU(q[0], q[2]) / s, q[1] / s]);
      const c = [aoBot * cornerA, aoBot * cornerB, aoTop * cornerB, aoTop * cornerA];
      b.quad(p, n, uv, c);
    }
  }
}

// ---------------------------------------------------------------------------
// Extras: windows, fences, chamber wedges, ground plane, forest
// ---------------------------------------------------------------------------
export function buildWindows(map, mats) {
  const group = new THREE.Group();
  const glassGeo = [];
  const frostGeo = [];
  const frameGeo = [];
  for (const w of map.windows) {
    const i = map.idx(w.x, w.z);
    const f = map.floorH[i], c = map.ceilH[i];
    const h = c - f;
    const cx = w.x + 0.5, cz = w.z + 0.5, cy = f + h / 2;
    const alongX = w.passage === 'x';
    const pane = new THREE.PlaneGeometry(1, h);
    if (alongX) pane.rotateY(Math.PI / 2);
    pane.translate(cx, cy, cz);
    (w.frosted ? frostGeo : glassGeo).push(pane);
    // Frame: mullion + transom
    const t = 0.06;
    const addBox = (sx, sy, sz, x, y, z) => { const g = new THREE.BoxGeometry(sx, sy, sz); g.translate(x, y, z); frameGeo.push(g); };
    if (alongX) {
      addBox(0.12, t, 1.0, cx, f + t / 2, cz);
      addBox(0.12, t, 1.0, cx, c - t / 2, cz);
      addBox(0.12, h, t, cx, cy, w.z + t / 2);
      addBox(0.12, h, t, cx, cy, w.z + 1 - t / 2);
      if (w.exterior || w.studio) addBox(0.1, t * 0.7, 1.0, cx, f + h * 0.62, cz);
    } else {
      addBox(1.0, t, 0.12, cx, f + t / 2, cz);
      addBox(1.0, t, 0.12, cx, c - t / 2, cz);
      addBox(t, h, 0.12, w.x + t / 2, cy, cz);
      addBox(t, h, 0.12, w.x + 1 - t / 2, cy, cz);
      if (w.exterior) addBox(t * 0.7, h, 0.1, cx, cy, cz);
    }
  }
  const merge = (list) => mergeGeos(list);
  if (glassGeo.length) {
    const m = new THREE.Mesh(merge(glassGeo), mats.prop('glass'));
    m.renderOrder = 2;
    group.add(m);
  }
  if (frostGeo.length) group.add(new THREE.Mesh(merge(frostGeo), mats.prop('glassFrost')));
  if (frameGeo.length) {
    const fm = new THREE.Mesh(merge(frameGeo), mats.prop('steelDark'));
    fm.castShadow = true; fm.receiveShadow = true;
    group.add(fm);
  }
  return group;
}

export function buildFences(map, mats, chainTex) {
  const group = new THREE.Group();
  const panes = [];
  const posts = [];
  const H = 2.4;
  for (let z = 0; z < map.H; z++) for (let x = 0; x < map.W; x++) {
    if (map.type[map.idx(x, z)] !== CELL.FENCE) continue;
    const horizontal = map.inb(x + 1, z) && (map.type[map.idx(x + 1, z)] === CELL.FENCE || map.type[map.idx(x + 1, z)] === CELL.DOOR) ||
      map.inb(x - 1, z) && (map.type[map.idx(x - 1, z)] === CELL.FENCE || map.type[map.idx(x - 1, z)] === CELL.DOOR);
    const vertical = map.inb(x, z + 1) && map.type[map.idx(x, z + 1)] === CELL.FENCE || map.inb(x, z - 1) && map.type[map.idx(x, z - 1)] === CELL.FENCE;
    if (horizontal) {
      const g = new THREE.PlaneGeometry(1, H); g.translate(x + 0.5, H / 2, z + 0.5); panes.push(g);
    }
    if (vertical) {
      const g = new THREE.PlaneGeometry(1, H); g.rotateY(Math.PI / 2); g.translate(x + 0.5, H / 2, z + 0.5); panes.push(g);
    }
    if ((x + z) % 3 === 0) {
      const p = new THREE.CylinderGeometry(0.04, 0.04, H + 0.2, 6); p.translate(x + 0.5, (H + 0.2) / 2, z + 0.5); posts.push(p);
    }
  }
  const fenceMat = mats.custom('chainlink', () => {
    const m = mats.prop('chainLink').clone();
    m.alphaMap = chainTex; m.alphaTest = 0.4; m.transparent = false;
    m.onBeforeCompile = mats.prop('chainLink').onBeforeCompile;
    m.customProgramCacheKey = mats.prop('chainLink').customProgramCacheKey;
    return m;
  });
  if (panes.length) {
    const g = mergeGeos(panes);
    // UVs: repeat the chain-link pattern every 0.25 m
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 4, uv.getY(k) * H * 4);
    const m = new THREE.Mesh(g, fenceMat);
    m.receiveShadow = true;
    group.add(m);
  }
  if (posts.length) group.add(new THREE.Mesh(mergeGeos(posts), mats.prop('steelDark')));
  return group;
}

export function makeChainLinkTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#fff'; g.lineWidth = 5;
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64);
  g.moveTo(-32, 32); g.lineTo(32, 96); g.moveTo(32, -32); g.lineTo(96, 32);
  g.moveTo(32, -32); g.lineTo(-32, 32); g.moveTo(96, 32); g.lineTo(32, 96);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Anechoic wedges lining Chamber Zero (instanced).
export function buildChamberWedges(map, mats) {
  const zone = map.zones.find((z) => z.ch === 'z');
  if (!zone) return null;
  const x0 = zone.x0, x1 = zone.x1 + 1, z0 = zone.z0, z1 = zone.z1 + 1;
  const ceil = map.ceilH[map.idx(zone.x0, zone.z0)];
  const bottom = -1.45;
  const geo = new THREE.ConeGeometry(0.21, 0.75, 4, 1);
  geo.rotateY(Math.PI / 4);
  geo.translate(0, 0.375, 0); // base at origin, tip along +y
  const mats_ = mats.prop('foam');
  const transforms = [];
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const sp = 0.3;
  const doorZ = 7.5, winZ0 = 9, winZ1 = 11;
  const push = (px, py, pz, nx, ny, nz) => {
    const m = new THREE.Matrix4();
    q.setFromUnitVectors(up, new THREE.Vector3(nx, ny, nz));
    const s = 0.9 + Math.random() * 0.2;
    m.compose(new THREE.Vector3(px, py, pz), q, new THREE.Vector3(1, s, 1));
    transforms.push(m);
  };
  // Walls
  for (let y = bottom + sp / 2; y < ceil; y += sp) {
    for (let x = x0 + sp / 2; x < x1; x += sp) { push(x, y, z0, 0, 0, 1); push(x, y, z1, 0, 0, -1); }
    for (let z = z0 + sp / 2; z < z1; z += sp) {
      const nearDoor = Math.abs(z - doorZ) < 0.75 && y < 2.65 && y > -0.1;
      const nearWin = z > winZ0 && z < winZ1 && y > 1.0 && y < 2.1;
      if (!nearDoor && !nearWin) push(x0, y, z, 1, 0, 0);
      push(x1, y, z, -1, 0, 0);
    }
  }
  // Ceiling and pit floor
  for (let x = x0 + sp / 2; x < x1; x += sp) for (let z = z0 + sp / 2; z < z1; z += sp) {
    push(x, ceil, z, 0, -1, 0);
    push(x, bottom, z, 0, 1, 0);
  }
  const inst = new THREE.InstancedMesh(geo, mats_, transforms.length);
  transforms.forEach((m, k) => inst.setMatrixAt(k, m));
  inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = false;
  inst.receiveShadow = true;
  inst.name = 'wedges';
  // Inset colliders so you can't walk into the wedges.
  const inset = 0.75;
  const colliders = [
    { x0, z0, x1, z1: z0 + inset },
    { x0, z0: z1 - inset, x1, z1 },
    { x0: x1 - inset, z0, x1, z1 },
    { x0, z0, x1: x0 + inset, z1: doorZ - 0.6 },
    { x0, z0: doorZ + 0.6, x1: x0 + inset, z1 },
  ];
  return { mesh: inst, colliders };
}

export function buildGround(mats) {
  const geo = new THREE.PlaneGeometry(400, 400, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 400 / 3, uv.getY(k) * 400 / 3);
  const col = new Float32Array(uv.count * 3).fill(0.55);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.translate(42, -0.08, 33);
  const m = new THREE.Mesh(geo, mats.surface('grass'));
  m.receiveShadow = true;
  m.name = 'ground';
  return m;
}

export function buildForest(map, mats, rng) {
  // Instanced pines: inside fenced grounds (authored), in forest cells and a ring beyond the map.
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 4, 6);
  trunkGeo.translate(0, 2, 0);
  const crown = [];
  for (let k = 0; k < 5; k++) {
    const r = 1.6 - k * 0.28, h = 2.6 - k * 0.2;
    const c = new THREE.ConeGeometry(r, h, 7, 1, true);
    c.translate(0, 2.6 + k * 1.2 + h / 2, 0);
    crown.push(c);
  }
  const crownGeo = mergeGeos(crown);
  const positions = [];
  for (const p of map.props) if (p.t === 'tree') positions.push([p.x, p.z, 1]);
  for (let z = 0; z < map.H; z++) for (let x = 0; x < map.W; x++) {
    if (map.type[map.idx(x, z)] === CELL.FOREST && rng.chance(0.45)) positions.push([x + rng.range(0.2, 0.8), z + rng.range(0.2, 0.8), rng.range(0.8, 1.3)]);
  }
  for (let k = 0; k < 900; k++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(38, 120);
    const x = 42 + Math.cos(a) * r * 1.1, z = 40 + Math.sin(a) * r;
    if (z < 47 && x > -2 && x < 86 && z > -4) continue; // behind building: keep clear-ish
    positions.push([x, z, rng.range(0.9, 1.6)]);
  }
  // Also a band north/behind the building so the roofline has a treeline.
  for (let k = 0; k < 200; k++) positions.push([rng.range(-20, 105), rng.range(-30, -6), rng.range(1, 1.7)]);
  const trunks = new THREE.InstancedMesh(trunkGeo, mats.prop('bark'), positions.length);
  const crowns = new THREE.InstancedMesh(crownGeo, mats.prop('pine'), positions.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  positions.forEach(([x, z, s], k) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.range(0, 6.28));
    m.compose(new THREE.Vector3(x, -0.05, z), q, new THREE.Vector3(s, s * rng.range(0.9, 1.25), s));
    trunks.setMatrixAt(k, m);
    crowns.setMatrixAt(k, m);
  });
  trunks.castShadow = crowns.castShadow = true;
  trunks.receiveShadow = crowns.receiveShadow = true;
  const g = new THREE.Group();
  g.add(trunks, crowns);
  g.name = 'forest';
  return g;
}

// Minimal geometry merge (non-indexed or indexed; position/normal/uv/color).
export function mergeGeos(list) {
  const attrs = ['position', 'normal', 'uv'];
  const hasColor = list.every((g) => g.attributes.color);
  if (hasColor) attrs.push('color');
  const out = {};
  for (const a of attrs) out[a] = [];
  const index = [];
  let offset = 0;
  for (let g of list) {
    if (!g.index) g = g.toNonIndexed ? indexify(g) : g;
    for (const a of attrs) {
      const src = g.attributes[a];
      if (!src) {
        // fill defaults
        const n = g.attributes.position.count * (a === 'uv' ? 2 : 3);
        for (let k = 0; k < n; k++) out[a].push(a === 'color' ? 1 : 0);
        continue;
      }
      for (let k = 0; k < src.array.length; k++) out[a].push(src.array[k]);
    }
    const idx = g.index.array;
    for (let k = 0; k < idx.length; k++) index.push(idx[k] + offset);
    offset += g.attributes.position.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out.position, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(out.normal, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
  if (hasColor) geo.setAttribute('color', new THREE.Float32BufferAttribute(out.color, 3));
  geo.setIndex(offset > 65535 ? new THREE.Uint32BufferAttribute(index, 1) : new THREE.Uint16BufferAttribute(index, 1));
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

function indexify(g) {
  const n = g.attributes.position.count;
  const idx = new Array(n);
  for (let k = 0; k < n; k++) idx[k] = k;
  g.setIndex(idx);
  return g;
}
