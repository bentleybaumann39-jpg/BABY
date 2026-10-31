// =====================================================================
//  DATA — rarities, mutations, passives, ultimates, weapons, roster
// =====================================================================
const RARITIES = [
  { n: 'COMMON', c: '#B8C4D6', min: 1 },
  { n: 'UNCOMMON', c: '#4CFF7A', min: 10 },
  { n: 'RARE', c: '#3DA5FF', min: 100 },
  { n: 'EPIC', c: '#B04DFF', min: 1e3 },
  { n: 'LEGENDARY', c: '#FFB020', min: 1e4 },
  { n: 'MYTHIC', c: '#FF3D7A', min: 1e5 },
  { n: 'DIVINE', c: '#FFF27A', min: 1e6 },
  { n: 'CELESTIAL', c: '#7AF8FF', min: 1e7 },
  { n: 'TRANSCENDENT', c: '#FF7AF2', min: 1e8 },
  { n: 'ETERNAL', c: '#FF5A1A', min: 1e9 },
  { n: 'PRIMORDIAL', c: '#9DFF00', min: 1e10 },
  { n: 'SECRET', c: '#FFFFFF', min: 1e11 }
];
const tierOf = odds => { let t = 0; for (let i = 0; i < RARITIES.length; i++) if (odds >= RARITIES[i].min) t = i; return t; };
const LEVEL_BY_TIER = [1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 5];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

const MUTATIONS = {
  '': { n: '', odds: 1, mult: 1, c: '#fff' },
  shiny: { n: 'SHINY', odds: 20, mult: 1.25, c: '#BFF8FF' },
  golden: { n: 'GOLDEN', odds: 200, mult: 1.6, c: '#FFD700' },
  void: { n: 'VOID', odds: 2000, mult: 2.2, c: '#C07CFF' },
  rainbow: { n: 'RAINBOW', odds: 20000, mult: 3.5, c: '#FF7AF2' }
};
const MUT_ORDER = ['rainbow', 'void', 'golden', 'shiny'];

