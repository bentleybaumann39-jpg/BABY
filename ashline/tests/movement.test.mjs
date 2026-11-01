// Slide and vault mechanics in the shared movement step (server + prediction use the same code).
import { getWorld } from '../shared/sim/Setup.js';
import { createMoveState, stepMove, SLIDE } from '../shared/physics/Movement.js';
import { DT, BTN, PLAYER } from '../shared/constants.js';

let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const { world, map } = getWorld(undefined, false);

// --- slide on Old Marrow's main street
const town = map.pois.find(p => p.id === 'oldtown');
const s = createMoveState(town.x - 60.5, map.heightAt(town.x - 60.5, town.z), town.z);
const yaw = -Math.PI / 2; // facing +x along the street
const run = (n, buttons) => { for (let i = 0; i < n; i++) stepMove(s, { mx: 0, mz: 1, yaw, pitch: 0, buttons }, world, DT); };
run(30, BTN.SPRINT);
const sprintSpeed = Math.hypot(s.vx, s.vz);
const x0 = s.x;
run(1, BTN.SPRINT | BTN.CROUCH);
ok(s.slide > 0 && s.crouch, 'tapping crouch while sprinting starts a slide');
ok(Math.hypot(s.vx, s.vz) > sprintSpeed + 1, `slide boosts speed (${sprintSpeed.toFixed(1)} → ${Math.hypot(s.vx, s.vz).toFixed(1)} m/s)`);
run(Math.round(SLIDE.time / DT), BTN.CROUCH);
ok(s.slide === 0 && Math.hypot(s.vx, s.vz) < sprintSpeed, 'slide ends and bleeds speed');
ok(s.x - x0 > 3.5, `slide covers ground (${(s.x - x0).toFixed(1)} m)`);
run(1, BTN.SPRINT | BTN.CROUCH);
ok(s.slide === 0, 'slide has a cooldown');

// --- vault the fort's sandbag wall (1.0 m high, along x at z = fort.z - 40)
const fort = map.pois.find(p => p.id === 'fort');
const sx = fort.x + 0.2, wallZ = fort.z - 40;
const v = createMoveState(sx, map.heightAt(sx, wallZ + 1.6), wallZ + 1.6);
let vaulted = false, top = -Infinity;
for (let i = 0; i < 90; i++) {
  stepMove(v, { mx: 0, mz: 1, yaw: 0, pitch: 0, buttons: i > 5 && i < 8 ? BTN.JUMP : 0 }, world, DT);
  top = Math.max(top, v.y);
  if (v.vault > 0) vaulted = true;
}
ok(vaulted, 'jumping into a waist-high wall triggers a vault');
ok(v.z < wallZ - 0.5, `vault carries the player over the wall (z ${v.z.toFixed(2)} vs wall ${wallZ})`);
ok(top - map.heightAt(sx, wallZ + 1.6) > 1.0 && top - map.heightAt(sx, wallZ + 1.6) < 1.9, `vault height is sensible (${(top - map.heightAt(sx, wallZ + 1.6)).toFixed(2)} m)`);

// --- a tall wall cannot be vaulted
const w = createMoveState(fort.x + 20, map.heightAt(fort.x + 20, fort.z - 46.6), fort.z - 46.6);
for (let i = 0; i < 60; i++) stepMove(w, { mx: 0, mz: 1, yaw: 0, pitch: 0, buttons: i === 10 ? BTN.JUMP : 0 }, world, DT);
ok(w.z > fort.z - 48 + 0.2, 'the 2.6 m fort wall stops you (no vault)');
void PLAYER;
console.log(fails ? `${fails} movement check(s) FAILED` : 'all movement checks passed');
process.exit(fails ? 1 : 0);
