// Collision, line-of-sight and spatial queries on the 2.5D cell grid. Pure (no three.js).
import { CELL } from './MapData.js';
import { PROP_DEFS, propFootprint } from './PropDefs.js';

export class Grid {
  constructor(map) {
    this.map = map;
    this.W = map.W;
    this.H = map.H;
    const n = map.W * map.H;
    // Static movement blockers.
    this.staticBlock = new Uint8Array(n);
    // Sight blockers (walls; doors handled dynamically).
    this.staticSight = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const t = map.type[i];
      this.staticBlock[i] = t === CELL.SOLID || t === CELL.WINDOW || t === CELL.FENCE || t === CELL.FOREST ? 1 : 0;
      this.staticSight[i] = t === CELL.SOLID ? 1 : 0;
    }
    // Dynamic door state: 0 = open/passable, 1 = closed (blocks), 2 = locked (blocks; AI can't open).
    this.doorBlock = new Uint8Array(n);
    // Prop colliders
    this.colliders = [];
    this.cellColliders = new Map(); // cellIndex -> [collider]
    this.navBlock = new Uint8Array(n);
    for (const p of map.props) this.addPropCollider(p);
  }

  idx(x, z) { return z * this.W + x; }
  inb(x, z) { return x >= 0 && z >= 0 && x < this.W && z < this.H; }

  addPropCollider(p) {
    const def = PROP_DEFS[p.t];
    if (!def || !(p.collide ?? def.collide)) return null;
    const fp = propFootprint(p);
    const c = { ...fp, prop: p, enabled: true, low: (p.h ?? def.h) < 0.5 };
    this.colliders.push(c);
    const cx0 = Math.floor(fp.x0), cx1 = Math.floor(fp.x1), cz0 = Math.floor(fp.z0), cz1 = Math.floor(fp.z1);
    for (let z = cz0; z <= cz1; z++) for (let x = cx0; x <= cx1; x++) {
      if (!this.inb(x, z)) continue;
      const i = this.idx(x, z);
      if (!this.cellColliders.has(i)) this.cellColliders.set(i, []);
      this.cellColliders.get(i).push(c);
      // Navigation: block cells whose centre is covered by a large prop.
      if (def.nav && x + 0.5 > fp.x0 - 0.1 && x + 0.5 < fp.x1 + 0.1 && z + 0.5 > fp.z0 - 0.1 && z + 0.5 < fp.z1 + 0.1) {
        this.navBlock[i] = 1;
      }
    }
    return c;
  }

  setDoorState(x, z, state) {
    if (this.inb(x, z)) this.doorBlock[this.idx(x, z)] = state;
  }

  // Movement blocking for a cell (player/entity).
  cellBlocksMove(x, z) {
    if (!this.inb(x, z)) return true;
    const i = this.idx(x, z);
    return this.staticBlock[i] === 1 || this.doorBlock[i] !== 0;
  }

  cellBlocksSight(x, z) {
    if (!this.inb(x, z)) return true;
    const i = this.idx(x, z);
    return this.staticSight[i] === 1 || this.doorBlock[i] !== 0;
  }

  // Resolve a circle (x,z,r) against blocking cells and colliders. Returns corrected {x,z}.
  resolveCircle(x, z, r, ignoreProps = false) {
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      const cx0 = Math.floor(x - r - 0.01), cx1 = Math.floor(x + r + 0.01);
      const cz0 = Math.floor(z - r - 0.01), cz1 = Math.floor(z + r + 0.01);
      for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
        if (this.cellBlocksMove(cx, cz)) {
          const res = pushOutAABB(x, z, r, cx, cz, cx + 1, cz + 1);
          if (res) { x = res.x; z = res.z; moved = true; }
        }
      }
      if (!ignoreProps) {
        const seen = new Set();
        for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
          const list = this.cellColliders.get(this.idx(cx, cz));
          if (!list) continue;
          for (const c of list) {
            if (seen.has(c) || !c.enabled) continue;
            seen.add(c);
            const res = pushOutAABB(x, z, r, c.x0, c.z0, c.x1, c.z1);
            if (res) { x = res.x; z = res.z; moved = true; }
          }
        }
      }
      if (!moved) break;
    }
    return { x, z };
  }

  // Is a circle overlapping anything?
  circleBlocked(x, z, r, ignoreProps = false) {
    const cx0 = Math.floor(x - r), cx1 = Math.floor(x + r);
    const cz0 = Math.floor(z - r), cz1 = Math.floor(z + r);
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
      if (this.cellBlocksMove(cx, cz) && circleAABB(x, z, r, cx, cz, cx + 1, cz + 1)) return true;
      if (ignoreProps) continue;
      const list = this.cellColliders.get(this.idx(cx, cz));
      if (list) for (const c of list) if (c.enabled && circleAABB(x, z, r, c.x0, c.z0, c.x1, c.z1)) return true;
    }
    return false;
  }

  // Grid DDA line-of-sight. mode: 'sight' (walls + closed doors) or 'move' (also windows/fences).
  los(x0, z0, x1, z1, mode = 'sight') {
    let cx = Math.floor(x0), cz = Math.floor(z0);
    const tx = Math.floor(x1), tz = Math.floor(z1);
    const dx = x1 - x0, dz = z1 - z0;
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
    const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;
    let tMaxX = dx !== 0 ? ((stepX > 0 ? cx + 1 - x0 : x0 - cx) * tDeltaX) : Infinity;
    let tMaxZ = dz !== 0 ? ((stepZ > 0 ? cz + 1 - z0 : z0 - cz) * tDeltaZ) : Infinity;
    const block = mode === 'move' ? (x, z) => this.cellBlocksMove(x, z) : (x, z) => this.cellBlocksSight(x, z);
    let guard = 0;
    while (!(cx === tx && cz === tz) && guard++ < 512) {
      if (tMaxX < tMaxZ) { tMaxX += tDeltaX; cx += stepX; }
      else { tMaxZ += tDeltaZ; cz += stepZ; }
      if (cx === tx && cz === tz) break;
      if (block(cx, cz)) return false;
    }
    return true;
  }

  // Count wall-ish cells crossed (for through-wall audio occlusion).
  countOccluders(x0, z0, x1, z1) {
    let cx = Math.floor(x0), cz = Math.floor(z0);
    const tx = Math.floor(x1), tz = Math.floor(z1);
    const dx = x1 - x0, dz = z1 - z0;
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
    const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;
    let tMaxX = dx !== 0 ? ((stepX > 0 ? cx + 1 - x0 : x0 - cx) * tDeltaX) : Infinity;
    let tMaxZ = dz !== 0 ? ((stepZ > 0 ? cz + 1 - z0 : z0 - cz) * tDeltaZ) : Infinity;
    let walls = 0, doors = 0, guard = 0;
    while (!(cx === tx && cz === tz) && guard++ < 512) {
      if (tMaxX < tMaxZ) { tMaxX += tDeltaX; cx += stepX; }
      else { tMaxZ += tDeltaZ; cz += stepZ; }
      if (!this.inb(cx, cz)) { walls++; continue; }
      const i = this.idx(cx, cz);
      if (this.staticSight[i]) walls++;
      else if (this.doorBlock[i]) doors++;
      else if (this.map.type[i] === CELL.WINDOW) doors += 0.6;
    }
    return { walls, doors };
  }

  // Thick line-of-movement check for path smoothing (radius r).
  clearPath(x0, z0, x1, z1, r = 0.3) {
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) return true;
    const steps = Math.ceil(len / 0.25);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = x0 + dx * t, z = z0 + dz * t;
      if (this.circleBlockedNav(x, z, r)) return false;
    }
    return true;
  }

  circleBlockedNav(x, z, r) {
    const cx0 = Math.floor(x - r), cx1 = Math.floor(x + r);
    const cz0 = Math.floor(z - r), cz1 = Math.floor(z + r);
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
      if (!this.inb(cx, cz)) return true;
      const i = this.idx(cx, cz);
      if ((this.staticBlock[i] || this.doorBlock[i] === 2 || this.navBlock[i]) && circleAABB(x, z, r, cx, cz, cx + 1, cz + 1)) return true;
    }
    return false;
  }

  isWalkableCell(x, z) {
    if (!this.inb(x, z)) return false;
    const i = this.idx(x, z);
    return !this.staticBlock[i];
  }
}

function circleAABB(x, z, r, x0, z0, x1, z1) {
  const px = Math.max(x0, Math.min(x, x1));
  const pz = Math.max(z0, Math.min(z, z1));
  const dx = x - px, dz = z - pz;
  return dx * dx + dz * dz < r * r;
}

function pushOutAABB(x, z, r, x0, z0, x1, z1) {
  const px = Math.max(x0, Math.min(x, x1));
  const pz = Math.max(z0, Math.min(z, z1));
  let dx = x - px, dz = z - pz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-10) {
    const d = Math.sqrt(d2);
    const push = r - d;
    return { x: x + (dx / d) * push, z: z + (dz / d) * push };
  }
  // Centre inside the box: push along the shallowest axis.
  const left = x - x0 + r, right = x1 - x + r, up = z - z0 + r, down = z1 - z + r;
  const m = Math.min(left, right, up, down);
  if (m === left) return { x: x0 - r, z };
  if (m === right) return { x: x1 + r, z };
  if (m === up) return { x, z: z0 - r };
  return { x, z: z1 + r };
}