// ---- passive powers (L = level 1..5, rarer characters get higher levels) ----
const PASSIVES = {
  burn: { n: 'Inferno Rounds', i: '🔥', c: '#FF7A1A', d: L => `Hits set enemies ablaze for ${25 * L}% of the hit's damage every second (3s).` },
  frost: { n: 'Frost Rounds', i: '❄️', c: '#7AE0FF', d: L => `Hits chill enemies by ${15 + 8 * L}%. Fully chilled enemies freeze solid.` },
  poison: { n: 'Venom Rounds', i: '☠️', c: '#7CFF4D', d: L => `Hits stack poison (max 8). Each stack deals ${12 * L}% of hit damage per second.` },
  chain: { n: 'Arc Rounds', i: '⚡', c: '#B57CFF', d: L => `${20 + 10 * L}% chance to arc lightning to ${1 + Math.ceil(L / 2)} more enemies.` },
  pierce: { n: 'Piercing Rounds', i: '🗡️', c: '#E0E0FF', d: L => `Bullets pass through ${L} extra enem${L > 1 ? 'ies' : 'y'}.` },
  ricochet: { n: 'Ricochet', i: '↯', c: '#FFD27A', d: L => `Bullets bounce to ${L} more nearby enem${L > 1 ? 'ies' : 'y'}.` },
  homing: { n: 'Seeker Rounds', i: '🎯', c: '#FF7AF2', d: L => `Bullets curve toward enemies (${['weak', 'light', 'strong', 'fierce', 'perfect'][L - 1]} tracking).` },
  explosive: { n: 'Blast Rounds', i: '💥', c: '#FF9F1A', d: L => `Hits explode for ${30 + 10 * L}% splash damage (${(1.6 + 0.5 * L).toFixed(1)}m).` },
  split: { n: 'Shatter Rounds', i: '✴️', c: '#7AF8FF', d: L => `On hit, bullets shatter into ${1 + L} shards.` },
  vamp: { n: 'Vampiric', i: '🩸', c: '#FF1A4A', d: L => `Heal ${(1.5 * L).toFixed(1)}% of the damage you deal.` },
  crit: { n: 'Deadeye', i: '✦', c: '#FFE600', d: L => `${10 + 6 * L}% crit chance. Crits deal ${(2.2 + 0.3 * L).toFixed(1)}x damage.` },
  execute: { n: "Reaper's Mark", i: '💀', c: '#D8D8D8', d: L => `Normal enemies below ${8 + 4 * L}% HP die instantly.` },
  knock: { n: 'Force Rounds', i: '👊', c: '#FFFFFF', d: L => `Hits blast enemies back and stagger them.` },
  thorns: { n: 'Thorns', i: '🌵', c: '#7CFF4D', d: L => `When hurt, blast nearby enemies for ${80 * L}% weapon damage.` },
  regen: { n: 'Regeneration', i: '💚', c: '#4CFF7A', d: L => `Regenerate ${(0.8 * L).toFixed(1)}% max HP every second.` },
  shield: { n: 'Barrier', i: '🛡️', c: '#5AB4FF', d: L => `A shield worth ${20 * L}% max HP that recharges when you avoid damage.` },
  drone: { n: 'Drone Buddy', i: '🛸', c: '#00F0FF', d: L => `${Math.min(3, Math.ceil(L / 1.6))} drone${L > 1 ? 's' : ''} orbit you and shoot enemies.` },
  aura: { n: 'Flame Aura', i: '♨️', c: '#FF5A1A', d: L => `Burn every enemy within ${3 + L}m of you.` },
  swift: { n: 'Swiftness', i: '💨', c: '#AAFFEE', d: L => `+${12 * L}% move speed.` },
  sky: { n: 'Sky Step', i: '🪽', c: '#E0F4FF', d: L => `+${Math.ceil(L / 2)} air jump${L > 2 ? 's' : ''} and ${10 * L}% higher jumps.` },
  giant: { n: 'Colossus', i: '🗿', c: '#C8A27A', d: L => `Bigger body: +${25 * L}% max HP and +${8 * L}% damage, a little slower.` },
  multishot: { n: 'Twin Fire', i: '🔱', c: '#FFAA00', d: L => `Every shot fires ${L >= 3 ? 2 : 1} extra bullet${L >= 3 ? 's' : ''}.` },
  rapid: { n: 'Overclock', i: '⏩', c: '#00FF99', d: L => `+${12 * L}% fire rate and faster reloads.` },
  midas: { n: 'Midas Touch', i: '🪙', c: '#FFD700', d: L => `+${30 * L}% coins from everything.` },
  lucky: { n: 'Fortune', i: '🍀', c: '#4CFF7A', d: L => `+${(0.25 * L).toFixed(2)}x roll luck while equipped.` },
  necro: { n: 'Necromancy', i: '🦴', c: '#B0FFB0', d: L => `Raise a skeleton ally every ${10 - L}s (max ${1 + L}).` },
  meteor: { n: 'Starfall', i: '☄️', c: '#FF8A3D', d: L => `A meteor smashes a nearby enemy every ${(6 - 0.8 * L).toFixed(1)}s.` },
  thunder: { n: 'Stormcaller', i: '🌩️', c: '#9A7CFF', d: L => `Lightning strikes ${L} nearby enem${L > 1 ? 'ies' : 'y'} every 3s.` },
  phase: { n: 'Phantom', i: '👻', c: '#C0C0FF', d: L => `${7 * L}% chance to dodge any damage.` },
  rage: { n: 'Bloodrage', i: '😡', c: '#FF2A2A', d: L => `Up to +${25 * L}% damage as your HP drops.` },
  battery: { n: 'Soul Battery', i: '🔋', c: '#FF00AA', d: L => `+${25 * L}% ultimate charge rate.` },
  undying: { n: 'Undying', i: '🔆', c: '#FFE27A', d: L => `Once per realm, revive with ${30 + 10 * L}% HP in a burst of fire.` },
  magnet: { n: 'Magnetism', i: '🧲', c: '#FF5AA0', d: L => `Pull coins and orbs from ${6 + 4 * L}m away. +${10 * L}% coins.` },
  frostaura: { n: 'Frost Aura', i: '🌨️', c: '#9AE8FF', d: L => `Enemies within ${4 + L}m are slowed by ${12 * L}%.` },
  echo: { n: 'Echo Bolt', i: '🔮', c: '#D07CFF', d: L => `Every ${Math.max(2, 7 - L)}th shot also fires a piercing soul bolt for 3x damage.` }
};

