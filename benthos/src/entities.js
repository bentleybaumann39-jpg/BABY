/* entities.js — the entity list, noise events, pickups, props, cairns, the cage and short-lived effects. */
'use strict';
(function (B) {
  const M = B.M, R = B.R, MD = B.MD, A = B.A;
  const E = B.E = { list: [], nextId: 1 };

  E.reset = function () { E.list = []; B.noiseEvents = []; };
  E.add = function (e) { e.id = E.nextId++; e.alive = true; e.vx = e.vx || 0; e.vy = e.vy || 0; e.vz = e.vz || 0; E.list.push(e); return e; };
  E.byType = t => E.list.filter(e => e.alive && e.type === t);
  E.find = (fn) => E.list.find(e => e.alive && fn(e));
  E.update = function (dt) {
    for (let k = 0; k < E.list.length; k++) { const e = E.list[k]; if (e.alive && e.update) e.update(dt); }
    if (E.list.some(e => !e.alive)) E.list = E.list.filter(e => e.alive);
  };
  // Painter's order: far (north and deep) first.
  E.draw = function () {
    const arr = E.list.filter(e => e.alive && e.draw);
    arr.sort((a, b) => (b.z * B.PY - b.y * B.PZ) - (a.z * B.PY - a.y * B.PZ) || (a.layer || 0) - (b.layer || 0));
    for (const e of arr) e.draw();
  };

  // ------------------------------------------------------------------ noise
  // Hearing radius in metres for a sound of a given loudness (DESIGN.md §2.3 noise table).
  const DB = [[0, 0], [22, 2], [34, 5], [38, 8], [45, 12], [50, 16], [55, 20], [70, 35], [100, 45], [120, 60], [130, 200]];
  B.hearRadius = function (db) {
    if (db <= 0) return 0;
    for (let k = 1; k < DB.length; k++) if (db <= DB[k][0]) { const a = DB[k - 1], b = DB[k]; return a[1] + (b[1] - a[1]) * (db - a[0]) / (b[0] - a[0]); }
    return 200;
  };
  B.noiseEvents = [];
  B.noise = function (x, y, z, db, kind) {
    let r = B.hearRadius(db);
    if (B.Z && B.Z.sofarAt(z)) r *= kind === 'ping' ? 5 : 3;
    // Cairns sit in acoustic shadow zones: nothing inside them carries out.
    for (const c of E.list) if (c.alive && c.type === 'cairn' && Math.hypot(c.x - x, c.y - y, c.z - z) < 7) return null;
    const ev = { x, y, z, db, r, kind: kind || 'noise', t: B.time };
    B.noiseEvents.push(ev);
    return ev;
  };
  E.endTick = function () { const t = B.time; B.noiseEvents = B.noiseEvents.filter(n => t - n.t < 0.05); };

  // ------------------------------------------------------------------ helpers
  const H = (x, y) => B.World.H(B.map, x, y);
  // Keep a swimmer out of rock: lift above the floor and push out of walls.
  E.collide = function (e, rad) {
    const f = H(e.x, e.y);
    if (f < e.z + rad) {
      if (f > e.z - 2) { e.z = f - rad; if (e.vz > 0) e.vz = 0; }
      else {
        // in a wall: step back along the floor gradient toward deeper water
        let bx = 0, by = 0;
        for (let a = 0; a < 8; a++) { const cx = Math.cos(a * 0.785), cy = Math.sin(a * 0.785); const d = H(e.x + cx * 2, e.y + cy * 2) - e.z; bx += cx * d; by += cy * d; }
        const l = Math.hypot(bx, by) || 1; e.x += bx / l * 0.3; e.y += by / l * 0.3;
        const vd = (e.vx * bx + e.vy * by) / l; if (vd < 0) { e.vx -= bx / l * vd; e.vy -= by / l * vd; }
      }
    }
  };
  E.inLamp = function (x, y, z, maxD) {
    const L = R.env.lamp; if (!L.on) return 0;
    const dx = x - L.x, dy = y - L.y, dz = z - L.z, d = Math.hypot(dx, dy, dz);
    if (d > (maxD || Math.sqrt(L.r2)) || d < 0.01) return 0;
    const ca = (dx * L.dx + dy * L.dy + dz * L.dz) / d;
    return ca > L.cosO ? (1 - d / Math.sqrt(L.r2)) : 0;
  };

  // ------------------------------------------------------------------ pickups
  const ITEM_NAME = {
    o2: 'O2 CARTRIDGE', lime: 'SODA LIME CANISTER', ti: 'TITANIUM RING STOCK', cer: 'ALUMINA CERAMIC PLATE', foam: 'SYNTACTIC FOAM',
    cu: 'COPPER WIRE', cell: 'LI-ION CELL', glass: 'GLASS BELL', flare: 'FLARE', shell: 'POWERHEAD SHELL', air: 'COMPRESSED AIR',
    chitin: 'CHITIN', log: 'LOG', lung: 'THE SECOND LUNG', hand: "THE CARTOGRAPHER'S HAND", eye: "MAGPIE'S EYE", shard: 'LOSSLESS SHARD', wren: 'THE WREN',
  };
  B.ITEM_NAME = ITEM_NAME;
  const SCRAP = new Set(['ti', 'cer', 'foam', 'cu', 'cell', 'glass', 'chitin', 'o2', 'lime', 'flare', 'air']);
  E.item = function (kind, x, y, z, o) {
    o = o || {};
    const e = E.add(Object.assign({
      type: 'item', kind, x, y, z, n: o.n || 1, scrap: SCRAP.has(kind), r: 0.4, sid: o.sid,
      draw() {
        const t = B.time;
        R.model(this.x, this.y, this.z, MD.item(this.kind, t + this.id), { minLight: this.kind === 'shard' || this.kind === 'log' ? 0.05 : 0.02 });
        // a faint glint so pickups read in the dark when the lamp touches them
        if (E.inLamp(this.x, this.y, this.z, 12) > 0.1 && ((t * 3 + this.id) % 4) < 0.25) R.point(this.x, this.y, this.z - 0.2, 1, 1.5, 1.5, 1.4, 1);
      },
      interact: { label: () => (e.kind === 'log' ? 'READ ' : 'TAKE ') + (e.title || ITEM_NAME[e.kind]), fn: () => B.Player.take(e) },
    }, o));
    // saved pickups stay taken
    if (e.sid && B.state && B.state.taken && B.state.taken[e.sid]) e.alive = false;
    return e;
  };

  // ------------------------------------------------------------------ props
  E.prop = function (model, x, y, z, o) {
    return E.add(Object.assign({
      type: 'prop', x, y, z, model, r: 1, solid: false, anchor: true,
      draw() { R.model(this.x, this.y, this.z, this.model(B.time, this), this.mopts); },
    }, o));
  };

  // A Cairn: emergency transponder in an acoustic shadow pocket. Save point and fabricator.
  E.cairn = function (x, y, z, o) {
    return E.add(Object.assign({
      type: 'cairn', x, y, z, r: 0.5, anchor: true, name: 'CAIRN',
      draw() {
        const blink = ((B.time + this.id) % 2) < 0.15;
        R.model(this.x, this.y, this.z, MD.transponder({ blink }), {});
        if (blink) R.addLight(this.x, this.y, this.z - 0.7, 1, 0.55, 0.1, 4, 0.8);
      },
      interact: { label: () => 'CAIRN: SAVE AND FABRICATE', fn() { B.Player.atCairn(this); } },
    }, o));
  };

  // ------------------------------------------------------------------ the cage
  E.cage = function (x, y, z, stops) {
    const c = E.add({
      type: 'cage', x, y, z, r: 1.3, anchor: true, stops, stop: 0, moving: false, from: null, to: null, prog: 0, fallen: false, held: false, lit: true,
      update(dt) {
        if (this.falling) {
          this.vz = Math.min(this.vz + 9 * dt, 14); this.z += this.vz * dt; this.x += Math.sin(B.time * 3) * dt * 0.4;
          if (this.z >= this.fallTo) { this.z = this.fallTo; this.falling = false; this.fallen = true; this.held = true; this.lit = false; }
        } else if (this.moving) {
          const d = Math.hypot(this.to.x - this.from.x, this.to.y - this.from.y, this.to.z - this.from.z);
          this.prog = Math.min(1, this.prog + dt * 8 / Math.max(1, d));
          const k = M.smooth(0, 1, this.prog);
          this.x = M.lerp(this.from.x, this.to.x, k); this.y = M.lerp(this.from.y, this.to.y, k); this.z = M.lerp(this.from.z, this.to.z, k);
          if (this.onMove) this.onMove(this);
          if (this.prog >= 1) { this.moving = false; if (this.onArrive) this.onArrive(this); }
        } else if (this.held) {
          this.x += Math.sin(B.time * 0.3) * dt * 0.05; // swaying in something's grip
        }
      },
      draw() {
        R.model(this.x, this.y, this.z, MD.cage({ lit: this.lit && !this.fallen }), {});
        if (this.lit && !this.fallen) R.addLight(this.x + 0.95, this.y - 0.95, this.z - 1.1, 1, 0.85, 0.5, 6, 1.2);
        // downline to the surface (or the frayed end after the fall)
        if (!this.fallen && !this.falling) R.line(this.x, this.y, this.z - 2, this.x, this.y, Math.max(0, this.z - 140), 0.5, 0.5, 0.5, false);
        else R.line(this.x, this.y, this.z - 2, this.x + 0.6, this.y - 0.4, this.z - 12, 0.4, 0.4, 0.4, false);
      },
      interact: {
        label: () => c.fallen ? null : c.moving ? null : (c.stop < c.stops.length - 1 ? 'RIDE THE CAGE DOWN (' + c.stops[c.stop + 1].z + ' M)' : null),
        fn() { B.Player.rideCage(c); },
      },
    });
    return c;
  };
  E.cageGo = function (c, idx) {
    c.from = { x: c.x, y: c.y, z: c.z }; c.to = c.stops[idx]; c.stop = idx; c.prog = 0; c.moving = true;
  };

  // ------------------------------------------------------------------ effects
  E.silt = function (x, y, z, size) {
    return E.add({
      type: 'silt', x, y, z, r: 0.5, life: 6 + size * 6, age: 0, size, layer: 2,
      update(dt) { this.age += dt; this.r = Math.min(1 + this.size * 3.5, 0.5 + this.age * 2.2); this.z -= dt * 0.05; if (this.age > this.life) this.alive = false; },
      draw() {
        const d = 0.85 * (1 - this.age / this.life);
        R.disc(this.x, this.y, this.z, this.r, 0.24, 0.2, 0.14, d, false);
      },
    });
  };
  E.inSilt = function (x, y, z) { for (const e of E.list) if (e.alive && e.type === 'silt' && Math.hypot(e.x - x, e.y - y, e.z - z) < e.r && e.age < e.life * 0.8) return true; return false; };
  E.bubble = function (x, y, z, n) {
    for (let k = 0; k < (n || 1); k++) E.add({
      type: 'bubble', x: x + M.rnd(-0.3, 0.3), y: y + M.rnd(-0.3, 0.3), z, vz: -M.rnd(0.4, 1.2), size: M.rnd(0.6, 1.4), age: 0, layer: 3,
      update(dt) {
        this.age += dt; this.vz = Math.max(-2.5, this.vz - dt * 0.8); this.z += this.vz * dt; this.x += Math.sin(this.age * 6 + this.id) * dt * 0.3;
        // Boyle's law: bubbles swell as they rise
        this.size = Math.min(3, this.size * (1 + dt * 0.02));
        if (this.age > 18 || this.z < 0.2) this.alive = false;
      },
      draw() { const s = this.size > 2 ? 2 : 1; R.point(this.x, this.y, this.z, s, 0.7, 0.85, 0.9, 1, 0.9); R.point(this.x - 0.04, this.y, this.z - 0.06, 1, 1.4, 1.6, 1.6, 1); },
    });
  };
  E.bloomCloud = function (x, y, z) {
    A.at('bloom', x, y, z, 1);
    return E.add({
      type: 'bloom', x, y, z, r: 4, age: 0, life: 12, layer: 2,
      update(dt) { this.age += dt; this.z += dt * 0.08; if (this.age > this.life) this.alive = false; },
      draw() {
        const k = 1 - this.age / this.life;
        R.disc(this.x, this.y, this.z, 1.2 + this.age * 0.25, 0.1 * k, 0.7 * k, 0.6 * k, 0.55 * k, 2);
        R.addLight(this.x, this.y, this.z, 0.2, 1, 0.8, 9, 1.6 * k);
      },
    });
  };
  // Burglar-alarm cascade: a ring of light rippling out at 12 m/s for 80 m.
  E.alarm = function (x, y, z) {
    A.at('alarm', x, y, z, 1.2);
    B.noise(x, y, z, 75, 'alarm');
    return E.add({
      type: 'alarm', x, y, z, age: 0, layer: 2,
      update(dt) { this.age += dt; if (this.age > 80 / 12) this.alive = false; },
      draw() {
        const r = this.age * 12, k = 1 - this.age / (80 / 12);
        const cx = R.sx(this.x), cy = R.sy(this.y, this.z), n = Math.min(160, 20 + r * 4);
        for (let i = 0; i < n; i++) {
          const a = i / n * Math.PI * 2 + this.id;
          if (((i + (this.age * 30 | 0)) % 3) === 0) R.point(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r, this.z + Math.sin(a * 3) * 1.5, 1, 0.3 * k + 0.1, 0.9 * k, 1.4 * k, 2);
        }
        R.addLight(this.x, this.y, this.z, 0.3, 0.8, 1.2, Math.min(30, r + 6), 0.8 * k);
        void cx; void cy;
      },
    });
  };
  // Free-drifting glowing particles (a Procession coming apart, dying lanternfish).
  E.motes = function (x, y, z, n, spread, cols, life) {
    const P = []; for (let k = 0; k < n; k++) P.push({ x: x + M.rnd(-1, 1), y: y + M.rnd(-1, 1), z: z + M.rnd(-spread, spread), vx: M.rnd(-1, 1), vy: M.rnd(-1, 1), vz: M.rnd(-0.3, 0.3), c: M.pick(cols), l: life * M.rnd(0.6, 1) });
    return E.add({
      type: 'motes', x, y, z, age: 0, P, life, layer: 3,
      update(dt) { this.age += dt; for (const p of this.P) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vx *= 0.995; p.vy *= 0.995; } if (this.age > this.life) this.alive = false; },
      draw() { for (const p of this.P) { const k = Math.max(0, 1 - this.age / p.l); if (k > 0) R.point(p.x, p.y, p.z, 1, p.c[0] * k, p.c[1] * k, p.c[2] * k, 2); } },
    });
  };
  E.flareFx = function (x, y, z) {
    return E.add({
      type: 'flare', x, y, z, vz: 0.3, age: 0, life: 60, layer: 2,
      update(dt) { this.age += dt; const f = H(this.x, this.y); if (this.z < f - 0.2) this.z += 0.6 * dt; if (this.age > this.life) this.alive = false; if (((this.age * 7) | 0) % 9 === 0 && Math.random() < 0.05) E.bubble(this.x, this.y, this.z, 1); },
      draw() {
        const k = Math.min(1, (this.life - this.age) / 5), fl = 0.85 + 0.15 * Math.sin(B.time * 30 + this.id);
        R.point(this.x, this.y, this.z, 2, 3 * k, 2.2 * k, 1.2 * k, 1);
        R.addLight(this.x, this.y, this.z - 0.3, 1, 0.75, 0.45, 18, 2.4 * k * fl);
      },
    });
  };
})(window.B);
