// Wire format. High-rate traffic (inputs, snapshots) is binary via DataView; low-rate messages
// (lobby, events, inventory) are JSON text frames.
import { WEAPON_IDS } from '../sim/Items.js';

export const MSG = { INPUT: 1, SNAP: 2 };
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- input (client → server), 22 bytes
export function encodeInput(inp) {
  const buf = new ArrayBuffer(22), v = new DataView(buf);
  v.setUint8(0, MSG.INPUT);
  v.setUint32(1, inp.seq >>> 0, true);
  v.setFloat32(5, inp.viewTick || 0, true);
  v.setInt8(9, Math.round(clamp(inp.mx, -1, 1) * 127));
  v.setInt8(10, Math.round(clamp(inp.mz, -1, 1) * 127));
  v.setFloat32(11, inp.yaw, true);
  v.setFloat32(15, inp.pitch, true);
  v.setUint16(19, inp.buttons & 0xffff, true);
  v.setUint8(21, 0);
  return buf;
}
export function decodeInput(buf) {
  const v = toView(buf);
  if (v.byteLength < 21 || v.getUint8(0) !== MSG.INPUT) return null;
  // Quantise exactly like the client did so prediction and server agree bit for bit.
  return {
    seq: v.getUint32(1, true), viewTick: v.getFloat32(5, true),
    mx: v.getInt8(9) / 127, mz: v.getInt8(10) / 127,
    yaw: v.getFloat32(11, true), pitch: v.getFloat32(15, true), buttons: v.getUint16(19, true),
  };
}
// The client runs prediction on the same quantised values the server will decode.
export function quantizeInput(inp) {
  inp.mx = Math.round(clamp(inp.mx, -1, 1) * 127) / 127;
  inp.mz = Math.round(clamp(inp.mz, -1, 1) * 127) / 127;
  inp.yaw = Math.fround(inp.yaw);
  inp.pitch = Math.fround(inp.pitch);
  inp.viewTick = Math.fround(inp.viewTick || 0);
  return inp;
}

// ---------------------------------------------------------------- snapshot (server → client)
class Writer {
  constructor(size = 2048) { this.buf = new ArrayBuffer(size); this.v = new DataView(this.buf); this.o = 0; }
  ensure(n) {
    if (this.o + n <= this.buf.byteLength) return;
    let s = this.buf.byteLength * 2; while (s < this.o + n) s *= 2;
    const nb = new ArrayBuffer(s); new Uint8Array(nb).set(new Uint8Array(this.buf, 0, this.o));
    this.buf = nb; this.v = new DataView(nb);
  }
  u8(x) { this.ensure(1); this.v.setUint8(this.o, x); this.o += 1; }
  i16(x) { this.ensure(2); this.v.setInt16(this.o, x, true); this.o += 2; }
  u16(x) { this.ensure(2); this.v.setUint16(this.o, x, true); this.o += 2; }
  u32(x) { this.ensure(4); this.v.setUint32(this.o, x >>> 0, true); this.o += 4; }
  f32(x) { this.ensure(4); this.v.setFloat32(this.o, x, true); this.o += 4; }
  f64(x) { this.ensure(8); this.v.setFloat64(this.o, x, true); this.o += 8; }
  done() { return this.buf.slice(0, this.o); }
}
class Reader {
  constructor(buf) { this.v = toView(buf); this.o = 0; }
  u8() { return this.v.getUint8(this.o++); }
  i16() { const x = this.v.getInt16(this.o, true); this.o += 2; return x; }
  u16() { const x = this.v.getUint16(this.o, true); this.o += 2; return x; }
  u32() { const x = this.v.getUint32(this.o, true); this.o += 4; return x; }
  f32() { const x = this.v.getFloat32(this.o, true); this.o += 4; return x; }
  f64() { const x = this.v.getFloat64(this.o, true); this.o += 8; return x; }
}

const angU16 = a => Math.round((((a % TAU) + TAU) % TAU) / TAU * 65535);
const u16Ang = u => u / 65535 * TAU;

