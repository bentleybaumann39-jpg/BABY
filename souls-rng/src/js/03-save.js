// =====================================================================
//  SAVE — v2 save with migration from the original game's keys
// =====================================================================
const SAVE_KEY = 'soulsrng_v2';
function genCode() { return 'xxxx-xxxx-xxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16)); }
function defaultSave() {
  return {
    v: 2, coins: 900, luck: 0, dmg: 1, spd: 1, hp: 1, greed: 0, autoUnlocked: false, quick: false, autoSell: -1, potion: 0,
    bpXp: 0, bpClaimed: [], inv: {}, newest: {}, eq: 'warrior|', disc: {},
    stats: { rolls: 0, bosses: 0, kills: 0, trades: 0, best: 0, rarest: 2, deaths: 0, time: 0, realms: 0 },
    fcode: genCode(), friends: [], reqs: [], outreqs: [], redeemed: [],
    set: { sens: 1, inv: false, fov: 75, quality: 'high', vol: 0.7, music: true, shake: true, nums: true, fps: false }
  };
}
let S = defaultSave();

function closestByOdds(odds) {
  let best = ROSTER[0];
  for (const C of ROSTER) if (C.odds <= odds) best = C;
  return best;
}
function migrateOld() {
  const g = k => localStorage.getItem(k);
  if (g('souls_c') === null && g('souls_inv') === null) return false;
  const s = defaultSave();
  s.coins = parseInt(g('souls_c') || '900') || 900;
  s.luck = parseInt(g('souls_ll') || '0') || 0;
  s.dmg = parseInt(g('souls_dl') || '1') || 1;
  s.spd = parseInt(g('souls_sl') || '1') || 1;
  s.hp = parseInt(g('souls_hl') || '1') || 1;
  s.autoUnlocked = g('souls_ar_unlocked') === 'true';
  s.bpXp = parseInt(g('souls_bp_xp') || '0') || 0;
  try { s.bpClaimed = JSON.parse(g('souls_bp_claimed') || '[]'); } catch (e) { }
  if (g('souls_fcode')) s.fcode = g('souls_fcode');
  try { s.friends = JSON.parse(g('souls_friends') || '[]'); } catch (e) { }
  try { const a = JSON.parse(g('souls_ach') || '{}'); s.stats.rolls = a.rolls || 0; s.stats.bosses = a.bosses || 0; s.stats.trades = a.trades || 0; } catch (e) { }
  let inv = [];
  try { inv = JSON.parse(g('souls_inv') || '[]'); } catch (e) { }
  let eqOdds = 0;
  inv.forEach(it => {
    const C = closestByOdds(it.odds || 2); const key = C.id + '|';
    s.inv[key] = (s.inv[key] || 0) + 1; s.disc[C.id] = 1; s.newest[key] = Date.now();
    if (C.odds > eqOdds) { eqOdds = C.odds; s.eq = key; }
    s.stats.rarest = Math.max(s.stats.rarest, C.odds);
  });
  S = s;
  return true;
}
function loadSave() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { }
  if (raw) {
    try {
      const d = JSON.parse(raw); const def = defaultSave();
      S = Object.assign(def, d);
      S.stats = Object.assign(defaultSave().stats, d.stats || {});
      S.set = Object.assign(defaultSave().set, d.set || {});
    } catch (e) { console.warn('bad save, resetting', e); S = defaultSave(); }
  } else if (migrateOld()) {
    setTimeout(() => notify('Save imported', 'Your coins, upgrades and characters were carried over from the old version.'), 1500);
  }
  // sanitize inventory
  for (const k of Object.keys(S.inv)) { const [cid, mut] = k.split('|'); if (!ROSTER_BY_ID[cid] || !(mut in MUTATIONS) || !(S.inv[k] > 0)) delete S.inv[k]; }
  if (!Object.keys(S.inv).length) { S.inv['warrior|'] = 1; S.disc.warrior = 1; S.eq = 'warrior|'; }
  if (!S.inv[S.eq]) S.eq = Object.keys(S.inv)[0];
  saveNow();
}
let _saveT = 0;
function saveNow() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }
function saveSoon() { clearTimeout(_saveT); _saveT = setTimeout(saveNow, 400); }

// ---- inventory helpers ----
function keyOf(cid, mut) { return cid + '|' + (mut || ''); }
function parseKey(k) { const [cid, mut] = k.split('|'); return { cid, mut: mut || '', C: ROSTER_BY_ID[cid], M: MUTATIONS[mut || ''] }; }
function invAdd(cid, mut, n = 1) { const k = keyOf(cid, mut); S.inv[k] = (S.inv[k] || 0) + n; S.newest[k] = Date.now(); S.disc[cid] = 1; }
function invRemove(k, n = 1) { if (!S.inv[k]) return false; S.inv[k] -= n; if (S.inv[k] <= 0) { delete S.inv[k]; delete S.newest[k]; } return true; }
function eqInfo() { return parseKey(S.eq); }
function sellValue(cid, mut) { return Math.max(20, Math.floor(22 * Math.pow(totalOdds(cid, mut), 0.42))); }
function discoveredCount() { return Object.keys(S.disc).filter(id => ROSTER_BY_ID[id]).length; }

// ---- luck ----
function equippedLuckBonus() { const { C } = eqInfo(); return C && C.p.includes('lucky') ? 0.25 * C.L : 0; }
function getLuck() { return (1 + 0.28 * S.luck + equippedLuckBonus()) * (S.potion > 0 ? 2 : 1); }
function rollOnce() {
  const luck = getLuck(); const r = Math.random(); let C = ROSTER[0];
  for (let i = ROSTER.length - 1; i >= 1; i--) if (r < luck / ROSTER[i].odds) { C = ROSTER[i]; break; }
  let mut = '';
  for (const m of MUT_ORDER) if (Math.random() < Math.sqrt(luck) / MUTATIONS[m].odds) { mut = m; break; }
  return { cid: C.id, mut };
}
