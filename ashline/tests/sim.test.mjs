// Headless bots-only matches through the shared simulation.
// Usage: node tests/sim.test.mjs [--quick] [--verbose]
import { buildMatch, getWorld } from '../shared/sim/Setup.js';
import { MODE, TICK_RATE, DT } from '../shared/constants.js';

const QUICK = process.argv.includes('--quick');
const VERBOSE = process.argv.includes('--verbose');
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('  FAIL', msg); } else if (VERBOSE) console.log('  ok  ', msg); };

const t0 = performance.now();
const { world, nav } = getWorld();
console.log(`world + nav built in ${(performance.now() - t0).toFixed(0)} ms`);

function runMatch(mode, seed, timeScale) {
  const sim = buildMatch({ seed, mode, groups: [], timeScale });
  sim.start();
  const maxTicks = TICK_RATE * 60 * 20;
  let lastR = Infinity, monotonic = true, nan = false, under = 0, inside = 0, kills = 0, knocks = 0, revives = 0, shots = 0, pickups = 0;
  let tickMs = 0, worst = 0;
  const startT = performance.now();
  while (sim.phase !== 'ended' && sim.tick < maxTicks) {
    const a = performance.now();
    sim.step();
    const d = performance.now() - a; tickMs += d; worst = Math.max(worst, d);
    for (const e of sim.drainEvents()) {
      if (e.e === 'kill') kills++; else if (e.e === 'knock') knocks++; else if (e.e === 'revive') revives++; else if (e.e === 'shot') shots++; else if (e.e === 'pick') pickups++;
    }
    if (sim.zone.cur.r > lastR + 1e-6) monotonic = false;
    lastR = sim.zone.cur.r;
    if (sim.tick % 15 === 0) for (const p of sim.list) {
      if (!p.alive) continue;
      if (![p.m.x, p.m.y, p.m.z].every(Number.isFinite)) nan = true;
      if (p.m.mode === MODE.GROUND || p.m.mode === MODE.KNOCKED) {
        if (p.m.y < world.heightAt(p.m.x, p.m.z) - 0.05) under++;
        if (world.overlaps(p.m.x - 0.3, p.m.y + 0.05, p.m.z - 0.3, p.m.x + 0.3, p.m.y + 1.0, p.m.z + 0.3) >= 0) inside++;
      }
    }
  }
  const res = sim.results();
  const winners = new Set(res.filter(r => r.place === 1).map(r => r.squad));
  const wall = (performance.now() - startT) / 1000;
  const label = `${mode} seed=${seed}`;
  console.log(`${label}: ${sim.phase} after ${(sim.tick * DT / 60).toFixed(1)} sim-min (${wall.toFixed(1)} s wall), kills=${kills} knocks=${knocks} revives=${revives} shots=${shots} pickups=${pickups}, avg tick ${(tickMs / sim.tick).toFixed(2)} ms (worst ${worst.toFixed(1)}), winner squad ${[...winners]} ${res.filter(r => r.place === 1).map(r => r.name).join(', ')}`);
  check(sim.phase === 'ended', `${label}: match ends`);
  check(winners.size === 1, `${label}: exactly one winning squad`);
  check(monotonic, `${label}: zone radius never grows`);
  check(!nan, `${label}: no NaN positions`);
  check(under === 0, `${label}: nobody under terrain (${under})`);
  check(inside <= 2, `${label}: nobody inside colliders (${inside})`);
  check(kills >= 10, `${label}: plenty of kills (${kills})`);
  check(pickups > 30, `${label}: bots loot (${pickups})`);
  check(tickMs / sim.tick < 8, `${label}: avg tick < 8 ms`);
  if (mode !== 'solo') check(knocks > 0, `${label}: knocks happen (${knocks})`);
  return { winner: [...winners][0], tick: sim.tick, revives, res };
}

const ts = QUICK ? 0.6 : 1;
const a = runMatch('solo', 101, ts);
const b = runMatch('solo', 101, ts);
check(a.winner === b.winner && a.tick === b.tick, 'same seed → same result (deterministic)');
const d = runMatch('duo', 202, ts);
const t = runMatch('trio', 303, ts);
check(d.revives + t.revives > 0, `squad bots revive teammates (${d.revives + t.revives})`);

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall sim checks passed');
process.exit(failures ? 1 : 0);
