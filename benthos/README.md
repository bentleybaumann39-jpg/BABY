# BENTHOS: THE SILENT PRESSURE

*A survival-horror descent into the Trench of Whispers, in 480×270 pixel art.*

You are Mara Ekdahl, the last pilot certified on Halvard Marine's HV-series hardsuits. Three days ago the survey ROV *Magpie-3* went dark at 2,904 metres. Its final eleven seconds show a helmet in the silt with your suit's serial stencilled on the collar, and its hydrophone caught your voice calling out a depth. You have never been in the Asher Deep.

The full design is in [DESIGN.md](DESIGN.md). The game is a compressed, playable version of that whole arc. It runs 30–45 minutes from the ship's deck to the bottom of the trench, with three endings and a New Game+.

## Play

**Easiest:** double-click `Benthos.html`. It is one self-contained file with no server and no install.

`index.html` also works from disk, because the source files are plain scripts. Any current browser with Web Audio works (Chrome, Edge, Firefox, Safari; WebGL is optional), on a desktop, a tablet or a phone held sideways. Use headphones, and play in a dark room.

| Key | Action |
|---|---|
| WASD / arrows | Thrust (screen-relative). Let go to coast; coasting is silent. |
| Mouse | Aim the lamp, the Pick, the narrow ping and the Siphon jet |
| Shift | Boost (loud) |
| C / Space | Flood the ballast tank to sink (silent) / blow it to rise (hisses, spends air) |
| R | Ping. Tap for a wide pulse; hold and release for a narrow cone. The hull rings for 10 s and leaves a trail predators follow. |
| Right mouse (hold) | Listen through the hydrophones (directional sound, edge arcs, no thrust) |
| Left mouse | Fire the Pick / hold to reel in / click again to let go |
| F | Lamp: white, red, off. Hold to throw a flare. |
| E | Interact. Hold it to absorb biomass. |
| Q | Clamp to nearby rock (damps the ring). Hold to brace and power down. |
| 1–5, G | Use a biomass cell (Siphon jet, Caul shield, Bloom decoy) / Graft it into the hull |
| X | Powerhead (three shells in the whole game, very loud) |
| V / H / T | Hold breath / read the chest gauge (the truth) / swap the scrubber canister |
| B | Look through a Lossless Shard (full palette, no copies) |
| Tab · M · Z | Fabricator at a Cairn · Szabo's chart · wipe the visor |
| Esc | Pause |

A gamepad also works: left stick thrust, right stick aim, RT boost, LT listen, LB/RB rise/sink, A use, B clamp, X ping, Y lamp, RS-click Pick, D-pad cells and gauge.

**Touch.** The first touch switches to on-screen controls:
* **Left thumb:** a floating stick. Push past the ring to boost.
* **Right side:** USE, PING, PICK, LAMP, CLMP, EAR and BRTH buttons, plus PH, LENS, WIPE and GRFT when they apply.
* **Right edge:** the trim bar. Hold the top half to blow the tank (rise), the bottom half to flood it (sink).
* **Aim:** hold anywhere else on the right side to point the lamp and the Pick there.
* **The HUD itself:** hold the O₂ cluster for the chest gauge, tap SCRUB to swap the canister, tap the depth readout for the chart, tap a tank cell to use it. II pauses.

Taps work as clicks in menus and skip scenes. Prompts and tips name the touch controls once you're playing by touch.

**Settings**
* Difficulty: story, diver or abyssal (air use, damage and crush debt).
* Objective line and transponder beacon.
* Honest HUD (turns off the CO₂ lies), photosensitivity mode, steady trim.
* Quality: high (480×270), medium (400×225) or low (320×180), with thinner ambient life lower down. The game steps down on its own if it runs slow.
* Volume, music, CRT shader, screen shake, rumble or vibration, fullscreen.

## What's in it

**The descent**
* **Prologue on the deck of the *Halcyon Mercy*.** The only scene in full colour, with the eleven seconds of footage and a waltz on the galley radio.
* **Act I, 0–1,000 m.** The shaft and its terraces, riding the cage between stops:
  * the Sunlit Wall
  * the Phantom Floor, where sonar lies and the lamp blinds you
  * the *Gannet* bell
  * a whale fall
  * the Cage Fall
* **Act II, 1,000–2,904 m.** Open water with no walls and no shadow, plus:
  * the SOFAR channel and the Slow Wave
  * three Processions
  * the hanging *Thalassa Vigil*
  * *Magpie-3*
* **Act III, 3,000–4,190 m.** The impossible Benthic Plain:
  * brine lakes
  * the Machine's Eye
  * the overheard briefing
  * the Archive
* **The Breach at 1,140 m.** The death screen is true, RETRY does not reload, and everything after is subtly, provably wrong.

**Finding your way**
* A one-line objective for every stage, with optional side goals.
* After each ping the objective's transponder answers. Its bearing, distance and depth show for a few seconds.
* A journal of every document and tape found, rereadable from the pause menu.

