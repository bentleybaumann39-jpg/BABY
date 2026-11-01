// Drivable buggies and supply airdrops. Server-authoritative; pure JS (no DOM / three.js).
import { DT, TICK_RATE, MODE, BTN, GRAVITY, WATER_LEVEL, MAP_HALF } from '../constants.js';
import { Rng, clamp, wrapAngle, lerp } from '../rng.js';
import { WEAPONS, AMMO } from './Items.js';

export const BUGGY = {
  maxFwd: 25, maxRev: 8, accel: 10, brake: 22, drag: 0.35, turn: 1.7, hp: 320, radius: 1.25,
  seats: [{ x: -0.42, y: 0.55, z: 0.15 }, { x: 0.42, y: 0.55, z: 0.15 }], // driver (left), passenger (right)
};
export const ENTER_RANGE = 3.6;

// ---------------------------------------------------------------- spawning
export function spawnVehicles(sim) {
  const map = sim.map, rng = new Rng(sim.seed ^ 0x7e41c1e);
  const out = [];
  let tries = 0;
  while (out.length < 16 && tries++ < 600) {
    const road = rng.pick(map.roads);
    const k = rng.int(0, road.pts.length - 2);
    const t = rng.range(0.1, 0.9);
    const [ax, az] = road.pts[k], [bx, bz] = road.pts[k + 1];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const side = rng.chance(0.5) ? 1 : -1;
    const x = lerp(ax, bx, t) + (-(bz - az) / len) * 3.2 * side, z = lerp(az, bz, t) + ((bx - ax) / len) * 3.2 * side;
    if (Math.abs(x) > MAP_HALF - 30 || Math.abs(z) > MAP_HALF - 30) continue;
    if (map.riverDist(x, z) < 14) continue;
    if (out.some(v => Math.hypot(v.x - x, v.z - z) < 110)) continue;
    if (sim.world.overlaps(x - 1.4, map.heightAt(x, z) + 0.3, z - 1.4, x + 1.4, map.heightAt(x, z) + 1.8, z + 1.4) >= 0) continue;
    const yaw = Math.atan2(-(bx - ax), -(bz - az)) + (rng.chance(0.5) ? Math.PI : 0);
    out.push({ id: out.length + 1, x, y: map.heightAt(x, z), z, yaw, speed: 0, vy: 0, pitch: 0, roll: 0, hp: BUGGY.hp, seats: [-1, -1], alive: true, lastDriver: -1 });
  }
  for (const v of out) sim.vehicles.set(v.id, v);
}

// ---------------------------------------------------------------- seats
export function enterVehicle(sim, p, id) {
  const v = sim.vehicles.get(id);
  if (!v || !v.alive || p.m.mode !== MODE.GROUND || p.vehicle) return false;
  if (Math.hypot(p.m.x - v.x, p.m.z - v.z) > ENTER_RANGE || Math.abs(p.m.y - v.y) > 2.5) return false;
  const seat = v.seats[0] < 0 ? 0 : v.seats[1] < 0 ? 1 : -1;
  if (seat < 0) return false;
  v.seats[seat] = p.id;
  p.vehicle = v.id; p.seat = seat;
  p.m.mode = MODE.VEHICLE; p.m.vx = p.m.vy = p.m.vz = 0; p.m.crouch = false; p.m.slide = 0; p.m.vault = 0;
  if (p.act && p.act.k !== 6) p.act = null;
  placeInSeat(v, p);
  sim.emit({ e: 'enter', p: p.id, v: v.id, seat });
  return true;
}

