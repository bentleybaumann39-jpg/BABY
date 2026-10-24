// Game data: the kaiju roster, upgrade tracks, missions and military tiers.
// Every tunable lives here so balancing never touches logic.
// Move windows are in seconds of clip time (the Blender anim functions' t).

export const KAIJU = {
  razormaw: {
    name: 'RAZORMAW', title: 'The Split Crest', asset: 'razormaw', height: 56, color: '#4fc3ff',
    blurb: 'An 87-metre alien brute. Its skull splits into two crest blades lined with teeth, and its talons burn with cold blue light.',
    base: { hp: 1150, armor: 0.26, regen: 4, energy: 100, energyRegen: 5, melee: 320, heavy: 420, stomp: 260, special: 950, speed: 0.9, scale: 1.55 },
    moves: {
      attack1: { name: 'Talon Rake', bone: 'handR', radius: 10, reach: 4, window: [0.36, 0.62] },
      attack2: { name: 'Backhand Rake', bone: 'handL', radius: 10, reach: 4, window: [0.36, 0.62] },
      heavy: { name: 'Hammerfall', bones: ['handL', 'handR'], radius: 42, window: [0.95, 1.1], aoe: true },
      stomp: { name: 'Quake Stomp', foot: 'toeR', radius: 46, time: 0.84 },
      special: { name: 'Plasma Breath', kind: 'beam', cost: 22, range: 900, radius: 7, color: [0.35, 0.75, 1.0] },
    },
  },
  harrowblade: {
    name: 'HARROWBLADE', title: 'The Knife Stalker', asset: 'harrowblade', height: 55, cost: 1800, color: '#3ee6ff',
    blurb: 'A fast stalker whose skull runs forward into a knife the length of a city block. Glowing chevrons run down its flanks.',
    base: { hp: 950, armor: 0.22, regen: 4, energy: 100, energyRegen: 7, melee: 300, heavy: 380, stomp: 260, special: 760, speed: 1.12, scale: 1.55 },
    moves: {
      attack1: { name: 'Blade Cleave', bone: 'head', radius: 10, reach: 16, window: [0.36, 0.62] },
      attack2: { name: 'Raptor Claw', bone: 'handR', radius: 8, reach: 3, window: [0.32, 0.58] },
      heavy: { name: 'Fin Scythe', bones: ['tail6', 'tail7', 'tail8', 'tail9'], radius: 8, window: [0.5, 1.15] },
      stomp: { name: 'Pounce', kind: 'leap', radius: 44, time: 1.0 },
      special: { name: 'Blade Charge', kind: 'charge', cost: 28, duration: 5, color: [0.3, 0.85, 1.0] },
    },
  },
  hollowstrider: {
    name: 'HOLLOWSTRIDER', title: 'The Gaunt Walker', asset: 'hollowstrider', height: 52, quadruped: true, cost: 3000, color: '#ff8a5c',
    blurb: 'A pale, ribbed horror carried on four impossibly long limbs. It vents choking spores and lashes a forked whip tail.',
    base: { hp: 1000, armor: 0.2, regen: 6, energy: 100, energyRegen: 8, melee: 290, heavy: 400, stomp: 300, special: 400, speed: 1.0, scale: 1.6 },
    moves: {
      attack1: { name: 'Impaler', bone: 'handR', radius: 9, reach: 2, window: [0.46, 0.72] },
      attack2: { name: 'Maw Lunge', bone: 'jaw', radius: 9, reach: 6, window: [0.25, 0.48] },
      heavy: { name: 'Fork Lash', bones: ['tail8', 'tail9', 'tail10', 'forkL', 'forkR'], radius: 8, window: [0.55, 1.1] },
      stomp: { name: 'Pillar Slam', foot: 'handR', radius: 50, time: 0.93 },
      special: { name: 'Spore Torrent', kind: 'spray', cost: 18, range: 300, radius: 34, color: [1.0, 0.5, 0.25] },
    },
  },
  nyxwing: {
    name: 'NYXWING', title: 'The Acid Wraith', asset: 'nyxwing', height: 46, quadruped: true, cost: 4200, color: '#7dff6a',
    blurb: 'A winged alien with a throat full of glowing acid. It leaps on beating wings and spits burning globs across the skyline.',
    base: { hp: 850, armor: 0.18, regen: 5, energy: 100, energyRegen: 9, melee: 280, heavy: 360, stomp: 280, special: 620, speed: 1.1, scale: 1.6 },
    moves: {
      attack1: { name: 'Lance Strike', bone: 'jaw', radius: 8, reach: 6, window: [0.34, 0.56] },
      attack2: { name: 'Wing Buffet', bones: ['wing2R', 'wing3R', 'wingf1R'], radius: 10, window: [0.34, 0.62] },
      heavy: { name: 'Spade Lash', bones: ['tail7', 'tail8', 'tail9', 'tail10'], radius: 8, window: [0.5, 1.1] },
      stomp: { name: 'Wingbeat Leap', kind: 'leap', radius: 46, time: 1.0, range: 1.5 },
      special: { name: 'Acid Volley', kind: 'spit', cost: 7, range: 700, radius: 30, color: [0.4, 1.0, 0.2] },
    },
  },
  gravemaw: {
    name: 'GRAVEMAW', title: 'The Siege Titan', asset: 'gravemaw', height: 44, quadruped: true, menuGlow: 0.12, cost: 5600, color: '#ffb347',
    blurb: 'A walking fortress under a domed carapace. When its seams blaze amber, the pulse it releases fries every machine for blocks.',
    base: { hp: 1800, armor: 0.45, regen: 6, energy: 100, energyRegen: 6, melee: 380, heavy: 480, stomp: 320, special: 900, speed: 0.78, scale: 1.6 },
    moves: {
      attack1: { name: 'Siege Fist', bone: 'handR', radius: 11, reach: 3, window: [0.4, 0.66] },
      attack2: { name: 'Hammerhead Ram', bone: 'head', radius: 13, reach: 8, window: [0.36, 0.62] },
      heavy: { name: 'Twin Pound', bones: ['handL', 'handR'], radius: 46, window: [0.95, 1.1], aoe: true },
      stomp: { name: 'Earthbreaker', foot: 'handR', radius: 56, time: 0.96 },
      special: { name: 'Dread Pulse', kind: 'pulse', cost: 45, radius: 170, color: [1.0, 0.55, 0.12] },
    },
  },
  carapex: {
    name: 'CARAPEX', title: 'The Hive Engine', asset: 'carapex', height: 40, cost: 7000, color: '#c6ff3a',
    blurb: 'A six-legged siege insect with sickle mandibles. Its swollen abdomen arches over its back to lob bile bombs across the city.',
    base: { hp: 1300, armor: 0.38, regen: 5, energy: 100, energyRegen: 7, melee: 300, heavy: 420, stomp: 300, special: 820, speed: 0.95, scale: 1.65 },
    moves: {
      attack1: { name: 'Mandible Snap', bone: 'head', radius: 10, reach: 14, window: [0.34, 0.56] },
      attack2: { name: 'Leg Spear', bone: 'foot1R', radius: 8, reach: 0, window: [0.38, 0.62] },
      heavy: { name: 'Scythe Fall', bones: ['foot1L', 'foot1R'], radius: 40, window: [0.93, 1.1], aoe: true },
      stomp: { name: 'Hive Quake', foot: 'foot2L', radius: 50, time: 0.8 },
      special: { name: 'Bile Mortar', kind: 'mortar', cost: 10, range: 700, radius: 34, color: [0.7, 1.0, 0.15] },
    },
  },
};

