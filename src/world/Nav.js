// Pathfinding (A*) and sound propagation (Dijkstra) on the cell grid. Pure (no three.js).
import { CELL } from './MapData.js';

class MinHeap {
  constructor(cap = 1024) { this.k = new Int32Array(cap); this.p = new Float32Array(cap); this.n = 0; }
  clear() { this.n = 0; }
  push(key, pri) {
    if (this.n >= this.k.length) {
      const k2 = new Int32Array(this.k.length * 2); k2.set(this.k); this.k = k2;
      const p2 = new Float32Array(this.p.length * 2); p2.set(this.p); this.p = p2;
    }
    let i = this.n++;
    this.k[i] = key; this.p[i] = pri;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (this.p[par] <= this.p[i]) break;
      this.swap(i, par); i = par;
    }
  }
  pop() {
    const top = this.k[0];
    this.n--;
    if (this.n > 0) {
      this.k[0] = this.k[this.n]; this.p[0] = this.p[this.n];
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.n && this.p[l] < this.p[m]) m = l;
        if (r < this.n && this.p[r] < this.p[m]) m = r;
        if (m === i) break;
        this.swap(i, m); i = m;
      }
    }
    return top;
  }
  swap(a, b) {
    const tk = this.k[a]; this.k[a] = this.k[b]; this.k[b] = tk;
    const tp = this.p[a]; this.p[a] = this.p[b]; this.p[b] = tp;
  }
}