**The living water** (`src/life.js`)
* Dinoflagellates flare behind your fins and behind anything big moving fast.
* Mid-water animals drift in a ring around you: crown jellies with a pinwheel alarm, comb jellies that rainbow in the lamp, siphonophore chains, lanternfish schools that scatter from the beam, pyrosomes, and dragonfish with a red cheek light.
* Seabed fauna grows over whatever floor is in view: kelp, fans, sponges, crinoids, bamboo coral and sea pens that glow when brushed, sea pigs, tripod fish, tube worms.
* A sperm whale crosses the shaft in Act I. A field of black smokers glows on the plain.
* You can look through the Gannet bell's viewport and into the Vigil's crew sphere.
* Nineteen field notes are logged as you meet things, and kept across runs.

**Creatures** (each one is described in DESIGN.md §3)
* **The Reliquary.** It waits for you to weaken and wears helmets at their own era's resolution.
* **The Sleeper.** Its sprite lags 500 ms behind its hitbox; only sonar and sound show where it really is.
* **The Procession.** A 300 m siphonophore that learns your signals.
* **The Grain.** A swarm hiding in the dither.
* **The Second Diver.** It replays your own recorded inputs.

**Systems**
* **Breath.** The Lung Cluster lies when CO₂ builds up.
* **Pressure.** Crush Debt closes the playfield and bends the CRT into pincushion.
* **Fidelity.** Hidden until the breach; the colours left in Mara's sprite.
* **Sonar.** Wireframes that see through rock, plus a terrain point cloud.
* **Biomass.** Strains that rebuild you as much as they help you.
* **Cairns** save the game, and their fabricator builds upgrades.
* **The viewport** cracks as crush debt climbs, and seals again as it falls.

**Story**
* Seventeen documents and five tapes. The tapes play as voices over the comms; one of them is in a voice you know.
* The first few deaths of each kind tell you, in a line, what went wrong.
* The chest gauge view has a photo of Tobias and Mara taped beside the dials. It tells the truth too.
* The Archive's helmets count in fours, in time with the Ostinato.
* A records page counts descents, deaths, helmets in the Archive and endings found.

**Rendering** (all software; every shape and texture is generated in code)
* A column ray-marcher over a floor heightfield, with a cut plane at the diver's depth. Rock sections get a traced rim.
* Per-material detail textures (cracked rock, pillow lava, ripples, burrows, nodules) and a cavity term, so the lamp rakes across the ground.
* Beer–Lambert light, so warm colours die first.
* 3D-primitive models ray-cast into a small G-buffer.
* Ordered dithering into per-depth palettes that shrink as you descend.
* An optional WebGL CRT pass. Its curvature inverts under pressure.

**Audio**
* Procedural Web Audio: a dry interior against a hull-filtered exterior.
* The Ostinato, built from the harmonics of a 17 Hz pulse your speakers can't play.
* Comms latency of depth ÷ 1,500 m/s, which goes negative after the breach.
* A bit-crushed mix on the plain.

**Endings and New Game+**
* Three endings: ASCENT, SEDIMENT, and a secret one.
* Finishing unlocks *Second Copy*, a New Game+ at 320×180.

## Project layout

```
index.html        page shell; loads src/*.js in order (works from file://)
Benthos.html      built single-file version (node benthos/tools/build.mjs)
DESIGN.md         the concept document
src/core.js       namespace, math, noise, input, persistence
src/palette.js    Halvard-48 palette, zone palettes, 32^3 LUTs, Fidelity merges
src/world.js      heightfield maps: deck, Act I-III, the void
src/render.js     terrain march, lighting, primitive models, quantise, CRT present
src/models.js     every model as a list of 3D primitives
src/audio.js      procedural audio engine, the Ostinato, the waltz
src/entities.js   entity list, noise events, items, props, cairns, the cage, effects
src/creatures.js  Reliquary, Sleeper, Procession, Grain, fauna, Second Diver
src/life.js       wake light, mid-water drifters, seabed fauna, the whale, black smokers
src/player.js     the diver: physics, sonar, breath, Crush Debt, Fidelity, biomass
src/zones.js      Phantom Floor, Slow Wave and SOFAR, the Settling
src/story.js      population, dialogue and latency, triggers, set pieces, endings
src/hud.js        pixel font, HUD, menus, sequences, endings
src/main.js       modes, fixed-step loop, camera, marine snow, frame pipeline
tests/smoke.mjs   visits every act and set piece headlessly; fails on any page error
tests/story.mjs   plays the critical path with simulated input, beat by beat
tests/touch.mjs   drives the game on an emulated phone through the touch controls
tests/bot.mjs     a bot that plays the whole game with no warps (steering, salvage, crafting) and logs each beat
tools/build.mjs   inlines everything into Benthos.html (--artifact <file> for a claude.ai page)
tools/shot.mjs    renders one view to a PNG for art iteration
```

## Tests

Both tests use Playwright (`npm install` at the repo root, or a global install).

```bash
node benthos/tests/smoke.mjs [shotDir]   # every act and sequence; optional screenshots
node benthos/tests/story.mjs [shotDir]   # deck -> Breach -> Magpie -> Archive -> ending -> title
node benthos/tests/touch.mjs [shotDir]   # menus, stick, buttons and trim bar on an emulated phone
node benthos/tests/bot.mjs 32 [shotDir]  # a full playthrough by a bot; --act2 / --act3 start later
node benthos/tools/build.mjs --check     # Benthos.html matches the sources
```
