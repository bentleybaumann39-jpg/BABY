// Profile + settings persistence with validation and repair. Never trusts stored data.
import { KAIJU, UPGRADES, MISSIONS } from './Config.js';

const KEY = 'landfall.profile';
const SKEY = 'landfall.settings';
export const VERSION = 1;

export const SETTINGS_DEF = {
  quality: 'high', sensitivity: 1, invertY: false, fov: 55, master: 0.9, music: 0.6, sfx: 0.9,
  shake: 1, reducedMotion: false, captions: true, showFps: false,
};
const SETTINGS_RULE = {
  quality: (v) => ['low', 'medium', 'high', 'ultra'].includes(v),
  sensitivity: (v) => typeof v === 'number' && v >= 0.2 && v <= 3,
  invertY: (v) => typeof v === 'boolean', fov: (v) => typeof v === 'number' && v >= 40 && v <= 80,
  master: (v) => typeof v === 'number' && v >= 0 && v <= 1, music: (v) => typeof v === 'number' && v >= 0 && v <= 1,
  sfx: (v) => typeof v === 'number' && v >= 0 && v <= 1, shake: (v) => typeof v === 'number' && v >= 0 && v <= 1.5,
  reducedMotion: (v) => typeof v === 'boolean', captions: (v) => typeof v === 'boolean', showFps: (v) => typeof v === 'boolean',
};

function store() {
  try { return window.localStorage; } catch (e) { return null; }
}

export function newProfile() {
  const levels = {};
  for (const id of Object.keys(KAIJU)) levels[id] = {};
  return { v: VERSION, biomass: 0, unlocked: { gorvax: true }, levels, missions: {}, selected: 'gorvax', stats: { rampages: 0, damage: 0, towers: 0, kills: 0 } };
}

export function repairProfile(p) {
  const d = newProfile();
  if (!p || typeof p !== 'object') return d;
  const out = d;
  out.biomass = Number.isFinite(p.biomass) && p.biomass >= 0 ? Math.floor(p.biomass) : 0;
  if (p.unlocked && typeof p.unlocked === 'object') for (const id of Object.keys(KAIJU)) if (p.unlocked[id] === true) out.unlocked[id] = true;
  out.unlocked.gorvax = true;
  if (p.levels && typeof p.levels === 'object') {
    for (const id of Object.keys(KAIJU)) {
      const L = p.levels[id];
      if (!L || typeof L !== 'object') continue;
      for (const u of UPGRADES) {
        const v = L[u.id];
        if (Number.isInteger(v) && v >= 0) out.levels[id][u.id] = Math.min(u.max, v);
      }
    }
  }
  if (p.missions && typeof p.missions === 'object') {
    for (const m of MISSIONS) {
      const r = p.missions[m.id];
      if (r && typeof r === 'object') out.missions[m.id] = { done: !!r.done, best: Number.isFinite(r.best) ? r.best : 0 };
    }
  }
  if (typeof p.selected === 'string' && out.unlocked[p.selected]) out.selected = p.selected;
  if (p.stats && typeof p.stats === 'object') for (const k of Object.keys(out.stats)) if (Number.isFinite(p.stats[k])) out.stats[k] = p.stats[k];
  return out;
}

export function loadProfile() {
  const s = store();
  if (!s) return newProfile();
  try { return repairProfile(JSON.parse(s.getItem(KEY) || 'null')); } catch (e) { return newProfile(); }
}

export function saveProfile(p) {
  const s = store();
  if (!s) return false;
  try { s.setItem(KEY, JSON.stringify(p)); return true; } catch (e) { return false; }
}

export function loadSettings() {
  const out = { ...SETTINGS_DEF };
  const s = store();
  if (!s) return out;
  try {
    const raw = JSON.parse(s.getItem(SKEY) || 'null');
    if (raw && typeof raw === 'object') for (const k of Object.keys(SETTINGS_DEF)) if (SETTINGS_RULE[k](raw[k])) out[k] = raw[k];
  } catch (e) { /* use defaults */ }
  return out;
}

export function saveSettings(v) {
  const s = store();
  if (!s) return;
  try { s.setItem(SKEY, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ }
}

export function missionUnlocked(profile, m) {
  return !m.requires || (profile.missions[m.requires] && profile.missions[m.requires].done);
}
