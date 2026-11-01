// Buggies (enter/drive/steer/exit, run-over, destruction) and supply airdrops, through the shared Sim.
import { buildMatch } from '../shared/sim/Setup.js';
import { MODE, BTN, DT, TICK_RATE } from '../shared/constants.js';
import { neutralInput } from '../shared/sim/Sim.js';

let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const sim = buildMatch({ seed: 4242, mode: 'solo', groups: [[{ id: 1, name: 'Driver', cos: {} }]] });
sim.start();
for (const o of sim.list) if (o.bot) o.brain = null;   // frozen bots
const me = sim.players.get(1);
ok(sim.vehicles.size >= 10, `buggies spawned on the roads (${sim.vehicles.size})`);
let seq = 1;
const send = (mx, mz, buttons = 0, n = 1) => { for (let i = 0; i < n; i++) { sim.queueInput(1, { seq: seq++, mx, mz, yaw: me.yaw, pitch: 0, buttons, viewTick: sim.tick }); sim.step(); sim.drainEvents(); } };
// stand next to buggy 1
const v = sim.vehicles.get(1);
me.m.mode = MODE.GROUND; me.m.x = v.x + 2.2; me.m.z = v.z; me.m.y = sim.world.heightAt(me.m.x, me.m.z) + 0.05;
send(0, 0, 0, 5);
sim.command(1, { c: 'enter', id: 1 });
ok(me.m.mode === MODE.VEHICLE && me.vehicle === 1 && v.seats[0] === 1, 'player enters the driver seat');
const x0 = v.x, z0 = v.z, yaw0 = v.yaw;
send(0, 1, 0, TICK_RATE * 3);
const dist = Math.hypot(v.x - x0, v.z - z0);
ok(dist > 25 && v.speed > 12, `throttle drives the buggy (${dist.toFixed(1)} m, ${v.speed.toFixed(1)} m/s)`);
ok(Math.hypot(me.m.x - v.x, me.m.z - v.z) < 1 && Math.abs(me.m.y - v.y - 0.55) < 0.05, 'driver rides in the seat');
send(1, 1, 0, TICK_RATE);
ok(Math.abs(((v.yaw - yaw0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 0.3, 'steering turns the buggy');
send(0, 0, BTN.JUMP, TICK_RATE * 2);
ok(Math.abs(v.speed) < 1, `handbrake stops it (${v.speed.toFixed(2)} m/s)`);
// run over a frozen bot
const bot = sim.list.find(o => o.bot);
const town = sim.map.pois.find(q => q.id === 'oldtown');
v.x = town.x - 62; v.z = town.z + 4; v.y = sim.world.heightAt(v.x, v.z); v.vy = 0; v.speed = 0; v.yaw = -Math.PI / 2; // east along the main street
send(0, 0, 0, 2);
const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw);
bot.m.mode = MODE.GROUND; bot.m.x = v.x + fx * 16; bot.m.z = v.z + fz * 16; bot.m.y = sim.world.heightAt(bot.m.x, bot.m.z) + 0.05;
const hp0 = bot.hp;
let ran = false;
for (let i = 0; i < TICK_RATE * 3 && !ran; i++) { send(0, 1); if (!bot.alive || bot.hp < hp0) ran = true; if (process.env.DBG && i % 6 === 0) console.log(i, 'veh', v.x.toFixed(1), v.z.toFixed(1), 'spd', v.speed.toFixed(1), 'bot', bot.m.x.toFixed(1), bot.m.z.toFixed(1), bot.m.y.toFixed(1), 'vy', v.y.toFixed(1), 'mode', bot.m.mode, 'd', Math.hypot(bot.m.x - v.x, bot.m.z - v.z).toFixed(1)); }
ok(ran, `running a player over hurts them (hp ${hp0} → ${bot.alive ? bot.hp.toFixed(0) : 'dead'})`);
send(0, 0, BTN.JUMP, TICK_RATE * 2);
sim.command(1, { c: 'exit' });
ok(me.m.mode === MODE.GROUND && !me.vehicle && v.seats[0] === -1 && Math.hypot(me.m.x - v.x, me.m.z - v.z) > 1.2, 'exit puts the player beside the buggy');
// shoot it to pieces
me.inv.w[0] = { id: 'mattock', mag: 75, att: { optic: null, mag: null, muzzle: null, grip: null } }; me.inv.slot = 0; me.act = null;
let boom = false;
for (let i = 0; i < TICK_RATE * 12 && !boom; i++) {
  const dx = v.x - me.m.x, dz = v.z - me.m.z, dy = v.y + 0.7 - (me.m.y + 1.62);
  me.yaw = Math.atan2(-dx, -dz);
  sim.queueInput(1, { seq: seq++, mx: 0, mz: 0, yaw: me.yaw, pitch: Math.atan2(dy, Math.hypot(dx, dz)), buttons: BTN.FIRE | BTN.ADS, viewTick: sim.tick });
  sim.step();
  for (const e of sim.drainEvents()) if (e.e === 'vboom' && e.v === 1) boom = true;
  if (me.inv.w[0].mag === 0) { me.inv.w[0].mag = 75; }
}
ok(boom && !sim.vehicles.has(1), 'gunfire destroys a buggy (it explodes)');
// airdrop: jump the zone to the next wait phase
let dropEv = null, landed = null;
for (let i = 0; i < TICK_RATE * 400 && !landed; i++) {
  if (!dropEv && sim.zone.timer > 2) sim.zone.timer = 2;
  sim.step();
  for (const e of sim.drainEvents()) { if (e.e === 'airdrop') dropEv = e; if (e.e === 'droplanded') landed = e; }
  if (sim.phase === 'ended') break;
}
ok(!!dropEv, 'a supply drop is announced when a later ash front is marked');
ok(!!landed, 'the supply drop lands');
if (landed) {
  let rare = 0; sim.itemsNear(landed.x, landed.z, 3, gi => { if ((gi.it.k === 'weapon' && gi.it.att && gi.it.att.optic) || gi.it.tier === 3) rare++; });
  ok(rare >= 2, `supply drop holds rare loot (${rare} items)`);
}
void DT; void neutralInput;
console.log(fails ? `${fails} vehicle check(s) FAILED` : 'all vehicle checks passed');
process.exit(fails ? 1 : 0);
