// Transports. WsTransport talks to the real server; LocalServer emulates the server's lobby + match
// protocol entirely in the browser (practice vs bots, works offline from the standalone file).
import { PROTOCOL_VERSION, DT, TICK_RATE, MODES } from '../../../shared/constants.js';
import { buildMatch } from '../../../shared/sim/Setup.js';
import { MatchHost } from '../../../shared/net/MatchHost.js';
import { newProfile, levelInfo, sanitizeCosmetics, applyMatch } from '../../../shared/progression.js';

export class WsTransport {
  constructor(url) { this.url = url; this.kind = 'ws'; this.handlers = []; this.open = false; this.closeHandlers = []; }
  connect() {
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = this.ws = new WebSocket(this.url); } catch (e) { reject(e); return; }
      ws.binaryType = 'arraybuffer';
      const to = setTimeout(() => { reject(new Error('Connection timed out')); try { ws.close(); } catch {} }, 6000);
      ws.onopen = () => { clearTimeout(to); this.open = true; resolve(this); };
      ws.onerror = () => { clearTimeout(to); if (!this.open) reject(new Error('Could not reach the server')); };
      ws.onclose = (e) => { this.open = false; for (const h of this.closeHandlers) h(e); };
      ws.onmessage = (ev) => { const m = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data; for (const h of this.handlers) h(m); };
    });
  }
  on(h) { this.handlers.push(h); }
  onClose(h) { this.closeHandlers.push(h); }
  send(o) { if (this.open) this.ws.send(JSON.stringify(o)); }
  sendBin(b) { if (this.open) this.ws.send(b); }
  close() { try { this.ws.close(); } catch {} }
}

const PROFILE_KEY = 'ashline.practiceProfile';
export const DIFFICULTY = { easy: [0.08, 0.4], normal: [0.25, 0.72], hard: [0.6, 1.0] };
export const QUICK_TIMESCALE = 0.42;
export function loadLocalProfile() {
  try { const p = JSON.parse(localStorage.getItem(PROFILE_KEY)); if (p && typeof p.xp === 'number') return { ...newProfile(), ...p, stats: { ...newProfile().stats, ...(p.stats || {}) } }; } catch {}
  return newProfile();
}
function saveLocalProfile(p) { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {} }

export class LocalServer {
  constructor() {
    this.kind = 'local'; this.handlers = []; this.closeHandlers = []; this.open = true;
    this.profile = loadLocalProfile();
    this.party = { code: 'LOCAL', leader: 1, mode: 'solo', fill: true, queued: false, countdown: 0, members: [], difficulty: 'normal', quick: false };
    this.host = null; this.timer = null;
    this.debug = typeof window !== 'undefined' && /[?&]debug/.test(location.search);
  }
  connect() { return Promise.resolve(this); }
  on(h) { this.handlers.push(h); }
  onClose(h) { this.closeHandlers.push(h); }
  emit(m) { setTimeout(() => { for (const h of this.handlers) h(m); }, 0); }
  view() { const p = this.profile; return { name: p.name, xp: p.xp, ...levelInfo(p.xp), cos: p.cos, stats: p.stats, history: p.history }; }
  pushParty() {
    this.party.members = [{ id: 1, name: this.profile.name, level: levelInfo(this.profile.xp).level, cos: this.profile.cos, inMatch: !!this.host }];
    this.emit({ t: 'party', party: { ...this.party } });
  }
  sendBin(b) { if (this.host) this.host.input(1, b); }
  send(m) {
    switch (m.t) {
      case 'hello':
        if (m.name) this.profile.name = String(m.name).slice(0, 16);
        if (m.cos) this.profile.cos = sanitizeCosmetics(m.cos, levelInfo(this.profile.xp).level);
        saveLocalProfile(this.profile);
        this.emit({ t: 'welcome', id: 1, token: 'local', profile: this.view(), test: this.debug, local: true });
        this.pushParty();
        break;
      case 'name': this.profile.name = String(m.name).slice(0, 16) || 'Survivor'; saveLocalProfile(this.profile); this.emit({ t: 'profile', profile: this.view() }); this.pushParty(); break;
      case 'cos': this.profile.cos = sanitizeCosmetics(m.cos, levelInfo(this.profile.xp).level); saveLocalProfile(this.profile); this.emit({ t: 'profile', profile: this.view() }); this.pushParty(); break;
      case 'profile': this.emit({ t: 'profile', profile: this.view() }); break;
      case 'party.mode': if (MODES[m.mode]) { this.party.mode = m.mode; this.pushParty(); } break;
      case 'party.fill': this.party.fill = !!m.fill; this.pushParty(); break;
      case 'party.diff': if (DIFFICULTY[m.d]) { this.party.difficulty = m.d; this.pushParty(); } break;
      case 'party.quick': this.party.quick = !!m.quick; this.pushParty(); break;
      case 'queue': this.startMatch(); break;
      case 'unqueue': break;
      case 'cmd': if (this.host) this.host.command(1, m.c); break;
      case 'leave': this.stopMatch(); this.emit({ t: 'lobby' }); this.pushParty(); break;
      case 'ping': this.emit({ t: 'pong', c: m.c, s: Date.now() }); break;
    }
  }
  startMatch() {
    if (this.host) return;
    const seed = (Date.now() & 0x7fffffff) | 1;
    const sim = buildMatch({ seed, mode: this.party.mode, groups: [[{ id: 1, name: this.profile.name, cos: this.profile.cos }]], total: 30, skill: DIFFICULTY[this.party.difficulty], timeScale: this.party.quick ? QUICK_TIMESCALE : 1 });
    sim.start();
    const host = this.host = new MatchHost(sim, { test: this.debug });
    host.attach(1, { send: (o) => this.emit(o), sendBin: (b) => this.emit(b) });
    host.onEnd = (results) => {
      const r = results.find(x => x.id === 1);
      const xp = applyMatch(this.profile, r, this.party.mode);
      saveLocalProfile(this.profile);
      this.emit({ t: 'results', results, you: r, xp, profile: this.view(), winners: results.filter(x => x.place === 1).map(x => x.name) });
    };
    let acc = 0, last = performance.now();
    this.timer = setInterval(() => {
      const now = performance.now();
      acc += Math.min(0.25, (now - last) / 1000); last = now;
      let n = 0;
      while (acc >= DT && n < 6) { host.step(); acc -= DT; n++; }
    }, 1000 / TICK_RATE / 2);
    this.pushParty();
  }
  stopMatch() { if (this.timer) clearInterval(this.timer); this.timer = null; this.host = null; }
  close() { this.stopMatch(); }
}
