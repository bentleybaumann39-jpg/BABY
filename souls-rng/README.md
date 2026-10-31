# SOULS RNG — Realm Breaker

A third-person RNG boss shooter. Roll for characters, then take them into 25 different realms full of zombies and bosses.

## Play

Open **`SoulsRNG.html`** in Chrome, Edge or Firefox. It is a single file.

* It loads three.js from a CDN.
* If the CDN is blocked, it falls back to `vendor/three.min.js`. Keep the `vendor` folder next to the HTML file if you want to play offline.

When you click **ENTER REALM**, the browser locks your mouse to the game, so it can't drift off the screen. Press **ESC** to pause and get your cursor back. Click **RESUME** to lock it again.

| Key | Action |
|---|---|
| Mouse | Look around (third-person, over the shoulder) |
| Left click (hold) | Shoot |
| Right click (hold) | Aim down sights (the sniper zooms in) |
| 1–5 / mouse wheel | Assault rifle, shotgun, sniper, SMG, rocket launcher |
| R | Reload |
| WASD | Move |
| Space | Jump. Characters with *Sky Step* can double or triple jump. |
| Shift | Sprint |
| Q or E | Ultimate (when the ring is full) |
| ESC | Pause and free the mouse |

## What's in it

### Characters
* **120 characters**, with odds from *1 in 2* up to *1 in 1 trillion*, across 12 rarity tiers.
* Each character has its own model, built from:
  * 12 body types and 28 head types
  * 53 accessories (wings, halos, crowns, capes, tails, jetpacks and more)
* Each character has its own power kit:
  * **35 passive powers.** Examples: burning, freezing and poison bullets, chain lightning, homing, ricochet, exploding and shattering rounds, lifesteal, crits, execute, drones, necromancy, meteor and lightning strikes, shields, regeneration, double jumps.
  * **34 ultimates.** Examples: black hole, time stop, spirit dragon, mirror clones, titan blade, supernova, reality glitch.
* Rarer characters get stronger versions of their powers (level I–V), more passives, and higher damage and health.
* **Mutations** roll on top of the character: Shiny, Golden, Void and Rainbow. Each changes how the character looks and multiplies its stats.

### Realms and bosses
* **25 biomes.** Each has its own:
  * sky
  * weather particles
  * ground texture
  * props and skyline
  * lighting
  * music
* Some biomes change how you play:
  * lava and toxic pools that hurt you
  * slippery ice
  * water that slows you down
  * low gravity
* **25 hand-built bosses**, one per biome. Each has its own model and moveset, mixed from 20 attack types:
  * beams and sweeping lasers
  * shockwaves and tidal waves you have to jump over
  * laser grids, meteor rain, charges and slams
  * summons, black-hole pulls, life-drain tethers, decoys
* Bosses enrage into **phase 2** at half health. Beat the boss and a portal opens to the next realm.

### Zombies
* **13 zombie types**, each with its own model and behaviour:
  * walker and runner
  * brute (ground slam)
  * spitter (acid lobs)
  * bloater (explodes)
  * crawler
  * leaper
  * phantom (teleports)
  * shaman (summons more zombies)
  * armored (takes half damage unless you crit)
  * splitter
  * bat (flies and dive-bombs)
* Zombies wear outfits that match the biome: Santa hats, mummy wraps, gas masks, pumpkin heads and more.
* Elite zombies show up with a gold aura and drop extra loot.
* Headshots deal bonus damage.

### Everything from the original, still here
* Coins, luck, damage, health and speed upgrades, plus a new Greed upgrade
* Auto-roll
* The 100-tier Beast Pass. Its rewards are now character unlocks, coins and 2x luck potions.
* Stats
* Friends list and trade codes

New in the lobby:
* a character **Index** that tracks discoveries
* a 3D character showcase
* quick roll
* auto-sell for low rarities
* graphics settings: quality, mouse sensitivity, invert Y, FOV, volume and music

Old saves from the first version are imported automatically.

### Graphics
* Custom bloom post-processing
* Animated sky shader with aurora, black hole, glitch, sun-core, clouds and rift effects
* GPU particle system
* Real-time shadows
* Procedural ground textures
* Damage numbers, enemy health bars, a radar, and hit markers

If your computer struggles, the game drops the graphics quality on its own. You can override it in Settings.

## Develop

Source lives in `src/`:
* `shell.html` holds the page, CSS and HUD.
* `js/*.js` holds the game modules, which are concatenated in order.

Rebuild the single file:

```bash
node souls-rng/build.mjs
```

Headless checks. They need Playwright and Chromium.

* Boots the game, rolls, cycles all 25 biomes and bosses, and fires all 34 ultimates:

  ```bash
  node souls-rng/tests/smoke.cjs
  ```

* Renders contact sheets of every boss and a sample of characters into `souls-rng/shots/`:

  ```bash
  node souls-rng/tests/gallery.cjs
  ```
