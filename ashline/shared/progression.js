// XP, levels and cosmetic unlocks. Shared so server, client and practice mode agree.

export const MAX_LEVEL = 50;
export const xpToNext = (level) => 400 + 120 * (level - 1);

export function levelInfo(xp) {
  let level = 1, rest = Math.max(0, xp | 0);
  while (level < MAX_LEVEL && rest >= xpToNext(level)) { rest -= xpToNext(level); level++; }
  return { level, into: rest, need: level >= MAX_LEVEL ? 0 : xpToNext(level) };
}

// Cosmetic catalogue. Colours are used by the client's procedural camo / finish generators.
export const CAMOS = [
  { id: 'olive', name: 'Olive Drab', level: 1, c: ['#4a4d36', '#3b3e2b', '#5a5c42', '#2f3122'] },
  { id: 'woodland', name: 'Woodland', level: 2, c: ['#4b5232', '#2e2a1d', '#6b5a3a', '#1c1f15'] },
  { id: 'ash', name: 'Ashfall', level: 4, c: ['#6c6a66', '#4a4846', '#8a8782', '#2e2c2b'] },
  { id: 'urban', name: 'Urban Grey', level: 6, c: ['#5d6166', '#3e4146', '#7c8086', '#24272b'] },
  { id: 'desert', name: 'Desert Tan', level: 8, c: ['#8f7a55', '#a8916a', '#6f5d3e', '#c2aa80'] },
  { id: 'tiger', name: 'Tigerstripe', level: 11, c: ['#4d5a2e', '#1d1c14', '#6e6233', '#2c331b'] },
  { id: 'night', name: 'Nightwatch', level: 14, c: ['#22262e', '#14171c', '#343a45', '#0b0d10'] },
  { id: 'dapple', name: 'Dapple', level: 17, c: ['#56603a', '#7b7a4a', '#33391f', '#4a3b25'] },
  { id: 'ember', name: 'Ember', level: 20, c: ['#3a2b25', '#6b3a22', '#1e1715', '#8a4a26'] },
  { id: 'arctic', name: 'Arctic', level: 24, c: ['#c9ccd0', '#9da3a8', '#e6e8ea', '#7d8389'] },
  { id: 'digital', name: 'Digital', level: 28, c: ['#5b6247', '#3d4230', '#7a7f63', '#2a2d20'] },
  { id: 'blackout', name: 'Blackout', level: 35, c: ['#141414', '#1f1f1f', '#2a2a2a', '#0a0a0a'] },
  { id: 'ashborn', name: 'Ashborn', level: 50, c: ['#2b2522', '#c2561e', '#4a3f3a', '#151110'] },
];
export const HELMETS = [
  { id: 'bare', name: 'Bare Shell', level: 1 },
  { id: 'netting', name: 'Netting', level: 3 },
  { id: 'mesh', name: 'Mesh Cover', level: 7 },
  { id: 'scrim', name: 'Scrim', level: 12 },
  { id: 'painted', name: 'Hand-painted', level: 18 },
  { id: 'tan', name: 'Tan Cover', level: 23 },
  { id: 'ridge', name: 'Ridge Plate', level: 31 },
  { id: 'warpaint', name: 'Warpaint', level: 40 },
];
export const FINISHES = [
  { id: 'parkerized', name: 'Parkerized', level: 1, c: '#2b2c2e', m: 0.55, r: 0.55 },
  { id: 'polymer', name: 'Polymer Black', level: 5, c: '#1b1c1d', m: 0.1, r: 0.7 },
  { id: 'fde', name: 'Flat Dark Earth', level: 9, c: '#7a6a4f', m: 0.1, r: 0.75 },
  { id: 'odgreen', name: 'OD Green', level: 13, c: '#4a5038', m: 0.1, r: 0.72 },
  { id: 'bronze', name: 'Burnt Bronze', level: 16, c: '#6b4a2c', m: 0.75, r: 0.4 },
  { id: 'tungsten', name: 'Tungsten', level: 21, c: '#5e6266', m: 0.85, r: 0.35 },
  { id: 'gunmetal', name: 'Gunmetal', level: 26, c: '#3d4247', m: 0.9, r: 0.3 },
  { id: 'brass', name: 'Brass', level: 32, c: '#a07c3a', m: 0.95, r: 0.3 },
  { id: 'damascus', name: 'Damascus', level: 38, c: '#55575a', m: 0.9, r: 0.25 },
  { id: 'obsidian', name: 'Obsidian', level: 45, c: '#0f0f12', m: 0.6, r: 0.15 },
];
export const TITLES = [
  { id: 'recruit', name: 'Recruit', level: 1 }, { id: 'scavenger', name: 'Scavenger', level: 10 }, { id: 'ashwalker', name: 'Ashwalker', level: 15 },
  { id: 'survivor', name: 'Survivor', level: 19 }, { id: 'ranger', name: 'Ranger', level: 22 }, { id: 'veteran', name: 'Veteran', level: 25 },
  { id: 'ghost', name: 'Ghost', level: 29 }, { id: 'warden', name: 'Warden', level: 33 }, { id: 'hunter', name: 'Hunter', level: 37 },
  { id: 'iron', name: 'Iron', level: 42 }, { id: 'legend', name: 'Legend', level: 48 }, { id: 'ashline', name: 'Ashline', level: 50 },
];
export const CATALOG = { camo: CAMOS, helmet: HELMETS, finish: FINISHES, title: TITLES };