// The kaiju every new profile starts with (the first in the roster).
export const STARTER = Object.keys(KAIJU)[0];

// Kaiju from earlier versions of the game: unlocks and upgrades bought for them are refunded.
export const LEGACY = { gorvax: 0, kragmaw: 1800, thornback: 3200, scyllax: 4800 };

// Upgrade tracks shared by every kaiju. value(level) gives the multiplier/addend.
export const UPGRADES = [
  { id: 'vitality', name: 'Vitality', desc: 'Maximum health', max: 5, cost: [300, 650, 1100, 1800, 2800], stat: 'hp', mul: 0.16 },
  { id: 'hide', name: 'Armoured Hide', desc: 'Damage reduction', max: 5, cost: [350, 700, 1200, 1900, 2900], stat: 'armor', add: 0.06 },
  { id: 'might', name: 'Might', desc: 'Melee, heavy and stomp damage', max: 5, cost: [350, 750, 1250, 2000, 3000], stat: 'might', mul: 0.15 },
  { id: 'metabolism', name: 'Metabolism', desc: 'Health and energy regeneration', max: 4, cost: [300, 700, 1300, 2200], stat: 'regen', mul: 0.3 },
  { id: 'stride', name: 'Stride', desc: 'Movement speed', max: 4, cost: [300, 650, 1150, 1900], stat: 'speed', mul: 0.07 },
  { id: 'growth', name: 'Growth', desc: 'Size: reach, health and damage. A bigger target, too.', max: 4, cost: [800, 1600, 2800, 4400], stat: 'scale', mul: 0.08 },
  { id: 'power', name: 'Signature Power', desc: 'Special ability strength and efficiency', max: 5, cost: [400, 850, 1400, 2200, 3300], stat: 'special', mul: 0.2 },
];

