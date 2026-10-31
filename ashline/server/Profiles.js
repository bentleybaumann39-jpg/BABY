// JSON-file profile store keyed by a random client token. Writes are debounced and atomic.
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { newProfile } from '../shared/progression.js';

export class Profiles {
  constructor(dir) {
    this.dir = dir;
    this.file = join(dir, 'profiles.json');
    this.data = {};
    this.timer = null;
    mkdirSync(dir, { recursive: true });
    if (existsSync(this.file)) {
      try { this.data = JSON.parse(readFileSync(this.file, 'utf8')) || {}; } catch (e) { console.warn('profiles.json unreadable, starting fresh:', e.message); this.data = {}; }
    }
  }

  // Returns [token, profile]. Unknown or malformed tokens get a fresh profile.
  get(token, name) {
    if (typeof token === 'string' && /^[a-f0-9]{32}$/.test(token) && this.data[token]) {
      const p = repair(this.data[token]);
      if (name) p.name = name;
      this.data[token] = p;
      return [token, p];
    }
    const t = randomBytes(16).toString('hex');
    this.data[t] = newProfile(name || 'Survivor');
    this.save();
    return [t, this.data[t]];
  }

  save(now = false) {
    if (now) return this.flush();
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 500);
  }

  flush() {
    const tmp = this.file + '.tmp';
    writeFileSync(tmp, JSON.stringify(this.data));
    renameSync(tmp, this.file);
  }
}

function repair(p) {
  const base = newProfile(typeof p.name === 'string' ? p.name : 'Survivor');
  const out = { ...base, ...p };
  out.xp = Number.isFinite(out.xp) && out.xp >= 0 ? out.xp : 0;
  out.stats = { ...base.stats, ...(p.stats || {}) };
  for (const k in out.stats) if (!Number.isFinite(out.stats[k])) out.stats[k] = 0;
  out.history = Array.isArray(p.history) ? p.history.slice(0, 20) : [];
  out.cos = { ...base.cos, ...(p.cos || {}) };
  return out;
}