export function unlockedAt(level) {
  const out = [];
  for (const [kind, list] of Object.entries(CATALOG)) for (const it of list) if (it.level === level) out.push({ kind, id: it.id, name: it.name });
  return out;
}
export function isUnlocked(kind, id, level) { const it = (CATALOG[kind] || []).find(i => i.id === id); return !!it && it.level <= level; }
export const DEFAULT_COS = { camo: 'olive', helmet: 'bare', finish: 'parkerized', title: 'recruit' };

export function sanitizeCosmetics(cos, level) {
  const out = { ...DEFAULT_COS };
  if (cos && typeof cos === 'object') for (const k of Object.keys(DEFAULT_COS)) if (typeof cos[k] === 'string' && isUnlocked(k, cos[k], level)) out[k] = cos[k];
  return out;
}

export function randomCosmetics(rng) {
  const lvl = rng.int(1, 40);
  const pick = (list) => { const ok = list.filter(i => i.level <= lvl); return ok[rng.int(0, ok.length - 1)].id; };
  return { camo: pick(CAMOS), helmet: pick(HELMETS), finish: pick(FINISHES), title: pick(TITLES) };
}

// XP for one match. r: a results() row from Sim.
export function matchXp(r) {
  const rows = [];
  const add = (label, xp) => { if (xp > 0) rows.push({ label, xp: Math.round(xp) }); };
  add(`Survival (${Math.floor(r.survived / 60)}m ${Math.round(r.survived % 60)}s)`, Math.floor(r.survived / 10) * 5);
  add(`Kills ×${r.kills}`, r.kills * 100);
  add(`Assists ×${r.assists}`, r.assists * 40);
  add(`Revives ×${r.revives}`, r.revives * 75);
  add(`Intel hacks ×${r.hacks}`, r.hacks * 60);
  add(`Damage dealt (${Math.round(r.dmg)})`, r.dmg * 0.25);
  const place = r.place === 1 ? 600 : r.place <= 5 ? 300 : r.place <= 10 ? 150 : 0;
  add(r.place === 1 ? 'Last squad standing' : `Placement #${r.place}`, place);
  const total = rows.reduce((s, x) => s + x.xp, 0);
  return { rows, total };
}

// Apply a match result to a profile object (mutates). Returns { xp, before, after, unlocks }.
export function applyMatch(profile, r, mode) {
  const before = levelInfo(profile.xp);
  const { rows, total } = matchXp(r);
  profile.xp += total;
  const after = levelInfo(profile.xp);
  const unlocks = [];
  for (let l = before.level + 1; l <= after.level; l++) unlocks.push(...unlockedAt(l));
  const s = profile.stats;
  s.matches++; if (r.place === 1) s.wins++; if (r.place <= 10) s.top10++;
  s.kills += r.kills; s.deaths += r.alive ? 0 : 1; s.damage += Math.round(r.dmg); s.revives += r.revives; s.assists += r.assists;
  s.headshots += r.heads || 0; s.longest = Math.max(s.longest, r.longest || 0); s.timePlayed += r.survived;
  profile.history.unshift({ at: Date.now(), mode, place: r.place, kills: r.kills, dmg: Math.round(r.dmg), xp: total, survived: r.survived });
  profile.history = profile.history.slice(0, 20);
  return { rows, xp: total, before, after, unlocks };
}

export function newProfile(name = 'Survivor') {
  return {
    name, xp: 0, cos: { ...DEFAULT_COS }, created: Date.now(),
    stats: { matches: 0, wins: 0, top10: 0, kills: 0, deaths: 0, damage: 0, revives: 0, assists: 0, headshots: 0, longest: 0, timePlayed: 0 },
    history: [],
  };
}