const ULTS = {
  orb: { n: 'Disintegration Orb', d: 'Hurl a slow orb that shreds everything it passes, then detonates.' },
  beam: { n: 'Void Beam', d: 'Channel a piercing laser wherever you aim for 3 seconds.' },
  nova: { n: 'Soul Nova', d: 'Four shockwave rings explode outward from you.' },
  storm: { n: 'Lightning Storm', d: 'Lightning chains between enemies for 4 seconds.' },
  blackhole: { n: 'Event Horizon', d: 'Throw a black hole that drags enemies in, then collapses.' },
  meteor: { n: 'Meteor Storm', d: 'Meteors rain down where you aim.' },
  zero: { n: 'Absolute Zero', d: 'Freeze every nearby enemy solid. Frozen enemies take +50% damage.' },
  blades: { n: 'Orbital Blades', d: 'Spinning blades orbit you for 8 seconds.' },
  grid: { n: 'Laser Grid', d: 'A spinning grid of lasers slices the battlefield.' },
  guardians: { n: 'Soul Guardians', d: 'Summon 3 spirit knights that fight beside you.' },
  siphon: { n: 'Life Siphon', d: 'Tether nearby enemies and drain their life into yours.' },
  timestop: { n: 'Time Stop', d: 'Freeze time for 4 seconds. Only you can move.' },
  clones: { n: 'Mirror Army', d: 'Four clones of you appear and open fire.' },
  cyclone: { n: 'Cyclone', d: 'Release tornadoes that suck in and shred enemies.' },
  quake: { n: 'Earthshatter', d: 'Rock spikes erupt in a wide cone ahead of you.' },
  breath: { n: 'Dragon Breath', d: 'Breathe a torrent of fire for 3 seconds.' },
  arrows: { n: 'Arrow Rain', d: 'A storm of arrows rains on the area you aim at.' },
  titanblade: { n: 'Titan Blade', d: 'A colossal sword falls from the sky where you aim.' },
  smite: { n: 'Holy Smite', d: 'Pillars of light strike up to 12 enemies.' },
  plague: { n: 'Plague Cloud', d: 'A toxic cloud follows you and melts enemies for 8 seconds.' },
  berserk: { n: 'Berserk', d: '8 seconds of triple fire rate, double damage and extra speed.' },
  missiles: { n: 'Missile Swarm', d: 'Launch 18 homing missiles.' },
  shadowstep: { n: 'Shadow Step', d: 'Blink through up to 8 enemies, slicing each one.' },
  railgun: { n: 'Hyper Railgun', d: 'Fire one colossal piercing beam.' },
  sentries: { n: 'Sentry Deploy', d: 'Drop 3 auto-turrets for 12 seconds.' },
  phoenix: { n: 'Phoenix Ascension', d: 'Heal to full, explode in flames and burn everything nearby.' },
  icespikes: { n: 'Glacial Spikes', d: 'Rings of ice spikes burst outward and freeze enemies.' },
  firewall: { n: 'Inferno Wall', d: 'Raise a roaring wall of fire in front of you.' },
  rift: { n: 'Void Rift', d: 'Tear open a rift. Tentacles lash out at every enemy nearby.' },
  gravity: { n: 'Gravity Crush', d: 'Lift every enemy into the air, then slam them down.' },
  dragon: { n: 'Spirit Dragon', d: 'Summon a soul dragon that hunts and devours enemies.' },
  starfall: { n: 'Galaxy Collapse', d: 'Giant stars crash down all around you.' },
  supernova: { n: 'Supernova', d: 'Charge up, then erase almost everything on screen.' },
  glitch: { n: 'Reality Glitch', d: 'Delete enemies from existence. ERR0R ERR0R ERR0R.' }
};

const WEAPONS = [
  { id: 'ar', n: 'ASSAULT RIFLE', ico: '🔫', dmg: 1, rate: 0.115, spread: 0.014, aim: 0.004, speed: 150, pellets: 1, mag: 30, reload: 1.4, col: 0x00F0FF, size: 0.09, len: 1.8, kick: 0.012 },
  { id: 'shotgun', n: 'SHOTGUN', ico: '💥', dmg: 0.6, rate: 0.72, spread: 0.085, aim: 0.06, speed: 120, pellets: 8, mag: 6, reload: 1.7, col: 0xFFE600, size: 0.07, len: 1.1, kick: 0.06 },
  { id: 'sniper', n: 'SNIPER', ico: '🎯', dmg: 4.4, rate: 0.95, spread: 0.03, aim: 0, speed: 330, pellets: 1, mag: 5, reload: 2.0, col: 0xFF2A6A, size: 0.13, len: 4.5, kick: 0.08, pierce: 2 },
  { id: 'smg', n: 'SMG', ico: '⚡', dmg: 0.55, rate: 0.062, spread: 0.032, aim: 0.018, speed: 140, pellets: 1, mag: 45, reload: 1.15, col: 0x00FF66, size: 0.07, len: 1.3, kick: 0.007 },
  { id: 'rocket', n: 'ROCKET', ico: '🚀', dmg: 5.2, rate: 1.05, spread: 0.006, aim: 0, speed: 58, pellets: 1, mag: 2, reload: 2.1, col: 0xFF6A00, size: 0.28, len: 1.0, kick: 0.09, explode: 4.5 }
];

