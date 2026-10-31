# ASHLINE

*An online battle royale shooter. Thirty drop into the Kessler Valley. The ash closes in. Last squad standing wins.*

You jump from a transport over a 1 km valley:
- a river and a quarry
- a walled military fort and a radio ridge
- a farm, a rail yard, a mill village and a pine hamlet

Loot weapons, armour and medical supplies, and fight solo or with a squad, while a wall of volcanic ash (the *ashline*) closes in over seven fronts.

Everything is generated in code, with no art or audio files: terrain, buildings, weapons, soldiers, textures and sound.

## Play

### With friends (online)

The server is plain Node.js (version 20 or newer). Run this inside `ashline/`:

```bash
npm install
```

```bash
npm start
```

It prints the addresses to open, for example:

```
ASHLINE server ready
  Play:   http://localhost:8090/
  LAN:    http://192.168.1.20:8090/
```

- **Same network:** everyone opens the LAN address in a desktop browser (Chrome, Edge or Firefox).
- **Over the internet:** forward TCP port 8090 on your router to the host machine and share `http://<your-public-ip>:8090/`. You can also run the server on any Node host (a VPS, Render, Fly.io, Railway and so on); the server reads `PORT` from the environment.

In the game:
1. Press **Play online**.
2. One player shares the **party code**; the others paste it into **Join party**.
3. The leader picks **Solo / Duo / Trio** and presses **Deploy**.

The matchmaker waits 30 seconds for more players and fills every empty slot with bots, up to 30 players.

Server options:

```bash
node server/server.mjs --port=8090 --countdown=30 --players=30
```

| Flag | Effect |
|---|---|
| `--fast` | Short queue and a faster ash, for quick test games |
| `--test` | Enables the debug commands used by the automated tests |
| `--data=dir` | Where profiles are stored. The default is `server/data/`. |

### Practice vs bots (offline)

Double-click **`ASHLINE.html`**. It is one self-contained file, and **Practice vs bots** runs the whole match in your browser with no server and no install. Rebuild it after code changes:

```bash
npm run build
```

## Controls

| Key | Action |
|---|---|
| WASD · Shift · C/Ctrl · Space | Move · sprint · crouch · jump. In the air, Space leaves the plane or opens the chute. |
| Mouse · LMB · RMB | Look · fire · aim down sights (scopes zoom) |
| R · B | Reload · switch fire mode (auto/semi) |
| 1 2 3 · 4 / G · wheel | Primary weapons, sidearm · grenades (G swaps frag/smoke) · cycle weapons |
| E | Pick up the item you look at. Hold E to revive a downed teammate or hack an intel terminal. |
| 5 6 7 · H · X | Bandage · field kit · stim · best heal · cancel action |
| Tab · M · Z / MMB | Inventory (ground items, attachments, drop) · map · ping |
| Esc | Pause menu (the match keeps running) |

## What's in a match

- **Drop:**
  - The transport flies a random line across the valley.
  - Freefall with steering: look down to dive.
  - The chute opens automatically at 130 m.
- **Weapons** (hitscan, checked by the server):

  | Weapon | Type |
  |---|---|
  | P-9 | pistol |
  | Vespa | SMG |
  | KR-5 | assault rifle |
  | Halberd | assault rifle |
  | Sable | DMR |
  | Longreach | bolt-action sniper |
  | Breacher | pump shotgun |
  | Mattock | LMG |

  They have recoil, bloom, damage that falls off with range, and head, torso and limb damage zones.
- **Attachments:** red dot, 2×/4×/8× scopes, extended mag, suppressor, grip.
- **Gear:**
  - Level 1–3 helmets and vests, which wear out as they take damage.
  - Backpacks that set how much you can carry.
  - Bandages, field kits and stims.
  - Frag and smoke grenades.
- **The ash:** seven closing fronts. Damage outside rises from 1 to 12 HP per second, and the screen chokes brown.
- **Squads (duo/trio):**
  - Teammates are knocked down instead of dying, crawl, and can be revived by holding E.
  - Each knock bleeds out faster than the last.
  - A squad is out when every member is down.
  - Teammates share pings, markers and name tags.
  - After death you spectate.
- **Intel terminals:** hack one in 8 seconds to reveal the front *after* the next and pulse nearby enemy squads onto your map. The hack is loud.
- **Bots:** they drop, loot, fight, heal, revive, flee the ash and investigate gunfire. They follow the same rules as players: line of sight, hearing, no wallhacks.
- **Progression:**
  - XP for survival, kills, assists, revives, hacks, damage and placement.
  - 50 levels that unlock camo, helmet covers, weapon finishes and titles. Equip them in the **Locker**; other players see them.
  - **Stats** shows your career totals and recent matches.
  - Online profiles live on the server, keyed by a token in your browser. Practice profiles live in `localStorage`.

## How it works

```
shared/   Deterministic simulation used by everything:
          map generator, collision, movement, items, zone, Sim, bots + nav, binary protocol, progression
server/   Node + ws: lobby, parties, matchmaking, profiles. Runs each match through shared/net/MatchHost.js.
client/   three.js r186 (repo-level vendor/):
          renderer + post FX, terrain, buildings, vegetation, characters, viewmodel,
          effects, audio, HUD, menus, prediction + interpolation, in-browser practice server
tools/    build.mjs (standalone ASHLINE.html), mapdump.mjs (top-down PNG of the map)
tests/    protocol, sim, net (real server + WebSocket clients), e2e (headless Chromium)
```

### The server is authoritative

- The server simulates at **30 Hz**.
- Clients send one 22-byte input packet per tick and predict their own movement with the same `stepMove` code. They replay unacknowledged inputs when a snapshot arrives; the net test measures zero prediction error.
- Other players are drawn about 100 ms in the past.
- Shots are lag-compensated by rewinding hitboxes to the tick the shooter saw, up to 266 ms.
- Bullet spread is seeded from the input sequence number, so client tracers line up with what the server computes.

## Tests

| Command | What it checks |
|---|---|
| `node tests/protocol.test.mjs` | Wire format and progression maths |
| `node tests/sim.test.mjs` | Full 30-bot matches in solo, duo and trio |
| `node tests/net.test.mjs` | A real server with 3 WebSocket clients |
| `node tests/e2e.mjs` | Headless Chromium plays the game; screenshots go to `tests/shots/` |
| `npm test` | Runs the first three |

**`sim.test.mjs`** checks that:
- each match ends with exactly one winner
- the zone only ever shrinks
- no player ends up inside geometry
- the same seed gives the same result
- an average tick stays under 8 ms

**`net.test.mjs`** checks the party flow, bot fill, zero-error client prediction, lag-compensated hits, reconnecting into a running match, results, and XP being saved.

**`e2e.mjs`** plays the game in the browser:
- practice: menu → deploy → plane → freefall → loot → fight → inventory → map → results
- an online party of two on the real server
- the standalone `ASHLINE.html` opened from `file://` with the network blocked

## Known limits

- Weapons are hitscan, so there is no bullet drop.
- Doorways are open; there are no door objects.
- There is no prone, no vehicles and no voice chat.
- Anti-cheat is limited to server authority: the server validates movement, fire rate, ammo and hits.