// Mutation strains. Any kaiju can be rewritten into any of them in the Mutation Lab: a strain
// recolours the hide and its glow, grows crystals, spikes or sacs out of the body, wraps it in an
// aura, shifts its stats and gives its blows an element. 'prime' is the creature as it came.
//   tint: two hide colours mixed in patches; mix: how far the hide moves to them
//   glow: replaces the baked glow colour; vein/veinAmt: a glowing seam network; rim: edge light
//   surf: [roughness, metalness, amount]; growth: what erupts from the body (len is a fraction of
//   the body height, glow scales its emissive); aura: particles
export const FORMS = {
  prime: { name: 'Prime', desc: 'The strain as it came out of the trench.', cost: 0, perks: ['No changes'] },
  infernal: {
    name: 'Infernal', cost: 1500, swatch: ['#2a1410', '#ff6a1f'],
    desc: 'Magma runs through cracks in a charred hide and obsidian crystals erupt along the spine.',
    tint: [[0.04, 0.03, 0.028], [0.26, 0.08, 0.035]], mix: 0.9, detail: 0.7,
    glow: [1.0, 0.36, 0.06], vein: [1.0, 0.3, 0.04], veinAmt: 1.0, veinScale: 0.17, rim: [1.0, 0.32, 0.06], rimAmt: 0.12,
    growth: { kind: 'crystal', n: 22, len: [0.07, 0.15], color: [0.035, 0.028, 0.03], emit: [1.0, 0.3, 0.04], glow: 0.5, rough: 0.18, metal: 0.2, where: 'dorsal' },
    aura: 'embers', element: 'fire',
    mul: { melee: 1.2, heavy: 1.2, stomp: 1.1 },
    perks: ['Blows set buildings ablaze', '+20% melee and heavy damage'],
  },
  glacial: {
    name: 'Glacial', cost: 1800, swatch: ['#c9dceb', '#7fd8ff'],
    desc: 'Frost-white plates and ice spires. Its blows flash-freeze tanks and ice the rotors of gunships.',
    tint: [[0.5, 0.6, 0.7], [0.82, 0.9, 0.97]], mix: 0.78, detail: 0.6, surf: [0.22, 0.0, 0.55],
    glow: [0.55, 0.9, 1.0], vein: [0.45, 0.85, 1.0], veinAmt: 0.3, veinScale: 0.13, veinWarp: 0.2, rim: [0.7, 0.9, 1.0], rimAmt: 0.3,
    growth: { kind: 'ice', n: 26, len: [0.07, 0.15], color: [0.55, 0.74, 0.9], emit: [0.4, 0.8, 1.0], glow: 0.22, rough: 0.06, metal: 0.0, where: 'dorsal' },
    aura: 'frost', element: 'ice',
    mul: { hp: 1.25, speed: 0.92 }, add: { armor: 0.08 },
    perks: ['Blows freeze military units', '+25% health, +8% armour', '-8% speed'],
  },
  venom: {
    name: 'Venom', cost: 1500, swatch: ['#2e4a12', '#8cff2a'],
    desc: 'A blistered, toxic hide studded with glowing sacs. Wounds close fast and every blow leaves acid behind.',
    tint: [[0.1, 0.17, 0.04], [0.24, 0.08, 0.26]], mix: 0.8, detail: 0.75,
    glow: [0.55, 1.0, 0.12], vein: [0.45, 1.0, 0.1], veinAmt: 0.7, veinScale: 0.15, veinWarp: 1.1, rim: [0.4, 1.0, 0.2], rimAmt: 0.1,
    growth: { kind: 'pustule', n: 40, len: [0.014, 0.032], color: [0.16, 0.26, 0.05], emit: [0.5, 1.0, 0.1], glow: 0.35, rough: 0.15, metal: 0.0, where: 'flank' },
    aura: 'drip', element: 'acid',
    mul: { regen: 1.8, special: 1.2 },
    perks: ['Blows leave corroding acid', '+80% regeneration', '+20% signature power'],
  },
  titan: {
    name: 'Titan', cost: 2600, swatch: ['#3a2c1c', '#ffc35a'],
    desc: 'Bronze-dark armour, a crown of bone spikes and fifteen percent more of everything.',
    tint: [[0.13, 0.1, 0.075], [0.4, 0.28, 0.13]], mix: 0.72, detail: 0.65, surf: [0.38, 0.55, 0.6],
    glow: [1.0, 0.72, 0.26], vein: [1.0, 0.68, 0.22], veinAmt: 0.45, veinScale: 0.12, veinWarp: 0.15, rim: [1.0, 0.75, 0.35], rimAmt: 0.06,
    growth: { kind: 'spike', n: 24, len: [0.08, 0.17], color: [0.6, 0.54, 0.44], emit: [0, 0, 0], rough: 0.55, metal: 0.0, where: 'dorsal' },
    aura: 'motes', element: 'quake',
    mul: { scale: 1.15, hp: 1.2, melee: 1.1, heavy: 1.1, speed: 0.9 },
    perks: ['Slams send out a second shockwave', '15% bigger, +20% health', '-10% speed'],
  },
  void: {
    name: 'Void', cost: 3000, swatch: ['#0c0614', '#a45cff'],
    desc: 'A body like a hole in the night, edged in violet, trailing shards that should not exist.',
    tint: [[0.022, 0.016, 0.035], [0.1, 0.045, 0.17]], mix: 0.9, detail: 0.6,
    glow: [0.65, 0.35, 1.0], vein: [0.55, 0.3, 1.0], veinAmt: 0.8, veinScale: 0.2, veinWarp: 0.6, rim: [0.6, 0.32, 1.0], rimAmt: 0.42,
    growth: { kind: 'shard', n: 20, len: [0.08, 0.16], color: [0.04, 0.025, 0.07], emit: [0.6, 0.3, 1.0], glow: 0.4, rough: 0.12, metal: 0.35, where: 'dorsal' },
    aura: 'wisps', element: 'void',
    mul: { speed: 1.12, energyRegen: 1.35, specialCost: 0.8 },
    perks: ['Blows tear rifts that strike again', '+12% speed, +35% energy regeneration', 'Signature power costs 20% less'],
  },
};