const DIRS8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class Nav {
  constructor(map, grid) {
    this.map = map;
    this.grid = grid;
    const n = map.W * map.H;
    this.g = new Float32Array(n);
    this.came = new Int32Array(n);
    this.closed = new Uint8Array(n);
    this.heap = new MinHeap(4096);
    this.field = new Float32Array(n);
    this.fieldHeap = new MinHeap(4096);
    this.repel = []; // {x,z,r,cost}
    // Vent links (entity-only)
    this.links = new Map();
    for (const v of map.vents || []) {
      if (!v.a || !v.b) continue;
      const ia = this.cellOf(v.a.x, v.a.z), ib = this.cellOf(v.b.x, v.b.z);
      const cost = 10 + Math.hypot(v.a.x - v.b.x, v.a.z - v.b.z) * 0.4;
      if (!this.links.has(ia)) this.links.set(ia, []);
      if (!this.links.has(ib)) this.links.set(ib, []);
      this.links.get(ia).push({ to: ib, cost, vent: v });
      this.links.get(ib).push({ to: ia, cost, vent: v });
    }
  }

  cellOf(x, z) { return Math.floor(z) * this.map.W + Math.floor(x); }

  // Can the entity stand in this cell? (doors: closed ok, locked not)
  passable(i, allowLocked = false) {
    const gr = this.grid;
    if (gr.staticBlock[i]) return false;
    if (gr.navBlock[i]) return false;
    if (gr.doorBlock[i] === 2 && !allowLocked) return false;
    return true;
  }

  repelCost(x, z) {
    let c = 0;
    for (const r of this.repel) {
      const d = Math.hypot(x - r.x, z - r.z);
      if (d < r.r) c += r.cost * (1 - d / r.r);
    }
    return c;
  }

  // A* from world point to world point. Returns array of {x,z,vent?} waypoints (cell centres) or null.
  findPath(sx, sz, tx, tz, opts = {}) {
    const W = this.map.W;
    const start = this.cellOf(sx, sz), goal = this.cellOf(tx, tz);
    let goalCell = goal;
    if (!this.passable(goalCell, opts.allowLocked)) {
      goalCell = this.nearestPassable(tx, tz, 3, opts.allowLocked);
      if (goalCell < 0) return null;
    }
    let startCell = start;
    if (!this.passable(startCell, opts.allowLocked)) {
      startCell = this.nearestPassable(sx, sz, 2, opts.allowLocked);
      if (startCell < 0) return null;
    }
    const g = this.g, came = this.came, closed = this.closed, heap = this.heap;
    g.fill(Infinity); closed.fill(0); heap.clear();
    g[startCell] = 0; came[startCell] = -1;
    const gx = goalCell % W, gz = (goalCell / W) | 0;
    const h = (i) => { const x = i % W, z = (i / W) | 0; return Math.hypot(x - gx, z - gz); };
    heap.push(startCell, h(startCell));
    const useVents = opts.vents !== false;
    const maxIter = opts.maxIter || 20000;
    let iter = 0;
    const doorCost = opts.doorCost ?? 1.5;
    while (heap.n > 0 && iter++ < maxIter) {
      const cur = heap.pop();
      if (closed[cur]) continue;
      if (cur === goalCell) return this.reconstruct(cur, sx, sz, tx, tz, goalCell === goal);
      closed[cur] = 1;
      const cx = cur % W, cz = (cur / W) | 0;
      for (const [dx, dz, cost] of DIRS8) {
        const nx = cx + dx, nz = cz + dz;
        if (!this.grid.inb(nx, nz)) continue;
        const ni = nz * W + nx;
        if (closed[ni] || !this.passable(ni, opts.allowLocked)) continue;
        if (dx !== 0 && dz !== 0) {
          // no corner cutting
          if (!this.passable(cz * W + nx, opts.allowLocked) || !this.passable(nz * W + cx, opts.allowLocked)) continue;
          if (this.map.type[cz * W + nx] === CELL.DOOR || this.map.type[nz * W + cx] === CELL.DOOR || this.map.type[ni] === CELL.DOOR || this.map.type[cur] === CELL.DOOR) continue;
        }
        let c = cost;
        if (this.map.type[ni] === CELL.DOOR && this.grid.doorBlock[ni] === 1) c += doorCost;
        if (this.repel.length) c += this.repelCost(nx + 0.5, nz + 0.5);
        if (opts.costFn) c += opts.costFn(nx, nz);
        const ng = g[cur] + c;
        if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; heap.push(ni, ng + h(ni)); }
      }
      if (useVents) {
        const links = this.links.get(cur);
        if (links) for (const l of links) {
          if (closed[l.to]) continue;
          const ng = g[cur] + l.cost;
          if (ng < g[l.to]) { g[l.to] = ng; came[l.to] = cur; heap.push(l.to, ng + h(l.to)); }
        }
      }
    }
    return null;
  }

  pathLength(path) {
    let L = 0;
    for (let i = 1; i < path.length; i++) L += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
    return L;
  }

  reconstruct(goalCell, sx, sz, tx, tz, exact) {
    const W = this.map.W;
    const cells = [];
    for (let c = goalCell; c !== -1; c = this.came[c]) cells.push(c);
    cells.reverse();
    const pts = [];
    for (let k = 0; k < cells.length; k++) {
      const c = cells[k];
      const p = { x: (c % W) + 0.5, z: ((c / W) | 0) + 0.5, cell: c };
      if (k > 0) {
        const prev = cells[k - 1];
        const links = this.links.get(prev);
        if (links && links.some((l) => l.to === c) && Math.abs((prev % W) - (c % W)) + Math.abs(((prev / W) | 0) - ((c / W) | 0)) > 2) {
          p.ventFrom = pts[pts.length - 1];
          p.vent = true;
        }
      }
      pts.push(p);
    }
    if (exact && pts.length) { pts[pts.length - 1] = { ...pts[pts.length - 1], x: tx, z: tz }; }
    return this.smooth(pts, sx, sz);
  }

  // String-pulling: drop intermediate points when a clear thick line exists. Keep doors and vents.
  smooth(pts, sx, sz) {
    if (pts.length <= 2) return pts;
    const out = [];
    let anchor = { x: sx, z: sz };
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      // Find furthest reachable point without crossing a door or vent boundary.
      for (; j > i; j--) {
        let ok = true;
        for (let k = i; k <= j; k++) {
          const keep = pts[k].vent || (pts[k + 1] && pts[k + 1].vent) || this.map.type[pts[k].cell] === CELL.DOOR;
          if (keep && k < j) { ok = false; break; }
        }
        if (ok && this.grid.clearPath(anchor.x, anchor.z, pts[j].x, pts[j].z, 0.32)) break;
      }
      out.push(pts[j]);
      anchor = pts[j];
      i = j + 1;
    }
    return out;
  }

  nearestPassable(x, z, radius = 3, allowLocked = false) {
    const W = this.map.W;
    const cx = Math.floor(x), cz = Math.floor(z);
    let best = -1, bd = Infinity;
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
      const nx = cx + dx, nz = cz + dz;
      if (!this.grid.inb(nx, nz)) continue;
      const i = nz * W + nx;
      if (!this.passable(i, allowLocked)) continue;
      const d = Math.hypot(nx + 0.5 - x, nz + 0.5 - z);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // Sound propagation field from (x,z): path distance with attenuation costs for doors/windows.
  // Returns this.field (shared buffer!). maxDist limits expansion.
  propagate(x, z, maxDist = 40) {
    const W = this.map.W;
    const f = this.field;
    f.fill(Infinity);
    const heap = this.fieldHeap;
    heap.clear();
    const s = this.cellOf(x, z);
    if (!this.grid.inb(Math.floor(x), Math.floor(z))) return f;
    f[s] = 0;
    heap.push(s, 0);
    while (heap.n > 0) {
      const cur = heap.pop();
      const d = f[cur];
      if (d > maxDist) break;
      const cx = cur % W, cz = (cur / W) | 0;
      for (const [dx, dz] of DIRS4) {
        const nx = cx + dx, nz = cz + dz;
        if (!this.grid.inb(nx, nz)) continue;
        const ni = nz * W + nx;
        const t = this.map.type[ni];
        if (t === CELL.SOLID || t === CELL.FOREST) continue;
        let c = 1;
        if (t === CELL.DOOR && this.grid.doorBlock[ni]) c += 5;
        else if (t === CELL.WINDOW) c += 7;
        const nd = d + c;
        if (nd < f[ni]) { f[ni] = nd; heap.push(ni, nd); }
      }
    }
    return f;
  }

  fieldAt(x, z) {
    if (!this.grid.inb(Math.floor(x), Math.floor(z))) return Infinity;
    return this.field[this.cellOf(x, z)];
  }

  // Walk downhill on this.field from (x,z) toward the field origin until a cell has LOS to (ox,oz).
  // Used to relocate a sound source to the doorway it is heard through.
  portalPoint(x, z, ox, oz, maxSteps = 80) {
    const W = this.map.W;
    let cur = this.cellOf(x, z);
    if (this.grid.los(x, z, ox, oz, 'sight')) return { x, z };
    for (let step = 0; step < maxSteps; step++) {
      const cx = cur % W, cz = (cur / W) | 0;
      let best = cur, bd = this.field[cur];
      for (const [dx, dz] of DIRS4) {
        const nx = cx + dx, nz = cz + dz;
        if (!this.grid.inb(nx, nz)) continue;
        const ni = nz * W + nx;
        if (this.field[ni] < bd) { bd = this.field[ni]; best = ni; }
      }
      if (best === cur) break;
      cur = best;
      const px = (cur % W) + 0.5, pz = ((cur / W) | 0) + 0.5;
      if (this.grid.los(px, pz, ox, oz, 'sight')) return { x: px, z: pz };
    }
    return { x: (cur % W) + 0.5, z: ((cur / W) | 0) + 0.5 };
  }

  // Random reachable point within radius of (x,z) (for search/patrol).
  randomPointNear(rng, x, z, rMin, rMax, tries = 30) {
    for (let t = 0; t < tries; t++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(rMin, rMax);
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const ci = this.cellOf(px, pz);
      if (!this.grid.inb(Math.floor(px), Math.floor(pz))) continue;
      if (!this.passable(ci) || this.map.type[ci] === CELL.DOOR) continue;
      return { x: Math.floor(px) + 0.5, z: Math.floor(pz) + 0.5 };
    }
    return null;
  }
}
