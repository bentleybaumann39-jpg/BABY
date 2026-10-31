// Builds worlds and matches. Shared by the server, the practice mode and the tests.
import { DEFAULT_MAP_SEED, MODES, MATCH_PLAYERS } from '../constants.js';
import { generateMap } from '../map/MapGen.js';
import { World } from '../physics/Collision.js';
import { Nav } from './Nav.js';
import { Sim } from './Sim.js';
import { makeBot } from './Bots.js';
import { Rng } from '../rng.js';
import { randomCosmetics } from '../progression.js';

const BOT_NAMES = ['Kestrel', 'Varga', 'Moth', 'Brannock', 'Ilse', 'Corvo', 'Teague', 'Halloran', 'Sutter', 'Pike', 'Renko', 'Dace',
  'Mercer', 'Oriel', 'Fenwick', 'Basso', 'Lark', 'Okafor', 'Stroud', 'Vane', 'Calder', 'Nyx', 'Ruskin', 'Thorne', 'Ambrose',
  'Quill', 'Sorrel', 'Hask', 'Wren', 'Dunmore', 'Ivo', 'Rook', 'Sabre', 'Tamsin', 'Garrow', 'Holt', 'Marek', 'Selk', 'Ural', 'Zane'];

const cache = new Map();
export function getWorld(seed = DEFAULT_MAP_SEED, withNav = true) {
  let c = cache.get(seed);
  if (!c) { const map = generateMap(seed); c = { map, world: new World(map), nav: null }; cache.set(seed, c); }
  if (withNav && !c.nav) c.nav = new Nav(c.world);
  return c;
}

// groups: array of squads, each an array of humans { id, name, cos }. Bots fill every squad and then
// whole bot squads are added up to `total` players.
export function buildMatch({ seed, mode = 'solo', groups = [], total = MATCH_PLAYERS, timeScale = 1, mapSeed = DEFAULT_MAP_SEED, skill = [0.25, 0.85], lootMul = 1 }) {
  const { map, world, nav } = getWorld(mapSeed, true);
  const sim = new Sim({ map, world, nav, seed, mode, timeScale, botFactory: makeBot, lootMul });
  const size = MODES[mode] ? MODES[mode].squad : 1;
  const rng = new Rng(seed ^ 0xb075);
  const names = rng.shuffle(BOT_NAMES.slice());
  let botId = 1000, nameI = 0, squadId = 1;
  const addBot = (squad) => {
    const name = names[nameI++ % names.length] + (nameI > names.length ? String(nameI) : '');
    sim.addPlayer({ id: botId++, name, squad, bot: true, skill: rng.range(skill[0], skill[1]), cos: randomCosmetics(rng) });
  };
  for (const g of groups) {
    const sq = squadId++;
    for (const h of g.slice(0, size)) sim.addPlayer({ id: h.id, name: h.name, squad: sq, bot: false, cos: h.cos });
    for (let i = Math.min(g.length, size); i < size; i++) addBot(sq);
  }
  while (sim.list.length + size <= total) { const sq = squadId++; for (let i = 0; i < size; i++) addBot(sq); }
  return sim;
}