// Genes: traits bought once and slotted into any kaiju (GENE_SLOTS each).
// mul/add change stats; the rest are behaviours the play session checks by id.
export const GENE_SLOTS = 3;
export const GENES = {
  thorns: { name: 'Barbed Hide', cost: 900, desc: 'Walking through buildings shreds them twice as fast, and tanks in your path are crushed.', add: { armor: 0.04 } },
  regen: { name: 'Hyper-Regeneration', cost: 1100, desc: 'Double regeneration. Every building you level heals 2.5% health.', mul: { regen: 2 } },
  adrenal: { name: 'Adrenal Gland', cost: 1000, desc: 'The surge meter fills 50% faster and a surge lasts 6 seconds longer.' },
  seismic: { name: 'Seismic Tread', cost: 800, desc: 'Footsteps hit three times as hard over a wider area. Stomps reach 25% further.' },
  giant: { name: 'Gigantism', cost: 1600, desc: '10% bigger: more reach, health and damage.', mul: { scale: 1.1 } },
  lungs: { name: 'Reservoir Lungs', cost: 900, desc: '+40% energy and +20% energy regeneration.', mul: { energy: 1.4, energyRegen: 1.2 } },
  volatile: { name: 'Volatile Blood', cost: 1300, desc: 'Damage you take builds pressure. Past a tenth of your health, it vents in a blast.' },
  echo: { name: 'Echo Chamber', cost: 1200, desc: 'Your roar becomes a shockwave that cracks buildings and silences the guns for 8 s.' },
  frenzy: { name: 'Feeding Frenzy', cost: 1000, desc: 'Each military kill restores 3% health and 8 energy.' },
};

