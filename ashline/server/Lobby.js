// Sessions, parties, matchmaking queue and running matches.
import { randomBytes } from 'node:crypto';
import { MODES, MATCH_PLAYERS, PROTOCOL_VERSION, DT, TICK_RATE } from '../shared/constants.js';
import { levelInfo, sanitizeCosmetics, applyMatch } from '../shared/progression.js';
import { buildMatch } from '../shared/sim/Setup.js';
import { MatchHost } from '../shared/net/MatchHost.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const cleanName = (n) => String(n || '').replace(/[^\p{L}\p{N} _\-.]/gu, '').trim().slice(0, 16) || 'Survivor';

export class Lobby {
  constructor({ profiles, opts }) {
    this.profiles = profiles;
    this.opts = opts;
    this.sessions = new Map();      // id -> session
    this.byToken = new Map();       // token -> session
    this.parties = new Map();       // code -> party
    this.queues = { solo: null, duo: null, trio: null };
    this.matches = new Set();
    this.nextId = 1;
    this.matchSeed = (Date.now() & 0xffffff) | 1;
  }

  // ---------------------------------------------------------------- connections
  connect(ws) {
    const s = { id: 0, ws, token: null, profile: null, party: null, match: null, rate: 0, rateT: Date.now(), alive: true, hello: false };
    ws.on('message', (data, isBinary) => this.onMessage(s, data, isBinary));
    ws.on('close', () => this.disconnect(s));
    ws.on('error', () => {});
    return s;
  }

  send(s, obj) { if (s.ws && s.ws.readyState === 1) s.ws.send(JSON.stringify(obj)); }
  sendBin(s, buf) { if (s.ws && s.ws.readyState === 1 && s.ws.bufferedAmount < 1 << 20) s.ws.send(buf, { binary: true }); }

