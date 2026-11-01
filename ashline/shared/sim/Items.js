// Item tables: weapons, attachments, ammo, armour, backpacks, heals, throwables. Pure data + helpers.

export const AMMO = {
  '9mm': { name: '9mm', w: 0.35, stack: 30 },
  '556': { name: '5.56', w: 0.45, stack: 30 },
  '762': { name: '7.62', w: 0.6, stack: 30 },
  '12g': { name: '12 Gauge', w: 1.2, stack: 10 },
  '338': { name: '.338', w: 1.4, stack: 10 },
};
export const AMMO_IDS = Object.keys(AMMO);

// dmg per bullet; falloff from r0 (full) to r1 (min multiplier); spread in degrees.
export const WEAPONS = {
  p9: { name: 'P-9', cls: 'pistol', slot: 'side', ammo: '9mm', mag: 15, rpm: 420, auto: false, dmg: 23, head: 2.0, limb: 0.85,
    r0: 18, r1: 60, minMul: 0.55, hip: 2.0, ads: 0.35, bloom: 0.5, kick: 1.4, kickH: 0.5, reload: 1.6, equip: 0.4, zoom: 1.15, snd: 'pistol', atts: ['optic', 'mag', 'muzzle'], optics: ['reddot'] },
  vespa: { name: 'Vespa', cls: 'smg', slot: 'primary', ammo: '9mm', mag: 30, rpm: 850, auto: true, dmg: 19, head: 1.8, limb: 0.9,
    r0: 22, r1: 80, minMul: 0.5, hip: 2.2, ads: 0.55, bloom: 0.18, kick: 0.55, kickH: 0.35, reload: 2.1, equip: 0.5, zoom: 1.25, snd: 'smg', atts: ['optic', 'mag', 'muzzle', 'grip'], optics: ['reddot', 'x2'] },
  kr5: { name: 'KR-5', cls: 'ar', slot: 'primary', ammo: '556', mag: 30, rpm: 690, auto: true, dmg: 26, head: 2.2, limb: 0.85,
    r0: 60, r1: 260, minMul: 0.7, hip: 3.0, ads: 0.28, bloom: 0.14, kick: 0.85, kickH: 0.4, reload: 2.4, equip: 0.6, zoom: 1.3, snd: 'rifle', atts: ['optic', 'mag', 'muzzle', 'grip'], optics: ['reddot', 'x2', 'x4'] },
  halberd: { name: 'Halberd', cls: 'ar', slot: 'primary', ammo: '762', mag: 30, rpm: 580, auto: true, dmg: 33, head: 2.2, limb: 0.85,
    r0: 60, r1: 280, minMul: 0.7, hip: 3.4, ads: 0.35, bloom: 0.2, kick: 1.35, kickH: 0.7, reload: 2.7, equip: 0.7, zoom: 1.3, snd: 'heavyrifle', atts: ['optic', 'mag', 'muzzle', 'grip'], optics: ['reddot', 'x2', 'x4'] },
  sable: { name: 'Sable', cls: 'dmr', slot: 'primary', ammo: '762', mag: 10, rpm: 300, auto: false, dmg: 49, head: 2.3, limb: 0.9,
    r0: 150, r1: 520, minMul: 0.8, hip: 4.0, ads: 0.08, bloom: 0.6, kick: 2.2, kickH: 0.6, reload: 2.9, equip: 0.8, zoom: 1.4, snd: 'heavyrifle', atts: ['optic', 'mag', 'muzzle'], optics: ['reddot', 'x2', 'x4', 'x8'] },
  longreach: { name: 'Longreach', cls: 'sniper', slot: 'primary', ammo: '338', mag: 5, rpm: 46, auto: false, dmg: 104, head: 2.4, limb: 0.9,
    r0: 300, r1: 900, minMul: 0.85, hip: 6.0, ads: 0.02, bloom: 0, kick: 4.5, kickH: 0.8, reload: 3.6, equip: 1.0, zoom: 1.4, snd: 'sniper', atts: ['optic', 'muzzle'], optics: ['reddot', 'x2', 'x4', 'x8'] },
  breacher: { name: 'Breacher', cls: 'shotgun', slot: 'primary', ammo: '12g', mag: 5, rpm: 72, auto: false, dmg: 13, pellets: 9, head: 1.5, limb: 0.9,
    r0: 7, r1: 34, minMul: 0.15, hip: 4.2, ads: 3.0, bloom: 0, kick: 4.0, kickH: 1.0, reload: 3.4, equip: 0.7, zoom: 1.1, snd: 'shotgun', atts: ['optic'], optics: ['reddot'] },
  mattock: { name: 'Mattock', cls: 'lmg', slot: 'primary', ammo: '556', mag: 75, rpm: 640, auto: true, dmg: 26, head: 2.0, limb: 0.85,
    r0: 60, r1: 260, minMul: 0.7, hip: 4.0, ads: 0.5, bloom: 0.16, kick: 0.95, kickH: 0.6, reload: 5.2, equip: 1.0, zoom: 1.25, snd: 'heavyrifle', atts: ['optic', 'grip'], optics: ['reddot', 'x2', 'x4'], slowMul: 0.92 },
  tern: { name: 'Tern', cls: 'ar', slot: 'primary', ammo: '556', mag: 30, rpm: 960, burst: 3, auto: false, dmg: 28, head: 2.2, limb: 0.85,
    r0: 70, r1: 280, minMul: 0.72, hip: 2.6, ads: 0.2, bloom: 0.12, kick: 0.75, kickH: 0.3, reload: 2.3, equip: 0.6, zoom: 1.3, snd: 'rifle', atts: ['optic', 'mag', 'muzzle', 'grip'], optics: ['reddot', 'x2', 'x4'] },
  wasp: { name: 'Wasp', cls: 'pistol', slot: 'side', ammo: '9mm', mag: 20, rpm: 1000, auto: true, dmg: 15, head: 1.7, limb: 0.9,
    r0: 12, r1: 45, minMul: 0.5, hip: 2.6, ads: 0.9, bloom: 0.2, kick: 0.6, kickH: 0.5, reload: 1.8, equip: 0.35, zoom: 1.15, snd: 'smg', atts: ['optic', 'mag', 'muzzle'], optics: ['reddot'] },
  magistrate: { name: 'Magistrate', cls: 'pistol', slot: 'side', ammo: '762', mag: 6, rpm: 150, auto: false, dmg: 54, head: 2.0, limb: 0.85,
    r0: 25, r1: 90, minMul: 0.6, hip: 2.4, ads: 0.25, bloom: 1.2, kick: 3.6, kickH: 0.9, reload: 2.7, equip: 0.45, zoom: 1.2, snd: 'heavyrifle', atts: ['optic'], optics: ['reddot'] },
};
export const WEAPON_IDS = Object.keys(WEAPONS);