// Mutation Surge: fill the meter by destroying things, then transform for a while.
export const SURGE = {
  fill: 6e9,          // dollars of damage for a full meter
  perKill: 0.04, perRoar: 0.05,
  duration: 18,
  mul: { melee: 1.4, heavy: 1.4, stomp: 1.4, special: 1.3, speed: 1.1, regen: 3 },
  armor: 0.15, scale: 1.15,
};

// Rampage chain: damage dealt without a pause of more than `window` seconds adds up; the running
// total earns a rank.
export const CHAIN = {
  window: 3,
  ranks: [[0.5e9, 'DESTRUCTIVE'], [2e9, 'DEVASTATING'], [6e9, 'CATACLYSMIC'], [15e9, 'APOCALYPTIC'], [40e9, 'EXTINCTION EVENT']],
};

// Rival kaiju. kvk scales any blow one kaiju lands on another (city-levelling numbers would end a
// fight in two swings). A rival's health is set so its effective health (health over what its
// armour lets through) is ehp, whatever the species, and grows by tierGrow per tier.
export const RIVAL = { ehp: 4200, tierGrow: 0.35, kvk: 0.35, enrage: 0.35, attackGap: [1.5, 2.9], specialGap: 7, bounty: 600 };

export function kaijuStats(id, levels = {}, mut = null) {
  const b = KAIJU[id].base;
  const lv = (k) => levels[k] || 0;
  // mutations change size first, so health and damage scale with the extra mass like Growth does
  const mods = mutationMods(mut);
  const scale = b.scale * (1 + 0.08 * lv('growth')) * (mods.mul.scale || 1);
  const grow = scale / b.scale;
  // damage scales with how much mass is behind each blow
  const s = {
    hp: b.hp * (1 + 0.16 * lv('vitality')) * (0.75 + 0.25 * grow * grow),
    armor: Math.min(0.75, b.armor + 0.06 * lv('hide')),
    regen: b.regen * (1 + 0.3 * lv('metabolism')),
    energyRegen: b.energyRegen * (1 + 0.3 * lv('metabolism')) * (1 + 0.1 * lv('power')),
    energy: b.energy,
    melee: b.melee * (1 + 0.15 * lv('might')) * grow,
    heavy: b.heavy * (1 + 0.15 * lv('might')) * grow,
    stomp: b.stomp * (1 + 0.15 * lv('might')) * grow,
    special: b.special * (1 + 0.2 * lv('power')),
    specialCost: 1 - 0.06 * lv('power'),
    speed: b.speed * (1 + 0.07 * lv('stride')),
    scale,
  };
  for (const [k, m] of Object.entries(mods.mul)) if (k !== 'scale' && k in s) s[k] *= m;
  for (const [k, a] of Object.entries(mods.add)) if (k in s) s[k] += a;
  s.armor = Math.min(0.8, s.armor);
  return s;
}

