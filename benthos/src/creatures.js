/* creatures.js — the Reliquary, the Sleeper, the Procession, the Grain, the Second Diver and the small fauna.
 * Behaviour follows DESIGN.md §3; numbers are tuned for a 40-minute descent rather than ten hours. */
'use strict';
(function (B) {
  const M = B.M, R = B.R, MD = B.MD, A = B.A, E = B.E, P = R.P;
  const H = (x, y) => B.World.H(B.map, x, y);
  const col = {}, c = h => col[h] || (col[h] = B.linHex(h));
  const pl = () => B.player;
  const dist = (a, x, y, z) => Math.hypot(a.x - x, a.y - y, a.z - z);
  // Steer toward a point with a speed limit and a turn limit; updates yaw/pitch, position and velocity.
  function steer(e, tx, ty, tz, speed, turn, dt, accel) {
    const dx = tx - e.x, dy = ty - e.y, dz = tz - e.z, d = Math.hypot(dx, dy, dz) || 1;
    const want = Math.atan2(dy, dx), dy2 = M.wrap(want - e.yaw);
    e.yaw += M.clamp(dy2, -turn * dt, turn * dt);
    const wp = Math.atan2(dz, Math.hypot(dx, dy)); e.pitch = M.approach(e.pitch || 0, M.clamp(wp, -0.7, 0.7), turn * dt * 0.6);
    const s = Math.min(speed, d * 1.5), k = accel || 2;
    const vx = Math.cos(e.yaw) * Math.cos(e.pitch) * s, vy = Math.sin(e.yaw) * Math.cos(e.pitch) * s, vz = Math.sin(e.pitch) * s;
    e.vx += (vx - e.vx) * Math.min(1, k * dt); e.vy += (vy - e.vy) * Math.min(1, k * dt); e.vz += (vz - e.vz) * Math.min(1, k * dt);
    e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt;
    return d;
  }
  // Keep away from rock: if the way ahead is a wall or floor, nudge up and around.
  function avoid(e, rad, dt) {
    const ax = e.x + Math.cos(e.yaw) * 4, ay = e.y + Math.sin(e.yaw) * 4;
    if (H(ax, ay) < e.z + rad) { e.yaw += 1.6 * dt; e.vz -= 1.5 * dt; }
    E.collide(e, rad);
  }
  B.Creatures = { steer, avoid };

  // ================================================================== THE RELIQUARY
  E.reliquary = function (x, y, z) {
    const r = E.add({
      type: 'reliquary', x, y, z, yaw: 0, pitch: 0, hp: 3, mode: 'shadow', helmets: ['94', '71', 'old'], curl: 0, litT: 0,
      dead: false, deathT: 0, side: Math.random() * 6.28, legPh: 0, rx: x, ry: y, rz: z, ryaw: 0, biteT: 0, chimeT: 0, r: 1.6, anchor: true,
      update(dt) {
        const Pp = pl(); if (!Pp) return;
        if (this.dead) { this.deathT += dt; if (H(this.x, this.y) > this.z + 1) this.z += dt * 0.6; return; }
        if (this.curl > 0) { this.curl -= dt; this.vx *= 0.95; this.vy *= 0.95; this.x += this.vx * dt; this.y += this.vy * dt; E.collide(this, 1); return; }
        const lit = E.inLamp(this.x, this.y, this.z, 12) > 0 && R.env.lamp.mode === 'white';
        this.litT = lit ? this.litT + dt : Math.max(0, this.litT - dt * 0.5);
        if (this.litT > 3) { this.curl = 6; this.litT = 0; A.at('bone', this.x, this.y, this.z, 1.5); A.at('bone', this.x, this.y, this.z, 1.2); return; }
        const weak = B.Player.weakness(), dp = dist(this, Pp.x, Pp.y, Pp.z);
        let tx, ty, tz, spd = 1.5;
        // salvage it can reach before you do
        let best = null, bd = 40;
        for (const e of E.list) {
          if (!e.alive || !((e.type === 'item' && e.scrap) || (e.type === 'corpse' && e.mara))) continue;
          const d = dist(this, e.x, e.y, e.z); if (d < bd && dist(e, Pp.x, Pp.y, Pp.z) > 5) { bd = d; best = e; }
        }
        if (best && weak < 0.6) {
          this.mode = 'collect'; tx = best.x; ty = best.y; tz = best.z - 0.8; spd = 1.7;
          if (bd < 1.6) { best.alive = false; if (best.type === 'corpse') this.helmets.unshift('mara'); else this.hoard.push(best.kind); A.at('bone', this.x, this.y, this.z, 1); }
        } else if (weak > 0.6) {
          this.mode = weak > 0.85 ? 'feed' : 'close';
          const k = this.mode === 'feed' ? 0.5 : 9 / Math.max(1, dp);
          tx = Pp.x + (this.x - Pp.x) * k; ty = Pp.y + (this.y - Pp.y) * k; tz = Pp.z; spd = 1.8;
          if (this.mode === 'feed' && dp < 3 && (this.biteT -= dt) <= 0) { this.biteT = 2.2; B.Player.hurt('reliquary', 26); A.at('bone', this.x, this.y, this.z, 2); }
        } else {
          this.mode = 'shadow';
          this.side += dt * 0.05;
          const rr = 30 + Math.sin(B.time * 0.1 + this.id) * 4;
          tx = Pp.x + Math.cos(this.side) * rr; ty = Pp.y + Math.sin(this.side) * rr; tz = Pp.z + Math.sin(B.time * 0.07) * 3;
          if (H(tx, ty) < tz + 2) { this.side += 0.6; tz = Math.min(tz, H(tx, ty) - 3); }
          // never linger inside the lamp
          if (lit) { tx = this.x + (this.x - Pp.x); ty = this.y + (this.y - Pp.y); spd = 1.8; }
          spd = dp > 45 ? 2.4 : 1.3;
        }
        steer(this, tx, ty, tz, spd, 1.2, dt, 1.4);
        avoid(this, 1.2, dt);
        this.legPh += dt * (1 + Math.hypot(this.vx, this.vy) * 4);
        if ((this.chimeT -= dt) <= 0) { this.chimeT = M.rnd(3, 9); if (dp < 40) A.at('bone', this.x, this.y, this.z, 0.7); }
      },
      hit() {
        if (this.dead) return;
        this.hp--; this.curl = 6; A.at('bone', this.x, this.y, this.z, 2);
        if (this.hp <= 0) { this.dead = true; this.curl = 0; B.Story && B.Story.onReliquaryDead(this); }
      },
      draw() {
        // the body moves at 10 fps; its legs at the full 60
        if (B.frame % 6 === 0 || this.rx === undefined) { this.rx = this.x; this.ry = this.y; this.rz = this.z; this.ryaw = this.yaw; }
        const T = MD.frame(this.ryaw, 0), prims = [], chitin = c('#c8bca0');
        const curled = this.curl > 0 || this.dead;
        if (curled) {
          prims.push(P.s(0, 0, 0, 1.05, chitin, { tex: (pu, pw) => 0.65 + 0.35 * Math.abs(Math.sin(pu * 9 + pw * 2)) }));
        } else {
          const rim = c('#e0d8c0'), AXT = [T(1, 0, 0), T(0, 1, 0), T(0, 0, 1)];
          for (let k = 0; k < 7; k++) {
            const u = 1.5 - k * 0.48, wd = 0.62 - Math.abs(k - 2.5) * 0.06;
            prims.push(P.e(...T(u, 0, 0), AXT, [0.3, wd, 0.3], chitin, { tex: (pu, pw, f, nu) => 0.8 + 0.2 * (Math.abs(nu) < 0.15 ? 1.2 : 1) }));
            // the trailing edge of each dorsal plate, paler and a little proud of the next
            prims.push(P.e(...T(u - 0.22, 0, -0.05), AXT, [0.06, wd + 0.04, 0.29], rim));
          }
          // tail fan: pleotelson and two uropods
          prims.push(P.e(...T(-1.85, 0, 0.02), AXT, [0.32, 0.42, 0.12], chitin));
          for (const s of [-1, 1]) prims.push(P.e(...T(-1.95, s * 0.38, 0.05), [T(0.6, s * 0.8, 0), T(-0.8, s * 0.6, 0), T(0, 0, 1)], [0.32, 0.1, 0.05], rim));
          prims.push(P.e(...T(1.95, 0, 0.05), AXT, [0.3, 0.45, 0.22], c('#a89c80')));
          for (const s of [-1, 1]) prims.push(P.s(...T(2.08, s * 0.28, -0.05), 0.11, c('#3a3010'), { m: 2 }));
          // salvage cemented on in pale wax: an ROV float, a ship's bell, a porthole ring, a child's shoe
          const wax = c('#e8e4d8');
          prims.push(P.s(...T(-0.55, 0.32, -0.42), 0.13, wax), P.s(...T(-0.55, 0.32, -0.58), 0.2, c('#d8b020'), { m: 1 }));
          prims.push(P.s(...T(0.35, -0.3, -0.4), 0.11, wax), P.c(T(0.35, -0.3, -0.48), T(0.35, -0.3, -0.72), 0.14, c('#b07d52'), { m: 3 }), P.s(...T(0.35, -0.3, -0.75), 0.07, c('#8a5d3a'), { m: 3 }));
          for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; prims.push(P.s(...T(-0.15 + Math.cos(a) * 0.17, 0.12, -0.55 + Math.sin(a) * 0.17), 0.04, c('#9aa2ab'), { m: 3 })); }
          prims.push(P.s(...T(-1.2, -0.25, -0.36), 0.08, wax), P.b(...T(-1.2, -0.25, -0.45), AXT, [0.13, 0.05, 0.06], c('#c83a22')));
        }
        R.model(this.rx, this.ry, this.rz, prims, {});
        if (!curled) {
          // fourteen procedural legs
          const pale = c('#a89c80');
          for (let k = 0; k < 7; k++) for (const s of [-1, 1]) {
            const u = 1.4 - k * 0.42, ph = this.legPh * 3 + k * 0.9 + (s > 0 ? Math.PI : 0);
            const hip = T(u, s * 0.5, 0.15), knee = T(u + Math.sin(ph) * 0.15, s * 0.95, -0.05), foot = T(u + Math.sin(ph) * 0.3, s * 1.15, 0.5 - Math.max(0, Math.cos(ph)) * 0.15);
            R.lineL(this.x, this.y, this.z, hip, knee, pale[0], pale[1], pale[2]);
            R.lineL(this.x, this.y, this.z, knee, foot, pale[0], pale[1], pale[2]);
          }
          for (const s of [-1, 1]) {
            const mid = T(3.0, s * 0.65, -0.35 + Math.sin(B.time * 2 + s) * 0.1), tip = T(3.9, s * 1.25, -0.2 + Math.sin(B.time * 1.3 + s) * 0.2);
            R.lineL(this.x, this.y, this.z, T(2.1, s * 0.15, -0.1), mid, pale[0], pale[1], pale[2]);
            R.lineL(this.x, this.y, this.z, mid, tip, pale[0], pale[1], pale[2]);
          }
        }
        // the helmets cemented to its back, each at the resolution of its own era
        const n = Math.min(9, this.helmets.length);
        for (let i = 0; i < n; i++) {
          const era = this.helmets[i];
          // spread down the back between the salvage; extra helmets (bodies it has collected) fill the gaps
          const off = curled ? T(Math.cos(i * 1.3) * 0.75, Math.sin(i * 1.3) * 0.75, -0.65) : T(i < 3 ? 1.15 - i * 1.05 : 0.7 - (i - 3) * 0.9, i < 3 ? (i % 2 ? 0.05 : -0.1) : (i % 2 ? 0.34 : -0.34), -0.42);
          const boot = this.dead && this.deathT > 1 + i * 2 && this.deathT < 3 + i * 2 + 3 && Math.sin(B.time * 40 + i) > -0.3;
          const sc = era === '94' ? 2 : era === '71' ? 3 : era === 'old' ? 3 : 1;
          R.model(this.rx + off[0], this.ry + off[1], this.rz + off[2], MD.helmet({ era, yaw: this.ryaw + i, tilt: 0.3, hud: boot, stencil: era === 'mara' }),
            { scale: sc, lut: era === 'mara' ? 0 : era === '94' ? 3 : 2, dead: era !== 'mara' && !boot, minLight: 0.05 });
        }
        if (B.Player.revealed(this)) R.wire(this.x, this.y, this.z, prims, B.SONAR);
      },
      hoard: [],
    });
    return r;
  };

  // ================================================================== THE SLEEPER
  const SN = 14, SEG = 0.95, PROF = [0.75, 0.95, 1.15, 1.3, 1.35, 1.3, 1.2, 1.05, 0.9, 0.72, 0.55, 0.42, 0.3, 0.22];
  E.sleeper = function (x, y, z, band) {
    const sp = []; for (let k = 0; k < SN; k++) sp.push({ x: x - k * SEG, y, z });
    const specks = []; for (let k = 0; k < 26; k++) specks.push([Math.floor(Math.random() * 11), Math.random() * 6.28, M.rnd(0.85, 1.05)]);
    const s = E.add({
      type: 'sleeper', x, y, z, yaw: 0, pitch: 0, band, mode: 'drift', wp: null, t: 0, spine: sp, hist: [], drawPose: null, specks, r: 1.4,
      beatT: 0, listenT: 0, srcT: null, commitT: 0, recoverT: 0, fleeT: 0, tangled: null, deadT: 0,
      update(dt) {
        const Pp = pl(); if (!Pp) return;
        this.t += dt;
        const dp = dist(this, Pp.x, Pp.y, Pp.z);
        if (this.mode === 'dead') { this.deadT += dt; return; }
        if (this.mode === 'brine') { this.deadT += dt; this.yaw += Math.sin(this.t * 9) * dt * 3; this.z = this.brineZ - 0.4 + Math.sin(this.t * 7) * 0.2; this.followSpine(); this.snap(); if (this.deadT > 7) { this.mode = 'dead'; B.Story && B.Story.onSleeperDead(this, 'brine'); } return; }
        if (this.mode === 'tangled') {
          this.deadT += dt; this.yaw += Math.sin(this.t * 6) * dt * 2.5; this.z -= dt * 0.25; this.followSpine(); this.snap();
          if (Math.random() < dt * 2) A.at('whump', this.x, this.y, this.z, 1.5);
          if (this.deadT > 22) { this.mode = 'dead'; B.Story && B.Story.onSleeperDead(this, 'procession'); }
          return;
        }
        // hearing
        for (const ev of B.noiseEvents) {
          if (dist(this, ev.x, ev.y, ev.z) > ev.r) continue;
          if (ev.kind === 'ping' || ev.kind === 'ghostping') { this.mode = 'track'; this.trackSrc = ev.src || Pp; }
          else if (this.mode === 'drift' || this.mode === 'search') { this.mode = 'listen'; this.listenT = M.rnd(2, 4); this.wp = { x: ev.x, y: ev.y, z: ev.z }; }
        }
        // Bloom clouds are an electrical storm to a blind hunter
        let bloom = null; for (const e of E.list) if (e.alive && e.type === 'bloom' && dist(this, e.x, e.y, e.z) < 30) bloom = e;
        // electroreception: any powered suit within 6 m
        if (B.Player.powered() && dp < 6 && this.mode !== 'commit' && this.mode !== 'recover' && this.mode !== 'flee') this.mode = 'hunt';
        let tx = this.x + Math.cos(this.yaw) * 5, ty = this.y + Math.sin(this.yaw) * 5, tz = this.z, spd = 0.6, turn = 0.6;
        switch (this.mode) {
          case 'drift': {
            if (!this.wp || dist(this, this.wp.x, this.wp.y, this.wp.z) < 4) {
              // mostly it keeps its distance; now and then, and always the first time, its patrol passes close
              const close = this.flyby || Math.random() < 0.18, a = Math.random() * 6.28, rr = close ? M.rnd(8, 14) : M.rnd(30, 65);
              if (this.flyby) { this.flyby = false; const side = Math.atan2(this.y - Pp.y, this.x - Pp.x) + Math.PI * 0.75; this.wp = { x: Pp.x + Math.cos(side) * rr, y: Pp.y + Math.sin(side) * rr, z: M.clamp(Pp.z + 1, this.band[0], this.band[1]) }; }
              else this.wp = { x: Pp.x + Math.cos(a) * rr, y: Pp.y + Math.sin(a) * rr, z: M.clamp(Pp.z + (close ? M.rnd(-3, 3) : M.rnd(-25, 25)), this.band[0], this.band[1]) };
            }
            tx = this.wp.x; ty = this.wp.y; tz = this.wp.z; break;
          }
          case 'listen': spd = 0.15; if (this.wp) { tx = this.wp.x; ty = this.wp.y; tz = this.wp.z; } turn = 1; if ((this.listenT -= dt) <= 0) this.mode = 'investigate'; break;
          case 'investigate': tx = this.wp.x; ty = this.wp.y; tz = this.wp.z; spd = 1.4; turn = 0.9; if (dist(this, tx, ty, tz) < 3) this.startSearch(); break;
          case 'track': {
            const src = this.trackSrc || Pp, trail = src.trail || [];
            let node = null; for (let k = trail.length - 1; k >= 0; k--) if (!trail[k].muffled) { node = trail[k]; break; }
            if (!node) { this.startSearch(); break; }
            tx = node.x; ty = node.y; tz = node.z; spd = 1.5; turn = 1;
            if (dist(this, tx, ty, tz) < 2.5 && (!src.ring || src.ring <= 0)) this.startSearch(tx, ty, tz);
            break;
          }
          case 'search': {
            this.searchT -= dt; this.searchA += dt * 0.8;
            const rr = Math.min(15, 3 + (12 - this.searchT) * 1.2);
            tx = this.sc.x + Math.cos(this.searchA) * rr; ty = this.sc.y + Math.sin(this.searchA) * rr; tz = this.sc.z; spd = 1;
            if (this.searchT <= 0) this.mode = 'drift';
            break;
          }
          case 'hunt': {
            tx = Pp.x; ty = Pp.y; tz = Pp.z; spd = 1.6; turn = 1.3;
            const ang = Math.abs(M.wrap(Math.atan2(Pp.y - this.y, Pp.x - this.x) - this.yaw));
            if (dp < 8 && ang < 0.55) { this.mode = 'commit'; this.commitT = 1.2; this.cdir = { x: (Pp.x - this.x) / dp, y: (Pp.y - this.y) / dp, z: (Pp.z - this.z) / dp }; A.at('rush', this.x, this.y, this.z, 2); B.Story && B.Story.onSleeperCommit && B.Story.onSleeperCommit(this); }
            if (!B.Player.powered() && dp > 4) this.startSearch(Pp.x, Pp.y, Pp.z);
            if (dp > 30) this.mode = 'drift';
            break;
          }
          case 'commit': {
            this.commitT -= dt;
            // a little steering during the lunge
            const want = { x: (Pp.x - this.x), y: (Pp.y - this.y), z: (Pp.z - this.z) }, wl = Math.hypot(want.x, want.y, want.z) || 1;
            this.cdir.x += (want.x / wl - this.cdir.x) * dt * 1.2; this.cdir.y += (want.y / wl - this.cdir.y) * dt * 1.2; this.cdir.z += (want.z / wl - this.cdir.z) * dt * 1.2;
            this.vx = this.cdir.x * 9; this.vy = this.cdir.y * 9; this.vz = this.cdir.z * 9; this.yaw = Math.atan2(this.cdir.y, this.cdir.x);
            this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt; E.collide(this, 1.4);
            const mx = this.x + Math.cos(this.yaw) * 0.9, my = this.y + Math.sin(this.yaw) * 0.9;
            if (Math.hypot(mx - Pp.x, my - Pp.y, this.z - Pp.z) < 1.5) {
              if (B.Player.caulPop()) { this.mode = 'flee'; this.fleeT = 30; }
              else { B.Player.bite(this); this.mode = 'recover'; this.recoverT = 4; }
              this.commitT = 0;
            }
            if (this.commitT <= 0 && this.mode === 'commit') { this.mode = 'recover'; this.recoverT = 3; }
            this.followSpine(); this.snap(); this.checkHazards(); return;
          }
          case 'recover': spd = 0.4; if ((this.recoverT -= dt) <= 0) this.startSearch(Pp.x, Pp.y, Pp.z); break;
          case 'flee': tx = this.x + (this.x - Pp.x); ty = this.y + (this.y - Pp.y); tz = this.z; spd = 1.8; if ((this.fleeT -= dt) <= 0) this.mode = 'drift'; break;
        }
        if (bloom && this.mode !== 'flee' && this.mode !== 'commit') { tx = bloom.x; ty = bloom.y; tz = bloom.z; spd = 1.5; }
        tz = M.clamp(tz, this.band[0], this.band[1]);
        steer(this, tx, ty, tz, spd, turn, dt, 1.2);
        avoid(this, 2, dt);
        this.followSpine(); this.snap(); this.checkHazards();
        // tail beats felt through the hull, from where it really is
        this.beatT -= dt;
        if (this.beatT <= 0) { this.beatT = spd > 1 ? 0.6 : 1.3; if (dp < 45) A.at('whump', this.x, this.y, this.z, 1.6); }
      },
      startSearch(x, y, z) { this.mode = 'search'; this.searchT = 12; this.searchA = 0; this.sc = { x: x === undefined ? this.x : x, y: y === undefined ? this.y : y, z: z === undefined ? this.z : z }; },
      followSpine() {
        const s = this.spine; s[0].x = this.x; s[0].y = this.y; s[0].z = this.z;
        for (let k = 1; k < SN; k++) {
          const a = s[k - 1], b = s[k]; let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z; const l = Math.hypot(dx, dy, dz) || 1;
          b.x = a.x + dx / l * SEG; b.y = a.y + dy / l * SEG; b.z = a.z + dz / l * SEG;
        }
      },
      snap() {
        const f = new Float32Array(SN * 3); for (let k = 0; k < SN; k++) { f[k * 3] = this.spine[k].x; f[k * 3 + 1] = this.spine[k].y; f[k * 3 + 2] = this.spine[k].z; }
        this.hist.push(f); if (this.hist.length > 64) this.hist.shift();
      },
      checkHazards() {
        const m = B.map;
        if (m.features && m.features.brine) { const b = m.features.brine; if (Math.hypot(this.x - b.x, this.y - b.y) < b.r && this.z > b.level - 1.2) { this.mode = 'brine'; this.brineZ = b.level; this.deadT = 0; A.at('splash', this.x, this.y, this.z, 2); } }
        for (const e of E.list) if (e.alive && e.type === 'procession' && e.touches(this.x, this.y, this.z, 1.4)) { this.mode = 'tangled'; this.deadT = 0; e.feed(this); break; }
      },
      prims(pose, mouth) {
        const out = [], hx = pose[0], hy = pose[1], hz = pose[2], lead = c('#5a524a');
        const skin = (pu, pw, f) => { const n = B.noise2(pu * 2.2 + 9, pw * 2.2 + f, 41); const sc = B.noise2(pu * 5, pw * 5, 42) > 0.78 ? 1.35 : 1; return (0.7 + n * 0.5) * sc; };
        for (let k = 0; k < SN; k++) {
          const i0 = Math.max(0, k - 1) * 3, i1 = Math.min(SN - 1, k + 1) * 3;
          const ax = P.basis(pose[i0] - pose[i1], pose[i0 + 1] - pose[i1 + 1], pose[i0 + 2] - pose[i1 + 2]);
          const r = PROF[k];
          out.push(P.e(pose[k * 3] - hx, pose[k * 3 + 1] - hy, pose[k * 3 + 2] - hz, ax, [SEG * 0.78, r, r * 0.82], lead, { tex: skin }));
          if (k === 3) for (const sd of [-1, 1]) out.push(P.e(pose[k * 3] - hx + ax[1][0] * sd * 1.3, pose[k * 3 + 1] - hy + ax[1][1] * sd * 1.3, pose[k * 3 + 2] - hz + 0.35, ax, [0.7, 0.9, 0.12], lead, { tex: skin }));
          if (k === 6) out.push(P.e(pose[k * 3] - hx, pose[k * 3 + 1] - hy, pose[k * 3 + 2] - hz - 1.2, ax, [0.5, 0.12, 0.45], lead));
          if (k === SN - 1) { for (const sd of [-1, 1]) out.push(P.e(pose[k * 3] - hx - ax[0][0] * 0.6, pose[k * 3 + 1] - hy - ax[0][1] * 0.6, pose[k * 3 + 2] - hz + sd * 0.7, P.basis(-ax[0][0], -ax[0][1], sd * 0.9), [0.8, 0.12, 0.3], lead)); }
          if (k === 0) {
            for (const sd of [-1, 1]) out.push(P.s(ax[1][0] * sd * 0.62 + ax[0][0] * 0.3, ax[1][1] * sd * 0.62 + ax[0][1] * 0.3, -0.25, 0.1, c('#1a1a1a')));
            if (mouth) out.push(P.e(ax[0][0] * 0.65, ax[0][1] * 0.65, 0.25, ax, [0.35, 0.55, 0.45], [0, 0, 0], { m: 4 }));
          }
        }
        return out;
      },
      draw() {
        const committing = this.mode === 'commit';
        if (B.frame % 3 === 0 || !this.drawPose || committing) {
          const h = this.hist, lag = committing ? 0 : 30;
          this.drawPose = h[Math.max(0, h.length - 1 - lag)] || h[h.length - 1];
          this.after = [45, 40, 35].map(l => h[Math.max(0, h.length - 1 - l)]);
        }
        const pose = this.drawPose; if (!pose) return;
        if (!committing && this.mode !== 'dead' && this.mode !== 'brine') this.after.forEach((ap, i) => { if (ap) R.model(ap[0], ap[1], ap[2], this.prims(ap, false), { alpha: [0.18, 0.28, 0.4][i], outline: false, dim: 0.7 }); });
        const pr = this.prims(pose, committing);
        R.model(pose[0], pose[1], pose[2], pr, { dim: this.mode === 'dead' ? 0.6 : 1 });
        // copepods trailing from the blind eyes; bacterial specks drifting in its outline
        const ax = P.basis(pose[0] - pose[3], pose[1] - pose[4], pose[2] - pose[5]);
        for (const sd of [-1, 1]) {
          const ex = pose[0] + ax[1][0] * sd * 0.62 + ax[0][0] * 0.3, ey = pose[1] + ax[1][1] * sd * 0.62 + ax[0][1] * 0.3, ez = pose[2] - 0.25;
          const wv = Math.sin(B.time * 3 + sd) * 0.15;
          R.line(ex, ey, ez, ex - ax[0][0] * 1.4 + ax[1][0] * wv, ey - ax[0][1] * 1.4 + ax[1][1] * wv, ez + 0.1, 0.75, 0.75, 0.7, false);
        }
        if (this.mode !== 'dead') for (const s of this.specks) {
          const k = s[0], a = s[1] + Math.sin(B.time * 0.3 + k) * 0.1, rr = PROF[k] * s[2];
          const i0 = k * 3, axk = P.basis(pose[Math.max(0, k - 1) * 3] - pose[(k + 1) * 3], pose[Math.max(0, k - 1) * 3 + 1] - pose[(k + 1) * 3 + 1], 0);
          R.point(pose[i0] + axk[1][0] * Math.cos(a) * rr, pose[i0 + 1] + axk[1][1] * Math.cos(a) * rr, pose[i0 + 2] + Math.sin(a) * rr * 0.8, 1, 0.08, 0.5, 0.18, 1);
        }
        // the sonar draws where it really is
        if (B.Player.revealed(this)) { const cur = this.hist[this.hist.length - 1]; if (cur) R.wire(cur[0], cur[1], cur[2], this.prims(cur, false), B.SONAR); }
      },
    });
    s.followSpine(); for (let k = 0; k < 40; k++) s.snap();
    return s;
  };

  // ================================================================== THE PROCESSION
  const CYC = ['#18225e', '#2c3fa8', '#5a74e6', '#4bb394', '#7dd6b0', '#e8fff8', '#7dd6b0', '#4bb394', '#5a74e6', '#2c3fa8', '#18225e', '#18225e'].map(h => B.linHex(h).map(v => v * 2.2));
  E.procession = function (x, y, zTop, len, o) {
    const n = Math.floor(len / 2) + 1, px = new Float32Array(n), py = new Float32Array(n), pz = new Float32Array(n), qx = new Float32Array(n), qy = new Float32Array(n), qz = new Float32Array(n);
    for (let k = 0; k < n; k++) { px[k] = qx[k] = x; py[k] = qy[k] = y; pz[k] = qz[k] = zTop + k * 2; }
    const tents = []; for (let k = 4; k < n; k += 4) tents.push({ k, a: (k * 2.39) % 6.28, L: M.rnd(14, 20) });
    const pr = E.add(Object.assign({
      type: 'procession', x, y, z: zTop, zTop, len, n, px, py, pz, qx, qy, qz, tents, cf: 1, tf: 1, contractT: 0, hits: 0, rhythm: [], flash: 0,
      playT: 0, playIdx: 0, mimic: false, prey: [], r: 2, anchor: true, layer: 1,
      update(dt) {
        const t = B.time, Pp = pl();
        // contraction on vibration
        for (const ev of B.noiseEvents) if (ev.db > 45 && Math.abs(ev.z - (this.zTop + this.len / 2)) < this.len / 2 + 20 && Math.hypot(ev.x - this.px[0], ev.y - this.py[0]) < 40) { if (this.contractT <= 0) A.at('glass', ev.x, ev.y, ev.z, 1); this.contractT = 20; }
        this.contractT -= dt;
        const target = this.contractT > 17 ? 0.35 : this.contractT > 0 ? M.lerp(1, 0.35, this.contractT / 17) : 1;
        this.cf = M.approach(this.cf, target, dt * (target < this.cf ? 0.25 : 0.035));
        this.tf = this.cf;
        // verlet stem
        this.px[0] = this.x + Math.sin(t * 0.05 + this.id) * 2; this.py[0] = this.y + Math.cos(t * 0.04 + this.id) * 2; this.pz[0] = this.zTop;
        const seg = 2 * this.cf;
        for (let k = 1; k < this.n; k++) {
          const vx = (this.px[k] - this.qx[k]) * 0.96, vy = (this.py[k] - this.qy[k]) * 0.96, vz = (this.pz[k] - this.qz[k]) * 0.96;
          this.qx[k] = this.px[k]; this.qy[k] = this.py[k]; this.qz[k] = this.pz[k];
          this.px[k] += vx + Math.sin(t * 0.2 + k * 0.07) * 0.004; this.py[k] += vy + Math.cos(t * 0.17 + k * 0.05) * 0.004; this.pz[k] += vz + 0.01;
        }
        for (let it = 0; it < 4; it++) for (let k = 1; k < this.n; k++) {
          const dx = this.px[k] - this.px[k - 1], dy = this.py[k] - this.py[k - 1], dz = this.pz[k] - this.pz[k - 1], l = Math.hypot(dx, dy, dz) || 1, d = (l - seg) / l;
          if (k === 1) { this.px[k] -= dx * d; this.py[k] -= dy * d; this.pz[k] -= dz * d; }
          else { this.px[k] -= dx * d * 0.5; this.py[k] -= dy * d * 0.5; this.pz[k] -= dz * d * 0.5; this.px[k - 1] += dx * d * 0.5; this.py[k - 1] += dy * d * 0.5; this.pz[k - 1] += dz * d * 0.5; }
        }
        // learning: replay the player's own signal rhythm as light
        if (Pp && B.signals && B.signals.length > 3 && Math.hypot(Pp.x - this.x, Pp.y - this.y) < 120 && Math.abs(Pp.z - (this.zTop + this.len / 2)) < this.len) {
          const sg = B.signals.slice(-6), iv = []; for (let k = 1; k < sg.length; k++) iv.push(Math.min(4, sg[k] - sg[k - 1]));
          this.playT -= dt;
          if (this.playT <= 0) { this.flash = 1; this.playIdx = (this.playIdx + 1) % (iv.length + 1); this.playT = this.playIdx === iv.length ? 3 : Math.max(0.25, iv[this.playIdx]); if (Math.random() < 0.5) A.at('glass', this.x, this.y, Pp.z, 0.8); }
        }
        this.flash = Math.max(0, this.flash - dt * 3);
        // prey being reeled up toward the feeding polyps
        for (const p of this.prey) if (p.mode === 'tangled') { p.z -= dt * 0.3; }
        if (Pp && !B.Player.state().tangled && !Pp.dead) {
          if (this.touches(Pp.x, Pp.y, Pp.z, 0.75)) B.Player.tangle(this);
        }
      },
      // Is the point within r of a fishing tentacle?
      touches(x, y, z, r) {
        if (this.dead) return false;
        for (const tn of this.tents) {
          const k = tn.k; if (Math.abs(this.pz[k] - z) > 6) continue;
          const bx = this.px[k], by = this.py[k], bz = this.pz[k], L = tn.L * this.tf;
          const a = tn.a + Math.sin(B.time * 0.3 + k) * 0.2;
          const ex = bx + Math.cos(a) * L, ey = by + Math.sin(a) * L, ez = bz + L * 0.25;
          // distance point-segment
          const vx = ex - bx, vy = ey - by, vz = ez - bz, wx = x - bx, wy = y - by, wz = z - bz;
          const tt = M.clamp((wx * vx + wy * vy + wz * vz) / (vx * vx + vy * vy + vz * vz), 0, 1);
          if (Math.hypot(wx - vx * tt, wy - vy * tt, wz - vz * tt) < r) return true;
        }
        return false;
      },
      feed(p) { this.prey.push(p); },
      strike() {
        if (this.dead) return;
        this.hits++; A.at('pickHit', this.px[0], this.py[0], this.pz[0], 1.5); A.at('glass', this.px[0], this.py[0], this.pz[0], 1.5);
        if (this.hits >= 3) this.collapse();
      },
      collapse() {
        this.dead = true; this.alive = false;
        const Pp = pl(), z0 = Pp ? Pp.z : this.zTop;
        E.motes(this.x, this.y, z0 + 20, 220, 120, CYC.slice(2, 8).map(cc => cc.map(v => v * 0.8)), 90);
        B.Z.flareAmbient(60);
        for (let k = 0; k < 3; k++) E.item('glass', this.x + M.rnd(-3, 3), this.y + M.rnd(-3, 3), (Pp ? Pp.z : this.zTop) + M.rnd(-2, 4));
        A.sfx('bloom'); B.Story && B.Story.onProcessionDead(this);
      },
      draw() {
        const Pp = pl(); if (!Pp) return;
        const z0 = R.cam.z - 45, z1 = R.cam.z + 80, t = B.time;
        const near = Math.hypot(Pp.x - this.px[0], Pp.y - this.py[0]) < 70;
        if (!near) return;
        const fl = this.flash, revealed = B.Player.revealed(this);
        let lightAcc = 0;
        for (let k = 0; k < this.n - 1; k++) {
          if (this.pz[k] < z0 || this.pz[k] > z1) continue;
          R.line(this.px[k], this.py[k], this.pz[k], this.px[k + 1], this.py[k + 1], this.pz[k + 1], 0.05, 0.12, 0.13, false, 0.7);
          for (let j = 0; j < 4; j++) {
            const tt = j / 4, x = M.lerp(this.px[k], this.px[k + 1], tt), y = M.lerp(this.py[k], this.py[k + 1], tt), z = M.lerp(this.pz[k], this.pz[k + 1], tt);
            const idx = ((k * 4 + j) * 0.5 - t * 12) | 0, cc = (this.mimic && k > this.n - 15) ? [2.4, 1.0, 0.25] : CYC[((idx % 12) + 12) % 12];
            const b = 0.55 + fl * 1.8;
            R.point(x + Math.sin(k + j) * 0.2, y + Math.cos(k * 1.3 + j) * 0.2, z, (j & 1) ? 1 : 2, cc[0] * b, cc[1] * b, cc[2] * b, 2);
          }
          if (k % 8 === 0) { R.addLight(this.px[k], this.py[k], this.pz[k], 0.25, 0.5, 1.0, 9, 0.35 + fl); lightAcc++; }
        }
        // fishing tentacles: almost invisible beyond 6 m of lamp, drawn in full by sonar
        for (const tn of this.tents) {
          const k = tn.k; if (this.pz[k] < z0 || this.pz[k] > z1) continue;
          const L = tn.L * this.tf, a = tn.a + Math.sin(t * 0.3 + k) * 0.2;
          const bx = this.px[k], by = this.py[k], bz = this.pz[k], ex = bx + Math.cos(a) * L, ey = by + Math.sin(a) * L, ez = bz + L * 0.25;
          const lamp = Math.max(E.inLamp(bx, by, bz, 6), E.inLamp((bx + ex) / 2, (by + ey) / 2, (bz + ez) / 2, 6));
          const al = revealed ? 0 : lamp > 0 ? 0.9 : 0.22;
          if (al > 0) R.line(bx, by, bz, ex, ey, ez, 0.35, 0.45, 0.5, true, al);
          if (revealed) R.overlay(() => { const x1 = R.sx(bx), y1 = R.sy(by, bz), x2 = R.sx(ex), y2 = R.sy(ey, ez), st = Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))); for (let s = 0; s <= st; s += 2) R.pset(x1 + (x2 - x1) * s / st, y1 + (y2 - y1) * s / st, B.SONAR); });
        }
        // the pneumatophore
        if (this.pz[0] > z0 && this.pz[0] < z1) R.model(this.px[0], this.py[0], this.pz[0] - 1, [P.e(0, 0, 0, [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [0.9, 0.9, 1.3], c('#f2b8cb'), { m: 1, e: [0.15, 0.06, 0.09] })], {});
        void lightAcc;
      },
      interact: {
        label: () => { const Pp = pl(); return Pp && !pr.dead && Math.hypot(Pp.x - pr.px[0], Pp.y - pr.py[0], Pp.z - pr.pz[0]) < 3.5 ? 'STRIKE THE FLOAT (' + (3 - pr.hits) + ')' : null; },
        fn() { pr.strike(); },
      },
    }, o));
    // let the stem settle into its hang
    for (let s = 0; s < 200; s++) pr.update(0);
    return pr;
  };

  // ================================================================== THE GRAIN
  E.grain = function (x, y, z, n) {
    const ax = new Float32Array(n), ay = new Float32Array(n), az = new Float32Array(n), ox = new Float32Array(n), oy = new Float32Array(n), oz = new Float32Array(n), att = new Uint8Array(n), ph = new Float32Array(n);
    for (let k = 0; k < n; k++) { const a = Math.random() * 6.28, r = Math.cbrt(Math.random()) * 5; ox[k] = Math.cos(a) * r; oy[k] = Math.sin(a) * r; oz[k] = M.rnd(-2, 2); ax[k] = x + ox[k]; ay[k] = y + oy[k]; az[k] = z + oz[k]; ph[k] = Math.random() * 6.28; }
    return E.add({
      type: 'grain', x, y, z, hx: x, hy: y, hz: z, n, ax, ay, az, ox, oy, oz, att, ph, state: 'diffuse', attN: 0, stripT: 0, fleeT: 0, satT: 0, took: 0, layer: 4,
      update(dt) {
        const Pp = pl(); if (!Pp) return;
        const dp = dist(this, Pp.x, Pp.y, Pp.z), Pst = B.Player.state();
        const ignore = Pst.fidelity <= 5 || Pst.caul > 0;
        // light: a lamp on the swarm or a flare nearby sends it away
        let lit = E.inLamp(this.x, this.y, this.z, 10) > 0 && R.env.lamp.mode !== 'off';
        for (const e of E.list) if (e.alive && (e.type === 'flare' && dist(e, this.x, this.y, this.z) < 16 || e.type === 'bloom' && dist(e, this.x, this.y, this.z) < 5)) { lit = true; if (e.type === 'bloom') this.killSome(0.3); }
        if (lit && this.state !== 'flee') { this.state = 'flee'; this.fleeT = 5; this.detach(); }
        if (Pst.caul > 0 && this.attN) this.detach();
        let tx = this.hx + Math.sin(B.time * 0.07 + this.id) * 6, ty = this.hy + Math.cos(B.time * 0.05) * 6, tz = this.hz, spd = 0.4;
        if (this.state === 'flee') { tx = this.x + (this.x - Pp.x); ty = this.y + (this.y - Pp.y); tz = this.z; spd = 2.2; if ((this.fleeT -= dt) <= 0) this.state = 'satiate', this.satT = 6; }
        else if (this.state === 'satiate') { if ((this.satT -= dt) <= 0) this.state = 'diffuse'; }
        else {
          // chemotaxis: biomass in the culture tank, or a corpse
          const scent = (Pst.cells.length > 0 ? 1 + Pst.cells.length : 0.4);
          if (!ignore && dp < 18 + scent * 4) {
            this.state = dp < 2.2 ? 'strip' : 'converge'; tx = Pp.x; ty = Pp.y; tz = Pp.z; spd = 1.3;
          } else if (this.state !== 'diffuse') { this.state = 'diffuse'; this.detach(); }
        }
        const d = Math.hypot(tx - this.x, ty - this.y, tz - this.z) || 1;
        this.x += (tx - this.x) / d * Math.min(spd, d) * dt; this.y += (ty - this.y) / d * Math.min(spd, d) * dt; this.z += (tz - this.z) / d * Math.min(spd, d) * dt;
        const f = H(this.x, this.y); if (this.z > f - 0.6) this.z = f - 0.6;
        // stripping
        if (this.state === 'strip') {
          const want = Math.min(this.n * 0.5, this.attN + dt * 120);
          for (let k = 0; k < this.n && this.attN < want; k++) if (!this.att[k]) { this.att[k] = 1; this.attN++; }
          this.stripT += dt;
          B.Player.stripped(this.attN, dt);
          if (this.stripT > 40 || this.took >= 2) { this.state = 'satiate'; this.satT = 60; this.detach(); this.stripT = 0; this.took = 0; }
        }
        // agents
        const t = B.time, lampOn = R.env.lamp.on;
        for (let k = 0; k < this.n; k++) {
          if (this.att[k]) { const a = this.ph[k] + t * 3; this.ax[k] = Pp.x + Math.cos(a) * 0.45 * ((k % 7) / 7 + 0.3); this.ay[k] = Pp.y + Math.sin(a) * 0.3; this.az[k] = Pp.z - 0.9 + ((k * 37) % 100) / 100 * 2.1; continue; }
          const spread = this.state === 'converge' || this.state === 'strip' ? 0.45 : 1;
          const a = this.ph[k] + t * 0.4;
          const gx = this.x + (this.ox[k] * Math.cos(a * 0.3) - this.oy[k] * Math.sin(a * 0.3)) * spread, gy = this.y + (this.ox[k] * Math.sin(a * 0.3) + this.oy[k] * Math.cos(a * 0.3)) * spread, gz = this.z + this.oz[k] * spread;
          this.ax[k] += (gx - this.ax[k]) * Math.min(1, dt * 1.5) + Math.sin(t * 5 + k) * 0.01;
          this.ay[k] += (gy - this.ay[k]) * Math.min(1, dt * 1.5) + Math.cos(t * 4.3 + k) * 0.01;
          this.az[k] += (gz - this.az[k]) * Math.min(1, dt * 1.5);
          if (lampOn && (k & 7) === (B.frame & 7) && E.inLamp(this.ax[k], this.ay[k], this.az[k], 10) > 0) { this.ax[k] += (this.ax[k] - Pp.x) * 0.15; this.ay[k] += (this.ay[k] - Pp.y) * 0.15; }
        }
        B.grainLevel = Math.max(B.grainLevel || 0, M.clamp(1 - dp / 25, 0, 1) * (this.state === 'converge' || this.state === 'strip' ? 1 : 0.4));
      },
      detach() { this.att.fill(0); this.attN = 0; },
      killSome(frac) {
        const m = Math.floor(this.n * frac);
        E.motes(this.x, this.y, this.z, Math.min(80, m), 3, [[0.6, 0.6, 0.55]], 8);
        this.n = Math.max(40, this.n - m);
      },
      draw() {
        const t = B.time, deep = B.act === 'act3';
        const water = R.waterAt(R.cam.z);
        for (let k = 0; k < this.n; k++) {
          const x = this.ax[k], y = this.ay[k], z = this.az[k];
          if (this.att[k]) { const fl = ((k + (t * 20 | 0)) % 5) === 0; R.point(x, y, z - 0.5, 1, fl ? 0.9 : 0.5, fl ? 0.75 : 0.42, fl ? 0.7 : 0.4, 1); continue; }
          const L = R.lightAt(x, y, z);
          if (L > 0.02) R.point(x, y, z, 1, 0.9, 0.82, 0.78, false);
          else if (!deep) {
            // hiding in the dither: draw in the dark tone, snapped one pixel off the Bayer grid (the seam is the tell)
            const sx = Math.round(R.sx(x)), sy = Math.round(R.sy(y, z));
            if (((sx + sy + 1) & 1) === 0) R.point(x, y, z, 1, water[0] * 6 + 0.002, water[1] * 6 + 0.004, water[2] * 6 + 0.012, 1);
          }
        }
      },
    });
  };

  // ================================================================== small fauna
  E.squid = function (x, y, z, kind) {
    const s = E.add({
      type: 'squid', kind, x, y, z, yaw: Math.random() * 6.28, pitch: 0, stunned: 0, dead: false, t: 0, r: 0.5, jetT: 0,
      update(dt) {
        const Pp = pl(); if (!Pp) return; this.t += dt;
        if (this.dead) { this.z += dt * 0.2; E.collide(this, 0.3); return; }
        if (this.stunned > 0) { this.stunned -= dt; this.vx *= 0.97; this.vy *= 0.97; this.x += this.vx * dt; this.y += this.vy * dt; this.z += dt * 0.05; return; }
        const dp = dist(this, Pp.x, Pp.y, Pp.z);
        const ps = Math.hypot(Pp.vx, Pp.vy, Pp.vz);
        if (dp < 1.3 && ps > 2.3) { this.stunned = 14; A.at('impact', this.x, this.y, this.z, 0.4); this.vx = Pp.vx * 0.6; this.vy = Pp.vy * 0.6; return; }
        const lit = E.inLamp(this.x, this.y, this.z, 7) > 0;
        if (this.kind === 'mourning' && lit && this.jetT <= 0 && dp < 7) { E.bloomCloud(this.x, this.y, this.z); this.jetT = 20; this.yaw = Math.atan2(this.y - Pp.y, this.x - Pp.x); }
        this.jetT -= dt;
        const flee = dp < 6 && (lit || this.jetT > 15);
        const tx = flee ? this.x + (this.x - Pp.x) * 2 : this.x + Math.cos(this.yaw + Math.sin(this.t * 0.3) * 1.5) * 4;
        const ty = flee ? this.y + (this.y - Pp.y) * 2 : this.y + Math.sin(this.yaw + Math.sin(this.t * 0.3) * 1.5) * 4;
        const tz = this.z + Math.sin(this.t * 0.2 + this.id) * 1.5;
        steer(this, tx, ty, tz, flee ? 2.4 : (Math.sin(this.t * 1.3) > 0.6 ? 1.2 : 0.3), 1.5, dt, 2);
        avoid(this, 0.8, dt);
      },
      draw() { R.model(this.x, this.y, this.z, MD.squid({ yaw: this.yaw, kind: this.kind, stunned: this.stunned > 0 || this.dead }), { dim: this.dead ? 0.6 : 1 }); },
      interact: { label: () => (s.stunned > 0 || s.dead) ? 'ABSORB (HOLD)' : null, hold: 1.2, fn() { B.Player.absorb(s, s.kind === 'mourning' ? 'bloom' : 'siphon'); s.alive = false; } },
    });
    return s;
  };
  // A carcass whose scavengers yield a strain (whale fall slimewives -> Caul; the Sleeper's pickled body -> Graft).
  E.carcass = function (x, y, z, strain, charges, o) {
    const cc = E.add(Object.assign({
      type: 'carcass', x, y, z, strain, charges, yaw: 0.6, t: 0, r: 2, anchor: true,
      update(dt) { this.t += dt; },
      draw() {
        if (this.model !== false) R.model(this.x, this.y, this.z, MD.carcass({ yaw: this.yaw }), {});
        if (this.wives) for (let k = 0; k < Math.max(1, this.charges + 2); k++) R.model(this.x + Math.cos(k * 2.1) * 2.2, this.y + Math.sin(k * 1.7) * 1.2, this.z - 0.4, MD.slimewife({ yaw: k * 1.3, t: this.t + k }), {});
      },
      interact: { label: () => cc.charges > 0 ? 'ABSORB ' + (cc.strain === 'caul' ? 'SLIMEWIFE MUCUS' : 'BIOMASS') + ' (HOLD)' : null, hold: 1.2, fn() { if (cc.charges > 0 && B.Player.absorb(cc, cc.strain)) cc.charges--; } },
    }, o));
    return cc;
  };
  // Lanternfish swarm in the Phantom Floor: brushing through it sets off the burglar alarm.
  E.lanterns = function (x, y, z, n) {
    const P2 = []; for (let k = 0; k < n; k++) P2.push({ x: x + M.rnd(-12, 12), y: y + M.rnd(-12, 12), z: z + M.rnd(-8, 8), a: Math.random() * 6.28 });
    return E.add({
      type: 'lanterns', x, y, z, P: P2, cool: 0, layer: 3,
      update(dt) {
        const Pp = pl(); if (!Pp) return; this.cool -= dt;
        const ps = Math.hypot(Pp.vx, Pp.vy, Pp.vz);
        for (const f of this.P) {
          f.a += dt * 0.6; f.x += Math.cos(f.a) * dt * 0.4; f.y += Math.sin(f.a * 0.8) * dt * 0.4;
          const d = Math.hypot(f.x - Pp.x, f.y - Pp.y, f.z - Pp.z);
          if (d < 2.5) { f.x += (f.x - Pp.x) / d * dt * 3; f.y += (f.y - Pp.y) / d * dt * 3; if (ps > 1.2 && d < 1.2 && this.cool <= 0) { this.cool = 25; E.alarm(Pp.x, Pp.y, Pp.z); B.Story && B.Story.onAlarm && B.Story.onAlarm(); } }
        }
      },
      draw() { for (const f of this.P) { const tw = 0.6 + 0.4 * Math.sin(B.time * 3 + f.a * 5); R.point(f.x, f.y, f.z, 1, 0.15 * tw, 0.5 * tw, 1.1 * tw, 2); } },
    });
  };
  // Small reef fish in the sunlit zone.
  E.fish = function (x, y, z, n, hex) {
    const P2 = [], cc = B.linHex(hex || '#d8d0a0'); for (let k = 0; k < n; k++) P2.push({ x: x + M.rnd(-3, 3), y: y + M.rnd(-3, 3), z: z + M.rnd(-2, 2), vx: 0, vy: 0 });
    return E.add({
      type: 'fish', x, y, z, P: P2, a: Math.random() * 6.28,
      update(dt) {
        const Pp = pl(); if (!Pp) return;
        this.a += dt * 0.3; const cx = x + Math.cos(this.a) * 6, cy = y + Math.sin(this.a * 1.3) * 5;
        for (const f of this.P) {
          const d = Math.hypot(f.x - Pp.x, f.y - Pp.y, f.z - Pp.z);
          let ax = (cx - f.x) * 0.5, ay = (cy - f.y) * 0.5; if (d < 4) { ax += (f.x - Pp.x) * 3; ay += (f.y - Pp.y) * 3; }
          f.vx = (f.vx + ax * dt) * 0.96; f.vy = (f.vy + ay * dt) * 0.96; f.x += f.vx * dt; f.y += f.vy * dt;
        }
      },
      draw() { for (const f of this.P) R.point(f.x, f.y, f.z, 1, cc[0], cc[1], cc[2], false); },
    });
  };

  // ================================================================== THE SECOND DIVER
  // Replays a slice of the player's recorded movement, offset in space. Pings it makes lay real trails.
  E.ghost = function (startFrame, frames, offX, offY, offZ) {
    const g = E.add({
      type: 'ghost', x: 0, y: 0, z: 0, f: 0, frames, startFrame, offX, offY, offZ, trail: [], ring: 0, yaw: 0, kick: 0, lamp: 'white',
      update(dt) {
        const rec = B.Player.recFrame(this.startFrame + Math.floor(this.f)); this.f += dt * 60;
        if (!rec || this.f > this.frames) { this.alive = false; return; }
        this.x = rec[0] + this.offX; this.y = rec[1] + this.offY; this.z = rec[2] + this.offZ; this.yaw = rec[3]; this.kick = rec[4];
        this.lamp = rec[5] === 1 ? 'white' : rec[5] === 2 ? 'red' : 'off';
        if (rec[6] === 1) { const ev = B.noise(this.x, this.y, this.z, 120, 'ghostping'); if (ev) ev.src = this; this.ring = 10; A.at('ping', this.x, this.y, this.z, 0.8); }
        if (this.ring > 0) { this.ring -= dt; if (B.frame % 15 === 0) this.trail.push({ x: this.x, y: this.y, z: this.z, t: B.time }); }
        this.trail = this.trail.filter(n => B.time - n.t < 12);
        const Pp = pl(); if (Pp) B.flange = Math.max(B.flange || 0, Math.hypot(this.x - Pp.x, this.y - Pp.y, this.z - Pp.z) < 10 ? 1 : 0);
      },
      draw() {
        const st = B.Player.state(), L = B.lensOn;
        if (L && Math.hypot(L.x - R.sx(this.x), L.y - R.sy(this.y, this.z)) < L.r) return; // the lens sees no copy
        R.model(this.x, this.y, this.z, MD.diver({ yaw: MD.quant8(this.yaw), t: B.time, kick: this.kick, lamp: this.lamp, fill: 0.5, tankCol: [0.35, 0.05, 0.4] }), { scale: st.res, lut: 1, flip: st.flipped && Math.cos(this.yaw) < -0.3 });
        if (this.lamp === 'white') R.addLight(this.x + Math.cos(this.yaw) * 2, this.y + Math.sin(this.yaw) * 2, this.z + 1, 1, 0.9, 0.8, 8, 0.8);
      },
    });
    return g;
  };
  // Act III: the copy has mass. It closes in from outside the light and holds on.
  E.double = function (x, y, z) {
    const d = E.add({
      type: 'double', x, y, z, yaw: 0, pitch: 0, mode: 'stalk', holdT: 0, cool: 0, r: 0.9, shadow: true, t: 0, stolen: 0,
      update(dt) {
        const Pp = pl(); if (!Pp) return; this.t += dt;
        const dp = dist(this, Pp.x, Pp.y, Pp.z), lit = E.inLamp(this.x, this.y, this.z, 14) > 0;
        B.flange = Math.max(B.flange || 0, dp < 10 ? 1 : 0);
        if (this.mode === 'stun') { if ((this.cool -= dt) <= 0) this.mode = 'stalk'; this.z += dt * 0.2; return; }
        if (this.mode === 'away') { steer(this, this.x + (this.x - Pp.x), this.y + (this.y - Pp.y), this.z, 2, 2, dt); if ((this.cool -= dt) <= 0) { this.mode = 'stalk'; } return; }
        if (this.mode === 'hold') {
          this.x = Pp.x - Math.cos(Pp.yaw) * 0.5; this.y = Pp.y - Math.sin(Pp.yaw) * 0.5; this.z = Pp.z;
          this.holdT += dt;
          if (B.Player.state().caul > 0) { this.mode = 'away'; this.cool = 12; B.Player.say('mara', 'IT SLID OFF.'); return; }
          if (this.holdT > 4) { B.Player.loseFidelity(2, 'double'); this.stolen += 2; this.mode = 'away'; this.cool = 20; }
          return;
        }
        // stalk from outside the lamp; rush when close
        if (lit && dp > 5) { const a = Math.atan2(this.y - Pp.y, this.x - Pp.x) + 0.8; steer(this, Pp.x + Math.cos(a) * 16, Pp.y + Math.sin(a) * 16, Pp.z, 1.6, 2, dt); }
        else steer(this, Pp.x, Pp.y, Pp.z, dp < 8 ? 2.6 : 1.2, 2, dt);
        avoid(this, 1, dt);
        if (dp < 1.4 && (this.cool -= dt) <= 0) { this.mode = 'hold'; this.holdT = 0; A.sfx('knock'); B.Player.grabbed(this); }
      },
      shake() { if (this.mode === 'hold') { this.holdT -= 0.25; if (this.holdT < -0.5) { this.mode = 'away'; this.cool = 10; } } },
      stun() { this.mode = 'stun'; this.cool = 15; },
      draw() {
        const st = B.Player.state();
        R.model(this.x, this.y, this.z, MD.diver({ yaw: MD.quant8(this.yaw), t: this.t, kick: 0.8, lamp: 'off', fill: 0.8, tankCol: [0.4, 0.05, 0.3], growth: 0.6 }), { scale: st.res, lut: 1 });
        if (B.Player.revealed(this)) R.wire(this.x, this.y, this.z, MD.diver({ yaw: this.yaw, plain: [] }), B.SONAR, st.res);
      },
    });
    return d;
  };
})(window.B);