export const ATTACH = {
  reddot: { name: 'Red Dot', type: 'optic', zoom: 1.6, w: 4 },
  x2: { name: '2x Scope', type: 'optic', zoom: 2, w: 5 },
  x4: { name: '4x Scope', type: 'optic', zoom: 4, w: 6, scope: true },
  x8: { name: '8x Scope', type: 'optic', zoom: 8, w: 8, scope: true },
  extmag: { name: 'Extended Mag', type: 'mag', w: 6 },
  suppressor: { name: 'Suppressor', type: 'muzzle', w: 8 },
  grip: { name: 'Vertical Grip', type: 'grip', w: 4 },
};
export const ATTACH_IDS = Object.keys(ATTACH);

export const ARMOR = {
  helmet: [null, { red: 0.3, dur: 80 }, { red: 0.4, dur: 150 }, { red: 0.55, dur: 230 }],
  vest: [null, { red: 0.3, dur: 200 }, { red: 0.4, dur: 220 }, { red: 0.55, dur: 250 }],
};
export const PACK_CAP = [140, 220, 300, 380];

export const HEALS = {
  bandage: { name: 'Bandage', time: 4, heal: 15, cap: 75, w: 2, max: 20 },
  kit: { name: 'Field Kit', time: 8, heal: 100, cap: 100, w: 15, max: 5 },
  stim: { name: 'Stim', time: 4, boost: 40, w: 8, max: 10 },
};
export const THROWS = {
  frag: { name: 'Frag Grenade', w: 12, max: 6 },
  smoke: { name: 'Smoke Grenade', w: 10, max: 6 },
};