// The combined stat changes of a kaiju's strain and slotted genes.
export function mutationMods(mut) {
  const out = { mul: {}, add: {} };
  if (!mut) return out;
  const parts = [FORMS[mut.form], ...(mut.genes || []).map((g) => GENES[g])].filter(Boolean);
  for (const p of parts) {
    for (const [k, m] of Object.entries(p.mul || {})) out.mul[k] = (out.mul[k] || 1) * m;
    for (const [k, a] of Object.entries(p.add || {})) out.add[k] = (out.add[k] || 0) + a;
  }
  return out;
}

export const MISSIONS = [
  {
    id: 'landfall', name: 'Landfall', city: 'harbor', time: 'golden',
    brief: 'Come ashore at Harbor City as the sun goes down. Show them what the trench has been hiding.',
    goals: [{ kind: 'damage', value: 40e9, label: 'Cause $40B in damage' }], military: 1, reward: 900,
  },
  {
    id: 'blackout', name: 'Blackout', city: 'harbor', time: 'night', requires: 'landfall',
    brief: 'Night over the harbour. Topple the Harbor City broadcast tower and plunge the city into darkness.',
    goals: [{ kind: 'landmark', value: 1, label: 'Topple the broadcast tower' }, { kind: 'damage', value: 60e9, label: 'Cause $60B in damage' }], military: 2, reward: 1400,
  },
  {
    id: 'clash', name: 'Clash', city: 'metro', time: 'night', requires: 'landfall',
    brief: 'Something else has come ashore in Metro Bay, and it wants the city for itself. Kill it.',
    goals: [{ kind: 'rival', value: 1, label: 'Defeat the rival kaiju' }], military: 1, reward: 1800, rival: { at: 12, tier: 1 },
  },
  {
    id: 'skyline', name: 'Skyline', city: 'metro', time: 'dusk', requires: 'blackout',
    brief: 'Metro Bay has the tallest skyline on the coast. Bring 20 of its towers down.',
    goals: [{ kind: 'towers', value: 20, label: 'Collapse 20 skyscrapers' }], military: 3, reward: 2200,
  },
  {
    id: 'stormfront', name: 'Storm Front', city: 'capital', time: 'storm', requires: 'skyline',
    brief: 'The capital is ready for you: armour on every avenue and jets overhead. Survive the storm and break their will.',
    goals: [{ kind: 'survive', value: 300, label: 'Survive for 5 minutes' }, { kind: 'damage', value: 120e9, label: 'Cause $120B in damage' }], military: 4, reward: 3200,
  },
  {
    id: 'apex', name: 'Apex', city: 'metro', time: 'day', requires: 'stormfront',
    brief: 'Broad daylight, full military response, and a rival titan that wants the prize. Level 35% of Metro Bay.',
    goals: [{ kind: 'percent', value: 0.35, label: 'Destroy 35% of the city' }], military: 5, reward: 5000, rival: { at: 40, tier: 3 },
  },
  {
    id: 'rampage', name: 'Free Rampage', city: 'harbor', time: 'golden', sandbox: true,
    brief: 'No objective. Any city, any hour. The military escalates and rival kaiju come for you until you leave or fall.',
    goals: [], military: 3, reward: 0, rival: { at: 100, tier: 1, every: 140 },
  },
];

export const CITIES = { harbor: 'Harbor City', metro: 'Metro Bay', capital: 'Capital District' };
export const TIMES = { dawn: 'Dawn', day: 'Midday', golden: 'Golden Hour', dusk: 'Dusk', night: 'Night', storm: 'Storm' };

// Military escalation tiers by threat level (1..5 stars).
export const MILITARY = {
  tanks: [0, 3, 6, 9, 12, 16],
  helis: [0, 2, 3, 5, 7, 9],
  jets: [0, 0, 1, 2, 3, 4],
  artillery: [0, 0, 0, 2, 3, 4],
  tankDamage: 6, heliDamage: 4, jetDamage: 22, artilleryDamage: 14,
  threatPerBillion: 0.09,
};