export function encodeSnapshot(s) {
  const w = new Writer(256 + s.players.length * 28 + s.proj.length * 15 + (s.veh ? s.veh.length * 30 : 0));
  w.u8(MSG.SNAP);
  w.u32(s.tick); w.u32(s.ack);
  if (s.self) {
    const m = s.self;
    w.u8(1);
    w.f64(m.x); w.f64(m.y); w.f64(m.z); w.f64(m.vx); w.f64(m.vy); w.f64(m.vz);
    w.u8(m.mode); w.u8((m.grounded ? 1 : 0) | (m.crouch ? 2 : 0) | (m.alive ? 4 : 0));
    w.f64(m.airT); w.u16(m.pb); w.f64(m.slide || 0); w.f64(m.slideCD || 0); w.f64(m.vault || 0);
    w.u16(Math.round(clamp(m.hp, 0, 100) * 100)); w.u16(Math.round(clamp(m.boost, 0, 100) * 100)); w.u16(Math.round(clamp(m.bleed, 0, 100) * 100));
    w.u8(m.slot); w.u16(m.mag); w.u8(m.act); w.u16(Math.round(m.actP * 1000));
    w.i16(m.spec);
  } else w.u8(0);
  const z = s.zone;
  w.f32(z.cx); w.f32(z.cz); w.f32(z.cr); w.f32(z.nx); w.f32(z.nz); w.f32(z.nr); w.u8(z.phase); w.u8(z.state); w.f32(z.timer);
  w.f32(s.plane.x); w.f32(s.plane.z); w.u8(s.plane.active ? 1 : 0);
  w.u8(s.alive); w.u8(s.squads);
  w.u8(s.players.length);
  for (const p of s.players) {
    w.u16(p.id); w.f32(p.x); w.f32(p.y); w.f32(p.z); w.u16(angU16(p.yaw)); w.i16(Math.round(clamp(p.pitch, -1.6, 1.6) * 10000));
    w.u8(p.mode); w.u8(p.flags); w.u8(p.weapon); w.u8(p.gear); w.u8(p.hp > 255 ? 255 : Math.max(0, p.hp | 0));
  }
  w.u8(s.proj.length);
  for (const p of s.proj) { w.u16(p.id); w.u8(p.k); w.f32(p.x); w.f32(p.y); w.f32(p.z); }
  const veh = s.veh || [];
  w.u8(veh.length);
  for (const v of veh) { w.u16(v.id); w.f32(v.x); w.f32(v.y); w.f32(v.z); w.u16(angU16(v.yaw)); w.i16(Math.round(clamp(v.pitch, -1.5, 1.5) * 10000)); w.i16(Math.round(clamp(v.roll, -1.5, 1.5) * 10000)); w.i16(Math.round(clamp(v.speed, -300, 300) * 100)); w.u8(v.hp); w.u16(v.d < 0 ? 0xffff : v.d); w.u16(v.s < 0 ? 0xffff : v.s); }
  return w.done();
}

export function decodeSnapshot(buf) {
  const r = new Reader(buf);
  if (r.u8() !== MSG.SNAP) return null;
  const s = { tick: r.u32(), ack: r.u32(), self: null };
  if (r.u8()) {
    const m = { x: r.f64(), y: r.f64(), z: r.f64(), vx: r.f64(), vy: r.f64(), vz: r.f64(), mode: r.u8() };
    const f = r.u8(); m.grounded = !!(f & 1); m.crouch = !!(f & 2); m.alive = !!(f & 4);
    m.airT = r.f64(); m.pb = r.u16(); m.slide = r.f64(); m.slideCD = r.f64(); m.vault = r.f64();
    m.hp = r.u16() / 100; m.boost = r.u16() / 100; m.bleed = r.u16() / 100;
    m.slot = r.u8(); m.mag = r.u16(); m.act = r.u8(); m.actP = r.u16() / 1000; m.spec = r.i16();
    s.self = m;
  }
  s.zone = { cx: r.f32(), cz: r.f32(), cr: r.f32(), nx: r.f32(), nz: r.f32(), nr: r.f32(), phase: r.u8(), state: r.u8(), timer: r.f32() };
  s.plane = { x: r.f32(), z: r.f32(), active: !!r.u8() };
  s.alive = r.u8(); s.squads = r.u8();
  const n = r.u8();
  s.players = new Array(n);
  for (let i = 0; i < n; i++) {
    s.players[i] = { id: r.u16(), x: r.f32(), y: r.f32(), z: r.f32(), yaw: u16Ang(r.u16()), pitch: r.i16() / 10000, mode: r.u8(), flags: r.u8(), weapon: r.u8(), gear: r.u8(), hp: r.u8() };
  }
  const np = r.u8();
  s.proj = new Array(np);
  for (let i = 0; i < np; i++) s.proj[i] = { id: r.u16(), k: r.u8(), x: r.f32(), y: r.f32(), z: r.f32() };
  const nv = r.u8();
  s.veh = new Array(nv);
  for (let i = 0; i < nv; i++) { const v = { id: r.u16(), x: r.f32(), y: r.f32(), z: r.f32(), yaw: u16Ang(r.u16()), pitch: r.i16() / 10000, roll: r.i16() / 10000, speed: r.i16() / 100, hp: r.u8() }; const d = r.u16(), ss = r.u16(); v.d = d === 0xffff ? -1 : d; v.s = ss === 0xffff ? -1 : ss; s.veh[i] = v; }
  return s;
}

export function weaponFromWire(n) { return n >= 1 && n <= WEAPON_IDS.length ? WEAPON_IDS[n - 1] : n === 20 ? 'throw' : null; }

function clamp(v, a, b) { v = +v || 0; return v < a ? a : v > b ? b : v; }
function toView(buf) {
  if (buf instanceof DataView) return buf;
  if (buf instanceof ArrayBuffer) return new DataView(buf);
  if (ArrayBuffer.isView(buf)) return new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  throw new Error('bad buffer');
}
