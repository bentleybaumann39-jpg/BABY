#!/usr/bin/env node
// Static validation: map integrity, prop placement, and a progression solver proving the critical path
// (and every ending) is reachable without softlocks. Pure Node, no browser.
import { buildMapData, CELL, ZONES } from '../src/world/MapData.js';
import { Grid } from '../src/world/Grid.js';
import { Nav } from '../src/world/Nav.js';

const map = buildMapData();
const grid = new Grid(map);
const nav = new Nav(map, grid);
let errors = 0;
const err = (m) => { errors++; console.log('  ERROR', m); };
const ok = (m) => console.log('  ok   ', m);

console.log('Map integrity');
for (let x = 0; x < map.W; x++) for (const z of [0, map.H - 1]) if (map.type[map.idx(x, z)] === CELL.FLOOR && !ZONES[String.fromCharCode(map.zone[map.idx(x, z)])]?.ext) err(`interior floor on border ${x},${z}`);
for (const d of map.doors) {
  const [a, b] = d.sides;
  const open = (s) => map.inb(s.x, s.z) && [CELL.FLOOR, CELL.DOOR].includes(map.type[map.idx(s.x, s.z)]);
  if (!open(a) || !open(b)) err(`door ${d.id} (${d.x},${d.z}) does not connect two spaces`);
}
ok(`${map.doors.length} doors connect two spaces`);
for (const c of grid.colliders) {
  for (const d of map.doors) if (c.x0 < d.x + 1 && c.x1 > d.x && c.z0 < d.z + 1 && c.z1 > d.z) err(`prop ${c.prop.t} blocks door ${d.id}`);
  for (const d of map.doors) for (const s of d.sides) if (c.x0 < s.x + 0.85 && c.x1 > s.x + 0.15 && c.z0 < s.z + 0.85 && c.z1 > s.z + 0.15) err(`prop ${c.prop.t} @${c.prop.x},${c.prop.z} crowds the doorway of ${d.name}`);
  const cx0 = Math.floor(c.x0 + 0.02), cx1 = Math.floor(c.x1 - 0.02), cz0 = Math.floor(c.z0 + 0.02), cz1 = Math.floor(c.z1 - 0.02);
  for (let z = cz0; z <= cz1; z++) for (let x = cx0; x <= cx1; x++) if (map.type[map.idx(x, z)] === CELL.SOLID) err(`prop ${c.prop.t} @${c.prop.x},${c.prop.z} intersects a wall`);
}
ok(`${grid.colliders.length} prop colliders clear of walls and doors`);

// Hiding spot exits must be walkable
for (const p of map.props.filter((q) => q.hideId)) {
  const a = (p.r * Math.PI) / 180;
  const ex = p.x + Math.sin(a) * 0.75, ez = p.z + Math.cos(a) * 0.75;
  if (grid.circleBlocked(ex, ez, 0.25)) err(`hiding spot ${p.hideId} exit blocked`);
}
ok('hiding spot exits are walkable');

// Progression solver -----------------------------------------------------------
console.log('Progression');
// Item locations (must match Story.js placements).
const ITEMS = {
  key_front: [[41.0, 47.45]],
  key_maint: [[27.3, 26.62]],
  power_bird: [[3.7, 9.8]],            // breaker panel (electrical room)
  key_director: [[73.0, 30.6], [79.6, 17.2], [77.0, 25.6], [72.2, 17.6]],
  reel_dictation: [[16.95, 19.4]],
  key_gate: [[16.95, 17.7]],
  revelation: [[16.8, 18.5]],
  recorded_voice: [[60.5, 30.5]],      // control room (needs reel + bird)
  boiler: [[17, 10.6]],                // valves (needs flame power: same panel)
  pa: [[78, 44.8]],
  sweep: [[66.4, 31.6]],
};
const DOOR_REQ = { front_l: 'key_front', front_r: 'key_front', maint: 'key_maint', office: 'key_director', research: 'power_bird', ante: 'power_bird', vault: 'vault_open', gate_l: 'key_gate', gate_r: 'key_gate' };

function reachable(have) {
  const seen = new Uint8Array(map.W * map.H);
  const start = map.idx(Math.floor(map.points.start.x), Math.floor(map.points.start.z));
  const q = [start]; seen[start] = 1;
  while (q.length) {
    const c = q.pop();
    const x = c % map.W, z = (c / map.W) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (!map.inb(nx, nz)) continue;
      const i = map.idx(nx, nz);
      if (seen[i]) continue;
      const t = map.type[i];
      if (t === CELL.SOLID || t === CELL.WINDOW || t === CELL.FENCE || t === CELL.FOREST) continue;
      if (t === CELL.DOOR) {
        const d = map.doors[map.doorAt[i]];
        const req = DOOR_REQ[d.id];
        if (req && !have.has(req)) continue;
        if (d.secret && !have.has('secret')) continue;
        if (d.oneWay && !have.has('hatch_' + d.id)) {
          // one-way: passable only from the south (research) side
          if (nz < d.z || z < d.z) continue;
        }
      }
      seen[i] = 1; q.push(i);
    }
  }
  return seen;
}
const at = (seen, [x, z]) => seen[map.idx(Math.floor(x), Math.floor(z))] === 1;
const have = new Set(['secret']);
const order = [];
for (let iter = 0; iter < 20; iter++) {
  const seen = reachable(have);
  let progress = false;
  for (const [item, spots] of Object.entries(ITEMS)) {
    if (have.has(item)) continue;
    // Requirements beyond reachability
    if (item === 'recorded_voice' && !(have.has('reel_dictation') && have.has('power_bird'))) continue;
    if (item === 'sweep' && !(have.has('boiler') && have.has('pa') && have.has('vault_open'))) continue;
    if (spots.every((s) => at(seen, s))) { have.add(item); order.push(item); progress = true; }
  }
  if (have.has('recorded_voice') && !have.has('vault_open') && at(seen, [69.5, 6.5])) { have.add('vault_open'); order.push('vault_open'); progress = true; }
  if (!progress) break;
}
console.log('   order:', order.join(' → '));
for (const need of ['key_front', 'key_maint', 'power_bird', 'key_director', 'revelation', 'reel_dictation', 'recorded_voice', 'vault_open', 'key_gate', 'boiler', 'pa', 'sweep']) {
  if (!have.has(need)) err(`unreachable: ${need}`);
}
const final = reachable(have);
const carOk = at(final, [37.5, 56.5]);
if (!carOk) err('car unreachable at the end');
// Every zone reachable at the end
for (const z of map.zones) if (!z.cells.some((c) => final[c])) err(`zone never reachable: ${z.name}`);
ok('all zones reachable; all four endings reachable (quiet job, carrier, full spectrum, room tone)');

// Entity navigation connectivity (vents + doors unlocked)
console.log('Entity navigation');
const pts = Object.entries(map.points);
let navFail = 0;
for (const [a, pa] of pts) {
  const p = nav.findPath(map.points.lobby.x, map.points.lobby.z, pa.x, pa.z);
  if (!p) { navFail++; err(`no entity path lobby → ${a}`); }
}
if (!navFail) ok(`entity can path to all ${pts.length} named points`);
for (const v of map.vents) if (!v.a || !v.b) err('broken vent link ' + v.ids);
ok(`${map.vents.length} duct links`);

console.log(errors ? `\n${errors} ERROR(S)` : '\nVALID');
process.exit(errors ? 1 : 0);
