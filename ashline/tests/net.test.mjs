// End-to-end networking test: real server + three WebSocket clients (Node 22 global WebSocket).
// Checks parties, trio queue with bot fill, snapshots, client prediction accuracy, server-validated
// damage with lag compensation, reconnect, match end, XP persistence.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../server/server.mjs';
import { PROTOCOL_VERSION, DT, BTN, MODE } from '../shared/constants.js';
import { encodeInput, decodeSnapshot, quantizeInput } from '../shared/net/Protocol.js';
import { getWorld } from '../shared/sim/Setup.js';
import { createMoveState, stepMove, eyeHeight } from '../shared/physics/Movement.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

const data = mkdtempSync(join(tmpdir(), 'ashline-'));
const srv = await startServer({ port: 0, countdown: 1, players: 30, timeScale: 0.35, test: true, data, quiet: true });
const URL = `ws://localhost:${srv.port}/ws`;
const { world } = getWorld();

class Client {
  constructor(name, token = null) { this.name = name; this.token = token; this.msgs = []; this.snaps = []; this.events = []; this.waiters = []; }
  open() {
    return new Promise((res, rej) => {
      const ws = this.ws = new WebSocket(URL);
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, token: this.token, name: this.name })); };
      ws.onerror = rej;
      ws.onmessage = (ev) => {
        if (typeof ev.data !== 'string') { const s = decodeSnapshot(ev.data); this.snaps.push(s); this.last = s; if (this.snaps.length > 400) this.snaps.shift(); return; }
        const m = JSON.parse(ev.data);
        if (m.t === 'welcome') { this.id = m.id; this.token = m.token; res(this); }
        if (m.t === 'party') this.party = m.party;
        if (m.t === 'match') this.init = m.init;
        if (m.t === 'ev') this.events.push(...m.e);
        if (m.t === 'inv') this.inv = m.inv;
        const w = this.waiters.find(w => w.pred(m));
        if (w) { this.waiters.splice(this.waiters.indexOf(w), 1); w.res(m); } else this.msgs.push(m);
      };
    });
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  wait(pred, ms = 8000, label = '') {
    const hit = this.msgs.find(pred);
    if (hit) { this.msgs.splice(this.msgs.indexOf(hit), 1); return Promise.resolve(hit); }
    return new Promise((res, rej) => {
      const w = { pred, res };
      this.waiters.push(w);
      setTimeout(() => { const i = this.waiters.indexOf(w); if (i >= 0) { this.waiters.splice(i, 1); rej(new Error('timeout ' + label)); } }, ms);
    });
  }
  test(op) { this.send({ t: 'cmd', c: { c: 'test', ...op } }); }
}

