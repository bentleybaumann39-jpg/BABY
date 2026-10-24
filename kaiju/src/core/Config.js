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

export function kaijuStats(id, levels = {}) {
  const b = KAIJU[id].base;
  const lv = (k) => levels[k] || 0;
  const scale = b.scale * (1 + 0.08 * lv('growth'));
  const grow = scale / b.scale;
  // damage scales with how much mass is behind each blow
  return {
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
    brief: 'Broad daylight, full military response. Level 35% of Metro Bay.',
    goals: [{ kind: 'percent', value: 0.35, label: 'Destroy 35% of the city' }], military: 5, reward: 5000,
  },
  {
    id: 'rampage', name: 'Free Rampage', city: 'harbor', time: 'golden', sandbox: true,
    brief: 'No objective. Any city, any hour. The military escalates until you leave or fall.',
    goals: [], military: 3, reward: 0,
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