// Display name for a ground item.
export function itemName(it) {
  switch (it.k) {
    case 'weapon': return WEAPONS[it.id].name;
    case 'ammo': return `${AMMO[it.id].name} ×${it.n}`;
    case 'helmet': return `Helmet (Lv.${it.tier})`;
    case 'vest': return `Vest (Lv.${it.tier})`;
    case 'pack': return `Backpack (Lv.${it.tier})`;
    case 'heal': return `${HEALS[it.id].name}${it.n > 1 ? ' ×' + it.n : ''}`;
    case 'throw': return `${THROWS[it.id].name}${it.n > 1 ? ' ×' + it.n : ''}`;
    case 'att': return ATTACH[it.id].name;
    default: return '?';
  }
}

export function magSize(w) {
  const def = WEAPONS[w.id];
  if (w.att && w.att.mag === 'extmag') return Math.round(def.mag * (def.cls === 'pistol' || def.cls === 'smg' ? 1.5 : 1.34));
  return def.mag;
}

export function canAttach(weaponId, attId) {
  const def = WEAPONS[weaponId], a = ATTACH[attId];
  if (!def.atts.includes(a.type)) return false;
  if (a.type === 'optic') return def.optics.includes(attId);
  return true;
}

// Loot tables by tier. Each spot rolls: maybe an item group.
const WEAPON_WEIGHTS = {
  1: [['p9', 6], ['wasp', 2], ['magistrate', 1.5], ['vespa', 4], ['breacher', 3], ['kr5', 3], ['tern', 1.5], ['halberd', 1], ['sable', 0.5]],
  2: [['p9', 3], ['wasp', 1.5], ['magistrate', 1.5], ['vespa', 4], ['breacher', 3], ['kr5', 4], ['tern', 2.5], ['halberd', 3], ['sable', 1.5], ['mattock', 0.8], ['longreach', 0.4]],
  3: [['vespa', 2], ['kr5', 4], ['tern', 3], ['halberd', 4], ['sable', 2.5], ['mattock', 1.5], ['longreach', 1.2], ['breacher', 1], ['magistrate', 1]],
};
const ARMOR_TIER = { 1: [[1, 8], [2, 2], [3, 0.2]], 2: [[1, 5], [2, 4], [3, 0.8]], 3: [[1, 2], [2, 5], [3, 2.5]] };

export function rollLoot(rng, tier) {
  const out = [];
  const kind = rng.weighted([['weapon', 30], ['ammo', 18], ['helmet', 8], ['vest', 8], ['pack', 6], ['heal', 16], ['throw', 7], ['att', 9], ['none', 18 - tier * 4]]);
  switch (kind) {
    case 'weapon': {
      const id = rng.weighted(WEAPON_WEIGHTS[tier]);
      out.push({ k: 'weapon', id });
      const def = WEAPONS[id];
      out.push({ k: 'ammo', id: def.ammo, n: AMMO[def.ammo].stack * (def.ammo === '338' ? 1 : 2) });
      break;
    }
    case 'ammo': { const id = rng.weighted([['9mm', 3], ['556', 3], ['762', 2.5], ['12g', 1.5], ['338', 0.6]]); out.push({ k: 'ammo', id, n: AMMO[id].stack }); break; }
    case 'helmet': out.push({ k: 'helmet', tier: rng.weighted(ARMOR_TIER[tier]) }); break;
    case 'vest': out.push({ k: 'vest', tier: rng.weighted(ARMOR_TIER[tier]) }); break;
    case 'pack': out.push({ k: 'pack', tier: rng.weighted(ARMOR_TIER[tier]) }); break;
    case 'heal': { const id = rng.weighted([['bandage', 6], ['kit', 1.5], ['stim', 2]]); out.push({ k: 'heal', id, n: id === 'bandage' ? 5 : 1 }); break; }
    case 'throw': out.push({ k: 'throw', id: rng.weighted([['frag', 3], ['smoke', 2]]), n: 1 }); break;
    case 'att': out.push({ k: 'att', id: rng.weighted([['reddot', 4], ['x2', 3], ['x4', 1.5 + tier * 0.5], ['x8', 0.3 + tier * 0.3], ['extmag', 3], ['suppressor', 1.5], ['grip', 3]]) }); break;
    default: break;
  }
  return out;
}

// Rough desirability scores (used by bots and auto-pickup decisions).
export const WEAPON_SCORE = { p9: 1, wasp: 2, magistrate: 2.2, vespa: 4, breacher: 4, kr5: 6, tern: 6.2, halberd: 6.5, sable: 5.5, mattock: 6, longreach: 5 };
