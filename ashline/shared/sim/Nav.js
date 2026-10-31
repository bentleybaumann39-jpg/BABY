// 1 m walkability grid over the valley floor + bounded A* for bots. Ground floors only: a cell is
// blocked when a box intersects the body band (0.5–1.75 m above the terrain at the cell centre).
import { MAP_HALF } from '../constants.js';

const N = MAP_HALF * 2;          // cells per side (1 m)

class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v; const top = v[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      let i = 0; const n = k.length;
      for (;;) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
  clear() { this.k.length = 0; this.v.length = 0; }
}

export class Nav {
  constructor(world) {
    this.world = world;
    const grid = new Uint8Array(N * N);
    const b = world.b;
    for (let i = 0; i < world.n; i++) {
      const k = i * 6;
      const x0 = Math.max(0, Math.floor(b[k] + MAP_HALF + 0.05)), x1 = Math.min(N - 1, Math.floor(b[k + 3] + MAP_HALF - 0.05));
      const z0 = Math.max(0, Math.floor(b[k + 2] + MAP_HALF + 0.05)), z1 = Math.min(N - 1, Math.floor(b[k + 5] + MAP_HALF - 0.05));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const c = z * N + x;
        if (grid[c]) continue;
        const g = world.heightAt(x - MAP_HALF + 0.5, z - MAP_HALF + 0.5);
        if (b[k + 4] > g + 0.5 && b[k + 1] < g + 1.75) grid[c] = 1;
      }
    }
    // Map border.
    for (let i = 0; i < N; i++) { for (let j = 0; j < 5; j++) { grid[j * N + i] = grid[(N - 1 - j) * N + i] = grid[i * N + j] = grid[i * N + N - 1 - j] = 1; } }
    this.grid = grid;
    this.g = new Float32Array(N * N);
    this.parent = new Int32Array(N * N);
    this.seen = new Uint32Array(N * N);
    this.stamp = 1;
    this.heap = new Heap();
  }

  cell(x, z) { return [Math.floor(x + MAP_HALF), Math.floor(z + MAP_HALF)]; }
  blockedAt(x, z) {
    const i = Math.floor(x + MAP_HALF), j = Math.floor(z + MAP_HALF);
    if (i < 0 || j < 0 || i >= N || j >= N) return true;
    return this.grid[j * N + i] === 1;
  }

  // Straight walk check with body clearance.
  lineClear(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const L = Math.hypot(dx, dz);
    if (L < 0.01) return !this.blockedAt(ax, az);
    const nx = -dz / L * 0.3, nz = dx / L * 0.3;
    const steps = Math.ceil(L / 0.45);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, x = ax + dx * t, z = az + dz * t;
      if (this.blockedAt(x, z) || this.blockedAt(x + nx, z + nz) || this.blockedAt(x - nx, z - nz)) return false;
    }
    return true;
  }

  nearestFree(x, z, r = 6) {
    if (!this.blockedAt(x, z)) return [x, z];
    for (let d = 1; d <= r; d++) for (let a = 0; a < 16; a++) {
      const px = x + Math.cos(a / 16 * Math.PI * 2) * d, pz = z + Math.sin(a / 16 * Math.PI * 2) * d;
      if (!this.blockedAt(px, pz)) return [px, pz];
    }
    return null;
  }

  // A* from (ax,az) to (bx,bz). Returns smoothed waypoint list [[x,z],...] or null.
  findPath(ax, az, bx, bz, maxExpand = 14000) {
    const s0 = this.nearestFree(ax, az, 3), g0 = this.nearestFree(bx, bz, 8);
    if (!s0 || !g0) return null;
    const [si, sj] = this.cell(s0[0], s0[1]), [gi, gj] = this.cell(g0[0], g0[1]);
    const start = sj * N + si, goal = gj * N + gi;
    if (start === goal) return [[bx, bz]];
    this.stamp++;
    if (this.stamp > 0xfffffff0) { this.seen.fill(0); this.stamp = 1; }
    const st = this.stamp, grid = this.grid, g = this.g, parent = this.parent, seen = this.seen, heap = this.heap;
    heap.clear();
    const h = (c) => { const x = c % N, z = (c / N) | 0; const dx = Math.abs(x - gi), dz = Math.abs(z - gj); return (dx + dz) + (1.4142 - 2) * Math.min(dx, dz); };
    g[start] = 0; parent[start] = -1; seen[start] = st;
    heap.push(h(start), start);
    let expanded = 0, found = false, bestC = start, bestH = h(start);
    const closed = st + 0x0; // nodes are closed lazily by comparing g on pop
    while (heap.size && expanded < maxExpand) {
      const c = heap.pop();
      if (c === goal) { found = true; break; }
      expanded++;
      const cx = c % N, cz = (c / N) | 0;
      const hc = h(c); if (hc < bestH) { bestH = hc; bestC = c; }
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
        const n = nz * N + nx;
        if (grid[n]) continue;
        if (dx && dz && (grid[cz * N + nx] || grid[nz * N + cx])) continue;
        const ng = g[c] + (dx && dz ? 1.4142 : 1);
        if (seen[n] === st && g[n] <= ng) continue;
        seen[n] = st; g[n] = ng; parent[n] = c;
        heap.push(ng + h(n) * 1.15, n);
      }
    }
    void closed;
    const end = found ? goal : bestC;
    if (end === start) return null;
    const cells = [];
    for (let c = end; c !== -1 && cells.length < 5000; c = parent[c]) cells.push(c);
    cells.reverse();
    const pts = cells.map(c => [(c % N) - MAP_HALF + 0.5, ((c / N) | 0) - MAP_HALF + 0.5]);
    if (found) pts[pts.length - 1] = [bx, bz];
    // String-pull smoothing.
    const out = [];
    let cur = [ax, az], i = 0;
    while (i < pts.length) {
      let j = Math.min(pts.length - 1, i + 40);
      while (j > i && !this.lineClear(cur[0], cur[1], pts[j][0], pts[j][1])) j--;
      if (j === i && i < pts.length - 1 && !this.lineClear(cur[0], cur[1], pts[i][0], pts[i][1])) { /* keep grid step */ }
      out.push(pts[j]);
      cur = pts[j]; i = j + 1;
    }
    return out;
  }
}
