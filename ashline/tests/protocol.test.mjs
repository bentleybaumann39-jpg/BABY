// Round-trip tests for the binary wire format.
import { encodeInput, decodeInput, quantizeInput, encodeSnapshot, decodeSnapshot, weaponFromWire } from '../shared/net/Protocol.js';
import { levelInfo, xpToNext, matchXp, applyMatch, newProfile, sanitizeCosmetics } from '../shared/progression.js';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const near = (a, b, e = 1e-4) => Math.abs(a - b) <= e;

// inputs
for (const inp of [
  { seq: 0, viewTick: 0, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: 0 },
  { seq: 4294967295, viewTick: 123456.5, mx: -1, mz: 1, yaw: -3.14159, pitch: 1.55, buttons: 0xffff },
  { seq: 77, viewTick: 10.25, mx: 0.3333, mz: -0.7071, yaw: 12.5, pitch: -1.2, buttons: 1 | 4 | 64 },
]) {
  const q = quantizeInput({ ...inp });
  const d = decodeInput(encodeInput(inp));
  ok(d.seq === (inp.seq >>> 0), 'input seq');
  ok(d.mx === q.mx && d.mz === q.mz, 'input axes quantised identically');
  ok(d.yaw === q.yaw && d.pitch === q.pitch, 'input angles quantised identically');
  ok(d.buttons === inp.buttons, 'input buttons');
  ok(near(d.viewTick, inp.viewTick, 0.01), 'input viewTick');
}
ok(decodeInput(new ArrayBuffer(3)) === null, 'short input rejected');

// snapshots
const snap = {
  tick: 999999, ack: 4242,
  self: { x: 123.456789, y: 12.5, z: -400.25, vx: 1.5, vy: -9.8, vz: 0, mode: 3, grounded: true, crouch: false, alive: true, airT: 0.5, pb: 9, hp: 63.5, boost: 40, bleed: 77.7, slot: 2, mag: 30, act: 4, actP: 0.5, spec: -1 },
  zone: { cx: 10, cz: -20, cr: 380, nx: 30, nz: 40, nr: 240, phase: 1, state: 1, timer: 33.5 },
  plane: { x: -500, z: 20, active: true }, alive: 27, squads: 12,
  players: [
    { id: 1001, x: 1, y: 2, z: 3, yaw: -1, pitch: 0.3, mode: 0, flags: 129, weapon: 3, gear: 0b110101, hp: 255 },
    { id: 7, x: -511, y: 90, z: 511, yaw: 6.2, pitch: -1.5, mode: 3, flags: 0, weapon: 20, gear: 0, hp: 40 },
  ],
  proj: [{ id: 5, k: 1, x: 3, y: 4, z: 5 }],
};
const d = decodeSnapshot(encodeSnapshot(snap));
ok(d.tick === snap.tick && d.ack === snap.ack, 'snap header');
ok(d.self.x === snap.self.x && d.self.vy === snap.self.vy && d.self.mode === 3 && d.self.grounded && !d.self.crouch && d.self.alive, 'self state exact');
ok(near(d.self.hp, 63.5, 0.01) && near(d.self.bleed, 77.7, 0.01) && d.self.mag === 30 && d.self.slot === 2 && near(d.self.actP, 0.5, 0.001) && d.self.spec === -1, 'self status');
ok(near(d.zone.cr, 380) && d.zone.state === 1 && near(d.zone.timer, 33.5), 'zone');
ok(d.plane.active && near(d.plane.x, -500), 'plane');
ok(d.players.length === 2 && d.players[0].id === 1001 && d.players[0].flags === 129 && d.players[0].gear === 0b110101, 'players');
ok(near(d.players[0].yaw, (-1 + Math.PI * 2), 1e-3) && near(d.players[0].pitch, 0.3, 1e-3), 'player angles');
ok(d.players[1].hp === 40 && d.players[1].weapon === 20 && weaponFromWire(20) === 'throw' && weaponFromWire(3) === 'kr5', 'weapon codes');
ok(d.proj.length === 1 && d.proj[0].k === 1 && near(d.proj[0].z, 5), 'projectiles');
const empty = decodeSnapshot(encodeSnapshot({ ...snap, self: null, players: [], proj: [] }));
ok(empty.self === null && empty.players.length === 0, 'empty snapshot');
const big = { ...snap, players: Array.from({ length: 60 }, (_, i) => ({ ...snap.players[0], id: i })) };
ok(decodeSnapshot(encodeSnapshot(big)).players.length === 60, 'buffer grows for many players');

// progression
ok(levelInfo(0).level === 1 && levelInfo(xpToNext(1)).level === 2 && levelInfo(1e9).level === 50, 'level curve');
const r = { survived: 600, kills: 3, assists: 1, revives: 2, hacks: 1, dmg: 400, place: 1, alive: true, heads: 2, longest: 120 };
ok(matchXp(r).total === 60 * 5 + 300 + 40 + 150 + 60 + 100 + 600, 'match xp');
const prof = newProfile('T');
const res = applyMatch(prof, r, 'solo');
ok(prof.stats.wins === 1 && prof.history.length === 1 && res.after.level > 1 && res.unlocks.length > 0, 'apply match + unlocks');
ok(sanitizeCosmetics({ camo: 'ashborn', helmet: 'netting' }, 3).camo === 'olive' && sanitizeCosmetics({ helmet: 'netting' }, 3).helmet === 'netting', 'cosmetic lock');

console.log(fails ? `${fails} protocol test(s) FAILED` : 'protocol + progression tests passed');
process.exit(fails ? 1 : 0);
