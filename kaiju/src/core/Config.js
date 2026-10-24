// Game data: the kaiju roster, upgrade tracks, missions and military tiers.
// Every tunable lives here so balancing never touches logic.
// Move windows are in seconds of clip time (the Blender anim functions' t).

export const KAIJU = {
  gorvax: {
    name: 'GORVAX', title: 'The Thermal Apex', asset: 'gorvax', height: 58, unlock: 0, color: '#5fd0ff',
    blurb: 'A 93-metre saurian from the abyssal trench. Bark-black hide, crystalline dorsal plates and a breath that cuts steel.',
    base: { hp: 1100, armor: 0.25, regen: 4, energy: 100, energyRegen: 5, melee: 300, heavy: 380, stomp: 240, special: 950, speed: 0.85, scale: 1.6 },
    moves: {
      attack1: { name: 'Raking Claw', bone: 'handR', radius: 9, reach: 4, window: [0.36, 0.66] },
      attack2: { name: 'Crushing Bite', bone: 'jaw', radius: 9, reach: 6, window: [0.4, 0.6] },
      heavy: { name: 'Tail Sweep', bones: ['tail3', 'tail4', 'tail5', 'tail6', 'tail7'], radius: 7.5, window: [0.55, 1.2] },
      stomp: { name: 'Quake Stomp', foot: 'toeR', radius: 46, time: 0.85 },
      special: { name: 'Thermal Breath', kind: 'beam', cost: 22, range: 900, radius: 7, color: [0.45, 0.85, 1.0] },
    },
  },
  kragmaw: {
    name: 'KRAGMAW', title: 'The Magma Primate', asset: 'kragmaw', height: 46, unlock: 1, cost: 1800, color: '#ff7a33',
    blurb: 'A volcanic megaprimate with basalt skin and magma in its veins. Fast, brutal and fond of throwing things.',
    base: { hp: 950, armor: 0.18, regen: 5, energy: 100, energyRegen: 7, melee: 360, heavy: 430, stomp: 300, special: 900, speed: 0.95, scale: 1.6 },
    moves: {
      attack1: { name: 'Haymaker', bone: 'handR', radius: 9, reach: 3, window: [0.3, 0.56] },
      attack2: { name: 'Hammer Fist', bone: 'handL', radius: 10, reach: 3, window: [0.36, 0.62] },
      heavy: { name: 'Ground Slam', bones: ['handL', 'handR'], radius: 40, window: [0.95, 1.1], aoe: true },
      stomp: { name: 'Seismic Leap', kind: 'leap', radius: 50, time: 1.0 },
      special: { name: 'Tectonic Hurl', kind: 'throw', cost: 26, range: 700, radius: 34, color: [1.0, 0.45, 0.12] },
    },
  },
  thornback: {
    name: 'THORNBACK', title: 'The Living Fortress', asset: 'thornback', height: 40, quadruped: true, menuGlow: 0.2, unlock: 2, cost: 3200, color: '#c9b37a',
    blurb: 'An armoured quadruped the size of a stadium. Slow to start, impossible to stop once it charges.',
    base: { hp: 1700, armor: 0.45, regen: 6, energy: 100, energyRegen: 6, melee: 320, heavy: 480, stomp: 300, special: 700, speed: 0.8, scale: 1.6 },
    moves: {
      attack1: { name: 'Horn Gore', bone: 'head', radius: 11, reach: 10, window: [0.38, 0.62] },
      attack2: { name: 'Shield Bash', bone: 'head', radius: 13, reach: 6, window: [0.4, 0.6] },
      heavy: { name: 'Tail Mace', bones: ['tail4', 'tail5', 'tail6'], radius: 11, window: [0.55, 1.15] },
      stomp: { name: 'Earthshaker', foot: 'handR', radius: 56, time: 0.9 },
      special: { name: 'Juggernaut Charge', kind: 'charge', cost: 30, duration: 6, color: [1.0, 0.85, 0.5] },
    },
  },
  scyllax: {
    name: 'SCYLLAX', title: 'The Abyssal Reaver', asset: 'scyllax', height: 34, unlock: 3, cost: 4800, color: '#7dff9a',
    blurb: 'An eight-legged crustacean reaver. Pincers that shear girders and acid that melts what they miss.',
    base: { hp: 900, armor: 0.32, regen: 4, energy: 100, energyRegen: 8, melee: 280, heavy: 400, stomp: 260, special: 520, speed: 1.05, scale: 1.7 },
    moves: {
      attack1: { name: 'Pincer Snap', bone: 'clawR', radius: 9, reach: 6, window: [0.3, 0.52] },
      attack2: { name: 'Twin Shear', bone: 'clawL', radius: 10, reach: 6, window: [0.32, 0.55] },
      heavy: { name: 'Stinger Lance', bones: ['tail5', 'tail6'], radius: 8, window: [0.5, 0.75] },
      stomp: { name: 'Pounce', kind: 'leap', radius: 42, time: 1.0 },
      special: { name: 'Acid Torrent', kind: 'spray', cost: 18, range: 260, radius: 30, color: [0.5, 1.0, 0.35] },
    },
  },
};

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
