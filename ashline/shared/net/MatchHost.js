// Transport-agnostic match host: owns a Sim, feeds it client inputs/commands and fans out snapshots,
// events and inventories. Used by the Node server (WebSocket clients) and by practice mode
// (an in-browser loopback client).
import { DT, TICK_RATE } from '../constants.js';
import { decodeInput, encodeSnapshot } from './Protocol.js';

export class MatchHost {
  // clients: Map pid -> { send(obj), sendBin(arrayBuffer) }
  constructor(sim, { test = false, snapEvery = 1 } = {}) {
    this.sim = sim;
    this.clients = new Map();
    this.test = test;
    this.snapEvery = snapEvery;
    this.ended = false;
    this.endedAt = -1;
    this.onEnd = null;
  }

  attach(pid, client) {
    this.clients.set(pid, client);
    const p = this.sim.players.get(pid);
    if (p) { p.connected = true; p.invDirty = true; }
    client.send({ t: 'match', init: this.sim.initialState(pid), mapSeed: this.sim.map.seed });
  }
  detach(pid) {
    this.clients.delete(pid);
    const p = this.sim.players.get(pid);
    if (p) p.connected = false;
  }

  input(pid, data) {
    const inp = data instanceof ArrayBuffer || ArrayBuffer.isView(data) ? decodeInput(data) : data;
    if (!inp || ![inp.yaw, inp.pitch, inp.mx, inp.mz, inp.viewTick].every(Number.isFinite)) return;
    this.sim.queueInput(pid, inp);
  }

  command(pid, c) {
    if (!c || typeof c !== 'object') return;
    if (c.c === 'test' && this.test) return this.testOp(pid, c);
    this.sim.command(pid, c);
  }

  step() {
    const sim = this.sim;
    sim.step();
    const events = sim.drainEvents();
    this.dispatch(events);
    if (sim.tick % this.snapEvery === 0) {
      for (const [pid, cl] of this.clients) cl.sendBin(encodeSnapshot(sim.snapshotFor(pid)));
    }
    for (const [pid, cl] of this.clients) {
      const p = sim.players.get(pid);
      if (p && p.invDirty) { p.invDirty = false; cl.send({ t: 'inv', inv: sim.inventoryFor(pid) }); }
    }
    if (sim.phase === 'ended' && !this.ended) { this.ended = true; this.endedAt = sim.tick; }
    if (this.ended && this.onEnd && sim.tick - this.endedAt === Math.round(TICK_RATE * 2.5)) this.onEnd(sim.results());
  }

  dispatch(events) {
    if (!events.length || !this.clients.size) return;
    const sim = this.sim;
    const per = new Map();
    for (const [pid] of this.clients) per.set(pid, []);
    for (const e of events) {
      const to = e.to;
      if (to === undefined) { for (const arr of per.values()) arr.push(e); continue; }
      if (typeof to === 'number') { const a = per.get(to); if (a) a.push(e); continue; }
      if (Array.isArray(to)) { for (const id of to) { const a = per.get(id); if (a) a.push(e); } continue; }
      if (to && to.sq !== undefined) {
        for (const [pid, arr] of per) { const p = sim.players.get(pid); if (p && p.squad === to.sq) arr.push(e); }
      }
    }
    for (const [pid, arr] of per) if (arr.length) this.clients.get(pid).send({ t: 'ev', e: arr });
  }

  // Test-only hooks (server --test / practice debug).
  testOp(pid, c) {
    const sim = this.sim, p = sim.players.get(pid);
    if (!p) return;
    switch (c.op) {
      case 'end': for (const o of sim.list) if (o.squad !== p.squad && o.alive) sim.kill(o, p, 'test'); break;
      case 'tp': if (Number.isFinite(c.x) && Number.isFinite(c.z)) { p.m.mode = 0; p.m.x = c.x; p.m.z = c.z; p.m.y = Number.isFinite(c.y) ? c.y : sim.world.heightAt(c.x, c.z) + 0.1; p.m.vx = p.m.vy = p.m.vz = 0; } break;
      case 'give': if (c.it) { const gi = sim.addItem(c.it, p.m.x, p.m.y + 0.05, p.m.z); sim.tryPickup(p, gi.id); } break;
      case 'freeze': for (const o of sim.list) if (o.bot) o.brain = null; break;
      case 'hurt': sim.applyDamage(p, null, +c.d || 10, 'torso', 'test'); break;
      case 'botnear': {
        let best = null, bd = 1e9;
        for (const o of sim.list) if (o.bot && o.alive) { const d = Math.hypot(o.m.x - p.m.x, o.m.z - p.m.z); if (d < bd) { bd = d; best = o; } }
        if (best && c.place) { best.m.mode = 0; best.m.x = p.m.x + (c.dx ?? 0); best.m.z = p.m.z + (c.dz ?? -8); best.m.y = sim.world.heightAt(best.m.x, best.m.z) + 0.1; best.m.vx = best.m.vy = best.m.vz = 0; best.yaw = Math.atan2(-(p.m.x - best.m.x), -(p.m.z - best.m.z)); }
        if (best && c.gear) { best.inv.w[0] = { id: c.gear, mag: 30, att: { optic: null, mag: null, muzzle: null, grip: null } }; best.inv.slot = 0; best.inv.helmet = { tier: 2, dur: 150 }; best.inv.vest = { tier: 2, dur: 220 }; best.inv.pack = 2; }
        this.clients.get(pid)?.send({ t: 'test', op: 'botnear', id: best ? best.id : -1, hp: best ? best.hp : 0, x: best?.m.x, y: best?.m.y, z: best?.m.z });
        break;
      }
      case 'state': this.clients.get(pid)?.send({ t: 'test', op: 'state', x: p.m.x, y: p.m.y, z: p.m.z, mode: p.m.mode, hp: p.hp, seq: p.lastSeq, tick: sim.tick }); break;
      case 'zone': sim.zone.timer = Math.min(sim.zone.timer, +c.t || 1); break;
    }
  }
}

export { DT };