// ---------------------------------------------------------------------
//  ROSTER — 120 unique characters, each with its own look + power kit.
//  C(name, body, head, accessories, [primary, secondary, glow], passives, ult)
// ---------------------------------------------------------------------
const ROSTER = [];
(function buildRoster() {
  const L = [
    // COMMON
    ['Warrior', 'hero', 'round', ['backpack'], ['#3DD6FF', '#24324F', '#00F0FF'], ['rapid'], 'orb'],
    ['Scrap Bot', 'hero', 'tv', ['antenna'], ['#8E9AAB', '#3A4250', '#FFAA00'], ['knock'], 'sentries'],
    ['Slime Pal', 'blob', 'none', [], ['#4CFF7A', '#1F7A3A', '#B6FF9A'], ['poison'], 'nova'],
    ['Pumpkin Jack', 'hero', 'pumpkin', ['scarf'], ['#4A3424', '#FF7A00', '#FFAA00'], ['burn'], 'firewall'],
    ['Snowy', 'snow', 'none', ['tophat', 'scarf'], ['#F2F8FF', '#C0392B', '#7AE0FF'], ['frost'], 'icespikes'],
    ['Shroom Kid', 'tiny', 'mushroom', [], ['#F5E6C8', '#E8343A', '#FFE6A0'], ['regen'], 'plague'],
    ['Rusty Knight', 'heavy', 'knight', ['shield', 'plume'], ['#9C7A5A', '#4A3A2A', '#FFC870'], ['shield'], 'quake'],
    ['Bat Kid', 'slim', 'round', ['batwings'], ['#3A2A4A', '#7A3AFF', '#FF4A6A'], ['vamp'], 'blades'],
    // UNCOMMON
    ['Frog Ninja', 'slim', 'frog', ['headband', 'scarf'], ['#4CC94C', '#20304A', '#B6FF00'], ['swift'], 'shadowstep'],
    ['Cactus Cowboy', 'hero', 'round', ['cowboyhat', 'spikes'], ['#3FA34D', '#8B5A2B', '#FFE27A'], ['thorns'], 'arrows'],
    ['Spark Plug', 'tiny', 'tv', ['antenna', 'sparks'], ['#FFD000', '#202020', '#FFF27A'], ['chain'], 'beam'],
    ['Bubble Diver', 'hero', 'diver', ['backpack'], ['#2E86DE', '#F5B041', '#7AF8FF'], ['split'], 'cyclone'],
    ['Pirate Pete', 'hero', 'round', ['piratehat', 'eyepatch', 'beard'], ['#E8B98A', '#8B1A1A', '#FFD700'], ['midas'], 'missiles'],
    ['Ghosty', 'float', 'round', [], ['#E8F0FF', '#9AAABB', '#7AF8FF'], ['phase'], 'siphon'],
    ['Fox Scout', 'slim', 'fox', ['fluffytail', 'scarf'], ['#FF8A3D', '#FFFFFF', '#FFC870'], ['crit'], 'clones'],
    ['Lil Viking', 'heavy', 'round', ['vikinghelm', 'beard', 'shield'], ['#E0B08A', '#6A3A1A', '#FFE27A'], ['rage'], 'berserk'],
    ['Candy Elf', 'tiny', 'round', ['elfhat'], ['#2ECC71', '#E74C3C', '#FFFFFF'], ['multishot'], 'guardians'],
    ['Owl Sage', 'robe', 'owl', ['book'], ['#8B6B4A', '#3A2A1A', '#FFE27A'], ['echo'], 'beam'],
    // RARE
    ['Cyber Ninja', 'slim', 'ninja', ['scarf', 'sword'], ['#1A1A2E', '#FF0055', '#FF0055'], ['execute', 'crit'], 'blades'],
    ['Plasma Mage', 'robe', 'round', ['wizardhat', 'orbs'], ['#6A00FF', '#1A0A3A', '#C07CFF'], ['explosive'], 'blackhole'],
    ['Frost Specter', 'float', 'skull', ['spikes'], ['#BFEFFF', '#3A6A9A', '#7AE0FF'], ['frostaura'], 'icespikes'],
    ['Magma Golem', 'rock', 'none', ['flames'], ['#3A2A2A', '#FF4A00', '#FF7A00'], ['aura'], 'meteor'],
    ['Astro Cat', 'hero', 'cat', ['jetpack', 'antenna'], ['#F0F0F0', '#FF8AD8', '#7AF8FF'], ['sky'], 'gravity'],
    ['Shark Bite', 'heavy', 'shark', ['fins'], ['#5A7A9A', '#E8E8F0', '#00F0FF'], ['ricochet'], 'berserk'],
    ['Witch Hazel', 'robe', 'round', ['witchhat', 'broom'], ['#3A1A4A', '#7CFF4D', '#7CFF4D'], ['poison', 'meteor'], 'rift'],
    ['Samurai Ronin', 'heavy', 'samurai', ['sword', 'shoulderpads'], ['#2A2A3A', '#C0392B', '#FF4A4A'], ['crit', 'knock'], 'titanblade'],
    ['Jolly Santa', 'heavy', 'round', ['santahat', 'beard', 'backpack'], ['#F0C8A0', '#D0202A', '#FFFFFF'], ['explosive', 'midas'], 'missiles'],
    ['Gear Golem', 'mech', 'box', ['gears'], ['#C8A050', '#5A4020', '#FFAA00'], ['rapid', 'drone'], 'sentries'],
    // EPIC
    ['Neon Ronin', 'slim', 'cyber', ['sword', 'scarf'], ['#FF00AA', '#101020', '#00F0FF'], ['crit', 'swift'], 'shadowstep'],
    ['Night Stalker', 'heavy', 'wolf', ['tail', 'spikes'], ['#5A4A3A', '#2A1A10', '#FFCC00'], ['rage', 'vamp'], 'berserk'],
    ['Storm Caller', 'robe', 'round', ['rings', 'sparks'], ['#FFE27A', '#3A60FF', '#9A7CFF'], ['thunder', 'chain'], 'storm'],
    ['Crystal Sprite', 'crystal', 'crystal', ['orbs'], ['#9AF8FF', '#5A7AFF', '#C0FFFF'], ['split', 'pierce'], 'icespikes'],
    ['Vampire Count', 'slim', 'round', ['cape', 'batwings'], ['#E8D8D8', '#5A0010', '#FF1A4A'], ['vamp', 'phase'], 'siphon'],
    ['Toxic Trooper', 'hero', 'box', ['mask', 'backpack'], ['#5A6A3A', '#2A3A1A', '#7CFF4D'], ['poison', 'aura'], 'plague'],
    ['Inferno Imp', 'tiny', 'round', ['horns', 'tail', 'flames'], ['#FF3A1A', '#3A0A0A', '#FFAA00'], ['burn', 'multishot'], 'firewall'],
    ['Robo Rex', 'mech', 'dragon', ['spiketail'], ['#4A6A8A', '#202A3A', '#00FFAA'], ['explosive', 'knock'], 'breath'],
    ['Tide Caller', 'hero', 'octo', ['trident'], ['#3AC8C8', '#1A4A6A', '#7AF8FF'], ['frost', 'split'], 'cyclone'],
    ['Neon Paladin', 'heavy', 'knight', ['energywings', 'shield'], ['#7AF8FF', '#2A3A5A', '#00F0FF'], ['shield', 'thorns'], 'smite'],
    // LEGENDARY
    ['Shadow Ninja', 'slim', 'ninja', ['cape', 'sword'], ['#151020', '#6A00FF', '#B04DFF'], ['execute', 'phase'], 'shadowstep'],
    ['Phoenix Rider', 'hero', 'bird', ['wings', 'flames'], ['#FF6A00', '#FFD000', '#FF4A00'], ['burn', 'undying'], 'phoenix'],
    ['Ice Queen', 'robe', 'round', ['crown', 'cape', 'spikes'], ['#E8FAFF', '#5AB4FF', '#9AE8FF'], ['frost', 'frostaura'], 'zero'],
    ['Giga Titan', 'mech', 'cyber', ['shoulderpads', 'jetpack'], ['#D0D8E0', '#FF3A3A', '#00F0FF'], ['giant', 'drone'], 'railgun'],
    ['Storm Dragon', 'hero', 'dragon', ['wings', 'spiketail'], ['#3A5AFF', '#1A2A5A', '#9A7CFF'], ['chain', 'thunder'], 'breath'],
    ["Pharaoh's Heir", 'robe', 'round', ['crown', 'cape'], ['#FFD000', '#1A3A8A', '#FFE27A'], ['midas', 'meteor'], 'cyclone'],
    ['Bone Lord', 'bone', 'skull', ['crown', 'cape'], ['#E8E0D0', '#3A2A4A', '#7CFF4D'], ['necro', 'execute'], 'guardians'],
    ['Galaxy Kid', 'tiny', 'void', ['stars', 'rings'], ['#1A1040', '#FF7AF2', '#7AF8FF'], ['lucky', 'homing'], 'gravity'],
    ['Grizzly Guardian', 'heavy', 'bear', ['leaves', 'shoulderpads'], ['#6A4A2A', '#2A6A2A', '#B6FF00'], ['regen', 'knock'], 'quake'],
    ['Pixel Hero', 'hero', 'box', ['sword', 'shield'], ['#FF4A4A', '#3A6AFF', '#FFE600'], ['multishot', 'ricochet'], 'clones'],
    // MYTHIC
    ['Void Lord', 'slim', 'void', ['rings', 'cape'], ['#0A0A1A', '#8000FF', '#B04DFF'], ['homing', 'phase'], 'blackhole'],
    ['Solar Paladin', 'heavy', 'knight', ['halo', 'cape', 'shield'], ['#FFF0C0', '#FFB000', '#FFE27A'], ['shield', 'burn', 'regen'], 'smite'],
    ['Kraken Lord', 'robe', 'octo', ['crown', 'trident'], ['#7A2A8A', '#2A0A3A', '#FF5AF0'], ['poison', 'split'], 'rift'],
    ['Cyber Demon', 'heavy', 'cyber', ['horns', 'batwings', 'spiketail'], ['#2A0A0A', '#FF003C', '#FF3A3A'], ['explosive', 'rage', 'burn'], 'railgun'],
    ['Angel of Light', 'robe', 'round', ['wings', 'halo'], ['#FFFFFF', '#FFE27A', '#FFF6C0'], ['regen', 'chain', 'shield'], 'smite'],
    ['Chrono Guardian', 'heavy', 'helm', ['clock', 'cape'], ['#C8B070', '#203A5A', '#7AF8FF'], ['rapid', 'battery'], 'timestop'],
    ['Lava Dragon', 'hero', 'dragon', ['wings', 'flames', 'spiketail'], ['#3A1A10', '#FF4A00', '#FF8A00'], ['burn', 'aura', 'explosive'], 'breath'],
    ['Glacier Titan', 'rock', 'none', ['spikes'], ['#BFE8FF', '#5A8ACC', '#9AE8FF'], ['frost', 'giant', 'thorns'], 'icespikes'],
    ['Neon Overclock', 'mech', 'tv', ['gears', 'sparks'], ['#202030', '#00FF99', '#00FF99'], ['rapid', 'drone', 'chain'], 'sentries'],
    ['Spirit Fox', 'slim', 'fox', ['fluffytail', 'halo'], ['#FFFFFF', '#FF4A8A', '#FF7AF2'], ['homing', 'burn', 'phase'], 'clones'],
    // DIVINE
    ['Seraph', 'robe', 'round', ['sixwings', 'halo2'], ['#FFFFF0', '#FFD700', '#FFF6A0'], ['regen', 'shield', 'thunder'], 'smite'],
    ['Hellfire Overlord', 'heavy', 'skull', ['horns', 'flames', 'cape'], ['#1A0A0A', '#FF2A00', '#FF6A00'], ['burn', 'aura', 'rage'], 'meteor'],
    ['Thunder God', 'heavy', 'round', ['beard', 'vikinghelm', 'sparks'], ['#E0E8FF', '#3A5AFF', '#9A7CFF'], ['thunder', 'chain', 'knock'], 'storm'],
    ['Quantum Knight', 'heavy', 'knight', ['energywings', 'orbs'], ['#101030', '#00F0FF', '#00F0FF'], ['split', 'ricochet', 'pierce'], 'grid'],
    ['Plague Doctor', 'robe', 'bird', ['tophat', 'lantern'], ['#1A1A1A', '#3A3A2A', '#7CFF4D'], ['poison', 'necro'], 'plague'],
    ['Star Wanderer', 'hero', 'astro', ['jetpack', 'stars'], ['#E0E8F0', '#3A3AFF', '#FFE27A'], ['sky', 'homing', 'lucky'], 'starfall'],
    ['Blood Reaper', 'float', 'skull', ['scythe', 'cape'], ['#1A0A0A', '#8A0010', '#FF1A4A'], ['vamp', 'execute', 'rage'], 'siphon'],
    ['Clockwork Colossus', 'mech', 'box', ['gears', 'clock', 'shoulderpads'], ['#B08A40', '#3A2A10', '#FFD000'], ['giant', 'rapid', 'drone'], 'sentries'],
    ['Nature Druid', 'robe', 'round', ['leaves', 'petals', 'ramhorns'], ['#5A8A3A', '#2A4A1A', '#B6FF00'], ['regen', 'thorns', 'poison'], 'cyclone'],
    ['Crystal Warden', 'crystal', 'crystal', ['spikes', 'orbs'], ['#E0FFFF', '#7AB0FF', '#FFFFFF'], ['giant', 'thorns', 'ricochet'], 'titanblade'],
    ['Ghost Blade', 'float', 'cyber', ['sword', 'scarf'], ['#101020', '#FF00FF', '#00FFFF'], ['phase', 'homing', 'echo'], 'railgun'],
    // CELESTIAL
    ['Celestial Dragon', 'hero', 'dragon', ['wings', 'halo', 'spiketail'], ['#F0F6FF', '#7AB0FF', '#7AF8FF'], ['homing', 'chain', 'regen'], 'dragon'],
    ['Moon Priestess', 'robe', 'round', ['planet', 'halo2'], ['#C0C8FF', '#3A3A8A', '#E0E8FF'], ['frost', 'lucky', 'battery'], 'gravity'],
    ['Solar Emperor', 'heavy', 'round', ['crown', 'cape', 'halo'], ['#FFD000', '#FF6A00', '#FFF27A'], ['burn', 'midas', 'shield'], 'phoenix'],
    ['Abyss Walker', 'slim', 'void', ['tentacles', 'rings'], ['#05050F', '#4A00AA', '#8A00FF'], ['phase', 'poison', 'necro'], 'rift'],
    ['Titan of Ages', 'heavy', 'helm', ['shoulderpads', 'cape', 'sword'], ['#8A8A9A', '#3A3A4A', '#FFAA00'], ['giant', 'knock', 'thorns'], 'titanblade'],
    ['Galaxy Mage', 'robe', 'round', ['wizardhat', 'stars', 'orbs'], ['#1A1040', '#7A3AFF', '#FF7AF2'], ['homing', 'explosive', 'battery'], 'blackhole'],
    ['Mirror Knight', 'heavy', 'knight', ['shield', 'energywings'], ['#E8E8F0', '#9AA0AA', '#FFFFFF'], ['ricochet', 'thorns', 'crit'], 'clones'],
    ['Inferno Kitsune', 'slim', 'fox', ['fluffytail', 'flames', 'crown'], ['#FFF0F0', '#FF3A1A', '#FFAA00'], ['burn', 'meteor', 'swift'], 'firewall'],
    ['Cyber Seraph', 'robe', 'cyber', ['sixwings', 'halo'], ['#E0F0FF', '#00A0FF', '#00F0FF'], ['drone', 'pierce', 'shield'], 'grid'],
    ['Toxic Titan', 'rock', 'none', ['spikes', 'flames'], ['#2A3A1A', '#7CFF4D', '#7CFF4D'], ['poison', 'aura', 'giant'], 'plague'],
    // TRANSCENDENT
    ['Time Lord', 'robe', 'round', ['clock', 'halo2', 'cape'], ['#E8D8A0', '#203A5A', '#7AF8FF'], ['rapid', 'battery', 'crit'], 'timestop'],
    ['Dark Sovereign', 'heavy', 'helm', ['crown', 'cape', 'horns'], ['#101010', '#6A00AA', '#B04DFF'], ['rage', 'execute', 'necro'], 'rift'],
    ['Phoenix God', 'hero', 'bird', ['wings', 'halo', 'flames'], ['#FFB000', '#FF3A00', '#FFE600'], ['burn', 'undying', 'regen'], 'phoenix'],
    ['Singularity God', 'float', 'void', ['rings', 'orbs'], ['#000000', '#FFFFFF', '#B04DFF'], ['homing', 'pierce', 'battery'], 'blackhole'],
    ['Storm Emperor', 'heavy', 'round', ['crown', 'sparks', 'cape'], ['#3A3AFF', '#FFE600', '#9A7CFF'], ['thunder', 'chain', 'swift'], 'storm'],
    ['Frost Emperor', 'heavy', 'knight', ['crown', 'spikes', 'cape'], ['#E0F8FF', '#3A8AFF', '#9AE8FF'], ['frost', 'frostaura', 'shield'], 'zero'],
    ['Dragon King', 'heavy', 'dragon', ['crown', 'wings', 'spiketail'], ['#2A0A0A', '#FFD000', '#FF4A00'], ['burn', 'giant', 'explosive'], 'dragon'],
    ['Neon God', 'robe', 'cyber', ['rings', 'energywings'], ['#0A0A1A', '#FF00AA', '#00F0FF'], ['multishot', 'ricochet', 'echo'], 'grid'],
    ['Nightmare', 'float', 'eye', ['tentacles', 'batwings'], ['#1A001A', '#FF003C', '#FF003C'], ['phase', 'poison', 'rage'], 'siphon'],
    ['Angel of Death', 'robe', 'skull', ['sixwings', 'scythe', 'halo'], ['#F0F0F0', '#202020', '#FF1A4A'], ['execute', 'vamp', 'necro'], 'smite'],
    // ETERNAL
    ['Chaos Bringer', 'heavy', 'void', ['horns', 'flames', 'orbs'], ['#1A0010', '#FF00AA', '#FF003C'], ['explosive', 'chain', 'split'], 'meteor'],
    ['Lightbearer', 'robe', 'orb', ['sixwings', 'halo2'], ['#FFFFFF', '#FFF6C0', '#FFFFFF'], ['regen', 'shield', 'homing'], 'smite'],
    ['Starforged Titan', 'mech', 'cyber', ['stars', 'shoulderpads', 'jetpack'], ['#3A3AFF', '#FFE600', '#7AF8FF'], ['giant', 'drone', 'pierce'], 'railgun'],
    ['Abyss Leviathan', 'heavy', 'shark', ['fins', 'tentacles'], ['#0A1A3A', '#00AAFF', '#00F0FF'], ['vamp', 'frost', 'knock'], 'cyclone'],
    ['Crystal Emperor', 'crystal', 'crystal', ['crown', 'orbs', 'spikes'], ['#FF7AF2', '#7AF8FF', '#FFFFFF'], ['split', 'crit', 'ricochet'], 'icespikes'],
    ['Elder Treant', 'rock', 'none', ['leaves', 'petals'], ['#5A3A1A', '#3AAA3A', '#B6FF00'], ['regen', 'thorns', 'necro'], 'quake'],
    ['Cosmic Jester', 'hero', 'round', ['jester', 'stars'], ['#AA00FF', '#FFE600', '#FF00AA'], ['lucky', 'ricochet', 'multishot'], 'clones'],
    ['Blood Moon Vampire', 'slim', 'round', ['cape', 'batwings', 'crown'], ['#E0D0D0', '#8A0010', '#FF003C'], ['vamp', 'phase', 'rage'], 'siphon'],
    ['Thunderbird', 'hero', 'bird', ['wings', 'sparks'], ['#FFE600', '#3A3AFF', '#FFFF7A'], ['thunder', 'sky', 'swift'], 'storm'],
    ['Vortex Sentinel', 'robe', 'round', ['rings', 'planet'], ['#3A2A6A', '#FFAA00', '#C07CFF'], ['knock', 'homing', 'battery'], 'gravity'],
    // PRIMORDIAL
    ['Primordial Dragon', 'heavy', 'dragon', ['wings', 'horns', 'spiketail', 'flames'], ['#101010', '#FF3A00', '#FFAA00'], ['burn', 'explosive', 'giant', 'undying'], 'dragon'],
    ['Void Empress', 'robe', 'void', ['crown', 'rings', 'orbs'], ['#0A0010', '#B04DFF', '#FF7AF2'], ['homing', 'phase', 'necro', 'battery'], 'blackhole'],
    ['Omega Mech', 'mech', 'cyber', ['shoulderpads', 'jetpack', 'gears'], ['#E0E0E0', '#FF003C', '#FF3A3A'], ['rapid', 'drone', 'explosive', 'pierce'], 'missiles'],
    ['Chrono Sovereign', 'robe', 'orb', ['clock', 'crown', 'halo2'], ['#FFE6A0', '#203A5A', '#7AF8FF'], ['rapid', 'battery', 'crit', 'phase'], 'timestop'],
    ['Sun Eater', 'heavy', 'void', ['halo', 'flames'], ['#1A0A00', '#FF8A00', '#FFE600'], ['burn', 'aura', 'vamp', 'giant'], 'supernova'],
    ['Glacial Overlord', 'heavy', 'helm', ['crown', 'spikes', 'cape'], ['#C0F0FF', '#2A5AAA', '#9AE8FF'], ['frost', 'frostaura', 'thorns', 'shield'], 'zero'],
    ['Storm Titan', 'heavy', 'round', ['sparks', 'rings', 'shoulderpads'], ['#5A6AFF', '#1A1A4A', '#B0A0FF'], ['thunder', 'chain', 'knock', 'swift'], 'storm'],
    ['Archon of Dawn', 'robe', 'knight', ['sixwings', 'halo2', 'sword'], ['#FFFFFF', '#FFD000', '#FFF6A0'], ['shield', 'regen', 'execute', 'homing'], 'smite'],
    ['Gorgon Empress', 'robe', 'round', ['crown', 'tentacles'], ['#2A6A3A', '#0A2A10', '#7CFF4D'], ['poison', 'split', 'phase', 'necro'], 'plague'],
    ['Nebula Wraith', 'float', 'void', ['stars', 'cape', 'rings'], ['#1A0A3A', '#FF7AF2', '#7AF8FF'], ['phase', 'homing', 'chain', 'echo'], 'starfall'],
    // SECRET
    ['The Architect', 'hero', 'cyber', ['halo', 'gears', 'orbs'], ['#FFFFFF', '#00F0FF', '#00F0FF'], ['pierce', 'ricochet', 'split', 'rapid'], 'grid'],
    ['Infinity Knight', 'heavy', 'knight', ['sixwings', 'halo2', 'sword', 'cape'], ['#FFE600', '#FF00AA', '#00F0FF'], ['crit', 'execute', 'shield', 'regen'], 'titanblade'],
    ['Eclipse', 'float', 'eye', ['rings', 'halo2', 'orbs'], ['#000000', '#FFAA00', '#FFE600'], ['burn', 'phase', 'homing', 'battery'], 'supernova'],
    ['Soul Devourer', 'heavy', 'skull', ['tentacles', 'horns', 'flames'], ['#0A0A0A', '#7CFF4D', '#7CFF4D'], ['vamp', 'necro', 'execute', 'rage'], 'rift'],
    ['Galactic Emperor', 'robe', 'astro', ['crown', 'planet', 'stars', 'cape'], ['#1A1040', '#FFD000', '#7AF8FF'], ['lucky', 'midas', 'homing', 'shield'], 'starfall'],
    ['Abyssal God', 'robe', 'octo', ['crown', 'halo2', 'tentacles'], ['#05000F', '#8A00FF', '#FF00AA'], ['poison', 'phase', 'chain', 'necro'], 'blackhole'],
    ['Celestial Phoenix', 'hero', 'bird', ['sixwings', 'halo2', 'flames'], ['#FFFFFF', '#FF7A00', '#FFE600'], ['burn', 'undying', 'regen', 'homing'], 'phoenix'],
    ['Dragon Emperor', 'heavy', 'dragon', ['crown', 'wings', 'spiketail', 'halo'], ['#FFD000', '#FF003C', '#FFE600'], ['burn', 'explosive', 'crit', 'giant'], 'dragon'],
    ['Chaos Engine', 'mech', 'tv', ['glitch', 'gears', 'sparks'], ['#101010', '#00FF66', '#00FF66'], ['rapid', 'ricochet', 'chain', 'explosive'], 'missiles'],
    ['ERROR_404', 'float', 'tv', ['glitch', 'halo'], ['#00FF66', '#FF00FF', '#00FFFF'], ['split', 'phase', 'chain', 'lucky'], 'glitch'],
    ['THE ONE', 'hero', 'orb', ['sixwings', 'halo2', 'rings', 'stars'], ['#FFFFFF', '#FFD700', '#FFFFFF'], ['crit', 'homing', 'pierce', 'regen', 'battery'], 'supernova']
  ];
  const N = L.length, r = Math.pow(1e12 / 2, 1 / (N - 1));
  const nice = v => { if (v < 100) return Math.round(v); const p = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.round(v / p) * p; };
  let prev = 1;
  L.forEach((e, i) => {
    let odds = i === N - 1 ? 1e12 : nice(2 * Math.pow(r, i));
    if (odds <= prev) odds = prev + 1; prev = odds;
    const tier = tierOf(odds);
    ROSTER.push({
      i, id: e[0].toLowerCase().replace(/[^a-z0-9]+/g, '_'), n: e[0], body: e[1], head: e[2], acc: e[3], col: e[4],
      p: e[5], u: e[6], odds, tier, L: LEVEL_BY_TIER[tier]
    });
  });
})();
const ROSTER_BY_ID = {}; ROSTER.forEach(c => ROSTER_BY_ID[c.id] = c);

function charStats(cid, mut) {
  const C = ROSTER_BY_ID[cid] || ROSTER[0], M = MUTATIONS[mut || ''] || MUTATIONS[''];
  const lg = Math.log10(C.odds);
  return { boost: (1 + 0.35 * Math.pow(lg, 1.35)) * M.mult, hpMult: 1 + 0.09 * lg * Math.sqrt(M.mult), L: C.L };
}
function totalOdds(cid, mut) { const C = ROSTER_BY_ID[cid]; return C.odds * (MUTATIONS[mut || ''] || MUTATIONS['']).odds; }
function powerLines(C) {
  return C.p.map(id => ({ id, name: `${PASSIVES[id].i} ${PASSIVES[id].n} ${ROMAN[C.L]}`, desc: PASSIVES[id].d(C.L), c: PASSIVES[id].c }));
}