try {
  const A = await new Client('Alpha').open(), B = await new Client('Bravo').open(), C = await new Client('Charlie').open();
  ok(A.id && B.id && C.id && A.token.length === 32, 'three clients welcomed with tokens');
  await sleep(100);
  const code = A.party.code;
  B.send({ t: 'party.join', code }); C.send({ t: 'party.join', code });
  await sleep(200);
  ok(A.party.members.length === 3 && A.party.mode === 'trio', `party of three formed (${A.party.members.length}, ${A.party.mode})`);
  B.send({ t: 'party.join', code: 'ZZZZZ' });
  await B.wait(m => m.t === 'err', 2000, 'bad code err');
  ok(true, 'joining a bad code is rejected');
  A.send({ t: 'queue' });
  await Promise.all([A, B, C].map(c => c.wait(m => m.t === 'match', 8000, 'match start')));
  const roster = A.init.roster;
  const sqA = roster.find(r => r.id === A.id).squad;
  ok(roster.length === 30 && roster.filter(r => r.squad === sqA).length === 3 && roster.filter(r => r.bot).length === 27, `match started: 30 players, trio squad of humans (${roster.length})`);
  await sleep(500);
  ok(A.snaps.length > 5 && A.last.self && A.last.self.mode === MODE.PLANE, `snapshots streaming, in plane (${A.snaps.length})`);
  ok(A.init.items.length > 200, `initial loot sent (${A.init.items.length} items)`);

  // ---- prediction accuracy ----
  A.test({ op: 'freeze' });
  const pos = { x: -150 + 0.5, z: 40 + 5.5 }; // Old Marrow main street
  A.test({ op: 'tp', x: pos.x, z: pos.z });
  await sleep(600);
  let seq = 1;
  const base = A.last.self;
  ok(base.mode === MODE.GROUND && Math.abs(base.x - pos.x) < 0.01, 'teleported onto the ground');
  const pred = createMoveState(); Object.assign(pred, { x: base.x, y: base.y, z: base.z, vx: base.vx, vy: base.vy, vz: base.vz, mode: base.mode, grounded: base.grounded, crouch: base.crouch, airT: base.airT, pb: base.pb });
  const history = new Map();
  for (let i = 0; i < 75; i++) {
    const inp = quantizeInput({ seq: seq++, viewTick: A.last.tick - 3, mx: i > 40 ? 0.6 : 0, mz: 1, yaw: 0.3 + i * 0.01, pitch: 0, buttons: (i > 20 && i < 50 ? BTN.SPRINT : 0) | (i === 10 ? BTN.JUMP : 0) });
    A.ws.send(encodeInput(inp));
    stepMove(pred, inp, world, DT);
    history.set(inp.seq, { x: pred.x, y: pred.y, z: pred.z });
    await sleep(1000 / 30);
  }
  await sleep(500);
  let maxErr = 0, compared = 0;
  const seenAck = new Set();
  for (const s of A.snaps) { if (seenAck.has(s.ack)) continue; seenAck.add(s.ack); const h = history.get(s.ack); if (h && s.self) { compared++; const e = Math.hypot(h.x - s.self.x, h.y - s.self.y, h.z - s.self.z); if (process.env.DBG && e > 0.001) console.log('ack', s.ack, 'err', e.toFixed(4), 'pred', h.x.toFixed(3), h.y.toFixed(3), h.z.toFixed(3), 'srv', s.self.x.toFixed(3), s.self.y.toFixed(3), s.self.z.toFixed(3)); maxErr = Math.max(maxErr, e); } }
  const moved = Math.hypot(A.last.self.x - base.x, A.last.self.z - base.z);
  ok(compared > 40 && maxErr < 0.01, `client prediction matches server (${compared} acks, max error ${maxErr.toFixed(5)} m, moved ${moved.toFixed(1)} m)`);

  // ---- server-validated damage ----
  A.test({ op: 'give', it: { k: 'weapon', id: 'kr5' } });
  A.test({ op: 'botnear', place: true, dx: 0, dz: -9 });
  const bn = await A.wait(m => m.t === 'test' && m.op === 'botnear', 3000, 'botnear');
  await sleep(400);
  const me = A.last.self;
  const eye = me.y + eyeHeight({ mode: me.mode, crouch: me.crouch });
  const dx = bn.x - me.x, dz = bn.z - me.z, dy = bn.y + 1.2 - eye;
  const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
  A.events.length = 0;
  await sleep(800); // weapon equip time
  for (let i = 0; i < 12; i++) {
    A.ws.send(encodeInput(quantizeInput({ seq: seq++, viewTick: A.last.tick - 3, mx: 0, mz: 0, yaw, pitch, buttons: BTN.FIRE | BTN.ADS })));
    await sleep(1000 / 30);
  }
  await sleep(400);
  const hits = A.events.filter(e => e.e === 'hit' && e.a === A.id && e.v === bn.id);
  const shots = A.events.filter(e => e.e === 'shot' && e.p === A.id);
  A.test({ op: 'botnear' });
  const bn2 = await A.wait(m => m.t === 'test' && m.op === 'botnear', 3000, 'botnear2');
  if (process.env.DBG) console.log(JSON.stringify(hits), JSON.stringify(bn), JSON.stringify(bn2));
  ok(shots.length >= 4 && hits.length >= 3, `shots register on a bot (${shots.length} shots, ${hits.length} hits)`);
  ok(bn2.id !== bn.id || bn2.hp < bn.hp || A.events.some(e => e.e === 'kill' && e.v === bn.id), `bot took damage (hp ${bn.hp} → ${bn2.id === bn.id ? bn2.hp.toFixed(0) : 'dead'})`);
  ok(A.inv && A.inv.w.some(w => w && w.id === 'kr5' && w.mag < 30), 'inventory synced with ammo spent');

  // ---- reconnect ----
  const tok = C.token;
  C.ws.close();
  await sleep(300);
  const C2 = await new Client('Charlie', tok).open();
  const re = await C2.wait(m => m.t === 'match', 4000, 'rejoin');
  ok(C2.id === C.id && re.init.you === C.id, 'reconnect with token rejoins the running match');

  // ---- end + results + persistence ----
  A.test({ op: 'end' });
  const res = await A.wait(m => m.t === 'results', 10000, 'results');
  ok(res.you.place === 1 && res.xp.xp > 0, `match ends, our squad wins, XP awarded (${res.xp.xp})`);
  await C2.wait(m => m.t === 'results', 5000, 'results C');
  ok(true, 'teammates get results');
  A.send({ t: 'leave' });
  await A.wait(m => m.t === 'lobby', 3000, 'back to lobby');
  ok(true, 'leave returns to lobby');
  await sleep(700);
  const saved = JSON.parse(readFileSync(join(data, 'profiles.json'), 'utf8'));
  ok(saved[A.token] && saved[A.token].xp === res.profile.xp && saved[A.token].stats.wins === 1, 'profile XP and stats persisted to disk');
  for (const c of [A, B, C2]) c.ws.close();
} catch (e) {
  fails++;
  console.log('FAIL  exception:', e.message);
}
await srv.close();
rmSync(data, { recursive: true, force: true });
console.log(fails ? `${fails} net check(s) FAILED` : 'all net checks passed');
process.exit(fails ? 1 : 0);