export function exitVehicle(sim, p, forced = false) {
  const v = sim.vehicles.get(p.vehicle);
  p.vehicle = 0;
  if (!v) { if (p.m.mode === MODE.VEHICLE) p.m.mode = MODE.GROUND; return; }
  v.seats[p.seat] = -1;
  // step out to the side (try both sides, then behind)
  const sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
  const sideX = cy, sideZ = -sy;
  const cand = [[(p.seat === 0 ? -1 : 1) * 1.9, 0], [(p.seat === 0 ? 1 : -1) * 1.9, 0], [0, 3.2], [0, -3.2]];
  let placed = false;
  for (const [s, f] of cand) {
    const x = v.x + sideX * s + sy * f, z = v.z + sideZ * s + cy * f;
    const y = sim.world.heightAt(x, z) + 0.05;
    if (sim.world.overlaps(x - 0.35, y + 0.05, z - 0.35, x + 0.35, y + 1.8, z + 0.35) < 0) { p.m.x = x; p.m.y = Math.max(y, v.y); p.m.z = z; placed = true; break; }
  }
  if (!placed) { p.m.y = v.y + 2.0; }
  if (p.m.mode === MODE.VEHICLE) p.m.mode = MODE.GROUND;
  p.m.vx = v.speed * -sy * 0.4; p.m.vz = v.speed * -cy * 0.4; p.m.vy = 0; p.m.grounded = false;
  sim.emit({ e: 'exit', p: p.id, v: v.id, forced: forced ? 1 : 0 });
}

function placeInSeat(v, p) {
  const s = BUGGY.seats[p.seat];
  const sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
  // local x = right, local z = back
  p.m.x = v.x + cy * s.x + sy * s.z;
  p.m.z = v.z - sy * s.x + cy * s.z;
  p.m.y = v.y + s.y;
}

// ---------------------------------------------------------------- driving
export function driveInput(sim, p, inp) {
  const v = sim.vehicles.get(p.vehicle);
  if (!v || p.seat !== 0) return;
  v.throttle = clamp(+inp.mz || 0, -1, 1);
  v.steer = clamp(+inp.mx || 0, -1, 1);
  v.brake = !!(inp.buttons & BTN.JUMP);
  v.boost = !!(inp.buttons & BTN.SPRINT);
  v.lastDriver = p.id;
  v.inputTick = sim.tick;
}

