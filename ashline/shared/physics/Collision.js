// Static collision world: heightmap terrain + axis-aligned boxes in a uniform spatial hash.
// Used by the authoritative server, the client's prediction and the in-browser practice sim.
import { MAP_HALF } from '../constants.js';
import { sampleHeight } from '../map/MapGen.js';

const CS = 8;                       // spatial hash cell size (m)
const GN = Math.ceil((MAP_HALF * 2 + 64) / CS);  // cells per side (with a margin)
const OFF = MAP_HALF + 32;
const EPS = 1e-4;

export class World {
  constructor(map) {
    this.map = map;
    this.heights = map.heights;
    this.b = map.boxes;
    this.mat = map.boxMat;
    this.n = this.b.length / 6;
    this.stamp = new Uint32Array(this.n);
    this.sid = 1;
    // CSR spatial hash
    const counts = new Int32Array(GN * GN + 1);
    const each = (i, fn) => {
      const b = this.b, k = i * 6;
      const i0 = cellOf(b[k]), i1 = cellOf(b[k + 3]), j0 = cellOf(b[k + 2]), j1 = cellOf(b[k + 5]);
      for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) fn(j * GN + ii);
    };
    for (let i = 0; i < this.n; i++) each(i, c => counts[c + 1]++);
    for (let c = 0; c < GN * GN; c++) counts[c + 1] += counts[c];
    const fill = counts.slice();
    this.start = counts;
    this.items = new Int32Array(counts[GN * GN]);
    for (let i = 0; i < this.n; i++) each(i, c => { this.items[fill[c]++] = i; });
  }

  heightAt(x, z) { return sampleHeight(this.heights, x, z); }

  normalAt(x, z) {
    const e = 1.0;
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    const l = Math.hypot(hx, 2 * e, hz);
    return [-hx / l, 2 * e / l, -hz / l];
  }

  // Calls fn(boxIndex) once for each box whose cell range touches the XZ rect. Return true from fn to stop.
  query(minx, minz, maxx, maxz, fn) {
    const sid = this.nextStamp();
    const i0 = cellOf(minx), i1 = cellOf(maxx), j0 = cellOf(minz), j1 = cellOf(maxz);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const c = j * GN + i;
      for (let p = this.start[c], e = this.start[c + 1]; p < e; p++) {
        const bi = this.items[p];
        if (this.stamp[bi] === sid) continue;
        this.stamp[bi] = sid;
        if (fn(bi)) return true;
      }
    }
    return false;
  }

  nextStamp() { this.sid = (this.sid + 1) >>> 0; if (this.sid === 0) { this.stamp.fill(0); this.sid = 1; } return this.sid; }

  overlaps(minx, miny, minz, maxx, maxy, maxz) {
    const b = this.b;
    let hit = -1;
    this.query(minx, minz, maxx, maxz, i => {
      const k = i * 6;
      if (minx < b[k + 3] && maxx > b[k] && miny < b[k + 4] && maxy > b[k + 1] && minz < b[k + 5] && maxz > b[k + 2]) { hit = i; return true; }
      return false;
    });
    return hit;
  }

  // Highest walkable surface (terrain or box top) under a footprint, between y - maxDrop and y + 0.02.
  supportBelow(x, y, z, hw, maxDrop) {
    let best = this.heightAt(x, z);
    if (best > y + 0.02 || best < y - maxDrop) best = -Infinity;
    const b = this.b;
    this.query(x - hw, z - hw, x + hw, z + hw, i => {
      const k = i * 6;
      if (x - hw < b[k + 3] && x + hw > b[k] && z - hw < b[k + 5] && z + hw > b[k + 2]) {
        const top = b[k + 4];
        if (top <= y + 0.02 && top >= y - maxDrop && top > best) best = top;
      }
      return false;
    });
    return best;
  }

  // Move an AABB body (feet at y) with velocity; resolves boxes + terrain, steps up small ledges.
  move(s, dt, hw, h, stepUp) {
    const wasGrounded = s.grounded;
    let dx = s.vx * dt, dy = s.vy * dt, dz = s.vz * dt;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.3));
    dx /= n; dy /= n; dz /= n;
    s.grounded = false;
    let impact = 0;
    for (let it = 0; it < n; it++) {
      // X
      if (dx !== 0) {
        s.x += dx;
        if (this.blocked(s, hw, h)) {
          if (!this.tryStep(s, hw, h, stepUp, wasGrounded || s.grounded)) {
            s.x = this.resolveAxis(s, hw, h, 0, dx);
            s.vx = 0; dx = 0;
          }
        }
      }
      // Z
      if (dz !== 0) {
        s.z += dz;
        if (this.blocked(s, hw, h)) {
          if (!this.tryStep(s, hw, h, stepUp, wasGrounded || s.grounded)) {
            s.z = this.resolveAxis(s, hw, h, 2, dz);
            s.vz = 0; dz = 0;
          }
        }
      }
      // Y
      if (dy !== 0) {
        s.y += dy;
        const hit = this.blocked(s, hw, h);
        if (hit) {
          if (dy < 0) { impact = Math.min(impact, s.vy); s.y = this.topUnder(s, hw, h); s.grounded = true; }
          else s.y = this.bottomAbove(s, hw, h) - h - EPS;
          s.vy = 0; dy = 0;
        }
      }
      const th = this.heightAt(s.x, s.z);
      if (s.y < th) {
        if (s.vy < 0) impact = Math.min(impact, s.vy);
        s.y = th; s.grounded = true; if (s.vy < 0) s.vy = 0; dy = 0;
      }
    }
    // Ground snap when walking down slopes / stairs.
    if (wasGrounded && !s.grounded && s.vy <= 0.5) {
      const sup = this.supportBelow(s.x, s.y, s.z, hw * 0.9, stepUp + 0.12);
      if (sup > -Infinity) { s.y = sup; s.grounded = true; if (s.vy < 0) s.vy = 0; }
    }
    // Keep inside the valley.
    const lim = MAP_HALF - 4;
    if (s.x < -lim) { s.x = -lim; s.vx = 0; } else if (s.x > lim) { s.x = lim; s.vx = 0; }
    if (s.z < -lim) { s.z = -lim; s.vz = 0; } else if (s.z > lim) { s.z = lim; s.vz = 0; }
    return impact;
  }

  blocked(s, hw, h) { return this.overlaps(s.x - hw, s.y + 0.001, s.z - hw, s.x + hw, s.y + h, s.z + hw) >= 0; }

  tryStep(s, hw, h, stepUp, grounded) {
    if (!grounded || stepUp <= 0) return false;
    const y0 = s.y;
    s.y = y0 + stepUp;
    if (this.blocked(s, hw, h)) { s.y = y0; return false; }
    const sup = this.supportBelow(s.x, s.y, s.z, hw, stepUp + 0.05);
    if (sup > -Infinity) s.y = Math.max(y0, sup);
    s.grounded = true;
    return true;
  }

  resolveAxis(s, hw, h, axis, d) {
    const b = this.b;
    const pos = axis === 0 ? s.x : s.z;
    let best = pos - d; // fall back to the previous position
    let found = false, lim = d > 0 ? Infinity : -Infinity;
    this.query(s.x - hw, s.z - hw, s.x + hw, s.z + hw, i => {
      const k = i * 6;
      if (s.x - hw < b[k + 3] && s.x + hw > b[k] && s.y + 0.001 < b[k + 4] && s.y + h > b[k + 1] && s.z - hw < b[k + 5] && s.z + hw > b[k + 2]) {
        found = true;
        if (d > 0) lim = Math.min(lim, b[k + axis] - hw - EPS);
        else lim = Math.max(lim, b[k + 3 + axis] + hw + EPS);
      }
      return false;
    });
    if (found) {
      // Never move backwards past where we started this sub-step.
      best = d > 0 ? Math.max(Math.min(lim, pos), pos - d) : Math.min(Math.max(lim, pos), pos - d);
    }
    return best;
  }

  topUnder(s, hw, h) {
    const b = this.b; let top = s.y;
    this.query(s.x - hw, s.z - hw, s.x + hw, s.z + hw, i => {
      const k = i * 6;
      if (s.x - hw < b[k + 3] && s.x + hw > b[k] && s.y + 0.001 < b[k + 4] && s.y + h > b[k + 1] && s.z - hw < b[k + 5] && s.z + hw > b[k + 2]) top = Math.max(top, b[k + 4]);
      return false;
    });
    return top;
  }

  bottomAbove(s, hw, h) {
    const b = this.b; let bot = s.y + h;
    this.query(s.x - hw, s.z - hw, s.x + hw, s.z + hw, i => {
      const k = i * 6;
      if (s.x - hw < b[k + 3] && s.x + hw > b[k] && s.y + 0.001 < b[k + 4] && s.y + h > b[k + 1] && s.z - hw < b[k + 5] && s.z + hw > b[k + 2]) bot = Math.min(bot, b[k + 1]);
      return false;
    });
    return bot;
  }

  // Ray against boxes + terrain. Returns distance or Infinity; fills out {kind:'box'|'terrain', box, nx, ny, nz}.
  raycast(ox, oy, oz, dx, dy, dz, maxT, out = null, skipTerrain = false) {
    const tb = this.raycastBoxes(ox, oy, oz, dx, dy, dz, maxT, out);
    const tt = skipTerrain ? Infinity : this.raycastTerrain(ox, oy, oz, dx, dy, dz, Math.min(maxT, tb));
    if (tt < tb) {
      if (out) { out.kind = 'terrain'; out.box = -1; const n = this.normalAt(ox + dx * tt, oz + dz * tt); out.nx = n[0]; out.ny = n[1]; out.nz = n[2]; }
      return tt;
    }
    return tb;
  }

  raycastBoxes(ox, oy, oz, dx, dy, dz, maxT, out) {
    const b = this.b;
    const sid = this.nextStamp();
    let best = maxT, bestI = -1, bestAxis = 0;
    // 2D DDA over cells.
    let cx = cellOf(ox), cz = cellOf(oz);
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const invX = dx !== 0 ? 1 / dx : Infinity, invZ = dz !== 0 ? 1 / dz : Infinity;
    const nextBX = (cx + (dx > 0 ? 1 : 0)) * CS - OFF, nextBZ = (cz + (dz > 0 ? 1 : 0)) * CS - OFF;
    let tMaxX = dx !== 0 ? (nextBX - ox) * invX : Infinity;
    let tMaxZ = dz !== 0 ? (nextBZ - oz) * invZ : Infinity;
    const tDX = Math.abs(CS * invX), tDZ = Math.abs(CS * invZ);
    let tCell = 0;
    for (let guard = 0; guard < 400; guard++) {
      if (cx >= 0 && cz >= 0 && cx < GN && cz < GN) {
        const c = cz * GN + cx;
        for (let p = this.start[c], e = this.start[c + 1]; p < e; p++) {
          const i = this.items[p];
          if (this.stamp[i] === sid) continue;
          this.stamp[i] = sid;
          const k = i * 6;
          // slab test
          let t0 = 0, t1 = best, ax = -1;
          let ok = true;
          for (let a = 0; a < 3 && ok; a++) {
            const o = a === 0 ? ox : a === 1 ? oy : oz, d = a === 0 ? dx : a === 1 ? dy : dz;
            const mn = b[k + a], mx = b[k + 3 + a];
            if (Math.abs(d) < 1e-12) { if (o < mn || o > mx) ok = false; continue; }
            let ta = (mn - o) / d, tb2 = (mx - o) / d;
            if (ta > tb2) { const tmp = ta; ta = tb2; tb2 = tmp; }
            if (ta > t0) { t0 = ta; ax = a; }
            if (tb2 < t1) t1 = tb2;
            if (t0 > t1) ok = false;
          }
          if (ok && t0 < best && ax >= 0) { best = t0; bestI = i; bestAxis = ax; }
        }
      }
      const tNext = Math.min(tMaxX, tMaxZ);
      if (best <= tNext || tNext > maxT) break;
      tCell = tNext;
      if (tMaxX < tMaxZ) { cx += stepX; tMaxX += tDX; } else { cz += stepZ; tMaxZ += tDZ; }
      if (cx < -1 || cz < -1 || cx > GN || cz > GN) break;
    }
    if (bestI < 0) return Infinity;
    if (out) {
      out.kind = 'box'; out.box = bestI; out.nx = 0; out.ny = 0; out.nz = 0;
      const d = bestAxis === 0 ? dx : bestAxis === 1 ? dy : dz;
      if (bestAxis === 0) out.nx = d > 0 ? -1 : 1; else if (bestAxis === 1) out.ny = d > 0 ? -1 : 1; else out.nz = d > 0 ? -1 : 1;
    }
    return best;
  }

  raycastTerrain(ox, oy, oz, dx, dy, dz, maxT) {
    let t = 0;
    let diff = oy - this.heightAt(ox, oz);
    if (diff < 0) return 0;
    let prev = 0;
    for (let guard = 0; guard < 2000 && t < maxT; guard++) {
      const step = Math.min(Math.max(diff * 0.45, 0.25), 8);
      prev = t; t = Math.min(t + step, maxT);
      const px = ox + dx * t, py = oy + dy * t, pz = oz + dz * t;
      diff = py - this.heightAt(px, pz);
      if (diff < 0) {
        let a = prev, c = t;
        for (let i = 0; i < 10; i++) {
          const m = (a + c) / 2;
          if (oy + dy * m - this.heightAt(ox + dx * m, oz + dz * m) < 0) c = m; else a = m;
        }
        return c;
      }
      if (t >= maxT) break;
    }
    return Infinity;
  }

  // Line of sight between two points (boxes + terrain).
  los(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const L = Math.hypot(dx, dy, dz);
    if (L < 1e-6) return true;
    return this.raycast(ax, ay, az, dx / L, dy / L, dz / L, L - 0.05) === Infinity;
  }

  surfaceAt(x, z) {
    const map = this.map;
    if (map.riverDist && map.riverDist(x, z) < 9 && this.heightAt(x, z) < map.water + 0.2) return 'water';
    if (map.roadDist && map.roadDist(x, z) < 3.4) return 'gravel';
    const n = this.normalAt(x, z);
    if (n[1] < 0.8) return 'rock';
    return 'grass';
  }
}

function cellOf(v) { const c = Math.floor((v + OFF) / CS); return c < 0 ? 0 : c >= GN ? GN - 1 : c; }