  onMessage(s, data, isBinary) {
    const now = Date.now();
    if (now - s.rateT > 1000) { s.rateT = now; s.rate = 0; }
    if (++s.rate > 240) { if (s.rate > 600) s.ws.close(4008, 'rate'); return; }
    if (isBinary) { if (s.match && s.hello) s.match.host.input(s.id, data); return; }
    let m;
    try { m = JSON.parse(data.toString()); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    if (!s.hello && m.t !== 'hello') return;
    switch (m.t) {
      case 'hello': return this.hello(s, m);
      case 'ping': return this.send(s, { t: 'pong', c: m.c, s: now });
      case 'name': s.profile.name = cleanName(m.name); this.profiles.save(); this.pushProfile(s); this.pushParty(s.party); break;
      case 'cos': s.profile.cos = sanitizeCosmetics(m.cos, levelInfo(s.profile.xp).level); this.profiles.save(); this.pushProfile(s); this.pushParty(s.party); break;
      case 'profile': this.pushProfile(s); break;
      case 'party.create': this.leaveParty(s); this.createParty(s); break;
      case 'party.join': this.joinParty(s, String(m.code || '').toUpperCase()); break;
      case 'party.leave': this.leaveParty(s); this.createParty(s); break;
      case 'party.mode': this.setMode(s, m.mode); break;
      case 'party.fill': if (s.party && s.party.leader === s.id) { s.party.fill = !!m.fill; this.pushParty(s.party); } break;
      case 'queue': this.enqueue(s); break;
      case 'unqueue': this.dequeue(s.party); break;
      case 'cmd': if (s.match) s.match.host.command(s.id, m.c); break;
      case 'leave': this.leaveMatch(s); break;
      case 'stats': this.send(s, { t: 'stats', matches: this.matches.size, online: this.sessions.size }); break;
    }
  }

  hello(s, m) {
    if (s.hello) return;
    if (m.v !== PROTOCOL_VERSION) { this.send(s, { t: 'err', m: 'Version mismatch: reload the page.' }); s.ws.close(4000, 'version'); return; }
    const [token, profile] = this.profiles.get(m.token, m.name ? cleanName(m.name) : null);
    // One live session per token: a reconnect takes over (and rejoins a running match).
    const old = this.byToken.get(token);
    if (old && old !== s) {
      s.id = old.id; s.party = old.party; s.match = old.match;
      const oldWs = old.ws;
      old.ws = null; old.alive = false;
      try { oldWs?.close(4001, 'replaced'); } catch {}
      this.sessions.set(s.id, s);
      if (s.party) s.party.members = s.party.members.map(x => x === old ? s : x);
      if (s.match) s.match.sessions.set(s.id, s);
    } else {
      s.id = this.nextId++;
      this.sessions.set(s.id, s);
    }
    s.token = token; s.profile = profile; s.hello = true;
    this.byToken.set(token, s);
    if (m.cos) profile.cos = sanitizeCosmetics(m.cos, levelInfo(profile.xp).level);
    this.send(s, { t: 'welcome', id: s.id, token, profile: this.profileView(profile), test: !!this.opts.test });
    if (s.match && !s.match.done) s.match.attach(s);
    if (!s.party) this.createParty(s); else this.pushParty(s.party);
  }

  disconnect(s) {
    if (!s.alive) return;
    s.alive = false;
    const keep = s.match && !s.match.done;
    if (s.match) s.match.detach(s);
    // Keep the session around briefly so a reconnect can resume a running match.
    setTimeout(() => {
      if (s.alive) return;
      if (this.byToken.get(s.token) !== s) return;
      this.byToken.delete(s.token);
      this.sessions.delete(s.id);
      if (s.party) { this.dequeue(s.party); this.removeFromParty(s); }
    }, keep ? 60000 : 1500);
  }

  profileView(p) { return { name: p.name, xp: p.xp, ...levelInfo(p.xp), cos: p.cos, stats: p.stats, history: p.history }; }
  pushProfile(s) { this.send(s, { t: 'profile', profile: this.profileView(s.profile) }); }

  // ---------------------------------------------------------------- parties
  createParty(s) {
    let code;
    do { code = Array.from(randomBytes(5), b => CODE_CHARS[b % CODE_CHARS.length]).join(''); } while (this.parties.has(code));
    const party = { code, leader: s.id, mode: 'solo', fill: true, members: [s], queued: false };
    this.parties.set(code, party);
    s.party = party;
    this.pushParty(party);
  }

  joinParty(s, code) {
    const party = this.parties.get(code);
    if (!party) return this.send(s, { t: 'err', m: 'No party with that code.' });
    if (party === s.party) return;
    if (party.queued || party.members.some(m => m.match && !m.match.done)) return this.send(s, { t: 'err', m: 'That party is in a match or queue.' });
    if (party.members.length >= 3) return this.send(s, { t: 'err', m: 'That party is full.' });
    this.leaveParty(s);
    party.members.push(s); s.party = party;
    if (MODES[party.mode].squad < party.members.length) party.mode = party.members.length === 2 ? 'duo' : 'trio';
    this.pushParty(party);
  }

  leaveParty(s) { if (s.party) { this.dequeue(s.party); this.removeFromParty(s); } }

  removeFromParty(s) {
    const party = s.party;
    if (!party) return;
    party.members = party.members.filter(m => m !== s);
    s.party = null;
    if (!party.members.length) { this.parties.delete(party.code); return; }
    if (party.leader === s.id) party.leader = party.members[0].id;
    this.pushParty(party);
  }

  setMode(s, mode) {
    const party = s.party;
    if (!party || party.leader !== s.id || !MODES[mode] || party.queued) return;
    if (MODES[mode].squad < party.members.length) return this.send(s, { t: 'err', m: `Your party has ${party.members.length} players: pick a bigger squad mode.` });
    party.mode = mode;
    this.pushParty(party);
  }

  pushParty(party) {
    if (!party) return;
    const q = this.queues[party.mode];
    const view = {
      code: party.code, leader: party.leader, mode: party.mode, fill: party.fill, queued: party.queued,
      countdown: party.queued && q ? Math.max(0, Math.ceil((q.startAt - Date.now()) / 1000)) : 0,
      queueHumans: party.queued && q ? q.parties.reduce((n, p) => n + p.members.length, 0) : 0,
      members: party.members.map(m => ({ id: m.id, name: m.profile.name, level: levelInfo(m.profile.xp).level, cos: m.profile.cos, inMatch: !!(m.match && !m.match.done) })),
    };
    for (const m of party.members) this.send(m, { t: 'party', party: view });
  }

  // ---------------------------------------------------------------- queue & matches
  enqueue(s) {
    const party = s.party;
    if (!party || party.leader !== s.id || party.queued) return;
    if (party.members.some(m => m.match && !m.match.done)) return this.send(s, { t: 'err', m: 'Wait for everyone to finish their match.' });
    let q = this.queues[party.mode];
    if (!q) {
      q = this.queues[party.mode] = { mode: party.mode, parties: [], startAt: Date.now() + this.opts.countdown * 1000 };
      q.timer = setInterval(() => this.tickQueue(q), 250);
    }
    q.parties.push(party);
    party.queued = true;
    const humans = q.parties.reduce((n, p) => n + p.members.length, 0);
    if (humans >= MATCH_PLAYERS) q.startAt = Date.now();
    for (const p of q.parties) this.pushParty(p);
  }

  dequeue(party) {
    if (!party || !party.queued) return;
    const q = this.queues[party.mode];
    party.queued = false;
    if (q) {
      q.parties = q.parties.filter(p => p !== party);
      if (!q.parties.length) { clearInterval(q.timer); this.queues[party.mode] = null; }
      else for (const p of q.parties) this.pushParty(p);
    }
    this.pushParty(party);
  }

  tickQueue(q) {
    if (Date.now() < q.startAt) { if ((Date.now() / 250 | 0) % 4 === 0) for (const p of q.parties) this.pushParty(p); return; }
    clearInterval(q.timer);
    this.queues[q.mode] = null;
    const size = MODES[q.mode].squad;
    // Build squads: whole parties first; parties with Fill on are merged to fill squads.
    const groups = [];
    const fillers = [];
    for (const p of q.parties.sort((a, b) => b.members.length - a.members.length)) {
      if (p.members.length >= size || !p.fill) groups.push(p.members.slice(0, size));
      else fillers.push(p.members.slice());
    }
    while (fillers.length) {
      const g = fillers.shift();
      for (let i = 0; i < fillers.length && g.length < size;) {
        if (g.length + fillers[i].length <= size) { g.push(...fillers[i]); fillers.splice(i, 1); } else i++;
      }
      groups.push(g);
    }
    for (const p of q.parties) p.queued = false;
    this.startMatch(q.mode, groups);
  }

  startMatch(mode, groups) {
    const seed = (this.matchSeed = (this.matchSeed * 1103515245 + 12345) >>> 0) || 1;
    const sim = buildMatch({
      seed, mode, total: this.opts.players, timeScale: this.opts.timeScale,
      groups: groups.map(g => g.map(s => ({ id: s.id, name: s.profile.name, cos: s.profile.cos }))),
    });
    sim.start();
    const runner = new MatchRunner(this, sim, mode);
    this.matches.add(runner);
    for (const g of groups) for (const s of g) runner.attach(s);
    for (const g of groups) for (const s of g) if (s.party) this.pushParty(s.party);
    runner.run();
    console.log(`[match ${seed}] ${mode}: ${groups.flat().length} human(s), ${sim.list.length} players`);
  }

  leaveMatch(s) {
    if (!s.match) return;
    const m = s.match;
    m.detach(s);
    m.sessions.delete(s.id);
    s.match = null;
    this.send(s, { t: 'lobby' });
    this.pushParty(s.party);
  }

  finishMatch(runner, results) {
    const byId = new Map(results.map(r => [r.id, r]));
    for (const s of runner.sessions.values()) {
      const r = byId.get(s.id);
      if (!r) continue;
      const xp = applyMatch(s.profile, r, runner.mode);
      this.send(s, { t: 'results', results, you: r, xp, profile: this.profileView(s.profile), winners: results.filter(x => x.place === 1).map(x => x.name) });
    }
    this.profiles.save();
  }
}

class MatchRunner {
  constructor(lobby, sim, mode) {
    this.lobby = lobby; this.sim = sim; this.mode = mode;
    this.host = new MatchHost(sim, { test: !!lobby.opts.test });
    this.sessions = new Map();
    this.done = false;
    this.host.onEnd = (results) => { this.lobby.finishMatch(this, results); this.done = true; this.endAt = Date.now(); };
  }
  attach(s) {
    s.match = this;
    this.sessions.set(s.id, s);
    this.host.attach(s.id, { send: (o) => this.lobby.send(s, o), sendBin: (b) => this.lobby.sendBin(s, b) });
  }
  detach(s) { this.host.detach(s.id); }
  run() {
    let acc = 0, last = performance.now();
    this.timer = setInterval(() => {
      const now = performance.now();
      acc += Math.min(0.25, (now - last) / 1000); last = now;
      let n = 0;
      while (acc >= DT && n < 8) { this.host.step(); acc -= DT; n++; }
      // Dispose once finished and empty (or after a grace period).
      if (this.done && (this.host.clients.size === 0 || Date.now() - this.endAt > 120000)) this.stop();
      if (!this.done && this.host.clients.size === 0 && this.sessions.size === 0) this.stop();
    }, 1000 / TICK_RATE / 2);
  }
  stop() {
    clearInterval(this.timer);
    this.lobby.matches.delete(this);
    for (const s of this.sessions.values()) if (s.match === this) { s.match = null; }
  }
}