export function stepVehicles(sim) {
  const world = sim.world;
  for (const v of sim.vehicles.values()) {
    if (!v.alive) continue;
    const driver = v.seats[0] >= 0 ? sim.players.get(v.seats[0]) : null;
    const fresh = driver && sim.tick - (v.inputTick || 0) < 24;
    const thr = fresh ? v.throttle || 0 : 0, steer = fresh ? v.steer || 0 : 0;
    const inWater = world.heightAt(v.x, v.z) < WATER_LEVEL - 0.3;
    // longitudinal
    const max = (inWater ? 6 : BUGGY.maxFwd) * (v.boost ? 1.08 : 1);
    if (fresh && v.brake) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), BUGGY.brake * DT);
    else if (thr > 0.05) v.speed += (v.speed < 0 ? BUGGY.brake : BUGGY.accel) * thr * DT;
    else if (thr < -0.05) v.speed += (v.speed > 0 ? -BUGGY.brake : -BUGGY.accel * 0.7) * -thr * DT;
    else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 3 * DT);
    v.speed -= v.speed * Math.abs(v.speed) * 0.0009 * BUGGY.drag;
    v.speed = clamp(v.speed, -BUGGY.maxRev, max);
    // slope: gravity along the heading
    const sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
    const hf = world.heightAt(v.x - sy * 1.4, v.z - cy * 1.4), hb = world.heightAt(v.x + sy * 1.4, v.z + cy * 1.4);
    const slope = (hf - hb) / 2.8;
    v.speed -= GRAVITY * 0.45 * clamp(slope, -0.8, 0.8) * DT;
    // steering (handbrake tightens the turn)
    const grip = clamp(Math.abs(v.speed) / 7, 0, 1) * (1 - clamp((Math.abs(v.speed) - 18) / 20, 0, 0.35));
    v.yaw = wrapAngle(v.yaw - steer * BUGGY.turn * grip * Math.sign(v.speed || 1) * (v.brake ? 1.45 : 1) * DT);
    // move with collision
    const nx = v.x - Math.sin(v.yaw) * v.speed * DT, nz = v.z - Math.cos(v.yaw) * v.speed * DT;
    const gy = world.heightAt(nx, nz);
    const R = BUGGY.radius;
    const hit = world.overlaps(nx - R, Math.max(gy, v.y) + 0.45, nz - R, nx + R, Math.max(gy, v.y) + 1.5, nz + R) >= 0;
    if (hit || Math.abs(nx) > MAP_HALF - 6 || Math.abs(nz) > MAP_HALF - 6) {
      const impact = Math.abs(v.speed);
      if (impact > 7) {
        damageVehicle(sim, v, (impact - 7) * 6, null);
        for (const pid of v.seats) if (pid >= 0) { const o = sim.players.get(pid); if (o && impact > 11) sim.applyDamage(o, null, (impact - 11) * 2.5, 'torso', 'crash'); }
        sim.emit({ e: 'crash', v: v.id, s: Math.round(impact) });
      }
      v.speed *= -0.25;
    } else { v.x = nx; v.z = nz; }
    // vertical: follow terrain, fly off crests
    v.vy -= GRAVITY * DT;
    v.y += v.vy * DT;
    const g = world.heightAt(v.x, v.z);
    if (v.y <= g) {
      if (v.vy < -9) { damageVehicle(sim, v, (-v.vy - 9) * 8, null); }
      v.y = g; v.vy = Math.max(0, (g - (v.prevG ?? g)) / DT * 0.6);
      if (v.vy > 9) v.vy = 9;
    }
    v.prevG = g;
    // body orientation from the wheels
    const fl = world.heightAt(v.x - sy * 1.3 - cy * 0.8, v.z - cy * 1.3 + sy * 0.8), fr = world.heightAt(v.x - sy * 1.3 + cy * 0.8, v.z - cy * 1.3 - sy * 0.8);
    const bl = world.heightAt(v.x + sy * 1.3 - cy * 0.8, v.z + cy * 1.3 + sy * 0.8), br = world.heightAt(v.x + sy * 1.3 + cy * 0.8, v.z + cy * 1.3 - sy * 0.8);
    v.pitch = lerp(v.pitch, Math.atan2(((fl + fr) - (bl + br)) / 2, 2.6), 0.3);
    v.roll = lerp(v.roll, Math.atan2(((fr + br) - (fl + bl)) / 2, 1.6), 0.3);
    // run-overs
    if (Math.abs(v.speed) > 4.5) {
      for (const o of sim.list) {
        if (!o.alive || o.vehicle || o.m.mode === MODE.PLANE || o.m.mode === MODE.FREEFALL || o.m.mode === MODE.CHUTE) continue;
        if (Math.abs(o.m.y - v.y) > 2 || Math.hypot(o.m.x - v.x, o.m.z - v.z) > 1.9) continue;
        const drv = driver && driver.squad !== o.squad ? driver : null;
        if (driver && driver.squad === o.squad) continue;
        sim.applyDamage(o, drv, Math.abs(v.speed) * 4.2, 'torso', 'buggy');
        o.m.vx = -Math.sin(v.yaw) * v.speed * 0.6; o.m.vz = -Math.cos(v.yaw) * v.speed * 0.6; o.m.vy = 4;
        v.speed *= 0.8;
      }
    }
    // occupants ride along
    for (const pid of v.seats) if (pid >= 0) { const o = sim.players.get(pid); if (o) placeInSeat(v, o); }
  }
}

export function damageVehicle(sim, v, dmg, attacker) {
  if (!v.alive || dmg <= 0) return;
  v.hp -= dmg;
  if (v.hp > 0) return;
  v.alive = false;
  sim.emit({ e: 'vboom', v: v.id, x: Math.round(v.x * 100) / 100, y: Math.round(v.y * 100) / 100, z: Math.round(v.z * 100) / 100 });
  for (const pid of v.seats) if (pid >= 0) { const o = sim.players.get(pid); if (o) { exitVehicle(sim, o, true); sim.applyDamage(o, attacker, 85, 'blast', 'buggy'); } }
  for (const o of sim.list) {
    if (!o.alive) continue;
    const d = Math.hypot(o.m.x - v.x, o.m.y - v.y, o.m.z - v.z);
    if (d < 6) sim.applyDamage(o, attacker && attacker.squad !== o.squad ? attacker : null, 70 * (1 - d / 6), 'blast', 'buggy');
  }
  sim.vehicles.delete(v.id);
}

// Ray vs vehicle body (sphere approximation of the chassis). Returns {t, v} or null.
export function rayVehicles(sim, ox, oy, oz, dx, dy, dz, maxT) {
  let best = null;
  for (const v of sim.vehicles.values()) {
    if (!v.alive) continue;
    const cx = v.x - ox, cy = v.y + 0.7 - oy, cz = v.z - oz;
    const t = cx * dx + cy * dy + cz * dz;
    if (t < 0 || t > maxT) continue;
    const px = cx - dx * t, py = cy - dy * t, pz = cz - dz * t;
    const r2 = 1.15 * 1.15;
    const d2 = px * px + py * py + pz * pz;
    if (d2 > r2) continue;
    const th = t - Math.sqrt(r2 - d2);
    if (!best || th < best.t) best = { t: th, v };
  }
  return best;
}

export function vehicleWire(v) {
  return { id: v.id, x: v.x, y: v.y, z: v.z, yaw: v.yaw, pitch: v.pitch, roll: v.roll, speed: v.speed, hp: Math.max(0, Math.round(v.hp / BUGGY.hp * 255)), d: v.seats[0], s: v.seats[1] };
}

// ---------------------------------------------------------------- airdrops
const DROP_LOOT = [
  () => [{ k: 'weapon', id: 'longreach', att: { optic: 'x8', mag: null, muzzle: 'suppressor', grip: null } }, { k: 'ammo', id: '338', n: 20 }],
  () => [{ k: 'weapon', id: 'mattock', att: { optic: 'x4', mag: null, muzzle: null, grip: 'grip' } }, { k: 'ammo', id: '556', n: 90 }],
  () => [{ k: 'weapon', id: 'sable', att: { optic: 'x8', mag: 'extmag', muzzle: null, grip: null } }, { k: 'ammo', id: '762', n: 60 }],
  () => [{ k: 'weapon', id: 'tern', att: { optic: 'x4', mag: 'extmag', muzzle: 'suppressor', grip: 'grip' } }, { k: 'ammo', id: '556', n: 90 }],
];

export function scheduleAirdrop(sim) {
  const z = sim.zone, rng = sim.rng;
  const c = z.next;
  for (let t = 0; t < 30; t++) {
    const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.next()) * c.r * 0.75;
    const x = c.x + Math.cos(a) * r, zz = c.z + Math.sin(a) * r;
    if (Math.abs(x) > MAP_HALF - 20 || Math.abs(zz) > MAP_HALF - 20) continue;
    const g = sim.world.heightAt(x, zz);
    if (g < WATER_LEVEL + 0.5) continue;
    if (sim.world.overlaps(x - 1.5, g - 1, zz - 1.5, x + 1.5, g + 220, zz + 1.5) >= 0) continue;
    const d = { id: sim.nextDrop = (sim.nextDrop || 0) + 1, x, z: zz, g, y0: g + 260, t0: sim.tick, speed: 7, landed: false };
    sim.airdrops.push(d);
    sim.emit({ e: 'airdrop', id: d.id, x: Math.round(x * 100) / 100, z: Math.round(zz * 100) / 100, g: Math.round(g * 100) / 100, y0: d.y0, t0: d.t0, sp: d.speed });
    sim.noises.push({ x, y: g + 100, z: zz, r: 500, tick: sim.tick, p: -1, kind: 'airdrop' });
    return d;
  }
  return null;
}

export function stepAirdrops(sim) {
  for (const d of sim.airdrops) {
    if (d.landed) continue;
    const y = d.y0 - (sim.tick - d.t0) * DT * d.speed;
    if (y > d.g) continue;
    d.landed = true;
    const loot = DROP_LOOT[sim.rng.int(0, DROP_LOOT.length - 1)]();
    loot.push({ k: sim.rng.chance(0.5) ? 'helmet' : 'vest', tier: 3 }, { k: 'pack', tier: 3 }, { k: 'heal', id: 'kit', n: 1 }, { k: 'heal', id: 'kit', n: 1 }, { k: 'heal', id: 'stim', n: 1 }, { k: 'throw', id: 'frag', n: 1 });
    loot.forEach((it, i) => {
      if (it.k === 'weapon') it.mag = WEAPONS[it.id].mag;
      const a = i * 2.39996, r = 0.35 + 0.18 * Math.sqrt(i);
      sim.addItem(it, d.x + Math.cos(a) * r, d.g + 0.35, d.z + Math.sin(a) * r);
    });
    sim.emit({ e: 'droplanded', id: d.id, x: Math.round(d.x * 100) / 100, y: Math.round(d.g * 100) / 100, z: Math.round(d.z * 100) / 100 });
  }
}

void TICK_RATE; void AMMO;
